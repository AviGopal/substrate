# Setup-path bifurcation audit — 2026-09-22

**Question.** Do the setup docs describe one path a newcomer can follow to a working
substrate, and if prior fleet audits came up green, why does an independent host fail?

**Verdict.** The setup path is bifurcated — not by accident but by declaration — and
the audits that certified it were structurally unable to see that. There are **8
launch lanes** in code, **≥8 documents crowning a different "canonical" start**, and
**20 cross-document contradictions**. Every prior audit ran on this one host, on
rootless Podman, with a pre-pulled/pre-built image, ambient credentials, and its own
driver scripts; the docs were then edited to match what the harness did. No audit
ever produced a working MCP cockpit or a `reached:true` goal on a fresh volume.

Method: three read-only investigators (lanes-from-code, docs inventory, prior-audit
forensics) plus direct verification. Claims marked **[V]** were re-checked by hand in
this session; the rest are investigator-reported with file:line and were not
contradicted by any spot-check (one investigator claim *was* refuted and is dropped —
see §8). No fleet container was started, stopped, or reconfigured (two throwaway `docker run --rm` inspections of the image; read-only SSH to the Syzygy hub). A full clean-room boot
was **not** run: loadavg was 26 on 16 cores and this host is Podman, so it would not
reproduce a Docker host's failure. A fresh `git clone` + `docker compose config` +
inspection of the published image's baked units stood in for it.

---

## 1. Why green here, red elsewhere

Every documented lane touches at least one piece of warm state this host has and a
fresh host does not. Each row is something a prior audit silently relied on.

| Warm state on this host | What it hides on a fresh host | Evidence |
|---|---|---|
| `~/.metabob/config.json` with provider keys | `Makefile:96-99` defaults `ANTHROPIC_API_KEY`/`OPENAI_*` from it with `?=`. README:503-505 tells make users to put the key in root `.env` and "let make pick it up" — **the Makefile has no `include`; make never reads `.env`** → fresh host boots keyless. | **[V]** |
| `gh auth token` | `Makefile:128` silently fills `GITHUB_TOKEN`, injected into every container incl. spokes. | **[V]** |
| A local `ghcr.io/avigopal/substrate:dev` tag | `make up` builds only if the tag is missing (`Makefile:441`) and **never pulls**; build needs host `bun`. This host has **no bun** — no audit ever exercised the build branch a fresh host takes. | **[V]** `which bun` → none |
| Human surface unit re-rendered by `vessel-ctl` on `substrate-live`'s volume (`HOST=0.0.0.0` in `/etc/systemd/system`) | The **image's baked unit sets `HOST=127.0.0.1`** (`scripts/substrate/units/human-surface-vessel.service:10`, unchanged since 08-07), overriding the vessel's own `0.0.0.0` default (`repos/human-surface-vessel/src/config.ts:21`, used as `Bun.serve({hostname})` at `index.ts:267`); nothing in entrypoint/gen-env rewrites it. README/SUBSTRATE.md promise `curl localhost:18310/` → 200 on compose/docker-run. Discovery/goal-host bind `0.0.0.0` despite the same unit line (measured), so human-surface is the exposed one. The repo's own `ui-only-up.sh:352,532` already writes a `HOST=0.0.0.0` drop-in to work around it; Syzygy used a hand-mounted drop-in. | **[V]** by code + unit + workaround; *not* observed on a stock container (every container measured had an override) |
| Podman 6.1.2 behind the docker CLI | Docs require Docker. Under Podman the local image `Healthcheck` inspects `null` and no running container shows a `(healthy)` status — the image readiness signal the docs gate on is absent here; compose runs via `podman-compose`. All September evidence is Podman. | **[V]** |
| Uncommitted `development-vessel-seed.service` ordering fix | Without it a cold volume loses all 121 dev seed templates (401 race with identity-seeder). GHCR image and any fresh clone still have the race; warm volumes hide it. | **[V]** `git diff` |
| Pre-issued hub keys (`.env.syzygy-local`), operator SSH key to the hub | Spoke audits joined with credentials a newcomer cannot obtain from the docs; Syzygy's first run failed `NO_RESERVATION` and was recovered by `ssh root@syzygy.host … restart`. | syzygy REPORT:73-78 |
| Hand-written `.mcp.json` (gitignored, `/home/avi/.nvm/...` absolute paths) + nvm | The cockpit CLAUDE.md mandates has **no documented install on any lane**. The plugin's `npx -y @metabob/mcp` fails without nvm on PATH — it failed in this very session. | **[V]** |

