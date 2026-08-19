# Substrate bring-up: three paths

An operator runbook for standing up a substrate three ways: a UI-only surface spoke
onto an existing network (Path A), a compute spoke onto an existing network (Path B),
and a new network with the full fleet from zero (Path C). Then key issuance, the auth
check ladder, the silent-failure table, and what would actually fail on this machine today.

Every command block is copy-pasteable. Every behavioural claim carries a `file:line`.
Where a comment in the tree disagrees with the code, the code's behaviour is stated and
the stale comment is named. Anything not read out of a file is marked **UNVERIFIED**.

Paths in this document are absolute. `SUB=/home/avi/documents/work/substrate`.

---

## 0. Prerequisites common to all three

### 0.1 Host toolchain

```bash
for c in docker make git bun jq curl; do command -v "$c" >/dev/null || echo "MISSING $c"; done
docker info >/dev/null && echo "docker ok"
```

- `jq` and `curl` are hard requirements of `substrate-ready.sh` (`scripts/substrate/substrate-ready.sh:66` — exits 2 without jq) and of `substrate-doctor.sh`.
- `bun` runs **on the host** during `make build` → `validate-build` (`scripts/substrate/Makefile:241-242`). Without bun you cannot build an image; you can only reuse one that already exists.
- `docker` must be able to run `--privileged` containers — systemd is PID 1 inside (`docs/SUBSTRATE.md:92`).
- `ui-only-up.sh` needs host `jq` for a non-obvious reason: `cfg()` returns empty silently when jq is absent (`scripts/substrate/ui-only-up.sh:144-148`), so `--hub`/`--api-key`/`--git-pat` never fill from config and the script dies reporting *missing config* rather than *missing tool*.
- **`ss` is NOT installed inside the substrate image.** Any in-container `ss -ltnp` diagnostic returns nothing and its `|| echo` fallback fires unconditionally. The image's apt list is systemd, systemd-sysv, dbus, curl, ca-certificates, unzip, git, jq, redis-server (`Dockerfile.substrate:25-35`) — no iproute2. Use `systemctl show <unit> -p Environment` plus an in-container `curl` instead (see §6).

### 0.2 Git hooks and submodules

```bash
cd "$SUB"
scripts/git-hooks/install.sh            # or verify: git config core.hooksPath
git submodule status                    # TRIAGE any line prefixed '+' BEFORE the next command
git submodule update --init --recursive
```

- The root-level-directory guard in `scripts/git-hooks/pre-commit` (`ALLOWED_TOPLEVEL_DIRS`, line 72) **only enforces once installed**. A fresh clone that skips `install.sh` can commit root additions the tree forbids. None of the three paths' shipped instructions mention this.
- **`git submodule update --init` silently rewinds submodules that are ahead of their gitlink with a *clean* worktree.** It aborts only on a *dirty* worktree. On this tree three submodules are currently `+` with clean worktrees (`repos/development-vessel`, `repos/goal-host-vessel`, `repos/llm-resolver-vessel`) — running the command as written discards those advances with no warning. Push or branch them first.
- Submodules are a hard build precondition: `make build` runs `preflight-submodules`, which fails in <1s when `repos/discovery-vessel/package.json` is absent (`scripts/substrate/Makefile:230-236`). The Dockerfile's `COPY repos/` instructions start at `Dockerfile.substrate:73`.

### 0.3 Client config

```bash
jq -c '{endpoint: .metabob.endpoint,
        hubDiscovery: (.metabob.hubDiscovery // "(absent)"),
        gitPat:       (.metabob.gitPat // "(absent)"),
        keylen:       (.metabob.apiKey | length)}' ~/.metabob/config.json
```

- `~/.metabob/config.json` needs `metabob.endpoint` and a valid `metabob.apiKey`; all tooling reads it and nothing hardcodes an endpoint.
- **Nothing in this tree ever writes `.metabob.hubDiscovery` or `.metabob.gitPat`.** `configure-local.sh:76-77` writes `endpoint` as `http://localhost:18080` — the *local activity-api*, not a hub discovery endpoint. `ui-only-up.sh` falls back to `.metabob.endpoint` for `--hub` (`ui-only-up.sh:150-158,166-169`), and that URL passes its `http://` validation. Always pass `--hub` explicitly.
- **On a spoke, `configure-local.sh`'s value is dead**, because a spoke masks `activity-api` (role `api`). See §7.

### 0.4 Git PAT

```bash
gh auth token >/dev/null 2>&1 && echo 'gh token available' \
  || jq -r '.metabob.gitPat // "(absent)"' ~/.metabob/config.json
```

