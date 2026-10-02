# Dossier: calibration-seal

**Class, in one line.** A prior kept at **category grain**, or kept per node, decides whether an individual gap may be worked on. `hopeless()` (attempts ≥ 8 and lands = 0), the landability ranking, the gap-class Thompson file, the close-oracle calibration and the hand-edited `autonomyScope` admission all do this. Several mechanisms write the evidence those priors read, and no single owner tells "the lane refused / the handler cannot land by configuration / the environment failed" apart from "the drafter failed". The result is that whole families of well-formed work get sealed, or are admitted and then wrongly credited. The only designed way out, a human answer, is delivered to a surface no human reads.

**Boundary.** This dossier covers the *evidence → prior → admission* loop. Where the escape question is delivered (the pinned `:8270`) is part of **endpoint-routing** and **human-surface-escalation**, and appears here only as the reason the designed escape is dead. Per-node forks of the tables belong to **node-locality**. The 08-31 deletion of the busy-requeue mechanism belongs to **autonomous-regression**. Narrowed or decomposed children that reset `failed_attempts` and so launder the seal belong to **narrowing-duplicates**.

**Sources.** `classes/calibration-seal.json` holds 21 attempts, 19 problem records and 5 claims. I also used raw/gap-history §5A, git-devvessel-1/2, live-pool-memory, node2-runtime, openspec-7 §112/§124, openspec-10 (5.5, 6.2), memory-1/4/5/9/10, transcripts-1/2/3, reports-1 and `_mech_chunks/00,02,04,07,08`. The memory files were `reference-category-level-calibration-seals-eleven-categories-2026-08-27`, `reference-the-seals-escape-valve-asked-1755-times…-2026-08-28`, `reference-248-gap-escalations…-2026-09-22`, `feedback-directed-gap-handoff-needs-directed-true-2026-09-28` and `project-operating-model-route-around-then-encapsulate-2026-09-29`. I verified live state read-only on **both nodes** (`substrate-live` = node 1 and gap-store holder, `compose2-live` = node 2) on 2026-09-29 between 04:58 and 05:10 UTC. Both run development-vessel at HEAD `f451e42`.

---

## 1. Timeline (▲ = a claim that it was fixed or first; "later" = what showed afterwards)