### How each prior audit defined "green"

| Audit | Lane | Ran where | Verbatim docs? | "Green" meant |
|---|---|---|---|---|
| Aug doc-delta rounds (`6ebabec5`, `fe50f05f`) | make up +offset, compose | 2nd container, this host, local `:dev` | yes | health 200s ("8/9 ports serving while root auth failed") |
| SETUP_AND_JOIN_DOC_DELTA | make up, spoke | this host; hub via docker bridge `172.17.0.1` — its line 3 claims "a host that had never run them" | yes | whoami + doctor |
| BRINGUP_THREE_PATHS | ui-only / spoke / make | this host; key copied from `substrate-live`, submodule step deliberately skipped | own driver | narration honesty; B had 4 doctor FAILs, 7 crash-looping units |
| DOCUMENTED_LIFECYCLE_VERIFICATION | make up/stop/recreate | `substrate-live` itself (18k-trace warm volume) | mostly; 7 fixes mid-run | doctor + one reached dispatch — **on the warm fleet** |
| coldboot-proof 1/2 | raw `podman run`, locally built | this host | own ledger | F3 (self-development) failed both runs |
| container-lifecycle-audit + rerun (26/26 MET) | `auditlib.py`, own compose, hand-picked `ENABLED_VESSELS` | this host, no published ports | **no** | 26 booleans; **every terminal dispatch `reached:false`** |
| syzygy-local-bringup | hand-written compose, pinned image id | this host → remote hub | no (docs written after) | whoami/readiness/P2P reads; "no assertion … goal attainment" |

Commit `37b18ec0` ("align setup/teardown instructions with audited behavior") edited
the docs to match the harness. **The docs followed the audit; nothing ever followed
the docs to a usable end state.**

**No record of the other-host failure exists** in `validation/`, `docs/`, or
`openspec/`; the repo only contains admissions that a clean-host run was never done
(`CONTAINER_NETWORK_LIFECYCLE.md:226`, `openspec/changes/2026-05-31-substrate-fleet-federation/proposal.md:25`).

---

## 2. The lanes (from code)

| Lane | Image | Name / volume / port knobs | Health | Stop grace | Host post-boot | Writes client config |
|---|---|---|---|---|---|---|
| A `make up`→`run-live` | local tag; build-if-missing, never pulls | `LIVE_NAME`, `PORT_OFFSET` | image `substrate-ready --quick` | 300s (`make stop`) | readiness (fail-open `\|\| true`), configure-local, doctor | only if name = `substrate-live` and `:18080` answers |
| A′ `make run`/`run-detach` | same | fixed; **host bind, no surreal volume** | image | 10s | none | no |
| A″ `run-live-obsidian` | `:obsidian` | ignores `PORT_OFFSET`, no 18310 | image | — | none | no |
| B root compose | pull-if-missing | `SUBSTRATE_CONTAINER`, `*_VOLUME`, 9× `*_PORT` | **overridden**: discovery `/health` only | **30s** | none | no |
| C README `docker run` | GHCR | hardcoded | image | 10s | none | no |
| D1 deploy-remote.sh | `docker save \| ssh` | fixed; 7 ports | image | 300s | appends peering to `/etc/substrate/env` — **gen-env truncates it next boot** | no |
| D2 deploy-hub.sh | built on VM (bun, submodules) | fixed; 6 ports | image | 300s | host relay via nohup | no |
| D3 deploy-hub-pull.sh | GHCR | fixed; 4 ports | image | 300s | wait | no |
| E docker-compose.cluster.yml | GHCR | **unnamed (project-prefixed) volumes** | :8080 / :8210 | 30s | none | no |

README itself states the fork: *"The two lanes do not translate each other"*
(README:~96). `docs/SUBSTRATE.md:208` is headed **"Launch: two canonical paths."**

---

## 3. Fresh-host breakers (ranked)

1. **Human surface unreachable on every pull lane.** Baked unit `HOST=127.0.0.1` overrides the
   vessel's `0.0.0.0` default; README "serves out-of-box" is false. **[V]** by code; confirm with one
   stock boot on the acceptance host.
2. **Make lane: key in `.env` is never read.** README:503-505 vs Makefile (no `include`).
   Fresh host → keyless boot. **[V]**
