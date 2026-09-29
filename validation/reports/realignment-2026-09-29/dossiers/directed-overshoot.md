# Dossier: directed-overshoot

**Class:** a change the *operator* made or dictated reaches its target and damages something next to it. It covers
hand commits, operator-bypass landings, directed goals with the edit spelled out, operator-authored spec tasks,
containment rules and unit or env edits. The damage takes several forms. The change fixes one junction of a
multi-site class and breaks a sibling or a consumer. It is validated on one host or tree and then deployed fleet-wide.
It silently undoes autonomous work. It reverts a *correct* landing on inference. Or it starts a same-day chain of
corrections, each one fixing the last one's overshoot. The class is the operator-side mirror of `autonomous-regression`.
The 09-28 break census says so directly: *"operator changes are not safer by construction; they are validated locally too."*

**Sources:** `classes/directed-overshoot.json` (51 attempt rows, 24 problem rows, 8 claims), `raw/git-devvessel-2.md`
(§directed-overshoot), `raw/git-small.md`, `raw/live-resolvers.md`, `raw/vessel-docs-tooling.md`, `raw/live-gaps.md`,
`raw/memory-3.md`, `raw/transcripts-4.md`, `classes/_principles.json`, `classes/_mech_chunks/*.json`, and
`validation/reports/self-development-program-2026-09-25/WHY-THINGS-KEEP-BREAKING-2026-09-28.md` (`2ca586ba`, category F).
I ran the live checks read-only on 2026-09-29 between 04:55Z and 05:10Z on both nodes (`substrate-live` = node 1, `compose2-live` =
node 2). Findings marked **[verified 09-29]** are mine. Everything else is cited from the collector records.

**Counting note.** Do not sum the `recurrences` fields. Two rows (4,560 and 5,240) are journal-line counts of *one* instance,
the ribosome register 400. Deduplicated, the class names about **45 distinct operator or directed commits**, plus **6 same-day
correction series**, dated 2026-04-30 (first operator reversal in activity-api history, git-activityapi) to 2026-09-29
(ribosome still refused at 04:56Z today). The independent census `2ca586ba` counts **28 category-F cases (7 Jan–Jul, 21
Aug–Sep)** with a detection median of *hours*. A joint-liveness check would catch only ~36% of them (~54% counting partial catches), the lowest of any category except A.

---

## 1. Sub-classes

The rows collapse into seven mechanically different sub-classes. Each has its own retire clause in §7.

| # | Sub-class | Representative instances |
|---|---|---|
| A | **One junction fixed; siblings and consumers not enumerated** | discovery `7cc9da4` rejects `shapes:[]` that ribosome sends by design (09-19→now) · `asResolvePath` fix overshot into an invalid URL at 5+7 call sites (09-20→09-28, 4 gap "hats") · unconditional `bun install` pruned the shared node_modules (f38f1a3, 08-10) · ExecCondition quote escape disabled every keyless arm (08-20) · boredom `4e17f86` guard on a door nothing walks through (09-05) |
| B | **Validated on one host or tree, deployed fleet-wide** | SurrealDB cap 22/26G→10/12G sized on a 60.6G workstation OOM-killed the 32.8G hub (e2ba1a69→9df01220, 08-17) · 300s migration timeout kept hub activity-api down (c0246f7→8fbc032, 08-03) · hand-staged `substrate-pull-sync.sh` wedged node 2's own delivery (09-28 07:27→08:11) |
| C | **Operator reverts a correct landing on inference** | local-tools `e1ffa50` 30s→300s shell fix reverted by `a699887` with no reason (08-15), re-derived as `e4d604c` 14 days later; meanwhile the 30s default killed the post-land suite 08-31→09-28 · activity-api `b8671c9` reverted by `23abbf4` and reapplied `89f04fb` within an hour (09-28). The pre-validation used root credentials, which bypass PERMISSIONS |
| D | **A "one-flag" or "logging-only" commit silently undoes N autonomous landings** | `ca53600` (09-14): message says `--no-block`, diff is +30/−122 and undoes 12 landings, including the 8-hex `gapClassKey` normalisation · `5598853` (09-15): "behaviour is unchanged", diff +40/−63 undoes 7 landings (RETRY CONTEXT, directed verdict, recommit-depth, test-target grounding) |
| E | **Correction chains and oscillation on one seam** | federation, 7 commits in one day (08-18) · compose-lessons, 5 commits (08-10) · llm_completion advertisement policy 9c17905 (07-17) vs 1f14a69 (07-19) vs 3ea2136 (08-18) · auto-promote flip-flop 2dc56ed5→99a30d12→4d0c305e→93a6cb42 (05-27/28) · **goal-host, 19 operator-bypass commits on 09-22 whose subjects cite their predecessors' overshoot** [verified 09-29] · region gate 973b7f6/6712946/4645bf8/a71e9a8 |
| F | **A directed edit lands in the wrong place or trades away a sibling, with `reached:true`** | `c9faf50d` (08-10) landed in `verifyRegistryInventoryReach` with inverted polarity; 7/7 registry-token goals regressed; never reverted · `0d86170` (09-18) FAVORABLE but traded away `mul`'s deterministic oracle; restored by the operator in `51b34a6` · directed rollback deletes an existing file (07-03) |
| G | **An operator-authored spec or containment rule overshoots the flow it governs** | 5.4 pre-patch base `082f6ee` (09-24) silently dropped 7 directed landings as `already_applied` · class1/class2 containment collapsed admissible supply from ~250 to 2–5 (09-27/28) · `COMPOSE_MAX_CONCURRENT=0` kill switch halted only the operator lane (08-12) · drain floor for lesson goals beta-poisoned the slots (fd5dff4, 07-30) · the approval prompt told the drafter to set `operator_approved` itself, and it did (`d8c93b4`, 09-25) |

