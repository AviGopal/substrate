# Deployment Validation Guide

This guide provides validation procedures for clean deployments using paradigm core tables.

## Overview

The system now uses **4 core paradigm tables** that replace all legacy activity, execution, and impulse tables:

1. **impulse** - All data with pointers, shapes, and metadata
2. **activity** - All state transitions (templates, tools, compositions)
3. **execution** - All execution traces with input/output impulses
4. **vessel** - Execution environments with resolver capabilities

## Deployment Initialization Sequence

When deploying from scratch, Helm hooks ensure proper initialization:

### 1. Pre-Install: Schema Migration (Hook Weight: -10)

**Job:** `surrealdb-migration`

**Purpose:** Apply database schemas before any service starts

**Steps:**
1. Wait for SurrealDB to be ready (health check)
2. Apply core schemas from `@metabob/proto`:
   - `000-schema-version.surql` - Schema versioning
   - `001-auth-access.surql` - Authentication definitions
   - `002-organizations.surql` - Multi-tenant organizations
   - `003-projects.surql` - Project isolation
   - `004-subscriptions.surql` - Subscription management
3. Apply activity-specific schemas:
   - `012-composition.surql` - Activity composition graph
   - `013-impulse-tool-usage.surql` - Tool usage patterns
   - `015-impulse-metadata.surql` - Impulse metadata tracking
   - `020-paradigm-core-tables.surql` - **Core paradigm tables**
4. Run data migrations (backfill org_id if upgrading)

**Expected Output:**
```
ℹ️ Applying core schemas from @metabob/proto...
ℹ️ Applying core schema: 000-schema-version.surql
ℹ️ ✓ Applied: 000-schema-version.surql
...
ℹ️ Applying activity-specific schemas...
ℹ️ Applying activity schema: 020-paradigm-core-tables.surql
ℹ️ ✓ Applied: 020-paradigm-core-tables.surql
...
ℹ️ Running data migrations...
ℹ️ Ensuring default organization exists...
ℹ️ ✓ Created default organization: organization:metabob_internal
✓ Migration completed successfully
```

**Validation:**
```bash
kubectl logs -n activity-system job/surrealdb-migration
# Should show all schemas applied successfully
```

### 2. Post-Install: Initialize Test Data (Hook Weight: 10)

**Job:** `surrealdb-init-data`

**Purpose:** Create default organization and vessel for bootstrapping

**Steps:**
1. Create default organization (`metabob_internal`)
2. Create MiniBob vessel instance with API key
3. Record credentials for local development

**Expected Output:**
```
Connecting to SurrealDB at http://surrealdb.activity-system.svc.cluster.local:8000...
Signing in as root...
Using namespace: activity-system, database: learning_loop

Checking for organization: metabob_internal...
✓ Organization metabob_internal already exists

Checking for vessel: minibob-local-001...
✓ Created vessel: minibob-local-001

✅ Test data initialization complete!

Configuration:
  Organization: metabob_internal (Metabob Internal)
  Vessel ID: vessel:minibob-local-001
  Vessel Name: minibob-cli-local
  Resolves: ['file', 'memo']
  API Key: test-api... (for local dev only)
```

**Validation:**
```bash
kubectl logs -n activity-system job/surrealdb-init-data
# Should show organization and vessel created
```

## Expected Tables After Clean Deployment

### Core Paradigm Tables (schema-paradigm-alignment)

| Table | Purpose | Row Count (Fresh) |
|-------|---------|-------------------|
| `impulse` | All data with pointers and shapes | 0 |
| `activity` | All state transitions | 0 |
| `execution` | All execution traces | 0 |
| `vessel` | Execution environments | 1 (minibob-local-001) |

### Supporting Tables

| Table | Purpose | Row Count (Fresh) |
|-------|---------|-------------------|
| `organizations` | Multi-tenant orgs | 1 (metabob_internal) |
| `projects` | Project isolation | 0 |
| `schema_version` | Migration tracking | 1+ |
| `activity_composition_graph` | Activity relationships | 0 |
| `impulse_relevance_metrics` | Learning data | 0 |
| `tool_usage` | Tool execution patterns | 0 |

