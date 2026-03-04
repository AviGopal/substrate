# MCP Data Flow Validation in Local Kubernetes - Trace Analysis

**Specification**: MCP Data Flow Validation in Local Kubernetes  
**Analysis Date**: 2026-03-04  
**Trace Impulse ID**: `trace-mcp-data-flow-validation-local-k8s`  
**Status**: ⚠️ PARTIAL IMPLEMENTATION - Critical gaps identified in backend persistence layer

---

## Executive Summary

### Current State: PARTIAL ✅❌
- **Working**: Data collection in OpenCode, MCP transport through CLI, API schema definitions
- **Broken**: Backend doesn't persist `impulses_used` and `component_changes` to database
- **Impact**: Learning data is lost at the API boundary, Thompson sampling and pattern detection cannot function

### Critical Gaps Identified: 3
1. **GAP-1 (HIGH)**: `record_execution` receives learning data but doesn't process it
2. **GAP-2 (HIGH)**: `insert_execution` function signature doesn't accept learning data parameters
3. **GAP-3 (MEDIUM)**: No integration with `impulse_learning` operations to populate `impulse_usage` and `impulse_registry` tables

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MCP DATA FLOW PATH                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  OpenCode Activity.ts (lines 1056-1057)                               │
│    ↓ impulses_used, component_changes                                 │
│  TemplateMetricsClient.reportExecution() (lines 124-125)              │
│    ↓ MCP tool call                                                     │
│  CLI MCP: metabob_post_activity_result (lines 355-365)                │
│    ↓ HTTP POST with request_data                                      │
│  Backend API: /api/v1/learning-loop/executions (lines 240-260)        │
│    ↓ ❌ LEARNING DATA LOST HERE                                        │
│  insert_execution() (lines 34, 88)                                     │
│    ↓ Only legacy 'impulses' parameter                                 │
│  SurrealDB: activity_executions table                                 │
│    ↓ impulse_usage ❌ NOT POPULATED                                    │
│    ↓ impulse_registry ❌ NOT POPULATED                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Analysis

### Layer 1: OpenCode (✅ COMPLETE)

#### `activity.ts:1056-1057, 1361-1362`
**Status**: ✅ Working  
**Evidence**:
```typescript
impulses_used: impulsesUsed.length > 0 ? impulsesUsed : undefined,
component_changes: componentChanges.length > 0 ? componentChanges : undefined,
```
**Gap**: NONE - Data collection implemented correctly

#### `template-metrics.ts:47-48`
**Status**: ✅ Working  
**Evidence**:
```typescript
impulses_used?: ImpulseUsageData[]
component_changes?: ComponentChangeData[]
```
**Gap**: NONE - Schema aligned with MCP flow

#### `template-metrics-client.ts:124-125`
**Status**: ✅ Working  
**Evidence**:
```typescript
impulses_used: data.impulses_used,
component_changes: data.component_changes,
```
**Gap**: NONE - Forwards learning data to CLI

---

### Layer 2: CLI MCP (✅ COMPLETE)

#### `activity_template_tools.py:355-365`
**Status**: ✅ Working  
**Evidence**:
```python
if result.get('impulses_used'):
    request_data['impulses_used'] = result.get('impulses_used')
    logger.debug(f'[LEARNING] Including {len(result.get("impulses_used"))} impulses in execution data')
```
**Gap**: NONE - Extracts and forwards learning data with logging

#### `api_client.py:53-82`
**Status**: ✅ Working  
**Evidence**: Generic HTTP client forwards request_data to backend  
**Gap**: NONE - Proxies data without transformation

---

### Layer 3: Backend API (❌ CRITICAL GAPS)

#### `learning_loop.py:151-158` - ExecutionRequest Schema
**Status**: ✅ Schema Defined  
**Evidence**:
```python
impulses_used: Optional[List[ImpulseUsageData]] = Field(None, ...)
component_changes: Optional[List[ComponentChangeData]] = Field(None, ...)
```
**Gap**: NONE - Schema ready to receive data

