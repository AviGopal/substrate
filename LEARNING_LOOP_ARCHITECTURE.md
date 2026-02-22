# Learning Loop Architecture - Complete Mapping

**Status**: OPERATIONAL (SurrealDB running, metrics being collected)
**Date**: 2026-02-21

## Executive Summary

The learning loop is a **file-based metrics system** that tracks activity template performance and suggests improvements during idle time. The current implementation stores all metrics in **JSON files** (`~/.metabob/activities/`), not in SurrealDB. The database is running but not yet integrated into the learning loop.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACTIVITY EXECUTION                            │
│  (metabob-opencode/packages/opencode/src/session/activity.ts)   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. Activity completes/fails
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              METRICS CLIENT (OpenCode)                           │
│  (metabob-opencode/packages/opencode/src/session/               │
│   template-metrics-client.ts)                                    │
│                                                                   │
│  - TemplateMetricsClient.reportExecution()                       │
│  - Calls MCP tool: metabob_post_activity_result                  │
│  - Non-blocking, graceful degradation                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 2. MCP call over stdio
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            MCP TOOLS (metabob-cli Python)                        │
│  (repos/metabob-cli/src/metabob_cli/mcp/                        │
│   activity_template_tools.py)                                    │
│                                                                   │
│  - metabob_post_activity_result(activity_id, result)             │
│  - Extracts template_id from activity_id                         │
│  - Calls activity_templates.update_metrics()                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 3. File lock + atomic update
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              FILE STORAGE (JSON)                                 │
│  (repos/metabob-cli/src/metabob_cli/mcp/                        │
│   activity_templates.py)                                         │
│                                                                   │
│  Location: ~/.metabob/activities/*.json                          │
│  Fields: estimated_metrics {                                     │
│    execution_count, success_count, success_rate,                 │
│    avg_duration_ms, avg_cost,                                    │
│    improvement_gradient?, performance_trends?,                   │
│    failure_patterns?, last_execution?                            │
│  }                                                                │
│                                                                   │
│  ⚠️ NOTE: NOT stored in SurrealDB yet!                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 4. Periodic boredom check (every 30s)
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           BOREDOM MANAGER (OpenCode)                             │
│  (metabob-opencode/packages/opencode/src/session/               │
│   boredom-manager.ts)                                            │
│                                                                   │
│  - Monitors idle time (5+ min threshold)                         │
│  - Calls MCP: metabob_fetch_boredom_activities                   │
│  - Auto-executes highest priority template improvement           │
│  - Cancels if user returns                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 5. Fetch boredom activities
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│          BOREDOM API (metabob-cli Python)                        │
│  (repos/metabob-cli/src/metabob_cli/mcp/                        │
│   activity_template_tools.py + activity_templates.py)           │
│                                                                   │
│  - metabob_fetch_boredom_activities()                            │
│  - Reads all templates from ~/.metabob/activities/               │
│  - Filters by improvement_gradient < threshold                   │
│  - Categorizes: improve-template, debug-failures,                │
│                 optimize-performance                             │
│  - Calculates priority score (0.0-1.5)                           │
│  - Returns top N activities                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 6. Execute improvement activity
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              ACTIVITY EXECUTION                                  │
│  (Loop back to top - creates new metrics)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Metrics Collection (OpenCode)

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Integration Points**:
- `Activity.complete()` at line 813-861 (success case)
- `Activity.fail()` at line 813-861 (failure case)

**Data Collected**:
```typescript
{
  activity_id: string
  template_id: string
  success: boolean
  duration: number  // milliseconds
  cost: number      // USD
  tokens: {
    input: number
    output: number
    cache: number
  }
  // Failure details (only on failure)
  failure_reason?: string
  failed_task_id?: string
  error_type?: 'validation' | 'timeout' | 'tool_error' | 'exception'
}
```

**Reporting Method**:
```typescript
TemplateMetricsClient.reportExecution({...})
  .catch(() => {}) // Silent failure - non-critical
```

### 2. Metrics Client (OpenCode → Python MCP)

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Key Functions**:
- `reportExecution(data)` - Report activity execution
- `getTemplateMetrics(templateId)` - Query metrics (unused currently)
- `getRecommendation(templateId)` - Get promotion recommendation (unused)
- `promoteTemplate(request)` - Promote candidate template (unused)

**Architecture**:
- Calls MCP tools via `MCP.callTool()`
- Graceful degradation if MCP unavailable
- Non-blocking (logs failures, doesn't throw)

### 3. MCP Tools (Python Backend)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Available Tools**:

#### `metabob_post_activity_result`
- **Input**: `activity_id`, `result` (success, duration, cost, tokens)
- **Processing**:
  1. Extract `template_id` from `activity_id` (splits on last `-`)
  2. Call `activity_templates.update_metrics(template_id, result)`
  3. Return success/error status
- **Line**: 242-292

#### `metabob_fetch_boredom_activities`
- **Input**: `max_activities`, `priority_threshold`, `types`, `exclude_recent_hours`
- **Processing**:
  1. List all templates from `~/.metabob/activities/`
  2. Filter by `improvement_gradient` < threshold
  3. Categorize each template
  4. Calculate priority scores
  5. Sort by priority (highest first)
  6. Return top N activities
- **Line**: 296-350

#### Other Tools (for completeness)
- `metabob_search_activities` - Search templates
- `metabob_get_activity_template` - Get template by ID
- `metabob_register_activity_template` - Register new template
- `metabob_list_activity_templates` - List all templates

### 4. Storage Layer (JSON Files)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`

**Location**: `~/.metabob/activities/*.json`

**Current Templates** (as of 2026-02-21):
```
debug-template-failures.json
diagnose-startup-issues.json
git-revision-management.json
good-quality-template.json
high-failures-template.json
improve-error-handling.json
mediocre-template.json
multi-agent-acp-workflow.json
optimize-query-performance.json
test-boredom-system-docker.json
test-low-quality-template.json
```

**Metrics Schema** (in `estimated_metrics` field):
```json
{
  "execution_count": 0,
  "success_count": 0,
  "success_rate": 0.0,
  "avg_duration_ms": 0,
  "avg_cost": 0.0,
  "improvement_gradient": 0.5,
  "performance_trends": {
    "duration": "improving" | "stable" | "degrading",
    "cost": "improving" | "stable" | "degrading",
    "success_rate": "improving" | "stable" | "degrading"
  },
  "failure_patterns": [
    {
      "task_id": "string",
      "error_type": "string",
      "error_message": "string",
      "count": 0,
      "last_seen": "ISO timestamp"
    }
  ],
  "last_execution": {
    "timestamp": "ISO timestamp",
    "success": true,
    "duration": 0,
    "cost": 0.0,
    "error": "string"
  }
}
```

**Update Algorithm** (line 265-368):
1. **File Locking**: Uses `fcntl.flock()` for concurrent access safety
2. **Read**: Load current template JSON
3. **Update Counts**: Increment `execution_count`, update `success_count`
4. **Recalculate Averages**: Running averages for duration and cost
5. **Write**: Atomic write-back with `f.seek(0)` + `f.truncate()`
6. **Unlock**: Release lock

### 5. Boredom System (Idle Detection)

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`

**Configuration**:
```typescript
IDLE_THRESHOLD_MS = 5 * 60 * 1000  // 5 minutes
CHECK_INTERVAL_MS = 30 * 1000      // Check every 30 seconds
```

**Lifecycle**:
- **Start**: `Session.Event.Created` → `BoredomManager.startMonitoring(sessionID)`
- **Track Activity**: User messages/commands → `BoredomManager.trackActivity(sessionID)`
- **Stop**: `Session.Event.Closed` → `BoredomManager.stopMonitoring(sessionID)`

**Idle Check Logic** (line 104-145):
1. Skip if already executing boredom activity
2. Check if idle (5+ min since last activity)
3. Fetch boredom activities from backend
4. Execute highest priority activity
5. Monitor for user return (cancel if detected)

**Current Status**: 🚧 Partially implemented
- Idle detection: ✅ Working
- Boredom API call: ✅ Working
- Activity execution: ⚠️ Placeholder (line 181-200)

### 6. Boredom Activity Logic (Python)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`

#### Filtering (line 375-424)
```python
def _filter_candidates(templates, priority_threshold, exclude_recent_hours):
    # Must have improvement_gradient calculated
    # gradient < priority_threshold (lower = needs improvement)
    # Exclude templates updated within N hours
    # Return sorted by gradient ascending (worst first)
```

#### Categorization (line 427-470)
```python
def _categorize_activity(template):
    # improve-template: Low success rate (<70%) + low gradient
    # debug-failures: Increasing failure patterns (recent > historical)
    # optimize-performance: Duration/cost degrading
```

#### Priority Calculation (line 473-508)
```python
def _calculate_priority(improvement_gradient, activity_type):
    # Base: 1.0 - gradient (inverse)
    # Multipliers:
    #   debug-failures: 1.5x (highest)
    #   optimize-performance: 1.2x
    #   improve-template: 1.0x
    # Range: 0.0 - 1.5
```

#### Main API (line 555-660)
```python
def metabob_fetch_boredom_activities(
    max_activities=5,
    priority_threshold=0.5,
    types=None,
    exclude_recent_hours=24
):
    # 1. Get all templates
    # 2. Filter candidates
    # 3. Categorize + calculate priority
    # 4. Sort by priority (highest first)
    # 5. Return top N
```

## Data Flow Example

### Scenario: Activity Executes and Fails

**Step 1: Activity Fails**
```
repos/metabob-opencode/packages/opencode/src/session/activity.ts:813
→ Activity.fail("act_abc123")
→ Extract: template_id = "test-feature"
→ Calculate: duration=45000ms, cost=$0.15, tokens={in:5000,out:2000,cache:3000}
→ Extract failure: failed_task_id="task-3", error_type="validation"
```

**Step 2: Report to Backend**
```
repos/metabob-opencode/packages/opencode/src/session/activity.ts:839
→ TemplateMetricsClient.reportExecution({
    activity_id: "act_abc123",
    template_id: "test-feature",
    success: false,
    duration: 45000,
    cost: 0.15,
    tokens: { input: 5000, output: 2000, cache: 3000 },
    failed_task_id: "task-3",
    error_type: "validation"
  })
```

**Step 3: MCP Call**
```
repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:96
→ MCP.callTool("metabob_post_activity_result", {
    activity_id: "act_abc123",
    result: { success: false, duration: 45000, cost: 0.15, tokens: {...} }
  })
```

**Step 4: Python MCP Tool**
```
repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:255
→ metabob_post_activity_result(activity_id="act_abc123", result={...})
→ Extract template_id: "test-feature" (split on last "-")
→ Call: activity_templates.update_metrics("test-feature", result)
```

**Step 5: File Update**
```
repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:265
→ Open: ~/.metabob/activities/test-feature.json
→ Lock file (fcntl.flock)
→ Read current metrics: {execution_count: 5, success_count: 3, ...}
→ Update: execution_count=6, success_count=3 (no change)
→ Recalculate averages:
    avg_duration = (old_avg * 5 + 45000) / 6
    avg_cost = (old_avg * 5 + 0.15) / 6
    success_rate = 3/6 = 0.5
→ Write back, unlock
```

**Step 6: Boredom Check (5 min later)**
```
repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:104
→ checkIdleAndExecute()
→ Idle for 5+ min? Yes
→ Call: MCP.callTool("metabob_fetch_boredom_activities", {...})
```

**Step 7: Boredom API**
```
repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:555
→ metabob_fetch_boredom_activities(max=5, threshold=0.5, exclude=24h)
→ List all templates from ~/.metabob/activities/
→ Filter: improvement_gradient < 0.5
→ Found: "test-feature" with gradient=0.3
→ Categorize: "improve-template" (success_rate=0.5 < 0.7)
→ Priority: (1.0 - 0.3) * 1.0 = 0.7
→ Return: [{
    activity_type: "improve-template",
    priority: 0.7,
    template_id: "test-feature",
    improvement_gradient: 0.3,
    reason: "Low success rate (50%) suggests template needs refinement",
    estimated_effort: "5-15 min",
    metrics: { /* full template */ }
  }]
