// Cloze ("fill in the blank") syntax: `{{c::hidden part}}`.
// The hidden part may contain LaTeX with its own braces, e.g. `{{c::$\frac{1}{x^{2}}$}}`,
// so a regex is not enough: we scan and track brace depth.

const OPEN = '{{c::';

type Segment = { text: string; cloze: boolean };

export function splitCloze(input: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < input.length) {
    const start = input.indexOf(OPEN, i);
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    for (let j = start + OPEN.length; j < input.length; j++) {
      const ch = input[j];
      if (ch === '{') depth++;
      else if (ch === '}') {
        if (depth === 0 && input[j + 1] === '}') {
          end = j;
          break;
        }
        depth--;
      }
    }
    if (end === -1) break; // unterminated: keep the rest as plain text
    if (start > i) out.push({ text: input.slice(i, start), cloze: false });
    out.push({ text: input.slice(start + OPEN.length, end), cloze: true });
    i = end + 2;
  }
  if (i < input.length) out.push({ text: input.slice(i), cloze: false });
  return out;
}

export function isCloze(input: string): boolean {
  return splitCloze(input).some((s) => s.cloze);
}

/** Markdown with blanks hidden (`reveal = false`) or highlighted (`reveal = true`). */
export function renderCloze(input: string, reveal: boolean): string {
  return splitCloze(input)
    .map((s) =>
      !s.cloze
        ? s.text
        : reveal
          ? `<mark class="cloze">${s.text}</mark>`
          : '<span class="cloze">[…]</span>',
    )
    .join('');
}

/** Markdown for the answer side: question (blanks revealed if cloze), then the back if any. */
export function answerSource(front: string, back: string): string {
  const answer = isCloze(front) ? renderCloze(front, true) : front;
  return back.trim() ? `${answer}\n\n---\n\n${back}` : answer;
}

/** Plain text with cloze markers removed, for list previews. */
export function stripCloze(input: string): string {
  return splitCloze(input)
    .map((s) => s.text)
    .join('');
}
