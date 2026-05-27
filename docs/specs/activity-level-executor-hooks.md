# Activity-Level Executor Hooks

**Status**: partially superseded (2026-05-27). Basic lifecycle events (`lifecycle:task:preBinding`, `lifecycle:task:completed`, `lifecycle:execution:succeeded`, `lifecycle:gap:classified`, `lifecycle:llm:dispatched`) are live in the substrate. The broader subscriber architecture — `subscription: "subscriber"` impulse field, `POST /v2/activities/lifecycle-subscribers`, Thompson-ranked hook dispatch — is NOT yet shipped. This spec remains the design reference for that second half.
**Audience**: a reviewer who wants to understand why minibob's foundation
doc claims an "activity lifecycle with hooks" that the executor never
fires, and how to wire it without inventing a parallel mechanism alongside
the existing impulse–activity system.
**Sibling specs**:
- `docs/specs/impulse-relationship-signal-verification.md` — taxonomy of
  impulses, traces, hooks across the system.
- `docs/specs/discovery-to-tools-bridge.md` — vessel-tool advertisement
  contract; the same advertisement path is reused here for vessels that
  want to register cross-cutting hook activities.

---

## 1. Problem

The foundation doc asserts an "activity lifecycle" with hooks for
`pre-execution`, `post-execution`, `on-failure`, `on-state-change`,
and `periodic`. Nothing in the executor invokes them. Infrastructure
is split across three orphaned files:

| File | Status |
| --- | --- |
| `repos/minibob/src/vessel-hooks.ts` | Full registry, cache, state-snapshot dispatch. Used by `goal-processor.ts:1648` for `pre-selection` only. Other triggers defined in the type but never fired. |
| `repos/minibob/src/lifecycle-hooks.ts` | Namespace-style hook system. `register()` and dispatchers (`executeBeforePrompt` etc.) never called from non-test code. |
| `repos/minibob/src/impulse-verification-hooks.ts` | A consumer of `lifecycle-hooks.ts`. `registerImpulseVerificationHooks()` exported but never invoked. |

Verified by grep: `LifecycleHooks` and the four `execute*Prompt`/
`execute*Complete` symbols have zero `activity.ts` callsites;
`registerImpulseVerificationHooks` has zero callers outside its
defining file; `getHookRegistry` has one live caller
(`goal-processor.ts:1648`).

The cost of this gap: every template that wants setup or teardown
encodes it as the first or last task. `prime-context-for-task.json`
spends tasks 1 and 3 on context-loading and relevance-recording that
are conceptually `preExecution` and `postExecution` for task-2's
actual work. This bundles cross-cutting concerns into the task DAG,
makes the reusable middle hard to extract, and inflates Thompson
Sampling's success-rate denominator with bookkeeping work.

The naive fix is a `HookTrigger` enum, a `template.hooks` block, and
dispatch points in `activity.ts` — a parallel mechanism alongside
impulses and activities. With 10000s of vessels potentially
registering hook activities, that path leads to a centralized
in-process registry minibob has to enumerate at every dispatch
point. The system already has a better mechanism: **activities
subscribe to impulses**. Lifecycle events should *be* impulses,
hooks should *be* activities, selection should reuse Thompson
Sampling — exactly what we already do for primary template
selection.

## 2. Constraints

1. **Lean into existing idioms, don't add new ones.** Don't introduce
   a new trigger taxonomy. Reuse impulses, activities, the trace, the
   WebSocket broadcaster, and Thompson Sampling. A "hook" is an activity
   whose input shapes are lifecycle impulses.
2. **Backward compatibility.** Templates without lifecycle subscriptions
   run identically to today. Adding lifecycle-impulse emission must not
   change non-subscribing behavior — same trace shape, same Thompson
   Sampling denominator, same task ordering.
3. **Foundation alignment.** Hook activities go through the same
   resolver ladder, the same trace recording, the same composition
   tracking (`parent_execution_id` / `composition_chain`) as any other
   activity. They are not a god-pattern.
