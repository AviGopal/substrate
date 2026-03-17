# Activity System Quick Start Guide

## 🚀 Deploy in 5 Minutes

This guide gets you from zero to a running activity system with closed learning loop.

## Prerequisites Check

```bash
# Verify you have required tools
which kubectl helm helmfile docker

# Verify Kubernetes cluster is running
kubectl cluster-info

# Expected: Kubernetes control plane is running at ...
```

If any tool is missing, install:
- kubectl: https://kubernetes.io/docs/tasks/tools/
- helm: https://helm.sh/docs/intro/install/
- helmfile: https://github.com/helmfile/helmfile#installation
- docker: https://docs.docker.com/get-docker/

## Step 1: Build Images (2 minutes)

```bash
# Build metabob-activity-api
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

# Build minibob
cd ../minibob
docker build -t minibob:latest .

cd ../..
```

## Step 2: Deploy (1 minute)

```bash
# Deploy to local environment
ENVIRONMENT=local bash scripts/deploy-activity-system.sh

# The script will:
# ✓ Check prerequisites
# ✓ Build images
# ✓ Deploy via helmfile
# ✓ Wait for pods to be ready
# ✓ Run validation tests
```

## Step 3: Verify (1 minute)

```bash
# Check all pods are running
kubectl get pods -n activity-system

# Expected output:
# NAME                                    READY   STATUS    RESTARTS   AGE
# metabob-activity-api-xxxxxxxxx-xxxxx    1/1     Running   0          2m
# metabob-activity-api-xxxxxxxxx-xxxxx    1/1     Running   0          2m
# minibob-xxxxxxxxx-xxxxx                 1/1     Running   0          2m
# redis-master-0                          1/1     Running   0          2m
# surrealdb-0                             1/1     Running   0          2m

# Run validation
bash scripts/validate-activity-system.sh
```

## Step 4: Test (1 minute)

```bash
# Port-forward the activity API
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &

# Test health endpoint
curl http://localhost:8080/health

# Expected: {"status":"ok","service":"metabob-activity-api",...}

# Create a session
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: test-key")
echo $SESSION_RESPONSE

# Extract Bearer token
TOKEN=$(echo $SESSION_RESPONSE | jq -r '.token')

# List activity templates
curl -s http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## What You Just Deployed

```
┌────────────────────────────────────────┐
│     activity-system namespace          │
├────────────────────────────────────────┤
│                                        │
│  [Redis]      [SurrealDB]              │
│    Cache       Database                │
│                                        │
│  [Activity API]                        │
│    TypeScript REST API                 │
│    Port: 8080                          │
│                                        │
│  [minibob]                             │
│    Autonomous Vessel                   │
│    Boredom Tasks                       │
│                                        │
└────────────────────────────────────────┘
```

## Common Operations

### View Logs

```bash
# Activity API
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# minibob
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f

# SurrealDB
kubectl logs -n activity-system -l app=surrealdb -f
```

### Access Services

```bash
# Activity API (8080)
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080

# SurrealDB (8000)
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# minibob (8081)
kubectl port-forward -n activity-system svc/minibob 8081:8080

# Redis (6379)
kubectl port-forward -n activity-system svc/redis-master 6379:6379
```

### Query SurrealDB

```bash
# Port-forward SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &

# Query activity templates
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: application/json" \
  -u root:surrealdb123 \
  -d '{"query": "SELECT * FROM activity_variants LIMIT 5;"}'

# Query executions
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: application/json" \
  -u root:surrealdb123 \
  -d '{"query": "SELECT * FROM activity_executions ORDER BY timestamp DESC LIMIT 10;"}'
```

## Testing the Learning Loop

### 1. Create an Activity Template

```bash
# Create test template
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "test-activity",
    "variant_id": "test-v1",
    "name": "Test Activity",
    "description": "Simple test activity for validation",
    "category": "feature",
    "task_steps": [
      {
        "id": "step1",
        "description": "Test step",
        "prompt": "Echo test",
        "validation": {}
      }
    ]
  }'
```

### 2. Record an Execution

```bash
# Record successful execution
curl -X POST http://localhost:8080/v2/activities/executions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "exec-001",
    "activity_id": "test-activity",
    "variant_id": "test-v1",
    "success": true,
    "duration": 5000,
    "total_cost": 0.05,
    "total_tokens": {
      "input": 1000,
      "output": 500,
      "cache": 0
    }
  }'
```

### 3. Verify Thompson Sampling

```bash
# Get templates with scores
curl -s http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" | jq '.templates[] | {name, success_rate, recommendation_score}'

# You should see your template with updated metrics
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n activity-system

# Describe problematic pod
kubectl describe pod -n activity-system <pod-name>

# Check events
kubectl get events -n activity-system --sort-by='.lastTimestamp' | tail -20
```

### Connection Errors

```bash
# Verify services are up
kubectl get svc -n activity-system

# Check endpoints
kubectl get endpoints -n activity-system

# Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n activity-system -- \
  curl http://metabob-activity-api:8080/health
```

### Database Issues

```bash
# Check SurrealDB logs
kubectl logs -n activity-system -l app=surrealdb --tail=50

# Verify SurrealDB is accessible
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &
curl http://localhost:8000/health
```

## Clean Up

```bash
# Destroy everything
helmfile -f helm/helmfile-activity-minimal.yaml -e local destroy

# Delete namespace
kubectl delete namespace activity-system

# Remove persistent data
kubectl delete pvc -n activity-system --all
```

## Next Steps

1. **Read the full documentation**: [ACTIVITY_SYSTEM_DEPLOYMENT.md](ACTIVITY_SYSTEM_DEPLOYMENT.md)
2. **Test minibob integration**: Configure minibob to execute activities
3. **Explore the API**: Try all endpoints in [metabob-activity-api README](repos/metabob-activity-api/README.md)
4. **Monitor metrics**: Set up Prometheus/Grafana for observability
5. **Scale up**: Deploy to testing environment with more resources

## Getting Help

If something goes wrong:

1. Run validation: `bash scripts/validate-activity-system.sh`
2. Check logs: `kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api`
3. Verify connectivity: Port-forward and test endpoints
4. Review architecture: [ACTIVITY_SYSTEM_DEPLOYMENT.md](ACTIVITY_SYSTEM_DEPLOYMENT.md)

## Success Criteria

You know it's working when:

✅ All pods are `Running`  
✅ Health endpoints respond with `200 OK`  
✅ You can create sessions and get Bearer tokens  
✅ Templates can be created and retrieved  
✅ Executions are recorded in SurrealDB  
✅ Thompson Sampling scores update  
✅ minibob can poll for boredom tasks  

**Congratulations!** 🎉 You now have a fully functional activity system with closed learning loop.
