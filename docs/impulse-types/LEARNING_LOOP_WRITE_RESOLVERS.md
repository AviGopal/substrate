# Learning-Loop Write Resolvers

**Applies to:** `activity-api` v1.5.0+ (last reviewed 2026-06-24; contract unchanged)
**Case handlers:** `repos/activity-api/src/routes/impulses.ts`

> **Note (2026-06-24):** the repo was renamed `metabob-activity-api` → `activity-api`
> in the `@metabob` → `@avigopal` namespace migration. The `*_write` resolver contract
> below is current and unchanged since v1.5.0.

The activity-api exposes its learning-loop writes (execution traces, feedback, composition edges, relevance, tool usage, variants, …) as impulse shapes that activities can invoke through `POST /v2/impulses/resolve`. The goal is locality: an activity that needs to record a trace or a feedback signal does not need to know which REST endpoint owns that write — it just resolves the right shape.

Each `*_write` case in the router delegates to the same underlying handler used by the REST endpoint, reusing all validation and SQL in place. The response envelope is the standard impulse-resolve shape, with `metadata.shape` suffixed `_result` so clients can distinguish a write ack from a read payload.

## Why resolvers, not direct REST calls

- **One code path, one trace.** An activity invokes `POST /v2/impulses/resolve` for every data access — read or write. That keeps the per-resolver trace (`impulse_resolutions`) honest and lets the learning loop reason about write calls the same way it reasons about reads.
- **No hardcoded endpoints in activity templates.** Templates emit a pointer shape; the router maps the shape to a REST handler. Endpoint renames do not break templates.
- **Uniform auth.** JWT / API key handling and RBAC (SurrealDB `PERMISSIONS`) happen in the router. `*_write` resolvers inherit the same checks as `*_update` / `*_delete` / `*_deprecate`.

## Contract

Request:

```jsonc
{
  "pointer": {
    "type": "<shapeName>_write",
    "<payloadField>": { /* the write payload (see table) */ }
  }
}
```

Response (2xx):

```jsonc
{
  "success": true,
  "content": "{ ...delegated handler JSON... }",
  "metadata": {
    "shape": "<shapeName>_write_result",
    "summary": "..."
  }
}
```

Response (4xx/5xx):

```jsonc
{
  "success": false,
  "error": "..."
}
```

Missing required payload field returns 400 with `"<payloadField> required for <shape>"`. On delegation failure, the upstream status is propagated and the upstream error message surfaces in `error`.

## Write shapes

| Shape | Required pointer field | Delegates to |
|---|---|---|
| `activityExecutionTrace_write` | `traceData` | `POST /v2/activities/execution-traces` |
| `activityFeedback_write` | `feedbackData` | `POST /v2/activities/feedback` |
| `activityComposition_write` | `compositionData` | `POST /v2/activities/composition` |
| `activityTemplate_write` | `templateData` | `POST /v2/activities/templates` |
| `activityVariant_write` | `activityId`, `variantData` | `POST /v2/activities/:activityId/variants` |
| `impulseRelevance_write` | `relevanceData` | `POST /v2/activities/impulse-relevance` |
| `toolUsage_write` | `usageData` | `POST /v2/activities/tool-usage` |
| `toolArgumentPattern_write` | `patternData` | `POST /v2/activities/tool-argument-patterns` |
| `executionSequences_write` | `sequenceData` | `POST /v2/activities/execution-sequences` |
| `shapeScore_write` | `scoreData` | `POST /v2/activities/shape-scores` |
| `similarState_write` | `stateData` | `POST /v2/activities/similar-state` |
| `goalSeeking_write` | `goalData` | `POST /v2/activities/create-goal-seeking` |
| `execution_write` | `executionData` | `POST /v2/activities/executions` |
| `compositionEdge_write` | `edgeData` | `POST /v2/activities/composition/edges` |

