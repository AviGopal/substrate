# Mechanisms, chunk 01: development-vessel self-development seam

Input: `classes/_mech_chunks/01.json` (12 records, all labelled `development-vessel`).
Evidence was collected read-only on 2026-09-29 around 05:00Z from `substrate-live` (hub): the dev-vessel clone
`/workspace/git/vessels/development-vessel` at `f451e42` (09-29 01:37), the super-repo clone
`/workspace/git/super-repo`, the `execution` table, systemd, and the live gap store (6,285 rows). Node 2 (`compose2-live`) was also checked.
**Execution counts cover the retained window of about 7 days.** The `execution` table keeps about 7 days
(git-devvessel-2.md:15), so "0 executions" means none in that window. It does not mean the mechanism never ran.

## Location correction (changes the frame)

Three of the 12 records are **not in development-vessel**. They live in `super-repo/scripts/substrate/` as systemd timer and service pairs:
`learning-loop-selftest-tick.ts`, `runtime-drift-tick.ts` and `self-repair-operational.ts`.
Their units are in `scripts/substrate/units/`.
A timer is not an activity (law 2). It cannot be selected by Thompson, it produces no execution trace, and discovery cannot reach it by shape.
They are also not the "two liveness watchdogs" that CLAUDE.md exempts.
So none of the three can be discovered today except through `systemctl`.

## Dedupe within the chunk

| Chunk names | Actually one mechanism |
|---|---|
| `runtime-drift detector` + `runtime-drift repair` | one file, `scripts/substrate/runtime-drift-tick.ts`. The repair branch duplicates the mirror in `substrate-pull-sync` (see row 6). |
| `perf_canary_resolve` / `performance_reach_gate` | already one record. There are 2 resolvers: `perf-canary-resolve.ts` calls the gate. |
| `self_interference_scan` + `state_dependent_test_blame` | one resolver (`self-interference-scan.ts`). The blame logic is inside it. |

That leaves 11 distinct mechanisms. The bare activity `ribosome-extract` also has a sibling, `compose-auto-bridge-source_code-to-ribosome-extract`, with 619 executions in 7 days. That sibling is an auto-bridge the system minted, not a second extractor. It is noted in row 5.

## Verdicts

