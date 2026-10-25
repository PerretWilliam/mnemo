import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Empty, Icon, Input, Row, Screen, T, useFocusData } from '@/components/ui';
import { Icons } from '@/constants/icons';
import { deckColor, Spacing } from '@/constants/theme';
import { createDeck, listDecks, listFolders, type Folder } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { groupByFolder } from '@/lib/folders';

export default function DecksScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, tp } = useI18n();
  const [data, reload] = useFocusData(
    useCallback(async () => ({ decks: await listDecks(db), folders: await listFolders(db) }), [db]),
  );
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    const id = await createDeck(db, name);
    setName('');
    reload();
    router.push({ pathname: '/deck/[id]', params: { id } });
  };

  const sections = data ? groupByFolder(data.folders, data.decks) : [];
  // Headers only make sense once folders exist; without any, the list stays flat.
  const showHeaders = (data?.folders.length ?? 0) > 0;

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
        <Button icon={Icons.add} title={t('decks.add')} onPress={add} disabled={!name.trim()} />
      </View>
      <Button
        icon={Icons.folder}
        title={t('decks.newFolder')}
        variant="secondary"
        onPress={() => router.push({ pathname: '/folder/[id]', params: { id: 'new' } })}
      />
      <Button icon={Icons.ai} title={t('decks.generateAi')} variant="secondary" onPress={() => router.push('/ai-prompt')} />
      {data && data.decks.length === 0 && data.folders.length === 0 ? <Empty text={t('decks.empty')} /> : null}
      {sections.map(({ folder, decks }) => (
        <View key={folder?.id ?? 'unfiled'} style={{ gap: Spacing.sm }}>
          {showHeaders ? <SectionHeader folder={folder} count={decks.length} /> : null}
          {decks.map((d) => (
            <Row
              key={d.id}
              title={d.name}
              accent={deckColor(d.folderColor, theme)}
              right={tp('count.cards', d.cardCount)}
              onPress={() => router.push({ pathname: '/deck/[id]', params: { id: d.id } })}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

/** Folder title with its color; tapping it opens the folder editor. `folder: null` is the unfiled section. */
function SectionHeader({ folder, count }: { folder: Folder | null; count: number }) {
  const theme = useTheme();
  const { t, tp } = useI18n();
  const color = deckColor(folder?.color, theme);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm }}>
      <Pressable
        accessibilityRole={folder ? 'button' : 'header'}
        disabled={!folder}
        onPress={() => folder && router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <Icon name={Icons.folder} color={color} size={20} />
        <T variant="heading" color={color} style={{ flexShrink: 1 }} numberOfLines={1}>
          {folder?.name ?? t('decks.unfiled')}
        </T>
        <T variant="caption">{tp('count.decks', count)}</T>
        {folder ? <Icon name={Icons.edit} color={theme.textSecondary} size={18} /> : null}
      </Pressable>
      {folder && folder.cardCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('folder.study')}
          hitSlop={8}
          onPress={() => router.push({ pathname: '/session/folder/[folderId]', params: { folderId: folder.id } })}
          style={{ padding: Spacing.xs }}>
          <Icon name={Icons.study} color={color} size={24} />
        </Pressable>
      ) : null}
    </View>
  );
}
