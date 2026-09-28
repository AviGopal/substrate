# Self-correction mechanism audit — 2026-09-28

Question (user): "We've been working on this for a year; it's unlikely this is the first time we've done any of
these things." Four read-only sweeps (current code + memory; 12 months of commit history; openspec specs/changes/
archive + docs + reports; the live runtime, 7 days) over six mechanisms that let the substrate learn from and
correct its own code landings. This corrects my 09-28 claims that several were "missing".

## Verdict

Every mechanism has been built at least once. The failure mode is **decay without detection**: a mechanism passes
its acceptance once, is marked done, and later stops firing on real traffic because an input stops being filled,
a key stops matching, a policy is left at a test value, or its reader is deferred. Nothing watches whether a built
mechanism still fires; the watchdogs meant to (joint-liveness, validator-liveness) are themselves in `failed` state
on node 2.

## Per mechanism (built → state now → why tonight's landings slipped through)

| # | Mechanism | Built (first) | Live state 09-28 | Why it did not catch tonight's false "verified" |
|---|---|---|---|---|
| 1 | Failure → lesson the drafter reads | compose_lesson `7969b5c` (07-03); failure_lessons 07-05; file lessons 07-10; ledger `writeLesson` `c89861b` (09-23); goal-host failure memory `9e23455` (09-22) | Drafter reads lessons every compose (45 concepts, 7.5k jsonl lines on n1). **0 of 45 concepts from a revert/regression**; classes are pre-land only. Failure memory feeds the walk, not feature_compose. | Ledger lesson fires only on a `regressed` settlement from its baseline checks (systemd units, gate probe, ledger canary) — tonight's regressions flip none. Operator `regressed_by` has no reader except the picker hold; `recordFalsifiedAutonomousLanding` returns not_applicable when an operator stamp exists and never calls `writeLesson`. Decomposition re-decomposed a reverted gap 3× (does not read `regressed_by`). |
| 2 | Behavioural / consumer-side verification | `behavioral-verification.ts` `399bb2c` (07-12, substrate-authored), wired in every cutover; credit gated on it `0bd32ff` (07-31); post-land suite `2ddcac0` (08-04) | Runs on every cutover as `{ran:false}`: **0 of 6,133 gaps carry `verification_spec`.** Post-land suite gave e059a98 and its revert the same result (145/2). | The only probe primitive on the landing path has never had an input. The suite files only newly-failing tests; a stale test made to pass reads greener. Pre-land evaluate the same. |
| 3 | System-initiated revert | Substrate-authored git reverts existed (local-tools/dev-vessel, 07-22 → 08-01); pre-land rollback; pull-cutover health revert `edb4ba3` (07-21) | **None since 08-01**; every later revert operator-authored. Post-landing revert specified in five openspec changes since May (self-deployment "rollback within 1 h", fleet-federation, closure-proof G4.3, redeploy D.1, contained 8.3/8.4) — none built. | The revert detector matches `git revert` text; tonight's reverts were `substrate-authored: apply route-edit-…` / a direct commit, so the system cannot see them. |
| 4 | Crystallisation / ribosome / pathway reuse | ribosome Phase 5 `e5b04851` (03-27); reach→mint `15620e7` (06-22); many repairs through 09-25 | Pathway reuse live for compute goals (1,227 accepts). **ribosome-extract: 1,788 executions in 7 d, all `execution_error`; 0 templates extracted since 09-22; ribosome discovery registration fails 400 every minute.** | Edit-intent goals route before the walk; compose landings never reach `mintReachedTrace`. Crystallisation of self-development has never happened. |
| 5 | Gap quality from code facts | narrowing `72c0747` (07-06); closure-predicate-at-birth `be26a6b` (08-30) **reverted** `8a5223c` (08-31); Class-2 predicates first evaluated 09-01; gap_falsify 09-27 | Decompose n1: 688 runs, **0 writes**. Narrowing re-emits the same parents (267 "no failure_lessons"). 0 gaps with `verification_spec`. "Wrongness is a goal seed" exists only for goal-host reach verdicts and transform artifacts. | Tonight's wrong gap text (mine) steered a wrong fix; nothing derives a gap's description or check from code facts. |
| 6 | Operator feedback consumption | `goal_verification_labels` `de611aa` (04-29); consumer `fc297b4` (07-20), `d9dc600` (07-27) | Consumer live (`maybeConsumeOracleLabel`), but keyed on goal-host dispatch records (~3 h window). Human labels: 15 in 7 d, **none since 09-26**. "consequence-verdict-into-credit" (08-26) marked superseded by the ledger, which defers posterior binding. | Picker composes have no dispatch record, so a label on them has nowhere to land. **Correction:** my 03:30 CHECKINS row said the feedback plane is "audit-only (nothing reads it)" — wrong; the reader exists, keyed on something picker composes lack. |

