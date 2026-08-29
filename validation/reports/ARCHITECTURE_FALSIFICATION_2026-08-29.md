# Architecture falsification matrix — 2026-08-29

**Purpose.** `CLAUDE.md` states the architecture's execution expectation as a set of claims.
This document turns each into a test that **can return false**, records the current verdict,
and cites the measurement. It is the answer to "we should be able to falsify the architecture."

**Method rules, applied to every row.**
1. The verdict criterion is written **before** the measurement. A criterion chosen after seeing
   the result is the Goodhart pattern `SUBSTRATE_AS_MDP.md` §12.6 exists to prevent.
2. A row that cannot come back **FALSE** is not a test. Rows that turn out to be untestable are
   recorded as `UNTESTABLE`, which is itself a finding about the architecture.
3. Verdicts cite the measurement, not an impression. Where a number is disputed, the more
   conservative one is used.
4. Sample size and denominator are stated. A rate over 7 of 663 is not a rate over 663.

---

## The chain under test

The architecture's own lift gate (dev-vessel `CLAUDE.md`) is:

> three consecutive `coverageReport.coverage_progress = true` from natural activity
> **AND** `substrateHealthReport.health_verdict.overall_passing = true`

Measured 2026-08-29: `coverage_progress: true`, `overall_passing: **false**`, failing solely on
`confidence_passing` — 2 of 17 posterior pairs above the floor of 10, median α+β = 3.

The causal chain to that single failing term, each link measured:

```
reach 10% per attempt (edit-intent lane 0%)
  → ribosome skips 942 extractions in 6h, all "not honestly reached"
    → 0 new templates in the window (2657 stable, mutation rate 0/h)
      → posteriors never accumulate samples (median α+β = 3, floor 10)
        → confidence_passing = false
          → overall_passing = false   ← the lift gate
```

Every row below locates itself on that chain. Work that does not is deferred.

---

## Claim matrix

| # | Claim (source) | Discriminating test | Verdict | Evidence |
|---|---|---|---|---|
| 1 | **Floor: parity with a ReAct agent.** "No goal should be structurally out of reach just because no learned pathway exists yet" (`CLAUDE.md`) | Dispatch goals; a family reaching 0% over a meaningful n falsifies parity | **FALSIFIED** for the edit-intent family | Edit-file goals: **0 reaches / 41 attempts / 16 distinct goals** (24h). Non-edit goals reach 52%, so the walk machinery is not the limiter |
| 2 | **Reach ~90% regardless of priors** (`CLAUDE.md`, "Reach is mechanism correctness") | Reach rate over all dispatched goals | **FALSIFIED** | **10%** per attempt (20/196); **22%** per distinct goal (14/65). Both far below 90% |
| 3a | **Ceiling — reuse OCCURRENCE: a repeated task runs over a learned pathway** | `walk_tier ≠ fresh_derivation` on the second run | **TESTABLE — experiment not yet run** | *Corrected 2026-08-29: this row originally read UNTESTABLE, which was overstated.* `walk_tier` **is** persisted and readable (`goal-paths.ts:605/627/677`, `schemas.ts:759/794`; migration 181). Occurrence was measurable all along |
| 3b | **Ceiling — reuse ATTRIBUTION: *which* pathway was borrowed** | Store row carries the donor's goal hash | **WAS UNTESTABLE → repaired, awaiting first natural event** | Reuse was computed then discarded to a log line: `[goal-host] REUSE LINEAGE (not yet storable)`, `index.ts:5628`, ~8/day. Receiver landed `4e0d27a` (fields + migration 204 + read schema); sender pending deploy gate |
| 4 | **Middle / Ceiling: a similar task reuses the pathway and walks only the difference** | Dispatch a near-miss variant; must reuse the body, walk only entry/exit | **FALSIFIED BY CONSTRUCTION for the majority pathway class** (from code + counts, not from void E1) | `index.ts:12498` computes a reaching pathway, then **declines to pin satisfier-headed ones** because a `satisfier:<shape>` pseudo-id is not in the template catalogue and pinning it 404s the dispatch — so it "falls through to the ordinary shape-directed selection", i.e. re-derives. The same comment records **63.5% of accepted pathways are satisfier-only** and satisfier ids are ~40% of path steps. Corroborated: of 200 sampled rows, `walk_tier` = satisfier 70, learned_pathway **9**. The pathway is recommended, logged, and discarded |
| 5 | **Law 4: activities are earned by extraction from reached executions, not declared** | Count ribosome extractions vs skips | **HOLDS, and is starved** | Ribosome skipped **942 of ~1698** in 6h, every one "not honestly reached". The mechanism is correct and refuses to mint from unreached work; it has nothing to eat. **0 new templates**, mutation rate 0/h |
| 6 | **The reach gate is honest — it grades the goal, not the exit status** | Find a landed commit whose goal booked `reached=false`; check whether the commit did anything | **HOLDS** | `5c08dd6` landed for the fossil-rank gap; all 7 of that gap's verdicts were `reached=false`. The commit adds **only two import lines**, 3 insertions, no behaviour change; gap still open at `failed_attempts=6`. `reached=false` was correct |
| 7 | **Law 7: gap closure is durable repair, not bookkeeping** | Closure rate excluding TTL expiry | **FALSIFIED (prior measurement, 2026-08-28)** | 1332 gaps / 914 closed: **631 (69%) `expired_not_redetected`**, only **17 (1.9%) repair-verified**. Excluding expiry is mandatory or the metric is an artifact |
| 8 | **The lift-validation harness validates the architecture** (`CLAUDE.md` names it as the validation path) | Run it; does it produce a verdict over its scenario set? | **FALSIFIED, now instrumented** | It **fataled on the first scenario** and had produced nothing since 2026-08-19. After `f2b6ba40`: **7 of 663 scenarios scoreable — 1% coverage**. 656 are auto-generated from gaps and lack `expected_emergence` |
| 9 | **Emergence: repeated scenarios reuse rather than re-derive** | Harness `emergence_class` tally | **WEAK PASS, n=7 (1% coverage)** | reuse=6, new=1, gap=0. Consistent with the ceiling claim but **not generalisable** — all 7 are the hand-authored originals |
| 10 | **The category seal's escape functions** (`hopeless()` + human escalation) | Answer an escalation; does the gap re-enter selection? | **HOLDS as of 2026-08-29** | Was broken for the system's entire history — 1755 escalations against a read-back that could never see an answer. Repaired `fe52076`/`9cb83d0`; verified `hopeless_excluded` 79 → 78, exactly one |

