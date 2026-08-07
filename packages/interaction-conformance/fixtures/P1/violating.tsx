// P1 VIOLATION: the template exit status is rendered alone. `status` is only the
// template exit status; the honest verdict is `reached`, and it is absent here.
export function RunRow({ run }: { run: { status: string } }) {
  return <span className="run-row">{run.status}</span>;
}
