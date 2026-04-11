# Circuit Breaker Deployment Checklist

**Implementation:** Circuit Breaker, Health Scoring, and Routing Traces
**Target:** Activity-API (canary → production)
**Date:** 2026-04-10

## Pre-Deployment

### ✅ Code Review
- [x] Schema follows SurrealDB SCHEMAFULL best practices
- [x] Circuit breaker state machine correctness
- [x] Health score formula matches spec (0.5 × success + 0.3 × latency + 0.2 × availability)
- [x] Sampling strategy correct (100% failures, 10% successes)
- [x] TTL configuration correct (30 days)
- [x] Multi-tenant isolation via org_id
- [x] Proper error handling in all services
- [x] Logging at appropriate levels

### ✅ Testing
- [x] Unit tests created for circuit breaker
- [x] Unit tests created for health scoring
- [x] Manual validation script created
- [ ] Integration tests with real SurrealDB (canary)
- [ ] Load testing for trace buffering
- [ ] Failure scenario testing

### ✅ Documentation
- [x] Implementation guide (CIRCUIT_BREAKER_IMPLEMENTATION.md)
- [x] Deployment checklist (this file)
- [x] API endpoint documentation
- [x] Integration examples for MiniBob and Analysis-API

## Canary Deployment

### Step 1: Database Migration
```bash
# Connect to canary SurrealDB
surreal sql \
  --endpoint https://surrealdb.metabob.com \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password "$SURREALDB_PASSWORD" \
  --file repos/metabob-activity-api/sql/schemas/030-circuit-breaker-health.surql

# Verify tables created
INFO FOR DB;
```

**Expected output:**
- `vessel_circuit_breaker` table with indexes
- `vessel_health_metrics` table with indexes
- `routing_trace` table with indexes
- `circuit_breaker_trace` table with indexes

**Validation:**
- [ ] All 4 tables created
- [ ] Indexes created (check idx_circuit_breaker_vessel, idx_health_metrics_vessel, etc.)
- [ ] Permissions set correctly (org_id isolation)

### Step 2: Deploy Code to Canary
```bash
# From main workspace
git add repos/metabob-activity-api/
git commit -m "feat(activity-api): implement circuit breaker and health scoring

- Add circuit breaker state machine (CLOSED → OPEN → HALF_OPEN)
- Add health scoring (success rate + latency + availability)
- Add routing traces with sampling (100% failures, 10% successes)
- Add heartbeat endpoint POST /v2/vessels/heartbeat
- Add vessel router service with health-weighted selection
- Add comprehensive tests and documentation"

git push origin dev
```

**CI/CD will:**
- [ ] Run tests
- [ ] Run linting
- [ ] Build Docker image
- [ ] Deploy to canary (activity.metabob.com)

**Monitor deployment:**
```bash
# Watch CI/CD
gh run list --limit 5
gh run view <run-id> --log

# Check pod health
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f
```

### Step 3: Smoke Test Canary

**Health check:**
```bash
curl https://activity.metabob.com/health
```
Expected: `{"status": "healthy", ...}`

**Heartbeat endpoint:**
```bash
curl -X POST https://activity.metabob.com/v2/vessels/heartbeat \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vesselId": "test-canary-vessel",
    "metrics": {"uptime_seconds": 120}
  }'
```
Expected: `{"vesselId": "test-canary-vessel", "health_score": 1.0, ...}`

**Validation:**
- [ ] Health endpoint returns 200
- [ ] Heartbeat endpoint returns 200
- [ ] Health score starts at 1.0 for new vessel
- [ ] No errors in pod logs

### Step 4: Integration Test - Circuit Breaker

**Simulate 5 consecutive failures to open circuit:**
```bash
for i in {1..5}; do
  echo "Failure $i"
  curl -X POST https://activity.metabob.com/v2/impulses/resolve \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "pointer": {
        "type": "nonexistent-shape",
        "path": "test.ts"
      }
    }'
  sleep 1
done
```

**Check circuit state:**
```bash
# Query circuit breaker state directly
surreal sql \
  --endpoint https://surrealdb.metabob.com \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password "$SURREALDB_PASSWORD" \
  -c "SELECT * FROM vessel_circuit_breaker WHERE vessel_id = 'test-canary-vessel';"
```

**Expected:**
- [ ] Circuit state = 'open'
- [ ] consecutive_failures >= 5
- [ ] next_probe_at set to ~30 seconds in future

### Step 5: Integration Test - Health Scoring

**Record successes and failures:**
```bash
# 3 successes
for i in {1..3}; do
  echo "Success $i"
  # Make valid request
  curl -X POST https://activity.metabob.com/v2/vessels/heartbeat \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"vesselId": "test-canary-vessel"}'
  sleep 1
done

# 2 failures (simulated via invalid shape)
for i in {1..2}; do
  echo "Failure $i"
  # Make invalid request
  curl -X POST https://activity.metabob.com/v2/impulses/resolve \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"pointer": {"type": "invalid-shape"}}'
  sleep 1
done
```

**Check health metrics:**
```bash
surreal sql \
  --endpoint https://surrealdb.metabob.com \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password "$SURREALDB_PASSWORD" \
  -c "SELECT * FROM vessel_health_metrics WHERE vessel_id = 'test-canary-vessel';"
```

**Expected:**
- [ ] success_rate = 0.6 (3 / 5)
- [ ] health_score between 0.5-0.7
- [ ] eligible_for_routing = true (above 0.3 threshold)

### Step 6: Integration Test - Routing Traces

