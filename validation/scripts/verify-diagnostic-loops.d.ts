/**
 * verify-diagnostic-loops.ts
 *
 * Structured end-to-end verification for the two diagnostic→action loops:
 *   1. Health loop:   substrate-health-tick → close-health-gap → dispatch
 *   2. Coverage loop: probe-reachable-unlearned → observer → dispatch
 *
 * Each test:
 *   - Reads the BEFORE state (diagnostic metric)
 *   - Runs the diagnostic activity
 *   - Polls until the observer/dispatch completes
 *   - Reads the AFTER state
 *   - Asserts expected behavior at each step
 *   - Reports PASS/FAIL with evidence
 *
 * Usage:
 *   bun run validation/scripts/verify-diagnostic-loops.ts [--endpoint http://localhost:18080]
 */
export {};
//# sourceMappingURL=verify-diagnostic-loops.d.ts.map