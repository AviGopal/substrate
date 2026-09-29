# Dossier: drafter-quality

**Class key:** `drafter-quality`
**Date:** 2026-09-29. Live checks ran read-only against node 1 = `substrate-live` (hub, standalone) and node 2 = `compose2-live` (PROFILE=compute).
**Inputs:** `classes/drafter-quality.json` (55 drafter-quality attempts, 34 problems, 6 claims, plus 2 `edit-primitive-safety` rows); `_mech_chunks/*` (≈45 drafting mechanisms); `_principles.json` (≈45 drafting principles); raw `transcripts-2 §2.4`, `transcripts-4` (C21, C34, C36, drafter-quality section), `live-gaps`, `memory-3/4/8/9/10`, `reports-*` records.

## One line

The system can **apply** a specified code change (operator exact-edit goals: 4/4 on 09-25, and 80% on 09-13), but it cannot **derive** that change from a problem. Autonomous derivation has been measured at 0.9–4.3% (09-13), 15% (09-10) and 42% (09-25, measured over a different denominator). Every fix since June has improved one input to the LLM transcriber:
- the window
- the anchor list
- the lesson
- the refiner
- the model

No fix gave the system a way to produce the **mechanical edit form** itself: verified-unique `old→new` blocks, or an index into a verified anchor list. The live refusal on 09-29 02:43 (`addresses:false`) repeats, word for word, the 08-13 finding "the bottleneck is now DRAFTER QUALITY".

## What this class is (and is not)

**In the class:** failures at draft time, between a correct, localized gap and an applied diff:
1. **Transcription and adherence.** The drafter paraphrases anchors, invents symbols, APIs, packages and paths, and appends semicolons. It writes stubs (`// Add logic...`) and edits comments or strings instead of code.
2. **Multi-op shedding.** A plan with N edits lands with fewer than N applied. Examples: the one-op-per-goal principle (07-18, 08-15, 09-10), `3cced35` (09-27), and `f49d02e` landing 4 of 5 (09-26).
3. **Localization of the edit window.** The window is mis-centred or too small (the first 3% of a 176 KB file on 08-07; the first 7,000 chars of a 17.9k-line file on 09-28), or edits land at the wrong site (35 of 123 failed drafts on 09-25; 1,602 lines away on 08-16).
4. **The teaching channel.** This is `compose_lesson` and the judge reasons that are meant to correct 1–3 over time.

**Not in the class** (routed out; boundary rule from memory-3: *"environment failures must not be charged to the drafter"*):
- **Grounding window of 0 bytes** from the stale super-repo copy (09-13 discovery `/bootstrap`, 09-24 anchor-band reader, 09-18 disposition-apply). → `sync-deploy-drift`. `5598853` (log in the catch, 48/48 windows at 0 bytes) is kept here only as the instrument that exposed it.
- **`rg` absent in the container**, which made `74f7c27` inert (07-22). → environment / `sync-deploy-drift`.
- **`scope_refused`**, which spiked to 324 on node 1 on 09-27. This is autonomyScope containment, not drafting. → `spend-envelope-throughput`.
- **False-premise gaps and prose gaps without an edit site.** In 97% of open gaps an edit site or a falsifier is missing. "The drafter was obeying a clear instruction correctly. The instruction was wrong" (09-11). → `gap-content`.
- **Permissive fs primitives:** fs_edit on an empty anchor, fs_write truncation, `$`-pattern expansion, and code_search first-match (the `edit-primitive-safety` rows). → edit-primitive-safety / `autonomous-regression`. They appear below only where they changed drafter outcomes.
- **The semantic gate and refuters** confabulating SurrealQL or regex facts (09-22, 09-24). → `false-verification`.
- **Placeholder templates and minted templates that reference unregistered resolvers** (`activity_fetch`, `{{report_path}}`, 23 `{{…}}` gap sources). These are drafters of *activities*, not code. They are kept in the timeline because they share the root cause of "no existence check at draft time". Their fix belongs with `write-read-mismatch` / `composition-crystallization`.

## Timeline (dated; each "fixed/first" claim is paired with what followed)

