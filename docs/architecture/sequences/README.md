# Substrate Execution Sequence Diagrams

> **How to read this.** These five documents map the execution workflows of a
> running substrate: how a goal is selected against, how impulses resolve, how
> resolvers process them, what happens on failure, and how lifecycle
> subscriptions attach behaviour. Every participant is named by the **symbol**
> that implements it and the **vessel** it runs in. There are no line-number
> citations anywhere in this directory, deliberately: the substrate rewrites its
> own source, so a line citation is wrong before it is read.

## Overview

Execution is a **shape-graph walk**, not a template call. A goal is dispatched to `goal-host-vessel`, which infers the shapes that would constitute reaching it, backward-chains from those shapes to producers, executes the chain, and then grades the result against the goal rather than against an exit status.

Five workflows compose that behaviour:

1. **Activity Selection** — candidate retrieval, Thompson Sampling, the reach gate
2. **Impulse Resolution** — resolver dispatch, discovery routing, attribution
3. **Resolver Processing** — the four resolver tiers, composition, extraction
4. **Improvisation & Failure Modes** — the failure taxonomy, in-flight recovery, the floor
5. **Hooks & Behavior Injection** — lifecycle events, subscriptions, filters, caps

**The load-bearing claim:** success is **reach**, not exit status, and failure is **typed**, not binary. `verifyGoalReached` decides the former; the canonical failure taxonomy decides the latter. Together they are what make the learning loop measure quality rather than difficulty.

## Activity Composition Model

Composition in this system is emergent rather than declared. No stored meta-template lists the sub-activities a goal will use; the chain is assembled during the walk from whatever producers can close the goal's remaining shape gaps, and it is only recognisable as a composition after the fact, from the trace.

That ordering — execute first, recognise the pattern afterwards — is what makes composition learnable. A declared composition can only be graded as a whole; a discovered one is graded edge by edge, so the system can learn that two particular activities work well together without anyone having asserted it.

### Composition-Based Architecture

Composition is discovered at run time and recorded afterwards. `runGoalAsPoolWalk` maintains an impulse pool and a set of unmet target shapes, and each iteration picks a producer for one unmet shape, executes it, and folds its outputs back into the pool. The chain of activity ids it accumulates is the composition.

```
Goal
 ├─ inferGoalTargetShapes  → target shapes + goalHashOf(goal)
 ├─ recommendReachingPath  → replay a previously-reached path, if any
 ├─ per unmet target shape:
 │    pickSatisfierProducer  → a live producer
 │    mintResolverWrapper    → a bridge, when none exists
 │    universalToolFallback  → the grounded floor, when no bridge is possible
 ├─ decideContinuation     → continue, terminalise, or stop
 ├─ verifyGoalReached      → { reached, reason, completion_shapes }
 └─ recordGoalPath         → goal_execution_paths, keyed by goal_hash, with walk_tier
```

Nested dispatch is available where a template names it: `compose` for one child, `compose_parallel` for several, and the `activity` resolver for a child chosen at run time. All three run on the same runtime, share the impulse pool, extend `compositionChain`, and are refused as `safety_breach` if they would exceed the depth cap or close a cycle.

**What is learned:** `activity_composition_graph` accumulates parent→child edges reconciled from traces, and `classifyCompositionEdge` labels each `genuine`, `scaffold` or `hub` — with `genuine` requiring real evidence (recurrence with success, or a demonstrated shape flow) rather than mere co-occurrence.

### Example Composition Tree

A goal that asks for a derived finding to be written somewhere walks the graph backwards from the terminal shape and forwards through the intermediates:

```
Goal: "summarise the open gaps by category and record the result"
  │
  ├─ inferGoalTargetShapes → intermediate: gapCategoryReport
  │                          terminal:     the write shape
  │
  ├─ unmet: gapCategoryReport
  │    └─ producer found → execute → pool gains gapCategoryReport
  │
  ├─ unmet: the terminal write shape
  │    └─ DEFERRED while an intermediate was still unproduced
  │       (terminalOutputShapes), then bound from what was derived
  │
  ├─ decideContinuation → all targets produced
  ├─ verifyGoalReached  → reached, completion_shapes = [gapCategoryReport, …]
  └─ recordGoalPath     → walk_tier = satisfier
```

