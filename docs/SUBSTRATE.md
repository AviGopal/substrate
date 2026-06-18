# Local Single-Container Substrate

**Phase 26 deliverable.** This document describes how to build, run, and iterate against the local substrate — the full vessel fleet collapsed into a single systemd-managed Docker container.

**Phase 26 complete (2026-05-23).** The substrate is implemented and verified — 36+ traces stored, boredom loop active, `systemd_restart` confirmed, `minibob --single` producing visible traces.

**S1→S2 lift completed (2026-05-26).** The operator approved the IAL S1→S2 transition (commits `07453944 feat(lift): approve IAL S1→S2 transition`, `4c60b0a1 chore(operator): authorize S2 lift 2026-05-26`). The substrate is now in S2 — substrate-authored, supervised. The active direction is S2→S3.

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

# Single goal to produce a trace (deprecated — agents dispatch via the
# metabob-mcp `mcp__metabob__run_goal` tool; the minibob CLI is being retired)
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

> **Suspended (2026-05-23):** kubectl/Helm deployment and the `/deploy` skill are suspended for economic reasons. All development runs against the local substrate container; the canary→production path above is retained for when cloud deployment resumes.

## Development-vessel specifics

`development-vessel` is substrate-only — it has no Helm chart and does not run on canary. It is the meta-vessel for substrate self-development: the failure-mode harness, topology-discovery activities, `coverage-tick`, and `substrate-health-tick` all run as activities inside it. The `development-vessel.service` unit runs `seed-templates` automatically via `ExecStartPost` on every start — seeds are idempotent UPSERTs so re-running is safe.

**goal-host-vessel async dispatch (commit `ac0d75b5`).** `POST /run-goal` now returns HTTP 202 immediately; goal execution happens asynchronously. Callers (minibob CLI and boredom-vessel) must poll for execution status rather than waiting for a synchronous response. This means a 202 from `/run-goal` does not indicate goal success — check the execution trace in activity-api to confirm completion.

The topology-discovery loop (Phase 26 → Phase 27) runs autonomously inside the substrate. In S2 the boredom-vessel rotates through the following goals (timer: 30min):

1. `substrate-health-tick` — measurement
2. `probe-reachable-unlearned` — probing newly-reachable but unlearned activities
3. `probe-untraversed-edge` — probing untraversed composition edges
4. health goal
5. escalation goal
6. coverage goal
7. `draft-gap-closing-activity` — substrate authors a new activity to close an identified gap

The prior 5-minute timer was slowed to 30 minutes (commit `536652a4`) to enable the temporal spread required for the S.4a measurement window.

```
activityRegistryChange → learned-topology-snapshot → reachable-unlearned-report
                       → probe-reachable-unlearned → activityRegistryChange → …
                       → draft-gap-closing-activity → new template in registry
```

**S1 → S2 completed 2026-05-26.** The lift criteria (coverage progress + substrate health + operator hand-over) were met and the operator authorised the transition. The substrate now authors its own activities via the `draft-gap-closing-activity` goal and the `propose-spec` / `verify-merge-candidate` pipeline.

**S2 → S3 is the active direction.** S3 (distributed-stable, adversarial-resistant, operator non-load-bearing) is tracked in the post-lift agenda and S3 readiness criteria (measured by active push-away: substrate refusing operator interventions with cited evidence, not by passive intervention-absence). S3 has no operational gate in this document — it is emergent and operator-measured under sustained adversarial exposure.

**Measuring S2→S3 readiness.** S2→S3 readiness is observable through two shape families owned by development-vessel:

- `operatorIntervention` — emitted when the substrate detects operator action against substrate state. Carries `classification` (`intervention | maintenance | redundant`), `target`, `rationale`, and supporting evidence. The operator can emit these explicitly; development-vessel also detects them by watching commits, lifecycle overrides, and direct file mutations.
- `interventionRefused` — emitted by substrate gates (promote-guard, template-sanitizer, etc.) when they reject an operator action with cited rationale and supporting evidence.
- `interventionRateReport` — periodic aggregation of intervention and refusal rates. A trend toward zero under adversarial exposure is the S2→S3 signal.

