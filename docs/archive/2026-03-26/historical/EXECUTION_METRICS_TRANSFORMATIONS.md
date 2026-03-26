# Activity Execution Metrics - Data Transformations Analysis

## Overview

This document traces every data transformation in the execution metrics flow, documenting what changes, why it changes, validation rules, and side effects.

---

## Transformation 1: Activity State → ActivityExecutionData

**Location**: `activity.ts:610-627` (Activity.complete())

**What**:
```typescript
// Source: Activity.Info object with nested stats
{
  stats: {
    tokens: {
      input: number
      output: number
      reasoning: number
      cache: { read: number, write: number }  // Nested object
    },
    cost: {
      total: number
      perPrompt: Array<{file, cost}>
    },
    duration: number  // milliseconds
  },
  status: "done" | "failed" | ...
}

// Target: ActivityExecutionData (flat structure)
{
  activity_id: string
  template_id: string
  success: boolean
  duration: number
  cost: number
  tokens: {
    input: number
    output: number
    cache: number  // Flattened!
  }
}
```

**Transformations**:
1. **Status → Success**: `activity.status === "done"` → `success: boolean`
   - Business rule: Only "done" status is considered successful
   - "failed", "cancelled", "running" all map to `false`

2. **Cache Token Flattening**: `cache.{read, write}` → single `cache` number
   ```typescript
   const cacheTokens = typeof activity.stats.tokens.cache === "object"
     ? activity.stats.tokens.cache.read + activity.stats.tokens.cache.write
     : activity.stats.tokens.cache || 0
   ```
   - **Why**: Backend expects single cache number, not split read/write
   - **Type guard**: Handles both object and number types (defensive)
   - **Default**: Falls back to 0 if undefined

3. **Cost Extraction**: `cost.total` → `cost: number`
   - Discards `perPrompt` breakdown (only total matters for metrics)

4. **Field Extraction**: 
   - `activity.id` → `activity_id`
   - `activity.templateId` → `template_id`
   - `activity.stats.duration` → `duration`
   - `activity.stats.tokens.input/output` → `tokens.input/output`

**Why**:
- **Backend API contract**: Backend expects flat structure with specific field names
- **Simplification**: Metrics aggregation doesn't need per-prompt cost breakdown
- **Type safety**: Defensive handling of cache tokens prevents runtime errors
- **Naming convention**: Snake_case for API payloads (backend uses Python)

**Validations**:
- ✅ `activity.templateId` must exist (guarded by `if (activity.templateId)`)
- ✅ `activity.stats` must be populated (set during activity creation)
- ⚠️ No validation that `duration > 0` or `cost >= 0`
- ⚠️ Tokens can be 0 (valid for cached responses)

**Side Effects**:
- None (pure data transformation)
- Non-blocking: Wrapped in `.catch()` for graceful degradation

**Alternative Approaches**:
- Could preserve cache read/write split (requires backend schema change)
- Could validate cost/duration bounds before sending
- Could include `reasoning` tokens (currently dropped)

---

## Transformation 2: ActivityExecutionData → MCP Tool Arguments

**Location**: `template-metrics-client.ts:93-102`

**What**:
```typescript
// Input: ActivityExecutionData object
{
  activity_id: string
  template_id: string
  success: boolean
  duration: number
  cost: number
  tokens?: { input, output, cache }
}

// Output: MCP tool arguments (same structure)
{
  activity_id: string
  template_id: string
  success: boolean
  duration: number
  cost: number
  tokens: { input, output, cache }
}
```

**Transformations**:
- **None** (pass-through)
- Object spread: `{ ...data }` creates shallow copy

**Why**:
- **Protocol boundary**: Crossing from TypeScript to MCP protocol
- **Immutability**: Shallow copy prevents accidental mutation
- **Type safety**: TypeScript → `Record<string, unknown>` for MCP

**Validations**:
- ⚠️ No validation at this layer (assumes caller validated)
- ⚠️ Optional `tokens` field could be undefined

**Side Effects**:
- MCP client call (network I/O)
- Logs debug/warn messages
- Returns undefined on failure (graceful degradation)

---

## Transformation 3: MCP Response Parsing

**Location**: `template-metrics-client.ts:46-64`

**What**:
```typescript
// Input: MCP protocol response
{
  content: [
    { type: "text", text: '{"status": "success", ...}' }
  ],
  metadata: {}
}

// Output: Parsed JSON object
{
  success: boolean
  error?: string
}
```

