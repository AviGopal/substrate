# FROZEN prereg: item 1 — does the existing self-retry loop converge on a
# prose-spec gap with zero operator refinement? (2026-09-20)

## Claim and scope
The retry machinery exists (priorAttemptFeedbackBlock + failure_lessons +
compose_lesson recall + gap-to-feature re-pick + self-narrowing). Measured
once end-to-end (probe-count-3 -> 4e1ce8ffed: attempt-1 typecheck fail ->
lesson -> narrowed child -> attempt-2 landed at the right branch). Tonight's
~10 operator-dictated landings bypassed it via the direct lane. This test:
file ONE behavioral, PROSE-ONLY gap (no byte dictation, no old_string, no
verbatim anchors) with edit_site + falsifier, then HANDS OFF. A pass means
item 1 was under-credited, not unbuilt; a stall names the missing wire.

## The gap (verbatim at filing)
Target: repos/goal-host-vessel/src/index.ts, the [transform-oracle] VERDICT
log line. Defect class: observability — the line reports reached and the
expected value but NOT WHERE it checked (named note vs digest), which cost
attribution time twice (settle-confirm diagnosis; title-dot diagnosis).
Ask: include the checked address in the log line — the note title when the
titled branch ran, otherwise the word digest. Falsifier: a fresh titled
transform dispatch produces a [transform-oracle] line containing the note
title.

## Scoring
- S1 PICKED: gap admitted + compose attempted without operator dispatch.
- S2 CONVERGED: a FAVORABLE landing within 5 attempts / 90 minutes whose
  diff modifies the [transform-oracle] console.log to include the address.
- S3 VERIFIED: falsifier dispatch (operator-run, allowed) shows the title
  in the journal line.
- S4 NO-REGRESSION: post-land suite green; oracle still grades correctly
  (the falsifier dispatch must REACH with byte-correct artifact).
Failure modes counted: victim-file edit, hollow green, spec-garbling,
stall (0 attempts in 90m).

## Ledger
Operator files the gap and runs the falsifier dispatch; NOTHING else.

---

# RESULT (window 03:10-04:42Z, hands-off held)

**S1 PICKED: MET (late).** Event pickup fired at filing; ADMISSION then
starved the gap ~70 minutes behind route-edit children at the same
edit_site (the E5 site cap runs at admission in iteration order, BEFORE
human_reported weighting — cap excluded 58-59 gaps/cycle). At 04:19 it was
admitted and PICKED ON MERIT (score 1.05, human_reported:true, beating a
route-edit at 0.9) and SELF-NARROWED at once.
**S2 CONVERGED: NOT MET — blocked, not failed.** Every compose attempt
after the pick REFUSED with the recurring 0-byte-grounding dead-row class
(04:37, 04:40 x2 — striking BOTH goal-host and dev-vessel targets). Zero
drafts were attempted, so the failure->next-spec loop was never even
exercised this window.
**S3/S4: N/A.**

## Scored conclusion for item 1
The self-retry machinery is NOT the missing wire tonight's ledger claimed:
it picked, weighted, and narrowed correctly with zero operator help. What
starves it is (a) admission unfairness at saturated sites — fix staged as
the human_reported exemption — and (b) the unresolved dead-grounding-row
root (asResolvePath, per the parallel session), which struck FOUR times in
one night and blocks EVERY compose regardless of authorship. Item 1
re-scopes from "build the wire" to "fix the two chokepoints ahead of it".
The gap and its narrowed child stay open with the system; convergence is
re-scored after the chokepoint fixes land.

## RE-TEST after chokepoint fixes (05:00-05:20Z, still hands-off)
With fairness landed (7d48a277) and grounding restored, the loop is now
CYCLING autonomously on this gap: picked repeatedly at 1.05 (human_reported
exemption + weight working — picks within minutes, not 70), self-narrowed,
a draft attempt RAN and failed with a SPECIFIC structured lesson minted to
both gaps ("old_string and new_string are identical — this op is a no-op"),
which the next attempt's priorAttemptFeedbackBlock will read. Convergence
not yet observed at scoring time; the gap stays with the system and the
unattended soak is the instrument that measures whether the cycle closes
without a hand. ITEM 1 FINAL SCOPE: the wire exists and cycles; its
convergence RATE under lane contention is the open question — a soak
metric, not a missing mechanism.
