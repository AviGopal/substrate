# Tasks: ias-executor-ts

## 1. Repo contract and boundaries

- [x] 1.1 Create `repos/ias-executor-ts` as a distinct repository target in the super-repo, keyed to private upstream `avigopal/ias-executor-ts.git`
- [x] 1.2 Write repo-level README positioning it as a reference TypeScript implementation of the impulse-activity execution model, not a MiniBob shell
- [x] 1.3 Document the purity contract in the repo docs: ontology-first API, no hidden privileged path, side effects behind ports, runtime-instance-not-singleton, transport-agnostic core
- [ ] 1.4 Define package/module layout matching this design: `ontology/`, `core/`, `ports/`, `adapters/`, `events/`, optional `hosts/examples/`
- [x] 1.5 Set up root hygiene to match the super-repo/vessel conventions: metadata at root, source under `src/`, tests under `test/` or `tests/`, scripts under `scripts/`, docs under `docs/`
- [x] 1.6 Install and commit the vessel pre-commit hook for `repos/ias-executor-ts`
- [x] 1.7 Create initial package metadata with explicit `type`, `exports`, `build`, `test`, and `typecheck` scripts

## 1a. Iteration loop

- [x] 1a.1 Define Milestone A acceptance criteria: ontology package + in-memory runtime skeleton + no host imports in core
- [x] 1a.2 Define Milestone B acceptance criteria: core execution semantics + lifecycle events + trace assembly + pure binding tests
- [x] 1a.3 Define Milestone C acceptance criteria: ports complete + Node/Bun adapter bundle + fixtures pass under real adapters
- [x] 1a.4 Define Milestone D acceptance criteria: thin demo host works and MiniBob adoption plan is actionable
- [x] 1a.5 Require every milestone to keep `typecheck`, pure unit tests, and in-memory integration tests green before moving to the next milestone

## 2. Ontology package

- [x] 2.1 Define canonical types for impulses, activities, tasks, resolver configs, execution traces, lifecycle events, failure modes, and resolver tiers
- [x] 2.2 Remove MiniBob-specific naming from public ontology exports
- [x] 2.3 Ensure ontology package has zero host/runtime imports
- [x] 2.4 Add unit tests for ontology invariants and serialization stability

## 3. Core engine

- [x] 3.1 Implement `ActivityExecutor` as a host-agnostic engine over runtime-owned dependencies
- [x] 3.2 Separate task sequencing, nested composition (compose resolver + subActivityId), lifecycle emission, and trace assembly from host shells — `engine-composition.test.ts` 14 tests
- [x] 3.3 Make budget/failure propagation explicit in engine state — `ExecutionBudget` (maxCostUsd / maxDurationMs / maxTaskCount), BudgetExceededError → `budget_exhausted` FailureMode with context
- [x] 3.4 Add in-memory integration tests proving fixture activities execute without filesystem/network/process adapters

## 4. Resolver runtime

- [x] 4.1 Define resolver contract and resolver context independent of MiniBob runtime modules
- [x] 4.2 Implement resolver registry as a runtime-owned instance, not a process-global singleton
- [x] 4.3 Separate core resolver runtime from host-specific resolvers — `src/adapters/` with `BunFileSystemAdapter` + `BunProcessAdapter`; exported at `./adapters` subpath, not in core index
- [x] 4.4 Add contract tests for resolver registration, dispatch, failure behavior, and trace/event emission — `resolver-contracts.test.ts` 11 tests

## 5. Impulse runtime

- [x] 5.1 Implement `ImpulseStore` as a pure runtime-owned component
- [x] 5.2 Separate impulse lifecycle semantics from websocket broadcasting, discovery routing, and MCP-specific logic
- [x] 5.3 Expose metadata-first formatting and loaded-summary APIs — `ImpulseStore.formatForContext({ shapes?, includeContent? })` returns `ImpulseContextEntry[]`; no content leak unless `includeContent=true && loaded`
- [x] 5.4 Add tests for create/load/update/unload behavior — `impulse-lifecycle.test.ts` 11 tests covering update/unload/findByShape/loadedSummaries/formatForContext

## 6. Ports

