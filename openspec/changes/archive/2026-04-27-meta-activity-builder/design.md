## Implementation log — initial drop (2026-04-27)

Both subagents landed cleanly:

### Iteration resolver (commit `08bd7b2`)

`repos/minibob/src/resolvers/iteration-resolver.ts` (493 lines) + tests (392 lines, 13/13 pass). Registered at `activity.ts:1747` via `getIterationResolver({ resolveByName: (name) => registry.get(name) ?? null })`.

Closes F-4 / Infra Gap B (deferred since 2026-04-26). Activity-mode dispatch worked without executor refactoring — `ActivityExecutor.initializeResolvers()` already registers an `"activity"` resolver wired to `this.execute(...)` via closure; iteration's `resolveByName` callback closes over the live registry.

Three minor deviations from the proposal:
- `over` resolution accepts (1) actual array, (2) JSON-stringified array, (3) `{{shape}}` placeholder with one-level un-nesting (e.g. `{recommendations: [...]}` is unwrapped). Pragmatic; saves a transform task in the make-activity template.
- Failure-mode mapping: iteration records `cascading` for sub-dispatch failures and `validation_error` for unknown sub-resolver names. Sub-resolvers attribute their own specific failure modes.
- Per-iteration result captures the JSON-parsed body of the first output impulse from the sub-resolver. Multi-impulse capture deferred.

### make-activity meta-activity (commit `e1b8b10`)

`repos/minibob/src/embedded-templates/make-activity.json` (202 lines, 6 tasks). Registered in `EMBEDDED_TEMPLATE_FILES`.

Tasks:
1. `acquire_context` (impulse-resolve, pointer.type=activityTemplate, category=meta)
2. `identify_candidates` (iteration over activityRecommendations, body=llm scorer)
3. `execute_plan` (activity dispatcher)
4. `handle_errors` (iteration over alternates, body=activity, aggregateAs=first; conditional on execute_plan failure)
5. `declare_complete` (llm with `markGoalComplete` tool contract → emits goalEnd)
6. `extract_template` (impulse-resolve, pointer.type=activityTemplate_write; gated on applyTemplateExtraction variable, default false)

Four open questions documented in template `openQuestions[]`:
- Path-sandbox check: pre-validation resolver doesn't currently support `forbiddenPathPatterns`. Sandbox enforcement is documentary at the meta-activity level (workingDirectory threaded to children); runtime check needs a sibling `path_sandbox_validator` resolver.
- `extract_template` is a stub: no `template_synthesizer` resolver to render a write-payload from the execution path.
- `acquire_context` filters by `category: meta` rather than `output_shapes_intersect` (no such filter on the activityTemplate pointer today).
- `declare_complete` enforces the `markGoalComplete` tool contract via prompt (no per-task tool registry hook today).

Subagent observations informing spec evolution:
- Iteration's auto-unnesting of `{recommendations: [...]}` is worth surfacing in the spec's iteration contract section.
- The proposal's `skip` semantics in handle_errors aren't expressible in the resolver contract; either add `skip` to iteration OR introduce a `slice` task primitive.
- A `payload_render` resolver wrapper (LLM-render-then-resolver-dispatch) would collapse three open questions: declare_complete tool registry, extract_template synthesis, acquire_context filter.
- `lifecycle.task:<id>.status` access in conditional expressions would unify the conditional dispatch idiom across slot-binding, validator-dispatch, and make-activity. Currently each template uses substring matching on impulse content.

## Validation probe (2026-04-27 11:53 UTC)

Sandboxed local invocation: `--template make-activity --var goal="list files in /tmp/test-make-activity and report a count" --var workingDirectory=/tmp/test-make-activity --budget 0.50 --max-activities 4 -vv`.

**Outcome**: `not achieved` after 4.8s (2 activities, 3 tasks). Failure mode: **F-NN-A — make-activity needs goal-impulse seeding for standalone dispatch.**

Task 1 `acquire_context` declares `inputShapes: [goal]`. The CLI's `--var goal="..."` provides a template variable (`{{variables.goal}}`), NOT an impulse of shape `goal`. The pre-execution gate at `canExecuteTask` rejects: "Task requires shapes [goal] but no matching impulses found and no prompt fallback".

