# Tasks: Recommendation Validation v2

## Phase V2.0 — Benchmark v2

### T0.1 Write `validation/activity-reuse-benchmark-v2.json`

**Acceptance criteria:**
- File exists at `validation/activity-reuse-benchmark-v2.json`
- Contains exactly 20 entries
- Each entry has all required fields: `id`, `category`, `goal_text`, `expected_activity_id`,
  `expected_activity_name`, `search_query`, `tags`, `seed_impulse_pool`
- `seed_impulse_pool` is `[]` for all entries
- No `expected_activity_id` uses the double-prefix wrapped form (`activity:⟨activity:⟨…⟩⟩`)
- All `expected_activity_id` values verified to exist in the canary registry via
  `GET /v2/activities/templates?q=<name_fragment>` or `POST /v2/activities/recommend` before commit
- Category distribution: at least 2 entries per each of the following: `meta`, `infrastructure`,
  `tool`; no single category exceeds 12 entries
- `goal_text` does NOT contain the template name verbatim; describes the purpose/problem
- `search_query` is ≤ 5 words and contains at least one term expected in the template's tags or name
- Committed under `validation/activity-reuse-benchmark-v2.json`

**Full entry list to implement** (use template names/IDs from `validation/baselines/2026-05-09-thompson.json`):

