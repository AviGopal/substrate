# Post-mode-collapse alignment batch (2026-06-01T23:58Z)

**Context.** Independent verification after commit `7ae71e71` (auto-draft trigger
now authors a purpose-built template AND uses it for the original dispatch).
Previous batch (2026-06-01T22:19Z) found mode-collapse to
`fm-43-cascade-attribution-error`. This batch checks whether each successful
operational goal lands on a uniquely-authored template whose name reflects the
goal text.

**Method.** 8 goals dispatched **in parallel** to `POST /run-goal`, polled every
5s up to 14 polls. Traces fetched from `/v2/activities/execution-traces/<id>`.
Template metadata (`name`, `description`, `proposed`) read from SurrealDB
`activity` table.

## Aggregate table

| # | Goal | Dispatch ID | Selected template name | Duration (ms) | Tasks | Output shapes | INTENT ALIGNMENT |
|---|------|-------------|------------------------|---------------|-------|---------------|------------------|
| G1 | surface trace shape entropy across the last 24 hours | 36c265f1 | Analyze substrate vessel memory footprint gap | 10451 | 4 | fs_read, http_fetch, llm_completion_dispatch, fs_write | **NO** |
| G2 | report the distribution of resolver tiers in successful executions | 6a05d3fb | Report resolver tier distribution in successful executions | 9064 | 4 | (same) | **YES** |
| G3 | find substrate vessels with the highest mean memory footprint | b2122266 | Analyze Resolver Tier Usage Gap | 10188 | 4 | (same) | **NO** |
| G4 | summarize trace shape entropy over recent dispatches | 56468748 | Summarize Trace Shape Entropy Over Recent Dispatches | 8270 | 4 | (same) | **YES** |
| G5 | tell me about resolver tier usage | f64087ed | development-vessel:evaluate-pr-via-internal-idioms (FAILED) | 14 | 0 | — | **NO** |
| G6 | compute | a92a3667 | Close gap: list things activity | 9855 | 4 | (same) | **NO** |
| G7 | list things | 740b77d1 | Audit dispatches with anomalous duration | 12869 | 4 | (same) | **NO** |
| G8 | audit dispatches with anomalous duration | 0941e094 | Close gap: compute capability synthesis | 10617 | 4 | (same) | **NO** |

**Aggregate: 2 YES, 0 PARTIAL, 6 NO.**

## Per-goal verdicts

- **G1 (NO).** Template name says "memory footprint"; goal asks for trace-shape
  entropy. Template body actually addresses G3.
- **G2 (YES).** Template name and description match the goal verbatim
  (resolver-tier distribution in successful executions).
- **G3 (NO).** Template name is "Analyze Resolver Tier Usage Gap"; goal asks
  for vessels by memory footprint. Template body actually addresses G5/general
  resolver-tier usage.
- **G4 (YES).** Template name "Summarize Trace Shape Entropy Over Recent
  Dispatches" matches the goal exactly.
- **G5 (NO).** Dispatch failed in 14 ms against `evaluate-pr-via-internal-idioms`;
  no purpose-built template was authored or selected.
- **G6 (NO).** "compute" landed on a template authored for "list things".
- **G7 (NO).** "list things" landed on a template authored for "audit
  dispatches with anomalous duration".
- **G8 (NO).** "audit anomalous duration" landed on a template authored for
  "compute capability synthesis".

## Interpretation — race condition under concurrent dispatch

Eight dispatches were fired in parallel. Each goal **did** trigger authoring of
a purpose-built `gap-closing:auto-...` template (we see seven unique
`pk946y/2d1grc/ogpsde/4ifjyy/wqpmg2/v65yr5/gfvjrs` templates whose names track
the original goals). But goals and templates got **shuffled** at selection:
only G2 and G4 ended up running their own template. The other five
successful goals each ran a template authored by a sibling dispatch.

Template creation timestamps cluster within ~550 ms (1780358302977 →
1780358303524), while polling found dispatches completing across a 14 s window.
The substrate's auto-draft commits the template to the registry, but the
"select for original dispatch" step appears to re-query the registry and pick
whichever recently-proposed template the selector ranks highest — under
concurrency, that is often a sibling.

Compared with the previous batch (3/4 collapsed to a single canned
failure-mode template, alignment NO across the board), commit `7ae71e71`
**does** eliminate mode-collapse: every successful goal now produces and
registers a uniquely-named purpose-built template. The remaining gap is
**dispatch-to-template binding under concurrency**.

## Consistency dimension

Duration stability is good among the seven gap-closing executions:
mean ~10.2 s, range 8.3 – 12.9 s, all 4-task fs_read → http_fetch →
llm_completion_dispatch → fs_write pipelines. Same template family across the
board (`gap-closing:auto-*`, `proposed:true`). G5 is the outlier (14 ms
fast-fail on a `development-vessel` template).

## Trace observability

All 8 executions returned full traces via
`/v2/activities/execution-traces/<id>`: 7 with task arrays, durations,
output_impulse_shapes, and resolver IDs; G5 with a `failure` status row and no
task array. Every claim above is reproducible from those traces and the
`activity` table.

## Recommendation

The auto-draft path now meets the **authoring** half of the spec but
loses the **binding** half under concurrent dispatch. The fix is to thread the
just-authored template ID directly into the dispatch context (not via registry
re-query) so the selector cannot pick a sibling's template. Sequential
dispatch is a workaround but does not exercise the concurrent path the
substrate will see in production.
