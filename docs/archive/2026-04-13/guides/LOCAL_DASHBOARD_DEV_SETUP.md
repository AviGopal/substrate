# Local Dashboard Development Setup

**Created**: 2026-04-09
**Status**: ✅ READY FOR DEVELOPMENT

---

## Overview

Local development environment for the cloud dashboard with hot reload, connected to production Kubernetes services via port-forwarding.

## Running Services

### Dashboard Server
- **URL**: http://localhost:3000
- **Hot Reload**: ✅ Enabled (Bun --hot)
- **Config**: `.env` file in `repos/metabob-cloud-dashboard/`
- **Process**: Background task (view output at `/tmp/claude-1000/.../tasks/b005606.output`)

### Port-Forwarded Services

| Service | Kubernetes → Local | Health Check | Status |
|---------|-------------------|--------------|--------|
| user-vessel | 8080 → 8081 | http://localhost:8081/health | ✅ Running |
| activity-api | 8080 → 8082 | http://localhost:8082/health | ✅ Running |
| SurrealDB | 8000 → 8000 | http://localhost:8000/health | ✅ Running |

## Configuration Files

### `.env` (Dashboard)
```bash
# repos/metabob-cloud-dashboard/.env
PORT=3000
NODE_ENV=development
USER_VESSEL_URL=http://localhost:8081
ACTIVITY_API_URL=http://localhost:8082
```

### Auth Proxy Fix Applied
**File**: `repos/metabob-cloud-dashboard/src/index.ts:60`
```typescript
// ✅ FIXED (uses USER_VESSEL_URL)
const targetUrl = `${USER_VESSEL_URL}${path}`;
```

## Development Workflow

### Making Changes

1. **Edit dashboard code**:
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cloud-dashboard/src
   # Edit any .tsx, .ts, or .css file
   ```

2. **See changes instantly**:
   - Bun hot reload detects changes
   - Browser auto-refreshes (if using browser dev tools)
   - No need to restart server

3. **Test in browser**:
   - Open http://localhost:3000
   - Changes appear immediately

### Restarting Services

**Dashboard**:
```bash
# Stop background process
ps aux | grep "bun --hot" | grep -v grep | awk '{print $2}' | xargs kill

# Start new one
cd repos/metabob-cloud-dashboard
bun --hot src/index.ts &
```

**Port-forwards** (if they die):
```bash
# user-vessel
kubectl port-forward -n activity-system svc/user-vessel 8081:8080 &

# activity-api
kubectl port-forward -n activity-system svc/metabob-activity-api 8082:8080 &

# SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &
```

### Checking Service Status

```bash
curl -s http://localhost:8081/health | jq  # user-vessel
curl -s http://localhost:8082/health | jq  # activity-api
curl -s http://localhost:3000/health | jq  # dashboard
```

## Known Issues

### ⚠️ Signup/Auth Blocked

**Problem**: Signup returns "Anonymous access not allowed" error

**Root Cause**: SurrealDB 3.0.0 PERMISSIONS system issue - user-vessel can't create organizations/users even with root credentials

**Impact**:
- ❌ Cannot test signup flow locally
- ❌ Cannot test login flow locally
- ❌ Cannot test authenticated dashboard features locally

**Workarounds**:
1. **Deploy to canary** and test there (recommended)
2. **Fix SurrealDB auth** in user-vessel (investigate SDK issue)
3. **Use mock auth** for dashboard development

**What Works**:
- ✅ Dashboard UI development
- ✅ Component development
- ✅ Non-auth API testing
- ✅ Chart/visualization testing (with mock data)

### Database Schema Changes Applied

Modified schemas for signup support (but still blocked by auth issue):
- `organizations` table: `PERMISSIONS NONE`
- `users` table: `PERMISSIONS NONE`

**To revert**:
```bash
PASSWORD=$(kubectl get secret surrealdb-credentials -n activity-system -o jsonpath='{.data.password}' | base64 -d)
curl -X POST http://localhost:8000/sql \
  -u "root:$PASSWORD" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -d "REMOVE TABLE organizations; REMOVE TABLE users;"
```

## Testing Dashboard Features

### Pages You Can Develop

Even without auth, you can develop these pages in isolation:

1. **API Keys** - Mock data
   ```typescript
   const mockApiKeys = [
     { id: '1', prefix: 'mb_live_', status: 'active', tier: 'pro', ... }
   ];
   ```

2. **Members** - Mock data
3. **Usage Analytics** - Mock chart data
4. **Activity Traces** - Mock trace data
5. **Settings** - UI only

### Using Playwright for Testing

```bash
# With dashboard running at localhost:3000
bun playwright test

