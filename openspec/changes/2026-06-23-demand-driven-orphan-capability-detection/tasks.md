# Tasks

## DEV (three-place rule + test, one commit)
- [ ] 1. `src/resolvers/orphaned-capability-scan.ts` — implement `resolveOrphanedCapabilityScan`
      (fetch live shapes from discovery + invoked resolvers from activity-api templates;
      set-difference; apply capability filter; emit `orphaned_capability` substrateGaps
      via the `emitGap` pattern; return `orphanedCapabilityReport`). No LLM, HTTP-only.
- [ ] 2. `src/config.ts` — add `orphaned_capability_scan` to `discovery.shapes`.
- [ ] 3. `src/routes/impulses.ts` — add the `case "orphaned_capability_scan"` dispatch.
- [ ] 4. `src/seed/orphaned-capability-tick.ts` — `ORPHANED_CAPABILITY_TICK_TEMPLATE`
      (single-task wrapper, `boredom_target_template`).
- [ ] 5. `src/seed/index.ts` — import + add to the seed template array + re-export.
- [ ] 6. `test/resolvers/orphaned-capability-scan.test.ts` — scripted fetch:
      orphan shape with live resolver + 0 invocations → 1 gap; invoked resolver → 0 gaps;
      re-run → upsert (stable id) not duplicate; internal-machinery shape filtered out.

## VERIFY
- [ ] 7. `bun run lint` (tsc --noEmit + check-shape-dispatch) green.
- [ ] 8. `bun test` green.
- [ ] 9. Deploy to container (`/vessels/development-vessel`), restart unit, re-seed
      templates so the tick is fetchable by id.
- [ ] 10. Invoke `orphaned_capability_scan` live → confirm a gap for `problem_detection`,
      none for `fs_read`; confirm gap visible to `drain-pending-substrate-gaps`.
- [ ] 11. Observe (over cadence) the existing author/compose loop draft a bridge activity
      that invokes a previously-orphaned capability resolver. Record in a VERIFY doc.

## Notes
- Deploy is operator-boundary help (substrate cannot author its own TS). Direct edit of
  `repos/development-vessel/src/**` requires `SUBSTRATE_ALLOW_DIRECT_EDIT=1` (vessel-edit
  gate); deploy via the substrate's normal host→container sync, mind host↔container drift.
- Evidence snapshot: `orphan-resolvers-evidence.txt` (250 live-but-uninvoked resolvers,
  2026-06-23).
