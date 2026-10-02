/**
 * adversarial-mutate.ts — G1.3.1
 *
 * Takes a passing GeneratedGoal and produces an AdversarialGoal by calling
 * an LLM at temperature=0.  Two mutation types are supported:
 *
 *   swap_output_shape    — replace expected_output_shapes with a related-but-
 *                          different shape, making the goal harder to satisfy.
 *   narrow_constraint    — append a narrowing constraint to goal_text (e.g.,
 *                          "without modifying X", "only using Y"), leaving the
 *                          output shapes unchanged but restricting the solution.
 *
 * Determinism guarantee: prompt is derived only from the source goal's stable
 * fields, temperature is 0, and model is pinned.  The same input always
 * produces the same output.
 *
 * Usage (see goal-generator.ts G1.3.2 wiring):
 *   const adversarial = await mutateGoal(goal, { apiKey, anthropicApiKey, endpoint });
 */
import type { GeneratedGoal } from "../goal-generator";
export type MutationType = "swap_output_shape" | "narrow_constraint";
export interface AdversarialGoal extends Omit<GeneratedGoal, "adversarial"> {
    adversarial: true;
    mutation_type: MutationType;
    /** Raw LLM payload — shape depends on mutation_type. */
    mutation_payload: Record<string, unknown>;
    llm_model: string;
    prompt_hash: string;
}
export type HarnessGoal = GeneratedGoal | AdversarialGoal;
declare function buildPrompt(goal: GeneratedGoal): string;
export declare function mutateGoal(goal: GeneratedGoal, opts: {
    anthropicApiKey: string;
}): Promise<AdversarialGoal>;
export { buildPrompt };
//# sourceMappingURL=adversarial-mutate.d.ts.map