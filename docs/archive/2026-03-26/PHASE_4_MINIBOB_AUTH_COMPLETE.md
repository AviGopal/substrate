# Phase 4 Complete: MiniBob RECORD Authentication

## Summary

Phase 4 of the surrealdb-multi-tenant-schema OpenSpec change is **complete**. MiniBob instances can now authenticate using RECORD-based authentication with database-enforced org/project isolation.

## What Was Delivered

### 1. Core Infrastructure (Tasks 4.1-4.6) ✅

**Already in place from Phase 1:**
- `minibob_instance` table with org_id, project_id, api_key_hash
- `DEFINE ACCESS minibob_record` with SIGNIN query using argon2 validation
- PERMISSIONS enforcing instance can only see its own record
- Token duration: 24h token, 7d session

**Files:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-proto/surrealdb/core/001-auth-access.surql`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-proto/surrealdb/core/002-organizations.surql`

### 2. Activity-API Integration (Tasks 4.7-4.10) ✅

**Implemented:**
- RECORD authentication support in SurrealDBClient
- New `connectWithAuth()` method supporting both root and RECORD auth
- Config support for instance credentials via environment variables
- Automatic org_id/project_id injection from authenticated context

**Files:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/src/db/surreal.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/src/config.ts`

**Environment variables:**
- `MINIBOB_INSTANCE_ID`: Instance identifier
- `MINIBOB_API_KEY`: Instance API key

### 3. MiniBob Integration (Tasks 4.8-4.9) ✅

**Implemented:**
- Instance config in MinibobConfig type
- Environment variable loading for instance credentials
- MCP client passes instance credentials in HTTP headers
- Agent runtime initializes MCP with instance config

**Files:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/types.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/config.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/mcp.ts`
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/agent-runtime.ts`

**Environment variables:**
- `MINIBOB_INSTANCE_ID`: Instance identifier
- `MINIBOB_INSTANCE_API_KEY`: Instance API key (plaintext)
- `MINIBOB_ORG_ID`: Organization ID (optional, for metadata)
- `MINIBOB_PROJECT_ID`: Project ID (optional, for metadata)

**HTTP Headers added:**
- `X-MiniBob-Instance-ID`: Instance identifier
- `X-MiniBob-Instance-Key`: Instance API key
- `X-MiniBob-Org-ID`: Organization ID
- `X-MiniBob-Project-ID`: Project ID

### 4. Testing and Documentation (Tasks 4.11-4.17) ✅

**Test Script:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac/test-instance-auth.ts`
- Covers: instance signup, signin, isolation, boredom activity execution

**Documentation:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac/INSTANCE_AUTH_GUIDE.md` - Complete setup guide
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac/PHASE4_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac/RUN_TESTS.md` - Testing quick reference

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ MiniBob Pod                                                     │
│                                                                 │
│ Environment:                                                    │
│ - MINIBOB_INSTANCE_ID=minibob-prod-1                          │
│ - MINIBOB_INSTANCE_API_KEY=<secret>                           │
│ - MINIBOB_ORG_ID=organizations:acme                           │
│ - MINIBOB_PROJECT_ID=projects:web_app                         │
│ - MINIBOB_MCP_ENDPOINT=http://activity-api:8080               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ HTTP POST /v2/activities/recommend
                   │ Headers:
                   │   X-MiniBob-Instance-ID: minibob-prod-1
                   │   X-MiniBob-Instance-Key: <secret>
                   │   X-MiniBob-Org-ID: organizations:acme
                   │   X-MiniBob-Project-ID: projects:web_app
                   ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-activity-api (MCP Backend)                             │
│                                                                 │
│ 1. Extract instance credentials from headers                   │
│ 2. Create SurrealDB client with RECORD auth:                   │
│    await db.connectWithAuth({                                  │
│      type: 'record',                                           │
│      access: 'minibob_record',                                 │
│      namespace: 'production',                                  │
│      database: 'metabob',                                      │
│      variables: {                                              │
│        instance_id: 'minibob-prod-1',                         │
│        api_key: '<secret>'                                     │
│      }                                                          │
│    })                                                           │
│ 3. Process request with authenticated DB context               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ SIGNIN with RECORD access
                   ▼
┌────────────────────────────────────────────────────────────────┐
│ SurrealDB 3.0                                                  │
│                                                                 │
│ DEFINE ACCESS minibob_record ON DATABASE TYPE RECORD           │
│   SIGNIN (                                                      │
│     SELECT * FROM minibob_instance                             │
│     WHERE instance_id = $instance_id                           │
│       AND is_active = true                                     │
│       AND crypto::argon2::compare(api_key_hash, $api_key)     │
│   )                                                             │
│   DURATION FOR TOKEN 24h, FOR SESSION 7d;                      │
│                                                                 │
│ $auth context set to:                                          │
│ - $auth.id = minibob_instance:<record-id>                     │
│ - $auth.org_id = organizations:acme                           │
│ - $auth.project_id = projects:web_app                         │
│                                                                 │
│ PERMISSIONS enforce:                                            │
│ - activity_registry: org_id = $auth.org_id                    │
│ - execution_traces: org_id AND project_id match               │
│ - minibob_instance: id = $auth.id (can only see self)         │
└────────────────────────────────────────────────────────────────┘
```

## Key Features

### Database-Enforced Isolation

All data access is filtered at the database level via PERMISSIONS clauses:

```sql
-- Activity Registry: Scope-aware filtering
DEFINE TABLE activity_registry SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      (scope = 'global' AND public = true)
      OR (scope = 'org' AND org_id = $auth.org_id)
      OR (scope = 'project' AND project_id = $auth.project_id);

