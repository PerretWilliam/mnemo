import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { MathMarkdown } from '@/components/math-markdown';
import { Button, confirm, Input, Loading, Screen, Surface, T } from '@/components/ui';
import { createCard, deleteCard, getCard, updateCard } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { answerSource, isCloze } from '@/lib/cloze';

export default function CardEditor() {
  const db = useSQLiteContext();
  const { t } = useI18n();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string; deckId: string }>();
  const isNew = params.id === 'new';
  const cardId = Number(params.id);
  const deckId = Number(params.deckId);

  const [loaded, setLoaded] = useState(isNew);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (isNew) return;
    getCard(db, cardId).then((c) => {
      if (c) {
        setFront(c.front);
        setBack(c.back);
        setTags(c.tags.join(', '));
      }
      setLoaded(true);
    });
  }, [db, cardId, isNew]);

  // Debounced so the WebView doesn't reload on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setPreview(front.trim() ? answerSource(front, back) : ''), 400);
    return () => clearTimeout(timer);
  }, [front, back]);

  if (!loaded) return <Loading />;

  const save = async (addAnother: boolean) => {
    if (!front.trim()) return Alert.alert(t('editor.missingFront'), t('editor.missingFrontText'));
    if (!isCloze(front) && !back.trim()) {
      return Alert.alert(t('editor.missingBack'), t('editor.missingBackText'));
    }
    const card = { front, back, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
    if (isNew) await createCard(db, deckId, card);
    else await updateCard(db, cardId, card);
    if (addAnother) {
      setFront('');
      setBack('');
    } else router.back();
  };

  const remove = async () => {
    if (await confirm(t('card.deleteTitle'), t('common.cannotUndo'), { cancel: t('common.cancel'), action: t('common.delete') })) {
      await deleteCard(db, cardId);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? t('editor.newTitle') : t('editor.editTitle') }} />
      <Input label={t('editor.front')} value={front} onChangeText={setFront} multiline placeholder={t('editor.frontPlaceholder')} />
      <Input label={t('editor.back')} value={back} onChangeText={setBack} multiline placeholder={t('editor.backPlaceholder')} />
      <Input label={t('editor.tags')} value={tags} onChangeText={setTags} autoCapitalize="none" />
      <T variant="caption">{t('editor.help')}</T>
      {preview ? (
        <Surface tint={theme.primary}>
          <T variant="label" color={theme.primary}>
            {t('editor.preview')}
          </T>
          <MathMarkdown source={preview} />
        </Surface>
      ) : null}
      <Button title={t('common.save')} onPress={() => save(false)} />
      {isNew ? <Button title={t('editor.saveAnother')} variant="secondary" onPress={() => save(true)} /> : null}
      {!isNew ? <Button title={t('editor.delete')} variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
