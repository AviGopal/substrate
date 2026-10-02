#!/usr/bin/env bun
/**
 * complexity-ladder-harness.ts — does the substrate reach arbitrary UNIQUE goals
 * as the number of data transformations grows?
 *
 * Complexity is defined here because the corpus refuses to settle it (FOUNDATION
 * offers four grains and states outright that a trajectory and an activity are
 * the same object at different granularity):
 *
 *   ONE TRANSFORMATION = one producer step in the walk that emits an output
 *   shape absent from its input shapes.
 *
 * Counted from `path_activities`, EXCLUDING `satisfier:*` pseudo-ids — a
 * satisfier is a shape being asserted into the pool, not a producer running.
 * Counting satisfiers inflates every rung uniformly and would make rung 1 look
 * like rung 3. There is NO walk-length column anywhere in the fleet (five
 * vessels' `src` scanned; one derived report field only), so each rung carries
 * its own expected count and is validated by CONTENT BINDING against an
 * externally measured ground truth rather than by a stored number.
 *
 * UNIQUENESS is by construction: every goal embeds a run nonce, so no goal here
 * has a prior `goal_hash`. That is what makes the floor arm a floor measurement
 * — reach "regardless of priors" (CLAUDE.md) — and not a memorization test.
 *
 * WHAT THIS DOES NOT MEASURE, said up front so nobody infers it:
 *   - Shape-pathway reuse. `pathwayReusePicks` is a log line plus a
 *     process-local Map, and `tierOf` has no reuse branch, so `walk_tier` can
 *     only ever record Tier-1/2 COMMAND reuse. An absent `learned_pathway` in
 *     the ceiling arm is NOT evidence that reuse did not fire.
 *   - Anything about code-edit goals. These are data-transformation goals; the
 *     edit pipeline is a separate plane with its own standing failures.
 *
 * Usage:
 *   bun run validation/scripts/complexity-ladder-harness.ts
 *        [--rungs 1,2,3,4] [--repeat] [--out <path>] [--poll-timeout-s 900]
 */
export {};
//# sourceMappingURL=complexity-ladder-harness.d.ts.map