```

**Step 8: Execute Improvement Activity**
```
repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:181
→ executeBoredomActivity(manager, boredomActivity)
→ ⚠️ PLACEHOLDER: Just logs, doesn't actually execute yet
→ TODO: Load template, create Activity, execute with "boredom" flag
```

## Configuration

### OpenCode Configuration

**File**: `opencode.json` (if exists)
- No learning/metrics config found in current repo

### Environment Variables

**File**: `.env.devbob`
```bash
SURREAL_PORT=8000
SURREALIST_PORT=8081
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NAMESPACE=metabob
SURREAL_DATABASE=devbob
SURREAL_LOG_LEVEL=info
```

**Database Status**: ✅ Running
```bash
CONTAINER ID   IMAGE                         STATUS
b7a00786a827   surrealdb/surrealdb:latest    Up 2 days (healthy)
e3ced023430f   surrealdb/surrealist:latest   Up 2 days
```

## Missing Pieces

### 1. Database Integration
**Status**: ❌ Not implemented
**Current**: All metrics stored in JSON files
**Expected**: SurrealDB tables for:
- `activity_executions` - Raw execution records
- `template_metrics` - Aggregated metrics
- `boredom_queue` - Prioritized improvement tasks

### 2. Boredom Activity Execution
**Status**: ⚠️ Placeholder
**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:181-200`
**TODO**:
1. Load template from TemplateRepository
2. Create Activity instance
3. Execute with special "boredom" flag
4. Monitor for user return (cancel if detected)
5. Report results back to metrics system

