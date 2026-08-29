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
| 4 | **Middle: a similar task reuses the pathway and walks only the difference** | Dispatch a near-miss variant; must reuse the body, walk only entry/exit | **NOT YET RUN** — blocked on row 3 | Cannot be measured while reuse is unstorable. Prior evidence is adverse: the autonomy boundary "rebinds on wording" (operator memory, 2026-08-12) |
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

The single highest-leverage repair is **row 3**: make reuse storable. Until then the ceiling and
middle claims cannot be tested, which means the architecture's central thesis — that learning
compounds through pathway reuse — is not currently falsifiable at all.

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
