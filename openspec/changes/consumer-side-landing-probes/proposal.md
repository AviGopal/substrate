# Consumer-side landing probes

## Why

Every verdict on a landing today grades it against the check that motivated it: the gap's own predicate, its test,
its literal. On 2026-09-28 three autonomous landings passed that check and were regressions — a stale test satisfied
by turning off discovery-first resolution in production (`9cfdea4`), a timeout lowered against its documented
rationale (`af2c737`), a constant read only by a log line (`a198907`) — and the sweep recorded all three
`landed_verified`. The year's break census (`validation/reports/self-development-program-2026-09-25/WHY-THINGS-KEEP-BREAKING-2026-09-28.md`)
puts ~22% of breaks in this "wrong but still flowing" class, found by an operator in every case.

The cutover already calls `runBehavioralVerification` on every landing, but it has never had an input (0 of ~6,100
gaps carry a `verification_spec`), and copying the gap's own check into it would add nothing: the sweep already runs
that check after restart, and the check is what these landings gamed. What is missing is a check of the **production
behaviour around** the change.

## What changes

- **Probe set from traces (reuse, not mint).** Before a cutover, select the edited vessel's shapes that recent
  successful executions exercised, with the exact input pointers those executions used (the trace store already holds
  them). A probe is `{shape, pointer, baseline: {success, shape, non_empty_fields, numeric_signs}}`.
- **Replay after restart.** Once the edited vessel restarts onto the landing (the same restart gate 8.4a uses),
  replay each probe and diff structurally: a probe that succeeded with non-empty output before and now errors, returns
  a different shape, or empties a field that was populated is a consumer regression.
- **Verdict.** A consumer regression is recorded exactly like a falsified landing: `regressed_by` (source
  `consumer_probe`), the `#2 regressed` settlement, a posterior miss, an attempt_consequence lesson naming the probe.
  It feeds the existing hold (no re-pick until reverted).
- **Joint.** The probe set is registered as a `jointBinding` so its own liveness is watched (a probe runner that
  checks nothing is itself a gap).

## Out of scope (v1)

Value invariants on arbitrary joints; probes for vessels with no recent successful traces (recorded as "unprobed"
rather than passed); automatic revert.

## Falsifier (pre-registered)

Replayed against tonight's three false-verified landings in a scratch runtime: `9cfdea4` must show the embedding
lookup probe going from non-null to null; `af2c737` must show concept-db's advertised resolve contract changing;
`a198907` is expected to show **no** consumer delta (it is hollow, not harmful) — the probe must not invent a
regression there. And on a known-good directed landing tonight (`acc184b`) the probe must report no delta.