```json
[
  {
    "id": "v2-bench-001",
    "category": "meta",
    "goal_text": "run task validation after each activity step and record failure modes when constraints are not met",
    "expected_activity_id": "activity:⟨validator-dispatch⟩",
    "expected_activity_name": "Validator Dispatch (validators-and-failure-modes)",
    "search_query": "validator dispatch failure mode",
    "tags": ["meta", "validator", "failure-mode", "lifecycle"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-002",
    "category": "infrastructure",
    "goal_text": "resolve a user-stated development goal by selecting and sequencing the right activities",
    "expected_activity_id": "activity:_goal_resolve",
    "expected_activity_name": "Goal Resolve",
    "search_query": "goal resolve activity selection",
    "tags": ["goal", "resolver", "orchestration"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-003",
    "category": "meta",
    "goal_text": "audit the activity template registry and rank templates by execution count and Thompson score",
    "expected_activity_id": "activity:⟨core-activity-audit⟩",
    "expected_activity_name": "Core Activity Audit",
    "search_query": "activity audit registry quality",
    "tags": ["meta", "audit", "registry", "thompson"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-004",
    "category": "infrastructure",
    "goal_text": "verify that the lifecycle event hooks and learning loop are firing correctly end to end",
    "expected_activity_id": "activity:⟨Lifecycle and Learning Loop Verification⟩",
    "expected_activity_name": "Lifecycle and Learning Loop Verification",
    "search_query": "lifecycle learning loop verification",
    "tags": ["lifecycle", "learning-loop", "verification", "integration"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-005",
    "category": "infrastructure",
    "goal_text": "check that all system components are healthy and responding correctly at startup",
    "expected_activity_id": "activity:⟨startup:health-check⟩",
    "expected_activity_name": "Startup Health Check",
    "search_query": "startup health check components",
    "tags": ["infrastructure", "health", "startup"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-006",
    "category": "meta",
    "goal_text": "execute a task using broad tool access when no specific activity template matches the goal",
    "expected_activity_id": "activity:improvise",
    "expected_activity_name": "Improvise (broad-tool fallback)",
    "search_query": "improvise fallback broad tool",
    "tags": ["fallback", "improvise", "tool"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-007",
    "category": "meta",
    "goal_text": "convert a written specification document into a concrete enforcement activity template",
    "expected_activity_id": "activity:⟨spec-to-enforcement-activity⟩",
    "expected_activity_name": "Spec to Enforcement Activity",
    "search_query": "spec enforcement activity conversion",
    "tags": ["meta", "spec", "enforcement", "template"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-008",
    "category": "meta",
    "goal_text": "create a new reusable activity template from a description of the desired behaviour",
    "expected_activity_id": "activity:⟨make-activity⟩",
    "expected_activity_name": "Make Activity (meta-activity-builder)",
    "search_query": "make activity template builder",
    "tags": ["meta", "make-activity", "builder", "template-creation"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-009",
    "category": "meta",
    "goal_text": "extract a reusable template from a successful execution trace using the lifecycle extraction hook",
    "expected_activity_id": "activity:⟨ribosome-extract⟩",
    "expected_activity_name": "Ribosome Extract (lifecycle-driven template extraction)",
    "search_query": "ribosome extract template lifecycle",
    "tags": ["meta", "ribosome", "template-extraction", "lifecycle"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-010",
    "category": "meta",
    "goal_text": "bind input shapes to available impulse producers before a task begins executing",
    "expected_activity_id": "activity:⟨slot-binding⟩",
    "expected_activity_name": "Slot Binding (impulse-binding-selection-layer)",
    "search_query": "slot binding impulse selection",
    "tags": ["meta", "slot-binding", "impulse", "selection-layer"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-011",
    "category": "infrastructure",
    "goal_text": "run a full system check to confirm the lifecycle hooks, activity execution, and learning loop are all operational",
    "expected_activity_id": "activity:⟨System Lifecycle and Learning Loop Verification⟩",
    "expected_activity_name": "System Lifecycle and Learning Loop Verification",
    "search_query": "system lifecycle verification operational",
    "tags": ["infrastructure", "system", "lifecycle", "verification"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-012",
    "category": "infrastructure",
    "goal_text": "run a complete cycle of activity improvement from audit through to replacement and verification",
    "expected_activity_id": "activity:⟨Complete Activity Improvement Cycle⟩",
    "expected_activity_name": "Complete Activity Improvement Cycle",
    "search_query": "activity improvement cycle complete",
    "tags": ["infrastructure", "improvement-cycle", "audit", "replacement"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-013",
    "category": "meta",
    "goal_text": "iteratively improve a specific activity template through repeated evaluation and refinement",
    "expected_activity_id": "activity:⟨Activity Improvement Loop⟩",
    "expected_activity_name": "Activity Improvement Loop",
    "search_query": "activity improvement loop iteration",
    "tags": ["meta", "improvement", "loop", "refinement"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-014",
    "category": "meta",
    "goal_text": "migrate an activity that uses enforcement-style constraints to use the new validation framework",
    "expected_activity_id": "activity:⟨enforcement-to-validation-activity⟩",
    "expected_activity_name": "Enforcement to Validation Activity",
    "search_query": "enforcement validation migration activity",
    "tags": ["meta", "enforcement", "validation", "migration"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-015",
    "category": "tool",
    "goal_text": "present a list of available activities and let a user interactively select which one to run",
    "expected_activity_id": "activity:⟨interactive-activity-selector⟩",
    "expected_activity_name": "Interactive Activity Selector",
    "search_query": "interactive activity selector tool",
    "tags": ["tool", "interactive", "selector"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-016",
    "category": "meta",
    "goal_text": "replace an underperforming activity template in the registry with a better variant",
    "expected_activity_id": "activity:⟨replace-activity⟩",
    "expected_activity_name": "Replace Activity (registry-quality)",
    "search_query": "replace activity registry quality",
    "tags": ["meta", "registry-quality", "replace", "variant"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-017",
    "category": "meta",
    "goal_text": "soft-deprecate low-quality activity templates that have poor Thompson scores and low execution counts",
    "expected_activity_id": "activity:⟨prune-activity⟩",
    "expected_activity_name": "Prune Activity (registry-quality)",
    "search_query": "prune deprecate activity registry",
    "tags": ["meta", "registry-quality", "prune", "deprecate"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-018",
    "category": "infrastructure",
    "goal_text": "create a mapping between system components and their corresponding validation activities",
    "expected_activity_id": "activity:⟨map-components-to-validations⟩",
    "expected_activity_name": "Map Components to Validations",
    "search_query": "map components validations infrastructure",
    "tags": ["infrastructure", "components", "validation", "mapping"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-019",
    "category": "infrastructure",
    "goal_text": "run a continuous validation loop that checks spec compliance and reports failures",
    "expected_activity_id": "activity:⟨spec-validation-loop⟩",
    "expected_activity_name": "Spec Validation Loop",
    "search_query": "spec validation loop compliance",
    "tags": ["infrastructure", "spec", "validation", "loop"],
    "seed_impulse_pool": []
  },
  {
    "id": "v2-bench-020",
    "category": "meta",
    "goal_text": "scan activity templates for missing semantic markers and backfill tags and descriptions",
    "expected_activity_id": "activity:⟨audit-and-backfill-templates⟩",
    "expected_activity_name": "Audit and Backfill Template Semantic Markers",
    "search_query": "audit backfill templates semantic tags",
    "tags": ["meta", "audit", "backfill", "semantic", "tags"],
    "seed_impulse_pool": []
  }
]
```

