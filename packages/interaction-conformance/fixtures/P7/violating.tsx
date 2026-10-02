// P7 VIOLATION: the option set is written inline at the call site, and one of the
// options collects assent rather than information.
export function Feedback({ onPick }: any) {
  return <VerdictPicker options={[{ id: 'ok', label: 'Looks good' }]} onPick={onPick} />;
}
