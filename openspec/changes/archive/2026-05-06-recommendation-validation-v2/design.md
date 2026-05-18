# Design: Recommendation Validation v2

## Context

Phase 18 shipped: tags FTS index (migrations 126/127), failure-mode-stratified posterior updates
(`posterior-update.ts`), composition-chain credit propagation (`propagateCreditAlongChain`, γ=0.5,
depth 4), dense search re-enabled (MiniLM INT8, O(n) cosine scan).

Current harness baseline: MRR=0.1542, Hit@1=10%, Hit@3=20%, Hit@5=25%
(file: `validation/results/2026-05-13-post-g5-backfill-reuse-report.json`).

Root cause of low numbers: benchmark IDs are all in the double-prefix wrapped namespace
(`activity:⟨…⟩`); the Thompson recommend pool favours templates with meaningful execution histories
(e.g. `activity:⟨validator-dispatch⟩` with 2941 executions, `activity:_goal_resolve` with 146,
`activity:⟨core-activity-audit⟩` with 19) which use the canonical `activity:<slug>` form.

---

## V2.0 — Benchmark Design

### Entry schema (v2)

```typescript
interface BenchmarkEntryV2 {
  id: string;                      // "v2-bench-001"
  category: "bug-fix" | "feature-add" | "refactor" | "docs" | "meta" | "infrastructure";
  goal_text: string;               // natural-language goal for POST /recommend
  expected_activity_id: string;    // canonical ID from Thompson snapshot (no double-prefix)
  expected_activity_name: string;  // template name (for fuzzy fallback matching)
  search_query: string;            // short term(s) for GET /templates?q= (exercises tags + name)
  tags: string[];                  // tags the template should have that search_query exercises
  seed_impulse_pool: string[];     // [] for all v2 entries (no impulse seeding yet)
}
```

### Selection criteria for templates

A template is eligible for the v2 benchmark if:
1. Its ID appears in `validation/baselines/2026-05-09-thompson.json` (captured from live canary)
2. Its ID does NOT contain a double-prefix (`activity:⟨activity:⟨…⟩⟩`)
3. `total_executions > 0` OR the template has a well-defined semantic role in the system
   (meta-activities with 0 executions are included if they have stable names and tags)
4. The template name/description is rich enough to write a distinguishing `goal_text`

### 20 benchmark entries

The following entries are derived from the Thompson snapshot (2026-05-09). IDs are as captured;
verify against live canary before finalising.

| id | expected_activity_id | expected_activity_name | category |
|----|---------------------|----------------------|----------|
| v2-bench-001 | `activity:⟨validator-dispatch⟩` | Validator Dispatch | meta |
| v2-bench-002 | `activity:_goal_resolve` | Goal Resolve | infrastructure |
| v2-bench-003 | `activity:⟨core-activity-audit⟩` | Core Activity Audit | meta |
| v2-bench-004 | `activity:⟨Lifecycle and Learning Loop Verification⟩` | Lifecycle and Learning Loop Verification | infrastructure |
| v2-bench-005 | `activity:⟨startup:health-check⟩` | Startup Health Check | infrastructure |
| v2-bench-006 | `activity:improvise` | Improvise (broad-tool fallback) | meta |
| v2-bench-007 | `activity:⟨spec-to-enforcement-activity⟩` | Spec to Enforcement Activity | meta |
| v2-bench-008 | `activity:⟨make-activity⟩` | Make Activity (meta-activity-builder) | meta |
| v2-bench-009 | `activity:⟨ribosome-extract⟩` | Ribosome Extract | meta |
| v2-bench-010 | `activity:⟨slot-binding⟩` | Slot Binding | meta |
| v2-bench-011 | `activity:⟨System Lifecycle and Learning Loop Verification⟩` | System Lifecycle and Learning Loop Verification | infrastructure |
| v2-bench-012 | `activity:⟨Complete Activity Improvement Cycle⟩` | Complete Activity Improvement Cycle | infrastructure |
| v2-bench-013 | `activity:⟨Activity Improvement Loop⟩` | Activity Improvement Loop | meta |
| v2-bench-014 | `activity:⟨enforcement-to-validation-activity⟩` | Enforcement to Validation Activity | meta |
| v2-bench-015 | `activity:⟨interactive-activity-selector⟩` | Interactive Activity Selector | tool |
| v2-bench-016 | `activity:⟨replace-activity⟩` | Replace Activity (registry-quality) | meta |
| v2-bench-017 | `activity:⟨prune-activity⟩` | Prune Activity (registry-quality) | meta |
| v2-bench-018 | `activity:⟨map-components-to-validations⟩` | Map Components to Validations | infrastructure |
| v2-bench-019 | `activity:⟨spec-validation-loop⟩` | Spec Validation Loop | infrastructure |
| v2-bench-020 | `activity:⟨audit-and-backfill-templates⟩` | Audit and Backfill Template Semantic Markers | meta |

