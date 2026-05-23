# Single-Container Substrate

## Context

The cross-substrate trust blockers (vessel-session-handshake, H1 two-sided traces,
H2 pubkey-derived vessel identity) are prerequisites for safe cross-boundary operation
but require multi-month implementation. Meanwhile, external constraints require
switching primary development from the canary cluster to a local environment.

This spec collapses the entire vessel fleet into one container trust boundary. Within
a single container all vessels communicate over localhost — there is no boundary to
cross, so H1/H2/session-handshake become irrelevant to the development path. This is
not a workaround. A substrate is defined by its fixed point (discovery-vessel) and its
trust boundary. A container is a valid trust boundary. One container is one substrate.

When the cross-substrate blockers eventually land they extend the trust model outward
from this container boundary without requiring changes to anything inside it.

## Substrate Model

Within the container:

```
Instructional state  →  Container image (vessel code + SurrealDB binary + Valkey)
Process-of-becoming  →  Running systemd units executing activities + accumulating traces
Functional state     →  Mounted volume (SurrealDB data = Thompson posteriors + traces)
```

Different containers with different volumes are different substrates. Carrying a volume
from one host to another carries the substrate's learned state. The image is the
reproducible instructional layer; the volume is the history.

## Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│  systemd (PID 1)                                        │
│                                                         │
│  infrastructure                                         │
│    surrealdb.service     :8000  ←── /data/surrealdb/   │
│    valkey.service        :6379                          │
│                                                         │
│  fixed point                                            │
│    discovery-vessel      :8100                          │
│                                                         │
│  auth                                                   │
│    identity-vessel       :8101                          │
│                                                         │
│  learning backend                                       │
│    activity-api          :8080  ←── METABOB_ENDPOINT    │
│                                                         │
│  execution                                              │
│    minibob               :8200  (daemon mode)           │
│    development-vessel    :8090                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
         │               │
     :8080 (api)     :8100 (discovery, debug)
```

All inter-vessel calls are `http://localhost:<port>`. No TLS, no service mesh, no
Istio. The container surface is the trust boundary; nothing outside can reach internal
ports unless explicitly published.

## Port Assignment

| Service            | Internal port | Rationale                                  |
|--------------------|---------------|--------------------------------------------|
| SurrealDB          | 8000          | SurrealDB default; not exposed externally  |
| Valkey             | 6379          | Redis standard; not exposed externally     |
| discovery-vessel   | 8100          | Fixed point; override from default 8080    |
| identity-vessel    | 8101          | Auth tier; override from default 8080      |
| activity-api       | 8080          | Main substrate API; exposed externally     |
| minibob            | 8200          | Execution vessel; override from default    |
| development-vessel | 8090          | Already uses 8090 by default               |

External publish (at `docker run`):
- `-p 8080:8080` — activity-api, required for `~/.metabob/config.json` endpoint
- `-p 8100:8100` — discovery-vessel, optional for debugging registry state
- `-p 8200:8200` — minibob HTTP API, optional for direct goal invocation

## Startup Ordering

Systemd dependency graph enforces safe startup regardless of process speed:

```
surrealdb.service ──────┐
                        ├──→ identity-vessel.service ──┐
valkey.service ─────────┘                              ├──→ activity-api.service ──┐
                                                       │                           ├──→ minibob.service
discovery-vessel.service ──────────────────────────────┘                           └──→ development-vessel.service
```

Activity-api runs `init-database.ts` as `ExecStartPre` — this applies all SurrealDB
migrations idempotently (migration tracking table prevents re-runs). Identity-vessel
seeds the initial API key pair on first start if the `api_key` table is empty.

The shared `JWT_SECRET` is a single value injected at container start time via an
environment file mounted at `/etc/substrate/env`. All vessels read it from there.

## Volume Contract

One volume mount covers all persistent state:

```
/data/
  surrealdb/        ← SurrealDB RocksDB files (Thompson posteriors, traces, templates)
  valkey/           ← Valkey AOF / RDB snapshot (impulse relevance cache)
```

Backing up the substrate = tarball of `/data/`. Migrating learning state between
substrates = copy `/data/surrealdb/` to the target container's volume.

## Security Model (Why the Blockers Don't Apply)

H1 (two-sided traces) protects against a vessel lying about what it executed in order
to corrupt Thompson posteriors of other vessels. Within a single container every process
is under the same operator control — the attack surface H1 guards against does not exist.

H2 (pubkey-derived vessel identity) prevents registration spoofing at discovery-vessel.
Inside the container, only the vessel processes we started can reach the discovery-vessel
port. Spoofing is not a threat.

Vessel-session-handshake replaces `X-Internal-Api-Key` with cryptographic validation
for cross-vessel calls. Inside the container `X-Internal-Api-Key` is safe: the only
callers are the processes we started on localhost.

When H1/H2/handshake eventually land, they extend the trust model to the container
boundary and beyond. Nothing inside the container changes.

## Development Flow Impact

### Primary loop (replaces "push to canary, validate"):

```
1. Edit vessel source in repos/<vessel>/
2. Restart that vessel's systemd unit inside the running container
   → docker exec substrate systemctl restart activity-api
3. Validate immediately against localhost:8080
4. Thompson accumulates locally from each execution
```

For source volume mounting (recommended for active development):

```bash
docker run \
  -v ./repos/metabob-activity-api:/app/activity-api \
  -v ./repos/minibob:/app/minibob \
  -v ./repos/development-vessel:/app/development-vessel \
  -v ./substrate-data:/data \
  -p 8080:8080 \
  metabob/substrate:dev
```

With source volumes, editing a file and restarting the unit reflects the change without
rebuilding the image. Bun restarts in under 2 seconds.

### ~/.metabob/config.json for local substrate:

```json
{
  "metabob": {
    "apiKey": "<seeded-local-key>",
    "endpoint": "http://localhost:8080"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

All harness scripts (reuse, stratified, failure-mode) read this config and require no
other change. The canary substrate and local substrate coexist — switching is changing
one line in config.json.

### Canary relationship:

The canary cluster remains the CI/CD target. `git push origin dev` still deploys to
canary. The two substrates are independent: different Thompson posteriors, different
trace histories. This is correct by design — each substrate learns from its own
executions. The local substrate builds its own learning state from development activity.

### Thompson cold-start:

The local substrate starts with no execution history. Recommendation quality is low
initially. The development activity itself (running harnesses, executing goals via
minibob, seeding templates) accumulates the posteriors. The stratified harness provides
a concrete measurement of when quality is sufficient.

## Relationship to `ias-executor-as-canonical-host`

The ias-executor spec establishes that there is one canonical executor per substrate
and vessels attach to it. In the single-container substrate, `minibob` running in
daemon mode IS the canonical executor. `development-vessel` attaches to it (via the
`GOAL_RUNTIME=ias-executor` gate already in minibob 0.14.11). The container is the
scope within which this single-executor invariant holds.

## What This Unblocks in the Main Loop

| Blocked item                               | Status under single-container substrate    |
|--------------------------------------------|--------------------------------------------|
| Phase 5 cutover (H1 + H5 prerequisites)   | Unnecessary: container is the trust boundary|
| Cross-vessel JWT handshake                 | Unnecessary: localhost, no boundary         |
| H2 vessel identity                         | Unnecessary: we started every process       |
| Active local development                   | Unblocked immediately on container health   |
| Failure-mode harness cycles                | Unblocked: point METABOB_ENDPOINT to :8080  |
| development-vessel autonomous loop         | Unblocked: runs inside the container        |

The container does not bypass the need for H1/H2/handshake in production or in any
multi-substrate topology. It creates a safe development context where those properties
are guaranteed by the container boundary rather than by cryptographic protocol.