---

## What the matrix says

**Rows 1 and 2 are the architecture's headline claims, and both are falsified by direct
measurement.** Not marginally: 0% against a parity claim, 10% against 90%.

**Rows 3b and 4 were worse than falsified — untestable.** Reuse ATTRIBUTION, the mechanism by
which the architecture claims learning compounds, was computed and then discarded to a log line.
Repaired 2026-08-29 (`4e0d27a`); the first natural event is the confirmation.

*Correction:* row 3 originally claimed reuse was wholly untestable. That was overstated —
`walk_tier` has been persisted and readable since migration 181, so reuse **occurrence** was
always measurable; only **attribution** was not. Split into 3a/3b. Recorded rather than edited
away, because a matrix that quietly revises its own verdicts is not a falsification instrument.

**Rows 5, 6 and 10 are the encouraging half, and they matter.** The honest mechanisms are
honest: the ribosome refuses to extract from unreached work, the reach gate refuses to credit
an inert landing, the seal's escape now functions. Nothing here is faking success. The system
is failing loudly rather than reading green — which is what makes rows 1–4 trustworthy.

**Row 8 is the meta-finding.** The instrument the architecture names as its validation path was
inoperable, and could not report that it was inoperable. Its coverage is 1%.

**Row 4 is now the sharpest result in the matrix, and it did not come from an experiment.** It
came from reading why E1's near-miss failed to borrow: the system successfully *recommends* a
pathway and then declines to *use* it whenever the pathway's head is a `satisfier:` pseudo-id,
because pinning one 404s the dispatch. That is 63.5% of accepted pathways. The architecture's
compounding mechanism is not weakly effective for the dominant class — it is bypassed.

Note the shape of that finding: reuse was made *storable* (rows 3a/3b) and the very first
attempt to use the instrument revealed that the thing being measured largely does not happen.
That is the instrument working.

**A trap worth recording:** the obvious "fix" — passing the recommended pathway as lineage at
`recordGoalPath` — would be wrong and would manufacture the result. The function's own doc
comment states law 12: "Only ever pass a parent when a pathway step was genuinely used.
Recording the pathway the walk was OFFERED rather than the one it took would manufacture exactly
the correlation that makes reuse look effective." The current `null` is correct. The repair
belongs at the pinning site, not the recording site.

---

## Rows not yet run

- **Ceiling experiment (rows 3a/3b/4).** Dispatch an identical goal twice, then a near-miss variant.
  Criterion, declared now: the second dispatch must show a `walkTier` other than
  `fresh_derivation` **and** a lower cost. Blocked until reuse persists.
- **Law-7 recheck (row 7).** Re-measure closure excluding `expired_not_redetected`, over the
  gaps closed since 2026-08-28.
