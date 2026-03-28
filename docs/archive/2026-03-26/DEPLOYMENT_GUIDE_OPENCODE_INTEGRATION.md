# OpenCode + MiniBob Integration Deployment Guide

## Overview

This guide walks through deploying the complete activity system with OpenCode integration:
- **MiniBob library** embedded in OpenCode for structured workflows
- **metabob-activity-api** backend for Thompson Sampling and learning
- **Activity Dashboard** for observability
- **SurrealDB** for persistent storage
- **Valkey/Redis** for live selection cache

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      OpenCode (Application)                      │
│  - Embeds MiniBob library (@metabob/minibob)                    │
│  - Provides custom tools (bash, read, write, metabob, etc.)     │
│  - Application code becomes composable activities               │
│  - Goal tool → MiniBob → Backend recommendations                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MiniBob Library (Execution)                   │
│  - ActivityExecutor: Runs activities with LLM                   │
│  - GoalProcessor: Goal-seeking recommendations                  │
│  - ImpulseResolver: Local impulse resolution (memo, file)       │
│  - MCPClient: Backend communication                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              metabob-activity-api (Backend Storage/Learning)     │
│  - Thompson Sampling for activity recommendations               │
│  - Impulse resolution (all types)                               │
│  - Execution trace storage                                      │
│  - Pattern recognition                                          │
│  - Deployment: http://api.minibob.local                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SurrealDB (Persistent Storage)                │
│  - Activity templates and variants                              │
│  - Execution traces                                             │
│  - Learning metrics                                             │
│  - Namespace: activity-system, DB: learning_loop                │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Docker Desktop
- Kubernetes enabled (context: `docker-desktop`)
- Ensure Docker is running

```bash
docker context use docker-desktop
kubectl config use-context docker-desktop
```

### 2. Istio Service Mesh
```bash
istioctl install --set profile=demo -y
```

### 3. /etc/hosts Configuration
Add these entries to `/etc/hosts`:
```
127.0.0.1  api.minibob.local
127.0.0.1  dashboard.minibob.local
127.0.0.1  devbob.minibob.local
```

### 4. Environment Variables
```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export SURREALDB_USERNAME="root"  # Optional, defaults to root
export SURREALDB_PASSWORD="surrealdb-local-dev-123"  # Optional
```

## Step 1: Build Docker Images

### Build metabob-activity-api (Backend)
```bash
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .
```

### Build MiniBob (Optional - for standalone deployment)
```bash
cd repos/minibob
docker build -t minibob:latest .
```

### Build Activity Dashboard
```bash
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .
```

### Verify Images
```bash
docker images | grep -E "metabob-activity-api|minibob|activity-dashboard"
```

Expected output:
```
metabob-activity-api    latest    <image-id>   <timestamp>   ~100MB
minibob                 latest    <image-id>   <timestamp>   ~80MB
activity-dashboard      latest    <image-id>   <timestamp>   ~90MB
```

## Step 2: Deploy Activity System

### Using Helmfile (Recommended)
```bash
cd helm
helmfile -f helmfile-activity-system.yaml sync
```

This deploys:
- Valkey (Redis) - Live cache for Thompson Sampling
- SurrealDB 3.x - Persistent learning database
- metabob-activity-api - Backend with MCP endpoints
- Activity Dashboard - React UI for observability
- MiniBob (3 replicas) - Boredom activity workers
- Istio Gateway - Ingress with virtual services

### Verify Deployment
```bash
# Check all pods are running
kubectl get pods -n activity-system

# Expected output:
# NAME                                      READY   STATUS    RESTARTS   AGE
# metabob-activity-api-xxxxx               2/2     Running   0          2m
# activity-dashboard-xxxxx                 2/2     Running   0          2m
# minibob-xxxxx                            2/2     Running   0          2m
# minibob-xxxxx                            2/2     Running   0          2m
# minibob-xxxxx                            2/2     Running   0          2m
# redis-valkey-master-0                    1/1     Running   0          2m
# surrealdb-0                              1/1     Running   0          2m

# Check service endpoints
kubectl get svc -n activity-system

# Check Istio gateway
kubectl get gateway -n activity-system
kubectl get virtualservice -n activity-system
```

