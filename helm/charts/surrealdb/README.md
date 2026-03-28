# SurrealDB Helm Chart

Deploys SurrealDB 3.0 with automated schema initialization and data seeding.

## Overview

This chart provides:
- **SurrealDB 3.0** StatefulSet with persistent storage
- **Automated init-data Job** for organization and instance creation
- **RBAC support** with DEFINE ACCESS configurations
- **Secret management** for credentials and API keys

## Quick Start

```bash
# Deploy with default values
helm install surrealdb ./helm/charts/surrealdb -n activity-system --create-namespace

# Deploy with custom values
helm install surrealdb ./helm/charts/surrealdb -n activity-system \
  --set auth.password=my-secure-password \
  --set initData.defaultOrg.name="My Organization"
```

## Configuration

### Basic Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `name` | Release name | `surrealdb` |
| `namespace` | Kubernetes namespace | `activity-system` |
| `image.repository` | SurrealDB image | `surrealdb/surrealdb` |
| `image.tag` | SurrealDB version | `v3.0.0` |
| `service.type` | Service type | `ClusterIP` |
| `service.port` | Service port | `8000` |

### Persistence

| Parameter | Description | Default |
|-----------|-------------|---------|
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.storageClass` | Storage class (empty = default) | `""` |
| `persistence.size` | Volume size | `10Gi` |
| `persistence.accessMode` | Access mode | `ReadWriteOnce` |

### Database Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `database.namespace` | SurrealDB namespace | `activity-system` |
| `database.name` | Database name | `learning_loop` |
| `database.storage.backend` | Storage backend (file, memory, tikv) | `file` |
| `database.storage.path` | Storage path for file backend | `/data/surrealdb` |

### Authentication

| Parameter | Description | Default |
|-----------|-------------|---------|
| `auth.existingSecret` | Use existing secret (empty = auto-create) | `""` |
| `auth.username` | Root username | `root` |
| `auth.password` | Root password | `changeme` |
| `auth.usernameKey` | Secret key for username | `username` |
| `auth.passwordKey` | Secret key for password | `password` |

**⚠️ Production:** Always use a secure password and store in a Kubernetes secret!

### Init-Data Job

| Parameter | Description | Default |
|-----------|-------------|---------|
| `initData.enabled` | Enable init-data Job | `true` |
| `initData.backoffLimit` | Job retry limit | `3` |
| `initData.image.repository` | Init script image | `metabob-activity-api` |
| `initData.image.tag` | Image tag | `latest` |
| `initData.defaultOrg.id` | Default organization ID | `metabob_internal` |
| `initData.defaultOrg.name` | Default organization name | `Metabob Internal` |
| `initData.minibob.instanceId` | MiniBob instance ID | `minibob-local-001` |
| `initData.minibob.vesselId` | MiniBob vessel ID | `minibob-cli-local` |
| `initData.minibob.secretName` | API key secret name | `minibob-instance-credentials` |
| `initData.minibob.secretKey` | API key secret key | `api-key` |

## Automated Schema Deployment

The chart deploys schemas automatically via two Helm hook Jobs that run in sequence during install/upgrade:

### 1. Migration Job (hook-weight: 5)

Applies database schemas before data initialization.

**What it does:**
1. Applies core schemas from metabob-proto (organizations, users, projects, auth)
2. Applies activity-specific schemas (templates, executions, learning data)
3. Runs data migrations (backfills org_id on existing records)
4. Records migration version in schema_version table

**Configuration:**
```yaml
migration:
  image:
    repository: metabob-activity-api
    tag: latest
    pullPolicy: IfNotPresent
```

**Image requirements:**
- Contains `repos/metabob-proto/surrealdb/core/` schemas
- Contains `sql/migrate.ts` migration runner
- Built with repos/ as context (see Building Images below)

**Environment variables:**
- `SURREALDB_URL`, `SURREALDB_NAMESPACE`, `SURREALDB_DATABASE`
- `SURREALDB_USERNAME`, `SURREALDB_PASSWORD` (from secret)
- `NODE_ENV=production` (uses /app/repos/metabob-proto path)

**Troubleshooting:**
```bash
# View migration logs
kubectl logs -n activity-system job/surrealdb-schema-migration

# Check schema version
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

### 2. Init-Data Job (hook-weight: 10)

Creates default organization and MiniBob instance records after schema migrations.

**How It Works:**

1. **Runs as Helm hook** - `post-install` and `post-upgrade` with `hook-weight: 10`
2. **Executes after migrations** - Migration Job completes at hook-weight 5
3. **Idempotent** - Safe to run multiple times, checks before creating
4. **Auto-cleanup** - Old Job instances deleted before new runs

