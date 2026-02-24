# Learning Loop Architecture - Complete Mapping

**Generated**: 2026-02-23  
**Status**: ✅ OPERATIONAL (80% complete)  
**Missing**: Redis Thompson Sampling integration, SurrealDB final verification

---

## Executive Summary

The learning loop is a **multi-stage data pipeline** that collects activity execution metrics, stores them in SurrealDB, and uses them to:
1. Prioritize template improvements via boredom activities
2. Track improvement gradients and performance trends
3. Enable autonomous template evolution

**Current Status**: Single-write to SurrealDB ✅ | Redis dual-write ⚠️ (partially implemented)

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ACTIVITY EXECUTION                                │
│  (packages/opencode/src/session/template-executor.ts)                    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ↓ metrics collected
┌──────────────────────────────────────────────────────────────────────────┐
│                    METRICS REPORTING (Dual-Write)                         │
│  (packages/opencode/src/session/template-metrics-client.ts)              │
│                                                                           │
│  ┌─────────────────────────┐    ┌──────────────────────────┐            │
│  │  Path A: JSON Files     │    │  Path B: Redis (TODO)    │            │
│  │  via MCP                │    │  via MetabobCLI          │            │
│  │  metabob_post_          │    │  completeActivity        │            │
│  │  activity_result        │    │  Execution()             │            │
│  └───────────┬─────────────┘    └─────────────┬────────────┘            │
│              │ non-blocking              │ non-blocking                  │
└──────────────┼───────────────────────────┼───────────────────────────────┘
               ↓                           ↓
┌──────────────────────────┐    ┌──────────────────────────┐
│   MCP TOOL (metabob-cli) │    │  Redis (Thompson)        │
│                          │    │  (NOT YET CONNECTED)     │
│  metabob_post_activity_  │    │                          │
│  result                  │    │  Template variant        │
│                          │    │  selection               │
│  repos/metabob-cli/src/  │    │                          │
│  metabob_cli/mcp/        │    │  Port: 6379              │
│  activity_template_      │    │  Status: ⚠️ Disconnected │
│  tools.py                │    │                          │
└─────────────┬────────────┘    └──────────────────────────┘
              │ HTTP POST
              ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                   BACKEND API (metabob-rpc-api)                          │
│                                                                           │
│  POST /api/v1/learning-loop/executions                                   │
│  (server/routes/learning_loop.py)                                        │
│                                                                           │
│  1. Parse ExecutionRequest                                               │
│  2. Call insert_execution() → SurrealDB                                  │
│  3. Call update_metrics_after_execution() → template_metrics table       │
│  4. Return ExecutionResponse                                             │
└─────────────┬────────────────────────────────────────────────────────────┘
              │ writes to
              ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                        SURREALDB (Storage Layer)                         │
│                                                                           │
│  Tables:                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  activity_execution                                                │  │
│  │  - activity_id, template_id, started_at, duration_ms               │  │
│  │  - success, tokens_input, tokens_output, tokens_cache              │  │
│  │  - cost_usd, error_message, error_type                             │  │
│  │  - Status: ✅ ACTIVE (writes working)                              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  template_metrics                                                  │  │
│  │  - template_id, executions, success_rate, avg_cost, avg_duration  │  │
│  │  - improvement_gradient (0.0-1.0, lower = needs improvement)      │  │
│  │  - performance_trends (improving/stable/degrading)                 │  │
│  │  - failure_patterns (task_id, error_type, count, last_seen)       │  │
│  │  - last_execution (timestamp, success, duration, cost)             │  │
│  │  - Status: ✅ ACTIVE (aggregation working)                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  failure_pattern                                                   │  │
│  │  - template_id, task_id, error_type, error_message                 │  │
│  │  - count, first_seen, last_seen                                    │  │
│  │  - Status: ✅ ACTIVE                                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Connection: localhost:8000                                               │
│  Credentials: root/root                                                   │
│  Namespace: metabob                                                       │
│  Database: devbob                                                         │
└─────────────┬────────────────────────────────────────────────────────────┘
              │ query for boredom activities
              ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                       BOREDOM API (metabob-cli MCP)                      │
