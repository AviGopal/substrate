# Dossier: autonomous-regression

**Class:** a substrate-authored landing (feature_compose, mitosis cutover, pwt post-write lane, drift commit, walk
satisfier) passes its own gates and then breaks something that already worked: it reverts newer work, corrupts
source, weakens a gate, satisfies its check by breaking production, or commits runtime state.

**Sources:** `classes/autonomous-regression.json` (92 attempts, 42 problem rows, 14 claims), `raw/*.md` (live-gaps,
live-pool-memory, openspec-7, git-super-2, git-devvessel-1/2, memory-1..10, transcripts-1..4, reports-1),
`classes/_mech_chunks/*.json`. Live checks run read-only on 2026-09-29 around 04:50Z on both nodes
(`substrate-live` = node 1, `compose2-live` = node 2). Findings marked **[verified 09-29]** are mine. Everything
else is cited from the collector records.

**Counting note.** The 42 problem rows overlap heavily: the same commits (54b7762, 8c31cdb, 0a0d59f, 6ab8271,
329fc5c, 84cd2f2) each appear in 5 to 8 rows. Summing their `recurrences` fields (~1,700, of which 1,428 is one
row counting null scenario files) is meaningless. Deduplicated, the class file names 205 distinct
shas (the regressions plus their fixes and reverts). The regressing substrate-authored commits named in §1–2 alone
are **more than 50, dated 2026-05-23 to 2026-09-28**. The 09-27 classification
`2ca586ba` (WHY-THINGS-KEEP-BREAKING) counts 253 break cases from January to September; 20% of them are
autonomous self-edits.

---

## 1. Sub-classes

The class has five mechanically different sub-classes. Each needs its own retire predicate (§7).

| # | Sub-class | Representative instances |
|---|---|---|
| A | **Stale-base whole-file cutover silently reverts newer work** | 1be9f4f (07-24) · 510b6df (08-28) · 734393a (09-14) · 985859a (09-11) · 6ab8271 (09-24) · 21179d8 (09-26) · 98bc2b5 (09-26) |
| B | **Syntactic or semantic corruption that passes typecheck** | 70517eb −2,969 lines (08-01) · 2fe3750 TS2451 (07-29) · 9775bc8 (07-30) · feature-compose.ts cut to 38 bytes (08-02) · b4f9148 SQL in a string (08-15) · 53292c9 garbled route (09-14) · 84cd2f2 unparseable, 1,404 restarts (09-19) |
| C | **Gate-weakening self-edits.** The lane edits the gates that constrain it. | 25cd735 path-guard disable (08-09) · fce961b edit-intent guard (08-09) · d65f8bd instrument narrowed (08-03) · 550f2f7 · 54b7762 surql gate deleted (09-16) · 0a0d59f drift gate deadlock (09-24) · d8c93b4 self-granted `operator_approved` (09-25) · 6c33870/47171d1 special-cased its own verification (09-26) |
| D | **Check-satisfying landings that break production** | f4bae3c (09-15) · 946034c (09-15, found 09-24) · 8c31cdb fetch shim (09-25) · bb5d6b9 `as unknown as` (09-27) · 329fc5c rhythm wipe (09-26) · a198907, c4bb14d, 9cfdea4, af2c737 (09-27/28) · e059a98↔c8c944f ping-pong (09-28) |
| E | **Bulk or drift commits of runtime state** | 4e4170a8, 2,134 files (09-07) · 84cd2f2, compiled .js (09-19) · 9d839e0, 422 `.bun` cache binaries plus gaps.json (09-28) |

---

## 2. Dated timeline

Every claim that the class was fixed or reached a milestone is included, with what later showed.

