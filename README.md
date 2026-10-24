# substrate

**A system that decides for itself what to do next, using the record of what has worked when it chose before.**

## The idea

An agent acts when prompted. Put on a loop, it keeps acting, but nothing guarantees that what it does serves its own continued operation; today that guidance comes from a harness people write around it. Substrate moves that guidance inside, as something the system runs and improves itself.

It is built from a few kinds of parts, of which it can have any number: *impulses* (data, carried as references with metadata), *pointers* (the address and type of an impulse, its *shape*), *resolvers* (functions that do one step's work) and *vessels* (services that host resolvers where their data lives). Three mechanisms act on them:

- **Direction.** Each action is described by the shapes it consumes and produces, so a goal is approached by chaining backward from what it needs to what is already at hand.
- **Selection.** Which action to take is chosen from the current context, by what has worked in similar contexts before.
- **Reduction.** Sequences of choices that work are compressed into single reusable actions, so the same kind of goal takes fewer choices over time.

Running continually, the system keeps what persists (outputs that later steps go on to use, fixes that stay fixed) and lets the rest fall away. What it decides to do next is the test of what it did.

## Built from known parts

Nothing here is new on its own. Each mechanism has long precedent: backward chaining over typed actions in classical planning, context-conditioned selection in contextual bandits and Thompson sampling, reduction in macro-operators, chunking and library learning, parts that live with their data in actor and service-discovery systems, and language models used as one tool among many. [`docs/architecture/LITERATURE_COMPARISON.md`](docs/architecture/LITERATURE_COMPARISON.md) compares the design with related research.

## The open question

What is not settled is the composition: whether these mechanisms keep working together when the system runs continuously on itself. Selection has to stay meaningful while reduction changes what is being selected, grading has to stay grounded while the system changes its own work, and the whole has to stay stable without someone holding it up.

## How it is judged

On randomly drawn goals, against an agent running in a conventional harness, under a protocol fixed before the run. A result counts only as an improvement over that control: fewer choices per goal reached as experience accumulates, outputs that later steps actually use, and useful work per operator intervention.

## Where to go next

- **See it work:** [A goal, end to end](#a-goal-end-to-end), one goal from request to verdict.
- **What it is:** [Overview](#overview) and [Core concepts](#core-concepts) below. The canonical definition is [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md).
- **Run one:** [Quick start](#quick-start) (one command), part of [Installation](#installation), the only place setup commands appear.
- **Use one as a person:** [`docs/HUMAN_SURFACE.md`](docs/HUMAN_SURFACE.md).
- **Read next:** [`docs/README.md`](docs/README.md), the documentation index, grouped by what each document is for.

**Agents working in this repository** start from [`CLAUDE.md`](CLAUDE.md), the operating manual: the laws, the dispatch loop and the operator role. When a document disagrees with the running substrate, the running substrate wins.

## A goal, end to end

An example goal, sent from the agent cockpit (a person types the same sentence into the human surface):

```
mcp__metabob__run_goal_async  goal="list the HTTP routes activity-api serves, and which of them require authentication"
```

**What the walk does.**

1. **Infers the target.** It reads the goal for the shape of an answer that would satisfy it: here, a report pairing each route with its authentication requirement.
2. **Chains backward.** From that target shape it looks for activities that produce it, then for producers of *their* inputs, until it reaches shapes it already holds, such as the goal text and the vessel's source tree. Where several producers fit, it chooses by learned posterior (Thompson sampling). Where none exists yet, a tool-enabled step bridges the gap: by design, no goal is out of reach merely because nothing has been learned for it.
3. **Binds and runs.** Each step's output is bound, shape to shape, into the next step's input, and each task goes to a resolver: for instance a deterministic one to list and read the source files, and an LLM to assemble the report from what they returned.
4. **Traces every step**: inputs, outputs, the resolver used, cost and duration.

**What comes back.** The dispatch returns a `dispatchId` at once. `goal_status` then gives the shapes it produced and the `reached` verdict, `execution_trace` holds the output itself, and `goal_reasoning` reconstructs the walk's decision log: which target it inferred, which producers it chose, and why.

**How reach is judged.** After execution, a judge reads the produced output against the goal and asks whether the goal was reached. A clean exit is not enough: a run that completes but produces something other than what was asked is `reached:false`. On `reached:false` the walk penalises that approach, excludes it, and tries a different one, within a bounded number of attempts. A verdict you record with `provide_feedback` is kept in the verification corpus that the judge is checked and calibrated against.

**What it learns.** The verdict is what grades the activities that ran, and a pathway that reached is recorded against the goal. A later goal with the same intent should run over that pathway directly, and a similar goal should reuse it and walk only the difference: other inputs at the start, or another output shape at the end.

**Code changes are goals too.** A goal that names a source file in one of the vessel repositories and describes the change is routed to a composer that drafts the edit, checks that it typechecks, and lands it as a traced commit, which is then judged like any other goal.

## Overview

The substrate is built from:

- **Impulse–Activity architecture** — universal data (*impulses*) processed through constrained state transitions (*activities*).
- **The walk** — goal execution as backward-chaining over the shape graph. It is held to a floor and a ceiling: at worst it does what a reason–act–observe agent would, with every step traced; at best it runs a pathway it has already learned.
- **Learning loop** — Thompson Sampling for activity selection, Bayesian relevance scoring for impulses, and extraction of reusable templates from executions that reached their goal (see *Learning loop* below).
- **Vessel pattern** — capabilities are provided by *vessels* (bundles of activities + resolvers + lifecycle hooks) that live where their data lives.
- **Self-development under a contract** — the substrate detects its own operational gaps, drafts changes, and lands them through the **mitosis cutover** loop. What counts is defined by a contract, not by activity. A landing is judged after it lands: was the goal behind it reached (a clean exit is not enough), and did verification run against the landed tree ([`docs/process/QUALIFICATION.md`](docs/process/QUALIFICATION.md))? Dissent is part of the same contract. The system may decline a goal or resist an intervention, but it must give its reason as evidence, never as a silent failure ([`docs/architecture/SUBSTRATE_AS_SOVEREIGN.md`](docs/architecture/SUBSTRATE_AS_SOVEREIGN.md)). The trajectory runs S1 → S2 → S3: operator-authored development, then substrate-authored development under supervision, then a system that resists harmful intervention with cited evidence.

## Architecture foundation

> **Canonical reference:** [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)

### Core concepts

In plain terms: a **vessel** is a service; an **impulse** is a reference to a piece of data, with metadata; a **shape** is the type key that routes it; an **activity** is a reusable, graded procedure; a **resolver** is the function that does one step's work; the **walk** is the planner that chains activities from a goal back to what is already known; the **ribosome** turns a run that reached its goal into a reusable activity. The [glossary](docs/GLOSSARY.md) has the full list.

**Impulses** — data in any form (text, structured data, signals, commands) with metadata for reasoning. Lazy-loaded pointers; reasoners see the shape/summary, resolvers load content:

```typescript
{
  id: "error-log",
  pointer: { type: "file", path: "error.log" },
  metadata: { shape: "error_log" },   // the shape: metadata.shape when set, else pointer.type
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

The default development loop is **not** "hand-edit a file and run tests." It is to **dispatch the change as a goal** so it runs as a traced activity and feeds the learning loop. The agent-facing dispatch surface is the **metabob-mcp** cockpit — `mcp__metabob__run_goal` for short one-shot goals, `mcp__metabob__run_goal_async` for anything non-trivial (both reach `goal-host-vessel`). Goals can also be sent over plain HTTP, with an API key issued by `substrate-key issue` (see *Usage patterns*):

```bash
curl -s -X POST http://127.0.0.1:18210/run-goal \
  -H "Authorization: ApiKey $KEY" -H 'Content-Type: application/json' \
  -d '{"goal": "list the HTTP routes activity-api serves"}'      # → { "dispatchId": … }
curl -s http://127.0.0.1:18210/executions/<dispatchId> -H "Authorization: ApiKey $KEY"   # read reached, not status
```

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
trusted. The run types values in place of the placeholders as a reader would: the
provider key in every case, and for the hub and spoke cases the address the hub
advertises, its discovery endpoint and the key it issued, without which those cases cannot
run. A third run upgrades a fleet from the published image to the new one by re-running
the install command, and requires that keys issued before the upgrade still validate.

The whole system runs as **one privileged container** hosting the vessel fleet as systemd
units, from the public image `ghcr.io/avigopal/substrate:dev` (it pulls anonymously; no
login, no token, no checkout). The image is the installer: every derivation (role,
endpoints, secrets, seeding, readiness) runs inside it, and the host holds only a
declaration, the launch manifest `docker-compose.yml` and a `.env` of install inputs.
(`ghcr.io/avigopal/substrate:obsidian` adds an in-container Obsidian over noVNC.)

**Prerequisites:** a container engine that allows privileged containers, with compose:
Docker with `docker compose`, or Podman with `podman compose` (rootless supported).
`docker` below works identically with `podman`. Nothing else is needed on the host for the
substrate itself; the cockpit adds node/npx and [Bun](https://bun.sh) (the cockpit server runs on Bun).

### Quick start

A standalone substrate on one host, in one command from sequence A below. Run it from
an empty directory, with your provider key in place of the placeholder. This block is a
copy for reading; the tested commands, the status check that follows, and what to do when
one fails, are in [A. Standalone](#a-standalone-the-default).

```bash
docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | ANTHROPIC_API_KEY=sk-ant-… sh
```

It installs and launches the fleet, waits until it has reached a goal, and writes the
client config. It prints a `claude mcp add …` line: run it to register the cockpit (which
needs node/npx and Bun). Once sequence A's status check reads `usable`, send a first goal
through the cockpit, as in [A goal, end to end](#a-goal-end-to-end), or open the human
surface at `http://localhost:18310/`.

### Where things run

| Plane | What lives there | Written by | Survives |
|---|---|---|---|
| **Host** | the container engine; `docker-compose.yml`; `.env` (install inputs only) | the operator, once | the host |
| **Container** | systemd + the vessel fleet; `/etc/substrate/env` (generated each boot) | the image, at boot | nothing: regenerated every boot |
| **Workspace volume** `<name>-workspace` | `.substrate-private/` (the persisted secrets store; root-only, masked from every unit), git clones, the memoryNote store, the dynamic-vessel registry (`installed.json`), gap store, snapshots | the substrate | recreate and upgrade |
| **Datastore volume** `<name>-surreal` | traces, posteriors, concept graph, identity | the substrate | recreate and upgrade |
| **Hub** | the network's identity, trace store, learner, gap store, concept graph | the hub fleet | independently of spokes |
| **Git origin** (`SUBSTRATE_REPO_OWNER`) | the code every fleet converges to at boot | substrates with push capability, operators | always |
| **Client** | `~/.substrate/config.json` (with `~/.metabob/config.json` kept as a link to it for the cockpit) and the cockpit registration | `substrate-connect` output | until teardown |
| **CI** | acceptance runs: judge only, no state | the workflow | per run |

### Profiles: what runs where, and why

| Profile | Runs | Local data | Resolves remotely | Use it for |
|---|---|---|---|---|
| `standalone` (root default) | everything: store, control, api, models, compute, ui, transport, autonomy | all of it | nothing | one self-contained substrate |
| `hub` | registry, identity, trace store + learner, stores, models, transport + relay, plus goal-host, development, local-tools, ribosome, light-dispatch, and the self-development loop (autonomy + boredom) | the network's learning state and gap store | nothing | the network's home; it dispatches and self-develops next to its posteriors (its landings still need push capability) |
| `hub-minimal` | the `hub` role without compute | as `hub` | goal execution (a spoke) | a control-plane or relay-only node |
| `spoke` (remote-anchor default) | registry (local), compute, ui, transport | the host's files and tools (why the spoke exists) | identity, traces, learning, lessons, LLM arms, from the hub | adding compute or local data to a network |
| `surface` | registry, transport, human surface | none | everything | a human's local window onto a network |
| `compute` | registry, transport, compute | the host's files and tools | everything else | a worker next to some data |

The rule behind the table (data locality): a spoke exists because some data lives on its
host (files, tools, a vault). Everything learned lives with the learner on the hub, so a
spoke never carries its own trace store or identity.

A profile decides placement, never capability. Every caller, whether a goal, a vessel, the
cockpit or a check, asks for a shape, and discovery routes it to whichever node serves that
shape, local or remote. So the set of vessels a container runs never changes what can be
done through it, only where the work runs and whose data it touches. A node that runs no
producer of a shape still resolves it through the network. When a request depends on one
specific node's data (a file on that host), it is still addressed by shape, and names the
node rather than a vessel.

### Ports

The manifest publishes one set of ports on every profile, each derived from
`SUBSTRATE_PORT_PREFIX` (`P`, default `18`) as `P` followed by the last three digits of the
container port. A vessel the profile does not run does not answer, and the verdict checks
only the vessels the profile selects.

| Host port | Vessel | Must be reachable by | Profiles serving it |
|---|---|---|---|
| `P080` | activity-api (trace store) | clients, spokes | standalone, hub, hub-minimal |
| `P090` | development-vessel (memory, lessons) | clients; spokes only over an authenticated channel, never a plain port (below) | standalone, hub, spoke, compute |
| `P100` | discovery | clients, spokes, peers | all |
| `P101` | identity | clients, spokes | standalone, hub, hub-minimal |
| `P210` | goal-host | clients | standalone, hub, spoke, compute |
| `P260` | concept-db | spokes (lessons), only over an authenticated channel, never a plain port (below) | standalone, hub, hub-minimal |
| `P270` | stateful UI | humans | standalone, spoke |
| `P310` | human surface | humans | standalone, spoke, surface |
| `P333` | federation relay | spokes (libp2p) | hub, hub-minimal |

A hub's firewall list is this table filtered by "spokes", less `P090` and `P260`. On a hub
reachable from a public network, never open those two as plain ports: they hold the hub's
private learning state (memory, gaps, lessons, concepts) and are not hardened for public
exposure.
The install provides no authenticated channel to them, so on such a hub a spoke cannot reach
the hub's lessons and memory; that is the cost of keeping them closed. Exposure is decided only by the
manifest's port mapping, set in the fleet's `.env` (these two are not taken from your shell) rather than by a compose override (an override
merges port lists and cannot narrow one): `HUMAN_SURFACE_PUBLISH_IP=127.0.0.1` in `.env` keeps
the surface on the local host, and `SUBSTRATE_PUBLISH_IP=127.0.0.1` keeps every port there.

### Configuration

| Tier | What | Where it lives | Read | Learnable? |
|---|---|---|---|---|
| **Install inputs** | the eight below | host `.env` | at boot, by gen-env | no (bootstrap, by design) |
| **Advanced bootstrap** | extra providers, `LLM_ARMS`, retention, federation overrides, `DISABLED_VESSELS`, `RELAY_PORT`, the `MITOSIS_DIRECT_PUSH` kill switch | host `.env`, forwarded by the manifest; documented only in [`docs/operations/CONFIGURATION_SURFACE.md`](docs/operations/CONFIGURATION_SURFACE.md) | at boot | no |
| **Generated secrets** | `JWT_SECRET`, `SURREAL_PASS`, API-key signing secret, the operator key | workspace `.substrate-private/substrate-secrets` | at boot | n/a (never hand-edited) |
| **Runtime policy** | vessel additions (`vessel-ctl install`), `pushPolicy`, `llmModelPolicy`, rhythms | impulses in the substrate | at use time | **yes** |
| **Client** | endpoint + key | `~/.substrate/config.json`, reached by the cockpit through the link `~/.metabob/config.json` (overrides: the installer honours `SUBSTRATE_CONFIG_PATH`, then `METABOB_CONFIG_PATH`; the cockpit honours only `METABOB_CONFIG_PATH`; a project-local `.metabob/config.json` shadows it for the cockpit) | by the cockpit | n/a |

**The install inputs**

| Input | Default | Required for |
|---|---|---|
| `SUBSTRATE_NAME` | `substrate` → `substrate-live`, `substrate-workspace`, `substrate-surreal` | — |
| `SUBSTRATE_PORT_PREFIX` | `18` | — |
| `PROFILE` | `standalone` (no anchor) / `spoke` (remote anchor) | hub, surface, compute |
| `DISCOVERY_ENDPOINT` + `METABOB_API_KEY` | unset | spoke, surface, compute |
| provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …) | unset | standalone, hub |
| `PUBLIC_IP` | unset | hub (the address spokes reach; `/bootstrap` advertises it) |
| `SUBSTRATE_GIT_PAT` + `SUBSTRATE_REPO_OWNER` | unset / unset (a first token without an owner fails the launch; a volume that already held a token keeps its default owner, with a warning) | self-development (push capability) |

Required inputs per profile: **standalone 1** (provider key); **spoke, surface, compute 2**
(the anchor + key pair); **hub 3** (`PROFILE`, provider key, `PUBLIC_IP`).

Rules:

- Nothing ambient: no launcher reads `~/.metabob`, `gh`, or another container's environment.
- Precedence at boot: explicit env > `.env` > persisted secret > default. An input that
  conflicts with its alias name fails the launch.
- `HUB_DISCOVERY_URL` or `PEER_MULTIADDR` without `DISCOVERY_ENDPOINT` fails the launch; the
  system does not guess a role.
- An alias name that conflicts with `SUBSTRATE_NAME` fails at boot, before
  anything is written. On a new volume, so does a partial one (for example
  `SUBSTRATE_CONTAINER=lab` without both volume names), so a new container can never attach
  to another fleet's volumes; an install already running on its volumes is warned instead. The alias names and the
  names they map to are listed in the [configuration reference's name table](docs/operations/CONFIGURATION_SURFACE.md#migration-retired-names).
- Changing an install input means `docker compose up -d` (recreate, volumes kept). Changing
  runtime policy never needs a restart.

### Setup sequences

Every sequence ends at a verdict level. `substrate-status` reports five ordered levels,
`live`, `seeded`, `served`, `usable` and `connected`, each `pass`, `fail` or `unknown`;
`--wait <level>` exits non-zero and prints the failing level unless that level passes.

#### A. Standalone (the default)

One command, with your provider key in place of the placeholder. Run it from an empty
directory, never from inside a clone of this repository: once the clone holds a `.env`
(sequence G reads its install inputs from one there), the installer takes the clone for
an existing fleet and reuses that `.env`, anchor included.

```bash install:standalone
# Install: writes the manifest and .env into ./substrate, launches, waits for a reached
# goal, and writes the client config to ~/.substrate/config.json (linked from
# ~/.metabob/config.json for the cockpit). Exits non-zero and
# prints the failing level if the fleet does not become usable.
docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | ANTHROPIC_API_KEY=sk-ant-… sh
```

Then run the `claude mcp add …` line it printed (the cockpit needs node/npx and Bun), make
a first cockpit call (for example `registry_query`), and read the full verdict:

```bash install:standalone
# Waits for `usable`: a pull-sync convergence right after install reads as waiting, not as a
# failure. The exit status reflects `usable`. `connected` passes once a cockpit call has
# reached the fleet, and reads `unknown` before that.
docker exec substrate-live substrate-status --wait usable
```

The image prints the installer, and `sh` runs it on the host. It runs the manual sequence
below and derives nothing: the image still judges every input at boot. Options go after
`sh -s --` and are listed by `docker run --rm ghcr.io/avigopal/substrate:dev install --help`.
`--pull always` fetches the current image each time, so running the same command again
later is also how a fleet is upgraded.
Secrets go before `sh` as environment variables, so they never appear in the command's
arguments. Re-running the same command from the same place updates that fleet: it rewrites
the manifest from the image, replaces the inputs you pass, and keeps the rest.

`OPENAI_API_KEY` (or any provider key the manifest lists, such as `OPENROUTER_API_KEY`)
works in place of `ANTHROPIC_API_KEY`. Exactly one provider key is required. Every other
secret is generated on first boot and persisted to the workspace volume. The human surface
is at `http://localhost:18310/`.

The installer refuses to start a new fleet whose names or ports another fleet on this host
already holds, and names what it found. Add `--name <n> --prefix <nn>` (sequence E). It
writes the client config only when the existing config is absent or already points at this
fleet. That is `~/.substrate/config.json`, or `~/.metabob/config.json` on an older host
layout. Otherwise it leaves that file alone and prints the
`METABOB_CONFIG_PATH` to use. Only the install inputs (the table above) are taken from your shell. Advanced
variables are read from the fleet's `.env` only, and one that is merely set in your shell
is ignored with a notice, so an unrelated `GITHUB_TOKEN` never configures a fleet.

A fleet with no working provider key boots, passes `live`, `seeded` and `served`, and fails
`usable` naming the model plane: health without usability is reported as such, not as
green. A key that is valid but out of credit fails the same way (the provider answers 402);
the llm-resolver journal names it.

**The manual sequence** (what the installer runs; use it when you want each step):

```bash
docker run --rm --entrypoint substrate-manifest ghcr.io/avigopal/substrate:dev > docker-compose.yml
echo 'ANTHROPIC_API_KEY=sk-ant-…' > .env        # the install inputs, one per line
docker compose up -d
docker exec substrate-live substrate-status --wait seeded
mkdir -p ~/.substrate
# merged on the host, never overwritten: the config's other keys are kept and none of it enters the container
# the merge also keeps ~/.metabob/config.json as a link to this file, for the cockpit
docker exec substrate-live substrate-connect --merge-script | bash -s -- ~/.substrate/config.json docker exec substrate-live substrate-connect --values
docker exec substrate-live substrate-status --wait usable
```

#### B. Hub

```bash install:hub
docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | ANTHROPIC_API_KEY=sk-ant-… sh -s -- --profile hub --public-ip <address spokes reach>
```

Then give each joining node one join token:

```bash
docker exec substrate-live substrate-key join <spoke-name>
```

It prints the token and the exact command the joiner runs. The token carries the discovery
endpoint this hub advertises (from `PUBLIC_IP` and the published ports) and a key issued
for that node, printed once and never stored, so nobody types or configures a port. The
manifest publishes the ports on every interface; if the host sits behind a firewall, it must
admit the ones the table marks "spokes". The hub reaches `usable` on its own because it dispatches: the `hub`
profile carries goal-host and the compute vessels next to the posteriors. `hub-minimal`
leaves compute out for a control-plane or relay-only node. The federation relay runs inside
the container on `P333`, and `/bootstrap` advertises it at `PUBLIC_IP`, which is why the
hub cannot omit that input.

To run a hub or any other node on a remote machine, run the same command there.

#### C. Spoke

Joining a network takes one value, the join token the hub issued (B):

```bash install:spoke
docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | SUBSTRATE_JOIN=<join token from the hub> sh
```

The token unpacks into the two join inputs, the hub's discovery endpoint and the key, and
the installer writes them to `.env` as `DISCOVERY_ENDPOINT` and `METABOB_API_KEY`. Given
those two directly instead, the same command is
`… install | METABOB_API_KEY=<key> sh -s -- --join http://<hub>:<discovery port>`. The
role, the hub endpoints, the relay anchor and the spoke's federation id are derived from
them, at boot, in the image. A spoke needs no provider key: it runs no
model resolver of its own, and its `llm_completion` is answered by its hub's arms through
discovery, so it reaches `usable` exactly when its hub can. (A provider key in a spoke's
`.env` is not used.) Run the `claude mcp add …` line it printed, as in A.

**A hub on the same host.** From inside a container, the host's own LAN address is not
reachable on rootless Podman, and the join is refused at boot ("derived IDENTITY_VESSEL_URL
… is unreachable"). Address the hub by the engine's host name instead:
`--join http://host.containers.internal:18100` on Podman, or
`http://host.docker.internal:18100` on Docker (on Linux, add
`extra_hosts: ["host.docker.internal:host-gateway"]` in a compose override). The hub's
`PUBLIC_IP` can still be the host's LAN address: the relay is dialled by the spoke's
transport, which reaches it. Give each fleet its own `--name` and `--prefix` (sequence E).
The client config the spoke writes then names `host.containers.internal`, which the host
itself does not resolve; point the cockpit at `http://127.0.0.1:<hub prefix>080` instead
(not `localhost`: rootless Podman publishes on IPv4 only, and `localhost` tries `::1` first).

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
  `.transport.reservationsHeld` of `0` means not federated (`activeReservations` counts
  listen addresses, and `phantomSuspected: true` is a circuit advertised with no reservation held). Identity is the other
  discriminator: a spoke runs no identity-vessel, so a valid
  `docker exec substrate-live substrate-key whoami` can only have come from the hub.
- **A joining spoke writes to the hub.** Its seeder registers the shared activity templates
  into the hub's trace store with the issued key (idempotent upserts). A spoke you do not
  fully trust should get a read-scoped key, or `DISABLED_VESSELS=bootstrap-seeder`.
- **A joined spoke is reachable from the hub with no further step.** Its first boot mints
  a federation id (`spoke-<hex>`, persisted in the workspace volume), and its vessels
  appear in the hub registry as `<vessel>@spoke-<hex>` with `protocol: libp2p` and the
  spoke's circuit address (the spoke transport logs `hub-register per-vessel (<n> rows)
  -> all ok`). A resolve that names one of them (a goal's `target_vessel_id`) is carried
  over the relay circuit and answered by the spoke, with its own files and tools. A
  resolve that names no vessel is answered by the hub's own producer of the shape first:
  data locality, not an outage.

Protocol and concepts: [`docs/FEDERATION.md`](docs/FEDERATION.md).

#### D. Surface (a human's local window)

As C, with `--profile surface`:
`docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | SUBSTRATE_JOIN=<join token from the hub> sh -s -- --profile surface`.
The surface is the human-surface vessel at `http://localhost:<prefix>310/`; everything it
asks for is resolved on the hub. To keep it on the local host, add
`HUMAN_SURFACE_PUBLISH_IP=127.0.0.1` to its `.env`. `served` passes when the surface answers.

An Obsidian vault is an optional, alternative window onto the same network. Its plugin
installer lives in a submodule, so it needs a checkout, and reads the same two join inputs,
the discovery endpoint and a key:

```bash
git submodule update --init repos/obsidian-vessel
bash repos/obsidian-vessel/install.sh --local            # same-machine substrate
bash repos/obsidian-vessel/install.sh                    # interactive: vault → host → key
```

At start the plugin's federation sidecar reads `<discovery-endpoint>/bootstrap` for the
relay anchor. See [`repos/obsidian-vessel/README.md`](repos/obsidian-vessel/README.md) and
[`docs/HUMAN_SURFACE.md`](docs/HUMAN_SURFACE.md).

#### E. A second fleet on one host

Required whenever this host already runs a fleet under the default names or ports (the
installer refuses and says which). Add `--name lab --prefix 24` after `sh -s --` in any
sequence above. This gives directory `./lab`, container `lab-live`, volumes `lab-*` and
ports `24xxx`; replace `substrate-live` with `lab-live` in the `docker exec` commands.
Prefixes 19–32 avoid the ephemeral range. Each fleet keeps its manifest and `.env` in its
own directory, which is where re-running the installer updates it.

Under a rootless engine every fleet also draws about 25 kernel keys (systemd's session
keyrings) from the user's quota, which is often 200. When it runs out, the next container
fails to start with `unable to create session key: disk quota exceeded`. The installer
warns when fewer than 40 remain; raise the limit with
`sudo sysctl -w kernel.keys.maxkeys=2000 kernel.keys.maxbytes=2000000` (persist it in
`/etc/sysctl.d/`). The inotify budget is the same kind of limit: when it runs out, a new
fleet stays `initializing` with every unit waiting and its journal reports
`inotify watch limit reached`. Raise it with
`sudo sysctl -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=2097152`.

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

`make up` is a wrapper: it runs sequence A against a locally built tag, with the same `.env`,
and exits non-zero unless the verdict reaches `usable`. Unlike the installer, it writes the
client config only when run with `CONNECT_WRITE=1`. Building needs git with
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
| Upgrade the image | re-run the install command, inside the fleet directory or where it was first run | refreshes the manifest and recreates the container on the new image; volumes, keys and secrets kept. `docker compose pull && docker compose up -d` is not enough on Podman: its compose keeps the old container when a tag changes. pull-sync keeps a node's code current but never its image; `substrate-status` says when the image is behind the published `:dev` |
| Change an install input or profile | re-run the install command with the new input; or edit `.env`, then `docker compose up -d` | recreate; volumes, installed vessels and secrets kept |
| Choose which revision a node runs | set `SUBSTRATE_UPDATE_CHANNEL` in `.env`: `canary` (the default) runs `dev`, `fleet` runs what canaries verified, `hold` keeps what runs. Then re-run the install command | `fleet` and `hold` nodes consume and do not land (landing is turned off; the gap-store holder must stay `canary`, except on a throwaway acceptance install declared with `SUBSTRATE_ACCEPTANCE=1`, which may `hold`). `substrate-status` shows the channel and whether pull-sync enforces it; until it does, every node follows `dev` |
| Move a fleet launched another way (a raw `docker run`, an old lane) onto the manifest | `docker stop -t 360 <c> && docker rm <c>`, then the install command for its role with `--adopt` | its volumes are kept: learning state, issued keys, secrets and federation id |
| Keep one vessel on an extra host port (e.g. a page URL people already use) | a `docker-compose.override.yml` in the fleet directory adding `ports: ["127.0.0.1:<port>:<container port>"]` to service `substrate` | compose merges port lists, so it adds a mapping beside the derived one; it cannot remove or narrow one. The per-port inputs (`HUMAN_SURFACE_PORT` …) are refused alongside a prefix |
| Add or remove one vessel at runtime | `docker exec <c> vessel-ctl install <v>` / `uninstall <v>` | persisted in the workspace; survives recreate |
| Issue or revoke keys | `docker exec <c> substrate-key issue <name>` / `revoke <id>` | hub-issued keys join spokes |
| Point a client elsewhere | re-run `substrate-connect` against that fleet | one config home (`~/.substrate/config.json`, linked from `~/.metabob/config.json`); the cockpit's override is `METABOB_CONFIG_PATH` |
| Back up | `docker compose stop`, then archive both volumes | restore volumes, then `docker compose up -d` |
| Leave a network | remove the anchor pair from `.env`, then `docker compose up -d` | becomes standalone and needs a provider key |
| Tear down, keep state | `docker compose down` | |
| Tear down, destroy state | `docker compose down -v`; remove the fleet's entry from `~/.substrate/config.json` (`~/.metabob/config.json` is a link to it); `claude mcp remove metabob` | destroys all learning state: posteriors, traces, concept graph, memory. It removes the volumes this directory's `SUBSTRATE_NAME` names, whichever fleet created them: with the default name that is any `substrate-*` fleet on the host |
| Know setup works for everyone | the acceptance run on each published digest (Docker and Podman) | CI judges and gates `:dev`; results and gaps land in the hub |

`docker rm` alone leaves both volumes, so a later install with the same `SUBSTRATE_NAME`
silently inherits the old fleet's learning state; `down -v` is the destructive form.

## Working with the substrate

Setup, stop/start, upgrade, backup and teardown are in *Installation → Usage patterns*
above; the ports are in *Installation → Ports*. This section is the development loop on a
running fleet.

**Iterate:**

> **Nothing on your host is bind-mounted into the container.** Editing
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
docker exec <container> substrate-status --wait usable
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
| Is it *correct*? | `docker exec <c> substrate-doctor`: auth, registry, restart loops, and whether an LLM arm can actually complete. Costs a real completion per arm, so run it on demand. |
| What's running / restarting? | `docker exec <c> vessel-ctl status` (services; `restarts=` is the cheap tell) · `systemctl list-timers` for the timer half |
| Preview a selection change | `docker exec <c> env DRY_RUN=1 ENABLED_ROLES=<roles> apply-inventory`: read-only; it reports every selection variable |
| Inventory vs reality | `vessel-ctl drift` (read-only) → `vessel-ctl apply` (converges; **no action lines = converged**) |
| Add / remove a capability | `vessel-ctl list` · `install <v>` · `uninstall <v>` · `deregister <v>` (registry only, leaves the unit alone) |
| Update the code | `substrate-pull-sync`: converges vessels *and* the fleet tooling from git |
| Where did this setting come from? | `docker exec <c> substrate-config`: `unrecorded` means the source of that value was not recorded |

**Resource footprint:** the image is ~0.7 GB; a fleet that has been learning for a while
carries a workspace volume in the high hundreds of MB and grows with trace retention
(`TRACE_STORE_CAP`).

## Keeping submodule pointers current

This repo pins each vessel via a submodule gitlink (`repos/<vessel>` → a commit in that vessel's own repo, tracking its `dev` branch per `.gitmodules`). Vessels are developed and pushed independently (by the substrate's own cutover loop or by an operator working directly in a vessel checkout), so the pointer recorded here always lags the vessel's true `dev` HEAD by some amount. `.github/workflows/bump-submodules.yml` bounds that lag: on a schedule (and on manual dispatch) it resolves each submodule's latest `dev` commit with `git ls-remote` (no clone, no checkout — just a ref lookup), fast-forwards any gitlink that moved via `git update-index --cacheinfo`, and commits + pushes the result directly to `dev`. It runs as a GitHub Actions job, not a host cron or Makefile target, so currentness does not depend on any particular machine being on: the substrate and its supporting automation never rely on a host. A submodule the workflow's token cannot read (a private repo in a different GitHub org) is skipped with a warning rather than failing the run; the pointer for that submodule stays whatever the last successful bump (or manual `git submodule update --remote`) left it.

Because the bump pushes straight to `dev`, `dev` can move ahead of a super-repo change you have committed but not yet pushed. `dev` requires linear history and refuses non-fast-forward pushes: a merge commit is rejected, and so is a force push. Land a pending change by replaying it onto the new tip — `git fetch origin && git rebase origin/dev`, then `git push origin dev`. If the replay conflicts on a gitlink that the bump also moved, keep the bump's pointer unless your change exists to move that pointer.

## Core components

- **activity-api** (`repos/activity-api`) — TypeScript/Bun/Hono backend. Execution-trace store, Thompson-Sampling learner, and resolver for the shapes it owns (traces, templates, metrics, goal paths, composition stats). Not a universal resolver.
- **discovery-vessel** (`repos/discovery-vessel`) — vessel capability registry with resolver contracts; the routing fixed-point. Auth is applied to every route, with `/bootstrap` deliberately carved out as pre-auth so a joining spoke can read the anchor before it has been accepted.
- **goal-host-vessel** (`repos/goal-host-vessel`) — wraps `GoalHost` from `ias-executor-ts`; primary dispatch target for all goal execution, with in-flight goal-seeking + a goal-reaching gate.
- **llm-resolver-vessel** / **local-tools-vessel** / **ribosome-vessel** / **boredom-vessel** — LLM completion, filesystem/process tools, template extraction from executions that reached their goal, and the autonomous idle/topology loop, respectively. llm-resolver-vessel also owns the LLM model policy.
- **concept-db** (`repos/concept-db`) — concept-graph shapes + dense semantic search.
- **development-vessel** (`repos/development-vessel`) — meta-vessel for substrate self-development; owns the authoritative `memoryNote` store.
- **identity-vessel** (`repos/identity-vessel`) — single source of truth for authentication (HMAC API keys + JWT issuance).
- **stateful-ui-vessel** (`repos/stateful-ui-vessel`) — the substrate's own UI: a pool of panels and interactor impulses served as a three-region view (pool / execution / decisions).
- **human-surface-vessel** (`repos/human-surface-vessel`) — the human interface the substrate serves: the workbench at `<prefix>310`, where a person sends goals, answers the substrate's questions, and grades what it produced. A human is a resolver; their answers and verdicts return as shaped impulses.
- **obsidian-vessel** (`repos/obsidian-vessel`) — an optional, additional human surface: each connected vault is a window for a different human resolver, reached through the vessel's sidecar conduit. A substrate runs without it.

## Learning loop

1. **Recommend** — Thompson Sampling selects an activity variant.
2. **Execute** — the activity runs, producing an execution trace.
3. **Record** — the trace is stored with success/failure, cost, and duration.
4. **Learn** — α/β posteriors update for future selection; impulse-relevance and resolver metrics feed back.
5. **Extract** — executions that reached their goal are extracted into reusable
   templates, which re-enter selection as activities and are graded like any other.
   The ribosome extracts them; the running template pool shows what each fleet
   has extracted:

   ```bash
   curl -s "$ACTIVITY_API/v2/activities/templates?limit=100" \
     -H "Authorization: ApiKey $KEY" | jq -r '.templates[] | "\(.created_at)  \(.id)"' | sort -r
   ```

**Reuse before minting:** before minting a new activity/resolver, prefer an existing producer of the needed output shape. Reuse sharpens posteriors and adds a composition edge; minting is the justified exception, not the default. (In the learning dynamics, reuse is what raises the credit-mixing rate λ₁, the rate at which credit spreads across the activity graph, which has to outpace the rate at which new, untested activities are minted: [`docs/architecture/SUBSTRATE_AS_DYNAMICS.md`](docs/architecture/SUBSTRATE_AS_DYNAMICS.md).) See CLAUDE.md → *The laws*, law 3.

## Key design principles

1. **Impulses are universal data** — everything is an impulse with metadata; resolvers access content.
2. **Activities constrain search** — without activities, infinite options; with them, ranked finite options.
3. **Resolvers live where data lives** — don't centralize resolution. `activity-api` is the trace store *and* the learner: it also serves the Thompson posteriors and template writes. What it must not become is a general-purpose resolver for other vessels' data. (The LLM model policy is the worked example of the rule: it is owned by llm-resolver-vessel, where the arms live, not by the learner.)
4. **Metadata first, content later** — reasoners see metadata to decide; resolvers load content to execute.
5. **Record everything** — every execution is traced; this is the raw material for learning.
6. **Learn from traces** — Thompson Sampling, relevance scores, and template extraction from executions that reached their goal (see *Learning loop*, step 5).
7. **Reserve improvisation** — when nothing matches, try something new, but record it.
8. **LLMs are tools, not controllers** — use LLMs for reasoning; deterministic resolvers for everything else.

## Documentation

**[`docs/README.md`](docs/README.md) is the documentation index** — the documents under `docs/` that describe how the system behaves, grouped by what each is for. The handful below are the entry points.

- [`CLAUDE.md`](CLAUDE.md) — authoritative working guide (the laws, the dispatch loop, the operator role, fleet anchors).
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — canonical system definition.
- [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) — operating reference for the single-container substrate: inventory and profiles, `vessel-ctl`, the iteration loop, troubleshooting.
- [`docs/architecture/`](docs/architecture/) — the `SUBSTRATE_AS_*` lenses (dynamics, MDP, network, representation, DEC, fleet, software, sovereign) and supporting design docs.
- [`docs/RBAC_GUIDE.md`](docs/RBAC_GUIDE.md), [`docs/AUTH_JWT_CLAIMS.md`](docs/AUTH_JWT_CLAIMS.md) — multi-tenant isolation and auth claims.
- [`openspec/changes/`](openspec/changes/) — change proposals: the design and tasks for each change in progress.
