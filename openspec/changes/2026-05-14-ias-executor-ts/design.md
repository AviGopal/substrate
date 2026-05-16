# Design: ias-executor-ts

## Context

The executor we want already exists in partial form inside `repos/minibob`, but it is wrapped in two kinds of coupling:

```text
platform coupling
  Bun.file / Bun.spawn / Bun.Glob / Bun.serve / process-global IO

runtime coupling
  MCP, discovery, websocket broadcasting, daemon startup, boredom, auth assumptions
```

The new repo must extract the **execution substrate**, not merely copy the current code into a new location.

The right target is:

```text
ias-executor-ts
├─ ontology      what the primitives mean
├─ core engine   how activities execute and compose
├─ runtime ports how effects enter/leave the engine
├─ resolvers     how capabilities are exposed to activities
└─ adapters      host-specific implementations of the ports
```

---

## What "idiomatically pure" means

For this repo, "idiomatically pure" means:

### P1. Ontology-first API

The public API is framed in the system's primitives:

- `Impulse`
- `ActivityTemplate`
- `Resolver`
- `ExecutionTrace`
- `LifecycleEvent`
- `ExecutionRuntime`

The repo must not expose MiniBob-specific public abstractions like daemon, ACP server, boredom, or vessel observer as part of its core API.

### P2. No hidden privileged path

If the engine can do something meaningful, that ability must be visible as:

- a resolver capability,
- an activity task using that resolver,
- and a trace/event emitted by the runtime.

No special controller/service path should bypass resolver dispatch while still counting as "engine behavior".

### P3. Side effects behind ports

Core modules must not directly depend on Bun, filesystem, subprocesses, HTTP transport, websocket transport, or process-global state. Those effects must enter through explicit ports.

### P4. Runtime instance, not singleton world

The core engine is instantiated as a runtime object. It does not rely on ambient global stores for:

- impulse storage,
- resolver registry,
- lifecycle dispatcher,
- trace sink,
- template provider,
- recommendation provider.

### P5. Transport-agnostic contracts

The core knows contracts, not concrete network paths. It should depend on interfaces like `TemplateProvider` and `TraceSink`, not raw REST endpoints or websocket payload contracts.

### P6. Host shell stays outside

CLI, daemon/server, boredom, waking activities, health endpoints, discovery registration, and auth bootstrap remain outside the repo's pure core. If examples are added, they must be explicitly labeled as host examples, not the center of the design.

### P7. Prefer attached explicit vessels over implicit built-ins

The executor should remain small. Filesystem capability, LLM capability, web-search capability, and other effect-bearing capability bundles should be attached from the outside through explicit ports, adapters, or externally-provided resolver sets.

The core may still have internal runtime structure, but it should avoid growing a large shadow world of implicit vessels that are effectively hidden built-ins. If a host wants filesystem, LLM, or web search behavior, that attachment should be visible in runtime construction.

---

## Component model

## 1. `ontology/`

**Intent**

Define the canonical TypeScript representation of the impulse-activity system's primitives.

**Contains**

- `Impulse`
- `ImpulsePointer`
- `ImpulseMetadata`
- `ActivityTemplate`
- `ActivityTask`
- `ResolverConfig`
- `ExecutionTrace`
- `FailureMode`
- `LifecycleEvent`
- `ResolverTier`

**How it should be used**

- Imported by every other package/module
- Stable and small
- Free of host behavior and side effects

**What it must not do**

- No Bun imports
- No network calls
- No runtime registration

---

## 2. `core/engine`

**Intent**

Execute activities, compose nested executions, bind impulses to tasks, emit lifecycle events, and assemble traces.

**Contains**

- `ActivityExecutor`
- task sequencing
- nested composition semantics
- lifecycle emission
- execution result assembly
- budget/failure propagation semantics

**How it should be used**

- A host creates an `ExecutionRuntime`
- The runtime is configured with ports, registries, and providers
- The host calls `executor.execute(template, options)`

**What it must not do**

- No direct filesystem/process/http calls
- No self-construction of MiniBob runtime services
- No websocket broadcasting directly

