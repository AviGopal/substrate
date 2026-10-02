/**
 * rhythm-seed-tick.ts — restore the time-shaped rhythm registry if it is empty.
 *
 * WHY THIS EXISTS. Law 5 puts cadence in the pool as time-shaped rhythm impulses that
 * rhythm_conductor_tick reads, scores by due-ness and enqueues. On 2026-09-07 thirteen
 * rhythms were seeded BY HAND and verified end to end. No script was retained, so when
 * a power outage recreated the pool on 2026-09-09 the registry came back EMPTY and
 * nothing noticed: a conductor with no rhythms is silent, and silence reads as health.
 * Meanwhile validator-liveness files a recurring validator-cadence-severed gap that
 * nothing can service while the conductor has nothing to make due.
 *
 * THIS IS RESTORATION, NOT NEW POLICY — EXCEPT WHERE AN ENTRY IS EXPLICITLY FLAGGED
 * "NEW POLICY" IN A COMMENT ON THE ENTRY ITSELF. Every unflagged body below is recovered
 * VERBATIM from the pre-outage pool snapshot (/workspace/pool/standing.json,
 * 2026-09-07T04:33Z) — the same families, budgets, credit and staleness that were already
 * approved and running. No budget was invented in the restored set. In this scheduler
 * budget is COST (due = credit_mean * staleness / budget; affordable iff
 * budget <= 1 - load/3), so a fabricated budget would silently re-prioritise the whole
 * fleet — which is exactly why a newly-authored budget must be flagged rather than
 * smuggled in under the restoration claim. Flagged entries state their own rationale.
 *
 * IDEMPOTENT BY CONSTRUCTION. It reads the registry through the CONDUCTOR OWN read path
 * and writes nothing if any rhythm already exists, so it is safe on every tick and cannot
 * fight a live conductor or double-seed.
 *
 * IT JOURNALS WHAT IT SEEDED, deliberately: the 09-07 seeding left no record, which is
 * why the loss was unrecoverable rather than merely inconvenient. The next recovery can
 * diff against this log.
 *
 * NOTE ON COVERAGE, stated rather than discovered later: the conductor maps family -> goal
 * from its bootstrap FAMILY_GOALS const, extended at runtime by rhythmFamilyGoal impulses.
 * Of the eleven restored families, capability-census and validation carry their mappings
 * below. concept-management has NO mapping in either place and will be skipped
 * no_goal_mapping until one is supplied — recorded, not invented.
 */
export {};
//# sourceMappingURL=rhythm-seed-tick.d.ts.map