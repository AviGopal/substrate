/**
 * DEV verification: ported resolvers exercised directly via GoalHost.
 *
 * Tests the §4 resolver chain (impulse_preparation, iteration,
 * impulse_pool_selection, producer_selection) by running a template that
 * uses them inline — no subscriber chain involved. Cleanly isolates the
 * canonical-host substrate's resolver wiring from the subscriber-seeding
 * issue (task 40).
 *
 * Three tests in one run:
 *  1. impulse_preparation: synthesise a goal impulse from variables
 *  2. iteration: iterate over a shape list, dispatch impulse_pool_selection
 *  3. producer_selection: gracefully degrade (no real activity-api here)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... METABOB_API_KEY=... \
 *     bun run validation/scripts/test-ported-resolvers.ts
 */
export {};
//# sourceMappingURL=test-ported-resolvers.d.ts.map