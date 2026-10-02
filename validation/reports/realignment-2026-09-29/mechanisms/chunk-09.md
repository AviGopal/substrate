# Mechanisms, chunk 09 (area "other"): verdicts from live evidence

Source list: `classes/_mech_chunks/09.json`, 65 items. Evidence was measured read-only on 2026-09-29 (UTC 03:30 to 05:10) against `substrate-live`:
- live clones under `/workspace/git/vessels/*`. HEADs: activity-api 39783b0, development-vessel f451e42, goal-host bc99f91, discovery ffd1d58.
- the `execution` table, which holds a 5-day window (09-24 to 09-29 at the 150k cap).
- the goal-host journal for the last 3 days.
- systemd units.
- raw shards `live-activities.md`, `live-resolvers.md`, `timers-readers.md` and `git-devvessel-2.md`.

Where live evidence contradicts the collector's status, the override is marked **OVERRIDE**.

**Archive convention for every fossil in this chunk:** delete the code from HEAD with a commit whose message names the last live SHA. Then add one row per fossil to `docs/archive/mechanisms.md` (name, last SHA, why retired, and the class it served). That page is the discoverable index, and git history holds the code. Pool rows (activities) are retired with the retire primitive (19ae84e), not deleted.

## 0. Dedupe (65 items -> 55 distinct mechanisms)

| merged items | one mechanism |
|---|---|
| "vessel_mitosis_cutover + mitosis-tick" and "mitosis cutover landing seam" | the mitosis landing seam |
| "vacuous-edit guard" and "vacuous-edit / hollow gates" | vacuous-edit guard (`src/vacuous-edit.ts`, 564 lines) plus its per-form siblings in feature-compose |
| "predicateLiteralNotUnique arming guard" and "Class-1 expected_literal predicate plus uniqueness guard" | Class-1 arming guard |
| "landedShaForGoalHash vs landedCommitForGoal" | one landed-edit probe, currently two functions |
| "Edit-intent routing (EARLY + late)" | one router, currently two sites (goal-host `index.ts:12683` and `13304/13365`) |
| "POST /header_added" | registered twice (`activities.ts:27` on `activitiesApp`, `:193` on `app`) |
| "Duplicate /conservation-audit-emit" | registered twice (`activities.ts:5971` and `:6034`) |
| "POST /composition writer" and "Composition edge derived at ingest" | the second superseded the first (516fc73) |
| "apply_proposal_as_patch", "patch_with_tools" and "feature_compose drafter" | three landing entry points onto one gate (44bcffd unified the gate) |
| "prior-failed/successful-attempts" | a third failure-memory store, beside the attempt ledger and goal-host's goal_hash failure memory |

Checked and **not** a duplicate: the rhythm conductor. The `rhythm-cadence.service` ExecStart runs `scripts/substrate/rhythm-conduct-tick.ts`. That script POSTs straight to dev-vessel `rhythm_conductor_tick` at `:8090/v2/impulses/resolve`, so there is one conductor. It is invoked **untraced**: `execution` has 0 rows whose id contains "rhythm".

## 1. Verdict table

### Keep: general capabilities at shared seams

