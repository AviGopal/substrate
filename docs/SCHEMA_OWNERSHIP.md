# Schema Ownership

Which vessel owns which SurrealDB tables, where the schema files live, and who
applies them. Ownership here is not a convention someone remembers — it is
readable from the tree: **the vessel that ships the `.surql` that `DEFINE
TABLE`s a table owns that table**, and it ships the runner that applies it.

The fleet shares one datastore. Namespace and database come from the generated
environment (`scripts/substrate/gen-env.sh`): namespace `activity-system`,
database `learning_loop`. Sharing a datastore is what makes ownership matter —
nothing at the connection level stops one vessel from writing another's tables,
so the boundary is enforced by table `PERMISSIONS` and by the discipline below.

## Ownership principles

1. **Single owner.** Each table has exactly one owning vessel — the one whose
   repository holds its `DEFINE TABLE`.
2. **Read across, write through.** A vessel may read tables it does not own.
   Writes go through the owner's resolver or REST surface so the owner's
   validation runs.
3. **The owner migrates.** Schema changes to a table land in the owner's repo
   and are applied by the owner's runner, never by hand against a live database.
4. **The owner defines PERMISSIONS.** Tenant isolation is a property of the
   table, not of the calling code.
5. **Not every store is SurrealDB.** A vessel can own state without owning a
   table — development-vessel's `memoryNote` store is a JSON file under the
   workspace root, and analysis-vessel is stateless (per-request analysis over
   the code property graph, no datastore connection at all). Ownership of a
   store is still ownership; the write path is still the owner's resolver.

## Where schema lives and who applies it

| Owner | Schema files | Applied by |
|---|---|---|
| activity-api | `repos/activity-api/sql/*.surql`, `sql/schemas/`, `sql/migrations/` | `repos/activity-api/scripts/init-database.ts`, run as `ExecStartPre` of `activity-api.service` |
| concept-db | `repos/concept-db/sql/core/`, `sql/upkeep/` | `repos/concept-db/scripts/apply-schema.ts` (`bun run apply-schema`), run as `ExecStartPre` of `concept-db.service` |
| identity-vessel | `repos/identity-vessel/sql/migrations/` | the vessel itself at startup, only when `SCHEMA_AUTOAPPLY=true`; otherwise an operator or init step applies them |
| user-vessel | `repos/user-vessel/sql/` | the deployment that runs user-vessel; the substrate fleet inventory does not include it |

Both in-container runners are idempotent and non-fatal by design. Their unit
lines carry a `-` prefix so a datastore that is slow to accept connections
delays schema application instead of wedging the vessel; the vessel serves and
the schema converges on a later start.

### Migration tracking

`init-database.ts` records every applied filename in an `init_migrations` table
and skips those files on re-runs, so slow or one-shot migrations do not re-run
on every boot. On a database that already holds data but has an empty
`init_migrations`, it pre-populates the table from the files present rather than
re-applying everything. It also substitutes the `__JWT_SECRET__` placeholder in
`sql/000-auth-schema.surql` with the `JWT_SECRET` environment variable before
applying, so the `apikey_token` JWT ACCESS method and the runtime signer share
one secret.

`apply-schema.ts` takes the other approach: every statement is written with
`DEFINE ... IF NOT EXISTS` or `DEFINE ... OVERWRITE`, so re-application is a
no-op and no tracking table is needed. It splits files on semicolons, which is
why comments inside those files must never contain a semicolon.

## Activity-api tables

Owned by `repos/activity-api`. This is the learning substrate: activity
definitions, execution traces, impulse records, and the statistics the selector
reads.

The canonical model is four tables defined in
`sql/schemas/020-paradigm-core-tables.surql`:

| Table | Holds |
|---|---|
| `activity` | Activity templates — the selectable arms |
| `execution` | Execution records |
| `impulse` | Impulse records with pointer and metadata |
| `vessel` | Vessel registry rows |

Around that core sit two other groups. **Compatibility views** map legacy names
onto the canonical tables so older queries keep working:
`sql/schemas/026-activity-template-alias.surql` defines `activity_template` as a
view over `activity`, and `sql/schemas/022-paradigm-compat-views-v3.surql`
defines the `v_paradigm_*` family. **Legacy and specialised tables** —
`activity_execution_traces`, `variant_performance_metrics`,
`goal_execution_paths`, `activity_composition_graph`, `composition_edge`,
`tool_usage`, `execution_sequences`, `impulse_relevance_metrics` and the rest of
`sql/migrations/` — carry data the canonical four do not model yet. Treat the
files as the authoritative list; the set changes as migrations land, and a
table's owner is always the repo whose `.surql` defines it.

`minibob_instance` is a tombstone. `sql/000-auth-schema.surql` defines it and
`sql/migrations/052-deprecate-minibob-instance.surql` makes it read-only —
`FOR create, update, delete NONE` — because the CLI it authenticated is retired
and its callers present API keys validated by identity-vessel instead. The table
survives so historical rows remain auditable, not because anything writes it.

## Identity and tenancy tables

Authentication state is owned outside activity-api. `sql/000-auth-schema.surql`
states the split in its own header: activity-api owns `minibob_instance`;
the organizations, users, and API-key tables belong to the identity side.

`repos/identity-vessel/sql/migrations/` defines `api_key` and `key_session`, and
`004-tenant-isolation-permissions.surql` rewrites `PERMISSIONS` on
`organizations`, `users`, and `organization_members`. Note the split between
definition and application: identity-vessel applies its own migrations only when
`SCHEMA_AUTOAPPLY=true`, and `repos/identity-vessel/sql/001-auth-tables.surql`
is a reference document with every `DEFINE` removed, describing the fields the
vessel reads rather than creating them.