- `setup-git-push.sh` arms the git credential helper **only when `SUBSTRATE_GIT_PAT` is non-empty** — `GITHUB_TOKEN` alone does not (`scripts/substrate/setup-git-push.sh:79,87,106-107`). Without the helper the private super-repo clone 401s and the baked seed at `/usr/local/share/substrate/super-repo` is used instead (`setup-git-push.sh:167-173`), which `Dockerfile.substrate:269` populates with **`scripts/substrate` only — no `repos/`**.
- Consequence per path: **Path A is credential-mandatory** (the surface's workdir lives under `repos/`). **Path B is not** — the federation transport's workdir is `scripts/substrate/federation-relay`, which `Dockerfile.substrate:263-279` bakes. **Path C** needs it only for self-development push, not for boot (`setup-git-push.sh` fails open).

### 0.5 Image

```bash
docker image inspect ghcr.io/avigopal/substrate:dev >/dev/null 2>&1 && echo present || echo missing
# rebuild deliberately (needs host bun):
docker build -f Dockerfile.substrate --target base -t ghcr.io/avigopal/substrate:dev .
```

- **`make up` builds only when the image is MISSING** (`Makefile:346`). A stale `:dev` is silently reused. `REBUILD=1` forces (`Makefile:347`).
- **`--target base` is load-bearing.** Without it docker builds the last stage (`substrate-obsidian`) and `:dev` silently becomes the obsidian image (`Makefile:244-245`).

### 0.6 Ports and container names

```bash
ss -ltn | awk 'NR>1{n=$4; sub(/.*[:.]/,"",n); if (n+0>=18000 && n+0<=23000) print n}' | sort -un | tr '\n' ' '; echo
docker ps -a --format '{{.Names}}'
```

Nine ports per substrate: `18080 18090 18100 18101 18210 18250 18260 18270 18310`, each plus `--port-offset` / `PORT_OFFSET` (`Makefile:477-485`; `ui-only-up.sh:83`). `PORT_OFFSET` shifts the **host side only** — the container side is always the `8xxx` anchor (`Makefile:186-187`, `hp` macro).

`docker run` fails on the **first** conflicting `-p` and leaves a created-but-dead container that then blocks every retry on the name check. `ui-only-up.sh:397-416` refuses up front instead — but only when `ss` is present on the **host**, and never under `DRY_RUN=1`.

### 0.7 Datastore volume hygiene

```bash
docker volume ls --filter name=substrate- --format '{{.Name}}'
docker exec substrate-live df -Pm /var/lib/surrealdb | awk 'NR==2{print $4" MB free"}'
```

- A reused `substrate-surreal` volume with a freshly generated `SURREAL_PASS` can never authenticate (SurrealDB ignores `--pass` once a root user exists) — warning only, then every DB call fails.
- An existing datastore with **no persisted `API_KEY_SECRET`** makes `gen-env` **fail closed** and exit 1 (`gen-env.sh:119-141`); opt back in with `ALLOW_INSECURE_API_KEY_SECRET=1`, knowing every key becomes forgeable.
- Below ~2GB free, SurrealDB times out on writes with no restart and no alarm; doctor check 1b fails under 2048MB and warns under 8192MB, **on free space, not percentage** (`substrate-doctor.sh:45-72`).

> **Correction to the traces:** `/workspace/.substrate-secrets` is **no longer** written with a truncating heredoc. `gen-env.sh:587` writes to a `mktemp`, `:618-646` merges every key the old file carries that this revision does not emit (logging `carried over unrecognised persisted secret:`), copies the old file to `.substrate-secrets.prev`, and installs with `mv -f`. **The inline comment at `gen-env.sh:599` — "this heredoc OVERWRITES the file" — is stale relative to the merge block 20 lines below it.** `secrets.env.sh:66-91` merges likewise. The 2026-08-08 un-restartable-hub incident is history, not a standing hazard.

---

## 1. Path A — UI container onto an existing network

A UI-only federated spoke: a trimmed fleet (10 units) plus the human surface, joined to an
existing hub, with no local identity, no local trace store, and no LLM arms.

### A.1 Rehearse

```bash
DRY_RUN=1 /home/avi/documents/work/substrate/scripts/substrate/ui-only-up.sh \
  --hub http://<hub-host>:18100 \
  --api-key <hub-issued-key>
```

Parses flags, fills blanks from `~/.metabob/config.json` and `gh auth token`, validates that
`--hub` is an `http(s)` URL and `--port-offset` is a non-negative integer, refuses if hub or
key is still empty, exits 1 with a full causal chain if no git PAT. Then prints the PLAN and
runs `make -n -C scripts/substrate run-live <MAKE_VARS>` through `redact()`, expanding the whole
`docker run` without executing it (`ui-only-up.sh:122-192,325-378`).

**The dry run exits 0 BEFORE any preflight** (`ui-only-up.sh:374-378`) — no docker check, no
name check, no port-collision check, no image-manifest check.

> `redact()` has a name rule on `-e *KEY|TOKEN|PAT|SECRET*=` and a value-shape rule on
> `sk-ant-/sk-proj-/sk-/gho_/ghp_/ghu_/ghs_/github_pat_`. A credential under an unmatched
> name **and** an unrecognised prefix prints in clear. Do not paste dry-run output unread.

### A.2 Run

```bash
/home/avi/documents/work/substrate/scripts/substrate/ui-only-up.sh \
  --hub http://<hub-host>:18100 \
  --api-key <hub-issued-key> \
  --name substrate-ui \
  --port-offset 0
```

Defaults: `--name substrate-ui`, `--port-offset 0` (surface on host 18310) (`ui-only-up.sh:71-84`).

**Always pass `--hub` and `--api-key` explicitly.** With no flags, `--hub` falls back to
`.metabob.endpoint`, which is an activity-api URL, not a discovery URL — it passes validation
and fails only at assert 9, after a full ~5-minute boot.

> **Correction:** the traces attribute that no-flags failure partly to "a locally minted key
> the real hub rejects". On this machine the config key **is hub-issued and validates true at
> the hub** (verified: `{"valid":true,"org_id":"organizations:substrate","key_id":"key_<redacted>"}`).
> The cause is the **endpoint**, not the credential.

### A.3 What the script then does (all automatic)

**Preflight** (`ui-only-up.sh:380-454`), in order: `command -v docker`; refuse if a container
named `$NAME` exists (it will never stop, recreate, or reconfigure a running substrate);
port-collision check against all nine published ports (skipped with a WARNING if host `ss` is
absent); image check — missing → "make up will build it", present but its baked
`/usr/local/share/substrate/vessels.manifest.json` has no `human-surface-vessel` → exit 1 with
the `docker build --target base` remedy. Finally a non-fatal WARNING if `${NAME}-workspace` exists.

> The image check reads the **image** manifest; `vessel-ctl` at A.3-step-5 reads the **volume**
> copy first (`vessel-ctl.sh:41-43`), and `entrypoint.sh:13-20` seeds the volume only when absent.
> A surviving volume pins a manifest this preflight cannot see.

**Boot** (`ui-only-up.sh:456-485`) — `make up` with an explicit 10-unit `ENABLED_VESSELS`:

```
surrealdb.service, valkey.service, discovery-vessel.service, git-push-setup.service,
substrate-ready.service, journald-stdout-forwarder.service,
self-recovery.timer, self-recovery.service,
substrate-pull-sync.timer, substrate-pull-sync.service
```

Because `DISCOVERY_ENDPOINT` is non-empty and `ENABLED_ROLES` is empty, the Makefile flips into
the federated-spoke branch (`Makefile:166-175`): `ENABLED_ROLES:=spoke`, `HUB_DISCOVERY_URL`,
`ACTIVITY_API_ENDPOINT` (:18080) and `IDENTITY_VESSEL_URL` (:18101) derived from the hub host,
and `CONTAINER_DISCOVERY_ENDPOINT` **blanked** so local vessels register with *this* substrate's
registry. `FEDERATED_SPOKE` non-empty also skips run-live's provider-key guard (`Makefile:179,430`),
which is why blanking every LLM key is safe.

> **Correction:** the shipped list names both halves of each timer pair, but that is now
> belt-and-braces rather than load-bearing. `apply-inventory.sh:95-127` pairs any desired
> `.timer` with its `.service` **after every selection route has built `$DESIRED`** — the
> comment at `:98-103` names the `ENABLED_VESSELS` case explicitly. The backstop's real limits
> are that it only adds units `manageable_units()` returns (inventory-shipped, non-`manifest`)
> and that it runs *before* the `DISABLED_VESSELS` subtraction, so a deliberate mask still wins.

**Assert workdir** — `docker exec $NAME test -d /workspace/git/super-repo/repos/human-surface-vessel`
(`ui-only-up.sh:487-502`). This is safe against the `--no-recurse-submodules` clone only because
`repos/human-surface-vessel` is a **direct tree** in the super-repo, not a submodule.

**HOST drop-in, written BEFORE install** (`ui-only-up.sh:504-522`):

```bash
docker exec substrate-ui mkdir -p /etc/systemd/system/human-surface-vessel.service.d
docker exec substrate-ui sh -c \
  'printf "[Service]\nEnvironment=HOST=0.0.0.0\n" > /etc/systemd/system/human-surface-vessel.service.d/host.conf'
```

Three layers make this correct: the static unit pins `Environment=HOST=127.0.0.1` at
**`scripts/substrate/units/human-surface-vessel.service:10`** but is inert (absent from the
Dockerfile's baked enable list; `manifest: true` so `apply-inventory` never selects or masks it,
`apply-inventory.sh:51`; and `/usr/lib` is outranked by the vessel-ctl-rendered `/etc` unit);
`render-unit.sh:48-51` emits the manifest's env *after* `EnvironmentFile=`; and the drop-in parses
last and wins regardless. Idempotent.

**Install the surface**:

```bash
scripts/substrate/vessel-ctl.sh install human-surface-vessel --container substrate-ui
docker exec substrate-ui systemctl daemon-reload
docker exec substrate-ui systemctl restart human-surface-vessel
```

`post_install` **skips** the UI build when `ui/dist/index.html` already exists, logging
`UI_BUILD_SKIPPED (dist came from git …)`.

> **Stale narration in the script itself:** `ui-only-up.sh:354` (`its post_install builds
> ui/dist — gitignored, so it MUST be built here`) and the assert comment at
> `ui-only-up.sh:556-557` both call `ui/dist` gitignored. **It is TRACKED on purpose** —
> `git ls-files repos/human-surface-vessel/ui/` returns `dist/index.html` plus two hashed
> assets, and `repos/human-surface-vessel/ui/.gitignore` negates the super-repo's blanket
> `dist/`. On a normal PAT clone **the build does not run**. The script's *code* is correct
> (the assert checks existence, not the build); only its narration misleads.

### A.4 Verify

```bash
# the four binding asserts + exit code
scripts/substrate/ui-only-up.sh --hub http://<hub>:18100 --api-key <hub-key>; echo "exit=$?"
```

`OVERALL: PASS` requires all four of: container running / `ui/dist` present / surface answers
`/health` **from the host** / surface shapes present in the **hub's** registry as `*@<FED_ID>`
(`ui-only-up.sh:660-691`). The fifth line — the transport holding a `/p2p-circuit` multiaddr —
is advisory and excluded from `OVERALL`.

```bash
# bind address (the ss-based check does NOT work — see §6)
docker exec substrate-ui systemctl show human-surface-vessel -p Environment
docker exec substrate-ui curl -s -m 5 http://127.0.0.1:8310/health; echo
curl -sf -m 5 http://127.0.0.1:18310/health; echo "host-exit=$?"

# did the UI bundle come from git or a build?
docker exec substrate-ui cat /workspace/human-surface-ui-build.log

# did the container enter the spoke path at all?
docker exec substrate-ui sh -c 'grep -E "^(HUB_DISCOVERY_URL|FED_SUBSTRATE_ID|PEER_DISCOVERY_ENDPOINTS|DISCOVERY_ENDPOINT|ACTIVITY_API_ENDPOINT|IDENTITY_VESSEL_URL)=" /etc/substrate/env'

# did it reach the HUB? (the only assert that proves federation)
FED=$(docker exec substrate-ui sh -c 'grep ^FED_SUBSTRATE_ID= /etc/substrate/env | cut -d= -f2 | tr -d "\""')
curl -s -m 10 -X POST http://<hub>:18100/resolve \
  -H 'Content-Type: application/json' -H "Authorization: ApiKey $KEY" \
  -d '{"pointer":{"type":"vesselRegistry"}}' | jq -r '.content.vessels[]?.vesselId' | grep "@$FED"

# timers genuinely armed, not enabled-and-dead
docker exec substrate-ui systemctl list-timers --all --no-pager
```

Healthy: `HOST=0.0.0.0` in the unit environment; in-container **and** host `/health` both answer;
build log ends `UI_BUILD_SKIPPED` (normal) or `UI_BUILD_OK`; `FED_SUBSTRATE_ID` non-empty;
`DISCOVERY_ENDPOINT` blank/loopback; a hub row matching `/human-surface/` **and** `@$FED`
**and** carrying `uiPanel_write`; both timers showing a real `NEXT`/`LEFT`.

> **`make up` exits non-zero on a healthy UI-only spoke** — `Makefile:372` ends in
> `substrate-doctor.sh` with no `|| true`. `ui-only-up.sh:456-470` downgrades that to a WARNING.
> **But the traces' explanation is half wrong:** on this fleet, doctor check 2 (SurrealDB root
> auth) **passes** — `surrealdb.service` and `valkey.service` are both in `UI_ONLY_VESSELS` —
> and check 4's registry floor drops 5 → 2 whenever `ENABLED_ROLES` or `ENABLED_VESSELS` is set
> (`substrate-doctor.sh` check 4), which a working UI spoke clears with discovery +
> human-surface + federation-transport. **The legitimately-inapplicable checks are 3**
> (seeded key against a local activity-api, masked here) **and 7** (a real paid completion
> against a local LLM arm, of which there is none). A hollow-registry verdict at check 4 is a
> **real fault**, not noise.

---

## 2. Path B — compute spoke onto an existing network

### B.1 Preconditions specific to this path

```bash
# hub /bootstrap must carry a NON-EMPTY relay list — and see the caveat below
curl -s -m 5 http://<hub-host>:18100/bootstrap | jq '.relay_multiaddrs, .identity_endpoint'

# the key must be HUB-issued (run on the hub host)
make -C scripts/substrate issue-key NAME=spoke-<location>

# no name collision
docker ps -a --format '{{.Names}}' | grep -x substrate-live
```

- If `RELAY_MULTIADDR` is unset the transport derives its relay from `<hub>/bootstrap`; with no
  relay it calls `process.exit(1)` (`federation-relay/federation-transport-server.ts:43-61`).
  The manifest sets `restart: always` and `render-unit.sh:56-57` emits `RestartSec=5`, so this is
  a 5-second flap loop, not a clean failure — locally healthy, invisible to the hub.
- **A non-empty `relay_multiaddrs` is NOT sufficient.** Resolve the advertised host and probe it
  (see §7 — today it points at a different, half-decommissioned machine).
- **No local LLM provider key is required.** `FEDERATED_SPOKE` non-empty skips run-live's guard
  (`Makefile:179,430-437`) and `gen-env.sh:31-44` repeats the exemption. Supplying one anyway just
  copies a live secret into another container.
- `make up` **refuses** to start a *stopped* container when launch settings are supplied
  (`Makefile:351-356`); if it is *running* it prints "already running" and your join settings are
  silently ignored. Volumes follow the container name (`Makefile:48-55`).

### B.2 The join

```bash
make -C scripts/substrate up \
  API_KEY=<hub-issued-key> \
  DISCOVERY_ENDPOINT=http://<hub-host>:18100
# optional, for self-development push:
#   SUBSTRATE_GIT_PAT=<pat>
```

That is the whole command. `API_KEY` is the operator alias assigned into `METABOB_API_KEY`
(`Makefile:158-161`). The federated-spoke derivation is `Makefile:166-175`.

### B.3 What happens automatically

1. **`gen-env` writes `/etc/substrate/env`** (`entrypoint.sh:6-7`). It is an **allowlist** — a variable it does not emit reaches no unit, whatever `docker run -e` said. `PROFILE` is not on the list.
2. **`gen-env` independently re-derives the spoke role** (`gen-env.sh:229-256`). On the `make up` path the container receives `DISCOVERY_ENDPOINT=""`, so this branch does not fire; on a raw `docker run -e DISCOVERY_ENDPOINT=http://<hub>:18100` it is the *only* derivation. `FED_SUBSTRATE_ID` / `FED_VESSEL_ID` are minted here (`gen-env.sh:89-93`) and persisted. The critic-guard at `:238-240` classifies an *unreachable* remote hub as a spoke, never a self-promoted root — a hub outage cannot fork identity.
3. **`apply-inventory` masks what this role does not own** (`apply-inventory.sh:129-187`), offline, before systemd is PID 1, via `/etc/systemd/system/<unit> -> /dev/null`. `roles.spoke = [compute, ui, seed, infra, registry]` — so `store` (surrealdb, valkey, concept-db), `control` (identity-vessel), `api` (activity-api) and all `autonomy` timers are masked. It **subtracts** from the image's baked enable list; it never adds a unit that was never packaged, and it never touches `manifest: true` entries (`apply-inventory.sh:51`).
4. **The federation transport installs itself** whenever `HUB_DISCOVERY_URL` is set (`entrypoint.sh:39-49`), hand-writing the `multi-user.target.wants` symlink because `systemctl enable --now` no-ops pre-systemd. This runs *before* `git-push-setup` has materialised `/workspace/git/super-repo`, so an early burst of transport failures in the journal is expected and self-heals via `Restart=always`.
5. **Discovery peers back at the hub** — `gen-env.sh:273-286` defaults `PEER_DISCOVERY_ENDPOINTS` to `HUB_DISCOVERY_URL` with `PEER_FANOUT_MODE=union`. **A baked drop-in overrides this** (see §6).
6. **Readiness (240s, `|| true`) then doctor (no `|| true`)** — `Makefile:361-372`.

