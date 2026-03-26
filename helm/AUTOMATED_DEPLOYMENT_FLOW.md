# Automated SurrealDB Schema Deployment Flow

**Status:** ✅ Implemented and ready for testing

This document describes the proper automated deployment flow for SurrealDB with schema migrations in the metabob activity system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT SEQUENCE                       │
└─────────────────────────────────────────────────────────────┘

1. REDIS (Valkey)
   └─> In-memory cache for Thompson Sampling
       Ready immediately (no persistence)

2. SURREALDB (wait: true, timeout: 900s)
   ├─> Secret Generation (Helm lookup pattern)
   │   ├─> First install: Random password generated
   │   └─> Upgrade: Existing secret preserved
   │
   ├─> StatefulSet Deployment
   │   ├─> args: start --user $(SURREAL_USER) --pass $(SURREAL_PASS)
   │   ├─> Persistent volume mounted at /data
   │   └─> Health check: /health on port 8000
   │
   └─> Migration Job (after StatefulSet ready)
       ├─> Wait for /health endpoint
       ├─> Run: bun run sql/migrate.ts
       ├─> Applies all schemas from metabob-proto
       └─> Helmfile waits for Job completion

3. METABOB-ACTIVITY-API
   └─> Starts after SurrealDB migration completes
       Schemas already applied ✓

4. MINIBOB + DASHBOARD + ISTIO GATEWAY
   └─> Start after API is ready
```

## Key Components

### 1. Secret Management (`charts/surrealdb/templates/secret.yaml`)

**Pattern: Helm Lookup Function**

```yaml
{{- $secret := lookup "v1" "Secret" .Release.Namespace (printf "%s-credentials" .Values.name) }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.name }}-credentials
data:
  username: {{ if $secret }}{{ index $secret.data "username" }}{{ else }}{{ .Values.auth.username | b64enc }}{{ end }}
  password: {{ if $secret }}{{ index $secret.data "password" }}{{ else }}{{ randAlphaNum 32 | b64enc }}{{ end }}
```

**Behavior:**
- **First install**: Generates random 32-character password
- **Upgrades**: Preserves existing secret (no password regeneration)
- **Manual override**: Set `auth.password` in values to use specific password

### 2. Migration Job (`charts/surrealdb/templates/migration-job.yaml`)

**Pattern: Regular Job (NOT Helm Hook)**

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Values.name }}-migration-{{ .Release.Revision }}
spec:
  backoffLimit: 10  # Retry up to 10 times
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          command:
            - /bin/sh
            - -c
            - |
              # Wait for SurrealDB /health endpoint
              until curl -f http://surrealdb:8000/health; do
                sleep 2
              done
              # Run migrations
              bun run sql/migrate.ts
```

**Key Features:**
- Waits for SurrealDB health check before connecting
- Uses same credentials as SurrealDB (from secret)
- Includes metabob-proto schemas in image
- Retries on failure (backoffLimit: 10)
- Unique name per release revision

**Why NOT a Helm hook?**
- Hooks run before readiness probes complete
- Can't reliably wait for SurrealDB to be ready
- Regular Job with health check wait is more reliable

### 3. SurrealDB Connection Pattern

**Correct SDK pattern for SurrealDB 3.x:**

```typescript
import { Surreal } from 'surrealdb';

const db = new Surreal();

// 1. Connect (no auth yet)
await db.connect('http://surrealdb:8000');

// 2. Use namespace/database
await db.use({
  namespace: 'activity-system',
  database: 'learning_loop'
});

// 3. Signin with credentials
await db.signin({
  username: process.env.SURREALDB_USERNAME,
  password: process.env.SURREALDB_PASSWORD,
});

// 4. Now authenticated - can query
await db.query('SELECT * FROM activity_template;');
```