| mechanism | where | live evidence | how it stays discoverable |
|---|---|---|---|
| feature_compose drafter | dev `src/resolvers/feature-compose.ts` | 1,949 runs / 382 ok (20%) in 5 d; 161 of 201 commits to the file were autonomous | registered shape `feature_compose`; goal-host edit-intent router |
| mitosis landing seam (evaluate / cutover / tick) | dev `vessel-mitosis-*.ts`, `seed/mitosis-tick.ts` | `vessel_mitosis_cutover` 588 / 390 ok (last 09-29T02:01); `mitosis-tick` 7,842 / 6,951; the only path by which substrate commits land | registered shapes; mitosis-tick seed activity |
| vacuous-edit guard (merged) | dev `src/vacuous-edit.ts`, imported by feature-compose, patch-with-tools, fs-write and goal-host `goal-file-resolution.ts` | live in every landing. Autonomously edited 6 times; ed313f2 (09-25) **loosened** it for log-level demotions. The per-form gates in feature-compose (at least 9, 06fabe9 inert on arrival) should fold into this one module | imported library. Should be exposed as a verdict shape so a gate change is graded, not silently relaxed |
| landedCommitVerdict (close oracle with earned trust) | dev `resolvers/gap-to-feature.ts` | replaced 3 Class-3 blocks (c871a45, 980135a) | lives inside `gap_to_feature`, which is **routed but not registered** in discovery (live-resolvers §2), so it is reachable only by direct POST. Register `gap_to_feature` |
| close_basis | `gap-to-feature.ts`, `self-fact-reconcile.ts` | written on close records since 09-09 | a field on `substrateGap`; same registration gap as above |
| maintenanceLease (named leases) | dev `resolvers/maintenance-lease.ts`, imported by gap-to-feature, cutover, http-retry and trace-store-reconcile | live (09-24 named-lease series, `autonomous_pick` lease). Self-deadlocked once (3f4be28, 08-01) | library; add a lease-state shape |
| quiesce / drain admission | dev `src/long-running.ts` | live: 790 + 62 "development-vessel is draining" refusals in 5 d; 404a89c and bf74cc5 showed the drain counters ignore gap_to_feature | library; its refusals are traced failures |
| gate-self-probe | dev `seed/gate-self-probe-tick.ts`, `resolvers/gate-self-probe.ts` | `development-vessel:gate-self-probe-tick` 37 / 37, last 09-29T03:39 | seed activity |
| self-fact-reconcile | dev `resolvers/self-fact-reconcile.ts` plus tick | 574 / 561, last 09-29T04:51. 3 of 5 of its own authoring-root landings were reverted the same day (b585a03, 04b3e9c, a198907) | seed activity |
| goal-file-resolution / searchWorkspaceForTerm | goal-host `src/goal-file-resolution.ts`, imported by `goal-intent`, `quantitative-goal`, `bookkeeping-only` and `index.ts` | runs on every edit-intent goal; journal shows 357 "EARLY EDIT-INTENT DETECTED" in 3 d | goal-host internal. Should be a shape (`editSite`) so misfires are graded |
| Edit-intent router (EARLY + late) | goal-host `index.ts:12683`, `13304`, `13365` | 357 detected, 272 routed by ownership, 108 routed to feature_compose, 898 `edit-intent-no-landed-edit` verdicts in 3 d. Gate `ROUTE_EDIT_INTENT_TO_COMPOSE !== "0"` is default-on (law 1: env-gated) | **merge-into** the EARLY site. The late site is the fall-through that needed 5 BUSY/503 fixes |
| verifyGoalReached plus the deterministic verdict chain | goal-host `index.ts:3489` | 7 d: edit-intent-no-landed-edit 1,111, code-investigation 927, transform ~521 | the honest `reached` field |
| universalToolFallback / runGroundedToolLoop (ReAct floor) | goal-host `index.ts:4934-5436` | 6,311 journal lines in 3 d; 318 ok / 1,918 (17%) in 5 d, with 1,532 failures carrying no reason | walk tier `universal_tool_fallback` in `goal_execution_paths` |
| recomputeIndependently | goal-host `index.ts:4649` | 512 `[recompute]` lines in 3 d: 83 abstain, 148 derivations with no measurement, 114 authoring failures, 35 refusals. Live but low yield (1 donation in 7 d per the collector) | goal-host internal; it is the minting source for verifier recipes (below) |
| POST /reach single writer plus applyOutcomeToPosteriors | activity-api `routes/execution-traces.ts:5176`, `lib/posterior-update.ts` | sole α/β writer by contract. vpm alpha/beta vs counters still disagree (live-activities §1: 9,193/8,479 alpha/beta with 0 ok), so a second writer exists | route plus library |
| reach-classify (credit / penalize / abstain) | activity-api `lib/reach-classify.ts`, imported by posterior-update, ribosome, grouped-stats, execution-traces, goal-host and dev `reach-rate-scan` | live. The rule changed 4 times 09-16..18. It does **not** yet abstain on addressing failures: the invalid-URL bug poisoned `auto-bridge-*` betas (live-activities §1) | library. This is the seam where failure-reason attribution belongs |
| decision_outcome capture plus /decision-calibration | activity-api `lib/decision-credit.ts`, `execution-traces.ts:4696` | 938 rows in the last 2 d (57,904 total). The write-read-mismatch class lists it as write-heavy with a thin reader | GET route; needs a traced reader activity |
| Composition edge derived at ingest | activity-api `routes/execution-traces.ts:1795-2012` | the sole edge writer; `activity_composition_graph` grew 13,125 to 14,953 while the `composition-edge-reconcile` timer upserted 0 in 204 of 206 runs | ingest path |
| goal_execution_paths reuse (work_signature) | activity-api `routes/goal-paths.ts:617,646` | 22,237 rows; learned_pathway 527/901 in 7 d vs fresh_derivation 83/6,231 | the ceiling tier |
| Trace retention valve | activity-api `services/trace-retention.ts` | live, but **gated by env**: `TRACE_RETENTION_ENABLED`, `_DRY_RUN`, `_GLOBAL_CEILING_ENABLED`, and the exemption list `TRACE_RETENTION_ACTIVITIES` all come from `/etc/substrate/env` (law 1). Window is 5 d; 46% of it is validator-dispatch plus auth telemetry | needs a `traceRetentionPolicy` shape read at use time |
| Evidence-aliasing and shape-dispatch lint | activity-api `scripts/check-*.ts` | wired into `package.json` `lint`; super-repo `scripts/check-shape-dispatch-all.sh`; referenced by dev `vessel-mitosis-evaluate.ts` and `gap-to-feature.ts` (the landing gate) | landing-gate step |
| Compose nudge capacity check | dev `substrate-gap.ts:1234-1323` | fail-closed capacity check. BUSY writes fell from 270/h to 1/h (799bd58) | internal to `substrateGap_write` |
| Mock-module completeness test | activity-api `src/mock-module-completeness.test.ts` | present and runs in `bun test`. The **"write-key-has-reader detector" half has 0 source hits** (unverified; treat as absent) | test suite |
| state signature | dev `resolvers/compute-state-signature.ts`; consumers activity-api `lib/selection/choice.ts`, `goal-paths.ts`, `discover-by-shapes.ts`, `state-pattern-learner.ts`, boredom `index.ts`, dev `rhythm-conductor-tick.ts` | 6 consumers across 3 vessels (collector said "unknown", **OVERRIDE**). Only 1 `satisfier:compute_state_signature` trace in 5 d, because most computation is inline. Revised 5 times. It also pins stateful-ui at `:8270` (`compute-state-signature.ts:46`) | registered shape. Unpin the `:8270` default |