**Transformations**:
1. **Content extraction**: Filter `type: "text"` items
2. **Text joining**: Concatenate multiple text blocks with `\n\n`
3. **JSON parsing**: `JSON.parse(textContent)` → object
4. **Fallback**: Return text as-is if not valid JSON

**Why**:
- **MCP protocol**: Response is always array of content blocks
- **Type safety**: Parse JSON to get typed response
- **Resilience**: Non-JSON responses don't crash (return as string)

**Validations**:
- ✅ Filters only `type: "text"` content
- ✅ Handles empty content array (returns `undefined`)
- ✅ Try-catch on JSON.parse (logs and returns text)

**Side Effects**:
- Logs debug message on parse failure
- Returns `undefined` on any error (graceful degradation)

---

## Transformation 4: ⚠️ MISSING: Frontend → Backend Schema Mismatch

**Expected Backend Schema** (if tool existed):
```python
# What backend expects (based on metabob_post_activity_result)
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

**Actual Frontend Sends**:
```typescript
{
  "activity_id": string,
  "template_id": string,  // ❌ Backend doesn't use this
  "success": boolean,      // ❌ Should be nested in "result"
  "duration": number,      // ❌ Should be nested in "result"
  "cost": number,          // ❌ Should be nested in "result"
  "tokens": object         // ❌ Should be nested in "result"
}
```

**Schema Mismatch**:
- Frontend sends **flat structure**
- Backend expects **nested structure** with `result` wrapper
- Frontend includes `template_id` but backend extracts it from `activity_id`

**Why This Matters**:
- Even if tool name is fixed, schema mismatch will cause errors
- Backend `result.get("success")` will fail (looking in wrong place)

**Fix Required**:
Either:
1. Backend accepts flat structure (recommended)
2. Frontend wraps in `result` object (more changes)

---

## Transformation 5: Backend Template ID Extraction

**Location**: `activity_template_tools.py:267-269`

**What**:
```python
# Input: activity_id string
"add-rest-endpoint-1735678901234"

# Output: template_id string
"add-rest-endpoint"
```

**Transformations**:
```python
template_id = (
    activity_id.rsplit("-", 1)[0] if "-" in activity_id else activity_id
)
```

**Why**:
- **Naming convention**: Activity IDs are `{template_id}-{timestamp}`
- **Reverse lookup**: Extract template from activity ID
- **Fallback**: If no hyphen, use activity_id as-is (defensive)

**Validations**:
- ✅ Checks for hyphen presence
- ⚠️ Assumes last hyphen separates template from timestamp
- ⚠️ Breaks if template name contains timestamp-like suffix

**Side Effects**:
- None (pure string manipulation)

**Alternative Approaches**:
- Frontend could send `template_id` explicitly (it does! but backend ignores it)
- Could use regex to match timestamp pattern: `-\d{13}$`
- Could store activity→template mapping in database

---

## Transformation 6: Backend Metrics Update (Incremental Averaging)

**Location**: `activity_templates.py:259-288`

**What**:
```python
# Input: result dict
{
  "success": bool,
  "duration": int,  # milliseconds
  "cost": float,    # USD
  "tokens": dict
}

# Current metrics (from JSON file)
{
  "execution_count": 10,
  "success_count": 8,
  "avg_duration_ms": 5000,
  "avg_cost": 0.05
}

