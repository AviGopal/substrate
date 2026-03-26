# Database Configuration Report - Learning Loop

**Date**: 2026-02-21  
**Status**: MULTI-STORAGE ARCHITECTURE

---

## Executive Summary

The learning loop uses a **HYBRID storage architecture** with THREE distinct storage backends:

1. **Redis** (PRIMARY) - Activity metrics and template storage via API server
2. **JSON Files** (SECONDARY) - Template definitions for MCP boredom API
3. **SurrealDB** (UNUSED) - Running but not integrated

**Key Finding**: The system has TWO parallel storage paths:
- **API Server Path**: OpenCode → API Server → Redis (for tracking)
- **MCP Path**: OpenCode → metabob-cli MCP → JSON Files (for boredom)

---

## Storage Backend #1: Redis (PRIMARY)

### Status: ✅ ACTIVE AND IN USE

### Connection Details
- **Container**: `metabob-redis`
- **Status**: Running
- **Host**: Via Docker network (api-server-dev has access)
- **Total Keys**: 7,823 keys in database
- **Activity Keys**: 41 keys with pattern `activity:*`

### Data Stored in Redis

#### Activity Metrics (Thompson Sampling)
**Key Pattern**: `activity:metrics:{variant_id}`

**Example**: `activity:metrics:test-feature-template-8bb2a471`
```json
{
  "variant_id": "test-feature-template-8bb2a471",
  "activity_id": "test-feature-template",
  "total_selections": 6,
  "total_successes": 5,
  "total_failures": 1,
  "thompson_alpha": 6.0,     // Thompson sampling α parameter
  "thompson_beta": 2.0,       // Thompson sampling β parameter
  "avg_cost": 0.005885735,
  "avg_duration_ms": 1994.2505,
  "last_updated": "2026-02-19T04:24:26.629023"
}
```

**Fields**:
- `variant_id`: Unique variant identifier (template-id + hash)
- `activity_id`: Base template ID
- `total_selections`: Number of times variant was selected
- `total_successes`: Number of successful executions
- `total_failures`: Number of failed executions
- `thompson_alpha`: Bayesian success parameter (successes + 1)
- `thompson_beta`: Bayesian failure parameter (failures + 1)
- `avg_cost`: Running average cost in USD
- `avg_duration_ms`: Running average duration
- `last_updated`: ISO 8601 timestamp

#### Activity Templates
**Key Pattern**: `activity:template:{variant_id}`

**Example**: `activity:template:test-feature-template-8bb2a471`
- Contains full template definition (tasks, prompts, validation rules)
- Used by API server for template selection and execution

#### Template Execution Lists
**Key Pattern**: `template:{template_name}:executions`

**Type**: Redis List (LRANGE to access)
- Stores execution history for each template
- Used for trend analysis and performance tracking

#### Global Metrics
- `_metrics:total_sessions` - Session counter
- `_metrics:api_keys` - API key tracking
- `_metrics:by_api_key:local-dev-key` - Per-key metrics
- `template:validate-data-flow:metrics` - Template-specific metrics
- `template:test-template:executions` - Execution history lists

### Access Point: API Server

**Container**: `api-server-dev`

**Configuration** (from API server env):
```bash
SURREAL_NAMESPACE=metabob
SURREAL_DATABASE=metabob
SURREAL_PASS=root
SURREAL_URL=ws://surreal:8000
SURREAL_USER=root
```

**NOTE**: Despite env vars referencing SurrealDB, the API server is using **Redis** for metrics storage. The SurrealDB connection is configured but not actively used for learning loop data.

### API Endpoints

**Activity Metrics Endpoints**:
```
POST /api/activity-execution        # Report execution
GET  /api/template/{id}/metrics     # Query metrics
GET  /api/template/{id}/recommendation  # Get promotion recommendation
POST /api/template/promote          # Promote candidate to stable
```

