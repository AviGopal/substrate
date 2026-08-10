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
| `make up` (source path) | **not re-tested; state claim refuted by reading** | The running `substrate-live` was built this way; no clean-clone run performed here. F55: it does **not** share volumes with the compose path, contrary to docs. |
| Hub deploy (`deploy-hub.sh`) | **audited, not executed** | Requires a remote VM and operator authorization. 14 verified findings — see 7.6. |
| **Spoke join (point-and-go)** | **broken as written** | F3. The two documented "required inputs" are insufficient on any hub not published on 18xxx; the result is a `healthy` container that joined nothing. |
| Role/topology selection | **works, documented wrong** | Mechanism is sound and `DRY_RUN=1` makes it inspectable; the published role table is wrong (F8) and omits the highest-precedence knob (F9). |

**What worked cleanly and is worth stating:** the hub reached `healthy` in under
40s from a cold volume with one env var; secret auto-generation works and
round-trips through `/workspace/.substrate-secrets`; `apply-inventory` correctly
pairs a desired `.timer` with its `.service`; both nodes seeded 18/18 bootstrap
templates (verified as 18 rows in `activity`, not a self-reported count); the
corrected spoke registered 14 vessels and discovered 290 shapes — **on its own
registry, not across the hub boundary; see 7.1, which corrects this sentence**;
zero failed systemd units on either node.

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

---

## Part 6 — human surface: sequences 1–5 driven against the running surface

**Target:** `human-surface-vessel` on the `substrate-ui` container (host `:19310`),
a UI-only federated spoke pointed at `syzygy-hub`. Same-origin `/api/*` — the
vessel holds the key, the browser never sees one.

| # | Sequence | Result |
|---|---|---|
| 1 | **Ask** | **PASS.** Client tries the surface parser first: `POST /api/surface-intent` → **422** with the clause, `reason: "no rule in this parser reads this instruction"`, and a `suggested_goal` — a refusal, not an error. Instruction then went to the walk: `POST /api/run-goal` → **202** `{dispatchId}`. |
| 2 | **Read the run** | **PASS.** `activeDispatches` listed it; `goalWalkState` → `status: completed`, `reached: true`, reason naming the computed value **60**. Independently checked: `find docs -name '*.md' \| wc -l` = **60**. Genuine reach, not wallpaper. |
| 3 | **Grade** | **PASS (write).** `POST /api/grade` → 200 with a store receipt `goal_verification_labels:pn6e2rjiyocysrdg5f0y`, `verdict=achieved`, `labeler=human`. Caveat below. |
| 4 | **Complain** | **PASS (write).** `POST /api/feedback` → 200, `uiFeedback` stored with `receivedAt`. Caveat below. |
| 5 | **Answer a solicitation** | **PARTIAL — fails closed correctly, loop not completable.** Producer exists (`goal-host-vessel@spoke-cfda39e7`). Answering a fabricated id → **404 `no pending solicitation with that id`** — an answer into nowhere is not laundered into success. But no pending solicitation existed, and none can: see F26. |

### F26 — the surface renders a solicitation panel it can never receive one for (major)

`SolicitationPanel.tsx` exists and its answer route works. But
`human-surface-vessel` does **not** advertise `human_input` — its served-shape
list is `uiPanel_write, uiQuestion_write, uiFeedback, interactorObservation,
interactorEvent, interactorAssertion, interactorAttachment, renderPolicy,
renderPolicy_write, surfaceIntent`. From the surface's own discovery vantage,
`human_input` resolves to **zero producers**, so goal-host's recovery loop has
nothing to route a question to.

The only vessel advertising `human_input` is the Obsidian vault — which is
currently dark (timers firing, plugin unreachable). **The substrate→human
direction is therefore unreachable from the web surface entirely.** The panel's
own header documents a related limitation honestly (`goalWalkState` does not
carry pending solicitations, so it detects them by scanning the walk log and
refuses to guess an id) — but that is the second-order problem; the first-order
one is that no question can arrive.

### F27 — starter chips derive from a 16-shape list that contains no work shapes (major)

