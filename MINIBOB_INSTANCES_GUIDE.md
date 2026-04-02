# MiniBob Instances Setup Guide

This guide explains how to create and configure MiniBob instances for development and production.

## Overview

MiniBob instances authenticate using:
- **instance_id**: Unique identifier (e.g., `minibob-local-001`)
- **api_key**: Secret key (e.g., `test-api-key-123`)
- **org_id**: Organization scope (e.g., `metabob_internal`)

These credentials are stored in the `minibob_instance` table with the API key hashed using Argon2.

## Creating Instances

### Quick Start

Run the instance creation script:

```bash
# With defaults (SurrealDB at localhost:8000)
bun add-minibob-instances.ts

# With custom SurrealDB endpoint
SURREALDB_URL=http://surql.metabob.local bun add-minibob-instances.ts

# With custom organization
DEFAULT_ORG_ID=my-org SURREALDB_PASSWORD=mypassword bun add-minibob-instances.ts
```

### Default Instances Created

The script creates these instances by default:

| Instance ID | API Key | Vessel ID | Purpose |
|-------------|---------|-----------|---------|
| `minibob-local-001` | `test-api-key-123` | `minibob-cli-local` | Local CLI development |
| `minibob-local-dev` | `dev-api-key-456` | `minibob-cli-dev` | Local development variant |
| `minibob-local-test` | `test-api-key-789` | `minibob-cli-test` | Local testing variant |
| `minibob-k8s-001` | `k8s-api-key-prod` | `minibob-k8s-prod` | Kubernetes production |

### Adding Custom Instances

Edit the `INSTANCES_TO_CREATE` array in `add-minibob-instances.ts`:

```typescript
const INSTANCES_TO_CREATE = [
  {
    instance_id: 'my-custom-instance',
    api_key: 'my-secret-api-key',
    vessel_id: 'my-vessel-id',
    description: 'Custom MiniBob instance'
  },
  // ... more instances
];
```

Then run the script.

## Configuring MiniBob to Use Instances

### User-Level Config (~/.metabob/config.json)

```json
{
  "instance": {
    "instanceId": "minibob-local-001",
    "apiKey": "test-api-key-123",
    "orgId": "metabob_internal"
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    }
  }
}
```

### Project-Level Config (.metabob/config.json)

```json
{
  "instance": {
    "instanceId": "minibob-local-dev",
    "apiKey": "dev-api-key-456"
  }
}
```

### Environment Variables

```bash
# Set instance credentials (highest priority)
export MINIBOB_INSTANCE_ID="minibob-local-001"
export MINIBOB_INSTANCE_API_KEY="test-api-key-123"
export MINIBOB_ORG_ID="metabob_internal"

# Run MiniBob
minibob --single "your goal"
```

## Verifying Instances

### Check Instance Exists

```bash
# Query directly in SurrealDB
curl -X POST http://surql.metabob.local/sql \
  -u 'root:surrealdb-local-dev-123' \
  -d 'SELECT instance_id, org_id, vessel_id, is_active FROM minibob_instance'
```

### Test Authentication

```bash
# Use curl to test MiniBob authentication
curl -X POST http://activity.metabob.local/v1/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "minibob-local-001",
    "api_key": "test-api-key-123"
  }'
```

Expected response:
```json
{
  "token": "eyJ...",
  "org_id": "metabob_internal",
  "project_id": null
}
```

### List All Instances

```bash
# Via SurrealDB
curl -X POST http://surql.metabob.local/sql \
  -u 'root:surrealdb-local-dev-123' \
  -d 'SELECT * FROM minibob_instance WHERE org_id = "metabob_internal"' | jq
```

## Troubleshooting

### Problem: "Instance not found" (404)

**Cause**: Instance ID doesn't exist in database

**Solution**:
1. Check instance ID spelling: `bun add-minibob-instances.ts`
2. Verify database connection: Check `SURREALDB_URL` environment variable
3. List existing instances: Run query above

### Problem: "Invalid credentials" (401)

**Cause**: API key doesn't match hashed value in database

