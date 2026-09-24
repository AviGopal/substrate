# The target install interface

This is the interface `design.md` defines, written the way an operator meets it: where
things run, what is configured where, the setup sequence for each kind of node, and the
usage patterns after setup. README § Installation (task 5.1) is written from this document;
until then, this is the reference. It describes behavior after the change lands, not today.

## Principles

1. **The image is the installer.** Every derivation runs in the image; the host holds a
   declaration (the manifest and a `.env`), not logic.
2. **One manifest, one vocabulary, one verdict.** Every launcher uses the same compose file,
   the same inputs, and the same `substrate-status` verdict.
3. **Data locality decides placement** (law 11). A vessel runs where its data lives; a
   profile is a named data locality, not a size.
4. **Bootstrap inputs are few and frozen; behavior is shaped.** Env configures what cannot
   exist before boot. Anything the system should learn or change at runtime is an impulse.
5. **Green means reached and connected**, measured off-host on a pulled image.

---

## 1. Localities

### Planes

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
| `hub` | registry, identity, trace store + learner, stores, models, transport + relay, plus goal-host, development, local-tools, ribosome, analysis, light-dispatch | the network's learning state and gap store | nothing | the network's home; it dispatches next to its posteriors and runs the self-development loop (`autonomy` + boredom), whose pushes push capability bounds (design Decisions 10, 11) |
| `hub-minimal` | the `hub` role without compute | as `hub` | goal execution (a spoke) | a control-plane or relay-only node |
| `spoke` (remote-anchor default) | registry (local), compute, ui, transport | the host's files and tools (why the spoke exists) | identity, traces, learning, lessons, LLM arms, from the hub | adding compute or local data to a network |
| `surface` | registry, transport, human surface | none | everything | a human's local window onto a network |
| `compute` | registry, transport, compute | the host's files and tools | everything else | a worker next to some data |

The rule behind the table: a spoke exists because some data lives on its host (files,
tools, a vault). Everything learned lives with the learner on the hub, so a spoke never
carries its own trace store or identity.

### Ports

The manifest publishes one set of ports on every profile, each derived from
`SUBSTRATE_PORT_PREFIX` (`P`, default `18`) as `P` followed by the last three digits of the
container port. A vessel the profile does not run does not answer. `served` checks only the
vessels the profile selects.

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

The relay moves into the container, published at a prefix-derived port and advertised by
`/bootstrap`. Today it runs as a host process on `30333` that no manifest publishes. During
migration, `RELAY_PORT` (advanced) keeps an existing hub on `30333`. A hub's firewall list is
this table filtered by "spokes", with no separate list to maintain. Exposure is decided only
by the manifest's mapping: `127.0.0.1:P310:8310` keeps the surface on the local host.

---

## 2. Configuration

| Tier | What | Where it lives | Read | Learnable? |
|---|---|---|---|---|
| **Install inputs** | the eight below | host `.env` | at boot, by gen-env | no (bootstrap, by design) |
| **Advanced bootstrap** | extra providers, `LLM_ARMS`, retention, federation overrides, `DISABLED_VESSELS`, `RELAY_PORT`, the `MITOSIS_DIRECT_PUSH` kill switch | host `.env`, forwarded by the manifest; documented only in `docs/operations/CONFIGURATION_SURFACE.md` | at boot | no |
| **Generated secrets** | `JWT_SECRET`, `SURREAL_PASS`, API-key signing secret, the operator key | workspace `.substrate-secrets` | at boot | n/a (never hand-edited) |
| **Runtime policy** | vessel additions (`vessel-ctl install`), `pushPolicy`, `llmModelPolicy`, rhythms | impulses in the substrate | at use time | **yes** |
| **Client** | endpoint + key | `~/.metabob/config.json` (override: `METABOB_CONFIG_PATH`; a project-local `.metabob/config.json` shadows it) | by the cockpit | n/a |

### The install inputs

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

**Rules**
- Nothing ambient: no launcher reads `~/.metabob`, `gh`, or another container's environment.
- Precedence at boot: explicit env > `.env` > persisted secret > default. An input that
  conflicts with its deprecated alias fails the launch.
