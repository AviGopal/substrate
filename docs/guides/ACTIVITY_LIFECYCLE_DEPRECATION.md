# Activity Template Lifecycle and Deprecation

**Applies to:** `metabob-activity-api` v1.5.5+ (April 2026)
**Related migration:** `sql/migrations/082-add-deprecated-field-to-activity.surql`

Activity templates accumulate. Some underperform. Some are superseded by variants. Some were experimental and never promoted. This guide covers the resolver-based lifecycle for updating and deprecating templates without going around the API.

## Why resolvers, not REST

Both operations are exposed as impulse resolvers — `activityTemplate_update` and `activityTemplate_deprecate` — rather than dedicated REST endpoints. That's intentional: destructive and mutating operations flow through `POST /v2/impulses/resolve` so they inherit the same auth check, audit emission (`upkeepAuditLog` impulse), and trace path as every other resolver. A "deprecate template" call is just another line in the execution log.

RBAC is enforced at the SurrealDB `PERMISSIONS` layer — `$token.role = 'admin'` (or `$auth.role` under dashboard-JWT access) on UPDATE. Non-admin callers get a permissions error from the DB, not a missing-endpoint 404. See [`../RBAC_GUIDE.md`](../RBAC_GUIDE.md) §`$auth` vs `$token` for why API-key auth uses `$token`.

## `activityTemplate_update`

Mutates whitelisted fields on an existing activity. Allowed fields: `name`, `description`, `tags`, `tasks`, `input_shapes`, `output_shapes`, `deprecated`. Any other key in `updates` causes a 400 with the rejected list.

```bash
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "activityTemplate_update",
      "templateId": "debug-null-pointer-v3",
      "updates": {
        "description": "Fixed ordering bug in task 2",
        "tags": ["debug", "null-safety", "v3"]
      }
    }
  }'
```

Response:

```json
{
  "success": true,
  "content": "{\"template\": { ... AFTER row ... }, \"auditImpulseId\": \"upkeep_audit:abc123\"}",
  "metadata": { "shape": "activityTemplate_update_result", "summary": "Updated 2 field(s) on debug-null-pointer-v3" }
}
```

The `before`/`after` diff is persisted to `upkeep_audit_log` so the change is traceable independent of app logs.

## `activityTemplate_deprecate`

Soft-deletes a template by setting `deprecated = true` and bumping `updated_at`. Templates remain queryable (for historical trace correlation) but are marked for exclusion.

```bash
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "activityTemplate_deprecate",
      "templateId": "fix-oauth-bug-v2",
      "reason": "superseded by fix-oauth-bug-v4; v2 had 38% success rate across 200 trials"
    }
  }'
```

The `reason` string is stored on the audit log entry. Keep it informative — it's what a future investigator (human or LLM) reads when they find a deprecated template referenced in an old trace.

## The `deprecated` field

Added by migration 082 (2026-04-22):

```surql
DEFINE FIELD IF NOT EXISTS deprecated ON activity TYPE option<bool>
  VALUE $value OR false
  COMMENT "Soft-delete flag. True = excluded from recommendations.";

DEFINE INDEX IF NOT EXISTS idx_activity_deprecated ON activity FIELDS deprecated;
```

`option<bool>` so existing rows without the field stay valid. The index exists so filter queries stay cheap.

### Current behavior in `/v2/activities/recommend`

As of v1.5.5, the Thompson Sampling recommendation path (`getActivitiesWithTieredFallback` in `src/routes/activities.ts`) does not yet carry an explicit `WHERE deprecated != true` filter. The field is authoritative on writes (deprecation is recorded, audited, and queryable), but callers that want hard exclusion today should either:

1. Filter client-side after receiving recommendations (`rec.deprecated === true`), or
2. Provide an `exclude_activities` list in the recommend request for targeted exclusion.

Server-side filter enforcement is a follow-up — track via migration 083 or the follow-on PR that wires the filter into the tiered fallback query. Until then, deprecation is a signal, not a guarantee.

## Use cases

**A/B test cleanup.** Variant created via the ribosome underperformed: `success_rate = 0.38` over 200 trials. Deprecate with a reason referencing the winning variant. The trace history stays intact for future pattern extraction.

**Security or correctness recall.** A template embeds a prompt that leaked a credential shape. Deprecate immediately, then update via `activityTemplate_update` if you want to push a corrected description. The audit impulse becomes the paper trail.

**Graceful schema migration.** A template's `output_shapes` no longer matches downstream consumers. Use `activityTemplate_update` to change the shapes in place; the `before`/`after` diff is on the audit log, and the activity keeps its learned Thompson statistics.

## Why not just delete?

- Traces reference templates by `activity_template_id`. Deleting would orphan history and break joins on `activity_execution_traces`.
- Learning needs counterfactuals: knowing a template was tried and deprecated is itself signal when selecting between variants.
- Audit requirements: destructive operations must leave a record. A tombstoned row with `deprecated = true` and a reason is more recoverable than a `DELETE`.

Hard deletion, when truly needed, goes through `activityExecutionTrace_delete` and equivalent destructive resolvers — each emits its own audit impulse.

## Related

- [`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) — the full `*_write` / `*_update` / `*_delete` resolver contract, including auth paths and upkeepAuditLog emission
- `IMPULSE_ACTIVITY_FOUNDATION.md` — why the backend is a trace store, not a universal resolver
- `VARIANT_CREATION_DESIGN.md` — how variants are spawned (the other end of the lifecycle)
- `sql/migrations/081-composition-chain-on-traces.surql` — sibling migration from the same batch
