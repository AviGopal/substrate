# Local Single-Container Substrate

This document describes how to build, run, and iterate against the local substrate — the full vessel fleet collapsed into a single systemd-managed Docker container.

## Why a single container?

A container gives a complete trust boundary without cluster overhead: all inter-vessel calls are localhost, SurrealDB runs as a local file instance, and a `systemctl restart` is the whole rollout. Multi-machine reach comes from running more containers (hub/spoke roles + the libp2p relay), not from an orchestrator.

A container is a valid substrate. The foundation doc defines a substrate by its fixed point (discovery-vessel) and its trust boundary, not by its infrastructure form. The same vessel code, the same seed templates, the same Thompson learning — just no pod scheduling.

## One image, any subset

The substrate has generalized from "one local container" to **one image that runs any subset of the fleet, deployable anywhere, and federatable**. The single image bakes every vessel; a declarative inventory selects which units run at boot, so the same image is a full local substrate, a minimal hub, or a compute-only spoke depending only on environment.

### Topology selection

`scripts/substrate/vessels.inventory.json` is the declarative vessel inventory: every baked-in unit maps to a **role** (`store`, `control`, `api`, `compute`, `ui`, `transport`, `seed`, `infra`, `autonomy`), and role-**group** aliases compose those into deployable shapes:

- `hub` = `store`, `control`, `api`, `transport`, `seed`, `infra` (control plane + store + relay)
- `spoke` = `compute`, `ui`, `seed`, `infra` (compute-only; points its control/store at a hub)
- `full` = every role (the default local substrate)

`scripts/substrate/apply-inventory.sh` reads the inventory at boot — run by the container entrypoint *after* `gen-env` and *before* `exec systemd` — and `systemctl disable`s the unwanted units (it just removes the `*.wants` symlinks the image baked in). Selection env, highest precedence first:

- `ENABLED_VESSELS=unit,unit` — explicit exact-unit allow-list; overrides roles
- `ENABLED_ROLES=role,role` — roles/role-groups to keep (`hub`/`spoke`/`full` expand via `inventory.roles`); everything else is disabled
- `DISABLED_VESSELS=unit,unit` — always off, even if selected above