# Or use MCP tools
minibob --single "test dashboard UI at http://localhost:3000 using playwright"
```

## Deploying Changes

### To Canary (for full testing with auth)

```bash
# 1. Sync local changes to deployment repo
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment
rsync -av ../metabob-cloud-dashboard/src/ vessels/metabob-cloud-dashboard/src/

# 2. Commit and push
git add vessels/metabob-cloud-dashboard/
git commit -m "feat(dashboard): your changes here"
git push origin dev

# 3. CI/CD auto-deploys to canary (~5 minutes)
# Monitor: gh run watch --repo MetabobProject/deployment

# 4. Test at https://app.metabob.com (canary)
```

### To Production

Wait for canary validation (24-48h), then:
```bash
./scripts/promote-canary-to-production.sh
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Development                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Browser                                                      │
│    ↓                                                          │
│  http://localhost:3000                                        │
│    ↓                                                          │
│  Dashboard (Bun + React 19)  ←── Hot Reload                  │
│    ├── /api/auth/* → http://localhost:8081/v2/auth/*        │
│    └── /api/* → http://localhost:8082/*                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Port-Forwards to Kubernetes                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  localhost:8081 → user-vessel:8080 (auth)                    │
│  localhost:8082 → metabob-activity-api:8080 (learning)       │
│  localhost:8000 → surrealdb:8000 (database)                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              GKE Production Cluster                          │
│              (activity-system namespace)                     │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Dashboard won't start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill existing process
kill $(lsof -t -i:3000)

# Restart
cd repos/metabob-cloud-dashboard
bun --hot src/index.ts
```

### Port-forward dies

```bash
# Find which port-forward died
curl http://localhost:8081/health  # user-vessel
curl http://localhost:8082/health  # activity-api

# Restart the one that failed
kubectl port-forward -n activity-system svc/user-vessel 8081:8080 &
kubectl port-forward -n activity-system svc/metabob-activity-api 8082:8080 &
```

### Changes not appearing

1. Check Bun output for errors
2. Hard refresh browser (Ctrl+Shift+R)
3. Check browser console for JavaScript errors
4. Verify file was saved

### Cannot connect to Kubernetes

```bash
# Check kubectl context
kubectl config current-context

# Should be: production cluster

# If wrong, switch context
kubectl config use-context <production-context>
```

## Next Steps

### Option A: Deploy to Canary (Recommended)

Deploy the auth fix and test full functionality at https://app.metabob.com

**Pros**:
- Test real auth flow
- Test with real data
- Validate before production

**Cons**:
- Slower iteration (5 min deploy cycle)
- Shared environment

### Option B: Fix SurrealDB Auth Issue

Debug why user-vessel SDK can't authenticate with SurrealDB 3.0

**Tasks**:
1. Check surrealdb.js SDK version compatibility
2. Try different auth methods (scope-based)
3. Add detailed logging to signup route
4. Test with SurrealDB 2.x compatibility mode

**Pros**:
- Full local development capability
- Faster iteration

**Cons**:
- Requires deeper investigation
- May be SurrealDB 3.0 breaking change

### Option C: Mock Auth for Development

Add mock auth bypass for local development only

**Pros**:
- Unblocks dashboard development immediately
- Can test all UI features

**Cons**:
- Not testing real auth integration
- Need to remove mocks before deploying

---

## Quick Reference

**Start everything**:
```bash
# Port-forwards
kubectl port-forward -n activity-system svc/user-vessel 8081:8080 &
kubectl port-forward -n activity-system svc/metabob-activity-api 8082:8080 &
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &

# Dashboard
cd repos/metabob-cloud-dashboard
bun --hot src/index.ts &

# Wait for startup
sleep 3

# Open browser
open http://localhost:3000
```

**Stop everything**:
```bash
# Kill port-forwards
pkill -f "kubectl port-forward"

# Kill dashboard
pkill -f "bun --hot"
```

**Health check all**:
```bash
for port in 3000 8081 8082 8000; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health > /dev/null && echo "✅" || echo "❌"
done
```

---

**Documentation**: See also
- [CLOUD_DASHBOARD_TESTING_REPORT.md](./CLOUD_DASHBOARD_TESTING_REPORT.md) - Playwright test results
- [DASHBOARD_FEATURE_EXPLORATION.md](./DASHBOARD_FEATURE_EXPLORATION.md) - Complete feature inventory
- [repos/deployment/DEPLOYMENT_WORKFLOW.md](./repos/deployment/DEPLOYMENT_WORKFLOW.md) - CI/CD process
