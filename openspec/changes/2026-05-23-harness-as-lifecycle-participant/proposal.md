# 2026-05-23 — Harness as Lifecycle Participant

## Motivation

The failure-mode harness currently scores 6 scenarios as `reuse` consistently
(cycle-5 through cycle-8), and the progression-driver — after the 2026-05-23
fix — correctly reports `consecutive_zero_debt_cycles=4` against canary. The
bookkeeping shows lift.

The bookkeeping is not the system. The harness still runs as an external
TypeScript script under `validation/scripts/`. It produces a JSON report on
disk; it does not produce an execution trace; it does not emit impulses; it
does not feed back into Thompson posteriors; it does not compose with the
other self-development loops (registry quality pass, ias-executor-ts
migration, Thompson MRR weekly run).

The foundation doc states: *"We don't write separate tests — activities ARE
tests. Traces ARE test results."* Our harness violates that. Lift as a system
property — rather than a per-loop bookkeeping property — requires the
harness to be a participant: an activity whose runs produce traces, whose
outputs are impulses that other loops consume, whose firing is driven by
shape demand from the rest of the system rather than by a human running
`bun run validation/scripts/failure-mode-harness.ts`.

The seed template `development-vessel:harness-check-scenario` exists
(landed 2026-05-22, §12). It scores one scenario at a time as an activity:
`fs_read` → `json_path_extract` × 2 → `activity_discover_by_shapes` →
`fs_write`. Running it produces an AET in activity-api. But nothing in the
substrate currently runs it. The wiring from "template exists in registry"
to "fires when relevant" is the gap this change closes.

## Proposal

Make `harness-check-scenario` fire automatically when the state it measures
could have changed, and compose its output with the loops that produce that
change. Three concrete pieces:

1. **An aggregator template `harness-run-matrix`** that fans out across the
   scenario directory, calls `harness-check-scenario` for each scenario, and
   aggregates the resulting `scenarioOutcome` impulses into a single
   `failureModeReport` impulse. The current external harness script is
   functionally replaced by this template; the script becomes a thin
   wrapper that invokes it for backward compatibility.

2. **A lifecycle subscription** on the development-vessel: when
   `draft-gap-closing-activity` completes successfully (any scenario), the
   vessel fires `harness-run-matrix` to re-score the matrix. This is the
   demand-driven timing mechanism — the harness runs because the substrate
   just changed in a way that could affect its result, not because a human
   triggered it on a schedule.

3. **A shape-level composition contract** so other loops can both consume
   the harness output and trigger re-runs:
   - `failureModeReport` is the shape the harness produces.
   - `activityRegistryChange` is a shape any loop emits when it
     prunes/promotes/registers a template. The development-vessel
     subscribes to this shape and re-runs `harness-run-matrix` when it
     fires. This means the registry quality pass (`prune-activity`,
     `replace-activity`) automatically triggers re-scoring without
     coordination.

After these three are in place, lift becomes verifiable as a topology
property: an external loop modifies the registry, the harness re-runs on
its own, the resulting `failureModeReport` impulse goes back into Thompson
posteriors via the trace-sink path, and the system either re-confirms or
loses its `consecutive_zero_debt_cycles` count without anyone running a
script.

## Why this is in-scope now

We have the parts:
- Seed templates work (8 templates currently seeded on canary; §S.2 green).
- `activity_create_variant` is write-scope and works.
- `vessel_register_passthrough` is registered.
- Lifecycle event broadcast on WebSocket (`lifecycle:execution:succeeded`)
  exists in activity-api and is already consumed by minibob's slot-binding
  / validator-dispatch hooks.
- The harness-check-scenario template scores correctly when called
  manually (verified locally with stubs; canary verification is task 1.2).

What we DON'T have is the development-vessel subscribing to those events.
Adding the subscription is small (mirror the pattern in
`repos/concept-db/src/observers/execution-observer.ts`) and decisive.

## Out of Scope

- **Novel-scenario lift testing.** The "given a brand-new failure mode, can
  the system produce a viable closing template in one cycle?" criterion is
  the next iteration after this one. It requires a scenario-generator
  activity (currently `validation/scripts/goal-generator.ts` exists as a
  script; it has the same becomes-a-seed-template trajectory). Out of scope
  here.
- **Cross-loop dependency graph visualization.** Knowing which loops feed
  which shapes is currently in CLAUDE.md prose. A formal dependency graph
  exposed via discovery-vessel is a future improvement.
- **Backpressure / debouncing.** If a registry change causes many
  re-scores, we may need to debounce. Defer until we observe the load.
- **The `activityRegistryChange` shape definition.** It's named here as the
  composition contract, but the loops that should emit it
  (`prune-activity`, `replace-activity`, `activity_create_variant` results)
  don't yet emit it. Wiring those emitters is in a follow-up change
  (`registry-change-emission`).
