# Activity Execution Metrics - Code Quality Issues Analysis

## Overview

This document identifies code quality issues in the execution metrics data flow based on manual code review. Metabob's issue cache is currently empty, so this analysis is based on the traced data flow components.

---

## Issues Found: 12

### **High Priority Issues: 5**

---

## HIGH PRIORITY ISSUES

### **Issue 1: Missing Input Validation at MCP Boundary**

**Location**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:93-102`

**Severity**: HIGH

**Description**:
The `reportExecution()` function accepts `ActivityExecutionData` but does not validate the input before sending to MCP backend.

**Code**:
```typescript
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  try {
    // No validation here!
    const result = await callMCPTool<{ success: boolean; error?: string }>(
      "metabob_report_execution",
      {
        activity_id: data.activity_id,
        template_id: data.template_id,
        success: data.success,
        duration: data.duration,
        cost: data.cost,
        tokens: data.tokens,
      },
    )
  }
}
```

**Issues**:
- No validation that `duration >= 0`
- No validation that `cost >= 0`
- No validation that `tokens` values are positive
- Optional `tokens` field could be `undefined` when backend expects object
- No validation of `activity_id` or `template_id` format

**Impact on Data Flow**:
- Negative values can corrupt aggregate averages
- Undefined tokens can cause backend parsing errors
- Invalid IDs can cause backend file lookup failures

**Risk**: **HIGH** - Can corrupt metrics data

**Recommended Fix**:
```typescript
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  // Validate input
  if (data.duration < 0) {
    log.warn("invalid duration (negative)", { duration: data.duration })
    return
  }
  if (data.cost < 0) {
    log.warn("invalid cost (negative)", { cost: data.cost })
    return
  }
  if (data.tokens) {
    if (data.tokens.input < 0 || data.tokens.output < 0 || data.tokens.cache < 0) {
      log.warn("invalid tokens (negative)", { tokens: data.tokens })
      return
    }
  }
  
  // Continue with MCP call
  // ...
}
```

**Blocking Concern**: No (technical debt, but can cause data corruption)

---

### **Issue 2: Schema Mismatch Between Frontend and Backend**

**Location**: 
- Frontend: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:93-102`
- Backend: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:255-292`

**Severity**: HIGH

**Description**:
Frontend sends flat structure, backend expects nested structure with `result` wrapper.

**Frontend Sends**:
```typescript
{
  activity_id: string,
  template_id: string,
  success: boolean,
  duration: number,
  cost: number,
  tokens: object
}
```

**Backend Expects**:
```python
{
  "activity_id": str,
  "result": {
    "success": bool,
    "duration": int,
    "cost": float,
    "tokens": dict
  }
}
```

**Backend Code**:
```python
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,  # Expects nested dict
    ctx: Context = None,
):
    activity_templates.update_metrics(template_id, result)
```

**Impact on Data Flow**:
- Backend receives `activity_id` but cannot find `result` dict
- `result.get("success")` returns `None` (wrong nesting level)
- Metrics update silently fails
- No error propagated to frontend (graceful degradation)

**Risk**: **HIGH** - Complete data loss in backend

**Blocking Concern**: **YES** - Blocks backend metrics storage

**Recommended Fix**: Align schemas (prefer flat structure in backend)

---

### **Issue 3: No Concurrency Control in Backend Storage**

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:254-294`

**Severity**: HIGH

**Description**:
Backend `update_metrics()` reads, modifies, and writes JSON files without file locking.

**Code**:
```python
def update_metrics(template_id: str, result: dict) -> None:
    template_file = storage_path / f"{template_id}.json"
    
    # Read (can race)
    with open(template_file, encoding="utf-8") as f:
        template_data = json.load(f)
    
    # Modify
    template_data["estimated_metrics"] = {...}
    
    # Write (can corrupt if concurrent)
    with open(template_file, "w", encoding="utf-8") as f:
        json.dump(template_data, f, indent=2)
```

**Issues**:
- No file locking mechanism
- Concurrent updates can race (read-modify-write race condition)
- Last write wins (earlier update lost)
- Potential for corrupted JSON (partial write)

**Impact on Data Flow**:
- Metrics can be lost if two activities complete simultaneously
- JSON file can be corrupted if write is interrupted
- No recovery mechanism for corrupted files

**Risk**: **HIGH** - Data loss, corruption possible

**Blocking Concern**: No (low probability, but catastrophic when it happens)

