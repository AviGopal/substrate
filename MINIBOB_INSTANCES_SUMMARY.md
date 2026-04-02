# MiniBob Instances - Summary

## Current Status

MiniBob instances are automatically created and managed via the SurrealDB init-data job in Kubernetes. The instances are defined in the `init-data-script` ConfigMap and created idempotently when the cluster deploys.

## Pre-Configured Instances

The following instances are already configured in the deployment:

| Instance ID | API Key | Organization | Vessel ID | Purpose |
|-------------|---------|---------------|-----------|---------|
| `minibob-local-001` | `mb_inst_local_879...` | metabob | `minibob-k8s-local` | Local development |
| `minibob-canary-001` | `mb_inst_canary_03b...` | metabob | `minibob-k8s-canary` | Canary deployments |
| `minibob-production-001` | `mb_inst_prod_51fc...` | metabob | `minibob-k8s-production` | Production |

**Note**: API key hashes are generated from the hashed strings shown in `init-data-script` ConfigMap.

## Architecture

### Database Structure

**Table**: `minibob_instance`
- `instance_id` (unique): Identifier like `minibob-local-001`
- `org_id` (string): Organization scope (e.g., `metabob`)
- `project_id` (optional): Project scope if needed
- `api_key_hash` (string): Argon2-hashed API key
- `vessel_id` (string): Vessel identifier (e.g., `minibob-k8s-local`)
- `is_active` (boolean): Whether instance can authenticate
- `created_at` (datetime): Creation timestamp
- `last_active_at` (datetime): Last authentication timestamp

### Authentication Flow

```
┌─────────────┐
│  MiniBob    │ Sends: instance_id + api_key
│   Client    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────┐
│  Identity Vessel (Public)    │
│  POST /v1/auth/minibob/signin│
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  SurrealDB minibob_record     │
│  ACCESS METHOD                │
│  - Verifies instance_id       │
│  - Compares api_key hash      │
│  - Returns JWT token          │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────┐
│  JWT Token   │ With org_id in claims
│  24h valid   │ Can access activity backend
└──────────────┘
```

## Setting Up MiniBob with Instances

### Option 1: Using Kubernetes Port Forward

```bash
# Terminal 1: Set up port forward to SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# Terminal 2: Configure MiniBob
mkdir -p ~/.metabob

cat > ~/.metabob/config.json << 'EOF'
{
  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "mb_inst_local_879a7c1920f58aa9c67c584f7ca3f1c963e10c6af9e83c3d596890a1100a95f7",
    "orgId": "metabob"
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    }
  }
}
EOF

# Terminal 2: Run MiniBob
minibob --single "Your development goal here"
```

### Option 2: Using Environment Variables

```bash
# With port forward to SurrealDB
export MINIBOB_INSTANCE_ID="minibob-local-001"
export MINIBOB_INSTANCE_API_KEY="mb_inst_local_879a7c1920f58aa9c67c584f7ca3f1c963e10c6af9e83c3d596890a1100a95f7"
export MINIBOB_ORG_ID="metabob"
export ACTIVITY_API_ENDPOINT="https://activity.metabob.com"

minibob --single "Your goal"
```

### Option 3: Per-Project Config

In your project root, create `.metabob/config.json`:

```json
{
  "instance": {
    "instanceId": "minibob-local-dev",
    "apiKey": "mb_inst_canary_03b4cfa7ef9bf84b90b7a25d74bd91975ba1a5c67e10b7d8220d8b3559d2463e"
  },
  "defaults": {
    "workingDirectory": ".",
    "autoCommit": false
  }
}
```

Then run MiniBob from that directory - it will use the project config.

## Verifying Instances

### Check Instance Registration

Query the minibob_instance table via kubectl:

```bash
kubectl exec -n activity-system svc/surrealdb -- \
  surreal sql \
    --endpoint http://localhost:8000 \
    --username root \
    --password $SURREALDB_PASSWORD \
    --namespace activity-system \
    --database learning_loop \
    "SELECT instance_id, org_id, vessel_id, is_active FROM minibob_instance;"
```

### Test Authentication

Using port forward to identity-vessel:

```bash
kubectl port-forward -n activity-system svc/identity-vessel 8080:8080 &

curl -X POST http://localhost:8080/v1/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "minibob-local-001",
    "api_key": "mb_inst_local_879a7c1920f58aa9c67c584f7ca3f1c963e10c6af9e83c3d596890a1100a95f7"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "org_id": "metabob",
    "project_id": null
  }
}
```

## Adding New Instances

### Method 1: Update init-data ConfigMap (Persistent)

Edit the init-data script in ConfigMap:

```bash
# Extract current ConfigMap
kubectl get configmap init-data-script -n activity-system -o jsonpath='{.data}' > init-data.json

# Edit init-data.json to add new instances, then apply
kubectl create configmap init-data-script \
  -n activity-system \
  --from-file init-data.json \
  --dry-run=client -o yaml | kubectl apply -f -

# Trigger re-initialization
kubectl rollout restart statefulset surrealdb -n activity-system
```

### Method 2: Direct Database Insertion (Temporary)

Using port forward:

```bash
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &

# Create new instance via SurrealDB SQL
surreal sql \
  --endpoint http://localhost:8000 \
  --username root \
  --password $SURREALDB_PASSWORD \
  --namespace activity-system \
  --database learning_loop \
  << 'EOF'

CREATE minibob_instance SET
  instance_id = "minibob-custom-001",
  org_id = "metabob",
  api_key_hash = crypto::argon2::generate("my-secret-api-key"),
  vessel_id = "minibob-custom",
  is_active = true,
  created_at = time::now(),
  last_active_at = time::now();

EOF
```

**Note**: This is temporary. On cluster restart, custom instances will be lost. Use Method 1 for persistent instances.

## Troubleshooting

### Problem: "Instance not found" (404 error)

```
curl -X POST http://localhost:8080/v1/auth/minibob/signin ...
→ "error": "Instance not found"
```

**Cause**: Instance ID doesn't exist in minibob_instance table

**Solution**:
1. Verify instance exists: `SELECT * FROM minibob_instance WHERE instance_id = "minibob-local-001"`
2. Check organization is correct: Instance uses `org_id`, not `org_name`
3. Recreate instance if needed using Method 1 or 2 above

### Problem: "Invalid credentials" (401 error)

```
curl ... → "error": "credentials were invalid"
```

**Cause**: API key hash doesn't match

**Solution**:
1. Verify exact API key from ConfigMap (case-sensitive)
2. API keys are hashed, so you must use the original key, not the hash
3. For custom instances, use the same key you pass to `crypto::argon2::generate()`

### Problem: Connection refused to SurrealDB

**Solution**:
1. Ensure port forward is running: `kubectl port-forward -n activity-system svc/surrealdb 8000:8000`
2. Check SurrealDB pod is running: `kubectl get pods -n activity-system -l app=surrealdb`
3. Check namespace is correct: `activity-system` (not `default`)

### Problem: Organization not found

**Cause**: Instances are scoped to organizations. Default is `metabob`

**Solution**:
1. Check organization exists: `SELECT * FROM organizations WHERE org_id = "metabob"`
2. For custom organization, create it first:
   ```bash
   UPDATE organizations:my-org SET
     name = "My Organization",
     created_at = time::now()
   ```

## Configuration Priority

MiniBob resolves configuration in this order (highest to lowest):

1. **Environment variables** (e.g., `MINIBOB_INSTANCE_ID`)
2. **Project config** (`.metabob/config.json`)
3. **User config** (`~/.metabob/config.json`)
4. **Defaults** (hardcoded in MiniBob)

Example: If `MINIBOB_INSTANCE_ID` is set, it overrides all config files.

## Next Steps

1. **Choose instance**: Select one from pre-configured instances or create custom
2. **Set up port forward**: `kubectl port-forward -n activity-system svc/surrealdb 8000:8000`
3. **Configure MiniBob**: Add config to `~/.metabob/config.json` or environment
4. **Test authentication**: Verify instance can authenticate via identity-vessel
5. **Run MiniBob**: `minibob --single "Your goal"`
6. **Monitor**: Check dashboard at `http://dashboard.minibob.local` (via port forward or .local domain)

## Related Files

- [`CONFIGURATION_GUIDE.md`](./CONFIGURATION_GUIDE.md) - Comprehensive MiniBob configuration
- [`MINIBOB_INSTANCES_GUIDE.md`](./MINIBOB_INSTANCES_GUIDE.md) - Detailed instance management guide
- [`add-minibob-instances.ts`](./add-minibob-instances.ts) - Script for creating instances (for manual use)
- [`add-instances-job.yaml`](./add-instances-job.yaml) - Kubernetes Job for batch instance creation
- `repos/metabob-activity-api/sql/000-auth-schema.surql` - Database authentication schema
- `repos/identity-vessel/src/index.ts` - Identity/authentication service

## Key Files in Kubernetes

- `ConfigMap: init-data-script` - Contains SurrealQL to create instances
- `Secret: metabob-activity-api` - Contains SurrealDB credentials
- `StatefulSet: surrealdb` - SurrealDB database
- `Deployment: identity-vessel` - Authentication service
- `Pod: minibob-*` - Running MiniBob instances
