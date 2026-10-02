export function Rows({ rows }: any) {
  return (
    <ul>
      {rows.map((row: any, idx: number) => (
        // @interaction:exempt P4
        <li key={idx}>{row.label}</li>
      ))}
    </ul>
  );
}
