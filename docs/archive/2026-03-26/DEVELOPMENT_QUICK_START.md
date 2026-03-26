# Development Quick Start: Using MiniBob for Everything

**TL;DR**: Submit goals to MiniBob, watch dashboard, deploy results. MiniBob develops the system autonomously.

---

## The Self-Development Loop in 3 Steps

### 1. Submit a Development Goal

```bash
./submit-self-improvement-goals.sh
```

Or directly via API:

```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add vessel heartbeat sender to MiniBob",
    "priority": "high"
  }'
```

### 2. Observe Development

**Dashboard**: http://dashboard.minibob.local

- **Executions Tab**: Watch MiniBob work through tasks
- **Vessels Tab**: See which pod is executing
- **Variants Tab**: Track feature branches and Thompson scores

**Logs**:
```bash
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
```

### 3. Deploy Results

**Automatic** (when Thompson score > 0.8):
- CI validates
- Staging deploys
- Metrics collected
- Promoted to production

**Manual** (if needed):
```bash
# Check what was created
cd repos/minibob
git log --oneline -5

# Build and deploy
docker build -t minibob:latest .
kubectl set image deployment/minibob-devbob \
  -n activity-system \
  minibob=minibob:latest
```

---

## Repository Structure

```
metabob-devbob/
├─ repos/                              # All code repositories
│  ├─ minibob/                         # MiniBob vessel
│  ├─ activity-dashboard/              # Observability UI
│  └─ metabob-activity-api/            # Learning backend
│
├─ helm/                               # Kubernetes deployment
│  ├─ charts/                          # Helm charts
│  └─ helmfile-activity-system.yaml    # Main deployment
│
├─ SELF_DEVELOPMENT_WORKFLOW.md        # Complete guide
├─ DASHBOARD_DATA_VALIDATION_REPORT.md # Current status
├─ READY_TO_OBSERVE.md                 # Quick start
└─ submit-self-improvement-goals.sh    # Goal submission script
```

---

## How MiniBob Accesses Code

### In Kubernetes (Production)

MiniBob pods have access to repositories via:

**Option 1: PersistentVolumeClaim** (configured):
```yaml
# helm/charts/devbob/values.yaml
repositories:
  persistence:
    enabled: true
    size: 20Gi
  repos:
    - url: https://github.com/metabob-labs/metabob-devbob.git
      path: /repos/metabob-devbob
```

**Inside Pod**:
```bash
# MiniBob sees
/repos/
  └─ metabob-devbob/
      ├─ repos/minibob/
      ├─ repos/activity-dashboard/
      └─ repos/metabob-activity-api/

# Activity template specifies
"repository": "metabob-devbob",
"repoPath": "/repos/metabob-devbob/repos/minibob"
```

### Locally (Development)

You work in the same directory structure:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Standard git workflow
cd repos/minibob
git checkout -b feature/my-feature
# make changes
git commit -m "feat: add feature"
git push origin feature/my-feature

# Or let MiniBob do it
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add my feature to MiniBob"
}'
```

---

## Development Workflows

### Workflow 1: Fix a Bug (via MiniBob)

```bash
# 1. Submit goal
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Fix session.org_id null reference in code-variants.ts",
  "priority": "critical"
}'

# 2. Watch dashboard → Executions tab
# See tasks completing:
# ✓ Create branch: bugfix/code-variants-session
# ✓ Read file and understand error
# ✓ Implement fix: Make org_id optional
# ✓ Typecheck: Pass
# ✓ Add test: Test null case
# ✓ Commit: "fix: handle null session.org_id"
# ✓ Push: origin/bugfix/code-variants-session

# 3. CI runs automatically (GitHub Actions)
# 4. Thompson Sampling evaluates
# 5. Auto-deployed when score > 0.8

# 6. Verify
curl "http://api.minibob.local/v2/activities/code-variants" | jq .
# Should work without error
```

**Time**: 5 minutes
**Your effort**: Submit goal only

### Workflow 2: Add a Feature (via MiniBob)

```bash
# Submit detailed goal
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add vessel heartbeat sender to MiniBob",
  "priority": "high",
  "context": {
    "new_file": "src/heartbeat.ts",
    "integrate_into": "src/index.ts",
    "endpoint": "POST /v2/vessels/heartbeat",
    "interval": 30000
  }
}'

