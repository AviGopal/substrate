export function Evidence({ trace }: any) {
  return (
    <EvidenceSlot>
      <pre>{trace.content}</pre>
      <footer>{trace.chars} · {trace.traceId}</footer>
    </EvidenceSlot>
  );
}
