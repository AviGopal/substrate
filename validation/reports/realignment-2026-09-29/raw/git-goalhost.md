# git-goalhost — goal-host-vessel history and src/index.ts structure

Source: live clone `substrate-live:/workspace/git/vessels/goal-host-vessel`, HEAD `bc99f91` (2026-09-28 18:16Z).
Read-only. Journal counts are from `journalctl -u goal-host-vessel --since "7 days ago"` on substrate-live (312,371 lines), used only to say whether a mechanism is live now.

## 0. Shape of the history (numbers)

- **1,090 commits** 2026-06-15 → 2026-09-28. By month: Jun 62, Jul 394, Aug 452, Sep 182.
- Authors: **Substrate Autonomous 544**, DevBob Assistant (operator agent) 515, Avi operator-bypass 24, Avi operator 3, Devbob Agent 3, 1 resumable-landings session.
- Operator-authored commits stop at 2026-09-26 (`7f0425d`). Since then, all landings are autonomous.
- Autonomous commit subjects carry no information (`substrate-authored: apply <gap>-compose-report via mitosis cutover`). The `Gap:` trailer names the gap: **382 of 544 are `route-edit-<hash>`** (the goal-text hash, not a named gap), **59 are `unknown-gap`/`unknown-proposal`** (Jun–Jul), and 2 are the literal `{{goal.id}}` (07-06, `7e41643`, `74e6ff6`: an uninterpolated template variable used as a gap id). Only about 100 autonomous commits name a real gap. **So the history does not say what problem most autonomous landings addressed.**
- Autonomous code churn (TS lines that are not comments or blank): **+6,051 / −1,380**. **238 of 544 autonomous commits change ≤2 code lines.** **13 are comment-only** (nothing but comment lines added or removed): `e3e1849 57b84f5 38a834a`, `2f519ee`, `ec6f9d3`, `11144ea`, `020e0ac`, `c388d5a`, `c88bf0a`, `5cf8301`, `03bc5b8`, `f1d79c3`, `d1d302e`.
- `src/index.ts` size over time (lines / count of .ts files in src): 06-20 2,113/1 · 07-01 4,378/4 · 07-15 6,912/15 · 08-01 10,327/17 · 08-15 14,156/55 · 09-01 16,128/82 · 09-15 16,624/84 · **09-28 17,910/84**. 452 of the 544 autonomous commits touch index.ts. Code has been moved out into sibling modules, but the core has never been split up.
- 17 commits say "revert". The **unlabeled reverts** (oscillation clusters and same-day self-reversal, §2) are more numerous, and they are what "each time proclaimed newly resolved" refers to.

## 1. Structural map of src/index.ts (17,910 lines at bc99f91)

Line bands, from the 171 top-level anchors:

