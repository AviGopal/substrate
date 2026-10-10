# L12 intervention record: §7 step 1 vertical-slice re-run, as a RECORDED NEGATIVE (planned; window opens ≥ 2026-10-13T17:20Z)

Authority: user ruling 2026-10-10, "Let's follow the recommendation. We want the system to be self-sustaining as soon as
possible." (relayed by qa). Run per the qa-approved pre-registration (PREREG sha256 bafcbe792ecd708a11444a0c24d6a62e7338f897812b5b03d80b1b4e0ee8928b,
kept with the operator's slice artifacts).

## Window (fills PREREG §1, which read "qa chooses")
- Opens no earlier than 2026-10-13T17:20Z (after the OP-1 +72 h read) and closes before 2026-10-17T17:19Z (B arming).
- No other change lands on node 1 inside the window (§6.1.6). Slice dispatch ids are excluded from OP-1's 7-day read.
- Dispatching ≤ 6 h, then a 24 h horizon for (b)'s credit observation, the detector gap's settlement and the A1 self-detection check.

## What it is, and is not
- A RECORDED NEGATIVE. (b), the compose chain D ← A, B, is pre-registered to fail at publish/offer: activity-api's composition
  writer has no caller on origin/dev. The run shows the break by effect, behind B's positive control.
- It also tests law 6: whether the system detects and files its own first break (A1: detected+filed / detected-not-filed /
  not detected).
- The sealed set 0ed9e4dd is run ONLY as a development-exposed stratum. No headline reach claim. A scored re-run needs a newly
  sealed batch.
- Operator-run dispatches; excluded from autonomous-achievement counts and from the lane denominator. Operator hands in the
  window are checked by the pre-registered operator-commit diff (snapshot + time window) and the §5 channels. Holds, record
  edits and policy edits are declared here; none are planned.

## Outcome
To be appended at the horizon: per-item PASS / FAIL / NOT EVALUABLE with the falsifier that fired, the first demonstrated
break, and the A1 outcome.