### B.4 Verify

```bash
# classified as a spoke, endpoints on the hub
docker exec substrate-live grep -E '^(ENABLED_ROLES|HUB_DISCOVERY_URL|ACTIVITY_API_ENDPOINT|IDENTITY_VESSEL_URL|DISCOVERY_ENDPOINT|FED_SUBSTRATE_ID|PEER_DISCOVERY_ENDPOINTS)=' /etc/substrate/env

# is the hardcoded peer drop-in shadowing your hub?
docker exec substrate-live systemctl show discovery-vessel.service -p Environment | tr ' ' '\n' | grep PEER_DISCOVERY

# transport up and holding a reservation
docker exec substrate-live curl -s -m 5 http://127.0.0.1:8401/health

# THE join criterion: rows in the HUB's namespace
curl -s -m 10 -X POST http://<hub-host>:18100/resolve \
  -H 'Content-Type: application/json' -H "Authorization: ApiKey <hub-issued-key>" \
  -d '{"pointer":{"type":"vesselRegistry"}}' | jq -r '.content.vessels[]?.vesselId' | grep '@<your-fed-substrate-id>'

# which units actually run
docker exec substrate-live systemctl list-units --type=service --state=running --no-legend --plain | awk '{print $1}'

# plan-only rehearsal of unit selection  ⚠ NOT read-only — see §6
docker exec -e DRY_RUN=1 -e ENABLED_ROLES=spoke substrate-live /usr/local/bin/apply-inventory
```

Healthy: `ENABLED_ROLES=spoke`; hub host on 18100/18080/18101; `DISCOVERY_ENDPOINT="http://127.0.0.1:8100"`
(local registry — blanked deliberately); non-empty `FED_SUBSTRATE_ID`; one `<vessel>@<substrate-id>`
row per plain-HTTP local vessel (the mirror is per-vessel, not one blob).

Running services should be: discovery-vessel, goal-host-vessel, development-vessel,
local-tools-vessel, llm-resolver-vessel(+arms), ribosome-vessel, analysis-vessel,
light-dispatch-vessel, relevance-sink-vessel, federation-transport-vessel, plus the `ui` role's
`stateful-ui-vessel` and the obsidian timers. **No surrealdb, valkey, identity-vessel, activity-api.**

> **Correction:** the traces list `human-surface-vessel` in that healthy set. It is **not** there
> and must not be expected. It is `manifest: true`, so `apply-inventory` can neither select nor
> mask it (`apply-inventory.sh:51`); it is absent from the Dockerfile's baked enable list
> (`Dockerfile.substrate:292-325`); there is no `COPY repos/human-surface-vessel`; and
> `entrypoint.sh` auto-installs only `federation-transport-vessel`. It exists only after an
> explicit `vessel-ctl install` — which is exactly what Path A does. Treating its absence as a
> failed role selection sends you chasing a correct system.

> `substrate-doctor` **will** print red on a correct compute spoke: checks 2 and 3 curl
> `127.0.0.1:8000/sql` and `127.0.0.1:8080/v2/...`, and both surrealdb (`store`) and activity-api
> (`api`) are masked here. Only check 4 is role-aware. Do not read those two as a failed join.

### B.5 Narrowing the fleet

The `spoke` role group is coarse: `compute` pulls the whole development/LLM/ribosome/analysis set
and `ui` pulls the surface vessels onto a headless box. **`PROFILE=compute_node` does not work
through `make`** — see §6. Use the explicit allowlist, which `gen-env` *does* persist:

```bash
make -C scripts/substrate up \
  API_KEY=<hub-issued-key> DISCOVERY_ENDPOINT=http://<hub-host>:18100 \
  ENABLED_VESSELS=discovery-vessel.service,goal-host-vessel.service,development-vessel.service,light-dispatch-vessel.service,boredom-vessel.timer,boredom-vessel.service,substrate-ready.service,journald-stdout-forwarder.service,git-push-setup.service
```

`ENABLED_VESSELS` is checked against `ENABLED_ROLES` only (`Makefile:167`), so the federated-spoke
derivation still fires. Or keep the role group and subtract:
`DISABLED_VESSELS=stateful-ui-vessel.service,obsidian-intake.timer,obsidian-learn.timer,obsidian-collaborate.timer`
(honoured on top of any selection, `apply-inventory.sh:129-132`; delivered at `Makefile:464`,
persisted at `gen-env.sh:556`).

Capability cost of the narrow list, stated plainly: no `local-tools-vessel` (no local shell
resolver), no `llm-resolver-vessel` (every LLM call resolves on the hub through fan-out), no
ribosome (no local template extraction), no analysis-vessel.

---

## 3. Path C — a new network, full fleet from zero

### C.1 The command

```bash
cd /home/avi/documents/work/substrate
scripts/git-hooks/install.sh
git submodule status                              # triage '+' entries first — see §0.2
git submodule update --init --recursive
make -C scripts/substrate up ANTHROPIC_API_KEY=sk-ant-...
```

`up` builds only if no image exists, starts-or-creates the container, waits on readiness, runs the
legacy seed fallback if needed, rewrites `~/.metabob/config.json`, and runs the doctor
(`Makefile:345-372`).

An LLM provider key is **enforced twice** for a standalone/hub: `run-live` refuses (exit 1) unless
`FEDERATED_SPOKE` is set (`Makefile:430-437`), and independently `gen-env.sh:31-44` refuses to
write `/etc/substrate/env`, killing the container ~300ms in. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
(+ `OPENAI_BASE_URL`) are auto-read from `~/.metabob/config.json` (`Makefile:71-74`).

### C.2 The automatic chain

| Stage | What runs | Source |
|---|---|---|
| build | `preflight-submodules` → `bun validate-build.ts` (host) → `docker build --target base` | `Makefile:230-250` |
| run | two named volumes, `docker run -d --privileged`, ~25 `-e`, **9** published ports, `--tmpfs /run` `--tmpfs /run/lock` | `Makefile:429-494` |
| entrypoint | `gen-env` → seed `/workspace/substrate/fleet/` (first boot only) → `apply-inventory` → spoke-only transport install → render `llm-<id>.service` per arm → `exec systemd` | `entrypoint.sh:1-81` |
| seed A | `identity-seeder` → `reseed-restart` → `seed-identity.ts`: signup, then `substrate-default` (read,write), `substrate-admin` (read,write,admin → `SUBSTRATE_ADMIN_KEY`), plus per-vessel keys | `seed-identity.ts:136-270` |
| seed B | `bootstrap-seeder` → POST each `SHARED_TEMPLATES` entry to `/v2/activities/templates` | `scripts/bootstrap-seeder.ts:19-109` |
| seed C | concept-db (24 concepts), active-scripts run-dir copy, dev-vessel templates, 16 vessel clones + super-repo | `seed-concepts.ts`; `setup-git-push.sh:40-92` |
| ready | poll every 3s up to 240s, per-unit rule from the inventory, `|| true` | `substrate-ready.sh:68-143` |
| config+doctor | `configure-local.sh` (only when `LIVE_NAME=substrate-live`), then `substrate-doctor.sh` **without** `\|\| true` | `Makefile:367-372` |

For a **standalone nothing is selected**, so `apply-inventory` exits at `:32-35` with
"all units enabled (default)" — never reaching the masking loop. That default is **not** the same
as `ENABLED_ROLES=full` (`full` omits the `desktop` role: novnc, obsidian-desktop, obsidian-xorg).

> **Corrections to the traces on this stage:**
> - **`SHARED_TEMPLATES` has 18 entries, not 19.** `repos/ias-executor-ts/src/templates/index.ts:101-127`,
>   counted mechanically = 18. `scripts/bootstrap-seeder.ts:102` prints `${seeded}/${SHARED_TEMPLATES.length}`,
>   so the healthy journal line is **`Seeding complete: 18/18 templates seeded.`** An operator
>   grepping for `19/19` would read a correct boot as a failure. The unit comment at
>   `units/bootstrap-seeder.service:26` ("it seeds 18 templates") is **correct** — there is no
>   code-vs-comment disagreement to report here.
> - `development-vessel-seed`'s "~98 templates" figure is **comment-sourced, UNVERIFIED**.
> - Both seeders are `Type=simple` deliberately, not `oneshot` — as oneshot they held
>   `multi-user.target` for up to 10 minutes behind retries (`units/development-vessel-seed.service:23-36`).

### C.3 Verify

```bash
docker inspect --format '{{.State.Health.Status}}' substrate-live      # 'starting' for ~240s is normal
make -C scripts/substrate ready                                        # per-unit matrix
make -C scripts/substrate doctor                                       # 7 seam checks
make -C scripts/substrate show-key                                     # mb-… fleet key
docker exec substrate-live journalctl -u bootstrap-seeder.service --no-pager | tail -5
```

```bash
# end-to-end — ⚠ THIS DISPATCHES A REAL GOAL, it is not a read-only probe
make -C scripts/substrate doctor SMOKE=1
```

Healthy: `healthy`; every unit `ok` or `skipped` then `[ready] fleet ready`;
`[doctor] all checks PASS`; an `mb-`-prefixed key; `Seeding complete: 18/18 templates seeded.`;
`execution trace landed (<execId>)`.

`make up`'s **exit code is the doctor's verdict** (`Makefile:372`), while the readiness wait it
follows is best-effort. `--smoke` is never run by `up`; only `make doctor SMOKE=1`
(`substrate-doctor.sh:163-199`).

A landed trace proves the pipe, not the answer: `status` is the template exit status, `reached`
is the honest verdict.

### C.4 Remote variants

