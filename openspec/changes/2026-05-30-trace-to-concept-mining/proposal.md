# Trace-to-concept mining activity

## Why

The Functional → Vessel (instructional) arrow of the three-states model is
closed for **activity templates** (ribosome-vessel promotes successful
executions to templates) and for **impulse-signature concepts**
(concept-bridge-observer accumulates from analysis-vessel resolutions). It
is **open for empirical findings from the substrate's own dispatched
executions**.

Concrete cost: when the substrate (or an operator-driven loop) dispatches
goals through `run_goal` and produces traces, the aggregate evidence about
*how the selector is behaving*, *which templates the executor pool is
corrupting*, *which anchor classes are sinking* — none of it enters
concept-db. The next drafter run cannot cite "the last N times an
out-of-vocabulary goal was dispatched, it landed on drain-pending-substrate-gaps
with 0 outputs in 10ms" because that fact isn't a concept yet.

Operator-mediated minting is the current bridge but does not scale and does
not run when the operator is away. The autonomous loop produces traces; the
autonomous loop does not consume its own traces.

## Empirical motivation (2026-05-30 13:00 – 19:35 PDT)

An operator-driven /loop ran 8 controlled `run_goal` cycles probing selector
behavior:

| Cycle | Anchor | Variables | Outcome |
|---|---|---|---|
| C1 | OTel `gen_ai.*` | yes | success, gap-closing, 11s, 4 tasks |
| C2 | Bayesian regret (abstract) | no | F25 fail |
| C3 | MCP capability security (abstract) | no | F25 fail |
| C4 | Merkle DAG CID | yes | success, gap-closing, 1.5s |
| C5 | WAL/LSM fsync (OOV) | no | F25 fail, drain-gaps, 10ms |
| C6 | = C5 with variables added | yes | identical F25 fail. **Falsifies variable-seeding.** |
| C7 | substrate-internal `coverageReport` | no | success, draft-spec-from-gap, 30s, 10 tasks. **Confirms vocabulary-gating.** |
| C8 | `failureModeMatrixScore` + adversarial vars | yes | anchor won selection; executor failed 14ms. **Surfaces selector ≠ executor split.** |

Each cycle produced a complete execution trace in activity-api with
status, template_id, duration, task chain, and output impulses. The
aggregate refined the hypothesis from "Thompson selects templates" to
"selector is a lexical/shape-affinity gate; variables corrupt executor pool."
Zero of that learning entered concept-db until the operator manually minted
`concept_WikGVLa5d6kp` (`selector_anchor_vocabulary_gate`).

This is the operational evidence the substrate **cannot learn from its own
executions today**.

## What changes

Add a **`mine-execution-traces` activity** to `development-vessel` (or as a
new vessel — `learning-from-traces-vessel` — if the size warrants
separation):

1. **Resolver `executionTraceList_recent`** (already partial via
   activity-api `/v2/activities/execution-traces?since=…`): returns N most
   recent execution traces with status, template_id, duration, output
   counts, and the goal string if present.

2. **Resolver `trace_pattern_cluster`** — groups N recent traces by
   `(template_id, status, duration_bucket, output_count)`. Emits
   `tracePatternCluster` impulses. Cheap deterministic resolver, no LLM.

3. **Resolver `cluster_to_concept_proposal`** — for each cluster with
   support ≥ M, emits a `conceptProposal` impulse describing the inferred
   pattern in natural language (e.g. "Template `drain-pending-substrate-gaps`
   is selected for 38% of operator dispatches in the last 24h; trace-level
   failure rate 91%; mean duration 8ms."). LLM-tier — but cheap because the
   input is structured cluster data, not raw traces.

4. **Resolver `mint_concept_from_proposal`** — wraps the existing
   `concept_create_write` impulse path to translate a `conceptProposal`
   into a concept-db row. Tags the concept with `source_type: "extracted"`
   per the substrate skill taxonomy.

5. **Activity `mine-execution-traces`** composes (1) → (2) → (3) → (4) with
   `validator-dispatch` gates to drop proposals already represented as
   concepts. Idempotent: re-running over the same trace window produces the
   same proposals; duplicate concept-creates are no-ops.

6. **Lifecycle observer / schedule** — runs the activity on the existing
   boredom-vessel rotation or on a `OnUnitActiveSec` timer (every 15 min,
   say). Once trace count > threshold, dispatch.

## Out of scope

- Cross-org observation. This activity operates within the substrate's own
  org_id. A separate cross-org mining vessel can be a follow-up.
- Concept-mutation. The activity only **mints** new concepts; it never
  updates or deprecates existing ones. Operator-mediated review of high-α
  concepts stays the path for now.
- Adjustment of Thompson α/β on existing templates based on the mined
  patterns. That's a separate activity (`adjust-template-posteriors-from-clusters`)
  that depends on this one.

## How this validates

Two-step:

1. After the activity ships and runs once over the trace history that
   produced the 8 selector-probe cycles, concept-db should contain a
   concept of `source_type: extracted` whose summary mentions
   `drain-pending-substrate-gaps` as a high-frequency, low-success-rate
   template — without operator intervention.

2. The drafter's next `draft-gap-closing-activity` run should read that
   concept as a prior (`prime_substrate_concepts` returns it because its
   `source_type` matches the drafter's URL), and the LLM-authored template
   should avoid the same out-of-vocabulary failure mode the cluster
   identified.

Companion to:

- `concept_WikGVLa5d6kp` — operator-minted version of what this activity
  would mint autonomously
- `concept_-sJSiv_RUjMM` — the gap concept that motivated this proposal
- `openspec/changes/2026-05-30-vessel-binary-redeploy-on-source-drift/` —
  parallel gap (vessel-binary redeploy on source drift)

## Dependencies

- `executionTraceList` resolver — exists in activity-api.
- `concept_create_write` resolver — exists in concept-db.
- `validator-dispatch` meta-activity — exists in development-vessel seed templates.
- LLM-tier resolver — exists (`llm_completion_dispatch`).

## Risk

- **Concept-spam**: if the cluster threshold is too low, every transient
  blip becomes a concept. Mitigation: require ≥ M traces in a cluster
  before proposing (M = 10 as a starting point), and gate on minimum
  observation window (≥ 4h).
- **Stale proposals**: clusters drift fast. Mitigation: tag proposals with
  the trace window they observed; concept-db's upkeep activities decay
  relevance for stale extracted concepts.
- **LLM hallucination in proposal text**: the LLM gets structured cluster
  data, not raw traces, which reduces hallucination space — but the
  proposal text is still LLM-generated. Mitigation: include the cluster's
  raw metrics alongside the LLM summary in the concept's `content` field
  so future readers can verify.
- **Recursive learning loop**: once the activity mints concepts, those
  concepts may shift the drafter's behavior, which produces new traces,
  which produce new clusters. This is desired (the loop closing). The
  risk is oscillation. Mitigation: the substrate-health-tick already
  observes posterior confidence and graph stability; pause mining if
  health drops below a threshold.
