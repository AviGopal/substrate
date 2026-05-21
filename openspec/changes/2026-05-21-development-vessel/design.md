# Design — development-vessel

## §A Topology

```
┌──────────────────────────────────────────────────────────────────┐
│  caller (CLI / autonomous loop / workbench / another vessel)     │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP POST /v2/impulses/resolve
                          │     OR direct in-process call
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│ development-vessel  (repos/development-vessel/)                  │
│                                                                  │
│  - Bun + Hono HTTP service on $PORT (default 8090).              │
│  - On startup: register with discovery-vessel (non-blocking).    │
│  - On request: dispatch by pointer.type to a resolver.           │
│                                                                  │
│  Composes:                                                       │
│    @avigopal/ias-executor-ts   ← library, not runtime            │
│      ExecutionRuntime + ActivityExecutor + ResolverRegistry      │
│      + ActivityApiAdapter (template fetch, trace record)         │
│      + HttpDiscoveryAdapter                                      │
│                                                                  │
│  Resolvers it exposes (advertised to discovery):                 │
│    git_status / git_add / git_commit / git_diff / git_log        │
│    fs_read / fs_write / fs_edit                                  │
│    activity_fetch / activity_create_variant                      │
│    vessel_register_passthrough                                   │
│    code_introspect                                               │
│    propagate_judgment                                            │
└──────────────────────────────────────────────────────────────────┘
                          │ uses
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│ activity-api (canary)                                            │
│  - templates fetched by id                                       │
│  - traces recorded with proper org_id scoping                    │
│  - variant creation under caller's auth                          │
└──────────────────────────────────────────────────────────────────┘
```

## §B Three-layer discipline (re-stated)

The vessel does NOT contain hidden LLM calls or imperative business
logic. Every operation is:

1. **TypeScript code** — the resolver implementations + the HTTP +
   the CLI shim. Deterministic. Testable. Versioned.
2. **Activities** — JSON impulse-of-shape-`activity_template`, fetched
   from activity-api by id. Compose resolver calls.
3. **LLMs** — only inside an `llm-prompt` or `agent_fill` resolver call
   dispatched by an activity. Never inside vessel code directly.

Concretely: this vessel does not "decide" anything in code beyond
dispatch. All decisions live in activities. If a behavior needs to
change, the variant of the activity changes; the resolver code only
changes when an activity declares an output shape the current code
cannot honor (Case 2a in CASES_AND_FLOWS.md).

## §C Bootstrap order (one final conventional commit)

1. `repos/development-vessel/` skeleton committed conventionally.
   This is the LAST conventional commit anywhere in this codebase
   under the 2026-05-21 pivot.
2. `bun run repos/development-vessel/src/cli.ts seed-templates` runs
   ONCE. This invocation uses the vessel's own `activity_create_variant`
   resolver to upload the bootstrap activity templates to activity-api
   as variants under the caller's org. Templates uploaded:
   - `ship-change` — already-proven git-add-commit pipeline, re-homed.
   - `branch-health` — already-proven git-state probe, re-homed.
   - `release-change` — `ship-change` then `branch-health` composition.
   - `add-resolver-to-vessel` — read source, propose edit, commit.
   - `propagate-judgment` — fold a judgment impulse into a Thompson
     posterior update via existing `impulseRelevance_write`.
   - `boot-fetch-template` — the only template that lives in vessel
     code (irreducible bootstrap); fetches another template by id.
3. From step 2 onward, the vessel itself is the shipping path.
   `repos/ias-executor-ts/src/examples/ship-change-vessel.ts` and
   `repos/ias-executor-ts/src/examples/branch-health.ts` are scheduled
   for removal in a follow-up cycle after parity is verified.

## §D Auth scope

The vessel uses METABOB_API_KEY for activity-api calls. The key is
read+write scope. The vessel **must not** attempt admin-scope
operations (`activityTemplate_update`, `_deprecate`) — those are
operator-gated and will 403.

Repair flow consequence: variant-first. Never mutate a template
in-place. Always create a new variant with the fix. Thompson selects.

## §E Resolver contracts

Every resolver MUST:

- Be advertised as one entry in `config.discovery.shapes` (per
  `TYPESCRIPT_VESSEL_TEMPLATE.md` Invariant 2).
