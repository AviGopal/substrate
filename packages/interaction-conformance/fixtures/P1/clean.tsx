export function RunRow({ run }: { run: { status: string; reached: boolean } }) {
  return (
    <span className="run-row">
      <strong>{run.reached ? 'reached' : 'not reached'}</strong>
      <em>{run.status}</em>
    </span>
  );
}