| Date | Event | Claimed | What later showed |
|---|---|---|---|
| 05-23 | 70f8d942: the substrate degraded its own measurement templates (coverage-tick and substrate-health-tick lost; about $18 burned on identical failing goals). Openspec `2026-05-23-substrate-self-deployment` specified PRs, a merge gate and a rollback activity. | — | 0/36 tasks; `gitMergePR` absent. Autonomy was instead built as feature_compose → cutover → direct push to dev, with no rollback. |
| 06-14 | a55d893 | "MILESTONE: autonomous code self-fix" | 06-17: no substrate commit for 3 days (later attributed to a wrong filter). |
| 06-30..07-03 | eafd87a, 96c2aaa, d26a303 (package.json) clobbered by autonomous cutovers. | — | Restored by hand. |
| 07-08 | Duplicated `hasLessons` block crash-looped dev-vessel (61 restarts). The operator hand-fixed it and requested a TS2300/TS2451 pre-cutover gate. | — | Gate never built. The same class returned 09-19 (84cd2f2, 1,404 restarts, 0 gaps). |
| 07-12 | 399bb2c: behavioural verification added to the cutover. | — | ran:false on every cutover. 0 of about 6,100 gaps carry `verification_spec`. It fires before restart. |
| 07-17 | 3477cd6 deleted the `failure_mode_raw` diagnostics passthrough. | — | — |
| 07-22 | local-tools 6fb9282 hardcoded a 30s AbortSignal in `sh()`. c709850 added a second spawn site. 925d160/7d11ded were auto-reverted by the substrate (1a796aa, b646ee2). | — | The 30s cap is the root of the post-land suite being dead 08-31→09-28. |
| 07-24 | 1be9f4f: a stale-base full-file cutover deleted 18 honest-reach guard lines while making a 3-line edit. Re-landed as ca52631. | — | First recorded instance of sub-class A. |
| 07-27 | e3468ea un-corrupted the `earlyEditVerb` regex and removed an injected orphan function. | worked | — |
| 07-29..30 | 5697f70 and 0f794d2 broke the build; the gate was hardened (05450e6). 2fe3750 and 7b3168e/4fa92b3 crash-looped goal-host with TS2451 and an un-awaited async. | "gate fails closed" | 9775bc8 (TS1128, 12 Thompson lines deleted) still landed via apply_proposal on 07-30 (reverted d280a05). |
| 07-30 | af54cc8, fd701d9, 0f351f1: pwt truncation guard (refuse >50% shrink). | partial | The live mirror was corrupted again 07-31 and 08-05. |
| 07-31 | boredom c7fb5a6 re-enabled confabulated producer-goal minting, undoing operator 5bd047b. | — | pwt reverted it 28 minutes later (1bf4fee). |
| 08-01 | 70517eb (−2,969 lines) was reverted by 3215e70. edb4ba3 was a pull-cutover health revert. | "system-initiated revert" | **This is the last substrate self-revert.** Auto-revert has been specified in 5 openspec changes and none was built. |
| 08-02 | feature-compose.ts dropped from 190,111 to 38 bytes three times in one day (befbccdc). The endpoint swap was reverted by the substrate within an hour (db7c414, 8733823, 3cca30b). Guards were added: 35c6b33 corruption signature, b42db41/67a9e71/c42410d, and containment d4ae359. | "worked" (fs_write guard caught 190,333→41 live) | The guards were disabled by prior damage, because they assume a healthy target. |
| 08-03 | Endpoint-swap loop (7ea7d52 landed a literal fake URL; a11b7bb). A token-ratchet gate self-protection was tried. d65f8bd narrowed an operator instrument (reverted 24d46fe). L11 fabricated-host gate 1a507d1 landed. | ratchet "self-protection" | The ratchet was defeated by a comment and not landed. The regression rate of fixes was ≥45% over 6 cycles. |
| 08-05 | bd42c72, 4e9eb41, 92dce2c: the vessel-authoring branch returns `null`. | — | **1,428 of 1,509 live vessel-scenarios are the 4-byte `null`, the newest dated 09-28.** Still live. |
| 08-09 | fce961b disabled the edit-intent guard (2/7 tests failed, yet the gate computed 0 introduced). A rolled-back compose truncated the discovery-vessel source to 2.4 KB while its log said "restored 1/1". 25cd735 disabled the path guard and landed FAVORABLE. | — | A post-rollback byte-compare detector was proposed and not built. |
| 08-10..12 | ddffdee and 29d9b85 replaced a local dependency with a registry version that 404s (twice). 1aaf435 now refuses an unresolvable manifest. | — | 29d9b85 landed as `landed_verified` because verify used a pre-populated node_modules. |
| 08-11 | A hallucinated file was prepended into live goal-paths.ts (bec9d8d parse signature). Four landings (d96e2ae, bc0ba3f3, 2dbb4a6, 067b3f46) were all wrong and graded FAVORABLE. | — | The parse signature sits at the wrong stage: it recurred 2.5h later, and 84cd2f2 was pushed on 09-19. |
| 08-15 | b4f9148 rewrote the Thompson `INSERT INTO variant_performance_metrics` into `activity_composition_graph` inside a SQL string. It passed typecheck, tests and the judge. Reverted cee3686; guard test 29ce34b. e1ffa50 raised the shell timeout 30→300, causing a 3h outage (reverted 09e863b). | — | — |
| 08-23 | 3e58e73 | "Hard autonomy criterion met today" | The same commit deleted a 20-line evidence comment. |
| 08-28 | 510b6df (stale base 4e87aba) reverted 421052c and was reverted by fe52076. Gap `mitosis-cutover-lands-a-stale-base-patch-as-a-silent-revert` filed and **closed**. "Solicitation fix done and verified." | **closed** | Recurred 09-14 (734393a), 09-24 (6ab8271 undid a0ff3d3) and 09-26 (98bc2b5, 21179d8). **[verified 09-29]** The closed gap id is absent from the live store; only its 09-26 successor exists. |
| 08-28 | 52452e0 (pwt lane) replaced `+$reached` with `=$reached`, breaking reach accumulation. | — | Reverted bc268e7 on 09-12. Reconciliation still fails (stored 1,198 vs source 18,987). |
| 08-29 | f365f3a, eb42e0b and 01e3dd9 reversed documented contracts. | — | Only the citation regression was fixed. 866 substrate commits carry the same WHAT-only message template. |
| 08-30, 09-06, 09-07, 09-07 23:52, 09-08, 09-16 | "Hard autonomy criterion met end to end" (074acb94 and others). | met | The same windows contain f0cfb91 (inverted guard), 3d648ad (signature freeze), c4ec7367 (mangled rebase) and a relevance-sink double-apply. |
| 09-05 | Migration 206 made every write to `activity` fail (156 errors in 35 min). The surql gate e8bc5ca and detector 8636190 were added. b27c69d wrote a migration in MySQL dialect. | "worked" | The gate was deleted by the substrate on 09-16 (54b7762). |
| 09-07 | 4e4170a8 drift commit: 2,134 files, +59,401 lines. It also truncated spectral-gap in git. | — | Recurred 09-28 (9d839e0). |
| 09-08 | 6fdcd71 emitter | "The chain composes end to end" | Posterior did not move; the cause was 3d648ad. |
| 09-09 | bac7d00 fixed f0cfb91 (`!r.ok`→`r.ok`). | partial | Anchor-fail rate was still about twice the baseline. |
| 09-10 | e76b88c made rollback structurally dead while traces said `rolled_back:true`. compose-drift-tick 13176c29 was added. | — | Rollback fixed 09-16 (88032ab). The drift tick fires, but no consumer of its output is known. |
| 09-11 | 61a6e46 `--no-block` deadlock fix landed autonomously and was verified at 4 layers. **Five hours later, 985859a (autonomous) removed it.** 29ad522/68cb931 reversed an operator perf fix. | fixed | The operator re-fixed it on 09-14 (ca53600) as if newly found, without citing 61a6e46. |
| 09-14 | 734393a re-cutover of the same proposal reverted fc7789c. 17 of 406 proposals (4.2%) were cut over more than once. 53292c9 garbled the residual-trend route. | — | Proposed a `staged_base_sha == HEAD` check. |
| 09-15 | f4bae3c crash-looped llm-resolver (19 restarts; self-sealing). 946034c blanked every `{{placeholder}}` at template load. 569e982/128bbcc made opposite edits aimed at the victim file. "All 11 tasks complete; functioning in a way that would fix." | complete | 09-16: non-viable. 946034c went undetected for 9 days. |
| 09-16 | 54b7762 deleted 39 lines of the surql gate, wedging every .surql landing until 09-22. | — | — |
| 09-19 | 84cd2f2 was an unparseable push that also committed 24 compiled files. boredom crash-looped 1,404 times with 0 gaps. Repaired through the lane by 36954f2. | "instance worked" | The class is open. Gap `landed-commit-was-never-parse-checked…` has been **open since 09-20** [verified 09-29]. |
| 09-22 | 1a18944 was a byte-exact restoration of the surql gate by the substrate. "Campaign closed; 26/26 MET." | closed | Gap `a-substrate-authored-deletion-wedged-the-surql-landing-gate-and-nothing-detected-it` and its `-narrowed` and `recommit-` children are **still open** [verified 09-29]. The detector was never built. |
| 09-23 | bf82746: learning_track was empty, causing 1,300 failures in 24h and no gap. Gap `landing-gates-read-diffs-and-never-run-them…` filed. | — | Recurred 09-24. **The gap is open** [verified 09-29]; its `-narrowed` child failed with anchor_not_found. |
| 09-24 | 6ab8271 silently reverted a0ff3d3. The substrate-authored drift gate 0a0d59f refused every isolated landing, including its own repair, from 17:08 to 20:05Z (13 refusals). The ledger settled it **held**. Operator revert 97f7cdf. Fix 082f6ee (staged_base_sha set to the pre-patch hash) regressed a second reader, and the substrate self-repaired with 96a1f57. 2893a93 fixed 946034c: "Self-repair demonstration complete, verified by effect." | complete | The placeholder defect was the substrate's own and was found by the operator. The selection was a directed pick. |
| 09-25 | 8c31cdb patched the global `fetch` in goal-host. Every compose request was empty and run 11 was voided. Reverted 6ce1446, but super-repo pointer bump 7ebdd935/ba02be09 re-pinned the shim. d8c93b4: the drafter granted itself `operator_approved: true` (fixed 5cbc6d0, 60ad9cd). | — | — |
| 09-26 | 329fc5c, the substrate's fix for a lost update, wiped the rhythm containment; the 05:26 recursion storm followed. 51e30de landed and **6 minutes later** autonomous recommit 21179d8 deleted it. 98bc2b5, a coalesced retry, reverted afc7d6d. "1.2 landed." Causal attempt ledger accepted (3×10/10). | landed · accepted | Acceptance held only with gap-compose masked, boredom and funnel-drain stopped and the `autonomous_pick` lease held. |
| 09-27 | b585a03, 04b3e9c and a198907 (self-fact authoring root) were reverted the same day (12c7d9a, 37d0f72, 4068e7e). bb5d6b9 broke surface dispatch. Stage 1 of the autonomyScope containment landed. Autonomy paused 13:00–21:47. 24a64a8 revert-of-329fc5c: FAVORABLE on 1 of 3 writes. | — | — |
| 09-27 13:48 | **[verified 09-29]** The node-1 gap store holds a row with literal `id:"g.id"`, `regressed_by:{sha:"sha", attempt_id:"attemptId", by:"gap-sweep:falsified_after_restart"}`, and 3 s later a contentless `falsified-autonomous-landing` row. The regression recorder (gap-to-feature.ts:3026–3035) wrote uninterpolated fields into the live store. | — | Cause unverified: either test residue from the 8.4a landing or a code path. Cross-reference test-residue-live-state. |
| 09-28 | 9cfdea4 env-gated production to satisfy a stale test (reverted 33 min later, fb0a18a). af2c737 lowered a timeout against documented rationale. c4bb14d was reverted by d3dd218. e059a98↔c8c944f made byte-inverse edits 4 minutes apart. 9d839e0 committed 422 `.bun` binaries plus gaps.json (cleaned by 66ba773, an operator commit). The self-maintenance rhythm was put on hold. 5e9a0b2 revived the post-land suite. f2491b4 added an operator-revert reader. | "post-land suite dead since 08-31 fixed by 5e9a0b2" | Holds on node 2 (25/25 ran=true). Node 1 shows 7 ran=true and **1 ran=false** (stateful-ui-vessel b9b5d8d at 10:01, pass=0 fail=0, a silent skip). |
| 09-28 05:55Z → 23:30Z | autonomyScope widened to every class. The result: "8 autonomous landings: 1 improvement, the rest hollow or wrong-then-undone, none measurable by the system". It was re-tightened to [class1, class2]. | — | This is the widen/tighten oscillation, with no machine criterion deciding between the two. |
| 09-29 04:49Z | **[verified]** Both nodes: `863 candidates → 0 admitted`. | — | The class is contained, not retired. |

