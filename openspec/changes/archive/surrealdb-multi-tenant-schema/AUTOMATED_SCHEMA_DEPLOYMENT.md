# Automated Schema Deployment

**Status:** ✅ Complete
**Date:** 2026-03-24

## Overview

SurrealDB schemas are now deployed automatically via Helm hooks. No manual schema application required.

## Architecture

```
helmfile deploy
      │
      ├──> Migration Job (hook-weight: 5)
      │    ├── Apply core schemas (organizations, users, projects, auth)
      │    ├── Apply activity schemas (templates, executions, learning)
      │    ├── Backfill org_id on existing records
      │    └── Record migration version
      │
      └──> Init-Data Job (hook-weight: 10)
           ├── Create default organization
           └── Create MiniBob instance with API key
```

## Components

### 1. Migration Job

**File:** `helm/charts/surrealdb/templates/migration-job.yaml`

**What it does:**
- Runs `repos/metabob-activity-api/sql/migrate.ts`
- Applies core schemas from `repos/metabob-proto/surrealdb/core/`
- Applies activity schemas from `repos/metabob-activity-api/sql/schemas/`
- Backfills org_id on existing records (idempotent)
- Records migration in schema_version table

**When it runs:**
- Post-install: After SurrealDB StatefulSet is ready
- Post-upgrade: After SurrealDB is upgraded
- Hook-weight: 5 (before init-data)

**Image requirements:**
- Must contain metabob-proto schemas at `/app/repos/metabob-proto/surrealdb/core/`
- Built from `repos/` context (not `repos/metabob-activity-api/`)

### 2. Init-Data Job

**File:** `helm/charts/surrealdb/templates/init-data-job.yaml`

**What it does:**
- Runs `repos/metabob-activity-api/sql/init-test-data.ts`
- Creates default organization (organizations:metabob_internal)
- Creates MiniBob instance (minibob-local-001) with Argon2-hashed API key
- Idempotent (checks before creating)

**When it runs:**
- Post-install: After migration Job completes
- Post-upgrade: After migration Job completes
- Hook-weight: 10 (after migrations)

## Building Images

The metabob-activity-api image must be built from the `repos/` parent directory:

```bash
# Using build script (recommended)
./scripts/build-vessels.sh metabob-activity-api

# Or manually
cd repos
docker build -f metabob-activity-api/Dockerfile -t metabob-activity-api:latest .
```

**Why?** The Dockerfile copies metabob-proto as a sibling directory:

```dockerfile
# Copy metabob-proto for schema migrations
COPY metabob-proto ./repos/metabob-proto
```

Building from `repos/metabob-activity-api/` would fail - Docker can't access parent directories.

### Dockerfile Changes

**Before:**
```dockerfile
WORKDIR /app
COPY package.json bun.lock* ./
COPY src ./src
COPY sql ./sql
```

**After:**
```dockerfile
WORKDIR /app
COPY metabob-activity-api/package.json metabob-activity-api/bun.lock* ./
COPY metabob-activity-api/src ./src
COPY metabob-activity-api/sql ./sql
COPY metabob-proto ./repos/metabob-proto  # ← NEW
```

### Migration Script Changes

**Before:**
```typescript
const protoPath = process.env.METABOB_PROTO_PATH ||
  join(process.cwd(), '..', 'metabob-proto', 'surrealdb', 'core');
```

**After:**
```typescript
const protoPath = process.env.METABOB_PROTO_PATH ||
  (process.env.NODE_ENV === 'production'
    ? '/app/repos/metabob-proto/surrealdb/core'  // ← Container path
    : join(process.cwd(), '..', 'metabob-proto', 'surrealdb', 'core')); // ← Local dev
```

### Build Script Changes

**File:** `scripts/build-vessels.sh`

Added special handling for metabob-activity-api:

```bash
if [ "$vessel_name" = "metabob-activity-api" ]; then
  cd "$ROOT_DIR/repos"
  docker build -f metabob-activity-api/Dockerfile -t "$vessel_name:dev" .
else
  cd "$full_path"
  docker build -t "$vessel_name:dev" .
fi
```

## Deployment Flow

### 1. Build Image

```bash
./scripts/build-vessels.sh metabob-activity-api
```

Verifies schemas in image:
```bash
docker run --rm metabob-activity-api:latest \
  ls -la /app/repos/metabob-proto/surrealdb/core/

# Output:
# 000-schema-version.surql
# 001-auth-access.surql
# 002-organizations.surql
# 003-projects.surql
# 004-subscriptions.surql
```

### 2. Deploy Stack

```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

Helm installs/upgrades in this order:
1. **SurrealDB StatefulSet** - Database pod starts
2. **Migration Job** (hook-weight: 5) - Schemas applied
3. **Init-Data Job** (hook-weight: 10) - Org and instance created
4. **metabob-activity-api Deployment** - API server starts
5. **Other services** - MiniBob, dashboard, etc.

### 3. Verify Deployment

```bash
# Check migration Job succeeded
kubectl get jobs -n activity-system surrealdb-schema-migration
# NAME                          COMPLETIONS   DURATION   AGE
# surrealdb-schema-migration    1/1           15s        2m

