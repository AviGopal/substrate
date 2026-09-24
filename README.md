# substrate — a self-improving development substrate

**An autonomous AI development system built on the impulse–activity foundation, with Thompson Sampling for continuous learning. The system develops itself: goals are dispatched into a running substrate, every execution is traced, and successful patterns become reusable templates.**

> **Start here:** [`CLAUDE.md`](CLAUDE.md) is the authoritative, continuously-maintained description of how to work in this repo. This README is a high-level orientation; when the two disagree, CLAUDE.md wins. When either disagrees with the running substrate, the running substrate wins.
>
> **All documentation:** [`docs/README.md`](docs/README.md) is the index of everything under `docs/` — architecture lenses, operations guides, and reference material. This README links only a handful of them.

## Overview

The substrate demonstrates:

- **Impulse–Activity architecture** — universal data (*impulses*) processed through constrained state transitions (*activities*).
- **Learning loop** — Thompson Sampling for activity selection, Bayesian relevance scoring for impulses, and extraction of reusable templates from successful traces (see *Learning loop* below for which extractor actually runs).
- **Vessel pattern** — capabilities are provided by *vessels* (bundles of activities + resolvers + lifecycle hooks) that live where their data lives.
- **Self-governance / autonomy** — the substrate detects its own operational gaps, proposes and verifies changes, and lands them through the **mitosis cutover** loop, moving along the S1 → S2 → S3 autonomy trajectory (operator-authored development → substrate-authored development under supervision → a system that resists harmful intervention with cited evidence).

## Architecture foundation

> **Canonical reference:** [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)

### Core concepts

**Impulses** — data in any form (text, structured data, signals, commands) with metadata for reasoning. Lazy-loaded pointers; reasoners see the shape/summary, resolvers load content:

