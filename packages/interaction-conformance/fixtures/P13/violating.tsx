// P13 VIOLATION: planner confidence rendered as a precise-looking percentage.
export function PathBadge({ confidence }: { confidence: number }) {
  return <span>{(confidence * 100).toFixed(0)}% likely to reach</span>;
}
