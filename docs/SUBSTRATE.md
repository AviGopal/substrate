# Local Single-Container Substrate

This document is the operating reference for a running substrate: the full vessel fleet collapsed into a single systemd-managed container. Setup (launch, profiles, ports, install inputs, a second fleet, backup and teardown) is in [README § Installation](../README.md#installation), the only place setup commands appear.

## Why a single container?

A container gives a complete trust boundary without cluster overhead: all inter-vessel calls are localhost, SurrealDB runs as a local file instance, and a `systemctl restart` is the whole rollout. Multi-machine reach comes from running more containers (hub/spoke roles + the libp2p relay), not from an orchestrator.

A container is a valid substrate. The foundation doc defines a substrate by its fixed point (discovery-vessel) and its trust boundary, not by its infrastructure form. The same vessel code, the same seed templates, the same Thompson learning — just no pod scheduling.

## One image, any subset

The substrate has generalized from "one local container" to **one image that runs any subset of the fleet, deployable anywhere, and federatable**. The single image bakes every vessel; a declarative inventory selects which units run at boot, so the same image is a full local substrate, a minimal hub, or a compute-only spoke depending only on environment.

### Topology selection

`scripts/substrate/vessels.inventory.json` is the declarative vessel inventory: every baked-in unit maps to a **role** (`store`, `control`, `api`, `compute`, `models`, `ui`, `transport`, `seed`, `infra`, `autonomy`, `registry`, `desktop`), and role-**group** aliases compose those into deployable shapes:

- `hub` = `store`, `control`, `api`, `transport`, `seed`, `infra`, `registry`, `models` (control plane + store + relay + the model arms)
- `spoke` = `compute`, `ui`, `seed`, `infra`, `registry` (compute-only; points its control/store at a hub, and **resolves models on the hub** — `models` is excluded deliberately, so no LLM arm starts at boot)

> **How the spoke's arms are held off — two different strengths.**
> `llm-resolver-vessel`, the shared base resolver, is inventory-named under role
> `models`, so `apply-inventory` **disables and masks** it. The arms that serve
> models — the boot-rendered `llm-{opus,haiku,google}` — are **rendered, present,
> and merely not enabled**: their unit files exist as ordinary files and their
> `ExecCondition` passes wherever a provider key is set, so a deliberate
> `systemctl start llm-haiku` would raise a local arm on a spoke. Those names
> appear nowhere in the inventory, so `apply-inventory` cannot mask them; the
> entrypoint's arm pass is what leaves them unenabled. The role selection governs
> what starts **at boot**; it is not a barrier against a manual start.
- `full` = every role, `desktop` included — the intended shape of a local
  substrate, and a hand-maintained enumeration. Because it currently enumerates
  all twelve roles, `ENABLED_ROLES=full` masks nothing, which makes it
  behaviourally equivalent to leaving the selection env unset. That equivalence
  is a property of today's list, not a guarantee: `full` masks anything absent
  from it, so a role added to the inventory and not added here would be masked
  by `full` and left running by unset. Verify rather than assume:
  ```bash
  jq -r '([.vessels[].role]|unique) - .roles.full | join(", ")' \
    scripts/substrate/vessels.inventory.json   # empty => full covers every role
  ```

`models` holds the LLM resolver arms; it is separate from `compute` precisely so a
spoke can run work locally while resolving models on its hub.

`desktop` (Obsidian, Xorg, noVNC) is in **no** group on purpose. The unit *files*
ship in the base image like every other unit — what the `substrate-obsidian` stage
adds is the payload (Xvfb, noVNC, the Obsidian AppImage) and the `systemctl enable`
that turns them on. On a base image they are present but never enabled, so there is
nothing for a role to select. The consequence worth knowing: because they *are*
inventory-named, any `ENABLED_ROLES` value that omits `desktop` masks them on an
obsidian image — and a remote `DISCOVERY_ENDPOINT` selects the spoke
composition automatically, so a federated obsidian fleet loses its desktop
silently. `full` is the one group that carries `desktop`, so it is the
selection to name when an obsidian image must keep its surface.

> ⚠ **Neither `hub` nor `spoke` includes `autonomy`.** A federated hub+spoke pair
> runs none of the 26 autonomy units — no `gap-compose`, no
> `operator-goal-generator`, no `surgical-gap-scan`, no `m1-trainer`,
> no `compose-teacher`, no `funnel-drain`. Only `full` has them.
> The `hub` profile adds the six *compute* services a hub needs to dispatch
> (goal-host, development, local-tools, ribosome, analysis, light-dispatch) and
> no autonomy timers. If you want the autonomy timers in a federated deployment,
> name them explicitly.
>
> This does **not** mean a federated pair is inert. `boredom-vessel` carries role
> `compute`, so it runs on a spoke and performs condition-driven work selection:
> it admits open gaps as candidates, scores them, and dispatches without an
> operator. What a hub+spoke pair loses is the *scheduled* autonomy surface, not
> gap-driven work generation. To see it on a running spoke:
> `docker exec <container> journalctl -u boredom-vessel -n 50`.

`scripts/substrate/apply-inventory.sh` reads the inventory at boot — run by the container entrypoint *after* `gen-env` and *before* `exec systemd` — and `systemctl disable`s the unwanted units (it just removes the `*.wants` symlinks the image baked in). Selection env, highest precedence first:

- `PROFILE=name` — a named exact-unit list from `inventory.profiles`; outranks everything below, and an unknown name is **fatal** rather than a fall-through to the coarser selection
- `ENABLED_VESSELS=unit,unit` — explicit exact-unit allow-list; overrides roles
- `ENABLED_ROLES=role,role` — roles/role-groups to keep (`hub`/`spoke`/`full` expand via `inventory.roles`); everything else is disabled
- `ENABLED_EXTRA_VESSELS=unit,unit` — **additive**, applied on top of whichever selection won above
- `DISABLED_VESSELS=unit,unit` — always off, even if selected above

The full chain, including how these interact with the four config delivery
channels, is in [`docs/operations/CONFIGURATION_SURFACE.md`](operations/CONFIGURATION_SURFACE.md).

**Default (none of them set) = every baked unit enabled = the full local substrate.** This is *not* a no-op: the no-selection branch still runs the unmask and enable passes, so it clears masks left by a previous narrower selection and enables units that were added to the image after the enable symlinks were baked. "Want everything" is work, and skipping it once made the default the one selection that could not repair a fleet. Manifest-installed dynamic vessels (`"manifest": true`) are never baked-enabled, so they are never touched here — they are installed on demand (see [Dynamic vessels](#dynamic-vessels-the-canonical-attach-path)).

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
> (recreating through the manifest preserves the volumes, and therefore the
> learning state; see README § Installation → Usage patterns).
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

> **The human surface serves out-of-box.** `human-surface-vessel` (`:8310` →
> host `:18310`) ships as a baked, *enabled* vendor unit with the built UI in
> the image, and it sits outside `apply-inventory`'s selection loop — so it is
> up even under a restricted `ENABLED_VESSELS` roster, and `/` answers the UI
> itself (200), not just `/health`. Verify with the page, not the health probe:
>
> ```bash
> curl -s -o /dev/null -w '%{http_code}\n' http://localhost:18310/   # expect 200 — the UI itself
> ```
>
> To exclude it from a deployment, name it in `DISABLED_VESSELS` — that masks
> the unit (verified: selection alone does not touch it), but masking only
> blocks future starts: on a live fleet also `systemctl stop` it, or recreate. `vessel-ctl install human-surface-vessel` is the
> *source-deployment* path (its manifest workdir is the super-repo checkout,
> and its rendered unit tracks that checkout instead of the image): on a pulled
> image with no checkout the install **refuses** (`ok:false`, workdir absent)
> rather than replacing the working vendor unit with one that dies
> `status=200/CHDIR` on restart. A refusal there means: keep the vendor unit,
> or clone the super-repo into the workspace first.
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

**Routing anchors are never persisted.** Endpoint-shaped names — the hub discovery URL, the discovery/identity/activity-api endpoints, the metabob endpoint, the relay multiaddr — are dropped from `.substrate-secrets` on every write rather than carried forward, and both writers (`gen-env.sh` and `secrets.env.sh`) drop them. They are derived fresh into `/etc/substrate/env` on each boot instead. The reason is that an address is a fact about *where this deployment currently is*: a persisted one outlives the host it named, and a substrate then boots pointing at a machine that no longer exists. Units that load both files list `.substrate-secrets` **first** and `/etc/substrate/env` **last**, so the derived value wins; a later `EnvironmentFile=` beats an earlier one. (`PEER_DISCOVERY_ENDPOINTS` is the deliberate exception — it is an operator-set peering choice rather than a derived anchor, so it does round-trip, and un-peering means clearing it there.)

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
to `vessel-ctl`) is the issuance surface — it ships in the image, so the whole
flow is one command with no credentials beyond a running substrate:

> **Naming the instance.** Every management command runs against a container you
> name, so the instance is part of the command and cannot be defaulted wrongly:
> `docker exec <container> …`. There is no separate selector variable to forget.
> On a host running more than one substrate, the name you type is the fleet you
> get. A second fleet on one host is set up by [README § Installation](../README.md#installation), sequence E.

```bash
docker exec <container> substrate-key show                 # print the operator API key (what substrate-connect emits)
docker exec <container> substrate-key whoami                   # operator identity: org, user, scopes
docker exec <container> substrate-key issue my-peer   # mint a new API key (external peer / spoke / new vessel)
docker exec <container> substrate-key issue ci-bot read 30   # <name> [scopes] [expires_days]
docker exec <container> substrate-key jwt admin     # mint a Bearer JWT (dashboard / admin endpoints)
docker exec <container> substrate-key list
docker exec <container> substrate-key revoke key_xxx
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

- **`docker exec <container> substrate-key issue <name>` (and its `whoami` / `list` /
  `revoke` / `jwt` siblings)** — for a substrate you have **shell on**.
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

## Managing a running fleet: `vessel-ctl`

**`vessel-ctl` is the vessel management surface, and there is no second one.** It
ships in the image, so it works wherever the substrate runs — a laptop, a hub, a
spoke reached over ssh — with no checkout and no host tooling. The launch
manifest (and `make up`, which wraps it) is the *bootstrap* tier only: the
things that must happen before a container exists to be talked to.

Every verb works on **any** unit the fleet has, baked or manifest, and names its
instance in the command:

```bash
docker exec <container> vessel-ctl status              # the fleet: state, enabled, restarts
docker exec <container> vessel-ctl status <vessel>     # one unit
docker exec <container> vessel-ctl restart <vessel>
docker exec <container> vessel-ctl start <vessel>      # after stop (NOT after a mask — see below)
docker exec <container> vessel-ctl stop <vessel>
docker exec <container> vessel-ctl logs <vessel> -n 100
docker exec <container> vessel-ctl sync <vessel>       # clone -> live runtime + restart
docker exec <container> vessel-ctl install <vessel>    # manifest vessels
docker exec <container> vessel-ctl uninstall <vessel>
docker exec <container> vessel-ctl list                # installable manifest vessels
docker exec <container> vessel-ctl drift               # inventory vs image vs running
docker exec <container> vessel-ctl apply               # re-apply the selection NOW
```

`status` always prints `restarts=` next to the state, because a unit in a
`Restart=` loop reports `activating` forever and **never** `failed` — it is
invisible to any states-only listing, and a climbing count is the cheap tell.

> **Installed membership is durable across container recreation.** A rendered
> unit lives in `/etc/systemd/system` — container filesystem, not a volume — so
> on its own it would vanish with the container while the manifest and sources
> (volumes) survived. `vessel-ctl install`/`uninstall` therefore record the
> desired membership in `/workspace/substrate/fleet/installed.json` (volume),
> and the entrypoint re-installs any recorded member whose unit file is missing
> on every boot. `DISABLED_VESSELS` outranks the record. Two consequences:
> a recreate on the same volumes brings installed dynamic vessels back without
> operator hands, and an `uninstall` is only durable because it *removes* the
> record — deleting the unit file alone would be undone at the next boot.
> An install into an absent workdir **refuses** (`ok:false`) instead of writing
> a unit that cannot start; the reply also carries `post_install: ok|failed`
> rather than swallowing the hook's exit status.

> **Most of the `disabled` rows are expected.** On a default fleet roughly half
> the units read `disabled`, and every one of them is the `.service` half of a
> timer pair: the `.timer` is enabled and pulls the service when it fires, which
> is ordinary systemd and not a selection problem. Separate the expected from a
> real outage by asking whether a sibling timer exists:
>
> ```bash
> # `vessel-ctl status` now lists TIMERS as well as services, with a `next=`
> # column, so the quickest check is simply to read it:
> docker exec <container> vessel-ctl status | grep -E 'NEVER|failed'
>
> # What that column means, because "no next elapse" has TWO causes:
> #   next=NEVER …            enabled, nothing running, no schedule -> a real fault
> #   next=waiting (…)        an OnUnitActiveSec timer whose service is mid-run.
> #                           It re-arms when the run finishes. NOT a fault, and
> #                           reading only NextElapseUSecRealtime reports every
> #                           monotonic timer this way — the rhythm timers are all
> #                           monotonic, so that check flags a healthy fleet.
> # A service disabled with no timer at all is the other case worth finding:
> docker exec <container> vessel-ctl status | awk '$3=="disabled" && $1 ~ /\.service$/ {print $1}' | while read u; do
>   docker exec <container> systemctl cat "${u%.service}.timer" >/dev/null 2>&1 || echo "no timer: $u"
> done
> A unit named `no timer:` is disabled with nothing to start it. One named
> `dead timer:` has a schedule that will never fire — usually the residue of a
> mask/unmask cycle, and cleared by restarting the container.

### `drift` and `apply`

Vessel selection is read at boot by `apply-inventory`, so a corrected inventory
that `substrate-pull-sync` has already converged into the volume **sits inert**
until something applies it. That is why a fleet can hold the right inventory and
go on running the wrong unit set indefinitely.

`drift` reports the gap — the volume inventory against the image default, the
selection in force, and what applying it now would change. `apply` closes it
against a running fleet, with no container restart: it re-runs the selection and
the LLM-arm pass, then starts and stops units to match.

```bash
docker exec <container> vessel-ctl drift    # is this fleet running what it should?
docker exec <container> vessel-ctl apply    # make it so
```

> ⚠ **`drift`'s "absent from the inventory — ungoverned" warning over-reports.**
> Its baseline excludes `manifest: true` entries, so every *installed* manifest
> vessel is named as though it were a packaging omission. On a fleet with the
> human surface installed, `human-surface-vessel.service` is reported despite
> being in the inventory (role `ui`, `manifest: true`). Confirm each name before
> acting on it — `jq -r '.vessels[] | select(.unit=="<unit>")'` against the
> inventory settles it.

`drift` is **read-only** and safe to run at any time. It prints three sections —
the volume inventory against the image default, the selection currently in force,
and what applying that selection would change. A `DRY-RUN would disable:` or
`would unmask:` line names a unit whose running state has drifted from the
selection; no such lines means the fleet already matches.

> ⚠ **`drift` previews the symlink half of `apply`, not the whole of it.** The
> dry run lives in `apply-inventory`, which manipulates enable and mask
> symlinks. `apply`'s second half — the loop that stops masked units and starts
> newly-included ones — has no dry-run counterpart, so `drift` will never print
> a "would start" or "would stop" line no matter how far the running state has
> drifted. Read a clean `drift` as "the selection is already applied", never as
> "`apply` would do nothing".

`apply` is **idempotent**: running it on a converged fleet re-reads everything and
changes nothing. It reports each action it takes (`stopped <unit> (masked by this
selection)`, `started <unit> (enabled by this selection)`), so an apply that
prints no action lines is a genuine no-op rather than a silent failure.

Units whose healthy resting state is `inactive` are left alone: completed
seeders, and anything systemd skipped via `ExecCondition` (an LLM arm with no
provider key, the desktop units on a base image). `apply` asks systemd what it
decided and reads the inventory role rather than treating "inactive" as "should
be started".

> **On an image older than this behaviour**, a converged default fleet prints
> seven `started` lines on every run — the three seeders, `llm-google`, and the
> three desktop units — each going back to `inactive` seconds later. They are
> not drift. `substrate-pull-sync` converges `vessel-ctl` from git, and the new
> copy governs the next `docker exec` with no restart.

It
converges the *running* state, not just the enable symlinks — a unit the new
selection excludes is stopped, and one it now includes is started. Timer-driven
units are deliberately left for their timer rather than started immediately.

Confirm with `vessel-ctl status`, and note that the container's `RestartCount`
stays where it was: nothing here restarts the container.

> A unit the selection has **masked** cannot be started or restarted — systemd
> refuses, and `vessel-ctl` says so rather than reporting a success that did not
> happen. `start` will not rescue it either. The only way back is to change the
> selection and `apply`.

### Recovering a fleet you masked

Applying a narrower selection to a running fleet masks whatever it excludes, and
the masks are on-disk state that outlives the selection that created them. To
get those units back, apply a selection that *wants* them:

```bash
docker exec -e ENABLED_ROLES=full <container> vessel-ctl apply   # widen, then converge
docker exec <container> vessel-ctl apply                         # or: default = every baked unit
docker restart <container>                                       # required — see below
```

> **The restart is not optional.** Services come back, but the timers do not:
> after a mask/unmask cycle a measured 15 timers were left `ActiveState=failed`
> with `Unit to trigger vanished`, enabled but with no next elapse. Nothing in
> the ordinary triage surface sees this — `drift` reports `identical`, `apply`
> prints no actions. `substrate-ready`
> catches it (non-zero exit); a container restart clears it.

**The selection is injected through `docker exec -e`, and it outranks the env
file.** `apply` and `drift` source `/etc/substrate/env` so `apply-inventory` sees
what the boot saw, then re-export any of `PROFILE`, `ENABLED_VESSELS`,
`ENABLED_ROLES`, `ENABLED_EXTRA_VESSELS` and `DISABLED_VESSELS` you supplied, so
the injection wins over the file's own line. With nothing injected the file wins,
because there is nothing to re-export. `drift` prints an `OVERRIDDEN for this
run` line whenever an injected value differs from the file, so the selection it
reports is always the one it would apply.

The injection lasts only for that command. Recreating the container is the way to
change the selection permanently.

The bare `apply` above is the default topology, and it now clears masks. It did
not always: the no-selection branch returned early on the reasoning that "want
everything" needs no work, so the one selection that should have been able to
restore anything was the only one that could not. Measured before the fix: 58
units masked, 9 core vessels dead, `{"ok":true}` returned, and `drift` reporting
a clean all-clear at that same moment.

### Where the selection and the inventory actually live

```bash
docker exec <container> cat /workspace/substrate/fleet/vessels.inventory.json   # authoritative
docker exec <container> cat /usr/local/share/substrate/vessels.inventory.json   # image default
docker exec <container> grep -E '^(PROFILE|ENABLED_ROLES|ENABLED_VESSELS|DISABLED_VESSELS)=' /etc/substrate/env
```

The volume copy is what the fleet obeys; the image copy is the build default.
`drift` compares them for you, but when you need to read or edit one, those are
the paths.

> Both boot and `apply` call the same `apply-llm-arms` for the rendered arms.
> One copy on purpose: the arm-selection logic lived only in the entrypoint, and
> that is exactly why changing which arms run used to require a restart.

`deregister` is the fifth vessel verb: it removes a vessel from discovery without
touching its unit, for taking a vessel out of rotation while leaving it running.

### The tools that ship in the image

Everything below is on `PATH` inside the container, so `docker exec <container> …`
reaches it on any host, with no checkout:

| Tool | What it is for |
|---|---|
| `vessel-ctl` | the vessel surface — status, restart, logs, sync, install, uninstall, deregister, list, apply, drift |
| `substrate-doctor` | correctness check: auth, registry, failed units, whether an LLM arm can actually complete |
| `substrate-ready` | readiness matrix — per-unit `ok` / `down` / `masked` / `skipped`, and the "not ready" count. `masked` is reported separately and **named**, because a mask is on-disk state a previous selection left behind: on a spoke it is the design, on a standalone a masked *core* unit is counted `down`. `skipped` still means "systemd deliberately did not run this" (`ConditionResult=no`) and is not a fault. |
| `substrate-key` | key and token surface — `show`, `whoami`, `issue`, `list`, `revoke`, `jwt` |
| `substrate-config` | **where each resolved value came from** — operator env, a prior boot's persisted secret, minted this boot, or a literal |
| `gen-env` | rewrites `/etc/substrate/env` from the container environment (runs at boot; re-runnable) |
| `apply-inventory` | applies the vessel selection (runs at boot; `vessel-ctl apply` is the runtime entry point) |
| `apply-llm-arms` | renders and enables the LLM arms for the current selection |
| `substrate-pull-sync` | converges `/vessels` and the fleet files from git. **Exits non-zero when any repo failed to converge**, which leaves the unit `failed` until you clear it — see below. It also converges the fleet TOOLING (`vessel-ctl`, `apply-inventory`, and itself) from `origin/dev`, so an image built from an unpushed tree loses those local changes within one tick (a `skipped` repo — unreachable remote, no PAT — is an environment condition and does not fail the run). Read the `done — synced=N skipped=N failed=N` line: a `failed` count that never clears is a permanent build break, not a transient. |
| `reseed-restart` | re-runs identity seeding |

**A failed oneshot stays failed.** `substrate-pull-sync` is `Type=oneshot`, so a
non-zero exit leaves `substrate-pull-sync.service` in `ActiveState=failed`
permanently — and `substrate-ready` counts a failed unit as `down`, so the fleet
reports NOT ready indefinitely while `--quick` (and therefore `docker ps`) stays
green. That is accurate the first time and useless by the tenth: a persistent
build failure in one vessel latches the whole readiness signal.

```bash
docker exec <container> systemctl --failed --no-legend          # what is latched
docker exec <container> journalctl -u substrate-pull-sync -n 30 # why (read failed=N)
docker exec <container> systemctl reset-failed substrate-pull-sync.service
```

`reset-failed` clears the latch; it does not fix the cause, and the next tick
re-latches if the failure persists. Fix the failing repo — the point of the
non-zero exit is that a converger which cannot converge should not report
success, not that you should silence it.

`substrate-config` is the one to reach for when a value is not what you set:

```bash
docker exec <container> substrate-config          # every value + its provenance
docker exec <container> substrate-config LLM      # filter
```

A value marked `persisted` came from a **previous** boot and is still in force —
which is why an operator's freshly-supplied key can appear not to take.

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

`docker exec <container> vessel-ctl sync <vessel>` pulls the vessel's
in-container clone, mirrors it into the live runtime and restarts the unit. This
is a **deliberate, single-machine** path, sanctioned for seeing an exceptional
manual edit run before it is committed — it acts on one container on one daemon
and reaches no other substrate, so it is a local convenience, never the way a
change is delivered.

```bash
docker exec <container> vessel-ctl restart development-vessel
curl http://localhost:18090/health
```

> **`vessel-ctl sync <vessel>` does not read your working tree.** It runs
> `git pull --ff-only origin dev` inside the container's *own* clone of the
> vessel, mirrors the result into `/vessels`, and restarts the unit — so it can
> never overwrite a commit the substrate landed and your tree lacks. It is the
> safe refresh, and there is no separate "in-container ff-only pull" to prefer
> over it.
>
> The clobber hazard belongs to `docker cp` (below), whose source *is* your
> working tree. Use that only when you know the host tree is the newer one, and
> compare against the container copy first. Note also that a `docker cp` is
> erased by the next `substrate-pull-sync`, which is the correct behaviour: git
> is the channel, and anything not in git is not a change the fleet can keep.

`vessel-ctl restart` works on **any** unit the fleet has — there is no list
of blessed vessels. `docker exec <container> vessel-ctl status` shows what
is there to act on.

The core vessels — `activity-api`, `identity-vessel`, `discovery-vessel`,
`surrealdb` — have **no** make restart target. Push reaches them like every
other vessel. For the same deliberate single-machine hatch, copy source in and
restart the unit directly (or rebuild for a clean deploy) — with the same
clobber caveat, since the copy source is again your working tree:

```bash
docker cp repos/activity-api/src substrate-live:/vessels/activity-api/
docker exec substrate-live systemctl restart activity-api
```

### How long an in-container edit lasts — three classes, one appearance

Every hot patch looks identical while the container runs. They do not survive the
same events, and the failure mode is silent: the original defect returns with no
message, so a fix verified an hour ago is simply gone.

| Path | Survives `restart` | Survives `stop`+`up` | Survives `recreate` |
|---|---|---|---|
| `/workspace/**`, `/var/lib/surrealdb/**` | yes | yes | **yes** — named volumes |
| `/vessels/**`, `/usr/local/bin/**` | yes | yes | **no** — container writable layer |
| `/usr/lib/systemd/system/**` | **no** | **no** | no — re-copied from the image each boot |

Measured: three unit files were given `ExecCondition` guards and verified through
real systemd (`inactive`, `restarts=0`); after one stop and start of the
container the guards were gone and the crash-loop had resumed at `restarts=8`,
while `/vessels` and `/usr/local/bin` patches from the same session were still in
place. Only the two named volumes appear in `docker inspect --format
'{{range .Mounts}}…'` — everything else is the image plus a writable layer.

**A unit-file change is therefore never a hot patch; it is an image change.** Edit
`scripts/substrate/units/`, commit, and let CI rebuild — then verify against the
published image rather than the running container.

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
docker exec <container> vessel-ctl status

# Aggregate fleet health (host-mapped HTTP probes)
docker exec <container> substrate-doctor

# Follow a vessel's logs
docker exec <container> vessel-ctl logs activity-api

# Shell into the container
docker exec -it <container> bash
```

**There are no `logs-*` make targets.** Read any unit's journal directly. This
works for every unit, including the timer-driven ticks, the rendered LLM arms,
identity and discovery — and `docker exec <container> vessel-ctl logs <vessel>`
does the same thing by vessel name:

```bash
docker exec substrate-live journalctl -u <unit>.service -n 100 --no-pager
docker exec substrate-live journalctl -fu <unit>.service        # follow
```

## Backing up and restoring learning state

All learning state lives in the two named volumes (`<name>-workspace` at `/workspace`,
`<name>-surreal` at `/var/lib/surrealdb`); the container holds none. The backup and
restore procedure (stop through the manifest so the drain and the datastore flush
complete, then archive both volumes) is in
[README § Installation → Usage patterns](../README.md#usage-patterns).

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

| Variable | Meaning | Effective value |
|---|---|---|
| `TRACE_STORE_CAP` | row count above which the store is flagged for reconciliation | **`150000`** |
| `TRACE_STORE_HOT_WINDOW_DAYS` | recency window kept in full | `3` |
| `TRACE_STORE_RESERVOIR_PER_ACTIVITY` | stratified sample kept per activity outside the hot window | `25` |

> **These are what `gen-env` pins, not what the code falls back to.** The column
> used to carry activity-api's in-code defaults — `TRACE_STORE_CAP` `50000` — and
> no fleet has ever run that number, because `gen-env` writes `150000` into
> `/etc/substrate/env` on every boot and the code default only applies when the
> variable is absent. Documenting a fallback that is always shadowed reads as
> current configuration and is off by 3×. Confirm on the fleet you actually have:
>
> ```bash
> docker exec <container> grep -E '^TRACE_STORE_' /etc/substrate/env
> ```
>
> They are also among the values `gen-env` writes as fixed literals, so passing
> `-e TRACE_STORE_CAP=…` does not change them — `gen-env` now says so on stderr
> when it discards a supplied value.

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

Harnesses and clients read the target substrate from the client configuration file,
`~/.metabob/config.json` (override: `METABOB_CONFIG_PATH`; a project-local
`.metabob/config.json` shadows it). The image emits that file for the fleet it runs in
(`substrate-connect`, see [README § Installation](../README.md#installation)), with the
endpoint computed from the fleet's own port prefix, so a second fleet on the same host gets
its own endpoint without hand-editing. To point a client at another substrate, emit the
configuration from that fleet instead. No code change is needed; nothing hardcodes an
endpoint.

## How a fleet converges

The same image runs anywhere, and runtime state always lives in the two named volumes, which
survive recreate and upgrade. Every substrate converges itself: `substrate-pull-sync.timer`
runs in-container on each box and pulls `origin/dev` into that container's own clones. A
fleet converges because each member pulls, not because a host pushes to all of them. See
[Self-sync](#self-sync-git-remotes-are-the-only-code-channel).

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

Federation concepts (hub vs. peers, the relay, firewall ports) live in [`docs/FEDERATION.md`](FEDERATION.md).

## Dynamic vessels (the canonical attach path)

Beyond the baked-in core, `vessels.manifest.json` declares **runtime-installable** vessels. The fleet definition files live ON THE VOLUME at `/workspace/substrate/fleet/` (seeded from image defaults at first boot, substrate-writable — the substrate can alter its own membership); readiness, doctor, self-recovery, pull-sync and vessel-ctl all read the volume copies.

`vessel-ctl` ships **in the image** (`/usr/local/bin/vessel-ctl`) and is fully self-contained: `install` clones the vessel's repo into `/workspace/git/vessels/<name>` on demand, mirrors it into the live `/vessels` runtime, renders the unit via the shared `render-unit` template, and enables it — no host checkout, no docker-cp from a host workspace. Rendered units carry an `ExecStopPost` discovery-deregister so any clean stop leaves the registry immediately (crash death falls back to the 5-min TTL). Self-recovery membership is **derived** from the fleet files at read time — install/uninstall no longer mutates any script.

```bash
docker exec <container> vessel-ctl list                            # installable vessels
docker exec <container> vessel-ctl install metric-collector-vessel
docker exec <container> vessel-ctl sync    metric-collector-vessel
docker exec <container> vessel-ctl uninstall metric-collector-vessel
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

The topology-discovery loop runs autonomously inside the substrate. The boredom-vessel is a dispatch-pool daemon: each selection pass scores a pool of candidate templates on learned momentum, input-shape availability, and priority-weight folds derived from current conditions, then dispatches winners concurrently up to a slot cap. Selection momentum persists across restarts, so learned preferences survive cutovers.

**Expect two maintenance planes, not one, and expect most self-maintenance to sit in the second.** This paragraph once claimed that measurement, probing, health, escalation, coverage and gap-closing work all enter through the pool, with no fixed rotation. Treat that as the goal rather than the state: a large share of recurring self-maintenance runs from fixed-interval unit timers instead, and those units are largely absent from pool selection.

The difference is not bookkeeping. **The pool grades what it selects and debits what keeps failing, so a repeatedly-futile task stops being chosen; a timer fires on schedule forever regardless of outcome.** Work in the timer plane accrues no posterior, so it cannot be learned away, and a task that is provably accomplishing nothing will keep running at full cadence. When something is repairing nothing over and over, check which plane it is in before looking for a subtler cause.

The law on pace expects scoring to be driven by time-shaped rhythm impulses the selector reads from the pool. Expect that to be **partially** true, and check both halves separately, because they fail independently: a selector may well consume rhythm impulses and fold their due-state into its priority weighting, while the dispatch half — the conductor that should enqueue what is due — scores families and enqueues nothing. Priority influence without cadence governance is the likely state, and it is easy to misread in either direction. Assuming no rhythm mechanism exists leads to rebuilding one that does; assuming cadence is rhythm-driven leads to trusting a schedule that is still frozen at process start, invisible to traces and ungradable.

Verify the tags, template names, intervals and unit membership in force against the running registry and the unit files; do not take them from this document.

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

**Units not starting within 60s**: read the failing unit's journal — `docker exec substrate-live journalctl -u <unit>.service -n 100 --no-pager`. Most common cause: a host-port conflict on one of the published ports (e.g. another process already on `18270`) — the launch aborts with "Bind for 0.0.0.0:18270 failed: port is already allocated". A second fleet on the same host takes its own port prefix (README § Installation, sequence E).

**API key needed but lost**: if you ran `seed-identity.ts` but forgot the key, re-read it from the container env file: `docker exec substrate-live grep METABOB_API_KEY /etc/substrate/env`. Then re-emit the client configuration with `substrate-connect` (README § Installation).

**A key that reads fine and 401s everywhere**: `substrate-key show` prints whatever is in `/etc/substrate/env` and does not check it, so before `identity-seeder` completes it returns a pre-seed placeholder with no error. The value is short and lacks the `mb-<base64>-<hex>` shape of a real key (~160 chars). Confirm with `docker exec <container> substrate-key whoami`, which reports the org and scopes for a valid key and fails for an invalid one, or with `substrate-doctor`'s key check. A fresh fleet takes a few minutes to converge; a doctor run before then reports failures that clear themselves.

**`substrate-doctor` reports `failed units: bootstrap-seeder.service`**: the seeder registers the shared activity templates and exits non-zero if *any* template is rejected, so one bad template exhausts its restart budget and leaves systemd `degraded`. See which failed with `docker exec <container> journalctl -u bootstrap-seeder | grep '✗'`. A rejection reading `the composition declares a precondition it produces itself` is a defect in that seed template, not in your deployment: the rest of the fleet is usable and those specific activities are absent. Re-run after a fix with `docker exec <container> systemctl start bootstrap-seeder`.

**Harness connection errors**: confirm the client configuration (`~/.metabob/config.json`, or the file `METABOB_CONFIG_PATH` names) points at the fleet you mean, and that no project-local `.metabob/config.json` shadows it. Re-emit it with `substrate-connect` to reset.

**`vessel-ctl restart <vessel>` fails**: the container must be running (see README § Installation). Units restart in-place; the container itself is not restarted. An unknown vessel is refused by name rather than reported as a success — run `vessel-ctl status` to see the units this fleet actually has. Every unit is restartable, including activity-api, identity-vessel, discovery-vessel and surrealdb.

**Tooling connects to the wrong substrate**: client tooling reads its target from the client configuration file, which `substrate-connect` emits for the fleet it runs in. Inside the container, each systemd unit reads its endpoints from `/etc/substrate/env` — the load-bearing variables are `METABOB_API_KEY`, `ACTIVITY_API_ENDPOINT=http://127.0.0.1:8080`, and `IDENTITY_ENDPOINT=http://127.0.0.1:8101`. If you rebuilt the container without pulling the latest gen-env.sh, run `docker exec <container> gen-env` to regenerate the env file (the tool ships on PATH in the image; there is no /scripts/substrate path inside a container).
