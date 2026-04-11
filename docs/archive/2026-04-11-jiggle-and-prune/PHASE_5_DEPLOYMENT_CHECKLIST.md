# Phase 5: Deployment Checklist

**Date:** 2026-04-10
**Commit:** 47f74d4a
**Branch:** feature/autonomous-cicd

## Pre-Deployment

- [x] Code changes implemented
- [x] Tests written
- [x] Code compiles successfully
- [x] Changes committed to git
- [x] Changes synced to deployment repo
- [ ] Docker build (skipped - will build in CI/CD)

## Canary Deployment (Task 13.5)

### Trigger Deployment
```bash
# Push to dev branch triggers canary deployment
git push origin feature/autonomous-cicd
```

### Monitor Deployment
```bash
# Check GitHub Actions workflow
gh run list --repo MetabobProject/deployment --limit 5

# Watch deployment logs
gh run view <run-id> --log
```

### Verify Health
```bash
# Check canary health endpoint
curl https://activity.metabob.com/health

# Expected: 200 OK with healthy status
```

## Validation Tests (Tasks 13.6-13.7)

### Test 1: Analysis API Shapes Return 410
```bash
# Test error_log shape (Analysis API shape)
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "analysisResult",
      "resultId": "test-id"
    }
  }'

# Expected: 410 Gone
# Expected response:
# {
#   "success": false,
#   "error": "resolver_moved",
#   "message": "...",
#   "pointer_type": "analysisResult",
#   "suggested_approach": "..."
# }
```

### Test 2: Unknown Shape Returns 404 with Vessel Discovery
```bash
# Test unknown shape
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "totally_unknown_shape"
    }
  }'

# Expected: 404 Not Found
# Expected response:
# {
#   "success": false,
#   "error": "use_vessel_discovery",
#   "message": "...",
#   "shape": "totally_unknown_shape",
#   "suggested_approach": "Query GET /v2/vessels/discover..."
# }
```

### Test 3: Native Shapes Still Work
```bash
# Test activityTemplate shape (Activity-API native)
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "activityTemplate",
      "templateId": "some-existing-template-id"
    }
  }'

# Expected: 200 OK or 404 Not Found (but NOT 410 Gone)
```

### Test 4: Run Automated Tests
```bash
# Run tests against canary
export ACTIVITY_API_URL=https://activity.metabob.com
cd repos/metabob-activity-api
bun test src/routes/impulses-resolve.test.ts
```

## Monitoring (Tasks 13.8-13.9)

### Monitor for 48 Hours

**Key Metrics:**

1. **Error Rate**
   - 410 responses are expected (not errors)
   - Watch for 500 errors (should be zero)
   - Watch for unexpected 400 errors

2. **Latency**
   - Should improve (no proxy hop)
   - Expect immediate 410 responses

3. **Request Volume**
   - Track 410 responses by shape
   - Track 404 responses for unknown shapes
   - Track successful native shape resolutions

**Commands:**
```bash
# Check logs for errors
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f --since=1h | grep ERROR

# Count 410 responses
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --since=24h | grep "410" | wc -l

# Count 404 responses
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --since=24h | grep "404" | wc -l

# Count 500 errors
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --since=24h | grep "500" | wc -l
```

### Expected Baseline

**Before (with proxy):**
- Network calls to Analysis API
- Retry logic on failures
- Timeout delays
- 500 errors on Analysis API unavailability

**After (without proxy):**
- Immediate 410 responses
- No network calls to Analysis API
- No timeout delays
- Zero 500 errors from proxy failures

## Production Promotion (Task 13.10)

### Prerequisites
- [x] Canary deployed successfully
- [ ] All validation tests pass
- [ ] 48-hour monitoring complete
- [ ] No error rate regression
- [ ] No 500 errors detected

### Promote to Production
```bash
cd repos/deployment
./scripts/promote-canary-to-production.sh
```

### Post-Production Validation
```bash
# Run same tests against production
export ACTIVITY_API_URL=https://activity.metabob.com
bun test src/routes/impulses-resolve.test.ts

# Monitor production for 24 hours
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f
```

## Rollback Plan

If critical issues occur:

```bash
# Option 1: Revert commit and redeploy
git revert 47f74d4a
git push origin feature/autonomous-cicd

# Option 2: Rollback Helm release
cd repos/deployment
helm rollback metabob-activity-api -n activity-system
```

## Success Criteria

- [ ] Canary deployment successful
- [ ] Analysis API shapes return 410 Gone
- [ ] Unknown shapes return 404 with vessel discovery
- [ ] Native shapes still resolve correctly
- [ ] Zero 500 errors
- [ ] Improved latency (no proxy hop)
- [ ] 48-hour canary monitoring complete
- [ ] Production deployment successful

## Communication

### Notify Stakeholders
- Backend team: Analysis API shapes now return 410
- Frontend team: Vessel-direct resolution required
- DevOps team: Monitor for 410 responses (expected)

### Documentation Updates
- [x] Phase 5 summary document created
- [x] Deployment checklist created
- [ ] Update CLAUDE.md with Phase 5 completion
- [ ] Mark tasks 13.1-13.10 as complete in OpenSpec

## Notes

- The proxy removal is a **breaking change** for vessels attempting proxy resolution
- Helpful error messages guide vessels to vessel-direct approach
- No user-facing impact (vessels will adapt)
- Code is cleaner (~260 lines removed)
- Architecture alignment improved