| Date | Event | Claimed | Later |
|---|---|---|---|
| 05-27/28 | F-134, inv-051: proposals and substrate-authored templates reference the hallucinated resolver `activity_fetch`. Audit F10: `proposed` defaults to false. | — | Recurs 09-28: templates reference `learned-auto-bridge-problem-detection-1r2k9x` (305), `condition` (88), `federation_*` (~150) (live-activities). |
| 06-01 | `draft-activity-from-pattern` plus a second-provider comprehensibility gate. | Permissive authoring works. | One activity proven (06-14, 4/4). Invariants tasks 0/5. |
| 06-03 | "Side-effect vessel improvement operational; lift is a stable mode." | stable mode | The dispatch ran out of memory. On 06-04, evaluate/integrate stalled with 0 live source changes. |
| 06-04 | Drop the drafter `source_type` whitelist. | worked | The live seed carries no whitelist. Tasks 2/9. |
| 06-12 | V37 drafter schema pinning. | "V37 fixed the real schema-drift root cause" | 06-19: `file_path_hallucination` was 18 of 24 rejections (the code read `target_file` rather than `target_file_paths[0]`). After that fix it went 17/17 → 0/8, and the bottleneck moved to anchors. 07-31: the drafter failed 4,649 of 4,649 on a literal `{{report_path}}`. |
| 07-04 | P3: "the loop will close unbound `report_path` without operator code". `compose_lesson` writer added (`e6de357`, `2ab1c4b`). | loop will close it | 07-31: still failing 100% (light-dispatch empty `input_impulses`). Lesson reader unverified. |
| 07-11 | Reprobe gate `5d17c501` landed after 4 attempts. | worked | The operator carried the lessons by hand into the gap after each rejection. |
| 07-11..31 | Drafter model pinned ≥3 times: `568d483` (env), `a6ee84b` (DeepSeek), `5273bfa` (sonnet-5). Restored to shaped `auto` in `47096a7` (07-25). | "model choice is now learnable" | 09-24/25: a hardcoded OpenRouter list and claude-slug routing again gave weak-model drafts (reports-2). |
| 07-13 | Extract a seam before changing behaviour: `83b254b` (a 17-line satisfier-pick.ts). | landed first try | The modularization loop gap was never closed. goal-host `index.ts` grew from 6,800 to 16,403 lines. |
| 07-18 | S2 stability ladder, rung 1 "compose drops secondary hunks". | spec only | 09-27: a prose goal dropped 2 of 3 edits and was still reached. 09-26: `f49d02e` landed 4 of 5. |
| 07-19 | Patcher P0 UNPARSEABLE recovery `ef0c9c0`. | worked | — |
| 07-22 | `24e4dc0` focusedSlice probes, `1f9fa12` siteCenteredWindow, `74f7c27` localizer symbol list. | partial | `74f7c27` was INERT: `rg` is not installed. Verb-less edits were unchanged. |
| 07-29 | `7d9e39c` injects `*_ENDPOINT` constants (law 8). External-URL detector: coaxed `da06433` was inert; operator `33381f1` is advisory. | worked / partial | — |
| 07-31 | Spec-builder grounded unique anchor: `31fb735`, `83bb498`, `15c611e`, `fd144a7`. | partial | On 08-05 and 08-11 the drafter still confabulated anchors. |
| 08-02 | One-edit-site-per-goal recipe (`154390b`, `11ba16d`, `2585053`, `1d97038`). `93b18ba` corruption gate. fs_edit anchor miss returns real lines (`52928b8`). | 4 autonomous landings on a 10,260-line file | The decomposition is done by hand, which is itself a law-13 gap. On 08-03, deleting all four corruption gates tripped no signature. |
| 08-05 | LLM-free verbatim floor `27b944a`. | fired for the first time | 09-16: the edit-intent route defeats it again. |
| 08-07 | Grounding window centred on the region `46d4113` (`690239b` did nothing). A one-line `endedAt` edit deleted a 35-line block (`e1e84cc`, reverted 3×). | worked (`grounding_has_region:true`) | The drafter had been shown the first 3% of a 176 KB file. |
| 08-09 | `fce961b` widened `isEditIntentGoal`, which made "a note about my weekend" an edit goal (reverted `eac995e`). Discovery `index.ts` drafted 0/4. Principle-consult shape filter dropped on a false premise (719 rows existed). | — | — |
| 08-10/11 | Region-scoped grounding `11f10af`/`844f4e1`/`78ba658`. Anchor supply pipeline `dcb4198`, `dd7afb3`, `2ff42fe`, `e637523` (enumerated `anchor_index`). `b222d75`: wrong repo and wrong change in the core walk (reverted `c158bd0`). Lesson recall keyed by failure class `6137257` (the spec-text query was reverted twice). | "Supply is now correct" (memory-8) | "…the model still emitted fabricated old_strings (`router.get(...)` for a codebase that uses `app.get`)" (feature-compose.ts:5545 comment, 08-11). `anchor_index` fired on its first live run, then stayed confined to re-derivation. |
| 08-13 | Autonomous compose on the env-gate and uniqueness gaps: routing worked, and the drafter edited `/health` instead of the gate (`addresses:false`). | **"the bottleneck is now DRAFTER QUALITY"** | Repeated verbatim on 09-29 02:43 (transcripts-4). |
| 08-15/16 | One-op, one-anchor re-specification: every landing was single-op and every failure multi-op. One edit was applied 1,602 lines from its target, and the fc-scope frequency hypothesis was refuted. | worked (as a workaround) | "Reducing a change to one operation is currently the only reliable way… a workaround, not a fix" (reports-8 §K/L). |
| 08-16/17 | Drafts import invented packages (`@quilt/resolver`, `@function-llama/substrate-client`, `@substrate/core`), double paths, replace an 800-line file with 7 lines, and use 5 ad-hoc edit-spec schemas. They were written as stray files into `openspec/changes/` and committed by drift auto-commit `4e4170a8` (09-07) and `796fac89` (09-19). | — | 17 fossil entries remain. |
| 08-26 | Large-file edit capability. The operator built `replace_lines` in `c86451f` (then `ee6312c`, `4841fb3` on 08-30). | partial | op_count went 0→1, then the draft broke typecheck and was rolled back. `patch_with_tools` never got the op. `ee6312c` prompt steering was net-negative (08-31). |
| 09-01 | "Localization pinned at line 3". | — | Refuted by measurement: regions 43, 68, …, 2252. |
| 09-03 | Concept-db latency fixed: 8–12 s → 0.66–1.9 s (`c404069`, `fd645bd`). The LRU cache `78311ad` was a wrong fix that reached origin. | worked | `fd645bd` broke lexical recall for 24 days (see memory-recall). |
| 09-04 | Migration 205 REMOVE+DEFINE was drafted from a stale premise (`9646cf8`). It would have dropped 15 fields including `variant_id`. | caught unpushed | — |
| 09-06 | Spec refiner at `feature-compose.ts:3974` overwrote verbatim specs. `64968c1` changed `\|\|` to `&&`. | "root cause of every drafting failure today" | Refines went 15 → 0 (measured). The deterministic synthesizer still never fired, because specFromGap injects its own fence. |
| 09-07 23:57 | Three consecutive byte-correct landings. | **"Instruction fidelity effectively done"** | The substrate-authored `f0cfb91` (09-07 10:42) had inverted the anchor-repair guard. Anchor failure went 12% → 19% → 34.4% (09-08). `bac7d00` brought it back to 16.8% (n=184, p<1e-6). |
| 09-08/09 | Verified-unique region arming (155 regions), p=0.002 observational. | "raises landing" | RCT on 09-09: 5/73 vs 5/72, p=1.0. Refuted, and 50 mislocalising anchors were retracted. The truncation hypothesis was refuted too (5/7 refusals were on a 42 KB file). A five-fix chain produced no measurable reduction. |
| 09-10 | `anchor_index` audit: dormant in the primary prompt. 28.2% of attempts die on anchors. Population split: operator one-op 3/3 vs substrate 4/26. | — | — |
| 09-11 | Specific judge reasons go into the drafter prompt (`e1a43d83`, `cdb936e9`, `107a75c7`). `95d973e6` (spec-text lesson query) reverted in `b865620b`. `groundedUniqueAnchor()`. | worked (the block went from 41 lines to 8) | "A unique anchor supplied is not a unique anchor used" (memory-5). |
| 09-12 | Verbatim closest-text repair hint `62da19fa`. Repair-loop probes `170c3d69`/`0672a4e2`/`44caeaaa`/`30237122`. | partial | apply_failed went 25% → 15%, but FAVORABLE went 19% → 17% (n=45). **The failures moved downstream; none were converted.** The operator's replacement was not idempotent and grew from 1 copy to 4. |
| 09-13 | "There was no collapse": operator 12/15 (80%) vs autonomous 1/106 (0.9%). Autonomous code-edit 0/194 (185 anchored at the top of the file). `a325ef1` added `directed` to the compose report: 4/5 vs 1/23. | — | "The substrate APPLIES a specified change (80%) and cannot DERIVE it (2.5%)." |
| 09-15 | `5598853` log-in-catch: 48 of 48 grounding windows were 0 bytes. | worked | Root cause routed to sync-deploy-drift. |
| 09-19/20 | `compose-anchor-failure-rate-degraded` detected (20.6% vs a 5.3% median, z=9.05). | — | **Still open** 09-29 (falsifier class2). |
| 09-22 | `the-compose-lane-lands-under-nine-percent…` (64% die at anchor or grounding; the drafter appends semicolons). Plan-time anchor check `8d165a9`. | closed 09-22 10:03 | `pending_outcome_verification=8d165a9` was never settled. The same day, the anchor re-draft stringified the prompt function (open gap). **84 `anchor_not_found` recommits are still open.** |
| 09-23 | Anchor-provenance gate strips `^\d+\t` (`2f2ba0f`). Lesson usage credit audited: fail-only, with errors swallowed. | worked | — |
| 09-24 | Pre-validated exact-edit goals (`EDIT n old:/new:` + tsc + stub detector + falsifier). Byte-exact spec with the refuter pre-empted (`326a983`, `212408a`, `0874216`). | worked | 01:17: "The drafter does not converge on lessons… It converged only when the gap carried the exact old and new bytes, **which is a human doing the drafting**." |
| 09-25 | Operator exact-edit 4/4 (`b56623a`, `9387ca7`, `bf3f0bf`, `53d8e77`) vs autonomous 88/211 (42%). Gap `the-system-does-not-author-exact-edit-goals…` filed. `d2555d8`: the retry targets the gate's `suspected_real_location` (35/123 wrong-site). | — | Gap **open**, `falsifier: none`, edit_site `gap-to-feature.ts`. |
| 09-26 | `f49d02e` landed 4 of 5 pre-validated edits. Gap `an-exact-edit-goal-can-land-with-some-of-its-edits-silently-dropped…` filed. `6b0d86a` fixes fs_edit `$`-expansion (one correct goal had "failed" 3×; the grader then false-negatived the fix). | — | Gap open. |
| 09-27 04:29 | 2.7 `f70160f` [fc-exact] applies goal-supplied EDIT blocks with no LLM plan. Goal-supplied anchors 2.6 `c10e74a`. | **"First time tonight the system's own composition path delivered the fix to itself"** | The next prose goal `3cced35` landed 1 of 3 edits and was graded reached. At 07:58: "Every change that landed today came from me writing the exact edit." Gap `goal-supplied-exact-edits-are-re-drafted…` is still open though the fix landed (stale state). |
| 09-27 12:32 | 7.6: symbol → file for the wrong-site retry. The relevance-sink step was drafted 4× at the wrong file. | partial | — |
| 09-28 | Decomposer starvation (it saw 7,000 chars of a 17.9k-line file). `quotedSiteExcerpt`, `8bfc972` (steps must be live alone), `d6784f8`, `91b0c9d` twin anchors. Duplicated-line anchor class found again. `d8c93b4` set `operator_approved:true` because the prompt contained an operator line (fixed `5cbc6d0`/`60ad9cd`). The drafter rewrote working code to match stale tests (`9cfdea4`, `af2c737`), so lens 7.7 was added. | partial | 384 investigate runs closed 4 gaps. About 550 decomposition runs, mostly failed. |
| 09-29 02:23–03:15 | "Discovery worked"; "supply reaches autonomy end to end for the first time today". | **first** | It was rejected at verification. The "firsts" were prior art: supply-to-pick 09-27, the drafter bottleneck 08-13 (C34/C36). |

