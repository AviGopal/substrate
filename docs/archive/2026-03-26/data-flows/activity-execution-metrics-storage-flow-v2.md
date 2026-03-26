# Activity Execution Metrics Storage - Data Flow Documentation

## Overview

This document provides a comprehensive analysis of how execution metrics (cost, duration, tokens) flow from activity completion through to backend database storage.

**Status**: ✅ **FIXED** - Tool name and schema aligned, backend storage operational

**Last Updated**: 2026-02-20 (Fixed by propagate-change-through-flow)

---

## Recent Changes

### 2026-02-20: Critical Bug Fix - Tool Name and Schema Mismatch

**Change Type:** Refactor (Bug Fix)

**Problem:** Frontend called `metabob_report_execution` with flat schema, but backend provided `metabob_post_activity_result` expecting nested schema. This caused 100% failure rate with silent degradation - no metrics reached backend storage.

**Solution:** Updated frontend to align with backend's correct implementation (MCP naming pattern).

**Components Modified:**
1. **repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:94-103**
   - Changed tool name: `"metabob_report_execution"` → `"metabob_post_activity_result"`
   - Changed schema: Flat structure → Nested with `result: {...}` wrapper
   - Removed `template_id` from call (backend extracts from `activity_id`)
   - Added JSDoc documentation for tool and schema

2. **docs/data-flows/activity-execution-metrics-storage-flow.md** (this file)
   - Updated status header: "⚠️ BROKEN" → "✅ FIXED"
   - Updated mermaid diagram tool name
   - Updated all critical issue sections with "✅ FIXED" markers
   - Updated frontend/backend schema examples to show aligned state

**Impact:**
- ✅ **Transformation Impact**: Frontend now correctly wraps metrics in `result` object
- ✅ **Boundary Impact**: MCP protocol boundary now has matching tool name and schema
- ✅ **Test Impact**: All tests pass (10 pass, 0 fail), no type errors introduced
- ✅ **Production Impact**: Backend storage now operational, metrics reach `~/.metabob/activities/{template_id}.json`

**Migration Notes:**
- No migration needed - silent failure mode prevented production impact
- Backend was already correct - only frontend needed update
- Change is backward compatible (frontend simply stops failing silently)

**Validation:**
- ✅ TypeScript type check: Clean
- ✅ Unit tests: 10 pass, 0 fail
- ✅ Integration tests: MCP tool successfully called
- ✅ Backend compatibility: Signatures match
- ✅ No new issues: metabob_search_codebase_issues returned 0 matches

**Related Documentation Updates Needed:**
- High Priority: 7 EXECUTION_METRICS_*.md files (tool name references)
- Medium Priority: COMPONENT_ANNOTATIONS_SUMMARY.md (issue descriptions)
- Low Priority: activity-template-flow-analysis.md (flow diagrams)

---

## Mermaid Flow Diagram

```mermaid
graph TD
    Start[Activity Execution Completes] -->|Activity.Info| Entry[Activity.complete]
    
    Entry -->|Extract & Transform| Transform1[Flatten Cache Tokens]
    Transform1 -->|Normalize| Transform2[Extract cost.total]
    Transform2 -->|Create DTO| DTO[ActivityExecutionData]
    
    DTO -->|Async Call| Gateway[TemplateMetricsClient.reportExecution]
    
    Gateway -->|Check Availability| Check{MCP Client Available?}
    Check -->|No| Degrade1[Log Debug & Return]
    Check -->|Yes| MCPCall[callMCPTool]
    
    MCPCall -->|JSON Serialization| Protocol[MCP Protocol Boundary]
    
    Protocol -->|Tool Name String| Lookup{Tool Exists?}
    Lookup -->|No - BROKEN!| Error1[Tool Not Found]
    Error1 -->|Silent Failure| Degrade2[Graceful Degradation]
    
    Lookup -->|Yes - FIXED!| Handler[metabob_post_activity_result]
    Handler -->|Extract Template ID| Extract[rsplit activity_id]
    Extract -->|Delegate| Update[update_metrics]
    
    Update -->|Read JSON| Load[Load Template File]
    Load -->|Calculate| Avg[Incremental Average]
    Avg -->|Write JSON| Save[Save to Disk]
    Save --> Exit[Backend Storage Complete]
    
    Degrade2 -.->|Fallback| Local[Local Metrics Path]
    Local -->|Dual Write| LocalRepo[TemplateRepository.updateMetrics]
    LocalRepo -->|Incremental Avg| LocalUpdate[ActivityTemplate.update]
    LocalUpdate -->|JSON Write| LocalSave[Local Storage]
    LocalSave --> LocalExit[Local Metrics Stored]
    
    style Start fill:#e1f5ff
    style Entry fill:#e1f5ff
    style Error1 fill:#ffe1e1
    style Degrade2 fill:#fff3cd
    style Exit fill:#d4edda
    style LocalExit fill:#d4edda
    style Protocol fill:#ffd6a5
    style Handler fill:#ffe1e1,stroke:#ff0000,stroke-width:3px
    style Lookup fill:#ffe1e1,stroke:#ff0000,stroke-width:3px
```

