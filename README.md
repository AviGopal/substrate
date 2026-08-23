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

The whole system runs as **one container** (`substrate-live`) hosting the vessel fleet as systemd units — no Kubernetes, no orchestration on the host. The host contract is a single `docker run`: one privileged container, one LLM-provider env var, two named volumes (workspace + datastore). Everything load-bearing — seeding, readiness, diagnosis — happens inside the container at boot; the Makefile is a convenience wrapper over exactly that contract.

### Quick start from the published image (few commands, from repo root)

The canonical image is `ghcr.io/avigopal/substrate:dev` (fleet), published by
`.github/workflows/build-substrate-image.yml` on every push to `dev`. It is
**public** and pulls anonymously — no `docker login` and no PAT.
(`ghcr.io/avigopal/substrate:obsidian` adds an in-container Obsidian over noVNC.)
A pulled image needs no submodules.

> To check the package's visibility yourself:
> `curl -s "https://ghcr.io/token?scope=repository:avigopal/substrate:pull"`
> returns a usable token with no credentials, and a manifest fetch with that
> token returns `200`. A bare manifest request answering `401` is **not**
> evidence of a private package — that is the first step of the standard
> anonymous OCI token flow, which `docker pull` performs for you.
Requirements: Docker with Linux x86_64 semantics and `--privileged` (native
Linux, or Docker Desktop with the WSL2 backend on Windows).

**Standalone substrate** — the canonical root-level `docker-compose.yml` reduces
launch to a few commands; every secret but the one LLM key auto-generates on
first boot and persists to the volumes.

This path needs a **checkout** (for the compose file and `.env.example`), though
not its submodules — a pulled image contains the vessel source already:

> **Already running a substrate on this host?** Read this *before* running the
> block below, which uses the default names and the default `18xxx` ports.
> `SUB=substrate-live` below is the container name; on the compose lane a second
> fleet needs `SUBSTRATE_CONTAINER`, **both** of `WORKSPACE_VOLUME` /
> `SURREAL_VOLUME`, and all nine `*_PORT` values (`.env.example` TIER 2b). On the
> make lane it is `LIVE_NAME` + `PORT_OFFSET`. **The two lanes do not translate
> each other.** Reusing the default volume names does not fail — it silently
> attaches the new fleet to the first one's learning state, and two substrates
> writing one datastore corrupts both.

```bash
git clone https://github.com/AviGopal/substrate.git && cd substrate
SUB=substrate-live                         # a second fleet: set this AND the vars above

cp -n scripts/substrate/.env.example .env  # -n: never clobber an .env you already have
                                           # (silent when it skips — check the file is yours)
$EDITOR .env                               # uncomment ANTHROPIC_API_KEY (or OPENAI_API_KEY) and set it
docker compose pull                        # `up` alone reuses a local tag; this fetches the current one
docker compose up -d                       # run from repo root — root compose is canonical

# CHECK IT DID NOT CRASH-LOOP. `up -d` prints "Started" and exits 0 even when the
# container dies immediately, because compose reports that it launched, not that
# it lived — and `restart: unless-stopped` then retries forever. The commonest
# cause is an unedited .env: gen-env refuses to boot without a provider key, which
# is deliberate, but the refusal is only visible here.
sleep 15; docker ps --filter "name=$SUB" --format '{{.Status}}'   # "Restarting" => read the logs:
docker logs --tail 20 "$SUB"

# `healthy` means the container is live, NOT that identity is seeded. Until the
# seeder finishes, `substrate-key show` prints a pre-seed placeholder that every
# call rejects with 401 — and it prints it without any error. Gate on a check
# that actually validates the key. `whoami` works on every topology, because it
# asks whichever identity-vessel this fleet uses — its own, or its hub's.
#
# Bounded on purpose: an unbounded `until` turns a genuine seed failure into a
# silent forever-loop. The container's own identity-seeder gives up after 300s.
for i in $(seq 1 30); do
  docker exec "$SUB" substrate-key whoami 2>/dev/null | grep -q '"valid": *true' && break
  [ "$i" = 30 ] && { echo "identity never seeded. Check BOTH — the container may never have started:"; \
                     echo "  docker logs --tail 50 $SUB"; \
                     echo "  docker exec $SUB journalctl -u identity-seeder -n 50"; }
  sleep 10
done
docker exec "$SUB" substrate-key show
```

