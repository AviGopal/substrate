// P8 VIOLATION: the evidence slot renders a size and an identifier where the
// evidence itself should be. A trace's substantive content is the evidence.
export function Evidence({ trace }: any) {
  return (
    <EvidenceSlot>
      {trace.chars} · {trace.traceId}
    </EvidenceSlot>
  );
}