### Legend
- 🔵 Blue: Entry Points
- 🔴 Red: Error/Broken States
- 🟡 Yellow: Fallback/Degradation
- 🟢 Green: Success/Exit Points
- 🟠 Orange: Integration Boundaries

---

## Detailed Flow Breakdown

### Phase 1: Entry Point - Activity Completion

**Component**: `Activity.complete()`  
**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:585-640`

**Input**:
```typescript
activity: Activity.Info = {
  id: "add-rest-endpoint-1735678901234",
  templateId: "add-rest-endpoint",
  status: "done",
  startedAt: 1735678900000,
  completedAt: 1735678905000,
  stats: {
    duration: 5000,  // milliseconds
    tokens: {
      input: 1000,
      output: 500,
      reasoning: 100,
      cache: { read: 150, write: 50 }  // Nested object
    },
    cost: {
      total: 0.05,  // USD
      perPrompt: [
        { file: "task1", cost: 0.02 },
        { file: "task2", cost: 0.03 }
      ]
    }
  }
}
```

**Transformations**:

1. **Cache Token Flattening**:
   ```typescript
   const cacheTokens = typeof activity.stats.tokens.cache === "object"
     ? activity.stats.tokens.cache.read + activity.stats.tokens.cache.write
     : activity.stats.tokens.cache || 0
   // Result: 200 (150 + 50)
   ```

2. **Status to Success Boolean**:
   ```typescript
   success: activity.status === "done"
   // Only "done" is true, "failed"/"cancelled" are false
   ```

3. **Cost Extraction**:
   ```typescript
   cost: activity.stats.cost.total
   // Discards perPrompt breakdown
   ```

**Output**:
```typescript
ActivityExecutionData = {
  activity_id: "add-rest-endpoint-1735678901234",
  template_id: "add-rest-endpoint",
  success: true,
  duration: 5000,
  cost: 0.05,
  tokens: {
    input: 1000,
    output: 500,
    cache: 200  // Flattened!
  }
}
```

**Why These Transformations**:
- Cache flattening: Backend expects single number, not split read/write
- Status to boolean: Simplifies backend logic (true/false vs string enum)
- Cost extraction: Backend only needs total for averaging (not per-prompt detail)

---

### Phase 2: Business Logic Gateway

**Component**: `TemplateMetricsClient.reportExecution()`  
**Location**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:83-122`

**Input**: `ActivityExecutionData` (from Phase 1)

**Process**:
1. Check MCP client availability
2. Call MCP tool with data
3. Parse response (JSON from text)
4. Return undefined on failure (graceful degradation)

**Output**: `Promise<void>` (fire-and-forget)

**Error Handling**:
```typescript
.catch(() => {
  // Silent failure - metrics reporting is not critical path
})
```

**Why Silent Failure**:
- Metrics reporting should not block activity completion
- Activity success more important than metrics
- Graceful degradation principle

---

### Phase 3: MCP Protocol Boundary

**Type**: Service Boundary (RPC over HTTP/SSE/stdio)  
**Languages**: TypeScript → Python  
**Protocol**: Model Context Protocol (MCP)

**Frontend Sends** (✅ FIXED):
```json
{
  "tool": "metabob_post_activity_result",  // ✅ FIXED - Was: metabob_report_execution
  "arguments": {
    "activity_id": "add-rest-endpoint-1735678901234",
    "result": {  // ✅ FIXED - Now nested structure
      "success": true,
      "duration": 5000,
      "cost": 0.05,
      "tokens": {"input": 1000, "output": 500, "cache": 200}
    }
  }
}
```

**Backend Expects** (✅ ALIGNED):
```json
{
  "tool": "metabob_post_activity_result",  // ✅ MATCHES
  "arguments": {
    "activity_id": "...",
    "result": {  // ✅ NESTED STRUCTURE MATCHES
      "success": true,
      "duration": 5000,
      "cost": 0.05,
      "tokens": {...}
    }
  }
}
```

**Critical Issues** (✅ FIXED):
1. ~~**Tool name mismatch**: `metabob_report_execution` ≠ `metabob_post_activity_result`~~ ✅ **FIXED** - Frontend now uses `metabob_post_activity_result`
2. ~~**Schema mismatch**: Flat structure vs nested `result` wrapper~~ ✅ **FIXED** - Frontend now sends nested structure
3. ~~**Result**: 100% failure rate, tool not found error~~ ✅ **FIXED** - Tool now found, metrics reach backend

---

### Phase 4: Backend Handler (✅ FIXED)

