/**
 * Does the posterior Thompson draws from agree with the record of what happened?
 *
 * WHY THIS EXISTS. Every learning instrument in this system reports on the
 * *credit channel* — how many deltas were sent, how many were dropped, whether a
 * write threw. None of them compares the end state to the outcomes it is supposed
 * to summarise, so a channel that faithfully delivers only HALF the evidence
 * reads as perfectly healthy at every checkpoint. It is: every delta it carries
 * arrives. It just never carries the other sign.
 *
 * `variant_performance_metrics` stores two numbers per arm:
 *
 *   successful_executions / total_executions  — did the STEP run cleanly
 *                                               (validated.success on the
 *                                                execution record)
 *   thompson_alpha / thompson_beta            — was the step CREDITED with
 *                                               reaching a goal with substance
 *
 * READ THIS BEFORE QUOTING THE OUTPUT: those are different quantities, not two
 * views of one history. Reaching with substance is rarer than executing without
 * error, so a posterior mean BELOW the execution-success rate is expected and is
 * not by itself a defect. This script measures the gap between "works" and
 * "gets somewhere" — a standing view, not a verdict.
 *
 * The reading that no benign story explains is `atPrior`: arms that have never
 * been graded at all. Those are drawn at Beta(1,1) forever, and Thompson treats
 * a coin it has never flipped exactly like one it has flipped and found fair.
 *
 * WHAT THE TAU MEANS. Kendall's tau-b summarises whether the posterior orders
 * arm PAIRS the way execution reliability does. It is a proxy check, not a
 * verdict: tau near 0 means execution reliability cannot be used to sanity-check
 * the posterior, which is worth knowing precisely because it means a broken
 * credit channel has nothing obvious to contradict it. Diagnose the channel from
 * the walk's own credit decisions, not from this number.
 *
 * TWO WAYS THIS SCRIPT COULD LIE, both guarded:
 *   - Arms with one or two outcomes have empirical rates of exactly 0.000 or
 *     1.000. A first version included them and reported 279 of 280 arms
 *     "discordant" — an artefact of breaking ties among identical 1.000s. Hence
 *     --min-n, and pairwise comparison instead of positional.
 *   - An unauthenticated read returns 401, and an empty result set is
 *     indistinguishable from "no arm has a posterior". Hence the key check below:
 *     the script refuses to report rather than report a zero it cannot defend.
 *
 * Reads through the same authenticated resolve path the vessels use, so it
 * measures the store the sampler reads and not a convenient copy of it.
 *
 * Usage:  bun run validation/scripts/posterior-divergence.ts [--limit=N] [--min-n=N] [--json]
 *   ACTIVITY_API_ENDPOINT   store to ask (default http://localhost:18080)
 *   HUB_DISCOVERY_URL       shape vocabulary, for the satisfier arms
 *   GOAL_HOST_VESSEL_API_KEY | METABOB_API_KEY   credential
 *
 * Exits non-zero when the posterior stops tracking the record, so it can gate.
 */
export {};
//# sourceMappingURL=posterior-divergence.d.ts.map