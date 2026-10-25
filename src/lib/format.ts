// JSON exchange format shared by import, export and AI generation.
// See docs/FORMAT.md for the spec.
import { isHexColor } from './folders.ts';

export type CardInput = { front: string; back: string; tags: string[] };
export type DeckInput = { name: string; folder?: string; cards: CardInput[] };
export type FolderInput = { name: string; color: string };
export type HistoryInput = {
  deck: string;
  startedAt: string; // ISO 8601
  endedAt: string; // ISO 8601
  correct: number;
  wrong: number;
};
export type ExchangeFile = { version: 1; decks: DeckInput[]; folders?: FolderInput[]; history?: HistoryInput[] };

/** Problems are codes + params so the UI can translate them (keys `issue.<code>`). */
export type IssueCode =
  | 'invalidJson'
  | 'rootObject'
  | 'version'
  | 'decksArray'
  | 'deckName'
  | 'cardsArray'
  | 'deckFolder'
  | 'foldersArray'
  | 'folderEntry'
  | 'front'
  | 'backType'
  | 'tags'
  | 'backRequired'
  | 'historyArray'
  | 'historyEntry'
  | 'repairedBackslashes'
  | 'restoredLatex';
export type Issue = { code: IssueCode; params?: Record<string, string | number> };

export type ParseResult = {
  /** Valid content only; `null` when the file is unusable. */
  data: ExchangeFile | null;
  /** Problems that made something get skipped. */
  errors: Issue[];
  /** Things that were fixed automatically. */
  warnings: Issue[];
};

/** Takes raw text (a file, or an AI answer with prose and ``` fences) and extracts the JSON. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1];
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  return first !== -1 && last > first ? raw.slice(first, last + 1) : raw;
}

/**
 * AIs often write LaTeX with single backslashes inside JSON strings.
 * `\int`, `\alpha`... are invalid JSON escapes: we double them so parsing succeeds.
 */
function escapeInvalidBackslashes(json: string): { text: string; count: number } {
  let count = 0;
  const text = json.replace(/\\(\\|u[0-9a-fA-F]{4}|[\s\S])/g, (m, c: string) => {
    if (c === '\\' || c.length === 5 || '"/bfnrt'.includes(c)) return m;
    count++;
    return '\\\\' + c;
  });
  return { text, count };
}

/**
 * The sneaky half of the backslash trap: `\frac`, `\theta`, `\right`, `\neq` are *valid*
 * JSON escapes and silently become control characters. We turn them back into LaTeX.
 * `\n` is only restored inside inline `$...$` math, where a real newline never belongs.
 */
export function restoreLatex(s: string): string {
  const fixed = s
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/\t(?=[a-zA-Z])/g, '\\t')
    .replace(/\r(?=[a-zA-Z])/g, '\\r');
  return fixed.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, (m) =>
    m.startsWith('$$') ? m : m.replace(/\n(?=[a-zA-Z])/g, '\\n'),
  );
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;
const isIsoDate = (v: unknown) => isStr(v) && !Number.isNaN(Date.parse(v));
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;

export function parseExchange(raw: string): ParseResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  let json: unknown;
  const text = extractJson(raw.trim());
  try {
    json = JSON.parse(text);
  } catch {
    const repaired = escapeInvalidBackslashes(text);
    try {
      json = JSON.parse(repaired.text);
      warnings.push({ code: 'repairedBackslashes', params: { count: repaired.count } });
    } catch (e) {
      return { data: null, errors: [{ code: 'invalidJson', params: { detail: (e as Error).message } }], warnings };
    }
  }

  if (typeof json !== 'object' || json === null) {
    return { data: null, errors: [{ code: 'rootObject' }], warnings };
  }
  const root = json as Record<string, unknown>;
  if (root.version !== 1) {
    return { data: null, errors: [{ code: 'version' }], warnings };
  }
  if (!Array.isArray(root.decks) || root.decks.length === 0) {
    return { data: null, errors: [{ code: 'decksArray' }], warnings };
  }

  let latexFixes = 0;
  const fix = (s: string) => {
    const r = restoreLatex(s);
    if (r !== s) latexFixes++;
    return r;
  };

  const decks: DeckInput[] = [];
  root.decks.forEach((d: unknown, di) => {
    const deck = (d ?? {}) as Record<string, unknown>;
    if (!isNonEmpty(deck.name)) {
      errors.push({ code: 'deckName', params: { deck: di + 1 } });
      return;
    }
    const name = deck.name.trim();
    if (!Array.isArray(deck.cards)) {
      errors.push({ code: 'cardsArray', params: { deck: name } });
      return;
    }
    const cards: CardInput[] = [];
    deck.cards.forEach((c: unknown, ci) => {
      const card = (c ?? {}) as Record<string, unknown>;
      const where = { deck: name, card: ci + 1 };
      if (!isNonEmpty(card.front)) return errors.push({ code: 'front', params: where });
      if (card.back !== undefined && !isStr(card.back)) return errors.push({ code: 'backType', params: where });
      if (card.tags !== undefined && !(Array.isArray(card.tags) && card.tags.every(isStr))) {
        return errors.push({ code: 'tags', params: where });
      }
      const front = fix(card.front);
      const back = fix(card.back ?? '');
      if (!front.includes('{{c::') && back.trim() === '') {
        return errors.push({ code: 'backRequired', params: where });
      }
      cards.push({ front, back, tags: ((card.tags as string[] | undefined) ?? []).map((t) => t.trim()).filter(Boolean) });
    });
    let folder: string | undefined;
    if (deck.folder !== undefined) {
      if (isStr(deck.folder)) folder = deck.folder.trim() || undefined;
      else errors.push({ code: 'deckFolder', params: { deck: name } });
    }
    decks.push({ name, ...(folder ? { folder } : {}), cards });
  });

  if (latexFixes > 0) warnings.push({ code: 'restoredLatex', params: { count: latexFixes } });

  let folders: FolderInput[] | undefined;
  if (root.folders !== undefined) {
    if (!Array.isArray(root.folders)) {
      errors.push({ code: 'foldersArray' });
    } else {
      folders = [];
      root.folders.forEach((f: unknown, fi) => {
        const e = (f ?? {}) as Record<string, unknown>;
        if (isNonEmpty(e.name) && isHexColor(e.color)) folders!.push({ name: e.name.trim(), color: e.color });
        else errors.push({ code: 'folderEntry', params: { entry: fi + 1 } });
      });
    }
  }

  let history: HistoryInput[] | undefined;
  if (root.history !== undefined) {
    if (!Array.isArray(root.history)) {
      errors.push({ code: 'historyArray' });
    } else {
      history = [];
      root.history.forEach((h: unknown, hi) => {
        const e = (h ?? {}) as Record<string, unknown>;
        if (isNonEmpty(e.deck) && isIsoDate(e.startedAt) && isIsoDate(e.endedAt) && isCount(e.correct) && isCount(e.wrong)) {
          history!.push(e as unknown as HistoryInput);
        } else {
          errors.push({ code: 'historyEntry', params: { entry: hi + 1 } });
        }
      });
    }
  }

  if (decks.length === 0) return { data: null, errors, warnings };
  return {
    data: { version: 1, decks, ...(folders?.length ? { folders } : {}), ...(history ? { history } : {}) },
    errors,
    warnings,
  };
}