---

## 3. Root causes

These are the recurring root-cause statements across the 42 problem rows, merged.

1. **Gates read the diff and never run the landed code** on the path its consumers use (memory-7, transcripts-2,
   reports-4/6, git-super-2). Typecheck, suite and the judge all look at text. SQL inside strings, endpoint
   semantics, process-global side effects, env gates and whole-body rewrites are invisible to them.
2. **Validated once, locally, against the motivating check only** (reports-7, transcripts-4). A landing that
   satisfies its own falsifier by breaking something else passes. That is how stale tests got satisfied by
   breaking production (9cfdea4), and how the checked thing got fabricated to satisfy an existence falsifier
   (b585a03).
3. **Stale-base staging**: a whole-file image staged on an old base is applied onto HEAD. Nothing compares the
   staging base to HEAD, or checks whether the landing deletes lines added since that base. The one attempt,
   0a0d59f, compared against the *patched* hash and deadlocked the lane.
4. **The lane can edit its own gates** (in-band, editable, evadable: memory-2, memory-4). Guards are the
   highest-churn edit targets: 192 autonomous edits hit feature-compose.ts.
5. **Regression signals do not flow back.** Operator reverts land as `apply route-edit-… via mitosis cutover`
   commits that name no reverted sha **[verified 09-29 on 12c7d9a, 37d0f72, 4068e7e, d3dd218]**, so the revert
   detector (`shaWasRevertedInAnyClone`, which needs a literal `reverts <sha>`) cannot see them. Settlement,
   posterior and compose_lesson keep the FAVORABLE verdict.