| Lines | Subsystem | Notes |
|---|---|---|
| 89–448 | `resolveFleetActivityFeed` (359 lines) | Human/fleet feed. `51c6c96` (feed dialled its own mirror). `844704b` (feed shipped 3 fabricated gap rows). |
| 448–460 | `asResolvePath` | Endpoint joiner. See endpoint-routing. |
| 487–568 | `endpointForShape` | Loopback/peer preference. **47 commits touch it (30 autonomous).** |
| 639–779 | `gracefulShutdown` | Drain on cutover (`015d1ae`, `53cce0b`, `df4b700`, `28b6fa9`). |
| 812–991 | `BoundedBusSink` | Plus the ITER-4 NoOp sink (14425–14434) and the iter-10 subscriber ablation (14451–14463). Both are env-gated diagnostics that were left in. |
| 1135–1278 | `deliverReachVerdict` | Plus the reach-verdict spool (`ea78fd7`, `d60abfc` "inert TWICE"). |
| 1386–1510 | `recallConceptRows` | Concept-db recall ladder (08-07 → 08-16, 12 commits). |
| 1519–3489 | **Oracle family**: 22 hand-written `verify*Reach` functions plus the ClassRow route-as-data harness (2553–2860) | Four generations of reach grading (see mechanisms). |
| 3489–3937 | `verifyGoalReached` (448) | The LLM reach judge plus the verdict chain order. |
| 4119–4357 | `tryLexicalRebind` (238) | Middle tier (first/last-mile). **0 of 3,456 selected in 7 days.** |
| 4649–4934 | `recomputeIndependently` (285) | Two-derivation truth. 1 DONATED in 7 days. |
| 4934–5436 | `runGroundedToolLoop` + `universalToolFallback` (161+341) | The ReAct floor, including `recipeSeed` (5127). |
| 5634–5865 | `fileCapabilityGap` / `fileReachabilityGap` | Gap filing from the walk. |
| 5865–6505 | `penaliseHollowTemplate`, `landedShaForGoalHash`, `recordGoalPath` | Credit and landing ledger. |
| 6505–6970 | `persistFailedWalkTrace`, `recommendReachingPath`, `buildCompositeTraceFromChain`, `mintReachedTrace` | Pathway reuse plus the ribosome mint. |
| **7193–11759** | **`runGoalAsPoolWalk` (4,566 lines)** | The walk. In-code markers: 9729 "This gate has been DEAD since it was written"; 9751 "explicitly disabled rather than accidentally dead"; 9870 "DISABLED ON EVIDENCE" (satisfier-plane reuse ordering, `35fb2f6`). |
| **11986–14311** | **`runGoalWithRecoveryInner` (2,325)** | Recovery, edit-intent routing (EARLY route 12683 and late route 13304/13365, two copies of the same decision), pwt escalation, activity-repair (13974, `ROUTE_ACTIVITY_REPAIR` default OFF). |
| 14311–14478 | `solicitHumanInput` | Human escalation. |
| 14593–14835 | `registerBuiltinResolvers` | |
| 14886–15175 | `buildProxyResolver` (dev-vessel `/shapes`, 178 lines) **and** `buildDiscoveryProxyResolver` (discovery registry, 111 lines) | Two proxy paths: one specific (pinned to dev-vessel), one general. Both are registered (15317, 15366). |
| 15175–15262 | `lintAndRepairAuthoredTemplate` | |
| 15407–15555 | `startVesselRegistrationSubscriber` | |
| 15643–15805 | `searchWorkspaceForTerm` | Goal-file resolution at the door. |
| **15805–16865** | **`handleRunGoal` (1,060)** | Includes the auto-draft block (16169–16242, env-gated default OFF) and the "dead post-redirect block" (~16464, per `ecd077e`). |
| 16946–17340 | `handleResolve` (394) | |
| 17559–17839 | `drainInterruptedRequeue`, `pruneStore` | |

**Three functions hold about 7,950 of 17,910 lines** (`runGoalAsPoolWalk`, `runGoalWithRecoveryInner`, `handleRunGoal`). The drafter works on fixed line windows of these functions, which explains the region and anchor failures, duplicate inserts, and stale-base clobbers documented below.

**Env reads in index.ts: 34 distinct `process.env.*`.** Behavioural ones (law-1 violations still present): `ROUTE_EDIT_INTENT_TO_COMPOSE` (3 sites), `PREFER_LIBP2P_ROUTE` (3), `SUBSTRATE_AUTO_DRAFT_ENABLED` / `_THRESHOLD` / `_EXPLORE_FLOOR`, `SUBSTRATE_REUSE_LLM_ENABLED`, `ROUTE_ACTIVITY_REPAIR`, `GOAL_HOST_NOOP_SINK`, `GOAL_HOST_DISABLE_SUBSCRIBERS`, `GOAL_HOST_FETCH_PROBE`, `SUBSTRATE_AUTHORING_DECISION_EMIT`. Endpoint envs used as fallbacks: `DEVELOPMENT_VESSEL_ENDPOINT`, `DISCOVERY_VESSEL_ENDPOINT`, `LLM_VESSEL_ENDPOINT`, `PRODUCER_DISCOVERY_ENDPOINT`, `ACTIVITY_API_ENDPOINT`. The comments "discovery unreachable → env fallback carries" appear at 9462, 12779, 13522 and 13997.

No top-level function is uncalled. The dead code sits **inside** functions: disabled gates, a post-redirect block, and diagnostic sinks.

## 2. Attempts by problem class

