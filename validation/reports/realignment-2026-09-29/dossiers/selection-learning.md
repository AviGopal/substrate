# Dossier: selection-learning

**One line:** Since April, the system has repeatedly claimed that execution outcomes steer selection, and it still does not measurably happen. Credit and selection each run on many independent writers, readers, keys and selectors. No shared, continuously running check shows that a graded outcome reaches the belief the selector actually draws from, or that the draw then shifts traffic.

Inputs: `classes/selection-learning.json` (135 attempts, 51 problems, 25 claims), `raw/*.md` (git-super-1/2, git-activityapi, git-goalhost, git-mid, memory-1..10, reports-*, transcripts-1..4, timers-readers, node2-runtime, live-activities, live-gaps), `_mech_chunks/*` (184 mechanisms tagged to this class). The live state was measured on 2026-09-29 between 04:30 and 05:00 UTC on `substrate-live` (node 1, hub) and `compose2-live` (node 2, spoke), read-only.

---

## 1. What the class is

The class covers every way the loop from **trace to verdict to posterior to draw to dispatch** fails to compound. The symptoms seen over six months:

- The posterior does not move.
- The posterior moves in one direction only (beta without a possible alpha, or alpha without a possible beta).
- The posterior moves, but on a key the selector does not read.
- The selector reads it, but through a broken draw.
- The draw is right, but dispatch bypasses it (pinned `targetTemplateId`, `templateId` tasks, boredom's UCB, the LLM `selectArm`).
- The posterior is poisoned by environment failures, then erased by decay.

The source records count 14 recurrences in git-activityapi alone. Summed across sources, the recurrence counters exceed 150, not counting the 1,036-per-day pinned-dispatch loop.

---

## 2. Dated timeline, with each claim and what later showed

| Date | Event (hash / artefact) | Claimed | Later |
|---|---|---|---|
| 02-20, 02-23, 03-16 | Thompson "complete" (git-super-1) | Learning selection done | No sampling existed. Expected value `a/(a+b)` only |
| 03-25 | `c4ef84df` real Beta sampling | Proper Thompson | Re-implemented again in microplastic `bcaf315d` (03-27) and SurrealDB `fn::beta_sample` (04-30). **First of at least 4 sampler implementations** |
| 04-13 | `bb992c92` migration 059: alpha/beta on the `activity` table | Score updates enabled | UPDATE matched plain strings against record ids |
| 04-19 | `2663963b` `record::id` fix, migration 060 | "Learning loop now operational" | 04-22 `9000aaed`: "Templates showing 0 runs (Thompson not updating)". On 09-29 all 4,010 `activity` rows still hold alpha=beta=1 (see §5) |
| 05-18/19 | Chain-credit ancestor fix; state-space signature v1 keying | 12/16 tasks | S2–S6 discrimination acceptance never measured; the v0 reaper was never built |
| 05-23 | Specs for cost-weighted posteriors and an LLM model MAB | — | 0/26 and 0/33 tasks. Dormant, superseded by value-per-cost 09-20 |
| 05-24 | `14e23e95` boredom switched `goal:` to `templateId:` | Stops registry thrashing | `efa25a46`: 199 successful executions, all at alpha=beta=1, total_selections=0. **Selection routed around** |
| 05-25 | `766cdbea` normalizeActivityId plus a direct SQL `org_id` patch of VPM | iter-21/24: "Thompson converging" | The proof arm was the self-looping validator-dispatch (301/301 dominance, about 85% self-loop 06-04) |
| 05-25 | F-083 "restart destroyed posteriors" | CRITICAL | Debunked 05-26 (`612521ce`): an over-broad grep |
| 05-25..30 | `cb4dd022`, `26390d62` hand reset of posteriors (F-069) | — | Operator edit of learning state. The class recurred 06-17 |
| 05-26 | `c8e48cb2` `targetTemplateId` bypasses recommend() | Named goals route | Selection routed around, not repaired |
| 05-27 | "alpha grows on selection, not success" (HIGH) | — | Retracted in iter-035 (750/827 successes) |
| 05-29 | `f0886c2`, `937c4a2` CTS and impulse_relevance forward wiring | — | **Held**: 0 rows 05-28, 29,202 CTS rows on 09-29 |
| 05-30/31 | Info-gain bonus spec; failure-mode taxonomy extensions | — | Both dormant. `infoGainFactor` and `root_cause_step` are absent |
| 05-31 | "S2 sustained over 3 windows" | — | 06-13 boredom livelock on mitosis-tick |
| 06-04 | LR-1..LR-8 learning-rate mechanisms | "M1–M6 all tracked and improving" | M1 embedding prior env-gated off (`EMBEDDING_PRIOR_ENABLED=false`, law 1). LR-4 tier bandit starved auto-promote. LR-8 clustering runs (4,166 runs) with no rate acceptance |
| 06-14 | `3b6219294` information-yield reward for boredom UCB | Replaces completion reward (86% of picks at mean 1.0) | Worked, but the same reward later made detectors win about 98% of picks (09-16) |
| 06-14 | "Substrate IS autonomous and converged" | — | 06-17 forward model poisoned (mean 0.004) |
| 06-17 | `460cc35a` recompute-poisoned-posteriors | Repairs 26 variants | 37,810 failed traces carried no failure_mode. The upstream fix was deferred. The script is now a fossil in `/workspace/active-scripts` |
| 06-22 | boredom `008ae03` NaN score guard | — | NaN root in combinedCostAdj never found |
| 06-26 | "Signature starvation FIXED (98% coverage)" | — | 07-31: drafter counters 0/0/0 after 4,649 runs |
| 06-25..07-01 | Cross-signature reputation penalty (flag OFF) | — | Measured flips never recorded |
| 07-10 | boredom `4706b894` UCB cold-start infinity | Worked | — |
| 07-16 | `a4ff8b2`, `e2b40c9`, `78b164b`, `1e2e628` walk ran without posteriors | Probe 9ad2610c showed real alpha/beta | 4 cutovers that day were no-ops; deployed by `docker cp` |
| 07-17 | boredom `c606ab5` candidate set frozen at 100 oldest | Paginate | The same 100-row cap later defeated `314f228` (09-05) |
| 07-19 | `790114c` Beta sample at pick plus `sampled_score` | Curated reach 0.70 to 0.80 | 07-20 split brain: runtime stale on one node |
| 07-22 | `159bca7` three-way classifyReach; goal-host `16bde03` creditReachedTemplate | Honest posterior | reached=true on 1/108,119 rows. dAlpha=2 fabricated for satellite ids (404) until `4250971` (08-02). legacy-success fail-open |
| 07-29/30 | `1b0c693` 3-day half-life decay (copied from llm-resolver) | Re-exploration | 08-22 `99ae266`: decay erased 95.4% of evidence over 1,821 arms. **Learning did not compound for about 3 weeks** |
| 07-31 | llm-resolver `3839090` NaN pinned haiku; model unpins | Selection varied | Honest reach-to-arm grading (`gradeArmByExecution`) had **0 callers**. Now a fossil |
| 08-02 | `6f19696` additive updates, migration 186 | Stops int64 saturation | Held |
| 08-03 | goal-host `c84dbf9`, `ec243fd` break the 1612:0 beta/alpha ratchet | 3/3 credited | Substrate self-edit `d65f8bd` silenced the instrument (reverted `24d46fe`) |
| 08-04 | light-dispatch `66b95e1` retire keyed on the lying success_rate | Fixed | 21 working arms had been retired wrongly |
| 08-05 | `d553b39` goal_hash normalisation; `4cfef87` withhold never-reaching paths; `6c020d9` satisfier self-certification | — | 38% of executions had gone to 352 never-reached paths; 52% of paths had self-certified |
| 08-06 | Eight grade-to-credit fixes (`96684c4`..`1cd87a0`) | Loop closed | Proven on one execution; delivery coverage about 1.3% |
| 08-07 | Lenient parser, beta-on-nothing, floor seeding | — | All three reverted (17–18/48 vs 25/48) |
| 08-10/11 | `a2a7dfd`, `12e811e` Beta(1,3) untried prior | Learned arm wins 43% vs 0% | 24% of untried hub arms still draw Beta(1,1) (nullish chain) |
| 08-11 | LLM credit outage poisoned arms | Diagnosed | Repair filed, not made |
| 08-15/16 | `f2857fc` retirement binding; ias-executor `a56fe27` input_shapes roll-up | — | Retirement is starved (needs 20 hub executions, spoke traces spooled). **poor_performance retirements = 0 on 09-29** |
| 08-16 | goal-host `d69a4ad` real Marsaglia–Tsang sampler; `3b8ba963`, `6ac76284`, `be2b9933` | "Real Beta draw, posterior retirement" | Held (verified 09-28). The counterfeit draw had let a mean-0.142 arm pass the >0.5 gate 99.8% of the time |
| 08-16..08-22 | **Four multi-agent audits**, each "selection is memoryless" with a *different* cause | — | The class (writer key differs from reader key) was only named at R8's last link |
| 08-17 | `11cd301`, `0857a1c` increment discarded in **8 copies** of an UPSERT | Fixed | Had been fixed once in paradigm.ts; the other 7 copies were missed |
| 08-19 | `5be4cfa`, `784ec45c`, `3691ee7` truthful dBeta instruments | — | The log had claimed 12 penalties when 0 were applied |
| 08-22 | `4bcb9f81` credit wrote a 16-hex signature, selection read 8-hex, tier-3 view absent; `b66201d6`, `8ebcbb2a` org_id forms; `2ededef` abstain on environmental failure plus 30-day shaped half-life | "Every draw is Beta(1,1)" found and fixed | Decay logic duplicated in TS and SurrealQL. Previous-round fixes 0/96, 0/96, 0/358 confirmations: about 95% of traffic bypasses /recommend |
| 08-24 | `018784f` telemetry beta-pump stopped; `a7182c9` admission 1000; B1–B4 | "All four blockers resolved" 04:24 | B1 and B3 falsified 04:58. decision_outcome circular (09-03). Correlation producer tag on 0/9,614 |
| 08-26 | Consequence-verdict-into-credit proposal (`fe00585e`) | — | Dormant. `posterior-update.ts` never reads the 14,100 goal_verification_labels |
| 09-02..09-11 | reports-8 | — | 19/21 applied updates are beta. 90/102 selection-scheduled validators died of unpopularity |
| 09-04 | activity-api `0950143` total_selections prefix mismatch | "Four-link chain closed" | 09-06 recap still names the compose lane as ungraded |
| 09-05 | boredom `314f228` 69-line posterior guard (**substrate-authored**) | — | Inert twice: nonexistent field `t.identifier`, 100-row page cap. Replaced by operator `4e17f86` |
| 09-05 | `40395ba` counterIntegrity | — | slot-binding 243,063 claims / 5 selections. Repair never done |
| 09-06 | ias-executor `3c7808a` pinned-target posterior refusal | 2,345-failure arm went flat | 1 catastrophic case (auth_resolve_v1 151x inflated). **Caller never learns** (see §5) |
| 09-06 10:43 / 11:16 | "Compose grading closed"; "posterior moved 1 s after first verdict" | — | 12:04 retracted; 09-07 00:07 falsified by own scorecard |
| 09-07 10:02 | /reach ordering defect | "Verdict to belief CLOSED AND PROVEN" | 09-08 22:58: autonomous `3d648ad` signature namespace change froze the posterior again |
| 09-08 23:47 | "Instrumentation compounding" (credit 0.6% to 71%) | — | Reach flat at 4.4% over 72 readings; alpha +5.91 vs beta +364 |
| 09-09 | `8a3804ff`, `22146522` validator-liveness and rhythm-cadence moved to systemd timers | — | Routes critical cadence **around** selection, because selection starved it |
| 09-10 | `learning-loop-selftest-tick` with severed-link controls | Red on first run with a real bug | Still RED on `posterior_delta` 09-29 (see §5); never ran on node 2 |
| 09-12/13 | llm-resolver `fec22cbc` drafting grades into model arms | "Root cause found and fixed: drafting was ungraded" | All arms 2–6%. FAVORABLE 0/16. Selector-inversion claim retracted the same day |
| 09-16 | learning_policy_writeback writes TD_LAMBDA=0.6 | Self-tuning | Evidence `templates_fetched:0, total_sample_volume:0`. state_signature 0/96,747 rows |
| 09-16/17 | Satisfier posteriors inverted (webSearchResult a2/b185 with 167/189 ok); pool 98% observation / 2% repair | — | Open |
| 09-18 | `model-reality-phantom-failure-*`, `model-reality-selector-unscored` gaps | — | Open 09-29 (8+ phantom-failure gaps) |
| 09-20 | `e1979f77`, `092eac27`, `6d998681` state_signature recorded, conditioned view applied | F-WRITE and F-PRIOR met | **F-SELECT not established** |
| 09-24 | `4921332d` (184 failures, beta never grows), `382abd16` (task-thrown failures graded "ungraded" means 0/0) | — | Gaps still open 09-29 |
| 09-25 09:45 | activity-api `53d8e77` score-read id normalisation; `72aad357` | "**Selection now draws from learned posteriors**" | Reach 18/31 before vs 0/2 after. "Re-measure at n>=30" was **never recorded**. The gap `the-legacy-score-read-matches-no-rows…` is still open 09-29 |
| 09-26 | `5f01d5ef` lever 1: beta on outcome. Scaffold pin attributed to boredom, then retracted 10:00 | — | Sender still unattributed 09-29 |
| 09-27 | activity-api `97adc04` successYield (5.2) | Landed byte-equal | No before/after. 5.1/5.3/5.4 value-per-cost selection unbuilt |
| 09-27 | `eb2b8fcf` review of 97 specs | — | Still names "no reward, so alpha=1, so random selection" as the loop that keeps the operator load-bearing, **two days after** `72aad357` |
| 09-27 04:43 onward | Node 2 learning-loop-selftest: `Module not found` every run | — | Masked 09-28. Misdiagnosed as "clone behind"; the file is deleted in node 2's worktree |
| 09-28 | `70254535` joint-liveness extended to 6 joints; `selector-novelty-degeneracy` gap | — | 5 `severed-joint-*` gaps open, no edit_site |

**Pattern:** 12 explicit "closed/fixed/proven" claims in this class. Every one was followed within 0–3 days by a retraction, a falsification, or a re-freeze from a new seam. The two durable wins (additive updates `6f19696`, the real sampler `d69a4ad`) each fixed a single computation. Neither fixed a junction between writer and reader.

---

## 3. Root causes (distinct)

1. **Belief is written in many places under many keys, and read in others.** At least six belief stores: the `activity.thompson_*` columns (vestigial), `variant_performance_metrics` (`thompson_alpha/beta`), `context_thompson_scores` (`alpha/beta`, signature v0/v1), signature-cluster posteriors, `goal_execution_paths`, the LLM model-policy arms, `/workspace/gap-class-posteriors.json` (per node), boredom UCB means, and rhythm posteriors (per node). The key disagreed each time in a different field: plain string vs record id (04-19); `activity:<id>` vs bare id (05-25, 09-04, 09-25); 16 vs 8 hex signature (08-22); org_id forms (08-22); signature namespace (09-08, autonomous `3d648ad`); a missing view (08-22).
2. **Credit is keyed on effects, not outcomes (law 12).** Crediting HTTP success, template exit status, `resolved===true`, self-reported satisfier verdicts, capacity BUSY, provider outages, and phantom failures from readback checks. Ungraded outcomes mean 0/0, so thrown failures never teach (09-24). Reach-time credit is never revised by later consequences (goal_verification_labels unread, 08-26).
3. **Credit is asymmetric by construction at some sites.** Beta without possible alpha (goal-host, 5 recurrences 07-22..09-22). Satisfier steps withhold both (4,335 WITHHELD per 24h). 19/21 applied updates are penalties.
4. **Dispatch bypasses selection.** `templateId` tasks (05-24), `targetTemplateId` (05-26), boredom's hardcoded scaffold dispatch (2,320 dispatches at 0.07%), the pinned dispatcher, systemd timers for validators (09-09). Separate selectors (boredom UCB, LLM `selectArm`, concept-db upkeep Thompson that resets on deploy, the gap picker) never share the belief. The pinned-dispatch guard was placed at the refusal site, not at the caller, so the caller never learns.
5. **Constants copied across populations.** The 3-day half-life from LLM arms to week-cycle templates erased 95.4% of evidence. Beta(1,1) swamps learned arms at pool size about 650.
6. **Silent truncation of inputs.** 100-row page caps (07-17, 09-05), admission LIMIT 10 or 150 by recency (08-24), input_shapes `[]` (08-16), non-atomic CTS writes losing about 49% on conflict (reports-7) and about 650/h (gap 09-25).
7. **Identity too fine or too coarse for evidence to accumulate.** goal_hash kept the gap hex, so 78.6% of paths ran once. 74% of arms had n=1. State signature revised 5 times. Step-count identity was disqualified. Minting of one-shot detector templates and learned-* twins splits traffic (law 3).
8. **The instruments themselves lie or are blind.** The dBeta log claimed penalties not applied. decision_outcome captures only graded rows. thompson_selection_log is blind to walks and pathway reuse. The selftest cannot test `posterior_delta`. Detectors that open SurrealDB directly fail on a spoke and got masked.

---

## 4. Why it recurs: the missing shared capability

Each fix repaired **one site** of a junction that has **many sites**. None made the junction itself observable. The WHY-THINGS-KEEP-BREAKING review (via `2ca586ba`) puts it as "every change is validated locally and once … humans are the detector". For this class specifically:

- There is **no single belief contract**: no one `keyOf(arm, context)` function and no one read/write API that credit writers, the /recommend draw, discover-by-shapes, the goal-host draw, boredom, llm-resolver and the pinned-dispatch guard must all go through. Each site re-derives the id form, the signature width, the org form and the table. So every refactor anywhere (including autonomous ones: `3d648ad`, `314f228`, `d65f8bd`) can silently re-sever the junction.
- There is **no end-to-end learning conservation oracle** running continuously on every node. The oracle would check three things. A graded outcome for the arm that was actually dispatched moves the belief under the key the selector reads. The belief the selector used at decision time equals the stored belief. Over a window, traffic moves toward arms with higher posteriors (F-SELECT). Every "closed" claim above was verified once, by hand, on one execution or one arm. The 09-25 claim explicitly deferred its re-measure, and nothing performed it.
- There is **no dispatch chokepoint**. Any caller can pin a target, and the posterior is consulted only as a refusal. `dispatchTargetTemplateId` (ias-executor `goal-host.ts:~897`) was identified on 09-05 as the right chokepoint and was only audited.

**Shared capability:** a *belief ledger with a learning-conservation oracle at the credit/selection seam*. Concretely:

- One owned key and one read/write API for posteriors (activity-api `posterior-update.ts` plus the /recommend and discover-by-shapes read). Every other selector reads through it by shape (`thompson_posterior`, already advertised but uncounted), not by table.
- Every selection logs the belief it drew from (store, key, alpha, beta), including walks, pathway reuse and pinned dispatch.
- A shape-routed conservation check (not a hub-only SurrealDB script) that runs as an activity on every node and files a gap with an edit_site when any of the three invariants breaks.

This is the "joint registry" seam that git-super-2 names (`70254535`) applied to the credit to belief to draw to dispatch chain. It is a general capability, not another per-site fix.

---

## 5. Prior attempts at that same capability, and why none held

| Attempt | Date / where | What it covered | Why it did not hold |
|---|---|---|---|
| Hand audits (F-series, iter-21..035) | 05-24..05-31 validation/findings | Posteriors vs outcomes | One-shot. The proof metric was a self-looping arm. No standing check |
| Reuse hit@k benchmark | 05-13..08-01 validation/results | Selection quality | Stale May expected ids gave 0/0/0 on 07-05, 07-10, 08-01. Weekly workflow 20/20 failed on a missing secret 05-18..09-28. Fossil |
| `recompute-poisoned-posteriors` | 06-17 `460cc35a` | Recompute from counts | Repairs state, not the source. Operator-run, no caller. Fossil |
| Truthful instruments (dBeta) | 08-19 `5be4cfa`/`784ec45c`/`3691ee7` | Log equals sink | Log-level only. Nothing asserts it continuously |
| Four multi-agent audits | 08-16, 08-16, 08-21, 08-22 | "Is selection memoryless?" | Each found a different site. No oracle remained to catch the next |
| decision_outcome capture plus /decision-calibration | 08-24 `e2c7959` mig 202, `03e6c55` | Decision to outcome join | Captures graded rows only (circular, 09-03). No credit consumer. Joint severed (lag 4,193 s, gap open 09-27) |
| Selection-outcome correlation join | 08-24 `755dca9`, `471febb`/`7413367` | Selection id to execution | Producer emits the tag on 0/9,614 executions. Walks and reuse never log a selection |
| joint-liveness detector | 08-25 `daa2632c` | Write to read joints generally | 1 binding for 34 days, caught 0 of 179 breaks. Extended 09-28 (`70254535`) to 6 joints. Opens SurrealDB directly, so it fails on a spoke and is masked on node 2. 6 gaps filed, 0 closed, no edit_site |
| Write-key/read-key agreement detector | proposed 08-17 | Exactly this class | **Never built** (memory-8:491) |
| Evidence-aliasing static check | 09-03 `c851cbbb` | Writers that reset `updated_at` | Worked for its narrow lint. Not the belief junction |
| counterIntegrity | 09-05 `40395ba` | Counter vs selection census | Detects (243,063 vs 5). Repair never done; no gap-to-repair path |
| Conservation auditors (6) plus bridge | 09-06/07 activity-api `/conservation-audit` | Per-junction liveness | Became the traffic problem (61.6% of executions 09-07; 850 picks 09-16; about 20% of /recommend picks on 09-29). `/conservation-audit` registered twice |
| learning-loop-selftest-tick | 09-10 (`docs/validation/LEARNING_LOOP_SELFTEST.md`) | Per-link assertions over execution to learning | The closest attempt. (a) The `posterior_delta` link is structurally **untestable** with its probe arm: deterministic-tier and idle are both skipped, so it has been RED and "UNTESTED, not severed" every run. (b) It has **no selection link** (F-SELECT). (c) It is hub-only: on node 2 it has hit `Module not found` since 09-27 04:43, is masked, and its file is deleted in node 2's worktree. (d) 9 selftest gaps were mass-closed 09-28 01:27–01:29, uninvestigated |
| learning-liveness-probe | scripts/substrate, 6h | Probe execution moves the probe arm | Moves only its own arm (mean +0.000225). Injects synthetic success into live learning state (test residue on a cadence). Says nothing about real arms |
| learning_signal_health_observer | dev-vessel | Signal health | Dormant: minLoadedVolume 50 vs 34 loaded, so permanent cold start |
| Pinned-target posterior refusal | 09-06 `3c7808a` (ias-executor `goal-host.js:692`) | Posterior at the dispatch site | Refuses but does not feed back. The loop continues (below) |
| 72aad357 "selection now reads its learned posteriors" | 09-25 | Read path | Verified that reads return rows (406 vs 0). Never verified that selection shifts. Re-measure deferred and not done |

The common reasons: each check was one-shot, or hub-only, or tested only its own synthetic arm, or detected without a repair path. None asserted the **selection** end of the chain.

---

## 6. Current verified state (2026-09-29, 04:30–05:00 UTC)

Hub (node 1, `substrate-live`), SurrealDB `activity-system/learning_loop`:

- **variant_performance_metrics**: 6,744 arms. **3,503 (52%) at exactly Beta(1,1)**; 4,642 (69%) at alpha+beta ≤ 4; 768 updated in the last 24h. Among 779 arms with ≥20 executions, **94 have ≥10 successful executions yet alpha < 2**. Examples: `_activity_execute` has 1,034/1,034 successes at alpha=1, beta=1; `auto-bridge-goal_verification_label` has 117 ok at alpha=1, beta=3.6. Counters and posterior diverge. That is partly by design (exit status vs reach), but it is not attributable per row.
- **auth_resolve_v1**: alpha=1, **beta=420,097.5** (561,661 executions, updated 04:02 today). The 08-24 record calls the telemetry β-pump "stopped" with a scar of 401,706. Beta has since **grown by about 18,400**. So either the pump resumed or decay is not bounding it; not attributed.
- **`activity` table**: 4,010 rows, **0** with alpha or beta ≠ 1. Vestigial, and still a false-zero trap.
- **Retirement**: `retired_reason` distribution is null 3,999, failed_out 10, deprecate_impulse 1, and **poor_performance 0**. `development-vessel:scaffold-and-publish-vessel` (alpha 5.59, beta 7,823.8, 1 success in 8,022) is `retired:false, deprecated:false`. Its repaired twin `repaired-…-8eeb2587` (0/154) is also unretired.
- **thompson_selection_log**: 61,077 selections in 7d. **35,605 (58%) went to arms with alpha+beta ≤ 4**; 17,096 (28%) at exact Beta(1,1). Last 24h: 4,123 selections over 119 arms, 673 (16%) at Beta(1,1). Conservation-* families take **20.7%** of picks and `proposed_*` 7.5%.
- **The decision-time belief matches no stored row.** Example: `auto-bridge-feature_compose` is logged at selection with alpha 4.16 / beta 12.9 (09-28, ×133). The VPM row is alpha 1.0 / beta 6.6, and the two CTS rows are 1.17/13.43 and 0.017/10.98. The selector's belief is some blend whose source is not recorded, so nobody can check that credit reached it.
- **context_thompson_scores**: 29,202 rows, 1,659 touched in 24h, and **19,696 (67%) with n_observations ≤ 1**.
- **Pinned-dispatch loop**: `error: refusing pinned target development-vessel:scaffold-and-publish-vessel … (alpha=5.59 beta=7823.77 rate=7.13e-4 over 7829 observations)`. **270 per 24h on node 1 and 473 per 24h on node 2**, from `goal-host-vessel` journal `index.ts:692`. The sender is still unattributed (retracted 09-26 10:00), and the refusal never feeds back to the caller.
- **learning-loop-selftest** (node 1, 01:34 today): GREEN trace_write, verdict_delivery, goal_path, confinement; **RED posterior_delta** ("UNTESTED by this probe, not severed"). There is no selection link. **Node 2**: timer masked; last runs 09-27 04:43 to 09-28 04:44 all `Module not found`. joint-liveness and validator-liveness are also masked on node 2.
- **learning-liveness-probe** (node 1): "ALIVE, posterior followed (+0.000225)" every 6h. That is its own synthetic arm only.
- **Boredom selector, node 1**: in the last 3h, **624 of 680 reservations (92%)** went to `development-vessel:gap-to-scenario-bridge-tick`. The log line reads `mean=0.20 … picks=50 … idle×501`: the idle counter climbs every tick while `picks` stays at 50, so the UCB bonus never pays down (the "cheap-tick shortcut" re-reserves every about 5 s). **Node 2**: reserves `gap-goal:severed-joint-ribosome-registered` every 10 min at picks 1–3. The posteriors are per node, so the two nodes learn different things (gap `an-operator-pause-and-rhythm-posteriors-are-node-local…`, open).
- **Open gaps in the live store** (`/workspace/git/super-repo/gaps/gaps.json`, 6,279 total): **46 open** match posterior, thompson, selector, credit, severed-joint, selftest, phantom-failure or ungraded; 12 closed. They include `the-legacy-score-read-matches-no-rows-so-selection-runs-on-default-priors` (open, although `53d8e77` landed 09-25), `a-template-whose-tasks-throw-is-graded-as-ungraded…`, `variant-performance-metrics-record-failed-executions-but-thompson-beta-does-not-grow…` (×2), `about-650-write-conflicts-an-hour-drop-context-thompson-scores-updates…`, `the-walk-withholds-both-alpha-and-beta-for-satisfier-steps…` (plus narrowed and recommit duplicates), `model-reality-selector-unscored` (since 09-18), 7 `model-reality-phantom-failure-*`, 5 `severed-joint-*`, `selector-novelty-degeneracy`, and `service-failure-learning-loop-selftest`. Several carry `-narrowed` and `recommit-` duplicates, so the class also feeds narrowing-duplicates.

**Verdict:** the class is **live and recurring now**. The individual computations that were fixed still hold (additive update, real Beta sampler, abstain on environmental failure, 30-day decay, admission widening, CTS population). The junction from outcome to belief to draw to dispatch is still unobserved and demonstrably broken in at least four live places:

1. A decision-time belief that matches no stored row.
2. Arms with many successes held at alpha=1.
3. A 0.07% arm that is never retired and is pinned about 740 times a day.
4. A boredom UCB with a frozen pick counter.

---

## 7. Keep / fossil (for the realignment inventory)

**Keep (general, held under measurement):**
- `src/beta-sample.ts` (goal-host `d69a4ad`)
- `fn::beta_sample` plus additive updates (`6f19696`)
- `reach-classify.ts` with `isReachInapplicable` abstention (`159bca7`, `018784f`, `2ededef`)
- Shaped half-life via `substrate_tuning_param` (`THOMPSON_DECAY_HALFLIFE_DAYS`)
- `a7182c9` admission widening
- CTS forward wiring
- The /reach single writer plus `applyOutcomeToPosteriors`
- `posterior-aggregator` (the proposed CTS coalescer)
- learning-loop-selftest-tick: keep it as the seed of the oracle, but it must gain a selection link, a stochastic non-idle probe, and shape-routed operation on every node
- joint-liveness pool-registered joints (`70254535`): the joint-registry seam
- The pinned-target refusal: keep it, but move it to the caller as a chokepoint
- counterIntegrity

**Fossil or retire candidates:**
- `activity.thompson_*`, `ev`, `*_executions`, `learning_track` columns (4,010 constant rows)
- `activity_template` counters and the `v_activity_score` / `v_paradigm_execution_traces` reads
- `gradeArmByExecution` / `recordPendingArmOutcome` (0 callers)
- `recompute-poisoned-posteriors.ts`
- The legacy `checkAndRetireTemplate`
- The reuse-harness weekly workflow (20/20 failing)
- `SATISFIER_REUSE_ORDERING_ENABLED` (env-gated, law 1)
- `EMBEDDING_PRIOR_ENABLED`-gated M1 (5,131 rows, org_id `default` never matches)
- boredom's templateId bypass path
- The duplicate `/conservation-audit` registration
- `learned-conservation-*` twins of the seeded conservation observers (law 3 split)
- `thompson_posterior` / `variantMetricsSummary` fake alpha/beta derivation
- `learning_policy_writeback` (writes TD_LAMBDA from zero evidence)

---

## 8. Retire condition (measurable, checked continuously by an activity rather than by the operator)

The class is retired when **all** of the following hold for 14 consecutive days. Each is measured by a shape-routed conservation activity that runs on both nodes (node 2 resolving the hub store through discovery, not a local SurrealDB), and each files a gap with an edit_site on breach:

1. **Credit reaches the read key.** Of rolling-24h graded executions (reached or not-reached, excluding abstentions), ≥95% produce a posterior delta on the exact (store, key) the selector reads for that arm. The selftest `posterior_delta` link is GREEN using a stochastic-tier, non-idle probe arm, on both nodes.
2. **The decision-time belief equals the stored belief.** ≥99% of `thompson_selection_log` rows, and the equivalent logs for walk, pathway-reuse, boredom and pinned dispatch, record (store, key, alpha, beta, blend components), and their values match the stored rows at selection time within tolerance. Today no stored row matches `auto-bridge-feature_compose`'s logged 4.16/12.9.
3. **Selection follows belief (F-SELECT).** Over 7 days, among arms with ≥20 graded observations competing for the same target shape, the Spearman correlation between posterior mean and selection share is ≥0.3. Arms with ≥10 successes and alpha < 2 are 0, down from 94.
4. **Decisive negatives stop being dispatched.** No arm with ≥100 observations and posterior mean <0.01 is dispatched or refused more than once per day on any node; today scaffold-and-publish-vessel is at about 740/day. `poor_performance` retirements are >0 whenever such arms exist.
5. **No pick-counter freeze.** No boredom or rhythm arm takes >50% of reservations over 3h while its `picks` counter is unchanged; today that is 92% at picks=50.
6. **Durability.** Zero new gaps in this class (posterior, thompson, credit, selector or severed-joint keywords) opened for a root cause already recorded in this dossier for 30 days. This includes gaps caused by autonomous landings (the `3d648ad` pattern).

Until conditions 1 to 3 are checked by a running activity, no "selection now learns" claim should be made. The last 12 such claims were each overturned within 3 days.