### What It Creates

**Organization Record:**
```sql
CREATE organizations:metabob_internal SET
  name = 'Metabob Internal',
  created_at = time::now(),
  updated_at = time::now();
```

**MiniBob Instance Record:**
```sql
CREATE minibob_instance SET
  instance_id = 'minibob-local-001',
  org_id = organization:metabob_internal,
  project_id = NONE,
  api_key_hash = crypto::argon2::generate('test-api-key-123'),
  vessel_id = 'minibob-cli-local',
  is_active = true,
  created_at = time::now(),
  last_active_at = time::now();
```

### Environment Variables

The Job receives these from Helm values:

```yaml
SURREALDB_URL: "http://surrealdb.activity-system.svc.cluster.local:8000"
SURREALDB_NAMESPACE: "activity-system"
SURREALDB_DATABASE: "learning_loop"
SURREALDB_USERNAME: <from-secret>
SURREALDB_PASSWORD: <from-secret>
DEFAULT_ORG_ID: "metabob_internal"
DEFAULT_ORG_NAME: "Metabob Internal"
MINIBOB_INSTANCE_ID: "minibob-local-001"
MINIBOB_API_KEY: <from-secret>
MINIBOB_VESSEL_ID: "minibob-cli-local"
```

## Secrets

### Auto-Created Secrets

If `auth.existingSecret` is empty, the chart creates:

**surrealdb-credentials:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: surrealdb-credentials
stringData:
  username: root
  password: changeme  # ⚠️ Change in production!
```

**minibob-instance-credentials:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: minibob-instance-credentials
stringData:
  api-key: test-api-key-123  # ⚠️ Change in production!
```

### Using Existing Secrets

For production, create secrets manually:

```bash
# SurrealDB credentials
kubectl create secret generic surrealdb-prod-creds \
  --from-literal=username=root \
  --from-literal=password=$(openssl rand -base64 32) \
  -n activity-system

# MiniBob instance API key
kubectl create secret generic minibob-prod-creds \
  --from-literal=api-key=$(openssl rand -base64 32) \
  -n activity-system
```

Then reference in values:

```yaml
auth:
  existingSecret: "surrealdb-prod-creds"

initData:
  minibob:
    secretName: "minibob-prod-creds"
```

## Examples

### Development Setup

```yaml
# values-dev.yaml
auth:
  password: "dev-password-123"

initData:
  enabled: true
  defaultOrg:
    id: "dev_org"
    name: "Development Organization"
  minibob:
    instanceId: "minibob-dev-001"
```

Deploy:
```bash
helm install surrealdb ./charts/surrealdb -n dev -f values-dev.yaml
```

### Production Setup

```yaml
# values-prod.yaml
persistence:
  storageClass: "fast-ssd"
  size: 100Gi

resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "8Gi"
    cpu: "4000m"

auth:
  existingSecret: "surrealdb-prod-creds"

initData:
  enabled: true
  minibob:
    secretName: "minibob-prod-creds"
```

Deploy:
```bash
# Create secrets first
kubectl create secret generic surrealdb-prod-creds \
  --from-literal=username=root \
  --from-literal=password=$(openssl rand -base64 32)

kubectl create secret generic minibob-prod-creds \
  --from-literal=api-key=$(openssl rand -base64 32)

# Deploy
helm install surrealdb ./charts/surrealdb -n production -f values-prod.yaml
```

## Troubleshooting

### Init-Data Job Failed

**Check Job status:**
```bash
kubectl get jobs -n activity-system
kubectl describe job surrealdb-init-data -n activity-system
```

**View Job logs:**
```bash
kubectl logs -n activity-system job/surrealdb-init-data
```

**Common issues:**

1. **SurrealDB not ready**
   - Job will retry (backoffLimit: 3)
   - Wait for SurrealDB pod: `kubectl wait --for=condition=ready pod -l app=surrealdb -n activity-system`

2. **Schema not migrated**
   - Init-data runs after migrations
   - Check migration job ran first: `kubectl get jobs -n activity-system`

3. **Wrong credentials**
   - Verify secret exists: `kubectl get secret surrealdb-credentials -n activity-system`
   - Check password: `kubectl get secret surrealdb-credentials -o jsonpath='{.data.password}' | base64 -d`

4. **Image not found**
   - Ensure metabob-activity-api:latest image is built and available
   - Check imagePullPolicy: Set to `Never` for local images

### Verify Data Created