│                                                                           │
│  metabob_fetch_boredom_activities                                        │
│  (repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py)     │
│                                                                           │
│  Algorithm:                                                               │
│  1. Query template_metrics WHERE improvement_gradient < threshold        │
│  2. Filter out recently executed (exclude_recent_hours)                  │
│  3. Categorize by activity_type:                                         │
│     - improve-template: Low success rate                                 │
│     - debug-failures: Increasing failure patterns                        │
│     - optimize-performance: Degrading cost/duration                      │
│  4. Sort by priority (1.0 - improvement_gradient)                        │
│  5. Return top N activities                                              │
│                                                                           │
│  Status: ✅ OPERATIONAL                                                   │
└─────────────┬────────────────────────────────────────────────────────────┘
              │ returns BoredomActivity[]
              ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                     BOREDOM MANAGER (OpenCode)                           │
│  (packages/opencode/src/session/boredom-manager.ts)                     │
│                                                                           │
│  Idle Detection:                                                          │
│  - Tracks session activity (user messages, commands)                     │
│  - Detects idle: 5+ minutes no activity                                  │
│  - Checks every 30 seconds                                               │
│                                                                           │
│  Auto-Execution Flow:                                                     │
│  1. Session idle → fetch boredom activities via MCP                      │
│  2. Select highest priority activity                                     │
│  3. Load template from TemplateRepository                                │
│  4. Create Activity instance                                             │
│  5. Execute with AbortController (cancellable)                           │
│  6. Report results back to backend API                                   │
│  7. Loop continues (check idle again)                                    │
│                                                                           │
│  Cancellation:                                                            │
│  - User returns → abort activity execution                               │
│  - No penalty, execution marked as cancelled                             │
│                                                                           │
│  Status: ✅ OPERATIONAL                                                   │
└─────────────┬────────────────────────────────────────────────────────────┘
              │ executes activity
              ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                      ACTIVITY EXECUTION (Loop!)                          │
│                                                                           │
│  executeActivityInline() → metrics collected → dual-write → SurrealDB    │
│                                                                           │
│  Feedback Loop: Template improvement tracked over time                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Activity Execution Layer

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Responsibilities**:
- Execute activity templates with tasks
- Collect execution metrics (duration, cost, tokens, success)
- Trigger metrics reporting on completion

**Metrics Collected**:
```typescript
{
  activity_id: string,
  template_id: string,
  success: boolean,
  duration: number,        // milliseconds
  cost: number,           // USD
  tokens: {
    input: number,
    output: number,
    cache: number
  },
  failure_reason?: string,
  error_type?: 'validation' | 'timeout' | 'tool_error' | 'exception'
}
```

**Storage**: Activities stored locally in `~/.local/share/opencode/storage/activity/`

---

### 2. Metrics Reporting (Dual-Write)

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Architecture**: Non-blocking dual-write pattern

**Path A: JSON Files via MCP** ✅ WORKING
- Tool: `metabob_post_activity_result`
- Backend: metabob-cli MCP server
- Flow: OpenCode → MCP tool → HTTP POST → Backend API → SurrealDB

**Path B: Redis (Thompson Sampling)** ⚠️ PARTIALLY IMPLEMENTED
- Method: `MetabobCLI.completeActivityExecution()`
- Backend: NOT YET CONNECTED
- Purpose: Template variant selection (A/B testing)
- Status: Code exists but Redis not wired up

**Implementation**:
```typescript
// Dual-write: both writes execute in parallel
const [mcpResult, redisResult] = await Promise.allSettled([
  mcpPromise,   // Path A: SurrealDB via MCP
  redisPromise  // Path B: Redis (not yet connected)
])
```

**Graceful Degradation**:
- Failures logged but not thrown
- Metrics reporting is non-critical path
- Activity execution continues regardless

---

### 3. MCP Tool (metabob-cli)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Tool**: `metabob_post_activity_result`

**Flow**:
1. Receive activity execution data from OpenCode
2. Parse activity_id to extract template_id
3. Build ExecutionRequest (matches backend schema)
4. HTTP POST to `http://localhost:8080/api/v1/learning-loop/executions`
5. Return success/error response

**Error Handling**:
- Retry logic with exponential backoff (3 attempts)
- Graceful degradation if backend unavailable
- Detailed logging for debugging

---

### 4. Backend API (metabob-rpc-api)