```typescript
{
  id: "error-log",
  pointer: { type: "file", path: "error.log" },
  metadata: { shape: "error_log" },   // shape lives on metadata, not at top level
  loaded: false,                       // lazy: content is absent until a resolver loads it
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

Conscious one-off direct edits to vessel source are gated by a PreToolUse hook and require `SUBSTRATE_ALLOW_DIRECT_EDIT=1`; docs, scripts, tests and config are never gated. See CLAUDE.md → *How work happens: dispatch, don't edit*.

## Installation

This section is the only place setup commands appear; every other document links here.
The command blocks of sequences A, B and C are fenced `install:standalone`, `install:hub`
and `install:spoke`: the acceptance run executes one case's blocks verbatim on a fresh host
for every published image, on Docker and on Podman, so this page is tested rather than
trusted. Values a reader types in place of a placeholder reach the run through the
environment, which the manifest reads ahead of `.env`: the provider key in every case, and
for the hub and spoke cases the address the hub advertises, its discovery endpoint and the
key it issued, without which those cases cannot run.

The whole system runs as **one privileged container** hosting the vessel fleet as systemd
units, from the public image `ghcr.io/avigopal/substrate:dev` (it pulls anonymously; no
login, no token, no checkout). The image is the installer: every derivation (role,
endpoints, secrets, seeding, readiness) runs inside it, and the host holds only a
declaration, the launch manifest `docker-compose.yml` and a `.env` of install inputs.
(`ghcr.io/avigopal/substrate:obsidian` adds an in-container Obsidian over noVNC.)

**Prerequisites:** a container engine that allows privileged containers, with compose:
Docker with `docker compose`, or Podman with `podman compose` (rootless supported).
`docker` below works identically with `podman`. Nothing else is needed on the host for the
substrate itself; the cockpit adds node/npx.

### Where things run

| Plane | What lives there | Written by | Survives |
|---|---|---|---|
| **Host** | the container engine; `docker-compose.yml`; `.env` (install inputs only) | the operator, once | the host |
| **Container** | systemd + the vessel fleet; `/etc/substrate/env` (generated each boot) | the image, at boot | nothing: regenerated every boot |
| **Workspace volume** `<name>-workspace` | `.substrate-secrets`, git clones, the memoryNote store, the dynamic-vessel registry (`installed.json`), gap store, snapshots | the substrate | recreate and upgrade |
| **Datastore volume** `<name>-surreal` | traces, posteriors, concept graph, identity | the substrate | recreate and upgrade |
| **Hub** | the network's identity, trace store, learner, gap store, concept graph | the hub fleet | independently of spokes |
| **Git origin** (`SUBSTRATE_REPO_OWNER`) | the code every fleet converges to at boot | substrates with push capability, operators | always |
| **Client** | `~/.metabob/config.json` and the cockpit registration | `substrate-connect` output | until teardown |
| **CI** | acceptance runs: judge only, no state | the workflow | per run |

### Profiles: what runs where, and why

| Profile | Runs | Local data | Resolves remotely | Use it for |
|---|---|---|---|---|
| `standalone` (root default) | everything: store, control, api, models, compute, ui, transport, autonomy | all of it | nothing | one self-contained substrate |
| `hub` | registry, identity, trace store + learner, stores, models, transport + relay, plus goal-host, development, local-tools, ribosome, analysis, light-dispatch, and the self-development loop (autonomy + boredom) | the network's learning state and gap store | nothing | the network's home; it dispatches and self-develops next to its posteriors (its landings still need push capability) |
| `hub-minimal` | the `hub` role without compute | as `hub` | goal execution (a spoke) | a control-plane or relay-only node |
| `spoke` (remote-anchor default) | registry (local), compute, ui, transport | the host's files and tools (why the spoke exists) | identity, traces, learning, lessons, LLM arms, from the hub | adding compute or local data to a network |
| `surface` | registry, transport, human surface | none | everything | a human's local window onto a network |
| `compute` | registry, transport, compute | the host's files and tools | everything else | a worker next to some data |

The rule behind the table (data locality): a spoke exists because some data lives on its
host (files, tools, a vault). Everything learned lives with the learner on the hub, so a
spoke never carries its own trace store or identity.

### Ports

The manifest publishes one set of ports on every profile, each derived from
`SUBSTRATE_PORT_PREFIX` (`P`, default `18`) as `P` followed by the last three digits of the
container port. A vessel the profile does not run does not answer, and the verdict checks
only the vessels the profile selects.

| Host port | Vessel | Must be reachable by | Profiles serving it |
|---|---|---|---|
| `P080` | activity-api (trace store) | clients, spokes | standalone, hub, hub-minimal |
| `P090` | development-vessel (memory, lessons) | clients, spokes | standalone, hub, spoke, compute |
| `P100` | discovery | clients, spokes, peers | all |
| `P101` | identity | clients, spokes | standalone, hub, hub-minimal |
| `P210` | goal-host | clients | standalone, hub, spoke, compute |
| `P250` | analysis | clients | standalone, hub, spoke, compute |
| `P260` | concept-db | spokes (lessons) | standalone, hub, hub-minimal |
| `P270` | stateful UI | humans | standalone, spoke |
| `P310` | human surface | humans | standalone, spoke, surface |
| `P333` | federation relay | spokes (libp2p) | hub, hub-minimal |

A hub's firewall list is this table filtered by "spokes". Exposure is decided only by the
manifest's port mapping: `127.0.0.1:P310:8310` keeps the surface on the local host.

### Configuration

| Tier | What | Where it lives | Read | Learnable? |
|---|---|---|---|---|
| **Install inputs** | the eight below | host `.env` | at boot, by gen-env | no (bootstrap, by design) |
| **Advanced bootstrap** | extra providers, `LLM_ARMS`, retention, federation overrides, `DISABLED_VESSELS`, `RELAY_PORT`, the `MITOSIS_DIRECT_PUSH` kill switch | host `.env`, forwarded by the manifest; documented only in [`docs/operations/CONFIGURATION_SURFACE.md`](docs/operations/CONFIGURATION_SURFACE.md) | at boot | no |
| **Generated secrets** | `JWT_SECRET`, `SURREAL_PASS`, API-key signing secret, the operator key | workspace `.substrate-secrets` | at boot | n/a (never hand-edited) |
| **Runtime policy** | vessel additions (`vessel-ctl install`), `pushPolicy`, `llmModelPolicy`, rhythms | impulses in the substrate | at use time | **yes** |
| **Client** | endpoint + key | `~/.metabob/config.json` (override: `METABOB_CONFIG_PATH`; a project-local `.metabob/config.json` shadows it) | by the cockpit | n/a |

**The install inputs**

| Input | Default | Required for |
|---|---|---|
| `SUBSTRATE_NAME` | `substrate` → `substrate-live`, `substrate-workspace`, `substrate-surreal` | — |
| `SUBSTRATE_PORT_PREFIX` | `18` | — |
| `PROFILE` | `standalone` (no anchor) / `spoke` (remote anchor) | hub, surface, compute |
| `DISCOVERY_ENDPOINT` + `METABOB_API_KEY` | unset | spoke, surface, compute |
| provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …) | unset | standalone, hub |
| `PUBLIC_IP` | unset | hub (the address spokes reach; `/bootstrap` advertises it) |
| `SUBSTRATE_GIT_PAT` + `SUBSTRATE_REPO_OWNER` | unset / unset (a token without an owner fails the launch) | self-development (push capability) |

Required inputs per profile: **standalone 1** (provider key); **spoke, surface, compute 2**
(the anchor + key pair); **hub 3** (`PROFILE`, provider key, `PUBLIC_IP`).

Rules:

- Nothing ambient: no launcher reads `~/.metabob`, `gh`, or another container's environment.
- Precedence at boot: explicit env > `.env` > persisted secret > default. An input that
  conflicts with its deprecated alias fails the launch.
- `HUB_DISCOVERY_URL` or `PEER_MULTIADDR` without `DISCOVERY_ENDPOINT` fails the launch; the
  system does not guess a role.
- A deprecated name alias that conflicts with `SUBSTRATE_NAME` fails at boot, before
  anything is written. On a new volume, so does a partial one (for example
  `SUBSTRATE_CONTAINER=lab` without both volume names), so a new container can never attach
  to another fleet's volumes; an install already running on its volumes is warned instead. The old names and their
  replacements are listed in the [configuration reference's migration table](docs/operations/CONFIGURATION_SURFACE.md#migration-retired-names).
- Changing an install input means `docker compose up -d` (recreate, volumes kept). Changing
  runtime policy never needs a restart.

### Setup sequences

Every sequence ends at a verdict level. `substrate-status` reports five ordered levels,
`live`, `seeded`, `served`, `usable` and `connected`, each `pass`, `fail` or `unknown`;
`--wait <level>` exits non-zero and prints the failing level unless that level passes.

#### A. Standalone (the default)

These are the default names: container `substrate-live`, volumes `substrate-workspace` and
`substrate-surreal`, ports `18xxx`. If `docker ps -a` already lists `substrate-live` or
`docker volume ls` lists `substrate-workspace` on this host, a fleet (however it was made)
already owns them: add sequence E's two inputs before step 3, or the new container attaches
to that fleet's volumes.

```bash install:standalone
# 1. Get the manifest (no checkout needed; or clone the repo and use its root file)
docker run --rm --entrypoint substrate-manifest ghcr.io/avigopal/substrate:dev > docker-compose.yml

