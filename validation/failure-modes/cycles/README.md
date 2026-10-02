# cycles/ — Progression-Driver Output

Each `cycle-N.json` is the lift-validation receipt for one bootstrap pass. The
driver script writes them; humans don't author them directly.

## The Loop

```
cycle 0 (baseline):
  harness run → N gaps observed → 0 proposals → manual debt = 0 (no work done yet)

cycle 1:
  human dispatches subagents to draft proposals for gap subset
  proposals appear in proposals/
  driver computes: gap_count, proposals_authored, manual_intervention_debt
  → manual debt = (number of subagent dispatches + human-authored + operator-blocked)

cycle 2+:
  ideally the SYSTEM begins authoring proposals via make-activity meta-activity
  proposals' `authored_by` field shifts from "subagent" → "make_activity_autonomous"
  manual_intervention_debt should strictly decrease
  baseline_gap_count should strictly decrease

LIFT achieved when:
  - 3 consecutive cycles with manual_intervention_debt = 0
  - baseline_gap_count strictly decreasing across those 3 cycles
  - i.e., the system is closing gaps without any human dispatch
```

## Reading a cycle file

Key fields:

- `manual_intervention_debt` — the headline KPI. Counts subagent dispatches +
  human-authored templates + operator-blocked registrations.
- `proposals_by_author` — distribution shows where work is coming from.
  `make_activity_autonomous` is the lift signal.
- `lift_kpi.consecutive_zero_debt_cycles` — count toward the 3-cycle threshold.
- `remaining_gaps` — scenarios still without any proposal; the next cycle's
  candidate work.
- `notes` — `LIFT CANDIDATE` appears when both KPIs satisfy.

## Convention

Cycle numbering is monotonic. The baseline cycle that just measures and does
no work is cycle 0. The first work-doing cycle is cycle 1.
