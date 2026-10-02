#!/usr/bin/env bun
/**
 * operator-goal-generator.ts — the CONVERGENT ENABLER (2026-06-27).
 *
 * WHY. The substrate now HAS the learning machinery: successor-features ψ (state-
 * conditioned Thompson), traced multi-step deliberation, the post-execution reach-gate
 * (verifyGoalReached → β-penalty on hollow completion), and decomposition-authoring
 * (gap-compose / feature_compose). But it is STARVED of the one input that exercises
 * all of it: DIVERSE, genuinely MULTI-STEP operator goals. Day-to-day traffic is thin
 * single-task internal ticks — boredom dispatches topology goals, gap-compose is paused,
 * the working set is internal observer/tick machinery. ψ vectors stay thin (mostly
 * occupancy-1 entries), deliberation stays shallow, reach-rate sits low because nothing
 * forces a query→aggregate→format or producer→consumer→consumer composition.
 *
 * This timer turns "has the apparatus" into "exercises it": each tick it picks ONE
 * multi-step operator goal from a rotating, diverse catalogue, GROUNDS it in real
 * substrate data (queried live so successive ticks reference actual templates / shapes /
 * failure modes / cost), and dispatches it through goal-host /run-goal. The completion
 * shape of every catalogue class has NO single producer — reaching it forces real
 * composition, which is precisely the signal ψ + the reach-gate + the composer need.
 *
 * ANTI-GAMING (the central honesty constraint). The generator is NOT optimised for
 * reach-rate and does NOT select goals by reachability — that would game the reach-gate.
 * Rotation is DETERMINISTIC over the catalogue classes (round-robin by a persisted tick
 * counter, no Math.random — unavailable under bun here anyway), selecting for DIVERSE
 * COVERAGE and genuine multi-step structure. The reach-gate remains the validator: real
 * content is still required to reach. Our success metric is "is the machinery getting
 * exercised + enriched", tracked over time via the jsonl + a companion read
 * (operator-goal-signal.ts) — ψ cell count / vector richness, genuine-edge count,
 * reach-rate trend — NOT a vanity reach-rate.
 *
 * Bounded: ONE goal per tick. Non-fatal: a dispatch failure logs + continues. Pausable:
 * OPERATOR_GOAL_GEN=0 disables (default enabled).
 *
 * Env (EnvironmentFile=/etc/substrate/env): SURREAL_PASS / SURREALDB_*, METABOB_API_KEY,
 * GOAL_HOST_VESSEL_ENDPOINT, METABOB_ENDPOINT.
 */
export {};
//# sourceMappingURL=operator-goal-generator.d.ts.map