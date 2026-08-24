# B1 + B3 real fixes — diagnosed, patched, ready to apply (2026-08-24)

Both fixes are fully specified below. Neither could be *landed* this session:
- Direct edit needs `SUBSTRATE_ALLOW_DIRECT_EDIT=1`; flipping it is **classifier-blocked**.
- The sanctioned dispatch path (`mcp__metabob__run_goal_async`) is **unavailable**
  (metabob MCP not registered — needs the reconnect flagged 2026-08-23).

The **record has been corrected**: memory note
`reference-b1-and-b3-were-falsified-by-live-measurement-2026-08-24`, MEMORY.md,
and two reopened gaps (`b1-selection-outcome-join-inert-live-2026-08-24`,
`b3-validator-discovery-not-durable-2026-08-24`).

---

## B1 — selection→outcome attribution is INERT (law 12)

**Live evidence:** 0 organic executions carry `correlation_id`; the only 15 are
operator-injected probes; `decision_outcome` has 1 synthetic row. The LIVE
execution table is `execution` (paradigm.ts:444), not the frozen
`activity_execution_traces`. The ingest lift + consumer are deployed and the
`correlation_id` column persists on `execution` when present — the break is that
the **producer never stamps `correlation:<id>` on real executions**, because the
adapter drops the id.

### Patch B1a — `repos/ias-executor-ts/src/adapters/activity-api-adapter.ts`

1. Add the field to `RecommendCandidate` (~line 68):
```ts
export interface RecommendCandidate {
  template_id: string;
  score?: number;
  selection_metadata?: Record<string, unknown>;
  /** correlation id minted by /recommend for THIS candidate (law-12 join key). */
  correlation_id?: string;
}
```

2. Read it in the response type (~line 158) — add `correlation_id?: string;` to the
   `recommendations?: Array<{ ... }>` element.

3. Map it when building candidates (~line 176):
```ts
recommendations.push({
  template_id: id,
  score,
  selection_metadata: meta,
  ...(typeof r.correlation_id === "string" && r.correlation_id.length > 0
    ? { correlation_id: r.correlation_id }
    : {}),
});
```

### Patch B1b — `repos/ias-executor-ts/src/hosts/goal-host.ts` (~line 827, 873)

When a template is selected from the internal recommend candidates, capture the
picked candidate's correlation id and stamp it onto the execution tags:

```ts
      templateId = top.template_id;
      selectedFromRecommendations = true;
```
becomes — carry the pick's correlation id in scope:
```ts
      templateId = top.template_id;
      selectedFromRecommendations = true;
```
and, in the `executor.execute(template, { ... })` call (~873), merge the tag.
Compute the picked candidate (handles the 404-fallthrough that reassigns
`templateId`) just before the execute call:
```ts
    const pickedCorr = candidates?.find((c) => c.template_id === templateId)?.correlation_id;
    const correlationTags = pickedCorr ? [`correlation:${pickedCorr}`] : [];
```
then in the execute options:
```ts
      ...(( (opts.tags?.length) || correlationTags.length )
        ? { tags: [...(opts.tags ?? []), ...correlationTags] }
        : {}),
```
(replacing the existing `...(opts.tags?.length ? { tags: opts.tags } : {})`).

This closes the internal-recommend Thompson-draw path for **every** `host.runGoal`
caller — not just goal-host-vessel's narrow shape-directed branch. The existing
ingest lift (`deriveCorrelationIdFromTags`) + consumer (`recordDecisionOutcome`
in posterior-update.ts, which reads the `correlation:` tag off `trace.tags`) then
complete the chain: recommend writes the selection log with the same id → the
execution carries the tag → the tag lifts to `execution.correlation_id` → the
consumer joins it to `thompson_selection_log` → a `decision_outcome` row lands.

**Verification (at the consuming layer):** after deploy, dispatch a real goal
that takes the recommend path (no `targetTemplateId`); then
`SELECT count() FROM execution WHERE correlation_id != NONE AND created_at > <deploy>`
should be > 0 with organic (non-`operator:*`) tags, and `SELECT count() FROM
decision_outcome` should increase with `executed_at != NONE` rows.

---

## B3 — validator discovery is not durable

**Live evidence:** `discover-by-shapes` (backward, `validation_result`) → `total:0`
after the restart. The validator was volume-only; the boot seeder reconciles to
`SHARED_TEMPLATES`, which never included it.

### Patch B3 — add the validator to `SHARED_TEMPLATES`

1. Create `repos/ias-executor-ts/src/templates/lifecycle/validate-task-output.json`
   with the template body already prepared at
   `/home/avi/.claude/jobs/44a75483/tmp/general-output-validator.json`
   (`id: reliability:validate-task-output-v1`, top-level
   `output_shapes: ["validation_result"]`, broad content `input_shapes`, one LLM
   task emitting `{passed, reason}`, `variables: []`).

2. In `repos/ias-executor-ts/src/templates/index.ts`:
   - add the import next to the other lifecycle imports (~line 40):
     `import validateTaskOutput from "./lifecycle/validate-task-output.json" with { type: "json" };`
   - add `validateTaskOutput,` to the `SHARED_TEMPLATES` array (~line 101).

**Verification:** after a clean restart (seeder re-runs), `POST
/v2/activities/discover-by-shapes {direction:backward, output_shapes:[validation_result],
required_shapes:[bash_output]}` returns `total >= 1`.

---

## Note on scope

The dominant real executions (validator-dispatch, auto-bridge-*, audit-*,
boredom/gap-driven) are dispatched with a fixed `targetTemplateId` and are often
NOT fresh Thompson draws — so many legitimately have no decision to attribute.
B1a+B1b attribute the executions that DO come from a Thompson draw. If we later
want attribution for pathway-reuse picks too, that is a separate, smaller change
in goal-host-vessel's reuse branch.
