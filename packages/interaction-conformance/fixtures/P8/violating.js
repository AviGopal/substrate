import { jsxs as _jsxs } from "react/jsx-runtime";
// P8 VIOLATION: the evidence slot renders a size and an identifier where the
// evidence itself should be. A trace's substantive content is the evidence.
export function Evidence({ trace }) {
    return (_jsxs(EvidenceSlot, { children: [trace.chars, " \u00B7 ", trace.traceId] }));
}
//# sourceMappingURL=violating.js.map