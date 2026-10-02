export function order(runs: any[]) {
  return [...runs].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