**Query routing traces:**
```bash
surreal sql \
  --endpoint https://surrealdb.metabob.com \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password "$SURREALDB_PASSWORD" \
  -c "SELECT * FROM routing_trace ORDER BY timestamp DESC LIMIT 10;"
```

**Expected:**
- [ ] Traces recorded for each routing decision
- [ ] Failures always sampled (outcome != 'success')
- [ ] Some successes sampled (~10%)
- [ ] expires_at set to ~30 days from timestamp

### Step 7: Integration Test - Vessel Router

**This will be tested when impulse resolution is updated to use VesselRouter**
(Deferred until impulse resolution integration)

**Expected behavior:**
- [ ] Discovers vessels by shape
- [ ] Filters by circuit breaker state (excludes OPEN)
- [ ] Filters by health score (excludes < 0.3)
- [ ] Selects using health-weighted probability
- [ ] Records routing trace

## Canary Validation (24-48 hours)

### Monitoring

**Metrics to track:**
- [ ] Circuit breaker opens/closes per hour
- [ ] Health score distribution across vessels
- [ ] Routing trace volume (inserts per minute)
- [ ] Heartbeat frequency per vessel
- [ ] Database query performance (circuit breaker, health metrics)

**Alerts to watch for:**
- [ ] High circuit breaker open rate
- [ ] Low health scores across many vessels
- [ ] Routing trace buffer overflow
- [ ] Slow health score queries

### Health Gates

**Before production promotion:**
- [ ] No P0/P1 errors in canary
- [ ] Circuit breaker opens/closes working as expected
- [ ] Health scores updating correctly
- [ ] Routing traces recording with correct sampling
- [ ] Heartbeat endpoint stable
- [ ] Database performance acceptable (<100ms p95)
- [ ] No memory leaks or crashes

## Production Promotion

### Prerequisites
- [ ] All canary validation complete
- [ ] Health gates passed
- [ ] Team sign-off
- [ ] Rollback plan documented

### Deployment
```bash
cd repos/deployment
./scripts/promote-canary-to-production.sh
```

**CI/CD will:**
- [ ] Copy canary image tags to production.values.yaml
- [ ] Run health checks on production environment
- [ ] Deploy to production
- [ ] Run smoke tests

### Post-Deployment Validation

**Verify production:**
```bash
# Health check
curl https://activity.metabob.com/health

# Heartbeat endpoint
curl -X POST https://activity.metabob.com/v2/vessels/heartbeat \
  -H "Authorization: Bearer $PROD_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vesselId": "prod-vessel", "metrics": {}}'

# Check database
surreal sql \
  --endpoint https://surrealdb-prod.metabob.com \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password "$PROD_SURREALDB_PASSWORD" \
  -c "SELECT count() FROM vessel_circuit_breaker GROUP ALL;"
```

**Validation:**
- [ ] All endpoints responding
- [ ] Tables exist in production DB
- [ ] No errors in production logs
- [ ] Vessels registering and heartbeating

## Rollback Plan

### If issues detected in canary

**Revert code:**
```bash
git revert <commit-hash>
git push origin dev
# CI/CD will redeploy previous version
```

**Revert database:**
```bash
# Drop tables (if needed)
surreal sql \
  --endpoint https://surrealdb.metabob.com \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password "$SURREALDB_PASSWORD" \
  -c "
    REMOVE TABLE vessel_circuit_breaker;
    REMOVE TABLE vessel_health_metrics;
    REMOVE TABLE routing_trace;
    REMOVE TABLE circuit_breaker_trace;
  "
```

### If issues detected in production

**Emergency rollback:**
```bash
cd repos/deployment
./scripts/rollback-production.sh <previous-tag>
```

**Validation:**
- [ ] Production rolled back to previous version
- [ ] All endpoints responding
- [ ] No data loss

## Post-Deployment

### MiniBob Integration
- [ ] Add heartbeat sending to MiniBob (every 60s)
- [ ] Deploy updated MiniBob to canary
- [ ] Verify heartbeats received in Activity-API
- [ ] Deploy updated MiniBob to production

### Analysis-API Integration
- [ ] Add heartbeat sending to Analysis-API (every 60s)
- [ ] Deploy updated Analysis-API to canary
- [ ] Verify heartbeats received in Activity-API
- [ ] Deploy updated Analysis-API to production

### Impulse Resolution Integration
- [ ] Update POST /v2/impulses/resolve to use VesselRouter
- [ ] Test routing decisions in canary
- [ ] Verify circuit breaker opens on failures
- [ ] Verify health-weighted selection
- [ ] Deploy to production

### Dashboard Updates
- [ ] Add routing trace visualization
- [ ] Add circuit breaker state monitoring
- [ ] Add health score charts
- [ ] Add vessel availability dashboard

## Success Criteria

**After full deployment:**
- [ ] Circuit breakers opening/closing automatically
- [ ] Health scores updating every request/heartbeat
- [ ] Routing traces recording with sampling
- [ ] Vessels excluded when circuit opens
- [ ] Vessels excluded when health < 0.3
- [ ] Health-weighted routing working
- [ ] No performance degradation
- [ ] Dashboard showing routing analytics

## Sign-Off

- [ ] Engineering Lead: _______________
- [ ] DevOps: _______________
- [ ] QA: _______________
- [ ] Date: _______________

---

**Notes:**
- This is Task #6 from vessel integration standardization
- Implements specs from `openspec/changes/vessel-integration-standardization/`
- Foundation for autonomous vessel routing and fault tolerance