Full entry objects (with `goal_text`, `search_query`, `tags`) specified in `tasks.md` V2.0 task T0.1.
The implementor writes these out from the template names and categories above.

### Writing `goal_text` and `search_query`

`goal_text` (used for `POST /recommend`):
- Written as a natural-language development goal that a human would type
- Must NOT include the template name verbatim (avoids trivial exact-match cheating)
- Must describe the *purpose* of the activity (what problem it solves)
- 1–2 sentences; ≤ 120 characters

`search_query` (used for `GET /templates?q=`):
- Shorter than `goal_text`; typically 2–5 words
- Should exercise tags-index terms that distinguish this template from similar ones
- Examples: `"validator dispatch meta"`, `"health check startup"`, `"slot binding impulse"`

`tags` field in the entry records what tags the search_query expects the template to have so that
FTS tag scoring (`search::score(2) * 1.5`) would surface it. These are informational for harness
diagnostics; the harness does not assert on them.

---

## V2.1 — Two-Metric Harness Extension

### Motivation

`POST /v2/activities/recommend` = FTS retrieval + dense retrieval + Thompson ranking.
`GET /v2/activities/templates?q=` = FTS retrieval only (no Thompson).

By running both per entry we get a 2×2 diagnostic table:

```
                    recommend: found | recommend: not found
search: found            A (working)      B (Thompson burial)
search: not found        C (lucky sample) D (retrieval miss)
```

- **A**: System works end-to-end.
- **B**: FTS retrieves the template but Thompson ranking buries it (low α/β, few executions).
  Action: submit a synthetic success trace to warm the posterior.
- **C**: Recommend found it through dense search or Thompson noise; FTS can't find it.
  Action: improve tags/description on the template.
- **D**: Neither retrieval path finds it. Action: fix FTS terms or dense embedding.

### API calls per entry

```
# search pass
GET /v2/activities/templates?q={entry.search_query}&limit=20
Authorization: ApiKey {apiKey}

# recommend pass (unchanged from current harness)
POST /v2/activities/recommend
{ "task_description": entry.goal_text, "limit": 20 }
```

### ID extraction from `GET /templates`

The templates endpoint returns an array of template objects. The harness MUST extract the canonical ID
using the same `recId()` precedence already in the harness (`id ?? template_id ?? activity_id`).

The `expected_activity_id` in v2 entries uses the actual canonical IDs from the Thompson snapshot, so
exact string match is correct (no normalisation required). A secondary fuzzy match on
`expected_activity_name` is permitted as a fallback for rank reporting only (not for MRR calculation).

### Output report schema extension

Existing `ReuseReport` fields are preserved. Add:

```typescript
interface EntryResultV2 extends EntryResult {
  search_rank: number;          // rank in FTS-only results (0 = not found)
  search_rr: number;            // 1/search_rank or 0
  search_found: boolean;
  diagnostic: "A" | "B" | "C" | "D" | null;  // null if entry has no expected_activity_id
}

interface ReuseReportV2 extends ReuseReport {
  benchmark_file: string;       // "activity-reuse-benchmark-v2.json" or "activity-reuse-benchmark.json"
  search_mrr: number;
  search_hit_at_1: number;
  search_hit_at_3: number;
  search_hit_at_5: number;
  recommend_mrr: number;        // alias for existing mrr (renamed for clarity)
  recommend_hit_at_1: number;   // alias for hit_at_1
  recommend_hit_at_3: number;
  recommend_hit_at_5: number;
  quadrant_counts: { A: number; B: number; C: number; D: number };
  entries: EntryResultV2[];
}
```

