/**
 * Unit tests for adversarial-mutate.ts — G1.3.1 acceptance criteria.
 *
 * Acceptance: seeded LLM call (temperature=0) returns identical output across
 * two runs given identical input.
 *
 * Tests:
 *   1. swap_output_shape mutation replaces expected_output_shapes
 *   2. narrow_constraint mutation appends to goal_text
 *   3. prompt_hash is stable (same goal → same hash)
 *   4. Two calls with identical input produce identical AdversarialGoal
 *   5. Markdown fences in LLM response are stripped
 *   6. Unknown mutation_type throws
 */
export {};
//# sourceMappingURL=adversarial-mutate.test.d.ts.map