### endpoint-routing (open; the fix repeatedly overshoots)
- 07-05 `b135638` normalised absolute `resolve_endpoint` "at all remaining resolve sites". 07-07 `02291af`, `e3a4ce2`, and 07-15 `a08207c` are "surgical-hardcoded-endpoint" landings. 06-29/06-30/07-05/07-16: `asResolvePath` rewritten 4 times (`ddf7a1d`, `c51d3f8`, `298eea5`, `d2a8d88`).
- 09-20 `9531c5f` (autonomous, gap `asresolvepath-discards-a-working-absolute-resolve-url…`): `asResolvePath` now returns **absolute** `protocol//host/path`. Every caller that does `${endpoint}${asResolvePath(...)}` therefore builds an invalid URL.
- 09-22 `6c98916` patched **one** site (rawResolve, 7504). 09-28 `5ca51be` patched **two more** (7454, 15125), each with an inline `startsWith('http')` ternary.
- **At HEAD, 7 sites still concatenate** `${endpoint}${asResolvePath(...)}`: 9460 (devVesselResolveUrl), 12746, 12776 (earlyComposeUrl), 13507, 13519 (composeUrl), 13994 (repairUrl), 14347 (producer fetch). They are latent today, because development-vessel's row is evidently relative (7 days show 1,111 edit-intent-no-landed-edit verdicts, so compose is reached). Each will throw the moment its row advertises an absolute URL. The class remains open and is being patched one call site per gap.
- `isIPLoopback|127.0.0.1` in endpointForShape: **47 commits, 30 autonomous, 06-15 → 08-29.** 08-10 `route-edit-eaa86280:3` landed **14 commits in 5.5 hours** (`344f970` 13:21 → `9c90131` 18:54). They oscillate between "skip loopback candidates", "prefer non-loopback", "return peer immediately", and back again. Outcome: oscillation, no convergence.
- 08-07 `53d9080` (recall read a masked port), `5ab2a21` (wrong vessel), `1adbad4` ("one way to read concept-db, and delete the pinned port"). `:8260|:18260` still touched 8 times through 08-29.
- 09-25 `8c31cdb` (autonomous) added a 52-line **global `fetch` monkey-patch** "discovery-first routing shim". It was reverted the same day by autonomous `6ce1446` (gap `revert-8c31cdb-global-fetch-shim`).

### false-verification (edit and creation goals reaching without a landing; recurred at least 8 times)
- 07-21 `d679cfb` (staged-but-unlanded = not reached), `bfc6af1` (edit-intent reached ONLY on a pushed landed sha), `238a4a3` (grader-side inverse).
- 07-22 `0687ac2`, `5b415ae`, `8fd1c23` (diff substance, not just landed sha). 07-25 `4c21c9d` (edit-intent reaches only on an edit-result), `780409e`.
- 08-02 `e830210`: the EDIT-INTENT escalation block existed **3 times**. Blocks 1 and 2 were stale 07-10 copies returning `reached:true` on `mitosisStaged || dispatched` (matched 100% of returns) and short-circuited the correct block 3. **Staging graded as reach for about 3 weeks.**
- 08-09 `1b823cb` (staged-not-landed asserted a clone it never looked at). 08-11 `94f4649` (bind the landing requirement to the goal, not the route). 08-13 `e62a5d9` (fs-effect target with no landed sha was hollow-green).
- 08-24 `221f919`, `60b7c0f` (creation goal demands landing evidence; the LLM judge false-reach). 08-27 `05e0c87` ("Close substrate gap" repair goals require landing evidence). 09-02 `50f7560` (ask git for a late landing).
- 09-19 **4 autonomous landings** for `gap-reach-gate-accepts-artifact-existence-without-content-check` (`c9f1f86`, `694fa77`, `e8e1af3`, `78ff348`), each 1–6 lines on the same gap. 09-27 `f3ffd7d`: `landedCommitForGoal` (101 lines). The compose report lives on the other node, so `landedShaForGoalHash` could not see ownership-routed landings and **the same change landed twice (c23b601, 194df79)**.
- Now: `deterministic:edit-intent-no-landed-edit` is the most frequent verdict in 7 days (1,111).
- Oracle false greens: 08-04 `dbdaa09` (file-count oracle graded the wrong question and alpha-credited it), `6527e03` ("TypeScript files" meant no filter), `a9742a9`, `d833cdc`. 08-06 `bcfc4ed` (aggregate counted every file and confirmed itself), `2504fb0` ("six copies of one parse"), `054b2d0` (two-source verifier computed the truth then confirmed a wrong answer), `6e6aa7c` (the verdict claimed a check it had not performed), `d7fee60`. 08-07 `6a1ce94`, `9e0492c` (registry oracle claimed a goal because a PATH contained "discovery"). 08-08 `ba5f733`.
- **totalVessels / "vessel-anywhere" registry-oracle test: 7 recurrences**, the 7th re-introduced by autonomous `31f1d67` and reverted in `0789584` (08-17). "The previous six were each fixed by guarding the observed symptom; this one re-added the symptom directly, to close a gap, with every gate green." HEAD no longer has the `/\bvessel\b/ ? "totalVessels"` line (checked). The tests pinned the rule, not the call site.
- 08-17 `15bc5fd`: the ephemeris sanitiser "could produce a false REACH". `a2ba87f`: "my last commit caused a false reach".