Existing `mrr`, `hit_at_1`, `hit_at_3`, `hit_at_5` fields are kept with their values set to
`recommend_mrr` / `recommend_hit_at_k` for backward compatibility with `compare-reports.ts`.

### Benchmark file selection

The harness MUST accept `--benchmark <path>` flag. Default remains
`validation/activity-reuse-benchmark.json` (v1) for backward compatibility. Pass
`--benchmark validation/activity-reuse-benchmark-v2.json` to use v2.

When a v2 benchmark is loaded (detected by presence of `search_query` field on first entry), the
harness activates the two-metric path. When a v1 benchmark is loaded, `search_mrr` is omitted from the
report and the quadrant table is not computed.

### API call budget

Each entry now costs 2 API calls (1 search + 1 recommend). With 20 entries plus 5 Thompson snapshot
queries and 1 trace stats query: max 46 calls, within the existing 100-call budget.

### Summary table extension

The printed summary adds a quadrant block below the metric block:

```
Retrieval/Ranking Quadrants:
  A (both found)       : N
  B (Thompson burial)  : N  ← search found it, recommend didn't
  C (lucky sample)     : N  ← recommend found it, search didn't
  D (both missed)      : N
```

---

## V2.2 — Composition-Chain Credit Integration Test (18.4.7)

### What the test validates

`propagateCreditAlongChain` reads `execution.composition_chain` (root-first ordered list of ancestor
activity IDs) and writes discounted α/β increments to each ancestor's `variant_performance_metrics` row.
For a success with chain `["A", "B"]` and γ=0.5:
- B (depth 1, direct parent) receives α += 0.5
- A (depth 2, grandparent) receives α += 0.25

The test verifies this is happening in the live canary backend.

### Test procedure

`validation/scripts/test-18-4-7-credit-propagation.ts`

```
Step 1. Read current α for goal-processing-activity-driven.
  GET /v2/activities/templates?q=goal+processing
  Extract the entry whose id contains "goal-processing-activity-driven".
  Record old_alpha = entry.thompson_alpha (or from variant_performance_metrics if available).
  If template not found, probe with POST /recommend task_description="process a development goal".

Step 2. Read current α for a mid-chain template (e.g. activity-recommendation or slot-binding).
  Record old_alpha_mid.

Step 3. Submit a synthetic execution trace with composition_chain.
  POST /v2/activities/execution-traces
  Body:
    activity_id: "activity:improvise"          -- leaf; must exist in registry
    activity_name: "Improvise (broad-tool fallback)"
    success: true
    failure_mode: null
    composition_chain: [
      "activity:goal-processing-activity-driven",
      "activity:⟨slot-binding⟩"
    ]
    vessel_id: "test-credit-propagation-harness"
    vessel_version: "0.0.1-test"
    tasks: []
    org_id: <inferred from API key>
    created_at: <now ISO>
    duration_ms: 100
    goal: "integration test 18.4.7 — credit propagation verification"

Step 4. Wait 2000ms for async posterior update (fire-and-forget pattern).

Step 5. Re-read α for goal-processing-activity-driven.
  new_alpha = same query as Step 1.

Step 6. Assert new_alpha - old_alpha >= 0.2.
  Expected: γ^2 = 0.25, but α is float-incremented; assert ≥ 0.2 to allow for rounding.
  If assertion fails, also print:
    - old_alpha, new_alpha, delta
    - raw response from Step 5 query
    - confirmation the trace was accepted (Step 3 response status)

Step 7. Exit 0 on pass, exit 1 on fail.
```

### Notes on α readback

The Thompson snapshot in `validation/baselines/2026-05-09-thompson.json` shows all templates report
`thompson_alpha=1` from the `activity` table — the actual posteriors are in `variant_performance_metrics`.
The GET /templates endpoint may not return the variant-level α. The test MUST use
`POST /v2/activities/recommend` with a targeted `task_description` and read
`selection_metadata.alpha` from the matching recommendation to get the live posterior.
If the template is not in the recommend top-50 (five broad queries, same as the harness snapshot
approach), the test MUST exit with code 2 and print:
`INCONCLUSIVE: cannot read live posterior for goal-processing-activity-driven — template not in top-50
recommend results. Ensure the template has non-trivial execution history in the canary backend before
running this test. Trace submitted (ID: <id>); posterior update may have occurred but cannot be verified.`
Exit code 2 is distinct from fail (exit 1) and pass (exit 0) so CI can report it as a separate state
rather than a false pass. Do NOT fall back to `GET /templates?q=` α readback — that value is always 1
(the activity-table prior) and would make the assertion trivially pass regardless of whether credit
propagation fired.

