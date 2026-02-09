# Existing Backend Execution Tracking Infrastructure

**Date**: 2026-02-09  
**Purpose**: Map what exists vs what Phase 2 needs to add

---

## Summary

✅ **Execution tracking exists** in backend  
✅ **V2 API endpoints exist** for execution lifecycle  
✅ **Models defined** in `server/actions/activities.py`  
❌ **Impulse provenance NOT tracked** (Phase 2 gap)  
❌ **Component changes NOT tracked** (Phase 2 gap)  
❌ **Variant commissioning NOT implemented** (Phase 2 gap)

---

## Existing Models

### Location
`repos/metabob-rpc-api/server/actions/activities.py` (lines 51-92)

### RecordExecutionRequest (API Input)
```python
class RecordExecutionRequest(BaseModel):
    """Request to record an execution"""
    execution_id: str
    activity_id: str
    variant_id: str
    user_id: str
    project_hash: str
    impression_id: str | None = None
    selection_id: str | None = None
    timestamp: float
    duration_ms: int
    success: bool
    failure_reason: str | None = None
    total_cost: float = 0
    tokens_used: int = 0
    tool_calls: int = 0
    tool_results: List[dict[str, Any]] = Field(default_factory=list)
    metabob: dict[str, Any] | None = None
```

**What's Missing**:
- `impulses_used: List[dict]` - NEW (Phase 2)
- `component_changes: List[dict]` - NEW (Phase 2)

---

### ActivityExecution (Database Model)
```python
class ActivityExecution(BaseModel):
    """Record of an activity execution"""
    execution_id: str
    activity_id: str
    variant_id: str
    org_id: str
    project_id: str
    user_id: str
    project_hash: str
    impression_id: str | None = None
    selection_id: str | None = None
    conversion_id: str | None = None
    timestamp: float
    duration_ms: int
    success: bool
    failure_reason: str | None = None
    total_cost: float = 0
    tokens_used: int = 0
    tool_calls: int = 0
    tool_results: List[dict[str, Any]] = Field(default_factory=list)
    metabob: dict[str, Any] | None = None
    quality_scores: dict[str, float] = Field(default_factory=dict)
```

**What's Missing**:
- `impulses_used: List[dict]` - NEW (Phase 2)
- `component_changes: List[dict]` - NEW (Phase 2)
- `session_id: str` - NEW (Phase 2, for linking to session memory)

---

## Existing API Endpoints

### Location
`repos/metabob-rpc-api/server/routes/v2_activities.py`

### 1. POST /v2/activities/record/start (line 710)
**Purpose**: Record execution start  
**Input**: `ExecutionStartRequest`
```python
class ExecutionStartRequest(BaseModel):
    template_id: str
    variables: dict
    session_id: str
    execution_id: str
```

**What it does**:
- Creates `activity_executions` record in SurrealDB
- Sets initial state (success=False, duration=0)
- Returns execution_id

**Note**: Already mentions proto compliance in comments!

---

### 2. POST /v2/activities/record/step (line 776)
**Purpose**: Record individual step completion (optional)  
**Input**: `ExecutionStepRequest`
```python
class ExecutionStepRequest(BaseModel):
    execution_id: str
    step_order: int
    success: bool
    duration_ms: float
    cost: Optional[float]
    tokens: Optional[int]
    output: Optional[str]
```

**What it does**:
- Appends step result to `steps` array in execution record
- Tracks granular progress

**Phase 2 Extension**: Could add `impulses_used_in_step` here

---

### 3. POST /v2/activities/record/complete (line 824)
**Purpose**: Record execution completion  
**Input**: `ExecutionCompleteRequest`
```python
class ExecutionCompleteRequest(BaseModel):
    execution_id: str
    success: bool
    duration_ms: float
    cost: float
    tokens: int
    step_results: List[dict] = Field(default_factory=list)
    outcome: str
    notes: Optional[str]
```

**What it does** (line 842-900):
- Updates execution record with final metrics
- Converts tokens (int) to TokenUsage proto structure
- Updates Thompson Sampling metrics
- Records outcome

**Phase 2 Extension**: Add impulse_provenance and component_changes here!

---

## Existing Helper Functions

### Location
`repos/metabob-rpc-api/server/actions/activities.py`

### 1. record_execution() (line 468)
**Purpose**: Unified execution recording  
**What it does**:
1. Verifies activity/variant exist
2. Calculates quality scores
3. Creates ActivityExecution record
4. Auto-creates conversion (if linked to selection)
5. Updates variant metrics via `_update_variant_metrics()`
6. Updates activity metrics via `_update_activity_metrics()`

**Phase 2 Extension Opportunity**: 
- Add `_store_impulse_provenance()` call
- Add `_store_component_changes()` call
- Add `_check_variant_commissioning()` call

---

### 2. _update_variant_metrics() (line 640-690)
**Purpose**: Update performance metrics after execution  
**What it does**:
- Increments execution count
- Updates success rate
- Updates avg duration, cost, tokens
- **Updates Thompson Sampling (alpha/beta)**

