# Proto Data Structure Alignment - Canonical Source of Truth

**Date:** February 8, 2026  
**Source:** metabob-proto repository  
**Priority:** CRITICAL

---

## Discovery: Proto is the Canonical Schema

The `metabob-proto/proto/metabob/activity/execution.proto` defines the **official** data structures. All implementations must align with these definitions.

---

## Canonical ActivityExecution Schema

**Source:** `proto/metabob/activity/execution.proto` (Lines 138-176)

```protobuf
message ActivityExecution {
  // Identity & Links
  string execution_id = 1;
  string activity_id = 2;
  string variant_id = 3;
  string org_id = 4;
  string project_id = 5;
  string user_id = 6;
  string project_hash = 7;
  
  // Recommendation links (optional)
  optional string impression_id = 8;
  optional string selection_id = 9;
  optional string conversion_id = 10;
  
  // Timing
  double timestamp = 11;           // Unix timestamp
  int32 duration = 12;              // ✅ JUST "duration" in milliseconds
  
  // Outcome
  bool success = 13;
  optional string failure_reason = 14;
  
  // Cost
  double total_cost = 15;
  metabob.common.TokenUsage total_tokens = 16;  // ✅ Object, NOT int
  
  // Quality metrics
  map<string, double> quality_scores = 17;
  double correctness_score = 18;
  
  // Detailed execution data
  repeated TaskExecution tasks = 19;
  map<string, string> environment = 20;
  map<string, string> patterns = 21;
  map<string, string> metabob = 22;
  
  google.protobuf.Timestamp created_at = 23;
}
```

### Canonical TokenUsage Schema

**Source:** `proto/metabob/common/types.proto` (Lines 66-72)

```protobuf
message TokenUsage {
  int32 input_tokens = 1;
  int32 output_tokens = 2;
  int32 cache_tokens = 3;
  int32 total_tokens = 4;
}
```

---

## Current Misalignment

### Python Models (`server/actions/activities.py`)

```python
class ActivityExecution(BaseModel):
    duration_ms: int  # ❌ Should be "duration"
    tokens_used: int  # ❌ Should be "total_tokens" (TokenUsage object)
    tool_calls: int  # ❌ Not in proto
    tool_results: List[dict]  # ❌ Not in proto
```

### Database Schema (SurrealDB)

Current schema matches proto:
```
duration: int  # ✅ Correct per proto
total_tokens: object  # ✅ Correct per proto
```

### My V2 Implementation

Initially tried to match Python models (wrong):
```python
"duration_ms": 0,  # ❌ Wrong field name
"tokens_used": 0,  # ❌ Wrong structure
```

Then switched to match database (correct per proto):
```python
"duration": 0,  # ✅ Correct
"total_tokens": {"input": 0, "output": 0, "cache": 0}  # ✅ Correct
```

---

## Root Cause

**The Pydantic models in `activities.py` are NOT aligned with proto definitions.**

This creates confusion about which is the "correct" structure.

**Answer:** **Proto is always the source of truth.**

---

## Correct Data Structure (Per Proto)

### For ActivityExecution Record

```python
execution_record = {
    "execution_id": str,
    "activity_id": str,
    "variant_id": str,
    "org_id": str,
    "project_id": str,
    "user_id": str,
    "project_hash": str,
    
    # Timing
    "timestamp": float,  # Unix timestamp
    "duration": int,  # ✅ Just "duration", not "duration_ms"
    
    # Outcome
    "success": bool,
    "failure_reason": str | None,
    
    # Cost
    "total_cost": float,
    "total_tokens": {  # ✅ Object with breakdown
        "input_tokens": int,
        "output_tokens": int,
        "cache_tokens": int,
        "total_tokens": int
    },
    
    # Quality
    "quality_scores": dict[str, float],
    "correctness_score": float,
    
    # Details
    "tasks": list,  # TaskExecution objects
    "environment": dict[str, str],
    "patterns": dict[str, str],
    "metabob": dict[str, str],
    
    # Metadata
    "created_at": timestamp
}
```