## Operational findings (live, 09-28 ~05:00)

- **Correction (05:20, read-only diagnosis):** node 1 (the hub, which holds the DB) runs joint-liveness, validator-liveness, compose-drift, learning-loop-selftest and pull-sync successfully, with next runs scheduled; boredom-vessel runs as an active service (the timer is unused); gap-compose was masked deliberately for the quiet window. The watchdogs are NOT broken where the data lives.
- Node 2's failures are a profile mismatch plus one real build problem: the three DB watchdogs fail 'Unable to connect' because node 2 has no DB (law 11: they belong on the hub only); learning-loop-selftest's script is missing from node 2's super-repo clone (clone behind, at ce1e4c5d); **pull-sync fails because cpg-inference-ts's build fails on node 2** ('BUILD FAILED — keeping live dist', synced=0), so node 2 converges nothing while it persists.
- ribosome-vessel: registers with `shapes: []` (it owns no shapes); discovery's later security-audit validation rejects an empty shapes array → 400 every minute (contract drift; functionally minor). Its extraction dispatch pins `targetTemplateId: ribosome-extract`, which is absent from the template catalogue (first 500 checked), so goal-host derives a fresh walk that ends hollow ('missing activityTemplate, learningSummary') — all 1,788 'errors'. Per its own code comment, extraction was subsumed by goal-host's in-process `mintReachedTrace`; the ribosome dispatch is a redundant path to a retired template. The real question is why `mintReachedTrace` has produced no template since 09-22.
- Settle window on node 1 is `window_ms: 120000` — the 2-minute acceptance-run value, never reset (code default 15 min). Settlement `#1` seals before an operator can judge.
- e059a98: settlement `#2 regressed` at 04:09, then `#1 held` appended at 04:13 (`credit_eligible:true`). Readers that take the highest seq see `regressed`; any reader that takes `#1` sees `held`.
- n2 concept-db lesson mirror failed 17× tonight (n2 lessons stay local).
- The sweep closed ec962628-step-1 and obsidian-step-1 `landed_verified` with `predicate=none`.
- Junk gap row `id: "g.id"` (09-27 13:48, a literal-template write).

## Spec says done, later evidence says it did not work (from the specs sweep)

causal-attempt-ledger declared CONSISTENT, then settled `0a0d59f` `held` while it stopped every landing ~3 h;
ledger extraction-deferral vacuous (compose never reaches `mintReachedTrace`); lesson delivery drops when the gap
was never persisted; contained-self-development 1.5 PASSED, then the first autonomous landing was a live regression;
failure memory "works" but missed its A/B criterion and re-seeded the 09-26 storm; live-recipe rescue deployed INERT;
live-self-view 4.1 "MET" verified in the diff only; checkboxes out of step in ≥12 changes.

## Reconnect before building (priority)

1. **Operational**: fix cpg-inference-ts's build on node 2 so node 2's pull-sync converges; stop scheduling the DB watchdogs on DB-less nodes (profile); retire ribosome-vessel's redundant dispatch (or give it the retired template back) and register it with its real consumer role; find why goal-host's `mintReachedTrace` has extracted nothing since 09-22.
2. **Settle window** back to its 15-min default; settlements revisited when a `regressed_by` lands later.
3. **Revert recognisability**: directed revert goals and operator reverts carry `reverts <sha>` so `shaWasRevertedInAnyClone` sees them.
4. **Operator `regressed_by` → the existing lesson/settlement path** (`writeLesson`, `#2` settlement, posterior miss), and decomposition reads `regressed_by`.
5. **Give behavioural verification its input**: derive `verification_spec` (a production-path probe) at gap birth, starting with failing-test gaps, so the cutover's existing probe runs.
6. **The missing mechanism — mechanism liveness**: each self-correction mechanism carries an expectation "fired on real traffic within N" (the expectation-scan / responsibility-cycle framework exists), so decay is detected instead of discovered months later. This is law 6's "what detects the class without me" applied to the self-correction machinery itself.