### hollow-landing / drafter-quality (autonomous)
- **Oscillation clusters** (unlabeled reverts, same gap, same day):
  - `route-edit-6c0aad12` 07-04: 7 commits alternating +3/−3 of one comment block (`24e967b`, `e3e1849`/`c93c251`, `57b84f5`/`e9edf8b`, `38a834a`/`c4b1505`). Net zero.
  - `route-edit-ac241456` 07-07: 7 near-identical 1-line edits (`isQuestionGoal`/`isObsidianQuestion`).
  - `route-edit-26279b2b` 07-09: 1×240-line + **10 identical 20-line inserts** of the "Declarative reach for pinned/no-goal dispatches" block. Operator `2d962de` deduped it the same day; the block was **re-inserted by a stale runtime cutover** and `9a93e21` re-deduped it.
  - `route-edit-eaa86280:3` 08-10: 14 commits (endpoint-routing above).
  - 09-28 `39bef90` then `bc99f91`: parent gap landed a hardcoded `scripts/substrate/` → `/substrate/` path rewrite in `inferGoalTargetShapes`, fed into the goal **hash**. That is a symptom-level hack (drafter-quality). Its `-narrowed` child landed 30 minutes later and deleted exactly those lines ("Path rewriting logic removed"). **Two "landed" commits, net zero, both counted as landings.**
  - 09-25 `8c31cdb` → `6ce1446` (global fetch shim, same day).
- **Inverted intent**: `429c7e5` (08-18, gap `gap-env-gated-substrate-auto-draft-enabled`, a law-1 violation). The landing changed `=== "0"` to `=== "0" || === undefined`, making the env gate **default OFF**. It deepened the env gating the gap asked to remove. Still in HEAD (16175). Outcome: failed.
- `7b3168e` (07-30, `reach-gap-param-rooted-suppress`): commented "remove duplicate declaration", but it **injected** a second `let walkTerminationReason` and broke the parse. `4fa92b3` (substrate-self-push-poller_wedged) made `repairSignatureOf` async and left the call site un-awaited. Both fixed by operator `f3953c0`. `2fe3750` (07-29) inserted a duplicate `walkTerminationReason` and made **goal-host crash-loop, goal dispatch DOWN**. Fixed by `4658fe5`.
- `fce961b` + `f1d79c3` (08-09): the substrate **commented out the path operand of `isEditIntentGoal`**, so "Add a note about my weekend" became an edit-intent goal routed to feature_compose. Reverted by `eac995e`. Typecheck passed; the predicate only widened.
- `b222d75` (route-edit-cf6eaf04:3): the goal asked to loosen a dedup gate in **activity-api**. What landed was a `direct = null` refusal heuristic in goal-host's core walk (wrong repo, wrong change). Reverted by `c158bd0` (08-11). Also reverted: `d96e2ae` (→`d002265`, 08-10), `bc0ba3f` (→`d2b3858`, 08-11), `e37182d` (→`e4f9315`, 08-17).
- `e1e84cc` (route-edit-44172f26:1, 08-07) was asked for a one-line `endedAt`. It **deleted the 35-line recipe-seed block as collateral**. That produced revert `a8e38dc`, reapply `280dada`, and revert-of-reapply `496aebf`. Gap filed: `no-scope-check-on-patch-deletions`.
- Stale-base clobber: `1be9f4f` (route-edit-56885c35) staged index.ts against a pre-`7fcbaba` base, and its full-file cutover deleted an 18-line honest-reach guard while making a 3-line edit. Re-landed in `ca52631` (07-24).
- The operator's own bypass also broke things: `3d4aa60` (09-22) left TS18046 at 16464, "failing EVERY compose verify on this vessel". Fixed by `ecd077e`.

