import { useState } from 'react';

// P3 VIOLATION: a polled list spliced straight into the DOM. Rows arriving above
// the viewport move everything the reader was looking at.
export function ArrivalFeed({ rows }: any) {
  const [paused, setPaused] = useState(false);
  const [interval, setIntervalMs] = useState(2000);
  const query = { refetchInterval: paused ? false : interval };
  return <ul>{rows.map((row: any) => <li key={row.id}>{row.label}</li>)}</ul>;
}
