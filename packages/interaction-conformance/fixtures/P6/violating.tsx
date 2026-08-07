import { useEffect } from 'react';

// P6 VIOLATION: an auto-updating region the reader can neither pause nor slow.
export function Ticker({ onTick }: any) {
  useEffect(() => {
    const handle = setInterval(onTick, 2000);
    return () => clearInterval(handle);
  }, [onTick]);
  return <div className="ticker">live</div>;
}