| # | Mechanism | Verdict | Used now | Live evidence |
|---|---|---|---|---|
| 1 | learning-loop-selftest-tick | keep-general | yes (hub) / no (node 2) | Hub: `learning-loop-selftest.timer` runs every 6h and last ran 09-29 01:34 with `Result=success`. Output: `GREEN goal_path`, `GREEN confinement`, **`RED posterior_delta`**. The RED is correct, because `posterior-update.ts` skips writing a belief for idle or no-choice arms. The gap `learning-loop-selftest` has been open **since 09-19** and nobody has decided what to do with it. Nine child gaps `gap-learning-loop-selftest-*` were mass-closed in 2 minutes on 09-28 01:27–01:29. Nobody investigated (timers-readers.md:63). Node 2: `Result=exit-code ActiveState=failed`. `learning-loop-selftest-tick.ts` is deleted in node 2's clone and pull-sync reports `synced=0` (class sync-deploy-drift). This is a check that needs hub state, running on a spoke. |
| 2 | mitosis cutover (stage → evaluate → cutover → push) | keep-general | yes | This is the single landing seam. `vessel_mitosis_cutover` ran **588 times in 7d, all with `status: null`**, a trace-quality defect on the most important seam. `development-vessel:mitosis-tick` ran 7,842 times in 7d. It is referenced from `seed/mitosis-tick.ts`, `seed/apply-proposal-as-patch.ts`, `resolvers/patch-with-tools.ts` and `resolvers/variant-promote.ts`. Known defects: `patch-with-tools.ts:239` (d12c654, 07-26) hardcodes `evaluation_evidence.verdict:"FAVORABLE"` (git-devvessel-2.md:90). The cutover refuses protected vessels and offers no alternate lane (09-16). 76% of autonomous landings carry a `route-edit-*` id that is absent from the gap store. |
| 3 | orphaned-capability-scan | broken (then merge-into a usage census) | yes | `development-vessel:orphaned-capability-tick` ran 26 times in 7d. `satisfier:orphaned_capability_scan` ran 32 times (18 failed). Gap store: `orphaned-capability-*` 38 open, 5 closed, **8 rejected**. It cannot see direct code imports or LLM tool-loop calls, which produces phantom orphans (reports-3: 52/303). The data to fix this already exists: `execution_trace_content` keeps `resolver_id` and `tool_calls` for each task (live-resolvers.md:13). The ribosome also minted noise from this scan: `learned-composition-orphaned-capability-scan-to-shellresult` ran 157 times and was never graded. |
| 4 | perf_canary_resolve / performance_reach_gate | revive-general → merge-into the post-land verification seam | yes, but at the wrong seam | The chunk record ("0 in 720h", 08-15) is stale. In 7d: `satisfier:performance_reach_gate` 13 (3 failed), `satisfier:perf_canary_resolve` 1. Every one is a walk fallback (`satisfier:`). There is **no seed template and no caller** in `vessel-mitosis-cutover.ts`: the only references are `routes/impulses.ts`, `config.ts` and the two resolvers themselves. The last edit was 1dd095c (08-31). The seam that needs measurement after a change is `post_land_suite` at `vessel-mitosis-cutover.ts:2963`, which was dead from 08-31 to 09-28 (5e9a0b2). Classes: dormant-mechanism, hollow-landing. |
| 5 | ribosome-extract | broken (keep-general once repaired) | runs, extracts nothing | In 7d it ran 1,442 times: 1,438 `success` and 4 `failure`, but **reached: 0** (1,081 false, 361 null). Runs take about 7ms. Failure reason on the latest row (09-29 04:59): `UNRESOLVABLE_PLACEHOLDER: task 'acquire_trace_signature': unresolvable placeholder {{lifecycle.executionId}} — path not present in the triggering lifecycle impulse data`. The seam is the binding between the lifecycle impulse and the template. It is **not** the URL join. Second defect: ribosome-vessel (:8240) registers `shapes:[]`, which discovery rejects since 7cc9da4 (09-19), so it is unreachable through discovery (live-resolvers.md:161). The joint-liveness gap `severed-joint-ribosome-extraction` reports a lag of 591,566 s (6.8 days). The 7,808 `learned-*` executions in 7d come from **past** extractions. Extraction itself has stopped. The chunk's "1,459/1,456 in 5d" counts status, not reach. |
| 6 | runtime-drift tick: detector | keep-specific → merge-into substrate-pull-sync as its post-sync verification | yes | The timer runs every 10 minutes. At 04:59 it logged "18 vessels checked, runtime matches committed source (2 not coverable: demo-vessel, relevance-sink-vessel)". It writes `substrateGap_write` (runtime-drift-tick.ts:289, 338). Gap store: `runtime-drift-*` 13 open and 1 closed, while the detector reports no drift. **It opens gaps and never closes them**, a write-read mismatch. It does not run on node 2's timer list. |
| 6b | runtime-drift tick: repair branch | duplicate-of `substrate-pull-sync` mirror-to-live (fossil) | no | 63b48175 added a second repairer, which raced pull-sync. bb217e5e (09-13) defaulted it OFF, and it can only be armed with `RUNTIME_DRIFT_REPAIR=1`, an env gate (law 1). Class history: sync-deploy-drift, codebase-bloat-fossils, env-gating. |
| 7 | self_fact_reconcile | keep-general | yes | `development-vessel:self-fact-reconcile-tick` ran 574 times in 7d (13 failed). `satisfier:self_fact_reconcile` ran 6 times. Registered in `seed/self-fact-reconcile-tick.ts` and `config.ts`. Gap store: `self-fact-*` 13 open, 5 closed, 3 superseded. Its closures **flap on polarity**, and some were falsified (live-gaps.md:213). It is also referenced from `gap-to-feature.ts` and `patch-with-tools.ts`, so it is a shared seam. |
| 8 | self_interference_scan (+ state_dependent_test_blame) | revive-general | no | Seeded in code (`seed/index.ts:171/650`, `config.ts:79`, `seed/self-interference-scan-tick.ts`, id `development-vessel:self-interference-scan-tick`), but **0 executions in 7d**. The resolver was last touched by 60bef16 (09-15). When it did run (09-13, 44904fa and fc7789c), it flagged 55 offenders, 69% of blame pairs (class test-residue-live-state). The class is live now: a5f45a1d (09-29) reports "verification refused on an unrelated test". |
| 9 | self_repair_operational (re-enable allowlisted timers) | broken | yes | It lives in `scripts/substrate/self-repair-operational.ts`, not development-vessel. The timer runs about every 15 minutes. At 04:59 it logged "0 repaired, 0 failed, repair=true". It honours `masked` (line 72) but **cannot see an operator hold** (stop or disable), so it re-enabled `funnel-drain.timer` 54 times in 17h against holds (`self-repair-*` 54 resolved). That is the same issue recurring for the same reason. Fix: express the hold as a shaped impulse the tick reads (laws 1 and 5). Keep the class, not the current rule. |
| 10 | substrateGap_write validation | broken | yes | `substrate-gap.ts:801-809` rejects `{{` in id and category, and has since 6f93cff (07-04). Yet **10 placeholder-id rows** landed from 09-19 to 09-25 (`{{substrateGap.id}}`, `{{goal.gap_id}}`, … `{{goal.target_output_shape.id}}`), with statuses such as `{{status}}`. So some write path other than the create gate persists them. That path is not identified yet; candidates include `gap-lifecycle-scan.ts`, `drain-pending-substrate-gaps.ts` and `gap-to-scenario-bridge.ts`. The free-text falsifier is only **classified** (`FalsifierClass`, line 444; "never rejects a gap for lacking a falsifier", line 423), never stored as text. The `operator` field is dropped. `missing_required_field` was hit 298 times in 7d (5% of 1,572 calls). |
| 11 | surqlBreakingFieldRefusal guard | keep-specific | yes | `vessel-mitosis-evaluate.ts:724` (definition) and `:1285` (call), probed by `resolvers/gate-self-probe.ts`. It was deleted by 54b7762 (09-16), which wedged all `.surql` landings, and restored by 1a18944 (09-22). The last edit to the file is 70d2a00 (09-25). It is a gate that reads text, not one that runs anything. Keep it as the dialect guard, and make sure `gate-self-probe` keeps checking it against the unmodified file. |

