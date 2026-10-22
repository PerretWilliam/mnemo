import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { Empty, Row, Screen, useFocusData } from '@/components/ui';
import { listSessions } from '@/db';

const formatDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const [sessions] = useFocusData(useCallback(() => listSessions(db), [db]));

  return (
    <Screen title="History">
      {sessions?.length === 0 ? <Empty text="No study sessions yet." /> : null}
      {sessions?.map((s) => {
        const total = s.correct + s.wrong;
        const pct = total ? Math.round((s.correct / total) * 100) : 0;
        return (
          <Row
            key={s.id}
            title={s.deckName}
            subtitle={`${new Date(s.endedAt).toLocaleString()} · ${formatDuration(s.endedAt - s.startedAt)}`}
            right={`${s.correct}/${total} · ${pct}%`}
          />
        );
      })}
    </Screen>
  );
}
