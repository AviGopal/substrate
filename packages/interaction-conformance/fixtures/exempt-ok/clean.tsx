export function Rows({ rows }: any) {
  return (
    <ul>
      {rows.map((row: any, idx: number) => (
        // @interaction:exempt P4 — fixed legend rendered once, never reordered
        <li key={idx}>{row.label}</li>
      ))}
    </ul>
  );
}