```bash
# A — build on the VM (20-30 min)
GITHUB_PAT=ghp_xxx ANTHROPIC_API_KEY=sk-ant-xxx SSH_KEY=~/.ssh/key \
  bash scripts/substrate/deploy-hub.sh root@<vm-ip> <public-ip>

# B — pull the prebuilt image (~2 min); GHCR_TOKEN needs read:packages, not just repo
GHCR_USER=<gh-user> GHCR_TOKEN=<pat-with-read:packages> ANTHROPIC_API_KEY=sk-ant-... SSH_KEY=~/.ssh/key \
  bash scripts/substrate/deploy-hub-pull.sh root@<vm-ip> <public-ip>
```

- Variant A sets `ENABLED_ROLES=hub`, `ENABLED_EXTRA_VESSELS=<6 compute units>`,
  `SUBSTRATE_BIND_HOST=0.0.0.0`, `PUBLIC_IP`/`FED_PUBLIC_IP`, and reads `RELAY_MULTIADDR` from
  `~/relay.log` (`deploy-hub.sh:104-133`). **On the first deploy there is no `~/relay.log`**, so
  `RELAY_MULTIADDR` is empty and hub federation egress is disabled — **re-run the deploy once the
  relay is up** (`deploy-hub.sh:104-108`).
- Variant B does **not** pass `ENABLED_EXTRA_VESSELS`, and `gen-env` cannot recover it: it writes
  the value only into `/etc/substrate/env` (`gen-env.sh:554`), which dies with the container, and
  the persisted-secrets heredoc (`gen-env.sh:588-616`) never emits it. `gen-env.sh:79-83`'s comment
  claiming it is "persisted in the secrets store" is **stale**. Pass `-e ENABLED_EXTRA_VESSELS`
  explicitly and verify with `docker exec substrate-live systemctl is-enabled goal-host-vessel.service`.

---

## 4. Keys — issuing with keyctl

### 4.0 Where the FIRST admin key comes from

```bash
docker exec substrate-live sh -lc 'grep SUBSTRATE_ADMIN_KEY /workspace/.substrate-secrets'
# equivalently: grep SUBSTRATE_ADMIN_KEY /etc/substrate/env
```

On a **genuine first boot** `identity-seeder.service` → `reseed-restart` → `seed-identity.ts` POSTs
`/v1/auth/signup` (`substrate@substrate.local`, org `substrate`) and, on a **200**, issues
`substrate-admin` with scopes `['read','write','admin']`, writing it to **both**
`/etc/substrate/env` and `/workspace/.substrate-secrets` (`seed-identity.ts:250-254`).
`gen-env.sh:170-175` only round-trips the value — **it never generates one.**

**On any later boot signup returns 409 and `seed-identity` returns at `:177-202`, before the
admin-key block at `:250`.** `make recreate` keeps the named volumes, so this is the *normal*
state for any substrate whose volume predates the feature. There is no automatic path that fills
it afterwards. (Confirmed live on this box: `SUBSTRATE_ADMIN_KEY` is empty on `substrate-live`.)

**Fallback — mint one yourself:**

```bash
make -C scripts/substrate issue-key NAME=keyctl-admin SCOPES=read,write,admin
```

This works *even though* `METABOB_API_KEY` has no admin scope: `substrate-key.sh:37-53,66-83`
validates the key at `/v1/keys/validate` to learn org/user, mints a 300s `role=admin` JWT at
`/v1/jwt/generate` — which deliberately does **not** require the admin scope, it only forces the
claims to match the caller's own org/user (`identity-vessel/src/index.ts:422-431`) — and POSTs
`/v1/keys/issue` with `Authorization: Bearer <jwt>`. So `admin` is **not a server-side privilege
boundary** on the mint path; it is enforced client-side by keyctl.

There is **no** Makefile target and **no** network endpoint that reveals `SUBSTRATE_ADMIN_KEY`;
`make show-key` prints `METABOB_API_KEY` (read/write only, `substrate-key.sh:57-59`).

### 4.1 Making keyctl runnable

```bash
cd /home/avi/documents/work/keyctl
bun install && bun run build      # then ./dist/cli.js
# or, without building:
bun run src/cli.ts <args>
```

- **The package is not published.** `package.json:7` sets `"private": true` and
  `registry.npmjs.org` returns 404 for the scope. Every `npx @avigopal/keyctl-vessel …` /
  `npm install -g` instruction in `README.md:7-21` fails at install.
- **Do not run the pre-existing `dist/cli.js`.** It is gitignored (`.gitignore:2`) and older than
  `src/` (dist Jul 30 vs `src/commands/issue.ts` Aug 4), so it predates the `--expires-days`
  hard-error (`src/commands/issue.ts:19-30`) and the revoke non-2xx guard
  (`src/identity/client.ts:194-205`).
- **⚠ Name collision:** `/usr/bin/keyctl` is the **kernel keyring tool** from `keyutils`, and
  keyctl-vessel's `package.json:8-11` declares bin names `keyctl` *and* `keyctl-vessel`. Typing a
  bare `keyctl config set …` reaches keyutils' argument parser and produces a confusing usage
  error, not `command not found`. **Always invoke by explicit path.**

```bash
command -v keyctl && pacman -Qo "$(command -v keyctl)"   # if it says keyutils, the bare name is unusable
```

### 4.2 Confirm the target is an identity-vessel, then configure

```bash
curl -s -m 5 http://<host>:18101/health | grep -o '"service":"identity-vessel"'

cd /home/avi/documents/work/keyctl
bun run src/cli.ts config set --sk '<SUBSTRATE_ADMIN_KEY>' --target http://<host>:18101 --name prod
bun run src/cli.ts whoami
```

- keyctl accepts an origin only if `/health`'s `service` (or `vessel`) lowercases to exactly
  `identity-vessel` (`src/transport/resolve.ts:21,92-111`); identity-vessel returns that
  (`identity-vessel/src/index.ts:115-118`). Otherwise the origin is downgraded to `other` and used
  only when nothing self-identifies.
- `config set` calls `connect()` — resolve origin, POST `/v1/keys/validate`, reject a bad key —
  then writes `~/.iask/config.json` at 0600 inside a 0700 dir (`src/config/store.ts:29-31,51-55`).
  Override with `--confdir` / `IASK_CONFDIR`.
- **Target resolution** (`src/transport/resolve.ts:67-80,142-154`): a scheme-qualified target is
  used **verbatim with no probing**; a bare host probes `https://<host>`, `http://<host>:18101`,
  `http://<host>:8101` and takes the first confirmed; `host:port` probes http then https; a
  loopback bare host never tries TLS. `IDENTITY_PORTS = [18101, 8101]` **only** — a deployment
  shifted by `PORT_OFFSET` is invisible to a bare host.
- **⚠ With `--name` given, a `config set` whose `connect()` throws only WARNS and saves the
  unvalidated config** (`src/commands/config.ts:44-59`). Treat the yellow "saving unvalidated
  config" line as a failure and always follow with `whoami`.

### 4.3 Issue / list / revoke

```bash
bun run src/cli.ts issue --identifier spoke-6e240fe0 --permissions read,write --expires-days 90
bun run src/cli.ts list                      # alias: ls ; --json for raw records
bun run src/cli.ts revoke --identifier spoke-6e240fe0 --key-id key_xxx --yes
```

- **issue** authenticates with `ApiKey <sk>` directly (no JWT round-trip) against
  `POST /v1/keys/issue`, sending `{user_id, org_id, name, scopes, expires_in_days?}` taken from
  *your* validated key, so the new key lands in your organization
  (`src/commands/issue.ts:32-80`; `identity-vessel/src/resolvers/issue-key.ts:146-200`).
  Default permissions when omitted: `read,write`.
  **The full `mb-…` key is printed ONCE on stdout** (the "copy it now" banner goes to stderr); only
  its SHA-256 hash reaches the DB and it is never written to `~/.iask/config.json`. Lose it and you
  must revoke and reissue. `--quiet` prints only the key; `--json` prints key + key_id + expires_at.
  `--expires-days` with no value / a non-number / 0 is a hard error (exit 2).
- **list** cannot use the secret key — `GET /v1/keys` rejects an `ApiKey` header. keyctl mints a
  300s `role=admin` JWT via `/v1/jwt/generate`, caches it for the process, then GETs `/v1/keys`
  (`src/identity/client.ts:137-152,179-184`). Tenant scoping is the JWT's `org_id` in the SQL
  WHERE clause; revoked keys are included, newest first; no key material is ever shown.
- **revoke** lists, filters to ACTIVE keys matching the identifier (and `--key-id`), prompts unless
  `--yes`, then DELETEs `/v1/keys/<key_id>` (`src/commands/revoke.ts:19-107`). Server-side:
  `UPDATE api_key SET is_active=false` **plus** a Redis/valkey denylist entry `revoked:<key_id>`
  with a 1-year TTL (`identity-vessel/src/db/redis.ts:46-53`).
  **⚠ Non-interactive stdin auto-answers NO** (`src/prompt.ts:8-9`) — a scripted revoke without
  `--yes` exits 1 having revoked nothing.

### 4.4 What is not enforced

| Field | Reality |
|---|---|
| `--expires-days` / `expires_at` | **Metadata only.** Expiry is not part of the signed payload (`{org}-{user}-{keyId}-{iss}`) and no validation path reads it: `validation.ts:334-358` does format + HMAC + scope lookup, and `/v1/keys/validate` additionally checks only the Redis denylist. Rotate by revoking explicitly. |
| revocation durability | Rests **entirely** on the valkey entry. `validateKey()` never reads `is_active`. Treat valkey as security-critical identity state; do not reset it independently of the datastore. |
| `keyctl org create` | No `/v1/orgs` route exists anywhere in `repos/identity-vessel/src`. The client 404-detects and reports "does not support organization provisioning" (`src/commands/org.ts:36-49`). New orgs come only from `/v1/auth/signup`. |
| `--permissions read` vs `write` | **UNVERIFIED** — only `admin` is checked (in `authorizeAdmin`). Whether consuming vessels enforce read/write on their own endpoints was not established. |
| `HOST=127.0.0.1` on identity | **Inert.** identity-vessel's server export is `{ port: config.port, fetch: app.fetch }` with no `hostname` field (`identity-vessel/src/index.ts:1418-1423`), and `config.host` is referenced nowhere else. Bun binds 0.0.0.0 regardless. `keyctl/deploy/identity-host.conf`'s comment is wrong; confine at the port publish or the firewall. |

---

## 5. Auth — the check ladder, cheapest to deepest

**Know which identity-vessel you are testing against before anything else.** Validity is a function
of one identity's `API_KEY_SECRET`. A spoke has **no local identity at all** — `roles.spoke` omits
`control` — so `IDENTITY_VESSEL_URL` points at the hub (`gen-env.sh:248-254`).

```bash
docker exec substrate-live grep -E '^(IDENTITY_VESSEL_URL|IDENTITY_ENDPOINT|HUB_DISCOVERY_URL|ENABLED_ROLES)=' /etc/substrate/env
```

### Rung 0 — what the key CLAIMS (no network)

```bash
K=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
P=${K#mb-}; P=${P%-*}; echo "$P" | base64 -d 2>/dev/null | tr -d '\0'; echo
```