3. **Make lane: build path unexercised.** No local image → `build` → requires bun +
   submodules; never tested. Most likely failure mode on a fresh host. **[V]** (partially: untested ≠ broken)
4. **No cockpit on any lane but default-name make.** `configure-local.sh` hardcodes
   `:18080`; no doc installs `metabob-mcp`; `METABOB_CONFIG` vs `METABOB_CONFIG_PATH`;
   `~/.metabob/config.json` vs repo-local `.metabob/config.json`. **[V]**
5. **`deploy-hub-pull.sh` hub cannot dispatch after a reboot.** `roles.hub` has no `compute` and
   the script passes no extras, yet publishes 18210. The live Syzygy hub (`ENABLED_ROLES=hub`, no
   extras) has goal-host **`active` but `disabled`** — running only because it was started by hand;
   a restart or fresh deploy drops it. **[V]** via read-only SSH.
6. **Cold-boot seed race** still in the published image (fix uncommitted). **[V]**
7. **`docker compose down` SIGKILLs SurrealDB** at 30s against a documented 240s drain +
   90s flush. **[V]** (compose:29)
8. **Compose `healthy` = discovery answered**; goal-host can be dead. Docs describe a
   third, nonexistent probe (activity-api). **[V]**
9. **deploy-remote peering evaporates on restart** (appended to a file gen-env rewrites).
10. **`PEER_MULTIADDR`** — read by gen-env, forwarded by no lane, absent from `.env.example`.
11. **Fresh clone ships ~200 junk files at the root** (`{{dirPath}}/`, `Substrate/Projects/*`,
    `*.patch`, `scanProjects_*.js`) — 173 top-level entries. The pre-commit
    `ALLOWED_TOPLEVEL_DIRS` hook is evidently not installed where the substrate commits.
    A newcomer's first impression is noise. **[V]**
12. **Image provenance is unknowable.** Local `:dev` carries no revision label; GHCR `:dev`
    lags `dev` by up to ~24h because `GITHUB_TOKEN`-pushed submodule bumps never trigger
    the build workflow.

---

## 4. Cross-document contradictions (selected; 20 found)

| # | Side A | Side B |
|---|---|---|
| 1 | SUBSTRATE.md:316-319 compose health curls activity-api | docker-compose.yml:135-145 probes discovery :8100; cluster file probes :8080/:8210 **[V]** |
| 2 | SUBSTRATE.md:282 compose and make share volumes | SUBSTRATE.md:341 raw run "joins the make fleet, not the compose one" (stale since `5fc685fc`) **[V]** |
| 3 | SUBSTRATE.md:306 wait for `healthy`, then read key | README:118 `healthy` ≠ seeded; gate on `whoami` |
| 4 | SUBSTRATE.md:233 `.gitmodules` uses HTTPS, vessels "may be private" | `.gitmodules` is relative `../x.git`; repos are public (README:465) **[V]** |
| 5 | README:72 no submodules needed | SUBSTRATE.md:224 needed; HUMAN_SURFACE.md:36 full recursive init for a UI |
| 6 | FEDERATION.md:219 spoke = one command | CLAUDE.md + deploy SKILL: two steps "then enabling the federation transport" |
| 7 | CONTAINER_NETWORK_LIFECYCLE:68 `ENABLED_ROLES=spoke` mandatory | SUBSTRATE.md:400 "usually redundant; changes nothing on compose" |
| 8 | spoke needs no LLM key (.env.example:27, FEDERATION:231) | give it one (README:358, FEDERATION:235, Makefile:90) |
| 9 | CONTAINER_NETWORK_LIFECYCLE:137 "the Make wrapper is equivalent" | README: "the two lanes do not translate each other" |
| 10 | CONTAINER_NETWORK_LIFECYCLE:21 `IDENTITY_URL`, `ACTIVITY_VESSEL_URL` | no code reads them; real names `IDENTITY_VESSEL_URL`, `ACTIVITY_API_ENDPOINT` |
| 11 | README:64 "no Kubernetes" | repos/deployment/README.md presents Helm/GKE as live, no deprecation |
| 12 | SYZYGY_LOCAL_SURFACE.md:3 "not an operating manual", dated, pinned sha | HUMAN_PROJECT_LIFECYCLE.md:38 routes first-run users to it as "the concrete, tested" setup |
| 13 | deploy/metabob-substrate SKILLs: `make restart-<v>` / `sync-<v>` | Makefile:41-47 says those targets were deleted |
| 14 | SUBSTRATE.md:1298 `run-live` = "everyday development target" | SUBSTRATE.md:599 files it under "Legacy" |