---

## 2. Dated timeline

Every claim that the class, or an instance of it, was fixed is included, with what later showed.

| Date | Event | Claimed | What later showed |
|---|---|---|---|
| 04-30 | First dated operator reversal in activity-api history (git-activityapi problem row, 7 recurrences through 09-28). | — | Pattern: satellite strip, index drop, batch=1, 300s timeout, 3d half-life, and the 09-28 wrong revert. |
| 05-26 | `6c3448e` reachable_unlearned_probe, reverted `9e99f11`. | — | A fossil. It opens git-devvessel-1's run of 10 reverted or oscillating operator fixes (05-26→08-11). |
| 05-27..28 | Auto-promote: operator gate removed (`2dc56ed5`), reverted for F-144 fabricated authorization (`99a30d12`), "operator-authorized" (`4d0c305e`), then the revert was itself reverted (`93a6cb42`). Duplicate "authorize S2 lift" commits `ce457fdd`/`4c60b0a1`. | "authorized" | Authority changed from session chat with no verifiable authorization. |
| 06-04 | scenario_id mitosis dirs `9fcc87b4` → `486918b6`. | — | Reverted within hours. |
| 06-20 | `6f5e1bdd` drops operator gates. Self-recovery reverts vessels to host source via `docker cp`. | — | Makes the host the source authority (a law-11 risk). Bounded later (`ad9da780`, 09-16). |
| 06-22 | Compose-topology 4-min timer `06c48140` → `f1348751`. | — | Reverted the same day with **no reason in the body**. |
| 07-03 | Directed edit lands in the wrong function; rollback treats overwrite as create and deletes an existing file (validation-other-1). | — | Recurs 08-10 (c9faf50d). |
| 07-15..19 | llm_completion de-advertise when quota-less (07-15). This deadlocked the completion plane for hours on 07-18. `9c17905` then advertised unconditionally, and `1f14a69` brought quota-gating back two days later. | — | 08-18 `3ea2136` "refusal closes the gate". Three opposite policies in five weeks. |
| 07-25 | Unconditional LLM retry wrapper `0b0e273` turned slow calls into a retry storm. `b013f30` now retries fast failures only. | worked | Kept. |
| 07-29..08-22 | 12 operator commits to glue and units regress (`86491fec`…`c47f3843`). `f212b93c`: *"six of the findings are damage the round-1 fixes did"*. `940dbfb7` hung every shell call for ~3h. `c47f3843` did not contain the claimed change. | round-1 "fixes" | 28 category-F cases counted in `2ca586ba`. |
| 07-30 | Lesson goals floored on the drain priority (`fd5dff4`) → `d34d295`, `3edd14d`. | — | Hollow goals won selection at 3× and beta-poisoned the scarce slots. |
| 08-03 | activity-api `c0246f7` raises the migration timeout to 300s. | — | Hub activity-api never became active. Revert `8fbc032` did not converge while the vessel was down. |
| 08-07 | Region containment gate `973b7f6` → `e04764c`. | — | It rejected the only correct fix twice and admitted two wrong patches. Widened one hop; `suspected_real_location` write removed. |
| 08-08 | Satellite reach-verdict strip `d95a615` → `3e7e8e0`. | — | Would have destroyed the most independent reach verdict. The real defect was N-fold counting. |
| 08-09..10 | Last-resort guard `272edbd` refused an unwilling default. `04b2e8f` superseded it. | — | It blackholed a live plane while a pinned gemini model answered first try. |
| 08-10 | Compose-lessons: 5 commits in one day (`89a7f31`, `90c585f`, `d274763`, `8236895`, `6137257`). Unconditional `bun install` in compose verify: `f38f1a3` (reverted `b90d6c4`), relanded by the substrate as `0797af4` (reverted `49f4c06`). Directed Repair B `c9faf50d`. | `c9faf50d` "makes 'src/foo' goals claim" | Install pruned the shared node_modules and every compose broke; it was read for hours as drafter hallucination, and after the revert the gap landed `2156d21` in 9 min. `c9faf50d` landed in the wrong function with inverted polarity; 7/7 registry-token goals regressed; **no gap filed, not reverted**. |
| 08-11 | goal-host `dd1195b` exclusion filter → reverted `88b212a`. `fcd667b` operatorOrigin → the substrate fixed it (`db21c5fa`, first try). | — | The filter turned ambiguous localization into a unique wrong one, and its test added phantom candidates. |
| 08-12 | Kill switch `COMPOSE_MAX_CONCURRENT=0` (99-emergency-compose-halt.conf). | "halt" | Halted the operator lane while autonomous work kept a slot. Validation had tested one lane only. |
| 08-15 | local-tools `a699887` reverts the substrate's correct 30s→300s shell fix `e1ffa50` with **no recorded reason**. `web_search` added to UNIVERSAL_READ_TOOLS (7 attempts). | — | 14 days of verify killed; re-derived as `e4d604c` (08-29). The 30s default later killed the post-land suite 08-31→09-28 (fixed `5e9a0b2`). web_search duplicated an existing producer (law 3) and enabled a zero-tool fabricated reach. |
| 08-16 | Io chain decision rules (host ban, 4xx classifier, inspection credit, 600-char window…). | — | Operator ledger: 0/8–0/10 on rules vs 6/6 on evidence. |
| 08-17 | SurrealDB MemoryHigh/Max 22/26G → 10/12G fleet-wide (`e2ba1a69`). | — | pull-sync converged it onto the 32.8G hub and the kernel OOM-killed production ("the cap WAS the OOM"). Reverted `9df01220`. |
| 08-18 | Federation: 7 successive corrections (`afde30b`, `4a57cfa`, `79b0b9c` "one arm per peer was an over-correction", `01ab865`, `659cb35`, `c35af84`, `2371bb2`). | — | Federation code untouched since (git-devvessel-2). |
| 08-20 | ExecCondition key guard with a bash `'"'"'` escape. | — | systemd is not a shell, so no arm ran on any host and the skip was invisible. Replaced by `[^=]*[A-Za-z0-9]`, verified through real systemd. |
| 08-22 | org_id widening lost in refactor `baca870` → restored `3fb33b6`. | worked | The posterior lookup had matched zero rows. |
| 08-30..31 | Closure predicate at birth `be26a6b`+`196e755` → `8a5223c`. Prefer line-addressed edits `fee458e` → `91b11fe`. `ee6312c` numbered gutter. | 05:33 `ee6312c` "fixes repair" | The predicate manufactured re-lands. apply_failed rose 0%→66%. 05:54: `ee6312c` a silent no-op (the consumer reads only `old_string`), replaced by `4841fb3`. |
| 09-04 | Claim at 08:30 that an in-flight defect was caught (3637e240). | "caught before it landed" | 09:08: `e96015c` had already landed and deployed as a permanent off-switch. |
| 09-05 | boredom `4e17f86` by-id posterior guard, control-matrix-tested. | tested | Logged 0 times in 6h; trace rows kept rising 2338→2340. The real seam is `dispatchTargetTemplateId` (ias-executor goal-host.ts:~897). |
| 09-14 | **`ca53600`** "`--no-block`" is +30/−122 on substrate-gap.ts and undoes 12 autonomous landings. | one flag | **The 8-hex `gapClassKey` rule was never relanded** [verified 09-29 below]. |
| 09-15 | **`5598853`** "log inside the grounding catch… behaviour is unchanged" is +40/−63 and undoes 7 landings. | "unchanged" | False at the diff level. |
| 09-18 | Directed gap with a dictated diff → substrate `0d86170` (tokenTruth for pow/rev). | "landed and pushed, tokenTruth present" | 15:19: it traded away `mul`'s deterministic oracle; operator restored `51b34a6`. |
| 09-19 | **discovery `7cc9da4`** (operator) validates register payloads, including `shapes must be a non-empty array`, to satisfy security-audit tests. | "register payloads validated" | ribosome registers `shapes: []` by design (index.ts:697). **400 every minute since**: 5,208/7d (git-small), 5,240 since journal start 09-25 13:11 (vessel-docs-tooling), **297 on node 1 since 09-29 00:00Z** [verified]. |
| 09-20→22 | `asresolvepath-discards…` closed `landed_verified` 09-20 02:05. On 09-22 the fix was found to have overshot: `asResolvePath` returns an absolute URL and 5+ call sites still prepend `endpoint`, giving `new URL()` throws and "no producer". | "landed_verified" | Became `rawresolve-concatenates…` (09-22 07:03) → `seven-more-resolve-url-sites…` (09-22 07:15) → 3 recommit gaps + 3 steps (09-28) → `resolve-url-walk-path-sites-7457-15128` (09-28). Four "hats". |
| 09-22 | **goal-host: 19 operator-bypass commits in one day** (`ecd077e` 06:02 → `875e137` 21:56) [verified]. The subjects cite predecessors: `a410572` "my cc8c3cd let derivation-split…", `a5e8595` "prior remap over-applied", `ecd077e` "our 3d4aa60 left TS18046", `3bd2a46` "drop the conciseness cap that manufactured hollow verdicts" (the cap was an operator edit injected into running code, reports-1). | each "fix" | The chain shape of the 08-18 federation series, a month later. 7 goal-host commits are counted in `unaccounted-landings-goal-host-vessel` and nothing evaluated them. |
| 09-22..23 | gap-to-feature directed flag `5ec4719` fails behavioural verification; the one-op redesign `112e194` lands via mitosis cutover. | measured | Works: directed POST at 1-in-flight admitted. |
| 09-24 | Operator spec 5.4 pre-patch staged base `082f6ee`. `0a0d59f` drift gate (autonomous) refused every landing; operator revert `97f7cdf` 20:05. | 23:54Z "5.4 falsifier MET" | 7 directed landings silently dropped as `already_applied` 20:48–21:50. The substrate self-repaired with `96a1f57` at 21:52. One field carried two meanings. |
| 09-25 | `d8c93b4` forged `operator_approved: true`. | — | Root cause: the operator-authored approval prompt told the drafter to set it. Fixed by `5cbc6d0` (prompt), `60ad9cd`, and `aaee500` (deletion ops); 0 occurrences live. |
| 09-27..28 | Containment rules (falsifier class required, class2-only, operator_hold, suspected-location). | 09-28 01:32 "keep autonomy safe" | Admissible supply ~250 → 17 → 2. 05:43: *"The supply collapse, which is mine"*. Relaxed 06:11, re-tightened 23:30 to 7 gaps. |
| 09-28 03:24 | Gap `an-operator-verdict-that-a-passing-landing-regressed-has-no-reader` filed (human_reported, `operator_hold`, `falsifier:none`). | — | See the next row. |
| 09-28 05:16 | `f2491b4` (substrate-authored) `recordOperatorRegression`: an operator `regressed_by`+`revert_sha`+`attempt_id` on a gap writes a `#2 regressed` settlement, a class-posterior miss, an UNFAVORABLE decision outcome and an `attempt_consequence` lesson. | — | **Fired twice on node 2** at 05:18 (a198907, c4bb14d); 0 on node 1 [verified]. The gap is still `open`. The reader only covers *autonomous* landings the operator reverted **and hand-annotated**. |
| 09-28 06:59–07:00 | Operator `23abbf4` reverts the correct autonomous `b8671c9`, citing 08-21 PERMISSIONS evidence; `89f04fb` reapplies it: *"my revert 23abbf4 was wrong"*. | — | Pre-validation used root credentials. **The ledger saw one pull-sync hop, `b8671c9→89f04fb`, with `execution_id:null`**, so the wrong revert never existed to any learning surface [verified]. |
| 09-28 06:11 | Joint-liveness detector extended; files `severed-joint-ribosome-registered`. | — | Open, `reopen_count 2`, `falsifier:none`, no `edit_site`, so the compose lane cannot admit it [verified]. |
| 09-28 07:27 | Operator hand-staged `substrate-pull-sync.sh` on node 2 before it reached origin. | — | "ff-only pull FAILED — glue layer stays at 6f329e2e"; cleared 08:11. |
| 09-28 03:15 | concept-db `d4eee29` (operator) restores the 30s resolve timeout after autonomous `af2c737` lowered it to match a stale test. | worked | Kept. The autonomous twin is in `autonomous-regression`. |
| 09-28 12:59–15:25 | Operator-scoped `resolve-url-walk-path-sites-7457-15128` → `5ca51be` lands; closed on the system's own measurement. | closed | Two walk-path sites fixed. **The parent and 3 recommit gaps are still open; 7 concatenation sites remain on both nodes** [verified]. |
| 09-29 04:56Z | ribosome `register failed: 400 — vessel will be unreachable via discovery`, once a minute. | — | Ongoing, 10 days after `7cc9da4`. |

