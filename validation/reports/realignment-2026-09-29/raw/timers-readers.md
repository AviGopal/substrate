# Shard: timers-readers — the scheduling layer, what each timer writes, and who reads it

Observed 2026-09-29 ~04:20 UTC, read-only. Node 1 = `substrate-live` (hub, standalone profile),
node 2 = `compose2-live` (spoke; activity-api, surrealdb, identity masked).
Journal retention on node 1 starts 2026-09-25 13:12, so "N runs" counts cover ~3.6 days unless stated.

## 0. The one-paragraph finding

The scheduling layer is ~40 systemd timers on node 1 and 4 working ones on node 2. Most of them
*run* on schedule and exit `Result=success`; far fewer *do work anyone reads*. The dominant defect
is the same one wearing different hats: **a producer writes to one address and the consumer reads
another**, and the most common single cause is commit `09d9baa6` (2026-07-25, "set WORKSPACE_ROOT
durably from SUBSTRATE_ROOT") which redefined `WORKSPACE_ROOT` from the volume root `/workspace` to
the super-repo clone `/workspace/git/super-repo`. Every script that joins `WORKSPACE_ROOT + relative`
now reads a different tree from every script that hardcodes `/workspace/...`. The class has been
patched per site (boredom-vessel index.ts:2393 comment, memory-store merge 09-22, 3c1bf965 on 08-25
for the DB-table variant) and never at the seam. The second defect is **liveness certified by the
wrong signal**: a unit that ran (systemd success, HTTP 200, timer `active`) is treated as a unit
that worked. The third is **detection without an address**: timer detectors refresh the same gap every
tick (`updated_at` moves) with `edit_site` empty, so nothing can close them.

## 1. Per-timer table — node 1 (substrate-live)

Legend: interval / last run; ExecStart (after drop-ins); output; reader (grep over non-mitosis
`/vessels/*/src`, `/workspace/active-scripts`, `/usr/local/bin`, super-repo `scripts/`); verdict.

| timer | every | runs | writes | reader | verdict |
|---|---|---|---|---|---|
| light-dispatch-healthcheck | 30s | 9945 in 3.6d, all ok(200) | journal; restarts light-dispatch on 2 failures | systemd | live, bootstrap-tier watchdog (exempt) |
| self-recovery | 3min (calendar) | ok | journal; restarts units | systemd | live, bootstrap-tier watchdog. Reports `NOT INSTALLED: metric-collector-vessel (:8300)`, `federation-transport-vessel (:8401)` — manifest vessels with no unit on node 1 |
| obsidian-intake | 2min | 2562/2562 SKIPPED (7d) | nothing | — | **dormant**: "no vessel advertises obsidian:note — the human surface is not connected". Target shape belongs to the replaced Obsidian surface; human-surface-vessel is running but does not advertise it. Added d6bb951c 06-29 |
| obsidian-learn | 30min | 222/222 SKIPPED | nothing | — | dormant, same cause |
| obsidian-collaborate | 45min | 169/169 SKIPPED | nothing | — | dormant, same cause |
| db-contention-check | 5min | ok | fires `db_contention_observer` (dev-vessel) → substrateGap cat db_contention | gap store | live detector; gap `db-contention-2026-09-18T17` open since 09-18, refreshed 09-29T04:13, **no edit_site** |
| gap-store-census | 1h | ok "6275 gaps vs 14d high-water 9275" | `/workspace/substrate/state/gap-store-census.jsonl` | writer only (self-baseline) | live, self-reading guard; 6275 rows vs 14d high-water 9275 — removal cause not determined in this shard |
| typecheck-scenario-gen | 45min | `{"total_tc_errors":0,"scenarios_created":0}` | scenario files + gap rows to `GAPS_PATH` default **`/workspace/gaps/gaps.json`** | nobody — live store is `/workspace/git/super-repo/gaps/gaps.json` | **write-read-mismatch**: 20 `typecheck-*` gaps 09-11..09-26 (5,4,1,3,3,4 per day) incl. `typecheck-development-vessel-src-resolvers-vessel-mitosis-cutover-l2784-ts1128/ts1109/l2785-ts1005` (syntax errors in the mitosis cutover) exist ONLY in the frozen store; 0 in live. Unit sets no GAPS_PATH. Introduced 331abda3 06-17 "sustained concrete fuel for the autonomous funnel" |
| efficiency-failure-tick | 20min | `efficiency_scan slow=1 gaps_emitted=1`, `failure_patterns found=0` | substrateGap via `efficiency_scan`, `trace_failure_pattern_report` | gap store | live; systematic_failure = 521 gaps, 510 open |
| goal-host-behavior | 30min | persisted 5-6 rows/tick, gaps_emitted 0-1 | shape `goalHostBehaviorModel` | **no static reader** — only its writer `goal-host-behavior-scan.ts` references the shape | write-only unless resolved dynamically (unverified) |
| joint-liveness | 30min | "severed=3-4" every tick | gaps `severed-joint-*` | gap store | live detector of the write→read class at the DB layer; `severed-joint-ribosome-registered`, `-behavioral-verification-input`, `-ribosome-extraction` open since 09-28T06:11 refreshed every tick; `severed-joint-decision_outcome` since 09-27; **no edit_site** on any |
| observe-orthogonal-refresh | 30min | decision_count 0 most ticks; latest repointed 00:57 (1 MODIFY) | `/workspace/observations/orthogonal-*.json` (2519 files) + `orthogonal-latest.json` | boredom-vessel `enact-orthogonal-decisions` | live-ish; observations dir is an unbounded file pile (2519 files, most from 06-19..06-22, copied 07-29) |
| self-development-trend | 30min | reach_6h 0.0008-0.001, genuine_edges 5885 flat | `/workspace/metrics/self-development-trend.jsonl` | **writer only** | write-only metric log (operator instrument) |
| self-operational-health | 30min | findings `progress_stall` (0 landings, 0 topology Δ in 24h), `workspace_subdir_unavailable` | substrateGap_write (operational_health: 59 total, 4 open) | gap store | live; but see §3.1 item 5 (false positive) and §3.2 (liveness-by-is-active) |
| self-repair-operational | 15min | "0 repaired, 0 failed" | enables allowlisted timers | systemd | live, idle |
| spectral-gap | 20min | nodes 2305 edges 14953 λ2 0.0045; `live_genuine` nodes 0 edges 0 | `/workspace/metrics/spectral-gap.jsonl` (2.8MB) | dev-vessel `pick-priority-scenario.ts:180`, `compose-topology-tick.ts:212`, `generative-frontier-gap-tick.ts:103` (hardcoded `/workspace/metrics/...`), autonomy-metrics, compose-teacher, self-op-health | live read on node 1; **node 2 has no `/workspace/metrics` at all** so the same dev-vessel resolvers there read nothing (node-locality). activity-api config.ts:298 comment itself notes "a file on one host, with no shape" (law 1) |
| runtime-drift | 10min | "development-vessel: 1 differ … not repaired (repair not armed … set RUNTIME_DRIFT_REPAIR=1)"; "NOT COVERED: demo-vessel, relevance-sink-vessel" | journal only | nobody | detection without disposition; repair env-gated (law 1); `resolvers/patch-with-tools.ts` differs from clone |
| trace-store-health-check | 10min | row_count 150054-150437 vs cap 150000, over_cap, gap_emitted true | substrateGap, id keyed by first-detection hour: `trace-store-reconcile-2026-09-23T04` closed, `-2026-09-24T11` open (refreshed 09-29T03:38) with `-narrowed` and `recommit-…-semantic_reject` children | gap store | live; counts rows only — its own gap `the-trace-store-health-observer-counts-execution-rows-and-cannot-see-blob-garbage…` (09-25, open) says it cannot see the 42GB blob problem |
| coherence-recover | 1h | demoted 6 families | activity proposed=true (DB) + `/workspace/metrics/coherence-recover.jsonl` | DB effect read by selector; jsonl writer-only | live (DB reader not verified in this shard) |
| model-reality-audit | 1h | finding `C4.selector_unscored HIGH` every run | gap `model-reality-selector-unscored` | gap store | detected-never-repaired: open since **09-18T17:30**, updated 09-29T03:29 — 11 days of hourly re-detection; 6 `model-reality-phantom-failure-*` opened 09-28 |
| surgical-gap-scan | 1h | **91/91 runs emitted_count 0** | substrateGap_write | gap store | dormant supply. 09-28: da76f061 added "endpoint + absolute resolve-path joins" detector, 807b92ef reverted it the same day |
| db-maintenance | 30min | `actions:[]` every tick; integrity findings `acg_none_fk`, `cts_null_account_id`, `doubled_prefix_ids` persistent; prune_candidates_30d 18135; slow_queries 1764→2862 | `/workspace/metrics/db-maintenance.jsonl` | **writer only** | diagnose-only; the "autonomous DB maintenance" acts on nothing |
| substrate-pull-sync | 10min | synced=1 | clones, `/workspace/active-scripts` (`cp -f` at line 1666) | runtime | live; logs "vessels.inventory.json / vessels.manifest.json was modified locally — leaving it alone (git version NOT applied)" — fleet files diverged from git and pull-sync refuses to converge them |
| composition-edge-reconcile | 30min | **204/206 runs batch_traces 0, upserted 0** (4d); watermark advances, recent_ids stuck at 287 | activity_composition_graph | walk/topology | **duplicate/dormant**: graph_total still grows 13125→14953 because `activity-api/src/routes/execution-traces.ts` writes edges inline at ingest. The timer is a fossil backfill |
| m1-trainer | 15min | writes 1 row/run | `embedding_prior_weights` (**5131 rows**, only latest read) | activity-api `lib/prior-seed.ts:81` via `computeEmbeddingConditionedPrior`, gated `EMBEDDING_PRIOR_ENABLED=true` (set in process) | live read but env-gated (law 1) and unbounded append (~96 rows/day, reader uses `ORDER BY trained_at DESC LIMIT 1`) |
| rhythm-cadence | 15min | considered=12-13; `enqueued=0 skipped=0` on 181+79 of ~370 ticks | pool rhythm impulses | boredom/pool | the law-5 rhythm layer mostly idles; conductor itself logs "does not report a per-family reason" |
| autonomy-metrics | 20min | ok | `/workspace/metrics/autonomy-metrics.jsonl` (12MB) | self-operational-health (freshness + progress_stall), autonomy-status.ts (no caller), 3 fossil views | live (one reader) |
| coherence-metric | 20min | ok | `/workspace/metrics/coherence.jsonl`, `coherence-candidates.json` | autonomy-metrics | live |
| auto-describe-resolvers | 20min | "applied=2 (advertised=407, described=312)" | discovery shape-descriptions (via llm_completion) + `auto-describe.jsonl` (2.6MB) | planner reads discovery descriptions (from script header; not re-verified) | live; jsonl writer-only log |
| memory-budget-check | hourly | **FAIL every run**: "65 of 69 units are uncapped while the largest process IS capped" | journal only | nobody | **laundered failure**: unit has `SuccessExitStatus=0 1`, so exit 1 = success. Added 8dbea1d7 08-17 "wire memory-budget-check, and make it work where it runs" |
| ingest-docs | 6h | ok | concept-db `doc_expectation` concepts + `/workspace/.docs-ingest-manifest.json` | feature-compose consultPrinciples; docs-align-scan (resolver in dev-vessel) | live |
| learning-liveness-probe | 6h | "ALIVE — posterior followed (+0.000225)" | a real probe execution into the trace store; moves the probe arm posterior (alpha +0.66) | — | test-residue-on-cadence: synthetic success injected into live learning state every 6h; exclusion by consumers not verified |
| validator-liveness | 6h | "SEVERED 10/97 — worst: satisfier:vessel_exercise_scan (4.5d)" | gap | gap store | live detector; `service-failure-validator-liveness` open 09-26 |
| compose-drift | 6h | "OK — 9.3% vs self-baseline 8.9%" | gap on drift | gap store | live |
| learning-loop-selftest | 6h | 1 RED `posterior_delta` (probe arm not moved "consistent with the structural skip in posterior-update.ts") | gaps | gap store | live; 9 `gap-learning-loop-selftest-*` gaps (4 from 09-18, 5 from 09-25) all closed within 2 min at 09-28T01:27-01:29 (mass close; not investigated); `learning-loop-selftest` open since 09-19 |
| boredom-vessel.timer | 10min OnUnitActive | "-" next; service running since 09-28 15:50 | — | — | inert timer: BOREDOM_DAEMON_MODE=1 keeps the service active so OnUnitActive never elapses; daemon loop env `BOREDOM_MIN_DISPATCH_INTERVAL_MS=600000`, `BOREDOM_MAX_CONCURRENT=3` (law 5: cadence as env constants) |
| **watchdog-demoted units** (ExecStart replaced by `watchdog-tick.ts` via `usr/lib/systemd/system/<u>.service.d/watchdog.conf`, 887577bd 07-08) | | | | | |
| gap-compose | 20min timer, but **service started every 1-7 min** | 711 `watchdog_restart ok:true http 200` + 217 `deferred_lease_held` on 09-28/29 | fires `gap_to_feature`; log `/workspace/git/super-repo/pool/watchdog-log.jsonl` | dev-vessel | see §3.2. Timer LastTrigger is 09-28 11:45; the starts come from `substrate-gap.ts:1262/1329` `systemctl start --no-block gap-compose.service` on every gap write |
| funnel-drain | 12min | 2 restarts in 2 days | `apply_proposal_as_patch` | dev-vessel | activity marker `WATCHDOG_ACTIVITY_PATHS=/workspace/proposals:/workspace/pool/drain-log.jsonl` — the second path is the **frozen** old drain log (mtime 09-07); the live one is `/workspace/git/super-repo/pool/drain-log.jsonl` (180MB, fresh) |
| compose-teacher | 8min | 15 fires 08-21..09-23, none since | exec `compose-teacher.ts` → `/workspace/metrics/teaching-loop.jsonl` (last write **09-23T01:10**) | writer only | dormant unless the whole drain is quiet: no WATCHDOG_ACTIVITY_PATHS, so it inherits the default marker = the live drain-log, which every drain appends to |
| operator-goal-generator | 12min | 96 fires 08-20..09-09, none since | exec → `/workspace/metrics/operator-goal-gen.jsonl` (last 09-09T21:17, and that last line is `"grounding query failed … TypeError: JSON.parse(text).map is not a function"; dispatching default class goal`) | `operator-goal-signal.ts` (no caller) | dormant and was broken when it last ran; same default-marker trap |

Timers only in comments/other lists: `self-operational-health.ts` REPAIR_UNIT_CANDIDATES = db-maintenance, coherence-recover, trace-store-health-check, gap-compose.

## 2. Node 2 (compose2-live) — what the spoke actually schedules

Only 4 working timers: gap-compose (watchdog), substrate-pull-sync, rhythm-cadence, gap-store-census
(+ inert boredom-vessel.timer). **Masked and `failed`**: compose-drift, compose-teacher, joint-liveness,
learning-loop-selftest, validator-liveness (last attempts 09-27 22:35 .. 09-28 05:28).

- compose-drift, validator-liveness, joint-liveness failed with "Unable to connect" — they assume a
  local SurrealDB (masked on a spoke) rather than routing by shape. joint-liveness-tick.ts:53 `sql()`.
- learning-loop-selftest failed with `Module not found /workspace/git/super-repo/scripts/substrate/learning-loop-selftest-tick.ts`
  — the file is still absent from node 2's super-repo clone (sync drift).
- Masking disposed of the signal instead of fixing placement. Gaps `service-failure-validator-liveness`,
  `service-failure-compose-drift`, `service-failure-learning-loop-selftest` (09-26T13:42, open, no edit_site)
  exist in the node-1 store — created before the node-2 journal failures visible here (09-27 22:35); origin node not established.
- **No self-recovery timer, no self-operational-health, no spectral-gap, no metrics dir on node 2.**
  `/usr/local/bin/self-recovery-tick` is present but unscheduled. node 2's bin also carries
  `substrate-connect`, `substrate-manifest`, `substrate-status` that node 1 lacks (image drift).
- **Independent, stale gap store**: node 2 `/workspace/git/super-repo/gaps/gaps.json` = 70 gaps, 67 open,
  last modified 09-26 12:07; 66 ids shared with node 1's 6279. Node 2's gap-compose watchdog fires
  `gap_to_feature` against 65 open pool intents from that local copy: 33 ok + 4 `http 503` on 09-28/29,
  "stalled_min" 33-61. Node 2 composes from a frozen 3-day-old snapshot of the hub's work queue.
- dev-vessel resolvers on node 2 that read `/workspace/metrics/spectral-gap.jsonl` get ENOENT.

## 3. Write-read mismatch at the scheduling layer, grouped by root cause

### 3.1 Root cause A — WORKSPACE_ROOT redefined (09d9baa6, 2026-07-25)
Unit env file: `SUBSTRATE_ROOT=WORKSPACE_ROOT=/workspace/git/super-repo`, `SUBSTRATE_RUN_DIR=/workspace/active-scripts`.
Instances found in this shard:
1. **watchdog log split**: `/workspace/pool/watchdog-log.jsonl` (1917 lines, gap-compose/funnel-drain/operator-goal-generator
   07-09..07-20, frozen) vs `/workspace/git/super-repo/pool/watchdog-log.jsonl` (5099 lines, 08-18..now).
2. **pool split**: `/workspace/pool/standing.json` 9.7MB frozen 09-07 vs live `/workspace/git/super-repo/pool/standing.json` 2.3MB.
   `/workspace/git/super-repo/pool/` also holds 3 leftover `standing.json.tmp.*` (4MB each, 08-29/30) — aborted atomic writes never cleaned.
3. **funnel-drain stall marker** points at the frozen `/workspace/pool/drain-log.jsonl` (09-07).
4. **typecheck-scenario-gen** writes gaps to frozen `/workspace/gaps/gaps.json` (830 rows, last write 09-26T14:06) — 20 real typecheck gaps never reached the live store.
5. **self-operational-health `workspace_subdir_unavailable`** (MEDIUM, every 30 min): checks `join(WORKSPACE_ROOT, d)` for
   `patterns, observations, metrics, git/super-repo` → looks under `/workspace/git/super-repo/…`, where they do not exist,
   while they do exist under `/workspace/`. A false finding manufactured by the same flip.
6. boredom-vessel `src/index.ts:2393` comment documents reading around "the literal /workspace/gaps/gaps.json — a copy frozen 2026-08-08";
   `substrate-gap.ts:99` documents an operator probe misdiagnosing from the same frozen file. Per-site patches, no seam fix.
7. Metrics are the mirror image: writers hardcode `/workspace/metrics/*` (exists) and readers hardcode the same; `generative-frontier-gap-tick.ts:103-105`
   tries three candidate paths (`/workspace/metrics`, `join(workspaceRoot(),"metrics")`, `scripts/substrate/workspace/metrics`) — path guessing as a symptom of the class.

### 3.2 Root cause B — liveness certified by the wrong signal
- **watchdog-tick.ts** logs `ok: res.ok` (HTTP 200) and never re-checks the marker it gates on. 09-28/29: 711 restarts all `ok:true`
  while compose-lessons.jsonl stayed stale 151→230 min (`stalled_min` rising monotonically in consecutive records). "Restart succeeded" and
  "flow still stalled" coexist every tick. The c71819af (09-04) comment already records the variant "unit exited Result=success because the payload-level ok:false is invisible to systemd".
- The code documents both contradictory states: `substrate-gap.ts` (~09-14 comment) says compose-lessons "is never stale so the drain never fires";
  today it is 230 min stale and the watchdog fires every tick. Neither statement was re-verified against the other.
- **Three redundant compose entry points**: GapDrainObserver (event, dev-vessel `services/gap-drain-observer.ts:144`), substrate-gap in-process
  nudge + `systemctl start --no-block gap-compose.service` on every gap write (`substrate-gap.ts:1262,1329`), and the watchdog.
  The comment block at 1207-1260 records the history: masked unit start swallowed (log certified an outage), 27 concurrent typechecks at load 50.8,
  115 s event-loop freeze per gap write before `--no-block`, 7323→7650 gap rows in one night from freeze→restart→child-gap loops.
- **memory-budget-check**: `SuccessExitStatus=0 1` + FAIL every hour.
- **self-operational-health** check 1 tests `systemctl is-active <timer>`; a watchdog-demoted unit whose real script has not run since 09-09
  (operator-goal-generator) or 09-23 (compose-teacher) passes. Check 2b only covers 4 hardcoded REPAIR_UNIT_CANDIDATES.
- composition-edge-reconcile reports success with 0 work on 204/206 runs.

### 3.3 Root cause C — stall marker shared across flows
watchdog default `WATCHDOG_ACTIVITY_PATHS = ${WORKSPACE}/pool/drain-log.jsonl:${WORKSPACE}/proposals/compose-lessons.jsonl`.
compose-teacher and operator-goal-generator set no paths, so their "is my flow alive" test reads another flow's log. Their cadence is a function of
gap-compose's activity, not of their own work.

### 3.4 Root cause D — spoke placement (node-locality)
Detectors that open SurrealDB directly (joint-liveness, validator-liveness, compose-drift) instead of resolving by shape fail on a spoke and got masked.
Metrics files are node-local, and dev-vessel resolvers hardcode their path. The gap store is a per-node JSON file.

## 4. Detection without address (gap-content)
Every timer-filed gap examined has `classification_metadata.edit_site` empty: db-contention-2026-09-18T17 (open 11 days),
model-reality-selector-unscored (open since 09-18, refreshed hourly), severed-joint-* ×5, service-failure-* ×3, learning-loop-selftest (since 09-19),
trace-store-reconcile-2026-09-24T11 (refreshed 09-29T03:38) — a timer detector whose gap then spawned `trace-store-reconcile-2026-09-24T11-narrowed` (09-28T03:16) and `recommit-trace-store-reconcile-2026-09-24T11-semantic_reject` (09-28T03:37): the exact narrowing-duplicates child pattern. Contrast: operator/LLM-authored gaps in the same family carry edit_sites
(`repos/activity-api/src/services/trace-retention.ts`, `scripts/substrate/units/surrealdb.service`) — and grow `-narrowed` / `recommit-…-anchor_not_found` /
`-semantic_reject` children (narrowing-duplicates).

## 5. Script retention — `/workspace/active-scripts` (node 1, 95 files; node 2 39 non-d.ts)
Seeder `substrate-active-scripts-seed.service` and pull-sync (line 1666) both do `cp -f scripts/substrate/*.ts /workspace/active-scripts/` — **copy, never prune**.

No caller and ABSENT from the super-repo (fossils living only in the volume, dated 08-02/08-05):
autonomy-metrics-view, autonomy-trend, backfill-composition-edges, composition-edge-backfill, criterion-coverage (self-op-health comment explicitly excludes it; its output
`criterion-coverage.jsonl` frozen 07-29), docs-align-scan (superseded by dev-vessel's resolver `docs-align-scan.js`), docs-align-status, learning-to-learn-demo,
meta-closure-view (reads `/workspace/gaps/gaps.json`), prime-concept-db, recompute-poisoned-posteriors. Also `.dispatch_capability_gap.json` (07-29).

No caller but present in super-repo: autonomy-status, concept-db-bench, identical-failure-run-tick, performance-status, operator-goal-signal (only named in a
comment in operator-goal-generator.service), import-operator-memory (referenced by mirror-memory-note), validate-build (Makefile only).
mirror-memory-note is called by the host hook `.claude/hooks/substrate-memory-mirror.sh` (operator-side, fine).

Shadowed by drop-ins (file kept, ExecStart overridden): gap-compose-tick.ts, funnel-drain.ts (restart via impulse, so the script is never executed);
compose-teacher.ts / operator-goal-generator.ts (only via WATCHDOG_RESTART_EXEC).

Tracked compile residue: 48 `.js` + 48 `.d.ts` siblings in `scripts/substrate/` tracked in git, added by **4e4170a8 (2026-09-07) "Automated commit:
vessel code drift detected and committed."** — an autonomous commit landed tsc emit output; the `.d.ts` copies are re-seeded into active-scripts every sync (dated 09-29).

## 6. Law checks
- Law 5 (pace is rhythm, not timer): ~40 systemd timers with static `OnUnitActiveSec` remain the de facto cadence; the rhythm conductor (12-13 families) enqueues
  0 on most ticks. boredom daemon cadence is env constants.
- Law 1 (env gating): RUNTIME_DRIFT_REPAIR, EMBEDDING_PRIOR_ENABLED, BOREDOM_*, WATCHDOG_* (whole flow routing lives in env drop-ins), GAPS_PATH/SCENARIOS_DIR defaults.
- Script-retention rule: 11 volume-only fossils + 7 no-caller scripts; the no-prune copy is the generator.

## 7. Not covered / unverified
- The 12-13 rhythm families were not enumerated; DB-side readers of coherence-recover demotions and auto-describe descriptions taken from script headers.
- Whether any consumer excludes learning-liveness-probe / learning-loop-selftest synthetic executions from posteriors/metrics (only activities.ts mentions probe).
- Node 2 masked detectors not re-run. Journal on node 1 only back to 09-25.
- `goalHostBehaviorModel` might be resolved dynamically by shape (no static reader found).