### directed-overshoot (operator fixes that had to be undone or re-fixed)
- Recompute/wc: `089aead` was reverted by `b41851c`. `1ec89d1` was reverted by `b012857`. Recipe seeding: `1021176` reverted by `d73da0b`, restored by `c671407`. β on no measurement: `62a00f5` reverted by `0ffb69a`, then re-approached in `cabf140` (08-17) and `020042d` (09-22).
- Rebind: `6b0701a` revert, then `91df0e7` un-revert. `65b7c81` "bank on VERIFIED reach" reverted by `88480c0`. The rebind "content-store gate landed inert": `8aa17cc` fixed by `c477e07`.
- `7deef44` claim withdrawn by `95126ff`. `d253072`: "close two regressions I introduced". `a410572`: "my cc8c3cd let derivation-split class it terminal". `a5e8595`: "prior remap over-applied". `3bd2a46` dropped the conciseness cap `e439de0` had added the same day.
- `d60abfc`: "the lost-verdict emitter was inert TWICE".
- The reuse fix for `9531c5f` overshot (endpoint-routing).

### write-read-mismatch
- `f87f52f` (08-16): "produce walkBudget and lessonExecutionPolicy — I shipped both readers, neither producer". `a848aee`: bodyHonestyPolicy "has had a producer and no file since 08-02". `7dead06`: "serve bodyHonestyPolicy — the shape the walk already read". `f34547e` (08-28): extractionPolicy and pathwayReusePolicy were given a producer.
- `1cd87a0` (08-05): "the verdict was computed honestly and then dropped in transit". `115cc67`: "the verdicts the learner most needed were the ones it could not hear". `fc297b4` / `d9dc600` / `3cd7019`: human oracle labels were not consumed ("feedback was unconsumable"). 09-19 `41b9080` (`gap-oracle-labels-have-no-consumer-for-disagreement`).
- `b164b73`: "the llm unwrap tested a shape name the producer never returns". `f801ffa`: "shortcut decisions never reached the cache, so the confidence column is fictional". `4be4f36`: "single-template path wrote BOTH shape columns empty".
- `3244164` / `c6f5b14` / `91d1b63`: satisfier and composite traces carried no reach tag, so 45 executions arrived ungraded. `69fe835` (09-23): satisfier traces record no input impulses, so there are no consumption edges. `b36f0ef` (09-22): declared consumed inputs.

### selection-learning (credit)
- `6c020d9` (08-05): the satisfier graded itself, so 52% of paths self-certified. `921d70e` / `d3a3815`: every landed edit and named mechanism was counted as `learned_pathway`.
- `d69a4ad` (08-16): "draw a real Beta — blame was landing in the table and dying at the sampler". `c256109`: a lost alpha-credit went silent under a success log line. `cabf140`: β fired where α was structurally impossible, so the arm could only lose. `3691ee7` (08-19): "record the grade at all eight sites, not two". `b5e4b56`: stop grading a succeeding satisfier as a failure. `020042d` (09-22): "a withheld beta is actually withheld". **The asymmetric-credit class recurred 07-22 → 09-22.**
- `ff2b518` (satisfier respects posterior), `eda190f` + `ca286e0` (edge blend; `EDGE_BLEND_K` was itself a law-1 violation), `785293c` (Wilson ranking).
- Runtime evidence: 966 `/run-goal` errors in 7 days of "refusing pinned target development-vessel:scaffold-and-publish-vessel: posterior decisively negative (alpha=6.05 beta=8610.66 over 8617 observations)". The posterior works; some pinned dispatcher never learns from its refusals.

### composition-crystallization (the ribosome "never mints" class recurred 4 times)
- 06-22 `15620e7` (reach→mint), 06-30 `337d223` ("make reach→mint actually run the ribosome-extract chain"), 07-31 `f88ba8f` ("stamp lifecycle.status='completed' so reached executions crystallize"), 08-13 `8d960a8` ("the ribosome was skipping every real composition"), 08-07 `d48a963` ("the extraction-depth bound was on the path that never mints"), 08-17 `ef48012` ("arm the recursion gate that has been disarmed since the audit"), `4a4af5e` (mint admitted evidence the credit gate rejected as 68% hollow).
- Reuse ceiling/middle: 07-31 `6082c2e` (close reuse-hop barriers 2–4), 08-06 `7cd8952` ("the MIDDLE tier was foreclosed by a dead operand"), `7d6ea64` ("could not reuse a composition unless it had already failed"), `0a532d2`, `2d980fe`, `56ce793`. 08-08 `35fb2f6` disabled satisfier-plane reuse ordering on evidence (0/4 vs 3/4). 08-28 `d45aa3d` (lineage). 09-23: 3 autonomous landings for `a-learned-pathway-whose-head-is-a-satisfier-is-found-then-dropped…` (`3d2e52a`, `579f365`, `c37df24`), then `49b884e` "pathway acceptance is intermittent … a third of transform walks still write before computing", then 09-25 `91c042b` (-narrowed). **Recurring and still open.**
- Lexical rebind (Tier-2, 07-24 `d38eaa9`, `831dafb`) plus ~12 rebind fixes on 08-08. Now: **0 selected / 3,456 in 7 days**, all refusals `shape-mismatch`. The reached-command cache `/workspace/.goal-host-reached-commands.jsonl` holds 10,624 lines / 3.1 MB and is still written (tombstones on 09-29), so the store is live but the adaptation reading it never selects. Status: dormant.