| Date | Event | Claim | What later showed |
|---|---|---|---|
| 06-28..07-01 | `e78f8da` landability-ranked gap selection; `7833b6a` failed_attempts penalty; `8a1a761` predictLand against a 0.5 prior, mispredictions deprioritised ×2; `eb450e4` prioritise orphaned_capability "(it lands, feature gaps don't)" | ▲ the system learns what it can land | Feedback toward whatever already lands. `orphaned_capability` became 346/0 by 08-27 (the "lands" label was wrong, see hollow-landing) |
| **06-30** | **`d1bb37a`** "category-level self-knowledge (expectation-setting step 3)": deprioritise a category at ≥ 8 attempts / 0 lands, *"penalty, not hard exclusion … leaving a re-test path"*. Origin of the seal. The program has **no spec anywhere** (openspec-7 §112) | ▲ calibrated self-model | The code comment still says "penalty … re-test path". The code is a hard `continue` (gap-to-feature.ts:1213, live 09-29) |
| 07-09 | Env-vs-fix failure attribution (C1): env failure classes skip bumpFailedAttempts, lessons and calibration | — | Partial. `env_change_window_held` exists in 2 files. The tracking gap is gone from the store and tasks.md C1 is unchecked (openspec-4) |
| 07-18 | Static `CATEGORY_WEIGHT` (orphaned 0.5 vs missing 3.0). 08-03: boredom momentum store poisoned by failures on unreachable arms (memory-2) | — | Same shape: a static or poisoned category prior |
| 07-21 | Self-knowledge calibration demo: **no shape-aware feasibility estimator and no negative channel** (project-self-knowledge-calibration-demo) | — | Honestly failed. It named this class's missing reader two months early |
| **08-06** | **`143212a`** "blockingWeight had the wrong sign, and the hopeless filter was discarded". Makes exclusion real and removes 106 open gaps: *"the intended effect, not a side effect"*. The automatic re-test is traded for a **human decision** | — | The human escape had no reader until 08-28, and no human-read surface after 09-22 |
| 08-14 | `4b1f862` per-class close-oracle posterior (`closeOracleEarnedTrust`) | — | Node-local. Live 09-29: `landed_commit` false_closes **2149 on node 1 vs 31 on node 2** |
| **08-26** | Five gaps for one defect in one day: `triage-only-categories-are-permanently-marked-hopeless`, `hopeless-categories-are-hard-excluded-so-they-can-never-recover`, `hopeless-gaps-are-dropped-by-a-continue-before-scoring` (+`-narrowed`, +2 siblings) | ▲ closed | The defect did not move (gap-history §5A) |
| 08-27 | Memory: 11 categories sealed (`orphaned_capability` 346/0, `documentation_drift` 11/0, which is triage-only unless `DOC_FIX_AUTOLAND=1`, env-gated). `recommit-*` hard-codes `systematic_failure` (feature-compose.ts:2340), so fresh gaps are sealed and just-failed ones promoted. Gaps: `a-capacity-refusal-is-counted-as-a-failed-authoring-attempt`, `calibration-counts-killswitch-invocations-as-authoring-failures`, `category-counter-outlives-the-per-gap-counter`, `unseal-documentation-drift…` | ▲ several closed | 08-28: `detector_coverage_gap` sealed at 16/0, so **operator measurement findings are structurally unclosable** (12 operator gaps with 0 closed while the store closed 224) |
| 08-28 | `cf28f52`: a post-land baseline older than 24 h is ignored (a stale baseline sealed cutover) | ▲ worked | Autonomous dev-vessel commits went from 2 in 71.5 h to 2 in 15 min |
| **08-28** | Escape valve measured dead: **1755** `uiQuestion_write needs-human-*` in 48 h, read-back could never see an answer. Fixed `421052c` (scan by panel_id) and **`9cb83d0` `escalation_disposition_apply`** (bounded per-gap exemption of 3 attempts) | ▲ "the executor the seal was waiting on"; hopeless_excluded 79→78 | 08-29: the parser rejected its own verbs (`891304c`, `91cc1ff`). The answer is stored as prose, and link 4 (provide_information writes no field compose reads) stayed open. 09-22: delivered to a replaced vessel |
| **08-29** | `5472e8b` `isNonAttemptComposeResult` (BUSY / capacity / environment) at 3 bump sites; `be891f3` BUSY releases the cooldown; `60722a6` exemption earns selection priority. Gap `a-busy-capacity-refusal-is-counted-as-a-failed-attempt-and-seals-the-category` | ▲ **closed**. 16 refusals in 26 min → 0 increments | 08-31: `autonomous-cleanup-deleted-the-busy-requeue-mechanism` (open). 09-23/24: recurred on the gap-write nudge and the **directed** path (`failed_attempts` 2→6 on five BUSY replies in five minutes). The verified patch never landed, and the gap is still open 09-29 |
| 09-02 | 13 categories sealed. "One landing immunises a category forever" (`r.lands !== 0`). `requeueAfterNonAttempt` proposed to unstick 19 pending_verification gaps that absorbed 100 % of picks | ask-first; outcome unknown | — |
| 09-02 | `obsidian-learn.timer` disabled at runtime (49/53 hollows came from one dead dependency) | partial | An image rebuild re-arms it |
| 09-04 | `documentation_drift` sealed 11/0, escalated (transcripts-2) | — | — |
| 09-05 | Applier relocation feeds `updateCalibration(false)`. Decompose echoes truncate the parent at 400 chars in 66 % of cases and reset `failed_attempts` = 0, which **launders** the seal. Gap `hopeless-seals-at-8-attempts-but-needs-271-to-be-informative` (memory-9: at a ~3 % base rate an 8-attempt threshold false-seals 78–92 %. Trained on the `landed_commit` evidence class, which holds 0/1030) | — | That gap was **lost at the reset**. Live store 09-29: **0 gap ids contain "calibration" or "-seal"**. The class has no gap under its own name |
| 09-14/15 | Operator answers escalations: answered 3→31, applied 1–2. `d3e1ca2` answers become gap metadata. 2000-char truncation cut scope. `detector_coverage_gap` 0/15, `measurement_integrity` 0/12, `learning_loop` 0/14; 5/9 operator gaps sealed **on arrival** | partial | — |
| **09-22** | **248** `needs-human-*` on `stateful-ui-vessel :8270` (the REPLACED vessel), 0 answered. The live surface (`human-surface-vessel :8310`) never reads it. Gap `248-escalations-were-asked-of-a-vessel-no-human-reads` | — | Still open 09-29, and **336** now (see §4) |
| 09-25 | `03d98c1`: escalation dedup was in process memory, so every restart re-asked (37 per day per gap). `/var/tmp/solicited_gaps.log` persistence added | — | Gap `hopeless-gap-escalation-dedupes-in-process-memory…` still open. Log holds 102 ids on node 1 |
| 09-26 | `55fba0e` rhythm conductor credits on **outcome**, not fire (β debits observed, federation-verification β 6→22.5). User-approved re-baseline α = 1 + reached, β = 1 + unreached; gap-closing 755.5/2 → 63/23 | ▲ worked | **Wiped** by substrate commit `329fc5c` (body-replace staleness write), re-seeded to defaults 09-27 01:06Z, re-applied 03:32Z with `if_updated_at`. Node 2 untouched (node-local) |
| **09-27** | autonomyScope stage 1: `c110070` reader + admission refusal, `c27964b` compose verdict floor, `d7ec192` `require_falsifier_classes`, `00c0e5f`, `bb51374`, `28a69cf`, `59bfc4c`. Pool record `autonomy-scope`, 27 excluded paths | ▲ falsifier 1.5 **PASSED** 08:49; 2,343 → 9 admitted | The containment falsifier did pass. The *class* symptom continued: 23:45Z class1 dropped after the hollow `a198907` |
| **09-28 05:55Z** | Admission **widened to every class** (the rules had cut supply from ~250 to ~17, then to 2–5) | — | 8 autonomous landings, **1 improvement**, "none measurable by the system" |
| 09-28 | Memory: `gap_to_feature` without `directed:true` hits the autonomy-scope floor, giving a silent `WITHHELD FAVORABLE` (feature-compose.ts ~6272). Operator misread 4 rejections as drafting failures | — | A containment rule the operator set blocked the system's own repair of its tool plane |
| **09-28 18:12** | **5.5(iv) `76bf256` + `094c230`**: category calibration held by the gap-store holder. Node 2's local file had sealed `systematic_failure` 8/0, `edit_intent_route` 21/0 and `self_development` 15/0, excluding 126–128 | ▲ "node 2 pool unsealed 2 → 59" (a50d1196, 18:30); ▲ "**hopeless_excluded 0 afterwards**" (openspec-10) | **Refuted by the node 2 journal** (§4): hopeless_excluded went 124–129 → **66–68** from 18:27 to 23:26, not 0. Node 2 now reads **node 1's** table, whose 33 sealed categories replaced node 2's 12 |
| **09-28 23:30Z** | Re-tightened to `[class1, class2]` (user-approved). Record `reason`: "**Supply now comes from the holder-held calibration**" | ▲ "node 2 admits 7 verifiable gaps" (7c1ffc8e, 23:40) | Node 2 pool=7 with hx=0 at 23:31. hx=0 only because the pool upstream was emptied. Node 1 same at 23:32 (pool=2, hx=0) |
| **09-29 03:xx–04:5x** | Both nodes: `auto-pick admission: 863 candidates → 0 admitted` | — | Refutes "supply now comes from the holder-held calibration". Node 2 escalations `THREW … Unable to connect — no human was asked` (01:38) |

