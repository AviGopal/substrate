# Activity System - Quick Start Guide

## Stack Overview

**Minimal Spec Stack**: 3 vessels + 2 infrastructure services

```
┌─────────────────────────────────────────────────────┐
│              activity-system namespace               │
│                                                       │
│  ┌─────────────┐    ┌──────────────────┐            │
│  │  Dashboard  │───▶│  Activity API    │            │
│  │  (React)    │    │  (Hono + TS)     │            │
│  │  :3000      │    │  :8080           │            │
│  └─────────────┘    └────────┬─────────┘            │
│                              │                       │
│                    ┌─────────┴─────────┐            │
│                    │                   │             │
│              ┌─────▼────┐      ┌──────▼──────┐     │
│              │  Redis   │      │  SurrealDB  │     │
│              │  Cache   │      │  Database   │     │
│              └──────────┘      └─────────────┘     │
│                                                      │
│  ┌─────────────────┐                                │
│  │  MiniBob Vessel │                                │
│  │  (Autonomous)   │                                │
│  │  :8080          │                                │
│  └─────────────────┘                                │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Desktop with Kubernetes enabled
- kubectl configured (context: docker-desktop)
- Anthropic API key
- Helm 3.x
- Helmfile

## Deploy Stack (5 minutes)

### 1. Set API Key
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### 2. Deploy with Helmfile
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

helmfile -f helm/helmfile-activity-minimal.yaml \
  --state-values-file helm/secrets/local.yaml \
  -e local apply
```

### 3. Verify Deployment
```bash
kubectl get pods -n activity-system
```

Expected output:
```
NAME                                       READY   STATUS
activity-dashboard-xxxxx                   1/1     Running
metabob-activity-api-xxxxx                 1/1     Running
minibob-minibob-cluster-xxxxx              1/1     Running
redis-master-0                             1/1     Running
surrealdb-0                                1/1     Running
```

### 4. Port Forward Services
```bash
# Dashboard
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000 &

# API
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &
```

### 5. Access Services
- **Dashboard**: http://localhost:3000
- **API Health**: http://localhost:8080/health

## Execute Your First Activity (2 minutes)

### Create a Simple Template

```bash
cat > /tmp/my-first-activity.json << 'EOF'
{
  "id": "my-first-activity",
  "name": "My First Activity",
  "description": "A simple activity to get started",
  "category": "tool",
  "tasks": [
    {
      "id": "task-1",
      "description": "Say hello",
      "prompt": {
        "template": "Output a friendly greeting: 'Hello! I am the activity system, and I am operational!'",
        "maxTokens": 256
      }
    }
  ]
}
EOF
```

### Copy to MiniBob

```bash
POD_NAME=$(kubectl get pods -n activity-system -l app=minibob-cluster -o jsonpath='{.items[0].metadata.name}')

kubectl cp /tmp/my-first-activity.json \
  activity-system/$POD_NAME:/app/templates/my-first-activity.json
```

### Execute the Template

```bash
kubectl exec -n activity-system deployment/minibob-minibob-cluster -- \
  bun run /app/index.ts run /app/templates/my-first-activity.json \
  --reason "My first activity execution"
```

Expected output:
```
[Activity] Starting: My First Activity (act_xxxxx)
>>> Starting task: task-1
✓ Completed task: task-1
[Activity] Completed: completed in ~1500ms
=== Activity Result ===
Status: completed
Duration: ~1500ms
Tokens: ~1600 in / ~15 out
Cost: ~$0.005
```

✅ **Success!** You've executed your first activity!

## Pre-Loaded Templates

MiniBob includes 8 ready-to-use templates in `/app/templates/`:

| Template | Purpose |
|----------|---------|
| `simple-test.json` | ✅ Minimal execution test (works perfectly) |
| `hello-world.json` | Basic execution with tool calling |
| `demo-nested-execution.json` | Nested activity demonstration |
| `self-improve.json` | Self-development capabilities |
| `test-acp-delegation.json` | Vessel-to-vessel communication |
| `test-activity-impulse.json` | Context sharing via impulses |
| `test-nested-activities.json` | Complex activity composition |
| `test-self-improvement.json` | Advanced self-improvement |

### Execute a Pre-Loaded Template

