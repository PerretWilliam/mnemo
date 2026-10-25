import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MathMarkdown } from '@/components/math-markdown';
import { Button, Icon, Loading, Row, Screen, Surface, T } from '@/components/ui';
import { Icons } from '@/constants/icons';
import { deckColor, Radius, Spacing, withAlpha } from '@/constants/theme';
import {
  getCardStats,
  getDeck,
  getFolder,
  getSessionSize,
  listCards,
  listFolderCards,
  recordAnswers,
  saveSession,
  type Card,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { answerSource, isCloze, renderCloze, stripCloze } from '@/lib/cloze';
import { drawCards } from '@/lib/sampling';

const SWIPE_THRESHOLD = 110;

type Result = { card: Card; correct: boolean };

export default function SessionScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t } = useI18n();
  // Studies one deck, or a whole folder when mounted by `session/folder/[folderId]`.
  const params = useLocalSearchParams<{ deckId?: string; folderId?: string }>();
  const deckId = Number(params.deckId);
  const folderId = params.folderId === undefined ? null : Number(params.folderId);
  const [title, setTitle] = useState('');
  const [folderColor, setFolderColor] = useState<string | null>(null);
  const color = deckColor(folderColor, theme);
  const [round, setRound] = useState<Card[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [flipped, setFlipped] = useState(false);
  const startedAt = useRef(0); // set by start()
  const saved = useRef(false);

  const start = (cards: Card[]) => {
    setRound(cards);
    setResults([]);
    setFlipped(false);
    startedAt.current = Date.now();
    saved.current = false;
  };

  // A fresh random sample (size from Settings); missed and never-seen cards are favored.
  const draw = useCallback(
    () =>
      Promise.all([
        folderId === null ? listCards(db, deckId) : listFolderCards(db, folderId),
        getCardStats(db),
      ]).then(([cards, stats]) => drawCards(cards, stats, getSessionSize())),
    [db, deckId, folderId],
  );

  useEffect(() => {
    if (folderId === null) {
      getDeck(db, deckId).then((d) => {
        setTitle(d?.name ?? '');
        setFolderColor(d?.folderColor ?? null);
      });
    } else {
      getFolder(db, folderId).then((f) => {
        setTitle(f?.name ?? '');
        setFolderColor(f?.color ?? null);
      });
    }
    draw().then(start);
  }, [db, deckId, folderId, draw]);

  const finished = round !== null && results.length === round.length;

  useEffect(() => {
    if (!finished || saved.current || results.length === 0) return;
    saved.current = true;
    // History is per deck, so a folder session is saved as one entry for each deck it touched.
    const perDeck = new Map<number, { correct: number; wrong: number }>();
    for (const r of results) {
      const s = perDeck.get(r.card.deckId) ?? { correct: 0, wrong: 0 };
      if (r.correct) s.correct++;
      else s.wrong++;
      perDeck.set(r.card.deckId, s);
    }
    const endedAt = Date.now();
    for (const [id, s] of perDeck) saveSession(db, { deckId: id, startedAt: startedAt.current, endedAt, ...s });
    recordAnswers(db, results.map((r) => ({ cardId: r.card.id, correct: r.correct })));
  }, [finished, results, db]);

  if (!round) return <Loading />;

  const record = (correct: boolean) => {
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    setResults((r) => [...r, { card: round[r.length], correct }]);
    setFlipped(false);
  };

  const undo = () => {
    Haptics.selectionAsync();
    setResults((r) => r.slice(0, -1));
    setFlipped(false);
  };

  if (finished) {
    // "Review missed" replays only those cards; "new session" draws again.
    const replay = (cards?: Card[]) => (cards ? start(drawCards(cards, new Map(), 0)) : draw().then(start));
    return <Recap title={title} results={results} onRestart={replay} />;
  }

  const card = round[results.length];
  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="label" color={color}>
          {results.length + 1} / {round.length}
        </T>
        <T variant="caption">{t('session.swipeHint')}</T>
      </View>
      <View style={[styles.progress, { backgroundColor: theme.muted }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${(results.length / round.length) * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <SwipeCard
        key={`${card.id}-${results.length}`}
        card={card}
        color={color}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onSwipe={record}
      />
      <Controls onCorrect={() => record(true)} onWrong={() => record(false)} onUndo={undo} canUndo={results.length > 0} />
    </Screen>
  );
}

function SwipeCard({
  card,
  color,
  flipped,
  onFlip,
  onSwipe,
}: {
  card: Card;
  color: string;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (correct: boolean) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(flipped ? 180 : 0, { duration: 250 });
  }, [flipped, flip]);

  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-12, 12],
    failOffsetY: [-20, 20],
    onUpdate: (e) => {
      x.value = e.translationX;
    },
    onDeactivate: (e) => {
      const dx = e.translationX;
      if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(e.velocityX) > 900) {
        // Swipe left = correct, swipe right = missed.
        x.value = withTiming(Math.sign(dx) * width * 1.3, { duration: 180 });
        setTimeout(() => onSwipe(dx < 0), 180);
      } else {
        x.value = withSpring(0);
      }
    },
  });
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: () => {
      Haptics.selectionAsync();
      onFlip();
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: `${x.value / 25}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 1 : 0,
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 90 ? 1 : 0,
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value - 180}deg` }],
  }));
  const okStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp') }));
  const koStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp') }));

  const front = isCloze(card.front) ? renderCloze(card.front, false) : card.front;
  const faceStyle = [styles.face, { backgroundColor: theme.surface, borderColor: withAlpha(color, 0.5), borderTopColor: color }];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, cardStyle]}>
        {/* ponytail: faces don't scroll; very long cards get clipped. Add a gesture-aware ScrollView if needed. */}
        <Animated.View style={[faceStyle, frontStyle]}>
          <MathMarkdown source={front} center fontSize={20} />
          <T variant="caption" style={styles.hint}>
            {t('session.tapToFlip')}
          </T>
        </Animated.View>
        <Animated.View style={[faceStyle, { backgroundColor: withAlpha(color, 0.08) }, backStyle]}>
          <MathMarkdown source={answerSource(card.front, card.back)} center fontSize={18} />
        </Animated.View>
        {/* Each stamp sits on the trailing edge of the swipe so it stays on screen, away from the thumb. */}
        <Animated.View style={[styles.stamp, { right: Spacing.lg, borderColor: theme.success }, okStyle]}>
          <Icon name={Icons.correct} color={theme.success} />
          <T variant="heading" color={theme.success}>
            {t('session.gotIt')}
          </T>
        </Animated.View>
        <Animated.View style={[styles.stamp, { left: Spacing.lg, borderColor: theme.danger }, koStyle]}>
          <Icon name={Icons.wrong} color={theme.danger} />
          <T variant="heading" color={theme.danger}>
            {t('session.missed')}
          </T>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function Controls({
  onCorrect,
  onWrong,
  onUndo,
  canUndo,
}: {
  onCorrect: () => void;
  onWrong: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Buttons follow the swipe directions: correct on the left, missed on the right.
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingBottom: insets.bottom }}>
      <Button
        icon={Icons.check}
        title={t('session.gotIt')}
        onPress={onCorrect}
        style={{ flex: 1, paddingHorizontal: Spacing.sm, backgroundColor: theme.success }}
      />
      <Button icon={Icons.undo} variant="secondary" onPress={onUndo} disabled={!canUndo} style={{ width: 56 }} />
      <Button
        icon={Icons.wrong}
        title={t('session.missed')}
        onPress={onWrong}
        style={{ flex: 1, paddingHorizontal: Spacing.sm, backgroundColor: theme.danger }}
      />
    </View>
  );
}

