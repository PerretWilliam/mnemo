import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { Button, confirm, Screen, Surface, T } from '@/components/ui';
import { wipeAll } from '@/db';
import { exportToFile, importFromClipboard, importFromFile } from '@/transfer';

export default function SettingsScreen() {
  const db = useSQLiteContext();

  // Surface unexpected failures (unreadable file, share sheet error) instead of failing silently.
  const run = (action: () => Promise<unknown>) => () =>
    action().catch((e: Error) => Alert.alert('Something went wrong', e.message));

  const erase = async () => {
    if (!(await confirm('Erase everything?', 'All decks, cards and history will be deleted.', 'Continue'))) return;
    if (!(await confirm('Are you sure?', 'This cannot be undone. Export a backup first if needed.', 'Erase all'))) return;
    await wipeAll(db);
    Alert.alert('Done', 'All data was erased.');
  };

  return (
    <Screen title="Settings">
      <Surface>
        <T variant="heading">Import</T>
        <T variant="caption">JSON format: see the AI generator for the exact structure. Errors are listed per card.</T>
        <Button title="Import a JSON file" onPress={run(() => importFromFile(db))} />
        <Button title="Paste JSON from clipboard" variant="secondary" onPress={run(() => importFromClipboard(db))} />
        <Button title="Generate with AI" variant="secondary" onPress={() => router.push('/ai-prompt')} />
      </Surface>
      <Surface>
        <T variant="heading">Export</T>
        <Button title="Export decks" onPress={run(() => exportToFile(db, false))} />
        <Button title="Full backup (decks + history)" variant="secondary" onPress={run(() => exportToFile(db, true))} />
      </Surface>
      <Surface>
        <T variant="heading">Danger zone</T>
        <Button title="Erase all data" variant="danger" onPress={run(erase)} />
      </Surface>
      <T variant="caption" style={{ textAlign: 'center' }}>
        Flashcards v{Constants.expoConfig?.version}
      </T>
    </Screen>
  );
}
