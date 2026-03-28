# Phase 6 Implementation - Next Steps

**Status:** Core automation complete, ready for testing
**Date:** 2026-03-24

## Quick Start: Test the Implementation

### 1. Build Docker Images

```bash
# From repo root
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

cd ../minibob
docker build -t minibob:latest .

cd ../activity-dashboard
docker build -t activity-dashboard:latest .
```

### 2. Deploy with Helmfile

```bash
cd ../../helm

# Ensure Istio is installed
istioctl install --set profile=demo -y

# Deploy entire stack
helmfile -f activity-system-minimal.yaml.gotmpl sync

# Watch deployment
watch kubectl get pods -n activity-system
```

### 3. Verify Init-Data Job

```bash
# Check job status
kubectl get jobs -n activity-system

# View job logs
kubectl logs -n activity-system job/surrealdb-init-data

# Expected output:
# ✓ Organization metabob_internal already exists (or created)
# ✓ MiniBob instance minibob-local-001 already exists (or created)
# ✅ Test data initialization complete!
```

### 4. Verify Data in Database

```bash
# Query organizations table
kubectl run test-org-query -n activity-system \
  --image=metabob-activity-api:latest \
  --image-pull-policy=Never \
  --rm -i --restart=Never \
  --env="SURREALDB_URL=http://surrealdb.activity-system.svc.cluster.local:8000" \
  --env="SURREALDB_NAMESPACE=metabob" \
  --env="SURREALDB_DATABASE=learning_loop" \
  --env="SURREALDB_USERNAME=root" \
  --env="SURREALDB_PASSWORD=surrealdb-local-dev-123" \
  -- bun -e "
import { Surreal } from 'surrealdb';
const db = new Surreal();
await db.connect(process.env.SURREALDB_URL);
await db.signin({ username: process.env.SURREALDB_USERNAME, password: process.env.SURREALDB_PASSWORD });
await db.use({ namespace: process.env.SURREALDB_NAMESPACE, database: process.env.SURREALDB_DATABASE });
const orgs = await db.query('SELECT * FROM organizations');
const instances = await db.query('SELECT * FROM minibob_instance');
console.log('Organizations:', JSON.stringify(orgs, null, 2));
console.log('MiniBob Instances:', JSON.stringify(instances, null, 2));
"

# Expected: Organization and instance records shown
```

### 5. Test MiniBob Authentication

```bash
# Set instance credentials
export MINIBOB_INSTANCE_ID=minibob-local-001
export MINIBOB_INSTANCE_API_KEY=test-api-key-123
export MINIBOB_MCP_ENDPOINT=http://api.minibob.local

# Test authentication endpoint directly
curl -X POST http://api.minibob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' | jq

# Expected response:
# {
#   "token": "eyJ...",  # JWT token
#   "org_id": "metabob_internal",
#   "project_id": null
# }
```

### 6. Test Activity Execution with Authentication

```bash
cd repos/minibob

# Export credentials
export MINIBOB_INSTANCE_ID=minibob-local-001
export MINIBOB_INSTANCE_API_KEY=test-api-key-123
export ANTHROPIC_API_KEY=<your-key>

# Run deployment activity
bun run index.ts run activities/deploy-stack-from-scratch.json \
  --var cluster_context=docker-desktop \
  --var namespace=activity-system \
  --var anthropic_api_key=$ANTHROPIC_API_KEY \
  --var surrealdb_password=surrealdb-local-dev-123

# Expected:
# Authenticating instance: minibob-local-001
# ✓ Instance authenticated
# Running activity: activities/deploy-stack-from-scratch.json
# [Activity executes without RBAC errors]
```

## Troubleshooting

### Init-Data Job Failed

```bash
# Check job logs for errors
kubectl logs -n activity-system job/surrealdb-init-data

# Common issues:
# 1. SurrealDB not ready - job will retry (backoffLimit: 3)
# 2. Schema not migrated - run migrations first
# 3. Credentials wrong - check surrealdb-credentials secret
```

### MiniBob Authentication Failed

