import { useEffect, useState } from 'react';

export function Ticker({ onTick }: any) {
  const [paused, setPaused] = useState(false);
  const [interval, setIntervalMs] = useState(2000);
  useEffect(() => {
    if (paused) return;
    const handle = setInterval(onTick, interval);
    return () => clearInterval(handle);
  }, [onTick, paused, interval]);
  return <div className="ticker">live</div>;
}