---

## 3. `core/binding`

**Intent**

Provide pure logic for:

- impulse matching,
- shape compatibility,
- binding decisions,
- validation gating,
- composition-safe task readiness.

**Contains**

- shape matching
- task/input compatibility checks
- missing-shape analysis
- lifecycle subscription matching

**How it should be used**

- Called by the executor before task dispatch
- Can be tested purely in memory
- Can be reused by higher-level recommenders or UIs

**What it must not do**

- No network lookups
- No store mutation as a hidden side effect

---

## 4. `core/resolvers`

**Intent**

Define the resolver contract and the resolver runtime.

**Contains**

- `Resolver` interface
- resolver registry
- resolver dispatch rules
- resolver context model
- standard resolver result shape

**How it should be used**

- Hosts register resolvers into the runtime
- Activities refer to resolvers by ID
- The executor dispatches via the registry only

**What it must not do**

- No host-specific assumptions
- No implicit global registry

---

## 5. `core/impulses`

**Intent**

Provide the impulse store and impulse lifecycle semantics.

**Contains**

- `ImpulseStore`
- create/load/unload/update behavior
- loaded-summary APIs
- metadata-first formatting helpers

**How it should be used**

- The executor and resolvers interact with a runtime-owned store instance
- Hosts may observe impulse events through the event sink

**What it must not do**

- No direct websocket broadcasting
- No embedded MCP/discovery logic in the store itself

---

## 6. `ports/`

**Intent**

Express every host effect as an explicit interface.

**Initial ports**

- `FileSystemPort`
- `ProcessPort`
- `GitPort`
- `FetchPort`
- `LLMPort`
- `ClockPort`
- `RandomPort`
- `TemplateProvider`
- `RecommendationProvider`
- `TraceSink`
- `EventSink`
- `CapabilityIndex`
- `AttachedVesselRegistry`
- `UserInputPort`

**How it should be used**

- Passed into runtime construction
- Mocked in tests
- Implemented by host adapter packages

**What it must not do**

- No default global implementations hidden in core

**Notes**

- `AttachedVesselRegistry` is the explicit runtime view of capability-bearing attachments available to the executor in this host context.
- A host may attach a filesystem vessel, LLM vessel, web-search vessel, remote-capability vessel, or an in-memory test vessel through this surface.
- Discovery-backed capability lookup is one possible implementation behind this port, not a core assumption.

---

## 7. `adapters/node` (or `adapters/bun-node`)

**Intent**

Provide the first production-grade host adapter bundle for server/runtime use.

**Contains**

- filesystem implementation
- subprocess implementation
- git implementation
- Node/Bun-backed hashing/time/random support
- host utilities for loading templates and writing traces
- optional attached capability bundles such as filesystem-backed resolvers or process-backed resolvers

**How it should be used**

- Imported by MiniBob or by a standalone host
- Supplies the ports required by the core runtime
- Optionally contributes attached explicit vessels/resolver bundles to the runtime at construction time

**What it must not do**

- It is not the engine
- It should not contain daemon/CLI logic

---

## 8. `adapters/browser` (later phase)

**Intent**

Provide a browser-compatible adapter bundle for workbench/local execution.

**Contains**

- browser file APIs or virtual FS
- browser-safe git strategy
- proxied process execution where needed
- IndexedDB or in-memory persistence
- browser-attached capability bundles such as browser-LLM, browser-search, or virtual-filesystem resolvers

**How it should be used**

- Browser hosts compose it with the same core engine
- Browser hosts decide which explicit capability vessels to attach for a given session/use case

**What it must not do**

- No MiniBob-specific websocket/event contracts in the core browser adapter surface

---

## 9. `events/`

**Intent**

Define neutral runtime events emitted by the engine.

**Contains**

- `activity.started`
- `task.started`
- `task.completed`
- `activity.completed`
- `activity.failed`
- `impulse.created`
- `impulse.loaded`
- `lifecycle.emitted`

**How it should be used**

