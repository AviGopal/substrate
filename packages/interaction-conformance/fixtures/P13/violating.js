import { jsxs as _jsxs } from "react/jsx-runtime";
// P13 VIOLATION: planner confidence rendered as a precise-looking percentage.
export function PathBadge({ confidence }) {
    return _jsxs("span", { children: [(confidence * 100).toFixed(0), "% likely to reach"] });
}
//# sourceMappingURL=violating.js.map