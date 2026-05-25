---
agent: validation
iter: 18
generated_at: 2026-05-25T06:35:03Z
prior_iter: 17-halt (commit fcf4c4e5)
---

# Iteration 18 — Substrate restarted, but template seeding BLOCKED (F-049)

## Substrate restarted; audit iter-004 completed

The substrate container is now running (8 vessels alive). Audit
iteration-004 completed at 06:03:29Z with comprehensive findings about
the pre-crash state, the crash root cause (JWT_SECRET missing), and
post-restart expectations.

**Audit findings summary:**
- F-044 root cause: JWT_SECRET missing from environment (gen-env.sh strict-mode guard)
- substrate-explicit-vessels: 22→48/53 (+26 tasks before crash, 91% complete)
- **F-038 RESOLVED**: composition_chain + parent_execution_id populated on new dispatch path ✓
- **F-037/F-043 OPEN**: Thompson bypass persists (Thompson posteriors not updated on any template)
- **F-029 REGRESSED**: failure_mode null on new execution path (not populated)
- F-047 NEW: gate 27.3.g.3 marked done before concept-db smoke test actually passes
- S.4a window 2 blocked: requires coverage-tick success before measurement can proceed

## Critical blocker: F-049 — Template registration failing

Bootstrap-seeder fired at 06:30:13Z and attempted to seed 13 shared
templates. **All 13 registrations failed** with identical error:

```
Query failed in activity-system.learning_loop:
Found NONE for field `org_id`, with record `activity:⟨slot-binding⟩`,
but expected a string
```

Failed templates: slot-binding, validator-dispatch, audit-test-report,
run-sensitivity-probe, debug-failing-audit, ribosome-extract,
create-shape-provider-goal, core-activity-audit, prune-activity,
replace-activity, repair-failed-activity, evolve-activity-self-contained,
forge-vessel-for-shape.

**Result**: 0 seeded, 13 failed. Seeding exited with status=1/FAILURE.

## Observable consequence: Empty template registry

Current state:
- Template count: 0
- Trace count: 0
- Vessels: 8 running
- Boredom queue: (unknown, depends on templates existing)

The substrate has no activity templates and no execution traces. It
cannot execute any topology-discovery activities. S.4a window 2 is
doubly blocked: first by the crash, now by template registration
failure.

## What I cannot say from substrate-side

1. **Why org_id is NONE**: whether this is a schema change in
   activity-api (migration issue), a bootstrap-seeder bug (not setting
   org_id), or a database permission issue (org_id field unset by default).
2. **Whether other subsystems can write templates**: are user-submitted
   templates also failing, or just the bootstrap seeding path?
3. **Root cause of the pre-crash phase transition**: what caused the
   11 commits to land between iter-17 halt and iter-18 restart, and what
   did they intend to fix?

The registration error originates in activity-api's template-write
endpoint. Audit inspection of activity-api source is needed.

## Gaps status this iteration

| Gap | State |
|---|---|
| gap-001 (concept-db) | in-flight (Phase 1b code present, 1b.6 blocked on image rebuild + seeding failure) |
| gap-002 (WS auth) | unchanged |
| gap-003 (failure_mode) | regressed (not populated on new execution path) |
| gap-004 | FIXED |
| gap-005 | FIXED |
| gap-006 | premise empirically false, pending retire |
| gap-007 / F-037/F-043 | unchanged (Thompson bypass persists) |
| gap-008 (substrate monitoring) | acknowledged — no alerting on crashes |
| F-044 (crash cause) | RESOLVED (JWT_SECRET missing) |
| **F-049 (template registration)** | NEW BLOCKER — all 13 bootstrap templates fail to register |

## Findings tally

Per audit iter-004: 48 total findings (19 resolved, 23 open, 3
regressed, 7 unverifiable). New iter-18 finding adds F-049, pushing
open count to 24.

## What blocks the loop next

Template registration must be fixed before validation can proceed.
The substrate cannot execute any activity without templates. Current
state is non-functional at the application level (no templates, no
traces, no boredom queue execution possible).

Blockers in priority order:
1. Fix template registration org_id error
2. Re-run bootstrap-seeder after fix
3. Verify 13 templates register successfully
4. Verify boredom queue can execute topology activities
5. Continue S.4a window 2 measurement

## Next step

Cannot continue without resolving F-049. The substrate is technically
live (vessels running, health check passes) but application-level
execution is impossible (no templates).

Await dev fix on template registration org_id issue.
