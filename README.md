# substrate — a self-improving development substrate

**An autonomous AI development system built on the impulse–activity foundation, with Thompson Sampling for continuous learning. The system develops itself: goals are dispatched into a running substrate, every execution is traced, and successful patterns become reusable templates.**

> **Start here:** [`CLAUDE.md`](CLAUDE.md) is the authoritative, continuously-maintained description of how to work in this repo. This README is a high-level orientation; when the two disagree, CLAUDE.md wins. When either disagrees with the running substrate, the running substrate wins.
>
> **All documentation:** [`docs/README.md`](docs/README.md) is the index of everything under `docs/` — architecture lenses, operations guides, and reference material. This README links only a handful of them.

## Overview

The substrate demonstrates:

- **Impulse–Activity architecture** — universal data (*impulses*) processed through constrained state transitions (*activities*).
- **Learning loop** — Thompson Sampling for activity selection, Bayesian relevance scoring for impulses, ribosome extraction of templates from successful traces.
- **Vessel pattern** — capabilities are provided by *vessels* (bundles of activities + resolvers + lifecycle hooks) that live where their data lives.
- **Self-governance / autonomy** — the substrate detects its own operational gaps, proposes and verifies changes, and lands them through a self-alteration cutover loop, moving along the S1 → S2 → S3 autonomy trajectory (operator-authored development → substrate-authored development under supervision → a system that resists harmful intervention with cited evidence).

## Architecture foundation

> **Canonical reference:** [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)

### Core concepts

**Impulses** — data in any form (text, structured data, signals, commands) with metadata for reasoning. Lazy-loaded pointers; reasoners see the shape/summary, resolvers load content:

```typescript
{
  id: "error-log",
  pointer: { type: "file", path: "error.log" },
  shape: "error_log",
  budget: 2000
}
```

**Activities** — constrained state transitions linking input impulses to output impulses. Tasks dispatch to *resolvers* (the LLM is one resolver among many), and execution is measured (success rate, cost, duration):

```typescript
{
  id: "fix-bug",
  output_shapes: ["patch"],
  tasks: [
    { id: "analyze", resolver: "llm",  /* … */ },
    { id: "fix",     resolver: "bash", /* … */ }
  ]
}
```

**Vessels** — capability providers that register with the discovery-vessel and resolve the shapes they own. The backend (`activity-api`) is a trace store + pattern learner, **not** a universal resolver.

## How development works: dispatch through the substrate

The default development loop is **not** "hand-edit a file and run tests." It is to **dispatch the change as a goal** so it runs as a traced activity and feeds the learning loop. The agent-facing dispatch surface is the **metabob-mcp** cockpit — `mcp__metabob__run_goal` for short one-shot goals, `mcp__metabob__run_goal_async` for anything non-trivial (both reach `goal-host-vessel`). There is no supported command-line dispatch client: goals go through the MCP cockpit, or directly to `POST /run-goal` on goal-host if you are scripting against the HTTP surface.

```
mcp__metabob__run_goal  goal="fix the failing tests in activity-api"
mcp__metabob__run_goal  goal="add input validation to the impulse endpoint"
```

Conscious one-off direct edits to vessel source are gated by a PreToolUse hook and require `SUBSTRATE_ALLOW_DIRECT_EDIT=1`; docs/scripts/tests/config are never gated. See CLAUDE.md → *How work happens: dispatch, don't edit*.

## Installation

The whole system runs as **one container** (`substrate-live`) hosting the vessel fleet as systemd units — no Kubernetes, no orchestration on the host. The host contract is a single `docker run`: one privileged container, one LLM-provider env var, two named volumes (workspace + datastore). Everything load-bearing — seeding, readiness, diagnosis — happens inside the container at boot; the Makefile is a convenience wrapper over exactly that contract.

### Quick start from the published image (few commands, from repo root)

