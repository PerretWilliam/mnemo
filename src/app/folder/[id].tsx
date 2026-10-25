import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, confirm, Empty, Icon, Input, Loading, Screen, T, useFocusData } from '@/components/ui';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { createFolder, deleteFolder, getFolder, getSessionSize, listFolders, updateFolder } from '@/db';
import { useI18n } from '@/i18n';
import { FOLDER_COLORS, nextFolderColor } from '@/lib/folders';
import { sessionLength } from '@/lib/sampling';

const SWATCH = 44;

/** Create (`id` = "new") or edit a folder: name and color. Decks are assigned to it from the deck screen. */
export default function FolderScreen() {
  const db = useSQLiteContext();
  const { t, tp } = useI18n();
  const param = useLocalSearchParams<{ id: string }>().id;
  const isNew = param === 'new';
  const id = Number(param);
  const [data] = useFocusData(
    useCallback(async () => {
      const folder = isNew ? null : await getFolder(db, id);
      // New folders start with the least used palette color.
      const suggested = nextFolderColor((await listFolders(db)).map((f) => f.color));
      return { folder, suggested };
    }, [db, id, isNew]),
  );
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  if (!data) return <Loading />;
  if (!isNew && !data.folder) return <Empty text={t('folder.missing')} />;
  const { folder, suggested } = data;

  const shownName = name ?? folder?.name ?? '';
  const shownColor = color ?? folder?.color ?? suggested;

  const save = async () => {
    if (!shownName.trim()) return;
    if (folder) await updateFolder(db, id, shownName, shownColor);
    else await createFolder(db, shownName, shownColor);
    router.back();
  };

  const remove = async () => {
    const labels = { cancel: t('common.cancel'), action: t('common.delete') };
    if (await confirm(t('folder.deleteTitle'), t('folder.deleteMessage', { name: folder?.name ?? '' }), labels)) {
      await deleteFolder(db, id);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: folder?.name ?? t('folder.newTitle'), headerTintColor: shownColor }} />
      <Input
        label={t('folder.name')}
        placeholder={t('folder.namePlaceholder')}
        value={shownName}
        onChangeText={setName}
        onSubmitEditing={save}
        returnKeyType="done"
        autoFocus={isNew}
      />
      <View style={{ gap: Spacing.xs }}>
        <T variant="label">{t('folder.color')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
          {FOLDER_COLORS.map((c) => {
            const selected = c.toLowerCase() === shownColor.toLowerCase();
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setColor(c)}
                style={{
                  width: SWATCH,
                  height: SWATCH,
                  borderRadius: SWATCH / 2,
                  backgroundColor: c,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {selected ? <Icon name={Icons.check} color="#FFFFFF" /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      {folder ? (
        <>
          <T variant="caption">{tp('count.decks', folder.deckCount)}</T>
          <Button
            icon={Icons.study}
            title={t('deck.study', { count: sessionLength(folder.cardCount, getSessionSize()) })}
            variant="secondary"
            disabled={folder.cardCount === 0}
            onPress={() => router.push({ pathname: '/session/folder/[folderId]', params: { folderId: folder.id } })}
          />
        </>
      ) : null}
      <Button icon={Icons.save} title={t('common.save')} onPress={save} disabled={!shownName.trim()} />
      {folder ? (
        <Button icon={Icons.delete} title={t('folder.delete')} variant="danger" onPress={remove} style={{ marginTop: Spacing.xl }} />
      ) : null}
    </Screen>
  );
}