**Before committing — mandatory canary probe.** The implementation agent MUST start by fetching
`GET https://activity.metabob.com/v2/activities/templates?limit=200` from canary and cross-referencing
all 20 `expected_activity_id` values against the live registry before writing the file. The typical
command is:
```bash
curl -s "https://activity.metabob.com/v2/activities/templates?limit=200" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  | jq '[.[] | .id]' > /tmp/live-ids.json

# Then check each expected ID:
jq 'contains(["activity:⟨validator-dispatch⟩"])' /tmp/live-ids.json
```

Any `expected_activity_id` that is absent from the live registry MUST be substituted with the closest
live equivalent (same semantic role, highest Thompson EV among candidates). The substitution must be
noted in the commit message as: `subst: <original-id> → <live-id> (absent from canary at <date>)`.
Do NOT commit an entry with an ID that does not exist in the live registry — it will produce a
permanent false-negative in `recommend_mrr` since the template will never appear in the recommend pool.

[ ] T0.1 complete

---

## Phase V2.1 — Two-Metric Harness Extension

### T1.1 Extend `BenchmarkEntry` type to include v2 fields

In `validation/scripts/reuse-harness.ts`, extend the `BenchmarkEntry` interface:

```typescript
interface BenchmarkEntry {
  id: string;
  category: string;
  goal_text: string;
  expected_activity_id: string;
  expected_activity_name?: string;   // v2 only
  search_query?: string;             // v2 only — drives GET /templates?q=
  tags?: string[];                   // v2 only — informational
  seed_impulse_pool: string[];
}
```

**Acceptance criteria:**
- Interface compiles without error
- Old v1 entries (missing `search_query`) still load and process without runtime error

[ ] T1.1 complete

### T1.2 Add `SearchResult` type and `apiGet` for templates endpoint

Add a `SearchResult` interface matching the `GET /v2/activities/templates` response shape:

```typescript
interface TemplatesResponse {
  templates?: Recommendation[];   // or top-level array — handle both
  data?: Recommendation[];
}
```

The `GET /v2/activities/templates?q=&limit=20` endpoint returns an array (or object with array).
The harness MUST handle both a bare array response and a `{ templates: [...] }` wrapper.

**Acceptance criteria:**
- `apiGet` used for the GET call (already exists in harness)
- Response unwrapping tested manually against canary before merge

[ ] T1.2 complete

### T1.3 Add `EntryResultV2` type and search evaluation pass

Extend `EntryResult` to `EntryResultV2`:

```typescript
interface EntryResultV2 {
  id: string;
  category: string;
  // recommend pass (existing)
  rank: number;
  rr: number;
  found: boolean;
  // search pass (new)
  search_rank: number;
  search_rr: number;
  search_found: boolean;
  // quadrant
  diagnostic: "A" | "B" | "C" | "D" | null;
  // metadata
  goal_text?: string;
  expected_activity_id?: string;
}
```

Quadrant assignment logic:
```
if (search_found && found)       → "A"
if (search_found && !found)      → "B"
if (!search_found && found)      → "C"
if (!search_found && !found)     → "D"
if (!entry.search_query)         → null
```

**Acceptance criteria:**
- `evaluateBenchmark` returns `EntryResultV2[]` when benchmark has `search_query` fields
- Returns backward-compatible `EntryResult[]` (with `search_rank=0, search_found=false, diagnostic=null`)
  when benchmark lacks `search_query` fields
- `diagnostic` field is present in all v2 entries

[ ] T1.3 complete

### T1.4 Extend `ReuseReport` to `ReuseReportV2`

```typescript
interface ReuseReportV2 {
  run_at: string;
  label: string;
  benchmark_file: string;
  // existing fields preserved for backward compat
  mrr: number;
  hit_at_1: number;
  hit_at_3: number;
  hit_at_5: number;
  // renamed aliases
  recommend_mrr: number;
  recommend_hit_at_1: number;
  recommend_hit_at_3: number;
  recommend_hit_at_5: number;
  // new search metrics (present only when v2 benchmark loaded)
  search_mrr?: number;
  search_hit_at_1?: number;
  search_hit_at_3?: number;
  search_hit_at_5?: number;
  quadrant_counts?: { A: number; B: number; C: number; D: number };
  entries: EntryResultV2[];
  thompson_snapshot: ThompsonEntry[];
  trace_stats: TraceStats;
}
```

