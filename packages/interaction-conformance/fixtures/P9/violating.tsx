// P9 VIOLATION: the default branch exists but renders nothing. `default: return
// null` is the silent blank the rule exists to prevent — a present default is
// not the same thing as a fallthrough to verbatim.
export function renderContent(contentForm: string, payload: string) {
  switch (contentForm) {
    case 'markdown':
      return <Markdown source={payload} />;
    case 'json':
      return <JsonTree source={payload} />;
    default:
      return null;
  }
}
