# Source readers / writers for an attempt-outcome ledger — verified 2026-09-23 ~01:20-01:35Z

Paths are relative to `/home/avi/documents/work/substrate/repos/`. Container = `substrate-live`.
All live probes ran in-container. **Side effects disclosed (probes are not read-only):**
(1) `systemd_unit_health_observer` (default `emit_gap:true`) re-emitted existing gap
`service-failure-memory-budget-check` (open, created 2026-09-19, `updated_at` bumped to 2026-09-23T01:22:39Z) — no new gap id.
(2) `substrate_health_tick` rewrote `/workspace/git/super-repo/substrate-heartbeat.json` at 01:24:27Z
(with `overall_passing:null` from the degraded activity-api). (3) `detector_coverage_scan` and
`push_health_observer` have gap emission on by default but emitted 0.

## 0. Environment findings (read first — they affect every number below)

- **Resolve body envelope on development-vessel is `{"impulse":{"pointer":{"type":…}}}`**, not `{"pointer":…}`.
  `{"pointer":{"type":"push_health_observer"}}` → `400 {"success":false,"error":"pointer.type is required"}`
  (`development-vessel/src/routes/impulses.ts:1026-1038`, reads `body.impulse.pointer ?? body.impulse`).
- **Host `~/.metabob` apiKey**: host ports `:18090`/`:18080` returned `http=000` (nothing answered), so
  the 401 was reproduced by injecting the host key **in-container**:
  `docker exec -e HK="$(jq -r .metabob.apiKey ~/.metabob/config.json)" substrate-live sh -c 'curl … http://127.0.0.1:8080/v2/activities/execution-traces?limit=1 -H "Authorization: ApiKey $HK"'`
  → `401 {"error":{"code":"INVALID_API_KEY","message":"API key is invalid or has been revoked"}}`.
  Same host key against dev-vessel `:8090/v2/impulses/resolve` → `200` (dev-vessel resolve also
  accepted a call with **no Authorization header at all** — resolve on :8090 is effectively unauthenticated).
- **activity-api was unstable during this window.** The in-container `$METABOB_API_KEY` itself got
  `401 INVALID_API_KEY` on `/v2/activities/execution-traces` and `/v2/activities/templates` at ~01:23;
  activity-api `ActiveEnterTimestamp` moved 01:17 → 01:25; after that the same call returned
  `200 {"executions":[],"total":-1}` and then timed out. Ribosome journal (6h) shows reach re-reads
  failing `http-401`: 54 (23h), 79 (00h), 1 (01h) — extraction silently skipped for those.
  Re-derive: `docker exec substrate-live bash -c 'journalctl -u ribosome-vessel --since -6h -o short-iso | grep "reach re-read" | grep -c http-401'`.

## 1. Failure memory (goal-host) — commits 9e23455, cf8fd87, 4710f6c

| Item | Location | Detail |
|---|---|---|
| Store | `goal-host-vessel/src/index.ts:3900-3905` | in-process `Map<goal_hash, GoalFailureRecord[]>` (max 5/hash) + append-only `/workspace/.goal-host-failure-memory.jsonl` (`GOAL_FAILURE_MEMORY_PATH` env override). |
| Key | `:3915` `goalHashOf(goalText)` (`goal-target-inference.ts:28` — NFC+lowercase+whitespace-collapse hash of goal TEXT) plus a lexical `classToken` (`:3907`, first word + next token, e.g. `compute-product`) for near-miss recall. **Not keyed by edit_site / file / execution_id / attempt_id.** |
| Record | `:3901` `{hash, classToken, reason(≤600), pick, shapes(≤12), attempts, at, deterministic}`; supersede marker `{hash, reachedAt}` (`:3925-3932`). |
| Filter | `:3914` drops structural reasons (`no producer|no template produces|capability gap filed|…|timed out`). |
| Write site | `:15970-15987` at dispatch finalization, only when `record.reached===false`: harvests distinct `HOLLOW — …` verdicts from `walkStepSink` + final `goalReachReason`, max 3. `reached===true` → `markGoalReached` (supersede, not erase). Also `evictReachedCommand` at `:15963-15966`. |
| Recall | `:11637-11642` `priorFailureFeedbackFor(goal)` at dispatch start; exact-hash records + deterministic near-misses (`:3942-3953`). |
| Injection | `:12544-12559` `runGoalAsPoolWalk(goal,{priorVerdictFeedback, ablation: exact>0 ? disableReuse:true})`; in-dispatch FEEDBACK-RETRY `:12583-12604` appends `(this dispatch, the attempt just graded)`. **Only consumer of `opts.priorVerdictFeedback` is `:7645-7651`** — prepended to the prompt of an `llm_completion`/`llmCompletion` satisfier whose prompt was empty. It does not reach feature_compose, the gap drafter, or deterministic resolvers. |
| External write? | **None.** `rememberGoalFailure` has exactly one call site (`:15984`); no resolver/shape exposes read or write. The jsonl is loaded **only at boot** (`:17103`), so an external appender would need a goal-host restart, and would bypass the reason filter. |

