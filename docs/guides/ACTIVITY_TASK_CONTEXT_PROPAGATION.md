# Activity Task Context Propagation

**Applies to:** `minibob` commit `61a6617` and later (2026-04-22); concepts carry forward into `ias-executor-ts` / `goal-host-vessel` (Phase 26+ substrate)
**Source (Phase 26+):** execution logic lives in `repos/goal-host-vessel/` and `@avigopal/ias-executor-ts`; the four propagation mechanisms below are substrate-vessel responsibilities, not minibob-internal.
**Source (historical):** `repos/minibob/src/activity.ts` (executor), `src/embedded-templates/`, `src/memory-agent.ts`

Within a single activity execution, later tasks need to see impulses that earlier tasks produced, and declarative shape requirements on templates need to actually influence what reaches the LLM. Three mechanisms in the executor make this hold:

1. **Store sweep propagation** at task-group boundaries
2. **Embedded-template field graft** after backend round-trip
3. **Gap detection with SessionMemoryAgent fallback** at `executeWithLLM` entry

## 1. Store sweep propagation

The executor runs tasks in parallel groups (one group at a time, tasks within a group in parallel). Before each group, it records `groupStartTime`. After the group settles, it sweeps the global impulse store for impulses with `createdAt >= groupStartTime` that are not already in the shared `impulses` pool.

This picks up tool-call side-effects — things like `tool:bash:<hash>` and `arg:read:<hash>` — which are registered in the store by the LLM tool-call path but never surface through the explicit `result.metadata.outputImpulses` channel. Before this, everything those tool calls produced was invisible to downstream tasks.

