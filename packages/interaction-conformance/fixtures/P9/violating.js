import { jsx as _jsx } from "react/jsx-runtime";
// P9 VIOLATION: the default branch exists but renders nothing. `default: return
// null` is the silent blank the rule exists to prevent — a present default is
// not the same thing as a fallthrough to verbatim.
export function renderContent(contentForm, payload) {
    switch (contentForm) {
        case 'markdown':
            return _jsx(Markdown, { source: payload });
        case 'json':
            return _jsx(JsonTree, { source: payload });
        default:
            return null;
    }
}
//# sourceMappingURL=violating.js.map