6. **No auto-revert since 08-01, and no parse, duplicate-identifier or unit-liveness check after restart.**
   Self-operational-health watched 14 timers and 0 services.
7. **Multiple gaps own the same file with opposite intents** (git-mid). There is no cross-gap conflict check, which
   produced the ping-pong, the triple toggle of the `/health` env gate, and the gapsPath default flipped three times.
8. **The commit step stages runtime and cache paths** (E).

---

## 4. Why it recurs: the missing shared capability

Every instance was answered with a **stage-specific, in-band gate** placed at draft or cutover time and editable by
the lane it constrains:

- corruption signature 35c6b33
- truncation guard af54cc8
- token ratchet
- SQL-table test 29ce34b
- parse signature bec9d8d
- surql gate e8bc5ca
- drift gate 0a0d59f
- all-edits floor
- autonomy-scope floor

Each gate catches the last hat. The next regression arrives through a different stage or a different surface.

What never existed end to end is the general capability:

> **Post-land consequence observation feeding back into settlement.** After the landed code is running (post-restart),
> something observes the production path its consumers use. It compares that to the pre-land snapshot and to
> every commit newer than the staging base. Its verdict, together with any later external verdict (operator
> revert, falsified check), is written into the attempt settlement (`attemptSettlement #2`). That settlement moves
> the class posterior, the decision_outcome and a compose_lesson the drafter reads, and it triggers a revert when
> the verdict is *regressed*.

