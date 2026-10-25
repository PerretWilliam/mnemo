export type CardTypes = 'qa' | 'cloze' | 'both';

export type PromptOptions = {
  topic: string;
  deckName: string;
  /** Optional folder the deck is filed in on import. */
  folder?: string;
  count: number;
  types: CardTypes;
  language: string;
  notes?: string;
};

const TYPE_LABELS: Record<CardTypes, string> = {
  qa: 'question/answer only',
  cloze: 'cloze (fill in the blank) only',
  both: 'a mix of question/answer and cloze',
};

/** Builds the prompt the user pastes into ChatGPT / Claude. The answer is imported via the clipboard. */
export function buildPrompt(o: PromptOptions): string {
  const lines = [
    'You generate flashcards for an app. Reply ONLY with one valid ```json block, with no text before or after.',
    '',
    'Exact format:',
    JSON.stringify({
      version: 1,
      decks: [
        {
          name: o.deckName,
          ...(o.folder?.trim() ? { folder: o.folder.trim() } : {}),
          cards: [{ front: '...', back: '...', tags: ['...'] }],
        },
      ],
    }),
    '',
    'Rules:',
    `- ${o.count} cards about: ${o.topic}. Language of the cards: ${o.language}.`,
    `- Allowed card types: ${TYPE_LABELS[o.types]}.`,
  ];
  if (o.types !== 'cloze') lines.push('  - Question/answer: "front" = question, "back" = answer.');
  if (o.types !== 'qa') {
    lines.push(
      '  - Cloze: in "front", wrap every part to hide with {{c::...}}; "back" may be empty or hold a short explanation.',
    );
  }
  lines.push(
    '- "front" and "back" are Markdown. Math uses KaTeX LaTeX: $...$ inline, $$...$$ for blocks.',
    '- This is JSON: every LaTeX backslash must be doubled (\\\\frac, \\\\int, \\\\alpha).',
    '- One idea per card, short answers, no invented information.',
  );
  const notes = o.notes?.trim();
  if (notes) lines.push('- Use only these notes as your source:', '"""', notes, '"""');
  return lines.join('\n');
}
