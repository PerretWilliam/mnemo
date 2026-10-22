# JSON exchange format (v1)

One format for import, export and AI generation. Implemented in `src/lib/format.ts`.

```json
{
  "version": 1,
  "decks": [
    {
      "name": "Calculus — Chapter 2",
      "cards": [
        { "front": "Derivative of $\\ln x$?", "back": "$\\dfrac{1}{x}$ for $x>0$", "tags": ["derivatives"] },
        { "front": "A primitive of $\\cos$ is {{c::$\\sin$}}.", "back": "", "tags": [] }
      ]
    }
  ],
  "history": [
    { "deck": "Calculus — Chapter 2", "startedAt": "2026-10-01T18:00:00.000Z", "endedAt": "2026-10-01T18:05:12.000Z", "correct": 12, "wrong": 3 }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `version` | number | Must be `1`. |
| `decks` | array | At least one deck. |
| `decks[].name` | string | Non-empty. Used to detect conflicts with existing decks (case-insensitive). |
| `decks[].cards[].front` | string | Non-empty. Markdown + KaTeX. May contain cloze markers. |
| `decks[].cards[].back` | string | Required for question/answer cards. Optional for cloze cards (extra explanation). |
| `decks[].cards[].tags` | string[] | Optional, defaults to `[]`. |
| `history` | array | Optional. Exported by "Full backup". Entries reference decks by name. |

- **No ids** in the file: the app creates them on import (no collisions, simpler for AIs).
- **Name conflicts**: for each imported deck whose name exists, the app asks: merge, create a new
  deck, or skip.
- **Math**: `$...$` inline, `$$...$$` block (KaTeX). In JSON every backslash must be doubled:
  `"\\frac{1}{2}"`.
- **Cloze**: `{{c::hidden text}}` in `front`. Braces inside are fine: `{{c::$\\frac{1}{x^{2}}$}}`.

## Validation and repair

- Invalid cards are reported as `Deck "<name>", card <n>: <problem>`. The user can import the
  valid cards anyway.
- AI answers wrapped in prose or ```` ```json ```` fences are accepted: the JSON is extracted.
- Single LaTeX backslashes are repaired: invalid escapes (`\int`, `\alpha`) are doubled before
  parsing, and escapes that JSON silently accepts (`\frac` → form feed, `\theta` → tab,
  `\right` → carriage return, `\neq` inside `$...$` → newline) are turned back into LaTeX.