- `HUB_DISCOVERY_URL` or `PEER_MULTIADDR` without `DISCOVERY_ENDPOINT` fails the launch; the
  system does not guess a role.
- A deprecated name alias that is partial (e.g. `SUBSTRATE_CONTAINER=lab` without both volume
  names) or conflicts with `SUBSTRATE_NAME` fails at boot, before anything is written. This
  prevents attaching a new container to another fleet's volumes. The partial case is refused
  on a new volume only; an install already running on its volumes is warned, since a partial
  alias was a valid configuration before this rule. Compose cannot refuse this
  itself, so gen-env checks the names the manifest passes in.
- Changing an install input means `docker compose up -d` (recreate, volumes kept). Changing
  runtime policy never needs a restart.

---

## 3. Setup sequences

Every sequence ends at a verdict level. `docker` below works identically with `podman`
(Podman declared, rootless supported).

### A. Standalone (the default)

```bash
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

# 6. First cockpit call (e.g. registry_query), then:
docker exec substrate-live substrate-status             # all five levels: pass
```

Human surface: `http://localhost:18310/`.

### B. Hub

As A, with `PROFILE=hub` and `PUBLIC_IP=<address spokes reach>` in `.env`. Open the ports
the table marks "spokes". Issue a key per spoke:
`docker exec substrate-live substrate-key issue <spoke-name>`. The hub reaches `usable` on
its own because it dispatches.

### C. Spoke

```bash
docker run --rm --entrypoint substrate-manifest ghcr.io/avigopal/substrate:dev > docker-compose.yml
cat > .env <<'EOF'
DISCOVERY_ENDPOINT=http://<hub-host>:18100
METABOB_API_KEY=<key issued by the hub>
EOF
docker compose up -d
docker exec substrate-live substrate-status --wait usable
```

The role, the hub endpoints and the relay anchor are derived from the two inputs. A spoke
needs no provider key: its `llm_completion` is answered by its hub's arms through discovery.
A hub on the same host is addressed as `host.containers.internal` (Podman) or
`host.docker.internal` (Docker), never the host's LAN address, which a container cannot reach
on rootless Podman. Then connect as in A, steps 5–6.

### D. Surface (a human's local window)

As C, with `PROFILE=surface`. To keep the surface on the local host, map
`127.0.0.1:P310:8310` in a compose override. `served` passes when the surface answers.

### E. A second fleet on one host

Add `SUBSTRATE_NAME=lab` and `SUBSTRATE_PORT_PREFIX=24` to the `.env` of any sequence above.
This gives container `lab-live`, volumes `lab-*` and ports `24xxx`; replace `substrate-live`
with `lab-live` in the `docker exec` commands. Prefixes 19–32 avoid the ephemeral range.

### F. Enabling self-development

Add `SUBSTRATE_GIT_PAT` (write access to your repos) and `SUBSTRATE_REPO_OWNER=<your fork
owner>`. The substrate is then autonomous against your fork. Landing on a branch other fleets
converge to requires a `pushPolicy` promotion earned by settled, verified landings. The
emergency stop is `MITOSIS_DIRECT_PUSH=0` followed by `docker compose up -d`.

### G. From source (developers)

```bash
git clone --recurse-submodules https://github.com/AviGopal/substrate.git && cd substrate
make -C scripts/substrate up REBUILD=1    # build (needs bun) → the same compose → status → connect
```

`make up` is a wrapper: it runs exactly sequence A against a locally built tag, with the same
`.env`, and exits non-zero unless the verdict reaches `usable`.

---

## 4. Usage patterns

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
| Tear down, destroy state | `docker compose down -v`; remove the fleet's entry from `~/.metabob/config.json`; `claude mcp remove metabob` | |
| Know setup works for everyone | the acceptance run on each published digest (Docker and Podman) | CI judges and gates `:dev`; results and gaps land in the hub |

## 5. What disappears

