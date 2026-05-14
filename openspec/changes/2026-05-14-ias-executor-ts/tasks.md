# Tasks: ias-executor-ts

## 1. Repo contract and boundaries

- [ ] 1.1 Create `repos/ias-executor-ts` as a distinct repository target in the super-repo, keyed to private upstream `avigopal/ias-executor-ts.git`
- [ ] 1.2 Write repo-level README positioning it as a reference TypeScript implementation of the impulse-activity execution model, not a MiniBob shell
- [ ] 1.3 Document the purity contract in the repo docs: ontology-first API, no hidden privileged path, side effects behind ports, runtime-instance-not-singleton, transport-agnostic core
- [ ] 1.4 Define package/module layout matching this design: `ontology/`, `core/`, `ports/`, `adapters/`, `events/`, optional `hosts/examples/`
- [ ] 1.5 Set up root hygiene to match the super-repo/vessel conventions: metadata at root, source under `src/`, tests under `test/` or `tests/`, scripts under `scripts/`, docs under `docs/`
- [ ] 1.6 Install and commit the vessel pre-commit hook for `repos/ias-executor-ts`
- [ ] 1.7 Create initial package metadata with explicit `type`, `exports`, `build`, `test`, and `typecheck` scripts

## 1a. Iteration loop

- [ ] 1a.1 Define Milestone A acceptance criteria: ontology package + in-memory runtime skeleton + no host imports in core
- [ ] 1a.2 Define Milestone B acceptance criteria: core execution semantics + lifecycle events + trace assembly + pure binding tests
- [ ] 1a.3 Define Milestone C acceptance criteria: ports complete + Node/Bun adapter bundle + fixtures pass under real adapters
- [ ] 1a.4 Define Milestone D acceptance criteria: thin demo host works and MiniBob adoption plan is actionable
- [ ] 1a.5 Require every milestone to keep `typecheck`, pure unit tests, and in-memory integration tests green before moving to the next milestone

## 2. Ontology package

- [ ] 2.1 Define canonical types for impulses, activities, tasks, resolver configs, execution traces, lifecycle events, failure modes, and resolver tiers
- [ ] 2.2 Remove MiniBob-specific naming from public ontology exports
- [ ] 2.3 Ensure ontology package has zero host/runtime imports
- [ ] 2.4 Add unit tests for ontology invariants and serialization stability

## 3. Core engine

- [ ] 3.1 Implement `ActivityExecutor` as a host-agnostic engine over runtime-owned dependencies
- [ ] 3.2 Separate task sequencing, nested composition, lifecycle emission, and trace assembly from host shells
- [ ] 3.3 Make budget/failure propagation explicit in engine state rather than ambient globals
- [ ] 3.4 Add in-memory integration tests proving fixture activities execute without filesystem/network/process adapters

## 4. Resolver runtime

- [ ] 4.1 Define resolver contract and resolver context independent of MiniBob runtime modules
- [ ] 4.2 Implement resolver registry as a runtime-owned instance, not a process-global singleton
- [ ] 4.3 Separate core resolver runtime from host-specific resolvers (file/bash/git/etc.)
- [ ] 4.4 Add contract tests for resolver registration, dispatch, failure behavior, and trace/event emission

## 5. Impulse runtime

- [ ] 5.1 Implement `ImpulseStore` as a pure runtime-owned component
- [ ] 5.2 Separate impulse lifecycle semantics from websocket broadcasting, discovery routing, and MCP-specific logic
- [ ] 5.3 Expose metadata-first formatting and loaded-summary APIs for hosts
- [ ] 5.4 Add tests for create/load/update/unload behavior with mocked ports/providers

## 6. Ports

- [ ] 6.1 Define first-class ports for filesystem, process, git, fetch, LLM, clock, randomness, user input, template provision, recommendation, capability index, trace sink, and event sink
- [ ] 6.2 Ensure the core engine depends only on ports and ontology types
- [ ] 6.3 Provide mock/fake port implementations for tests
- [ ] 6.4 Document intended usage of each port and what kinds of downstream hosts should implement it

## 7. Node/Bun adapter bundle

- [ ] 7.1 Create the first production adapter bundle for server-side hosts
- [ ] 7.2 Extract filesystem/process/git behavior behind adapter implementations instead of inline Bun calls in core logic
- [ ] 7.3 Keep adapter package free of daemon/CLI/websocket shell concerns
- [ ] 7.4 Add adapter contract tests against fixture behaviors currently expected by MiniBob execution flows
- [ ] 7.5 Keep adapter validation separate from pure-runtime validation; adapter tests must complement, not replace, in-memory engine tests

## 8. Event and trace surfaces

- [ ] 8.1 Define neutral runtime events for activity/task/impulse/lifecycle boundaries
- [ ] 8.2 Define trace sink contract separate from transport and persistence mechanisms
- [ ] 8.3 Ensure hosts can map runtime events to CLI, websocket, dashboards, or persistence without core changes
- [ ] 8.4 Add tests proving events are emitted consistently across success, failure, and nested composition

## 9. MiniBob consumption path

- [ ] 9.1 Map current `repos/minibob` modules into three buckets: migrate into core, reimplement as adapters, keep in MiniBob shell
- [ ] 9.2 Define the minimal host integration layer MiniBob will need to embed `ias-executor-ts`
- [ ] 9.3 Identify singleton/global state in MiniBob that must become runtime-owned instances before migration
- [ ] 9.4 Author a follow-on migration plan for MiniBob to adopt the new repo incrementally

## 10. Validation

- [ ] 10.1 Validate that a pure in-memory host can execute fixture activities without host effects
- [ ] 10.2 Validate that a Node/Bun host can execute the same fixtures by supplying adapters only
- [ ] 10.3 Validate that no core package imports Bun APIs directly
- [ ] 10.4 Validate that no core package imports MiniBob shell/runtime modules directly
- [ ] 10.5 Validate that all meaningful behavior remains expressible as activities calling resolvers with observable traces/events
- [ ] 10.6 Validate repo hygiene: no root-level cruft, no loose test files outside test directories, no ad-hoc scripts outside `scripts/`