## How the kept and revived ones become discoverable

- **Activities (rows 2, 3, 5, 7, 8):** each is already a seed template in `development-vessel/src/seed/index.ts`, and its resolver shape is listed in `src/config.ts`, which dev-vessel advertises to discovery. Row 8 needs selection pressure: a rhythm impulse, or boredom weight from the open test-residue gaps. It does not need a new template.
- **Row 4:** mint no new template. Have the post-land step in `vessel-mitosis-cutover.ts` compose with `performance_reach_gate`, so its posterior is earned at the landing seam (law 3).
- **Row 5:** fix the `{{lifecycle.executionId}}` binding, and let ribosome-vessel register a consumer row that discovery accepts (it currently rejects `shapes:[]`). Without both fixes, learned-pathway reuse stays starved.
- **Timers (rows 1, 6, 9):** today they are discoverable through systemd only. Mint each tick body as a seed activity driven by a rhythm impulse (law 5). Then it is traced and graded, and a spoke can reach the hub's copy over discovery instead of failing locally (node 2's selftest).
- **Row 3's repair target:** one usage census over `execution_trace_content.resolver_id` and `tool_calls`, plus import greps, shared with the `resolver-dist-orphans` and `activity-lifecycle-unload` families rather than a third detector.

## Fossils and where to archive them

- **6b, the runtime-drift repair branch:** already off. Archive it by reference to git history (63b48175 → bb217e5e, 251a6b4d) and remove the env-gated branch from `runtime-drift-tick.ts`. The detector half stays.
- The ribosome's noise mints from row 3 (`learned-composition-orphaned-capability-scan-to-*`, 9 variants) should be retired through the retire primitive (19ae84e), not deleted by hand.

## Recurring-class links (the same failure for the same reason)

- **Unbound placeholders**, across rows 5 and 10: `{{lifecycle.executionId}}` kills extraction, and `{{goal.gap_id}}` ids enter the gap store. The class spans 18 class files. Guarding one write path does not cover the class. The template renderer has to fail closed at bind time.
- **Detect without disposition**, across rows 1, 6 and 9: the selftest RED has been open since 09-19, runtime-drift keeps 13 gaps open while reporting no drift, and self-repair keeps acting against holds. Each files or acts, and nothing reads the result back.
- **Timer, not activity**, across rows 1, 6 and 9: all three are invisible to traces and learning, and all break on spokes.