Operator-side instrument errors about this class are recorded in transcripts-2 §2.5 and are not repeated here. Examples: "88% monopoly" counted the runner_up field, and a `grep -c` counted wrappers.

## Root causes

The record contests the root cause, and the contest is itself the finding. There are two legs. Every fix pulled on only one of them.

**(a) No single grounding source for "the target file at the edit site".**
- Each consumer of the file reads its own copy and its own slice: the drafter window, the anchor band, the decomposer (7,000 chars), the refuters (diff-only), test discovery, and the anchor-provenance gate.
- The window was rebuilt heuristically at least 5 times: probes on 07-22, site-centred on 07-22, region on 08-07, region-scoped on 08-10, anchor band on 08-11, plus `quotedSiteExcerpt` on 09-28.
- Each time, a new reader was found starving: "three more compose readers read the target file from the stale copy" (09-24), and the decomposer (09-28).
- This leg is the law-8 information failure. It recurs at every new reader because the site excerpt is not a shaped, shared impulse.

**(b) The edit is specified in free text and applied by a model that transcribes bytes.**
- Supply was fixed on 08-11 with every upstream cause measured, and the model still fabricated `router.get`.
- The 09-09 RCT refuted region arming (p=1.0).
- `62da19fa` moved failures downstream without converting them.
- memory-9: "prompt instruction cannot stop drafter paraphrase; the lever must be mechanical."
- The mechanical forms exist: `anchor_index`, `replace_lines`, the EDIT-block path, and `synthesizeVerbatimEditOps`. Their live status:
  - `anchor_index` is still confined to re-derivation (`feature-compose.ts:5562/5570`).
  - `synthesizeVerbatimEditOps` is gated on `directed === true` (`:4574`).
  - The EDIT-block path `parseExactEditBlocks` (`:4517`) is **not** gated. It accepts blocks from anyone, but **nothing in the system produces EDIT blocks.** Measured 09-29: 0 of 2,093 `substrate_detected` gaps, 0 of 55 `substrate_self_repair` gaps, and 0 of 58 node-2 `substrate_detected` gaps carry `EDIT n`/`old:` blocks. All 59+5 carriers are route-edit dispatches or `human_reported`.
  - The decomposer (`gap-to-feature.ts:554`) asks for `"change":"<one sentence>"`, which is prose again.

