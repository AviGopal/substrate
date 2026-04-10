# Circuit Breaker & Health Scoring Implementation

**Status:** Implemented - Ready for Testing
**Date:** 2026-04-10
**Related Specs:**
- `openspec/changes/vessel-integration-standardization/specs/execution-tracing-integration/spec.md`
- `openspec/changes/vessel-integration-standardization/specs/activity-execution-coordination-traces/spec.md`

## Summary

Implemented circuit breaker state machine, health scoring system, and routing traces for vessel fault tolerance and intelligent routing in Activity-API.

## Components Implemented

### 1. Database Schema (`sql/schemas/030-circuit-breaker-health.surql`)

**Tables:**
- `vessel_circuit_breaker` - Circuit breaker state per vessel (CLOSED → OPEN → HALF_OPEN)
- `vessel_health_metrics` - Health scores with exponential moving averages
- `routing_trace` - Routing decision traces (sampled, 30-day TTL)
- `circuit_breaker_trace` - Circuit breaker state transition traces

**Key Features:**
- Multi-tenant isolation via `org_id` field
- Indexed for fast lookups (vessel_id, state, timestamp, outcome)
- TTL support for trace retention (30 days)
- SCHEMAFULL with proper field validation

### 2. Circuit Breaker Service (`src/services/circuit-breaker.ts`)

**State Machine:**
```
CLOSED --[5 failures OR ≥50% failure rate]-> OPEN
OPEN --[cooldown expires]-> HALF_OPEN
HALF_OPEN --[success]-> CLOSED
HALF_OPEN --[failure]-> OPEN (with exponential backoff)
```

**Thresholds:**
- Max consecutive failures: 5
- Failure rate threshold: 50% over 60 seconds
- Default cooldown: 30 seconds (exponential backoff up to 5 minutes)

**Methods:**
- `getState(vesselId, orgId)` - Get or create circuit breaker state
- `recordSuccess(vesselId, orgId, latencyMs)` - Record successful request
- `recordFailure(vesselId, orgId, errorCode, errorMessage, activityId?)` - Record failed request
- `shouldAllowRequest(vesselId, orgId)` - Check if request should be allowed
- `checkHalfOpenTransition(vesselId, orgId)` - Check/execute half-open transition

### 3. Health Scoring Service (`src/services/health-scoring.ts`)

**Health Score Formula:**
```
health_score = (success_rate × 0.5) + (latency_factor × 0.3) + (availability_factor × 0.2)

Where:
- success_rate = successful_requests / total_requests (last 100 requests)
- latency_factor = 1.0 - min(p95_latency / 1000ms, 1.0)
- availability_factor = heartbeats_received / heartbeats_expected (last 10 periods)
```

**Threshold:**
- health_score < 0.3: Vessel excluded from routing

**Methods:**
- `getMetrics(vesselId, orgId)` - Get or create health metrics
- `recordSuccess(vesselId, orgId, latencyMs)` - Update metrics after success
- `recordFailure(vesselId, orgId, latencyMs)` - Update metrics after failure
- `recordHeartbeat(vesselId, orgId)` - Update availability from heartbeat
- `recordMissedHeartbeat(vesselId, orgId)` - Penalize for missed heartbeat
- `getHealthScores(vesselIds, orgId)` - Bulk health score lookup
- `getEligibleVessels(vesselIds, orgId)` - Filter vessels by health threshold

**Features:**
- Exponential moving average for latency (alpha = 0.2)
- Sliding window for last 100 requests
- Heartbeat freshness tracking (last 10 periods)
- Automatic eligibility calculation

### 4. Routing Trace Service (`src/services/routing-trace.ts`)

**Sampling Strategy:**
- 100% of failures (outcome != 'success')
- 10% of successes (randomly sampled)

**Batch Writing:**
- Buffer up to 100 traces before flushing
- Auto-flush after 1 second if buffer not full
- Async, non-blocking writes

**TTL:**
- 30 days from creation
- Automatic expiry via `expires_at` field

**Methods:**
- `recordTrace(trace)` - Record trace asynchronously (batched)
- `recordTraceSync(trace)` - Record trace immediately (for critical traces)
- `queryTraces(params)` - Query routing traces with filters
- `getShapeStats(orgId, shape, windowHours)` - Get routing statistics
- `forceFlush()` - Force flush all buffered traces (for graceful shutdown)

