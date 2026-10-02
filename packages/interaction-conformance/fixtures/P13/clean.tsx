export function PathBadge({ priorRuns, reachedRuns }: { priorRuns: number; reachedRuns: number }) {
  return (
    <span>
      {reachedRuns} of {priorRuns} prior runs on this pathway reached
    </span>
  );
}