Live: `wc -l /workspace/.goal-host-failure-memory.jsonl` → `62`; last row e.g.
`{"hash":"6acc8a84","classToken":"close-substrate","reason":"deterministic:edit-intent-no-landed-edit — …","pick":"satisfier:git_diff",…,"deterministic":true}`.

### Does feature_compose / the drafter read prior failures keyed by file / edit_site?

Yes, three channels — all **pre-land** (draft/verify rejection), none carry **post-land regression**:
- `priorAttemptFeedbackBlock(meta)` `development-vessel/src/resolvers/feature-compose.ts:2172-2256`, called at `feature-compose.ts:4099` and `gap-to-feature.ts:828`. Reads **gap** `classification_metadata`: `semantic_gate_reason`, `suspected_real_location`, `verify_failure_reason`, `failure_lessons[]` (last 5), and `pending_outcome_verification` (renders "PRIOR LANDED ATTEMPT … do NOT re-apply, do NOT revert"). Keyed by **gap id** (the gap row), not file.
- `failure_lessons[]` written at `feature-compose.ts:3135-3168` (max 8, `{at,class,reason,raw_excerpt}`); live: 526 gaps carry it.
- `fileLessonsBlock(spec)` `feature-compose.ts:3309-3331` — **the only file-path-keyed channel**: `/workspace/proposals/compose-file-lessons.jsonl` (2510 lines), matched when a lesson's `files[]` appears in the spec text; content is **verbatim tsc output only**, written at `:6482-6491` on a failed apply/verify.
- `compose_lesson` concepts: mirrored to concept-db class-grain (`:3244-3306`), recalled by failure-class name `:3340-3396` (`conceptSearch source_type:"compose_lesson" query:<class>`), fallback `/workspace/proposals/compose-lessons.jsonl` (6184 lines).
- `prior_failed_attempts` resolver (`development-vessel/src/resolvers/prior-failed-attempts.ts`, reads `/workspace/proposals/.rejected/`) is registered in `config.ts:253` but **has no call site** in any `src/` (grep: only its own file and prior-successful-attempts' comment).

## 2. Ribosome extraction

Two paths:
1. **goal-host `mintReachedTrace`** — `goal-host-vessel/src/index.ts:6573-6660`; the path that actually mints (per its own comments). Called at `:11147`, `:11202`, `:13583`, all `if (opts.learningMode !== "observe")`. Qualifies when: `grounded` (`isGroundedHonestReach` / `mintGrounded` — deterministic/landed anchor, not bare-LLM yes) **and** extraction depth (`learned-` count) ≤ `extractionPolicy.maxExtractionDepth` (fallback 1, 5-min cache, `:6545-6571`) **and** not a trivial single-task non-composed reach (`:6624-6628`). Runs **immediately, in-process**, `host.runGoal("extract reusable template from execution <id>")` with `qualityEligible:true`.
2. **ribosome-vessel** `ribosome-vessel/src/index.ts` — WS `execution_completed` → gradability gate (`extractionEligibilityPolicy` producer list, `:178-187`, `:601-613`) → re-reads trace row with backoff `[2s,8s,20s,45s]` (~75 s, `:615-640`) reading the `reached` **column** (`reachVerdictFromTraceRow` `:453-466`) → `onExecutionCompleted` `:287-425`: requires `reached && failed===0 && completed===taskCount`, recursion/depth guards, dedup set; dispatches `ribosome-extract` via goal-host `/run-goal` (`:205-243`).

Also separate crystallization stores that act on reach without the ribosome: reached-command cache (evicted on false verdict `:15963`) and `recordGoalPath` → `goal_execution_paths` (`:11318`).

**Withhold/defer hook per execution_id: none.** Available levers are (a) per-dispatch `learning_mode:"observe"` in the `/run-goal` body (`index.ts:15385`) — decided **before** the outcome and also disables path recording; (b) producer-level `extractionEligibilityPolicy`; (c) global `extractionPolicy.maxExtractionDepth`. The ribosome's in-memory `dispatchedExecutions` set is private. Timing: goal-host mint is immediate at reach; ribosome path ≤~75 s after completion. Neither waits for any post-land settle window.

## 3. `pending_outcome_verification` (gap-to-feature)

- Stamped by: self-cutover defer `gap-to-feature.ts:2145` & `:2152-2172`; `markPendingVerification` `:2533-2553` (+`disposition:"pending_verification"` so picker skips); lineage stamp in the sweep `:2578-2596`; and `vessel-mitosis-cutover.ts:~2840+` after a pushed landing **unless `behavioralVerificationFailed`**. Live: 32 gaps carry it.
- Trigger: `sweepPendingLandVerifications()` `:2556-2690`, called at gap_to_feature tick start `:3427` (existing rhythm, no new timer). Limit 25/tick. Measured cadence: 71 `[gap-sweep] checked=` lines in dev-vessel journal over 3h (~every 2.5 min); latest `checked=12 closed=0 {"absent":0,"present":1,"pending":8,"unknown":3,…}` — i.e. 0 closes, 8 abstaining on predicate-less gaps. (gap_to_feature is invoked from `scripts/substrate/gap-compose-tick.ts` and `watchdog-tick.ts`; exact host of the observed cadence not pinned.)
- What it checks: `shaIsAncestorOfAnyClone`, `shaWasRevertedInAnyClone`, then `verifyGapConditionAsync(g)` `:1900+` — **only the gap's own predicate**: Class-1 `hardcoded_url` / Class-1b `expected_literal` at `edit_site`, Class-2 `evidence_resolve`/`verify_shape` (resolves a shape), Class-3 landed-commit provenance (single land ⇒ `pending`, re-land ⇒ `present`). **No check of anything outside the gap** (no health/baseline/neighbour regression).
- Outcomes: `absent` ⇒ close `closed_reason:"landed_verified"` + `recordCloseVerdict("measured")`, calibration/posterior updates; `present` ⇒ stay open, escalate re-land to human; `pending` ⇒ re-mark + human escalation; `unknown` ⇒ skip unless `landed_commit` class earned trust. Logs `[gap-sweep] checked=… {tally}` (`:2687`).
- `BEHAVIORAL VERIFICATION FAILED` writer: **only** `vessel-mitosis-cutover.ts:2716-2748`, runs `runBehavioralVerification(meta.verification_spec)` post-landing, prefixes the summary and writes `verification_outcome`. **Live: 0 gaps carry `verification_spec`** ⇒ this never runs.
- `regressed_by` readers `gap-to-feature.ts:1841` & `:1929`: effect is only `behavioralFail ⇒` skip Class-3 provenance (no close on commit presence). **No code writes `regressed_by`**; live 3 rows, all `source: human_reported`. The test is `!== undefined`, so `regressed_by:null` still arms it — **live instance:** `the-memory-store-has-no-retire-primitive-so-battery-residue-accumulates-forever` carries `regressed_by: null` and is armed, and metadata carry-forward (`substrate-gap.ts:970-972`) means it cannot be removed — irreversible once set.
- Adjacent regression signal: post-land suite `vessel-mitosis-cutover.ts:2770-2830` — runs `test_suite`, diffs failing names against `/workspace/post-land-baseline/<vessel>.json`, files `post-land-suite-red-<vessel>` naming the sha **only in summary prose** (no structured `caused_by`/sha field, no link to the driving gap/attempt).

## 4. Baseline-check candidate producers (all in development-vessel `src/resolvers/`, all present in live `discovery :8100/registry/shapes`)

| Shape → out shape | File | Per-check verdict | Unknown / timeout | Live probe (in-container) |
|---|---|---|---|---|
| `systemd_unit_health_observer` → `systemdUnitHealth` | `systemd-unit-health-observer.ts` (235) | yes, per unit `{unit,active_state,result,exec_main_status,is_oneshot}` + `failed_units`, `all_healthy`, `all_active` | per-unit `"unknown"` / `"probe_error"` (`:64-82`) | **200, 3.97 s**: `total:56, active_count:10, failed_count:0, failing_count:1, failed_units:[memory-budget-check exec_main_status 1], gaps_emitted:1, all_healthy:false`; concept-db `activating`. **Emits gaps by default** — pass `emit_gap:false` for a baseline read. |
| `push_health_observer` → `pushHealth` | `push-health-observer.ts` (358) | single `sustained_push_failure` + `cause` + `signals{…}` | **no** — unreadable jsonl ⇒ `[]` (`:66-82`) ⇒ reads healthy | **200, 0.67 s**: `{"sustained_push_failure":false,"summary":"push path healthy …","pat_git_auth":"valid","signals":{"recent_results":0,…,"stuck_intents":1,"recent_cutovers":25}}` — note `recent_results:0` still "healthy". Emits gap when sustained (`emitGap` default on, `:312`). |
| `substrate_health_tick` → `substrateHealthReport` | `substrate-health-tick.ts` (452) | `health_verdict{confidence_passing,stability_passing,optimality_passing,vessels_passing,overall_passing,unmeasured_dimensions}` | **yes**: `overall_passing:null` when not measurable, `unmeasured_dimensions[]` (`:380-393`) | **curl timed out at 90 s (http=000)**; the run finished anyway and wrote `/workspace/git/super-repo/substrate-heartbeat.json` at 01:24:27: `{"overall_passing":null,"template_count":0,"corpus_complete":false,"vessels_down":[]}` (activity-api unavailable). Too slow for a synchronous check; stale copy at `/workspace/substrate-heartbeat.json` dated 2026-07-23. |
| `authoring_chain_health_report` | `authoring-chain-health-report.ts` (291) | `health_verdict`, `verdict_reason`, `categories{…}` | fetch non-ok ⇒ `structuredError` (distinguishable) | **200 + `structuredError` "activity-api traces returned 401"**, retry: "traces fetch failed: The operation timed out." |
| `detector_coverage_scan` → `detectorCoverageReport` | `detector-coverage-scan.ts` (284) | cluster coverage | **no** — fetch failure swallowed (`:214-217`) ⇒ `traces_examined:0`, `information_yield:"idle"` | **200**: `traces_examined:0 … information_yield:"idle"` during the activity-api 401 window — **false zero**. Emits gaps by default. |
| `interaction_expectation_verify` → `interactionExpectationVerdict` | `interaction-expectation-verify.ts` (61, "v0 skeleton") | per-solicitation `verdict ∈ met_novel|met_saturated|unmet|unscored_absent` | `unscored_absent` when episode read fails | **200 `success:true` with body `{"error":"solicitation_ids required"}`** — needs ids; error dressed as success. Writes `verifier_negative`, `interaction_surface_gap`, `verdict_ledger` on the obsidian surface. |
| `vessel_mitosis_evaluate` → `vesselMitosisEvaluation` | `vessel-mitosis-evaluate.ts` (1675) | `verdict ∈ FAVORABLE|NEUTRAL|UNFAVORABLE|INSUFFICIENT_DATA`, `static_evaluation{ok,checks[],examination}` | **yes**: `timed_out` = inconclusive/defer (`:137-155`, `:247-254` saturation ⇒ timed_out); test delta vs **baseline suite in transient overlay**, `newFailures=null` (unknown) on truncation/parse disagreement (`:1195-1230`) | not probed (requires base/mitosis ids + mitosis_root; heavy). **Closest existing "baseline vs candidate" primitive, but pre-land.** |

**Clean positive controls:** systemd_unit_health_observer, push_health_observer (200, real data). **Contaminated by the activity-api 401/restart window, unattributed until re-run against a healthy activity-api:** authoring_chain_health_report, detector_coverage_scan (`traces_examined:0` is a false zero — fetch errors swallowed), substrate_health_tick.

Re-derive: `docker cp evidence/helpers/devvessel-resolve.sh substrate-live:/tmp/ && docker exec substrate-live bash /tmp/devvessel-resolve.sh <shape…>` where res.sh POSTs `{"impulse":{"pointer":{"type":"$s"}}}` to `127.0.0.1:8090/v2/impulses/resolve` with `ApiKey $METABOB_API_KEY` from `/etc/substrate/env`.

## 5. Rhythm impulses

- Registry = `poolImpulse` rows of shape **`timeShapedRhythm`** (body `{axis,family,budget,alpha,beta,staleness,paces}`), read by `development-vessel/src/resolvers/rhythm-conductor-tick.ts:262-300`. `due_score = alpha/(alpha+beta) * staleness / max(budget,0.05)`, staleness accrues `+ageHours/24` since `updated_at` (capped 1; `gap-closing` exempt). Affordable if `budget <= 1 - load/3` (+presence axis).
- Family→goal: bootstrap `FAMILY_GOALS` const `:125-157` overlaid by pool shape **`rhythmFamilyGoal`** `{family, goal, member}` (`:381-410`) — "new rhythm families mount by impulse-write, not code edit". Top-K due ⇒ `boredom_enqueue` then `drainBoredomQueue` dispatches to goal-host `/run-goal` async (`:41-90`). Fired ⇒ decay (`alpha+0.5`, staleness×0.3); failed dispatch ⇒ `beta+0.5`, staleness kept (`:220-240`).
- Who ticks it: boredom-vessel selection loop POSTs `rhythm_conductor_tick` each cycle (`boredom-vessel/src/index.ts:2525-2534`) and folds rhythm due-state into `priorityWeightByShape`; watchdog-exempt `rhythm-cadence.timer` runs `scripts/substrate/rhythm-conduct-tick.ts` (~15 min).
- **There is no per-item "due at T" primitive** — rhythms are family-grained with continuous staleness. The pattern for a delayed "settle after window" step is the one already used twice: (a) a **sweep piggybacked on an existing tick** reading durable state whose own timestamp encodes the window (`sweepPendingLandVerifications` at gap_to_feature tick; checks `pending_set_at`-style fields), or (b) **`change_series_tick`** (`change-series-tick.ts`, 369 lines): state in `poolImpulse` → `/workspace/pool/standing.json`, one step per boredom heartbeat, `lease_until` gating (`LEASE_MS = 20 min` const, `:64`, `:299-307`), reconcile-against-reality before acting. A settle step would be a pool row `{attempt_id, settle_after}` examined by a `rhythmFamilyGoal`-mounted or tick-hosted sweep.

## 6. gaps.json writes and field extensibility

- Vessel persistence writer: `saveGaps` `development-vessel/src/resolvers/substrate-gap.ts:338-351` (per-pid tmp + rename), called from `resolveSubstrateGapWrite` (`:1057`). Files that compute a gaps path (`gap-lifecycle-scan.ts:327`, `causal-adjudication.ts:438`, `self-interference-scan.ts:100`, `detector-yield-registry.ts:223`, `generative-frontier-gap-tick.ts:252`, `gap-to-scenario-bridge.ts:141`, `solicitation-outcome-scan.ts:48`, boredom `index.ts:2401`, `gap-store-census-tick.ts`) were checked for `writeFile|Bun.write|rename(|appendFile`: none writes gaps.json (gap-lifecycle-scan appends only a history file `:718-724`; gap-to-scenario-bridge writes scenario files `:279`).
- **Exception — a second, direct, merge-bypassing writer:** `scripts/substrate/typecheck-scenario-gen.ts:117` `writeFile(GAPS_PATH, JSON.stringify(gaps))` (whole-array rewrite, no carry-forward). Timer-driven (`typecheck-scenario-gen.timer` active). `GAPS_PATH` defaults to `/workspace/gaps/gaps.json` (`:27`) and is NOT set in `/etc/substrate/env`, while the live store is `/workspace/git/super-repo/gaps/gaps.json` — so today it writes a **stale split-brain copy** (`/workspace/gaps/gaps.json`, mtime Sep 16), not the live store. If the path were ever aligned it would clobber metadata fields (incl. any new `caused_by`) written in between its read and write.
- `classification_metadata` is `Record<string, unknown>` (`:212`), passed through unfiltered (`:671-676`) and **merged with carry-forward** (`:950-974`: keys absent from an incoming write are kept; a key can only be neutralised by writing an empty value). Top-level unknown keys also persist (live rows carry `falsifier`, `evidence`, `severity`, `closure_predicate`, `fix_priors`, … not in the interface).
- ⇒ `caused_by` / `regressed_by` / `attempt_id` fit in `classification_metadata` **with no schema change**. Live census (4656 gaps): `regressed_by` 3 (all human_reported), `caused_by` 0, `attempt_id` 0, `verification_spec` 0, `pending_outcome_verification` 32, `failure_lessons` 526.
  Re-derive: `docker exec substrate-live /root/.bun/bin/bun -e '…count keys of /workspace/git/super-repo/gaps/gaps.json…'`.
- Caveat: a reader must exist for any new field (hollow_write law); `regressed_by` already has two readers (`gap-to-feature.ts:1841,1929`) but only toggles provenance-close off.