# Output: Updated metrics
{
  "execution_count": 11,
  "success_count": 9,
  "success_rate": 0.818,
  "avg_duration_ms": 5100,
  "avg_cost": 0.052
}
```

**Transformations**:

1. **Execution Count Increment**:
   ```python
   execution_count = metrics.get("execution_count", 0) + 1
   ```
   - **Why**: Track total executions
   - **Default**: 0 if metric doesn't exist

2. **Success Count Update**:
   ```python
   if result.get("success"):
       success_count += 1
   ```
   - **Why**: Track successful executions
   - **Business rule**: Only increment on success

3. **Average Duration Update** (Incremental):
   ```python
   total_duration = avg_duration_ms * (execution_count - 1)
   new_avg_duration = (total_duration + duration) / execution_count
   ```
   - **Why**: Incremental average avoids storing all values
   - **Formula**: `new_avg = (old_avg * old_count + new_value) / new_count`
   - **Precision**: Integer conversion `int(new_avg_duration)`

4. **Average Cost Update** (Incremental):
   ```python
   total_cost = avg_cost * (execution_count - 1)
   new_avg_cost = (total_cost + cost) / execution_count
   ```
   - **Why**: Same incremental approach
   - **Precision**: Kept as float (no rounding)

5. **Success Rate Calculation**:
   ```python
   success_rate = success_count / execution_count if execution_count > 0 else 0.0
   ```
   - **Why**: Percentage of successful executions
   - **Division by zero guard**: Returns 0.0 if no executions

6. **Timestamp Update**:
   ```python
   template_data["updated_at"] = datetime.now().isoformat()
   ```
   - **Why**: Track last update time
   - **Format**: ISO 8601 string

**Why Incremental Averaging**:
- **Efficiency**: Don't need to store all execution results
- **Memory**: O(1) space instead of O(n)
- **Accuracy**: Mathematically equivalent to full average
- **Overflow prevention**: Avoids `avg * count` for large counts

**Validations**:
- ✅ Checks if template file exists (`template_file.exists()`)
- ✅ Division by zero guard for success rate
- ✅ Defaults to 0 for missing metrics
- ⚠️ No validation of input ranges (duration >= 0, cost >= 0)
- ⚠️ No validation of success boolean type

**Side Effects**:
- **File I/O**: Reads JSON from disk
- **File I/O**: Writes updated JSON to disk
- **Logging**: Info log on success, error log on failure
- **Non-fatal**: Exceptions logged but not raised

**Data Loss Concerns**:
- ⚠️ Token metrics **not saved** (only duration and cost)
- ⚠️ No history (only averages, can't recompute)
- ⚠️ No backup before overwrite

**Alternative Approaches**:
- Could store full execution history (database table)
- Could use exponential moving average (weight recent executions)
- Could store min/max/stddev for better insights
- Could use database transaction for atomicity

---

## Transformation 7: Local Template Metrics Update (Frontend)

**Location**: `activity.ts:932-942`

**What**:
```typescript
// Input: Activity execution result
{
  success: boolean
  totalDuration: number
  totalCost: number
  totalTokens: { input, output, cache }
}

// Current template metrics
{
  executions: 10,
  successRate: 0.8,
  avgDuration: 5000,
  avgCost: 0.05,
  avgTokens: { input: 1000, output: 500, cache: 200 }
}

// Output: Updated metrics (incremental weighted average)
{
  executions: 11,
  successRate: 0.818,
  avgDuration: 5100,
  avgCost: 0.052,
  avgTokens: { input: 1020, output: 510, cache: 205 }
}
```

**Transformations**:

1. **Execution Count Increment**:
   ```typescript
   const newExecutions = template.executions + 1
   ```

2. **Incremental Weighted Average Formula**:
   ```typescript
   newAvg = oldAvg + (newValue - oldAvg) / (count + 1)
   ```
   - **Why**: Avoids overflow from `oldAvg * count`
   - **Mathematical equivalence**: Same as traditional average
   - **Numerical stability**: Better for large execution counts

3. **Success Rate Update**:
   ```typescript
   successRate: template.successRate + 
     ((result.success ? 1 : 0) - template.successRate) / newExecutions
   ```
   - Applies incremental formula to boolean (1 or 0)
   - Result is success percentage (0.0 to 1.0)

4. **Duration Update**:
   ```typescript
   avgDuration: template.avgDuration + 
     (result.totalDuration - template.avgDuration) / newExecutions
   ```

5. **Cost Update**:
   ```typescript
   avgCost: template.avgCost + 
     (result.totalCost - template.avgCost) / newExecutions
   ```

6. **Token Averages** (per type):
   ```typescript
   avgTokens: {
     input: safeAvgTokens.input + 
       (result.totalTokens.input - safeAvgTokens.input) / newExecutions,
     output: safeAvgTokens.output + 
       (result.totalTokens.output - safeAvgTokens.output) / newExecutions,
     cache: safeAvgTokens.cache + 
       (result.totalTokens.cache - safeAvgTokens.cache) / newExecutions,
   }
   ```

**Why Incremental Weighted Average**:
- **Numerical stability**: Avoids overflow for `avg * count`
- **Precision**: Better floating-point accuracy
- **Efficiency**: O(1) computation
- **Comment in code**: `"This avoids overflow from oldAvg * count for large execution counts"`

**Defensive Programming**:
```typescript
const safeAvgTokens = template.avgTokens || { input: 0, output: 0, cache: 0 }
```
- **Why**: Handles legacy templates without `avgTokens` field
- **Default**: Zero tokens if field missing

**Validations**:
- ✅ Defensive fallback for missing `avgTokens`
- ⚠️ No validation of input ranges
- ⚠️ Assumes `newExecutions > 0` (always true since we increment)

**Side Effects**:
- Calls `TemplateRepository.updateMetrics()` (async, non-blocking)
- Updates both local storage and backend (dual write)
- Cache invalidation in TemplateLoader

**Comparison to Backend**:
| Aspect | Frontend (TypeScript) | Backend (Python) |
|--------|----------------------|------------------|
| Formula | Incremental weighted avg | Traditional avg (reconstruct total) |
| Token handling | ✅ Saves token averages | ❌ Ignores tokens |
| Precision | Float (no rounding) | Duration rounded to int |
| Defensive | Handles missing avgTokens | Defaults to 0 |

---

## Transformation 8: Template Loader Dual Write

**Location**: `template-loader.ts:415-439`

**What**:
```typescript
// Input: Partial metrics update
{
  executions: 11,
  successRate: 0.818,
  avgDuration: 5100,
  avgCost: 0.052,
  avgTokens: { input: 1020, output: 510, cache: 205 }
}

