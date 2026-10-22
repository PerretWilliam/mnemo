// Dashboard statistics computed from session rows (local time days).

type SessionLike = { endedAt: number; correct: number; wrong: number };

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Cards reviewed per day for the last `days` days, oldest first. `count` = correct + wrong. */
export function dailyReviews(sessions: SessionLike[], days: number, now = Date.now()) {
  const totals = new Map<string, { correct: number; wrong: number }>();
  for (const s of sessions) {
    const t = totals.get(dayKey(s.endedAt)) ?? { correct: 0, wrong: 0 };
    totals.set(dayKey(s.endedAt), { correct: t.correct + s.correct, wrong: t.wrong + s.wrong });
  }
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    // Step back by calendar days (not 24h) so DST changes don't skip or repeat a day.
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const { correct, wrong } = totals.get(dayKey(d.getTime())) ?? { correct: 0, wrong: 0 };
    return { date: d.getTime(), correct, wrong, count: correct + wrong };
  });
}

/** Consecutive days with at least one session, ending today (or yesterday if nothing yet today). */
export function streak(sessions: SessionLike[], now = Date.now()) {
  const active = new Set(sessions.map((s) => dayKey(s.endedAt)));
  const d = new Date(startOfDay(now));
  if (!active.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active.has(dayKey(d.getTime()))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function successRate(sessions: SessionLike[]) {
  const correct = sessions.reduce((n, s) => n + s.correct, 0);
  const total = sessions.reduce((n, s) => n + s.correct + s.wrong, 0);
  return total === 0 ? null : Math.round((correct / total) * 100);
}