### goal-walk-floor
- 07-23 `43247db` (grounded ReAct fallback), 07-27 `559a55d` ("revive the dead ReAct parity floor"; `if (!LLM_VESSEL_ENDPOINT) return null` had silently disabled it, see line 5105), 08-05 `ecd0c5a` (a per-iteration timeout killed the loop silently), `c43f59d` (the fallback deleted its own answer), `8ee6c66`, `c033664` (a floor reach could never become a learned pathway), 08-17 `825f773` (one transient 500 killed the loop at iteration 0).
- Target inference churn: 24 autonomous commits to `goal-target-inference.ts`, plus operator `1f24ad1` (08-04, "remove an inverted guard that made inferGoalTargetShapes a no-op"), `39b86a2`, `6e049cc`, `6d60248`, `3b9197d`, `dd5ed4a`, `546a855`, and the 09-21 `4678802`/`faa0afc`/`0c41918`/`cc8c3cd` named-shape bind. 09-25 `e9ee9b4` (picks shellResult over the advertised vesselHealth shape). 09-28 `39bef90`/`bc99f91` (path rewrite hack and its revert).
- 08-15 Io-distance chain: ~30 commits in one day (`f73faaa` … `3496df5`), all prompt/corrector patches for one goal. The prompt-steering class: "enforce the host ban in code, because stating it in the prompt does not hold" (`2c26fcb`).

### memory-recall
- 08-07 → 08-17 concept recall ladder: `53d9080`, `5ab2a21`, `1adbad4`, `637c1f4` (20 s per goal), `373761a`, `4afc7ac`, `3faae36` (cache; "the route to concept-db is unreliable"), `3496df5`, `674a400` ("the recall budget assumed a local vessel"), `09892ed`, `668e16a` (serial, "the relay is the scarce resource"), `2dcfc12` ("the relay fails ~40%"), `060d2d0` (success rate was unmeasurable), `c72ee75` (lessons delivered to the shape chooser but not the request builder).
- 09-22 `9e23455` / `cf8fd87` / `4710f6c` (failure memory keyed by goal_hash). Now: 1,460 FAILURE-RECALL lines in 7 days, so it is live.

### node-locality / federation
- `f3ffd7d` (09-27): the compose report is written on the owning node, so the other node's landed-check is blind, which caused a double landing. `674a400`, `668e16a`, `2dcfc12`: recall across the relay. `a1ffaa5` (06-30), `752f46d`, `1ecf873`: libp2p/peer routing. `PREFER_LIBP2P_ROUTE` is an env gate at 3 sites. The loopback-vs-peer oscillation (above) is the same class: which address of a vessel a remote caller should use.
- Runtime: 3,189 + 916 + 607 + 291 `[reach-gap] ABSTAIN … producer discovery unreachable` in 7 days. Discovery timeouts dominate the gap-filing path.

### narrowing-duplicates / sync-deploy-drift
- `-narrowed` children: `3253447`, `82125c9`, `e673b34`, `91c042b`, `bc99f91`. `bc99f91` is a verbatim reversal of its parent. `recommit-route-edit-fc007cd0-semantic_reject` (`020e0ac`, comment-only).
- Duplicate in-flight: 07-21 `055406c` / `7e121c4` (coalesce, "bound the gap-drain livelock"), recurred 09-26 `7f0425d` ("refuse a /resolve for a goal this process is already walking").
- Stale runtime cutover re-inserting code: `9a93e21` (07-09), `ca52631` (07-24). Cutover restarts: `015d1ae` / `53cce0b` drain, `b3ad44a` ("a thrown dispatch never left `running`, so it leaked forever"), `df4b700`.
- `d1a30bf` (08-08): "the container-rewritten ias-executor path was committed back to the repo". `9654ae1`: malformed package.json from a stray brace.