`repos/user-vessel/sql/` defines the tenancy tables themselves —
`organizations`, `users`, `organization_members`, `accounts`, `account_members`,
`projects`, `project_members`, `federation_links`, `invitations`,
`mcp_usage_snapshot`, `mcp_outcome_event`. user-vessel is a submodule of this
super-repo but is not in the substrate's fleet inventory, so a local substrate
runs identity-vessel as the validator over tables user-vessel authored.

## Concept-db tables

Owned by `repos/concept-db`, applied from `sql/core/` and `sql/upkeep/`. These
tables carry the concept graph and the prose knowledge the drafter consults:

| Table | Holds | Defined in |
|---|---|---|
| `concept` | Concept records, with prose body and dense embedding | `sql/core/` |
| `concept_edge` | Typed edges between concepts | `sql/core/` |
| `concept_usage` | Per-concept usage records | `sql/core/` |
| `impulse` | Impulse rows concept-db writes for its own audit trail | `sql/core/` |
| `upkeep_stats` | Upkeep aggregates | `sql/upkeep/` |

`sql/core/008-permissions-token-org.surql` is the clearest worked example of the
tenancy idiom in the tree: every table is rewritten to scope on
`$token.org_id`, with globally-public concepts readable across orgs and delete
restricted to `$token.role = 'admin'`.

## The archived core schema layer

`repos/deployment/vessels/metabob-proto/surrealdb/core/` holds the historical
core schema — `schema_version`, `organizations`, `users`, `api_keys`,
`minibob_instance`, `projects`, `project_members`, `subscriptions`,
`audit_logs`, `connection`. Read it as reference for what those tables looked
like; do not treat it as a live migration source.

Two facts fix its status. `Dockerfile.substrate` copies no part of
`repos/deployment` into the substrate image, so those files are not present in a
running container. And `repos/activity-api/sql/migrate.ts` — the older runner
that applies this core layer before the activity schemas — locates it through
`METABOB_PROTO_PATH`, which nothing under `scripts/` sets. The substrate's
schema path is `scripts/init-database.ts`, which applies only activity-api's own
files. `migrate.ts` runs against a checkout where that core layer exists and the
environment variable points at it.

## Cross-vessel data access

Prefer the owner's resolver. Every vessel that owns data advertises read and
write shapes through the discovery registry and serves them at
`POST /v2/impulses/resolve`, so a caller reaches another vessel's data as an
impulse rather than as a query:

```typescript
// Read activity templates from whichever vessel advertises the shape.
const res = await fetch(`${discoveredEndpoint}/v2/impulses/resolve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${key}` },
  body: JSON.stringify({ pointer: { type: 'activityTemplate' } }),
});
```

This keeps the owner's validation in the path, keeps the call inside the trace,
and lets discovery move the resolver when the data moves. Reading another
vessel's tables directly is possible — one datastore — but it hardcodes a table
layout the owner is free to change, and it produces no trace.

If a read must go direct for performance, keep it to `SELECT`, authenticate with
the same credentials the owner would require so the table's `PERMISSIONS` still
apply, and treat the row layout as the owner's to change without notice.

## Adding a new table

1. **Pick the owner.** Which vessel's resolver will write it? That repo gets the
   schema file.
2. **Write the file** into the owner's schema directory — `sql/schemas/` or
   `sql/migrations/` for activity-api, `sql/core/` for concept-db — with a
   numeric prefix, since both runners apply files in sorted order.
3. **Scope it.** New tables use `$token.org_id` for org isolation.
   `$auth.org_id` appears in older files and silently excludes API-key callers;
   see [`RBAC_GUIDE.md`](RBAC_GUIDE.md) for when `$auth` is still correct.
4. **Index the scope column** and whatever the queries filter on.
5. **Make it re-appliable** — `DEFINE ... IF NOT EXISTS`, or `OVERWRITE` when
   the point is to replace a previous definition.

```surql
-- repos/activity-api/sql/migrations/<n>-new-feature.surql

DEFINE TABLE IF NOT EXISTS new_feature SCHEMAFULL
  PERMISSIONS
    FOR select, create, update, delete WHERE org_id = $token.org_id;

DEFINE FIELD IF NOT EXISTS org_id ON new_feature TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS name ON new_feature TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON new_feature TYPE datetime DEFAULT time::now();

DEFINE INDEX IF NOT EXISTS idx_new_feature_org ON new_feature FIELDS org_id;
```

## Patterns that break ownership

**Writing another vessel's table.** The write skips the owner's validation, is
invisible to the owner's traces, and breaks the moment the owner changes the
layout. Resolve the owner's `*_write` shape instead.

**Assuming a column that the API does not expose.** A direct
`SELECT some_field FROM activity_template` binds you to a view definition the
owner maintains for backward compatibility and intends to retire. Read the
shape; the response envelope is the contract.

**Bypassing PERMISSIONS with root credentials.** Signing in as root makes every
tenant's rows visible and turns a tenancy bug into a data leak. Tenant isolation
lives in the table, and it only works if the caller authenticates as the tenant.
Use the authenticated client path so `$token` is populated.

**Hand-editing a live database.** A change applied by hand exists in exactly one
datastore and disappears on the next volume reset, with nothing in any repo
explaining it. Schema changes are files, applied by the owner's runner.