```bash
kubectl exec -n activity-system deployment/minibob-minibob-cluster -- \
  bun run /app/index.ts run /app/templates/simple-test.json \
  --reason "Testing pre-loaded template"
```

## Common Commands

### Check Status
```bash
# Pod health
kubectl get pods -n activity-system

# Service endpoints
kubectl get svc -n activity-system

# API health
curl -s http://localhost:8080/health | jq .
```

### View Logs
```bash
# MiniBob execution logs
kubectl logs -n activity-system deployment/minibob-minibob-cluster --tail=50

# API logs
kubectl logs -n activity-system deployment/metabob-activity-api --tail=50

# Dashboard logs
kubectl logs -n activity-system deployment/activity-dashboard --tail=50
```

### List Templates
```bash
kubectl exec -n activity-system deployment/minibob-minibob-cluster -- \
  ls -la /app/templates/
```

### Add Custom Template
```bash
# 1. Create template file locally
cat > /tmp/my-template.json << 'EOF'
{
  "id": "my-template",
  "name": "My Custom Template",
  "description": "Description here",
  "category": "tool",
  "tasks": [
    {
      "id": "task-1",
      "description": "Task description",
      "prompt": {
        "template": "Your prompt here",
        "maxTokens": 512
      }
    }
  ]
}
EOF

# 2. Copy to minibob
POD=$(kubectl get pods -n activity-system -l app=minibob-cluster -o jsonpath='{.items[0].metadata.name}')
kubectl cp /tmp/my-template.json activity-system/$POD:/app/templates/my-template.json

# 3. Execute
kubectl exec -n activity-system deployment/minibob-minibob-cluster -- \
  bun run /app/index.ts run /app/templates/my-template.json \
  --reason "Testing my custom template"
```

## Troubleshooting

### Pod Not Starting
```bash
# Check events
kubectl get events -n activity-system --sort-by='.lastTimestamp' | tail -20

# Describe pod
kubectl describe pod -n activity-system <pod-name>
```

### API Not Responding
```bash
# Check health
curl -s http://localhost:8080/health | jq .

# Check logs
kubectl logs -n activity-system deployment/metabob-activity-api
```

### MiniBob Execution Fails
```bash
# Check logs
kubectl logs -n activity-system deployment/minibob-minibob-cluster --tail=100

# Verify template exists
kubectl exec -n activity-system deployment/minibob-minibob-cluster -- \
  cat /app/templates/<template-name>.json
```

### Port Forward Issues
```bash
# Kill existing port forwards
pkill -f "port-forward"

# Restart port forwards
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000 &
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &
```

## Clean Up

### Remove Deployment
```bash
helmfile -f helm/helmfile-activity-minimal.yaml -e local destroy
```

### Delete Namespace
```bash
kubectl delete namespace activity-system
```

## Next Steps

1. **Create More Templates**: Build a library of useful activities
2. **Explore Dashboard**: Monitor executions in real-time
3. **Test Nested Execution**: Try `demo-nested-execution.json`
4. **Self-Improvement**: Run `self-improve.json` to see MiniBob improve itself
5. **Custom Workflows**: Combine multiple activities

## Current Limitations

- **Tool Calling**: Complex tool-based templates have message format issues (in progress)
- **Backend Reporting**: MCP endpoint not yet implemented (activities execute but don't persist)
- **Dashboard Data**: API v2 endpoints not fully implemented (dashboard UI works but needs data)
- **Learning Loop**: Thompson Sampling requires execution persistence (coming soon)

**Status**: Core execution works! Integration layer in progress.

## Resources

- **Deployment Guide**: `helm/README-activity-system.md`
- **Full Demo Plan**: `ACTIVITY_SYSTEM_DEMONSTRATION_PLAN.md`
- **Technical Summary**: `ACTIVITY_SYSTEM_DEMONSTRATION_SUMMARY.md`
- **Success Report**: `ACTIVITY_SYSTEM_DEMONSTRATION_COMPLETE.md`

## Support

For issues or questions:
1. Check logs: `kubectl logs -n activity-system <pod-name>`
2. Verify health: `curl http://localhost:8080/health`
3. Review documentation in this repository

---

**Stack Version**: Minimal Spec v1.0  
**Status**: Operational - Integration in Progress  
**Last Updated**: March 17, 2026
