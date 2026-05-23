# Local Single-Container Substrate

**Phase 26 deliverable.** This document describes how to build, run, and iterate against the local substrate — the full vessel fleet collapsed into a single systemd-managed Docker container.

**Phase 26 complete (2026-05-23).** The substrate is implemented and verified — 36+ traces stored, boredom loop active, `systemd_restart` confirmed, `minibob --single` producing visible traces.

## Why a single container?

The canary cluster (Phase 5+) requires H1 two-sided traces and cross-vessel auth hardening before it can be a safe primary development environment. A container gives a structurally equivalent trust boundary without the Kubernetes overhead: all inter-vessel calls are localhost, SurrealDB runs as a local file instance, and a `systemd-restart` is the equivalent of a helm rollout.

A container is a valid substrate. The foundation doc defines a substrate by its fixed point (discovery-vessel) and its trust boundary, not by its infrastructure form. The same vessel code, the same seed templates, the same Thompson learning — just no pod scheduling.

## Quick start (4 steps)

```bash
# 1. Build the substrate image
make -C scripts/substrate substrate-build

# 2. Run it (all 7 vessels as systemd units, host ports 18080/18090/18100/18200)
make -C scripts/substrate substrate-run

# 3. Seed identity (creates org+user+API key; prints the key)
docker exec substrate-live bun /vessels/seed-identity.ts
# → [seed-identity] issued API key: mb-b3Jn...

# 4. Configure your local tooling to point at it
scripts/substrate/configure-local.sh
```

After step 4, `~/.metabob/config.json` points to `http://localhost:18080` and all validation harnesses use it automatically.

**Note on ports**: The container maps internal ports to host ports with an 18000 offset — activity-api is at `localhost:18080`, discovery-vessel at `localhost:18100`, etc. Internal vessel-to-vessel calls use `127.0.0.1:808x` directly inside the container.

**Running CLI commands inside the container**: always source the env file with auto-export so child processes (Bun) inherit the variables:
```bash
docker exec substrate-live bash -c 'set -a; source /etc/substrate/env; set +a; cd /vessels/development-vessel && bun run cli seed-templates'
```
Plain `source /etc/substrate/env` sets shell variables only — child processes won't see them. `set -a` auto-exports everything that follows.

## Iteration loop

When you change a vessel's source:

```bash
# Edit the vessel
vim repos/metabob-activity-api/src/routes/activities.ts

# Restart just that unit — no container restart, no rebuild
make -C scripts/substrate substrate-restart-activity-api

# Verify
curl http://localhost:8080/health
```

Units available for restart:
- `substrate-restart-surrealdb`
- `substrate-restart-identity-vessel`
- `substrate-restart-discovery-vessel`
- `substrate-restart-activity-api`
- `substrate-restart-development-vessel`
- `substrate-restart-minibob`

## Validating after a change

```bash
# Failure-mode harness smoke test
bun run validation/scripts/failure-mode-harness.ts

# Full stratified harness (longer; run before canary promotion)
bun run validation/scripts/stratified-harness.ts

# Single MiniBob goal to produce a trace
minibob --single "list files in current directory"

# Check the trace appeared
curl -s "http://localhost:8080/v2/activities/execution-traces?limit=1" | jq .
```

## Monitoring

```bash
# All unit statuses
make -C scripts/substrate substrate-status

# Follow a vessel's logs
make -C scripts/substrate substrate-logs-activity-api

# Shell into the container
make -C scripts/substrate substrate-shell
```

## Backing up and restoring learning state

The SurrealDB data volume (`/data/` inside the container) holds all execution traces, Thompson posteriors, and template registry. Back it up before destructive operations:

```bash
# Backup
docker cp substrate:/data ./substrate-data-backup-$(date +%Y%m%d)

# Restore
docker cp ./substrate-data-backup-YYYYMMDD/. substrate:/data
make -C scripts/substrate substrate-restart-surrealdb
```

## Switching between local and canary

Change one line in `~/.metabob/config.json`:

```json
{
  "metabob": {
    "endpoint": "http://localhost:8080"     ← local substrate
    // "endpoint": "https://activity.metabob.com"  ← canary
  }
}
```

All harnesses and `minibob` CLI read this file. No code changes needed.

## Promoting to canary

Once a change validates locally:

```bash
git add repos/<vessel>
git commit -m "feat(<vessel>): <description>"
git push origin dev          # CI/CD deploys to canary automatically
```

Then use `/deploy <vessel>` to promote canary → production after canary health checks pass.

## Development-vessel specifics

`development-vessel` is substrate-only — it has no Helm chart and does not run on canary. It is the meta-vessel for substrate self-development: the failure-mode harness, topology-discovery activities, `coverage-tick`, and `substrate-health-tick` all run as activities inside it. The `development-vessel.service` unit runs `seed-templates` automatically via `ExecStartPost` on every start — seeds are idempotent UPSERTs so re-running is safe.

The topology-discovery loop (Phase 26 → Phase 27) runs autonomously inside the substrate:

```
activityRegistryChange → learned-topology-snapshot → reachable-unlearned-report
                       → probe-reachable-unlearned → activityRegistryChange → …
```

Lift = coverage progress + substrate health + operator hand-over. Coverage progress is measured by three consecutive `coverageReport` impulses showing `coverage_progress=true` from natural activity (no human trigger) — this is the cell-count progress proxy for Convergence (foundation §33). Substrate health is measured by the most recent `substrateHealthReport` showing `health_verdict.overall_passing=true` (posterior confidence + graph stability + optimality where available). The hand-over itself is the operator writing `validation/state/lift-status.json` with `status: "confirmed"` — the substrate does not write this file from inside its own loop. All three components are required for IAL Phase 27 lift.

## Troubleshooting

**Units not starting within 60s**: check `make substrate-logs-<unit>` for the failing unit. Most common cause: port conflict (SurrealDB 8000, activity-api 8080) with a pre-existing process.

**API key needed but lost**: if you ran `seed-identity.ts` but forgot the key, re-read it from the container env file: `docker exec substrate-live grep METABOB_API_KEY /etc/substrate/env`. Then re-run `configure-local.sh` to update your local config.

**Harness connection errors**: confirm `~/.metabob/config.json` points to `http://localhost:18080`, not the canary endpoint. Run `scripts/substrate/configure-local.sh` to reset.

**`make substrate-restart-<vessel>` fails**: the container must be running (`make substrate-run` first). Units restart in-place; the container itself is not restarted.

**`minibob --single` connects to canary instead of local**: three env vars must be set to point at the local substrate. `configure-local.sh` sets them in `~/.metabob/config.json`. Inside the container, the systemd unit reads them from `/etc/substrate/env` — the required variables are `METABOB_API_KEY`, `ACTIVITY_API_ENDPOINT=http://127.0.0.1:8080`, and `IDENTITY_ENDPOINT=http://127.0.0.1:8101`. If you rebuilt the container without pulling the latest gen-env.sh, run `docker exec substrate-live bash /scripts/substrate/gen-env.sh` to regenerate the env file.
