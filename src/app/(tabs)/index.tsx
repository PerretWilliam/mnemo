import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Button, Loading, Row, Screen, Surface, T, useFocusData } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { listDecks, listSessions } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { dailyReviews, streak, successRate } from '@/lib/stats';

const DAYS = 7;
const BAR_HEIGHT = 96;

export default function Dashboard() {
  const db = useSQLiteContext();
  const theme = useTheme();
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
    <Screen title="Flashcards">
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Stat label="Decks" value={String(decks.length)} />
        <Stat label="Cards" value={String(cards)} />
        <Stat label="Streak" value={`${streak(sessions)}d`} />
        <Stat label="Success" value={rate === null ? '–' : `${rate}%`} />
      </View>

      <Surface>
        <T variant="heading">Last {DAYS} days</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: BAR_HEIGHT + 40 }}>
          {days.map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: Spacing.xs }}>
              <T variant="caption">{d.count || ''}</T>
              <View
                style={{
                  width: '100%',
                  height: Math.max(3, (d.count / max) * BAR_HEIGHT),
                  borderRadius: Radius.sm / 2,
                  backgroundColor: d.count ? theme.primary : theme.muted,
                }}
              />
              <T variant="caption">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</T>
            </View>
          ))}
        </View>
      </Surface>

      {decks.length === 0 ? (
        <Surface>
          <T variant="heading">Get started</T>
          <T variant="caption">Create a deck, import a JSON file, or let an AI generate one for you.</T>
          <Button title="Create a deck" onPress={() => router.push('/decks')} />
          <Button title="Generate with AI" variant="secondary" onPress={() => router.push('/ai-prompt')} />
        </Surface>
      ) : null}

      {nextUp.length > 0 ? <T variant="heading">Study next</T> : null}
      {nextUp.map((d) => (
        <Row
          key={d.id}
          title={d.name}
          subtitle={lastByDeck.has(d.id) ? `Last studied ${new Date(lastByDeck.get(d.id)!).toLocaleDateString()}` : 'Never studied'}
          right={`${d.cardCount} cards`}
          onPress={() => router.push({ pathname: '/session/[deckId]', params: { deckId: d.id } })}
        />
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Surface style={{ flex: 1, padding: Spacing.md, gap: 2, alignItems: 'center' }}>
      <T variant="heading">{value}</T>
      <T variant="caption">{label}</T>
    </Surface>
  );
}