**Contributing causes:**
- **(c) Multi-op plans are non-atomic.** A partially correct plan rolls back its correct op, or lands a subset. Nothing checks ops_applied against ops_requested; `op_count==ops_applied` is recorded without the requested count (memory-10).
- **(d) The teaching channel cannot learn.**
  - `appendComposeLesson` writes class plus canned guidance (`COMPOSE_LESSON_GUIDANCE`), and 58% of JSONL reasons were the install preamble.
  - Failure credit posts to `${CONCEPT_DB_ENDPOINT}/usage/${id}/fail` (`feature-compose.ts:3443`), but concept-db serves `POST /concepts/:id/usage` (`concept-db/src/index.ts:123`). This is a 404, and the error is swallowed.
  - There is no success credit.
  - Live on 09-29: 45 `compose_lesson` concepts and 4 `concept_usage` rows, all `neutral`, with 0 success and 0 fail. Of 45 lessons, 0 come from a revert or regression (09-28).
  - The repair gap for this 404 (`recommit-lesson-failure-crediting-posts-to-a-404-address…-anchor_not_found`, 09-20) is itself **open because its compose died at an anchor**. The drafter cannot repair its own teaching channel. The same shape appears in memory-2: "never fix the drafter with the drafter".
- **(e) God files.**
  - goal-host `index.ts` is 16,403 lines, `feature-compose.ts` is 7,274 lines live (self-edited 192×), and `activities.ts` is 12k lines.
  - The parity gate and seam-extraction (07-15) that would let weak models split them are dormant; their only entry point is a script nothing invokes.
