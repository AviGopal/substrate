/**
 * VERIFY: branch-health vessel faithfully replaces conventional `git`
 * invocation.
 *
 * Spec context: 2026-05-21 user pivot — primary use of ias-executor-ts is
 * to replace conventional software with vessel-based environs. This probe
 * provides concrete evidence that the branch-health vessel produces the
 * SAME factual information you'd get from running git commands manually.
 *
 * Method:
 *   1. Run runBranchHealth against the super-repo cwd.
 *   2. Independently invoke the same four git commands.
 *   3. Diff parsed-vessel-report vs parsed-raw-output. Any divergence is
 *      reported with both sides.
 *
 * Exit codes:
 *   0 — vessel report matches raw git output (faithful replacement)
 *   1 — divergence found (vessel is broken or git changed under our feet)
 *   2 — vessel itself failed to run
 */
export {};
//# sourceMappingURL=verify-branch-health.d.ts.map