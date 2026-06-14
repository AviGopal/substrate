# Design — learning-rate acceleration + detector recursion

## 1. Theory → mechanism map

Every mechanism reduces to an existing primitive read through `SUBSTRATE_AS_MDP`. No mechanism introduces a control plane above the substrate; each is the substrate's own selector/drafter/validator applied to itself.

| Theory object | Existing primitive | This change's mechanism |
|---|---|---|
| Targeting = ascend `Var × value` (§9.4) | Thompson selector | A: goal selection becomes a bandit cell — "which detector pays?" is the same argmax as "which template?" |
| Throughput = √k samples/wall-clock (§7.2) | `compose_parallel` (exists) | B: OR-edge detector routes high-Var sibling sets into the existing fan-out resolver |
| Validation = return edge / reward R (§6) | `failure_mode` taxonomy + convergent-validity | C: a detector is a validation activity whose output is a `substrateGap` class |
| Detection recursion (§9.3 limit-8) | drafter + auto-promote (exists) | C: `detector-coverage-audit` + `draft-detector-activity` archetype |
| Cyclic flow = Hodge curl component (prior-turn geometry) | composition graph + trace store | D: `cyclic-flow-scan` computes per-edge zero-work fraction |
| Inter-arm agreement = invariant manifold (§4.6) | forward arm (impulseRelevance) + reverse arm (slot-binding) | E: `stability-trend` measures inter-arm curl across windows |
| Growth vs stability | coverage_progress (exists) + Var | E: two-axis observable — breadth ↑ *and* convergence ↑ |

## 2. Workstream A — value-of-information goal selection

**Current (`boredom-vessel/src/index.ts:828-879`):** `peekGoalIndex`/`advanceGoalIndex` modulo-rotate 46 goals; `maxCostForLoad()` gates by load anomaly. No payoff signal.

**Change:** maintain a per-goal Beta posterior over *information yield* — define a goal's reward on a tick as `1` if the dispatched activity caused any of {a `Var[Beta]` reduction on a touched cell beyond ε, a fresh gap-class surfaced, a posterior-moving validation verdict}, else `0`. Select each tick by Thompson sample over goal posteriors, **still gated by `maxCostForLoad`** (load-triage stays). Penalise the sampled value by the goal's cyclic-flow fraction from D so never-closing loops decay.

- Keyed per-goal, factorised (§4.1) — independent of template-level posteriors; no contamination.
- Round-robin remains the cold-start prior (Beta(1,1) ⇒ uniform ⇒ round-robin until evidence accrues): strictly a refinement, never worse.
- Information yield is computed from data the tick already returns (the dispatch result + a cheap post-tick `Var` delta query); no new write path.

**Why this is the rate lever that's actually open:** throughput (`compose_parallel`) and sample-need (TD(λ), tier-bandit) already shipped. With 46 goals on round-robin, a high-Var detector waits ~46 ticks for its turn regardless of payoff. Targeting collapses that wait to ∝ payoff.

## 3. Workstream B — exploration fan-out (OR-edge discovery)

**OR-edge:** a state where ≥2 applicable templates declare the same `output_shapes` and all carry `Var` above threshold. Sequential Thompson observes only the chosen arm (§7.2 regret-vs-exploration trap).

**Change:** a deterministic `or-edge-scan` emits an `orEdge` scenario `{ signature, candidate_template_ids[k] }`. A drafter-authored (or bootstrap) `explore-or-edge` activity dispatches the k candidates through the **existing** `compose_parallel` path (`task.subActivityIds = candidate_template_ids`), which already averages credit `/k` at the ancestor. The joint posterior over the OR-edge updates from k observations per cycle instead of 1.

- No dispatcher change — `compose_parallel` exists and is credit-correct.
- Verify-first task: confirm `compose_parallel` is registered as a resolver the drafter can target (audit found it in the engine; registration as a dispatchable resolver is a precondition, not assumed).

## 4. Workstream C — detector-authoring recursion (keystone)

### 4.1 `detector-coverage-audit` (deterministic detector)

1. Read recent `failure_mode` + audit-anomaly impulses; cluster by signature `(failure_mode.type, output_shapes_intersection, resolver_tier)` (reuse `traceCluster` shape).
2. Enumerate the **class-set** every existing detector emits (the distinct `substrateGap.class` values produced by goals 17–29, statically declarable from their seed templates).
3. Diff: any cluster whose signature maps to **no** existing detector class ⇒ an uncovered problem class.
4. Emit a `detector-gap` scenario `{ cluster_signature, exemplar_trace_ids, proposed_detector_class }`.

This is itself a validation activity (it closes the loop on the *meta* question "do we have a detector for this?"). It is deterministic — no LLM — so it does not consume posterior capacity.

### 4.2 `draft-detector-activity` (drafter archetype)

A draft archetype distinct from `draft-gap-closing-activity` (which authors *templates*) and `draft-activity-from-pattern` (which authors *resolver chains*). Its output is a **deterministic-scan detector activity**: a template whose tasks (a) read a slice of the trace/registry store, (b) apply the cluster signature as a filter, (c) emit a `substrateGap` of the new class. The archetype constrains the drafted activity to deterministic resolvers (it must not need an LLM to fire) so authored detectors are cheap and re-runnable in the boredom rotation.

