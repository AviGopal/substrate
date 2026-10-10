# The gap-improvement loop, stage by stage: is each hand-off shaped and visible? (2026-10-10)

This is a read-only check of the gap-improvement loop against SUBSTRATE_AS_SOFTWARE §5.0, which says "loops couple only through shapes". The standing goal it serves: "ensure that all properties required for continuity and learning are shaped and visible to the system itself".

For every stage hand-off it records four things:
- the **writer**, and what it writes: a shape, a store field, or a log/file;
- the **reader** at use time;
- the **behaviour-steering parameters**, shaped or constant;
- whether the system's **own observers** can see it.

Its ranked list of what the system cannot see is the candidate list of **system needs**. It is evidence only: nothing was filed or edited.

## Sources

- Code is read at origin/dev, at these commits:

  | Repo | Commit |
  |---|---|
  | super-repo | 7ae5e785 |
  | development-vessel | 51c04d50 |
  | goal-host | fa73254 |
  | activity-api | 66689bb |

- Abbreviations:

  | Short | Means |
  |---|---|
  | `dv` | repos/development-vessel |
  | `g2f` | dv gap-to-feature.ts |
  | `fc` | dv feature-compose.ts |
  | `vmc` | dv vessel-mitosis-cutover.ts |

- Live gap-store counts were read-only, on node 1, out of 8,259 rows:

  | Field | Rows |
  |---|---|
  | `verification_spec` | 0 |
  | `reverted_landing` | 3 |
  | `regressed_by` | 29 |
  | `reopen_count` > 0 | 184 |
  | open with `pending_outcome_verification` | 99 |
  | `closed_reason=landed_verified` | 68 |

- The hardcoding census (10-01, `hardcoding/B-env-gated-behavior.md`) is cited where it applies. Its scan covered `repos/*/src` only, so it misses pull-sync and most per-stage constants listed below.

## Who the system's observers are

| Observer | What it reads |
|---|---|
| **gap-store-census** (`super` gap-store-census-tick.ts:80) | The total row count only. |
| **joint-liveness** (joint-liveness-tick.ts:41-48, 66) | One hard-coded binding (`decision_outcome`) plus the `jointBinding` pool rows. The 5 live rows are ribosome-extraction, behavioral-verification-input, operator-revert-learned, ribosome-registered and discovery-endpoints-healthy. None of them covers arm, admit, cutover, settlement or reopen. |
| **validator-liveness** (validator-liveness-tick.ts:59) | Activity ids matching `/tick\|scan\|probe\|observer\|audit\|integrity\|conformance/`. It reads no gap fields, and it does not match feature_compose, gap_to_feature or self_fact_reconcile. |
| **self_fact_reconcile** | gap_birth_verdicts (:730-755), retry_evidence (:799-835), lane_coverage (:1030; this is tsconfig coverage, not lane throughput), autonomy_scope_pinned, spend_envelope_pinned, and two pull-sync journal patterns. |

No observer named "proof-of-life" or "lane health" exists on origin/dev. The nearest is learning-liveness-probe.ts, which covers the credit loop only.

## 1. Hand-off table

