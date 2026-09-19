# Pre-registration: item 1 — adjudication pathway (frozen before dispatch)

Change under test: an adjudication pass in development-vessel's
admitActionableGaps (gap-to-feature.ts), in the ungroundable branch:
for disagreement-class gaps naming a transform family, recompute the truth
with an executable in-process method, attribute producer-vs-verifier by
comparing the verifier's stated expectation to the recomputation, write
edit_site + adjudication metadata back to the gap, admit it the same tick.
Fail-open everywhere (parse/compute failure -> defer as before).

Falsifier (the probe re-run, fresh seed, run AFTER the change lands):
- Seed the SAME class of fault (verifier lettercount off-by-one, new word),
  dispatch a probe goal, file an attribution-neutral disagreement gap with
  the SAME wording shape as the failed probe.
- E1' the admission log shows [gap-adjudicate] with the recomputed truth.
- E2' the gap's metadata gains adjudication.wrong_mechanism="verifier"
  WITHOUT any operator localization.
- E3' a compose attempt targets goal-host (admitted this time; landing the
  full repair may take multiple attempts - E3' is met if the lane RECEIVES
  the gap and attempts, since lane-receipt was the measured zero).
- TRANSFER: a second seeded probe in a DIFFERENT family (product) also
  adjudicates correctly (E1'+E2' for that family).
Scored against the original probe's E1-E4 all-NOT-MET baseline.

---

# RESULT (scored against the frozen falsifier)

Change landed: 53c4b4ec (substrate-authored via direct compose, gate-verified,
dev-vessel self-cutover). Probe re-run (fresh seed, word "stone"; first word
"triangulate" was discarded — the floor also miscounted it as 12, so producer
and seeded verifier AGREED wrong and no disagreement manifested; noted as its
own finding: agreeing-wrong mechanisms are invisible to disagreement-triggered
adjudication).

- **E1' MET** — [gap-adjudicate] logged the recomputation within the same
  admission tick as the gap event (18:47:16, same second as pickup).
- **E2' MET** — adjudication metadata written to the gap: recomputed_truth=5,
  verifier_expected=6, wrong_mechanism=verifier, edit_site minted. Zero
  operator localization.
- **E3' MET, then EXCEEDED** — the lane received the gap 6s after
  adjudication and attempted (attempt 1: typecheck fail at the oracle region,
  honest rollback, lesson minted+mirrored). The system then SELF-NARROWED the
  stuck gap into a child and attempt 2 targeted the exact lettercount branch,
  landing 4e1ce8ffed: verifier expectation rewritten, named-note byte-compare
  preserved. End-to-end: fresh dispatch reached with lettercount(stone)=5.
- **TRANSFER MET** — product family (seed 421*17 -> verifier demands 7158):
  adjudicated correctly at 19:03:42 (recomputed 7157, verifier blamed,
  admitted) with no family-specific code. End-to-end after healing: reached
  with product(421*17)=7157.

Baseline vs now: original probe E1-E4 all NOT MET; re-probe E1'/E2'/E3'/
transfer all MET. The investigative role HAS transferred for the
transform-disagreement class.

Honest confounds and residuals:
1. The seeded faults were uncommitted, so any cutover's clean-slate fetch
   also heals the runtime — landing-at-the-right-branch is demonstrated;
   causal-fix-of-committed-code is not (would require committing a fault to
   origin, rejected as pollution).
2. An in-flight compose landed 6630d4b2de for the already-retired product
   gap: a semantic no-op (Math.round on an integer product). Harmless, but
   moot-gap composes land null-effect edits — the hollow_write class knocking.
3. Adjudication triggers only on DISAGREEMENT: the triangulate case (both
   mechanisms wrong, agreeing) sailed through as reached:true. Detecting
   agreeing-wrong requires spontaneous recomputation at verdict time, not
   gap-time adjudication — follow-on wire, unfiled.