**Key insight**: Thompson Sampling logic ALREADY EXISTS!

---

### 3. _calculate_quality_scores() (not shown but referenced)
**Purpose**: Calculate quality scores from execution  
**Inputs**: correctness, actual vs expected duration/cost

**Phase 2 Note**: Could incorporate impulse effectiveness here

---

## Existing Database Schema

### Table: activity_executions
**Storage**: SurrealDB (schemaless, but structure followed)

**Current fields** (from line 735-759):
```javascript
{
  execution_id: string,
  activity_id: string,
  variant_id: string,
  org_id: string,
  project_id: string,
  user_id: string,
  project_hash: string,
  timestamp: double,
  duration: int32,  // NOTE: "duration" not "duration_ms" in DB!
  success: bool,
  total_cost: double,
  total_tokens: {
    input_tokens: int,
    output_tokens: int,
    cache_tokens: int,
    total_tokens: int
  },
  quality_scores: map<string, double>,
  correctness_score: double,
  tasks: array,
  environment: map<string, string>,
  patterns: map<string, string>,
  metabob: map<string, string>
}
```

**Indexes**: Not visible in code, but likely on:
- execution_id (unique)
- variant_id (for querying variant executions)

**Phase 2 Extensions Needed**:
```javascript
// Add these fields:
session_id: string,  // Link to session memory
impulses_used: [{
  impulse_id: string,
  content_hash: string,
  tokens_used: int,
  was_useful: bool,
  loaded_at: timestamp
}],
component_changes: [{
  file_path: string,
  component_name: string,
  component_type: string,
  change_type: enum,
  related_impulse_ids: [string],
  lines_added: int,
  lines_removed: int
}]
```

---

## Thompson Sampling Integration

### Current Implementation
**Location**: `_update_variant_metrics()` (line 640+)

**What it does**:
- Maintains Beta distribution per variant: `Beta(alpha, beta)`
- On success: `alpha += 1`
- On failure: `beta += 1`
- Calculates success_rate, confidence intervals

**Key insight**: Variant selection and optimization ALREADY WORKS!

**Phase 2 Enhancement**:
- Use impulse patterns to create variant hypotheses
- Commission variants when impulse divergence detected (3+ similar patterns)
- New variants get own Beta distribution

---

## Activity Outcome Models

### Location
`repos/metabob-rpc-api/server/models/activity_outcome.py`

### Existing Models
1. **ActivityExpectation**: Expected outcomes before execution
2. **ActivityComparison**: Compare expected vs actual
3. **AgentDecision**: Agent decisions during execution
4. **TemplateEffectiveness**: Aggregate template metrics

**What's Missing**:
- No impulse tracking models
- No component change models
- No variant commissioning logic

**Phase 2 Strategy**: Extend ActivityExecution, don't replace these models

---

## What Phase 2 Needs to Add

### Backend Extensions (repos/metabob-rpc-api)

**1. New Models** (create `server/models/proto_execution.py`):
```python
class ImpulseUsage(BaseModel):
    impulse_id: str
    content_hash: str
    tokens_used: int
    was_useful: bool
    loaded_at: datetime

class ComponentChange(BaseModel):
    file_path: str
    component_name: str
    component_type: str
    change_type: str  # "CREATED", "MODIFIED", "DELETED"
    related_impulse_ids: List[str]
    lines_added: int
    lines_removed: int
```

**2. Extend Existing Models**:
```python
# In ActivityExecution and RecordExecutionRequest:
session_id: str  # Link to session
impulses_used: List[dict] = Field(default_factory=list)
component_changes: List[dict] = Field(default_factory=list)
```

**3. New Helper Functions**:
```python
# In server/actions/impulse_provenance.py (NEW):
async def store_impulse_provenance(db, execution_id, impulses_used)
async def get_impulse_effectiveness(db, impulse_id)

# In server/actions/component_tracking.py (NEW):
async def store_component_changes(db, execution_id, component_changes)
async def get_component_history(db, file_path, component_name)

# In server/actions/variant_commissioning.py (NEW):
async def should_commission_variant(db, execution_data)
async def commission_variant_from_execution(db, execution_data)
async def count_similar_executions(db, variant_id, impulse_pattern)
```

**4. Extend Existing Endpoints**:
```python
# POST /v2/activities/record/complete
# Add to ExecutionCompleteRequest:
{
  ...existing fields...,
  impulses_used: List[ImpulseUsage],
  component_changes: List[ComponentChange],
  git_diff: Optional[str]
}

# Handler adds:
await store_impulse_provenance(db, execution_id, request.impulses_used)
await store_component_changes(db, execution_id, request.component_changes)

# Check commissioning:
if await should_commission_variant(db, request):
    new_variant = await commission_variant_from_execution(db, request)
    logger.info(f"Commissioned variant: {new_variant.variant_id}")
```

---

## Integration Points

### 1. Existing record_execution() Extension
**File**: `server/actions/activities.py` line 468

