import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, Loading, Row, Screen, Surface, T, useFocusData, type IconName } from '@/components/ui';
import { Icons } from '@/constants/icons';
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
  const [selected, setSelected] = useState(DAYS - 1); // index into `days`; today by default
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
        <Stat icon={Icons.decks} label={t('dash.decks')} value={String(decks.length)} color="#6366F1" />
        <Stat icon={Icons.cards} label={t('dash.cards')} value={String(cards)} color="#EC4899" />
        <Stat
          icon={Icons.streak}
          label={t('dash.streak')}
          value={t('dash.streakValue', { count: streak(sessions) })}
          color="#F59E0B"
        />
        <Stat icon={Icons.success} label={t('dash.success')} value={rate === null ? '–' : `${rate}%`} color="#10B981" />
      </View>

      <Surface>
        <T variant="heading">{t('dash.lastDays', { count: DAYS })}</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: BAR_HEIGHT + 40 }}>
          {days.map((d, i) => {
            const active = i === selected;
            return (
              <Pressable
                key={d.date}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(i);
                }}
                style={{ flex: 1, alignItems: 'center', gap: Spacing.xs }}>
                <T variant="caption" color={active ? theme.primary : undefined}>
                  {d.count || ''}
                </T>
                <View
                  style={{
                    width: '100%',
                    height: Math.max(4, (d.count / max) * BAR_HEIGHT),
                    borderRadius: Radius.sm / 2,
                    backgroundColor: !d.count ? theme.muted : active ? theme.primary : withAlpha(theme.accent, 0.45),
                  }}
                />
                <T variant="caption" color={active ? theme.primary : undefined}>
                  {new Date(d.date).toLocaleDateString(lang, { weekday: 'narrow' })}
                </T>
              </Pressable>
            );
          })}
        </View>
        <DayDetail day={days[selected]} />
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
          accent={deckColor(d.folderColor, theme)}
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

/** Detail of the selected bar: correct, missed and success rate for that day. */
function DayDetail({ day }: { day: { date: number; correct: number; wrong: number; count: number } }) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const date = new Date(day.date).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <View style={{ gap: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: theme.border }}>
      <T variant="label" color={theme.primary} style={{ textTransform: 'capitalize' }}>
        {date}
      </T>
      {day.count === 0 ? (
        <T variant="caption">{t('dash.dayEmpty')}</T>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' }}>
          <Figure icon={Icons.correct} color={theme.success} text={t('dash.dayCorrect', { count: day.correct })} />
          <Figure icon={Icons.wrong} color={theme.danger} text={t('dash.dayWrong', { count: day.wrong })} />
          <Figure icon={Icons.success} color={theme.primary} text={`${Math.round((day.correct / day.count) * 100)}%`} />
        </View>
      )}
      <T variant="caption">{t('dash.tapHint')}</T>
    </View>
  );
}

function Figure({ icon, color, text }: { icon: IconName; color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
      <Icon name={icon} color={color} size={18} />
      <T variant="label" color={color}>
        {text}
      </T>
    </View>
  );
}

function Stat({ icon, label, value, color }: { icon: IconName; label: string; value: string; color: string }) {
  return (
    <Surface tint={color} style={{ flex: 1, padding: Spacing.md, gap: 2, alignItems: 'center' }}>
      <Icon name={icon} color={color} size={20} />
      <T variant="heading" color={color}>
        {value}
      </T>
      <T variant="caption" numberOfLines={1}>
        {label}
      </T>
    </Surface>
  );
}
