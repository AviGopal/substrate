/**
 * Multi-goal substrate probe — registered-template selection demonstrator.
 *
 * Runs N distinct goals through GoalHost.runGoal with NO targetTemplateId
 * bypass. Each goal exercises the full registered-template path:
 *   1. POST /v2/activities/recommend (Thompson Sampling over registry)
 *   2. Fetch top-ranked template via CatalogueWithFallback (local → remote)
 *   3. normalizeMinibobTemplate() bridges resolver:null/llm + prompt.template
 *   4. ActivityExecutor runs through registered resolvers
 *   5. TranslatingTraceSink records back to canary
 *
 * Output: a summary table per goal — template id, candidate count, trace
 * status, task count, and per-task resolver/success/outputs. Useful for
 * answering "are we using registered templates first" with concrete
 * evidence, not a single-goal anecdote.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... METABOB_API_KEY=... \
 *     bun run validation/scripts/probe-substrate-multi-goal.ts
 */
export {};
//# sourceMappingURL=probe-substrate-multi-goal.d.ts.map