### Rollback / cleanup

The synthetic trace is a real write to production. The test SHOULD record the trace ID from the
Step 3 response and log it for manual cleanup if needed. The test MUST NOT delete the trace (no
admin scope). It MUST include `"goal": "integration test 18.4.7 — credit propagation verification"`
so operators can identify and prune it later.

---

## V2.3 — Weekly CI Integration

### Shell wrapper: `validation/scripts/run-weekly-harness.sh`

```bash
#!/usr/bin/env bash
# Usage: ./run-weekly-harness.sh [LABEL]
# Reads METABOB_ENDPOINT and METABOB_API_KEY from env.
# Emits report to validation/results/<DATE>-<LABEL>-reuse-report.json.
# Exits non-zero if MRR regressed >10% vs the most recent prior report.

LABEL="${1:-weekly-$(date +%Y%m%d)}"
RESULTS_DIR="$(dirname "$0")/../results"
# Benchmark is at validation/activity-reuse-benchmark-v2.json relative to repo root.
# This script lives at validation/scripts/, so one level up reaches validation/.
BENCHMARK="$(dirname "$0")/../activity-reuse-benchmark-v2.json"

# Run harness
bun run "$(dirname "$0")/reuse-harness.ts" \
  --benchmark "$BENCHMARK" \
  --label "$LABEL" \
  --limit 20

# Find the two most recent reports (current + prior)
REPORTS=($(ls -t "$RESULTS_DIR"/*-reuse-report.json 2>/dev/null | head -2))
if [ "${#REPORTS[@]}" -lt 2 ]; then
  echo "No prior report for comparison — baseline established."
  exit 0
fi

CURRENT="${REPORTS[0]}"
PRIOR="${REPORTS[1]}"

# Compare
bun run "$(dirname "$0")/compare-reports.ts" "$PRIOR" "$CURRENT"

# Extract MRR values and check regression
CURRENT_MRR=$(jq '.recommend_mrr // .mrr' "$CURRENT")
PRIOR_MRR=$(jq '.recommend_mrr // .mrr' "$PRIOR")

# Regression guard: fail if current MRR < prior MRR * 0.9
THRESHOLD=$(echo "$PRIOR_MRR * 0.9" | bc -l)
REGRESSED=$(echo "$CURRENT_MRR < $THRESHOLD" | bc -l)

if [ "$REGRESSED" -eq 1 ]; then
  echo "ERROR: MRR regressed >10% (prior=$PRIOR_MRR, current=$CURRENT_MRR, threshold=$THRESHOLD)"
  exit 1
fi

echo "MRR OK (prior=$PRIOR_MRR, current=$CURRENT_MRR)"
exit 0
```

### GitHub Actions workflow: `.github/workflows/weekly-recommendation-validation.yml`

```yaml
name: Weekly Recommendation Validation

on:
  schedule:
    - cron: '0 9 * * 1'   # Monday 09:00 UTC
  workflow_dispatch:        # allow manual trigger

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run weekly harness
        env:
          METABOB_ENDPOINT: https://activity.metabob.com
          METABOB_API_KEY: ${{ secrets.METABOB_API_KEY_VALIDATION }}
        run: bash validation/scripts/run-weekly-harness.sh "weekly-${{ github.run_id }}"

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: reuse-report-${{ github.run_id }}
          path: validation/results/*-reuse-report.json
          retention-days: 90
```

**Secret required:** `METABOB_API_KEY_VALIDATION` — a `read,write` API key for the canary
organisation. Added to repo secrets by an operator; not committed to the tree.

---

## V2.4 — Behavioral Validation

Behavioral validation answers four questions that MRR measurement cannot: (1) when the system
improvises, does it succeed and recover? (2) is the top recommendation actually runnable? (3) are
registered resolvers being surfaced to the LLM or is the LLM doing everything itself? (4) is reuse
trending up over time?

