// Import / export flows: file picker, clipboard and share sheet, with user prompts.
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { ask } from '@/components/ui';
import { exportExchange, importExchange, type ConflictChoice } from '@/db';
import { parseExchange } from '@/lib/format';

const MAX_LISTED_ERRORS = 8;

const listErrors = (errors: string[]) =>
  errors.slice(0, MAX_LISTED_ERRORS).join('\n') +
  (errors.length > MAX_LISTED_ERRORS ? `\n…and ${errors.length - MAX_LISTED_ERRORS} more.` : '');

/** Validates, asks about errors and name conflicts, then imports. Returns true if something was imported. */
export async function importText(db: SQLiteDatabase, text: string): Promise<boolean> {
  const { data, errors, warnings } = parseExchange(text);
  if (!data) {
    Alert.alert('Nothing to import', listErrors(errors));
    return false;
  }
  const validCards = data.decks.reduce((n, d) => n + d.cards.length, 0);
  if (errors.length > 0) {
    const go = await ask(
      `${errors.length} problem(s) found`,
      `${listErrors(errors)}\n\nImport the ${validCards} valid card(s) anyway?`,
      [
        { text: 'Cancel', value: false, style: 'cancel' },
        { text: 'Import valid cards', value: true },
      ],
    );
    if (!go) return false;
  }

  const result = await importExchange(db, data, (name) =>
    ask<ConflictChoice>('Deck already exists', `A deck named "${name}" already exists.`, [
      { text: 'Skip', value: 'skip', style: 'cancel' },
      { text: 'Create new deck', value: 'new' },
      { text: 'Merge', value: 'merge' },
    ]),
  );
  Alert.alert(
    'Import complete',
    `${result.cards} card(s) in ${result.decks} deck(s).` + (warnings.length ? `\n\n${warnings.join('\n')}` : ''),
  );
  return result.decks > 0;
}

export async function importFromFile(db: SQLiteDatabase) {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return false;
  return importText(db, await new File(picked.assets[0].uri).text());
}

export async function importFromClipboard(db: SQLiteDatabase) {
  const text = await Clipboard.getStringAsync();
  if (!text.trim()) {
    Alert.alert('Clipboard is empty', 'Copy the JSON answer first, then try again.');
    return false;
  }
  return importText(db, text);
}

export async function exportToFile(db: SQLiteDatabase, withHistory: boolean) {
  const data = await exportExchange(db, withHistory);
  const date = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `flashcards-${withHistory ? 'backup' : 'decks'}-${date}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Sharing unavailable', `File saved to ${file.uri}`);
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export flashcards' });
}
