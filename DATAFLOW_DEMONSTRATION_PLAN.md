# Distributed DevBob Dataflow Demonstration Plan

**Date**: 2026-02-27  
**Purpose**: Demonstrate that all vessels share activities and impulses via metabob-rpc-api and SurrealDB  
**Status**: ⚠️ **BLOCKED** - metabob-rpc-api deployment issues

---

## Architecture Requirements (MUST ENFORCE)

### Critical Dataflow Path

```
DevBob Vessel 1 ──┐
                  │
DevBob Vessel 2 ──┼──> metabob-cli (MCP) ──> metabob-rpc-api ──> SurrealDB
                  │                                    ↓
DevBob Vessel 3 ──┘                                  Redis
```

**Enforcement Rules**:
1. ✅ **All vessels must use metabob-cli** (no direct DB access)
2. ✅ **metabob-cli must connect to metabob-rpc-api** (MCP gateway)
3. ✅ **metabob-rpc-api is exclusive gateway to SurrealDB** (no bypass)
4. ✅ **All activities tracked in SurrealDB** (learning data)
5. ✅ **All impulses tracked in SurrealDB** (context sharing)

---

## Current Status

### ✅ Infrastructure Available

| Component | Status | Pods | Notes |
|-----------|--------|------|-------|
| **DevBob Vessels** | ✅ Running | 3/3 | Scaled successfully |
| **Redis** | ✅ Running | 1/1 | Boredom queue ready |
| **SurrealDB** | ✅ Running | 1/1 | Database accessible |
| **metabob-rpc-api** | ❌ Failed | 0/1 | Image pull issues |

### ❌ Blockers

1. **metabob-rpc-api deployment failed**
   - Image: `metabobapp/metabob-rpc-api:0.7.0` (original) - ImagePullBackOff
   - Image: `metabobapp/metabob-rpc-api:0.12.5` (attempted) - ImagePullBackOff
   - Root cause: Images may not be pushed to registry or require authentication

2. **metabob-cli not installed in DevBob containers**
   - Checked: `which metabob-cli` → Not found
   - OpenCode version: `0.0.0-fix-devbob-openauth-dependency-202602251414`
   - Impact: Cannot demonstrate MCP dataflow

---

## Demonstration Plan (When Unblocked)

### Phase 1: Verify Dataflow Infrastructure

**Step 1.1**: Deploy metabob-rpc-api successfully
```bash
# Option A: Use local image if available
docker tag metabob-rpc-api-server-dev:latest metabobapp/metabob-rpc-api:local
kubectl set image deployment/metabob-rpc-api api=metabobapp/metabob-rpc-api:local -n metabob

# Option B: Build from source
cd metabob-rpc-api
docker build -t metabobapp/metabob-rpc-api:local .
kubectl create deployment metabob-rpc-api --image=metabobapp/metabob-rpc-api:local -n metabob
```

**Step 1.2**: Install metabob-cli in DevBob containers
```bash
# Check if metabob-cli is in OpenCode installation
kubectl exec -n metabob deploy/devbob -- ls -la /usr/local/bin/

# If missing, install via pip
kubectl exec -n metabob deploy/devbob -- pip install metabob-cli

# Or add to DevBob Dockerfile
```

**Step 1.3**: Configure metabob-cli to use metabob-rpc-api
```bash
# Check OpenCode MCP configuration
kubectl exec -n metabob deploy/devbob -- cat ~/.config/opencode/config.json

# Should contain:
# "mcp": {
#   "metabob": {
#     "enabled": true,
#     "url": "http://metabob-rpc-api.metabob.svc.cluster.local:8080"
#   }
# }
```

---

### Phase 2: Demonstrate Shared Activities

**Test Scenario**: Execute activity on Vessel 1, verify visible on Vessel 2 & 3

**Step 2.1**: Initialize SurrealDB schema
```bash
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &

curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "
DEFINE TABLE activity_templates SCHEMAFULL;
DEFINE FIELD id ON activity_templates TYPE string;
DEFINE FIELD name ON activity_templates TYPE string;
DEFINE FIELD learning.success_rate ON activity_templates TYPE float DEFAULT 0.0;
DEFINE FIELD learning.execution_count ON activity_templates TYPE int DEFAULT 0;

DEFINE TABLE activity_executions SCHEMAFULL;
DEFINE FIELD id ON activity_executions TYPE string;
DEFINE FIELD template_id ON activity_executions TYPE string;
DEFINE FIELD vessel_id ON activity_executions TYPE string;
DEFINE FIELD success ON activity_executions TYPE bool;
DEFINE FIELD timestamp ON activity_executions TYPE datetime;
"
```

