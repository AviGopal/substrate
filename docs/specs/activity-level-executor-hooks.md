# Activity-Level Executor Hooks

**What ships.** The subscriber architecture is implemented and running.
`repos/ias-executor-ts/src/lifecycle-subscriber.ts` carries the
`LifecycleSubscriberVessel`, the `subscription` declaration on
`ActivityTemplate` (`src/ontology.ts`), filter matching, the dedupe window,
the self-subscription guard and the depth cap. The engine emits five lifecycle
shapes: `lifecycle:task:preBinding`, `lifecycle:task:completed`,
`lifecycle:execution:succeeded`, `lifecycle:gap:classified` and
`lifecycle:llm:dispatched`.

**What is deferred.** Ranked dispatch. The vessel fires *every* matching
subscriber that survives dedupe and the depth cap. Thompson / relevance
ranking, the top-K cap and `must_fire` segregation are not wired: the
`HIGH_FREQUENCY_SHAPES` / `HIGH_FREQUENCY_TOP_K` / `ONE_SHOT_TOP_K` constants
and `defaultTopKForShape` are exported for parity but no code path consumes
them, and there is no `POST /v2/activities/lifecycle-subscribers` ranker on
activity-api. §3.3 below describes that ranked runtime as design, not as
behaviour a reader can observe.

**Audience**: a reviewer who wants to understand why an execution host's
foundation doc can claim an "activity lifecycle with hooks" that the host
never fires, and how to wire it without inventing a parallel mechanism
alongside the existing impulse–activity system.

---

## 1. Problem

The foundation doc asserts an "activity lifecycle" with hooks for
`pre-execution`, `post-execution`, `on-failure`, `on-state-change`,
and `periodic`. Nothing in the executor invokes them. Infrastructure
is split across three orphaned files:

| File | Status |
| --- | --- |
| A hook registry with cache and state-snapshot dispatch | Fired for one trigger only. Every other trigger was defined in the type and never emitted. |
| A namespace-style hook system | `register()` and its before/after dispatchers were never called from non-test code. |
| Verification hooks layered on that system | Exported and never invoked; the validation they re-implemented already lived elsewhere. |

The diagnostic that established this: the hook-registry symbols had no
callsites in the execution path, the namespace-style dispatchers had no
callers outside test code, and the verification hooks had none at all. A
registry nothing dispatches into is indistinguishable from an absent one.

The cost of this gap: every template that wants setup or teardown
encodes it as the first or last task. A context-priming template
spends its first and last tasks on context-loading and
relevance-recording that are cross-cutting concerns around the one task
doing the actual work. That bundles them into the task DAG,
makes the reusable middle hard to extract, and inflates Thompson
Sampling's success-rate denominator with bookkeeping work.

The naive fix is a trigger enum, a `template.hooks` block, and
dispatch points in the execution loop — a parallel mechanism alongside
impulses and activities. With 10000s of vessels potentially
registering hook activities, that path leads to a centralized
in-process registry the executor would have to enumerate at every dispatch
point. The system already has a better mechanism: **activities
subscribe to impulses**. Lifecycle events should *be* impulses,
hooks should *be* activities, selection should reuse Thompson
Sampling — exactly what we already do for primary template
selection.

## 2. Constraints

1. **Lean into existing idioms, don't add new ones.** Don't introduce
   a new trigger taxonomy. Reuse impulses, activities, the trace and
   Thompson Sampling. A "hook" is an activity that consumes a lifecycle
   shape.
2. **Backward compatibility.** Templates without lifecycle subscriptions
   run unchanged. Adding lifecycle emission must not
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
5. **No new global state.** Subscription bookkeeping lives on the
   activity template itself, and the subscriber vessel owns its own
   registry rather than a process-global singleton — so multiple
   runtimes can coexist and tests need no global teardown.
6. **Trace integration is automatic.** Hook activations show up in
   execution traces as nested activity invocations (composition
   pattern, already supported via `parent_execution_id` and
   `composition_chain` — see
   [`../architecture/RUNTIME_ACTIVITY_TRACING.md`](../architecture/RUNTIME_ACTIVITY_TRACING.md)).
   No new trace field.
7. **Failure semantics fall out naturally.** Hook activities are just
   activities — each has its own retry/failure handling. The executor
   that emitted the lifecycle impulse does not synchronously await
   subscriber completion (default), so subscriber failures do not
   cascade. Synchronous "blocking" subscriptions are an explicit
   opt-in (see §5 open question 1).

## 3. Design

**Hooks are activities subscribing to lifecycle events, to be ranked by
the same Thompson + relevance machinery used for primary selection.**

### 3.1 Lifecycle impulses