```bash
# Check if instance exists in database
kubectl run check-instance -n activity-system \
  --image=metabob-activity-api:latest \
  --rm -i --restart=Never \
  -- bun -e "SELECT * FROM minibob_instance WHERE instance_id = 'minibob-local-001'"

# Check backend logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50

# Common issues:
# 1. Wrong API key - check secret minibob-instance-credentials
# 2. Instance not created - check init-data job ran successfully
# 3. RECORD access not defined - run schema migrations first
```

### Activity Registration Still Fails with RBAC Error

```bash
# This means authentication didn't work properly

# 1. Check MiniBob logs for authentication confirmation
cd repos/minibob
bun run index.ts run activities/deploy-stack-from-scratch.json ... 2>&1 | grep -i "authenticated"
# Should see: "✓ Instance authenticated"

# 2. Verify JWT token is being sent
# Add debug logging to mcp.ts request() method temporarily

# 3. Check backend receives JWT
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100 | grep -i "auth"
```

## Success Criteria

✅ Init-data job completes successfully
✅ Organization and instance records created in database
✅ MiniBob authentication endpoint returns JWT token
✅ Activity execution works without RBAC errors
✅ Backend accepts API calls with org_id from token

## What's Next

### Phase 7: Service Updates (4-6 hours)

**Goal:** Remove application-level org filtering, trust database RBAC

**Tasks:**
1. Update metabob-activity-api to remove manual org_id filtering
2. Trust $auth.org_id from JWT exclusively
3. Simplify API code (less logic, more trust)
4. Update metabob-analysis-api similarly
5. Test multi-tenant isolation

### Phase 8: Testing (4-6 hours)

**Goal:** Validate RBAC enforcement and multi-tenant isolation

**Tasks:**
1. Write RBAC enforcement tests
2. Write multi-tenant isolation tests
3. Test MiniBob auth flow end-to-end
4. Verify activity execution with different orgs
5. Security test: attempt to access other org's data

## Key Configuration Files

### Helm Values Override

`helm/activity-system-minimal.yaml.gotmpl`:
```yaml
surrealdb:
  auth:
    username: root
    password: {{ requiredEnv "SURREALDB_PASSWORD" }}
  initData:
    enabled: true
    defaultOrg:
      id: metabob_internal
      name: "Metabob Internal"
    minibob:
      instanceId: minibob-local-001
      vesselId: minibob-cli-local
```

### MiniBob Environment Variables

`.env` or export:
```bash
MINIBOB_INSTANCE_ID=minibob-local-001
MINIBOB_INSTANCE_API_KEY=test-api-key-123
MINIBOB_MCP_ENDPOINT=http://api.minibob.local
ANTHROPIC_API_KEY=sk-ant-...
```

### Docker Build Commands

```bash
# Activity API
docker build -t metabob-activity-api:latest -f repos/metabob-activity-api/Dockerfile .

# MiniBob
docker build -t minibob:latest -f repos/minibob/Dockerfile .

# Dashboard
docker build -t activity-dashboard:latest -f repos/activity-dashboard/Dockerfile .
```

## Implementation Summary

**Files Created:**
- `helm/charts/surrealdb/templates/init-data-job.yaml`
- `helm/charts/surrealdb/templates/secret-credentials.yaml`
- `helm/charts/surrealdb/templates/secret-minibob-instance.yaml`
- `repos/metabob-activity-api/sql/init-test-data.ts`
- `repos/metabob-activity-api/src/routes/auth.ts`

**Files Modified:**
- `helm/charts/surrealdb/values.yaml`
- `repos/metabob-activity-api/src/index.ts`
- `repos/minibob/src/mcp.ts`
- `repos/minibob/index.ts`
- `openspec/changes/surrealdb-multi-tenant-schema/tasks.md`

**Progress:** 124/258 tasks (48%)

**Time Investment:** ~3-4 hours implementing core automation

**Remaining for Hybrid Approach:** ~10-14 hours (Phases 7-8)

---

**Ready to test!** Follow the Quick Start above to validate the implementation.
