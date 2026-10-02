import { jsx as _jsx } from "react/jsx-runtime";
// P1 VIOLATION: the template exit status is rendered alone. `status` is only the
// template exit status; the honest verdict is `reached`, and it is absent here.
export function RunRow({ run }) {
    return _jsx("span", { className: "run-row", children: run.status });
}
//# sourceMappingURL=violating.js.map