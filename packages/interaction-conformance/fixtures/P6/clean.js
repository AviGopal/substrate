import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export function Ticker({ onTick }) {
    const [paused, setPaused] = useState(false);
    const [interval, setIntervalMs] = useState(2000);
    useEffect(() => {
        if (paused)
            return;
        const handle = setInterval(onTick, interval);
        return () => clearInterval(handle);
    }, [onTick, paused, interval]);
    return _jsx("div", { className: "ticker", children: "live" });
}
//# sourceMappingURL=clean.js.map