---

## 3. Root causes

1. **Validated locally and once, against the motivating check.** This is the census root cause (`2ca586ba`), and it applies to
   operator changes unchanged. 7cc9da4 was validated against security-audit tests, not against the fleet's registrants.
   The SurrealDB cap was validated on a 60.6G workstation. The 300s timeout was validated on a spoke without the hub's data. The kill switch was validated on one lane.
2. **Sibling sites and consumers are not enumerated before landing.** asResolvePath (4 hats), ribosome `shapes:[]`, the shared
   node_modules, the ExecCondition parser and the boredom guard door are all the same defect: the change was checked at the junction it repaired
   and nowhere else. `_principles.json` states this four separate times (memory-10, git-mid, reports-3, memory-8). It is a lesson that exists and has no runtime reader.
3. **Inference over measurement, and the wrong credentials.** The 23abbf4 revert, the Io decision rules (0/8 vs 6/6), the satellite
   strip and the 3637e240 "caught it" claim were all acted on from a causal story. Root-credential pre-validation cannot see what a PERMISSIONS-bound service sees.
4. **Commit messages understate diffs.** `ca53600` (5× understatement) and `5598853` ("behaviour unchanged") passed because nothing
   compares an operator diff to the landings it touches. The inverse detector that found them was a collector's analysis, not a live mechanism.
