# Cross-Instance Setup Guide

**Quick Reference for Developers**

---

## Prerequisites

1. **SurrealDB Running:**
   ```bash
   docker-compose -f docker-compose.unified.yaml up -d surrealdb
   # Or: docker ps | grep surrealdb
   ```

2. **Metabob-RPC-API Running:**
   ```bash
   docker-compose -f docker-compose.unified.yaml up -d metabob-api
   # Or: curl http://localhost:8080/health
   ```

---

## Configuration Checklist

### Step 1: Set API Key

**Where:** Each vessel's environment configuration

**Option A - Environment Variable:**
```bash
export METABOB_API_KEY="mb_devbob_test_simple_2026_v2"
```

**Option B - Config File:**
```json
// .metabob/config.json
{
  "metabob_api_key": "mb_devbob_test_simple_2026_v2",
  "metabob_url": "http://localhost:8080"
}
```

### Step 2: Set Project ID

**Generate from git repository:**
```bash
# Recommended: Use repo name + short commit hash
export METABOB_PROJECT_ID="$(basename $(git rev-parse --show-toplevel))-$(git rev-parse HEAD | head -c 12)"

# Example result: "metabob-devbob-1d46a3be9c8e"
```

**Alternative - Simple naming:**
```bash
# Use project name directly
export METABOB_PROJECT_ID="metabob-devbob"
```

**⚠️ Important:**
- Same project_id = shared data across vessels
- Different project_id = isolated data

### Step 3: Verify Configuration

**Test impulse storage:**
```bash
# From any vessel with metabob-cli MCP running
metabob-cli mcp call metabob_impulse_store \
  --impulse_id "test-config-$(date +%s)" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{"id":"test","type":"memo","pointer":{"type":"memo","content":"Config test"},"budget":1000}'
```

**Expected output:**
```json
{
  "status": "success",
  "impulse_id": "test-config-1234567890",
  "created_at": "2026-02-27T12:00:00Z",
  "message": "Impulse stored in backend - accessible from any instance"
}
```

---

## Usage Examples

### Store an Impulse (from TypeScript/OpenCode)

```typescript
import { getMCPClient } from './mcp';

const mcp = await getMCPClient();

const result = await mcp.call('metabob_impulse_store', {
  impulse_id: 'my-design-decision',
  project_id: process.env.METABOB_PROJECT_ID!,
  impulse_data: {
    id: 'my-design-decision',
    type: 'templateDefinition',
    pointer: {
      type: 'memo',
      content: 'Use REST API for user endpoints, GraphQL for analytics'
    },
    budget: 5000,
    scope: 'global'
  }
});

console.log(result); // { status: 'success', ... }
```

### Load an Impulse (from another vessel)

```typescript
const result = await mcp.call('metabob_impulse_load', {
  impulse_id: 'my-design-decision',
  project_id: process.env.METABOB_PROJECT_ID!
});

if (result.status === 'success') {
  console.log('Design decision:', result.impulse_data.pointer.content);
} else {
  console.error('Impulse not found or access denied');
}
```

### Store an Activity

```typescript
const activityData = {
  id: 'act_feature_123',
  template: 'add-feature-complete',
  status: 'done',
  tasks: [
    { id: 'task-1', status: 'done', result: 'Created user service' },
    { id: 'task-2', status: 'done', result: 'Added tests' }
  ],
  impulses: {
    'design': 'my-design-decision'
  },
  metrics: {
    cost: 0.25,
    duration: 120000,
    tokens: { input: 5000, output: 2000, cache: 1000 }
  }
};

const result = await mcp.call('metabob_activity_save', {
  activity_id: activityData.id,
  project_id: process.env.METABOB_PROJECT_ID!,
  activity_data: activityData
});
```

### Load an Activity (for analysis/replay)