**Filter:** only impulses with `loaded: true && content != null` are swept in. Unresolved pointer impulses (e.g. `toolArgument` pointing at a custom resolver that's currently unreachable) stay out of the pool; they'd otherwise kill the next task's load step.

**Observability:**
```
[Propagation] Swept <N> ad-hoc impulse(s) from store into downstream pool
[Propagation] Store sweep failed: <error>
```

Location: `activity.ts` executor loop around line 1790.

## 2. Embedded-template field graft

Templates that flow through the backend get sanitized — unknown fields don't round-trip through validation. The fields that drop off fall into two tiers:

**Per-task fields** (matched by `task.id`):
- `inputShapes`
- `outputShapes`
- `optionalInputShapes`
- `impulseReferences`
- `inputImpulses`
- `outputImpulses`

**Top-level fields** *(added 2026-04-22 `d01d946`)*:
- `variables` — carries the `default` values the `-t` loader relies on to populate `{{iteration}}`, `{{templateSoFar}}`, and similar placeholders before calling `executor.execute`.
- `inputSchema`
- `outputSchema`

Without the per-task fields, runtime shape-selection and impulse-requirement tracking have nothing to work with — shape-aware behavior silently degrades to "pass everything." Without `variables`, the `-t` codepath's `effectiveVariables` merge finds no defaults to iterate and every unspecified variable stays as a literal `{{placeholder}}` in interpolated resolver configs.

`mergeEmbeddedTaskFields(template)` (activity.ts:~6206, exported since `5817d4d`) is called after every backend resolve path (step 2/3), after cache hits (step 1), and after the `-t` entry-point's template load (`cli/run-activity.ts:loadTemplate`). It looks up the matching embedded template by bare id — stripping the `activity:` prefix and `⟨…⟩` wrapper the backend adds — and grafts missing fields back onto the live template object.

**Graft rules:**
- Per-task fields: only fill when currently `null`/undefined; never overwrite backend-provided values.
- Top-level fields: treat `null`/undefined **and empty-array/empty-object** as "needs graft" — so `variables: []` from the backend also gets repopulated from embedded.

**The design implication:** local embedded JSON is the canonical source of declarative metadata — both shape contracts and variable defaults. The backend is only a global discovery/learning surface for templates, not their schema of record.

**Observability:**
```
[Template] Grafted <N> per-task field(s) from embedded template "<id>"
[Template] Grafted top-level <field> from embedded template "<id>"
[Template] Embedded merge skipped: <error>
```

## 3. Gap detection + SessionMemoryAgent fallback

When `executeWithLLM` enters, it checks whether the task's declared `inputShapes` are all present in the current impulse pool. Missing shapes go through a two-tier fallback:

1. **Variable-to-memo synthesis (cheap, deterministic).** For each missing shape, if there's a variable with the same name in scope, synthesize a `memo` pointer impulse from its value. This covers the common `{{goal}}` pattern essentially for free — no LLM call, no backend round-trip.
2. **`SessionMemoryAgent.analyzeIntent` + `prepare` (LLM-backed).** For remaining gaps, ask the memory agent to suggest and create impulses for the missing shapes. Currently Anthropic-only; silently skips when another provider is active.

Supplemental impulses are pushed into both the task-local pool and the cross-task pool, so subsequent tasks see them too (and relevance learning gets a signal about which shapes were needed).

**Invariant:** the fallback only *adds* impulses. It never removes or replaces existing pool entries.

**Observability:**
```
[Impulse Selection] Task <taskId>: enriched pool with <N> impulse(s) for shapes [<shape1>, <shape2>]
  (<K> from variables, <M> from SessionMemoryAgent)
[SessionMemoryAgent] fallback failed: <error>
```

## 4. `materializeOutputImpulses` — the deterministic LLM-output boundary

*(Added 2026-04-22 `d5ed943`.)*

A task declaring `outputImpulses: ["propose_next_step"]` is a contract: after a successful run, an impulse with that id **will** exist in the store containing the task's output text. Downstream tasks can reference it via `{{impulse:propose_next_step}}` without waiting to see whether the LLM happened to remember to call a `create_impulse` tool.

This was previously wired but unreachable in practice. The auto-create lived inside a sequential legacy loop that was skipped for any task that ran through the parallel execution path — which is every task in every template. The parallel-path propagation step then tried to *load* outputImpulses that were never created; `loadImpulse` threw, the error was caught as a warning, and the impulse never entered the store. Net effect: `{{impulse:<id>}}` references in subsequent tasks resolved to `[impulse:<id> not found]` placeholders.

**Fix:** `executeTask` now calls a `materializeOutputImpulses` helper at the end of *every* successful return path — resolver, LLM, and the three LLM-fallback paths. It runs exactly once per successful task regardless of which outer loop dispatched it. `createImpulse` has set-overwrite semantics, so repeated calls with the same id are safe (latest task result wins).

**Materialized impulse shape:**
```jsonc
{
  "pointer": { "type": "memo", "content": "<task output text>" },
  "metadata": {
    "shape": "task_output",
    "producingTask": "<taskId>"
  }
}
```

The `shape: "task_output"` + `producingTask` metadata gives ribosome extraction and the learning loop a uniform surface to reason about "things LLMs produced in named slots" without inferring origin from id pattern.

**The design implication:** this is the deterministic boundary on LLM output. The LLM writes whatever it wants; the executor guarantees a named impulse exists with that content so downstream tasks — and the humans reading traces — can reference it reliably. Activity templates stop needing prose like *"use the memo tool to create an impulse with id X"* in prompts; they just declare `outputImpulses` and the executor materializes them.

### Related: missing-impulse graceful degradation

*(Added 2026-04-22 `c459304`.)*

Companion fix in `substituteImpulses`: a single missing id in a batch of `{{impulse:<id>}}` references no longer aborts the whole substitution. Each id is wrapped in its own try/catch; missing ids substitute to `[impulse:<id> not found]` (the documented but previously unreachable fallback) so dependent resolvers — `HumanResolver`, `bash` config interpolation, LLM prompt templating — keep dispatching with placeholders rather than cascading ✗ across tasks 2..N.

Taken together: `materializeOutputImpulses` closes the write-side hole, graceful substitution closes the read-side hole. Reference-by-id on task outputs is now genuinely reliable.

## Recency safeguard on the relevance filter

The existing backend-driven relevance filter (which drops impulses scored as low-relevance for the current activity) now never drops an impulse with `createdAt >= currentExecutionStartedAt`. The backend can't have relevance data for something it hasn't seen yet, so this stop-gap prevents the filter from starving an activity of its own freshly-produced outputs.

`currentExecutionStartedAt` is set in the executor at activity start and used by the relevance filter around `activity.ts:4337`.

## What this does to template design

Templates that were previously pass-through wrappers around LLM tool-use now get measurable value from declaring their shape contract:

- **`inputShapes` on a task** triggers the gap-detection path if any shape is missing. Declaring shapes is no longer documentation — it's a runtime hook.
- **`outputShapes`** participates in shape-aware pool matching for downstream tasks.
- **Tool-call outputs are first-class.** Tasks that produce impulses via `bash`, `read`, `edit` etc. no longer need to enumerate them in `outputImpulses`; the store sweep catches them.
- **`outputImpulses` is now a real contract.** Declaring `outputImpulses: ["<id>"]` guarantees (post-`d5ed943`) that a `task_output`-shaped impulse with that id exists after a successful run. Prompts stop needing prose like *"create an impulse with id X."*

Templates with empty per-task shape metadata still work, but they get the pre-61a6617 behavior: pool only contains explicit outputs.

## Related

- [`../architecture/ADVANCED_IMPULSE_PATTERNS.md`](../architecture/ADVANCED_IMPULSE_PATTERNS.md) — resolver-level impulse composition (layer below this one)
- [`../architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — impulse model and activity structure
- [`./MINIBOB_CLI_EXECUTION_TREE.md`](./MINIBOB_CLI_EXECUTION_TREE.md) — how propagated impulses surface in the CLI tree
