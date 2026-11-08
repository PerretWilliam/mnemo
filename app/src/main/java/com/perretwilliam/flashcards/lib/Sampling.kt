package com.perretwilliam.flashcards.lib

import kotlin.math.pow
import kotlin.random.Random

// Picks the cards of a study session: random, but missed and never-seen cards come up more often.

/** `streak` = consecutive correct answers (0 right after a miss). A card without stats was never seen. */
data class CardStat(val seen: Int, val streak: Int)

/** Relative chance of being drawn. Mastered cards fade out (1, 1/2, 1/3...) but never reach zero. */
fun cardWeight(stat: CardStat? = null): Double = when {
    stat == null || stat.seen == 0 -> 3.0 // never studied
    stat.streak == 0 -> 4.0 // missed last time
    else -> 1.0 / stat.streak
}

/** How many cards a session will hold: the chosen size, capped by what exists (0 = all). */
fun sessionLength(total: Int, size: Int) = if (size > 0) minOf(size, total) else total

/**
 * Weighted sampling without replacement (Efraimidis-Spirakis): each card gets the key `u^(1/w)` with
 * `u` uniform in (0, 1), and the `size` largest keys win. The result is already in random order.
 * `size` of 0 (or more than available) returns every card.
 */
fun <C> drawCards(
    cards: List<C>,
    id: (C) -> Long,
    stats: Map<Long, CardStat>,
    size: Int,
    rng: () -> Double = { Random.nextDouble(1e-12, 1.0) }, // never exactly 0: 0^(1/w) would tie every card
): List<C> {
    val sorted = cards.map { it to rng().pow(1 / cardWeight(stats[id(it)])) }.sortedByDescending { it.second }
    return (if (size > 0) sorted.take(size) else sorted).map { it.first }
}