**Count.** The class was declared fixed or closed **≥ 7 times**: 5× on 08-26, 08-27, 08-29, 09-27 (falsifier), 09-28 18:30, 09-28 23:40 and "hopeless_excluded 0". Recurrences were recorded on 08-31, 09-02, 09-04, 09-05, 09-14, 09-22, 09-24, 09-28 and 09-29. The per-source recurrence counts in the class file (8, 4, 4, 3, …) overlap, and I do not sum them.

---

## 2. Root causes

1. **Wrong grain.** `hopeless(g)` reads `calib[g.category]` (gap-to-feature.ts:1184–1197, live), so a brand-new gap is sealed by what *other* gaps in its free-text category did. The same grain error runs the other way: one landing immunises a category forever (`r.lands !== 0`), and `recommit-*` inherits the healthy `systematic_failure` rate. Categories are fragmented free text: node 1 holds **143** category rows.
2. **The evidence has several writers and no owner** ("evidence-field ownership", transcripts-1 law 9). `bumpFailedAttempts → updateCalibration(cat,false)` is fed by triage-only handlers, kill-switch runs, applier relocations, BUSY capacity refusals and environment failures. The non-attempt predicate (`isNonAttemptComposeResult`) exists, but only at the call sites that existed on 08-29. New entrances added later (gap-write nudge 09-23, directed path 09-24) do not ask it.
3. **The seal guards one entrance and not the spend.** `hopeless()` runs only inside `pickMostLandable` (auto-pick). Live 09-29, `trace_store_reconciliation` is sealed at **636/0** on node 1 and **400/0** on node 2, and `db_performance` at **371/0**. Yet the drain log shows **1,168 + 790** dispatches to exactly those gaps since 09-22, which is 99.6 % of all drain dispatches (live-pool-memory). Meanwhile **23 of node 1's 33 sealed categories sit at exactly 8/0**, the fingerprint of a counter frozen at the moment the one entrance stopped feeding it. So the seal neither stops the waste nor lets a category recover.
4. **Lands are credited only at closure, which exclusion prevents.** The seal is self-perpetuating: unsealing needs a land, a land needs a pick, and the seal prevents the pick. It was also trained on the wrong evidence class (`landed_commit`, 0/1030 holds). With an 8-attempt threshold at a ~3 % base rate, it false-seals 78–92 % (memory-9).
5. **The designed escape has no reader.** `143212a` traded the automatic re-test for a human decision. The human path was then unread (08-28: 1755 asks, 0 readable), then unapplied (link 4: prose, no field), then delivered to a replaced vessel. `ui-write-passthrough.ts` still pins `STATEFUL_UI_VESSEL_ENDPOINT ?? 127.0.0.1:8270` (single commit `1f9090e`). Discovery advertises the live surface for the same shape.
6. **Priors are per node.** `expectation-calibration.json`, `gap-class-posteriors.json` and `close-oracle-calibration.json` are local files. `76bf256` moved one read to the holder and so propagated the holder's seals. It left the other two tables forked.
7. **Credit is recorded on fire, not on outcome, and debits never decay.** Rhythm credit ran at 94–98 % on 0–20 % reach, and gap-closing α reached 755.5. `55fba0e` fixed this for rhythms only, and substrate commit `329fc5c` wiped the re-baseline. Class posteriors are α = 1 on 248 of 253 classes on node 1 (live), so the Thompson rerank is uninformed.
8. **No machine criterion trades supply against quality.** When the seals and priors mis-admit, the operator hand-edits one pool record (`autonomyScope`): widened and tightened twice in 48 h, with the history kept in a prose `reason` field.

