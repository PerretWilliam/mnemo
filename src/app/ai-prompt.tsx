import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { Button, Input, Screen, Segmented, Surface, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { buildPrompt, type CardTypes } from '@/lib/prompt';
import { importFromClipboard } from '@/transfer';

export default function AiPromptScreen() {
  const db = useSQLiteContext();
  const [topic, setTopic] = useState('');
  const [deckName, setDeckName] = useState('');
  const [count, setCount] = useState('20');
  const [types, setTypes] = useState<CardTypes>('both');
  const [language, setLanguage] = useState('English');
  const [notes, setNotes] = useState('');

  const n = Number.parseInt(count, 10);
  const ready = topic.trim() !== '' && deckName.trim() !== '' && n > 0 && n <= 200;
  const prompt = () =>
    buildPrompt({ topic: topic.trim(), deckName: deckName.trim(), count: n, types, language: language.trim() || 'English', notes });

  const copy = async () => {
    await Clipboard.setStringAsync(prompt());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Prompt copied', 'Paste it into ChatGPT or Claude, copy the JSON answer, then tap "Import the answer".');
  };

  const importAnswer = async () => {
    try {
      if (await importFromClipboard(db)) router.back();
    } catch (e) {
      Alert.alert('Import failed', (e as Error).message);
    }
  };

  return (
    <Screen>
      <Input label="Topic" value={topic} onChangeText={setTopic} placeholder="e.g. Derivatives of usual functions" />
      <Input label="Deck name" value={deckName} onChangeText={setDeckName} placeholder="e.g. Calculus — Chapter 2" />
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input label="Number of cards" value={count} onChangeText={setCount} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Language" value={language} onChangeText={setLanguage} />
        </View>
      </View>
      <View style={{ gap: Spacing.xs }}>
        <T variant="label">Card types</T>
        <Segmented
          value={types}
          onChange={setTypes}
          options={[
            { value: 'qa', label: 'Q / A' },
            { value: 'cloze', label: 'Cloze' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </View>
      <Input label="Course notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Paste your notes here" />
      <Button title="Copy prompt" onPress={copy} disabled={!ready} />
      <Button title="Share prompt" variant="secondary" disabled={!ready} onPress={() => Share.share({ message: prompt() })} />
      <Surface>
        <T variant="heading">Then</T>
        <T variant="caption">Copy the AI&apos;s whole answer and import it. Code fences and surrounding text are ignored.</T>
        <Button title="Import the answer from clipboard" onPress={importAnswer} />
      </Surface>
    </Screen>
  );
}