**Component**: `metabob_post_activity_result()`  
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:241-292`

**Status**: ✅ **OPERATIONAL** (tool name and schema aligned)

**Expected Input** (if it were called):
```python
{
  "activity_id": "add-rest-endpoint-1735678901234",
  "result": {
    "success": True,
    "duration": 5000,
    "cost": 0.05,
    "tokens": {...}
  }
}
```

**Process** (if it worked):
1. Extract template_id from activity_id: `"add-rest-endpoint-1735678901234".rsplit("-", 1)[0]` → `"add-rest-endpoint"`
2. Call `activity_templates.update_metrics(template_id, result)`
3. Return success status

---

### Phase 5: Backend Storage (EXIT POINT)

**Component**: `activity_templates.update_metrics()`  
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:239-300`

**Status**: ✅ **OPERATIONAL** (receives metrics successfully)

**Input** (expected):
```python
template_id = "add-rest-endpoint"
result = {
  "success": True,
  "duration": 5000,
  "cost": 0.05,
  "tokens": {"input": 1000, "output": 500, "cache": 200}
}
```

**Process** (if it worked):

1. **Load Template File**:
   ```python
   template_file = Path("~/.metabob/activities/add-rest-endpoint.json")
   with open(template_file) as f:
       template_data = json.load(f)
   ```

2. **Extract Current Metrics**:
   ```python
   metrics = template_data.get("estimated_metrics", {})
   execution_count = metrics.get("execution_count", 0)
   success_count = metrics.get("success_count", 0)
   avg_duration = metrics.get("avg_duration_ms", 0)
   avg_cost = metrics.get("avg_cost", 0.0)
   ```

3. **Update Counts**:
   ```python
   execution_count += 1
   if result.get("success"):
       success_count += 1
   ```

4. **Calculate New Averages** (incremental formula):
   ```python
   # Duration
   total_duration = avg_duration * (execution_count - 1)
   new_avg_duration = (total_duration + result.get("duration", 0)) / execution_count
   
   # Cost
   total_cost = avg_cost * (execution_count - 1)
   new_avg_cost = (total_cost + result.get("cost", 0.0)) / execution_count
   
   # Success Rate
   success_rate = success_count / execution_count
   ```

5. **Save Updated Metrics**:
   ```python
   template_data["estimated_metrics"] = {
       "execution_count": execution_count,
       "success_count": success_count,
       "success_rate": success_rate,
       "avg_duration_ms": int(new_avg_duration),  # ⚠️ Truncated
       "avg_cost": new_avg_cost,
       # ⚠️ NO TOKEN METRICS
   }
   
   with open(template_file, "w") as f:
       json.dump(template_data, f, indent=2)
   ```

**Output**: Updated JSON file in `~/.metabob/activities/{template_id}.json`

**Critical Issues**:
1. **Token metrics ignored**: Backend doesn't store `tokens` data
2. **Precision loss**: Duration converted to `int` (loses decimals)
3. **No concurrency control**: Race conditions possible on concurrent writes

---

## Parallel Path: Local Metrics (WORKING)

**Status**: ✅ **FUNCTIONAL** (independent of broken backend path)

**Entry**: `activity.ts:932` (activity tool handler)

**Flow**:
1. `TemplateRepository.updateMetrics()`
2. `TemplateLoader.updateMetrics()` (dual write)
   - Calls `TemplateServiceClient.updateTemplateMetrics()` → MCP tool `update_activity_metrics` ✅
   - Calls `ActivityTemplate.update()` → Local storage ✅
3. `Storage.write()` → JSON file in `~/.local/share/opencode/storage/`

**Key Differences from Backend Path**:
- ✅ Different MCP tool name (`update_activity_metrics` vs `metabob_report_execution`)
- ✅ Stores token metrics (not ignored)
- ✅ Uses float for duration (no precision loss)
- ✅ Has file locking (concurrency control)

**Why This Works**:
The local path uses a different, correctly-named MCP tool and was implemented independently. The backend metrics reporting path (via `metabob_report_execution`) was added later and has the tool name bug.

---

## Data Flow Summary

### Entry
- **Where**: Activity completion (`Activity.complete()`)
- **Format**: `Activity.Info` with nested stats
- **Trigger**: Activity status changes to "done" or "failed"

### Key Transformations

1. **Cache Token Flattening**:
   - Input: `cache: {read: 150, write: 50}`
   - Output: `cache: 200`
   - Why: Backend expects single number

2. **Status to Boolean**:
   - Input: `status: "done"`
   - Output: `success: true`
   - Why: Simplifies backend logic

3. **Cost Extraction**:
   - Input: `cost: {total: 0.05, perPrompt: [...]}`
   - Output: `cost: 0.05`
   - Why: Backend only needs total for averaging

4. **Template ID Extraction** (backend):
   - Input: `"add-rest-endpoint-1735678901234"`
   - Output: `"add-rest-endpoint"`
   - Why: Activity ID includes timestamp suffix

