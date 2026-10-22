import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { Button, confirm, Screen, Select, Surface, T } from '@/components/ui';
import { wipeAll } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES, useI18n, type Lang, type LanguagePref } from '@/i18n';
import { exportToFile, importFromClipboard, importFromFile } from '@/transfer';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const i18n = useI18n();
  const { t, pref, setPref } = i18n;

  // Surface unexpected failures (unreadable file, share sheet error) instead of failing silently.
  const run = (action: () => Promise<unknown>) => () =>
    action().catch((e: Error) => Alert.alert(t('common.somethingWrong'), e.message));

  const erase = async () => {
    const labels = { cancel: t('common.cancel'), action: t('common.continue') };
    if (!(await confirm(t('settings.eraseTitle'), t('settings.eraseText'), labels))) return;
    const final = { cancel: t('common.cancel'), action: t('settings.eraseAction') };
    if (!(await confirm(t('settings.eraseConfirmTitle'), t('settings.eraseConfirmText'), final))) return;
    await wipeAll(db);
    Alert.alert(t('common.done'), t('settings.erased'));
  };

  const languageOptions: { value: LanguagePref; label: string }[] = [
    { value: 'system', label: t('settings.languageSystem') },
    ...(Object.keys(LANGUAGES) as Lang[]).map((l) => ({ value: l, label: LANGUAGES[l].label })),
  ];

  return (
    <Screen title={t('settings.title')}>
      <Surface>
        <Select label={t('settings.language')} value={pref} options={languageOptions} onChange={setPref} />
      </Surface>
      <Surface>
        <T variant="heading">{t('settings.import')}</T>
        <T variant="caption">{t('settings.importHelp')}</T>
        <Button title={t('settings.importFile')} onPress={run(() => importFromFile(db, i18n))} />
        <Button title={t('settings.paste')} variant="secondary" onPress={run(() => importFromClipboard(db, i18n))} />
        <Button title={`✨ ${t('ai.title')}`} variant="secondary" onPress={() => router.push('/ai-prompt')} />
      </Surface>
      <Surface>
        <T variant="heading">{t('settings.export')}</T>
        <Button title={t('settings.exportDecks')} onPress={run(() => exportToFile(db, false, i18n))} />
        <Button title={t('settings.backup')} variant="secondary" onPress={run(() => exportToFile(db, true, i18n))} />
      </Surface>
      <Surface tint={theme.danger}>
        <T variant="heading" color={theme.danger}>
          {t('settings.danger')}
        </T>
        <Button title={t('settings.erase')} variant="danger" onPress={run(erase)} />
      </Surface>
      <T variant="caption" style={{ textAlign: 'center' }}>
        Mnemo · {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
      </T>
    </Screen>
  );
}