The deferral is the interesting part. Without `terminalOutputShapes`, a walk can satisfy the emit target first and write a placeholder; deferring it until the intermediates exist is what makes the emitted content derived rather than invented.

### Resolvers in Composition

A resolver is `{ id, tier, resolve(context) }`. The tier is recorded on every task record and is the axis along which cost and reliability are attributable:

- **`deterministic`** — `local-tools-vessel` (`:8230`): `shell`, `bounded_shell`, `fs_read` / `fs_write` / `fs_edit`, `git_status` / `git_diff` / `git_commit`, the `code_*` family, `web_search`. Each bounds its own timeout and output.
- **`pattern`** — proxy resolvers built by `buildDiscoveryProxyResolver`, routing a pointer to whichever vessel advertises its shape.
- **`llm`** — `llm-resolver-vessel` (`:8220`, with per-model siblings on `:8221`, `:8223`, `:8225`), running a bounded tool loop and selecting a model arm from a learned policy.
- **`external`** — resolvers whose work happens outside the fleet.

Nested dispatch (`compose` / `compose_parallel` / `activity`) is what makes composition possible. `ribosome-extract` — an activity, not a resolver — is what makes learning from a reached run possible.

## Diagrams by Workflow

Each document carries an **Implementation Architecture** section stating which vessel owns which responsibility, which endpoints and tables are involved, and why the split is drawn where it is. That section is the one to read first when the question is "where should this change go" rather than "what does this do".

The five documents are ordered by dependency: selection produces executions, executions resolve impulses, resolvers process them, failures are graded and recovered from, and subscriptions attach behaviour across all of it. Read in order they build; read out of order each still stands alone, because every one names its own owning symbols.

### [1. Activity Selection from Impulse State Space](./01-activity-selection.md)

From a dispatched goal to a graded outcome: target inference, per-goal path reuse, tiered candidate retrieval, Thompson Sampling with heuristic boosts, and the reach gate.

**Key concepts:**
- Tiered retrieval returning `exact` / `compatible` / `fts` / `fts_hybrid`, with `minResults = ceil(limit / 2)`
- Eight heuristic boosts plus a shape-mismatch penalty, reported as `boost_breakdown`
- Posterior blend: shape signature → cluster → global
- Deterministic reach verdicts before any LLM judge
- `goal_execution_paths` keyed by `goal_hash`, carrying `walk_tier`

**Owns:** `runGoalAsPoolWalk`, `verifyGoalReached`, `recordGoalPath` (goal-host-vessel); `getActivitiesWithTieredFallback`, `betaSample`, `analyzeTaskSemantics` (activity-api).

### [2. Impulse Resolution During Activity Execution](./02-impulse-resolution.md)

How a pointer becomes content: registry lookup, discovery routing, transport selection, and what the trace records about the resolution afterwards.

**Key concepts:**
- Resolver dispatch belongs to the executing vessel, never to the trace store
- Discovery-vessel both answers registry questions and forwards non-registry pointers
- Transport preference: peer endpoint → libp2p via the federation egress → advertised HTTP
- Budget is per execution (cost, duration, task count), not per-impulse truncation
- Attribution per task: `resolverId`, `resolverTier`, `inputShapes`, `outputShapes`, `filesModified`, `filesCreated`, `materialsConsulted`

**Owns:** `ResolverRegistry`, `ImpulseStore` (ias-executor-ts); `registerDiscoveryProxies`, `endpointForShape` (goal-host-vessel); `/resolve`, `/register` (discovery-vessel).

### [3. Processing of Required Input Impulses by Resolvers](./03-resolver-processing.md)

The four tiers in detail: the bounded LLM tool loop, the deterministic handlers, nested activity dispatch, and template extraction from a reached run.