`client.ts` states the design: "The fleet's shape vocabulary. Starters are
derived from THIS, at render time. There is no hardcoded starter list anywhere
in this surface: a fixed list goes stale silently." But
`GET /api/discovery/shapes` on a UI-only spoke returns its **local** registry —
16 shapes, all LLM/UI plumbing (`llm_completion`, `llmModelPolicy`,
`federation_probe`, `uiPanel_write`, `renderPolicy`, `surfaceIntent`, …). None of
the shapes a person would actually ask for (`shellResult`, `fileContent`,
`gitDiff`, `codeSearchResult`) appear, though they resolve fine through the hub
fan-out — `shellResult` → `local-tools-vessel@spoke-cfda39e7` over libp2p.

So the mechanism that exists to stop starters going stale instead sources them
from the one registry that cannot see the fleet's work capability. **Fix:** derive
starters from the peer-unioned vocabulary, not the local registry.

### F28 — `/api/gaps` is dead on this surface (minor)

`GET /api/gaps` → **502** `{"gaps":[],"error":"no vessel serving substrateGap
answered"}`. `GapStrip` therefore renders nothing. Honestly reported rather than
shown as an empty list, which is the right failure — but sequence 7 is
unavailable here.

### F29 — write-only shapes are advertised as resolvable (minor)

`GET /shapes` lists `uiFeedback` among the vessel's served shapes, but
`POST /resolve` with that pointer answers `unsupported pointer 'uiFeedback' on
/resolve`. The write path works; there is no read path. Consequence for
sequence 4: **a person cannot see their own complaint again**, and the write
receipt is the only evidence it persisted. A discovery-driven client that trusts
`/shapes` will be refused.

### F30 — a human grade attaches to a synthetic satisfier id (major, unverified)

The run reached via the satisfier plane, so its `executionId` was
`walk-satisfier-1-1786339773195` and `execution_id` was `null`. `client.ts`
documents that `labeler: "human"` is load-bearing — "goal-host only lets a HUMAN
verdict override `reached`, and only a human label burns the consumption latch."
But the walk logs for satisfier reaches state the walk "persisted no execution
row to patch." The label row was created; **whether anything can ever join it to
an execution is untested**, and no read route for `goal_verification_label`
exists through this surface to check.

### What the surface does well

Three independent honest-failure behaviours in five sequences: the parser refuses
with the clause and a suggested goal rather than guessing; the solicitation route
404s an unknown id rather than accepting into nowhere; `/api/gaps` names the
missing vessel rather than rendering an empty list. The surface consistently
declines to launder failure into green, which is the property the rest of the
system is measured against.

### Residue left in the running substrate

- one dispatch, `097061c8-6198-4179-8b2b-e39518909c70`, tagged `operator:surface-audit`
- one human grade, `goal_verification_labels:pn6e2rjiyocysrdg5f0y`
- one `uiFeedback` on `panel_id: runs`, prefixed `SURFACE AUDIT (ignore)`

---

## Part 7 — closing the residue: the paths Part 3 left untested

Part 3 named four untested items. This part closes what could be closed, states
what is blocked and why, and reports one instrument failure that invalidates a
measurement the report had been building toward.

Method split: the stateful boot tests were run inline and serial (one docker
daemon, contended host ports — parallel agents would collide). The read-only
audits of the remote-deploy scripts, the quickstart wording, the documented
variable set and the human-surface docs ran as a 45-agent workflow in which
every finding was re-verified by an independent agent instructed to refute it.
**28 of 40 candidate findings survived refutation; 12 were killed.** Only
survivors are recorded below.

### 7.1 A correction to Part 3 before anything else

Part 3 says "the corrected spoke registered 14 vessels and discovered 290 shapes
**across the hub boundary**." The second clause is wrong, and it mattered.

Re-running the cluster, the hub's registry sat at 2–3 vessels and *fell* over six
minutes (83 → 79 shapes) while the spoke was fully healthy. That looked like a
regression. It is not. The spoke's **own** registry held 13 vessels / 315 shapes:

```
spoke  /registry/stats -> {"totalVessels":13,"totalShapes":315,"healthyCount":13}
hub    /registry/stats -> {"totalVessels":2, "totalShapes":79, "healthyCount":2}
```

