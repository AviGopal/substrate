/**
 * VERIFY: development-vessel branch-health activity produces same output as raw git.
 *
 * The development-vessel branch-health activity is now the canonical way to
 * inspect branch health. This probe verifies that the vessel's resolvers
 * (git_status, git_diff, git_log) produce the same factual information as
 * running git commands independently.
 *
 * Compare against the raw git baseline in verify-branch-health.ts.
 *
 * Exit codes:
 *   0 — vessel resolvers match raw git output (faithful replacement)
 *   1 — divergence found
 *   2 — vessel resolvers failed to run
 */
export {};
//# sourceMappingURL=verify-development-vessel-branch-health.d.ts.map