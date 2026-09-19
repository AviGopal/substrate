/**
 * rhythm-conduct-tick.ts — run the rhythm conductor from the bootstrap tier.
 *
 * WHY THIS EXISTS. `rhythm_conductor_tick` is the component that reads the rhythm
 * registry, scores each family's due-ness and enqueues what is due. It was registered
 * only as `satisfier:rhythm_conductor_tick` — a Thompson-selected activity — so it ran
 * when selection happened to pick it: **11 executions ever**, the last 53 hours before
 * this file was written. Cadence therefore depended on the selection drift it exists to
 * correct, and when it stopped it emitted silence, which reads as health.
 *
 * CLAUDE.md already states the principle, as its reason for exempting the liveness
 * watchdogs from the script-retention rule: "a check cannot be scheduled by the mechanism
 * it exists to recover." A SCHEDULER cannot be scheduled by the thing it schedules. This
 * is that stated bootstrap-tier exception, not a new carve-out.
 *
 * IT PRINTS THE COUNTS, DELIBERATELY. The conductor can decline every rhythm and return
 * `considered: 11, enqueued: [], skipped: []` — from outside, "nothing was due",
 * "everything was unaffordable" and "it crashed" are indistinguishable. Putting
 * considered/enqueued/skipped/bucket_load in the journal makes an idle tick legible as
 * idle rather than as absent.
 *
 * Read-only with respect to source; its only effects are the conductor's own enqueues.
 */
export {};
//# sourceMappingURL=rhythm-conduct-tick.d.ts.map