**Step 2.2**: Execute activity on Vessel 1
```bash
VESSEL_1=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n metabob $VESSEL_1 -- opencode activity execute test-activity \
  --variables '{"testValue": "shared-activity-demo"}' \
  --reason "Demonstrate activity tracking across vessels"
```

**Step 2.3**: Query activity from Vessel 2 (different pod)
```bash
VESSEL_2=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[1].metadata.name}')

# Query via metabob-cli MCP tool
kubectl exec -n metabob $VESSEL_2 -- opencode -c "
print('Querying activities from Vessel 2...')
# This would use MCP tool: metabob_search_activities
"
```

**Step 2.4**: Verify in SurrealDB directly
```bash
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "SELECT * FROM activity_executions ORDER BY timestamp DESC LIMIT 5;"
```

**Expected Result**: Activity executed on Vessel 1 is visible in SurrealDB and queryable from Vessel 2

---

### Phase 3: Demonstrate Shared Impulses

**Test Scenario**: Create impulse on Vessel 1, load on Vessel 2, verify in SurrealDB

**Step 3.1**: Initialize impulse schema
```bash
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "
DEFINE TABLE impulses SCHEMAFULL;
DEFINE FIELD id ON impulses TYPE string;
DEFINE FIELD type ON impulses TYPE string;
DEFINE FIELD content ON impulses TYPE string;
DEFINE FIELD created_by_vessel ON impulses TYPE string;
DEFINE FIELD created_at ON impulses TYPE datetime;
DEFINE FIELD loaded_count ON impulses TYPE int DEFAULT 0;
"
```

**Step 3.2**: Create impulse on Vessel 1
```bash
kubectl exec -n metabob $VESSEL_1 -- opencode -c "
// Create a test impulse
const impulse = {
  id: 'shared-impulse-demo',
  type: 'memo',
  content: 'This impulse was created on Vessel 1 and should be accessible from all vessels',
  metadata: {
    vesselId: '$VESSEL_1',
    demonstration: true
  }
};

// Save via metabob-cli MCP (would call metabob_create_impulse)
console.log('Impulse created:', impulse.id);
"
```

**Step 3.3**: Load impulse on Vessel 2
```bash
kubectl exec -n metabob $VESSEL_2 -- opencode -c "
// Load impulse created by Vessel 1
// This uses metabob-cli MCP tool: metabob_load_impulse
console.log('Loading impulse from Vessel 2...');
// Impulse should be retrieved from SurrealDB via metabob-rpc-api
"
```

**Step 3.4**: Verify impulse sharing in SurrealDB
```bash
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "
SELECT 
  id, 
  type, 
  created_by_vessel, 
  loaded_count, 
  created_at 
FROM impulses 
WHERE id = 'shared-impulse-demo';
"
```

**Step 3.5**: Load same impulse on Vessel 3
```bash
VESSEL_3=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[2].metadata.name}')

kubectl exec -n metabob $VESSEL_3 -- opencode -c "
// Load same impulse on third vessel
console.log('Loading shared impulse on Vessel 3...');
// loaded_count should increment in SurrealDB
"
```

**Expected Result**:
- Impulse created on Vessel 1
- Loaded successfully on Vessel 2 and Vessel 3
- `loaded_count` increments in SurrealDB (0 → 1 → 2)
- All vessels access same impulse data

---

### Phase 4: Demonstrate Learning Loop

**Test Scenario**: Execute same activity multiple times, show Thompson Sampling updates

**Step 4.1**: Execute activity multiple times across vessels
```bash
# Vessel 1: Execute (success)
kubectl exec -n metabob $VESSEL_1 -- opencode activity execute test-learning-activity

# Vessel 2: Execute (success)
kubectl exec -n metabob $VESSEL_2 -- opencode activity execute test-learning-activity

# Vessel 3: Execute (simulate failure)
kubectl exec -n metabob $VESSEL_3 -- opencode activity execute test-learning-activity --force-fail
```

**Step 4.2**: Query learning metrics from SurrealDB
```bash
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "
SELECT 
  id,
  name,
  learning.success_rate,
  learning.execution_count,
  learning.improvement_gradient
FROM activity_templates 
WHERE id = 'test-learning-activity';
"
```

**Expected Result**:
- `execution_count`: 3 (1 per vessel)
- `success_rate`: 0.666... (2 successes, 1 failure)
- Thompson Sampling updated after each execution
- All vessels see same learning metrics

---

### Phase 5: Validate Dataflow Constraints

**Create validation activity**: `validate-dataflow-enforcement`