| Stage | Writer, and what it writes | Reader | Steering parameters | Observer visibility |
|---|---|---|---|---|
| **detect → gap write** | The **`substrateGap_write` shape** (e.g. gap-store-census-tick.ts:126). The store (dv substrate-gap.ts:1571) writes gaps.json, stamps falsifier metadata (:2190-2200), mirrors the row as a `poolImpulse` `substrateGap` (:2448) and emits the bus event `devvessel.gap.written` (:2478). | gap-drain-observer.ts:206/263; boredom goal-generation.ts:143. | `GAP_CLASS_OPEN_CAP` env, default 3 (census row moved to :1838, value unchanged). **Constants missing from the census:** nudge throttle 60 s (:2298); `COMPOSE_MIN_INTERVAL_MS=90_000` (:2393, a hard-coded duplicate of an env var); `BIRTH_REEVAL_PER_TICK=2` (:909). | Birth verdicts are visible through self_fact. **Write refusals (`consumption_gated`, the open cap) are log + caller only (:1841-1849). Invisible.** |
| **gap write → drain nudge** | **Log only** (substrate-gap.ts:2377-2442). The nudge POSTs `gap_to_feature` with no gap_id (:2430). The observer path writes per-gap lines to the **file** pool/drain-log.jsonl (gap-drain-observer.ts:501-506). | remedy-effectiveness-observer.ts:97/137, which reads only `dispatched` lines. | `COMPOSE_DRAIN_MIN_INTERVAL_MS` and `GAP_DRAIN_OBSERVER` env (census, unchanged). Constants: 60 s TTLs (:30-31), backoff 60 s/1 h (:358-359), category cap 2 (:300). | Invisible, apart from watchdog-tick.ts:45 checking the file's mtime. |
| **arm (check supply)** | gap-check-supply.ts:274 writes through `substrateGap_write`. Fields: `check_supply.*`, `edit_site`, `evidence_resolve`, `disposition=needs_localization`, `gap_check_supply_arm` (:350-446). It settles the shape `timeShapedRhythm` (:253-259) and returns the shape `gapCheckSupplyReport` (:460). | check-supply-admission.ts:63-66; fc:5307-5367, :7849; g2f:5431; rhythm-conductor-tick.ts:193. `gapCheckSupplyReport` has no reader (UNVERIFIED beyond grep). | Cadence is **shaped** (rhythm `gap-check-supply`). Its per-tick fields fall back to constants: due_threshold 1, max_per_tick 1, backoff_hours 24, max_attempts 3, measure_window_days 7 (:283-290). **The live rhythm row and its seed (rhythm-seed-tick.ts:250-263) carry none of these fields, so all five are constants in practice.** Treatment/control split by sha parity (:156); `DEFAULT_LEDGER_WAIT` (admission :72). None are in the census. | **No observer reads arm state.** self_fact's supply-backlog count uses gap-lifecycle candidates instead (:760-770). Only the rhythm's α/β moves. |
| **admit** | `admitActionableGaps` (g2f:2160-2564) records exclusions as **log lines only** (:2174/2187/2553/2562). The caller keeps only `{admitted}` (:7087). Landability-floor drops: log (:1805). Lineage, spend and backoff exclusions: log (:7071-7077). Targeted refusal: the shape `gapToFeatureReport{REFUSED,non_attempt}` (:2618). The pick goes to the **file** pick-decisions.jsonl (:1942). Class posteriors go to the **file** gap-class-posteriors.json (:5019). | pick-decisions.jsonl: **none** (only its path constant). Exclusions: **none**. | **Shaped:** `autonomyScope` (g2f:6648-6661); `spendEnvelope` (:6563, incl. `lineage_usd_cap`). **Constants, not in the census:** `LANDABILITY_FLOOR=0.15` (:1802); score weights (:1521-1567); `HUMAN_REPORT_PRIORITY=1.5` (:1769); `PENDING_SCAN_MAX=120` (:1580); `CHILD_GAP_MONOPOLY_THRESHOLD=3` (:2196); `MAX_ADMITTED_PER_EDIT_SITE_PER_CYCLE=2` (:2214); `RECOMMIT_LINEAGE_ATTEMPT_CAP=6` (:7030); `EXCLUDE_ORPHAN_AFTER_FAILS=1` (:2015); `GAP_BACKOFF_MAX_MS=24h` (:117). **Env, in the census and unchanged:** `GAP_COMPOSE_COOLDOWN_MS`, the typecheck cache and run limits, the `MITOSIS_DIRECT_PUSH` kill switch, boredom's `GAP_GOAL_COOLDOWN_MS`. gap-landability-model.ts `UNLANDABLE_THRESHOLD=0.25` (:39) is not wired into selection. | Scope and envelope drift are visible (self_fact pinned rows). **Per-gap exclusions, floor drops and picks are invisible.** |
| **compose** | **In-process call** `resolveFeatureCompose` (g2f:7853). The lease is the shape `substrateGapLease_write` (fc:5403). Refusals become a gap-row field via `appendComposeLesson` (fc:5469). The compose trace carries gap_id, `cutover_refusals`, semantic_* and apply_failed (fc:9319-9436). apply-proposal-as-patch composes with no gap (`adhoc-spec`, fc:9034). | compose-drift-tick.ts:158-172 reads apply_failed/ops_applied. **`cutover_refusals`, semantic_* and hard_fail have no reader.** | `COMPOSE_MAX_CONCURRENT`, `COMPOSE_CEILING_MS`, `ROUTE_FEATURE_PROPOSALS_TO_COMPOSE` and `MAX_NEW_RESOLVERS_PER_HOUR` are env (census; the last moved to :977). **Missed by the census:** `MAX_CONCURRENT_COMPOSES=4` (fc:5061); `parked_landing_ttl_ms` default 24 h (g2f:7849). Scope is shaped. | BUSY refusals are log only (fc:5413/5430). Visible to compose-drift-tick and self_fact retry_evidence. Not visible to validator-liveness, whose regex doesn't match. |
| **own-check** | Log `[fc-own-check]` (fc:7981). `stampComposeProgress` exposed on /health. A fail stage in the return value (fc:8006). The gap row is stamped by `stampOwnCheckOutcome` (vmc:55-80). | pull-sync restart deferral reads /health (pull-sync.sh:216-224). | `SEMANTIC_CUTOVER_GATE` env (now fc:800; the census said :643, value unchanged). `ANCHOR_REGION_SLACK_LINES` env (census). **Constants missed:** `LLM_RETRY_ROUNDS=3` (fc:627); `MAX_REPAIR=4` (fc:8107); `PER_CALL_TIMEOUT_MS` (fc:449); `BASELINE_CACHE_TTL_MS` (fc:5093). | **No observer reads the own-check result.** |
| **cutover** | **In-process call** (fc:9011). Park file (fc:163/8996). `registerAttempt` writes to the shape `attemptLedger` (fc:8935). Lock file mitosis-pending.json (vmc:774). Verdicts are **log lines** (vmc:1003/1015/1018/1026/582). Only ~5 of ~30 `softRefuse` sites carry gap_id (vmc:598). The landing trace carries gap_id and sha (vmc:675-700). Commit trailers `Gap:`/`Attempt-Id:` (vmc:2876/2897). | The return body goes to g2f `genuineLandSignal` (:2642/7903). The park is read at g2f:7850. mitosis-pending is read by pull-sync and the `mitosisPendingState` shape. **Cutover traces: no reader.** | All env, in the census: `MITOSIS_STAGED_MAX_AGE_MS`, `CUTOVER_LEASE_WAIT_MS`, `CUTOVER_PRECHECK_SUITE`, `MITOSIS_DIRECT_PUSH`, `MITOSIS_HOST_SYNC_MODE`, `MITOSIS_SKIP_CLONE_RESET`, `MITOSIS_CUTOVER_SKIP_SYSTEMCTL`, drain and restart delays. **Constants missed:** `MAX_PUSH_ATTEMPTS=3` (:2961); `BASELINE_MAX_AGE_MS=24h` (:156); `PROTECTED_VESSELS` (:462). | **Invisible.** No self_fact row matches it. detect-cutover-stuck-loop reads mitosis-applied-host-sync.jsonl, which is probably not written under direct push (UNVERIFIED live). |
| **post-land** (inside cutover) | A pending stamp through `substrateGap_write` (`pending_outcome_verification=<sha>`, vmc:3579-3648). It is skipped for `adhoc-spec` and when behavioural verification failed. The post-land suite gap (`post-land-suite-red-<vessel>`, vmc:3534) names its originating gap **in prose only**. | g2f `pendingSweepCandidates` (:3417); sweep (:4780); fc:2591; picker (g2f:1887/1907). | — | No liveness observer reads the pending stamp. |
| **deploy** (pull-sync) | `super` substrate-pull-sync.sh writes the `.last-good/<v>` sha pin, the DEFERRAL_LOG jsonl, and per-vessel gaps (`pull-sync-test-regression-$v`, `-unhealthy-$v`, `-revert-failed-$v`, `-fanout-$v`; :3609-4044) **keyed by vessel/HEAD, never by the originating gap**. It never reads the `Gap:`/`Attempt-Id` trailers. The shape `pull_cutover` reports vessel, sha and reverted, with no gap_id (pull-cutover.ts:42/232). | last-good is read by pull-sync itself and by pull_cutover. **Settlement does not read it.** | **Shaped** (`substrate_tuning_param`): stall_seconds, probe_window_max_seconds, owed_restart_max_hold_seconds, testgate_budget_defer_max. Env: `TEST_GATE_MAX_REFUSALS`, `GATE_BUDGET_SECONDS`, `STAGGER_SECONDS`, `MITOSIS_LOCK_TTL_MIN`, `MITOSIS_MAX_CONSECUTIVE_DEFERS`, `QUIESCE_WAIT_S`, marker TTLs. Constant `TG_OUTSTANDING_ESCALATE_SECONDS` (:3285). Glue soak_ticks are in a **file** (gate-policy.json). **The census misses all of pull-sync.** | Visible through two self_fact journal patterns. **The link from a deploy to its originating gap is invisible.** |
| **settlement** | `sweepPendingLandVerifications` (g2f:4686) runs only inside the g2f tick, and only when the clone fingerprint changed (:6838-6845). It decides by reading **clone git ancestry and `systemctl show ActiveEnterTimestamp`** directly (g2f:3581, 4440-4499), not a shape. It closes through `substrateGap_write` (:4926-4966), plus `recordCloseVerdict` and `updateClassPosterior`. The tally is **log only** (g2f:4964). Attempt sweep: `attemptOutcome`/`attemptSettlement` go to the ledger; its summary is log only (g2f:6852). | `closed_reason` is read by goal-reach-tick.ts:483, detector-yield-registry.ts:173 and substrate-gap.ts:2138. `attemptSettlement` is read by push-policy.ts:188. | `PENDING_VERIFY_SWEEP_LIMIT=25` constant (g2f:3405). `CLOSE_ORACLE_TRUST_FLOOR=0.7`/`MIN_SAMPLES=10` constants (:3719-3720). Settle window in the **file** settlementPolicy.json, else 15 min (attempt-register.ts:155-168). The close oracle uses a learned class posterior. None are in the census. | **The tally is invisible.** No observer reads the closes. |
| **close** (lifecycle scan) | gap-lifecycle-scan.ts writes `closed_reason` = stale_low_value (:559), expired_not_redetected (:610), churned_unlandable (:680), persistent_compose_failure (:709), and sets needs_info (:600). Its auto-close events go to an emitter that does nothing (:494-498). The age-boundary PATCH goes to an endpoint that does not exist (:520-547). | No learning reader (UNVERIFIED beyond grep). | Pointer defaults in the seed (seed/gap-lifecycle-tick.ts:26). Constants: `LANDABILITY_THRESHOLD=0.2` (:465), reopens ≥ 3 (:595), lessons ≥ 8 (:699). Env `GAP_STORE_ENDPOINT` disables closing (:375). None are in the census. | validator-liveness sees that the scan runs. **What it closes is invisible.** |
| **revert** | The sweep issues a per-gap `console.warn` (g2f:4792) plus `tally.reverted`. `reverted_landing` (:3835) is written **only if the gap is held pending_verification** (:5440). A clone-found revert writes no `regressed_by`, no posterior miss and no settlement #2. Operator reverts do write settlement #2 (:4546). Deploy rollback: the marker file `$v.reverted` (pull-sync.sh:4017) plus the per-vessel gap `pull-sync-unhealthy-$v` (:4044), with the sha in prose. | **`reverted_landing`: no reader.** `regressed_by` is read at g2f:1895 and scope-earn-in.ts:337-360. **The `$v.reverted` marker is not read by settlement (g2f:4440).** | Health loop 5×4 s, constant (pull-sync:4027). | joint-liveness sees **operator** reverts only. **Clone-found and deploy reverts are invisible.** |
| **recurrence** | The gap store sets `reopen_count+1` and `reopened_at` (substrate-gap.ts:2107-2115), and dedups by `gapClassKey` (:357, :1855-1861). `verdictClassGaps` (verdict-class-gap.ts:185) has **no caller**. | gap-lifecycle-scan.ts:594; g2f:3922; goal-reach-tick.ts:714/844; scope-earn-in.ts:338. | `verdictClassPolicy` is shaped (verdict-class-gap.ts:60-93), but its builder never runs. | **No observer reads `reopen_count`.** |