- [x] 6.1 Define first-class ports for filesystem, process, git, fetch, LLM, clock, randomness, user input, template provision, recommendation, capability index, trace sink, and event sink
- [x] 6.2 Ensure the core engine depends only on ports and ontology types — verified via typecheck; `src/engine.ts` imports only from `./ontology`, `./impulses`, `./resolvers`, `./runtime`
- [x] 6.3 Provide mock/fake port implementations for tests — `test/fakes.ts`: `SteppingClock`, `SequentialRandom`, `EventSinkSpy`, `TraceSinkSpy`, `FailingTraceSink`
- [ ] 6.4 Document intended usage of each port and what kinds of downstream hosts should implement it
- [x] 6.5 Define an explicit `AttachedVesselRegistry` or equivalent runtime surface for capability attachment
- [ ] 6.6 Ensure discovery-backed capability lookup, when used, lives behind the attachment/capability port rather than inside core execution logic

## 7. Node/Bun adapter bundle

- [x] 7.1 Create the first production adapter bundle for server-side hosts — `src/adapters/` with `BunFileSystemAdapter` + `BunProcessAdapter`; `./adapters` subpath export
- [x] 7.2 Extract filesystem/process/git behavior behind adapter implementations instead of inline Bun calls in core logic — core has zero Bun imports; adapters hold them
- [x] 7.3 Keep adapter package free of daemon/CLI/websocket shell concerns — adapters implement only `FileSystemPort` and `ProcessPort`; no daemon code
- [x] 7.4 Add adapter contract tests against fixture behaviors — `test/adapters.test.ts` 15 tests: write/read/overwrite/unicode/multiline/cwd/exit-code/stderr/timeout against real Bun I/O in tmpdir
- [x] 7.5 Keep adapter validation separate from pure-runtime validation — adapter tests (adapters.test.ts) use real I/O; core tests (runtime.test.ts etc.) use fakes only; no overlap
- [ ] 7.6 Package server-side capability bundles so hosts can explicitly attach filesystem/process/git/LLM vessels rather than relying on hidden built-ins

## 8. Event and trace surfaces

- [x] 8.1 Define neutral runtime events for activity/task/impulse/lifecycle boundaries
- [x] 8.2 Define trace sink contract separate from transport and persistence mechanisms
- [x] 8.3 Ensure hosts can map runtime events to CLI, websocket, dashboards, or persistence without core changes — EventSink + TraceSink are pure interfaces; fakes demonstrate host-side mapping
- [x] 8.4 Add tests proving events are emitted consistently across success, failure, and nested composition — covered in `resolver-contracts.test.ts` + `engine-composition.test.ts`

## 9. MiniBob consumption path

