import { jsx as _jsx } from "react/jsx-runtime";
export function Rows({ rows }) {
    return (_jsx("ul", { children: rows.map((row, idx) => (_jsx("li", { children: row.label }, idx))) }));
}
//# sourceMappingURL=clean.js.map