```typescript
const result = await mcp.call('metabob_activity_load', {
  activity_id: 'act_feature_123',
  project_id: process.env.METABOB_PROJECT_ID!
});

if (result.status === 'success') {
  console.log('Activity completed:', result.activity_data.status);
  console.log('Cost:', result.activity_data.metrics.cost);
  console.log('Tasks:', result.activity_data.tasks.length);
}
```

---

## Multi-Vessel Scenarios

### Scenario 1: Same Project, Different Vessels

**Setup:**
```bash
# Vessel A (repos/metabob-cli)
export METABOB_API_KEY="mb_shared_key"
export METABOB_PROJECT_ID="shared-project"

# Vessel B (repos/metabob-opencode)
export METABOB_API_KEY="mb_shared_key"      # ✓ Same
export METABOB_PROJECT_ID="shared-project"   # ✓ Same
```

**Result:** ✅ Both vessels see the same impulses and activities

### Scenario 2: Different Projects, Same Organization

**Setup:**
```bash
# Project A
export METABOB_API_KEY="mb_org_key"
export METABOB_PROJECT_ID="project-a"

# Project B
export METABOB_API_KEY="mb_org_key"          # ✓ Same org
export METABOB_PROJECT_ID="project-b"        # ✗ Different project
```

**Result:** ✅ Projects are isolated, data not shared

### Scenario 3: Different Organizations

**Setup:**
```bash
# Organization A
export METABOB_API_KEY="mb_org_a_key"       # ✗ Different org
export METABOB_PROJECT_ID="any-project"

# Organization B
export METABOB_API_KEY="mb_org_b_key"       # ✗ Different org
export METABOB_PROJECT_ID="any-project"
```

**Result:** ✅ Complete isolation, even with same project name

---

## Troubleshooting

### Problem: "Impulse not found" when loading

**Check 1 - API Key Match:**
```bash
# Verify both vessels use same API key
echo "Vessel A: $METABOB_API_KEY"
echo "Vessel B: $METABOB_API_KEY"
```

**Check 2 - Project ID Match:**
```bash
# Verify both vessels use same project ID
echo "Vessel A: $METABOB_PROJECT_ID"
echo "Vessel B: $METABOB_PROJECT_ID"
```

**Check 3 - SurrealDB Data:**
```bash
# Query SurrealDB directly
curl -X POST http://localhost:8000/sql \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "SELECT * FROM impulse_data WHERE impulse_id = 'your-impulse-id'"
```

### Problem: "Failed to connect to backend"

**Check 1 - RPC API Running:**
```bash
curl http://localhost:8080/health
# Expected: {"status": "healthy"}
```

**Check 2 - Base URL Configuration:**
```bash
# In metabob-cli config
cat ~/.metabob-config.json | grep metabob_url
# Should be: "metabob_url": "http://localhost:8080"
```

**Check 3 - Network Connectivity:**
```bash
# Test from vessel
curl -v http://localhost:8080/v2/impulses \
  -H "X-API-Key: $METABOB_API_KEY" \
  -H "Content-Type: application/json"
```

### Problem: "Missing metabob_api_key in configuration"

**Solution:**
```bash
# Option 1: Environment variable (runtime)
export METABOB_API_KEY="your-api-key"

# Option 2: Config file (persistent)
echo '{
  "metabob_api_key": "your-api-key",
  "metabob_url": "http://localhost:8080"
}' > ~/.metabob-config.json

# Verify
metabob-cli config show
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `METABOB_API_KEY` | ✓ | - | Organization identifier for multi-tenant isolation |
| `METABOB_PROJECT_ID` | ⚠️ | `"default-project"` | Project identifier for data scoping |
| `METABOB_URL` | ✗ | `http://localhost:8080` | Base URL for metabob-rpc-api |

**⚠️ METABOB_PROJECT_ID:**
- Defaults to `"default-project"` if not set
- **Recommendation:** Always set explicitly to avoid collisions
- Use git hash for uniqueness: `"$(git rev-parse HEAD | head -c 12)"`