# MiniBob will:
# 1. Create src/heartbeat.ts with HeartbeatSender class
# 2. Update src/index.ts to initialize sender
# 3. Add tests
# 4. Validate typecheck and tests pass
# 5. Commit and push

# You verify in dashboard:
# - Vessels tab now shows MiniBob pods
# - Heartbeats updating every 30s
```

### Workflow 3: Manual Development (when you want control)

```bash
# Standard git workflow
cd repos/activity-dashboard
git checkout -b feature/dark-mode

# Make changes
# Edit src/App.tsx, src/index.css

# Test locally
bun run dev
open http://localhost:3000

# Commit
git add .
git commit -m "feat: add dark mode toggle

Adds theme toggle in header with localStorage persistence

Co-Authored-By: Human Developer <you@example.com>"

# Push
git push origin feature/dark-mode

# Create PR (or let CI auto-merge if configured)
gh pr create --title "Add dark mode toggle" --body "Adds dark mode support"
```

### Workflow 4: Review MiniBob's Work

```bash
# Check what MiniBob created
cd repos/metabob-activity-api
git log --oneline --author="MiniBob" -10

# View specific commit
git show abc123

# If you want to modify
git checkout bugfix/code-variants-session
# make changes
git commit -m "refactor: improve MiniBob's fix"
git push origin bugfix/code-variants-session
```

---

## Commit & Build

### Automated (MiniBob)

**Commits follow Conventional Commits**:
```
feat: add vessel heartbeat sender
fix: resolve session.org_id null reference
refactor: extract Card component
docs: update development workflow guide
test: add integration tests for heartbeats

Co-Authored-By: MiniBob <minibob@metabob.local>
```

**Builds triggered by CI**:
```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: ['feature/**', 'bugfix/**']
jobs:
  build:
    - bun run typecheck
    - bun test
    - docker build -t $IMAGE:$SHA .
    - docker push $IMAGE:$SHA
```

### Manual (You)

**Build locally**:
```bash
cd repos/activity-dashboard
bun run build    # Creates dist/
docker build -t activity-dashboard:my-tag .
```

**Deploy to cluster**:
```bash
kubectl set image deployment/activity-dashboard \
  -n activity-system \
  activity-dashboard=activity-dashboard:my-tag

kubectl rollout status deployment/activity-dashboard -n activity-system
```

---

## Deploy

### Local Development Cluster

**Full system**:
```bash
cd helm
helmfile -f helmfile-activity-system.yaml sync
```

**Individual component**:
```bash
helm upgrade --install activity-dashboard \
  ./charts/activity-dashboard \
  --namespace activity-system \
  --create-namespace \
  --set image.tag=latest
```

### Staging (Automatic)

Triggered by code-change activity after CI passes:
1. Build staging image
2. Deploy to staging namespace
3. Run health checks
4. Collect metrics (5 minutes)
5. Report to Thompson Sampling

### Production (Automatic when score > 0.8)

1. Tag production release
2. Update Helm values
3. Deploy with zero-downtime rollout
4. Verify health checks
5. Monitor metrics

### Manual Override

```bash
# Force deploy specific version
helm upgrade activity-dashboard \
  ./charts/activity-dashboard \
  --namespace production \
  --set image.tag=v1.2.3 \
  --reuse-values

# Rollback if needed
helm rollback activity-dashboard -n production
```

---

## Test & Validate

### During Development (Automatic)

MiniBob validates in activity templates:
```json
{
  "validation": {
    "commands": ["bun run typecheck", "bun test"],
    "requiredFiles": ["src/components/VesselStatus.tsx"],
    "forbiddenPatterns": [
      {"file": "**/*.ts", "pattern": "@ts-ignore"}
    ]
  }
}
```

### After Push (CI)

GitHub Actions runs:
```bash
bun install
bun run typecheck   # TypeScript compilation
bun test            # Unit tests
bun run build       # Production build
docker build .      # Image build
```

### Before Promotion (Staging)

Automated checks:
- Health endpoint returns 200
- Error rate < 1%
- Response time P95 < 500ms
- No critical errors in logs

### Manual Testing

```bash
# Unit tests
cd repos/minibob
bun test

