#!/usr/bin/env bun
/**
 * goal-generator.ts — Phase 25 G1.2 / G1.4
 *
 * Generates a stratified set of natural-language goals for the evaluation harness.
 *
 * Usage:
 *   bun run validation/scripts/goal-generator.ts \
 *     --seed 12345 --count 50 \
 *     [--novelty-mix 0.4,0.4,0.2] \
 *     [--depth-mix 0.5,0.3,0.2] \
 *     [--scenario-mix 0.6,0.2,0.2] \
 *     [--adversarial-fraction 0.1] \
 *     [--output validation/generated/12345-2026-05-19.json]
 *     [--held-out]  # G1.4: weekly held-out suite (seed=YYYY_WW_held_out_v1, count=8)
 *
 * --held-out mode (G1.4.1):
 *   Overrides --seed with the ISO week seed "YYYY_WW_held_out_v1" (where YYYY and WW
 *   are the current UTC year and ISO week number).  Count defaults to 8.  Output goes
 *   to validation/generated/<date>-held-out-goals.json.  Running the same flag in the
 *   same ISO week always produces the same goals; different weeks produce different but
 *   independently reproducible sets.
 *
 * Adversarial generation is deferred (G1.3); goals always have adversarial:false.
 *
 * Config: reads METABOB_ENDPOINT / METABOB_API_KEY or ~/.metabob/config.json.
 *         Discovery-vessel: DISCOVERY_VESSEL_ENDPOINT (default: https://discovery.metabob.com)
 */
export interface GeneratedGoal {
    id: string;
    cell_id: string;
    shape_signature: {
        input: string[];
        output: string[];
    };
    goal_text: string;
    expected_output_shapes: string[];
    seed_impulse_pool: string[];
    adversarial: false;
    oracle_label_id: string | null;
    oracle_verdict?: "pass" | "fail";
    generator_seed: string;
    shape_registry_snapshot_hash: string;
}
//# sourceMappingURL=goal-generator.d.ts.map