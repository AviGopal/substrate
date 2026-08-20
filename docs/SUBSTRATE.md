# Local Single-Container Substrate

This document describes how to build, run, and iterate against the local substrate — the full vessel fleet collapsed into a single systemd-managed Docker container.

## Why a single container?

A container gives a complete trust boundary without cluster overhead: all inter-vessel calls are localhost, SurrealDB runs as a local file instance, and a `systemctl restart` is the whole rollout. Multi-machine reach comes from running more containers (hub/spoke roles + the libp2p relay), not from an orchestrator.

A container is a valid substrate. The foundation doc defines a substrate by its fixed point (discovery-vessel) and its trust boundary, not by its infrastructure form. The same vessel code, the same seed templates, the same Thompson learning — just no pod scheduling.

## One image, any subset

The substrate has generalized from "one local container" to **one image that runs any subset of the fleet, deployable anywhere, and federatable**. The single image bakes every vessel; a declarative inventory selects which units run at boot, so the same image is a full local substrate, a minimal hub, or a compute-only spoke depending only on environment.

### Topology selection

`scripts/substrate/vessels.inventory.json` is the declarative vessel inventory: every baked-in unit maps to a **role** (`store`, `control`, `api`, `compute`, `models`, `ui`, `transport`, `seed`, `infra`, `autonomy`, `registry`, `desktop`), and role-**group** aliases compose those into deployable shapes:

- `hub` = `store`, `control`, `api`, `transport`, `seed`, `infra`, `registry`, `models` (control plane + store + relay + the model arms)
- `spoke` = `compute`, `ui`, `seed`, `infra`, `registry` (compute-only; points its control/store at a hub, and **resolves models on the hub** — `models` is excluded deliberately, so no LLM arm starts at boot)

> **How the spoke's arms are actually held off — two different strengths.** The
> inventory-named units (`llm-resolver-vessel` and the legacy
> `llm-resolver-{opus,haiku,google}`) are **disabled *and masked*** by
> `apply-inventory`, because those names appear in the inventory under role
> `models`. The units that actually serve models — the boot-rendered
> `llm-{opus,haiku,google}` — are **rendered, present, and merely not enabled**:
> their unit files exist as ordinary files and their `ExecCondition` passes
> wherever a provider key is set, so a single `systemctl start llm-haiku` will
> raise a local arm on a spoke. Those names appear nowhere in the inventory, so
> `apply-inventory` cannot mask them. The role selection governs what starts **at
> boot**; it is not a barrier against a deliberate manual start.
- `full` = every role except `desktop` — the intended shape of a local substrate,
  and a hand-maintained enumeration. Note that `ENABLED_ROLES=full` is **not** the
  same as leaving the selection env unset: unset is a total no-op that masks
  nothing at all, `desktop` included, whereas `full` masks anything absent from
  the list.

`models` holds the LLM resolver arms; it is separate from `compute` precisely so a
spoke can run work locally while resolving models on its hub.

`desktop` (Obsidian, Xorg, noVNC) is in **no** group on purpose. The unit *files*
ship in the base image like every other unit — what the `substrate-obsidian` stage
adds is the payload (Xvfb, noVNC, the Obsidian AppImage) and the `systemctl enable`
that turns them on. On a base image they are present but never enabled, so there is
nothing for a role to select. The consequence worth knowing: because they *are*
inventory-named, any `ENABLED_ROLES` value masks them on an obsidian image — and
the Makefile sets `ENABLED_ROLES=spoke` automatically whenever `DISCOVERY_ENDPOINT`
is passed, so a federated obsidian fleet loses its desktop silently.

> ⚠ **Neither `hub` nor `spoke` includes `autonomy`.** A federated hub+spoke pair
> runs none of the 26 autonomy units — no `gap-compose`, no
> `operator-goal-generator`, no `surgical-gap-scan`, no `m1-trainer`,
> no `compose-teacher`, no `funnel-drain`. Only `full` has them.
> `deploy-hub.sh` compensates with an explicit `ENABLED_EXTRA_VESSELS` list, but
> that list restores six *compute* services and zero autonomy timers, and per its
> own comment it is a snapshot of what one hub happened to be running rather than a
> designed set. If you want the autonomy timers in a federated deployment, name
> them explicitly.
>
> This does **not** mean a federated pair is inert. `boredom-vessel` carries role
> `compute`, so it runs on a spoke and performs condition-driven work selection:
> it admits open gaps as candidates, scores them, and dispatches without an
> operator. What a hub+spoke pair loses is the *scheduled* autonomy surface, not
> gap-driven work generation. To see it on a running spoke:
> `docker exec <container> journalctl -u boredom-vessel -n 50`.

`scripts/substrate/apply-inventory.sh` reads the inventory at boot — run by the container entrypoint *after* `gen-env` and *before* `exec systemd` — and `systemctl disable`s the unwanted units (it just removes the `*.wants` symlinks the image baked in). Selection env, highest precedence first:

- `ENABLED_VESSELS=unit,unit` — explicit exact-unit allow-list; overrides roles
- `ENABLED_ROLES=role,role` — roles/role-groups to keep (`hub`/`spoke`/`full` expand via `inventory.roles`); everything else is disabled
- `DISABLED_VESSELS=unit,unit` — always off, even if selected above

