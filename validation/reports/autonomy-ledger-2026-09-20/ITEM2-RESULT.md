# Item 2 — self-originated commitments: CLOSED with its exact closure test

Landed (both through the lane, gate-verified):
- 707dd248 (development-vessel): trend checker generalized from ONE hardcoded
  impulse to EVERY expectation-trend:* note, each carrying its own family,
  bar, probe count, cadence; per-family probe generators for all seven
  transform families; per-family idempotent violation gaps.
- 0fbfcaac (goal-host): SELF-MINT — on the first verified reach of a
  transform family with no standing commitment, the oracle's success path
  writes expectation-trend:<family> {origin: "self-minted", bar 2/3,
  cadence 1440m, minted_because}.

## The closure demonstration (frozen test: "a new goal class arrives and its
## expectation impulse appears with no operator hand")
- 03:44:33 operator dispatched ONE ordinary uppercase goal (the only hand).
- 03:44:33 goal-host SELF-MINTED expectation-trend:uppercase (journal:
  "SELF-MINTED standing trend commitment ... first verified reach of family
  uppercase"; note body origin:"self-minted").
- 03:55:48 the checker ADOPTED the self-stated commitment on its own tick,
  generated three fresh uppercase probes, dispatched them, byte-verified
  in-process, and scored r=2/3 against the self-set bar: "check complete
  r=2/3 bar=2 violated=false". History persisted in the impulse.
The system now originates promises from observed success and keeps them.

## Bonus observations
- The checker's FIRST generalized run (03:23) honestly scored the product
  family 0/3 during goal-host restart churn and FILED ITS OWN violation gap
  — the violation path exercised itself without a probe.
- A gap critiquing the checker's own scoring semantics
  (trend-expectation-scores-a-failed-dispatch-as-a-reach-miss, class2) is
  being worked by the system as this is written — the mechanism is already
  inside its own improvement loop.