# 2. Configure: one required input
echo 'ANTHROPIC_API_KEY=sk-ant-…' > .env

# 3. Launch
docker compose up -d

# 4. Wait for a reached goal (exits non-zero and prints the failing level otherwise)
docker exec substrate-live substrate-status --wait usable

# 5. Connect the cockpit. stdout is the config JSON only; the registration line and any
#    shadowing warning go to stderr, so the redirect is safe.
mkdir -p ~/.metabob
docker exec substrate-live substrate-connect > ~/.metabob/config.json
#    then run the `claude mcp add …` line it printed (node/npx required for the cockpit)
```

Step 5 writes the whole client configuration file; if `~/.metabob/config.json` already
points at another fleet, redirect to a different path and select it with
`METABOB_CONFIG_PATH` instead. Then make a first cockpit call (for example
`registry_query`), and read the full verdict:

```bash install:standalone
# 6. Print the full verdict. The exit status reflects `usable`; `connected` passes once
#    a cockpit call has reached the fleet, and reads `unknown` before that.
docker exec substrate-live substrate-status
```

`OPENAI_API_KEY` works in place of `ANTHROPIC_API_KEY`; exactly one provider key is
required, and every other secret is generated on first boot and persisted to the
workspace volume. The human surface is at `http://localhost:18310/`.