**Key concepts:**
- LLM tool loop: `max_tool_iterations` default 20, hard-capped at 30
- Grounded floor loop: 4 iterations, 8 calls each, deadline enforced inside a turn, deduplicated calls
- Grounding (reads) is counted separately from side effects (writes)
- Composition provenance via `consumedFromTaskIds` and `childActivityId`
- Extraction is the `ribosome-extract` activity: assess → synthesise → validate → write

**Owns:** `llm-resolver-vessel` (tool loop, `selectArm`); `local-tools-vessel` (deterministic handlers); `ActivityExecutor` (`compose` guards); `ribosome-vessel` (extraction trigger).

### [4. Improvisation, Failure Modes, Checkpoints, and Rollbacks](./04-improvisation-failure-modes.md)

What happens when a goal does not go well: the taxonomy, the posterior consequence of each type, the in-flight recovery loop, and the staging discipline for code changes.

**Key concepts:**
- Canonical taxonomy: `verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`
- Differentiated deltas — a budget breach is a half penalty; a cascade victim carries none
- Recovery is in-flight: β-penalise, exclude, `recommendExcluding`, retry
- Hollow completion is itself a failure mode, mirrored to concept-db as a class-grain lesson
- A staged code change is never graded as done: `deterministic:staged-not-landed`
- Variants after three consecutive failures; retirement only after twenty executions below 30%

**Owns:** `runGoalWithRecovery`, `universalToolFallback` (goal-host-vessel); `applyOutcomeToPosteriors`, `variant-creator` (activity-api); `feature-compose` staging and revert (development-vessel).

### [5. Hook Registration and Behavior Injection](./05-hooks-behavior-injection.md)

Lifecycle subscriptions: how a template declares interest in an event, how the event is matched and filtered, and how runaway self-triggering is prevented.

**Key concepts:**
- A subscriber is an activity template with a `subscription` block — declaration, not registration
- Structural filters with `_contains` / `_equals` and snake_case → camelCase tolerance
- Universal depth cap (default 2, audit override to at most 4) against mutual recursion
- Five-minute dedupe window keyed by a rendered `dedupe_key`
- Bus forwarding is fire-and-forget; the in-process sink is called first, synchronously
- Dispatcher errors are isolated and must never cascade into the emitting execution

**Owns:** `LifecycleSubscriberVessel`, `matchesFilter`, `refuseForDepthCap`, `BusForwardingEventSink` (ias-executor-ts); `POST /v2/events/publish` and the `/ws` broadcaster (activity-api).

## Diagram Conventions

Three conventions hold across every diagram in this directory: participants are named for the symbol that implements them and the vessel it runs in, colours carry meaning consistently, and code references are symbol names rather than line numbers.

The third convention is the one that most affects how these documents age. A self-modifying system rewrites its own source, so a line citation is stale almost as soon as it is written — and a stale citation is worse than none, because its false precision invites trust. Symbol names survive refactors, are greppable, and fail loudly when renamed.

### Participants

Participants are named for the symbol that implements them and the vessel it runs in.

| Participant | Vessel | Symbol |
|---|---|---|
| Dispatch surface | goal-host-vessel `:8210` | `handleRunGoal`, `handleResolve` |
| Walk | goal-host-vessel | `runGoalWithRecovery`, `runGoalAsPoolWalk` |
| Reach gate | goal-host-vessel | `verifyGoalReached` |
| Executor | ias-executor-ts (in-process) | `ActivityExecutor` |
| Impulse pool | ias-executor-ts | `ImpulseStore` |
| Resolver lookup | ias-executor-ts | `ResolverRegistry` |
| Learning backend | activity-api `:8080` | `/v2/activities/*`, `/v2/goal-paths/*` |
| Registry | discovery-vessel `:8100` | `/resolve`, `/register`, `/heartbeat` |
| LLM tier | llm-resolver-vessel `:8220` | tool loop, `selectArm` |
| Deterministic tier | local-tools-vessel `:8230` | resolver map |
| Extraction trigger | ribosome-vessel `:8240` | `dispatchRibosomeExtract` |
| Concept store | concept-db `:8260` | `/concepts` |

Ports are in-container; the host maps them by the convention `18xxx → 8xxx`. Discover the live fleet rather than trusting a table: `registry_query`, or a per-vessel `/health`.