### Legacy Tables (REMOVED)

These tables **should NOT exist** in a clean deployment:

- ❌ `activity_template` → Replaced by `activity`
- ❌ `activity_registry` → Replaced by `activity`
- ❌ `activity_execution_traces` → Replaced by `execution`
- ❌ `activity_executions` → Replaced by `execution`
- ❌ `impulse_data` → Replaced by `impulse`
- ❌ `minibob_instance` → Replaced by `vessel`

## Validation Checklist

### 1. Verify Helm Jobs Completed

```bash
kubectl get jobs -n activity-system
```

**Expected:**
```
NAME                        COMPLETIONS   DURATION   AGE
surrealdb-init-data         1/1           15s        2m
surrealdb-migration         1/1           30s        3m
```

### 2. Check Job Logs

```bash
# Migration logs
kubectl logs -n activity-system job/surrealdb-migration

# Expected: ✓ Applied all schemas, ✓ Data migrations completed

# Init data logs
kubectl logs -n activity-system job/surrealdb-init-data

# Expected: ✓ Organization created, ✓ Vessel created
```

### 3. Verify Core Tables Exist

```bash
# Port-forward SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &

# Query table list
curl -X POST http://localhost:8000/sql \
  -u "root:${SURREALDB_PASSWORD}" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -d "INFO FOR DB;"
```

**Expected Tables:**
- ✅ `impulse` (SCHEMAFULL)
- ✅ `activity` (SCHEMAFULL)
- ✅ `execution` (SCHEMAFULL)
- ✅ `vessel` (SCHEMAFULL)
- ✅ `organizations` (SCHEMAFULL)
- ✅ `schema_version` (SCHEMAFULL)

### 4. Verify Default Organization

```bash
curl -X POST http://localhost:8000/sql \
  -u "root:${SURREALDB_PASSWORD}" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -d "SELECT * FROM organizations WHERE id = organizations:metabob_internal;"
```

**Expected:**
```json
[
  {
    "id": "organizations:metabob_internal",
    "name": "Metabob Internal",
    "created_at": "2026-04-01T...",
    "updated_at": "2026-04-01T..."
  }
]
```

### 5. Verify Vessel Instance

```bash
curl -X POST http://localhost:8000/sql \
  -u "root:${SURREALDB_PASSWORD}" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -d "SELECT * FROM vessel WHERE id = vessel:minibob-local-001;"
```

**Expected:**
```json
[
  {
    "id": "vessel:minibob-local-001",
    "name": "minibob-cli-local",
    "org_id": "metabob_internal",
    "resolves": ["file", "memo"],
    "is_active": true,
    "api_key_hash": "$argon2...",
    "created_at": "2026-04-01T...",
    "last_active_at": "2026-04-01T..."
  }
]
```

### 6. Verify No Legacy Tables

```bash
# Check for legacy tables (should return empty or error)
for table in activity_template activity_registry activity_execution_traces impulse_data minibob_instance; do
  echo "Checking $table..."
  curl -X POST http://localhost:8000/sql \
    -u "root:${SURREALDB_PASSWORD}" \
    -H "surreal-ns: activity-system" \
    -H "surreal-db: learning_loop" \
    -d "SELECT count() FROM $table GROUP ALL;" 2>&1 | grep -q "does not exist" && echo "  ✓ Not found (expected)" || echo "  ❌ Still exists (unexpected)"
done
```

### 7. Test API Health

```bash
# Activity API
curl http://activity.metabob.local/health

# Expected: {"status":"ok"}
```

### 8. Test MiniBob Authentication

```bash
# MiniBob signin
curl -X POST http://activity.metabob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "minibob-local-001",
    "api_key": "test-api-key-123"
  }' | jq

# Expected: {"token":"eyJ...","org_id":"metabob_internal"}
```

