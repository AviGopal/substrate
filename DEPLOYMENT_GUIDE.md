# Learning System Deployment Guide - Phases 1.1-1.6

**Status:** Ready for Deployment  
**Image:** metabob-activity-api:learning-v1.1-1.6

---

## Quick Deploy

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./deploy-learning-system.sh
```

This automated script will:
1. ✅ Build Docker image with Phase 1.1-1.6 changes
2. ✅ Deploy to Kubernetes via helmfile
3. ✅ Verify health and new endpoints
4. ✅ Run integration tests

---

## Manual Deployment Steps

### Step 1: Build Docker Image

```bash
cd repos/metabob-activity-api
docker build -t metabob-activity-api:learning-v1.1-1.6 -t metabob-activity-api:latest .
```

**Expected Output:**
```
Bundled 112 modules in 27ms
Successfully built...
Successfully tagged metabob-activity-api:learning-v1.1-1.6
Successfully tagged metabob-activity-api:latest
```

### Step 2: Deploy with Helmfile

```bash
cd helm
helmfile -f helmfile-activity-dev.yaml sync
```

**Or minimal deployment:**
```bash
helmfile -f helmfile-activity-minimal.yaml sync
```

### Step 3: Wait for Rollout

```bash
kubectl rollout status deployment -n activity-system metabob-activity-api --timeout=300s
```

### Step 4: Verify Health

```bash
curl http://api.minibob.local/health
```

**Expected Response:**
```json
{
  "service": "metabob-activity-api",
  "version": "1.0.0",
  "checks": {
    "redis": {"status": "healthy", "latency_ms": 1},
    "surrealdb": {"status": "healthy", "latency_ms": 2}
  },
  "status": "healthy"
}
```

### Step 5: Test New Endpoints

```bash
# Test composition tracking
curl -X POST http://api.minibob.local/v2/activities/composition \
  -H "Content-Type: application/json" \
  -d '{
    "parent_activity_id": "test-parent",
    "child_activity_id": "test-child",
    "execution_id": "test-exec-123",
    "goal_context": "Testing",
    "success": true
  }'

# Test impulse relevance
curl -X POST http://api.minibob.local/v2/activities/impulse-relevance \
  -H "Content-Type: application/json" \
  -d '{
    "impulse_id": "test-impulse",
    "activity_variant_id": "test-activity",
    "was_loaded": true,
    "execution_succeeded": true
  }'

# Test tool usage
curl -X POST http://api.minibob.local/v2/activities/tool-usage \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "bash",
    "activity_variant_id": "test-activity",
    "execution_id": "test-exec-123",
    "tool_succeeded": true,
    "activity_succeeded": true
  }'

# Test execution sequences
curl -X POST http://api.minibob.local/v2/activities/execution-sequences \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "goal_context": "Testing",
    "sequence": [
      {
        "activity_id": "test-activity",
        "execution_id": "exec-1",
        "order": 0,
        "trigger_type": "goal",
        "success": true,
        "duration_ms": 1000,
        "cost_usd": 0.1
      }
    ],
    "outcome": "success"
  }'
```

### Step 6: Run Integration Tests

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
MCP_ENDPOINT=http://api.minibob.local bun run test-learning-system-integration.ts
```

---

## New Endpoints Deployed

### Phase 1.1-1.2: Activity Composition

**POST /v2/activities/composition**
- Records when one activity calls another
- Learns composition patterns and edge weights

**GET /v2/activities/composition/graph**
- Query composition graph
- Filter by activity, min_weight
- Returns edges with success rates

### Phase 1.3: Impulse Relevance

**POST /v2/activities/impulse-relevance**
- Records impulse usage and outcomes
- Learns Bayesian relevance scores

**GET /v2/activities/impulse-relevance**
- Query impulse relevance metrics
- Filter by impulse_id, activity_variant_id
- Returns relevance/irrelevance scores

### Phase 1.5: Tool Usage Patterns

**POST /v2/activities/tool-usage**
- Records tool usage during execution
- Learns required vs optional tools

**GET /v2/activities/tool-usage**
- Query tool usage patterns
- Filter by tool_name, activity_variant_id, is_required
- Returns usage_probability, success_correlation