## 2. The six previously known items

1. **The per-gap gap-drain nudge is only a log line: PARTIAL.**
   - On the write path it is log only, and the POST carries no gap_id (substrate-gap.ts:2377-2442, :2430).
   - The observer path does write a per-gap line, but to a file, not a shape. Its one consumer reads `dispatched` lines alone.
   - The comment at seed/drain-pending-substrate-gaps.ts:14 ("no bus event") is stale; see :2478.
2. **Cutover verdict lines carry no gap id: PARTIAL.**
   - Confirmed for the verdict log lines (vmc:1003-1026) and for pull-sync's per-vessel verdicts.
   - Refuted for the landing trace, the compose trace and the pending stamp.
   - But only ~5 of ~30 `softRefuse` sites pass gap_id, and nothing reads the cutover traces.
3. **A revert is recorded only as a sweep total: PARTIAL.**
   - It is also a per-gap warn log.
   - The per-gap field `reverted_landing` is written only for gaps held pending_verification, and nothing reads it (3 live).
   - Deploy rollbacks are recorded per vessel.
4. **`LANDABILITY_FLOOR=0.15` is a constant: CONFIRMED** (g2f:1802). Its only output is a log line (:1805).
5. **`PENDING_VERIFY_SWEEP_LIMIT=25` is a constant: CONFIRMED** (g2f:3405). It is not in the census.
6. **`verification_spec` is dormant: CONFIRMED.**
   - Its reader is vmc:3434. There is no writer in any repo, and 0 of 8,259 live gaps carry the field.
   - Retirement is ruled (REALIGNMENT.md:339) but **not done on origin/dev**.
   - Its jointBinding keeps gap `severed-joint-behavioral-verification-input` open (reopen_count 4).