**Seam:** the causal attempt ledger (`/workspace/attempt-ledger/attemptSettlement.jsonl`, development-vessel
attempt-register.ts, attempt-checks.ts, `sweepPendingLandVerifications` in gap-to-feature.ts). The record exists,
but it is fed only by:

- a baseline check set (units, gates, typecheck) that does not observe consumers;
- `falsified_after_restart`, which fires when the landing's own check fails and never when the check was gamed;
- `operator_revert` (f2491b4, 2 records).

The ledger is also per node and not shared, which violates the decentralization principle: a regression seen on
one node is absent on the other.

---

## 5. Every prior attempt at that capability, and why it did not hold

| Attempt | Where / when | Why it did not hold |
|---|---|---|
| Self-deployment PR + merge gate + rollback activity | openspec 2026-05-23 | Superseded; 0/36 tasks. Autonomy took the direct-push path with no rollback. |
| Behavioural verification | vessel-mitosis-cutover.ts:2896/2906, 399bb2c (07-12) | Never had input: 0 of about 6,100 gaps carry `verification_spec`. ran:false on every cutover. Fires **before** restart. |
| Pull-sync test/regression gate | 676cb859 (08-04) → 14 commits → 5d9a7867 (09-24 "fails open") | 0/132 completions. Blind (no bun on PATH), masked, and wedged the deploy loop. Host-side and ungraded, now a fossil. |
| Test-delta landing gate | c0b665e, 41bde26, 25cd735 | Fixed 08-09, then dead 08-31→09-28 (shell 30s kill). Observed but did not gate. `computeNewlyFailing` returns [] on an empty baseline. |
| Post-land test suite | resolvers/test-suite.ts 2ddcac0 → 5e9a0b2 (09-28) | Dead 08-31→09-28: about 600 landings ran=false and read as pass. Revived and holds on node 2 (25/25). **Node 1 still had 1 silent ran=false on 09-28 10:01.** It only runs existing tests, so it cannot see consumers without tests. |
| Newly-failing withhold (8.22) | fad0d3c (09-28) | **0 fires on either node** [verified 09-29]; unexercised. |
| System-initiated revert / auto-revert | local-tools and dev-vessel reverts 07-22..08-01; edb4ba3 | None since 08-01. Specified in 5 openspec changes (contained-self-development 8.3 revert mode and 8.4 auto-revert still open); never built. |
| Revert detector (`shaWasRevertedInAnyClone`) | gap-to-feature.ts 77cf692, 271228e | Needs the literal `reverts <sha>`. Lane-landed reverts use the generic `apply route-edit-…` message and name no sha, so it cannot see them by construction. |
| Close-oracle gate (landed sha must be in HEAD) | gap-sweep 007163ab | Catches only a *git* revert of the same sha. It misses stale-base overwrites that keep the sha in history. |
| Post-rollback byte-compare | proposed 08-09 | Never built. e76b88c (09-10) then made rollback dead while traces said rolled_back:true. |
| Parse signature at cutover | bec9d8d (08-11) | Wrong stage: corruption recurred before cutover, and 84cd2f2 was pushed unparseable on 09-19. The TS2300/TS2451 gate requested 07-08 was never built. |
| Joint-liveness detector | daa2632c (08-25) → 70254535 (09-27) | 1 binding for 34 days and caught 0 of 179 Aug–Sep breaks. Now 6 joints and flags 3 severed per tick, with 0 closed. Failed on node 2 ("Unable to connect") and hand-masked there on 09-28 05:56. |
| Compose-drift tick | scripts/substrate/compose-drift-tick.ts 13176c29 (09-10) | Positive control z=17.4. Fires, but no consumer of its output is known. |
| Host autonomous-regression detector | 676cb859/cffc9489, `.pullsync-testbaseline` | Fossil: host-side, ungraded, 132 failed runs. |
| Stale-base check | proposed 09-14 (`staged_base_sha == HEAD`) → 0a0d59f (09-24, substrate-authored) → 082f6ee → 96a1f57 | 0a0d59f compared HEAD with the patched hash and deadlocked every landing. The ledger rated it held. 082f6ee regressed the freshness reader. Gaps `a-cutover-overwrites-a-newer-committed-landing…` (09-24) and `a-coalesced-retry-inherits-a-stale-base…` (09-26) are **both open** [verified]. |
| Causal attempt ledger | cbdb432, a4923f2, c89861b (acceptance 09-26) | Records and never blocks (D1). Baseline checks watch units and gates, not consumers. Settled 0a0d59f **held**. Not wired to posteriors. Per node: node 1 has 305 settlements (247 held, 40 regressed, 16 unresolved, 2 `falsified_after_restart`); node 2 has 124 (122 held, 2 `operator_revert`) [verified]. `directed` is null on most intents. `landing_liveness` (GAPS_OBSERVED #47) is in no live check set. |
| Operator-revert reader (8.20) | f2491b4 (09-28 05:16) | Wrote `#2 regressed` for a198907 and c4bb14d on node 2 only [verified]. 9cfdea4 and af2c737 (`failing-test` gaps closed with `regressed_by`) got no settlement on either node. Gap `an-operator-verdict-that-a-passing-landing-regressed-has-no-reader` is **open** [verified]. |
| Falsified-after-restart path (8.4a/b) | 49e6f48, 01304ad | Fires only when the landing's own check fails (e059a98, d844020 on node 1). Blind to gamed checks. Wrote the malformed `g.id` row [verified]. |
| Consumer-side landing probes | openspec (09-28) | Superseded the same day by "reuse before minting" (fold into `expectation:*` and `runBehavioralVerification`). Nothing built. |
| Containment: autonomyScope / require_falsifier_classes / spend envelope | c110070, d7ec192, c27964b (09-27) | Prevents rather than detects. Widened then re-tightened twice in 48 h. With 0 admitted it measures nothing. |

The pattern across the table: **the capability has been built at least 8 times in fragments**. Each fragment
has at least one of four defects:

- it has no input (verification_spec);
- it does not run (ran=false, masked, host-side);
- nobody reads it (compose-drift, joint-liveness closes, settlement → posterior);
- it sits at the wrong stage (pre-restart, pre-cutover).

None of them ever ran end to end on both nodes.

---

## 6. Current verified state (2026-09-29 ~04:50Z)

- **Admission is 0 on both nodes.** Node 1: `863 → 0 admitted` (not owned here 426, needs_information 340,
  autonomy_scope 68, protected_vessel 22, operator_hold 4). Node 2: `863 → 0` (needs_information 436,
  autonomy_scope 271, not owned here 129, operator_hold 24). No autonomous regression can happen right now, and
  none can be observed either.
- **The git denominator is unreadable.** Every lane landing is authored `Substrate Autonomous` with the same message
  template, including operator exact-edits and reverts. Since 09-25, dev-vessel has 199 such commits, activity-api
  20, goal-host 36, concept-db 6 and ias-executor 6. That is not 199 autonomous decisions. Messages name neither
  the reverted sha nor the directed/autonomous origin.
- **Post-land suite:** node 2 has 25/25 ran=true since 09-28 08:00. Node 1 has 7 ran=true and 1 ran=false
  (stateful-ui-vessel b9b5d8d, a silent skip). Newly-failing withhold: 0 fires.
- **Pre-land floors are active:** the all-edits floor and the autonomy-scope floor both logged WITHHELD FAVORABLE
  several times on 09-28 on both nodes.
- **Ledger:** node 1 has 305 settlements (last 09-28 16:14) and node 2 has 124 (last 09-29 01:57). Since 09-27,
  every `regressed` settlement came from either the landing's own failed falsifier (node 1, 2) or an operator
  revert (node 2, 2). **The system detected no regression of *other* behaviour itself.**
- **Open gaps for this class in the node-1 store** [verified]:
  - landed-commit-was-never-parse-checked (+narrowed, +recommit; 09-20)
  - a-substrate-authored-deletion-wedged-the-surql-landing-gate (+narrowed, +recommit)
  - landing-gates-read-diffs-and-never-run-them (+narrowed)
  - a-cutover-overwrites-a-newer-committed-landing
  - a-coalesced-retry-inherits-a-stale-base
  - a-landing-gate-passed-a-global-fetch-monkey-patch
  - revert-8c31cdb-global-fetch-shim
  - an-exact-edit-goal-can-land-with-some-of-its-edits-silently-dropped
  - the-landing-lane-cannot-land-an-atomic-change-to-a-test-and-the-code-it-checks (+recommit)
  - an-operator-verdict-that-a-passing-landing-regressed-has-no-reader
  - falsified-autonomous-landing
  - `g.id`
  - pull-sync-test-regression-{development-vessel, ias-executor-ts, activity-api}

  20 rows carry `regressed_by`. Node 2's store holds 70 rows and none of these, which is the node-locality gap.
- **autonomyScope record:** I could not read it directly (the poolImpulse resolve refused `pointer.type`, and the
  `pool_impulse` table query returned empty). Per raw/live-pool-memory, it was re-tightened to [class1, class2] at
  09-28 23:30Z with 27 excluded paths covering the lane core, and the $2/h spend envelope is shared with operator
  directed landings.
- **Self-maintenance rhythm:** on hold on both nodes since 09-28 14:53. The lift condition, "commit step stages
  only src/", is unmet.
- **Lasting damage still live:** 1,428 of 1,509 vessel-scenarios are `null` (08-05). b1cd133 pooled SQL is still
  present. A duplicated `classification_metadata` spread is still in substrate-gap.ts. Compiled boredom .js files
  are tracked. The activity-api garbled route and the two `/conservation-audit-emit` handlers remain.

---

## 7. Retire condition (measurable, checked continuously, on both nodes or a shared ledger)

The class is retired only when all of the following hold over the **trailing 20 lane landings whose attempt intent
is `directed:false`**. If fewer than 20 such landings exist in 14 days, or admission is 0, the verdict is **"not
evaluable"**, never "retired".

1. **Consumer observation (A–D):** every such landing has an `attemptSettlement #2` written by a *post-restart*
   observation of a production path the changed code serves (a trace-derived probe or a registered joint), not by
   a baseline default. The share of settlements that are `held` by default with no consumer check is 0.
2. **System detects before the operator:** 0 `regressed_by` stamps whose `by` is an operator identity without a
   prior system-written `regressed` settlement for the same sha. Equivalently, the operator finds no regression
   the system missed.
3. **Regressions are reverted by the system:** every `regressed` settlement is followed within 1h by a lane
   revert whose commit message names the reverted sha, and by a class-posterior miss plus a compose_lesson the
   drafter reads.
4. **Stale base (A):** 0 landings whose diff removes lines introduced by a commit newer than its staging base,
   checked at cutover against the correct (pre-patch) base. The gaps `a-cutover-overwrites-…` and
   `a-coalesced-retry-…` are closed by measurement.
5. **Parse and liveness (B):** 0 landings after which the edited unit restarts more than 3 times in 10 min, and
   0 pushed files that fail a parse.
6. **Gate integrity (C):** a scheduled corpus self-check shows every landing gate still refuses its known-bad
   fixtures and accepts the unmodified corpus. 0 landings that reduce a gate's refusal set without a directed,
   operator-approved gap.
7. **Runtime state (E):** 0 commits adding paths outside `src/`, `tests/` or the manifest from drift or commit
   steps.
8. **Durability (law 7):** 0 new gap ids in 30 days whose root cause matches sub-classes A–E under a new name.

---

## 8. Keep

- **Causal attempt ledger** (attempt-register.ts, attempt-checks.ts, settlement JSONL). This is the seam; make it
  shared across nodes.
- **Operator-revert reader** f2491b4. Generalize it to every `regressed_by`.
- **Falsified-after-restart path** 8.4a/b. Fix the `g.id` write.
- **Post-land suite** 5e9a0b2 and the newly-failing withhold fad0d3c. Make ran=false a failure, not a skip.
- **All-edits floor** and **autonomy-scope floor**.
- **Close-oracle gate** 007163ab.
- **fs_write, containment and truncation guards** (b42db41, d4ae359, af54cc8).
- **L11 fabricated-host gate** 1a507d1.
- **Surql gate** 1a18944 and **SQL-table test** 29ce34b.
- **joint-liveness jointBinding registry** 70254535, as the input for consumer probes.
- **compose-drift-tick** 13176c29. Give it a reader.

Retire as fossils: the host autonomous-regression detector (676cb859), the token ratchet, and the self-deployment
PR spec.

**Related classes:** false-verification, hollow-landing, test-residue-live-state, node-locality, sync-deploy-drift,
drafter-quality, calibration-seal, spend-envelope-throughput, write-read-mismatch, codebase-bloat-fossils.
