# TypeScript Vessel Template

**Last updated:** 2026-04-24 (distilled from the `repos/concept-db` Wave 1-3 upgrade, commits `3d160fc` → `8399767` on concept-db + `6c8746e` on deployment + `6bb1993a` on super-repo)

A practical template for building a well-formed TypeScript vessel in this monorepo. Read [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md) first for the conceptual model; this doc is about the concrete mechanics.

**Live references:**
- `repos/metabob-activity-api/` — the north-star implementation (production, full feature set)
- `repos/concept-db/` — a minimal modern vessel (post-April-2026; mirrors the pattern at lower complexity)
- `repos/discovery-vessel/` — the registry itself; also a useful minimal-vessel reference

**Superseded docs** (still in-tree but referencing the deprecated `POST /v2/vessels/register` on activity-api, which is in proxy mode until July 2026): `VESSEL_QUICK_START.md`, `VESSEL_WIRING_PRACTICAL.md`, `VESSEL_CREATION_GUIDE.md`. Prefer this doc for new work.

---

## What a vessel is (operational definition)

A vessel is an independently deployable TypeScript service that:

1. **Advertises shapes** — declares, in config, which impulse types it resolves.
2. **Acts as a resolver** — exposes `POST /v2/impulses/resolve` that dispatches by `pointer.type` into per-shape handlers, each backed by a resolver module.
3. **Acts as a client** — queries discovery-vessel to find other vessels when it needs impulses it doesn't own.
4. **Registers with discovery-vessel** on startup and deregisters on graceful shutdown. Not with activity-api's deprecated `/v2/vessels/*` path.
5. **Records traces** — its own executions flow to activity-api. Learning is centralized, not distributed.
6. *(Optional)* **Observes passively** — subscribes to activity-api's WebSocket broadcaster to learn from executions it wasn't explicitly called in.

That's it. Everything else is implementation detail.

---

## Three invariants

These are load-bearing. Break them and the deployment falls over in subtle ways.

### 1. Registration is non-blocking

The vessel MUST keep serving requests if discovery-vessel is unreachable. Fire-and-forget the initial `register()`, log on failure, let the heartbeat loop retry. Never throw out of startup because of a discovery failure.

```ts
// repos/concept-db/src/index.ts:176-194
if (discoveryClient.isEnabled()) {
  discoveryClient.register()
    .then(success => logger.info('[Discovery] registered', { success }))
    .catch(err => logger.error('[Discovery] register failed', { err }));
  discoveryClient.startHeartbeatManager();
}
```

Compare `repos/metabob-activity-api/src/index.ts` and `repos/metabob-activity-api/src/services/discovery-client.ts` for the canonical implementation.

### 2. Every advertised shape has a dispatch case

Don't advertise what you can't resolve. The `config.discovery.shapes` array and the `switch(pointer.type)` in `routes/impulses.ts` must agree exactly. The agreement is mechanically verified by `packages/shape-dispatch-check/`:

```bash
# Run from super-repo root:
bun packages/shape-dispatch-check/check.ts repos/<vessel-name>/
# Or from inside the vessel repo:
bun run scripts/check-shape-dispatch.ts
```

The check is wired into each vessel's `lint` script, so `bun run lint` catches divergences before push.

**Suppressing intentional divergences:**

```typescript
// @shape-dispatch:private — deprecated stub; return 410 Gone, not advertised
case 'legacyShape':
case 'anotherDeprecated': {
  // fall-through: both cases marked private by single annotation
  return c.json({ error: 'Gone' }, 410);
}
```

A single `// @shape-dispatch:private` annotation immediately above the first case in a fall-through group marks the entire group as private. Private cases are excluded from the orphan-handler check.

**Shape-name aliasing** (when `pointer.type` differs from the advertised shape name):

```json
// shape-dispatch.config.json at vessel root:
{
  "mappings": {
    "authentication": ["apiKey", "session", "jwtToken"]
  }
}
```

See `repos/metabob-activity-api/src/config.ts` and `src/routes/impulses.ts` for the reference implementation.

### 3. The WebSocket observer never throws into its reconnect loop

Passive observers subscribe to a long-lived WS connection. Any unhandled exception in a message handler will either kill the process or (worse) silently stop the observer. Wrap every handler in try/catch, log errors, continue. Never `await` handler work from inside the on-message callback — dispatch asynchronously so one slow handler can't block the frame.

See `repos/concept-db/src/services/execution-observer.ts` for the reference.

---

## Directory layout

Concrete skeleton, matching how `concept-db` and `metabob-activity-api` are organized:

```
repos/<vessel>/
├── src/
│   ├── index.ts                   # Hono bootstrap, startup(), shutdown(), SIGINT/SIGTERM
│   ├── config.ts                  # Typed Config (discovery + observer + auth + feature blocks)
│   ├── middleware/
│   │   ├── jwtAuth.ts             # API-key + JWT validation via identity-vessel
│   │   └── rateLimiter.ts         # (optional)
│   ├── routes/
│   │   ├── impulses.ts            # POST /v2/impulses/resolve — switch(pointer.type)
│   │   └── <feature>.ts           # domain-specific REST routes
│   ├── services/
│   │   ├── discovery-client.ts    # singleton: register/heartbeat/shutdown
│   │   └── execution-observer.ts  # (optional) passive WS listener on activity-api
│   ├── resolvers/                 # one module per shape; no HTTP here, just business logic
│   │   └── <shape>.ts
│   ├── lifecycle/                 # in-process event emitter for own CRUD events
│   │   ├── dispatcher.ts
│   │   └── hooks.ts
│   ├── db/                        # SurrealDB + cache clients
│   └── utils/logger.ts
├── tests/                         # bun:test; pure-unit where possible
├── sql/migrations/                # PERMISSIONS enforce multi-tenancy at the DB layer
├── package.json
├── tsconfig.json                  # rootDir: ./src, strict: true, types: [bun-types]
└── Dockerfile                     # two-stage Bun build, HEALTHCHECK, non-root user
```

And in the deployment repo:

```
repos/deployment/
├── charts/<vessel>/
│   ├── Chart.yaml
│   ├── values.yaml                # apiKey.secretName + config.discovery + config.observer
│   └── templates/
│       ├── deployment.yaml        # METABOB_API_KEY via secretKeyRef; POD_NAME via fieldRef
│       ├── service.yaml
│       └── configmap.yaml
└── helmfile.yaml.gotmpl           # needs: activity-system/discovery-vessel
```

---

## The pieces

### Bootstrap and graceful shutdown

`src/index.ts` is small — a Hono app, route mounts, health, and `startup()` / `shutdown()` functions wired to signal handlers. Wait on DB connection, register lifecycle hooks, start schedulers, fire-and-forget discovery registration, start the observer, log, done. Shutdown reverses in the opposite order and calls `process.exit(0)` after cleanup.

**Concrete example:** `repos/concept-db/src/index.ts` — 264 lines, covers the whole surface.

Health endpoint at `GET /health` reports dependency status. Return 503 when the DB is disconnected; return 200 otherwise. Include discovery status in the response body for observability but don't let it fail the health check — discovery-vessel outages shouldn't cascade.

### Typed Config

`src/config.ts` exports a singleton `Config` loaded from env vars via small parsing helpers (`parseEnvInt`, `parseEnvBool`). Every block is explicitly typed; environment drift surfaces as a type error rather than a runtime surprise.

Current blocks every vessel should have:

```ts
interface Config {
  port: number;
  host: string;

  // How the vessel authenticates outbound calls
  metabob: { apiKey: string };

  // Discovery-vessel client
  discovery: {
    enabled: boolean;
    endpoint: string;              // http://discovery-vessel.activity-system.svc.cluster.local:8080
    vesselId: string;              // generateVesselId() — reads VESSEL_ID then POD_NAME/HOSTNAME
    vesselName: string;
    heartbeatIntervalMs: number;   // 60000
    retryAttempts: number;         // 3
    retryBackoffMs: number;        // 1000
    shapes: string[];              // must match routes/impulses.ts dispatch
  };

  // Passive activity-api WebSocket observer (optional capability)
  observer: {
    enabled: boolean;
    reconnectInitialMs: number;    // 1000
    reconnectMaxMs: number;        // 30000
  };

  // ... vessel-specific blocks
}
```

**Concrete example:** `repos/concept-db/src/config.ts` (pattern) and `repos/metabob-activity-api/src/config.ts` (full-feature, 15+ shapes).

### Discovery client

Singleton class with `register()`, `heartbeat()`, `shutdown()`. Exponential backoff on registration retries. Starts a `setInterval` heartbeat at TTL/2 once registered. Graceful deregistration on shutdown via `DELETE /vessels/:vesselId`.

**Registration payload:**

```json
{
  "vesselId": "concept-db-<pod-name>",
  "vesselName": "concept-db",
  "version": "0.1.0",
  "endpoint": "http://concept-db.activity-system.svc.cluster.local:8081",
  "shapes": ["concept", "conceptGraph", "relatedConcepts", "conceptUsageStats", "conceptSequence"],
  "protocol": "http",
  "metadata": { "environment": "k8s-cluster", "podId": "...", "port": 8081 }
}
```

**Auth:** `Authorization: ApiKey ${METABOB_API_KEY}`. Attach conditionally — if the env var is empty, log a warning and send unauthenticated (dev mode); production will reject and the warning tells you why.