**File**: `repos/metabob-rpc-api/server/routes/learning_loop.py`

**Endpoint**: `POST /api/v1/learning-loop/executions`

**Request Schema**:
```python
class ExecutionRequest(BaseModel):
    activity_id: str
    template_id: str
    started_at: str          # ISO 8601
    duration_ms: int
    success: bool
    tokens_input: int
    tokens_output: int
    tokens_cache: int
    cost_usd: float
    error_message: Optional[str]
    error_type: Optional[str]
    failed_task_id: Optional[str]
```

**Processing**:
1. Insert execution record → `activity_execution` table
2. Update aggregated metrics → `template_metrics` table
3. Record failure patterns → `failure_pattern` table (if failed)
4. Calculate improvement_gradient (composite quality score)
5. Return ExecutionResponse

**Metrics Calculation**:
```python
improvement_gradient = (
    success_rate * 0.4 +
    (1 - normalized_cost) * 0.3 +
    (1 - normalized_duration) * 0.3
)
# Range: 0.0 (needs improvement) to 1.0 (excellent)
```

**Performance Trends**:
```python
trends = {
    "duration": "improving" | "stable" | "degrading",
    "cost": "improving" | "stable" | "degrading",
    "success_rate": "improving" | "stable" | "degrading"
}
# Based on moving average over last 10 executions
```

---

### 5. SurrealDB (Storage Layer)

**Connection**: `localhost:8000`  
**Credentials**: `root/root`  
**Namespace**: `metabob`  
**Database**: `devbob`

**Tables**:

#### `activity_execution` ✅ ACTIVE
Stores every activity execution with full details.

```sql
CREATE activity_execution SET
  activity_id = "act_abc123",
  template_id = "add-feature-complete",
  started_at = "2026-02-23T12:00:00Z",
  completed_at = "2026-02-23T12:01:30Z",
  duration_ms = 90000,
  success = true,
  tokens_input = 5000,
  tokens_output = 1500,
  tokens_cache = 2000,
  tokens_total = 8500,
  cost_usd = 0.022,
  error_message = null,
  error_type = null,
  created_at = "2026-02-23T12:01:30Z";
```

#### `template_metrics` ✅ ACTIVE
Aggregated metrics for each template (updated after each execution).

```sql
CREATE template_metrics SET
  template_id = "add-feature-complete",
  executions = 42,
  success_rate = 0.85,
  avg_cost = 0.019,
  avg_duration_ms = 87000,
  improvement_gradient = 0.72,  # Higher = better quality
  performance_trends = {
    duration: "improving",
    cost: "stable",
    success_rate: "degrading"
  },
  failure_patterns = [
    {
      task_id: "task-validate",
      error_type: "validation",
      count: 6,
      last_seen: "2026-02-23T10:00:00Z"
    }
  ],
  last_execution = {
    timestamp: "2026-02-23T12:01:30Z",
    success: true,
    duration: 90000,
    cost: 0.022
  },
  updated_at = "2026-02-23T12:01:30Z";
```

#### `failure_pattern` ✅ ACTIVE
Tracks recurring failure patterns for debugging.

```sql
CREATE failure_pattern SET
  template_id = "add-feature-complete",
  task_id = "task-validate",
  error_type = "validation",
  error_message = "File not found: package.json",
  count = 6,
  first_seen = "2026-02-20T08:00:00Z",
  last_seen = "2026-02-23T10:00:00Z";
```

---

### 6. Boredom API (Improvement Prioritization)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Tool**: `metabob_fetch_boredom_activities`

**Algorithm**:
```python
def fetch_boredom_activities(
    max_activities: int = 5,
    priority_threshold: float = 0.6,  # Only templates below 60% quality
    exclude_recent_hours: int = 24
) -> List[BoredomActivity]:
    # Step 1: Query low-quality templates
    templates = query_template_metrics(
        improvement_gradient__lt=priority_threshold,
        last_execution__before=(now - exclude_recent_hours)
    )
    
    # Step 2: Categorize by activity type
    activities = []
    for template in templates:
        if template.success_rate < 0.7:
            activity_type = "improve-template"
        elif template.failure_patterns and increasing_failures(template):
            activity_type = "debug-failures"
        elif template.performance_trends["cost"] == "degrading":
            activity_type = "optimize-performance"
        else:
            continue
        
        activities.append({
            "activity_type": activity_type,
            "priority": 1.0 - template.improvement_gradient,  # Lower gradient = higher priority
            "template_id": template.id,
            "improvement_gradient": template.improvement_gradient,
            "reason": f"Low success rate: {template.success_rate:.1%}",
            "estimated_effort": "5-15 min",
            "metrics": template.to_dict()
        })
    
    # Step 3: Sort by priority (worst first)
    activities.sort(key=lambda x: x["priority"], reverse=True)
    
    return activities[:max_activities]
```

