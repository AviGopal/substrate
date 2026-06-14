# Learning-rate acceleration + autonomous detector-authoring recursion

**Status:** proposed
**Date:** 2026-06-14
**Scope:** `repos/boredom-vessel/`, `repos/metabob-activity-api/src/lib/`, dev-vessel seed templates, `scripts/substrate/units/`
**Size:** medium — one new selector mode, one new deterministic scan family, one drafter archetype, two observables. No new primitive, no new tier.

## The directive

Increase the rate at which the substrate learns *while running*, do it by using the substrate to build itself, give it the capability to author **new detectors for new classes of problem on its own**, verify it is actually doing so, and make it measurably **more stable as it grows** — not just larger.

## Substrate framing (SUBSTRATE_AS_MDP)

Learning rate factors into exactly three levers (§2.1: the conjugate Beta-Bernoulli update is Fisher-efficient, so there is **no learning-rate knob** — rate is sample-bound, not step-size-bound):

1. **Throughput** — samples per wall-clock (§7 horizontal dispatch).
2. **Targeting** — collecting samples where `Var[Beta] × value` is highest (§9.4).
3. **Sample-need reduction** — collapsing stochastic cells to deterministic ones (§8.4 tier-refinement).

A 2026-06-14 machinery audit established what is **already done** vs **open**:

| Lever | Status | Evidence |
|---|---|---|
| Throughput — `compose_parallel` sibling dispatch | **Implemented but unused by exploration** | `ias-executor-ts/src/engine.ts` (`dispatchComposeParallel`, `Promise.allSettled`, `metadata.siblingGroupSize`); credit averaged `/k` at `posterior-update.ts:498` |
| Sample-need — TD(λ), tier-restricted bandit, concept prior, embedding posterior | **Implemented** | `learning-rate-1..6` series; `posterior-update.ts:106,374,421-583` |
| **Targeting — value-of-information goal selection** | **OPEN** | `boredom-vessel/src/index.ts:828-879` is pure round-robin + load-gating; no posterior on detector/goal payoff |
| **Autonomous detector-authoring (the recursion)** | **OPEN** | `capability-gap-audit-tick` (goal[29]) detects missing capabilities; **no meta-detector authors new detector activities** for novel problem classes (§9.3 limit-8, detection-recursion truncated at substrate boundary) |
| **Stability-as-measured-trend (curl + inter-arm)** | **OPEN** | validator-dispatch livelock is *ablated* (`goal-host-vessel/src/index.ts:589` `GOAL_HOST_DISABLE_SUBSCRIBERS=1`), not detected; no cyclic-flow measure; no stability trend observable |

The three open rows are exactly the three things the directive names. This change closes them.

## The recursive shape (why detector-authoring is the keystone)

The validation half of every cycle is the reward function (`SUBSTRATE_AS_MDP §6`: reward = "binary trace success after convergent-validity check"). A **detector** is a validation activity whose output is a `substrateGap` impulse — it closes the loop on a *class of problem* rather than a single trace. The substrate already authors **templates** from gaps (drafter + auto-promote, proven live 2026-06-14, 24+ variants auto-promoted). What it cannot yet author is **detectors** — it cannot notice "we have no detector for this recurring failure signature" and draft one.

Closing that is §9.3 limit-8: *capability authoring at level N requires gap-detection at level N.* The operator's role (per `feedback_substrate_self_detection_recursive`) is to inject the **one** new primitive — a detector-coverage audit + a `draft-detector-activity` archetype — after which the substrate authors detector *instances* autonomously, the same way it already authors template instances. Operator = novelty injection; substrate = instance authoring.

## Workstreams

- **A — Value-of-information goal selection (targeting).** Replace round-robin with a UCB/Thompson bandit over goals keyed on recent *information gain* each goal produced (Var-reduction it caused + fresh gap-classes it surfaced), penalised by cyclic-flow fraction (Workstream D). This is the §1/§2 meta-cell: the selector applied to the learning frontier itself. Smallest, highest-leverage; `boredom-vessel` only.
- **B — Exploration fan-out (throughput).** Use the existing `compose_parallel` resolver for OR-edge discovery: when ≥2 templates produce the same output shape and all carry high `Var`, dispatch them as siblings instead of letting Thompson pick one (§7.2). Authored via the drafter where possible; bootstrap the OR-edge detector once.
- **C — Detector-authoring recursion (keystone).** `detector-coverage-audit` (deterministic): cluster observed `failure_mode`/anomaly signatures, diff against the class-set existing detectors emit, emit a `detector-gap` scenario for any uncovered cluster. New drafter archetype `draft-detector-activity`: output is a deterministic-scan detector activity emitting a new `substrateGap` class. Reuses drafter + auto-promote.
- **D — Stability-as-curl (stability while growing).** `cyclic-flow-scan` (deterministic) over the composition graph: per-edge cyclic (zero-work) fraction — the Hodge curl component. High cyclic mass + zero posterior movement ⇒ `wastedCycle` substrateGap (the validator-dispatch livelock made *measurable* instead of ablated). Feeds Workstream A's penalty (fixes "UCB never penalizes never-completing shapes").
- **E — Proof it is doing so (measurement).** Two trace-inspectable observables (§9.4): **detection-coverage** (fraction of detected horizons closed autonomously vs operator-escalated) and **stability-trend** (per-window: Var-converged reachable-cell fraction ↑ AND inter-arm curl ↓, §4.6). Growth = coverage breadth; stability = convergence + low curl. Extends the IAL lift criterion with a stability axis; "substrate authored a detector" counts only with trace evidence (drafter provenance + the new detector firing + emitting its class), per `feedback_milestone_requires_trace_inspection`.

## Non-goals / explicitly NOT this change

- No new tier, category, shape vocabulary, or resolver kind (`concept_7mzv7SQN_7JB`).
- Not re-implementing horizontal dispatch — it exists; we *route into* it.
- Not touching the conjugate update arithmetic — there is no rate knob there (§2.1).
- No new operator watcher/monitor — the user runs an external monitor (`feedback_user_has_external_monitor`); all observables are substrate-emitted impulses.

See `design.md` for theory→mechanism mapping and `tasks.md` for the sequenced, evidence-gated phases.
