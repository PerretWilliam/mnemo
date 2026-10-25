import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { Empty, Row, Screen, useFocusData } from '@/components/ui';
import { deckColor } from '@/constants/theme';
import { listSessions } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

const formatDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, lang } = useI18n();
  const [sessions] = useFocusData(useCallback(() => listSessions(db), [db]));

  return (
    <Screen title={t('history.title')}>
      {sessions?.length === 0 ? <Empty text={t('history.empty')} /> : null}
      {sessions?.map((s) => {
        const total = s.correct + s.wrong;
        const pct = total ? Math.round((s.correct / total) * 100) : 0;
        return (
          <Row
            key={s.id}
            title={s.deckName}
            accent={deckColor(s.folderColor, theme)}
            subtitle={`${new Date(s.endedAt).toLocaleString(lang)} · ${formatDuration(s.endedAt - s.startedAt)}`}
            right={`${s.correct}/${total} · ${pct}%`}
          />
        );
      })}
    </Screen>
  );
}