#### `learning_loop.py:240-260` - record_execution Endpoint
**Status**: ❌ CRITICAL GAP  
**Evidence**:
```python
# Line 240-243: Only processes legacy 'impulses' field
impulses_data = None
if request.impulses:
    impulses_data = [impulse.model_dump() for impulse in request.impulses]

# Line 246-260: insert_execution call MISSING impulses_used and component_changes
execution = await insert_execution(
    activity_id=request.activity_id,
    template_id=template_id_value,
    # ... other params ...
    impulses=impulses_data,  # ❌ Only legacy format
)
# ❌ NO PROCESSING OF request.impulses_used
# ❌ NO PROCESSING OF request.component_changes
```

**Impact**: Learning data is received but immediately discarded  
**Fix Required**:
```python
# Add after line 243:
impulses_used_data = None
if request.impulses_used:
    impulses_used_data = [imp.model_dump() for imp in request.impulses_used]

component_changes_data = None
if request.component_changes:
    component_changes_data = [cc.model_dump() for cc in request.component_changes]

# Update insert_execution call to include:
execution = await insert_execution(
    # ... existing params ...
    impulses=impulses_data,
    impulses_used=impulses_used_data,  # NEW
    component_changes=component_changes_data,  # NEW
)
```

---

### Layer 4: Database Operations (❌ CRITICAL GAPS)

#### `activity_execution.py:20-100` - insert_execution Function
**Status**: ❌ CRITICAL GAP  
**Evidence**:
```python
# Line 34: Function signature missing parameters
async def insert_execution(
    activity_id: str,
    # ... other params ...
    impulses: Optional[List[Dict[str, Any]]] = None,  # ❌ Only legacy
) -> Dict[str, Any]:
```

**Impact**: Even if API passes the data, function can't accept it  
**Fix Required**:
```python
# Add to function signature:
async def insert_execution(
    # ... existing params ...
    impulses: Optional[List[Dict[str, Any]]] = None,
    impulses_used: Optional[List[Dict[str, Any]]] = None,  # NEW
    component_changes: Optional[List[Dict[str, Any]]] = None,  # NEW
) -> Dict[str, Any]:
    # ... existing logic ...
    
    data = {
        # ... existing fields ...
        "impulses": impulses if impulses else None,
        "impulses_used": impulses_used if impulses_used else None,  # NEW
        "component_changes": component_changes if component_changes else None,  # NEW
    }
```

#### `impulse_learning.py:1-100` - Impulse Learning Operations
**Status**: ❌ IMPLEMENTATION GAP  
**Evidence**: `insert_mapping_record` exists but not called from `record_execution`  
**Impact**: `impulse_usage` and `impulse_registry` tables remain empty  
**Fix Required**:
```python
# Add to record_execution after insert_execution:
if request.impulses_used:
    from server.db.operations.impulse_learning import create_impulse_usage_records
    await create_impulse_usage_records(
        activity_id=request.activity_id,
        impulses_used=request.impulses_used
    )
```

---

### Layer 5: Database (❌ DATA FLOW GAP)

**Tables**:
- `activity_executions` - ✅ Receives data (but missing impulses_used/component_changes fields)
- `impulse_usage` - ❌ Not populated
- `impulse_registry` - ❌ Not populated

**Impact**: Thompson sampling and pattern detection queries return empty results

---

## Critical Gaps Summary

### GAP-1: API Endpoint Doesn't Process Learning Data
**Location**: `repos/metabob-rpc-api/server/routes/learning_loop.py:240-260`  
**Severity**: HIGH  
**Issue**: `record_execution` receives `impulses_used` and `component_changes` but only processes legacy `impulses` field  
**Impact**: Learning data is lost at the API boundary - never reaches database  
**Files to Fix**:
- `repos/metabob-rpc-api/server/routes/learning_loop.py` (lines 240-260)

### GAP-2: Database Operation Missing Parameters
**Location**: `repos/metabob-rpc-api/server/db/operations/activity_execution.py:20-100`  
**Severity**: HIGH  
**Issue**: `insert_execution` function signature doesn't accept `impulses_used` or `component_changes`  
**Impact**: Even if API passes the data, storage layer can't persist it  
**Files to Fix**:
- `repos/metabob-rpc-api/server/db/operations/activity_execution.py` (function signature and data dict)

