# Configuration-surface audit — enumeration + live hub/spoke test

**Fixture:** `scripts/substrate/docker-compose.cluster.yml` (hub + spoke, one docker host).
**Image under test:** `ghcr.io/avigopal/substrate:dev` (local, `8f43b8e29261`).
**Method:** enumerate every knob from the code that reads it, then boot the
documented topologies and check each claim against the running containers. Every
finding below carries the command that produced it; nothing here is inferred
from documentation alone.

---

## Part 1 — where configuration actually enters the system

There is exactly **one** channel from container environment into a vessel:
`/etc/substrate/env`, written by `gen-env.sh` and pulled in by every unit's
`EnvironmentFile=`. systemd is PID 1, and it does not export its own environment
to the units it spawns:

```
$ docker exec substrate-live systemctl show-environment
LANG=C.UTF-8
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

So `gen-env.sh` is an **allow-list**, and any variable it does not emit is
silently discarded no matter how prominently it is documented. Three secondary
channels exist: `/etc/substrate/llm-<arm>.env` (per-arm model pins),
`/workspace/.substrate-secrets` (round-tripped secrets), and entrypoint-time
scripts that read container env directly before systemd starts.

**Harness** — classifies any variable in one run:

```bash
docker run --rm -e ANTHROPIC_API_KEY=sk-ant-TEST -e VAR=SENTINEL_VAR \
  --entrypoint bash ghcr.io/avigopal/substrate:dev \
  -c '/usr/local/bin/gen-env >/dev/null 2>&1; cat /etc/substrate/env'
