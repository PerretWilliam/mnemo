import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { Button, Input, Screen, Segmented, Select, Surface, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CARD_LANGUAGES, useI18n } from '@/i18n';
import { buildPrompt, type CardTypes } from '@/lib/prompt';
import { importFromClipboard } from '@/transfer';

export default function AiPromptScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const i18n = useI18n();
  const { t, lang } = i18n;
  const [topic, setTopic] = useState('');
  const [deckName, setDeckName] = useState('');
  const [count, setCount] = useState('20');
  const [types, setTypes] = useState<CardTypes>('both');
  // Default to the app language; the prompt itself always names the language in English.
  const [language, setLanguage] = useState(CARD_LANGUAGES.find((l) => l.lang === lang)?.value ?? 'English');
  const [notes, setNotes] = useState('');

  const n = Number.parseInt(count, 10);
  const ready = topic.trim() !== '' && deckName.trim() !== '' && n > 0 && n <= 200;
  const prompt = () => buildPrompt({ topic: topic.trim(), deckName: deckName.trim(), count: n, types, language, notes });

  const copy = async () => {
    await Clipboard.setStringAsync(prompt());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('ai.copiedTitle'), t('ai.copiedText'));
  };

  const importAnswer = async () => {
    try {
      if (await importFromClipboard(db, i18n)) router.back();
    } catch (e) {
      Alert.alert(t('ai.importFailed'), (e as Error).message);
    }
  };

  return (
    <Screen>
      <Input label={t('ai.topic')} value={topic} onChangeText={setTopic} placeholder={t('ai.topicPlaceholder')} />
      <Input label={t('ai.deckName')} value={deckName} onChangeText={setDeckName} placeholder={t('ai.deckPlaceholder')} />
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 2 }}>
          <Select label={t('ai.language')} value={language} options={CARD_LANGUAGES} onChange={setLanguage} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t('ai.count')} value={count} onChangeText={setCount} keyboardType="number-pad" />
        </View>
      </View>
      <View style={{ gap: Spacing.xs }}>
        <T variant="label">{t('ai.types')}</T>
        <Segmented
          value={types}
          onChange={setTypes}
          options={[
            { value: 'qa', label: t('ai.typeQa') },
            { value: 'cloze', label: t('ai.typeCloze') },
            { value: 'both', label: t('ai.typeBoth') },
          ]}
        />
      </View>
      <Input
        label={t('ai.notes')}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={t('ai.notesPlaceholder')}
      />
      <Button title={t('ai.copy')} onPress={copy} disabled={!ready} />
      <Button title={t('ai.share')} variant="secondary" disabled={!ready} onPress={() => Share.share({ message: prompt() })} />
      <Surface tint={theme.accent}>
        <T variant="heading" color={theme.accent}>
          {t('ai.then')}
        </T>
        <T variant="caption">{t('ai.thenText')}</T>
        <Button title={t('ai.import')} onPress={importAnswer} />
      </Surface>
    </Screen>
  );
}