### Phase 1.6: Execution Sequences

**POST /v2/activities/execution-sequences**
- Records session-level activity sequences
- Learns successful sequence patterns

**GET /v2/activities/execution-sequences**
- Query execution sequences
- Filter by session_id, goal_context, outcome
- Returns full sequence data

---

## Troubleshooting

### Image Build Fails

```bash
# Check if bun is installed
cd repos/metabob-activity-api
bun --version

# Try manual build
bun run build

# Check for TypeScript errors
bun run lint
```

### Deployment Fails

```bash
# Check pod status
kubectl get pods -n activity-system

# View pod logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100

# Describe deployment
kubectl describe deployment -n activity-system metabob-activity-api

# Check events
kubectl get events -n activity-system --sort-by='.lastTimestamp' | tail -20
```

### Endpoints Return 404

```bash
# Check if using correct URL
curl -v http://api.minibob.local/health

# Check if old image is deployed
kubectl describe pod -n activity-system -l app.kubernetes.io/name=metabob-activity-api | grep Image:

# Force restart with new image
kubectl rollout restart deployment -n activity-system metabob-activity-api
kubectl rollout status deployment -n activity-system metabob-activity-api
```

### Health Check Fails

```bash
# Check SurrealDB connectivity
kubectl get pods -n activity-system -l app.kubernetes.io/name=surrealdb

# Check Redis connectivity
kubectl get pods -n metabob -l app.kubernetes.io/name=redis

# View detailed health
curl http://api.minibob.local/health | jq .
```

---

## Rollback Plan

If deployment fails, rollback to previous version:

```bash
# List deployment history
kubectl rollout history deployment -n activity-system metabob-activity-api

# Rollback to previous revision
kubectl rollout undo deployment -n activity-system metabob-activity-api

# Rollback to specific revision
kubectl rollout undo deployment -n activity-system metabob-activity-api --to-revision=<number>

# Verify rollback
kubectl rollout status deployment -n activity-system metabob-activity-api
```

---

## Verification Checklist

- [ ] Docker image built successfully
- [ ] Deployment rolled out without errors
- [ ] Health check returns 200 OK
- [ ] Redis connection healthy
- [ ] SurrealDB connection healthy
- [ ] POST /v2/activities/composition returns 200
- [ ] POST /v2/activities/impulse-relevance returns 200
- [ ] POST /v2/activities/tool-usage returns 200
- [ ] POST /v2/activities/execution-sequences returns 200
- [ ] GET endpoints return data
- [ ] Integration tests pass

---

## Post-Deployment

### Monitor Logs

```bash
# Watch logs in real-time
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# Check for errors
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api | grep ERROR

# View recent logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50
```

### Query Learning Data

```bash
# Check composition graph
curl "http://api.minibob.local/v2/activities/composition/graph?limit=10" | jq .

# Check tool usage patterns
curl "http://api.minibob.local/v2/activities/tool-usage?limit=10" | jq .

# Check execution sequences
curl "http://api.minibob.local/v2/activities/execution-sequences?limit=10" | jq .
```

### Performance Monitoring

```bash
# Check resource usage
kubectl top pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api

# Check pod metrics
kubectl describe pod -n activity-system -l app.kubernetes.io/name=metabob-activity-api
```

---

## Configuration

**Helm Values:**
- `helm/charts/metabob-activity-api/values.yaml` - Default values
- `helm/environments/activity-dev.values.yaml` - Dev environment overrides

**Key Settings:**
- Image: `metabob-activity-api:latest`
- Port: `8080`
- Replicas: `2`
- Resources: `512Mi RAM / 250m CPU (request)`
- Health: `/health` endpoint
- Redis: `redis://redis-master.metabob.svc.cluster.local:6379`
- SurrealDB: `http://surrealdb.activity-system.svc.cluster.local:8000`

---

## Next Steps After Deployment

1. ✅ Verify all endpoints work
2. ✅ Run full integration test suite
3. ✅ Monitor logs for errors
4. 🎯 Continue to **Phase 1.7: Goal Execution Paths**

---

**Ready to Deploy!** Run `./deploy-learning-system.sh` to begin.