```

### Results (51 variables in one sentinel run; the four selection variables verified separately via `DRY_RUN=1`)

| Verdict | Variables |
|---|---|
| **Passes through** | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `CHUTES_API_KEY`, `LLM_DEFAULT_MODEL`, `RUNPOD_*` (4), `SUBSTRATE_GIT_PAT`, `GITHUB_TOKEN`, `SUBSTRATE_REPO_OWNER`, `SUBSTRATE_GIT_AUTHOR_{NAME,EMAIL}`, `METABOB_API_KEY`, `FED_SUBSTRATE_ID`, `FED_VESSEL_ID`, `RELAY_MULTIADDR`, `PEER_DISCOVERY_ENDPOINTS`, `PEER_FANOUT_MODE`, `SUBSTRATE_ADMIN_KEY`, `WORKSPACE_ROOT`, `SUBSTRATE_ROOT`, `REDIS_URL`, `SURREALDB_URL`, `PRODUCER_DISCOVERY_ENDPOINT`, `DISCOVERY_VESSEL_ENDPOINT`, `ACTIVITY_API_URL`, plus (separately verified) `ENABLED_{ROLES,VESSELS,EXTRA_VESSELS}`, `DISABLED_VESSELS` |
| **Consumed at entrypoint time — works** (1) | `LLM_ARMS` — read from container env by `render-llm-arms.sh:37-39` before systemd starts, so it never needs to appear in `/etc/substrate/env`. The one entrypoint-time knob among those tested. |
| **Works via a side file** (3) | `LLM_OPUS_MODEL`, `LLM_HAIKU_MODEL`, `LLM_GOOGLE_MODEL` → `/etc/substrate/llm-{opus,haiku,google}.env`. Functional, documented nowhere. |
| **Emitted but the operator value is discarded** (6) | `TRACE_STORE_CAP`, `TRACE_STORE_HOT_WINDOW_DAYS`, `TRACE_RETENTION_ENABLED`, `EMBEDDING_PRIOR_ENABLED`, `RATE_LIMIT_ALLOWLIST_IPS`, `OBSIDIAN_PLUGIN_ENDPOINT` — hardcoded in the heredoc (`TRACE_STORE_CAP=150000`, gen-env.sh:473), so `-e TRACE_STORE_CAP=…` looks accepted and changes nothing. |
| **Dead — never reaches a vessel** (7) | `VLLM_BASE_URL`, `VLLM_MODELS`, `VLLM_API_KEY`, `VLLM_ENDPOINTS`, `FEDERATION_SIGNING_SECRET`, `SUBSTRATE_ADVERTISE_HOST`, `VESSEL_ADVERTISE_ENDPOINT` |
| **Conditionally gated** (2) | `DISCOVERY_PUBLIC_URL`, `IDENTITY_PUBLIC_URL` — emitted only inside `if [ -n "$PUB" ]`, fed by `PUBLIC_IP`/`FED_PUBLIC_IP` (gen-env.sh:519-524). Setting either alone is dropped. |

`PUBLIC_IP` is load-bearing (it is what makes discovery's `/bootstrap` hand out a
reachable identity endpoint) and appears in neither `.env.example`, the root
compose, nor `README.md`.

---

## Part 2 — findings

### F1 — `VLLM_*` is documented in the compose file and reaches nothing (major)

The root `docker-compose.yml` carries a six-line comment block explaining how to
configure a self-hosted vLLM instance, and passes four variables. The consumer,
`repos/llm-resolver-vessel/src/index.ts:190-218`, reads them from `process.env`
— which for a systemd unit means `/etc/substrate/env`. `gen-env.sh` never emits
them. Verified: `SENTINEL_VLLM_BASE_URL` appears nowhere under `/etc/substrate`
or `/workspace` after a boot that set it.

**Fix:** add the four to gen-env's heredoc (and to `.substrate-secrets`
round-trip, so a container recreate without `-e` keeps them).

### F2 — `SUBSTRATE_ADVERTISE_HOST` / `VESSEL_ADVERTISE_ENDPOINT` are unreachable (major)

`docs/FEDERATION.md` § *Choosing a topology* instructs: "The spoke's vessels must
advertise endpoints the hub's callers can reach (`VESSEL_ADVERTISE_ENDPOINT` /
`SUBSTRATE_ADVERTISE_HOST`)." Both are read by
`packages/vessel-discovery-client/src/registration-loop.ts:125-131`; neither is
emitted by gen-env, and neither is in `.substrate-secrets`. There is no supported
way to set them on a container.

Consequence observed live: the hub registry advertises loopback even with
`PUBLIC_IP` set —

```
$ docker exec substrate-hub curl -s -X POST localhost:8100/resolve … vesselRegistry
discovery-vessel   ->  http://localhost:8100
activity-api-local ->  http://127.0.0.1:8080
concept-db-local   ->  http://127.0.0.1:8260
```

`PUBLIC_IP` fixes `/bootstrap` but not the registry entries, so a peer resolving
`activity-api` through the hub gets its own loopback.

### F3 — spoke endpoint derivation hardcodes the host-mapped ports (BLOCKER)

`docs/SUBSTRATE.md` § *Join an existing identity/discovery group* lists
`ACTIVITY_API_ENDPOINT` and `IDENTITY_VESSEL_URL` as "*optional override* —
derived from the discovery host if unset", and calls `METABOB_API_KEY` +
`DISCOVERY_ENDPOINT` "the only required inputs".

The derivation keeps the **host** and hardcodes the **18xxx host-published
ports** (gen-env.sh:249-250):

```bash
ACTIVITY_API_ENDPOINT="${ACTIVITY_API_ENDPOINT:-http://${_disc_host}:18080}"
IDENTITY_VESSEL_URL="${IDENTITY_VESSEL_URL:-http://${_disc_host}:18101}"
```

Reaching a hub on any other port — a docker network, a k8s service, a reverse
proxy, a hub whose compose remapped `ACTIVITY_API_PORT` — yields endpoints that
do not exist.

**Observed, following the documented point-and-go path exactly** (hub reached at
`http://hub:8100`):

```
http://hub:18101  -> CONNREFUSED     ← the derived identity endpoint
http://hub:18080  -> CONNREFUSED     ← the derived trace store
http://hub:8101   -> 200
http://hub:8080   -> 200

[DiscoveryRegistrationLoop] heartbeat HTTP 401 (failure #3)
[goal-host-vessel] discovery heartbeat failed 3×; vessel may be unreachable
registeredVessels: 1        (after 133s)
```

Every vessel's registration 401s because discovery validates against an identity
endpoint that is not listening. **And the container reports `healthy` throughout**
— see F4.

**Confirmed by intervention.** Setting the two "optional" overrides to the
container ports and recreating only the spoke:

```
registeredVessels: 1  →  14
[DiscoveryRegistrationLoop] registered goal-host-vessel
[goal-host-vessel] proxy registration: +239 new shapes (now 290 total)
```

One variable changed, cause established.

**Fix:** derive the port from `DISCOVERY_ENDPOINT` rather than assuming 18100 →
{18080, 18101} (a hub reached on `:8100` is on container ports throughout), and
correct the docs table — these are mandatory whenever the hub is not on 18xxx.

### F4 — the health probe cannot detect a spoke that has not joined (major)

The root compose healthcheck is `curl http://127.0.0.1:8080/health` —
activity-api, which is role `api`, i.e. **hub-only**. Two independent problems:

- A spoke booted from the root compose is permanently `unhealthy`, because it
  never binds :8080. Verified: `docker exec substrate-spoke curl :8080/health` →
  connection refused. With `restart: unless-stopped` this is a container docker
  considers broken forever.
- Probing goal-host instead (what the cluster fixture does) reports `healthy`
  for a spoke whose every vessel is 401-ing and whose registry holds one entry.
  The probe asks whether one process is listening, not whether the substrate
  joined anything.

**Fix:** role-aware probe, and make it assert registration (`registeredVessels >
1` on a spoke, or a successful heartbeat) rather than process liveness.

### F5 — every LLM arm runs twice; one of each pair crash-loops forever (major)

`entrypoint.sh` renders `llm-<id>.service` from `llm-arms.json` while the image
still ships the legacy `llm-resolver-<id>.service` units — a stated
"parallel-run migration". They bind the **same port**:

```
llm-resolver-opus.service  PORT=8221  active
llm-opus.service           PORT=8221  activating (NRestarts=38)
                           → EADDRINUSE at vessel-daemon.js:56
```

On the spoke both sets are enabled, so all three rendered arms restart forever.
The restart counter reached **128** in the ~11 minutes the spoke was up, and was
still climbing at teardown.

### F6 — rendered arms are ungoverned by role selection (major)

`apply-inventory.sh` masks units by exact name from `vessels.inventory.json`. The
rendered arms are named `llm-<id>.service`; the inventory names
`llm-resolver-<id>.service`. Rendering also happens **after** apply-inventory
runs, and the script's own conformance check scans `/usr/lib/systemd/system`
while rendered units land in `/etc/systemd/system`.

Result: a hub — documented to run no compute — runs three LLM arms against the
operator's provider key:

```
$ docker exec substrate-hub systemctl is-active llm-opus llm-haiku llm-google
active active active
```

This is precisely the failure class the conformance warning was added for; the
check has a blind spot exactly where units are generated. (It did correctly flag
`human-surface-vessel.service` and `metric-collector-vessel.service` as
ungoverned.)

### F7 — the per-arm credential guard never skips (minor, latent)

`render-llm-arms.sh:89` guards each arm with
`ExecCondition=/bin/sh -c 'grep -Eq "^ANTHROPIC_API_KEY=.+" /etc/substrate/env'`,
documented as: "a host without that key **skips** the arm cleanly rather than
failing it."

gen-env emits absent keys as a **quoted empty string**, and the two quote
characters satisfy `.+`:

```
$ grep -E "^ANTHROPIC_API_KEY=" /etc/substrate/env
ANTHROPIC_API_KEY=""
$ grep -Eq "^ANTHROPIC_API_KEY=.+" /etc/substrate/env && echo PASSES
PASSES
```

The condition passes on every host for every provider, so the guard is inert and
a keyless host starts arms that then fail. **Fix:** `^VAR="?[^"]` or test the
sourced value.

### F8 — documented role table is wrong in three ways (major, docs)

`docs/SUBSTRATE.md` § *Topology selection* lists nine roles and these groups:
`hub` = store, control, api, transport, seed, infra; `spoke` = compute, ui, seed,
infra; `full` = "every role (the default local substrate)". Actual
`vessels.inventory.json`:

```json
{"hub":["store","control","api","transport","seed","infra","registry"],
 "spoke":["compute","ui","seed","infra","registry"],
 "full":["store","control","api","compute","ui","transport","seed","infra","autonomy","registry"]}
```

- **`registry` is undocumented** and is in all three groups — it is
  discovery-vessel, so this omission makes the doc's hub/spoke tables wrong about
  the fixed point itself.
- **`desktop` is undocumented and in no group.** `novnc`, `obsidian-desktop`,
  `obsidian-xorg` carry it.
- **`full` ≠ "every role", and `full` ≠ the default.** `ENABLED_ROLES=full`
  disables the three `desktop` units; leaving all selection variables unset
  disables 0. Verified against `/usr/local/bin/apply-inventory` in the published
  image: hub masks 66 units, spoke 55, `full` exactly 3.

### F8b — an unknown role or unit name silently masks the whole fleet (major)

`expand_roles` (apply-inventory.sh:41-49) passes an unrecognised token through
verbatim, and membership is only ever tested with `grep -qx`, so a name that
matches nothing is never reported:

