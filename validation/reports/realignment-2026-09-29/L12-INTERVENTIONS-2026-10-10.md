# L12 intervention records: credit-harm operator bootstrap (2026-10-10, node 1 substrate-live)

Authority: user ruling 2026-10-10 "follow the recommendations"; HARM exception, not slice-chosen order (REALIGNMENT §7 step 1 is still NOT DONE as of 10-03).
Placement: §7 step 5 (verdict → credit) and step 8. All three are operator-authored (Operator-Authored: ac8b0aad) and excluded from autonomous-achievement counts and from the lane denominator.
Converge times are node-1 pull-sync `[mirror-to-live]` lines on node 1.

| # | series | repo / range | converged on node 1 (UTC) | what changes in behaviour |
|---|---|---|---|---|
| I-1 | OP-1 | goal-host-vessel bba1e55..fa73254 (10 commits) | 2026-10-10T17:19:35Z (fa73254; quiesce drained 170 s, 0 in flight) | citation oracle both ways, abstain = ungraded; β charged only to the judged artifact's producer; one chain carrier; persist bounded by satisfierFlushDeadlineMs; state_signature dropped from recommend/discover; goal_hash on the PROVEN-BAD tap |
| I-2 | OP-3 | activity-api 62150c4..66689bb (5 commits) | 2026-10-10T17:40:50Z (66689bb) | mostly instrumentation: counted unsigned drop, honest post-write outcome log, α/β direction counters |
| I-3 | OP-2 | development-vessel d69fd6ee..a27861a (5 commits) | 2026-10-10T18:03:57Z (a27861a; in-flight drained 20 s) | gap-lane decision credit by decision_id; counted positional_single/unattributed; highConfMiss reader; in-flight re-pick skip |

## §6.1.6 deviation (recorded, qa audit 10-10)
- The three landed within 44 min on one node, which violates "one change per window". The cause was operator sequencing (coordinator + qa).
- Consequence: no single-intervention window exists for I-1..I-3 on node 1.
- Attribution rules for the OP-1 windows (applied by the operator instrument measure-op1) (+24 h, +72 h, +7 d from 17:19:35Z):
  - ATTRIBUTABLE to I-1 (direct effects in goal-host's own logs):
    - satisfier-flush persistence ("NOT persisted within", MATCHED NO ROW, lost-reached-verdict filings);
    - citation-oracle verdict classes (ABSTAINED by family, uncited / unverified counts);
    - the culpability split of last-pick β lines;
    - state_signature REJECTED (the d-drop).
  - CONFOUNDED by I-3 (anything downstream of gap-to-feature or gap-lane dispatch mix):
    - gap-lane dispatch counts;
    - the satisfier last-pick β DENOMINATOR, totals and rates;
    - substrateGap_write / memoryNote_write β volume;
    - reach rate by family where gap-lane dispatches contribute.
  - I-2 changes log line names, not behaviour. Count APPLIED|ENQUEUED|PARTIAL together; satisfier-VPM write totals are comparable only on that union.
- Going forward: ONE change per window per node. B arming (≥ 2026-10-17T17:19Z), OP-4 and the 1d build each get their own window.