**Add after line 540** (after execution stored):
```python
# Phase 2: Store impulse provenance
if request.impulses_used:
    await store_impulse_provenance(db, execution.execution_id, request.impulses_used)

# Phase 2: Store component changes
if request.component_changes:
    await store_component_changes(db, execution.execution_id, request.component_changes)

# Phase 2: Check variant commissioning
if await should_commission_variant(db, request):
    new_variant = await commission_variant_from_execution(db, request)
    logger.info(f"Auto-commissioned variant: {new_variant.variant_id}")
```

### 2. API Endpoint Extension
**File**: `server/routes/v2_activities.py` line 824

**Extend ExecutionCompleteRequest** (line 185):
```python
class ExecutionCompleteRequest(BaseModel):
    # ... existing fields ...
    
    # NEW Phase 2 fields:
    impulses_used: List[dict] = Field(default_factory=list)
    component_changes: List[dict] = Field(default_factory=list)
```

**Update handler** (line 858+):
```python
update_data = {
    # ... existing fields ...
    
    # NEW Phase 2 fields:
    "impulses_used": execution.impulses_used,
    "component_changes": execution.component_changes,
}
```

---

## Backward Compatibility Strategy

**Constraint**: Don't break existing execution recording

**Strategy**:
1. **Add fields as optional**: Default to empty lists
2. **Extend models**: Don't replace ActivityExecution
3. **Gradual rollout**: Old clients send without new fields (works)
4. **New clients**: Send with impulse/component data (enhanced)

**Validation**:
```python
# Test that old API calls still work:
await record_execution(db, RecordExecutionRequest(
    execution_id="test",
    variant_id="bug-fix-v1",
    # ... old fields only, no impulses/components ...
))
# Should work without errors
```

---

## Database Indexes Needed

**New indexes for Phase 2**:
```surql
-- Impulse queries
DEFINE INDEX execution_impulse ON activity_executions FIELDS impulses_used[*].impulse_id;

-- Component queries
DEFINE INDEX execution_component ON activity_executions FIELDS component_changes[*].file_path;
DEFINE INDEX execution_component_name ON activity_executions FIELDS component_changes[*].component_name;

-- Session linkage
DEFINE INDEX execution_session ON activity_executions FIELDS session_id;

-- Pattern detection (for commissioning)
DEFINE INDEX execution_success_impulses ON activity_executions FIELDS success, variant_id, impulses_used[*].impulse_id;
```

---

## Proto Compliance Notes

**From code comments** (line 733-759):
> "Create execution record using proto-compliant structure"
> "Per proto/metabob/activity/execution.proto ActivityExecution message"
> "Database schema is generated from proto - must match exactly"

**Key insight**: Backend ALREADY tries to follow proto!

**Current proto compliance issues**:
1. ✅ Field names use snake_case (correct)
2. ✅ TokenUsage structure matches proto
3. ❌ No ExecutionOutcome message in proto (we're designing it)
4. ❌ Field name inconsistency: `duration_ms` (API) vs `duration` (DB)

**Phase 2 proto alignment**:
- Use proposed ExecutionOutcome schema from PROTO_SCHEMA_REFERENCE.md
- Follow proto naming: `impulses_used`, `component_changes`
- Use snake_case consistently

---

## Summary: What Exists vs What's Needed

### ✅ Exists (Don't Rebuild)
- Execution lifecycle tracking (start/step/complete)
- ActivityExecution model
- V2 API endpoints
- Thompson Sampling metrics
- Variant performance tracking
- Database storage (SurrealDB)

### ❌ Missing (Phase 2 Must Add)
- Impulse provenance tracking
- Component change tracking
- Variant commissioning logic
- Pattern detection (3+ similar divergences)
- Impulse effectiveness metrics
- Component-to-impulse linkage

### 🔧 Extend (Don't Replace)
- ActivityExecution model (add 3 fields)
- ExecutionCompleteRequest (add 2 fields)
- record_execution() function (add 3 calls)
- Database schema (add 2 arrays)

---

## Next Steps for Phase 2 Implementation

1. **Task 1**: Create `proto_execution.py` models (ImpulseUsage, ComponentChange)
2. **Task 2**: Extend ActivityExecution with 3 new fields
3. **Task 3**: Create helper functions (impulse_provenance.py, component_tracking.py, variant_commissioning.py)
4. **Task 4**: Extend ExecutionCompleteRequest and handler
5. **Task 5**: Add database indexes
6. **Task 6**: Test backward compatibility

**Estimated effort**: 6-8 hours (as planned in PHASE2_EXECUTION_LEARNING_BREAKDOWN.md)

---

## Key Takeaway

**80% of execution tracking infrastructure exists!**

Phase 2 is about **extending**, not **rebuilding**:
- Add 3 fields to existing models
- Create 3 new helper modules
- Extend 1 API endpoint
- Add commissioning logic on top of existing Thompson Sampling

**This is great news** - much less work than anticipated!