### 9. Verify RBAC Permissions

```bash
# Get MiniBob token
TOKEN=$(curl -X POST http://activity.metabob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' | jq -r .token)

# Query activities with auth (should work)
curl http://activity.metabob.local/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" | jq

# Expected: [] (empty array, but no permission error)
```

### 10. Run Paradigm Sync Validation

```bash
# From deployment repo
cd repos/deployment/vessels/metabob-activity-api

# Run validation script
SURREALDB_URL=http://localhost:8000 \
SURREALDB_NAMESPACE=activity-system \
SURREALDB_DATABASE=learning_loop \
SURREALDB_USERNAME=root \
SURREALDB_PASSWORD=${SURREALDB_PASSWORD} \
bun run scripts/validate-paradigm-sync.ts
```

**Expected:**
```
================================================================================
PARADIGM SYNC VALIDATION (P4.3)
================================================================================
SurrealDB URL: http://localhost:8000
Drift Threshold: 1.0%

Comparing activity_template ↔ activity...
  ⚠️ Legacy table not found or empty
  ✅ (OK)

Comparing activity_execution_traces ↔ execution...
  ⚠️ Legacy table not found or empty
  ✅ (OK)

Comparing impulse_data ↔ impulse...
  ⚠️ Legacy table not found or empty
  ✅ (OK)

Comparing minibob_instance ↔ vessel...
  ⚠️ Legacy table not found or empty
  ✅ (OK)

--- Recent Write Activity ---
Activities (last hour): Legacy=0, New=0
Executions (last hour): Legacy=0, New=0

================================================================================
VALIDATION SUMMARY
================================================================================

Result: 4/4 table pairs within drift threshold

✅ VALIDATION PASSED - All tables are in sync
```

## Troubleshooting

### Migration Job Fails

**Symptoms:**
```bash
kubectl get jobs -n activity-system
# NAME                  COMPLETIONS   DURATION   AGE
# surrealdb-migration   0/1           5m         5m
```

**Check Logs:**
```bash
kubectl logs -n activity-system job/surrealdb-migration
```

**Common Issues:**

1. **SurrealDB not ready:**
   ```
   Attempt 1/30: Connecting to http://surrealdb...
   Connection failed: ECONNREFUSED
   ```
   - **Solution:** Wait longer (migration retries with exponential backoff)

2. **Schema syntax error:**
   ```
   ❌ Migration failed:
   Parse error: ...
   ```
   - **Solution:** Check schema file syntax in `sql/schemas/020-paradigm-core-tables.surql`

3. **Missing proto schemas:**
   ```
   Failed to apply 002-organizations.surql: ENOENT
   ```
   - **Solution:** Ensure `@metabob/proto` submodule is initialized in Docker image

### Init Data Job Fails

**Symptoms:**
```bash
kubectl get jobs -n activity-system
# NAME                   COMPLETIONS   DURATION   AGE
# surrealdb-init-data    0/1           2m         2m
```

**Check Logs:**
```bash
kubectl logs -n activity-system job/surrealdb-init-data
```

**Common Issues:**

1. **Organization creation fails:**
   ```
   Error: Cannot create organizations:metabob_internal: already exists
   ```
   - **Solution:** This is OK - script is idempotent

2. **Vessel creation fails:**
   ```
   Error: API key hash generation failed
   ```
   - **Solution:** Check SurrealDB version supports `crypto::argon2::generate`

### Legacy Tables Still Exist

**Symptoms:**
```bash
curl ... -d "SELECT count() FROM activity_template GROUP ALL;"
# Returns: [{"count": 42}]
```

**Solution:**

This indicates an **upgrade** scenario, not a clean deployment. The legacy tables will remain during the dual-write period. To force clean deployment:

```bash
# Destroy everything
helmfile -e local destroy
kubectl delete pvc -n activity-system --all

# Redeploy
helmfile -e local sync
```

### RBAC Permission Errors

**Symptoms:**
```
{"error":"You don't have permission to perform this query type"}
```

