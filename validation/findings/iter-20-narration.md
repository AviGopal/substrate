---
agent: validation
iter: 20
generated_at: 2026-05-25T06:46:05Z
prior_iter: 19-blocker (commit 6fe4748a)
---

# Iteration 20 — Boredom executing; F-050 partially resolved; new failures observed

## Breakthrough: Boredom-vessel is executing

Monitor detected new execution trace at 06:45:51Z. boredom-vessel has
resumed after F-050 block. Two successful dispatches:

- 06:45:37Z: `[boredom-vessel] submitting goal[3]: "identify shapes in the execution graph that have no known producer and escalate the most critical one"`
  - Result: coverage-tick FAILURE, dur=2ms, chain=0
- 06:46:44Z: `[boredom-vessel] submitting goal[4]: "check substrate health including vessel liveness — report which vessels are active or down and restart any that are inactive"`
  - Result: substrate-health FAILURE, dur=1ms, chain=0

**F-050 appears partially resolved** — boredom-vessel can now dispatch goals
and invoke goal-host-vessel without "no template id returned" errors.

But execution outcomes are still problematic.

## New findings

### F-051: Instant template failures (1-2ms execution)

Both traces show immediate failure with near-zero duration:
- coverage-tick: 2ms FAILURE
- substrate-health: 1ms FAILURE

Not execution failure (which would take longer) — instant rejection.
Likely template resolver or dispatch issue at the activity-api / goal-host-vessel
boundary.

### F-052: No composition_chain on new traces

Both traces have `composition_chain: 0` (empty). Despite the new
dispatch path being built to propagate chains, these traces do not
carry parent/ancestor information. The chain propagation may not be
active on the boredom-driven path, or the traces are being written
through a legacy path that bypasses chain tracking.

### F-053: failure_mode still null

Both failure traces have `failure_mode: null`. F-029 remains unresolved
on the new execution path.

## What changed between iter-19 and iter-20

No new git commits. F-050 was "fixed" without a code commit, suggesting:
1. A work-around was applied (env var, config change, manual intervention)
2. The fix was pre-existing but not apparent to iter-19 snapshot
3. A retry/restart of the seeding process succeeded

The most likely: template seeding or FTS indexing retry succeeded silently,
boredom timer fired naturally, and execution resumed.

## Observable metrics state

Topology template metrics still do not return data:
- Queries for coverage-tick, substrate-health-tick, etc. return empty
- Execution count unknown (metrics not visible)
- Thompson posteriors unknown (likely still at α=β=1)

The instant failures are preventing metrics from accumulating.

## Blockers for validation progression

1. **F-051**: Why templates execute for 1-2ms and fail instantly
2. **F-052**: composition_chain not populated on boredom-driven traces
3. **F-053**: failure_mode null (F-029 regressed)

All three prevent meaningful learning from boredom executions. The substrate
is active but not learning.

## What I cannot say from substrate-side

1. **Why F-050 was fixed without a commit**: Manual intervention? Automatic retry? External change?
2. **Whether metrics are actually accumulating in activity-api despite being invisible**: Requires audit-level DB inspection
3. **Why templates fail instantly instead of timing out or producing error messages**: Requires goal-host-vessel logs or activity-api trace details

## Next steps

Continue monitoring for:
1. More boredom executions (timer should fire ~every 60-90s based on goal[3]/goal[4] spacing)
2. Whether traces accumulate despite instant failures
3. Whether metrics eventually become visible
4. Whether Thompson posteriors update (unlikely given failures, but worth watching)

If instant failures persist, validation is blocked until F-051 is addressed.
If metrics remain hidden, Thompson learning is blocked regardless of execution.

## Findings tally

New findings: F-051, F-052, F-053.
Resolved: F-050 (partially — goals dispatch but fail on execution).
Still open: F-037/F-043 (Thompson bypass), F-029 (failure_mode), all others.