When you are done with it, tear it down — `docker rm` alone leaves the volumes,
and a later "clean" install silently inherits them:

```bash
docker compose down          # stop and remove the container, KEEP the learning state
docker compose down -v       # …and DESTROY both volumes: posteriors, traces, concept graph
```

First boot takes a few minutes to converge. Running `substrate-doctor` before
then shows failures that clear on their own — a young substrate looks like a
broken one. Confirm a key works before using it:
`docker exec <container> substrate-key whoami` should report your `org_id` and scopes.

> **If the key gate passes but goals fail, check the LLM arm first.** A fleet
> with an absent or invalid provider key boots clean, reports `healthy`, passes
> the gate above and almost every doctor check — and cannot draft a token. The
> dispatch failure names template ids, not authentication, so it does not point
> at the cause. The one check that does is `substrate-doctor`, which POSTs a
> real completion to each arm:
> `docker exec substrate-live substrate-doctor` — look for the `llm arm` line.

The raw `docker run` below hardcodes the same default names and ports; a second
fleet needs its own, per the callout above.

To launch with **no checkout at all**, use the raw `docker run` below — it needs
nothing from this repo.

`scripts/substrate/docker-compose.yml` is a symlink to the root file, so
either directory works. `OPENAI_API_KEY` works in place of `ANTHROPIC_API_KEY` —
exactly one LLM key is required; every other secret auto-generates on first boot
to `/workspace/.substrate-secrets`.

**Raw `docker run`** — the same image, without compose:

```bash
docker run -d --privileged --name substrate-live \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -p 18080:8080 -p 18090:8090 -p 18100:8100 -p 18101:8101 -p 18210:8210 \
  -p 18250:8250 -p 18260:8260 -p 18270:8270 -p 18310:8310 \
  --tmpfs /run --tmpfs /run/lock ghcr.io/avigopal/substrate:dev
```

That is **nine** ports, matching `docs/SUBSTRATE.md` and the root compose file.

`18310` is `human-surface-vessel` — the vessel a human talks to — and
**publishing the port is not the same as serving it.** The human surface is a
*manifest* vessel, which a default boot leaves uninstalled, so `:18310` answers
connection-refused while every other health signal is green. Install it once:

```bash
docker exec substrate-live vessel-ctl install human-surface-vessel
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:18310/health   # 200
```

Omit the port mapping instead and the vessel runs but binds only inside the
container, which looks identical from the host.

Once the fleet has converged (see the key gate above), dispatch a goal against
goal-host and poll it:

```bash
curl -X POST http://localhost:18210/run-goal -H 'Content-Type: application/json' \
  -d '{"goal":"list the running units"}'        # 202 {"dispatchId":"…","status":"running"}

curl http://localhost:18210/executions/<dispatchId>
```

Read **`reached`**, not `status`: `status` is only the template's exit code, and a
run can complete without reaching the goal. Identical goal text coalesces onto the
existing dispatch rather than starting a second one.

Traces live on activity-api at `http://localhost:18080` — an **authenticated JSON
API, not a web page** (`GET /` returns 404):

```bash
curl -H "Authorization: ApiKey $(docker exec substrate-live substrate-key show)" \
  'http://localhost:18080/v2/activities/execution-traces?limit=5'
```

Retrieve your operator API key straight from the running container (the tool is
baked into the image — no repo checkout needed):

```bash
docker exec substrate-live substrate-key show
```

`healthy` is a liveness signal, not a correctness one — it can report healthy
while the datastore credentials are broken and every request that touches the
store fails. Before trusting a boot, run the fuller check:

```bash
docker exec substrate-live substrate-doctor
```

