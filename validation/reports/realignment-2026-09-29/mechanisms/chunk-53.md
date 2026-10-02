# Mechanism verdicts: chunk 53 (clock-vessel)

Input: `classes/_mech_chunks/53.json`. It holds one collector item, `clock-vessel (plain dir)` at `repos/clock-vessel` (purpose `currentTimeReport`, source `git-super-1`).
Verified read-only on 2026-09-29 against the host super-repo and node 1 (`substrate-live`).

## Class history (checked before judging)

- **06-02 `e9c1d2fa`** "feat(clock-vessel): first substrate-authored vessel scaffold". Trace `exec_zyfoa5y2` ran `development-vessel:scaffold-new-vessel` with `advertisedShapes=[currentTimeReport]`. It wrote 4 files. The commit body says the files were then *copied to the host repo by the operator*, and that nothing chained into publishing or discovery registration. The authoring was substrate work; the landing was the operator's.
- **`aeecbd4a`** renamed the package. **09-07 `4e4170a8`** was a drift sweep ("vessel code drift detected and committed") that also carried compiled `.js/.d.ts/.map` files into the tree.
- memory-5 and memory-4 (07-24, 08-06) recorded that clock-vessel has "no entry point" and is "DECLARED-ONLY".
- openspec-4 recorded the 06-16 namespace change. Its removal task R.1 (`vessels/`, `activity-monitor/`, `clock-vessel`) is still **unchecked**.
- memory-4 (09-22) and critic.md list clock-vessel as one of 3 plain-file vessels. That makes it outside the authoring loop.

## Live evidence (2026-09-29)

- **No runtime.** No `clock-vessel` unit exists in `systemctl list-units '*vessel*'` (13 units, none of them clock). No `/vessels/clock-vessel` exists in the image layer, and no `/workspace/git/vessels/clock-vessel` clone either. **Correction:** vessel-docs-tooling.md says "missing: … clock (running units)" from the hub registry. That claim is wrong: the vessel is missing from the registry because it never runs.
- **Scaffold only.** `repos/clock-vessel/src/routes/impulses.ts` still has `// TODO: Add case arms for each advertised shape`. Its switch has only a `default` arm, which returns `shape:"error"`. There is no `src/index.ts`.
- **No producer of `currentTimeReport` anywhere.** A grep of `/workspace/git/vessels/*/src` and `/vessels/*/src` for `currentTimeReport` returns nothing. Time for the rhythm system is read in-process (`rhythm-reality-sync.ts:170`, `Date.now()`) and carried in `timeShapedRhythm` impulses.
- **It is still referenced, as a default fixture.** Three live development-vessel resolvers default their target to it:
  - `resolvers/assessment-summary.ts:113` defaults to `repos/clock-vessel/src/config.ts`.
  - `resolvers/source-code-analysis.ts:141` defaults to `"repos/clock-vessel"`.
  - `resolvers/code-quality-with-substantive-assessment-content.ts:35` defaults to `../clock-vessel`, and its LLM prompt hard-codes "code quality review of clock-vessel".
  - `config.ts:245` registers the shape `"code_quality with substantive assessment content"`.
  - The journal on 09-26 13:46 logged open gaps `orphaned-capability-code_quality with substantive assessment content` and `orphaned-capability-assessment_summary`, both with `falsifier=none`.
  - Separately, `auto-bridge-code_quality` ran 274 times in the retained 5-day execution window.
- **The generator lesson was absorbed.** `seed/complete-vessel-scaffold.ts:17,294` and `resolvers/vessel-completeness-report.ts:18` cite clock-vessel as the motivating case for "no `src/index.ts` means no entry point". The learned-composition activity `learned-composition-filecontent-to-summary-of-clock-vessel-functionality` still exists as a row. Its resolver file `summary-of-clock-vessel-functionality` was deleted in `76383da` (git-devvessel-1.md).
- **The scaffold activities that produced it are barely alive.** In the 5-day window, `scaffold-and-publish-vessel` ran 6 times and `scaffold-mitosis-track` 3 times. Their `detect-unclassified_failure_*` detectors ran 41 and 57 times, so failures outnumber runs by about 10:1. `scaffold-new-vessel` has 0 runs in the window.

