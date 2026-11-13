# Credit by what a transition enables: moves and compositions graded along consumption, closed by re-observation

**Vessels:** records-vessel (the fold, the posterior, which templates are offered), walk-vessel (what is offered, how a
root and a move are drawn), local-tools-vessel (the closure move's check), walk-owner-seed (the owner rows that steer
all of it).

**Design contract:** concept_8q0HcehfQLij (the USER's requirement and its rejections). Every section of `design.md`
answers one item of the review checklist recorded beside it.

## Purpose

The system should judge an outcome by what the state transition enables other activities to succeed at. A move, and a
composition of moves, earns credit when something downstream that consumed its output succeeds, and that credit flows
on along the consumption edges. The back half closes the loop. After a change lands, a selectable move re-observes the
conditions that selected the change (the gap's check, run on the landed tree), with the landing's provenance traced to
the gap's cause. Its observation is new information, and it feeds credit back along the same chain. Stability comes
from these loops mixing credit faster than new cells are minted, not from a grader and not from a terminal verdict.

In the USER's words: "the system needs to evaluate outcomes based on what other activities the state transition
enables to succeed. The provenance of the change from the landing evaluated on what caused the gap is the back half;
the activity that produces closure by re-observing the conditions that caused the code change activity composition
sequences to be selected."

## Problem

Measured on the hub's records over 24 h (the database fork's reads; evidence in the contract):

- **Credit by presence, not use.** A grade credits the judged answer's selection and every treated selection in its
  `pool_refs` (records `fold.ts` `grades()`, the `chain`), whether or not that selection's output fed the answer.
- **Refusals are almost the only signal.** 734 refusal debits (`moveFailures`) against 104 standing grades. The
  median chosen mean is 0.167.
- **Closure never pays.** `gapClosures` paid 0 of 5. Three gaps closed with no walk change. Two closed by operator
  test commits after 16 walk commits and no landing. Closure is an outside detector rerun, not an activity the walk
  selects.
- **Hard holds park roots with no end.** 3 of 5 open roots had no move and no wait (agf_kj751u9hu5ry):
  - `refusedOver` holds a produce for good after one schema refusal;
  - the ungraded-duplicate rule holds a produce until an outcome that a gap root can never get.
- **Compositions are gated on a person.** Records `earned()` offers a template only after a person's r 1 on its mint
  root. 93 templates were minted in 24 h, and almost none are ever offered.
- **The root is drawn uniformly** (walk `loop.ts` `choose()`). A root whose moves never help still takes one move in
  N for ever.
- **Growth outpaces mixing.** 808 cells and rising, credit mixing near zero: the unstable side of
  `λ₁(L) ≳ ρ_grow` (`docs/architecture/SUBSTRATE_AS_DYNAMICS.md` §3).

## What changes

1. **Credit along consumption edges.** A transition earns credit from the downstream successes that consumed its
   output, discounted per edge by an owner row, never from presence in a pool. The edges are a produced row's schema
   inputs, the rows it names in `uses` (checked against what it was shown), a call's `from`, a run's template, and
   the recheck's landing hop. A produced row's `input_refs` alone is not an edge: they list every row the producer
   was shown. Credit starts only at a closure or a person's verdict. A move earns nothing by ending.
2. **Holds become debits.** `refusedOver` and the ungraded-duplicate filter are removed. A refusal stays a debit on the
   cell that chose what was asked. A produce superseded while nothing consumed it is a debit on its cell. Every move
   stays selectable.
3. **Decay reaches the root draw.** Each root is drawn from one decayed posterior of its own history (the evidence on
   the selections made for it), not uniformly. The number of options it has now does not enter it. The decay is an
   owner row.
4. **Provenance from git, not rows.** A landing earns closure credit only when the closure move re-derives from git
   that the landed commit is on origin's branch, that the gap's check fails at the branch tip before the land and
   passes at the landed commit (a counterfactual), and that the landed range leaves the check's own files untouched.
5. **The closure move.** `gap_recheck`, served by local-tools by reusing its existing gap check, is selectable once a
   landing ended on a gap root. It runs the gap's own check before and after the land, and writes a `gapObservation`
   row. It does not close the gap (the detector still does) and it is not a verdict. It is a fact the fold reads,
   counted once per landing.
6. **One mechanism for compositions.** A template's run is credited by the same rule. `earned()`'s person-r1 gate is
   replaced by enablement: a template is offered when the run it replays carried enablement credit.
7. **Stability is a row, read where minting is chosen.** Records writes a `stability` row per window: how many cells
   received credit travelling from a closure or a person's verdict, against how many cells and templates were new. A
   new template is produced only while a fresh row that records wrote itself says mixing keeps up. A stale or missing
   row stops minting.

## What does not change

- A person's verdict on an answer still counts, and still closes a request. Lapses of person and owner requests are
  as they are.
- Detectors still open and close gaps. Closing a gap is never a walk move.
- Boundary (1): a change cannot edit the check that verifies it. The install gate stays hard. Person keys still mark
  person rows.

## Rejected (by the contract)

- A grader or judge that closes requests or grades outcomes (goal-host and development-vessel showed why).
- Credit held "provisional until a terminal confirmed success, then settled or voided".
- A template gate that only a person can open.
- Crediting by presence in a pool.
- Lapsing gap-root requests (detector in EXO_ROLES, or a gap-variant outcome): both add terminal r 0 judgments.
- Re-running change_wanted on the landed tree as an ask's back half: it is a model's judgment of the outcome, a grader
  even with the same schema (qa's reading under the contract). An ask's back half is the person's verdict and the
  consumption chain.

## References

- concept_8q0HcehfQLij: the design contract.
- agf_j5zmjwi7much: the requirement.
- agf_kj751u9hu5ry: the parked roots.
- agf_jmgp5bxlgco6: gap test names come from the detector's latest row.
- agf_xgxdr4i155s0: the full-fold cost (this change keeps its rule incremental-ready).
- concept_LvR-iNAvIjwp: per-tick timing on the selection row (agf_4ozotydifpdj), which measures the loop's cost.
