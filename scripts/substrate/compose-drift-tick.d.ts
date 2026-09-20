/**
 * compose-drift-tick.ts — a detector for the COMPOSER-DEGRADES-ITSELF class.
 *
 * The substrate modifies the component that performs all modification, and
 * nothing executes the result. Measured 2026-09-09: `feature-compose.ts` took 41
 * autonomous commits across 09-06/07, and its anchor-failure rate went 3.3% (on
 * 09-04, a zero-commit day that serves as the natural control) to 34.4% on 09-08.
 * One confirmed cause was `f0cfb91`, a ONE-LINE inverted boolean that disabled
 * the blind-edit anchor repair for two days and passed typecheck, the semantic
 * gate and mitosis cutover on the way in. `bac7d00` repaired it.
 *
 * NOTHING REPORTED ANY OF THAT. The compose pipeline logs its own blind spot on
 * every run against an untested file: "every gate below this point READS the
 * diff; only a test RUNS it. A FAVORABLE verdict here means the change was
 * reviewed, never executed." A regression in the authoring lane therefore
 * accumulates in exactly the capability needed to detect and repair it, and the
 * only reason the two-day outage above was ever found was an operator counting
 * rows by hand.
 *
 * WHY THIS RUNS FROM SYSTEMD AND NOT FROM THE POOL. Same circularity CLAUDE.md
 * names when it exempts the liveness watchdogs from the script-retention rule:
 * "a check cannot be scheduled by the mechanism it exists to recover." A detector
 * for the authoring lane cannot be authored and scheduled by the authoring lane.
 * This is the bootstrap tier, and it is the stated exception rather than a
 * silent carve-out. Sibling precedent: validator-liveness-tick.ts.
 *
 * IT MEASURES, IT DOES NOT SET POLICY. The expected failure rate of the composer
 * is derived from THE COMPOSER'S OWN RECENT HISTORY — the median of its trailing
 * complete days — not from a threshold chosen here. Degradation is asserted only
 * when the most recent complete day exceeds that self-derived baseline by both a
 * relative and an absolute margin AND survives a two-proportion z-test, so a
 * quiet day or ordinary variance cannot trip it. Choosing an acceptable failure
 * rate is an operator decision; observing that the composer stopped performing
 * at the level it was already performing at is not.
 *
 * THE INSTRUMENT IS NAMED, BECAUSE THE OBVIOUS VARIANT DISAGREES. The population
 * is `feature_compose` executions; the numerator is `apply_failed AND
 * ops_applied == 0` — a HARD anchor failure where nothing was applied. Dropping
 * the `ops_applied` clause reports 43.3% for 09-08 where this instrument reports
 * 34.4%: two defensible metrics, very different numbers. Six operator metrics
 * for this same question were discarded for measuring the wrong population, so
 * the predicate is stated in the gap it emits and must stay stated.
 *
 * DAY-SCALE WINDOWS ONLY. A 2-hour slice of this series read 24.6% while the
 * containing 184-execution window read 16.8%, and a false "the repair evaporated"
 * conclusion was built on that slice before being retracted. Sub-day windows are
 * noise on this metric.
 *
 * META-GUARD (a detector must be proven to COMPLETE, not merely to exist): if the
 * composer ran at volume but no day had enough samples to evaluate, this emits a
 * gap about ITSELF, because a detector that silently checks nothing is the exact
 * class it exists to catch.
 *
 * Strictly read-only except substrateGap emission.
 */
export {};
//# sourceMappingURL=compose-drift-tick.d.ts.map