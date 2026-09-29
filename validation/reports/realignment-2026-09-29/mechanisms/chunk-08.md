# Mechanism chunk 08: the gap-lane admission, selection and closure machinery (area "other")

Scope: the 28 items in `classes/_mech_chunks/08.json`. 23 of them live in, or feed,
`development-vessel/src/resolvers/gap-to-feature.ts`, which has 5404 lines in the live
clone (`/workspace/git/vessels/development-vessel` HEAD `f451e42`, 2026-09-29 01:37Z).
The other 5 are bootstrap scripts, timers or detectors.

All evidence below was measured live on 2026-09-29 between 04:50Z and 05:10Z, unless a
line cites a record. Sources:
- `substrate-live` journal (`development-vessel`, `goal-host-vessel`, and the timer units) over the last 48h or 30d
- the live gap store `/workspace/git/super-repo/gaps/gaps.json` (10.6MB, 05:07Z)
- `/workspace/*.json` calibration files on node 1 (`substrate-live`) and node 2 (`compose2-live`)
- SurrealDB `learning_loop`, read-only
- the discovery registry `:8100/registry/shapes`

## Gap-store baseline

These numbers are the context for every verdict below.

| measure | value |
|---|---|
| gaps total / open | 6288 / 1825 |
| open `*-narrowed` | 458 |
| open `recommit-*` | 415 |
| open `*-step-N` | 24 |
| auto-minted children as a share of open | 873 / 1825 = 48% |
| open with `pending_outcome_verification` | 157 |
| open `human_reported` | 256 |
| closed `landed_verified` | 38 (the latest is `resolve-url-walk-path-sites-7457-15128`, 09-28 15:25Z) |
| gap-sweep, every run 09-28 22:42 → 09-29 01:43 | `checked=25 closed=0 … "pending":23` |

## Dedupe

Nine families remain after merging names that describe the same code.

| # | family | items merged (chunk index → name) | canonical code site (live) |
|---|---|---|---|
| F1 | **Category seal `hopeless()`** | 3, 9, 12, 14, 15 (all "hopeless()…") | `gap-to-feature.ts:1184` (in `pickMostLandable`), reads `CALIB_PATH` at `:3249`; the escalation branch is at `:1213` |
| F2 | **Node-local calibration files** | 8, plus the file half of 3 | `:3249` `EXPECTATION_CALIB_PATH`, `:3287` `GAP_CLASS_POSTERIOR_PATH`, `:3381` `CLOSE_ORACLE_CALIB_PATH` |
| F3 | **Child-gap minting (narrowed / recommit / step)** | 4, 7 | gap-to-feature narrowing, plus `feature-compose.ts` recommit and `appendComposeLesson` |
| F4 | **Premise / anchor-existence check** | 0, 10, 11 | the drafter warning at `:969-972` (items 10 and 11 are the same two lines: `console.warn` PREMISE UNVERIFIED and the prompt text PREMISE WARNING); admission (E3) `phantom_anchor` at `:1907-1923` (item 0) |
| F5 | **Land → verify → close pipeline** | 5, 13, 2 | `closeLandedGap` at `:2485`, `markPendingVerification` at `:2954`, `landedCommitVerdict` at `:2211/2306`, revert matching at `:2780-2802` |
| F6 | **Pick-rate brakes** | 6 (plus the per-gap backoff it now feeds) | `:57` `GAP_COMPOSE_COOLDOWN_MS` (env); `:62` site cooldown; `:95` `GAP_BACKOFF_BASE_MS` |
| F7 | **gen-env bootstrap** | 18, 23 | `scripts/substrate/gen-env.sh:368` (provenance), merge-then-write, and `ENABLED_EXTRA_VESSELS` |
| F8 | **Autonomy observability scripts** | 20, 21 | host scripts (item 20) versus the in-container `autonomy-metrics.timer` (item 21) |
| — | singletons | 1, 16, 17, 19, 22, 24, 25, 26, 27 | see the verdict table |

## Verdicts