---

## Docker Compose Setup

**Ensure services are running:**
```bash
# Start infrastructure
docker-compose -f docker-compose.unified.yaml up -d surrealdb metabob-api

# Verify SurrealDB
docker logs metabob-devbob-surrealdb-1 | tail -20

# Verify RPC API
curl http://localhost:8080/health
```

**Environment injection:**
```yaml
# docker-compose.unified.yaml
services:
  metabob-api:
    environment:
      - METABOB_API_KEY=${METABOB_API_KEY}
      - SURREALDB_URL=http://surrealdb:8000
      - SURREALDB_NAMESPACE=metabob
      - SURREALDB_DATABASE=devbob
```

---

## Testing Cross-Instance Storage

**Simple test script:**
```bash
#!/bin/bash
# test-cross-instance.sh

set -e

export METABOB_API_KEY="mb_test_$(date +%s)"
export METABOB_PROJECT_ID="test-project-$(date +%s)"

echo "Test 1: Store impulse from vessel A"
IMPULSE_ID="test-impulse-$(date +%s)"
metabob-cli mcp call metabob_impulse_store \
  --impulse_id "$IMPULSE_ID" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{"id":"'$IMPULSE_ID'","type":"memo","pointer":{"type":"memo","content":"Test data"},"budget":1000}'

echo "Test 2: Load impulse from vessel B (simulated)"
RESULT=$(metabob-cli mcp call metabob_impulse_load \
  --impulse_id "$IMPULSE_ID" \
  --project_id "$METABOB_PROJECT_ID")

echo "Result: $RESULT"

if echo "$RESULT" | grep -q "Test data"; then
  echo "✅ Cross-instance storage test PASSED"
else
  echo "❌ Cross-instance storage test FAILED"
  exit 1
fi
```

**Run test:**
```bash
chmod +x test-cross-instance.sh
./test-cross-instance.sh
```

---

## Security Considerations

### API Key Protection

✅ **DO:**
- Store API keys in environment variables
- Use different keys for dev/staging/prod
- Rotate keys periodically
- Never commit keys to git

❌ **DON'T:**
- Hardcode API keys in source code
- Share keys across organizations
- Use predictable key values in production

### Project ID Naming

✅ **DO:**
- Use unique, descriptive names
- Include git hash for traceability
- Document naming convention in team

❌ **DON'T:**
- Use generic names like "project" or "test"
- Reuse project IDs across unrelated projects
- Change project ID after data is stored (orphans data)

---

## Best Practices

1. **Configuration Management:**
   - Use `.env` files for local development
   - Use Kubernetes ConfigMaps/Secrets for production
   - Validate configuration on startup

2. **Project ID Strategy:**
   - Generate from git: `REPO_NAME-$(git rev-parse HEAD | head -c 12)`
   - Or use semantic versioning: `REPO_NAME-v1.2.3`
   - Document strategy in team README

3. **Data Lifecycle:**
   - Impulses: Long-lived, shared across activities
   - Activities: Archivable after completion
   - Consider cleanup jobs for old data

4. **Testing:**
   - Use unique project IDs per test run
   - Clean up test data after tests complete
   - Mock MCP tools in unit tests, use real storage in integration tests

---

## Next Steps

1. **Set up your vessel:**
   ```bash
   export METABOB_API_KEY="your-org-key"
   export METABOB_PROJECT_ID="$(basename $(pwd))-$(git rev-parse HEAD | head -c 12)"
   ```

2. **Verify storage works:**
   ```bash
   ./test-cross-instance.sh
   ```

3. **Document your configuration:**
   - Add to team README
   - Update deployment scripts
   - Create runbook for ops team

---

**Last Updated:** 2026-02-27  
**Maintained By:** DevOps Team  
**Questions?** See `CROSS_INSTANCE_STORAGE_ANALYSIS.md` for detailed architecture