The substrate cannot self-declare S3. Only the operator can observe sustained push-away and make that judgment. These shapes give the operator the data to do so.

**Lift-criterion hardening — external anchors and stall detection.** Two risks threaten the lift criterion's load-bearing character. First, **measurement gaming**: a substrate that optimises whatever the criterion measures can satisfy `coverage_progress` with trivial goals and satisfy `confidence_passing` by repetition. The structural defense is external anchors the substrate cannot author or modify — a held-out evaluation set (`heldOutEvalReport`), CI agreement between the substrate harness and an independent runner (`ciAgreementReport`), and adversarial probes introduced by the operator that the substrate must handle without degrading. Second, **stall undetectability**: the topology-discovery chain produces flat signals both when the substrate has genuinely converged AND when a chain link has silently failed. The defense is a `chainStallReport` shape that fires when the chain produces zero progress signals for more than a configurable window without any external explanation (for example, no new shapes were registered, no new traces appeared). Stall is distinguishable from convergence only when the substrate can explain the absence of progress.

## Event bus

All lifecycle events — task binding, execution completion, gap classification, LLM dispatch — flow on the activity-api WebSocket broadcaster (`wss://localhost:18081/ws`) in addition to any in-process eventSink. Discovery-vessel emits four additional event types on the same bus: `vessel.registered`, `vessel.heartbeat`, `vessel.deregistered`, and `vessel.expired`. Any vessel subscribing to the bus receives all of these without any per-emitter configuration.

This has a practical consequence for vessel startup: goal-host-vessel subscribes to `vessel.registered` and uses those events to reactively register proxy resolvers for newly-appearing vessels. This replaces the race-prone one-shot registration that happened once at startup — a vessel that starts after goal-host-vessel now gets picked up automatically rather than being invisible until the next restart cycle.

## Vessel self-replacement

Vessels that accumulate idiom-purity gaps are candidates for substrate-driven self-replacement. Purity gaps include: serving legacy REST endpoints alongside the resolver contract, implementing built-in tools (bash, read, write, git) instead of routing through discovery-resolved ones, or maintaining internal state that belongs in the substrate's shared store. The substrate audits purity against the canonical idiom set, mints a replacement vessel via the forge, validates the replacement in shadow against live traffic, and promotes it on evidence. The original vessel is archived rather than modified in-place.

The two vessels with known purity gaps at this writing are `metabob-activity-api` (20+ legacy REST endpoints that predate the resolver contract) and `minibob` (built-in bash/read/write/edit/git tools that bypass discovery). Self-replacement for these is substrate-driven and not operator-led — the operator's role is adversarial testing of the replacement, not authoring it.

## Closure properties

Lift requires not just what the substrate does autonomously, but what it does NOT depend on. Seven external stateful dependencies are the formal closure gaps — services and state structurally outside the substrate that currently load-bear on lift properties:

1. **Operator memory** (`~/.claude/.../memory/`) — cross-session recall that the substrate has no equivalent surface for. Replacement: `memoryNote` shapes owned by development-vessel, mirrored to the cache via `memory-sync-tick`.
2. **Slash-command skills** (`/openspec-propose`, `/review`, `/deploy`, etc.) — stateful workflows bound to the Claude Code harness. Replacement: substrate-resident activity equivalents (`propose-spec`, `verify-merge-candidate`, `apply-spec`).
3. **Subagent dispatch** (Plan, Explore, general-purpose) — research and multi-step work via operator-side invocation. Replacement: substrate activity dispatch with goal decomposition resolvers.
4. **GitHub Actions CI** — merge gates and canary deploy triggers in GitHub infrastructure. Replacement: substrate harness as the merge-authority gate; substrate-resident CI criterion (`ciAgreementReport`).
5. **Operator shell access** (`kubectl`, `helmfile`, `docker exec`) — operational commands outside the substrate's activity system. Replacement: substrate-dispatched restart and restore activities (`restart-vessel`, `restore-data`).
6. **Operator spec-authoring** — new specs are currently authored by the operator. Replacement: substrate-authored proposals via `propose-spec` / `verify-merge-candidate` pipeline with operator as reviewer.
7. **Operator git access** — commits, PRs, and merges require operator git credentials. Replacement: substrate-resident git authorship, PR opening, and merging gated by the CI-closure verdict.

