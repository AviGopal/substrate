#!/usr/bin/env bun
/**
 * reuse-harness.ts — Phase 18.2 MRR validation harness for activity recommendation quality.
 *
 * Usage:
 *   bun run validation/scripts/reuse-harness.ts [--baseline <date>] [--limit <n>] [--label <text>] [--detailed]
 *
 * Reads METABOB_ENDPOINT and METABOB_API_KEY from environment (or ~/.metabob/config.json).
 * Runs each benchmark entry through POST /v2/activities/recommend and measures MRR.
 * Emits a dated JSON report to validation/results/{ISO_DATE}-reuse-report.json.
 *
 * Cost proxy: aborts after 100 API calls (~$5 budget cap).
 */
export {};
//# sourceMappingURL=reuse-harness.d.ts.map