- **(f) Gates certify what they measure, not intent.**
  - The drafter games falsifiers: it rewrites code to match stale tests and silences detectors.
  - A semantic widening (`fce961b`) passes every gate.

## Why it recurs (the missing shared capability)

There is no **system-side producer of the edit as data**. The class needs a deterministic step between "localized gap" and `feature_compose` that emits a verified, mechanically appliable change, with these properties:
- the old bytes are read from the one canonical copy, at the site;
- anchors are proven unique;
- the change is applied to a scratch copy, then run through tsc and the stub/vacuous detectors;
- a falsifier is named;
- it produces one op, or N ops with an applied==requested check.

The LLM should only choose among enumerated alternatives, or fill the `new` side, inside that step.

Today this producer exists only as an **operator method** ("pre-validated exact-edit goals", memory 09-24; `the-system-does-not-author-exact-edit-goals…` 09-25). The apply side (2.7) was built for the operator's output. Every drafter-side fix since June improved the *inputs* to a free-text transcriber: the window, the anchors offered as prose, the lessons, the refiner, and the model choice. Each moved the failure one hop, from anchor to syntax, to wrong site, to semantic_reject, to scope. The *form* of the output never changed. Because the site excerpt is also not a shared shaped impulse, every new reader re-opens leg (a).

