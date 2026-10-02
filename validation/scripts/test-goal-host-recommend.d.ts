/**
 * End-to-end live test: GoalHost.runGoal with real recommend (no bypass).
 *
 * Demonstrates the template-format bridge (commits 80bfa60 + 196001d):
 *   1. GoalHost queries activity-api /v2/activities/recommend with goalText
 *   2. Top template (likely resolver:null + prompt.template) is fetched
 *   3. normalizeMinibobTemplate() rewrites resolver:null → "llm-prompt"
 *   4. llm-prompt resolver interpolates {{var}}, calls LLM, emits llmText
 *   5. Trace stored on canary
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... METABOB_API_KEY=... \
 *     bun run validation/scripts/test-goal-host-recommend.ts [goal-text]
 */
export {};
//# sourceMappingURL=test-goal-host-recommend.d.ts.map