- **Harness coverage (row 8/9).** Rows 9's verdict is only as good as its 1% denominator.

## Standing caution

Every falsified row files a gap and goes through the normal loop — file, give the system a
chance, dispatch, hand-edit last. This matrix is the measurement layer. It is not a licence to
absorb the repairs by hand, which is law 6, and it is what keeps "full potential" from becoming
an unbounded manual to-do list.

---

## Experiment E1 — reuse attribution (rows 3b / 4), criteria declared 2026-08-29 03:05Z

**Criteria are recorded here BEFORE the dispatch.** Any criterion adjusted after seeing the
result invalidates the run and must be re-run under the amended criterion.

**Design.** `reused_from_*` fires on CROSS-GOAL borrowing — `recordGoalPath`'s `parent` is a
*donor* pathway accepted at cover ≥ 0.5, not the same goal's own history. So an identical-goal
repeat tests row 3a (occurrence, via `walk_tier`) but cannot test 3b. Testing attribution
requires a SIMILAR goal, which is the row-4 "middle" claim.

1. Dispatch **A**, a goal known to reach (`produce a system_load_report`, 5/5 in the 24h window).
2. Wait for A to complete. Serial by construction: identical/near text coalesces, so a
   concurrent B could return A's own dispatch rather than walking.
3. Dispatch **B**, a near-miss variant of A.
4. Read both rows from `/v2/goal-paths`.

**PASS (row 3b, attribution)** — B's row carries `reused_from_goal_hash` equal to A's
`goal_hash`.
**PASS (row 4, middle)** — additionally, B's `walk_tier` ≠ `fresh_derivation`.

**FALSIFIED (row 4)** — B reaches but with `walk_tier = fresh_derivation` and no lineage: the
system re-derived a pathway it already had. Prior evidence is adverse — the autonomy boundary
"rebinds on wording" (operator memory, 2026-08-12) — so this outcome is expected as likely.

**INCONCLUSIVE, not a pass** — B does not reach, or no row appears. A non-reaching B says
nothing about reuse; re-run with a different A/B pair.

**Known confounder, declared in advance.** Reuse fires ~8/day naturally, so a lineage row
appearing during the window is not necessarily attributable to this experiment. Attribution is
by A's specific `goal_hash`, not by "a lineage row appeared."

### E1 result — INVALID BY ITS OWN RULE (criterion under-specified). Run 2026-08-29 03:13Z

**A** = `produce a system_load_report` → `goal_hash 0441a5bee95b682a`, `walk_tier satisfier`,
25 executions, success_rate 1.
**B** = `produce a system_load_report for the current substrate host` → `goal_hash
886234c90d28c9c6`, reached (success_rate 1), two rows: `walk_tier satisfier` and
`walk_tier universal_tool_fallback`. **`reused_from_goal_hash: null`** on both. Zero
`REUSE LINEAGE (transmitted)` lines in the window.

**Against the declared arms:**

| arm | required | observed | match |
|---|---|---|---|
| PASS 3b | lineage == A's hash | null | no |
| PASS 4 | 3b **and** tier ≠ fresh_derivation | 3b failed | no |
| FALSIFIED 4 | reached **and** tier == `fresh_derivation` **and** no lineage | reached, no lineage, but tier was `satisfier` / `universal_tool_fallback` | **no** |
| INCONCLUSIVE | did not reach, or no row | reached, rows present | no |

**The criterion set was not exhaustive.** I assumed the only alternative to reuse was
`fresh_derivation`; the walk in fact reached via the *satisfier* and *tool-fallback* tiers,
which are non-reuse routes my arms never enumerated. Per this document's own method rule, a
criterion amended after seeing the result invalidates the run — so **E1 is void and is re-run
below as E2**, rather than being reclassified into an arm it does not fit.

**Substantively, and stated separately from the verdict:** B reached *without* borrowing A's
pathway. That is consistent with the middle claim being false for this pair, but E1 cannot
carry that conclusion, because a criterion written after the fact is exactly the Goodhart
pattern this matrix exists to avoid.

**New hypothesis raised by the result, to be tested before E2 is meaningful.** Both A and B
reached via `satisfier`. If the satisfier route short-circuits *before* pathway matching is
attempted, then reuse can never fire for satisfier-reachable goals — and 70 of 200 sampled rows
are `satisfier`. That would be a structural explanation for reuse firing only ~8/day, and it
would make E2 with a satisfier-reachable pair untestable by construction. **Test the
pre-emption question first; choose the E2 pair accordingly.**

---

## Experiment E2 — the ceiling claim (row 3a). Criteria declared 2026-08-29 03:25Z, before dispatch

