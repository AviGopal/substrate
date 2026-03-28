# HTTP API v2 Activity Contract

**Version:** 1.0.0
**Provider:** metabob-activity-api
**Consumers:** minibob, metabob-cloud-dashboard
**Status:** Operational (existing implementation)

## Overview

The Activity API provides backend services for:
- **Activity Template Management** - Store, retrieve, and version activity templates
- **Thompson Sampling** - Probabilistic template selection based on execution history
- **Impulse Resolution** - Resolve all impulse pointer types (memo, file, executionTrace, etc.)
- **Execution Trace Storage** - Persist complete execution state with snapshots
- **Learning Loop** - Track composition, tool usage, impulse relevance, sequences
- **Boredom Activities** - Queue and manage autonomous improvement tasks
- **Vessel Registry** - Track active vessels and health status
- **Ribosome** - Extract successful executions into reusable templates

## Base URL

- **Development:** `http://metabob-activity-api.activity-system.svc.cluster.local:8080`
- **Ingress:** `http://api.minibob.local` (Istio gateway)

## Authentication

All `/v2/*` endpoints require authentication via:

**Option 1: Session-based (for dashboard)**
```http
Authorization: Bearer <session_token>
```

**Option 2: Internal service API key (for minibob)**
```http
X-Internal-Api-Key: <api_key>
```

**Health endpoint exception:**
- `GET /health` - No authentication required

## Core Endpoints

### 1. Health Check

**GET /health**

Deep health check verifying Redis and SurrealDB connectivity.

**Response 200:**
```json
{
  "service": "metabob-activity-api",
  "version": "1.0.0",
  "timestamp": "2026-03-23T17:30:00Z",
  "status": "healthy",
  "checks": {
    "redis": {
      "status": "healthy",
      "latency_ms": 2
    },
    "surrealdb": {
      "status": "healthy",
      "latency_ms": 15
    }
  }
}
```

**Response 503:** (Service Unavailable)
```json
{
  "service": "metabob-activity-api",
  "status": "unhealthy",
  "checks": {
    "redis": { "status": "unhealthy", "error": "Connection refused" },
    "surrealdb": { "status": "healthy", "latency_ms": 12 }
  }
}
```

**Kubernetes Integration:**
- 503 signals K8s to remove pod from load balancer
- Used for liveness and readiness probes

---

### 2. Activity Templates

#### GET /v2/activities/templates

List all activity templates with Thompson Sampling scores.

**Query Parameters:**
- `limit` (optional): Max templates to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)
- `scope` (optional): Filter by scope (`user`, `project`, `org`, `global`)
- `category` (optional): Filter by category (`feature`, `bugfix`, `refactor`, `tool`, `infrastructure`)