### 3. Advanced Metrics Fields
**Status**: ⚠️ Partially implemented
**Current**: Basic fields (execution_count, success_rate, avg_cost, avg_duration)
**Missing**:
- `improvement_gradient` - Not calculated automatically
- `performance_trends` - Not tracked over time
- `failure_patterns` - Not aggregated from failure_reason field
- `last_execution` - Not updated on each run

### 4. Lifecycle Hooks Integration
**Status**: ❓ Unknown
**Expected Integration Points**:
- `Session.Event.Created` → Start boredom monitoring
- `SessionPrompt.createUserMessage()` → Track activity
- `Session.command()` → Track activity
- `Session.Event.Closed` → Stop boredom monitoring

**TODO**: Verify these hooks are actually called

## Validation Checklist

### ✅ Confirmed Working
- [x] SurrealDB containers running
- [x] JSON file storage at `~/.metabob/activities/`
- [x] Metrics reporting from Activity.complete/fail
- [x] MCP tools registered and callable
- [x] File locking for concurrent updates
- [x] Boredom API returns prioritized activities
- [x] Idle detection logic

### ❌ Not Working / Incomplete
- [ ] SurrealDB integration (not connected)
- [ ] Boredom activity auto-execution (placeholder)
- [ ] Advanced metrics calculation (improvement_gradient, etc.)
- [ ] Performance trend tracking
- [ ] Failure pattern aggregation
- [ ] Lifecycle hook integration verification