## 3. NOT VISIBLE TO THE SYSTEM (ranked)

The ranking puts arming first, since arming is the loop's measured bottleneck. Settlement and revert truth come next, then the rest.

1. **Arm state.** No observer reads `check_supply.state` or `gap_check_supply_arm` (gap-check-supply.ts:350-446). The arm limits are constants in practice, because the live rhythm row carries none of them (:283-290).
2. **Admit exclusions per gap are discarded** (g2f:7087) and only logged (:2174-2562, :1805, :7071-7077). pick-decisions.jsonl has no reader (g2f:1942/5020).
3. **Gap-write refusals** (`consumption_gated`, the open cap) go to a log and the caller only (substrate-gap.ts:1841-1849).
4. **Drain-nudge outcomes** go to a log, and to a file whose non-`dispatched` lines nothing reads (substrate-gap.ts:2377-2442; gap-drain-observer.ts:501).
5. **A deploy rollback is never joined to the landing gap.** The `$v.reverted` marker (pull-sync.sh:4017) is not read by `landedCommitRunningHere` (g2f:4440-4469), so a rolled-back landing can still be judged "running". This is inferred from the code, not reproduced live.
6. **The settlement sweep tally** (reverted, not_in_clone, awaiting_restart, falsified) is log only (g2f:4964). So is the attempt-sweep summary (g2f:6852).
7. **A clone-found revert** writes no `regressed_by` and no posterior miss (g2f:4790-4796). `reverted_landing` (:3835) has no reader.
8. **Cutover refusal reasons.** gap_id is mostly missing from `softRefuse` traces (vmc:598), and nothing reads those traces or `cutover_refusals` (fc:9371).
9. **The deploy outcome per landing.** pull-sync gaps are keyed by vessel/HEAD (pull-sync.sh:3609-4044). The post-land suite gap names its originating gap in prose only (vmc:3534).
10. **Lifecycle-scan closes.** Its emitter does nothing (gap-lifecycle-scan.ts:494-498), and its age-boundary PATCH goes to an endpoint that does not exist (:520-547).
11. **Recurrence.** No observer reads `reopen_count` (substrate-gap.ts:2113), and `verdictClassGaps` has no caller (verdict-class-gap.ts:185).
12. **Compose BUSY refusals and the semantic-gate fields** are log only, or are written with no reader (fc:5413/5430, fc:9319-9345).