A fleet with no valid provider key boots, passes `live`, `seeded` and `served`, and fails
`usable` naming the missing key: health without usability is reported as such, not as
green.

#### B. Hub

As A, with `PROFILE=hub` and `PUBLIC_IP=<address spokes reach>` in `.env`:

```bash install:hub
docker run --rm --entrypoint substrate-manifest ghcr.io/avigopal/substrate:dev > docker-compose.yml
cat > .env <<'EOF'
PROFILE=hub
PUBLIC_IP=<address spokes reach>
ANTHROPIC_API_KEY=sk-ant-…
EOF
docker compose up -d
docker exec substrate-live substrate-status --wait usable
mkdir -p ~/.metabob
docker exec substrate-live substrate-connect > ~/.metabob/config.json
```

Open the ports the table marks "spokes". Issue a key per spoke:
`docker exec substrate-live substrate-key issue <spoke-name>` (the full key is printed once
and never stored). The hub reaches `usable` on its own because it dispatches: the `hub`
profile carries goal-host and the compute vessels next to the posteriors. `hub-minimal`
leaves compute out for a control-plane or relay-only node. The federation relay runs inside
the container on `P333`, and `/bootstrap` advertises it at `PUBLIC_IP`, which is why the
hub cannot omit that input.

To run a hub or any other node on a remote machine, copy the manifest and `.env` to it and
run the same sequence there.

#### C. Spoke

```bash install:spoke
docker run --rm --entrypoint substrate-manifest ghcr.io/avigopal/substrate:dev > docker-compose.yml
cat > .env <<'EOF'
DISCOVERY_ENDPOINT=http://<hub-host>:18100
METABOB_API_KEY=<key issued by the hub>
EOF
docker compose up -d
docker exec substrate-live substrate-status --wait served
mkdir -p ~/.metabob
docker exec substrate-live substrate-connect > ~/.metabob/config.json
```

The role, the hub endpoints and the relay anchor are derived from the two inputs. The spoke
waits for `served`: `usable` needs an LLM arm, and until federated arm inheritance lands a
keyless spoke has none. Add a provider key to `.env` and wait for `usable` if the spoke must
resolve models itself. The last two lines connect the cockpit as in A, step 5; run the
`claude mcp add …` line `substrate-connect` printed.

What joining means, and how to tell it happened:

- **It must be `DISCOVERY_ENDPOINT`.** That variable naming a remote host is what makes the
  container a spoke; `HUB_DISCOVERY_URL` alone is refused rather than guessed.
- **Reachable is not joinable.** A standalone substrate answers `/bootstrap` too, with an
  empty relay list. `curl -s http://<hub-host>:18100/bootstrap` should list a relay address
  on the hub's own host; an address on another host is an advertisement that outlived its
  relay.