The canonical image is `ghcr.io/avigopal/substrate:dev` (fleet), published by
`.github/workflows/build-substrate-image.yml` on every push to `dev`. It is
**private** — it bakes vessel source — so pulling needs a `docker login ghcr.io`
with a PAT carrying `read:packages` scope. (`ghcr.io/avigopal/substrate:obsidian`
adds an in-container Obsidian over noVNC.) A pulled image needs no submodules.
Requirements: Docker with Linux x86_64 semantics and `--privileged` (native
Linux, or Docker Desktop with the WSL2 backend on Windows).

**Standalone substrate** — from the repo root, the canonical root-level
`docker-compose.yml` reduces launch to a few commands; every secret but the one
LLM key auto-generates on first boot and persists to the volumes:

```bash
cp scripts/substrate/.env.example .env    # set ANTHROPIC_API_KEY (or OPENAI_API_KEY)
docker login ghcr.io                       # PAT with read:packages
docker compose up -d                       # run from repo root — root compose is canonical
docker exec substrate-live substrate-key show
```

`scripts/substrate/docker-compose.yml` is a symlink to the root file, so
either directory works. `OPENAI_API_KEY` works in place of `ANTHROPIC_API_KEY` —
exactly one LLM key is required; every other secret auto-generates on first boot
to `/workspace/.substrate-secrets`.

**Raw `docker run`** — the same image, without compose (log in first):

```bash
docker login ghcr.io                       # PAT with read:packages
docker run -d --privileged --name substrate-live \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -p 18080:8080 -p 18090:8090 -p 18100:8100 -p 18101:8101 -p 18210:8210 \
  -p 18250:8250 -p 18260:8260 -p 18270:8270 \
  --tmpfs /run --tmpfs /run/lock ghcr.io/avigopal/substrate:dev
```

Wait for `docker inspect --format '{{.State.Health.Status}}' substrate-live`
to report `healthy`, then dispatch goals against `http://localhost:18210/run-goal`
(goal-host) and browse traces at `http://localhost:18080` (activity-api). Retrieve
your operator API key straight from the running container (the tool is baked into
the image — no repo checkout needed):

```bash
docker exec substrate-live substrate-key show
```

