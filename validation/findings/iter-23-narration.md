---
agent: validation
iter: 23
generated_at: 2026-05-25T09:18:15Z
prior_iter: 22 (commit 756a29ac)
---

# Iteration 23 — Activity_Recommendation Resolver Registered But create-shape-provider-goal Still Failing

## Critical Finding: Instant Failures Persist Despite Resolver Registration

**F-054b (NEW FINDING):** create-shape-provider-goal continues failing with 2-4ms duration even after activity_recommendation resolver registration (commit 156f1c30) and goal-host-vessel restart at 09:03:36Z.

**Paradox**: Individual tasks within create-shape-provider-goal show success:
- activity_recommendation task: 1ms success
- impulse-resolve tasks: 1ms and 0ms success
- **But overall execution: 2ms failure**

This indicates the resolver executes successfully but returns an **incomplete or empty result** that causes post-execution validation to fail.

**Verification from logs**:
```
[goal-host-vessel] at 09:17:51Z registered built-in resolver: activity_recommendation
[goal-host-vessel] at 09:17:51Z registered 30 development-vessel proxy resolvers
```

Resolver is wired. But create-shape-provider-goal output is empty or invalid.

## Observable State Post-Restart (09:17:50Z window)

### Execution Traces
- **Total**: 50 queryable traces (subset window shown)
- **Recent**: exec_2x0juaea at 09:16:56Z (validator-dispatch, 41s success)
- **create-shape-provider-goal**: 5 recent failures, all 2-4ms duration, since iter-22

### Template Registry Regression
- **Count**: 2 templates visible via `/v2/activities/templates` API
  - `activity:⟨forge-vessel-for-shape⟩`
  - `activity:⟨evolve-activity-self-contained⟩`
- **Expected**: 15+ seeded templates from iter-22
- **Status**: **MAJOR REGRESSION** — bootstrap-seeded templates not queryable or cleared

### Boredom Status
**Active**: goal[0]/goal[1]/goal[2] executing every ~30s (observed in monitors)
- Composition chains active (validator-dispatch → slot-binding → create-shape-provider-goal)
- Boredom-vessel process running (124 bytes output)
- Goals dispatch successfully but create-shape-provider-goal fails in every cycle

### Thompson Metrics (degraded)
Unable to query due to template visibility issue. Execution counts from traces:
- validator-dispatch: High volume (majority of traces)
- slot-binding: Present in chains
- create-shape-provider-goal: 100% failure rate (5/5 recent)
- Unknown α/β due to registry query limitation

## Root Cause Analysis

### Why create-shape-provider-goal Fails Despite Resolver Success

The 1ms activity_recommendation task execution suggests:
1. Resolver is found and invoked
2. Resolver completes in 1ms (too fast for actual API call?)
3. Resolver returns empty/invalid result (no shape candidates)
4. Post-execution validation rejects the empty result
5. Overall execution fails

**Hypothesis**: activity_recommendation resolver is a **stub or no-op** that doesn't call POST /v2/activities/recommend. Instead it:
- Acknowledges the task
- Returns immediately with empty payload
- Causes downstream validation failure

**Alternative**: The resolver output format is mismatched (expecting different impulse shape than goal-host-vessel provides).

### Why Template Registry Dropped to 2

Possible causes (require diagnosis):
1. Bootstrap-seeder did not run on container restart (startup sequence issue)
2. Templates are filtered by org_id or visibility (query returns subset)
3. Templates were deleted or deprecated since iter-22
4. Database was reset/truncated during a restart

**Affect**: Boredom-vessel can only execute templates that ARE visible (forge-vessel, evolve-activity). create-shape-provider-goal is presumably NOT visible in the queryable set, yet traces show it executing — this suggests:
- Execution traces use a different template pool than the `/templates` API endpoint
- OR development-vessel proxy templates bypass the visibility filter

## Open Items

### F-054b: activity_recommendation Returns Empty
- Task succeeds (1ms)
- Overall execution fails (2ms, no tasks actually run post-resolver-invocation?)
- Likely cause: resolver is a stub, not a real HTTP bridge to `/v2/activities/recommend`
- Fix location: repos/goal-host-vessel/src/index.ts, registerBuiltinResolvers() function

### Template Registry Visibility Crisis
- 2 visible templates vs. 15+ in iter-22
- Bootstrap-seeder may not have run or templates not indexed for queryability
- Query: Are templates org_id-scoped? Are non-scoped templates hidden?
- May require bootstrap-seeder re-run or visibility flag fix

### Execution Traces Paradox
- Traces show create-shape-provider-goal executing despite only 2 templates in registry
- Suggests: proxy templates from development-vessel are separate pool
- Impact: Thompson sampling may be incomplete (only tracking subset of executions)

### F-053: failure_mode Still Null
- create-shape-provider-goal failures have `failure_mode: null`
- No classification of why post-execution validation rejected the result

## Findings Tally

**New this iteration:**
- F-054b (activity_recommendation returns empty) — resolver task succeeds but output invalid

**Still open:**
- F-053 (failure_mode null)
- Template registry visibility (2 vs. 15+ regression)
- Execution traces visibility vs. queryable templates mismatch

**Unresolved from prior:**
- S.4a window timing (blocked by create-shape-provider-goal failures)

## Next Steps

1. **Inspect activity_recommendation resolver implementation** in goal-host-vessel to verify it actually calls activity-api or returns valid result
2. **Debug why execution task succeeds but overall execution fails** — check post-execution validation logic
3. **Investigate template registry visibility** — query why 2/15+ templates are queryable
4. **Verify bootstrap-seeder ran** — check logs for seed success or failure
5. **Confirm development-vessel proxy templates are separate pool** — explain execution-trace vs. queryable-template mismatch

## Verification

Generated: 2026-05-25T09:18:15Z. Real-time substrate API queries.

Execution traces verified via `/v2/activities/execution-traces` endpoint (50 queryable, subset of total). Goal-host-vessel logs confirm resolver registration at 09:17:51Z post-restart.

Template count from `/v2/activities/templates` endpoint: 2 results. Discrepancy with iter-22 count (15+) unresolved.

