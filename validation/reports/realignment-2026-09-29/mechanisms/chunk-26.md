# Mechanisms chunk 26: ribosome-vessel (template extraction / crystallization)

Input: `classes/_mech_chunks/26.json` (25 items, all naming the ribosome or the reach→mint path).
Verified 2026-09-29 around 05:15 UTC in `substrate-live`. Sources checked: the live clones
`/workspace/git/vessels/ribosome-vessel` (HEAD `5a374df`, 09-02, a revert of `86aebdf`), `goal-host-vessel/src/index.ts:6855-7060`
and `ias-executor-ts/src/templates/lifecycle/ribosome-extract.json`. Also checked: 24 h to 8 days of `journalctl -u ribosome-vessel` / `-u goal-host-vessel`,
the `execution` table (150k cap, a window of about 5 days) and the `activity` table. The SurrealQL was read-only.

## The headline, and a correction to the records

**Nothing has been crystallized since 2026-09-22 07:39 UTC.** The last extracted row is
`learned-composition-websearchresult-to-llmcompletion-to-substrategap` (`extracted_from` = a walk-composite id).
`activity` rows with a non-empty `extracted_from` created after 09-23 = **0**. From 09-10 to 09-22, 1 to 9 `learned-*` rows were minted
per day. After 09-22 there were none.

The records disagree: live-resolvers/live-activities say "`ribosome-extract` 1,456/1,459 ok" and "live-used". reports-6/7 say
"1,788/1,788 execution_error, 0 templates since 09-22". **Both are wrong about what the number means:**

- `execution WHERE activity_id='ribosome-extract'`: 1,430 success and 6 failure. But `reached` = false on 1,076 rows and
  null on 360, with **0 reached**.
- The latest "success" (`exec_2zw2p6eq`, 09-29 04:58) ran task 1 `acquire_trace_signature`. **Tasks 2 to 7 were all `status:"skipped"`**
  (assess_quality, synthesize_template, validate_proposal, dispatch_write_attempt, dispatch_write_succeeded, emit_summary).
- In the whole window, `synthesize_template` ran (status success) **3** times and `dispatch_write_attempt` ran **2** times.
  Both write attempts were on 09-20 06:05, and `dispatch_write_succeeded` was skipped on both.
- New failure since **09-28 18:50**: 5 runs failed with `UNRESOLVABLE_PLACEHOLDER: task 'acquire_trace_signature': {{lifecycle.executionId}}`.
  On 09-20 it failed with `slot 'extracted_template' but no input impulse carries it`.

So the "~100% ok" is **hollow completion**: the template's own gate skips everything after the fetch, and the
status reads success (class hollow-landing / false-verification). Its cost is real. Each ribosome-vessel dispatch fans out into
about 5 `validator-dispatch` plus 1 `slot-binding` lifecycle executions. **7,562 executions tagged `ribosome-vessel-dispatch`** in the window
(ribosome-extract 1,082, validator-dispatch 5,400, slot-binding 1,080) is about 5% of the capped trace store, for 0 templates.

This is the **fifth** recurrence of "the reach→mint path doesn't mint". The earlier four are in git-goalhost, 06-22..08-17:
15620e7, 337d223, f88ba8f, 8d960a8, d48a963, ef48012, 4a4af5e, each saying "the previous path never minted".
The first four were fixed one at a time and never got a detector. That is the principle "a detector must be proven to complete".

## Dedupe (25 items reduce to 8 mechanisms)

| Canonical mechanism | Chunk items merged |
|---|---|
| **R1** reach→mint chokepoint (goal-host `mintReachedTrace`, `index.ts:6889`, callers `:11522`, `:11577`, `:14215`) | 2 "ribosome extraction via mintReachedTrace", 24 "mintReachedTrace" |
| **R2** extraction executor: `ribosome-extract` lifecycle template (`ias-executor-ts/src/templates/lifecycle/ribosome-extract.json`) | 5 "ribosome mint/extract", 6/7 "Ribosome extraction", 8 "ribosome extract", 12 "…with honest-reach gate", 14 "Ribosome extraction :8240 + ribosome-extract", 16 "ribosome walk extraction", 20 "ribosome extraction (5f96ba4)", 21 "…/learned-composition templates", 22 "ribosome-extract", 23 "ribosome extraction (impulses.ts:2630)" |
| **R3** ribosome-vessel WS consumer + honest-reach re-read + depth/recursion gate + `/run-goal` dispatch (`ribosome-vessel/src/index.ts:208-245`, `:275-660`) | 0 "ribosome-vessel", 3 "WS observer", 4 "WS consumer", 9 "extraction dispatch", 10 "activityDispatch extraction path", 18 "reach re-read + census + depth-bound gate", 19 "WS extraction path" |
| **R4** microplastic ribosome (e5b04851, March) | 1 |
| **R5** `extractionPolicy` shape (depth bound) | 11 (half), 15 |
| **R6** `extractionEligibilityPolicy` shape (producer skip list) | 11 (half) |
| **R7** ribosome discovery registration `shapes: []` (`index.ts:697`) | 13 |
| **R8** replay-observer (`src/replay-observer.ts`, on `template_created`) | 17 |

