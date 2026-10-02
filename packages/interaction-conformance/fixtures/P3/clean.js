import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { LiveList } from './primitives';
export function ArrivalFeed({ rows }) {
    const [paused, setPaused] = useState(false);
    const [interval, setIntervalMs] = useState(2000);
    const query = { refetchInterval: paused ? false : interval };
    return (_jsx(LiveList, { buffer: "above-viewport", children: rows.map((row) => _jsx("li", { children: row.label }, row.id)) }));
}
//# sourceMappingURL=clean.js.map