All four metrics are computed from data the harness already fetches (traces, Thompson snapshot,
recommendation responses) plus at most 5 extra API calls for the ribosome check and up to 20 template
detail fetches behind a `--detailed` flag.

---

### BV-1: Improvise Health

**What we're measuring.** When the system falls back to improvise, does it:
(a) execute successfully (`trace.success = true`)?
(b) trigger ribosome extraction (a child trace with `activity_name` containing "ribosome" or "extract"
    appears in the window linked by `parent_execution_id` or `composition_chain`)?

**Data source.** `GET /v2/activities/execution-traces?limit=200` — already fetched by
`captureTraceStats()`. The list endpoint returns `activity_id`, `activity_name` (when stored at write
time), `success`, `parent_execution_id`, and `composition_chain` in its SELECT projection. Tasks are
NOT included in the list response (only `task_count`); full task arrays require the single-trace
endpoint (`GET /v2/activities/execution-traces/:id`). Improvise identification uses `activity_id`
containing "improvise" (case-insensitive) since `activity_name` is not always populated in the list.

**How to measure.**
```
Filter: traces where activity_id contains "improvise" (case-insensitive)
Metrics:
  improvise_count             = count of improvise traces in 200-trace window
  improvise_success_rate      = succeeded improvise traces / total improvise traces
  ribosome_activation_rate    = count of traces in the 200-trace window where
                                  (activity_id OR activity_name contains "ribosome" OR "extract")
                                  AND (parent_execution_id OR composition_chain overlaps with
                                       any successful improvise trace's id/composition)
                                / count of successful improvise traces
```

**Ribosome check implementation note.** The ribosome (`ribosome-extract`) fires as a
`lifecycle:execution:succeeded` handler. It appears in traces as a sibling or child of the improvise
trace — same `parent_execution_id`, or with the improvise execution's id in its `composition_chain`.
The simplest implementable check: after identifying successful improvise traces, scan the 200-trace
window for any trace whose `activity_id` or `activity_name` contains "ribosome" or "extract" AND
whose `composition_chain` or `parent_execution_id` overlaps with one of the successful improvise
execution IDs. This does NOT require extra API calls if the 200-trace window is large enough to capture
both. If no ribosome trace is found in the window, the harness should check
`GET /v2/activities/execution-traces?parent_execution_id=<improvise_exec_id>` for the top-5
successful improvise traces (max 5 extra API calls total).

**Report shape.**
```json
"improvise_health": {
  "count": 7,
  "success_rate": 0.71,
  "ribosome_activation_rate": 0.43,
  "window_traces": 200
}
```

When `improvise_count` is 0, report `success_rate: null` and `ribosome_activation_rate: null` rather
than 0 to distinguish "no improvise observed" from "improvise always fails".

---

### BV-2: Recommendation Executability

**What we're measuring.** For the top recommendation returned per benchmark entry, is that template
actually executable in production? Three proxies:
1. Thompson expected value (α/(α+β)) — a high EV means the template has succeeded before.
2. `output_shapes` declared — a template with no `output_shapes` cannot participate in shape-driven
   composition and is likely a stub or poorly specified template.
3. At least one non-LLM task — templates composed entirely of `resolver: "llm"` tasks are less reliable
   and more expensive; presence of a deterministic resolver indicates a real executable workflow.

**Data source.** Selection metadata is already in the recommend response (`selection_metadata.alpha`,
`selection_metadata.beta`). `output_shapes` and `tasks[].resolver` require a template detail fetch:
`GET /v2/activities/templates/<id>`. This adds one API call per benchmark entry when `--detailed` is
passed. In default mode, only EV is computed from the already-available `selection_metadata`.

**Implementation note.** The `GET /v2/activities/templates?q=<name>` search endpoint does return
`output_shapes` and `tasks` in its response (the full `ActivityTemplate` shape is returned). The
harness can avoid individual detail fetches by checking if the template was already returned in the
search pass — if `search_found=true`, the template is already in the result set with full fields.
Only templates not found in the search pass require an extra API call when `--detailed` is active.

