// Deck folders: palette, grouping and color rules. Pure, so it is unit-tested.

/** Folder colors (readable on light and dark backgrounds). */
export const FOLDER_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16'];

/** Only `#RRGGBB` is accepted: tints append a 2-digit alpha to it. */
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** Palette color used the fewest times (first one on ties), so new folders get distinct colors. */
export function nextFolderColor(used: string[]): string {
  const count = (c: string) => used.filter((u) => u.toLowerCase() === c.toLowerCase()).length;
  return FOLDER_COLORS.reduce((best, c) => (count(c) < count(best) ? c : best));
}

export type Section<F, D> = { folder: F | null; decks: D[] };

/**
 * One section per folder (empty ones included, so they stay reachable), in the given order,
 * then the unfiled decks as a `folder: null` section when there are any.
 */
export function groupByFolder<F extends { id: number }, D extends { folderId: number | null }>(
  folders: F[],
  decks: D[],
): Section<F, D>[] {
  const sections: Section<F, D>[] = folders.map((folder) => ({
    folder,
    decks: decks.filter((d) => d.folderId === folder.id),
  }));
  const ids = new Set(folders.map((f) => f.id));
  const unfiled = decks.filter((d) => d.folderId === null || !ids.has(d.folderId));
  if (unfiled.length > 0) sections.push({ folder: null, decks: unfiled });
  return sections;
}
