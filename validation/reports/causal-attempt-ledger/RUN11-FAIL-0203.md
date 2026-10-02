# Graded acceptance run 11 — 2026-09-26T02:03:14Z

## R  commit=``
- [ ] R landed
## restore  commit=`0aa6174`
restore settled: held
## C  commit=`c8f20b5`

## Stopped at ~02:50Z (R never landed); diagnosis
- Run 10 (00:50, passed 10/10): C's dispatch 918cbd15 (try 2) landed its edit, and the grader moved on. But the dispatch kept
  walking, and its post-walk EDIT-INTENT route started a SECOND compose (a second attempt registered 02:12:19). That compose landed d3cd630
  at 02:13:48 (canary runs 1→2), inside run 11's window: gap #54 double routing, which 4dec1bc's escalation guard doesn't cover
  (a second compose route, not an escalation).
- Run 11's R dispatch (02:03) walked 13 steps, then routed to feature_compose, which the semantic gate rolled back as UNFAVORABLE.
  EDIT-INTENT ESCALATION SUPPRESSED; the harness doesn't retry that outcome, so R never landed and the run can't pass.
- Fixes before the next streak: (1) harness: a run opens only after goal-host reports in_flight == 0 (so no earlier fixture dispatch is
  still walking), and a semantic-gate UNFAVORABLE on a fixture is retried; (2) substrate: the post-walk EDIT-INTENT route must check
  whether this dispatch's edit already landed (the same landed-and-latest check as 4dec1bc) before starting another compose.
