# FROZEN pre-registration: the unattended soak (start 2026-09-20 ~05:4xZ)

## Claim and scope
48-72h of zero operator intervention on the warm hub measures which
responsibilities the system carries alone. Scored per-mechanism against the
predictions below; the headline metric is USEFUL WORK PER ZERO OPERATOR
ACTIONS, plus the gap triple (close rate, latency, durability) over the
window. "Seed nothing" holds: no injected faults, no rescue, no dispatches.

## Independent evidence source
A HOST-SIDE recorder (outside the container, no system self-report) appends
an hourly snapshot to soak-log.tsv: gap counts by status/source, goal-host
+ dev-vessel unit restart counts, expectation-scan heartbeat age, trend-note
scores, conditioned-view row count, cts row count, latest vessel commits,
grounding-refusal count, transform-oracle verdict counts. Journals persist
for post-hoc audit. The recorder only READS.

## Predictions (what we EXPECT it to do — falsifiable, per mechanism)
P1  Observation loop: heartbeat stays <10min old for >=95% of snapshots;
    healthy ticks file nothing (restraint).
P2  Trend commitments: the product checker runs ~6/day, uppercase ~1/day;
    scores >=2/3 in >=70% of checks; any violation gap it files is CLOSED
    by a later passing check (self-honesty round-trip).
P3  Self-minting: IF autonomous traffic reaches a transform family with no
    standing commitment, its expectation-trend:<family> impulse appears
    unaided. (Conditional — autonomous traffic may not produce one.)
P4  Item-1 convergence: the verdict-line gap (or its narrowed child) LANDS
    a gate-verified fix with the address in the log line within the window
    WITHOUT operator help. Prior: 40% (lane contention + dead-row strikes).
    A landing here is the first fully unassisted prose-gap closure.
P5  Dead-row class: 2-6 more grounding-refusal bursts; sibling-row cases
    self-heal via eviction (logged); lone-row cases persist until a
    restart the system itself performs, or stall composes (expected: stall
    — the asResolvePath root is unfixed; this measures the standing cost).
P6  Priors: conditioned-view rows grow >709; >=3 cts arms show
    context-bucketed alpha growth attributable to reached work.
P7  Honesty: ZERO transform-family false accepts (byte-checkable post-hoc
    against goal texts in traces).
P8  Churn: route-edit/moot-compose picks continue consuming most lane
    capacity (the measured cost that motivates the next fairness round).
P9  Fencing: if the stale-writer race recurs on an expectation-tracked
    artifact, the observation loop detects and restores it unaided (the
    cycle already did this once).
P10 Stability: no vessel enters a crash-loop >30min undetected; if one
    does, the watchdog/heartbeat evidence shows WHEN visibility failed.

## Stopping rules and safety
Ends at operator's return (>=48h). Early abort ONLY for: host resource
exhaustion, runaway spend (OpenRouter balance drop >$50), or a crash-loop
of identity/discovery (the protected fixed points). Any abort is logged in
the ledger with its trigger.

## Operator intervention ledger
Starting the recorder is the last operator action. Anything after voids the
affected predictions and is recorded here.