### Notation

Mermaid `rect` blocks group a phase; `alt` / `else` show branches; `loop` shows iteration with its bound stated in the note.

- **Blue** — core execution phases
- **Green** — reached or successful paths
- **Red** — failure and refusal paths
- **Yellow** — decision points and gates
- **Purple** — learning and storage operations
- **Orange** — fallback and floor paths

### Line Number References

**There are none, by design.** The substrate authors its own code changes, so any `file.ts:1234` citation is stale almost immediately, and a stale citation is worse than no citation because it reads as precise.

Every reference in this directory names a **symbol** and the **file** it lives in:

```
verifyGoalReached          in repos/goal-host-vessel/src/index.ts
getActivitiesWithTieredFallback
                           in repos/activity-api/src/routes/activities.get-activities-with-tiered-fallback.ts
LifecycleSubscriberVessel  in repos/ias-executor-ts/src/lifecycle-subscriber.ts
```

Symbols survive refactors, are greppable, and fail loudly when renamed — which is exactly the property a citation in a self-modifying system needs.

## How to Use These Diagrams

These documents serve three different readers, and the same page is used differently by each. Someone building a mental model reads them in order and mostly ignores the tables. Someone about to change behaviour reads only the owning symbols and the vessel boundary. Someone deciding where a new capability belongs reads only the Implementation Architecture sections.

One rule applies to all three: **when this directory and the running system disagree, the running system is authoritative.** These are expectations the system holds about itself, and a mismatch is a gap to file rather than a document to trust.

### For Understanding the System

1. Start with **Activity Selection** to see how a goal becomes an execution and how it is graded.
2. Read **Impulse Resolution** to see how data reaches a resolver and who owns the dispatch.
3. Study **Resolver Processing** to see the four tiers, composition, and extraction.
4. Review **Improvisation & Failure Modes** to see the taxonomy and the recovery loop.
5. Finish with **Hooks** to see how reactive behaviour attaches without a callback layer.

Read them in that order once; after that, the reach gate in document 1 and the taxonomy in document 4 are the two sections worth rereading, because most confusion about substrate behaviour reduces to confusing `status` with `reached`, or treating all failures as one signal.

### For Implementation Work

Each document provides:
- Symbol names and the file each lives in
- Endpoint paths and the tables behind them
- Decision logic with the thresholds actually enforced in code
- Refusal paths and what failure type each produces
- The vessel boundary each responsibility sits on

Use them to locate the owning symbol before changing behaviour, to check which vessel a responsibility belongs to before adding it somewhere convenient, and to confirm that a change will be visible in a trace. If a change would not appear in a trace, it will not be learnable — which is usually a sign it belongs somewhere else.

**When this directory and the running system disagree, the running system is authoritative.** File the discrepancy as a gap.

### For Architecture Decisions

The diagrams make four things explicit that are otherwise easy to get wrong:

- **Who owns dispatch.** The executing vessel does. Treating the trace store as a universal resolver collapses the shape vocabulary into one service's API.
- **Where a resolver lives.** With its data. Duplicating a resolver means duplicating access to the data it reads.
- **What counts as success.** Reach, judged after execution, not the exit status of a template.
- **What a failure means.** A typed verdict with a defined posterior consequence, not a boolean.

They also expose the extension points: advertise a shape to add a capability, declare a `subscription` to react to an event, mint a variant to compete with an incumbent — none of which require editing a central switch.

## Neutral Bus and Sequence Topology

Lifecycle events flow on a neutral broadcast bus rather than through direct in-process wiring. `BusForwardingEventSink` wraps the runtime's event sink: it calls the inner sink first and synchronously, then publishes to `POST /v2/events/publish` on activity-api fire-and-forget, from where the broadcaster fans out over `ws://…/ws`.

