## Why

The impulse-activity loop and `make-activity` meta-activity are functional (verified end-to-end on canary 2026-04-27 12:38 UTC). The 2,500+ existing activity templates accumulated organically across many spec rounds and aren't all idiomatically aligned with the current foundation: not all declare input/output shapes, not all use resolvers idiomatically, many were authored before lifecycle events / validators / sandbox conventions landed, and most never had their patterns mined.

We need a systematic **registry-quality pass**:
1. **Catalogue the load-bearing core** — the templates that are actually exercised, that other templates dispatch as children, and that carry the highest Thompson α — versus the long tail of one-off / deprecated / superseded entries.
2. **Review the long tail** against idiomatic alignment + foundation rules, then prune (`activityTemplate_deprecate`) what's not worth saving and replace (via `make-activity`) what is.
3. **Mine traces for patterns** — recurring task graphs, recurring shape-flow signatures — and surface those patterns as concepts in concept-db.
4. **Work with traces without context-overwhelm** — establish trace-summarization primitives so the LLM-side reasoning steps in (1)–(3) operate on metadata + cluster heads, not raw trace bodies.

This is the natural follow-up to `2026-04-27-meta-activity-builder` — the make-activity loop is the *tool*; registry-quality is the *first concrete use* of that tool at scale.

## What Changes

### 1. Six idiomatic activities composing the registry-quality pipeline

Each activity declares `inputShapes` / `outputShapes`, uses resolvers (no hand-rolled bash for orchestration), is sandboxed where it touches the filesystem, and persists evidence as impulses for downstream tasks.

| Activity | Purpose | Input shapes | Output shapes |
|---|---|---|---|
| `core-activity-audit` | Catalogue & rank load-bearing activities | `activityTemplate`, `activityMetrics`, `executionTraceWithSignatures` | `coreActivitySet`, `auditReport` |
| `review-activity` | Score one template against idiomatic alignment + foundation rules | `activityTemplate`, `auditChecklist` | `activityReview`, `failure_mode` |
| `prune-activity` | Soft-deprecate via `activityTemplate_deprecate` when score < threshold | `activityReview` | `activityTemplate_deprecate_result` |
| `replace-activity` | Generate a better variant; dispatches `make-activity` as a child | `activityReview`, `goal` | `activityTemplate_write_result` |
| `extract-pattern` | Mine traces for recurring task graphs and shape-flow signatures | `executionTraceWithSignatures`, `traceCluster` | `pattern`, `patternFrequency` |
| `concept-from-pattern` | Promote a pattern to a concept via concept-db | `pattern` | `concept` |

**Trace summarization primitives** (closes part 5 of the user directive):

- **`executionTraceWithSignatures`** — already exists (activity-api `config.ts:223`). Pulls per-impulse pointer/shape signatures, no full content. Foundational metadata-first read; the audit + review + extract-pattern steps depend on it.
- **`traceDigest`** *(new shape)* — structured summary of a single trace: `{activity_id, status, duration_ms, tasks: [{id, status, duration_ms, resolver_tier}], failure_mode, output_shapes}`. Aggregates a 100-line trace into a few hundred tokens. Resolved either client-side from the signature shape or server-side via a new resolver case in `routes/impulses.ts` (decide during implementation).
- **`traceCluster`** *(new shape)* — groups traces by `(activity_id, failure_mode_type, output_shapes_intersection)` and returns one representative cluster head + cluster size. Yields `O(num_clusters)` LLM input instead of `O(num_traces)`.
- Pagination via existing `executionTraceList` shape.

### 2. The first concrete deliverable: `core-activity-audit`

This proposal scaffolds the pipeline; the first activity in the table — `core-activity-audit` — ships alongside the proposal. The remaining five are roadmap rows authored in subsequent dispatches once `core-activity-audit` produces its first `coreActivitySet` + `auditReport` impulses (so the downstream activities can be designed against real signal rather than speculative shapes).

`core-activity-audit` is read-only:
- Fetches `activityTemplate` list (limit=500, paginated across invocations if needed).
- Fetches `activityTemplatesByMetrics` for per-template Thompson α/β + recent execution count.
- Fetches **trace signatures** (not full bodies) via `executionTraceWithSignatures` with `since=last 7 days`, capped at `maxTracesPerTemplate=5` per template.
- Ranks templates by a load-bearing score: Thompson α weighted by recency-decayed execution count + downstream-dependency count (templates that other templates dispatch as children via the `activity` resolver).
- Emits `coreActivitySet` (top-N, default 20) + `auditReport` (summary).

Variables: `lookbackDays=7`, `coreSetSize=20`, `maxTracesPerTemplate=5`.

Sandbox: read-only — no file writes, no `workingDirectory` needed.

## Capabilities

- **`activity-registry-audit`** — the audit + ranking primitive (`core-activity-audit`).
- **`activity-quality-loop`** — the audit → review → prune/replace cycle (`core-activity-audit`, `review-activity`, `prune-activity`, `replace-activity`).
- **`pattern-extraction`** — the trace-mining primitive (`extract-pattern`, `concept-from-pattern`).
- **`trace-summarization`** — the substrate (`executionTraceWithSignatures` already exists; `traceDigest` and `traceCluster` are new).

## Impact

- **minibob**: 6 new embedded activity templates + 2 new shape names in resolver vocabulary (`coreActivitySet`, `auditReport`, `activityReview`, `pattern`, `patternFrequency`, `traceDigest`, `traceCluster`). The first activity (`core-activity-audit`) ships with this spec; the remaining five are roadmap.
- **activity-api**: optional new shape resolvers for `traceDigest` and `traceCluster`. May start client-side (compute from `executionTraceWithSignatures`) and migrate server-side once the pattern stabilizes.
- **concept-db**: consumed by `concept-from-pattern` via existing `concept` write resolver — no schema changes anticipated.
- **Workbench**: out of scope.

## Dependencies

- **`2026-04-27-meta-activity-builder`** (verified end-to-end on canary 2026-04-27 12:38 UTC). `replace-activity` dispatches `make-activity` as a child.
- **F-51 deploy** (in flight) — required for executionTraces to persist; otherwise `extract-pattern` has no signal to mine and `core-activity-audit` cannot rank by recent execution count.
- **`2026-04-26-impulse-activity-loop`** (verified). Lifecycle events + validator-dispatch + slot-binding are the substrate the new activities ride on.

## Success criteria

- `coreActivitySet` impulse produced by `core-activity-audit` at least once on canary (≥ 1 invocation, output non-empty).
- ≥ 3 templates auto-reviewed by `review-activity` with structured `activityReview` impulses.
- ≥ 1 `pattern` impulse extracted by `extract-pattern` from real traces.
- ≥ 1 `concept` promoted to concept-db by `concept-from-pattern`.

## Out of Scope (Roadmap)

The following are anticipated next-spec rows, NOT in this spec:

- A workbench surface for the audit report (`coreActivitySet` viewer + reviewable-template queue).
- Automatic prune scheduling (boredom-task that drains the deprecate queue).
- Cross-vessel pattern extraction (concept-db consuming traces from multiple vessels' executions).
- Pattern → resolver promotion (turning a deterministic pattern into a registered resolver, closing the cost-optimization loop).