// Output: Two parallel writes
1. TemplateServiceClient.updateTemplateMetrics()  // Backend via MCP
2. ActivityTemplate.update()                       // Local storage
```

**Transformations**:
- **None** (pass-through to both backends)
- **Error handling**: Try-catch per backend (independent failure)

**Why Dual Write**:
- **Availability**: Local metrics work even if backend is down
- **Performance**: Local reads are fast (no network)
- **Resilience**: Backend failure doesn't break local functionality
- **Consistency**: Both backends updated for sync

**Validations**:
- ✅ Try-catch per backend (independent error handling)
- ⚠️ No transaction (can partially fail)
- ⚠️ No consistency check between backends

**Side Effects**:
1. **TemplateServiceClient call**: MCP tool `update_activity_metrics`
2. **ActivityTemplate.update**: Writes to local JSON file
3. **Cache invalidation**: `TemplateCache.invalidate(id)`
4. **Logging**: Info log on success, warn log on failure

**Failure Modes**:
- ✅ Backend fails → Local succeeds (graceful degradation)
- ✅ Local fails → Backend succeeds (log warning)
- ❌ Both fail → Silent failure (metrics lost)
- ❌ Partial update → Inconsistent state between backends

**Alternative Approaches**:
- Could use event sourcing (append-only log)
- Could implement compensation (rollback on failure)
- Could queue updates for retry
- Could use distributed transaction (2PC)

---

## Transformation 9: Local Storage Update

**Location**: `activity-template.ts:1347-1368`

**What**:
```typescript
// Input: Partial updates
{
  executions: 11,
  avgCost: 0.052,
  // ... other metrics
}

// Current template (from disk)
{
  id: "add-rest-endpoint",
  version: 123,
  createdAt: 1735678900000,
  updatedAt: 1735678950000,
  executions: 10,
  avgCost: 0.05,
  // ... rest of template
}

