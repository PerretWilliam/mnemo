import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { MathMarkdown } from '@/components/math-markdown';
import { Button, confirm, Input, Loading, Screen, Surface, T } from '@/components/ui';
import { createCard, deleteCard, getCard, updateCard } from '@/db';
import { answerSource, isCloze } from '@/lib/cloze';

export default function CardEditor() {
  const db = useSQLiteContext();
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
    const t = setTimeout(() => setPreview(front.trim() ? answerSource(front, back) : ''), 400);
    return () => clearTimeout(t);
  }, [front, back]);

  if (!loaded) return <Loading />;

  const save = async (addAnother: boolean) => {
    if (!front.trim()) return Alert.alert('Missing front', 'The front of the card cannot be empty.');
    if (!isCloze(front) && !back.trim()) {
      return Alert.alert('Missing back', 'Add an answer, or use {{c::...}} in the front to make a cloze card.');
    }
    const card = { front, back, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) };
    if (isNew) await createCard(db, deckId, card);
    else await updateCard(db, cardId, card);
    if (addAnother) {
      setFront('');
      setBack('');
    } else router.back();
  };

  const remove = async () => {
    if (await confirm('Delete card?', 'This cannot be undone.')) {
      await deleteCard(db, cardId);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New card' : 'Edit card' }} />
      <Input label="Front" value={front} onChangeText={setFront} multiline placeholder="Question, or text with {{c::blanks}}" />
      <Input label="Back" value={back} onChangeText={setBack} multiline placeholder="Answer (optional for cloze cards)" />
      <Input label="Tags (comma separated)" value={tags} onChangeText={setTags} autoCapitalize="none" />
      <T variant="caption">Markdown supported. Math: $x^2$ inline, $$\int f$$ block. Cloze: {'{{c::hidden}}'}.</T>
      {preview ? (
        <Surface>
          <T variant="label">Preview</T>
          <MathMarkdown source={preview} />
        </Surface>
      ) : null}
      <Button title="Save" onPress={() => save(false)} />
      {isNew ? <Button title="Save and add another" variant="secondary" onPress={() => save(true)} /> : null}
      {!isNew ? <Button title="Delete card" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