### Keep: specific but live and needed

| mechanism | evidence | note |
|---|---|---|
| rhythm conductor | `rhythm-conductor-tick.ts:125` `FAMILY_GOALS` has 9 families. The rhythm-cadence journal for 1 d shows **84 ticks with `enqueued=0` and 9 with `enqueued=1`** | The law-5 seam exists but is nearly inert, and its calls are untraced because the bootstrap script POSTs straight to the resolver. Make the tick a traced activity. The same finding sits in the dormant-mechanism class (09-10: "10 of 11 rhythms have no staleness driver") |
| db_under_pressure probe | `scripts/substrate/self-recovery-tick.sh:310,352` | bootstrap-tier watchdog (exempt under script retention). Third form 337c3b81 |
| bootstrap-seeder | `scripts/bootstrap-seeder.ts`, `bootstrap-seeder.service` | **OVERRIDE of "broken":** the last run on 09-26 07:44 logged "Seeding complete: 19/19 templates present". `bootstrap-seeder.ts` has 0 `learning_track` hits, so the fallback lives in activity-api. Bootstrap tier |
| canary fixture walk | dev `src/fixtures/attempt-ledger-canary.json`, read by `attempt-checks.ts` and `attempt-register.ts` | Needed for causal-ledger acceptance, but it pushed 71 commits (9% of "autonomous") to origin/dev 08-31..09-26. Fix: fixture walks must not push, or must carry a distinct trailer |
| gap-to-scenario-bridge (+tick) | dev `resolvers/gap-to-scenario-bridge.ts`, `seed/gap-to-scenario-bridge-tick.ts` | **OVERRIDE of "fossil":** 69 new scenario files in 24 h under `/workspace/git/super-repo/validation/failure-modes/scenarios` (3,373 files), and `pick-priority-scenario.ts` reads them. The defect is volume: 18,203 tick runs (99.9% "ok") in 5 d, 12% of the capped trace store, for about 69 real writes a day. A root split sits beside it: templates' `fs_read` reads the frozen `/workspace/validation/...` tree (4,573 files, 0 new), which produces 152 "path outside workspace root" failures in 5 d. Decimate the cadence (fire on a gap write, not a timer) |
| Hand-written verify*Reach oracles | goal-host `index.ts:1663-3432`, **16 functions** (collector counted 22) | Live but mostly idle. Keep until migrated into ClassRow rows (below), then retire each one individually |
| substrate-doctor registry floor | `scripts/substrate/substrate-doctor.sh`, called by `substrate-status.sh` and `reseed-restart.sh` (operator/bootstrap) | Operator instrument, not scheduled. Bootstrap tier. Cadence unconfirmed; 4b first-boot false positives (09-16) |
| Static regex goal classifier KEYWORD_TO_TAGS | activity-api `utils/semantic-tags.ts`, used by scoring, composition, templates-db, template-audit, impulses and session-context | Live in recommend. Emits a `security` tag that 0/39 templates carry (inv-054). **merge-into** the learned shape descriptions (discovery auto-describe, 312 of 405 described) over time; a static keyword table is unlearnable (laws 1 and 13) |
| successor features ψ | activity-api `lib/successor-features.ts`, `jobs/successor-features-backfill.ts`, consumed in `discover-by-shapes.ts:43-76`; default on (`SUCCESSOR_FEATURES !== '0'`) | `successor_features` has 2,681 rows and has a consumer (collector said "no consumer evidence", **OVERRIDE**). Its effect on selection is unmeasured, so treat the value as unknown |