# Check init-data Job succeeded
kubectl get jobs -n activity-system surrealdb-init-data
# NAME                    COMPLETIONS   DURATION   AGE
# surrealdb-init-data     1/1           8s         2m

# View migration logs
kubectl logs -n activity-system job/surrealdb-schema-migration

# View init-data logs
kubectl logs -n activity-system job/surrealdb-init-data

# Query schema version
kubectl run test-version -n activity-system \
  --image=metabob-activity-api:latest --rm -i --restart=Never \
  -- bun -e "
import { Surreal } from 'surrealdb';
const db = new Surreal();
await db.connect('http://surrealdb:8000');
await db.signin({ username: 'root', password: 'changeme' });
await db.use({ namespace: 'activity-system', database: 'learning_loop' });
const result = await db.query('SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 1;');
console.log(JSON.stringify(result, null, 2));
"
```

## Idempotency

Both Jobs are idempotent - safe to run multiple times:

**Migration Job:**
- `DEFINE TABLE IF NOT EXISTS`
- `DEFINE INDEX IF NOT EXISTS`
- Backfill checks `WHERE org_id IS NONE`
- Schema version tracking prevents duplicate migrations

**Init-Data Job:**
- Checks if org exists: `SELECT * FROM organizations WHERE id = organization:metabob_internal`
- Checks if instance exists: `SELECT * FROM minibob_instance WHERE instance_id = 'minibob-local-001'`
- Creates only if not found

## Troubleshooting

### Migration Job Failed

```bash
# Check Job status
kubectl describe job -n activity-system surrealdb-schema-migration

# View logs
kubectl logs -n activity-system job/surrealdb-schema-migration

# Common issues:
# 1. SurrealDB not ready → Job retries (backoffLimit: 3)
# 2. Schemas not in image → Rebuild with correct context
# 3. Namespace doesn't exist → Migration creates it automatically
```

### Init-Data Job Failed

```bash
# Check Job status
kubectl describe job -n activity-system surrealdb-init-data

# View logs
kubectl logs -n activity-system job/surrealdb-init-data

# Common issues:
# 1. Migrations didn't run → Check migration Job completed first
# 2. Secret not found → Create minibob-instance-credentials secret
# 3. Duplicate org → Idempotent, shouldn't fail, check logs
```

### Schemas Not in Image

```bash
# Verify schemas exist
docker run --rm metabob-activity-api:latest ls -la /app/repos/metabob-proto/surrealdb/core/

# If missing, rebuild from correct context:
cd repos
docker build --no-cache -f metabob-activity-api/Dockerfile -t metabob-activity-api:latest .
```

## Configuration

**SurrealDB Chart Values:**

```yaml
# helm/charts/surrealdb/values.yaml

migration:
  image:
    repository: metabob-activity-api
    tag: latest
    pullPolicy: IfNotPresent

initData:
  enabled: true
  backoffLimit: 3
  image:
    repository: metabob-activity-api
    tag: latest
    pullPolicy: IfNotPresent
  defaultOrg:
    id: metabob_internal
    name: "Metabob Internal"
  minibob:
    instanceId: minibob-local-001
    vesselId: minibob-cli-local
    secretName: minibob-instance-credentials
    secretKey: api-key
```

## Documentation

- **Helm Chart README:** `helm/charts/surrealdb/README.md`
- **Migration Guide:** `repos/metabob-activity-api/sql/README.md` (TODO)
- **Phase 6 Testing Guide:** `PHASE_6_TESTING_GUIDE.md`

## Benefits

✅ **No manual schema application** - Schemas applied automatically on deploy
✅ **Idempotent** - Safe to redeploy, won't duplicate data
✅ **Versioned** - Migration tracking in schema_version table
✅ **Atomic** - Migration fails → deployment fails → rollback
✅ **Consistent** - Same process in dev, staging, production
✅ **Auditable** - Job logs captured via kubectl
✅ **Testable** - Can verify schemas before deploying services

## Next Steps

- [ ] Add migration rollback capability (migrate.ts --rollback)
- [ ] Add schema validation tests (verify all tables have org_id)
- [ ] Add migration dry-run in CI/CD pipeline
- [ ] Create production secrets (replace test-api-key-123)
- [ ] Document schema evolution process
- [ ] Add migration performance metrics

## Related Changes

- **Dockerfile:** `repos/metabob-activity-api/Dockerfile` (multi-repo context)
- **Migration Script:** `repos/metabob-activity-api/sql/migrate.ts` (production path)
- **Build Script:** `scripts/build-vessels.sh` (special handling for activity-api)
- **Migration Job:** `helm/charts/surrealdb/templates/migration-job.yaml` (NEW)
- **Init-Data Job:** `helm/charts/surrealdb/templates/init-data-job.yaml` (existing)
- **Values:** `helm/charts/surrealdb/values.yaml` (migration config)
- **README:** `helm/charts/surrealdb/README.md` (documentation)