**Checks**:
1. ✅ metabob-cli is installed in all vessels
2. ✅ metabob-rpc-api is deployed and healthy
3. ✅ No direct SurrealDB access from DevBob (only via API)
4. ✅ All activities recorded in `activity_executions` table
5. ✅ All impulses recorded in `impulses` table
6. ✅ Vessels can query each other's activities
7. ✅ Vessels can load each other's impulses
8. ✅ Thompson Sampling updates visible across all vessels

---

## Alternative Approaches (If metabob-rpc-api Unavailable)

### Option 1: Mock API for Demonstration

Create a simple mock API that demonstrates the concept:

```python
# Simple mock metabob-rpc-api
from fastapi import FastAPI
import httpx

app = FastAPI()

SURREALDB_URL = "http://surrealdb.metabob.svc.cluster.local:8000"

@app.post("/api/v1/activity-execution/results")
async def record_activity(result: dict):
    # Forward to SurrealDB
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{SURREALDB_URL}/sql",
            headers={"NS": "metabob", "DB": "devbob"},
            auth=("root", "root"),
            content=f"INSERT INTO activity_executions {result}"
        )
    return {"status": "recorded"}

@app.get("/api/v1/activities/search")
async def search_activities(query: str):
    # Query SurrealDB
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SURREALDB_URL}/sql",
            headers={"NS": "metabob", "DB": "devbob"},
            auth=("root", "root"),
            content=f"SELECT * FROM activity_executions WHERE template_id ~ '{query}'"
        )
    return response.json()
```

### Option 2: Direct SurrealDB Demo (Show Why It's Wrong)

Demonstrate:
1. Vessel 1 writes directly to SurrealDB
2. Vessel 2 queries directly from SurrealDB
3. **Problem**: No MCP gateway, no graceful degradation, tight coupling

Then show:
1. Deploy metabob-rpc-api (mock or real)
2. Configure metabob-cli
3. Same operations go through API
4. **Benefit**: Loose coupling, offline mode, architectural compliance

---

## Success Criteria

When demonstration is complete, we should show:

✅ **Multi-Vessel Coordination**
- 3 vessels running independently
- Each vessel can execute activities
- All vessels share same activity state

✅ **Dataflow Enforcement**
- No direct SurrealDB access from vessels
- All operations go through metabob-rpc-api
- metabob-cli acts as MCP gateway

✅ **Shared Activities**
- Activity executed on Vessel 1 visible from Vessel 2, 3
- Activity metrics aggregated across all vessels
- Thompson Sampling updates shared

✅ **Shared Impulses**
- Impulse created on Vessel 1 loadable from Vessel 2, 3
- Impulse usage tracked (loaded_count increments)
- Context sharing works across vessels

✅ **Learning Loop**
- Execution data flows to SurrealDB
- Thompson Sampling updates success rates
- Improvement gradients calculated
- Boredom system has data to prioritize

✅ **SurrealDB as Source of Truth**
- All activities tracked in `activity_executions`
- All impulses tracked in `impulses`
- All vessels query same database
- Metrics consistent across fleet

---

## Next Steps

### Immediate (Unblock Demonstration)

1. **Fix metabob-rpc-api deployment**
   - Option A: Use local image (`metabob-rpc-api-server-dev:latest`)
   - Option B: Build from source
   - Option C: Use mock API for demo

2. **Install metabob-cli in DevBob**
   - Add to Dockerfile
   - Or install via `pip install metabob-cli`
   - Configure MCP connection to API

3. **Initialize SurrealDB schema**
   - Activity tables
   - Impulse tables
   - Vessel registry

### Short Term (Complete Demonstration)

4. **Execute demonstration scenarios**
   - Phase 2: Shared activities
   - Phase 3: Shared impulses
   - Phase 4: Learning loop

5. **Create validation activity**
   - Automate dataflow checks
   - Generate compliance report

6. **Document results**
   - Screenshots/logs of cross-vessel queries
   - SurrealDB query results
   - Learning metrics evolution

---

## Conclusion

**The architecture requires**:
- metabob-rpc-api as exclusive gateway
- metabob-cli as MCP proxy
- SurrealDB as shared state
- All vessels coordinate through this stack

**Currently blocked on**:
- metabob-rpc-api image availability
- metabob-cli installation in DevBob

**When unblocked, we can demonstrate**:
- 3 vessels sharing activities and impulses
- All data tracked in SurrealDB
- Learning loop working across fleet
- Distributed development principles enforced

---

**Status**: ⚠️ Blocked on metabob-rpc-api deployment  
**Workaround**: Mock API or direct SurrealDB demo (then show why API is needed)  
**Target**: Full dataflow demonstration with 3 coordinated vessels