### Revive: general, dormant, needed by a recurring class

| mechanism | evidence | recurring class | how to make available |
|---|---|---|---|
| Verifier recipes as graded data | goal-host `src/verifier-recipe.ts`, imported at `index.ts:389`. `/workspace/state/verifier-recipes.jsonl` holds 39 lines, last write **08-27**. Journal (3 d): 32 x "loaded 4 family recipe(s)", 0 used | false-verification, write-read-mismatch, composition-crystallization (08-27: "0/4 proven recipes used") | Move the store from a node-local file into a shape (`verifierRecipe`) so the other node can reach it over p2p. Grade on use. `recipeSeed` (goal-host `:5127`, 0 hits in 7 d) is its consumer and is **merged into** it |
| ClassRow route-as-data harness | goal-host `index.ts:2543-2860`, `two-source-parse.ts` | codebase-bloat-fossils: 2 families migrated, 16 legacy remain | This is the target that the verify*Reach family and the ephemeris oracle merge into. Rows should become data (shape) rather than a TS literal |
| declarationDrift detector (schema-assert-drift-scan) | dev `resolvers/schema-assert-drift-scan.ts`, registered via `config.ts` / `impulses.ts`, read by `operational-state.ts`. Prod-confirmed 09-05 (254 findings filtered to 2). **0 schema-drift executions in the 5-day window** | trace-store-db and autonomous-regression: the .surql gate wedge (54b7762), the fresh-store poisoners 023/045/055, 9 empty twin tables | Give it a rhythm family or a post-migration trigger. It exists but nothing fires it |
| Gap-store forwarder GAP_STORE_ENDPOINT | dev `substrate-gap.ts:69-76`, also `gap-lifecycle-scan.ts` and `gap-to-feature.ts` | **Unset** on the hub: 0 hits in `/etc/substrate/env` and in the unit. It returns null and falls through to the local `gaps.json`. Node 2 composes from its own stale 70-gap copy (last modified 09-26). Class node-locality / federation-p2p; the recommit 21179d8 deleted it once | Revive as discovery-routed `substrateGap` resolution to the hub instead of an env URL. Absence on one node is not absence |

### Broken

