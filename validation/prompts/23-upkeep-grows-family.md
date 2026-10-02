# Prompt 23: Upkeep grows the family — audit, improve, and register a new variant

This prompt proves that the upkeep pipeline (audit → diagnose → improve) produces a structurally better variant, and that the variant family state after the upkeep attempt is documented against real backend data.

**What to verify:**
- `load_impulse({"type": "variantMetricsSummary"})` identifies a low-performing template via live Thompson state
- `load_impulse({"type": "activityTemplate", "templateId": "<id>"})` fetches its full structure
- `load_impulse({"type": "activityExecutionTrace", "executionId": "<id>"})` retrieves a real failure trace
- An improved variant is produced at `/workspace/improved-variant.json` with structural improvements
- `[Impulse] Resolved via vessel discovery` appears for all three activity-api shapes
- The write attempt via `activityTemplate_update` is made and its result documented (success or auth limitation)

---

You are running a targeted upkeep cycle. Your goal is to find the weakest template in the registry, diagnose its failure pattern from a real trace, produce a better variant, and document the full before/after state of the family.

## Step 1 — Find the weakest template

Use `load_impulse` with pointer `{"type": "variantMetricsSummary"}` to retrieve Thompson Sampling state for all tracked families.

From the results, find the template that has:
- `sample_count >= 5` (enough executions to be meaningful)
- The lowest success rate, computed as `alpha / (alpha + beta)`

If no template has `sample_count >= 5`, relax to `sample_count >= 2`. If still none, pick the template with the highest `beta` relative to `alpha`.

Record: the selected template's `id`, `alpha`, `beta`, `sample_count`, and `success_rate`.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 2 — Fetch the template structure

Use `load_impulse` with pointer:

```json
{
  "type": "activityTemplate",
  "templateId": "<the-id-from-step-1>"
}
```

Record the full template: its `name`, `description`, `tags`, `input_shapes`, `output_shapes`, and `tasks` array (resolver, config, prompt for each task).

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 3 — Fetch a failed execution trace

Use `load_impulse` with pointer `{"type": "executionTraceList", "limit": 20, "success_only": false}` to get recent traces including failures.

Find a trace where `activity_id` matches the template from Step 1 and `status` is `failed` or `error`. If no failure exists for that specific template, pick the most recent failure from any template — the diagnosis practice still applies.

Then fetch the full trace detail with:

```json
{
  "type": "activityExecutionTrace",
  "executionId": "<failed-execution-id>"
}
```

From the trace extract:
- Which task failed (by `task_id` or position)
- The `failure_mode.type` if present (e.g., `verifier_negative`, `budget_exhausted`, `cascading`)
- The `failure_mode.reason` text
- Which resolver was involved (`resolver_id`, `resolver_tier`)

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 4 — Produce an improved variant

Based on the original template (Step 2) and the failure diagnosis (Step 3), write an improved version of the activity template to `/workspace/improved-variant.json`.

The improved variant MUST:
- Have a new `id` that is derived from the original (append `-v2` or `-improved` to the original id)
- Preserve the original `name` with a suffix like ` (improved)` or ` v2`
- Add or improve `output_shapes` if they were missing or incomplete
- Address the specific failure pattern observed: if the failure was a resolver mismatch, change the resolver; if it was missing validation, add a validation block; if tasks were vague, add precise `config` fields
- Have at least one structural difference from the original (not a cosmetic rename)

The JSON must follow the activity template schema:

```json
{
  "id": "<derived-id>",
  "name": "<improved-name>",
  "description": "<updated-description>",
  "tags": ["<relevant-tags>"],
  "input_shapes": ["<shapes>"],
  "output_shapes": ["<shapes>"],
  "tasks": [
    {
      "id": "<task-id>",
      "description": "<description>",
      "resolver": "<resolver-name>",
      "config": {}
    }
  ]
}
```

## Step 5 — Attempt to register the improved variant

Use `load_impulse` with pointer:

```json
{
  "type": "activityTemplate_update",
  "template": <the-full-improved-variant-object>
}
```

This requires admin scope. Record the result:
- If it succeeds: record the returned ID and confirmation
- If it returns 403 (insufficient scope): note this as an expected auth limitation — the improved variant file still documents a real upkeep result

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 6 — Fetch the family state after the upkeep attempt

Use `load_impulse` with pointer `{"type": "variantMetricsSummary"}` again. Find the original template family and record all variants now present (including any newly registered one).

## Step 7 — Write /workspace/upkeep-report.md

Write a markdown file at `/workspace/upkeep-report.md` containing:

### Section 1: Template Audited
- Template ID, alpha, beta, sample_count, success_rate
- Why it was selected (lowest success rate or highest beta)

### Section 2: Failure Diagnosis
- Execution ID of the failed trace used
- Failing task id and description
- `failure_mode.type` and `failure_mode.reason` (or "not recorded" if absent from the trace)
- Resolver that was involved

### Section 3: Improvements Made
A bullet list of structural changes between the original and improved variant:
- Changed resolver from X to Y
- Added `output_shapes`: [...]
- Added validation block to task Z
- Tightened task description from "..." to "..."
- (at least one real structural change)

### Section 4: Registration Result
- Whether `activityTemplate_update` succeeded or returned a scope error
- If success: the registered variant ID
- If 403: note that admin scope is required (`activityTemplate_update` / `_deprecate` require admin scope per CLAUDE.md)

### Section 5: Family State After Upkeep
A table of all variants in the family: `variant_id | alpha | beta | sample_count | expected_value`

### Section 6: Data Source
Confirm which shapes were fetched via `load_impulse` and that no bash/curl was used.

## Acceptance criteria

1. `/workspace/improved-variant.json` is valid JSON with a real template ID as the base (no placeholder `<id>` strings)
2. `/workspace/upkeep-report.md` documents a real failure trace with a real execution ID and real failure details
3. `[Impulse] Resolved via vessel discovery` appears in stderr for `variantMetricsSummary`, `activityTemplate`, and `activityExecutionTrace`
4. The improved variant has at least one structural difference from the original (changed resolver, added output_shapes, added validation, or rephrased task with tighter config)
