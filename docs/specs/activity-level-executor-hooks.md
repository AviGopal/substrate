# Activity-Level Executor Hooks

**Status**: spec, no implementation yet.
**Audience**: a reviewer who wants to understand why minibob today has hook
infrastructure that is wired up at exactly one site (`pre-selection`, in
`goal-processor.ts`) and dormant for every other trigger, and what the
minimum viable wiring looks like to fix that.
**Sibling specs**:
- `docs/specs/impulse-relationship-signal-verification.md` — taxonomy of
  impulses, traces, hooks across the system.
- (in progress, not yet landed) discovery-to-tools bridge — overlaps with §3
  of this doc on how vessels advertise hooks. We defer cross-cutting,
  vessel-registered hooks to that spec; here we cover only the
  template-declared path.

---

## 1. Problem

The foundation doc (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`)
asserts an "activity lifecycle" with hooks for `pre-execution`,
`post-execution`, `on-failure`, `on-state-change`, and `periodic`. Nothing
in the executor invokes those hooks. The infrastructure is split across
three files, each at a different level of completeness:

| File | Status |
| --- | --- |
| `repos/minibob/src/vessel-hooks.ts` | Full registry + cache + state-snapshot dispatch. Used by `goal-processor.ts:1648` for `pre-selection` only. All other triggers (`pre-execution`, `post-execution`, `on-state-change`, `on-failure`, `periodic`) are defined in the type but never fired. |
| `repos/minibob/src/lifecycle-hooks.ts` | Older namespace-style hook system with `onBeforePrompt`/`onAfterPrompt`/`onActivityComplete`/`onActivityFailed`/`onPromotionCheck`/`onTemplateRegistered`. The `register()` function is never called from any non-test code. The `executeBeforePrompt`/`executeAfterPrompt`/`executeActivityComplete`/`executeActivityFailed` dispatchers are also never called from `activity.ts`. |
| `repos/minibob/src/impulse-verification-hooks.ts` | A consumer of `lifecycle-hooks.ts` that calls `LifecycleHooks.register({...})`. The `registerImpulseVerificationHooks()` function is exported but never invoked at startup (`grep` for it returns only its own definition). |

Verification:

- `grep -n "LifecycleHooks\|executeBeforePrompt\|executeAfterPrompt\|executeActivityComplete\|executeActivityFailed" repos/minibob/src/activity.ts` → no matches.
- `grep -rn "registerImpulseVerificationHooks" repos/minibob/src/` (excluding the file that defines it) → no matches.
- `grep -rn "vessel-hooks\|getHookRegistry" repos/minibob/src/ | grep -v "vessel-hooks.t"` → one match, `goal-processor.ts:1648` for `pre-selection`.

So today, the only working hook trigger across the entire codebase is
`pre-selection`, fired during goal-driven activity recommendation. Activity
execution itself runs unhooked. The `ActivityTemplate` type
(`repos/minibob/src/types.ts:680-806`) has no `hooks`/`preExecution`/
`postExecution`/`onFailure` field. No template under
`templates/**` declares hooks. The foundation doc's claim is aspirational.

The cost of this gap: every template that wants setup or teardown encodes
it as the first or last task — for example, `prime-context-for-task.json`
spends task 1 and task 3 on context-loading and relevance-recording that
are conceptually `preExecution` and `postExecution` for the actual
task-2 work. This bundles cross-cutting concerns into the task DAG, making
the reusable middle of the activity hard to extract and inflating Thompson
Sampling's success-rate denominator with bookkeeping work.

This spec writes up the minimum viable wiring to fix that for v1, deferring
the harder cross-cutting (vessel-registered) variant to a follow-up.

## 2. Constraints

1. **Backward compatibility.** Existing templates have no `hooks` field; the
   executor must continue to run them unchanged. Hooks are pure addition.
   Adding hook iteration around the task DAG must not change
   non-hook-using behavior — same trace shape, same Thompson Sampling
   denominator, same task ordering.
2. **Foundation alignment.** Hooks are themselves activity-shaped — they
   take impulses in, can produce impulses out, and they are *measured*.
   They should not become a god-pattern that bypasses the resolver
   selection ladder; in particular, an LLM hook is just another resolver
   tier and should get the same trace treatment as an LLM task.
3. **Don't drift the trace schema.** Hook invocations must end up in
   `ExecutionTrace` somewhere observable, but not as new top-level fields
   that the activity-api has to learn about in lockstep with minibob.
4. **No new global state.** The hook registry already exists
   (`getHookRegistry()` in `vessel-hooks.ts:529`). Any per-execution state
   (which hooks fired, what they returned) lives on the
   `ActivityExecution`/`ExecutionTrace` value, not in module-level maps.
5. **Don't entangle with discovery.** Vessel-registered hooks (cross-cutting,
   advertised via discovery-vessel) are out of scope for v1. The
   discovery-to-tools-bridge spec owns that contract; this spec only
   consumes hooks declared in the activity template itself.
6. **Failure semantics must be loud but bounded.** A failing
   `postExecution` hook should not unwind a successful activity, but it
   *must* surface in the trace so the dashboard can flag it. A failing
   `preExecution` hook is a hard abort — it ran before any task and the
   activity has not yet committed to its trace identity.

## 3. Design alternatives

Three coherent designs, in order from simplest to most ambitious. We
recommend (A) for v1.

### Alternative A — Template-declared hooks only, in-process function refs are *not* allowed, only resolver references.

Templates declare hooks as references to existing resolver shapes. The
executor invokes them through the same resolver dispatch path it already
uses for resolver-typed tasks. Concretely:

```jsonc
{
  "id": "prime-context-for-task",
  "tasks": [ ... ],
  "hooks": {
    "preExecution": [
      { "id": "warm-concept-cache",
        "resolver": "concept-db:warmConceptCache",
        "config": { "query": "{{goalDescription}}" },
        "timeout": 3000,
        "outputShapes": ["concept", "relatedConcepts"] }
    ],
    "postExecution": [
      { "id": "record-relevance",
        "resolver": "concept-db:upsertConceptUsage",
        "config": { "executionId": "{{$execution.id}}" },
        "timeout": 5000 }
    ],
    "onFailure": [
      { "id": "release-resources",
        "resolver": "bash",
        "config": { "command": "rm -f /tmp/{{$execution.id}}.lock" } }
    ]
  }
}
```

**Pros**: zero new wiring beyond the resolver dispatch already exercised
by tasks. Hooks reuse `executeWithResolver` (`activity.ts:4185`),
inherit budget enforcement, inherit `impulse_resolutions` recording,
inherit resolver-tier classification (`classifyResolverTier` in
`resolver-tiers.ts`), inherit vessel routing (`parseResolverName` →
`vessel-proxy`). The trace schema gets one new field
(`executionTrace.hookInvocations`), nothing else.

**Cons**: cross-cutting hooks (e.g., "every activity that uses shape X
should warm cache Y") aren't expressible without adding the hook
declaration to every matching template. That cost is small for v1 —
template authors already copy-paste impulse declarations across
templates, and pattern learning will eventually surface the redundancy.

### Alternative B — Template-declared *and* vessel-registered hooks.

Templates declare per-activity hooks (as in A). Vessels also register
hooks via discovery — for example, an analysis-vessel could register a
`postExecution` hook that fires whenever an activity produces a
`source_code` impulse. The executor at trigger time queries discovery for
"hooks matching shape X" and runs them in addition to the
template-declared ones.

**Pros**: cross-cutting concerns expressible without template churn.
Patterns the system learns ("every fix-bug activity should run
pre-commit-checks afterward") can be expressed as vessel-side hooks.

**Cons**: requires extending discovery's register payload to include hook
metadata (`{trigger, shape_match, resolver_id, priority}`). The executor
at every hook trigger has to query discovery (or a cached projection of
it) to enumerate applicable vessel-side hooks. Failure to query
discovery at hook time is a new failure mode that has to be handled
gracefully. Significant scope.

The discovery-to-tools-bridge spec is already covering how vessels
advertise *tools*; vessel-registered hooks would be a structurally
similar extension on top of that. We defer to v2 and let the bridge
spec stabilize first.

### Alternative C — In-process function-reference hooks (current `vessel-hooks.ts` style).

Hooks are TypeScript functions registered into a global
`VesselHookRegistry` at startup. Templates don't declare hooks — they're
pure side-channel.

**Pros**: matches the `vessel-hooks.ts` design as it stands today; the
`pre-selection` integration in `goal-processor.ts` already uses this
pattern.

**Cons**: hooks are no longer measurable as part of the activity. They're
opaque code paths, not data. Trace integration is awkward. Cross-vessel
or cross-process hooks are impossible by construction. The system can't
reason about hooks the way it reasons about resolvers (selection,
ranking, learning). Worst of all, the `ImpulseStateSpace` they receive
(`vessel-hooks.ts:42`) is a snapshot that doesn't include the
activity-level context (which template, which execution id, which
variables) — so the hooks are effectively environment-level, not
activity-level. We'd need to widen `ImpulseStateSpace` *and* expose
hook registration as a vessel-discovery extension to make them useful at
activity granularity, at which point we've reinvented (B) but worse.

We treat (C) as legacy — it stays for `pre-selection` because the
goal-processor needs in-process callbacks before it has a template — but
new triggers in this spec are template-declared (A).

## 4. Recommended design

**Template-declared, resolver-based, executor-fired.** Here's the contract.

### 4.1 Template surface

Add to `ActivityTemplate` (`repos/minibob/src/types.ts:680`):

```ts
export interface HookDecl {
  id: string;                  // unique within the template's hooks
  resolver: string;            // resolver name, with optional vessel: prefix (parseResolverName)
  config?: Record<string, unknown>;
  timeout?: number;            // default 5000 ms
  outputShapes?: string[];     // shapes the hook is expected to produce; used for post-execution shape merging
  failurePolicy?: "abort" | "continue" | "warn";
  // No prompt/template field — hooks are deterministic-by-policy. If you want
  // an LLM hook, route through resolver "llm" with explicit prompt config; it
  // gets the same trace treatment as any LLM task.
}

export interface ActivityHooks {
  preExecution?: HookDecl[];
  postExecution?: HookDecl[];
  onFailure?: HookDecl[];
  onStateChange?: HookDecl[]; // see §4.4 for granularity
  periodic?: Array<HookDecl & { intervalMs: number }>;
}

export interface ActivityTemplate {
  // ... existing fields ...
  hooks?: ActivityHooks;
}
```

Backward compat: every field is optional. An existing template with no
`hooks` block runs identically to today.

### 4.2 Trigger semantics

| Trigger | Fires | Inputs available | Can mutate? | Failure policy |
| --- | --- | --- | --- | --- |
| `preExecution` | Once, after impulses are loaded but before the first task is dispatched. Concretely: between `activity.ts:2079` (impulse merge) and `activity.ts:2099` (topological sort). | `template`, `variables`, the merged impulse pool (loaded), `execution.id`, `execution.parentExecutionId`. | **Append-only**. May add impulses to the pool; may not remove or modify existing ones; may not reorder tasks. Returned impulses are merged into `execution.impulses` before sorting. | Default `abort`: the hook's failure aborts the activity (status `failed`, error `preExecution hook ${id} failed: ${msg}`). The trace is still emitted but with zero `taskResults`. |
| `postExecution` | Once, after all tasks complete on the success path, between `activity.ts:2814` (status set to `completed`) and `activity.ts:2862` (`onActivityCompleted` broadcast). | Full `execution` (final), all `taskResults`, the impulse pool as it stands at end-of-tasks. | **Append-only**. May add output impulses; may not modify trace tasks or change `execution.status`. Returned impulses are appended to `executionTrace.impulsesCreated`. | Default `warn`: log + record in `hookInvocations` with `success=false`; activity stays `completed`. Promote to `abort` only when the template author explicitly sets `failurePolicy: "abort"`, in which case we *downgrade* `execution.status` from `completed` to `failed_in_postexecution` (a new status) and surface the error. |
| `onFailure` | Once, in the existing `catch` block at `activity.ts:3320-3331`, immediately after `execution.status = "failed"` and before the failure broadcast. | `execution` (partial), `taskResults` up to the failing point, the error. | **Cleanup only**. May not retry tasks (retry logic stays in `executeTask`'s `retry.maxAttempts`). May produce impulses (e.g., a "diagnostic-bundle" memo); those impulses get appended but they are not promoted to the recommendation system. | Default `continue`: log a nested-failure warning; do not cascade. The activity stays `failed` with the original error; the hook failure shows up in `hookInvocations`. |
| `onStateChange` | **Per-task**, not per-impulse-update. Fires after each task completes (between `activity.ts:2603` `onTaskComplete?.(...)` and the next group's start), iff the task's `outputShapes` intersect with the hook's `triggerOnShapes` (a new field on the hook decl, defaulting to "any"). | The just-completed task's `result`, the running impulse pool, the hook's filter shape match. | **Append-only**. May produce impulses for downstream tasks. | `warn` by default. Importantly, this trigger is opt-in per hook — there's no implicit firing on every task. |
| `periodic` | Timer-driven, started on `execute()` entry and stopped in the `finally` block (`activity.ts:3352`). Fires every `intervalMs`. | The current execution snapshot (impulses, last completed task, elapsed time). | **Observe only** in v1. May not produce impulses that feed into tasks. Intended for watchdog/heartbeat (e.g., emit a progress impulse to a renderer). | `continue`: timer keeps firing. Hook errors are logged once per hook (then suppressed for that execution to avoid log floods) but never abort. |

The granularity choice for `onStateChange` is deliberate. The
ImpulseStateSpace already changes per-tool-call inside an LLM task
(`captureToolCalls`), and firing hooks on every tool call would add
N × M × L overhead (tasks × tool calls × hooks). Per-task is the right
checkpoint: it's where the trace already records a discrete state
transition (`ExecutedTask.stateTransition`).

### 4.3 Hook implementation type

Hooks resolve through the **same resolver dispatch as resolver-typed
tasks**. `parseResolverName(hookDecl.resolver)` (already exists, used at
`activity.ts:4038`) extracts the vessel prefix; resolver name maps to a
local `Resolver` (bash, file, git, validation, ...) or a vessel-routed
call via `vessel-proxy`.

This gives us, for free:
- LLM hooks via `resolver: "llm"` (same dispatch as LLM-typed tasks).
- Deterministic hooks via `resolver: "bash"`/`"git"`/`"file"`.
- Pattern hooks via `resolver: "validation"`.
- Cross-vessel hooks via `resolver: "concept-db:warmConceptCache"`,
  `"activity-api:recordImpulseRelevance"`, etc.

The function-reference path from `vessel-hooks.ts` stays available for
`pre-selection` (and the legacy infrastructure), but is *not* used for
the new triggers. Practically, this means `vessel-hooks.ts` becomes the
narrow registry for `pre-selection` only; the new triggers don't go
through `getHookRegistry()`.

Recommended priority chain for hook resolver lookup, identical to the
task path:

1. Local resolver registered on the executor (`this.resolvers`).
2. Vessel-routed resolver (`vessel-proxy` if a `vessel:` prefix is
   present).
3. LLM fallback if `resolver === "llm"` (or no resolver and prompt is
   specified — but hook decls have no prompt field, so this branch is
   inert; reserved for future).

### 4.4 Failure semantics, summarized

The matrix lives in §4.2. The pattern: `preExecution` is mandatory (abort
on failure), `postExecution`/`onStateChange`/`periodic` are advisory
(warn on failure), and `onFailure` is best-effort cleanup that cannot
cascade (a nested failure is logged and dropped; we don't recurse into
re-firing `onFailure` for `onFailure`'s own failure).

`postExecution` with `failurePolicy: "abort"` is the one tricky case: the
activity has already succeeded from the user's perspective; downgrading
to `failed_in_postexecution` could surprise callers. Document it
explicitly in the foundation doc and require template authors to opt
in. The default-warn path keeps the surface change minimal.

### 4.5 Trace integration

Hook invocations land in `ExecutionTrace.hookInvocations`, a new array
parallel to `tasks` and `impulse_resolutions`:

```ts
// Add to ExecutionTrace (repos/minibob/src/types.ts ~line 952-1046):
hookInvocations?: Array<{
  hook_id: string;          // HookDecl.id
  trigger: HookTrigger;     // pre-execution, post-execution, on-failure, on-state-change, periodic
  resolver_id: string;      // resolved resolver name (post-parseResolverName)
  resolver_tier: ResolverTier; // deterministic | pattern | llm
  vessel_id?: string;       // if vessel-routed
  started_at: number;
  ended_at: number;
  duration_ms: number;
  cost_usd: number;
  success: boolean;
  error?: string;
  output_shapes?: string[]; // shapes produced
  output_impulse_ids?: string[]; // impulses produced
  // For onStateChange: which task triggered
  triggered_by_task_id?: string;
  // For periodic: the firing index (0, 1, 2, ...)
  periodic_iteration?: number;
}>;
```

Why a new top-level array, not a synthetic task in `tasks[]`? Two
reasons:

1. Tasks are part of the template's DAG; hooks aren't. Mixing them
   inflates the Thompson Sampling denominator (hook failures would count
   as task failures). Keeping them separate preserves the existing
   success-rate calculation.
2. The activity-api's existing trace consumers (concept-db's
   co-occurrence extractor, the WebSocket observer) iterate
   `tasks[].input_impulse_ids`/`output_impulse_ids`. Adding synthetic
   tasks would polute those iterations. A separate field is invisible
   to consumers that don't opt in, and explicit for those that do.

The `impulse_resolutions` array (`activity.ts:3003`) already records
resolver-level resolution events. Hook invocations are a strict superset
— every hook fires through a resolver — but we want them grouped under
the hook id, not the impulse id, because a hook's identity is "this
declared lifecycle action" not "this impulse was resolved".

Backward compat: existing traces without `hookInvocations` are fine. The
field is optional.

### 4.6 Backward compatibility

- **Templates without `hooks`**: zero behavioral change. `template.hooks`
  is `undefined` → all the hook-firing branches short-circuit.
- **Existing function-style hooks** (`vessel-hooks.ts` registry): kept
  for `pre-selection`. `goal-processor.ts:1648` continues to work as is.
  We do *not* re-route the new triggers through this registry; they go
  through the resolver dispatch.
- **Trace schema**: `hookInvocations` is additive. The activity-api's
  existing schemas (`execution_trace`, `execution`) accept it as
  pass-through metadata until/unless backend consumers opt in to read
  it.
- **`lifecycle-hooks.ts` and `impulse-verification-hooks.ts`**: leave in
  place but mark explicitly orphaned (a `@deprecated` JSDoc comment
  pointing at this spec). They're not on any code path. Deletion is
  scope creep; defer.

## 5. Implementation outline

### 5.1 minibob (`repos/minibob/`)

**File: `src/types.ts`** (~line 680, inside `ActivityTemplate`)
- Add `hooks?: ActivityHooks` field.
- Add `HookDecl`, `ActivityHooks`, `HookInvocation` interfaces near
  the existing `ActivityTask` interface (line 520). Reuse the
  `HookTrigger` type from `vessel-hooks.ts` *without re-exporting* — we
  don't want the new typed-resolver triggers and the legacy in-process
  triggers to pollute each other's namespace. (Concretely: keep the
  five-string union literal in `vessel-hooks.ts` and define a separate,
  narrower `ExecutorHookTrigger = "preExecution" | "postExecution" |
  "onFailure" | "onStateChange" | "periodic"` in `types.ts`, then have
  the executor accept either.)

**File: `src/types.ts`** (`ExecutionTrace` interface, ~line 952)
- Add `hookInvocations?: HookInvocation[]`.

**File: `src/activity.ts`** — three new private methods on
`ActivityExecutor`:

1. `private async runPreExecutionHooks(template, execution): Promise<{addedImpulses: Impulse[]; aborted: false} | {aborted: true; error: string}>`
   Inserted into `execute()` between `activity.ts:2079` (impulse merge)
   and line 2099 (topological sort). On `abort` it sets
   `execution.status = "failed"` with the hook error, emits the trace,
   and returns to `finally`.

2. `private async runPostExecutionHooks(template, execution): Promise<void>`
   Inserted between `activity.ts:2814` (status flip) and the existing
   resolver-invocations summary (line 2825). Records each invocation in
   `execution.executionTrace.hookInvocations`.

3. `private async runOnFailureHooks(template, execution, error): Promise<void>`
   Inserted into the existing `catch` block at `activity.ts:3320`,
   right after the broadcast at line 3327. Wraps every hook in its own
   try/catch — a hook failure here is logged and recorded but never
   re-thrown.

`onStateChange` hooks: dispatched inside the per-task post-completion
branch around `activity.ts:2603`. Filter by `triggerOnShapes`
intersection with the just-completed task's `outputShapes`. Same trace
recording as the others.

`periodic` hooks: started after the `try` block at line 2063, stopped in
the `finally` at line 3352. A `Map<hookId, Timer>` on the executor
instance keyed by `execution.id` to support concurrent `execute()` calls
(nested activities). On stop, ensure all in-flight invocations
`Promise.allSettled` before the `finally` returns — otherwise a
periodic hook can outlive its execution and trample on state.

A single shared `private async dispatchHook(hookDecl, trigger, ctx)`
method routes through the existing `executeWithResolver`
(`activity.ts:4185`) — duplicating the dispatch logic is a recipe for
divergence. Pass through `budget` and `vessel-proxy` paths unmodified.
Hook costs *do* count against the same budget frame as tasks
(`_budgetStack`); a runaway hook should be caught by the same budget
check. This is a deliberate choice: hooks are activity-scoped work, so
they share the activity-scoped budget.

**File: `src/vessel-hooks.ts`**
- No changes to the registry. Mark `pre-execution`, `post-execution`,
  `on-state-change`, `on-failure`, `periodic` HookTrigger values as
  `@deprecated` with a comment pointing at this spec — they remain for
  the future where someone wants in-process function-reference hooks
  triggered at the *legacy* lifecycle points. The new template-declared
  pathway uses `ExecutorHookTrigger` and bypasses this registry.

**File: `src/lifecycle-hooks.ts`, `src/impulse-verification-hooks.ts`**
- Add JSDoc `@deprecated` comments noting these are not wired and the
  template-declared hooks defined in §4.1 are the supported path.
- No code deletion in v1.

### 5.2 discovery-vessel + shared package

**Out of scope for v1** (see §3 alternative B). When the
discovery-to-tools bridge spec lands, consider an extension that lets
vessels advertise hook bindings — but defer to that spec for the
contract. This spec only handles template-declared hooks.

### 5.3 Templates

Two example templates demonstrate the surface. Don't ship these as PRs
yet — wait for the implementation. They are illustrative.

**`templates/concept/prime-context-for-task.json`** — refactor to use
hooks:

```jsonc
{
  "id": "prime-context-for-task",
  "name": "Prime Context for Task",
  "tasks": [
    // task-2 (was: inject-into-task-prompt) becomes the only task
    { "id": "execute-with-context", ... }
  ],
  "hooks": {
    "preExecution": [
      { "id": "load-concept-context",
        "resolver": "concept-db:loadPrimedContext",
        "config": { "goalDescription": "{{goalDescription}}" },
        "outputShapes": ["memo"],
        "timeout": 4000 }
    ],
    "postExecution": [
      { "id": "record-relevance",
        "resolver": "concept-db:recordConceptRelevance",
        "config": { "executionId": "{{$execution.id}}",
                    "goalDescription": "{{goalDescription}}" },
        "timeout": 5000,
        "failurePolicy": "warn" }
    ]
  }
}
```

What this buys, concretely:

- Task DAG goes from 3 tasks to 1 task. Thompson Sampling now learns
  whether *the actual task* succeeded, not whether bookkeeping
  succeeded.
- The `record-relevance` postExecution hook makes explicit the contract
  that concept-db wants every prime-context activity to feed back
  relevance scores. Today this lives as an LLM-driven task that may or
  may not run depending on whether the LLM remembers to do it; with a
  postExecution hook, it always runs (or warns if it can't).
- Closes a residual gap from the impulse-relationship-signal-verification
  spec: today, concept usage stats rely on the WebSocket observer
  picking up impulse loads. With an explicit `recordConceptRelevance`
  hook, the relevance feedback is direct — no observer dependency.

**`templates/concept-learning/learn-impulse-relationships.json`** —
add a `periodic` watchdog:

```jsonc
"hooks": {
  "periodic": [
    { "id": "progress-heartbeat",
      "resolver": "memo",
      "config": { "content": "learn-impulse-relationships heartbeat at {{$now}}" },
      "intervalMs": 30000 }
  ]
}
```

So a 5-minute extraction job emits a heartbeat impulse every 30 seconds
that the dashboard can render as a progress indicator.

## 6. Test plan

### 6.1 Unit (per trigger)

In `repos/minibob/src/activity.test.ts` (or a new
`activity-hooks.test.ts`):

1. `preExecution success` — template with one preExecution hook
   (`resolver: "memo"`) that produces an impulse. Assert the impulse
   appears in `execution.impulses` and `executionTrace.hookInvocations`
   has one entry with `success: true`.
2. `preExecution failure aborts` — preExecution hook with
   `resolver: "bash"` and `command: "exit 1"`. Assert
   `execution.status === "failed"`, no tasks ran, error mentions hook id.
3. `postExecution success` — single-task template with one
   postExecution hook. Assert hook ran after the task,
   `executionTrace.hookInvocations` has the entry, and
   `execution.status === "completed"`.
4. `postExecution failure with default policy` — postExecution hook
   that throws. Assert `execution.status === "completed"` (warn-only),
   `hookInvocations[0].success === false`.
5. `postExecution failure with abort policy` — same but
   `failurePolicy: "abort"`. Assert
   `execution.status === "failed_in_postexecution"`.
6. `onFailure cleanup` — template with one task that fails (e.g.,
   bash `exit 1`) and an onFailure hook. Assert hook ran, activity is
   `failed`, hook recorded with `success: true`.
7. `onFailure nested failure` — onFailure hook itself fails. Assert no
   cascade: execution stays `failed` with the original error,
   `hookInvocations[0].success === false`.
8. `onStateChange filtered` — two tasks producing different shapes; one
   onStateChange hook with `triggerOnShapes: ["source_code"]`. Assert
   the hook fired exactly once (after the task that produced
   `source_code`), not twice.
9. `periodic timing` — template with a 1-task LLM task and a periodic
   hook at `intervalMs: 50`. Use a fake task that takes 250ms (sleep).
   Assert hook fired at least 4 times, all recorded with monotonically
   increasing `periodic_iteration`.
10. `periodic stops on completion` — same setup, then assert no
    `hookInvocations` entries with `started_at >
    execution.completedAt`.

### 6.2 Integration

In `repos/minibob/src/activity-graph-execution.test.ts` (existing graph
test harness):

1. **End-to-end with prime-context-for-task** — load the refactored
   template, execute against a stubbed concept-db (or the real one in a
   test-DB scenario). Assert: 1 task ran, 1 preExecution hook ran, 1
   postExecution hook ran, `hookInvocations.length === 2`,
   `tasks.length === 1`. Same overall outcome as today (primed context
   memo present in output).
2. **Trace persistence** — execute a hook-using template with
   `MCP_BACKEND_URL` pointed at a recording mock. Assert the
   `hookInvocations` array round-trips through `mcp.reportExecution`
   without being stripped. (Tests the "additive trace field, backend
   accepts pass-through" claim from §4.5.)
3. **Backward-compat smoke** — run an existing template with no
   `hooks` field. Assert: `execution.executionTrace.hookInvocations`
   is `undefined` or `[]`, the rest of the trace is byte-for-byte
   identical to a pre-spec run (sans `hookInvocations`). This is the
   regression gate.
4. **Budget interaction** — execute a template where preExecution +
   postExecution + tasks together exceed `maxBudget`. Assert the
   activity aborts on budget at the same checkpoint it would today —
   hook costs fold into the budget frame (`_budgetStack`).

### 6.3 What we are not testing in v1

- Vessel-registered hooks (out of scope; see §5.2).
- Concurrency between periodic hooks across nested `execute()` calls
  beyond the basic isolation test in 6.1#10. Real concurrency
  pathologies need a stress-test harness this spec doesn't ship.
- Hook-as-LLM-resolver with full prompt config — punted to a follow-up.
  v1 hooks are deterministic-by-policy.

## 7. Open questions

1. **Does `preExecution` see loaded or unloaded impulses?** Recommend
   *loaded*. Hooks need the data, not the pointers, and the cost of
   loading is paid once anyway. But this means impulse load happens
   *before* preExecution, not in parallel — slight latency hit.
   Alternative: pass the unloaded set and let the hook resolver decide.
   Lean toward loaded for simplicity; revisit if a real hook complains.

2. **Should preExecution hooks be allowed to *replace* the task DAG?**
   Recommend no for v1. A preExecution hook that returns a mutated
   template is a much bigger surface; defer until a real use case
   justifies it. (E.g., "if the goal is X, swap in template Y" — but
   that's selection logic, not pre-execution.)

3. **What does `{{$execution.id}}` mean in a preExecution hook config,
   given the execution id is generated at line 1881 before any hooks
   fire?** Already resolved: the id exists at hook-fire time
   (we run `runPreExecutionHooks` after impulse merge, well after id
   generation), so interpolation works. But document it explicitly in
   the variable spec.

4. **Should `onStateChange` carry the impulse-pool *delta*, not just the
   completed task's outputs?** A stricter "what changed in the state
   space" signal is more useful than "what did the task return", but
   computing it requires diffing the whole pool. v1: just task outputs.
   Revisit if hooks start needing pool-level diffs.

5. **Periodic hooks during nested `execute()` calls**: when a task's
   resolver invokes another activity, do the parent's periodic hooks
   keep firing or pause? Recommend *keep firing* — they're observing
   the parent activity's wallclock, not its task graph. But document
   this so template authors don't expect "fire only when my own task
   is running".

6. **Failure-mode collision with the existing `onActivityFailed`
   callback** (`config.onActivityFailed?` at `activity.ts:3327`): that
   callback is for WebSocket broadcast, distinct from the new
   `onFailure` *hook*. Naming is going to confuse readers. Consider
   renaming the WebSocket callback to `onActivityFailedBroadcast` in
   the implementation PR. Not strictly required for the spec.

7. **Discovery-registered hooks**: the boundary with the
   discovery-to-tools-bridge spec has to be crystal-clear before v2.
   Specifically: when a vessel registers both a tool *and* a hook for
   the same shape, what's the precedence? Don't try to answer this
   here; flag it for the bridge spec's author.

8. **`failed_in_postexecution` status**: introducing a new top-level
   status is a meaningful breaking change for any consumer that
   string-matches on `execution.status`. Consider keeping the status as
   `failed` and using a separate flag (`postExecutionFailed: true`)
   instead. The activity-api's status enum (`repos/metabob-activity-api/
   src/models/schemas.ts`) would need to grow regardless. Lean toward
   the flag approach to minimize breakage; revisit during
   implementation.

9. **Hook ordering across multiple decls per trigger**: today
   `vessel-hooks.ts` sorts by priority. The template-declared hook
   array gives a natural order — first-listed runs first. Is that
   sufficient, or do we want a `priority` field? Lean toward
   array-order for v1 (KISS); add `priority` only when a template needs
   it.

10. **What gets recorded if a periodic hook fires *during* a task's
    LLM call?** The trace task's `started_at` and `ended_at` bracket
    the LLM call; the periodic invocation's `started_at` falls inside
    that range. Consumers iterating `tasks[]` and `hookInvocations[]`
    in time order need to handle interleaved entries. Document the
    interleaving explicitly so consumers (concept-db's extractor,
    workbench's flame graph) don't assume disjoint time ranges.

---

## File:line citations summary

- `repos/minibob/src/vessel-hooks.ts:29-36` — `HookTrigger` union (legacy)
- `repos/minibob/src/vessel-hooks.ts:84-129` — `VesselHook` interface
- `repos/minibob/src/vessel-hooks.ts:529-551` — registry singletons
- `repos/minibob/src/lifecycle-hooks.ts:40-84` — orphaned namespace-style hook surface
- `repos/minibob/src/impulse-verification-hooks.ts:23-117` — orphaned consumer
- `repos/minibob/src/goal-processor.ts:1648` — the only live hook integration today (`pre-selection`)
- `repos/minibob/src/activity.ts:1863` — `execute()` entry
- `repos/minibob/src/activity.ts:2079` — impulse merge (preExecution insertion point)
- `repos/minibob/src/activity.ts:2099` — topological sort
- `repos/minibob/src/activity.ts:2603` — per-task `onTaskComplete?.(...)` (onStateChange firing point)
- `repos/minibob/src/activity.ts:2814-2862` — success-path completion (postExecution insertion point)
- `repos/minibob/src/activity.ts:3320-3331` — `catch` block (onFailure insertion point)
- `repos/minibob/src/activity.ts:3352` — `finally` (periodic teardown)
- `repos/minibob/src/activity.ts:4038` — `parseResolverName` (vessel routing)
- `repos/minibob/src/activity.ts:4185` — `executeWithResolver` (shared dispatch)
- `repos/minibob/src/types.ts:680-806` — `ActivityTemplate` (where `hooks?` field is added)
- `repos/minibob/src/types.ts:952-1046` — `ExecutionTrace` (where `hookInvocations?` is added)
- `templates/concept/prime-context-for-task.json` — the worked example for §5.3
- `templates/demonstrate-activity-system.json` — confirms no current template declares hooks
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` — the unfulfilled foundation claim
- `docs/specs/impulse-relationship-signal-verification.md` — the sibling typology spec