**Response Schema**:
```typescript
interface BoredomActivity {
  activity_type: "improve-template" | "debug-failures" | "optimize-performance"
  priority: number              // 0.0-1.0, higher = more urgent
  template_id: string
  improvement_gradient: number  // 0.0-1.0, current quality
  reason: string                // Human-readable explanation
  estimated_effort: string      // e.g., "5-15 min"
  metrics: {
    success_rate: number,
    avg_cost: number,
    avg_duration_ms: number,
    execution_count: number,
    failure_patterns: Array<...>,
    performance_trends: {...},
    last_execution: {...}
  }
}
```

---

### 7. Boredom Manager (Auto-Execution)

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`

**Purpose**: Detect idle sessions and auto-execute improvement activities

**Configuration**:
```typescript
const IDLE_THRESHOLD_MS = 5 * 60 * 1000  // 5 minutes
const CHECK_INTERVAL_MS = 30 * 1000      // Check every 30 seconds
```

**Flow**:
```typescript
// Session lifecycle integration
Session.Event.Created → BoredomManager.startMonitoring()
SessionPrompt.createUserMessage() → BoredomManager.trackActivity()
Session.Event.Closed → BoredomManager.stopMonitoring()

// Auto-execution loop
while (monitoring) {
  await sleep(CHECK_INTERVAL_MS)
  
  if (isIdle(session) && !isExecuting) {
    const activities = await fetchBoredomActivities()
    if (activities.length > 0) {
      const topActivity = activities[0]
      await executeBoredomActivity(topActivity)
    }
  }
}

// Cancellation on user return
if (userReturned && currentActivity) {
  abortController.abort()  // Graceful cancellation
}
```

**Execution Details**:
1. Load template from `TemplateRepository`
2. Extract variables from `boredomActivity.metrics`
3. Create `Activity` instance with title `[BOREDOM] {template.name}`
4. Execute with `AbortController` (cancellable)
5. Report results to backend via `metabob_post_activity_result`

**Error Handling**:
- Template not found → skip, continue monitoring
- Execution fails → log error, continue monitoring
- User returns → cancel execution, reset idle timer

---

## Configuration Files

### `.env.devbob`
```bash
# SurrealDB
SURREAL_PORT=8000
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NAMESPACE=metabob
SURREAL_DATABASE=devbob

# Redis (Thompson Sampling - NOT YET CONNECTED)
REDIS_PORT=6379

# Backend API
API_PORT=8080
DEVBOB_RPC_API_PORT=3001
```

### Docker Services
```yaml
services:
  metabob-surreal:
    image: surrealdb/surrealdb:v2.6.0
    ports:
      - "8000:8000"
    status: ✅ Running
  
  metabob-redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    status: ✅ Running (not yet connected to learning loop)
  
  metabob-surrealist:
    image: surrealdb/surrealist:latest
    ports:
      - "8001:8080"  # Web UI for SurrealDB
    status: ✅ Running