## 4. Where the code contradicts §5.0/§5.1

- **"Loops couple only through shapes" (§5.0).** Only detect → gap write passes through a shape. After that:
  - compose, cutover and the land signal hand off by in-process calls and return bodies (g2f:7853/7903; fc:9011);
  - settlement reads clone git ancestry and systemd timestamps directly (g2f:3581, 4440-4499);
  - deploy publishes its outcomes as marker files and per-vessel gaps;
  - several stage parameters live in files: settlementPolicy.json, gate-policy.json, gap-class-posteriors.json.
- **"A failed consumer is gap improvement's input" (§5.0).** A deploy revert enters only as a per-vessel gap with the sha in prose. It is never attributed to the gap or attempt that landed the code (pull-sync.sh:4044).
- **"Each loop is verified by the loop that consumes it" (§5.0).** These outputs have no consumer:
  - cutover traces;
  - `reverted_landing`;
  - pick-decisions.jsonl;
  - `gapCheckSupplyReport` (UNVERIFIED);
  - `verdictClassGaps`, whose builder is never called;
  - behavioural verification, which has never had an input (0 of 8,259).
- **"A missing effect is itself content for the gap-improvement loop" (§5.0).** No joint-liveness binding or self_fact row observes arming or admission. So the loop's actual bottleneck cannot become content for the loop.
- **§5.1, mitosis cutover "with typecheck-evidence", is incomplete.**
  - The code's evidence is typecheck plus shape-dispatch, the baseline-delta suite and own-check (fc:4605).
  - Under direct push, pull-sync performs the deploy, not only the cutover's restart. Which restart path runs live is UNVERIFIED.
- §5.1's units `gap-compose`, `funnel-drain`, `self-recovery` and `compose-teacher` do exist under scripts/substrate/units/. That part is consistent.

## Reading for autonomy

Arming (item 1) is the loop's bottleneck, and the system cannot observe it. Every remedy so far has been operator-observed. The cheapest reuse is to add the loop's own stage fields as `jointBinding` rows, which joint-liveness already reads from the pool, so a stalled stage becomes a system-filed gap. UNVERIFIED: whether a `jointBinding` row can address gap-store fields, given that the gap store is a file and joint-liveness's built-in binding checks a table's write freshness. If it cannot, that extension is the need. The candidates are arm state, admit outcome, the settlement tally and revert attribution. That turns the most visible operator task, noticing that the lane has stalled, into a system observation.