- **A running transport is not a joined one.** An anchorless transport runs direct-only and
  reports `active` while mirroring nothing, and without a circuit the spoke also loses the
  hub's `llm_completion` and concept-db. The evidence is the reservation, read inside the
  container (the transport's health port is not published):
  `docker exec substrate-live curl -s http://127.0.0.1:8401/health`, where
  `.transport.activeReservations` of `0` means not federated. Identity is the other
  discriminator: a spoke runs no identity-vessel, so a valid
  `docker exec substrate-live substrate-key whoami` can only have come from the hub.
- **A joining spoke writes to the hub.** Its seeder registers the shared activity templates
  into the hub's trace store with the issued key (idempotent upserts). A spoke you do not
  fully trust should get a read-scoped key, or `DISABLED_VESSELS=bootstrap-seeder`.
- To make the spoke's vessels dialable from the hub behind NAT, give it a unique id once
  after boot: `docker exec substrate-live spoke-federate substrate-live <unique-id>`; its
  vessels then appear in the hub registry as `<vessel>@<unique-id>`.

Protocol and concepts: [`docs/FEDERATION.md`](docs/FEDERATION.md).

#### D. Surface (a human's local window)

As C, with `PROFILE=surface`. To keep the surface on the local host, map
`127.0.0.1:P310:8310` in a compose override. `served` passes when the surface answers.

A human can also work from an Obsidian vault. The plugin installer lives in a submodule and
needs only the two inputs the plugin reads, an API key and the discovery endpoint:

```bash
git submodule update --init repos/obsidian-vessel
bash repos/obsidian-vessel/install.sh --local            # same-machine substrate
bash repos/obsidian-vessel/install.sh                    # interactive: vault → host → key
```

At start the plugin's federation sidecar reads `<discovery-endpoint>/bootstrap` for the
relay anchor. See [`repos/obsidian-vessel/README.md`](repos/obsidian-vessel/README.md) and
[`docs/HUMAN_SURFACE.md`](docs/HUMAN_SURFACE.md).

#### E. A second fleet on one host

Required whenever this host already runs a fleet under the default names (see A). Add
`SUBSTRATE_NAME=lab` and `SUBSTRATE_PORT_PREFIX=24` to the `.env` of any sequence above.
This gives container `lab-live`, volumes `lab-*` and ports `24xxx`; replace `substrate-live`
with `lab-live` in the `docker exec` commands. Prefixes 19–32 avoid the ephemeral range.
Keep each fleet's manifest and `.env` in its own directory.

#### F. Enabling self-development

Add `SUBSTRATE_GIT_PAT` (write access to your repos) and `SUBSTRATE_REPO_OWNER=<your fork
owner>`. The substrate is then autonomous against your fork. Landing on a branch other fleets
converge to requires a `pushPolicy` promotion earned by settled, verified landings. The
emergency stop is `MITOSIS_DIRECT_PUSH=0` followed by `docker compose up -d`. Without a
token the substrate runs and learns, and its self-authored commits stay local.

A new install starts under an initial `pushPolicy` with no promotion, written on its first
boot. The policy is runtime state, read at every landing, so changing it needs no restart.
Through the cockpit's `resolve_impulse`:

| To | Resolve |
|---|---|
| read it | `{type: "pushPolicy"}` |
| record a promotion | `{type: "pushPolicy_write", promotion: {granted: true, targets: ["<owner>[/<repo>][@<branch>]"], evidence: {attempt_ids: [...], trace_ids: [...]}}, shared_targets: [...], set_by, reason}`; every cited attempt must be settled `held` and every trace graded `reached`, or nothing is written |
| withdraw it | the same write with `promotion: {granted: false}` |

`targets` and `shared_targets` are optional: no `targets` covers every shared target, and
`shared_targets` marks branches of your own owner that other fleets converge to.

#### G. From source (developers)

```bash
git clone --recurse-submodules https://github.com/AviGopal/substrate.git && cd substrate
make -C scripts/substrate up REBUILD=1    # build (needs bun) → the same compose → status → connect
```

`make up` is a wrapper: it runs exactly sequence A against a locally built tag, with the same
`.env`, and exits non-zero unless the verdict reaches `usable`. Building needs git with
submodule access and bun in addition to the engine.

`.gitmodules` pins each vessel by a URL relative to the superproject (`../<vessel>.git`), so
a fork resolves its own submodules with no rewrite rule. The vessel repos are public; verify
with `git config -f .gitmodules --get-regexp url` and `git ls-remote <url>`. For a fork
whose vessels are private, scope any URL rewrite to that one org
(`git config --global url."git@github.com:your-org/".insteadOf "https://github.com/your-org/"`);
the unscoped form rewrites every GitHub URL and breaks anonymous cloning everywhere.

### Usage patterns

| Want | Do | Notes |
|---|---|---|
| Give the substrate work | the cockpit: `run_goal_async` → `goal_status` (read `reached`) → `goal_reasoning` → `provide_feedback` | humans: the surface on `P310` |
| Know whether it is healthy | `docker exec <c> substrate-status` | five levels; image revision, and each vessel's running revision where pull-sync moved it |
| Report a failed install | `docker exec <c> substrate-status --report` | posts a human-reported `installAcceptance` to the anchor; files a gap |
| Stop / start | `docker compose stop` / `docker compose start` | the grace period covers the drain and the datastore flush |
| Upgrade the image | `docker compose pull && docker compose up -d` | volumes kept; code also converges to origin at boot |
| Change an install input or profile | edit `.env`, then `docker compose up -d` | recreate; volumes, installed vessels and secrets kept |
| Add or remove one vessel at runtime | `docker exec <c> vessel-ctl install <v>` / `uninstall <v>` | persisted in the workspace; survives recreate |
| Issue or revoke keys | `docker exec <c> substrate-key issue <name>` / `revoke <id>` | hub-issued keys join spokes |
| Point a client elsewhere | re-run `substrate-connect` against that fleet | one config path, one override variable |
| Back up | `docker compose stop`, then archive both volumes | restore volumes, then `docker compose up -d` |
| Leave a network | remove the anchor pair from `.env`, then `docker compose up -d` | becomes standalone and needs a provider key |
| Tear down, keep state | `docker compose down` | |
| Tear down, destroy state | `docker compose down -v`; remove the fleet's entry from `~/.metabob/config.json`; `claude mcp remove metabob` | destroys all learning state: posteriors, traces, concept graph, memory. It removes the volumes this directory's `SUBSTRATE_NAME` names, whichever fleet created them: with the default name that is any `substrate-*` fleet on the host |
| Know setup works for everyone | the acceptance run on each published digest (Docker and Podman) | CI judges and gates `:dev`; results and gaps land in the hub |

`docker rm` alone leaves both volumes, so a later install with the same `SUBSTRATE_NAME`
silently inherits the old fleet's learning state; `down -v` is the destructive form.

## Working with the substrate

Setup, stop/start, upgrade, backup and teardown are in *Installation → Usage patterns*
above; the ports are in *Installation → Ports*. This section is the development loop on a
running fleet.

**Iterate:**

> ⚠ **Nothing on your host is bind-mounted into the container.** Editing
> `repos/<vessel>/` on the host and then restarting the unit runs the *old*
> code — the restart is real, the edit simply never arrived. The container has
> its own clone, and **git is the only channel** into it.

```bash
# 1. land the change in the vessel's repo (dispatching a goal is the traced path;
#    a direct commit+push to origin/dev works too)
# 2. pull it into the container and rebuild/restart what changed:
docker exec <container> substrate-pull-sync

# a single vessel, without waiting for the periodic sync:
docker exec <container> vessel-ctl sync <vessel>     # git pull --ff-only + mirror + restart

# validate against the local substrate:
bun run validation/scripts/failure-mode-harness.ts
mcp__metabob__run_goal  goal="verify the change works"
```

Scripting against HTTP instead of the cockpit: `POST /run-goal` on goal-host (`P210`)
returns a `dispatchId`, and `GET /executions/<dispatchId>` reports it. Read **`reached`**,
not `status`: `status` is only the template's exit code. Traces live on activity-api
(`P080`), an authenticated JSON API rather than a web page.

**Day-two operations.** Each verb is documented in [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md);
this table exists so you know the verb exists at all.

| Need | Command |
|---|---|
| Is it *correct*? | `docker exec <c> substrate-doctor`: auth, registry, restart loops, and whether an LLM arm can actually complete. Costs a real completion per arm; don't loop it. |
| What's running / restarting? | `docker exec <c> vessel-ctl status` (services; `restarts=` is the cheap tell) · `systemctl list-timers` for the timer half |
| Preview a selection change | `docker exec <c> env DRY_RUN=1 ENABLED_ROLES=<roles> apply-inventory`: read-only, and the one instrument that reports honestly on every selection variable |
| Inventory vs reality | `vessel-ctl drift` (read-only) → `vessel-ctl apply` (converges; **no action lines = converged**) |
| Add / remove a capability | `vessel-ctl list` · `install <v>` · `uninstall <v>` · `deregister <v>` (registry only, leaves the unit alone) |
| Update the code | `substrate-pull-sync`: converges vessels *and* the fleet tooling from git |
| Where did this setting come from? | `docker exec <c> substrate-config`: `unrecorded` means "this tool cannot answer", not "your value won" |

**Resource footprint:** the image is ~0.7 GB; a fleet that has been learning for a while
carries a workspace volume in the high hundreds of MB and grows with trace retention
(`TRACE_STORE_CAP`).

## Keeping submodule pointers current

This repo pins each vessel via a submodule gitlink (`repos/<vessel>` → a commit in that vessel's own repo, tracking its `dev` branch per `.gitmodules`). Vessels are developed and pushed independently (by the substrate's own cutover loop or by an operator working directly in a vessel checkout), so the pointer recorded here always lags the vessel's true `dev` HEAD by some amount. `.github/workflows/bump-submodules.yml` bounds that lag: on a schedule (and on manual dispatch) it resolves each submodule's latest `dev` commit with `git ls-remote` (no clone, no checkout — just a ref lookup), fast-forwards any gitlink that moved via `git update-index --cacheinfo`, and commits + pushes the result directly to `dev`. It runs as a GitHub Actions job, not a host cron or Makefile target, so currentness does not depend on any particular machine being on — the constraint recorded in this project's operating notes is that the substrate (and its supporting automation) must not rely on the host. A submodule the workflow's token cannot read (a private repo in a different GitHub org) is skipped with a warning rather than failing the run; the pointer for that submodule stays whatever the last successful bump (or manual `git submodule update --remote`) left it.

## Core components

- **activity-api** (`repos/activity-api`) — TypeScript/Bun/Hono backend. Execution-trace store, Thompson-Sampling learner, and resolver for the shapes it owns (traces, templates, metrics, goal paths, composition stats). Not a universal resolver.
- **discovery-vessel** (`repos/discovery-vessel`) — vessel capability registry with resolver contracts; the routing fixed-point. Auth is applied to every route, with `/bootstrap` deliberately carved out as pre-auth so a joining spoke can read the anchor before it has been accepted.
- **goal-host-vessel** (`repos/goal-host-vessel`) — wraps `GoalHost` from `ias-executor-ts`; primary dispatch target for all goal execution, with in-flight goal-seeking + a goal-reaching gate.
- **llm-resolver-vessel** / **local-tools-vessel** / **ribosome-vessel** / **boredom-vessel** — LLM completion, filesystem/process tools, template extraction from successful traces (*proposal-only by default — see* Learning loop, *step 5*), and the autonomous idle/topology loop, respectively. llm-resolver-vessel also owns the LLM model policy.
- **concept-db** (`repos/concept-db`) — concept-graph shapes + dense semantic search.
- **development-vessel** (`repos/development-vessel`) — meta-vessel for substrate self-development; owns the authoritative `memoryNote` store.
- **identity-vessel** (`repos/identity-vessel`) — single source of truth for authentication (HMAC API keys + JWT issuance).
- **analysis-vessel** (`repos/analysis-vessel`) — code-analysis resolver (supersedes the standalone analysis-api as the discovery-registered surface).
- **workbench** (`repos/workbench`) — *source-only, not part of the running fleet.* An observability and human-in-the-loop authoring surface over `activity-api`. It ships no systemd unit, is absent from `scripts/substrate/vessels.inventory.json`, and no deployment publishes a port for it — do not expect to find it on a running substrate.
- **stateful-ui-vessel** (`repos/stateful-ui-vessel`) — the substrate's own UI: a pool of panels and interactor impulses served as a three-region view (pool / execution / decisions).
- **obsidian-vessel** (`repos/obsidian-vessel`) — the human interface; each connected vault is a surface to a different human resolver, reached through the vessel's sidecar conduit.

## Learning loop

1. **Recommend** — Thompson Sampling selects an activity variant.
2. **Execute** — the activity runs, producing an execution trace.
3. **Record** — the trace is stored with success/failure, cost, and duration.
4. **Learn** — α/β posteriors update for future selection; impulse-relevance and resolver metrics feed back.
5. **Extract** — successful executions become reusable templates. Several paths
   mint them, and which one dominates changes over time, so **read the pool
   rather than trusting any list here**:

   ```bash
   curl -s "$ACTIVITY_API/v2/activities/templates?limit=100" \
     -H "Authorization: ApiKey $KEY" | jq -r '.templates[] | "\(.created_at)  \(.id)"' | sort -r
   ```

   One thing worth knowing before you read that output: the **ribosome** is the
   intended extractor and it is **not** currently what mints. Its
   `ribosome-extract` template defaults `applyExtraction` to `false`, and its own
   notes record that in that mode nothing is registered in the pool. So a
   template you find was authored by some other path — treat "the ribosome mints
   templates" as the design, not as a description of today.

**Reuse before minting:** before minting a new activity/resolver, prefer an existing producer of the needed output shape. Reuse sharpens posteriors and adds a composition edge; minting is the justified exception, not the default. (The intended mechanism is a rise in the credit-mixing rate λ₁ — stated as design, not as a measurement: activity-api's own source notes that the two live governors calling themselves λ₁ compute different quantities, so no λ₁ claim is currently falsifiable.) See CLAUDE.md → *The laws*, law 3.

## Key design principles

1. **Impulses are universal data** — everything is an impulse with metadata; resolvers access content.
2. **Activities constrain search** — without activities, infinite options; with them, ranked finite options.
3. **Resolvers live where data lives** — don't centralize resolution. `activity-api` is the trace store *and* the learner: it also serves the Thompson posteriors and template writes. What it must not become is a general-purpose resolver for other vessels' data. (The LLM model policy is the worked example of the rule: it is owned by llm-resolver-vessel, where the arms live, not by the learner.)
4. **Metadata first, content later** — reasoners see metadata to decide; resolvers load content to execute.
5. **Record everything** — every execution is traced; this is the raw material for learning.
6. **Learn from traces** — Thompson Sampling, relevance scores, and template extraction (which path mints today: see *Learning loop*, step 5 — it is not the ribosome).
7. **Reserve improvisation** — when nothing matches, try something new, but record it.
8. **LLMs are tools, not controllers** — use LLMs for reasoning; deterministic resolvers for everything else.

## Documentation

**[`docs/README.md`](docs/README.md) is the full documentation index** — every guide under `docs/`, grouped by what it is for. The handful below are the entry points.

- [`CLAUDE.md`](CLAUDE.md) — authoritative working guide (the laws, the dispatch loop, the operator role, fleet anchors).
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — canonical system definition.
- [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) — operating reference for the single-container substrate: inventory and profiles, `vessel-ctl`, the iteration loop, troubleshooting.
- [`docs/architecture/`](docs/architecture/) — the `SUBSTRATE_AS_*` lenses (dynamics, MDP, network, representation, DEC, fleet, software) and supporting design docs.
- [`docs/RBAC_GUIDE.md`](docs/RBAC_GUIDE.md), [`docs/AUTH_JWT_CLAIMS.md`](docs/AUTH_JWT_CLAIMS.md) — multi-tenant isolation and auth claims.
- [`openspec/changes/`](openspec/changes/) — future-change proposals, designs, and tasks.
