# Proposal: Closing the Activity-Reuse RL Loop

**Change ID**: `2026-05-06-activity-reuse-rl-loop`
**Status**: Draft
**Date**: 2026-05-06

---

## Problem Statement

The impulse-activity system is architecturally a contextual-bandit-over-a-shape-graph approximating a full RL-GNN agent. Most core components exist:

- Thompson Sampling over activity templates (global α/β posteriors)
- BM25 FTS on `name` + `description`
- Dense embedding code path (`queryActivitiesByDense`, currently disabled)
- RRF hybrid merge (`mergeByRRF`)
- Shape-compatibility filtering via `discover-by-shapes`
- Composition graph (`compositionSuccess`) with edge weights
- Per-task `input_impulse_ids` / `output_impulse_ids`
- `executionTraceWithSignatures` for deterministic co-occurrence extraction
- Lifecycle events (`task:preBinding`, `task:completed`) carrying state-before / state-after / outcome
- Failure-mode taxonomy (`verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`)
- Ribosome (template extraction from successful improvise traces)
- Trace storage redesign (`trace_digest`, `execution_trace_content`, `execution_exemplar`)

Several adjacent specs are already drafted (and partially implemented) for the gaps:

- `context-bucketed-thompson-sampling` — state-conditioned posteriors
- `dense-semantic-search` — re-enable embedding-based retrieval
- `irrelevance-score-feedback` — symmetric negative-evidence scoring
- `state-space-aware-recommendations` — pool/pointer-aware ranking
- `surrealdb-rl-layer` — push α/β updates into the DB for atomicity and read-time EV

What does **not yet exist**: (1) a unifying narrative that maps the existing parts onto the RL-GNN model end-to-end, (2) credit propagation backward through composition chains, (3) failure-mode-stratified posterior updates, (4) a tags FTS index for the third independent retrieval signal, and (5) a reproducible validation harness that demonstrates activity creation + reuse improves over time.

The result today: we cannot answer "is the system getting better at finding the right activity?" with quantitative evidence. We have intuition and one-shot validation runs but no longitudinal measurement.

---

## Solution

This change is **additive and orchestrative**. It introduces no new core subsystems; it wires existing components into a measurable loop and fills four bounded gaps.

**Four new capabilities (this change):**

1. **`tags-fts-index`** — third FTS index on `activity.tags` using the existing `activity_analyzer`. One migration. Bridges hierarchical-classifier intent (`bugfix.auth.tokens`) that BM25-on-name and dense embeddings both miss.
2. **`composition-chain-credit-propagation`** — when a composed execution succeeds or fails, propagate fractional α/β updates backward through `composition_chain` ancestors. Closes the gap that today only the leaf activity gets credit for a multi-step success.
3. **`failure-mode-stratified-updates`** — replace the binary β increment on failure with a structured update keyed on `failure_mode.type`. `verifier_negative` lowers shape-compatibility weight; `budget_exhausted` lowers cost-context Thompson prior; `cascading` propagates upstream-only; `user_abort` does not penalize.
4. **`activity-reuse-validation-harness`** — reproducible benchmark suite that runs N graduated prompts through minibob, captures Thompson posterior trajectories, retrieval ranks, and template-reuse rates, and emits a longitudinal report. Replaces ad-hoc validation campaigns with a measured loop.

**Five existing dependencies (referenced, not redone):**

- `context-bucketed-thompson-sampling` (already spec'd) — state-conditioned posteriors
- `dense-semantic-search` (already spec'd) — re-enable embeddings via ONNX model in image
- `irrelevance-score-feedback` (already spec'd) — symmetric negative scoring
- `state-space-aware-recommendations` (already spec'd) — pool-aware ranking
- `surrealdb-rl-layer` P1+P5A (already spec'd) — atomic α/β + BM25 score fix

This change does **not** add ML training pipelines, learned shape embeddings, or replace Thompson Sampling. It closes the loop with the components already present and proves the closure with measurement.

---

## Architectural Framing (one paragraph)

Activities and shapes form a bipartite graph. Executions are walks on that graph. State = current impulse pool; action = activity dispatch; reward = task success + goal verification; transition = output impulse set. Thompson Sampling is the policy; relevance scoring is graph attention over the policy's candidate set; ribosome is graph-node creation from successful walks; failure-mode taxonomy is reward shaping. The system is already an RL graph agent; this change makes the loop measurable and propagates credit along its full structure.

---

## Out of Scope

- Learned shape embeddings (separate change; depends on stable trace volume and labelled co-occurrence corpus)
- Neural policy networks or true GNN message-passing layers (the SQL-based attention over `compositionSuccess` is sufficient at current scale)
- Changes to the impulse-binding selection layer (already shipped)
- Changes to the recommendation API surface (additive fields only; existing contracts unchanged)
- Multi-vessel federated learning across orgs (single-org RL only)