### GAP-3: No Impulse Learning Integration
**Location**: `repos/metabob-rpc-api/server/routes/learning_loop.py:240-290`  
**Severity**: MEDIUM  
**Issue**: No integration with `impulse_learning` operations to populate `impulse_usage` and `impulse_registry` tables  
**Impact**: Thompson sampling and pattern detection can't use learning data  
**Files to Fix**:
- `repos/metabob-rpc-api/server/routes/learning_loop.py` (add impulse learning integration)
- `repos/metabob-rpc-api/server/db/operations/impulse_learning.py` (create helper function for impulse_usage records)

---

## Validation Plan

### Step 1: Fix Backend Code
**Files to Modify**:
1. `repos/metabob-rpc-api/server/routes/learning_loop.py`
   - Extract `impulses_used` and `component_changes` from request (after line 243)
   - Pass to `insert_execution` call (update line 246-260)
   - Add impulse learning integration (after line 273)

2. `repos/metabob-rpc-api/server/db/operations/activity_execution.py`
   - Add `impulses_used` and `component_changes` parameters to function signature (line 34)
   - Add fields to data dict (after line 88)
   - Store in SurrealDB

3. `repos/metabob-rpc-api/server/db/operations/impulse_learning.py` (optional)
   - Create helper function `create_impulse_usage_records()` for bulk insertion

**Verification**: Code inspection - grep for `impulses_used` and `component_changes` in modified files

---

### Step 2: Deploy to Local Kubernetes
**Commands**:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
cd repos/metabob-rpc-api

# Build new Docker image
docker build -t metabob-rpc-api:mcp-data-flow-fix .

# Apply to Kubernetes
kubectl apply -f helm/charts/metabob-rpc-api/
# OR
cd ../../helm
helmfile sync
```

**Verification**:
```bash
kubectl get pods -l app=metabob-rpc-api
kubectl logs -f deployment/metabob-rpc-api --tail=50
```

**Expected Logs**:
```
[LEARNING] Posted activity result: act_xxx (template_id, True) in X.XXs
```

---

### Step 3: Execute Test Activity
**Command**:
```bash
opencode activity \
  --template=trace-enforce-validate-loop \
  --variables='{"specificationName":"Test Learning Data Flow"}' \
  --reason="Testing MCP data flow validation after backend fixes"
