import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
// P3 VIOLATION: a polled list spliced straight into the DOM. Rows arriving above
// the viewport move everything the reader was looking at.
export function ArrivalFeed({ rows }) {
    const [paused, setPaused] = useState(false);
    const [interval, setIntervalMs] = useState(2000);
    const query = { refetchInterval: paused ? false : interval };
    return _jsx("ul", { children: rows.map((row) => _jsx("li", { children: row.label }, row.id)) });
}
//# sourceMappingURL=violating.js.map