Healthy: four dash-separated fields, e.g.
`organizations:substrate-users:<redacted>-key_<redacted>-http://127.0.0.1:8101`.
Fewer than four → not an `mb-` HMAC key; `parseApiKey` returns null and every rung below says
"Invalid API key format".

**⚠ `iss` is NOT a hub-vs-local discriminator.** `keyGeneration.ts:35` stamps it from
`IDENTITY_ENDPOINT` **at mint time**, which on a hub is loopback. A hub-issued key legitimately
carries `http://127.0.0.1:8101`. This rung verifies no signature and cannot say the key is valid.

### Rung 1 — is the identity that matters answering?

```bash
for u in http://localhost:18101/health http://<hub>:18101/health \
         http://localhost:18100/health http://<hub>:18100/health; do
  printf '%-40s ' "$u"
  curl -s -o /dev/null -w 'code=%{http_code} connect=%{time_connect} total=%{time_total}\n' --max-time 6 "$u"
done
```

> **Corrected discriminator.** `connect=0.000000` **exactly** means the connect never happened
> (filtered or absent host). A **small-but-nonzero** connect with `code=000` on a **docker-published**
> port means `docker-proxy` accepted the TCP connection and the *in-container* listener is absent
> or masked — check `systemctl is-enabled/is-active` inside the container, not the network. Live
> counterexample on this box: `localhost:18080` returns `code=000 connect=0.000121` while `ss`
> shows 18080 LISTENing. The traces' blanket "connect≈0.0001 means no connect" is wrong for
> published ports.

A dark local `:18101` on a spoke is **correct configuration**, not an outage. `/health` is
unconditional about auth, so a 200 proves reachability only.

### Rung 2 — THE discriminator: does THIS secret sign this key?

```bash
K=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
for I in http://<hub>:18101 http://localhost:18101; do
  printf '%-30s ' "$I"
  curl -s --max-time 8 "$I/v1/keys/validate" -H 'Content-Type: application/json' \
    -d "{\"api_key\":\"$K\"}" | jq -c '.data // .'
done
```

`validateKey()` runs **local-first HMAC**: prefix `mb-`, parse on the *last* dash, constant-time
verify against `SECRET_KEYS = [API_KEY_SECRET, ...API_KEY_SECRET_PREVIOUS]`
(`validation.ts:26-33,151-179`). If that succeeds the key is ours **regardless of what `iss`
claims**. Only on local failure does it delegate to `${iss}/v1/keys/validate`, gated by
`TRUSTED_ISSUERS` (default `[IDENTITY_ENDPOINT, HUB_DISCOVERY_URL]`, `validation.ts:49-53,301-333`).

Three distinct verdicts:

| Body | Means |
|---|---|
| `{"valid":true,"org_id":…,"scopes":[…]}` | This identity's secret (or a listed previous one) reproduces the signature. |
| `"Invalid API key signature"` | A **different** identity minted it — or the secret rotated with no `API_KEY_SECRET_PREVIOUS`. |
| `"Untrusted key issuer: <url>"` | Local HMAC failed **and** `iss` is neither self nor trusted — delegation refused before any network call. |
| `"API key has been revoked"` | Signature fine; Redis denylist entry present. |

**⚠ This endpoint always returns HTTP 200** with the verdict inside `.data.valid` — `-w %{http_code}`
tells you nothing. It is also rate-limited (100/window), so a hammering loop can produce a 429 that
is not a credential answer.

> `TRUSTED_ISSUERS` is set by **nothing** in this tree — grep finds it only in `validation.ts` and
> as prose in `ui-only-up.sh:303`, so the default governs every deployment. The comment at
> `validation.ts:45-48` calling it a "TODO follow-up knob" is **stale**; the code below it already
> implements and enforces it.

### Rung 3 — the path vessels actually take

```bash
K=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
curl -s --max-time 10 -X POST http://<hub>:18101/v1/auth/resolve -H 'Content-Type: application/json' \
  -d "{\"impulse\":{\"type\":\"authentication\",\"pointer\":{\"type\":\"apiKey\",\"apiKey\":\"$K\"}}}" \
  | jq -c '{success, authenticated:.data.authenticated, orgId:.data.orgId, scopes:.data.scopes, hasJwt:(.data.jwt!=null)}'
```

Both discovery-vessel (`middleware/auth.ts:103-152`) and activity-api (`services/auth.ts:284-305`)
POST this exact impulse. identity mints an inline short-lived HS512 JWT into `data.jwt` so the
caller needs no second round-trip. `hasJwt:false` with `authenticated:true` = the inline mint failed
(JWT_SECRET missing/mismatched) — best-effort by design, and downstream DB writes will then fail
**silently** under PERMISSIONS rather than loudly.

**Caching:** discovery caches a positive verdict 60s and serves a previously-valid key up to 600s of
grace when identity is unreachable (`middleware/auth.ts:84-152`). A just-revoked key keeps working
at a vessel for up to ~10 minutes.

### Rung 4 — end-to-end at a real gated route, with a negative control

```bash
K=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
echo -n 'authed:  '; curl -s --max-time 10 -X POST http://<hub>:18100/resolve \
  -H 'Content-Type: application/json' -H "Authorization: ApiKey $K" \
  -d '{"pointer":{"type":"vesselRegistry"}}' | jq -c 'if .content then {vessels:(.content.vessels|length)} else . end'
echo -n 'no-auth: '; curl -s -o /dev/null -w '%{http_code}\n' --max-time 8 -X POST http://<hub>:18100/resolve \
  -H 'Content-Type: application/json' -d '{"pointer":{"type":"vesselRegistry"}}'
```

authed → a vessel list, no-auth → 401. That **pair** proves the route is gated *and* your key opens
it. Both 401 → the key path is the problem. authed 200 but expected ids missing → the credential is
fine and the **capability mirror** failed (grep for `@<fed-substrate-id>`).

`/health`, `/bootstrap`, `/shapes`, `/registry/shapes`, `/registry/stats`, `/metrics` are **public**
(`discovery-vessel/src/middleware/auth.ts:49-60,219-248`) — a 200 on any of those is not an auth
result. `/bootstrap` leaks relay/identity/discovery anchors pre-auth **by design**.

⚠ On discovery **read** endpoints, send **no** `Authorization` header — adding one routes the read
into a validator that may be unreachable and returns `INVALID_API_KEY`.

### Rung 5 — the admin/JWT plane

```bash
make -C scripts/substrate whoami
make -C scripts/substrate list-keys
```

`substrate-key.sh` sources `/etc/substrate/env` inside the container and defaults `IDENTITY` to
`http://127.0.0.1:8101` — **on a spoke that variable points at the HUB**, so `make issue-key` on a
spoke mints against the hub's keyspace.

`lookupKeyScopes()` returns null on **any** DB error and the caller defaults to `['read','write']`
(`validation.ts:246-281`) — so a SurrealDB outage silently **demotes an admin key** and surfaces as
a 403 permissions failure, not a database failure.

**Asymmetry inside identity-vessel:** its own `apiKeyAuthMiddleware` uses `validateKeyFormat()` only
— HMAC + revocation, no DB scopes, no delegation, defaulting to `['read','write']`
(`middleware/apiKeyAuth.ts:51,82`) — while `/v1/keys/validate`, `/v1/auth/resolve` and
`issue-key`'s `authorizeAdmin` use the full `validateKey()`. Two verdicts are reachable for the same
key depending on which door you knock on.

### Rung 6 — did the JWT populate `$token`?

```bash
K=$(jq -r '.metabob.apiKey' ~/.metabob/config.json)
J=$(curl -s --max-time 10 -X POST http://<hub>:18101/v1/auth/resolve -H 'Content-Type: application/json' \
      -d "{\"impulse\":{\"type\":\"authentication\",\"pointer\":{\"type\":\"apiKey\",\"apiKey\":\"$K\"}}}" | jq -r '.data.jwt')
curl -s --max-time 8 -X POST http://<hub>:18101/v1/jwt/verify -H 'Content-Type: application/json' \
  -d "{\"token\":\"$J\"}" | jq -c '.'
```

**UNVERIFIED:** the request field name (`token`) for `POST /v1/jwt/verify` was not read out of
`identity-vessel/src/index.ts:529`. Confirm before scripting this rung.

Healthy: a payload carrying `org_id`, `user_id`, `role`, `AC:'apikey_token'`, `NS`/`DB` — exactly
the claims SurrealDB turns into `$token`. `DEFINE ACCESS apikey_token … KEY '__JWT_SECRET__'` is
substituted at migration time (`activity-api/sql/migrations/064-add-apikey-token-access.surql:6-45`).

**The failure at this depth is SILENT.** API-key-derived JWTs populate `$token` **only**; `$auth`
is populated only for record (dashboard) users. PERMISSIONS guarded on `$auth.org_id` blocked every
trace INSERT and returned an **empty result with no error**, which the caller read as success
(`migrations/121-fix-trace-table-permissions-token.surql:8-20`). When traces stop appearing while
every rung above is green, suspect `$token`. **Never infer "auth is fine" from the absence of a 401.**
Never bypass PERMISSIONS with root credentials.

---

## 5b. The surface is up, shows no data, and cannot submit a goal

The most common report against a working container, and it has three
independent causes that look identical from the browser. Work them in order —
each check is cheap and each one alone is sufficient to produce the symptom.

**First, separate "cannot reach" from "nothing to reach."** Raw connectivity to
a hub's discovery and identity is usually fine even when the board is empty:

```bash
for p in 18100 18101 18210; do
  printf '%s ' $p
  docker exec <container> curl -s -o /dev/null -m 6 \
    -w '%{http_code} connect=%{time_connect}\n' http://<hub>:$p/health || echo unreachable
done
```

`connect=0.000000` means the connection was never made — that port has no route
from here, and a hub commonly serves goal-host over libp2p only.

**Cause 1 — it is anchored somewhere else.** Read the running process, not the
env file: a unit can outlive a rewrite.

```bash
tr '\0' '\n' < /proc/$(pidof -s bun)/environ | grep -E 'DISCOVERY|HUB_|IDENTITY'
```

`HUB_DISCOVERY_URL` is the anchor that matters. If it names `172.17.0.1` it is
pointed at the docker host's own substrate, not the remote hub, however
convincingly `IDENTITY_VESSEL_URL` names the hub. Confirm with the join
criterion — the container's `FED_SUBSTRATE_ID` must appear in the hub's
registry, and zero rows means it never joined regardless of what the config says.

**Cause 2 — it joined nothing because the relay is dead.** See §6, and note the
prescribed `relay_multiaddrs` check passes green on exactly that state.

**Cause 3 — the path, not the network.** Before 4e50f1fa the surface probed
`/resolve` against whatever address it resolved. A federation ingress serves
`/health`, `/egress/resolve` and `/v2/impulses/resolve` and 404s everything
else, so the probe rejected its one working candidate and the board reported
`upstream unreachable`.