5. **Operator changes bypass the attempt path.** They arrive by host push plus pull-sync, by in-container `git commit`, or by
   `SUBSTRATE_ALLOW_DIRECT_EDIT=1`. None of these registers an attempt intent, a falsifier or a settlement. A revert with no stated reason (a699887, f1348751) teaches nothing and invites re-derivation (e4d604c, 14 days later).
6. **Rules encode the last symptom.** Containment, region gate, drain floor, kill switch, last-resort guard, llm advertisement:
   each guard was sized to the incident that motivated it, with no pre-registered prediction of its effect on the flow it throttles (supply, landings, availability).

---

## 4. Why it recurs: the missing shared capability

The same generator produces every row. **There is no author-agnostic landing seam.** Autonomous landings pass through
feature_compose → mitosis cutover → attempt ledger → settle sweep, and that path at least records intent, snapshots and
settlement. Operator and directed changes arrive beside it. Even the autonomous path only checks the change against its own
motivating predicate. Nothing at any landing:

- (a) **requires a pre-registered, consumer-side falsifier** before the ref moves;
- (b) **enumerates the blast radius** (sibling call sites of the changed pattern, registered consumers of the changed
  contract, the hosts and profiles the file deploys to) and runs a probe on each;
- (c) **settles on live consequence and writes back.** Any revert, by anyone, should become a settlement, a posterior
  miss and a lesson at the edit site, with a mandatory reason. An operator's own wrong revert should be graded the same way.

