# TypeScript Vessel Template

A practical template for building a well-formed TypeScript vessel in this monorepo. Read [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md) first for the conceptual model; this doc is about the concrete mechanics.

## Quick-start: VesselDaemon (preferred)

**For new substrate vessels, use `VesselDaemon` from `@avigopal/ias-executor-ts`** rather than wiring the pieces individually. VesselDaemon composes `ActivityExecutor` + `DiscoveryRegistrationLoop` + `ResolverServer` behind a single `Bun.serve` and handles startup, health, and shutdown on SIGTERM.

Minimal scaffold (see `repos/ias-executor-ts/src/hosts/__example__/minimal-vessel.ts` for a runnable example under 100 lines):

```typescript
import { VesselDaemon } from '@avigopal/ias-executor-ts';

const daemon = new VesselDaemon({
  vesselId: process.env.VESSEL_ID ?? 'my-vessel',
  port: parseInt(process.env.PORT ?? '8250', 10),
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT ?? 'http://127.0.0.1:8100',
  apiKey: process.env.METABOB_API_KEY ?? '',
  activityApiEndpoint: process.env.ACTIVITY_API_ENDPOINT ?? 'http://127.0.0.1:8080',
  shapes: ['myShape'],          // impulse types this vessel resolves
  systemVessel: true,           // required for substrate visibility without orgId
  resolvers: {
    myShape: async (pointer) => ({ loaded: true, content: '...' }),
  },
});

await daemon.start();
```

`VesselDaemon` handles all three invariants (non-blocking registration, shape-dispatch agreement, WS-observer safety) out of the box. It also:

- Serves exactly three routes — `POST /resolve`, `POST /run-goal`, `GET /health` — and 404s everything else
- Accepts `parent_execution_id` and `composition_chain` in request bodies
- Threads them into `ExecuteOptions` for cross-vessel composition tracking

**Its `/run-goal` is synchronous and template-keyed.** The body must name a `templateId` (400 without one, 404 if the template provider does not have it); the daemon executes it and returns `{ trace, executionId, status }` in one response. Do not model a VesselDaemon on the async dispatch contract below — that belongs to goal-host-vessel, not to the daemon.

**Async dispatch is goal-host-vessel's contract.** `POST /run-goal` on goal-host returns **202 Accepted** with `{ dispatchId, status: "running" }` and runs the goal in the background; callers poll `GET /executions/:dispatchId` for `status` and — more importantly — for the honest `reached` verdict. The reason is a hard constraint, not a preference: Bun's `fetch` caps its connection timeout, so any goal outliving that cap would look like a connection failure to a synchronous caller while the goal was still running. Example caller pattern:

```typescript
const { dispatchId } = await fetch(`${goalHostEndpoint}/run-goal`, {
  method: 'POST',
  headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ goal, variables }),
}).then(r => r.json()); // 202 — dispatchId only

// poll until done (or use WebSocket task.completed events)
let result;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 2000));
  result = await fetch(`${goalHostEndpoint}/executions/${dispatchId}`, {
    headers: { Authorization: `ApiKey ${apiKey}` },
  }).then(r => r.json());
  if (result.status === 'completed' || result.status === 'failed') break;
}
```

**When to use the manual approach instead:** if your vessel does not execute activities (a pure resolver) or has no shapes to advertise (a pure WebSocket consumer, like `ribosome-vessel`), assemble `DiscoveryRegistrationLoop` directly and skip `ActivityExecutor`.

**Live references:**

- `repos/analysis-vessel/` — the stateless resolver exemplar (port 8250; six code-analysis shapes via `VesselDaemon` + `ActivityExecutor`; no SurrealDB). Read `src/index.ts` for the canonical localhost-default + `VesselDaemon.start()` shape.
- `repos/local-tools-vessel/` — resolver vessel built on `VesselDaemon`
- `repos/goal-host-vessel/` — the async goal-dispatch surface; `DiscoveryRegistrationLoop` without `VesselDaemon`
- `repos/ribosome-vessel/` — pure WebSocket consumer (no shapes); shows when NOT to use VesselDaemon
- `repos/activity-api/` — the north-star implementation (full feature set)
- `repos/concept-db/` — the manual pattern at lower complexity
- `repos/discovery-vessel/` — the registry itself; also a useful minimal-vessel reference
- `repos/ias-executor-ts/src/hosts/__example__/minimal-vessel.ts` — runnable VesselDaemon example

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

