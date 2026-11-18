package com.perretwilliam.flashcards.lib

import kotlin.math.pow
import kotlin.random.Random

// Picks the cards of a study session with spaced repetition in mind: a card is "due" once its review
// interval (which grows with each correct answer, so recall is tested just as it starts to fade) has elapsed.
// Due and missed cards are favored; cards reviewed recently are rarely redrawn, but never excluded.

/** `streak` = consecutive correct answers (0 right after a miss), `lastAt` = epoch ms of the last answer. */
data class CardStat(val seen: Int, val streak: Int, val lastAt: Long = 0)

private const val DAY_MS = 86_400_000L

/** Review interval in days after `streak` consecutive correct answers: expanding, as in Leitner boxes. */
private val INTERVAL_DAYS = doubleArrayOf(0.0, 1.0, 3.0, 7.0, 16.0, 35.0, 75.0)

/** Relative chance of being drawn: missed 4, never seen 3, due 2..5 (more overdue = higher), not yet due 0.1..1. */
fun cardWeight(stat: CardStat? = null, now: Long = System.currentTimeMillis()): Double {
    if (stat == null || stat.seen == 0) return 3.0
    if (stat.streak == 0) return 4.0
    val interval = INTERVAL_DAYS[minOf(stat.streak, INTERVAL_DAYS.lastIndex)] * DAY_MS
    val ratio = (now - stat.lastAt) / interval // < 1: still remembered, >= 1: due
    return if (ratio >= 1) 1 + minOf(ratio, 4.0) else 0.1 + 0.9 * maxOf(ratio, 0.0)
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
    now: Long = System.currentTimeMillis(),
): List<C> {
    val sorted = cards.map { it to rng().pow(1 / cardWeight(stats[id(it)], now)) }.sortedByDescending { it.second }
    return (if (size > 0) sorted.take(size) else sorted).map { it.first }
}