The payload format for each `*Data` field mirrors the corresponding REST endpoint's request body. Auth headers (`Authorization: Bearer` for JWT, `X-Internal-Api-Key`, `X-Session-ID`) are forwarded verbatim to the delegated handler.

## Destructive shapes

Destructive operations additionally require authentication (401 when unauthenticated) and emit an `upkeepAuditLog` impulse on success. RBAC is enforced at the SurrealDB `PERMISSIONS` layer (`$auth.role = 'admin'` on UPDATE/DELETE).

| Shape | Required pointer fields | Effect |
|---|---|---|
| `activityTemplate_update` | `templateId`, `updates` (whitelisted keys) | `UPDATE activity MERGE $updates` with before/after diff on audit log |
| `activityTemplate_deprecate` | `templateId`, `reason` | Sets `deprecated = true`; audit log captures reason |
| `activityExecutionTrace_delete` | `olderThan` or explicit id filter | Hard delete with audit log |

Allowed update fields for `activityTemplate_update`: `name`, `description`, `tags`, `tasks`, `input_shapes`, `output_shapes`, `deprecated`. Any other key in `updates` returns 400 with the rejected list.

For the full lifecycle story (why deprecate instead of delete, how `deprecated = true` is interpreted by the recommend path), see [`../guides/ACTIVITY_LIFECYCLE_DEPRECATION.md`](../guides/ACTIVITY_LIFECYCLE_DEPRECATION.md). For the end-to-end observe → audit → correct pipeline these writes slot into — including the `templateAuditReport` read companion and minibob's `impulse-resolve` dispatch primitive — see [`../guides/TEMPLATE_UPKEEP.md`](../guides/TEMPLATE_UPKEEP.md).

## Auth context for writes

The router takes two auth paths depending on the caller:

- **JWT auth** (dashboard users, SurrealDB `ACCESS` method): PERMISSIONS fire normally — the admin check on destructive resolvers is enforced at the DB layer.
- **API-key auth** (MiniBob, IDE integrations): the self-signed JWT is not validatable against any SurrealDB ACCESS method, so `executeAsAuth` falls back to root credentials with manual `org_id = $orgId` filtering. This is safe because the key itself is scoped at the identity layer, but it means the caller is responsible for ensuring API keys carry the right authority. Destructive resolvers additionally short-circuit unauthenticated callers with 401 before the SQL runs.

The pattern is documented inline in `requireAuthenticated` and `executeAsAuth` helpers in `routes/impulses.ts`.

## Example — record an execution trace

```bash
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "activityExecutionTrace_write",
      "traceData": {
        "execution_id": "exec_abc123",
        "activity_template_id": "debug-null-pointer-v3",
        "variant_id": "debug-null-pointer-v3",
        "success": true,
        "duration_ms": 4210,
        "cost_usd": 0.018,
        "tasks": [ ... ],
        "parent_execution_id": "exec_root_42",
        "composition_chain": ["exec_root_42", "exec_abc123"]
      }
    }
  }'
```

Response (200):

```json
{
  "success": true,
  "content": "{\"execution_id\":\"exec_abc123\",\"stored\":true,...}",
  "metadata": {
    "shape": "activityExecutionTrace_write_result",
    "summary": "execution trace stored"
  }
}
```

## When to use a write resolver vs the REST endpoint

Prefer the write resolver for anything driven by an activity template — the resolver keeps the trace/cost attribution consistent with the rest of the execution. Reach for the REST endpoint when you are writing glue code in a controller that already owns its own observability (e.g. the deployment workflow script), or when you need a payload shape not yet exposed as an impulse.

## Related

- [`ACTIVITY_LIFECYCLE_DEPRECATION.md`](../guides/ACTIVITY_LIFECYCLE_DEPRECATION.md) — update/deprecate flow for templates
- [`../architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — why the backend stays a trace store and resolvers live where data lives
- [`../shapes/README.md`](../shapes/README.md) — full shape index
