// Run with `npm test` (Node's built-in test runner, native TS type stripping).
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isCloze, renderCloze, splitCloze, stripCloze } from './cloze.ts';
import { parseExchange, restoreLatex } from './format.ts';
import { buildPrompt } from './prompt.ts';
import { dailyReviews, streak, successRate } from './stats.ts';
import { interpolate, pluralCategory } from './translate.ts';

test('translate: interpolation and plural categories', () => {
  assert.equal(interpolate('{count} cards in {deck}', { count: 3, deck: 'D' }), '3 cards in D');
  assert.equal(interpolate('keep {unknown}'), 'keep {unknown}');
  assert.equal(pluralCategory('en', 0), 'other');
  assert.equal(pluralCategory('en', 1), 'one');
  assert.equal(pluralCategory('fr', 0), 'one');
  assert.equal(pluralCategory('fr', 2), 'other');
});

test('stats: daily buckets, streak and success rate', () => {
  const now = new Date(2026, 4, 10, 15).getTime();
  const at = (daysAgo: number) => new Date(2026, 4, 10 - daysAgo, 9).getTime();
  const sessions = [
    { endedAt: at(0), correct: 3, wrong: 1 },
    { endedAt: at(0), correct: 1, wrong: 0 },
    { endedAt: at(1), correct: 2, wrong: 2 },
    { endedAt: at(3), correct: 1, wrong: 1 },
  ];
  assert.deepEqual(dailyReviews(sessions, 4, now).map((d) => d.count), [2, 0, 4, 5]);
  assert.deepEqual(
    dailyReviews(sessions, 1, now).map(({ correct, wrong }) => ({ correct, wrong })),
    [{ correct: 4, wrong: 1 }],
  );
  assert.equal(streak(sessions, now), 2);
  assert.equal(streak(sessions.slice(2), now), 1); // nothing today: counts from yesterday
  assert.equal(successRate(sessions), 64);
  assert.equal(successRate([]), null);
});

test('cloze: splits plain text and blanks', () => {
  assert.deepEqual(splitCloze('A primitive of cos is {{c::sin}}.'), [
    { text: 'A primitive of cos is ', cloze: false },
    { text: 'sin', cloze: true },
    { text: '.', cloze: false },
  ]);
});

test('cloze: keeps nested LaTeX braces inside the blank', () => {
  const s = 'Derivative: {{c::$\\frac{1}{x^{2}}$}} here';
  assert.equal(splitCloze(s)[1].text, '$\\frac{1}{x^{2}}$');
  assert.equal(stripCloze(s), 'Derivative: $\\frac{1}{x^{2}}$ here');
});

test('cloze: hides and reveals', () => {
  const s = '{{c::a}} and {{c::b}}';
  assert.equal(renderCloze(s, false), '<span class="cloze">[…]</span> and <span class="cloze">[…]</span>');
  assert.equal(renderCloze(s, true), '<mark class="cloze">a</mark> and <mark class="cloze">b</mark>');
});

test('cloze: plain and unterminated text is not a cloze', () => {
  assert.equal(isCloze('no blanks'), false);
  assert.equal(isCloze('broken {{c::oops'), false);
  assert.equal(stripCloze('broken {{c::oops'), 'broken {{c::oops');
});

test('format: accepts a valid file wrapped in an AI answer', () => {
  const raw = 'Sure!\n```json\n{"version":1,"decks":[{"name":"D","cards":[{"front":"Q","back":"A"}]}]}\n```';
  const r = parseExchange(raw);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.data?.decks[0].cards[0], { front: 'Q', back: 'A', tags: [] });
});

test('format: repairs single LaTeX backslashes (invalid and silently valid escapes)', () => {
  // Written as an AI would: \int is an invalid escape, \frac and \theta are valid ones (\f, \t).
  const raw = String.raw`{"version":1,"decks":[{"name":"D","cards":[{"front":"$\int x$ and $\frac{1}{2}$, $\theta$, $\neq$","back":"ok"}]}]}`;
  const r = parseExchange(raw);
  assert.equal(r.data?.decks[0].cards[0].front, String.raw`$\int x$ and $\frac{1}{2}$, $\theta$, $\neq$`);
  assert.ok(r.warnings.length > 0);
});

test('format: keeps real newlines outside inline math', () => {
  assert.equal(restoreLatex('line\nNext $a\nb$'), 'line\nNext $a\\nb$');
});

test('format: reports invalid cards with their number and keeps the valid ones', () => {
  const raw = JSON.stringify({
    version: 1,
    decks: [{ name: 'D', cards: [{ front: 'ok', back: 'ok' }, { front: '' }, { front: 'q', back: '' }, { front: '{{c::x}}' }] }],
  });
  const r = parseExchange(raw);
  assert.equal(r.data?.decks[0].cards.length, 2);
  assert.deepEqual(r.errors[0], { code: 'front', params: { deck: 'D', card: 2 } });
  assert.deepEqual(r.errors[1], { code: 'backRequired', params: { deck: 'D', card: 3 } });
});

test('format: rejects wrong version and garbage', () => {
  assert.equal(parseExchange('{"version":2,"decks":[]}').data, null);
  assert.equal(parseExchange('not json').data, null);
});

test('prompt: includes options and optional notes', () => {
  const p = buildPrompt({ topic: 'Derivatives', deckName: 'Calc', count: 10, types: 'qa', language: 'French', notes: 'my notes' });
  assert.match(p, /10 cards about: Derivatives/);
  assert.match(p, /"name":"Calc"/);
  assert.match(p, /my notes/);
  assert.doesNotMatch(p, /\{\{c::/);
});
