# Impulse-Write Resolver Path

Spec scope: extend concept-db so activities can *create* concept-db records (concepts, edges, usage, sequences, signature upserts) by resolving a write-shaped pointer against `POST /v2/impulses/resolve`, the same way activity-api already exposes its learning-loop writes. Make the resolve contract symmetric for read and write — but only by adding shapes, not by changing the contract surface itself.

This spec also gives concept-db a place to put impulses. Once the vessel exposes write resolvers, the things they emit (audit records, query-result snapshots, metrics) are themselves impulses in the universal-data sense and need somewhere to live. In the shared learning-loop database that place is the `impulse` table activity-api owns, which concept-db reaches under its own tenancy — see "concept-db and the `impulse` table" for why that is a consumer relationship and what happens when a vessel forgets it.

**What ships.** Both halves. activity-api serves twenty `*_write` shapes plus
three destructive shapes (`activityTemplate_update`,
`activityTemplate_deprecate`, `activityExecutionTrace_delete`) at
`POST /v2/impulses/resolve`. concept-db serves seven write shapes, all
advertised in `repos/concept-db/src/config.ts` and dispatched in
`repos/concept-db/src/routes/impulses.ts`:

| Write shape | What it writes |
|---|---|
| `concept_write` | a concept via the from-source path |
| `concept_create_write` | a concept from an explicit request body |
| `conceptLink_write` | an edge, EMA-upserting its weight |
| `conceptSignatureUpsert_write` | a concept keyed on an impulse signature, idempotently |
| `conceptUsage_write` | a usage record against a concept |
| `conceptSequence_write` | a concept sequence |
| `conceptCreditDecontaminate_write` | a credit-repair sweep over concepts whose usage rows carry synthetic or unbound trace ids |

The first six emit a `conceptUpkeepAuditLog` impulse and return its id under
`metadata.auditImpulseId`; `conceptCreditDecontaminate_write` does not — it
returns a `conceptCreditDecontaminationReport` body and defaults to a dry run
unless the pointer sets `dry_run: false`. Audit rows land in the `impulse`
table, which concept-db declares only defensively in
`repos/concept-db/sql/core/003-impulse-table.surql` — activity-api owns it —
while the insert / select / expire / prune helpers live in
`repos/concept-db/src/resolvers/impulse.ts`.

Two shapes named below as design remain design: `concept_update_write` and
`conceptUpkeepTrigger_write` have no dispatch case.

---

## Problem