The census names this seam and ranks it: *"Landing gate on registered joints — a staged change must not silence or corrupt a
registered joint; aimed at A and F"* (`2ca586ba`, implication 3). The user's operating model (09-29) names the failure
mode behind the missing seam: *"we overly build specific paths rather than general tools"*. Every attempt listed in §5
is a specific path, validated against its own motivating check, and so each inherits root cause 1.

**Shared capability:** a *landing consequence gate + settlement* at the one seam every ref update already crosses: the
`landingEvent` spool (`/workspace/attempt-ledger/spool`, `ref_update` records written by pull-sync and cutover). Every dev-branch
ref move, whatever its author, would get: an attempt record (synthesised for operator commits from the commit plus a mandatory
falsifier trailer); a sibling and consumer enumeration from the joint registry (`joint-liveness-tick.ts`) and a pattern grep;
a post-land consumer probe on every node the file deploys to; and a settlement that feeds `recordOperatorRegression`'s writers
(settlement, class posterior, decision outcome, compose_lesson) for reverts in *either* direction. It extends existing pieces.
It needs no new mint (law 3).

---

## 5. Every prior attempt at that capability, and why it did not hold

| Attempt | Where / when | What it covers | Why it did not hold |
|---|---|---|---|
| Openspec `2026-05-23-substrate-self-deployment` (PR + merge gate + rollback activity) | openspec, 05-23 | A single gated landing path | 0/36 tasks; `gitMergePR` absent. Autonomy was built as direct push to dev instead, and operator pushes were never in scope. |
| Auto-revert | Specified in 5 openspec changes | Revert on consequence | Never built. The last system self-revert was 08-01 (`3215e70`). A fossil (mech 33). |
| PreToolUse `substrate-vessel-edit-gate.sh` + `intervention_evaluate` S3 push-away | .claude/hooks; dev-vessel intervention-evaluate.ts | Operator Write/Edit on `repos/*/src` | Fails open when goal-host is down. The env bypass (`SUBSTRATE_ALLOW_DIRECT_EDIT=1`) was used for 19 goal-host commits on 09-22 alone. It never sees Bash, sed, in-container edits, units, env or SQL. The DB has no intervention/push-away table and dev-vessel logged 0 `intervention_evaluate` lines in 7 days [verified]. That is **unattributed**: the resolver may not log, so it proves no refusals, not a dead resolver. |
| Causal attempt ledger | dev-vessel attempt-register.ts `cbdb432`, attempt-checks `a4923f2` | Intent, snapshots and settlement per autonomous attempt | Accepted 3×10/10 on 09-26, but only with every other path held quiet. It is per node. Operator commits have no intent. Its baseline checks miss most regressions: it settled `0a0d59f` "held" while that gate blocked every landing. The `b8671c9→23abbf4→89f04fb` sequence is one hop with `execution_id:null` [verified]. |
| Unaccounted-landing scan | `eccd6d9` (09-23), per-repo fold `617b12a`/`b6f0d14`, linear `429c8bd` | Detects landings with no attempt, operator commits included | Counts, never evaluates. It flooded (469 opened / 36 closed in 24h), then was aggregated. 13 aggregates are open and none has closed. `unaccounted-landings-activity-api` has not advanced since **09-25 08:55** although 4 operator commits landed there on 09-28 (`1f0d70f`, `d98309e`, `23abbf4`, `89f04fb`) [verified]. It also carries 158 probe-repo commits. |
| Revert-aware history check / close-oracle gate | gap-to-feature `shaWasRevertedInAnyClone` (`77cf692`, `271228e`); `007163ab` | Treats a reverted sha as not landed | Needs a conventional `This reverts commit` line (mech 08: "operator reverts lacked it"). It says nothing about *why* and covers only one direction. |
| Operator-regression reader | `f2491b4` (09-28 05:16, substrate-authored) | Operator revert of an autonomous landing → settlement, posterior, decision outcome, lesson | Real and firing: 2 on node 2 [verified]. It needs a hand-written `regressed_by{attempt_id,revert_sha}` on a gap, only covers autonomous-then-operator-reverted, and only runs on the node that registered the attempt. The operator's own wrong revert (23abbf4) and operator overshoots (7cc9da4, ca53600) have no reader. The parent gap is still open. |
| Joint-liveness detector | `scripts/substrate/joint-liveness-tick.ts` (`daa2632c`, 08-25) | Writer→reader joints going quiet | One binding from 08-25 to 09-28 (census: "caught none of the Aug–Sep breaks"). Extended 09-28. It now sees this class's live instance (`severed-joint-ribosome-registered`, reopen_count 2), but files it with `falsifier:none` and no `edit_site`, so it is **inadmissible** to the lane that could repair it [verified]. It detects after the fact and gates nothing. |
| Isolated verification runner | `scripts/substrate/run-isolated-verification.sh` | Run a change's tests off-live | Validated 09-14, but **untracked in git** (`??` in status) and not referenced from development-vessel src [verified]. Dormant. |
| Consequence-verdict-into-credit | openspec-6 `2026-08-26-consequence-verdict-into-credit` | Reward revisable along stayed/exercised/reverted/recurred | Dormant. `posterior-update.ts` has no temporal or consequence path (mech 16). |
| Pre-registration protocol and external-oracle harnesses | validation/reports/jev-one-goal-probe; validation/scripts (falsification, validatability, stage-harness…) | Pre-registered falsifiers, single-variable changes | Operator discipline only. Nothing schedules them, and ports are hardcoded (mech 20). failure-mode-harness crashes on 118/125 scenarios. Where they were followed (jev probes 7/7) they held, and the protocol is not enforced at any landing. |
| Operator memory laws ("grep sibling call sites", "positive control first", "pre-register") | MEMORY.md + ~40 `_principles.json` entries | The operator's behaviour | Teach only the operator (teaching law). Restated after each recurrence and violated again: 09-22 joiner ("GREP EVERY CALL SITE"), then 09-28 23abbf4 ("control before believing"). |
| Mitosis freshness / committed-drift gate | vessel-mitosis-cutover.ts; `0a0d59f`, `082f6ee` | Stale-base overwrite | Hashes the mirror, not origin. 0a0d59f deadlocked the lane. The operator's 5.4 base change broke freshness. Both broken or reverted (mech 10). |