**What E1 got wrong, and what changed.** E1's arms were not exhaustive: the FALSIFIED arm
required `walk_tier == fresh_derivation`, assuming that was the only alternative to reuse. The
walk in fact reached via `satisfier`. **E2's arms partition `walk_tier`'s complete enum**
(`tierOf`, `index.ts:5578`: `learned_pathway | satisfier | universal_tool_fallback |
feature_compose | fresh_derivation`), so every possible outcome lands in exactly one arm.

**Subject, chosen from data rather than invented.** Row 4 established that satisfier-headed
pathways are recommended and then discarded, so a satisfier-headed subject cannot test the
ceiling — it is falsified by construction before the dispatch. Of 400 sampled rows, **335 (84%)
are satisfier-headed, 13 universal-tool-fallback, only 52 template-headed.** The subject is one
of the 52:

> `run the coverage-tick activity to measure substrate topology coverage and emit a coverageReport`
> `goal_hash 227c8f97d4d50fde` · `path_signature 7793c55c14d7e0c5`
> `path_activities: ["development-vessel:coverage-tick"]` — a **real template head**
> 2 executions, success_rate **1.0**, avg_duration **48903 ms**, avg_cost **0**

A proven, non-satisfier pathway already exists for this exact goal text. This is the ceiling
claim's most favourable case: if reuse does not fire here, it does not fire.

**Procedure.** Dispatch the goal verbatim, once. Identical text coalesces, so serial by
construction. Then re-read the row.

**Arms — exhaustive, one outcome each:**

| arm | condition | reading |
|---|---|---|
| **PASS** | new row `walk_tier == learned_pathway` | ceiling holds: the repeat ran over the learned pathway |
| **FALSIFIED-a** | `walk_tier == fresh_derivation` | re-derived from scratch despite a proven pathway |
| **FALSIFIED-b** | `walk_tier == satisfier` | bypassed its own template pathway for the satisfier plane |
| **FALSIFIED-c** | `walk_tier == universal_tool_fallback` | fell to the ReAct floor despite a proven pathway |
| **FALSIFIED-d** | `walk_tier == feature_compose` | routed to compose; not a reuse of this pathway |
| **INCONCLUSIVE** | no new execution recorded (`total_executions` unchanged), or no reach | says nothing about reuse; re-run |

**Secondary observations, recorded but NOT verdict-bearing** (they have no pre-declared
threshold, so they cannot be used to argue a result): `total_executions` increments from 2;
duration versus the 48903 ms baseline; whether `reused_from_goal_hash` is populated — this is a
same-goal repeat, and lineage fires on CROSS-goal borrowing, so its absence here is expected and
is **not** evidence against row 3b.

### E2 result — **FALSIFIED-b**. Run 2026-08-29 04:53Z

Dispatch `310defa1` reached (`reached: true`), via `selectedTemplateId: satisfier:coverage_tick`,
`executionId walk-satisfier-1-1787979187730`.

Store rows for the identical goal text afterwards:

| path_signature | path_activities | walk_tier | execs | updated_at |
|---|---|---|---|---|
| `7793c55c14d7e0c5` | `["development-vessel:coverage-tick"]` | *(none)* | **2** | **2026-06-30** |
| `c4d0dc60cbff6b95` | `["satisfier:coverage_tick"]` | **satisfier** | 1 | 2026-08-29 04:53:28 |
| `7dae833af19b717d` | `["universal-tool-fallback"]` | universal_tool_fallback | 1 | 2026-08-29 04:53:48 |

**The proven pathway was not touched.** Row `7793c55c14d7e0c5` — the real template head, 2
executions, success_rate 1.0 — still reads 2 executions and is still stamped **2026-06-30**, two
months stale. The repeat did not run over it. It minted two new paths instead.

**Arm: FALSIFIED-b** (`walk_tier == satisfier` — bypassed its own template pathway for the
satisfier plane). Unambiguous, and the arm was declared before dispatch.

**This was the ceiling claim's most favourable case.** Identical goal text, a pathway that had
already succeeded twice, a real template head — the one class of the 52/400 where reuse is even
possible. It did not fire.

**Row 3a verdict: FALSIFIED.** Together with row 4 (falsified by construction for the 84%
satisfier-headed majority), the architecture's compounding mechanism does not engage: not for
the dominant pathway class, and not for a proven pathway on an exact-match repeat.

**Method note against myself.** The E2 watcher waited for `total_executions > 2` on a row for
this goal, which could never fire — the satisfier route created a NEW row at 1 rather than
incrementing the existing one. The verdict came from reading the store directly. The watcher
condition assumed reuse in order to detect its absence, which is the same class of error as
E1's non-exhaustive arms: an instrument that can only observe the outcome it expects.