### 5. Vessel Router Service (`src/services/vessel-router.ts`)

**Routing Algorithm:**
1. Discover vessels capable of handling the shape
2. Get health scores and circuit breaker states for all candidates
3. Filter out vessels with OPEN circuits
4. Filter out vessels with health_score < 0.3
5. Select using health-weighted probability (Thompson Sampling)
6. Record routing trace

**Methods:**
- `route(options)` - Route impulse to best available vessel
- `recordSuccess(vesselId, orgId, latencyMs)` - Update health & circuit after success
- `recordFailure(vesselId, orgId, errorCode, errorMessage, latencyMs, activityId?)` - Update health & circuit after failure

**Routing Decision:**
```typescript
{
  selected_vessel: VesselCandidate | null;
  candidates: VesselCandidate[];
  excluded: Array<{ vessel_id: string; reason: string }>;
  selection_algorithm: 'health_weighted';
  selection_probability?: number;
  discovery_duration_ms: number;
}
```

### 6. Heartbeat Endpoint (`src/routes/vessel-registry.ts`)

**POST /v2/vessels/heartbeat**

Vessels call this every 60 seconds to update health availability.

**Request:**
```json
{
  "vesselId": "minibob-instance-1",
  "metrics": { /* optional vessel-reported metrics */ }
}
```

**Response:**
```json
{
  "vesselId": "minibob-instance-1",
  "health_score": 0.85,
  "eligible_for_routing": true,
  "availability": 1.0,
  "next_heartbeat_in_seconds": 60
}
```

## Integration Points

### MiniBob Integration

MiniBob needs to send heartbeats every 60 seconds:

```typescript
// Add to MiniBob startup/background loop
setInterval(async () => {
  try {
    await fetch('https://activity.metabob.com/v2/vessels/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        vesselId: 'minibob-instance-id',
        metrics: {
          uptime_seconds: process.uptime(),
          // Add other relevant metrics
        },
      }),
    });
  } catch (error) {
    console.error('Heartbeat failed:', error);
  }
}, 60000); // Every 60 seconds
```

### Analysis-API Integration

Analysis-API needs to send heartbeats similarly.

### Impulse Resolution Integration

The impulse resolution endpoint should use `VesselRouter.route()` for vessel selection:

```typescript
// In impulses.ts POST /resolve endpoint
import { VesselRouter } from '../services/vessel-router';

// When resolving impulses that require vessel routing
const decision = await VesselRouter.route({
  shape: impulse.shape,
  org_id: orgId,
  impulse_id: impulse.id,
  activity_execution_id: activityExecutionId,
  correlation_id: correlationId,
});

if (!decision.selected_vessel) {
  // No vessel available
  return c.json({ error: 'No vessels available for shape' }, 503);
}

// Call the selected vessel
const startTime = Date.now();
try {
  const response = await fetch(`${decision.selected_vessel.endpoint}/v2/impulses/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(impulse),
    signal: AbortSignal.timeout(30000), // 30s timeout
  });

  const latency = Date.now() - startTime;

  if (!response.ok) {
    // Record failure
    await VesselRouter.recordFailure(
      decision.selected_vessel.vessel_id,
      orgId,
      `HTTP_${response.status}`,
      await response.text(),
      latency,
      activityExecutionId
    );
    throw new Error(`Vessel returned ${response.status}`);
  }

  // Record success
  await VesselRouter.recordSuccess(
    decision.selected_vessel.vessel_id,
    orgId,
    latency
  );

  return await response.json();
} catch (error) {
  const latency = Date.now() - startTime;
  await VesselRouter.recordFailure(
    decision.selected_vessel.vessel_id,
    orgId,
    'TIMEOUT',
    error.message,
    latency,
    activityExecutionId
  );
  throw error;
}
```

## Testing

### Unit Tests

Created test files:
- `src/services/circuit-breaker.test.ts` - Circuit breaker state machine tests
- `src/services/health-scoring.test.ts` - Health score computation tests

**Run tests:**
```bash
cd repos/metabob-activity-api
bun test src/services/circuit-breaker.test.ts
bun test src/services/health-scoring.test.ts
```

### Integration Testing

**Simulated Failure Scenario:**
```bash
# 1. Deploy to canary
git push origin dev

