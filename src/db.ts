// SQLite storage: 4 tables (folders, decks, cards, sessions), no ORM.
// Every function takes the db from `useSQLiteContext()`.
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CardInput, ExchangeFile, HistoryInput } from '@/lib/format';
import { nextFolderColor } from '@/lib/folders';

export type Folder = { id: number; name: string; color: string; createdAt: number; deckCount: number };
export type Deck = {
  id: number;
  name: string;
  createdAt: number;
  cardCount: number;
  folderId: number | null;
  /** Color of the deck's folder; null when unfiled. Resolve it with `deckColor()`. */
  folderColor: string | null;
};
export type Card = CardInput & { id: number; deckId: number; updatedAt: number };
export type Session = {
  id: number;
  deckId: number;
  deckName: string;
  folderColor: string | null;
  startedAt: number;
  endedAt: number;
  correct: number;
  wrong: number;
};

const SCHEMA_VERSION = 2;

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
  if (current < 2) {
    // Deleting a folder unfiles its decks (SET NULL) instead of deleting them.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE folders (
          id INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        ALTER TABLE decks ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;
        CREATE INDEX decks_folder ON decks(folder_id);
      `);
    });
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

// --- Folders ---

export function listFolders(db: SQLiteDatabase) {
  return db.getAllAsync<Folder>(`
    SELECT f.id, f.name, f.color, f.created_at AS createdAt, COUNT(d.id) AS deckCount
    FROM folders f LEFT JOIN decks d ON d.folder_id = f.id
    GROUP BY f.id ORDER BY f.name COLLATE NOCASE`);
}

export function getFolder(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Folder>(
    `SELECT f.id, f.name, f.color, f.created_at AS createdAt,
       (SELECT COUNT(*) FROM decks WHERE folder_id = f.id) AS deckCount
     FROM folders f WHERE f.id = ?`,
    id,
  );
}

export async function createFolder(db: SQLiteDatabase, name: string, color: string) {
  const r = await db.runAsync('INSERT INTO folders (name, color, created_at) VALUES (?, ?, ?)', name.trim(), color, Date.now());
  return r.lastInsertRowId;
}

export async function updateFolder(db: SQLiteDatabase, id: number, name: string, color: string) {
  await db.runAsync('UPDATE folders SET name = ?, color = ? WHERE id = ?', name.trim(), color, id);
}

/** Decks of the folder are kept and become unfiled. */
export async function deleteFolder(db: SQLiteDatabase, id: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE decks SET folder_id = NULL WHERE folder_id = ?', id);
    await db.runAsync('DELETE FROM folders WHERE id = ?', id);
  });
}

export async function setDeckFolder(db: SQLiteDatabase, deckId: number, folderId: number | null) {
  await db.runAsync('UPDATE decks SET folder_id = ? WHERE id = ?', folderId, deckId);
}

// --- Decks ---

export function listDecks(db: SQLiteDatabase) {
  return db.getAllAsync<Deck>(`
    SELECT d.id, d.name, d.created_at AS createdAt, COUNT(c.id) AS cardCount,
      d.folder_id AS folderId, f.color AS folderColor
    FROM decks d
    LEFT JOIN cards c ON c.deck_id = d.id
    LEFT JOIN folders f ON f.id = d.folder_id
    GROUP BY d.id ORDER BY d.name COLLATE NOCASE`);
}

export function getDeck(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Deck>(
    `SELECT d.id, d.name, d.created_at AS createdAt,
       (SELECT COUNT(*) FROM cards WHERE deck_id = d.id) AS cardCount,
       d.folder_id AS folderId, f.color AS folderColor
     FROM decks d LEFT JOIN folders f ON f.id = d.folder_id WHERE d.id = ?`,
    id,
  );
}

export async function createDeck(db: SQLiteDatabase, name: string, folderId: number | null = null) {
  const r = await db.runAsync(
    'INSERT INTO decks (name, created_at, folder_id) VALUES (?, ?, ?)',
    name.trim(),
    Date.now(),
    folderId,
  );
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
    `SELECT s.id, s.deck_id AS deckId, d.name AS deckName, f.color AS folderColor,
       s.started_at AS startedAt, s.ended_at AS endedAt, s.correct, s.wrong
     FROM sessions s JOIN decks d ON d.id = s.deck_id LEFT JOIN folders f ON f.id = d.folder_id
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
    // Folders are matched by name (case-insensitive) and created on demand. An existing folder keeps its color.
    const folders = await listFolders(db);
    const folderIds = new Map(folders.map((f) => [f.name.toLowerCase(), f.id]));
    const colors = folders.map((f) => f.color);
    const ensureFolder = async (name: string) => {
      const key = name.toLowerCase();
      let id = folderIds.get(key);
      if (id === undefined) {
        const color = data.folders?.find((f) => f.name.toLowerCase() === key)?.color ?? nextFolderColor(colors);
        colors.push(color);
        id = await createFolder(db, name, color);
        folderIds.set(key, id);
      }
      return id;
    };
    for (const f of data.folders ?? []) await ensureFolder(f.name);

    const idsByName = new Map<string, number>();
    for (const { deck, targetId } of plan) {
      const folderId = targetId === null && deck.folder ? await ensureFolder(deck.folder) : null;
      const deckId = targetId ?? (await createDeck(db, deck.name, folderId));
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
  const [decks, folders] = await Promise.all([listDecks(db), listFolders(db)]);
  const folderNames = new Map(folders.map((f) => [f.id, f.name]));
  const out: ExchangeFile = {
    version: 1,
    decks: await Promise.all(
      decks.map(async (d) => {
        const folder = d.folderId === null ? undefined : folderNames.get(d.folderId);
        return {
          name: d.name,
          ...(folder ? { folder } : {}),
          cards: (await listCards(db, d.id)).map(({ front, back, tags }) => ({ front, back, tags })),
        };
      }),
    ),
  };
  if (folders.length > 0) out.folders = folders.map(({ name, color }) => ({ name, color }));
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
  await db.execAsync('DELETE FROM sessions; DELETE FROM cards; DELETE FROM decks; DELETE FROM folders;');
}