Optional: add `-e SUBSTRATE_GIT_PAT=<github-pat>` so the
substrate can pull + push the source repos it is built from (self-alteration);
without it, self-authored commits stay local. Full config matrix:
[`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) § *Pulling the image instead of
building*; federation details: [`docs/FEDERATION.md`](docs/FEDERATION.md).

### Join an existing identity / discovery group (spoke)

A spoke contributes a local registry + compute while identity, traces, and
learning state live on the hub. Joining is **point-and-go**: pointing
`DISCOVERY_ENDPOINT` (or `HUB_DISCOVERY_URL`) at the hub's discovery and
presenting a hub-issued `METABOB_API_KEY` is sufficient — the identity endpoint,
trace store, and relay anchor are resolved from `<discovery-endpoint>/bootstrap`.
`METABOB_API_KEY` is the credential the hub operator issues you (minted on the
hub with `make -C scripts/substrate issue-key NAME=<you>`). The same variables
attach a spoke however you launch — `docker compose`, `make up`, or the raw
`docker run` above; `ACTIVITY_API_ENDPOINT` and `IDENTITY_VESSEL_URL` are
optional explicit overrides for values `/bootstrap` otherwise supplies.

**Docker Compose** — put the join vars in the root `.env` (the root
`docker-compose.yml` and its [`scripts/substrate/docker-compose.yml`](scripts/substrate/docker-compose.yml)
symlink pull the same GHCR image), then bring it up:

```bash
# .env
METABOB_API_KEY=<hub-issued-key>          # required: the hub-issued credential
ENABLED_ROLES=spoke
HUB_DISCOVERY_URL=http://<hub-host>:18100  # required: the discovery to point at
DISCOVERY_ENDPOINT=http://<hub-host>:18100 # required: same value
# optional overrides — otherwise resolved from <discovery-endpoint>/bootstrap:
# ACTIVITY_API_ENDPOINT=http://<hub-host>:18080
# IDENTITY_VESSEL_URL=http://<hub-host>:18101
```

```bash
docker login ghcr.io                       # PAT with read:packages
docker compose up -d                       # from repo root — compose auto-loads `.env`
docker exec substrate-live substrate-key show
```

**`make up` / raw `docker run`** — the identical vars work as `-e VAR=value`
flags on the standalone `docker run` above, or as `VAR=value` arguments to
`make -C scripts/substrate up`. A federated spoke inherits the hub's LLM arms,
so it needs no local provider key:

```bash
make -C scripts/substrate up API_KEY=<hub-issued-key> \
  DISCOVERY_ENDPOINT=http://<hub-host>:18100
```

To apply changed launch settings to a stopped or running spoke without removing
its named volumes, use `make -C scripts/substrate recreate` with the same
arguments. To make the spoke hub-dialable behind NAT
(relay reservation + per-vessel capability mirror; the id must be unique in the
hub namespace), run once after boot:

```bash
docker exec substrate-live spoke-federate substrate-live <unique-id>
```

Your vessels then appear in the hub registry as `<vessel>@<unique-id>`, and a
local Obsidian plugin connects to the spoke with its normal two inputs (API key
+ `discoveryVesselEndpoint=http://127.0.0.1:18100`). Optional transport
overrides (`FED_SUBSTRATE_ID`, `RELAY_MULTIADDR`, `PEER_DISCOVERY_ENDPOINTS`)
are consumed the same way. Full guide: [`docs/FEDERATION.md`](docs/FEDERATION.md).

### Building from source

**Prerequisites:** Docker (must allow `--privileged`; native Linux or WSL2), GNU make, git (submodule access), bun, jq, curl.

**1. Clone** — submodules are mandatory; the image build copies each vessel's source from `repos/<vessel>`:

```bash
git clone --recurse-submodules https://github.com/AviGopal/substrate
cd substrate
git submodule update --init --recursive     # if you cloned without --recurse-submodules
```

`.gitmodules` pins each vessel over HTTPS (`github.com/AviGopal/<vessel>.git`).
Some vessel repos may be private, so submodule fetch needs a credential — an
HTTPS PAT or an SSH key. The scheme adapts to whatever you have **without editing
`.gitmodules`**, via a global rewrite rule:

```bash
# SSH key holders — rewrite HTTPS submodule URLs to SSH transparently:
git config --global url."git@github.com:".insteadOf "https://github.com/"

# PAT/token users — inject the token into the HTTPS URL:
git config --global url."https://<token>@github.com/".insteadOf "https://github.com/"
```

**2. Start** — one command:

```bash
make -C scripts/substrate up ANTHROPIC_API_KEY=sk-ant-...
```

`up` builds the image if needed, starts the container, seeds identity + templates in-container, waits for fleet readiness, points `~/.metabob/config.json` at the substrate, and runs a doctor check. `OPENAI_API_KEY` (with optional `OPENAI_BASE_URL` for Ollama/local models and `LLM_DEFAULT_MODEL`) works in place of Anthropic; at least one LLM provider key is required. All other secrets (JWT signing, datastore password, the bootstrap API key) are generated on first boot and persisted to the workspace volume.

**3. Verify:**

```bash
make -C scripts/substrate ready            # fleet readiness matrix
make -C scripts/substrate doctor SMOKE=1   # deep diagnosis + end-to-end goal dispatch
```

**4. Get your credentials.** identity-vessel is internal-only, so a human obtains or mints keys through the Makefile — no raw API calls:

```bash
make -C scripts/substrate show-key                 # the operator API key
make -C scripts/substrate issue-key NAME=my-peer   # mint a key (spoke / external peer / new vessel)
make -C scripts/substrate list-keys                # list issued keys
make -C scripts/substrate revoke-key KEY_ID=key_x  # revoke one
```

The full key is printed once and never stored. See [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) § *Keys and tokens*.

**5. Install the human interface (Obsidian plugin)** — one command, into an existing or new vault:

```bash
bash repos/obsidian-vessel/install.sh --local            # same-machine substrate
bash repos/obsidian-vessel/install.sh                    # interactive: vault → host → key
```

The installer selects or creates the vault, installs the plugin, and writes the two inputs the plugin needs — `{discoveryVesselEndpoint, apiKey}`. At start the federation sidecar fetches `<discovery-endpoint>/bootstrap` for the relay anchor (point-and-go) and reserves a libp2p circuit; the relay multiaddr is an optional advanced override, not something the installer derives or pins. See [`repos/obsidian-vessel/README.md`](repos/obsidian-vessel/README.md).

### Running your own hub or remote substrate

The spoke join above works against **any** hub — substitute the hub's host for the `HUB_DISCOVERY_URL` / `DISCOVERY_ENDPOINT` / `ACTIVITY_API_ENDPOINT` / `IDENTITY_VESSEL_URL` values and use a key that hub issued (`make issue-key NAME=…` on the hub).

One image serves every role: a full local substrate, a minimal hub (control plane + store + relay), or a compute-only spoke — selection is declarative via `ENABLED_ROLES` / `ENABLED_VESSELS` (`scripts/substrate/vessels.inventory.json`, applied at boot). Vessels behind NAT join over the libp2p relay via a sidecar. To stand up your own remote substrate or hub on a VM: `scripts/substrate/deploy-remote.sh` (ships the local image over SSH, no registry) or `scripts/substrate/deploy-hub.sh` (the VM pulls the repo, builds there, and runs the relay). Point vessel clones at your own fork with `SUBSTRATE_REPO_OWNER=<your-org>`. Full guide: [`docs/FEDERATION.md`](docs/FEDERATION.md).

## Working with the substrate

Each vessel is reached on a host-mapped port (`18xxx → 8xxx`); a few vessels are internal-only and reached via discovery.

**Iterate:**

```bash
# edit vessel source in repos/<vessel>/, then hot-reload it in the container:
make -C scripts/substrate restart-<vessel>

# validate against the local substrate (localhost:18080):
bun run validation/scripts/failure-mode-harness.ts
mcp__metabob__run_goal  goal="verify the change works"
```

**Key endpoints** (host-mapped on a full standalone substrate; see CLAUDE.md → *Reference: the running substrate*, and discover the live fleet rather than trusting any table — a spoke masks the units its hub serves):

| Host port | Vessel | Role |
|---|---|---|
| `localhost:18080` | activity-api | trace store + Thompson learner + activity-shape resolver |
| `localhost:18090` | development-vessel | `memoryNote` resolver + dev meta-activities |
| `localhost:18100` | discovery-vessel | vessel registry / routing fixed-point |
| `localhost:18210` | goal-host-vessel | `POST /run-goal` (goal dispatch), `POST /resolve` |
| `localhost:18250` | analysis-vessel | code-analysis resolver (source_code, problem_detection, …) |
| `localhost:18260` | concept-db | concept-graph shapes + dense (MiniLM) search |
| `localhost:18270` | stateful-ui-vessel | substrate UI panels |

Optional environment for the substrate's self-development loop: a GitHub credential (`SUBSTRATE_GIT_PAT`, or the host's SSH key via the host-sync timers) lets the substrate land its own commits — without one it runs and learns but cannot push. Full guide: [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md).