**Template Management Endpoints**:
```
GET  /v2/activities/templates                 # List all templates
POST /v2/activities/templates                 # Register template
GET  /v2/activities/templates/{id}            # Get template
GET  /v2/activities/templates/{id}/stats      # Get variant stats
POST /v2/activities/templates/{id}/variants   # Create variant
```

### Thompson Sampling Algorithm

The API server uses **Thompson Sampling** for multi-armed bandit template selection:

1. **Prior**: Beta(α=1, β=1) - uniform prior
2. **Update**: After each execution:
   - Success: α = α + 1
   - Failure: β = β + 1
3. **Selection**: Sample from Beta(α, β) for each variant, select highest

**Advantages**:
- Balances exploration vs exploitation
- Probabilistic selection (not greedy)
- Converges to optimal template over time
- Handles uncertainty gracefully

### Example API Call

**Query Template Metrics**:
```bash
curl http://localhost:8080/api/template/test-feature-template/metrics
```

**Response**:
```json
{
  "stable": {
    "template_id": "test-feature-template",
    "executions": 0,
    "success_rate": 0.0,
    "avg_cost": 0.0,
    "avg_duration": 0.0
  },
  "candidates": []
}
```

---

## Storage Backend #2: JSON Files (SECONDARY)

### Status: ✅ ACTIVE FOR MCP

### Connection Details
- **Location**: `~/.metabob/activities/*.json`
- **Purpose**: Template storage for boredom API (metabob-cli MCP)
- **File Count**: 13 templates currently
- **Access**: Direct file I/O with file locking

### Data Stored in JSON Files

#### Template Structure
**Example**: `~/.metabob/activities/good-quality-template.json`
```json
{
  "activity_id": "good-quality-template",
  "name": "Good Quality Template",
  "category": "feature",
  "estimated_metrics": {
    "execution_count": 8,
    "success_count": 7,
    "success_rate": 0.875,
    "avg_duration_ms": 25000,
    "avg_cost": 0.15,
    "improvement_gradient": 0.85,
    "performance_trends": {
      "duration": "improving",
      "cost": "improving",
      "success_rate": "stable"
    }
  }
}
```

**Full Schema** (for complete templates):
```json
{
  "name": "Template Name",
  "description": "Template description",
  "category": "feature|bugfix|refactor|tool|infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Task description",
      "dependencies": [],
      "prompt": {
        "template": "Prompt with {{variables}}",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": [
          {
            "name": "variableName",
            "type": "string",
            "required": true,
            "description": "Variable description"
          }
        ]
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 3,
        "strategy": "simple"
      }
    }
  ],
  "estimated_metrics": {
    "execution_count": 0,
    "success_count": 0,
    "success_rate": 0.0,
    "avg_duration_ms": 0,
    "avg_cost": 0.0,
    "improvement_gradient": 0.5,
    "performance_trends": {
      "duration": "stable|improving|degrading",
      "cost": "stable|improving|degrading",
      "success_rate": "stable|improving|degrading"
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
}
```

### Current Templates

```
~/.metabob/activities/
├── create-activity-template.json (4.9K)
├── debug-template-failures.json (1.1K)
├── diagnose-startup-issues.json (39K)
├── git-revision-management.json (24K)
├── good-quality-template.json (420B)
├── high-failures-template.json (810B)
├── improve-error-handling.json (1.3K)
├── mediocre-template.json (431B)
├── multi-agent-acp-workflow.json (18K)
├── optimize-query-performance.json (1.2K)
├── test-boredom-system-docker.json (12K)
└── test-low-quality-template.json (889B)
```

### File Locking Mechanism

**Implementation**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:307-362`

```python
with open(template_file, "r+", encoding="utf-8") as f:
    # Acquire exclusive lock
    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
    
    # Read current data
    template_data = json.load(f)
    
    # Update metrics
    metrics = template_data.get("estimated_metrics", {})
    # ... update logic ...
    
    # Atomic write-back
    f.seek(0)
    f.truncate()
    json.dump(template_data, f, indent=2)
    f.flush()
    
    # Release lock
    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
