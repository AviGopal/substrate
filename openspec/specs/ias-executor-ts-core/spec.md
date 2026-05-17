# ias-executor-ts-core Specification

## Purpose

Define the architectural contract for `ias-executor-ts`: a reference TypeScript implementation of the impulse-activity execution model whose core is idiomatically pure and can be embedded by multiple hosts or vessels.

---

## Requirements

### Requirement: The repo exposes ontology-native primitives

The public core API SHALL be framed in the impulse-activity system's primitives: impulses, activities, resolvers, execution traces, and lifecycle events. Public core modules SHALL NOT require MiniBob-specific shell concepts in order to use the executor.

#### Scenario: Host imports the core executor
- **WHEN** a host imports the core executor package
- **THEN** it can construct and use the runtime through ontology-native types and ports
- **THEN** it does not need CLI, daemon, boredom, websocket, or vessel-registration modules

---

### Requirement: Core execution behavior is host-agnostic

The core engine SHALL execute activities, dispatch resolvers, bind impulses, emit lifecycle events, and assemble traces without directly depending on Bun APIs, filesystem APIs, subprocess APIs, or transport-specific network APIs.

#### Scenario: In-memory runtime executes fixture activity
- **WHEN** a test host provides fake ports and fake resolvers
- **THEN** the core engine executes a fixture activity entirely in memory
- **THEN** no filesystem, subprocess, or network dependency is required

#### Scenario: Node/Bun host provides adapters
- **WHEN** a server-side host provides concrete filesystem/process/git/LLM adapters
- **THEN** the same core engine executes without modification

---

### Requirement: Side effects enter through explicit ports

All host effects SHALL be expressed as explicit interfaces owned by the runtime boundary, including at minimum filesystem, process, git, fetch, LLM, time, randomness, template provision, trace sink, and event sink concerns.

#### Scenario: Host swaps filesystem implementation
- **WHEN** one host provides a real filesystem adapter and another host provides an in-memory filesystem adapter
- **THEN** the core engine behavior remains the same apart from the adapter-supplied effects

---

### Requirement: Capability-bearing vessels are attached explicitly

The core runtime SHALL prefer explicit attachment of capability-bearing resolver bundles over hidden built-in implicit vessels. If filesystem, LLM, web-search, remote capability, or similar behavior is available to a runtime, that availability SHALL be visible through runtime construction or capability attachment surfaces.

#### Scenario: Minimal runtime has no filesystem capability
- **WHEN** a host constructs a minimal in-memory runtime without attaching a filesystem capability bundle
- **THEN** the core executor does not silently assume file access exists
- **THEN** activities requiring filesystem-backed resolvers fail or remain unavailable in an observable way

#### Scenario: Host attaches an LLM capability bundle
- **WHEN** a host attaches an LLM-backed resolver bundle to the runtime
- **THEN** activities that use the `llm` resolver can execute through that attachment
- **THEN** the presence of LLM capability is explicit in runtime configuration rather than hidden inside the core

#### Scenario: Discovery-backed remote capability is used
- **WHEN** a host wants the runtime to use remote or connected-vessel capabilities
- **THEN** it provides that behavior through an explicit capability/attachment interface
- **THEN** the core executor does not depend directly on vessel discovery as an intrinsic built-in

---

### Requirement: Core runtime has no hidden privileged path

Any meaningful behavior performed by the executor SHALL remain visible as activities calling resolvers, plus emitted events and traces. The core SHALL NOT include a separate privileged orchestration path that bypasses resolver dispatch while still counting as engine behavior.

#### Scenario: Capability is available to the runtime
- **WHEN** the runtime can perform a host capability
- **THEN** that capability is exposed via a resolver or port-driven resolver implementation
- **THEN** activity execution and trace emission reflect that behavior

---

### Requirement: Core runtime is instance-owned, not singleton-owned

Impulse stores, resolver registries, lifecycle dispatchers, trace sinks, and template providers SHALL be owned by a runtime instance or explicitly passed dependency graph, not by process-global singleton state.

#### Scenario: Two runtimes in one process
- **WHEN** a process constructs two independent executor runtimes
- **THEN** their impulses, resolver registrations, lifecycle subscriptions, and emitted traces do not leak across instances unless explicitly wired together by the host

---

### Requirement: Host shells remain outside the core repo surface

CLI handling, daemon/server hosting, boredom/autonomous scheduling, websocket broadcasting, auth middleware, vessel registration, and deployment-specific bootstrap behavior SHALL NOT be required parts of the core executor API.

#### Scenario: Host wants websocket broadcasting
- **WHEN** a host wants to stream runtime events over websocket
- **THEN** it consumes the core event surface through an event sink or subscription API
- **THEN** the websocket transport remains a host concern rather than a core concern

---

### Requirement: The repo supports an iterative pure-first implementation loop

The implementation plan for the repo SHALL preserve a pure in-memory path before introducing host adapters. Core ontology, execution semantics, and runtime contracts must be testable without requiring Bun APIs, subprocesses, filesystem access, or networked backend services.

#### Scenario: Pure runtime milestone is validated first
- **WHEN** the first executable milestone of the repo is completed
- **THEN** a fixture activity can execute through fake resolvers and fake ports in memory
- **THEN** the milestone does not depend on Node/Bun adapters in order to validate the engine

#### Scenario: Adapter milestones do not replace pure runtime validation
- **WHEN** later milestones add Node/Bun adapters
- **THEN** the original in-memory runtime tests remain in place and continue to pass
- **THEN** adapter tests are additive rather than substituting for pure-runtime tests

---

### Requirement: Repo hygiene matches the surrounding vessel conventions

The repo SHALL follow the same placement discipline used across the super-repo and vessel repos: root contains project metadata, source lives under source directories, tests live under test directories, scripts live under `scripts/`, and documentation lives under `docs/`.

#### Scenario: Reader inspects repo root
- **WHEN** a developer inspects the repo root
- **THEN** they find project metadata and top-level source areas only
- **THEN** they do not find loose test files, ad-hoc scripts, or transient debugging artefacts at root

#### Scenario: Vessel hook is installed
- **WHEN** the repo is initialized as a vessel repo under `repos/`
- **THEN** it adopts the vessel pre-commit hook and placement conventions consistent with `scripts/git-hooks/README.md`

---

### Requirement: Component responsibilities are explicit

The repo SHALL separate at least the following responsibilities into explicit component areas:

- ontology
- core engine
- resolver runtime
- impulse runtime
- ports
- host adapters
- event/trace surfaces

#### Scenario: Reader inspects the repo layout
- **WHEN** a developer reads the repo structure and package/module boundaries
- **THEN** they can distinguish pure execution semantics from host adapters and from optional host examples

---

### Requirement: The design supports downstream vessel embedding

The repo SHALL be usable as an embedded execution substrate by a downstream vessel such as MiniBob without forcing that vessel to adopt the repo's own CLI/server shell.

#### Scenario: MiniBob embeds the executor
- **WHEN** MiniBob later consumes `ias-executor-ts`
- **THEN** MiniBob supplies adapters, providers, and shell behavior around the executor
- **THEN** MiniBob's CLI/daemon/websocket/boredom logic remains outside the executor core