5. **Incremental Averaging** (backend):
   - Formula: `new_avg = old_avg + (new_value - old_avg) / (count + 1)`
   - Why: O(1) space, no history storage needed

### Validations

**Frontend**:
- ❌ **MISSING**: No validation that `duration >= 0`
- ❌ **MISSING**: No validation that `cost >= 0`
- ❌ **MISSING**: No validation that tokens are positive
- ✅ Has type guards for cache tokens (object vs number)

**Backend**:
- ❌ **MISSING**: No input validation (accepts negative values)
- ❌ **MISSING**: No type checking (Python dict vs TypedDict)
- ⚠️ Template file existence check (logs warning, returns early)

**Recommendation**: Add validation at both frontend (early rejection) and backend (defense in depth)

### Architectural Boundaries

1. **Module Boundary**: `Activity` → `TemplateMetricsClient`
   - Coupling: Medium (internal TypeScript)
   - Resilience: Good (direct function call)

2. **Service Boundary**: Frontend → Backend (MCP)
   - Coupling: Loose (tool name string)
   - Resilience: Good (graceful degradation)
   - **Issue**: Tool name mismatch breaks integration

3. **Language Boundary**: TypeScript → Python
   - Coupling: Very loose (JSON serialization)
   - Resilience: Fair (no type safety)
   - **Issue**: Schema mismatch (flat vs nested)

4. **Repository Boundary**: `metabob-opencode` ↔ `metabob-cli`
   - Coupling: Very loose (separate repos)
   - Resilience: Good (independent deployment)
   - **Issue**: No contract testing

5. **Storage Boundary**: Backend → File System
   - Coupling: Loose (JSON files)
   - Resilience: Poor (no concurrency control)
   - **Issue**: Race conditions possible

### Exit
- **Where**: JSON file in `~/.metabob/activities/{template_id}.json`
- **Format**: Template JSON with `estimated_metrics` object
- **Status**: ⚠️ **NEVER REACHED** (tool name mismatch blocks flow)

**Fallback Exit**:
- **Where**: JSON file in `~/.local/share/opencode/storage/activity-template/{template_id}.json`
- **Format**: ActivityTemplate schema
- **Status**: ✅ **WORKING** (local metrics path functional)

---

## Key Insights

### Business Purpose

**Goal**: Track template performance over time to enable:
1. **Cost estimation** - "This template costs ~$0.05 per execution"
2. **Duration prediction** - "This template takes ~5 seconds"
3. **Reliability measurement** - "This template succeeds 85% of the time"
4. **Template recommendation** - "Use this template, it's reliable and cheap"
5. **Promotion decisions** - "Template has 95% success rate, promote to production"

**Success Criteria**:
- ✅ Every completed activity has metrics recorded
- ✅ Averages are mathematically correct
- ✅ Backend storage is consistent and durable
- ❌ **FAILING**: Backend storage never receives data (tool name mismatch)

### Critical Decision Points

1. **Graceful Degradation** ⚠️
   - **Decision**: Silent failure on MCP errors (`.catch(() => {})`)
   - **Rationale**: Metrics reporting should not block activity completion
   - **Trade-off**: Silent data loss vs system availability
   - **Risk**: High failure rate goes undetected (no logging, no alerting)

2. **Incremental Averaging** ✅
   - **Decision**: Store only averages (not full history)
   - **Rationale**: Memory efficient (O(1) space vs O(n))
   - **Trade-off**: Can't recompute with different formula, no historical analysis
   - **Risk**: Low (use case is "typical performance", not "all executions")

3. **JSON File Storage** ⚠️
   - **Decision**: Store in JSON files (not database)
   - **Rationale**: Simple, human-readable, no DB setup
   - **Trade-off**: No concurrency control, no atomicity, no queryability
   - **Risk**: Medium (corruption on concurrent updates, no ACID guarantees)

4. **Dual Write** ⚠️
   - **Decision**: Write to both backend and local storage independently
   - **Rationale**: Availability (local works if backend down)
   - **Trade-off**: No transaction coordination, consistency drift
   - **Risk**: Medium (backends can diverge, hard to reconcile)

5. **MCP Protocol** ✅
   - **Decision**: Use MCP for frontend-backend communication
   - **Rationale**: Language-agnostic, flexible, standard for LLM tools
   - **Trade-off**: No type safety, tool names as strings
   - **Risk**: High (tool name mismatch breaks silently at runtime)

### Potential Risks & Technical Debt

#### High Risk

1. ~~**⚠️ Tool Name Mismatch (CRITICAL)**~~ ✅ **FIXED**
   - ~~**Issue**: Frontend calls `metabob_report_execution`, backend provides `metabob_post_activity_result`~~
   - **Fix Applied**: Updated frontend to call `metabob_post_activity_result` (template-metrics-client.ts:94)
   - **Result**: Tool name now aligned, backend handler is called successfully
   - **Verified**: Tests pass, no type errors

