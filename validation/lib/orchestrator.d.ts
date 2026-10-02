#!/usr/bin/env bun
/**
 * Top-level orchestrator for the head-to-head agent benchmark.
 *
 *   bun run validation/lib/orchestrator.ts \
 *     --prompt validation/prompts/01-fix-failing-test.md \
 *     --workspace pristine-typescript-project \
 *     [--model claude-sonnet-4-6] \
 *     [--timeout 600] \
 *     [--only claude-code|minibob]    # skip the other agent (useful for debug)
 *
 * Behaviour:
 *   1. Resolve the prompt file and workspace seed.
 *   2. Make a fresh run dir under runs/<timestamp>-<prompt-name>/.
 *   3. For each agent: copy seed → workspace.before → workspace.after, run
 *      the agent with workspace.after bind-mounted, capture stdout/stderr,
 *      extract transcript.
 *   4. Diff workspace.before vs workspace.after for each agent, then
 *      cross-diff the two `.after` snapshots.
 *   5. Render report.md.
 *
 * No verdict scoring — that's the human's job.
 */
export {};
//# sourceMappingURL=orchestrator.d.ts.map