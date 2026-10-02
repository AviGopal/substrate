# transcripts-1 — operator session transcripts, file mtime 2026-08-29 .. 2026-09-05

Read-only mining of 11 Claude Code session transcripts in
`~/.claude/projects/-home-avi-documents-work-substrate/`. Selection was by file mtime
(08-29 .. 09-05). The *content* spans **2026-08-23 01:48 .. 2026-09-06 03:46**, because
the largest file (44a75483, 57 MB) is a multi-day session that ran 08-23 .. 09-01.

| file (prefix) | mtime | content span | size | character |
|---|---|---|---|---|
| 44a75483 | 08-31 | 08-23 01:48 – 09-01 00:44 | 57 MB | long audit/"resolve all blockers" Stop-hook session; B1–B4, β-pump, creation, verifier-recipe, investigation floor, pathway reuse |
| ce71b42c | 08-29 | 08-27 10:28 – 08-29 22:37 | 12 MB | docs audit → 13-gap closure run → escalation escape valve → architecture falsification → WIRING_CORRECTION_METHOD |
| ff560216 | 08-31 | 08-29 01:14 – 08-31 08:58 | 5.5 MB | "cleared to edit only what blocks self-landing"; BUSY miscount, rotation, grep evidence, lesson mirror, admission, repair channel, Class 1b |
| b1353836 | 08-31 | 08-29 09:44 – 08-31 01:43 | 6 MB | CPU/thermal storms: SurrealDB socket leak, recommit/narrow alternation, fossil gaps.json misdiagnosis, test-exec governor, killtree |
| 0f5cd43b | 08-31 | 08-29 20:19 – 08-30 03:17 | 4.3 MB | concept-db degraded: `&` quoting, HNSW filter, runCheck group-kill, load-deferral guard, growth governor (architecture reading) |
| eb163c50 | 08-30 | 08-24 06:13 – 08-25 17:36 | 4.4 MB | "is there hope"; human surface; 13-agent PROCESS_MAP; unauth key-mint; frozen-table repoint |
| d360444d | 08-29 | 08-27 00:30 – 08-28 04:24 | 1.4 MB | setup/first-reader; `run-live` role selection; 2,020 escalations into a readerless channel |
| 3637e240 / 5aac66b8 | 09-04 | 09-03 06:03 – 09-04 09:56 | 6.3+5.3 MB | forked pair; reach false-negative/positive, evidence ownership, total_selections prefix, four-link chain, lifecycle audit |
| f37f1a1a | 09-04 | 09-03 00:39 – 09-04 05:20 | 1 MB | hub API key minting (a key is printed in the transcript — NOT reproduced here), federation readiness, docs-align |
| 5223cbb0 | 09-05 | 09-06 02:00 – 03:46 | 1.2 MB | conceptual Q&A (architecture, horizons, "can it work") |

Method: `jq` extraction of text blocks (user + assistant) → keyword/length filtering →
reading every assistant message >1,200–1,500 chars (truncated 700–3,000 chars) plus all
user messages. Tool-result bodies were not read. Cross-checked a handful of fix
identifiers against current source (`grep` in `repos/*/src`) at the end.

**Security note:** f37f1a1a 09-03T00:48 prints a freshly minted hub admin API key
(`key_VaJXx…`, scopes read,write,admin, no expiry) in assistant text. Its presence in a
transcript file is itself a finding (secret at rest in `~/.claude/projects`). Value
intentionally not copied.

---

## 1. The one pattern, stated in the transcripts themselves

The sessions repeatedly name the same class in different words. Quoted, dated:

- 08-23T02:01 (AUDIT_EXPECTATIONS): *"One defect class dominates all four rounds: the system
  cannot distinguish absent from empty from zero from capped."* Base rates: a finding's
  observational leg survives ~7/7, causal leg **1/7**; deployed fix produces measurable
  change **1/4**; finding is a rediscovery **3/7**.
- 08-29T20:56: *"One pattern, wearing different costumes: failures that present as
  valid-but-empty answers."*
- 08-31T06:14: *"Not one of these is a bug inside a component. Every one is a contract
  mismatch between two components… That authoring method produces seam defects by
  construction… silent non-execution."*
- 09-03T10:19 (advisor synthesis): *"The gates are correct because they READ. The
  preconditions break because everyone WRITES."* No law governs ownership of evidence fields.
- 09-04T05:20: *"Failures live at the seams, not in the components… three id-namespace
  mismatches, four evidence fields with unversioned concurrent writers…"*

These four framings (absent≡empty; valid-but-empty; seam/contract mismatch; evidence
has many writers) are the same root seen from four sessions. Each session "discovered" it.

---

## 2. Dated CLAIMS and what later showed

Format: date — claim — where — later evidence (within window unless marked *post-window*).

### Autonomy / "first" claims (the hard criterion was declared met ~7 times)