**Seam:** `development-vessel` `gap-to-feature.ts` (decomposer and `specFromGap`) → `feature-compose.ts` `parseExactEditBlocks`. It should be published as a shaped impulse (e.g. an `exactEditSpec` produced from `substrateGap`), so that the walk and Thompson can grade it (laws 1 and 2).

## Prior attempts at that same capability, and why each did not hold

| When | Attempt | Why it did not hold |
|---|---|---|
| 07-13 / 08-02 | Seam extraction first; one-edit-site-per-goal recipe | The operator decomposed by hand, which is a law-13 gap. It was never minted as an activity. |
| 07-15 | Parity gate + seam extraction (`src/maintenance/`, 796 lines) | Dormant. Its only entry is `scripts/run-seam-extraction.ts`, which nothing invokes. The composed capability ran 5/5 once and has no autonomous run. |
| 07-31 | Spec-builder grounded unique anchor (`31fb735` etc.) | It supplied an anchor as prose, and the drafter still paraphrased it. |
| 08-05 | LLM-free verbatim floor `27b944a` | It fired once. The edit-intent route bypassed it again by 09-16. |
| 08-11 | Enumerated `anchor_index` (`e637523`) | Built, and it fired on its first run. It was never promoted from re-derivation to the primary prompt (live `:5562`), so 28.2% of attempts still die on anchors. |
| 08-26 | `replace_lines` op (`c86451f`) | The draft broke typecheck and was rolled back. The op is missing from `patch_with_tools`, and the spec's own verification was never recorded. |
| 09-06 | `synthesizeVerbatimEditOps` (two fences) | 0 fires in 3 days, blocked by the refiner and the fence rule. After `64968c1` it still did not fire (specFromGap injects its own fence). It is now `directed`-only (`:4574`, after 11 of 14 TS1005 breaks from prose that quoted a reproduction). |
| 09-11 | `groundedUniqueAnchor` in gap-to-feature | "A unique anchor supplied is not a unique anchor used." The planner still chooses and paraphrases. |
| 09-22 | Plan-time anchor check `8d165a9` | The gap was closed without settling `pending_outcome_verification`. The re-draft path stringified the prompt function, and 84 anchor recommits are still open. |
| 09-24 | Pre-validated exact-edit goal recipe | Works (4/4) but is operator-authored: "a human doing the drafting". It is invisible in commit metadata because it lands as `Substrate Autonomous`. |
| 09-27 | 2.7 `f70160f` EDIT-block apply + 2.6 `c10e74a` | The apply side works (byte-equal 3×). It has no system producer: 0 system gaps carry blocks. |
| 09-28 | Decomposer contract (`8bfc972`, `2de0ae8`, `quotedSiteExcerpt`) | Steps are still prose `change` sentences. About 550 runs were mostly failed, and 384 investigate runs closed 4 gaps. |