**How to measure.**
```
For each benchmark entry:
  top_recommendation   = recommendations[0] from the recommend pass
  alpha                = selection_metadata.alpha (from recommend response)
  beta                 = selection_metadata.beta  (from recommend response)
  ev                   = alpha / (alpha + beta)   -- Thompson EV

  When --detailed flag is present:
    template_detail    = GET /v2/activities/templates/<id>   (or from search pass if available)
    has_output_shapes  = template_detail.output_shapes?.length > 0
    has_det_task       = template_detail.tasks?.some(t => t.resolver && t.resolver !== "llm")
    executability_score = ev * 0.5 + (has_output_shapes ? 0.3 : 0) + (has_det_task ? 0.2 : 0)
  
  Default mode (no --detailed):
    executability_score = ev * 0.5   -- partial score only

Aggregate:
  mean_executability_score   : float
  pct_with_output_shapes     : float  (only when --detailed)
  pct_with_deterministic_task: float  (only when --detailed)
```

**Report shape.**
```json
"executability": {
  "mean_ev": 0.72,
  "mean_score": 0.48,
  "pct_with_output_shapes": 0.65,
  "pct_with_deterministic_task": 0.55,
  "detailed": true
}
```

When `--detailed` is not passed, `pct_with_output_shapes` and `pct_with_deterministic_task` are
omitted and `detailed: false`.

---

### BV-3: Resolver Coverage

**What we're measuring.** In recent traces, what fraction of tasks use the LLM resolver vs
deterministic/pattern resolvers? A high `llm_tier_rate` signals either (a) the LLM is genuinely
needed for reasoning-heavy tasks, or (b) registered resolvers are not being surfaced by the
slot-binding layer and the LLM improvises at the task level.

**Critical data constraint.** The `GET /v2/activities/execution-traces?limit=200` list endpoint does
NOT return `tasks[]` or `tasks[].resolver_tier`. The SELECT projection in `execution-traces.ts` omits
the full tasks array (returns only `task_count` via `array::len(tasks ?? [])`) to avoid loading
multi-KB task arrays per row (OOMKill prevention). Resolver tier data is only available on the
single-trace endpoint (`GET /v2/activities/execution-traces/:id`).

**Consequence for implementation.** The harness cannot compute resolver tier distribution from the
200-trace window without N individual trace fetches (prohibitive). Instead, the harness MUST use a
sampling strategy: fetch up to 10 individual traces (those that are successful and have `task_count >
0` from the list response) via `GET /v2/activities/execution-traces/:id`, extract their tasks, and
compute the tier distribution over that sample. This costs at most 10 extra API calls.

When the per-trace `execution_id` or `id` field is available, use `GET /v2/activities/execution-traces/{execution_id}`.

**How to measure.**
```
From the 200-trace list:
  Select up to 10 traces where task_count > 0, ordered by recency.
  For each, fetch the full trace via GET /v2/activities/execution-traces/:id.
  From each full trace, iterate tasks[]:
    Bucket by resolver_tier: "deterministic", "pattern", "llm", "unknown"
    Record resolver_id

Report:
  traces_sampled         : int  (capped at 10)
  total_tasks_sampled    : int
  deterministic_rate     : float  -- resolver_tier="deterministic" / total tasks
  pattern_rate           : float  -- resolver_tier="pattern" / total tasks
  llm_tier_rate          : float  -- resolver_tier="llm" / total tasks
  unknown_rate           : float  -- resolver_tier missing/null/unknown / total tasks
  top_resolvers          : [(resolver_id, count)]  top-10 by count
```

**What this tells us about tool adequacy.** If `llm_tier_rate` is high AND `improvise_rate` is high,
the slot-binding layer is not surfacing registered resolvers. If `llm_tier_rate` is high but
`improvise_rate` is low, the tasks genuinely require LLM reasoning (expected for current complexity).
The `top_resolvers` list shows which resolvers the system actually invokes, surfacing whether
registered deterministic resolvers (bash, git, concept, etc.) are reaching tasks.

**Report shape.**
```json
"resolver_coverage": {
  "traces_sampled": 10,
  "total_tasks_sampled": 43,
  "deterministic_rate": 0.37,
  "pattern_rate": 0.09,
  "llm_tier_rate": 0.49,
  "unknown_rate": 0.05,
  "top_resolvers": [
    ["llm", 21], ["bash", 12], ["git", 5], ["concept", 3], ["validation", 2]
  ]
}
```

---

### BV-4: Reuse Trajectory

