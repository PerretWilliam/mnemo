// JSON exchange format shared by import, export and AI generation.
// See docs/FORMAT.md for the spec.

export type CardInput = { front: string; back: string; tags: string[] };
export type DeckInput = { name: string; cards: CardInput[] };
export type HistoryInput = {
  deck: string;
  startedAt: string; // ISO 8601
  endedAt: string; // ISO 8601
  correct: number;
  wrong: number;
};
export type ExchangeFile = { version: 1; decks: DeckInput[]; history?: HistoryInput[] };

export type ParseResult = {
  /** Valid content only; `null` when the file is unusable. */
  data: ExchangeFile | null;
  /** Problems that made something get skipped. */
  errors: string[];
  /** Things that were fixed automatically. */
  warnings: string[];
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
  const errors: string[] = [];
  const warnings: string[] = [];

  let json: unknown;
  const text = extractJson(raw.trim());
  try {
    json = JSON.parse(text);
  } catch {
    const repaired = escapeInvalidBackslashes(text);
    try {
      json = JSON.parse(repaired.text);
      warnings.push(`Repaired ${repaired.count} unescaped LaTeX backslash(es).`);
    } catch (e) {
      return { data: null, errors: [`Invalid JSON: ${(e as Error).message}`], warnings };
    }
  }

  if (typeof json !== 'object' || json === null) {
    return { data: null, errors: ['Root must be a JSON object.'], warnings };
  }
  const root = json as Record<string, unknown>;
  if (root.version !== 1) {
    return { data: null, errors: ['"version" must be 1.'], warnings };
  }
  if (!Array.isArray(root.decks) || root.decks.length === 0) {
    return { data: null, errors: ['"decks" must be a non-empty array.'], warnings };
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
      errors.push(`Deck ${di + 1}: "name" must be a non-empty string.`);
      return;
    }
    const name = deck.name.trim();
    if (!Array.isArray(deck.cards)) {
      errors.push(`Deck "${name}": "cards" must be an array.`);
      return;
    }
    const cards: CardInput[] = [];
    deck.cards.forEach((c: unknown, ci) => {
      const card = (c ?? {}) as Record<string, unknown>;
      const where = `Deck "${name}", card ${ci + 1}`;
      if (!isNonEmpty(card.front)) return errors.push(`${where}: "front" must be a non-empty string.`);
      if (card.back !== undefined && !isStr(card.back)) return errors.push(`${where}: "back" must be a string.`);
      if (card.tags !== undefined && !(Array.isArray(card.tags) && card.tags.every(isStr))) {
        return errors.push(`${where}: "tags" must be an array of strings.`);
      }
      const front = fix(card.front);
      const back = fix(card.back ?? '');
      if (!front.includes('{{c::') && back.trim() === '') {
        return errors.push(`${where}: "back" is required unless "front" contains a {{c::...}} cloze.`);
      }
      cards.push({ front, back, tags: ((card.tags as string[] | undefined) ?? []).map((t) => t.trim()).filter(Boolean) });
    });
    decks.push({ name, cards });
  });

  if (latexFixes > 0) warnings.push(`Restored LaTeX commands in ${latexFixes} field(s).`);

  let history: HistoryInput[] | undefined;
  if (root.history !== undefined) {
    if (!Array.isArray(root.history)) {
      errors.push('"history" must be an array; ignored.');
    } else {
      history = [];
      root.history.forEach((h: unknown, hi) => {
        const e = (h ?? {}) as Record<string, unknown>;
        if (isNonEmpty(e.deck) && isIsoDate(e.startedAt) && isIsoDate(e.endedAt) && isCount(e.correct) && isCount(e.wrong)) {
          history!.push(e as unknown as HistoryInput);
        } else {
          errors.push(`History entry ${hi + 1}: invalid, skipped.`);
        }
      });
    }
  }

  if (decks.length === 0) return { data: null, errors, warnings };
  return { data: { version: 1, decks, ...(history ? { history } : {}) }, errors, warnings };
}