**Query organizations:**
```bash
kubectl run test-org -n activity-system \
  --image=metabob-activity-api:latest \
  --image-pull-policy=Never \
  --rm -i --restart=Never \
  --env="SURREALDB_URL=http://surrealdb:8000" \
  -- bun -e "
import { Surreal } from 'surrealdb';
const db = new Surreal();
await db.connect('http://surrealdb:8000');
await db.signin({ username: 'root', password: 'changeme' });
await db.use({ namespace: 'activity-system', database: 'learning_loop' });
const result = await db.query('SELECT * FROM organizations');
console.log(JSON.stringify(result, null, 2));
"
```

**Query instances:**
```bash
kubectl run test-instance -n activity-system \
  --image=metabob-activity-api:latest \
  --image-pull-policy=Never \
  --rm -i --restart=Never \
  --env="SURREALDB_URL=http://surrealdb:8000" \
  -- bun -e "
import { Surreal } from 'surrealdb';
const db = new Surreal();
await db.connect('http://surrealdb:8000');
await db.signin({ username: 'root', password: 'changeme' });
await db.use({ namespace: 'activity-system', database: 'learning_loop' });
const result = await db.query('SELECT * FROM minibob_instance');
console.log(JSON.stringify(result, null, 2));
"
```

### SurrealDB Pod Not Starting

**Check pod status:**
```bash
kubectl get pods -n activity-system -l app=surrealdb
kubectl describe pod -n activity-system -l app=surrealdb
```

**Common issues:**

1. **PVC not bound**
   ```bash
   kubectl get pvc -n activity-system
   ```
   - Check storage class exists
   - Verify node has available storage

2. **Permission errors**
   - StatefulSet uses fsGroup: 65532 for SurrealDB nonroot user
   - Check volume permissions in pod logs

3. **Resource limits**
   - Increase memory/CPU in values.yaml if pod is OOMKilled

## Building Images

The migration Job requires the `metabob-activity-api` image to be built with metabob-proto schemas included.

**Build from repo root:**

```bash
# Using build script (recommended)
./scripts/build-vessels.sh metabob-activity-api

# Or manually with correct context
cd repos
docker build -f metabob-activity-api/Dockerfile -t metabob-activity-api:latest .
```

**Why repos/ context?**

The Dockerfile copies metabob-proto schemas for migrations:
```dockerfile
# Copy metabob-proto for schema migrations
COPY metabob-proto ./repos/metabob-proto
```

Building from `repos/metabob-activity-api` would fail - metabob-proto is a sibling directory.

**Verify schemas in image:**

```bash
docker run --rm metabob-activity-api:latest ls -la /app/repos/metabob-proto/surrealdb/core/

# Expected output:
# 000-schema-version.surql
# 001-auth-access.surql
# 002-organizations.surql
# 003-projects.surql
# 004-subscriptions.surql
```

## Maintenance

### Backup Database

```bash
# Export full database
kubectl exec -n activity-system surrealdb-0 -- \
  surreal export \
  --conn http://localhost:8000 \
  --user root \
  --pass changeme \
  --ns metabob \
  --db learning_loop \
  /tmp/backup-$(date +%Y%m%d).surql

# Copy backup from pod
kubectl cp activity-system/surrealdb-0:/tmp/backup-*.surql ./backup.surql
```

### Restore Database

```bash
# Copy backup to pod
kubectl cp ./backup.surql activity-system/surrealdb-0:/tmp/restore.surql

# Import
kubectl exec -n activity-system surrealdb-0 -- \
  surreal import \
  --conn http://localhost:8000 \
  --user root \
  --pass changeme \
  --ns metabob \
  --db learning_loop \
  /tmp/restore.surql
```

### Upgrade Chart

```bash
# Update values
helm upgrade surrealdb ./charts/surrealdb -n activity-system -f values.yaml

# Init-data Job will run again via post-upgrade hook
# Idempotent - won't duplicate data
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           SurrealDB Helm Chart              │
└─────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌────────┐  ┌─────────┐  ┌──────────┐
   │StatefulSet│ Service │  │ Init-Data│
   │           │         │  │   Job    │
   └────┬──────┘ └────────┘  └────┬─────┘
        │                          │
        ▼                          ▼
   ┌────────┐              ┌──────────────┐
   │  PVC   │              │ Organizations│
   │ 10Gi   │              │  + Instance  │
   └────────┘              └──────────────┘
```

## Version History

- **v1.0.0** - Initial release with SurrealDB 3.0 and init-data Job
- **v1.1.0** - Added MiniBob instance creation
- **v1.2.0** - Idempotent init-data script

## License

MIT
