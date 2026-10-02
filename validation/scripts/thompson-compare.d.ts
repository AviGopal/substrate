#!/usr/bin/env bun
/**
 * thompson-compare.ts — snapshot Thompson α/β posteriors for activity templates.
 *
 * Usage:
 *   bun run validation/scripts/thompson-compare.ts [--query <text>] [--limit <n>] [--label <text>]
 *
 * Reads METABOB_ENDPOINT and METABOB_API_KEY from environment (or ~/.metabob/config.json).
 * Queries /v2/activities/recommend with the given task description and prints a table
 * showing the top-N templates, their α/β posteriors, mean selection probability, and
 * execution counts. Run before and after each learning campaign step to track convergence.
 */
export {};
//# sourceMappingURL=thompson-compare.d.ts.map