# Concept relevancy never increments — investigation 2026-06-04

## 1. Diagnostic summary (one line)

The `autocomplete-concept-writer` observer fires reliably on every substrate-authored success, but it dispatches `concept_create` (which mints a fresh `concept_<nanoid>` every time) instead of `concept_usage_record` (which would bump `times_succeeded` on the **existing** concepts cited in that execution's prompt priors). Increment of `times_succeeded` is delegated to a separate template (`concept-usage-backfill`) whose third task — the actual write — fails in recent runs, so the only path that touches `ts/tf` has been silently broken.

## 2. Evidence chain

### Observer fires constantly
`docker exec substrate-live journalctl -u development-vessel --since="6 hours ago"` shows ~30+ lines of:

```
[autocomplete-concept] concept_create fired: template=development-vessel:apply-proposal-as-patch exec=exec_jmkwu32s concept=concept:concept_d3QGgTUW3M5C
[autocomplete-concept] concept_create fired: template=gap-closing:auto-1780604181031-... exec=exec_65220cd0-46f concept=concept:concept_e3WLLEaTkPqB
```

Every fire yields a **distinct** `concept_<nanoid>` — these are brand-new rows, not increments. So the observer "succeeds" while never touching the relevance signal on the concepts that were actually consumed by the just-completed execution.

### Observer code is explicit about this scope
`repos/development-vessel/src/observers/autocomplete-concept-writer.ts:26-28` (commit 4bd0bd8):

> "Concept-usage-record (incrementing ts/tf on cited priors) is handled by the existing concept-usage-backfill template; this observer only handles the concept_create side, where new patterns become first-class learnable units."

And `:175` calls `resolveDispatch(pointer)` where `pointer.type === "concept_write"`, which hits `repos/development-vessel/src/resolvers/concept-write.ts:70-74` → `POST http://127.0.0.1:8260/concepts`. That route (`repos/concept-db/src/routes/concepts.ts:42-61`) calls `createConcept` — pure insert, no upsert-by-name semantics. So every observer fire is a guaranteed insert, never an update of an existing row's `times_succeeded`.

### concept-usage-backfill IS dispatched but the write task fails
Boredom goal[16] dispatches `development-vessel:concept-usage-backfill` (`repos/boredom-vessel/src/index.ts:325-330`). Recent log:

```
21:48:13 [pool] reserving goal[16] (...) score=1.30
21:48:20 [pool] light-dispatch sync goal[16] (...) status=failure executionId=exec_0f8c43d7-05b
22:47:46 [pool] light-dispatch sync goal[16] (...) status=failure executionId=exec_aa92b1bb-c52
```

Trace `exec_0f8c43d7-05b`:
- `success_count: 2, failure_count: 1, task_count: 3`
- `output_impulse_shapes: ["conceptPromptPriors", "json_extracted_value"]` — tasks 1 and 2 succeeded
- Task 3 (`record_usage`, resolver `concept_usage_record`) failed
- `failure_mode: null` — failure was not classified

Earlier 19:32 backfill ticks succeeded; the regression is recent.

### The increment endpoint and resolver both exist and are correctly implemented
- `POST /concepts/:id/usage` is live (`repos/concept-db/src/routes/concepts.ts:403-427`) and calls `recordUsage`
- `recordUsage` (`repos/concept-db/src/resolvers/usage.ts:33-90`) updates `times_succeeded`, `times_loaded`, and the Bayesian `relevance = (ts+1)/(tl+2)` correctly
- `concept_usage_record` resolver in dev-vessel (`repos/development-vessel/src/resolvers/concept-usage-record.ts:36-94`) POSTs the right URL, has the right contract
- It is dispatch-wired: `src/config.ts:222` + `src/routes/impulses.ts:203-204`
- 5/5 per-resolver tests green per the backfill template's docstring

## 3. Schema reality

`concept-db` exposes a complete two-call API:
- `POST /concepts` → create new (`createConcept`) — NO increment semantics, no name-based upsert
- `POST /concepts/:id/usage` → increment ts/tf/tl on a known id (`recordUsage`) — the **only** writer of `times_succeeded`

There is no third resolver that combines them ("upsert-by-name with increment-on-hit"). `POST /concepts/upsert-by-signature` exists (`routes/concepts.ts:180-219`) but is keyed on `pointer_type + shape` (impulse signature concepts) and also does not bump `ts`.

## 4. Single-trace failure point

Pick `exec_0f8c43d7-05b` (concept-usage-backfill at 21:48Z):
- task 1 `select_concept` → emitted `conceptPromptPriors` ✓
- task 2 `extract_concept_id` → emitted `json_extracted_value` ✓
- task 3 `record_usage` → resolver `concept_usage_record` returned `structuredError` (presumably empty/malformed concept_id from `{{extract_concept_id_text}}`, OR concept-db 4xx on bad request — `failure_mode: null` means no classifier caught it)

Meanwhile in the SAME 6-hour window the autocomplete observer fired 30+ concept_creates — none of which incremented any existing concept's `ts`. Net effect: 30+ new orphan concepts, 0 increments to the priors that the substrate actually consumed.

## 5. Smallest fix to close the gap

Ranked by LOC:

1. **(~5 LOC)** Investigate why task 3 `concept_usage_record` is now failing. Likely culprits: empty `{{extract_concept_id_text}}` (when `concept_select_for_prompt` returns empty `selected[]` for the rotating query) or a contract drift in `json_path_extract`'s output variable name. Add a guard in the template that short-circuits cleanly when `concept_id` is empty (already documented as intended behavior at `concept-usage-backfill.ts:108-113` — verify it actually works).

2. **(~30 LOC)** Extend `autocomplete-concept-writer` to ALSO emit `concept_usage_record` for every prior cited by the completed execution. The observer already has the `execution_id`; fetch the trace's `input_impulse_ids` of shape `conceptPromptPriors`, pull the `selected[].id` list, dispatch one `concept_usage_record` per cited concept with `outcome=success`. This co-locates the create-new and increment-existing writes in a single observer (more cohesive than separating into observer + cron template).

3. **(~50 LOC)** New shape `concept_upsert_with_usage` in concept-db: single endpoint that looks up by content hash, increments `ts` if hit, creates if miss. Closes the inversion at the API layer so callers can't accidentally separate the two. Largest fix, broadest leverage.

## 6. Architectural recommendation

The autonomous loop's "concept relevance accumulates per successful execution" wiring is **structurally bifurcated** today: observer handles create-new, cron template handles increment-existing. That split is the root cause — each side can break independently, and one (the increment side) currently is broken. Specifically:

- **Today**: every substrate-authored success → 1 new orphan concept; usage increments depend on an unrelated 5-min cron template selecting the right concept via vector search. Coupling is none.
- **Should be**: every substrate-authored success → fan-out of `concept_usage_record` for every concept that fed the execution's prompt priors, plus optionally one `concept_create` for the pattern itself. Coupling is direct: the priors that *were used to produce this success* are the priors whose `ts` increments.

Concretely, the autocomplete-concept-writer observer should read the completed execution's `input_impulse_ids`, locate ones with shape `conceptPromptPriors`, extract every `selected[].id`, and dispatch `concept_usage_record` for each. The current `concept-usage-backfill` template only ever updates *one* concept per 5-min tick under a *rotating query* — even when it works, that's ~12 increments/hour against 48 concepts, while substrate-authored successes are happening 5–10× per minute. The signal density is off by 2–3 orders of magnitude.

Without this rewire, `times_succeeded` SUM will continue to track the cron's tick rate, not the substrate's success rate, and the Bayesian prior `(ts+1)/(tl+2)` will remain near 0.5 / decaying for almost every concept — exactly the inversion the original comment at `concept-usage-record.ts:13-15` warned about.

## Cited files

- `repos/development-vessel/src/observers/autocomplete-concept-writer.ts:26-28, 91-110, 175`
- `repos/development-vessel/src/resolvers/concept-write.ts:47, 59-67, 70-74`
- `repos/development-vessel/src/resolvers/concept-usage-record.ts:13-15, 36-94`
- `repos/development-vessel/src/seed/concept-usage-backfill.ts:108-138`
- `repos/concept-db/src/routes/concepts.ts:42-61 (POST /concepts), 403-427 (POST /:id/usage)`
- `repos/concept-db/src/resolvers/usage.ts:33-134`
- `repos/boredom-vessel/src/index.ts:325-330`