**Response 200:**
```json
{
  "templates": [
    {
      "variant_id": "uuid-v4",
      "activity_id": "fix-boredom-trace-storage",
      "variant_name": "v1",
      "description": "Fix execution trace storage for boredom activities",
      "category": "bugfix",
      "scope": "project",
      "org_id": "metabob-labs",
      "project_id": "devbob",
      "task_steps": [...],
      "genealogy": {
        "parent_variant_id": null,
        "generation": 1,
        "mutation_type": "original"
      },
      "metrics": {
        "total_executions": 5,
        "successful_executions": 4,
        "failed_executions": 1,
        "success_rate": 0.8,
        "avg_duration_ms": 45000,
        "avg_cost_usd": 0.15,
        "thompson_alpha": 5.0,
        "thompson_beta": 2.0,
        "total_selections": 7,
        "last_executed_at": "2026-03-23T16:45:00Z"
      },
      "created_at": "2026-03-20T10:00:00Z",
      "updated_at": "2026-03-23T16:45:00Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

**Caching:**
- Redis cache-aside pattern (1 hour TTL)
- Invalidated on template creation/update

---

#### POST /v2/activities/templates

Create new activity template.

**Request Body:**
```json
{
  "activity_id": "add-feature-x",
  "variant_name": "v1",
  "description": "Add feature X to codebase",
  "category": "feature",
  "task_steps": [
    {
      "task_id": "1",
      "description": "Read existing code structure",
      "prompt": {
        "template": "Read {{file_path}} and understand structure",
        "variables": [{"name": "file_path", "type": "string"}]
      }
    }
  ],
  "scope": "project",
  "org_id": "metabob-labs",
  "project_id": "devbob",
  "genealogy": {
    "parent_variant_id": null,
    "generation": 1,
    "mutation_type": "original"
  }
}
```

**Response 201:**
```json
{
  "variant_id": "uuid-v4",
  "activity_id": "add-feature-x",
  "variant_name": "v1",
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### POST /v2/activities/recommend

Get Thompson Sampling recommendation for activity selection.

**Request Body:**
```json
{
  "goal_description": "Fix boredom activity execution traces",
  "context": {
    "recent_failures": ["fix-trace-v1"],
    "available_impulses": ["execution:123", "file:src/boredom.ts"]
  },
  "filters": {
    "category": ["bugfix"],
    "scope": "project"
  }
}
```

**Response 200:**
```json
{
  "recommended_variant_id": "uuid-v4",
  "activity_id": "fix-boredom-trace-storage",
  "variant_name": "v2",
  "thompson_score": 0.85,
  "confidence": 0.92,
  "reasoning": "Highest Thompson score among bugfix templates",
  "alternatives": [
    {
      "variant_id": "uuid-v5",
      "activity_id": "fix-boredom-trace-storage",
      "variant_name": "v1",
      "thompson_score": 0.72,
      "reason": "Lower success rate"
    }
  ]
}
```

---

### 3. Impulse Management

#### POST /v2/impulses

Store impulse data with project-scoped isolation.

**Request Body:**
```json
{
  "impulse_id": "errorFile",
  "project_id": "devbob",
  "impulse_data": {
    "type": "file",
    "path": "src/tool/bash.ts",
    "offset": 40,
    "limit": 20,
    "budget": 2000,
    "priority": "high",
    "loaded": false,
    "content": null
  }
}
```

**Response 201:**
```json
{
  "impulse_id": "errorFile",
  "project_id": "devbob",
  "api_key": "...",
  "created_at": "2026-03-23T17:30:00Z"
}
```

**Error 400:** (Impulse already exists)
```json
{
  "error": "Impulse errorFile already exists for project devbob"
}
```

---

#### POST /v2/impulses/resolve

Resolve impulse pointer to actual content.

**Request Body:**
```json
{
  "impulse_id": "errorFile",
  "project_id": "devbob",
  "impulse_data": {
    "type": "file",
    "path": "repos/minibob/src/tool/bash.ts",
    "offset": 40,
    "limit": 20
  }
}
```

**Response 200:**
```json
{
  "impulse_id": "errorFile",
  "loaded": true,
  "content": "... file content lines 40-60 ...",
  "tokens_used": 850,
  "budget_remaining": 1150,
  "metadata": {
    "file_path": "repos/minibob/src/tool/bash.ts",
    "lines": "40-60",
    "size_bytes": 3200
  }
}
```

**Supported Impulse Types:**
- `memo`: Embedded content (no resolution needed)
- `file`: File pointer with offset/limit
- `activityExecutionTrace`: Full execution trace with state
- `activityTemplate`: Template structure and metadata
- `activityMetrics`: Performance data
- Custom types: Backend can add new types without vessel changes

---

#### GET /v2/impulses/:impulseId

Retrieve stored impulse by ID.

**Response 200:**
```json
{
  "impulse_id": "errorFile",
  "project_id": "devbob",
  "impulse_data": {
    "type": "file",
    "path": "src/tool/bash.ts",
    "offset": 40,
    "limit": 20,
    "budget": 2000
  },
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### GET /v2/impulses

List impulses with pagination.

**Query Parameters:**
- `limit` (optional): Max impulses to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `project_id` (optional): Filter by project

**Response 200:**
```json
{
  "impulses": [...],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

---

### 4. Execution Traces

#### POST /v2/activities/execution-traces

Store complete execution trace with state snapshots.

**Request Body:**
```json
{
  "execution_id": "exec-uuid",
  "variant_id": "variant-uuid",
  "activity_id": "fix-boredom-trace-storage",
  "success": true,
  "duration_ms": 45000,
  "cost": 0.15,
  "tokens": {
    "input": 5000,
    "output": 2000,
    "cache": 1000
  },
  "impulses_used": ["errorFile", "executionTrace:123"],
  "tasks": [
    {
      "task_id": "1",
      "description": "Read error logs",
      "status": "completed",
      "duration_ms": 5000,
      "tool_calls": [
        { "tool": "read", "duration_ms": 100, "success": true }
      ]
    }
  ],
  "state_snapshot": {
    "input_state": {
      "filesAvailable": ["src/boredom.ts"],
      "environment": { "NODE_ENV": "development" },
      "impulses": ["errorFile"],
      "variables": { "goal": "fix trace storage" }
    },
    "output_state": {
      "filesModified": ["src/routes/boredom.ts"],
      "filesCreated": [],
      "filesDeleted": [],
      "exitCode": 0
    },
    "stateTransition": {
      "before": { "src/routes/boredom.ts": "hash-abc" },
      "after": { "src/routes/boredom.ts": "hash-def" },
      "workingDirectory": "/repos/metabob-activity-api"
    }
  },
  "component_changes": [
    {
      "file_path": "src/routes/boredom.ts",
      "component_name": "boredomQueueRoute",
      "component_type": "function",
      "change_type": "modified",
      "reason": "Added execution trace storage"
    }
  ]
}
```

**Response 201:**
```json
{
  "execution_id": "exec-uuid",
  "created_at": "2026-03-23T17:30:00Z",
  "stored": true
}
```

**Triggers:**
- Updates Thompson Sampling metrics (alpha/beta)
- Invalidates template cache
- Broadcasts event via WebSocket

---

#### GET /v2/activities/execution-traces

Retrieve execution traces with pagination.

**Query Parameters:**
- `limit` (optional): Max traces to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `variant_id` (optional): Filter by variant
- `activity_id` (optional): Filter by activity
- `success` (optional): Filter by success status (true/false)
- `since` (optional): ISO timestamp for recent traces

**Response 200:**
```json
{
  "executions": [
    {
      "execution_id": "exec-uuid",
      "variant_id": "variant-uuid",
      "activity_id": "fix-boredom-trace-storage",
      "success": true,
      "duration_ms": 45000,
      "cost": 0.15,
      "tokens": { "input": 5000, "output": 2000, "cache": 1000 },
      "executed_at": "2026-03-23T17:30:00Z",
      "tasks": [...],
      "state_snapshot": {...}
    }
  ],
  "total": 120,
  "limit": 50,
  "offset": 0
}
```

---

#### GET /v2/activities/execution-traces/:executionId

Retrieve single execution trace by ID.

**Response 200:**
```json
{
  "execution_id": "exec-uuid",
  "variant_id": "variant-uuid",
  "activity_id": "fix-boredom-trace-storage",
  "success": true,
  "duration_ms": 45000,
  "cost": 0.15,
  "tokens": { "input": 5000, "output": 2000, "cache": 1000 },
  "impulses_used": ["errorFile"],
  "tasks": [...],
  "state_snapshot": {...},
  "component_changes": [...],
  "executed_at": "2026-03-23T17:30:00Z",
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

### 5. Learning Loop

#### POST /v2/activities/composition

Record activity composition (dependencies between activities).

**Request Body:**
```json
{
  "from_variant_id": "variant-uuid-1",
  "to_variant_id": "variant-uuid-2",
  "relationship_type": "depends_on",
  "weight": 1.0,
  "context": {
    "reason": "Template A always follows Template B in successful executions"
  }
}
```

**Response 201:**
```json
{
  "composition_id": "comp-uuid",
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### GET /v2/activities/composition/graph

Retrieve composition dependency graph.

**Query Parameters:**
- `variant_id` (optional): Start from specific variant
- `depth` (optional): Max graph depth (default: 3)
- `limit` (optional): Max nodes to return (default: 100)

**Response 200:**
```json
{
  "nodes": [
    {
      "variant_id": "variant-uuid-1",
      "activity_id": "setup-env",
      "variant_name": "v1"
    },
    {
      "variant_id": "variant-uuid-2",
      "activity_id": "run-tests",
      "variant_name": "v2"
    }
  ],
  "edges": [
    {
      "from_variant_id": "variant-uuid-1",
      "to_variant_id": "variant-uuid-2",
      "relationship_type": "depends_on",
      "weight": 0.95
    }
  ],
  "total_nodes": 2,
  "total_edges": 1
}
```

---

#### POST /v2/activities/impulse-relevance

Track impulse relevance for learning which impulses help which activities.

**Request Body:**
```json
{
  "variant_id": "variant-uuid",
  "impulse_type": "activityExecutionTrace",
  "relevance_score": 0.92,
  "tokens_used": 1200,
  "task_id": "3",
  "contributed_to_success": true
}
```

**Response 201:**
```json
{
  "metric_id": "metric-uuid",
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### GET /v2/activities/impulse-relevance

Query impulse relevance patterns.

**Query Parameters:**
- `variant_id` (optional): Filter by variant
- `impulse_type` (optional): Filter by impulse type
- `min_score` (optional): Minimum relevance score (0.0-1.0)
- `limit` (optional): Max results (default: 50)

**Response 200:**
```json
{
  "metrics": [
    {
      "variant_id": "variant-uuid",
      "impulse_type": "activityExecutionTrace",
      "avg_relevance_score": 0.88,
      "total_uses": 15,
      "success_rate": 0.93,
      "avg_tokens_used": 1100
    }
  ],
  "total": 1
}
```

---

#### POST /v2/activities/tool-usage

Record tool usage patterns during execution.

**Request Body:**
```json
{
  "variant_id": "variant-uuid",
  "tool_name": "bash",
  "task_id": "2",
  "success": true,
  "duration_ms": 500,
  "args_pattern": {
    "command_type": "git",
    "flags": ["--no-pager", "diff"]
  }
}
```

**Response 201:**
```json
{
  "usage_id": "usage-uuid",
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### GET /v2/activities/tool-usage

Query tool usage patterns.

**Query Parameters:**
- `variant_id` (optional): Filter by variant
- `tool_name` (optional): Filter by tool
- `success` (optional): Filter by success status
- `limit` (optional): Max results (default: 50)

**Response 200:**
```json
{
  "patterns": [
    {
      "variant_id": "variant-uuid",
      "tool_name": "bash",
      "total_uses": 42,
      "success_count": 40,
      "failure_count": 2,
      "avg_duration_ms": 450,
      "common_patterns": [
        { "command_type": "git", "frequency": 25 },
        { "command_type": "bun", "frequency": 17 }
      ]
    }
  ],
  "total": 1
}
```

---

#### POST /v2/activities/execution-sequences

Record sequences of activities executed together.

**Request Body:**
```json
{
  "sequence": [
    {
      "variant_id": "variant-uuid-1",
      "position": 0,
      "execution_id": "exec-uuid-1",
      "success": true
    },
    {
      "variant_id": "variant-uuid-2",
      "position": 1,
      "execution_id": "exec-uuid-2",
      "success": true
    }
  ],
  "sequence_success": true,
  "total_duration_ms": 90000
}
```

**Response 201:**
```json
{
  "sequence_id": "seq-uuid",
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### GET /v2/activities/execution-sequences

Query execution sequence patterns.

**Query Parameters:**
- `variant_id` (optional): Filter sequences containing variant
- `min_length` (optional): Minimum sequence length
- `success_only` (optional): Only successful sequences (true/false)
- `limit` (optional): Max results (default: 50)

**Response 200:**
```json
{
  "sequences": [
    {
      "sequence_id": "seq-uuid",
      "sequence": [
        { "variant_id": "variant-uuid-1", "position": 0 },
        { "variant_id": "variant-uuid-2", "position": 1 }
      ],
      "sequence_success": true,
      "total_duration_ms": 90000,
      "frequency": 5,
      "created_at": "2026-03-23T17:30:00Z"
    }
  ],
  "total": 1
}
```

---

### 6. Boredom Activities

#### POST /v2/activities/boredom/enqueue

Enqueue autonomous improvement task.

**Request Body:**
```json
{
  "task_description": "Optimize database query performance",
  "priority": "medium",
  "estimated_duration_minutes": 30,
  "context": {
    "recent_slow_queries": ["SELECT * FROM execution_traces"]
  }
}
```

**Response 201:**
```json
{
  "task_id": "boredom-uuid",
  "status": "queued",
  "position": 3,
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### GET /v2/activities/boredom/queue

List queued boredom tasks.

**Response 200:**
```json
{
  "tasks": [
    {
      "task_id": "boredom-uuid",
      "task_description": "Optimize database query performance",
      "priority": "medium",
      "status": "queued",
      "created_at": "2026-03-23T17:30:00Z"
    }
  ],
  "total": 1
}
```

---

#### POST /v2/activities/boredom/results

Store boredom activity execution result.

**Request Body:**
```json
{
  "task_id": "boredom-uuid",
  "success": true,
  "execution_id": "exec-uuid",
  "improvements": ["Reduced query time by 60%"],
  "files_modified": ["src/db/queries.ts"]
}
```

**Response 201:**
```json
{
  "result_id": "result-uuid",
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### GET /v2/activities/boredom/results

Retrieve boredom activity results.

**Query Parameters:**
- `limit` (optional): Max results (default: 50)
- `success` (optional): Filter by success status

**Response 200:**
```json
{
  "results": [
    {
      "result_id": "result-uuid",
      "task_id": "boredom-uuid",
      "success": true,
      "improvements": ["Reduced query time by 60%"],
      "created_at": "2026-03-23T17:30:00Z"
    }
  ],
  "total": 1
}
```

---

#### GET /v2/activities/boredom/stats

Get boredom activity statistics.

**Response 200:**
```json
{
  "total_tasks": 42,
  "completed_tasks": 38,
  "success_rate": 0.90,
  "avg_duration_minutes": 25,
  "top_improvements": [
    { "type": "performance", "count": 15 },
    { "type": "bug_fix", "count": 12 }
  ]
}
```

---

### 7. Vessel Management

#### POST /v2/vessels/register

Register vessel in active vessels registry.

**Request Body:**
```json
{
  "vessel_id": "minibob-pod-1",
  "vessel_type": "minibob",
  "capabilities": ["activity-execution", "local-impulse-resolution"],
  "version": "1.0.0",
  "namespace": "activity-system",
  "pod_name": "minibob-6bf55ff7d9-abc12"
}
```

**Response 201:**
```json
{
  "vessel_id": "minibob-pod-1",
  "registered_at": "2026-03-23T17:30:00Z",
  "heartbeat_interval_seconds": 30
}
```

---

#### POST /v2/vessels/heartbeat

Send heartbeat to maintain vessel liveness.

**Request Body:**
```json
{
  "vessel_id": "minibob-pod-1",
  "status": "active",
  "current_activity": "fix-boredom-trace-storage",
  "metrics": {
    "cpu_percent": 45,
    "memory_mb": 256,
    "active_sessions": 2
  }
}
```

**Response 200:**
```json
{
  "vessel_id": "minibob-pod-1",
  "acknowledged": true,
  "next_heartbeat_due": "2026-03-23T17:31:00Z"
}
```

---

#### GET /v2/vessels/status

List active vessels and their status.

**Response 200:**
```json
{
  "vessels": [
    {
      "vessel_id": "minibob-pod-1",
      "vessel_type": "minibob",
      "status": "active",
      "last_heartbeat": "2026-03-23T17:30:00Z",
      "current_activity": "fix-boredom-trace-storage",
      "uptime_seconds": 3600
    }
  ],
  "total": 1
}
```

---

### 8. Ribosome (Template Extraction)

#### POST /v2/ribosome/extract

Extract successful execution into reusable template.

**Request Body:**
```json
{
  "execution_id": "exec-uuid",
  "template_name": "fix-common-error-pattern",
  "generalization_level": "high",
  "extract_impulses": true
}
```

**Response 201:**
```json
{
  "variant_id": "new-variant-uuid",
  "activity_id": "fix-common-error-pattern",
  "variant_name": "v1-extracted",
  "extraction_quality_score": 0.88,
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

#### POST /v2/ribosome/extract-from-session

Extract multiple executions from a session into template sequence.

**Request Body:**
```json
{
  "session_id": "session-uuid",
  "sequence_name": "complete-feature-workflow",
  "min_success_rate": 0.8
}
```

**Response 201:**
```json
{
  "sequence_template_id": "seq-template-uuid",
  "templates_extracted": 3,
  "quality_score": 0.85,
  "created_at": "2026-03-23T17:30:00Z"
}
```

---

### 9. Session Management

#### POST /v2/session

Create new session.

**Request Body:**
```json
{
  "project_id": "devbob",
  "user_id": "user-uuid",
  "metadata": {
    "source": "dashboard",
    "initial_goal": "Fix boredom activities"
  }
}
```

**Response 201:**
```json
{
  "session_id": "session-uuid",
  "session_token": "token-for-auth",
  "created_at": "2026-03-23T17:30:00Z",
  "expires_at": "2026-03-24T17:30:00Z"
}
```

---

#### GET /v2/session

Get current session info.

**Response 200:**
```json
{
  "session_id": "session-uuid",
  "project_id": "devbob",
  "user_id": "user-uuid",
  "created_at": "2026-03-23T17:30:00Z",
  "last_activity": "2026-03-23T17:30:00Z",
  "expires_at": "2026-03-24T17:30:00Z"
}
```

---

## Performance Targets

**Response Times:**
- Health check: P50 < 50ms, P99 < 200ms
- Template retrieval (cached): P50 < 20ms, P99 < 100ms
- Template retrieval (uncached): P50 < 150ms, P99 < 500ms
- Impulse resolution: P50 < 100ms, P99 < 300ms
- Execution trace storage: P50 < 200ms, P99 < 800ms
- Thompson Sampling recommendation: P50 < 150ms, P99 < 400ms

**Throughput:**
- 100 req/s sustained per replica
- 200 req/s burst per replica

**Availability:**
- 99.9% uptime (excluding planned maintenance)
- Graceful degradation when dependencies unavailable

---

## Error Responses

**Standard Error Format:**
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  },
  "timestamp": "2026-03-23T17:30:00Z"
}
```

**Common Error Codes:**
- `401 Unauthorized` - Missing or invalid authentication
- `400 Bad Request` - Invalid request body/parameters
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Unexpected server error
- `503 Service Unavailable` - Dependency unhealthy

---

## WebSocket Events

**Connection:** `ws://api.minibob.local/ws`

**Events Broadcast:**
```json
{
  "event": "execution_completed",
  "data": {
    "execution_id": "exec-uuid",
    "variant_id": "variant-uuid",
    "success": true,
    "duration_ms": 45000
  },
  "timestamp": "2026-03-23T17:30:00Z"
}
```

**Event Types:**
- `execution_started`
- `execution_completed`
- `execution_failed`
- `template_created`
- `template_updated`
- `boredom_task_completed`

---

## Database Schema

**SurrealDB Tables Used:**
- `activity_templates` - Template definitions
- `variant_performance_metrics` - Thompson Sampling data
- `activity_execution_traces` - Full execution history
- `impulse_data` - Stored impulses
- `composition_records` - Activity dependencies
- `impulse_relevance_metrics` - Learning data
- `tool_usage_patterns` - Tool usage analytics
- `execution_sequences` - Sequential patterns
- `boredom_queue` - Autonomous task queue
- `vessel_registry` - Active vessels

**See:** `openspec/contracts/surrealdb-schema.md` for complete schema

---

## Deployment

**Helm Chart:** `helm/charts/metabob-activity-api`

**Environment Variables:**
```bash
SURREALDB_URL=http://surrealdb.activity-system.svc.cluster.local:8000
SURREALDB_NAMESPACE=activity-system
SURREALDB_DATABASE=learning_loop
SURREALDB_USERNAME=root
SURREALDB_PASSWORD=<secret>
REDIS_URL=redis://redis-valkey.activity-system.svc.cluster.local:6379
PORT=8080
LOG_LEVEL=INFO
CORS_ORIGINS=*
```

**Health Probes:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## Migration Notes

**From Python RPC API:**
- All v2 endpoints maintain compatibility
- Response formats identical
- WebSocket events added (new feature)
- Performance improved (Node.js → Bun)

**Breaking Changes:**
- None (fully backward compatible)

---

## Change Log

**1.0.0** (2026-03-23)
- Initial contract based on operational implementation
- Documented all existing endpoints
- Added WebSocket event streaming
- Established performance targets
