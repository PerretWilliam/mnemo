export type Params = Record<string, string | number>;

/** Replaces `{name}` placeholders. Unknown placeholders are left as-is so they stay visible. */
export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Plural category for the languages we ship. French treats 0 and 1 as singular. */
export function pluralCategory(lang: string, count: number): 'one' | 'other' {
  return (lang === 'fr' ? count < 2 : count === 1) ? 'one' : 'other';
}