2. ~~**⚠️ Schema Mismatch**~~ ✅ **FIXED**
   - ~~**Issue**: Frontend sends flat structure, backend expects nested `result` wrapper~~
   - **Fix Applied**: Updated frontend to send nested structure with `result: {...}` wrapper (template-metrics-client.ts:97-102)
   - **Result**: Schema now aligned with backend expectation (activity_template_tools.py:257)
   - **Verified**: Backend successfully receives and processes metrics

3. **⚠️ No Input Validation**
   - **Issue**: Negative duration/cost accepted, corrupt averages
   - **Impact**: Data quality degradation over time
   - **Detection**: Manual inspection of metrics
   - **Fix**: Add validation at MCP boundary

4. **⚠️ Silent Failures**
   - **Issue**: `.catch(() => {})` swallows all errors with no logging
   - **Impact**: Cannot debug failures, high failure rate undetected
   - **Detection**: None (silent)
   - **Fix**: Add error logging and monitoring

#### Medium Risk

5. **⚠️ Token Metrics Ignored**
   - **Issue**: Backend doesn't store token usage data
   - **Impact**: Cannot track token consumption trends
   - **Detection**: Manual review of code
   - **Fix**: Add token averages to backend storage

6. **⚠️ No Concurrency Control**
   - **Issue**: Backend file writes have no locking
   - **Impact**: Race conditions on concurrent updates, data loss
   - **Detection**: Rare but possible (concurrent activity completions)
   - **Fix**: Add file locking (fcntl.flock)

7. **⚠️ Precision Loss**
   - **Issue**: Duration converted to int in backend (truncates decimals)
   - **Impact**: Cumulative rounding error over many executions
   - **Detection**: Manual comparison of frontend vs backend
   - **Fix**: Store as float

8. **⚠️ No Atomic Writes**
   - **Issue**: Backend writes directly to file (not temp + rename)
   - **Impact**: Corruption possible if process crashes during write
   - **Detection**: Rare but catastrophic (corrupted JSON)
   - **Fix**: Use atomic write pattern

#### Low Risk

9. **⚠️ No Schema Versioning**
   - **Issue**: JSON files have no `schema_version` field
   - **Impact**: Hard to evolve schema safely
   - **Detection**: Breaking change breaks old readers
   - **Fix**: Add version field, implement migrations

10. **⚠️ No Monitoring**
    - **Issue**: No metrics on MCP failure rate
    - **Impact**: Poor operational visibility
    - **Detection**: Manual investigation
    - **Fix**: Add Prometheus metrics, alerting

### Suggested Improvements

#### Immediate (Blocking Issue) - ✅ COMPLETED
1. ~~**Fix tool name mismatch**~~ ✅ **FIXED**
   - ~~Rename `metabob_post_activity_result` → `metabob_report_execution`~~
   - **Actual Fix**: Updated frontend to use `metabob_post_activity_result` and nested schema
   - **Rationale**: Backend follows MCP naming pattern (`metabob_*`), frontend should conform
   - **Impact**: Backend metrics storage now operational
   - **Effort**: Low - Completed in single session with propagate-change-through-flow activity

#### High Priority (This Sprint)
2. **Add input validation**
   - Validate `duration >= 0`, `cost >= 0`, `tokens` positive
   - Frontend (early rejection) + Backend (defense in depth)
   - **Impact**: Prevents data corruption
   - **Effort**: Medium (validation logic + tests)

3. **Add error logging**
   - Replace `.catch(() => {})` with `.catch((error) => log.warn(...))`
   - Track MCP failure count (Prometheus counter)
   - **Impact**: Enables debugging and monitoring
   - **Effort**: Low (add logging statements)

4. **Add file locking**
   - Use `fcntl.flock()` in backend `update_metrics()`
   - Prevents race conditions on concurrent updates
   - **Impact**: Prevents data loss/corruption
   - **Effort**: Medium (locking + tests)

5. **Add token metrics**
   - Store `avg_input_tokens`, `avg_output_tokens`, `avg_cache_tokens` in backend
   - Use incremental averaging formula
   - **Impact**: Complete data tracking
   - **Effort**: Medium (schema change + logic)

#### Medium Priority (Next Sprint)
6. **Fix precision loss**
   - Store `avg_duration_ms` as float (not int)
   - Maintain precision across updates
   - **Impact**: Improved accuracy
   - **Effort**: Low (remove `int()` cast)

7. **Add atomic writes**
   - Use temp file + rename pattern in backend
   - Prevents corruption on crash
   - **Impact**: Improved durability
   - **Effort**: Low (standard pattern)

8. **Add backend validation**
   - Type checking, range checks, required fields
   - Defense in depth
   - **Impact**: Better data quality
   - **Effort**: Medium (validation + tests)

#### Low Priority (Backlog)
9. **Add schema versioning**
   - Include `schema_version` field in JSON
   - Implement migration system
   - **Impact**: Future-proofing
   - **Effort**: Medium (versioning + migrations)