---

## What Needs to Align

### 1. Python Pydantic Models (`activities.py`)

**Current:**
```python
class ActivityExecution(BaseModel):
    duration_ms: int  # ❌ Wrong
    tokens_used: int  # ❌ Wrong
```

**Should Be:**
```python
class ActivityExecution(BaseModel):
    duration: int  # ✅ Per proto
    total_tokens: TokenUsage  # ✅ Per proto (object)
```

### 2. V2 API Request/Response Models

**Current V2 API uses simplified fields:**
```python
class ExecutionCompleteRequest(BaseModel):
    duration_ms: float  # Simple name for API consumers
    tokens: int  # Simple int for API consumers
    cost: float  # Simple name
```

**Mapping Required:**
```python
# V2 API → Proto canonical structure
duration_ms → duration
tokens (int) → total_tokens (TokenUsage object)
cost → total_cost
```

---

## My V2 Implementation Status

### ✅ What I Got Right (By Accident)

My latest implementation actually matches proto better than the Pydantic models:

```python
execution_record = {
    "duration": 0,  # ✅ Matches proto
    "total_tokens": {"input_tokens": 0, "output_tokens": 0, ...},  # ✅ Matches proto
    "total_cost": 0.0,  # ✅ Matches proto
}
```

### 🔧 What Needs Fixing

1. **Token field names in object:**
   ```python
   # Current (my implementation)
   "total_tokens": {"input": 0, "output": 0, "cache": 0}
   
   # Should be (per proto)
   "total_tokens": {
       "input_tokens": 0,
       "output_tokens": 0,
       "cache_tokens": 0,
       "total_tokens": 0
   }
   ```

2. **Use Generated Proto Classes:**
   Instead of manual dicts, use generated Python classes from `gen/python/`

---

## Recommended Fix Strategy

### Short-Term (Current Session)

Keep my implementation but fix token field names:
```python
"total_tokens": {
    "input_tokens": int(execution.tokens * 0.6),
    "output_tokens": int(execution.tokens * 0.4),
    "cache_tokens": 0,
    "total_tokens": execution.tokens
}
```

### Long-Term (Next Session)

1. **Update Pydantic models** in `activities.py` to match proto
2. **Use generated proto classes** from `metabob-proto/gen/python/`
3. **Regenerate database schema** from proto definitions
4. **Ensure all APIs** use proto-compliant structures

---

## Proto-First Development

**Principle:** Proto defines the contract, all implementations follow

**Workflow:**
1. Define/update `.proto` file
2. Run `buf generate` to create Python/Go code
3. Use generated classes in implementations
4. Database schema auto-generated from proto

**Benefits:**
- Single source of truth
- Type safety across languages
- Automatic serialization
- Schema validation
- Documentation in proto files

---

## Action Items

### Immediate
1. ✅ Fix token field names in V2 API to match proto TokenUsage
2. ✅ Document the canonical proto structure
3. ✅ Note misalignment in activities.py for future fix

### Next Session
1. Align Pydantic models with proto definitions
2. Import and use generated proto Python classes
3. Regenerate SurrealDB schema from proto
4. Update all API endpoints to use proto types

---

## File References

**Proto Definitions (Source of Truth):**
- `repos/metabob-proto/proto/metabob/activity/execution.proto`
- `repos/metabob-proto/proto/metabob/activity/variant.proto`
- `repos/metabob-proto/proto/metabob/common/types.proto`

**Generated Code:**
- `repos/metabob-proto/gen/python/metabob/activity/execution_pb2.py`
- `repos/metabob-proto/gen/python/metabob/common/types_pb2.py`

**Misaligned Code:**
- `repos/metabob-rpc-api/server/actions/activities.py` - Uses duration_ms, tokens_used
- `repos/metabob-rpc-api/server/routes/v2_activities.py` - My implementation

---

**Conclusion:** The database schema was actually correct per proto. My implementation should align with proto field names, not the Pydantic models which appear to have diverged from proto.