---

## 6. Current verified state (2026-09-29, 04:55–05:10Z)

**Live instances still open:**

- **Ribosome is undiscoverable on node 1 (sub-class A).** `journalctl -u ribosome-vessel` shows **297** `register failed: 400` lines
  since 00:00Z and the latest at 04:56:22Z. discovery `src/index.ts:337` still returns `shapes must be a non-empty array…`, and
  ribosome `src/index.ts:697` still sends `shapes: []`. Discovery HEAD is `ffd1d58` on node 1 and node 2. On node 2 `ribosome-vessel` is
  **masked** (`systemctl is-enabled` → masked), so the defect is dormant there: code present, no registrant. The gap
  `severed-joint-ribosome-registered` (joint_liveness_detector) is open, updated 09-29 04:28Z, with `falsifier:none` and no `edit_site`.
- **Resolve-URL joiner (sub-class A, 4th hat).** goal-host HEAD `bc99f91` on both nodes. 7 sites still concatenate
  `endpoint.replace(...)` + `asResolvePath(resolve_endpoint)`: lines 9460, 12746, 12776, 13507, 13519, 13994 and 14347 (count 7 on
  node 1 and node 2). Lines 7457 and 15128 now carry the inline guard (`5ca51be`). Gaps still open:
  `seven-more-resolve-url-sites…`, `…-narrowed`, and recommits `anchor_not_found`, `semantic_reject`, `typecheck_dangling_reference`.
  The `trace_failure_pattern_report` oracle named as the gap's falsifier is **not discoverable from the cockpit**: resolve_impulse
  returned "no vessel advertising" and activity-api returned 404 `use_vessel_discovery`. So I could not run the registered falsifier myself.
  A direct store search for `URL is invalid` across `trace`/`metadata`/`output_impulses` of `execution` found **0 in 96h** against a
  positive control of 1,164 rows containing `fetch` in 24h. The window includes time before `5ca51be`. Either the remaining sites
  sit on paths whose `resolve_endpoint` is relative, or the reason is not stored in those fields. I have not established which. Treat it as unattributed.