| Today | Becomes |
|---|---|
| `make run-live`, `run`, `run-detach`, `run-live-obsidian`, raw `docker run` recipes | sequence A (or G for source builds) |
| `SUBSTRATE_CONTAINER`, `WORKSPACE_VOLUME`, `SURREAL_VOLUME`, nine `*_PORT`, `LIVE_NAME`, `PORT_OFFSET` | `SUBSTRATE_NAME`, `SUBSTRATE_PORT_PREFIX` (old names warned during migration) |
| `deploy-remote.sh`, `deploy-hub.sh`, `deploy-hub-pull.sh` | copy the manifest + `.env` to the target and run sequence B or A there |
| `ui-only-up.sh` and its drop-in | sequence D |
| `configure-local.sh`, `METABOB_CONFIG` | `substrate-connect`, `METABOB_CONFIG_PATH` |
| compose healthcheck override, `substrate-ready` fail-open, `make up`'s readiness `\|\| true` | the verdict |
| `ENABLED_ROLES=hub` + a hand-listed `ENABLED_EXTRA_VESSELS` | `PROFILE=hub` |
| a host relay on `30333` | the in-container relay on `P333` |
| `MITOSIS_DIRECT_PUSH` as the autonomy switch | push capability + `pushPolicy`; the variable stays only as a kill switch |
| setup text in ≥8 documents | README § Installation, linked from everywhere else |

---

## 6. Documentation after the change

README § Installation is the only place setup commands appear. Every other document keeps
its concepts and links there for commands. Tasks 5.1–5.6 apply this table.

| Document | Disposition |
|---|---|
| README § Installation | **Rewrite** from §§ 1–4 of this document; command blocks fenced `install` (the acceptance run executes them) |
| README § Join, § Building from source, § Running your own hub | **Fold** into the install page's sequences C, G, B; keep the concepts |
| `CLAUDE.md` § Reference: the running substrate | **Keep** the role statement and troubleshooting; **replace** bootstrap, client config and the port table with a link |
| `docs/SUBSTRATE.md` | **Delete** § Launch (two canonical paths), § Container config matrix, § Join, § Second substrate, § Deploy paths, § Backing up; **keep** the single-container rationale, inventory, `vessel-ctl`, iteration loop and troubleshooting as the operating reference |
| `docs/FEDERATION.md` | **Keep** protocol and concepts; **replace** hub and spoke commands with links |
| `docs/operations/CONFIGURATION_SURFACE.md` | **Rewrite** as the advanced-configuration reference, organised by the § 2 tiers |
| `docs/HUMAN_SURFACE.md` | **Replace** the `ui-only-up.sh` path with sequence D |
| `docs/guides/CONTAINER_NETWORK_LIFECYCLE.md` | **Fold** unique content into `docs/SUBSTRATE.md`, then **delete** |
| `docs/guides/SYZYGY_LOCAL_SURFACE.md` | **Move** to `validation/reports/` (dated evidence, not a guide) |
| `docs/guides/HUMAN_PROJECT_LIFECYCLE.md` | **Repoint** its setup link to the install page |
| `docs/testing/QUICK_VERIFICATION_GUIDE.md` | **Rewrite** around `substrate-status`, or delete |
| `docs/LIVE_DEVELOPMENT.md`, vessel READMEs' `bun run dev` | **Label** developer-only |
| `repos/deployment/README.md`, cloud-dashboard Helm docs | **Banner**: Kubernetes retired |
| `.claude/skills/deploy`, `metabob-substrate` | **Remove** deleted make targets and the missing spec link; point to the install page and `vessel-ctl` |
| `.env.example`, compose header, Makefile header | **Reduce** to the install inputs and a pointer |
| root `.env.devbob*.example` | **Move** to their own tool, or delete |
| `docs/README.md` | **Update** the index |

The substrate's copy of the old text (concept-db sections, `memoryNote` entries, drafter
lessons) is purged by tasks 5b.1–5b.3. New drift is caught by the acceptance run and by
`docs_align_tick` checks for restated commands and unread variable names (5c.1–5c.5).