- Have a `case` clause in `src/routes/impulses.ts`'s dispatch switch.
- Tolerate JSON-stringified inputs (interpolation artefact when invoked
  from dotted-path template variables).
- Emit ONE impulse with a stable shape. Tag the shape's metadata with
  `source: <resolver-id>` for traceability.
- On internal error: throw with a clear message. The engine converts
  the throw to a per-task `success: false` record; the vessel must
  not swallow exceptions silently.

Per-resolver shape contracts are in `specs/development-vessel/spec.md`.

## §F Judgment idiom

`propagate_judgment` is the unifying mechanism. It takes any
`validation_result`-shape impulse and:

1. Reads `metadata.target_variant_id` (or falls back to
   `metadata.execution_id` → lookup variant via activity-api).
2. Reads `metadata.source_tier` (validator / witness / audit / human /
   runtime — defaults to `validator`).
3. Computes weight from source_tier (validator=1.0 default; tunable).
4. Posts to `/v2/activities/impulse-relevance` with the variant id
   and weighted α or β delta based on `passed`.
5. Emits a `judgment_propagated` impulse so downstream readers can
   see the propagation happened (and which posterior moved).

This is the load-bearing piece for "lift". A sixth oracle joining the
system is just: emit a `validation_result` with the right source_tier
and target_variant_id. Posterior pressure follows automatically.

## §G Side-effect / watcher vessel pattern

A future "watcher" vessel that subscribes to lifecycle:execution:succeeded
and emits `runtime_quality_judgment` impulses is **out-of-scope for this
cycle** but the development-vessel's `propagate_judgment` is designed so
such a vessel works with zero new pipeline code. Documented in
proposal.md §"Out-of-scope" as the next-cycle proof of lift.

## §H Local-mode vs HTTP-mode

The vessel ships with two entry points:

- `src/cli.ts` — direct in-process resolver invocation. Used by the
  autonomous-loop driver and developer machines without a discovery
  server. No HTTP. Composes the same `ExecutionRuntime` + resolvers
  but skips registration.
- `src/index.ts` — HTTP service. Registers with discovery on startup
  (non-blocking; failure logged but boot continues). Serves
  `POST /v2/impulses/resolve` and `GET /health`.

Both modes share the same resolver implementations. Local-mode is the
development-machine ergonomics path; HTTP-mode is the in-cluster path.

## §I Failure isolation

Adopting the existing vessel pattern (TYPESCRIPT_VESSEL_TEMPLATE.md):

- Discovery registration failure does NOT block boot. Vessel serves
  resolvers locally even if it can't advertise.
- activity-api downtime does NOT block resolver dispatch. Activities
  that need template fetch will fail with a clear error; resolvers
  that don't touch activity-api (git_*, fs_*) continue to work.
- A resolver throw is converted to a per-task `success: false` by the
  engine; never escapes to the HTTP layer as 500.

## §J Tests

Three tiers:

1. **Unit** (`test/<resolver>.test.ts`): each resolver tested with
   scripted `ProcessPort` / fixture fs / fake activity-api. Mirrors
   the pattern in `repos/ias-executor-ts/test/ship-change-vessel.test.ts`.
2. **Integration** (`test/vessel-integration.test.ts`): start the HTTP
   service against an in-process fake activity-api; issue resolve
   calls; assert the resolver chain produces expected impulses.
3. **Bootstrap dry-run** (`test/seed-templates-dry-run.test.ts`): the
   `seed-templates` CLI verb runs with a fake activity-api adapter
   that captures variant uploads; assert each bootstrap template is
   posted with the right shape.

CI gate: same as other vessels — `bun test` + `bun run lint` (which
includes `scripts/check-shape-dispatch.ts` for shape↔dispatch
agreement).

## §K Migration of existing examples

After the vessel ships AND `seed-templates` lands the activities into
activity-api, the following files are scheduled for removal:

- `repos/ias-executor-ts/src/examples/ship-change-vessel.ts`
- `repos/ias-executor-ts/test/ship-change-vessel.test.ts`
- `repos/ias-executor-ts/src/examples/branch-health.ts`
- `repos/ias-executor-ts/test/branch-health.test.ts`

Removal happens in a follow-up commit (not in this cycle's PR) once
the development-vessel's parity is verified end-to-end.