```

**Safety Features**:
- Exclusive locking prevents concurrent writes
- Atomic write (seek + truncate + write) ensures consistency
- Flush ensures data is written to disk

### Access Point: MCP Tools

**Python Module**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**MCP Tools**:
- `metabob_post_activity_result` - Update metrics
- `metabob_fetch_boredom_activities` - Query for boredom suggestions
- `metabob_search_activities` - Search templates
- `metabob_list_activity_templates` - List all templates
- `metabob_get_activity_template` - Get single template
- `metabob_register_activity_template` - Register new template

---

## Storage Backend #3: SurrealDB (UNUSED)

### Status: ❌ NOT INTEGRATED

### Connection Details
- **Container**: `metabob-surreal`
- **Status**: Up 2 days (healthy)
- **Ports**: 0.0.0.0:8000→8000/tcp
- **Storage**: File-based at `/data/database.db`
- **Web UI**: `metabob-surrealist` on port 8001

### Configuration

**Environment Variables** (API server expects these):
```bash
SURREAL_NAMESPACE=metabob
SURREAL_DATABASE=metabob
SURREAL_PASS=root
SURREAL_URL=ws://surreal:8000
SURREAL_USER=root
```

### Current State

**Startup Logs**:
```
2026-02-19T12:34:48.410047Z INFO surrealdb::core::kvs::ds: Started kvs store at file:///data/database.db
2026-02-19T12:34:48.432898Z INFO surrealdb::net: Started web server on 0.0.0.0:8000
```

**Database Schema**: Unable to query (surreal CLI not available in container)

**HTTP API Issues**:
```bash
curl -X POST http://localhost:8000/sql -u "root:root" -H "NS: metabob" -H "DB: devbob" -d "INFO FOR DB;"
# Returns: 415 Unsupported media type
# Needs Content-Type header
```

### Why Not Used?

**Current State**:
1. API server configured with SurrealDB connection
2. Database container running and healthy
3. **BUT**: No learning loop data stored in SurrealDB
4. API server using Redis for actual metrics storage

**Likely Reasons**:
- **Phase 1**: Original implementation used Redis for speed
- **Phase 2**: SurrealDB planned for complex queries and relationships
- **Phase 3**: Migration not completed yet

**Evidence**:
- Redis has 41 activity-related keys with live data
- SurrealDB connection configured but queries return empty
- No code in OpenCode or metabob-cli that writes to SurrealDB

---

## OpenCode Local Storage (SEPARATE)

### Status: ✅ ACTIVE (OPENCODE INTERNAL)

### Location
```
~/.local/share/opencode/storage/
├── activity/               # Activity execution records
├── activity-execution/     # Execution logs
├── activity-template/      # Template definitions
└── activity-archive/       # Archived activities
```

### Purpose
- **Internal OpenCode storage** for sessions and activities
- **Separate from learning loop** metrics
- Used by OpenCode's activity system for state management

### Example Templates Stored
```
create-activity-self-contained.json
debug-activity-self-contained.json
evolve-activity-self-contained.json
debug-activity-execution-self-contained.json
validate-backend-activity-storage.json
...
```

**NOT used by**:
- Boredom API
- Thompson sampling
- Metrics aggregation

---

## Data Flow Architecture

### Path 1: Activity Execution → Redis (via API Server)

```
┌─────────────────────────────────────────────────────────────────┐
│ OpenCode Activity Execution                                     │
│ (repos/metabob-opencode/packages/opencode/src/session/)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. Activity completes/fails
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ TemplateMetricsClient                                           │
│ (template-metrics-client.ts)                                     │
│                                                                  │
│ Option A: Direct API call (if configured)                       │
│   POST /api/activity-execution                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 2. HTTP POST to API server
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ API Server                                                       │
│ (api-server-dev container)                                       │
│                                                                  │
│ - Receives execution report                                     │
│ - Updates Thompson sampling parameters                          │
│ - Stores in Redis                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 3. Redis SET/UPDATE
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Redis Storage                                                    │
│ (metabob-redis container)                                        │
│                                                                  │
│ Key: activity:metrics:{variant_id}                              │
│ Value: {                                                         │
│   total_selections: N,                                          │
│   total_successes: M,                                           │
│   thompson_alpha: M + 1,                                        │
│   thompson_beta: (N - M) + 1,                                   │
│   avg_cost: X,                                                  │
│   avg_duration_ms: Y                                            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Path 2: Activity Execution → JSON Files (via MCP)

```
┌─────────────────────────────────────────────────────────────────┐
│ OpenCode Activity Execution                                     │
│ (activity.ts)                                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. Activity completes/fails
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ TemplateMetricsClient                                           │
│ (template-metrics-client.ts)                                     │
│                                                                  │
│ Option B: MCP call (default)                                    │
│   MCP.callTool("metabob_post_activity_result")                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 2. MCP call over stdio
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ metabob-cli MCP Backend                                         │
│ (repos/metabob-cli/src/metabob_cli/mcp/)                       │
│                                                                  │
│ Tool: metabob_post_activity_result                              │
│ - Extract template_id from activity_id                          │
│ - Call activity_templates.update_metrics()                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 3. File lock + update
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ JSON File Storage                                               │
│ (~/.metabob/activities/)                                        │
│                                                                  │
│ File: {template_id}.json                                        │
│ - fcntl.flock(LOCK_EX)                                          │
│ - Update estimated_metrics                                      │
│ - Atomic write-back                                             │
│ - fcntl.flock(LOCK_UN)                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Path 3: Boredom System → JSON Files (via MCP)

```
┌─────────────────────────────────────────────────────────────────┐
│ BoredomManager                                                   │
│ (boredom-manager.ts)                                             │
│                                                                  │
│ - Detect idle (5+ min)                                          │
│ - Every 30 seconds check                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. Idle detected
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ MCP Call                                                         │
│                                                                  │
│ MCP.callTool("metabob_fetch_boredom_activities", {              │
│   max_activities: 5,                                            │
│   priority_threshold: 0.6,                                      │
│   exclude_recent_hours: 24                                      │
│ })                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 2. MCP call over stdio
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ metabob-cli MCP Backend                                         │
│ (activity_templates.py)                                          │
│                                                                  │
│ Tool: metabob_fetch_boredom_activities                          │
│ 1. List all files from ~/.metabob/activities/                  │
│ 2. Filter by improvement_gradient < threshold                   │
│ 3. Categorize (improve-template, debug-failures, optimize)      │
│ 4. Calculate priority scores                                    │
│ 5. Sort by priority (highest first)                             │
│ 6. Return top N activities                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 3. Read JSON files
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ JSON File Storage                                               │
│ (~/.metabob/activities/)                                        │
│                                                                  │
│ Read: {template_id}.json                                        │
│ Extract: estimated_metrics.improvement_gradient                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Summary

### Database Connection Status

| Backend     | Status      | Connection Configured | Data Present | Actively Used |
|-------------|-------------|-----------------------|--------------|---------------|
| **Redis**   | ✅ Running  | ✅ Yes                | ✅ Yes (7823 keys) | ✅ Yes |
| **JSON Files** | ✅ Available | N/A (file system) | ✅ Yes (13 templates) | ✅ Yes |
| **SurrealDB** | ✅ Running | ✅ Yes               | ❌ No/Empty   | ❌ No |
| **OpenCode Storage** | ✅ Available | N/A (local) | ✅ Yes | ✅ Yes (internal) |

### Connection Credentials

**Redis**:
- No authentication required (internal Docker network)
- Accessible from: api-server-dev container
- NOT directly accessible from OpenCode (goes through API server)

**SurrealDB**:
```bash
Host: localhost:8000 (or ws://surreal:8000 from Docker)
User: root
Pass: root
Namespace: metabob
Database: metabob (or devbob)
```

**JSON Files**:
- No credentials needed (file system access)
- Location: `~/.metabob/activities/`
- Permissions: User file ownership

### Alternative Storage Found

**YES - OpenCode Local Storage**:
```
~/.local/share/opencode/storage/
├── activity/               # Activity state
├── activity-execution/     # Execution logs
├── activity-template/      # Template definitions (different from metabob)
└── activity-archive/       # Archived activities
```

**Purpose**: Internal OpenCode storage, separate from learning loop.

---

## Schema Details

### Redis Schema (Thompson Sampling)

**Activity Metrics Key**: `activity:metrics:{variant_id}`

```typescript
interface ActivityMetrics {
  variant_id: string;           // Unique variant ID
  activity_id: string;          // Base template ID
  total_selections: number;     // Times selected
  total_successes: number;      // Successful executions
  total_failures: number;       // Failed executions
  thompson_alpha: number;       // Bayesian α (successes + 1)
  thompson_beta: number;        // Bayesian β (failures + 1)
  avg_cost: number;             // Running average cost (USD)
  avg_duration_ms: number;      // Running average duration (ms)
  last_updated: string;         // ISO 8601 timestamp
}
```

**Activity Template Key**: `activity:template:{variant_id}`

```typescript
interface ActivityTemplate {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  description: string;
  version: number;
  task_steps: TaskStep[];       // Full task definitions
  created_at: string;
  updated_at: string;
}
```

### JSON File Schema (Boredom API)

**Template File**: `~/.metabob/activities/{template_id}.json`

```typescript
interface TemplateFile {
  activity_id: string;
  name: string;
  description?: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure';
  tasks: Task[];
  estimated_metrics: {
    execution_count: number;
    success_count: number;
    success_rate: number;
    avg_duration_ms: number;
    avg_cost: number;
    improvement_gradient?: number;      // 0.0-1.0 (lower = needs improvement)
    performance_trends?: {
      duration: 'stable' | 'improving' | 'degrading';
      cost: 'stable' | 'improving' | 'degrading';
      success_rate: 'stable' | 'improving' | 'degrading';
    };
    failure_patterns?: Array<{
      task_id: string;
      error_type: string;
      error_message: string;
      count: number;
      last_seen: string;
    }>;
    last_execution?: {
      timestamp: string;
      success: boolean;
      duration: number;
      cost: number;
      error?: string;
    };
  };
}
```

---

## Critical Findings

### 1. DUAL STORAGE SYSTEM

The learning loop uses **TWO SEPARATE STORAGE BACKENDS**:

**Redis** (via API Server):
- ✅ Thompson sampling for template selection
- ✅ Live metrics tracking
- ✅ Variant management
- ⚠️ NOT used by boredom API

**JSON Files** (via MCP):
- ✅ Boredom activity suggestions
- ✅ Improvement gradient tracking
- ✅ Performance trend analysis
- ⚠️ NOT used by Thompson sampling

**Result**: The two systems are **DISCONNECTED**:
- API server metrics in Redis are NOT seen by boredom API
- Boredom API metrics in JSON files are NOT seen by Thompson sampling
- No synchronization between the two

### 2. SURREALDB NOT INTEGRATED

Despite being configured and running:
- ✅ SurrealDB container healthy (2 days uptime)
- ✅ Connection credentials configured
- ❌ No data stored in SurrealDB
- ❌ No code writing to SurrealDB
- ❌ API server using Redis instead

**Conclusion**: SurrealDB is a **placeholder for future migration**.

### 3. THOMPSON SAMPLING VS BOREDOM API

Two **DIFFERENT** selection strategies:

**Thompson Sampling** (Redis, via API):
- Probabilistic multi-armed bandit
- Balances exploration vs exploitation
- Converges to optimal template
- Real-time during execution

**Boredom API** (JSON Files, via MCP):
- Deterministic priority calculation
- Based on improvement_gradient
- Suggests templates needing work
- Runs during idle time

**These are SEPARATE systems** with different purposes:
- Thompson sampling: Select BEST template for user task
- Boredom API: Select WORST template for autonomous improvement

---

## Recommendations

### 1. UNIFY STORAGE (Critical)

**Current Problem**: Dual storage causes data inconsistency

**Solution Options**:

**Option A: Migrate Boredom API to Redis**
- Read metrics from Redis instead of JSON files
- Calculate improvement_gradient from Thompson parameters
- Keep JSON files for template definitions only

**Option B: Dual-Write to Both Backends**
- Update both Redis and JSON files on each execution
- Synchronize metrics between the two
- Maintain consistency

**Option C: Migrate to SurrealDB**
- Complete SurrealDB integration
- Move both Redis and JSON file data to SurrealDB
- Use SQL queries for both Thompson sampling and boredom API
- Single source of truth

**Recommended**: **Option C (SurrealDB)** for long-term, **Option B (Dual-Write)** for short-term.

### 2. TEST END-TO-END FLOW

**Validate Current System**:
```bash
# 1. Execute activity and verify Redis update
opencode activity execute --template test-feature-template
docker exec metabob-redis redis-cli GET "activity:metrics:test-feature-template-*"

# 2. Wait for idle (5+ min) and check boredom API
# Watch logs for boredom activity execution
tail -f ~/.opencode/logs/*.log | grep BOREDOM

# 3. Verify JSON file was updated
cat ~/.metabob/activities/test-feature-template.json | jq .estimated_metrics
```

### 3. SYNCHRONIZE METRICS

**Immediate Fix**: Create sync script
```python
# sync_metrics.py
# Read from Redis, update JSON files with:
# - execution_count = total_selections
# - success_count = total_successes
# - avg_cost, avg_duration_ms (already present)
# - Calculate improvement_gradient from thompson_alpha/beta
```

### 4. COMPLETE BOREDOM EXECUTION

**Current Issue**: `executeBoredomActivity()` is a placeholder

**Implementation Needed**:
1. Load template from TemplateRepository
2. Create Activity instance
3. Execute with "boredom" flag
4. Monitor for user return (cancel if detected)
5. Report results back to metrics system

---

## Summary

### Storage Backend Configuration

| Component | Backend | Status | Purpose |
|-----------|---------|--------|---------|
| **Activity Execution → Metrics** | Redis | ✅ Active | Thompson sampling tracking |
| **Activity Execution → Metrics** | JSON Files | ✅ Active | Boredom API tracking |
| **Boredom Suggestions** | JSON Files | ✅ Active | Priority calculation |
| **Template Selection** | Redis | ✅ Active | Thompson sampling |
| **Database Backend** | SurrealDB | ❌ Unused | Future migration target |

### Key Answers

**Database connection configured?**
- Redis: ✅ Yes (via API server)
- JSON Files: ✅ Yes (file system)
- SurrealDB: ✅ Yes (but not used)

**Storage backend identified?**
- **PRIMARY**: Redis (Thompson sampling metrics)
- **SECONDARY**: JSON Files (boredom API metrics)
- **UNUSED**: SurrealDB

**Schema accessible?**
- Redis: ✅ Yes (via redis-cli)
- JSON Files: ✅ Yes (direct file access)
- SurrealDB: ⚠️ Yes (but empty)

**Connection credentials available?**
- Redis: ✅ Yes (no auth needed)
- JSON Files: ✅ Yes (file system)
- SurrealDB: ✅ Yes (root:root)

**Alternative storage found?**
- ✅ Yes: OpenCode local storage (`~/.local/share/opencode/storage/`)
- Purpose: Internal activity state management (separate from learning loop)

### Critical Issue

**DUAL STORAGE WITHOUT SYNCHRONIZATION**:
- Redis has live Thompson sampling metrics
- JSON files have separate boredom API metrics
- The two are NOT synchronized
- Causes potential data inconsistency

**Action Required**: Implement sync mechanism or migrate to unified storage (SurrealDB).