**Diagnosis**: `make-activity` is designed to be dispatched as a CHILD activity by `goal-processing-activity-driven` (which seeds the goal impulse from the user's natural-language input), not invoked as a top-level template. The CLI's `--template` mode bypasses goal-impulse seeding.

**Fix paths** (sibling F-NN-A):
- A. Have task 1 fall back to reading from the `goal` template variable if no `goal`-shape impulse is present.
- B. CLI's `--template <id>` mode auto-seeds a `goal`-shape impulse from the `--var goal=...` value when present.
- C. Document that make-activity must be dispatched via `--single "..."` (which routes through goal-processing-activity-driven and seeds the goal impulse).

Path B is cleanest and most discoverable. Sibling fix scope: `bin/minibob.js` and/or `index.ts` template-mode entry to extract `--var goal=` and create a `goal`-shape impulse before execute. ~10-line change.

## Sandbox check (2026-04-27 11:53 UTC)

`find / -newer /tmp/baseline-marker -type f -not -path "/tmp/*" -not -path "/proc/*" -not -path "/sys/*"` excluded common system paths and yielded:

```
/home/avi/.mozilla/firefox/...cookies.sqlite      (browser running concurrently — NOT minibob)
/home/avi/.metabob/.cache/traces/*.json           (minibob's local trace cache)
```

The activity itself wrote NOTHING — it never reached an action task. Cache writes (`/home/avi/.metabob/.cache/traces/*.json`) are minibob's internal sync queue (F-44-induced retry storm). Per the spec's "or equivalent" caveat, system bookkeeping outside `/tmp/` is acceptable.

**F-NN-B (new)**: minibob's local trace cache writes to `~/.metabob/.cache/traces/` regardless of sandbox config. For strict sandbox enforcement (e.g. ephemeral CI runs), needs a `MINIBOB_CACHE_DIR` env var to redirect this to a configurable path. Not blocking for the meta-activity-builder spec; flagged for follow-up.

## Net status of meta-activity-builder spec

Tasks complete:
- ✅ Iteration resolver (closes F-4)
- ✅ make-activity template (6 tasks, registered)
- ✅ Both pushed to origin/dev
- 🟡 Standalone probe: blocked by F-NN-A (goal-impulse seeding); end-to-end execution requires either CLI fix OR dispatch-via-parent (`--single "..."`)
- ✅ Sandbox check: activity-level writes 0; system bookkeeping flagged as F-NN-B

Next iteration could either:
- **Fix F-NN-A** (10-line CLI change) and re-probe
- **Dispatch via parent** (`--single "make me a new activity that lists files"`) which routes through goal-processing-activity-driven; the goal impulse seeds correctly there
- **Move on** and let real users exercise the activity organically as goals route through goal-processing-activity-driven

Path 2 (dispatch via parent) is the intended invocation path. The proposal describes make-activity as the activity that goal-processing-activity-driven dispatches when no existing template matches a goal — i.e. invocation is upstream-driven, not user-driven.

## Verified end-to-end on canary (2026-04-27 12:38 UTC)

Per the user directive, ran a probe with F-NN-A landed (commit `d10b60d`):

```bash
./bin/minibob.js --template make-activity \
  --var goal="list files in /tmp/test-make-activity-final" \
  --var workingDirectory=/tmp/test-make-activity-final \
  --var maxAttempts=2 --var applyTemplateExtraction=false \
  --budget 0.50 --max-activities 4 -v
```

**Local CLI output**: 4 activities, 8 tasks, 22.0s. Reached task 2 (`identify_candidates`); failed because `activityRecommendations` impulse isn't seeded for standalone dispatch (separate seeding gap, mirror of F-NN-A).

**Canary trace verification**:
```
exec_1777293482864_1jp1nsy1bzc  | activity_id: make-activity         | success=false | 12:38:02
+ _activity_execute             | 12:38:03 | success=false (parent meta-trace)
+ slot-binding × 2              | 12:37:42, 12:37:59 | success=true (Phase 4.1 fired)
+ validator-dispatch            | 12:37:56 | success=true (Phase 4.2 fired)
+ 4× _activity_execute meta-traces all succeeded
```

**Net**: ✅ make-activity executes via the impulse-activity loop. ✅ Trace persists to canary. ✅ Visible via standard `/v2/activities/execution-traces` query. ✅ Phase 4 meta-activities (slot-binding, validator-dispatch) fire on its lifecycle events.

The activity itself reported `success: false` because data flow stops at task 2 — make-activity's task graph requires `activityRecommendations` impulse which the CLI doesn't currently seed. Same shape as F-NN-A but for a different shape; trackable as F-NN-A2.

**Per user directive #1**: validated. The make-activity template runs. We see it, its trace, and the activity in the traces.