## Step 3: Verify Backend Health

### Test Backend API
```bash
# Health check
curl http://api.minibob.local/health

# Expected: {"status":"healthy","database":"connected","redis":"connected"}

# List activity templates
curl http://api.minibob.local/v2/activities/templates | jq .

# Check recommendations endpoint
curl -X POST http://api.minibob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"task_description":"add logging","limit":3}' | jq .
```

### Access Dashboard
```bash
open http://dashboard.minibob.local
```

You should see:
- Template performance metrics
- Execution history (initially empty)
- System health status
- Live activity monitoring

## Step 4: Configure OpenCode

### Verify OpenCode Configuration
Check that `repos/metabob-opencode/packages/opencode/opencode.json` has:

```json
{
  "minibob": {
    "enabled": true,
    "url": "http://api.minibob.local",
    "timeout": 30000,
    "fallback_to_local": true
  }
}
```

### Install MiniBob Library
```bash
cd repos/metabob-opencode/packages/opencode
bun install
```

This installs `@metabob/minibob` from the local file dependency.

### Verify Integration
```bash
cd repos/metabob-opencode/packages/opencode
bun run dev
```

In another terminal, test the goal tool:
```bash
# This will use OpenCode's MiniBob integration
# MiniBob will call backend for recommendations
# Backend will use Thompson Sampling based on execution history
```

## Step 5: Test End-to-End Integration

### Test 1: Simple Goal Execution
From OpenCode session:
```typescript
goal({
  goal: "Add a simple hello-world function to test.ts",
  context: {},
  maxActivities: 3,
  maxCost: 5
})
```

Expected flow:
1. OpenCode calls `MinibobIntegration.submitGoal()`
2. MiniBob initializes MCP client with `http://api.minibob.local`
3. GoalProcessor calls backend for recommendations
4. Backend returns activity templates via Thompson Sampling
5. MiniBob executes recommended activity
6. Results stored in SurrealDB
7. Execution visible in dashboard

### Test 2: Verify Backend Learning
```bash
# Check execution traces
curl http://api.minibob.local/v2/activities/executions | jq .

# Check template metrics
curl http://api.minibob.local/v2/activities/templates | jq '.templates[] | {id, name, success_rate, execution_count}'

# Check composition graph
curl http://api.minibob.local/v2/activities/composition/graph?limit=10 | jq .
```

## Step 6: Monitor System

### Dashboard Metrics
- **Template Success Rates**: Which activities work best
- **Execution Duration**: Performance over time
- **Cost Tracking**: USD per execution
- **Token Usage**: Input/output tokens
- **Thompson Sampling**: Selection probabilities

### Logs
```bash
# API logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# MiniBob logs (boredom activities)
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f

# Dashboard logs
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard -f

# SurrealDB logs
kubectl logs -n activity-system surrealdb-0 -f
```

### Database Queries
```bash
# Connect to SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# In another terminal, use surreal CLI or HTTP API
surreal sql --endpoint http://localhost:8000 \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password surrealdb-local-dev-123

# Query executions
SELECT * FROM execution ORDER BY timestamp DESC LIMIT 10;

# Query templates with metrics
SELECT * FROM activity_variant;
```

## Troubleshooting

### OpenCode Can't Connect to Backend
**Symptom**: "MCP Backend unavailable" or timeout errors

**Check**:
1. Backend is running: `kubectl get pods -n activity-system | grep activity-api`
2. Health endpoint: `curl http://api.minibob.local/health`
3. Istio gateway: `kubectl get gateway -n activity-system`
4. /etc/hosts has entry: `grep api.minibob.local /etc/hosts`