`mrr` === `recommend_mrr` (same value, two keys). Both written to report for backward compat with
`compare-reports.ts`.

**Acceptance criteria:**
- Report JSON contains both `mrr` and `recommend_mrr` with the same value
- `search_mrr` is only present when a v2 benchmark was loaded
- `quadrant_counts` is only present when a v2 benchmark was loaded

[ ] T1.4 complete

### T1.5 Add `--benchmark` CLI flag

```
bun run validation/scripts/reuse-harness.ts \
  --benchmark validation/activity-reuse-benchmark-v2.json \
  --label weekly-v2 \
  --limit 20
```

**Acceptance criteria:**
- `--benchmark <path>` flag accepted; resolves relative to repo root (same logic as existing
  `benchmarkPath` calculation)
- Default behaviour unchanged (uses `activity-reuse-benchmark.json` when flag absent)
- Help/error message mentions `--benchmark` flag

[ ] T1.5 complete

### T1.6 Extend `printSummary` with two-metric block and quadrant table

When `search_mrr` is present in the report, the printed summary SHALL include:

```
Search vs Recommend Metrics:
  search_mrr    : 0.4200 (+N pp vs baseline)
  recommend_mrr : 0.2500 (+N pp vs baseline)

Retrieval/Ranking Quadrants:
  A (both found)        : N entries — working end-to-end
  B (Thompson burial)   : N entries — FTS found it but Thompson buried it
  C (lucky sample)      : N entries — Thompson found it but FTS missed it
  D (both missed)       : N entries — retrieval miss
```

**Acceptance criteria:**
- Block appears only when v2 benchmark is active
- Quadrant B entries are listed by name to aid operator diagnosis
- Existing summary layout unchanged when v1 benchmark is active

[ ] T1.6 complete

### T1.7 Extend `compare-reports.ts` with search_mrr delta

When both reports have `search_mrr`, add a section to the comparison output:

```
## Retrieval vs Ranking Split

| metric         | prior  | current | delta |
|----------------|--------|---------|-------|
| search_mrr     | 0.NN   | 0.NN    | ±Npp  |
| recommend_mrr  | 0.NN   | 0.NN    | ±Npp  |

Thompson burial (B) entries: N → N
Retrieval miss (D) entries:  N → N
```

**Acceptance criteria:**
- Section appears only when both reports have `search_mrr`
- Regression in `search_mrr` by >0.05 prints a WARNING line
- Existing delta table output unchanged

[ ] T1.7 complete

### T1.8 End-to-end smoke test: run harness against canary with v2 benchmark

**Acceptance criteria:**
- `bun run validation/scripts/reuse-harness.ts --benchmark validation/activity-reuse-benchmark-v2.json`
  exits 0 against canary
- Report written to `validation/results/<date>-reuse-report.json`
- `search_mrr` and `recommend_mrr` both present and > 0 for at least 2 entries
- `quadrant_counts` is non-empty
- API calls used ≤ 100

[ ] T1.8 complete

---

## Phase V2.2 — Composition-Chain Credit Integration Test (18.4.7)

### T2.1 Create `validation/scripts/test-18-4-7-credit-propagation.ts`

Implement the 7-step procedure described in `design.md §V2.2`. Key constraints:

- The script MUST read `METABOB_ENDPOINT` and `METABOB_API_KEY` from environment (same as harness)
- The script MUST use `activity:improvise` as the leaf (it exists and has non-trivial history)
- The `composition_chain` MUST contain `["activity:goal-processing-activity-driven", "activity:⟨slot-binding⟩"]`
  (depth-2 ancestor gets α += γ^2 = 0.25; depth-1 gets α += γ^1 = 0.5)
- The assertion threshold is `new_alpha - old_alpha >= 0.2` (tolerates rounding)
- If `propagateCreditAlongChain` is not wired at the trace write path, the test MUST print:
  `FAIL: α did not change. Possible causes: (1) propagateCreditAlongChain not wired at execution-traces
  write path, (2) posterior update is async and 2s was insufficient, (3) goal-processing-activity-driven
  variant not in variant_performance_metrics. Trace ID: <id>`