---

## 3. Why it recurs: the missing shared capability

Every fix changed **one axis at one call site**: the threshold, the ranking, the predicate at three sites, where the table is read, credit-on-outcome for rhythms, or supply by record edit. The class regenerates because a single seam is missing. That seam would own the attempt evidence for *every* entrance and label each attempt by outcome. It would decide eligibility per gap, with a bounded automatic re-test. Instead, each new dispatcher (drain, directed, nudge, named, decompose) writes the same counters with its own semantics. Each new prior (hopeless, predictLand, landability, class-Thompson, close-oracle, autonomyScope) reads them at its own grain on its own node.

**Shared capability: an outcome-labelled, network-held, per-gap attempt ledger with a single admission predicate.**
- **Seam:** the `substrateGap` write path at the gap-store holder (every compose node already sends `failed_attempts` rises and closes there, which is what 5.5(iv) used). It pairs with the one admission function that every dispatcher (auto-pick, drain, directed, named, decompose, nudge) must call before a compose starts.
- **Contract:** each attempt is recorded once, with the label `{ran: drafter_failed | landed_measured | landed_unmeasured} | {did_not_run: busy | environment | triage_only | held | withheld_by_scope}`. Only `ran:*` rows move any posterior. Posteriors are derived from the ledger, not kept as independent counters: per gap first, pooled up to category only as a *prior* with decay. The derived posteriors are the calibration, the class Thompson, the close-oracle trust and landability. Eligibility is a rate (the per-gap backoff already in gap-to-feature.ts:66–100, "NOT A SEAL") plus a scheduled re-test. It is never a permanent category `continue`. A human answer is one more ledger row, delivered by **shape** through discovery.
- **Operating-model fit:** this is the "route around, then encapsulate on evidence" rule applied to the lane itself. Evidence that a family cannot land accumulates *per gap*, drives a decomposition or needs-information request (a produced goal), and never silently removes the family from the future.

