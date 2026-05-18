## Why

Activity execution currently has no external verifier: a task completing does not mean the goal was achieved, and validation rules are hardcoded inside templates rather than derived from separately-authored specifications. This change introduces a specification-validation loop — a set of composable activities that convert intent into enforcement activities and validation activities, map them to code components, and continuously synchronize the two as code evolves.

## What Changes

- **New meta-activity** `spec-validation-loop` that chains six sub-activities into a goal-driven loop with convergence detection and budget/sequence stopping
- **Six new sub-activities**: `define-specification`, `spec-to-enforcement-activity`, `enforcement-to-validation-activity`, `map-components-to-validations`, `update-specs-from-validation`, `synchronize-spec-validation`
- **Five new impulse shapes**: `specification`, `enforcement_activity`, `validation_mapping`, `validation_result`, `sync_report` — defined by usage, no vessel code registration required
- **MiniBob `--single` mode stopping condition**: halt when goal satisfied, budget exhausted, or max-sequences reached; add `--budget` and `--max-sequences` CLI flags if not present
- **Demonstration test**: cellular automata web app created in `/tmp/` via the loop and verified via playwright_mcp

## Capabilities

### New Capabilities

- `spec-validation-loop`: The composable seven-activity loop — define specs, convert to enforcement and validation activities, map to components, update from results, synchronize, repeat
- `minibob-single-stopping`: Budget- and sequence-bounded execution for `minibob --single` mode

### Modified Capabilities

(none — no existing spec-level requirements change)

## Impact

- `repos/minibob/src/embedded-templates/` — six new activity template JSON files + one meta-activity JSON
- `repos/minibob/index.ts` — `--budget` and `--max-sequences` flag handling; stopping condition in single-mode loop
- `repos/minibob/src/goal-processor.ts` — stopping condition propagation to activity dispatch
- No vessel code changes; no new endpoints; no schema migrations