Reuses verbatim: the drafter LLM path, `activity_create_variant`, the auto-promote-after-N-successes loop (`system-authored-activity-promotion-loop`, 2026-06-14), and the gap→scenario bridge.

### 4.3 Routing

Add a `detector-gap` drain to the boredom rotation (one goal) that file-polls `detector-gap` scenarios and dispatches `draft-detector-activity` — mirroring goal[42] `drafter-trigger-tick`. The newly-authored detector, once auto-promoted, enters `applicable(s)` and is selected by Workstream A on its own payoff.

### 4.4 The recursion closes

detect failure cluster → notice no detector covers it → author a detector → auto-promote → it fires on the next occurrence → its `substrateGap` feeds the *template* drafter. The substrate now extends its own **detection** vocabulary, not just its template vocabulary. This is the §9.3 level-N gap-detection that was truncated at the operator boundary.

## 5. Workstream D — stability-as-curl

### 5.1 `cyclic-flow-scan` (deterministic)

Over a window of the composition graph (edges = `(parent_execution_id → child)` with `output_shapes`):

- Compute each edge's **cyclic fraction** via the graph Helmholtz–Hodge split: the divergence-free (loop) component of the empirical flow. Concretely, an edge participating in a closed shape-cycle (output shapes re-enter an ancestor's input pool) with **no net posterior movement** across the loop is zero-work circulation.
- Emit `wastedCycle` substrateGap `{ edge, cyclic_fraction, posterior_delta }` for edges above threshold.

This makes the validator-dispatch livelock (currently ablated at `goal-host-vessel:589`) a *measured* signal: the ablation can later be lifted because the loop is now detectable and penalisable rather than only suppressible.

### 5.2 Feedback into A

A goal's Workstream-A reward is multiplied by `(1 − cyclic_fraction)`. A detector/goal that spins without closing learning loops decays in selection probability — the principled form of the missing UCB penalty.

## 6. Workstream E — measurement (proof, not assertion)

Per `feedback_milestone_requires_trace_inspection` and `feedback_substrate_authored_label_vs_evidence`, "the substrate authors detectors and grows more stable" is claimable only from trace-inspectable observables.

### 6.1 detection-coverage (growth of the recursion)

Per window: `closed_autonomously / (closed_autonomously + operator_escalated)` over detected horizons. A detector counts as **autonomously authored** only when all hold (trace-verified):
- provenance = drafter (`draft-detector-activity`), not an operator commit;
- the authored detector **fired** at least once (a trace exists);
- it **emitted its declared `substrateGap` class** (output impulse substance, not a stub).

### 6.2 stability-trend (stability while growing)

Per window, two scalars:
- **Convergence:** fraction of reachable `(s,a)` cells with `Var[Beta]` below threshold (§9.4 per-substrate observable).
- **Inter-arm curl:** mean absolute disagreement between forward-arm `P(success|activity,shape)` and reverse-arm `P(activity|signature)` on shared edges (§4.6). Drift = off-manifold motion.

**Growing-and-stabilising** = coverage breadth ↑ (new non-prior cells) **with** convergence ↑ and curl ↓ across ≥3 consecutive windows. Growth without stability (cells added, curl rising) is the failure signature this axis exists to catch.

### 6.3 Lift-criterion extension

Today's IAL lift gate is `coverage_progress ∧ health_passing` for ≥3 windows. Extend with the stability axis: `coverage_progress ∧ health_passing ∧ stability-trend-non-decreasing` for ≥3 windows. Same `k=3` rule, one new trace-inspectable conjunct.

## 7. Operator-bootstrap vs substrate-authored split

Per `feedback_operator_fan_out_when_substrate_could_author`, minimise operator authoring to genuinely-new primitives:

| Artifact | Author | Why |
|---|---|---|
| Workstream A selector mode | operator (bootstrap) | new selection logic in compiled vessel code |
| `cyclic-flow-scan`, `detector-coverage-audit`, `or-edge-scan` | operator (bootstrap, deterministic seeds) | new deterministic primitives; one-time |
| `draft-detector-activity` archetype | operator (bootstrap) | new drafter archetype; one-time novelty injection |
| **detector *instances*** | **substrate** | authored by `draft-detector-activity` from `detector-gap` scenarios — the recursion |
| **`explore-or-edge` instances / OR-edge fan-outs** | **substrate** | drafted + selected on payoff |
| stability/detection observables | operator (bootstrap emitters) | measurement plumbing; one-time |

After bootstrap, every *new detector for a new problem* is substrate-authored. The operator never authors another detector — only injects the next archetype if a structurally new authoring mode is needed.

## 8. Risk / honesty register

- **Frontier math (§11):** the Hodge-curl reading of cyclic flow and "graph momentum" are §11 *frontier*, not theorem-grounded. D ships as a measured heuristic with a threshold, not a proof. Honest framing required in any report.
- **Orthogonality is measured, not assumed (§11, §4):** A's per-goal factorisation holds only while goal posteriors stay uncorrelated; include the conditional-independence check as a guard, surface drift.
- **Auto-promote gaming:** a detector that emits trivially-satisfiable gaps could farm auto-promotion. Gate `draft-detector-activity` outputs through the same convergent-validity check (`merge-gate-computes-convergent-validity`) the template path uses.
- **Cold-start:** A degenerates to round-robin under flat priors — acceptable; strictly ≥ current behaviour.