- Event names are mapped by `mapEventTypeToBusForm`: colons become dots and camelCase becomes snake_case, so `lifecycle:task:preBinding` publishes as `lifecycle.task.pre_binding`. Names already in dotted snake_case pass through unchanged.
- Discovery-vessel publishes fleet events on the same bus — `vessel.registered`, `vessel.heartbeat`, `vessel.deregistered`, `vessel.expired`. `startVesselRegistrationSubscriber` in goal-host-vessel consumes `vessel.registered` to add a proxy resolver for a newly-appeared vessel without a restart.
- Subscription replaces registration. A vessel declares a `subscription` block on an activity template rather than wiring a callback to an emitter.
- The bus is a **hot reactivity channel, not durable state**. Publishing is not awaited and not retried; durability lives in the trace store. A bus outage degrades reactivity, never execution.

When reading any arrow that shows an emitter pushing to a consumer: it passes through the bus, and the consumer's subscription filter determines whether it arrives. That decoupling is what lets a new vessel observe the full execution event stream without any change to goal-host-vessel or activity-api.

## Relationship to Other Documentation

- [`IMPULSE_ACTIVITY_FOUNDATION.md`](../IMPULSE_ACTIVITY_FOUNDATION.md) — the canonical ontology: impulses, shapes, activities, resolvers, vessels
- [`SUBSTRATE_AS_SOFTWARE.md`](../SUBSTRATE_AS_SOFTWARE.md) — the execution model these sequences implement
- [`SUBSTRATE_AS_DYNAMICS.md`](../SUBSTRATE_AS_DYNAMICS.md) — the learning dynamics the posteriors participate in
- [`GOAL_EXECUTION_PATHS_SCHEMA.md`](../GOAL_EXECUTION_PATHS_SCHEMA.md) — per-goal record and reuse
- [`RESOLVER_TRACKING.md`](../RESOLVER_TRACKING.md) — resolver attribution in traces
- [`IMPULSE_STATE_SPACE_SPEC.md`](../IMPULSE_STATE_SPACE_SPEC.md) — the state-space model selection conditions on
- [`RUNTIME_ACTIVITY_TRACING.md`](../RUNTIME_ACTIVITY_TRACING.md) — what a trace carries and why
- [`DEPLOYMENT_WORKFLOW.md`](../../../repos/deployment/DEPLOYMENT_WORKFLOW.md) — deployment procedure

## Architectural Clarity: goal-host-vessel vs Activity-API

One rule separates them: **goal-host-vessel decides and executes; activity-api remembers and ranks.** Everything below follows from that, and the split is what lets either side change without redeploying the other.

### goal-host-vessel + resolver vessels (Execution Environment)

**Responsibilities:**
- Accept dispatches at `POST /run-goal` and `POST /resolve`; expose dispatch state at `GET /executions/:id`.
- Infer target shapes and walk the shape graph.
- Own resolver dispatch: builtins, discovery proxies, development-vessel proxies, and reactive registration on `vessel.registered`.
- Choose transport per resolve, including the libp2p egress path for peer vessels.
- Execute through the resolver vessels — LLM via llm-resolver-vessel, deterministic via local-tools-vessel, nested dispatch in the engine.
- Run the bounded grounded floor when no producer exists, and file capability or reachability gaps rather than raising.
- Grade every dispatch with `verifyGoalReached` and drive in-flight recovery on a miss.
- Emit the trace and the per-goal path, and dispatch extraction on a reach.

**What the execution environment does not do:** store templates, compute Beta draws, aggregate metrics, create variants, or retire templates.

### Activity-API (Storage & Learning Backend)

**Responsibilities:**
- Persist templates and execution traces.
- Retrieve candidates through the tiered strategy and rank them with Thompson Sampling plus heuristic boosts.
- Maintain shape-conditioned, cluster and global posteriors, with time decay.
- Apply outcomes with per-failure-mode deltas and propagate credit along the composition chain.
- Create variants and retire templates on observed history.
- Serve per-goal paths at `/v2/goal-paths` and composition edges at `/v2/activities/composition*`.
- Resolve the activity-related shapes it advertises, and only those.
- Host the event bus and register with discovery-vessel like any other vessel.

**What the backend does not do:** execute activities, own resolver dispatch, evaluate subscription filters, or act as a fallback resolver for arbitrary pointers.

### Key Architectural Points