The execution engine emits at well-defined points in its task loop. Each
lifecycle event carries:

- a shape of the form `lifecycle:<domain>:<event>`, so the shape system the
  rest of the codebase already keys off of routes them correctly
- the execution and template identity, plus event-specific fields
- the goal context, when the host forwarded one into the engine

Five emit points, named by what has just happened rather than by line
number — this system rewrites its own source, so a line reference is stale
before it is read:

| Event shape | Emit point | Payload |
| --- | --- | --- |
| `lifecycle:task:preBinding` | immediately before a task's inputs are bound, ahead of the task-started event | task identity plus the impulses about to be bound |
| `lifecycle:task:completed` | after a task finishes, on both the ordinary and the recovered path | task identity, status, produced shapes |
| `lifecycle:execution:succeeded` | after the engine settles an execution as successful | execution identity, template, produced shapes |
| `lifecycle:gap:classified` | wherever the engine classifies an unmet need as a gap | the gap classification and the task that raised it |
| `lifecycle:llm:dispatched` | inside the LLM prompt resolver, *before* the model call, so audit subscribers see the dispatch without log archaeology | the prompt dispatch record |

The engine *emits an event* at each location instead of *calling hooks*.
The subscriber vessel implements `EventSink`, so emission travels the
ordinary event path — no separate dispatch channel.

Vessels subscribe to these shapes; they are
**learned types** in the same sense as every other shape — observe,
don't pin a closed enum (per `shapes_are_learned_types` memory).
A vessel can introduce a new lifecycle event `lifecycle:budget:warning`
by emitting it from anywhere in the codebase, and any activity can
subscribe to it. This spec proposes the initial five; growth is open.

### 3.2 Activities subscribe via a `subscription` declaration

A hook is an ordinary activity template that carries a `subscription`
block. `ActivityTemplateSubscription` in
`repos/ias-executor-ts/src/ontology.ts` is the whole structural addition:

```jsonc
{
  "id": "record-concept-relevance-on-task-completion",
  "name": "Record concept relevance after a task that consumed concepts",
  "tasks": [
    { "id": "upsert-relevance",
      "resolver": "concept-db:recordConceptRelevance",
      "outputShapes": ["impulseRelevance"] }
  ],
  "subscription": {
    "shape": "lifecycle:task:completed",
    "filter": { "outputShapes_contains": "concept" },
    "dedupe_key": "{executionId}:{taskId}"
  }
}
```

Its fields:

- `shape` (required): the lifecycle event shape the activity fires on.
  A template registered without one is rejected at registration.
- `filter`: optional structural match against the event payload.
  `matchesFilter` supports `_contains` and `_equals` suffix predicates
  plus plain equality; omitted means "any event of that shape".
  `resolvePayloadField` falls back between snake_case and camelCase so a
  filter is not silently dead because two vessels spell a field differently.
- `dedupe_key`: optional template string whose `{field}` and
  `{nested.field}` placeholders resolve against the payload. Repeat firings
  of the same subscription against the same resolved key collapse.
  A `dedupe_key` on the template itself is accepted as an equivalent.
- `must_fire`: declared but not load-bearing — nothing winnows, so nothing
  is bypassed. It becomes meaningful only when ranking lands.

Everything else — registration, execution, failure handling — reuses the
primary-activity path.

### 3.3 The runtime: emit, rank, fire

Steps 1, 2 and 5 are what the subscriber vessel does. Steps 3 and 4 are
design — see the deferral note at the top of this spec.

1. **Subscriber lookup.** The vessel owns its registry and selects the
   templates whose `subscription.shape` equals the emitted event's shape.
2. **Filter match.** Evaluate each candidate's `subscription.filter`
   against the payload. Structural predicate evaluation, no LLM.
   Survivors then pass the dedupe window, the self-subscription guard
   (a template never fires on an event it emitted) and the depth cap.
3. **Thompson rank** *(design)*. Hand survivors to the same posterior
   the primary-selection path samples, weighted by per-template α/β and
   per-impulse relevance.
4. **Cost-aware top-K selection** *(design)*. Take the top K, tie-broken
   by resolver tier — prefer `deterministic` over `pattern` over `llm`.
   `defaultTopKForShape` already encodes the intended asymmetry: shapes in
   `HIGH_FREQUENCY_SHAPES` get `HIGH_FREQUENCY_TOP_K`, everything else
   `ONE_SHOT_TOP_K`. A per-task shape that fanned out as widely as a
   once-per-execution shape would multiply subscriber work by the task
   count, so the cap tightens exactly where emission rate is highest.
