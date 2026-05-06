## Why

Three sibling specs land the architectural primitives for an activity-driven impulse-binding loop:

- `2026-04-26-impulse-binding-selection-layer` — slot-binding lifecycle event, `impulse_pool_selection` and `producer_selection` resolvers, slot-binding meta-activity, workbench shape-slot primitive.
- `2026-04-26-shape-provider-goal-creation` — recursive shape provisioning via the `create-shape-provider-goal` activity, `endpoint_output_shapes` field on `goal_execution_paths`.
- `2026-04-26-validators-and-failure-modes` — validators-as-activities with `output_shapes: ["validation_result"]`, the `failure_mode` taxonomy, validator-dispatch meta-activity.

Together these primitives form **the impulse-activity loop**: a fully activity-driven path from goal dispatch through binding, execution, validation, and recursive escalation, with learning signals updating Thompson params at each step.

This change is the **integration spec**. It is drafted incrementally as the three sibling specs are implemented. Each implementation phase produces concrete evidence — a working canary trace, a learning-loop update, an end-to-end goal execution — that feeds back into this change's `design.md`.

## What Changes

This change introduces no new primitives. It:

- Defines the **success criteria** for the integrated loop (below).
- Drives **end-to-end validation against canary** (`activity.metabob.com`) at each implementation milestone.
- Tracks **learnings** that emerge during implementation — design refinements, contract clarifications, tooling gaps — that may seed an additional sibling for the canonical-composition synthesis (LLM-skill template pattern, tools-as-impulses convention, MiniBob self-registered lifecycle bootstrap).
- Captures **dogfood evidence**: goals dispatched, traces inspected, validators firing, learning parameters updating, all observable on the canary.

## Success criteria

The integrated impulse-activity loop is considered complete when, against canary:

1. **Goals regularly succeed and successes are verified correct** — measurable via `goal_verification` traces on `activity.metabob.com` showing `passed: true` with positive evidence.
2. **Failed goals attempt success by appending a new activity** — measurable via `failure_mode.type === "verifier_negative"` traces followed by `create-shape-provider-goal` dispatches that converge on success.
3. **MiniBob operates solely off connected-vessel resolvers** — production goals do not require any embedded template; embedded templates exist only as bootstrap.
4. **The impulse-activity system creates improved, specified, better-wired activities via the executor** — measurable via the ribosome pattern emitting new activity templates whose Thompson α/β converges above embedded-template baselines.
5. **Activities compose using all MiniBob features** — measurable via composition graphs that traverse pool selection, producer selection, validators, and shape-provider escalation in a single goal-resolution trace.
6. **Activity reuse rate trends upward and improvise-share trends downward** — measurable via the `activity-reuse-validation-harness` weekly report. The system getting better at finding the right activity is the empirical signature of topology learning. Phase 18 makes this property observable.

## Topology creation as a core property

The system's topology — the activity graph, its composition edges, and the edge weights — is created and refined entirely through the loop this change orchestrates. Every successful execution adds to a Thompson posterior; every successful improvise extracts a new activity node via ribosome; every composition chain registers an edge with a learned success rate. There is no separate authoring path that produces topology — topology *is* the residue of the learning loop.

This means the loop's quality determines the topology's quality. If posterior updates are noisy (binary on failure regardless of cause), if credit assignment terminates at the leaf (orchestrator activities never accumulate evidence), or if retrieval signals are too thin (only name+description BM25), the topology that emerges is impoverished — even when the rest of the system is correct. Phase 18 closes these gaps so the topology that the loop creates is rich enough to learn from.

## Capabilities

### New Capabilities

- `impulse-activity-loop-validation` — end-to-end validation procedure executed against canary at each phase, with documented expected traces and acceptance criteria.
- `impulse-activity-loop-design-evolution` — a `design.md` that grows incrementally as implementation reveals refinements; learnings archived back into individual sibling specs as appropriate.
- `activity-api-connection-pooling` (added 2026-05-01) — per-process LRU of authenticated SurrealDB sessions in metabob-activity-api, surfaced from Phase 8 validation runs that exposed the connect/auth handshake-per-query as the throughput bottleneck blocking goal completion. See Phase 12 in `design.md` and `specs/activity-api-connection-pooling/spec.md`.
- `tags-fts-index` (added 2026-05-06) — third FTS index on `activity.tags`, weighted between `name` and `description`. Bridges hierarchical-classifier intent (`bugfix.auth.tokens`) that BM25-on-name and dense embeddings both miss. Phase 18.
- `failure-mode-stratified-updates` (added 2026-05-06) — replace the binary β increment on failure with a structured update keyed on `failure_mode.type`. Wires the existing taxonomy into the posterior-update path. Phase 18.
- `composition-chain-credit-propagation` (added 2026-05-06) — γ-discounted backward propagation of α/β updates through `composition_chain` ancestors. Closes the credit-assignment gap that today only credits the leaf activity for a multi-step success. Phase 18.
- `activity-reuse-validation-harness` (added 2026-05-06) — versioned 20-prompt benchmark suite measuring MRR, reuse rate, improvise-share, and Thompson CI widths over time. Replaces ad-hoc validation runs with a longitudinal report. Phase 18.

## Impact

This change orchestrates the three sibling specs but introduces no source-code changes of its own. All concrete edits live in the sibling specs. Canary deployments and validation runs are coordinated here.

## Dependencies

- `2026-04-26-impulse-binding-selection-layer`
- `2026-04-26-shape-provider-goal-creation`
- `2026-04-26-validators-and-failure-modes`

A potential additional sibling — `canonical-goal-resolution-composition` — may emerge from learnings during implementation. It is currently out of scope; flagged in `design.md` as a probable next change.
