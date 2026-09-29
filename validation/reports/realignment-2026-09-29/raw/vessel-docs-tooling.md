# Realignment round 2 — shard `vessel-docs-tooling`

Scope: (a) every `.md` under `repos/*/` at depth <=3 (112 files, 17 repos have any), per-vessel
CLAUDE.md/README checked against the live fleet; (b) the operator teaching channel in `.claude/`
(hooks, settings, skills, commands) plus the MCP cockpit it depends on. Measured 2026-09-29
~04:20–04:45 UTC against node 1 (`substrate-live`) with spot checks on node 2 (`compose2-live`).
Read-only: no files other than this one written, no DB/gap/pool writes. One hook was run by hand
with a fake path (edit gate); its only side effect was a failed POST to `localhost:18090`.

Seed keys used as in the task. New keys: none.

---

## 0. The single largest finding: the host-side operator channel is half-dark because of `localhost`

**Mechanism (measured):** host is rootless podman with `pasta` port-forwarding. `curl localhost:P`
tries `[::1]:P` first; pasta accepts on ::1 and forwards to the container's IPv6 side; vessels that
bind IPv4-only (`0.0.0.0`) reset the connection; curl does not fall back → `000`.
`127.0.0.1:P` works.

In-container listeners (decoded `/proc/net/tcp{,6}`):
- IPv4-only (dark via `localhost` from host): **8090 dev-vessel, 8100 discovery, 8260 concept-db,
  8270 stateful-ui, 8310 human-surface**.
- dual-stack `::` (work): 8080 activity-api, 8101, 8210 goal-host, 8220, 8230, 8240, 8250, 8255, 8280.

`curl -sv localhost:18090/health` → `Trying [::1]:18090... Recv failure: Connection reset by peer`;
`curl 127.0.0.1:18090/health` → 200.

Source: vessels that pass `hostname: config.host` with default `"0.0.0.0"` (dev-vessel
`src/config.ts:33`, concept-db `src/config.ts:134` → `index.ts:431`, human-surface `config.ts:21`)
bind v4-only; activity-api/goal-host do not bind this way.

**Consumers affected (each verified):**

| Consumer | Default endpoint | Effect |
|---|---|---|
| `.claude/hooks/substrate-session-start.sh` | `DEV_VESSEL_ENDPOINT=http://localhost:18090`, `DISCOVERY_ENDPOINT=http://localhost:18100` | **emits 0 bytes, exit 0** (fail-open, silent). With 127.0.0.1 overrides it emits 10,085 chars. So no session gets substrate memory or concept priors injected. |
| `.claude/hooks/substrate-vessel-edit-gate.sh` S3 push-away branch | `DEV_VESSEL_ENDPOINT=localhost:18090` | `intervention_evaluate` never answers → always falls to generic deny. dev-vessel journal: **0** `intervention_evaluate` lines since 09-25 (journal horizon). The "organic S3 push-away" never fires from the host. |
| metabob MCP cockpit (`.mcp.json` → `/home/avi/documents/work/metabob-mcp/dist/cli.js`, config `.metabob/config.json` endpoint `localhost:18080`) | discovery derived as `localhost:18100` | `registry_query` → "socket connection was closed unexpectedly"; `goal_status` → "could not find goal-host-vessel via discovery. Set GOAL_HOST_VESSEL_URL explicitly." The canonical loop's TRACK/INSPECT planes are down in this session. |
| `.claude/hooks/substrate-memory-mirror.sh` → `scripts/substrate/mirror-memory-note.ts` (bun) | `localhost:18090` | **works** (bun resolves 127.0.0.1); log shows `created` lines up to 09-29. |
| `.claude/hooks/substrate-session-end.sh` | `localhost:18210` (dual-stack) | works (dispatches). |

Keys: `endpoint-routing`, `memory-recall`, `write-read-mismatch`. Also contradicts CLAUDE.md
"nothing hardcodes an endpoint": all four hooks hardcode `localhost:18xxx` defaults and none reads
the `substrate-connect` client config. And there is no operator channel to node 2 at all (all
defaults point at the 18xxx prefix) → `node-locality`.

Not established: when the pasta/IPv6 behavior began (podman migration: `~/.metabob/config.json.bak-prepodman` exists) — i.e. how long the session-start hook has been silently empty.

---

## 1. Teaching channel (`.claude/`) vs reality

