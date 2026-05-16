# Proposal: ias-executor-ts

## Why

`repos/minibob` already contains much of the impulse-activity execution logic, but it is still fused to the MiniBob vessel shell:

- Bun/platform APIs are called inline across the executor, impulse layer, and tools.
- Network/runtime concerns (MCP, discovery, websocket broadcasting, identity/auth assumptions) leak into core execution paths.
- Operational shell concerns (CLI, daemon, boredom, waking activities, health endpoints) live adjacent to the engine and make the true engine boundary hard to preserve.

We want a separate repository, `repos/ias-executor-ts`, keyed to the private GitHub repository `avigopal/ias-executor-ts.git`, that is not "MiniBob minus some files" but a reference TypeScript implementation of the **impulse-activity execution model** itself.

The design goal is **idiomatic purity**:

1. All meaningful behavior is organized through activities calling resolvers.
2. The engine speaks in ontology-native primitives (`Impulse`, `Activity`, `Resolver`, `ExecutionTrace`, `LifecycleEvent`), not MiniBob-specific runtime concepts.
3. Side effects and operational concerns are pushed to explicit adapters and host shells.
4. The same engine can be embedded by MiniBob, a browser host, tests, or a future vessel without inheriting MiniBob's daemon/CLI/network topology.

## What Changes

This change defines the architecture, component boundaries, and work breakdown for a new repository:

- `repos/ias-executor-ts`
- upstream/private remote: `avigopal/ias-executor-ts.git`

The repo will contain:

- a pure core ontology and execution engine,
- explicit ports/adapters for host effects,
- a modular resolver system,
- trace/event emission surfaces,
- host-facing composition points for downstream vessels,
- and a thin integration path for MiniBob to consume it later.

This change does **not** implement the repo. It establishes the spec for what the repo is and what it is not.

## Capabilities

### New Capabilities

- `ias-executor-core` — pure impulse/activity/resolver ontology and execution semantics
- `ias-runtime-ports` — explicit host interfaces for side effects and environment access
- `ias-resolver-runtime` — resolver registration, dispatch, lifecycle routing, and execution contracts
- `ias-trace-events` — neutral event and trace emission model for hosts to consume
- `ias-host-adapters` — host-specific adapter packages (Node/Bun first; browser-compatible later)

### Modified Capabilities

- None yet. This is additive. MiniBob becomes a downstream consumer in a later implementation change.

## Scope

**In scope**

- Define what "idiomatically pure" means for `ias-executor-ts`
- Define component boundaries for the new repo
- Define which concerns stay in the core vs move to adapters vs remain in host shells
- Define the intended use of each major component
- Define the repo-level work breakdown

**Out of scope**

- Moving code from `repos/minibob`
- Creating the repo directory or wiring git remotes
- Implementing adapters or publishing packages
- Refactoring MiniBob to consume the new repo

## Impact

The main impact is architectural clarity:

- `repos/minibob` stops being the de facto home of the generic execution engine
- the execution model becomes its own reusable runtime substrate
- future vessels can embed the executor without inheriting MiniBob shell logic
- purity constraints become explicit and testable instead of implicit and aspirational

## Dependencies

- Foundational alignment with `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- Design continuity with `openspec/changes/minibob-browser-core/`
- Future follow-on implementation change(s) to create `repos/ias-executor-ts` and progressively migrate MiniBob to consume it