## Keeping submodule pointers current

This repo pins each vessel via a submodule gitlink (`repos/<vessel>` → a commit in that vessel's own repo, tracking its `dev` branch per `.gitmodules`). Vessels are developed and pushed independently (by the substrate's own cutover loop or by an operator working directly in a vessel checkout), so the pointer recorded here always lags the vessel's true `dev` HEAD by some amount. `.github/workflows/bump-submodules.yml` bounds that lag: on a schedule (and on manual dispatch) it resolves each submodule's latest `dev` commit with `git ls-remote` (no clone, no checkout — just a ref lookup), fast-forwards any gitlink that moved via `git update-index --cacheinfo`, and commits + pushes the result directly to `dev`. It runs as a GitHub Actions job, not a host cron or Makefile target, so currentness does not depend on any particular machine being on — the constraint recorded in this project's operating notes is that the substrate (and its supporting automation) must not rely on the host. A submodule the workflow's token cannot read (a private repo in a different GitHub org) is skipped with a warning rather than failing the run; the pointer for that submodule stays whatever the last successful bump (or manual `git submodule update --remote`) left it.

## Core components

- **activity-api** (`repos/activity-api`) — TypeScript/Bun/Hono backend. Execution-trace store, Thompson-Sampling learner, and resolver for the shapes it owns (traces, templates, metrics, goal paths, composition stats). Not a universal resolver.
- **discovery-vessel** (`repos/discovery-vessel`) — vessel capability registry with resolver contracts and per-mutation auth; the routing fixed-point.
- **goal-host-vessel** (`repos/goal-host-vessel`) — wraps `GoalHost` from `ias-executor-ts`; primary dispatch target for all goal execution, with in-flight goal-seeking + a goal-reaching gate.
- **llm-resolver-vessel** / **local-tools-vessel** / **ribosome-vessel** / **boredom-vessel** — LLM completion, filesystem/process tools, template extraction from successful traces, and the autonomous idle/topology loop, respectively.
- **concept-db** (`repos/concept-db`) — concept-graph shapes + dense semantic search.
- **development-vessel** (`repos/development-vessel`) — meta-vessel for substrate self-development; owns the authoritative `memoryNote` store.
- **identity-vessel** (`repos/identity-vessel`) — single source of truth for authentication (HMAC API keys + JWT issuance).
- **analysis-vessel** (`repos/analysis-vessel`) — code-analysis resolver (supersedes the standalone analysis-api as the discovery-registered surface).
- **workbench** (`repos/workbench`) — observability and human-in-the-loop authoring surface over `activity-api` (activities, executions, the learning loop).
- **stateful-ui-vessel** (`repos/stateful-ui-vessel`) — the substrate's own UI: a pool of panels and interactor impulses served as a three-region view (pool / execution / decisions).
- **obsidian-vessel** (`repos/obsidian-vessel`) — the human interface; each connected vault is a surface to a different human resolver, reached through the vessel's sidecar conduit.