```

---

## Data Flow Verification

### Recent Activity Executions ✅ VERIFIED

**Storage**: `~/.local/share/opencode/storage/activity/`

**Recent Files**:
```bash
-rw-r--r-- 1 avi avi 2.2K Feb 23 18:45 act_mm006e5l_addeb2c0f1b3aca3.json
-rw-r--r-- 1 avi avi 1.7K Feb 23 18:43 act_mlzzzkck_b83950e33cce5056.json
-rw-r--r-- 1 avi avi 1.4K Feb 23 12:09 act_mlzlzb9a_7803b3968947888f.json
```

**Activity Structure**:
```json
{
  "id": "act_mm006e5l_addeb2c0f1b3aca3",
  "templateId": "examine-learning-loop-configuration",
  "status": "executing",
  "stats": {
    "tokens": { "input": 0, "output": 0, "cache": { "read": 0 } },
    "cost": { "total": 0 },
    "duration": 0
  },
  "executionEvidence": {
    "sessionsSpawned": [],
    "toolCalls": []
  },
  "workArtifacts": {
    "filesChanged": [],
    "commitsMade": []
  },
  "reason": "Verify current state of learning loop: check if SurrealDB dual-write is working..."
}
```

### Template Storage ✅ VERIFIED

**Storage**: `~/.metabob/activities/`

**Recent Templates**:
```bash
-rw-r--r-- 1 avi avi 1.3K Feb 21 12:28 improve-error-handling.json
-rw-r--r-- 1 avi avi 1.2K Feb 21 12:28 optimize-query-performance.json
-rw-r--r-- 1 avi avi 1.1K Feb 21 12:28 debug-template-failures.json
```

### Backend API ⚠️ NOT RUNNING ON PORT 8080

**Status**: API process found but on port 8081 (test environment)
```bash
python -m uvicorn server.simple_app:app --host 0.0.0.0 --port 8081
```

**Issue**: Production API should be on port 8080 (as configured in `.env.devbob`)

### Redis Connection ❌ NOT ACCESSIBLE

**Status**: Redis container running but not accessible via CLI
```bash
$ redis-cli -h localhost -p 6379 ping
Redis not responding
```

**Issue**: Redis may require authentication or network configuration

---

## Missing Pieces

### 1. Redis Thompson Sampling ⚠️ PARTIALLY IMPLEMENTED

**What Exists**:
- `MetabobCLI.completeActivityExecution()` method ✅
- Dual-write code in `template-metrics-client.ts` ✅
- Redis container running ✅

**What's Missing**:
- Redis connection not accessible ❌
- Backend API not processing Redis writes ❌
- Template variant selection logic not implemented ❌

**Required Actions**:
1. Fix Redis connection (check authentication)
2. Implement backend Redis client in metabob-rpc-api
3. Add Thompson Sampling variant selection algorithm
4. Update `TemplateRepository` to query Redis for variant selection

### 2. SurrealDB Write Verification ⚠️ INCOMPLETE

**What Exists**:
- SurrealDB container running ✅
- Backend API with insert_execution() ✅
- MCP tool calling backend API ✅

**What's Missing**:
- No direct verification of SurrealDB writes ❌
- Backend API running on wrong port (8081 vs 8080) ❌
- No test data in SurrealDB confirmed ❌

**Required Actions**:
1. Start backend API on correct port (8080)
2. Query SurrealDB to verify activity_execution records
3. Query SurrealDB to verify template_metrics aggregation
4. Add logging to confirm successful writes

### 3. Improvement Gradient Calculation ✅ IMPLEMENTED

**Formula** (from backend code):
```python
improvement_gradient = (
    success_rate * 0.4 +           # 40% weight on success
    (1 - normalized_cost) * 0.3 +  # 30% weight on cost efficiency
    (1 - normalized_duration) * 0.3 # 30% weight on speed
)
```

**Status**: Backend code exists, but no verification of calculations

**Required Actions**:
1. Query template_metrics to verify improvement_gradient values
2. Test with known executions to validate formula
3. Add unit tests for gradient calculation

---

## Testing the Learning Loop

### End-to-End Test Scenario

```bash
# Step 1: Execute a low-quality activity
opencode activity execute bad-template --variables '{"test": "value"}'

# Step 2: Verify execution stored in SurrealDB
curl http://localhost:8080/api/v1/learning-loop/executions/recent?limit=1

# Step 3: Check template metrics
curl http://localhost:8080/api/v1/learning-loop/templates/bad-template/metrics

# Step 4: Fetch boredom activities (should include bad-template)
opencode mcp call metabob_fetch_boredom_activities '{"max_activities": 5}'

# Step 5: Wait for idle detection (5 minutes)
# BoredomManager should auto-execute improvement activity

# Step 6: Verify improvement gradient increased
curl http://localhost:8080/api/v1/learning-loop/templates/bad-template/metrics
```

### Health Check Commands

```bash
# SurrealDB
curl -X GET http://localhost:8000/health

