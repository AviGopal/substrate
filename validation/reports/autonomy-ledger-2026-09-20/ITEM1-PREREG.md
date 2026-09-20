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
