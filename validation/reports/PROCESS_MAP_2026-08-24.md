# Consolidated process map — substrate super-repo

**This is a dated measurement, not a timeless document.** Every live observation below was taken
in a window of roughly 2026-08-24 21:45 → 22:05 PDT against container `substrate-live`, plus a
verification pass on 2026-08-24/25 against the repository working tree and the remote hub
`syzygy.host`. Container `substrate-live` was SIGKILLed and destroyed by a third party at
2026-08-24 22:04:57 → 22:05:11 PDT, mid-audit. **Every local `verified-live` row therefore
describes a fleet that no longer exists.** The two named volumes
(`substrate-surreal`, `substrate-workspace`) and the image `ghcr.io/avigopal/substrate:dev`
(sha256:d1887a2bbf20, created 2026-08-21T12:17:21Z) survived.

A replacement container was created at 2026-08-24 22:35:49 PDT from the same image, and **§18
re-probes 24 of the highest-stakes live claims against it**, so the load-bearing findings now carry
standing rather than expired evidence. Where §18 disagrees with a status column above, §18 wins.
Claims that depend on counters held in `/run` (notably `NRestarts`) were reset by the rebuild and are
marked UNVERIFIABLE there — **not refuted**.

Nine per-family maps were commissioned and **all nine were delivered**. The original synthesis pass
rendered only five and reported the other four as missing; that was a truncation in the synthesizer,
not a loss of data. The four were recovered intact from the run journal and are rendered at §8–§11.
One residual defect stands: family 5's source record is genuinely truncated (see §17.1). This is
stated up front because silent truncation is the one failure mode this document must not commit.

An adversarial verification pass produced 52 verdicts against these maps. Where a verdict marked a
claim REFUTED or OVERSTATED, the corrected statement is what appears below and the row carries a
`(corrected by verification: …)` note. Original wording is not restated.

---

## 1. How to read this

### Status vocabulary (per step)

| Status | Meaning |
|---|---|
| `verified-live` | Observed by running a command against a running system and reading its output. |
| `verified-live (expired)` | As above, but taken against `substrate-live` — destroyed 2026-08-24 22:05:11 PDT. Valid when taken, **not re-derivable by any successor**. Do not read a future absence as a refutation. |
| `verified-in-code` | Read in source/config at a cited file:line. The mechanism is established; no execution observed. |
| `documented-only` | The evidence is a sentence in a document. Nothing was read in code and nothing was run. |
| `unverifiable-here` | Could not be established from this box under the audit constraints (no second machine, no writes, no dispatch, no hub credential). |
| `known-broken` | The step exists, runs, and does not do what it is for — observed or code-determined. |
| `doc-code-mismatch` | The documentation and the implementation disagree; the row states which one runs. |

### How corrections were applied

- Verdict **CONFIRMED** → map status kept.
- Verdict **REFUTED** or **OVERSTATED** → the row states the corrected claim, its status is set to what
  the verdict's own evidence supports (usually `verified-in-code`), and it is tagged
  `(corrected by verification: …)`.
- Verdict **UNVERIFIABLE** → the claim is kept and annotated `expired`.

### Reading the step tables

Each table row is one action. Where the outcome carries load-bearing nuance it is compressed in the
table and expanded in bullets directly beneath. Every file:line citation from the source maps is
preserved — the citations are the value of this document, not the prose.

### Counts

52 processes · 357 numbered steps (+1 unnumbered verdict-added row) · 76 traps · 46 contradictions
(36 in-family + 4 verdict-added + 6 cross-family) · 52 adversarial verdicts applied.

Post-correction status distribution across the 358 step-table rows:

| Status | Count |
|---|---|
| `verified-in-code` | 191 |
| `verified-live (expired)` — against the destroyed `substrate-live` | 80 |
| `verified-live` — still reproducible (hub-side, host image, host files) | 14 |
| `doc-code-mismatch` | 28 |
| `known-broken` | 25 |
| `documented-only` | 11 |
| `unverifiable-here` | 9 |

Traps by severity: 9 blocker · 30 high · 29 medium · 7 low · 1 severity-unknown (source record truncated).

---

## 2. Index of every process

| # | Family | Process | Trigger | End state | Overall status |
|---|---|---|---|---|---|
| F1-P1 | Bootstrap | Build from source and bring up (`make up`) | Operator with a checkout wants the fleet running | `substrate-live` under systemd, 2 volumes, 9 ports, `~/.metabob/config.json` written | verified-live (expired) + in-code |
| F1-P2 | Bootstrap | Checkout-free bring-up from published image (root compose) | Operator has checkout, does not want to build | Same container/volumes/ports as P1 | verified-in-code |
| F1-P3 | Bootstrap | Checkout-free bring-up with raw `docker run` | Any docker host, no repo | Identical fleet, no make/submodules | verified-live (expired) |
| F1-P4 | Bootstrap | In-container boot, PRE-systemd (entrypoint.sh) | Every container start | env rendered, unit selection applied, arms rendered, systemd PID 1 | verified-live (expired) |
| F1-P5 | Bootstrap | In-container boot, POST-systemd (seeding + readiness) | systemd reaching multi-user.target | multi-user.target, identity seeded, templates registered | verified-live (expired) |
| F1-P6 | Bootstrap | First boot vs subsequent boot | Any container start | Warm boot reuses secrets, keeps volume fleet defs, re-runs enable + seeders | verified-live (expired) |
| F1-P7 | Bootstrap | `make up` against an existing container | Second `make up` on same host | Running unchanged, or refused with a `recreate` instruction | verified-in-code |
| F1-P8 | Bootstrap | `make recreate` | Changed create-time settings | New container, same name/volumes, carried launch identity | verified-in-code |
| F1-P9 | Bootstrap | Stop, clean, teardown | Backup / maintenance / decommission | Drained and/or removed; state kept or deliberately destroyed | verified-in-code |
| F1-P10 | Bootstrap | Auxiliary targets (obsidian, migrate, ui-bridge, clones) | One-off needs | Flavour/migration side effects | verified-in-code |
| F1-P11 | Bootstrap | Verifying a bring-up (the check ladder) | After any bring-up | A defensible statement about usability | verified-live (expired) |
| F2-P1 | Roster | Boot-time roster selection (entrypoint→gen-env→apply-inventory→arms) | Container start | /etc symlink set matching the selection; systemd starts that subset | verified-live (expired) |
| F2-P2 | Roster | Re-apply roster to a RUNNING fleet: `vessel-ctl apply` | Operator/activity after drift or pull-sync | Symlinks AND processes match the selection in force | verified-in-code |
| F2-P3 | Roster | Report roster drift: `vessel-ctl drift` | Investigating roster currency | Three-section report; nothing changed | verified-live (expired) |
| F2-P4 | Roster | Propagate a repo-side roster change (pull-sync) | `substrate-pull-sync.timer`, ~10 min | Tooling + inventory at git HEAD; manifest pinned | known-broken (manifest leg) |
| F2-P5 | Roster | Attach a dynamic vessel: `vessel-ctl install` | Operator / entrypoint spoke branch / activity | Rendered unit in /etc, enabled, started, deps resolved once | verified-in-code |
| F2-P6 | Roster | Detach: `uninstall` / `deregister` | Membership change | Unit gone from /etc and disabled; discovery row removed | verified-in-code |
| F2-P7 | Roster | Update a vessel's code: `vessel-ctl sync` | Operator / pull-sync per-vessel | Live `/vessels/<v>` matches clone HEAD; unit restarted | verified-in-code |
| F2-P8 | Roster | Observe: `list`, `status`, `logs` | Any membership inspection | Unit set, per-unit state, restarts/next-elapse, journal tail | verified-live (expired) |
| F2-P9 | Roster | Act on one unit: `restart`, `start`, `stop` | Operator/activity; masked-unit recovery | One unit in the requested state, with an honest reply | verified-in-code |
| F3-P1 | Human surface | Launch a human surface as a UI-only federated spoke | Operator wants a surface on a new box | Container publishing 9 ports; surface mirrored into hub registry | verified-in-code |
| F3-P2 | Human surface | Update a running surface's UI bundle | Commit lands on human-surface-vessel | Served bundle byte-identical to git | verified-in-code |
| F3-P3 | Human surface | Recreate / stop-start a surface container | Operator maintenance | Container up with identity, secrets, (stop/start only) install intact | documented-only |
| F3-P4 | Human surface | Obsidian intake | `obsidian-intake.timer`, 2 min | Intended: ack in Now.md. Actual: nothing, with a green schedule | known-broken |
| F3-P5 | Human surface | Obsidian learn | `obsidian-learn.timer`, 30 min | learned:0, persisted:0, modeled:0, 2 dead resolvers, 1 live dispatch | known-broken |
| F3-P6 | Human surface | Obsidian collaborate | `obsidian-collaborate.timer`, 45 min | Nothing written; unconditional success line | known-broken |
| F3-P7 | Human surface | In-container Obsidian desktop | Boot of the substrate-obsidian flavour | Obsidian on a virtual display, plugin auto-loaded, noVNC on :16080 | verified-in-code |
| F3-P8 | Human surface | Deploy a substrate-authored plugin change | Manual `obsidian-plugin-reload.sh` | Intended: new command live without a restart | verified-in-code |
| F3-P9 | Human surface | Asking a human a question (human-as-resolver) | Walk exhausts approaches / `resolver:"human"` task | Intended: answer injected as `human_input` and one retry granted | known-broken |
| F4-P1 | Federation | Point-and-go join contract (`GET /bootstrap`) | Any joining party with no RELAY_MULTIADDR | Joiner holds relay + identity + discovery URL, or knows target is not a hub | verified-live |
| F4-P2 | Federation | Hub deploy — `deploy-hub.sh` (clone + build on the VM) | First hub deploy / full rebuild | Public hub, non-empty /bootstrap, relay on :30333, seeded org | verified-in-code |
| F4-P3 | Federation | Hub redeploy — `deploy-hub-pull.sh` (ghcr pull) | After a push publishes `:dev` | Hub on new code, volumes preserved, egress transport if relay found | verified-in-code |
| F4-P4 | Federation | Remote deploy + optional relay + peering — `deploy-remote.sh` | Standing up a peer substrate | Standalone substrate on the VM, optionally relaying and one-way peered | verified-in-code |
| F4-P5 | Federation | Manual hub bring-up (the four-step block) | Hub anywhere deploy-hub.sh does not apply | /bootstrap advertises a live relay; relay unit not crash-looping | known-broken (steps 3–4) |
| F4-P6 | Federation | Federated spoke join (point-and-go `make up`) | Operator on the spoke machine | Spoke registers locally, mirrors into hub, fans out capability queries | verified-in-code |
| F4-P7 | Federation | Pinning a federation id / relay — `spoke-federate.sh` | Auto id/relay not acceptable | Spoke mirrors its registry into the hub under the pinned id | verified-in-code |
| F4-P8 | Federation | Thin spoke (no local registry) | Outbound-only participant wanted | Container with no local registry, resolving on the hub | documented-only |
| F4-P9 | Federation | Peer fan-out (topology 2) — the query-time pull leg | Any /resolve with PEER_DISCOVERY_ENDPOINTS set | Capability queries see local ∪ peer producers, tagged by provenance | known-broken (auth) |
| F4-P10 | Federation | Register-time propagation — the hub mirror | Transport start, then every 120 s | Hub registry carries `<vessel>@<substrate>` rows on a 2-min cadence | verified-in-code |
| F4-P11 | Federation | libp2p ingress sidecar join (NAT'd vessel / Obsidian) | Operator runs the sidecar | NAT'd HTTP vessel appears as a libp2p producer in the hub namespace | verified-in-code |
| F4-P12 | Federation | Relay operation (Circuit Relay v2 + Noise + keep-alive) | Operator on a public-IP host | Public relay holding reservations, stable peer id | verified-in-code |
| F4-P13 | Federation | Hub key issuance (the spoke credential) | Operator on the hub before a join | Spoke holds a hub-issued `METABOB_API_KEY` | verified-live |
| F4-P14 | Federation | End-to-end federation harness | Validating a deployment | Printed `FEDERATION E2E PASS` | verified-in-code |
| F5-P1 | Keys & auth | Bootstrap: where the signing secrets come from | Container start, gen-env before any unit | /etc/substrate/env + /workspace/.substrate-secrets carry the secrets | verified-in-code |
| F5-P2 | Keys & auth | First-boot identity seeding | `identity-seeder.service` once identity answers | org + fleet key + admin key minted; per-vessel keys discarded | verified-live (expired) |
| F5-P3 | Keys & auth | Operator key surface: `substrate-key …` | `docker exec <c> substrate-key <sub>` | Operator can enumerate/mint/revoke with the read+write fleet key | verified-live (expired) |
| F5-P4 | Keys & auth | Service-to-service: the `ApiKey` scheme | Any vessel-to-vessel call; every register/heartbeat | Receiving vessel holds `AuthContext {orgId,userId,keyId,scopes}` | verified-live (expired) |
| F5-P5 | Keys & auth | Browser/dashboard JWT path (`Bearer`) | `/v1/auth/login` or `/v1/jwt/generate` | 900 s HS-signed token whose claims drive PERMISSIONS | verified-in-code |
| F5-P6 | Keys & auth | Revocation and listing | `substrate-key revoke` / direct POST | Key on the valkey denylist and `is_active=false` | known-broken (unauthenticated) |
| F5-P7 | Keys & auth | Cross-substrate validation (C6 issuer delegation) | Any `validateKey()` whose local HMAC fails | Key accepted only by the substrate that signed it; C6 structurally dead | verified-live |
| F5-P8 | Keys & auth | The client config surface | Any host-side tool start | One endpoint + one key; no hub-discovery/git-PAT key in the config | verified-live |
| F5-P9 | Keys & auth | Tenant isolation via SurrealDB PERMISSIONS | Every authenticated query through the authed client | `$token.org_id` tables isolated; `activities.ts` surface is not | doc-code-mismatch |

---


### 2.1 Index — families 6-9 (recovered from the run journal after synthesis truncation)

| Family | Process | Trigger | End state |
|---|---|---|---|
| Family 6 | P1 — push to origin/dev → in-container pull-sync → health-gated restart (the per-vessel loop) | substrate-pull-sync.timer: OnBootSec=3min, OnUnitActiveSec=10min, RandomizedDelaySec=60 (scripts/substrate/units/substrate-pull-sync.timer:5-8). Also  | /vessels/<v> matches the clone at origin/dev, the unit has restarted onto it, /workspace/.last-good/<v> pins the sha, and the tick exits 0. On the liv |
| Family 6 | P2 — shared `file:` package rebuild and fan-out to consumers | Inside P1, immediately after the mirror, when vessel_unit(v) is empty/not a .service AND /vessels/<v>/dist exists AND package.json declares a "build"  | Every consumer's node_modules copy of the shared package is byte-identical to the freshly built dist and has been restarted onto it — verified by md5, |
| Family 6 | P3 — super-repo glue-layer convergence (self-update, units, fleet defs, super-repo-hosted vessels) | Runs at the end of every pull-sync tick, after the vessel loop. | The glue layer (scripts, units, relay, active-scripts) tracks origin/dev; the fleet inventory tracks git; the fleet MANIFEST does not and has not for  |
| Family 6 | P4 — landing a commit through the super-repo pre-commit hook | `git commit` in a clone where `core.hooksPath` points at scripts/git-hooks. | A commit lands on dev with placement, secrets and bundle rules enforced — but ONLY on the operator's own super-repo clone. Every other commit path in  |
| Family 6 | P5 — deploying onto a fresh VM / redeploying the hub | Operator runs `bash scripts/substrate/deploy-remote.sh user@ip` or `bash scripts/substrate/deploy-hub-pull.sh user@ip public-ip`. | A running substrate on the target machine with its learning volumes intact, thereafter self-updating from origin/dev. |
| Family 6 | P6 — host-mediated federation-pull-sync (the superseded docker-cp path) | Operator runs `APPLY=1 bash scripts/substrate/federation-pull-sync.sh --once`. No timer, no unit. | Containers hold the host's source. Not used on this deployment; nothing schedules it. |
| Family 6 | P7 — build preflight and image reproducibility (validate-build) | `make -C scripts/substrate build` (and `up`) depend on it; also called from deploy-hub.sh and ui-only-up.sh. | `make build` proceeds with 0 errors; whatever is checked out is what ships, with drift reported only as warnings. |
| Family 7 | P1 — The canonical cockpit loop (ACT → TRACK → REASON → FEEDBACK) | An agent (Claude Code) has any non-trivial task in this repo. CLAUDE.md:80-96 makes this the default path for everything. | A dispatch exists with a `reached` verdict, its walk reasoning is readable, and an operator verdict is in the oracle corpus. |
| Family 7 | P2 — Code change as a goal: edit-intent → feature_compose → traced commit | A goal whose lead sentence names a real repos/<vessel>/… file (CLAUDE.md:102-105). | A commit authored by the substrate, typecheck-verified, landed on the vessel's dev branch, with a trace. |
| Family 7 | P3 — The PreToolUse vessel-source edit gate | Any Write/Edit/MultiEdit tool call in this project (matcher at .claude/settings.json:42). | Either the edit is denied with routing instructions, or it is allowed (bypass flag, non-vessel path, test path, or dead goal-host). |
| Family 7 | P4 — SessionStart: substrate memory injection | SessionStart. WIRED at .claude/settings.json:9-18. | Session context carries the substrate's memory (and, when the gateway answers, its concept priors). |
| Family 7 | P5 — PostToolUse memoryNote mirror (operator file → substrate) | PostToolUse on Write\|Edit\|MultiEdit. WIRED at .claude/settings.json:29-39. | Intended: every operator memory file has an authoritative substrate twin. Actual: the store is frozen at the Aug 20 mirror plus whatever else wrote it |
| Family 7 | P6 — SessionEnd: memory consolidation dispatch | SessionEnd. WIRED at .claude/settings.json:19-28. | A consolidation goal is running on goal-host (or was coalesced into one already running). |
| Family 7 | P7 — OpenSpec change workflow (propose → apply → archive; explore) | An agent invokes /opsx:propose \| /opsx:apply \| /opsx:archive \| /opsx:explore, or the equivalently-named skill. | Intended: a change dir with proposal/design/tasks, implemented and archived. Actual: nothing past step 1 can run on this box. |
| Family 7 | P8 — Deploy / hot-reload escalation (the deploy skill) | Escalation ladder step 4-5 in .claude/skills/metabob-substrate/SKILL.md:183-189, or the deploy skill directly. | A vessel running the intended source. |
| Family 8 | substrate-doctor.sh — "is this substrate actually alive?" | Operator, by hand: `docker exec substrate-live substrate-doctor` or host-side `scripts/substrate/substrate-doctor.sh`. Also invoked non-optionally by  | Exit 0 with `[doctor] all checks PASS`, or exit 1 with `[doctor] FAILURES detected` on stderr. Note check 6 contributes PASS unconditionally, and chec |
| Family 8 | substrate-ready.sh — the fleet readiness matrix | (a) substrate-ready.service oneshot at boot, (b) the image HEALTHCHECK every 30s, (c) substrate-doctor check 1, (d) `make up` (Makefile:457, with `\|\ | Exit 0 = no unit is `down`. Masked non-core units and skipped units do not affect the exit code. |
| Family 8 | Container HEALTHCHECK — the host-visible readiness signal | dockerd, every 30s, 25s timeout, 240s start period, 3 retries. | docker health status healthy/unhealthy. |
| Family 8 | self-recovery-tick.sh — the immune system | self-recovery.timer — OnBootSec=120s, OnCalendar=*:0/3, Persistent=true. The OnCalendar anchor is deliberate: the comment records the immune system be | Always exit 0. Every outcome is a journal line plus, on escalation, a best-effort gap. |
| Family 8 | watchdog-tick.ts — degraded-mode watchdog for demoted timer units | Four systemd drop-ins override their unit's ExecStart to run watchdog-tick.ts instead of the original tick: gap-compose (STALL_MIN=20), funnel-drain ( | Exit 0 in every path. A fired restart leaves a line in watchdog-log.jsonl and the journal; a silent pass leaves nothing anywhere. |
| Family 8 | failure-mode-harness.ts — CLAUDE.md's named validation instrument | Operator, by hand. NOTHING invokes it: not a unit, not a timer, not the Makefile, not CI. configure-local.sh:95-100 merely prints the command as a sug | A JSON report plus a reuse/new/gap tally. Exit 0 essentially always. |
| Family 8 | validate-build.ts — build preflight (the one check with a blocking call site) | `make build` depends on it (Makefile:341 `build: validate-build`), which `make up` reaches. This is the only member of the family that blocks a real w | Exit 0 and the build proceeds, or exit 1 and `make build` stops before docker. |
| Family 8 | The periodic observer checks (six timer-driven units) | Six systemd timers, all confirmed firing on the live fleet. | Journal lines. Two of the six (trace-store, db-contention) can emit a substrateGap; one (learning-liveness) emits a gap on failure; three cannot emit  |
| Family 8 | Orphaned checks — written, careful, and invoked by nothing | None found. | Two instruments that look like coverage and are not. |
| Family 9 | P1 — Boot-time configuration resolution and delivery (the funnel) | Container start. entrypoint.sh runs as PID 1 before systemd exists. | Each vessel process holds an environment resolved as: unit Environment= < drop-in Environment= < EnvironmentFile=/etc/substrate/env < any later Enviro |
| Family 9 | P2 — Answering "did my value win, and if not what beat it?" | Operator suspects a supplied value did not take effect. | An operator can attribute ~15% of the emitted surface positively; the rest reads `unrecorded`, and three of four channels are outside the instrument's |
| Family 9 | P3 — Re-deriving the surface and regression-guarding it (config-surface-probe) | Documented as a pre-commit check. NOTHING invokes it. | A correct, well-guarded instrument exists and is not wired to anything; the recorded baseline is the standing evidence and it is two days old relative |
| Family 9 | P4 — Post-boot mutation and the persistence round trip | identity-seeder.service after identity-vessel is up; then any subsequent gen-env run. | Both config files carry the identity-issued key; ~20 names survive a recreate; none of them can be cleared through the env channel. |
| Family 9 | P5 — Law-1 violation inventory: behavioural knobs frozen in env or in code | Standing — this is the audit deliverable, not a runtime process. | At least 30 distinct behavioural knobs steer this substrate from outside anything the walk or a trace can observe: ~13 in channel 1 (8 of them PINNED  |

## 3. Family 1 — Bootstrap & local substrate bring-up

11 processes, 77 steps. Live evidence taken 2026-08-24 ~22:00–22:04 PDT against `substrate-live`
(created 2026-08-21T12:23:58Z, last started 2026-08-23T01:00:24Z, RestartCount=0, image
`ghcr.io/avigopal/substrate:dev`). That container was destroyed at 22:05:11 PDT.

### F1-P1 — Build from source and bring up (`make up`, the everyday development path)

**Purpose.** Turn a git checkout into a running single-container substrate fleet, with operator
tooling pointed at it.
**Trigger.** An operator with a checkout who wants the fleet running locally, or who changed vessel
source and wants a fresh image.
**Preconditions.**
- Docker able to run `--privileged` containers (systemd is PID 1 inside) — `Dockerfile.substrate:19-46`, `docs/SUBSTRATE.md:372-374`
- GNU make, git, bun, jq, curl on the **HOST**; bun is needed by `validate-build` before docker is involved — `README.md:433`, `Makefile:328-336`
- Submodules checked out — `Makefile:317-322`
- At least one LLM provider key for a standalone/hub — `Makefile:568-575`, `gen-env.sh:327-340`

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `git clone --recurse-submodules https://github.com/AviGopal/substrate && cd substrate` | `README.md:438-439`; `docs/SUBSTRATE.md:219`; impl `Dockerfile.substrate:64-203` | `repos/*` populated; `.gitmodules` pins by relative URL so a fork resolves | verified-in-code |
| 2 | `make -C scripts/substrate up ANTHROPIC_API_KEY=sk-ant-…` | `README.md:468`; `docs/SUBSTRATE.md:220`; impl `Makefile:440-463` | Drives steps 3–10 | verified-in-code |
| 3 | `@docker image inspect $(IMAGE):$(TAG) >/dev/null 2>&1 \|\| $(MAKE) build` | `README.md:471`; impl `Makefile:441` | Builds only when the **tag is absent**, not when source changed | verified-live |
| 4 | `build: validate-build` → `preflight-submodules` | `Makefile:341`, `:317-322`, `:327-337`, `:341-345` | Fast fail on missing submodules/bun; `--target base` is load-bearing | verified-in-code |
| 5 | container already RUNNING → `[up] already running`, skip creation | `docs/SUBSTRATE.md:258-261`; impl `Makefile:443-444` | Running fleet reused as-is; a freshly pulled image is not booted, no warning | verified-in-code |
| 6 | container EXISTS but stopped → refuse if `$(LAUNCH_OVERRIDES)` non-empty, else `docker start` | `docs/SUBSTRATE.md:541-566`; impl `Makefile:445-452`, `:273` | 17 guarded names; everything else `run-live` passes with `-e` is silently dropped on resume | verified-in-code |
| 7 | else `$(MAKE) run-live` → `docker volume create` + `docker run -d --privileged … -p 18080:8080 … -p 18310:8310` | `docs/SUBSTRATE.md:1270`; `README.md:171-177`; impl `Makefile:567-643`, `:67-74`, `:277-278` | Nine ports published; `LIVE_NAME` renames container **and** both volumes; refuses with no provider key and no spoke signal | verified-live (expired) |
| 8 | `@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-ready.sh --timeout 240 \|\| true` | `README.md:471`; impl `Makefile:456-457`, `substrate-ready.sh:284-316` | Best-effort; `\|\| true` means a timeout never fails this step; needs jq (`:66`) and curl | verified-in-code |
| 9 | `configure-local.sh` (only when `LIVE_NAME = substrate-live`) | `README.md:471`; impl `Makefile:458-462`, `configure-local.sh:16,33-37,41-50,55,73-87` | Writes `~/.metabob/config.json` with endpoint **hardcoded** to `http://localhost:18080`; output discarded | verified-in-code |
| 10 | `@CONTAINER=$(LIVE_NAME) $(CURDIR)/substrate-doctor.sh` | `README.md:492-498`; impl `Makefile:463` | Runs checks 1–7 including a real LLM completion per arm. **Does not dispatch a goal.** `make up` exits non-zero if any check fails | verified-in-code |

- **Step 3 evidence.** `docker image inspect ghcr.io/avigopal/substrate:dev` → sha256:d1887a2bbf20…, created
  2026-08-21T12:17:21Z. Re-confirmed post-destruction: the image is still on this host and predates HEAD, so
  `make up` here today would still skip the build. `REBUILD=1` (`Makefile:442`) or `TAG=<name>` forces a real build.
- **Step 6 guarded names.** `API_KEY, METABOB_API_KEY, DISCOVERY_ENDPOINT, HUB_DISCOVERY_URL, FED_SUBSTRATE_ID,
  RELAY_MULTIADDR, ENABLED_ROLES, ENABLED_VESSELS, DISABLED_VESSELS, PEER_DISCOVERY_ENDPOINTS,
  ACTIVITY_API_ENDPOINT, IDENTITY_VESSEL_URL, IDENTITY_ENDPOINT, SURREALDB_URL, REDIS_URL, PROFILE,
  ENABLED_EXTRA_VESSELS`, plus `PORT_OFFSET/TAG/ANTHROPIC_API_KEY` only when supplied on the command line
  (`_cli`, `Makefile:271`).
- **Step 7 evidence (expired).** `docker port substrate-live` returned exactly nine container ports mapped to
  18080/18090/18100/18101/18210/18250/18260/18270/18310; `docker inspect … .Mounts` → `substrate-surreal`→
  `/var/lib/surrealdb`, `substrate-workspace`→`/workspace`.
- **Step 9 hazard.** It hardcodes the port, so a `substrate-live` created with `PORT_OFFSET≠0` gets a config
  pointing at a port nothing serves. A failure prints only `[up] configure-local skipped`.
- **Step 10 (corrected by verification: the map claimed doctor also dispatches a goal end-to-end and used that
  to justify never running it).** `substrate-doctor.sh:21-22` sets `SMOKE=0` and only `--smoke` sets it to 1;
  the goal POST to `:8210/run-goal` sits at `:288`, inside the `if [ "$SMOKE" = 1 ]` guard at `:286`.
  `Makefile:463` invokes doctor with **no arguments**, so `make up` never dispatches a goal. Consequence: a
  green `make up` does not prove end-to-end goal execution — that needs
  `docker exec <c> substrate-doctor --smoke`. The LLM-arm probe (check 7, `substrate-doctor.sh:255-284`) *is*
  unconditional and does POST a real 16-token completion to :8221/:8223/:8225. The cited sources do not support
  the original claim either: `docs/SUBSTRATE.md:911` says only "whether an LLM arm can actually complete", and
  the phrase "also dispatches a goal end-to-end" occurs exactly once tree-wide — at `Makefile:562`, a **stale
  comment** (filed as a new contradiction in §6).

**End state.** A `substrate-live` container running the full fleet under systemd, two named volumes holding all
learning state, nine host ports serving, and `~/.metabob/config.json` pointed at `http://localhost:18080`.

**How to verify it actually worked.** `docker exec <c> substrate-key whoami` reporting `"valid": true` plus an
`org_id` — the only signal that identity actually seeded; `healthy` and `substrate-key show` both lie
(`README.md:117-133`, `docs/SUBSTRATE.md:1408`). Then `curl /health` on each of the nine ports.

---

### F1-P2 — Checkout-free bring-up from the published image (root docker-compose)

**Purpose.** Run the fleet from a pulled image with no submodules and no build.
**Trigger.** An operator who has a checkout (for the compose file and `.env.example`) but does not want to build.
**Preconditions.** Docker + docker compose, `--privileged` permitted; a checkout of the repo root
(`docs/SUBSTRATE.md:265-269`); one LLM provider key in `.env`.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `git clone https://github.com/AviGopal/substrate.git && cd substrate` | `README.md:101` | Repo root available; submodules **not** needed — a pulled image contains vessel source (`README.md:72`) | verified-in-code |
| 2 | `cp -n scripts/substrate/.env.example .env` | `README.md:104-105`; `.env.example` tier headers at 25, 44, 71, 104, 138, 182, 200, 210, 227 | `-n` is silent when it skips, so another fleet's `.env` is kept with no notice | verified-in-code |
| 3 | `$EDITOR .env` — set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) | `README.md:106`; impl `docker-compose.yml:37`, `:32-36` | Deliberately not `:?` (a spoke legitimately has none); gen-env enforces later (`gen-env.sh:327-340`) | verified-in-code |
| 4 | `docker compose pull` | `README.md:107`; impl `docker-compose.yml:25` | Fetches the current tag; GHCR package is public, no login | unverifiable-here |
| 5 | `docker compose up -d` (from the repo **ROOT**; `scripts/substrate/docker-compose.yml` is a symlink) | `README.md:108`; `docs/SUBSTRATE.md:271-272`; impl `docker-compose.yml:23-144`, `:146-166` | Creates `${SUBSTRATE_CONTAINER:-substrate-live}`, privileged, `SIGRTMIN+3`, 30 s grace, nine ports, **explicitly named volumes** → adopts existing learning state | verified-in-code |
| 6 | `sleep 15; docker ps --filter "name=$SUB" --format '{{.Status}}'` → if `Restarting`, `docker logs --tail 20 $SUB` | `README.md:110-116`; impl `docker-compose.yml:30` | `up -d` prints "Started" and exits 0 even when the container dies immediately | verified-in-code |
| 7 | bounded loop: `docker exec $SUB substrate-key whoami \| grep -q '"valid": *true'` (30 × 10 s) | `README.md:126-132`; impl `identity-seeder.service TimeoutStartSec=300` | `healthy` does not mean identity seeded; pre-seed `substrate-key show` prints a placeholder that 401s and exits 0 | verified-in-code |
| 8 | `docker exec substrate-live vessel-ctl install human-surface-vessel` (only if you want :18310 to answer) | `README.md:184-189`; `docs/SUBSTRATE.md:131-141`; impl `vessels.inventory.json:178-182` (`"manifest": true`) | A default boot **publishes :18310 with nothing listening** — connection-refused while every other health signal is green | verified-in-code |

- **Step 8 (corrected by verification: the map marked this `verified-live`, but its own probe measured the
  negation).** On the audited fleet the vessel **had** been installed and `/health` returned 200; that
  establishes the install path, not the default-boot state. The dark-port behaviour rests on
  `vessels.inventory.json:178-182` (`role: ui`, `manifest: true`) plus the inventory's own `_profiles_comment`
  at `:38`: "it is a manifest vessel, which apply-inventory never selects or masks, and vessel-ctl installs it
  after readiness." `docker-compose.yml:120-126` publishes the port on the compose lane too, with a comment
  recording that it previously was not.

**End state.** Same container, same volumes, same nine ports as the make lane — one image, one artifact.

**How to verify it actually worked.** `docker exec substrate-live substrate-key whoami` → `valid:true`; then
`curl :18100/health`. Note the compose file **overrides** the image HEALTHCHECK with a single curl on
discovery-vessel :8100 (`docker-compose.yml:133-144`), deliberately, because activity-api carries role `api`
which the spoke group excludes — so on this lane `healthy` means one vessel answered.

---

### F1-P3 — Checkout-free bring-up with raw `docker run` (no repo at all)

**Purpose.** Boot the fleet on any docker host with nothing but the image and one env var — the launch contract
every other lane wraps.
**Trigger.** A host with Docker and no checkout.
**Preconditions.** Docker with Linux x86_64 semantics and `--privileged`.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `docker run -d --privileged --name substrate-live -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb -e ANTHROPIC_API_KEY=… -p 18080:8080 … -p 18310:8310 --tmpfs /run --tmpfs /run/lock ghcr.io/avigopal/substrate:dev` | `README.md:171-177`; `docs/SUBSTRATE.md:326-331`; impl `Dockerfile.substrate:359,361,366-367,369` | Nine ports; **unprefixed** volume names, so this joins the `make up` fleet's state (`docs/SUBSTRATE.md:334-335`) | verified-in-code |
| 2 | (implicit) `ENTRYPOINT /usr/local/bin/substrate-entrypoint` | `Dockerfile.substrate:369`; impl `entrypoint.sh` (see F1-P4) | All load-bearing work happens **inside** the container; no host step is load-bearing (`Makefile:423-434`) | verified-live (expired) |
| 3 | `docker inspect --format '{{.State.Health.Status}}' substrate-live` | `docs/SUBSTRATE.md:250,302-304`; impl `Dockerfile.substrate:366-367`, `substrate-ready.sh:276-283` | Core-only liveness; `--quick` keeps a **single pass**, so it structurally cannot see a restart loop | verified-live (expired) |
| 4 | `docker exec substrate-live substrate-key show / whoami` | `README.md:216-221`; `docs/SUBSTRATE.md:660-668`; impl `Dockerfile.substrate:249` | Baked into the image. `show` does not validate; `whoami` does | verified-in-code |

- **Step 3 evidence (expired).** `docker inspect substrate-live --format '{{json .Config.Healthcheck}}'` →
  `{"Test":["CMD-SHELL","/usr/local/bin/substrate-ready --quick >/dev/null 2>&1 || exit 1"],"Interval":30s,
  "Timeout":25s,"StartPeriod":240s,"Retries":3}`; `State.Health.Status = healthy`.

**End state.** An identical fleet to P1/P2, produced with no repo, no make, no submodules.
**How to verify it actually worked.** `substrate-key whoami` returns `valid:true`; then curl each published
port's `/health`.

---

### F1-P4 — In-container boot, PRE-systemd (`entrypoint.sh`), in order

**Purpose.** Render the runtime environment, choose which units exist, and render the LLM arms — all before
systemd is PID 1, because none of it can be done by a unit.
**Trigger.** Every container start (both `docker run` create and `docker start` resume).
**Preconditions.** `/workspace` and `/var/lib/surrealdb` mounted; container env carrying whatever the launch
lane passed.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `/usr/local/bin/gen-env` | `entrypoint.sh:6-7`; impl `gen-env.sh:1-1059` | Writes `/etc/substrate/env` (chmod 600, `:803`), `llm-{opus,haiku,google}.env` (`:826-829`), `/workspace/.substrate-secrets` (`:1024-1025`), `env.provenance` (`:1035-1058`) | verified-live (expired) |
| 2 | (within gen-env) spoke discrimination, then two fail-CLOSED guards | `gen-env.sh:15-48`, `:234-254`, `:187-212`; impl `:33-40`, `:247-254`, `:203-207` | A spoke with a hub set but no hub-issued key refuses to boot; an existing datastore with no persisted `API_KEY_SECRET` refuses rather than falling back to the public literal | verified-in-code |
| 3 | (within gen-env) secret resolution: explicit env > persisted > fresh random, **per field** | `docs/SUBSTRATE.md:620-635`; impl `gen-env.sh:126-133,135-170,302-313,345-348` | Independent fallback per secret; LLM-key guard deliberately deferred to after these fallbacks (`:315-340`) | verified-live (expired) |
| 4 | (within gen-env) emit the fixed heredoc — gen-env is an **ALLOWLIST** and pins ~17 names as literals | `docs/SUBSTRATE.md:1176-1185`; impl `gen-env.sh:494-504`, heredoc `:536-801`, passthrough `:841-867` | 17 names accepted by docker, reaching the process, then overwritten. A stderr notice is the only signal | verified-live (expired) |
| 5 | (within gen-env) round-trip check: `env -i sh -c 'set -a; . /etc/substrate/env'` + JSON parse of `VLLM_ENDPOINTS` and `LLM_ARMS` | `gen-env.sh:805-816,869-905`; impl `:889-905` | Reads the **emitted file** only — a generation-time error is invisible to it. `LLM_ARMS` is escaped (`:534`) and checked (`:896`) but never emitted | verified-live (expired) |
| 6 | seed fleet definitions into the VOLUME: copy `vessels.inventory.json` / `vessels.manifest.json` from `/usr/local/share/substrate` **only if absent** | `docs/SUBSTRATE.md:94-107`; impl `entrypoint.sh:13-20` | First boot seeds; later boots keep the volume copy authoritative and substrate-writable | verified-live (expired) |
| 7 | `set -a; . /etc/substrate/env; /usr/local/bin/apply-inventory` | `docs/SUBSTRATE.md:75-92`; impl `entrypoint.sh:24-52`, `apply-inventory.sh:55-58,145-162,171-201` | Precedence PROFILE > ENABLED_VESSELS > ENABLED_ROLES, + EXTRA, − DISABLED. Unknown tokens FATAL. No-selection branch **falls through** to the unmask and enable passes | verified-live (expired) |
| 8 | fail-CLOSED on a selection that cannot be applied; fail-OPEN only when nothing was asked for | `docs/SUBSTRATE.md:88-92`; impl `entrypoint.sh:43-51` | `ENABLED_ROLES=spok` aborts the boot instead of starting the full baked fleet | verified-in-code |
| 9 | if `HUB_DISCOVERY_URL` set: `vessel-ctl install federation-transport-vessel` + write an offline wants-symlink | `docs/SUBSTRATE.md:455-461`; `README.md:239-254`; impl `entrypoint.sh:61-72` | `systemctl enable --now` is a no-op pre-systemd, hence the hand-written symlink. Spoke-only | verified-in-code |
| 10 | locate and run `apply-llm-arms` (three candidate paths), fail-open | `docs/SUBSTRATE.md:159-198`; impl `entrypoint.sh:89-99`, `render-llm-arms.sh`, `llm-arms.json` | One `llm-<id>.service` + env file per arm, each with an `ExecCondition` on the provider key. A renderer problem never blocks boot | verified-live (expired) |
| 11 | `exec /lib/systemd/systemd` | `entrypoint.sh:101-102` | systemd becomes PID 1. Nothing in the container env reaches a vessel except through `/etc/substrate/env` | verified-live (expired) |

- **Step 1 (corrected by verification: the map said "every unit carries EnvironmentFile and NONE carries
  PassEnvironment").** `ls scripts/substrate/units/*.service | wc -l` → 62 (+33 `.timer`). **57 of 62** carry
  `EnvironmentFile=…/etc/substrate/env`; five do not — `journald-stdout-forwarder`, `light-dispatch-healthcheck`,
  `novnc`, `obsidian-xorg`, `valkey` — all non-vessel infrastructure, for which the isolation is *stronger*, not
  weaker. `rg PassEnvironment scripts/substrate/units/` → none; `rg DefaultEnvironment` → none. The conclusion
  survives on the systemd contract itself (`systemd.exec(5)`, PassEnvironment: "system services by default do not
  automatically inherit any environment variables set for the service manager itself"). Related: per the same man
  page, "Settings from these files override settings made with `Environment=`" — so unit-level `Environment=`
  lines (e.g. `development-vessel.service:19 Environment=MITOSIS_DIRECT_PUSH=1`) are **defaults that
  `/etc/substrate/env` outranks**, not overrides of it.
- **Step 1 evidence (expired).** Boot log: `generating /etc/substrate/env` → `wrote /etc/substrate/env` → `wrote
  per-model llm-resolver env files (opus, haiku, google)` → `persisted secrets` → `wrote provenance`.
  `/etc/substrate/env` had 257 non-blank lines ending in `OBSIDIAN_PLUGIN_ENDPOINT=http://127.0.0.1:27182`.
- **Step 3 evidence (expired).** `env.provenance` read live: `ANTHROPIC_API_KEY=env`; `API_KEY_SECRET,
  JWT_SECRET, SURREAL_PASS, METABOB_API_KEY, FED_SUBSTRATE_ID, SUBSTRATE_ADMIN_KEY, SUBSTRATE_GIT_PAT,
  OPENROUTER_API_KEY, PEER_DISCOVERY_ENDPOINTS, FEDERATION_* = persisted`. Nothing `generated` — a warm boot.
- **Step 4 pinned list (verified in code, re-read).** The `for _pinned in \` loop begins at `gen-env.sh:494` and
  closes at `:504`, listing exactly `RATE_LIMIT_ALLOWLIST_IPS`, `SURREALDB_{NAMESPACE,DATABASE,USERNAME}`,
  `EMBEDDING_MODEL_DIR`, `EMBEDDING_PRIOR_{ENABLED,OBSERVER_ENABLED}`,
  `TRACE_RETENTION_{ENABLED,DRY_RUN,DEFAULT_SUCCESS_CAP,DEFAULT_FAILURE_CAP,GLOBAL_CEILING_ENABLED}`,
  `TRACE_STORE_CAP`, `TRACE_STORE_HOT_WINDOW_DAYS`, `TRACE_STORE_RESERVOIR_PER_ACTIVITY`,
  `OBSIDIAN_PLUGIN_ENDPOINT` — 17 names, each emitting `[gen-env] NOTE: $_pinned is pinned …` to **stderr only**.
  `gen-env.sh:743` is a bare literal `TRACE_STORE_CAP=150000` with no `${…:-}` expansion.
- **Step 5 (confirmed).** `rg LLM_ARMS scripts/substrate/gen-env.sh` returns exactly three hits — `:113`
  (persist-list membership), `:534` (escape), `:896` (the round-trip loop). The heredoc `:536-801` contains no
  `LLM_ARMS` line, so half the check can never fire. Live: `grep -c '^LLM_ARMS=' /etc/substrate/env` → 0.
- **Step 6 evidence (expired).** `ls -la /workspace/substrate/fleet/` → `vessels.inventory.json` (15810 B, uid
  1000, Aug 21 12:09), `vessels.manifest.json`, plus `.converged` shadows and two dated `.bak` files.
- **Step 7 evidence (expired).** Boot log: `no ENABLED_ROLES/ENABLED_VESSELS/DISABLED_VESSELS set — all units
  enabled (default)` followed by 17 `enabled: <unit> (was never enabled — new unit)` lines incl.
  `development-vessel-seed.service` and 13 timers, then `done — 0 unit(s) disabled`.
- **Step 9.** Not exercised — the live container was a standalone (`HUB_DISCOVERY_URL` empty; `/bootstrap`
  answered `relay_multiaddrs: []`).
- **Step 10 evidence (expired).** `rendered arm 'opus' -> llm-opus.service (port 8221, gated on
  ANTHROPIC_API_KEY)`, same for haiku (8223) and google (8225, gated on `GOOGLE_API_KEY`); `3 arm(s) processed`;
  then `[arms] enabled llm-google.service / llm-haiku.service / llm-opus.service`.

**End state.** `/etc/substrate/env` rendered, fleet files present on the volume, unit selection applied, LLM arms
rendered and enabled, systemd running as PID 1.
**How to verify it actually worked.** `docker exec <c> substrate-config` (every resolved value **and** its
provenance) plus `docker logs <c> | head -40` for the entrypoint's own trace of the six phases.

---

### F1-P5 — In-container boot, POST-systemd: the seeding and readiness chain

**Purpose.** Bring datastore, control plane, vessels and seeders up in a dependency order that converges without
an operator, and turn "the fleet is up" into a systemd fact.
**Trigger.** systemd reaching `multi-user.target` after entrypoint's `exec`.
**Preconditions.** `/etc/substrate/env` present; `apply-inventory` has decided the unit set.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `surrealdb.service` — `surreal start --bind 127.0.0.1:8000 --user root --pass ${SURREAL_PASS} file:/var/lib/surrealdb/data.db` | `docs/SUBSTRATE.md:1086-1088`; impl `units/surrealdb.service` | Datastore on the named volume. A fresh `SURREAL_PASS` against an existing `data.db` fails auth for every vessel; gen-env warns (`gen-env.sh:171-179`) and boots anyway | verified-live (expired) |
| 2 | `valkey`, `discovery-vessel`, `identity-vessel`, `activity-api` and the vessel units start (baked-enabled at build) | `docs/SUBSTRATE.md:610`; `README.md:617-626`; impl `Dockerfile.substrate:307-349` (37 units) | Each binds its 8xxx port and registers. Registration **order is irrelevant** — goal-host subscribes to `vessel.registered` (`docs/SUBSTRATE.md:1360-1364`) | verified-live (expired) |
| 3 | `git-push-setup.service` (oneshot, `After=network-online.target`, `Before=development-vessel.service`) → `setup-git-push` | `docs/SUBSTRATE.md:360-368`; impl `units/git-push-setup.service` | Sets git identity + credential helper, clones repos into `/workspace/git`. Without a PAT, falls back to the image-baked read-only snapshot (`Dockerfile.substrate:276-282`) | verified-live (expired) |
| 4 | `substrate-active-scripts-seed.service` (oneshot, `DefaultDependencies=no`) → copy tick `.ts` into `/workspace/active-scripts` | `units/substrate-active-scripts-seed.service` | Re-seeds the writable run-dir from committed source; substrate-authored deltas accumulate on the volume | verified-live (expired) |
| 5 | `identity-seeder.service` — ExecCondition, ExecStartPre polls `:8101/health` ≤120 s, ExecStart `reseed-restart`, `TimeoutStartSec=300` | `docs/SUBSTRATE.md:246-249`; impl `units/identity-seeder.service`, `seed-identity.ts:1-3` | Mints org + operator key on first boot and rewrites `METABOB_API_KEY`; restarts consumers only when the key changed. Idempotent (409-skips) | verified-live (expired) |
| 6 | `bootstrap-seeder.service` — `After=identity-seeder activity-api`; **Type=simple**; `Restart=on-failure RestartSec=20 StartLimitBurst=10` | `docs/SUBSTRATE.md:1410`; impl `units/bootstrap-seeder.service`, `scripts/bootstrap-seeder.ts:20,39-51` | Registers shared activity templates idempotently. Type=simple is deliberate — as oneshot it held `multi-user.target` up to ten minutes on a spoke | verified-live (expired) |
| 7 | `concept-db-seeder.service` — `After=identity-seeder concept-db`, polls `:8260/health` ≤120 s, `bun /vessels/seed-concepts.ts` | `docs/SUBSTRATE.md:1086-1088`; impl `units/concept-db-seeder.service`, `seed-concepts.ts:1-11` | Seeds the 24 Phase-22.S2 concepts; `Restart=on-failure RestartSec=20` converges past the boot race | verified-live (expired) |
| 8 | `development-vessel-seed.service` — Type=simple, waits `${METABOB_ENDPOINT}/health` (15×3 s), then `bun src/cli.ts seed-templates`, `TimeoutStartSec=600`, `Restart=no` | `docs/SUBSTRATE.md:1332` (stale — see §6); impl `units/development-vessel-seed.service` | ~98 template uploads run alongside the fleet instead of holding the target. Waits on the **configured** trace store, not hardcoded loopback | verified-live (expired) |
| 9 | `substrate-ready.service` — `substrate-ready --services-only --timeout 240 \|\| echo …`, `TimeoutStartSec=300` | `docs/SUBSTRATE.md:246-251`; impl `units/substrate-ready.service`, `substrate-ready.sh:145-250,284-316` | Readiness becomes a systemd fact others can order `After=`. Exits 0 even on timeout. `--services-only` avoids a circular wait on ready-gated timers | verified-live (expired) |
| 10 | Docker HEALTHCHECK begins after a 240 s start-period: `substrate-ready --quick` | `Dockerfile.substrate:366-367`; impl `substrate-ready.sh:259,273-283` | Host-visible liveness. Core-only, single-pass, counts a **masked core unit as `down`** on a standalone (`substrate-ready.sh:170-175`) | verified-live (expired) |

- **Step 1 evidence (expired).** `systemctl show surrealdb.service -p ActiveState -p Result -p NRestarts` →
  `active / success / NRestarts=7`. Active with seven lifetime restarts — the reason readiness tooling reads
  `NRestarts` rather than `is-active`. **This row is UNVERIFIABLE going forward:** systemd counters live in
  `/run` (a tmpfs), so nothing survived the container's destruction.
- **Step 5 evidence (expired).** `journalctl -u identity-seeder`: five failed attempts against a cold DB
  (`signup failed 500: {"error":"PERSIST_FAILED"…}`), `attempt 5 failed — retrying in 6s`, `restarting
  identity-vessel (known no-reconnect defect) before further retries`, then `substrate org already exists —
  verifying the fleet's key still authenticates` / `existing key authenticates` / `key unchanged — no restarts
  needed` / `Finished identity-seeder.service`. Both the self-heal loop and warm-boot idempotency in one journal.
- **Step 6 evidence (expired).** `[bootstrap-seeder] Seeding complete: 19/19 templates seeded.` then
  `Deactivated successfully.` `ActiveState=inactive, Result=success, NRestarts=0`.
- **Step 9 evidence (expired).** A full per-unit matrix (rows reading `skipped` for every ExecCondition-declined
  timer service) ending `[ready] fleet ready` / `Finished substrate-ready.service`.

**End state.** `multi-user.target` reached, `systemctl is-system-running` = `running`, no failed units, all nine
ports serving 200, identity seeded and templates registered.
**How to verify it actually worked.** `docker exec <c> systemctl --failed --no-legend` empty **and**
`systemctl is-system-running` = `running` **and** `substrate-key whoami` valid. (Live at 22:03 PDT: `--failed`
empty, `is-system-running` = running, all nine ports 200, `activity-api GET /` returned 404 — it is an
authenticated JSON API, not a web page, `README.md:208-209`.)

---

### F1-P6 — First boot vs subsequent boot: what actually differs

**Purpose.** Distinguish once-only work from every-boot work, because most "it worked yesterday" bring-up
failures live in this seam.
**Trigger.** Any container start. The branch is taken **per artifact**, not per container.
**Preconditions.** The two named volumes are the only carriers of first-boot state.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Fleet definition files copied from the image **only if absent** from the volume | `docs/SUBSTRATE.md:104-107`; impl `entrypoint.sh:15-20` (`if [ ! -f "$FLEET_DIR/$f" ]`) | First boot seeds; later boots keep the volume copy. A committed inventory change reaches the volume via pull-sync but sits **INERT** until the next container restart | verified-live (expired) |
| 2 | Secrets minted on first boot, read back on every later boot | `docs/SUBSTRATE.md:620-635`; impl `gen-env.sh:126-133,147-149,210,256-259` | Provenance reads `generated` on a first boot and `persisted` on a warm one — the only reliable after-the-fact discriminator | verified-live (expired) |
| 3 | The secrets file is **MERGED**, not overwritten | `gen-env.sh:907-926`; impl `:938-994`, `:1000-1019`, `:1021-1025` | A secret written by a different revision survives; one generation of history at `/workspace/.substrate-secrets.prev` | verified-live (expired) |
| 4 | `identity-seeder` mints on first boot, 409-skips afterwards and restarts nothing | `docs/SUBSTRATE.md:246-249`; impl `seed-identity.ts:1-3`, `reseed-restart.sh` | Warm boots are cheap and non-disruptive | verified-live (expired) |
| 5 | `apply-inventory`'s ENABLE pass runs on **every** boot, not only the first | `apply-inventory.sh:40-54`; impl `:55-58` (log only, then fall through) | Units added after the image's enable symlinks were baked get enabled later; masks from a previous narrower selection get cleared | verified-live (expired) |
| 6 | The in-image fleet **TOOLING** changes between boots — `substrate-pull-sync` converges `/usr/local/bin` from `origin/dev` | `docs/SUBSTRATE.md:918`; impl `substrate-pull-sync.sh`, `units/substrate-pull-sync.timer` | "What the image does" and "what this container will do next boot" are different questions | verified-live (expired) |

- **Step 3 evidence (expired).** Key **names** read from `/workspace/.substrate-secrets` (no values):
  `JWT_SECRET, SURREAL_PASS, API_KEY_SECRET, FED_SUBSTRATE_ID, METABOB_API_KEY, SUBSTRATE_ADMIN_KEY,
  SUBSTRATE_GIT_PAT, API_KEY_SECRET_PREVIOUS, GITHUB_TOKEN, LLM_DEFAULT_MODEL, ENABLED_EXTRA_VESSELS`, the 8
  provider keys, `RUNPOD_*`, `VLLM_*`, `PEER_DISCOVERY_ENDPOINTS`, `MAX_PEER_DEPTH`,
  `FEDERATION_PEER_AUTH_MODE`, `FEDERATION_SIGNING_SECRET`. Rationale: a bare overwrite took the hub down on
  2026-08-08 by dropping `API_KEY_SECRET`.
- **Step 5 evidence (expired).** Boot 1 (2026-08-21) enabled 17 previously-unknown units incl.
  `development-vessel-seed.service` and 13 timers; boot 2 (2026-08-23) enabled none.
- **Step 6 evidence (expired), two independent proofs.** (a) apply-inventory: boot 1 warned `unmanaged:
  human-surface-vessel.service` + `metric-collector-vessel.service`; boot 2 warned only about metric-collector —
  the human-surface false positive was fixed between the boots and the converged copy ran. (b)
  `md5sum /usr/local/bin/gen-env` inside the container equalled `md5sum scripts/substrate/gen-env.sh` in the
  working tree (`0d11605ed7020b155f499bfccebbad26`).

**End state.** A warm boot reuses every secret, keeps the volume's fleet definition, re-runs the enable/unmask
passes, and re-runs every seeder idempotently.
**How to verify it actually worked.** `docker exec <c> substrate-config` — a value marked `persisted` came from a
**previous** boot and is still in force, which is why a freshly supplied key can appear not to take
(`docs/SUBSTRATE.md:939-947`).

---

### F1-P7 — `make up` against a container that already exists

**Purpose.** Resume or refuse, without silently discarding create-time settings.
**Trigger.** Running `make up` a second time on the same host.
**Preconditions.** A container named `$(LIVE_NAME)` exists.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `docker ps --format '{{.Names}}' \| grep -qx "$(LIVE_NAME)"` → `[up] <name> already running` | `docs/SUBSTRATE.md:258-261`; impl `Makefile:443-444` | **BRANCH A:** nothing created, nothing restarted, no image check repeated. A newer `:dev` pulled since is not booted | verified-in-code |
| 2 | exists + `$(LAUNCH_OVERRIDES)` non-empty → ERROR + `recreate` instruction; exit 1 | `docs/SUBSTRATE.md:541-551`; impl `Makefile:445-451` | **BRANCH B:** refuses rather than accepting a setting `docker start` cannot apply | verified-in-code |
| 3 | else `docker start $(LIVE_NAME)` | `docs/SUBSTRATE.md:1125-1135`; impl `Makefile:452` | **BRANCH C:** resume carries **nothing** — image, ports and env are whatever the container was CREATED with. The entrypoint re-runs in full | verified-live (expired) |
| 4 | (consequence) settings added to `run-live`'s `-e` list **after** a container was created never reach it | `docs/SUBSTRATE.md:560-566`; impl `Makefile:578-625` | A resumed container's env is frozen at creation. Only `recreate` applies new names | verified-live (expired) |
| 5 | After the branch: readiness wait → `configure-local` (substrate-live only) → doctor, unconditionally | `README.md:471`; impl `Makefile:456-463` | Runs on all three branches, including "already running" | verified-in-code |

- **Step 4 (CONFIRMED, and now datable without the fleet).** `git log -S'MITOSIS_DIRECT_PUSH' -- Makefile` →
  a single commit `42302670 2026-08-23 02:59:20 -0700 fix(selection): the two kill switches reach the fleet, and
  bare vessel names resolve`; identical single-commit results for `ROUTE_EDIT_INTENT_TO_COMPOSE`, `PUBLIC_IP`,
  `API_KEY_SECRET_PREVIOUS`, `VLLM_BASE_URL`. The container was created 2026-08-21T12:23:58Z and last started
  2026-08-23T01:00:24Z — both **precede** that commit. Because `Makefile:618` emits
  `-e MITOSIS_DIRECT_PUSH="$(MITOSIS_DIRECT_PUSH)"` — which writes the NAME into `Config.Env` even when empty —
  a missing name proves the flag was absent at create time. The audited fleet had **no delivery path for the
  documented autonomy kill switch**.

**End state.** Either the fleet is running unchanged, or `up` refused with a `recreate` instruction.
**How to verify it actually worked.** `docker exec <c> substrate-config` for values actually in force;
`docker inspect <c> --format '{{.Created}} {{.State.StartedAt}}'` to distinguish a create from a resume.

---

### F1-P8 — `make recreate`: replace the container, keep the volumes, carry the identity forward

**Purpose.** Apply changed create-time settings (roles, hub, ports, keys) without destroying learning state.
**Trigger.** `up` refused, or a documented setting change.
**Preconditions.** The container exists (else `recreate` degrades to a plain `up` — `Makefile:556-557`).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `ENVDUMP=$(docker inspect $(LIVE_NAME) --format '{{range .Config.Env}}…')` | `Makefile:467-493`; impl `:519` | The old container's launch identity is read **before** it is removed | verified-in-code |
| 2 | Carry `RECREATE_CARRY` by **VALUE**: command line wins, else old value, else drop | `Makefile:487-493`; impl `:494-498` (17 names), loop `:521-529` | Derived from ONE list so it cannot drift from `LAUNCH_OVERRIDES`. Secrets shown as `<set>` | verified-in-code |
| 3 | Carry `RECREATE_CARRY_PRESENT` by **PRESENCE**: an empty value that existed is carried as empty | `Makefile:500-512`; impl `:513-515` (10 provider names), loop `:530-539` | A deliberately keyless fleet stays keyless. Rationale recorded: a UI-only spoke's `ANTHROPIC_API_KEY=""` was refilled from `~/.metabob/config.json`, len 0 → 108 | verified-in-code |
| 4 | Read the previous host port for `8080/tcp`, derive `PREV_OFFSET`, REFUSE a conflicting `PORT_OFFSET` | `docs/SUBSTRATE.md:552`; impl `Makefile:540-548`, `:549-550` | Port mappings are immutable container config; exits 1 telling you to `docker rm -f` first | verified-in-code |
| 5 | `docker rm -f $(LIVE_NAME); $(MAKE) up PORT_OFFSET=… $$CARRY` | `README.md:377-379`; impl `Makefile:551-555` | `docker rm -f` on a RUNNING container is a **no-grace SIGKILL** — recreate does not drain first. Named volumes preserved | verified-in-code |

- **Step 5 (corrected by verification: the map marked this `verified-live` on the strength of a docker-events
  trace).** That trace was produced by a **third party's** `docker rm -f` during the audit window, not by
  `make recreate`. The claim stands on code alone and does not need the trace: `Makefile:551-555` calls
  `docker rm -f` with no preceding drain, whereas `clean-live` (`Makefile:828-837`) *does* call `stop-live`
  first, and `Makefile:794` sets `STOP_TIMEOUT ?= 300` used at `:825`. The asymmetry **is** the evidence.

**End state.** A new container with the same name, the same two volumes, the carried-forward launch identity,
and any explicitly supplied overrides applied.
**How to verify it actually worked.** `docker exec <c> substrate-config` for resolved values + provenance;
`docker inspect <c> --format '{{range .Mounts}}{{.Name}} {{end}}'` to confirm the volumes are the intended ones.

---

### F1-P9 — Stop, clean, and teardown

**Purpose.** Take a fleet down without losing mid-flight work or corrupting the datastore, and destroy state only
deliberately.
**Trigger.** Backup, host maintenance, or decommissioning.
**Preconditions.** Know the instance name — every command names it; volumes follow `LIVE_NAME`.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `make -C scripts/substrate stop LIVE_NAME=<name>` (`stop` → `stop-live`) | `README.md:595`; `docs/SUBSTRATE.md:1114`; impl `Makefile:847`, `:812-826` | Reports goal-host's in-flight execution count first, then drains | verified-in-code |
| 2 | `_gp=$(docker port $(LIVE_NAME) 8210/tcp …); curl http://localhost:$_gp/health` → parse `in_flight` | `Makefile:796-811`; impl `:813-823` | Asks **docker** which port this container publishes rather than computing `18210+PORT_OFFSET`. A REPORT, not a gate | verified-in-code |
| 3 | `docker stop -t $(STOP_TIMEOUT) $(LIVE_NAME)` (`STOP_TIMEOUT ?= 300`) | `docs/SUBSTRATE.md:1098-1105`; impl `Makefile:794,824-826`, `Dockerfile.substrate:361` | 300 s covers the longest vessel drain plus surrealdb's 90 s RocksDB flush. A bare `docker stop` defaults to 10 s | verified-in-code |
| 4 | `make clean` (→ `clean-live`): drain first if running, then `docker rm -f`; volumes retained | `README.md:598-608`; impl `Makefile:849`, `:828-837` | `docker rm -f` sends SIGKILL with no grace, so clean-live calls stop-live first. Volumes never removed here | verified-in-code |
| 5 | `docker volume rm <name>-workspace <name>-surreal` | `README.md:602-612`; `docs/SUBSTRATE.md:576-578`; impl `Makefile:67-74` | **The only step that destroys learning state.** `docker rm` alone leaves the volumes, so a "clean" reinstall silently inherits the old fleet's posteriors, traces and concept graph | verified-live (expired) |
| 6 | Backup: stop, then `docker run --rm -v <vol>:/src -v $(pwd):/bak alpine tar czf …` per volume | `docs/SUBSTRATE.md:1095-1119` | Both volumes must be captured. Restore ends with `make up LIVE_NAME=…` (resume) — **not** `run-live` (name collision) and **not** `up … PORT_OFFSET=<n>` (resume carries nothing) | documented-only |

- **Step 5 evidence (expired, but the residue persists).** After `substrate-live` was destroyed at 22:05:11,
  `docker volume ls` still listed `substrate-surreal` and `substrate-workspace` — plus ~15 other orphaned
  `<name>-surreal`/`<name>-workspace` pairs from prior test fleets, which is the accumulated evidence of exactly
  this trap.

**End state.** Container drained and/or removed; learning state either preserved on the two named volumes or
deliberately destroyed.
**How to verify it actually worked.** After a restore: `docker exec <name> substrate-key whoami` (identity
survived) and an authenticated `GET /v2/activities/execution-traces?limit=1` returning 200 **with traces** — a
tar that unpacked is not a datastore that mounted (`docs/SUBSTRATE.md:1141-1148`).

---

### F1-P10 — Auxiliary bring-up targets

**Purpose.** The remaining Makefile targets in the bootstrap tier, and what each actually does.
**Trigger.** Specific one-off needs; none is on the normal bring-up path.
**Preconditions.** An image built for that flavour, or a stopped container for the migration.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `make build-obsidian` → `docker build --target substrate-obsidian -t ghcr.io/avigopal/substrate:obsidian` | `docs/SUBSTRATE.md:596-600`; impl `Makefile:349-354`, `Dockerfile.substrate:383-452` | Base fleet + Xvfb/x11vnc/fluxbox/noVNC + extracted Obsidian AppImage + plugin built in-container. **Does NOT depend on `validate-build`/`preflight-submodules`** — only `build` does (`Makefile:341`) | verified-in-code |
| 2 | `make run-live-obsidian` | `docs/SUBSTRATE.md:596-606`; impl `Makefile:649-724`, `:707-715` | Reuses the name and volumes but publishes a **different** port set: hardcoded nine ports ignoring `PORT_OFFSET`, swapping `18310:8310` for `16080:6080` | verified-in-code |
| 3 | `make migrate-state-to-volumes` | `Makefile:726-729`; impl `:730-745` | One-time copy of legacy HOST dirs into the named volumes. Refuses while running. Idempotent re-run **WIPES** and recopies both volumes (`find /dst-* -mindepth 1 -delete`) | verified-in-code |
| 4 | `make ui-bridge-up / -down / -status` | `Makefile:906-918`; impl `:920-937` | alpine/socat sidecar publishing host 18270 → bridge IP:8270 without recreating. Largely redundant now that `run-live` publishes 18270 | verified-in-code |
| 5 | `make clone-vessel-repos` | `Makefile:939-959`; impl `:960-974` | Requires `gh`; clones into `$(WORKSPACE)/git/vessels` — the **legacy HOST path** (`Makefile:78`) that is no longer mounted (`Makefile:75-77`). On a volume-detached fleet it writes where the substrate does not read | doc-code-mismatch |

- **Step 5 (confirmed).** `Makefile:949-950` header still claims the clones are "bind-mounted to /workspace
  inside the substrate container"; `Makefile:75-77` says the host paths are "retained only as the migration
  source / offline backup … No longer mounted into the live container." `run-live` (`Makefile:626-638`) mounts
  only the two named volumes and prints "NOTHING from the host is bind-mounted". Two statements in one file,
  ~880 lines apart. `git-push-setup.service` does the in-container cloning instead.

**End state.** Flavour-specific or migration-specific side effects; the normal fleet is unaffected.
**How to verify it actually worked.** Obsidian: `http://localhost:16080/vnc.html`. Migration:
`docker run --rm -v <vol>:/src alpine cat /src/data.db/CURRENT` (the target prints this itself, `Makefile:744`).

---

### F1-P11 — Verifying a bring-up (the check ladder, cheapest first)

**Purpose.** Establish that a fleet is not merely alive but usable, and know which signal answers which question.
**Trigger.** Immediately after any bring-up, and before trusting any measurement taken from the fleet.
**Preconditions.** The container is running.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `docker ps --filter name=<c> --format '{{.Status}}'` | `README.md:115`; impl `Dockerfile.substrate:366-367` | `Restarting` is the crash-loop tell on the compose lane. `(healthy)` means only that `substrate-ready --quick` passed on the CORE set, single-pass | verified-live (expired) |
| 2 | `docker exec <c> substrate-ready` (per-unit matrix, honest not-ready count) | `README.md:488,587`; `docs/SUBSTRATE.md:912`; impl `substrate-ready.sh:145-250,292-316` | Reports `ok / down / masked / skipped`; `masked` is named separately and counted `down` only for a CORE unit on a standalone; exit code is the verdict (`:316`) | verified-in-code |
| 3 | `docker exec <c> substrate-key whoami` | `README.md:120-133,147`; `docs/SUBSTRATE.md:1408`; impl `substrate-key.sh`, `Dockerfile.substrate:249` | THE gate for "is identity actually seeded". `substrate-key show` prints whatever is in the env file without checking it | verified-in-code |
| 4 | `docker exec <c> substrate-doctor` | `README.md:228,489`; `docs/SUBSTRATE.md:911`; impl `Dockerfile.substrate:221`, `Makefile:463` | The only check that catches an LLM arm which is up but cannot complete — it POSTs a real completion per arm (check 7, `substrate-doctor.sh:255-284`). Costs money; do not loop it | verified-in-code |
| 5 | `docker exec <c> substrate-config [FILTER]` | `README.md:594`; `docs/SUBSTRATE.md:939-947`; impl `substrate-config.sh:26-27,40-56` | Answers "did my `-e` win, and what beat it?" Sources: `env \| persisted \| generated \| derived \| hardcoded \| unrecorded \| unknown`. `unrecorded` means the tool cannot answer — **not** that your value won | verified-live (expired) |
| 6 | `curl` each published port's `/health`; `curl -s <hub>:18100/bootstrap \| jq '.relay_multiaddrs'` | `README.md:262-264,615-626`; `docs/SUBSTRATE.md:411-431`; impl discovery `/bootstrap` pre-auth carve-out (`README.md:636`) | A standalone answers `/bootstrap` 200 with an EMPTY relay array — "reachable" and "joinable" look identical on status alone; the BODY distinguishes them | verified-live (expired) |
| 7 | `docker exec <c> systemctl show <unit> -p NRestarts --value` (never `is-active` alone) | `docs/SUBSTRATE.md:746-749`; `README.md:397-402`; impl `substrate-ready.sh:73-127` | A unit in a `Restart=` loop reports `activating`/`active` forever and never `failed`. The tool compares `NRestarts` **between passes**, never against zero | verified-live (expired) |

- **Step 2 (corrected by verification: the map marked this `verified-live` while its own evidence field said the
  tool was never invoked).** Status downgraded to `verified-in-code + boot-log corroborated`. What is
  established: the boot-time invocation (`--services-only`, from `substrate-ready.service`) printed a matrix
  ending `[ready] fleet ready`, plus the source rules at `substrate-ready.sh:38` (`--quick) QUICK=1; ONCE=1`),
  `:145-180` (masked-core rule at `:170-175`) and `:259-283`. What is **not** established: the behaviour of a
  direct `substrate-ready` invocation (full set, not `--services-only`), including its exit code as verdict.
- **Step 4 (corrected by verification).** Doctor was runnable read-only after all: it does not dispatch a goal
  unless `--smoke` is passed (`substrate-doctor.sh:21-22,286`). The stated reason for the coverage gap does not
  hold — see §8.
- **Step 6 evidence (expired).** All nine ports returned 200 at 22:02 PDT.
  `curl -s http://localhost:18100/bootstrap` → `{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101",
  "discovery_endpoint":"","prefer_transport":"libp2p"}` — the documented standalone signature exactly.

**End state.** A defensible statement about whether the fleet is usable, with the question each signal actually
answered.
**How to verify it actually worked.** This process *is* the verification; its own check is that each rung is read
for what it measures — liveness (`docker ps`), unit readiness (`substrate-ready`), identity (`whoami`),
correctness incl. LLM arms (`substrate-doctor`), configuration provenance (`substrate-config`), and restart loops
(`NRestarts`).

---

## 4. Family 2 — Roster & vessel management

9 processes, 62 steps. **This family received ZERO adversarial verdicts** — it is *unreviewed*, not *clean*.
Treat its statuses as the original auditor's, uncorrected. Live evidence is against `substrate-live` and is
expired; the deployment had **no selection set at all**, so every selection behaviour is code-only.

### F2-P1 — Boot-time roster selection (entrypoint → gen-env → apply-inventory → arm pass)

**Purpose.** Decide, offline and before systemd is PID 1, which of the ~92 inventory-named units this container
will run, by trimming the image's fully-baked enable list down to a subset.
**Trigger.** Container start.
**Preconditions.** The image ships `vessels.inventory.json` and `vessels.manifest.json`; `jq` on PATH; any
selection intent present in the container env.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `/usr/local/bin/gen-env` | `entrypoint.sh:6-7`; impl `gen-env.sh:838-852` | The five selection names are persisted into `/etc/substrate/env` only when non-empty (`:843,850,851,852`). A spoke derives `ENABLED_ROLES=spoke` automatically (`:425`) | verified-live (expired) |
| 2 | `mkdir -p /workspace/substrate/fleet`; copy the two fleet files **only if absent** | `entrypoint.sh:13-20`; readers `apply-inventory.sh:22-23`, `vessel-ctl.sh:141`, `render-unit.sh:20-21`, `substrate-pull-sync.sh:31-32` | **The volume-copy-is-authoritative rule.** Deliberate, so the substrate may alter its own membership | verified-live (expired) |
| 3 | `set -a; . /etc/substrate/env; set +a` | `entrypoint.sh:22-27`; impl `:27` | Selection variables become environment for the selector. Same sourcing idiom that used to overwrite an injected override inside `vessel-ctl apply` | verified-in-code |
| 4 | `/usr/local/bin/apply-inventory` — resolve `PROFILE` | `apply-inventory.sh:8-14`; `docs/operations/CONFIGURATION_SURFACE.md:107`; impl `apply-inventory.sh:171-177` | PROFILE outranks everything; `.profiles[$PROFILE]` is an explicit unit list (`vessels.inventory.json:39-60`: `compute_node`=10, `surface_node`=6). Unknown name is FATAL | verified-in-code |
| 5 | else `ENABLED_VESSELS` (explicit allow-list, overrides roles) | `apply-inventory.sh:9-11`; impl `:178-181`, `:145-151`, `:116-122` | Bare names resolve to `<name>.service` then `.timer`; unresolvable tokens emit `__UNRESOLVED__:` and `fatal_if_unresolved` (`:155-162`) aborts in the parent shell | verified-in-code |
| 6 | else `ENABLED_ROLES`, expanded through `inventory.roles` | `apply-inventory.sh:61-69`; impl `:70-90`, `:182-198` | `hub`=46 manageable units, `spoke`=41, `full`=92 of 92 (i.e. **`full` masks nothing**). Unrecognised token FATAL via `__INVALID_ROLE__:` sentinel | verified-in-code |
| 7 | else `DESIRED = manageable_units()` (default: everything) | `apply-inventory.sh:13`, `vessels.inventory.json:2`; impl `apply-inventory.sh:199-201`, `:92` | `manageable_units()` excludes `manifest:true` — **manifest vessels are never selected or masked** by the mask/enable loop. The no-selection branch falls through to the unmask and enable passes (`:31-57`) | verified-live (expired) |
| 8 | `ENABLED_EXTRA_VESSELS` added on top | `apply-inventory.sh:203-207`; impl `:208-214` | Additive (unlike `ENABLED_VESSELS`, which replaces). Runs BEFORE the DISABLED subtraction | verified-in-code |
| 9 | close the timer/service pairs in both directions | `apply-inventory.sh:216-233,250-261`; impl `:234-248`, `:262-276` | A desired `.timer` pulls its `.service` and vice-versa. Without this, systemd refuses a timer whose service is not loaded, or a timer-driven service fires once at boot and never again | verified-in-code |
| 10 | subtract `DISABLED_VESSELS` | `apply-inventory.sh:11,278`; impl `:279-282` | Always wins, applied after every additive pass. Tokens resolve bare→`.service`→`.timer`; a typo is FATAL | verified-in-code |
| 11 | per-unit convergence loop: unmask / enable / disable+mask | `apply-inventory.sh:284-346`; impl `:293-299` (DRY_RUN-guarded), `:319-326`, `:329-343` | A desired `.service` whose `.timer` is also desired is deliberately NOT enabled. A not-desired unit gets `disable` **plus** an `/etc`-level `/dev/null` mask. A real unit file in `/etc` cannot be masked and warns (`:337-338`) | verified-live (expired) |
| 12 | inventory-conformance warning for shipped-but-unlisted units | `apply-inventory.sh:348-365`; impl `:379-390` | Any unit under `/usr/lib/systemd/system` running out of `/vessels/`, `/usr/local/share/substrate` or `/opt/substrate` that the inventory does not name is WARNED about. Warn-only by design. Baseline widened to `all_inventory_units()` (`:379`) | verified-live (expired) |
| 13 | `if ! /usr/local/bin/apply-inventory; then` … FATAL when a selection was requested | `entrypoint.sh:28-42`; impl `:43-51` | Fail-open only when nothing was asked for | verified-in-code |
| 14 | spoke-only `vessel-ctl install federation-transport-vessel` + offline wants-symlink | `entrypoint.sh:53-60`; impl `:61-72` | Install exit status swallowed (`\|\| true`). Not a spoke on the audited box, so the branch did not run | verified-in-code |
| 15 | `apply-llm-arms` — render `llm-<id>.service` per declared arm, enabled per the same role selection | `entrypoint.sh:74-84`; `docs/HUMAN_SURFACE.md:216-221`; impl `entrypoint.sh:85-95` | Arm units are created **after** apply-inventory, under names the inventory never contains, so they are structurally invisible to `ENABLED_ROLES`/`DISABLED_VESSELS`. `vessel-ctl apply` re-runs the same code with `RELOAD=1` | verified-live (expired) |

- **Step 1 evidence (expired).** `grep -E '^(PROFILE\|ENABLED_ROLES\|ENABLED_VESSELS\|ENABLED_EXTRA_VESSELS\|
  DISABLED_VESSELS)=' /etc/substrate/env` → no output, rc=1. Default topology.
- **Step 6 arithmetic (offline jq over the repo inventory, still reproducible).** `roles.hub`→46,
  `roles.spoke`→41, `roles.full`→92 of 92. `([.vessels[].role]|unique) - ([.roles[][]]|unique)` → empty. Role
  census: autonomy 26, infra 18, store 17, compute 10, ui 8, seed 5, api 3, desktop 3, transport 2, control 1,
  models 1, registry 1.
- **Step 7 (important nuance the map understated, per the F3 verdict on the same mechanism).**
  `manageable_units()` is consulted only on the ENABLED_ROLES branch (`:194`), the no-selection default (`:200`)
  and the mask/enable loop (`:285`). The `ENABLED_VESSELS` branch resolves through `all_units()` (`:94`), which
  **includes** manifest entries — so an operator *can* write `ENABLED_VESSELS=human-surface-vessel`, have it
  resolve into DESIRED, and have the loop silently neither enable nor mask it. That is a dead write that reports
  no error.
- **Step 11 evidence (expired).** Live DRY_RUN through `vessel-ctl drift`: `done — 0 unit(s) would be disabled`.
  Zero unmask lines because nothing was masked. The DRY_RUN guard is at `:294` — a prior report
  (`BRINGUP_THREE_PATHS.md:951`) recorded it as ABSENT; superseded.
- **Step 12 evidence (expired).** `warn: 1 shipped unit(s) absent from the inventory … unmanaged:
  metric-collector-vessel.service`. `human-surface-vessel.service` was **not** flagged, confirming the widened
  baseline fix landed.
- **Step 15 evidence (expired).** `llm-opus` and `llm-haiku` active/enabled, `llm-google` inactive/enabled — none
  of the three appears in `vessels.inventory.json`.

**End state.** `/etc/systemd/system` holds an enable/mask symlink set matching the selection; systemd is exec'd
as PID 1 and starts exactly that subset. On the audited deployment: no selection, 0 masked, 97 rows in the fleet
view, one ungoverned unit warned about.
**How to verify it actually worked.** `docker exec <c> vessel-ctl status` (fleet view: `is-active` + `is-enabled`
+ `NRestarts`/next-elapse per unit) and `vessel-ctl drift` (re-runs the selector under `DRY_RUN=1`).

---

### F2-P2 — Re-apply the roster to a RUNNING fleet: `vessel-ctl apply`

**Purpose.** Close the propagated-but-not-applied gap: selection normally runs only pre-systemd, so a corrected
inventory sits inert in the volume until the container restarts.
**Trigger.** Operator, or an activity through local-tools-vessel's `shell` resolver.
**Preconditions.** The target container is RUNNING (`vessel-ctl.sh:86-95` refuses a stopped one rather than
misdiagnosing it as a manifest miss); `apply-inventory` and `apply-llm-arms` present.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `vessel-ctl apply [--container NAME]` | `vessel-ctl.sh:42`; `docs/HUMAN_SURFACE.md:200-204`; impl `vessel-ctl.sh:497-506` | Prints `[apply] re-running vessel selection in <container>`. In-container, `CONTAINER` is replaced by `/etc/hostname` (`:136-138`) | verified-in-code |
| 2 | `selection_override()`: capture the five selection names from THIS process, source the env file, then re-export | `vessel-ctl.sh:98-118`; impl `:119-130`, used at `:507-509` and `:608-610`, `:621-623` | **An injected selection outranks the env file.** Before this, sourcing overwrote the injection — and because gen-env pins `ENABLED_ROLES=spoke` on every spoke, the documented mask-recovery lever was inert on exactly the fleets that needed it | verified-in-code |
| 3 | `/usr/local/bin/apply-inventory` (full P1 steps 4–12, live) | `vessel-ctl.sh:497-503`; impl `:509-510` | Non-zero exit → `{"ok":false,…"error":"apply-inventory failed — selection unchanged"}`, exit 1 | verified-in-code |
| 4 | `RELOAD=1 /usr/local/bin/apply-llm-arms` | `vessel-ctl.sh:511-515`; impl `:516` | Arms are governed by the same selection but created under names apply-inventory never sees. `RELOAD=1` because systemd is already up. A failure here only prints a note | verified-in-code |
| 5 | `systemctl daemon-reload` | `vessel-ctl.sh:517` | Output and status discarded (`>/dev/null 2>&1`) | verified-in-code |
| 6 | Converge the RUNNING state — stop anything now masked, start anything now enabled | `vessel-ctl.sh:518-525`; impl `:526-580` | masked + (active\|activating) → `stop`; enabled + inactive → `start`, but only when `ConditionResult != no`, `Type != oneshot`, inventory role != `seed`, and no sibling `.timer` exists | verified-in-code |
| 7 | emit `{"ok":true,"action":"apply",…}` with **no** `\| head -40` on the action log | `vessel-ctl.sh:581-585`; impl `:586` | The full action log is printed; truncation would break the contract that a no-action apply is a genuine no-op | verified-in-code |

- **Step 2 evidence (expired).** md5 of `scripts/substrate/vessel-ctl.sh` equalled md5 of
  `/usr/local/bin/vessel-ctl` inside the container — the fix was live on that fleet. Closure verified in code
  plus current-on-that-box, **not** verified by execution (the lever is a mutation).
- **Step 6 rationale.** Three kinds of unit rest inactive as their healthy state; starting them printed seven
  spurious "started" lines on every run of a converged default fleet (bootstrap-seeder, concept-db-seeder,
  development-vessel-seed, llm-google, novnc, obsidian-desktop, obsidian-xorg).

**End state.** Symlinks **and** running processes match the selection in force (env file, unless overridden by
`docker exec -e`). LLM arm units re-enabled/disabled to match.
**How to verify it actually worked.** `vessel-ctl status` afterwards (`docs/HUMAN_SURFACE.md:203`). Masked and
static units **are** printed in that view (`vessel-ctl.sh:398-411` records that they used to be filtered out, so
after an apply masked seven vessels the fleet view went 43→25 lines and core vessels simply vanished).

---

### F2-P3 — Report roster drift: `vessel-ctl drift`

**Purpose.** Show, without changing anything, the gap between the three copies of the fleet definition and the
running set.
**Trigger.** Operator investigating roster currency; `docs/HUMAN_SURFACE.md:202` prescribes it first.
**Preconditions.** Container running; `apply-inventory` installed.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `diff /workspace/substrate/fleet/vessels.inventory.json /usr/local/share/substrate/vessels.inventory.json` | `vessel-ctl.sh:589-594`; impl `:595-602` | Prints `identical` or a `\| head -40` diff. Compares volume against **IMAGE**, never against git, and **never inspects `vessels.manifest.json` at all** | verified-live (expired) |
| 2 | `grep -E '^(PROFILE\|ENABLED_ROLES\|ENABLED_VESSELS\|ENABLED_EXTRA_VESSELS\|DISABLED_VESSELS)=' /etc/substrate/env` | `vessel-ctl.sh:604`; impl `:605` | Prints the persisted selection, or `(none set — default topology, every baked unit enabled)` | verified-live (expired) |
| 3 | if `selection_override` non-empty, print `OVERRIDDEN for this run by the injected selection: …` | `vessel-ctl.sh:606-607`; impl `:608-610` | Without this, drift would describe a selection it is not going to apply | verified-in-code |
| 4 | `DRY_RUN=1 /usr/local/bin/apply-inventory` (with the injected selection re-exported after the env source) | `vessel-ctl.sh:612-620`; impl `:621-624` | Prints the **full** plan. No `\| tail -20`: truncation was biased in the worst direction — from a spoke-masked fleet drift predicted 2 unmasks while apply performed 21 | verified-live (expired) |

- **Step 1 evidence (expired).** `=== inventory: volume (authoritative) vs image (build default) ===` /
  `identical`; independent `diff -q` rc=0. But the volume manifest was **6238 bytes** against the image's
  **6070** and drift said nothing.
- **Step 4 evidence (expired).** Plan = `0 unit(s) would be disabled` + `warn: 1 shipped unit(s) absent from the
  inventory … metric-collector-vessel.service`. This was the one live-verified execution of the selector, and it
  is read-only because `apply-inventory.sh:293-299` guards the unmask branch under `DRY_RUN`.

**End state.** A three-section report on stdout. Nothing on disk changed.
**How to verify it actually worked.** Re-run it; it is idempotent. To prove it did not mutate, compare
`systemctl list-unit-files` before/after — the guard at `apply-inventory.sh:294` is the code-level assurance.

---

### F2-P4 — Propagate a repo-side roster change (substrate-pull-sync → converge_fleet_defs)

**Purpose.** Bring a git-side inventory/manifest/selector change to an existing container without an image
rebuild, without silently reverting a fleet's self-chosen membership.
**Trigger.** `substrate-pull-sync.timer`, roughly every 10 minutes.
**Preconditions.** `/workspace/git/super-repo` present and fetched; `/workspace/substrate/fleet` exists.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `converge_units <super-repo>` — mirror `scripts/substrate/units/` into the systemd unit dir | `substrate-pull-sync.sh:164-183`; impl `:184-225`, called at `:1559` | Units written to the **VENDORED** dir (`/usr/lib`), never `/etc` — a real file in `/etc` can never be masked, and masking is how apply-inventory keeps vessels off a spoke | verified-in-code |
| 2 | `converge_fleet_defs` — unconditionally replace the five bootstrap scripts from git | `substrate-pull-sync.sh:226-250`; impl `:279-311`, called at `:1565` | `apply-inventory.sh`, `gen-env.sh`, `render-unit.sh`, `vessel-ctl.sh`, `secrets.env.sh`. Unconditional because these are CODE, not state. The log line states **when** each takes effect, and it differs | verified-live (expired) |
| 3 | converge `substrate-pull-sync` itself (install to `.new`, atomic `mv`) | `substrate-pull-sync.sh:322-333`; impl `:329-334` | The converger converges itself, breaking the bootstrap deadlock. Atomic `mv` so the executing process keeps its inode | verified-in-code |
| 4 | for each fleet file: `cmp -s git live` → if equal, refresh the sidecar and continue | `substrate-pull-sync.sh:243-249`; `docs/HUMAN_SURFACE.md:205-210`; impl `:360-368` | Sidecar `.<f>.converged` refreshed from git | verified-live (expired) |
| 5 | else if sidecar exists AND `cmp -s sidecar live` → install git over live, refresh sidecar | `substrate-pull-sync.sh:243-247`; impl `:372-375` | **The sidecar is the guard on the volume-is-authoritative rule.** Logs `fleet: converged <f> from git (local copy was unmodified)` | verified-in-code |
| 6 | else if no sidecar → adopt the live copy as baseline, converge from the NEXT tick | `substrate-pull-sync.sh:377-381`; impl `:382-383` | Never guess on the first observation | verified-in-code |
| 7 | else → leave the file alone and log `<f> was modified locally — leaving it alone (git version NOT applied; delete <sidecar> to accept git)` | `substrate-pull-sync.sh:245-249`; `docs/HUMAN_SURFACE.md:205-210`; impl `:384` | **BROKEN IN PRACTICE FOR THE MANIFEST.** `cmp -s` is a BYTE compare; the volume manifest is a jq pretty-printed reformat — semantically identical, byte-different — so this branch fires every tick and `vessels.manifest.json` is FROZEN against git indefinitely | known-broken |

- **Step 2 evidence (expired).** md5 comparison repo vs container: `vessel-ctl.sh`, `apply-inventory.sh`,
  `render-unit.sh`, `mirror-to-live.sh` all IN SYNC — every code-level fix read was the code that fleet ran.
- **Step 7 evidence (expired), three independent probes.** (1) `jq -S .` of the volume manifest vs the image
  manifest → semantically identical, and vs the sidecar → semantically identical; (2) raw sizes 6238 vs 6070;
  (3) `journalctl -u substrate-pull-sync` shows the "was modified locally" line at every tick from 01:38 through
  04:55 on 2026-08-25 — 20 consecutive ticks in the retained window. The **inventory** is unaffected.

**End state.** The five bootstrap scripts and `vessels.inventory.json` at git HEAD; `vessels.manifest.json`
permanently pinned to whatever was in the volume when the reformat happened.
**How to verify it actually worked.** `docker exec <c> journalctl -u substrate-pull-sync | grep 'fleet:'` — the
log is the only evidence, and `vessel-ctl drift` does **not** surface this (F2-P3 step 1).

---

### F2-P5 — Attach a dynamic (manifest) vessel: `vessel-ctl install <vessel>`

**Purpose.** Add a vessel that is NOT baked into the image's enable list — the runtime membership change the
substrate can make about itself.
**Trigger.** Operator, entrypoint's spoke branch, or an activity through the `shell` resolver (the script emits
clean JSON on stdout, is idempotent, prompts for nothing — `vessel-ctl.sh:14-17`).
**Preconditions.** The name has an entry in `vessels.manifest.json` — the **VOLUME** copy is read first
(`vessel-ctl.sh:141-143`); the container is running; network/PAT for clone-on-demand.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `e=$(entry)` — `jq -e '.vessels[] \| select(.name==$n)'` over the manifest | `vessel-ctl.sh:38`; `vessels.manifest.json:2`; impl `vessel-ctl.sh:142-143,171` | No entry → `{"ok":false,"error":"vessel '<v>' not in manifest"}`, exit 1. Four installable names; the inventory flags only THREE as `manifest:true` — `metric-collector-vessel` is absent from the inventory entirely | verified-live (expired) |
| 2 | Port-collision guard: manifest `health_port` must be unique across BOTH volume fleet files | `vessel-ctl.sh:173`; impl `:174-180` | Refuses with `health_port <p> already claimed by another fleet entry`. Reads only `/workspace/substrate/fleet/*`; the counting `grep -cx` runs in the CALLER's shell when driven from a host | verified-in-code |
| 3 | Clone on demand: `git clone -q --branch dev https://github.com/$OWNER/<repo>.git /workspace/git/vessels/<v>` | `vessel-ctl.sh:182-183,8-10`; impl `:148-157`, `:184-193` | Source is always an IN-CONTAINER git clone. `GIT_TERMINAL_PROMPT=0` so a missing credential fails instead of hanging | verified-in-code |
| 4 | If workdir is `$RUNTIME`: `mkdir -p /vessels/<v>; mirror-to-live <v> /workspace/git/vessels` | `vessel-ctl.sh:194-197`; impl `mirror-to-live.sh:71-121` | Mirrors `src/`, `sql/`, `scripts/`, `tsconfig.json`, `index.ts` and a path-rewritten `package.json`. Deliberately NOT `node_modules`, `.git`, or the lockfile. `\|\| true` — a mirror failure does not stop the install here | verified-in-code |
| 5 | `wd=$(render-unit <v> \| sed -n 's/^WorkingDirectory=//p')`; then `bun install` in `wd` | `vessel-ctl.sh:198-211`; impl `:199,212-225` | **The only dependency resolution the install does, exactly once.** Five outcomes, all now spoken in the reply's `deps` field, incl. `WORKDIR ABSENT`. None is fatal | verified-in-code |
| 6 | For each declared secret: source `secrets.env.sh`, then rewrite that key into `/etc/substrate/env` | `vessel-ctl.sh:227`; `vessels.manifest.json:2`; impl `:228-233` | Only the named keys, only if non-empty after sourcing, into the shared env file via `EnvironmentFile` — never as `Environment=` lines | verified-in-code |
| 7 | `render-unit <v> > /etc/systemd/system/<v>.service` | `vessel-ctl.sh:235`; `render-unit.sh:6-8`; impl `vessel-ctl.sh:236`, `render-unit.sh:64-122` | Lands in `/etc`, which **outranks** the vendored copy and makes the unit UNMASKABLE by role selection (`apply-inventory.sh:337-338`). `depends_on` renders to `After=` **only** (`render-unit.sh:40`) — no `Requires=`, no install of the dependency | verified-live (expired) |
| 8 | `systemctl daemon-reload && systemctl enable --now <v>.service` | `vessel-ctl.sh:235`; impl `:237` | Install enables AND starts — but the whole compound is `>/dev/null 2>&1 \|\| true`. A refused enable or failed start is invisible except through the `active` field | verified-in-code |
| 9 | `post_install` hook, if declared | `vessel-ctl.sh:239`; `vessels.manifest.json:28`; impl `:240-241` | `csh "$post" >/dev/null 2>&1 \|\| true` — stdout, stderr **and** exit status swallowed by design. Paths in the hook are LITERAL (`$REPO_ROOT`/`$RUNTIME` are not expanded) | verified-in-code |
| 10 | emit `{"ok":true,"action":"installed","vessel":…,"active":…,"self_recovery":…,"deps":…}` | `vessel-ctl.sh:243-246` | `ok:true` is emitted unconditionally past step 1. `self_recovery` merely echoes the manifest flag | verified-in-code |

- **Step 5 rationale.** The absent-workdir case previously short-circuited to true and returned `ok:true`,
  producing a unit that crash-looped on a missing module for the life of the container while systemd reported
  `activating`, never `failed` (measured: `NRestarts=1681` over five days on `substrate-ui-local`).
- **Step 7 evidence (expired).** `render-unit federation-transport-vessel` →
  `After=network.target discovery-vessel.service federation-relay.service git-push-setup.service` /
  `Wants=git-push-setup.service` — the `depends_on` entry became an `After=` term and nothing else. No
  `FED_PUBLIC_IP`/`RELAY_MULTIADDR` `Environment=` lines appear (the manifest's `env_from_file` array is never
  read by render-unit).

**End state.** A rendered unit in `/etc/systemd/system`, enabled and started, with dependencies resolved once in
its WorkingDirectory, its secrets merged into `/etc/substrate/env`, and its discovery registration handled by the
vessel itself at runtime.
**How to verify it actually worked.** **Not** the install's `ok:true`. Assert the artifact: `curl` the vessel's
`health_port`, `vessel-ctl status <v>` for `active`+`restarts=`, and for human-surface-vessel
`cat /workspace/human-surface-ui-build.log` for `UI_BUILD_OK`/`FAILED`.

---

### F2-P6 — Detach a vessel: `vessel-ctl uninstall` and `vessel-ctl deregister`

**Purpose.** Remove a dynamic vessel from the fleet, or remove only its discovery registration.
**Trigger.** Operator or a substrate-authored membership change.
**Preconditions.** The name exists as a manifest entry or an installed unit.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `vessel-ctl uninstall <vessel>` — existence check first | `vessel-ctl.sh:39`; impl `:290-299` | Refuses a name that exists nowhere. An installed unit with no manifest entry warns on stderr and proceeds | verified-in-code |
| 2 | `systemctl disable --now <v>.service; rm -f /etc/systemd/system/<v>.service; systemctl daemon-reload` | `vessel-ctl.sh:300` | Whole compound is `>/dev/null 2>&1 \|\| true`. The `/usr/lib` vendored copy (if any) SURVIVES — removing the `/etc` render **un-shadows** the baked unit rather than removing the vessel | verified-in-code |
| 3 | `/usr/local/bin/discovery-deregister <vessel>` | `vessel-ctl.sh:301` | `\|\| true` — exit status swallowed on this path, then `ok:true` emitted unconditionally | verified-in-code |
| 4 | `vessel-ctl deregister <vessel>` — unit existence check, then three distinct outcomes | `vessel-ctl.sh:41,266-272`; impl `:273-286` | 0 → deregistered; 2 → noop `no registry entry matched`; anything else → `ok:false` exit 1. Two causes were fixed: no existence check, and `\|\| true` swallowing the tool's status | verified-in-code |
| 5 | (passive) `ExecStopPost=-/usr/local/bin/discovery-deregister <vessel>` on every rendered unit | `render-unit.sh:14-16`; impl `:112-114` | Any CLEAN stop deregisters immediately rather than rotting for the 5-minute TTL. `-` prefix: best-effort | verified-in-code |

- **Step 2 evidence (expired).** `metric-collector-vessel.service` exists at
  `/usr/lib/systemd/system/metric-collector-vessel.service` (802 B) with **no** `/etc` render — the
  baked-and-manifest double definition.

**End state.** The unit is gone from `/etc` and disabled; the discovery row is removed (or reported as never
present).
**How to verify it actually worked.** `vessel-ctl status <v>` should now refuse the name if no vendored unit
remains; the discovery dump should no longer list the vessel. A registry record outliving the process by the TTL
means registry presence is **not** proof the vessel is up.

---

### F2-P7 — Update a vessel's code in place: `vessel-ctl sync <vessel>`

**Purpose.** Pull the clone to `origin/dev`, mirror it into the live runtime, restart the unit — the in-container
equivalent of the retired host `make sync-<vessel>` targets.
**Trigger.** Operator, or `substrate-pull-sync`'s per-vessel convergence (shares `mirror-to-live`).
**Preconditions.** A manifest entry OR an installed unit (baked vessels accepted); a clone at
`/workspace/git/vessels/<v>` and a live runtime at `/vessels/<v>`.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Existence check: manifest entry, else `systemctl cat <v>.service` | `vessel-ctl.sh:249-252`; impl `:253-257` | Refuses only a name this fleet has neither an entry nor a unit for | verified-in-code |
| 2 | `cd /workspace/git/vessels/<v> && GIT_TERMINAL_PROMPT=0 git pull --ff-only -q origin dev` | `vessel-ctl.sh:258` | `\|\| true` — a failed or diverged pull is SILENT, and the sync then mirrors whatever the clone happens to be at | verified-in-code |
| 3 | `/usr/local/bin/mirror-to-live <v> /workspace/git/vessels` | `vessel-ctl.sh:259`; impl `mirror-to-live.sh:24-148` | Refuses (exit 1) with no clone (`:24`); SKIPS (exit 0) with no live runtime (`:58`). `git reset --hard HEAD` (`:71`) forces index **and** working tree — `checkout -f -- .` restored from a STALE index and was a root cause of "landed on origin/dev but never went live". Optional `MIRROR_EXPECT_SHA` (`:40-57`) plus a POST-mirror re-read (`:129-138`); final assert `:143-146`. A mirror failure DOES fail the sync | verified-in-code |
| 4 | `systemctl restart <v>.service` | `vessel-ctl.sh:260` | `>/dev/null 2>&1 \|\| true`. **No MainPID discriminator here**, unlike the `restart` verb. `ok:true` regardless | verified-in-code |

**End state.** The live `/vessels/<v>` tree matches the clone's HEAD, dependencies reinstalled iff
`package.json` changed, and the unit restarted.
**How to verify it actually worked.** Compare the clone SHA against the running code, not the sync's `ok:true` —
pass `MIRROR_EXPECT_SHA` if the caller knows the intended commit. Then `vessel-ctl restart` (which **does** check
MainPID) or `systemctl show <u> -p MainPID`.

---

### F2-P8 — Observe the roster: `list`, `status`, `logs`

**Purpose.** Answer "what does this fleet consist of and what state is each unit in" — the surface
`docs/HUMAN_SURFACE.md:222` tells the reader to trust over `docker ps`.
**Trigger.** Any operator or activity inspecting membership.
**Preconditions.** Container running.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `vessel-ctl list` | `vessel-ctl.sh:34`; impl `:160-168` | Enumerates **MANIFEST vessels only** (four names). Performs NO existence check — and `systemctl is-active` on a nonexistent unit returns the literal string `inactive` (rc=3), which is folded to `unknown` only when EMPTY. A never-installed vessel reads identically to an installed-but-stopped one | known-broken |
| 2 | `vessel-ctl status <vessel>` | `vessel-ctl.sh:35`; impl `:369-380` | Existence check via `systemctl cat` first — a typo returns `ok:false` exit 1. Then one line: unit, is-active, is-enabled, `restarts=NRestarts` | verified-live (expired) |
| 3 | `vessel-ctl status` (fleet view) | `vessel-ctl.sh:35`; `docs/HUMAN_SURFACE.md:220-222`; impl `:381-493` | Asks SYSTEMD (`list-units --type=service --all` **plus** `--type=timer --all`), not the filesystem. Debian statics excluded by **inventory membership**, not by state. Masked units printed. Timer next-elapse computed from both realtime and monotonic fields | verified-live (expired) |
| 4 | (gap in the same view) a shipped unit that is disabled AND never loaded is **omitted** | `vessel-ctl.sh:415-428`; impl `:424-425` | The row source is `systemctl list-units --all`, which lists LOADED units only. `metric-collector-vessel.service` — the one unit the boot warning flags — has **no row** | known-broken |
| 5 | `vessel-ctl logs <vessel> [-n LINES]` | `vessel-ctl.sh:37`; impl `:358-366` | Existence check, then `journalctl -u <U> -n <LINES> --no-pager`. Plain text on purpose; default 50 lines | verified-live (expired) |

- **Step 1 evidence (expired), with controls.** `list` returned `federation-relay: "inactive"` — yet
  `ls /etc/systemd/system/... /lib/... /usr/lib/...` → No such file in all three. Positive control in the same
  output: `human-surface-vessel: "active"` (really installed and running). Negative control:
  `systemctl is-active nosuchvessel-xyz.service` → `inactive`, rc=3.
- **Step 3 evidence (expired).** 97 rows. Timer rows show both forms —
  `memory-budget-check.timer next=Tue 2026-08-25 06:00:00 UTC` (calendar) and
  `boredom-vessel.timer next=waiting (its service is running; re-arms when it finishes)` (the
  running-service discriminator). Services: `surrealdb.service active enabled restarts=7`,
  `activity-api.service failed enabled restarts=0`.
- **Step 4 evidence (expired), with control.** `systemctl list-unit-files | grep metric` →
  `metric-collector-vessel.service disabled enabled`; `systemctl list-units --all | grep metric` → NO row
  (positive control in the same output: `coherence-metric.service` IS listed, disabled, because its timer
  references it and it is therefore loaded); `vessel-ctl status | grep metric` → four rows, none of them
  metric-collector.

**End state.** An operator has the unit set, per-unit state, restart counts / next-elapse, and journal tail —
from inside the image, wherever the substrate runs.
**How to verify it actually worked.** Cross-check any state claim against
`systemctl show <u> -p MainPID,NRestarts,ActiveState`; a `Restart=` loop reports `activating` forever and NEVER
`failed`, which is why `restarts=` is on every service row.

---

### F2-P9 — Act on one unit: `restart`, `start`, `stop`

**Purpose.** Operate a single unit, including recovering one that `apply` has masked.
**Trigger.** Operator or activity; also the documented recovery path after a selection change masks a unit.
**Preconditions.** The unit exists in this fleet.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `vessel-ctl restart <vessel>` — existence check | `vessel-ctl.sh:36,308-310`; impl `:311-313` | Refuses an unknown unit naming WHICH thing was wrong | verified-in-code |
| 2 | restart — refuse a MASKED unit up front | `vessel-ctl.sh:314-316`; impl `:317-319` | A masked unit cannot be restarted: systemd refuses, the OLD PROCESS KEEPS RUNNING, and `is-active` still says `active`. The refusal names the fix. There is **no `unmask` verb** | verified-in-code |
| 3 | restart — capture MainPID before and after; report active + MainPID + NRestarts | `vessel-ctl.sh:320-321,327-329`; impl `:322-336` | `ok:true` requires `is-active == active` **AND** MainPID changed. MainPID is the discriminator | verified-in-code |
| 4 | `vessel-ctl start\|stop <vessel>` | `vessel-ctl.sh:339-342`; impl `:343-356` | Exist to make the masked-unit path actionable. `ok` computed from the expected end state. NOTE `start` on a masked unit is **not** pre-refused | verified-in-code |
| 5 | Bare `vessel-ctl` prints its own usage line | `vessel-ctl.sh:51-55`; impl `:56-59` | Twelve verbs (`:57`): list, status, restart, start, stop, logs, install, uninstall, sync, deregister, apply, drift — matching the unknown-action message at `:627` | verified-in-code |

**End state.** One unit in the requested state, with a reply that distinguishes "did not happen" from "happened".
**How to verify it actually worked.** MainPID turnover (restart already asserts it); for start/stop,
`systemctl show <u> -p ActiveState,MainPID`.

---

## 5. Family 3 — Human surface (UI + Obsidian)

9 processes, 67 steps. **What the live combination meant:** the audited box was a STANDALONE FULL FLEET
(`ENABLED_ROLES=""`, `ENABLED_VESSELS=""`, `HUB_DISCOVERY_URL=""` in `/proc/1/environ`, image `:dev`). The **web**
half of the human surface was genuinely live and serving a bundle byte-identical to git; the **Obsidian** half
was scheduled, green, and talking to a plugin that does not exist on this flavour — 2586 consecutive unreachable
ticks with zero detection. The units that *can* detect the flavour (desktop/xorg) skip themselves via
`ExecCondition`; the three tick timers cannot and keep firing into a void.

### F3-P1 — Launch a human surface as a UI-only federated spoke

**Purpose.** Put a browser page in front of a person on a machine that holds no compute: one discovery registry,
one federation transport, one surface, everything else resolved on a hub.
**Trigger.** Operator wants a surface on a new box. Manual; nothing schedules it.
**Preconditions.**
- Docker, privileged-capable
- A hub that actually serves federation — `curl -s http://<hub>:18100/bootstrap | jq '.relay_multiaddrs|length'` must be > 0; `ENABLED_ROLES=hub` alone does **not** satisfy this
- Super-repo checkout with submodules populated
- `jq` on PATH (without it `cfg()` silently returns empty and the script refuses for want of a hub)
- A GitHub PAT with read access to the private super-repo (`gh auth token` counts)
- **No** credential for the image — `ghcr.io/avigopal/substrate` is a public package

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Set `.metabob.hubDiscovery` and `.metabob.apiKey` in `~/.metabob/config.json` (**not** `.metabob.endpoint`) | `docs/HUMAN_SURFACE.md:55-88`; impl `ui-only-up.sh:143-164`, `:166-173` | HUB/API_KEY/GIT_PAT filled from config or `gh auth token`. The fallback to `.metabob.endpoint` is taken VERBATIM including `:18080`; only a scheme check validates it (`:173`) | verified-in-code |
| 2 | `docker pull ghcr.io/avigopal/substrate:dev` | `docs/HUMAN_SURFACE.md:96`; impl `ui-only-up.sh:425-446` | Skippable — the script only inspects. A STALE local `:dev` is silently reused, hence the manifest preflight at step 6 | verified-in-code |
| 3 | `scripts/substrate/ui-only-up.sh [--hub URL] [--api-key K] [--name N] [--port-offset n] [--git-pat P]` | `docs/HUMAN_SURFACE.md:106-124`; impl `ui-only-up.sh:122-132`, `:174-176` | Flags win over config. Both `--name` AND `--port-offset` are needed for a second surface on an occupied host | verified-in-code |
| 4 | (implicit) refuse if no git credential | `ui-only-up.sh:54-62`; impl `:179-196` | Hard exit 1 printing the full causal chain (private super-repo → anonymous clone 401s → helper only armed when `SUBSTRATE_GIT_PAT` non-empty → baked seed carries `scripts/` only → no manifest workdir) | verified-in-code |
| 5 | Print the PLAN and the exact container command: `make -n -C scripts/substrate run-live "${MAKE_VARS[@]}" \| redact` | `ui-only-up.sh:329-375`; impl `redact()` `:260-264`, `DRY_RUN` exit `:378-382` | Provider keys deliberately blanked in `MAKE_VARS` (`:279-289`) incl. `RUNPOD_ENDPOINT_ID`, so the spoke inherits no LLM arm | verified-in-code |
| 6 | Preflight refusals | `docs/HUMAN_SURFACE.md:122-124,300-301`; impl `ui-only-up.sh:387-396`, `:401-420`, `:425-446`, `:453-458` | Existing container name → exit 1; host port collision via `ss -ltn` over the nine BASE_PORTS (**WARNS and SKIPS if `ss` is absent**); the image's baked manifest must carry human-surface-vessel; WARNING if `${NAME}-workspace` already exists | verified-in-code |
| 7 | `make -C scripts/substrate up …` (spoke derivation happens entirely in the Makefile) | `ui-only-up.sh:28-33,342-343`; impl `Makefile:199-232` | `DISCOVERY_ENDPOINT` + empty `ENABLED_ROLES` → `ENABLED_ROLES := spoke` (`:200`), derives `HUB_DISCOVERY_URL` (`:229`), `ACTIVITY_API_ENDPOINT` (`:230`), `IDENTITY_VESSEL_URL` (`:231`), and **blanks** `CONTAINER_DISCOVERY_ENDPOINT` (`:232`). `ENABLED_VESSELS` (`ui-only-up.sh:248`) overrides the spoke role group | verified-in-code |
| 8 | `docker exec $NAME test -d /workspace/git/super-repo/repos/human-surface-vessel` | `ui-only-up.sh:351`; impl `:501-515` | Hard exit 1 if missing, printing `ls /workspace/git/super-repo` and 40 lines of the git-push-setup journal | verified-in-code |
| 9 | Write the `HOST=0.0.0.0` drop-in BEFORE the install | `docs/HUMAN_SURFACE.md:252-256`; `ui-only-up.sh:353-356`; impl `:532-535` | Makes an image whose BAKED manifest still pins 127.0.0.1 correct anyway. `vessels.manifest.json:23` now carries `"HOST":"0.0.0.0"` | verified-live (expired) |
| 10 | `vessel-ctl.sh install human-surface-vessel --container $NAME`; then `daemon-reload`; then `systemctl restart` | `ui-only-up.sh:357-358`; impl `:548-561` | Install failure is captured into `INSTALL_RC` and **never** aborts the script; both manifests in force are then dumped. `post_install` builds `ui/dist` only when `dist/index.html` is ABSENT | verified-in-code |
| 11 | ASSERT container running | `ui-only-up.sh:359`; impl `:567` | `PASS_RUNNING` | verified-in-code |
| 12 | ASSERT `$WORKDIR/ui/dist` exists; warn if `/workspace/human-surface-ui-build.log` ends `UI_BUILD_FAILED` | `ui-only-up.sh:360`; `docs/HUMAN_SURFACE.md:302-305`; impl `:573-586` | Separate assert exists because `vessel-ctl` swallows the hook's output AND exit status. dist-exists-but-log-FAILED catches a stale bundle | verified-in-code |
| 13 | ASSERT the surface answers `/health` **from the host** on `$SURFACE_PORT` (45 × 2 s) | `ui-only-up.sh:361`; impl `:590-614` | Host-side on purpose: an in-container 127.0.0.1 probe passes even with the loopback pin, which is the exact defect. On failure dumps in-container `ss -ltn`, an in-container curl, the effective HOST, and the journal | verified-in-code |
| 14 | ASSERT the surface's shapes are in the **HUB's** registry as `*human-surface*@$FED_SUBSTRATE_ID` carrying `uiPanel_write` (40 × (curl -m 8 + sleep 3)) | `docs/HUMAN_SURFACE.md:126-129`; `ui-only-up.sh:362-363`; impl `:620-675`, `:631-642`, `:659-670` | **The one assert that proves federation reached the hub.** Distinguishes 401 (key not hub-issued, `:662`) from HTTP 000 (hub unreachable FROM THIS HOST, `:667-670`) | unverifiable-here |
| 15 | Report the federation transport (`docker exec curl 127.0.0.1:8401/health`, PASS iff body contains `p2p-circuit`) | `ui-only-up.sh:364`; impl `:680-682`, exclusion `:686-688` | **ADVISORY only** — excluded from OVERALL. A green unit proves nothing because the transport swallows peer faults by design | verified-in-code |
| 16 | Read the VERDICT block; exit 1 unless all four non-advisory asserts pass | `ui-only-up.sh:364`; impl `:685-715` | Five labelled lines + surface URL, hub, substrate id, published ports, OVERALL | verified-in-code |
| 17 | Open `http://127.0.0.1:18310` (plus `--port-offset`) | `docs/HUMAN_SURFACE.md:134-137`; impl `repos/human-surface-vessel/src/index.ts` serves `ui/dist`; unit binds `HOST=0.0.0.0 PORT=8310` | On the audited box the equivalent local surface answered `/health` 200 with shapes `uiPanel_write, uiQuestion_write, uiFeedback, interactorObservation/Event/Assertion/Attachment, renderPolicy(_write), surfaceIntent` | verified-live (expired) |
| 18 | Type a request in plain language | `docs/HUMAN_SURFACE.md:139-149`; impl `repos/human-surface-vessel/ui/src` (AskRegion, RunRow, DetailPanel, EvidenceLedger, GapStrip); dispatch proxied to goal-host | On a UI-only spoke every dispatch crosses the network (`docs/HUMAN_SURFACE.md:166-170`). Not exercised — dispatching is forbidden | unverifiable-here |
| — | (minor internal inconsistency, verdict-added) | `ui-only-up.sh:677` vs `:686` | The comment at `:677` claims transport health is "part of the verdict", but `PASS_FED` is absent from the `:686` loop. The code (advisory) is right; the comment is stale | doc-code-mismatch |

- **Step 9 (corrected by verification: not "redundant").** The audited box had **no** `.service.d/host.conf`
  directory at all and the unit still carried `Environment=… HOST=0.0.0.0` from the manifest — positive proof
  that box never ran `ui-only-up.sh`. But by the volume-authoritative rule (F1-P6 step 1) the value that reaches
  `render-unit.sh` comes from `/workspace/substrate/fleet/vessels.manifest.json`, not from the repo or the
  image, and pull-sync's update of that copy is inert until the next restart. So the drop-in is redundant **only**
  for a container whose volume manifest carries `HOST=0.0.0.0` — which must be read, not inferred. Writing it
  unconditionally is correct belt-and-braces.
- **Step 10 (corrected by verification: the map said manifest vessels "are never selected by `ENABLED_VESSELS`").**
  The operational conclusion — it must be installed by `vessel-ctl` here — is right, but the mechanism is wrong.
  `apply-inventory.sh:92 manageable_units()` excludes `manifest:true`, but the `ENABLED_VESSELS` branch
  (`:178-180`) resolves through `all_units()` (`:94`), which **includes** manifest entries. A manifest vessel
  therefore *can* be named into DESIRED; what protects it is that the mask/unmask/enable loop (`:285`) iterates
  `manageable_units()`, so it is silently neither enabled nor masked. That is a selection an operator can write,
  that reports no error, and that does nothing.
- **Step 14.** Not exercisable: `cat /proc/1/environ` → `HUB_DISCOVERY_URL=` (empty), `ENABLED_ROLES=` (empty).
- **Step 7 note.** `make up` ends in `substrate-doctor` **without** `|| true`; on a trimmed fleet the doctor
  legitimately exits 1. `ui-only-up.sh:476-498` suspends `set -e` for exactly this pipeline and downgrades to a
  WARNING, gating instead on the container actually running. The comment at `:476-482` records that this
  downgrade was previously unreachable under `set -euo pipefail`, so steps 3–10 never ran and the surface was
  never installed.

**End state.** A container publishing 18080/18090/18100/18101/18210/18250/18260/18270/18310 (+offset) of which
only discovery, the federation transport and the surface actually serve; the surface's `uiPanel_write` et al.
mirrored into the hub's registry as `<vessel>@<FED_SUBSTRATE_ID>`; a browser page at `http://127.0.0.1:18310`.
**How to verify it actually worked.** Read the VERDICT block's **hub-registry** line, not the exit code and not
`docker ps`. `docker exec <container> vessel-ctl status` for the roster. Most published 18xxx ports legitimately
answer nothing on a spoke.

---

### F3-P2 — Update a running surface's UI bundle

**Purpose.** Ship a UI change to a deployed surface without a toolchain, a build at boot, or a credential merely
to render a page.
**Trigger.** A commit lands on `repos/human-surface-vessel`; `substrate-pull-sync` pulls it into the in-container
clone.
**Preconditions.** `ui/dist` is TRACKED in git; `substrate-pull-sync.timer` + `.service` both in the selection.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Commit a `ui/src` change together with its rebuilt `ui/dist` | `docs/HUMAN_SURFACE.md:236-241`; impl `scripts/git-hooks/pre-commit:361-395` (verified at `:373-401`) | A **gate**, not a convention: staged `ui/src` without staged `ui/dist` prints the banner and `exit 1`. Cannot cover a commit path that skips hooks — substrate-authored commits included | verified-in-code |
| 2 | `git pull` brings the built bundle with the source | `docs/HUMAN_SURFACE.md:226-229`; impl `repos/human-surface-vessel/.gitignore:10` (`# NOT ui/dist/ — it is TRACKED on purpose`) | No build on the box | verified-in-code |
| 3 | Do **NOT** rebuild on the container | `docs/HUMAN_SURFACE.md:230-235`; impl `vessels.manifest.json:29` post_install | Writes `UI_BUILD_SKIPPED (dist came from git — rebuilding would dirty tracked files and wedge pull-sync)` when `index.html` exists. A rebuild does not reproduce the bundle byte-for-byte, would leave modified tracked files, make `git pull --ff-only` refuse, and stop the deployment converging | verified-in-code |
| 4 | Restart the unit so the server serves the new dist | `docs/HUMAN_SURFACE.md:228-229`; impl `human-surface-vessel.service` `Restart=always RestartSec=5`; ExecStartPre repairs an incomplete install | Not exercised (restart forbidden) | unverifiable-here |
| 5 | Verify the **BUNDLE**, not the commit: compare the `assets/index-*.js` the page references against disk | `docs/HUMAN_SURFACE.md:242-243` | On the audited box they matched exactly | verified-live (expired) |

- **Step 1 capability control (verdict-added).** `git config --get core.hooksPath` →
  `/home/avi/documents/work/substrate/scripts/git-hooks`, and `.git/hooks/` holds no non-sample hooks — the gate
  is genuinely **armed** in this clone. `git -C repos/human-surface-vessel ls-files ui/dist` →
  `ui/dist/assets/index-B49pmsY7.css`, `ui/dist/assets/index-CecXPzuR.js`, `ui/dist/index.html`.
- **Step 5 evidence (expired).** In-container
  `/workspace/git/super-repo/repos/human-surface-vessel/ui/dist/assets/` = `index-B49pmsY7.css`,
  `index-CecXPzuR.js` (both Aug 16 13:24); both the in-container and the repo-committed `index.html` reference
  `/assets/index-CecXPzuR.js` + `/assets/index-B49pmsY7.css`.

**End state.** The served bundle is byte-identical to the one in git, and `git pull --ff-only` keeps converging.
**How to verify it actually worked.** Diff the asset filenames in the served `index.html` against
`repos/human-surface-vessel/ui/dist/index.html`. `git log -1 -- repos/human-surface-vessel/ui/dist` proves the
bundle travelled with the source.

---

### F3-P3 — Recreate / stop-start a surface container

**Purpose.** Restart or rebuild a surface without losing its identity, its learning state, or its install.
**Trigger.** Operator maintenance, or a Makefile `recreate`.
**Preconditions.** Named volumes `${NAME}-workspace` and `${NAME}-surreal` survive the container.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `docker stop` / `docker start` | `docs/HUMAN_SURFACE.md:275-291`; impl secrets at `/workspace/.substrate-secrets`; `FED_SUBSTRATE_ID` persisted by gen-env | Survives cleanly and re-registers. Two prerequisites were silently false until tested: the secrets file had two writers that each truncated it, and `FED_SUBSTRATE_ID` regenerated per boot, appearing on the hub as a NEW substrate | documented-only |
| 2 | `make recreate` — **DESTROYS the surface install** | `docs/HUMAN_SURFACE.md:245-258`; impl `Makefile:518-565` | `ui/dist` survives (volume). What is destroyed is `/etc/systemd/system/human-surface-vessel.service` and the `HOST=0.0.0.0` drop-in — both outside the volume. Re-running `ui-only-up.sh` is the fix, but it refuses an existing container name | documented-only |
| 3 | (hazard) recreate re-injecting the operator's provider key | `docs/HUMAN_SURFACE.md:259-265`; impl `Makefile:500-515` | `RECREATE_CARRY_PRESENT` carries provider keys by PRESENCE, empty included, because the value loop skips empties and a deliberate blank looks identical to "not set". Measurement in the Makefile comment: len 0 → 108 on a UI-only spoke | verified-in-code |
| 4 | (hazard) a federation transport in a restart loop reports `activating`, never `failed` | `docs/HUMAN_SURFACE.md:266-271` | Invisible to `--state=failed` and to substrate-doctor's failed-unit check, which passed on a surface whose transport had restarted 222 times | documented-only |
| 5 | Judge whether the restart worked | `docs/HUMAN_SURFACE.md:288-291` | Do **NOT** ask whether the hub still lists the shapes — registry records outlive the writing process by the TTL. Ask whether the record was **REFRESHED** after the restart | documented-only |

- **Step 4 control (expired).** The surface on the audited box had `NRestarts=0`, `MainPID=2280`,
  `ExecMainStartTimestamp Sun 2026-08-23 01:00:37 UTC` — a genuinely stable unit, so that deployment did not
  exercise the trap.

**End state.** A container back up with its identity, secrets and (for stop/start only) its surface install
intact.
**How to verify it actually worked.** Registry record **freshness** after the restart, plus `vessel-ctl status`
`restarts=` — not `is-active`, not the presence of a registry row.

---

### F3-P4 — Obsidian intake

**Purpose.** The ambient human↔substrate loop: the operator writes an unchecked task in `Substrate/Inbox.md` and
the substrate acks on `Now.md` and serves the request.
**Trigger.** `obsidian-intake.timer`, `OnUnitActiveSec=2min`, `UnitFileState=enabled`.
**Preconditions.** An obsidian-vessel plugin reachable at `OBSIDIAN_PLUGIN_ENDPOINT`; `METABOB_API_KEY` in the
unit environment; development-vessel (8090), llm-resolver (8220), goal-host (8210) reachable.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `POST ${DEV}/v2/impulses/resolve {"impulse":{"pointer":{"type":"obsidian_request_scan","obsidianEndpoint":"${OBS}"}}}` | `obsidian-intake-tick.sh:4-7`; impl `:56-60`, `:27`; endpoint pinned by `gen-env.sh:799` | `{"success":true,"shape":"obsidianRequestScan","body":{"unreachable":true,"stage":"read_inbox","detail":"Unable to connect…"}}` — **every single tick** | known-broken |
| 2 | `RF=$(jq '.body.requests_found // 0'); [ RF -gt 0 ] && date -u +%s > /workspace/last-human-activity` | `obsidian-intake-tick.sh:62-65` | Never fires. The file was stale at `1783393402` = 2026-07-07 03:03:22 UTC — the last time this loop did real work, ≥49 days prior | verified-live (expired) |
| 3 | Read standing guidance from `/vaults/substrate-vault/Substrate/Feedback.md` | `obsidian-intake-tick.sh:67-77`; impl `:71-77` (guarded by `[ -f "${FB_FILE}" ]`) | Path does not exist on this deployment → GUIDANCE always empty, `ANS_TOKENS` stays 700. Degrades silently and correctly; the human-teaches-interaction channel is simply absent | verified-live (expired) |
| 4 | For each picked-up request: `classify_request` via one Haiku call | `obsidian-intake-tick.sh:32-53,85`; impl `:41-52` | Defaults to ANSWER on any failure or timeout. Unreachable in practice — the `while read` loop at `:80` iterates `.body.requests[]?`, always empty | verified-in-code |
| 5 | DEVELOP → write a `substrateGap` (`human-request-<slug>`) + an ack note under `Substrate/Responses/` | `obsidian-intake-tick.sh:88-113`; impl `:93-113`, vessel-hint regex `:94` | Routes a human's improvement request into the autonomous gap-compose → feature_compose → quality-gate → cutover loop. Never reached | verified-in-code |
| 6 | ACTION → `POST ${GOALHOST}/run-goal` with `expected_output_shapes:["obsidian:note"]`, write a `performing (dispatch <id>)` breadcrumb | `obsidian-intake-tick.sh:114-129` | Never reached | verified-in-code |
| 7 | ANSWER → `obsidian_deliver_assist` into `Substrate/Responses/<slug>.md` | `obsidian-intake-tick.sh:130-141` | Never reached | verified-in-code |
| 8 | systemd records the outcome | impl `obsidian-intake.service` (oneshot) | `Result=success`, `ExecMainStatus=0`, `Finished obsidian-intake.service` — every two minutes, indefinitely, while doing nothing. The tick sets `set -uo pipefail` **without `-e`** and never inspects `.body.unreachable` | known-broken |

- **Step 1 evidence (expired).** `journalctl -u obsidian-intake` → 2586 lines containing `"unreachable":true` and
  **ZERO** containing `requests_found`, across the whole available journal. Earliest entry 2026-08-21T12:24:32 was
  itself already unreachable — the journal is boot-capped, so the outage **predates the window**. In-container
  `ss -ltn`: nothing on 27182. `ls -d /vaults/substrate-vault` → No such file or directory.

**End state.** Intended: the operator sees an ack in `Now.md` within ~2 minutes. Actual on the audited
deployment: nothing, with a green schedule.
**How to verify it actually worked.** Do **NOT** read systemd. Read the tick's own JSON body:
`journalctl -u obsidian-intake -n 5` and check `.body.unreachable` and `.body.requests_found`. A positive looks
like `requests_found > 0` **plus** a fresh mtime on `/workspace/last-human-activity`.

---

### F3-P5 — Obsidian learn

**Purpose.** Learn the Obsidian command surface and build a forward model of the operator, then render what was
learned back onto the vault board.
**Trigger.** `obsidian-learn.timer`, `OnUnitActiveSec=30min`.
**Preconditions.** A reachable plugin; development-vessel serving the `obsidian_*` pointer types.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `obsidian_request_scan` (a SECOND intake, duplicating F3-P4 step 1) | `obsidian-learn-tick.sh:16-30`; impl `:23-30` | `unreachable:true` | known-broken |
| 2 | `obsidian_learn_commands learnMode=catalog grantedClasses=[navigate] maxCommands=10` | `obsidian-learn-tick.sh:32-40` | `{"learned":0,"persisted":0,"unreachable":true}` | known-broken |
| 3 | `obsidian_behavior_scan` — build P(next-action\|current) from `obsidian:event_observed` | `obsidian-learn-tick.sh:42-52` | `{"modeled":0,"unreachable":true}` | known-broken |
| 4 | `obsidian_reflect` — render what was learned onto the vault board | `obsidian-learn-tick.sh:54-64` | Partially works: `{"render_path":"/workspace/vault-render/Workflow.md","wrote":true,…,"vault_write":{"wrote":false,"reason":"Unable to connect…"},"behavioural_models":4,"command_surface":200}` — the top-level flag describes the **wrong artifact** | known-broken |
| 5 | `obsidian_ui_perception_scan` — the substrate reads its own UI artifacts back | `obsidian-learn-tick.sh:66-77`; impl development-vessel resolver registry | `{"success":false,"error":"Unknown pointer type: obsidian_ui_perception_scan"}` — the pointer type does not exist. No error handling on this call | doc-code-mismatch |
| 6 | `obsidian_assist_bridge` | `obsidian-learn-tick.sh:82`; impl `call()` at `:81` pipes to `head -c 300` and never checks `.success` | `{"success":false,"error":"Unknown pointer type: obsidian_assist_bridge"}` | doc-code-mismatch |
| 7 | `POST goal-host /run-goal targetTemplateId=proposed_pattern_authored_obsidian_assist_active_note` | `obsidian-learn-tick.sh:83-84` | **A REAL goal dispatch fires every 30 minutes** on a box where its output can never reach a vault | verified-live (expired) |
| 8 | `obsidian_deliver_assist` → `Substrate/Assists/next-actions.md`, then `obsidian_assist_feedback_scan` | `obsidian-learn-tick.sh:85-86` | `{"delivered":false,"unreachable":true,"stage":"workspace"}` and `{"unreachable":true}` | known-broken |
| 9 | systemd records the outcome | impl `obsidian-learn.service` (oneshot) | `Result=success`, `ExecMainStatus=0`, `Finished` — including the two Unknown-pointer-type failures | known-broken |

- **Steps 5–6 (confirmed with a positive control).** `rg 'obsidian_ui_perception_scan|obsidian_assist_bridge'
  repos/development-vessel/src` → no matches. Control in the same query shape:
  `rg -no 'obsidian_[a-z_]+' repos/development-vessel/src | sort -u` returns 24 pointer types that DO exist
  (`obsidian_request_scan`, `obsidian_reflect`, `obsidian_deliver_assist`, `obsidian_learn_commands`,
  `obsidian_behavior_scan`, `obsidian_assist_feedback_scan`, …) — the tool works and the negative is real.

**End state.** Intended: a growing command catalogue, a behaviour model, a rendered board. Actual: `learned:0`,
`persisted:0`, `modeled:0`, two dead resolvers, one live goal dispatch every 30 minutes.
**How to verify it actually worked.** Check `learned`/`persisted`/`modeled` in the tick's own JSON, and grep the
journal for `"success":false` — the script never surfaces those.

---

### F3-P6 — Obsidian collaborate

**Purpose.** Earn continued human engagement by contributing one genuinely useful step toward the operator's own
goal each pass.
**Trigger.** `obsidian-collaborate.timer`, `OnUnitActiveSec=45min`.
**Preconditions.** A reachable plugin and a vault at `/vaults/substrate-vault`.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Read standing guidance from `${FB_FILE}` | `obsidian-collaborate-tick.sh:24-28` | File absent; GUIDANCE empty, falls back to the inline default at `:44` | verified-live (expired) |
| 2 | Engagement-aware back-off: skip if idle ≥3 h **AND** ≥2 un-engaged collaboration notes | `obsidian-collaborate-tick.sh:30-42`; impl `:38` (`find … 2>/dev/null \| wc -l`), `:39` | **The guard can NEVER fire** on any deployment without that vault path: `find` errors to `/dev/null`, `wc -l` returns 0, and `0 >= 2` is false however idle the human is | known-broken |
| 3 | `POST obsidian_deliver_assist` → `Substrate/Collaboration/toward-your-goal-<TS>.md`, maxTokens 1400 | `obsidian-collaborate-tick.sh:46-52` | `{"success":true,"shape":"obsidianAssistDelivered","body":{"delivered":false,"unreachable":true,"stage":"workspace"}}` | known-broken |
| 4 | `echo " <- collaboration contribution delivered (Substrate/Collaboration/)"` | `obsidian-collaborate-tick.sh:53` | An **unconditional** newline-terminated echo, not tested on the response and not `&&`-chained. The journal reads `delivered:false, unreachable:true` on one line and `collaboration contribution delivered` on the next, 0 seconds apart | known-broken |

**End state.** Intended: one substantive note per 45 minutes under `Substrate/Collaboration/`, with
`obsidian_assist_feedback_scan` measuring engagement. Actual: nothing written, an unconditional success line, and
a back-off that cannot engage.
**How to verify it actually worked.** Read `.body.delivered` from the resolver response, never the trailing echo.
A positive is `delivered:true` plus a new file under `Substrate/Collaboration/`.

---

### F3-P7 — In-container Obsidian desktop (substrate-obsidian flavour)

**Purpose.** Run Obsidian itself inside the substrate so the plugin talks to activity-api / concept-db /
goal-host over plain localhost, with the GUI exported over noVNC.
**Trigger.** Boot of a container built from the substrate-obsidian flavour (`make run-live-obsidian`,
`Makefile:649`).
**Preconditions.** The `:obsidian` image; role `desktop`, which is in the `full` role group only.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `obsidian-xorg.service` starts the display stack: `Xvfb :0 1600x900x24`, fluxbox, `x11vnc -rfbport 5900 -threads` | `obsidian-xorg-launch.sh:1-10`; impl `:19-45` | Xvfb is the foreground process, so the unit restarts the whole stack if it dies. **SKIPPED** on a base-image box: `Result=exec-condition`, `ConditionResult=no` | verified-live (expired) |
| 2 | `ExecCondition=/bin/sh -c 'command -v obsidian >/dev/null'` | `/lib/systemd/system/obsidian-desktop.service:18-20` | The flavour gate. An ExecCondition skip is not a failure, so these units never pollute `--state=failed` and never crash-loop on the base image. **This is the one honest absence-handling in this family** | verified-live (expired) |
| 3 | Write the vault plugin config: jq-merge `activityApiUrl`/`websocketUrl`/`conceptDbEndpoint`/`goalHostEndpoint`/`discoveryVesselEndpoint` + `apiKey` into `<vault>/.obsidian/plugins/obsidian-vessel/data.json` | `obsidian-desktop-launch.sh:26-53`; impl `:37-53` | **CREATES** the file when missing (a patch-if-exists block would silently skip on a fresh boot and leave `activityApiUrl=""`) | verified-in-code |
| 4 | Register the vault in `/root/.config/obsidian/obsidian.json` under `substratevault0000` | `obsidian-desktop-launch.sh:55-61` | Opens without the vault picker | verified-in-code |
| 5 | Pre-dismiss the vault-trust modal by seeding a CRC-valid leveldb carrying `enable-plugin-substratevault0000="true"` | `obsidian-desktop-launch.sh:63-93`; impl `:82-93` | Necessary: listing the plugin in `community-plugins.json` is NOT sufficient — with that key null Obsidian stays in Restricted Mode until a human clicks "Trust author". Three base64 blobs, grep-guarded so idempotent | verified-in-code |
| 6 | Ensure `obsidian-vessel` is in `<vault>/.obsidian/community-plugins.json` | `obsidian-desktop-launch.sh:95-106` | Belt-and-suspenders alongside the trust flag | verified-in-code |
| 7 | `exec /opt/obsidian/obsidian --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` | `obsidian-desktop-launch.sh:108-138` | The throttling flags are load-bearing: a headless window is always "occluded" to Chromium, which throttles JS timers to ~1 Hz and would throttle every interval-driven plugin loop | verified-in-code |

**End state.** Obsidian running on a persistent virtual display, plugin auto-loaded and pointed at localhost
fleet ports, GUI reachable over noVNC on host `:16080`.
**How to verify it actually worked.** `systemctl show obsidian-desktop -p Result` — **on the base image the
correct answer is `exec-condition`, NOT `success`**; a `failed` or a rising `NRestarts` would mean the flavour
gate broke.

---

### F3-P8 — Deploy a substrate-authored Obsidian plugin change

**Purpose.** Turn a landed `repos/obsidian-vessel/src` change into a live UI feature — the running plugin loads a
BUILT `main.js` from the vault, so source alone changes nothing.
**Trigger.** Manual: `bash scripts/substrate/obsidian-plugin-reload.sh`. **Nothing schedules it**; no timer or
unit references it.
**Preconditions.** `bun` on the box; `OBSIDIAN_PLUGIN_DIR` pointing at the real vault plugin directory; a live
reload endpoint (optional).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `cd $REPO_DIR && bun run build` | `obsidian-plugin-reload.sh:32-35`; impl `:25-26` | `SUPER_REPO` derived from the script's own location, deliberately — the previous hardcoded default named a checkout 228 commits behind `origin/dev` and would have silently reverted every landed UI change | verified-in-code |
| 2 | Copy `main.js` + `manifest.json` (+ optional `styles.css`) into `$PLUGIN_DIR` | `obsidian-plugin-reload.sh:37-67`; impl `:52-56` | Skips the copy when source and destination are the same file (`-ef`) — the vault artifacts are SYMLINKS into the repo in the standard setup, and `cp a b` on the same file fails, which under `set -e` aborted the script before the reload | verified-in-code |
| 3 | `PLUGIN_DIR="${OBSIDIAN_PLUGIN_DIR:-/home/projects/vaults/syzygy/.obsidian/plugins/obsidian-vessel}"` | `obsidian-plugin-reload.sh:27` | A host-specific absolute literal on the line right after a comment explaining why `REPO_DIR` was made location-independent to satisfy law 11. Half the fix landed | doc-code-mismatch |
| 4 | `POST $OBSIDIAN_ENDPOINT/actions/reload-plugin` | `obsidian-plugin-reload.sh:69-83`; impl `:71-83` | Intentionally non-fatal; captures the HTTP code and prints manual toggle instructions on non-2xx. Default endpoint `127.0.0.1:27182` | verified-in-code |
| 5 | `log "SUCCESS: $copied bytes deployed to $PLUGIN_DIR; reload: $reload_status"; exit 0` | `obsidian-plugin-reload.sh:85-87` | Prints SUCCESS and exits 0 even when `reload_status` is `reload endpoint not live (HTTP 000)`. The word SUCCESS carries no information about whether the feature is live | doc-code-mismatch |

- **Step 3 (corrected by verification: the map claimed the path does not exist on this box and that `mkdir -p`
  would manufacture a decoy).** `ls -la /home/projects/vaults/syzygy/.obsidian/plugins/obsidian-vessel/` → the
  directory **exists** and contains `data.json` (2158 B, Aug 13) plus four **symlinks** — `main.js`,
  `manifest.json`, `sidecar`, `styles.css` → `/home/avi/documents/work/substrate/repos/obsidian-vessel/*`. That
  is exactly the symlink case the `-ef` guard at `:44-45` exists to handle. The portability defect (a host
  literal under a law-11 comment) stands; the `mkdir -p` decoy hazard is a claim about **other machines only**
  and must be stated that way.

**End state.** Intended: the new command/view registered in a running Obsidian without a restart.
**How to verify it actually worked.** The `reload-plugin HTTP <code>` line **above** the SUCCESS line, and the
new command actually appearing in Obsidian's command palette — not the exit code and not the word SUCCESS.

---

### F3-P9 — Asking a human a question (human-as-resolver)

**Purpose.** Let the walk ask a person rather than guess — the premise the whole human surface rests on.
**Trigger.** A walk that exhausts its selectable approaches, or a template task with `resolver:"human"`.
**Preconditions.** A vessel advertising the `human_input` shape; (for the surface) a renderer for the question.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | A template task declares `resolver:"human"` with `{question, options, default, timeoutSeconds, allowFreeform}` and `outputShapes` incl. `"clarification"` | `docs/guides/INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md:65-89` | The guide's own header (`:4-5`) says the CLI whose paths it cites is retired and the file paths are historical. The resolver pattern, TTY-aware fallback and `clarification` shape are asserted still correct; the cited `src/` paths are not checkable in this repo | documented-only |
| 2 | Non-TTY fallback: use `config.default`, else `options[0]`, else empty string with `aborted:true` | `docs/guides/INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md:139-147` | The guide's own rule: an activity that truly requires a human should OMIT `default` and error — "better to refuse than to silently degrade a gated decision" | documented-only |
| 3 | On a walk: `solicitHumanInput(goal, evidence, dispatchId)` before declaring honest failure | `validation/reports/HUMAN_SURFACE_INTERACTION_AUDIT.md:35-52`; impl `repos/goal-host-vessel/src/index.ts:12433` → `:12440` → `:12446` → `:12451` | **The solicitation is nested inside `if (attempt < maxAttempts)` AND inside `if (!alt)`**, so when the attempt budget runs out — the ordinary way a hard goal fails — the walk goes straight to honest failure without ever asking. The loop's only other exits are `:12431 if (reached \|\| !goal) break;` and falling off the counter | known-broken |
| 4 | The surface detects a pending question by scanning the walk log | `HUMAN_SURFACE_INTERACTION_AUDIT.md:57-71`; impl `ui/src/lib/walk.ts:80` (`SOLICITATION_MARKER` regex), `:90-98` (`detectSolicitation`, gated on `walk.status !== "running"`) | Still a regex over log prose, still gated on `status==='running'`. Combined with the walk tapping nothing while the question is open, the question is announced only after it has stopped being answerable. Consumed at `components/RunRow.tsx:70` and `components/DetailPanel.tsx:139` | known-broken |
| 5 | The walk asks through `uiQuestion_write`, which the surface serves | `HUMAN_SURFACE_INTERACTION_AUDIT.md:76-88`; impl `src/store.ts:142 listPanels()`, `src/index.ts:80 app.get("/api/state", …)` | **A question region DOES exist** — `ui/src/components/SolicitationPanel.tsx` (113 lines), imported at `DetailPanel.tsx:32` and rendered at `DetailPanel.tsx:259`. What has no renderer is the `uiQuestion_write`/`uiPanel_write` **store** specifically: the panel is fed by the walk-log regex, not by `/api/state` | doc-code-mismatch |
| 6 | The surface itself advertises `human_input` so the person at the page is one of the humans the walk can reach | `HUMAN_SURFACE_INTERACTION_AUDIT.md:72-74`; impl `repos/human-surface-vessel/src/config.ts:58` `DISCOVERY_SHAPES` | **It does not.** `:60` shows `"uiQuestion_write"` present in the array (control), while `rg 'human_input' repos/human-surface-vessel/src` → no matches at all. Since `solicitHumanInput` looks up a producer of `human_input`, the browser surface cannot be that producer | verified-in-code |

- **Step 5 (corrected by verification: the map concluded "the question is stored, readable, and never rendered …
  fixing this needs a renderer, not a route").** The literal negative reproduces
  (`rg 'api/state|uiQuestion|panels' ui/src` → no matches; control `rg -li 'panel' ui/src` → 12 files), but one
  of those 12 files is `SolicitationPanel.tsx`. The real defect is **narrower** and is stated by the component
  itself (`SolicitationPanel.tsx:7-14`): the walk log carries the question text but usually **not** its
  `solicitation_id`, and when `solicitationId` is null the panel tells the human "there is no way to answer it
  from here — the run will time out on its own." **The fix is an ID linkage (mirroring `human_input` onto the
  dispatch record), not a renderer.** The map's own step 4 documents `detectSolicitation` and its consumption at
  `DetailPanel.tsx:139` — its step 5 contradicted its step 4.
- **Step 6 status change.** The map's live `/health` probe is expired; the claim now rests on
  `config.js:58-60` plus the `rg` negative with an in-array positive control.

**End state.** Intended: a person answers, the answer is injected as `human_input` and grants one retry of the
last excluded approach. Actual: the branch is unreachable on the common failure path, and the shape the surface
does serve has no ID linkage back to the dispatch.
**How to verify it actually worked.** Dispatch a hard goal and check goal-host's journal for a solicitation
attempt in the same window, and the surface for a rendered question **carrying a non-null `solicitationId`**.
Not exercised here — dispatching is forbidden by the audit constraint.

---

## 6. Family 4 — Federation, spokes & p2p

14 processes, 90 steps. Hub-side observations against `syzygy.host` (resolves to 104.236.0.175) are still
reproducible; local observations are expired. **Note, verdict-added:** the relay advertised in syzygy's
`/bootstrap` lives on `138.197.116.56:30333` — a **different host** from the hub at 104.236.0.175. Neither
family map states this, and it is exactly the shape of the stale-relay.log divergence
`deploy-hub-pull.sh:83-95` exists to survive.

### F4-P1 — Point-and-go join contract (`GET /bootstrap`)

**Purpose.** Let a fresh, keyless client learn the relay anchor, identity authority and canonical discovery URL
from ONE endpoint, so a join needs only `{discovery endpoint, API key}`.
**Trigger.** Any joining party with no `RELAY_MULTIADDR` configured.
**Preconditions.** A reachable discovery-vessel. Nothing else — the route is pre-auth.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `curl -s http://<discovery>:18100/bootstrap` | `docs/FEDERATION.md:12-22`; impl `repos/discovery-vessel/src/index.ts:158-189`; PUBLIC_PATHS exemption in `repos/discovery-vessel/CLAUDE.md` | Returns `{relay_multiaddrs, identity_endpoint, discovery_endpoint, prefer_transport}` | verified-live |
| 2 | `relay_multiaddrs` is computed: `RELAY_MULTIADDR` env, else derived by stripping `/p2p-circuit` off any registered vessel's `libp2p_multiaddr` | `docs/FEDERATION.md:29-34`; impl `index.ts:159-170` | With `RELAY_MULTIADDR=""` and no circuit-carrying registrations, the array is `[]` | verified-live (expired) |
| 3 | `identity_endpoint` / `discovery_endpoint` computed from `IDENTITY_PUBLIC_URL` → `PUBLIC_IP`/`FED_PUBLIC_IP` → `IDENTITY_VESSEL_URL` → `""` | `docs/FEDERATION.md:15-22`; impl `index.ts:171-180` | On a standalone with no PUBLIC_IP, `identity_endpoint` degrades to the **LOOPBACK** `IDENTITY_VESSEL_URL` and `discovery_endpoint` to `""` — both useless to a remote joiner, with no warning and a 200 | verified-live (expired) |
| 4 | Pre-flight: `curl -s http://<hub>:<disc-port>/bootstrap \| jq '.relay_multiaddrs \| length'` (must be > 0) | `docs/FEDERATION.md:180`; impl `index.ts:164-170` | Correctly distinguishes a hub from a `role=hub` container | verified-live |

- **Steps 1/4 live evidence (still reproducible).** `curl -s http://syzygy.host:18100/bootstrap`, no
  Authorization header, HTTP 200 → `{"relay_multiaddrs":["/ip4/138.197.116.56/tcp/30333/p2p/
  12D3KooWJ9JdvMHo8JyR9q78FxLdr5Ghr9EhmzJExVDSwhC42mUJ"],"identity_endpoint":"http://104.236.0.175:18101",
  "discovery_endpoint":"http://104.236.0.175:18100","prefer_transport":"libp2p"}`. Negative on the audited local
  box: `relay_multiaddrs: []` (expired). Positive control = syzygy's non-empty array.
- **Steps 2/3 code half (independent of any fleet).** `index.ts:159-166` (relayEnv split, else `relayFromCircuits`
  stripping at `/p2p-circuit`), `:171-175` identity chain, `:176-180` discovery chain **with no
  `IDENTITY_VESSEL_URL`-equivalent fallback**. There is no status-code branch anywhere in the handler: it is an
  unconditional `c.json(...)` = 200.

**End state.** The joiner holds a relay multiaddr, an identity endpoint and a canonical discovery URL, or knows
the target is not a hub.
**How to verify it actually worked.** `relay_multiaddrs` length > 0 **AND** `identity_endpoint` is not a loopback
address. The second half is **not** part of the documented pre-flight, and the audited standalone shows why it
should be.

---

### F4-P2 — Hub deploy: `deploy-hub.sh` (clone + build on the VM)

**Purpose.** Stand up the shared-namespace hub: control plane + store + relay on a public VM.
**Trigger.** Operator, first hub deploy or a full rebuild.
**Preconditions.** SSH to the VM; `ANTHROPIC_API_KEY`; VM public IPv4; `GITHUB_PAT` only for a private fork.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `GITHUB_PAT=… ANTHROPIC_API_KEY=… SSH_KEY=… bash scripts/substrate/deploy-hub.sh root@<vm-ip> <vm-public-ip>` | `docs/FEDERATION.md:130-131`; impl `deploy-hub.sh:29-44`, `:39-40` | TARGET and PUBLIC_IP are positional and required; `GITHUB_PAT` is **OPTIONAL** (`:39-40` prints a notice and clones anonymously). The doc shows it as if required | doc-code-mismatch |
| 2 | `apt-get install git make jq unzip; curl get.docker.com` | `docs/FEDERATION.md:137`; impl `deploy-hub.sh:56-62` | Bare-Ubuntu deps auto-installed as documented | verified-in-code |
| 3 | clone/pull `AviGopal/substrate@dev`, init submodules, warn on `+` staleness, `reset --hard` each submodule | `docs/FEDERATION.md:134-136`; impl `deploy-hub.sh:84-112`, `:105-109` | Staleness is a WARNING only — a stale submodule still gets baked | verified-in-code |
| 4 | `make -C scripts/substrate build` | `docs/FEDERATION.md:134`; impl `deploy-hub.sh:119` | 20–30 min image build on the VM | unverifiable-here |
| 5 | `docker stop -t 300 substrate-live; docker rm -f; docker volume create substrate-{surreal,workspace}` | impl `deploy-hub.sh:122-130` (not in FEDERATION.md) | Graceful drain before replacement; learning volumes preserved | verified-in-code |
| 6 | `RELAY_MULTIADDR=$(grep -oE '/ip4/[^ "]*p2p/[A-Za-z0-9]+' "$HOME/relay.log" \| tail -1)` | impl `deploy-hub.sh:136-138` (undocumented) | On the FIRST deploy no `relay.log` exists → the hub starts with `RELAY_MULTIADDR` empty and federation egress disabled; the script says re-run. A `relay.log` left by a hand-restarted relay with a different key file names a **DEAD peer id** and every advertised circuit is undialable | known-broken |
| 7 | `docker run -d --name substrate-live --privileged -e ENABLED_ROLES=hub -e ENABLED_EXTRA_VESSELS=<6 compute units> -e PUBLIC_IP -e FED_PUBLIC_IP -e RELAY_MULTIADDR -e FED_SUBSTRATE_ID=hub-<ip> -e HUB_DISCOVERY_URL=http://localhost:8100 -p 18080/18100/18101/18210/18090/18260` | `docs/FEDERATION.md:135-136`; impl `deploy-hub.sh:163-174`, rationale `:146-161` | `ENABLED_ROLES=hub` **excludes `compute`**, so goal-host and five siblings must be named explicitly or the hub answers no dispatches while looking healthy on :18080/:18100. `HUB_DISCOVERY_URL=localhost:8100` makes the hub its own mirror target → `SELF_MIRROR` true | verified-in-code |
| 8 | `docker exec substrate-live bun /vessels/seed-identity.ts` | `docs/FEDERATION.md:135`; impl `deploy-hub.sh:181-182` → `seed-identity.ts:165-167` | Signs up with the **HARDCODED** `org_name: "substrate"`, which `login.ts:333-334` slugifies to the fixed record id `organizations:substrate`. Every independently-seeded substrate gets the SAME `org_id` | doc-code-mismatch |
| 9 | `cd federation-relay && bun install`; prefer `systemctl start federation-relay.service`, else if nothing listens on :30333 → `PUBLIC_IP=… RELAY_KEY_FILE=$HOME/substrate-fed/relay-key.pb nohup bun relay.ts > ~/relay.log` | `docs/FEDERATION.md:122-124`; impl `deploy-hub.sh:186-199` | Relay started on the **host** (not in the container) with a pinned key file; an already-serving relay is deliberately left alone | verified-live |
| 10 | Open the cloud firewall: TCP 18080, 18100, 18101, 18210, 30333 | `docs/FEDERATION.md:139-141`; `deploy-hub.sh:209` | On the live hub only 18080, 18100, 18101 and 30333 answer; **18210, 18090 and 18260 are DROPPED** — the documented firewall set is not what is open | verified-live |

- **Step 8 (confirmed).** `seed-identity.ts:167 org_name: "substrate"` (sole occurrence);
  `repos/identity-vessel/src/resolvers/login.ts:333-334` —
  `const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,64) || 'org'; const orgRef =
  'organizations:'+slug` — deterministic, no entropy. The 409 collision guard at `login.ts:338-342` fires only
  WITHIN one datastore. `docs/FEDERATION.md:57-58` says the opposite.
- **Step 9 evidence (still reproducible).** `/dev/tcp/138.197.116.56/30333` connect succeeded; `/bootstrap`
  advertises that multiaddr. This proves a **listener**, not that the advertised peer id belongs to it.
- **Step 10 (corrected by verification: the map read the 000s as "consistent with the pull-path fleet").**
  Re-run with exit-code discrimination: `18080` → http=200 exit=0; `18210`/`18090`/`18260` → http=000 **exit=28
  (timeout)**; `30333` → exit=28; **negative control `19999`** (a port no deploy path publishes) → exit=28,
  identical. Raw TCP: `/dev/tcp/104.236.0.175/18100` OPEN, `/dev/tcp/104.236.0.175/18210` rc=124. The firewall
  half is CONFIRMED and *stronger* than stated — those ports are DROPPED, byte-identical to an unused port. But
  the **fleet inference must be withdrawn**: a dropped SYN carries no information about whether goal-host is
  running or which deploy script ran. Reading 000 as a masked vessel conflates a firewall DROP with an absent
  service.

**End state.** A public hub answering `/health` on the control-plane ports, serving a non-empty `/bootstrap`,
with a relay on :30333 and a seeded shared org.
**How to verify it actually worked.** `curl <hub>:18100/bootstrap | jq '.relay_multiaddrs|length'` > 0, **AND**
`curl <hub>:18210/health` (goal-host actually reachable) — the second is not in the script's own status block and
is currently failing on the live hub.

---

### F4-P3 — Hub redeploy: `deploy-hub-pull.sh` (ghcr image pull)

**Purpose.** ~2-minute hub code update by pulling the prebuilt image instead of rebuilding, preserving
learning-state volumes.
**Trigger.** Operator, after a push to `dev` publishes `ghcr.io/avigopal/substrate:dev`.
**Preconditions.** SSH to the hub VM; `ANTHROPIC_API_KEY`; the (public) ghcr package.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `GHCR_TOKEN=… GHCR_USER=… SSH_KEY=… ANTHROPIC_API_KEY=… bash deploy-hub-pull.sh root@<ip> <ip>` | `deploy-hub-pull.sh:13-15`, `:23-37`; **not mentioned anywhere in `docs/FEDERATION.md`** | Credentials optional (`:27-33`). `docs/FEDERATION.md:145` asserts deploy-hub.sh "is the only *packaged* hub path", which this contradicts. The usage example also hardcodes a real IP, the exact practice `deploy-hub.sh:15-18` forbids | doc-code-mismatch |
| 2 | `docker pull $IMAGE; docker tag → metabob/substrate:dev` | `deploy-hub-pull.sh:39-62` | Anonymous pull path reachable (the former `:?` guards were removed) | verified-in-code |
| 3 | `docker stop -t 300 / rm -f substrate-live`, volumes untouched | `deploy-hub-pull.sh:64-74` | Thompson posteriors / trace store / identity survive the swap | verified-in-code |
| 4 | Determine `RELAY_MULTIADDR`: managed unit → journalctl; else if :30333 busy → leave it; else hand-start with the pinned key file; finally fall back to `~/relay.log` | `deploy-hub-pull.sh:83-110` | Three-way resolution designed around the observed divergent-peer-id incident. The last fallback still trusts `relay.log`, the artifact that went stale | verified-in-code |
| 5 | Thread host `/etc/environment` LLM keys + optional `API_KEY_SECRET` into the container | `deploy-hub-pull.sh:113-133` | Prevents the documented failure where two swaps silently killed non-anthropic arms (`ExecCondition` on key presence) | verified-in-code |
| 6 | `docker run -d … ENABLED_ROLES=hub … -p 18080/18100/18101/18210` | `deploy-hub-pull.sh:135-147`, `:139`, `:145` | Unlike `deploy-hub.sh:171-172` this does **NOT** publish 18090 (development-vessel) or 18260 (concept-db), and does **NOT** set `ENABLED_EXTRA_VESSELS`. **The two hub deploy paths produce DIFFERENT fleets from the same role name** | doc-code-mismatch |
| 7 | Write `/etc/systemd/system/federation-transport-vessel.service` by heredoc, `daemon-reload`, `enable --now` — only if `RELAY_MULTIADDR` non-empty | `deploy-hub-pull.sh:155-190`, `:161`, `:188-190` | The transport unit is not in the image (manifest vessel), so this installs it by hand. With no relay multiaddr the step is skipped and every cross-substrate resolve dies with `forward_failed` — logged as a WARNING, not a failure | verified-in-code |
| 8 | unmask + enable `llm-resolver-vessel` when provider keys exist in `/etc/environment` | `deploy-hub-pull.sh:192-204` | Hub carries multi-provider LLM arms even though `ENABLED_ROLES=hub` masks role=compute | verified-in-code |

- **Step 6 (confirmed).** `deploy-hub.sh:165` sets `-e ENABLED_ROLES=hub -e
  ENABLED_EXTRA_VESSELS="${ENABLED_EXTRA_VESSELS:-$HUB_EXTRA_VESSELS}"` with `:171-172` publishing 18090 and
  18260; `deploy-hub-pull.sh:139` sets `-e ENABLED_ROLES=hub -e SUBSTRATE_BIND_HOST=0.0.0.0` with no
  `ENABLED_EXTRA_VESSELS`, and `:145` publishes only four ports. Since `roles.hub` = `[store, control, api,
  transport, seed, infra, registry, models]` and excludes `compute`, the pull path's hub carries **no**
  goal-host / development-vessel / concept-db at all.

**End state.** Hub running new code on preserved volumes, host relay untouched, egress transport installed if a
relay multiaddr was found.
**How to verify it actually worked.** Compare
`docker exec substrate-live systemctl show federation-transport-vessel -p MainPID -p NRestarts` before/after —
`is-active` is not sufficient because `Restart=always` turns a failure into `activating`.

---

### F4-P4 — Remote substrate deploy + optional relay + optional peering: `deploy-remote.sh`

**Purpose.** Ship a locally built image to a fresh VM, seed it, optionally run the public relay there and
optionally peer it to another substrate's discovery.
**Trigger.** Operator standing up a peer substrate (topology 2) or a remote fleet.
**Preconditions.** docker + ssh locally; a built image; `ANTHROPIC_API_KEY`.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `docker save $IMAGE \| gzip \| ssh <target> 'gunzip \| docker load'` | `deploy-remote.sh:11-15`; impl `:44-51` | 4–6 GB stream; no registry needed | verified-in-code |
| 2 | `docker run -d … -p 18080 18090 18100 18210 18250 18260 18270` (no `ENABLED_ROLES`) | `deploy-remote.sh:12`; impl `:71-75` | Full standalone fleet, NOT a hub role and NOT a spoke — it seeds its own identity | verified-in-code |
| 3 | `docker exec substrate-live bun /vessels/seed-identity.ts` | `deploy-remote.sh:78-79` | Mints `organizations:substrate` again (same literal). Isolation from the first substrate comes from a different `API_KEY_SECRET`, **not** from a different `org_id` | doc-code-mismatch |
| 4 | `PEER_DISCOVERY=<peer>:18100` → set `PEER_DISCOVERY_ENDPOINTS`, `MAX_PEER_DEPTH=1`, `FEDERATION_PEER_AUTH_MODE=hmac`, `FEDERATION_SIGNING_SECRET`; `systemctl restart discovery-vessel` | `deploy-remote.sh:17-18`; impl `:81-88`, `:86` | Turns on the pull leg. Pins `MAX_PEER_DEPTH=1` (code default is 2, `discovery index.ts:48`). Writes two variables **no code reads**. Never sets `HUB_API_KEY`, the only variable that makes a cross-namespace fan-out authenticate | known-broken |
| 5 | `RUN_RELAY=1 PUBLIC_IP=<ip>` → tar the federation-relay dir over ssh, `bun install`, `pkill -f 'bun relay.ts'`, `nohup bun relay.ts` | `deploy-remote.sh:14-15`; impl `:93-108`, `:104` | This path **does** `pkill` — the exact hand-restart `deploy-hub-pull.sh:90-95` documents as producing a divergent peer id. It does pass the pinned `RELAY_KEY_FILE`, which mitigates it, but the two scripts give opposite instructions | doc-code-mismatch |

- **Step 4 (confirmed).** `deploy-remote.sh:86` writes `MAX_PEER_DEPTH=1`;
  `repos/discovery-vessel/src/index.ts:48 const MAX_PEER_DEPTH = parseInt(process.env.MAX_PEER_DEPTH ?? "2", 10)`,
  enforced at `:67` and `:109`. `docs/operations/FEDERATION_GENRES.md:120` says "two hops by default".
  `rg 'FEDERATION_SIGNING_SECRET' --glob '!node_modules' --glob '!*.md' .` returns **only writers**
  (`secrets.env.sh:41,77`; `gen-env.sh:478-479,858`; `vessels.manifest.json:50-51`; `deploy-remote.sh:38,86`) and
  zero readers.

**End state.** A standalone substrate on the VM, optionally relaying and optionally peered one-way.
**How to verify it actually worked.** On the peered substrate, a `vesselCapability` query for a shape only the
peer serves must return a row tagged `discoveredVia:"peer"`. The deploy's exit code proves nothing.

---

### F4-P5 — Manual hub bring-up on a non-VM container (the four-step block)

**Purpose.** Turn an `ENABLED_ROLES=hub` container into an actual hub — the role selection alone is not
sufficient.
**Trigger.** Operator standing up a hub locally or anywhere `deploy-hub.sh` does not apply.
**Preconditions.** docker; an address spokes can reach (not localhost).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `make -C scripts/substrate up LIVE_NAME=<hub> PORT_OFFSET=<n> ENABLED_ROLES=hub ANTHROPIC_API_KEY=…` | `docs/FEDERATION.md:156-157`; impl `Makefile` up target; role groups in `vessels.inventory.json` | Container answers `/health` on every port and serves an **EMPTY** `/bootstrap` — which by the doc's own pre-flight means "not a hub" | verified-live (expired) |
| 2 | `docker exec <hub> vessel-ctl install federation-relay` | `docs/FEDERATION.md:159`; impl `vessels.manifest.json:36-43`, `vessel-ctl.sh:150-241` | The relay is a **MANIFEST** vessel — never baked, never auto-installed by any role selection | verified-live (expired) |
| 3 | `docker exec <hub> sh -c 'echo PUBLIC_IP=<addr> >> /etc/substrate/env'; docker exec <hub> systemctl restart federation-relay` | `docs/FEDERATION.md:162-165`; impl `relay.ts:34,39`, `vessels.manifest.json:41` | Without `PUBLIC_IP` (or `FED_PUBLIC_IP`) `relay.ts` exits 1 at `:39`; under `restart:always` that is a **permanent crash-loop systemd reports as `activating`, never `failed`**. No launch path passes it — gen-env's emitted federation block (`:689-695`) writes neither | known-broken |
| 4 | `docker exec <hub> journalctl -u federation-relay \| grep -o 'RELAY_MULTIADDR=.*'`; then append it to `/etc/substrate/env` | `docs/FEDERATION.md:167-172`; impl `vessels.manifest.json:42`, `vessel-ctl.sh:240-241` | **The automatic capture is dead**: the post_install hook polls `/workspace/fed-relay.log` for 20 s and NOTHING in the repository writes that file. `vessel-ctl.sh:241` runs the hook as `csh "$post" >/dev/null 2>&1 \|\| true`, so the failure is invisible and the install still reports ok | known-broken |
| 5 | `docker exec <hub> systemctl restart discovery-vessel` | `docs/FEDERATION.md:173`; impl `index.ts:159` | Correct — `RELAY_MULTIADDR` is read from the process environment, and the process only re-reads `/etc/substrate/env` on restart. (Contrast `index.ts:44-47`, where the peer list IS read at use time) | verified-in-code |
| 6 | `curl -s http://<hub>:<disc-port>/bootstrap \| jq '.relay_multiaddrs \| length'` | `docs/FEDERATION.md:180`; impl `index.ts:164-170` | The one check that separates a hub from a `role=hub` container | verified-live |
| 7 | Addressing: use an address answering from BOTH the hub and inside the spoke container (usually the LAN IP), never localhost or the docker bridge gateway | `docs/FEDERATION.md:183-188`; impl `gen-env.sh:369-372` | Load-bearing: a localhost `DISCOVERY_ENDPOINT` makes gen-env classify the container as **root**, not spoke, so it never federates while booting healthy | verified-in-code |

- **Step 4 evidence.** `rg -n 'fed-relay\.log' -g'!node_modules' .` → 2 hits: `vessels.manifest.json:42` and
  `validation/reports/ROUND3_INVENTORY_AND_JOIN_DELTA.md:205` — a consumer and zero producers. `relay.ts:145`
  `console.log`s the multiaddr, which in the container path goes to the **journal**.

**End state.** A container whose `/bootstrap` advertises a live relay and whose relay unit is not crash-looping.
**How to verify it actually worked.** `relay_multiaddrs` length > 0 **AND**
`systemctl show federation-relay -p NRestarts` stable across two samples. `is-active` is worthless here.

---

### F4-P6 — Federated spoke join (point-and-go `make up`)

**Purpose.** Join a local fleet to a hub with one command: local registry + compute here, trace store + identity
on the hub, local surface mirrored into the hub namespace over the relay.
**Trigger.** Operator on the spoke machine.
**Preconditions.** A hub-issued `METABOB_API_KEY`; a hub discovery endpoint reachable from **inside** the spoke
container.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `make -C scripts/substrate up API_KEY=<hub-issued-key> DISCOVERY_ENDPOINT=http://<hub-host>:18100` | `docs/FEDERATION.md:200-203`; impl `Makefile:273`, `:605`/`:686` | Two inputs. `up` only resumes a stopped container when NO launch settings are supplied; changing hub/credential/role needs `make recreate` | verified-in-code |
| 2 | gen-env infers `role=spoke` from a REMOTE discovery host | `docs/FEDERATION.md:205-208`; impl `gen-env.sh:352-372` | Case on the parsed host: `""`/127.0.0.1/localhost/0.0.0.0/::1/`$(hostname)` ⇒ root; anything else ⇒ spoke. An unreachable remote is still a spoke (deliberate, `:366-368`) | verified-in-code |
| 3 | Derive hub discovery / activity store / identity endpoints from the one URL, honouring the supplied PORT | `docs/FEDERATION.md:206-208`; impl `gen-env.sh:373-400` | Sibling ports derived as `offset = disc_port - 18100` applied to 18080/18101; a non-18xxx port falls back to conventional siblings. The comment records the prior defect where the port was discarded and a spoke joined the WRONG fleet | verified-in-code |
| 4 | Auto-generate + persist `FED_SUBSTRATE_ID` / `FED_VESSEL_ID` | `docs/FEDERATION.md:208-209`; impl `gen-env.sh:154-160` | `FED_SUBSTRATE_ID=spoke-$(openssl rand -hex 4)` when unset. **The `spoke-` prefix is not evidence of spoke-ness** — the audited standalone carried `spoke-cfda39e7` with `HUB_DISCOVERY_URL=""` | verified-live (expired) |
| 5 | Fail closed when a spoke has no `METABOB_API_KEY`; waive the LLM-key requirement for a spoke | `docs/FEDERATION.md:212-213`; impl `gen-env.sh:247-252`, `:324-338` | Both guards exist and name the fix (`substrate-key issue`). The LLM waiver rests on the promise that a spoke inherits the hub's arms through discovery — the promise the doc's own warning block says is unmet | verified-in-code |
| 6 | `entrypoint.sh` auto-enables `federation-transport-vessel` when `HUB_DISCOVERY_URL` is set | `docs/FEDERATION.md:209-212`; impl `entrypoint.sh:54-73`, `:62-72` | Errors swallowed (`\|\| true`, `:64`) so a failed transport never blocks boot — and never announces itself | verified-live (expired) |
| 7 | The transport self-derives its relay from `${HUB_DISCOVERY_URL}/bootstrap` | `docs/FEDERATION.md:210-212`; impl `federation-transport-server.ts:43-61`, `:47-61` | `BOOTSTRAP_URL \|\| HUB_DISCOVERY_URL \|\| DISCOVERY`; takes `relay_multiaddrs[0]`. If still empty it prints an error and `process.exit(1)` — under `Restart=always` a crash-loop reporting `activating` | verified-in-code |
| 8 | gen-env defaults `PEER_DISCOVERY_ENDPOINTS` to `HUB_DISCOVERY_URL` so the spoke also SEES hub producers | `docs/FEDERATION.md:71-74`; `gen-env.sh:445-449`; impl `:457-459` | Precedence: explicit env > persisted explicit > hub derivation > empty. This is the pull leg that the warning block says fails | verified-in-code |
| 9 | Spoke resolves a hub-owned shape (`llmCompletion` / `activityTemplate`) | `docs/FEDERATION.md:214-230`; impl `repos/discovery-vessel/src/index.ts:253-281`, filter `:267-274` | Documented as `found:false` because discovery keeps only DIALABLE peer rows and every hub vessel registers as `http://127.0.0.1:<port>`. The filter reads exactly as described; whether hub rows are still loopback-only **could not be checked** (the local key is 401'd there) | unverifiable-here |
| 10 | Cure named by the doc: `VESSEL_ADVERTISE_ENDPOINT` / `SUBSTRATE_ADVERTISE_HOST` on the hub | `docs/FEDERATION.md:81,225-228`; readers `repos/ias-executor-ts/src/hosts/discovery-registration-loop.ts:87-93`, `packages/vessel-discovery-client/src/registration-loop.ts:125-131`, wired by `vessel-daemon.ts:27` | The variables **are** read by the registration loop every vessel runs — but there is **no delivery path**: gen-env never emits them into `/etc/substrate/env` and the Makefile does not carry them, so a `docker run -e` value reaches PID 1 and never reaches a unit | doc-code-mismatch |

**End state.** A spoke whose vessels register locally, whose transport mirrors them into the hub as
`<vessel>@<substrate>`, and whose discovery fans capability queries out to the hub.
**How to verify it actually worked.** On the spoke: a `vesselCapability` query for a hub-only shape returns a row
with `discoveredVia:"peer"` **AND** a dialable address. On the hub: `<vessel>@<spoke-id>` rows present and
refreshing on the ~2-min heartbeat.

---

### F4-P7 — Pinning a federation id / relay: `spoke-federate.sh`

**Purpose.** Optional override of the boot default: pin a chosen `FED_SUBSTRATE_ID` (stable mirror-row names
across recreates) or a specific relay, with a hub-side collision check.
**Trigger.** Operator, only when the auto-generated id or auto-derived relay is not acceptable.
**Preconditions.** A running container already booted as a federated spoke.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `spoke-federate.sh <container> <fed-substrate-id> [relay-multiaddr]` | `docs/FEDERATION.md:241-255`; impl `spoke-federate.sh:18-31` | Dual-context (host-with-docker or inside the container). SID required | verified-in-code |
| 2 | Read `HUB_DISCOVERY_URL` and `METABOB_API_KEY` out of `/etc/substrate/env` (+ `.substrate-secrets`) | `spoke-federate.sh:4-8`; impl `:33-39` | Refuses with an actionable message when `HUB_DISCOVERY_URL` is empty. It would have refused on the audited box | verified-live (expired) |
| 3 | Derive the relay: hub `vesselCapability federation_probe` row → strip `/p2p-circuit`; else `GET $HUB/bootstrap` | `spoke-federate.sh:49-60`; impl `:46-71` | The `/bootstrap` fallback exists because the ingress row only appears after something has already federated — i.e. it is empty by construction on a first join | verified-in-code |
| 4 | Collision check: hub `vesselRegistry \| grep -c "@<SID>$"` must be 0 | `docs/FEDERATION.md:257`; impl `spoke-federate.sh:75-77`, `hub_resolve` `:41-44` | Implemented as documented — but `taken` is computed with `grep -c … \|\| true`, and `hub_resolve` does not check HTTP status, so **a hub that 401s produces an empty body, count 0, and the check PASSES** | doc-code-mismatch |
| 5 | upsert `FED_SUBSTRATE_ID` / `FED_VESSEL_ID` / `RELAY_MULTIADDR` / `HUB_DISCOVERY_URL` into `/etc/substrate/env` | `spoke-federate.sh:11-12`; impl `:79-89` | `FED_VESSEL_ID` seeds the libp2p keypair (`federation-transport-server.ts:72`), so a duplicate id gives two substrates the same peer id and they fight over the reservation | verified-in-code |
| 6 | `vessel-ctl install federation-transport-vessel; systemctl restart federation-transport-vessel` | `spoke-federate.sh:91-92`; impl `vessel-ctl.sh:150-241` | Renders the unit from the manifest and starts it | verified-in-code |
| 7 | Poll `http://127.0.0.1:8401/health` for 60 s | `spoke-federate.sh:94-106`; impl `:96-101` | Tests only `-n "$h"` — **any HTTP body counts as success**. A transport that is up but holds NO relay reservation still answers `/health`, so this gate does not prove federation works | verified-in-code |

**End state.** The spoke mirrors its registry into the hub under the pinned id.
**How to verify it actually worked.** The transport `/health` payload must show a non-empty **circuit**
multiaddr, and the hub registry must show `<vessel>@<pinned-id>` rows. A 200 from `/health` alone is not evidence.

---

### F4-P8 — Thin spoke (no local registry)

**Purpose.** Point every control-plane call straight at the hub; run no local discovery.
**Trigger.** Operator wanting an outbound-only participant.
**Preconditions.** Hub endpoints; a hub-issued key.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `ENABLED_ROLES=spoke DISCOVERY_ENDPOINT=… ACTIVITY_API_ENDPOINT=… IDENTITY_VESSEL_URL=…` (explicitly) | `docs/FEDERATION.md:259-262`; impl `roles.spoke` in `vessels.inventory.json`; `gen-env.sh:110-112` | Documented as "outbound-only, since the hub cannot dial back". **No dedicated code path or test was found** beyond the generic role selection and endpoint passthrough | documented-only |

**End state.** A container with no local registry resolving everything on the hub.
**How to verify it actually worked.** Unverified — would need a second machine.

---

### F4-P9 — Peer fan-out (topology 2): the query-time pull leg

**Purpose.** On a local miss (or always, in union mode), forward a query to peer discoveries and merge their
producers.
**Trigger.** Any `/resolve` against a discovery with `PEER_DISCOVERY_ENDPOINTS` set. **This was LIVE on the
audited box.**
**Preconditions.** `PEER_DISCOVERY_ENDPOINTS` non-empty; `depth < MAX_PEER_DEPTH`; a credential **the PEER**
accepts.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Set `PEER_DISCOVERY_ENDPOINTS=http://<peer>:18100` (+ optional `FEDERATION_SIGNING_SECRET`) | `docs/FEDERATION.md:71-74`; impl `index.ts:44-47` (read at **USE** time, not module load) | The audited discovery carried `PEER_DISCOVERY_ENDPOINTS=http://syzygy.host:18100`, `MAX_PEER_DEPTH=1`, `PEER_FANOUT_MODE=union`. `FEDERATION_SIGNING_SECRET` was in the env file with **zero readers** anywhere | doc-code-mismatch |
| 2 | `POST /resolve {pointer:{type:'vesselCapability',shape:'llmCompletion'}}` | `docs/FEDERATION.md:73-74`; impl `index.ts:253-257` | In union mode the fan-out runs even when a local producer exists. Live result: **only the LOCAL row**; zero rows tagged `discoveredVia:"peer"` | verified-live (expired) |
| 3 | `forwardToPeers` builds the outbound Authorization header | `docs/operations/FEDERATION_GENRES.md:103-106`; impl `index.ts:56-58` — `return process.env.HUB_API_KEY ? 'ApiKey '+HUB_API_KEY : authHeader` | `HUB_API_KEY` is **UNSET** in the consuming process, so the caller's own locally-issued key is forwarded, the peer validates it against a different HMAC secret and returns 401. **A DIFFERENT failure point from the dialability filter the doc blames, and upstream of it** — the filter is never reached | known-broken |
| 4 | Depth bound: `X-Discovery-Depth` incremented per hop; a request at or beyond `MAX_PEER_DEPTH` is not forwarded | `FEDERATION_GENRES.md:118-122`; impl `index.ts:48` (default 2), `:67`, `:109`, `:77`/`:117` | The CODE default is 2, matching the doc. The DEPLOYED value is 1, pinned in two places, so the fleet is single-hop | doc-code-mismatch |
| 5 | Merge filter: dedup by vesselId (local wins), dialability, self-echo rejection, provenance tag | `FEDERATION_GENRES.md:124-134`; impl `index.ts:263-278`, `:273`, `:269-270`, `:271-272`, `:91` | All four behaviours present exactly as described | verified-in-code |
| 6 | General non-discovery shape on a local miss: forwarded peer-by-peer, first success wins | `FEDERATION_GENRES.md:116-118`; impl `index.ts:103-129`, invoked `:205-213` | Returns 404 `{error:'Not found', shape}` when no peer answers — **indistinguishable from a peer 401** | verified-in-code |
| 7 | goal-host routes a peer row via `peerEndpoint` / the libp2p egress, never the peer's loopback endpoint | `docs/FEDERATION.md:85-86`; impl `repos/goal-host-vessel/src/index.ts:395-401,6617-6638,3839`; egress base `src/config.ts:63` (`FED_TRANSPORT_EGRESS`, default `http://127.0.0.1:8401`) | Routing logic exists as documented. On the audited box the default egress target was dead — nothing listened on 8401 | verified-live (expired) |

- **Step 2 controls (expired).** `curl POST localhost:18100/resolve` → `content.vessels = [llm-resolver-vessel …]`,
  `found:true`, no peer rows. **Control 1:** shape `zzz_no_such_shape_probe` → `vessels:[]`, `found:false` (so the
  local path and the empty case are distinguishable). **Control 2:** byte-identical query straight to syzygy →
  HTTP 401, so the peer is reachable but rejecting.
- **Step 3 evidence.** `HUB_API_KEY` absent from `/proc/1038/environ` (82 lines, no match) and from
  `/etc/substrate/env`; `index.ts:83 if (!res.ok) return` discards the response with **no log line**; `:93`
  swallows exceptions the same way. No deploy path sets `HUB_API_KEY` (`deploy-remote.sh:86` sets
  `FEDERATION_SIGNING_SECRET` instead, which nothing reads).
- **Step 4 evidence.** `/proc/1038/environ MAX_PEER_DEPTH=1`;
  `scripts/substrate/units/discovery-vessel.service.d/federation-peering.conf:14`; `deploy-remote.sh:86`.

**End state.** Capability queries see the union of local and peer producers, tagged by provenance.
**How to verify it actually worked.** A returned row carrying `discoveredVia:"peer"` **AND** `peerEndpoint`. On
the audited box that was never observed; `found:false` / local-only is what a 401'd fan-out looks like.

---

### F4-P10 — Register-time propagation: the federation-transport hub mirror

**Purpose.** Push this substrate's per-vessel capability surface into a hub registry as
`<vesselId>@<substrate>`, dialable over the relay circuit.
**Trigger.** `federation-transport-vessel` start, then every 120 s, plus immediately on relay-reservation
reacquisition.
**Preconditions.** `HUB_DISCOVERY_URL` set; a live relay circuit; a credential the hub accepts.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Resolve the relay: `RELAY_MULTIADDR`, else `<BOOTSTRAP_URL>/bootstrap`; exit 1 if neither | `docs/FEDERATION.md:210-212`; impl `federation-transport-server.ts:29,43-61` | Point-and-go as documented; hard exit under `Restart=always` otherwise | verified-in-code |
| 2 | `createVesselLibp2p` with `LIBP2P_IDENTITY = <FED_VESSEL_ID>@<FED_SUBSTRATE_ID\|\|hostname>`, `extraServices:{ping}` | `docs/FEDERATION.md:196-198`; impl `:63-79`, `:72-79`; matching rule `relay.ts:100-106` | Deterministic key from `sha256(id)`; the ping RESPONDER is required or the relay's keep-alive reads every peer as "unsupported protocol" | verified-in-code |
| 3 | Enumerate mirrorable local rows | `FEDERATION_GENRES.md:152-157`; impl `:589-608` | Exclusions match the doc exactly: own id prefix (`:597`), `protocol==='libp2p'` (`:597`), any id containing `@` (`:597`), `host.docker.internal` endpoints (`:602`), zero-shape rows (`:604`) | verified-in-code |
| 4 | `SELF_MIRROR` detection by loopback-normalised `host:port` | `FEDERATION_GENRES.md:158-164`; impl `:565-576` | `:576` logs "hub mirror disabled", but `registerAtHub` (`:617`) returns only when `HUB_DISCOVERY` is empty, and `:633` omits ONLY the transport's own anchor row while `:634` still registers every per-vessel row. **The log line is false** | doc-code-mismatch |
| 5 | `POST <hub>/register` per row with `Authorization: ApiKey HUB_API_KEY` | `FEDERATION_GENRES.md:139-150`; impl `:40`, `:636-653` | Each row advertises `endpoint http://127.0.0.1:<health-port>`, `protocol libp2p`, peer id, and `libp2p_multiaddr = [circuit, ...directAddrs]` | verified-in-code |
| 6 | No circuit ⇒ skip the mirror, log an error throttled to one per 10 minutes | `FEDERATION_GENRES.md:166-171`; impl `:610-626`, refresh `:672-683` | Exactly as documented — loud, throttled, refreshed immediately on reacquisition | verified-in-code |
| 7 | 401/403 from the hub ⇒ emit a shaped join-health observation | `FEDERATION_GENRES.md:170-172`; impl `:654-656` (`emitJoinHealth('auth_rejected', …)`) | Present. **Note the asymmetry:** the PUSH leg reports auth rejection as a shape; the PULL leg (`discovery index.ts:83`) discards it in total silence | verified-in-code |
| 8 | Relay reservation watchdog: reactive redial on circuit loss, phantom-reservation strikes on a 5-min tick, egress-triggered redial rate-limited to 30 s | impl `:685-759` (not in FEDERATION.md) | Substantial recovery machinery for documented live incidents (NO_RESERVATION for ~90 min; 872 failed hub egresses in one night). None of it appears in the operator-facing doc | verified-in-code |

**End state.** The hub registry carries `<vessel>@<substrate>` rows for every mirrorable local vessel, refreshed
on the 2-minute TTL cadence.
**How to verify it actually worked.** Query the **HUB's** `vesselRegistry` for `@<substrate-id>` rows and confirm
`lastSeen` advances across two samples. Not possible from here (401).

---

### F4-P11 — libp2p ingress sidecar join (NAT'd vessel / Obsidian)

**Purpose.** Make a plain-HTTP vessel behind NAT resolvable across the federation without the vessel carrying any
libp2p dependency.
**Trigger.** Operator running the sidecar next to a local vessel.
**Preconditions.** A discovery endpoint; an API key it accepts; the local vessel's `/resolve` URL.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `METABOB_API_KEY=… DISCOVERY_ENDPOINT=… bun sidecar/federation-sidecar.ts` | `docs/FEDERATION.md:282-286`; impl `repos/libp2p-federation-transport/src/sidecar.ts:27-42`, `:30`, `:39-42` | The generic sidecar actually requires **FOUR** values (`FED_VESSEL_ID`, `DISCOVERY_URL`, `LOCAL_RESOLVE_URL`, `FED_SHAPES`), each with a hard exit, plus the key. The doc's env var name is `DISCOVERY_ENDPOINT`; the code reads `DISCOVERY_URL` | doc-code-mismatch |
| 2 | With no `RELAY_MULTIADDR`, `GET <DISCOVERY>/bootstrap` and take `relay_multiaddrs[0]` | `docs/FEDERATION.md:288-294`; impl `sidecar.ts:44-63`; mirrored in `repos/obsidian-vessel/sidecar/federation-sidecar.ts:72-86` | Implemented as documented, with an explicit `die()` when the array is empty | verified-in-code |
| 3 | `createVesselLibp2p` → dial the relay, hold a reservation; Noise encrypts end-to-end; DCUtR attempts a hole-punch | `docs/FEDERATION.md:117-120,276-278`; impl `repos/libp2p-federation-transport/src/index.ts:262,270,271` | Confirmed on the CLIENT side, which is where DCUtR belongs. `relay.ts` has no `dcutr()` **and correctly so** — the relay is the broker and runs identify + autoNAT (`relay.ts:62-63`) which the hole-punch needs | verified-in-code |
| 4 | `serveResolveHttp`: proxy each inbound pointer to `LOCAL_RESOLVE_URL`, unwrapping `{content}`/`{body}` | `docs/FEDERATION.md:296-298`; impl `sidecar.ts:104-120` | As documented; the vessel never learns libp2p is involved | verified-in-code |
| 5 | Wait up to 20 s for a `/p2p-circuit` multiaddr | impl `sidecar.ts:122-129` (undocumented) | If none appears the sidecar WARNS and proceeds to register with `libp2p_multiaddr: []` — a row that is neither dialable nor filtered out at the registering end (`:129,146,182`) | verified-in-code |
| 6 | `POST /register` with `protocol:'libp2p'`, peer id, circuit multiaddr, shapes; repeat every 120 s | `docs/FEDERATION.md:296-298`; impl `sidecar.ts:144-192`, `:149-164` | `endpoint` is deliberately the loopback health port; real reach is the circuit. Phantom-reservation detection and relay re-dial run on the same tick | verified-in-code |
| 7 | Obsidian variant: `obsidian-passthrough.ts` on the operator host | `docs/FEDERATION.md:100-113`; impl `obsidian-passthrough.ts:22-28,32-38,78-99`, `:23-28` | This script does **NOT** implement point-and-go: `:28` exits unless BOTH `RELAY_MULTIADDR` and `DISCOVERY_URL` are supplied — there is no `/bootstrap` fetch at all | doc-code-mismatch |
| 8 | A spoke goal-host resolves `obsidian_status` → peer fan-out → local egress → relay circuit → sidecar → plugin | `docs/FEDERATION.md:105-113`; impl `goal-host index.ts:4742,4836,6223,6617-6638` | Every hop exists in code. Not exercisable: no transport on 8401, no relay reservation, and the peer fan-out 401s | unverifiable-here |

**End state.** A NAT'd plain-HTTP vessel appears in the hub namespace as a libp2p producer and answers resolves
through the relay.
**How to verify it actually worked.** The sidecar's `/health` must report a non-empty `libp2p_multiaddr`, **AND**
a remote caller must get the vessel's content back. A 200 from `/health` with `libp2p_multiaddr:""` is the
silent-failure shape.

---

### F4-P12 — Relay operation (Circuit Relay v2 + Noise + reserved-peer keep-alive)

**Purpose.** Provide the one thing a substrate cannot provision for itself: a publicly dialable broker for NAT'd
vessels.
**Trigger.** Operator on a public-IP host (or the managed `federation-relay` unit).
**Preconditions.** A public IPv4; inbound TCP 30333 open.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `PUBLIC_IP=<vm-ip> RELAY_KEY_FILE=~/relay-key.pb bun scripts/substrate/federation-relay/relay.ts` | `docs/FEDERATION.md:122-124`; impl `relay.ts:34-39` | `PUBLIC_IP` or `FED_PUBLIC_IP` required; hard exit otherwise | verified-in-code |
| 2 | Load or mint+persist the Ed25519 identity at `RELAY_KEY_FILE` | `docs/FEDERATION.md:32-33`; impl `relay.ts:11-12,41-49` | With a persisted key file the peer id is **STABLE** across restarts — so the doc's blanket claim that a pinned multiaddr goes stale "because a relay peer id changes on every relay restart" is only true when the key file is absent or changed | doc-code-mismatch |
| 3 | `listen /ip4/0.0.0.0/tcp/30333`, announce `/ip4/<PUBLIC_IP>/tcp/30333` (+ optional `/ws`) | `docs/FEDERATION.md:124`; impl `relay.ts:35-36,51-53` | `138.197.116.56:30333` accepts TCP and syzygy's `/bootstrap` advertises the matching multiaddr. **This proves a listener, not a working reservation** | verified-live |
| 4 | services: identify, autoNAT, `ping(maxOutboundStreams=128)`, `circuitRelayServer` with raised caps | `docs/FEDERATION.md:117-120`; impl `relay.ts:59,61-86` | Noise is the connection encrypter (`:59`) — end-to-end, relay sees ciphertext. Default per-circuit caps (128 KB/120 s) explicitly disabled and replaced with 10 MiB / 10 min / 128 reservations / 1 h TTL, because the library defaults truncate a resolve body mid-flight | verified-in-code |
| 5 | Reserved-peer keep-alive: ping each reserved peer every 20 s over its DIRECT connection; close only a peer that has ponged before and then failed ≥2 consecutive pings | impl `relay.ts:90-138` (not in FEDERATION.md) | Compensates for circuit-relay-v2 being passive (HOP CONNECT fails NO_RESERVATION while the TTL reads full). The `pongedEver` guard exists because a naive version caused a churn loop (reverted commit `6ec65736`) | verified-in-code |
| 6 | Read the printed `RELAY_MULTIADDR` line | `docs/FEDERATION.md:124`; impl `relay.ts:143-145` | Printed to **stdout**. In the CONTAINER path that stdout goes to the journal, which is why the manifest post_install's `/workspace/fed-relay.log` read finds nothing | known-broken |

**End state.** A public relay holding reservations for NAT'd vessels, with a stable peer id.
**How to verify it actually worked.** A joining node obtains a `/p2p-circuit` multiaddr **AND** a second node
resolves through it (`federation-hub-e2e.ts`). TCP acceptance on 30333 proves only a listener.

---

### F4-P13 — Hub key issuance (the spoke credential)

**Purpose.** Mint the one credential a spoke needs, from the hub's single identity authority.
**Trigger.** Operator on the hub before a spoke join.
**Preconditions.** Shell on the hub host.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `docker exec <container> substrate-key issue spoke-<location>` | `docs/FEDERATION.md:266-270`; impl `substrate-key.sh`; cross-ref `gen-env.sh:250` | Prints the key once. gen-env's fail-closed spoke guard names the same command, so the two surfaces agree | verified-in-code |
| 2 | `substrate-key list` / `substrate-key revoke` | `docs/FEDERATION.md:272-274`; impl `substrate-key.sh` | Documented management surface. Not exercised — every invocation on a hub is a write or needs a hub shell | documented-only |
| 3 | The key encodes org, user, key id and **ISSUER URL**; the peer validates it against its own HMAC secret | `FEDERATION_GENRES.md:83-101`; impl `repos/identity-vessel/src/resolvers/issue-key.ts`; rationale `federation-transport-server.ts:32-40` | Live-decodable: the audited box's key decoded to `organizations:substrate-users:ccbjddzxsjv089wisw6y-key_NzxlvVsrYqVfCK5q-http://127.0.0.1:8101`. The org segment is a fixed literal; the ISSUER segment is what makes it foreign at any other substrate | verified-live |

**End state.** A spoke holds a hub-issued `METABOB_API_KEY` in the hub's namespace.
**How to verify it actually worked.** `POST <hub>/resolve` with the key returns 200, not 401.

---

### F4-P14 — End-to-end federation harness

**Purpose.** Prove the full loop against any live hub: reserve → register → hub echoes the circuit → a second
node resolves through the public relay.
**Trigger.** Operator validating a deployment.
**Preconditions.** `RELAY_MULTIADDR`; `DISCOVERY_URL`; `HUB_KEY` (a hub-issued credential).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `RELAY_MULTIADDR=… DISCOVERY_URL=… HUB_KEY=… bun repos/libp2p-federation-transport/federation-hub-e2e.ts` | `docs/FEDERATION.md:300-306`; impl `federation-hub-e2e.ts:1-9` | Two libp2p nodes on the local machine both reserve on the remote relay. `HUB_KEY` unavailable — the only key on this box is 401'd by syzygy | unverifiable-here |
| 2 | Ingress reserves and serves `spoke_probe`; wait up to 20 s for a `/p2p-circuit` addr, else exit 1 | `federation-hub-e2e.ts:13-18` | Fails **loudly** if no reservation — a genuine gate, unlike `spoke-federate.sh`'s health poll | verified-in-code |
| 3 | `POST <hub>/register` the ingress as `protocol:libp2p` with the circuit | `federation-hub-e2e.ts:20-26` | Exits on non-2xx | verified-in-code |
| 4 | Query the hub back; require `protocol==='libp2p'` and a non-empty `libp2p_multiaddr[0]` | `federation-hub-e2e.ts:28-32` | Asserts the hub echoes the circuit — the exact property the dialability filter depends on | verified-in-code |
| 5 | Egress node reserves, dials the advertised multiaddr THROUGH the relay, resolves `spoke_probe`, compares the value | `federation-hub-e2e.ts:34-46` | Compares the returned **value**, not an exit code — the correct verification shape | verified-in-code |
| 6 | Sibling probes: `fed-resolve-client.ts` and `fed-federated-resolve.ts` | impl `fed-resolve-client.ts:1-10`, `fed-federated-resolve.ts:1-29`, `:8`, `:28` (not in FEDERATION.md) | Both print explicit PASS/FAIL sentinels. `fed-federated-resolve.ts` hardcodes `DISCOVERY=http://127.0.0.1:8100` and expects `produced_by === 'federation-transport@substrate-b'` — a fixture-specific literal. **Neither is referenced by any doc** | documented-only |

**End state.** A printed `FEDERATION E2E PASS` proving reservation + shared namespace + resolve through the
public relay.
**How to verify it actually worked.** The harness's own value comparison. Nothing weaker (a 200 from `/register`,
a non-empty `/health`) proves the loop.

---

## 7. Family 5 — Keys, identity, auth & RBAC

9 processes, 61 steps. **⚠ This family's source map arrived TRUNCATED.** Its process/step content and 11 of 12
traps are complete; **trap 12 is cut off mid-record** (only `trap` and `where` survive — no
`why_invisible`, no `detection`, no severity), and the family's **`contradictions` array and `coverage_notes`
were never delivered at all**. This family also received no adversarial verdicts. See §9.

### F5-P1 — Bootstrap: where the signing secrets and the seed credential come from

**Purpose.** Establish the two secrets that define this substrate's trust space (`API_KEY_SECRET` signs/verifies
every `mb-` API key; `JWT_SECRET` signs every JWT) plus the pre-seed bootstrap `METABOB_API_KEY`, and persist
them so a restart keeps issued keys valid.
**Trigger.** Container start: entrypoint runs gen-env.sh, which sources secrets.env.sh, before any vessel unit.
**Preconditions.** `/workspace/.substrate-secrets` present (or absent on genuine first boot); `openssl` in the
image; for a spoke, a hub-issued `METABOB_API_KEY` supplied via env.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `source secrets.env.sh` — the secrets file is sourced if present, then each secret is `VAR="${VAR:-<generated>}"` | `secrets.env.sh:17-43`; impl `:19-20`, `:29` (`JWT_SECRET=openssl rand -hex 32`), `:31` | `JWT_SECRET`, `SURREAL_PASS`, `METABOB_API_KEY`, `FEDERATION_SIGNING_SECRET` exist. **`API_KEY_SECRET` is NOT declared here** — it is owned by gen-env.sh only | verified-in-code |
| 2 | secrets.env.sh persists back, **MERGING** rather than truncating | `secrets.env.sh:46-91`; impl `:66-90`, carry-through grep `:83-84` | `API_KEY_SECRET` / `SUBSTRATE_ADMIN_KEY` / `FED_SUBSTRATE_ID` written by the OTHER writer survive. The in-file comment records the outage caused when both writers used `cat >`: `API_KEY_SECRET` vanished and gen-env then refused to boot | verified-in-code |
| 3 | gen-env resolves `API_KEY_SECRET`: env → persisted → (existing datastore ? fail closed : generate) | `gen-env.sh:181-186`; impl `:187-212`, exit `:203-207`, opt-in `:195-201`, generate `:210` | Each substrate gets its **OWN** random secret — the single fact that makes a key from substrate A unusable on B. A datastore with no persisted secret halts the boot rather than silently entering a forgeable trust space | verified-in-code |
| 4 | gen-env resolves `API_KEY_SECRET_PREVIOUS` (rotation window) from env or persisted only — never auto-derived | `gen-env.sh:214-226`; impl `:227`; consumer `repos/identity-vessel/src/services/validation.ts:27-34` (`SECRET_KEYS` built ONCE at module load) | Live: `API_KEY_SECRET_PREVIOUS=""`. **There is NO grace window** — a secret rotation invalidates every issued key instantly | verified-live (expired) |
| 5 | gen-env resolves `METABOB_API_KEY`; a SPOKE with none fails closed with the fix named | `gen-env.sh:229-243`; impl `:232`, `:247-254`, `:256-259` | On a standalone this is a throwaway bootstrap value that seed-identity.ts replaces. A spoke cannot self-mint a join credential | verified-in-code |
| 6 | Per-vessel keys default to the fleet key when unset | `gen-env.sh:261`; impl `:262-265` | `LOCAL_TOOLS_VESSEL_API_KEY`, `GOAL_HOST_VESSEL_API_KEY`, `RIBOSOME_VESSEL_API_KEY`, `CONCEPT_DB_API_KEY`. Per-vessel trace attribution degrades **silently** to one shared identity | verified-in-code |

**End state.** `/etc/substrate/env` (EnvironmentFile for every unit) and `/workspace/.substrate-secrets` carry
`API_KEY_SECRET`, `JWT_SECRET`, `SURREAL_PASS`, `METABOB_API_KEY`, and (after P2) `SUBSTRATE_ADMIN_KEY`.
**How to verify it actually worked.** Compare two fleets running the same image ID: `JWT_SECRET`,
`API_KEY_SECRET`, `SURREAL_PASS` and `FED_SUBSTRATE_ID` must differ. Do **not** read gen-env's `prov` footer
alone — `BRINGUP_THREE_PATHS.md:174-181` records it labelling generated values `hardcoded`.

---

### F5-P2 — First-boot identity seeding: minting the org, the fleet key and the admin key

**Purpose.** Create the substrate's tenant inside identity-vessel and mint the HMAC API keys the fleet actually
authenticates with, replacing the random bootstrap `METABOB_API_KEY`.
**Trigger.** `identity-seeder.service` → `reseed-restart` → `bun run /vessels/seed-identity.ts`.
**Preconditions.** `METABOB_API_KEY` and `JWT_SECRET` in the unit environment; identity-vessel reachable;
SurrealDB up.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `await waitForIdentity()` — poll `GET $IDENTITY_URL/health` for up to 30 s | `seed-identity.ts:5-6`; impl `:39-49` | Throws and exits 1 if identity never becomes ready | verified-in-code |
| 2 | `POST /v1/auth/signup {email:'substrate@substrate.local', password:$METABOB_API_KEY, org_name:'substrate'}` | `seed-identity.ts:160-169`; handler `repos/identity-vessel/src/index.ts:715`; resolver `resolvers/login.ts:289-395` | **The org id is derived from the `org_name` SLUG, not randomly**: `login.ts:333-335` → `organizations:substrate` on EVERY substrate. The user id IS random | verified-live (expired) |
| 3 | Signup creates `users`, `organizations:<slug>`, `organization_members(owner)`, `accounts:<slug>`, `account_members(owner)`, then mints the session JWT | `seed-identity.ts:230-236`; impl `login.ts:352-386`, `:391` → `:155-215` | The JWT carries `role='owner'`, which is what makes step 4's admin-only endpoint accept it. identity-vessel's SurrealDB client runs as **ROOT** for this (`login.ts:7-13`) — signup necessarily bypasses PERMISSIONS | verified-in-code |
| 4 | `issueKey(token,…)` → `POST /v1/keys/issue` with `Authorization: Bearer <signup JWT>`, name `substrate-default`, scopes `['read','write']` | `seed-identity.ts:51-76,239`; impl `index.ts:945-976` → `resolvers/issue-key.ts:152-220`; admin gate `issue-key.ts:92-107` | Returns the full `mb-<base64url(org-user-keyid-iss)>-<hmac32>` key ONCE; only the SHA-256 hash is persisted (`issue-key.ts:170`) alongside an `api_key` row | verified-in-code |
| 5 | Write the issued key back over `METABOB_API_KEY` in both files | `seed-identity.ts:242-243`; impl `:244-264`, `:141-155` (`writeFleetKey()`) | The fleet's key becomes an identity-minted HMAC key signed by THIS substrate's `API_KEY_SECRET`. Consumers must restart to pick it up | verified-in-code |
| 6 | Issue `substrate-admin` with scopes `['read','write','admin']` and upsert as `SUBSTRATE_ADMIN_KEY` | `seed-identity.ts:266-275`; impl `:271-273` via `upsertEnvVar()` `:24-37` | Live: present in both files; `substrate-key list` showed an active read+write+admin key named `substrate-admin`. **This SUPERSEDES `BRINGUP_THREE_PATHS.md:513`** ("SUBSTRATE_ADMIN_KEY is empty") | verified-live (expired) |
| 7 | RE-RUN on an existing volume: signup answers 409; the seeder verifies the fleet key still **AUTHENTICATES** | `seed-identity.ts:171-197`; impl `:198-223`; `keyAuthenticates()` `:99-138` reads `body.data.valid === true`, **NOT** `r.ok` | Re-issues only when identity actually rejects the key. The comment at `:115-131` records the prior defect: `return r.ok` read every rejection as a pass because `/v1/keys/validate` answers HTTP 200 for an invalid key. Fails CLOSED on transport error | verified-in-code |
| 8 | Issue per-vessel keys for local-tools-vessel, goal-host-vessel, concept-db | `seed-identity.ts:277-290`; impl `:278-290` | **KNOWN-BROKEN AS A HANDOFF:** the keys are only `console.log`'d with a message telling a human to set them. Nothing writes them, so `gen-env.sh:262-265` defaults all four to `METABOB_API_KEY`. The block also never runs on a 409 boot (`:204`/`:222` return first) | known-broken |

**End state.** `organizations:substrate` + a random `users:<id>` exist; `substrate-default` (read,write) is the
fleet `METABOB_API_KEY`; `substrate-admin` (read,write,admin) is `SUBSTRATE_ADMIN_KEY`; per-vessel keys were
minted but discarded.
**How to verify it actually worked.** `docker exec substrate-live substrate-key whoami` must return `valid:true`
with a non-empty `org_id`/`user_id`. A 200 from `/v1/keys/validate` proves nothing — read `.data.valid`.

---

### F5-P3 — Operator key surface: `substrate-key show / whoami / issue / jwt / list / revoke`

**Purpose.** Give the operator a single in-container CLI for the keyspace without exposing an admin credential
over the network.
**Trigger.** `docker exec <container> substrate-key <subcommand>`.
**Preconditions.** `METABOB_API_KEY` in `/etc/substrate/env`; identity-vessel answering at `$IDENTITY` — **on a
SPOKE this variable points at the HUB**, so the command operates on the hub's keyspace.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `set -a; source /etc/substrate/env; IDENTITY="${IDENTITY_VESSEL_URL:-http://127.0.0.1:8101}"`; guard on the key and `curl -sf $IDENTITY/health` | `substrate-key.sh:22-26`; impl `:29-35` | Live: `IDENTITY_VESSEL_URL="http://127.0.0.1:8101"`; identity `/health` 200, `identity-vessel v0.2.0` | verified-live (expired) |
| 2 | `substrate-key show` → `echo "$METABOB_API_KEY"` | `substrate-key.sh:15`; impl `:57-59` | Prints the read/write fleet key only. **There is no subcommand and no Makefile target that reveals `SUBSTRATE_ADMIN_KEY`** | verified-in-code |
| 3 | `substrate-key whoami` → `POST $IDENTITY/v1/keys/validate {api_key:…} \| jq .data` | `substrate-key.sh:16`; impl `:61-64` | Live: `valid:true`, `org_id=organizations:substrate`, `scopes=[read,write]`, `role='user'`. NOTE `role` is a **hardcoded literal** in the response (`index.ts:1044`), not a stored fact | verified-live (expired) |
| 4 | `resolve_identity()` — validate the key to learn ORG_ID/USER_ID | `substrate-key.sh:22-26`; impl `:37-44` | Dies if org/user cannot be extracted. Uses the **unauthenticated** `/v1/keys/validate` endpoint | verified-in-code |
| 5 | `mint_jwt()` — `POST $IDENTITY/v1/jwt/generate` with `Authorization: ApiKey $METABOB_API_KEY`, body `{user_id,org_id,role:admin,expires_in_seconds}` | `substrate-key.sh:22-26`; impl `:46-53`; server `index.ts:422-515` | The mint authenticates the caller (`:442-476`) and forbids claiming another identity (`:481-489` → 403) but **does NOT check scopes** and does not constrain the requested role beyond the enum. A read/write key mints a `role=admin` JWT for itself | verified-in-code |
| 6 | `substrate-key issue <name> [scopes] [days]` — `resolve_identity`; `mint_jwt admin 300`; `POST /v1/keys/issue` with the Bearer JWT | `substrate-key.sh:17`; impl `:66-83`; server gate `issue-key.ts:92-107` | **PRIVILEGE ESCALATION BY DESIGN DEFECT:** `admin` is not a server-side boundary on the mint path. Any holder of any valid key can self-mint a `role=admin` JWT and then issue a read+write+admin key | verified-in-code |
| 7 | `substrate-key list` — `mint_jwt admin 300`; `GET /v1/keys` with the Bearer JWT | `substrate-key.sh:19`; impl `:93-99`; server `index.ts:1180-1222` (Bearer ONLY — ApiKey rejected at `:1182`) | Live: 20+ rows, scoped by the JWT's `org_id` in the SQL (`:1195`). **Status is derived from `is_active`** — the durable row — not from the Redis denylist that validation actually consults | verified-live (expired) |
| 8 | `substrate-key revoke <key_id>` — `mint_jwt admin 300`; `POST /v1/keys/revoke {key_id}` with the Bearer JWT | `substrate-key.sh:20`; impl `:101-107`; server `index.ts:1085-1169` | **The Bearer header is sent but the SERVER NEVER READS IT** — `/v1/keys/revoke` has no auth check at all. The JWT mint is decorative on this path | doc-code-mismatch |

**End state.** The operator can enumerate, mint and revoke keys from inside the container using only the
read/write fleet key.
**How to verify it actually worked.** After `revoke`, re-run `substrate-key list` **AND** `POST /v1/keys/validate`
for the key — the two disagree unless both the Redis entry and the `api_key` row were written
(`index.ts:1118-1145`; `DELETE /v1/keys/:keyId` at `:1273-1302` also writes both).

---

### F5-P4 — Service-to-service: presenting and validating an API key (the `ApiKey` scheme)

**Purpose.** Let one vessel call another with its own service identity, validated by identity-vessel as the
single authority.
**Trigger.** Any vessel-to-vessel HTTP call, and every discovery register/heartbeat.
**Preconditions.** Caller holds a key signed by the **receiving** substrate's `API_KEY_SECRET`; identity-vessel
reachable from the receiving vessel.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Caller sets `Authorization: ApiKey $METABOB_API_KEY` | `docs/IDENTITY_VESSEL_CURL_EXAMPLES.md:254`; `docs/specs/auth-token-source-field.md:37`; impl `repos/discovery-vessel/src/event-bus.ts:51`; `buildAuthHeaders` in `repos/development-vessel/src/resolvers/concept.ts` | **One credential kind exists in practice.** `auth_token_source`/`auth_delegation_mode` are declared in the registration types but read by no caller — the spec says so at `:23-33` | verified-in-code |
| 2 | Receiving vessel parses the header. discovery-vessel: `/^ApiKey\s+(.+)$/i` — **Bearer is NOT accepted** | `repos/discovery-vessel/src/middleware/auth.ts:291`; impl `:323-330` | Live control pair on `/registry/vessels`: `ApiKey <key>` → 404 (auth passed, route absent); `Bearer <same key>` → 401 `INVALID_API_KEY` "expected 'ApiKey <key>'"; no header → 401 | verified-live (expired) |
| 3 | discovery-vessel exempts public paths, and treats an Authorization header **on a public path** as a request to validate | `repos/discovery-vessel/src/middleware/auth.ts:100-126`, `:303-313` | PUBLIC_PATHS = `/health /bootstrap /shapes /registry/shapes /registry/stats /metrics /metrics/json`; PUBLIC_GET_ONLY = `/registry/shape-descriptions`; PREFIXES = `/vessels/`. **Sending a header on a public read routes it into a validator that can fail** | verified-live |
| 4 | discovery-vessel validates by `POST $IDENTITY_VESSEL_URL/v1/auth/resolve` with a nested authentication impulse | `repos/discovery-vessel/src/middleware/auth.ts:158-165`; impl `:166-244`, URL read per-call `:143-145` | 60 s positive cache; 600 s grace served **only for 5xx** (`:205-210`); 4xx evicts so a revocation cannot outlive its window. Failure classified `rejected / identity_http_error / identity_unreachable` | verified-in-code |
| 5 | activity-api parses `/^ApiKey\s+(.+)$/i` and validates via `validateApiKeyWithFallback` → the same endpoint | `repos/activity-api/src/middleware/jwtAuth.ts:5-6,221`; impl `:274-302`; `src/services/auth.ts:291`, fallback `:496` | **FAILS CLOSED on the ApiKey path** (`jwtAuth.ts:291-297`). Live control: `ApiKey mb-bogus-deadbeef` → 401; valid key → 200 | verified-live (expired) |
| 6 | identity-vessel `/v1/auth/resolve`: branch on nested `impulse` body vs flat Authorization header | `docs/AUTH_JWT_CLAIMS.md:232-263`; impl `index.ts:241-400` (nested `:252-306`, flat `:308-390`) | **The two branches return DIFFERENT SHAPES:** nested → `{success,data:{authenticated,orgId,userId,keyId,scopes,jwt}}` (camelCase); flat → `{valid,user_id,org_id,role:'member',key_id,jwt}` (snake_case). Both mint an inline 900 s JWT best-effort; a mint failure only warns | verified-in-code |
| 7 | `validateKey()`: LOCAL-FIRST HMAC, then DB scope lookup | `repos/identity-vessel/src/services/validation.ts:348-355`; impl `:186-228` (`validateKeyFormat`, prefix `mb-` `:196`, `parseApiKey` `:91-147` splitting on the LAST dash, `verifySignature` `:152-180` constant-time over `SECRET_KEYS`), `:247-282` | `lookupKeyScopes` selects **ONLY `scopes`** and returns null on ANY error → caller falls back to `['read','write']` (`index.ts:1043`, `apiKeyAuth.ts:82`, `jwtAuth.ts:190`). A SurrealDB outage silently **DEMOTES** an admin key. It never reads `is_active` | verified-in-code |
| 8 | Revocation check: `isKeyRevoked(keyId)` against the Redis/valkey denylist | `docs/RBAC_TROUBLESHOOTING.md:269-278`; impl `index.ts:1017-1027`, `:450-455`, `issue-key.ts:83-85`, `apiKeyAuth.ts:64-74` | Revocation enforcement rests **ENTIRELY** on the valkey entry; the durable `is_active` column is written but never consulted by any validation path | verified-in-code |
| 9 | identity-vessel's own `apiKeyAuthMiddleware` (which advertises "Bearer `<key>`: legacy format") | `repos/identity-vessel/src/middleware/apiKeyAuth.ts:14-18`; impl `:19-88` | **DEFINED AND NEVER MOUNTED.** `rg 'apiKeyAuthMiddleware\|requireScopes' repos/identity-vessel/src` returns only the definition sites (`:19`, `:93`). Neither the legacy Bearer behaviour nor `requireScopes()` is reachable | known-broken |

**End state.** The receiving vessel holds an `AuthContext {orgId,userId,keyId,scopes}` used for tenant scoping.
**How to verify it actually worked.** Run the authed/no-auth **PAIR** against one gated route. A single 200
proves nothing — `/health`, `/bootstrap`, `/shapes`, `/registry/*` and `/metrics` are public.

---

### F5-P5 — Browser/dashboard JWT path (`Bearer`)

**Purpose.** Authenticate a human at a surface and carry the identity as a short-lived signed token whose claims
drive SurrealDB PERMISSIONS.
**Trigger.** `POST /v1/auth/login` (or `/v1/auth/signup`), or `POST /v1/jwt/generate`.
**Preconditions.** A `users` row with a `password_hash`; `JWT_SECRET` identical between the minter and every
verifier (including the SurrealDB `jwt_external` ACCESS definition).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `POST /v1/auth/login {email,password}` (rate-limited 10/min) | `docs/RBAC_TROUBLESHOOTING.md:54-58,310-316`; impl `index.ts:708` → `resolvers/login.ts:245-283` | Constant-time: the missing-user branch still runs `verifyPassword` against a dummy hash (`:264-270`) unless `NODE_ENV=test` or `LOGIN_SKIP_DUMMY_HASH=true` | verified-in-code |
| 2 | `mintAuthJwt` picks org+role from `organization_members`/`account_members`, best role wins (owner>admin>member>viewer) | `resolvers/login.ts:149-154`; impl `:155-215`, `ROLE_RANK :146` | Returns `{token, user:{…}, expires_at}`. 900 s lifetime | verified-in-code |
| 3 | `POST /v1/jwt/generate {user_id,org_id,role,project_ids?,expires_in_seconds?}` with `ApiKey` or `Bearer` | `docs/AUTH_JWT_CLAIMS.md:265-304`; impl `index.ts:422-515`, zod `:406-412`, identity binding `:481-489` | The rejection table (`AUTH_JWT_CLAIMS.md:293-300`) matches the code exactly. **One deviation:** the doc says the mint "does not constrain the requested role" — the zod enum DOES constrain it to `admin\|member\|viewer` (`index.ts:409`), so `owner` is refused | doc-code-mismatch |
| 4 | `POST /v1/jwt/verify {token}` → claims | `docs/AUTH_JWT_CLAIMS.md:136-139`; impl `index.ts:529-568` | Exists and is unauthenticated (a token is its own credential). **`docs/RBAC_TROUBLESHOOTING.md:17` says "no dedicated verify endpoint" and tells the operator to base64-decode locally — that is wrong** | doc-code-mismatch |
| 5 | Present the JWT to activity-api as `Authorization: Bearer <jwt>` | `docs/AUTH_JWT_CLAIMS.md:306-311`; impl `jwtAuth.ts:304-323`, `:373-462` | Claims read preferring `$auth` then `$token` (`:402-412`), because the `apikey_token` ACCESS has no `AUTHENTICATE` clause so `$auth` is NONE for identity-minted JWTs | verified-in-code |
| 6 | JWT-only key-management endpoints: `GET /v1/keys`, `PUT /v1/keys/:keyId`, `DELETE /v1/keys/:keyId`, `GET /v1/keys/:keyId/sessions` | `index.ts:1176-1179,1224-1228,1269-1272,1308-1322`; impl `:1180-1222,1229-1267,1273-1302,1323-1400+` | Each requires `Bearer ` and rejects ApiKey; each scopes by `verified.org_id` in the SQL. **These four are the only key endpoints with real tenant scoping.** Live control: `GET /v1/keys` with no header → 401 | verified-live (expired) |
| 7 | Retired instance-auth routes answer 410 Gone | `docs/AUTH_JWT_CLAIMS.md:61-66`; impl `index.ts:783-806`, `:815-838` | Deliberate tombstones naming the replacement, as the doc says | verified-in-code |

**End state.** A 900 s HS-signed token whose `org_id`/`role`/`scopes` claims drive both application checks and
SurrealDB PERMISSIONS.
**How to verify it actually worked.** Decode the token payload and confirm `org_id` is present; then run a gated
query. A JWT that verifies but carries no `org_id` silently fails every `$token.org_id` predicate.

---

### F5-P6 — Revocation and listing

**Purpose.** Withdraw a credential so every vessel stops accepting it.
**Trigger.** `substrate-key revoke <key_id>`, or a direct `POST /v1/keys/revoke`.
**Preconditions.** Redis/valkey up — this is the enforcement store.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `POST /v1/keys/revoke {key_id}` OR `{api_key}` | `docs/IDENTITY_VESSEL_CURL_EXAMPLES.md:153-199`; impl `index.ts:1085-1169`, `:1095-1107` | Works as documented for the happy path | verified-in-code |
| 2 | (no auth step exists) | impl `index.ts:1085-1088` — the handler reads the body and **never** reads `c.req.header('Authorization')` | **UNAUTHENTICATED.** A live probe with no header and an empty body reaches zod validation (`REVOCATION_FAILED`), not a 401 — while the controls `/v1/keys/issue` and `GET /v1/keys` both 401 on the same missing header. Anyone who can reach :18101 and knows a `key_id` can revoke it | known-broken |
| 3 | `revokeKey(keyId)` writes the Redis denylist entry `revoked:<keyId>` with a 1-year TTL | `docs/RBAC_TROUBLESHOOTING.md:269-278`; impl `index.ts:1119`, `db/redis.ts:46-53` | **The only store any validation path consults** | verified-in-code |
| 4 | Then `UPDATE api_key SET is_active=false WHERE key_id=$key_id`, logged-not-thrown on failure | `index.ts:1121-1133`; impl `:1134-1145` | Added because `substrate-key list` (which reads `is_active`) reported `active` immediately after a successful revoke, so an operator following the documented sequence concluded the revoke had failed | verified-in-code |
| 5 | Propagation to consumers | `repos/discovery-vessel/src/middleware/auth.ts:147-156`; `repos/activity-api/src/middleware/auth-cache.ts` | A just-revoked key keeps working at discovery for up to the 60 s TTL. The 600 s grace does NOT extend it — 4xx evicts (`auth.ts:200-212`) | verified-in-code |
| 6 | Expiry as an alternative to revocation | `docs/IDENTITY_VESSEL_CURL_EXAMPLES.md:41`; `docs/RBAC_TROUBLESHOOTING.md:280-285`; impl `keyGeneration.ts:59-61`, `issue-key.ts:194`, signed payload `keyGeneration.ts:38` | `expiresAt` is stored but is **NOT part of the signed payload** (`${orgId}-${userId}-${keyId}-${iss}`) and **no validation path reads it**. An "expired" key still validates. The doc's diagnostic is doubly wrong: `/v1/keys/validate`'s success body (`index.ts:1035-1046`) has no `expires_at` field at all | doc-code-mismatch |

**End state.** The key is in the valkey denylist and its row reads `is_active=false`.
**How to verify it actually worked.** `POST /v1/keys/validate` for the key and read
`.data.error == 'API key has been revoked'`. `substrate-key list` alone is not proof — it reads the durable row,
not the enforcement store.

---

### F5-P7 — Cross-substrate validation (C6 issuer delegation), and why the local key 401s against syzygy

**Purpose.** Let a substrate accept a key it did not sign, by delegating to the key's own issuer.
**Trigger.** Any `validateKey()` whose local HMAC check fails.
**Preconditions.** The key's embedded `iss` names a reachable issuer; that issuer is in `TRUSTED_ISSUERS`
(default `[IDENTITY_ENDPOINT, HUB_DISCOVERY_URL]`).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Local HMAC first: `validateKeyFormat()` against `SECRET_KEYS = [API_KEY_SECRET, ...API_KEY_SECRET_PREVIOUS]` | `validation.ts:348-355`; impl `:356-361` | On the LOCAL substrate this succeeds. **CONTROL:** the same key posted to `localhost:18101` returned `valid:true` with org/user/key_id/scopes — the probe instrument is known-good | verified-live (expired) |
| 2 | On local failure: `parseApiKey` → if `!isSelfIssuer(iss)` delegate, else return the local failure | `validation.ts:36-65`; impl `:363-369`, `isSelfIssuer()` `:62-65` | The branch taken is observable **from the error STRING**: `Untrusted key issuer: <url>` (delegation attempted, allowlist refused, `:303-305`) vs `Issuer rejected key` (delegation performed, `:318-326`) vs `Invalid API key signature` (isSelfIssuer → local verdict, `:214-219` via `:369`) | verified-in-code |
| 3 | Read what the local key actually claims: decode the base64url payload between `mb-` and the last dash | `validation/reports/BRINGUP_THREE_PATHS.md` Rung 0; format `keyGeneration.ts:32-56`, `iss` stamped at MINT time `:35` | Payload decoded to `organizations:substrate` / `users:ccbj…` / `key_NzxlvV…` / **`iss=http://127.0.0.1:8101`**. Live env confirmed `IDENTITY_ENDPOINT="http://127.0.0.1:8101"` | verified-live (expired) |
| 4 | Present that key to syzygy's identity-vessel | impl `validation.ts:347-369` running on syzygy | **401 / `valid:false` with error exactly `Invalid API key signature`.** Two independent locks: (a) syzygy's `API_KEY_SECRET` is a different random value and `API_KEY_SECRET_PREVIOUS` is empty; (b) the key's `iss` is loopback, which on syzygy ALSO matches its own SELF_ISSUER, so delegation is **never attempted** | verified-live |
| 5 | Confirm this is a credential mismatch and not an outage of the target | — | syzygy:18101 and :18100 both answer 200; syzygy:18080 returns 000 — a separate fault. The 401 is a genuine rejection by a live authority. The untracked `<repo>/.metabob/config.json.hub-backup` points at `http://syzygy.host:18080`, currently unreachable, so repointing the cockpit there would produce connection failures, not 401s | verified-live |
| 6 | The intended remedy | `gen-env.sh:247-254`; `Makefile:143,151`; impl `substrate-key.sh:66-83` on the HUB | Mint the credential ON syzygy (`docker exec <hub> substrate-key issue <this-spoke>`). Sharing `API_KEY_SECRET` between substrates is explicitly named a hazard (`gen-env.sh:183-186,204`) | documented-only |
| 7 | `TRUSTED_ISSUERS` override | `validation.ts:46-49` ("TODO(trusted-issuers): … is the follow-up knob"); impl `:50-54`, enforced `:303` | **The TODO comment is STALE — it is already implemented and enforced.** Live: `TRUSTED_ISSUERS` not set and `HUB_DISCOVERY_URL=""`, so the effective allowlist was exactly `['http://127.0.0.1:8101']` | verified-live (expired) |

**End state.** A key is accepted only by the substrate whose `API_KEY_SECRET` signed it; **C6 delegation is
structurally dead for every key minted with a loopback `IDENTITY_ENDPOINT`.**
**How to verify it actually worked.** Run BOTH validators (local and remote) against the same key and compare the
`.data.error` **strings**, not the HTTP codes — `/v1/keys/validate` returns 200 for a rejection.

---

### F5-P8 — The client config surface: which tool reads which key

**Purpose.** Point host-side tooling (the metabob-mcp cockpit, scripts) at an endpoint with a credential.
**Trigger.** Any host-side tool start; the MCP server reads its config at connect.
**Preconditions.** —

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `.mcp.json` sets `METABOB_CONFIG_PATH=/home/avi/documents/work/substrate/.metabob/config.json` | `CLAUDE.md` "Client config" says `~/.metabob/config.json`; impl `.mcp.json` → `mcpServers.metabob.env.METABOB_CONFIG_PATH` | **THE REPO-LOCAL FILE WINS for the cockpit, not `~/.metabob`.** `CLAUDE.md` names only the home path | doc-code-mismatch |
| 2 | Read `metabob.endpoint` and `metabob.apiKey` | `CLAUDE.md`; `docs/RBAC_TROUBLESHOOTING.md:172` | `<repo>/.metabob/config.json` contains exactly two scalars (`metabob.apiKey`, `metabob.endpoint=http://localhost:18080`). `~/.metabob/config.json` contains five (adds `providers.anthropic.apiKey`, `defaults.provider`, `defaults.model`). **Neither contains `metabob.hubDiscovery` or `metabob.gitPat`** | verified-live |
| 3 | The untracked hub-backup variant | `git status` shows `?? .metabob/config.json.hub-backup` | Same apiKey prefix but `metabob.endpoint=http://syzygy.host:18080` — **exactly the configuration that produces the syzygy failure: a LOCAL key aimed at a REMOTE fleet** | verified-live |
| 4 | `providers.anthropic.apiKey` is read by host-side LLM tooling only | present only in `~/.metabob/config.json` | Not part of the substrate credential chain; the container's `ANTHROPIC_API_KEY` comes from the run environment (`secrets.env.sh:23`, deliberately not persisted) | verified-live |
| 5 | Git push credential (the "gitPat" role) | `BRINGUP_THREE_PATHS.md:64`; impl `secrets.env.sh:34-35`, `setup-git-push.sh` | Lives in the **container secrets file**, not in any `.metabob/config.json`. The helper is armed only when `SUBSTRATE_GIT_PAT` is non-empty | verified-in-code |
| 6 | `CLAUDE.md`'s fleet port table | `CLAUDE.md` "Reference: the running substrate" (`:18080/:18090/:18100/:18210/:18260`) | **identity-vessel's `:18101` is ABSENT** even though identity is described as "the single validator". Live: `8101/tcp -> 0.0.0.0:18101` published and answering. The table's own caveat covers it, but an operator reading the table alone cannot find the validator | doc-code-mismatch |

- **Step 2 evidence (independently re-measured).** Repo config → apiKey md5 `3e9d521e071f206cadc06b991b3bb27f`,
  endpoint `http://localhost:18080`; home config → **identical** md5, identical endpoint. See §6 cross-family
  conflict on why that identity is a coincidence and not a property.

**End state.** Host tooling holds one endpoint + one key; there is no separate hub-discovery or git-PAT key in
the metabob config surface.
**How to verify it actually worked.** Decode the key's payload (F5-P7 step 3) and check its org/iss against the
fleet you are pointing at, **before** blaming the endpoint.

---

### F5-P9 — Tenant isolation via SurrealDB PERMISSIONS

**Purpose.** Enforce org scoping in the database rather than in application code, so a missing application filter
cannot leak across tenants.
**Trigger.** Every authenticated query issued through `createAuthenticatedClient()`.
**Preconditions.** The JWT verifies against the `jwt_external` ACCESS (HS256, key = `JWT_SECRET`); the table
carries a PERMISSIONS clause referencing `$token.org_id`.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Authenticate the DB connection with the caller's JWT, then query without a WHERE | `docs/RBAC_GUIDE.md:158-164`; impl `jwtAuth.ts:376` | Claims land in `$token`; `$auth` is NONE for API-key-derived JWTs because `jwt_external` has no AUTHENTICATE clause (`jwtAuth.ts:385-391`) | verified-in-code |
| 2 | Author PERMISSIONS with `$token.*`, never `$auth.*` | `docs/RBAC_GUIDE.md:25,47,322`; impl migrations 079/080/083 (20-table sweep); `repos/activity-api/sql/migrations/121-fix-trace-table-permissions-token.surql:2-8` | **THE GUIDE'S OWN RULE WAS BROKEN AFTER IT WAS WRITTEN:** migrations 114–117 (later than the sweep) define `trace_digest`, `execution_trace_content`, `execution_system_traces`, `execution_exemplar` with `FOR select WHERE org_id = $auth.org_id`. Migration 121 exists to widen the trace tables. **26 migration files still reference `$auth.org_id`** | verified-in-code |
| 3 | Every activity-api query must go through the authenticated client | `docs/RBAC_GUIDE.md:148-164`; `docs/AUTH_JWT_CLAIMS.md:225` | **CONTRADICTED at `jwtAuth.ts:283-290`:** `requireAuthenticated` appears 25 times in `impulses.ts` and **ZERO** times across `activities.ts`'s 57 routes, which query through the module-level ROOT surreal client. There the tenant predicate sits inside `if (orgId)`, so a null org context does not narrow the query — it **REMOVES** the filter | doc-code-mismatch |
| 4 | Verify isolation by querying as two orgs (guide's Test 1) | `docs/RBAC_GUIDE.md:197-208` | Not performable: needs two orgs and root SurrealDB credentials, and `CLAUDE.md` forbids bypassing PERMISSIONS with root. This substrate has a single org | unverifiable-here |

**End state.** Tables that carry `$token.org_id` PERMISSIONS are isolated at the database; the `activities.ts`
surface is not.
**How to verify it actually worked.** Compare a root-credential count against an authenticated count for the SAME
table (`docs/RBAC_TROUBLESHOOTING.md:205-217`). Doing so requires root DB access, which is itself gated.

---

## 8. Family 6 — Update, deploy & self-deployment

7 processes, 63 steps. The family answers one question: **how does code reach a running substrate.**
Live evidence in this family was measured against the `substrate-live` container that was destroyed mid-audit
and rebuilt on 2026-08-24; every observation drawn from that instance is flagged **(measured pre-rebuild)** in
the outcome cell. The status values are the original auditor's, uncorrected — an expired observation is not a
retracted one, but it is no longer standing.

### F6-P1 — push to origin/dev → in-container pull-sync → health-gated restart (the per-vessel loop)

**Purpose.** Converge each vessel's live `/vessels` runtime to the commit on `origin/dev`, with no host mediating.
This is the ONLY load-bearing code channel into a running substrate (stated at
`scripts/substrate/units/substrate-pull-sync.service:4-10`).
**Trigger.** `substrate-pull-sync.timer`: `OnBootSec=3min`, `OnUnitActiveSec=10min`, `RandomizedDelaySec=60`
(`scripts/substrate/units/substrate-pull-sync.timer:5-8`). Also once at boot after `git-push-setup.service`.
**Preconditions.** A per-vessel git clone exists under `/workspace/git/vessels/<v>` with a `.git` dir; a PAT /
network reachable for `git fetch origin dev` (fail-open: no PAT ⇒ warn + no-op); `/vessels/<v>` exists in this
image (otherwise the vessel is marked and skipped); `bun` on PATH for the test gate (absent ⇒ gate blind,
converge ungated).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | systemd starts `substrate-pull-sync.service` (`Type=oneshot`, `TimeoutStartSec=900`) which execs `/usr/local/bin/substrate-pull-sync` | `scripts/substrate/units/substrate-pull-sync.service:12-19`; impl `substrate-pull-sync.sh:1-59` | A tick begins; whole run is budgeted at 900s (measured pre-rebuild) | verified-live |
| 2 | If `/workspace/mitosis-pending.json` is fresher than `MITOSIS_LOCK_TTL_MIN` (30m), skip the run — but only for `MITOSIS_MAX_CONSECUTIVE_DEFERS` (4) consecutive ticks, then converge anyway ("STARVATION BREAK") | `substrate-pull-sync.sh:100-130`; impl `:116-128` | Cutover races avoided without indefinite staleness | verified-in-code |
| 3 | POST `{"impulse":{"type":"maintenanceLease","name":"change_window"}}` to development-vessel `/v2/impulses/resolve`; if `"held":true`, exit 0 for the whole tick | `substrate-pull-sync.sh:132-143`; impl `:135-143` | Whole tick deferred, one JSONL line appended (measured pre-rebuild) | verified-live |
| 4 | For each clone dir: `git -C <d> fetch -q origin dev`; classify HEAD vs `origin/dev` | `substrate-pull-sync.sh:402-412`; impl `:407-412` | fetch failure ⇒ skipped (counted, non-fatal, does NOT fail the run) (measured pre-rebuild) | verified-live |
| 5 | ahead ⇒ skip; behind ⇒ `reset --hard HEAD` + `clean -fd` + `checkout dev` + `pull --ff-only`; diverged ⇒ auto-rebase ONLY if every local-only commit's author AND committer is the substrate identity, then push; otherwise abort rebase + emit substrateGap `pull-sync-diverged-<v>` | `substrate-pull-sync.sh:414-482`; impl `:415-481` | Clone lands on `origin/dev`, or is refused with a filed gap. Never forced. (measured pre-rebuild) | verified-live |
| 6 | Compute `content_hash` = md5 over sorted `src/`+`sql/` `*.ts\|*.json\|*.surql` of the clone and of `/vessels/<v>`; compare (NOT the git sha) | `substrate-pull-sync.sh:389-399, 484-494`; impl `:398` | Skip decision is made on trees, not on a marker that can lie (measured pre-rebuild) | verified-live |
| 7 | If the vessel's inventory unit is a `.service` and `systemctl is-enabled` == `masked` → SKIP entirely (no fetch, no test, no mirror) | `substrate-pull-sync.sh:503-530`; impl `:526-530` | A masked vessel cannot consume the tick budget | verified-in-code |
| 8 | If a `<v>.restart-pending` marker matches the current content hash, take the OWED restart now (deferring at most `RESTART_DEFER_MAX=3` ticks on `in_flight>0`) | `substrate-pull-sync.sh:538-568`; impl `:542-568` | Mirrored-but-never-loaded code finally gets loaded | verified-in-code |
| 9 | Drift heal: when `LAST==CLONE_HASH` but the runtime tree differs from the clone (and no authoring marker for the vessel), clear re-attempt suppression, log "RUNTIME SOURCE TRUNCATED", emit gap `runtime-source-truncated-<v>`, re-mirror | `substrate-pull-sync.sh:624-695`; impl `:684-694` | Live source that a drafter edited in place is restored from git (measured pre-rebuild) | verified-live |
| 10 | Authoring-marker deferral: any live `/workspace/authoring-inflight/*-<v>.json` (fresh AND pid alive) defers this vessel; leaked markers (dead pid or older than 90m) are reaped. For development-vessel the glob is `*.json` (any marker), bounded by `AUTHORING_HOST_MAX_DEFERS=6` | `substrate-pull-sync.sh:698-900`; impl `:717-900` | An in-flight compose is not killed; a filed `pull-sync-deferred-<v>` gap records the deferral | verified-in-code |
| 11 | Quiesce: if `/health` reports `in_flight>0` and `drain_ms>=15000`, touch `/workspace/quiesce/<v>` to close admission and poll until `in_flight==0`, capped by what remains of `TimeoutStartSec` less a 120s margin | `substrate-pull-sync.sh:799-862`; impl `:818-862` | Convergence waits for work to finish instead of destroying it; on timeout it converges anyway and says the run IS lost | verified-in-code |
| 12 | TEST GATE: run the CLONE's `bun test` under `timeout --kill-after=30 240`; compare the SET of failing test names against `/workspace/.test-baseline/<v>.failnames`; a name that passed at baseline and now fails in BOTH of two runs = regression ⇒ refuse (bounded to `TEST_GATE_MAX_REFUSALS=3`, then converge and accept a degraded baseline + file a gap) | `substrate-pull-sync.sh:902-1082`; impl `:963-1081` | Delta-based gate; flakes do not block (measured pre-rebuild) | verified-live |
| 13 | Per-tick budget: once `GATE_BUDGET_SECONDS` (420s) of the tick is spent, the gate is DISABLED for remaining vessels and a `pull-sync-testgate-skipped-<v>` gap is filed | `substrate-pull-sync.sh:914-933`; impl `:923-933` | Convergence proceeds UNGATED on slow ticks | verified-in-code |
| 14 | `/usr/local/bin/mirror-to-live <v> <clone-dir>` — `git reset --hard HEAD`, rm+cp `src/`, `sql/`, `scripts/`, copy `tsconfig.json`/`index.ts`, rewrite relative `file:` deps to absolute `/vessels` paths, clean `bun install` iff `package.json` changed | `substrate-pull-sync.sh:1084-1089`; impl `mirror-to-live.sh:71-121` | Live runtime tree replaced; post-mirror assertion that `DST/src` exists (measured pre-rebuild) | verified-live |
| 15 | Restart the unit (with the vessel-unit `.timer`→`.service` fallback at `:1207-1213`), sleep `STAGGER_SECONDS=8`, then poll `/health` up to 5×4s | `substrate-pull-sync.sh:1195-1305`; impl `:1300-1305` | New module graph actually loaded (bun does not hot-reload) (measured pre-rebuild) | verified-live |
| 16 | Unhealthy after restart ⇒ `git checkout <PREV_GOOD> -- .`, re-mirror, restore branch, restart, emit `pull-sync-unhealthy-<v>` gap, and BREAK the whole run | `substrate-pull-sync.sh:1306-1320`; impl `:1307-1319` | Automatic revert to the last-good pin; run halts | verified-in-code |
| 17 | Detector: unit is masked AND (`active\|activating\|failed`) ⇒ log + emit `unit-masked-while-active-<v>` gap. Matches BOTH `masked` and `masked-runtime` | `substrate-pull-sync.sh:1216-1250`; impl `:1243-1250` | The latent-unrecoverable-outage class is now asserted | verified-in-code |
| 18 | Write `/workspace/.last-good/<v>` = HEAD; at end log `done — synced=N skipped=N failed=N` and `exit 1` iff `failed>0` | `substrate-pull-sync.sh:1323-1324, 1567-1587`; impl `:1583-1587` | Timer result reflects real convergence failure (measured pre-rebuild) | verified-live |

- **Step 1 evidence (expired).** `systemctl show substrate-pull-sync.service`: `Result=success`,
  `ExecMainStatus=0`, `ExecMainStartTimestamp=Tue 2026-08-25 04:54:28 UTC`, `ExecMainExitTimestamp=04:55:58`,
  `TimeoutStartUSec=15min`, `NRestarts=0`. Timer `ActiveState=active`, `UnitFileState=enabled`,
  `LastTriggerUSec=04:54:28`.
- **Step 2 evidence.** No `starvation_break_mitosis` rows in the `/workspace/pull-sync-deferrals.jsonl` tail;
  mechanism read in code only.
- **Step 3 evidence (expired).** `tail /workspace/pull-sync-deferrals.jsonl` →
  `{"at":"2026-08-24T09:41:45+00:00","actor":"pull-sync","action":"deferred_change_window"}` (5 such in the last
  2 days).
- **Step 4 evidence (expired).** 18 clones present in `/workspace/git/vessels`; e.g. development-vessel
  `HEAD=632955a` == `origin/dev`.
- **Step 5 evidence (expired).** goal-host-vessel clone `HEAD=3afb181` ("substrate-authored: apply
  route-edit-40fb14ac-compose-report via mitosis cutover") == its `origin/dev` — a substrate-authored landing
  that reached origin. `git config user.name` in the clone and `--system` = "Substrate Autonomous", which is what
  the FOREIGN test compares against.
- **Step 6 evidence (expired).** Journal: `development-vessel: content 2001b7d59f -> 5dba94e09c (git 632955ae97)
  — mirroring into /vessels` (Aug 25 04:55:39).
- **Step 7 evidence.** Read in code; no masked-skip lines in this deployment's journal (standalone role, nothing
  masked) — a negative the auditor did not treat as proof.
- **Step 8 evidence.** `ls /workspace/.pull-sync/*.restart-pending` → none outstanding at the time of reading.
- **Step 9 evidence (expired).** 12 occurrences in the journal; latest Aug 25 04:54:32 `development-vessel:
  RUNTIME SOURCE TRUNCATED — content drift (live 2001b7d59f != clone 5dba94e09c)`. Recurs every few hours on
  development-vessel and goal-host-vessel.
- **Step 10 evidence.** Code read; no `reaped_marker` rows in the deferral log tail.
- **Step 11 evidence.** Code read only; no quiesce lines in the last 4 days of journal.
- **Step 12 evidence (expired).** Journal Aug 25 03:13:49: `development-vessel: FLAKY suite — 108 then 105 fail
  on identical source; using 105`, then `newly-failing tests did not reproduce on re-run — flake, converging
  (run1 3 new, run2 0 new, intersection 0)`. Baseline files exist in `/workspace/.test-baseline/` (10 of 20 have
  a `.failnames` companion).
- **Step 13 evidence.** Code read; the 04:54 tick spent 90s total so the branch did not fire.
- **Step 14 evidence (expired).** Journal Aug 25 04:55:39: `[mirror-to-live] development-vessel mirrored
  (632955a) -> /vessels/development-vessel`, preceded by `HEAD is now at 632955a fix(feature-compose): …`.
- **Step 15 evidence (expired).** development-vessel `ActiveEnterTimestamp=Tue 2026-08-25 04:55:40 UTC`,
  `MainPID=106850`, `NRestarts=0` — one second after the mirror at 04:55:39; `/vessels/development-vessel/src/index.ts`
  mtime 04:55:39. The restart landed and the process is newer than the file.
- **Step 16 evidence.** Code read; no such line in 4 days of journal.
- **Step 17 evidence.** Code read; nothing masked on that fleet so the detector is quiet by construction.
- **Step 18 evidence (expired).** Journal Aug 25 04:55:58 `done — synced=1 skipped=0 failed=0`; unit
  `Result=success ExecMainStatus=0`.

**End state.** `/vessels/<v>` matches the clone at `origin/dev`, the unit has restarted onto it,
`/workspace/.last-good/<v>` pins the sha, and the tick exits 0. On the audited box: development-vessel at
`632955a`, goal-host-vessel at `7d3bf1a`→`3afb181`, activity-api at `03e6c55`, all mirrored and restarted from
git with no operator hands.
**How to verify it actually worked.** Do NOT read `synced=`. Compare the unit's MainPID / ActiveEnterTimestamp
against the mtime of the mirrored file: `systemctl show <v>.service -p MainPID -p ActiveEnterTimestamp` vs
`stat -c %y /vessels/<v>/src/index.ts`. A process older than the file is running stale code with every green
signal intact.

---

### F6-P2 — shared `file:` package rebuild and fan-out to consumers

**Purpose.** A clone with NO unit of its own but a `build` script that other runtime vessels `file:`-depend on
(`ias-executor-ts`, `cpg-inference-ts`) must have its `dist` rebuilt and physically reach every consumer, then
bounce them.
**Trigger.** Inside P1, immediately after the mirror, when `vessel_unit(v)` is empty / not a `.service` AND
`/vessels/<v>/dist` exists AND `package.json` declares a `build` script. Also re-entered by the `DIST_RETRY` path
when last-good != HEAD.
**Preconditions.** `/vessels/<v>/dist` exists; at least one `/vessels/*/package.json` contains
`file:.../<v>"`; `tsconfig.build.json` present; `/root/.bun/bin/bun` available.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Discover consumers at use time: `grep -lE "file:[^\"]*/$v\"" /vessels/*/package.json` (no hardcoded list) | `substrate-pull-sync.sh:1091-1105`; impl `:1105` | Consumer set derived from the live layout (measured pre-rebuild) | verified-live |
| 2 | Build to a STAGING dir: `bun run tsc --project tsconfig.build.json --outDir /vessels/<v>/.dist.stage`; require a non-empty `index.js` | `substrate-pull-sync.sh:1108-1113`; impl `:1109` | A bad build touches NO consumer; emits `pull-sync-build-<v>` gap and continues | verified-in-code |
| 3 | Atomic swap: `dist` → `.dist.prev`, stage → `dist` | `substrate-pull-sync.sh:1114`; impl `:1114` | Symlinked consumers see the new build by reference | verified-in-code |
| 4 | For every consumer whose `node_modules/<pkg>/dist/index.js` is NOT a symlink, `rm -rf` and `cp -a` the new dist in | `substrate-pull-sync.sh:1116-1150`; impl `:1146-1149` | Real-file consumers (the majority, historically 5 of 6) actually receive the bytes | verified-in-code |
| 5 | Restart each consumer staggered 8s, health-poll 5×4s; any unhealthy ⇒ restore `.dist.prev`, re-restart the bounced set, write `<v>.fanout-fail=HEAD`, emit `pull-sync-fanout-<v>`, HALT the run | `substrate-pull-sync.sh:1152-1168`; impl `:1153-1167` | Bad fan-out is reverted, not left half-applied | verified-in-code |
| 6 | CONTENT verification before crediting: md5 of `/vessels/<v>/dist/index.js` vs each consumer's `node_modules/<pkg>/dist/index.js`; any mismatch ⇒ withhold last-good, emit `pull-sync-unpropagated-<v>`, count as failed | `substrate-pull-sync.sh:1169-1190`; impl `:1177-1189` | "Healthy but running old code" cannot be credited (measured pre-rebuild) | verified-live |
| 7 | On success: `rm .dist.prev`, write `/workspace/.last-good/<v>=HEAD`, clear fanout-fail, `continue` (skipping the ordinary restart block) | `substrate-pull-sync.sh:1191`; impl `:1191` | `synced++` (measured pre-rebuild) | verified-live |

- **Step 1 evidence (expired).** Journal Aug 24 05:31:23: `ias-executor-ts: shared package changed -- rebuilding
  dist for consumers: analysis-vessel development-vessel goal-host-vessel llm-resolver-vessel local-tools-vessel
  ribosome-vessel`.
- **Step 2 evidence.** Code read; a permanent `cpg-inference-ts` BUILD FAILED is cited in the script's own
  exit-code rationale (`:1573-1574`) as the reason the run now exits non-zero.
- **Step 4 evidence.** Code read; the comment records the measured 2026-08-16 state where 5 of 6 consumers were
  frozen at 08-05.
- **Step 5 evidence.** Code read; `ls /workspace/.pull-sync/*.fanout-fail` → none present.
- **Step 6 evidence (expired).** Journal Aug 24 05:33:59: `ias-executor-ts: fan-out healthy AND propagated across
  analysis-vessel development-vessel goal-host-vessel llm-resolver-vessel local-tools-vessel ribosome-vessel` —
  the wording only prints after the md5 check passes.
- **Step 7 evidence (expired).** 4 successful fan-outs in the journal (Aug 21 ×2, Aug 22, Aug 24), each with the
  propagated wording.

**End state.** Every consumer's `node_modules` copy of the shared package is byte-identical to the freshly built
dist and has been restarted onto it — verified by md5, not by health.
**How to verify it actually worked.** `md5sum /vessels/ias-executor-ts/dist/index.js` and compare against each
`/vessels/<c>/node_modules/@avigopal/ias-executor-ts/dist/index.js`. Health is blind to this — a consumer on an
11-day-old dist returns 200.

---

### F6-P3 — super-repo glue-layer convergence (self-update, units, fleet defs, super-repo-hosted vessels)

**Purpose.** Converge the parts of the deployment that live in the super-repo rather than in a vessel clone:
pull-sync itself, `mirror-to-live`, `self-recovery-tick`, systemd units,
`apply-inventory`/`gen-env`/`vessel-ctl`/`render-unit`/`secrets.env.sh`, the fleet inventory+manifest,
active-scripts, the federation relay/transport, and vessels whose workdir is `$REPO_ROOT/repos/<name>`.
**Trigger.** Runs at the end of every pull-sync tick, after the vessel loop.
**Preconditions.** `/workspace/git/super-repo/.git` exists; `git fetch origin dev` succeeds (bursty link — a
failure skips the WHOLE glue layer).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `git -C /workspace/git/super-repo fetch -q origin dev` — ONCE, branching on the result; a failure logs "super-repo: FETCH FAILED — glue layer NOT converged this tick" | `substrate-pull-sync.sh:1337-1363`; impl `:1356-1363` | Non-fatal but sayable (it used to be silent for 24 commits) (measured pre-rebuild) | verified-live |
| 2 | Classify ahead/behind/diverged; behind ⇒ `checkout dev` + `pull --ff-only`, printing git's own error on failure; diverged ⇒ emit `pull-sync-diverged-super-repo` | `substrate-pull-sync.sh:1364-1399`; impl `:1372-1397` | Glue clone lands on `origin/dev` (measured pre-rebuild) | verified-live |
| 3 | Per-submodule `git submodule update --init -- <path>`, SKIPPING BY NAME any worktree with `git status --porcelain` output (never forced) | `substrate-pull-sync.sh:1409-1436`; impl `:1427-1436` | On the audited deployment: ALL 18 submodule worktrees are dirty, so ALL 18 are skipped on EVERY convergence | known-broken |
| 4 | Self-refresh: install-to-`.new` + atomic `mv` of `substrate-pull-sync.sh` → `/usr/local/bin/substrate-pull-sync`, and `mirror-to-live.sh`, `self-recovery-tick.sh` | `substrate-pull-sync.sh:1437-1457`; impl `:1438-1457` | The converger converges itself; takes effect on the NEXT tick (running process keeps its inode) | verified-in-code |
| 5 | `cp -f /workspace/git/super-repo/scripts/substrate/*.ts /workspace/active-scripts/` | `substrate-pull-sync.sh:1475-1476`; impl `:1476` | Timer-driven `.ts` ticks converge | verified-in-code |
| 6 | Restart every manifest vessel whose workdir startswith `$REPO_ROOT/repos/` AND whose `repos/<dir>/` appears in `git diff --name-only SLAST..SHEAD`; stagger + health-poll | `substrate-pull-sync.sh:1477-1525`; impl `:1506-1524` | human-surface-vessel is the one such vessel today; it runs straight out of the clone with no mirror step | verified-in-code |
| 7 | Restart `federation-relay` ONLY on a change to `scripts/substrate/federation-relay/relay.ts`; restart `federation-transport-vessel` on any change under `federation-relay/`, health-gate `:8401`, revert the clone to `SPREV` on failure | `substrate-pull-sync.sh:1527-1552`; impl `:1529-1548` | Peer reservations are not dropped gratuitously | verified-in-code |
| 8 | `converge_units` UNCONDITIONALLY each tick: install `scripts/substrate/units/*` into `/usr/lib/systemd/system` (never `/etc`, so masking still works), daemon-reload on change, and warn when a REAL `/etc/systemd/system/<unit>` shadows it | `substrate-pull-sync.sh:164-224, 1557-1559`; impl `:188-223` | Repo units and `/usr/lib` were identical (0 differing of ~120 files), so nothing converged and nothing warned (measured pre-rebuild) | verified-live |
| 9 | `converge_fleet_defs`: unconditionally install `apply-inventory.sh`/`gen-env.sh`/`render-unit.sh`/`vessel-ctl.sh`/`secrets.env.sh` (both copies) when they differ from the installed binaries, with a per-script "takes effect" message | `substrate-pull-sync.sh:251-358, 1561-1565`; impl `:278-358` | Bootstrap-tier tooling self-updates from git (measured pre-rebuild) | verified-live |
| 10 | Conditional fleet-definition convergence with a sidecar: if live == git ⇒ refresh sidecar; if live == sidecar (unmodified) ⇒ install git version; if no sidecar ⇒ adopt live as baseline; else ⇒ REFUSE and log | `substrate-pull-sync.sh:226-250, 360-386`; impl `:372-385` | On the audited deployment `vessels.inventory.json` converges cleanly, but `vessels.manifest.json` is PERMANENTLY REFUSED — over a pure JSON whitespace difference | known-broken |

- **Step 1 evidence (expired).** Container super-repo `HEAD=017b5e9a` == its `origin/dev`; no FETCH FAILED lines
  in the last 24h.
- **Step 2 evidence (expired).** Journal Aug 25 00:24:19: `super-repo: d56ae84924… -> 017b5e9a4f — refreshing
  glue layer`. Ten such advances in the last 24h.
- **Step 3 evidence (expired).** Journal, every super-repo advance: `submodule worktrees left at old pointers
  (uncommitted work — NOT discarded): repos/concept-db repos/discovery-vessel … repos/libp2p-federation-transport`
  (18 names). Measured lag: development-vessel checkout `11700472a5` vs recorded `3e2272ae28` = **56 behind**;
  goal-host-vessel = **70 behind**; activity-api = **87 behind**.
  `git -C repos/development-vessel status --porcelain` shows 10+ modified/deleted `src` files.
- **Step 4 evidence.** Also done unconditionally in `converge_fleet_defs` at `:327-333`.
  `systemctl show … -p FragmentPath` = `/lib/systemd/system/substrate-pull-sync.service` (image path, no `/etc`
  shadow).
- **Step 6 evidence.** `systemctl show human-surface-vessel.service -p WorkingDirectory` =
  `/workspace/git/super-repo/repos/human-surface-vessel`; manifest workdir =
  `$REPO_ROOT/repos/human-surface-vessel`; `ActiveEnterTimestamp` Aug 23 01:00:37, `NRestarts=0` (no ui change
  since 2026-08-09, so nothing to trigger).
- **Step 7 evidence.** Code read; `federation-transport-vessel` is not present on that standalone deployment.
- **Step 8 evidence (expired).** In-container:
  `for f in …/units/*; cmp -s $f /usr/lib/systemd/system/$(basename $f)` → `differing=0`.
  `journalctl -u substrate-pull-sync | grep -c 'units: converged'` → 0; `grep -c SHADOWED` → 0.
- **Step 9 evidence (expired).** Journal Aug 23 10:07:11: `fleet: converged apply-inventory (takes effect at next
  container start, or immediately via 'vessel-ctl apply')` and `fleet: converged vessel-ctl (takes effect on the
  NEXT INVOCATION — this is re-executed from disk each time)` — the corrected per-script wording is live (the
  Aug 22 lines still show the old blanket wording).
- **Step 10 evidence (expired).** `diff -q live git` on the manifest → differ; but `jq -S -c` of both →
  SEMANTICALLY IDENTICAL. Journal: the refusal line had fired **501 times**, first at Aug 21 12:28:45, and there
  is no `adopting the live copy as baseline` line anywhere. Sidecar mtime 2026-08-14 20:33, live file mtime
  2026-08-15 00:44. Inventory: `diff -q` rc=0.

**End state.** The glue layer (scripts, units, relay, active-scripts) tracks `origin/dev`; the fleet inventory
tracks git; the fleet MANIFEST does not and has not for 10 days; the super-repo's submodule worktrees are 56–87
commits behind their recorded pointers and are skipped every tick.
**How to verify it actually worked.**
`docker exec substrate-live git -C /workspace/git/super-repo rev-parse HEAD origin/dev` (must match) AND,
separately, for each submodule: `git -C repos/<v> rev-parse HEAD` vs `git ls-tree HEAD repos/<v>`. Matching
super-repo SHAs do NOT imply the `repos/` trees moved.

---

### F6-P4 — landing a commit through the super-repo pre-commit hook

**Purpose.** Keep the super-repo a thin coordinator (`ALLOWED_TOPLEVEL_DIRS`), keep secrets out, and force a UI
source change to carry its rebuilt `ui/dist` bundle — because git is the only channel that reaches a running
surface.
**Trigger.** `git commit` in a clone where `core.hooksPath` points at `scripts/git-hooks`.
**Preconditions.** `scripts/git-hooks/install.sh` has been run in THAT clone; `gitleaks` installed (optional —
absent ⇒ scan silently skipped with a note); `sops` installed (only if `secrets/*.secrets.yaml` is staged).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `scripts/git-hooks/install.sh` → `git config core.hooksPath "$SUPER_ROOT/scripts/git-hooks"` (an ABSOLUTE path, per-clone, not committed) | CLAUDE.md "Repository conventions"; `scripts/git-hooks/README.md:9`; impl `scripts/git-hooks/install.sh:95` | Hooks active in the operator's clone only (measured pre-rebuild) | verified-live |
| 2 | Collect `git diff --cached --name-only --diff-filter=AR` — ONLY newly added/renamed files are inspected for placement | `scripts/git-hooks/pre-commit:9-11, 88-93`; impl `:89` | Modifications to existing tracked files are never blocked (grandfathering by design) | verified-in-code |
| 3 | Reject any new file whose first path segment is not in `ALLOWED_TOPLEVEL_DIRS` = `repos docs openspec scripts packages validation .claude .github .githooks .well-known`; root files must match `ROOT_ALLOWLIST` or `.env.*.example` | CLAUDE.md "Placement" (names the array as authoritative); impl `scripts/git-hooks/pre-commit:72-83, 110-117, 161-206` | Root cruft rejected with a per-class remedy | verified-in-code |
| 4 | `repos/<name>` at depth ≤2 is skipped (submodule pointer bump); deeper `repos/` paths get only the cross-cutting `node_modules` / artefact checks | `scripts/git-hooks/pre-commit:129-156`; impl `:135-156` | Submodule internals are delegated to `vessel-pre-commit` | verified-in-code |
| 5 | `sops` check on staged `**/secrets/*.secrets.yaml`; then `gitleaks protect --staged --redact --config scripts/git-hooks/.gitleaks.toml` | `scripts/git-hooks/pre-commit:270-357`; impl `:336-337` | Missing gitleaks ⇒ prints a note and PROCEEDS (deliberate) | verified-in-code |
| 6 | UI bundle gate: if any staged path matches `^repos/human-surface-vessel/ui/(src/\|index.html\|vite.config\|package.json)$` and NO staged path matches `^repos/human-surface-vessel/ui/dist/`, reject and print the docker rebuild command | `docs/HUMAN_SURFACE.md:224-244`; impl `scripts/git-hooks/pre-commit:359-402` | Enforces the committed-bundle rule the surface's delivery depends on | verified-in-code |
| 7 | Substrate-authored commits (mitosis cutover / `feature_compose`) run `git add`/`git commit` in `/workspace/git/vessels/<v>` or the super-repo clone | `docs/HUMAN_SURFACE.md:239-241` ("cannot cover a commit path that skips hooks — substrate-authored commits included"); impl `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts:1892-1917` | NO hook runs at all — not the ui/dist gate, not the placement guard, not gitleaks, not sops. `--no-verify` is not even needed; hooksPath is simply unset | known-broken |
| 8 | Vessel-repo hook: `install.sh --vessel repos/<name>` copies `vessel-pre-commit` into `<vessel>/.git-hooks/pre-commit` and sets `core.hooksPath=.git-hooks` | `scripts/git-hooks/README.md:115`; CLAUDE.md "run scripts/git-hooks/install.sh in every clone"; impl `scripts/git-hooks/install.sh:47-82` | Not installed in any sampled vessel clone | known-broken |

- **Step 1 evidence (expired in its in-container half).** Host repo: `git config core.hooksPath` =
  `/home/avi/documents/work/substrate/scripts/git-hooks`; `.git/hooks/pre-commit` does not exist. In-container:
  `git -C /workspace/git/super-repo config core.hooksPath` → unset, and no `.git/hooks/pre-commit`. Same for
  `/workspace/git/vessels/development-vessel`.
- **Step 4 evidence.** 18 of 28 `repos/` entries are submodules per `.gitmodules`; human-surface-vessel and 9
  others are direct trees (53 tracked files under `repos/human-surface-vessel`).
- **Step 6 evidence.** `ui/dist` IS tracked (`git ls-files repos/human-surface-vessel/ui/dist` → 3 files); the
  committed `index.html` references `assets/index-CecXPzuR.js` + `index-B49pmsY7.css` and exactly those two files
  exist on disk; last `ui/src` commit `97867d1d` also touched `ui/dist`. Gate consistent with reality.
- **Step 7 evidence.** In-container: `core.hooksPath` unset AND no `.git/hooks/pre-commit` in BOTH
  `/workspace/git/super-repo` and `/workspace/git/vessels/development-vessel`. `rg 'no-verify' repos/*/src` finds
  no call site — the bypass is by absence, not by flag.
- **Step 8 evidence.** `git -C repos/{goal-host-vessel,activity-api,development-vessel} config core.hooksPath` →
  unset in all three.

**End state.** A commit lands on `dev` with placement, secrets and bundle rules enforced — but ONLY on the
operator's own super-repo clone. Every other commit path in the system, including the autonomous one, is ungated.
**How to verify it actually worked.** `git config core.hooksPath` in the clone that will actually make the
commit, plus `ls .git/hooks/pre-commit`. A hook that exists in the tree is not a hook that runs.

---

### F6-P5 — deploying onto a fresh VM / redeploying the hub

**Purpose.** Stand a substrate up on a remote machine (ship image over SSH) or swap the hub's container onto the
CI-published ghcr image while preserving learning state.
**Trigger.** Operator runs `bash scripts/substrate/deploy-remote.sh user@ip` or
`bash scripts/substrate/deploy-hub-pull.sh user@ip public-ip`.
**Preconditions.** `ANTHROPIC_API_KEY` in env or `~/.metabob/config.json`; ssh reachability, and for
deploy-remote a locally built image (built if missing); for deploy-hub-pull the ghcr package public (credentials
optional).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | deploy-remote: `docker save $IMAGE \| gzip \| ssh $TARGET 'gunzip \| docker load'` (no registry, ~4-6GB) | `scripts/substrate/deploy-remote.sh:12-22`; impl `:44-51` | Image present on the VM | unverifiable-here |
| 2 | `docker stop -t 300 substrate-live` then `docker rm -f`, then `docker run -d … -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb` | `scripts/substrate/deploy-remote.sh:64-75`; impl `:69-75` | Drain before kill; named volumes preserve learning state | verified-in-code |
| 3 | Poll `:18080/health` up to 40×2s, then `bun /vessels/seed-identity.ts` in-container | `scripts/substrate/deploy-remote.sh:76-79`; impl `:77-79` | Identity seeded; output filtered through `grep -E 'issued API key\|org created'` | unverifiable-here |
| 4 | deploy-hub-pull: `docker pull ghcr.io/<owner>/substrate:dev`, print OLD→NEW image id, tag as `metabob/substrate:dev` | `scripts/substrate/deploy-hub-pull.sh:1-20`; impl `:56-62` | ~2 min swap instead of a 20-30 min on-VM build | unverifiable-here |
| 5 | Relay handling: prefer the managed `federation-relay.service`; else if something already serves `:30333` LEAVE IT and read its live multiaddr; only hand-start with the PINNED `RELAY_KEY_FILE` when nothing serves the port | `scripts/substrate/deploy-hub-pull.sh:84-112`; impl `:96-112` | Avoids minting a divergent peer-id that makes every advertised circuit addr undialable | verified-in-code |
| 6 | Thread host LLM keys from `/etc/environment` (GOOGLE/GROQ/MISTRAL/CHUTES/OPENROUTER/RUNPOD/SUBSTRATE_GIT_PAT) into `docker run -e …` | `scripts/substrate/deploy-hub-pull.sh:113-124`; impl `:118-124` | Prevents the "two container swaps quietly killed non-anthropic LLM capacity" class (arms `ExecCondition` on their key) | verified-in-code |
| 7 | Write `/etc/systemd/system/federation-transport-vessel.service` into the container by heredoc, daemon-reload, `enable --now` | `scripts/substrate/deploy-hub-pull.sh:155-190`; impl `:163-187` | Hub egress on `:8401` — but written to `/etc`, which permanently shadows any `/usr/lib` unit convergence for that name | verified-in-code |
| 8 | Unmask + enable `llm-resolver-vessel` on the hub if any provider key is in `/etc/environment` | `scripts/substrate/deploy-hub-pull.sh:192-204`; impl `:198-204` | Idempotent per-deploy re-enable of a `role=compute` vessel the hub role masks | verified-in-code |
| 9 | After ANY of these, ongoing updates arrive via P1/P3 — no SSH needed: push to `origin/dev`, pull-sync converges | `scripts/substrate/units/substrate-pull-sync.service:4-10`; `scripts/substrate/deploy-remote.sh:113`; impl `substrate-pull-sync.sh:402-1587` | `deploy-remote.sh:113` still advises "re-run this script" or "push the image to a registry" and does not mention pull-sync at all | doc-code-mismatch |

- **Step 2 rationale.** The 300s drain matches the vessels' 240s `TimeoutStopSec` drain; read in code.
- **Scope note.** Nothing in this process was verified live: the auditor had no hub shell, no second machine and
  no SSH key, and attempted no remote call.

**End state.** A running substrate on the target machine with its learning volumes intact, thereafter
self-updating from `origin/dev`.
**How to verify it actually worked.** On the target:
`docker exec substrate-live systemctl show substrate-pull-sync.timer -p ActiveState -p LastTriggerUSec` and
`journalctl -u substrate-pull-sync | tail`. A green `/health` on `:18080` proves nothing about whether the update
channel is armed.

---

### F6-P6 — host-mediated `federation-pull-sync` (the superseded docker-cp path)

**Purpose.** Push source from a host super-repo mirror into one or more containers via `docker cp` + restart.
Explicitly INVERTED by `substrate-pull-sync.sh:1-8`.
**Trigger.** Operator runs `APPLY=1 bash scripts/substrate/federation-pull-sync.sh --once`. No timer, no unit.
**Preconditions.** Run on a HOST with docker and a super-repo checkout on branch `dev`; `APPLY=1` (dry-run by
default).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `git fetch origin dev`; refuse if the checkout is not ON `dev`; ff-only pull; `git submodule update --init` | `scripts/substrate/federation-pull-sync.sh:22-28`; impl `:50-63` | Divergence exits 1 for triage, never merged | verified-in-code |
| 2 | Diff `PREV..HEAD` limited to `repos/` to derive changed vessels | `scripts/substrate/federation-pull-sync.sh:11-12`; impl `:72-77` | Vessel set derived from the marker at `$HOME/.federation-pull-sync.sha` | verified-in-code |
| 3 | Per container: `docker cp <src>/src/. <c>:/vessels/<v>/src/` (+ `sql/`, `package.json`), then `docker exec <c> systemctl restart <unit>.service` | `scripts/substrate/federation-pull-sync.sh:12-14`; impl `:93-96` | NO test gate, NO health gate, NO revert-to-last-good, and `docker cp` into an existing `src/` nests (the `src/src` gotcha `mirror-to-live.sh:12-13` exists to avoid) — here the trailing `/.` avoids it | verified-in-code |
| 4 | Write the marker only under `APPLY=1` | `scripts/substrate/federation-pull-sync.sh:100`; impl `:100` | Dry-run is safe | verified-in-code |

**End state.** Containers hold the host's source. Not used on this deployment; nothing schedules it.
**How to verify it actually worked.** There is no unit for it:
`docker exec substrate-live systemctl list-units '*federation-pull*'` returns nothing. Its use is an operator
decision, and it bypasses every gate P1 added.

---

### F6-P7 — build preflight and image reproducibility (`validate-build`)

**Purpose.** Catch the container-only invariants (`file:` dep resolution, frozen-lockfile sync, import↔dep drift)
before a 20-30 min image build, and warn when the image built here is not the image git describes.
**Trigger.** `make -C scripts/substrate build` (and `up`) depend on it; also called from `deploy-hub.sh` and
`ui-only-up.sh`.
**Preconditions.** `bun` on the HOST PATH (the Makefile fails with an explicit remedy if absent); submodules
checked out (`preflight-submodules`).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `preflight-submodules` asserts `repos/discovery-vessel/package.json` exists | `scripts/substrate/Makefile:317-322`; impl `:318-322` | Names the remedy `git submodule update --init --recursive` | verified-in-code |
| 2 | `bun scripts/substrate/validate-build.ts` — derive containerized vessels from `COPY repos/<v>/package.json` stanzas in `Dockerfile.substrate` and their per-stanza seds | `scripts/substrate/Makefile:327-337`; impl `scripts/substrate/validate-build.ts:62-78` | 19 containerized vessels detected | verified-live |
| 3 | Check each `file:` dep resolves on host; that a relative dep leaking into the container still lands under `/vessels`; and that no Dockerfile sed rewrites a path no dependency uses (dead rewrite after a dir rename) | `scripts/substrate/validate-build.ts:12-21`; impl `:96-130` | 0 errors on the current tree | verified-live |
| 4 | For `--frozen-lockfile` stanzas: `bun.lock` must be git-TRACKED (not merely present) and contain every dependency key | `scripts/substrate/validate-build.ts:33-48`; impl `:134-155` | Catches the gitignored-lockfile case a dirty dev tree masks | verified-in-code |
| 5 | Reproducibility: compare each submodule checkout to the super-repo's recorded pointer, assert the pointer is on some remote-tracking branch, and report dirty worktrees (untracked files DO enter the build context) | `scripts/substrate/validate-build.ts:184-198`; impl `:220-291` | 8 warnings on this checkout: activity-api 3 AHEAD, development-vessel 2 AHEAD, goal-host-vessel 6 AHEAD, obsidian-vessel 2 AHEAD, local-tools-vessel 1 BEHIND, concept-db 2 BEHIND, metric-collector-vessel 1 BEHIND, light-dispatch-vessel diverged (1 ahead, 5 behind) | verified-live |
| 6 | Those repro findings fail the build ONLY under `--strict-repro`, which `validate-build.ts:198` says "release and CI builds should set" | `scripts/substrate/validate-build.ts:196-200`; impl `:199-200` | NO caller passes it. `rg strict-repro` over the whole repo returns only `validate-build.ts` itself; `Makefile:337` is a bare `bun validate-build.ts`; `.github/workflows/build-substrate-image.yml` does not invoke it | known-broken |
| 7 | Automated pointer bump: `.github/workflows/bump-submodules.yml` `git ls-remote`s each submodule's tracked branch every 6h and fast-forwards the gitlink, chained into the nightly build via `workflow_call` | `.github/workflows/bump-submodules.yml:1-19`; impl `:10-19, 53-60` | Pointer staleness on ORIGIN is bounded by cron, not by an operator | verified-in-code |

- **Steps 2–3, 5 evidence.** Ran it (read-only) on the host tree — **not container-dependent, so still standing**:
  `validate-build: 19 containerized vessels checked … 0 error(s), 8 warning(s)`.

**End state.** `make build` proceeds with 0 errors; whatever is checked out is what ships, with drift reported
only as warnings.
**How to verify it actually worked.** Run `bun scripts/substrate/validate-build.ts --strict-repro` by hand before
a release build — nothing else will.

---

### Traps (update)

| Trap | Where | Why invisible | How to detect | Severity |
|---|---|---|---|---|
| The fleet-manifest sidecar guard has permanently frozen `vessels.manifest.json` against git — over a difference that is PURE JSON WHITESPACE | `substrate-pull-sync.sh:362-385` (the `cmp -s` at `:372`, else-branch `:383-385`) | The guard compares BYTES; `jq -S -c` of both is byte-identical. Logged at INFO with no gap, every tick | `diff <(jq -S -c . live) <(jq -S -c . git)` empty alongside a live "was modified locally" line | blocker |
| Every submodule worktree in the container's super-repo clone is dirty, so `git submodule update` skips ALL 18 on EVERY convergence — 56 to 87 commits behind | `substrate-pull-sync.sh:1427-1436` (skip at `:1429-1432`) | The tick logs "refreshing glue layer" and `done — synced=N failed=0`; the lag reads as caution, not as an 18/18 total failure | Per-submodule `git ls-tree HEAD <v>` vs `git -C <v> rev-parse HEAD` + `rev-list --count` | blocker |
| Substrate-authored commits bypass EVERY pre-commit gate — not via `--no-verify` but because `core.hooksPath` is never set in the clones the substrate commits from | `scripts/git-hooks/install.sh:95` vs `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts:1892-1917` | `rg 'no-verify'` finds no call site, so a search for the bypass finds nothing and reads as "the gate applies" | In the committing clone: `git config core.hooksPath; ls .git/hooks/pre-commit` | high |
| `human-surface-vessel.service` is SHADOWED by a real `/etc/systemd/system` file, and `converge_units`' shadow detector is structurally unable to say so | `substrate-pull-sync.sh:203-215` — the SHADOWED warning is nested INSIDE `if ! cmp -s "$uf" "$dst"` | The warning only prints when the repo unit differs from `/usr/lib`; here they are identical, so it fires on CONVERGENCE, not on SHADOWING | `systemctl show <unit> -p FragmentPath` — anything under `/etc/systemd/system` means convergence is inert | high |
| A content-drift heal is filed as "RUNTIME SOURCE TRUNCATED" with a gap summary asserting the file "collapsed to a fraction of its git content" — false for the drift case | `substrate-pull-sync.sh:684-694` (drift branch reuses `$TRUNCATED`, the log wording and the gap id/summary) | The gap text is a fixed string written for the byte-count case; a routine drafter edit yields a `systematic_failure` gap claiming corruption, which then feeds goal generation | Check whether the parenthetical says "(N vs M bytes)" (real) or "content drift (live X != clone Y)" (mislabelled) | medium |
| The reproducibility gate that would catch "the image built here is not the image git describes" can never fail — `--strict-repro` has zero call sites | `validate-build.ts:196-200`; `Makefile:337`; `.github/workflows/build-substrate-image.yml` | `make build` prints drift as ⚠ and exits 0, so the build looks gated | `rg -n 'strict-repro' .` → only the definition; then run it by hand | medium |
| The test gate disables itself under time pressure and converges UNGATED — precisely on the slow ticks where convergence is riskiest | `substrate-pull-sync.sh:914-933` (`GATE_BUDGET_SECONDS=420`) and `:974-981` (`BUN_BIN` empty ⇒ TEST GATE BLIND) | The run still reports `synced=N failed=0`, `Result=success`; "suite passed" and "no suite ran" differ only by a log line | `journalctl … \| grep -E 'TEST GATE SKIPPED\|TEST GATE BLIND\|TEST REGRESSION\|STARVATION BREAK'`; count `.failnames` | medium |
| A `synced=` count and a green unit `Result` say nothing about whether the mirrored code is LOADED | `substrate-pull-sync.sh:1276-1293` and `:1195-1213` | bun holds the module graph it loaded at start; unit active, `/health` 200, `NRestarts=0`, correct file on disk — none observes the running module graph | `systemctl show <v>.service -p MainPID -p ActiveEnterTimestamp` vs `stat -c %y /vessels/<v>/src/index.ts` | medium |
| `federation-pull-sync.sh` still exists and will happily push host source into containers with no test gate, no health gate and no revert path | `scripts/substrate/federation-pull-sync.sh:93-96` | Superseded by `substrate-pull-sync.sh:1-8` but nothing marks it deprecated; it reads as a first-class deploy tool in its own header | `systemctl list-units --all '*federation-pull*'` → nothing; `cat $HOME/.federation-pull-sync.sha` on the host | low |

- **Manifest-freeze detail.** Something re-serialized the file on 2026-08-15; from that moment the guard
  classifies it as an operator/substrate customisation and refuses git forever. A new vessel, a changed workdir,
  or a new `env_from_file` added to the repo manifest will never reach that container, and nothing will say so.
  Refusal count `journalctl -u substrate-pull-sync | grep -c 'was modified locally'` → **501** since 2026-08-21
  12:28:45 (measured pre-rebuild).
- **Submodule-skip detail.** The code comment calls this state "recoverable", which is true only if something
  recovers it — nothing does, and the condition is self-sustaining because the dirt is never cleaned. These trees
  are the reach-oracle enumeration source per the comment at `:1409-1413`, so oracle denominators are computed
  against 2-month-old file sets.
- **Hook-bypass detail.** `docs/HUMAN_SURFACE.md:239-241` admits the hole for the ui/dist gate only. The same
  absence disables the `ALLOWED_TOPLEVEL_DIRS` placement guard, the sops encryption check and the gitleaks
  secrets scan on the autonomous lane. Positive control: the operator's own clone returns
  `/home/avi/documents/work/substrate/scripts/git-hooks`.
- **Shadow detail.** The `/etc` unit and the repo unit differ substantively (`WorkingDirectory=/workspace/git/super-repo/repos/…`
  vs the repo's `/vessels/…`, `HOST=0.0.0.0` vs `127.0.0.1`, plus a 40-line `ExecStartPre` the repo unit lacks).
  `deploy-hub-pull.sh:163-184` deliberately creates the same class for `federation-transport-vessel.service`.
- **Drift-mislabel detail.** This is the same false-gap class the DRIFT-MISLABEL GATE at `:641-652` was added to
  suppress — the gate stopped the deployment-lag false positives but left the wording wrong for the genuine-drift
  ones. Live (pre-rebuild): 12 occurrences, ALL of the drift form, ZERO of the byte form.
- **Test-gate detail.** Half the vessels had no `.failnames` baseline at all, so their next convergence records a
  baseline and gates nothing by design (`:1020-1023`) — 10 `.failnames` for 18 vessels (measured pre-rebuild).
- **Loaded-code detail.** The measured case (goal-host-vessel serving 23-hour-old code) had every signal green.
  Live positive control (pre-rebuild): development-vessel `ActiveEnterTimestamp` 04:55:40 > `index.ts` mtime
  04:55:39 ⇒ loaded.
- **Superseded-script detail.** Its `docker cp` writes leave `/vessels` differing from the clone — which
  pull-sync then reports as "RUNTIME SOURCE TRUNCATED" and reverts on the next tick.

### Contradictions (update)

| Claim A | Claim B | Which is right | Evidence |
|---|---|---|---|
| CLAUDE.md: "The authoritative list is `ALLOWED_TOPLEVEL_DIRS` in `scripts/git-hooks/pre-commit`", enumerating `repos/ docs/ openspec/ scripts/ packages/ validation/ .claude/ .github/ .githooks/` | The array actually contains ten entries — the nine above plus `.well-known` — and the hook's own header comment (`pre-commit:16-19`) also omits `.well-known` | The code. A `.well-known/…` addition commits cleanly despite both prose lists saying it should be rejected | `pre-commit:72-83` lists `.well-known` at `:82`; header `:16-19` and CLAUDE.md's Placement bullet both omit it |
| CLAUDE.md "Placement" names `.githooks/` as a tool directory, and the pre-commit allowlist includes it | No `.githooks/` directory exists in the repository | The filesystem. Both mentions are vestigial — hooks live in `scripts/git-hooks/` wired via `core.hooksPath` | `ls .githooks/` → "No such file or directory"; `ls scripts/git-hooks/` → `install.sh`, `pre-commit`, `README.md`, `vessel-pre-commit` |
| CLAUDE.md "Branch hygiene": run `scripts/git-hooks/install.sh` in every clone | `install.sh` writes an ABSOLUTE `core.hooksPath` into per-clone config (never committed), set in exactly one clone on this box — not in any `repos/<vessel>`, not in any in-container clone | Both are literally consistent, but the convention is unenforceable and unmet: the instruction has no mechanism, and the clone that commits most (the substrate's) is the one where it was never run | `install.sh:95`; host clone returns the absolute path; `git -C repos/{goal-host-vessel,activity-api,development-vessel} config core.hooksPath` all unset; in-container super-repo and `vessels/development-vessel` both unset with no `.git/hooks/pre-commit` |
| `deploy-remote.sh:113`: "Future updates: re-run this script (state survives in the named volumes), or push the image to a registry once for one-line 'docker pull' updates." | `substrate-pull-sync.service:4-10`: "the git remote is the ONLY code channel; no host docker-cp path is load-bearing" — a pushed commit reaches the VM within ~10 minutes with no SSH at all | The running system. The script's closing advice describes the pre-pull-sync world and omits the mechanism that actually delivers updates | Timer `OnUnitActiveSec=10min`, live `LastTriggerUSec` 04:54:28 with a successful mirror+restart of development-vessel at 04:55:39/04:55:40, driven purely by `git fetch origin dev` (measured pre-rebuild) |
| `substrate-pull-sync.sh:1425` — dirty submodule worktrees are skipped because "Lagging is recoverable; discarding is not" | On this deployment 18 of 18 worktrees have lagged continuously across at least ten super-repo advances, reaching 56–87 commits behind, with no recovery mechanism of any kind | The measurement. "Recoverable" is true only in principle; in practice the skip is terminal and unbounded, unlike every other deferral in this script, all of which carry a starvation break | Journal lines naming all 18 paths on every advance from Aug 24 05:34 through Aug 25 00:24; behind-counts development-vessel 56, goal-host-vessel 70, activity-api 87 (measured pre-rebuild) |
| `docs/HUMAN_SURFACE.md:239-241` — the ui/dist gate "cannot cover a commit path that skips hooks — substrate-authored commits included", framed as one hole in one gate | The same absence disables the placement guard, the sops check and the gitleaks secrets scan on that path too | The code. The doc scopes the hole to the bundle gate; the mechanism (unset `core.hooksPath`) removes the entire hook | `pre-commit` is a single hook containing all four checks (`:124-233` placement, `:275-314` sops, `:325-357` gitleaks, `:359-402` ui/dist); in-container clones have no hooksPath and no `.git/hooks/pre-commit` |
| `validate-build.ts:196-198` — reproducibility findings "WARN by default and only fail under `--strict-repro`, which release and CI builds should set" | No release path and no CI workflow passes `--strict-repro`; the Makefile's build target invokes `bun validate-build.ts` bare | The code. The strict mode is unreachable through any documented or automated path | `rg -n 'strict-repro'` matches only `validate-build.ts:197,199`; `Makefile:337` is `bun $(CURDIR)/validate-build.ts`; `.github/workflows/build-substrate-image.yml` does not reference it |
| `substrate-pull-sync.sh:246-248` — the manifest guard exists so that "silently overwriting a fleet's self-chosen membership would be the worse failure" | The live divergence it is protecting is semantically empty (JSON reformatting), so the guard is protecting nothing while blocking every real repo-side fleet change | Both the rationale and the measurement — the rationale is sound, the PREDICATE is wrong. A byte comparison cannot distinguish a membership decision from a re-serialization | `jq -S -c` of live and git manifest byte-identical; the byte-level diff is entirely `"env": {` multi-line vs single-line; 501 refusals logged since 2026-08-21 12:28:45 (measured pre-rebuild) |

### Coverage notes (update)

**Prior reports — checked before deriving.** `BRINGUP_THREE_PATHS.md` (lines 155-200, 933-948) and
`README_INSTRUCTION_AUDIT.md` (95-115) are the two that overlap this family; also grepped
`SEAM_CLOSURE_2026-08-22.md`, `PROCESS_MEANT_VS_ACTUAL.md`, `LOOP_CLOSURE_VALIDATION.md`,
`RECTIFICATION_AND_DEMONSTRATION.md`, `BUILT_BUT_NOT_RESOLVED.md`, `README_FIRST_READER_AUDIT.md` and `LEARNING_*`
for pull-sync/deploy claims.

- **CONFIRMED.** (a) `BRINGUP:948` "pull-sync correctly refuses to force on divergence; a loud failure nobody
  reads is a silent one" — the refusal path is intact (`sh:467-479`), and the same pattern was found one layer
  over, in the manifest guard (501 unread log lines). (b) `BRINGUP:945` masked-AND-running is the dangerous
  conjunction and BOTH mask forms must be matched — now implemented as a detector at `sh:1243-1250` matching
  `masked|masked-runtime`. (c) `BRINGUP:170` the ui-only lane ships both halves of the pull-sync timer pair — the
  pair is live and enabled here. (d) `BRINGUP`'s note that `repos/human-surface-vessel` is a DIRECT tree, not a
  submodule — verified (53 tracked files, absent from `.gitmodules`), which is why the surface converges by
  ff-pull while the 18 real submodules do not.
- **SUPERSEDED.** `README_INSTRUCTION_AUDIT:105`
  `gap-pull-sync-reports-wrong-take-effect-moment-for-in-container-tools` — fixed. `sh:299-306` now branches the
  message per script, and the corrected wording is live in the journal from Aug 23 10:07:11 ("converged vessel-ctl
  (takes effect on the NEXT INVOCATION)"), while Aug 22 lines still show the old blanket text.
- **COULD NOT CHECK.** `BRINGUP:933` (`deploy-hub-pull.sh` not passing `ENABLED_EXTRA_VESSELS`) — needs the hub;
  `BRINGUP`'s `ui-only-up.sh` line anchors — out of family scope.

**What was not covered, and why.**

1. `deploy-hub.sh` (the 20-30 min clone+build hub path) — named in the family's sibling set but not in the source
   list, and it duplicates `deploy-hub-pull.sh`'s remote half. Unread except where `deploy-hub-pull.sh` cites it.
2. Everything remote is `unverifiable-here`: no hub shell, no second machine, no SSH key. All
   `deploy-remote.sh` / `deploy-hub-pull.sh` steps are `verified-in-code` or `unverifiable-here`, never
   `verified-live`. No remote call was attempted.
3. `entrypoint.sh`, `gen-env.sh` (66k lines of allowlist), `apply-inventory.sh`, `render-unit.sh`,
   `vessel-ctl.sh`, `setup-git-push.sh` — only the seams pull-sync converges were read (the five-pair list at
   `sh:278-283`) plus `setup-git-push.sh`'s identity/credential-helper lines (`:48`, `:87-93`), enough to
   establish that the substrate's git identity is "Substrate Autonomous" and that the FOREIGN-author test at
   `sh:444-452` compares against a real value. Their internals are the bootstrap family, not this one.
4. `vessel-pre-commit` (253 lines) — only its bypass/hooksPath lines read. Since it is installed in zero vessel
   clones on this box, its content is moot until `install.sh --vessel` is run.
5. `.gitleaks.toml` rule content — not read; only whether gitleaks is invoked and what happens when it is absent.
6. The pre-commit hook was NOT run (that would require staging files, i.e. a write). Its behaviour is
   `verified-in-code` plus the live facts it depends on (`ui/dist` tracked, the referenced asset hashes present on
   disk, human-surface-vessel not a submodule).
7. No goal was dispatched, no unit restarted, no file written. Every `docker exec` was
   `cat`/`ls`/`jq`/`diff`/`cmp`/`stat`/git-read/`systemctl show|cat|is-*|list-*`/`journalctl`. The one command
   that wrote anything wrote `/tmp/a.json` and `/tmp/b.json` inside the container for a jq comparison; judged
   within "read-only" since it touches no substrate state, and named rather than hidden.
8. **Negative-result discipline.** The "0 SHADOWED warnings" and "0 units: converged" results are NOT evidence
   that unit convergence works — the positive control was run (cmp of all ~120 repo unit files against
   `/usr/lib` → differing=0), which is why the silence is explained rather than merely observed. Conversely the
   absence of masked-skip / quiesce / unhealthy-revert log lines was NOT treated as evidence those paths work;
   they are marked `verified-in-code`.
9. The operator memory note "shell grep is broken here — use rg" did not reproduce: `echo test-grep | grep -c test`
   returned 1, rc=0, on both host and container. grep was used freely after that control, and the note is flagged
   as stale for this environment.
10. **Timebase.** The container clock read 2026-08-25 while the host session date was 2026-08-24. All journal
    timestamps quoted are container time. This affects no finding but would affect anyone correlating against
    host-side logs.


---

## 9. Family 7 — Agent development workflow (cockpit, hooks, skills, openspec)

8 processes, 58 steps. The container `substrate-live` was **destroyed mid-audit and has since been
rebuilt** (created 2026-08-24 22:35 PDT, currently healthy). Every `verified-live` observation below was measured
against the *previous* container instance; steps whose evidence depended on that instance answering a request carry
`(measured pre-rebuild)` in their outcome cell. Statuses are the original auditor's, uncorrected.

### F7-P1 — The canonical cockpit loop (ACT → TRACK → REASON → FEEDBACK)

**Purpose.** Drive all substrate work through the metabob-mcp cockpit so every change produces a trace that feeds Thompson/ribosome learning, rather than being hand-executed.
**Trigger.** An agent (Claude Code) has any non-trivial task in this repo. CLAUDE.md:80-96 makes this the default path for everything.
**Preconditions.** `.mcp.json` present and `metabob` listed in settings.local.json `enabledMcpjsonServers` (both true: .mcp.json:3, .claude/settings.local.json:80-82); `METABOB_CONFIG_PATH` points at <repo>/.metabob/config.json (.mcp.json:8) — NOT ~/.metabob; both files currently carry an identical apiKey and endpoint http://localhost:18080 (md5 of both keys identical); activity-api reachable at metabob.endpoint (trace store + hydration); discovery reachable so `goal_execution` and `feature_compose` producers resolve.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `concept_search the goal's keywords — warm-start on prior knowledge` | .claude/skills/metabob-substrate/SKILL.md:64; impl /home/avi/documents/work/metabob-mcp/src/tools/concept-search.ts | Prior concepts returned; step is advisory, nothing enforces it. | documented-only |
| 2 | `mcp__metabob__run_goal_async({ goal }) → keep the dispatchId` | CLAUDE.md:88, SKILL.md:39, SKILL.md:65; impl metabob-mcp/src/tools/run-goal-async.ts:114-133 — resolves base URL via resolveServiceEndpointByShape(shape:'goal_execution'), POSTs flat body {goal, operator, variables,…} to `${baseUrl}/run-goal` | goal-host returns 202 {dispatchId, status:'running'}. NOT dispatched during this audit (read-only constraint). | verified-in-code |
| 3 | `(implicit, undocumented) goal-host coalesces an identical in-flight goal instead of dispatching a second walk` | not stated in CLAUDE.md or the metabob-substrate skill; impl repos/goal-host-vessel/src/index.ts:14232-14240 | Returns the EXISTING dispatchId with `coalesced:true`. A caller that believes it started a fresh run is polling someone else's. | verified-in-code |
| 4 | `Every dispatch carries an operator:<id> tag into the trace` | CLAUDE.md:120, SKILL.md:102-103; impl metabob-mcp/src/operator-id.ts:11 `return process.env.MB_OPERATOR_ID \|\| 'claude-code-operator'`; run-goal-async.ts:107 `const body = { operator: operatorId() }` | body.operator = 'claude-code-operator' unless MB_OPERATOR_ID overrides. This is attribution, not origin. | verified-in-code |
| 5 | `` Poll mcp__metabob__goal_status({dispatch_id}) until it settles; read `reached`, not `status` `` | CLAUDE.md:89 + :106-110, SKILL.md:66, SKILL.md:74-76; impl metabob-mcp/src/tools/goal-status.ts:166 GET `${goalHostBase}/executions/:dispatchId`; then :203-205 hydrates via activity-api `/v2/activities/execution-traces/:executionId` (goal-status.ts:83) | Two-hop: the dispatch record comes from goal-host's store, the reach verdict/shapes/posterior come from activity-api. If activity-api is down the hydration half silently vanishes and you get an unhydrated record with no reach verdict. | verified-in-code |
| 6 | `mcp__metabob__goal_reasoning({dispatch_id}) — the walk decision log` | CLAUDE.md:90, SKILL.md:46, SKILL.md:67; impl metabob-mcp/src/tools/goal-reasoning.ts:205 GET `${goalHost}/executions/:dispatchId`, then :116 GET activity-api `/v2/activities/execution-traces/:executionId` | Same two-hop dependency as goal_status; also depends on goal-host's dispatch record surviving. | verified-in-code |
| 7 | `mcp__metabob__provide_feedback({dispatch_id, verdict, rationale, confidence})` | CLAUDE.md:91, SKILL.md:52, SKILL.md:68; impl metabob-mcp/src/tools/provide-feedback.ts:109-133 — needs BOTH goal-host (dispatch record) and activity-api (writes the verification label); :143-146 refuses when goal / executionId / selectedTemplateId are missing | Writes an oracle-corpus label. Fails with an explanatory string (not an exception) when the dispatch record has been evicted. NOT exercised live — it is a write. | verified-in-code |
| 8 | `Read the actual diff/output when stakes are high — a change can typecheck and pass the reach gate yet not do what was asked` | CLAUDE.md:107-110, SKILL.md:78-82; impl no implementation — an instruction to the agent | Purely advisory. | documented-only |
| 9 | `On a hollow completion / mis-route / novel failure mode: concept_create or substrateGap_write` | SKILL.md:69-70, SKILL.md:129-133; impl metabob-mcp/src/tools/concept-create.ts; resolve_impulse → substrateGap_write | Gap filed / concept minted. Not exercised (writes). | documented-only |

- **Step 1 evidence.** Read the skill; did not probe concept_search (concept-db went down mid-audit).
- **Step 2 evidence.** run-goal-async.ts:105 'goal-host /run-goal accepts the flat body'; :123 `const url =
  ${baseUrl}/run-goal`. Live corroboration from a real prior dispatch in ~/.claude/substrate-session-end.log:
  'Mon Aug 24 05:23:24 dispatched: {"dispatchId":"576b35a2-599d-4812-be32-72ac1150eae4","status":"running"}'.
- **Step 3 evidence.** index.ts:14236-14237 `console.log('[run-goal] coalesced duplicate in-flight goal -> ' +
  rec.dispatchId)`; observed live in ~/.claude/substrate-session-end.log: 'Sun Aug 23 01:43:53 dispatched:
  {"dispatchId":"ff666fcd-…","status":"running","coalesced":true}'.
- **Step 4 evidence.** operator-id.ts:11; run-goal-async.ts:107.
- **Step 5 evidence.** goal-status.ts:166, :83, :203-205. My live call returned 'goal_status could not find
  goal-host-vessel via discovery' — but that landed inside the fleet teardown window (see coverage_notes), so
  I do NOT report it as a config defect.
- **Step 6 evidence.** goal-reasoning.ts:15 docblock '1. goal-host GET /executions/:dispatchId'; :116, :205.
- **Step 7 evidence.** provide-feedback.ts:121-128 returns 'dispatch <id> not found (records are in-memory and
  capped ~100)' on 404; :143-149 lists the missing fields.

**End state.** A dispatch exists with a `reached` verdict, its walk reasoning is readable, and an operator verdict is in the oracle corpus.
**How to verify it actually worked.** Not exit code and not `status`: read `reached` from goal_status's hydrated view, then read the produced shapes / the landed diff. CLAUDE.md:106 — '`reached`, not `status`'.

---

### F7-P2 — Code change as a goal: edit-intent → feature_compose → traced commit

**Purpose.** Land a code change through the substrate so it produces a trace, rather than hand-editing vessel source.
**Trigger.** A goal whose lead sentence names a real repos/<vessel>/… file (CLAUDE.md:102-105).
**Preconditions.** ROUTE_EDIT_INTENT_TO_COMPOSE != "0" in goal-host's environment (the kill switch); development-vessel advertising `feature_compose` in discovery; the compose lane not saturated (single-occupancy; directed dispatches get a reserved slot).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `Dispatch a goal whose lead sentence names one real repos/<vessel>/src/… file and describes the change in prose` | CLAUDE.md:102-105; .claude/skills/metabob-substrate/SKILL.md:89-93; impl repos/goal-host-vessel/src/index.ts:11192 `goalForRouting.match(/repos\/([\w.-]+)\/[\w.\/-]+\.\w+/)` | The regex matches ANY repos/<vessel>/<path>.<ext>, not only `src/`. So package.json, docs inside a vessel repo, etc. also route to the editor. The doc's `/src/…` phrasing is narrower than the code. | doc-code-mismatch |
| 2 | `EARLY edit-intent check runs BEFORE the walk: file match AND (edit verb OR file-path-only)` | index.ts:11189-11191 comment 'EARLY edit-intent check … skip the walk entirely'; impl index.ts:11191 (flag), :11192 (file), :11201 (edit verbs), :11206 (read-only verbs), :11211 (interrogative), :11215 (fires) | Read-only goals over a named file are explicitly excluded. The comment at index.ts:11193-11200 records that two substrate-authored 'compose-report' cutovers POLLUTED this verb list with READ verbs, causing a read goal ('report the value of the version field in repos/activity-api/package.json') to EDIT and commit an unrequested version bump. | verified-in-code |
| 3 | `Enumerate every named repos path and union the vessels` | index.ts:11218-11222 comment; impl index.ts:11223 `earlyAllFiles = Array.from(new Set(goalForRouting.match(/repos\/…/g) ?? [earlyEditFile]))`; :11224 `earlyAllVessels` | Multi-file goals are enumerated, not truncated to the first path. This directly contradicts the 'one file per goal, multi-file asks drop parts silently' rule still printed in five places. | doc-code-mismatch |
| 4 | `Build the compose spec, branching on file count` | index.ts:11230-11238; impl index.ts:11232-11234 multi-file wording ('apply ops ONLY on these exact paths … EVERY named file needs its full required change'); :11235 single-file wording | Spec string names all target paths; a verbatim excerpt block is appended (index.ts:11238 `verbatimExcerptBlock`). | verified-in-code |
| 5 | `` Carry a line reference (`file:123` or 'line 123') into edit_site `` | index.ts:11226-11229 comment; impl index.ts:11227-11228 | Without it dev-vessel's near-edit-site grounding excerpts top-of-file instead of the intended region. | verified-in-code |
| 6 | `Resolve the feature_compose producer through discovery (env fallback if discovery is unreachable)` | index.ts:11242-11254; impl index.ts:11242 POST `${DISCOVERY_ENDPOINT}/resolve` {pointer:{type:'vesselCapability',shape:'feature_compose'}}; falls back to DEV_VESSEL_ENDPOINT | Live probe (before teardown) returned exactly one producer: {vesselId:'development-vessel-local', endpoint:'http://localhost:8090'}. (measured pre-rebuild) | verified-live |
| 7 | `POST the feature_compose impulse with directed / spec / verify_vessels / land:true / gap` | index.ts:11256-11285; impl index.ts:11273 `directed: opts.operatorOrigin === true`; :11275 `verify_vessels: earlyAllVessels.map(v => 'repos/' + v)`; :11276 `land: true` | `directed` reserves a compose slot for operator work so a busy boredom stream cannot refuse every operator dispatch (comment index.ts:11263-11272 records the measured 'compose capacity cap reached (2 in flight)'). | verified-in-code |
| 8 | `feature_compose decomposes the spec into ops and applies them (fs_write/fs_edit) across files` | repos/development-vessel/src/resolvers/feature-compose.ts:18 docblock 'decompose(spec) -> [ops] -> apply each -> verify'; impl feature-compose.ts:9 and :2978 'Compose the existing surgical atoms into a multi-file, multi-vessel change'; :2704 `const targetFiles = Array.from(new Set(…))` | CONSUMER-LAYER CONFIRMATION that multi-file works: targetFiles is a plural Set derived from the spec's repos/ paths, and ops are iterated. The residual drop is narrower: an `edit` op whose path is NOT in targetFiles and which does not wire a newly-created symbol is DROPPED (feature-compose.ts:3323-3327), and a plan that is ENTIRELY off-target is REFUSED (:3330). | verified-in-code |
| 9 | `Refuse an ungrounded decompose when no real path is derivable` | feature-compose.ts:2752-2753; impl feature-compose.ts:2752 'ungrounded decompose refused before the planning call: verify_vessels is empty and no repos/<vessel>/<file> target was derivable' | Fails closed rather than letting the planner emit a schema placeholder path. | verified-in-code |
| 10 | `Typecheck-verify, then cut over: commit and push` | CLAUDE.md:104-105 'drafts, typecheck-verifies, and lands a traced commit'; impl feature-compose.ts:18 docblock '-> verify'; cutover at :68 | Not exercised — running it is a dispatch. | unverifiable-here |
| 11 | `Kill switch: ROUTE_EDIT_INTENT_TO_COMPOSE=0 halts autonomous edit landing` | not in CLAUDE.md; operator memory 'KILL SWITCH' entry; impl three independent guards: index.ts:11191 (early), :11645 (late 0-step detector), :11706 (edit-intent routing block); default is ON — the check is `!== "0"` | Any value other than the literal string "0" leaves the path ENABLED, including empty string. scripts/substrate/gen-env.sh:578 renders `ROUTE_EDIT_INTENT_TO_COMPOSE="${…:-}"` i.e. empty by default → enabled. | verified-in-code |

- **Step 1 evidence.** index.ts:11192 has no `src` segment in the pattern; CLAUDE.md:103 says
  `repos/<vessel>/src/…`.
- **Step 2 evidence.** index.ts:11193-11200, verbatim comment naming the 1.20.9→1.20.10 self-corruption.
- **Step 3 evidence.** index.ts:11218-11221 comment: 'the single-path spec told feature_compose "this EXACT
  path only" and silently dropped the rest (gap spliceability-goal-host-index-edit-intent-region documents the
  coax trail)' — i.e. that WAS the defect and it was fixed.
- **Step 6 evidence (expired — measured pre-rebuild).** curl -X POST localhost:18100/resolve -d
  '{"pointer":{"type":"vesselCapability","shape":"feature_compose"}}' →
  {"vesselId":"development-vessel-local","endpoint":"http://localhost:8090"}
- **Step 8 evidence.** feature-compose.ts:3308-3309 `onTargetPath`; :3323-3327 `isOffTargetEdit`; :3330 the
  all-off-target REFUSE; :3353-3364 the verify_vessels scope gate.
- **Step 10 evidence.** Read-only constraint forbids dispatch; no compose ran during this audit.
- **Step 11 evidence.** gen-env.sh:578; index.ts:11191/11645/11706 all use `!== "0"`.

**End state.** A commit authored by the substrate, typecheck-verified, landed on the vessel's dev branch, with a trace.
**How to verify it actually worked.** Read the landed diff — not `reached`. CLAUDE.md:107-110 and SKILL.md:92-93 both say the change can typecheck and pass the reach gate yet not do what was asked.

---

### F7-P3 — The PreToolUse vessel-source edit gate

**Purpose.** Make 'dispatch, don't edit' the default by denying direct Write/Edit/MultiEdit on vessel runtime source, and give the substrate a chance to refuse an operator intervention (S3 push-away).
**Trigger.** Any Write/Edit/MultiEdit tool call in this project (matcher at .claude/settings.json:42).
**Preconditions.** The hook is WIRED: .claude/settings.json:40-50 registers .claude/hooks/substrate-vessel-edit-gate.sh under PreToolUse with matcher "Write|Edit|MultiEdit"; the script is executable (-rwxr-xr-x, verified by ls); jq and curl on PATH (both present: /usr/bin/jq, /usr/bin/curl).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `Read hook JSON from stdin, extract .tool_input.file_path; exit 0 (allow) if empty` | CLAUDE.md:111-114; impl .claude/hooks/substrate-vessel-edit-gate.sh:13-15 | A tool call with no file_path is allowed. Note the matcher does NOT include NotebookEdit, so that tool bypasses the gate entirely. | verified-in-code |
| 2 | `Allow unless the path matches /repos/<something>/src/` | CLAUDE.md:113-114 'Edits to docs/, scripts/, openspec/, .claude/, tests, and config are never gated'; impl edit-gate.sh:18 `printf '%s' "$fp" \| grep -Eq '/repos/[^/]+/src/' \|\| exit 0` | Verified live in both directions. TWO holes: (a) the pattern requires a LEADING slash, so a relative path `repos/x/src/a.ts` is NOT matched and passes ungated; (b) `packages/*/src/**` is ungated although three vessels consume it as a `file:` dependency, and goal-host's edit-intent regex only matches `repos/…`, so a packages/ change cannot even be dispatched through the intended path. | verified-live |
| 3 | `Never gate test files` | edit-gate.sh:19 comment; impl edit-gate.sh:20 `grep -Eq '/(test\|tests\|__tests__\|__mocks__)/' && exit 0` | Any path containing those directory segments is allowed. | verified-live |
| 4 | `Escape hatch: SUBSTRATE_ALLOW_DIRECT_EDIT=1 → exit 0` | CLAUDE.md:112-113 'A conscious one-off bypass sets SUBSTRATE_ALLOW_DIRECT_EDIT=1'; impl edit-gate.sh:22 `[ "${SUBSTRATE_ALLOW_DIRECT_EDIT:-0}" = "1" ] && exit 0` | CURRENTLY SET TO "1" AND ACTIVE IN THE LIVE SESSION. .claude/settings.local.json:2-4 declares `"env": {"SUBSTRATE_ALLOW_DIRECT_EDIT": "1"}`, and the variable is present in the running session environment. The gate is a no-op for every edit in this checkout, and the bypass short-circuits BEFORE the intervention_evaluate call at line 43 — so the S3 push-away channel is silenced too and `interventionRefused` cannot accrue. settings.local.json is gitignored (/home/avi/.config/git/ignore:1), so this is invisible to anyone reviewing the repo. | verified-live |
| 5 | `Fail open if goal-host is unreachable — you cannot route through a dead substrate` | CLAUDE.md:112 '(fails open when the substrate is unreachable)'; edit-gate.sh:23 comment; impl edit-gate.sh:24 `curl -s --max-time 2 "${GOAL_HOST_ENDPOINT:-http://localhost:18210}/health" >/dev/null 2>&1 \|\| exit 0` | Confirmed live: with GOAL_HOST_ENDPOINT=http://localhost:9 and flag=0, the hook emits nothing and exits 0 → ALLOW. | verified-live |
| 6 | `S3 push-away: ask development-vessel's intervention_evaluate whether to REFUSE this operator edit` | edit-gate.sh:26-33 comment (IAL §27.S.6); impl edit-gate.sh:34-43 — builds {impulse:{pointer:{type:'intervention_evaluate', proposed_change:{target_path, diff_summary, source:'operator', intent}, cited_evidence:[], strictness}}}, POSTs to ${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve with a 9s budget; strictness from SUBSTRATE_INTERVENTION_STRICTNESS (default 'balanced') | The shape is live and served. Direct probe returned verdict ACCEPT with reason 'no policy gate triggered; default ACCEPT'. So the channel is wired and functional but currently accepts by default — the push-away path exists and does not fire on a normal edit. (measured pre-rebuild) | verified-live |
| 7 | `If verdict==REFUSE, deny with the substrate's own cited basis` | edit-gate.sh:44-48; impl edit-gate.sh:44 `jq -r '.body.verdict'` = REFUSE → emits permissionDecision:deny with .body.refusal_basis | Not observed — the live verdict was ACCEPT. Note the guard is a plain string compare, so any dev-vessel hiccup (timeout, non-JSON, empty) yields a non-REFUSE and falls through (fail-open by construction). | verified-in-code |
| 8 | `Otherwise emit the generic route-through-substrate denial as JSON on stdout` | edit-gate.sh:51-53; impl edit-gate.sh:53 `jq -nc … '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'`; exit 0 | Verified live. NOTE the denial message itself repeats the stale rule: 'Name ONE file per goal — multi-file asks drop parts silently' (edit-gate.sh:51), which goal-host and feature_compose have both outgrown. Denial is signalled by JSON on stdout, never by exit code — the script always exits 0. (measured pre-rebuild) | verified-live |

- **Step 1 evidence.** settings.json:42 matcher is exactly "Write|Edit|MultiEdit".
- **Step 2 evidence.** Positive: `/x/repos/activity-api/src/a.ts` → grep exit 0. Negative control:
  `/x/docs/a.md` → exit 1. Relative: `repos/activity-api/src/a.ts` → exit 1 (NOT matched). packages:
  `/x/packages/shared/src/a.ts` → exit 1. `rg -l '"file:\.\./\.\./packages' repos/*/package.json` →
  identity-vessel, terminal, react-renderer.
- **Step 3 evidence.** `/x/repos/a/src/__tests__/b.ts` → grep exit 0 (allow).
- **Step 4 evidence.** `echo $SUBSTRATE_ALLOW_DIRECT_EDIT` in the session → `1`. Piping a real
  repos/activity-api/src/index.ts edit payload with flag=1 → empty stdout (ALLOW); with flag=0 → the full deny
  JSON. `git check-ignore -v .claude/settings.local.json` →
  `/home/avi/.config/git/ignore:1:**/.claude/settings.local.json`.
- **Step 5 evidence.** `printf '{"tool_input":{"file_path":".../repos/activity-api/src/index.ts"}}' |
  SUBSTRATE_ALLOW_DIRECT_EDIT=0 GOAL_HOST_ENDPOINT=http://localhost:9 bash
  .claude/hooks/substrate-vessel-edit-gate.sh` → empty stdout, exit 0.
- **Step 6 evidence (expired — measured pre-rebuild).** curl POST localhost:18090/v2/impulses/resolve
  intervention_evaluate → {"success":true,"verdict":"ACCEPT","basis":"no policy gate triggered; default
  ACCEPT"}; registry_query shapes 'intervention' → intervention_evaluate, interventionRefused,
  interventionRefused_write all advertised.
- **Step 8 evidence (expired — measured pre-rebuild).** With flag=0 the hook printed the full deny JSON
  verbatim; `echo $?` → 0.

**End state.** Either the edit is denied with routing instructions, or it is allowed (bypass flag, non-vessel path, test path, or dead goal-host).
**How to verify it actually worked.** Pipe a synthetic hook payload naming a repos/<v>/src file into the script and read STDOUT, not the exit code. Run it twice — once with SUBSTRATE_ALLOW_DIRECT_EDIT=0 and once with =1 — because a gate that passed and a gate that was switched off look identical.

---

### F7-P4 — SessionStart: substrate memory injection

**Purpose.** Make the substrate's memoryNote store (not the operator's file cache) the authoritative memory an agent starts from.
**Trigger.** SessionStart. WIRED at .claude/settings.json:9-18.
**Preconditions.** development-vessel reachable at DEV_VESSEL_ENDPOINT (default http://localhost:18090); jq and curl on PATH; for the second half only: a readable ~/.metabob/config.json apiKey and a reachable discovery gateway.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `POST {"impulse":{"type":"memoryNote","limit":500}} to ${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve, 4s timeout` | docs/MEMORY_AS_SUBSTRATE.md:84; CLAUDE.md:189-192; impl .claude/hooks/substrate-session-start.sh:13-15 | Live run returned 148 notes. (measured pre-rebuild) | verified-live |
| 2 | `Bail silently unless .success and (.body.notes\|length)>0` | session-start.sh:7-8 comment; impl session-start.sh:16-17 | Fail-open confirmed live: with DEV_VESSEL_ENDPOINT=http://localhost:9 the hook printed nothing and exited 0. | verified-live |
| 3 | `Partition notes: type=="feedback" into a 'read these' block, everything else into 'recent findings', truncated to top 35 by updated_at` | MEMORY_AS_SUBSTRATE.md:84; impl session-start.sh:19-31 (jq: $fb / $rest, `$rest[0:35]`, body truncated to 420 chars) | Live run injected 2 feedback notes and 35 of 146 others. The store holds 148 notes typed {reference:128, project:15, finding:3, feedback:2} — so 111 notes are never surfaced at session start, and only 2 get the full 420-char treatment. (measured pre-rebuild) | verified-live |
| 4 | `` Fetch concept priors: POST {"pointer":{"type":"concept_select_for_prompt"}} to ${DISCOVERY_ENDPOINT:-http://localhost:18100}/resolve with `Authorization: ApiKey <key>` read from $HOME/.metabob/config.json `` | docs/MEMORY_AS_SUBSTRATE.md:84 '…alongside concept priors fetched through the discovery gateway'; impl session-start.sh:38-43; key at :39 `jq -r '.metabob.apiKey // .apiKey // empty' "$HOME/.metabob/config.json"` | NOTE the path asymmetry: this hook reads $HOME/.metabob/config.json while the MCP cockpit is pinned to <repo>/.metabob/config.json (.mcp.json:8). Today both files carry byte-identical apiKeys and the same endpoint, so nothing breaks — but repointing one does not repoint the other. | verified-in-code |
| 5 | `Append a '## Concept priors (conceptPromptPriors …)' block with the top 15 selected concepts` | MEMORY_AS_SUBSTRATE.md:84; impl session-start.sh:44-54 | NOT CONFIRMED. My check for the literal string 'Concept priors' in the hook's output returned 0 matches — but that run landed inside the fleet teardown window (discovery had already gone to 000), so absence here measures the outage, not the hook. Unresolved. | unverifiable-here |
| 6 | `Emit {hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:<ctx>}}; exit 0` | session-start.sh:57; impl session-start.sh:57 | Well-formed JSON emitted. (measured pre-rebuild) | verified-live |

- **Step 1 evidence (expired — measured pre-rebuild).** Ran the hook: '# Substrate memory (authoritative — 148
  notes, queried from development-vessel at session start)'.
- **Step 2 evidence.** `DEV_VESSEL_ENDPOINT=http://localhost:9 bash .claude/hooks/substrate-session-start.sh`
  → empty output, exit 0.
- **Step 3 evidence (expired — measured pre-rebuild).** Store query:
  {"total":148,"by_type":{"feedback":2,"finding":3,"project":15,"reference":128}}. Hook output header: '##
  Feedback / conventions (2)'.
- **Step 4 evidence.** md5 of `.metabob.apiKey` identical in both files (09945aa2cc2d35f97114974bfe1c3cd9);
  both endpoints http://localhost:18080. .metabob/config.json.hub-backup still holds http://syzygy.host:18080.
- **Step 5 evidence.** `jq -r '.hookSpecificOutput.additionalContext' <hookout> | rg -c 'Concept priors'` → 0,
  at ~05:05 UTC; two minutes later every fleet port read 000 and the container was gone.
- **Step 6 evidence (expired — measured pre-rebuild).** Hook stdout parsed cleanly with jq.

**End state.** Session context carries the substrate's memory (and, when the gateway answers, its concept priors).
**How to verify it actually worked.** Run the hook by hand and jq the additionalContext for BOTH the '# Substrate memory' header and a '## Concept priors' section. Confirming only the first half leaves the documented second half unverified.

---

### F7-P5 — PostToolUse memoryNote mirror (operator file → substrate)

**Purpose.** Make the substrate's copy authoritative regardless of the operator writing a memory file, so the file cache stays derived (law 10).
**Trigger.** PostToolUse on Write|Edit|MultiEdit. WIRED at .claude/settings.json:29-39.
**Preconditions.** the edited path is under $HOME/.claude/projects/<slug>/memory/ and ends .md; it is not MEMORY.md; `bun` must be on the hook's PATH — this is the precondition that currently fails.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `Derive the memory dir: MEM_SLUG = $CLAUDE_PROJECT_DIR with every '/' → '-'` | docs/MEMORY_AS_SUBSTRATE.md:88-90 'follows the checkout rather than being pinned to one machine's layout'; impl .claude/hooks/substrate-memory-mirror.sh:14-18 | MEM_DIR = /home/avi/.claude/projects/-home-avi-documents-work-substrate/memory — exists, 552 top-level .md files plus an archive/ of 81. | verified-live |
| 2 | `Extract .tool_input.file_path; exit 0 unless it is $MEM_DIR/*.md and not */MEMORY.md and the file exists` | MEMORY_AS_SUBSTRATE.md:85; impl memory-mirror.sh:22-34 | Filters correctly. | verified-in-code |
| 3 | `DEV_VESSEL_ENDPOINT=… bun scripts/substrate/mirror-memory-note.ts "$fp" >>LOG 2>&1` | MEMORY_AS_SUBSTRATE.md:85, :130-148; impl memory-mirror.sh:36-37 | BROKEN IN PRACTICE. `bun` is not on the hook's PATH — the log records `substrate-memory-mirror.sh: line 36: bun: command not found` 66 times, including every invocation on 2026-08-25 (01:21, 02:24, 02:37, 03:01, 03:23, 03:54). bun DOES exist at /home/avi/.bun/bin/bun and IS on the login-shell PATH, so this is a hook-environment PATH defect, not a missing dependency. The `\|\| echo 'mirror failed'` on the same line swallows it and the hook exits 0, so nothing surfaces. | known-broken |
| 4 | `mirror-memory-note.ts parses frontmatter, types the note, POSTs memoryNote_write` | MEMORY_AS_SUBSTRATE.md:57-68, :137-141; impl scripts/substrate/mirror-memory-note.ts:22-34 (flat frontmatter parse), :36-41 typeFromFilename, :67-79 note record, :82-86 POST | Typing works — but by accident of the flat parser, not by the documented filename rule. The doc (MEMORY_AS_SUBSTRATE.md:137-139) and typeFromFilename both key on UNDERSCORE prefixes (`feedback_*`), and there are ZERO underscore-prefixed files (65 use `feedback-` with a hyphen). What actually types them is `type:` nested under `metadata:` in the frontmatter, which the parser flattens because it splits every line on the first colon. Remove that frontmatter key and all 65 feedback notes silently become `finding`. (measured pre-rebuild) | verified-live |
| 5 | `` Upsert by id `operator-import:<stem>`, provenance ['harness-mirror'], confidence by type `` | mirror-memory-note.ts:8-10 docblock; impl mirror-memory-note.ts:69, :76-77 | Only 9 notes in the whole store carry harness-mirror provenance; 138 carry null and 1 carries the literal unrendered template string "{{goal.id}}". Last successful mirror was the Aug 20 batch. 552 cache files vs 148 stored notes — the cache is NOT a derived view of the store, it is ~4x larger. (measured pre-rebuild) | verified-live |
| 6 | `Fail open: log and exit 0` | memory-mirror.sh:7-8; mirror-memory-note.ts:11-12; impl memory-mirror.sh:37 `\|\| echo "$(date -u) mirror failed for $fp" >>"$LOG"`; exit 0 at :38 | Confirmed — the tool result is never blocked, which is exactly why the 66 failures went unnoticed. | verified-live |
| 7 | `` Bulk reconcile with `bun run scripts/substrate/import-operator-memory.ts` when the cache has drifted `` | docs/MEMORY_AS_SUBSTRATE.md:128-148; impl scripts/substrate/import-operator-memory.ts (exists, 6980 bytes) | Present but nothing invokes it automatically; the 552-vs-148 delta is what running it would close. Not run (it writes). | documented-only |

- **Step 1 evidence.** `find $MEM -maxdepth 1 -name '*.md' ! -name MEMORY.md | wc -l` → 552.
- **Step 3 evidence.** `tail ~/.claude/substrate-memory-mirror.log` → repeated 'line 36: bun: command not
  found' with Aug 25 timestamps; `bash -lc 'command -v bun'` → /home/avi/.bun/bin/bun; plain non-login shell →
  MISSING. `rg -c 'bun: command not found'` → 66.
- **Step 4 evidence (expired — measured pre-rebuild).** `ls $MEM | rg -c '^feedback_'` → 0; `^feedback-` → 65.
  Frontmatter of feedback-verify-at-the-consuming-layer-seven-instances.md lines 1-8 show `metadata:` / `
  type: feedback`. Store: that note is typed feedback with provenance ["harness-mirror"].
- **Step 5 evidence (expired — measured pre-rebuild).** Store group-by:
  {"[\"harness-mirror\"]":9,"[\"{{goal.id}}\"]":1,"null":138}. `rg -n ': (created|updated)'
  ~/.claude/substrate-memory-mirror.log | tail -1` → line 1701, the Aug 20 reference-a-restart-loop note.
- **Step 6 evidence.** Log lines pair 'mirror failed for <path>' with the bun error; the session continued
  regardless.

**End state.** Intended: every operator memory file has an authoritative substrate twin. Actual: the store is frozen at the Aug 20 mirror plus whatever else wrote it directly.
**How to verify it actually worked.** Do NOT read the hook's own log for success — it reports 'mirror failed' identically for a dead substrate and a missing binary. Query the consumer: resolve memoryNote and count notes whose provenance_trace_ids contains 'harness-mirror', then compare against the file count in the memory dir.

---

### F7-P6 — SessionEnd: memory consolidation dispatch

**Purpose.** Push the session's learnings into the loop by dispatching a consolidation goal rather than leaving them in operator files.
**Trigger.** SessionEnd. WIRED at .claude/settings.json:19-28.
**Preconditions.** goal-host reachable at ${GOAL_HOST_ENDPOINT:-http://localhost:18210}/health; an apiKey readable from METABOB_API_KEY or $HOME/.metabob/config.json.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `Read KEY from ${METABOB_API_KEY:-jq .metabob.apiKey $HOME/.metabob/config.json}` | docs/MEMORY_AS_SUBSTRATE.md:86; impl .claude/hooks/substrate-session-end.sh:10 | Same $HOME-vs-repo config asymmetry as P4 step 4. Currently harmless (identical keys). | verified-in-code |
| 2 | `curl -s --max-time 2 $GH/health; on failure log 'skip: goal-host unreachable' and exit 0` | session-end.sh:12 comment 'Fail open: substrate down => skip'; impl session-end.sh:13-16 | Fail-open by construction. | verified-in-code |
| 3 | `setsid a detached curl POST $GH/run-goal with the fixed consolidation goal text, 90s cap` | session-end.sh:18-27; impl session-end.sh:21-27; goal string at :18 | Runs detached so teardown is not delayed. The goal text is a hardcoded constant in the hook — a behavioral instruction living in a shell script rather than a shaped impulse, which is the law-1 antipattern. | verified-in-code |
| 4 | `Log 'dispatch queued' and exit 0` | session-end.sh:29-30; impl session-end.sh:29-30 | CONFIRMED WORKING from its own artifacts. The log shows real dispatchIds: 'Mon Aug 24 05:23:24 dispatched: {"dispatchId":"576b35a2-599d-4812-be32-72ac1150eae4","status":"running"}' and, on Aug 23, the same goal text COALESCED ('"coalesced":true') — because the goal string is a constant, a second session ending while the first consolidation still runs is absorbed into the first dispatch and produces no new work. | verified-live |

- **Step 2 evidence.** session-end.sh:13-16. Not exercised live — running the hook would dispatch a goal,
  which the read-only constraint forbids.
- **Step 4 evidence.** ~/.claude/substrate-session-end.log last 5 lines, quoted above.

**End state.** A consolidation goal is running on goal-host (or was coalesced into one already running).
**How to verify it actually worked.** Not the hook log — it only proves a 202 came back. Take the dispatchId from the log and read `reached` via goal_status; a 202 says the walk started.

---

### F7-P7 — OpenSpec change workflow (propose → apply → archive; explore)

**Purpose.** Author and track structured change proposals under openspec/changes/, with a project context block that the substrate itself reads when authoring a change via the gap→spec path.
**Trigger.** An agent invokes /opsx:propose | /opsx:apply | /opsx:archive | /opsx:explore, or the equivalently-named skill.
**Preconditions.** the `openspec` CLI must be installed — it is NOT on this box; openspec/config.yaml present (it is); for archive: openspec/specs/<capability>/spec.md must exist (it does NOT).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `openspec new change "<name>" — scaffolds openspec/changes/<name>/ with .openspec.yaml` | .claude/skills/openspec-propose/SKILL.md:37-40; .claude/commands/opsx/propose.md; impl external `openspec` CLI | FAILS. `openspec: command not found` in both the tool shell and a login shell. The skill frontmatter itself states `compatibility: Requires openspec CLI` (openspec-propose/SKILL.md:5). | known-broken |
| 2 | `openspec status --change "<name>" --json → parse applyRequires + artifacts` | openspec-propose/SKILL.md:42-48; impl external CLI | Unreachable — blocked at step 1. | known-broken |
| 3 | `openspec instructions <artifact-id> --change "<name>" --json → context/rules/template/outputPath; write proposal.md, design.md, tasks.md in dependency order` | openspec-propose/SKILL.md:56-76; impl external CLI; the `context` and `rules` the CLI would serve live in openspec/config.yaml | The context/rules content is real and substantive (openspec/config.yaml carries the full ontology plus proposal/tasks rules), but nothing on this box can serve it to an agent through the documented path. | known-broken |
| 4 | `/opsx:apply — select change, openspec status, openspec instructions apply, read context files, implement tasks in a loop` | .claude/skills/openspec-apply-change/SKILL.md:18-92; .claude/commands/opsx/apply.md; impl external CLI + the agent | Blocked identically. Note apply's task rule (openspec/config.yaml rules.tasks) says 'Name the single file each task touches, by path, under repos/<vessel>/src/' — a fifth restatement of the stale one-file rule. | known-broken |
| 5 | `/opsx:archive — openspec list --json, check artifacts + tasks, then sync delta specs at openspec/changes/<name>/specs/ against openspec/specs/<capability>/spec.md` | .claude/skills/openspec-archive-change/SKILL.md:18-56; impl external CLI | Doubly blocked: the CLI is absent AND `openspec/specs/` does not exist in this repo at all. There is also no archive destination directory — 84 change dirs all sit flat in openspec/changes/, oldest 2026-04-26, so nothing has ever been archived through this path. | known-broken |
| 6 | `` /opsx:explore — thinking-partner mode, optionally running `openspec list --json` for awareness `` | .claude/skills/openspec-explore/SKILL.md:78-131; impl conversational; the CLI call is optional (SKILL.md:86) | The only one of the four that degrades gracefully, because its CLI use is optional. | documented-only |
| 7 | `(structural) Each workflow exists TWICE — as a skill under .claude/skills/openspec-*/ and as a slash command under .claude/commands/opsx/` | .claude/skills/openspec-{propose,apply-change,archive-change,explore}/SKILL.md and .claude/commands/opsx/{propose,apply,archive,explore}.md; impl n/a | All four pairs DIFFER in body, not just frontmatter (archive: 157 vs 114 lines; explore: 173 vs 288). Two surfaces for one job — the exact drift the Makefile's own comment (scripts/substrate/Makefile:40-47) says is why the per-vessel targets were deleted. | verified-live |

- **Step 1 evidence.** `bash -lc 'openspec --version'` → 'bash: line 1: openspec: command not found'. Control:
  `ls ~/.nvm/versions/node/v25.2.0/lib/node_modules/` → only @metabob and npm.
- **Step 3 evidence.** openspec/config.yaml contains `schema: spec-driven`, a `context:` block and `rules:`
  for proposal and tasks; there is no CLI to read it.
- **Step 5 evidence.** `ls openspec/` → only `changes` and `config.yaml`. `ls openspec/specs/` → No such file
  or directory. `ls openspec/changes | wc -l` → 84.
- **Step 7 evidence.** Body diff of each command against its skill (skipping frontmatter) → DIFFERS for all
  four; line counts as quoted.

**End state.** Intended: a change dir with proposal/design/tasks, implemented and archived. Actual: nothing past step 1 can run on this box.
**How to verify it actually worked.** `command -v openspec` before believing any openspec step. A skill file existing is not a capability.

---

### F7-P8 — Deploy / hot-reload escalation (the deploy skill)

**Purpose.** Reload or ship a vessel when a change cannot go through the substrate's own cutover — bootstrap, recovery, and the exceptional manual edit.
**Trigger.** Escalation ladder step 4-5 in .claude/skills/metabob-substrate/SKILL.md:183-189, or the deploy skill directly.
**Preconditions.** substrate-live container running (it is NOT, as of 05:08 UTC — see coverage_notes).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `make -C scripts/substrate restart-<vessel>   # sync + unit restart` | .claude/skills/deploy/SKILL.md:17 and :56; .claude/skills/metabob-substrate/SKILL.md:184; impl scripts/substrate/Makefile — NO SUCH TARGET | FAILS. `make: *** No rule to make target 'restart-goal-host-vessel'.  Stop.` The Makefile's own comment at line 40-47 records the deletion: 'This Makefile used to carry ~40 hand-enumerated restart-/logs-/sync-<vessel> targets… They are deleted, not deprecated.' Two skill files still instruct agents to run them. | known-broken |
| 2 | `make -C scripts/substrate sync-<vessel>   # sync only` | .claude/skills/deploy/SKILL.md:18; impl scripts/substrate/Makefile — NO SUCH TARGET | Same failure. | known-broken |
| 3 | `grep "restart-" scripts/substrate/Makefile   # 'Which vessels have targets: read the Makefile's .PHONY list'` | .claude/skills/deploy/SKILL.md:21; impl n/a | Returns only four comment lines about the deleted targets and a clobber warning — the instruction leads an agent to a comment block, not a target list. | known-broken |
| 4 | `docker exec substrate-live vessel-ctl restart <vessel>   (the ACTUAL interface)` | docs/LIVE_DEVELOPMENT.md:53-62; CLAUDE.md:301-302; impl /usr/local/bin/vessel-ctl in the image | CORRECT and confirmed present. LIVE_DEVELOPMENT.md:60-62 explicitly says 'restart works on any unit the fleet has — there is no per-vessel target list to consult', directly contradicting the deploy skill. (measured pre-rebuild) | verified-live |
| 5 | `Before restarting: confirm nothing is mid-flight; back up learning state` | .claude/skills/deploy/SKILL.md:27-29; CLAUDE.md:303-305; impl goal-host advertises `in_flight` on /health (repos/goal-host-vessel/src/index.ts:15640) | The in_flight count is genuinely served, so this check is actionable. | verified-in-code |
| 6 | `Verify after: /health responds, unit is active, vessel re-registered with discovery` | .claude/skills/deploy/SKILL.md:31-33; impl n/a | `systemctl is-active` is the WRONG check for a restart loop — a looping unit reports `activating`, never `failed`. Ask NRestarts and MainPID instead. | doc-code-mismatch |

- **Step 1 evidence.** `make -n restart-goal-host-vessel` → stderr 'No rule to make target'. `rg -c
  '^restart-[a-z-]+:' scripts/substrate/Makefile` → no matches; .PHONY at Makefile:315 lists 19 real targets,
  none of them restart-*.
- **Step 2 evidence.** `rg -c '^sync-[a-z-]+:' scripts/substrate/Makefile` → no matches.
- **Step 3 evidence.** `rg -n 'restart-' scripts/substrate/Makefile` → lines 40, 647, 875, 878, all comments.
- **Step 4 evidence (expired — measured pre-rebuild).** `docker exec substrate-live sh -lc 'command -v
  vessel-ctl'` → /usr/local/bin/vessel-ctl; usage line: `vessel-ctl
  <list|status|restart|start|stop|logs|install|uninstall|sync|deregister|apply|drift>`. (Probed at ~05:01,
  before the container was removed.)
- **Step 5 evidence.** index.ts:15639-15640 `in_flight: [...executionStore.values()].filter(r => r.status ===
  'running').length`.
- **Step 6 evidence.** Observed exactly this class live: activity-api at 04:59:26 read ActiveState=failed /
  Result=start-limit-hit / MainPID=0 / NRestarts=0 — NRestarts stayed 0 through a start-limit-hit, so even
  NRestarts alone would have missed it; MainPID was the discriminator.

**End state.** A vessel running the intended source.
**How to verify it actually worked.** Read NRestarts and MainPID, not is-active; then curl the vessel's /health and confirm re-registration via registry_query.

---

### Traps (cockpit)

| # | Trap | Where | Why invisible | How to detect | Severity |
|---|---|---|---|---|---|
| T1 | SUBSTRATE_ALLOW_DIRECT_EDIT=1 is PERMANENTLY SET in .claude/settings.local.json, so the 'dispatch, don't edit' default is off for every edit in this checkout — and because the bypass short-circuits … | .claude/settings.local.json:2-4 (env block); consumed at .claude/hooks/substrate-vessel-edit-gate.sh:22, which returns before the … | The hook signals denial as JSON on stdout and ALWAYS exits 0, so a gate that allowed and a gate that was switched off are byte-identical from the … | `echo $SUBSTRATE_ALLOW_DIRECT_EDIT` in the live session (→ 1), and `jq '.env' .claude/settings.local.json`. … | blocker |
| T2 | The memory-mirror hook cannot find `bun` and fails on every invocation, silently. | .claude/hooks/substrate-memory-mirror.sh:36-37 | Fail-open by design: the `\|\| echo "mirror failed"` catches it and the hook exits 0, so the Write/Edit tool result is unaffected. … | `rg -c 'bun: command not found' ~/.claude/substrate-memory-mirror.log` → 66, with Aug 25 timestamps. … | high |
| T3 | The operator memory cache is 552 files; the authoritative substrate store holds 148 notes — the 'derived cache' direction is inverted in practice. | docs/MEMORY_AS_SUBSTRATE.md:20-26 asserts the law; the mirror (P5) and the bulk importer (scripts/substrate/import-operator-memory.ts) are the only … | Session start injects 148 notes and prints '(authoritative — 148 notes)', which reads as completeness. … | Compare `find <memdir> -maxdepth 1 -name '*.md' ! -name MEMORY.md \| wc -l` (552) against `.body.total` from a memoryNote resolve (148). … | high |
| T4 | 'One file per goal — multi-file asks drop parts silently' is stale, and it is repeated in five places including the gate's own denial message, so every agent is steered away from a capability that … | CLAUDE.md:104; .claude/skills/metabob-substrate/SKILL.md:92; .claude/hooks/substrate-vessel-edit-gate.sh:51; openspec/config.yaml:33; … | It is a self-fulfilling instruction: agents that obey it never dispatch a multi-file goal, so no counter-evidence is ever generated. … | Read the enumeration at repos/goal-host-vessel/src/index.ts:11223 (`earlyAllFiles`, a Set over a /g match) and the consumer at … | medium |
| T5 | packages/*/src/** is vessel runtime code but is ungated AND undispatchable — the edit gate's regex requires /repos/, and goal-host's edit-intent regex only matches repos/. | .claude/hooks/substrate-vessel-edit-gate.sh:18; repos/goal-host-vessel/src/index.ts:11192 | CLAUDE.md:113-114 enumerates what is 'never gated' (docs, scripts, openspec, .claude, tests, config) and packages/ is not on that list, so its … | `printf '%s' '/x/packages/shared/src/a.ts' \| grep -Eq '/repos/[^/]+/src/'` → exit 1 (ungated). … | medium |
| T6 | The edit gate's path match requires a LEADING slash, so a relative file_path passes ungated. | .claude/hooks/substrate-vessel-edit-gate.sh:18 — pattern '/repos/[^/]+/src/' | Claude Code normally supplies an absolute file_path, so the hole never fires in normal operation and cannot be found by observing sessions. … | `printf '%s' 'repos/activity-api/src/a.ts' \| grep -Eq '/repos/[^/]+/src/'` → exit 1, versus exit 0 for the same path with a leading slash. | low |
| T7 | goal-host coalesces an identical in-flight goal and returns the EXISTING dispatchId, so a caller believes it started a fresh run. | repos/goal-host-vessel/src/index.ts:14232-14240 | The response is still 202 with a dispatchId and status:'running'; the only tell is a `coalesced:true` field that neither CLAUDE.md nor the … | Look for `"coalesced":true` in the /run-goal response. Observed live in ~/.claude/substrate-session-end.log for the Aug 23 dispatch. | medium |
| T8 | goal_status / goal_reasoning / provide_feedback all hang off goal-host's dispatch store, which prunes 20 records once it exceeds 100 — after which a verdict can no longer be recorded. | repos/goal-host-vessel/src/index.ts:15614-15619 (pruneStore); consumed by metabob-mcp/src/tools/provide-feedback.ts:121-128 | provide_feedback returns a polite explanatory STRING, not an error, so a loop that dispatches many goals and records verdicts at the end silently … | Count dispatches since the goal-host MainPID started; anything beyond ~100 has begun evicting. … | medium |
| T9 | When activity-api is down, the cockpit degrades to a local cache and says so only in a footer. | metabob-mcp/src/tools/get-metrics.ts; hydration path at metabob-mcp/src/tools/goal-status.ts:203-205 | During the activity-api outage window I observed, `get_metrics` returned a normal-looking report ('Analysis status: complete, Problems detected: 0') … | Probe metabob.endpoint /health directly before trusting any hydrated field; treat a missing reach verdict as unknown, not as false. | medium |
| T10 | activity-api can sit in ActiveState=failed with NRestarts=0 — the restart counter does not discriminate a start-limit-hit. | observed on substrate-live at 2026-08-25 04:59:26 UTC | The standing operator law is 'ask NRestarts, not is-active' — but here NRestarts read 0 while Result=start-limit-hit and MainPID=0. … | `systemctl show <unit> -p ActiveState,SubState,NRestarts,MainPID,Result,ExecMainStatus` — read Result and MainPID together, not NRestarts alone. | medium |
| T11 | memoryNote typing depends on a frontmatter key the documented rule does not mention, and works only because the frontmatter parser is flat. | scripts/substrate/mirror-memory-note.ts:22-34 (parser) and :36-41 (typeFromFilename); documented at docs/MEMORY_AS_SUBSTRATE.md:137-139 | The documented rule keys on UNDERSCORE filename prefixes (`feedback_*`); there are zero such files and 65 hyphenated ones, so by the documented rule … | `ls <memdir> \| rg -c '^feedback_'` → 0 vs `^feedback-` → 65; then read mirror-memory-note.ts:24-33 and note it does not track indentation. | low |
| T12 | Each openspec workflow exists as both a skill and an opsx slash command, and all four pairs have already diverged. | .claude/skills/openspec-{propose,apply-change,archive-change,explore}/SKILL.md vs .claude/commands/opsx/{propose,apply,archive,explore}.md | Both surfaces are listed to the agent with near-identical descriptions, so whichever is invoked appears authoritative. … | diff each commands/opsx/<x>.md against its skill body — all four report DIFFERS. | low |

- **T1 — full text.** *Trap:* SUBSTRATE_ALLOW_DIRECT_EDIT=1 is PERMANENTLY SET in .claude/settings.local.json,
  so the 'dispatch, don't edit' default is off for every edit in this checkout — and because the bypass
  short-circuits before the intervention_evaluate call, the S3 push-away channel is silenced too. *Where:*
  .claude/settings.local.json:2-4 (env block); consumed at .claude/hooks/substrate-vessel-edit-gate.sh:22,
  which returns before the intervention_evaluate POST at :43 *Why invisible:* The hook signals denial as JSON
  on stdout and ALWAYS exits 0, so a gate that allowed and a gate that was switched off are byte-identical
  from the caller's side. settings.local.json is gitignored (/home/avi/.config/git/ignore:1), so no repo
  review, diff, or CI can see it. And because the refusal path is never reached, `interventionRefused` simply
  never accrues — the absence of refusals reads as 'the substrate had no objection' rather than 'the substrate
  was never asked'. *Detection:* `echo $SUBSTRATE_ALLOW_DIRECT_EDIT` in the live session (→ 1), and `jq '.env'
  .claude/settings.local.json`. Then pipe a synthetic repos/<v>/src payload into the hook twice, with the flag
  forced to 0 and to 1, and compare STDOUT — never $?.
- **T2 — full text.** *Trap:* The memory-mirror hook cannot find `bun` and fails on every invocation,
  silently. *Where:* .claude/hooks/substrate-memory-mirror.sh:36-37 *Why invisible:* Fail-open by design: the
  `|| echo "mirror failed"` catches it and the hook exits 0, so the Write/Edit tool result is unaffected. The
  failure text goes only to ~/.claude/substrate-memory-mirror.log, which nothing reads. Worse, the log's own
  'mirror failed for <path>' line is IDENTICAL whether the cause is a dead substrate or a missing binary, so
  reading the log without the adjacent stderr line misattributes a PATH bug as an outage. bun exists and is on
  the login-shell PATH, so any manual reproduction succeeds. *Detection:* `rg -c 'bun: command not found'
  ~/.claude/substrate-memory-mirror.log` → 66, with Aug 25 timestamps. Cross-check at the consumer: count
  memoryNote records whose provenance_trace_ids contains 'harness-mirror' (9) against the memory dir's file
  count (552).
- **T3 — full text.** *Trap:* The operator memory cache is 552 files; the authoritative substrate store holds
  148 notes — the 'derived cache' direction is inverted in practice. *Where:*
  docs/MEMORY_AS_SUBSTRATE.md:20-26 asserts the law; the mirror (P5) and the bulk importer
  (scripts/substrate/import-operator-memory.ts) are the only two paths that enforce it, and one is broken
  while the other is manual *Why invisible:* Session start injects 148 notes and prints '(authoritative — 148
  notes)', which reads as completeness. Only 2 notes land in the 'read these' feedback block; the other 146
  are truncated to a top-35 title list. An agent that queries the store and finds nothing concludes the fact
  was never learned, when in fact it is sitting in an unmirrored cache file. *Detection:* Compare `find
  <memdir> -maxdepth 1 -name '*.md' ! -name MEMORY.md | wc -l` (552) against `.body.total` from a memoryNote
  resolve (148). The doc's own recall test (MEMORY_AS_SUBSTRATE.md:163-167) is the right check and it fails.
- **T4 — full text.** *Trap:* 'One file per goal — multi-file asks drop parts silently' is stale, and it is
  repeated in five places including the gate's own denial message, so every agent is steered away from a
  capability that now exists. *Where:* CLAUDE.md:104; .claude/skills/metabob-substrate/SKILL.md:92;
  .claude/hooks/substrate-vessel-edit-gate.sh:51; openspec/config.yaml:33; openspec/config.yaml rules.tasks
  *Why invisible:* It is a self-fulfilling instruction: agents that obey it never dispatch a multi-file goal,
  so no counter-evidence is ever generated. The code comment that FIXED it (goal-host index.ts:11218-11221)
  reads like a description of the defect, which is exactly the shape of text that gets re-reported as a live
  bug. *Detection:* Read the enumeration at repos/goal-host-vessel/src/index.ts:11223 (`earlyAllFiles`, a Set
  over a /g match) and the consumer at repos/development-vessel/src/resolvers/feature-compose.ts:2704
  (`targetFiles` is a plural Set) and :2978 ('multi-file, multi-vessel change'). The residual truth is
  narrower: ops on files NOT named in the spec are dropped (feature-compose.ts:3323-3327).
- **T5 — full text.** *Trap:* packages/*/src/** is vessel runtime code but is ungated AND undispatchable — the
  edit gate's regex requires /repos/, and goal-host's edit-intent regex only matches repos/. *Where:*
  .claude/hooks/substrate-vessel-edit-gate.sh:18; repos/goal-host-vessel/src/index.ts:11192 *Why invisible:*
  CLAUDE.md:113-114 enumerates what is 'never gated' (docs, scripts, openspec, .claude, tests, config) and
  packages/ is not on that list, so its exemption reads as an oversight rather than a decision. Three vessels
  consume packages/ through `file:` deps, so an edit there changes running vessel behavior with no trace and
  no gate. *Detection:* `printf '%s' '/x/packages/shared/src/a.ts' | grep -Eq '/repos/[^/]+/src/'` → exit 1
  (ungated). `rg -l '"file:\.\./\.\./packages' repos/*/package.json` → identity-vessel, terminal,
  react-renderer.
- **T6 — full text.** *Trap:* The edit gate's path match requires a LEADING slash, so a relative file_path
  passes ungated. *Where:* .claude/hooks/substrate-vessel-edit-gate.sh:18 — pattern '/repos/[^/]+/src/' *Why
  invisible:* Claude Code normally supplies an absolute file_path, so the hole never fires in normal operation
  and cannot be found by observing sessions. It shows only under a caller that passes a relative path.
  *Detection:* `printf '%s' 'repos/activity-api/src/a.ts' | grep -Eq '/repos/[^/]+/src/'` → exit 1, versus
  exit 0 for the same path with a leading slash.
- **T7 — full text.** *Trap:* goal-host coalesces an identical in-flight goal and returns the EXISTING
  dispatchId, so a caller believes it started a fresh run. *Where:*
  repos/goal-host-vessel/src/index.ts:14232-14240 *Why invisible:* The response is still 202 with a dispatchId
  and status:'running'; the only tell is a `coalesced:true` field that neither CLAUDE.md nor the
  metabob-substrate skill mentions. The session-end hook is the worst case — its goal text is a hardcoded
  constant (substrate-session-end.sh:18), so consecutive sessions coalesce into one consolidation by
  construction. *Detection:* Look for `"coalesced":true` in the /run-goal response. Observed live in
  ~/.claude/substrate-session-end.log for the Aug 23 dispatch.
- **T8 — full text.** *Trap:* goal_status / goal_reasoning / provide_feedback all hang off goal-host's
  dispatch store, which prunes 20 records once it exceeds 100 — after which a verdict can no longer be
  recorded. *Where:* repos/goal-host-vessel/src/index.ts:15614-15619 (pruneStore); consumed by
  metabob-mcp/src/tools/provide-feedback.ts:121-128 *Why invisible:* provide_feedback returns a polite
  explanatory STRING, not an error, so a loop that dispatches many goals and records verdicts at the end
  silently drops the oldest verdicts. The MCP's own message ('records are in-memory and capped ~100') is
  itself half-stale: the store IS persisted to disk every 5s and restored on boot (index.ts:15603-15613), so
  restart is survivable but the 100-cap eviction is not. *Detection:* Count dispatches since the goal-host
  MainPID started; anything beyond ~100 has begun evicting. Or GET goal-host /executions/:oldDispatchId and
  look for 404.
- **T9 — full text.** *Trap:* When activity-api is down, the cockpit degrades to a local cache and says so
  only in a footer. *Where:* metabob-mcp/src/tools/get-metrics.ts; hydration path at
  metabob-mcp/src/tools/goal-status.ts:203-205 *Why invisible:* During the activity-api outage window I
  observed, `get_metrics` returned a normal-looking report ('Analysis status: complete, Problems detected: 0')
  whose only tell was the trailing '[cache: local store active]'. goal_status is worse — it returns the
  goal-host dispatch record with the hydration half (reach verdict, produced shapes, posterior) simply absent,
  which reads as 'the walk produced nothing' rather than 'the trace store was unreachable'. *Detection:* Probe
  metabob.endpoint /health directly before trusting any hydrated field; treat a missing reach verdict as
  unknown, not as false.
- **T10 — full text.** *Trap:* activity-api can sit in ActiveState=failed with NRestarts=0 — the restart
  counter does not discriminate a start-limit-hit. *Where:* observed on substrate-live at 2026-08-25 04:59:26
  UTC *Why invisible:* The standing operator law is 'ask NRestarts, not is-active' — but here NRestarts read 0
  while Result=start-limit-hit and MainPID=0. Both is-active AND NRestarts would have been read as benign;
  only MainPID=0 plus Result exposed it. It self-recovered 47 seconds later (new MainPID 139499,
  ActiveEnterTimestamp 05:00:13), so a probe one minute either side sees a healthy fleet. *Detection:*
  `systemctl show <unit> -p ActiveState,SubState,NRestarts,MainPID,Result,ExecMainStatus` — read Result and
  MainPID together, not NRestarts alone.
- **T11 — full text.** *Trap:* memoryNote typing depends on a frontmatter key the documented rule does not
  mention, and works only because the frontmatter parser is flat. *Where:*
  scripts/substrate/mirror-memory-note.ts:22-34 (parser) and :36-41 (typeFromFilename); documented at
  docs/MEMORY_AS_SUBSTRATE.md:137-139 *Why invisible:* The documented rule keys on UNDERSCORE filename
  prefixes (`feedback_*`); there are zero such files and 65 hyphenated ones, so by the documented rule every
  feedback note would be typed `finding`. What actually saves it is `type:` nested under `metadata:` in the
  frontmatter, which the line-splitting parser flattens into a top-level key by accident. Any frontmatter
  writer that omits that key, or any parser fix that respects nesting, silently demotes all 65 feedback notes
  out of the session-start 'read these' block. *Detection:* `ls <memdir> | rg -c '^feedback_'` → 0 vs
  `^feedback-` → 65; then read mirror-memory-note.ts:24-33 and note it does not track indentation.
- **T12 — full text.** *Trap:* Each openspec workflow exists as both a skill and an opsx slash command, and
  all four pairs have already diverged. *Where:*
  .claude/skills/openspec-{propose,apply-change,archive-change,explore}/SKILL.md vs
  .claude/commands/opsx/{propose,apply,archive,explore}.md *Why invisible:* Both surfaces are listed to the
  agent with near-identical descriptions, so whichever is invoked appears authoritative. Divergence is only
  visible by diffing (archive 157 vs 114 lines; explore 173 vs 288). This is the same 'two surfaces for one
  job is how they drift' failure the Makefile comment at scripts/substrate/Makefile:41-42 cites as the reason
  the per-vessel targets were deleted. *Detection:* diff each commands/opsx/<x>.md against its skill body —
  all four report DIFFERS.

### Contradictions (cockpit)

| # | Claim A | Claim B | Which is right | Evidence |
|---|---|---|---|---|
| C1 | CLAUDE.md:104 / metabob-substrate SKILL.md:92 / edit-gate.sh:51 / openspec/config.yaml:33: 'One file per goal — multi-file asks drop parts silently.' | goal-host enumerates every named repos path into the compose spec (index.ts:11223 earlyAllFiles, :11232 the multi-file spec branch, :11275 verify_vessels as a vessel … | The code. The docs describe a defect that was fixed. The honest residual rule is narrower and worth stating instead: ops on files the spec did NOT … | goal-host index.ts:11218-11221 comment names the old behaviour as the bug and cites the gap that tracked it: 'the single-path spec told … |
| C2 | .claude/skills/deploy/SKILL.md:17-21 and :56, plus metabob-substrate SKILL.md:184: reload a vessel with `make -C scripts/substrate restart-<vessel>` / `sync-<vessel>`, … | scripts/substrate/Makefile:40-47: 'This Makefile used to carry ~40 hand-enumerated restart-/logs-/sync-<vessel> targets… They are deleted, not deprecated.' … | The Makefile and LIVE_DEVELOPMENT.md. `docker exec substrate-live vessel-ctl restart <vessel>` is the live interface. … | `make -n restart-goal-host-vessel` → stderr 'make: *** No rule to make target 'restart-goal-host-vessel'. … |
| C3 | CLAUDE.md:103 and metabob-substrate SKILL.md:89-90: a code-change goal's lead sentence names a `repos/<vessel>/src/…` file to route through the edit-intent path. | goal-host's routing regex is /repos\/([\w.-]+)\/[\w.\/-]+\.\w+/ (index.ts:11192, and identically at :11645 and :11707) — no `src` segment. … | The code. The doc's narrower phrasing is safe advice but understates the blast radius: the comment at index.ts:11193-11200 records a real incident … | index.ts:11192 verbatim; index.ts:11193-11200 comment. |
| C4 | docs/MEMORY_AS_SUBSTRATE.md:20-26 and CLAUDE.md:187-192: the substrate's memoryNote store is authoritative and the operator files under ~/.claude/projects/<slug>/memory/ … | The store holds 148 notes; the cache holds 552 top-level .md files (plus 81 archived). … | The measurement. The law is stated but not enforced — the cache is the larger, more current record, and the doc's own independent test … | memoryNote resolve → {"total":148}; `find <memdir> -maxdepth 1 -name '*.md' ! -name MEMORY.md \| wc -l` → 552; provenance group-by → harness-mirror:9, … |
| C5 | docs/MEMORY_AS_SUBSTRATE.md:78-80: 'Three Claude Code harness hooks… All three fail open: if the substrate is unreachable, the hook no-ops and the session proceeds on … | The mirror hook's dominant failure mode on this box is not an unreachable substrate but `bun: command not found` — and it fails open on that too, which is precisely why … | Both are literally true; the doc is incomplete in a load-bearing way. … | ~/.claude/substrate-memory-mirror.log: 66 occurrences of 'line 36: bun: command not found', most recent 2026-08-25 03:54:12 UTC; `bash -lc 'command … |
| C6 | metabob-substrate SKILL.md:196 cites `repos/metabob-mcp/docs/SPEC.md` for the cockpit tool contracts. | There is no repos/metabob-mcp in this super-repo. The MCP server lives outside the checkout at /home/avi/documents/work/metabob-mcp (the npm global symlink resolves … | The filesystem. openspec/config.yaml's own proposal rule — 'Verify every path you cite exists before citing it' — is violated by the skill that … | `ls repos/metabob-mcp` → No such file or directory; `readlink -f ~/.nvm/versions/node/v25.2.0/bin/metabob-mcp` → … |
| C7 | metabob-mcp provide-feedback.ts:121-128 tells the caller 'records are in-memory and capped ~100'. | goal-host persists the dispatch store to disk every 5 seconds and restores it on boot (index.ts:15603-15613, 'dispatch store: restored N records from disk'), so records … | The code. The trap is the eviction cap, not volatility — which matters because it changes the remedy from 'don't restart goal-host' to 'record … | index.ts:15603 `console.log('[goal-host-vessel] dispatch store: restored ' + executionStore.size + ' records from disk')`; :15609 … |
| C8 | .claude/skills/openspec-archive-change/SKILL.md:52-56 compares delta specs against main specs at `openspec/specs/<capability>/spec.md`. | openspec/ contains exactly two entries: `changes/` and `config.yaml`. … | The filesystem. The archive workflow has no target to sync into and nothing has ever been archived through it — consistent with the openspec CLI … | `ls openspec/` → changes, config.yaml; `ls openspec/specs/` → No such file or directory; `ls openspec/changes \| wc -l` → 84. |
| C9 | The hooks read the client config from `$HOME/.metabob/config.json` (substrate-session-end.sh:10; substrate-session-start.sh:39). | .mcp.json:8 pins the cockpit to `METABOB_CONFIG_PATH=/home/avi/documents/work/substrate/.metabob/config.json`, and CLAUDE.md:317-320 describes `~/.metabob/config.json` … | Neither is wrong today — the two files currently carry byte-identical apiKeys and the same endpoint — but they are two independent sources of truth … | md5 of `.metabob.apiKey` from both files: 09945aa2cc2d35f97114974bfe1c3cd9 (IDENTICAL); both `.metabob.endpoint` = http://localhost:18080. … |

- **C1 — full text.** *Claim A:* CLAUDE.md:104 / metabob-substrate SKILL.md:92 / edit-gate.sh:51 /
  openspec/config.yaml:33: 'One file per goal — multi-file asks drop parts silently.' *Claim B:* goal-host
  enumerates every named repos path into the compose spec (index.ts:11223 earlyAllFiles, :11232 the multi-file
  spec branch, :11275 verify_vessels as a vessel array), and feature_compose consumes it as a multi-file
  change (feature-compose.ts:9 and :2978 'multi-file, multi-vessel change'; :2704 targetFiles is a plural
  Set). *Which is right:* The code. The docs describe a defect that was fixed. The honest residual rule is
  narrower and worth stating instead: ops on files the spec did NOT name are dropped
  (feature-compose.ts:3323-3327), and a wholly off-target plan is REFUSED (:3330) — so name every file you
  want touched, rather than naming only one. *Evidence:* goal-host index.ts:11218-11221 comment names the old
  behaviour as the bug and cites the gap that tracked it: 'the single-path spec told feature_compose "this
  EXACT path only" and silently dropped the rest (gap spliceability-goal-host-index-edit-intent-region
  documents the coax trail). Enumerate every named path and union the vessels.' Verified at the CONSUMING
  layer: feature-compose.ts:2704 `const targetFiles = Array.from(new Set(`, :3308-3309 onTargetPath iterating
  ops, :3353-3364 the per-vessel scope gate.
- **C2 — full text.** *Claim A:* .claude/skills/deploy/SKILL.md:17-21 and :56, plus metabob-substrate
  SKILL.md:184: reload a vessel with `make -C scripts/substrate restart-<vessel>` / `sync-<vessel>`, and 'read
  the Makefile's .PHONY list' to see which vessels have targets. *Claim B:* scripts/substrate/Makefile:40-47:
  'This Makefile used to carry ~40 hand-enumerated restart-/logs-/sync-<vessel> targets… They are deleted, not
  deprecated.' docs/LIVE_DEVELOPMENT.md:60-62: 'restart works on any unit the fleet has — there is no
  per-vessel target list to consult.' *Which is right:* The Makefile and LIVE_DEVELOPMENT.md. `docker exec
  substrate-live vessel-ctl restart <vessel>` is the live interface. The two skill files are stale and will
  hard-fail an agent that follows them. *Evidence:* `make -n restart-goal-host-vessel` → stderr 'make: *** No
  rule to make target 'restart-goal-host-vessel'.  Stop.' (cite the stderr, not the exit code — $? there
  captured `head`). `rg -c '^restart-[a-z-]+:' scripts/substrate/Makefile` → no matches; Makefile:315 .PHONY
  lists 19 targets, none restart-*. In-container: `command -v vessel-ctl` → /usr/local/bin/vessel-ctl with
  restart in its usage line.
- **C3 — full text.** *Claim A:* CLAUDE.md:103 and metabob-substrate SKILL.md:89-90: a code-change goal's lead
  sentence names a `repos/<vessel>/src/…` file to route through the edit-intent path. *Claim B:* goal-host's
  routing regex is /repos\/([\w.-]+)\/[\w.\/-]+\.\w+/ (index.ts:11192, and identically at :11645 and :11707) —
  no `src` segment. Any file in a vessel repo routes, including package.json. *Which is right:* The code. The
  doc's narrower phrasing is safe advice but understates the blast radius: the comment at index.ts:11193-11200
  records a real incident where a read-only goal over repos/activity-api/package.json was routed to
  feature_compose and landed an unrequested version bump (1.20.9→1.20.10). *Evidence:* index.ts:11192
  verbatim; index.ts:11193-11200 comment.
- **C4 — full text.** *Claim A:* docs/MEMORY_AS_SUBSTRATE.md:20-26 and CLAUDE.md:187-192: the substrate's
  memoryNote store is authoritative and the operator files under ~/.claude/projects/<slug>/memory/ are a
  derived cache. *Claim B:* The store holds 148 notes; the cache holds 552 top-level .md files (plus 81
  archived). Only 9 notes carry harness-mirror provenance, and the mirror has failed on every invocation since
  the Aug 20 batch. *Which is right:* The measurement. The law is stated but not enforced — the cache is the
  larger, more current record, and the doc's own independent test (MEMORY_AS_SUBSTRATE.md:163-167: 'with the
  operator cache directory absent, can previously-known facts still be recalled by substrate query?') would
  fail for the ~400 unmirrored notes. *Evidence:* memoryNote resolve → {"total":148}; `find <memdir> -maxdepth
  1 -name '*.md' ! -name MEMORY.md | wc -l` → 552; provenance group-by → harness-mirror:9, null:138,
  "{{goal.id}}":1.
- **C5 — full text.** *Claim A:* docs/MEMORY_AS_SUBSTRATE.md:78-80: 'Three Claude Code harness hooks… All
  three fail open: if the substrate is unreachable, the hook no-ops and the session proceeds on the cache.'
  *Claim B:* The mirror hook's dominant failure mode on this box is not an unreachable substrate but `bun:
  command not found` — and it fails open on that too, which is precisely why it went unnoticed for days.
  *Which is right:* Both are literally true; the doc is incomplete in a load-bearing way. Fail-open is
  described as an availability property, but it is also swallowing a configuration defect, and the log gives
  the same 'mirror failed' line for both causes. *Evidence:* ~/.claude/substrate-memory-mirror.log: 66
  occurrences of 'line 36: bun: command not found', most recent 2026-08-25 03:54:12 UTC; `bash -lc 'command -v
  bun'` → /home/avi/.bun/bin/bun (present, just not on the hook's PATH).
- **C6 — full text.** *Claim A:* metabob-substrate SKILL.md:196 cites `repos/metabob-mcp/docs/SPEC.md` for the
  cockpit tool contracts. *Claim B:* There is no repos/metabob-mcp in this super-repo. The MCP server lives
  outside the checkout at /home/avi/documents/work/metabob-mcp (the npm global symlink resolves there), and
  its SPEC.md is at /home/avi/documents/work/metabob-mcp/docs/SPEC.md. *Which is right:* The filesystem.
  openspec/config.yaml's own proposal rule — 'Verify every path you cite exists before citing it' — is
  violated by the skill that teaches it. *Evidence:* `ls repos/metabob-mcp` → No such file or directory;
  `readlink -f ~/.nvm/versions/node/v25.2.0/bin/metabob-mcp` →
  /home/avi/documents/work/metabob-mcp/dist/cli.js; `ls /home/avi/documents/work/metabob-mcp/docs/SPEC.md` →
  exists.
- **C7 — full text.** *Claim A:* metabob-mcp provide-feedback.ts:121-128 tells the caller 'records are
  in-memory and capped ~100'. *Claim B:* goal-host persists the dispatch store to disk every 5 seconds and
  restores it on boot (index.ts:15603-15613, 'dispatch store: restored N records from disk'), so records
  survive a restart. The cap-100 / prune-20 eviction (index.ts:15614-15619) is real, but 'in-memory' is wrong.
  *Which is right:* The code. The trap is the eviction cap, not volatility — which matters because it changes
  the remedy from 'don't restart goal-host' to 'record verdicts before ~100 more dispatches accumulate'.
  *Evidence:* index.ts:15603 `console.log('[goal-host-vessel] dispatch store: restored ' + executionStore.size
  + ' records from disk')`; :15609 `setInterval(persistDispatchStore, 5000)`; :15615-15618 the prune.
- **C8 — full text.** *Claim A:* .claude/skills/openspec-archive-change/SKILL.md:52-56 compares delta specs
  against main specs at `openspec/specs/<capability>/spec.md`. *Claim B:* openspec/ contains exactly two
  entries: `changes/` and `config.yaml`. There is no specs/ directory, no archive destination, and all 84
  change dirs (oldest 2026-04-26) sit flat in changes/. *Which is right:* The filesystem. The archive workflow
  has no target to sync into and nothing has ever been archived through it — consistent with the openspec CLI
  never having been installed here. *Evidence:* `ls openspec/` → changes, config.yaml; `ls openspec/specs/` →
  No such file or directory; `ls openspec/changes | wc -l` → 84.
- **C9 — full text.** *Claim A:* The hooks read the client config from `$HOME/.metabob/config.json`
  (substrate-session-end.sh:10; substrate-session-start.sh:39). *Claim B:* .mcp.json:8 pins the cockpit to
  `METABOB_CONFIG_PATH=/home/avi/documents/work/substrate/.metabob/config.json`, and CLAUDE.md:317-320
  describes `~/.metabob/config.json` as the one config all tooling reads. *Which is right:* Neither is wrong
  today — the two files currently carry byte-identical apiKeys and the same endpoint — but they are two
  independent sources of truth for one credential, and a prior session's repoint touched only one of them.
  CLAUDE.md:317 overstates the singularity. *Evidence:* md5 of `.metabob.apiKey` from both files:
  09945aa2cc2d35f97114974bfe1c3cd9 (IDENTICAL); both `.metabob.endpoint` = http://localhost:18080.
  .metabob/config.json.hub-backup still carries http://syzygy.host:18080, the artifact of a prior repoint.

### Coverage notes (cockpit)

SCOPE COVERED: CLAUDE.md (whole file), .claude/settings.json, .claude/settings.local.json, .mcp.json, all four
hook scripts line-by-line, .claude/skills/metabob-substrate/SKILL.md and .claude/skills/deploy/SKILL.md in
full, all four openspec skills and all four .claude/commands/opsx/* (propose+archive read in full;
apply+explore read by section headers and CLI-call sites, then body-diffed against their opsx twins),
docs/LIVE_DEVELOPMENT.md and docs/MEMORY_AS_SUBSTRATE.md in full, openspec/ layout + config.yaml, the
edit-intent routing regions of repos/goal-host-vessel/src/index.ts (~11180-11300, ~11630-11730, 14200-14260,
15600-15645), the multi-file/scope-gate regions of repos/development-vessel/src/resolvers/feature-compose.ts,
and the metabob-mcp tool sources for run_goal_async / goal_status / goal_reasoning / provide_feedback /
execution_trace / operator-id.

HARD LIMIT — THE FLEET WAS DESTROYED MID-AUDIT. At ~05:01 UTC the substrate-live container was healthy and
every live probe above ran against it. By 05:08 UTC every fleet port read 000 and `substrate-live` was absent
from `docker ps -a` entirely — removed, not stopped. I ran only read-only commands, so this was not me;
something else (another session, a recreate, or a cleanup) removed it. ALL "verified-live" statuses are
therefore dated <=05:01 UTC 2026-08-25 and should be re-confirmed against a running fleet. Three specific
casualties:
- (1) HOLE LEFT OPEN — concept-priors injection at session start (substrate-session-start.sh:38-54, claimed by
  MEMORY_AS_SUBSTRATE.md:84) is UNCONFIRMED. My grep for "Concept priors" in the hook output returned 0
  matches, but that run landed inside the teardown window when discovery was already returning 000, so the
  negative measures the outage, not the hook. I explicitly do NOT report the priors block as broken. My
  earlier successful run (148 notes) was truncated at 1500 chars and never showed that half.
- (2) My live `goal_status` call on a real dispatchId from the session-end log returned "could not find
  goal-host-vessel via discovery". Same window, same confound. I do NOT report that as an MCP
  misconfiguration. It remains an open question worth re-running: the MCP config carries no explicit
  `discoveryEndpoint`, so metabob-mcp derives it as `${activityApiUrl}/discovery`
  (metabob-mcp/src/config.ts:89) rather than using :18100 directly — whether that proxy path serves
  vesselCapability correctly is UNTESTED.
- (3) I never got a live read of a real dispatch record, so the disk-persistence-vs-cap-100 behaviour of
  goal-host's dispatch store is verified-in-code only.

NOT COVERED, BY CONSTRAINT:
- NO GOALS DISPATCHED. run_goal / run_goal_async / provide_feedback / concept_create / substrateGap_write were
  never invoked (all write). Consequently the entire P2 chain from the compose POST through typecheck to the
  landed commit (steps 10-11) is verified-in-code only; the end-to-end "goal text in, traced commit out" claim
  is UNPROVEN by this audit.
- THE SESSIONEND HOOK WAS NEVER EXECUTED — running it dispatches a consolidation goal. Its steps are verified
  from source plus its own log artifacts (real dispatchIds and a real `coalesced:true`), not from an execution
  I caused.
- No hub/remote probing. .metabob/config.json.hub-backup points at syzygy.host:18080, which answered 200 on
  /health but 401 with the local API key. Anything about hub-side behaviour, deploy-remote.sh, or
  deploy-hub.sh is untested here.
- The openspec CLI is absent, so P7 could only be established as blocked-at-step-1. I controlled that properly
  (`bash -lc 'openspec --version'` → command not found; the global node_modules contains only @metabob and
  npm), but I could not observe what the workflow does when it works.
- metabob-mcp is outside the super-repo and unversioned by it; I read its source but did not verify the
  installed dist/cli.js matches that source. A stale dist would invalidate my verified-in-code claims about
  the cockpit tools.
- I did not audit the `metabob` skill (the generic CPG-adoption skill), the playwright plugin, or
  .claude/worktrees/ — out of the named scope.

PRIOR-REPORT TRIAGE:
- ONE_SURFACE_AUDIT_DELTA.md ("Deleting 63 Makefile targets left them silently succeeding"; .PHONY now lists
  only real targets so deleted names hard-fail): CONFIRMED. `make -n restart-goal-host-vessel` now errors with
  "No rule to make target" rather than exiting 0 — the fix held. NEW, and not in that report: two skill files
  (.claude/skills/deploy/SKILL.md:17,18,21,56 and metabob-substrate SKILL.md:184) still instruct agents to run
  the deleted targets, so the fix converted a silent no-op into a hard failure for anyone following the
  documented workflow.
- DOCUMENTED_LIFECYCLE_VERIFICATION.md (gate denies on repos/<v>/src/**; bypass allows;
  "SUBSTRATE_ALLOW_DIRECT_EDIT is an ordinary environment variable, so once exported for a one-off it silently
  disables the gate for the rest of the session"; filed as
  gap-direct-edit-override-persists-beyond-the-one-off): CONFIRMED AND ESCALATED. Both gate directions
  reproduce exactly. But the gap as filed describes a SESSION-SCOPED leak; the override is now declared in
  .claude/settings.local.json:2-4, making it persistent across every session in this checkout, and invisible
  to review because that file is gitignored. The severity should be raised and the gap re-scoped. That report
  also correctly warns that the hook signals via stdout JSON and always exits 0 — re-confirmed, and it is the
  reason the current state is undetectable by exit code.
- COMPOSITION_LEARNING_ARCHITECTURE_2026-08-21.md ("at most ONE conscious SUBSTRATE_ALLOW_DIRECT_EDIT=1 bypass
  should be spent… Do not spend more"): SUPERSEDED BY FACTS ON DISK. The single-bypass budget is not being
  enforced; the flag is on by default.
- PROCESS_MEANT_VS_ACTUAL.md: read, but it covers the execution/learning family (selection planes, gap-drain
  livelock), not this harness family. Its one adjacent finding — the compose lane being occupied by an
  un-closeable gap and starving the operator lane — is consistent with the `directed` slot-reservation comment
  I read at goal-host index.ts:11263-11272, but I could not check current lane occupancy after the fleet went
  down.
- Operator memory MEMORY.md claim "restored to 0 after" (2026-08-23 entry re: SUBSTRATE_ALLOW_DIRECT_EDIT):
  FALSIFIED. Current value is "1".
- Operator memory claim "THE COCKPIT WAS POINTED AT A DEAD HUB… Repointed local; MCP needs a RECONNECT"
  (2026-08-23): SUPERSEDED. Both config files now read http://localhost:18080 with identical keys, and MCP
  tools (registry_query, execution_trace) demonstrably reached the LOCAL activity-api — execution_trace
  returned a genuine 404 for a probe id, and a direct curl confirmed localhost:18080 answers that path with
  404 while syzygy.host answers 401.
- Operator memory claim "Shell `grep` is broken here — use `rg`": NOT REPRODUCED. /usr/bin/grep is ugrep 7.5.0
  and behaved correctly in every positive and negative control I ran, which matters because the edit gate
  depends on `grep -Eq` at lines 18 and 20. I used rg for searching per instruction, but the gate's own grep
  works.

ONE EVIDENCE CAVEAT ON MY OWN WORK: the `make -n restart-goal-host-vessel` probe printed `exit=0` because `$?`
captured a piped `head`, not make. The load-bearing evidence is make's stderr string, which I quote; do not
read that exit code as meaningful.



---

## 10. Family 8 — Validation, doctor, health & watchdogs

9 processes, 70 steps. The `substrate-live` container this family was measured against was **destroyed
mid-audit and has since been rebuilt** (created 2026-08-24 22:35 PDT, currently healthy). Statuses are the
auditor's, uncorrected; every outcome carrying **(measured pre-rebuild)** rests on an observation of the
destroyed instance and is expired rather than standing. Code-level statuses are unaffected.

### F8-P1 — substrate-doctor.sh — "is this substrate actually alive?"

**Purpose.** One command that goes beyond substrate-ready's per-unit matrix and asserts the seams that have historically failed silently: disk headroom, datastore auth, key validity against the issuing identity, registry population, failed units, restart loops, recovery coverage, real paid LLM completion, and (with --smoke) an end-to-end goal dispatch.
**Trigger.** Operator, by hand: `docker exec substrate-live substrate-doctor` or host-side `scripts/substrate/substrate-doctor.sh`. Also invoked non-optionally by `make up` (scripts/substrate/Makefile:463, no `|| true`). NOT invoked by any timer, unit, or CI workflow.
**Preconditions.** `jq` and `curl` present in the container (substrate-ready.sh:66 exits 2 without jq); /etc/substrate/env readable (every credential read greps it); docker CLI + a container named $CONTAINER, OR running in-container

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | CONTAINER=… substrate-ready.sh --once  (check 1, fleet readiness) | `scripts/substrate/substrate-doctor.sh:38-43`; impl scripts/substrate/substrate-ready.sh:268-290 — because ONCE=1 and QUICK=0, this takes a baseline pass, sleeps READY_LOOP_WINDOW (25s), then takes the verdict pass | Per-unit ok/down/skipped/masked matrix over all 95 inventory entries; FAIL=1 if any is down. Restart-loop delta detection IS active on this path (two passes). | verified-in-code |
| 2 | df -Pm /var/lib/surrealdb — datastore disk headroom (check 1b) | `scripts/substrate/substrate-doctor.sh:45-72`; impl substrate-doctor.sh:59-71 — FAIL below 2048MB free, WARN below 8192MB, on FREE SPACE not percentage | On the live fleet: avail_MB=1356670 (22% used) → PASS with a wide margin. (measured pre-rebuild) | verified-live |
| 3 | Read topology once: HUB_DISCOVERY_URL, ACTIVITY_API_ENDPOINT, IDENTITY_VESSEL_URL from /etc/substrate/env | `scripts/substrate/substrate-doctor.sh:74-99`; impl substrate-doctor.sh:91-98 — strips quotes before the emptiness test (a bare `grep -E '^HUB_DISCOVERY_URL=.+'` matches `HUB_DISCOVERY_URL=""` because the quotes are content) | IS_SPOKE flag set; checks 2/3/3b retarget to the hub on a spoke instead of probing a masked loopback port. | verified-in-code |
| 4 | POST http://127.0.0.1:8000/sql `RETURN 1;` with root:$SURREALDB_PASSWORD (check 2) | `scripts/substrate/substrate-doctor.sh:101-120`; impl substrate-doctor.sh:105; skipped entirely when `masked surrealdb.service` (line 102) | PASS iff the response contains "OK". On failure it discriminates warm-volume-recreate from first boot by testing whether /var/lib/surrealdb is non-empty (line 114). | verified-in-code |
| 5 | GET $ACTIVITY_EP/v2/activities/templates?limit=1 with `Authorization: ApiKey $METABOB_API_KEY` (check 3) | `scripts/substrate/substrate-doctor.sh:122-141`; impl substrate-doctor.sh:127-141 — case on the HTTP code; 200 PASS, 401/403 names the join failure on a spoke, anything else reports the raw code | Live: 200 with the env key, 401 without. The check would PASS. (measured pre-rebuild) | verified-live |
| 6 | POST $IDENTITY_EP/v1/keys/validate with the api_key (check 3b) | `scripts/substrate/substrate-doctor.sh:143-156`; impl substrate-doctor.sh:147-156 — three-way: valid:true PASS, valid:false names the join failure, unparseable is its own FAIL (never collapsed into "invalid") | The discriminator that tells "the hub rejected this key" from "identity is unreachable". | verified-in-code |
| 7 | GET http://127.0.0.1:8100/registry/stats; compare count to REG_FLOOR (check 4) | `scripts/substrate/substrate-doctor.sh:158-172`; impl substrate-doctor.sh:160-164 — jq `.total_vessels // .totalVessels // .registered`; floor 5, lowered to 2 when ENABLED_ROLES/ENABLED_VESSELS is set | Live registry answered `{"totalVessels":15,"totalShapes":385,"healthyCount":15}` → 15 ≥ 5 → PASS. The `// .totalVessels` alternative is the one that fires; the first key name does not exist in the response. (measured pre-rebuild) | verified-live |
| 8 | systemctl --failed --no-legend --plain (check 5) | `scripts/substrate/substrate-doctor.sh:174-180`; impl `substrate-doctor.sh:175` | Catches only units in the `failed` state. Structurally blind to restart loops (which report activating/active) and to hung oneshots (which report activating). The script says so itself at line 183. | verified-in-code |
| 9 | Two NRestarts snapshots 25s apart; report units whose counter MOVED and which are not resting at inactive/success (check 5b) | `scripts/substrate/substrate-doctor.sh:182-237`; impl — **full text below.** | THE ANSWER TO THE TASK'S QUESTION: yes, substrate-doctor DOES detect a restart loop. — **full text below.** | verified-live |
| 10 | For each inventory .service with no health_port, no seed role, not manifest: if /etc/systemd/system/<unit> exists and is not Type=oneshot, assert it has Restart= (check 6, recovery-coverage lint) | `scripts/substrate/substrate-doctor.sh:239-253`; impl substrate-doctor.sh:242-248. The path is hardcoded `f="/etc/systemd/system/$u"` and line 245 is `[ -f "$f" ] \|\| continue` | THE CHECK IS VACUOUS ON THIS DEPLOYMENT. It selects 40 candidate units and skips all 40 at line 245, because image-baked vessel units live in /lib/systemd/system, not /etc/systemd/system. It asserts nothing about zero units and prints PASS unconditionally. (measured pre-rebuild) | known-broken |
| 11 | For LLM arm ports 8221/8223/8225: probe /health, then POST /resolve a real 16-token llm_completion (check 7) | `scripts/substrate/substrate-doctor.sh:255-284`; impl substrate-doctor.sh:266-284 — only arms whose /health answers are counted in LLM_TRIED, so a role-subset node with no local arm gets a note, not a FAIL | This is one of only three checks in the whole family that verifies at the CONSUMING layer: it spends real money to answer "can this substrate draft at all", because every arm reported 200 with providers=[anthropic] for hours while every actual call returned "credit balance is too low". | verified-in-code |
| 12 | --smoke only: POST :8210/run-goal, poll GET /executions/<dispatchId> up to 40×5s, then poll GET :8080/v2/activities/execution-traces/<execId> up to 20×3s (check 8) | `scripts/substrate/substrate-doctor.sh:286-322`; impl substrate-doctor.sh:288-321 — handles both the synchronous {executionId} and async {dispatchId} shapes of /run-goal | The only end-to-end assertion in the family: dispatch → trace lands and is readable through the authed API. Note it asserts the trace EXISTS, never that `reached` is true, so a hollow completion passes the smoke. | verified-in-code |

- **Step 1 evidence.** substrate-ready.sh:276 `if [ "$ONCE" = 1 ] && [ "$QUICK" != 1 ]; then pass; sleep "$LOOP_WINDOW"; fi`. Not run live — a full doctor run takes ~50s of sleeps plus a paid LLM call, and check 7 issues a billable completion, which I judged outside a read-only audit.
- **Step 2 evidence.** `docker exec substrate-live df -Pm /var/lib/surrealdb` → `avail_MB=1356670 use=22%`
- **Step 5 evidence.** `curl -o /dev/null -w '%{http_code}' -H "Authorization: ApiKey $K" http://localhost:18080/v2/activities/templates?limit=1` → 200; unauthenticated → 401 (so the probe distinguishes auth from outage, not a blanket 000)
- **Step 7 evidence.** `docker exec substrate-live curl -s http://127.0.0.1:8100/registry/stats` → `{"totalVessels":15,"totalShapes":385,"healthyCount":15}`
- **Step 9 source / impl (full).** `scripts/substrate/substrate-doctor.sh:182-237`; impl substrate-doctor.sh:197-230. `_snap()` enumerates services explicitly (never globs — a glob returned 25 of 99 units), pipes them to one `systemctl show --property=Id,NRestarts`, and parses BY BLOCK because systemd prints NRestarts BEFORE Id. Line 224-226 requires the unit to still be cycling at window close, so a boot-time retry that settled is not condemned.
- **Step 9 outcome (full).** THE ANSWER TO THE TASK'S QUESTION: yes, substrate-doctor DOES detect a restart loop. I ran the exact parser against live systemd: 126 rows parsed from 126 units systemd listed, with correct Id↔NRestarts pairing (surrealdb.service=7, local-tools-vessel.service=1). Mechanism sound. What it MISSES: any loop whose period exceeds the 25s window (a unit with RestartSec=30 or systemd's default backoff climbing past 25s registers zero delta and reads healthy); non-service units; and hung units, whose NRestarts never moves at all. (measured pre-rebuild)
- **Step 9 evidence.** `systemctl list-units --type=service --all --no-legend --plain | awk '{print $1}' | xargs systemctl show --property=Id,NRestarts` piped through doctor's exact awk → 126 parsed rows vs 126 listed units; non-zero rows `local-tools-vessel.service 1`, `surrealdb.service 7`
- **Step 10 evidence.** Instrumented decomposition of doctor's own loop in-container: `candidates=40 file_missing=40 oneshot_exempt=0 actually_asserted=0`. Corroborating: `ls /etc/systemd/system/*.service | wc -l` → 11 (base-image getty/udev plus human-surface-vessel and 3 rendered llm arms); `ls /lib/systemd/system/*.service | wc -l` → 159; `systemctl show goal-host-vessel.service -p FragmentPath` → `/lib/systemd/system/goal-host-vessel.service`. Running doctor's verbatim check-6 pipeline live printed nothing (i.e. PASS).
- **Step 11 evidence.** Not probed live: issuing a billable completion is a mutation of the account, outside the read-only constraint.
- **Step 12 evidence.** Not run: --smoke dispatches a real goal, explicitly forbidden by the audit constraint.

**End state.** Exit 0 with `[doctor] all checks PASS`, or exit 1 with `[doctor] FAILURES detected` on stderr. Note check 6 contributes PASS unconditionally, and check 5's PASS carries no information about loops.
**How to verify it actually worked.** Do not trust the exit code alone. Read the per-check lines: check 6 saying PASS means nothing on this deployment; check 5 PASS means nothing about loops (5b is the line that matters); check 5b PASS means only "no counter moved in 25s". The claims worth reading are 1b (a real number), 3/3b (a real HTTP code), 4 (a real count) and 7 (a real paid call).

---

### F8-P2 — substrate-ready.sh — the fleet readiness matrix

**Purpose.** The single answer to "is the substrate up?", derived from vessels.inventory.json rather than a hardcoded list. Three consumers with three different flag sets and three different blind spots.
**Trigger.** (a) substrate-ready.service oneshot at boot, (b) the image HEALTHCHECK every 30s, (c) substrate-doctor check 1, (d) `make up` (Makefile:457, with `|| true`).
**Preconditions.** jq on PATH (exits 2 otherwise); a readable vessels.inventory.json at one of four searched locations (substrate-ready.sh:55-64)

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | Resolve the inventory: $VESSELS_INVENTORY → /workspace/substrate/fleet/… → /usr/local/share/substrate/… → $SCRIPT_DIR/… | `scripts/substrate/substrate-ready.sh:52-65`; impl `substrate-ready.sh:55-64` | Both container paths existed live and were byte-identical in size (15810), so the volume copy and the image copy had not drifted. (measured pre-rebuild) | verified-live |
| 2 | Determine IS_SPOKE from HUB_DISCOVERY_URL (quotes stripped) or ENABLED_ROLES containing `spoke` | `scripts/substrate/substrate-ready.sh:129-143`; impl `substrate-ready.sh:138-142` | Governs whether a masked core unit is an outage or the design. | verified-in-code |
| 3 | snapshot_restarts(): one systemctl show over every listed service, parsed by block | `scripts/substrate/substrate-ready.sh:98-110`; impl `substrate-ready.sh:103-110 — identical parser to doctor 5b` | Verified live: 126/126 rows, correct pairing. LOOP_CUR is rolled into LOOP_PREV at the top of each pass (line 255). (measured pre-rebuild) | verified-live |
| 4 | check_unit(): masked → down if (core AND standalone), else `masked` | `scripts/substrate/substrate-ready.sh:150-175`; impl `substrate-ready.sh:170-175` | This is the fix for the prior finding that the HEALTHCHECK went green over surrealdb/activity-api/identity/llm all masked and dead. Masked non-core units still bucket to `masked`, which is NOT counted in FAILING (line 264) — but is always named on stderr (lines 306-313). | verified-in-code |
| 5 | check_unit(): membership — skip units neither enabled/static nor active/activating/failed | `scripts/substrate/substrate-ready.sh:176-187`; impl `substrate-ready.sh:179-187` | Core units that are `disabled` by symlink but pulled in via Requires= are still checked. | verified-in-code |
| 6 | check_unit(): ConditionResult=no → skipped | `scripts/substrate/substrate-ready.sh:188-203`; impl `substrate-ready.sh:201-203` | Distinguishes "systemd deliberately declined to run this" (rendered LLM arms without a provider key; novnc/obsidian on the base image) from a dead vessel. Without it those three were reported down on a correct fleet. | verified-in-code |
| 7 | check_unit(): health_port present → curl 127.0.0.1:<port><path>, ok iff exactly 200 | `scripts/substrate/substrate-ready.sh:204-211`; impl `substrate-ready.sh:205-209` | A 200 from /health is the entire assertion. It cannot see a vessel that answers /health while its dependency is saturated — the class doctor check 7 and light-dispatch-healthcheck exist to cover elsewhere. | verified-in-code |
| 8 | check_unit(): *.timer → ok iff `systemctl is-active` == active | `scripts/substrate/substrate-ready.sh:212-214`; impl `substrate-ready.sh:213` | MAJOR BLIND SPOT. A timer that is `active` but will never fire again — NextElapseUSecMonotonic=infinity — passes this check. Measured live: boredom-vessel.timer, ActiveState=active, NextElapseUSecRealtime empty, NextElapseUSecMonotonic=infinity, LastTriggerUSec=Sun 2026-08-23 01:06:17, i.e. it had not fired in ~2 days and was scheduled never to fire again. `systemctl list-timers` printed NEXT=`-` for it. substrate-ready reports it `ok`. (measured pre-rebuild) | known-broken |
| 9 | check_unit(): role==seed OR Type==oneshot → down iff `is-failed`==failed OR restarting() | `scripts/substrate/substrate-ready.sh:215-247`; impl — **full text below.** | A HUNG oneshot is reported `ok`. It is not failed, and its NRestarts does not move. Measured live: m1-trainer.service, ActiveState=activating, SubState=start, InactiveExitTimestamp=04:42:49, still starting at 05:00:02 — 17+ minutes into a run its own unit file describes as "typically finishes in <30s" — with TimeoutStartUSec=infinity, so systemd will never fail it either. (measured pre-rebuild) | known-broken |
| 10 | pass(): iterate inventory rows, skipping self, skipping *.timer when --services-only, skipping non-core when --quick | `scripts/substrate/substrate-ready.sh:252-266`; impl `substrate-ready.sh:256-265` | --quick narrows 95 inventory entries to the 8 `core:true` units (surrealdb, valkey, discovery-vessel, identity-vessel, activity-api, local-tools-vessel, llm-resolver-vessel, goal-host-vessel). | verified-live |
| 11 | If --once and NOT --quick: run a discarded baseline pass, sleep READY_LOOP_WINDOW (25s), then the verdict pass | `scripts/substrate/substrate-ready.sh:268-283`; impl `substrate-ready.sh:276-283` | THE ANSWER TO THE SECOND HALF OF THE TASK'S RESTART-LOOP QUESTION. --quick sets ONCE=1 AND QUICK=1 (line 38), so the guard at 276 is false, no baseline pass runs, LOOP_PREV stays empty, and restarting() returns 1 unconditionally at line 115 (`[ -n "$now" ] && [ -n "$prev" ] \|\| return 1`). — **full text below.** | verified-in-code |
| 12 | Poll loop: repeat pass every 3s until FAILING==0, or --once, or deadline | `scripts/substrate/substrate-ready.sh:284-290`; impl `substrate-ready.sh:284-290` | Default TIMEOUT=120; the boot gate passes --timeout 240. | verified-in-code |
| 13 | Print the matrix (or --json), always name the masked count on stderr, exit [ FAILING = 0 ] | `scripts/substrate/substrate-ready.sh:292-316`; impl `substrate-ready.sh:306-316` | `ready` in --json is computed only from `down`, so a JSON consumer sees ready:true with masked units present unless it separately inspects the vessels array. | verified-in-code |

- **Step 1 evidence.** `ls -l /workspace/substrate/fleet/vessels.inventory.json /usr/local/share/substrate/vessels.inventory.json` → both 15810 bytes (Aug 21 12:09 / 12:16)
- **Step 3 evidence.** same control as doctor step 9
- **Step 8 evidence.** `systemctl show boredom-vessel.timer -p ActiveState -p NextElapseUSecMonotonic -p LastTriggerUSec` → `ActiveState=active`, `NextElapseUSecMonotonic=infinity`, `LastTriggerUSec=Sun 2026-08-23 01:06:17 UTC`; `systemctl list-timers --all` row: `-  -  Sun 2026-08-23 01:06:17 UTC  2 days ago  boredom-vessel.timer`
- **Step 9 source / impl (full).** `scripts/substrate/substrate-ready.sh:215-247`; impl substrate-ready.sh:229-247. Reads Type= from systemd rather than inferring "has a sibling timer, therefore may rest" — the comment at 217-228 records that the inference rule would have stopped checking boredom-vessel.service, which is Type=simple Restart=always despite having a timer.
- **Step 9 evidence.** `systemctl show m1-trainer.service -p ActiveState -p SubState -p TimeoutStartUSec -p InactiveExitTimestamp -p NRestarts` → `activating` / `start` / `infinity` / `Tue 2026-08-25 04:42:49 UTC` / `0`, against container clock `Tue Aug 25 05:00:02 UTC 2026`
- **Step 10 evidence.** `jq -r '.vessels[] | select(.core==true) | .unit' vessels.inventory.json` → 8 units; `jq '.vessels|length'` → 95
- **Step 11 outcome (full).** THE ANSWER TO THE SECOND HALF OF THE TASK'S RESTART-LOOP QUESTION. --quick sets ONCE=1 AND QUICK=1 (line 38), so the guard at 276 is false, no baseline pass runs, LOOP_PREV stays empty, and restarting() returns 1 unconditionally at line 115 (`[ -n "$now" ] && [ -n "$prev" ] || return 1`). The container HEALTHCHECK is therefore structurally incapable of seeing a restart loop — the exact false green that motivated the whole mechanism. The comment at 273-274 acknowledges the trade ("--quick keeps its single pass … must stay fast") but the operator-facing consequence is that `docker ps` health covers 8 of 95 units and 0 of the loop cases.
- **Step 11 evidence.** substrate-ready.sh:38 `--quick) QUICK=1; ONCE=1; shift ;;` and :276 `if [ "$ONCE" = 1 ] && [ "$QUICK" != 1 ]; then` and :115 `[ -n "$now" ] && [ -n "$prev" ] || return 1`. Could not demonstrate a live false green: nothing was looping during the window (only surrealdb=7 and local-tools=1 lifetime, both static across my samples).

**End state.** Exit 0 = no unit is `down`. Masked non-core units and skipped units do not affect the exit code.
**How to verify it actually worked.** Read the masked lines on stderr, and separately ask `systemctl show <timer> -p NextElapseUSecMonotonic` for every timer the matrix called ok — the matrix cannot see a deadlocked timer, and the exit code cannot see a hung oneshot.

---

### F8-P3 — Container HEALTHCHECK — the host-visible readiness signal

**Purpose.** Make `docker inspect --format '{{.State.Health.Status}}'` the only signal a host needs, since the launch contract is just `docker run`.
**Trigger.** dockerd, every 30s, 25s timeout, 240s start period, 3 retries.
**Preconditions.** None.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | CMD /usr/local/bin/substrate-ready --quick >/dev/null 2>&1 \|\| exit 1 | `Dockerfile.substrate:366-367`; impl substrate-ready.sh:38 (--quick ⇒ QUICK=1, ONCE=1), :259 (skip non-core), :276 (skip baseline pass) | Asserts a 200 from /health on the 8 core units, in a single pass, with output discarded. Verified live at the top layer: the healthcheck exec was firing every 30s right up to the container's destruction, and the last one is visible in the docker event stream. (measured pre-rebuild) | verified-live |
| 2 | (implied) nothing else | `Dockerfile.substrate:366-367` | What `healthy` does NOT mean: 87 of 95 inventory entries unchecked; restart loops undetectable (step 11 of the readiness process); deadlocked timers reported ok; hung oneshots reported ok; masked non-core units invisible to the exit code. `>/dev/null 2>&1` also discards the masked-count warning that substrate-ready deliberately always prints. | verified-in-code |

- **Step 1 evidence.** `docker events --since 45m` → `1787634295 substrate-live exec_create: /bin/sh -c /usr/local/bin/substrate-ready --quick >/dev/null 2>&1 || exit 1`; `docker ps` at audit start → `substrate-live Up 2 days (healthy)`

**End state.** docker health status healthy/unhealthy.
**How to verify it actually worked.** Do not use it as a fleet verdict. It is a core-liveness gate. Run `substrate-ready --once` (which does take the loop baseline) for anything that matters.

---

### F8-P4 — self-recovery-tick.sh — the immune system

**Purpose.** Detect a vessel broken by a change and undo it: health-check → restart → revert /vessels/<v>/src from the in-container git clone → escalate a substrateGap. The runtime tier below feature_compose's author-time typecheck rollback.
**Trigger.** self-recovery.timer — OnBootSec=120s, OnCalendar=*:0/3, Persistent=true. The OnCalendar anchor is deliberate: the comment records the immune system being dead for 5 days because OnUnitActiveSec re-arms only relative to the triggered service's last activation.
**Preconditions.** development-vessel reachable at :8090 for the lease check (fails open if not); a readable vessels.inventory.json / vessels.manifest.json

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | POST $DEV_VESSEL/v2/impulses/resolve {type:maintenanceLease, name:change_window}; exit 0 if held | `scripts/substrate/self-recovery-tick.sh:55-66`; impl self-recovery-tick.sh:59-66 — grep -o '"held":true'; a curl failure yields empty, so it fails OPEN (recovery proceeds) | Live: deferral is rare, not stuck — 3 occurrences in the full retained journal, first at 2026-08-22T01:48:00. I specifically checked this because a permanently-held lease would silently disable the immune system. (measured pre-rebuild) | verified-live |
| 2 | Detect host-vs-container context; define csh/csys wrappers | `scripts/substrate/self-recovery-tick.sh:68-76`; impl `self-recovery-tick.sh:69-76` | Fixes the 2026-07-01 defect where in-container runs had no docker CLI, every health probe failed, and hundreds of false ESCALATE gaps flooded the gap store. | verified-in-code |
| 3 | fleet_vessels(): inventory entries with repo != null AND health_port != null AND not manifest, plus manifest entries with self_recovery:true AND health_port | `scripts/substrate/self-recovery-tick.sh:145-171`; impl self-recovery-tick.sh:151-162, fallback hardcoded list at 166-170 | COVERAGE CEILING: the immune system only sees vessels that declare a health_port. Live it evaluated 16 (healthy:14 + uninstalled_skipped:2) of 95 inventory entries. Every oneshot timer-driven check — including the hung m1-trainer — is outside its reach by construction. (measured pre-rebuild) | verified-live |
| 4 | Skip if masked(): readlink /etc/systemd/system/<unit> == /dev/null | `scripts/substrate/self-recovery-tick.sh:77-82`; impl `self-recovery-tick.sh:82` | Reads the mask apply-inventory wrote, rather than re-deriving ENABLED_ROLES. | verified-in-code |
| 5 | Skip if manifest_vessel(name) AND not_installed(name), where not_installed = ! [ -f /etc/systemd/system/<name>.service ] | `scripts/substrate/self-recovery-tick.sh:85-105`; impl `self-recovery-tick.sh:98-105` | CORRECT BY DESIGN, and worth contrasting with doctor check 6 which makes the same /etc assumption wrongly. `vessel-ctl install` renders manifest units to /etc/systemd/system (vessel-ctl.sh:236), so /etc is the right question for a MANIFEST vessel — human-surface-vessel.service is in /etc and running. It is the wrong question for an INVENTORY vessel, whose unit is baked into /lib. Same path, opposite verdicts. (measured pre-rebuild) | verified-live |
| 6 | Skip if starting(): ActiveState==activating AND SubState != auto-restart | `scripts/substrate/self-recovery-tick.sh:106-129`; impl `self-recovery-tick.sh:125-129` | SubState is the discriminator, not ActiveState — `auto-restart` is the gap BETWEEN crashes, so excluding it stops this guard from excusing crash loops (it had been excusing federation-transport-vessel at NRestarts=1681 every tick). | verified-in-code |
| 7 | healthy(): up to 3 probes of http://127.0.0.1:<port>/health, 10s budget each, 5s apart; 0 iff any returns 200 | `scripts/substrate/self-recovery-tick.sh:178-191`; impl `self-recovery-tick.sh:185-190` | Consecutive-failure requirement stops a load spike from triggering a fleet-wide restart cascade. | verified-in-code |
| 8 | On unhealthy, before restarting: db_under_pressure() — twice POST SurrealDB `SELECT VALUE execution_id FROM execution LIMIT 1;`, reading BOTH http_code and time_total | `scripts/substrate/self-recovery-tick.sh:196-267`; impl self-recovery-tick.sh:231-267. Line 253-254 computes `slow` from time_total against DB_PROBE_SLOW_S=2; a 2xx/4xx that took longer than 2s counts as pressure. | Two prior defects fixed here and both are instructive: `RETURN 1;` never touched storage so it could only detect a DEAD db, never a congested one (16 activity-api restarts in 6 hours, each killing the retention sweep that would have relieved the pressure); and collecting http_code while discarding time_total made a 4.9s 200 read identically to a 5ms one. | verified-in-code |
| 9 | Restart the unit, sleep 6, re-check | `scripts/substrate/self-recovery-tick.sh:306-309`; impl `self-recovery-tick.sh:307-309` | recovered_by_restart++ on success. | verified-in-code |
| 10 | crevert(): rm -rf /vessels/<v>/src; cp -r from /workspace/git/vessels/<v>/src at the /workspace/.last-good/<v> pin (or clone dev HEAD); restart; re-check | `scripts/substrate/self-recovery-tick.sh:130-143, 310-317`; impl `self-recovery-tick.sh:135-143` | Git is the revert source, never a host checkout (law 11). Exit 1 when there is no clone, in which case the escalate branch runs. | verified-in-code |
| 11 | Escalate: emit a substrateGap_write with id self-recovery-failed-<name>, category service_failure | `scripts/substrate/self-recovery-tick.sh:318-320`; impl self-recovery-tick.sh:320 — via emit_gap, which swallows all errors (`\|\| true`, output to /dev/null) | The gap emission is unverified by the tick: a 500 from development-vessel is indistinguishable from a successful file. | verified-in-code |
| 12 | If db_backoff > 0: increment the streak file; at streak >= SURREAL_RESTART_THRESHOLD (2), `systemctl restart surrealdb.service` and emit a db_contention gap; else emit the backoff gap. Reset the streak to 0 otherwise. | `scripts/substrate/self-recovery-tick.sh:322-351`; impl `self-recovery-tick.sh:336-351` | Covers the 2026-07-31 wedge where MemoryHigh=22G throttling made surreal unresponsive without ever hitting MemoryMax, so the intended OOM-kill self-restart never fired. | verified-in-code |
| 13 | Print the JSON summary line | `scripts/substrate/self-recovery-tick.sh:352`; impl `self-recovery-tick.sh:352` | The only durable per-tick record; goes to the journal. (measured pre-rebuild) | verified-live |

- **Step 1 evidence.** `journalctl -u self-recovery.service -o cat | rg -c 'lease held — deferring'` → 3; passes at 04:36–04:54 all produced a real summary line
- **Step 3 evidence.** journal summary line, every 3 minutes: `{"healthy":14,"recovered_by_restart":0,"reverted_from_git":0,"escalated":0,"db_pressure_backoff":0,"surreal_restarted":0,"masked_skipped":0,"starting_skipped":0,"uninstalled_skipped":2}`
- **Step 5 evidence.** `systemctl show human-surface-vessel.service -p FragmentPath` → `/etc/systemd/system/human-surface-vessel.service` (ActiveState=active); `systemctl show federation-transport-vessel.service -p FragmentPath` → `/lib/systemd/system/…` (ActiveState=inactive, /health → 000); vessel-ctl.sh:236 `render-unit '$VESSEL' > /etc/systemd/system/$VESSEL.service`
- **Step 13 evidence.** see step 3

**End state.** Always exit 0. Every outcome is a journal line plus, on escalation, a best-effort gap.
**How to verify it actually worked.** Read the summary line's `healthy` count and compare it to what you believe the fleet is. 14 is the real coverage number here, not 95. `escalated:0` means either nothing broke or nothing it can see broke.

---

### F8-P5 — watchdog-tick.ts — degraded-mode watchdog for demoted timer units

**Purpose.** Four cadence ticks were demoted to watchdogs: the event-driven path (GapDrainObserver) is primary, and these fire the flow's resolver ONCE only when open intents exist AND the flow has visibly stalled. Quiet checks write nothing.
**Trigger.** Four systemd drop-ins override their unit's ExecStart to run watchdog-tick.ts instead of the original tick: gap-compose (STALL_MIN=20), funnel-drain (30), compose-teacher (45), operator-goal-generator (60). All four timers were live and firing.
**Preconditions.** /workspace/pool/standing.json readable and parseable; development-vessel reachable at :8090 for the lease check and the resolve

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | openRelevantIntents(): parse /workspace/pool/standing.json, filter status==open AND shape==WATCHDOG_RELEVANT_SHAPE, applying the composable/any route filter | `scripts/substrate/watchdog-tick.ts:54-68`; impl watchdog-tick.ts:55-58 — `if (!existsSync(poolFile)) return []` and `try { … } catch { return [] }` | If the pool file is missing, unreadable, or malformed, this returns [] and main() exits 0 at line 103 with no output at all. A watchdog that has lost its input is indistinguishable from a watchdog with nothing to do. | verified-in-code |
| 2 | newestActivityMs(): max mtime over WATCHDOG_ACTIVITY_PATHS (files and one directory level) | `scripts/substrate/watchdog-tick.ts:70-85`; impl `watchdog-tick.ts:72-84` | The stall signal is a file mtime, so any unrelated writer of that path keeps the flow looking alive. | verified-in-code |
| 3 | If lastActivity > 0 AND stalledForMs < STALL_MIN*60000 → return silently | `scripts/substrate/watchdog-tick.ts:105-107`; impl `watchdog-tick.ts:107` | THE MASKING DEFECT, PATCHED FOR ONE UNIT AND NOT THE OTHER. The gap-compose drop-in was pinned to /workspace/proposals/compose-lessons.jsonl precisely because the shared /workspace/pool/drain-log.jsonl was being refreshed every ~75s by a GapDrainObserver retry loop, so the compose watchdog always read "flow alive" and never fired, starving ~1800 open composable gaps. funnel-drain's drop-in still lists that same shared drain-log.jsonl in its WATCHDOG_ACTIVITY_PATHS. | doc-code-mismatch |
| 4 | leaseHeld('trace_store') / leaseHeld('change_window') → log deferred_lease_held and return | `scripts/substrate/watchdog-tick.ts:87-115`; impl watchdog-tick.ts:98 `catch { return false; }` — lease surface down fails OPEN | Correct direction: a dead lease service does not disable the watchdog. | verified-in-code |
| 5 | Fire: either Bun.spawn(bun, WATCHDOG_RESTART_EXEC) or POST /v2/impulses/resolve {type: WATCHDOG_RESTART_IMPULSE} with a 240s timeout; append one record to /workspace/pool/watchdog-log.jsonl and print it | `scripts/substrate/watchdog-tick.ts:117-150`; impl `watchdog-tick.ts:124-149` | One loud journal line on restart only. If neither env var is set the record carries ok:false with an error — but still exits 0. | verified-in-code |

- **Step 1 evidence.** watchdog-tick.ts:56 `if (!existsSync(poolFile)) return [];`, :58 `try { all = JSON.parse(...) } catch { return []; }`, :103 `if (intents.length === 0) return;`
- **Step 3 evidence.** units/gap-compose.service.d/watchdog.conf:15-23 documents the defect and sets `WATCHDOG_ACTIVITY_PATHS=/workspace/proposals/compose-lessons.jsonl`; units/funnel-drain.service.d/watchdog.conf:13 still sets `WATCHDOG_ACTIVITY_PATHS=/workspace/proposals:/workspace/pool/drain-log.jsonl`. Could not confirm live whether drain-log.jsonl is still being churned — the container was destroyed before I probed its mtime.

**End state.** Exit 0 in every path. A fired restart leaves a line in watchdog-log.jsonl and the journal; a silent pass leaves nothing anywhere.
**How to verify it actually worked.** Never infer health from the absence of journal lines — silence is the designed output of both "nothing to do" and "my input file is gone". Compare the count of open composable intents in standing.json against the age of the pinned marker file directly.

---

### F8-P6 — failure-mode-harness.ts — CLAUDE.md's named validation instrument

**Purpose.** CLAUDE.md:309 names this as "Validation: the failure-mode harness plus a confirming dispatch whose trace you inspect". Its own docstring claims it "dispatches the declared goal_text" for each scenario and scores emergence class and self-heal time.
**Trigger.** Operator, by hand. NOTHING invokes it: not a unit, not a timer, not the Makefile, not CI. configure-local.sh:95-100 merely prints the command as a suggestion. The weekly GitHub workflow runs a different harness.
**Preconditions.** METABOB_ENDPOINT/METABOB_API_KEY env or ~/.metabob/config.json; a reachable activity-api

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | loadConfig(): env vars, else ~/.metabob/config.json | `validation/scripts/failure-mode-harness.ts:125-141; docs/testing/README.md:40`; impl `failure-mode-harness.ts:128-140` | Live, ~/.metabob/config.json holds endpoint http://localhost:18080 and an apiKey byte-identical to the container's METABOB_API_KEY, so the harness would have authenticated. Note the last actual report ran against a REMOTE hub (138.197.116.56:18080), not this endpoint. (measured pre-rebuild) | verified-live |
| 2 | loadScenarios(): read every *.json under validation/failure-modes/scenarios/ | `validation/scripts/failure-mode-harness.ts:147-169`; impl `failure-mode-harness.ts:163-168` | 125 scenario files on disk. Both the code's docstring (line 3) and docs/testing/README.md:33 and QUICK_VERIFICATION_GUIDE.md:27 say "63 modes". | doc-code-mismatch |
| 3 | recommend(): POST $endpoint/v2/activities/recommend with task_description/goal_text/expected shapes | `validation/scripts/failure-mode-harness.ts:175-204`; impl `failure-mode-harness.ts:187-203` | THE HARNESS NEVER DISPATCHES ANYTHING. /v2/activities/recommend is a read-only ranking query. The docstring's word "dispatches" is wrong, and CLAUDE.md's framing of this as validation is wrong with it: the harness measures whether an activity whose declared shapes match already exists in the registry — presence of a registry record, which is explicitly not proof of capability. No goal executes, no trace is written, no reach verdict is produced. | doc-code-mismatch |
| 4 | matchSignature() against /recommend results with {requireTags:true, requireInputIntersect:true} | `validation/scripts/failure-mode-harness.ts:254-287, 339-341`; impl `failure-mode-harness.ts:259-286` | reuse if matched and alpha >= minimum_thompson_alpha; "new" if matched but under the alpha floor. | verified-in-code |
| 5 | Fallback: discoverByOutputShapes() → POST /v2/activities/discover-by-shapes mode:forward, then matchSignature with DEFAULT opts | `validation/scripts/failure-mode-harness.ts:206-252, 364-381`; impl failure-mode-harness.ts:370-372 calls matchSignature(r, sig) with no opts, so requireTags and requireInputIntersect are both undefined | Asymmetric strictness: the fallback path skips the tags check entirely when tags are absent (line 279) and skips the input-shape intersection (line 269), so it scores `reuse` on a looser test than the primary path. `discoverByOutputShapes` also swallows every non-ok response with `if (!res.ok) return []` (line 224). | verified-in-code |
| 6 | queryEmergentTrace(): GET /v2/activities/execution-traces?limit=50&since=<dispatchedAt> | `validation/scripts/failure-mode-harness.ts:289-318, 384-389`; impl failure-mode-harness.ts:297-317, called with dispatchedAt = the timestamp a few hundred ms earlier | Structurally near-vacuous: since nothing was dispatched, the only traces in that window are whatever unrelated work the substrate happened to run. It also returns null on any non-ok response (line 303), so an auth failure and an empty window are the same value. | verified-in-code |
| 7 | Classify: reuse / new / gap; detection_signal_present = (witness_required === 'trace_only') | `validation/scripts/failure-mode-harness.ts:343-419`; impl `failure-mode-harness.ts:396-407` | detection_signal_present is a restatement of a constant in the scenario file. It measures nothing about the running system. | verified-in-code |
| 8 | Write validation/results/<date>-failure-mode-report.json and print the tally | `validation/scripts/failure-mode-harness.ts:469-495`; impl `failure-mode-harness.ts:483-495` | No threshold, no floor, no non-zero exit on a bad tally. main() only exits 1 on an unhandled throw (line 498-501). Used as a gate it asserts nothing. | verified-in-code |
| 9 | (documented) --window-seconds <N> | `validation/scripts/failure-mode-harness.ts:21`; impl failure-mode-harness.ts:427-434 — parseArgs options are only scenario/scenarios/label/out | node:util parseArgs is strict by default, so passing the documented flag throws ERR_PARSE_ARGS_UNKNOWN_OPTION and the harness dies before running anything. | doc-code-mismatch |

- **Step 1 evidence.** `jq -r .metabob.endpoint ~/.metabob/config.json` → http://localhost:18080; apiKey compared equal to the container's env key; `jq .endpoint validation/results/2026-07-05-failure-mode-report.json` → "http://138.197.116.56:18080"
- **Step 2 evidence.** `ls validation/failure-modes/scenarios/*.json | wc -l` → 125
- **Step 3 evidence.** failure-mode-harness.ts:3 "dispatches the declared goal_text to POST /v2/activities/recommend" vs :187 `fetch(\`${endpoint}/v2/activities/recommend\`)`. Corroborated by the output: the last report's `avg_self_heal_seconds` is null.
- **Step 9 evidence.** usage block line 21 `[--window-seconds <N>]` vs the options object at :428-433 which has no such key and does not set `strict:false` or `allowPositionals`

**End state.** A JSON report plus a reuse/new/gap tally. Exit 0 essentially always.
**How to verify it actually worked.** None available from the harness itself. The last real run is validation/results/2026-07-05-failure-mode-report.json: 7 scenarios of 125, reuse=1 new=0 gap=6, avg_self_heal_seconds=null, against a remote hub — i.e. the instrument CLAUDE.md names has not been meaningfully exercised in ~7 weeks and reported 86% gap when it was.

---

### F8-P7 — validate-build.ts — build preflight (the one check with a blocking call site)

**Purpose.** Reproduce the container's build invariants on the host in under a second: file: deps resolve, frozen lockfiles are in sync with dependency keys, import specifiers match dependency keys — the namespace-migration breakages that only surface inside the image build.
**Trigger.** `make build` depends on it (Makefile:341 `build: validate-build`), which `make up` reaches. This is the only member of the family that blocks a real workflow on its exit code.
**Preconditions.** git submodules checked out (preflight-submodules, Makefile:317-322); bun on the HOST PATH (Makefile:328-336 — the image's own bun cannot serve a step that runs before docker)

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | make preflight-submodules — assert repos/discovery-vessel/package.json exists | `scripts/substrate/Makefile:317-322`; impl `Makefile:318-321` | Names the remedy (`git submodule update --init --recursive`) rather than the symptom. | verified-in-code |
| 2 | assert bun is on PATH | `scripts/substrate/Makefile:328-336`; impl `Makefile:328-336` | Replaces an exit-127 "bun: No such file or directory", which named the symptom and not the remedy. | verified-in-code |
| 3 | bun validate-build.ts — parse Dockerfile.substrate, walk each containerized vessel | `scripts/substrate/Makefile:337; validate-build.ts:26`; impl `validate-build.ts:60 onward` | Findings accumulate as error\|warn. | verified-in-code |
| 4 | isTracked(): git ls-files, because the Docker build context on a fresh clone only contains committed files | `scripts/substrate/validate-build.ts:33-48`; impl `validate-build.ts:38-47` | Catches the discovery-vessel case where a lockfile present on disk but untracked disappears on a fresh clone — a defect a dirty dev tree masks. This is verification at the consuming layer (the build context), not the convenient layer (the filesystem). | verified-in-code |
| 5 | Assert every dependency key appears in bun.lock | `scripts/substrate/validate-build.ts:151`; impl `validate-build.ts:151` | error: "--frozen-lockfile: dependency X is not in bun.lock … the image build WILL fail". | verified-in-code |
| 6 | Submodule pointer checks WARN by default, error only under --strict-repro | `scripts/substrate/validate-build.ts:197, 255`; impl `validate-build.ts:197-255` | Deliberately non-blocking; `make build` never passes --strict-repro, so the recorded-pointer-must-exist-on-a-remote check never gates anything. | verified-in-code |
| 7 | process.exit(findings.some(level === 'error') ? 1 : 0) | `scripts/substrate/validate-build.ts:315`; impl `validate-build.ts:315` | Non-zero aborts `make build`. Warnings never do. | verified-in-code |

**End state.** Exit 0 and the build proceeds, or exit 1 and `make build` stops before docker.
**How to verify it actually worked.** `make build` failing at this step names the vessel and the remedy. The script's own docstring is honest that it is a fast preflight and "the fully-faithful check remains make build".

---

### F8-P8 — The periodic observer checks (six timer-driven units)

**Purpose.** Continuous, cheap, read-mostly detectors for conditions that report as healthy resting states: trace-store growth, DB contention, memory budget, an alive-but-hung dispatch vessel, goal-executor behaviour drift, and whether credit still flows.
**Trigger.** Six systemd timers, all confirmed firing on the live fleet.
**Preconditions.** development-vessel at :8090 (four of the six resolve an impulse against it); goal-host at :8210 (the liveness probe dispatches into it)

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | trace-store-health-check.timer (OnActiveSec=3min, OnUnitActiveSec=10min) → bun trace-store-health-check.ts → POST /v2/impulses/resolve {type: trace_store_health_observer} | `scripts/substrate/units/trace-store-health-check.timer; scripts/substrate/trace-store-health-check.ts:1-13`; impl `trace-store-health-check.ts:18-37` | Live and healthy: {"ok":true,"row_count":12021,"cap":150000,"over_cap":false,"gap_emitted":false}. Reads O(1) counters from /metrics/db, never a COUNT. (measured pre-rebuild) | verified-live |
| 2 | db-contention-check.timer (OnActiveSec=2min, OnUnitActiveSec=5min) → POST {type: db_contention_observer} | `scripts/substrate/units/db-contention-check.timer; scripts/substrate/db-contention-check.ts:1-12`; impl `db-contention-check.ts:18-37` | Live: {"ok":true,"contention":false,"p95_latency_ms":72.8,"in_flight":1,"error_rate":0.0004,"anomalies":[],"gap_emitted":false}. An earlier run in the same journal showed p95 412.3ms with error_rate 0.0046 and still contention:false — the thresholds live in the resolver, which I did not read. (measured pre-rebuild) | verified-live |
| 3 | memory-budget-check.timer (OnBootSec=300s, OnCalendar=hourly, Persistent=true) → bash memory-budget-check.sh | `scripts/substrate/units/memory-budget-check.timer; scripts/substrate/units/memory-budget-check.service`; impl `scripts/substrate/memory-budget-check.sh` | FAILING ON EVERY RUN AND NOBODY IS LISTENING. Live output, identical across all three retained hourly runs: — **full text below.** | known-broken |
| 4 | light-dispatch-healthcheck.timer (OnActiveSec=30s, OnUnitActiveSec=30s) → probe :8280/health twice with --max-time 5, 2s apart; systemctl restart on two failures | `scripts/substrate/units/light-dispatch-healthcheck.timer; scripts/substrate/light-dispatch-healthcheck.sh:1-14`; impl `light-dispatch-healthcheck.sh:24-54` | Live: `[ld-healthcheck] ok (200)`. Design is sound in two respects worth naming: it skips unless SubState==running, deferring to Restart=always during backoff (lines 24-28); and --max-time is what distinguishes hung from healthy, since a wedged process accepts the TCP connect and never responds. curl -w always prints a code, so 000 is captured rather than being lost to a non-zero exit (lines 33-36). (measured pre-rebuild) | verified-live |
| 5 | goal-host-behavior.timer (OnActiveSec=3min, OnUnitActiveSec=30min) → curl POST {type: goal_host_behavior_scan, windowHours:3, limit:400} | `scripts/substrate/units/goal-host-behavior.timer; scripts/substrate/goal-host-behavior-tick.sh:1-16`; impl `goal-host-behavior-tick.sh:13-15` | Live and producing a model, but a degenerate one: 100 samples all bucketed under goal_direction "(no-output-shape)", distinct_templates 27-30, template_consistency 0.32-0.58, deviation_fraction 0.42-0.68, gaps_emitted 0. Modelling a single undifferentiated direction is close to modelling nothing. Separately: the script pipes curl into `head -c 1000` and then echoes, so its exit status is always 0 regardless of the HTTP outcome. (measured pre-rebuild) | verified-live |
| 6 | learning-liveness-probe.timer (OnActiveSec=10min, OnUnitActiveSec=6h, Persistent=true) → snapshot posterior, dispatch ONE nonce'd deterministically-graded goal, poll to terminal, re-read the posterior the WALK ACTUALLY PICKED, assert on success_count and the mean | `scripts/substrate/units/learning-liveness-probe.timer; scripts/substrate/learning-liveness-probe.ts:1-54`; impl `learning-liveness-probe.ts:129-251` | THE BEST CHECK IN THIS FAMILY, AND THE CLEAREST ANSWER TO "does anything verify at the consuming layer". — **full text below.** | verified-live |

- **Step 1 evidence.** `journalctl -u trace-store-health-check.service -o cat` → consecutive runs at row_count 12011 then 12021
- **Step 2 evidence.** `journalctl -u db-contention-check.service -o cat`, two consecutive runs
- **Step 3 outcome (full).** FAILING ON EVERY RUN AND NOBODY IS LISTENING. Live output, identical across all three retained hourly runs: FAIL "declared caps (34.0G) EXCEED host RAM (31.3G)" and FAIL "58 of 62 units are uncapped while the largest process IS capped — the cap elects a victim rather than bounding pressure", ending "2 FAIL(s)". The unit sets SuccessExitStatus=0 1 so systemd logs "Finished … successfully"; the script emits no gap and calls no resolver, so the verdict's only reader is a human reading the journal. Its own unit file (lines 3-11) explains it was written because detector PLACEMENT, not construction, is the bottleneck — and it now has a scheduler but still no consumer. (measured pre-rebuild)
- **Step 3 evidence.** `journalctl -u memory-budget-check.service -o cat` → three hourly runs, each ending `2 FAIL(s) — the fleet's memory budget or its recovery path does not hold.` then `Finished memory-budget-check.service`. Control for the reader claim: `rg 'substrateGap|emit|resolve|curl|8090|fileGap' scripts/substrate/memory-budget-check.sh` → one hit, a comment at :218 about masking. No emission path exists.
- **Step 4 evidence.** `journalctl -u light-dispatch-healthcheck.service -o cat` → repeated `[ld-healthcheck] ok (200)`
- **Step 5 evidence.** `journalctl -u goal-host-behavior.service -o cat` → `{"success":true,"shape":"goalHostBehaviorModel","body":{..."directions_modeled":1,..."goal_direction":"(no-output-shape)","samples":100,"template_consistency":0.32,"distinct_templates":30,...}}`
- **Step 6 outcome (full).** THE BEST CHECK IN THIS FAMILY, AND THE CLEAREST ANSWER TO "does anything verify at the consuming layer". It intervenes rather than reading a field; it resolves the store from the RUNNING goal-host's /proc/<pid>/environ rather than an env file a live process may predate (:70-82); it aborts when posterior_source != "stored" because a fabricated Beta(1,1) reads as an enticing untried arm rather than an error (:136-139); it nonces the goal because identical text coalesces (:143); it re-reads the arm the walk picked, not the one it assumed (:167-178); and it asserts only decay-immune signals — success_count and the mean — because decay applied before the graded delta makes the raw delta's sign meaningless (:197-222). Last live run: ALIVE. Exit codes are honestly tri-valued: 0 alive, 2 inconclusive, 3 failed-with-gap, and the unit sets SuccessExitStatus=0 2 so only a real credit failure marks the unit failed. (measured pre-rebuild)
- **Step 6 evidence.** `journalctl -u learning-liveness-probe.service -o cat` → `[probe] terminalized reached=true picked=satisfier:shellResult` / `AFTER alpha=21.7393 beta=45.1115 n=1127 succ=749` / `DELTA alpha=+0.6611 beta=+0.0549 n=+1` / `MEAN 0.318715 -> 0.325191 (+0.006475) successes +1` / `ALIVE`

**End state.** Journal lines. Two of the six (trace-store, db-contention) can emit a substrateGap; one (learning-liveness) emits a gap on failure; three cannot emit anything at all.
**How to verify it actually worked.** Read the journal per unit. Do not infer from unit state: trace-store-health-check.ts:24-25 and db-contention-check.ts:24-25 both print {"ok":false,...} and return normally on an HTTP error, so a total observer outage exits 0 and systemd reports success.

---

### F8-P9 — Orphaned checks — written, careful, and invoked by nothing

**Purpose.** Two substantial instruments in the family's named scope have no caller. Per the repo's own retention rule, a script nothing invokes cannot be observed failing, so it can never be trusted when it passes.
**Trigger.** None found.
**Preconditions.** None.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | scripts/substrate/warn-baseline-drift.sh <vessel> [container] — diff -rq /vessels/<v>/src against /workspace/git/vessels/<v>/src and warn that patch_with_tools will refuse to edit (POISONED BASELINE) | `scripts/substrate/warn-baseline-drift.sh:1-25`; impl warn-baseline-drift.sh:37-52; always exit 0 by design ("a warning must never fail a deploy") | ZERO CALLERS. A repo-wide search returns only the file itself. It exists specifically because `make sync-<vessel>` poisons the baseline invisibly — three consecutive self-development runs were blocked by a baseline the Makefile had poisoned minutes earlier, and "the sync printed success either way" — yet the sync targets do not call it, so the condition is still invisible from the deploy side. | known-broken |
| 2 | scripts/substrate/config-surface-probe.sh [--baseline] — measure what the configuration surface actually delivers; exit 1 on drift, against scripts/substrate/config-surface-baseline.txt | `scripts/substrate/config-surface-probe.sh:2-42; docs/operations/CONFIGURATION_SURFACE.md:224-226`; impl `config-surface-probe.sh (441 lines); reporting at :435` | ZERO AUTOMATED CALLERS. Every reference outside the script is documentation. Nothing schedules the drift check that a baseline file exists to support, so the baseline can silently rot. | known-broken |
| 3 | Control: does ANY CI workflow invoke a family check? | `n/a — audit step`; impl `.github/workflows/` | No. `rg 'substrate-doctor\|substrate-ready\|validate-build\|failure-mode-harness\|config-surface-probe\|warn-baseline\|memory-budget\|watchdog-tick' .github/workflows/` returns nothing. The one scheduled quality gate, weekly-recommendation-validation.yml, runs validation/scripts/run-weekly-harness.sh, which invokes reuse-harness.ts, compare-reports.ts, test-forge-goal-completion.ts and stratified-harness.ts — not the failure-mode harness. | verified-live |

- **Step 1 evidence.** `rg -n 'warn-baseline-drift' --glob '!**/node_modules/**'` → 2 hits, both inside warn-baseline-drift.sh (:2 the shebang comment, :28 its own usage string). No hit in scripts/substrate/Makefile, no unit, no CI workflow.
- **Step 2 evidence.** `rg -n 'config-surface-probe'` → hits only in config-surface-probe.sh itself, docs/operations/CONFIGURATION_SURFACE.md (:13,:224-226), scripts/substrate/Makefile:159 (a comment, not a recipe line), and two validation/findings docs
- **Step 3 evidence.** the rg above returned no matches; `rg -n 'run:' .github/workflows/weekly-recommendation-validation.yml` → `run: bash validation/scripts/run-weekly-harness.sh`; `rg -n 'bun ' validation/scripts/run-weekly-harness.sh` → reuse-harness.ts:68, compare-reports.ts:101, test-forge-goal-completion.ts:190, stratified-harness.ts:339

**End state.** Two instruments that look like coverage and are not.
**How to verify it actually worked.** Resolve callers at the binding site, not by basename. I could not complete the in-container half of this control (grep across /lib/systemd/system, /etc/systemd/system, /usr/local/bin, /workspace/active-scripts) because the container was destroyed first — so the orphan claim rests on the host tree, which is where units, the Makefile and CI all live.

---

### Traps (validation)

| # | Trap | Where | Why invisible | How to detect | Severity |
|---|---|---|---|---|---|
| T1 | Doctor check 6 asserts nothing and prints PASS unconditionally | scripts/substrate/substrate-doctor.sh:242-248, specifically `f="/etc/systemd/system/$u"` then `[ -f "$f" ] \|\| continue` | A 100% skip rate is indistinguishable from a 100% pass rate | Instrument the loop and count skips; read `FragmentPath` from systemd | high |
| T2 | The container HEALTHCHECK cannot see a restart loop; covers 8 of 95 units | Dockerfile.substrate:366-367 runs `substrate-ready --quick`; substrate-ready.sh:38 makes --quick imply --once; :276 gates the restart-loop baseline pass on `ONCE=1 AND QUICK!=1`; :115 makes restarting… | A looping unit reports `activating`, never `failed`; the delta pass is skipped on this path | Two `systemctl show --property=Id,NRestarts` snapshots a restart cycle apart | high |
| T3 | A timer can be `active` and scheduled never to fire again | substrate-ready.sh:213 (`*.timer) [ "$state" = "active" ] && echo ok`); substrate-doctor.sh:175 (--failed cannot see it) and :198 (5b enumerates `--type=service` only); self-recovery-tick.sh:151-162 (… | `is-active` reports the timer's own state, not its schedule | `systemctl show <timer> -p NextElapseUSecMonotonic -p LastTriggerUSec` | high |
| T4 | A hung `Type=oneshot` unit reports success everywhere | substrate-ready.sh:231-246 (oneshot branch: down only on is-failed==failed or restarting()); substrate-doctor.sh:175 and :211-215; self-recovery-tick.sh:151-162 and :125-129 | Every check in the family asks a question a hung oneshot answers correctly | Compare `InactiveExitTimestamp` to the clock; treat `TimeoutStartUSec=infinity` as a defect | high |
| T5 | memory-budget-check FAILs hourly into a journal nobody reads | scripts/substrate/units/memory-budget-check.service (`SuccessExitStatus=0 1`); scripts/substrate/memory-budget-check.sh (no resolver call anywhere in 247 lines) | `SuccessExitStatus=0 1` makes systemd log "Finished … successfully"; no gap is emitted | `journalctl -u memory-budget-check.service -o cat \| rg '^FAIL'` | high |
| T6 | CLAUDE.md's named validation instrument never dispatches anything | validation/scripts/failure-mode-harness.ts:3 (docstring claims "dispatches") vs :187 (POST /v2/activities/recommend); :384-389 queries traces `since` a timestamp milliseconds old; CLAUDE.md:309 presen… | It emits a confident report and exits 0 whatever the tally says | Run a positive control scenario before believing a gap tally | high |
| T7 | watchdog-tick is silent when its input is missing — same as "nothing to do" | scripts/substrate/watchdog-tick.ts:56 (`if (!existsSync(poolFile)) return []`), :58 (`catch { return [] }`), :103 (`if (intents.length === 0) return;`) | Silence is the designed success output | Assert the input independently against the marker's mtime | medium |
| T8 | The stall signal is a shared file mtime, so an unrelated writer masks a dead flow | scripts/substrate/units/funnel-drain.service.d/watchdog.conf:13 sets `WATCHDOG_ACTIVITY_PATHS=/workspace/proposals:/workspace/pool/drain-log.jsonl`; the fix is recorded at units/gap-compose.service.d/… | The watchdog reads "flow alive" and returns silently — no line anywhere | List who else writes each drop-in's `WATCHDOG_ACTIVITY_PATHS` | medium |
| T9 | An observer whose backend is dead exits 0 and systemd reports success | scripts/substrate/trace-store-health-check.ts:24-27 and :38-40; scripts/substrate/db-contention-check.ts:24-27 and :38-40; scripts/substrate/goal-host-behavior-tick.sh:13-15 | Both TS checks catch everything and log `{ok:false}` then return normally | `journalctl -u <unit> -o cat \| rg '"ok":false'`; alert on absence of `row_count` | medium |
| T10 | A never-installed manifest vessel waits forever, logged reassuringly | scripts/substrate/self-recovery-tick.sh:85-105 and :286-290 | The skip is correct in mechanism, but there is no upper bound on "yet" | Track the age of the `uninstalled_skipped` condition | medium |
| T11 | The restart-loop delta has a period floor (25s) | scripts/substrate/substrate-doctor.sh:208 (`sleep ${DOCTOR_LOOP_WINDOW:-25}`); scripts/substrate/substrate-ready.sh:275-282 (READY_LOOP_WINDOW=25) | The check prints "no unit restarted during a 25s observation window" | Read absolute `NRestarts` alongside the delta, against unit uptime | medium |
| T12 | `--smoke` asserts a trace EXISTS, never that the goal was reached | scripts/substrate/substrate-doctor.sh:313-319 — polls for HTTP 200 on /v2/activities/execution-traces/<id> and reports `ok "execution trace landed"` | It produces a green line containing a real execution id | Fetch the trace after a `--smoke` pass and read its reach tag | medium |
| T13 | `substrate-ready --json` reports `ready:true` with masked units present | scripts/substrate/substrate-ready.sh:292-295 (`{ready: (map(select(.status=="down")) \| length == 0), ...}`) versus the human path at :306-313 which always names the masked count on stderr | The human path always names the masked count; the JSON path did not get the same treatment | `jq '[.vessels[]\|select(.status=="masked")]'` on the output | low |
| T14 | failure-mode-harness scores `reuse` on a looser test in its fallback path | validation/scripts/failure-mode-harness.ts:339-341 passes {requireTags:true, requireInputIntersect:true}; :370-372 calls matchSignature with no opts, so :269 skips the input intersection and :279 skip… | Both paths emit the identical string `reuse`; only a note field distinguishes them | Count per-scenario notes saying "matched via discover-by-shapes" separately | low |

- **T1 — trap (full).** substrate-doctor check 6 ("recovery-coverage lint") asserts nothing at all and prints PASS unconditionally. It looks for unit files at /etc/systemd/system/<unit>, but image-baked vessel units live at /lib/systemd/system/<unit>, and the loop silently `continue`s on a missing file.
  - *Where (full):* scripts/substrate/substrate-doctor.sh:242-248, specifically `f="/etc/systemd/system/$u"` then `[ -f "$f" ] || continue`
  - *Why invisible (full):* The skip is the same `continue` used for legitimately-absent units, so a 100% skip rate is indistinguishable from a 100% pass rate. The check then prints the green line "every long-running service has a health_port or Restart= policy" — an affirmative claim about units it never opened. This is the exact failure shape the check exists to remove, one level up: a guarantee with no call sites.
  - *How to detect (full):* Instrument the loop and count: `INV=/workspace/substrate/fleet/vessels.inventory.json; for u in $(jq -r '.vessels[]|select((.unit|endswith(".service")) and .health_port==null and (.role!="seed") and ((.manifest//false)|not))|.unit' $INV); do [ -f /etc/systemd/system/$u ] || echo MISSING $u; done | wc -l` — measured 40 of 40 MISSING. Cross-check with `systemctl show <any-vessel> -p FragmentPath`. The fix is to read FragmentPath from systemd rather than guessing a directory.
- **T2 — trap (full).** The container HEALTHCHECK — and therefore `docker ps (healthy)`, the one signal the launch contract promises a host — is structurally incapable of detecting a restart loop, and covers 8 of 95 units.
  - *Where (full):* Dockerfile.substrate:366-367 runs `substrate-ready --quick`; substrate-ready.sh:38 makes --quick imply --once; :276 gates the restart-loop baseline pass on `ONCE=1 AND QUICK!=1`; :115 makes restarting() return false whenever there is no previous sample
  - *Why invisible (full):* A looping unit reports `activating`/`active`, never `failed`, so the per-unit check passes; the delta mechanism that would catch it is skipped on exactly this path; and `>/dev/null 2>&1` in the HEALTHCHECK discards even the masked-unit warning substrate-ready deliberately always prints. The result is a green health status produced by a check that ran correctly and asked nothing.
  - *How to detect (full):* Never treat docker health as a fleet verdict. Ask systemd for a delta: two `systemctl show --property=Id,NRestarts` snapshots at least one restart cycle apart (25s is the tuned floor; a unit with RestartSec>25s still evades it). `substrate-ready --once` (without --quick) does take the baseline and is the honest cheap check.
- **T3 — trap (full).** A systemd timer can be `active` and permanently scheduled never to fire again. Nothing in this family reads a timer's next-elapse time, so a deadlocked timer passes substrate-ready, substrate-doctor and self-recovery simultaneously.
  - *Where (full):* substrate-ready.sh:213 (`*.timer) [ "$state" = "active" ] && echo ok`); substrate-doctor.sh:175 (--failed cannot see it) and :198 (5b enumerates `--type=service` only); self-recovery-tick.sh:151-162 (only vessels with a health_port)
  - *Why invisible (full):* `is-active` on a timer reports the timer unit's own state, not its schedule. OnUnitActiveSec re-arms only relative to the triggered service's last activation, so if that service never returns to inactive the timer sits `active` with NextElapse=infinity forever. Measured live: boredom-vessel.timer had not fired since 2026-08-23 01:06:17 — about 2 days — with NextElapseUSecMonotonic=infinity, while its own unit file reasons about parallelism as though the service were Type=oneshot. It is Type=simple with Restart=always and had been continuously active since that same timestamp, so it can never go inactive and the timer can never re-arm. This is permanent by construction, not transient. m1-trainer.timer was in the same state (NextElapse=infinity) for the conditional reason that its oneshot was stuck. self-recovery.timer and memory-budget-check.timer carry the OnCalendar fix and its full rationale; boredom-vessel.timer and m1-trainer.timer do not.
  - *How to detect (full):* `systemctl show <timer> -p ActiveState -p NextElapseUSecMonotonic -p NextElapseUSecRealtime -p LastTriggerUSec`. Flag any timer with ActiveState=active and NextElapseUSecMonotonic=infinity, or whose LastTriggerUSec is older than a small multiple of its declared period. `systemctl list-timers --all` shows the same thing as NEXT=`-`. Structural fix: OnCalendar with Persistent=true, which cannot deadlock on a missed activation.
- **T4 — trap (full).** A hung Type=oneshot unit reports success everywhere. It is `activating`, so it is not failed; its NRestarts never moves, so the restart-loop delta is blind; and it has no health_port, so the immune system never looks at it.
  - *Where (full):* substrate-ready.sh:231-246 (oneshot branch: down only on is-failed==failed or restarting()); substrate-doctor.sh:175 and :211-215; self-recovery-tick.sh:151-162 and :125-129
  - *Why invisible (full):* Every check in the family asks a question a hung oneshot answers correctly. Measured live: m1-trainer.service entered its start phase at 04:42:49 and was still ActiveState=activating / SubState=start at 05:00:02 — 17+ minutes — against a unit file that documents the script as "typically finishes in <30s". Its TimeoutStartUSec is `infinity`, so systemd itself will never fail it; there is no upper bound on the hang. self-recovery's starting() guard would additionally skip it even if it had a port, because SubState is `start`, not `auto-restart`.
  - *How to detect (full):* For every oneshot: compare `InactiveExitTimestamp` against the container clock and against the cadence its own timer declares. `systemctl show <unit> -p ActiveState -p SubState -p InactiveExitTimestamp -p TimeoutStartUSec` — treat `TimeoutStartUSec=infinity` on a periodic oneshot as a defect in itself, since it converts every hang into a silent permanent one.
- **T5 — trap (full).** memory-budget-check runs hourly, reports FAIL every time, and its FAIL has no reader. The unit deliberately maps exit 1 to success, so systemd logs "Finished … successfully", and the script has no gap-emission path.
  - *Where (full):* scripts/substrate/units/memory-budget-check.service (`SuccessExitStatus=0 1`); scripts/substrate/memory-budget-check.sh (no resolver call anywhere in 247 lines)
  - *Why invisible (full):* The SuccessExitStatus mapping is correct in intent — the unit file explains that "a FAIL is a finding, not a crash", and marking it failed would make the immune system try to recover a report. But the finding then terminates in the journal. Nothing aggregates it, no substrateGap is written, and the unit's own state, the readiness matrix and doctor all read green. The unit file's header is a written record of this exact lesson ("a detector with no scheduler is indistinguishable from one that was never written, except that it looks like coverage") — it got a scheduler and still lacks a consumer, so the lesson is half-applied.
  - *How to detect (full):* `journalctl -u memory-budget-check.service -o cat | rg '^FAIL'`. Live findings, stable across three hourly runs: caps sum to 34.0G against 31.3G MemTotal, and 58 of 62 units are uncapped while the largest process (surreal, RSS 15.1→16.0→16.6G across those runs) is the capped one — so the cap elects an OOM victim rather than bounding pressure. Confirm the missing reader with `rg 'substrateGap|resolve|curl' scripts/substrate/memory-budget-check.sh` (one comment hit, no code).
- **T6 — trap (full).** CLAUDE.md's named validation instrument does not validate. failure-mode-harness.ts never dispatches a goal — it queries /v2/activities/recommend, a read-only ranking endpoint — so it measures registry presence, not capability, and its self_heal_seconds is structurally null.
  - *Where (full):* validation/scripts/failure-mode-harness.ts:3 (docstring claims "dispatches") vs :187 (POST /v2/activities/recommend); :384-389 queries traces `since` a timestamp milliseconds old; CLAUDE.md:309 presents it as the validation step
  - *Why invisible (full):* It produces a confident-looking report with an emergence tally, and it exits 0 no matter what the tally says (:498-501 exits non-zero only on an unhandled throw). Worse, a broken endpoint degrades into the same word as a real finding: recommend() throws on non-200 and the caller swallows it into a note (:333-337), discoverByOutputShapes returns [] on any non-ok (:224), and queryEmergentTrace returns null on any non-ok (:303) — so a 401, a dead endpoint and a genuine capability gap all classify as `gap`. The last real run (validation/results/2026-07-05-failure-mode-report.json) reports reuse=1 new=0 gap=6 over 7 scenarios against a remote hub, and there is no way to tell from the artifact which kind of gap those six were.
  - *How to detect (full):* Before believing a gap tally, run a positive control: pick one scenario whose activity you know exists and confirm it scores `reuse`; and confirm the endpoint answers 200 to an authed GET /v2/activities/templates. Then note the scale problem separately — 125 scenario files exist on disk while the code and both testing docs say 63, and the last run covered 7.
- **T7 — trap (full).** watchdog-tick exits 0 and writes nothing when its input file is missing or malformed — the same silent output as "nothing to do".
  - *Where (full):* scripts/substrate/watchdog-tick.ts:56 (`if (!existsSync(poolFile)) return []`), :58 (`catch { return [] }`), :103 (`if (intents.length === 0) return;`)
  - *Why invisible (full):* Silence is the designed success output. A watchdog whose standing-pool file has been moved, truncated or corrupted is byte-identical in the journal to a healthy watchdog on an idle flow, and its unit reports a clean oneshot run. Four flows depend on this — gap-compose, funnel-drain, compose-teacher, operator-goal-generator.
  - *How to detect (full):* Assert the input independently: `jq 'length' /workspace/pool/standing.json` and count open entries of the relevant shape, then compare against the mtime of the unit's WATCHDOG_ACTIVITY_PATHS. A non-zero open count with a stale marker and no watchdog_restart line in /workspace/pool/watchdog-log.jsonl is the failure.
- **T8 — trap (full).** The stall signal is a shared file mtime, so an unrelated writer keeps a dead flow looking alive. Fixed for gap-compose; funnel-drain still points at the shared path.
  - *Where (full):* scripts/substrate/units/funnel-drain.service.d/watchdog.conf:13 sets `WATCHDOG_ACTIVITY_PATHS=/workspace/proposals:/workspace/pool/drain-log.jsonl`; the fix is recorded at units/gap-compose.service.d/watchdog.conf:15-23; consumed at watchdog-tick.ts:70-85,107
  - *Why invisible (full):* The watchdog reads "flow alive" and returns silently — no journal line, no log entry, unit clean. The recorded instance: GapDrainObserver was stuck retrying two dispatchable gaps that HTTP-500'd every ~75s, perpetually refreshing drain-log.jsonl, so the compose watchdog never fired and ~1800 open composable gaps starved with every indicator green. The gap-compose drop-in was pinned to a compose-specific marker; funnel-drain's was not, so the identical masking path remains open for the funnel flow.
  - *How to detect (full):* For each watchdog drop-in, list who else writes its WATCHDOG_ACTIVITY_PATHS. A marker written by any producer other than the flow being watched cannot carry a stall signal. Compare `stat -c %Y` on the marker against the age of the oldest open relevant intent.
- **T9 — trap (full).** An observer tick whose backend is entirely down exits 0 and systemd reports success; the outage appears only as a lowercase field inside a JSON line.
  - *Where (full):* scripts/substrate/trace-store-health-check.ts:24-27 and :38-40; scripts/substrate/db-contention-check.ts:24-27 and :38-40; scripts/substrate/goal-host-behavior-tick.sh:13-15
  - *Why invisible (full):* Both TS checks catch every error and `console.log({ok:false,...})` then return normally — the docstrings call this "read-only + best-effort: never throws", which is right for not tripping the immune system but means a permanently-dead observer is invisible to every unit-state check. goal-host-behavior-tick.sh is worse: it pipes curl into `head -c 1000` and ends with `echo`, so the script's exit status is that of echo regardless of the HTTP outcome.
  - *How to detect (full):* Grep the journal for the negative rather than trusting the unit: `journalctl -u trace-store-health-check.service -o cat | rg '"ok":false'`. Name what a positive looks like first — a healthy run prints `{"ok":true,"row_count":N,...}` — and alert on the absence of `row_count`, not on unit failure.
- **T10 — trap (full).** A manifest vessel that is never installed waits forever, and the waiting is logged as a reassuring sentence.
  - *Where (full):* scripts/substrate/self-recovery-tick.sh:85-105 and :286-290
  - *Why invisible (full):* The skip is correct in mechanism — vessel-ctl install renders to /etc/systemd/system (vessel-ctl.sh:236), so "no unit in /etc" genuinely means "not installed yet", and the guard exists to break a real bootstrap deadlock where the immune system restart-looped a baked unit and aborted `make up` before the install step. But there is no upper bound on "yet". Live, federation-transport-vessel (:8401) and metric-collector-vessel (:8300) were both inactive/dead with /health returning 000, and self-recovery logged "waiting for vessel-ctl install" every 3 minutes indefinitely, counting them as uninstalled_skipped rather than as anything anyone acts on.
  - *How to detect (full):* Track the age of the uninstalled_skipped condition. `systemctl show <vessel>.service -p FragmentPath -p ActiveState` distinguishes a genuinely uninstalled manifest vessel (FragmentPath in /lib, inactive) from an installed one (FragmentPath in /etc). Any vessel skipped for more than a boot's worth of ticks should escalate rather than continue waiting.
- **T11 — trap (full).** The restart-loop delta has a period floor: a unit cycling slower than the observation window shows a zero delta and reads healthy.
  - *Where (full):* scripts/substrate/substrate-doctor.sh:208 (`sleep ${DOCTOR_LOOP_WINDOW:-25}`); scripts/substrate/substrate-ready.sh:275-282 (READY_LOOP_WINDOW=25)
  - *Why invisible (full):* The comments correctly justify 25s against a measured ~20s seeder loop, and the settled-retry exclusion at doctor:224-226 is right. But systemd's default RestartSec plus backoff, or any unit with an explicit RestartSec above 25s, produces a loop whose counter does not move inside the window — and the check then prints the affirmative line "no unit restarted during a 25s observation window", which a reader will hear as "no restart loops".
  - *How to detect (full):* Read the absolute NRestarts alongside the delta, and compare it against unit uptime: `systemctl show <unit> -p NRestarts -p ActiveEnterTimestamp`. A high lifetime count on a recently-started unit is a loop the window missed. Raise DOCTOR_LOOP_WINDOW above the largest RestartSec in the fleet when investigating.
- **T12 — trap (full).** substrate-doctor's --smoke asserts that a trace EXISTS, never that the goal was reached — so a hollow completion passes the one end-to-end check in the family.
  - *Where (full):* scripts/substrate/substrate-doctor.sh:313-319 — polls for HTTP 200 on /v2/activities/execution-traces/<id> and reports `ok "execution trace landed"`
  - *Why invisible (full):* It is the deepest check available and it produces a green line containing a real execution id, which reads as strong evidence. But CLAUDE.md's own rule is `reached`, not `status`, and hollow completion (completed + reached:false) is described there as common. The smoke check reads neither.
  - *How to detect (full):* After a --smoke pass, fetch the trace and read its reach tag rather than its HTTP code. The learning-liveness probe shows the correct pattern: it reads `reached` off the dispatch record (learning-liveness-probe.ts:161-165) and treats it as load-bearing.
- **T13 — trap (full).** substrate-ready --json reports ready:true with masked units present, because `ready` is computed only from `down`.
  - *Where (full):* scripts/substrate/substrate-ready.sh:292-295 (`{ready: (map(select(.status=="down")) | length == 0), ...}`) versus the human path at :306-313 which always names the masked count on stderr
  - *Why invisible (full):* The human-readable output was deliberately hardened to always print the masked count, precisely because masks are on-disk state that survives restarts and are the one condition under which the tool says "ready" about units that are not running. The JSON path did not get the same treatment, so a machine consumer sees a bare true.
  - *How to detect (full):* A JSON consumer must inspect the vessels array for status=="masked", not just read `.ready`. `jq '[.vessels[]|select(.status=="masked")]' ` on the output.
- **T14 — trap (full).** failure-mode-harness scores `reuse` on a strictly looser test in its fallback path than in its primary path.
  - *Where (full):* validation/scripts/failure-mode-harness.ts:339-341 passes {requireTags:true, requireInputIntersect:true}; :370-372 calls matchSignature with no opts, so :269 skips the input intersection and :279 skips the tags check whenever tags are absent — and discover-by-shapes does not return tags
  - *Why invisible (full):* Both paths emit the identical string `reuse` into the report; the only distinguishing mark is a note field. A run whose matches came mostly from the fallback path looks the same in the summary tally as one whose matches passed the strict test.
  - *How to detect (full):* Read the per-scenario notes for "matched via discover-by-shapes (not yet ranked in /recommend)" and count those separately from strict reuses.

---

### Contradictions (validation)

| # | Claim A | Claim B | Which is right | Evidence |
|---|---|---|---|---|
| C1 | substrate-doctor.sh:239-253 — check 6 asserts that "every long-running service has a health_port or Restart= policy", and prints PASS. | On this deployment the check opened zero unit files: all 40 candidates were skipped at `[ -f "$f" ] \|\| continue` because inventory units live in /lib/systemd/system, not /etc/systemd/system. | The code, read at the path it actually uses — the PASS is vacuous | `candidates=40 file_missing=40 actually_asserted=0` |
| C2 | validation/scripts/failure-mode-harness.ts:3 — "dispatches the declared goal_text"; CLAUDE.md:309 presents the harness as the validation step, "plus a confirming dispatch whose trace you ins… | The implementation POSTs to /v2/activities/recommend (line 187), a read-only ranking endpoint. No goal is dispatched, no execution runs, no trace is written by the harness. | The code — the harness measures registry presence, not capability | `failure-mode-harness.ts:187`; report `avg_self_heal_seconds: null` |
| C3 | docs/testing/README.md:33 and docs/testing/QUICK_VERIFICATION_GUIDE.md:27 — "Failure-mode harness — validates all 63 failure-mode classifications"; the code's own docstring (failure-mode-har… | validation/failure-modes/scenarios/ contains 125 JSON scenario files, and loadScenarios() reads every one of them (:163-168). | The filesystem — 125 scenarios; both docs and the docstring are stale | `ls …/scenarios/*.json \| wc -l` → 125; `.scenarios_run` → 7 |
| C4 | validation/scripts/failure-mode-harness.ts:21 documents a `--window-seconds <N>` flag in its usage block. | parseArgs at :427-434 declares only scenario, scenarios, label and out, with strict mode left at its default true. | The code — the documented flag raises ERR_PARSE_ARGS_UNKNOWN_OPTION | `failure-mode-harness.ts:21` vs `:428-433` |
| C5 | scripts/substrate/units/boredom-vessel.timer reasons throughout about parallelism as though the triggered unit were a oneshot — "Type=oneshot has no parallelism", "the timer could fire while… | boredom-vessel.service is Type=simple with Restart=always, and had been continuously active since 2026-08-23 01:06:17. A unit that never goes inactive can never satisfy an OnUnitActiveSec re… | The running system — the timer is deadlocked by construction | `boredom-vessel.timer` NextElapse=infinity, LastTrigger 08-23 01:06:17 |
| C6 | scripts/substrate/units/m1-trainer.timer — "the one-shot trainer … typically finishes in <30s on a few-thousand-variant corpus; well under the 15min cadence". | m1-trainer.service entered its start phase at 04:42:49 and was still ActiveState=activating / SubState=start at 05:00:02, with TimeoutStartUSec=infinity, and its timer's NextElapseUSecMonoto… | The running system — `TimeoutStartUSec=infinity` makes a hang permanent | `m1-trainer.service` activating/start, TimeoutStartUSec=infinity |
| C7 | scripts/substrate/units/memory-budget-check.service header — the unit exists because "a detector with no scheduler is indistinguishable from one that was never written, except that it looks … | The detector now has a scheduler and reports 2 FAILs every hour, and those FAILs reach no consumer: the script emits no substrateGap and calls no resolver, and the unit maps exit 1 to succes… | Both; the lesson is half-applied — scheduler fixed, reader not | one comment hit at `:218`; three hourly runs each `2 FAIL(s)` |
| C8 | validation/reports/README_FIRST_READER_AUDIT.md:140-141 — "The container HEALTHCHECK reports `healthy` through a dead data plane. substrate-ready --quick exits 0 with surrealdb, activity-api… | substrate-ready.sh:170-175 now fails a masked unit as `down` when it is core:true and the fleet is not a spoke, and always names the masked count on stderr. | SUPERSEDED for masking; the `--quick` half survives | `substrate-ready.sh:170-175,306-313` vs `:38,:276` |
| C9 | validation/reports/README_INSTRUCTION_AUDIT.md:90 files `gap-substrate-ready-false-green-on-a-restart-looping-unit`. | substrate-ready.sh now takes two passes on --once and reports a unit whose NRestarts moved and which is still cycling at window close (:103-127, :276-283); substrate-doctor gained check 5b (… | SUPERSEDED for `--once` and doctor; CONFIRMED open for `--quick` | `substrate-ready.sh:276` vs `:38`; 126/126 parser control |

- **C1 — claim A (full).** substrate-doctor.sh:239-253 — check 6 asserts that "every long-running service has a health_port or Restart= policy", and prints PASS.
  - *Claim B (full):* On this deployment the check opened zero unit files: all 40 candidates were skipped at `[ -f "$f" ] || continue` because inventory units live in /lib/systemd/system, not /etc/systemd/system.
  - *Which is right (full):* The code, read at the path it actually uses. The PASS is vacuous — the check is not wrong about the 40 units, it has no opinion about them. Contrast with self-recovery-tick.sh:105, which makes the same /etc assumption CORRECTLY, because it applies it to manifest vessels, and vessel-ctl.sh:236 does render those to /etc. Same path, different populations, opposite verdicts.
  - *Evidence (full):* Live decomposition of doctor's own loop: `candidates=40 file_missing=40 oneshot_exempt=0 actually_asserted=0`. `ls /etc/systemd/system/*.service | wc -l` → 11; `ls /lib/systemd/system/*.service | wc -l` → 159; `systemctl show goal-host-vessel.service -p FragmentPath` → /lib/systemd/system/goal-host-vessel.service; `systemctl show human-surface-vessel.service -p FragmentPath` → /etc/systemd/system/human-surface-vessel.service (a manifest vessel, installed).
- **C2 — claim A (full).** validation/scripts/failure-mode-harness.ts:3 — "dispatches the declared goal_text"; CLAUDE.md:309 presents the harness as the validation step, "plus a confirming dispatch whose trace you inspect".
  - *Claim B (full):* The implementation POSTs to /v2/activities/recommend (line 187), a read-only ranking endpoint. No goal is dispatched, no execution runs, no trace is written by the harness.
  - *Which is right (full):* The code. The harness measures whether a registry record matching the expected shape signature exists — which is not evidence of capability. CLAUDE.md's "plus a confirming dispatch" is doing all the real work in that sentence, and it is a manual step, not part of the harness.
  - *Evidence (full):* failure-mode-harness.ts:187 `fetch(\`${endpoint}/v2/activities/recommend\`, {method:"POST", ...})`; the only other network calls are discover-by-shapes (:212) and a GET of execution-traces (:300). Corroborated by output: validation/results/2026-07-05-failure-mode-report.json has `"avg_self_heal_seconds": null`.
- **C3 — claim A (full).** docs/testing/README.md:33 and docs/testing/QUICK_VERIFICATION_GUIDE.md:27 — "Failure-mode harness — validates all 63 failure-mode classifications"; the code's own docstring (failure-mode-harness.ts:3) says "the 63-mode failure matrix".
  - *Claim B (full):* validation/failure-modes/scenarios/ contains 125 JSON scenario files, and loadScenarios() reads every one of them (:163-168).
  - *Which is right (full):* The filesystem. The scenario corpus has roughly doubled since the docs and the docstring were written; both are stale. The last recorded run covered 7 scenarios, so neither number describes what has actually been exercised.
  - *Evidence (full):* `ls validation/failure-modes/scenarios/*.json | wc -l` → 125; `jq '.scenarios_run' validation/results/2026-07-05-failure-mode-report.json` → 7
- **C4 — claim A (full).** validation/scripts/failure-mode-harness.ts:21 documents a `--window-seconds <N>` flag in its usage block.
  - *Claim B (full):* parseArgs at :427-434 declares only scenario, scenarios, label and out, with strict mode left at its default true.
  - *Which is right (full):* The code. Passing the documented flag raises ERR_PARSE_ARGS_UNKNOWN_OPTION and the harness exits 1 via the top-level catch before loading a single scenario.
  - *Evidence (full):* failure-mode-harness.ts:21 vs :428-433; node:util parseArgs defaults strict:true.
- **C5 — claim A (full).** scripts/substrate/units/boredom-vessel.timer reasons throughout about parallelism as though the triggered unit were a oneshot — "Type=oneshot has no parallelism", "the timer could fire while the prior dispatch is still polling, causing systemd to kill it" — and sets OnUnitActiveSec=10min on that basis.
  - *Claim B (full):* boredom-vessel.service is Type=simple with Restart=always, and had been continuously active since 2026-08-23 01:06:17. A unit that never goes inactive can never satisfy an OnUnitActiveSec re-arm, so the timer is deadlocked by construction, not by accident.
  - *Which is right (full):* The running system. substrate-ready.sh:217-228 already records this exact fact as load-bearing ("boredom-vessel.service is Type=simple with Restart=always AND has a timer"), so the correction exists in the codebase — it just never propagated back to the timer whose design premise it invalidates. self-recovery.timer and memory-budget-check.timer both carry the OnCalendar fix and spell out the 5-day deadlock that motivated it; boredom-vessel.timer and m1-trainer.timer were not migrated.
  - *Evidence (full):* `systemctl show boredom-vessel.service -p Type -p Restart -p ActiveState -p ExecMainStartTimestamp` → Type=simple, Restart=always, active, Sun 2026-08-23 01:06:17 UTC. `systemctl show boredom-vessel.timer -p ActiveState -p NextElapseUSecMonotonic -p LastTriggerUSec` → active, infinity, Sun 2026-08-23 01:06:17 UTC. Compare units/self-recovery.timer (`OnCalendar=*:0/3`, Persistent=true) and units/memory-budget-check.timer (`OnCalendar=hourly`).
- **C6 — claim A (full).** scripts/substrate/units/m1-trainer.timer — "the one-shot trainer … typically finishes in <30s on a few-thousand-variant corpus; well under the 15min cadence".
  - *Claim B (full):* m1-trainer.service entered its start phase at 04:42:49 and was still ActiveState=activating / SubState=start at 05:00:02, with TimeoutStartUSec=infinity, and its timer's NextElapseUSecMonotonic was infinity as a result.
  - *Which is right (full):* The running system. The <30s figure may have been accurate when written, but the unit places no bound on the assumption: with TimeoutStartUSec=infinity a hang is permanent and systemd will never surface it, which converts a performance-regression claim into a silent-outage mechanism.
  - *Evidence (full):* `systemctl show m1-trainer.service -p ActiveState -p SubState -p InactiveExitTimestamp -p TimeoutStartUSec -p NRestarts` → activating / start / Tue 2026-08-25 04:42:49 UTC / infinity / 0, against `date -u` in-container → Tue Aug 25 05:00:02 UTC 2026. I could not re-measure to see whether it eventually completed — the container was destroyed at 05:05:11.
- **C7 — claim A (full).** scripts/substrate/units/memory-budget-check.service header — the unit exists because "a detector with no scheduler is indistinguishable from one that was never written, except that it looks like coverage".
  - *Claim B (full):* The detector now has a scheduler and reports 2 FAILs every hour, and those FAILs reach no consumer: the script emits no substrateGap and calls no resolver, and the unit maps exit 1 to success so systemd logs "Finished successfully".
  - *Which is right (full):* Both halves are true and the lesson is only half-applied — placement was fixed at the scheduler and not at the reader. The same principle the header states applies one step further out: a detector whose verdict has no consumer looks like coverage too.
  - *Evidence (full):* `rg 'substrateGap|emit|resolve|curl|8090|fileGap' scripts/substrate/memory-budget-check.sh` → a single hit at :218, a comment about masking; no emission code. Journal, three consecutive hourly runs, each: `2 FAIL(s) — the fleet's memory budget or its recovery path does not hold.` immediately followed by `Finished memory-budget-check.service`.
- **C8 — claim A (full).** validation/reports/README_FIRST_READER_AUDIT.md:140-141 — "The container HEALTHCHECK reports `healthy` through a dead data plane. substrate-ready --quick exits 0 with surrealdb, activity-api … masked."
  - *Claim B (full):* substrate-ready.sh:170-175 now fails a masked unit as `down` when it is core:true and the fleet is not a spoke, and always names the masked count on stderr.
  - *Which is right (full):* SUPERSEDED for the masking case — the fix is in the code with the incident written into the comment. But the report's underlying claim about --quick survives in a different form: --quick still skips the restart-loop baseline (:276) and still checks only the 8 core units, so the HEALTHCHECK remains blind to loops and to 87 of 95 units.
  - *Evidence (full):* substrate-ready.sh:170-175 and :306-313 (the fix) versus :38 and :276 (the surviving hole).
- **C9 — claim A (full).** validation/reports/README_INSTRUCTION_AUDIT.md:90 files `gap-substrate-ready-false-green-on-a-restart-looping-unit`.
  - *Claim B (full):* substrate-ready.sh now takes two passes on --once and reports a unit whose NRestarts moved and which is still cycling at window close (:103-127, :276-283); substrate-doctor gained check 5b (:182-237). I verified the shared parser live against 126 units with correct Id↔NRestarts pairing.
  - *Which is right (full):* SUPERSEDED for full `substrate-ready --once` and for substrate-doctor; CONFIRMED still open for `--quick`, and newly bounded by the 25s window floor.
  - *Evidence (full):* substrate-ready.sh:276 versus :38; live parser control returning 126/126 rows with surrealdb.service=7, local-tools-vessel.service=1.

---

### Coverage notes (validation)

*Reproduced as the auditor recorded them. The container has since been rebuilt (2026-08-24 22:35 PDT,
healthy); the auditor's "no replacement container existed" was true at the time of writing.*

MID-AUDIT EVENT — READ THIS FIRST. The `substrate-live` container was destroyed by another actor while I was auditing it. Docker event stream: `kill` at epoch 1787634297 (2026-08-25 05:04:57 UTC), `die` at ...299, `destroy` at ...311 (05:05:11 UTC). The last exec before the kill was the container's own HEALTHCHECK, not one of mine; every command I issued was read-only (systemctl show/cat/list-units, journalctl, cat, ls, jq, df, curl GET). It was `Up 2 days (healthy)` when I started. As of 05:07 UTC no replacement container existed (`docker ps -a | rg substrate` shows only unrelated 2-to-5-day-old exited containers). This was not an OOM — a `kill` followed by `destroy` is an explicit docker kill plus docker rm. I did not restart it (forbidden by the audit constraint). Consequence: EVERY "verified-live" claim in this report is a snapshot of the 04:48–05:05 UTC window on a container that no longer exists, and none of it can be re-confirmed without a rebuild. I flagged this rather than silently reporting stale reads as current.

WHAT I COULD NOT FINISH BECAUSE OF THAT. (1) Re-measuring m1-trainer.service to see whether it eventually completed or was still hung — so the m1-trainer finding is stated as "hung 17+ minutes with TimeoutStartUSec=infinity", which is what I measured, rather than a total duration. The structural half (an unbounded oneshot hang is invisible to every check in the family) does not depend on the re-measurement. (2) The in-container caller control for warn-baseline-drift.sh and config-surface-probe.sh — I intended to grep /lib/systemd/system, /etc/systemd/system, /usr/local/bin and /workspace/active-scripts at the binding site. The orphan claim therefore rests on the host tree only. That is weaker than my own standard, though it is where units, the Makefile and CI all live, and the host search was exhaustive (whole-repo rg, not basename matching). (3) Checking whether funnel-drain's shared drain-log.jsonl is currently being churned, which would confirm the masking defect is live rather than merely structural.

DELIBERATELY NOT RUN (read-only constraint). substrate-doctor end to end — check 7 issues a billable LLM completion and check 8 (--smoke) dispatches a real goal; both are mutations. So doctor steps 1, 11 and 12 are verified-in-code only. I also did not run failure-mode-harness, substrate-ready, validate-build, or any goal dispatch. This means the family's two deepest assertions (doctor check 7's real paid call, doctor --smoke's dispatch→trace) are the ones I have the weakest evidence for — I read them, I did not exercise them.

DOC COVERAGE, STATED PER DOC. Read completely: docs/testing/README.md (83 lines), docs/learning/FAILURE_MODES.md (134). Read partially: docs/testing/QUICK_VERIFICATION_GUIDE.md — first 80 of 384 lines (the endpoint, harness and pre-push smoke sections, which is where this family's claims live); I did not read its per-component, learning-loop, canary or troubleshooting sections. Grepped, not read: docs/FOUNDATION_COMPLIANCE_CHECKS.md (501) and docs/guides/EXTERNAL_VALIDATION.md (705) — a targeted rg for substrate-doctor|substrate-ready|failure-mode-harness|watchdog|healthcheck returned ZERO hits in either, so neither makes a claim about this family that could contradict the code; they are in the task's named scope but are about different subject matter. Worth flagging a name collision: docs/learning/FAILURE_MODES.md is not about the failure-mode harness at all — it documents FailureModeSchema and the outcome-conditional posterior step sizes (repos/activity-api/src/lib/posterior-update.ts). A reader sent to it expecting validation documentation will find learning-dynamics documentation.

CODE NOT READ. memory-budget-check.sh (247 lines) — I read its unit file in full and its complete live output, and ran a targeted control for emission paths (rg for substrateGap|emit|resolve|curl|8090|fileGap → one comment hit), which is what the trap claim rests on; I did not read the threshold arithmetic, so I take its two FAILs at face value rather than independently verifying the 34.0G/31.3G figures. config-surface-probe.sh (441 lines) — I read only its header and usage; the orphan finding does not depend on its internals. validate-build.ts — read the header and grepped for every failure/exit path; did not read the middle 250 lines of per-vessel logic. The resolvers behind four of the observer ticks (trace_store_health_observer, db_contention_observer, goal_host_behavior_scan, and the maintenanceLease shape) live in development-vessel and I did not open any of them — so I can say the ticks fire and what they report, but not whether their thresholds are well chosen. Notably: db-contention-check reported contention:false at p95_latency_ms=412.3 in one run, and I cannot say whether that is correct.

VALIDATION SCRIPTS NOT COVERED. validation/scripts/ holds ~50 files; I read one in full (failure-mode-harness.ts) and grepped one (run-weekly-harness.sh, to establish what CI actually runs). Not examined: stratified-harness.ts, reuse-harness.ts, compare-reports.ts, complexity-ladder-harness.ts, closure-audit.ts, cite-check.ts, verify-diagnostic-loops.ts, verify-branch-health.ts, probe-chain-stages.{ts,sh}, argument-chain-check.test.ts, external-data-oracles.sh, falsification-harness.py, validatability-harness.py, reach-generalization-harness.py, eval-*-harness.py, the dozen test-*.ts files, and the rest. I scoped to the instruments the task named plus the ones with call sites. Note that argument-chain-check.test.ts is called out in memory-budget-check.service's own header as a second "careful instrument, zero call sites" — I did not verify whether that is still true.

ADJACENT HEALTH UNITS OUTSIDE THE NAMED SOURCE LIST. Not audited: self-operational-health.ts, self-repair-operational.ts, coherence-metric.ts, coherence-recover.ts, spectral-gap.ts, model-reality-audit.ts, surgical-gap-scan.ts, autonomy-metrics.ts, db-maintenance-tick.ts. All have live timers and several are plainly health-adjacent; they were not in the task's source list and I did not expand scope to them.

LIVE TIMER CENSUS (the task asked for this explicitly). 39 timers listed by `systemctl list-timers --all` at 04:58 UTC. Firing normally with sane next-fire times: trace-store-health-check (10min), light-dispatch-healthcheck (30s), compose-teacher, memory-budget-check (hourly), self-recovery (*:0/3), obsidian-intake, db-contention-check (5min), self-repair-operational, self-development-trend, substrate-pull-sync, funnel-drain, efficiency-failure-tick, operator-goal-generator, db-maintenance, coherence-recover, model-reality-audit, surgical-gap-scan, composition-edge-reconcile, goal-host-behavior, observe-orthogonal-refresh, obsidian-learn, self-operational-health, auto-describe-resolvers, autonomy-metrics, coherence-metric, spectral-gap, gap-compose, typecheck-scenario-gen, obsidian-collaborate, ingest-docs, learning-liveness-probe (6h), plus the base-image apt/dpkg/tmpfiles/e2scrub timers. DEADLOCKED: boredom-vessel.timer — NEXT `-`, LastTrigger 2026-08-23 01:06:17 (2 days), ActiveState=active, NextElapseUSecMonotonic=infinity; permanent by construction because its Type=simple/Restart=always service never returns to inactive. ALSO NO NEXT-FIRE: m1-trainer.timer — NextElapse=infinity, but conditionally, because its oneshot was stuck in start; last trigger 15 min prior. fstrim.timer has never run (base-image, irrelevant). No check in this family reads a timer's next-elapse time, so both of these passed substrate-ready, substrate-doctor and self-recovery simultaneously.

THE THREE DIRECT QUESTIONS, ANSWERED. (1) Does substrate-doctor detect a restart loop? YES — check 5b (substrate-doctor.sh:182-237) takes two NRestarts snapshots 25s apart and reports units still cycling at window close, and I verified its parser live against 126 units with correct pairing. Check 5 (`systemctl --failed`) cannot and the script says so. Two residual holes: loops slower than the 25s window, and the fact that `--quick` — the container HEALTHCHECK path — skips the baseline pass entirely and so cannot detect one at all. (2) Does any check verify at the consuming layer? THREE do. learning-liveness-probe is the strongest and the only one that intervenes rather than reads: it dispatches a nonce'd deterministically-graded goal and asserts on the STORE's posterior, reading the arm the walk actually picked and asserting only decay-immune signals; verified ALIVE live. substrate-doctor check 7 spends real money on a 16-token completion because /health cannot see an unfunded account. validate-build's isTracked() asks git rather than the filesystem, because the Docker build context only contains committed files. Everything else in the family asks a proxy — a unit state, an HTTP 200, or a registry record. (3) Deadlocked timers: covered above.

PRIOR REPORTS — DISPOSITIONS. CONFIRMED: BRINGUP_THREE_PATHS.md's doctor mappings (check 1b free-space thresholds at :45-72, check 7's paid completion, jq/curl as hard requirements, `make up` calling doctor without `|| true`) all matched the current code at the cited lines. SUPERSEDED: README_FIRST_READER_AUDIT.md:140-141's "HEALTHCHECK reports healthy through a dead data plane" — fixed at substrate-ready.sh:170-175 with the incident written into the comment; and README_INSTRUCTION_AUDIT.md:90's ready-false-green-on-a-restart-loop gap — fixed for full `--once` runs and for doctor, but STILL OPEN for `--quick`. NOT CHECKED: README_FIRST_READER_AUDIT.md:98's claim that mask-recovery leaves 15 timers at ActiveState=failed ("Unit to trigger vanished"), invisible to drift/apply/vessel-ctl status — I saw no failed timers in the live list, but I never performed a mask-recovery, so this is untested rather than refuted. Also not checked: that report's line 225 on Type=oneshot latching `failed` so substrate-ready reports NOT ready forever while docker ps stays green.

METHOD NOTE ON THE ONE FINDING I KILLED. I initially read self-recovery's repeated "NOT INSTALLED … waiting for vessel-ctl install" for federation-transport-vessel and metric-collector-vessel as a second instance of the /etc-vs-/lib path defect. It is not: vessel-ctl.sh:236 renders manifest units to /etc/systemd/system, human-surface-vessel.service is in /etc and running, and both named vessels were genuinely inactive with /health returning 000. The check is correct by design. I kept the contrast in the report because the same path assumption being right in one place and vacuous in another is the useful part. I also initially suspected the container's disappearance was the OOM that memory-budget-check predicts hourly; the event stream (`kill` then `destroy`, no OOM in dmesg, host showing 60G total with 17G available) refuted that, and I dropped it rather than filing a tidy narrative.



---

## 11. Family 9 — Configuration surface

5 processes, 45 steps. Live evidence in this family was measured against the container `substrate-live` as it
existed during the audit window; that container was killed and destroyed mid-audit and has since been **rebuilt**
(created 2026-08-24 22:35 PDT, currently healthy). Statuses are left as the original auditor recorded them, but
every observation that depended on that specific container instance is marked **(measured pre-rebuild)** — it is
an expired reading, not a standing one. Code-level statuses are unaffected by the rebuild.

### F9-P1 — Boot-time configuration resolution and delivery (the funnel)

**Purpose.** Turn whatever reached the container (`docker run -e` / compose / `.env` / persisted volume) into the
environment each vessel process actually holds, across four channels with a defined precedence.
**Trigger.** Container start. `entrypoint.sh` runs as PID 1 before systemd exists.
**Preconditions.** A provider key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) resolvable from env OR
`/workspace/.substrate-secrets` — unless a remote hub is named (spoke), which waives it; `API_KEY_SECRET`
resolvable if `/var/lib/surrealdb/data.db` already exists, else gen-env exits 1; `/workspace` writable (the only
durable container-side config location — `/etc/substrate` is **not** on a volume).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `/usr/local/bin/gen-env` | `entrypoint.sh:6-7`; impl `gen-env.sh:1-1059` | Writes `/etc/substrate/env` (mode 600) by truncating `cat >`. Live measurement: 74 distinct names emitted, all unique **(measured pre-rebuild)** | verified-live |
| 2 | Spoke discrimination — classify root/standalone vs spoke from `DISCOVERY_ENDPOINT` and `HUB_DISCOVERY_URL` host, BEFORE key resolution; decision deferred to step 4 | `gen-env.sh:15-48`; impl `:31-40` (`_is_spoke`), `:48` (`_llm_guard_needed`) | `_is_spoke=1` for any named remote host on EITHER variable. Live fleet: `DISCOVERY_ENDPOINT=http://127.0.0.1:8100`, `HUB_DISCOVERY_URL` empty → root/standalone **(measured pre-rebuild)** | verified-live |
| 3 | Per-field persisted-secret fallback: `VAR="${VAR:-$(persisted_secret VAR)}"` — `grep -m1` field extraction from `/workspace/.substrate-secrets`, deliberately NEVER `source`d | `gen-env.sh:50-61, :280-288`; impl `:126-133` (`persisted_secret`), applied at `:135,140,154,164,187,227,232,272,288,302-313,345-348,457,477-479,584,620` | Explicit env beats persisted beats generated, **per field**. Live provenance confirms the mix: `ANTHROPIC_API_KEY=env` while `JWT_SECRET`/`SURREAL_PASS`/`API_KEY_SECRET`/`METABOB_API_KEY`/`FED_SUBSTRATE_ID`/`OPENROUTER_API_KEY`/`SUBSTRATE_GIT_PAT`/`PEER_DISCOVERY_ENDPOINTS`/`FEDERATION_*`=persisted **(measured pre-rebuild)** | verified-live |
| 4 | LLM-key guard, deferred so it tests the EFFECTIVE key rather than the operator's raw input | `gen-env.sh:315-326`; impl `:327-340` | Exits 1 only when root/standalone AND both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are empty after the persisted fallback. Its own error text warns that `HUB_DISCOVERY_URL` alone waives the guard but does NOT trigger spoke derivation (`:332-338`) — a self-documented asymmetry against the derivation block at `:371-429` | verified-in-code |
| 5 | Spoke endpoint derivation: `offset = disc_port - 18100`, applied to activity-api (18080) and identity (18101); scheme preserved; then `DISCOVERY_ENDPOINT` is REWRITTEN to `http://127.0.0.1:8100` so local vessels register locally | `gen-env.sh:358-368`; impl `:371-429`; offset bound `[ $_disc_port -ge 18100 ] && [ -le 47534 ]` at `:411`, which the comment states MUST match the Makefile's bound exactly | Not exercised on this deployment (root). Bound-parity with the Makefile not re-verified here | verified-in-code |
| 6 | Pinned-value notice loop — 21 names are written as fixed literals in the heredoc; supplying them prints `[gen-env] NOTE: X is pinned … the supplied value is IGNORED` | `gen-env.sh:481-493`; impl `:494-504` | Makes the discard audible but does not unpin. Pinned set: `TRACE_RETENTION_*`/`TRACE_STORE_*` (8), `EMBEDDING_PRIOR_*` (2), `SURREALDB_` contract (3), `RATE_LIMIT_ALLOWLIST_IPS`, `EMBEDDING_MODEL_DIR`, `OBSIDIAN_PLUGIN_ENDPOINT`. Live: all present with literal values and source `unrecorded` **(measured pre-rebuild)** | verified-live |
| 7 | Quote-escape the JSON-valued names, then `cat > /etc/substrate/env <<EOF` (47 raw `NAME="${VAR}"` wraps) | `gen-env.sh:508-527`; impl `:528` (`_env_escape`), `:533-534`, heredoc `:536-801` | Only `VLLM_ENDPOINTS` and `LLM_ARMS` are escaped; every other value is wrapped raw and covered only by the round-trip check at step 9 | verified-in-code |
| 8 | Conditional append block — `SUBSTRATE_REPO_OWNER` unconditionally; `PROFILE` / `ENABLED_ROLES` / `ENABLED_VESSELS` / `ENABLED_EXTRA_VESSELS` / `DISABLED_VESSELS` / `SUBSTRATE_BIND_HOST` / `MAX_PEER_DEPTH` / `FEDERATION_*` / `PUBLIC_IP` only when non-empty | `gen-env.sh:832-840`; impl `:841-867` | This is why the emitted-name count is a RANGE, not a constant. Live 74 (no selection knobs set, no `PUBLIC_IP`, `MAX_PEER_DEPTH` absent); baseline records 80 for a probe lane that supplies more; doc §4 states 72–80. Not a discrepancy — conditional by construction **(measured pre-rebuild)** | verified-live |
| 9 | Round-trip check: `env -i sh -c 'set -a; . /etc/substrate/env'` for parseability, then jq-validate `VLLM_ENDPOINTS` and `LLM_ARMS` | `gen-env.sh:869-887`; impl `:888-905` | **WARNING-only.** `_rt_fail` is counted and printed; gen-env does NOT exit non-zero on a failed round trip, so an unparseable env file proceeds to boot | verified-in-code |
| 10 | Persist to `/workspace/.substrate-secrets` via `mktemp` + merge-carry of unrecognised keys + `mv -f` (atomic) | `gen-env.sh:907-925`; impl `:926-1026`; merge loop `:1000-1019`; `.prev` backup `:1016` | Truncation hazard resolved. The inline comment at `:966-967` ("this heredoc OVERWRITES the file, so every durable secret MUST be listed here or it is lost") is STALE relative to the merge 35 lines below | doc-code-mismatch |
| 11 | Emit `/etc/substrate/env.provenance` (mode 644) — `NAME=env\|persisted\|generated\|derived\|hardcoded` | `gen-env.sh:1028-1041`; impl `:1035-1058`; `_ENV_SUPPLIED` snapshot at `:105-124` | Live file attributed 11 of 74 names. The remaining 63 read `unrecorded` — which per the file's own header is NOT evidence of a literal. Coverage is a function of the hand-maintained `_ENV_SUPPLIED` list (`:106-116`) **(measured pre-rebuild)** | verified-live |
| 12 | Write per-arm side files `/etc/substrate/llm-{opus,haiku,google}.env` (channel 4) | `gen-env.sh:820-825`; impl `:826-830`; consumed via `EnvironmentFile=-$ENV_DIR/llm-$id.env` at `render-llm-arms.sh:93` | A LATER `EnvironmentFile` than `/etc/substrate/env`, which is the only reason a per-arm `LLM_DEFAULT_MODEL` can beat the shared one | verified-in-code |
| 13 | entrypoint sources the generated file into its OWN environment: `set -a; . /etc/substrate/env; set +a` | `entrypoint.sh:22-27`, repeated `:61`; impl `:27, :61` | This is precisely why `/proc/1/environ` reports gen-env's OUTPUT as if it were the operator's INPUT — a silently overridden value is indistinguishable from an honoured one. Rationale restated at `substrate-config.sh:6-16` | verified-in-code |
| 14 | `apply-inventory` (vessel selection), then conditional federation-transport install, then `apply-llm-arms`; finally `exec /lib/systemd/systemd` | `entrypoint.sh:24-52, :54-72, :74-99, :101-102`; impl `apply-inventory.sh`, `apply-llm-arms.sh` | systemd becomes PID 1. It does not export its own environment to units, and NO unit carries `PassEnvironment` — so a name gen-env did not emit is invisible to every vessel regardless of how it was passed **(measured pre-rebuild)** | verified-live |
| 15 | Channel 2 — unit `Environment=` lines baked into the image | `docs/operations/CONFIGURATION_SURFACE.md:39-66`; impl `scripts/substrate/units/*.service`; e.g. `development-vessel.service:10-22`, `boredom-vessel.service` `Environment=BOREDOM_*` | Live: 52 distinct names across baked units, dominated by `PORT` (19) and `HOST` (18). Invisible to `substrate-config`, which reads channel 1 only. Doc's "52 names in channel 2" CONFIRMED live **(measured pre-rebuild)** | verified-live |
| 16 | Channel 3 — `.service.d/*.conf` drop-ins | `docs/operations/CONFIGURATION_SURFACE.md:82-84, :167`; impl `/usr/lib/systemd/system/*.service.d/*.conf` (from `scripts/substrate/units/*.service.d`, copied by `Dockerfile.substrate`) | Live: 29 drop-in directories, 34 `.conf` files, exactly 10 carrying `Environment=` (boredom watchdog, compose-teacher, development-vessel drain, discovery federation-peering, funnel-drain, gap-compose, goal-host drain + route-preference, llm-resolver stop-timeout, operator-goal-generator). Doc's "34 total, 10 carrying `Environment=`" CONFIRMED live **(measured pre-rebuild)** | verified-live |
| 17 | systemd merges channels: ALL `Environment=` directives (main unit + every drop-in, drop-ins last) are applied FIRST; then ALL `EnvironmentFile=` directives in listed order | `docs/operations/CONFIGURATION_SURFACE.md:67-69, :82-84, :90-103` — the doc places `.service.d/*.conf Environment=` BELOW `EnvironmentFile` in the chain and calls it "applied last, beats everything"; impl = systemd unit-loading semantics, measured at the consuming layer | MEASURED, both halves — see bullets. The doc's placement of channel 3 in the precedence chain is FALSE for any name gen-env also emits **(measured pre-rebuild)** | doc-code-mismatch |
| 18 | Channel 4 — additional per-unit `EnvironmentFile`s, which as the LATER file outrank `/etc/substrate/env` | `docs/operations/CONFIGURATION_SURFACE.md:44-48` (names only `llm-<arm>.env` and `.substrate-secrets`); impl `render-unit.sh:72-73` (every DYNAMIC vessel); baked units `development-vessel.service:9`, `git-push-setup.service:11`, `federation-transport-vessel.service:8`, `development-vessel-seed.service:38`; `render-llm-arms.sh:93` | For those units `/workspace/.substrate-secrets` is the last-word channel, not `/etc/substrate/env`. Three MORE channel-4 members exist that the doc does not name and that NOTHING in the tree writes: `/etc/substrate/concept-db.env` (`concept-db.service:13`), `/etc/substrate/ribosome-vessel.env` (`ribosome-vessel.service:11`), `/etc/substrate/local-tools-vessel.service.env` (`local-tools-vessel.service:12`) | known-broken |

- **Step 1 evidence (pre-rebuild).** `docker exec substrate-live sed -nE 's/^([A-Z_][A-Z0-9_]*)=.*/\1/p' /etc/substrate/env | wc -l` → 74; `sort -u | wc -l` → 74.
- **Step 2 evidence (pre-rebuild).** `substrate-config`: `DISCOVERY_ENDPOINT unrecorded http://127.0.0.1:8100`; `HUB_DISCOVERY_URL unrecorded` (empty).
- **Step 3 evidence (pre-rebuild).** `docker exec substrate-live cat /etc/substrate/env.provenance` → 11 attributed names, `ANTHROPIC_API_KEY=env`, the rest `persisted`.
- **Step 6 evidence (pre-rebuild).** `substrate-config`: `TRACE_STORE_CAP unrecorded 150000`; `EMBEDDING_PRIOR_ENABLED unrecorded true`.
- **Step 8 evidence (pre-rebuild).** Live env lacks `PROFILE`/`ENABLED_ROLES`/`ENABLED_VESSELS`/`DISABLED_VESSELS`/`MAX_PEER_DEPTH`/`PUBLIC_IP`; `scripts/substrate/config-surface-baseline.txt:1,6,11` all read `emitted=80`.
- **Step 11 evidence (pre-rebuild).** `substrate-config` output: 74 rows, 11 attributed, 63 `unrecorded`. The `_ENV_SUPPLIED` list omits e.g. `SURREALDB_URL`, `REDIS_URL`, `MITOSIS_RUNTIME_DIR`, `WORKSPACE_ROOT`, `LOCAL_TOOLS_VESSEL_API_KEY`.
- **Step 14 evidence (pre-rebuild).** Live channel-1 delivery is via `EnvironmentFile` only: `systemctl show discovery-vessel -p EnvironmentFiles` → `/etc/substrate/env (ignore_errors=no)`.
- **Step 15 evidence (pre-rebuild).** `docker exec substrate-live sed -nE 's/^Environment=([A-Z_][A-Z0-9_]*)=.*/\1/p' /usr/lib/systemd/system/*.service | sort | uniq -c` → 52 distinct names.
- **Step 16 evidence (pre-rebuild).** `ls /usr/lib/systemd/system/*.service.d/*.conf | wc -l` → 34; loop printing files with `Environment=` → 10.
- **Step 17 measurement (pre-rebuild), both halves.** (a) drop-in `Environment=` BEATS main-unit `Environment=` — boredom-vessel's main unit sets `BOREDOM_MIN_DISPATCH_INTERVAL_MS=2000`, its `watchdog.conf` sets `600000`, and the merged directive list shows `600000` (and `IDLE_WINDOW` 1800 over 300). (b) `EnvironmentFile=/etc/substrate/env` BEATS drop-in `Environment=` — discovery-vessel's `federation-peering.conf` sets `PEER_DISCOVERY_ENDPOINTS=http://138.197.116.56:18100`, `/etc/substrate/env` carries `http://syzygy.host:18100`, and the RUNNING PROCESS (pid 1038) held `syzygy.host`.
- **Step 17 evidence (pre-rebuild).** `systemctl show discovery-vessel -p Environment` → `PEER_DISCOVERY_ENDPOINTS=http://138.197.116.56:18100`; `tr '\0' '\n' < /proc/1038/environ` → `PEER_DISCOVERY_ENDPOINTS=http://syzygy.host:18100`. Control: `systemctl show boredom-vessel -p Environment` → `BOREDOM_MIN_DISPATCH_INTERVAL_MS=600000`, and `BOREDOM_*` appears in NO `EnvironmentFile` (`sed -n /BOREDOM/p /etc/substrate/env | wc -l` → 0).
- **Step 18 evidence.** Positive control: `llm-opus.env` has a writer at `gen-env.sh:826`. The three undocumented members have zero matches anywhere in the repo — `rg -n 'concept-db\.env'` over the tree → only the unit line, a seed-identity console message, and an openspec task marked `[x]` whose gen-env block was never written.

**End state.** Each vessel process holds an environment resolved as: unit `Environment=` < drop-in `Environment=`
< `EnvironmentFile=/etc/substrate/env` < any later `EnvironmentFile` (`llm-<arm>.env`, `.substrate-secrets`) <
post-boot mutation. 74 names arrived via channel 1 on the audited deployment; 52 more exist only in channel 2 with
no operator delivery path.
**How to verify it actually worked.** Never `systemctl show -p Environment` (that is the directive list, not the
effective env). Fingerprint the process:
`tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value <unit>)/environ`. Cross-check provenance with
`substrate-config --container <c> <FILTER>`.

---

### F9-P2 — Answering "did my value win, and if not what beat it?"

**Purpose.** Make a silently discarded configuration value visible, since `/proc/1/environ` structurally cannot
answer it.
**Trigger.** Operator suspects a supplied value did not take effect.
**Preconditions.** `/etc/substrate/env` readable; `/etc/substrate/env.provenance` present (absent on images
predating provenance → every source reads `unknown`).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `docker exec substrate-live substrate-config` (or `substrate-config --container <c> [FILTER] [--json] [--unmask]`) | `substrate-config.sh:33-57`; impl `:112-154` | Live: printed 74 rows with masked secrets. Ran clean **(measured pre-rebuild)** | verified-live |
| 2 | Read the source column: `env` \| `persisted` \| `generated` \| `derived` \| `hardcoded` \| `unrecorded` \| `unknown` | `substrate-config.sh:42-51`; impl `:105-107` (`prov_of`), `:126-140` | `unrecorded` correctly means "nothing attributed this", NOT "hardcoded" — the earlier defect that reported every freshly-minted secret as hardcoded is fixed (`:128-138`). Live: 63 of 74 rows are `unrecorded`, so for most of the surface this tool cannot answer the question it exists to answer **(measured pre-rebuild)** | verified-live |
| 3 | Read the trailing "A hardcoded source means…" footer only when a hardcoded row is on screen | `substrate-config.sh:165-169`; impl `:170-172` (`saw_hardcoded` gate) | Live: no footer printed — correct, since no row was `hardcoded` (`API_KEY_SECRET` came from the persisted store, not the `ALLOW_INSECURE` branch) **(measured pre-rebuild)** | verified-live |
| 4 | KNOWN LIMIT — the tool reads channel 1 and its provenance sidecar ONLY | `docs/operations/CONFIGURATION_SURFACE.md:50-54`; impl `substrate-config.sh:26-27` (`ENV_FILE` / `PROV_FILE`), `:76, :82` | Channels 2, 3 and 4 are invisible to it. Live consequence: it prints `PEER_DISCOVERY_ENDPOINTS=http://syzygy.host:18100` (correct — it wins) while a drop-in carrying a DIFFERENT value sits unmentioned; and it prints nothing at all about the 52 channel-2 behavioural knobs **(measured pre-rebuild)** | verified-live |

- **Step 1 evidence (pre-rebuild).** `docker exec substrate-live substrate-config` → `74 variable(s). Secrets masked; --unmask to reveal.`
- **Step 2 evidence (pre-rebuild).** 11 attributed rows in `env.provenance` against 74 rows printed.

**End state.** An operator can attribute ~15% of the emitted surface positively; the rest reads `unrecorded`, and
three of four channels are outside the instrument's field of view.
**How to verify it actually worked.** Compare two independently-built fleets: differing values for an
`unrecorded` name prove it was generated, not hardcoded (the method `substrate-config.sh:130-133` records).

---

### F9-P3 — Re-deriving the surface and regression-guarding it (config-surface-probe)

**Purpose.** Measure, at gen-env's output, what each launch lane actually delivers — and fail on drift from a
recorded baseline.
**Trigger.** Documented as a pre-commit check. **NOTHING invokes it.**
**Preconditions.** docker present and the image `ghcr.io/avigopal/substrate:dev` present locally; a
docker-shareable scratch dir (defaults beside the repo, deliberately not `/tmp`);
`scripts/substrate/.env.example` present (UNOFFERED input) — verified present, 16552 bytes; `docker-compose.yml`
at repo root (compose-lane input) — verified present.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `scripts/substrate/config-surface-probe.sh` | `docs/operations/CONFIGURATION_SURFACE.md:223-226`; impl `config-surface-probe.sh:360-366` | NOT RUN — the probe launches throwaway containers that write inside themselves, outside this audit's read-only allowance. Assessed by reading | unverifiable-here |
| 2 | Extract each lane's variable list from source, never a restated copy: `run-live` / `run-live-obsidian` from the Makefile recipe's `-e` flags, compose from `docker-compose.yml`'s `environment:` block | `config-surface-probe.sh:117-121`; impl `:122-149` | Baseline records `offered = 45 / 45 / 40`, matching doc §4 | verified-in-code |
| 3 | Run the WORKTREE's gen-env inside a throwaway container with every lane name set to a sentinel (`PROBEVAL_*`; JSON sentinels for `VLLM_ENDPOINTS` and `LLM_ARMS`) | `config-surface-probe.sh:85-107, :185-197`; impl `:198-219`; `PROBE_USE_IMAGE=1` switches to the baked copy | Guards the "reads one artifact, exercises another" defect the doc calls the general form (§6.3) | verified-in-code |
| 4 | Harness self-checks: fail if the workdir is unusable; fail if `rc!=0` or no `===ENV===` marker; keep stderr | `config-surface-probe.sh:74-83, :221-224`; impl `:81-82`, `:225-229` (exit 2 FATAL) | Closes both prior lies (a swallowed "mounts denied" reported as zero names; a dead HARDCODED check still printing "matches baseline") | verified-in-code |
| 5 | Judge DROPPED (lane passes it, gen-env never emits it), HARDCODED (emitted, sentinel replaced by a literal), MANGLED (marker intact, value not byte-identical — scoped to JSON names), UNOFFERED (`.env.example` documents it, this lane never passes it), PHANTOM (a `persisted_secret` read with no matching write) | `docs/operations/CONFIGURATION_SURFACE.md:236-244`; impl DROPPED `:251-270`, HARDCODED `:272-284, :322-325`, MANGLED `:286-320`, UNOFFERED `:329-356`, PHANTOM `:383-399` | HARDCODED judges only sentinel-carrying names (`:279-283`), excluding the probe's own 10 abstentions. MANGLED reads at the CONSUMING layer (`env -i sh -c 'set -a; . /etc/substrate/env'`, `:212-218`), not off the raw file text | verified-in-code |
| 6 | Diff the summary against `scripts/substrate/config-surface-baseline.txt`; exit 1 on drift | `config-surface-probe.sh:404-441`; impl `:406-437` | Baseline (16 lines, last written at commit `fd9d1102`, 2026-08-22) records `emitted=80` for all three lanes and EMPTY dropped/hardcoded/unoffered/mangled lists plus `phantom=0`. That is the clean state; nothing has re-measured it since | verified-in-code |
| 7 | Have something invoke it | `docs/operations/CONFIGURATION_SURFACE.md:277-281` ("The remaining step, unbuilt: this probe is a script, so it is still only as good as the habit of running it. Under law 2 the check belongs to an activity the loop can grade."); impl: none | CONFIRMED with a whole-tree search: no hook, no CI workflow, no Makefile target, no unit invokes `config-surface-probe.sh`. Its only self-references are its own usage text. Under this repo's own script-retention convention ("a check nothing invokes cannot be trusted when it passes, because it is never observed failing"), the instrument built to close the config-surface feedback gap is itself in that gap | known-broken |

- **Step 2 evidence.** `scripts/substrate/config-surface-baseline.txt:1,6,11`.
- **Step 6 evidence.** `scripts/substrate/config-surface-baseline.txt:1-17`; `git log -1 --date=short fd9d1102` → 2026-08-22.
- **Step 7 evidence.** `rg -n 'config-surface-probe'` over the repo excluding `node_modules` and `*.md` → only `scripts/substrate/config-surface-probe.sh`'s own lines 2, 39, 40, 41, 42, 435 and a `Makefile:159` comment. `warn-baseline-drift.sh` is unrelated (vessel image baseline).

**End state.** A correct, well-guarded instrument exists and is not wired to anything; the recorded baseline is
the standing evidence and it is two days old relative to the audit window.
**How to verify it actually worked.** `rg -n 'config-surface-probe' .githooks .github scripts` must return a
caller other than the script itself before any "matches baseline" claim can be trusted as current.

---

### F9-P4 — Post-boot mutation and the persistence round trip

**Purpose.** Replace the bootstrap credential with the identity-vessel-issued key in BOTH config files, and keep
every durable value across a `docker rm` + recreate.
**Trigger.** `identity-seeder.service` after identity-vessel is up; then any subsequent gen-env run.
**Preconditions.** `METABOB_API_KEY` and `JWT_SECRET` present in the unit environment; `/etc/substrate/env`
writable (mode 600, root).

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `seed-identity` signs up, then rewrites `METABOB_API_KEY` in `/etc/substrate/env` AND `/workspace/.substrate-secrets` | `docs/operations/CONFIGURATION_SURFACE.md:102` ("post-boot mutation (seed-identity.ts rewrites METABOB_API_KEY in both files)"); impl `seed-identity.ts:142-148` (loop over both files), `:242-260` (`writeFileSync` mode `0o600`), `:81` (reads the current value back out of `/etc/substrate/env`) | Doc claim CONFIRMED against the implementation. Live evidence of the outcome: `METABOB_API_KEY` is 160 chars with an `mb-` prefix (an issued key), not the 32-char alphanumeric gen-env would have minted at `:257` **(measured pre-rebuild)** | verified-live |
| 2 | `seed-identity` additionally upserts `SUBSTRATE_ADMIN_KEY`, which gen-env never generates and only round-trips | `gen-env.sh:266-271`; impl `seed-identity.ts:269-272` (`upsertEnvVar`); `gen-env.sh:272` reads it back | Live: `SUBSTRATE_ADMIN_KEY` persisted, `mb-` prefix, 160 chars. Both halves (read + write) present **(measured pre-rebuild)** | verified-live |
| 3 | Next boot: gen-env re-reads each name field-by-field from `.substrate-secrets` and re-emits | `gen-env.sh:50-61`; impl `:126-133` | Works. Live proof that the round trip is closed for the once-broken names: `API_KEY_SECRET_PREVIOUS` now both read (`:227`) and written (`:953`); `ENABLED_EXTRA_VESSELS` read (`:140`) / written (`:964`); `GITHUB_TOKEN` read (`:620`) / written (`:958`); `LLM_DEFAULT_MODEL` read (`:584`) / written (`:959`) | verified-in-code |
| 4 | KNOWN LIMIT — `${VAR:-…}` cannot distinguish unset from explicitly emptied, so `-e VAR=` does NOT clear a persisted value | `docs/operations/CONFIGURATION_SURFACE.md:125-130`; `gen-env.sh:470-476` ("Verified."); impl: every `persisted_secret` call site in `gen-env.sh` | Shared by all ~20 persisted names. Clearing one means hand-editing `/workspace/.substrate-secrets` — a file gen-env rewrites every boot. The Makefile's `RECREATE_CARRY_PRESENT` (carry by presence, not value) is the stated fix and has NOT been applied inside gen-env | documented-only |
| 5 | Second writer: `secrets.env.sh` persists its own six keys, merging rather than truncating | `secrets.env.sh:46-65`; impl `:66-91` | The 2026-08-08 un-restartable-hub incident (`API_KEY_SECRET` destroyed by whichever writer ran last) is closed on BOTH sides — `gen-env.sh:1000-1019` and `secrets.env.sh:82-86` both carry unknown keys through | verified-in-code |

- **Step 1 evidence (pre-rebuild).** `substrate-config`: `METABOB_API_KEY persisted mb-b3J…` (160 chars).
- **Step 2 evidence (pre-rebuild).** `substrate-config`: `SUBSTRATE_ADMIN_KEY persisted mb-b3J…` (160 chars).

**End state.** Both config files carry the identity-issued key; ~20 names survive a recreate; none of them can be
cleared through the env channel.
**How to verify it actually worked.** Fingerprint the PROCESS, not the file:
`tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value <unit>)/environ | rg METABOB_API_KEY` — for the four
units carrying the later `EnvironmentFile=-/workspace/.substrate-secrets`, updating only `/etc/substrate/env`
lets the secrets file re-inject a stale key every boot.

---

### F9-P5 — Law-1 violation inventory: behavioural knobs frozen in env or in code

**Purpose.** Enumerate the knobs that steer BEHAVIOUR rather than bootstrap. Law 1 permits env only for secrets,
ports and identity; everything else must be a shaped impulse read at use time, observable in the trace of the
execution that consumed it. None of the following is.
**Trigger.** Standing — this is the audit deliverable, not a runtime process.
**Preconditions.** Tier definition: `docs/operations/CONFIGURATION_SURFACE.md:133-142`. Freezing rule: ALL env is
frozen at process start; the module-load-const vs function-body distinction (doc `:146-151`) governs whether a
RESTART suffices and whether a shape refactor is cheap — **not** whether a running process can see a change.

| # | Action | Source / impl | Outcome | Status |
|---|---|---|---|---|
| 1 | `ROUTE_EDIT_INTENT_TO_COMPOSE` — the autonomous edit-landing kill switch | `gen-env.sh:575-578`; delivered by `Makefile:618,699`; impl `repos/goal-host-vessel/src/index.ts:11191, :11645, :11706` — all three inside function bodies (read at use time) | Gates whether a goal naming a `repos/<vessel>/src` file routes to `feature_compose` (lands a traced commit) or to intent-only. Pure behaviour, invisible to the walk. Live: emitted EMPTY, so `!== "0"` is true and autonomous edit landing is ON. Confirmed at the consuming layer **(measured pre-rebuild)** | verified-live |
| 2 | `MITOSIS_DIRECT_PUSH` — commit+push+mirror vs record-an-intent-nothing-consumes | `gen-env.sh:625-637` (default 1); impl `gen-env.sh:637` AND `scripts/substrate/units/development-vessel.service:19` — set in TWO channels; the `EnvironmentFile` value wins (one of the four collisions the doc names at `:79-80`) | Decides whether substrate-authored fixes reach `origin/dev` at all. Live: 1 (permissive). This is the second autonomy safety switch and it is an env var, not a shape **(measured pre-rebuild)** | verified-live |
| 3 | `TRACE_RETENTION_ENABLED` / `_DRY_RUN` / `_DEFAULT_SUCCESS_CAP` / `_DEFAULT_FAILURE_CAP` / `TRACE_STORE_CAP` / `TRACE_RETENTION_GLOBAL_CEILING_ENABLED` / `TRACE_STORE_HOT_WINDOW_DAYS` / `TRACE_STORE_RESERVOIR_PER_ACTIVITY` — eight knobs deciding which traces the learning substrate keeps | `gen-env.sh:714-749` (fixed literals) + the pinned-notice list at `:494-499`; impl `repos/activity-api/src/services/trace-retention.ts:145` (`env.TRACE_RETENTION_ENABLED === 'true'`) — takes env as an INJECTABLE PARAMETER, which doc `:152-155` cites as the precedent to follow | Retention policy is what the loop is allowed to learn from — the most behavioural family on the surface, and the LEAST settable: pinned literals that print a NOTE and discard the operator's value. Live: 600/2000/150000/3/25, all `unrecorded` **(measured pre-rebuild)** | verified-live |
| 4 | `EMBEDDING_PRIOR_ENABLED` / `EMBEDDING_PRIOR_OBSERVER_ENABLED` — which prior-seeding path Thompson posterior-update takes, and whether the continuous-training observer runs | `gen-env.sh:700-712` (literals `true` / `false`); pinned at `:496`; impl referenced as the M1 mechanism at `repos/development-vessel/src/seed/mechanism-health-tick.ts:14, :70, :171` | Gates the LEARNING MECHANISM ITSELF from outside the learning loop — the sharpest law-1 instance in the set. Also pinned, so not settable **(measured pre-rebuild)** | verified-live |
| 5 | `COMPOSE_MAX_CONCURRENT` — the compose-slot cap; at 0 it inverts the lanes (directed 0 / autonomous 1) | `validation/reports/BRINGUP_THREE_PATHS.md:953`; impl `repos/development-vessel/src/compose-slots.ts:106` inside `capFromEnv()` — read at use time, default 2 | NO DELIVERY PATH through any documented channel: gen-env never emits it, no unit or drop-in sets it, and the running development-vessel process carried zero occurrences. It CAN still reach dev-vessel by hand-writing a line into `/workspace/.substrate-secrets` (`development-vessel.service:9` loads it as the LATER `EnvironmentFile`, and gen-env's merge at `:1000-1019` would carry an unrecognised key through) — an undocumented back door, not a supported lane **(measured pre-rebuild)** | known-broken |
| 6 | `ADMISSION_CAP` — NOT an env var. An in-code const | named in the audit brief as an env knob; impl `repos/activity-api/src/services/discover-by-shapes.ts:196` `const ADMISSION_CAP = 1000;` (`:197` `admissionLimit`); mirrored by comment at `repos/activity-api/src/db/paradigm.ts:792, :823` | Bounds which producers reach the Thompson draw at all — a selection-policy decision. As a compiled-in constant it is a law-1 violation of the WORSE kind: not merely unobservable by the walk, but unsettable without a rebuild+redeploy. Its own comment records it being raised 200→1000 after ~322 `patch_proposal` producers never reached the draw | verified-in-code |
| 7 | Channel-2 autonomy knobs with NO operator delivery path: `TASK_GENERATION_ENABLED`, `OPERATOR_GOAL_GEN`, `EMIT_GAPS`, `RECOVER_CAP`, `SURGICAL_SCAN_CAP`, `SURGICAL_SCAN_REPOS`, `SELF_DEV_TREND`, `REPAIR`, `DB_MAINTENANCE`, `AUTO_DESCRIBE_RESOLVERS`, `GOAL_HOST_BEHAVIOR_WINDOW_HOURS`/`_LIMIT`, `GOAL_HOST_WS_SUBSCRIBER`, `OBSIDIAN_LEARN_MODE`/`_MAX`/`_GRANT` | `docs/operations/CONFIGURATION_SURFACE.md:62-66` ("52 names in channel 2, of which 48 appear nowhere else … Tier-1 settings stuck in a tier that has no delivery path"); impl `repos/activity-api/src/index.ts:936`, `scripts/substrate/operator-goal-generator.ts:39`, `scripts/substrate/self-operational-health.ts:38`, `scripts/substrate/coherence-recover.ts:23`, `scripts/substrate/surgical-gap-scan.ts:63`, `repos/goal-host-vessel/src/index.ts:15775`, `scripts/substrate/obsidian-learn-tick.sh:10` | Every one gates whether a self-development behaviour runs, or how much of it runs. All are baked image literals with no operator channel and no provenance record. `TASK_GENERATION_ENABLED` and `GOAL_HOST_WS_SUBSCRIBER` are module-load consts (column 0), so even a delivered change needs a restart | verified-in-code |
| 8 | Channel-3 `BOREDOM_*` pacing — a law-5 violation specifically, not just law-1 | CLAUDE.md law 5 ("Cadence lives in the pool as time-shaped rhythm impulses the selector reads, not in static intervals, timers, or concurrency clamps"); doc `:82-84` cites "240×–300× the in-code default"; impl `repos/boredom-vessel/src/index.ts:2096` `const MIN_DISPATCH_INTERVAL_MS = parseInt(process.env["BOREDOM_MIN_DISPATCH_INTERVAL_MS"] ?? "2000", 10)` — column-0 const, frozen at module load; overridden by `/usr/lib/systemd/system/boredom-vessel.service.d/watchdog.conf` | Live ratios measured: 600000/2000 = 300× on `MIN_DISPATCH_INTERVAL`, 1800/300 = 6× on `IDLE_WINDOW`. Doc's "240×–300×" CONFIRMED at the upper bound. Autonomous cadence is set by a systemd file no impulse can observe **(measured pre-rebuild)** | verified-live |
| 9 | Channel-3 `WATCHDOG_*` (`FLOW` / `RELEVANT_SHAPE` / `ROUTE_FILTER` / `STALL_MIN` / `ACTIVITY_PATHS` / `RESTART_IMPULSE`) across four drop-ins, and `PREFER_LIBP2P_ROUTE` | `/usr/lib/systemd/system/{compose-teacher,funnel-drain,gap-compose,operator-goal-generator}.service.d/watchdog.conf`; `goal-host-vessel.service.d/federation-route-preference.conf`; impl `scripts/substrate/watchdog-tick.ts:41` (`ROUTE_FILTER = process.env.WATCHDOG_ROUTE_FILTER ?? "any"`); `repos/goal-host-vessel/src/index.ts:3836, :6594` | `WATCHDOG_RELEVANT_SHAPE=substrateGap` and `WATCHDOG_ROUTE_FILTER=composable` are literally shape-routing decisions expressed as systemd file lines. `PREFER_LIBP2P_ROUTE=1` was live in the goal-host process and flips transport selection at two call sites. Both are read at use time — i.e. cheap to convert to shapes, and not converted **(measured pre-rebuild)** | verified-live |
| 10 | `PEER_FANOUT_MODE`, `MAX_PEER_DEPTH` — resolve-time discovery fan-out policy | `gen-env.sh:459, :477`; impl `repos/discovery-vessel/src/index.ts:59` (column-0 const, frozen) used at `:255` | Whether a resolve unions peer results is routing behaviour. Frozen at module load, so even a correct value change needs a restart. Live: `union` / `1` **(measured pre-rebuild)** | verified-live |
| 11 | LEGITIMATE Tier-0, for contrast so the violation list is not read as "everything": `JWT_SECRET`, `SURREAL_PASS`, `API_KEY_SECRET`(+`_PREVIOUS`), `METABOB_API_KEY`, `SUBSTRATE_ADMIN_KEY`, all provider `*_API_KEY`, `GITHUB_TOKEN`, `SUBSTRATE_GIT_PAT`, `FEDERATION_SIGNING_SECRET`, `SURREALDB_*` + `REDIS_URL`, every `*_ENDPOINT` / `*_URL` alias, `FED_SUBSTRATE_ID` / `FED_VESSEL_ID` / `RELAY_MULTIADDR`, `SUBSTRATE_ROOT` / `WORKSPACE_ROOT` / `SUBSTRATE_RUN_DIR` / `MITOSIS_RUNTIME_DIR` / `MITOSIS_PUSH_CLONE_DIR` / `EMBEDDING_MODEL_DIR`, channel-2 `PORT`/`HOST`/`VESSEL_ID`/`VESSEL_ENDPOINT` | `docs/operations/CONFIGURATION_SURFACE.md:135-138`; impl n/a | Credential, network location, data location, identity — frozen by nature, must fail closed, cannot be graded. Roughly 50 of the 74 live channel-1 names | verified-in-code |

- **Step 1 evidence (pre-rebuild).** `tr '\0' '\n' < /proc/54036/environ` → `ROUTE_EDIT_INTENT_TO_COMPOSE=[]` (present, empty).
- **Step 2 evidence (pre-rebuild).** `substrate-config`: `MITOSIS_DIRECT_PUSH unrecorded 1`.
- **Step 3 evidence (pre-rebuild).** `substrate-config`: `TRACE_STORE_CAP unrecorded 150000`; `TRACE_RETENTION_DEFAULT_SUCCESS_CAP unrecorded 600`.
- **Step 5 evidence (pre-rebuild), with control.** `sed -n /COMPOSE_MAX_CONCURRENT/p /etc/substrate/env` → no match (control: the same `sed` on `METABOB_API_KEY` matched); the same over all units/drop-ins → no match; `tr '\0' '\n' < /proc/<dev-vessel-pid>/environ | sed -n /COMPOSE_MAX/p | wc -l` → 0.
- **Step 8 evidence (pre-rebuild).** `boredom-vessel.service` `Environment=BOREDOM_MIN_DISPATCH_INTERVAL_MS=2000` vs `watchdog.conf` `600000`; `systemctl show boredom-vessel -p Environment` → `600000`. The drop-in's own comment says "autonomous dispatch slows ~12x" — the delivered ratio is 300×, and the comment's own 2s→10min arithmetic *is* the 300× figure, so the "~12x" number disagrees with its own example.
- **Step 9 evidence (pre-rebuild).** `tr '\0' '\n' < /proc/54036/environ` → `PREFER_LIBP2P_ROUTE=[1]`.

**End state.** At least 30 distinct behavioural knobs steer this substrate from outside anything the walk or a
trace can observe: ~13 in channel 1 (8 of them PINNED and therefore unsettable), ~15 in channel 2 with no operator
delivery path at all, ~10 in channel 3 including the entire autonomous-dispatch cadence, plus at least one
compiled-in constant (`ADMISSION_CAP`) and one knob (`COMPOSE_MAX_CONCURRENT`) with no supported delivery path in
either direction.
**How to verify it actually worked.** For any candidate: (a) confirm the read site is in a function body, not a
column-0 const — that decides whether shaping it is a refactor or a rewrite; (b) confirm gen-env emits it, or it
cannot be delivered at all; (c) confirm the value in `/proc/<pid>/environ`, not in the file.

---

### Traps (config)

| Trap | Where | Why invisible | How to detect | Severity |
|---|---|---|---|---|
| A drop-in `Environment=` silently overridden by `/etc/substrate/env` — and `systemctl show -p Environment` displays the drop-in's value, so the standard check CONFIRMS an override that is not happening | `discovery-vessel.service.d/federation-peering.conf` (`PEER_DISCOVERY_ENDPOINTS`, `MAX_PEER_DEPTH`, `PEER_FANOUT_MODE`); structurally, any drop-in name gen-env also emits | `systemctl show -p Environment` reports the MERGED DIRECTIVE LIST, not the effective process environment | `tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value <unit>)/environ \| rg '<NAME>='`, diffed against `systemctl show <unit> -p Environment` | high |
| Three per-vessel `EnvironmentFile`s that NOTHING in the tree writes, declared with `-` so systemd skips them without a word | `units/concept-db.service:13` (`/etc/substrate/concept-db.env`), `ribosome-vessel.service:11`, `local-tools-vessel.service:12` | `EnvironmentFile=-<path>` means "ignore if absent"; the unit reads as if a per-vessel override channel exists | `rg -n '<name>\.env'` over the whole tree and require a WRITER, not a reader | medium |
| `FEDERATION_SIGNING_SECRET` is declared, generated, persisted, manifest-wired, materialised by vessel-ctl, injected by deploy-remote, emitted into `/etc/substrate/env` — and read by zero TypeScript | `secrets.env.sh:37-42`; `vessels.manifest.json:50-51`; `gen-env.sh:479, :858, :993` | Every layer an operator can inspect reports success; synchronising it across a fleet "works" and changes nothing | `rg -c --glob '*.ts' FEDERATION_SIGNING_SECRET repos packages scripts` → 0 | medium |
| `HUB_API_KEY` is read at three call sites and emitted by nothing; both its fallbacks are also empty in-container | `federation-relay/federation-transport-server.ts:40` (`process.env.HUB_API_KEY \|\| API_KEY`), `repos/discovery-vessel/src/index.ts:57`, `repos/goal-host-vessel/src/index.ts:4753` | The `\|\| API_KEY` fallback reads as a safety net, but gen-env emits no bare `API_KEY` either | Confirm against the emitted set, not the source: no `API_KEY=` and no `HUB_API_KEY=` line among the 74 live names | high |
| `secrets.env.sh` `source`s the persisted secrets file BEFORE its own `${VAR:-…}` fallbacks — inverting precedence so a persisted value clobbers an operator-supplied one, on the vessel-ctl install path | `secrets.env.sh:17-20`, consumed at `vessel-ctl.sh:230` | This is the EXACT hazard `gen-env.sh:280-288` documents avoiding by grepping field-by-field; the sibling file still does it | `docker exec -e METABOB_API_KEY=<new> <c> vessel-ctl install <manifest-vessel>`, then fingerprint the resulting unit's process env | high |
| gen-env's round-trip check WARNS and continues; an unparseable `/etc/substrate/env` boots the fleet with every variable after the bad line silently absent | `gen-env.sh:888-905` — `_rt_fail` is incremented, printed, never used to exit | `EnvironmentFile=` and every `. /etc/substrate/env` stop at the bad line, so later variables vanish with no error at the consuming layer | `docker exec <c> env -i sh -c 'set -a; . /etc/substrate/env'; echo $?`, plus an emitted-name count against the expected 72–80 range | medium |
| `-e VAR=` does not clear a persisted value; the operator's explicit empty is indistinguishable from unset | every `persisted_secret` call site in `gen-env.sh` (~20 names); documented at `gen-env.sh:470-476` and doc §2:125-130 | Docker accepts the flag, the process receives it, and `${VAR:-…}` treats empty exactly like unset — the launch reports success | Read the emitted value back (`substrate-config <NAME>`) after the launch, never the launch's own output | medium |
| The probe's UNOFFERED section — the only axis that can see a knob no lane passes — silently degrades to an empty result if `.env.example` is missing, and empty is indistinguishable from clean | `config-surface-probe.sh:342-356` — the `else : > "$WORK/$lane.unoffered"` branch at `:354-355` | The baseline records `lane=<x> unoffered=` (empty) for all three lanes; that line reads identically whether the check found nothing or never ran | Assert the input exists before trusting the output | low |
| The single instrument for this whole family has no caller, so it can never be observed failing | `scripts/substrate/config-surface-probe.sh` | The baseline file in git looks like evidence of a passing check; it is a snapshot from `fd9d1102` (2026-08-22) that nothing has re-run | `rg -n 'config-surface-probe' .githooks .github scripts Makefile` — today the only hits are the script's own usage lines and one Makefile comment | high |

- **Drop-in trap, measured (pre-rebuild).** Directive list said `138.197.116.56`; the process said `syzygy.host`. A prior report ran exactly the `systemctl show` check, saw the drop-in value, recorded "Confirmed live" — and that wrong-layer confirmation propagated into the doc's precedence chain.
- **Unwritten-EnvironmentFile trap.** An openspec task (`2026-05-23-substrate-explicit-vessels/tasks.md:54-57`) that would have created the gen-env block is marked `[x]` and the block is not in `gen-env.sh`. `seed-identity.ts:290` even tells the operator to "set `CONCEPT_DB_API_KEY` in `/etc/substrate/env` or `concept-db.env`" — advising a file with no writer. Positive control: `llm-opus.env` resolves to `gen-env.sh:826`; these three resolve only to their own unit line.
- **`FEDERATION_SIGNING_SECRET` trap.** Peer trust is actually enforced by identity-vessel issuance. Positive control on the same query shape: `PEER_FANOUT_MODE` → 2 hits in `repos/discovery-vessel/src/index.ts`, so the query is sound.
- **`HUB_API_KEY` trap.** gen-env emits `METABOB_API_KEY` and four `*_VESSEL_API_KEY` aliases, no bare `API_KEY`. The transport therefore sends `Authorization: ApiKey ` with an empty credential, and the failure surfaces as a 401 at the hub, far from the config defect. Doc §5:205-209 states the same class for the other dead aliases.
- **`-e VAR=` trap.** The stated workaround is hand-editing `/workspace/.substrate-secrets` — a file gen-env rewrites every boot. Un-peering a substrate or rotating away a provider key by this route silently does nothing.
- **UNOFFERED trap.** Doc §6:241 records that BOTH autonomy kill switches once hid in exactly this section. Inputs verified present today: `scripts/substrate/.env.example` (16552 bytes) and `docker-compose.yml` at repo root. The probe would be improved by a FATAL on a missing `.env.example`, matching the workdir guard it already has at `:81-82`.

### Contradictions (config)

| Claim A | Claim B | Which is right | Evidence |
|---|---|---|---|
| doc `:82-84`, `:90-103`: ".service.d/*.conf `Environment=` (applied last, beats everything)" / "Channel 3 is the exception that does override"; same claim at `BRINGUP_THREE_PATHS.md:919` ("a drop-in `Environment=` is applied after `EnvironmentFile=`, so it beats gen-env. Confirmed live.") | The running process holds the `/etc/substrate/env` value, not the drop-in value | **B.** systemd applies ALL `Environment=` FIRST, then ALL `EnvironmentFile=`. Drop-ins beat the MAIN UNIT — the doc's stated reason is correct — but lose to any `EnvironmentFile`. The `federation-peering` drop-in is therefore INERT for all three names it sets | discovery-vessel pid 1038 (`NRestarts=0`, active): drop-in `138.197.116.56`, env file `syzygy.host`, `/proc/1038/environ` → `syzygy.host` **(measured pre-rebuild)** |
| `secrets.env.sh:8-11`: "Consumed two ways: 1. gen-env.sh sources this … 2. vessel-ctl.sh sources this when installing a vessel." | gen-env.sh sources nothing | **B.** Consumer #1 in the file's own header does not exist. Only `vessel-ctl.sh:230` sources it | `rg -n '^\s*(source\|\.)\s' scripts/substrate/gen-env.sh` → no matches; `rg -n 'secrets.env'` across `scripts/` and Dockerfile → the only `source` is `vessel-ctl.sh:230`; `Dockerfile.substrate:253` merely COPYs it |
| The audit brief lists `ADMISSION_CAP` among the env vars to check for law-1 violation | `ADMISSION_CAP` is not an environment variable anywhere in the system | **B**, and the correction makes it WORSE not better — a compiled-in constant is unobservable to the walk *and* unsettable without a rebuild+redeploy | `rg -n ADMISSION_CAP repos/*/src scripts packages` → `discover-by-shapes.ts:196,197` and `paradigm.ts:792,823` (comments). Zero `process.env` references |
| `gen-env.sh:966-967`: "this heredoc OVERWRITES the file, so every durable secret MUST be listed here or it is lost on the next gen-env run" | The heredoc writes to a `mktemp` and is merged; keys this revision does not emit are carried through | **B.** The comment 35 lines above is stale and states the rule the merge was written to abolish | `gen-env.sh:926` (mktemp), `:1000-1019` (merge loop, `carried over unrecognised persisted secret`), `:1016` (`.prev`), `:1024` (`mv -f`) |
| `BRINGUP_THREE_PATHS.md:915`: "PROFILE has no delivery path through make … gen-env never mentions it. The value dies at the docker boundary." | gen-env emits `PROFILE` conditionally | **B for the gen-env half — SUPERSEDED.** `gen-env.sh:850` emits `PROFILE="…"` when non-empty, with the reason at `:845-849`. The Makefile half was not re-checked | `gen-env.sh:845-850`; `Makefile:496` lists `PROFILE` in a carry-forward set; live env has no `PROFILE` line — consistent with "not set on this deployment", not "never emitted" |
| `boredom-vessel.service.d/watchdog.conf` comment: "Autonomous dispatch slows ~12x (2s -> 10min between dispatches …)" | 2s → 10min is 300× | **B.** The drop-in's own worked example contradicts its own multiplier; doc `:84` ("240×–300×") matches the arithmetic | `BOREDOM_MIN_DISPATCH_INTERVAL_MS` 2000 → 600000 = 300×; `BOREDOM_IDLE_WINDOW_SECONDS` 300 → 1800 = 6× |
| doc `:163`: "Names emitted into `/etc/substrate/env`: 72–80 — conditional, not a constant"; baseline records `emitted=80` for all three lanes | The live fleet emits 74 | **NOT a contradiction** — all three are consistent; stated explicitly so the number gap is not read as an unexamined discrepancy. Emission is conditional at `gen-env.sh:841-867`, and the probe lanes supply more of the conditional names than this deployment sets | live: 74 names, none of the conditional selection knobs present; baseline: 80 with probe sentinels on ~45 offered names **(measured pre-rebuild)** |

- The doc's precedence chain at `:90-103` places channel 3 in the wrong position. `BRINGUP:919`'s "Confirmed live" was confirmed at the directive layer, not the consuming layer; the same report states the correct rule at `:950` and prescribes `/proc/<pid>/environ`.
- Discriminating control for the drop-in contradiction (a name in NO `EnvironmentFile`): boredom-vessel main unit sets `BOREDOM_MIN_DISPATCH_INTERVAL_MS=2000`, `watchdog.conf` sets `600000`, merged value `600000` — proving drop-ins DO beat the main unit, so the discrepancy is not a broken drop-in but the `EnvironmentFile` winning.
- The two files' key lists have drifted apart (gen-env persists ~30 names, `secrets.env.sh` six), which is why both needed independent merge fixes for the same 2026-08-08 incident.
- `ADMISSION_CAP`'s own comment records the consequence of the previous value: at 200, ~322 of `patch_proposal`'s 522 producers never reached the draw at all.
- `BRINGUP_THREE_PATHS.md:100` flagged the stale-heredoc-comment staleness previously; CONFIRMED still present.

### Coverage notes (config)

**What could not be covered, and why.**

1. **The container was destroyed mid-audit.** `substrate-live` was Up 2 days (healthy) when the audit began and
   every live measurement above was taken against it. Partway through, an external actor killed and removed it:
   `docker events` shows `kill substrate-live` at epoch 1787634297, `die` at 1787634299, `destroy` at 1787634311.
   It was absent from `docker ps -a` entirely and had not returned by the end of that session. (It has since been
   rebuilt — a *different* container instance — which is why every `verified-live` observation here is marked
   **(measured pre-rebuild)**.) No mutating command was run: the probes were `cat`/`sed`/`systemctl show`/`ls`/
   `getent` and the read-only `substrate-config`. Consequence: every `verified-live` status is a claim about the
   window BEFORE that destroy, not about now, and the following intended probes were lost:
   (a) `/proc/<boredom-pid>/environ` to close the second half of the drop-in discrimination at the consuming
   layer — it is held only from `systemctl show -p Environment`, though for `BOREDOM_*` that directive list IS the
   effective source since no `EnvironmentFile` carries those names; (b) `getent hosts syzygy.host` to decide
   whether the inert `federation-peering` drop-in is currently harmless (hostname resolving to `138.197.116.56`)
   or a live behavioural divergence — the drop-in trap's severity is therefore stated as "high" **on the
   mechanism**, not on a measured divergence; (c) re-reading `/etc/substrate/env` after any recreate.

2. **`config-surface-probe.sh` was not run.** It launches throwaway containers that execute gen-env and write
   `/etc/substrate/env` and `/workspace/.substrate-secrets` inside themselves — outside this audit's read-only
   allowance (docker ps/inspect/port/network ls and read-only exec). So the DROPPED / HARDCODED / MANGLED /
   UNOFFERED / PHANTOM findings are assessed by READING the implementation, with
   `scripts/substrate/config-surface-baseline.txt` (16 lines, commit `fd9d1102`, 2026-08-22) as the standing
   recorded evidence — a two-day-old snapshot, not a current measurement. Cross-lane and persistence differentials
   are likewise un-re-derived.

3. **Scope limits not exhausted.** The doc's §4 blind-spot list applies here too: read sites were enumerated with
   `rg` over `repos/*/src`, `scripts/`, and `packages/`, which misses `parseEnvInt('NAME', …)` / `envOr("NAME", …)`
   helper forms (the `TRACE_*` family is read exclusively that way) and concept-db's caller-supplied-key
   `parseEnvInt` calls, which no static scan can enumerate. The law-1 violation list is therefore a **FLOOR** —
   "N knobs, by the forms this scan covers" — not a total. The doc's ~451-name fleet-wide read-site census was not
   attempted.

4. **Not re-derived.** Doc §5's default-drift table (`SURREALDB_URL` 5 defaults, `SURREALDB_PASSWORD`
   changeme-vs-root, `DISCOVERY_ENDPOINT` 4, `ACTIVITY_API_ENDPOINT` 4, `GOAL_HOST_VESSEL_ENDPOINT` 2,
   `FED_HEALTH_PORT` 2), the 11-alias API-key sprawl, the metric-collector/light-dispatch PORT 8280 collision, and
   the weak-secret-literal count. The doc itself instructs "Re-derive the instances before citing them; do not
   quote this row as current," honoured by not quoting them rather than by re-deriving them — a gap. The
   gen-env↔Makefile port-offset bound parity was also not verified (both stated as 47534; only `gen-env.sh:411`
   was read).

5. **One cross-check not completed.** The Makefile's `run-live` / `run-live-obsidian` recipes and
   `RECREATE_CARRY_PRESENT` were read only where `rg` surfaced them (`Makefile:154, 273, 469, 496, 602, 618, 683,
   699`). The Makefile lane was not audited end to end, so "PROFILE has no delivery path through make"
   (`BRINGUP:915`) is marked SUPERSEDED only for its gen-env half.

6. **Secret handling.** Every value in this section is truncated to six characters or fewer. Two incidental
   exposures worth flagging as findings in their own right, of the same class as doc §5's weak-secret row:
   `~/.metabob/config.json` is mode 0644 and stores a full plaintext Anthropic provider key alongside the metabob
   `apiKey`; `/etc/substrate/env.provenance` is mode 644 by design (names only, no values, so this is correct)
   while `/etc/substrate/env` and `/workspace/.substrate-secrets` are correctly 600.

7. **Prior-report disposition.**
   - **CONFIRMED and still live:** `BRINGUP_THREE_PATHS.md:100` (stale "heredoc OVERWRITES" comment in gen-env),
     `:917` (`HUB_API_KEY` read by three components, set by nothing), `:924`
     (`FEDERATION_SIGNING_SECRET` dead — 0 TS readers, with a positive control), `:950` (later `EnvironmentFile`
     wins — and it is the rule that falsifies `:919`), `SETUP_UX_MAP.md:44-51` (gen-env is an allowlist; zero
     units carry `PassEnvironment`) and `:62-64` (`/proc/1/environ` reports gen-env's output as the operator's
     input).
   - **FALSIFIED:** `BRINGUP_THREE_PATHS.md:919` ("a drop-in beats gen-env — Confirmed live") — confirmed at the
     wrong layer; this propagated into `CONFIGURATION_SURFACE.md` §1/§2.
   - **SUPERSEDED:** `BRINGUP_THREE_PATHS.md:915` ("gen-env never mentions PROFILE") — `gen-env.sh:850` now
     emits it.
   - **CONFIRMED-as-fixed:** `RECTIFICATION_AND_DEMONSTRATION.md:80-81` (probe now exits 2 FATAL when it cannot
     run; gen-env now names each discarded value on stderr) and `SETUP_AND_JOIN_DOC_DELTA.md:172-188` (provenance
     no longer reports generated secrets as hardcoded — live output shows `unrecorded`, and the hardcoded footer
     is gated).
   - **COULD NOT CHECK:** `BRINGUP:922` (`make up` on a running container ignores join settings — itself marked
     UNVERIFIED there, and the container is gone), `:951` (`DRY_RUN=1 apply-inventory` mutates a live container —
     it is a write, so out of scope by construction), `:953` (the `COMPOSE_MAX_CONCURRENT=0` lane inversion — the
     code at `compose-slots.ts:106` was confirmed and the knob confirmed to have no delivery path, but the
     inversion could not be exercised), and the `SETUP_UX_MAP` / `ONE_SURFACE_AUDIT_DELTA` claims about README and
     join-recipe wording, which are a different family.


---

## 12. Adversarial verdicts on families 7 and 8 (now fully mapped in §9 and §10)

> **Superseded framing.** This section originally claimed these two families produced no map. That was a
> synthesis truncation, not a data loss: both maps were recovered intact from the run journal and are rendered in
> full at §9 (cockpit) and §10 (validation). The verdicts below are retained because they carry evidence the
> family maps do not duplicate.

Two of the nine commissioned families produced **no map**. Their findings survive only as verification verdicts
and are recorded here so they are not lost. **These are findings, not processes** — the step-level detail that
would let an operator reproduce the workflow does not exist and must be re-commissioned.

### 12.1 — "Agent development workflow (cockpit, hooks, skills, openspec)" — 12 verdicts, no map

| Finding | Evidence | Verdict |
|---|---|---|
| `SUBSTRATE_ALLOW_DIRECT_EDIT=1` is **permanently set** in `.claude/settings.local.json` and active in the live session, making the vessel edit gate a no-op for every edit in this checkout | `.claude/settings.local.json:2-4`; re-confirmed in-session (`echo $SUBSTRATE_ALLOW_DIRECT_EDIT` → `1`). `substrate-vessel-edit-gate.sh:22` `[ "${SUBSTRATE_ALLOW_DIRECT_EDIT:-0}" = "1" ] && exit 0` **precedes** the goal-host `/health` probe (`:24`) and the `intervention_evaluate` POST (`:43`), so the S3 push-away channel is silenced too. **Re-falsifies the operator memory entry "restored to 0 after" (2026-08-23)** | CONFIRMED |
| The edit gate has two holes: the pattern requires a **leading slash**, so a relative path passes ungated; and `packages/*/src/**` is ungated although three vessels consume it as a `file:` dependency | `substrate-vessel-edit-gate.sh:18` `grep -Eq '/repos/[^/]+/src/'`. Controls: `/x/repos/activity-api/src/a.ts` → MATCH; `repos/activity-api/src/a.ts` → NOMATCH; `/x/packages/shared/src/a.ts` → NOMATCH; `/x/repos/a/src/__tests__/b.ts` → MATCH on the `:20` allow pattern. Consumers: `repos/identity-vessel`, `repos/terminal`, `repos/react-renderer` package.json. Every goal-host edit-intent regex (`index.ts:11192,11645,11707`) is anchored on the literal `repos/`, so a `packages/` change cannot even be dispatched | CONFIRMED |
| The PreToolUse matcher is exactly `"Write\|Edit\|MultiEdit"`, so **NotebookEdit bypasses the gate entirely** — and the PostToolUse memory-mirror matcher is the same string, so it misses NotebookEdit too | `.claude/settings.json` (both matchers). NotebookEdit is a real, callable tool in this harness and it writes files. A `.ipynb` under `repos/<vessel>/src/` is editable with neither hook firing | CONFIRMED |
| The memory-mirror hook cannot find `bun` and fails on **every** invocation, silently, 66 times | `rg -c 'bun: command not found' ~/.claude/substrate-memory-mirror.log` → 66; last three paired failures 2026-08-25 03:01:51 / 03:23:53 / 03:54:12 UTC. Last success: log lines 1700-1701, the Aug 20 batch. Cause is PATH: `command -v bun` fails in the tool shell, `bash -lc 'command -v bun'` → `/home/avi/.bun/bin/bun`. `.mcp.json:8` explicitly prepends `/home/avi/.bun/bin` for the MCP server; the hooks got no equivalent | CONFIRMED |
| Multi-file edit goals: enumeration works, **grounding does not**. Only the FIRST named file receives a verbatim excerpt block and a line anchor | `index.ts:11223` and `:11712` build `allFiles` via a global regex, but `rg 'verbatimExcerptBlock\('` returns exactly three lines — the definition `:10452 (editFile, editLine, goalText)` and two call sites `:11238` and `:11755`, both passing the **first** matched file. `earlyEditSite`/`editSite` (`:11227-11228`, `:11720`) derive from the same single variable, so `edit_site` names only file #1 | OVERSTATED → corrected: two residuals, not one — (1) ops on paths the spec did not name are dropped (`feature-compose.ts:3323-3327`); (2) files 2..N reach the drafter with a path but no quoted content and no `edit_site` |
| `metabob-mcp`'s installed `dist/cli.js` is **not** stale — the caveat is withdrawn | `readlink -f $(which metabob-mcp)` → `/home/avi/documents/work/metabob-mcp/dist/cli.js`; `dist/cli.js` Aug 21 05:08 vs `git log -1` ea3a341 Aug 21 01:50:42; `find src -newer dist/cli.js` → EMPTY; `git status --porcelain` shows no modified src. Markers present in the bundle: `claude-code-operator` ×1, `MB_OPERATOR_ID` ×1, `run-goal` ×5 | REFUTED (caveat withdrawn) |
| `provide_feedback`'s "records are in-memory and capped ~100" is half-stale: goal-host persists the dispatch store to disk every 5 s and restores on boot | `index.ts:15598-15625` — `dispatch store: restored N records from disk`; `setInterval(persistDispatchStore, 5000)`; `pruneStore()` caps at 100 and deletes the oldest 20. Coalesce at `:14232-14240`, guarded by `!targetTemplateId` and skipping requeues | CONFIRMED. **Undocumented behaviour found in the same block:** a restored record that `wasRunning`, is younger than 600000 ms, is not an edit-intent goal and is not a resume child is **AUTOMATICALLY RE-DISPATCHED 20 s after boot** via `setTimeout(… fetch('/run-goal', {goal: old.goal, tags:['resumed_from:'+old.dispatchId]}) …, 20000)` |
| `make -C scripts/substrate restart-<vessel>` and `sync-<vessel>` **do not exist**, and two skill files still instruct agents to run them | `rg '^restart-\|^sync-\|^logs-' Makefile` → no matches; `Makefile:315` `.PHONY` lists 19 real targets, none of them. Stale instructions at `.claude/skills/deploy/SKILL.md:17,18,21,56` and `.claude/skills/metabob-substrate/SKILL.md:184` | CONFIRMED |
| The `openspec` CLI is **absent**, so nothing past step 1 of the openspec workflow can run; `openspec/specs/` does not exist; all 84 change dirs sit flat and nothing has ever been archived | `command -v openspec` absent in both the tool shell and a login shell (the discriminating control — the same login-shell test DID find `bun`). `ls openspec/` → `changes config.yaml`; `ls openspec/specs` → No such file; `ls openspec/changes \| wc -l` → 84. The duplicated command surfaces have diverged: propose 106 vs 110 lines, apply 152 vs 156, archive 157 vs 114, explore 173 vs 288 | CONFIRMED |
| The SessionStart/SessionEnd hooks read `$HOME/.metabob/config.json` while the MCP cockpit is pinned to `<repo>/.metabob/config.json` | Both files currently carry the **identical** apiKey (md5 `3e9d521e071f206cadc06b991b3bb27f`) and the same endpoint, so nothing breaks today. See the cross-family conflict in §10 for why that is a coincidence, not a property | CONFIRMED |
| The family's own coverage claim ("all four hook scripts line-by-line … full hook/gate surface") **omits the git hooks and CI entirely** | `git config --get core.hooksPath` → `/home/avi/documents/work/substrate/scripts/git-hooks` — **installed and active**. `scripts/git-hooks/` holds `pre-commit` (15734 B, executable, `ALLOWED_TOPLEVEL_DIRS` at `:72` and `:113`, enforcement loop `:60-140`), `vessel-pre-commit` (6703 B), `install.sh`, `.gitleaks.toml`, `README.md`. `.github/workflows/` holds `build-substrate-image.yml`, `bump-submodules.yml`, `deploy-activity-api.yml`, `nightly-dev-build.yml`, `weekly-recommendation-validation.yml`. **None appears anywhere in that family's output** | OVERSTATED → the git pre-commit gate (cited by `CLAUDE.md`'s own repository conventions) and the bump-submodules → nightly-dev-build → build-substrate-image propagation path are **unmapped** |
| The family's law-1 analysis names only a hardcoded goal string in a session-end hook | See §11 — its strongest instance, `ROUTE_EDIT_INTENT_TO_COMPOSE`, was missed | OVERSTATED |

### 12.2 — "Validation, doctor, health & watchdogs" — 4 verdicts, no map

| Finding | Evidence | Verdict |
|---|---|---|
| `substrate-doctor` check 6 (recovery-coverage lint) is **structurally VACUOUS on every deployment of this image** | `substrate-doctor.sh:242-248`: `f="/etc/systemd/system/$u"; [ -f "$f" ] \|\| continue; …`. `Dockerfile.substrate:208-213` vendors units to `/usr/lib/systemd/system` **by design** ("/etc outranks every other" … "subsetting writes `/etc/systemd/system/<unit> -> /dev/null` masks"), so no inventory unit file ever exists at the path the check reads, and the only things in `/etc` there are `-> /dev/null` masks for which `[ -f ]` is false. The check can never assert anything about any unit and prints PASS unconditionally | CONFIRMED |
| Check 5b **does** detect restart loops (two `NRestarts` snapshots 25 s apart) but misses any loop whose period exceeds the window — and the hole lands on the dispatch entry point | `substrate-doctor.sh:197-232` (`_snap()`, `sleep "${DOCTOR_LOOP_WINDOW:-25}"`, `[ "$n2" -gt "$n1" ]`, plus a still-cycling guard). `rg 'RestartSteps\|RestartMaxDelaySec' scripts/substrate/units/*.service` → **`goal-host-vessel.service:34 RestartSteps=3`** and **`:35 RestartMaxDelaySec=30`**. Two precision corrections: systemd has **no** default exponential backoff (these are opt-in), and no unit has a static `RestartSec>=25` (sweep max = 20, bootstrap-seeder / concept-db-seeder). The hole is real via exactly one route: goal-host at its escalated delay | CONFIRMED |
| `substrate-doctor` is invoked by **no** timer, unit, or CI workflow — only by hand and by `make up` | `rg 'substrate-doctor\|substrate_doctor' --glob '!*.md' -g '!repos/**' .` → `Dockerfile.substrate:221` (COPY), `:301` (chmod), `Makefile:463`, and the `validation/demo2` bringup harness (`path-b.sh:41`, `path-c.sh:101-107`). No `.github/workflows/*.yml` runs it. `Makefile:463` has **no `\|\| true`**, in contrast to the readiness line two above it | CONFIRMED |
| **The repo's dedicated configuration/law-1 drift detectors and the harness `CLAUDE.md` designates as "Validation" have ZERO call sites** | `scripts/substrate/config-surface-probe.sh`: every reference outside its own file is a `.md` (`docs/operations/CONFIGURATION_SURFACE.md:13,163,164,224-226`; `Makefile:159` is a **comment**; validation reports). No unit ExecStart, no CI step, no Makefile target, and it is **not** among the individual `COPY scripts/substrate/*.sh /usr/local/bin/…` lines in `Dockerfile.substrate` — only `scripts/substrate/units/` is copied as a directory, so the "whole directory copied" caveat does not rescue it. `scripts/substrate/warn-baseline-drift.sh`: `rg 'warn-baseline-drift' --glob '!validation/**' .` → only lines 2 and 28 of the script itself. `validation/scripts/failure-mode-harness.ts` (`CLAUDE.md:309` "Validation: the failure-mode harness"): all references are prose; `validation/scripts/run-weekly-harness.sh` — the only scheduled validation (`weekly-recommendation-validation.yml`, cron `0 9 * * 1`) — runs `reuse-harness.ts`, `compare-reports.ts`, `test-forge-goal-completion.ts`, `goal-generator.ts`, `stratified-harness.ts`, never `failure-mode-harness.ts` | REFUTED (as "live") → these are gates that can never be observed failing and therefore cannot be trusted when they pass |

### 12.3 — Two families are absent and unnamed

Nine maps were commissioned; five arrived, two more exist only as the verdicts above. **The remaining two are
absent and are not named anywhere in the input** — I cannot state what they covered without guessing, and do not.
Candidate surfaces that appear in no delivered map and no verdict, and are therefore likely among them:

- The learning loop proper (Thompson selection, credit assignment, `decision_outcome`, the ribosome, pathway reuse).
- Goal dispatch and the walk itself (`run_goal` → walk → `reached` verdict → `goal_reasoning` → `provide_feedback`).
- Gap detection, gap store and boredom/condition-driven selection.
- The trace store, retention and the concept graph.

None of these is asserted to be the missing families. They are named only so a re-commission has a starting list.

---

## 13. Traps — consolidated, severity-ordered

76 silent-failure modes. `F*` = family of origin; `V` = verdict-sourced (no map). Every row's defining property
is that the system reports success, or reports nothing, while the thing does not work.

### 13.1 Blocker (9)

| # | Trap | Where | Why invisible | How to detect |
|---|---|---|---|---|
| B1 | activity-api admits **ANY** `Authorization: Bearer <anything>` as an unauthenticated request and serves `/v2` data | `repos/activity-api/src/middleware/jwtAuth.ts:355-361` (base64 catch), `:364-371` (periodCount != 2), `:464-470` (JWT catch) — each falls through to `c.set('jwtAuth', null); await next()` | The **ApiKey** branch WAS hardened to fail closed (`:283-297`) with a comment explaining that falling through "is not an unauthenticated read, it is a cross-tenant read". The three Bearer fall-throughs in the same file were left. It returns 200 with real data; the no-header and bad-ApiKey cases 401 correctly, so any spot-check of "is auth on?" passes | Run all six controls: `Bearer notacredentialatall` → 200/49324 B; `Bearer aaa.bbb` → 200; `Bearer aaa.bbb.ccc` → 200; `ApiKey mb-bogus-deadbeef` → 401; `Frobnicate xyz` → 401; no header → 401 |
| B2 | `POST /v1/keys/generate` on identity-vessel is **completely unauthenticated** and mints an HMAC-valid key for ANY `org_id`/`user_id` the caller names | `repos/identity-vessel/src/index.ts:860-909` — the handler reads no Authorization header at all; scope default at `index.ts:1043`, `apiKeyAuth.ts:82`, `jwtAuth.ts:190` | The key never gets an `api_key` row, so `lookupKeyScopes` returns null and every consumer defaults it to `['read','write']` — a working fleet credential. `docs/IDENTITY_VESSEL_CURL_EXAMPLES.md:32` calls it "the older path … for illustration" and says "generate is admin-only", which reads as retired or gated. identity binds 0.0.0.0 and :18101 is published | `POST /v1/keys/generate` with **no** Authorization and body `{}` → 400 `KEY_GENERATION_FAILED` (zod complaining), i.e. it reached schema validation. Control: same request to `/v1/keys/issue` → 401 `MISSING_AUTH_HEADER` |
| B3 | `POST /v1/keys/revoke` is **unauthenticated** — anyone who can reach :18101 and knows a `key_id` can revoke any key, including the fleet key | `repos/identity-vessel/src/index.ts:1085-1169`; caller `scripts/substrate/substrate-key.sh:105-106` | The operator path mints and presents an admin JWT, so the flow LOOKS authenticated end to end; the missing check is a non-event on the server. `key_id`s are not secret — `GET /v1/keys` lists them and they are embedded in every key's base64 payload | `POST /v1/keys/revoke` no auth, body `{}` → 500 `REVOCATION_FAILED` ("Either key_id or api_key must be provided"), **not** 401. Control: `GET /v1/keys` no header → 401 |
| B4 | A peer fan-out whose forwarded credential is rejected returns **exactly** what a peer with no producer returns: `found:false`, `vessels:[]`, HTTP 200, no log line anywhere | `repos/discovery-vessel/src/index.ts:83` (`if (!res.ok) return`) and `:93` (`catch { }`), reached from `:257` | No console output on either branch. Auth rejection, peer timeout, peer down and peer-has-nothing collapse into one indistinguishable result — the "never collapse tool-failed into tool-found-nothing" failure baked into code | Bypass the fan-out and query the peer **directly** with the credential the forwarder would use. Also check `HUB_API_KEY` in the discovery MainPID `/proc/<pid>/environ`, not the env file |
| B5 (V) | `SUBSTRATE_ALLOW_DIRECT_EDIT=1` is permanently set in `.claude/settings.local.json`, so the vessel edit gate is a no-op for every edit in this checkout **and** the `intervention_evaluate` (S3 push-away) call is never reached | `.claude/settings.local.json:2-4`; `substrate-vessel-edit-gate.sh:22` short-circuits before `:24` and `:43` | The gate still exists, is still wired in `.claude/settings.json`, and prints nothing when it exits 0. Operator memory records "restored to 0 after" (2026-08-23) — it was not | `echo "${SUBSTRATE_ALLOW_DIRECT_EDIT:-UNSET}"` in a hook subprocess, not just a shell; and `cat .claude/settings.local.json` |
| B6 | `docker compose up -d` prints "Started" and exits 0 on a container that dies immediately and then crash-loops forever under `restart: unless-stopped` | `docker-compose.yml:30`; `README.md:110-116` | Compose reports that it LAUNCHED, not that it lived. The commonest cause is an unedited `.env` — gen-env deliberately refuses to boot a standalone with no provider key (`gen-env.sh:327-340`) — and that refusal appears only in `docker logs` | `sleep 15; docker ps --filter name=$SUB --format '{{.Status}}'` → `Restarting` ⇒ `docker logs --tail 20 $SUB` |
| B7 | `healthy` arrives long before identity is seeded, and `substrate-key show` prints a pre-seed placeholder with **exit 0 and no error**. Every call made with it 401s | `README.md:117-133`; `docs/SUBSTRATE.md:1408` | The tool prints whatever is in `/etc/substrate/env` and never validates it. The value is short and lacks the ~160-char `mb-<base64>-<hex>` shape of a real key, but nothing says so | `docker exec <c> substrate-key whoami \| grep -q '"valid": *true'` — **bounded** loop, never unbounded (a genuine seed failure must not become a forever-wait; the in-container seeder gives up at 300 s) |
| B8 | A freshly generated `SURREAL_PASS` against an **existing** datastore can never authenticate — SurrealDB ignores `--pass` once a root user exists — and the container boots anyway | `gen-env.sh:171-179` | Every vessel reports healthy; only requests that touch the store fail, with hundreds of downstream "problem with authentication" errors and no single cause named. The warning is three stderr lines in the boot log | `docker logs <c> \| grep 'generated a fresh SURREAL_PASS'`; and `substrate-config SURREAL` — a `generated` provenance on a warm volume is the alarm |
| B9 | A masked unit is `is-enabled: masked` / `is-active: inactive` — the **same resting shape** as an ExecCondition skip — so `--quick` once printed "fleet ready" and `docker ps` said `(healthy)` with surrealdb, activity-api, identity-vessel and llm-resolver all masked and dead | `substrate-ready.sh:150-175` | Masks are on-disk state left by a PREVIOUS selection; they survive restarts and produce a healthy-looking resting state. The topology is the discriminator: on a spoke a masked core unit is the design, on a standalone it is an outage | substrate-ready now prints the masked count and names each masked unit on every pass (`substrate-ready.sh:306-313`). Clear with `vessel-ctl apply`, then **RESTART the container** — after a mask/unmask cycle a measured 15 timers were left `Unit to trigger vanished` (`docs/SUBSTRATE.md:857-863`) |

### 13.2 High (30)

| # | Trap | Where | Why invisible | How to detect |
|---|---|---|---|---|
| H1 | `make up` "builds if needed" means the **TAG is absent**, not that the source changed. On a host holding the published `:dev` image, `up` boots that image and your working tree is never compiled | `Makefile:441`; `README.md:473-479` | The build step is silent when skipped, and the running fleet looks correct — it is simply somebody else's code | `REBUILD=1`, or `TAG=<name>`. Verify with `docker image inspect $(IMAGE):$(TAG) --format '{{.Created}}'` against your last commit time. Still true on this host: `:dev` created 2026-08-21T12:17:21Z, HEAD is later |
| H2 | Resuming a stopped container silently drops every create-time setting the `LAUNCH_OVERRIDES` guard does not name — **including the autonomy kill switches** | `Makefile:273` (guard, 17 names) vs `Makefile:578-625` (run-live passes ~40); `docs/SUBSTRATE.md:560-566` | `docker start` accepts no env; unguarded values look applied because the command succeeded | `docker inspect <c> --format '{{range .Config.Env}}{{println .}}{{end}}' \| cut -d= -f1` — compare against the current run-live recipe. Because `Makefile:618` emits the name even when the value is empty, a **missing name** proves the flag was absent at create time |
| H3 | The container HEALTHCHECK (`substrate-ready --quick`) runs a **single pass**, and restart-loop detection is a delta between passes — so the host-visible health signal structurally cannot see a crash loop | `substrate-ready.sh:273-283`; `Dockerfile.substrate:366-367` | A looping unit reports `activating`/`active`, never `failed`. `--once` (used by doctor) takes a baseline pass and sleeps 25 s first; `--quick` keeps its single pass to stay fast | `systemctl show <unit> -p NRestarts --value`, sampled twice. Live demonstration on the family's own datastore: `surrealdb.service` active/success/**NRestarts=7** with `systemctl --failed` empty |
| H4 | `docker rm -f` / `make recreate` SIGKILL a running container with no grace period, cutting SurrealDB off mid-write on the volume holding every trace and posterior | `Makefile:554` (recreate does not drain) vs `Makefile:828-830` (clean-live's warning and drain) | The command returns instantly and successfully; the damage is inside a RocksDB write | `make stop LIVE_NAME=<n>` (drains to `STOP_TIMEOUT ?= 300`, `Makefile:794`) **before** removing |
| H5 | `docker rm` does not remove the volumes, so a later "clean" install silently inherits the previous fleet's learning state — or two fleets end up writing one datastore | `README.md:91-98,598-608`; `docs/SUBSTRATE.md:1082-1092` | Nothing errors. Reusing default volume names ATTACHES the new fleet to the old one's state; a compose lane without explicit `name:` fields would instead create empty project-prefixed volumes and orphan the real ones (`docker-compose.yml:146-162`) | `docker inspect <name> --format '{{range .Mounts}}{{.Name}} {{end}}'` before trusting a fresh fleet. Residue on this host: ~15 orphaned `<name>-surreal`/`<name>-workspace` pairs |
| H6 | On the make lane a spoke is **never keyless** — it silently receives the operator's Anthropic key | `Makefile:82-99` (`ANTHROPIC_API_KEY ?= $(shell jq … ~/.metabob/config.json)`) | `?=` in GNU make is unconditional-on-emptiness, not topology-aware, and it fires on every topology. gen-env then **persists** the key to that fleet's `/workspace/.substrate-secrets` (emitted in the persist heredoc, `gen-env.sh:938-1000`), so it survives every later recreate | `docker exec <spoke> substrate-config ANTHROPIC` — an `env`/`persisted` source on a fleet you launched keyless is the tell. Suppress explicitly: `make up … ANTHROPIC_API_KEY= OPENAI_API_KEY=`. (The "108-char key" figure is a prior measurement recorded in `Makefile:82-99` and commit `42302670`, not re-measured here) |
| H7 | `vessels.manifest.json` is **permanently frozen against git** by a whitespace-only reformat; pull-sync compares with `cmp -s` (a byte compare), so a jq pretty-print reads as a deliberate local customisation | `substrate-pull-sync.sh:363,371,384`; artefacts `/workspace/substrate/fleet/vessels.manifest.json` (6238 B) vs `.vessels.manifest.json.converged` (6070 B) | The only signal is one log line inside pull-sync's journal every ~10 minutes, worded as if the operator had chosen this. `vessel-ctl drift` — the command the docs name for exactly this question — never inspects the manifest at all and issues a clean all-clear at the same moment | `journalctl -u substrate-pull-sync \| grep 'fleet:'`. Confirm the modification is null with `jq -S .` on the live file and the sidecar. Documented exit (`docs/HUMAN_SURFACE.md:210`): delete the sidecar to accept git |
| H8 | `vessel-ctl install` reports `ok:true` even when `systemctl enable --now` failed and when the `post_install` hook failed | `vessel-ctl.sh:237`, `:240-241`, `:243-246` | Both compounds discard stdout, stderr AND exit status. The only residual signal is the `active` string, which for a `Restart=always` vessel reads `activating` — never `failed` — while it crash-loops | Never trust `ok:true`. Read the `deps` field (it names all five install outcomes incl. `WORKDIR ABSENT`), then `vessel-ctl status <v>` for `restarts=`, then **assert the artefact** — e.g. `cat /workspace/human-surface-ui-build.log` for `UI_BUILD_OK`/`FAILED`, or curl the `health_port` |
| H9 | `vessel-ctl sync` reports `ok:true` when the git pull failed AND when the restart did not take | `vessel-ctl.sh:258`, `:260`, `:263` | Only mirror failure fails the verb. A diverged/dirty clone makes `--ff-only` refuse silently; a masked unit's restart is refused by systemd while `is-active` still reports `active`. Unlike the `restart` verb, sync does **not** compare MainPID | Pass `MIRROR_EXPECT_SHA` (`mirror-to-live.sh:40-57`). Otherwise compare `git -C /workspace/git/vessels/<v> rev-parse HEAD` against what you pushed, and `systemctl show <u> -p MainPID` before/after |
| H10 | The mask-recovery lever depends on injection precedence that only exists in a **converged** `vessel-ctl`. On an older copy, `docker exec -e ENABLED_ROLES=full <c> vessel-ctl apply` is silently reverted by the env file to the narrow selection that caused the mask — and reports success | `vessel-ctl.sh:98-130`, `:507-509` (the fix); `gen-env.sh:425,843` (why the file always pins `ENABLED_ROLES` on a spoke) | Applying a narrow selection is exactly what masks units, so the fleet needing recovery is precisely the fleet whose env file pins the narrow selection. A previous instance left 58 units masked and 9 core vessels dead behind a clean all-clear | `md5sum` the container's `/usr/local/bin/vessel-ctl` against `scripts/substrate/vessel-ctl.sh`, and look for drift's `OVERRIDDEN for this run by the injected selection:` line — its absence when you injected means the old code is running |
| H11 | The Obsidian intake/learn/collaborate loops report **systemd success on every tick while doing literally nothing** — 2586 consecutive dead ticks in the retained journal, zero real work since 2026-07-07 | `obsidian-intake-tick.sh:56-60` (and `obsidian-learn-tick.sh:23-30`, `obsidian-collaborate-tick.sh:49-52`); `obsidian-intake.timer` `OnUnitActiveSec=2min` | The scripts declare graceful-idle-on-unreachable as a DESIGN choice and the resolvers honour it by returning HTTP 200 with `{"success":true,…,"unreachable":true}`. The tick uses `set -uo pipefail` **without `-e`** and never inspects `.body.unreachable`, so the oneshot exits 0 and every layer above is green. Nothing distinguishes "the inbox was empty" from "no Obsidian exists on this deployment" | `journalctl -u obsidian-intake --no-pager \| rg -c '"unreachable":true'` against `rg -c requests_found` (2586 vs 0), and the mtime/value of `/workspace/last-human-activity` — only written when `requests_found > 0`, so a stale value dates the last real work |
| H12 | `obsidian-collaborate-tick` prints ` <- collaboration contribution delivered` **unconditionally**, on the same tick whose response says `delivered:false` | `obsidian-collaborate-tick.sh:53` — a bare, newline-terminated `echo` appended to the curl pipeline, not conditioned on the response and not `&&`-chained | The two lines land in the journal 0 seconds apart, and the human-readable one is what an operator scanning `journalctl` reads. It asserts the opposite of the JSON immediately above it | `journalctl -u obsidian-collaborate -n 8` and compare `.body.delivered` against the trailing echo |
| H13 | `FEDERATION_SIGNING_SECRET` and `FEDERATION_PEER_AUTH_MODE` are generated, persisted, threaded into units and documented as the peering credential — and **no code reads either one** | `secrets.env.sh:41-42,77-78`; `gen-env.sh:478-479,857-858`; `vessels.manifest.json:50-51`; `deploy-remote.sh:86`; `docs/FEDERATION.md:71-72,84-85` | Every inspectable layer shows the value present and correctly propagated. `substrate-config` reports it, the env file has it, the unit's EnvironmentFile carries it. Nothing consumes it, so setting it changes nothing observable — and an operator who set it believes peering is authenticated | `rg -n 'FEDERATION_SIGNING_SECRET' -g'!node_modules' -g'!*.md' .` → writers only. The variable that WOULD work (`HUB_API_KEY`, `discovery index.ts:56-58`) is set by no deploy path |
| H14 | A standalone substrate serves a well-formed 200 `/bootstrap` containing a **LOOPBACK** `identity_endpoint` and an **EMPTY** `discovery_endpoint` | `repos/discovery-vessel/src/index.ts:171-180` | The documented pre-flight only checks `relay_multiaddrs` length. A hub with a relay but no `PUBLIC_IP`/`IDENTITY_PUBLIC_URL` would pass and hand every joiner `http://127.0.0.1:8101` as its identity authority — a value that resolves on the joiner's own machine | Assert `identity_endpoint` is not loopback and `discovery_endpoint` is non-empty, in addition to the relay-array check |
| H15 | The relay's automatic `RELAY_MULTIADDR` capture reads a log file **nothing writes**, and the hook's output and exit status are discarded | `vessels.manifest.json:42` (reads `/workspace/fed-relay.log`); `vessel-ctl.sh:241` (`csh "$post" >/dev/null 2>&1 \|\| true`) | `vessel-ctl install` still reports `ok:true`. The relay unit runs healthy. Discovery keeps returning an empty `relay_multiaddrs`, which looks like "no relay deployed" rather than "capture failed" | `rg -n 'fed-relay\.log'` → a consumer and zero producers. Assert non-empty `/bootstrap` after install rather than trusting the install's return |
| H16 | The relay hard-exits without `PUBLIC_IP` under `restart:always`, so it presents as `activating`, **never `failed`** | `relay.ts:39` + `vessels.manifest.json:41` | `is-active` and any `/health`-shaped check above it read as in-progress rather than broken; no launch path supplies `PUBLIC_IP`/`FED_PUBLIC_IP` into `/etc/substrate/env` (gen-env's emitted federation block, `:689-695`, contains neither) | `systemctl show federation-relay -p NRestarts` twice and subtract. A climbing count on a fleet that reports active is the tell |
| H17 | A relay restarted with a **different key file** mints a divergent peer id while `relay.log` still names the old one, so every advertised circuit address is undialable | `deploy-hub-pull.sh:83-95` (records the incident: log said `…PkEY…`, live relay was `…J9Jd…`); `deploy-remote.sh:104` still does `pkill -f 'bun relay.ts'` | The relay is up, :30333 accepts TCP, `/bootstrap` returns a syntactically valid multiaddr, and discovery advertises it. Everything is green; only actual dials fail | Compare the peer id in `/bootstrap` against the live relay's own startup log (`relay.ts:140` prints `peerId=`). **TCP acceptance on 30333 is NOT evidence the advertised peer id is the listener's** — and note the live relay (138.197.116.56) is on a *different host* from the hub (104.236.0.175) |
| H18 | The two hub deploy scripts produce **different fleets** from the same `ENABLED_ROLES=hub` | `deploy-hub.sh:161-172` (ENABLED_EXTRA_VESSELS + publishes 18090/18260) vs `deploy-hub-pull.sh:139,145` (neither) | Both end with the same green status block (discovery + activity-api `/health`). `deploy-hub.sh:146-161` explains that omitting goal-host means the hub answers NO dispatches while looking healthy on :18080/:18100 — the pull script reintroduces exactly that omission | After any hub deploy, `curl <hub>:18210/health`, not just 18080/18100. On the live hub 18210/18090/18260 are **dropped** (curl exit 28), so this check currently cannot be run from outside |
| H19 | **"admin" is not a server-side privilege boundary.** Any valid key — including a read-only one — can `POST /v1/jwt/generate` asking for `role:'admin'` (the mint checks identity, never scope) and then use that Bearer JWT against the admin-only `/v1/keys/issue`, which trusts `payload.role` | `repos/identity-vessel/src/index.ts:422-489`; `resolvers/issue-key.ts:92-107` | `docs/AUTH_JWT_CLAIMS.md:143-148` frames the mint as "identity-binding rather than privilege-granting" and says "Scope is enforced downstream" — but downstream reads the very claim the caller chose. The escalation is also the **documented operator workflow** (`substrate-key issue`), so it never looks anomalous | Take a key whose `/v1/keys/validate` scopes are exactly `['read','write']`, run `substrate-key issue probe read,write` and observe it succeed |
| H20 | A SurrealDB outage silently **DEMOTES** an admin key to read/write instead of failing | `validation.ts:247-282` (catch at `:274-281` returns null); defaults at `index.ts:1043`, `issue-key.ts:86`, `apiKeyAuth.ts:82` | The key still validates (`valid:true`), so nothing reports an auth failure. The symptom is a 403 "does not have admin scope" on an admin key — an authorization message pointing at the credential when the fault is the database | When an admin key 403s, `POST /v1/keys/validate` and check whether `.data.scopes` contains `admin`. If it reads `['read','write']` for a key `substrate-key list` shows as read+write+admin, the DB lookup is failing |
| H21 | **C6 issuer delegation is structurally dead** for every key this substrate mints: `keyGeneration` stamps `iss` from `IDENTITY_ENDPOINT` at mint time (`http://127.0.0.1:8101`), and on any peer that string also matches SELF_ISSUER, so delegation is never attempted | `keyGeneration.ts:35`; `validation.ts:62-65` (`isSelfIssuer`) and `:363-369` | The rejection surfaces as `Invalid API key signature` — indistinguishable from a rotated secret or a corrupted key — rather than anything mentioning issuers. The delegation code is present, tested and looks live | Read the error **STRING**, not the code: `Invalid API key signature` = delegation never ran; `Untrusted key issuer: <url>` = it ran and the allowlist refused; `Issuer rejected key` = a real round-trip. Also decode the key payload's 4th field — a loopback `iss` can never delegate |
| H22 | `/v1/keys/validate` answers **HTTP 200 for a REJECTED key**; the verdict lives in `.data.valid`. Any check written as `return r.ok` or `-w %{http_code}` reads every rejection as a pass | `repos/identity-vessel/src/index.ts:1006-1014`; the fixed consumer is `seed-identity.ts:115-136` | It already caused a measured outage: seed-identity logged "existing key authenticates — nothing to re-issue" on every run while bootstrap-seeder failed 18/18 templates with 401 (`seed-identity.ts:120-128`). The re-issue branch was correct and simply unreachable | Assert on `.data.valid == true`. The endpoint is also rate-limited at 100/window (`index.ts:994`), so a hammering loop can return 429 — which is not a credential verdict either |
| H23 (V) | The vessel edit gate has a **relative-path bypass** and leaves `packages/*/src/**` entirely ungated, although three vessels consume it as a `file:` dependency | `substrate-vessel-edit-gate.sh:18` (`grep -Eq '/repos/[^/]+/src/'`, leading slash required); consumers `repos/identity-vessel`, `repos/terminal`, `repos/react-renderer` | The gate returns exit 0 on a NOMATCH, which is indistinguishable from "this file is not gated on purpose". And a `packages/` change cannot even be dispatched as a goal — every goal-host edit-intent regex (`index.ts:11192,11645,11707`) is anchored on the literal `repos/` — so there is no gated path either | Controls with the same ugrep the hook uses: `/x/repos/activity-api/src/a.ts` MATCH; `repos/activity-api/src/a.ts` NOMATCH; `/x/packages/shared/src/a.ts` NOMATCH |
| H24 (V) | **NotebookEdit bypasses both the PreToolUse edit gate and the PostToolUse memory mirror** | `.claude/settings.json` — both matchers are the literal string `"Write\|Edit\|MultiEdit"` | NotebookEdit is a real, callable tool in this harness and it writes files. A `.ipynb` under `repos/<vessel>/src/` is editable with neither hook firing, and a NotebookEdit to a memory file would not mirror either | `cat .claude/settings.json` and compare the matchers against the harness's actual tool list |
| H25 (V) | The memory-mirror hook cannot find `bun` and has failed **silently on every invocation, 66 times**, most recently 2026-08-25; the last successful mirror was the Aug 20 batch | `~/.claude/substrate-memory-mirror.log`; `substrate-memory-mirror.sh:36` | The hook writes only to its own log; nothing surfaces the failure to the session. `.mcp.json:8` explicitly prepends `/home/avi/.bun/bin` to PATH for the MCP server — the hooks got no equivalent, which is why the MCP works and the hook does not | `rg -c 'bun: command not found' ~/.claude/substrate-memory-mirror.log` → 66; `rg ': (created\|updated)' …log \| tail -2` → the last success. Confirm the cause with `command -v bun` vs `bash -lc 'command -v bun'` |
| H26 (V) | In a multi-file edit goal, **only the FIRST named file receives a verbatim excerpt block and a line anchor**; files 2..N reach the drafter with a path and nothing else | `index.ts:11223`/`:11712` enumerate all files, but `verbatimExcerptBlock` (defined `:10452`) is called only at `:11238` and `:11755`, each passing the first matched file; `earlyEditSite`/`editSite` (`:11227-11228`, `:11720`) derive from the same single variable | Enumeration works, so the goal *looks* handled; the drafter receives N paths. This is exactly the fabrication-prone condition the gate's own denial text warns about ("plans addressed by line number rather than by quoted content are the ones that fabricate") | Naming N files gets you **one** grounded edit and N-1 ungrounded ones. Read the drafter prompt's `edit_site` field — it names only file #1. Dispatch one file per goal |
| H27 (V) | `substrate-doctor` check 6 (recovery-coverage lint) is **structurally vacuous on every deployment of this image** and prints PASS unconditionally | `substrate-doctor.sh:242-248` reads `/etc/systemd/system/$u`; `Dockerfile.substrate:208-213` vendors all units to `/usr/lib/systemd/system` **by design**, and the only `/etc` entries are `-> /dev/null` masks (for which `[ -f ]` is false) | It is a green line in doctor's output. Nothing distinguishes "every unit has recovery configured" from "no unit was examined" | Add a candidate-count assertion, or read `systemctl show <u> -p FragmentPath` to see where units actually live |
| H28 (V) | **`config-surface-probe.sh`, `warn-baseline-drift.sh` and `failure-mode-harness.ts` have ZERO call sites** — the repo's dedicated configuration/law-1 drift detectors and the harness `CLAUDE.md` designates as "Validation" are never invoked | `rg config-surface-probe` → only `.md` files + `Makefile:159` (a **comment**); not among `Dockerfile.substrate`'s individual `COPY scripts/substrate/*.sh` lines. `rg warn-baseline-drift --glob '!validation/**'` → only lines 2 and 28 of itself. `validation/scripts/run-weekly-harness.sh` runs five other harnesses | A script nothing invokes cannot be observed failing, so it can never be trusted when it passes — the repo's own script-retention convention names this defect | Resolve callers by **directory and glob reference**, not basename. Presence in the container proves nothing; an untracked worktree copy reads as a caller of itself |
| H29 (X) | `ROUTE_EDIT_INTENT_TO_COMPOSE` — the documented autonomy kill switch — is a **create-time container env var** with no delivery path into a resumed container | Read per-request at `goal-host index.ts:11191,11645,11706`; emitted by `gen-env.sh:578`; passed by `Makefile:618`, added in commit `42302670` (2026-08-23 02:59) | An operator reading the cockpit docs believes setting the variable and restarting halts autonomous edit landing. `docker start` / `make up` on an existing container cannot deliver a new value, and the audited fleet predated the Makefile line entirely | Halt it with `make recreate` (which carries by name, `Makefile:494-498`) or an in-container `/etc/substrate/env` edit **plus** a goal-host restart. Verify with `docker inspect <c>` env **NAMES**, not with the Makefile |
| H30 (X) | The repo-local and home `.metabob/config.json` are identical **by coincidence**, not by construction — and only the home copy has a writer | `.mcp.json:8` pins the cockpit to `<repo>/.metabob/config.json`; `configure-local.sh:16` writes only `~/.metabob/config.json` and is run unconditionally by `make up` (`Makefile:458-462`) with output discarded | Any `make up` that re-seeds the fleet key updates the HOME copy and leaves the REPO copy — the one the cockpit loads — stale. Every cockpit tool then 401s while the SessionStart/SessionEnd hooks keep working, and it presents as "the MCP is broken" rather than "the key rotated". The untracked `.metabob/config.json.hub-backup` (still `syzygy.host:18080`) is the fossil of a prior one-sided repoint | Compare the parsed `.metabob.apiKey` of **both** files after every `make up`. Treat divergence, not equality, as the expected post-`make up` state |

### 13.3 Medium (29)

| # | Trap | Where | Why invisible | How to detect |
|---|---|---|---|---|
| M1 | gen-env **PINS ~17 variables as fixed literals**: `-e TRACE_STORE_CAP=999` is accepted by docker, reaches the process, and emerges as 150000 | `gen-env.sh:494-504` (list + stderr notice), `:743` (the literal) | Docker accepts the flag and the container boots. The notice is stderr-only and buried in boot output | `docker exec <c> grep -E '^TRACE_STORE_' /etc/substrate/env`, or `substrate-config`, which reports these as `hardcoded` |
| M2 | gen-env's own round-trip check reads the **EMITTED FILE**, so a generation-time error in gen-env is invisible to it — and gen-env's stderr is not gated on by anything | `gen-env.sh:869-905` vs the boot log | The check answers "is the file parseable and its JSON valid?", which can be YES while gen-env raised errors during generation. `set -euo pipefail` did not abort, no unit failed, the fleet came up green | `docker logs <c> \| grep -E '^/usr/local/bin/gen-env:'`. Both observed boots printed a `command substitution: syntax error` line; commit `f32b2274` (2026-08-23 02:59:20 -0700) removed the offending backticked span **after** the last observed boot, so re-measure on the next boot rather than assuming |
| M3 | `up` runs `configure-local.sh` with output discarded, and configure-local **HARDCODES** `http://localhost:18080` — and it is not the file this repo's cockpit reads | `Makefile:458-462`; `configure-local.sh:16`; `.mcp.json` (`METABOB_CONFIG_PATH`) | A failure prints only `[up] configure-local skipped`. A `substrate-live` created with `PORT_OFFSET≠0` gets a config pointing at a port nothing serves | `jq -r '.metabob.endpoint' ~/.metabob/config.json` vs `docker port <c> 8080/tcp`. Separately, `.mcp.json` points at `<repo>/.metabob/config.json`, a file configure-local never writes |
| M4 | `bootstrap-seeder` is `Type=simple`, so systemd marks it started as soon as it forks — a seeder that never converges no longer blocks boot, but **nothing gates on it either** | `units/bootstrap-seeder.service` (Type=simple rationale block) | Deliberate and correct (as oneshot it held `multi-user.target` for up to ten minutes on a spoke), but a fleet can reach "ready" with templates un-seeded. It also exits non-zero if ANY template is rejected, exhausting its restart budget and leaving systemd `degraded` | `journalctl -u bootstrap-seeder \| grep -E '✗\|Seeding complete'` |
| M5 | A committed `vessels.inventory.json` change that pull-sync has already converged into the volume sits **INERT** until the container restarts | `docs/SUBSTRATE.md:109-129`; `entrypoint.sh:24-52` (apply-inventory runs once, pre-systemd) | No command reconciles or reports this drift automatically; `substrate-doctor` reads the inventory but does not compare it against the running unit set | `vessel-ctl drift` (read-only) — but read a clean `drift` as "the selection is already applied", **never** as "`apply` would do nothing": drift previews only the symlink half (`docs/SUBSTRATE.md:808-814`) |
| M6 | The fleet **TOOLING** in the image is not the tooling that will run at the next boot — pull-sync replaces `/usr/local/bin/{gen-env,apply-inventory,vessel-ctl,substrate-pull-sync}` from `origin/dev` | `docs/SUBSTRATE.md:918` | Reading `Dockerfile.substrate` or the published image tells you what the FIRST boot did, not what the next one will do. An image built from an unpushed tree loses those local changes within one tick | `docker exec <c> md5sum /usr/local/bin/gen-env` vs `md5sum scripts/substrate/gen-env.sh` |
| M7 | `vessel-ctl list` reports `"active":"inactive"` for a vessel that has **no unit file anywhere** — indistinguishable from installed-but-stopped | `vessel-ctl.sh:160-168` (no existence check, unlike status/restart/start/stop/deregister/uninstall) | `systemctl is-active` returns the literal string `inactive` (rc=3) for a nonexistent unit, and vessel-ctl folds only the EMPTY case to `unknown`. The rc is discarded by `\|\| true` | Cross-check any `list` row with `vessel-ctl status <name>`, which refuses a nonexistent unit. Control: `systemctl is-active nosuchvessel-xyz.service` → `inactive` |
| M8 | The `vessel-ctl status` **fleet view omits** a shipped unit that is disabled and never loaded — including the single unit apply-inventory's conformance pass warns about | `vessel-ctl.sh:424-425` — the row source is `systemctl list-units --all`, which enumerates LOADED units only | The view is 97 rows long and looks exhaustive, and the doc says to use it in preference to `docker ps`. The same script's comments record fixing this asymmetry twice already (masked units, static units) | Diff `systemctl list-unit-files` against `systemctl list-units --all`. Control: `coherence-metric.service`, also disabled, IS listed because its timer keeps it loaded |
| M9 | `depends_on` in the manifest renders to `After=` **only** — no `Requires=`, no `Wants=`, and `install` performs no dependency resolution | `render-unit.sh:40`; `vessel-ctl.sh:170-247` contains no read of `.depends_on` | systemd silently ignores an `After=` term naming a unit that does not exist, so the ordering constraint evaporates rather than erroring. `vessel-ctl install federation-transport-vessel` does NOT install federation-relay | `render-unit <vessel>` and check each `depends_on` target with `systemctl cat <dep>` before believing the ordering |
| M10 | apply-inventory can only govern units the inventory **NAMES**; a shipped-but-unlisted unit runs in every role, and the detector is warn-only by design | `apply-inventory.sh:348-390` | Warn-only deliberately (masking an unlisted unit would let a packaging omission take a vessel down at boot), and the warning goes to the boot journal. This is how a UI-only box ended up running three LLM resolvers. Rendered `llm-<id>` arm units are a permanent instance — created AFTER selection, under names the inventory can never contain | `vessel-ctl drift` surfaces the warning on demand. Note the prior claim that this detector "never runs on the default topology" is **false** — the no-selection branch falls through and the warning fired on the audited default fleet |
| M11 | `metric-collector-vessel` is defined **TWICE** — as a baked static unit in `/usr/lib` and as a manifest (installable) vessel — contradicting the manifest's own framing | `vessels.manifest.json:5-15` vs `/usr/lib/systemd/system/metric-collector-vessel.service`; absent from `vessels.inventory.json` entirely | `install` would render a `/etc` unit shadowing the baked one; `uninstall` removes only the `/etc` render and silently **un-shadows** the `/usr/lib` copy, so the vessel is not actually removed. Neither reply mentions the second definition | `ls /usr/lib/systemd/system/<name>.service` before trusting an uninstall, and `systemctl show <u> -p FragmentPath,DropInPaths` |
| M12 | The collaborate loop's engagement back-off **can never fire** on any deployment without a vault at the hardcoded path | `obsidian-collaborate-tick.sh:38-39` — `find … 2>/dev/null \| wc -l` on a nonexistent dir returns 0, and the guard requires `UNENGAGED >= 2` | The guard's whole purpose — not piling notes on a disengaged human — is silently disabled, and the only symptom is a pass that runs when it should have skipped | `ls -d /vaults/substrate-vault/Substrate/Collaboration` and look for the "collaboration backing off" line. Its total absence across a long idle window is the tell |
| M13 | `obsidian-learn-tick` dispatches a **real goal every 30 minutes** on a deployment where the assist can never be verified against a vault — grading arms on infrastructure absence | `obsidian-learn-tick.sh:83-84`; `vessels.inventory.json:351-353` puts the three obsidian units under role `ui`, which the **`spoke` role group includes** | The dispatch returns `{"dispatchId":…,"status":"running"}` and the script moves on; the outcome is graded in the trace store, not here. `ui-only-up.sh:241-243` excludes `light-dispatch-healthcheck.timer` for exactly this reason ("would record infrastructure absence as arm quality — the boredom-vessel failure mode") | `journalctl -u obsidian-learn \| rg dispatchId`. **Scope correction:** `ui-only-up.sh:250` sets a closed 10-unit `ENABLED_VESSELS` allowlist that omits the obsidian timers, and `apply-inventory.sh:178-181` shows `ENABLED_VESSELS` overrides role selection — so the launcher is already safe. The exposure is a spoke brought up **by role** (`make up ENABLED_ROLES=spoke`), which has no equivalent guard |
| M14 | Two `obsidian_*` pointer types the learn tick calls **do not exist**, and the script swallows both | `obsidian-learn-tick.sh:66-77` (`obsidian_ui_perception_scan`) and `:82` via `call()` at `:81` | `call()` pipes to `head -c 300` and never checks `.success`; the unit is a oneshot with no `-e`. The UI-self-perception pass — whose entire job is to notice that a write did not render — is itself the thing that never runs | `journalctl -u obsidian-learn \| rg '"success":false'` → two hits per pass. Control: `rg -no 'obsidian_[a-z_]+' repos/development-vessel/src \| sort -u` returns 24 pointer types that DO exist |
| M15 | `obsidian_reflect` reports `wrote:true` about the **local render file** while the vault write it exists to perform failed | development-vessel's `obsidian_reflect` resolver, observed at `obsidian-learn-tick.sh:54-64` | The top-level flag describes `/workspace/vault-render/Workflow.md`; the failure is buried in a nested `vault_write:{wrote:false,reason:…}` | Read `.body.vault_write.wrote`, not `.body.wrote` |
| M16 | `obsidian-plugin-reload.sh` prints **SUCCESS and exits 0** when the reload endpoint is dead | `obsidian-plugin-reload.sh:27` (host literal), `:38` (`mkdir -p`), `:76-86` | The non-fatal-reload behaviour is deliberate and documented, but the summary line uses the word SUCCESS regardless. **Corrected:** on THIS box the hardcoded path exists and is the real symlink-wired vault dir, so the `mkdir -p` decoy hazard is a claim about *other machines only* | Read the `reload-plugin HTTP <code>` line above the SUCCESS line, and confirm `$PLUGIN_DIR` pre-existed. HTTP 000 means nothing was told about the new bundle |
| M17 | The launcher's hub fallback takes `.metabob.endpoint` **VERBATIM including the port**, so a surface can be pointed at the trace store and call it a hub | `ui-only-up.sh:151-152` with only a scheme check at `:173` | `configure-local.sh` writes `.metabob.endpoint` as the trace store (`:18080`). The fallback does not rewrite `:18080` to `:18100`. The page loads and then cannot dispatch — which reads as a network problem. The launcher's own error text at `:170` even names `.metabob.hubDiscovery`, and `docs/HUMAN_SURFACE.md:81-84` tells the reader to ignore the endpoint hint | The step-14 hub-registry assert catches it, but only after a full boot. Set `.metabob.hubDiscovery` explicitly before launching |
| M18 | `vessel-ctl` swallows the human-surface `post_install` hook's output AND its exit status, so `install` reports `ok:true` whether or not `ui/dist` exists | `ui-only-up.sh:569-572` states this; the compensating assert is `:573-586` | A vessel that boots, answers `/health`, and serves nothing is indistinguishable from a healthy one on every check except the directory listing. The launcher compensates — **nothing outside the launcher does** | `docker exec <c> test -d …/ui/dist` and `rg UI_BUILD_FAILED /workspace/human-surface-ui-build.log`. dist-exists AND log-says-FAILED means the dist you are serving is stale |
| M19 | A federation transport in a restart loop reports `activating`, **never `failed`** | `docs/HUMAN_SURFACE.md:266-271` | `Restart=always` parks a crash-looping unit in `activating`, invisible to `--state=failed` and to substrate-doctor's failed-unit check, which passed on a surface whose transport had restarted 222 times. The launcher's own transport line (`ui-only-up.sh:680-682`) is advisory and excluded from OVERALL | Ask for `restarts=` in `vessel-ctl status`, never `is-active` |
| M20 | The checked-in discovery drop-in hardcodes a peer discovery at `138.197.116.56:18100` that does not answer, **and it can never take effect anyway** | `units/discovery-vessel.service.d/federation-peering.conf:13`; `gen-env.sh:694` | systemd applies `EnvironmentFile=` values **over** `Environment=` regardless of ordering, and gen-env unconditionally writes `PEER_DISCOVERY_ENDPOINTS` into the env file — including as an empty string. So the drop-in's peer endpoint is permanently dead code while `MAX_PEER_DEPTH=1` from the same file DOES apply (that name is not emitted by gen-env) | Read the MainPID's `/proc/<pid>/environ`, never the unit file |
| M21 | `spoke-federate.sh`'s uniqueness check **passes when the hub query FAILS** | `spoke-federate.sh:41-44` (`hub_resolve` ignores HTTP status), `:75-77` (`grep -c … \|\| true`) | A 401 or network error yields an empty/JSON-error body, jq extracts nothing, the count is 0, and the script pins an id that may already be taken — producing two substrates deriving the same libp2p peer id and fighting over one reservation | Check the HTTP status of the hub query separately before trusting the count; a hub that 401s should abort, not pass |
| M22 | `spoke-federate.sh` accepts **ANY body** from the transport's `/health` as proof of federation | `spoke-federate.sh:94-101` | The transport answers `/health` as soon as its Bun server binds, whether or not it holds a relay reservation. The script then prints "this substrate now mirrors its local registry into `<hub>`" — a claim it never verified | Parse the health payload for a non-empty **circuit** multiaddr, or query the hub registry for `@<substrate-id>` rows |
| M23 | An ingress sidecar with no reservation registers itself with `libp2p_multiaddr: []` — an undialable row that survives the 5-minute TTL | `repos/libp2p-federation-transport/src/sidecar.ts:129,146,182` | Only a local `console.warn`; the registration succeeds with HTTP 200 and the row appears in the registry. The receiving discovery drops it only if the endpoint is also loopback — and it is (`sidecar.ts:175`) — so the vessel silently never appears to peers while looking registered from its own side | Compare the sidecar's own `/health` `libp2p_multiaddr` against what a peer's capability query returns for the same shape |
| M24 | **Key expiry is metadata that nothing enforces.** `expires_at` is stored and displayed but is not in the signed payload and no validation path reads it | `keyGeneration.ts:38` (signed payload is `${orgId}-${userId}-${keyId}-${iss}` only), `:59-61`; `validation.ts:186-228`, `:247-282` | `substrate-key list` prints an `expires_at` column and `/v1/keys/issue` accepts `expires_in_days`, so the feature appears to exist. `docs/RBAC_TROUBLESHOOTING.md:280-285` even instructs the operator to diagnose expiry from the validate response — which has no such field | Validate a key whose row shows a past `expires_at`; it returns `valid:true` |
| M25 | Per-vessel key attribution (D4) silently collapses to **one shared identity** | `seed-identity.ts:277-290` (print only) vs `gen-env.sh:262-265` (fallback) | Every vessel authenticates successfully, so nothing errors. Only trace attribution is wrong — all vessels appear as the same `key_id`. The block also never executes on a 409 re-seed (`:204`/`:222` return first), so the keys exist in `api_key` from an old first boot and look provisioned in `substrate-key list` | `docker exec <c> sed -n 's/^GOAL_HOST_VESSEL_API_KEY=//p' /etc/substrate/env` and compare to `METABOB_API_KEY` |
| M26 | identity-vessel's `apiKeyAuthMiddleware` and `requireScopes()` are **dead code** — defined, documented in prose ("Bearer `<key>`: legacy format"), never mounted on any route | `repos/identity-vessel/src/middleware/apiKeyAuth.ts:19-88`, `:93-123` | `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md:333` describes exactly this dual-scheme extraction as the vessel pattern, so a reader assumes it is the live gate. Each endpoint instead re-implements its own header parsing — which is why `/v1/keys/generate` and `/v1/keys/revoke` have none at all | `rg -n 'apiKeyAuthMiddleware\|requireScopes' repos/identity-vessel/src` — only the two definition lines come back |
| M27 | Revocation propagation lags up to 60 s at discovery-vessel, and the **whole enforcement rests on one valkey key** — `validateKey()` never reads `is_active` | `repos/discovery-vessel/src/middleware/auth.ts:154-156,168-171`; `db/redis.ts:46-53`; `validation.ts:247-282` | `substrate-key list` reads `is_active` and will keep reporting "revoked" correctly after a valkey wipe, so the operator surface says the key is dead while every validator accepts it | After clearing or losing valkey, `POST /v1/keys/validate` for a key `substrate-key list` shows as revoked. `valid:true` means enforcement is gone. **Treat valkey as security-critical identity state** |
| M28 (V) | `substrate-doctor` check 5b's restart-loop detector has a 25 s window, and exactly one unit escalates past it — **goal-host, the dispatch entry point** | `substrate-doctor.sh:197-232`; `units/goal-host-vessel.service:34-35` (`RestartSteps=3`, `RestartMaxDelaySec=30`) | A loop at the escalated 30 s delay registers zero delta across the window and reads healthy. (Two precision notes: systemd has **no** default exponential backoff — these are opt-in — and no unit has a static `RestartSec>=25`; the sweep max is 20) | Raise `DOCTOR_LOOP_WINDOW` above 30 for a goal-host investigation, or sample `NRestarts` over a longer interval |
| M29 (V) | goal-host **auto-re-dispatches** every restored in-flight goal younger than 600 s, 20 s after a restart — and those re-fires carry identical goal text, so they interact directly with the coalesce path | `index.ts:15598-15625` (restore + `setTimeout(… fetch('/run-goal', {goal: old.goal, tags:['resumed_from:'+old.dispatchId]}) …, 20000)`); coalesce at `:14232-14240` | Undocumented in both the map and the cockpit docs. Restarting goal-host silently re-runs recent work; the store also caps at 100 with a 20-record prune (`pruneStore()`), so the evidence of what was re-fired can be evicted | `rg 'resumed_from:' ` over dispatch tags after any goal-host restart |

### 13.4 Low (7)

| # | Trap | Where | Why invisible | How to detect |
|---|---|---|---|---|
| L1 | `LLM_ARMS` is escaped and JSON-round-trip-checked but **never emitted**, so half the round-trip check can never fire | `gen-env.sh:534` (escape), `:896` (check loop), heredoc `:536-801` (no `LLM_ARMS` line) | A check that cannot fail looks identical to a check that passes. Consistent with design (`docker-compose.yml:53-55` states `LLM_ARMS` is read pre-systemd), but the instrument is dead | `docker exec <c> grep -c '^LLM_ARMS=' /etc/substrate/env` → 0 |
| L2 | `make -n <deleted-target>` used to copy a `.sh` file and exit 0, making a documented-but-nonexistent target silently succeed | `Makefile:305-313` (`.SUFFIXES:`) | make's built-in `%: %.sh` rule ran `cat vessel-ctl.sh > vessel-ctl` and returned 0. A `.PHONY` name left behind after deleting its recipe printed "Nothing to be done" and also exited 0 | **Verified CLOSED:** `make -n vessel-ctl / substrate-doctor / doctor / down / health / seed-live` all fail with "No rule to make target"; `up, recreate, stop, clean, build` exist |
| L3 | The manifest's `env_from_file` array is **decorative** — `render-unit` never reads it | `vessels.manifest.json:37,50` vs `render-unit.sh:36-40` | It works anyway, incidentally, because `render-unit.sh:72` unconditionally emits `EnvironmentFile=/etc/substrate/env` — the whole file. So the declaration appears honoured, and a maintainer would believe removing a key from `env_from_file` removes it from the unit's environment | `render-unit <vessel>` and look for the named keys as `Environment=` lines. For federation-transport-vessel, `FED_PUBLIC_IP`/`RELAY_MULTIADDR`/`FED_VESSEL_ID`/`FEDERATION_SIGNING_SECRET` appear nowhere |
| L4 | A `vessel-ctl`-installed dynamic vessel writes a **real** unit file into `/etc/systemd/system`, which cannot be masked by role selection | `vessel-ctl.sh:236`; `apply-inventory.sh:337-338` (`warn: $u has a real unit file in /etc — cannot mask`) | apply-inventory already excludes `manifest:true` units from the mask loop, so the warning normally never fires — the two mechanisms agree by construction. The exposure is that role selection is genuinely not a control over manifest vessels, which the inventory documents in prose (`vessels.inventory.json:38`) but no command reports | `jq '.vessels[]\|select(.manifest)\|.unit' vessels.inventory.json` for the governed-nowhere set, plus `vessel-ctl list` |
| L5 | **28 `.service` units read `disabled`** on a fleet whose selection is "everything enabled" — which reads as an outage and is not one | `apply-inventory.sh:319-326` — a desired `.service` whose `.timer` is also desired is deliberately NOT enabled | Nothing in the fleet view or the docs distinguishes the expected 28 from a real one | For each disabled service check `systemctl cat <name>.timer`. Re-measured: 28 disabled, **28/28** have a timer sibling, 0 exceptions |
| L6 | The host-port collision preflight **degrades to a warning** when `ss` is absent | `ui-only-up.sh:402-409` | The script prints one WARNING line among a long PLAN block and proceeds. `docker run` then fails on the first conflicting `-p`, leaving a created-but-dead container that trips the name check on the next attempt — so the second run's error names the wrong problem | Look for `[ui-only-up] WARNING: ss not found` in the launch output |
| L7 | The transport logs **"hub mirror disabled"** on a hub while still writing per-vessel `@`-qualified rows into that hub's own registry | `federation-transport-server.ts:576` vs `:617,633-634` | An operator debugging apparent duplicate rows on a hub reads the startup log, concludes the mirror is off, and looks elsewhere. `FEDERATION_GENRES.md:158-164` documents the discrepancy; the log itself was never fixed | Expect `@<substrate>` rows in a hub's own registry even when SELF_MIRROR logged as disabled |

### 13.5 Severity unknown — source record truncated (1)

| # | Trap | Where | Why invisible | How to detect |
|---|---|---|---|---|
| U1 | An `Authorization` header sent to a **PUBLIC** discovery read turns a working request into a 401. Public paths skip auth only when no header is present; supply one and it is validated, so an unreachable identity-vessel breaks reads that would have succeeded anonymously | `repos/discovery-vessel/src/middleware/auth.ts:303-313` | **The source record for this trap was truncated in the family-5 map** — its `why_invisible`, `detection` and `severity` fields were never delivered. The mechanism is corroborated independently at F5-P4 step 3 | Retry the same public read (`/health`, `/bootstrap`, `/shapes`, `/registry/shapes`, `/registry/stats`, `/metrics`) **with the Authorization header removed**. A 200 without the header and a 401 with it is the signature |

---

## 14. Contradictions and unresolved deltas

46 records: 36 in-family, 4 added by the verification pass, 6 cross-family. Family 5 delivered **no**
contradictions array (truncated source) — that is an absence of data, not an absence of contradictions.

### 14.1 Family 1 — Bootstrap (11)

| Claim A | Claim B | Which runs | Evidence |
|---|---|---|---|
| `docs/SUBSTRATE.md:1332` — development-vessel runs `seed-templates` via `ExecStartPost` on every start | `units/development-vessel.service:24-29` — ExecStart is the server only; seeding split into `development-vessel-seed.service` | **The code.** The doc describes a design deliberately dismantled because it held `multi-user.target` for up to ten minutes | The unit carries the comment "Template seeding used to run here as ExecStartPost. It now lives in…"; `development-vessel-seed.service` exists (3350 B) and ran to completion |
| `Makefile:429-434` — the "equivalent raw contract" comment publishes **seven** ports | `README.md:171-177`, `docs/SUBSTRATE.md:326-331`, `docker-compose.yml:111-126`, `Makefile:626-634` — **nine** | **Nine.** `README.md:179` states it explicitly; the Makefile's own recipe publishes nine | `Makefile:432-433` omits 18101 (identity) and 18310 (human surface). Only the explanatory comment is stale — a reader who copies it loses identity and the human surface |
| `README.md:293-294` / README prose — 18 shared templates | Live `bootstrap-seeder` journal: `Seeding complete: 19/19 templates seeded.` | **The live count.** `SHARED_TEMPLATES` is a moving list; any hardcoded count in prose goes stale | 2026-08-24 05:36:19 journal line |
| `gen-env.sh:927-937` — the file's own comment asserts "backticks are FORBIDDEN in this heredoc" and records the defect | Both observed boots printed exactly that `command substitution: syntax error` | **Both, in sequence.** Repair landed at `f32b2274` (2026-08-23 02:59:20 -0700), the last observed boot was 2026-08-23T01:00:24Z — **before** the fix | The commit body independently states the stderr string and "Verified: 2 stderr lines -> 0". Correct disposition: *fixed in code, unverified on a boot* |
| `docs/SUBSTRATE.md:635` — persisted set is 6 names + provider keys + `RUNPOD_*`; `FEDERATION_SIGNING_SECRET` is "not in the boot set" | `gen-env.sh:938-994` persists a strictly larger set, **including** `FEDERATION_SIGNING_SECRET` (≈`:993`) | **The code.** The doc understates what survives a recreate — the list an operator uses to decide what must be re-passed | Also persisted and undocumented: `SUBSTRATE_ADMIN_KEY`, `API_KEY_SECRET_PREVIOUS`, `GITHUB_TOKEN`, `LLM_DEFAULT_MODEL`, `ENABLED_EXTRA_VESSELS`, four `VLLM_*`, `PEER_DISCOVERY_ENDPOINTS`, `MAX_PEER_DEPTH`, `FEDERATION_PEER_AUTH_MODE` |
| `README.md:294` advises `DISABLED_VESSELS=bootstrap-seeder` (bare) while `docs/SUBSTRATE.md:402` advises `bootstrap-seeder.service`; `apply-inventory.sh:107` records the bare form once disabling nothing | `apply-inventory.sh:117-124,143-162` — bare names now RESOLVE; only genuine typos are fatal | **Both forms work today.** The historical comment at `:107` reads, at a glance, like a live defect | `resolve_token()` tries exact → `.service` → `.timer`; `fatal_if_unresolved()` aborts only on a real sentinel. **Recorded to RETIRE a would-be contradiction rather than file one** |
| `validation/reports/SETUP_AND_JOIN_DOC_DELTA.md` records `make show-key LIVE_NAME=…` as a PASSing verified promise | The Makefile has no such target; `Makefile:29-47` records the deletion of ~40 wrappers as deliberate | **The Makefile.** The prior row is SUPERSEDED; the surface is `docker exec <c> substrate-key show` | `make -n seed-live` and every other deleted name return "No rule to make target" |
| `Makefile:949-950` — clone-vessel-repos' header: clones are "bind-mounted to /workspace inside the substrate container" | `Makefile:75-77` — "Legacy HOST paths … No longer mounted into the live container" | **`Makefile:75-77`.** The live container's only mounts are the two named volumes | `run-live` (`:626-638`) prints "NOTHING from the host is bind-mounted". Two statements in one file ~880 lines apart |
| `README.md:53` — "There is no supported command-line dispatch client" | `README.md:198-202` presents `curl -X POST http://localhost:18210/run-goal` as the post-bring-up smoke test | **Not a defect** — the carve-out at `:53` explicitly sanctions the HTTP surface | Recorded because the two sentences read as contradictory to a first-time reader, and `README_FIRST_READER_AUDIT` names "the README promises what docs/ correctly caveats" as this family's dominant pattern |
| The task brief names `make doctor` and `make down` as targets to map | Neither exists; `Makefile:29-47` documents the removal of every in-image-tool wrapper as deliberate | **The Makefile.** The verbs are `docker exec <c> substrate-doctor` and `make stop` / `make clean` | The real `.PHONY` set (`Makefile:315`) is 19 targets: build, build-obsidian, clean, clean-live, clone-vessel-repos, migrate-state-to-volumes, preflight-submodules, recreate, run, run-detach, run-live, run-live-obsidian, stop, stop-live, ui-bridge-{up,down,status}, up, validate-build |
| `scripts/substrate/docker-compose.cluster.yml:9-10` — "the fixture the setup instructions are tested against" | No operator-facing document references it | **The file is real and self-documenting, but discoverable only by browsing `scripts/substrate/`** | `rg -l 'docker-compose.cluster'` → `validation/findings/config-surface-audit.md` and the file itself. An availability gap, not a correctness one |

### 14.2 Family 2 — Roster (7)

| Claim A | Claim B | Which runs | Evidence |
|---|---|---|---|
| `docs/HUMAN_SURFACE.md:202` — `vessel-ctl drift  # what does this fleet actually run?` | `vessel-ctl.sh:595-602` compares the volume inventory against the **IMAGE**, never git, and never inspects `vessels.manifest.json` | **The code.** `drift` answers a narrower question than the doc implies and is structurally blind to the manifest | Drift printed `identical` while, in the same minutes, pull-sync logged `vessels.manifest.json was modified locally … git version NOT applied` on every tick |
| `BRINGUP_THREE_PATHS.md:951` — `DRY_RUN=1 apply-inventory` MUTATES a live container; "there is no safe rehearsal" | `apply-inventory.sh:293-299` — the unmask branch is now explicitly DRY_RUN-guarded | **The current code.** SUPERSEDED — the guard landed after that report | `:294` `if [ "$DRY_RUN" = "1" ]; then log "DRY-RUN would unmask: $u"`. The container's copy was md5-identical to the repo's |
| `BRINGUP_THREE_PATHS.md:430-432` — "`full` omits the desktop role" | `vessels.inventory.json:23-36` — `.roles.full` carries all twelve roles including `desktop` | **The inventory.** SUPERSEDED; desktop was added to `.roles.full` at `d63d64b6` after the prose was written at `6d19c0a0` | `([.vessels[].role]\|unique) - ([.roles[][]]\|unique)` → empty; `.roles.full` selects 92 of 92 |
| `SETUP_AND_JOIN_DOC_DELTA.md` — "the ungoverned-units detector never runs on the topology that has ungoverned units"; "false-positives on manifest vessels by construction" | `apply-inventory.sh:31-57` removed the early exit; `:379` widened the baseline to `all_inventory_units()` | **The current code, on both halves.** SUPERSEDED | On the default-topology fleet drift emitted the warning naming exactly one unit (a true positive) and did **not** flag the installed manifest vessel |
| `VESSEL_INVENTORY_DOC_AUDIT.md §5` — the mask-recovery lever is defeated because apply sources the env file after the injection | `vessel-ctl.sh:119-130` `selection_override()` re-exports after the source, in both apply (`:507-509`) and drift (`:621-623`) | **The current code** — closed at source and current on the audited box | md5 of the repo script equalled md5 of `/usr/local/bin/vessel-ctl`. Closure verified in code, **not** by execution (the lever is a mutation) |
| `vessels.manifest.json:2` — "this file is for vessels added/removed at runtime"; `vessel-ctl.sh:19` — "THIS IS THE VESSEL MANAGEMENT SURFACE. There is no second one." | `metric-collector-vessel` is BOTH a manifest entry and a baked `/usr/lib` unit, and is absent from the inventory; `uninstall` removes only the `/etc` render | **The live filesystem.** The manifest's framing does not hold for this vessel, and `uninstall`'s `ok:true` does not mean the vessel is gone | `/usr/lib/systemd/system/metric-collector-vessel.service` exists (802 B) with no `/etc` counterpart |
| `vessel-ctl.sh:31` — "Every verb below works on ANY unit the fleet has, baked or manifest" | `list` (`:161`) enumerates `.vessels[].name` from the MANIFEST only — four names | **Both, read narrowly.** The per-unit verbs do accept any unit; `list` is manifest-scoped by design and its name invites the opposite reading | `vessel-ctl list` → 4 vessels; `vessel-ctl status` → 97 rows |

### 14.3 Family 3 — Human surface (6)

| Claim A | Claim B | Which runs | Evidence |
|---|---|---|---|
| `docs/HUMAN_SURFACE.md:51,226-235` — `ui/dist` is committed; the install skips the build; the pre-commit hook enforces it | `ui-only-up.sh:358,569-572` — "its post_install builds ui/dist — gitignored, so it MUST be built here" | **The doc.** `ui/dist` is TRACKED; the script's comments are stale. The asserts they justify (`:573-586`) are still correct — the failure just changed shape from "build failed" to "dist did not arrive with the clone" | `.gitignore:10`; `git ls-files ui/dist` → three files; `vessels.manifest.json:29` writes `UI_BUILD_SKIPPED`; `scripts/git-hooks/pre-commit:373-401` gates it |
| `HUMAN_SURFACE_INTERACTION_AUDIT.md:76-88` — `uiQuestion_write`/`uiPanel_write` are stored with "no route to read them" | `src/index.ts:80` `app.get("/api/state", …)` with `panels: listPanels()`, present since first commit `1098380a` | **Both, on different claims.** The read route EXISTS (it is `/api/state` on the app, not `/api/panels` on `proxyRouter`). **And the "no renderer" conclusion is itself wrong** — `SolicitationPanel.tsx` exists and is rendered at `DetailPanel.tsx:259` | `rg 'api/state\|panels\|uiQuestion' ui/src` → no matches; control `rg -li 'panel' ui/src` → 12 files, one of which is `SolicitationPanel.tsx`. **The real defect is the missing `solicitation_id` linkage** (`SolicitationPanel.tsx:7-14`) |
| `gen-env.sh:793-799` writes `OBSIDIAN_PLUGIN_ENDPOINT=http://127.0.0.1:27182` **unconditionally**, saying the plugin runs in `obsidian-desktop.service` | `obsidian-desktop-launch.sh:5-9` and `obsidian-desktop.service:18-20` — that unit runs ONLY in the `:obsidian` flavour, gated by ExecCondition | **Neither endpoint is right on a plain `:dev` container, and that is the defect.** gen-env writes the endpoint unconditionally while the thing that serves it is flavour-gated | The units that would serve 27182 correctly skip themselves via ExecCondition; the three tick timers keep firing at it with **no equivalent condition** |
| `obsidian-plugin-reload.sh:19-24` — `REPO_DIR` derived from the script's own location "to satisfy law 11: no host-specific literal" | `obsidian-plugin-reload.sh:27` — `PLUGIN_DIR="${OBSIDIAN_PLUGIN_DIR:-/home/projects/vaults/syzygy/…}"`, a host-specific absolute literal on the very next line | **The comment states the correct standard; the adjacent line violates it.** Half the fix landed | Corrected: the path **does** exist on this box (symlinks into this repo), so the local decoy claim is withdrawn — the portability defect stands for other machines |
| `ONE_SURFACE_AUDIT_DELTA.md:132` (Still open) — "vessel-ctl install of the human surface does not survive a recreate, and the docs prescribe recreate without warning" | `docs/HUMAN_SURFACE.md:245-258` — a dedicated "Recreating one — what you lose" section says exactly this | **The doc-gap half is SUPERSEDED** — the warning now exists. The underlying behaviour is still true and still documented | — |
| `ONE_SURFACE_AUDIT_DELTA.md:136` (Still open) — "`make up` injects the operator host's provider key into a spoke" | `Makefile:500-515` `RECREATE_CARRY_PRESENT` carries provider keys by PRESENCE, empty included | **The fix has landed in code for the recreate path**; `ui-only-up.sh:279-289` independently blanks provider keys at launch. Not re-verified live | Note this closes the *recreate* leak only. The `?=` fallback at `Makefile:82-99` still fires on every topology (trap H6) |

### 14.4 Family 4 — Federation (12)

| Claim A | Claim B | Which runs | Evidence |
|---|---|---|---|
| `docs/FEDERATION.md:57-58` — "`org_id` is generated per identity-vessel … two independently-seeded instances get **different** namespaces" | `FEDERATION_GENRES.md:83-101` — "The identity secret defines the namespace boundary" | **FEDERATION_GENRES.md.** `org_id` is a deterministic slug of a hardcoded org name, identical on every substrate; the real boundary is the HMAC secret plus the issuer URL | `seed-identity.ts:167 org_name: "substrate"`; `login.ts:333-334` slugify → `organizations:substrate`. The audited key decoded to exactly that |
| `docs/FEDERATION.md:214-230` — the spoke→hub pull fails because discovery keeps only dialable rows and hub vessels register as loopback; cure is `VESSEL_ADVERTISE_ENDPOINT`/`SUBSTRATE_ADVERTISE_HOST` | On a topology-2 peer the pull fails **earlier, at authentication**: discovery forwards the caller's own key because `HUB_API_KEY` is unset, and the peer 401s | **Both mechanisms are real; they are different failure points and the doc names only one.** For a topology-2 peer the credential gap binds; for a topology-1 spoke the doc's cause binds. **And the named cure is undeliverable** | `HUB_API_KEY` absent from the discovery `/proc/<pid>/environ`; `index.ts:56-58` fallback; `index.ts:83` discards the 401 silently. Cure readers exist (`discovery-registration-loop.ts:87-93`, `registration-loop.ts:125-131`) but zero occurrences in `gen-env.sh` or `Makefile`, and `systemctl cat discovery-vessel` shows `EnvironmentFile=/etc/substrate/env` as the only file source |
| `FEDERATION_GENRES.md:118-122` — peer forwarding is bounded at "two hops by default" | The deployed fleet pins `MAX_PEER_DEPTH=1` in two independent places | **The code default is genuinely 2** (`index.ts:48`), so the doc describes the library default correctly — but **no deployed substrate runs it** | `/proc/<pid>/environ MAX_PEER_DEPTH=1`; `federation-peering.conf:14`; `deploy-remote.sh:86` |
| `docs/FEDERATION.md:145` — "deploy-hub.sh is the only *packaged* hub path" | `deploy-hub-pull.sh` is a second, fully packaged hub path, documented nowhere in FEDERATION.md | **The code.** Worse, the two paths produce different fleets from the same `ENABLED_ROLES=hub` | `rg deploy-hub-pull docs/` → nothing. Fleet divergence: `deploy-hub.sh:161-172` vs `deploy-hub-pull.sh:139,145` |
| `docs/FEDERATION.md:71-72,84-85` — peer federation is configured with `PEER_DISCOVERY_ENDPOINTS` "(+ optional shared `FEDERATION_SIGNING_SECRET`)" | No source file reads `FEDERATION_SIGNING_SECRET` or `FEDERATION_PEER_AUTH_MODE`; the effective knob is `HUB_API_KEY` | **The code.** The documented knob is inert; the effective knob is undocumented | `rg FEDERATION_SIGNING_SECRET -g'!node_modules' -g'!*.md' .` → writers only. `rg HUB_API_KEY docs/` → nothing |
| `docs/FEDERATION.md:29-34,288-294` — a hand-set relay multiaddr is an optional override everywhere | `obsidian-passthrough.ts:28` exits unless BOTH `RELAY_MULTIADDR` and `DISCOVERY_URL` are supplied; no `/bootstrap` fetch at all | **The code** — the point-and-go contract has a hole exactly at the surface `docs/FEDERATION.md:100-113` presents as the flagship demo | `obsidian-passthrough.ts:23-28` vs `sidecar.ts:44-63` and `federation-transport-server.ts:43-61` |
| `docs/FEDERATION.md:282-286` — "The complete federated config is two values", example writes `DISCOVERY_ENDPOINT` | `sidecar.ts:27-42` requires FOUR values, each with a hard exit, and reads `DISCOVERY_URL` | **The code.** A reader following the doc's env names gets "set DISCOVERY_URL" and exit 1 | `sidecar.ts:30`, `:39-42` |
| `docs/FEDERATION.md:32-33` — a pinned multiaddr goes stale because "a relay peer id changes on every relay restart" | `relay.ts:41-49` persists the Ed25519 key to `RELAY_KEY_FILE` precisely so the peer id is STABLE | **The code.** The doc's stated reason for preferring `/bootstrap` is wrong even though the preference itself is sound | The actual incident is recorded at `deploy-hub-pull.sh:83-95` — a restart with a **different** key file |
| `deploy-hub-pull.sh:90-95` — "NEVER pkill + respawn a relay already serving :30333" | `deploy-remote.sh:104` does exactly that | **deploy-hub-pull.sh's rule.** deploy-remote.sh passes the pinned `RELAY_KEY_FILE`, limiting the blast radius, but still races the port with any systemd-managed relay | `deploy-remote.sh:104-105` vs `deploy-hub-pull.sh:90-95,97-109` |
| `federation-transport-server.ts:576` logs "hub mirror disabled … nothing to federate into" | `registerAtHub` (`:617,633-634`) still registers every per-vessel `@`-qualified row | **The code.** `FEDERATION_GENRES.md:158-164` already says the log line "no longer describes what registerAtHub does" — the doc is correct and the log is the stale artifact | `:565-576` vs `:616-635` |
| `openspec/changes/2026-05-23-vessel-federation` specifies pubkey-derived vessel ids, peer identity verification on first contact (4.3), authority gating (5.4), a forward-response cache (5.3), cycle protection by observed vesselId (5.5) | The shipped implementation is env-configured peer URLs with a depth header as the only bound, no peer identity verification, no response cache, self-echo by libp2p peer id | **The code is what runs; the openspec change is a Draft that was overtaken.** Its unchecked state is honest, but the security properties it specifies are exactly what is missing from the live fan-out | `proposal.md:1-5` (Status: Draft), `tasks.md` all `- [ ]`; `index.ts:44-129,253-281` |
| `docs/FEDERATION.md:130-131` shows `GITHUB_PAT` as the first, apparently required input to deploy-hub.sh | `deploy-hub.sh:39-40` makes it optional and prints a notice that the repo is public | **The code.** The comment at `:33-38` explains the hard `:?` gate was removed because it turned a public-repo deploy into a credential hunt | — |

### 14.5 Added by the verification pass (4)

| Claim A | Claim B | Which runs | Evidence |
|---|---|---|---|
| `Makefile:562` comment — `substrate-doctor` "also dispatches a goal end-to-end" | `substrate-doctor.sh:21-22,286` — the goal POST is behind `--smoke`, and `Makefile:463` passes no arguments | **The code.** `rg 'also dispatches a goal end-to-end'` returns exactly **one** hit tree-wide: `Makefile:562` | This stale comment is what propagated into the family-1 map's coverage note and cost the audit a check it could legitimately have run |
| `docs/FEDERATION.md` and `deploy-hub.sh` treat "the hub" and "the relay" as one host | `syzygy.host` resolves to **104.236.0.175**, while `/bootstrap` advertises the relay at **138.197.116.56:30333** | **The live topology.** The relay is on a different machine from the hub | Confirmed by `curl … /bootstrap` and `/dev/tcp` connects to both addresses. This is exactly the shape of the stale-relay.log divergence `deploy-hub-pull.sh:83-95` exists to survive, and neither family map states it |
| `ui-only-up.sh:677` comment — transport health is "part of the verdict" | `ui-only-up.sh:686` — the OVERALL loop gates on `PASS_RUNNING/PASS_DIST/PASS_HEALTH/PASS_HUB`; `PASS_FED` is **absent** | **The code (advisory).** The family map's "advisory only" reading of the code is correct; the comment is stale | `:680-682` sets `PASS_FED`; `:686-688` never reads it |
| The cockpit docs and the `provide_feedback` message describe the dispatch store as ephemeral in-memory state | `goal-host index.ts:15598-15625` persists it every 5 s, restores it on boot, **and auto-re-dispatches** every restored in-flight goal younger than 600 s, 20 s after start | **The code.** Restarting goal-host silently re-runs recent work, with `resumed_from:<id>` tags; and because the store caps at 100 with a 20-record prune, the evidence can be evicted | Undocumented in every delivered map. Interacts directly with the identical-goal-text coalesce path at `:14232-14240` |

### 14.6 Cross-family conflicts (6)

| # | Conflict | Resolution |
|---|---|---|
| X1 | **apply-inventory's treatment of the human surface.** F3 launch step 10 says `manageable_units()` "skips manifest entries entirely"; F1-P2 step 8 cites a live boot log `warn: unmanaged: human-surface-vessel.service`, and F1-P6 step 6 says that warning was a false positive fixed between the two boots | Bootstrap is right about the history, human-surface about the current code — a timestamp artifact. At today's code the unmanaged check (`apply-inventory.sh:379-390`) compares `all_inventory_units()` (manifest entries **included**), so an inventory-listed manifest vessel is no longer flagged; `git log -1 -- apply-inventory.sh` → `42302670 2026-08-22`. Bootstrap's boot-1 evidence is pre-fix. **Neither family states the live semantics correctly:** an `ENABLED_VESSELS` list *can* name a manifest vessel, resolve it into DESIRED via `all_units()` (`:94`), and have it silently ignored by the mask/enable loop — a dead write that reports no error |
| X2 | **Which manifest is authoritative for `HOST=0.0.0.0`.** F1-P6 step 1 establishes the volume copy is authoritative and that pull-sync updates are inert until restart; F3 launch step 9 concludes the drop-in is "redundant on a current image" because `vessels.manifest.json:23` now carries the field | A scoping conflict, not a winner. The repo manifest does carry it (with a ~700-word `_host_comment` explaining that a 127.0.0.1 bind does not accept DNAT'd traffic from `docker run -p`). But the value that reaches `render-unit.sh` comes from `/workspace/substrate/fleet/vessels.manifest.json`. "Redundant" is true **only** for a container whose *volume* manifest carries it — which must be read, not inferred. `ui-only-up.sh:532-535` writing the drop-in unconditionally is correct belt-and-braces and should not be described as redundant |
| X3 | **Shelf life of the live evidence.** F1 records that `substrate-live` was SIGKILLed and destroyed at 2026-08-24 22:04:57→22:05:11 PDT; F3 describes the same box as a live standalone and never mentions the destruction | Both are internally honest — F3's measurements (≈21:47–21:58 PDT) predate the kill. The conflict is shelf life, not fact. As of now no container named `substrate-live` exists; `substrate-surreal` and `substrate-workspace` survive. **Every local `verified-live` marker in BOTH families must be read as expired-and-unrepeatable, and a future absence must not be read as a refutation.** Code-path and hub-side findings are unaffected |
| X4 | **What a `000` on a hub port means.** F4 reads 18210/18090/18260 = HTTP 000 as simultaneously (a) the documented firewall set is not what is open and (b) evidence that goal-host/development-vessel/concept-db are not running | F1's check-ladder discipline wins. Discriminated: all three give curl **exit 28** (timeout/silent drop), identical to a control port 19999 that no deploy path publishes, while 18080 gives exit 0 / HTTP 200. A DROP is a network-edge verdict compatible with goal-host running perfectly behind it. **Claim (a) survives; claim (b) is withdrawn** — it is the "auth/connect failure conflated with an empty result" pattern one layer down. Settling which deploy path produced the live fleet needs a shell on the VM |
| X5 | **Kill-switch operability.** The agent-workflow family presents `ROUTE_EDIT_INTENT_TO_COMPOSE != "0"` as an operable precondition and kill switch; F1-P7 step 4 measured that the name was **absent** from the audited container's env because the container predated `Makefile:618` | Both code readings are correct; the agent-workflow family's *operational* claim needs the bootstrap caveat. Corrected: the variable is read per-request at `index.ts:11191/11645/11706` and defaults to ENABLED, but it is a **create-time** container env var — `docker start` / `make up` on an existing container cannot deliver a new value. Halting autonomous edit landing on a running fleet needs `make recreate` or an in-container `/etc/substrate/env` change plus a goal-host restart. Verify with `docker inspect <c>` env NAMES, not with the Makefile |
| X6 | **Two configs, one writer.** The agent-workflow family records that the hooks read `$HOME/.metabob/config.json` while the cockpit is pinned to `<repo>/.metabob/config.json`, and calls it harmless because both carry identical keys; F1-P1 step 9 records that `configure-local.sh` — run unconditionally by `make up` — writes **only** the HOME copy | Compose them: the identity is a coincidence, not a property. Any `make up` that re-seeds the fleet key updates the HOME copy and leaves the REPO copy — the one the MCP cockpit loads — stale, at which point every cockpit tool 401s while the hooks keep working, presenting as "the MCP is broken" rather than "the key rotated". The untracked `.metabob/config.json.hub-backup` (`syzygy.host:18080`) is the fossil of a prior one-sided repoint. **Compare the parsed `.metabob.apiKey` of both files before trusting any cockpit result; treat divergence, not equality, as the expected post-`make up` state** |

---

## 15. Law-1 exposure — env/config that gates BEHAVIOR rather than bootstrap

Law 1: runtime behaviour must be steered by shaped impulses read at use time. Env vars, config files and
in-process constants are **bootstrap-only** (secrets, ports, identity). Everything below gates behaviour and is
invisible to traces and to the walk, so the learning loop cannot observe it.

| Variable / constant | Reader (file:line) | Why it is law-1 exposure | Severity |
|---|---|---|---|
| `ROUTE_EDIT_INTENT_TO_COMPOSE` | `repos/goal-host-vessel/src/index.ts:11191`, `:11645`, `:11706` — three `process.env` reads inside the **per-request** routing path | **The strongest instance in the repo, and the one the agent-workflow family missed.** It gates the ENTIRE code-change-as-a-goal pathway. Not a secret, not a port, not identity, not roster selection. A fleet with it set to `"0"` looks to Thompson exactly like a fleet where edit goals simply never reach. Emitted by `gen-env.sh:578`, so it is not even bootstrap-frozen — it is a behaviour switch delivered through the bootstrap channel | high |
| `PEER_DISCOVERY_ENDPOINTS`, `MAX_PEER_DEPTH`, `PEER_FANOUT_MODE`, `HUB_API_KEY` | `repos/discovery-vessel/src/index.ts:44-47` (deliberately read at **use** time), `:48`, `:56-58` | Federation reach, hop budget, union-vs-miss semantics and the cross-boundary credential are all env-steered. `HUB_API_KEY` in particular decides whether a peer hop authenticates at all, and it appears in **no** doc and is set by **no** deploy path | high |
| `SUBSTRATE_ALLOW_DIRECT_EDIT` | `scripts/substrate/substrate-vessel-edit-gate.sh:22` (and `.claude/settings.local.json:2-4`) | An operator-side env var that disables the substrate's own edit gate **and** its S3 intervention channel, with no trace and no shaped record that it was disabled | high |
| `SUBSTRATE_INTERVENTION_STRICTNESS` | `scripts/substrate/substrate-vessel-edit-gate.sh:~36` (`${…:-balanced}`) | Steers the substrate's own refusal policy from an operator shell variable — a policy setting that should be a shaped impulse the loop can grade | medium |
| `MITOSIS_DIRECT_PUSH` | `units/development-vessel.service:19` `Environment=MITOSIS_DIRECT_PUSH=1`; `Makefile:618` | Gates whether substrate-authored commits push directly. Note the systemd precedence: `EnvironmentFile=` **overrides** `Environment=`, so the unit line is a default that `/etc/substrate/env` outranks — an operator reading the unit file gets the wrong answer | medium |
| gen-env's 17 pinned literals (`TRACE_STORE_CAP`, `TRACE_RETENTION_*`, `EMBEDDING_PRIOR_*`, `TRACE_STORE_HOT_WINDOW_DAYS`, `TRACE_STORE_RESERVOIR_PER_ACTIVITY`, `OBSIDIAN_PLUGIN_ENDPOINT`, `RATE_LIMIT_ALLOWLIST_IPS`, `SURREALDB_{NAMESPACE,DATABASE,USERNAME}`, `EMBEDDING_MODEL_DIR`) | `gen-env.sh:494-504` (the pin loop) and the heredoc `:536-801` | Retention caps, reservoir sizes and the embedding prior are **learning-loop parameters** frozen as shell literals. They cannot be varied per deployment, cannot be observed by the walk, and their override is discarded with a stderr-only notice | medium |
| `DOCTOR_LOOP_WINDOW`, `READY_LOOP_WINDOW` | `substrate-doctor.sh:~197-232`, `substrate-ready.sh:73-127` | Gate the **sensitivity** of operator tooling rather than substrate runtime behaviour — recorded as borderline, not filed as a violation |
| `MB_OPERATOR_ID` | metabob-mcp `dist/cli.js` | Identity, therefore bootstrap-legitimate. Recorded so a future reader does not re-file it | not a violation |
| **Inverse case:** `FEDERATION_SIGNING_SECRET`, `FEDERATION_PEER_AUTH_MODE` | **No reader anywhere** — `secrets.env.sh:41,77`; `gen-env.sh:478-479,858`; `vessels.manifest.json:50-51`; `deploy-remote.sh:38,86` are all writers | The mirror image of law-1 exposure: documented configuration that steers **nothing**, present at every inspectable layer, so an operator who sets it believes peering is authenticated | high |

**The class-level observation.** Every one of these is a behaviour switch delivered through `/etc/substrate/env`,
whose only writer is `gen-env.sh` (an allowlist), whose delivery to a **running** container requires a recreate
(F1-P7 step 4 / X5), and none of which appears in any trace. There is no detector for this class in the repo —
and the two scripts that exist to detect configuration-surface drift (`config-surface-probe.sh`,
`warn-baseline-drift.sh`) have **zero call sites** (trap H28), so the class is structurally unobservable.

---

## 16. What could not be verified here, and what it would take

### 16.1 Structural — the fleet was destroyed mid-audit

`substrate-live` was SIGKILLed at 2026-08-24 22:04:57 PDT and destroyed at 22:05:11 by a third party. Roughly
**95 `verified-live` step rows across families 1, 2, 3 and 5 describe that container** and are unrepeatable.
Systemd counters (`NRestarts`, `MainPID`, `ActiveEnterTimestamp`) lived in `/run`, a tmpfs, so nothing survived.
Journals are boot-capped and are gone with the container.

**What survived and is still checkable:** the image `ghcr.io/avigopal/substrate:dev` (sha256:d1887a2bbf20,
created 2026-08-21T12:17:21Z), the volumes `substrate-surreal` and `substrate-workspace`, the repository working
tree, and the remote hub `syzygy.host`.
**What it would take to re-derive:** `make -C scripts/substrate up` (or `docker run` per F1-P3) against the
surviving volumes, then re-run the F1-P11 ladder. Note that this is itself a mutation and would have been
outside the original audit's constraints.

### 16.2 Corrected: `substrate-doctor` **was** runnable read-only

The family-1 map's coverage note justified leaving every doctor claim unprobed on the grounds that doctor
"dispatches a goal end-to-end". It does not, unless `--smoke` is passed (`substrate-doctor.sh:21-22,286`). Bare
`docker exec <c> substrate-doctor` runs checks 1–7 — including a real 16-token completion per LLM arm, which
costs money but dispatches nothing. **That check was available and was not taken.** The reason the gap existed is
a stale comment at `Makefile:562`. Everything about doctor in this document is therefore `verified-in-code`,
including the load-bearing claims that `make up` exits non-zero when a check fails and that doctor is the only
check catching an up-but-cannot-complete arm.

### 16.3 Not attempted by constraint (no writes, no dispatch, no `make`)

| Area | Why | What it would take |
|---|---|---|
| Any bring-up: `make up`, `make build`, `docker run`, `docker compose up`, `recreate`, `stop`, `rm` | Forbidden | A disposable host. **A genuine FIRST boot was never observed** — secret minting, fleet-file seeding from the image default, and identity minting an org for the first time are inferred from code plus a WARM boot's provenance file (zero `generated` entries) |
| Every mutating `vessel-ctl` verb: `install`, `uninstall`, `sync`, `apply`, `restart`, `start`, `stop`, `deregister` | Forbidden | A disposable fleet. All are capped at `verified-in-code`. The one live selector execution was `vessel-ctl drift`, read-only because `apply-inventory.sh:293-299` guards the unmask branch under `DRY_RUN` — a guard checked in the container copy **before** running it, because a prior report recorded drift as mutating |
| Any goal dispatch | Forbidden | The human-resolver end-to-end path (F3-P9), what a person actually gets back from the surface (F3-P1 step 18), and `substrate-doctor --smoke` all remain unexercised |
| `obsidian-plugin-reload.sh` | It builds and copies files | `verified-in-code` is the ceiling |
| `spoke-federate.sh`, hub/spoke join, thin spoke, the E2E harness | No second machine, no hub credential | A hub-issued key (`docker exec <hub> substrate-key issue <name>`) plus a second box. `HUB_KEY` is the single blocker for `federation-hub-e2e.ts` |
| Anything behind the hub's auth wall | The only credential on this box (org `organizations:substrate`, issuer `http://127.0.0.1:8101`) is **401'd by syzygy**; unauthenticated `/resolve` returns 401 | Could NOT read the hub's registry, confirm whether hub vessels still register as loopback (the mechanism `docs/FEDERATION.md:220-228` blames), check whether `HUB_API_KEY`/`VESSEL_ADVERTISE_ENDPOINT` are set there, or see whether any `@<substrate>` mirror rows exist. **These are 401s, not empty results, and are not treated as evidence of absence anywhere in this document** |
| A live relay reservation | Proved a TCP listener on 138.197.116.56:30333 and that `/bootstrap` advertises a matching multiaddr. Did **not** prove the advertised peer id belongs to that listener, nor that a reservation can be obtained | Running a libp2p node — the e2e harness plus `HUB_KEY`. Circuit-Relay-v2 reservation, DCUtR hole-punch success and Noise-on-the-wire are `verified-in-code` only |
| Tenant-isolation Test 1 (`docs/RBAC_GUIDE.md:197-208`) | Needs two orgs and **root** SurrealDB credentials, and `CLAUDE.md` forbids bypassing PERMISSIONS with root. This substrate has a single org | A second org and an explicitly sanctioned root query |
| `substrate-ready` / `substrate-key` as direct invocations | Not on the read-only allowlist | Their boot-time output (`journalctl -u substrate-ready`, `-u identity-seeder`) was used instead, so the readiness matrix is verified **as it ran at boot**, not as it would run now. The placeholder-key trap rests on code + the docs' prior measurement |
| The `gen-env` boot-time syntax error's source line | Localizing it would require executing a modified copy of the script | Established instead: it fired on both observed boots, the emitted env file was nevertheless complete and parseable, and `f32b2274` removed a backticked span two hours **after** the last observed boot. Re-measure `docker logs \| grep '^/usr/local/bin/gen-env:'` on the next boot before calling it fixed |
| `docker compose pull` | Would mutate the host image store | — |
| Flavour targets: `run`, `run-detach`, `run-live-obsidian`, `build-obsidian`, `migrate-state-to-volumes`, `ui-bridge-*`, `clone-vessel-repos`, `docker-compose.cluster.yml` | Code-read only | A disposable host |

---

## 17. Coverage — what was NOT audited, and by whom

### 17.1 Missing and truncated source material (stated by name)

| Item | State |
|---|---|
| Family 1 — Bootstrap & local substrate bring-up | **Delivered complete** (11 processes, 77 steps, 18 traps, 11 contradictions, coverage notes). 17 verdicts applied |
| Family 2 — Roster & vessel management | **Delivered complete** (9 processes, 62 steps, 12 traps, 7 contradictions, coverage notes). **ZERO adversarial verdicts — unreviewed, not clean** |
| Family 3 — Human surface (UI + Obsidian) | **Delivered complete** (9 processes, 67 steps, 11 traps, 6 contradictions, coverage notes). 14 verdicts applied |
| Family 4 — Federation, spokes & p2p | **Delivered complete** (14 processes, 90 steps, 12 traps, 12 contradictions, coverage notes). 5 verdicts applied |
| Family 5 — Keys, identity, auth & RBAC | **TRUNCATED.** Processes and steps complete (9 / 61); traps 1–11 complete; **trap 12 cut off mid-record** (no `why_invisible`, no `detection`, no severity — carried as U1); **`contradictions` array never delivered**; **`coverage_notes` never delivered**. Zero verdicts |
| Family 6 — Update, deploy & self-deployment | **Delivered complete** (7 processes, 63 steps, 9 traps, 8 contradictions, coverage notes). Recovered from the run journal after the synthesis truncation; rendered at §8. Verdicts applied via the status-inflation lens |
| Family 7 — Agent development workflow (cockpit, hooks, skills, openspec) | **Delivered complete** (8 processes, 58 steps, 12 traps, 9 contradictions, coverage notes). Recovered from the run journal; rendered at §9. Its 12 verdicts are retained separately at §12.1 |
| Family 8 — Validation, doctor, health & watchdogs | **Delivered complete** (9 processes, 70 steps, 14 traps, 9 contradictions, coverage notes). Recovered from the run journal; rendered at §10. Its verdicts are retained separately at §12.2 |
| Family 9 — Configuration surface | **Delivered complete** (5 processes, 45 steps, 9 traps, 7 contradictions, coverage notes). Recovered from the run journal; rendered at §11 |

> **Correction to this table's original framing.** It previously recorded families 6–7 as "no map delivered" and
> families 8–9 as "absent and unnamed". All four maps existed and were returned by their agents; the synthesizing
> agent silently dropped them. The failure was in synthesis, not in collection — and it is exactly the class of
> silent truncation this section exists to catch, so it is recorded rather than quietly repaired.

### 17.2 Surfaces inside a delivered family's own title that the family did not cover

- **Git hooks and CI (family 6's title says "hooks").** `git config --get core.hooksPath` →
  `/home/avi/documents/work/substrate/scripts/git-hooks` — the hooks are **installed and active in this
  checkout**. Uncovered: `scripts/git-hooks/pre-commit` (15734 B, `ALLOWED_TOPLEVEL_DIRS` at `:72`/`:113`,
  enforcement loop `:60-140`, ui/dist gate `:373-401`), `scripts/git-hooks/vessel-pre-commit` (6703 B),
  `install.sh`, `.gitleaks.toml`. Also uncovered: the five `.github/workflows/` —
  `bump-submodules.yml` + `nightly-dev-build.yml` + `build-substrate-image.yml` are **the propagation path by
  which a substrate-authored vessel commit reaches the image the fleet runs**, and are unmapped.
- **The Makefile's delivery of selection variables (family 2).** Two prior reports disagree
  (`VESSEL_INVENTORY_DOC_AUDIT.md §2` says PROFILE and ENABLED_EXTRA_VESSELS *are* passed on both run lanes at
  `Makefile:563-564`/`:635-636`; `BRINGUP_THREE_PATHS.md:915` says PROFILE has no delivery path and dies at the
  docker boundary). The family flagged this rather than picking a side and **did not read the Makefile's run
  lanes** — the largest single gap in that family.
- **pull-sync's per-vessel convergence loop** (`substrate-pull-sync.sh:~1100-1500`), the other major
  `mirror-to-live` caller.
- **The noVNC path** (`novnc.service`, host `:16080`) beyond what `obsidian-xorg-launch.sh` and
  `run-live-obsidian` say.
- **Files adjacent to family 1 that were never read:** `substrate-doctor.sh`, `vessel-ctl.sh`,
  `substrate-pull-sync.sh`, `render-llm-arms.sh`, `apply-llm-arms.sh`, `reseed-restart.sh`, `setup-git-push.sh`.
  (Several were read by *other* families; the family-1 map's own reading did not include them.)

### 17.3 Deliberately out of scope, per family

- **Family 3** did not re-check four prior `HUMAN_SURFACE_INTERACTION_AUDIT.md` findings that live in the
  goal-host / concept-db / compose families: the busy-drafter-reported-as-timeout finding, the edit-intent verb
  whitelist (5 of 7 phrasings rejected), the 7.3 s concept recall against a 4 s budget, and the
  abandoned-draft-poisons-the-baseline finding. **Those remain dated, unassessed claims.**
- **Family 3** treats `docs/guides/INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md` as self-declared historical
  (its header says the CLI it describes is retired). Its three named embedded templates
  (`interactive-activity-selector`, `human-guided-orchestrator`, `build-and-execute`) were **not** looked up in
  the live template store.
- **Family 4** did not read `SETUP_UX_MAP`/`REMAP`, `SETUP_AND_JOIN_DOC_DELTA`, `PROCESS_MEANT_VS_ACTUAL`,
  `BRINGUP_THREE_PATHS` or `DOCUMENTED_LIFECYCLE_VERIFICATION` in full — it grepped the report set for
  federation terms and followed two. **Findings from the unread reports are unassessed.**
- **Family 4** read `FEDERATION_GENRES.md` in full for the roster family and drew nothing from it, on the ground
  that it is a **routing** document, not a roster one.
- **Family 1** did not cover federation beyond what the local bring-up lanes implement.
- **Out of family but recorded:** `activity-api.service` was sitting `failed` / enabled / `restarts=0` on the
  audited fleet — the trace store was down. It incidentally proved the roster surface is independent of substrate
  health: `vessel-ctl status`, `drift` and `list` all answered correctly with the trace store dead. Also
  observed: `surrealdb.service restarts=7`, `local-tools-vessel restarts=1`, `m1-trainer.service` and
  `obsidian-intake.service` in `activating`.

### 17.4 Prior-report dispositions carried forward

**CONFIRMED still true:** `SETUP_UX_MAP.md`'s two-consumption-planes mechanic (with the 57-of-62 correction in
F1-P4); `BRINGUP_THREE_PATHS.md §0.1`'s toolchain claims (`jq` hard-required at `substrate-ready.sh:66`, `bun`
on the HOST at `Makefile:328-336`); `README_FIRST_READER_AUDIT`'s "safety settings fail open" pattern;
`DOCUMENTED_LIFECYCLE_VERIFICATION`'s nine-port claim and its double-count caveat; the manifest whitespace
freeze; the 28-disabled-services explanation (re-measured 28/28); `metric-collector-vessel` as the one shipped
unit absent from the inventory; `federation-relay` named in the inventory with no unit file;
`ROUND3_INVENTORY_AND_JOIN_DELTA §5` (all three halves).

**SUPERSEDED:** `make show-key LIVE_NAME=…` (target deleted); apply-inventory's bare-name no-op;
`DRY_RUN=1 apply-inventory` mutating; "`full` omits desktop"; drift mislabelling manifest vessels; "the
conformance detector never runs on default"; the apply-injection-precedence gap;
`gap-vessel-ctl-status-unknown-unit-exits-zero`; `BRINGUP_THREE_PATHS.md:513` ("SUBSTRATE_ADMIN_KEY is empty" —
it is present).

**RESOLVED IN THE PRIOR REPORT'S FAVOUR, without the experiment it asked for:** ROUND3's "`org_id` is not a join
discriminator — settling it needs two identity-vessels". It is settled by construction —
`seed-identity.ts:167` passes a hardcoded `org_name` and `login.ts:333-334` slugifies deterministically.

**CONCLUSION CONFIRMED, REASON SUPERSEDED:** `validation/findings/config-surface-audit.md:57`
(`SUBSTRATE_ADVERTISE_HOST`/`VESSEL_ADVERTISE_ENDPOINT` "dead, never reaches a vessel"). They **are** read
(`discovery-registration-loop.ts:87-93`, wired via `vessel-daemon.ts:27`); they are unreachable because no config
path delivers them to a unit — a different defect with a different fix.

**COULD NOT RE-VERIFY:** operator memory's "HUB SERVES UNAUTHENTICATED DATA TO THE INTERNET (goal-host :18210)".
The surface has changed: syzygy:18210 now **drops** (curl exit 28), as do 18090 and 18260, while
18080/18100/18101 answer `/health` 200 unauthenticated. No non-`/health` route was probed, so **no claim is made
about what those three expose.**

**NOT CHECKED:** `PROCESS_MEANT_VS_ACTUAL.md`'s learning-loop findings (Thompson nominal, satisfier plane, oracle
coverage) — outside every delivered family. `SETUP_UX_REMAP.md`'s ExecCondition-quoting saga was read but not
re-verified through real systemd. `DOCUMENTED_LIFECYCLE_VERIFICATION.md`'s install/reinstall round-trips (all
mutations). `ONE_SURFACE_AUDIT_DELTA.md`'s non-surface findings (the `.PHONY` no-op targets, the
`apply-llm-arms` SIGPIPE bug, the five vessel-ctl blockers, the `.env.example` volume-name omission).

### 17.5 Non-findings deliberately not filed

- `relay.ts` has **no** `dcutr()` service. That is correct, not a defect — DCUtR runs on the NAT'd endpoints
  (`repos/libp2p-federation-transport/src/index.ts:262`), and the relay supplies the identify + autoNAT
  (`relay.ts:62-63`) the hole-punch depends on.
- `apply-inventory.sh:100-112`'s bare-name warning reads like a live defect and is a historical record. Filed as
  a retired contradiction rather than a finding.
- `MB_OPERATOR_ID` and `DOCTOR_LOOP_WINDOW`/`READY_LOOP_WINDOW` were considered for §11 and deliberately
  excluded — identity and tooling sensitivity respectively, not substrate runtime behaviour.

### 17.6 Negative-result discipline

Every load-bearing negative in this document was run with a positive control in the same query, and both are
recorded:

- "federation-relay has no unit" — control: `human-surface-vessel` reports `active` in the same `list` output and
  its unit exists; and `systemctl is-active nosuchvessel-xyz.service` returns the same string `inactive`, so the
  string is not evidence of installation.
- "metric-collector is missing from the fleet view" — control: `coherence-metric.service`, also disabled, IS
  present in both `list-units --all` and the fleet view, because its timer keeps it loaded.
- "`ui/src` has no `/api/state` reference" — control: `rg -li 'panel' ui/src` → 12 files, so the tool works. **And
  that control is what refuted the conclusion drawn from the negative** (`SolicitationPanel.tsx`).
- "two `obsidian_*` pointer types do not exist" — control:
  `rg -no 'obsidian_[a-z_]+' repos/development-vessel/src | sort -u` → 24 types that do.
- "`openspec` is absent" — control: the same login-shell test **did** find `bun`, so the negative is not a
  tool-shell PATH artefact.
- "hub ports 18210/18090/18260 return 000" — control: port 19999, published by no deploy path, returns the
  identical curl exit 28; port 18080 returns exit 0 / HTTP 200.
- "no `verbatimExcerptBlock` call passes more than one file" — control: the same `rg` returns the definition line
  and both call sites, so the query is not empty.












---

## 18. Post-rebuild re-verification (standing evidence)

> **⚠ One §18 finding was later withdrawn.** The `m1-trainer` "deadlock" below is **wrong** — the unit runs to
> completion (~38-min job on a 15-min timer, cadence overlap, not a hang). See §19.1 for the correction and the
> evidence. The rest of §18 stands.

The container `substrate-live` was destroyed mid-audit (SIGKILL ~22:05 PDT) and rebuilt at 22:35 PDT from the same
image. Every `verified-live` status recorded above was therefore measured against a container that no longer exists.
This section re-probes the highest-stakes live claims against the **current** container so the report carries
standing rather than expired evidence. Verdicts here override the status columns above where they disagree.

### 18.1 Deltas introduced by the rebuild

- ACTIVITY-API IS UP. The audited fleet had `activity-api.service` sitting `failed` / enabled / restarts=0 — the trace store was down. On the rebuilt container it is `active`, /health 200, and an independent consumer (trace-store-health-check) reads real counters with a climbing row_count (12092 -> 12171 -> 12178 over 20 min). Any audit row whose evidence was gathered against a dead trace store should be re-read with this in mind.
- THE HUMAN SURFACE IS GONE. `human-surface-vessel` was `active` and serving :18310 on the audited box (the report used it as a positive control and recorded its shape list). On the rebuilt container it is inactive/disabled, FragmentPath /lib/systemd/system (the vendored copy, never installed), :18310 answers 000 both inside and outside the container, and self-recovery logs 'NOT INSTALLED ... waiting for vessel-ctl install'. Cause: it is a manifest:true vessel installed via `vessel-ctl install`, which renders a real unit file into /etc/systemd/system — and /etc is container-local, so the install died with the old container while the volume survived. So the fleet's port count is now 8-of-9 serving, not 9-of-9. Federation-transport-vessel and metric-collector-vessel are in the same state (3 uninstalled_skipped).
- ALL RESTART COUNTERS RESET. NRestarts lives in /run (tmpfs). Every service reads 0 on the new container, so the audit's surrealdb=7 / local-tools-vessel=1 are not re-derivable and must stay UNVERIFIABLE, not NO-LONGER-TRUE. The corollary matters for the report's standing: a clean NRestarts sweep on a 45-minute-old container is much weaker evidence than the same sweep on a multi-day one.
- JOURNAL WINDOW RESET. Obsidian dead-tick counts (22 unreachable on the new container vs 2586 pre-rebuild) and pull-sync tick counts (5 vs the audited run of ticks from 01:38) are new-window numbers. The RATIOS reproduce; the magnitudes must not be compared.
- NOTHING ELSE MOVED. /etc/substrate/env is byte-identical to the pre-destruction dump (both exactly 17374 bytes, diff rc=0): same roles (none persisted — default topology), same endpoints, same federation identity (spoke-cfda39e7), same behavioral flags, same secret prefixes. env.provenance reads `persisted` for every secret, confirming a warm boot off /workspace/.substrate-secrets. The image is unchanged (ghcr.io/avigopal/substrate:dev, same tag).
- THE VOLUME COPY IS AUTHORITATIVE — HELD. Both named volumes survived: the workspace volume still carries the 6238-byte frozen vessels.manifest.json (mtime Aug 15), its 6070-byte sidecar (Aug 14), two dated inventory .bak files (Aug 8 / Aug 16), and /workspace/last-human-activity=1783393402 (Jul 7 value, Jul 29 mtime). The surreal volume survived too — identity-seeder took the warm path ('substrate org already exists / existing key authenticates / key unchanged'). The entrypoint's copy-only-if-absent rule did NOT re-seed the fleet files from the image.
- NEW STANDING DEFECT VISIBLE ONLY ON THIS CONTAINER: m1-trainer.service is a Type=oneshot with TimeoutStartUSec=infinity that has been stuck in `activating` for ~29 minutes, sleeping in do_epoll_wait with zero CPU accumulation across two samples, with its last log line being 'Connected to SurrealDB successfully'. Its timer re-arms only via OnUnitActiveSec=15min, which requires an active-enter the hung oneshot will never produce — so the M1 embedding-prior trainer is deadlocked for the life of the container. systemctl --failed is empty, docker reports (healthy), and NRestarts=0 throughout: every green signal the fleet has is blind to it. The pre-rebuild fleet also had m1-trainer in `activating`, so this reproduces across containers.

### 18.2 Re-probed claims

| Claim | Verdict | Probe | Result |
|---|---|---|---|
| Fleet state: no failed units; is-system-running = running (audit's F1-P5 end state, measured 22:03 PDT on the destroyed container) | **STILL-TRUE** | `docker exec substrate-live systemctl --failed --no-legend --no-pager ; docker exec substrate-live systemctl is-system-running ; docker exec substrate-live systemctl list-units --type=service --all --no-legend \| head -5` | --failed: (empty), rc=0 \| is-system-running: running \| positive control returned rows: 'activity-api.service loaded active running', 'analysis-vessel.service loaded active running', 'apt-daily.service loaded inactive dead', '● auditd.service not-found inactive dead' |
| Restart counts: name any unit with a nonzero and CLIMBING NRestarts (two samples, stated window) | **CHANGED-BY-REBUILD** | `SNAP1 06:15:55Z and SNAP2 06:20:48Z (293 s window): docker exec substrate-live sh -c 'systemctl list-units --type=service --all --no-legend --plain \| awk "{print \$1}" \| while read u; do printf "%s %s %s\n" "$u" "$(sys` | snap1: 155 lines, every service NRestarts=0. snap2: 125 service lines, every service NRestarts=0. Delta over 293 s = 0 for every unit. rg -v ' 0 ' snap2.txt -> (none). No unit is in a restart loop. |
| Pre-rebuild counters surrealdb.service NRestarts=7, local-tools-vessel restarts=1, activity-api.service failed/restarts=0 | **UNVERIFIABLE** | `docker exec substrate-live systemctl show surrealdb.service -p NRestarts,ActiveState --value (from snap1/snap2)` | surrealdb.service 0 active \| local-tools-vessel.service 0 active \| activity-api.service 0 active |
| Timers: the fleet's timer set is armed with sane next-fire; flag any deadlocked timer | **STILL-TRUE** | `docker exec substrate-live systemctl list-timers --all --no-pager` | 39 timers listed. 35 with a concrete NEXT (light-dispatch-healthcheck +19s, funnel-drain +26s, obsidian-intake +35s, ... memory-budget-check Tue 2026-08-25 07:00:00 UTC, ingest-docs +5h28m, e2scrub_all 4 days). 4 with NEXT='-': boredom-vessel.timer (LAST 05:41:35), m1-trainer.timer (LAST 05:51:40), substrate-pull-sync.timer (LAST 06:15:13 |
| NEW / HIGHEST-STAKES: m1-trainer.timer is DEADLOCKED on this container — its oneshot has hung, and OnUnitActiveSec can never re-arm | **STILL-TRUE** | `docker exec substrate-live systemctl show m1-trainer.service -p Type,TimeoutStartUSec,ActiveEnterTimestamp,ExecMainStartTimestamp,MainPID,NRestarts,Restart ; docker exec substrate-live systemctl cat m1-trainer.timer \| r` | Type=oneshot, TimeoutStartUSec=infinity, Restart=no, NRestarts=0, MainPID=43881, ExecMainStartTimestamp=05:51:40 UTC, ActiveEnterTimestamp=(EMPTY), ActiveState=activating in BOTH snapshots (06:15:55 and 06:20:48). Timer: OnUnitActiveSec=15min, Persistent=true. Journal ends at 05:51:40 with 'Connected to SurrealDB successfully' and nothing |
| pull-sync units/timers exist and run on their ~10-minute cadence | **STILL-TRUE** | `docker exec substrate-live systemctl list-timers --all \| rg pull-sync ; docker exec substrate-live journalctl -u substrate-pull-sync --no-pager \| rg -c 'Starting\|Started' ; docker exec substrate-live journalctl -u sub` | substrate-pull-sync.timer present, OnBootSec=3min + OnUnitActiveSec=10min, LAST 06:15:13 UTC. 5 starts in this boot. Completed ticks at 05:44:00 (synced=5 skipped=0 failed=0), 05:50:01 (synced=0), 06:00:22 (synced=0), 06:08:15 (synced=0 skipped=1 failed=0), 5th in flight at 06:15:13. First tick logged 'fleet: converged apply-inventory / g |
| H7 / F2-P4 step 7: vessels.manifest.json is PERMANENTLY FROZEN against git by a whitespace-only reformat, because pull-sync compares with cmp -s (byte compare) | **STILL-TRUE** | `docker exec substrate-live md5sum /workspace/substrate/fleet/vessels.manifest.json /workspace/substrate/fleet/.vessels.manifest.json.converged /usr/local/share/substrate/vessels.manifest.json ; md5sum scripts/substrate/v` | live volume manifest md5=7ba3a7264f6b6be3973763ec6a027e95 (6238 B, mtime Aug 15 00:44); sidecar .converged md5=3d63a89c40bc9bee7f74ad7e94437940 (6070 B); image copy 3d63a89c...; git working tree scripts/substrate/vessels.manifest.json 3d63a89c... — all three non-live copies agree, only the live one differs. jq -S comparison: 'SEMANTICALLY |
| Contradiction: `vessel-ctl drift` prints a clean all-clear in the same minutes pull-sync logs the manifest freeze — drift never inspects the manifest at all | **STILL-TRUE** | `docker exec substrate-live vessel-ctl drift` | '=== inventory: volume (authoritative) vs image (build default) ===' -> 'identical'; '=== selection in force ===' -> '(none set — default topology, every baked unit enabled)'; '=== would applying that selection now change anything? ===' -> '0 unit(s) would be disabled'; 'warn: 1 shipped unit(s) absent from the inventory ... unmanaged: met |
| ITEM 5 — the fleet inventory in the VOLUME survived the rebuild ('the volume copy is authoritative' held) | **STILL-TRUE** | `docker exec substrate-live sh -c 'ls -la /workspace/substrate/fleet/; cmp volume-vs-image for both files' ; docker exec substrate-live sh -c 'cat /workspace/last-human-activity; ls -la /workspace/.substrate-secrets*'` | /workspace/substrate/fleet/ contains: vessels.manifest.json 6238 B mtime Aug 15 00:44 (PRE-rebuild); .vessels.manifest.json.converged 6070 B mtime Aug 14 20:33; vessels.inventory.json 15810 B mtime Aug 21 12:09 owned uid 1000; .vessels.inventory.json.converged mtime Aug 25 06:08; plus two survivors vessels.inventory.json.bak-1786861732 (A |
| SurrealDB learning state survived: identity-seeder takes the warm-boot path ('org already exists / key unchanged') | **STILL-TRUE** | `docker exec substrate-live journalctl -u identity-seeder --no-pager \| tail -20` | 5 cold-DB failures ('signup failed 500: {"error":"PERSIST_FAILED","message":"You must be connected to a SurrealDB instance..."}', 'attempt 4 failed — retrying in 6s', 'attempt 5 failed'), then 'restarting identity-vessel (known no-reconnect defect) before further retries', then '[seed-identity] substrate org already exists — verifying the |
| ITEM 4 — /etc/substrate/env vs the pre-rebuild values: did the rebuild change roles, endpoints, federation identity, or any behavioral flag? | **STILL-TRUE** | `docker exec substrate-live cat /etc/substrate/env > env_new.txt ; diff scratchpad/env.txt env_new.txt ; wc -c both ; docker exec substrate-live cat /etc/substrate/env.provenance` | diff rc=0 — ZERO lines of difference. Both files exactly 17374 bytes. env.provenance: ANTHROPIC_API_KEY=env; API_KEY_SECRET / FEDERATION_PEER_AUTH_MODE / FEDERATION_SIGNING_SECRET / FED_SUBSTRATE_ID / JWT_SECRET / METABOB_API_KEY / OPENROUTER_API_KEY / PEER_DISCOVERY_ENDPOINTS / SUBSTRATE_ADMIN_KEY / SUBSTRATE_GIT_PAT / SURREAL_PASS = per |
| ITEM 4 detail — selection names, endpoints, federation identity and behavioral flags (secrets redacted to 6 chars) | **STILL-TRUE** | `rg -N '^(PROFILE\|ENABLED_ROLES\|ENABLED_VESSELS\|ENABLED_EXTRA_VESSELS\|DISABLED_VESSELS)=' env_new.txt ; rg -N '^(METABOB_ENDPOINT\|DISCOVERY_ENDPOINT\|HUB_DISCOVERY_URL\|PEER_DISCOVERY_ENDPOINTS\|RELAY_MULTIADDR\|FED_` | SELECTION: no PROFILE / ENABLED_ROLES / ENABLED_VESSELS / ENABLED_EXTRA_VESSELS / DISABLED_VESSELS line exists (count=0, rg exit 1) — default topology, every baked unit enabled (confirmed independently by vessel-ctl drift). ENDPOINTS: METABOB_ENDPOINT="http://127.0.0.1:8080", DISCOVERY_ENDPOINT=DISCOVERY_VESSEL_ENDPOINT="http://127.0.0.1: |
| ITEM 6 — substrate-doctor check 6 (recovery-coverage lint) is STRUCTURALLY VACUOUS and prints PASS unconditionally | **STILL-TRUE** | `docker exec substrate-live sh -c 'sed -n "110,135p" /usr/local/bin/substrate-doctor' ; docker exec substrate-live sh -c 'for u in $(jq -r ".vessels[].unit" /workspace/substrate/fleet/vessels.inventory.json); do [ -f "/et` | Container doctor (203 lines, check 6 at line 116) contains verbatim: f="/etc/systemd/system/$u"; [ -f "$f" ] \|\| continue; grep -q "^Type=oneshot" "$f" && continue; grep -q "^Restart=" "$f" \|\| echo "$u". Iterating all 95 inventory units: ZERO 'REAL FILE IN ETC' lines. POSITIVE CONTROL in the same loop form: 'CONTROL-HIT: llm-opus.servi |
| L5: 28 .service units read `disabled` on an all-enabled fleet, and 28/28 have a .timer sibling (expected, not an outage) | **STILL-TRUE** | `docker exec substrate-live systemctl list-unit-files --type=service --no-legend \| rg '\sdisabled\s' ; then for each: docker exec substrate-live systemctl cat <name>.timer >/dev/null 2>&1` | 40 disabled services total. with_timer=28, without=12. The 12 without a timer sibling are all non-substrate or manifest vessels: debug-shell, redis-server@, systemd-boot-check-no-failures, systemd-network-generator, systemd-networkd, systemd-networkd-wait-online, systemd-networkd-wait-online@, systemd-sysext, systemd-time-wait-sync, plus  |
| metric-collector-vessel is the one shipped unit absent from the inventory: present in list-unit-files, ABSENT from list-units --all, absent from vessel-ctl status | **STILL-TRUE** | `docker exec substrate-live systemctl list-unit-files \| rg metric ; docker exec substrate-live systemctl list-units --all \| rg metric ; docker exec substrate-live vessel-ctl status \| rg -i metric` | list-unit-files: 'metric-collector-vessel.service disabled enabled' (present), plus autonomy-metrics.service static, coherence-metric.service disabled enabled, and the two timers. list-units --all: NO metric-collector row; POSITIVE CONTROL in the same output — 'coherence-metric.service loaded inactive dead' IS listed (its timer references |
| federation-relay is named in the roster surface but has NO unit file anywhere | **STILL-TRUE** | `docker exec substrate-live vessel-ctl list ; docker exec substrate-live sh -c 'for d in /etc/systemd/system /lib/systemd/system /usr/lib/systemd/system; do ls -la $d/federation-relay.service; done' ; POSITIVE CONTROL: sa` | vessel-ctl list -> 4 vessels: metric-collector-vessel inactive, human-surface-vessel inactive, federation-relay inactive, federation-transport-vessel inactive. ls federation-relay.service: 'No such file or directory' in ALL THREE dirs. POSITIVE CONTROL: human-surface-vessel.service -> absent from /etc but PRESENT (584 B, Aug 21 12:16) in  |
| Nine ports published and all nine serving 200 (F1-P5 end state) | **CHANGED-BY-REBUILD** | `docker port substrate-live ; for p in 18080 18090 18100 18101 18210 18250 18260 18270 18310; do curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:$p/health; done ; NEGATIVE CONTROL: curl http://127.0.` | Nine host ports published (18080/18090/18100/18101/18210/18250/18260/18270/18310 -> 8080/8090/8100/8101/8210/8250/8260/8270/8310). Health: 18080=200, 18090=200 (000 on a 6 s timeout, 200 at 0.28 s on retry), 18100=200, 18101=200, 18210=200, 18250=200, 18260=200, 18270=200, 18310=000. NEGATIVE CONTROL 19999 -> 000. From INSIDE the containe |
| A standalone answers /bootstrap 200 with an EMPTY relay array — 'reachable' and 'joinable' look identical on status alone; the BODY distinguishes them | **STILL-TRUE** | `curl -s --max-time 6 http://127.0.0.1:18100/bootstrap` | HTTP 200, body: {"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":"","prefer_transport":"libp2p"} |
| Discovery wants the `ApiKey` scheme, not `Bearer` | **STILL-TRUE** | `docker exec substrate-live sh -c 'set -a; . /etc/substrate/env; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8100/v2/registry/shapes -H "Authorization: ApiKey $METABOB_API_KEY"' then the same with 'Authorizati` | ApiKey -> HTTP 404. Bearer -> HTTP 401. |
| The trace store is live AND serving (not merely /health 200) — contrast with the pre-rebuild fleet where activity-api.service sat `failed` | **CHANGED-BY-REBUILD** | `docker exec substrate-live journalctl -u trace-store-health-check --no-pager -n 12 (a live CONSUMER that reads activity-api /metrics/db)` | Three consecutive ticks: 05:59:11 {"ok":true,"row_count":12092,"cap":150000,"over_cap":false,"gap_emitted":false}; 06:09:11 row_count=12171; 06:19:11 row_count=12178. Each 'Deactivated successfully' / 'Finished'. |
| H11: the Obsidian intake loop reports systemd success on every tick while doing literally nothing; /vaults does not exist on this deployment | **STILL-TRUE** | `docker exec substrate-live journalctl -u obsidian-intake --no-pager \| rg -c '"unreachable":true' ; same \| rg -c 'requests_found' ; same \| wc -l ; docker exec substrate-live sh -c 'ls -la /vaults/substrate-vault/Substr` | unreachable:true count = 22. requests_found count = 0 (rg exit 1, i.e. the query ran and matched nothing — not a query failure). Journal has 88 lines total (positive control: the journal is non-empty). /vaults/substrate-vault/Substrate/Feedback.md -> 'No such file or directory'. /vaults -> 'No such file or directory'. |
| self-recovery correctly distinguishes 'uninstalled manifest vessel' from 'broken vessel' and does not restart the baked copy | **STILL-TRUE** | `docker exec substrate-live journalctl -u self-recovery --no-pager -n 8` | 06:18:03 'NOT INSTALLED: federation-transport-vessel (:8401) — manifest vessel with no rendered unit; waiting for vessel-ctl install, not restarting the baked one'; same for human-surface-vessel (:8310) and metric-collector-vessel (:8300); then {"healthy":13,"recovered_by_restart":0,"reverted_from_git":0,"escalated":0,"db_pressure_backoff |
| LLM arm units are rendered post-apply-inventory into /etc and gated by ExecCondition on the provider key | **STILL-TRUE** | `docker exec substrate-live sh -c 'for u in llm-opus llm-haiku llm-google; do printf "%s %s %s\n" "$u" "$(systemctl show $u.service -p ActiveState --value)" "$(systemctl show $u.service -p ConditionResult --value)"; done'` | llm-opus active yes \| llm-haiku active yes \| llm-google inactive no. /etc/systemd/system/ holds llm-google.service (1371 B), llm-haiku.service (1386 B), llm-opus.service (1373 B), all mtime Aug 25 05:35 (this boot). |
| Docker-visible health: (healthy) means only that substrate-ready --quick passed on the CORE set, single-pass | **STILL-TRUE** | `docker inspect --format '{{.State.Health.Status}} started={{.State.StartedAt}} restarts={{.RestartCount}}' substrate-live ; docker ps --filter name=substrate` | healthy started=2026-08-25T05:35:49.285870992Z restarts=0. docker ps: 'substrate-live Up 36 minutes (healthy)', image ghcr.io/avigopal/substrate:dev, created 2026-08-24 22:35:49 -0700 PDT. |

### 18.3 Notes carried from the re-probe

- **Fleet state: no failed units; is-system-running = running (audit's F1-P5 end state, measur** — The '●'-prefixed rows are Debian not-found statics (auditd, connman, NetworkManager, plymouth-*, syslog, systemd-udev-trigger, ...), 10 of them — NOT failures. A naive rg for '●' reads as 10 broken units; it is zero.
- **Restart counts: name any unit with a nonzero and CLIMBING NRestarts (two samples, stated w** — Container uptime at measurement was ~45 min. NRestarts lives in /run (tmpfs) and was zeroed by the rebuild, so a clean sweep here is weak evidence — it says 'no loop has started yet', not 'no loop exists'. The pre-rebuild values (surrealdb=7, local-tools-vessel=1) are UNVERIFIABLE, not refuted.
- **Pre-rebuild counters surrealdb.service NRestarts=7, local-tools-vessel restarts=1, activit** — The report itself flags these as living in /run tmpfs and non-re-derivable. Do not read the new zeros as refutation. The activity-api state change IS a real delta (see rebuild_deltas).
- **Timers: the fleet's timer set is armed with sane next-fire; flag any deadlocked timer** — boredom-vessel and substrate-pull-sync showing NEXT='-' is the legitimate documented case (OnUnitActiveSec re-arms when the running service finishes). fstrim.timer is a Debian static, ActiveState=inactive. m1-trainer is NOT legitimate — see next row.
- **NEW / HIGHEST-STAKES: m1-trainer.timer is DEADLOCKED on this container — its oneshot has h** — ~29 min stuck against a 15-min cadence, burning no CPU, blocked in epoll. TimeoutStartUSec=infinity means systemd will never reap it; OnUnitActiveSec re-arms from the last active-enter, which a never-finishing oneshot never produces. This is the exact 're-arm only via OnUnitActiveSec' deadlock signature. The pre-rebuild fleet ALSO had m1-trainer in 'activating' (report §13.3) — so this reproduces across containers and is a standing defect, not rebuild noise.
- **pull-sync units/timers exist and run on their ~10-minute cadence** — Also captured live: at 06:08:07 pull-sync REFUSED to converge development-vessel — 'TEST REGRESSION at 578b831295 ... REFUSING to converge (1/3); runtime keeps running its current code', preceded by 'FLAKY suite — 106 then 108 fail on identical source; using 106'. The pre-cutover test gate is real and firing on this container.
- **H7 / F2-P4 step 7: vessels.manifest.json is PERMANENTLY FROZEN against git by a whitespace** — Byte sizes 6238 vs 6070 match the audit exactly. Doubles as the strongest proof the workspace volume survived.
- **Contradiction: `vessel-ctl drift` prints a clean all-clear in the same minutes pull-sync l** — Measured at 06:17Z; the pull-sync 'modified locally' line fired at 06:08:15Z and again on the in-flight 06:15:13Z tick. Both true simultaneously on this container.
- **ITEM 5 — the fleet inventory in the VOLUME survived the rebuild ('the volume copy is autho** — Decisive on four independent fingerprints (pre-rebuild mtimes, the 6238-byte frozen manifest, the two dated .bak files, the July last-human-activity value). The volume was NOT re-seeded from the image: entrypoint's 'copy only if absent' left the volume copies in place. Note vessels.inventory.json md5 93d7470... equals BOTH the image copy and git HEAD, so the inventory leg alone would have been ambiguous — the manifest and the .bak files are what settle it.
- **SurrealDB learning state survived: identity-seeder takes the warm-boot path ('org already ** — Reproduces the pre-rebuild journal essentially verbatim (F1-P5 step 5 evidence). Confirms both the surreal volume survived AND the self-heal loop plus warm-boot idempotency still work.
- **ITEM 4 — /etc/substrate/env vs the pre-rebuild values: did the rebuild change roles, endpo** — The pre-rebuild dump (scratchpad/env.txt, taken 22:01 PDT, ~4 min before destruction) is BYTE-IDENTICAL to the rebuilt container's env. Nothing changed. Provenance 'persisted' on every secret confirms a warm boot read /workspace/.substrate-secrets rather than minting.
- **ITEM 4 detail — selection names, endpoints, federation identity and behavioral flags (secr** — Federation identity spoke-cfda39e7 is preserved — the rebuild did not re-mint it. The kill switch ROUTE_EDIT_INTENT_TO_COMPOSE is present-but-empty, i.e. autonomous edit landing is NOT halted. COMPOSE_MAX_CONCURRENT / ADMISSION_CAP are absent from the env file entirely (they are not emitted by gen-env's allowlist), so those runtime caps come from elsewhere and cannot be read here.
- **ITEM 6 — substrate-doctor check 6 (recovery-coverage lint) is STRUCTURALLY VACUOUS and pri** — Still vacuous on THIS container. The only real files in /etc are the three rendered LLM arm units, and the inventory names none of them (its only 'llm' entry is llm-resolver-vessel.service, FragmentPath /lib). So check 6 examines 0 of 95 units and 'PASS' is indistinguishable from 'nothing was looked at'. Also worth noting: the container's substrate-doctor is 203 lines vs the host source's ~250+ and md5 differs (4a4938cf vs e3007c44) — pull-sync's converge_fleet_defs does not include substrate-doctor, so the container runs the IMAGE copy.
- **L5: 28 .service units read `disabled` on an all-enabled fleet, and 28/28 have a .timer sib** — The audited '28 disabled, 28/28 have a timer sibling' reproduces EXACTLY once Debian statics and the three uninstalled manifest vessels are excluded — 28 with_timer, 0 exceptions among them.
- **metric-collector-vessel is the one shipped unit absent from the inventory: present in list** — Query pair reproduced in the original form, with the same positive control. Four rows, matching the audit's 'four rows, none of them metric-collector'.
- **federation-relay is named in the roster surface but has NO unit file anywhere** — 'inactive' from vessel-ctl list is indistinguishable from 'this unit does not exist' — exactly the audit's point, reproduced with both controls.
- **Nine ports published and all nine serving 200 (F1-P5 end state)** — 8 of 9 serve 200. 18310 is dark because human-surface-vessel is a manifest:true vessel that must be `vessel-ctl install`ed — its /etc-rendered unit died with the old container. See rebuild_deltas. 18090's first 000 was a 6 s timeout artifact, not an outage — reported so a zero is not mistaken for a dead vessel.
- **A standalone answers /bootstrap 200 with an EMPTY relay array — 'reachable' and 'joinable'** — Empty relay array and empty discovery_endpoint: this container is not advertising itself as a joinable hub, despite carrying FED_SUBSTRATE_ID=spoke-cfda39e7 and PEER_DISCOVERY_ENDPOINTS=http://syzygy.host:18100.
- **Discovery wants the `ApiKey` scheme, not `Bearer`** — The 404/401 split is the discriminator: with ApiKey the credential is ACCEPTED and only the path is wrong; with Bearer the request is rejected at auth. A collapsed 'both failed' reading would have lost this.
- **The trace store is live AND serving (not merely /health 200) — contrast with the pre-rebui** — This is a capability probe, not a presence probe: an independent consumer got real counters back, and row_count CLIMBS (12092 -> 12171 -> 12178) so writes are landing too. On the audited fleet activity-api.service was `failed` and the trace store was down.
- **H11: the Obsidian intake loop reports systemd success on every tick while doing literally ** — New-window numbers (22 vs 2586 pre-rebuild) — the journal reset with the container, so do NOT compare magnitudes. The ratio is what reproduces: every tick unreachable, zero real work, zero failed units. /workspace/last-human-activity still reads 1783393402 (2026-07-07), unchanged across the rebuild — 49+ days since this loop last did real work.
- **self-recovery correctly distinguishes 'uninstalled manifest vessel' from 'broken vessel' a** — Independently corroborates the 18310 result: the human surface is not installed on this container, and the immune system knows it rather than thrashing.
- **LLM arm units are rendered post-apply-inventory into /etc and gated by ExecCondition on th** — llm-google declines its ExecCondition because GOOGLE_API_KEY is empty in /etc/substrate/env — a clean skip, never a failure. Confirms arm units land in /etc (unmaskable by role selection) and are invisible to the inventory.
- **Docker-visible health: (healthy) means only that substrate-ready --quick passed on the COR** — Live demonstration of the structural hole on THIS container: docker reports (healthy) while m1-trainer has been wedged in `activating` for 29 minutes. --quick's single pass cannot see it, and --failed cannot see it either.

### 18.4 Summary

Re-probed 24 of the audit's highest-stakes live claims against the rebuilt `substrate-live` (created 2026-08-24 22:35 PDT / 05:35 UTC, image ghcr.io/avigopal/substrate:dev, healthy, RestartCount=0). Headline: the audit's structural findings almost all survive the rebuild with fresh standing evidence, the environment and both volumes are unchanged, and one genuinely new defect surfaced.

STILL-TRUE with fresh evidence (18 checks): the manifest whitespace-freeze (live 6238 B vs git/sidecar/image 3d63a89c…, `jq -S` says semantically identical, pull-sync logs 'was modified locally' at every tick 05:44/05:50/06:00/06:08) — and `vessel-ctl drift` printed a clean 'identical' all-clear in the same minutes, so the contradiction reproduces exactly; substrate-doctor check 6 is still structurally vacuous (0 of 95 inventory units have a file at /etc/systemd/system/$u, positive control llm-opus.service HITS the same `[ -f ]` predicate); federation-relay named by `vessel-ctl list` with no unit file in any of the three dirs (positive control: human-surface-vessel has files in /lib and /usr/lib); metric-collector-vessel present in list-unit-files, absent from list-units --all (positive control: coherence-metric.service IS listed) and absent from vessel-ctl status's 4 rows; 28 disabled services, 28/28 with a timer sibling once the 12 Debian statics and manifest vessels are excluded; the obsidian dead-tick loop (22 unreachable, 0 requests_found, /vaults absent, last-human-activity still 1783393402); /bootstrap 200 with an empty relay array; discovery accepting `ApiKey` (404 = path) and rejecting `Bearer` (401 = auth).

ITEM 4 (env): `/etc/substrate/env` is BYTE-IDENTICAL to the pre-destruction dump — diff rc=0, both exactly 17374 bytes. No roles persisted (default topology), endpoints unchanged, federation identity `spoke-cfda39e7` preserved, `ROUTE_EDIT_INTENT_TO_COMPOSE` present-but-empty (autonomy not halted), all nine secret prefixes identical (064e26 / 818e6d / 129f52 / mb-b3J / mb-b3J / b07b64 / github / sk-ant / sk-or-), env.provenance `persisted` for every secret.

ITEM 5 (volume): the volume copy is authoritative HELD. Four independent fingerprints — the 6238-byte frozen manifest (mtime Aug 15), its 6070-byte sidecar (Aug 14), two dated inventory .bak files (Aug 8/16), and last-human-activity — plus identity-seeder's warm-boot journal ('org already exists / key unchanged') proving the surreal volume survived too. Nothing was re-seeded from the image.

ITEMS 1–3 (fleet/timers/pull-sync): `--failed` empty, `is-system-running` = running. Two NRestarts snapshots 293 s apart (06:15:55Z, 06:20:48Z) show every service at 0 with zero delta — but that is CHANGED-BY-REBUILD, not confirmation: NRestarts lives in /run tmpfs and the container is 45 minutes old. 39 timers armed; pull-sync exists with OnBootSec=3min + OnUnitActiveSec=10min and has completed 4 ticks (and live-caught refusing a development-vessel convergence on a test regression at 578b831295).

NEW FINDING — `m1-trainer.service` is deadlocked. Type=oneshot, TimeoutStartUSec=infinity, `activating` in BOTH snapshots since 05:51:40 (~29 min), process sleeping in do_epoll_wait with identical CPU ticks (925/560) across two samples, last log 'Connected to SurrealDB successfully'. Its timer re-arms only via OnUnitActiveSec=15min, which needs an active-enter this hung oneshot will never produce. `systemctl --failed` is empty, NRestarts=0, and docker says (healthy) — every green signal the fleet has is blind to it. The pre-rebuild fleet also had m1-trainer in `activating`, so this reproduces across containers and is a standing defect, not rebuild noise.

Two real rebuild deltas that change audit rows: activity-api is now UP and serving (it was `failed` on the audited fleet — a live consumer reads climbing row_counts 12092→12171→12178), and the human surface is GONE (18310 answers 000; `vessel-ctl install` renders into /etc, which is container-local, so the install died with the old container while the volumes survived). Ports are therefore 8-of-9 serving, not 9-of-9. Every negative above was run with a same-form positive control; 401 / 404 / 000 / empty-result were kept distinct throughout.
---

## 19. Recommission round (2026-08-25) — gap fills, escalations, corrections

This section records a second orchestrated pass that (a) filled the three gaps §17 named, (b) adversarially
re-verified the previously-unreviewed roster family, and (c) triaged the whole corpus. Where it corrects an
earlier section, the correction is authoritative. Live probes here ran against the rebuilt container on 2026-08-25.

### 19.1 Corrections to earlier sections (authoritative)

| Earlier claim | Correction | Evidence |
|---|---|---|
| §18: `m1-trainer.service` is **deadlocked for the life of the container**, a standing defect | **WRONG — withdrawn.** It runs to completion. It is a ~38-min job on a 15-min timer (cadence overlap), not a hang. | journal `Finished m1-trainer.service` at 06:42:33 and 07:20:40, each with `m1_train_done {...}` and `ExecMainStatus=0`. The two `activating` samples were one in-progress run. The correct predicate is assert-PROGRESS-across-samples, never assert-STATE. |
| B1 "Bearer garbage yields a **cross-tenant** read" | **OVERSTATED.** On this single-org box it is unauthenticated read of the tenant's own traces + org-less internal rows (`org_id:"unknown"`). The org predicate is *removed* (execution-traces.ts:751-769, root client :989); cross-tenant is inferred, needs a 2nd tenant to observe. | unauth 305 substrate + 95 `unknown` over 4 pages; authed 400/400 substrate. |
| B2 `/v1/keys/generate` "mints a fleet-valid credential" (verified-in-code) | **CONFIRMED LIVE — escalated.** An unauthenticated mint produces an HMAC-signed key that `validate` returns `valid:true` for, and that the discovery auth layer accepts (404 routed, vs 401 for forged/no-auth). | mint `{org_id:"evil"}` → `valid:true, scopes:[read,write]`; gated read MINTED→404, FORGED→401, NONE→401. |
| `Trap 19`: `API_KEY_SECRET` absent → silently signs with the dev literal | **REFUTED.** identity-vessel `process.exit(1)` when unset or equal to the dev literal (index.ts:91-99, `ddda0d8`). Residual: `JWT_SECRET` fallback at jwt.ts:15 is NOT under that guard. | code read. |
| Family status table (already corrected in §17): families 6-9 "no map / absent" | All nine delivered; synthesis truncation, recovered from journal, rendered §8-§11. | run journal. |

### 19.2 The finding the process map missed (highest leverage)

The audit mapped **processes**, not the **metric substrate**, and missed the load-bearing one: the substrate's
self-observation layer reads a table that stopped receiving writes 42 days ago.

```
activity_execution_traces   n=18135   newest 2026-07-14T23:13:46Z   ← FROZEN
execution                   n=12481   newest 2026-08-25T07:33:15Z   ← LIVE (~4.6/min)
v_paradigm_execution_traces n=12481   newest 2026-08-25T07:33:15Z   ← compat view over the live table, already exists
```

Verified via read-only `SELECT count(), max(created_at)` on the surreal `/sql` path (ns `activity-system`, db
`learning_loop`). The **core learning loop writes and reads `execution`** (activity-api runtime-tracing,
posterior-update, and the /v2 routes all use it — the loop is not dead). What reads the **frozen** table is the
**self-development / KPI layer** — eight scripts: `autonomy-metrics.ts`, `operator-goal-generator.ts`,
`composition-edge-reconcile.ts`, `compose-teacher.ts`, `model-reality-audit.ts`, `coherence-recover.ts`,
`spectral-gap.ts`, `trace-store-health-check.ts`. Consumer-layer proof: `composition-edge-reconcile` logs
`batch_traces:0, upserted:0` every tick while 669 executions landed in the same 2h window and 2214 parented rows
wait. This is §15's predicted class ("severed write→read joint") in its strongest instance. Repair is a repoint to
the existing view; it lives in `scripts/substrate/*.ts`, which goal-host **cannot** dispatch (edit-intent regex is
anchored on `repos/`), so it is operator work.

### 19.3 CI & propagation — confirmed defects (new family, §ref pending merge)

- **The pre-commit hook exits before all four content guards on ~84% of commits.** `scripts/git-hooks/pre-commit:92`
  returns 0 when a commit stages no Added/Renamed file; placement guard, sops check, gitleaks scan, and ui/dist gate
  all sit past that line. A credential embedded by *editing* a tracked file is never scanned. (167 of last 200 commits.)
- **Substrate-authored commits skip every hook** — the in-container clones set no `core.hooksPath` (and no system
  hooksPath / templateDir). So neither the human path (mostly, per above) nor the autonomous path is guarded.
- **The fleet runs a 3-day-stale image.** The 6-hourly submodule-bump commit consumes the build trigger; no scheduled
  nightly has ever published an image. Local `:dev` = 08-21 image; registry `:dev` = 08-24. A `docker pull`-less host
  stays pinned.
- **gitleaks rule cannot match this fleet's keys** — rule is `mb_[…]` (underscore); keys are `mb-` (dash). Green, dead.
- Two GitHub workflows are chronically red: Deploy Activity API (5/5 fail, none since 2026-04-22), Weekly
  Recommendation Validation (5/5 consecutive Mondays).

### 19.4 Roster family (previously unreviewed) — verdict

Held up: most claims CONFIRMED, several sharpened. Notable additions: an unknown profile *name* is fatal but a typo
*inside* a profile silently masks the vessel it meant to select (both shipped profiles already carry one permanently
dead entry, `federation-transport-vessel.service`); `vessel-ctl uninstall` refuses a baked unit by name yet will
`disable --now` a baked unit that has a manifest entry but no /etc render. No verb was caught faking success this pass,
but `install` still emits `ok:true` unconditionally past step 1 with the enable/start compound swallowed by `|| true`.