## Dedupe

There is one item. The only other name for the same thing is `summary-of-clock-vessel-functionality` (an activity row, its resolver deleted). It belongs to the fossil below and is not a separate mechanism.

## Verdict table

| # | mechanism | verdict | used now | evidence | discoverable via / archive at |
|---|---|---|---|---|---|
| 1 | `clock-vessel` (plain dir, `currentTimeReport` scaffold) | **fossil** | no (as a vessel). Its files are read as a default fixture by 3 dev-vessel resolvers. | It has had no unit, no image copy, no live clone and no entry point for 119 days (since 06-02). Its dispatch is a TODO that returns `error`. No producer or consumer of `currentTimeReport` exists anywhere. Removal task R.1 has been open since 06-16. The hub registry leaves it out because it never ran. | Archive to `archive/fossils/clock-vessel/` in the super-repo: the 4 source files plus a tombstone citing `e9c1d2fa`, trace `exec_zyfoa5y2`, and the lesson "a scaffold without an entry point and a registration step is not a vessel". Also delete the compiled `.js/.d.ts/.map` residue from `4e4170a8`. Retire the row `learned-composition-filecontent-to-summary-of-clock-vessel-functionality` via the retire primitive (19ae84e). |
| 1a | the lesson it carries (a scaffold must emit `src/index.ts`, register, and chain to publish) | keep-general (already merged into `complete-vessel-scaffold` / `vessel_completeness_report`) | yes, as seeded code | `seed/complete-vessel-scaffold.ts:294` and `vessel-completeness-report.ts:18` cite it | Already a development-vessel seed plus a resolver shape. Mint it as a concept-db class concept ("vessel minimum contract": `/health`, pointer.type dispatch, register + 60s heartbeat, `systemVessel:true`) so the drafter recalls it at prompt-build instead of it living only in code comments. |

## Hazard: do not delete the directory before re-pointing the fixture defaults

Removing `repos/clock-vessel` today would silently change what 3 registered shapes do. `assessment_summary`, `sourceCodeAnalysis` and `code_quality with substantive assessment content` would each start returning "Failed to list / No TypeScript source files". That is a silent read-failure, and exactly the "negative without a positive control" class. So the archive step has one required precondition: one goal per file, run in this order.

1. `repos/development-vessel/src/resolvers/assessment-summary.ts`: make `target_file` required. If it is absent, return an explicit `missing_target` error.
2. `repos/development-vessel/src/resolvers/source-code-analysis.ts`: the same change, for `target_path`.
3. `repos/development-vessel/src/resolvers/code-quality-with-substantive-assessment-content.ts`: the same change for `vesselRoot`, and parameterise the vessel name in the prompt.

After that, the two `orphaned-capability-*` gaps (`falsifier=none`) can take a real predicate, "shape rejects a pointer with no target". Only after these three land does the archive move.

The generator for this goal is the missing piece, per law 6. The substrate has no detector for a "resolver default path points at a fossil dir". Its closest relative, `vessel_completeness_report`, flags incomplete vessels but not their consumers.

## Should a clock be revived?

No, not as a vessel. `currentTimeReport` has had zero demand in 119 days. Time-shaped cadence already travels as `timeShapedRhythm` impulses read by the rhythm conductor (law 5). Wall-clock "now" is a primitive every resolver has, and giving it its own vessel would violate data locality (law 11), since the clock has no data to live next to. If a walk ever needs "now" as an impulse, the reuse-before-mint answer is a deterministic `currentTime` case in an existing always-on vessel such as local-tools-vessel. That should be added only when a trace shows a walk that failed for lack of it.
