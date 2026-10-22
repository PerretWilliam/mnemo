import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button, confirm, Empty, Input, Loading, Row, Screen, T, useFocusData } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteCard, deleteDeck, getDeck, listCards, renameDeck } from '@/db';
import { stripCloze } from '@/lib/cloze';

/** One-line plain-text preview: list items never render Markdown/KaTeX (no WebView per row). */
const preview = (s: string) => stripCloze(s).replace(/\s+/g, ' ').trim();

export default function DeckScreen() {
  const db = useSQLiteContext();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [data, reload] = useFocusData(
    useCallback(async () => ({ deck: await getDeck(db, id), cards: await listCards(db, id) }), [db, id]),
  );
  const [query, setQuery] = useState('');
  const [name, setName] = useState<string | null>(null);

  if (!data) return <Loading />;
  if (!data.deck) return <Empty text="This deck no longer exists." />;
  const { deck, cards } = data;

  const q = query.trim().toLowerCase();
  const shown = q
    ? cards.filter((c) => [c.front, c.back, ...c.tags].some((s) => s.toLowerCase().includes(q)))
    : cards;

  const saveName = async () => {
    if (name !== null && name.trim() && name.trim() !== deck.name) {
      await renameDeck(db, id, name);
      reload();
    }
    setName(null);
  };

  const removeDeck = async () => {
    if (await confirm('Delete deck?', `"${deck.name}", its ${cards.length} cards and its history will be deleted.`)) {
      await deleteDeck(db, id);
      router.back();
    }
  };

  const removeCard = async (cardId: number) => {
    if (await confirm('Delete card?', 'This cannot be undone.')) {
      await deleteCard(db, cardId);
      reload();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: deck.name }} />
      <Input label="Deck name" value={name ?? deck.name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} />
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Button
          title={`Study (${cards.length})`}
          style={{ flex: 1 }}
          disabled={cards.length === 0}
          onPress={() => router.push({ pathname: '/session/[deckId]', params: { deckId: id } })}
        />
        <Button
          title="Add card"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/card/[id]', params: { id: 'new', deckId: id } })}
        />
      </View>
      {cards.length > 0 ? (
        <Input placeholder="Search cards and tags" value={query} onChangeText={setQuery} autoCorrect={false} />
      ) : null}
      {cards.length === 0 ? <Empty text="No cards yet." /> : null}
      {cards.length > 0 && shown.length === 0 ? <Empty text="No match." /> : null}
      {shown.map((c) => (
        <Row
          key={c.id}
          title={preview(c.front)}
          subtitle={[preview(c.back), c.tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join('  ·  ')}
          onPress={() => router.push({ pathname: '/card/[id]', params: { id: c.id, deckId: id } })}
          onLongPress={() => removeCard(c.id)}
        />
      ))}
      {cards.length > 0 ? <T variant="caption">Tap a card to edit it, long-press to delete it.</T> : null}
      <Button title="Delete deck" variant="danger" onPress={removeDeck} style={{ marginTop: Spacing.xl }} />
    </Screen>
  );
}