### spend-envelope-throughput (compose BUSY/503: 5 fixes for one behaviour)
- 07-05 `01ef41e` (autonomous, `capability-gap-edit-intent-compose-busy-verdict-retry`), 08-10 `4ba7bbd` ("BUSY is not a verdict, it is 'ask again later'"), 08-11 `eed0ccf` ("a draining compose producer answers 503, and nothing read the status") and `ee4622a`, 08-23 `2cc8af7` ("refuse retryably on compose BUSY instead of falling through to a walk that cannot edit"), 09-25 `60833b4` (autonomous, gap `an-edit-intent-goal-whose-compose-producer-answers-http-503-draining-falls-through-to-a-shell-walk-instead-of-refusing-retryably`). **The same fall-through, 5 times across 2.5 months**, because the edit-intent decision exists at the EARLY route (12683) and the late route (13304/13365).
- `a0186c2` ("the compose ceiling was set below the QUEUE"), `fcd667b` / `db21c5f` / `82125c9` (operator vs gap-lane reservation).

### gap-content
- 08-07 `fdb7036` (refusal files the missing verifier as a gap), `8a6442c` ("an unrecognised goal family filed NOTHING"), `2d7fd0b`. `404cd67` / `80f7249` / `d575161` (phantom capability gaps for executor and walk-artifact shapes). `4ed5046`. 09-22 `3d4aa60` (auto_draft telemetry was polluting the gap store).
- Symptom → file routing: 08-09/08-10 ~25 commits (`59166c8` … `27eae54`) teaching `goal-file-resolution` to find the edit site from a symptom. Reverts `88b212a` / `dd1195b`. `9178b9a` (`uniqueness-is-no-longer-evidence-of-location-at-this-corpus-size`).

### test-residue-live-state / trace-store-db
- `bee05ca` (08-06): "stop the bare satisfier writing to live vessel source". `07a6c7c` (09-22): failed walks wrote no trace (`goal-seek:no-trace`). `persistFailedWalkTrace` now exists. `1c615b0`: token usage dropped at the router hop.

### codebase-bloat-fossils
- index.ts grew 2,113 → 17,910 lines. 3 functions hold about 7,950 lines. `6a6eaa4` (08-06) removed 2 callerless functions. Beyond that there has been no decomposition, only extraction into 84 sibling files.
- Diagnostic residue still in HEAD: ITER-4 NoOp sink (14425), iter-10 subscriber ablation (14451), `GOAL_HOST_FETCH_PROBE`, "DEAD since it was written" gate (9729), "DISABLED ON EVIDENCE" reuse ordering (9870), `ROUTE_ACTIVITY_REPAIR` default-off (13974), dead post-redirect block (~16464).
- The ephemeris oracle (`verifyEphemerisDistanceReach`, JPL Horizons, 08-16) runs on every goal: **6,479 ABSTAINED / 0 graded in 7 days.** It is a specific-path fossil with per-goal cost.
- Oracle proliferation: 22 `verify*Reach` functions. `verifyCountFilesReach` (11 refs) and the aggregate family have no verdict tags in 7 days of journal apart from registry-count (74), gap-total (5), field (1), unmeasurable (3), and the code-investigation/transform/edit families.

## 3. Mechanisms (general capability vs specific path; used now?)