- **α readback**: use `POST /v2/activities/recommend` (up to 5 broad queries, same as harness snapshot)
  to read `selection_metadata.alpha` for `goal-processing-activity-driven`. If the template is NOT
  in the top-50 recommend results after all 5 queries, the test MUST exit with code 2 and print:
  `INCONCLUSIVE: cannot read live posterior — template not in top-50 recommend results. Posterior
  update may have occurred but cannot be verified. Trace ID: <id>`. Do NOT fall back to
  `GET /templates?q=` — that value is always 1 (the activity-table prior) and causes false passes.
  Exit codes: 0 = pass, 1 = fail, 2 = inconclusive.
- Script exits 0 on pass, exits 1 on fail, exits 2 on inconclusive (cannot read posterior)
- Trace recorded with `goal: "integration test 18.4.7 — credit propagation verification"` for cleanup

**Acceptance criteria:**
- Script exists and typechecks (`bun run --hot` without error)
- Script exits 0 against canary (requires 18.4 code to be deployed and template in top-50 recommend)
- If run against a backend without credit propagation, script exits 1 with diagnostic
- If the template cannot be found in top-50 recommend results, script exits 2 (INCONCLUSIVE) with a
  diagnostic that includes the trace ID — not exit 1 (fail) and not exit 0 (pass)

[ ] T2.1 complete

### T2.2 Document the test in `validation/README.md`

Add a section `### 18.4.7 Credit Propagation Integration Test` explaining:
- Purpose: verify `propagateCreditAlongChain` is live in the backend
- How to run: `bun run validation/scripts/test-18-4-7-credit-propagation.ts`
- Expected output on pass
- Expected output on fail and likely causes
- Note: leaves a real trace in production; trace can be identified by the `goal` field

**Acceptance criteria:**
- Section added to `validation/README.md`
- Running the command as documented produces the described output

[ ] T2.2 complete

---

## Phase V2.3 — Weekly CI Integration (18.2.9)

### T3.1 Create `validation/scripts/run-weekly-harness.sh`

Implement the shell wrapper described in `design.md §V2.3`. Additional requirements:

- The script MUST fail loudly if `METABOB_API_KEY` is not set
- The script MUST fail loudly if `bun` is not on `$PATH`
- The MRR regression check MUST use `bc` for float comparison; document dependency in a comment
- The script MUST be `chmod +x` in the commit
- **BENCHMARK path fix**: The script lives at `validation/scripts/run-weekly-harness.sh`. The
  benchmark file is at `validation/activity-reuse-benchmark-v2.json` (one level up from `scripts/`).
  The correct relative path is `"$(dirname "$0")/../activity-reuse-benchmark-v2.json"` — NOT
  `"$(dirname "$0")/../../validation/activity-reuse-benchmark-v2.json"` (two levels up would reach
  the repo root, skipping the `validation/` directory component). Verify with:
  `bash -x validation/scripts/run-weekly-harness.sh 2>&1 | grep BENCHMARK`

**Acceptance criteria:**
- `bash validation/scripts/run-weekly-harness.sh` runs and exits 0 when no prior report exists
- When current MRR < prior MRR * 0.9, script exits non-zero and prints a clear regression message
- When current MRR ≥ prior MRR * 0.9, script exits 0
- Script runs end-to-end in < 5 minutes on the canary endpoint

[ ] T3.1 complete

### T3.2 Create `.github/workflows/weekly-recommendation-validation.yml`

Implement the GitHub Actions workflow described in `design.md §V2.3`. Additional requirements:

- The `bun install` step MUST use `--frozen-lockfile` to prevent CI from updating `bun.lockb`
- The workflow MUST upload the report as an artifact regardless of pass/fail (`if: always()`)
- The workflow MUST have a `workflow_dispatch` trigger so it can be run manually
- The cron schedule is `'0 9 * * 1'` (Monday 09:00 UTC)
- The secret name is `METABOB_API_KEY_VALIDATION` (not `METABOB_API_KEY` to avoid collisions)

**Acceptance criteria:**
- Workflow file parses correctly (`gh workflow list` shows it after merge to `dev`)
- Manual trigger via `gh workflow run weekly-recommendation-validation.yml` completes in < 15 minutes
- Report artifact present in workflow run after completion
- If harness exits non-zero (MRR regression), workflow run shows as failed

[ ] T3.2 complete

### T3.3 Add `METABOB_API_KEY_VALIDATION` to repo secrets documentation

In `repos/deployment/DEPLOYMENT_WORKFLOW.md` or equivalent operator runbook, add a section:

```
## GitHub Secrets for CI

| Secret name                 | Purpose                                  | Rotation                |
|-----------------------------|------------------------------------------|-------------------------|
| METABOB_API_KEY_VALIDATION  | Read/write API key for canary org used   | When key expires or is  |
|                             | by weekly recommendation validation CI  | compromised             |
```