---

## 4. Current verified state (2026-09-29 04:58–05:10 UTC, both nodes)

| Check | Node 1 `substrate-live` (holder) | Node 2 `compose2-live` |
|---|---|---|
| `/workspace/expectation-calibration.json` | 143 categories, mtime 09-29 03:56. **33 sealed** (≥ 8/0), including `trace_store_reconciliation` **636/0**, `db_performance` 371/0, `orphaned_capability` 345/0, `detector_coverage_gap` 26/0, `measurement_integrity` 16/0, `documentation_drift` 11/0. **23 at exactly 8/0** | 18 categories, mtime **09-28 17:25** (no local writes since 5.5(iv)). 12 sealed, including `trace_store_reconciliation` 400/0, `edit_intent_route` 21/0 (node 1: 2671/99) |
| Which table `hopeless()` reads | local (it is the holder) | holder's table since 18:27. Three `gap store returned no calibration … using the local file` warnings at 18:21–18:25, none after |
| `hopeless_excluded` in pick lines | 58–64 all of 09-28 12:00–23:24 (pool 2–10). **0 from 23:32** (pool = 2) | 124–129 until 18:21. **66–68 from 18:27 to 23:26** (pool 51–59). **0 from 23:31** (pool = 7) |
| Admission, latest | `863 candidates → 0 admitted` {not owned here 426, needs_information 340, autonomy_scope 68, protected_vessel 22, operator_hold 4, no_groundable_target 3} (04:28–04:51) | `863 → 0` {needs_information 436, autonomy_scope 271, not owned here 129, operator_hold 24, no_groundable_target 3} (04:23–04:51) |
| `autonomyScope` pool record | `require_falsifier_classes` [class1, class2], 27 excluded paths, updated 09-28T23:28:25Z | same, 23:28:25Z |
| `gap-class-posteriors.json` | 253 classes, α > 1 on **5**, max α 17, max β 371 | 16 classes, α > 1 on 3. **Forked** |
| `close-oracle-calibration.json` | `landed_commit` 0 closes / **2149** false; `measured` 237/0 | `landed_commit` 0 / **31**; `measured` 9/0. **Forked** |
| Escalation delivery | `ui-write-passthrough.ts` pinned to `127.0.0.1:8270` (only commit `1f9090e`). stateful-ui **active**: 369 questions, **336 `needs-human-*`**, none carry an answer. uiFeedback log has 81 `needs-human-*` answers ever, last 09-27 10:55. 46 hopeless escalations accepted since 09-26 | stateful-ui **inactive**. Escalations `THREW … Unable to connect — no human was asked` (09-29 01:38) |
| Live exemptions | 5 open gaps carry `human_exemption_attempts_remaining > 0` (of 1,817 open) | — |
| Gap store coverage of this class | Open: `248-escalations-were-asked-of-a-vessel-no-human-reads`, `operator-escalation-backlog`, `a-directed-gap-to-feature-refused-for-capacity-bumps-failed-attempts…`, `the-gap-write-nudge-starts-a-compose-pass-without-checking-lane-capacity…` (+3 recommit echoes), `hopeless-gap-escalation-dedupes-in-process-memory…`, `orphaned-capability-escalation_disposition_apply`. **No gap names the class itself** (0 ids contain "calibration" or "-seal") | reads the holder |
| `gap-landability-model.ts` (auto-close < 0.25) | **Dormant.** Exports `runLandabilityDetector`, but the only mentions elsewhere are a comment (gap-lifecycle-scan.ts:12) and a state-file name (model-opportunity-scan.ts:53). No state file exists, and there are **0** `gap_landability_low` in the 7 d journal. openspec-10 ("imported by nothing") is right. gap-history's "gates auto-close at 0.25" describes code, not behaviour | same HEAD |

