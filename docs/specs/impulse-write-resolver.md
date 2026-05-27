# Impulse-Write Resolver Path

Spec scope: extend concept-db so activities can *create* concept-db records (concepts, edges, usage, sequences, signature upserts) by resolving a write-shaped pointer against `POST /v2/impulses/resolve`, the same way activity-api already exposes its learning-loop writes. Make the resolve contract symmetric for read and write — but only by adding shapes, not by changing the contract surface itself.

This spec also introduces an `impulse` table to concept-db. Once the vessel exposes write resolvers, the things they emit (audit records, query-result snapshots, metrics) are themselves impulses in the universal-data sense and need a place to live that is *not* activity-api's tables. The vessel that owns the data owns its impulses.

Status: **Partially superseded (re-assessed 2026-05-27).** The activity-api half of this spec is fully shipped — 14 `*_write` shapes live at `POST /v2/impulses/resolve`, documented in CLAUDE.md. The concept-db half (five write shapes: `concept_create_write`, `conceptLink_write`, `conceptSignatureUpsert_write`, `conceptUsage_write`, `conceptSequence_write`) and the concept-db `impulse` table are NOT yet shipped. This spec is the design reference for that remaining work.

---

## Problem

The foundation doc (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`) treats impulses as universal data and resolvers as the access layer. In practice the contract is asymmetric:

- **Read** is declarative. Activities advertise an impulse with `pointer.type = "<shape>"`, the executor calls the vessel's advertised `resolve_endpoint` (default `/v2/impulses/resolve`) using the advertised `resolve_request_format`, and gets `{content, metadata}` back. See `repos/concept-db/src/routes/impulses.ts:62-316`. A reader of an activity template can see exactly what data the activity reads.

- **Write** is imperative. Activities have to call the vessel's MCP tool registry (or a hand-rolled `bash` task with `curl`) to create remote state. Concrete example: `templates/concept-learning/learn-impulse-relationships.json:88-120` and lines 121-162 — task 3 calls `concept_upsert_by_signature` and `concept_link` via MCP tool invocation; task 5 (`prune-weak-edges`) shells out to `curl … /upkeep/trigger`. The reader of the template has to grep the MCP tool registry to know what state mutations the activity performs.

The asymmetry has three concrete costs:

1. **Trace integrity.** Every read goes through one code path (`POST /v2/impulses/resolve`), so the per-resolver trace (`execution.impulse_resolutions[]`) gets full coverage. Writes via MCP tool calls or curl shells produce a heterogeneous mix of trace fragments — some captured by the MCP tool resolver, some never captured at all. The learning loop can't reason about write outcomes the same way it reasons about reads.

2. **No advertised contract.** Discovery (`packages/vessel-discovery-client/src/types.ts:188-213`, `VesselCapability`) lets a vessel advertise the *shapes* it resolves and how to call its resolve endpoint. There is no parallel for "shapes this vessel will create on your behalf". Activities have to hardcode tool names, REST paths, or MCP tool registries.

3. **Templates couple to endpoint paths.** `learn-impulse-relationships.json:170-174` hardcodes `{{conceptDbUrl}}/upkeep/trigger`. Renaming the endpoint or moving the responsibility to a different vessel breaks every template that referenced it.

Activity-api already solved this for its own write surface by exposing 14 write shapes plus 3 destructive shapes through the same `POST /v2/impulses/resolve` router. See `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`. This spec applies the same pattern to concept-db.

A second observation, downstream of the first: **concept-db's resolvers — both the existing read shapes and the new write shapes — produce data that is itself impulse-shaped.** Representations of concepts, query results from `relatedConcepts`, signature upsert decisions, audit trails of destructive operations, co-occurrence metrics: all of these are universal-data outputs with metadata, summary, and resolved content. If they were ephemeral in-memory structures we would lose them every request. If they lived in activity-api's tables we would violate "vessels own their data". Concept-db needs its own `impulse` table.

---

## Constraints

1. **Don't break the read path.** `POST /v2/impulses/resolve` is the canonical resolve entrypoint and must keep working as-is. New write shapes are additive cases in the dispatch switch.

2. **Mirror the activity-api precedent.** No new endpoint, no new request envelope, no contract-field changes — just more shapes. Anyone who already speaks the resolve contract should be able to do writes by emitting a different `pointer.type`.

3. **Keep MCP tools.** They're the human-driver and IDE-driver path (concept-db is wired into metabob-mcp). Templates and ad-hoc human use both have to keep working. The choice is between *coexistence* and *deprecation*; we pick coexistence — see "Migration path".

4. **Audit destructive operations.** concept-db has destructive surface (`concept_link` overwrites edge weight via EMA, `concept` PATCH, future deletes) that the activity-api precedent calls out for audit. The audit destination is concept-db's own `impulse` table (introduced here).

5. **Multi-tenant isolation must hold.** Every write resolver must thread `org_id` from JWT auth into the underlying resolver function. concept-db's resolver layer (`repos/concept-db/src/resolvers/concept.ts:67`, etc.) already takes `orgId` and `jwtToken`, so this is a passthrough — the dispatch case mirrors the REST handler. The new `impulse` table inherits the same `WHERE org_id = $auth.org_id` PERMISSIONS pattern as `concept`.

6. **Vessels own their data.** Concept-db must not write impulses into activity-api's tables, and vice versa. The `impulse` table being added here is concept-db's, not a copy of activity-api's.

---

## Existing precedent (activity-api `_write` shapes)

What activity-api shipped (and what this spec copies almost verbatim):

### The dispatch shape

In `repos/metabob-activity-api/src/routes/impulses.ts:1740-1864` each write case looks like:

```ts
case 'activityExecutionTrace_write': {
  const writePointer = pointer as typeof pointer & { traceData?: unknown };
  if (!writePointer.traceData) {
    return c.json({ success: false, error: 'traceData required for activityExecutionTrace_write' }, 400);
  }
  const delegated = await delegateWriteToRouter(c, executionTracesRouter, '/', writePointer.traceData);
  return c.json(buildWriteResolverResponse('activityExecutionTrace_write', delegated, 'execution trace stored'), …);
}
```

`delegateWriteToRouter` (`impulses.ts:49-74`) constructs an internal `Request` against the existing REST sub-router, forwarding `Authorization: Bearer …`, `X-Internal-Api-Key`, and `X-Session-ID` headers verbatim. **It reuses the REST handler unchanged** — no logic duplication.

`buildWriteResolverResponse` (`impulses.ts:162-181`) wraps the delegated response in the impulse-resolve envelope. Successful response:

```jsonc
{
  "success": true,
  "content": "<JSON.stringify(handler-body)>",
  "metadata": { "shape": "<pointer.type>_result", "summary": "..." }
}
```

The `_result` suffix on `metadata.shape` is how a client distinguishes a write-ack from a read payload — load-bearing.

### Auth

`requireAuthenticated(c)` (`impulses.ts:85-91`) early-rejects anonymous callers with 401 for destructive resolvers. For non-destructive `_write` it relies on the underlying REST handler's auth, which means a vessel can choose per-shape policy by mounting some shapes behind `requireAuthenticated` and others not.

### Audit

Destructive operations in activity-api call `emitUpkeepAudit(...)` (`impulses.ts:118-155`), which inserts an `impulse` row into activity-api's `impulse` table with `shape: 'upkeepAuditLog'` and a `pointer` field carrying:

```ts
{
  operation: 'delete' | 'update' | 'deprecate',
  target_table: string,
  target_ids: string[],
  filter_used: Record<string, unknown>,
  dry_run: boolean,
  count: number,
  performed_by: string,
  org_id: string,
  reason?: string,
  diff?: Record<string, unknown>,
  performed_at: ISO timestamp,
}
```

Non-blocking — a failed audit does not roll back the operation. The audit returns the new impulse id to be embedded in the response under `auditImpulseId`. Activity-api's `impulse` table (defined in `repos/metabob-activity-api/sql/migrations/071-fix-paradigm-tables-root-access.surql:13`) is the destination. Concept-db will mirror this pattern with its own `impulse` table, not write into activity-api's.

### Documentation surface

`docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md` is the user-facing contract: required pointer fields per shape, response envelope, auth notes, when-to-use guidance. concept-db should ship a sibling doc.

### What activity-api did NOT change

- No edits to `packages/vessel-discovery-client/src/types.ts` — `resolve_request_format` stayed at `"pointer" | "mcp-tool"`, no third value introduced.
- No edits to the `VesselCapability` shape.
- No new endpoint paths.
- No client (minibob) changes — the existing generic resolver already speaks the impulse-resolve contract; new shapes flow through unchanged.

The pattern is purely additive at the vessel level.

---

## Design alternatives

### Alt A: Add `"write"` as a third `resolve_request_format`

Adding `ResolveRequestFormat = "pointer" | "mcp-tool" | "write"` and parallel arrays in `VesselCapability` (e.g. `read_shapes`, `write_shapes`).

**Why not.** `resolve_request_format` describes the **wire format** of the request body. Read-vs-write is **semantics of a particular shape**, not a wire-format axis. The activity-api precedent demonstrates that the existing `"pointer"` format already handles writes fine — `{pointer: {type: "foo_write", barData: {...}}}` is a valid pointer envelope. Splitting on read/write at the contract level would require parallel splits everywhere downstream for zero practical benefit.

### Alt B: Naming convention `_write` suffix on shape names, no contract change

Adopt the activity-api convention: a shape ending in `_write` is a write-shape; pointer carries its payload under a per-shape `*Data` field; response carries `metadata.shape = "<shape>_result"`. Discovery treats write-shapes identically to read-shapes — they're listed in the vessel's `shapes` array and the dispatcher routes by name.

**Why yes.** This is what activity-api shipped and what this spec recommends. The contract is a single-axis "advertise a shape and dispatch on it"; "write" is a *kind of shape*, not a *kind of contract*. Composability with existing resolvers (`pointer.type` is still the single discriminator) and zero churn in `vessel-discovery-client`.

### Alt C: Response signals write-vs-read instead of name

Same wire format on the way in (`{pointer: {...}}`), but instead of a name suffix, the resolver returns `metadata.kind = "write" | "read"`.

**Why not.** This loses the *static* signal — a template author can't tell from grepping for `_write` what an activity mutates. Discovery query results can't be filtered to "write capabilities" without round-tripping each shape. The `_write` suffix is documentation as well as dispatch.

### Alt D: Writes stay in MCP tools; this spec is N/A

Concede that read = pointer, write = MCP tool, and document the asymmetry as design.

**Why not.** Activity-api already broke the symmetry the *other* way (writes via pointer resolution), so the asymmetry is no longer "design" — it's "concept-db hasn't caught up". Templates that talk to both vessels currently use both idioms. Picking one idiom is the simplification.

---

## Recommended design

**Mirror the activity-api `_write` pattern in concept-db.** No contract changes. Add `*_write` cases to `repos/concept-db/src/routes/impulses.ts`. Each case validates the required payload field, calls the corresponding resolver function (the same one the REST handler in `routes/concepts.ts` calls), and wraps the result in the standard impulse-resolve envelope with `metadata.shape = "<type>_result"`.

For destructive shapes, emit a `conceptUpkeepAuditLog`-shaped impulse into concept-db's new `impulse` table. Non-blocking emit.

Discovery contract (`packages/vessel-discovery-client/src/types.ts`) does not change. concept-db's `config.discovery.shapes` (`repos/concept-db/src/config.ts:181-189`) gains the new write shapes alongside the existing read shapes. A client doing a discovery query for shape `concept_create_write` finds concept-db, calls the advertised `resolve_endpoint` with the advertised `resolve_request_format = "pointer"`, gets a write resolver back. Same plumbing as today's reads.

### Which concept-db operations to expose as write shapes

From the existing surface (`repos/concept-db/src/routes/concepts.ts` and `tools/handler.ts`):

| MCP tool / REST path | Proposed write shape | Required pointer field | Notes |
|---|---|---|---|
| `POST /concepts` (`concepts.ts:40-59`) / `concept_create` (`handler.ts:47-51`) | `concept_create_write` | `conceptData` | Body matches `CreateConceptRequestSchema`. Convert. |
| `POST /concepts/:id/link` (`concepts.ts:317-341`) / `concept_link` (`handler.ts:59-63`) | `conceptLink_write` | `linkData` (must include `from_concept_id`, `to_concept_id`, `edge_type`) | EMA-upsert; high traffic from learning templates. Convert. |
| `POST /concepts/upsert-by-signature` (`concepts.ts:131-170`) / `concept_upsert_by_signature` (`handler.ts:65-79`) | `conceptSignatureUpsert_write` | `pointer_type`, `shape` | Idempotent; called per-pair in `learn-impulse-relationships.json:95`. Convert — single biggest call site. |
| `POST /concepts/:id/usage` (`concepts.ts:347-371`) / `concept_record_usage` (`handler.ts:105-109`) | `conceptUsage_write` | `usageData` (must include `concept_id`) | Hot path for activity callbacks. Convert. |
| `POST /concepts/sequences` (`concepts.ts:454-473`) / `concept_sequence_record` (`handler.ts:111-115`) | `conceptSequence_write` | `sequenceData` | Lower volume; still worth converting for symmetry. Convert. |
| `POST /concepts/from-source` (`concepts.ts:65-83`) | — | — | **Skip.** Convenience wrapper. Activities should pick semantics and use `concept_create_write` directly. |
| `PATCH /concepts/:id` (`concepts.ts:233-252`) | — | **Out of scope for this design.** Becomes `concept_update_write` (destructive) when needed; carries an `updates` whitelist. |
| `POST /concepts/:id/resolve` (`concepts.ts:203-227`) | — | **Skip.** Read-shaped despite being a POST. Already covered by the `concept` read shape. |
| `POST /upkeep/trigger` | `conceptUpkeepTrigger_write` (out of scope) | `upkeepConfig` | Currently called via curl from `learn-impulse-relationships.json:170-174`. Destructive — requires audit + admin scope. Left for a follow-up if/when needed. |

**Five write shapes in this design**: `concept_create_write`, `conceptLink_write`, `conceptSignatureUpsert_write`, `conceptUsage_write`, `conceptSequence_write`.

### Decision on contract extension

**No change to the contract.** The activity-api precedent demonstrates `resolve_request_format = "pointer"` is sufficient for both reads and writes.

### Authorization

Mirror activity-api:

- The five write shapes inherit the underlying REST handler's auth check: `if (config.auth.requireAuth && !jwtAuth) return 401;` (pattern at `concepts.ts:42-44`). Same code, same gate.
- `org_id` flows through the same `getJwtAuthFromContext(c)` path the read resolvers already use. Multi-tenant isolation is preserved because the resolver functions take `orgId` and use it in their queries.
- Per-shape stronger policy is **not** needed for the five non-destructive shapes here. When `concept_update_write` and `conceptUpkeepTrigger_write` land later, those add `requireAuthenticated(c)` early-reject the same way activity-api's destructive resolvers do.

The `auth_scheme` discovery field stays a single value advertised at the vessel level; finer-grained per-shape policy lives inside the dispatcher.

### Response shape

For each write shape:

**Success (2xx):**
```jsonc
{
  "success": true,
  "content": "<JSON.stringify(resolver-result)>",
  "metadata": {
    "shape": "<pointer.type>_result",
    "summary": "human-readable one-liner"
  }
}
```

The `content` field is a JSON-stringified blob carrying whatever the underlying resolver returns — full `Concept` row for `concept_create_write`, `{id, created}` for `conceptSignatureUpsert_write`, `Edge` row for `conceptLink_write`, etc. Match what the existing REST handlers return.

**Failure (4xx/5xx):**
```jsonc
{
  "success": false,
  "error": "<message>"
}
```

Status codes:

- 400 — missing required pointer field; payload Zod parse failure.
- 401 — `requireAuth` is set and no JWT was forwarded.
- 404 — referenced concept/edge does not exist.
- 500 — resolver error.

---

## concept-db gets an `impulse` table

A first-class deliverable, not a follow-up. The reasoning, restated: concept-db's resolvers (read and write) emit data that is itself impulse-shaped — representations, query results, mappings, metrics, audit records. This data can either live in concept-db's own `impulse` table or it can leak into activity-api's tables. The latter violates "vessels own their data". The former gives concept-db a place to persist these outputs and a story for how future activities reference them.

### Schema

Add `impulse` to concept-db, mirroring the canonical fields used elsewhere in the system. Field set:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Auto-generated. |
| `pointer` | `object` | Free-form; shape-specific payload. |
| `shape` | `string` | The shape this impulse advertises (e.g. `conceptUpkeepAuditLog`, `relatedConceptsResult`). |
| `summary` | `option<string>` | Human-readable one-liner; what reasoners see before content load. |
| `content` | `option<string>` | JSON-stringified payload, or null for pointer-only impulses. |
| `metadata` | `option<object>` | Free-form; resolver tier, latency, cost, etc. |
| `org_id` | `string` | Tenancy field; mandatory. |
| `project_id` | `option<string>` | Project scope. |
| `created_at` | `datetime` | `DEFAULT time::now()`. |
| `created_by_activity_id` | `option<string>` | The activity execution that produced this impulse, if any. Useful for ribosome / replay. |
| `created_by_resolver_id` | `option<string>` | The resolver that produced this impulse (e.g. `concept_create_write`, `relatedConcepts`). |
| `expires_at` | `option<datetime>` | TTL marker for ephemeral impulses (cached query results). NULL = persistent. |

This is intended for **both persistent records** (audit logs, signature upsert decisions — set `expires_at = NULL`) **and ephemeral records** (cached query results from expensive read resolvers — set `expires_at = time::now() + duration`). A periodic cleanup task in the upkeep scheduler removes rows where `expires_at < time::now()`.

### PERMISSIONS

Mirror the existing concept-table pattern (`repos/concept-db/sql/core/001-concept-tables.surql:10-14`):

```surql
DEFINE TABLE impulse SCHEMAFULL
  PERMISSIONS
    FOR select WHERE (scope = 'global' AND public = true) OR org_id = $auth.org_id
    FOR create, update WHERE org_id = $auth.org_id
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';
```

Same multi-tenant story as `concept`. Root access through the same migration pattern activity-api uses for paradigm tables.

### Indexes

```surql
DEFINE INDEX idx_impulse_org    ON impulse FIELDS org_id;
DEFINE INDEX idx_impulse_shape  ON impulse FIELDS shape;
DEFINE INDEX idx_impulse_created ON impulse FIELDS created_at;
DEFINE INDEX idx_impulse_expires ON impulse FIELDS expires_at;
DEFINE INDEX idx_impulse_activity ON impulse FIELDS created_by_activity_id;
```

The `expires_at` index supports the cleanup query (`DELETE FROM impulse WHERE expires_at < time::now()`).

### Audit story (replaces "deferred")

Audit is no longer deferred — it lives in concept-db's `impulse` table as a `conceptUpkeepAuditLog`-shaped impulse. When a destructive write resolver lands (e.g. `concept_update_write`, `concept_delete_write`, `conceptUpkeepTrigger_write`), it calls a local `emitConceptUpkeepAudit(...)` helper that inserts an impulse row:

```jsonc
{
  shape: "conceptUpkeepAuditLog",
  pointer: {
    operation: "update" | "delete" | "prune" | "deprecate",
    target_table: "concept" | "concept_edge" | "concept_usage" | "concept_sequence",
    target_ids: ["..."],
    filter_used: { /* ... */ },
    dry_run: false,
    count: 7,
    performed_by: "<key_id or user_id>",
    org_id: "<org>",
    reason: "<optional human reason>",
    diff: { /* update: { field: { before, after } } */ },
    performed_at: "2026-04-23T..."
  },
  summary: "deleted 7 concept_edge rows by prune-weak-edges",
  org_id: "<org>",
  created_by_activity_id: "<execution-id-if-known>",
  created_by_resolver_id: "concept_delete_write",
  expires_at: null
}
```

Returned to the destructive write's response under `auditImpulseId` (matching the activity-api precedent).

Non-blocking: a failed audit insert is logged but does not roll back the operation.

### Write resolver output handling (general pattern)

Every write resolver invocation produces three things:

1. **The actual data write** — the row(s) in `concept`, `concept_edge`, `concept_usage`, etc. This is the operation's primary effect.
2. **An optional audit impulse** in the `impulse` table — required for destructive operations, omitted for plain creates/upserts of non-destructive types (the source tables themselves are append-only enough to serve as audit).
3. **A return value** — the write resolver's `content` field, JSON-stringified. Typically the created row's id and full record so callers can chain follow-up operations.

For the five write shapes here (all non-destructive), only (1) and (3) apply. The audit impulse is reserved for destructive shapes (out of scope for this design but specified above so the seam is unambiguous).

### Should query-result and metric resolvers also produce impulses?

This question is broader than write resolvers — it applies to **read** resolvers that compute something expensive or non-trivial. Examples in concept-db's existing read surface: `relatedConcepts`, `impulseCooccurrenceEdges`, `conceptUsageStats`, `conceptSequence`. When a caller resolves `impulseCooccurrenceEdges` for a given trace, the result is itself an impulse — a snapshot of co-occurrence statistics with shape, summary, and content.

**Tradeoff:**

- **Persist (with TTL):** future activities can reference past query results by impulse id; the ribosome can extract patterns from query-result history; replay/audit possible. Cost: storage for results that may never be referenced.
- **Ephemeral:** every consumer re-runs the query. Simpler, cheaper, but loses the "impulse as universal data" benefit — the result exists only in the request/response cycle.

**Recommended default policy:**

- **Always persist** results from **write resolvers** (the audit impulse for destructive writes; nothing required for non-destructive writes since the source row is the record).
- **Persist with short TTL** (`expires_at = time::now() + 1h` by default) results from **expensive read resolvers** — currently `relatedConcepts`, `impulseCooccurrenceEdges`, `conceptUsageStats`, `conceptSequence`. Caches subsequent reads and gives the ribosome material to learn from. Operators can tune TTL per shape.
- **Ephemeral** for **simple lookup reads** — `concept` (single-row fetch), `conceptStats` (single-row aggregate). Cheap to recompute; persisting them is noise.

The "expensive vs simple" classification lives in the resolver registration metadata (a new optional `persist_result_ttl_seconds?: number` field on the per-shape config) so the policy is explicit and per-shape, not hardcoded into the dispatcher. Default unset = ephemeral.

This policy is not load-bearing for the write-shapes work — the `impulse` table is required regardless. It's introduced here so the table's design accommodates both audit (persistent, no expiry) and cached results (ephemeral, with expiry) from day one.

### Lifecycle hooks on the impulse table

Concept-db has an existing `lifecycleDispatcher` (`repos/concept-db/src/lifecycle/dispatcher.ts`) emitting `concept:created`, `concept:resolved`, `concept:updated`, `concept:deleted`, `edge:*`. Add three new event names so the in-vessel hook system is symmetric across all the vessel's tables:

- `impulse:created` — fired after a successful insert into `impulse` (whether from an audit emission, a cached-result persistence, or a direct write).
- `impulse:resolved` — fired when an impulse row's `content` is loaded (in the case of impulses with non-null content this is just an SELECT; for pointer-only impulses, this is the moment a resolver materializes it).
- `impulse:expired` — fired by the cleanup task when an impulse is deleted because its `expires_at` has passed.

The payload mirrors the existing `LifecyclePayload` shape with an additional `impulse?: unknown` slot. Handlers can subscribe via `lifecycleDispatcher.on('impulse:created', ...)` exactly as today.

This keeps the hook system aligned with the new storage layer: any subscriber that today learns from `concept:created` (e.g. a future ribosome that extracts patterns from concept creation) will naturally extend to learning from `impulse:created`.

### Migration / bootstrap

A SurrealDB migration file is needed:

- **Path:** `repos/concept-db/sql/core/003-impulse-table.surql` (following the existing `001-concept-tables.surql`, `002-add-impulse-signature-source-type.surql` numbering).
- **Contents:** the table definition, field definitions, indexes, and PERMISSIONS clauses spelled out above.
- **Applied via:** the existing `bun run apply-schema` script (concept-db's standard migration entrypoint).

No changes to existing tables — this is purely additive.

A second follow-up migration in `repos/concept-db/sql/core/` may eventually be needed to add the cleanup task to the upkeep scheduler config, but for the initial cut a manual cleanup query is acceptable.

---

## Implementation outline (per repo)

Implementation order, not versioning:

### concept-db

Files to touch:

1. **`repos/concept-db/sql/core/003-impulse-table.surql`** — new file. Defines the `impulse` table per the schema above. Apply via `bun run apply-schema`.

2. **`repos/concept-db/src/routes/impulses.ts`** — add five `case` blocks to the dispatch switch (after the existing read cases at line 308, before the `default`). Each case mirrors the activity-api template:

   ```ts
   case 'concept_create_write': {
     const writePointer = pointer as { conceptData?: unknown };
     if (!writePointer.conceptData) {
       return c.json({ success: false, error: 'conceptData required for concept_create_write' }, 400);
     }
     try {
       const request = CreateConceptRequestSchema.parse(writePointer.conceptData);
       const concept = await createConcept(request, orgId, jwtToken);
       return c.json({
         success: true,
         content: JSON.stringify(concept),
         metadata: { shape: 'concept_create_write_result', summary: `Concept ${concept.id} created` },
       });
     } catch (err) {
       const e = err as Error;
       return c.json({ success: false, error: e.message }, 400);
     }
   }
   ```

   No `delegateWriteToRouter`-style internal-fetch needed: concept-db's resolver functions are already plain async functions taking `orgId` and `jwtToken`. Calling them directly is simpler than fetch'ing the REST router internally.

3. **`repos/concept-db/src/routes/impulses.ts`** — add the new shape names to the `SUPPORTED_SHAPES` const at line 35-43.

4. **`repos/concept-db/src/config.ts`** — add the five write shape names to `discovery.shapes` at line 181-189 so the vessel advertises them on registration.

5. **`repos/concept-db/src/lifecycle/dispatcher.ts`** — extend `LifecycleEvent` with `impulse:created`, `impulse:resolved`, `impulse:expired`. No handler additions required at this stage; the events are the seam.

6. **`repos/concept-db/src/resolvers/impulse.ts`** — new file. Helpers for inserting into the new `impulse` table: `createImpulseRecord(...)`, `resolveImpulseRecord(...)`, `expireImpulseRecord(...)`. Each emits the corresponding `lifecycleDispatcher` event.

7. **`repos/concept-db/src/upkeep/`** — add a cleanup activity that periodically deletes rows from `impulse` where `expires_at < time::now()`. Fires `impulse:expired` per row (or per batch — implementation choice). Wire into the existing upkeep scheduler.

8. **Tests.** Add `repos/concept-db/src/routes/impulses-write.test.ts` covering:
   - Each write shape: missing payload → 400.
   - Each write shape: well-formed payload → 200 with `metadata.shape` ending in `_result`.
   - `org_id` from JWT propagates to the resolver call.
   - `requireAuth = true` + no JWT → 401 for each shape.
   - `concept_create_write` followed by `concept` read returns the created concept.
   - `conceptLink_write` against nonexistent concepts → 404.
   - `conceptSignatureUpsert_write`: idempotent — second call returns `created: false`, same id.
   - **New `impulse` table tests:** insert, select by org filtered, TTL cleanup, lifecycle event emission.

9. **Docs.** Add `docs/impulse-types/CONCEPT_DB_WRITE_RESOLVERS.md` mirroring `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`. Same sections: contract, write shapes table, auth context, examples, when-to-use-vs-MCP-tool. Include a section on the new `impulse` table — its purpose, the audit story, the cached-results-with-TTL story.

10. **Shape index.** Add the new shapes to `docs/shapes/README.md`.

### minibob

**No changes required.** The generic vessel resolver (`repos/minibob/src/vessel-direct-resolver.ts`) already speaks the impulse-resolve contract. New `_write` shapes flow through unchanged.

Optional ergonomics improvements (not required):

- Helper in `repos/minibob/src/impulse.ts` that constructs a `_write` pointer given a shape name and payload, with type narrowing per shape.
- Update `learn-impulse-relationships.json` to use `concept_upsert_by_signature_write` and `conceptLink_write` resolution instead of MCP tool calls in task 3. This is a template change. Defer to a separate "modernize templates" pass.

### @metabob/vessel-discovery-client

**No contract change.** The existing `VesselCapability.shapes: string[]` advertisement is shape-name-agnostic — concept-db just adds five more strings.

If we ever want clients to filter discovery results to "vessels that can write shape X", that's a future-extension query parameter on the discovery endpoint, not a contract change here. Out of scope for this design.

### activity-api

**N/A** — the precedent already exists. Confirm the precedent docs (`docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`) are still accurate when the concept-db doc gets written; if any drift is found, fix it then.

---

## Test plan

End-to-end: after concept-db ships the five write shapes and the `impulse` table, drive the existing template `templates/concept-learning/learn-impulse-relationships.json` (task 3) using write resolvers instead of MCP tool calls. Same outcome: signatures upserted as concepts, edges created/refined with EMA weight.

Concretely:

1. **Unit (concept-db)** — see the test cases listed above under "Implementation outline → concept-db → Tests".

2. **Integration (concept-db, in-process)** — drive `POST /v2/impulses/resolve` end-to-end against a real SurrealDB instance, asserting:
   - A `concept_create_write` resolution actually inserts a row in `concept` with the expected `org_id`.
   - A subsequent `concept` read resolution returns the row.
   - A `conceptLink_write` between two created concepts inserts a `concept_edge` row.
   - `conceptSignatureUpsert_write` called twice with the same `(pointer_type, shape)` returns the same id with `created: true` then `created: false`.

3. **`impulse` table integration** — insert an impulse with `expires_at = time::now() + 1s`, wait, run the cleanup task, assert the row is gone and `impulse:expired` was dispatched. Insert with `expires_at = NULL`, run cleanup, assert the row remains.

4. **Discovery roundtrip** — register a concept-db instance with the new shapes in its `config.discovery.shapes`, query discovery for shape `concept_create_write`, get back concept-db's capability record, call its advertised `resolve_endpoint` with `resolve_request_format = "pointer"` carrying a `concept_create_write` pointer.

5. **Template-driven (deferred to a follow-up template-modernization PR)** — fork `learn-impulse-relationships.json` whose task 3 uses `conceptSignatureUpsert_write` + `conceptLink_write` resolver impulses instead of MCP tool calls. Run both the original and the fork against the same trace input and assert the resulting `concept_edge` rows are identical.

6. **Trace cross-check** — run an activity that uses a write resolver and inspect its execution trace's `impulse_resolutions[]`. Every write call should appear with the right `resolver_id` and `vessel_id` populated.

---

## Open questions

1. **Should `conceptUpkeepTrigger_write` exist at all, or should that logic move into a vessel-internal scheduler?** Templates currently trigger upkeep imperatively from a `bash` resolver. Wrapping it in a write shape preserves that imperative trigger but makes it traceable. Alternative: concept-db's upkeep scheduler runs autonomously and templates *never* trigger it, reading the upkeep state instead. The latter is more aligned with "vessels own their upkeep" but breaks the template's current execution shape. Out of scope for this spec; flagged for the destructive-shapes follow-up.

2. **MCP tools and write resolvers coexist long-term — for how long?** The recommendation is *coexistence*. Tools serve human/IDE callers (metabob-mcp); write resolvers serve activity templates. Both call the same underlying resolver function, so behavioural drift is bounded. If telemetry eventually shows tools are only ever called by activities (never by humans/IDEs), revisit and deprecate tools at that point. Don't pre-deprecate.

3. **`concept_create_write` payload includes `source_type` — should there be a parallel `concept_create_from_source_write` for the convenience wrapper?** Probably not. `from-source` is sugar that activities should bypass — letting templates pass arbitrary `source_type` strings (which auto-derive shape/budget/priority) bakes a magic dictionary into the activity layer. If a template needs the convenience, document the source-type → defaults table once and have the template emit explicit fields.

4. **Discovery contract: should `VesselCapability` separate read and write shapes?** No, but if discovery query traffic for write shapes ever becomes high enough to matter, an additive `write_shapes?: string[]` field on `VesselCapability` (with `shapes` continuing to mean "all shapes") is a backward-compatible extension. Document the option; don't ship it.

5. **Default TTL for cached result-impulses.** Recommended default is 1h, configurable per-shape via `persist_result_ttl_seconds`. Whether 1h is the right default needs operational data — probably fine to start, revisit when storage growth or cache-hit-rate metrics suggest otherwise.

6. **Should the `impulse` table on concept-db ever cross-reference rows in activity-api's `impulse` table?** Tempting (e.g. linking a `conceptUpkeepAuditLog` impulse to the activity execution that triggered it), but cross-vessel record references are brittle. Better: store `created_by_activity_id` as a free-form string and let consumers query activity-api by that id when they need the linked execution. No cross-vessel foreign keys.
