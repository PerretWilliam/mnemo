import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button, confirm, Empty, Input, Loading, Row, Screen, Select, T, useFocusData } from '@/components/ui';
import { Icons } from '@/constants/icons';
import { deckColor, Spacing } from '@/constants/theme';
import { deleteCard, deleteDeck, getDeck, getSessionSize, listCards, listFolders, renameDeck, setDeckFolder } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { stripCloze } from '@/lib/cloze';
import { sessionLength } from '@/lib/sampling';

/** One-line plain-text preview: list items never render Markdown/KaTeX (no WebView per row). */
const preview = (s: string) => stripCloze(s).replace(/\s+/g, ' ').trim();

export default function DeckScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t } = useI18n();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [data, reload] = useFocusData(
    useCallback(
      async () => ({ deck: await getDeck(db, id), cards: await listCards(db, id), folders: await listFolders(db) }),
      [db, id],
    ),
  );
  const [query, setQuery] = useState('');
  const [name, setName] = useState<string | null>(null);

  if (!data) return <Loading />;
  if (!data.deck) return <Empty text={t('deck.missing')} />;
  const { deck, cards, folders } = data;

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

  const changeFolder = async (value: string) => {
    await setDeckFolder(db, id, value === '' ? null : Number(value));
    reload();
  };

  const removeDeck = async () => {
    const labels = { cancel: t('common.cancel'), action: t('common.delete') };
    if (await confirm(t('deck.deleteTitle'), t('deck.deleteMessage', { name: deck.name }), labels)) {
      await deleteDeck(db, id);
      router.back();
    }
  };

  const removeCard = async (cardId: number) => {
    const labels = { cancel: t('common.cancel'), action: t('common.delete') };
    if (await confirm(t('card.deleteTitle'), t('common.cannotUndo'), labels)) {
      await deleteCard(db, cardId);
      reload();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: deck.name, headerTintColor: deckColor(deck.folderColor, theme) }} />
      <Input label={t('deck.name')} value={name ?? deck.name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} />
      {folders.length > 0 ? (
        <Select
          label={t('deck.folder')}
          value={deck.folderId === null ? '' : String(deck.folderId)}
          options={[
            { value: '', label: t('deck.noFolder') },
            ...folders.map((f) => ({ value: String(f.id), label: f.name })),
          ]}
          onChange={changeFolder}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Button
          icon={Icons.study}
          title={t('deck.study', { count: sessionLength(cards.length, getSessionSize()) })}
          style={{ flex: 1 }}
          disabled={cards.length === 0}
          onPress={() => router.push({ pathname: '/session/[deckId]', params: { deckId: id } })}
        />
        <Button
          icon={Icons.add}
          title={t('deck.addCard')}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/card/[id]', params: { id: 'new', deckId: id } })}
        />
      </View>
      {cards.length > 0 ? (
        <Input placeholder={t('deck.search')} value={query} onChangeText={setQuery} autoCorrect={false} />
      ) : null}
      {cards.length === 0 ? <Empty text={t('deck.noCards')} /> : null}
      {cards.length > 0 && shown.length === 0 ? <Empty text={t('deck.noMatch')} /> : null}
      {shown.map((c) => (
        <Row
          key={c.id}
          title={preview(c.front)}
          subtitle={[preview(c.back), c.tags.map((tag) => `#${tag}`).join(' ')].filter(Boolean).join('  ·  ')}
          onPress={() => router.push({ pathname: '/card/[id]', params: { id: c.id, deckId: id } })}
          onLongPress={() => removeCard(c.id)}
        />
      ))}
      {cards.length > 0 ? <T variant="caption">{t('deck.hint')}</T> : null}
      <Button icon={Icons.delete} title={t('deck.delete')} variant="danger" onPress={removeDeck} style={{ marginTop: Spacing.xl }} />
    </Screen>
  );
}