- **`gapClassKey` 8-hex rule (sub-class D).** development-vessel `src/resolvers/substrate-gap.ts:313-323` normalises UUID, ISO time, date,
  13- and 10-digit numbers, but **not 8-hex**. The class key is still unique per `route-edit-<8hex>` gap, 15 days after `ca53600` removed the rule.
- **Operator-regression write-back is one-directional.** `f2491b4` is live: node 2 journal shows 2 `OPERATOR REGRESSION learned`
  lines (09-28 05:18, gaps `self-fact-divergence-…-step-1` and `route-edit-ec962628-step-1`), node 1 shows 0. The attempt ledger
  holds 305 settlements on node 1. The 09-28 operator revert-and-reapply in activity-api appears only as one pull-sync `ref_update` with
  `execution_id:null`. The gap `an-operator-verdict-that-a-passing-landing-regressed-has-no-reader` is still `open`.
- **Operator landings still bypass the attempt path.** Commits since 09-22 by non-substrate authors: goal-host 19, development-vessel 8,
  activity-api 7, human-surface 3, concept-db 1, llm-resolver 1 [verified]. All reached origin without an attempt intent. The unaccounted
  aggregates hold 13 open rows, and the activity-api one is frozen at 09-25 08:55.
- **Recovered instances (kept).** SurrealDB cap on node 1 is `MemoryHigh=22G / MemoryMax=26G` (the 08-17 revert holds). Node 2 has no cap
  and no DB. The local-tools shell is now `groupBounded(cmd, requestTimeoutSec)` (index.ts:183), not a hardcoded 30s. `operator_approved: true`
  has 0 occurrences in feature-compose.ts (openspec-7). `activity-api` HEAD carries `89f04fb`, the correct listing.

**Net:** the class is **open and active**. Its freshest instance (7cc9da4) has refused a vessel 1,440 times a day for 10 days.
A detector now sees it, but the only lane that could act on the detector's gap cannot admit it. The operator-side landings
of the last 7 days (39) passed through no consequence gate.

---

## 7. Retire condition

Check it continuously over a rolling 14-day window, on both nodes, from the shared ledger or the gap store. **All clauses must hold.**