Closure is measured by a substrate-resident closure-audit script that tests each `(property, external_tool)` pair against substrate-only resolvers and returns a verdict. Three consecutive nightly green closure-audit runs are a hard lift gate.

## Forge vessel (parallel variant exploration)

The substrate forge vessel enables parallel variant exploration at the substrate level. Instead of evaluating candidate changes serially — author → deploy → measure → decide — the forge spawns N ephemeral substrate clones, each pursuing a different candidate change, observes N outcomes in parallel, and promotes the winner via Thompson. Variant exploration moves from O(N × deploy_time) to O(1 × deploy_time + N × measurement_time).

Combined with the substrate's existing Thompson-managed candidate selection, this turns post-lift development into autonomous A/B testing at the substrate level. A fork is not a privileged substrate twin — it is a substrate-resident vessel set whose discovery advertisements are scoped to a fork namespace. Fork outcomes feed the main substrate's posteriors; the fork is archived afterward.

## Substrate self-deployment

The substrate closes the deployment loop via substrate-resident git authorship. Substrate-authored changes — proposals verified by the forge, approved by the CI-closure criterion — are committed, PR'd, and merged by the substrate itself, not by the operator. The operator retains an unforeseeable-failure override (closing a PR manually, force-merging an emergency fix), but this is an exceptional path rather than the normal one. Self-deployment is what makes the substrate honestly self-maintaining: it can author, verify, deploy, and observe its own changes without operator git access being on the critical path.

## Vessel federation (inter-substrate routing)

Federation is the mechanism by which two substrate containers know about each other's vessels. Each substrate's discovery-vessel can peer with another discovery-vessel; peer registrations propagate into the local registry as `provisional` entries. From the perspective of any vessel above discovery, the routing is invisible — they call `POST /resolve` and receive a vessel record, whether that vessel lives in the same container or a peer container.

Vessel identity in a federated topology is derived from a public key (`vessel_id = multihash(pubkey)`), enabling cross-substrate verification without a shared trust root. A vessel that migrates from one substrate to another retains its identity; peer substrates can verify it independently. Federation is not yet active in the local single-container substrate — the peering mechanism and identity-by-pubkey are forward infrastructure for the S2→S3 distributed-stable phase.

## Troubleshooting

**Units not starting within 60s**: check `make substrate-logs-<unit>` for the failing unit. Most common cause: port conflict (SurrealDB 8000, activity-api 8080) with a pre-existing process.

**API key needed but lost**: if you ran `seed-identity.ts` but forgot the key, re-read it from the container env file: `docker exec substrate-live grep METABOB_API_KEY /etc/substrate/env`. Then re-run `configure-local.sh` to update your local config.

**Harness connection errors**: confirm `~/.metabob/config.json` points to `http://localhost:18080`, not the canary endpoint. Run `scripts/substrate/configure-local.sh` to reset.

**`make substrate-restart-<vessel>` fails**: the container must be running (`make substrate-run` first). Units restart in-place; the container itself is not restarted.

**`minibob --single` connects to canary instead of local**: three env vars must be set to point at the local substrate. `configure-local.sh` sets them in `~/.metabob/config.json`. Inside the container, the systemd unit reads them from `/etc/substrate/env` — the required variables are `METABOB_API_KEY`, `ACTIVITY_API_ENDPOINT=http://127.0.0.1:8080`, and `IDENTITY_ENDPOINT=http://127.0.0.1:8101`. If you rebuilt the container without pulling the latest gen-env.sh, run `docker exec substrate-live bash /scripts/substrate/gen-env.sh` to regenerate the env file.