| mechanism | evidence |
|---|---|
| asResolvePath + endpointForShape | goal-host `index.ts:448` returns an **absolute** URL for absolute rows. It is still concatenated after `endpoint` at `9460, 12746, 12776, 13507, 13519, 13994, 14347, 16678, 16797`. Those sites only work today because the rows they hit (dev-vessel) are relative; they break for the 6 absolute-row vessels (analysis, goal-host, human-surface, llm-resolver, local-tools, relevance-sink). The hot path was fixed by inline ternaries in 5ca51be (09-28), after about 9.8k invalid-URL failures that followed 6c98916 (09-22). Fix at the seam: normalize `resolve_endpoint` in discovery `/register` and use one joiner. The poisoned `auto-bridge-*` posteriors still need re-attribution |
| Class-1 arming guard (merged) | dev `substrate-gap.ts:135-160`: `filePath.replace(/^repos\//,"")` joined onto `WORKSPACE_ROOT=/workspace/git/super-repo`. For development-vessel it hits the **decoy** tree `/workspace/git/super-repo/development-vessel/src` (8 files, confirmed). For every other vessel it hits ENOENT, and `catch { return false }` arms the gap. Five autonomous edits (5499f5c, ff1516a, d9131e6, 840b513, 48fb8b6 adding `readFromCorrectWorkspace` on 09-26) did not touch the join. Same issue for the same reason: the WORKSPACE_ROOT flip 09d9baa6 |
| db_admin diagnose/repair/prune/snapshot | activity-api `routes/db-admin.ts:197-201`: `safeCount` filters on the invented field `db_integrity_auto_repair_has_never_run = false`, so every count is 0. The CATASTROPHIC_PATTERNS gap-id regex claim did not reproduce by grep (unverified). `satisfier:db_admin` 10/10 "ok" in 5 d: a green run over a zero reading |
| trace-store-reconcile | **OVERRIDE of "dormant":** `development-vessel:trace-store-reconcile` 469 / 110 ok (23%), last 09-28T14:47. Operator experiment variants `-lease-ttl-120s` 171/23, `-release-before-verify` 166/19, `-swap-timeout-15min` 19/3 and `learned-…-trace-store-reconcile` 10/0 remain live rows; **retire those 4** (law 12 residue). It counts rows and cannot see the blob garbage (its own gap, 09-25) |
| drift committer (rhythm "self-maintenance" family) | `rhythm-conductor-tick.ts:126`: "detect-vessel-code-drift … run the vessel-code-commit-and-push goal". 4e4170a8 (09-07) landed 48 `.js` and 48 `.d.ts` build-emit files; 9d839e0 (09-28) committed 422 bun-cache binaries plus runtime state. Held by the operator (66ba773). `gaps/gaps.json` and `state/learning-mode-state.json` are still tracked. Stays held until it respects gitignore and runtime-state placement |
| conservation-audit-emit (second registration) | activity-api `activities.ts:5971` and `:6034` register the same path. The second handler is unreachable (Hono takes the first match); it is the garbled splice from 53292c9 (09-14). Delete the second and recover the lost residual-trend route from 9c1d56a |
| conservation-* observers and learned-conservation-* twins | Seeded rows in 5 d: emission-junction 50/6, posterior 48/5, selection 47/6, residual-trend 45/5, memory 40/2, addressing 28/**0**, structure 19/2, bridge-tick 34/3. They took about 30k of 62k Thompson selections for about 300 executions. **Twins** (`learned-conservation-audit-posterior-junction`, `-bridge-tick`) ran 1 time each: **duplicate-of** the seeded rows, so retire the twins. The seeded family is broken at 0-15% ok and should be repaired or retired with evidence |

### Merge / duplicate

| mechanism | target |
|---|---|
| apply_proposal_as_patch | merge-into the feature_compose + mitosis landing seam. 96 tasks / 9 ok in 30 d; 2 `satisfier` runs plus 2 `auto-bridge` runs in 5 d. 44bcffd already put it on the hardened gate |
| patch_with_tools | merge-into feature_compose. 2 tasks in 30 d; 1 satisfier run in 5 d. Its escalation never ran until 2a8ebf5, and it had no location check (e1f3656). Runtime-drift reports its live copy differs from the clone |
| prior-failed/successful-attempts | duplicate-of the attempt ledger (`attempt-register`/`attempt-checks`) and goal-host failure memory keyed by goal_hash. 1 `satisfier:prior_failed_attempts` run (0 ok) in 5 d |
| landedShaForGoalHash | merge-into `landedCommitForGoal` (goal-host `:6293`). The older function reads a node-local compose report (`:6281` comment); the newer one reads git and works on either node. Both are still called (`13386`, `13830`) |
| Edit-intent late site | merge-into the EARLY site (above) |
| recipeSeed | merge-into verifier recipes (above) |
| KEYWORD_TO_TAGS | merge-into learned shape descriptions (above; kept until then) |
| verify*Reach and ephemeris | merge-into ClassRow |

### Fossils (archive per the convention above)

| mechanism | evidence |
|---|---|
| verifyEphemerisDistanceReach | goal-host `index.ts:1846`, called on every goal at `:3716`. Journal (3 d): **5,826 `[ephemeris-oracle]` ABSTAINED lines, 0 graded** (3,424 of them for a single goal_hash). Cost on every walk with no yield. Archive, or re-add later as a ClassRow row |
| Diagnostic sinks and ablations | goal-host `index.ts:718-780` (`GOAL_HOST_FETCH_PROBE`) and `:14425-14463` (`GOAL_HOST_NOOP_SINK`, ITER-4/iter-10). Env-only (law 1) |
| Auto-draft in handleRunGoal | goal-host `:16169-16316`. Returns early unless `SUBSTRATE_AUTO_DRAFT_ENABLED` is set; off by default since 429c7e5. It declares activities instead of earning them (law 4). The ribosome is the sanctioned path |
| Satisfier-plane reuse ordering | goal-host `:9870`, `SATISFIER_REUSE_ORDERING_ENABLED = false`, "DISABLED ON EVIDENCE" (35fb2f6; Fisher p ≈ 0.029 harm). Archive **with the measurement** so a retry starts from it |
| POST /update-failure-lessons | activity-api `index.ts:53-55`. 0 callers fleet-wide; the script is duplicated at `scripts/` and `src/scripts/update-failure-lessons.ts` |
| POST /composition writer | already absent from the live clone (0 route hits); superseded by the ingest edge (516fc73). Index-only archive entry |
| POST /header_added (x2) and probe headers | activity-api `activities.ts:25-35` and `:191-201`. 0 references outside the file. Hollow landings 2157764 and 6282954 |
| operator-review-patch, git-head-commit | dev resolvers. 0 imports (grep empty). git-head-commit was fixed in bc7ab7f on dead code |
| maintenance parity-gate + seam-extraction + spliceability | dev `src/maintenance/*`. Callers are only `scripts/run-seam-extraction.ts` and tests. goal-host hits are comments (`:10146`, `:12712`). activity-api / ias-executor "parity-gate" matches are a name collision. **Fossil**; the general idea (behaviour-neutral refactor verification) is worth an index entry |
| trace-store-reconcile variants | the 4 rows named under Broken (pool retire) |
| config-surface-probe.sh | `scripts/substrate/config-surface-probe.sh` + baseline. No caller except itself (script-retention rule) |
| recompute-poisoned-posteriors | lives only in `/workspace/active-scripts` and is absent from the super-repo (a volume-only fossil). **The need is live**: the invalid-URL-poisoned `auto-bridge-*` betas. Re-attribution should be revived as a reach-classify abstain rule on addressing-class failure reasons, not as this repair script |
| Designed-never-built primitives (origin_layer, resolver_registry_query, LiveExecutionFrame, goal_semantics, keywordMappingProposal) | 0 source hits across all live clones. Index-only entry pointing to stream-B investigations 042-079 |

## 2. Cross-cutting reading for the realignment

1. **Same issue for the same reason, confirmed live twice in this chunk.** The WORKSPACE_ROOT flip (09d9baa6) still drives the arming guard (decoy tree / ENOENT) and the scenario root split (two scenario trees, one frozen). The absolute `resolve_endpoint` still sits behind `asResolvePath`'s 9 concatenations. Both are unfixed at the seam; each autonomous fix patched a call site.
2. **Untraced but steering:** the rhythm conductor (bootstrap POST), the trace-retention env, the edit-intent env gate, successor-feature and recipe loads. These behaviours shape outcomes that the learning loop cannot see.
3. **Node-local stores where p2p reach is expected:** the gap store (GAP_STORE_ENDPOINT unset), the verifier recipes (a file under `/workspace/state`), and landedShaForGoalHash (a compose report in this container). All three should resolve by shape through discovery.
4. **Volume ≠ value:** gap-to-scenario-bridge-tick (18k/5 d for ~69 writes/day), the ephemeris oracle (5.8k abstains/3 d), and conservation arms (30k selections for ~300 runs). Each consumes the capped 5-day trace window that every learner reads.