4. **Scalability.** With 10000s of vessels each registering hook
   activities, the executor cannot fire all of them on every event. The
   ranking machinery (Thompson + relevance + cost) already winnows the
   primary-template candidate set; reuse it.
5. **No new global state.** Subscription bookkeeping lives where
   activity-template metadata already lives — in the template store
   that activity-api already owns and minibob already queries.
6. **Trace integration is automatic.** Hook activations show up in
   execution traces as nested activity invocations (composition
   pattern, already supported via `parent_execution_id` and
   `composition_chain` per super-repo CLAUDE.md). No new trace field.
7. **Failure semantics fall out naturally.** Hook activities are just
   activities — each has its own retry/failure handling. The executor
   that emitted the lifecycle impulse does not synchronously await
   subscriber completion (default), so subscriber failures do not
   cascade. Synchronous "blocking" subscriptions are an explicit
   opt-in (see §6 open question 1).

## 3. Design

**Hooks are activities subscribing to lifecycle impulses, ranked by
the same Thompson + relevance machinery used for primary selection.**

### 3.1 Lifecycle impulses

The executor emits impulses at well-defined points in `activity.ts`.
These are real impulses — written to the execution trace, broadcast over
WebSocket, persisted by activity-api. Each lifecycle impulse has:

- `pointer.type = "lifecycle"`
- `pointer.event` ∈ a small open-ended set of named events
- `pointer.executionId`, `pointer.templateId`, and event-specific fields
- A shape (from `inferShape`) of the form `lifecycle:<event>`, so the
  shape system the rest of the codebase already keys off of
  (`shape-resolver.ts`, `impulse-cooccurrence.ts`) routes them correctly

Five emit points, mapped from the previous spec's call-hook locations:

| Event shape | Emit point in `activity.ts` | Payload |
| --- | --- | --- |
| `lifecycle:activity:preExecution` | between line 2079 (impulse merge) and 2099 (topological sort) | `{executionId, templateId, variables, impulseShapes, parentExecutionId}` |
| `lifecycle:task:completed` | inside the per-task post-completion branch around line 2603, after `onTaskComplete?.(...)` | `{executionId, taskId, taskIndex, status, outputShapes, durationMs}` |
| `lifecycle:activity:postExecution` | between line 2814 (status flip) and line 2862 (broadcast) | `{executionId, templateId, status, durationMs, costUsd, taskCount, outputShapes}` |
| `lifecycle:activity:failure` | inside the existing `catch` block at lines 3320–3331, after `execution.status = "failed"` | `{executionId, templateId, error, lastTaskId, durationMs}` |
| `lifecycle:execution:tick` | timer-driven, started after the `try` at line 2063, stopped in `finally` at line 3352 | `{executionId, templateId, elapsedMs, lastTaskId, tickIndex}` |

That's the same five locations the prior spec called out. The change is
that the executor *emits an impulse* at each location instead of *calling
hooks*. The impulse machinery is already wired (the executor already
creates impulses, broadcasts them, persists them in
`execution.executionTrace.impulsesCreated`). No new dispatch path.

The shape names (`lifecycle:activity:preExecution`, etc.) are the
canonical event names. Vessels subscribe to these shapes; they are
**learned types** in the same sense as every other shape — observe,
don't pin a closed enum (per `shapes_are_learned_types` memory).
A vessel can introduce a new lifecycle event `lifecycle:budget:warning`
by emitting it from anywhere in the codebase, and any activity can
subscribe to it. This spec proposes the initial five; growth is open.

### 3.2 Activities subscribe via the existing `impulses[]` block

`ActivityTemplate.impulses[]` already exists
(`repos/minibob/src/types.ts:721-735`). A "post-execution hook" is an
activity whose impulses block contains a lifecycle pointer:

```jsonc
{
  "id": "record-concept-relevance-on-task-completion",
  "name": "Record concept relevance after a task that consumed concepts",
  "tasks": [
    { "id": "upsert-relevance",
      "resolver": "concept-db:recordConceptRelevance",
      "config": { "executionId": "{{lifecycle.executionId}}",
                  "taskId": "{{lifecycle.taskId}}" },
      "outputShapes": ["impulseRelevance"] }
  ],
  "impulses": [
    { "id": "trigger",
      "pointer": {
        "type": "lifecycle",
        "event": "task:completed",
        "filter": { "outputShapeAny": ["concept", "memo"] }
      },
      "budget": 200,
      "priority": "high",
      "subscription": "subscriber"
    }
  ]
}
```

Two new fields are conventional, not structural:

- `pointer.event`: the lifecycle event shape suffix (e.g.
  `task:completed`, mapping to shape `lifecycle:task:completed`).
- `pointer.filter`: optional structural match against the lifecycle
  payload. Format mirrors what `impulse-filter.ts` already supports
  for filtering pools by shape/key. Omitted means "any matching event".

One genuinely new field on the impulse declaration:

- `subscription`: enum `"input" | "subscriber"`, default `"input"`.
  - `"input"`: today's behavior — the impulse is a piece of context
    the activity expects to be present at execution time.
  - `"subscriber"`: the activity *runs* when an impulse matching the
    pointer is emitted by another execution. The matching impulse
    becomes the activity's first input impulse at run time.

That single discriminator field is the entire structural addition.
Everything else — registration, ranking, failure handling — already
exists for the primary-activity path.

### 3.3 The runtime: emit, rank, fire

When the executor emits a lifecycle impulse:

1. **Subscriber lookup.** activity-api runs a SurrealDB query
   against `activity_template` indexed on
   `(impulses[*].pointer.event, impulses[*].subscription)`. One
   query per emit point, amortized against the trace storage
   write that already happens there.
2. **Filter match.** Evaluate each candidate's `pointer.filter`
   against the emitted impulse's payload. Structural predicate
   evaluation, no LLM, reusing what `impulse-filter.ts` already
   exposes.
3. **Thompson rank.** Hand survivors to the existing
   `ThompsonSampling.rank(...)` path
   (`repos/metabob-activity-api/src/services/thompson-sampling.ts`),
   weighted by per-template α/β (success rate) and per-impulse
   relevance from the `impulseRelevance` table.
4. **Cost-aware top-K selection.** Take the top K. Tie-break by
   resolver tier — prefer `deterministic` over `pattern` over
   `llm`, the same ladder `classifyResolverTier` exposes
   (`resolver-tiers.ts`). Default K=1 for high-frequency events
   (`task:completed`, `execution:tick`); K=3 for one-shot events
   (`activity:preExecution`, `activity:postExecution`,
   `activity:failure`).
5. **Fire as nested activities.** Each selected hook activity is
   invoked through the same `executeNestedActivity` path the
   composition system already uses, with `parent_execution_id`
   set to the emitting execution. The matching lifecycle impulse
   is merged into the hook's input impulse pool.

**Scalability — 1000 hooks subscribing to `task:completed`:** the
indexed query returns 1000 rows; Thompson ranks; K=1 fires; **999
are not fired**, the same way 999 candidate primary-templates are
not selected for a single goal. Over many executions, succeeding
variants fire more often, failing ones fire less — the standard
Thompson Sampling guarantee, applied to hook activations.

**Always-fire escape hatch:** when a vessel needs its hook to fire
unconditionally (e.g. its own metric-recorder), the hook declares
`must_fire: true`. Must-fire hooks fire in addition to the K
ranked picks. Same pattern as `must_use`/`avoid_use` tools in
`filterToolsForTask` (`activity.ts:221-252`).

**10000-vessel scale:** Thompson ranking is O(K log N) with K≪N.
If profiling shows the indexed query is hot, add a per-process LRU
keyed by event shape. No new infrastructure needed up front.