These are load-bearing. Break them and the deployment falls over in subtle ways — not loudly at startup, but as a vessel that serves traffic while invisible to the registry, or one that advertises a shape it cannot resolve, or an observer that stopped consuming without ever logging why. Each invariant below is stated with the failure it prevents, because the failure is what makes it recognisable in the wild.

### 1. Registration is non-blocking

The vessel MUST keep serving requests if discovery-vessel is unreachable. Fire-and-forget the initial `register()`, log on failure, let the heartbeat loop retry. Never throw out of startup because of a discovery failure.

```ts
// repos/concept-db/src/index.ts
if (discoveryClient.isEnabled()) {
  discoveryClient.register()
    .then(success => logger.info('[Discovery] registered', { success }))
    .catch(err => logger.error('[Discovery] register failed', { err }));
  discoveryClient.startHeartbeatManager();
}
```

The same file wraps its SurrealDB connect in a bounded retry loop and fires registration regardless of DB state, so a vessel whose database is still coming up is still discoverable. Compare `repos/activity-api/src/index.ts` and `repos/activity-api/src/services/discovery-client.ts` for the canonical implementation.

### 2. Every advertised shape has a dispatch case

Don't advertise what you can't resolve. The `config.discovery.shapes` array and the `switch(pointer.type)` in `routes/impulses.ts` must agree exactly. The agreement is mechanically verified by the checker in `packages/shape-dispatch-check/`:

```bash
# Check one vessel (from super-repo root):
bun packages/shape-dispatch-check/check.ts repos/<vessel-name>/

# Sweep every vessel with the standard src/config.ts + src/routes/impulses.ts layout:
scripts/check-shape-dispatch-all.sh
```

Both exit 0 clean, 1 on any unsuppressed violation. A vessel wires the check into its own `lint` script through a thin `repos/<vessel>/scripts/check-shape-dispatch.ts` shim that execs the shared checker with the vessel root — copy that shim rather than reimplementing the parse, so a single checker keeps every vessel honest. Add the vessel to the `VESSELS` array in `scripts/check-shape-dispatch-all.sh` so the workspace sweep covers it too; a vessel missing from that list is silently skipped rather than reported.

The check also runs *inside* the discovery client at registration time in vessels that implement it: an advertised shape with no dispatch case is logged as a violation and **filtered out of the registration payload**, so the registry never learns about a shape the vessel cannot serve.

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

See `repos/activity-api/src/config.ts` and `src/routes/impulses.ts` for the reference implementation.

### 3. The WebSocket observer never throws into its reconnect loop

Passive observers subscribe to a long-lived WS connection. Any unhandled exception in a message handler will either kill the process or (worse) silently stop the observer. Wrap every handler in try/catch, log errors, continue. Never `await` handler work from inside the on-message callback — dispatch asynchronously so one slow handler can't block the frame.

See `repos/concept-db/src/services/execution-observer.ts` for the reference.

---

## Directory layout