> **A 404 from a federation ingress is indistinguishable from a dead relay
> circuit.** When this was diagnosed the transport journal was cycling
> `reservation lost → phantom-reservation suspicion → circuit=(pending)` every
> ten minutes, so "the relay is down" was the obvious reading and was wrong.
> Measured on the same port in the same second: `/resolve` → 404,
> `/v2/impulses/resolve` → 200 in about a second with a real proxied answer.
> A 404 is the router declining a path; the network delivered it fine.

Enumerate the paths before blaming transport:

```bash
for p in /health /resolve /v2/impulses/resolve; do
  printf '%-24s ' $p
  curl -s -o /dev/null -m 6 -w '%{http_code}\n' -X POST http://127.0.0.1:8401$p \
    -H 'Content-Type: application/json' -d '{"type":"activeDispatches"}'
done
```

**Cause 4 — the answer arrived and could not be read.** A peer answers
`{content:{shape,produced_by,body}}`; a local vessel answers
`{resolved,shape,body}`. The UI requires `resolved === true`, so an unnormalised
federated answer renders the failure banner *with a good answer inside the
response it just rejected*. Fixed in 3b4f921a. If you add a route that resolves
a shape, normalise the envelope there too — a per-route unwrap is how one gets
forgotten.

### Everything is available over the p2p connection

The relay carries **shaped impulse resolutions and nothing else**
(`resolveViaLibp2p(vl, target, pointer)`). The consequence is worth stating
plainly, because it decides how anything new must be built:

> **Any capability expressed as a bespoke HTTP verb is unreachable over
> federation by construction.** Express it as a shape and it travels everywhere
> the relay reaches, for free.

Goal dispatch was the last thing on the wrong side of that line. It is a shape —
`goalDispatchAsync` — and since 3b4f921a the surface uses it, so a UI-only spoke
with no local goal host can dispatch to a peer over the circuit:

```bash
curl -s -X POST http://127.0.0.1:8401/v2/impulses/resolve \
  -H 'Content-Type: application/json' -H "Authorization: ApiKey $K" \
  -d '{"type":"goalDispatchAsync","goal":"…","operator":"you"}'
# -> {"content":{"body":{"dispatchId":"…","status":"running"},
#     "note":"proxied to the owning vessel on the peer substrate over libp2p"}}
```

Read it back with `goalWalkState` over the same path.

> ⚠ **Use the ADVERTISED spelling.** goal-host's handler accepts
> `goal_dispatch_async`, but discovery indexes only `goalDispatchAsync` from its
> registration (`SHAPES`, `goal-host-vessel/src/index.ts`). Resolving the alias
> returns `unknown shape: no local or remote producer` — which reads as a
> missing capability and is a missing index entry. When a resolve says "no
> producer", check the advertised name before concluding the capability is absent.

## 6. What goes wrong — per-path silent failures and the discriminating check

### 6.1 Path A — UI container onto an existing network

| Symptom | Cause | Discriminating check |
|---|---|---|
| Exits 2 "no hub"/"no api key" despite a populated config | Host `jq` missing — `cfg()` returns empty silently (`ui-only-up.sh:144-148`). Reads as missing config. | `command -v jq` |
| Boots against a plausible wrong hub; assert 9 fails after ~5 min | `--hub` fell back to `.metabob.endpoint` = `http://localhost:18080` (activity-api). `hubDiscovery` is written by nothing (`configure-local.sh:76-77`). | `jq -r '.metabob.hubDiscovery // "(absent)"' ~/.metabob/config.json` |
| Assert 3: workdir missing, `ls /workspace/git/super-repo` shows only `scripts/` | PAT never armed the helper; clone 401'd; baked seed used (`setup-git-push.sh:167-173`, `Dockerfile.substrate:269`). `GITHUB_TOKEN` alone does not arm it. | `docker exec <name> journalctl -u git-push-setup -n 40` |
| `vessel-ctl install` → "vessel not in manifest" after a clean boot | Stale `:dev` image (built only when missing) **or** a surviving `<name>-workspace` volume pinning an old manifest, read before the image copy (`vessel-ctl.sh:41-43`, `entrypoint.sh:13-20`). | Compare both copies: `docker exec <name> jq -r '.vessels[].name' /workspace/substrate/fleet/vessels.manifest.json /usr/local/share/substrate/vessels.manifest.json` |
| Host port 18310 dead; in-container `/health` 200 | `HOST` pinned to 127.0.0.1 — a loopback listener never sees DNAT'd traffic from the bridge. Static unit `units/human-surface-vessel.service:10`. | `docker exec <name> systemctl show human-surface-vessel -p Environment` — **not** `ss` (see below) |
| **`ss -ltnp \| grep 8310` prints "(nothing listening)" on a box whose only defect is a loopback bind** | **`ss` is not in the image.** The pipeline is empty and `\|\| echo "(nothing listening on 8310)"` fires unconditionally — the diagnostic reports the OPPOSITE verdict ("server down"). | `systemctl show … -p Environment` + in-container `curl 127.0.0.1:8310/health`: **200 in-container + host failure IS the loopback signature** |
| `install` reports `ok:true`; the vessel boots, answers /health, serves nothing | `vessel-ctl` runs `post_install` as `csh "$post" >/dev/null 2>&1 \|\| true` — swallows stdout, stderr **and** exit status. | `docker exec <name> cat /workspace/human-surface-ui-build.log` → `UI_BUILD_FAILED` with dist present = serving a **stale** bundle |
| `make up` exits non-zero on a healthy spoke | `Makefile:372` ends in the doctor with no `\|\| true`. **Only checks 3 and 7 are legitimately inapplicable** — check 2 passes (surrealdb is in the unit list) and check 4's floor is 2. | Read *which* check failed. A hollow registry at check 4 is a **real fault**. |
| Timers enabled and never due | Historically: a `.timer` named without its `.service` → systemd refuses ("Refusing to start, unit X.service to trigger not loaded"). **Now closed for every selection route** by `apply-inventory.sh:95-127`. | `systemctl list-timers --all` (real `NEXT`) + `systemctl is-enabled <unit>.service` |
| Second UI spoke leaves a dead container blocking every retry | `docker run` fails on the first conflicting `-p`. The preflight prevents it, but is skipped when host `ss` is absent and never runs under `DRY_RUN=1`. | Pass a distinct `--name` **and** a `--port-offset` clearing all nine (see §7 for the first free offset) |
| Local 401 "Untrusted key issuer"; registry at 0; same key 200 at the hub | The Makefile derives activity-api/identity from one `DISCOVERY_HOST` — correct only if the peer is a full hub. A **spoke** peer masks `api` and `control`. | Export `IDENTITY_VESSEL_URL`/`IDENTITY_ENDPOINT`/`ACTIVITY_API_ENDPOINT`/`PEER_DISCOVERY_ENDPOINTS` before invoking (`ui-only-up.sh:289-316` passes through non-empty values) |
| Hub, spoke and vault all dark; "no local or remote producer" | Two substrates sharing `FED_SUBSTRATE_ID` → identical libp2p peer id (sha256-seeded from `FED_VESSEL_ID@FED_SUBSTRATE_ID`), and `isSelfCircuit()` discards every peer's rows as self-dials. | Let `gen-env` auto-assign; if pinning, use `spoke-federate.sh` which runs the hub-side collision check (`spoke-federate.sh:53-57`) |

### 6.2 Path B — compute spoke onto an existing network

| Symptom | Cause | Discriminating check |
|---|---|---|
| **`PROFILE=compute_node` has no effect and nothing says so** | `PROFILE` has **no delivery path** through make: the Makefile declares it only inside `recreate`'s carry-forward; `run-live` passes no `-e PROFILE=` (`Makefile:443-476`); `gen-env` never mentions it. The value dies at the docker boundary. `apply-inventory.sh:32` then sees it unset and logs an ordinary spoke selection. | `docker exec substrate-live systemctl list-units --type=service --state=running`. Use `ENABLED_VESSELS` instead (§B.5), or a raw `docker run -e PROFILE=` (which **does** work, but is not persisted). |
| Wanted a lean node; got the UI vessels, LLM fleet, ribosome, analysis, relevance sink | `roles.spoke = [compute, ui, seed, infra, registry]` and role is per-unit — coarse by construction. | `ENABLED_VESSELS` allowlist or `DISABLED_VESSELS` subtraction |
| Every hub register 401s; no `@<id>` rows; locally fine | Locally minted `METABOB_API_KEY` (`secrets.env.sh:31` generates one when none is supplied). **`HUB_API_KEY` is read by three components and set by NOTHING in this tree** — the `API_KEY` fallback is always the operative path. | `make -C scripts/substrate issue-key NAME=spoke-<loc>` on the **hub host** (`Makefile:618-620`) |
| Transport flaps every 5s; spoke locally healthy, invisible to hub | Empty `relay_multiaddrs` from `<hub>/bootstrap` → `process.exit(1)` (`federation-transport-server.ts:61`) with `Restart=always`/`RestartSec=5`. Or a cold-volume `WorkingDirectory` that does not exist yet (self-healing, expected on first boot). | `docker exec … curl 127.0.0.1:8401/health`; then `journalctl -u federation-transport-vessel -n 50` |
| Fan-out misses hub producers; everything else fine | **A baked drop-in wins.** `units/discovery-vessel.service.d/federation-peering.conf` hardcodes `PEER_DISCOVERY_ENDPOINTS=http://138.197.116.56:18100`, and `Dockerfile.substrate:213` copies `units/` into `/usr/lib`. A drop-in `Environment=` is applied after `EnvironmentFile=`, so it beats gen-env. **Confirmed live.** | `docker exec substrate-live systemctl show discovery-vessel.service -p Environment \| tr ' ' '\n' \| grep PEER_DISCOVERY` |
| Federation egress dark for days while reservations converge reliably | With `RELAY_MULTIADDR` empty the transport derives the relay from `/bootstrap` **once at module load** (`let RELAY`, never re-read) — the code comment claims read-at-use-time and the implementation does the opposite. A moved hub does not move a long-lived process. | Restart the transport after any hub migration; verify a `/p2p-circuit` multiaddr, not a green unit |
| `make recreate` silently converts a spoke into a standalone; the fleet looks **healthier** afterwards | `ENABLED_ROLES`/`DISABLED_VESSELS`/`PROFILE` are launch-time `?=` args nothing persists. (`recreate` now carries them forward, `Makefile:376-414`.) | Verify the echoed `[recreate] carrying forward launch identity: …`, then re-read `/etc/substrate/env` |
| `make up` on an **already-running** container silently ignores join settings | `Makefile:348-349` prints "already running" and skips run-live; `LAUNCH_OVERRIDES` is checked only on the stopped-container branch (`:351`). **UNVERIFIED** — read from code, not tested. | Read `/etc/substrate/env` after the command, never the command's output |
| dev-vessel datastore resolvers fail/timeout | `gen-env.sh:382` defaults `SURREALDB_URL=http://127.0.0.1:8000`, but `store` is masked on a spoke. Affects `compose-topology-tick.ts:30`, `surrealdb-export.ts:62`, `surrealdb-import.ts:59`, `advertised-shape-coverage-scan.ts:23`. | Pass `SURREALDB_URL=<store-host>` (`Makefile:474`). **Do not** add surrealdb to the spoke — that stands up a second empty datastore. |
| `FEDERATION_SIGNING_SECRET` synchronised across the fleet, nothing changes | **The knob is dead.** `secrets.env.sh:37-42` declares it, `vessels.manifest.json:50-51` wires it, `vessel-ctl.sh:103-109` materialises it, `deploy-remote.sh:73-74` injects it — and **zero TypeScript in this tree reads it**. Peer trust is enforced by identity-vessel issuance. | `grep -rn FEDERATION_SIGNING_SECRET --include='*.ts' repos/ scripts/ packages/` → no hits |

