package com.perretwilliam.flashcards.lib

import java.time.LocalDate
import java.time.ZoneId

// Dashboard statistics computed from session rows (local time days).

interface SessionLike {
    val endedAt: Long
    val correct: Int
    val wrong: Int
}

data class DayReviews(val date: Long, val correct: Int, val wrong: Int) {
    val count get() = correct + wrong
}

private fun day(t: Long, zone: ZoneId) = java.time.Instant.ofEpochMilli(t).atZone(zone).toLocalDate()

/** Cards reviewed per day for the last `days` days, oldest first (`date` = start of that local day). */
fun dailyReviews(
    sessions: List<SessionLike>,
    days: Int,
    now: Long = System.currentTimeMillis(),
    zone: ZoneId = ZoneId.systemDefault(),
): List<DayReviews> {
    val totals = HashMap<LocalDate, Pair<Int, Int>>()
    for (s in sessions) {
        val (c, w) = totals[day(s.endedAt, zone)] ?: (0 to 0)
        totals[day(s.endedAt, zone)] = (c + s.correct) to (w + s.wrong)
    }
    val today = day(now, zone)
    return List(days) { i ->
        val d = today.minusDays((days - 1 - i).toLong()) // calendar days, so DST changes don't skip a day
        val (c, w) = totals[d] ?: (0 to 0)
        DayReviews(d.atStartOfDay(zone).toInstant().toEpochMilli(), c, w)
    }
}

/** Consecutive days with at least one session, ending today (or yesterday if nothing yet today). */
fun streak(sessions: List<SessionLike>, now: Long = System.currentTimeMillis(), zone: ZoneId = ZoneId.systemDefault()): Int {
    val active = sessions.map { day(it.endedAt, zone) }.toSet()
    var d = day(now, zone)
    if (d !in active) d = d.minusDays(1)
    var n = 0
    while (d in active) {
        n++
        d = d.minusDays(1)
    }
    return n
}

/** Percentage of correct answers, or null when nothing was answered yet. */
fun successRate(sessions: List<SessionLike>): Int? {
    val correct = sessions.sumOf { it.correct }
    val total = sessions.sumOf { it.correct + it.wrong }
    return if (total == 0) null else Math.round(correct * 100.0 / total).toInt()
}
