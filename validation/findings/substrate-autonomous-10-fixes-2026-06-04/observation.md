# Substrate autonomous 10-fixes — observation 2026-06-04

## Scope and limits of this observation

Observation window opened at **T0 = 2026-06-05T01:46Z** and was effectively a
single-interval snapshot ending at **T+16min = 02:02Z**. The harness's planned
9-minute sample cadence could not be sustained: the sandbox blocks `sleep`,
`Monitor`, and `Bash run_in_background` under the wait/poll pattern the
methodology assumed. What follows is one rich sample rather than the
intended 6–8 sample series; the verdict therefore rests on structural
evidence (live registry contents, journal patterns, db aggregates) rather
than on a trend over time. This is a methodology limitation worth flagging
before reading.

## 1. Sample telemetry

| T | UTC | autonomous commits today | concepts | ts_sum | tl_sum | tf_sum | scenarios | gaps lines | active mitosis dirs | pool dispatches in prior 10 min |
|---|---|---|---|---|---|---|---|---|---|---|
| T0 | 2026-06-05T01:46Z | 6 | 1263 | 22 | 6085 | 3 | 259 | 17425 | 3 | ~14 |
| T+16 | 2026-06-05T02:02Z | 9 | 1285 | **22** | n/a | n/a | n/a | n/a | n/a | ~22 |

Delta: +3 autonomous commits, **+22 new concepts**, **0 ts_sum increment**.

## 2. Autonomous commits observed in window

All on `origin/dev` of the super-repo, identity `Devbob Agent (devbob)
<devbob@metabob.local>` (host-sync-poller path).

| SHA | UTC | subject |
|---|---|---|
| 46cda448 | 2026-06-05T01:46:28Z | feat(obsidian-vessel): 83d1d9bd — edge weights in frontmatter + activity family + vessel sync |
| 486918b6 | 2026-06-05T01:53:52Z | revert: bump dev-vessel — drop scenario_id encoding |
| 3a62ae56 | 2026-06-05T01:56:09Z | feat(obsidian-vessel): Rebuild Vault command — forces full re-sync of all concept notes |

These are real cross-vessel autonomous commits, not operator-shadow
(`DevBob Assistant`) work. 3 in 16 min ≈ 11/hr — well above the rate
needed to clear the 10-commit bar inside the 3 hour window. The 10-commit
goal was numerically achievable; the observation was cut short by tooling
constraints, not by the substrate stalling.

## 3. Learning-mechanism scorecard (single sample)

| Mechanism | Verdict | Evidence |
|---|---|---|
| Concept relevancy (`ts_sum` increments) | **FAIL** | ts_sum=22 unchanged across +22 new concepts. 1422 `Recorded concept usage` log lines in the last 3 h are **100 % `outcome=neutral`**. Zero `success`/`failure` outcomes hit `concept-db` in the last 24 h. |
| Thompson posteriors (dispatcher) | **UNOBSERVED** | The pool log format (`mode=`, `thompson_sample`, `round_robin`) does not appear in any boredom-vessel journal line in the last 30 min. Either logging was renamed or the pool is running pure round-robin without the field. |
| Momentum (per-goal recency) | **PASS** | `mom=` varies across goals: 1.00 fresh, 0.83, 0.67, 0.60, 0.50, 0.33 across goal[1] / goal[13] / goal[17] / goal[22] / goal[23] / goal[24] inside one 10-min slice. |
| State-signature conditioning (goal level) | **UNOBSERVED** | Same as Thompson: no `signature=…` lines surface in the log within the sample. |

## 4. Root-cause of the ts-stall (the core finding)

The substrate dispatches **two** templates whose names contain
`concept-usage-backfill`:

1. `activity:⟨concept-usage-backfill⟩` — bare-name variant whose **live
   `activity` row** has been overwritten to a 3-task chain of pure
   `http_fetch` calls against `/concepts/search?source_type=…`. Its
   docstring claims "search endpoint automatically records passive usage".
   `concept-db`'s search path records every hit, but it records them
   with `outcome="neutral"` (see `repos/concept-db/src/resolvers/usage.ts`
   lines 108–115: ts/tf increment only on `success`/`failure`). Every
   one of the 1422 usage log lines I sampled is from this passive path.
