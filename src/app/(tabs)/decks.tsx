import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button, Empty, Input, Row, Screen, useFocusData } from '@/components/ui';
import { deckColor, Spacing } from '@/constants/theme';
import { createDeck, listDecks } from '@/db';
import { useI18n } from '@/i18n';

export default function DecksScreen() {
  const db = useSQLiteContext();
  const { t, tp } = useI18n();
  const [decks, reload] = useFocusData(useCallback(() => listDecks(db), [db]));
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    const id = await createDeck(db, name);
    setName('');
    reload();
    router.push({ pathname: '/deck/[id]', params: { id } });
  };

  return (
    <Screen title={t('decks.title')}>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder={t('decks.newPlaceholder')}
            value={name}
            onChangeText={setName}
            onSubmitEditing={add}
            returnKeyType="done"
          />
        </View>
        <Button title={t('decks.add')} onPress={add} disabled={!name.trim()} />
      </View>
      <Button title={`✨ ${t('decks.generateAi')}`} variant="secondary" onPress={() => router.push('/ai-prompt')} />
      {decks?.length === 0 ? <Empty text={t('decks.empty')} /> : null}
      {decks?.map((d) => (
        <Row
          key={d.id}
          title={d.name}
          accent={deckColor(d.id)}
          right={tp('count.cards', d.cardCount)}
          onPress={() => router.push({ pathname: '/deck/[id]', params: { id: d.id } })}
        />
      ))}
    </Screen>
  );
}
