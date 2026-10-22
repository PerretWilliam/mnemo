// SQLite storage: 3 tables (decks, cards, sessions), no ORM.
// Every function takes the db from `useSQLiteContext()`.
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CardInput, ExchangeFile, HistoryInput } from '@/lib/format';

export type Deck = { id: number; name: string; createdAt: number; cardCount: number };
export type Card = CardInput & { id: number; deckId: number; updatedAt: number };
export type Session = {
  id: number;
  deckId: number;
  deckName: string;
  startedAt: number;
  endedAt: number;
  correct: number;
  wrong: number;
};

const SCHEMA_VERSION = 1;

/** Runs on app start through `<SQLiteProvider onInit>`. Bump SCHEMA_VERSION and add a step to migrate. */
export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;
  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE decks (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE cards (
        id INTEGER PRIMARY KEY NOT NULL,
        deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        front TEXT NOT NULL,
        back TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX cards_deck ON cards(deck_id);
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY NOT NULL,
        deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        wrong INTEGER NOT NULL
      );
      CREATE INDEX sessions_ended ON sessions(ended_at);
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

// --- Decks ---

export function listDecks(db: SQLiteDatabase) {
  return db.getAllAsync<Deck>(`
    SELECT d.id, d.name, d.created_at AS createdAt, COUNT(c.id) AS cardCount
    FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
    GROUP BY d.id ORDER BY d.name COLLATE NOCASE`);
}

export function getDeck(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Deck>(
    `SELECT d.id, d.name, d.created_at AS createdAt,
       (SELECT COUNT(*) FROM cards WHERE deck_id = d.id) AS cardCount
     FROM decks d WHERE d.id = ?`,
    id,
  );
}

export async function createDeck(db: SQLiteDatabase, name: string) {
  const r = await db.runAsync('INSERT INTO decks (name, created_at) VALUES (?, ?)', name.trim(), Date.now());
  return r.lastInsertRowId;
}

export async function renameDeck(db: SQLiteDatabase, id: number, name: string) {
  await db.runAsync('UPDATE decks SET name = ? WHERE id = ?', name.trim(), id);
}

export async function deleteDeck(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM decks WHERE id = ?', id);
}

// --- Cards ---

type CardRow = { id: number; deckId: number; front: string; back: string; tags: string; updatedAt: number };
const toCard = (r: CardRow): Card => ({ ...r, tags: JSON.parse(r.tags) as string[] });
const CARD_COLS = 'id, deck_id AS deckId, front, back, tags, updated_at AS updatedAt';

export async function listCards(db: SQLiteDatabase, deckId: number) {
  const rows = await db.getAllAsync<CardRow>(`SELECT ${CARD_COLS} FROM cards WHERE deck_id = ? ORDER BY id`, deckId);
  return rows.map(toCard);
}

export async function getCard(db: SQLiteDatabase, id: number) {
  const row = await db.getFirstAsync<CardRow>(`SELECT ${CARD_COLS} FROM cards WHERE id = ?`, id);
  return row ? toCard(row) : null;
}

export async function createCard(db: SQLiteDatabase, deckId: number, c: CardInput) {
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO cards (deck_id, front, back, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    deckId,
    c.front,
    c.back,
    JSON.stringify(c.tags),
    now,
    now,
  );
}

export async function updateCard(db: SQLiteDatabase, id: number, c: CardInput) {
  await db.runAsync(
    'UPDATE cards SET front = ?, back = ?, tags = ?, updated_at = ? WHERE id = ?',
    c.front,
    c.back,
    JSON.stringify(c.tags),
    Date.now(),
    id,
  );
}

export async function deleteCard(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM cards WHERE id = ?', id);
}

// --- Sessions ---

export async function saveSession(
  db: SQLiteDatabase,
  s: { deckId: number; startedAt: number; endedAt: number; correct: number; wrong: number },
) {
  await db.runAsync(
    'INSERT INTO sessions (deck_id, started_at, ended_at, correct, wrong) VALUES (?, ?, ?, ?, ?)',
    s.deckId,
    s.startedAt,
    s.endedAt,
    s.correct,
    s.wrong,
  );
}

export function listSessions(db: SQLiteDatabase, limit = 500) {
  return db.getAllAsync<Session>(
    `SELECT s.id, s.deck_id AS deckId, d.name AS deckName, s.started_at AS startedAt,
       s.ended_at AS endedAt, s.correct, s.wrong
     FROM sessions s JOIN decks d ON d.id = s.deck_id
     ORDER BY s.ended_at DESC LIMIT ?`,
    limit,
  );
}

// --- Import / export ---

/** How to handle an imported deck whose name already exists. */
export type ConflictChoice = 'merge' | 'new' | 'skip';

export async function importExchange(
  db: SQLiteDatabase,
  data: ExchangeFile,
  resolve: (deckName: string) => Promise<ConflictChoice>,
) {
  // Ask about conflicts before writing anything, so the import stays one transaction.
  const existing = new Map((await listDecks(db)).map((d) => [d.name.toLowerCase(), d.id]));
  const plan: { deck: (typeof data.decks)[number]; targetId: number | null }[] = [];
  for (const deck of data.decks) {
    const id = existing.get(deck.name.toLowerCase());
    if (id === undefined) plan.push({ deck, targetId: null });
    else {
      const choice = await resolve(deck.name);
      if (choice === 'skip') continue;
      plan.push({ deck, targetId: choice === 'merge' ? id : null });
    }
  }

  let cards = 0;
  await db.withTransactionAsync(async () => {
    const idsByName = new Map<string, number>();
    for (const { deck, targetId } of plan) {
      const deckId = targetId ?? (await createDeck(db, deck.name));
      idsByName.set(deck.name.toLowerCase(), deckId);
      for (const c of deck.cards) await createCard(db, deckId, c);
      cards += deck.cards.length;
    }
    for (const h of data.history ?? []) {
      const deckId = idsByName.get(h.deck.toLowerCase()) ?? existing.get(h.deck.toLowerCase());
      if (deckId === undefined) continue;
      await saveSession(db, {
        deckId,
        startedAt: Date.parse(h.startedAt),
        endedAt: Date.parse(h.endedAt),
        correct: h.correct,
        wrong: h.wrong,
      });
    }
  });
  return { decks: plan.length, cards };
}

export async function exportExchange(db: SQLiteDatabase, withHistory: boolean): Promise<ExchangeFile> {
  const decks = await listDecks(db);
  const out: ExchangeFile = {
    version: 1,
    decks: await Promise.all(
      decks.map(async (d) => ({
        name: d.name,
        cards: (await listCards(db, d.id)).map(({ front, back, tags }) => ({ front, back, tags })),
      })),
    ),
  };
  if (withHistory) {
    out.history = (await listSessions(db, -1)).map(
      (s): HistoryInput => ({
        deck: s.deckName,
        startedAt: new Date(s.startedAt).toISOString(),
        endedAt: new Date(s.endedAt).toISOString(),
        correct: s.correct,
        wrong: s.wrong,
      }),
    );
  }
  return out;
}

export async function wipeAll(db: SQLiteDatabase) {
  await db.execAsync('DELETE FROM sessions; DELETE FROM cards; DELETE FROM decks;');
}
