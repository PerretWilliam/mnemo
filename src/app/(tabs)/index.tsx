import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Button, Loading, Row, Screen, Surface, T, useFocusData } from '@/components/ui';
import { deckColor, Radius, Spacing, withAlpha } from '@/constants/theme';
import { listDecks, listSessions } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { dailyReviews, streak, successRate } from '@/lib/stats';

const DAYS = 7;
const BAR_HEIGHT = 96;

export default function Dashboard() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, tp, lang } = useI18n();
  const [data] = useFocusData(
    useCallback(async () => ({ decks: await listDecks(db), sessions: await listSessions(db, -1) }), [db]),
  );
  if (!data) return <Loading />;

  const { decks, sessions } = data;
  const days = dailyReviews(sessions, DAYS);
  const max = Math.max(1, ...days.map((d) => d.count));
  const rate = successRate(sessions);
  const cards = decks.reduce((n, d) => n + d.cardCount, 0);
  const lastByDeck = new Map<number, number>();
  for (const s of sessions) if (!lastByDeck.has(s.deckId)) lastByDeck.set(s.deckId, s.endedAt);
  // Least recently studied decks first: that's what to review next.
  const nextUp = decks
    .filter((d) => d.cardCount > 0)
    .sort((a, b) => (lastByDeck.get(a.id) ?? 0) - (lastByDeck.get(b.id) ?? 0))
    .slice(0, 3);

  return (
    <Screen title="Mnemo">
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Stat label={t('dash.decks')} value={String(decks.length)} color="#6366F1" />
        <Stat label={t('dash.cards')} value={String(cards)} color="#EC4899" />
        <Stat label={t('dash.streak')} value={t('dash.streakValue', { count: streak(sessions) })} color="#F59E0B" />
        <Stat label={t('dash.success')} value={rate === null ? '–' : `${rate}%`} color="#10B981" />
      </View>

      <Surface>
        <T variant="heading">{t('dash.lastDays', { count: DAYS })}</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: BAR_HEIGHT + 40 }}>
          {days.map((d, i) => {
            const today = i === days.length - 1;
            return (
              <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: Spacing.xs }}>
                <T variant="caption">{d.count || ''}</T>
                <View
                  style={{
                    width: '100%',
                    height: Math.max(4, (d.count / max) * BAR_HEIGHT),
                    borderRadius: Radius.sm / 2,
                    backgroundColor: !d.count ? theme.muted : today ? theme.primary : withAlpha(theme.accent, 0.55),
                  }}
                />
                <T variant="caption" color={today ? theme.primary : undefined}>
                  {new Date(d.date).toLocaleDateString(lang, { weekday: 'narrow' })}
                </T>
              </View>
            );
          })}
        </View>
      </Surface>

      {decks.length === 0 ? (
        <Surface tint={theme.primary}>
          <T variant="heading" color={theme.primary}>
            {t('dash.getStarted')}
          </T>
          <T variant="caption">{t('dash.getStartedText')}</T>
          <Button title={t('dash.createDeck')} onPress={() => router.push('/decks')} />
          <Button title={t('ai.title')} variant="secondary" onPress={() => router.push('/ai-prompt')} />
        </Surface>
      ) : null}

      {nextUp.length > 0 ? <T variant="heading">{t('dash.studyNext')}</T> : null}
      {nextUp.map((d) => (
        <Row
          key={d.id}
          title={d.name}
          accent={deckColor(d.id)}
          subtitle={
            lastByDeck.has(d.id)
              ? t('dash.lastStudied', { date: new Date(lastByDeck.get(d.id)!).toLocaleDateString(lang) })
              : t('dash.neverStudied')
          }
          right={tp('count.cards', d.cardCount)}
          onPress={() => router.push({ pathname: '/session/[deckId]', params: { deckId: d.id } })}
        />
      ))}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Surface tint={color} style={{ flex: 1, padding: Spacing.md, gap: 2, alignItems: 'center' }}>
      <T variant="heading" color={color}>
        {value}
      </T>
      <T variant="caption" numberOfLines={1}>
        {label}
      </T>
    </Surface>
  );
}
