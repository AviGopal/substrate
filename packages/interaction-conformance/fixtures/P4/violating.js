import { jsx as _jsx } from "react/jsx-runtime";
// P4 VIOLATION: the key is the callback index. Note the parameter is called
// `idx`, not `i` — a checker hardcoded to `i` would wave this through.
export function Rows({ rows }) {
    return (_jsx("ul", { children: rows.map((row, idx) => (_jsx("li", { children: row.label }, idx))) }));
}
//# sourceMappingURL=violating.js.map