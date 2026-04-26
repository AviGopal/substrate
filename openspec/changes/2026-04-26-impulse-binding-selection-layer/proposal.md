## Why

When a task is about to run, two binding decisions happen, and both are currently hardcoded in MiniBob:

1. **Pool selection** — multiple impulses match the required shape; the executor picks the first one without consulting relevance scores or any learnable signal.
2. **Producer selection** — no impulse matches; the executor calls `synthesizeShapeImpulsesFromVariables` and falls back to `fillMissingShapesViaMemoryAgent` (an LLM call inside the executor) to fabricate one.

Both paths live as private methods on `ActivityExecutor` (`repos/minibob/src/activity.ts:4172`, `:4212`, with the call sites at `:4949-4997`) and reach into `SessionMemoryAgent` (`repos/minibob/src/memory-agent.ts`) directly. This violates the project's pure-vessel constraint — adding a new shape or a new selection strategy requires editing minibob source. It also keeps the binding decision opaque to the workbench, which has no way to surface the candidate set or accept a manual override as training signal.

The fix is to lift binding into activity space: emit a lifecycle event, register two resolvers that templates can call, migrate the hardcoded synthesizers to a third resolver, and ship a slot-binding meta-activity that chains them. The workbench gains a shape-slot primitive that visualises the bound/bindable/unbindable states and writes manual overrides back as `impulseRelevance` deltas.

## What Changes

- **Lifecycle event** — emit `lifecycle:task:preBinding` from `ActivityExecutor` between task-group entry and the `canExecuteTask` check (`repos/minibob/src/activity.ts:2315` / `:4406`). Pure infrastructure; carries the task, current impulse pool, and missing shapes.
- **`impulse_pool_selection` resolver** — given candidates for a shape and the target task, return the chosen impulse. Reads the `impulseRelevance` shape from activity-api (`repos/metabob-activity-api/src/routes/impulses.ts:1542-1626`). Modes: `deterministic` (highest relevance wins) and `thompson` (Beta sample over α/β tracked per `(shape, taskId)` pair).
- **`producer_selection` resolver** — given a missing shape and goal context, return a producer activity reference. Reads `compositionSuccess` (`repos/metabob-activity-api/src/routes/impulses.ts:1488-1540`) and the new `candidates_with_scores` mode on `discover-by-shapes` (see below). Same selection-method config as the pool resolver.
- **`impulse_preparation` resolver** — wraps the existing `synthesizeShapeImpulsesFromVariables` and `fillMissingShapesViaMemoryAgent` paths plus `SessionMemoryAgent` (LLM-backed intent analysis). Becomes a template-dispatchable migration target so the executor stops calling them directly.
- **`discover-by-shapes` mode extension** — add `candidates_with_scores` to the existing route at `repos/metabob-activity-api/src/routes/activities.ts:3355-3499`. Returns producers for a shape with composition-success edge weights attached. No new endpoint.
- **`slot-binding` meta-activity** — new embedded template subscribing to `lifecycle:task:preBinding`. Chains `impulse_preparation` → `impulse_pool_selection` → `producer_selection`, returning supplemental impulses the downstream task consumes.
- **Hardcoded code removal** — delete the call sites at `repos/minibob/src/activity.ts:4949-4997` once the meta-activity is registered. The private synthesizer methods stay (called from the resolver) but stop being executor-internal.
- **Workbench shape-slot primitive** — each task-input slot renders in three visual states: `bound` (green, lineage match), `bindable` (gradient, candidates exist), `unbindable` (red, escalates to `shape-provider-goal-creation`). Manual overrides write back via `impulseRelevance_write`. Extends existing trajectory components.

## Capabilities

### New Capabilities

- `selection-resolvers`: Two template-dispatchable resolvers (`impulse_pool_selection`, `producer_selection`) that turn pool and producer choice into observable, learnable activity-space decisions.
- `lifecycle-task-prebinding`: New executor lifecycle event emitted before `canExecuteTask`, carrying enough payload for subscriber meta-activities to enrich the impulse pool.
- `slot-binding-meta-activity`: Embedded template that chains the binding resolvers and replaces the hardcoded executor path.
- `discover-by-shapes-mode-extension`: A `candidates_with_scores` mode on the existing route that returns producers ranked by composition-success edge weights.
- `impulse-preparation-resolver`: Template-dispatchable wrapper for the variable-synthesis and memory-agent paths previously baked into the executor.
- `workbench-shape-slot-primitive`: Visual primitive for the three slot states (bound / bindable / unbindable) and the manual-override training-signal path.

### Modified Capabilities

None. This change adds new resolvers and a new lifecycle event; it does not modify any existing spec's contract. The hardcoded executor paths being replaced were never spec'd.

## Impact

- `repos/minibob/src/activity.ts` — emit `lifecycle:task:preBinding`; remove direct calls to `synthesizeShapeImpulsesFromVariables` and `fillMissingShapesViaMemoryAgent`; register three new resolvers in `initializeResolvers()`.
- `repos/minibob/src/resolvers/impulse-pool-selection-resolver.ts` (new), `repos/minibob/src/resolvers/producer-selection-resolver.ts` (new), `repos/minibob/src/resolvers/impulse-preparation-resolver.ts` (new).
- `repos/minibob/src/embedded-templates/slot-binding.json` (new) and registration in `repos/minibob/src/embedded-templates/index.ts`.
- `repos/metabob-activity-api/src/routes/activities.ts` — add `candidates_with_scores` mode to the `/discover-by-shapes` handler.
- `repos/workbench/src/components/trajectory/ResolverTierBadge.tsx`, `ShapeCompatibilityIndicator.tsx`, `ImpulseStatePanel.tsx`, `ApplicableActivitiesPanel.tsx` — extend with slot-state rendering and override surface.
- New tests for each resolver, the meta-activity, the route mode, and the workbench slot primitive.

## Dependencies

- Sibling spec `shape-provider-goal-creation` (in flight, same date) handles the unbindable escalation path. This spec references it but does not duplicate goal-creation behaviour.
- Sibling spec `validators-and-failure-modes` (in flight, same date) reuses the `producer_selection` resolver defined here to choose among validator candidates (filtered by `output_shapes: ["validation_result"]`), and layers an additive `output_shapes` filter on `discover-by-shapes-mode-extension`'s backward path. This spec defines the resolver and the mode; the sibling spec extends the filter without modifying the contracts here. Slot-binding success/failure is recorded via the unified `validation_result` shape that sibling spec defines.