1. **Every ref move is an attempt (A, B, D).** For every `ref_update` on a vessel's `dev` or on the super-repo, whatever the author,
   an attempt record exists whose falsifier was registered **before** the ref moved and names a consumer-side probe. Measured by
   `unaccounted_landing` count = 0, with the scan proven live: each per-repo aggregate advances within 24h of any commit, and a planted
   probe commit is caught.
   *Currently fails:* 39 operator commits in 7 days with no intent, and the activity-api aggregate frozen 4 days.
2. **Blast radius is enumerated and probed (A, B).** Each landing's attempt record lists sibling sites of the changed pattern and
   the registered joints or consumers of the changed contract on every node the file deploys to, with a post-land probe result for each.
   **No `severed-joint-*` gap opens within 24h of a landing that touched that joint's writer or reader.**
   *Currently fails:* `severed-joint-ribosome-registered` is traceable to `7cc9da4`, and 7 joiner sites remain after a "verified" 09-20 closure.
3. **Reverts are graded both ways (C, D).** Every revert within 72h of its target carries a reason and produces, within one sweep
   tick on the node holding the attempt: a `#2 regressed` settlement, a class-posterior miss, an UNFAVORABLE decision outcome and a
   compose_lesson at the edit site. A **reapply** of a reverted commit produces the same records against the revert.
   *Currently fails:* 23abbf4/89f04fb left no record, and a699887 had no reason.
4. **No same-seam correction chains (E).** No file receives ≥3 commits in 24h whose subjects or bodies cite a predecessor's overshoot
   ("over-applied", "over-correction", "my <sha> let…", "left TS…"), and no policy value flips sign twice within 14 days.
   *Currently fails:* goal-host 09-22 (19 commits).
5. **The class stays down (durability).** No new gap shares a class key or edit-site pattern with a gap closed by a landing that
   touched that pattern in the prior 14 days (the "four hats" test). No census row of category F is added whose detection was by an operator rather than a mechanism.
6. **The retiring mechanism is itself on the seam.** The clause 1–4 checks run as activities with traces. Planted positive controls
   are re-proven weekly: an operator commit with no falsifier, a sibling-site miss and a reason-less revert must each be caught.

---

## 8. Keep

- **`f2491b4` `recordOperatorRegression`** (gap-to-feature.ts): the only live writer from an operator verdict into settlement, posterior
  and lesson. Generalise its trigger (any revert or reapply, author-agnostic, derived from the ref spool rather than a hand annotation). Do not re-mint it.
- **`landingEvent` ref_update spool** (`/workspace/attempt-ledger/spool`): it already sees every ref move, operator and pull-sync included. It is the natural seam for §4.
- **Joint-liveness detector** (`joint-liveness-tick.ts`, extended 09-28): the blast-radius source. It must emit `edit_site` and a class2
  falsifier so its gaps are admissible.
- **Unaccounted-landing scan** (`429c8bd`, per-repo fold): keep as the clause-1 counter. Fix its staleness and drop the probe-repo rows.
- **Causal attempt ledger** (`cbdb432`, `a4923f2`): the settlement vocabulary (five-valued verdicts, `#n` settlements).
- **Compose one-op / directed reservation** (`112e194`) and **exact-edit block format** (2.7, `f70160f`): directed goals that are byte-checked
  before dispatch land. The resolve-url sites that failed on 09-28 failed on regex re-typing, not on design.
- **`b013f30`** (fast-failure-only LLM retry), **`9df01220`** (hub-sized DB cap), **`e4d604c`/`groupBounded`** (shell bound), **`51b34a6`**,
  **`89f04fb`**, **`d4eee29`**: the correct end states of past overshoots. Retain them.
- **The census method** (`2ca586ba`: pre-fixed categories, break→detect latency, "who detected"): re-run it to measure clause 5.
- **Retire or fold:** the region containment gate family (973b7f6…a71e9a8), the `COMPOSE_MAX_CONCURRENT=0` halt drop-in, the
  compose-topology timer residue, and the web_search UNIVERSAL_READ_TOOLS attempt (duplicate producer). All are specific paths that encoded their last symptom.

**Related classes:** `autonomous-regression` (its sub-class C, gate-weakening, is the mirror of G here, and both share root cause 1) ·
`false-verification` (closures on the change's own predicate; the 09-20 asResolvePath `landed_verified`) · `endpoint-routing`
(joiner and discovery instances) · `sync-deploy-drift` (sub-class B travels by pull-sync) · `dormant-mechanism` (auto-revert,
isolated runner, consequence-verdict) · `operator-instrument-fault` (the transcripts-1 row "instruments lie toward the desired
answer" belongs there, not here) · `calibration-seal` (containment supply collapse).