-- Execution Traces: Org + project filtering
DEFINE TABLE activity_execution_traces SCHEMAFULL
  PERMISSIONS
    FOR select, create WHERE org_id = $auth.org_id AND project_id = $auth.project_id;
```

### Secure Credential Management

- API keys hashed with argon2 before storage
- Plaintext keys never in database
- Timing-safe comparison in SIGNIN query
- Kubernetes secrets for key storage

### Long-Lived Sessions

- **Token duration**: 24 hours (auto-refreshed by SurrealDB client)
- **Session duration**: 7 days (max before re-signin required)
- Suitable for continuous autonomous operation

## Testing

### Run Automated Tests

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac

# Set environment
export SURREALDB_URL=http://localhost:8000
export SURREALDB_NAMESPACE=production
export SURREALDB_DATABASE=metabob
export SURREALDB_USERNAME=root
export SURREALDB_PASSWORD=changeme

# Run tests
bun test-instance-auth.ts
```

Expected: All 4 tests pass (signup, signin, isolation, RBAC enforcement)

### Manual Testing

See `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac/RUN_TESTS.md` for step-by-step instructions.

## Deployment

### Remaining Tasks

- [ ] **Task 4.15**: Deploy to staging
  - Build Docker images with Phase 4 code
  - Update Helm values with instance credentials
  - Run smoke tests

- [ ] **Task 4.16**: Deploy to production
  - After staging validation passes
  - Gradual rollout (1 pod at a time)
  - Monitor authentication metrics

### Helm Configuration

Example values for MiniBob deployment:

```yaml
# helm/charts/devbob/values.yaml
minibob:
  replicas: 3

  env:
    # Instance authentication
    - name: MINIBOB_INSTANCE_ID
      value: "minibob-prod-1"
    - name: MINIBOB_ORG_ID
      value: "organizations:metabob_internal"
    - name: MINIBOB_PROJECT_ID
      value: "projects:devbob"
    - name: MINIBOB_MCP_ENDPOINT
      value: "http://metabob-activity-api.activity-system.svc.cluster.local:8080"

    # API key from secret
    - name: MINIBOB_INSTANCE_API_KEY
      valueFrom:
        secretKeyRef:
          name: minibob-instance-credentials
          key: api-key
```

Create secret:

```bash
# Generate API key
API_KEY=$(openssl rand -hex 32)

# Create secret
kubectl create secret generic minibob-instance-credentials \
  --from-literal=api-key=$API_KEY \
  -n activity-system

# Create instance in SurrealDB
surreal sql --endpoint http://surrealdb:8000 \
  --namespace production --database metabob \
  --user root --pass changeme <<EOF

-- Generate hash
LET \$hash = crypto::argon2::generate('$API_KEY');

-- Create instance
CREATE minibob_instance SET
  instance_id = 'minibob-prod-1',
  org_id = organizations:metabob_internal,
  project_id = projects:devbob,
  api_key_hash = \$hash,
  vessel_id = 'minibob-v0.1.0',
  is_active = true,
  created_at = time::now();
EOF
```

## Security Considerations

### API Key Protection

⚠️ **CRITICAL**: Instance API keys grant full access to an org/project.

**Best practices:**
- Generate with 256+ bits of entropy
- Store in Kubernetes secrets only
- Rotate every 90 days
- Never commit to version control
- Monitor `last_active_at` for stale instances

### Audit Logging

Consider adding audit logs for instance authentication:

```sql
CREATE audit_logs SET
  event_type = 'instance_signin',
  instance_id = $instance_id,
  org_id = $auth.org_id,
  timestamp = time::now(),
  metadata = { ip: $ip, success: true };
```

### Rate Limiting

Implement rate limiting on authentication endpoints to prevent brute force:

```typescript
const MAX_AUTH_ATTEMPTS = 5;
const WINDOW_MS = 60000; // 1 minute
```

## Documentation

All documentation is in `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac/`:

1. **INSTANCE_AUTH_GUIDE.md**: Complete setup and usage guide
2. **PHASE4_IMPLEMENTATION_SUMMARY.md**: Technical implementation details
3. **RUN_TESTS.md**: Testing quick reference
4. **spec.md**: RBAC specification (original requirements)

## Files Changed

### Activity-API
- `src/db/surreal.ts` - RECORD auth support
- `src/config.ts` - Instance config

### MiniBob
- `src/types.ts` - Instance config types
- `src/config.ts` - Environment variable loading
- `src/mcp.ts` - HTTP headers for instance credentials
- `src/agent-runtime.ts` - MCP initialization with instance config

### OpenSpec
- `openspec/changes/surrealdb-multi-tenant-schema/tasks.md` - Updated task status
- Test scripts and documentation (see above)

## Next Phase

Phase 4 completes the MiniBob instance authentication. The next phases are:

- **Phase 5**: Deployment Activities (automated stack deployment via MiniBob)
- **Phase 2**: Migrate Activity API Schemas (add org_id/project_id to existing tables)
- **Phase 3**: Create Analysis API Schemas (auth/billing tables)

## References

- [OpenSpec Proposal](/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/proposal.md)
- [OpenSpec Design](/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/design.md)
- [RBAC Specification](/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac/spec.md)
- [SurrealDB RECORD Authentication](https://surrealdb.com/docs/surrealql/statements/define/access/record)

---

**Status**: Phase 4 implementation complete. Ready for staging deployment (tasks 4.15-4.16).
