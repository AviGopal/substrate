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

## Autonomous Development Loop

There is no developer in the loop. The container is a self-developing substrate.

```
minibob daemon (boredom loop)
  → Thompson-selects activity from activity-api recommendations
  → activity dispatches tasks to development-vessel resolvers:
      file_read    — read workspace source files
      file_write   — apply code modifications
      test_run     — bun test in the affected directory
      git_commit   — commit changes to /workspace
      systemd_restart — make the change live (deterministic resolver)
  → lifecycle:execution:succeeded fires on activity-api WS
  → development-vessel lifecycle observer sees it
  → harness-run-matrix fires automatically
  → failureModeReport impulse → activity-api AET → Thompson update
  → boredom loop wakes, Thompson now reflects the harness result
  → repeat
```

The workspace volume (`/workspace`) is the substrate's own instructional state — the
codebase it reads and modifies through its own execution. The human provides the initial
codebase at container start and observes via workbench. The human does not submit tasks,
run the harness, or restart units.

### Container invocation:

```bash
docker run -d \
  --name substrate \
  --cap-add SYS_ADMIN \
  -v /path/to/metabob-devbob:/workspace \   # the substrate's own body
  -v ./substrate-data:/data \               # Thompson state + traces
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -p 8080:8080 \
  -p 8100:8100 \
  metabob/substrate:dev
```

`~/.metabob/config.json` (on the host, for observation and harness runs):
```json
{
  "metabob": {
    "apiKey": "<seeded-on-first-start>",
    "endpoint": "http://localhost:8080"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

### The `systemd_restart` resolver (required):

When an activity modifies a vessel's source file and commits the change, the running
vessel still executes the old code. `systemd_restart` is a deterministic resolver in
development-vessel that calls `systemctl restart <unit_name>` and waits for the unit
to reach `active (running)`. Without this resolver the autonomous loop produces code
changes that never take effect.

The resolver is simple: no LLM, no Thompson input. It requires `--cap-add SYS_ADMIN`
(already required for systemd PID 1). It takes `{ unit: string }` as input and returns
`{ success: boolean, active: boolean, startup_ms: number }`.

The shape it owns: `systemd_unit_restart`. Development-vessel advertises it to
discovery-vessel; activities that modify vessel code include a final task dispatching
this shape.

### Canary relationship:

The canary cluster continues to exist as a separate substrate. `git push origin dev`
still deploys to canary. The two substrates are independent — different Thompson
posteriors, different trace histories. This is correct by design. The autonomous loop
inside the container eventually produces commits that propagate to canary via the normal
push path; at that point canary inherits the improved code but not the local Thompson
state.

### Thompson cold-start:

The container starts with no execution history. Recommendation quality is low initially
and improves as the boredom loop accumulates traces. The harness-as-lifecycle-participant
spec provides the measurement: `failureModeReport` impulses appear in activity-api,
`consecutive_zero_debt_cycles` advances, and the Thompson pool warms as activities
succeed and fail. No human needs to read these numbers for the loop to function.

## Relationship to `ias-executor-as-canonical-host`

The ias-executor spec establishes that there is one canonical executor per substrate
and vessels attach to it. In the single-container substrate, `minibob` running in
daemon mode IS the canonical executor. `development-vessel` attaches to it (via the
`GOAL_RUNTIME=ias-executor` gate already in minibob 0.14.11). The container is the
scope within which this single-executor invariant holds.

## Relationship to `harness-as-lifecycle-participant`

The harness-as-lifecycle-participant spec (2026-05-23) is downstream of this one. It
wires `harness-run-matrix` to fire automatically when `lifecycle:execution:succeeded`
arrives from a registry-modifying activity, and defines `failureModeReport` as an
impulse shape rather than a JSON file on disk.

Together the two specs close the autonomous loop:
- This spec: the container exists, all vessels run, the boredom loop executes activities
- Harness spec: measurement is automatic, results feed Thompson, no human runs the harness

Neither spec works without the other. The substrate without the lifecycle observer
is an executor without a measurement mechanism. The lifecycle observer without the
substrate has no localhost activity-api to subscribe to.

## What This Unblocks in the Main Loop

| Blocked item                               | Status under single-container substrate    |
|--------------------------------------------|--------------------------------------------|
| Phase 5 cutover (H1 + H5 prerequisites)   | Unnecessary: container is the trust boundary|
| Cross-vessel JWT handshake                 | Unnecessary: localhost, no boundary         |
| H2 vessel identity                         | Unnecessary: we started every process       |
| Autonomous development loop                | Unblocked: boredom loop + lifecycle observer|
| Failure-mode harness cycles                | Unblocked: fires from lifecycle events      |
| development-vessel autonomous code changes | Unblocked: systemd_restart closes the loop  |

The container does not bypass the need for H1/H2/handshake in production or in any
multi-substrate topology. It creates a safe development context where those properties
are guaranteed by the container boundary rather than by cryptographic protocol.