**Reading.** The category seal is **latent, not lifted**. Right now it excludes nothing only because admission (needs_information, autonomy_scope, ownership) empties the pool first. Once the pool is refilled, the 33 holder-sealed categories apply on both nodes (as they did 18:27–23:26). The sealed categories keep being worked through other entrances. The escape asks a vessel no human reads (node 1) or a dead one (node 2). Stage-1 containment as a mechanism **worked** (openspec-7, falsifier 1.5 passed). As a class-level remedy it is **partial**: it oscillated twice and now admits 0.

---

## 5. Every prior attempt at the shared capability, and why it did not hold

| # | Attempt (axis it changed) | Why it did not hold |
|---|---|---|
| 1 | `d1bb37a` 06-30: category calibration + penalty (threshold) | Implemented as a hard `continue` with no re-test. Category grain. Trained on a wrong land label |
| 2 | `e78f8da`, `7833b6a`, `8a1a761`, `eb450e4` 06-28..07-01: landability ranking and mispredict penalty (ranking) | Rewards classes that "land" hollowly. No outcome-measured label |
| 3 | 07-09 env-vs-fix attribution C1 (predicate) | Partial. Present in 2 files, not at every writer. Tracking gap lost |
| 4 | `143212a` 08-06: real exclusion, human as the escape (escape) | The human path had no reader, no apply step and, later, no human surface |
| 5 | `4b1f862` 08-14: per-class close-oracle posterior (evidence class) | Node-local (2149 vs 31). Label = re-detection, which exclusion itself suppresses |
| 6 | 08-26/27 gap filings ×8 (5 closed) | Closed by landings that changed a site, not the class. The closure oracle trusted `landed_commit` |
| 7 | `421052c`/`9cb83d0`/`891304c`/`91cc1ff`/`60722a6` 08-28/29: escape read-back and executor (escape) | Answer stored as prose (link 4). Delivery pinned to `:8270`, which was replaced by 09-22. Node 2 target inactive |
| 8 | `5472e8b` + `be891f3` 08-29: non-attempt predicate at 3 sites (predicate) | Per-call-site, not per-entrance. The 08-31 autonomous cleanup deleted the requeue. New entrances (nudge 09-23, directed 09-24) bypass it |
| 9 | 09-02 `requeueAfterNonAttempt` proposal | Never decided (ask-first) |
| 10 | 09-05 gap `hopeless-seals-at-8-attempts-but-needs-271…` (threshold statistics) | Lost at the store reset. Never re-filed |
| 11 | 09-14/15 operator answering escalations (manual escape) | Answers 3→31, applied 1–2. Truncation. Operator-load-bearing (law 13 violation) |
| 12 | `03d98c1` 09-25: persistent escalation dedup | Stops re-asking. Does not make an answer arrive |
| 13 | `55fba0e` + re-baseline 09-26: outcome credit (credit timing) | Rhythms only. Wiped by substrate commit `329fc5c`. Node-local |
| 14 | autonomyScope 09-27/28 (supply by record edit) | Operator-held knob, not a learned disposition. Oscillated 250 → 2–5 → widened → 8 landings / 1 improvement → re-tightened → 0 admitted |
| 15 | `76bf256`/`094c230` 09-28: holder-held calibration (read location) | Moved *where* the table is read, not *what* it means. Node 2 went from 12 local seals to the holder's 33. Class posteriors and close-oracle stay forked. The claim "hopeless_excluded 0" is refuted |
| 16 | Per-gap exponential backoff (gap-to-feature.ts:66–100, "NOT A SEAL") | The right primitive (rate, not eligibility), but it runs **alongside** `hopeless()` instead of replacing it |