**Default (none of the three set) = every baked unit enabled = the full local substrate** (`apply-inventory.sh` is a no-op). Manifest-installed dynamic vessels (`"manifest": true`) are never baked-enabled, so they are never touched here — they are installed on demand (see [Dynamic vessels](#dynamic-vessels)).

If a selection is set and cannot be applied — an unrecognised role or profile
name — the container **refuses to boot** rather than starting the full baked
fleet in place of the subset you asked for. The error names the offending values
and lists the valid role groups and bare roles. With no selection set, a failure
falls open to the default topology, because there "run everything" is the intent.

### Where the inventory lives, and when it takes effect

The inventory exists in **three** places, and they are not equivalent:

| Location | Role |
|---|---|
| `scripts/substrate/vessels.inventory.json` (repo) | what you edit and commit |
| `/usr/local/share/substrate/vessels.inventory.json` (image) | the default baked at build time; also the fallback every reader uses if the volume copy is missing |
| `/workspace/substrate/fleet/vessels.inventory.json` (volume) | **authoritative at runtime** |

First boot seeds the volume copy from the image. **Later boots do not** — the
volume copy is the substrate's own, so it can alter its own membership. The
in-container `substrate-pull-sync` converges the fleet files from git, so a
committed inventory change does reach a running fleet's volume without a rebuild.

> ⚠ **A propagated inventory change is not an applied one.** `apply-inventory`
> runs exactly once per boot, before systemd starts, so a change that has landed
> in the volume sits **inert until the container restarts**. A fleet can hold a
> corrected inventory and go on running the old unit set indefinitely.
>
> The same is true of the boot-rendered LLM arm units and their `ExecCondition`
> key guards: both are decided at boot. Restart the container to apply any of it
> (`make -C scripts/substrate recreate LIVE_NAME=<name>` preserves the volumes,
> and therefore the learning state).
>
> To see what a fleet is actually running versus what its inventory now says:
>
> ```bash
> docker exec <container> diff \
>   /workspace/substrate/fleet/vessels.inventory.json \
>   /usr/local/share/substrate/vessels.inventory.json
> docker exec <container> systemctl list-units --state=active --no-pager
> ```
>
> No command reconciles or reports this drift for you; `substrate-doctor` reads
> the inventory but does not compare it against git or against the running set.

> ⚠ **The human surface is a manifest vessel, not just the federation units.**
> `human-surface-vessel` (`:8310` → host `:18310`) is `"manifest": true`, so a
> default boot **publishes its port with nothing listening** — the port answers
> connection-refused while every other health signal reads green. It is the one
> vessel a human is meant to talk to, so a fleet that looks complete can have no
> usable surface. Install it explicitly:
>
> ```bash
> docker exec substrate-live vessel-ctl install human-surface-vessel
> curl -s -o /dev/null -w '%{http_code}\n' http://localhost:18310/health   # expect 200
> ```
>
> The manifest units flagged in the inventory are `human-surface-vessel`,
> `federation-relay` and `federation-transport-vessel`. The set `vessel-ctl`
> can install is read from a *different* file and is one larger — it also
> includes `metric-collector-vessel`. Ask the source of truth for each:
>
> ```bash
> # what a default boot leaves disabled (inventory flags)
> jq -r '.vessels[] | select(.manifest) | .unit' scripts/substrate/vessels.inventory.json
> # what vessel-ctl can install, by the NAME the install command takes
> docker exec substrate-live jq -r '.vessels[].name' /workspace/substrate/fleet/vessels.manifest.json
> ```
>
> Note the two emit different forms — the inventory lists units
> (`human-surface-vessel.service`), while `vessel-ctl install` takes the bare
> name (`human-surface-vessel`).

### The LLM arm fleet is rendered, not baked

The set of LLM-resolver arms is **not** a fixed list of `.service` files. It is
declared in [`scripts/substrate/llm-arms.json`](../scripts/substrate/llm-arms.json)
and materialised at boot: `entrypoint.sh` locates `render-llm-arms.sh`, runs it,
then enables the units it produced (offline `multi-user.target.wants` symlinks,
because `systemctl enable --now` is a no-op before systemd is PID 1). If no
renderer is found, or rendering fails, boot continues with whatever LLM units the
image already carries — the step is fail-open, never a boot blocker.

Each arm is one `{ id, model, provider, port }` entry, and rendering it produces
two files:

- `/etc/substrate/llm-<id>.env` — the single-provider pin (`LLM_DEFAULT_MODEL`,
  `LLM_PINNED_PROVIDER`). It loads *after* `/etc/substrate/env`, so the arm's
  model and provider win over the fleet-wide default.
- `/etc/systemd/system/llm-<id>.service` — the unit, with `PORT` and
  `LLM_RESOLVER_VESSEL_ID=llm-resolver-<id>` pinned, running the shared
  llm-resolver-vessel runtime.

Two properties follow from the pin, and both are the point of the design:

- **Quota is per-arm.** Because an arm serves exactly one provider, its quota is
  that provider's quota — so it de-advertises through discovery when that
  provider cools, instead of silently failing over to a sibling provider and
  hiding the exhaustion. Callers resolve to a live arm through discovery; nothing
  addresses an arm by URL.
- **Arms materialise only where their credential lives** (law 11). The unit
  carries an `ExecCondition` that checks `/etc/substrate/env` for the provider's
  key variable, so a host without that key **skips** the arm cleanly rather than
  failing it. The same image therefore runs everywhere and grows the arms the
  host can actually serve.

`provider_key_env` in the same file maps each provider to its key variable; an
arm naming a provider absent from that map is skipped with a warning. Adding an
arm is one entry in the JSON — it registers through discovery and becomes
selectable fleet-wide within the namespace, regardless of which host runs it. A
hub or deploy can replace the whole list without editing a tracked file by
setting `LLM_ARMS` to a JSON array of the same shape; the env var wins over the
file.

## Launch: two canonical paths

The same artifact runs either way — one image
(`ghcr.io/avigopal/substrate:dev`, the canonical registry), one container
(`substrate-live`), one required secret (an LLM key). **Container** (root-level
compose) is the checkout-free path: a pulled image plus one env var. **Source**
(`make up`) is the everyday development path: a checkout with submodules, one
command, operator tooling auto-pointed. The image is published to GHCR by CI on
pushes to `dev` that touch the image inputs (`Dockerfile.substrate`, `repos/**`,
`scripts/substrate/**`, or the workflow itself), and on demand via
`workflow_dispatch`; the package is **public**, so `docker pull` needs no
credentials. A Docker Hub `avigopal/substrate:dev` mirror may exist, but GHCR is
the repo.

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
the doctor. **`up` exits non-zero when the doctor finds failures**, including on
a first boot — read the doctor block rather than the exit code alone, since the
container can be running and serving most ports while a check like SurrealDB
root auth fails. **No other host step is load-bearing**: identity seeding runs
in-container (`identity-seeder.service`,
idempotent, restarts key consumers only when a key is actually minted),
readiness is a systemd fact (`substrate-ready.service`) surfaced to the host via
the image `HEALTHCHECK` (`docker inspect --format '{{.State.Health.Status}}'`),
and diagnosis is in-container too (`docker exec substrate-live substrate-doctor`).

> **`up` never rebuilds from source on its own.** It builds only when no image
> exists, and reuses an already-running `substrate-live` as-is. After editing
> vessel source, rebuild explicitly (`make -C scripts/substrate build`, or
> `up REBUILD=1`) *and* recreate the container so the fresh image is actually
> booted (`docker rm -f substrate-live` then `up`) — though a pushed change
> arrives on its own, since the container converges its `/vessels` runtime to
> `origin/dev`. Rebuild when you need the *image* refreshed; for an uncommitted
> single-vessel edit use the hot-reload `restart-<vessel>` targets under
> **Iteration loop**.

### Container path — root-level compose

No make, no submodules — but this variant does need the two tracked files
(`docker-compose.yml` and `scripts/substrate/.env.example`), so it runs **from
the repo root** of a checkout. For a genuinely checkout-free start, on a host
with nothing but Docker, skip to the [raw `docker run`](#the-equivalent-raw-invocation)
below: it needs only the image and one env var.

A root-level `docker-compose.yml` is canonical
(`scripts/substrate/docker-compose.yml` is a symlink to it):

> ⚠ **Never run `docker compose up` against an existing docker-run fleet.**
> Compose prefixes volume names with the **project name**, which defaults to the
> directory you run from — so the `substrate-workspace` / `substrate-surreal`
> declared in `docker-compose.yml` become `<project>_substrate-workspace` /
> `<project>_substrate-surreal` (from a checkout named `substrate`, that is
> `substrate_substrate-workspace`; rename the directory and the prefix changes
> with it). A fleet started by `make up` mounts the **unprefixed** names, so
> compose does not adopt it — it creates EMPTY volumes and starts a container
> that looks perfectly healthy with an empty SurrealDB and an empty workspace.
> The old volumes are orphaned rather than deleted, which is worse: nothing
> errors, and the loss is invisible until someone asks where the traces went.
>
> Use compose on a **fresh host**, or for an existing fleet declare the volumes
> `external: true` under their unprefixed names first. To see which set a
> running container actually holds:
>
> ```bash
> docker inspect <container> --format '{{range .Mounts}}{{.Name}} {{end}}'
> ```
>
> An unprefixed `substrate-workspace` means the make-up fleet; a prefixed
> `<project>_substrate-workspace` means a compose fleet.

```bash
cp scripts/substrate/.env.example .env      # set ANTHROPIC_API_KEY

# CHECK FIRST — if this prints anything, a fleet already exists here and
# `docker compose up` would strand its volumes. See the warning above.
docker ps -a --filter name=substrate-live --format '{{.Names}}'

docker compose up -d                        # root compose is canonical
docker exec substrate-live substrate-key show   # read the operator API key
```

`docker compose` pulls `ghcr.io/avigopal/substrate:dev` (public — no
`docker login` needed), mounts its two named volumes, and publishes the
host-mapped ports. Wait for
`docker inspect --format '{{.State.Health.Status}}' substrate-live` to report
`healthy` before reading the key; `substrate-key` is baked into the image at
`/usr/local/bin/substrate-key`, so no checkout is needed.

> **`healthy` is a weaker signal than it looks.** The container healthcheck runs
> `substrate-ready --quick`, which covers the vessels marked `"core": true` in
> the inventory — it is a *liveness* check, not a correctness one. It reports
> healthy while SurrealDB root auth is broken and the fleet is unusable: the
> ports serve, the core vessels answer, and every request that needs the
> datastore still fails. `docker exec <container> substrate-doctor` is the check
> that covers auth, the registry and failed units — run it before trusting a boot.

<a id="the-equivalent-raw-invocation"></a>
The equivalent raw invocation on **any** docker host, and the one path that needs
**no checkout at all** — same nine published ports as compose, including the
human surface. (Publishing `:18310` is not the same as
serving it: the human surface is a manifest vessel and needs one install step
before it answers — see [the manifest-vessel note](#topology-selection).)

```bash
docker run -d --privileged --name substrate-live \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -p 18080:8080 -p 18090:8090 -p 18100:8100 -p 18101:8101 -p 18210:8210 \
  -p 18250:8250 -p 18260:8260 -p 18270:8270 -p 18310:8310 \
  --tmpfs /run --tmpfs /run/lock ghcr.io/avigopal/substrate:dev
```

Note the volume names above are the **unprefixed** ones — this invocation joins
the `make up` fleet, not the compose one.

### Container config matrix

The image is published to GHCR as `ghcr.io/avigopal/substrate:dev` (fleet only;
Obsidian runs as a host peer) and `ghcr.io/avigopal/substrate:obsidian` (fleet +
in-container Obsidian over noVNC). The package is **public** — a pull needs no
credentials — and it needs **no repo checkout and no submodules**; everything a
fresh container consumes is baked in or generated:

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
| `ENABLED_ROLES=spoke` | *redundant* — `gen-env.sh` already defaults `ENABLED_ROLES` to `spoke` whenever `DISCOVERY_ENDPOINT` names a remote host, so setting it explicitly changes nothing. Set `ENABLED_ROLES` only to select a role set *other* than the inferred one |
| `ACTIVITY_API_ENDPOINT=http://<hub-host>:18080` | *optional override* — derived from the discovery host **and its port offset** if unset |
| `IDENTITY_VESSEL_URL=http://<hub-host>:18101` | *optional override* — derived from the discovery host **and its port offset** if unset |

The derivation keeps the port you supply. A hub reached on `:23100` yields
activity-api `:23080` and identity `:23101`, because a deployment shifts the whole
`18xxx` block by one `PORT_OFFSET`. A hub port *below* the block (a reverse proxy
on `:443`, a tunnel on `:8443`) is not offset arithmetic: the hub URL keeps that
port, the siblings fall back to the conventional `18080`/`18101`, and you should
set the two overrides explicitly.

> ⚠ **A hub is not merely a reachable discovery — it must serve a populated
> `/bootstrap`.** `federation-transport-vessel` self-derives its relay from
> `${HUB_DISCOVERY_URL}/bootstrap`. A **standalone** substrate answers that route
> with `HTTP 200` and an *empty* body:
>
> ```json
> {"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":""}
> ```
>
> So the `200` **status** does not distinguish reachable from joinable — and the
> spoke instead crash-loops with `set RELAY_MULTIADDR or point
> BOOTSTRAP_URL/HUB_DISCOVERY_URL at a discovery serving /bootstrap`, naming
> variables you have already set correctly.
>
> The **body** of that same call does distinguish them; no second request needed:
>
> ```bash
> curl -s http://<hub-host>:18100/bootstrap | jq '.relay_multiaddrs | length'
> # 0  => not a hub yet: it has no relay. Deploy it with deploy-hub.sh
> #       (ENABLED_ROLES=hub + the libp2p relay), or pass RELAY_MULTIADDR by hand.
> ```
>
> Check `relay_multiaddrs` **specifically** — that is the field the transport
> actually reads. The empty `discovery_endpoint` and loopback `identity_endpoint`
> in the same payload only tell you `PUBLIC_IP` was never set, which a hub can
> lack while still having a working relay, and can have while its relay is dead.
>
> The loopback `identity_endpoint` is **inert**, not a hazard: it echoes the hub's
> own `IDENTITY_VESSEL_URL` and no spoke code follows it. A joining spoke derives
> its identity endpoint from the discovery host and port offset instead, so a
> spoke pointed at a hub on `:23100` uses `:23101` regardless of what `/bootstrap`
> advertises. Read the loopback value as a sign the hub has no public identity
> configured, nothing more.
>
> A non-empty `relay_multiaddrs` is **necessary but not sufficient**. The handler
> builds that array from the `RELAY_MULTIADDR` env string or from registry circuit
> addresses and never dials anything, so a stale or dead relay still advertises
> cheerfully. For a real pre-flight, dial the advertised address (conventionally
> `<hub>:30333`) before joining.
>
> The relay is `federation-relay.service` — role `transport`, and a **manifest**
> vessel, so it is never baked-enabled; `hub` includes `transport` but the unit
> still has to be installed. A `full`/standalone fleet has no relay at all.

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
- **`PORT_OFFSET=<n>`** shifts every port published by **`run-live`** by `n` so
  the two fleets don't collide (e.g. `PORT_OFFSET=5000` → activity-api `23080`,
  discovery `23100`, goal-host `23210`, concept-db `23260`). It does **not**
  reach `run-live-obsidian`, which hardcodes its nine ports — two obsidian
  fleets collide however you set it.

> ⚠ **Keep the shifted block BELOW the ephemeral port range.** On Linux
> `/proc/sys/net/ipv4/ip_local_port_range` is typically `32768 60999`, and the
> kernel hands those out to ordinary outbound connections. An offset that lands
> the fleet inside that window (`PORT_OFFSET=20000` → `38080…38310`) works most
> of the time and then fails at random with
> `bind: address already in use` on a port nothing is listening on — a transient
> outbound socket held it for the moment Docker tried to bind. The error names a
> conflict with a process that no longer exists by the time you look, so the
> failure is intermittent and the port always tests free afterwards.
>
> Offsets of `5000`–`12000` keep the block in the low 20000s–30000s, below the
> range. Check yours before choosing:
>
> ```bash
> cat /proc/sys/net/ipv4/ip_local_port_range
> # and verify the target ports on ALL interfaces, not just loopback —
> # Docker binds 0.0.0.0, so a 127.0.0.1-only probe answers the wrong question
> ss -ltn | awk '{print $4}' | grep -E ':2[0-9]{4}$' | sort -u
> ```

> **Settings are only applied when the container is CREATED.** `make up` against
> a container that already exists but is *stopped* just `docker start`s it, and
> Docker's env and port mappings are immutable after creation.
>
> The Makefile's `LAUNCH_OVERRIDES` guard exists to catch exactly this — it
> refuses to start a stopped container when you supply settings that would be
> silently ignored. **It does not cover everything**, and the gaps have three
> different causes, which need three different remedies:
>
> | Setting | What actually happens | Remedy |
> |---|---|---|
> | `PORT_OFFSET` | unguarded; port mappings are fixed at creation | **`recreate` refuses** to change it (exits 1) — `docker rm -f <name>` first |
> | `ANTHROPIC_API_KEY` and every other provider key | unguarded — the guard watches `API_KEY`, a *different* and normally-unset variable, so a rotated key appears to apply and does not | `recreate`, **supplying the key explicitly** — it is not read off the old container, and an unsupplied key silently falls back to `~/.metabob/config.json` |
> | `PROFILE`, `ENABLED_EXTRA_VESSELS` | **never passed to `docker run` by the Makefile on ANY path**, including a fresh create — so `make up`/`recreate` cannot set them at all | raw `docker run -e PROFILE=…`, or `deploy-hub.sh`, which does pass `-e ENABLED_EXTRA_VESSELS` |
>
> Guarded, and producing a clear error telling you to use `recreate`:
> `ENABLED_ROLES`, `ENABLED_VESSELS`, `DISABLED_VESSELS`, `METABOB_API_KEY`,
> `API_KEY`, and the `DISCOVERY_ENDPOINT` / `ACTIVITY_API_ENDPOINT` /
> `IDENTITY_VESSEL_URL` / `SURREALDB_URL` / `REDIS_URL` overrides.
>
> **Everything else `run-live` passes with `-e` is unguarded and silently dropped
> on resume** — `METABOB_ENDPOINT` (an endpoint override, despite the
> generalisation above), `OPENAI_BASE_URL`, `LLM_DEFAULT_MODEL`, `GITHUB_TOKEN`,
> `SUBSTRATE_GIT_PAT`, `SUBSTRATE_REPO_OWNER`, `API_KEY_SECRET`,
> `ALLOW_INSECURE_API_KEY_SECRET`, and the `RUNPOD_*` set. Treat the guard as a
> partial safety net, not a contract: when in doubt, recreate.

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
>
> ⚠ **It does not publish the same nine ports.** `run-live-obsidian` swaps
> `18310:8310` (the human surface) for `16080:6080` (noVNC), so `:18310` is
> simply unpublished on this flavour — a `curl localhost:18310/health` returns
> connection-refused with no vessel at fault. It also hardcodes its ports and
> ignores `PORT_OFFSET`.
>
> Both `restart-*` and `logs-*` are **fixed enumerated target lists**, not
> pattern rules — see [Iteration loop](#iteration-loop) and
> [Monitoring](#monitoring) for the units each covers.

After step 4, `~/.metabob/config.json` points to `http://localhost:18080` and all validation harnesses use it automatically.

**Note on ports**: The container maps internal ports to host ports with a **+10000** offset — internal `8xxx` becomes host `18xxx`, so activity-api is at `localhost:18080`, discovery-vessel at `localhost:18100`, and the human surface at `localhost:18310`. Internal vessel-to-vessel calls use `127.0.0.1:8xxx` directly inside the container.

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

`gen-env.sh` writes `/etc/substrate/env` and persists its secrets to `/workspace/.substrate-secrets` (on the `substrate-workspace` named volume), so a restart reuses the same values instead of regenerating and breaking auth. The persisted set is `JWT_SECRET`, `SURREAL_PASS`, `API_KEY_SECRET`, `FED_SUBSTRATE_ID`, `METABOB_API_KEY`, `SUBSTRATE_GIT_PAT`, **and the operator-supplied provider keys** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`/`OPENAI_BASE_URL`, `CHUTES_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `RUNPOD_API_KEY`) — the provider keys are read from the run environment when present but are then round-tripped into `.substrate-secrets` too, so a `docker rm` + recreate *without* `-e` retains them. `RUNPOD_ENDPOINT_ID` (plus the optional `RUNPOD_MODELS` / `RUNPOD_COST_PER_MTOK`) round-trips the same way despite not being a secret: `llm-resolver-vessel` registers the RunPod Serverless arm only when the endpoint id is present, so losing it on a recreate would silently un-register that lane. (`FEDERATION_SIGNING_SECRET` is **not** in the boot set — it is generated by `secrets.env.sh` on the dynamic-vessel path, when the federation transport is installed.)

`secrets.env.sh` is **safe to commit** — it declares *names and non-secret defaults only*, never real secret values (those come from the environment or the persisted file). `vessel-ctl.sh` sources the same file when installing a dynamic vessel, so a vessel's declared `secrets` are guaranteed present in `/etc/substrate/env` and persisted at install time.

### Keys and tokens (the human surface)

identity-vessel binds a vessel port like every other vessel and is published by the
same `18xxx → 8xxx` host-mapping convention, so whether it answers off-box is a
deployment choice rather than a property of the vessel. A substrate that fronts
only local tooling can leave that mapping unpublished; a substrate that serves a
remote admin CLI or federated peers publishes it, and the identity port is then one
of the ports the host firewall must open (see [`docs/FEDERATION.md`](FEDERATION.md)).
Assume identity is reachable and authenticate every call to it — do not rely on the
container boundary to keep callers out.

For a substrate you have shell on, the in-container tool `substrate-key` (baked next
to `vessel-ctl`) is the issuance surface, wrapped by Makefile targets so the whole
flow is one command with no credentials beyond a running substrate:

> **Instance selector.** Every `make -C scripts/substrate` target — `show-key`,
> `whoami`, `issue-key`, `list-keys`, `revoke-key`, `status`, `health`, `shell`,
> and each enumerated `logs-*` / `restart-*` / `sync-*` target — runs `docker exec
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

The full key is printed **once** and never stored (only its hash is persisted). On
images that predate the baked tool, the Makefile stages the script into the running
container first. This is the supported way to obtain the hub-issued key a spoke or
external peer needs (see [`docs/FEDERATION.md`](FEDERATION.md)).

**Auth model.** The operator's `METABOB_API_KEY` identifies the caller and resolves
the substrate org. Minting a token is itself an authenticated operation:
`POST /v1/jwt/generate` on identity-vessel requires an `Authorization` header —
either `ApiKey <key>` or `Bearer <jwt>` — and binds the minted token's claims to the
identity behind that credential. A request whose body asks for an `org_id` or
`user_id` other than the authenticating credential's own is refused: you mint a
token for yourself, not for someone else.

The mint deliberately does **not** require `admin` scope. An operator key
legitimately carries only `read,write` and still needs to mint its own token, so
scope is enforced where it actually matters — on the admin-only `/v1/keys/*`
endpoints, which accept an `ApiKey` credential carrying `admin` scope or a `Bearer`
token whose role is `admin` or `owner`. Read the mint as an identity-binding step
rather than a privilege grant: it converts a credential you already hold into a
short-lived token carrying that same identity, and it cannot hand you authority
your credential did not already have.

Nothing about the container boundary is load-bearing in this model. A remote admin
CLI reaches the same endpoint over the network as in-container tooling does, so the
credential — not the network position — is the trust boundary.

### Issuing and administering keys: which surface

Two surfaces administer the same keyspace, and the choice between them is about
where you stand relative to the substrate, not about capability:

- **`make -C scripts/substrate issue-key` (and its `whoami` / `list-keys` /
  `revoke-key` / `issue-jwt` siblings)** — for a substrate you have **shell on**.
  Each target runs `docker exec` against the container, so it needs no network
  exposure, no client install, and no credential beyond a running substrate: the
  operator key is already inside. This is the bootstrap surface — it is how the
  *first* key comes into existence, including the hub-issued key a spoke needs
  before it can authenticate to anything.
- **`keyctl` (`@avigopal/keyctl-vessel`)** — for a keyspace you reach **over the
  network**. It is a standalone client that authenticates with a key you already
  hold and talks to identity-vessel's published port, so it administers a remote or
  hub substrate from an operator workstation with no shell access. It cannot
  bootstrap a keyspace it has no credential for.

Reach for the in-container path when you have shell and need a key to exist at all;
reach for `keyctl` for day-to-day administration of a substrate you hold a
credential for but no shell on. Because both drive the same identity-vessel
endpoints, the auth model above governs each of them identically — a remote client
is not a privileged one. `keyctl` documents its own commands and flags; consult it
there rather than mirroring them here.

## Iteration loop

**The channel is git.** A change reaches running vessels — here and on every
other substrate — by being committed and pushed to `origin/dev`. Each
substrate's own `substrate-pull-sync` converges its `/vessels` runtime on the
next tick (and at boot), mirrors the new source in, and restarts the affected
units behind a health gate. Nothing pushes source into a container from a host,
so **an uncommitted or unpushed local edit does not propagate** — see
[Landing a change](#landing-a-change).

```bash
vim repos/development-vessel/src/resolvers/...
git -C repos/development-vessel commit -am "fix(development-vessel): ..."
git -C repos/development-vessel push origin dev

# Verify once the substrate has converged
curl http://localhost:18090/health
```

### Hot-reloading one local container (the escape hatch)

The `sync-<vessel>` / `restart-<vessel>` targets copy `repos/<vessel>/src` from
your working tree into the container and restart the unit. This is a
**deliberate, single-machine** path, sanctioned for seeing an exceptional manual
edit run before it is committed — it acts on one container on one Docker daemon
and reaches no other substrate, so it is a local convenience, never the way a
change is delivered.

```bash
make -C scripts/substrate restart-development-vessel
curl http://localhost:18090/health
```

> **It can clobber substrate-authored work.** The copy source is *your* working
> tree, and it overwrites whatever the container holds — including commits the
> substrate landed in its own in-container clone that your tree does not have.
> Use these targets only when you know the host tree is the newer one; compare
> against the container copy first. The safe refresh for anything else is an
> in-container ff-only pull of `/workspace/git/vessels/<vessel>` plus a unit
> restart.

Vessels with a `restart-<vessel>` target:
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
- `restart-human-surface-vessel` (its sync step also installs/enables the unit,
  since the human surface is a manifest vessel — see below)

The core vessels — `activity-api`, `identity-vessel`, `discovery-vessel`,
`surrealdb` — have **no** make restart target. Push reaches them like every
other vessel. For the same deliberate single-machine hatch, copy source in and
restart the unit directly (or rebuild for a clean deploy) — with the same
clobber caveat, since the copy source is again your working tree:

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
# The trace store requires auth — the key is in ~/.metabob/config.json
# (or `docker exec substrate-live substrate-key show`).
KEY=$(jq -r .metabob.apiKey ~/.metabob/config.json)
curl -s -H "Authorization: ApiKey $KEY" \
  "http://localhost:18080/v2/activities/execution-traces?limit=1" | jq .
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

**`logs-*` is an enumerated set of targets, not a pattern rule.** There is no
generic `logs-<unit>`: make has one explicit target per covered unit, and any
other name fails with `No rule to make target`. The targets that exist are:

`logs-all` (the whole journal, followed), `logs-activity-api`,
`logs-analysis-vessel`, `logs-boredom-vessel`, `logs-bootstrap-seeder`,
`logs-concept-db`, `logs-development-vessel`, `logs-goal-host-vessel`,
`logs-llm-resolver-vessel`, `logs-local-tools-vessel`, `logs-m1-trainer`,
`logs-ribosome-vessel`, `logs-surrealdb`.

Most follow the unit (`journalctl -fu`); `logs-bootstrap-seeder`,
`logs-boredom-vessel`, and `logs-m1-trainer` instead dump the unit's journal and
exit (`--no-pager`), so those three return rather than blocking your terminal.
For **any unit without a target** — every
timer-driven tick, the rendered LLM arms, identity, discovery — read the journal
directly, which works for all of them:

```bash
docker exec substrate-live journalctl -u <unit>.service -n 100 --no-pager
docker exec substrate-live journalctl -fu <unit>.service        # follow
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

## Trace-store retention and the maintenance lease

The trace store (`activity_execution_traces`) is the learning substrate, and it
grows with every execution. Left unbounded it wedges the learning loop: a global
count over the table is a multi-second full scan, and every observer that reads
traces pays that cost. The substrate therefore manages the table's size itself
rather than waiting for an operator to notice.

**Size accounting is O(1), never a scan.** Both insert paths increment a
`trace_store_counters` row, so the current row count is a read of one record.
Nothing in the retention path performs a global `GROUP BY` or an unbounded
`ORDER BY`.

**Retention config lives in activity-api** (`config.traceStore`), bootstrap-read
from the environment because it bounds a destructive operation:

| Variable | Meaning | Default |
|---|---|---|
| `TRACE_STORE_CAP` | row count above which the store is flagged for reconciliation | `50000` |
| `TRACE_STORE_HOT_WINDOW_DAYS` | recency window kept in full | `14` |
| `TRACE_STORE_RESERVOIR_PER_ACTIVITY` | stratified sample kept per activity outside the hot window | `25` |

**The cadence is autonomous.** development-vessel's `trace_store_health_observer`
reads the counters against the cap and emits a `substrateGap` in category
`trace_store_reconciliation`; the gap routes into the drain/compose loop, which
dispatches the seeded `trace-store-reconcile` activity through goal-host. The
activity acquires a lease, invokes the reconcile, and releases — the whole
sequence is one traced execution graded on `reached`, like any other work.

**`maintenanceLease` is the coordination primitive.** It is a shape served by
development-vessel, file-backed at `WORKSPACE_ROOT/leases/maintenance.json`
(override `MAINTENANCE_LEASE_PATH`), holding a single
`{ holder, token, acquired_at, expires_at }` object — no file means no lease. It
is read through the `maintenanceLease` shape and mutated through
`maintenanceLease_write` with `op: acquire | renew | release`, each returning a
`maintenanceLeaseWriteResult`. `acquire` takes a `holder` and an optional
`ttl_ms`; `renew` and `release` take the token `acquire` returned, so a caller
cannot release someone else's lease. It is a **single global mutex** across the
substrate, so a holder that acquires twice deadlocks itself — release before
acquiring on a nested path.

Two sides honour it:

- **Readers pause.** development-vessel's shared observer fetch helper checks
  the lease before each trace-store read and skips the cycle while one is held.
  The check **fails open** — an unreadable or malformed lease file proceeds as
  if no lease existed, so a corrupt lease can never wedge self-measurement.
- **The writer is gated.** activity-api's `db_admin` operation
  `reconcile_trace_store` validates a caller-supplied `lease_token` against the
  same file and **fails closed** without a valid unexpired lease.

**The reconcile is a copy-forward table swap**, which is why its rails matter.
SurrealDB has no table rename, so it builds a `_next` table from the keep set
(hot window plus per-activity reservoir), drops the views and the original,
replays the schema, copies back, and redefines the views. Its rails:
`dry_run` defaults **true** (a live run requires an explicit `dry_run:false`);
every table name is a fixed constant, never caller-supplied; and every
invocation — dry-run or live, refused or applied — writes an audit row to
`db_admin_audit` including the captured DDL snapshot and, on failure, the step
reached. There is no automatic rollback: recovery is from that DDL snapshot plus
your volume backup.

**Operationally this means: take the lease before you touch the store.** Before
any destructive reset or manual DB work, back up both volumes *and* acquire a
`maintenanceLease`, so observers pause and the reconcile op cannot fire
underneath you. A vessel restart landing mid-window is what loses a swap, which
is why the mitosis cutover path wraps its whole cutover in a lease too — anything
that restarts vessels or rewrites the store is a maintenance window and should
hold one.

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

> **No GHCR credential is needed to pull.** The published package is public, so
> `ghcr.io/avigopal/substrate:dev` pulls anonymously — the container/compose
> path and a raw `docker run` both work with no `docker login`. (Should the
> package ever be flipped back to private, the paths that would need a
> `read:packages` token are the ones that **pull**: the container/compose path,
> a raw `docker run`, and `deploy-hub-pull.sh` — which accepts optional
> `GHCR_USER`/`GHCR_TOKEN` for exactly that case. The build-on-target paths —
> `deploy-hub.sh`, local `make build` — construct the image instead of pulling
> it and would be unaffected.)

| Path | Command | What it does |
|---|---|---|
| **Local** | `make -C scripts/substrate run-live ANTHROPIC_API_KEY=…` | Builds/runs the full fleet locally as `substrate-live` (host ports `18080`/`18090`/`18100`/`18101`/`18210`/`18250`/`18260`/`18270`/`18310`). The everyday development target. |
| **Hub (clone + build on a VM)** | `GITHUB_PAT=… ANTHROPIC_API_KEY=… SSH_KEY=… bash scripts/substrate/deploy-hub.sh root@<vm-ip> <public-ip>` | `deploy-hub.sh` clones the repo + submodules **on the VM** and builds there (no multi-GB image ship), runs `ENABLED_ROLES=hub`, seeds the single shared org (so spokes registering with a hub-issued key share its namespace), and stands up the libp2p relay. |
| **Remote (ship prebuilt image over SSH)** | `ANTHROPIC_API_KEY=… bash scripts/substrate/deploy-remote.sh root@<vm-ip>` | `deploy-remote.sh` ships the locally-built image via `docker save \| ssh docker load` (**no registry**), runs + seeds it on the VM using the portable named volumes. Optional `PUBLIC_IP=… RUN_RELAY=1` also stands up the public relay; optional `PEER_DISCOVERY=<ip>:18100 FEDERATION_SIGNING_SECRET=<hex>` peers it to another substrate. |
| **Fleet convergence** | *(no command — it is already running)* | Every substrate converges itself: `substrate-pull-sync.timer` runs in-container on each box and pulls `origin/dev` into that container's own clones. A fleet converges because each member pulls, not because a host pushes to all of them. See [Self-sync](#self-sync-git-remotes-are-the-only-code-channel). |

**Do not reach for a host script to push source into containers.** The only unit
in the substrate's own unit set that sits on the code channel is
`substrate-pull-sync.service`, driven by `substrate-pull-sync.timer` and by a
boot run ordered after `git-push-setup.service`. Any host-side script that
`docker cp`s source names one container on one Docker daemon, so it can only
ever converge the substrate the operator happens to be sitting next to, and it
writes content that is on no branch — invisible to review and to every peer.
A change reaches the fleet by landing on `origin/dev`: that is the channel every
substrate already watches. The single-machine hot-reload targets under
[Iteration loop](#hot-reloading-one-local-container-the-escape-hatch) remain
available as a deliberate local convenience; they are not a delivery path.

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

`substrate-pull-sync.timer` (10 min, plus a boot run after `git-push-setup`) converges the live `/vessels` runtime to each clone's `origin/dev`: ff-only pull → `mirror-to-live` → staggered, health-gated restart. A restart that goes unhealthy reverts to the last-good pin (`/workspace/.last-good/<v>`) and halts the run with a `substrateGap`; a diverged clone is refused (never forced). Runs skip while a mitosis cutover is in flight (`/workspace/mitosis-pending.json`). This is also how a *fleet* of substrates converges — each one pulls origin; no host mediates. It is the **only** unit-driven code channel: no host-side script is wired to a unit or is load-bearing on it. Self-recovery's revert source is the git clone too, never a host checkout. Without a `SUBSTRATE_GIT_PAT` the sync no-ops with a warning: the substrate is frozen-but-functional.

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

The consequence to hold onto: **a change reaches the running vessels only once it
is pushed.** A local edit that is uncommitted, or committed but unpushed, exists
nowhere the substrate looks — no host mechanism carries it in. The exceptions are
both explicit and local: the hot-reload targets under
[Iteration loop](#hot-reloading-one-local-container-the-escape-hatch), and a
substrate running without a `SUBSTRATE_GIT_PAT`, whose pull-sync no-ops and which
therefore only ever changes by rebuild or by that same hatch.

## Development-vessel specifics

`development-vessel` is the meta-vessel for substrate self-development: the failure-mode harness, topology-discovery activities, `coverage-tick`, and `substrate-health-tick` all run as activities inside it. The `development-vessel.service` unit runs `seed-templates` automatically via `ExecStartPost` on every start — seeds are idempotent UPSERTs so re-running is safe.

**goal-host-vessel async dispatch.** `POST /run-goal` returns HTTP 202 immediately; goal execution happens asynchronously. Callers (goal-host-vessel clients and boredom-vessel) must poll for execution status rather than waiting for a synchronous response. This means a 202 from `/run-goal` does not indicate goal success — check the execution trace in activity-api to confirm completion.

The topology-discovery loop runs autonomously inside the substrate. The boredom-vessel is a dispatch-pool daemon: each selection pass scores a pool of candidate templates on learned momentum, input-shape availability, and priority-weight folds derived from current conditions, then dispatches winners concurrently up to a slot cap. Measurement, probing, health, escalation, coverage and gap-closing work all enter through this same pool; there is no fixed rotation. Selection momentum persists across restarts, so learned preferences survive cutovers.

The law on pace expects that scoring to be driven by time-shaped rhythm impulses the selector reads from the pool. It is not: no vessel advertises a rhythm shape and no selector consumes one, so recurrence throughout the fleet is scheduled by systemd timers and by fixed intervals read at process start. Those values are invisible to traces and cannot be learned or graded, which makes the missing rhythm shape a standing gap rather than an implementation detail. Verify the specific tags, template names and intervals in force against the running registry and the unit files; do not take them from this document.

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

This has a practical consequence for vessel startup: goal-host-vessel subscribes to `vessel.registered` and uses those events to reactively register proxy resolvers for newly-appearing vessels. This is what makes registration order irrelevant: a vessel that starts after goal-host-vessel is picked up automatically rather than staying invisible until the next restart cycle.

## Vessel self-replacement

Vessels that accumulate idiom-purity gaps are candidates for substrate-driven self-replacement. Purity gaps include: serving legacy REST endpoints alongside the resolver contract, implementing built-in tools (bash, read, write, git) instead of routing through discovery-resolved ones, or maintaining internal state that belongs in the substrate's shared store. The substrate audits purity against the canonical idiom set, mints a replacement vessel via the forge, validates the replacement in shadow against live traffic, and promotes it on evidence. The original vessel is archived rather than modified in-place.

A vessel carries a purity gap when it serves legacy REST endpoints that predate the resolver contract, or ships built-in tools (bash/read/write/edit/git) that bypass discovery instead of routing through discovery-resolved ones. Self-replacement for such a vessel is substrate-driven and not operator-led — the operator's role is adversarial testing of the replacement, not authoring it. Which vessels carry gaps is a live fact: query the purity audit rather than trusting a list here.

## Closure properties

Lift requires not just what the substrate does autonomously, but what it does NOT depend on. Seven external stateful dependencies are the formal closure gaps — services and state structurally outside the substrate that load-bear on lift properties until each is replaced:

1. **Operator memory** (`~/.claude/.../memory/`) — cross-session recall that the substrate has no equivalent surface for. Replacement: `memoryNote` shapes owned by development-vessel, mirrored to the cache via `memory-sync-tick`.
2. **Slash-command skills** (`/openspec-propose`, `/review`, `/deploy`, etc.) — stateful workflows bound to the Claude Code harness. Replacement: substrate-resident activity equivalents (`propose-spec`, `verify-merge-candidate`, `apply-spec`).
3. **Subagent dispatch** (Plan, Explore, general-purpose) — research and multi-step work via operator-side invocation. Replacement: substrate activity dispatch with goal decomposition resolvers.
4. **GitHub Actions CI** — merge gates and canary deploy triggers in GitHub infrastructure. Replacement: substrate harness as the merge-authority gate; substrate-resident CI criterion (`ciAgreementReport`).
5. **Operator shell access** (`kubectl`, `helmfile`, `docker exec`) — operational commands outside the substrate's activity system. Replacement: substrate-dispatched restart and restore activities (`restart-vessel`, `restore-data`).
6. **Operator spec-authoring** — new specs originate with the operator. Replacement: substrate-authored proposals via `propose-spec` / `verify-merge-candidate` pipeline with operator as reviewer.
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

**Units not starting within 60s**: read the failing unit's journal — `docker exec substrate-live journalctl -u <unit>.service -n 100 --no-pager` (or the matching `logs-*` make target, if the unit has one). Most common cause: a host-port conflict on one of the published ports (e.g. another process already on `18270`) — `run-live` aborts with "Bind for 0.0.0.0:18270 failed: port is already allocated".

**API key needed but lost**: if you ran `seed-identity.ts` but forgot the key, re-read it from the container env file: `docker exec substrate-live grep METABOB_API_KEY /etc/substrate/env`. Then re-run `configure-local.sh` to update your local config.

**Harness connection errors**: confirm `~/.metabob/config.json` points to `http://localhost:18080`, not the canary endpoint. Run `scripts/substrate/configure-local.sh` to reset.

**`make restart-<vessel>` fails**: the container must be running (`make -C scripts/substrate run-live` first). Units restart in-place; the container itself is not restarted. Note that only the vessels listed under "Iteration loop" have a `restart-<vessel>` target — core vessels (activity-api, identity-vessel, discovery-vessel, surrealdb) are restarted with `docker exec substrate-live systemctl restart <unit>`.

**Tooling connects to the wrong substrate**: client tooling reads its target from `~/.metabob/config.json`, and `configure-local.sh` points it at the local substrate. Inside the container, each systemd unit reads its endpoints from `/etc/substrate/env` — the load-bearing variables are `METABOB_API_KEY`, `ACTIVITY_API_ENDPOINT=http://127.0.0.1:8080`, and `IDENTITY_ENDPOINT=http://127.0.0.1:8101`. If you rebuilt the container without pulling the latest gen-env.sh, run `docker exec substrate-live bash /scripts/substrate/gen-env.sh` to regenerate the env file.