**What we're measuring.** Is the system trending toward reuse of known templates rather than
improvisation? Two signals that can be extracted from the 200-trace list (no extra API calls):
1. `improvise_share` — already computed as `improvise_rate` in `trace_stats`.
2. `composition_chain_depth` distribution — deeper chains mean activities are composing rather than
   running standalone; available from `composition_chain` in the list response.
3. `reuse_rate` — fraction of traces where `activity_id` is NOT improvise AND the activity appears in
   the Thompson snapshot (it is a known registered template being reused, not a one-shot).

**Why `reuse_rate` is more precise than `improvise_share`.** `1 - improvise_share` counts anything
that isn't improvise (including lifecycle hooks, unknown templates, test artifacts). `reuse_rate`
counts only traces using templates that appear in the Thompson snapshot (verified to exist in the
registry with a meaningful posterior). This is the signal that matters for loop closure.

**How to measure.**
```
From the 200-trace list + Thompson snapshot (already fetched):
  thompson_ids = Set of activity_ids from thompson_snapshot
  
  For each trace:
    is_improvise    = activity_id contains "improvise"
    is_reuse        = !is_improvise AND activity_id in thompson_ids
    chain_depth     = len(composition_chain) if composition_chain is array, else 0

  improvise_share   = improvise_count / total  (from trace_stats, already computed)
  
  reuse_rate        = count(is_reuse) / total
  
  composition_depth_distribution = {
    "0": count where chain_depth == 0,
    "1": count where chain_depth == 1,
    "2": count where chain_depth == 2,
    "3+": count where chain_depth >= 3
  }
  mean_composition_depth = mean(chain_depth values)
```

**Report shape.**
```json
"reuse_trajectory": {
  "improvise_share": 0.035,
  "reuse_rate": 0.61,
  "composition_depth_distribution": {
    "0": 142, "1": 38, "2": 14, "3+": 6
  },
  "mean_composition_depth": 0.52,
  "window_traces": 200
}
```

---

### V2.4 Summary Table (compare-reports.ts extension)

When both reports have `resolver_coverage` and `reuse_trajectory`, `compare-reports.ts` emits:

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

A regression on `llm_tier_rate` (increase) or `reuse_rate` (decrease) by more than 5pp prints
a WARNING line to stderr. These are advisory; they do not cause CI exit non-zero in V2.4 (behavioral
stop conditions are longitudinal, not per-run gates).

---

## Interaction with Existing Tooling

`compare-reports.ts` (Phase 18.2.6) must be extended to handle the new `search_mrr` and
`recommend_mrr` fields. When both are present it emits an extra section:

```
Retrieval vs Ranking Split:
  search_mrr : <old> → <new>  (+/-N pp)
  recommend_mrr: <old> → <new>  (+/-N pp)
  Thompson burial count (B): <n>
  Retrieval miss count (D): <n>
```

The delta table logic for existing `mrr` is unchanged (backward compat).

---

## Invariants

1. The v2 benchmark is committed at a fixed commit SHA. Running the harness with `--benchmark
   validation/activity-reuse-benchmark-v2.json` produces the same entries on every machine.

2. The v2 entries' `expected_activity_id` values are canonical IDs that exist in the live registry
   at the commit date. If a template is deleted, the entry is removed or updated with a note in
   git history — not silently ignored.

3. `search_mrr` reflects pure retrieval quality (FTS + tag index only). It MUST NOT include
   Thompson sampling or dense search. `GET /v2/activities/templates?q=` is implemented by
   `queryActivitiesByFTS` in `paradigm.ts` which uses BM25 over name, description, and tags fields
   only. The implementor MUST verify this with a canary probe before running the harness: send a
   `GET /v2/activities/templates?q=improvise` and confirm the response does NOT include a
   `fallback_tier` field (which appears only in the `POST /recommend` endpoint when dense search or
   hybrid RRF activates). If `fallback_tier` is present on the templates endpoint, `search_mrr` is
   not pure-FTS and this invariant must be amended before the results are used as a retrieval-quality
   signal.

4. The credit propagation test MUST NOT pass trivially. Before asserting Δα ≥ 0.2, the test MUST
   confirm the trace POST returned 2xx and the `activity_id` in the trace is a real registered
   template. If `propagateCreditAlongChain` is not wired at the trace write path, the test MUST
   fail with a diagnostic, not silently pass.