### 3.4 Worked example: `prime-context-for-task`

Today (`templates/concept/prime-context-for-task.json`) has 3 tasks:
`load-context` (conceptually preExecution), `inject-into-task-prompt`
(the actual work), `record-relevance` (conceptually postExecution).

Under this design, the template keeps only task 2; tasks 1 and 3
move into separate hook activities subscribing to lifecycle events.

**Hook activity 1 — `load-concept-context-on-prime`** subscribes to
`activity:preExecution` filtered on `templateId =
"prime-context-for-task"`, runs `concept-db:loadPrimedContext`, and
produces a memo impulse that becomes input to the parent's task 2.

**Hook activity 2 — `record-concept-relevance-on-task-completion`**
subscribes to `task:completed` filtered on
`inputShapeAny: ["concept"]`, runs
`concept-db:recordConceptRelevance` with `executionId` and `taskId`
interpolated from the lifecycle payload.

```jsonc
// hook activity 1 trigger declaration:
"impulses": [
  { "id": "trigger",
    "pointer": {
      "type": "lifecycle", "event": "activity:preExecution",
      "filter": { "templateId": "prime-context-for-task" }
    },
    "subscription": "subscriber", "budget": 100, "priority": "high" }
]
```

**Impulse flow** when MiniBob runs `prime-context-for-task`:

1. Executor reaches line 2079; emits
   `lifecycle:activity:preExecution`.
2. activity-api returns ranked subscribers; Thompson picks
   `load-concept-context-on-prime` (K=1). It runs as a nested
   activity (`parent_execution_id` set), produces the memo, writes
   it back into the parent's impulse pool.
3. Parent runs task 2 with the primed context loaded.
4. Task 2 completes; executor emits `lifecycle:task:completed` with
   `inputShapes=["concept", "memo"]`.
5. `record-concept-relevance-on-task-completion` matches the filter;
   Thompson picks it; it runs as a nested activity.
6. Parent reaches line 2814; emits
   `lifecycle:activity:postExecution`. Any subscribers for that
   event are ranked and fired.

What this buys: parent template's Thompson denominator is now task 2
alone (the actual work, not bookkeeping); the relevance-recorder is
itself learnable (vessels can publish competing implementations and
Thompson picks the best); concept-db's `execution-observer.ts`
(WebSocket-based "hook as subscriber") becomes a precedent that this
spec generalizes; vessel-registered cross-cutting hooks fall out for
free — vessels publish activity templates with
`subscription: "subscriber"`, no separate registration channel.

### 3.5 `learn-impulse-relationships` as a hook

`templates/concept-learning/learn-impulse-relationships.json` today
runs on a schedule (Wave B3 in the task list, deferred). Under this
design it can subscribe to a `lifecycle:traces:accumulated` impulse
emitted by activity-api whenever the unprocessed-trace count crosses
a threshold:

```jsonc
"impulses": [
  { "id": "trigger",
    "pointer": {
      "type": "lifecycle",
      "event": "traces:accumulated",
      "filter": { "minUnprocessed": 50 }
    },
    "subscription": "subscriber",
    "budget": 50, "priority": "medium" }
]
```