- [x] 9.1 Map current `repos/minibob` modules into three buckets:

  **Bucket A — Migrate into core** (pure execution logic that belongs in ias-executor-ts):
  - `activity.ts` → `ActivityExecutor` (partially migrated; MiniBob's version adds LLM loop on top)
  - `impulse.ts` → `ImpulseStore` + resolution (partially migrated; MiniBob adds discovery routing)
  - `composition-chain.ts` → folded into `ExecutionTrace.compositionChain`
  - `types.ts` / `types/` → `ontology.ts`
  - `activity-tracer.ts` → trace assembly in `ActivityExecutor`
  - `lifecycle-subscriptions.ts` → `EventSink` interface + subscriber pattern
  - `impulse-cooccurrence.ts` → pure co-occurrence analysis; no host deps; migrate
  - `validation.ts` / `schema-validator.ts` → pure schema validation; migrate

  **Bucket B — Reimplement as adapters** (I/O that should live behind ports):
  - `tools.ts` (bash/file/git/read/write tools) → `BunFileSystemAdapter`, `BunProcessAdapter`, `BunGitAdapter`
  - `llm.ts` (Anthropic/OpenAI calls) → `LLMAdapter` implementing `LLMPort`
  - `pricing.ts` (cost calculation) → `CostPort` or inline in `LLMAdapter`
  - `http-client.ts` → `FetchAdapter` implementing `FetchPort`
  - `vessel-discovery.ts` (discovery client) → `CapabilityIndexAdapter` implementing `CapabilityIndex`
  - `auth-service.ts` → `AuthPort` (not yet defined in ports.ts)
  - `mcp.ts` / `mcp-activity-bridge.ts` → `MCPAdapter`
  - `websocket.ts` → `EventSinkAdapter` (WebSocket-backed)
  - `offline-cache.ts` → `FileSystemPort`-backed cache wrapper

  **Bucket C — Keep in MiniBob shell** (daemon, CLI, conversation, session management):
  - `index.ts`, `cli/`, `repl.ts`, `conversational-repl.ts` — entry points and REPL
  - `boredom.ts`, `waking-activities.ts` — autonomous improvement triggers
  - `goal-processor.ts`, `agent-runtime.ts` — MiniBob-specific goal-seeking orchestration
  - `session.ts`, `context-memory-agent.ts`, `memory-agent.ts` — session and memory
  - `background-task-executor.ts`, `process-registry.ts` — MiniBob process management
  - `vessel.ts`, `vessel-bootstrap.ts`, `vessel-hooks.ts`, `vessel-registry.ts` — MiniBob vessel wiring
  - `acp.ts`, `acp-gossip.ts` — Activity Control Protocol (MiniBob-specific mesh)
  - `greeting.ts`, `tutor.ts`, `input.ts`, `output.ts` — conversational UI
  - `improviser.ts` — LLM improvisation loop (orchestration + LLM call, not pure)
  - `embedded-templates/` — MiniBob-specific template pool (host concern)

- [x] 9.2 Define the minimal host integration layer — `src/examples/bun-host.ts`:
  - `BunHost` class: creates `ExecutionRuntime` with `BunFileSystemAdapter`/`BunProcessAdapter`/optional `LLMPort` injected; registers built-in resolvers (`file-read`, `bash`, `llm`); attaches capability vessels (`bun-fs`, `bun-proc`, `llm-vessel`) for explicit capability inspection
  - `ConsoleEventSink`: forwards lifecycle events to stdout — reference implementation for CLI/debug hosts
  - `HttpTraceSink`: POSTs traces to activity-api `/v2/activities/execution-traces` — reference implementation for production hosts
  - Built-in resolvers expose `task.config.path`, `task.config.command`, `task.config.cwd`, `task.config.prompt` as the resolver config surface MiniBob will use
- [x] 9.3 Identify singleton/global state in MiniBob that must become runtime-owned instances before migration:
  - `config.ts` / `getConfig()` — global config singleton → pass as `ExecutionRuntimeOptions`
  - `vessel-registry.ts` — global vessel registry map → `AttachedVesselRegistry` per runtime
  - `vessel-discovery.ts` — singleton discovery client → inject as `CapabilityIndex` port
  - `process-registry.ts` — global process/pid map → runtime-owned map in `ProcessAdapter`
  - `trace-cache.ts` — global trace LRU cache → `TraceSink`-backed per runtime
  - `llm.ts` `getClient()` — singleton LLM client → inject as `LLMPort` per runtime
  - `mcp.ts` `getMcpSession()` — singleton MCP session → inject as `MCPAdapter` per runtime
- [ ] 9.4 Author a follow-on migration plan for MiniBob to adopt the new repo incrementally

## 10. Validation

- [x] 10.1 Validate that a pure in-memory host can execute fixture activities without host effects
- [x] 10.2 Validate that a Node/Bun host can execute the same fixtures by supplying adapters only — `test/bun-host-integration.test.ts` 12 tests: file-read/bash resolvers with real Bun I/O; multi-step fixture (read + count lines); capability listing; missing config error paths
- [x] 10.3 Validate that no core package imports Bun APIs directly
- [x] 10.4 Validate that no core package imports MiniBob shell/runtime modules directly
- [ ] 10.5 Validate that all meaningful behavior remains expressible as activities calling resolvers with observable traces/events
- [x] 10.6 Validate repo hygiene: no root-level cruft, no loose test files outside test directories, no ad-hoc scripts outside `scripts/`
- [x] 10.7 Validate that capability-bearing bundles attached to the runtime are inspectable and explicit; the core does not silently assume filesystem, LLM, or web-search capability when they are absent