**Recommended Fix**:
```python
import fcntl

def update_metrics(template_id: str, result: dict) -> None:
    template_file = storage_path / f"{template_id}.json"
    
    # Open file with exclusive lock
    with open(template_file, "r+", encoding="utf-8") as f:
        # Acquire exclusive lock
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        
        try:
            # Read
            template_data = json.load(f)
            
            # Modify
            template_data["estimated_metrics"] = {...}
            
            # Write atomically
            f.seek(0)
            f.truncate()
            json.dump(template_data, f, indent=2)
        finally:
            # Lock released automatically on close
            pass
```

---

### **Issue 4: Token Metrics Ignored by Backend**

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:270-288`

**Severity**: HIGH

**Description**:
Backend `update_metrics()` completely ignores token metrics sent by frontend.

**Code**:
```python
def update_metrics(template_id: str, result: dict) -> None:
    # ...
    
    # Update metrics
    template_data["estimated_metrics"] = {
        "execution_count": execution_count,
        "success_count": success_count,
        "success_rate": success_count / execution_count,
        "avg_duration_ms": int(new_avg_duration),
        "avg_cost": new_avg_cost,
        # ❌ NO TOKEN METRICS!
    }
```

**Frontend Sends**:
```typescript
tokens: {
  input: 1000,
  output: 500,
  cache: 200
}
```

**Backend Ignores**: All token data

**Impact on Data Flow**:
- Token usage not tracked in backend
- Cannot analyze token consumption trends
- Cannot correlate token usage with cost
- Frontend tracks tokens, backend doesn't (inconsistent)

**Risk**: **HIGH** - Important metrics lost

**Blocking Concern**: No (metrics are recorded locally in frontend)

**Recommended Fix**:
```python
# Extract token metrics
tokens = result.get("tokens", {})
input_tokens = tokens.get("input", 0)
output_tokens = tokens.get("output", 0)
cache_tokens = tokens.get("cache", 0)

# Update averages (incremental)
total_input_tokens = metrics.get("avg_input_tokens", 0) * (execution_count - 1)
total_output_tokens = metrics.get("avg_output_tokens", 0) * (execution_count - 1)
total_cache_tokens = metrics.get("avg_cache_tokens", 0) * (execution_count - 1)

new_avg_input_tokens = (total_input_tokens + input_tokens) / execution_count
new_avg_output_tokens = (total_output_tokens + output_tokens) / execution_count
new_avg_cache_tokens = (total_cache_tokens + cache_tokens) / execution_count

template_data["estimated_metrics"] = {
    # ... existing fields
    "avg_input_tokens": int(new_avg_input_tokens),
    "avg_output_tokens": int(new_avg_output_tokens),
    "avg_cache_tokens": int(new_avg_cache_tokens),
}
```

---

### **Issue 5: Silent Failure in MCP Call**

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:616-630`

**Severity**: HIGH

**Description**:
MCP call to report execution metrics uses `.catch(() => {})` which silently swallows all errors.

**Code**:
```typescript
TemplateMetricsClient.reportExecution({
  activity_id: activity.id,
  template_id: activity.templateId,
  success: activity.status === "done",
  duration: activity.stats.duration,
  cost: activity.stats.cost.total,
  tokens: {
    input: activity.stats.tokens.input,
    output: activity.stats.tokens.output,
    cache: cacheTokens,
  },
}).catch(() => {
  // Silent failure - metrics reporting is not critical path
})
```

**Issues**:
- All errors are silently swallowed (no logging)
- No way to know if metrics reporting is failing
- No metrics on failure rate
- No alerting on persistent failures
- Cannot debug issues without logs

**Impact on Data Flow**:
- Backend metrics can fail without anyone knowing
- High failure rate goes undetected
- Tool name mismatch goes unnoticed
- Schema errors invisible

**Risk**: **HIGH** - Cannot detect or debug failures

**Blocking Concern**: No (graceful degradation is intentional)

**Recommended Fix**:
```typescript
TemplateMetricsClient.reportExecution({...})
  .catch((error) => {
    // Log the error for debugging
    log.warn("metrics reporting failed", {
      activityId: activity.id,
      templateId: activity.templateId,
      error: error instanceof Error ? error.message : String(error),
    })
    
    // Optionally: Increment failure counter for monitoring
    // metricsReportingFailures.inc()
  })
```

---

## MEDIUM PRIORITY ISSUES