That replaces "schedule it periodically" with "fire when there's
something to learn from" — exactly the pattern the user described
("hook subscribing to enough-traces-accumulated impulse rather than
scheduled"). activity-api emits the lifecycle impulse from its
trace-ingestion path; minibob picks it up; the activity runs as a
nested execution. No scheduler needed.

### 3.6 Failure semantics

Each hook activity has its own retry/failure handling because it's
just an activity. The emitting executor does not synchronously
await subscriber completion (default), so:

- A `lifecycle:activity:postExecution` subscriber failure does not
  unwind the parent activity's success status. The parent's status
  is already `completed` by the time the subscriber runs.
- A `lifecycle:activity:preExecution` subscriber failure is more
  delicate: the parent has *not* started its tasks yet, and the
  subscriber may have been expected to produce a context impulse
  the parent depends on. If the subscriber fails, the parent will
  hit a missing-impulse error at task-dispatch time and fail
  through its own existing error path. This is the right behavior:
  the parent doesn't know "a hook was supposed to fire" — it just
  knows "I expected a memo impulse and it isn't here". No special
  case in the executor.
- Synchronous "blocking" subscription mode (where the parent waits
  for subscribers before continuing) is deferred; see §6 open
  question 1. The default is fire-and-record-and-continue.

The trace records the parent–child relationship via
`composition_chain` — the dashboard already renders nested
executions, so a hook failure shows up as a failed child execution
with its own `executionId`, `error`, and `parent_execution_id`
pointing at the emitter. Operators looking at the dashboard see
exactly the shape they expect.

## 4. What happens to the dormant code

Three orphaned files; explicit decisions:

### `repos/minibob/src/vessel-hooks.ts` — refactor

Survives as a thin index over the template store, not as a
parallel registry of code:

- Rename `HookTrigger` → `LifecycleEventShape`, narrow to the
  shapes from §3.1, and change from enum literal to
  `string` typed-by-convention (shapes are learned, not closed;
  `shapes_are_learned_types`).
- Replace `VesselHook.injection.resolver` (a TS function ref)
  with `VesselHook.activityTemplateId`. The registry holds
  template ids, not closures.
- Drop `cache`/`cacheable`/`conditions`. Filtering moves to
  `pointer.filter` (§3.2); caching falls out of activity-api's
  existing template-metrics cache.
- Rename `executeHooks(trigger, snapshot)` →
  `findSubscribers(eventShape, payload)`. Returns ranked
  template ids, not executes closures. Execution happens via
  `executeNestedActivity(id, parent)` on the executor side.
- `pre-selection` becomes lifecycle shape
  `lifecycle:goal:preSelection`, emitted by `goal-processor.ts`
  before its Thompson query. The pre-selection use case
  survives but flows through the same impulse machinery as
  everything else (open question 4).

### `lifecycle-hooks.ts`, `impulse-verification-hooks.ts` — delete

Never wired to anything. The namespace-style
`onBeforePrompt`/`onAfterPrompt` API maps poorly onto the
impulse-subscription model — those are token-streaming concerns
that belong in `llm.ts` if anywhere. The verification hooks
re-implement validation that lives in `validation.ts` and
`impulse-verification.ts` already. Confirmed safe to delete:
`grep -rn "LifecycleHooks\." repos/minibob/src/` matches only
inside the defining files, and no external package imports
them.

## 5. Implementation outline

The implementation surface in `activity.ts` shrinks compared to the
prior spec, because there's no per-trigger dispatcher to write — just
five emit points, each of which calls a single
`emitLifecycleImpulse(shape, payload)` helper.

### 5.1 minibob (`repos/minibob/`)

**`src/types.ts`** (~line 721, inside `ActivityTemplate.impulses[]`):
add optional `subscription?: "input" | "subscriber"` (default
`"input"`) and optional `must_fire?: boolean`.

**`src/activity.ts`**: one new private method on `ActivityExecutor`:

```ts
private async emitLifecycleImpulse(
  eventShape: string,
  payload: Record<string, unknown>,
): Promise<void>
```

It creates the impulse, appends to
`execution.executionTrace.impulsesCreated`, broadcasts via the
broadcaster's new `lifecycle.event` message (§5.3), POSTs the
event to activity-api's `/v2/activities/lifecycle-subscribers` to
get a Thompson-ranked subscriber list, and invokes
`executeNestedActivity` for each ranked hit (lifecycle impulse
merged into the hook's input pool).

Five emit callsites match the prior spec's five locations
(`activity.ts:2079`, `2603`, `2814`, `3320`, plus the
`execution:tick` timer started after the `try` at line 2063 and
stopped in the `finally` at line 3352). Each callsite is one
line: `await this.emitLifecycleImpulse(shape, payload)`. No new
dispatcher, no per-trigger control flow, no `try`/`catch` matrix.

**`src/vessel-hooks.ts`**: refactored per §4.

**`src/lifecycle-hooks.ts`, `src/impulse-verification-hooks.ts`**:
deleted per §4.

### 5.2 metabob-activity-api

One new route: `POST /v2/activities/lifecycle-subscribers`.

- Request: `{eventShape, payload, limit?}`.
- Response: `{subscribers: Array<{templateId, score, mustFire}>}`,
  Thompson-ranked.
- Implementation: SurrealDB query on `activity_template` indexed on
  `impulses[*].pointer.event = $eventSuffix AND
  impulses[*].subscription = "subscriber"`; filter survivors by
  `pointer.filter` against `payload`; rank via existing
  `ThompsonSampling.rank(...)`; return top `limit` (default 3) plus
  all rows with `must_fire: true`.

`POST /v2/activities/execution-traces` is unchanged; parent–child
relationships already round-trip via `parent_execution_id` and
`composition_chain`.

### 5.3 WebSocket broadcaster

`repos/metabob-activity-api/src/websocket/types.ts`: extend the
`WebSocketMessage` type union with `lifecycle.event` (data:
`{eventShape, executionId, payload, sequence}`). Dashboard,
workbench flame graph, and concept-db's existing
`execution-observer.ts` get the generalized event stream.

### 5.4 discovery-vessel

**No changes.** Vessels register hook activities by publishing
ordinary activity templates with `subscription: "subscriber"` on a
lifecycle-shaped input impulse. The template store is already
discoverable through existing channels. There is no separate
hook-registration channel.

### 5.5 Templates

The two §3.4 hook activities and the §3.5 reframed
`learn-impulse-relationships` demonstrate the surface. Ship after
implementation.

## 6. Open questions

1. **Blocking subscriptions.** Some preExecution hooks produce
   context the parent depends on. Default is fire-and-continue,
   with the parent's missing-impulse error path catching the
   failure case. Add a `subscription: "blocking"` mode if a real
   use case demonstrates need.

2. **K tuning.** Defaults proposed in §3.3 (K=1 for
   high-frequency, K=3 for one-shot) are hardcoded. Move to a
   `lifecycle_event_config` table if profiling shows them wrong.

3. **Recursion guard.** A hook can emit the same lifecycle event
   it subscribes to. Cap composition-chain depth at N=5 (already
   tracked via `composition_chain`). Document and enforce.

4. **Migrating `goal-processor.ts:1648`.** The current
   `pre-selection` callsite becomes the first non-`activity.ts`
   emit point: emit `lifecycle:goal:preSelection`, fold
   subscriber outputs into the Thompson query. Small migration
   commit so `pre-selection` is no longer a special case.

5. **Trace interleaving.** Lifecycle and task impulses both
   stream into `execution.executionTrace.impulsesCreated` in
   time order. The broadcaster's `sequence` already provides
   total order; document the ordering invariant for consumers.

6. **Cost accounting.** Hook costs accrue on the hook's own
   trace; aggregate views join on `composition_chain` to
   attribute back to the originating goal. Already how nested
   activities work; double-check the chain walk in queries.

## 7. Test plan

### 7.1 Unit

In `repos/minibob/src/activity.test.ts` (or new
`activity-lifecycle.test.ts`):

1. **preExecution emit + subscriber fires** — hook activity
   subscribed to `lifecycle:activity:preExecution` runs as nested
   execution with `parent_execution_id` set; output impulse lands
   in parent's pool.
2. **Filtered subscriber** — two parent tasks produce different
   output shapes; one hook with `filter: { outputShapeAny:
   ["source_code"] }` fires exactly once (after the matching task).
3. **Thompson picks K=1 across competing subscribers** — two hooks
   on the same event with different α/β; over 100 runs the higher-α
   hook fires more often (with tolerance).
4. **`must_fire` bypasses ranking** — must-fire hook always fires
   *and* one ranked competitor fires.
5. **Recursion guard** — hook that emits the event it subscribes
   to; chain caps at depth 5 with logged abort.
6. **Subscriber failure does not unwind parent** —
   postExecution subscriber fails; parent stays `completed`;
   subscriber's own trace is `failed`.
7. **Backward-compat smoke** — template with no subscribers
   present runs identically to today (lifecycle impulses emitted
   into trace, no nested activities, no behavioral change).

### 7.2 Integration

In `repos/minibob/src/activity-graph-execution.test.ts`:

1. **`prime-context-for-task` end-to-end** with the refactored
   single-task template plus the two §3.4 hook activities. Same
   outcome as today's 3-task template.
2. **Lifecycle impulse round-trip through activity-api** —
   lifecycle impulses persist in `execution_trace.impulsesCreated`;
   `/v2/activities/lifecycle-subscribers` returns expected
   subscribers.
3. **Budget interaction** — parent + nested hooks together exceed
   `maxBudget`; abort happens via existing composition-chain
   budget propagation.

### 7.3 Out of scope

- Blocking subscription mode (open question 1).
- Per-event-shape K-tuning via config table (open question 2).
- 10000-vessel scaling stress test; the §3.3 argument is
  back-of-envelope until measured.

---

## File:line citations summary

- `repos/minibob/src/vessel-hooks.ts:29-36` — `HookTrigger` union (to be refactored to `LifecycleEventShape`)
- `repos/minibob/src/vessel-hooks.ts:84-129` — `VesselHook` interface (refactored: holds template ids, not closures)
- `repos/minibob/src/vessel-hooks.ts:529-551` — registry singletons (kept; semantics change)
- `repos/minibob/src/lifecycle-hooks.ts` — to be deleted
- `repos/minibob/src/impulse-verification-hooks.ts` — to be deleted
- `repos/minibob/src/goal-processor.ts:1648` — `pre-selection` callsite, migrate to `emitLifecycleImpulse("lifecycle:goal:preSelection", ...)`
- `repos/minibob/src/activity.ts:1863` — `execute()` entry
- `repos/minibob/src/activity.ts:2079` — impulse merge (preExecution emit point)
- `repos/minibob/src/activity.ts:2099` — topological sort
- `repos/minibob/src/activity.ts:2603` — per-task `onTaskComplete?.(...)` (task:completed emit point)
- `repos/minibob/src/activity.ts:2814-2862` — success-path completion (postExecution emit point)
- `repos/minibob/src/activity.ts:3320-3331` — `catch` block (failure emit point)
- `repos/minibob/src/activity.ts:3352` — `finally` (execution:tick teardown)
- `repos/minibob/src/types.ts:721-735` — `ActivityTemplate.impulses[]` (where `subscription?` and `must_fire?` are added)
- `repos/concept-db/src/services/execution-observer.ts:299-396` — pre-existing precedent: WebSocket-based "hook as subscriber"; this spec generalizes it
- `repos/metabob-activity-api/src/websocket/types.ts:6-11` — `WebSocketMessage` union (where `lifecycle.event` is added)
- `repos/metabob-activity-api/src/services/thompson-sampling.ts` — Thompson primitives reused for subscriber ranking
- `templates/concept/prime-context-for-task.json` — refactor target for §3.4
- `templates/concept-learning/learn-impulse-relationships.json` — reframed from periodic to subscriber per §3.5
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` — the foundation claim this spec finally fulfils
- `docs/specs/discovery-to-tools-bridge.md` — sibling spec; cross-cutting hooks fall out of the same template-publication channel
- `docs/specs/impulse-relationship-signal-verification.md` — sibling typology spec
