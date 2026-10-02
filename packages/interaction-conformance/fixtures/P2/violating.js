import { jsx as _jsx } from "react/jsx-runtime";
// P2 VIOLATION: picking a starter fires the goal instead of filling the input.
// Two spellings, because respelling the parameters must not be an escape:
// a plainly-named handler, and one whose params are destructured — the first
// brace after that declaration is the destructure, not the body.
export function StarterRow({ text }) {
    const handleStarterPick = (value) => {
        dispatchGoal(value);
    };
    return _jsx("button", { onClick: () => handleStarterPick(text), children: text });
}
export function SuggestionChip({ label }) {
    const onSuggestionPick = ({ value }) => {
        submitGoal(value);
    };
    return _jsx("button", { onClick: () => onSuggestionPick({ value: label }), children: label });
}
//# sourceMappingURL=violating.js.map