import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
// P6 VIOLATION: an auto-updating region the reader can neither pause nor slow.
export function Ticker({ onTick }) {
    useEffect(() => {
        const handle = setInterval(onTick, 2000);
        return () => clearInterval(handle);
    }, [onTick]);
    return _jsx("div", { className: "ticker", children: "live" });
}
//# sourceMappingURL=violating.js.map