### **Issue 6: Precision Loss in Backend Duration Averaging**

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:286`

**Severity**: MEDIUM

**Description**:
Backend converts average duration to `int`, losing decimal precision.

**Code**:
```python
new_avg_duration = (total_duration + result.get("duration", 0)) / execution_count

template_data["estimated_metrics"] = {
    "avg_duration_ms": int(new_avg_duration),  # ❌ Truncates decimals
}
```

**Issues**:
- Loses sub-millisecond precision
- Cumulative rounding error over many executions
- Inconsistent with frontend (stores as float)

**Impact on Data Flow**:
- Average duration less accurate over time
- Example: True avg = 4567.89ms, stored = 4567ms (0.89ms lost per update)

**Risk**: MEDIUM - Data quality degradation

**Blocking Concern**: No (minor accuracy loss)

**Recommended Fix**:
```python
"avg_duration_ms": new_avg_duration,  # Keep as float
```

---

### **Issue 7: No Template File Existence Check Before Update**

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:250-252`

**Severity**: MEDIUM

**Description**:
Function checks if template file exists and returns early, but doesn't create the file if missing.

**Code**:
```python
if not template_file.exists():
    logger.warning(f"Template not found for metrics update: {template_id}")
    return  # Silently fails
```

**Issues**:
- Template must exist before first metrics update
- New templates can't have metrics until manually created
- No automatic initialization

**Impact on Data Flow**:
- First activity execution for a new template loses metrics
- Metrics only recorded after template file created elsewhere

**Risk**: MEDIUM - First execution metrics lost

**Blocking Concern**: No (template usually created before execution)

**Recommended Fix**:
```python
if not template_file.exists():
    # Initialize template file with default structure
    logger.info(f"Creating new template file: {template_id}")
    template_data = {
        "id": template_id,
        "estimated_metrics": {
            "execution_count": 0,
            "success_count": 0,
            "success_rate": 0.0,
            "avg_duration_ms": 0,
            "avg_cost": 0.0,
        },
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
else:
    # Load existing template
    with open(template_file, encoding="utf-8") as f:
        template_data = json.load(f)
```

---

### **Issue 8: No Validation in Backend update_metrics**

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:239-300`

**Severity**: MEDIUM

**Description**:
Backend `update_metrics()` does not validate input values before updating averages.

**Code**:
```python
def update_metrics(template_id: str, result: dict) -> None:
    # No validation!
    execution_count += 1
    if result.get("success"):
        success_count += 1
    
    total_duration = metrics.get("avg_duration_ms", 0) * (execution_count - 1)
    total_cost = metrics.get("avg_cost", 0.0) * (execution_count - 1)
    
    new_avg_duration = (total_duration + result.get("duration", 0)) / execution_count
    new_avg_cost = (total_cost + result.get("cost", 0.0)) / execution_count
```

**Issues**:
- No check for negative duration
- No check for negative cost
- No check for invalid token values
- `result.get("duration", 0)` defaults to 0 (hides missing data)
- `success` treated as truthy (not validated as boolean)

**Impact on Data Flow**:
- Negative values corrupt averages
- Missing values replaced with 0 (skews averages)
- Invalid input accepted silently

**Risk**: MEDIUM - Data corruption possible

**Blocking Concern**: No (frontend should validate, but defense in depth needed)

**Recommended Fix**:
```python
def update_metrics(template_id: str, result: dict) -> None:
    # Validate input
    duration = result.get("duration")
    cost = result.get("cost")
    success = result.get("success")
    
    if duration is None or duration < 0:
        logger.error(f"Invalid duration: {duration}")
        return
    
    if cost is None or cost < 0:
        logger.error(f"Invalid cost: {cost}")
        return
    
    if not isinstance(success, bool):
        logger.error(f"Invalid success type: {type(success)}")
        return
    
    # Continue with update
    # ...
```

---

### **Issue 9: No Atomic File Write in Backend**

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:293-294`

**Severity**: MEDIUM

**Description**:
Backend writes JSON directly to target file without atomic write pattern (temp + rename).

**Code**:
```python
# Write directly to file (not atomic)
with open(template_file, "w", encoding="utf-8") as f:
    json.dump(template_data, f, indent=2)
```

**Issues**:
- If process crashes during write, file is corrupted
- Partial write leaves invalid JSON
- No backup of previous state
- No way to recover from corruption

