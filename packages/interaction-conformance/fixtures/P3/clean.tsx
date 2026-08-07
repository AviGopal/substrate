import { useState } from 'react';
import { LiveList } from './primitives';

export function ArrivalFeed({ rows }: any) {
  const [paused, setPaused] = useState(false);
  const [interval, setIntervalMs] = useState(2000);
  const query = { refetchInterval: paused ? false : interval };
  return (
    <LiveList buffer="above-viewport">
      {rows.map((row: any) => <li key={row.id}>{row.label}</li>)}
    </LiveList>
  );
}
