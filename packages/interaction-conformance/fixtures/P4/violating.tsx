// P4 VIOLATION: the key is the callback index. Note the parameter is called
// `idx`, not `i` — a checker hardcoded to `i` would wave this through.
export function Rows({ rows }: any) {
  return (
    <ul>
      {rows.map((row: any, idx: number) => (
        <li key={idx}>{row.label}</li>
      ))}
    </ul>
  );
}