function Recap({
  title,
  results,
  onRestart,
}: {
  title: string;
  results: Result[];
  onRestart: (cards?: Card[]) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const missed = results.filter((r) => !r.correct).map((r) => r.card);
  const correct = results.length - missed.length;
  const pct = Math.round((correct / results.length) * 100);

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Surface tint={pct >= 80 ? theme.success : pct >= 50 ? theme.warning : theme.danger} style={{ alignItems: 'center' }}>
        <T variant="caption">{t('session.complete')}</T>
        <T variant="title" color={pct >= 80 ? theme.success : pct >= 50 ? theme.warning : theme.danger}>
          {pct}%
        </T>
        <T>{t('session.score', { correct, missed: missed.length })}</T>
      </Surface>
      {missed.length > 0 ? <Button icon={Icons.replay} title={t('session.reviewMissed', { count: missed.length })} onPress={() => onRestart(missed)} /> : null}
      <Button icon={Icons.study} title={t('session.restart')} variant="secondary" onPress={() => onRestart()} />
      <Button icon={Icons.done} title={t('common.done')} variant="secondary" onPress={() => router.back()} />
      {missed.length > 0 ? <T variant="label">{t('session.missedCards')}</T> : null}
      {missed.map((c) => (
        <Row key={c.id} title={stripCloze(c.front)} subtitle={stripCloze(c.back)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderTopWidth: 6,
    padding: Spacing.xl,
    justifyContent: 'center',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  hint: { position: 'absolute', bottom: Spacing.lg, alignSelf: 'center' },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stamp: {
    position: 'absolute',
    top: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 2,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
});
