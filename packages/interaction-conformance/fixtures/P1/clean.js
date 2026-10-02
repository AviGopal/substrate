import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function RunRow({ run }) {
    return (_jsxs("span", { className: "run-row", children: [_jsx("strong", { children: run.reached ? 'reached' : 'not reached' }), _jsx("em", { children: run.status })] }));
}
//# sourceMappingURL=clean.js.map