// Output: Merged template
{
  id: "add-rest-endpoint",       // Preserved
  version: 123,                  // Preserved
  createdAt: 1735678900000,      // Preserved
  updatedAt: 1735679000000,      // Updated!
  executions: 11,                // Updated
  avgCost: 0.052,                // Updated
  // ... rest merged
}
```

**Transformations**:

1. **Load template**: `await load(id)` from disk

2. **Merge updates**:
   ```typescript
   const updated: Schema = {
     ...template,      // Existing fields
     ...updates,       // New values override
     id: template.id,           // Force preserve
     version: template.version, // Force preserve
     createdAt: template.createdAt, // Force preserve
     updatedAt: Date.now(),     // Force update
   }
   ```

3. **Save to disk**: `await save(updated)`

4. **Auto-register**: `await maybeAutoRegisterWithMetabob()`

**Why**:
- **Immutability**: Creates new object instead of mutating
- **Audit trail**: Preserves id, version, createdAt
- **Timestamp**: Updates updatedAt on every change
- **Integration**: Auto-registers with Metabob on save

**Protected Fields**:
- ✅ `id` cannot be changed (type prevents it)
- ✅ `version` cannot be changed
- ✅ `createdAt` cannot be changed
- ✅ `updatedAt` always set to current time

**Validations**:
- ✅ Type system prevents changing protected fields
- ⚠️ No validation of metric values (can be negative)
- ⚠️ No validation that executions is incrementing

**Side Effects**:
1. **File I/O**: Reads template from disk
2. **File I/O**: Writes updated template to disk
3. **Metabob registration**: Calls `maybeAutoRegisterWithMetabob()`
4. **No locking**: Concurrent updates could race

**Race Condition Risk**:
- ❌ No file locking (two updates at same time)
- ❌ Last write wins (earlier update lost)
- ⚠️ Low probability (activities don't overlap much)

---

## Critical Data Transformation Issues

### Issue 1: Token Metrics Lost in Backend

**Where**: Backend `update_metrics()` function

**What**: Token metrics sent by frontend are **ignored** by backend

**Frontend sends**:
```typescript
tokens: { input: 1000, output: 500, cache: 200 }
```

**Backend does**:
```python
# ... updates execution_count, success_count, avg_duration_ms, avg_cost
# ❌ NEVER uses result.get("tokens")
```

**Impact**:
- Token usage metrics not persisted in backend
- Cannot track token consumption trends
- Cannot correlate token usage with cost

**Fix**: Update backend to save token averages

---

### Issue 2: Schema Mismatch (Flat vs Nested)

**Where**: Frontend → Backend MCP call

**Frontend sends**:
```typescript
{
  activity_id: "...",
  template_id: "...",
  success: true,
  duration: 5000,
  cost: 0.05,
  tokens: {...}
}
```

**Backend expects**:
```python
{
  activity_id: "...",
  result: {
    success: true,
    duration: 5000,
    cost: 0.05,
    tokens: {...}
  }
}
```

**Impact**:
- `result.get("success")` returns `None` (wrong nesting level)
- Metrics update fails silently

**Fix**: Align schemas (prefer flat structure)

---

### Issue 3: Precision Loss in Backend

**Where**: Backend duration averaging

**What**:
```python
new_avg_duration = (total_duration + result.get("duration", 0)) / execution_count
# Then:
"avg_duration_ms": int(new_avg_duration)  # ❌ Truncates decimals
```

**Impact**:
- Duration average truncated to integer
- Loses sub-millisecond precision
- Cumulative rounding error over many executions

**Example**:
- True average: 4567.89 ms
- Stored: 4567 ms
- Error accumulates: 0.89ms lost per update

**Fix**: Store as float, not int

---

### Issue 4: No Atomicity in Dual Write

**Where**: `template-loader.ts:415` (dual write to backend + local)

**What**:
```typescript
// Update Metabob (can fail)
await TemplateServiceClient.updateTemplateMetrics(...)

// Update local (can fail independently)
await ActivityTemplate.update(...)
```

**Impact**:
- Backend succeeds, local fails → Inconsistent state
- Local succeeds, backend fails → Metrics diverge
- Both fail → Silent data loss

**Fix Options**:
1. Event sourcing (append-only log)
2. Compensating transactions
3. Retry queue for failed updates
4. Accept eventual consistency

---

## Summary of All Transformations

| Step | Source | Target | Key Changes | Data Loss | Risk |
|------|--------|--------|-------------|-----------|------|
| 1 | Activity.stats | ActivityExecutionData | Cache flatten, status→success | `reasoning` tokens, cost breakdown | Low |
| 2 | ActivityExecutionData | MCP args | None (pass-through) | None | Low |
| 3 | MCP response | JSON object | Parse text to JSON | None | Low |
| 4 | Frontend | Backend (MISSING) | Schema mismatch | **All data** | **HIGH** |
| 5 | activity_id | template_id | Extract via rsplit | None | Medium |
| 6 | Metrics + result | Updated metrics | Incremental average | **Tokens** | **HIGH** |
| 7 | Result | Template metrics | Incremental weighted avg | None | Low |
| 8 | Metrics | Dual write | None (pass-through) | None | Medium |
| 9 | Updates | Merged template | Object spread + preserve | None | Low |

---

## Recommendations

### High Priority

1. **Fix tool name mismatch**: Rename `metabob_post_activity_result` → `metabob_report_execution`
2. **Fix schema mismatch**: Backend should accept flat structure
3. **Save token metrics**: Backend should store avgTokens like frontend

### Medium Priority

4. **Fix precision loss**: Store duration as float in backend
5. **Add validation**: Check cost >= 0, duration >= 0
6. **Add atomicity**: Implement retry queue for failed dual writes

### Low Priority

7. **Add history**: Store full execution history for trend analysis
8. **Add monitoring**: Alert on backend/local consistency drift
9. **Add locking**: Prevent race conditions in local storage updates

---

## Testing Checklist

- [ ] End-to-end: Activity completion → Backend database updated
- [ ] Token metrics: Verify avgTokens persisted in backend
- [ ] Precision: Verify duration not truncated to integer
- [ ] Failure modes: Backend down → Local still works
- [ ] Failure modes: Local down → Backend still works
- [ ] Race conditions: Concurrent updates don't corrupt data
- [ ] Schema: Backend accepts flat structure from frontend
- [ ] Validation: Negative cost/duration rejected
- [ ] Consistency: Backend and local metrics stay in sync
