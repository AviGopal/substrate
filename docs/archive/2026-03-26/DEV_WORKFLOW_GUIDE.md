# Activity Dashboard Development Workflow

## Quick Start

The Activity Dashboard is now set up as a **live development environment** where you can:
1. Execute activities in MiniBob containers
2. See results in the dashboard immediately
3. Test API endpoints and hot-reload functionality

## Setup: Port-Forward Dashboard

```bash
# Start dashboard on localhost
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
```

**Dashboard URLs**:
- Main UI: http://localhost:3000
- Health: http://localhost:3000/health
- Templates API: http://localhost:3000/v2/activities/templates

## Development Workflows

### Workflow 1: Execute Activity in MiniBob

```bash
# Connect to MiniBob pod
kubectl exec -it -n testing-minibob \
  minibob-testing-cluster-minibob-cluster-6947d6546b-82spw \
  -- /bin/bash

# Inside the container:
cd /app

# View available templates
ls -la templates/

# Run an activity (example - check actual CLI commands in package.json)
bun run index.ts run templates/hello-world.json

# Or use the start command
bun start
```

**Available Templates**:
- `hello-world.json` - Simple echo test
- `demo-nested-execution.json` - Nested activity execution
- `self-improve.json` - Self-improvement activity

### Workflow 2: Test Dashboard API

```bash
# Get all templates
curl http://localhost:3000/v2/activities/templates | jq '.'

# Get specific template
curl http://localhost:3000/v2/activities/templates/generate-greeting | jq '.'

# Check health
curl http://localhost:3000/health | jq '.'
```

### Workflow 3: Monitor Real-Time Updates

```bash
# Terminal 1: Port-forward dashboard
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000

# Terminal 2: Watch dashboard logs
kubectl logs -n activity-system deployment/activity-dashboard -f

# Terminal 3: Execute MiniBob activity
kubectl exec -it -n testing-minibob \
  minibob-testing-cluster-minibob-cluster-6947d6546b-82spw \
  -- bun run index.ts run templates/hello-world.json

# Terminal 4: Watch API logs
kubectl logs -n activity-system deployment/metabob-activity-api -f
```

### Workflow 4: Test Dashboard Hot-Reload

When you modify dashboard code and rebuild:

```bash
# 1. Make changes to dashboard code
vim repos/activity-dashboard/src/index.ts

# 2. Rebuild Docker image
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .

# 3. Restart deployment (image pull policy is IfNotPresent, so new image is loaded)
kubectl rollout restart deployment/activity-dashboard -n activity-system
kubectl rollout status deployment/activity-dashboard -n activity-system

# 4. Check logs to verify changes
kubectl logs -n activity-system deployment/activity-dashboard --tail=20

# 5. Test in browser
curl http://localhost:3000/health
# or open in browser: http://localhost:3000
```

## Helper Scripts

### dev-dashboard.sh

Located at: `scripts/dev-dashboard.sh`

```bash
# Show help
./scripts/dev-dashboard.sh help

# Port-forward dashboard
./scripts/dev-dashboard.sh forward

# Open shell in dashboard pod
./scripts/dev-dashboard.sh exec

# Open shell in MiniBob pod
./scripts/dev-dashboard.sh minibob

# Follow dashboard logs
./scripts/dev-dashboard.sh logs

# Restart dashboard
./scripts/dev-dashboard.sh restart

# Run full test
./scripts/dev-dashboard.sh test

# Start everything (port-forward + logs)
./scripts/dev-dashboard.sh all
```

### test-minibob-dashboard-integration.sh

Located at: `scripts/test-minibob-dashboard-integration.sh`

Tests the complete data flow:
```bash
./scripts/test-minibob-dashboard-integration.sh
```

## MiniBob Container Details

**Namespace**: `testing-minibob`

**Pod Names**:
- `minibob-testing-cluster-minibob-cluster-6947d6546b-82spw`
- `minibob-testing-cluster-minibob-cluster-6947d6546b-ql7mz`
- `minibob-testing-cluster-minibob-cluster-6947d6546b-shfnf`

**Working Directory**: `/app`

**MCP Configuration**: `/app/opencode.json`
```json
{
  "metabob": {
    "type": "mcp",
    "endpoint": "http://api.metabob.local/mcp",
    "capabilities": ["activities", "impulses", "git", "acp-gossip", "boredom"]
  }
}
```

**Package.json Scripts**:
```json
{
  "start": "bun run index.ts",
  "dev": "bun --watch run index.ts",
  "test": "bun test",
  "run-activity": "bun run index.ts run"
}
```

## Dashboard Container Details

**Namespace**: `activity-system`

**Deployment**: `activity-dashboard`

**Service**: `activity-dashboard` (ClusterIP, port 3000)

**Environment Variables**:
- `ACTIVITY_API_URL`: `http://metabob-activity-api.activity-system.svc.cluster.local:8080`
- `NODE_ENV`: `production`
- `PORT`: `3000`

**File Structure**:
```
/app/
├── dist/               # Built frontend assets
│   ├── index.html
│   ├── chunk-*.js      # JavaScript bundles
│   └── chunk-*.css     # CSS bundles
├── src/
│   ├── index.ts        # Bun server (API proxy + static file serving)
│   ├── lib/
│   │   └── api-client.ts
│   └── components/
├── node_modules/
└── package.json
```

## Testing Strategies

### 1. Manual Browser Testing

```bash
# Start port-forward
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000

# Open in browser
open http://localhost:3000

# Or use curl to test endpoints
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/v2/activities/templates
```

