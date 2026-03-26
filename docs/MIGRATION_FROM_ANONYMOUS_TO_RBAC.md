# Migration Guide: Anonymous to RBAC

This guide covers migrating an existing Metabob deployment from anonymous (single-tenant) mode to multi-tenant RBAC.

## Overview

**Before:** Single database, no authentication, all data shared
**After:** Multi-tenant with org isolation, JWT authentication, RBAC enforcement

## Prerequisites

- Existing Metabob deployment
- SurrealDB with existing data
- Backup of current database

## Migration Steps

### Phase 1: Backup

```bash
# Export entire database
surreal export \
  --conn $SURREALDB_URL \
  --ns $NAMESPACE \
  --db $DATABASE \
  --user root \
  --pass $PASSWORD \
  > backup-$(date +%Y%m%d-%H%M%S).surql

# Verify backup
head -100 backup-*.surql
```

### Phase 2: Deploy Core Schemas

```bash
cd repos/metabob-proto

# Dry run first
SURREALDB_URL=$URL \
SURREALDB_NAMESPACE=$NS \
SURREALDB_DATABASE=$DB \
bun run surrealdb/lib/migrate.ts --dry-run

# Apply core schemas
bun run surrealdb/lib/migrate.ts
```

This creates:
- Authentication access definitions
- `organizations`, `users`, `api_keys` tables
- `projects`, `subscriptions`, `audit_logs` tables
- `minibob_instance` table

### Phase 3: Create Default Organization

```bash
# Connect to SurrealDB
surreal sql --conn $URL --ns $NS --db $DB --user root --pass $PASS

# Create default organization for existing data
CREATE organizations:metabob_internal SET
  name = 'Metabob Internal',
  slug = 'metabob-internal',
  created_at = time::now(),
  is_active = true;

# Verify
SELECT * FROM organizations;
```

### Phase 4: Add org_id to Existing Tables

Run the activity-api migrations which add org_id fields:

```bash
cd repos/metabob-activity-api

bun run sql/migrate.ts
```

This:
- Adds `org_id` field to all tables
- Creates PERMISSIONS clauses
- Creates indexes

### Phase 5: Backfill org_id

Assign existing records to the default organization:

```bash
# In SurrealDB shell
surreal sql --conn $URL --ns $NS --db $DB --user root --pass $PASS

# Backfill activity_template
UPDATE activity_template SET org_id = organizations:metabob_internal
  WHERE org_id IS NONE;

# Backfill activity_execution_traces
UPDATE activity_execution_traces SET org_id = organizations:metabob_internal
  WHERE org_id IS NONE;

# Backfill composition_graph
UPDATE composition_graph SET org_id = organizations:metabob_internal
  WHERE org_id IS NONE;

# Backfill impulse_data
UPDATE impulse_data SET org_id = organizations:metabob_internal
  WHERE org_id IS NONE;

# Backfill tool_usage
UPDATE tool_usage SET org_id = organizations:metabob_internal
  WHERE org_id IS NONE;

# Verify all records have org_id
SELECT count() FROM activity_template WHERE org_id IS NONE;
-- Should return 0
```

### Phase 6: Create Admin User

```bash
# Generate password hash
HASH=$(bun -e "console.log(await Bun.password.hash('your-password', 'argon2id'))")

# Create admin user
CREATE users:admin SET
  email = 'admin@metabob.local',
  name = 'Admin User',
  password_hash = '$HASH',
  org_id = organizations:metabob_internal,
  role = 'admin',
  created_at = time::now(),
  is_active = true;
```

### Phase 7: Create MiniBob Instance

```bash
# Generate API key
API_KEY=$(openssl rand -base64 32)
API_KEY_HASH=$(bun -e "console.log(await Bun.password.hash('$API_KEY', 'argon2id'))")

# Create instance
CREATE minibob_instance SET
  instance_id = 'mb-default',
  org_id = organizations:metabob_internal,
  api_key_hash = '$API_KEY_HASH',
  vessel_id = 'minibob:v2',
  is_active = true,
  created_at = time::now();

# Save the API key securely - you'll need it for MiniBob config
echo "MINIBOB_API_KEY=$API_KEY" >> .env.local
```

### Phase 8: Deploy Updated Services

```bash
cd helm

# Update activity-api
helm upgrade metabob-activity-api ./charts/metabob-activity-api \
  -n activity-system \
  --set auth.enabled=true

# Update minibob with instance credentials
helm upgrade minibob ./charts/devbob \
  -n activity-system \
  --set minibob.instanceId=mb-default \
  --set minibob.apiKey=$API_KEY
```

### Phase 9: Validate

```bash
# Test unauthenticated access (should fail)
curl http://api.minibob.local/v2/activities/templates
# Expected: 401 Unauthorized

# Test authenticated access
# First, get JWT via API key exchange
TOKEN=$(curl -s -X POST http://api.minibob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"api_key": "mk_your_api_key"}' | jq -r .token)

# Then query with token
curl http://api.minibob.local/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK with data
```

## Verification Checklist

- [ ] Database backup created
- [ ] Core schemas applied
- [ ] Default organization created
- [ ] org_id backfilled to all existing records
- [ ] Admin user created
- [ ] MiniBob instance created
- [ ] Services deployed with auth enabled
- [ ] Unauthenticated requests return 401
- [ ] Authenticated requests return data
- [ ] Dashboard login works
- [ ] MiniBob can execute activities

## Rollback Plan

If migration fails:

### Quick Rollback (Data Intact)

```bash
# Disable auth in services
helm upgrade metabob-activity-api ./charts/metabob-activity-api \
  -n activity-system \
  --set auth.enabled=false
```

### Full Rollback (Restore Backup)

```bash
# Drop and recreate database
surreal sql --conn $URL --user root --pass $PASS <<EOF
USE NS $NAMESPACE;
REMOVE DATABASE $DATABASE;
DEFINE DATABASE $DATABASE;
EOF

# Import backup
surreal import \
  --conn $URL \
  --ns $NAMESPACE \
  --db $DATABASE \
  --user root \
  --pass $PASS \
  < backup-YYYYMMDD-HHMMSS.surql
```

## Troubleshooting

### "No org_id" Errors After Migration

```sql
-- Find records without org_id
SELECT * FROM activity_template WHERE org_id IS NONE LIMIT 10;

-- Backfill missed records
UPDATE activity_template SET org_id = organizations:metabob_internal
  WHERE org_id IS NONE;
```

### "Invalid Token" Errors

1. Check token hasn't expired (15 min lifetime)
2. Verify JWT secret matches between services
3. Check clock sync between servers

### "Permission Denied" Errors

1. Verify org_id matches $auth.org_id
2. Check role is sufficient for operation
3. Review PERMISSIONS clause on table

### MiniBob Auth Failing

```bash
# Check instance exists
surreal sql --conn $URL --ns $NS --db $DB <<EOF
SELECT * FROM minibob_instance WHERE instance_id = 'mb-default';
EOF

# Verify API key hash
# Re-create if needed
```

## Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Backup | 5-30 min | Depends on data size |
| Schema Deploy | 1-2 min | Fast, idempotent |
| Backfill | 5-60 min | Depends on record count |
| Service Deploy | 5-10 min | Rolling update |
| Validation | 10-30 min | Manual testing |

**Total: 30 min - 2 hours** depending on data size

## Post-Migration

1. **Create API keys** for existing users via dashboard
2. **Update client configs** with new API keys
3. **Monitor logs** for auth errors
4. **Enable audit logging** for compliance
5. **Set up monitoring** for auth metrics