- **Reach gate / `verifyGoalReached` + deterministic verdict chain.** General. live-used (1,111 edit-intent, 548+358+21 code-investigation, 272+131+34+84 transform verdicts in 7 days).
- **Hand-written `verify*Reach` oracles (22).** Specific per goal family. Mostly live but low-traffic. Ephemeris: fossil (0 of 6,479).
- **ClassRow route-as-data (07-30, `e8caa37` / `ef5c645` / `5fa3fc8` / `6ba5c6c` / `b307589`, with an executable drift gate wired into mitosis in `8478bc6`).** Meant to be general. Only avg-threshold and below-mean migrated; the other ~18 stayed legacy. Duplicate of the legacy oracles.
- **Independent recompute (08-07 `aed9961`, `2337624`).** General. Live but ineffective: 1 DONATED in 7 days, the rest abstentions or authoring failures.
- **Verifier recipes (08-07 `48f67f9`; `/workspace/state/verifier-recipes.jsonl`, 39 lines, last written Aug 27).** General. Loaded 44 times; no evidence of grading use since 08-27. Dormant.
- **Recipe seeding of the floor (`recipeSeed`, 5127).** Present in HEAD, 0 journal hits. Dormant (it survived 2 reverts and a collateral deletion).
- **Lexical rebind / reached-command cache (Tier-2 middle mile).** Store written (10,624 lines); selector 0 / 3,456. Dormant or broken.
- **Failure memory (09-22).** General. live-used (1,460 hits).
- **ReAct floor (`universalToolFallback` / `runGroundedToolLoop`).** General. live-used.
- **Edit-intent routing to feature_compose.** General, but **duplicated**: an EARLY route (12683) and a late route (13304/13365), each with its own BUSY/503 handling (5 recurrences). Env-gated by `ROUTE_EDIT_INTENT_TO_COMPOSE`.
- **`goal-file-resolution` / `searchWorkspaceForTerm`** (resolve the file at the door). General. live-used.
- **Proxy resolvers**: `buildProxyResolver` (dev-vessel `/shapes`, specific) plus `buildDiscoveryProxyResolver` (discovery, general). Duplicate paths, both registered.
- **`asResolvePath` + `endpointForShape`.** Shared seam. Broken: 7 of 10 call sites still concatenate.
- **Global fetch shim (`8c31cdb`).** Removed. A fossil in history only.
- **Ribosome mint (`mintReachedTrace`).** General. Live, but its "doesn't actually mint" class recurred 4 times.
- **`landedCommitForGoal` (09-27)** vs **`landedShaForGoalHash`**. Two landing probes, the new one added because the old one is node-local. Duplicate.
- **Coalesce in-flight (07-21)** vs **/resolve already-walking refusal (09-26).** Two dedup guards for the same class at two entry points.
- **Auto-draft (`handleRunGoal` 16169).** Env-gated default OFF after `429c7e5`. Dormant.
- **Reach-verdict spool (`ea78fd7`, `d60abfc`).** General. Status unknown (it was inert twice).
- **Pinned-target posterior refusal (ias-executor-ts).** General. live-used (966 refusals / 7 days).

## 4. Principles found in commit bodies

- "A staged clone is not a reach." (`e830210`)
- "The correct repair is to RESOLVE the missing path, not to delete the requirement for one." (`eac995e`)
- "The previous six were each fixed by guarding the observed symptom … A shared rule is only shared while every caller [calls it]." (`0789584`)
- "Nothing checks that deletions are in scope." (`496aebf`, gap `no-scope-check-on-patch-deletions`)
- "Enforce the host ban in code, because stating it in the prompt does not hold." (`2c26fcb`)
- "A failed producer lookup is not proof that no producer exists." (`f5c4052`, `d575161`, `744ecd8`)
- "Grade novel goal classes by INDEPENDENT RECOMPUTE, not by another hand-written oracle." (`aed9961`) and "one model-authored command is not ground truth" (`2337624`)
- "I shipped both readers, neither producer." (`f87f52f`)
- Law 1 applied to the operator's own constants: `4f7a817`, `02f168c`, `ca286e0`.
- "Semantic widening of a predicate passes every gate" (`eac995e`). "A signature-subset staticEvaluate does not run a full cross-file tsc" (`f3953c0`).
- "Pinning a target bypasses selection, not the evidence." (runtime refusal text)

## 5. Recurrence summary (same class, many "fixes")

| Class | Instances (dates) | Still open at HEAD? |
|---|---|---|
| Edit or creation goal reaches without a landing | 07-21, 07-22, 07-25, 08-02, 08-09, 08-13, 08-24, 08-27, 09-02, 09-19 (×4), 09-27 | Partially: node-local report probe added 09-27 |
| Compose BUSY/503 falls through to a walk | 07-05, 08-10, 08-11, 08-23, 09-25 | Duplicated route remains |
| Resolve URL joining | 07-05, 07-07 (×2), 07-15, 09-20, 09-22, 09-28 | Yes: 7 sites |
| Loopback/peer endpoint choice | 47 commits; 14 on 08-10 | Unknown |
| totalVessels registry oracle | 7 instances through 08-17 | Fixed at HEAD (checked) |
| Ribosome does not mint | 06-30, 07-31, 08-13, 08-17 | Unknown |
| Credit asymmetry (β without α) | 07-22, 08-07, 08-17, 08-19, 09-22 | Unknown |
| Duplicate block insertion / redeclaration by the drafter | 07-09 (×10), 07-29, 07-30, 08-02 (×3 blocks) | Gate improved (full tsc?) |
| Stale-base cutover clobber | 07-09, 07-24 | Unknown |
| Duplicate in-flight dispatch | 07-21, 09-26 | Two guards |