Not in the chunk, but in the same vessel and area (listed for completeness): the ribosome resolver `vessel-scaffold-dispatch-result`
has 0 traces (live-resolvers §2) and falls under fossil. activity-api `routes/ribosome.ts` (`POST /extract`, `/extract-from-session`, `GET /candidates`)
had **0** `/v2/ribosome` hits in 7 days of activity-api journal. It is fossil unless R2's repair routes to it.

## Verdicts

| # | Mechanism | Verdict | Used now | Live evidence (09-29) |
|---|---|---|---|---|
| R1 | goal-host `mintReachedTrace` | **keep-general** (the single mint owner, repair yield) | yes (called), yield 0 | 8 days of goal-host journal: 66 `reach->mint: SKIP ungrounded reach` and 6 `DEFER landing … ledger-unreachable: The operation timed out`, with **no successful mint line**. It already carries the depth guard (`_extractionDepth`, `:6949`), the author-skip (`templateAuthor: learned- ⇒ ribosome-pattern`, `:6980`) and the causal-attempt-ledger defer. It runs `ribosome-extract` in-process via `host.runGoal` (354 of the 1,436 ribosome-extract rows carry no `ribosome-vessel-dispatch` tag). This is the seam law 4 names. Keep it and make it the only caller. Its outcome must be a template row, not a template exit status |
| R2 | `ribosome-extract` lifecycle template | **broken** (general, needed) | yes (volume), yield 0 | 1,436 runs / 0 reached / 3 syntheses / 2 write attempts (09-20) / 0 templates since 09-22. `applyExtraction` gate at `ribosome-extract.json:169` is a string compare `{{variables.applyExtraction}} == 'true'`. The ribosome sends a boolean `applyExtraction: true` (`ribosome-vessel/src/index.ts:230`). The template's own notes say the write needs admin scope and "401/403 is expected". Tasks 2-6 skip on nearly every run, and `{{lifecycle.executionId}}` has been unresolvable since 09-28 18:50. The synthesis is three LLM calls that re-derive a template from a trace. reports-8 (09-02) found "synthesis is trace copying" and "the write gate ignores proposal_validation.passed". Repair it as deterministic extraction (trace → template body is a copy with a derived signature, as the minted rows show), with the LLM tasks as optional variants. The template's terminal shape must be the written `activityTemplate` or an honest failure. A skipped write must never pass as success |
| R3 | ribosome-vessel WS consumer / reach gate / dispatch | **merge-into** R1 | yes | 24 h journal: 6,631 `extraction ALLOWED`, 8,008 `extraction SKIPPED (not honestly reached)` (mostly `column-null-ungraded` walk-satisfier rows), 330 eligibility fallbacks, **50 `ribosome-extract dispatched`**, 0 resulting templates. The file itself says it is subsumed: `index.ts:74-81` "Gap: ribosome-extraction-subsumed-by-goalhost-mint-retire-decision". Goal-host `:6855` "mirrors ribosome-vessel's read of the same `extractionPolicy`". That makes two gates over one executor. The gates disagree: goal-host skips ungrounded reaches, while the ribosome allows by `reached` column and skips null. The resulting 7,562 lifecycle executions displace goal traces under the 150k cap. Merge the honest-reach column re-read (a54691d, 7f142af) into R1 if R1 lacks it, then stop the unit. `86aebdf`/`5a374df` (fix then revert, same day 09-02) is unresolved: the self-contradicting-row case must be decided once in R1. Archive to `docs/archive/fossils/ribosome-vessel.md` with the numbers above |
| R4 | microplastic ribosome (e5b04851) | **fossil** (already gone) | no | Abandoned after March (git-super-1). Nothing in the live clones. One line in the fossil index |
| R5 | `extractionPolicy` shape | **revive-general** | no (value never resolved) | Advertised by goal-host (`SHAPES`, `index.ts:1246`; `shaped-policy-store.ts:4-6` records "resolved 0 of 1446 times in 6h"). Read by goal-host `:6870` and ribosome (126 `extractionPolicy unresolved — falling back to maxExtractionDepth 1` / 24 h). The reader and producer exist, but no value was ever written, so law 1 is satisfied on paper and the literal governs. Seed one `extractionPolicy` impulse (maxExtractionDepth) through the existing writer. Then the reader stops falling back and the bound becomes learnable |
| R6 | `extractionEligibilityPolicy` shape | **merge-into** R5 (`extractionPolicy`, as an `eligibility` field) | no | Read only by ribosome-vessel (330 fallback WARNs / 24 h, literal `[validator-dispatch, slot-binding]`). R1's equivalent is the ungrounded/author check. Once R3 is retired, one policy shape carries both the depth bound and the skip list |
| R7 | ribosome discovery registration `shapes: []` | **broken** (resolved by R3 retirement) | yes | 24 h: 1,445 `register failed … unreachable via discovery` and 1,437 re-registration heartbeats. Cause: discovery `7cc9da4` (09-19) `shapes must be a non-empty array` (`index.ts:336`) versus ribosome `index.ts:697` "owns no impulse shapes; it's a consumer" (class directed-overshoot). If R3 is retired this disappears. Independently, discovery needs a consumer-only registration path (identity-vessel also shows `registered:false`). No test registers a consumer |
| R8 | replay-observer (`onTemplateCreated`, `replay-observer.ts`) | **broken** (test-residue driven) → fossil | yes | 24 h: 259 `Replay job start`, of which **251 are the fixture templates `fts_tags_test_18_1_{unrelated,bugfix_only,auth_specific,auth_general}`** (4 such rows live in `activity`). 6 are `detect-vessel-code-drift` and 2 are auto-bridge rows. Each job makes an `llm_completion` call (`:289`) and writes `impulseRelevance_write` (`:321-352`), 238 `Replay written`. A test suite re-emits `template_created` for the same fixtures about 63× per day (class test-residue-live-state). Stop it with R3. If relevance backfill for new templates is wanted, it belongs where relevance is graded (activity-api), triggered by a real mint from R1 |