```
$ ENABLED_ROLES=typo-role  →  expands to: typo-role
                              done — 91 unit(s) would be disabled
$ ENABLED_ROLES=compute,ui,seed,infra,registy   (one typo)
                              done — 56 disabled   (vs 55 for a correct `spoke`)
```

(Both runs against `/usr/local/bin/apply-inventory` in the published image, not a
long-lived container's older copy — see the F10 retraction for why that
distinction is load-bearing.)

```
```

One mistyped role produces a container with 1 of 92 units running, logged as
`done`, with no warning and a zero exit. `PROFILE` has a deliberate fatal for
exactly this — the role path has none.

### F9 — two selection knobs are undocumented, one outranks everything (major)

`apply-inventory.sh` implements, highest precedence first: `PROFILE` >
`ENABLED_VESSELS` > `ENABLED_ROLES`, then `+ENABLED_EXTRA_VESSELS`, then
`−DISABLED_VESSELS`. `docs/SUBSTRATE.md` documents only the middle three, in an
order that omits the top one. `PROFILE` is **fatal on an unknown name** (by
design) — an undocumented variable that aborts boot.

`VESSELS_INVENTORY` and `DRY_RUN` are likewise undocumented; `DRY_RUN=1` is the
best available tool for checking a role selection before deploying it and
deserves to be in the docs.

### F10 — RETRACTED

Originally reported as inventory drift between the published image and the
tracked file. **False.** The diff was measured inside `substrate-live`, a
container running a 40-hour-old image layer. Checked against the published image
directly, `/usr/local/share/substrate/vessels.inventory.json` is byte-identical
to `scripts/substrate/vessels.inventory.json`, `profiles` included. The only true
statement left is unremarkable: a long-lived container keeps the inventory from
the image it booted, so `docker exec`-ing an old container is not a way to
inspect the current image.

### F10b — the entrypoint swallows apply-inventory's deliberate fatal (major)

`apply-inventory.sh:54-66` exits 1 on an unknown `PROFILE`, with an explicit
comment that falling through "would boot the coarse role group, which is the
whole failure a profile exists to prevent, and it would do so looking like a
success." The exit works:

```
$ docker run --rm -e PROFILE=nonexistent --entrypoint bash …:dev -c '/usr/local/bin/apply-inventory; echo exit=$?'
[apply-inventory] FATAL: PROFILE='nonexistent' names no entry in .profiles — known: compute_node, surface_node
exit=1
```

`entrypoint.sh:28` then discards it:

```bash
/usr/local/bin/apply-inventory || echo "[substrate] apply-inventory failed (keeping all units)"
```

Under `set -euo pipefail` the `||` suppresses the failure, and boot proceeds to
`exec systemd` with the baked full enable-list — the exact outcome the fatal
exists to prevent. **Fix:** re-raise a non-zero exit from apply-inventory instead
of converting every failure into "keeping all units"; a selection error must not
silently widen the fleet.

### F13 — a recreate without `-e` cannot boot, contradicting the round-trip contract (BLOCKER)

`docs/SUBSTRATE.md` and gen-env's own design comment both promise that provider
keys round-trip through `.substrate-secrets` so "a container RECREATE that does
not re-pass `-e KEY` keeps the provider working". The persistence works; the
guard runs first. Verified on one warm volume:

```
run 1 (with -e ANTHROPIC_API_KEY):  persisted secrets to /workspace/.substrate-secrets
run 2 (same volume, no -e):
  [gen-env] ERROR: No LLM provider key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY
  EXIT=1
```

The guard (gen-env.sh:41-44) executes ~160 lines before the persisted-secret
fallback for those same keys (gen-env.sh:205-206). **Fix:** move the guard below
the provider-key resolution block.

### F14 — `HUB_DISCOVERY_URL` alone produces a half-spoke (BLOCKER)

`README.md` and `docs/SUBSTRATE.md` both say to point "`DISCOVERY_ENDPOINT` (or
`HUB_DISCOVERY_URL`)" at the hub. Role inference reads **only**
`DISCOVERY_ENDPOINT` (gen-env.sh:242-256); the LLM-key guard, by contrast, does
accept `HUB_DISCOVERY_URL` as a spoke signal (gen-env.sh:37-40). Booting with
only `HUB_DISCOVERY_URL`:

```
DISCOVERY_ENDPOINT="http://127.0.0.1:8100"     ← loopback
ACTIVITY_API_ENDPOINT="http://127.0.0.1:8080"  ← loopback
IDENTITY_VESSEL_URL="http://127.0.0.1:8101"    ← loopback
HUB_DISCOVERY_URL="http://hub:8100"
(no ENABLED_ROLES line)
```

