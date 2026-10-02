/**
 * validator-liveness-tick.ts — a detector for the SILENT-VALIDATOR class.
 *
 * A validator that stops running emits silence, and silence is indistinguishable
 * from health. Measured 2026-09-09: of 102 validator-shaped activities that had
 * executed since 08-25, only 12 ran in the last 24h — 90 were dormant, at ages of
 * 7 to 16 days. The dormant set was precisely the wiring-validation layer
 * (advertised-shape-coverage 15d, orphaned-capability 16d, detector-coverage 9d,
 * coverage_tick 12d, substrate_health_tick 12d). Nothing reported it.
 *
 * WHY THIS RUNS FROM SYSTEMD AND NOT FROM THE POOL. Every survivor of that census
 * was systemd-timed or a very-high-frequency tick; every dormant one was a
 * `satisfier:*` or `learned-composition-*`, i.e. Thompson-selected. Cadence
 * currently rides on selection, and selection has no obligation to keep a
 * validator alive — including `rhythm_conductor_tick` itself, which is registered
 * as `satisfier:rhythm_conductor_tick` and had 11 executions ever, the last 53
 * hours before this file was written. That is the circularity CLAUDE.md already
 * names when it exempts the liveness watchdogs from the script-retention rule:
 * "a check cannot be scheduled by the mechanism it exists to recover." This is
 * the bootstrap tier, and it is the stated exception rather than a carve-out.
 *
 * IT MEASURES, IT DOES NOT SET POLICY. The expected cadence of a validator is
 * derived from THAT VALIDATOR'S OWN HISTORY — the median gap between its past
 * executions — not from a period chosen here. A validator is severed when its
 * current silence exceeds a multiple of the rhythm it previously kept. Choosing
 * cadence periods is an operator decision; observing that something stopped
 * keeping its own is not.
 *
 * META-GUARD (a detector must be proven to COMPLETE, not merely to exist): if the
 * fleet is active but ZERO validators had enough history to evaluate, this emits a
 * gap about ITSELF, because a detector that silently checks nothing is the exact
 * class it exists to catch.
 *
 * Strictly read-only except substrateGap emission.
 */
export {};
//# sourceMappingURL=validator-liveness-tick.d.ts.map