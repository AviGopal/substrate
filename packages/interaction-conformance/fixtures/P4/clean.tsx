export function Rows({ rows }: any) {
  return (
    <ul>
      {rows.map((row: any, idx: number) => (
        <li key={row.id}>{row.label}</li>
      ))}
    </ul>
  );
}