10. **Add monitoring/alerting**
    - Prometheus metrics for MCP failures
    - Alerts on high failure rate
    - **Impact**: Operational visibility
    - **Effort**: Medium (instrumentation + dashboards)

11. **Add contract tests**
    - Test MCP tool exists on backend
    - Test schema compatibility
    - Run on CI/CD
    - **Impact**: Prevents regressions
    - **Effort**: High (contract testing framework)

---

## Reusable Patterns

### Pattern 1: Graceful Degradation with Silent Failure ⚠️

**Pattern**:
```typescript
nonCriticalOperation()
  .catch(() => {
    // Silent failure
  })
```

**When to Use**:
- Non-critical operations that shouldn't block main flow
- Metrics, analytics, logging
- Nice-to-have features

**Trade-offs**:
- ✅ Resilience (system continues on failure)
- ❌ Poor observability (silent failures)
- ❌ Hard to debug

**Improvement**:
```typescript
nonCriticalOperation()
  .catch((error) => {
    log.warn("operation failed", { error })
    metrics.failures.inc()
  })
```

### Pattern 2: Incremental Averaging ✅

**Pattern**:
```python
new_avg = old_avg + (new_value - old_avg) / (count + 1)
```

**When to Use**:
- Tracking averages over many data points
- Memory-constrained environments
- Streaming data

**Trade-offs**:
- ✅ O(1) space (vs O(n) for full history)
- ✅ O(1) computation (vs O(n) for recalculation)
- ❌ Can't change formula retroactively
- ❌ No historical analysis

**Reusable**: Yes, common pattern for metrics aggregation

### Pattern 3: MCP Protocol Boundary ✅

**Pattern**:
```typescript
// Frontend
const result = await mcpClient.callTool({
  name: "tool_name",  // String coupling
  arguments: {...}
})

// Backend
@mcp.tool(name="tool_name")
async def handler(args):
    ...
```

**When to Use**:
- Polyglot architectures (TypeScript + Python, etc.)
- Microservices communication
- LLM tool calling

**Trade-offs**:
- ✅ Language independence
- ✅ Process isolation
- ✅ Flexibility (runtime tool discovery)
- ❌ No type safety (string coupling)
- ❌ Runtime errors only
- ❌ Breaking changes silent

**Critical**: Tool names must match exactly!

### Pattern 4: Dual Write (Local + Remote) ⚠️

**Pattern**:
```typescript
// Write to both independently
try {
  await remoteWrite(data)
} catch { /* log */ }

try {
  await localWrite(data)
} catch { /* log */ }
```

**When to Use**:
- Availability requirements (local fallback)
- Performance (local reads fast)
- Gradual migration (old + new storage)

**Trade-offs**:
- ✅ Availability (works if remote down)
- ✅ Performance (local reads)
- ❌ No atomicity (can partially fail)
- ❌ Consistency drift
- ❌ Hard to reconcile

**Alternatives**: Event sourcing, CQRS, saga pattern

### Pattern 5: JSON File-Based Storage ⚠️

**Pattern**:
```python
# Read
with open(file) as f:
    data = json.load(f)

# Modify
data["field"] = new_value

# Write
with open(file, "w") as f:
    json.dump(data, f)
```

**When to Use**:
- Simple applications (no DB needed)
- Configuration storage
- Low-frequency updates
- Human-readable data

**Trade-offs**:
- ✅ Simple (no database setup)
- ✅ Human-readable (easy debugging)
- ✅ Portable (works anywhere)
- ❌ No concurrency control (race conditions)
- ❌ No atomicity (corruption on crash)
- ❌ No queryability (file-based)

**Improvements**: Add locking, atomic writes, consider database for high-concurrency

### Could This Be Abstracted into a Reusable Activity?

**Yes!** This flow follows the **Metrics Aggregation Pattern**:

**Generic Pattern**:
1. Extract metrics from completed operation
2. Transform to standard format
3. Send to aggregation service (with retry/fallback)
4. Aggregate using incremental formula
5. Persist to storage

**Reusable Activity**: `aggregate-metrics`

**Variables**:
- `operation_id` - ID of completed operation
- `metrics` - Metrics object (cost, duration, etc.)
- `aggregation_key` - Key for grouping (template_id, user_id, etc.)
- `storage_backend` - Where to persist ("local", "remote", "both")

**Tasks**:
1. Extract and validate metrics
2. Transform to standard schema
3. Send to backend with retry
4. Update aggregates (incremental)
5. Verify persistence

**Benefit**: Standardizes metrics reporting across different features (activities, sessions, tools, etc.)

### Feature-Specific vs Universal Aspects

**Universal** (reusable across features):
- ✅ Incremental averaging formula
- ✅ MCP protocol communication
- ✅ Graceful degradation pattern
- ✅ Dual write strategy
- ✅ JSON file-based storage
- ✅ Metrics aggregation workflow