Concrete skeleton, matching how `concept-db` and `activity-api` are organized:

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
│   │   ├── discovery-client.ts    # singleton: register/heartbeat/deregister/shutdown
│   │   └── execution-observer.ts  # (optional) passive WS listener on activity-api
│   ├── resolvers/                 # one module per shape; no HTTP here, just business logic
│   │   └── <shape>.ts
│   ├── lifecycle/                 # in-process event emitter for own CRUD events
│   │   ├── dispatcher.ts
│   │   └── hooks.ts
│   ├── db/                        # SurrealDB + cache clients
│   └── utils/logger.ts
├── scripts/check-shape-dispatch.ts # shim execing packages/shape-dispatch-check/check.ts
├── tests/                         # bun:test; pure-unit where possible
├── sql/migrations/                # PERMISSIONS enforce multi-tenancy at the DB layer
├── package.json
├── tsconfig.json                  # rootDir: ./src, strict: true, types: [bun-types]
└── Dockerfile                     # two-stage Bun build, HEALTHCHECK, non-root user
```

And for the **local single-container substrate** (the primary development target — see "Deployment wiring" below), a systemd unit file:

```
scripts/substrate/units/<vessel>.service   # Type=simple Bun unit; EnvironmentFile + PORT/VESSEL_ID env
```

The **downstream** Helm chart (canary/production only) lives in the deployment repo:

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

Each subsection below is one file from that skeleton, described by the contract it must satisfy rather than by its current contents — read the cited source for the implementation. The order is the order you build them in: bootstrap and config first, then the discovery client that makes the vessel findable, then the resolve surface that makes it useful, then the optional observer, auth and lifecycle machinery.

### Bootstrap and graceful shutdown

`src/index.ts` is small — a Hono app, route mounts, health, and `startup()` / `shutdown()` functions wired to signal handlers. Wait on the DB connection (with bounded retries), register lifecycle hooks, start schedulers, fire-and-forget discovery registration, start the observer, log, done. Shutdown reverses in the opposite order and calls `process.exit(0)` after cleanup.

**Concrete example:** `repos/concept-db/src/index.ts` — covers the whole surface end to end.

Health endpoint at `GET /health` reports dependency status. Return 503 when the DB is disconnected; return 200 otherwise. Include discovery status in the response body for observability but don't let it fail the health check — discovery-vessel outages shouldn't cascade.

### Typed Config

`src/config.ts` exports a singleton `Config` loaded from env vars via small parsing helpers (`parseEnvInt`, `parseEnvBool`). Every block is explicitly typed; environment drift surfaces as a type error rather than a runtime surprise.

Blocks every vessel should have:

```ts
interface Config {
  port: number;
  host: string;

  // How the vessel authenticates outbound calls
  metabob: { apiKey: string };

