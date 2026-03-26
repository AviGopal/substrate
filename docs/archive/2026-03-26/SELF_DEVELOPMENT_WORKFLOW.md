# Self-Development Workflow: Using MiniBob to Develop the System

**Last Updated**: 2026-03-22

This guide explains how to use MiniBob to autonomously develop the activity system, dashboard, and MiniBob itself - creating a self-improving development loop.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Structure](#repository-structure)
3. [Embedding MiniBob in Codebases](#embedding-minibob-in-codebases)
4. [Development Workflow](#development-workflow)
5. [Commit and Build Process](#commit-and-build-process)
6. [Deployment Pipeline](#deployment-pipeline)
7. [Testing and Validation](#testing-and-validation)
8. [Using MiniBob for All Development](#using-minibob-for-all-development)

---

## Architecture Overview

### The Self-Improving Loop

```
┌─────────────────────────────────────────────────────────────┐
│  INSTRUCTIONAL STATE (Git Repositories)                     │
│  ├─ metabob-devbob/                                         │
│  │  ├─ repos/minibob/              (MiniBob vessel)         │
│  │  ├─ repos/activity-dashboard/   (Observability UI)       │
│  │  ├─ repos/metabob-activity-api/ (Learning backend)       │
│  │  └─ helm/                        (Deployment config)     │
│  └─ Remote: github.com/metabob-labs/metabob-devbob.git      │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Boredom activity triggered
┌─────────────────────────────────────────────────────────────┐
│  TRANSIENT STATE (MiniBob Execution)                        │
│  ├─ MiniBob Pod (in activity-system namespace)              │
│  │  ├─ Clones repos to /repos                               │
│  │  ├─ Executes code-change activity                        │
│  │  ├─ Creates feature branch                               │
│  │  ├─ Implements feature                                   │
│  │  ├─ Validates (typecheck, tests)                         │
│  │  └─ Commits & pushes                                     │
│  └─ Observable in: Dashboard Executions & Vessels tabs      │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Code pushed to branch
┌─────────────────────────────────────────────────────────────┐
│  FUNCTIONAL STATE (Feature Branch + Metrics)                │
│  ├─ GitHub: feature/metrics-endpoint branch                 │
│  ├─ Execution Trace: Stored in SurrealDB                    │
│  ├─ CI Triggered: GitHub Actions runs tests                 │
│  └─ Observable in: Dashboard Variants tab                   │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Thompson Sampling evaluation
┌─────────────────────────────────────────────────────────────┐
│  EVALUATION & PROMOTION                                     │
│  ├─ CI passes → Thompson score increases                    │
│  ├─ Staging deploy → Metrics collected                      │
│  ├─ Thompson decides: Promote or reject                     │
│  └─ If promoted: Merge to main, deploy production           │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Loop closes
┌─────────────────────────────────────────────────────────────┐
│  NEW INSTRUCTIONAL STATE                                    │
│  ├─ Updated code in main branch                             │
│  ├─ New Docker images built                                 │
│  ├─ Deployed to production                                  │
│  └─ New activity templates extracted (Ribosome)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

### Main Repository: metabob-devbob

```
metabob-devbob/
├─ repos/                          # All project repositories
│  ├─ minibob/                     # MiniBob vessel (TypeScript/Bun)
│  │  ├─ src/                      # Source code
│  │  ├─ templates/                # Activity templates
│  │  │  ├─ code-change-feature.json
│  │  │  ├─ code-change-bugfix.json
│  │  │  └─ staging-deploy.json
│  │  ├─ package.json
│  │  ├─ Dockerfile
│  │  └─ README.md
│  │
│  ├─ activity-dashboard/          # Observability UI (React/Bun)
│  │  ├─ src/
│  │  │  ├─ components/            # Dashboard components
│  │  │  ├─ lib/                   # API client, types
│  │  │  └─ index.ts               # Bun server
│  │  ├─ package.json
│  │  ├─ Dockerfile
│  │  └─ README.md
│  │
│  └─ metabob-activity-api/        # Learning backend (TypeScript/Bun)
│     ├─ src/
│     │  ├─ routes/                # API endpoints
│     │  ├─ db/                    # Database clients
│     │  └─ services/              # Business logic
│     ├─ sql/                      # SurrealDB schemas
│     ├─ package.json
│     ├─ Dockerfile
│     └─ README.md
│
├─ helm/                           # Kubernetes deployment
│  ├─ charts/
│  │  ├─ devbob/                   # MiniBob deployment
│  │  ├─ metabob-activity-api/     # API deployment
│  │  └─ activity-dashboard/       # Dashboard deployment
│  └─ helmfile-activity-system.yaml
│
├─ CLAUDE.md                       # Project instructions
├─ READY_TO_OBSERVE.md             # Quick start guide
└─ README.md
```

### Git Configuration

```bash
# Main repo remote
origin → git@github.com:metabob-labs/metabob-devbob.git

# Current branch
prompts/metabob-devbob-mlpu1y8l

# Commit strategy
- Main branch: Production-ready code
- Feature branches: Development work
- MiniBob creates: feature/*, bugfix/*, refactor/*
```

---

## Embedding MiniBob in Codebases

### Option 1: Boredom Activities (Recommended for Self-Development)

MiniBob runs autonomously when idle, picking up development tasks from the boredom queue.

**How it works**:
1. MiniBob pods detect boredom (5+ minutes idle)
2. Query boredom API for tasks
3. Execute code-change activities
4. Submit results back

**Current Setup**:
```bash
# Check current boredom queue
curl "http://api.minibob.local/v2/activities/boredom/queue"
# Returns: {"total":9,"byPriority":{"critical":7,"high":0,"medium":0,"low":2}}

# Submit a new development goal
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add execution trace creation to MiniBob after each activity completes",
    "priority": "high",
    "context": {
      "repo": "minibob",
      "files": ["src/activity.ts"],
      "endpoint": "POST /v2/activities/execution-traces"
    }
  }'
```

**Configuration** (in `helm/charts/devbob/values.yaml`):
```yaml
# Repository access
repositories:
  persistence:
    enabled: true
    storageClass: standard
    size: 20Gi
  repos:
    - url: https://github.com/metabob-labs/metabob-devbob.git
      path: /repos/metabob-devbob
      branch: main

# Git credentials
secrets:
  githubToken: "ghp_xxxxx"  # Required for push
  gitUserName: "MiniBob"
  gitUserEmail: "minibob@metabob.local"
```

### Option 2: Direct Goal Submission

Submit specific development goals to MiniBob via API.

```bash
# Fix a specific bug
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Fix session.org_id null reference in code-variants.ts",
  "priority": "critical",
  "context": {
    "repo": "metabob-activity-api",
    "file": "src/routes/code-variants.ts",
    "error": "null is not an object (evaluating session.org_id)",
    "line": 122
  }
}'

# Add a new feature
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add vessel heartbeat sender to MiniBob that POSTs to /v2/vessels/heartbeat every 30 seconds",
  "priority": "high",
  "context": {
    "repo": "minibob",
    "new_file": "src/heartbeat.ts",
    "integration_file": "src/index.ts"
  }
}'
```

### Option 3: MCP Integration (For IDE/OpenCode)

Use MiniBob as an MCP server for IDE integration.

```json
// In OpenCode/IDE MCP configuration
{
  "mcpServers": {
    "minibob": {
      "command": "bun",
      "args": ["run", "/path/to/minibob/src/mcp-server.ts"],
      "env": {
        "MINIBOB_API_URL": "http://api.minibob.local"
      }
    }
  }
}
```

---

## Development Workflow

### 1. Identify Development Need

**Option A: Manual Submission**
```bash
# Submit via API
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add dark mode toggle to activity dashboard",
  "priority": "medium"
}'
```

**Option B: Automatic Detection**
The system can detect needs automatically:
- Failed executions → Debug activities generated
- Low Thompson scores → Improvement activities generated
- Missing features → Task generation based on analytics

**Current Auto-Generated Tasks** (9 in queue):
```bash
curl "http://api.minibob.local/v2/activities/boredom/queue" | jq '.byPriority'
# {
#   "critical": 7,  # Likely failed execution fixes
#   "high": 0,
#   "medium": 0,
#   "low": 2
# }
```

### 2. MiniBob Executes Code Change Activity

**Activity Template**: `code-change-feature.json`

**Tasks**:
1. **Create Branch**: `git checkout -b feature/dark-mode`
2. **Understand Codebase**: Read relevant files, analyze patterns
3. **Implement Feature**: Write code following existing patterns
4. **Typecheck**: `bun run typecheck` (must pass)
5. **Add Tests**: Create tests for new functionality
6. **Commit**: `git commit -m "feat: add dark mode toggle"`
7. **Push**: `git push origin feature/dark-mode`

**Observable in Dashboard**:
- Executions tab shows each task completing
- Vessels tab shows which pod is working on it
- Real-time updates via WebSocket

### 3. Validation

**Local Validation** (during activity):
```bash
# MiniBob runs these automatically
cd /repos/activity-dashboard
bun run typecheck  # Must pass
bun test           # Must pass
```

**CI Validation** (after push):
```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: ['feature/**', 'bugfix/**', 'refactor/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck
      - run: bun test
      - run: bun run build

      # Report to activity API
      - name: Report CI Result
        run: |
          curl -X POST "http://api.minibob.local/v2/activities/ci-result" \
            -H "Content-Type: application/json" \
            -d "{
              \"execution_id\": \"${{ github.event.head_commit.message | grep -oP 'execution:\\K[^]]+' }}\",
              \"branch\": \"${{ github.ref_name }}\",
              \"commit\": \"${{ github.sha }}\",
              \"success\": true,
              \"duration_ms\": ${{ job.duration }},
              \"stages\": {
                \"typecheck\": {\"success\": true},
                \"test\": {\"success\": true, \"tests_passed\": 42},
                \"build\": {\"success\": true}
              }
            }"
```

### 4. Thompson Sampling Evaluation

**Automatic Process**:
1. CI result received → Thompson score updated
2. If CI passed → Staging deployment triggered
3. Staging metrics collected → Score adjusted
4. Thompson sampling decides: Promote or reject

**Check Variant Status**:
```bash
curl "http://api.minibob.local/v2/activities/code-variants" | \
  jq '.variants[] | select(.branch == "feature/dark-mode")'
```

### 5. Promotion to Production

**When Thompson Score > 0.8**:
```bash
# Automatic process
1. Merge feature branch to main
2. Tag release: git tag v1.2.3
3. Build Docker images
4. Deploy to production
5. Extract template via Ribosome
```

---

## Commit and Build Process

### Automated Commit Messages

MiniBob follows Conventional Commits:

```bash
# Feature
git commit -m "feat: add vessel heartbeat sender

Implements periodic heartbeat to /v2/vessels/heartbeat endpoint
Updates vessel status every 30 seconds with current activity

Co-Authored-By: MiniBob <minibob@metabob.local>"

# Bug fix
git commit -m "fix: resolve session.org_id null reference

Makes org_id optional in code-variants route
Defaults to null when session doesn't provide org_id

Fixes: #123
Co-Authored-By: MiniBob <minibob@metabob.local>"

# Refactor
git commit -m "refactor: extract card component from dashboard

Reduces duplication across Overview, Variants, Vessels tabs
Creates reusable Card component with consistent styling

Co-Authored-By: MiniBob <minibob@metabob.local>"
```

### Build Process

**Local Development** (you):
```bash
cd repos/activity-dashboard
bun run dev      # Hot reload development
bun run build    # Production build
bun run start    # Production server
```

**Docker Build** (for deployment):
```bash
# Dashboard
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .

# API
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

# MiniBob
cd repos/minibob
docker build -t minibob:latest .
```

**Automated Build** (CI):
```yaml
# After PR merged to main
- name: Build and Push Docker Image
  run: |
    docker build -t ghcr.io/metabob-labs/activity-dashboard:${{ github.sha }} .
    docker push ghcr.io/metabob-labs/activity-dashboard:${{ github.sha }}
    docker tag ghcr.io/metabob-labs/activity-dashboard:${{ github.sha }} \
               ghcr.io/metabob-labs/activity-dashboard:latest
    docker push ghcr.io/metabob-labs/activity-dashboard:latest
```

---

## Deployment Pipeline

### Development Cluster (Local)

**Current Setup**: Docker Desktop Kubernetes

```bash
# Deploy full system
cd helm
helmfile -f helmfile-activity-system.yaml sync

# Or individual components
helm upgrade --install activity-dashboard \
  ./charts/activity-dashboard \
  --namespace activity-system \
  --create-namespace

# Verify
kubectl get pods -n activity-system
```

### Staging Environment

**Automatic Deployment After CI**:

```bash
# Triggered by code-change activity after CI passes
# Uses staging-deploy.json template

Tasks:
1. Verify namespace exists
2. Build Docker image with staging tag
3. Deploy to staging namespace
4. Verify pod running
5. Run health checks
6. Collect metrics (response time, error rate)
7. Report metrics to activity API
```

### Production Environment

**Promoted by Thompson Sampling**:

```bash
# When Thompson score > 0.8 and staging metrics are good
# Automatic process:

1. Create production image tag
   docker tag activity-dashboard:staging activity-dashboard:v1.2.3
   docker push activity-dashboard:v1.2.3

2. Update Helm values
   helm upgrade activity-dashboard ./charts/activity-dashboard \
     --set image.tag=v1.2.3 \
     --namespace production

3. Verify deployment
   kubectl rollout status deployment/activity-dashboard -n production

4. Run smoke tests
   curl https://dashboard.minibob.com/health

5. Monitor metrics
   - Error rate < 1%
   - P95 latency < 500ms
   - No degradation in success rate
```

---

## Testing and Validation

### 1. Unit Tests (Bun Test)

```typescript
// repos/minibob/src/activity.test.ts
import { test, expect } from "bun:test";
import { executeActivity } from "./activity";

test("activity execution creates trace", async () => {
  const result = await executeActivity({
    variant_id: "test-activity",
    tasks: [{ id: "task-1", description: "Test task" }]
  });

  expect(result.trace).toBeDefined();
  expect(result.trace.tasks).toHaveLength(1);
});
```

**Run Tests**:
```bash
cd repos/minibob
bun test
```

### 2. Integration Tests

```typescript
// test-minibob-integration.ts
import { expect } from "bun:test";

// Test full workflow
const response = await fetch("http://api.minibob.local/v2/activities/boredom/enqueue", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    goal: "Add health endpoint to dashboard",
    priority: "high"
  })
});

expect(response.ok).toBe(true);

// Wait for execution
await new Promise(resolve => setTimeout(resolve, 30000));

// Verify execution trace created
const traces = await fetch("http://api.minibob.local/v2/activities/execution-traces").then(r => r.json());
expect(traces.total).toBeGreaterThan(0);
```

### 3. End-to-End Validation (Playwright)

```typescript
// test-dashboard-validation.ts
import { test, expect } from '@playwright/test';

test('dashboard shows vessel status', async ({ page }) => {
  await page.goto('http://dashboard.minibob.local');
  await page.click('text=Vessels');

  // Should show running vessels
  await expect(page.locator('text=Total Vessels')).toBeVisible();
  await expect(page.locator('text=minibob-devbob')).toBeVisible();
});
```

**Run E2E Tests**:
```bash
bun run test-dashboard-validation.ts
```

### 4. Validation in Activity Templates

**Built into code-change templates**:

```json
{
  "id": "task-4-typecheck",
  "validation": {
    "commands": [
      "cd /repos/activity-dashboard && bun run typecheck"
    ],
    "requiredFiles": ["src/components/VesselStatus.tsx"],
    "forbiddenPatterns": [
      {"file": "**/*.ts", "pattern": "@ts-ignore"},
      {"file": "**/*.tsx", "pattern": "any\\s+"}
    ]
  }
}
```

---

## Using MiniBob for All Development

### Example Workflow: Fix a Bug

**Current Bug**: Dashboard Variants tab shows session.org_id error

**1. Submit Goal**:
```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Fix session.org_id null reference in code-variants route",
  "priority": "critical",
  "context": {
    "repo": "metabob-activity-api",
    "file": "src/routes/code-variants.ts",
    "error_message": "null is not an object (evaluating session.org_id)",
    "fix_approach": "Make org_id optional with default value"
  }
}'
```

**2. Observe Execution** (Dashboard → Executions tab):
```
✓ Task 1: Create branch → bugfix/code-variants-session-error
✓ Task 2: Read code-variants.ts → Understand error location
✓ Task 3: Implement fix → Make org_id optional
✓ Task 4: Typecheck → Pass
✓ Task 5: Add test → Test null org_id case
✓ Task 6: Commit → "fix: handle null session.org_id in code-variants"
✓ Task 7: Push → origin/bugfix/code-variants-session-error
```

**3. CI Validates** (automatic):
- TypeScript compilation: ✓
- Tests pass: ✓
- Build succeeds: ✓
- Thompson score: 0.5 → 0.75

**4. Staging Deploy** (automatic):
- Deploy to staging namespace
- Collect metrics for 5 minutes
- Error rate: 0% (was 100%)
- Thompson score: 0.75 → 0.9

**5. Promotion** (automatic):
- Score > 0.8 → Promote
- Merge to main
- Deploy to production
- Extract template for future similar fixes

**6. Verify** (you):
```bash
# Check dashboard
curl "http://api.minibob.local/v2/activities/code-variants" | jq .
# Should return data without error
```

**Total Time**: ~5 minutes
**Human Intervention**: Submit goal only

---

### Example Workflow: Add Feature

**Goal**: Add vessel heartbeat sender to MiniBob

**1. Submit with Detail**:
```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Add vessel heartbeat sender that reports status to /v2/vessels/heartbeat every 30 seconds",
  "priority": "high",
  "context": {
    "repo": "minibob",
    "implementation": {
      "new_file": "src/heartbeat.ts",
      "integrate_into": "src/index.ts",
      "endpoint": "POST /v2/vessels/heartbeat",
      "interval": 30000,
      "payload": {
        "pod_name": "from HOSTNAME env var",
        "namespace": "from namespace file",
        "status": "idle | executing | bored",
        "current_activity": "optional activity info",
        "metrics": "executions_completed, cost, uptime"
      }
    }
  }
}'
```

**2. MiniBob Implements**:
- Creates `src/heartbeat.ts`:
  - HeartbeatSender class
  - Periodic interval timer
  - Status tracking
  - Metrics collection
- Updates `src/index.ts`:
  - Import HeartbeatSender
  - Initialize on startup
  - Update status on activity changes
  - Cleanup on shutdown
- Adds tests:
  - Test heartbeat payload format
  - Test interval timing
  - Test error handling
- Validates:
  - TypeScript compiles
  - Tests pass
  - No @ts-ignore or any types

**3. CI & Deployment**:
- CI passes → Thompson score increases
- Staging deploy → Verify heartbeats received
- Check vessels endpoint → Should show MiniBob pods
- Promotion → Deploy to production

**4. Verify Dashboard**:
```bash
# Open dashboard → Vessels tab
# Should show:
# - 3 MiniBob pods
# - Status: idle/executing
# - Last heartbeat: < 1 min ago
```

---

### Example Workflow: Refactor

**Goal**: Extract reusable Card component from dashboard

**Submit**:
```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
  "goal": "Extract card styling into reusable Card component to reduce duplication across Overview, Variants, and Vessels tabs",
  "priority": "low",
  "context": {
    "repo": "activity-dashboard",
    "pattern_to_extract": "Card component with consistent border, padding, shadow",
    "used_in": [
      "src/components/SystemOverview.tsx",
      "src/components/CodeVariants.tsx",
      "src/components/VesselStatus.tsx"
    ],
    "new_component": "src/components/ui/Card.tsx"
  }
}'
```

**MiniBob Process**:
1. Analyze existing Card usage patterns
2. Identify common props and styling
3. Create new Card component
4. Refactor existing components to use new Card
5. Ensure visual consistency maintained
6. Run visual regression tests (if configured)
7. Commit with before/after examples

**Result**: Reduced code duplication, easier to maintain consistent styling

---

## Best Practices

### 1. Clear Goal Descriptions

**Good**:
```json
{
  "goal": "Add error boundary to dashboard that catches React errors and displays user-friendly message",
  "context": {
    "implementation": "Use React.ErrorBoundary wrapper in App.tsx",
    "error_display": "Show error message with retry button",
    "logging": "Log errors to console and activity API"
  }
}
```

**Bad**:
```json
{
  "goal": "Make dashboard better"
}
```

### 2. Provide Context

Include:
- Repo and file paths
- Error messages if fixing bugs
- Implementation hints if you have preferences
- Related files or dependencies

### 3. Set Appropriate Priority

- **critical**: Blocking production issues, security vulnerabilities
- **high**: Important features, significant bugs
- **medium**: Nice-to-have features, minor bugs
- **low**: Refactoring, optimization, tech debt

### 4. Monitor Progress

```bash
# Check boredom queue
curl "http://api.minibob.local/v2/activities/boredom/queue"

# Watch dashboard Executions tab
open http://dashboard.minibob.local

# Check vessel logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
```

### 5. Verify Results

```bash
# Check git commits
cd repos/activity-dashboard
git log --oneline -5

# Check deployed code
kubectl get pods -n activity-system
kubectl logs -n activity-system deployment/activity-dashboard

# Test endpoints
curl "http://dashboard.minibob.local/health"
```

---

## Quick Reference Commands

### Submit Development Goal
```bash
curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" \
  -H "Content-Type: application/json" \
  -d '{"goal": "YOUR_GOAL_HERE", "priority": "high"}'
```

### Check Queue Status
```bash
curl "http://api.minibob.local/v2/activities/boredom/queue" | jq .
```

### Monitor Execution
```bash
# Dashboard
open http://dashboard.minibob.local

# Logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f

# API
curl "http://api.minibob.local/v2/activities/execution-traces?limit=5" | jq .
```

### Build & Deploy
```bash
# Build images
docker build -t activity-dashboard:latest repos/activity-dashboard/

# Deploy
kubectl set image deployment/activity-dashboard \
  -n activity-system \
  activity-dashboard=activity-dashboard:latest

# Verify
kubectl rollout status deployment/activity-dashboard -n activity-system
```

### Test
```bash
# Unit tests
cd repos/minibob && bun test

# Integration tests
bun run test-minibob-integration.ts

# E2E tests (Playwright)
bun run test-dashboard-validation.ts
```

---

## Troubleshooting

### MiniBob Not Picking Up Tasks
```bash
# Check MiniBob pods are running
kubectl get pods -n activity-system | grep minibob

# Check logs for boredom detection
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob | grep -i boredom

# Verify boredom queue has tasks
curl "http://api.minibob.local/v2/activities/boredom/queue"
```

### Activity Execution Fails
```bash
# Check execution traces for errors
curl "http://api.minibob.local/v2/activities/execution-traces?status=failed" | jq .

# View detailed error
curl "http://api.minibob.local/v2/activities/execution-traces/EXEC_ID" | jq .error_message

# Check validation requirements
cat repos/minibob/templates/code-change-feature.json | jq .tasks[].validation
```

### Code Not Deploying
```bash
# Check CI status (GitHub Actions)
gh run list --repo metabob-labs/metabob-devbob

# Check Thompson score
curl "http://api.minibob.local/v2/activities/code-variants" | \
  jq '.variants[] | select(.branch == "feature/YOUR_BRANCH")'

# Manual promotion if needed
git checkout main
git merge feature/YOUR_BRANCH
git push origin main
```

---

## Next Steps

1. **Fix Immediate Issues** (from DASHBOARD_DATA_VALIDATION_REPORT.md):
   - Fix code-variants session.org_id error
   - Add execution trace creation to MiniBob
   - Implement vessel heartbeats

2. **Submit Goals for These Fixes**:
   ```bash
   # Let MiniBob fix itself!
   curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
     "goal": "Fix session.org_id null reference in code-variants route",
     "priority": "critical"
   }'

   curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
     "goal": "Add execution trace creation to MiniBob after each activity execution",
     "priority": "high"
   }'

   curl -X POST "http://api.minibob.local/v2/activities/boredom/enqueue" -d '{
     "goal": "Implement vessel heartbeat sender in MiniBob",
     "priority": "high"
   }'
   ```

3. **Observe the Self-Development Loop**:
   - Watch dashboard Executions tab
   - See MiniBob fix itself
   - Verify fixes in Variants tab
   - Celebrate the autonomous improvement! 🎉

---

**The system develops itself. You just guide it.** 🚀