The container waives its LLM key *because* it looks like a spoke, then boots as a
full standalone with its own store and identity — and `entrypoint.sh:39` still
enables the federation transport because `HUB_DISCOVERY_URL` is set. **Fix:**
either make role inference accept `HUB_DISCOVERY_URL` too, or delete the "(or
`HUB_DISCOVERY_URL`)" parenthetical from both docs.

### F11 — compose `:?` guards fire for services excluded by profile (minor)

Compose interpolates every service before applying `--profile`. Relevant here
because the root compose declares
`ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:?…}` while `docs/SUBSTRATE.md` states a
spoke "needs none: it inherits the hub's LLM arms through discovery". The root
compose cannot express a keyless spoke. (Verified live: the cluster spoke boots
and reports healthy with no provider key.)

`docker compose down` interpolates too, so a `:?` guard also **breaks teardown**
from a shell that no longer exports the variable — caught by running this audit's
own teardown instructions, which failed on the first attempt for exactly this
reason. Enforce the one-key rule at `gen-env.sh:41-44`, which already gets the
spoke exemption right, and use `${VAR:-}` in compose.

### F12 — `gen-env` shells out to `docker` inside the container (minor)

Every boot logs `/usr/local/bin/gen-env: line 289: docker: command not found`.
Fails open, no downstream effect observed, but it is noise on the first ten lines
of every container's log and reads as a broken boot.

---

## Part 3 — setup-instruction assessment

| Path | Verdict | Notes |
|---|---|---|
| Quickstart from image (root compose, standalone) | **works with gaps** | Basis: cold-volume boot + secret auto-generation were validated through the cluster fixture with `ENABLED_ROLES=hub`, **not** the literal root-compose default (full fleet, no role selection). `docker login ghcr.io` untested — no fresh PAT; the image was already local. Gaps: F11, F13, F15, F16. |
| `make up` (source path) | **not re-tested** | The running `substrate-live` was built this way; no clean-clone run performed here. |
| Hub deploy (`deploy-hub.sh`) | **not tested** | Requires a remote VM. |
| **Spoke join (point-and-go)** | **broken as written** | F3. The two documented "required inputs" are insufficient on any hub not published on 18xxx; the result is a `healthy` container that joined nothing. |
| Role/topology selection | **works, documented wrong** | Mechanism is sound and `DRY_RUN=1` makes it inspectable; the published role table is wrong (F8) and omits the highest-precedence knob (F9). |

**What worked cleanly and is worth stating:** the hub reached `healthy` in under
40s from a cold volume with one env var; secret auto-generation works and
round-trips through `/workspace/.substrate-secrets`; `apply-inventory` correctly
pairs a desired `.timer` with its `.service`; both nodes seeded 18/18 bootstrap
templates (verified as 18 rows in `activity`, not a self-reported count); the
corrected spoke registered 14 vessels and discovered 290 shapes across the hub
boundary; zero failed systemd units on either node.

---

## Part 4 — what a first dispatch actually did

With the corrected spoke, a goal dispatched at `:8210` returned an **honest**
no-producer failure rather than a hollow green:

```
walk: no pick — missing shapes [shellResult] have no producer or constructible payload
refusing to satisfy with a failed/empty command; grading reach honestly (no hollow green)
reach-patch NOT ATTEMPTED … this execution stays ungraded and its arm learns nothing
```

No trace was written, so the **"traces land on the hub" claim is unverified by
this run** — not refuted. Verifying it needs a dispatch that actually produces an
execution row, which on a cold cluster needs the arms to stop crash-looping (F5).

---

## Part 5 — findings from the static cross-check

A parallel read-only audit enumerated **139 knobs** across gen-env, the compose
files, `.env.example`, the inventory, `llm-arms.json`, the entrypoint, the
Makefile and the four deploy scripts, and cross-checked them against
`docs/SUBSTRATE.md`, `README.md`, `docs/FEDERATION.md` and `docs/README.md` — 32
findings. F13, F14, F10b and F8b above came from it and are marked **CONFIRMED**
because I reproduced each against a running container or the published image.
The rest below are **VERIFIED-BY-READING** — I read both sides of each in the
repo, but none has been executed:

| # | Finding | Evidence |
|---|---|---|
| F15 | `README.md:86-89` says "`OPENAI_API_KEY` works in place of `ANTHROPIC_API_KEY`" directly under the compose quick-start, but `docker-compose.yml:31` hard-requires `ANTHROPIC_API_KEY` by name. An OpenAI-only operator cannot use the documented path. | read both |
| F16 | Compose forwards **only** `ENABLED_ROLES` from the selection family. `ENABLED_VESSELS`, `DISABLED_VESSELS`, `ENABLED_EXTRA_VESSELS` and `PROFILE` are live in-container knobs unreachable from the documented launch path. | `grep -nE 'ENABLED_\|PROFILE' docker-compose.yml` → 1 hit |
| F17 | `.env.example:75-77` says "prefer rotating to a strong `API_KEY_SECRET`", but compose passes no `API_KEY_SECRET` — the only key-security knob it forwards is `ALLOW_INSECURE_API_KEY_SECRET`, i.e. the insecure one. | same grep → 1 hit at :72 |
| F18 | **Destructive, unguarded.** `make migrate-state-to-volumes` runs `find /dst-surreal -mindepth 1 -delete; find /dst-workspace -mindepth 1 -delete` against both named volumes with no confirmation, no backup, and no check that the legacy sources are non-empty. An empty source silently empties both volumes — every trace, posterior and memoryNote. | Makefile:534-549 |
| F19 | `deploy-remote.sh:61` publishes 18080/18090/18100/18210/18250/18260/18270 — **18101 is absent**, so a substrate deployed by the documented remote path has no reachable identity-vessel. Every other launch surface publishes it. | read; port list confirmed |
| F20 | `deploy-remote.sh:67` pipes the seed step into `grep -E … \| head -2` with no `\|\| true` under `set -euo pipefail` (:54). Seed output not matching those literals aborts the deploy **after** the container is up, with no message. | read; both lines confirmed |
| F21 | `make up` with new launch settings against an already-**running** container ignores them and reports success — `LAUNCH_OVERRIDES` is consulted only in the stopped branch. The documented spoke-join command is a no-op on a running container. | Makefile:348-356 |
| F22 | `deploy-hub.sh` forwards six variables over ssh before a **quoted** heredoc; its own documented tuning knobs (`RELAY_*`, `HUB_EXTRA_VESSELS`, `FED_SUBSTRATE_ID`, …) are read inside that heredoc, so setting them in the operator's shell does nothing. | deploy-hub.sh:35-38 |
| F23 | `FEDERATION_SIGNING_SECRET` is documented as the shared peering secret (`docs/FEDERATION.md:71-72, 82-85`) but is settable on no launch path and auto-generates a *different* random value per substrate — while peering requires it identical. Corroborates the "dead knob" row in Part 1. | grep across compose / .env.example / gen-env |
| F24 | `ENABLED_EXTRA_VESSELS` alone is a silent no-op: it is excluded from apply-inventory's early-exit guard (:32-35), so the script returns before ever reading it. | apply-inventory.sh:32-35 vs :88-93 |
| F25 | `secrets.env.sh`'s header claims `gen-env.sh` sources it. It does not — gen-env has its own heredoc. The file is an unreferenced parallel implementation, and it is the only place `FEDERATION_SIGNING_SECRET` is handled (see F23). | read both |

Remaining minor findings (stale `restart-*` list, `PORT_OFFSET` not honoured by
four `make health` probes, `LLM_DEFAULT_MODEL` header/default mismatch, the
ui-bridge rationale, cross-role unit orphans) are in the workflow output at
`/tmp/claude-1000/-home-avi-documents-work-substrate/9db28fc8-de16-4c55-8ea8-930e918e4cdf/tasks/wk3m4cb6b.output`.

---

## Reproducing

```bash
export ANTHROPIC_API_KEY=sk-ant-...
docker compose -p substrate-cluster -f scripts/substrate/docker-compose.cluster.yml --profile hub up -d
until [ "$(docker inspect -f '{{.State.Health.Status}}' substrate-hub)" = healthy ]; do sleep 5; done
export CLUSTER_HUB_KEY="$(docker exec substrate-hub substrate-key show | tail -1)"
docker compose -p substrate-cluster -f scripts/substrate/docker-compose.cluster.yml --profile spoke up -d

# teardown — the -p project name is what keeps `down -v` off the real volumes
docker compose -p substrate-cluster -f scripts/substrate/docker-compose.cluster.yml \
  --profile hub --profile spoke down -v
```

To reproduce F3, delete the `ACTIVITY_API_ENDPOINT` / `IDENTITY_VESSEL_URL` lines
from the spoke service and watch `registeredVessels` stay at 1 while the
container reports `healthy`.