- Consumed by hosts for CLI progress, websocket broadcasting, dashboards, or logging
- Also used for trace assembly if the host chooses event-sourced trace sinks

**What it must not do**

- No Bun `ServerWebSocket`
- No hardcoded browser transport

---

## 10. `hosts/examples` (optional, non-core)

**Intent**

Demonstrate embedding patterns without reintroducing shell coupling.

**Contains**

- tiny in-memory host
- maybe a minimal node demo

**How it should be used**

- Documentation and smoke testing only

**What it must not do**

- Must not become the real runtime center

---

## Attached capability vessels

To avoid a large implicit-vessel footprint, the executor should make capability attachment explicit:

```text
host runtime
  ├─ core executor
  ├─ attached filesystem vessel
  ├─ attached llm vessel
  ├─ attached web-search vessel
  └─ attached remote/discovery-backed vessel
```

These do not need to be "vessels" in the deployment sense every time; they may be local adapter-backed resolver bundles. What matters is that they are explicit in the runtime shape rather than silently assumed by the core.

### Why this matters

- keeps the executor small and inspectable
- makes capability availability a host/runtime decision
- avoids hardcoding Bun/server assumptions into the core
- makes tests honest: the test runtime attaches only what it means to exercise
- lets the same executor be used in different environments with different capability topologies

### Preferred pattern

The host should construct the runtime by attaching capability bundles intentionally:

- **minimal test host** — only in-memory transform/validation/activity bundles
- **server host** — filesystem + process + git + LLM bundles
- **browser host** — browser LLM + browser search + virtual filesystem bundles
- **networked host** — remote capability bundle backed by discovery/provider lookup

The executor should be able to answer "what capabilities are attached right now?" without smuggling in hidden built-ins.

---

## Component usage map

| Component | Primary users | Why it exists |
|---|---|---|
| `ontology/` | all modules | stable shared language for the model |
| `core/engine` | hosts, tests | execute activities and compose traces |
| `core/binding` | engine, recommenders, tests | reason about shapes and task readiness |
| `core/resolvers` | engine, hosts | expose capabilities to activities |
| `core/impulses` | engine, resolvers | hold and resolve impulse state |
| `ports/` | hosts, adapters | isolate effects and environment assumptions |
| `adapters/node` | MiniBob, server hosts | production runtime implementation |
| `adapters/browser` | workbench/browser hosts | browser embedding path |
| `events/` | hosts, trace sinks | observe runtime behavior without coupling transport |

---

## What stays out of `ias-executor-ts`

These are explicitly **not** core executor concerns:

- CLI parsing
- REPL command handling
- daemon HTTP server
- ACP server
- boredom/autonomous activity scheduling
- vessel registration with discovery
- auth middleware and vessel-session handshake
- canary deployment logic
- MiniBob websocket server

Those are valid vessel-shell features, but they are downstream of the executor.

---

## How MiniBob should eventually use it

```text
MiniBob shell
  ├─ CLI / daemon / boredom / websocket
  ├─ MiniBob-specific adapters + providers
  └─ ias-executor-ts runtime
       ├─ ontology
       ├─ engine
       ├─ impulses
       ├─ resolver runtime
       └─ events
```

MiniBob becomes a host/vessel embedding the executor, rather than the executor's canonical home.

---

## Success criteria for the repo design

The design is successful when the future implementation can satisfy these tests:

1. A fully in-memory runtime can execute fixture activities with mock resolvers and no filesystem/network/process access.
2. A Node/Bun host can provide adapters and run the same engine without modifying core code.
3. No core module imports Bun APIs directly.
4. No core module depends on MiniBob runtime modules like boredom, websocket broadcasting, or daemon startup.
5. All meaningful execution behavior remains visible through activities calling resolvers and through emitted runtime events/traces.

---

## Open design questions

### Q1. How much recommendation logic belongs in the repo?

Recommendation and retrieval may remain external providers rather than core engine logic. The engine should not require Thompson sampling to exist in order to execute activities.

### Q2. Should the first adapter target be Bun-specific or Node-compatible?