Optional: add `-e SUBSTRATE_GIT_PAT=<github-pat>` so the
substrate can pull + push the source repos it is built from (self-alteration);
without it, self-authored commits stay local. Full config matrix:
[`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) § *Container config matrix*; every
variable by delivery channel and read point:
[`docs/operations/CONFIGURATION_SURFACE.md`](docs/operations/CONFIGURATION_SURFACE.md);
federation details: [`docs/FEDERATION.md`](docs/FEDERATION.md).

### Join an existing identity / discovery group (spoke)

A spoke contributes a local registry + compute while identity, traces, and
learning state live on the hub. Joining is **point-and-go**: pointing
`DISCOVERY_ENDPOINT` at the hub's discovery and presenting a hub-issued
`METABOB_API_KEY` is sufficient — the role, identity endpoint, trace store, and
relay anchor are all derived from those two, the last of them from
`<discovery-endpoint>/bootstrap`.

> **It must be `DISCOVERY_ENDPOINT`.** Setting `HUB_DISCOVERY_URL` instead looks
> equivalent and is not: the derivation block keys on `DISCOVERY_ENDPOINT`, so
> with it empty nothing is inferred and you get a standalone wearing hub-shaped
> variables — no `ENABLED_ROLES=spoke`, endpoints left on loopback. The
> provider-key guard *does* read `HUB_DISCOVERY_URL` and waives the local LLM key
> on that signal, so the result is a standalone with no key and no local arms.
> The same trap is described again under the compose example below.

**Check the target is joinable first.** A reachable discovery is not necessarily
a hub: a standalone substrate answers `/bootstrap` with `200` and an empty body,
so "reachable" and "joinable" look identical, and the spoke boots and then
crash-loops its transport against a relay that was never advertised.

```bash
curl -s http://<hub-host>:18100/bootstrap | jq '.relay_multiaddrs'
# []  => not a hub: no relay. Deploy it with deploy-hub.sh, or pass RELAY_MULTIADDR.
```

**Read the address, not just the count.** A non-empty answer means the hub is
*advertising* a relay, not that the relay is alive: the handler builds that array
from configuration and registry rows and never dials anything. Measured against a
live hub — a populated array pointing at a host that had been decommissioned,
whose HTTP plane was gone while its libp2p daemon still accepted TCP, and whose
own advertised relay port was closed on the hub itself.

So the count cannot distinguish dead from alive, and neither can a TCP dial — the
dead host accepted the connection. There is no one-liner for this. The signal
that actually settles it is the transport's own reservation, read after boot:

```bash
docker exec <spoke> journalctl -u federation-transport-vessel -n 30
# look for a circuit reservation against the advertised relay, not just "up"
```

Two things worth checking in that same payload: an address on a *different host*
than the hub you are joining is a sign the advertisement has outlived its relay,
and a loopback `identity_endpoint` only means the hub has no `PUBLIC_IP` set — it
is inert, since a spoke derives identity from the discovery host and port offset.

See [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) § *Join an existing identity/discovery
group* for the rest.

> **A joining spoke writes to the hub.** The `spoke` role group includes `seed`,
> and the seeder targets the *derived hub* store — so a join registers the shared
> activity templates into the hub's activity-api using your issued key. The writes
> are idempotent upserts of templates a hub already has, but a spoke you do not
> fully trust should get a read-scoped key or `DISABLED_VESSELS=bootstrap-seeder`.
`METABOB_API_KEY` is the credential the hub operator issues you (minted on the
hub with `docker exec <container> substrate-key issue <you>`). The same variables
attach a spoke however you launch — `docker compose`, `make up`, or the raw
`docker run` above; `ACTIVITY_API_ENDPOINT` and `IDENTITY_VESSEL_URL` are
optional explicit overrides for values `/bootstrap` otherwise supplies.

> ⚠ **The two launch lanes name a second instance differently, and neither
> translates the other.** `make up` takes `LIVE_NAME=<name>` (which also renames
> both volumes) and `PORT_OFFSET=<n>` (which shifts the whole `18xxx` block at
> once). **Compose has no `PORT_OFFSET` and no `LIVE_NAME`**: relocating there
> means setting `SUBSTRATE_CONTAINER`, `WORKSPACE_VOLUME`, `SURREAL_VOLUME` and
> the nine individual `*_PORT` variables. A reader who learned the make lane and
> switches to compose gets a container named `substrate-live` on the unprefixed
> production volumes — which, on a host already running one, either collides or
> adopts the existing fleet. `scripts/substrate/.env.example` TIER 2b lists the
> compose-side names.

**Docker Compose** — put the join vars in the root `.env` (the root
`docker-compose.yml` and its [`scripts/substrate/docker-compose.yml`](scripts/substrate/docker-compose.yml)
symlink pull the same GHCR image), then bring it up:

```bash
# .env
METABOB_API_KEY=<hub-issued-key>            # required: the hub-issued credential
DISCOVERY_ENDPOINT=http://<hub-host>:18100  # required: this is what makes it a spoke
# optional overrides — otherwise derived from the discovery host and its port offset:
# ACTIVITY_API_ENDPOINT=http://<hub-host>:18080
# IDENTITY_VESSEL_URL=http://<hub-host>:18101
```

Those two are the whole join. `DISCOVERY_ENDPOINT` naming a **remote** host is the
signal that this container is a spoke: `gen-env` infers `ENABLED_ROLES=spoke` from
it, derives the hub, trace store and identity endpoints, and then **rewrites
`DISCOVERY_ENDPOINT` itself to the spoke's own local registry** — a spoke's vessels
register locally and the transport mirrors them to the hub. So the value you set
is not the value the vessels end up using, and that is intended. Setting
`HUB_DISCOVERY_URL` *instead* does not work: with `DISCOVERY_ENDPOINT` empty the
inference never fires and you get a standalone with hub-shaped variables.

```bash
docker compose up -d                       # from repo root — compose auto-loads `.env`
docker exec substrate-live substrate-key show
```

**`make up` / raw `docker run`** — the identical vars work as `-e VAR=value`
flags on the standalone `docker run` above, or as `VAR=value` arguments to
`make -C scripts/substrate up`.

> ⚠ **A spoke is *designed* to inherit the hub's LLM arms, and that inheritance
> does not yet work.** Measured on a live join: the spoke's walk fails with
> `No vessel advertising llm_completion found in discovery`, because arm
> inheritance rides the federation transport — so a spoke whose transport is not
> up (see the relay pre-flight above) has no model access at all, and loses
> `concept-db` with it. Identity and the trace store keep working, because those
> are reached by direct HTTP, which is why the fleet looks healthy. Until the
> transport is confirmed carrying, give a spoke its own provider key.

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

Your vessels then appear in the hub registry as `<vessel>@<unique-id>`.

**Confirming the join** — most signals cannot tell "joined" from "running but
isolated", so check the two that can:

```bash
# 1. Identity: a spoke runs no local identity-vessel, so a valid answer here can
#    only have come from the hub. This is the discriminator.
docker exec <spoke> substrate-key whoami          # "valid": true + the hub's org_id

# 2. Transport: the plane that actually mirrors your vessels to the hub.
docker exec <spoke> systemctl show federation-transport-vessel -p NRestarts --value
```

A climbing `NRestarts` means the transport is crash-looping, even though
`systemctl is-active` intermittently reports `active` — it catches the gap
between restarts. `docker exec <container> substrate-doctor` names it honestly.

**The loss is in both directions, not just outbound.** The obvious half is that
nothing is being mirrored *to* the hub. The half that surprises people is
inbound: the transport is also how the spoke resolves shapes the hub serves, so
while it is down the spoke loses `llm_completion` and `concept-db` outright — a
walk fails with `No vessel advertising llm_completion found in discovery`.
Identity and the trace store keep answering because they are reached by direct
HTTP, so the fleet reports healthy and a goal fails for reasons that look
unrelated. A spoke with a dead transport is not "isolated but working"; it is
degraded at both ends.

What will *not* tell you: the container's `healthy` state, and `substrate-key
show` (prints a key whether or not the hub accepts it).

`substrate-doctor` now names an unjoined spoke directly — it probes the hub
rather than loopback, and reports `METABOB_API_KEY rejected by the hub's
activity-api (401) — THIS SPOKE HAS NOT JOINED`, plus a separate check that
validates the credential against the issuing identity. On an image predating
that, doctor is not a reliable join signal: it reported four failures on a spoke
that had not joined and named the credential in none of them. Its registry check
in particular counts *local* vessels, so it says nothing about the hub either
way.

A local Obsidian plugin connects to the spoke with its normal two inputs (API key
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

`.gitmodules` pins each vessel by a URL **relative** to the superproject
(`../<vessel>.git`), so the submodules resolve against whatever origin you cloned
from — a fork works with no rewrite rule and no edit to `.gitmodules`.

All eighteen are public today, so the clone above needs no credential: verify
rather than take it on trust, with
`git config -f .gitmodules --get-regexp url`, and for any one of them
`git ls-remote <url>`.

If you fork into an org where some vessels are private, supply the credential
through the URL you clone from, or configure a rewrite **scoped to that org**:

```bash
# scoped to one org — leaves anonymous cloning of every other GitHub repo intact
git config --global url."git@github.com:your-org/".insteadOf "https://github.com/your-org/"
```

> Avoid the unscoped form (`url."git@github.com:".insteadOf "https://github.com/"`).
> It rewrites **every** GitHub HTTPS URL to SSH for your whole account, so a
> reader with no SSH key — the newcomer most likely to reach for it — loses
> anonymous cloning everywhere, including this repo.

**2. Start** — one command:

```bash
make -C scripts/substrate up ANTHROPIC_API_KEY=sk-ant-...
```

`up` builds the image if needed, starts the container, seeds identity + templates in-container, waits for fleet readiness, points `~/.metabob/config.json` at the substrate, and runs a doctor check.

> **"If needed" means the tag is absent, not that the source changed.** `up`
> builds only when `docker image inspect $(IMAGE):$(TAG)` fails — so on a host
> that already holds the published `ghcr.io/avigopal/substrate:dev`, this
> command starts *that* image and your working tree is never compiled. To
> actually build from source, force it with `REBUILD=1`, or build under your own
> tag (`TAG=<name>`) so you do not overwrite the `:dev` tag other containers on
> the host resolve.

> **The command above puts a live secret in `argv`**, where any local user can
> read it with `ps`. Prefer exporting the variable, or putting it in the repo
> root `.env`, and let `make` pick it up from the environment. `OPENAI_API_KEY` (with optional `OPENAI_BASE_URL` for Ollama/local models and `LLM_DEFAULT_MODEL`) works in place of Anthropic; at least one LLM provider key is required. All other secrets (JWT signing, datastore password, the bootstrap API key) are generated on first boot and persisted to the workspace volume.

**3. Verify:**

```bash
docker exec <container> substrate-ready            # fleet readiness matrix
docker exec <container> substrate-doctor   # deep diagnosis + end-to-end goal dispatch
```

> **`make up` runs doctor at the end and exits non-zero if any check fails**, so
> a red `make: *** [up] Error 1` after `[ready] fleet ready` means the fleet is
> running and one check failed — read the failure rather than the exit code. The
> common first-boot case is the LLM arm check: with no valid provider key, every
> arm reports `up but CANNOT COMPLETE … 401`. That one is fatal to doing any
> work but not to the fleet. Rerun `substrate-doctor` alone to see the current
> state without re-running the bring-up.

**4. Get your credentials.** identity-vessel is internal-only, so a human obtains or mints keys through the Makefile — no raw API calls:

```bash
docker exec <container> substrate-key show                 # the operator API key
docker exec <container> substrate-key issue my-peer   # mint a key (spoke / external peer / new vessel)
docker exec <container> substrate-key list                # list issued keys
docker exec <container> substrate-key revoke key_x  # revoke one
```

The full key is printed once and never stored. See [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) § *Keys and tokens*.

**5. Install the human interface (Obsidian plugin)** — one command, into an existing or new vault.

The installer lives in a **submodule**, which the image-based quick start above
does not initialise. Fetch just that one first (a full `--recursive` init is not
needed):

```bash
git submodule update --init repos/obsidian-vessel

bash repos/obsidian-vessel/install.sh --local            # same-machine substrate
bash repos/obsidian-vessel/install.sh                    # interactive: vault → host → key
```

If you would rather not add a submodule, the fleet already ships a browser-based
human surface on `:18310` — install it with `vessel-ctl` as shown above.

The installer selects or creates the vault, installs the plugin, and writes the two inputs the plugin needs — `{discoveryVesselEndpoint, apiKey}`. At start the federation sidecar fetches `<discovery-endpoint>/bootstrap` for the relay anchor (point-and-go) and reserves a libp2p circuit; the relay multiaddr is an optional advanced override, not something the installer derives or pins. See [`repos/obsidian-vessel/README.md`](repos/obsidian-vessel/README.md).

### Running your own hub or remote substrate

The spoke join above works against **any** hub — substitute the hub's host in `DISCOVERY_ENDPOINT` (the variable that makes it a spoke; see the warning above — `HUB_DISCOVERY_URL` alone does not) and optionally in the `ACTIVITY_API_ENDPOINT` / `IDENTITY_VESSEL_URL` overrides, then use a key that hub issued (`docker exec <container> substrate-key issue …` on the hub).

One image serves every role: a full local substrate, a minimal hub (control plane + store + relay), or a compute-only spoke — selection is declarative via `ENABLED_ROLES` / `ENABLED_VESSELS` (`scripts/substrate/vessels.inventory.json`, applied at boot). Vessels behind NAT join over the libp2p relay via a sidecar. To stand up your own remote substrate or hub on a VM: `scripts/substrate/deploy-remote.sh` (ships the local image over SSH, no registry) or `scripts/substrate/deploy-hub.sh` (the VM pulls the repo, builds there, and runs the relay).

`deploy-hub.sh` takes **two positional arguments**:

```bash
ANTHROPIC_API_KEY=<key> [SSH_KEY=~/.ssh/your_deploy_key] [GITHUB_PAT=<pat>] \
  scripts/substrate/deploy-hub.sh user@vm-ip <public-ip>
```

The public IP is not optional and is not derived — the federation relay hard-exits without it, under `Restart=always`, so the symptom is a permanent crash-loop reporting `activating` and never `failed`. `deploy-remote.sh` wants `PUBLIC_IP` plus `RUN_RELAY=1` for the relay case.

`GITHUB_PAT` is **optional**: this repo and every submodule are public, so the clone is anonymous by default. Supply one only for a private fork or to raise the API rate limit. `SSH_KEY` selects a non-default identity.

> **Before you point it at a VM, three things the script does that you should expect:**
>
> - **It runs `docker stop -t 300` then `docker rm -f substrate-live` on the target**, unconditionally. On a machine already running a substrate, that is a drain-and-destroy of the container (the named volumes, and so the learning state, survive).
> - **The relay needs two runs.** The first deploy has no relay yet, so `RELAY_MULTIADDR` stays empty and hub federation egress is disabled — `/bootstrap` will still return `relay_multiaddrs: []`, i.e. it will still fail the "is this a hub" pre-flight above. Re-run the same command once the relay is up. The script warns when this happens; the warning is the expected first-deploy path, not a fault.
> - **The relay runs on the VM host**, as a `nohup bun` process outside the container (bun is installed if absent) — so it is not covered by the container's restart policy or its healthcheck.
>
> Both deploy scripts fall back to `~/.metabob/config.json` (`providers.anthropic.apiKey`) when `ANTHROPIC_API_KEY` is unset, and pass the key on the remote **ssh command line**, where it is visible in the VM's process table. Set it explicitly, and prefer a VM you control.

`SUBSTRATE_REPO_OWNER=<your-org>` points a **running container's** vessel clones at your fork; it is read by `gen-env` and the Makefile. **Neither deploy script consumes it** — `deploy-hub.sh` clones `REPO`, which defaults to `AviGopal/substrate` and is overridden with `REPO=<owner>/substrate`. Full guide: [`docs/FEDERATION.md`](docs/FEDERATION.md).

## Working with the substrate

Each vessel is reached on a host-mapped port (`18xxx → 8xxx`); a few vessels are internal-only and reached via discovery.

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

# validate against the local substrate (localhost:18080):
bun run validation/scripts/failure-mode-harness.ts
mcp__metabob__run_goal  goal="verify the change works"
```

**Day-two operations.** Each verb below is documented in
[`docs/SUBSTRATE.md`](docs/SUBSTRATE.md); this table exists so you know the verb
exists at all.

| Need | Command |
|---|---|
| Is it healthy? | `docker exec <c> substrate-ready` — per-unit, and the honest not-ready count. **`docker ps` and the container HEALTHCHECK are not sufficient**: they answer on core units only. |
| Is it *correct*? | `docker exec <c> substrate-doctor` — auth, registry, restart loops, and whether an LLM arm can actually complete. Costs a real completion per arm; don't loop it. |
| What's running / restarting? | `docker exec <c> vessel-ctl status` (services; `restarts=` is the cheap tell) · `systemctl list-timers` for the timer half |
| Preview a selection change | `docker exec <c> env DRY_RUN=1 ENABLED_ROLES=<roles> apply-inventory` — read-only, and the one instrument that reports honestly on every selection variable |
| Inventory vs reality | `vessel-ctl drift` (read-only) → `vessel-ctl apply` (converges; **no action lines = converged**) |
| Add / remove a capability | `vessel-ctl list` · `install <v>` · `uninstall <v>` · `deregister <v>` (registry only, leaves the unit alone) |
| Update the code | `substrate-pull-sync` — converges vessels *and* the fleet tooling from git |
| Where did this setting come from? | `docker exec <c> substrate-config` — but see `.env.example`: `unrecorded` means "this tool cannot answer", not "your value won" |
| Stop it safely | `make -C scripts/substrate stop LIVE_NAME=<name>` — reports in-flight executions and drains rather than killing |
| Back it up | Both named volumes, after a `stop`. They hold **all** learning state; the container holds none. Recipe and restore verification: `docs/SUBSTRATE.md`. |

**Tear it down.** `docker rm` does *not* remove the volumes, which is why a
"clean" reinstall can silently inherit the old fleet's learning state:

```bash
make -C scripts/substrate stop LIVE_NAME=<name>   # drain first
docker rm -f <name>
# THIS DESTROYS ALL LEARNING STATE — posteriors, traces, concept graph, memory.
# Back up first if you might want it. Check the names before you type them:
docker inspect <name> --format '{{range .Mounts}}{{.Name}} {{end}}'
docker volume rm <name>-workspace <name>-surreal
```

For the default fleet those volumes are `substrate-workspace` and
`substrate-surreal`. **Resource footprint:** the image is ~0.7 GB; a fleet that
has been learning for a while carries a workspace volume in the high hundreds of
MB and grows with trace retention (`TRACE_STORE_CAP`).

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

Optional environment for the substrate's self-development loop: a GitHub credential (`SUBSTRATE_GIT_PAT`) lets the substrate land its own commits — without one it runs and learns but cannot push. Full guide: [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md).

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
- [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) — local single-container substrate: quick-start, iteration, backing up learning state.
- [`docs/architecture/`](docs/architecture/) — the `SUBSTRATE_AS_*` lenses (dynamics, MDP, network, representation, DEC, fleet, software) and supporting design docs.
- [`docs/RBAC_GUIDE.md`](docs/RBAC_GUIDE.md), [`docs/AUTH_JWT_CLAIMS.md`](docs/AUTH_JWT_CLAIMS.md) — multi-tenant isolation and auth claims.
- [`openspec/changes/`](openspec/changes/) — future-change proposals, designs, and tasks.