1. **Resolver dispatch is goal-host-vessel's.** The registry lives in the executing runtime; the backend is one resolver among many. Adding a capability means advertising a shape, not adding a case to a switch.

2. **Hooks are subscriptions on activities.** Reactive behaviour is declared on a template and evaluated at the reacting vessel — filters, depth caps and dedupe all run there, not in the backend.

3. **There is no improvisation mode.** Every route is a walk tier: `learned_pathway`, `satisfier`, `universal_tool_fallback`, `feature_compose`, `fresh_derivation`. Because every route is traced and tiered, a persistent reliance on the floor is a visible gap rather than invisible ad-hockery.

4. **Success is reach, not exit status.** `verifyGoalReached` runs deterministic checks first — no output, error envelope, unfilled placeholder, staged-not-landed, favourable-compose — and consults a judge only for the residue.

5. **Failure is typed.** `verifier_negative` and `safety_breach` take a full β; `budget_exhausted` a half; `cascading` and `user_abort` none. Undifferentiated penalties would make the posterior a measure of difficulty.

6. **Composition edges are derived, not declared.** `activity_composition_graph` is reconciled from traces, and `genuine` requires recurrence with success or a demonstrated shape flow. The older `composition_edge` table and its routes were retired; nothing should point at them.

## Diagram Format

All diagrams use [Mermaid](https://mermaid.js.org/) and render in GitHub, VS Code with the Mermaid extension, Obsidian with the Mermaid plugin, and any Markdown viewer with Mermaid support. Wide diagrams are written to degrade gracefully: a viewer without Mermaid still sees the participant list and the labelled steps as readable text.

## Contributing

These documents are ingested into the concept graph as `architecturePrinciple` concepts, keyed by `<relpath>#<slug(heading)>`, and dense-searched into the code-authoring prompt. That has three consequences for anyone editing them:

1. **Verify before you write.** A confidently-worded wrong claim here is read back into the drafter and becomes wrong code. If a claim cannot be verified against the source, delete it rather than softening it.
2. **Cite symbols, never line numbers.** Symbols survive refactors and fail loudly when renamed.
3. **Write timelessly.** State behaviour a reader can expect. No dates, no status banners, no commit ids, no run counts — those belong in commit messages, traces and the gap store. A measurement becomes the expectation it was measuring.

Two mechanical constraints follow from the ingester: **section headings are permanent keys**, so changing a level-2 or level-3 heading orphans its concept; and **a section body under 200 characters is skipped entirely**, so an over-trimmed section silently leaves its stale concept in place. When a section deserves to shrink, expand the explanation instead of cutting to a stub.

## Quick Reference

| Workflow | Entry point | Owning symbols | Learning output |
|---|---|---|---|
| Activity Selection | `POST /run-goal` → `handleRunGoal` | `runGoalAsPoolWalk`, `getActivitiesWithTieredFallback`, `betaSample`, `verifyGoalReached` | α/β updates, `goal_execution_paths` with `walk_tier` |
| Impulse Resolution | `ResolverRegistry` lookup | `buildDiscoveryProxyResolver`, `endpointForShape`, discovery `/resolve` | Resolver attribution per task, `input_impulse_shapes` → state signature |
| Resolver Processing | Task `resolver` field | llm-resolver tool loop, local-tools resolver map, `compose` / `compose_parallel` | Tool and argument patterns, `activity_composition_graph` |
| Failure & Recovery | Reach verdict `reached: false` | `penaliseHollowTemplate`, `recommendExcluding`, `universalToolFallback` | Typed failure modes, variants, retirement, `reach_gate_lesson` concepts |
| Hooks | `subscription.shape` on a template | `LifecycleSubscriberVessel`, `matchesFilter`, `refuseForDepthCap` | Subscriber executions graded like any other activity |

**Walk tiers:** `learned_pathway`, `satisfier`, `universal_tool_fallback`, `feature_compose`, `fresh_derivation`
**Failure types:** `verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`
**Composition depth:** capped at 2 by default for subscriber dispatches (audit override to at most 4); `compose` dispatches are depth- and cycle-guarded and refuse as `safety_breach`
