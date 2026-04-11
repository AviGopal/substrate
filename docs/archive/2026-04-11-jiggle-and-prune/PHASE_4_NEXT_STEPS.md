# Phase 4 Validation - Next Steps

## Summary

Phase 4 (Circuit Breaker and Health Scoring) is **fully implemented** but **end-to-end validation is blocked** due to Analysis-API not being deployed to the canary environment.

## Immediate Actions Required

### 1. Build and Deploy Analysis-API

**Current Issue:**
- Helm deployment exists but image `metabobapp/metabob-analysis-api:0.1.2-98cb2b0` not found in Docker Hub
- Pods stuck in `ImagePullBackOff`

**Resolution Steps:**

```bash
# Navigate to deployment repository
cd repos/deployment

# Build Analysis-API image for canary
./scripts/build_changed.sh --env canary --push

# This will:
# 1. Build metabob-analysis-api Docker image
# 2. Tag with canary format: YYYYMMDD-v0.1.2-<commit>-<buildno>
# 3. Push to Docker Hub registry
# 4. Update environments/production.canary.values.yaml

# Deploy to canary
helmfile -e production --selector name=metabob-analysis-api sync

# Verify deployment
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-analysis-api
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-analysis-api --tail=50
```

**Expected Output:**
```
NAME                                   READY   STATUS    RESTARTS   AGE
metabob-analysis-api-xxx-yyy          1/1     Running   0          2m
metabob-analysis-api-xxx-zzz          1/1     Running   0          2m
```

---

### 2. Implement Heartbeat Sending in Analysis-API

**Current Status:** Heartbeat endpoint exists in Activity-API, but Analysis-API doesn't send heartbeats yet.

**Implementation Required:**

Edit `/repos/metabob-analysis-api/src/index.ts`:

```typescript
// After registrationService.register() (line 86-89)
registrationService.register().catch(err => {
  console.error('[Startup] Failed to register with Activity-API:', err);
});

// Add heartbeat interval (NEW CODE)
const HEARTBEAT_INTERVAL_MS = 60000; // 60 seconds

setInterval(async () => {
  try {
    const response = await fetch(`${activityApiEndpoint}/v2/vessels/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.METABOB_API_KEY}`, // Or use JWT
      },
      body: JSON.stringify({
        vesselId: 'analysis-api',
        metrics: {
          // Optional: include custom metrics
          cpu_usage: process.cpuUsage(),
          memory_usage: process.memoryUsage(),
        },
      }),
    });

    if (!response.ok) {
      console.error('[Heartbeat] Failed to send heartbeat:', await response.text());
    } else {
      const data = await response.json();
      console.debug('[Heartbeat] Sent successfully', {
        health_score: data.health_score,
        eligible_for_routing: data.eligible_for_routing,
      });
    }
  } catch (error) {
    console.error('[Heartbeat] Error sending heartbeat:', error);
    // Don't throw - allow service to continue even if heartbeat fails
  }
}, HEARTBEAT_INTERVAL_MS);
```

**Note:** Heartbeat endpoint requires JWT authentication. You may need to:
1. Generate JWT token on startup
2. Use API key authentication (requires Activity-API modification)
3. Use service account credentials

---

### 3. Implement Heartbeat Sending in MiniBob

**Current Status:** MiniBob also needs to send heartbeats.

**Implementation Required:**

Similar to Analysis-API, add heartbeat interval in MiniBob's main entry point.

---

### 4. Generate Test JWT Token

**Current Blocker:** Vessel health endpoints require JWT authentication.

**Resolution Options:**

**Option A: Use Identity-API to generate JWT**
```bash
# Authenticate with Identity-API
curl -X POST https://identity.metabob.com/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Response includes JWT token
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

**Option B: Add API Key Support to Vessel Health Endpoints**

Modify `/repos/metabob-activity-api/src/routes/vessel-registry.ts`:

```typescript
// Line 580: GET /v2/vessels/health/organization
app.get('/health/organization', async (c) => {
  // CHANGE: Support both JWT and API Key authentication
  const auth = getJwtAuthFromContext(c) || getApiKeyAuthFromContext(c);
  if (!auth) {
    return c.json({ error: 'Authentication required (JWT or API Key)' }, 401);
  }

  // Rest of implementation unchanged
  // ...
});
```

**Option C: Create Service Account in SurrealDB**

Generate long-lived JWT for testing purposes.

---

## End-to-End Validation Tests

Once Analysis-API is deployed and heartbeats are configured, execute these tests:

### Test 1: Simulate Vessel Failure

```bash
# Get JWT token first
export JWT_TOKEN="<your-jwt-token>"

# Scale down Analysis-API to trigger failures
kubectl scale deployment metabob-analysis-api -n activity-system --replicas=0

# Wait for pods to terminate
kubectl wait --for=delete pod -n activity-system -l app.kubernetes.io/name=metabob-analysis-api --timeout=60s

# Trigger 5+ impulse resolutions (will fail because vessel is down)
for i in {1..6}; do
  curl -X POST https://activity.metabob.com/v2/impulses/resolve \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "impulse": {
        "id": "test-impulse-'$i'",
        "pointer": {
          "type": "error_log",
          "logFilePath": "/var/log/test.log"
        }
      }
    }'

  echo "Request $i completed"
  sleep 1
