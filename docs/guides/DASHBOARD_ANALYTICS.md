# Dashboard Analytics: Reading the Learning Loop

**Applies to:** `activity-dashboard` (April 2026+)
**Source:** `repos/activity-dashboard/src/components/`

This guide describes the analytics panels in the activity dashboard and how to read them. If you're debugging a learning-loop regression, this is where you look before digging into raw traces.

> **Foundation alignment.** Two-direction learning duality: `impulseRelevance` (forward arm — P(success | activity X resolves pointer of shape Y)) and slot-binding/Thompson recommendations (reverse arm — P(success | activity X chosen given pool {A,B,C})) must stay symmetric. *(Updated 2026-06-09: F-39 was resolved 2026-04-26 — minibob commit `662b153` — and `thompson_posterior` is now a resolvable shape; see [`docs/impulse-types/thompson_posterior.md`](../impulse-types/thompson_posterior.md). Pre-fix traces remain skewed and should be excluded from retroactive analysis.)* Read the impulse-relevance and convergence panels with arm symmetry in mind: a stalled forward arm makes the reverse arm's "convergence" misleading. Note also migration 128 (2026-05): `times_failed` was silently dropped by the SCHEMAFULL table before that migration, so failure counts predating it undercount.

## Panels added in April 2026

Four panels were added to turn execution traces into actionable signal. Each panel is a thin view over data already emitted by the executing vessel (historically MiniBob, now `goal-host-vessel`; MiniBob is deprecated) and recorded by `metabob-activity-api` — the dashboard doesn't compute new metrics, it surfaces existing ones.

### ImpulseRelevanceDashboard

**Component:** `ImpulseRelevanceDashboard.tsx`
**Hook:** `useImpulseRelevance` → reads `impulse_relevance_metrics` via activity-api
**Answers:** "For activity X, which impulse shapes actually contribute to success, and which are dead weight?"

For each `(activity_id, impulse_shape)` pair, the panel shows:

- **times_loaded** — how many executions included an impulse of this shape
- **P(success | loaded)** — success rate when the impulse was present
- **P(success | not loaded)** — success rate when it was absent
- **relevance_score** — the delta, indexed 0–1

Filters: activity_id (substring), min_relevance (threshold slider).

**How to use it:**
- Relevance near zero with high load count → candidate to drop. You're paying the token cost without improving outcomes.
- Relevance strongly positive but rarely loaded → candidate to auto-load. Add it to the activity's input shape requirements.
- P(success | loaded) ≈ P(success | not loaded) with both near 100% → the activity succeeds regardless. The impulse isn't harmful, but it isn't helpful either.

### ToolUsageDashboard

**Component:** `ToolUsageDashboard.tsx`
**Hook:** `useToolUsage` → reads `tool_usage` patterns via activity-api
**Answers:** "Which tools are called most, at what success rate, at what cost?"

Bar charts and a ranked table for each tool resolver (`bash`, `git`, `file_read`, `llm`, etc.):

- total invocations
- success rate
- average latency
- cost per call (USD)

**How to use it:**
- LLM-tier tools dominating invocation counts → check whether a deterministic tier could replace them. Pattern-matching or a cached bash output may suffice.
- A tool with high latency and high frequency is a compounding bottleneck — same evidence-based-refactoring pattern as in `RUNTIME_ACTIVITY_TRACING.md`.
- A tool with high failure rate concentrated in one activity → that activity's task config is likely wrong (flag name, working dir, timeout).

### ConvergenceOverview

**Component:** `ConvergenceOverview.tsx`
**Hook:** `useConvergence`
**Answers:** "Is Thompson Sampling actually converging, or is it thrashing?"

Shows four indicators:

1. **Belief Stability Gauge** — fraction of activities whose Thompson parameters (α, β) have stopped moving significantly. High = converged; low = still exploring.
2. **Exploration/Exploitation Balance** — how often the sampler picks the known-best vs. something uncertain. A healthy system sits in a narrow band; extremes in either direction indicate a stuck or undersampled population.
3. **Success Rate Trend** — aggregate success rate over a rolling window. This is the outcome metric the learning loop is optimizing; if it isn't trending up, the loop isn't working.
4. **Composition Pattern Counter** — number of distinct composition chains the system has identified. Growth indicates the ribosome is successfully extracting reusable sequences from traces.

**How to use it:**
- Stability near 100% with the trend line flat → the system has converged and isn't finding new wins. Either inject new activity variants or expand the goal space.
- Low stability with a falling trend → a bad variant may be dominating exploration. Check the variant table for recently-introduced templates with poor α/β.

### ExecutionExplainability

**Component:** `ExecutionExplainability.tsx`
**Hook:** fetched directly via `api.fetch` on a specific execution
**Answers:** "Why was this activity picked for this execution, and where did the time go?"

For a single execution trace:

- **Selection Attribution** — the Thompson sample value, α, β at the time of selection, and the competing templates that were not picked. Answers "we had 3 candidates with similar scores, here's why the one we ran won."
- **Task Waterfall** — horizontal timeline of each task with latency, resolver tier, success/failure. The obvious visual tool for finding the slow link in a chain.
- **Impulse Contributions** — which impulses were loaded, their budgets, and (when wired to `v_impulse_relevance`) their marginal contribution to this execution's outcome.

**How to use it:**
- An execution that failed: go here first. Selection attribution tells you if it was a bad template choice vs. bad luck. Task waterfall tells you where in the sequence it broke.
- An execution that succeeded but was expensive: the waterfall exposes whether one task dominated total cost.

## Panels already present before April 2026

For completeness — these existed and are still relevant:

- **ActivityStream** — live feed of ongoing executions (now includes execution-explainability drilldown inline, added in `9e01fed`)
- **CompositionVisualization** — graph of activity-calls-activity relationships
- **ExecutionHistory** — paginated trace table with filters
- **CodeVariants** — diff view of A/B-tested code variants
- **SystemOverview** — aggregate health and throughput
- **VesselStatus** — registered vessels from discovery-vessel

## Reading order for a regression investigation

When the learning loop looks broken, walk the panels in this order:

1. **ConvergenceOverview** — is the trend line falling? Is stability crashing?
2. **ToolUsageDashboard** — did one tool's failure rate spike? (points at a resolver regression)
3. **ImpulseRelevanceDashboard** — did a previously-high-relevance shape drop? (points at a schema or ribosome change)
4. **ExecutionExplainability** on a recent failed trace — concrete example of the bad path
5. **ExecutionHistory** filtered to the failing template — confirms it's systemic vs. one-off

Stop at the first panel that tells you something actionable. Don't walk the whole list every time.

## Data sources (for debugging)

All four new panels read from `metabob-activity-api`:

| Panel | Endpoint(s) |
|-------|-------------|
| ImpulseRelevanceDashboard | `GET /v2/activities/impulse-relevance` |
| ToolUsageDashboard | `GET /v2/activities/tool-usage` |
| ConvergenceOverview | `GET /v2/activities/convergence` (via `useConvergence`) |
| ExecutionExplainability | `GET /v2/activities/execution-traces/:id` + attribution fields |

If a panel is empty, check the endpoint with curl before assuming the dashboard is broken. The most common failure mode is the `impulse_relevance_metrics` table being empty for a newly-created activity — it needs executions before it shows signal.

## Related

- `IMPULSE_ACTIVITY_FOUNDATION.md` — the learning loop these panels visualize
- `RUNTIME_ACTIVITY_TRACING.md` — how runtime traces feed these dashboards
- `RESOLVER_TRACKING.md` — the resolver-level data model backing ToolUsageDashboard