A spoke has role `registry` and runs its own discovery. `gen-env` **rewrites**
the operator's `DISCOVERY_ENDPOINT` to loopback and routes hub reachability
through a separate variable:

```
DISCOVERY_ENDPOINT="http://127.0.0.1:8100"     # operator passed http://hub:8100
PEER_DISCOVERY_ENDPOINTS="http://hub:8100"
ACTIVITY_API_ENDPOINT="http://hub:8080"
IDENTITY_VESSEL_URL="http://hub:8101"
```

Federation is **peer fan-out at resolve time, not registration mirroring**. The
hub is *supposed* to stay small. The "14 vessels" figure was always the spoke's
own registry; the phrase "across the hub boundary" imported a mechanism that does
not exist. **A registry count read on the wrong node measures the wrong thing** —
and the number looks equally plausible either way, which is what made it durable.

### 7.2 The instrument failed: a 201 write is not a readable execution

The goal was to settle Part 4's open claim — *do traces from a spoke land on the
hub's store?* The hub was a clean instrument: **0 executions at baseline**, so
anything appearing was attributable.

Nothing appeared. Before reporting that, the probe was validated with a control —
write a row through the hub's own API, then read it back with the same credential.

```
POST /v2/activities/executions  -> 201  {"success":true,"execution_id":"exec_1786342164928_fzlcdzgyk8g", "metrics":{...}}
GET  /v2/activities/executions?limit=100                          -> {"total":0}
GET  /v2/activities/executions?variant_id=config-audit-control-probe -> {"total":0}
GET  /v2/activities/metrics?activity_id=config-audit-control-probe   -> {"total_executions":0}
```

Stable at 0 after 90s, so not write batching. Two writes, same result. And the
server's own logs rule out the obvious explanation — **write and read carry the
identical org scope**:

```
POST /v2/activities/executions {"activity_id":"config-audit-control-probe", ... "orgId":"organizations:substrate"}  --> 201
GET  /v2/activities/executions {"variant_id":null,"limit":100, "orgId":"organizations:substrate"}                   --> 200
```

**F39 (critical) — `POST /v2/activities/executions` returns 201 with a computed
metrics body, and the execution is not retrievable through any read route on the
same vessel under the same credential and the same org.** Not a tenancy mismatch
(orgs match), not latency (stable at 90s), not the filter (unfiltered query also
returns 0).

**The mechanism is a table mismatch, not a missing view.** The writer and the
reader name different tables:

- writer — `activities.ts` (POST handler): `INSERT INTO activity_execution_traces { … }`
- reader — `activities.ts:2582` (GET handler): `… FROM execution WHERE 1=1`

The reader's own in-source comment (`activities.ts:2515`, *"TEMPORARY: Query
execution table directly (view not yet applied)"*) records that `execution` was
meant to be a view over the real store. On a **fresh** deployment that view is
never created, so the reader selects from a table that does not exist and returns
an empty page rather than an error. Every write is durable in
`activity_execution_traces` and invisible to the API that exists to read it.

This is the same class the report already carries at F36/F55 and the memory index
records as *a step reporting its intention, not its result*: the write's `201` and
its returned `metrics` object describe what the handler meant to do.

**Consequence for the trace-placement claim: it remains UNTESTED, not refuted.**
Two independent blockers, either of which alone is disqualifying — the dispatch
never produced a successful activity execution (7.3), and the read path cannot
observe executions that provably exist (F39). Recording "hub = 0 traces" as a
federation finding would have been a fabricated negative.

### 7.3 The spoke dispatch failed honestly

Dispatched at the spoke (`:20210`), deterministic by design to keep the credit-dead
LLM plane out of the result:

> "Count the number of files in the /workspace directory using a shell command"

```
status: failed   reached: false   pendingTargets: ['shellResult']
reason: no template produces the inferred target shapes [shellResult]; capability gap filed by the walk
```

The walk log is worth quoting, because three of its five lines are the system
declining to launder a failure:

```
[walk-concepts] concept-db could not be asked (no producer or transport error)
                — recall unavailable, NOT an empty result
[goal-host-vessel] goal-target inference {"inferred_target_shapes":["shellResult"],"confidence":0.6}
[goal-host-vessel] executor "shellResult" STILL a command FAILURE after 1 self-correction
                attempt — refusing to satisfy with a failed/empty command
[goal-host-vessel] walk: no pick — missing shapes [shellResult] have no producer; terminating
```

Target inference was **right** (`shellResult`, 0.6). `local-tools-vessel` was
running on the spoke. The walk still found no producer, self-corrected once,
refused to satisfy from an empty command, and **filed a capability gap**. Caveat
stated plainly: the hub booted with a placeholder provider key (reading the live
container's real key was denied, and every arm is credit-dead regardless), so a
walk needing the LLM plane could not have succeeded here. That does not touch the
`shellResult` finding, which failed on producer discovery, not on drafting.

### 7.4 The API key embeds a loopback identity endpoint

`PUBLIC_IP` worked exactly as the fixture's comment predicts — `GET /bootstrap`
advertised `http://hub:8100` / `http://hub:8101` rather than loopback, and
`/etc/substrate/env` carried `IDENTITY_PUBLIC_URL=http://hub:8101`.

The minted operator key does not agree. Decoded:

```
organizations:substrate-users:t6li8clsc883sv2frj1y-key_wobEuwPM9VKykShk-http://127.0.0.1:8101
```

**F40 (major) — key minting embeds a validator endpoint of `http://127.0.0.1:8101`
even when `IDENTITY_PUBLIC_URL` is set and correctly emitted.** Any consumer that
trusts the endpoint *inside* the key rather than its own `IDENTITY_VESSEL_URL`
resolves identity against its own loopback. Masked in this cluster because the
fixture sets `IDENTITY_VESSEL_URL` explicitly — which is precisely the variable
docs/SUBSTRATE.md calls an optional override.

### 7.5 The fixture's own key-extraction command was wrong

`docker-compose.cluster.yml`'s header said:

```
export CLUSTER_HUB_KEY="$(docker exec substrate-hub substrate-key show | tail -1)"
```

`tail -1` returned a 32-char string that authenticates nowhere (`401
INVALID_API_KEY`). The real key is the single `mb-…` line on stdout. Fixed in the
fixture. Filed against myself: **the instructions in the test fixture are part of
what is under test.**

### 7.6 Remote deploy paths — audited, deliberately not executed

`deploy-hub.sh`, `deploy-hub-pull.sh`, `deploy-remote.sh` and `spoke-federate.sh`
ship over SSH to the live hub, which holds ~312k executions of history. Running
them is outward-facing and irreversible; **execution requires explicit operator
authorization and was not performed.** Audited by reading. All verified:

| # | Sev | Finding |
|---|---|---|
| F41 | critical | `deploy-remote.sh:71-75` writes peering config **into `/etc/substrate/env` after gen-env ran**. `entrypoint.sh:6-7` regenerates that file on every start and `gen-env.sh:289` truncates it; `/etc` is not a mounted volume. Any restart or reboot **silently un-peers** the substrate. The durable channel (`-e PEER_DISCOVERY_ENDPOINTS`, round-tripped via `.substrate-secrets` at `gen-env.sh:284,574`) exists and is unused. Refines F23: `FEDERATION_SIGNING_SECRET` *is* settable on one path — but only into the regenerated file, so F23's conclusion stands with the premise corrected to "no **durable** launch path". `MAX_PEER_DEPTH` and `FEDERATION_PEER_AUTH_MODE` have no emission site at all. |
| F42 | critical | `deploy-hub-pull.sh:59-122` claims "the exact same flags deploy-hub.sh uses" and **drops `ENABLED_EXTRA_VESSELS`**, masking `goal-host-vessel` and every other `role=compute` unit. A redeployed hub answers no dispatches. |
| F43 | critical | `gen-env.sh:79-83` comments that `ENABLED_EXTRA_VESSELS` "is persisted … so it survives a bare restart/recreate". **Nothing ever writes it** to the secrets store, so `persisted_secret` is unconditionally empty. |
| F44 | critical | `spoke-federate.sh:59-69` pins `FED_SUBSTRATE_ID` / `FED_VESSEL_ID` / `RELAY_MULTIADDR` into the generated env — **erased on next start**, contradicting docs/SUBSTRATE.md:215-219's "auto-generate and persist". |
| F45 | major | `spoke-federate.sh:55-57`'s id-collision guard **fails open**: `POST /resolve` needs auth, and a failed query is indistinguishable from "id free". FEDERATION.md:186 claims the step "refuses ids already present". |
| F46 | major | `deploy-remote.sh:59-63` forwards **only `ANTHROPIC_API_KEY`** — no `ENABLED_ROLES`, no spoke-join variables, no `METABOB_API_KEY`, no other provider. It cannot stand up a hub, though README.md:243 offers it as an alternative for that job. |
| F47 | major | `deploy-remote.sh:29` never passes `PUBLIC_IP`, so even the "recommended" `RUN_RELAY=1` deploy leaves the substrate advertising loopback behind a working relay. |
| F48 | major | `deploy-remote.sh:65` — no step verifies the deploy. Readiness loop has no failure branch; "relay up" prints unconditionally. Success signal is process exit plus one curl on one port. |
| F49 | major | `deploy-remote.sh:59` sets **no restart policy** and runs the relay under bare nohup: one VM reboot leaves a stopped container and no relay, despite the script billing itself as a standing deployment. |
| F50 | major | `deploy-remote.sh:92` unconditionally `pkill`s a running relay — the exact action `deploy-hub.sh`'s own comment forbids as racing :30333 and diverging the peer id. The two scripts also disagree on the relay log path. |
| F51 | major | `deploy-hub.sh:99-106` orders the container creation before the relay exists, so **federation egress is always dead on a first deploy**; the fix is an undocumented second 20-30-minute run. |
| F52 | major | `deploy-hub-pull.sh:128` stops publishing **18090 and 18260** — the two ports `deploy-hub.sh` documents as load-bearing, without which "the spoke's drafter reads no lessons … silently, with no error". |
| F53 | minor | `deploy-hub-pull.sh:191` — `systemctl is-active` under `set -euo pipefail` with no `|| true` aborts the remote heredoc in the **normal** case (hub carries only `ANTHROPIC_API_KEY`). |
| F54 | major | **The "two commands" claim is in `CLAUDE.md:285`, not `docs/SUBSTRATE.md`** (which calls spoke-federate "the NAT return-path step"). Traced through the code it is not two. |

### 7.7 Quickstart clarity

| # | Sev | Finding |
|---|---|---|
| F55 | major | `docker-compose.yml:95` — compose creates **project-prefixed** volumes (`substrate_substrate-workspace`), while `make up` and raw `docker run` use `substrate-workspace`. docs/SUBSTRATE.md:146 and README.md:91 call the three launch paths equivalent; **they do not share state**, so switching paths silently starts from an empty brain. |
| F56 | major | `README.md:83` — the canonical 4-command quickstart **cannot work as pasted**: `substrate-key show` sits on the line after `docker compose up -d`, which returns as soon as the container is created (`start_period: 60s`). |
| F57 | major | `README.md:103` — the only verifier that checks **registration** rather than process liveness is `substrate-doctor`, documented only on the source path, though SUBSTRATE.md:118 confirms it is baked into the image. The container quickstart — the path most operators take — never mentions it. |

### 7.8 Documented-but-dead configuration (extends Part 1)

| # | Sev | Finding |
|---|---|---|
| F58 | major | `MAINTENANCE_LEASE_PATH` (docs/SUBSTRATE.md:580) is **DEAD** — emitted by nothing, set by no unit or drop-in. |
| F59 | major | **Correction to Part 1.** Part 1 said only that the operator's value for the trace-store knobs is discarded. Stronger and unreported: because gen-env writes literals unconditionally, the **"Default" column in docs/SUBSTRATE.md:567-571 is never in force on any deployment** — the documented defaults are unreachable, not merely overridable. |
| F60 | minor | `TRACE_STORE_RESERVOIR_PER_ACTIVITY` (`gen-env.sh:479`) is a third hardcoded knob of the same class. |
| F61 | major | `SUBSTRATE_BIND_HOST` is passed by **both** hub deploy scripts and emitted by gen-env (`:516`) — and **read by nothing**. Its evident intent (bind all interfaces on a public hub) is unimplemented. |
| F62 | minor | docs/SUBSTRATE.md:785's gen-env recovery command names `/scripts/substrate/gen-env.sh`, a path the image does not contain (it installs `/usr/local/bin/gen-env`). |

### 7.9 Human surface docs

| # | Sev | Finding |
|---|---|---|
| F63 | critical | `repos/human-surface-vessel/src/store.ts:17` — the surface's **entire state store is in-memory**; the file says so outright: *"No persistence — a restart clears every store."* docs/HUMAN_SURFACE.md's "Stopping and starting one" names two things that must survive a restart and concludes a surface restarts cleanly. Every human-authored `renderPolicy` and every panel is lost. **Scope caveat, from a conflict between two of this audit's own agents:** `/api/feedback` (`proxy.ts:683`) does not write the array directly — it re-posts a `uiFeedback` impulse to the vessel's **own** `/resolve` on `127.0.0.1:${PORT}`. That round trip stays inside this vessel, so durability still depends on this store, but the claim "uiFeedback vanishes on restart" was **not** independently confirmed and is stated here as unresolved rather than as a finding. |
| F64 | major | The doc never mentions the prose box / `renderPolicy` — the second thing the input surface does — and neither does any other doc. The doc presents "the answer comes back drawn" as a fixed property; the code implements it as **steerable**. |
| F65 | major | `scripts/substrate/Makefile:170` — an explicitly supplied `--hub` port is **stripped by sed and rewritten to 18100**. Stricter than F3: F3 was a *derivation* on hardcoded ports; this discards a value the operator typed in full. |
| F66 | minor | `vessels.inventory.json:49` — the `surface_node` profile is not the roster `ui-only-up.sh` uses: it drops surrealdb and valkey (which that script calls mandatory) and adds a compute unit the script excludes on purpose. |
| F67 | minor | `GOAL_HOST_ENDPOINT`, documented in `proxy.ts:100-112` as the first-precedence operator override, is not emitted by gen-env — **unsettable on any supported deployment**. |
| F68 | major | Comprehension: docs/HUMAN_SURFACE.md:148-167 instructs "Delete the sidecar to accept git" while naming neither the sidecar, the inventory file, the selector, nor the overriding variable. |

### 7.10 Also observed

- **`substrate-live`'s activity-api is down.** `HTTP 000` on `:18080/health` from
  the host *and* on `127.0.0.1:8080` from inside the container, while
  `docker ps` reports the container **healthy** (45h uptime). The compose
  healthcheck targets that exact URL, so the reported health is stale rather than
  current. Operator-relevant now, independent of this audit.
- **The double-arm collision (Part 2) reproduces**: `llm-opus.service` and
  `llm-resolver-opus.service` both exist on the spoke; `llm-google`, `llm-haiku`,
  `llm-opus` and `federation-transport-vessel` sat in `auto-restart`.

### 7.11 Status of Part 3's untested items

| Item | Now |
|---|---|
| Traces land on the hub | **Still untested** — blocked by F39 (read path cannot observe executions that provably exist) and by the dispatch failing before any execution. Not refuted. |
| `make up` from a clean clone | **Not run — deliberately skipped**, because it needs a full local image build on a host already running `substrate-live`. The question "does the documented source path boot from a clean clone?" is therefore still open. F55 answers a *different* question (the launch paths do not share volumes) and does **not** supersede this one. |
| `deploy-hub.sh` / `deploy-remote.sh` | **Audited, not executed** (7.6). Execution needs operator authorization against live infrastructure. 14 verified findings, 4 of them critical. |
| GHCR pull with a fresh PAT | **Blocked on a credential** the operator must mint. Not simulated. |

### Residue

The cluster (`substrate-cluster` project, its four `substrate-cluster_*` volumes,
and network) was torn down with `down -v`. Two synthetic execution rows
(`config-audit-control-probe`, `-2`) and one capability gap filed by the failed
walk died with those volumes. **The real `substrate-workspace` /
`substrate-surreal` volumes were never mounted by this fixture.**