## What to keep, and how it becomes discoverable

- **R1 + R2 are the law-4 capability, and it is the most important learning path the substrate has.** The execution
  expectation's ceiling (learned pathway) and middle (first/last-mile reuse) both depend on a template being minted.
  Recommended shape: `mintReachedTrace` stays the single chokepoint in goal-host and runs one extraction activity
  (`ribosome-extract`, repaired). Its **output shape is `activityTemplate`, or `extractionRefusal{reason}`** so the trace carries
  why. It should never end in a status-only success. It is discoverable as a registered activity (already in `activity`),
  selectable and graded by Thompson like any other.
- **Missing generator (law 6).** Five recurrences of "doesn't mint" had no detector. Mint one condition-driven activity:
  *"reached, grounded executions > N in 24 h while `activity` rows with `extracted_from` created in 24 h = 0"* ⇒ `substrateGap`
  with `edit_site` = `ias-executor-ts/src/templates/lifecycle/ribosome-extract.json` (the executor), not the ribosome vessel.
  Today it would have fired every day since 09-23.
- **Retirement of minted chains is also missing.** live-activities: 65 live minted rows with ≥20 runs and 0 successes
  (`codereadresult→concept-write` 5,464/0 lifetime). Variant retirement (`checkAndRetireTemplate`, 20 runs <30%) exists in
  activity-api. Verify that it applies to `learned-*` rows before minting resumes. Otherwise a repaired ribosome refills the pool with failing chains.
- `extractionPolicy` becomes discoverable by being resolvable. It is already advertised; it only needs one written value.

## Fossils and where to archive them

- `docs/archive/fossils/ribosome-vessel.md`: R3 (WS consumer and its gate history a54691d → c779cfd → 7f142af → 86aebdf/5a374df),
  R7 (register 400 loop), R8 (replay-observer and the fts_tags_test fixture loop), the `vessel-scaffold-dispatch-result`
  resolver, microplastic R4 (e5b04851), and activity-api `routes/ribosome.ts` if R2's repair does not use it.
  Also record the 7,562-execution / 0-template measurement so the retirement is evidence-backed and does not recur.
- Unit removal: `ribosome-vessel.service` masked through the profile (`DISABLED_VESSELS`) rather than deleted from the image. After that, the
  consumer-only registration question for discovery stays open for identity-vessel.

## Class links (recurrence check)

- **composition-crystallization**: "reach→mint doesn't mint" is on its 5th recurrence (09-22→now). The 4 prior fixes were local, and none added a yield detector.
- **hollow-landing / false-verification**: ribosome-extract "success" with 6 of 7 tasks skipped, and the status is read as health by two collector records.
- **directed-overshoot**: discovery 7cc9da4 regressed a consumer-only vessel (R7).
- **test-residue-live-state**: fts_tags_test fixtures drive 97% of replay-observer work (R8).
- **env-gating / law 1**: `extractionPolicy` is advertised but never valued, so the literal governs in two vessels (R5/R6).
- **trace-store-db**: ribosome lifecycle fan-out uses about 5% of the 150k cap for no output.
