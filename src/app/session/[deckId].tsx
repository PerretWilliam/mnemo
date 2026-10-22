import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MathMarkdown } from '@/components/math-markdown';
import { Button, Loading, Row, Screen, Surface, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { getDeck, listCards, saveSession, type Card } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { answerSource, isCloze, renderCloze, stripCloze } from '@/lib/cloze';

const SWIPE_THRESHOLD = 110;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Result = { card: Card; correct: boolean };

export default function SessionScreen() {
  const db = useSQLiteContext();
  const deckId = Number(useLocalSearchParams<{ deckId: string }>().deckId);
  const [deckName, setDeckName] = useState('');
  const [round, setRound] = useState<Card[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [flipped, setFlipped] = useState(false);
  const startedAt = useRef(0); // set by start()
  const saved = useRef(false);

  const start = (cards: Card[]) => {
    setRound(shuffle(cards));
    setResults([]);
    setFlipped(false);
    startedAt.current = Date.now();
    saved.current = false;
  };

  useEffect(() => {
    getDeck(db, deckId).then((d) => setDeckName(d?.name ?? ''));
    listCards(db, deckId).then(start);
  }, [db, deckId]);

  const finished = round !== null && results.length === round.length;

  useEffect(() => {
    if (!finished || saved.current || results.length === 0) return;
    saved.current = true;
    const correct = results.filter((r) => r.correct).length;
    saveSession(db, { deckId, startedAt: startedAt.current, endedAt: Date.now(), correct, wrong: results.length - correct });
  }, [finished, results, db, deckId]);

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
    return <Recap deckName={deckName} results={results} onRestart={start} />;
  }

  const card = round[results.length];
  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: deckName }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="label">
          {results.length + 1} / {round.length}
        </T>
        <T variant="caption">Swipe left: got it · right: missed</T>
      </View>
      <SwipeCard
        key={`${card.id}-${results.length}`}
        card={card}
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
  flipped,
  onFlip,
  onSwipe,
}: {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (correct: boolean) => void;
}) {
  const theme = useTheme();
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
  const faceStyle = [styles.face, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, cardStyle]}>
        {/* ponytail: faces don't scroll; very long cards get clipped. Add a gesture-aware ScrollView if needed. */}
        <Animated.View style={[faceStyle, frontStyle]}>
          <MathMarkdown source={front} center fontSize={20} />
          <T variant="caption" style={styles.hint}>
            Tap to flip
          </T>
        </Animated.View>
        <Animated.View style={[faceStyle, backStyle]}>
          <MathMarkdown source={answerSource(card.front, card.back)} center fontSize={18} />
        </Animated.View>
        <Animated.View style={[styles.stamp, { left: Spacing.lg, borderColor: theme.success }, okStyle]}>
          <T variant="heading" color={theme.success}>
            ✓ Got it
          </T>
        </Animated.View>
        <Animated.View style={[styles.stamp, { right: Spacing.lg, borderColor: theme.danger }, koStyle]}>
          <T variant="heading" color={theme.danger}>
            ✗ Missed
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
  const insets = useSafeAreaInsets();
  // Buttons follow the swipe directions: correct on the left, missed on the right.
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingBottom: insets.bottom }}>
      <Button title="✓" onPress={onCorrect} style={{ flex: 1, backgroundColor: theme.success }} />
      <Button title="↶ Undo" variant="secondary" onPress={onUndo} disabled={!canUndo} style={{ flex: 1 }} />
      <Button title="✗" onPress={onWrong} style={{ flex: 1, backgroundColor: theme.danger }} />
    </View>
  );
}

function Recap({
  deckName,
  results,
  onRestart,
}: {
  deckName: string;
  results: Result[];
  onRestart: (cards: Card[]) => void;
}) {
  const theme = useTheme();
  const missed = results.filter((r) => !r.correct).map((r) => r.card);
  const correct = results.length - missed.length;
  const pct = Math.round((correct / results.length) * 100);

  return (
    <Screen>
      <Stack.Screen options={{ title: deckName }} />
      <Surface style={{ alignItems: 'center' }}>
        <T variant="caption">Session complete</T>
        <T variant="title" color={pct >= 80 ? theme.success : pct >= 50 ? theme.text : theme.danger}>
          {pct}%
        </T>
        <T>
          {correct} correct · {missed.length} missed
        </T>
      </Surface>
      {missed.length > 0 ? <Button title={`Review missed (${missed.length})`} onPress={() => onRestart(missed)} /> : null}
      <Button title="Restart whole deck" variant="secondary" onPress={() => onRestart(results.map((r) => r.card))} />
      <Button title="Done" variant="secondary" onPress={() => router.back()} />
      {missed.length > 0 ? <T variant="label">Missed cards</T> : null}
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
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
    justifyContent: 'center',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  hint: { position: 'absolute', bottom: Spacing.lg, alignSelf: 'center' },
  stamp: {
    position: 'absolute',
    top: Spacing.lg,
    borderWidth: 2,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
});
