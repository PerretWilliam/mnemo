// Import / export flows: file picker, clipboard and share sheet, with user prompts.
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { ask } from '@/components/ui';
import { exportExchange, importExchange, type ConflictChoice } from '@/db';
import type { Translator } from '@/i18n';
import { parseExchange, type Issue } from '@/lib/format';

const MAX_LISTED_ERRORS = 8;

function listIssues(issues: Issue[], { t }: Translator) {
  const lines = issues.slice(0, MAX_LISTED_ERRORS).map((i) => t(`issue.${i.code}`, i.params));
  if (issues.length > MAX_LISTED_ERRORS) lines.push(t('import.more', { count: issues.length - MAX_LISTED_ERRORS }));
  return lines.join('\n');
}

/** Validates, asks about errors and name conflicts, then imports. Returns true if something was imported. */
export async function importText(db: SQLiteDatabase, text: string, i18n: Translator): Promise<boolean> {
  const { t, tp } = i18n;
  const { data, errors, warnings } = parseExchange(text);
  if (!data) {
    Alert.alert(t('import.nothing'), listIssues(errors, i18n));
    return false;
  }
  const validCards = data.decks.reduce((n, d) => n + d.cards.length, 0);
  if (errors.length > 0) {
    const go = await ask(
      tp('import.problems', errors.length),
      `${listIssues(errors, i18n)}\n\n${tp('import.validAnyway', validCards)}`,
      [
        { text: t('common.cancel'), value: false, style: 'cancel' },
        { text: t('import.importValid'), value: true },
      ],
    );
    if (!go) return false;
  }

  const result = await importExchange(db, data, (name) =>
    ask<ConflictChoice>(t('import.exists'), t('import.existsText', { name }), [
      { text: t('import.skip'), value: 'skip', style: 'cancel' },
      { text: t('import.createNew'), value: 'new' },
      { text: t('import.merge'), value: 'merge' },
    ]),
  );
  const summary = t('import.summary', { decks: result.decks, cards: result.cards });
  Alert.alert(t('import.done'), warnings.length ? `${summary}\n\n${listIssues(warnings, i18n)}` : summary);
  return result.decks > 0;
}

export async function importFromFile(db: SQLiteDatabase, i18n: Translator) {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return false;
  return importText(db, await new File(picked.assets[0].uri).text(), i18n);
}

export async function importFromClipboard(db: SQLiteDatabase, i18n: Translator) {
  const text = await Clipboard.getStringAsync();
  if (!text.trim()) {
    Alert.alert(i18n.t('import.clipboardEmpty'), i18n.t('import.clipboardEmptyText'));
    return false;
  }
  return importText(db, text, i18n);
}

export async function exportToFile(db: SQLiteDatabase, withHistory: boolean, { t }: Translator) {
  const data = await exportExchange(db, withHistory);
  const date = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `mnemo-${withHistory ? 'backup' : 'decks'}-${date}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert(t('export.unavailable'), t('export.savedTo', { path: file.uri }));
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t('export.dialogTitle') });
}