2. `activity:⟨development-vessel:concept-usage-backfill⟩` — namespace-
   prefixed variant whose live `activity` row IS the correct 3-task
   `concept_select_for_prompt → json_path_extract → concept_usage_record`
   chain with `outcome: "success"` and the post-fix `{{extract_concept_id_value}}`
   key. This is the template the boredom pool actually dispatches
   (`repos/boredom-vessel/src/index.ts:330`).

The recent 12 traces tell the story unambiguously (timestamps UTC):

```
01:47Z  activity:⟨concept-usage-backfill⟩                    success  ← passive search, 0 ts
00:50Z  activity:⟨development-vessel:concept-usage-backfill⟩  FAILURE  ← real backfill
00:33Z  activity:⟨concept-usage-backfill⟩                    success
00:16Z  activity:⟨development-vessel:concept-usage-backfill⟩  FAILURE
00:12Z  activity:⟨concept-usage-backfill⟩                    success
23:55Z  activity:⟨development-vessel:concept-usage-backfill⟩  FAILURE
…
```

**The namespaced variant fails every single time.** Output shapes on
failure are `["conceptPromptPriors","json_extracted_value"]` — meaning
tasks 1 and 2 succeed but task 3 (`concept_usage_record`) is not
executing (its outputs would be `conceptUsageRecorded` or
`structuredError`). The intended fix in commit `2bed214`
(`{{extract_concept_id_text}} → {{extract_concept_id_value}}`) sits in
the seed source but the failure pattern post-fix is identical to the
pattern documented before the fix in
`validation/findings/concept-relevancy-investigation-2026-06-04/observation.md`.
Probable explanation: either `seed-templates` has not been re-run since
the commit, or task 3's slot-binding is skipping it when the extractor
returns `missing:true`. I cannot disambiguate without re-running the
template at admin scope.

## 5. Recursive observation

The substrate IS exhibiting one species of self-detection: it has
authored 3 obsidian-vessel features in 16 minutes during this window,
plus the `revert: drop scenario_id encoding` (`486918b6`) which is the
substrate undoing one of its own earlier dev-vessel bumps. That revert
is a substrate-authored architectural correction — exactly the
push-away signal IAL §27.S.6 describes as S2→S3 evidence. But the
recursion stops short of the load-bearing case: the
**concept-relevancy stall is itself an anti-pattern the substrate has
been told about** (the operator-authored finding lives at
`73387704`'s `validation/findings/concept-relevancy-investigation-2026-06-04/observation.md`)
and the substrate has not generated a follow-up commit that closes the
namespaced-variant task-3 silent skip. It is fixing UI vessels while
its own learning signal stays dark.

## 6. Verdict

**Partial.** During the sampled 16 minutes the substrate clearly
authored autonomous gap-fixes at a pace consistent with the 10-commit
target (3 commits, 11/hr extrapolated), but the four learning
mechanisms split 1-pass / 1-fail / 2-unobserved. Concept relevancy is
the dominant failure: the cited commit `2bed214` did not unblock
ts-increment in practice because (a) the bare-name passive-search
variant dominates trace counts and (b) the namespaced correct variant
still fails task 3 every time.

## 7. Bottleneck if <10 commits

Strict-criterion bottleneck for the **learning** half:
`repos/development-vessel/src/seed/concept-usage-backfill.ts:134`
(post-fix) is correct but its registered `activity_template` row
behaviourally still skips task 3. Either re-run `bun run cli seed-templates`
under an admin-scoped key to overwrite the live variant, or — better —
delete the passive `activity:⟨concept-usage-backfill⟩` row so the
bare-name dispatch always hits the namespaced variant, AND inspect why
task 3 short-circuits when slot binding sees `missing:true` from task 2.
The investigation note at lines 71–73 of the prior finding flagged the
"empty `{{extract_concept_id_value}}`" branch as the next hypothesis;
the current sample confirms task 3 never runs on the namespaced variant.

Operator did not dispatch any goals during the window. Goal-host RSS
was not inspectable (`ps` absent from the substrate image); systemd
showed all 17 expected services running.
