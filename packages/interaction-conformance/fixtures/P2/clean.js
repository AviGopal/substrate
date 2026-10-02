import { jsx as _jsx } from "react/jsx-runtime";
export function StarterRow({ text, setInput }) {
    const handleStarterPick = (value) => {
        setInput(value);
    };
    return _jsx("button", { onClick: () => handleStarterPick(text), children: text });
}
//# sourceMappingURL=clean.js.map