**Fix**:
```bash
# Restart backend
kubectl rollout restart deployment -n activity-system metabob-activity-api

# Check logs for errors
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50
```

### MiniBob Library Not Found
**Symptom**: "Cannot find module '@metabob/minibob'"

**Fix**:
```bash
cd repos/metabob-opencode/packages/opencode
rm -rf node_modules bun.lockb
bun install
```

### Thompson Sampling Returns No Recommendations
**Symptom**: Goal execution fails with "No recommendations found"

**Cause**: Database has no activity templates yet

**Fix**:
```bash
# Register some initial templates
cd repos/minibob
bun run src/bootstrap-templates.ts

# Or create templates manually via API
curl -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d @templates/add-function.json
```

### Dashboard Shows No Data
**Symptom**: Dashboard loads but shows empty charts

**Cause**: No executions have been recorded yet

**Fix**:
- Run a goal through OpenCode
- Wait 10-30 seconds for data to populate
- Refresh dashboard

### SurrealDB Connection Failed
**Symptom**: API logs show "SurrealDB connection error"

**Check**:
```bash
# Pod is running
kubectl get pod -n activity-system surrealdb-0

# Logs for errors
kubectl logs -n activity-system surrealdb-0 --tail=50

# Connection from API pod
kubectl exec -it -n activity-system \
  $(kubectl get pod -n activity-system -l app.kubernetes.io/name=metabob-activity-api -o name | head -1) \
  -- curl http://surrealdb:8000/health
```

**Fix**:
```bash
# Restart SurrealDB
kubectl delete pod -n activity-system surrealdb-0

# Wait for pod to restart
kubectl wait --for=condition=ready pod -n activity-system surrealdb-0 --timeout=120s
```

## Configuration Reference

### OpenCode MiniBob Config (`opencode.json`)
```json
{
  "minibob": {
    "enabled": true,                      // Enable MiniBob library integration
    "url": "http://api.minibob.local",    // Backend API endpoint
    "timeout": 30000,                     // Request timeout (ms)
    "fallback_to_local": true             // Fall back to local mode if backend unavailable
  }
}
```

### MiniBob MCP Initialization (`minibob-integration/index.ts`)
```typescript
const mcpEndpoint = config.minibob?.url || "http://api.minibob.local"

await initializeMCP({
  endpoint: mcpEndpoint,
  timeout: config.minibob?.timeout || 30000,
}, true) // skip health check during init
```

### Backend Environment Variables (Helm values)
```yaml
env:
  - name: SURREALDB_URL
    value: "http://surrealdb:8000"
  - name: SURREALDB_NAMESPACE
    value: "activity-system"
  - name: SURREALDB_DATABASE
    value: "learning_loop"
  - name: REDIS_URL
    value: "redis://redis-valkey:6379"
  - name: PORT
    value: "8080"
```

## Next Steps

1. **Create Activity Templates**: Define workflows for common tasks
2. **Run Goals Through OpenCode**: Build execution history for Thompson Sampling
3. **Monitor Learning**: Watch success rates improve over time
4. **Create Variants**: Use trailblazing to optimize failing activities
5. **Scale MiniBob**: Increase boredom worker replicas for parallel autonomous work

## Files Modified

- `repos/metabob-opencode/packages/opencode/opencode.json`: Added `minibob.url` configuration
- `OPENCODE_MINIBOB_INTEGRATION_FIX.md`: Documented the configuration fix and architecture

## Key Takeaways

✅ **OpenCode embeds MiniBob as a library** - not a separate service
✅ **Application code becomes composable** - OpenCode's tools available to activities
✅ **Backend handles learning** - Thompson Sampling based on execution history
✅ **Separation of concerns** - Execution (MiniBob) vs Storage/Learning (Backend)
✅ **Goal-first workflow** - User describes intent, backend recommends best activities