Document how to rotate: issue a new key via identity-vessel, update the GitHub secret via
`gh secret set METABOB_API_KEY_VALIDATION`.

**Acceptance criteria:**
- Documentation section added
- An operator following the docs can provision the secret without additional context

[ ] T3.3 complete

---

## Phase V2.4 — Behavioral Validation

All tasks in this phase extend `reuse-harness.ts` and `compare-reports.ts`. They do not require new
scripts. They share the same 200-trace window already fetched by `captureTraceStats()` and the same
Thompson snapshot already fetched by `captureThompsonSnapshot()`, minimising extra API calls.

The data constraint in BV-3 is important: the list endpoint does NOT return `tasks[].resolver_tier`.
Tasks T4.1–T4.3 are designed to work within this constraint.

---

### T4.1 — Add `ImproveseHealth` interface and improvise health computation

**Location:** `validation/scripts/reuse-harness.ts`

Add interface:
```typescript
interface ImproveseHealth {
  count: number;
  success_rate: number | null;      // null when count == 0
  ribosome_activation_rate: number | null;  // null when no successful improvise traces
  window_traces: number;
}
```

Extend `captureTraceStats()` (or add a sibling `computeImproveseHealth()`) to:
1. From the 200-trace window already fetched, filter traces where `activity_id` contains "improvise"
   (case-insensitive).
