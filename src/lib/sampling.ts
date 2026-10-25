// Picks the cards of a study session: random, but missed and never-seen cards come up more often.

/** `streak` = consecutive correct answers (0 right after a miss). A card without stats was never seen. */
export type CardStat = { seen: number; streak: number };

/** Relative chance of being drawn. Mastered cards fade out (1, 1/2, 1/3...) but never reach zero. */
export function cardWeight(stat?: CardStat): number {
  if (!stat || stat.seen === 0) return 3; // never studied
  if (stat.streak === 0) return 4; // missed last time
  return 1 / stat.streak;
}

/** How many cards a session will hold: the chosen size, capped by what exists (0 = all). */
export const sessionLength = (total: number, size: number) => (size > 0 ? Math.min(size, total) : total);

/**
 * Weighted sampling without replacement (Efraimidis-Spirakis): each card gets the key `u^(1/w)` with
 * `u` uniform in (0, 1), and the `size` largest keys win. The result is already in random order.
 * `size` of 0 (or more than available) returns every card.
 */
export function drawCards<C extends { id: number }>(
  cards: C[],
  stats: Map<number, CardStat>,
  size: number,
  rng: () => number = Math.random,
): C[] {
  const keyed = cards.map((card) => ({ card, key: Math.pow(rng(), 1 / cardWeight(stats.get(card.id))) }));
  keyed.sort((a, b) => b.key - a.key);
  return (size > 0 ? keyed.slice(0, size) : keyed).map((k) => k.card);
}