| when | claim | later |
|---|---|---|
| 08-23T02:16 | "The hard criterion was met today": `3e58e73` Substrate Autonomous on origin/dev | Same commit deleted the 20-line evidence comment for the org_id binding (evidence-deletion; led to "no gate reads what a diff removes" gap). |
| 08-24T07:18 | autonomous mitosis commit `489da15` "lane alive" | 08-24T09:14: an autonomous cutover **reverted operator fix** (`6ba576a`, −45/+2 clobber). |
| 08-25T02:29 / 04:35 | `13f7440` (creation routing) + `3afb1812` "creation capability proven end-to-end", "first-class capability" | 08-25T06:40 **retracted**: creation was structurally broken from clean state (grounding gate refused any net-new basename); "proof" reached only via retry-after-debris. 08-26T07:27: `13f7440` is the **synonym treadmill** (regex alternation) — the documented non-fix. |
| 08-26T06:49 / 08:36 / 09:21 / 09:58 | "The system demonstrated self-development on its own" (`4839607/0c11b13/e8b4d69` tests 6/6; `a885631` port fix; `9fd234a` landability fix "superior to operator's") | 08-26T07:27 own spot-check disproved the "90% over last 50" (structural 90% → region-consequence 62% → file-level 30%). 08-27T00:13 **"I have to correct my 'condition met'… it's regressing"** (semantic-gate pass rate 62%→20%). |
| 08-26T20:34 | `d6c2a84` full S2 loop in 11 min (rIS-debug removal) | holds (small deletion). |
| 08-28T05:01 | `7167628` substrate landed correct idle-yield credit patch | 08-28T05:17 **inert**: `applyOutcomeToPosteriors` call sites never pass `metadata`; field dies at ingest projection. |
| 08-28T09:15 | "The arc closed. The substrate landed a fix by itself" `9ac885c` (llmCompletion 404→200) | holds as instance. |
| 08-29T08:39 | `abbfa4c` "hard autonomy criterion met again"; 11 autonomous commits/24h | same session: 5 of those gaps never attempted (BUSY), 95 closures of which only 10 `landed_verified`. |
| 08-29T14:49 | "Rung (c) confirmed" `6ce33d9` apply_proposal_as_patch | holds as instance. |
| 08-31T06:29 | `4d0c600` autonomous kill-0 guard in local-tools; earlier "11 : 0" retracted | 08-31T08:58 first `closed_reason: landed_verified` on emitter-backed lane — only after operator added Class 1b (`54cb1b0`). |
| 08-31T20:03 | `22c3fd2` autonomous commit added fabricated `(globalThis as any).gapCooldownMap.delete(...)` | an autonomous landing introduced a runtime TypeError path (autonomous-regression). |
| 09-03T07:24 | `0bf96df` landed no-hands in 4 min | same dispatch graded HOLLOW → `patch_with_tools` escalation → **destructive second commit** (insert-without-delete, duplicate lines). |
| 09-04T06:21 | "The four-link chain is closed. The session goal is met" (α+β +1.0 on one execution, `28e2e6c`) | 09-06 recap still lists "compose lane is ungraded" as top finding. |

### Learning-loop claims

| when | claim | later |
|---|---|---|
| 08-24T04:24 | "All four blockers resolved" (B1 join, B2 admission 1000, B3 validator, B4 trace pressure) | 08-24T04:58 **"two of my four 'resolved' claims failed the test"** — B1 & B3 falsified live. Record corrected (cfbf435b). |
| 08-24T06:05 | B1 resolved by universal `decision_outcome` capture (`e2c7959`, mig 202), "organic row" | 08-24T10:08 overclaimed: 561/561 rows `executed_at = NONE`, 81% one infra arm. **09-03T07:03**: `decision_outcome` records only already-graded rows → "99.9% reach-known **by construction**", covers ~1 in 10 executions. Instrument was circular for 10 days. |
| 08-24T10:49 / 20:59 | β-pump fixed (`018784f`, telemetry `ungraded`), triangulated | holds (auth capture stopped 10:43); historical β=401,706 scar left. |
| 08-24T20:54 | `decision_outcome` zero readers closed (`03e6c55` `/decision-calibration`) | 08-24T21:36: nothing *acts* on it — endpoint with no caller. |
| 08-24T09:14 | autonomous cadence resolved and OUTCOME-verified (`60a602e` FAMILY_RESOLVERS) | took **three false "resolved" calls**; mechanism still present in source 09-28. |
| 08-25T19:12 | audit verdict: posteriors don't differentiate; validator-dispatch Beta(151k,586k)=0.205 vs empirical 0.95 (smearing) | 09-04T07:19: top arm takes 43.4% of grading, top 5 take 89.8%; 131/4,055 arms graded in a week. Same finding, new numbers. |
| 08-26T06:02 | goal-expectation harness v3 "first trustworthy run", caught `reached:true` on "I cannot answer" | 08-26T06:07 "the one thing that would make the loop work is the one thing I did not fix" (reach oracle grades plausibility). |
| 08-27T02:03 | "component (2) demonstrated" — 34 lines of minted verifier recipes | 08-27T02:20 **both extremes wrong**: 4 families ever; 23 lines are one goal re-verified. |
| 08-27T04:53 | rescue fix "proven 5/5" | 08-27T06:56 **inert** — wrong branch (`_useRecipe` false; goals in `_recipeAnswered` path). Advisor: rescue unsound (self-confirmation). Reverted. |
| 08-27T09:06 / 11:49 | Option A `26f4ecb` + layer-2 `f91f8f2` land durable; "both layers closed" | 08-27T18:28 one clean attempt-1 reach, n=2; no rate. |
| 08-28T12:04 | "All 13 gaps closed, every one verified by consequence" | 08-28T08:31 idle-credit consequence test was inconclusive (alpha frozen 6h pre-fix); closure used constructed synthetic population. 08-28 "13 closed" rested on operator hand-landings (12 hand / 5 autonomous). |
| 09-04T02:39 | `total_selections` fixed (`0950143`, `activity:⟨name⟩` vs `name`) | holds; one redundant alias import left. |
| 09-04T04:46 | reach false positive repaired (`91871f0`) | 09-04T05:59 **own regression**: ~19% of landings (patch_with_tools, `pwt-*`) have no compose report → now graded false (false negative on a different path). |

### Gap-store / closure claims

