export function Rows({ rows }: any) {
  return (
    <ul>
      {rows.map((row: any, idx: number) => (
        // @interaction:exempt P99 — this rule id does not exist in the table
        <li key={idx}>{row.label}</li>
      ))}
    </ul>
  );
}
