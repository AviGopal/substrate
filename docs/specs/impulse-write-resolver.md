# Impulse-Write Resolver Path

Spec scope: extend concept-db so activities can *create* concept-db records (concepts, edges, usage, sequences, signature upserts) by resolving a write-shaped pointer against `POST /v2/impulses/resolve`, the same way activity-api already exposes its learning-loop writes. Make the resolve contract symmetric for read and write — but only by adding shapes, not by changing the contract surface itself.

Status: design only. No code changes here.

---

## Problem

The foundation doc (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`) treats impulses as universal data and resolvers as the access layer. In practice the contract is asymmetric:

- **Read** is declarative. Activities advertise an impulse with `pointer.type = "<shape>"`, the executor calls the vessel's advertised `resolve_endpoint` (default `/v2/impulses/resolve`) using the advertised `resolve_request_format`, and gets `{content, metadata}` back. See `repos/concept-db/src/routes/impulses.ts:62-316`. A reader of an activity template can see exactly what data the activity reads.

- **Write** is imperative. Activities have to call the vessel's MCP tool registry (or a hand-rolled `bash` task with `curl`) to create remote state. Concrete example: `templates/concept-learning/learn-impulse-relationships.json:88-120` and lines 121-162 — task 3 calls `concept_upsert_by_signature` and `concept_link` via MCP tool invocation; task 5 (`prune-weak-edges`) shells out to `curl … /upkeep/trigger`. The reader of the template has to grep the MCP tool registry to know what state mutations the activity performs.

The asymmetry has three concrete costs:

1. **Trace integrity.** Every read goes through one code path (`POST /v2/impulses/resolve`), so the per-resolver trace (`execution.impulse_resolutions[]`, see super-repo `CLAUDE.md` "Resolver Tiers") gets full coverage. Writes via MCP tool calls or curl shells produce a heterogeneous mix of trace fragments — some captured by the MCP tool resolver, some never captured at all. The learning loop can't reason about write outcomes the same way it reasons about reads.

2. **No advertised contract.** Discovery (`packages/vessel-discovery-client/src/types.ts:188-213`, `VesselCapability`) lets a vessel advertise the *shapes* it resolves and how to call its resolve endpoint. There is no parallel for "shapes this vessel will create on your behalf". Activities have to hardcode tool names, REST paths, or MCP tool registries.

3. **Templates couple to endpoint paths.** `learn-impulse-relationships.json:170-174` hardcodes `{{conceptDbUrl}}/upkeep/trigger`. Renaming the endpoint or moving the responsibility to a different vessel breaks every template that referenced it.

Activity-api already solved this for its own write surface in v1.5.0 (April 2026) by exposing 14 write shapes plus 3 destructive shapes through the same `POST /v2/impulses/resolve` router. See `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`. This spec applies the same pattern to concept-db.

---

## Constraints

1. **Don't break the read path.** `POST /v2/impulses/resolve` is the canonical resolve entrypoint and must keep working as-is. New write shapes are additive cases in the dispatch switch.

2. **Mirror the activity-api precedent.** No new endpoint, no new request envelope, no contract-field changes — just more shapes. Anyone who already speaks the resolve contract should be able to do writes by emitting a different `pointer.type`.

3. **Keep MCP tools.** They're the human-driver and IDE-driver path (concept-db is wired into metabob-mcp). Templates and ad-hoc human use both have to keep working. The choice is between *coexistence* and *deprecation*; we pick coexistence — see "Migration path".

4. **Audit destructive operations.** concept-db has destructive surface (`concept_link` overwrites edge weight via EMA, `concept` PATCH, future deletes) that the activity-api precedent calls out for audit. concept-db today has no audit table — this spec adds the seed.

5. **Multi-tenant isolation must hold.** Every write resolver must thread `org_id` from JWT auth into the underlying resolver function. concept-db's resolver layer (`repos/concept-db/src/resolvers/concept.ts:67`, etc.) already takes `orgId` and `jwtToken`, so this is a passthrough — the dispatch case mirrors the REST handler.

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

The DB-layer story (`impulses.ts:78-83` doc-comment): for JWT auth, SurrealDB `PERMISSIONS` clauses on the target tables enforce `$auth.role = 'admin'` on UPDATE/DELETE; for API-key auth, the self-signed JWT can't pass SurrealDB ACCESS validation, so the router uses root credentials with manual `org_id = $orgId` filtering. The API key is presumed to be admin-scoped at the identity layer if it can reach destructive surface at all.

### Audit

Destructive operations call `emitUpkeepAudit(...)` (`impulses.ts:118-155`), which inserts an `impulse` row with `shape: 'upkeepAuditLog'` and a `pointer` field carrying:

```ts
{
  operation: 'delete' | 'update' | 'deprecate',
  target_table: string,
  target_ids: string[],
  filter_used: Record<string, unknown>,
  dry_run: boolean,
  count: number,
  performed_by: string,           // jwtAuth.keyId || jwtAuth.userId || 'unknown'
  org_id: string,
  reason?: string,
  diff?: Record<string, unknown>, // for update: { field: { before, after } }
  performed_at: ISO timestamp,
}
```

Non-blocking — a failed audit does not roll back the operation. The audit returns the new impulse id to be embedded in the response under `auditImpulseId`.

### Documentation surface

`docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md` is the user-facing contract: required pointer fields per shape, response envelope, auth notes, when-to-use guidance. concept-db should ship a sibling doc.

### What activity-api did NOT change

- No edits to `packages/vessel-discovery-client/src/types.ts` — `resolve_request_format` stayed at `"pointer" | "mcp-tool"`, no third value introduced.
- No edits to the `VesselCapability` shape.
- No new endpoint paths.
- No client (minibob) changes — the existing generic resolver already speaks the impulse-resolve contract; new shapes flow through unchanged.

The pattern is purely additive at the vessel level. **This is the answer to most of section 3 below.**

---

## Design alternatives

### Alt A: Add `"write"` as a third `resolve_request_format`

Add to `packages/vessel-discovery-client/src/types.ts`:

```ts
export type ResolveRequestFormat = "pointer" | "mcp-tool" | "write";
```

Vessels would advertise some shapes as readable, others as writable, possibly via parallel arrays in `VesselCapability` (e.g. `read_shapes: string[]`, `write_shapes: string[]`).

**Why not.** The `resolve_request_format` field describes the **wire format** of the request body — `"pointer"` means `{pointer: {...}}`, `"mcp-tool"` means `{tool: ..., arguments: ...}`. Read-vs-write is **semantics of a particular shape**, not a wire-format axis. The activity-api precedent demonstrates that the existing `"pointer"` format already handles writes fine — `{pointer: {type: "foo_write", barData: {...}}}` is a valid pointer envelope. Splitting on read/write at the contract level would require a parallel split everywhere downstream (clients, discovery resolution, type-narrowing in routers) for zero practical benefit.

### Alt B: Naming convention `_write` suffix on shape names, no contract change

Adopt the activity-api convention: a shape ending in `_write` is a write-shape; pointer carries its payload under a per-shape `*Data` field; response carries `metadata.shape = "<shape>_result"`. Discovery treats write-shapes identically to read-shapes — they're listed in the vessel's `shapes` array and the dispatcher routes by name.

**Why yes.** This is what activity-api shipped and what this spec recommends. The contract is a single-axis "advertise a shape and dispatch on it"; "write" is a *kind of shape*, not a *kind of contract*. Composability with existing resolvers (`pointer.type` is still the single discriminator) and zero churn in `vessel-discovery-client`.

### Alt C: Response signals write-vs-read instead of name

Same wire format on the way in (`{pointer: {...}}`), but instead of a name suffix, the resolver returns `metadata.kind = "write" | "read"`. Caller decides what to do with the response.

**Why not.** This loses the *static* signal — a template author can't tell from grepping for `_write` what an activity mutates. Discovery query results can't be filtered to "write capabilities" without round-tripping each shape. The `_write` suffix is documentation as well as dispatch.

### Alt D: Writes stay in MCP tools; this spec is N/A

Concede that read = pointer, write = MCP tool, and document the asymmetry as design.

**Why not.** Activity-api already broke the symmetry the *other* way (writes via pointer resolution), so the asymmetry is no longer "design" — it's "concept-db hasn't caught up". Templates that talk to both vessels (e.g. `learn-impulse-relationships`, which writes traces to activity-api implicitly via execution + concepts to concept-db explicitly via tool calls) currently use *both* idioms in the same template. Picking one idiom is the simplification.

---

## Recommended design

**Mirror the activity-api `_write` pattern in concept-db.** No contract changes. Add `*_write` cases to `repos/concept-db/src/routes/impulses.ts`. Each case validates the required payload field, calls the corresponding resolver function (the same one the REST handler in `routes/concepts.ts` calls), and wraps the result in the standard impulse-resolve envelope with `metadata.shape = "<type>_result"`.

For destructive shapes (none in scope for this initial cut, but the seam should exist) emit a `conceptUpkeepAuditLog` impulse — concept-db's local analogue of `upkeepAuditLog` — keyed on the same fields activity-api uses. Non-blocking emit.

Discovery contract (`packages/vessel-discovery-client/src/types.ts`) does not change. concept-db's `config.discovery.shapes` (`repos/concept-db/src/config.ts:181-189`) gains the new write shapes alongside the existing read shapes. A client doing a discovery query for shape `concept_create_write` finds concept-db, calls the advertised `resolve_endpoint` with the advertised `resolve_request_format = "pointer"`, gets a write resolver back. Same plumbing as today's reads.

### Which concept-db operations to expose as write shapes

From the existing surface (`repos/concept-db/src/routes/concepts.ts` and `tools/handler.ts`):

| MCP tool / REST path | Proposed write shape | Required pointer field | Notes |
|---|---|---|---|
| `POST /concepts` (`concepts.ts:40-59`) / `concept_create` (`handler.ts:47-51`) | `concept_create_write` | `conceptData` | Body matches `CreateConceptRequestSchema`. Convert. |
| `POST /concepts/:id/link` (`concepts.ts:317-341`) / `concept_link` (`handler.ts:59-63`) | `conceptLink_write` | `linkData` (must include `from_concept_id`, `to_concept_id`, `edge_type`) | EMA-upsert; high traffic from learning templates. Convert. |
| `POST /concepts/upsert-by-signature` (`concepts.ts:131-170`) / `concept_upsert_by_signature` (`handler.ts:65-79`) | `conceptSignatureUpsert_write` | `pointer_type`, `shape` | Idempotent; called per-pair in `learn-impulse-relationships.json:95`. Convert — this is the single biggest call site. |
| `POST /concepts/:id/usage` (`concepts.ts:347-371`) / `concept_record_usage` (`handler.ts:105-109`) | `conceptUsage_write` | `usageData` (must include `concept_id`) | Hot path for activity callbacks. Convert. |
| `POST /concepts/sequences` (`concepts.ts:454-473`) / `concept_sequence_record` (`handler.ts:111-115`) | `conceptSequence_write` | `sequenceData` | Lower volume; still worth converting for symmetry — it's a learning-loop write like the others. Convert. |
| `POST /concepts/from-source` (`concepts.ts:65-83`) | — | — | **Skip.** Source-typed creation is a convenience wrapper over `POST /concepts` with auto-derived shape/budget/priority. Activities should pick which source semantics they want and use `concept_create_write` directly with explicit fields, or this becomes a ribosome target. Add later if a real activity-driven use case appears. |
| `PATCH /concepts/:id` (`concepts.ts:233-252`) | — | **Skip for v1.** Becomes `concept_update` (destructive) when needed; the activity-api precedent shows that update-shapes carry an `updates` object with a whitelist of allowed keys. No current template needs it. |
| `POST /concepts/:id/resolve` (`concepts.ts:203-227`) | — | **Skip.** This is read-shaped despite being a POST (it creates a snapshot as a side effect, but the caller's mental model is "load the concept"). Already covered by the existing `concept` read shape (`impulses.ts:88-117`). |
| `POST /upkeep/trigger` | `conceptUpkeepTrigger_write` (deferred) | `upkeepConfig` | Currently called via curl from `learn-impulse-relationships.json:170-174`. Worth converting in a follow-up — destructive (modifies edges/concepts via prune), so requires audit + admin scope. Note in spec; don't ship in v1. |

**Five shapes in scope for v1**: `concept_create_write`, `conceptLink_write`, `conceptSignatureUpsert_write`, `conceptUsage_write`, `conceptSequence_write`.

### Decision on contract extension

**No change to the contract.** The activity-api precedent demonstrates `resolve_request_format = "pointer"` is sufficient for both reads and writes. A `"write"` value would be a wire-format axis describing semantics; the two are orthogonal and conflating them adds churn without expressiveness.

### Authorization

Mirror activity-api:

- `concept-db`'s `auth_scheme` advertised in discovery stays as it is today (typically `"none"` for inter-vessel calls, or `"Bearer"` if the deployment requires JWT).
- The five write shapes inherit the underlying REST handler's auth check: `if (config.auth.requireAuth && !jwtAuth) return 401;` (pattern at `concepts.ts:42-44`). Same code, same gate.
- `org_id` flows through the same `getJwtAuthFromContext(c)` path the read resolvers already use (`repos/concept-db/src/routes/impulses.ts:63-65`). Multi-tenant isolation is preserved because the resolver functions take `orgId` and use it in their queries.
- Per-shape stronger policy is **not** needed for v1 — none of the five shapes are admin-only. When `concept_update_write` and `conceptUpkeepTrigger_write` land later, those should add `requireAuthenticated(c)` early-reject the same way activity-api's destructive resolvers do.

This means the `auth_scheme` discovery field stays a single value advertised at the vessel level; finer-grained per-shape policy lives inside the dispatcher. Matches activity-api.

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

The `content` field is a JSON-stringified blob carrying whatever the underlying resolver returns — full `Concept` row for `concept_create_write`, `{id, created}` for `conceptSignatureUpsert_write`, `Edge` row for `conceptLink_write`, etc. Match what the existing REST handlers return. Don't strip down; activities may need ids for follow-up calls.

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
- 404 — referenced concept/edge does not exist (e.g. `conceptLink_write` against a nonexistent `from_concept_id`).
- 500 — resolver error (DB unreachable, etc.).

### Audit semantics

For the v1 set (all non-destructive: create + EMA upsert), full audit logging is overkill. The existing `concept` table writes are themselves the audit trail — every concept has `created_at`, `created_by`, `org_id`. For edges, `concept_edge` records `times_traversed` and `last_observed_at`.

When destructive shapes land (`concept_update_write`, `concept_delete_write`, `conceptUpkeepTrigger_write`), introduce a `concept_upkeep_audit` impulse — schema mirroring activity-api's `upkeepAuditLog`:

```jsonc
{
  shape: "conceptUpkeepAuditLog",
  pointer: {
    operation: "update" | "delete" | "prune" | "deprecate",
    target_table: "concept" | "concept_edge",
    target_ids: string[],
    filter_used: Record<string, unknown>,
    dry_run: boolean,
    count: number,
    performed_by: string,
    org_id: string,
    reason?: string,
    diff?: Record<string, unknown>,
    performed_at: ISO timestamp
  }
}
```

Stored as an `impulse` row in concept-db's own impulse table (or activity-api's, if concept-db doesn't store impulses today; this needs to be checked at implementation time and is the one open question that materially affects placement).

For v1 (the five non-destructive shapes), no audit table is required. Document the audit pattern up-front so the destructive follow-up doesn't have to reinvent it.

---

## Implementation outline (per repo)

### concept-db

Files to touch:

1. **`repos/concept-db/src/routes/impulses.ts`** — add five `case` blocks to the dispatch switch (after the existing read cases at line 308, before the `default`). Each case mirrors the activity-api template:

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

   No `delegateWriteToRouter`-style internal-fetch needed: concept-db's resolver functions (`createConcept`, `upsertEdge`, `upsertBySignature`, `recordUsage`, `recordSequence`) are already plain async functions taking `orgId` and `jwtToken`. Calling them directly is simpler than fetch'ing the REST router internally and avoids forwarding-header complexity. (Activity-api needs the internal-fetch only because some of its REST handlers contain logic not extracted into a resolver function. concept-db's REST handlers are already thin wrappers — see `concepts.ts:40-59`, `concepts.ts:317-341`, etc.)

2. **`repos/concept-db/src/routes/impulses.ts`** — add the new shape names to the `SUPPORTED_SHAPES` const at line 35-43.

3. **`repos/concept-db/src/config.ts`** — add the five shape names to `discovery.shapes` at line 181-189 so the vessel advertises them on registration.

4. **`repos/concept-db/sql/migrations/`** — no migration needed for v1. (Add a `conceptUpkeepAuditLog` impulse-row template when destructive shapes land.)

5. **Tests.** Add `repos/concept-db/src/routes/impulses-write.test.ts` (or fold into existing `impulses.test.ts` if it exists) covering:
   - Each shape: missing payload → 400.
   - Each shape: well-formed payload → 200 with `metadata.shape` ending in `_result`.
   - `org_id` from JWT propagates to the resolver call.
   - `requireAuth = true` + no JWT → 401 for each shape.
   - `concept_create_write` followed by `concept` read returns the created concept.
   - `conceptLink_write` against nonexistent concepts → 404 (or whatever `upsertEdge` raises).
   - `conceptSignatureUpsert_write`: idempotent — second call returns `created: false`, same id.

6. **Docs.** Add `docs/impulse-types/CONCEPT_DB_WRITE_RESOLVERS.md` mirroring `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`. Same sections: contract, write shapes table, auth context, examples, when-to-use-vs-MCP-tool.

7. **Shape index.** Add the new shapes to `docs/shapes/README.md` (the canonical shape index referenced from `LEARNING_LOOP_WRITE_RESOLVERS.md:142`).

### minibob

**No changes required.** The generic vessel resolver (`repos/minibob/src/vessel-direct-resolver.ts`) already speaks the impulse-resolve contract — it dispatches by `pointer.type` to the advertised vessel without inspecting the shape name. New `_write` shapes flow through unchanged.

That said, two small ergonomics improvements would be nice but are not required:

- Helper in `repos/minibob/src/impulse.ts` that constructs a `_write` pointer given a shape name and payload, with type narrowing per shape. Saves activities from typing the boilerplate. Optional.
- Update `learn-impulse-relationships.json` to use `concept_upsert_by_signature_write` and `conceptLink_write` resolution instead of MCP tool calls in task 3. This is a template change, not a code change. Defer to a separate "modernize templates" pass.

### @metabob/vessel-discovery-client

**No contract change.** The existing `VesselCapability.shapes: string[]` advertisement is shape-name-agnostic — concept-db just adds five more strings. The `resolve_request_format = "pointer"` already covers writes.

If we ever want clients to filter discovery results to "vessels that can write shape X", that's a future-extension query parameter on the discovery endpoint, not a contract change here. Out of scope.

### activity-api

**N/A** — the precedent already exists. Confirm the precedent docs (`docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`) are still accurate when the concept-db doc gets written; if any drift is found, fix it then.

---

## Test plan

End-to-end: after concept-db ships the five write shapes, drive the existing template `templates/concept-learning/learn-impulse-relationships.json` (task 3 — `upsert-signature-concepts-and-base-edges`) using write resolvers instead of MCP tool calls. Same outcome: signatures upserted as concepts, edges created/refined with EMA weight.

Concretely:

1. **Unit (concept-db)** — see the seven test cases listed above under "Implementation outline → concept-db → Tests".

2. **Integration (concept-db, in-process)** — drive `POST /v2/impulses/resolve` end-to-end against a real SurrealDB instance, asserting:
   - A `concept_create_write` resolution actually inserts a row in `concept` with the expected `org_id`.
   - A subsequent `concept` read resolution returns the row.
   - A `conceptLink_write` between two created concepts inserts a `concept_edge` row, and a follow-up read of `relatedConcepts` returns it.
   - `conceptSignatureUpsert_write` called twice with the same `(pointer_type, shape)` returns the same id with `created: true` then `created: false`.

3. **Discovery roundtrip** — register a concept-db instance with the new shapes in its `config.discovery.shapes`, query discovery for shape `concept_create_write`, get back concept-db's capability record, call its advertised `resolve_endpoint` with `resolve_request_format = "pointer"` carrying a `concept_create_write` pointer. Asserts the discovery contract is unchanged and the new shapes are reachable through it.

4. **Template-driven (deferred to a follow-up template-modernization PR)** — fork `learn-impulse-relationships.json` to a `-v2` variant whose task 3 uses `conceptSignatureUpsert_write` + `conceptLink_write` resolver impulses instead of MCP tool calls. Run both v1 and v2 against the same trace input and assert the resulting `concept_edge` rows are identical. Validates behavioural equivalence and lets us A/B the two idioms via Thompson Sampling before deprecating either.

5. **Trace cross-check** — run an activity that uses a write resolver and inspect its execution trace's `impulse_resolutions[]` (super-repo `CLAUDE.md` "Per-impulse resolution details"). Every write call should appear with the right `resolver_id` and `vessel_id` populated. This is the trace-integrity benefit promised in the "Problem" section; the test makes it concrete.

---

## Open questions

1. **Where do `conceptUpkeepAuditLog` impulses live?** Activity-api stores `upkeepAuditLog` impulses in its own `impulse` table. concept-db does not currently have an `impulse` table — it has `concept`, `concept_edge`, `concept_usage`, `concept_sequence`. The audit trail for destructive concept-db ops needs a destination. Options: (a) add an `impulse` table to concept-db when destructive shapes land; (b) call back to activity-api to write the audit there; (c) store as a special-shape concept (`audit:upkeep` source_type). **(a) is the cleanest** and matches activity-api, but it's a migration. Defer the decision until destructive shapes are actually being designed.

2. **Should `conceptUpkeepTrigger_write` exist at all, or should that logic move into a vessel-internal scheduler?** Templates currently trigger upkeep imperatively from a `bash` resolver (`learn-impulse-relationships.json:170-174`). Wrapping it in a write shape preserves that imperative trigger but makes it traceable. Alternative: concept-db's upkeep scheduler runs autonomously and templates *never* trigger it, reading the upkeep state instead. The latter is more aligned with "vessels own their upkeep" but breaks the template's current execution shape. Out of scope for this spec; flagged for the destructive-shapes follow-up.

3. **MCP tools and write resolvers coexist long-term — for how long?** The recommendation here is *coexistence*. Tools serve human/IDE callers (metabob-mcp); write resolvers serve activity templates. Both call the same underlying resolver function (`createConcept`, `upsertEdge`, …), so behavioural drift is bounded. If, after a quarter or two, telemetry shows tools are only ever called by activities (never by humans/IDEs), revisit and deprecate tools at that point. Don't pre-deprecate.

4. **`concept_create_write` payload includes `source_type` — should there be a parallel `concept_create_from_source_write` for the convenience wrapper at `concepts.ts:65-83`?** Probably not. `from-source` is sugar that activities should bypass — letting templates pass arbitrary `source_type` strings (which auto-derive shape/budget/priority) bakes a magic dictionary into the activity layer. If a template needs the convenience, document the source-type → defaults table once and have the template emit explicit fields.

5. **Discovery contract: should `VesselCapability` separate read and write shapes?** No (per "Decision on contract extension" above), but if discovery query traffic for write shapes ever becomes high enough to matter, an additive `write_shapes?: string[]` field on `VesselCapability` (with `shapes` continuing to mean "all shapes") is a backward-compatible extension. Document the option; don't ship it.