**Solution:**

1. Verify JWT token contains correct claims:
   ```bash
   echo $TOKEN | cut -d'.' -f2 | base64 -d | jq
   # Should have: org_id, role, id, exp
   ```

2. Verify PERMISSIONS on tables:
   ```bash
   curl -X POST http://localhost:8000/sql \
     -u "root:${SURREALDB_PASSWORD}" \
     -H "surreal-ns: activity-system" \
     -H "surreal-db: learning_loop" \
     -d "INFO FOR TABLE activity;"
   # Should show PERMISSIONS FOR select WHERE ...
   ```

## Post-Deployment Smoke Tests

After validating the deployment, run these smoke tests:

### 1. Create Activity Template

```bash
curl -X POST http://activity.metabob.local/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-activity-001",
    "name": "Test Activity",
    "description": "Smoke test activity",
    "execution_type": "template",
    "input_shapes": ["goal"],
    "output_shapes": ["plan"],
    "tasks": []
  }' | jq

# Expected: Activity created with ID
```

### 2. Record Execution Trace

```bash
curl -X POST http://activity.metabob.local/v2/activities/execution-traces \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-exec-001",
    "activity_id": "test-activity-001",
    "input_impulses": [],
    "output_impulses": [],
    "success": true,
    "duration_ms": 1000,
    "cost_usd": 0.01
  }' | jq

# Expected: Execution recorded
```

### 3. Create Impulse

```bash
curl -X POST http://activity.metabob.local/v2/impulses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-impulse-001",
    "pointer": {"type": "memo", "content": "Test data"},
    "shape": "goal",
    "summary": "Test impulse"
  }' | jq

# Expected: Impulse created
```

### 4. Query Created Data

```bash
# List activities
curl http://activity.metabob.local/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" | jq

# List executions
curl http://activity.metabob.local/v2/activities/executions?limit=10 \
  -H "Authorization: Bearer $TOKEN" | jq

# List impulses
curl http://activity.metabob.local/v2/impulses?limit=10 \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Validation Script

For automated validation, use:

```bash
#!/bin/bash
# validate-deployment.sh

set -e

echo "=== Deployment Validation ==="
echo ""

# 1. Check jobs completed
echo "1. Checking Helm jobs..."
kubectl get jobs -n activity-system | grep -E "surrealdb-(migration|init-data)" | grep "1/1" || {
  echo "❌ Jobs not completed"
  exit 1
}
echo "✓ Jobs completed"

# 2. Check pod health
echo ""
echo "2. Checking pod health..."
kubectl get pods -n activity-system | grep -v "Completed" | grep "Running" || {
  echo "❌ Pods not running"
  exit 1
}
echo "✓ Pods running"

# 3. Test API health
echo ""
echo "3. Testing API health..."
curl -sf http://activity.metabob.local/health > /dev/null || {
  echo "❌ API health check failed"
  exit 1
}
echo "✓ API healthy"

# 4. Test MiniBob auth
echo ""
echo "4. Testing MiniBob authentication..."
TOKEN=$(curl -sf -X POST http://activity.metabob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' | jq -r .token)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ MiniBob authentication failed"
  exit 1
fi
echo "✓ MiniBob authenticated"

# 5. Test RBAC
echo ""
echo "5. Testing RBAC..."
curl -sf http://activity.metabob.local/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" > /dev/null || {
  echo "❌ RBAC failed"
  exit 1
}
echo "✓ RBAC working"

echo ""
echo "=== ✅ All validation checks passed ==="
```

## Next Steps

After validating deployment:

1. **Seed Activity Templates** (optional):
   ```bash
   cd vessels/metabob-activity-api
   bun run sql/seed-paradigm-templates.ts
   ```

2. **Access Dashboard:**
   ```bash
   open http://graph.metabob.local
   ```

3. **Start MiniBob:**
   ```bash
   kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
   ```

4. **Monitor Execution:**
   ```bash
   kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f
   ```