### 2. API Integration Testing

```bash
# Test template registration
curl -X POST http://localhost:3000/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d @test-template.json

# Test execution recording
curl -X POST http://localhost:3000/v2/activities/executions \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "hello-world",
    "success": true,
    "duration": 5000,
    "cost": 0.001
  }'
```

### 3. End-to-End Testing

```bash
# Run the integration test script
./scripts/test-minibob-dashboard-integration.sh

# This will:
# 1. Get baseline template count
# 2. Execute activity in MiniBob
# 3. Check for new templates
# 4. Verify data flow
```

## Debugging

### Dashboard Not Loading

```bash
# Check pod status
kubectl get pods -n activity-system -l app=activity-dashboard

# Check logs for errors
kubectl logs -n activity-system deployment/activity-dashboard --tail=50

# Check if port-forward is running
netstat -an | grep 3000

# Test health endpoint
curl http://localhost:3000/health
```

### API Proxy Not Working

```bash
# Check if backend API is accessible from dashboard
kubectl exec -n activity-system deployment/activity-dashboard -- \
  wget -O- http://metabob-activity-api:8080/health

# Check dashboard logs for proxy errors
kubectl logs -n activity-system deployment/activity-dashboard -f | grep Proxy
```

### MiniBob Activities Not Registering

```bash
# Check MiniBob logs
kubectl logs -n testing-minibob \
  minibob-testing-cluster-minibob-cluster-6947d6546b-82spw

# Check API logs
kubectl logs -n activity-system deployment/metabob-activity-api -f

# Check database
kubectl exec -n activity-system surrealdb-0 -- \
  /surreal sql --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace activity-system --database learning_loop \
  "SELECT * FROM activity_template"
```

## Common Tasks

### Add a New Template to MiniBob

```bash
# 1. Create template JSON file locally
cat > new-template.json << 'EOF'
{
  "id": "my-new-activity",
  "name": "My New Activity",
  "description": "Does something cool",
  "category": "feature",
  "tasks": [...]
}
EOF

# 2. Copy to MiniBob pod
kubectl cp new-template.json testing-minibob/minibob-testing-cluster-minibob-cluster-6947d6546b-82spw:/app/templates/

# 3. Execute the template
kubectl exec -n testing-minibob \
  minibob-testing-cluster-minibob-cluster-6947d6546b-82spw -- \
  bun run index.ts run templates/new-template.json
```

### Update Dashboard Code

```bash
# 1. Edit code
vim repos/activity-dashboard/src/index.ts

# 2. Rebuild
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .

# 3. Restart
kubectl rollout restart deployment/activity-dashboard -n activity-system

# 4. Wait for rollout
kubectl rollout status deployment/activity-dashboard -n activity-system

# 5. Test changes
curl http://localhost:3000/health
```

### Query Database Directly

```bash
# Get pod name
DB_POD=$(kubectl get pods -n activity-system -l app=surrealdb -o jsonpath='{.items[0].metadata.name}')

# Query templates
kubectl exec -n activity-system $DB_POD -- \
  /surreal sql --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace activity-system --database learning_loop \
  "SELECT * FROM activity_template"

# Query executions
kubectl exec -n activity-system $DB_POD -- \
  /surreal sql --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace activity-system --database learning_loop \
  "SELECT * FROM activity_executions"
```

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    Developer Machine                      │
│                                                            │
│  Terminal 1: kubectl port-forward (localhost:3000)        │
│  Terminal 2: kubectl logs (dashboard)                     │
│  Terminal 3: kubectl exec (MiniBob)                       │
│  Browser: http://localhost:3000                           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│              Kubernetes Cluster (Docker Desktop)          │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  testing-minibob namespace                          │ │
│  │                                                       │ │
│  │  MiniBob Pods (3 replicas)                          │ │
│  │  - Execute activities                                │ │
│  │  - Register templates via MCP                        │ │
│  │  - Record executions                                 │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                          │
│                 │ MCP/API calls                            │
│                 ▼                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  activity-system namespace                          │ │
│  │                                                       │ │
│  │  ┌────────────────────┐    ┌───────────────────┐   │ │
│  │  │ Dashboard          │◄───┤ Activity API      │   │ │
│  │  │ (Bun server)       │    │ (Express)         │   │ │
│  │  │ - Serve React app  │    │ - REST endpoints  │   │ │
│  │  │ - Proxy API calls  │    └─────────┬─────────┘   │ │
│  │  └────────────────────┘              │             │ │
│  │                                       │             │ │
│  │                                       ▼             │ │
│  │                              ┌────────────────┐    │ │
│  │                              │ SurrealDB      │    │ │
│  │                              │ - Templates    │    │ │
│  │                              │ - Executions   │    │ │
│  │                              │ - Metrics      │    │ │
│  │                              └────────────────┘    │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Next Steps

1. **Implement GET /v2/activities/executions endpoint** in Activity API
2. **Add WebSocket support** for real-time dashboard updates
3. **Create more MiniBob templates** for testing various scenarios
4. **Build dashboard UI components** to display execution history
5. **Add authentication** to dashboard and API
6. **Set up automated tests** using the helper scripts

## Resources

- **Dashboard Code**: `repos/activity-dashboard/`
- **Activity API Code**: `repos/metabob-activity-api/`
- **MiniBob Code**: MiniBob container `/app/`
- **Helper Scripts**: `scripts/dev-dashboard.sh`, `scripts/test-minibob-dashboard-integration.sh`
- **Deployment Summary**: `DASHBOARD_DEPLOYMENT_COMPLETE.md`
