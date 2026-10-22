import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button, Empty, Input, Row, Screen, useFocusData } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { createDeck, listDecks } from '@/db';

export default function DecksScreen() {
  const db = useSQLiteContext();
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
    <Screen title="Decks">
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Input placeholder="New deck name" value={name} onChangeText={setName} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <Button title="Add" onPress={add} disabled={!name.trim()} />
      </View>
      <Button title="Generate a deck with AI" variant="secondary" onPress={() => router.push('/ai-prompt')} />
      {decks?.length === 0 ? <Empty text="No decks yet. Create one or import a JSON file from Settings." /> : null}
      {decks?.map((d) => (
        <Row
          key={d.id}
          title={d.name}
          right={`${d.cardCount} card${d.cardCount === 1 ? '' : 's'}`}
          onPress={() => router.push({ pathname: '/deck/[id]', params: { id: d.id } })}
        />
      ))}
    </Screen>
  );
}