## Learning loop

1. **Recommend** — Thompson Sampling selects an activity variant.
2. **Execute** — the activity runs, producing an execution trace.
3. **Record** — the trace is stored with success/failure, cost, and duration.
4. **Learn** — α/β posteriors update for future selection; impulse-relevance and resolver metrics feed back.
5. **Extract** — successful executions become reusable templates (ribosome).

**Reuse before minting:** before minting a new activity/resolver, prefer an existing producer of the needed output shape. Reuse sharpens posteriors and raises the credit-mixing rate (λ₁); minting is the justified exception, not the default. See CLAUDE.md → *The laws*, law 3.

## Key design principles

1. **Impulses are universal data** — everything is an impulse with metadata; resolvers access content.
2. **Activities constrain search** — without activities, infinite options; with them, ranked finite options.
3. **Resolvers live where data lives** — don't centralize resolution; the backend only stores traces.
4. **Metadata first, content later** — reasoners see metadata to decide; resolvers load content to execute.
5. **Record everything** — every execution is traced; this is the raw material for learning.
6. **Learn from traces** — Thompson Sampling, relevance scores, ribosome extraction.
7. **Reserve improvisation** — when nothing matches, try something new, but record it.
8. **LLMs are tools, not controllers** — use LLMs for reasoning; deterministic resolvers for everything else.

## Documentation

**[`docs/README.md`](docs/README.md) is the full documentation index** — every guide under `docs/`, grouped by what it is for. The handful below are the entry points.

- [`CLAUDE.md`](CLAUDE.md) — authoritative working guide (the laws, the dispatch loop, the operator role, fleet anchors).
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — canonical system definition.
- [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) — local single-container substrate: quick-start, iteration, backing up learning state.
- [`docs/architecture/`](docs/architecture/) — the `SUBSTRATE_AS_*` lenses (dynamics, MDP, network, representation, DEC, fleet, software) and supporting design docs.
- [`docs/RBAC_GUIDE.md`](docs/RBAC_GUIDE.md), [`docs/AUTH_JWT_CLAIMS.md`](docs/AUTH_JWT_CLAIMS.md) — multi-tenant isolation and auth claims.
- [`openspec/changes/`](openspec/changes/) — future-change proposals, designs, and tasks.