2. Compute `success_rate = succeeded / count` (use `trace.success === true` for success check).
3. Identify successful improvise traces. For each (up to 5 sampled, to limit API calls):
   a. Scan the 200-trace window for any trace where `activity_id` OR `activity_name` contains
      "ribosome" OR "extract" AND (`composition_chain` contains the improvise trace's id OR
      `parent_execution_id` matches the improvise trace's execution_id).
   b. If not found in window: call `GET /v2/activities/execution-traces?parent_execution_id=<id>`
      and check the result for ribosome/extract traces.
4. `ribosome_activation_rate = ribosome_found_count / successful_improvise_count`

Add to `ReuseReportV2`:
```typescript
improvise_health: ImproveseHealth;
```

**Acceptance criteria:**
- Harness emits `improvise_health` block in JSON report
- `success_rate` is a float 0–1 when `count > 0`, or `null` when `count == 0`
- Ribosome check makes at most 5 extra API calls (one per sampled successful improvise trace)
- When the 200-trace window contains no ribosome traces, the API fallback fires (up to 5 calls)

[ ] T4.1 complete

---

### T4.2 — Add `ResolverCoverage` interface and resolver tier sampling

**Location:** `validation/scripts/reuse-harness.ts`

Add interface:
```typescript
interface ResolverCoverage {
  traces_sampled: number;
  total_tasks_sampled: number;
  deterministic_rate: number;
  pattern_rate: number;
  llm_tier_rate: number;
  unknown_rate: number;
  top_resolvers: Array<[string, number]>;  // [resolver_id, count], top-10
}
```

Add `captureResolverCoverage()` function:
1. From the 200-trace list, select up to 10 traces where `task_count > 0`, ordered by recency.
   Use `trace.execution_id` or `trace.id` (strip table prefix) to build the fetch URL.
2. For each, fetch `GET /v2/activities/execution-traces/<id>` and extract `tasks[]`.
3. For each task in each full trace, read `resolver_tier` and `resolver_id`.
   Bucket `resolver_tier` as: `"deterministic"`, `"pattern"`, `"llm"`, or `"unknown"` (null/missing).
4. Compute rates over all sampled tasks.
5. Top-10 `resolver_id` by frequency.

Add to `ReuseReportV2`:
```typescript
resolver_coverage?: ResolverCoverage;   // undefined when no traces have task_count > 0
```

**Acceptance criteria:**
- Harness emits `resolver_coverage` block when at least 1 trace has `task_count > 0`
- `llm_tier_rate + deterministic_rate + pattern_rate + unknown_rate ≈ 1.0` (within float rounding)
- `top_resolvers` is sorted descending by count
- Costs at most 10 extra API calls (one per sampled trace)
- Does NOT add calls when `task_count == 0` for all traces in the window

[ ] T4.2 complete

---

### T4.3 — Add `ReuseTrajectory` interface and extend trace_stats

**Location:** `validation/scripts/reuse-harness.ts`

Add interface:
```typescript
interface ReuseTrajectory {
  improvise_share: number;
  reuse_rate: number;
  composition_depth_distribution: { "0": number; "1": number; "2": number; "3+": number };
  mean_composition_depth: number;
  window_traces: number;
}
```

Extend `captureTraceStats()` to also compute `ReuseTrajectory` from the same 200-trace window:
1. `improvise_share` = already computed as `improvise_rate`.
2. `thompson_ids` = Set of `activity_id` from the Thompson snapshot (already fetched).
3. For each trace: `is_reuse = !is_improvise && thompson_ids.has(trace.activity_id)`.
4. `reuse_rate = reuse_count / total`.
5. `chain_depth` = `Array.isArray(trace.composition_chain) ? trace.composition_chain.length : 0`.
6. Build `composition_depth_distribution` and `mean_composition_depth`.

Add to `ReuseReportV2`:
```typescript
reuse_trajectory: ReuseTrajectory;
```

Note: `thompson_ids` is only available after `captureThompsonSnapshot()` runs. The harness MUST
call Thompson snapshot before trace stats (already the case in current `main()` ordering: step 2
before step 3), or pass `thompsonSnapshot` as a parameter to the trace stats function.

**Acceptance criteria:**
- Harness emits `reuse_trajectory` block
- `reuse_rate` is defined as (traces with `activity_id` in Thompson snapshot AND not improvise) / total;
  NOT as `1 - improvise_share`
- `composition_depth_distribution` sums to `window_traces`
- Does NOT add API calls (uses already-fetched 200-trace window and Thompson snapshot)

[ ] T4.3 complete

---

### T4.4 — Add recommendation executability check (`--detailed` flag)

**Location:** `validation/scripts/reuse-harness.ts`

Add interface:
```typescript
interface ExecutabilityReport {
  mean_ev: number;
  mean_score: number;
  pct_with_output_shapes?: number;   // only when --detailed
  pct_with_deterministic_task?: number;  // only when --detailed
  detailed: boolean;
}
```

Extend `main()` to accept `--detailed` flag. When present:
1. After the recommend pass, collect the top recommendation per entry (already in `entryResults`).
2. For entries where `search_found=true`, the template is already in the search result set — reuse
   it directly (no extra API call). For others, fetch `GET /v2/activities/templates/<id>` (one call
   per entry, max 20 total, but skip when `selection_metadata` is absent).
3. From each template: `has_output_shapes = output_shapes?.length > 0`,
   `has_det_task = tasks?.some(t => t.resolver && t.resolver !== "llm")`.
4. `executability_score = ev * 0.5 + (has_output_shapes ? 0.3 : 0) + (has_det_task ? 0.2 : 0)`
5. In default mode (no `--detailed`): compute only `ev` from `selection_metadata.alpha/beta`; set
   `executability_score = ev * 0.5`. `pct_with_output_shapes` and `pct_with_deterministic_task`
   are omitted.

Add to `ReuseReportV2`:
```typescript
executability?: ExecutabilityReport;  // undefined when no entries have recommendations
```

**Acceptance criteria:**
- Only runs when `--detailed` flag is present
- Adds at most 20 extra API calls (one per benchmark entry not already in search results)
- Emits `executability.mean_score` and `executability.pct_with_output_shapes` (when detailed)
- Default mode (no flag): emits `executability.mean_ev` and `executability.detailed: false`

[ ] T4.4 complete

---

### T4.5 — Extend `printSummary` with behavioral health block

**Location:** `validation/scripts/reuse-harness.ts`

Extend `printSummary()` to render a behavioral section after the trace stats block. The block MUST
always render when the data is present (not gated on `--detailed`):

```
Behavioral Health:
  improvise_health:
    success_rate       : 0.NN  (N successful / N total improvise traces)
    ribosome_rate      : 0.NN  (ribosome activated for N/M successful improvise)
  resolver_coverage:
    llm_tier_rate      : 0.NN  ← want this declining
    deterministic_rate : 0.NN
    top_resolvers      : bash(N), llm(N), git(N), ...
    (sampled N tasks from N traces)
  reuse_trajectory:
    reuse_rate         : 0.NN  ← want this increasing
    improvise_share    : 0.NN  ← want this declining
    mean_depth         : N.N   ← want this increasing
    composition depth  : 0→N  1→N  2→N  3+→N
```

When a metric is null (e.g. `improvise_health.success_rate` when no improvise traces observed):
print `null (no improvise traces in window)` rather than `0.0000`.

When `resolver_coverage` is undefined (no traces with tasks): print
`resolver_coverage: N/A (no traces with tasks in window)`.

**Acceptance criteria:**
- Block appears in all harness runs (v1 and v2 benchmark)
- Null fields print the explanatory string, not `0.0000`
- No layout regression on the existing metrics block above it

[ ] T4.5 complete

---

### T4.6 — Extend `compare-reports.ts` with behavioral deltas

**Location:** `validation/scripts/compare-reports.ts`

When both reports have `improvise_health`, `resolver_coverage`, and `reuse_trajectory`:
add a `## Behavioral Health Δ` section to the comparison output:

```
## Behavioral Health Δ

| metric                              | prior  | current | delta      | direction  |
|-------------------------------------|--------|---------|------------|------------|
| improvise_health.success_rate       | 0.NN   | 0.NN    | ±Npp       |            |
| improvise_health.ribosome_rate      | 0.NN   | 0.NN    | ±Npp       |            |
| resolver_coverage.llm_tier_rate     | 0.NN   | 0.NN    | ±Npp       | ↓ is good  |
| reuse_trajectory.reuse_rate         | 0.NN   | 0.NN    | ±Npp       | ↑ is good  |
| reuse_trajectory.mean_depth         | N.N    | N.N     | ±N.N       | ↑ is good  |
```

When `llm_tier_rate` increases by more than 5pp OR `reuse_rate` decreases by more than 5pp,
print a WARNING line:
```
WARNING: resolver_coverage.llm_tier_rate increased by Npp — check slot-binding layer health
WARNING: reuse_trajectory.reuse_rate decreased by Npp — improvise share may be growing
```

These WARNINGs are advisory; they do not cause the script to exit non-zero.

When either report is missing `resolver_coverage` or `reuse_trajectory`, omit the section entirely
(backward compatible with reports from before V2.4).

**Acceptance criteria:**
- Section emitted when both reports have behavioral fields
- Section omitted (no error) when either report predates V2.4
- `llm_tier_rate` increase >5pp prints WARNING to stderr
- `reuse_rate` decrease >5pp prints WARNING to stderr
- Existing delta table output unchanged

[ ] T4.6 complete

---

### T4.7 — Update stop conditions

Add the following to the Phase V2 stop conditions block:

- [ ] `improvise_health.success_rate` ≥ 0.70 across two consecutive weekly harness runs
      (or `null` with a note that no improvise was observed — absence of improvise is also a pass)
- [ ] `resolver_coverage.llm_tier_rate` ≤ 0.60 AND showing a non-increasing trend in two consecutive
      `compare-reports.ts` runs (delta ≤ 0)
- [ ] `reuse_trajectory.reuse_rate` ≥ 0.65 in at least one weekly run within 8 weeks of Phase 18 deploy

These are longitudinal stop conditions — they are not met by a single run, and they do not block
V2.0–V2.3 completion. They run in parallel with the weekly CI workflow established in V2.3.

[ ] T4.7 complete

---

## Stop Conditions

Phase V2 is complete when:

- [ ] `validation/activity-reuse-benchmark-v2.json` committed with all 20 entries verified against canary
- [ ] `reuse-harness.ts` emits `search_mrr` and `recommend_mrr` separately when v2 benchmark is used
- [ ] First v2 harness run against canary committed to `validation/results/`
- [ ] `test-18-4-7-credit-propagation.ts` exits 0 against canary
- [ ] `run-weekly-harness.sh` runs end-to-end
- [ ] `.github/workflows/weekly-recommendation-validation.yml` merged and first CI run completes

**Target metrics at V2 completion:**
- `recommend_mrr` ≥ 0.30 on v2 benchmark (conservative; pool-anchored entries should be easier to find)
- `search_mrr` ≥ 0.50 on v2 benchmark (FTS should recall canonical templates well)
- Thompson burial (B) entries ≤ 5 of 20 (most entries should reach top-20 via both paths)

**Behavioral stop conditions (longitudinal — V2.4):**
- `improvise_health.success_rate` ≥ 0.70 across two consecutive weekly runs (or null/no improvise observed)
- `resolver_coverage.llm_tier_rate` ≤ 0.60 and non-increasing trend in compare-reports delta
- `reuse_trajectory.reuse_rate` ≥ 0.65 within 8 weeks of Phase 18 deploy
