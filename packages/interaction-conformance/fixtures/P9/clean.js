import { jsx as _jsx } from "react/jsx-runtime";
export function renderContent(contentForm, payload) {
    switch (contentForm) {
        case 'markdown':
            return _jsx(Markdown, { source: payload });
        case 'json':
            return _jsx(JsonTree, { source: payload });
        default:
            return _jsx(VerbatimBlock, { source: payload });
    }
}
//# sourceMappingURL=clean.js.map