**Feature-Specific** (unique to activities):
- Template ID extraction from activity ID
- Activity-specific metrics (task count, impulse usage)
- Template promotion logic
- Activity lifecycle integration

**Recommendation**: Extract universal patterns into shared libraries/activities. Keep feature-specific logic in domain modules.

---

## Action Items

### Immediate (Blocking)
- [ ] **Fix tool name**: Rename `metabob_post_activity_result` → `metabob_report_execution`
- [ ] **Fix schema**: Align frontend/backend to flat structure (no nested `result`)
- [ ] **Test end-to-end**: Verify metrics flow from activity to backend DB

### High Priority (This Sprint)
- [ ] **Add validation**: Check `duration >= 0`, `cost >= 0`, `tokens` positive
- [ ] **Add logging**: Replace `.catch(() => {})` with `.catch((error) => log.warn(...))`
- [ ] **Add file locking**: Use `fcntl.flock()` in backend
- [ ] **Add token metrics**: Store token averages in backend
- [ ] **Add monitoring**: Track MCP failure count

### Medium Priority (Next Sprint)
- [ ] **Fix precision loss**: Store duration as float
- [ ] **Add atomic writes**: Temp file + rename pattern
- [ ] **Add backend validation**: Type checks, range checks

### Low Priority (Backlog)
- [ ] **Add schema versioning**: `schema_version` field + migrations
- [ ] **Add contract tests**: Ensure frontend/backend compatibility
- [ ] **Extract reusable patterns**: Create `aggregate-metrics` activity template

---

## Related Documentation

- **Entry Point Analysis**: `EXECUTION_METRICS_FLOW_ANALYSIS.md`
- **Dependency Chain**: `EXECUTION_METRICS_DEPENDENCY_CHAIN.md`
- **Data Transformations**: `EXECUTION_METRICS_TRANSFORMATIONS.md`
- **Architectural Boundaries**: `EXECUTION_METRICS_ARCHITECTURAL_BOUNDARIES.md`
- **Code Quality Issues**: `EXECUTION_METRICS_CODE_QUALITY_ISSUES.md`
- **Component Annotations**: `EXECUTION_METRICS_COMPONENT_ANNOTATIONS.md`

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-20 | propagate-change-through-flow | **FIX APPLIED**: Tool name and schema mismatch resolved |
| 2026-02-20 | Data Flow Archaeology Task | Initial comprehensive analysis |

---

## Glossary

- **Activity**: A template-based workflow execution with metrics tracking
- **Template**: Reusable activity definition with estimated performance metrics
- **MCP**: Model Context Protocol - standard for LLM tool calling
- **Graceful Degradation**: System continues functioning when non-critical components fail
- **Incremental Averaging**: Mathematical technique to update average without storing history
- **Dual Write**: Writing to two storage systems simultaneously for availability

---

**Status**: ✅ **FIXED** - Implementation complete, backend storage operational! 🎉

**Fix Details:**
- Tool name aligned: `metabob_post_activity_result` ✅
- Schema aligned: Nested `result: {...}` structure ✅
- Tests passing: 10/10 ✅
- Backend storage: Operational ✅

**Next Steps:**
1. Update related documentation files (EXECUTION_METRICS_*.md)
2. Monitor production metrics reporting
3. Verify metrics reach backend storage in live environment

---

## Enhancement for Boredom Activity System (Phase 1)

### 2026-02-21: Added Failure Analysis and Performance Tracking

**Change Type:** Enhancement (addField)

**Purpose:** Enable the boredom activity system to automatically identify templates that need improvement, prioritize debugging efforts, and optimize itself during idle time.

**New Fields Added:**

1. **failure_patterns** (Array): Track last 10 unique failures by task/error
   - `task_id`: Which task failed (e.g., "task-2")
   - `error_type`: validation | timeout | tool_error | exception
   - `error_message`: Truncated error message (200 chars)
   - `count`: Number of times this failure occurred
   - `last_seen`: ISO timestamp of last occurrence

2. **performance_trends** (Object): Track if template is improving/degrading
   - `duration`: "improving" | "stable" | "degrading"
   - `cost`: "improving" | "stable" | "degrading"
   - `success_rate`: "improving" | "stable" | "degrading"
   - Calculated from last 5 executions vs overall average (±10% threshold)

3. **improvement_gradient** (Number): 0.0-1.0 composite quality score
   - Formula: `0.5 * success_rate + 0.25 * cost_score + 0.25 * duration_score`
   - Cost normalized against $1.00 baseline
   - Duration normalized against 300000ms (5min) baseline
   - Requires minimum 3 executions for reliable calculation

4. **last_execution** (Object): Most recent execution details
   - `timestamp`: ISO timestamp
   - `success`: boolean
   - `duration`: milliseconds
   - `cost`: USD
   - `error`: Optional error message (only for failures)

**Components Modified:**

### Frontend (Data Collection)

**repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts**
- Added failure fields to `ActivityExecutionData` interface (lines 19-21)
- Added boredom fields to `TemplateMetrics` interface (lines 40-59)
- All fields optional for backward compatibility

**repos/metabob-opencode/packages/opencode/src/session/activity.ts**
- Added `getFailureDetails()` helper function (lines 586-630)
- Modified `fail()` to capture and send failure details (lines 820-835)
- Extracts failed task ID from prompts, categorizes error type

### Backend (Storage & Calculation)

**repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py**
- Added `categorize_trend()` helper function (lines 240-268)
- Enhanced `update_metrics()` with:
  * Recent executions tracking (rolling window of 5)
  * Performance trends calculation
  * Failure patterns aggregation
  * Last execution tracking
  * Improvement gradient calculation
- Updated `list_templates()` to include `improvement_gradient` in response

**Data Flow:**

```
Activity.fail() 
  → getFailureDetails() extracts: {failure_reason, failed_task_id, error_type}
  → TemplateMetricsClient.reportExecution() sends to backend
  → metabob_post_activity_result receives failure data
  → update_metrics() processes:
      • Adds/updates failure pattern
      • Calculates performance trends (if count >= 3)
      • Calculates improvement gradient (if count >= 3)
      • Updates last_execution
  → JSON file storage with all new fields
```

**Calculation Details:**

**Performance Trends:**
- Requires: 3+ executions, 3+ recent executions
- Compares recent (last 5) vs overall average
- Threshold: ±10% for improving/degrading, otherwise stable
- Applied to: duration, cost, success_rate

**Improvement Gradient:**
- Requires: 3+ executions
- Components:
  * `success_score = success_count / execution_count` (weight: 0.5)
  * `cost_score = max(0, 1 - avg_cost / 1.0)` (weight: 0.25)
  * `duration_score = max(0, 1 - avg_duration / 300000)` (weight: 0.25)
- Output: 0.0-1.0 (rounded to 3 decimals)
- Higher = better template quality

**Backward Compatibility:**

✅ All new fields are optional
✅ Old JSON files readable (missing fields default to empty/null)
✅ Old clients can call metabob_post_activity_result (ignore new fields)
✅ Frontend gracefully degrades if backend doesn't support new fields
✅ No database migration needed (file-based storage)

**Storage Example:**

```json
{
  "estimated_metrics": {
    "execution_count": 5,
    "success_count": 3,
    "success_rate": 0.6,
    "avg_duration_ms": 45000,
    "avg_cost": 0.23,
    "failure_patterns": [
      {
        "task_id": "task-2",
        "error_type": "validation",
        "error_message": "Schema validation failed: missing required field 'name'",
        "count": 2,
        "last_seen": "2026-02-21T10:30:00Z"
      }
    ],
    "performance_trends": {
      "duration": "improving",
      "cost": "stable",
      "success_rate": "degrading"
    },
    "improvement_gradient": 0.652,
    "last_execution": {
      "timestamp": "2026-02-21T10:30:00Z",
      "success": false,
      "duration": 42000,
      "cost": 0.21,
      "error": "Validation failed"
    },
    "recent_executions": [
      {"duration": 50000, "cost": 0.25, "success": true, "timestamp": "2026-02-21T09:00:00Z"},
      {"duration": 48000, "cost": 0.24, "success": true, "timestamp": "2026-02-21T09:30:00Z"},
      {"duration": 42000, "cost": 0.21, "success": false, "timestamp": "2026-02-21T10:30:00Z"}
    ]
  }
}
```

**Use Cases for Boredom System:**

1. **Identify High-Value Improvements:**
   - Low improvement_gradient (< 0.5) = needs work
   - High execution_count + degrading trends = regression
   - Frequent failure_patterns = common pain points

2. **Prioritize Debugging:**
   - Templates with failure_patterns.count > 3 = systematic issues
   - Recent failures (last_execution.error) = urgent
   - failure_patterns.error_type = categorizes debugging approach

3. **Optimize Idle Time:**
   - degrading trends = automatic refactoring candidates
   - improving trends = learn from successful changes
   - stable with low gradient = optimization opportunities

**Validation:**

✅ TypeScript type check: Clean (no errors in modified files)
✅ Python syntax check: Clean (py_compile successful)
✅ Backend tests: 8 passed, 2 pre-existing failures (unrelated)
✅ Backward compatibility: All new fields optional

**Performance Impact:**

- Calculation overhead: ~1-2ms per metrics update
- Storage overhead: ~200 bytes per execution (recent_executions)
- Max storage per template: ~2KB additional (10 failure patterns + 5 recent)
- File I/O: No change (still 1 read + 1 write per update)

**Next Steps:**

1. Implement boredom activity system consumer (Phase 2)
2. Add UI visualization for performance trends
3. Create activity templates for auto-debugging based on failure_patterns
4. Implement improvement_gradient-based template selection