done
```

**Expected Result:** Circuit breaker opens after 5 consecutive failures.

---

### Test 2: Verify Circuit Breaker State

```bash
# Check circuit breaker state
curl -s https://activity.metabob.com/v2/vessels/health/organization \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

# Expected output:
{
  "vessels": [
    {
      "vessel_id": "analysis-api",
      "circuit_state": "open",
      "health_score": 0.2,
      "status": "unhealthy",
      "last_heartbeat": "2026-04-10T19:45:00Z",
      "consecutive_failures": 5
    }
  ],
  "summary": {
    "total": 1,
    "healthy": 0,
    "degraded": 0,
    "unhealthy": 1,
    "expired": 0,
    "avg_score": 0.2
  }
}
```

**Verification:** Circuit state should be `open`.

---

### Test 3: Verify Half-Open State

```bash
# Restart Analysis-API
kubectl scale deployment metabob-analysis-api -n activity-system --replicas=2

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -n activity-system -l app.kubernetes.io/name=metabob-analysis-api --timeout=120s

# Wait 30s for cooldown period to elapse
echo "Waiting 30s for cooldown period..."
sleep 30

# Check state (should be half_open)
curl -s https://activity.metabob.com/v2/vessels/health/organization \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.vessels[] | select(.vessel_id == "analysis-api") | .circuit_state'

# Expected output: "half_open"

# Trigger successful resolution (probe request)
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "impulse": {
      "id": "test-impulse-recovery",
      "pointer": {
        "type": "error_log",
        "logFilePath": "/var/log/test.log"
      }
    }
  }'

# Wait a moment for state to update
sleep 2

# Check state again (should be closed after successful probe)
curl -s https://activity.metabob.com/v2/vessels/health/organization \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.vessels[] | select(.vessel_id == "analysis-api") | .circuit_state'

# Expected output: "closed"
```

**Verification:** State transitions `open` → `half_open` → `closed`.

---

### Test 4: Verify Routing Traces

```bash
# Query routing traces
curl -s "https://activity.metabob.com/v2/activities/routing-traces?limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

# Expected output (excerpt):
{
  "traces": [
    {
      "trace_id": "routing_trace:xyz",
      "shape": "error_log",
      "candidates": ["analysis-api"],
      "health_scores": {
        "analysis-api": 0.2
      },
      "circuit_states": {
        "analysis-api": "open"
      },
      "excluded_vessels": [
        {
          "vessel_id": "analysis-api",
          "reason": "circuit_breaker_open"
        }
      ],
      "selected_vessel_id": null,
      "outcome": "circuit_open",
      "timestamp": "2026-04-10T19:45:00Z"
    }
  ]
}
```

**Verification:** Traces should show circuit breaker decisions, excluded vessels, and health scores.

---

### Test 5: Monitor for False Positives

```bash
# Monitor canary metrics for 30 minutes
# Check circuit breaker state every 5 minutes

for i in {1..6}; do
  echo "Check $i/6 at $(date)"

  # Get vessel health
  curl -s https://activity.metabob.com/v2/vessels/health/organization \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.vessels[] | {vessel_id, circuit_state, health_score, status}'

  # Sleep 5 minutes
  sleep 300
done
```

**Verification:** No circuits should open during normal operation.

---

## Success Criteria

Phase 4 validation is complete when:

- [x] Circuit breaker implementation verified ✅
- [x] Health scoring implementation verified ✅
- [x] Routing trace recording verified ✅
- [x] Unit tests passing ✅
- [ ] Analysis-API deployed to canary
- [ ] Heartbeats being sent successfully
- [ ] Circuit opens after 5 consecutive failures
- [ ] Half-open state transitions correctly
- [ ] Circuit closes after successful probe
- [ ] Routing traces captured in database
- [ ] Dashboard visualizes circuit breaker states
- [ ] No false positives during 30-minute monitoring
- [ ] Tasks 12.1-12.11 marked complete in OpenSpec

---

## Rollback Plan

If issues are discovered during validation:

```bash
# Scale Analysis-API to 0 to stop traffic
kubectl scale deployment metabob-analysis-api -n activity-system --replicas=0

# Delete the helm release if needed
helm delete metabob-analysis-api -n activity-system

# Revert canary values
cd repos/deployment
git checkout HEAD -- environments/production.canary.values.yaml
```

Circuit breaker feature is backward compatible - no breaking changes to existing vessels.

---

## Timeline Estimate

| Task | Estimated Time |
|------|----------------|
| Build and deploy Analysis-API | 15 minutes |
| Implement heartbeat sending | 30 minutes |
| Generate test JWT token | 10 minutes |
| Execute end-to-end tests | 45 minutes |
| Monitor for false positives | 30 minutes |
| Document results | 15 minutes |
| **Total** | **~2.5 hours** |

---

## Contact

For questions or issues during validation:
- Check canary logs: `kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100`
- Review circuit breaker traces: Query SurrealDB `circuit_breaker_trace` table
- Monitor health metrics: `GET /v2/vessels/health/organization`

**Validation Report:** See `/PHASE_4_VALIDATION_REPORT.md` for detailed implementation review.