### 6.3 Path C — new network, full fleet

| Symptom | Cause | Discriminating check |
|---|---|---|
| Container exits ~300ms in: `[gen-env] ERROR: No LLM provider key found.` | Standalone/hub with neither `ANTHROPIC_API_KEY` nor `OPENAI_API_KEY` (`gen-env.sh:31-44`). A spoke is exempt. | `jq -r '.providers.anthropic.apiKey // "MISSING"' ~/.metabob/config.json` |
| `[gen-env] ERROR: no persisted API_KEY_SECRET on an existing datastore` | Reusing a datastore whose secrets file carries no `API_KEY_SECRET`. **Fails closed by design** rather than coming up with a forgeable trust space (`gen-env.sh:119-141`). | `docker exec … cut -d= -f1 /workspace/.substrate-secrets \| sort` |
| Every vessel `heartbeat HTTP 401`; registry 0/0; fleet looks healthy | Historically: signup 409 on a warm volume → the old seeder returned having minted nothing. **Patched** — `seed-identity.ts:177-202` now asks identity whether the fleet's *current* key authenticates and re-issues only if rejected. | `make -C scripts/substrate show-key` then rung 2 |
| Redeployed hub answers 200 on :18080/:18100 but dispatches nothing | `deploy-hub-pull.sh` does not pass `ENABLED_EXTRA_VESSELS`, and it is written only to `/etc/substrate/env` (dies with the container), never to the persisted heredoc (`gen-env.sh:588-616`). `gen-env.sh:79-83`'s "persisted in the secrets store" comment is **stale**. | `docker exec substrate-live systemctl is-enabled goal-host-vessel.service` |
| Boot takes 10-15 min; `systemctl list-jobs` shows everything behind one seeder | A `Type=oneshot` seeder is not "started" until it **exits**, and `multi-user.target` waits. **Fixed** — both seeders are `Type=simple`. Do not make a new seeder oneshot. | `docker exec … systemctl list-jobs` |
| SurrealDB times out on INSERT; grading, ribosome and traces stop; nothing alarms | Datastore filesystem out of headroom (measured 76G/77G, 1.1G free). | `docker exec … df -Pm /var/lib/surrealdb`. Reclaim with `docker builder prune -f` and `journalctl --vacuum-size=200M` — **never prune docker local volumes, those ARE the datastore** |
| All LLM arms 200 with `providers=[anthropic]`; every call fails for hours | Credit exhaustion. `/health` cannot see it. | doctor check 7 issues a **real 16-token paid completion** (`substrate-doctor.sh:132-161`) |
| A role-excluded vessel is still running | `apply-inventory` can only govern units the inventory **names**; an unlisted shipped unit runs in every role. | Read the boot warning: `apply-inventory` emits `warn: N shipped unit(s) absent from the inventory` (`apply-inventory.sh:188-216`). Warn-only deliberately — masking an unlisted unit would let a packaging omission take a vessel down at boot |
| Autonomous self-development completely dead on a federated deployment | 42 units carry role `autonomy`, which appears **only in `roles.full`**. `hub` and `spoke` both omit it, so gap-compose, operator-goal-generator, compose-teacher and 38 others are masked on **every** node of a hub+spoke federation. The mask mtime matches container boot — configuration, not an incident. | `docker exec … systemctl is-enabled gap-compose.service`; fix with `ENABLED_EXTRA_VESSELS` or add `autonomy` to the role selection |
| Per-vessel API keys never take effect | `seed-identity.ts:245-269` issues keys for local-tools-vessel/goal-host-vessel/concept-db and only `console.log`s them — no `writeFleetKey`, no `upsertEnvVar` (unlike the admin key at `:251-252`). `gen-env.sh:164-168` falls all three back to `METABOB_API_KEY`. **Log and code disagree; code wins.** No fix applied — per-vessel trace attribution is not achieved by the seed path. | `docker exec … grep LOCAL_TOOLS_VESSEL_API_KEY /etc/substrate/env` |

### 6.4 All paths — post-bring-up

| Symptom | Cause | Discriminating check |
|---|---|---|
| A unit is **masked AND running** (or masked and failed) — `is-active` says active, `/health` 200, and every recovery mechanism is disabled at once | Masking defeats `Restart=on-failure`, self-recovery, pull-sync's restart and every watchdog **simultaneously**. A masked+running process has also been running unmanaged since it was masked, so its code is frozen however new the tree looks. | Assert the conjunction, matching **both** mask forms: `for u in $(systemctl list-units --type=service --plain --no-legend \| awk '{print $1}'); do s=$(systemctl is-enabled $u); a=$(systemctl is-active $u); case "$s" in masked\|masked-runtime) case "$a" in active\|activating\|failed) echo "$u $s $a";; esac;; esac; done`. A `= masked` test reports clean on the transient case an operator is most likely to create by hand. |
| A systemd repair is in git, the log says "units: converged", the running unit shows the old value | A **real** file in `/etc/systemd/system` outranks `/usr/lib`, and `vessel-ctl` renders dynamic vessels into `/etc` — 8 units shadowed on one container with the convergence log still claiming success. | `systemctl show <unit> -p DropInPaths,FragmentPath` and `systemctl cat` — never read the repo, and **never** read a unit through `head`/`tail` (a drop-in that sorts last can clear `ExecStart=` entirely) |
| A diagnosis drawn from `systemctl cat <unit> \| head` is simply wrong | Multiple fragments; the last-sorting drop-in wins. | `systemctl show <unit> -p ExecStart` (the **effective** value) |
| `pull-sync: super-repo clone DIVERGED — refusing` for hours; the fleet runs a stale tree | The substrate committed generated artifacts locally and never pushed. pull-sync correctly refuses to force. | `journalctl -u substrate-pull-sync -n 300 \| grep -E 'DIVERGED\|FETCH FAILED\|SHADOWED\|TEST GATE\|synced='`. **A loud failure nobody reads is a silent one** — the real detector is an alarm on `DIVERGED` |
| Shared package rebuilt, all consumers bounced, health green — five of six run 11-day-old code | The dist swap is visible only to a consumer whose `node_modules` copy is a **symlink** into that dist (measured: 1 of 6). Health cannot witness it. | Verify **by content**, not by health or by a `LAST_GOOD` credit |
| Fleet drafters 401; a re-key was applied; restarting does not fix it | Units load `EnvironmentFile=/etc/substrate/env` **then** `EnvironmentFile=-/workspace/.substrate-secrets`; the **later** file wins. Updating only the first lets the secrets file re-inject the stale key every boot. | Fingerprint the **process** env: `tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value <unit>)/environ \| grep METABOB_API_KEY` |
| **`DRY_RUN=1 apply-inventory` MUTATES a live container** | The unmask branch (`rm -f /etc/systemd/system/$u` when the link points at `/dev/null`) sits inside the `is_desired` arm with **no `DRY_RUN` guard**, unlike the enable branch (`:160`) and the disable/mask branch (`:170`) — `apply-inventory.sh:136-140`. Compounded by `docker exec` inheriting the container env, so the plan a dry run computes can differ from boot's. | Treat it as a **write**. There is no safe rehearsal through this path today. |
| Spoke registry drains 19/305 → 0/0/0 while every vessel stays healthy | identity-vessel is role `control`, absent from `roles.spoke`, so validation is a hub call. Registrations carry a TTL refreshed by heartbeat; when the hub is down both heartbeat and re-register 401 and entries expire. **A hub outage silently unregisters a healthy spoke.** | `curl -s http://127.0.0.1:18100/registry/stats` — **with no `Authorization` header** |
| `ROUTE_EDIT_INTENT_TO_COMPOSE` halt applied; autonomous composing continues while the **operator's** dispatches are refused | `effectiveCap = directed ? cap : Math.max(1, cap - 1)`. At `COMPOSE_MAX_CONCURRENT=0` the table is **directed 0 / autonomous 1** — the kill switch inverts the priority it exists to enforce. | Check for `/etc/systemd/system/development-vessel.service.d/99-emergency-compose-halt.conf` before diagnosing a refusal. The real halt for autonomous edit landing is `ROUTE_EDIT_INTENT_TO_COMPOSE=0` on goal-host |

---

## 7. Live-state notes for THIS machine (what would fail today)

Read-only probes, 2026-08-18, from `/home/avi/documents/work/substrate`. Nothing was created,
started, stopped or reconfigured.

### 7.1 ⚠ The advertised relay is on a half-decommissioned host

```bash
curl -s -m 8 http://syzygy.host:18100/bootstrap | jq -c '.relay_multiaddrs'
getent hosts syzygy.host
for p in 18100 18101 18080 18210 18260 30333; do
  timeout 4 bash -c "</dev/tcp/104.236.0.175/$p" 2>/dev/null && echo "$p OPEN" || echo "$p CLOSED"
done
timeout 5 bash -c "</dev/tcp/138.197.116.56/30333" 2>/dev/null && echo "relay OPEN" || echo "relay CLOSED"
```

Observed: `/bootstrap` advertises `/ip4/138.197.116.56/tcp/30333/p2p/12D3KooWJ9Jdv…`, while
`syzygy.host` resolves to **104.236.0.175** and **the hub's own 30333 is CLOSED**. The old
droplet's HTTP plane is dead (`:18100` → `code=000 connect=0.000000`) but its **libp2p relay
daemon still accepts** — `138.197.116.56:30333` is OPEN, and `substrate-live`'s transport holds
`activeReservations:1` against it.

**Every federated join today — Path A and Path B both — rides a zombie relay on a box whose HTTP
plane is already gone, one daemon-stop from every spoke going dark.** The check the traces
prescribe (`relay_multiaddrs` non-empty) **passes green on exactly this state**. Add the resolve +
TCP probe above to Path A and Path B, and treat a relay multiaddr on any host other than the hub as
an unresolved migration. Firewall guidance must open 30333 on the **relay** host, which is not the hub.