The foundation doc (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`) treats impulses as universal data and resolvers as the access layer. In practice the contract is asymmetric:

- **Read** is declarative. Activities advertise an impulse with `pointer.type = "<shape>"`, the executor calls the vessel's advertised `resolve_endpoint` (default `/v2/impulses/resolve`) using the advertised `resolve_request_format`, and gets `{content, metadata}` back. See the read cases in `repos/concept-db/src/routes/impulses.ts`. A reader of an activity template can see exactly what data the activity reads.

- **Write**, before this spec, was imperative. Activities called the vessel's MCP tool registry (or a hand-rolled `bash` task with `curl`) to create remote state. The `learn-impulse-relationships` activity is the worked case: it upserted signature concepts and linked edges through MCP tool invocations, and shelled out to `curl` against the upkeep trigger endpoint. A reader of that template had to grep the MCP tool registry to know what state mutations it performed.

The asymmetry has three concrete costs:

1. **Trace integrity.** Every read goes through one code path (`POST /v2/impulses/resolve`), so the per-resolver trace (`execution.impulse_resolutions[]`) gets full coverage. Writes via MCP tool calls or curl shells produce a heterogeneous mix of trace fragments — some captured by the MCP tool resolver, some never captured at all. The learning loop can't reason about write outcomes the same way it reasons about reads.

2. **No advertised contract.** Discovery (`VesselCapability` in `packages/vessel-discovery-client/src/types.ts`) lets a vessel advertise the *shapes* it resolves and how to call its resolve endpoint. There is no parallel for "shapes this vessel will create on your behalf". Activities have to hardcode tool names, REST paths, or MCP tool registries.

3. **Templates couple to endpoint paths.** A template that hardcodes an upkeep-trigger URL breaks when the endpoint is renamed or the responsibility moves to a different vessel.

Activity-api solved this for its own write surface first, exposing its write and destructive shapes through the same `POST /v2/impulses/resolve` router. See `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`. This spec applies the same pattern to concept-db.

A second observation, downstream of the first: **concept-db's resolvers — both the read shapes and the write shapes — produce data that is itself impulse-shaped.** Representations of concepts, query results from `relatedConcepts`, signature upsert decisions, audit trails of destructive operations, co-occurrence metrics: all of these are universal-data outputs with metadata, summary, and resolved content. If they were ephemeral in-memory structures we would lose them every request. concept-db needs the `impulse` table, reached under its own org scoping so tenancy holds regardless of which vessel wrote the row.

---

## Constraints

1. **Don't break the read path.** `POST /v2/impulses/resolve` is the canonical resolve entrypoint and must keep working as-is. New write shapes are additive cases in the dispatch switch.

2. **Mirror the activity-api precedent.** No new endpoint, no new request envelope, no contract-field changes — just more shapes. Anyone who already speaks the resolve contract should be able to do writes by emitting a different `pointer.type`.

3. **Keep MCP tools.** They're the human-driver and IDE-driver path (concept-db is wired into metabob-mcp). Templates and ad-hoc human use both have to keep working. The choice is between *coexistence* and *deprecation*; we pick coexistence — see "Migration path".

4. **Audit destructive operations.** concept-db has destructive surface (`concept_link` overwrites edge weight via EMA, `concept` PATCH, future deletes) that the activity-api precedent calls out for audit. The audit destination is the `impulse` table.

5. **Multi-tenant isolation must hold.** Every write resolver threads `org_id` from JWT auth into the underlying resolver function. concept-db's resolver layer (`repos/concept-db/src/resolvers/concept.ts` and its siblings) already takes `orgId` and `jwtToken`, so this is a passthrough — the dispatch case mirrors the REST handler. Threading `org_id` is what makes the row land under the caller's tenancy; the clauses each table actually enforces differ, and are given under "PERMISSIONS" below rather than restated here.

6. **Vessels own their data.** A vessel writes its impulses into the table it can reach under its own tenancy rules, never into another vessel's tables under another vessel's credentials.

---

## Existing precedent (activity-api `_write` shapes)

What activity-api shipped (and what this spec copies almost verbatim):

### The dispatch shape

In `repos/activity-api/src/routes/impulses.ts` each write case looks like:

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

`delegateWriteToRouter` constructs an internal `Request` against the existing REST sub-router, forwarding the caller's auth headers verbatim. **It reuses the REST handler unchanged** — no logic duplication.

`buildWriteResolverResponse` wraps the delegated response in the impulse-resolve envelope. Successful response:

```jsonc
{
  "success": true,
  "content": "<JSON.stringify(handler-body)>",
  "metadata": { "shape": "<pointer.type>_result", "summary": "..." }
}
```

The `_result` suffix on `metadata.shape` is how a client distinguishes a write-ack from a read payload — load-bearing.

### Auth

`requireAuthenticated(c)` early-rejects anonymous callers with 401 for destructive resolvers. For non-destructive `_write` it relies on the underlying REST handler's auth, which means a vessel can choose per-shape policy by mounting some shapes behind `requireAuthenticated` and others not.

### Audit

Destructive operations in activity-api call `emitUpkeepAudit(...)`, which inserts an `impulse` row with `shape: 'upkeepAuditLog'` and a `pointer` field carrying:

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

Non-blocking — a failed audit does not roll back the operation. The audit returns the new impulse id to be embedded in the response under `auditImpulseId`. The `impulse` table is activity-api's, defined in `repos/activity-api/sql/schemas/020-paradigm-core-tables.surql` and re-declared for root access by `repos/activity-api/sql/migrations/071-fix-paradigm-tables-root-access.surql`. concept-db mirrors the pattern against the same table name — see "concept-db and the `impulse` table" below for why that is a consumer relationship and not a second definition.

### Documentation surface

`docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md` is the user-facing contract: required pointer fields per shape, response envelope, auth notes, when-to-use guidance. concept-db should ship a sibling doc.

### What activity-api did NOT change

- No edits to `packages/vessel-discovery-client/src/types.ts` — `ResolveRequestFormat` is still `"pointer" | "mcp-tool"`, no third value introduced.
- No edits to the `VesselCapability` shape.
- No new endpoint paths.
- No client changes — the existing generic resolver already speaks the impulse-resolve contract; new shapes flow through unchanged.

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

**Why not.** Activity-api already broke the symmetry the *other* way (writes via pointer resolution), so the asymmetry was never design — it was one vessel not having caught up. A template talking to both vessels would otherwise carry both idioms. Picking one idiom is the simplification.

---

## Recommended design

**Mirror the activity-api `_write` pattern in concept-db.** No contract changes. `*_write` cases live in `repos/concept-db/src/routes/impulses.ts`. Each case validates the required payload field, calls the corresponding resolver function (the same one the REST handler in `routes/concepts.ts` calls), and wraps the result in the standard impulse-resolve envelope with `metadata.shape = "<type>_result"`.

Each mutating shape emits a `conceptUpkeepAuditLog`-shaped impulse into the `impulse` table. Non-blocking emit.

Unlike activity-api, concept-db needs no `delegateWriteToRouter`-style internal fetch: its resolver functions are already plain async functions taking `orgId` and `jwtToken`, so the dispatch case calls them directly.

The discovery contract (`packages/vessel-discovery-client/src/types.ts`) does not change. concept-db's `config.discovery.shapes` in `repos/concept-db/src/config.ts` carries the write shapes alongside the read shapes. A client doing a discovery query for shape `concept_create_write` finds concept-db, calls the advertised `resolve_endpoint` with the advertised `resolve_request_format = "pointer"`, and gets a write resolver back. Same plumbing as a read.

### Which concept-db operations are exposed as write shapes

From the surface in `repos/concept-db/src/routes/concepts.ts` and `src/tools/handler.ts`:

| MCP tool / REST path | Write shape | Required pointer fields | Notes |
|---|---|---|---|
| `POST /concepts/from-source` | `concept_write` | `source_type`, `content` (both strings) | Unified from-source path. Optional `summary`, `priority`, `budget`, `scope`, `public`, `project_id`, `metadata`. |
| `POST /concepts` / `concept_create` | `concept_create_write` | `conceptData` | Body matches `CreateConceptRequestSchema`. |
| `POST /concepts/:id/link` / `concept_link` | `conceptLink_write` | `linkData` (must include `from_concept_id`, `to_concept_id`, `edge_type`) | EMA-upsert; high traffic from learning templates. |
| `POST /concepts/upsert-by-signature` / `concept_upsert_by_signature` | `conceptSignatureUpsert_write` | `pointer_type`, `shape` | Idempotent; the biggest call site, one call per signature pair. |
| `POST /concepts/:id/usage` / `concept_record_usage` | `conceptUsage_write` | `usageData` (must include `concept_id`) | Hot path for activity callbacks. |
| `POST /concepts/sequences` / `concept_sequence_record` | `conceptSequence_write` | `sequenceData` | Lower volume; converted for symmetry. |
| (no REST equivalent) | `conceptCreditDecontaminate_write` | none; optional `dry_run`, `min_loads` | Sweeps concepts at or above `min_loads` and rebuilds their credit counts from usage rows, discarding synthetic and unbound trace ids. Dry run unless `dry_run: false`. |
| `POST /concepts/:id/resolve` | — | — | **Skip.** Read-shaped despite being a POST. Already covered by the `concept` read shape. |
| `PATCH /concepts/:id` | — | — | **Design only.** Becomes `concept_update_write` (destructive) when needed; carries an `updates` whitelist. |
| `POST /upkeep/trigger` | — | — | **Design only.** `conceptUpkeepTrigger_write` would take an `upkeepConfig`. Destructive — requires audit plus admin scope. |

### Decision on contract extension

**No change to the contract.** The activity-api precedent demonstrates `resolve_request_format = "pointer"` is sufficient for both reads and writes.

### Authorization

Mirror activity-api:

- Every write case gates on the same check the REST handler applies: `if (config.auth.requireAuth && !jwtAuth) return 401;`. Same condition, same gate, applied before any payload validation.
- `org_id` flows through the same `getJwtAuthFromContext(c)` path the read resolvers use. Multi-tenant isolation is preserved because the resolver functions take `orgId` and use it in their queries.
- Per-shape stronger policy is not needed for the non-destructive shapes. When `concept_update_write` and `conceptUpkeepTrigger_write` land, those add a `requireAuthenticated`-style early reject the same way activity-api's destructive resolvers do.

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

## concept-db and the `impulse` table

The reasoning, restated: concept-db's resolvers (read and write) emit data that is itself impulse-shaped — representations, query results, mappings, metrics, audit records. That data needs a place to live, and the vessel needs a story for how future activities reference it.

**concept-db is a consumer of `impulse`, not its owner.** It runs against the shared learning-loop database, where activity-api owns the table and holds the authoritative SCHEMAFULL definition with tenant-isolation PERMISSIONS. concept-db reads and writes rows through `repos/concept-db/src/resolvers/impulse.ts`; it does not define the table's shape.

This distinction is load-bearing, and it was learned the hard way. An earlier version of concept-db's migration declared `DEFINE TABLE impulse SCHEMAFULL` without `IF NOT EXISTS`. On apply it clobbered activity-api's definition — stripping the tenant-isolation PERMISSIONS and racing activity-api's schema on every concept-db restart. **Never write an unguarded `DEFINE TABLE` for a table another vessel owns in a shared database.**

### Schema

`repos/concept-db/sql/core/003-impulse-table.surql` is written entirely with `IF NOT EXISTS`, so in the shared deployment every statement is a no-op against activity-api's existing definition, and on a standalone concept-db database it creates a minimal permissive SCHEMALESS table the resolvers can still use. The field set it expects, matching the canonical impulse pattern:

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

The shared table's PERMISSIONS are activity-api's, defined alongside the table in `repos/activity-api/sql/schemas/020-paradigm-core-tables.surql`. They are tenant-scoped but not uniform across operations: `select` requires `org_id = $auth.org_id` plus a project-scope check, `create` requires only that the caller has an org at all (`$auth.org_id != NONE`), and `update` and `delete` require `org_id = $auth.org_id` plus either an admin role or ownership of the row. Read that file before writing anything that depends on the exact clause. concept-db's guarded fallback declares its own, simpler clauses — a floor so that a standalone database is not left permissionless, not a copy of activity-api's rules:

```surql
DEFINE TABLE IF NOT EXISTS impulse SCHEMALESS
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create, update WHERE org_id = $auth.org_id
    FOR delete WHERE org_id = $auth.org_id;
```

### Indexes

Declared the same guarded way, so a shared deployment gains no duplicate indexes and no write amplification:

```surql
DEFINE INDEX IF NOT EXISTS idx_impulse_org      ON impulse FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_impulse_shape    ON impulse FIELDS shape;
DEFINE INDEX IF NOT EXISTS idx_impulse_created  ON impulse FIELDS created_at;
DEFINE INDEX IF NOT EXISTS idx_impulse_expires  ON impulse FIELDS expires_at;
DEFINE INDEX IF NOT EXISTS idx_impulse_activity ON impulse FIELDS created_by_activity_id;
```

The `expires_at` index supports the cleanup query (`DELETE FROM impulse WHERE expires_at < time::now()`).

### Audit story

Audit lives in the `impulse` table as a `conceptUpkeepAuditLog`-shaped impulse, emitted by every mutating concept-db write resolver through a local `emitWriteAudit(...)` helper. The row it inserts:

```jsonc
{
  shape: "conceptUpkeepAuditLog",
  pointer: {
    operation: "create",
    target_table: "concept" | "concept_edge" | "concept_usage" | "concept_sequence",
    target_ids: ["<result id, or empty>"],
    request_body: { /* the pointer payload as submitted */ },
    result_id: "<result id or null>",
    performed_by: "<instance id, org id, or 'anonymous'>",
    org_id: "<org>",
    performed_at: "<ISO timestamp>"
  },
  summary: "<resolver id> → <target table> (<result id>)",
  created_by_resolver_id: "<resolver id>"
}
```

Returned in the write's response metadata under `auditImpulseId` (matching the activity-api precedent).

Non-blocking: a failed audit insert is logged and returns `null` for the id, but does not roll back the operation.

### Write resolver output handling (general pattern)

Every write resolver invocation produces three things:

1. **The actual data write** — the row(s) in `concept`, `concept_edge`, `concept_usage`, etc. This is the operation's primary effect.
2. **An audit impulse** in the `impulse` table, carrying the request body and the resulting id.
3. **A return value** — the write resolver's `content` field, JSON-stringified. Typically the created row's id and full record so callers can chain follow-up operations.

concept-db emits the audit for every mutating shape, not only destructive ones. Emitting on creates too is what makes "what did this activity write" answerable from the impulse table alone, without joining against the source tables.

### Should query-result and metric resolvers also produce impulses?

This question is broader than write resolvers — it applies to **read** resolvers that compute something expensive or non-trivial. Examples in concept-db's existing read surface: `relatedConcepts`, `impulseCooccurrenceEdges`, `conceptUsageStats`, `conceptSequence`. When a caller resolves `impulseCooccurrenceEdges` for a given trace, the result is itself an impulse — a snapshot of co-occurrence statistics with shape, summary, and content.

**Tradeoff:**

- **Persist (with TTL):** future activities can reference past query results by impulse id; the ribosome can extract patterns from query-result history; replay/audit possible. Cost: storage for results that may never be referenced.
- **Ephemeral:** every consumer re-runs the query. Simpler, cheaper, but loses the "impulse as universal data" benefit — the result exists only in the request/response cycle.

**Recommended default policy:**

- **Always persist** results from **write resolvers** — the audit impulse, which concept-db emits for every mutating shape.
- **Persist with short TTL** results from **expensive read resolvers** — `relatedConcepts`, `impulseCooccurrenceEdges`, `conceptUsageStats`, `conceptSequence`. Caches subsequent reads and gives the ribosome material to learn from.
- **Ephemeral** for **simple lookup reads** — `concept` (single-row fetch). Cheap to recompute; persisting them is noise.

The read-result caching half is design, not behaviour: nothing sets `expires_at` on a read result. When it lands, the "expensive vs simple" classification belongs in per-shape resolver metadata rather than hardcoded into the dispatcher, so the policy stays explicit and per-shape.

The `impulse` table is required regardless, since audit depends on it. The caching policy is described here so the table's design accommodates both audit (persistent, no expiry) and cached results (ephemeral, with expiry).

### Lifecycle hooks on the impulse table

`LifecycleEvent` in `repos/concept-db/src/lifecycle/dispatcher.ts` carries `concept:created`, `concept:resolved`, `concept:updated`, `concept:deleted`, `edge:created`, `edge:updated`, `edge:deleted`, plus three impulse events so the in-vessel hook system is symmetric across all the vessel's tables:

- `impulse:created` — fired after a successful insert into `impulse` (whether from an audit emission, a cached-result persistence, or a direct write).
- `impulse:resolved` — fired when an impulse row's `content` is loaded (for impulses with non-null content this is just a SELECT; for pointer-only impulses, this is the moment a resolver materializes it).
- `impulse:expired` — fired by the cleanup path when an impulse is deleted because its `expires_at` has passed.

`LifecyclePayload` carries an `impulse?: unknown` slot alongside its `concept` and `edge` slots, so handlers subscribe via `lifecycleDispatcher.on('impulse:created', ...)` exactly as they do for concept events.

This keeps the hook system aligned with the storage layer: a subscriber that learns from `concept:created` — a ribosome extracting patterns from concept creation, say — extends naturally to learning from `impulse:created`.

### Migration / bootstrap

`repos/concept-db/sql/core/003-impulse-table.surql` follows the existing `001-concept-tables.surql` / `002-add-impulse-signature-source-type.surql` numbering and is applied by `bun run apply-schema`, concept-db's standard migration entrypoint. Its contents are the guarded table, field, index and PERMISSIONS statements above.

Purely additive: every statement is `IF NOT EXISTS`, so applying it against the shared database changes nothing that already exists.

The expiry sweep is available as `pruneExpiredImpulses` in `repos/concept-db/src/resolvers/impulse.ts`. Scheduling it belongs in the upkeep scheduler; until then it is invoked explicitly.

---

## Implementation outline (per repo)

Implementation order, not versioning:

### concept-db

Where each piece lives:

1. **`repos/concept-db/sql/core/003-impulse-table.surql`** — the guarded `impulse` table, fields, indexes and PERMISSIONS. Applied by `bun run apply-schema`.

2. **`repos/concept-db/src/routes/impulses.ts`** — one `case` block per write shape in the dispatch switch, after the read cases and before the `default`. Each block gates on auth, validates the required pointer field, calls the resolver function, emits the write audit, and returns the envelope:

   ```ts
   case 'concept_create_write': {
     if (config.auth.requireAuth && !jwtAuth) {
       return c.json({ success: false, error: 'Authentication required' }, 401);
     }
     const writePointer = pointer as { conceptData?: unknown };
     if (!writePointer.conceptData) {
       return c.json({ success: false, error: 'conceptData required for concept_create_write' }, 400);
     }
     try {
       const request = CreateConceptRequestSchema.parse(writePointer.conceptData);
       const concept = await createConcept(request, orgId, jwtToken);
       const auditImpulseId = await emitWriteAudit({ /* … */ });
       return c.json({
         success: true,
         content: JSON.stringify(concept),
         metadata: {
           shape: 'concept_create_write_result',
           summary: `Concept ${concept.id} created`,
           auditImpulseId,
         },
       });
     } catch (err) {
       return c.json({ success: false, error: (err as Error).message }, 400);
     }
   }
   ```

   The same file's `SUPPORTED_SHAPES` const is the advisory list echoed back in the 400 response for an unrecognized shape — it is not read by the dispatcher and does not necessarily enumerate it. The `emitWriteAudit` helper at the top of the file is what writes the audit row.

3. **`repos/concept-db/src/config.ts`** — `discovery.shapes` lists the write shapes so the vessel advertises them on registration. The intended invariant is that this list and the dispatch switch agree — never advertise a shape with no case — and `conceptUpkeepAuditLog` is deliberately absent because it is emitted as a side effect and not resolvable by pointer. A shape-dispatch agreement check enforces that invariant bidirectionally — `packages/shape-dispatch-check` compares the advertised list against the dispatch switch and is run per-vessel from each vessel's lint step and fleet-wide by `scripts/check-shape-dispatch-all.sh`; a case may be excluded deliberately with the `@shape-dispatch:private` marker. `SUPPORTED_SHAPES` is outside that check's scope and has drifted from the switch in practice, so treat the switch as the ground truth for what resolves.

4. **`repos/concept-db/src/lifecycle/dispatcher.ts`** — `LifecycleEvent` carries `impulse:created`, `impulse:resolved` and `impulse:expired`.

5. **`repos/concept-db/src/resolvers/impulse.ts`** — the table helpers: `createImpulse`, `writeImpulseToTable`, `getImpulseById`, `expireImpulse`, `pruneExpiredImpulses`. Each emits the corresponding lifecycle event.

6. **Scheduling the expiry sweep** — outstanding. `pruneExpiredImpulses` exists but nothing in `repos/concept-db/src/upkeep/` calls it on a cadence.

7. **Tests** — `repos/concept-db/tests/write-shapes.test.ts` covers the write dispatch surface. The cases worth holding it to:
   - Each write shape: missing payload → 400.
   - Each write shape: well-formed payload → 200 with `metadata.shape` ending in `_result`.
   - `org_id` from JWT propagates to the resolver call.
   - `requireAuth = true` + no JWT → 401 for each shape.
   - `concept_create_write` followed by a `concept` read returns the created concept.
   - `conceptLink_write` against nonexistent concepts → 404.
   - `conceptSignatureUpsert_write`: idempotent — second call returns `created: false`, same id.
   - `impulse` table: insert, org-filtered select, TTL cleanup, lifecycle event emission.

8. **Docs** — outstanding. A `docs/impulse-types/CONCEPT_DB_WRITE_RESOLVERS.md` mirroring `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md` does not exist: contract, write-shapes table, auth context, examples, when-to-use-vs-MCP-tool, plus the `impulse` table's purpose and audit story. The shapes also want listing in `docs/shapes/README.md`.

### The execution host

**No changes required.** The generic vessel resolver already speaks the impulse-resolve contract, so `_write` shapes flow through unchanged.

An optional ergonomics improvement, not required: a helper that constructs a `_write` pointer given a shape name and payload, with type narrowing per shape.

### `@avigopal/vessel-discovery-client`

**No contract change.** `VesselCapability.shapes: string[]` is shape-name-agnostic — concept-db just adds more strings.

If clients ever need to filter discovery results to "vessels that can write shape X", that is a future query parameter on the discovery endpoint, not a contract change here.

### activity-api

**N/A** — the precedent already exists. Confirm `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md` is still accurate when the concept-db doc gets written; if any drift is found, fix it then.

---

## Test plan

End-to-end: drive the `learn-impulse-relationships` activity through write resolvers instead of MCP tool calls, and assert the same outcome — signatures upserted as concepts, edges created and refined with EMA weight.

Concretely:

1. **Unit (concept-db)** — see the test cases listed above under "Implementation outline → concept-db → Tests".

2. **Integration (concept-db, in-process)** — drive `POST /v2/impulses/resolve` end-to-end against a real SurrealDB instance, asserting:
   - A `concept_create_write` resolution actually inserts a row in `concept` with the expected `org_id`.
   - A subsequent `concept` read resolution returns the row.
   - A `conceptLink_write` between two created concepts inserts a `concept_edge` row.
   - `conceptSignatureUpsert_write` called twice with the same `(pointer_type, shape)` returns the same id with `created: true` then `created: false`.

3. **`impulse` table integration** — insert an impulse with `expires_at = time::now() + 1s`, wait, run the cleanup task, assert the row is gone and `impulse:expired` was dispatched. Insert with `expires_at = NULL`, run cleanup, assert the row remains.

4. **Discovery roundtrip** — register a concept-db instance whose `config.discovery.shapes` carries the write shapes, query discovery for shape `concept_create_write`, get back concept-db's capability record, call its advertised `resolve_endpoint` with `resolve_request_format = "pointer"` carrying a `concept_create_write` pointer.

5. **Template-driven** — fork the `learn-impulse-relationships` activity so its upsert-and-link step uses `conceptSignatureUpsert_write` + `conceptLink_write` resolver impulses instead of MCP tool calls. Run both the original and the fork against the same trace input and assert the resulting `concept_edge` rows are identical.

6. **Trace cross-check** — run an activity that uses a write resolver and inspect its execution trace's `impulse_resolutions[]`. Every write call should appear with the right `resolver_id` and `vessel_id` populated.

---

## Open questions

1. **Should `conceptUpkeepTrigger_write` exist at all, or should that logic move into a vessel-internal scheduler?** A template that triggers upkeep imperatively from a `bash` resolver gets no trace; wrapping the trigger in a write shape preserves the imperative call and makes it traceable. The alternative is that concept-db's upkeep scheduler runs on its own and templates *never* trigger it, reading the upkeep state instead. The latter is more aligned with "vessels own their upkeep" but changes the calling template's execution shape. Flagged for the destructive-shapes work.

2. **MCP tools and write resolvers coexist long-term — for how long?** The recommendation is *coexistence*. Tools serve human/IDE callers (metabob-mcp); write resolvers serve activity templates. Both call the same underlying resolver function, so behavioural drift is bounded. If telemetry eventually shows tools are only ever called by activities (never by humans/IDEs), revisit and deprecate tools at that point. Don't pre-deprecate.

3. **`concept_write` and `concept_create_write` overlap — is carrying both right?** `concept_write` is the from-source path: it takes a `source_type` string that auto-derives shape, budget and priority, which is convenient for seeding but bakes a magic dictionary into the activity layer. `concept_create_write` takes explicit fields. Both ship; the open question is whether the source-type defaults table should be documented once and callers pushed toward explicit fields.

4. **Discovery contract: should `VesselCapability` separate read and write shapes?** No, but if discovery query traffic for write shapes ever becomes high enough to matter, an additive `write_shapes?: string[]` field on `VesselCapability` (with `shapes` continuing to mean "all shapes") is a backward-compatible extension. Document the option; don't ship it.

5. **Default TTL for cached result-impulses.** An hour is the suggested starting point, tunable per shape. Whether it is right needs operational data — revisit when storage growth or cache-hit rate says otherwise. Nothing sets a TTL until read-result caching is built, so this is not yet a live question.

6. **Should the `impulse` table on concept-db ever cross-reference rows in activity-api's `impulse` table?** Tempting (e.g. linking a `conceptUpkeepAuditLog` impulse to the activity execution that triggered it), but cross-vessel record references are brittle. Better: store `created_by_activity_id` as a free-form string and let consumers query activity-api by that id when they need the linked execution. No cross-vessel foreign keys.