### 1.1 settings
- `.claude/settings.json` working-tree diff is a **pure key reorder** (enabledPlugins/worktree moved after hooks) — noise, hooks unchanged.
- Hooks wired: SessionStart, SessionEnd, PostToolUse(Write|Edit|MultiEdit)=memory-mirror, PreToolUse(Write|Edit|MultiEdit)=edit-gate.
- **`.claude/settings.local.json` sets `env.SUBSTRATE_ALLOW_DIRECT_EDIT="1"` persistently** (file mtime 2026-09-06 09:00 -0700). Measured pair: hook with `=1` → empty output rc 0 (edit allowed silently); with `=0` → generic deny JSON. So the gate CLAUDE.md describes ("Direct edits are gated") is **inert in every session** and has been since at least 09-06.
  - Recurrence: a prior operator transcript already recorded "THE EDIT GATE NEVER FIRES HERE: `.claude/settings.local.json` sets `SUBSTRATE_ALLOW_DIRECT_EDIT=1` persistently → hook exits 0 **silently** every session; 'dispatch, don't edit' is UNENFORCED" (08-28-era memory text). Multiple transcripts claim "set …=1 in settings.local.json, **restored to 0 after**" (≥16+12+5 occurrences). Current state: still 1. Classic "declared restored, never restored".
  - Gate also only matches Write|Edit|MultiEdit; Bash heredoc/sed edits of `repos/*/src` are never gated.
  - Keys: `env-gating`, `false-verification`, `docs-drift`.
- Two copies of the cockpit tools are exposed (`mcp__metabob__*` from `.mcp.json` and `mcp__plugin_metabob_metabob__*` from a plugin) → `codebase-bloat-fossils` (duplicate surface).