5. **Fire.** Each surviving subscriber is executed through
   `SubscriberDispatcher`, the single injection point through which the
   vessel runs a match. Keeping dispatch behind one port is what leaves
   the vessel free of per-shape control flow.

**Scalability.** Until step 4 lands, 1000 subscribers on
`lifecycle:task:completed` means 1000 dispatches per task — the reason the
ranker is the next piece of work and not an optimization. With ranking,
the argument is the ordinary bandit one: K fire, the rest do not, and over
many executions succeeding variants fire more often.

**Always-fire escape hatch.** When a vessel needs its hook to fire
unconditionally (e.g. its own metric-recorder), the hook declares
`must_fire: true` so it fires in addition to the K ranked picks. With no
ranking in place, every match already fires and the flag changes nothing.

### 3.4 Worked example: splitting bookkeeping out of a template

Take a context-priming template with three tasks: load context
(conceptually pre-execution), do the actual work, record relevance
(conceptually post-execution). Under this design the template keeps only
the middle task; the other two become separate hook activities.

**Hook activity 1 — a context loader** subscribes to
`lifecycle:task:preBinding`, filtered on the task it should prime, and
produces the memo impulse the primed task binds.

**Hook activity 2 — a relevance recorder** subscribes to
`lifecycle:task:completed`, filtered on the shapes the completed task
produced, and records relevance for the concepts that task consumed:

```jsonc
"subscription": {
  "shape": "lifecycle:task:completed",
  "filter": { "outputShapes_contains": "concept" },
  "dedupe_key": "{executionId}:{taskId}"
}
```

**Flow:** the engine emits `lifecycle:task:preBinding` before binding the
work task's inputs; the loader matches and runs, producing the memo. The
work task binds it and runs. On completion the engine emits
`lifecycle:task:completed`; the relevance recorder matches its filter,
passes dedupe, and runs.

What this buys: the parent template's posterior is graded on the actual
work rather than on bookkeeping; the relevance recorder becomes learnable
in its own right, since competing implementations can subscribe to the same
shape; and cross-cutting hooks fall out for free — a vessel publishes a
template with a `subscription` block and needs no separate registration
channel.

### 3.5 Demand-driven learning activities

An activity that would otherwise run on a schedule — say, mining
relationships out of accumulated traces — can instead subscribe to a
lifecycle shape emitted when there is something to learn from:

```jsonc
"subscription": {
  "shape": "lifecycle:traces:accumulated",
  "filter": { "minUnprocessed_equals": 50 }
}
```

That replaces "schedule it periodically" with "fire when the condition
holds", which is the same posture as boredom-driven selection: read the
condition, don't run a timer. It requires a vessel to emit that shape from
its trace-ingestion path; shapes are learned, so introducing one is an
emission, not a schema change.

### 3.6 Failure semantics

Each hook activity has its own retry/failure handling because it's
just an activity. The emitter does not await subscriber completion, and
subscriber failures are logged and swallowed rather than propagated, so:

- A post-completion subscriber failure does not unwind the parent's
  success status. The parent has already settled by the time the
  subscriber runs.
- A pre-binding subscriber failure is more delicate: the subscriber may
  have been expected to produce a context impulse the parent depends on.
  If it fails, the parent hits a missing-impulse error at bind time and
  fails through its own existing error path. This is the right behavior:
  the parent doesn't know "a hook was supposed to fire" — it just knows
  "I expected a memo impulse and it isn't here". No special case in the
  engine.
- Synchronous "blocking" subscription mode (where the parent waits
  for subscribers before continuing) is deferred; see §5 open
  question 1. The default is fire-and-record-and-continue.

A refused dispatch names its reason — `refuseForDepthCap` logs the
refusal rather than recursing silently, which is what makes the cap
observable instead of merely protective.

## 4. Where this lives

Everything except ranked dispatch is implemented. It is hosted by
`ias-executor-ts`, not by the CLI the original plan targeted — that
repository left the fleet, and the subscription machinery moved to the
canonical execution host with it. Cite the symbols below rather than line
numbers: this system rewrites its own source routinely, so a line reference
is stale before it is read.

### The subscriber vessel

`LifecycleSubscriberVessel` in
`repos/ias-executor-ts/src/lifecycle-subscriber.ts` is the runtime for §3.3.
It implements `EventSink`, so emission is the ordinary event path rather
than a parallel hook channel — an activity subscribes by declaring a
`subscription` block, and nothing registers a closure. `SubscriberDispatcher`
is the injection point through which a matched subscriber is executed, which
keeps the vessel free of any per-shape control flow.

### Which lifecycle shapes exist