**Default (none of the three set) = every unit enabled = the full local substrate, identical to today** (`apply-inventory.sh` is a no-op). Manifest-installed dynamic vessels (`"manifest": true`, i.e. the federation units) are never baked-enabled, so they are never touched here — they are installed on demand (see [Dynamic vessels](#dynamic-vessels)).

## Launch: two canonical paths

The same artifact runs either way — one image
(`ghcr.io/avigopal/substrate:dev`, the canonical registry), one container
(`substrate-live`), one required secret (an LLM key). **Container** (root-level
compose) is the checkout-free path: a pulled image plus one env var. **Source**
(`make up`) is the everyday development path: a checkout with submodules, one
command, operator tooling auto-pointed. The image is published to GHCR by CI on
every push to `dev`; it is **private** (it bakes vessel source), so pulling it
needs `docker login ghcr.io` with a token that has `read:packages` scope. A
Docker Hub `avigopal/substrate:dev` mirror may exist, but GHCR is the repo.

### Source path — `make up`

From the repo root, initialise submodules, then build and run:

```bash
git submodule update --init --recursive
make -C scripts/substrate up ANTHROPIC_API_KEY=sk-ant-...
```

Prereqs: Docker (privileged-capable, x86_64), GNU make, git, bun, jq, curl.

**Submodule credentials (HTTPS by default, SSH optional).** `.gitmodules` uses
HTTPS remotes (`https://github.com/AviGopal/<vessel>.git`), which work for public
repos and for token auth. The vessel repos may be private and then need a
credential — supply it **without editing `.gitmodules`** via a global rewrite:

```bash
# SSH-key user — rewrite HTTPS to SSH transparently
git config --global url."git@github.com:".insteadOf "https://github.com/"

# token user — inject a PAT into the HTTPS URL
git config --global url."https://<token>@github.com/".insteadOf "https://github.com/"
```

The scheme then adapts to whatever credentials the human has.

`up` builds the image **only if none exists**, starts (or creates)
`substrate-live`, waits up to 240s on the fleet readiness matrix (best-effort —
on timeout it still proceeds and lets the doctor report what failed), and runs
the doctor. **No other host step is load-bearing**: identity seeding runs
in-container (`identity-seeder.service`,
idempotent, restarts key consumers only when a key is actually minted),
readiness is a systemd fact (`substrate-ready.service`) surfaced to the host via
the image `HEALTHCHECK` (`docker inspect --format '{{.State.Health.Status}}'`),
and diagnosis is in-container too (`docker exec substrate-live substrate-doctor`).

> **`up` never rebuilds from source on its own.** It builds only when no image
> exists, and reuses an already-running `substrate-live` as-is. After editing
> vessel source, rebuild explicitly (`make -C scripts/substrate build`, or
> `up REBUILD=1`) *and* recreate the container so the fresh image is actually
> booted (`docker rm -f substrate-live` then `up`) — for a single vessel prefer
> the hot-reload `restart-<vessel>` targets under **Iteration loop**.

### Container path — root-level compose

No make, no submodules. A root-level `docker-compose.yml` is canonical
(`scripts/substrate/docker-compose.yml` is a symlink to it), so the whole path is
a few commands **from the repo root**:

```bash
cp scripts/substrate/.env.example .env      # set ANTHROPIC_API_KEY
docker login ghcr.io                        # token with read:packages (private image)
docker compose up -d                        # root compose is canonical
docker exec substrate-live substrate-key show   # read the operator API key
```

`docker compose` pulls `ghcr.io/avigopal/substrate:dev`, mounts the two named
volumes, and publishes the host-mapped ports. Wait for
`docker inspect --format '{{.State.Health.Status}}' substrate-live` to report
`healthy` before reading the key; `substrate-key` is baked into the image at
`/usr/local/bin/substrate-key`, so no checkout is needed.

The equivalent raw invocation on **any** docker host (after `docker login
ghcr.io`):

```bash
docker run -d --privileged --name substrate-live \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -p 18080:8080 -p 18090:8090 -p 18100:8100 -p 18101:8101 -p 18210:8210 \
  -p 18250:8250 -p 18260:8260 -p 18270:8270 \
  --tmpfs /run --tmpfs /run/lock ghcr.io/avigopal/substrate:dev
```

### Container config matrix

The image is published to GHCR as `ghcr.io/avigopal/substrate:dev` (fleet only;
Obsidian runs as a host peer) and `ghcr.io/avigopal/substrate:obsidian` (fleet +
in-container Obsidian over noVNC). The image is private, so a pull needs `docker
login ghcr.io` with a `read:packages` token — but it needs **no repo checkout and
no submodules**; everything a fresh container consumes is baked in or generated:

- **Required config:** one LLM provider key (`ANTHROPIC_API_KEY`, or
  `OPENAI_API_KEY` + `OPENAI_BASE_URL` for OpenAI-compatible/local models) —
  required only for a **root/standalone** substrate or a hub. A **spoke** (a
  remote `DISCOVERY_ENDPOINT`) needs none: it inherits the hub's LLM arms
  through discovery.
- **Everything else auto-generates** on first boot and persists to the
  `substrate-workspace` volume (`.substrate-secrets`: `JWT_SECRET`,
  `SURREAL_PASS`, a local `METABOB_API_KEY`).
- **Joining an existing identity/discovery group** (spoke mode) additionally
  takes a hub-issued `METABOB_API_KEY` plus the hub location — see
  [Join an existing identity/discovery group](#join-an-existing-identitydiscovery-group)
  below and `docs/FEDERATION.md` § "Running a spoke".
- **Self-alteration (pull + push on the source repos):** pass
  `-e SUBSTRATE_GIT_PAT=<github-pat>` (Contents: Read+Write on the
  `AviGopal/*` repos; fork override via `SUBSTRATE_REPO_OWNER`). With it, the
  container clones the super-repo and every self-developed vessel repo on
  `dev` at boot and can land its own commits. Without it the substrate still
  runs — it falls back to a read-only baked snapshot of the fleet scripts and
  self-authored commits stay local. Adding the PAT to a running container
  upgrades the snapshot to live clones in place:
  `docker exec <name> systemctl restart git-push-setup`.
- **Secret hardening:** every non-provided secret auto-generates to a strong
  random value; the legacy shared default is refused at boot unless you opt
  back in with `-e ALLOW_INSECURE_API_KEY_SECRET=1`.
- The docker requirements are Linux x86_64 semantics with `--privileged`
  (systemd inside): native Linux, or Docker Desktop with the **WSL2** backend
  on Windows.

### Join an existing identity/discovery group

To attach a container to an **existing** hub's identity + discovery group — a
spoke: local registry + compute here, while traces, identity, and learning
state live on the hub — the join reduces to **point-and-go**: point
`DISCOVERY_ENDPOINT` (or `HUB_DISCOVERY_URL`) at the hub's discovery and present
a hub-issued `METABOB_API_KEY`. Those two are the only required inputs; the
role, identity endpoint, activity/trace store, and relay anchor are all derived
from them (the endpoints from the discovery host, the rest resolved from
`<discovery-endpoint>/bootstrap`). All vars are consumed by `gen-env.sh` /
`make run-live`.

| Var | Role |
|---|---|
| `METABOB_API_KEY` | **required** — hub-issued credential; the key that joins the group |
| `DISCOVERY_ENDPOINT=http://<hub-host>:18100` | **required** — point discovery at the hub |
| `HUB_DISCOVERY_URL=http://<hub-host>:18100` | the discovery group to join (same value as above) |
| `ENABLED_ROLES=spoke` | *optional / auto-inferred* — `gen-env.sh` infers `spoke` from a remote `DISCOVERY_ENDPOINT`; set it explicitly only to force a thin-spoke passthrough |
| `ACTIVITY_API_ENDPOINT=http://<hub-host>:18080` | *optional override* — derived from the discovery host if unset |
| `IDENTITY_VESSEL_URL=http://<hub-host>:18101` | *optional override* — derived from the discovery host if unset |

Because the role is inferred, the **federation transport auto-starts at boot**
whenever a hub is set — `entrypoint.sh` enables the federation-transport-vessel
and it self-derives its relay from `<discovery-endpoint>/bootstrap`. A spoke's
`FED_SUBSTRATE_ID` / `FED_VESSEL_ID` auto-generate and persist. Optional
overrides: `FED_SUBSTRATE_ID` (to pin a chosen id — it must be unique in the hub
namespace), `RELAY_MULTIADDR` (the relay anchor is otherwise taken from
`/bootstrap`, so a hand-pinned multiaddr can go stale on a relay restart),
`PEER_DISCOVERY_ENDPOINTS`. The copy-paste spoke commands — both the
`make up … DISCOVERY_ENDPOINT=…` form and the raw `docker run` form, plus the NAT
return-path step (`spoke-federate`) — live in
[`README.md`](../README.md) § *Join an existing identity / discovery group (spoke)*
and [`scripts/substrate/.env.example`](../scripts/substrate/.env.example);
identity-namespace mechanics in [`docs/FEDERATION.md`](FEDERATION.md).

A federated spoke inherits the hub's LLM arms, so its launch command needs no
local provider key:

```bash
make -C scripts/substrate up API_KEY=<hub-issued-key> \
  DISCOVERY_ENDPOINT=http://<hub-host>:18100
```

`up` resumes an existing stopped container only when no launch settings are
supplied. To apply changed hub, role, or federation settings, recreate the
container while retaining its named workspace and datastore volumes:

```bash
make -C scripts/substrate recreate API_KEY=<hub-issued-key> \
  DISCOVERY_ENDPOINT=http://<hub-host>:18100
```

A **local Obsidian plugin** (outside the container) connects to the spoke with
its normal two inputs — the API key plus `discoveryVesselEndpoint=http://127.0.0.1:18100`
(the spoke's local registry). Its sidecar routes all egress through the spoke,
and the spoke's federation transport mirrors the plugin's shapes to the hub, so
the vault is reachable fleet-wide without any direct exposure.

`scripts/substrate/configure-local.sh` only updates `~/.metabob/config.json` so
*operator tooling* points at the substrate — IDE convenience, not part of the
system. `up` runs it automatically **only for the default `substrate-live`**; a
secondary container (`LIVE_NAME=<other>`) is left untouched, so `~/.metabob/config.json`
keeps pointing at whatever it did before (point tooling at the secondary yourself,
or use `LIVE_NAME=` on the make targets).

## Second substrate on the same host (clean-room)

Two `make` variables run a **fully-isolated** substrate alongside `substrate-live`
without touching its learning state — the right way to test the setup, try a risky
change, or stand up a throwaway fleet. This is **not** a spoke: a spoke shares a
hub's identity namespace and points its control/store at the hub; a clean-room
instance is a standalone, self-contained fleet with its own everything.

- **`LIVE_NAME=<name>`** renames the container *and* its named volumes to
  `<name>-surreal` (`/var/lib/surrealdb`) and `<name>-workspace` (`/workspace`),
  so its traces, posteriors, concept graph, and secrets are entirely separate.
- **`PORT_OFFSET=<n>`** shifts every published host port by `n` so the two fleets
  don't collide (e.g. `PORT_OFFSET=20000` → activity-api `38080`, discovery
  `38100`, goal-host `38210`, concept-db `38260`).

```bash
# Boot an isolated clean-room fleet (own volumes + own ports; substrate-live untouched)
make -C scripts/substrate up LIVE_NAME=substrate-scratch PORT_OFFSET=20000 ANTHROPIC_API_KEY=sk-ant-...

# Every management/inspection target needs the same LIVE_NAME (they default to substrate-live)
make -C scripts/substrate doctor    LIVE_NAME=substrate-scratch
make -C scripts/substrate show-key  LIVE_NAME=substrate-scratch

# Tear it down (removes the container; add the volumes to wipe its state)
docker rm -f substrate-scratch
docker volume rm substrate-scratch-surreal substrate-scratch-workspace
```

For a secondary instance `up` deliberately **skips** `configure-local.sh`, so
`~/.metabob/config.json` still points at whatever it did before — point operator
tooling at the offset ports manually if you want it aimed at the clean-room fleet.

<details><summary>Legacy 4-step launch (still works)</summary>

```bash
make -C scripts/substrate build
make -C scripts/substrate run-live ANTHROPIC_API_KEY=sk-ant-...
make -C scripts/substrate seed-live
scripts/substrate/configure-local.sh
```

</details>

> **Obsidian flavour.** For the same fleet plus an in-container Obsidian desktop
> over noVNC (host `:16080`), run `make -C scripts/substrate build-obsidian` then
> `make -C scripts/substrate run-live-obsidian ANTHROPIC_API_KEY=...`. It reuses
> the `substrate-live` container name and the same volumes, so every `restart-*`
> / `logs-*` / `health` target keeps working unchanged.

After step 4, `~/.metabob/config.json` points to `http://localhost:18080` and all validation harnesses use it automatically.

**Note on ports**: The container maps internal ports to host ports with an 18000 offset — activity-api is at `localhost:18080`, discovery-vessel at `localhost:18100`, etc. Internal vessel-to-vessel calls use `127.0.0.1:808x` directly inside the container.

**Running CLI commands inside the container**: always source the env file with auto-export so child processes (Bun) inherit the variables:
```bash
docker exec substrate-live bash -c 'set -a; source /etc/substrate/env; set +a; cd /vessels/development-vessel && bun run cli seed-templates'
```
Plain `source /etc/substrate/env` sets shell variables only — child processes won't see them. `set -a` auto-exports everything that follows.

## Configuration and secrets

Secrets are resolved and persisted along **two independent paths** that must stay in sync:

- **Boot secrets** — `entrypoint.sh` runs `gen-env.sh`, which resolves each secret (explicit env `-e` first, else the value persisted on a prior boot, else generated) with its own inline `persisted_secret()` logic and renders `/etc/substrate/env`.
- **Dynamic-vessel secrets** — `scripts/substrate/secrets.env.sh` is the declaration point for secrets a *dynamic* vessel needs at install time; `vessel-ctl` sources it. It is **safe to commit** (names + non-secret defaults only). Note that `gen-env.sh` does **not** source it — the two files are separate, so a secret needed at boot must be added to `gen-env.sh`, not only to `secrets.env.sh`.

The boot flow:

```
entrypoint.sh ──runs──▶ gen-env.sh ──renders──▶ /etc/substrate/env
                             │                     (every systemd unit reads it via
                             │                      EnvironmentFile=/etc/substrate/env)
                             ▼
             /workspace/.substrate-secrets  (persisted → survives restart)
```

`gen-env.sh` writes `/etc/substrate/env` and persists its secrets to `/workspace/.substrate-secrets` (on the `substrate-workspace` named volume), so a restart reuses the same values instead of regenerating and breaking auth. The persisted set is `JWT_SECRET`, `SURREAL_PASS`, `API_KEY_SECRET`, `FED_SUBSTRATE_ID`, `METABOB_API_KEY`, `SUBSTRATE_GIT_PAT`, **and the operator-supplied provider keys** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`/`OPENAI_BASE_URL`, `CHUTES_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`) — the provider keys are read from the run environment when present but are then round-tripped into `.substrate-secrets` too, so a `docker rm` + recreate *without* `-e` retains them. (`FEDERATION_SIGNING_SECRET` is **not** in the boot set — it is generated by `secrets.env.sh` on the dynamic-vessel path, when the federation transport is installed.)

`secrets.env.sh` is **safe to commit** — it declares *names and non-secret defaults only*, never real secret values (those come from the environment or the persisted file). `vessel-ctl.sh` sources the same file when installing a dynamic vessel, so a vessel's declared `secrets` are guaranteed present in `/etc/substrate/env` and persisted at install time.

### Keys and tokens (the human surface)

Humans never call identity-vessel directly — it is internal-only (no host port). The
in-container tool `substrate-key` (baked next to `vessel-ctl`) is the issuance
surface, wrapped by Makefile targets so the whole flow is one command with no
credentials beyond a running substrate:

> **Instance selector.** Every `make -C scripts/substrate` target — `show-key`,
> `whoami`, `issue-key`, `list-keys`, `revoke-key`, `status`, `health`, `shell`,
> `logs-<unit>`, `restart-<vessel>`, `sync-<vessel>` — runs `docker exec
> $(LIVE_NAME) …` and defaults `LIVE_NAME=substrate-live`. Run bare against a
> second or clean-room container they silently act on the live substrate; pass
> `LIVE_NAME=<container>` on every command (e.g.
> `make -C scripts/substrate show-key LIVE_NAME=substrate-scratch`). See
> [Second substrate on the same host](#second-substrate-on-the-same-host-clean-room).

```bash
make -C scripts/substrate show-key                 # print the operator API key (what configure-local writes)
make -C scripts/substrate whoami                   # operator identity: org, user, scopes
make -C scripts/substrate issue-key NAME=my-peer   # mint a new API key (external peer / spoke / new vessel)
make -C scripts/substrate issue-key NAME=ci-bot SCOPES=read EXPIRES_DAYS=30
make -C scripts/substrate issue-jwt ROLE=admin     # mint a Bearer JWT (dashboard / admin endpoints)
make -C scripts/substrate list-keys
make -C scripts/substrate revoke-key KEY_ID=key_xxx
```

The full key is printed **once** and never stored (only its hash is persisted).
Auth model: the operator's `METABOB_API_KEY` resolves the substrate org, an admin
JWT is minted in-container via identity-vessel's `/v1/jwt/generate` (unauthenticated
by design — the container boundary is the trust boundary), and that JWT authorizes
the admin-only `/v1/keys/*` endpoints. On images that predate the baked tool the
Makefile copies `scripts/substrate/substrate-key.sh` into the running container
first. This is the supported way to obtain the hub-issued key a spoke or external
peer needs (see `docs/FEDERATION.md`).

## Iteration loop

When you change a vessel's source:

```bash
# Edit the vessel
vim repos/development-vessel/src/resolvers/...

# Restart just that unit — no container restart, no rebuild
make -C scripts/substrate restart-development-vessel

# Verify
curl http://localhost:18090/health
```

Vessels with a `restart-<vessel>` target (copies `repos/<vessel>/src` into the
container, then restarts the unit):
- `restart-analysis-vessel`
- `restart-concept-db`
- `restart-development-vessel`
- `restart-goal-host-vessel`
- `restart-light-dispatch-vessel`
- `restart-llm-resolver-vessel`
- `restart-local-tools-vessel`
- `restart-obsidian-vessel`
- `restart-ribosome-vessel`
- `restart-stateful-ui-vessel`

The core vessels — `activity-api`, `identity-vessel`, `discovery-vessel`,
`surrealdb` — have **no** make restart target. Iterate them by copying source in
and restarting the unit directly (or rebuild for a clean deploy):

```bash
docker cp repos/activity-api/src substrate-live:/vessels/activity-api/
docker exec substrate-live systemctl restart activity-api
```

## Validating after a change

```bash
# Failure-mode harness smoke test
bun run validation/scripts/failure-mode-harness.ts

# Full stratified harness (longer; run before pushing a substantial change)
bun run validation/scripts/stratified-harness.ts

# Single goal to produce a trace — dispatch through the metabob-mcp cockpit
# (`mcp__metabob__run_goal` / `run_goal_async`), which lands the goal as a
# traced execution. Agents drive validation through the cockpit, not a CLI.

# Check the trace appeared
curl -s "http://localhost:18080/v2/activities/execution-traces?limit=1" | jq .
```

## Monitoring

```bash
# All unit statuses
make -C scripts/substrate status

# Aggregate fleet health (host-mapped HTTP probes)
make -C scripts/substrate health

# Follow a vessel's logs
make -C scripts/substrate logs-activity-api

# Shell into the container
make -C scripts/substrate shell
```

## Backing up and restoring learning state

State lives in **two Docker named volumes**, both detached from the container, so
they **survive `make clean` and a rebuild** (only `docker volume rm` destroys
them):

- `substrate-surreal` (`/var/lib/surrealdb`) — the SurrealDB datastore: all
  execution traces, Thompson posteriors, the concept graph, and the template
  registry. **Dropping this loses all learning state.**
- `substrate-workspace` (`/workspace`) — generated secrets
  (`.substrate-secrets`: `JWT_SECRET`, `SURREAL_PASS`, `METABOB_API_KEY`,
  provider keys), git clones, fleet definition files, and metrics.

Back up **both** before destructive operations:

```bash
# Backup (stop first so SurrealDB flushes)
docker stop -t 30 substrate-live
for vol in substrate-surreal substrate-workspace; do
  docker run --rm -v "$vol":/src -v "$(pwd)":/bak alpine \
    tar czf "/bak/$vol-$(date +%Y%m%d).tgz" -C /src .
done

# Restore a volume, then bring the container back up (repeat per volume as needed)
docker run --rm -v substrate-surreal:/dst -v "$(pwd)":/bak alpine \
  sh -c 'find /dst -mindepth 1 -delete && tar xzf /bak/substrate-surreal-YYYYMMDD.tgz -C /dst'
make -C scripts/substrate run-live ANTHROPIC_API_KEY=...
```

## Pointing tools at a substrate

Harnesses and clients read the target substrate from one line in `~/.metabob/config.json`:

```json
{
  "metabob": {
    "endpoint": "http://localhost:18080"
  }
}
```

Point `endpoint` at whichever substrate's activity-api you are targeting (the local
container, or a remote hub such as `http://<hub-host>:18080`). No code changes needed;
`make up` writes the local value for you — but **only for the default
`substrate-live`**. A secondary/clean-room instance (`LIVE_NAME=<other>`,
`PORT_OFFSET=<n>`) leaves this file untouched; set `endpoint` to its offset
activity-api port yourself (e.g. `http://localhost:38080`).

## Deploy paths

The same image runs anywhere; the deploy scripts differ only in *how* the image and source reach the target. Runtime state always lives in the two named volumes (`substrate-surreal` at `/var/lib/surrealdb`, `substrate-workspace` at `/workspace`), which are host-detached and survive rebuilds — so any of these paths preserves learning state across updates.

> **GHCR prerequisite (for any path that *pulls* the prebuilt image).** The
> published image is **private** (it bakes vessel source), so pulling
> `ghcr.io/avigopal/substrate:dev` — the container/compose path, or a raw
> `docker run` that hasn't built locally — first needs `docker login ghcr.io`
> with a token granted `read:packages`. The build-on-target paths below
> (`deploy-hub.sh`, local `make build`) construct the image instead of pulling
> it, so they don't hit this gate.

| Path | Command | What it does |
|---|---|---|
| **Local** | `make -C scripts/substrate run-live ANTHROPIC_API_KEY=…` | Builds/runs the full fleet locally as `substrate-live` (host ports `18080`/`18090`/`18100`/`18210`/`18250`/`18260`/`18270`). The everyday development target. |
| **Hub (clone + build on a VM)** | `GITHUB_PAT=… ANTHROPIC_API_KEY=… SSH_KEY=… bash scripts/substrate/deploy-hub.sh root@<vm-ip> <public-ip>` | `deploy-hub.sh` clones the repo + submodules **on the VM** and builds there (no multi-GB image ship), runs `ENABLED_ROLES=hub`, seeds the single shared org (so spokes registering with a hub-issued key share its namespace), and stands up the libp2p relay. |
| **Remote (ship prebuilt image over SSH)** | `ANTHROPIC_API_KEY=… bash scripts/substrate/deploy-remote.sh root@<vm-ip>` | `deploy-remote.sh` ships the locally-built image via `docker save \| ssh docker load` (**no registry**), runs + seeds it on the VM using the portable named volumes. Optional `PUBLIC_IP=… RUN_RELAY=1` also stands up the public relay; optional `PEER_DISCOVERY=<ip>:18100 FEDERATION_SIGNING_SECRET=<hex>` peers it to another substrate. |
| **Fleet convergence** | `APPLY=1 CONTAINERS="substrate-live substrate-b" bash scripts/substrate/federation-pull-sync.sh --once` | `federation-pull-sync.sh` ff-only pulls `origin/dev`, diffs the changed `repos/<vessel>` trees, and `docker cp`s the whole `src/` (+`sql/`, `package.json`) into every peer container that runs that vessel, then restarts the unit — converging an entire fleet to upstream for **arbitrary multi-file changes, including the core vessels** (discovery-vessel, activity-api) that `restart-<vessel>` has no target for. Dry-run by default (`APPLY=1` to act); ff-only (refuses divergence). |

Federation deploy details (hub vs. peers, the relay/sidecar, firewall ports) live in [`docs/FEDERATION.md`](FEDERATION.md).

## Dynamic vessels (the canonical attach path)

Beyond the baked-in core, `vessels.manifest.json` declares **runtime-installable** vessels. The fleet definition files live ON THE VOLUME at `/workspace/substrate/fleet/` (seeded from image defaults at first boot, substrate-writable — the substrate can alter its own membership); readiness, doctor, self-recovery, pull-sync and vessel-ctl all read the volume copies.

`vessel-ctl` ships **in the image** (`/usr/local/bin/vessel-ctl`) and is fully self-contained: `install` clones the vessel's repo into `/workspace/git/vessels/<name>` on demand, mirrors it into the live `/vessels` runtime, renders the unit via the shared `render-unit` template, and enables it — no host checkout, no docker-cp from a host workspace. Rendered units carry an `ExecStopPost` discovery-deregister so any clean stop leaves the registry immediately (crash death falls back to the 5-min TTL). Self-recovery membership is **derived** from the fleet files at read time — install/uninstall no longer mutates any script.

```bash
make -C scripts/substrate list-vessels                       # host convenience
make -C scripts/substrate install-vessel   VESSEL=metric-collector-vessel
make -C scripts/substrate sync-vessel      VESSEL=metric-collector-vessel
make -C scripts/substrate uninstall-vessel VESSEL=metric-collector-vessel
docker exec substrate-live vessel-ctl install <name>         # same, in-container
```

`vessel-ctl` is both **operator-runnable** and **activity-dispatchable** — the substrate can invoke it through local-tools-vessel's `shell` resolver (clean JSON on stdout, idempotent, no prompts), and the `--container` flag lets a host-context invocation act on another container.

## Self-sync (git remotes are the only code channel)

`substrate-pull-sync.timer` (10 min, plus a boot run after `git-push-setup`) converges the live `/vessels` runtime to each clone's `origin/dev`: ff-only pull → `mirror-to-live` → staggered, health-gated restart. A restart that goes unhealthy reverts to the last-good pin (`/workspace/.last-good/<v>`) and halts the run with a `substrateGap`; a diverged clone is refused (never forced). Runs skip while a mitosis cutover is in flight (`/workspace/mitosis-pending.json`). This is also how a *fleet* of substrates converges — each one pulls origin; no host mediates (it replaces `host-pull-sync.sh` / `federation-pull-sync.sh` as the load-bearing path). Self-recovery's revert source is the git clone too, never a host checkout. Without a `SUBSTRATE_GIT_PAT` the sync no-ops with a warning: the substrate is frozen-but-functional.

## Landing a change

Once a change validates locally, commit and push it to `dev` in the vessel's own repo:

```bash
git add repos/<vessel>
git commit -m "feat(<vessel>): <description>"
git push origin dev
```

`origin/dev` is the convergence point: every substrate's `substrate-pull-sync.timer`
(and any peer's) ff-only pulls it and health-gates the restart — pushing to `dev` *is*
the deployment. There is no separate promotion environment.

## Development-vessel specifics

`development-vessel` is the meta-vessel for substrate self-development: the failure-mode harness, topology-discovery activities, `coverage-tick`, and `substrate-health-tick` all run as activities inside it. The `development-vessel.service` unit runs `seed-templates` automatically via `ExecStartPost` on every start — seeds are idempotent UPSERTs so re-running is safe.

**goal-host-vessel async dispatch.** `POST /run-goal` returns HTTP 202 immediately; goal execution happens asynchronously. Callers (goal-host-vessel clients and boredom-vessel) must poll for execution status rather than waiting for a synchronous response. This means a 202 from `/run-goal` does not indicate goal success — check the execution trace in activity-api to confirm completion.

The topology-discovery loop runs autonomously inside the substrate. The boredom-vessel is a dispatch-pool daemon: each selection pass scores the pool of candidate templates (tagged `boredom_target_template`) on learned momentum, input-shape availability, and priority-weight folds derived from current conditions — open-gap demand, `timeShapedRhythm` due-state, learning-mode boosts — then dispatches winners concurrently up to a slot cap. Measurement (`substrate-health-tick`), probing (`probe-reachable-unlearned`, `probe-untraversed-edge`), health, escalation, coverage, and gap-closing (`draft-gap-closing-activity`) work all enters through this same pool; there is no fixed rotation. Selection passes are prompted by events (activity-api task completions, in-process prompts after cheap ticks); the systemd timer serves only as a backstop when no events arrive, and the dispatch interval acts as a cost governor rather than a cadence — deterministic zero-token ticks largely bypass it while token-costed work pays it in full. Selection momentum persists across restarts, so learned preferences survive cutovers.

```
activityRegistryChange → learned-topology-snapshot → reachable-unlearned-report
                       → probe-reachable-unlearned → activityRegistryChange → …
                       → draft-gap-closing-activity → new template in registry
```

**Substrate-authored development (S2).** Once the lift criteria (coverage progress + substrate health + operator hand-over) are met and the operator authorises the transition, the substrate authors its own activities via the `draft-gap-closing-activity` goal and the `propose-spec` / `verify-merge-candidate` pipeline.

**S2 → S3 is the active direction.** S3 (distributed-stable, adversarial-resistant, operator non-load-bearing) is tracked in the post-lift agenda and S3 readiness criteria (measured by active push-away: substrate refusing operator interventions with cited evidence, not by passive intervention-absence). S3 has no operational gate in this document — it is emergent and operator-measured under sustained adversarial exposure.

**Measuring S2→S3 readiness.** S2→S3 readiness is observable through two shape families owned by development-vessel:

- `operatorIntervention` — emitted when the substrate detects operator action against substrate state. Carries `classification` (`intervention | maintenance | redundant`), `target`, `rationale`, and supporting evidence. The operator can emit these explicitly; development-vessel also detects them by watching commits, lifecycle overrides, and direct file mutations.
- `interventionRefused` — emitted by substrate gates (promote-guard, template-sanitizer, etc.) when they reject an operator action with cited rationale and supporting evidence.
- `interventionRateReport` — periodic aggregation of intervention and refusal rates. A trend toward zero under adversarial exposure is the S2→S3 signal.

The substrate cannot self-declare S3. Only the operator can observe sustained push-away and make that judgment. These shapes give the operator the data to do so.

**Lift-criterion hardening — external anchors and stall detection.** Two risks threaten the lift criterion's load-bearing character. First, **measurement gaming**: a substrate that optimises whatever the criterion measures can satisfy `coverage_progress` with trivial goals and satisfy `confidence_passing` by repetition. The structural defense is external anchors the substrate cannot author or modify — a held-out evaluation set (`heldOutEvalReport`), CI agreement between the substrate harness and an independent runner (`ciAgreementReport`), and adversarial probes introduced by the operator that the substrate must handle without degrading. Second, **stall undetectability**: the topology-discovery chain produces flat signals both when the substrate has genuinely converged AND when a chain link has silently failed. The defense is a `chainStallReport` shape that fires when the chain produces zero progress signals for more than a configurable window without any external explanation (for example, no new shapes were registered, no new traces appeared). Stall is distinguishable from convergence only when the substrate can explain the absence of progress.

## Event bus

All lifecycle events — task binding, execution completion, gap classification, LLM dispatch — flow on the activity-api WebSocket broadcaster (`ws://localhost:18080/ws`) in addition to any in-process eventSink. Discovery-vessel emits four additional event types on the same bus: `vessel.registered`, `vessel.heartbeat`, `vessel.deregistered`, and `vessel.expired`. Any vessel subscribing to the bus receives all of these without any per-emitter configuration.

This has a practical consequence for vessel startup: goal-host-vessel subscribes to `vessel.registered` and uses those events to reactively register proxy resolvers for newly-appearing vessels. This replaces the race-prone one-shot registration that happened once at startup — a vessel that starts after goal-host-vessel now gets picked up automatically rather than being invisible until the next restart cycle.

## Vessel self-replacement

Vessels that accumulate idiom-purity gaps are candidates for substrate-driven self-replacement. Purity gaps include: serving legacy REST endpoints alongside the resolver contract, implementing built-in tools (bash, read, write, git) instead of routing through discovery-resolved ones, or maintaining internal state that belongs in the substrate's shared store. The substrate audits purity against the canonical idiom set, mints a replacement vessel via the forge, validates the replacement in shadow against live traffic, and promotes it on evidence. The original vessel is archived rather than modified in-place.

A vessel carries a purity gap when it serves legacy REST endpoints that predate the resolver contract, or ships built-in tools (bash/read/write/edit/git) that bypass discovery instead of routing through discovery-resolved ones. Self-replacement for such a vessel is substrate-driven and not operator-led — the operator's role is adversarial testing of the replacement, not authoring it. Which vessels currently carry gaps is a live fact: query the purity audit rather than trusting a list here.

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

Federation routes capability queries across substrates: hub/spoke over a shared identity namespace, plus discovery peer fan-out, with a public libp2p Circuit Relay v2 for NAT traversal. A capability query with no local producer fans out to configured peers, and goal-host routes the result over the relay; from the perspective of any vessel above discovery the routing is invisible — they call `POST /resolve` and receive a vessel record, whether it lives in the same container or a peer. The federation transport primitives ship as **dynamic vessels** (`federation-relay`, `federation-transport-vessel` in `vessels.manifest.json`; the `transport` role in `vessels.inventory.json`).

**[`docs/FEDERATION.md`](FEDERATION.md) is the authoritative reference** for the two topologies (shared-namespace hub+spokes vs. fan-out peers), the relay/sidecar for NATed vessels, and the end-to-end loop. This doc does not duplicate it — see there for the operator commands and identity-namespace mechanics.

## Troubleshooting

**Units not starting within 60s**: check `make -C scripts/substrate logs-<unit>` for the failing unit. Most common cause: a host-port conflict on one of the published ports (e.g. another process already on `18270`) — `run-live` aborts with "Bind for 0.0.0.0:18270 failed: port is already allocated".

**API key needed but lost**: if you ran `seed-identity.ts` but forgot the key, re-read it from the container env file: `docker exec substrate-live grep METABOB_API_KEY /etc/substrate/env`. Then re-run `configure-local.sh` to update your local config.

**Harness connection errors**: confirm `~/.metabob/config.json` points to `http://localhost:18080`, not the canary endpoint. Run `scripts/substrate/configure-local.sh` to reset.

**`make restart-<vessel>` fails**: the container must be running (`make -C scripts/substrate run-live` first). Units restart in-place; the container itself is not restarted. Note that only the vessels listed under "Iteration loop" have a `restart-<vessel>` target — core vessels (activity-api, identity-vessel, discovery-vessel, surrealdb) are restarted with `docker exec substrate-live systemctl restart <unit>`.

**Tooling connects to the wrong substrate**: client tooling reads its target from `~/.metabob/config.json`, and `configure-local.sh` points it at the local substrate. Inside the container, each systemd unit reads its endpoints from `/etc/substrate/env` — the load-bearing variables are `METABOB_API_KEY`, `ACTIVITY_API_ENDPOINT=http://127.0.0.1:8080`, and `IDENTITY_ENDPOINT=http://127.0.0.1:8101`. If you rebuilt the container without pulling the latest gen-env.sh, run `docker exec substrate-live bash /scripts/substrate/gen-env.sh` to regenerate the env file.
