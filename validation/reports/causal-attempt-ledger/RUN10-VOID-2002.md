# Graded acceptance run 10 — 2026-09-25T20:02:59Z

## R  commit=`f5e1c3a`
attempt=`att-muhei8s2-3xh5gkq`
- [ ] 1a pre-snapshot (intents=1 canary=fail pre_at=2026-09-25T20:16:11.014Z commit=2026-09-25T20:16:11+00:00)
- [ ] 1b authoring execution join (dispatch=null executionId=null rows=0)
- [ ] 2 outcome (flips=[] surprise=true)
- [ ] 3 R settlement (held)
- [ ] 4 lessons (gap=0 file=0)

## Stopped at 20:35Z (items 1-4 could not pass); diagnosis
- A compose picked at 19:59:45, before the autonomous_pick lease was taken at 20:02:13, landed 768ae7c at 20:08:05 and restarted
  development-vessel. That interrupted R's first try (20:03), whose verified patch was parked.
- R's second try (20:12) resumed the parked landing. `resumeParkedLanding` calls the cutover with no attempt_id and no
  authoring_execution_id, so registerAttempt minted a new attempt at landing time (20:16:11.014). Its pre-snapshot was taken after the
  live tree already held the staged edit, so the canary read "fail" and there was no dispatch link (gap #48 class).
- Fixes: the parked record keeps the pre-cutover attempt_id and the resume reuses it (dispatched); and a run opens only once
  development-vessel reports in_flight == 0 after the lease is taken.