**Impact on Data Flow**:
- Crash during write = corrupted template file
- Next read fails with JSON parse error
- Template metrics lost permanently

**Risk**: MEDIUM - Rare but catastrophic

**Blocking Concern**: No (very low probability)

**Recommended Fix**:
```python
import tempfile
import shutil

# Write to temp file first
temp_file = template_file.with_suffix(".tmp")
with open(temp_file, "w", encoding="utf-8") as f:
    json.dump(template_data, f, indent=2)

# Atomic rename (replace old file)
temp_file.replace(template_file)
```

---

### **Issue 10: Dual Write Without Transaction Coordination**

**Location**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:415-439`

**Severity**: MEDIUM

**Description**:
`TemplateLoader.updateMetrics()` writes to both Metabob backend and local storage without transaction coordination.

**Code**:
```typescript
export async function updateMetrics(id: string, metrics: Partial<ActivityTemplate.Schema>): Promise<void> {
  // Update in Metabob TemplateService
  try {
    await TemplateServiceClient.updateTemplateMetrics({...})
    log.info("metrics updated in metabob")
  } catch (error) {
    log.warn("metabob metrics update failed")
  }

  // Update in local storage
  try {
    await ActivityTemplate.update(id, metrics)
    log.info("metrics updated in local")
  } catch (error) {
    log.warn("local metrics update failed")
  }
}
```

**Issues**:
- No atomicity (can partially succeed)
- Backend succeeds, local fails → Inconsistent state
- Local succeeds, backend fails → Diverged metrics
- Both fail → Data loss
- No compensation or rollback
- No consistency check

**Impact on Data Flow**:
- Metrics can drift between backends over time
- Hard to detect inconsistency
- No reconciliation mechanism

**Risk**: MEDIUM - Eventual consistency issue

**Blocking Concern**: No (eventual consistency may be acceptable)

**Recommended Fix**:
- Option 1: Event sourcing (append-only log)
- Option 2: Compensating transactions
- Option 3: Retry queue for failed updates
- Option 4: Accept eventual consistency (current approach)

---

## LOW PRIORITY ISSUES

### **Issue 11: No Schema Versioning in JSON Storage**

**Location**: All JSON storage (frontend and backend)

**Severity**: LOW

**Description**:
JSON files have no `schema_version` field, making schema evolution difficult.

**Current Structure**:
```json
{
  "id": "template-id",
  "estimated_metrics": {...},
  "updated_at": "2024-01-01T00:00:00Z"
  // No schema_version field
}
```

**Issues**:
- Adding required fields breaks old readers
- No way to detect schema version
- Hard to migrate old files
- Breaking changes require manual intervention

**Impact on Data Flow**:
- Currently stable (no schema changes)
- Future schema evolution difficult

**Risk**: LOW - Future maintainability issue

**Blocking Concern**: No

**Recommended Fix**:
```json
{
  "schema_version": "1.0",
  "id": "template-id",
  "estimated_metrics": {...}
}
```

---

### **Issue 12: No Monitoring/Alerting on MCP Failures**

**Location**: All MCP call sites

**Severity**: LOW

**Description**:
No metrics or monitoring for MCP call failures. Silent degradation makes issues hard to detect.

**Issues**:
- High failure rate goes undetected
- No alerting on backend unavailability
- No dashboards for metrics reporting health
- Cannot track failure trends

**Impact on Data Flow**:
- Backend metrics can silently fail for extended periods
- Issue detection relies on manual investigation

**Risk**: LOW - Operational visibility

**Blocking Concern**: No

**Recommended Fix**:
```typescript
// Add metrics tracking
const metricsReportingFailures = new Counter({
  name: "metrics_reporting_failures_total",
  help: "Total number of metrics reporting failures"
})

TemplateMetricsClient.reportExecution({...})
  .catch((error) => {
    metricsReportingFailures.inc()
    log.warn("metrics reporting failed", { error })
  })