**Solution**:
1. Use exact API key from instance creation output
2. Don't modify the API key - it's case-sensitive
3. Recreate the instance with correct API key

### Problem: SurrealDB connection refused

**Cause**: SurrealDB not running at specified endpoint

**Solution**:
1. Start SurrealDB: `surreal start --bind 127.0.0.1:8000`
2. Or update endpoint: `SURREALDB_URL=http://localhost:8000 bun add-minibob-instances.ts`
3. Verify connectivity: `curl http://localhost:8000`

### Problem: Organization not found

**Cause**: Organization record doesn't exist

**Solution**:
- Script automatically creates organization if missing
- Or manually create:
  ```bash
  curl -X POST http://surql.metabob.local/sql \
    -u 'root:surrealdb-local-dev-123' \
    -d 'UPDATE organizations:metabob_internal CONTENT { name: "Metabob Internal" }'
  ```

## Instance States

### Active Instance

```json
{
  "instance_id": "minibob-local-001",
  "org_id": "metabob_internal",
  "is_active": true,
  "created_at": "2026-04-02T12:00:00Z",
  "last_active_at": "2026-04-02T12:15:00Z"
}
```

### Deactivated Instance

```bash
# Deactivate instance (cannot authenticate)
curl -X POST http://surql.metabob.local/sql \
  -u 'root:surrealdb-local-dev-123' \
  -d 'UPDATE minibob_instance:minibob_local_001 SET is_active = false'
```

## Database Schema

### minibob_instance Table

| Field | Type | Description |
|-------|------|-------------|
| `instance_id` | string (unique) | Identifier like `minibob-local-001` |
| `org_id` | string | Organization scope (e.g., `metabob_internal`) |
| `project_id` | string (optional) | Project scope if needed |
| `api_key_hash` | string | Argon2 hash of the API key |
| `vessel_id` | string | Vessel identifier (e.g., `minibob-cli-local`) |
| `is_active` | boolean | Whether instance can authenticate (default: true) |
| `created_at` | datetime | Creation timestamp |
| `last_active_at` | datetime | Last authentication timestamp |

### minibob_record Access Method

Authenticates using:
- `instance_id` (from request variable)
- `api_key` (from request variable)
- Validates against `api_key_hash` using Argon2
- Returns JWT token with `org_id` in claims
- Token valid for 24 hours
- Session valid for 7 days

## Production Deployment

### For Kubernetes

1. Create instances with production vessel IDs:
   ```bash
   # Edit add-minibob-instances.ts
   {
     instance_id: 'minibob-k8s-prod',
     api_key: process.env.MINIBOB_K8S_API_KEY || 'generate-new-key',
     vessel_id: 'minibob-k8s-prod',
     description: 'Production Kubernetes MiniBob'
   }
   ```

2. Create Kubernetes secret:
   ```bash
   kubectl create secret generic minibob-credentials \
     -n activity-system \
     --from-literal=instance-id=minibob-k8s-prod \
     --from-literal=api-key=$MINIBOB_K8S_API_KEY
   ```

3. Mount in MiniBob deployment:
   ```yaml
   env:
     - name: MINIBOB_INSTANCE_ID
       valueFrom:
         secretKeyRef:
           name: minibob-credentials
           key: instance-id
     - name: MINIBOB_INSTANCE_API_KEY
       valueFrom:
         secretKeyRef:
           name: minibob-credentials
           key: api-key
   ```

## Next Steps

1. Run the instance creation script
2. Configure MiniBob with instance credentials
3. Test authentication using verification commands above
4. Start MiniBob: `minibob --single "your goal"`
5. Monitor activity in dashboard at `http://dashboard.minibob.local`

## Related Documentation

- [MiniBob Configuration Guide](./CONFIGURATION_GUIDE.md) - Comprehensive configuration documentation
- [SurrealDB Auth Schema](./repos/metabob-activity-api/sql/000-auth-schema.surql) - Database authentication details
- [Identity Vessel](./repos/identity-vessel/src/index.ts) - Authentication service