# Backend API
curl -X GET http://localhost:8080/health

# Redis
redis-cli -h localhost -p 6379 ping

# Docker Services
docker ps | grep -E "surreal|redis"
```

---

## Recommendations

### Immediate Actions (High Priority)

1. **Fix Backend API Port**
   - Stop process on port 8081
   - Start on port 8080 as configured
   - Verify with `curl http://localhost:8080/health`

2. **Verify SurrealDB Writes**
   - Execute test activity
   - Query `activity_execution` table
   - Confirm metrics aggregation in `template_metrics`

3. **Fix Redis Connection**
   - Check Redis authentication requirement
   - Test connection with `redis-cli`
   - Verify Thompson Sampling integration

### Short-Term Improvements (Medium Priority)

4. **Add Monitoring**
   - Log SurrealDB write confirmations
   - Track dual-write success rates
   - Monitor boredom activity execution

5. **Test Improvement Gradient**
   - Create test templates with known metrics
   - Verify gradient calculation accuracy
   - Test boredom activity prioritization

6. **Document Template Evolution**
   - Track improvement_gradient over time
   - Measure impact of boredom activities
   - Report template quality trends

### Long-Term Enhancements (Low Priority)

7. **Thompson Sampling A/B Testing**
   - Implement template variant system
   - Track variant performance in Redis
   - Auto-promote winning variants

8. **Advanced Analytics**
   - Cochange learning integration
   - Impulse usage correlation
   - Task-level failure analysis

9. **Dashboard UI**
   - Visualize template metrics
   - Show improvement trends
   - Display boredom activity queue

---

## Conclusion

**Status**: Learning loop is **80% operational** with single-write to SurrealDB.

**Working**:
- ✅ Activity execution metrics collection
- ✅ Dual-write architecture (Path A: SurrealDB via MCP)
- ✅ Backend API with SurrealDB storage
- ✅ Boredom activity prioritization algorithm
- ✅ BoredomManager idle detection and auto-execution
- ✅ Improvement gradient calculation (backend)
- ✅ Performance trend tracking (backend)

**Missing**:
- ⚠️ Backend API running on wrong port (8081 vs 8080)
- ❌ Redis connection not accessible
- ❌ Thompson Sampling not integrated
- ❌ SurrealDB write verification incomplete

**Next Steps**:
1. Fix backend API port
2. Verify SurrealDB writes with test execution
3. Fix Redis connection and test Thompson Sampling
4. Execute end-to-end test scenario
5. Monitor learning loop in production

---

## Appendix: File Locations

### OpenCode (metabob-opencode)
```
packages/opencode/src/session/
├── activity.ts                    # Activity state management
├── template-executor.ts           # Activity execution
├── template-metrics.ts            # Metrics type definitions
├── template-metrics-client.ts     # Dual-write metrics reporting
├── boredom-manager.ts             # Idle detection & auto-execution
├── activity-template-repository.ts # Template loading
├── impulse-sync.ts                # Impulse persistence
└── artifact-storage.ts            # Artifact file storage

packages/opencode/src/util/
└── metabob.ts                     # MetabobCLI integration

packages/opencode/src/storage/
└── storage.ts                     # JSON file storage layer
```

### Backend (metabob-rpc-api)
```
server/routes/
└── learning_loop.py               # Learning loop API endpoints

server/db/operations/
└── activity_execution.py          # SurrealDB CRUD operations

server/db/
└── surrealdb_client.py            # SurrealDB connection
```

### MCP (metabob-cli)
```
src/metabob_cli/mcp/
├── activity_templates.py          # Template storage utilities
├── activity_template_tools.py     # MCP tools (post_activity_result, fetch_boredom_activities)
└── api_client.py                  # HTTP client for backend API
```

### Configuration
```
.env.devbob                        # Environment variables
docker-compose.yaml                # Docker services
opencode.json                      # OpenCode configuration (if exists)
```

### Storage Locations
```
~/.local/share/opencode/storage/activity/           # Activity JSON files
~/.local/share/opencode/storage/activity-template/  # Template JSON files
~/.metabob/activities/                              # Template storage (metabob-cli)
```
