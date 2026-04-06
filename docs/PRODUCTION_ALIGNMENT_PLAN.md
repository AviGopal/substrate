# Production Alignment Plan

**Date:** 2026-04-06
**Status:** Draft

## Executive Summary

Production inspection of https://activity.metabob.com reveals significant gaps between the codebase and deployed state. The learning loop infrastructure exists but isn't operational due to:
1. All executions failing (no positive signal for learning)
2. Templates not synced to production
3. Learning data not being recorded
4. API version mismatch (missing endpoints)

## Current Production State

| Metric | Value |
|--------|-------|
| API Version | 1.0.0 |
| Templates | 2 |
| Execution Traces | 359 (all failures) |
| Tool Usage Records | 0 |
| Composition Edges | 0 |
| Impulse Relevance Records | 0 |
| Execution Sequences | 0 |
| Thompson Sampling | Operational (but no positive signal) |

## Issues and Resolution Plan

### Issue 1: All Executions Failing

**Symptom:** 359 execution traces, 0 successes
**Root Cause:** Activities require files that don't exist (e.g., `/tmp/db-schema.json`)
**Impact:** Thompson Sampling can't learn - only getting negative signal

**Resolution:**
1. [ ] Fix visualization activity templates to not require non-existent files
2. [ ] Add proper input validation before execution
3. [ ] Create simpler "hello world" activities for testing
4. [ ] Run successful executions to provide positive signal

**Owner:** Activity template development
**Priority:** P0 (Critical)

---

### Issue 2: Templates Not Synced

**Symptom:** Production has 2 templates, codebase has dozens
**Root Cause:** No automated template sync mechanism
**Impact:** Most activities unavailable in production

**Resolution:**
1. [ ] Create template sync script/activity
2. [ ] Sync `metabob-proto/activities/` to production database
3. [ ] Verify templates with `GET /v2/activities/templates`
4. [ ] Add template sync to CI/CD pipeline

**Owner:** Deployment automation
**Priority:** P0 (Critical)

---

### Issue 3: Learning Data Not Being Recorded

**Symptom:** Empty tables for tool-usage, composition, impulse-relevance, sequences
**Root Cause:** MiniBob MCP methods exist but aren't being called during execution
**Impact:** Can't learn from executions beyond success/failure

**Resolution:**
1. [ ] Audit MiniBob activity execution flow for MCP calls
2. [ ] Verify MCP endpoint configuration in production MiniBob
3. [ ] Add logging to confirm MCP calls are made
4. [ ] Check if MCP methods are actually implemented vs stubbed

**Investigation Points:**
- `repos/minibob/src/mcp.ts` - Are `recordToolUsage`, `recordComposition`, etc. being called?
- `repos/minibob/src/activity.ts` - Does execution flow call these methods?
- Is `ACTIVITY_API_ENDPOINT` configured correctly?

**Owner:** MiniBob development
**Priority:** P1 (High)

---

### Issue 4: API Version Mismatch

**Symptom:** Code has endpoints that return 404 in production
- `/v2/activities/execution-traces/selection-events` → 404
- `/v2/activities/execution-traces/calibration-summary` → 404

**Root Cause:** Production deployed from older codebase
**Impact:** Calibration analysis not available

**Resolution:**
1. [ ] Compare production API version with `repos/metabob-activity-api/package.json`
2. [ ] Deploy latest metabob-activity-api to production
3. [ ] Verify new endpoints available
4. [ ] Update canary with latest and promote

**Owner:** Deployment
**Priority:** P1 (High)

---

### Issue 5: MiniBob Auth Endpoint Missing

**Symptom:** `/v2/auth/minibob/signin` returns 404
**Root Cause:** Auth routes not deployed or different auth scheme
**Impact:** MiniBob instances can't authenticate

**Resolution:**
1. [ ] Verify auth routes exist in deployed code
2. [ ] Check if different auth mechanism is used (e.g., pre-shared keys)
3. [ ] Deploy auth routes if missing
4. [ ] Update MiniBob configuration

**Owner:** Auth system
**Priority:** P2 (Medium)

---

## Implementation Order

### Phase 1: Stop the Bleeding (Day 1)
1. Fix failing visualization activities OR disable them
2. Create simple test activity that can succeed
3. Run successful execution to verify trace recording

### Phase 2: Sync Content (Day 1-2)
1. Sync templates from metabob-proto to production
2. Verify templates appear in `/v2/activities/templates`
3. Test Thompson Sampling recommendations with new templates

### Phase 3: Deploy Latest API (Day 2-3)
1. Build latest metabob-activity-api
2. Deploy to canary
3. Verify new endpoints (selection-events, calibration-summary)
4. Promote to production

### Phase 4: Enable Learning (Day 3-5)
1. Audit MiniBob MCP integration
2. Enable/fix learning data recording
3. Verify data appears in:
   - `/v2/activities/tool-usage`
   - `/v2/activities/composition/graph`
   - `/v2/activities/impulse-relevance`
   - `/v2/activities/execution-sequences`

### Phase 5: Validate Learning Loop (Day 5-7)
1. Run multiple successful executions
2. Verify Thompson Sampling scores update
3. Check calibration metrics
4. Confirm learning loop is operational

---

## Verification Commands

```bash
# Check API version
curl -s https://activity.metabob.com/health | jq '.version'

# Check template count
curl -s "https://activity.metabob.com/v2/activities/templates" | jq 'length'

# Check for successful executions
curl -s "https://activity.metabob.com/v2/activities/execution-traces?limit=100" | \
  jq '[.executions[] | select(.success == true)] | length'

# Check learning data
curl -s "https://activity.metabob.com/v2/activities/tool-usage" | jq 'length'
curl -s "https://activity.metabob.com/v2/activities/composition/graph" | jq '.edges | length'
curl -s "https://activity.metabob.com/v2/activities/impulse-relevance" | jq 'length'

# Check calibration (after API upgrade)
curl -s "https://activity.metabob.com/v2/activities/execution-traces/calibration-summary" | jq .
```

---

## Success Criteria

- [ ] At least 10 successful execution traces
- [ ] At least 10 templates synced to production
- [ ] Tool usage records > 0
- [ ] Composition edges > 0
- [ ] Calibration endpoints returning data
- [ ] Thompson Sampling showing varied scores based on outcomes

---

## Notes

- The infrastructure is built - it just needs content and connections
- Focus on getting ONE successful execution first
- Learning loop can't improve without positive signal
- Template sync should be automated in CI/CD