| # | mechanism | verdict | used now | live evidence (2026-09-29 unless dated) | availability / archive |
|---|---|---|---|---|---|
| 9 | **`hopeless()` category seal** (canonical F1) | **broken**; merge into the per-gap backoff (F6) keyed on lineage | yes | (1) Every pick line over 48h logs `hopeless_excluded` in the range 55–64; the modes are 63 (135 picks) and 64 (79 picks). (2) Category grain: on node 2, `expectation-calibration.json` seals `systematic_failure` at 8/0, while node 1 has the same category at 1211 attempts and 61 lands. The same gap is sealed on one node and admissible on the other. (3) The live code's own comment at `:66-80` says `hopeless()` "cannot" act per gap, because `lands!==0` makes categories that have ever landed unsealable. (4) The class `calibration-seal` records recurrences on 08-31, 09-05, 09-23, 09-24 and 09-28. | Replace with `GAP_BACKOFF_*` (`:95`). The backoff must be keyed on lineage root or `edit_site`, not gap id, because the code at `:148` notes that children route around a per-id backoff. The seal's one useful output, a human question, stays under F5 escalation. |
| 3 | hopeless()/predictLand/expectation-calibration.json | duplicate-of 9 (predictLand part: keep-specific) | yes | `predictLand` at `:3420` is called at `:3691` and `:4567`. The picks log `landability` 0.5–0.9. It is trained from the same `expectation-calibration.json`, so it inherits the F2 locality defect. | predictLand stays as the ranking prior once its input moves to a shape (F2). |
| 12 | hopeless() calibration seal | duplicate-of 9 | yes | Same code at `:1184`. "Laundered by echo children" is the F3 interaction: children carry fresh ids and the same category. | — |
| 14 | hopeless() seal + bounded human exemption | duplicate-of 9 | yes | Exemption `human_exemption_attempts_remaining` at `:1195`. `hasLiveHumanExemption` at `:1345` feeds F-human priority. | — |
| 15 | Category seal + escalation escape valve | duplicate-of 9 (escalation half: see F5) | yes | 48h log: `[gap-escalation] pending-verify uiQuestion_write accepted` repeats **44–48 times for the same gap** (e.g. `model-opportunity-gap_landability` ×48). The escape valve re-asks the human instead of asking once. The solicitation dedup `/var/tmp/solicited_gaps.log` (`:1219`) covers only the hopeless branch. | — |
| 8 | per-node calibration stores | **broken** (law 1 / law 11 / p2p principle) | yes | `close-oracle-calibration.json` has `landed_commit.false_closes` = **2149** on node 1 and **31** on node 2, and `measured.closes` = 237 on node 1 and 9 on node 2. All three paths are env-default constants to `/workspace/*.json`. The walk, the traces and the peers cannot see them. Discovery advertises `thompson_posterior` and `posterior_consistency_audit`, but no calibration shape. | Needs a shaped, federated store: a `gapClassCalibration` impulse served where the gap store lives, and resolved over discovery by both nodes. Until then, the gate value depends on which node picks. |
| 4 | Narrowing/recommit/step minter (canonical F3) | **broken** as an id-minter. `appendComposeLesson` is **keep-general**. | yes | 873 of 1825 open gaps (48%) are auto-minted children. The id shape `recommit-recommit-route-edit-7f4dea92-semantic_reject-semantic_reject` appears live in the escalation log. Record memory-4 (09-12) put this share at 57%. Memory 09-22 records that `-narrowed` is a verbatim duplicate. Class `narrowing-duplicates`: dedup attempts on 06-14, 06-30, 07-21, 07-27 and 07-29, each partial or failed. This is the chunk's clearest case of the same issue recurring for the same reason. | Fold into the parent: record each retry as an attempt on the parent's causal attempt ledger (accepted 09-26 per MEMORY) and attach the lesson via `appendComposeLesson` to the parent. Stop minting new ids. The existing children need a one-shot fold back into the parent, which is substrate work to file as a gap, not a hand-edit. |
| 7 | Narrowing / recommit child gaps | duplicate-of 4 | yes | Same code (`gap-to-feature.ts:1988`, `feature-compose.ts:2340` at record time). | — |
| 10 | premise check PREMISE UNVERIFIED (canonical F4-drafter) | **keep-general** | yes | Fired 10× in 48h, e.g. 09-28 12:00:08 and 12:01:15 for `/v2/activities/execution-traces/<id>` absent from `ias-executor-ts/src/adapters/activity-api-trace-sink.ts`. This contradicts the "0 production firings" in record transcripts-3 (checked 09-13). | Internal to the `gap_to_feature` prompt build. To become discoverable, emit the finding as a `gapPremiseFalse` observation or a gap annotation instead of a log line only, so F4-admission and the lifecycle scan can read it. |
| 11 | premise check PREMISE WARNING | duplicate-of 10 | yes | Same lines, `:971` (log) and `:972` (prompt text). "0 fires" was a log-grep artifact: the WARNING text goes into the drafter prompt and is never logged. | — |
| 0 | false-premise admission exclusion (E3 phantom anchor) | **keep-general**, with a change: exclude → retire/close | yes (fail-open) | Code at `:1907-1923`, with `excluded.push({reason:"phantom_anchor(…)"})` gated on `failedAttempts>=2`. There is no per-exclusion log line, so the firing count is unknown. The record says it "excludes but does not close; families respawn". It is consistent with F3: an excluded parent's `-narrowed` child re-enters. | Close with a reason (`premise_false`) through the gap store, so the verdict is durable and visible to `gap_lifecycle_scan`. It shares its predicate with item 10, so the two should become one function. |
| 13 | land→close sweep `closeLandedGap` (canonical F5) | **keep-general** | yes | `:2485`. 38 gaps are closed `landed_verified` (first on 09-28 per memory-8). The `[mitosis-cutover] pending-land stamp … (sweep will close as landed_verified)` lines appear 09-28 11:58 and 12:13. | This is the lane's only self-measured close. It should be exposed as a shape (`gapClosureVerdict`) so the causal ledger and reports read it, rather than re-deriving from `gaps.json`. |
| 5 | markPendingVerification / landedCommitVerdict | **keep-general**, but the pending side does not drain | yes | Every sweep 09-28 22:42 → 09-29 01:43 has `pending:23 closed=0`. 157 open gaps carry `pending_outcome_verification`. The two call sites (`:2513` "no measurement predicate", `:2522` "landed-commit class has not earned fail-open trust") park landings that no predicate will ever measure. MEMORY 09-22/09-26: clearing the flag does not stick, because the sweep re-derives it. Class `hollow-landing` / `false-verification`. | The needed partner is a predicate supplier: `pending` without a falsifier should dispatch an outcome-measurement goal instead of waiting. Keep the verdict function and fix the sink. |
| 2 | Revert detector | **keep-general** (the record's "live-unused" is stale) | yes | Fired live 09-28 22:45:29: `gap failing-test-concept-db-tests-concept-test-ts NOT closed: landed sha e059a98d7b16 was REVERTED`, and the sweep counter `reverted:1`. `:2796-2802` accepts both `This reverts commit <full>` and prose `reverts <7+hex>` (271228e, 2026-08-07). | Part of `landedCommitVerdict`; nothing extra needed. The operator revert convention should be documented in the concept graph as "use `git revert`". |
| 6 | compose-horizon cooldown map (F6) | **keep-specific**, but env-gated (law 1) | yes | `:57` `parseInt(process.env.GAP_COMPOSE_COOLDOWN_MS ?? "300000")`, which also sets `GAP_BACKOFF_BASE_MS` (`:95`) and `SITE_COMPOSE_COOLDOWN_MS` = 3× (`:62`). The word "cooldown" appears 216 times in the 48h log. The per-gap exponential backoff (`:66-100`, added after the 08-31 measurement of 58 retries on one gap) is the general successor. | Move the base period into a pace/rhythm shape read at use time (law 5). This is the merge target for F1. |
| 1 | human-priority weight | **keep-specific** | yes | `:1324` `HUMAN_REPORT_PRIORITY = 1.5`. `:1350` applies it to `source==="human_reported"` or a live human exemption, and route-edit gets 0.5. `:1828` exempts human gaps from the site cap. There are 256 open human gaps. Operator-filed gaps must carry `human_reported` (MEMORY 09-18), otherwise they get no priority. | Ranking constant inside `gap_to_feature`. It should become a selection-weight shape the boredom/value-per-cost selector reads (law 5). |
| 17 | `autonomous_pick` maintenanceLease | **keep-general** | yes | `:3661` and `:4329`. The 48h log has 526× `autonomous_pick lease held by operator:claude-avi:value-per-cost-s…`, so the lease is actively holding picks. The shapes `maintenanceLease` / `maintenanceLease_write` are advertised in discovery. The causal ledger ran 10/10 on 09-26. | Already discoverable through the registry. It is the general "hold the lane" primitive, and other window-blind dispatchers should take it too (MEMORY 09-26: four dispatchers had to be held by hand). |
| 16 | stale_open gap hygiene threshold | **broken** (per the record; not re-measured here) | yes (seeded) | `development-vessel/src/seed/gap-lifecycle-tick.ts:26` seeds `staleHours: 48`, with the default at `gap-lifecycle-scan.ts:332`. The record memory-10 says it is structurally 0, because fleet touches come every 36–48h and reset "untouched". | Keep the scan and fix the predicate (age since the last attempt, not since the last touch). Lives in the `gap_lifecycle_scan` activity. |
| 19 | Gap investigation grounding + citation oracle | **keep-general** (weak oracle) | yes | goal-host 48h: 139 "citation" lines, e.g. 46× `citation-unverified — the answer cites [repos/concept-db/src/models/schemas.ts…]` and 33× `citation_unverified mirrored to concept-db (http 200)`. Code is at `goal-host-vessel/src/goal-target-inference.ts:397-406` (shared symbol extraction). Weakness per memory-4 (08-28): it accepts coincidental citations. | Already mirrored to concept-db, so it is readable at prompt-build. This is the general "is the answer grounded" check for the ReAct floor and should stay at the goal-host seam. |
| 18 | substrate-config / env.provenance | **keep-specific** (bootstrap tier) | yes | `/etc/substrate/env.provenance` was written 09-26 07:43. `gen-env.sh:368-374` and `:1771-1801` emit it. | This is the bootstrap exception under the CLAUDE.md script-retention rule. The config-surface probe can read it. |
| 23 | gen-env merge-then-write + `ENABLED_EXTRA_VESSELS` | **keep-specific** (bootstrap tier) | yes | `deploy-hub.sh:54` sets the default `ENABLED_EXTRA_VESSELS`, and the restart rehearsal passed (memory-9). Commits 9f8f945e and d9f93442. | Same family as 18, in the same file. |
| 21 | autonomy-metrics collector / autonomy-status / criterion-coverage views | **keep-specific** (collector); **fossil** (`autonomy-status` / criterion views) | yes (collector) | This is **not a host fossil**. `autonomy-metrics.timer` is active in-container (20m) and wrote `/workspace/metrics/autonomy-metrics.jsonl` at 04:34Z and 04:54Z. `scripts/substrate/self-operational-health.ts:70,78,273` reads it, and `ias-executor-ts/src/shape-lifecycle.ts:20,51` mirrors its terminal regex. `autonomy-status.ts` has no unit or reader beyond the operator. | The collector should become an activity that emits a shaped `autonomyMetrics` impulse (the JSONL is invisible to the walk). Archive `autonomy-status.ts` and the criterion views in git history. |
| 20 | host autonomous-regression detector (`.pullsync-testbaseline`) | **fossil** | no | No file matching regress/pullsync exists in `scripts/substrate` (host or container clone). There is no unit or timer and no crontab entry. The record says 132 failed runs, ungraded. | Archived in git history at 676cb859 and cffc9489. The class `autonomous-regression` is now served in-container by the post-land suite (MEMORY 09-28, fix 5e9a0b2). |
| 22 | Surgical gap scan | **fossil** (exhausted pattern) | runs, emits nothing | `surgical-gap-scan.timer` still fires hourly (latest 04:30Z). Over 30d there were **92 runs, all `emitted_count: 0`**. The historical 16/16 autonomous landings (06-29) exhausted the hardcoded-endpoint pattern. | Disable the timer and archive `scripts/substrate/surgical-gap-scan.ts` in git history. Keep its pattern as a concept-db lesson (single localized edit = landable). Nothing validates the script (script-retention rule). |
| 24 | joint-liveness detector | **keep-general** (the record's "broken" is stale, fixed 09-28) | yes | Since 09-28 07:25Z it checks `bindings=6 (seed 1 + registered 5)`; there were 43 such runs. Earlier there were 155 runs checking 1 of 1. The 04:58Z run filed `severed-joint-behavioral-verification-input` and `severed-joint-ribosome-extraction` (`severed=3`). | Discoverable through the `jointBinding` registry. The class `write-read-mismatch` should register its bindings there. It is still a script tick (`scripts/substrate/joint-liveness-tick.ts`) rather than an activity. |
| 25 | semantic gate (`addresses:true`) | **broken** (fail-open) | yes | `patch-with-tools.ts:1493` and `:1529`: "FAILS OPEN BY CONSTRUCTION. The judge itself returns addresses:true when unreachable". It is consumed at `gap-to-feature.ts:3751` and `gap-drain-observer.ts:336`. Class `narrowing-duplicates`: all 47 parked landings are `judge.addresses=true`, yet 41 of their gaps are still open. It approved wrong-region obsidian edits (08-07) and inert 314f228. | Fail-closed with an `unjudged` state, and write the judge verdict as a shaped impulse so F5 can see which closes rested on an unreachable judge. |
| 26 | tool-usage / tool-argument pattern learning | **broken** (writer never executes) | no | SurrealDB: `tool_usage_patterns` 0, `tool_argument_pattern` 0, `tool_usage` 0 rows. The writers exist at `activity-api/src/routes/activities.ts:9954/10019` (UPDATE/CREATE `tool_usage_patterns`) and `:10647/10705` (`tool_argument_pattern`). `impulse-formatters.ts:343` tells readers to "check tool_argument_pattern" (a reader of an empty table). | This would be needed for ReAct-floor tool reuse, but the upstream call path does not reach the writer. File as write→read severed and register a `jointBinding`, so the item 24 detector watches it. |
| 27 | counterIntegrity | **keep-specific** | yes | `development-vessel/src/resolvers/learning-transfer-report.ts`, invoked by the seed `learning-transfer-gap-tick.ts` (resolver `development-vessel:learning_transfer_report`, output `learningTransferReport`). 1084 learning-transfer journal lines in 7d. The slot-binding over-count (48,613×) is confirmed by the ribosome log: `skip … ungradable producer (producer=slot-binding …)`. The class `false-verification` warns that the λ1 inequality in the same report is a proxy. | Already a shaped report (`learningTransferReport`). Keep the counter check and do not credit the λ1 field. |

## What this chunk says about the realignment

1. **The recurring failure in this area is identity, not logic.** F1 (category seal),
   F3 (child minting) and the per-id half of F6 each key their state on something
   that a retry changes: the category name, a fresh child id, or the gap id. The
   records show dedup, penalty persistence and seal fixes each landing and then being
   routed around. Recurrences are dated 06-14, 06-30, 07-21, 07-27, 07-29, 08-31, 09-05,
   09-12, 09-23, 09-24 and 09-28. The general mechanism to keep is **one attempt ledger
   per lineage root**, which the causal attempt ledger accepted on 09-26 already
   provides. Retry lessons, backoff, escalation and the seal should all read from it.
2. **The closure side works and should be exposed, not rebuilt.** F5
   (`closeLandedGap` + revert detector + verdict) produced 38 `landed_verified` closes
   and a live revert refusal on 09-28. Its gap is the 157 pending gaps with no
   predicate. The fix is a predicate supplier, not a new verifier.
3. **Node-local JSON files break decentralization.** F2's calibration files disagree
   between the nodes by two orders of magnitude, and they gate admission. This
   instance matches the stated principle "absence in one place is not absence", so it
   should be a shape resolved over discovery.
4. **Three record statuses were stale.** The revert detector, joint-liveness and
   PREMISE UNVERIFIED are live, not unused or broken. `autonomy-metrics` is an
   in-container timer, not a host fossil. Records older than about a week in this area
   should be re-measured before anyone acts on them.
5. **Discoverability.** Most kept items are private functions inside one 5404-line
   resolver (`gap_to_feature`), so Thompson cannot select or grade them (law 2). The
   minimum is to emit each gate's decision as a shaped observation (exclusion reason,
   premise-false, judge unjudged, pending-without-predicate), so that detectors and the
   walk can read them. Splitting them into activities is the evidence-earned step
   after that.