**Common mistakes to avoid:**
- ❌ Auth in connect options (doesn't work in 3.x)
- ❌ Signin before use (fails)
- ❌ Using `user`/`pass` instead of `username`/`password`
- ❌ Using `--auth` flag in SurrealDB args (doesn't exist)

### 4. Helmfile Configuration

**Release-specific settings:**

```yaml
- name: surrealdb
  chart: ./charts/surrealdb
  wait: true          # Wait for ALL resources including Jobs
  timeout: 900        # 15 minutes for StatefulSet + migration
  values:
    - migration:
        enabled: true  # Enable migration Job
        image:
          repository: metabob-activity-api
          tag: "v2-fixed"
```

**Dependency chain:**

```yaml
redis (no dependencies)
  └─> surrealdb (needs: redis)
      ├─> Secret created
      ├─> StatefulSet deployed
      └─> Migration Job runs (wait: true blocks here)
          └─> metabob-activity-api (needs: surrealdb)
              └─> minibob (needs: metabob-activity-api)
                  └─> istio-gateway (needs: metabob-activity-api, dashboard)
```

## Deployment Procedure

### Prerequisites

1. **Build images** (includes metabob-proto schemas):
   ```bash
   cd repos/metabob-activity-api
   docker build -f Dockerfile -t metabob-activity-api:v2-fixed ../
   ```

2. **Set environment variables**:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   export SURREALDB_USERNAME="root"  # Optional
   export SURREALDB_PASSWORD=""      # Leave empty for auto-generation
   ```

### Deploy (Idempotent)

**Using convenience script:**
```bash
cd helm
./deploy.sh           # Normal deploy (idempotent)
./deploy.sh --clean   # Clean deploy (deletes PVCs/secrets first)
```

**Manual:**
```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

### Destroy (Full Cleanup)

**Using convenience script:**
```bash
cd helm
./destroy.sh            # Full cleanup including PVCs
./destroy.sh --keep-data  # Keep PVCs for data preservation
```

**Manual:**
```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl destroy
# PVCs are auto-deleted by postuninstall hooks
```

**What happens:**
1. Redis deploys immediately
2. SurrealDB secret created (random password if new)
3. SurrealDB StatefulSet starts
4. Health check passes
5. Migration Job starts
6. Migration waits for /health endpoint
7. Migration applies all schemas
8. Migration Job completes
9. Helmfile marks surrealdb release ready
10. metabob-activity-api starts
11. Schemas already exist ✓

### Verify

```bash
# Check migration Job status
kubectl get jobs -n activity-system | grep migration

# Check migration logs
kubectl logs -n activity-system -l app.kubernetes.io/component=migration

# Check SurrealDB logs for auth
kubectl logs surrealdb-0 -n activity-system | grep -i "auth\|user"

# Verify schemas applied
kubectl run test -n activity-system --rm -i --image=metabob-activity-api:v2-fixed --restart=Never -- \
  bun run sql/migrate.ts
```

## Troubleshooting

### Issue: Migration Job fails with auth error

**Cause:** Persistent volume has old credentials

**Solution:**
```bash
# Delete PVC to clear old data
kubectl delete pvc data-surrealdb-0 -n activity-system
kubectl delete pod surrealdb-0 -n activity-system
# StatefulSet will recreate with new credentials
```

### Issue: Migration Job stuck waiting

**Cause:** SurrealDB not ready (still initializing)

**Check:**
```bash
kubectl logs -n activity-system -l app.kubernetes.io/component=migration
# Should show: "Waiting for SurrealDB..."
```

**Solution:** Wait or check SurrealDB logs:
```bash
kubectl logs surrealdb-0 -n activity-system
```

### Issue: "Cannot perform subtraction with 'NONE' and 'NONE'"

**Cause:** Wrong DURATION syntax in schema files

**Fix:** Use comma-separated format:
```sql
# ❌ WRONG
DURATION FOR TOKEN 15m
DURATION FOR SESSION 12h;

# ✅ CORRECT
DURATION FOR TOKEN 15m, FOR SESSION 12h;
```

### Issue: Random password changes on every upgrade

**Cause:** Not using Helm lookup function

**Fix:** Ensure secret.yaml uses lookup pattern (already implemented)

## Files Modified

1. **helm/activity-system-minimal.yaml.gotmpl**
   - Added `wait: true` to surrealdb release
   - Added `timeout: 900` for migration time
   - Added `migration.enabled: true`

2. **helm/charts/surrealdb/templates/secret.yaml** (NEW)
   - Helm lookup pattern for secret preservation
   - Random password generation on first install

3. **helm/charts/surrealdb/templates/migration-job.yaml**
   - Changed from Helm hook to regular Job
   - Added health check wait loop
   - Increased backoffLimit to 10
   - Changed restartPolicy to OnFailure

4. **helm/charts/surrealdb/values.yaml**
   - Added `migration.enabled: false` (default off)
   - Added migration image configuration

5. **repos/metabob-activity-api/Dockerfile**
   - Changed build context to include metabob-proto
   - Added schemas to image

6. **repos/metabob-activity-api/sql/migrate.ts**
   - Fixed connection pattern (connect → use → signin)
   - Added production path resolution
   - Added waitForDatabase retry logic

7. **repos/metabob-proto/surrealdb/core/001-auth-access.surql**
   - Fixed DURATION syntax

## References

- [PROPER_SURREALDB_K8S_SETUP.md](../openspec/changes/surrealdb-multi-tenant-schema/PROPER_SURREALDB_K8S_SETUP.md): Comprehensive research and patterns
- [SurrealDB Kubernetes Deployment](https://surrealdb.com/docs/surrealdb/deployment/kubernetes)
- [Helmfile Best Practices](https://helmfile.readthedocs.io/en/latest/)
- [Helm Lookup Function](https://helm.sh/docs/chart_template_guide/functions_and_pipelines/)

## Idempotency Guarantees

**Deploy (helmfile sync):**
- ✅ Running multiple times is safe
- ✅ Only applies necessary changes
- ✅ Uses `upgrade --install` pattern
- ✅ Atomic: rolls back on failure
- ✅ Secret preservation via Helm lookup

**Destroy (helmfile destroy):**
- ✅ Removes all Helm releases
- ✅ PVC cleanup via postuninstall hooks
- ✅ `--ignore-not-found` prevents errors on re-run
- ⚠️ PVCs deleted = data loss (use `--keep-data` to preserve)

**Cleanup Hooks:**

The helmfile includes `postuninstall` hooks that automatically clean up:
- SurrealDB PVCs: `kubectl delete pvc -l app=surrealdb`
- MiniBob PVCs: `kubectl delete pvc -l app.kubernetes.io/name=minibob`
- Orphaned migration jobs

## Files Summary

| File | Purpose |
|------|---------|
| `deploy.sh` | Deploy with optional `--clean` for fresh start |
| `destroy.sh` | Full cleanup with optional `--keep-data` |
| `activity-system-minimal.yaml.gotmpl` | Main helmfile |
| `charts/surrealdb/templates/secret.yaml` | Secret with lookup pattern |
| `charts/surrealdb/templates/migration-job.yaml` | Schema migration job |
| `charts/surrealdb/templates/statefulset.yaml` | SurrealDB StatefulSet |

## Sources

Based on best practices from:
- [Helmfile Documentation](https://helmfile.readthedocs.io/)
- [Helm Best Practices](https://codersociety.com/blog/articles/helm-best-practices)
- [Helm PVC Cleanup Discussion](https://github.com/helm/helm/issues/5156)
- [SurrealDB Kubernetes Deployment](https://surrealdb.com/docs/surrealdb/deployment/kubernetes)