```

---

## Summary by Severity

### High Priority (5 issues)
1. ✅ Missing input validation at MCP boundary → Data corruption risk
2. ✅ Schema mismatch (frontend/backend) → Complete data loss
3. ✅ No concurrency control in backend → Race conditions
4. ✅ Token metrics ignored by backend → Metrics lost
5. ✅ Silent failure in MCP call → Cannot debug

### Medium Priority (5 issues)
6. Precision loss in duration averaging → Minor accuracy loss
7. No template file existence check → First execution lost
8. No validation in backend update → Data corruption
9. No atomic file write → Corruption on crash
10. Dual write without transactions → Consistency drift

### Low Priority (2 issues)
11. No schema versioning → Future evolution hard
12. No monitoring/alerting → Poor visibility

---

## Impact on Data Flow

### Blocking Issues (Must Fix)
- **Issue 2: Schema Mismatch** → Backend cannot store metrics at all

### High Impact (Should Fix)
- **Issue 1: No Input Validation** → Can corrupt metrics over time
- **Issue 3: No Concurrency Control** → Race conditions on concurrent updates
- **Issue 4: Token Metrics Ignored** → Important data lost
- **Issue 5: Silent Failures** → Cannot debug problems

### Medium Impact (Nice to Fix)
- **Issue 6-10**: Data quality, consistency, and resilience improvements

### Low Impact (Technical Debt)
- **Issue 11-12**: Future maintainability and operational visibility

---

## Recommended Action Plan

### Phase 1: Fix Blocking Issues (Immediate)
1. ✅ Fix schema mismatch (Issue 2)
   - Rename backend tool: `metabob_post_activity_result` → `metabob_report_execution`
   - Align schemas (flat structure)

### Phase 2: Fix High Impact Issues (This Sprint)
2. Add input validation at MCP boundary (Issue 1)
3. Add file locking in backend (Issue 3)
4. Add token metrics to backend (Issue 4)
5. Add error logging for MCP failures (Issue 5)

### Phase 3: Fix Medium Impact Issues (Next Sprint)
6. Keep duration as float (Issue 6)
7. Add backend input validation (Issue 8)
8. Add atomic file writes (Issue 9)

### Phase 4: Technical Debt (Backlog)
9. Add schema versioning (Issue 11)
10. Add monitoring/alerting (Issue 12)

---

## Related Files to Review

Based on the data flow analysis, these files should be reviewed for related issues:

### High Priority Review
- **`repos/metabob-opencode/packages/opencode/src/session/activity.ts`**
  - Reason: Activity completion handler, metrics extraction
  - Review: Input validation before sending to MCP

- **`repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`**
  - Reason: MCP tool handler, receives frontend data
  - Review: Input validation, error handling

- **`repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`**
  - Reason: Backend metrics update logic
  - Review: Concurrency control, input validation, token metrics

### Medium Priority Review
- **`repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`**
  - Reason: Dual write orchestration
  - Review: Transaction coordination, consistency handling

- **`repos/metabob-opencode/packages/opencode/src/storage/storage.ts`**
  - Reason: Frontend file I/O
  - Review: Error handling, atomic writes (already has locking)

- **`repos/metabob-opencode/packages/opencode/src/mcp/index.ts`**
  - Reason: MCP client implementation
  - Review: Error handling, timeout handling, retry logic

### Low Priority Review
- **`repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`**
  - Reason: Local template storage
  - Review: Schema versioning, migration support

---

## Testing Recommendations

### Unit Tests
- [ ] Test input validation (negative values, missing fields)
- [ ] Test schema serialization/deserialization
- [ ] Test concurrent file updates (race condition)
- [ ] Test atomic file writes (simulated crash)
- [ ] Test dual write failure modes

### Integration Tests
- [ ] Test end-to-end metrics flow (activity → backend DB)
- [ ] Test MCP call with schema validation
- [ ] Test backend unavailable (graceful degradation)
- [ ] Test concurrent activity completions
- [ ] Test token metrics stored correctly

### Property-Based Tests
- [ ] Test incremental averaging (commutativity, associativity)
- [ ] Test metrics never go negative
- [ ] Test success rate stays in [0, 1] range
- [ ] Test JSON roundtrip (serialize → deserialize)

---

## Conclusion

The execution metrics data flow has **12 identified code quality issues**, with:
- **5 HIGH priority issues** (including 1 blocking issue)
- **5 MEDIUM priority issues**
- **2 LOW priority issues**

The most critical issue is the **schema mismatch** between frontend and backend, which completely blocks backend metrics storage. This should be fixed immediately using the `propagate-change-through-flow` activity.

After fixing the schema mismatch, the next priorities are:
1. Input validation at boundaries
2. Concurrency control in backend storage
3. Token metrics persistence
4. Error logging and monitoring

The codebase demonstrates good architectural patterns (graceful degradation, repository pattern, event bus), but lacks defense-in-depth validation and resilience mechanisms at critical boundaries.