Purity suggests a Node-compatible adapter surface with Bun-supported implementation details, but migration ease from MiniBob suggests Bun-first extraction. This is an implementation choice, not a core design blocker.

### Q3. Should lifecycle subscribers be part of the engine core?

Current direction: yes, but as pure subscription/routing semantics. Their transport, storage, and retrieval should remain adapter/provider concerns.

---

## Implementation and test loop

The repo should be built iteratively, with each phase producing a runnable, testable substrate before adding the next layer of host complexity.

```text
1. Define ontology
   ↓
2. Build pure in-memory runtime
   ↓
3. Add resolver runtime + fixture resolvers
   ↓
4. Add impulse runtime + lifecycle/events
   ↓
5. Add Node/Bun adapter bundle
   ↓
6. Validate host embedding via thin demo host
   ↓
7. Plan MiniBob adoption as a downstream consumer
```

### Loop rule

Every implementation slice should follow the same loop:

1. **Define the boundary first** — update ontology/ports/contracts before wiring behavior.
2. **Implement the smallest working vertical slice** — prefer an in-memory fixture host before adding real adapters.
3. **Typecheck + test at slice granularity** — don't defer validation until the repo is "mostly there".
4. **Preserve purity before convenience** — if a shortcut introduces shell coupling into core, push it behind a port instead.
5. **Only then add a host adapter** — filesystem/process/git/network/LLM come after the pure path exists.

### Suggested implementation milestones

#### Milestone A — Pure ontology and runtime skeleton

- ontology package compiles
- runtime can be constructed
- no Bun or host imports in core
- fixture activity executes through fake resolver registry

#### Milestone B — Core execution semantics

- nested activity execution works in memory
- lifecycle events emit through neutral event sink
- traces assemble correctly
- impulse binding + missing-shape detection are test-covered

#### Milestone C — Effect ports and first real adapters

- ports are fully defined
- Node/Bun adapter bundle satisfies the ports
- same fixtures pass under fake adapters and real adapters

#### Milestone D — Downstream host proof

- a thin demo host can execute real activities through the runtime
- MiniBob adoption plan is specific enough to begin incremental migration

---

## Repo setup and hygiene expectations

The new repo should look like the other TypeScript vessel repos in the super-repo where that structure reinforces clarity, but it should stay leaner because it is a runtime substrate rather than a full vessel shell.

### Root layout

The repo root should contain only project metadata and clearly-named top-level source areas:

- `package.json`
- `tsconfig.json` (+ build config if needed)
- `README.md`
- lockfile
- dotfile configs
- `src/`
- `test/` or `tests/`
- `docs/` (if needed)
- `scripts/` (if needed)

It should **not** accumulate loose notes, ad-hoc scripts, root-level tests, or screenshot artefacts. This follows the same hygiene documented in `scripts/git-hooks/README.md` in the super-repo.

### Package conventions

Following the healthier TS repos in `repos/*`, the package should include:

- ESM module mode
- explicit `exports`
- build script
- test script
- typecheck script
- repository metadata

Preferred baseline shape:

```json
{
  "type": "module",
  "scripts": {
    "build": "...",
    "test": "...",
    "typecheck": "tsc --noEmit"
  }
}
```

### Validation discipline

At minimum, each implementation milestone should keep these green:

- `typecheck`
- pure unit tests
- in-memory runtime integration tests

Node/Bun adapter tests come after the pure runtime tests exist, not instead of them.

### Hook discipline

When the repo is created, it should adopt the same placement/secrets hygiene as other vessel repos:

- install the vessel pre-commit hook via `scripts/git-hooks/install.sh --vessel repos/ias-executor-ts`
- commit the vessel hook into the vessel repo
- keep root metadata-only, docs in `docs/`, scripts in `scripts/`, tests in `test/` or `tests/`

### Documentation discipline

Use:

- `README.md` for repo purpose and quick start
- `docs/` for stable architectural reference
- `openspec/` in the super-repo for future changes and migration plans

Do **not** let exploratory notes or one-off debugging writeups accumulate in the repo tree.
