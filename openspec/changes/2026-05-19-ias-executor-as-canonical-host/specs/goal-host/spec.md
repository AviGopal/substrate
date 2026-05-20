# Capability: goal-host

The composed host pattern that runs a goal end-to-end against the canonical
ias-executor-ts substrate. Replaces `spawn(MINIBOB_BIN, ["--single", goal])`
as the canonical entry point for autonomous goal execution.

## Requirements

### R1 — Composition surface

GoalHost SHALL compose the following components in its constructor:

- A `BunHost`-equivalent resolver layer (file-read, bash, llm resolvers
  backed by `BunFileSystemAdapter`, `BunProcessAdapter`, and a host-injected
  `LLMPort`). Reference: `repos/ias-executor-ts/src/examples/bun-host.ts:128-
  169`.
- An `ActivityApiAdapter` that exposes three methods: `recommend(req)`,
  `recordTrace(trace)`, `getTemplate(id)`. The adapter SHALL target
  `https://activity.metabob.com` by default and SHALL accept the api-key
  via constructor argument.
- An `HttpDiscoveryAdapter` for shape-based vessel routing (already exists
  in `repos/ias-executor-ts/src/adapters/discovery-adapter.ts`, referenced
  by `vessel-forge-host.ts:19`).
- A lifecycle-subscriber vessel attached via `runtime.attachVessel(...)`
  with `kind: "lifecycle-subscriber"`.
- The shared template catalogue (per design §F) registered as the runtime's
  `templateProvider`.

GoalHost MUST NOT introduce ports beyond those declared in
`repos/ias-executor-ts/src/ports.ts` plus the `ActivityApiAdapter`. Adding a
new port category SHALL require an amendment to this spec.

### R2 — `runGoal` flow

`GoalHost.runGoal(goalText, opts?)` SHALL execute exactly the following
flow:

1. Seed a `goal`-shape impulse into the runtime store with `content = {
   text: goalText, variables: opts?.variables ?? {} }`.
2. Call `activityApi.recommend({ goal: goalText, expected_output_shapes:
   opts?.expectedOutputShapes ?? [] })` and consume the top-ranked template
   id from the response.
3. Load the template via the runtime's `templateProvider`. The catalogue
   provider checks the shared catalogue first; on miss it falls through to
   `activityApi.getTemplate(id)`.
4. Invoke `ActivityExecutor.execute(template, { variables, impulses:
   [goalImpulse] })`.
5. Forward the resulting trace to the `TraceSink` (default:
   `ActivityApiAdapter.recordTrace`). Forward lifecycle events to the
   caller-supplied `EventSink` (default: no-op).
6. Return the trace.

The flow SHALL NOT branch on goal-text pattern matching. The flow SHALL NOT
maintain conversation history between calls. Hosts wanting conversational
behaviour SHALL implement it externally (a thin REPL over `runGoal`).

### R3 — Lifecycle subscriber semantics

Lifecycle subscribers attached to GoalHost SHALL fire automatically when
their declared `subscription.shape` matches an emitted lifecycle event and
their `subscription.filter` matches the event payload. Filter matching SHALL
honour the suffix-predicate conventions:

- `<field>_contains` — payload's `<field>` is an array containing the
  expected value (deep equality).
- `<field>_equals` — payload's `<field>` deep-equals the expected value.
- Bare keys — payload's literal-key value deep-equals the expected.

Filter resolution SHALL try the literal key first, then a snake_case →
camelCase fallback (e.g. `output_shapes` → `outputShapes`).

Subscribers SHALL be deduplicated within a 5-minute window when their
`subscription.dedupe_key` template resolves to the same key for two
concurrent events. The dedupe key syntax SHALL support `{var}` and
`{nested.var}` placeholders resolved against the event payload.

Subscribers tagged `audit` SHALL refuse dispatch when the event payload's
`parentDepth` (or `compositionChain.length`) meets or exceeds the template's
`metadata.auditDepthCap` (default 2, bounded ≤ 4). Refusal SHALL emit a
log line at WARN; the refusal itself SHALL NOT cascade to a parent failure.

Subscriber-dispatch failures SHALL be logged and swallowed; they SHALL NOT
abort the parent execution.

### R4 — Shared template catalogue

GoalHost SHALL load embedded templates from a single shared location
(per design §F, `repos/ias-executor-ts/src/templates/`). GoalHost SHALL NOT
maintain a host-specific embedded-template set. Hosts that want additional
templates SHALL register them via the runtime's `templateProvider`
interface, not by side-loading a parallel catalogue.

### R5 — Trace contract

Every trace produced by GoalHost SHALL be written to the configured
`TraceSink`. The trace SHALL carry:

- `composition_chain` — the ancestor chain when the execution is a sub-
  goal of another execution. Top-level GoalHost calls produce `[]`.
- `parent_execution_id` — set when the execution is invoked via the
  compose-dispatch path or via lifecycle-subscriber dispatch.
- Per-task `input_impulse_ids` and `output_impulse_ids` per the existing
  `activity_execution_traces` contract.
- `vessel_id` — set to the GoalHost's declared vessel id (constructor
  argument; falls back to a hostname-derived default).

Trace-sink failures SHALL be logged and swallowed; they SHALL NOT abort
the execution. The current `HttpTraceSink` implementation
(`bun-host.ts:187-207`) is the reference.

### R6 — No hidden state

Every observable behaviour of GoalHost SHALL be either (a) ports-injected,
(b) activity-template-driven, or (c) emitted via the EventSink. GoalHost
SHALL NOT carry hidden state across `runGoal` calls (no in-memory
conversation, no idle-task queue, no boredom counter).

Hosts that want such state SHALL implement it externally and pass results
in via `opts.variables` or by seeding impulses on the runtime store between
calls.

### R7 — Test parity

All tests in `validation/scripts/` that currently spawn
`MINIBOB_BIN` (today: `test-forge-goal-completion.ts:221`, plus any others
identified in tasks §6.1) SHALL pass when re-run through `GoalHost.runGoal`
or `GoalHost.runTemplate`. Tests that fail SHALL be classified as either
(a) testing a minibob-specific affordance (CLI flag, REPL command) and
documented as deprecated, or (b) revealing a genuine GoalHost gap requiring
a follow-up.

The reuse-harness MRR (`reuse_mrr`) and recommendation MRR (`recommend_mrr`)
SHALL remain within ±0.02 of the pre-migration canary baseline over a 7-day
window after Phase 3 of the rollout completes.