### 1.2 hooks — do they fire, what do they read/write
- **session-start** (`62559ca6` 09-22 "fetch conventions by type"; `118d341f` 07-19 concept priors): with defaults emits nothing (§0). With 127.0.0.1: authoritative store reports **59 notes total — feedback:2, project:2, reference:55; oldest created 2026-09-26T05:12Z**. The hook's own comment says "measured 2026-09-22 … 91 [feedback notes] existed". Operator cache dir holds 750 files. Concept priors: 17 of 20 candidates selected (works when reachable).
  - Store location: dev-vessel `WORKSPACE_ROOT=/workspace` in unit Environment but `EnvironmentFile=/etc/substrate/env` wins → live store `/workspace/git/super-repo/memory/notes.json` (52 KB, gitignored `.gitignore:239 /memory/`), while `/workspace/memory/notes.json` (3.1 MB, **680 notes**, last write Sep 7) still sits unread beside it. The 09-22 "two stores merged at file level" fix did not survive: the live store now begins 09-26. Cause of the 09-26 loss not established here (round 1 / CHECKINS 09-29 03:15 also left it open; a `notes.json.pre-op-retire…bak` of 09-23 exists per that entry).
  - Keys: `memory-recall` (recurrence #3+: Jul-25 split → 09-22 flood/split → 09-26 loss), `write-read-mismatch`.
- **memory-mirror**: fires; log `~/.claude/substrate-memory-mirror.log` 2,735 lines: **876 `created`, 863 `updated`, 490 `mirror failed`** (failures clustered 09-06..09-24; 92 on 09-12). The writes succeeded historically yet the store holds 59 → the mirror is a producer whose target store is periodically lost; nothing detects that (no read-back check). Keys: `memory-recall`, `hollow-landing` (write acknowledged, not durable).
- **session-end**: fires; `~/.claude/substrate-session-end.log` 171 `dispatched`, 18 `skip`, 30 `coalesced` since 2026-06-16; one `goal-host draining` error (08-10). Latest dispatch `b6ca2bad-772c-454d-acdc-9d53d3057dfd` (09-29 03:38) goal-host journal: attempt 1 `HOLLOW (declarative): missing activityTemplate,learningSummary`; then `pathway reuse: accepted 2-step pathway via goal_hash (4/5 reached)`; `satisfier:memoryNote` → "HOLLOW — The memoryNote output is empty, so the consolidation … was not achieved"; FEEDBACK-RETRY ×3; finally `recordGoalPath (floor reach) shapes=["memoryNote"]` at 03:53 — a **satisfier/floor reach by reading memoryNote**, i.e. the consolidation never writes the concept graph and the system has **learned a hollow pathway** ("4/5 reached") for it. Every session end since June has dispatched this. Keys: `hollow-landing`, `false-verification`, `composition-crystallization` (crystallized a hollow path), `memory-recall`.
- **edit-gate**: see §1.1 and §0.

### 1.3 skills
- `metabob-substrate/SKILL.md` (last content change `d043bde5` 09-23): canonical loop (`concept_search`→`run_goal_async`→`goal_status`→`goal_reasoning`→`provide_feedback`). Steps 3–4 currently fail from host (§0). "Memory flows (automatic — know them, don't run them)" asserts session-start injects memory — false (§1.2). "Escalation ladder" step 2 "Vessel /health from the host" — 5 of the anchor vessels do not answer via `localhost`. Step 4 cites `substrate-status` — **absent on node 1** (§3). References `substrateGap_write` (served by dev-vessel only — correct) and `docs/SUBSTRATE.md` (exists).
- `deploy/SKILL.md`: `vessel-ctl` verbs verified present (`list|status|restart|start|stop|logs|install|uninstall|sync|deregister|apply|drift`). "Verify after: `substrate-status`" → command not found on node 1. `vessel-ctl status` shows most timers `next=+6d 10h…` (a hold is in place — incl. `substrate-pull-sync.timer`), so the skill's premise "every fleet converges to origin/dev through its in-container pull-sync" is currently suspended (observation only; hold owner not investigated). Keys: `sync-deploy-drift`, `docs-drift`.
- `openspec-*` skills + `commands/opsx/*` (4 commands duplicate the 4 skills near-verbatim → duplicate teaching surface). CLI `openspec 1.2.0` present; `openspec list --json`: **98 changes recognised (of 176 dirs), 67 in-progress, 31 no-tasks, 0 fully complete; 4 archived**. The archive skill is effectively never exercised; the change pipeline has no terminal state. Keys: `dormant-mechanism`, `codebase-bloat-fossils`.

---

## 2. Vessel docs vs live reality

Inventory: 112 `.md` at depth<=3. **67 of 112 live in gitignored, non-deployed, non-submodule repos** (`deployment` 26, `workbench` 25, `terminal` 8, `react-renderer` 3, `metabob-cloud-dashboard` 3, `user-vessel` 2 — K8s/MiniBob/MetabobProject era; last commits 04-30..08-17; `deployment` has 74 md mentioning kubectl/helm/k8s at any depth). `.gitignore:204-210`.

**Undocumented core (law 9 inverted):** goal-host-vessel, boredom-vessel, llm-resolver-vessel, local-tools-vessel, ribosome-vessel, light-dispatch-vessel, metric-collector-vessel, analysis-vessel, relevance-sink-vessel, clock-vessel have **no .md at depth<=3**. The vessels doing the work carry no written expectations; the documented ones are the older ones.

### activity-api (`CLAUDE.md` last 2026-05-17 `7b6a0df`)
- Key tables: `activity_template` → **0 rows**; `activity_metrics` → **0 rows**; templates actually in `activity` (**4,010 rows**) and a second `activity_templates` (2 rows, 07-22 auto-extracted, `tasks:[]`, successRate 0). → `docs-drift`, `codebase-bloat-fossils` (three template tables).
- "Deprecated `/v2/vessels/*` … 2026-07-01 removed, return 410 Gone" → today `GET /v2/vessels/status` and `/discover` return **401** (still routed). Claim broken.
- Deployment flow "sync to `repos/deployment/vessels/metabob-activity-api/` → canary → production"; `.github/workflows/sync-to-deployment.yml` + `ci-webhook.yml` still present. `gh run list`: **ci-webhook 200/200 failure, 0 success, 2026-08-22 → 2026-09-28**, failing step "Build Docker image (on success)". concept-db: **50/50 failure**. Permanently red CI = zero signal; nobody reads it. Keys: `codebase-bloat-fossils`, `false-verification`.
- `scripts/check-shape-dispatch.ts` is an 8-line delegator to `packages/shape-dispatch-check/check.ts` — real, and invoked by dev-vessel `patch-with-tools.ts` / `vessel-mitosis-evaluate.ts` (`bun run lint`). Live-used.
- JWT section still describes k8s secret `metabob-activity-api.jwt-secret` / helmfile.

### development-vessel (`CLAUDE.md` last 2026-07-09 `6a84899`; README 06-02)
- "The dev-vessel currently ships zero LLM-tier resolvers … never inline" → **51 non-test source files reference `llm_completion`/LLM calls** (e.g. `activity-create-variant.ts`, `author-producer.ts`, `concept-select-for-prompt.ts`). Law/doc drift.
- "Shape budget: 19 → 23 shapes" → **253 resolver files; registry advertises 264 shapes** for `development-vessel-local`.
- Bootstrap templates (`ship-change`, `scaffold-new-vessel`, `add-resolver-to-vessel`, `propagate-judgment`, `branch-health`, `coverage-tick`, `substrate-health-tick`) exist in `activity` (1 row each, `total_executions=0`, re-seeded `updated_at` 2026-09-28 08:18); `release-change` 178 rows, `harness-run-matrix` 16 rows, all `total_executions=0`. No `activity_execution_traces` row matched any of these names by substring (18,135 rows; caveat: that table's recency is not established — ORDER BY results were inconsistent with count filters, and `activity.total_executions` is known vestigial). Treat as: declared, re-seeded, no evidence of being walked → law 4 `dormant-mechanism`.
- "Commits route through the vessel … `ship-change` activity" → not the landing path (feature_compose / mitosis cutover is).
- Seed prompt text instructs the drafter to POST `substrateGap_write` to **`http://127.0.0.1:8270`** (`src/seed/draft-gap-closing-activity.ts:118`, `src/seed/draft-activity-from-pattern.ts:138`). Registry: `substrateGap_write` is served **only by development-vessel** (8090); 8270 is stateful-ui. Drafted activities that follow the prompt write gaps to the wrong vessel. Keys: `write-read-mismatch`, `endpoint-routing`, `drafter-quality`.
- `compute-state-signature.ts:46`, `docs-decision-answer-scan.ts:151` default to `127.0.0.1:8270` (pinned, the replaced surface).
- `docs/VERIFY_2026_05_21*.md`, `VALIDATION_2026_05_22.md`, `VERIFY_2026_07_09_autonomous_parity.md`: dated status docs inside a vessel repo (law 9 violation; fossils).
- `validation/state/lift-status.json` (as_of 2026-05-26, phase S2) — operator-written lift file still the declared S1→S2 artifact.

### concept-db (`CLAUDE.md` 2026-05-17)
- "Upkeep rules become autonomous activities — subject to Thompson Sampling, create traces": `/upkeep/status` running, interval 300 s, **totalTrials 0,0,3,0,0** across the 5 upkeep activities; `/health` says `upkeep.enabled:false` while `/upkeep/status` says `enabled:true` — self-contradictory report. Gated by env `UPKEEP_ENABLED` (law 1). Keys: `dormant-mechanism`, `env-gating`.
- `/health.search`: **25,651 searches, 24,207 dense_true_empty (94%)**, 1,399 dense hits → the concept graph returns nothing for most walk/prompt queries (information availability, law 8). Key: `goal-walk-floor` / `memory-recall`.
- Env table defaults (`PORT 8081`, `ACTIVITY_API_URL http://metabob-activity-api:8080`, `SURREALDB_PASSWORD changeme`) are K8s-era; CI/CD section points at deployment repo.

### discovery-vessel (`CLAUDE.md` 2026-07-19)
- "Point-and-go door: `GET /bootstrap` returns relay anchor, identity authority, canonical discovery endpoint": node 1 → `relay_multiaddrs:[]`, `discovery_endpoint:""`, identity `http://127.0.0.1:8101`; node 2 → `relay_multiaddrs:[]`, `discovery_endpoint:""`, identity `host.containers.internal:18101`. The door returns nothing a spoke can join with; obsidian-vessel's installer depends on it for the relay. Key: `federation-p2p`, `dormant-mechanism`.
- "In-memory, single replica": hub registry has **11 vessels**; missing: ribosome-vessel, boredom-vessel, identity-vessel, metric-collector, clock (running units). Node 2: 8.
- dev-vessel registers as `http://host.containers.internal:18090` (hairpin via host; `VESSEL_ADVERTISE_ENDPOINT`), works from inside (200, 2 ms) but is a host-dependent address (law 11).
- **Ribosome registration fails 400 every minute**: `7cc9da4` (2026-09-19, Avi Gopal, "validate register payloads") rejects `shapes: []`; ribosome registers `shapes: []` by design (`ribosome-vessel/src/index.ts:697`). journal: **5,240** "register failed: 400" since journal start 09-25 13:11; heartbeat 404 → re-register churn. Impact honestly: ribosome owns no shapes, so shape routing is unaffected; cost = 1,440 failed registers/day, fleet census via discovery omits a running vessel, log noise. Key: `directed-overshoot`.

### identity-vessel (`docs/OPEN-FINDINGS.md` 2026-08-21)
- States "Finding 2 is now fixed; findings 1 and 3 are still open." Git: `c8bf5d9` 08-22 "a revoked key was still listed as active" (finding 1) and `a9db360` 08-25 "gate /v1/jwt/generate role by caller entitlement (SEC-5)" (finding 3). Doc says open, code says closed (not re-probed live). Key: `docs-drift`.

### stateful-ui-vessel (README 2026-06-15)
- "The substrate's face … Port 8270". Live: still running, **794 panels** (memory recorded 480 on 09-22 → still accreting writes to the replaced surface). Registry: all **8** stateful-ui shapes (`uiPanel_write, uiQuestion_write, uiQuestion, uiFeedback, interactor*`) are **also advertised by human-surface-vessel** (11 shapes) → two producers for the human channel; routing picks one. Keys: `human-surface-escalation`, `codebase-bloat-fossils` (duplicate producer), `docs-drift`.

### human-surface-vessel (`ui/README.md` 2026-09-19)
- Current and accurate in shape terms; note human-surface-vessel is a plain directory (not a submodule; memory 09-22: outside the authoring loop).

### ias-executor-ts (README 2026-05-15)
- "Milestone A scaffold … in-memory" → consumed by 7 live vessels (analysis, clock, llm-resolver, local-tools, development, ribosome, goal-host). Stale.

### cpg-inference-ts (README 06-23)
- Consumed only by analysis-vessel. Submodule; low-traffic library.

### libp2p-federation-transport (README 06-30)
- Describes relay + ingress sidecar; `/bootstrap` relay list empty on both nodes (above) → the documented join path is not currently served. Key: `federation-p2p`.

### obsidian-vessel (README 07-19)
- Installer defaults `http://localhost:18100` / `http://127.0.0.1:18260`; the `localhost` one hits the §0 failure for curl-style clients (Electron behaviour not tested). No obsidian vessel registered on hub discovery. Obsidian timers are among the held timers.

---

## 3. Image / node drift touching the docs
- CLAUDE.md, deploy skill, metabob-substrate skill and the Dockerfile HEALTHCHECK (`Dockerfile.substrate:433,470`) all assume `/usr/local/bin/substrate-status` and `substrate-connect` (added `76d548d1` 2026-09-23). **Node 1** runs `ghcr.io/avigopal/substrate:dev`, image created 2026-09-24 04:11 UTC, container created 09-23 21:14 PDT — **neither binary present**; `docker inspect` shows no health status. **Node 2** (`localhost/substrate:compose-ownership`, 09-26) has both. Keys: `sync-deploy-drift`, `node-locality`, `docs-drift`.

---

## 4. Autonomous landing found while checking goal-host docs (no docs exist)
- `f375f10` (2026-09-12, Substrate Autonomous, "apply route-edit-ea3a308d-compose-report via mitosis cutover") added `landedShaForGoal()` in `goal-host-vessel/src/index.ts:28`, called at the top of every `recordGoalPath` (`:6096`). It POSTs `{pointer:{type:'goal_path_sha'}}` to discovery `/resolve` **without an Authorization header** → **401**. Journal since 09-25: **5,015 "Failed to resolve SHA" of 5,126 recordGoalPath** lines. And `goal_path_sha` has **no producer anywhere in `repos/*`** and none in the registry — fixing auth would only turn 401 into no-producer. Every goal-path record has carried a null landed SHA for ~17 days; the 09-02 intent (`50f7560` "ask git for a late landing before grading an edit goal not-reached") is silently defeated. Keys: `hollow-landing`, `autonomous-regression`, `drafter-quality` (invented shape), `false-verification`.

---

## 5. Claims ledger (declared → what later evidence shows)

| Claimed | Claim | Later / now |
|---|---|---|
| 2026-05-01 (activity-api CLAUDE.md) | `/v2/vessels/*` removed with 410 by 2026-07-01 | 401 on 09-29; still routed |
| 2026-05-15 | ias-executor-ts is a "Milestone A scaffold" | 7 vessels depend on it |
| 2026-05-17 | concept-db upkeep = autonomous Thompson activities that create traces | 3 trials total; /health says disabled |
| 2026-05-26 | lift-status.json: S1→S2 approved (operator file) | still the declared artifact; substrate-measured halves (coverage-tick, substrate-health-tick) have no traces |
| 2026-06-15 `f259d9bd` | Claude memory + dev workflow cut over to the substrate | store now 59 notes from 09-26; hook injects nothing via localhost |
| 2026-07-09 | dev-vessel ships zero LLM-tier resolvers; 19→23 shapes | 51 LLM-referencing files; 264 shapes |
| 2026-07-19 `118d341f` | concept priors injected at session start | works only with 127.0.0.1 override; 94% of concept searches dense-empty |
| 2026-07-19 | discovery /bootstrap is the point-and-go federation door | relay list and discovery_endpoint empty on both nodes |
| 2026-08-21 | identity findings 1 & 3 still open | fixed c8bf5d9 (08-22), a9db360 (08-25); doc not updated |
| 2026-08-02 `8d900156` | edit-gate refusal message fixed | gate itself bypassed by settings.local.json since ≥09-06 |
| ≥08-28 (transcripts) | "set SUBSTRATE_ALLOW_DIRECT_EDIT=1 … restored to 0 after" | still 1 on 09-29 |
| 2026-09-02 `50f7560` | ask git for late landing before grading | defeated by f375f10's 401 path |
| 2026-09-12 `f375f10` | autonomous route-edit landed (reached) | 100% 401 on every recordGoalPath |
| 2026-09-19 `7cc9da4` | discovery register validation hardened | ribosome rejected 1,440×/day since |
| 2026-09-22 `62559ca6` | conventions fetched by type; 91 feedback notes exist | 2 feedback notes exist |
| 2026-09-22 (memory) | two memory stores merged at file level | live store begins 09-26; 680-note store still unread beside it |
| 2026-09-23 `76d548d1` | image reports its own readiness (substrate-status/connect) | absent on node 1 image |
| session-end hook (since 06-16) | dispatches memory consolidation | 171 dispatches; latest HOLLOW → floor reach by reading memoryNote; learned "4/5 reached" hollow pathway |

---

## 6. Recurrence patterns visible from this shard
1. **Silent fail-open as a pass** — session-start (0 bytes), edit-gate S3 branch, CI red 200/200, ribosome 400 loop, landedShaForGoal 401: every one of these logs or exits 0 and nothing reads the failure. Same class as the memory index law "a silent skip reads as a pass", again.
2. **Producer written, consumer never checked** — memory-mirror writes to a store that gets lost; seeds point writes at 8270; landedShaForGoal reads an unserved shape; session-end dispatches a goal that satisfier-reaches.
3. **Declared restored / declared fixed, never re-measured** — bypass env, OPEN-FINDINGS, lift-status, merged memory stores.
4. **Documentation concentrated on fossils** — 60% of vessel .md in dead K8s-era repos, 0 docs for the ten vessels that run the loop.

## 7. Keep / organize (recommendations from this shard)
- KEEP: memory-mirror hook (works), session-end dispatch *mechanism* (but its goal is hollow — replace goal or its oracle), `vessel-ctl` (verified), `packages/shape-dispatch-check` lint (live-used), metabob-substrate skill's reading-results section.
- FIX-ONCE, general seam: make hooks/MCP read one client config (`substrate-connect` output) and use `127.0.0.1`, or bind vessels dual-stack — one seam fixes 4 consumers.
- REMOVE/ARCHIVE: `SUBSTRATE_ALLOW_DIRECT_EDIT` in settings.local.json (or drop the claim the gate exists); `opsx` command duplicates; the second MCP namespace; deprecated `/v2/vessels/*`; `sync-to-deployment.yml`/`ci-webhook.yml` K8s CI; dated VERIFY docs in dev-vessel; K8s sections in activity-api/concept-db CLAUDE.md; gitignored K8s repos from the working tree (or move to an archive path); `activity_template`/`activity_metrics`/`activity_templates` empty tables in docs.
- WRITE: one timeless doc per core vessel (goal-host first), stating its shapes and the invariants its readers rely on.