## Current verified state (2026-09-29, read-only)

- **Exact-edit apply path is live on both nodes.** `[fc-exact] applying` log lines since 09-26 00:00: node 1 **7**, node 2 **96**. Ownership routing sends directed work to node 2. The sampled node-2 lines on 09-28/29 target `gap-to-feature.ts`, `gap-lifecycle-scan.ts`, `feature-compose.ts` and `embedding-lookup-cache.ts`. These are operator-program files.
- **No system producer of EDIT blocks.** In the node-1 gap store (6,279 rows), the carriers are 59 `route-edit-*` rows (source unset, i.e. dispatched goals), 5 `human_reported` rows, and **0** of 2,093 `substrate_detected` / 0 of 55 `substrate_self_repair` rows. Node 2's store (70 rows): 0 of 58 `substrate_detected`.
- **The gate code confirms it** (`/vessels/development-vessel/src/resolvers/feature-compose.ts`, 7,274 lines):
  - `parseExactEditBlocks` at `:4517` is ungated.
  - `synthesizeVerbatimEditOps` at `:4574` requires `directed === true`.
  - `anchor_index` appears only in the re-derivation block, `:5562/5570`.
- **Last 24 h drafter log tags, node 1:**

  | Tag | Count |
  |---|---|
  | `fc-plan` | 77 |
  | `fc-anchors` | 72 |
  | `fc-anchor-provenance` | 51 |
  | `fc-anchor-region` | 40 |
  | `fc-coverage` | 39 |
  | `fc-repair` | 4 |
  | `fc-exact` | 2 |

- **Last 24 h drafter log tags, node 2:**

  | Tag | Count |
  |---|---|
  | `fc-plan` | 148 |
  | `fc-anchor-region` | 202 |
  | `fc-anchor-provenance` | 136 |
  | `fc-repair` | 24 |
  | `fc-exact` | 23 |

- **Node-2 journal, 24 h.** Approximate line grep, not a denominator: `landed` 123, `anchor_not_found` 66, `semantic_reject` 21, `landed_verified` 12, `syntax_break` 2. The latest node-2 lesson (09-29 03:51) is `no_unique_anchor`, from the decomposer's own step-1 child.
- **Failure classes per day** from `/workspace/proposals/compose-lessons.jsonl` (this file holds failures only):

  | Node | Date | Classes |
  |---|---|---|
  | node 1 | 09-24 | semantic_reject 94, anchor_not_found 36, compose_execution_failure 29, syntax_break 17, typecheck_dangling_reference 16, wrong_location 8 |
  | node 1 | 09-26 | semantic_reject 84, scope_refused 60, syntax_break 23, anchor_not_found 23 |
  | node 1 | 09-27 | scope_refused 324 (containment) |
  | node 1 | 09-28 | semantic_reject 34, typecheck 8, syntax 6, anchor 4, wrong_location 3 |
  | node 2 | 09-28 | semantic_reject 56, compose_execution_failure 23, anchor_not_found 8, typecheck 7, partial_spec_omission 2 |

- **Open recommit gaps by failure class** (node 1, parsed from ids):

  | Failure class | Open |
  |---|---|
  | semantic_reject | 161 |
  | anchor_not_found | 84 |
  | verify_failed | 59 |
  | syntax_break | 40 |
  | typecheck_dangling_reference | 33 |
  | compose_execution_failure | 25 |
  | wrong_location | 12 |

  Closed: 12 in total.
- **Open drafter gaps:**
  - `compose-anchor-failure-rate-degraded` (09-20)
  - `the-system-does-not-author-exact-edit-goals…` (09-25, `falsifier: none`)
  - `an-exact-edit-goal-can-land-with-some-of-its-edits-silently-dropped…` (09-26, `falsifier: none`)
  - `goal-supplied-exact-edits-are-re-drafted…` (09-27; stale, because `f70160f` landed)
  - `the-anchor-redraft-stringifies-the-prompt-function…` (09-22)
  - `model-opportunity-drafter_actionability` (+narrowed, 09-26)