| when | claim | later |
|---|---|---|
| 08-24T06:38 | gap bloat root-caused: open 834 → 251 | 08-24T07:31 the 834→251 was **manual** scans, not autonomous. |
| 08-29T01:10 | "Two of my gaps fixed and closed autonomously" (`reach-history-…`, `52452e0`) | 08-29T03:15 **false closure** — predicate was a source literal; corrupted rows (`total 414944`) survived. |
| 08-29T20:07 | "First complete demonstration" `a-busy-capacity-refusal…` closed `landed_and_verified_by_operator_measurement` | holds as operator-lane closure; `reach_grounding_gap` 6/0 for 40h. |
| 08-30T03:53 | picker monopoly 76–88% | 08-30T07:59 **retracted**: grep counted `runner_up` too; real 8.5–35%. Pushed commit `86cdbf2` justified by false numbers; `e70b432` corrected message. |
| 08-30T07:33 | `substrate-gap-write-reports-success-but-does-not-persist` "confirmed real, reproducible" | 08-30T09:48 **misdiagnosis**: operator read stale fossil `/workspace/gaps/gaps.json`; live store is `/workspace/git/super-repo/gaps/gaps.json`. All emergency data interventions (34 rejects, merge) hit the dead file. |
| 08-29 16:09 (concurrent session) | `picker-starves-on-one-gap-family` marked closed | ff560216 08-30T03:53 called it "another false closure" (condition true at 88%) — but that rested on the 76–88% figure retracted at 08-30T07:59 (runner_up double-count; real 8.5–35%, 35% at 07:00 = narrowing, not monopoly). Verdict on this closure therefore **unsettled**, not proven false. |
| 08-31T00:26–01:56 | lesson mirror severed 2 months; "5,797 failures → 1 lesson"; three fixes `f580efd/cc5bc8b/945a667` | 08-31T04:34 **central claim wrong** — queried unauthenticated (`default` org, 3 rows); tenant `organizations:substrate` has 21 lessons since 07-04. Only `945a667` (conflict retry) and `cc5bc8b` stand on own evidence. |
| 08-31T05:33 | `ee6312c` numbered gutter + prefer `replace_lines` in repair | 08-31T05:54 **net-negative**: repair consumer reads only `old_string`; replace_lines → silent no-op consuming 4-round budget. Fixed by `4841fb3`. |
| 08-31T06:48 | predicate derivation shim | reverted by concurrent session `8a5223c` (derives against post-fix file → `present` forever; operator's comment stripper broken; validation circular). |

### Resource / infrastructure claims

| when | claim | later |
|---|---|---|
| 08-29T10:14 | SurrealDB socket leak fixed (`4e28073`,`c601cd6`), "fully back under control" | 08-29T19:01 second driver (29 concurrent `bun test`). |
| 08-30T06:27 | narrowing/recommit alternation fixed (`da69c2f`→`6304d64`,`da86fbb`) | 08-30T07:59 "churn generator" framing itself retracted (62/99 new gaps were real). *Post-window*: memory 09-22 still lists "`-narrowed` child = verbatim dup". |
| 08-30T02:00 | `0fd7487` runCheck group-kill "the box-saturating leak" | 08-30T02:18 **withdrawn**: zero bun test >600s; load is designed cost of mitosis/compose verify. |
| 08-30T02:59 | 30s → 900s `sh()` watchdog "made autonomy work" | *Post-window (memory 09-28)*: **post-land suite silently dead 08-31 → 09-28 on dev-vessel/activity-api — shell 30s default kill; fixed 5e9a0b2.** The 30s class returned through another caller. |
| 08-30T17:14 | concurrency governor `44c2b21` cut CPU 5–17× | 08-30T22:35 governor "largely cosmetic" (GNU timeout escapes pgrp); fixed `791051e` killtree; 08-31T01:43 "durable recovery" after 3.6h. |
| 08-30T22:55 | "first genuine decline all session" | 08-31T02:32 load "tracks compose activity exactly — 4 idle, 55 composing — says nothing about progress". |
| 09-04T09:53 | load ~20 is "the substrate running hot" (pattern from memory) | **wrong**: qemu VM 6.5 cores + wf-recorder 1.6; substrate ~30%. |

---

## 3. ATTEMPTS (what was tried, outcome), grouped by problem-class key

### write-read-mismatch
- 08-23 `uiQuestion_write` asked 1,000×/24h, no read shape (positive control uiFeedback). 08-27: 2,020 escalations/51h, 81 gaps. Fixed 08-28 `6dc8107` (reader, `kind:"gap_needs_human"` not `question` — first impl returned 0/194), `becfa05` (persistence; restart 194→0 panels), `fe52076` answer read-back (outcomes 0→85), `9cb83d0` executor (`escalation_disposition_apply`). **worked** within window. *Post-window (memory 09-22)*: 248 escalations went to pinned `:8270` replaced vessel no human reads — same class, new hat.
- 08-28 `7167628` substrate idle-yield patch inert (metadata projected away at ingest); `92c991d` metadata forwarding by hand. partial.
- 08-24 B1: `/recommend` writes selection log; walks use discover-by-shapes (no log); adapter dropped `correlation_id` (`66f0322`); reader used ANSI JOIN (SurrealDB 2.3 parse error) — rewritten. partial → superseded by universal capture.
- 08-25 frozen table: 7 scripts / 27 sites read `activity_execution_traces` (frozen 07-14); repointed to `v_paradigm_execution_traces` `3c1bf965`. worked (batch_traces 0→50, first composition growth in 42 days).
- 08-31 lesson mirror posted to `DISCOVERY_ENDPOINT` not concept-db (`f580efd`); but premise (severed loop) wrong — tenant.
- 09-03 `decision_outcome` "universal" capture only writes graded rows (posterior-update.ts:1027) — circular instrument.
- 09-04 lifecycle audit reads `t.metadata.state_signature`; view (mig 069) never projects `signature` → all scores 0.03 → top-k ≡ bottom-k. Tie-break `dae9927`, paging `f0257fe6`, migration 205 written (`9646cf8`, unpushed at 09:39).
- 08-29 goal_hash FNV vs md5; `activity:⟨name⟩` vs `name` (09-04 `0950143`).

### node-locality / sync-deploy-drift
- 08-23 cockpit `.mcp.json` pointed at hub `syzygy.host:18080` which doesn't serve goal_execution/substrateGap/memoryNote — every operator dispatch "going nowhere"; repointed locally.
- 08-23 "Hub SSH blocker" (12 key/user combos denied) — dissolved: pull-sync self-deploys source.
- 08-28 operator's `docker cp` into /vessels made pull-sync content-hash see no diff → `synced=0` forever while old code ran. Caught by clone-vs-runtime hash.
- 08-28 freshness gate compared `/vessels` (runtime) while commit made in push clone → stale-base cutover `510b6df` deleted operator's fix 3 min after push (44 deletions). Fixed ~08-29T00:01.
- 08-27 pull-sync quiesce waits for in-flight=0, never true under autonomous load → gap filed `pull-sync-quiesce-deadlocks…`.
- 08-28 `/workspace/policies` vs `/workspace/git/super-repo/policies`; 08-30 `/workspace/gaps` vs super-repo gaps; 09-04 `/workspace/compose-slots` vs `$WORKSPACE_ROOT/compose-slots` — **three instances of the same WORKSPACE_ROOT fossil trap in one week** (plus memory store split 09-22 post-window).
- 09-03 hub admin key minted; federation "half-wired" (local not federated with hub).

### test-residue-live-state
- 08-30 `substrate-gap.ts` test suite shelled `systemctl start gap-compose.service` for real on every open-gap write → test→compose→verify→test loop; `d7135b7` guard. worked.
- 08-31 trace-spool 30,294 files / 287 MB since 08-17 incl. 16 `exec_test_1.json` test debris (the "activity.test" URL 08-27 was test execution in live container).
- 08-29 `scripts/m1-train.ts` held SurrealDB connections.
- 08-29 orphaned_capability_scan probe (`emit_gap` vs `emit_gaps`, no `dry_run`) re-upserted 40 gaps; operator then closed 40 pre-existing gaps (false premise), reopened, re-closed with off-by-one. `57f1ac4` added dry_run.

### memory-recall
- 08-30T00:47 upkeep Thompson state in-memory, wiped by 132–313 concept-db cutovers/day → `totalTrials: 0` permanently.
- 08-31T06:32 `solicitedHumanGaps` throttle in-memory; ~15 restarts/day → 77 questions → 1,267 escalations (later: upsert collapses to ≤77 panels — severity overstated).
- 08-31T08:38 `substrate-gap.ts:522-524` carries forward omitted keys → a wrong predicate/metadata is permanent (memory 09-23 restates this as new).
- 08-24 rhythm registry operator-seeded in pool volume; fresh image boots with cadence dead (`rhythm-registry-not-code-seeded` filed).

### calibration-seal
- 08-28/29 `hopeless()` hard-`continue`s categories at ≥8 attempts / 0 lands; `updateCalibration(cat,true)` fires only at closure → seal self-perpetuating. 12 categories sealed; `orphaned_capability` 346/0. Intent history: `d1bb37a` (06-30 "re-test path") vs `143212a` (08-06 hard exclusion intended). Operator reversed own fix twice. Escape = human disposition → `9cb83d0` + `60722a6` (1.5× weight); cycle 2 still BUSY 87/30 min; answer stored as prose (no `edit_site` applied).
- 08-29 `5472e8b` BUSY capacity refusals were counted as failed attempts & category attempts (`reach_grounding_gap` 0→5 in 6h with zero composes). Fixed; 16 refusals → 0 increments; 6/0 held 40h. worked.
- 08-31 filing into one fresh category wired six gaps to fail together (operator self-noted).

### narrowing-duplicates
- 08-29/30 recommit (`source_gap_id`) vs narrowing (`parent_gap_id`) guards don't see each other → `recommit-recommit-…-narrowed-verify_failed`; `failed_attempts` reset → score 1.0 → re-picked; ~44 concurrent test suites. `da69c2f/6304d64` + `da86fbb` (shouldNarrowForChronicFailure). Present in source today.
- 08-28 closing a gap left its `-narrowed` child open → completed gap looped (composer re-derived already-landed change).
- 08-29 a filed gap spawned a verbatim `-narrowed` clone **six minutes** after filing.
- 08-29T11:03 a gap with failed_attempts 153 outranks never-tried gap (89 of picks to one family+clone).
- 08-31 `-narrowed` child at fa=0 outranks parent at 21.

### hollow-landing
- 08-23 `dbb2917` inert (two comment lines + reindent) cost 432 dead picks/48h; operator revert `69afa93` — first revert subject `revert(...)` not detected by either revert detector → would count as second landing → false close. Fixed detectors.
- 08-24 `be97c55` added interface field only (inert partial).
- 08-25 creation "proof" via retry-after-debris; drafter wrote 3-line stub / wrong import.
- 08-26 `13f7440` synonym treadmill; `4eedb4de` hardcoded external URL + gap record into index.ts; `registryFieldFor` rewritten 8×.
- 08-28 split "add helper" then "wire it" → gate refused dead code by construction (operator error).
- 09-03 `1e66893` comment relocated to module header (typecheck blind to comments) landed.
- 09-04 `e96015c` guard landed as permanent off-switch (threshold 30 vs population 7); corrected `rankSize`.

### false-verification
- 08-29 reach_history closed on source literal while corrupt rows survived.
- 08-29 closures with reason strings that no code emits (`fix_landed_and_verified_by_consequence`, `condition_verified_fixed`, `repaired_and_verified`) = hand-closes reading as repairs; 11/27, 11/95.
- 08-29 lift gate `overall_passing` false→TRUE because denominator collapsed 17→4 (no min sample) — `bd3117e` null below floor.
- 08-24 creation false-reach: `find | wc -l = 0` graded reached:true (`221f919`, `60b7c0f`).
- 08-26 `reached:true` on "I cannot answer the question".
- 08-28 citation oracle accepts coincidental (test fixture) citation.
- 08-28 "Close substrate gap" dispatches reached true on narration with zero code change (fix #9).
- 08-31 oracle has one polarity (defect-literal present) — additive fixes cannot close (`4d0c600`: literal 1 before/1 after). Class 1b `54cb1b0`.
- 08-31 `sweepPendingLandVerifications` correctly holds `pending` for predicate-less gaps; 77% of lifetime closures = abandonment, ~4% verified.
- 09-03 late-landing check `50f7560` graded on sha existence → false positive `c10beb80`; `91871f0` raised bar → false negative on pwt path (19%).
- 09-03 remedy-closure path: 10/1,781 gaps carry `remedy`, 0 cite sha, 9/10 carry sentinel `detected_at=2024-01-01`; operator's richest gap remedy-closed in 17 min.

### drafter-quality
- 40 consecutive composes (08-30): 27.5% anchor_not_found, 22.5% semantic reject (wrong file), 27.5% never reached verify, 2.5% landed; op_count=1 in 26/40.
- drafter paraphrases anchors from the gap summary despite `[fc-anchors]` 101 verified candidates (08-29T20:50).
- blind-edit repair re-derives anchor from whole file; `refuseRederivedEdit` has no uniqueness/locality; targets 5703/5717 applied at 72–92 (09-03).
- model dropped the `-` in `kill -9 -$__cpid` (process-group → process) — refused correctly (08-31).
- invented import `../core/project/get-workspace-root`; duplicate/unrequested import from wrong module (09-04 `0e3f1a5a`); fabricated `globalThis.gapCooldownMap` (08-31 `22c3fd2`).
- line-too-long (~400 char JSON.stringify) anchors untranscribable (09-03).
- goal-design rules that worked: one op, short unique verbatim anchor, no helper name, EDIT n old:/new: format.

### gap-content
- 08-31 `admitActionableGaps` default-admits gaps naming no file; fc-grounding refuses → 12/12 ungrounded refusals, lane 100% consumed, 0 compose reports. `ea2476c` defer. worked (0→3 reports/43 min).
- 08-29 `feature_compose` case at `impulses.ts:462` passes pointer unvalidated → 28 empty-spec composes/3h after restarts. `817fb3f`.
- 08-31 substrate-detected gap `edit_site: "fleet-wide -- grep across repos/*/src …"` (prose) → never verifiable, pending forever.
- 08-31 predicates: 5 of 1,606 gaps ever carried one; 4 operator-written. `verify_by` field has zero writers and readers.
- 09-04 operator gaps all `falsifier: "none"`; 0/4 closed in 55 min.

### dormant-mechanism
- `fn::island_concepts` never defined since initial commit (apply-schema splits on `;`, swallows, prints success) — resolve-island upkeep dead.
- `detect-concept-db-drift` activity exists, never ran against real condition.
- `docs_align_scan` accuracy invariant never executed (caller omits it; precondition never supplied). Enabled 08-28 `14e530e` after false-positive tightening.
- `COMPOSE_LESSON_GUIDANCE` / verifier-recipe candidate maturation (agreed:0 never reused).
- `activity.ev` identically 0.5 on all rows (dead constant); `activity`-table posteriors vestigial.
- growth governor (λ₁ ≳ ρ_grow) prescribed in SUBSTRATE_AS_DYNAMICS.md — unbuilt.
- `/decision-calibration`, harness scripts, `validation/scripts/goal-expectation-harness.ts` (operator-only, invisible to loop — advisor 08-26: anti-pattern as a gate).
- `validator-dispatch` 737 executions/h, 1 ms, `metadata: null` (53% of executions).
- 09-06: `execution_state_snapshot`, `discovered_state_pattern` stores empty (discovery lane not running).

### spend-envelope-throughput
- load 22–55 = designed cost: each compose runs bun install + tsc + up to 3 full suites (1,921 tests / 245 files) on 14 CPUs; autonomous cap already 1. 1.7 composes/h × 4% FAVORABLE ≈ 0.065 repairs/h vs ~9.7 gaps/h created (150:1) or ~1.6 real findings/h (25:1).
- `a07c8ce` short-circuit tests when typecheck fails (3/5 skipped suite).
- `3e687d2` load-deferral guard (fails open) — later "won't fire against actual load source".
- 45/80 composes BUSY (56%) at cap=2 (08-29); 182/270 edit-intent non-reaches = RETRYABLE CAPACITY.
- QEMU VM + wf-recorder consumed most of host (09-04) — load mis-attribution.

### endpoint-routing
- 08-29 executor `curl …?q=&limit=1` unquoted `&` backgrounded → empty stdout exit 0, re-emitted byte-identically 7× (`99d6305` at llmExtractPointerArgs). The tell sat in a 08-15 comment.
- 08-29 grep evidence: no node_modules exclusion + 2,000-char head cut before named file (byte 3047) → `095d568` (named file first, `-H`).
- 08-31 lesson mirror → discovery 401/hang vs concept-db 200.
- 08-31 querying concept-db unauthenticated reads `default` org (tenant trap) — measure through consumer's access path.
- 08-25 unauthenticated `POST /v1/keys/generate` minted credential accepted fleet-wide (SEC fix, 401 after).
- 09-04 traces list route silently clamps `limit` to 100 (`total:-1`), audits never paged.

### autonomous-regression
- `6ba576a` clobber of operator cadence fix (08-24); `510b6df` stale-base 44-line deletion (08-28); goal-host restart by self-cutover killed operator in-flight goal (08-23); `22c3fd2` fabricated identifier (08-31); `1e66893` destructive relocation + `110c2bb` duplicate (09-03); `3e58e73` evidence-comment deletion (08-23); `/health` env-var regression from two substrate commits (08-30 gap).

### directed-overshoot
- `3e687d2`, `0fd7487` (latent, not the load source); `86cdbf2` justified by false 88%; `ee6312c` net-negative; predicate shim reverted (`8a5223c`); `e96015c` off-switch; `91871f0` pwt false negatives; `50f7560` false positives; operator pushed super-repo openspec by accident (`06be144a`, wrong cwd); operator contaminated lesson corpus (probe rows); watcher `grep -c … || echo 0` → "0\n0" false "DEPLOYED/LIVE" **twice** despite memory note; `ORDER BY` field missing → watcher dead (13th instrument error, 09-04).

### selection-learning
- β-pump (auth telemetry reached:false → β 401k, α=1); `018784f`.
- 5+ writers of `thompson_alpha` with incompatible semantics (08-25); chain-credit TD(λ) adjudicated as design.
- ungraded executions give {0,0}: feature_compose 519→623 executions with byte-identical α/β.
- `total_selections` 0 of 4,049 (prefix mismatch) `0950143`.
- posterior-update chain-credit path resets `updated_at` without decay (8 aliasing writers; static detector `packages/evidence-aliasing-check`, `c851cbbb` + `98f92bd`).
- 3,885 activities, 1,126 ever executed (29%); 1,217 retired (31%) — retirement exists, no `retired_at`.
- `recommendReachingPath` ranks by raw count, deterministic top-1 (not Thompson).

### composition-crystallization
- 08-29 ceiling experiment E2 FALSIFIED-b: identical goal, proven pathway (2 execs @1.0) never touched; repeat minted two new paths.
- 63.5% of accepted pathways are satisfier-only → recommended then discarded (can't pin `satisfier:` pseudo-id).
- reuse attribution not storable → `4e0d27a` (mig 204) + `d45aa3d`.
- floor reaches `recordGoalPath shapes=[]` → never indexed (fix #8).
- ribosome: 1,238/1,596 ungraded, 18 eligible (1.1%) in 24h (09-03).
- 08-29T20:19 "ribosome mints compositions, 538 executions of learned-composition-*" (claimed closed loop).

### goal-walk-floor
- edit-intent lane 0/41 (08-29); reach 10%/attempt, 22%/goal; non-edit 52%.
- compose BUSY fell through to a walk that cannot edit (fs_edit/fileEditResult/code_modification_proposal have no producer) — `2cc8af7` refuse retryably.
- creation goals routed to floor; `find|wc -l` false reach.
- investigation floor below ReAct parity (misroute to trace store, curled activity.test 7×) → routing `752014d/2757d15`, grep `0af9639`, satisfier suppression `71d434f`, citation oracle `5e4d045`, gap-investigation class `9cc89fd`.
- `provide_feedback` rejects verdicts on goals that fail before template selection (learning blind to earliest failures).
- reach killers 09-04: `{{target_branch}}` placeholder in scaffold-and-publish-vessel fails 75/77 (~288 dispatches/day).

### human-surface-escalation
- see write-read-mismatch; human surface vessel `:18310` went inactive/disabled between two answers (08-25); UI panel store didn't survive restart; escalation escape required operator to answer each gap; answer stored as prose.

### federation-p2p
- cockpit pinned to hub that serves the wrong shapes (08-23); hub self-converges via pull-sync; federation-transport-vessel is a manifest vessel not installed; 09-03 local not federated; unauth key-mint reached internet-facing hub (fixed); hub `:18101` exposure unconfirmed (classifier blocked probe).

### trace-store-db
- SurrealDB ~10 cores 11.5h, 226 GB read/147 GB write; socket leak in `createAuthenticatedClient` (activity-api, concept-db) `4e28073/c601cd6`.
- HNSW index defeated by scalar filter beside `<|K,EF|>` (112 ms → 47.9 s) `62cbf1e`.
- transaction conflict ("can be retried") never retried → every other concept write 400 `945a667`.
- `times_loaded` is both relevance denominator and prune predicate → prune funnel 506→260→29→0; 63,952 concepts; `impulse_signature` 86.4% of store, undocumented.
- migrations: `DEFINE TABLE` over existing view inert; REMOVE+DEFINE drops indexes; `init-database` runs on every start → push = apply.
- ORDER BY on unprojected field → 400.

### env-gating
- `CUTOVER_PRECHECK_SUITE`, `COMPOSE_MAX_CONCURRENT`, `MITOSIS_DIRECT_PUSH`, `MITOSIS_RUNTIME_DIR` (host tests passed on nothing because it defaulted to `/vessels`), `WORKSPACE_ROOT` (EnvironmentFile wins over unit), `OUTCOME_TTL_MS`; shaped policies (`extractionPolicy`, `pathwayReusePolicy`) shipped with no producer → hardcoded literal fallback (08-28 `f34547e` by another session).

### docs-drift
- 08-28 docs audit: ingest loop works (75 docs, 1,251 sections); accuracy invariant never ran; enabling it produced 15 findings "essentially all false" (fictional example shapes) → reverted `18a4e3c`, tightened predicate, re-enabled `14e530e` with control.
- 08-29 `project-session-priority-queue-2026-08-04.md` 24 days stale.
- 09-04 four docs gaps: ingest reap permanently refused (596 candidates vs limit 460), docs-align-tick never executes, config-surface-probe no caller; gap-compose runs exit in 1 s with no stdout.
- *Post-window context:* CLAUDE.md claims vs reality recurrently disagree.

### codebase-bloat-fossils
- 49 of 71 `/vessels` dirs were mitosis self-clones (08-29), nothing composts them.
- `/workspace/gaps/gaps.json` frozen 08-08 fossil; `/workspace/policies` stale copy; `/tmp/dev-vessel-*` scratch dirs; `[rIS-debug]` console.error left in engine.ts (removed `d6c2a84`).
- 88 stale-and-skipped proposals (08-28); mitosis-cutover proposal TTL discards backlog.
- trace spool 30k undeliverable files.
- `verify_by` field (zero writers/readers); `conceptDbEndpoint` computed never used.

---

## 4. MECHANISMS encountered (seam vs specific; live vs fossil)

| mechanism | location | status (evidence) | general? |
|---|---|---|---|
| `isNonAttemptComposeResult` (BUSY/environment ≠ failed attempt) | dev-vessel gap-to-feature.ts (3 sites) | live-used (present in source 09-28; 13 "gap credit not bumped" firings) | general at gap-credit seam |
| `shouldNarrowForChronicFailure` | gap-to-feature.ts | live (present); class persists per memory | specific |
| human exemption (`human_exemption_attempts_remaining`, `escalation_disposition_apply`) | gap-to-feature.ts, escalation-disposition-apply.ts | live; answers stored as prose (edit_site not applied) | general escape valve |
| `BASELINE_MAX_AGE_MS` stale-baseline fail-open | vessel-mitosis-cutover.ts | live | specific |
| overlay baseline `buildOverlay(baseForDelta…)` | vessel-mitosis-evaluate.ts | live (INTRODUCED refusals 4→0) | seam fix |
| isolation re-run of named failures (`6d1562c`, escaped `bun -t` regex) | cutover gate | live | general |
| `drainBoredomQueue`, `FAMILY_RESOLVERS` | rhythm-conductor-tick.ts | live (present) | specific |
| `isReachInapplicable` telemetry abstention | activity-api reach-classify.ts | live | general at credit seam |
| `landedShaForGoalHash` / LATE-LANDING check | goal-host index.ts | live; covers edit-intent path only (pwt path & goal-seek :15202 route uncovered) | specific |
| compose-report preservation sibling (`ce10c8b`) | feature-compose.ts | live, verified 7/7 + natural fire | evidence-preservation seam |
| test-exec concurrency governor + `__killtree` | local-tools-vessel index.ts, gap-to-feature.ts | live (`__killtree` present; governor symbol not found by name — may be renamed) | general |
| `rankSize` + recent_count tie-break + paging | activity-lifecycle-audit.ts | live | specific |
| Class 1b close predicate (presence = fixed) | close oracle, `54cb1b0` | live, no automatic derivation | general |
| sweepPendingLandVerifications disposition ladder | dev-vessel | live-used; correctly abstains | general |
| verifier-recipe ratchet (two-derivation agreement, candidate maturation) | goal-host index.ts ~4183 | dormant (4 families ever; candidate never matures); invariant "answer OR verify, never both" (`30cbd14`) | general |
| citation oracle (`deterministic:code-investigation-cited`) | goal-host | live; coincidental-citation weakness | general-ish |
| `goal-expectation-harness.ts`, `self-dev-reliability.mjs` | validation/scripts | operator-only (fossil risk per script-retention rule) | — |
| evidence-aliasing static check | packages/evidence-aliasing-check + activity-api lint | live-used (wired to lint) | general |
| joint-liveness-tick | scripts/substrate + timer (`daa2632c`) | unknown post-window | general detector |
| apply-schema.ts | concept-db scripts | broken (splits `;`, swallows, prints success) | — |
| upkeep Thompson in-memory | concept-db | broken (reset by restarts) | — |
| decision_outcome / `/decision-calibration` | activity-api mig 202 | live but circular (graded-only), reader has no consumer | duplicate of reach grading |
| `activity_execution_traces` table | activity-api | fossil (frozen 07-14) | duplicate of `execution` |
| `/workspace/gaps`, `/workspace/policies`, `/workspace/compose-slots` | container | fossil paths vs `$WORKSPACE_ROOT` | — |
| solicitedHumanGaps in-memory throttle | gap-to-feature | broken across restarts | — |

---

## 5. PRINCIPLES / user directions (verbatim, short)

User (verbatim):
- 08-26T06:51 "We need this to be 90%+ reliable over the next 50 changes. The same for activity and variant creation and learning."
- 08-27T00:08 "The intended behavior means learning to provide the right impulse at the right moment and consistently gain ground in the topology"
- 08-26T23:21 "Would the system know on its own? This is not the fork, this is a truth question."
- 08-28T02:07 "The code that makes up resolvers are, in a manner of speaking, the same as the concepts… How do changes respect their history?"
- 08-29T01:23 "We are cleared to make any edits the system has proven incapable of landing on its own. But only those that would prevent it from landing fixes on its own."
- 08-29T06:19 (goal) "end condition is only on observation, we have permission to directly interevene iff the system fails an implementation twice."
- 08-29T09:50 "It's proven incapable"
- 08-29T18:57 "If the goal is achieved then it must work now right?"
- 08-29T18:59 (goal) "success is only determinable from repeated action"
- 08-29T19:51 "Our objective is to durably, verifiably, and causally prove that changes we make to close gaps, close them, and enable the system to operate as intended."
- 08-30T08:31 "It can't climb because it is max output" (correcting %CPU reading)
- 08-30T07:25 "We should get the issue under control, validate that we have a guard against it."
- 09-03T09:57 "It's likely that we are not threading impulse content through the activities in an effective way. Impulses have varied content by they can be treated similarly to variables."
- Recurrent questions (dozens of times): "How do we know this for sure?", "What are our objectives?", "Why are we doing this?", "How do we know this will help?", "Should we expect it to work now?", "What is the architecture's intent in this case. ask the advisor".

Principles the operator derived (each "learned" more than once — the recurrence is the finding):
1. Measure through the consumer's own access path (same credentials, tenant, endpoint, directory). Violated: tenant (08-31), fossil gaps.json (08-30), policies dir (08-28), compose-slots dir (09-04), `/vessels` vs clone (08-28), unauthenticated probe.
2. A metric must distinguish "worked" from "didn't run"; silence ≠ success. (08-31 ee6312c; mirror `void fetch().catch`; guard-fired=0.)
3. A grep/`|| echo 0` watcher can fail toward the desired answer — repeated verbatim twice after being written to memory.
4. Pre-register predictions and falsifiers before dispatch; score them honestly.
5. Positive control through the same address before believing a negative.
6. Decompose by edit, never by reachability (dead-code refusal); one op per goal; short unique verbatim anchors; no helper names.
7. When tightening a predicate, enumerate every producer that must still pass (91871f0 pwt; e96015c population; M3).
8. Closure must measure the defect, not provenance or a source literal; both polarities (defect absent / fix present).
9. A counter shared by two mechanisms (failed_attempts, updated_at, calibration) needs one owner; "evidence-field ownership" is the unnamed law.
10. Detection outruns actuation ("sensors outrun actuators"; "honest nervous system, broken spinal cord").
11. Don't read load averages without attributing by cgroup; don't judge at load >10.
12. Predicting a defect is not preventing it; reading a non-terminal state as terminal is an error class.

---

## 6. PROBLEMS with recurrence counts (within this shard)

| key | symptom | first/last seen here | recurrences | root cause (as best stated) |
|---|---|---|---|---|
| workspace-root-fossil (sync-deploy-drift/write-read) | operator/system read a stale sibling path | 08-28 → 09-04 | 4 (policies, gaps.json, compose-slots, /vessels vs clone) + memory split post-window | env-set WORKSPACE_ROOT vs hardcoded fallbacks; stale copies never deleted |
| readerless channel | writes with no consumer (uiQuestion, decision_outcome, calibration endpoint, lessons, verify_by) | 08-23 → 09-03 | ≥6 | producers minted without a reader; no reader-check at mint |
| self-sealing counter | calibration seal, stale baseline, BUSY→attempt, narrowing reset | 08-28 → 08-29 | 4 mechanisms, same architecture | counter written by one mechanism, consumed by another as evidence; no escape path |
| false closure | closed while defect lives | 08-29 → 09-03 | ≥6 (reach_history, picker-starves, phantom reasons, remedy sentinel, pwt, TTL 59–77%) | closure on provenance/literal/TTL, not defect measurement |
| reach grader wrong | reach true on non-answers / false on landed work | 08-24 → 09-04 | ≥7 | plausibility judge; evidence overwritten by retry; path coverage per exit route |
| stale-base / clobber | autonomous commit reverts verified work | 08-24, 08-28 | 2 (+ within-window near-misses) | freshness compared wrong tree |
| compose lane capacity | BUSY dominates edit-intent | 08-23 → 08-29 | 5+ | single slot, heavy verify, restarts |
| drafter anchor/relocation | edits land at wrong spans / invented symbols | 08-25 → 09-04 | many | model transcribes bytes; re-derivation w/o uniqueness |
| instrument error by operator | watcher/grep/denominator lies | 08-27 → 09-04 | ≥13 self-counted on 09-04 | same as system's: check can't distinguish no/not-yet |
| load mis-attribution | load blamed on wrong source | 08-29 → 09-04 | 5+ (surreal, mitosis, pull-sync, orphans, qemu) | %CPU saturation; no cgroup attribution; no command log in local-tools |
| restart-erases-state | in-memory learning/throttle lost on cutover | 08-30 → 08-31 | 3 | state in process memory; cutover-per-push |

---

## 7. What to keep (from this shard's evidence)

- The pre-registration / consequence-verification discipline and the goal-design rules for edit goals (one op, short unique verbatim anchor, no helper names) — produced the only clean single-attempt landings (09-03 `ce10c8b`, 09-04 `91871f0`, `28e2e6c`).
- Seam fixes that are live in source and verified by effect: isNonAttemptComposeResult, telemetry abstention, stale-baseline fail-open, overlay baseline, isolation re-run, compose-report preservation, killtree/governor, rankSize+paging, Class 1b, evidence-aliasing lint, `total_selections` normalisation, conflict retry `945a667`, HNSW two-stage `62cbf1e`, executor `&` quoting `99d6305`, admission defer `ea2476c`, entry guard `817fb3f`.
- The sweep disposition ladder (refuses provenance closure) — the design already had the anti-false-closure mechanism.
- Retire/compost targets: fossil WORKSPACE paths, frozen `activity_execution_traces`, mitosis self-clones, trace spool debris, apply-schema.ts (fails open), operator-only harness scripts not called by any activity.

## 8. Coverage gaps

- Tool-result bodies (command outputs) were not mined — claims above are the assistant's reported readings.
- 44a75483 08-23..08-26 portions overlap other shards' date ranges; included because the file is in this shard.
- 5223cbb0 (09-06) read only at summary level (conceptual Q&A, few claims).
- Post-window contradictions come only from MEMORY.md index lines, not re-measured.
- Short-message sweep (assistant lines ≤1,500 chars matching retract/"I was wrong"/correction/withdraw/overclaim) run after writing: no new claim classes; minor additions — 08-24T07:50 operator added a `bucket_load: 0` override to force the affordability gate open for verification (env/test hack on a live gate); 09-03T07:23 operator's Python reproduction of `goalHashOf` was wrong (bun under deployed code matched); 08-31T08:36 `substrateGap_write` merges metadata (operator memory said replace); 08-28T00:36 near-misattribution of an interleaved journal line from a concurrent dispatch.
- Timestamps are the transcripts' ISO stamps (UTC). Secret check: the minted key value does not appear in this file.