### ❓ Unknown / Needs Testing
- [ ] Boredom monitoring actually starts on session creation
- [ ] Activity tracking actually fires on user messages
- [ ] MCP call actually succeeds (need live test)
- [ ] File locking works across processes
- [ ] Metrics averages calculated correctly

## Next Steps

### 1. Validate End-to-End Flow
```bash
# Terminal 1: Start OpenCode session
opencode

# Terminal 2: Watch metrics file
watch -n 1 "cat ~/.metabob/activities/test-feature.json | jq .estimated_metrics"

# Terminal 3: Execute test activity
opencode activity execute --template test-feature

# Verify: Metrics updated after completion
```

### 2. Test Boredom System
```bash
# Start session and wait 5+ minutes idle
opencode

# Check logs for boredom activity execution
tail -f ~/.opencode/logs/session-*.log | grep BOREDOM
```

### 3. Implement Missing Features
1. Complete `executeBoredomActivity()` in boredom-manager.ts
2. Calculate `improvement_gradient` in update_metrics()
3. Track `performance_trends` over time
4. Aggregate `failure_patterns` from failure_reason

### 4. Database Migration
1. Design SurrealDB schema for metrics
2. Implement dual-write (JSON + SurrealDB)
3. Verify data consistency
4. Switch to DB-only reads
5. Deprecate JSON storage

## Summary

The learning loop architecture is **functional but incomplete**:

**Working**:
- ✅ Metrics collection from activity execution
- ✅ File-based storage with concurrent access safety
- ✅ Boredom API for prioritized suggestions
- ✅ Idle detection and monitoring

**Missing**:
- ❌ SurrealDB integration
- ❌ Automatic boredom activity execution
- ❌ Advanced metrics calculation
- ❌ Lifecycle hook verification

**Database Reality**:
- SurrealDB is **running** but **not connected** to learning loop
- All metrics stored in **JSON files** only
- Migration path needed for production use

**Recommendation**: Focus on completing boredom activity execution and verifying end-to-end flow before database migration.