# Integration tests
bun run test-minibob-integration.ts

# E2E tests (Playwright)
bun run test-dashboard-validation.ts

# Manual testing
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
open http://localhost:3000
```

---

## Using MiniBob for ALL Development

### Current Available Goals

```bash
# Check what's already queued
curl "http://api.minibob.local/v2/activities/boredom/queue" | jq .
# Shows: 9 tasks (7 critical, 2 low)
```

### Submit Your Own Goals

**Simple**:
```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add health endpoint to dashboard"
}'
```

**Detailed** (better results):
```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add /metrics endpoint to dashboard that returns Prometheus-style metrics",
  "priority": "medium",
  "context": {
    "repo": "activity-dashboard",
    "new_endpoint": "/metrics",
    "format": "Prometheus text format",
    "metrics": [
      "http_requests_total{method, path, status}",
      "http_request_duration_seconds{method, path}",
      "http_active_connections"
    ],
    "implementation": "Add metrics middleware to src/index.ts"
  }
}'
```

### Use the Helper Script

```bash
./submit-self-improvement-goals.sh

# Interactive menu:
# 1) Fix all dashboard data issues
# 2) Add execution trace creation
# 3) Implement vessel heartbeats
# 4) Fix code-variants error
# 5) Add dark mode
# 6) Custom goal
# 7) Submit all critical fixes
```

---

## Monitoring Development

### Dashboard (Recommended)

**URL**: http://dashboard.minibob.local

**Tabs to watch**:
1. **Executions**: See task-by-task progress
2. **Vessels**: Which pod is working on what
3. **Variants**: Thompson scores for feature branches
4. **Library**: Available activity templates

### API

```bash
# Recent executions
curl "http://api.minibob.local/v2/activities/execution-traces?limit=5" | jq .

# Queue status
curl "http://api.minibob.local/v2/activities/boredom/queue" | jq .

# Code variants
curl "http://api.minibob.local/v2/activities/code-variants" | jq .
```

### Logs

```bash
# MiniBob execution logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f

# API logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# Dashboard logs
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard -f
```

### Git

```bash
# See what MiniBob created
cd repos/minibob
git log --oneline --author="MiniBob" -10

# Check feature branches
git branch -r | grep feature/

# View specific changes
git show origin/feature/vessel-heartbeat
```

---

## Quick Commands Reference

```bash
# Submit goal
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -d '{"goal": "YOUR_GOAL", "priority": "high"}'

# Check queue
curl "http://api.minibob.local/v2/activities/boredom/queue" | jq .

# Watch executions
curl "http://api.minibob.local/v2/activities/execution-traces?limit=5" | jq .

# Build & deploy
docker build -t IMAGE:TAG repos/COMPONENT/
kubectl set image deployment/DEPLOYMENT -n activity-system CONTAINER=IMAGE:TAG
kubectl rollout status deployment/DEPLOYMENT -n activity-system

# Test
cd repos/COMPONENT && bun test

# Monitor
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
open http://dashboard.minibob.local
```

---

## What's Next?

### Immediate Actions (Let MiniBob do them!)

```bash
# Use the helper script
./submit-self-improvement-goals.sh

# Select option 7: Submit all critical fixes
# This will submit:
# 1. Fix code-variants session.org_id error
# 2. Add execution trace creation
# 3. Implement vessel heartbeats

# Then watch the dashboard and observe MiniBob fixing itself!
```

### Future Enhancements (Submit as goals!)

- Add CI webhook integration for automatic Thompson Sampling updates
- Implement K8s API integration for vessel monitoring
- Add visual regression testing with Playwright
- Create more activity templates for common patterns
- Add metrics collection and alerting
- Implement automatic rollback on degraded performance

---

## Key Insights

1. **Submit goals, not code**: Describe what you want, let MiniBob implement
2. **Observe, don't micromanage**: Dashboard shows everything happening
3. **Trust Thompson Sampling**: It learns which variants work best
4. **Iterate quickly**: Submit, observe, refine goals based on results
5. **Let the system improve itself**: MiniBob can fix its own bugs!

---

**The system develops itself. You just guide it.** 🚀

For complete details, see [SELF_DEVELOPMENT_WORKFLOW.md](SELF_DEVELOPMENT_WORKFLOW.md)
