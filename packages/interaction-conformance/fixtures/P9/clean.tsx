export function renderContent(contentForm: string, payload: string) {
  switch (contentForm) {
    case 'markdown':
      return <Markdown source={payload} />;
    case 'json':
      return <JsonTree source={payload} />;
    default:
      return <VerbatimBlock source={payload} />;
  }
}