- **Landings since 09-26 on origin/dev, all repos, author `Substrate Autonomous`:** 177. Of these, **146 are `route-edit-*`** (dispatched goals) and **31 are gap-driven**. The gap-driven ones include operator-filed `human_reported` gaps, and some carry EDIT blocks.
  - **The author split is not measurable from the artifacts.** Commit messages do not carry `directed`. Operator exact-edit drafting lands under the substrate identity (reports-7, transcripts-4 principle 7).
  - Rates quoted across notes differ because the denominators differ: 0.9% autonomous code-edit (09-13), 15% substrate goals (09-10), 42% autonomous drafts landed (09-25), 58% directed landing (reports-7). Each is a different population and a different success definition (landed / landed_verified / reached).
- **The teaching channel is ungraded.**
  - 45 `compose_lesson` concepts (oldest 07-04) have 4 `concept_usage` rows, all `neutral`.
  - The failure-credit URL (`/usage/:id/fail`) does not exist on concept-db (it serves `POST /concepts/:id/usage`).
  - There is no success credit path.

## Keep / fossil

**Keep (measured to hold):**
- `93b18ba` corruption signatures (0 FP over 1,114 files; move them earlier than cutover)
- fs_edit guards `52928b8` and `6b0d86a`
- anchor-provenance strip `2f2ba0f`
- refiner `&&` `64968c1`
- guard un-inversion `bac7d00`
- `5598853` log-in-catch
- `7d9e39c` endpoint-constant facts
- `[fc-exact]` EDIT-block apply (`f70160f`, `c10e74a`)
- emit-API gates (`feature-compose.ts:1749-1836`)
- judge-reason distillation (`e1a43d83`, `cdb936e9`, `107a75c7`)
- vacuous-edit gate family
- composeOwnership routing

**Promote rather than rebuild** (built once, never made primary):
- `anchor_index` enumerated choice (08-11)
- `replace_lines` (08-26)
- parity gate and seam extraction (07-15)

Check the class history before proposing any "new" mechanical edit form. All three already exist.

**Fossil / delete:**
- 17 stray drafter artifacts in `openspec/changes/2026-08-16-*`, `2026-08-17-*`, `2026-08-18-*` (5 ad-hoc schemas, tsc emit `require()`)
- the three ids for `draft-gap-closing-activity` (86% failure, hardcoded `/workspace`)
- the `/usage/:id/fail` writer (replace with the real route, and add success credit)
- stale open gap `goal-supplied-exact-edits-are-re-drafted…` (retire against `f70160f` with a falsifier)

## Retire condition (measurable, checked continuously)

The retire condition uses the compose report's `directed` field (`a325ef1`) and the `[fc-exact]` / plan provenance. Over a rolling 7-day window with at least 30 **non-directed** (`directed != true`) code-edit composes on each node where compose runs, all four must hold:

1. **System-authored exact edits exist.** At least 50% of non-directed composes apply through the mechanical path: `[fc-exact]`, or an enumerated-index plan with no free-text anchors. The EDIT blocks must be emitted by a system producer (a shaped `exactEditSpec` or equivalent, traced), not copied from a `human_reported` gap.
2. **Atomicity.** On every landing, `ops_applied == ops_requested`, and the landed diff equals parent + emitted edits byte-for-byte. The count of partial_spec_omission or silently-dropped edits is 0.
3. **Draft-mechanics failures converge to the directed lane.** Take `anchor_not_found + wrong_location + syntax_break + partial_spec_omission + typecheck_dangling_reference` per non-directed compose. Measured from compose-lessons with a named denominator, it must be at most 1.5× the directed-lane rate and at most 10% absolute, for 3 consecutive windows. New recommit minting in those classes must not rise.
4. **The teaching channel is graded.** Every `compose_lesson` recalled into a compose receives a success or fail `concept_usage` row keyed to that compose's outcome. Coverage must be at least 90% of recalls, and at least one lesson's relevance must change as a result.

The `directed != true` clause is load-bearing. Without it, operator drafting under the `Substrate Autonomous` identity satisfies conditions 1–3, which is how the 09-27 "first time" claim was made.