The engine emits `lifecycle:task:preBinding`, `lifecycle:task:completed`,
`lifecycle:execution:succeeded` and `lifecycle:gap:classified`; the LLM
prompt resolver emits `lifecycle:llm:dispatched`. Shapes are learned rather
than closed, so this list is what the fleet emits and not a bound on what it
may emit — a subscriber filters by shape string, and an unknown shape simply
matches nothing.

`HIGH_FREQUENCY_SHAPES` additionally names `lifecycle:task:started` and
`lifecycle:execution:tick`. Those are parity constants from the port, not
emissions: nothing in the engine produces them, so a subscription to either
never fires.

### Ranking is the missing piece

`defaultTopKForShape` and the `HIGH_FREQUENCY_TOP_K` / `ONE_SHOT_TOP_K`
constants are exported but no code path calls them, and no posterior is
consulted. The vessel dispatches every subscriber that matches, so fan-out
is bounded by the guards below and by nothing else. Read §3.3 steps 3–4 as
the design for closing this, not as a description of behaviour.

### Three guards stand between a subscription and a runaway

`matchesFilter` decides whether a subscriber's declared filter admits the
payload, with `resolvePayloadField` tolerating a snake_case/camelCase mismatch
so a filter is not silently dead because two vessels spell a field differently.
`resolveDedupeKey` collapses repeat firings of the same subscription against the
same event, over a bounded per-process window. `refuseForDepthCap` refuses
rather than recurses when a subscriber chain would exceed its depth bound.
A fourth guard is narrower but load-bearing: a template never fires on an
event it itself emitted.

### What was removed

The parallel hook registry, the namespace-style before/after dispatchers, and
the verification hooks that duplicated validation were all dropped rather than
ported. None had a live caller. The subscription model replaces them: a hook
is an activity like any other, executed through the ordinary path — and once
ranking lands, graded like any other.

## 5. Open questions

1. **Blocking subscriptions.** Some pre-binding hooks produce
   context the parent depends on. Default is fire-and-continue,
   with the parent's missing-impulse error path catching the
   failure case. Add a blocking mode if a real use case
   demonstrates need.

2. **K tuning.** The proposed defaults in §3.3 (K=1 for
   high-frequency shapes, K=3 for one-shot) live in constants.
   Once ranking consumes them, move them into a shaped tuning
   impulse rather than leaving them frozen in source.

3. **Recursion guard.** A hook can emit the same lifecycle event
   it subscribes to. The self-subscription guard and the depth cap
   cover the direct case; a longer cycle through two subscribers is
   bounded only by the depth cap, so the bound wants a test.

4. **A goal-selection emit point.** The pre-selection step of goal
   dispatch is a natural sixth emit point: emit
   `lifecycle:goal:preSelection` and fold subscriber outputs into
   the selection query, so pre-selection stops being a special case.

5. **Trace interleaving.** Lifecycle and task events stream into the
   trace in time order. Document the ordering invariant for
   consumers rather than letting each one infer it.

6. **Cost accounting.** Hook costs accrue on the hook's own
   trace; aggregate views join on the composition chain to
   attribute back to the originating goal. Already how nested
   activities work; double-check the chain walk in queries.

## 6. Test plan

### 6.1 Unit

In the execution host's own test suite:

1. **Emit + subscriber fires** — an activity subscribed to
   `lifecycle:task:preBinding` is dispatched, and its output impulse
   is available to the task being bound.
2. **Filtered subscriber** — two tasks produce different output
   shapes; a subscriber filtered with `outputShapes_contains` fires
   exactly once, after the matching task.
3. **Field-name tolerance** — a filter written in snake_case matches
   a camelCase payload field and vice versa.
4. **Dedupe** — two events resolving to the same `dedupe_key` produce
   one dispatch, and the collapse is logged.
5. **Self-subscription guard** — a template that emits the shape it
   subscribes to does not fire on its own event.
6. **Depth cap** — a subscriber chain past the bound is refused, and
   the refusal names its reason.
7. **Subscriber failure does not unwind the parent** — a subscriber
   throws; the parent's status is unaffected.
8. **No-subscriber smoke** — a template with no subscribers present
   runs identically, with lifecycle events emitted and nothing fired.

### 6.2 Integration

In the host's graph-execution tests:

1. **Bookkeeping split end-to-end** — the single-task template plus
   the two §3.4 hook activities produce the same outcome as the
   original three-task template.
2. **Budget interaction** — parent plus subscribers together exceed
   the budget; abort happens via the existing composition-chain
   budget propagation.

### 6.3 Out of scope

- Blocking subscription mode (open question 1).
- Ranked dispatch and its tests — those land with the ranker, and the
  §3.3 scaling argument is back-of-envelope until then.

---