"Canonical" is claimed for: root compose (README, SUBSTRATE.md, compose header), `make up`
(CLAUDE.md, Makefile:26, deploy SKILL), raw `docker run` ("the host contract", README:64),
"two canonical paths" (SUBSTRATE.md:208), `--env-file -p` compose
(CONTAINER_NETWORK_LIFECYCLE), the Syzygy record (via HUMAN_PROJECT_LIFECYCLE), and the
cluster compose ("the fixture the setup instructions are tested against" — referenced by
no doc).

---

## 5. Root cause

Each audit found real defects and fixed them **per lane, per instance** (≈40 setup
commits since August). No change ever reduced the number of lanes, so every fix raised
the maintenance surface: the same knob now exists in two vocabularies (`LIVE_NAME` /
`PORT_OFFSET` vs `SUBSTRATE_CONTAINER` / `*_VOLUME` / 9× `*_PORT`), three healthchecks,
five stop graces, six port sets, and two spoke-derivation implementations
(Makefile:197-233 on the host vs gen-env:485-590 in-container). Law 6's second question —
*what activity detects this class without me?* — was never answered: there is no
doc-following acceptance run on a machine that is not this one.

## 6. Recommendations

1. **One lane.** Make root compose the only newcomer path (it is the only one that works
   without bun/submodules and it already forwards nearly every var). Reduce `make up` to a
   thin wrapper that *calls compose* with the same variables, so there is one knob
   vocabulary. Demote raw `docker run`, `run-live`, `run-live-obsidian`, `make run`,
   deploy-remote, and the cluster file to either deleted or "internal/legacy" in one place.
2. **One "start here".** README § Installation is the only setup text; SUBSTRATE.md,
   FEDERATION.md, guides, skills and the compose header link to it rather than restate
   commands. Remove "two canonical paths". Move SYZYGY_LOCAL_SURFACE out of `docs/guides`
   (it is dated evidence — law 9) and add a deprecation banner to `repos/deployment`.
3. **Fix the fresh-host breakers in §3** — especially: bake `HOST=0.0.0.0` for
   human-surface (or make the vessel ignore HOST like its peers); commit the seed-ordering
   fix; `make` either includes `.env` or the README stops saying it does; drop the
   `?=` fallbacks from `~/.metabob/config.json` / `gh auth token` (they make every audit
   on this host lie in the same direction); raise compose `stop_grace_period`.
4. **Cockpit is part of setup.** Document (on the one lane) how to install `metabob-mcp`,
   where its config lives (one path, one env var name), and write it post-boot for any
   name/port, not only `substrate-live:18080`.
5. **The class detector (law 6).** A doc-following acceptance activity that: takes only
   README's fenced commands, runs them on a host with **no** `~/.metabob`, no local image,
   no `gh` auth, no bun, **Docker not Podman**, fresh volumes; and defines green as
   *whoami valid → a non-trivial goal `reached:true` → MCP cockpit `registry_query`
   answers*. Health/doctor alone is not green. Until that runs off-host, no setup audit
   from this machine should be reported as green.
6. **Clean the root.** Remove the tracked scratch files and install the pre-commit hook
   wherever the substrate commits (in-container clones included).

## 7. Gaps to file (not filed — filing authorizes work; awaiting go-ahead)

- setup-docs crown ≥8 canonical lanes; converge on one (source: human_reported)
- human-surface baked unit binds loopback; documented 18310 unreachable on pull lanes
- README make-lane `.env` pickup is false; Makefile `?=` ambient-credential fallbacks mask it
- no documented MCP cockpit install on any lane
- deploy-hub-pull hub lacks goal-host
- no off-host doc-following acceptance activity (the class detector)

## 8. Corrections and limits

- Refuted: an investigator reported the root `.env` sets `METABOB_API_KEY`; it holds only
  `OPENROUTER_API_KEY` **[V]**.
- A transient empty reply on `substrate-live:18080` was observed once and not reproduced
  (loadavg 26); not a finding.
- **Missing input:** the independent host's failure log. Its symptoms would confirm which
  of §3's breakers actually fired (my prior: #3 build-path, #2 keyless boot, #1 surface).