```

**Expected Logs in CLI**:
```
[LEARNING] Including N impulses in execution data
```

**Expected Logs in Backend**:
```
[LEARNING] Processing 3 impulses_used records for activity act_xxx
[LEARNING] Created impulse_usage records: [...ids]
```

---

### Step 4: Validate Database - activity_executions Table
**Query**:
```sql
SELECT * FROM activity_executions 
WHERE activity_id = '<test-activity-id>' 
FETCH impulses_used, component_changes;
```

**Expected Result**:
```json
{
  "activity_id": "act_test_12345",
  "template_id": "trace-enforce-validate-loop",
  "success": true,
  "impulses_used": [
    {
      "impulse_id": "imp_file_123",
      "content_hash": "abc123",
      "tokens_used": 1500,
      "was_useful": true
    }
  ],
  "component_changes": [
    {
      "file_path": "server/routes/learning_loop.py",
      "component_name": "record_execution",
      "component_type": "function",
      "change_type": "modified",
      "lines_added": 15,
      "lines_removed": 5
    }
  ]
}
```

---

### Step 5: Validate Database - impulse_usage Table
**Query**:
```sql
SELECT * FROM impulse_usage 
WHERE activity_id = '<test-activity-id>';
```

**Expected Result**:
```json
[
  {
    "id": "impulse_usage:uuid",
    "activity_id": "act_test_12345",
    "impulse_id": "imp_file_123",
    "tokens_loaded": 1500,
    "was_useful": true,
    "created_at": "2026-03-04T..."
  }
]
```

---

### Step 6: Validate Database - impulse_registry Table
**Query**:
```sql
SELECT * FROM impulse_registry 
WHERE impulse_id IN ['imp_file_123', 'imp_cochange_456'];
```

**Expected Result**:
```json
[
  {
    "impulse_id": "imp_file_123",
    "total_uses": 1,
    "success_count": 1,
    "total_tokens": 1500,
    "avg_tokens_per_use": 1500,
    "last_used_at": "2026-03-04T...",
    "updated_at": "2026-03-04T..."
  }
]
```

---

### Step 7: Validate Learning API Endpoints
**Test Endpoint 1**: Get Execution Details
```bash
curl http://localhost:8080/api/v1/learning-loop/executions/<activity-id>
```

**Expected Response**:
```json
{
  "activity_id": "act_test_12345",
  "impulses_used": [...],
  "component_changes": [...]
}
```

**Test Endpoint 2**: Query Impulse Mappings
```bash
curl http://localhost:8080/api/v1/learning-loop/impulse-mappings?limit=10
```

**Expected Response**:
```json
[
  {
    "record_id": "...",
    "impulses_used_count": 3,
    "quality_score": 0.85
  }
]
```

**Test Endpoint 3**: Thompson Sampling Recommendations
```bash
curl http://localhost:8080/api/v1/learning-loop/recommendations?intent_type=code_fix
```

**Expected Response**:
```json
{
  "recommendations": [
    {
      "impulse_id": "imp_file_123",
      "score": 0.92,
      "confidence": "high"
    }
  ]
}
```

---

## Deployment Context

### Environment: Local Kubernetes
- **Deployment Method**: Helmfile (`helm/helmfile.yaml`)
- **Namespace**: `default` or `metabob-local`
- **Services**:
  - `metabob-opencode`: Not deployed, runs locally via `opencode` CLI
  - `metabob-cli`: MCP server (likely in devbob pod or separate deployment)
  - `metabob-rpc-api`: FastAPI backend (deployment in k8s)
  - `SurrealDB`: Database (deployment in k8s)

### Data Flow Summary
```
Local OpenCode CLI
  ↓ MCP (stdio or HTTP)
Local/K8s CLI MCP Server (Python)
  ↓ HTTP POST /api/v1/learning-loop/executions
K8s Backend API (FastAPI)
  ↓ SurrealDB Query
K8s SurrealDB (Database)
```

---

## Next Steps

### Immediate Actions (Backend Fixes)
1. ✅ Trace completed - gaps identified
2. ⏳ Fix GAP-1: Update `record_execution` to process `impulses_used` and `component_changes`
3. ⏳ Fix GAP-2: Update `insert_execution` signature and data storage
4. ⏳ Fix GAP-3: Integrate impulse learning operations
5. ⏳ Add unit tests for learning data persistence
6. ⏳ Commit fixes with message: "fix: persist impulses_used and component_changes to SurrealDB (MCP data flow validation)"

### Deployment & Validation
7. ⏳ Build and deploy updated backend to local k8s
8. ⏳ Execute test activity and verify logs
9. ⏳ Query SurrealDB to validate data persistence
10. ⏳ Test learning API endpoints
11. ⏳ Verify Thompson sampling and pattern detection use stored data

### Documentation
12. ✅ Create trace impulse: `trace-mcp-data-flow-validation-local-k8s`
13. ✅ Document current state vs desired state
14. ⏳ Create enforcement impulse after fixes are validated
15. ⏳ Update architecture diagrams to show complete data flow

---

## References

### Impulse
- **ID**: `trace-mcp-data-flow-validation-local-k8s`
- **Type**: `templateDefinition`
- **Budget**: 5000 tokens
- **Location**: `impulses/trace-mcp-data-flow-validation-local-k8s-content.json`

### Related Files
- OpenCode: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- CLI MCP: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
- Backend: `repos/metabob-rpc-api/server/routes/learning_loop.py`
- Database: `repos/metabob-rpc-api/server/db/operations/activity_execution.py`

### Validation Harnesses
- `tests/validation-harnesses/verify-mcp-data-flow-enforcement.ts`
- `tests/validation-harnesses/mcp-data-flow-devbob-cli-database-harness.ts`

---

**Status**: ⚠️ READY FOR ENFORCEMENT PHASE  
**Next Agent**: Enforcement agent should use this trace to implement backend fixes  
**Expected Outcome**: End-to-end MCP data flow with all tables populated and learning systems functional