# 2. Simulate vessel failures
for i in {1..5}; do
  curl -X POST https://activity.metabob.com/v2/impulses/resolve \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"pointer": {"type": "analysis:code-smell", "path": "test.ts"}}'
done

# 3. Check circuit breaker state
curl https://activity.metabob.com/v2/vessels/analysis-api/health \
  -H "Authorization: Bearer $JWT_TOKEN"

# Expected: Circuit should open after 5 failures
```

**Health Score Degradation:**
```bash
# Send heartbeats regularly
while true; do
  curl -X POST https://activity.metabob.com/v2/vessels/heartbeat \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"vesselId": "test-vessel"}'
  sleep 60
done

# In another terminal, simulate failures
for i in {1..10}; do
  # Trigger failed resolution
  curl -X POST https://activity.metabob.com/v2/impulses/resolve \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{"pointer": {"type": "invalid-shape"}}'
done

# Check health score
curl https://activity.metabob.com/v2/vessels/test-vessel/health \
  -H "Authorization: Bearer $JWT_TOKEN"

# Expected: Health score should decrease below 0.3, vessel ineligible
```

## Deployment

### Database Migration

Apply schema:
```bash
# In canary environment
surreal sql \
  --endpoint https://surrealdb.metabob.com \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password "$SURREALDB_PASSWORD" \
  --file repos/metabob-activity-api/sql/schemas/030-circuit-breaker-health.surql
```

### Canary Deployment

1. Push to dev branch:
```bash
git add .
git commit -m "feat(activity-api): implement circuit breaker and health scoring"
git push origin dev
```

2. CI/CD automatically deploys to canary

3. Validate endpoints:
```bash
# Health check
curl https://activity.metabob.com/health

# Heartbeat endpoint
curl -X POST https://activity.metabob.com/v2/vessels/heartbeat \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vesselId": "test-vessel"}'
```

### Production Promotion

After canary validation:
```bash
cd repos/deployment
./scripts/promote-canary-to-production.sh
```

## Dashboard Visibility

### Routing Trace View

Activity Dashboard should display:
- Timeline of routing decisions
- Vessel selection breakdown
- Health scores over time
- Circuit breaker state changes

### Circuit Breaker Events

Show all state transitions:
- CLOSED → OPEN (with trigger type: consecutive_failures or failure_rate_threshold)
- OPEN → HALF_OPEN (after cooldown)
- HALF_OPEN → CLOSED (successful probe)
- HALF_OPEN → OPEN (failed probe with new cooldown)

### Health Score Monitoring

Charts showing:
- Success rate over time
- P95 latency trends
- Availability (heartbeat freshness)
- Overall health score
- Eligible vs ineligible vessels

## Success Metrics

- ✅ Circuit breaker state machine implemented
- ✅ Health score computation with exponential moving average
- ✅ Routing trace recording with sampling and TTL
- ✅ Heartbeat endpoint for availability tracking
- ✅ Vessel router with health-weighted selection
- ✅ Unit tests for circuit breaker and health scoring
- ⏳ Integration tests (canary deployment)
- ⏳ Dashboard visualization (requires dashboard updates)

## Next Steps

1. **Deploy to canary** - Apply schema and deploy code
2. **Add heartbeat sending to MiniBob** - Background loop every 60s
3. **Add heartbeat sending to Analysis-API** - Background loop every 60s
4. **Integrate VesselRouter into impulse resolution** - Use for vessel selection
5. **Test failure scenarios** - Verify circuit breaker opens correctly
6. **Monitor health scores** - Ensure vessels degrade/recover as expected
7. **Dashboard updates** - Add visualization for routing traces and health
8. **Production promotion** - After successful canary validation

## Related Files

### New Files
- `sql/schemas/030-circuit-breaker-health.surql` - Database schema
- `src/services/circuit-breaker.ts` - Circuit breaker service
- `src/services/health-scoring.ts` - Health scoring service
- `src/services/routing-trace.ts` - Routing trace service
- `src/services/vessel-router.ts` - Vessel routing service
- `src/services/circuit-breaker.test.ts` - Circuit breaker tests
- `src/services/health-scoring.test.ts` - Health scoring tests

### Modified Files
- `src/routes/vessel-registry.ts` - Added POST /v2/vessels/heartbeat endpoint

### Documentation
- This file: `CIRCUIT_BREAKER_IMPLEMENTATION.md`