**Pattern.** None of the 16 changed grain (category → gap), entrance coverage (all dispatchers) and label (measured outcome) together. Each fixed one and was undone, bypassed or propagated through the others.

---

## 6. What to keep (resolvers and fossils)

- **Keep, and make the core of the capability:** `isNonAttemptComposeResult` (the label vocabulary, gap-to-feature.ts:3436+), the per-gap exponential backoff (:66–100), the holder write path used by 5.5(iv) (`substrate-gap.ts` `include_calibration`), `escalation_disposition_apply` (the apply side is sound; its input is dead), `closeOracle` `measured` class (237/0 vs `landed_commit` 0/2149: the measured label is the one that holds), and the `55fba0e` outcome-credit rule.
- **Retire or fold:** `hopeless()` as a permanent category `continue`. Fold it into the prior-with-decay feeding the backoff. `gap-landability-model.ts` is dormant: no caller, no state file, 0 fires in 7 d. Do not revive it as a fourth landability model; the capability supersedes it. Also retire the pinned `STATEFUL_UI_ENDPOINT` in `ui-write-passthrough.ts`: route by shape (endpoint-routing).
- **Do not hand-edit** any `*calibration*.json` or posterior file (memory 08-27). Recovery must land as code through the lane, with `directed:true` for excluded-path sites.

---

## 7. Retire condition (conjunctive, continuous, checked on every node)

An empty pool satisfies both "hopeless_excluded 0" and "0 admitted", so neither counts alone. The class is retired only when **all** hold over a rolling 24 h window on **every** node:

1. **Non-vacuous unsealing.** Among pick lines with `pool ≥ 10`, `hopeless_excluded == 0`, *or* every excluded gap has a scheduled re-test within its backoff window (no gap excluded by category alone for > 24 h).
2. **No frozen or ghost counters.** The count of categories at exactly `attempts == 8 && lands == 0` is 0. No category or gap with `lands == 0` gains attempts from an entrance that did not record a `ran:*` label (drain, directed, nudge, named). Operationally: no sealed or backed-off gap receives > 1 drain dispatch per backoff window. Today `trace_store_reconciliation` receives hundreds per day.
3. **Refusals are free at every entrance.** A BUSY, environment, triage-only or scope-withheld result leaves `failed_attempts` and all posteriors unchanged, on the auto-pick, directed, nudge and drain paths alike. The falsifier of the 09-24 parked gap (five BUSY in five minutes → fa unchanged) passes on both nodes.
4. **One evidence table, network-wide.** `expectation-calibration`, gap-class posteriors and close-oracle trust are derived from one holder-held ledger. The divergence between nodes of any row read by admission is 0 (today: 2149 vs 31, 253 vs 16 classes).
5. **Escape is live.** Every gap excluded for more than 7 days has a ledger row that is either an answered human question delivered by shape to a surface a human reads, or an automatic re-test / decomposition attempt. The count of unanswered `needs-human-*` on a replaced vessel is 0 (today 336).
6. **Supply without a hand knob.** Admission ≥ 1 on each node in every hour where ≥ 1 gap is class1/2-falsifiable, owned and unheld, with `autonomyScope` unedited for 7 days.
7. **Durability.** No gap re-filed for this root (capacity-as-failure, category seal, node-local calibration) for 30 days after conditions 1–6 first hold (gap triple, law 7).

**Counter-example to keep in view.** After `76bf256`, node 2 moved from 12 local seals to the holder's 33, with `hopeless_excluded` 66–68 at pool 51–59. "Held at the holder" alone therefore does not satisfy condition 4 in spirit: a single table that seals by category is still the class.