**Concrete implementation:** `repos/concept-db/src/services/discovery-client.ts` (~340 lines), adapted from `repos/metabob-activity-api/src/services/discovery-client.ts`.

### Shape advertisement and dispatch

Two halves of one contract:

1. `config.discovery.shapes: string[]` declares what the vessel resolves.
2. `src/routes/impulses.ts` implements `POST /v2/impulses/resolve` with a `switch(pointer.type)` that maps each shape to a handler function in `src/resolvers/<shape>.ts`.

The route file is thin glue — no business logic. It:

- Parses `{pointer: {type, ...payload}}` from the request body
- Validates required fields per shape (`concept_id` for most; `root_query` for graph walks; etc.)
- Calls the resolver
- Returns `{content, metadata}` (string content for LLM injection, object metadata for the caller's reasoning)
- Returns 400 with `supported_shapes` list for unknown types, 404 for not-found, 500 for resolver errors

**Concrete example:** `repos/concept-db/src/routes/impulses.ts` (~260 lines for 5 shapes).

### Passive execution observer (optional)

New pattern as of 2026-04. Solves "how does my vessel learn from executions it wasn't called in?"

Connect to `${activityApi.url}/ws` (upgrade `http`→`ws`, `https`→`wss`). Send `{type: "authenticate", token: apiKey}` as the first message. Server responds `{type: "authenticated"}` or closes with code 1008. On reconnect, send `{type: "catchup", lastSeenSequence: n}` to replay missed events (note: the server field is `lastSeenSequence`, not `fromSequence` — workbench's hook has a legacy bug here).

Events of interest:

- `task.completed` — carries `input_impulse_ids` and `output_impulse_ids` (per-task impulse arrays as of 2026-04-25); scan for references to shapes this vessel owns; react locally
- `tool.call` — phase 2: extract references from tool arguments

Reconnect with exponential backoff: start at 1s, cap at 30s, reset on clean open. Every handler is try/catch-wrapped; errors log and continue.

`task.completed.data` now carries `input_impulse_ids: string[]` and `output_impulse_ids: string[]` (always present, possibly empty). These are the per-task impulse arrays; note that the richer `impulse_resolutions` (per-resolution metadata with resolver tier, latency, cost) is only on the persisted trace row. See `docs/specs/broadcaster-per-task-grouping.md` for implementation details.

**Concrete implementation:** `repos/concept-db/src/services/execution-observer.ts` (~411 lines) + `tests/execution-observer.test.ts` (14 unit tests covering request building, dedup, failure swallowing, backoff schedule).

### Auth

`src/middleware/jwtAuth.ts` extracts either `Authorization: Bearer <jwt>` or `Authorization: ApiKey <key>`:

- **JWT**: validate via identity-vessel (primary) with direct-SurrealDB ACCESS fallback. Claims include `{org_id, project_id, role, exp, iat}`. 15-minute lifetime.
- **API key**: validate via identity-vessel's impulse resolver. Scopes include `read` and `write`.

Hang `{orgId, keyId, authType, jwtToken}` on the Hono context. All subsequent DB queries use `$auth.org_id` via SurrealDB `PERMISSIONS` clauses. No application-level filtering — the database enforces tenancy.

**Concrete example:** `repos/metabob-activity-api/src/middleware/jwtAuth.ts` (~80 lines).

### Internal lifecycle hooks

Own-CRUD events emit from `src/lifecycle/dispatcher.ts` (in-process EventEmitter). `src/lifecycle/hooks.ts` registers handlers. Purely intra-vessel — not for cross-vessel observation (use the WS observer for that).

Useful for: invalidating caches when records change, auto-linking related entities, audit logging. Handlers are async but `void`-returning; the emitter doesn't `await` them. Don't use hooks for anything that must complete synchronously.

**Concrete example:** `repos/concept-db/src/lifecycle/dispatcher.ts` + `hooks.ts` (~170 lines combined).

---

## Deployment wiring (Helm)

The chart and helmfile must plumb:

1. **`METABOB_API_KEY`** via `secretKeyRef` → `{{ .Values.apiKey.secretName }}` / `{{ .Values.apiKey.secretKey }}`. Default secret name: `<vessel>-api-keys`.
2. **`POD_NAME`** via `valueFrom.fieldRef.fieldPath: metadata.name` — feeds the vessel's `generateVesselId()` helper so each replica gets a stable ID.
3. **`DISCOVERY_ENABLED`**, **`DISCOVERY_VESSEL_ENDPOINT`**, and the heartbeat/retry envs matching `config.discovery`.
4. **`OBSERVER_ENABLED`** and the reconnect envs (if the vessel uses the observer).
5. **`needs:`** includes `activity-system/discovery-vessel` so helmfile orders the deploy correctly.

**Secret provisioning is intentionally out-of-tree.** Chart references the secret by name but doesn't create it. Steps to activate a new vessel:

1. Add a `<vessel>` block to `repos/deployment/scripts/generate-secrets.sh`
2. `sops secrets/canary.secrets.yaml` (requires Age key), add `<vessel>.apiKey` — generate via `openssl rand -hex 32` prefixed `mb_<vessel>_canary_`
3. Register the key in the identity-vessel seed so activity-api accepts it
4. Either add `templates/secret.yaml` to the chart (mirroring `charts/minibob/templates/secrets.yaml`) or manually: `kubectl create secret generic <vessel>-api-keys --from-literal=api-key=<KEY> -n activity-system`

Without these the pod starts but registration stays unauthenticated (and the Secret reference may block pod start entirely if absent).

**Concrete example:** `repos/deployment/charts/concept-db/` + the concept-db release block in `helmfile.yaml.gotmpl` (see commit `6c8746e`).

---

## What NOT to do

### Don't register against activity-api's `/v2/vessels/register`

Deprecated. In proxy mode until July 2026. Register with discovery-vessel directly. The older docs (`VESSEL_QUICK_START.md`, `VESSEL_WIRING_PRACTICAL.md`, `VESSEL_CREATION_GUIDE.md`) still show this path — they're stale. Follow this doc instead.

### Don't gate registration behind an unprovisioned env var

Common failure mode: the vessel checks `if (process.env.JWT_TOKEN)` and silently disables registration when unset. Helm chart doesn't plumb `JWT_TOKEN`, so in canary the vessel never registers and nobody notices. Use the config-driven `discoveryClient.isEnabled()` pattern (checks `DISCOVERY_ENABLED`, default `true`), and surface missing auth via a warning at register time — not a silent disable at startup.

This was the concept-db pre-Wave-1 bug; see commit `faa7d8e` for the fix.

### Don't import across repo boundaries

`tsconfig.json` has `rootDir: ./src`. Imports from `../../../other-repo/src/*` violate it and produce TS6059. `bun build` ignores TS errors and will cheerfully bundle broken code — so set up CI to run `bun run tsc --noEmit` and treat failures as blocking. If you need a type from another vessel, either duplicate it locally (small types) or extract a shared package (large contracts). Don't cross-import source trees.

### Don't put business logic in `routes/impulses.ts`

The route is dispatch glue. Resolvers live in `src/resolvers/<shape>.ts`, get unit-tested in isolation, and are reusable from MCP tools / CLI / internal callers. Mixing the two produces untestable route handlers and duplicated logic between routes and MCP tools.

### Don't build your own heartbeat against a deprecated endpoint

You will be tempted to "just copy" an older vessel's registration code. Check whether its registration target is discovery-vessel or activity-api's legacy path. If the latter, read this doc and `repos/metabob-activity-api/src/services/discovery-client.ts` before copying.

---

## Checklist for a new vessel

Before cutting the first release:

- [ ] `bun run tsc --noEmit` exits 0
- [ ] `bun test` green with unit tests covering each resolver in isolation
- [ ] `POST /v2/impulses/resolve` dispatches for every shape in `config.discovery.shapes`
- [ ] Unknown shapes return 400 with `supported_shapes` in the response body
- [ ] Startup is non-blocking when discovery-vessel is down (test by pointing `DISCOVERY_VESSEL_ENDPOINT` at a dead URL)
- [ ] Shutdown deregisters from discovery-vessel before exiting
- [ ] `/health` returns 503 only on DB failure, not on discovery failure
- [ ] WebSocket observer (if used) reconnects with backoff and never throws out of handlers
- [ ] Helm chart mounts `METABOB_API_KEY` via `secretKeyRef` and `POD_NAME` via `fieldRef`
- [ ] Helmfile `needs:` includes `activity-system/discovery-vessel`
- [ ] Secret provisioning steps documented in the vessel's `CLAUDE.md` (no API keys in values.yaml)

---

## Related

- [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md) — The conceptual model. Read first.
- [`../../DISCOVERY_INTEGRATION.md`](../../DISCOVERY_INTEGRATION.md) — Discovery-vessel integration details.
- `VESSEL_CONSTRUCTION_PATTERNS.md` (archived 2026-04-26) — Cross-vessel pattern analysis (2026-04-08). Idioms remain current; registration path superseded by discovery-vessel.
- [`RESOLVER_TRACKING.md`](RESOLVER_TRACKING.md) — Per-impulse resolution tracking for learning.
- [`../guides/CONCEPT_INTEGRATION_TEMPLATES.md`](../guides/CONCEPT_INTEGRATION_TEMPLATES.md) — Example activity templates that consume a vessel's shapes.