### 7.2 Host toolchain gaps

```bash
command -v bun || echo NO-BUN;  command -v npm || echo NO-NPM;  command -v npx || echo NO-NPX
```

`bun`, `npm` and `npx` are all **absent** (node is present at `/usr/bin/node`). Consequences:

- **Every keyctl instruction in §4 is unrunnable today.** The npm path is dead (unpublished) *and*
  the from-source path needs bun. There is currently **no working way to run keyctl on this box**.
  The npx failure surfaces as `npx: command not found`, not a registry 404.
- **Path C is image-reuse-only.** `make build` and `make up REBUILD=1` both fail at
  `validate-build` (`bun validate-build.ts` on the host, `Makefile:241-242`). It survives only
  because `ghcr.io/avigopal/substrate:dev` already exists locally (4.66GB, 4 days old) and
  `make up` builds only when the image is missing.
- `/usr/bin/keyctl` is **keyutils 1.6.3-4**, colliding with keyctl-vessel's own bin name.

### 7.3 The configured client endpoint is dead

```bash
jq -c '{ep:.metabob.endpoint}' ~/.metabob/config.json
curl -s -o /dev/null -w '%{http_code} connect=%{time_connect}\n' -m 4 http://localhost:18080/health
docker exec substrate-live grep -E '^(ENABLED_ROLES|ACTIVITY_API_ENDPOINT)=' /etc/substrate/env
```

`metabob.endpoint` is `http://localhost:18080`, which returns **`code=000 connect=0.000121`** —
docker-proxy accepts, nothing serves inside, because this box is `ENABLED_ROLES=spoke` and masks
`activity-api`. `/etc/substrate/env` already carries the real store as
`ACTIVITY_API_ENDPOINT="http://syzygy.host:18080"`.

Every tool that trusts the config (the MCP cockpit, doctor's seeded-key check, any trace read) is
pointed at a hole. **No trace flagged this.** `make up` skips `configure-local.sh` only when
`LIVE_NAME != substrate-live` — this container **is** `substrate-live`, so the wrong value is
rewritten on every `up`. Point it at `http://syzygy.host:18080`, or accept that reads must go
direct to the hub.

The key itself is fine: 160 chars, `mb-` prefix, and it **validates true at the hub**
(`{"valid":true,"org_id":"organizations:substrate","key_id":"key_<redacted>","scopes":["read","write"]}`).
`hubDiscovery` and `gitPat` are both absent, as expected.

### 7.4 Four substrates; first free port offset is 4000

```bash
docker ps --filter name=substrate --format '{{.Names}}'
ss -ltn | awk 'NR>1{n=$4; sub(/.*[:.]/,"",n); if(n+0>=18000 && n+0<=23000) print n}' | sort -un | tr '\n' ' '
```

Running: `substrate-live`, `substrate-ui`, `substrate-ui-local`, **`dashboard-test-substrate-1`**
(the fourth, missed by the traces' census — bound to 127.0.0.1 only, publishing 21080/21100/21210/
21250/21260, volumes `dashboard-test_substrate-surreal` / `_workspace`).

Occupied 18000-23000: `18080 18090 18100 18101 18210 18250 18260 18270 18310 18803 19080-19310
20080-20310 21080 21100 21210 21250 21260`. Because `ui-only-up.sh` refuses if **any** of its nine
collide, `--port-offset` 0, 1000, 2000 **and 3000 all refuse**. **The first usable value is
`--port-offset 4000`.** Enumerate substrates with `docker ps --filter name=substrate` *and* watch
for compose-named containers — never infer the fleet from a fixed port triple.

### 7.5 The stale peer endpoint reproduces

```bash
docker exec substrate-live systemctl show discovery-vessel -p Environment | tr ' ' '\n' | grep PEER_DISCOVERY
docker exec substrate-live grep -E '^PEER_DISCOVERY_ENDPOINTS=' /etc/substrate/env
curl -s http://127.0.0.1:18100/registry/stats
```

The unit environment carries `PEER_DISCOVERY_ENDPOINTS=http://138.197.116.56:18100` (the dead
droplet) while `/etc/substrate/env` says `syzygy.host` — **the baked drop-in wins at runtime, as
predicted**, which settles Path B's open question. The local registry reports a healthy
19 vessels / 305 shapes throughout: **local registration health is completely independent of
whether fan-out reaches anything.**

### 7.6 Identity is masked everywhere locally; the first admin key does not exist

```bash
docker exec substrate-live systemctl is-enabled identity-vessel.service          # masked
docker exec substrate-live sh -c 'grep -c "^SUBSTRATE_ADMIN_KEY=.\+" /workspace/.substrate-secrets'  # 0
```

`identity-vessel` is `masked` on all three named substrate containers, and 18101/19101/20101 all
return HTTP 000 — correct for a spoke, not an outage. `SUBSTRATE_ADMIN_KEY` is **empty on
substrate-live**, which **confirms live** the §4.0 prediction that the 409 signup path never
reaches the admin-key block. Use the `make issue-key` fallback (§4.0) — though note §7.2: keyctl
itself is unrunnable here until bun is installed.

### 7.7 The hub blocker has moved — re-verify before acting

```bash
for p in 18210 18260; do timeout 4 bash -c "</dev/tcp/104.236.0.175/$p" 2>/dev/null && echo "$p OPEN" || echo "$p CLOSED"; done
```

The standing "hub serves unauthenticated data on goal-host :18210 and concept-db :18260" blocker is
**NOT reproducible from this box today**: both ports refuse TCP while 18100/18101/18080 answer in
~80ms — so it is port-specific, not network or DNS. A second signal agrees: the hub's
`vesselRegistry` contains **no hub-local goal-host row** (only federated `goal-host-vessel@spoke-*`),
i.e. the hub's dispatch surface is not registered. Either a firewall landed or those units are down.

Closed-from-this-box is not closed-from-everywhere, but "today" and "re-confirmed" are unsupported.
**The PAT-rotation half of that blocker is unaffected and still stands on its own.**

### 7.8 Three submodules will be silently rewound

```bash
git submodule status | grep '^+'
for m in repos/development-vessel repos/goal-host-vessel repos/llm-resolver-vessel; do
  printf '%-32s dirty=%s\n' "$m" "$(git -C $m status --porcelain | wc -l)"
done
```

`repos/development-vessel`, `repos/goal-host-vessel` and `repos/llm-resolver-vessel` are each ahead
of their recorded gitlink with a **clean** worktree. `git submodule update --init --recursive` —
Path C's step 1 as written — will **not** abort (the abort case is a *dirty* worktree) and will
**rewind all three**, discarding substrate-authored advances with no warning. Push or branch them
before running §0.2.

### 7.9 What is fine

`jq` and `ss` are present on the **host**, so Path A's two skip-the-check hazards are not live here.
`gh auth token` answers. Both the baked and volume manifests contain `human-surface-vessel`, so
Path A's image preflight passes today. The spoke env is correctly derived: `ENABLED_ROLES=spoke`,
`FED_SUBSTRATE_ID=spoke-cfda39e7`, `DISCOVERY_ENDPOINT` blanked to loopback,
`ACTIVITY_API_ENDPOINT`/`IDENTITY_VESSEL_URL` on the hub.

---

## Appendix — resolved and open questions

**Resolved by reading the tree (these were open in the traces):**

- **discovery-vessel's registry is in-memory** (`repos/discovery-vessel/src/registry.ts:26-29`; no
  surrealdb or redis import anywhere in `src/`). So `surrealdb.service` / `valkey.service` in
  `UI_ONLY_VESSELS` are **not** load-bearing for the registry, and `ui-only-up.sh`'s comment
  "without them discovery has nowhere to keep the rows this spoke registers" is unsupported.
- **discovery-vessel has no reader of `process.env.HOST`**, so its `Environment=HOST=127.0.0.1` is
  inert — which is why host port 18100 answers 200 despite the pin. The loopback-pin class is real
  for human-surface-vessel (which does honour `HOST`) and does **not** apply to discovery.
- **The baked `federation-peering.conf` drop-in wins at runtime** — confirmed live (§7.5).
- **`SUBSTRATE_ADMIN_KEY` is empty on a long-lived substrate** — confirmed live (§7.6), validating
  the 409-path reading of `seed-identity.ts`.

**Still open / UNVERIFIED:**

- The `POST /v1/jwt/verify` request field name (`identity-vessel/src/index.ts:529`) — rung 6 assumes `token`.
- Whether issuer delegation (`delegateValidation`) has ever succeeded in production. Three
  independent reasons suggest it is structurally dead with current minting: `iss` is stamped from
  `IDENTITY_ENDPOINT` at mint time (loopback on a hub); the default `TRUSTED_ISSUERS` would not
  contain it; and even if trusted, the POST would go to the **validator's** own loopback. Also, the
  default trusted entry is `HUB_DISCOVERY_URL` — a *discovery* endpoint (:18100) — while
  `delegateValidation` POSTs `${iss}/v1/keys/validate`, which discovery-vessel does not serve.
- Whether `api_key.expires_at` is enforced anywhere. No expiry comparison was found on the
  validation path; if none exists, `--expires-days` / `EXPIRES_DAYS` is cosmetic.
- What `--permissions read` restricts. Only `admin` is checked in identity-vessel; whether consuming
  vessels enforce read/write on their own endpoints was not investigated.
- `KEYCTL_LIBP2P_GATEWAY` expects "a running federation sidecar" bridging HTTP over the relay. No
  script or unit under `scripts/substrate` starts such a component and no doc names it, so the
  libp2p transport may not be usable at all.
- `substrate-key.sh` revokes via `POST /v1/keys/revoke` while keyctl uses `DELETE /v1/keys/:keyId`.
  The DELETE handler was read (is_active + Redis); the POST handler body was not, so whether the two
  leave the same state is unknown.
- Whether `run-live-obsidian` (`Makefile:544-552`) deliberately hardcodes its ports — it therefore
  ignores `PORT_OFFSET` entirely and publishes 8, not 9.
- Port-count drift: `Makefile:334-339`'s "equivalent raw contract" comment lists 7 and
  `docs/SUBSTRATE.md:153-159` lists 8, while `run-live` (`Makefile:477-485`) and root
  `docker-compose.yml:73-88` both publish **9**. Treat 9 as ground truth; the other two are drifted.
- How long a cold from-zero boot actually takes. Every figure in the tree is a **ceiling**, not a
  measurement: HEALTHCHECK start-period 240s, `substrate-ready --timeout 240` with
  `TimeoutStartSec=300`, identity-seeder waiting up to 120s, bootstrap-seeder up to 60s. The image
  build is documented as 20-30 min in `deploy-hub.sh`.
- No verification of `substrate-pull-sync.sh` / `self-recovery-tick.sh` line anchors beyond spot
  checks; the §6.4 mechanisms are reported from the traces with those anchors unconfirmed.