  // Discovery-vessel client
  discovery: {
    enabled: boolean;
    endpoint: string;              // local substrate: http://127.0.0.1:8100 (host: http://localhost:18100); canary: discovery-vessel .svc.cluster.local
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

**Concrete example:** `repos/concept-db/src/config.ts` (pattern) and `repos/activity-api/src/config.ts` (full-feature, many shapes).

### Discovery client

Singleton class exposing `isEnabled()`, `register()`, `heartbeat()`, `deregister()`, `startHeartbeatManager()`, `stopHeartbeatManager()` and `shutdown()`. Registration retries with exponential backoff. `startHeartbeatManager()` opens a `setInterval` at `heartbeatIntervalMs` once registered; `shutdown()` stops it and deregisters via `DELETE /vessels/:vesselId` on discovery-vessel.

**Registration payload** — the shapes list is the filtered-safe set from invariant 2, and the resolver-contract fields tell callers how to invoke this vessel without per-vessel hardcoded knowledge:

```json
// local substrate (systemd unit; endpoint is the in-container 127.0.0.1 port):
{
  "vesselId": "<vessel>-local",
  "vesselName": "<vessel>",
  "version": "0.1.0",
  "endpoint": "http://127.0.0.1:<port>",
  "shapes": ["<advertised shapes with a dispatch case>"],
  "protocol": "http",
  "metadata": { "environment": "local", "podId": "<hostname>", "port": <port> },
  "resolve_endpoint": "/v2/impulses/resolve",
  "resolve_request_format": "pointer",
  "auth_scheme": "ApiKey",
  "resolve_timeout_ms": 30000
}
// downstream canary/production substitutes the .svc.cluster.local endpoint and a per-pod vesselId.
```

`metadata.environment` is derived, not configured: the client's `detectEnvironment()` helper reports `k8s-cluster` when `KUBERNETES_SERVICE_HOST` is set and `docker` when `DOCKER_CONTAINER` is set, otherwise `local`. The single-container substrate sets neither, so its vessels register as `local`. `metadata.port` is the vessel's own `config.port` (from `PORT`); the registered `endpoint` is a separate value — `getEndpoint()` returns `VESSEL_ENDPOINT` when the unit sets it, and otherwise builds a cluster-DNS URL — so keep the unit's `PORT` and `VESSEL_ENDPOINT` in step, as the substrate units that set both do.

Set `resolve_timeout_ms` from the vessel's own worst case, not from a habit: a resolver that does several sequential DB round-trips or an embedding call on a cold cache will exceed a 5–10s default and read to callers as a dead vessel.

**Auth:** `Authorization: ApiKey ${METABOB_API_KEY}`. Attach conditionally — if the env var is empty, log a warning and send unauthenticated (dev mode); production will reject and the warning tells you why.

**Concrete implementation:** `repos/concept-db/src/services/discovery-client.ts`, adapted from `repos/activity-api/src/services/discovery-client.ts`.

### Emitting an impulse (the CALLING side)

The section below describes how a vessel **serves** impulses. This one describes how a
vessel **sends** one — the half that was never written down, and the half a drafter must
get right to make anything durable.

**There is exactly one impulse endpoint in the fleet: `POST /v2/impulses/resolve`.** The
shape goes in the **body**, never in the path. Every impulse — read or write — is the same
call; a `*_write` shape is still a `resolve` POST.

```ts
const r = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
  body: JSON.stringify({ impulse: { pointer: { type: "<shape>_write", /* …shape fields… */ } } }),
  signal: AbortSignal.timeout(5_000),
});
if (!r.ok) console.warn(`[<vessel>] <shape> emit failed: HTTP ${r.status}`);
```

Four rules, each of which has been violated in a landed commit:

1. **The path is always `/v2/impulses/resolve`.** `/v2/impulses/<shape>` addresses no route
   and returns 404. A bare 404 from `/resolve` means *shape-not-served* by that host, not
   endpoint-missing — probe with a shape you know the host serves before concluding an
   endpoint is absent.
2. **The envelope is `{ impulse: { pointer: { type, … } } }`.** A flat body (`{id, category}`)
   is accepted by nothing. Some callers additionally set `impulse.type`; the `pointer.type`
   is the load-bearing one.
3. **Send it to the host that SERVES the shape**, resolved through discovery — not to
   whichever endpoint constant is nearest in the file. `substrateGap_write` is served by
   development-vessel, not by activity-api.
4. **`fetch` does not throw on HTTP errors.** A `try/catch` around it catches network
   failures and aborts only; a 404 or 500 resolves with `ok:false`. An emitter wrapped in a
   bare `catch {}` and no `!r.ok` branch fails **silently and forever**. Branch on `r.ok`.

**Why this is stated here rather than left to example-following.** The substrate authored,
gated, tested, landed and pushed two consecutive emitters that could never fire — first an
invented `exports.<x>.emit(...)` API, then a POST to `/v2/impulses/<shape>` — while four
correct call sites existed in the very file being edited. The information was present and
did not arrive at the moment of use. Deterministic gates in feature-compose now refuse both
classes, but a gate that refuses after the fact is a backstop; this section is the part that
is supposed to arrive first.

### Shape advertisement and dispatch

Two halves of one contract:

1. `config.discovery.shapes: string[]` declares what the vessel resolves.
2. `src/routes/impulses.ts` implements `POST /v2/impulses/resolve` with a `switch(pointer.type)` that maps each shape to a handler function in `src/resolvers/<shape>.ts`.

The route file is thin glue — no business logic. It:

- Parses `{pointer: {type, ...payload}}` from the request body
- Validates required fields per shape, accepting every key alias a caller might legitimately send — a handler that reads only one spelling of a field returns an empty result to callers using another, which reads as "no evidence" rather than as an error and can silently starve a whole family of goals
- Calls the resolver
- Returns `{content, metadata}` (string content for LLM injection, object metadata for the caller's reasoning)
- Returns 400 with a `supported_shapes` list for unknown types, 404 for not-found, 500 for resolver errors

**Concrete example:** `repos/concept-db/src/routes/impulses.ts`.

### Passive execution observer (optional)

Solves "how does my vessel learn from executions it wasn't called in?"

Connect to `${activityApi.url}/ws` (upgrade `http`→`ws`, `https`→`wss`). Send `{type: "authenticate", token: apiKey}` as the first message. Server responds `{type: "authenticated"}` or closes with code 1008. On reconnect, send `{type: "catchup", lastSeenSequence: n}` to replay missed events — the server reads that exact field name and returns only events with a sequence greater than it.

Events of interest:

- `task.completed` — carries `input_impulse_ids` and `output_impulse_ids`; scan for references to shapes this vessel owns, react locally
- `tool.call` — carries `tool_name`, `resolver_tier` (`deterministic` | `pattern` | `llm`), `latency_ms` and `cost_usd` for a single tool invocation
- `impulse.resolved` — one event per resolved impulse during trace ingestion, with the canonical fields flat on `data`

Reconnect with exponential backoff: start at 1s, cap at 30s, reset on clean open (`OBSERVER_RECONNECT_INITIAL_MS` / `OBSERVER_RECONNECT_MAX_MS`). Every handler is try/catch-wrapped; errors log and continue.

`task.completed.data` carries `input_impulse_ids: string[]` and `output_impulse_ids: string[]` — the per-task impulse arrays, always present and possibly empty. Treat them as identifiers, not as content: they tell you *which* impulses a task consumed and produced, and an observer that needs the impulse itself resolves it rather than expecting the payload on the frame.

**Concrete implementation:** `repos/concept-db/src/services/execution-observer.ts` plus `tests/execution-observer.test.ts`, whose unit tests cover request building, dedup, failure swallowing and the backoff schedule.

### Auth

`src/middleware/jwtAuth.ts` extracts either `Authorization: Bearer <jwt>` or `Authorization: ApiKey <key>`:

- **JWT**: validate via identity-vessel (primary) with a direct-SurrealDB ACCESS fallback. Claims include `{org_id, project_id, role, exp, iat}`; the default lifetime issued by identity-vessel is 900 seconds.
- **API key**: validate via identity-vessel. A validated key must carry a `keyId` — audit trails key on `api_key:${keyId}`, so a validation that succeeds without one is treated as a failure rather than passed through.

Hang the resulting `{orgId, keyId, authType, jwtToken}` context on the Hono request (the `jwtAuth` context key). All subsequent DB queries scope by the caller's org claim via SurrealDB `PERMISSIONS` clauses. No application-level filtering — the database enforces tenancy.

**Concrete example:** `repos/activity-api/src/middleware/jwtAuth.ts`.

### Internal lifecycle hooks

Own-CRUD events emit from `src/lifecycle/dispatcher.ts` (in-process EventEmitter). `src/lifecycle/hooks.ts` registers handlers. Purely intra-vessel — not for cross-vessel observation (use the WS observer for that).

Useful for: invalidating caches when records change, auto-linking related entities, audit logging. Handlers are async but `void`-returning; the emitter doesn't `await` them. Don't use hooks for anything that must complete synchronously.

**Concrete example:** `repos/concept-db/src/lifecycle/dispatcher.ts` + `hooks.ts`.

---

## Deployment wiring

> **Local development runs on the single-container substrate, not Helm.**
> Vessels run as **systemd units** inside the `substrate-live` docker container;
> there is no Kubernetes, no Istio, and no Helm in the local loop. Helm applies only
> to the **downstream** canary/production substrates. Mirror the framing in
> [`docs/SUBSTRATE.md`](../SUBSTRATE.md). When you build a new vessel,
> wire it as a substrate unit first — that is where you iterate.

### Primary path: register a new vessel as a substrate unit

Each local vessel is a `Type=simple` Bun process launched by a systemd unit under
`scripts/substrate/units/<vessel>.service`. The container maps each vessel's internal
port to a host port with an **18000 offset** (`18xxx → 8xxx`) — activity-api
`18080→8080`, development-vessel `18090→8090`, discovery-vessel `18100→8100`,
goal-host `18210→8210`, analysis-vessel `18250→8250`, concept-db `18260→8260`.
Internal vessel-to-vessel calls use `127.0.0.1:8xxx` directly inside the container;
you reach a vessel from the host at `http://localhost:18xxx`.

A minimal unit, copied from the real `scripts/substrate/units/analysis-vessel.service`
(the stateless-resolver exemplar — port 8250):

```ini
[Unit]
Description=analysis-vessel
After=discovery-vessel.service identity-vessel.service
Wants=discovery-vessel.service identity-vessel.service

[Service]
Type=simple
EnvironmentFile=/etc/substrate/env                       # shared substrate env (METABOB_API_KEY, ACTIVITY_API_URL, DISCOVERY_VESSEL_ENDPOINT, …)
Environment=PORT=8250
Environment=HOST=127.0.0.1
Environment=VESSEL_ID=analysis-vessel-local
Environment=VESSEL_ENDPOINT=http://127.0.0.1:8250
WorkingDirectory=/vessels/analysis-vessel
ExecStart=/root/.bun/bin/bun /vessels/analysis-vessel/src/index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Notes:

- **No secretKeyRef / no POD_NAME fieldRef.** Inside the container, `METABOB_API_KEY`
  comes from the shared `EnvironmentFile=/etc/substrate/env`, and `VESSEL_ID` is a
  fixed `<vessel>-local` literal (single replica — no per-pod ID needed).
- **`After=`/`Wants=` discovery-vessel + identity-vessel** is the unit-level analogue
  of the Helm `needs:` clause; it orders startup so discovery and auth are up first.
- **Only per-vessel values belong in the unit.** Peer endpoints are fleet-wide, so they
  live in `/etc/substrate/env` (written by `scripts/substrate/gen-env.sh`) rather than
  being repeated per unit. The vessel reads them from env — `DISCOVERY_VESSEL_ENDPOINT`,
  `ACTIVITY_API_URL`/`ACTIVITY_API_ENDPOINT` — defaulting to in-container localhost
  (`http://127.0.0.1:8100`, `http://127.0.0.1:8080`); see `repos/analysis-vessel/src/index.ts`
  for the `process.env.… ?? "http://127.0.0.1:…"` pattern.

To activate the new unit, add it to the `run-live` enabled-unit list and register
`vessel-ctl sync` / `vessel-ctl restart`, which ship in the image (mirror the
analysis-vessel block — `vessel-ctl sync <vessel>` mirrors the vessel's
in-container clone into `/vessels/<vessel>` and restarts the unit).
The iteration loop is then:

```bash
# edit repos/<vessel>/src/** → hot-reload into the running container → validate
docker exec <container> vessel-ctl sync <vessel>             # mirror the in-container clone + restart
curl -s http://localhost:18250/health | jq .         # vessel reachable on its host port
curl -s http://localhost:18080/v2/activities/templates  # validate against the substrate
```

Every unit restarts the same way, core or dynamic — activity-api,
identity-vessel, discovery-vessel and surrealdb included:
`docker exec <container> vessel-ctl restart <vessel>`.

### Downstream path: Helm wiring (canary / production only)

> Everything below applies to the **downstream** K8s substrates, not local work.

The chart and helmfile must plumb:

1. **`METABOB_API_KEY`** via `secretKeyRef` → `{{ .Values.apiKey.secretName }}` / `{{ .Values.apiKey.secretKey }}`. Default secret name: `<vessel>-api-keys`.
2. **`POD_NAME`** via `valueFrom.fieldRef.fieldPath: metadata.name` — feeds the vessel's `generateVesselId()` helper so each replica gets a stable ID.
3. **`DISCOVERY_ENABLED`**, **`DISCOVERY_VESSEL_ENDPOINT`**, and the heartbeat/retry envs matching `config.discovery`.
4. **`OBSERVER_ENABLED`** and the reconnect envs (if the vessel uses the observer).
5. **`needs:`** includes `activity-system/discovery-vessel` so helmfile orders the deploy correctly.

**Secret provisioning is intentionally out-of-tree.** The chart references the secret by name but doesn't create it. Steps to activate a new vessel:

1. Add a `<vessel>` block to `repos/deployment/scripts/generate-secrets.sh`
2. Edit the sops-encrypted canary secrets file (requires the Age key), adding `<vessel>.apiKey`
3. Register the key in the identity-vessel seed so activity-api accepts it
4. Either add `templates/secret.yaml` to the chart (mirroring an existing vessel chart) or create the secret imperatively in the `activity-system` namespace

Without these the pod starts but registration stays unauthenticated (and the Secret reference may block pod start entirely if absent).

**Concrete example:** `repos/deployment/charts/concept-db/` plus its release block in `helmfile.yaml.gotmpl`.

---

## Substrate identity resolution

A vessel must run identically wherever it is deployed, which means it cannot carry a map of where its peers live. The rule that follows is narrow: env supplies only bootstrap material — a credential, a port, an identity, and the endpoint of the one service that can name the others — and everything else is resolved at runtime. The subsections below give the pattern, its inverse, and the places in the tree that still violate it.

### The minimum-bootstrap-credential pattern

The bootstrap set is deliberately tiny: `METABOB_API_KEY` (the credential every vessel presents on outbound calls), `PORT`/`HOST`/`VESSEL_ID` (its own identity), and `DISCOVERY_VESSEL_ENDPOINT` (the one peer it is allowed to know by address). In the single-container substrate they arrive by two routes: the fleet-wide values (`METABOB_API_KEY`, `DISCOVERY_VESSEL_ENDPOINT`, peer endpoints) come from `/etc/substrate/env`, generated once per boot by `scripts/substrate/gen-env.sh` and shared by every unit through `EnvironmentFile=`; the per-vessel identity values (`PORT`, `HOST`, `VESSEL_ID`) come from `Environment=` lines in the vessel's own unit file, as in the unit shown above.

From there, routing is dynamic. **Discovery-vessel is the fixed point** — the vessel registers its own shapes with it and queries it to find whoever serves the shapes it needs, so no vessel holds an address for another vessel. Authentication is centralized the same way: identity-vessel is the single validator, and every vessel checks presented credentials against it rather than trusting its own copy of anything.

Config keys are bootstrap-only in the strict sense of the ontology: they are frozen at process start, invisible to traces and to the walk, and therefore unlearnable. Anything that steers *behaviour* must be a shaped impulse read at use time, never an env var — a flag the substrate cannot observe is a flag it can never grade.

### Anti-pattern: hardcoded peer endpoints

If a vessel has `http://activity-api.activity-system.svc.cluster.local:8080` or a public `https://identity.<domain>` as a default in source, that default will silently fail outside the Kubernetes cluster it was written for. Kubernetes-internal DNS names (`.svc.cluster.local`) are unreachable from the local substrate container; public hostnames are unreachable in air-gapped or offline environments. Worse, both *resolve syntactically* and fail only at request time, so the vessel starts clean and appears healthy while every outbound call it makes is dead.

The correct default, when the endpoint env var is unset, is the in-container loopback address of the peer (`http://127.0.0.1:8100` for discovery, `http://127.0.0.1:8080` for activity-api) or a loud startup failure — never a cluster DNS name inherited from someone else's deployment.

### Known gap

Several vessels retain hardcoded cluster-DNS or public-hostname defaults that pre-date this pattern:

- `repos/identity-vessel/src/services/trace.ts` — `.svc.cluster.local` activity-api default
- `repos/identity-vessel/src/services/jwt.ts` — public issuer default
- `repos/identity-vessel/src/services/keyGeneration.ts` — public issuer default
- `repos/identity-vessel/src/services/discovery-client.ts` — constructs `.svc.cluster.local` endpoints
- `repos/discovery-vessel/src/middleware/auth.ts` — public identity-vessel default

Each is overridden by an env var in the substrate container, so the system is held closed by env-var discipline rather than by the pattern itself — which is exactly the fragile arrangement the pattern exists to remove. New vessels MUST follow the pattern. These migrate as they undergo their next significant revision.

---

## What NOT to do

Each of the following has cost real debugging time, and they share a shape: the vessel starts, passes its health check, and is wrong in a way that only shows up later or elsewhere. Read them as failure modes to recognise, not merely as style rules.

### Don't register against activity-api's `/v2/vessels/register`

Deprecated, and served in proxy mode — it dual-writes to discovery-vessel and SurrealDB for backward compatibility, so it *appears* to work while leaving your vessel's registration owned by a path nobody maintains. Register with discovery-vessel directly.

### Don't gate registration behind an unprovisioned env var

Common failure mode: the vessel checks `if (process.env.JWT_TOKEN)` and silently disables registration when unset. The deployment doesn't plumb `JWT_TOKEN`, so the vessel never registers and nobody notices. Use the config-driven `discoveryClient.isEnabled()` pattern (checks `DISCOVERY_ENABLED`, default `true`), and surface missing auth via a warning at register time — not a silent disable at startup.

### Don't import across repo boundaries

`tsconfig.json` has `rootDir: ./src`. Imports from `../../../other-repo/src/*` violate it and produce TS6059. `bun build` ignores TS errors and will cheerfully bundle broken code — so run `bun run tsc --noEmit` and treat failures as blocking. If you need a type from another vessel, either duplicate it locally (small types) or extract a shared package under `packages/` (large contracts). Don't cross-import source trees.

### Don't put business logic in `routes/impulses.ts`

The route is dispatch glue. Resolvers live in `src/resolvers/<shape>.ts`, get unit-tested in isolation, and are reusable from MCP tools / CLI / internal callers. Mixing the two produces untestable route handlers and duplicated logic between routes and MCP tools.

### Don't build your own heartbeat against a deprecated endpoint

You will be tempted to "just copy" an older vessel's registration code. Check whether its registration target is discovery-vessel or activity-api's legacy path. If the latter, read this doc and `repos/activity-api/src/services/discovery-client.ts` before copying.

---

## Checklist for a new vessel

Before cutting the first release:

- [ ] `bun run tsc --noEmit` exits 0
- [ ] `bun test` green with unit tests covering each resolver in isolation
- [ ] `bun packages/shape-dispatch-check/check.ts repos/<vessel>/` exits 0
- [ ] `POST /v2/impulses/resolve` dispatches for every shape in `config.discovery.shapes`
- [ ] Unknown shapes return 400 with `supported_shapes` in the response body
- [ ] Startup is non-blocking when discovery-vessel is down (test by pointing `DISCOVERY_VESSEL_ENDPOINT` at a dead URL)
- [ ] Shutdown deregisters from discovery-vessel before exiting
- [ ] `/health` returns 503 only on DB failure, not on discovery failure
- [ ] WebSocket observer (if used) reconnects with backoff and never throws out of handlers
- [ ] **Substrate unit** at `scripts/substrate/units/<vessel>.service` (`After=`/`Wants=` discovery-vessel + identity-vessel; `EnvironmentFile=/etc/substrate/env`; fixed `PORT`/`VESSEL_ID`)
- [ ] **Host-port mapping** added to the fleet declaration (`docker-compose.yml` ports, and `run-live` in `scripts/substrate/Makefile`); vessel reachable at `http://localhost:18xxx/health`
- [ ] Validated against the local substrate (`http://localhost:18080`) via `docker exec <container> vessel-ctl restart <vessel>` + a confirming dispatch
- [ ] *(downstream only)* Helm chart mounts `METABOB_API_KEY` via `secretKeyRef` and `POD_NAME` via `fieldRef`; helmfile `needs:` includes `activity-system/discovery-vessel`; secret provisioning documented in the vessel's `CLAUDE.md` (no API keys in values.yaml)

---

## Related

- [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md) — the conceptual model, including discovery-vessel integration. Read first.
- [`RESOLVER_TRACKING.md`](RESOLVER_TRACKING.md) — per-impulse resolution tracking for learning.
- [`GOAL_EXECUTION_PATHS_SCHEMA.md`](GOAL_EXECUTION_PATHS_SCHEMA.md) — how a dispatched goal's path and reach verdict are recorded.
- [`../SUBSTRATE.md`](../SUBSTRATE.md) — bootstrapping and operating the single-container substrate your vessel runs in.
- [`../guides/CONCEPT_INTEGRATION_TEMPLATES.md`](../guides/CONCEPT_INTEGRATION_TEMPLATES.md) — example activity templates that consume a vessel's shapes.
- `packages/shape-dispatch-check/README.md` — the shape-dispatch checker's own contract and suppression syntax.
