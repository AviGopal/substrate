# Activity Data Flow Traceability Guide

## Overview

This document traces the complete data flow from activity invocations through storage to UI rendering. It provides a comprehensive mapping of how activity data flows through the system, enabling accurate debugging and validation of displayed information.

**Generated**: 2026-03-07  
**Purpose**: Enable tracing from rendered UI elements back to source data and commands  
**Scope**: Activity invocations, impulses, tasks, outcomes, variants, cost, and compositions

---

## Data Flow Architecture

```
┌─────────────────────┐
│  OpenCode CLI/SDK   │
│  (Activity Tool)    │
└──────────┬──────────┘
           │
           │ 1. Execute Activity
           ▼
┌─────────────────────┐
│  Activity Executor  │
│  (activity.ts)      │
└──────────┬──────────┘
           │
           │ 2. Create Activity Record
           ▼
┌─────────────────────┐
│  Local Storage      │
│  ~/.local/share/    │
│  opencode/storage/  │
│  activity/          │
└──────────┬──────────┘
           │
           │ 3. Sync to Backend
           ▼
┌─────────────────────┐
│  RPC API            │
│  (FastAPI)          │
│  /api/activity-     │
│  execution          │
└──────────┬──────────┘
           │
           │ 4. Store Persistently
           ▼
┌─────────────────────┐
│  SurrealDB          │
│  activity_execution │
│  table              │
└──────────┬──────────┘
           │
           │ 5. Query for Display
           ▼
┌─────────────────────┐
│  Dashboard API      │
│  /analytics/        │
│  executions         │
└──────────┬──────────┘
           │
           │ 6. Render UI
           ▼
┌─────────────────────┐
│  Dashboard UI       │
│  (React)            │
└─────────────────────┘
```

---

## Storage Layer Mapping

### 1. Local Storage Structure

**Location**: `~/.local/share/opencode/storage/activity/`

**File Pattern**: `act_<id>_<hash>.json`

**Structure**:
```typescript
interface ActivityExecution {
  // Identity
  id: string;                    // Example: "act_mm6zhphh_3d9434c8ea953de4"
  templateId: string;            // Example: "trace-enforce-validate-loop"
  templateVersion: number;       // Example: 0
  
  // Metadata
  title: string;                 // Human-readable name
  status: string;                // "setup" | "executing" | "done" | "failed"
  directory: string;             // Working directory
  branch: string;                // Git branch
  baseCommit: string;            // Git commit hash
  
  // Timing
  startedAt: number;             // Unix timestamp (ms)
  completedAt?: number;          // Unix timestamp (ms)
  
  // User Context
  reason: string;                // Why this activity was invoked
  variables: Record<string, any>; // Template variable values
  
  // Selection
  selection_reason: {
    method: string;              // "direct_load" | "thompson_sampling"
    selectedId: string;          // Template ID selected
    variant: string;             // "stable" | "candidate"
  };
  
  // Execution Evidence
  executionEvidence: {
    sessionsSpawned: Array<{
      sessionID: string;
      taskId: string;
      agentType: string;
      startTime: number;
      endTime: number;
      messageCount: number;
      toolCallCount: number;
    }>;
    toolCalls: Array<{
      sessionID: string;
      tool: string;
      timestamp: number;
    }>;
  };
  
  // Statistics
  stats: {
    tokens: {
      input: number;
      output: number;
      reasoning: number;
      cache: { read: number; write: number };
    };
    cost: {
      total: number;
      perPrompt: number[];
    };
    metabob: {
      enabled: boolean;
      issuesResolved: number;
      issuesAdded: number;
      totalParticipations: number;
      totalContextTokens: number;
    };
    duration: number;
  };
  
  // Impulses
  impulses: Record<string, {
    id: string;
    type: string;
    pointer: any;
    budget: number;
  }>;
  
  // Work Artifacts
  workArtifacts: {
    filesChanged: string[];
    commitsMade: string[];
  };
  
  // Quality Assessment
  correctnessVerdict?: {
    computed: boolean;
    verdict: "correct" | "incorrect" | "unknown";
    confidence: number;
    issues: Array<{
      severity: string;
      category: string;
      message: string;
    }>;
  };
  
  // References
  sessionIDs: string[];
  commits: string[];
  agentsUsed: string[];
  acpAgents: any[];
  callingSessionId?: string;
}
```

### 2. Template Storage Structure

**Location**: `~/.local/share/opencode/storage/activity-template/`

**File Pattern**: `<template-id>.json`

**Structure**:
```typescript
interface ActivityTemplate {
  // Identity
  id: string;                    // Example: "trace-enforce-validate-loop"
  name: string;                  // Human-readable name
  category: string;              // "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  status: string;                // "stable" | "candidate" | "deprecated"
  
  // Version Control
  version: {
    timestamp: number;
    parent_hash: string;
    variant_hash: string;
    full_version: string;
    generation: number;
  };
  
  // Genealogy
  genealogy: {
    created_at: number;
    parent_id: string;
    variant_hash: string;
    generation: number;
    evolution: {
      reason: string;            // Why this version was created
      improvised: boolean;
      author: string;
      notes: string;
    };
    variant_ids: string[];       // Other variants of this template
  };
  
  // Metrics
  executions: number;            // Total execution count
  successRate: number;           // Success rate (0-1)
  avgDuration: number;           // Average duration (ms)
  avgCost: number;               // Average cost ($)
  avgTokens: {
    input: number;
    output: number;
    cache: number;
  };
  
  // Task Composition
  tasks: Array<{
    id: string;
    subagent: string;            // "general" | "config" | "test" | etc.
    description: string;
    dependencies: string[];      // Task IDs this depends on
    tools: {
      required: string[];
      optional: string[];
      disabled: string[];
    };
    prompt: {
      template: string;          // Prompt template with {{variables}}
      maxTokens: number;
      compressionStrategy: string;
      variables: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
      }>;
    };
    validation: {
      requiredFiles: string[];
      requiredPatterns: string[];
      forbiddenPatterns: string[];
      commands: string[];
    };
    retry: {
      maxAttempts: number;
      strategy: string;
    };
    metrics: {
      successRate: number;
      avgTokens: number;
      avgDuration: number;
      commonFailures: string[];
    };
  }>;
  
  // Variant Management
  candidateIds: string[];
  allocationWeight: number;
}
```

---

## Command Traceability

### Invoking an Activity

**From CLI**:
```bash
opencode activity \
  --template trace-enforce-validate-loop \
  --variable specificationName="surrealdb-primary-redis-cache" \
  --variable specificationDescription="..." \
  --variable expectedBehavior="..." \
  --variable validationStrategy="..." \
  --reason "Enforce storage architecture"
```

**From Code (TypeScript)**:
```typescript
import { activity } from '@/tool/activity';

const result = await activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'surrealdb-primary-redis-cache',
    specificationDescription: '...',
    expectedBehavior: '...',
    validationStrategy: '...'
  },
  reason: 'Enforce storage architecture'
});
```

**From Tool Call (in Agent Session)**:
```json
{
  "tool": "activity",
  "parameters": {
    "templateId": "trace-enforce-validate-loop",
    "variables": {
      "specificationName": "surrealdb-primary-redis-cache"
    },
    "reason": "Enforce storage architecture"
  }
}
```

### Data Creation Flow

1. **Activity Tool Invoked** (`src/tool/activity.ts`)
   - Receives `templateId`, `variables`, `reason`
   - Loads template from storage
   - Creates activity record with unique ID

2. **Activity Record Created** (`src/session/activity.ts`)
   - Generates ID: `act_<nanoid>_<hash>`
   - Initializes empty stats
   - Sets status to "setup"
   - Writes to local storage

3. **Task Execution** (`src/session/activity.ts`)
   - For each task in template:
     - Spawns sub-agent session
     - Records session metadata in `executionEvidence.sessionsSpawned`
     - Tracks tool calls in `executionEvidence.toolCalls`
     - Updates token/cost stats incrementally

4. **Completion** (`src/session/activity.ts`)
   - Sets status to "done" or "failed"
   - Sets `completedAt` timestamp
   - Finalizes stats
   - Computes correctness verdict
   - Writes final state to storage

5. **Backend Sync** (Optional - if MCP enabled)
   - Calls `metabob_report_execution` MCP tool
   - Sends execution data to RPC API
   - RPC API stores in SurrealDB

---

## Key Data Mappings

### Activity Invocation → Storage Fields

| UI Field | Storage Path | Example Value |
|----------|--------------|---------------|
| Activity ID | `.id` | `act_mm6zhphh_3d9434c8ea953de4` |
| Template Name | `.title` or template`.name` | `trace-enforce-validate-loop` |
| Status | `.status` | `done` / `executing` / `failed` |
| Duration | `.stats.duration` (ms) | `1424656` → "23.74 min" |
| Cost | `.stats.cost.total` ($) | `2.5050` → "$2.51" |
| Tokens (Input) | `.stats.tokens.input` | `750000` |
| Tokens (Output) | `.stats.tokens.output` | `22379` |
| Success Rate | Computed from `.status` across executions | `97.1%` |
| Start Time | `.startedAt` (Unix ms) | `1772323231301` → "2/28/2026" |
| End Time | `.completedAt` (Unix ms) | `1772324656039` |
| Reason | `.reason` | "Enforce storage architecture" |
| Variables | `.variables` | `{ specificationName: "..." }` |

### Task Execution → Storage Fields

| UI Field | Storage Path | Example Value |
|----------|--------------|---------------|
| Task ID | `.executionEvidence.sessionsSpawned[i].taskId` | `phase-1-remove-ml` |
| Task Status | Derived from session timing | "completed" |
| Task Duration | `endTime - startTime` (ms) | `1424685` → "23.74 min" |
| Messages | `.executionEvidence.sessionsSpawned[i].messageCount` | `17` |
| Tool Calls | `.executionEvidence.sessionsSpawned[i].toolCallCount` | `25` |
| Agent Type | `.executionEvidence.sessionsSpawned[i].agentType` | `general` |

### Impulse Usage → Storage Fields

| UI Field | Storage Path | Example Value |
|----------|--------------|---------------|
| Impulse ID | `.impulses[id].id` | `helmfile-config-spec` |
| Impulse Type | `.impulses[id].type` | `file` / `memo` / `activityOutput` |
| Impulse Pointer | `.impulses[id].pointer` | `{ type: "file", path: "..." }` |
| Token Budget | `.impulses[id].budget` | `5000` |

### Tool Usage → Storage Fields

| UI Field | Storage Path | Example Value |
|----------|--------------|---------------|
| Tool Name | `.executionEvidence.toolCalls[i].tool` | `activity` / `bash` / `read` |
| Call Count | Count of matching `.toolCalls` entries | `42` |
| Session | `.executionEvidence.toolCalls[i].sessionID` | `ses_3594da9bbffe...` |
| Timestamp | `.executionEvidence.toolCalls[i].timestamp` | `1772323241767` |

### Composition Patterns → Storage Fields

| UI Field | Storage Path | Detection Logic |
|----------|--------------|-----------------|
| Nested Activities | Filter `.toolCalls` where `.tool === 'activity'` | Count of nested calls |
| Composition Depth | Max nesting level across sessions | `3` levels deep |
| Sub-Activities | Extract `templateId` from nested calls | `["template-a", "template-b"]` |

---

## Backend API Endpoints

### Query Endpoints

**Get All Executions**:
```http
GET /analytics/executions
Response: Array<ActivityExecution>
```

**Get Execution by ID**:
```http
GET /analytics/executions/{execution_id}
Response: ActivityExecution
```

**Get Templates**:
```http
GET /analytics/templates
Response: { templates: Template[], total_templates: number, total_executions: number }
```

**Get Template Metrics**:
```http
GET /api/template/{template_id}/metrics
Response: { success_rate: number, avg_cost: number, avg_duration: number, executions: number }
```

### Write Endpoints

**Record Execution**:
```http
POST /api/activity-execution
Body: {
  activity_id: string,
  template_id: string,
  success: boolean,
  duration: number,
  cost: number,
  tokens: { input: number, output: number, cache: number },
  errors: string
}
Response: { recorded: boolean, execution_id: string, template_id: string }
```

**Update Template Metrics**:
```http
POST /v2/activities/templates/{template_id}/metrics
Body: {
  execution_id: string,
  success: boolean,
  duration: number,
  cost: number,
  tokens: { input: number, output: number }
}
Response: { updated: boolean }
```

---

## SurrealDB Schema

### `activity_execution` Table

```sql
-- Schema
CREATE activity_execution SCHEMAFULL;

DEFINE FIELD execution_id ON activity_execution TYPE string;
DEFINE FIELD template_id ON activity_execution TYPE string;
DEFINE FIELD template_version ON activity_execution TYPE int;
DEFINE FIELD status ON activity_execution TYPE string;
DEFINE FIELD started_at ON activity_execution TYPE datetime;
DEFINE FIELD completed_at ON activity_execution TYPE option<datetime>;
DEFINE FIELD duration_ms ON activity_execution TYPE int;

DEFINE FIELD variables ON activity_execution TYPE object;
DEFINE FIELD reason ON activity_execution TYPE string;

DEFINE FIELD stats ON activity_execution TYPE object;
DEFINE FIELD stats.tokens.input ON activity_execution TYPE int;
DEFINE FIELD stats.tokens.output ON activity_execution TYPE int;
DEFINE FIELD stats.tokens.cache.read ON activity_execution TYPE int;
DEFINE FIELD stats.tokens.cache.write ON activity_execution TYPE int;
DEFINE FIELD stats.cost.total ON activity_execution TYPE float;

DEFINE FIELD impulses ON activity_execution TYPE object;
DEFINE FIELD work_artifacts ON activity_execution TYPE object;
DEFINE FIELD correctness_verdict ON activity_execution TYPE option<object>;

-- Indexes
DEFINE INDEX idx_template_id ON activity_execution FIELDS template_id;
DEFINE INDEX idx_status ON activity_execution FIELDS status;
DEFINE INDEX idx_started_at ON activity_execution FIELDS started_at;
```

### Query Examples

**Get Recent Executions**:
```sql
SELECT * FROM activity_execution 
WHERE template_id = "trace-enforce-validate-loop"
ORDER BY started_at DESC
LIMIT 10;
```

**Aggregate Metrics**:
```sql
SELECT 
  template_id,
  count() AS total_executions,
  math::mean(stats.cost.total) AS avg_cost,
  math::mean(duration_ms) AS avg_duration,
  math::sum(CASE WHEN status = "done" THEN 1 ELSE 0 END) / count() AS success_rate
FROM activity_execution
GROUP BY template_id;
```

---

## Dashboard UI Traceability

### Component Hierarchy

```
ActivityHistoryPage
  ├── ActivitySummaryCards (total executions, cost, success rate)
  │   └── Data: Aggregated from all executions
  ├── ActivityTemplateList
  │   └── ActivityTemplateCard (per template)
  │       ├── Template Name (from template.name)
  │       ├── Execution Count (count of matching executions)
  │       ├── Success Rate (% where status === "done")
  │       ├── Avg Cost (mean of stats.cost.total)
  │       └── Avg Duration (mean of stats.duration)
  └── ActivityExecutionTable (detailed execution list)
      └── ActivityExecutionRow (per execution)
          ├── ID (truncated activity.id)
          ├── Template (activity.templateId)
          ├── Status (activity.status with color coding)
          ├── Duration (formatted stats.duration)
          ├── Cost (formatted stats.cost.total)
          ├── Tokens (sum of input + output)
          └── Date (formatted startedAt)
```

### Data Fetching Flow

1. **Page Load** → Fetch `/analytics/executions`
2. **Parse Response** → Group by `templateId`
3. **Compute Aggregates** → Success rate, avg cost, avg duration
4. **Render Cards** → Display aggregated metrics
5. **Render Table** → Display individual executions
6. **User Clicks Row** → Fetch `/analytics/executions/{id}` for details
7. **Show Modal** → Display full execution data including tasks, impulses, tools

---

## Validation Checklist

Use this checklist to validate data accuracy between storage and UI:

### Summary Metrics

- [ ] **Total Executions**: Count of execution files matches UI count
- [ ] **Total Cost**: Sum of `stats.cost.total` matches UI total
- [ ] **Total Tokens**: Sum of `stats.tokens.input + output` matches UI total
- [ ] **Success Rate**: Percentage where `status === "done"` matches UI rate

### Template Metrics

- [ ] **Execution Count**: Files with matching `templateId` matches UI count
- [ ] **Success Count**: Files with `templateId` and `status === "done"` matches UI
- [ ] **Avg Cost**: Mean of `stats.cost.total` for templateId matches UI avg
- [ ] **Avg Duration**: Mean of `stats.duration` for templateId matches UI avg

### Execution Details

- [ ] **Activity ID**: Storage `.id` matches UI displayed ID
- [ ] **Status**: Storage `.status` matches UI status badge color
- [ ] **Duration**: Storage `.stats.duration` (ms) matches UI formatted duration
- [ ] **Cost**: Storage `.stats.cost.total` matches UI displayed cost
- [ ] **Tokens**: Storage `.stats.tokens.input + .output` matches UI token count
- [ ] **Start Date**: Storage `.startedAt` (Unix ms) matches UI formatted date

### Task Execution

- [ ] **Task Count**: Length of `.executionEvidence.sessionsSpawned` matches UI
- [ ] **Task IDs**: Each `.taskId` in sessionsSpawned matches UI task list
- [ ] **Task Duration**: `endTime - startTime` matches UI task duration
- [ ] **Messages**: `.messageCount` matches UI message count
- [ ] **Tool Calls**: `.toolCallCount` matches UI tool usage count

### Impulses

- [ ] **Impulse Count**: Object.keys(`.impulses`).length matches UI count
- [ ] **Impulse IDs**: Each impulse key matches UI impulse list
- [ ] **Impulse Types**: `.impulses[id].type` matches UI type label

### Tool Usage

- [ ] **Tool Names**: Unique `.executionEvidence.toolCalls[].tool` matches UI
- [ ] **Call Counts**: Count per tool matches UI usage count
- [ ] **Tool Distribution**: Percentage breakdown matches UI chart

---

## Debugging Guide

### Common Issues

**Issue**: UI shows different execution count than storage

**Debug Steps**:
1. Count files: `ls ~/.local/share/opencode/storage/activity/*.json | wc -l`
2. Count subdirectories: `find ~/.local/share/opencode/storage/activity -name "*.json" | wc -l`
3. Check API: `curl http://localhost:8080/analytics/executions | jq '. | length'`
4. Compare counts

**Issue**: Cost/token metrics don't match

**Debug Steps**:
1. Read execution file: `cat ~/.local/share/opencode/storage/activity/act_*.json`
2. Extract stats: `jq '.stats' <file>`
3. Verify API response: `curl http://localhost:8080/analytics/executions/<id> | jq '.stats'`
4. Check UI calculation logic

**Issue**: Tasks not showing in UI

**Debug Steps**:
1. Check `executionEvidence.sessionsSpawned`: `jq '.executionEvidence.sessionsSpawned' <file>`
2. Verify session IDs exist: `jq '.sessionIDs' <file>`
3. Check task count matches session count
4. Verify UI is parsing `sessionsSpawned` array

---

## Example: Full Trace

Let's trace a single execution from command to UI:

### 1. Command Invocation

```bash
opencode activity \
  --template trace-enforce-validate-loop \
  --variable specificationName="surrealdb-primary-redis-cache" \
  --reason "Enforce storage architecture"
```

### 2. Storage File Created

**File**: `~/.local/share/opencode/storage/activity/5a663c16ed174f011286a37c5e65ff7a9a5bc940/act_mm6zhphh_3d9434c8ea953de4.json`

**Content** (abbreviated):
```json
{
  "id": "act_mm6zhphh_3d9434c8ea953de4",
  "templateId": "trace-enforce-validate-loop",
  "title": "Enforce Architecture Separation",
  "status": "done",
  "startedAt": 1772323231301,
  "completedAt": 1772324656039,
  "stats": {
    "tokens": { "input": 750000, "output": 22379 },
    "cost": { "total": 2.5050 },
    "duration": 1424738
  },
  "variables": {
    "specificationName": "surrealdb-primary-redis-cache"
  },
  "reason": "Enforce storage architecture",
  "executionEvidence": {
    "sessionsSpawned": [
      {
        "taskId": "trace-specification",
        "startTime": 1772323231808,
        "endTime": 1772323856039,
        "messageCount": 17,
        "toolCallCount": 8
      }
    ]
  }
}
```

### 3. API Query

```http
GET /analytics/executions
```

**Response**:
```json
[
  {
    "execution_id": "act_mm6zhphh_3d9434c8ea953de4",
    "template_id": "trace-enforce-validate-loop",
    "status": "done",
    "duration_ms": 1424738,
    "cost": 2.5050,
    "tokens": { "input": 750000, "output": 22379 }
  }
]
```

### 4. UI Rendering

**ActivityTemplateCard**:
- Template Name: "Enforce Architecture Separation"
- Executions: 1
- Success Rate: 100%
- Avg Cost: $2.51
- Avg Duration: 23.74 min

**ActivityExecutionRow**:
- ID: `act_mm6zhp...`
- Status: ✅ Done
- Duration: 23.74m
- Cost: $2.51
- Tokens: 772,379
- Date: 2/28/2026

### 5. Validation

```bash
# Verify file exists
ls -lh ~/.local/share/opencode/storage/activity/5a663c16ed174f011286a37c5e65ff7a9a5bc940/act_mm6zhphh_3d9434c8ea953de4.json

# Extract cost
jq '.stats.cost.total' <file>
# Output: 2.505

# Extract duration
jq '.stats.duration' <file>
# Output: 1424738 (ms) = 23.74 min ✓

# Extract tokens
jq '.stats.tokens.input + .stats.tokens.output' <file>
# Output: 772379 ✓
```

---

## Summary

This guide provides complete traceability from:
- ✅ Command invocation → Storage file
- ✅ Storage file → Backend API
- ✅ Backend API → SurrealDB
- ✅ SurrealDB → Dashboard API
- ✅ Dashboard API → UI components
- ✅ UI display ← Storage validation

Use the validation checklist and debugging guide to ensure data accuracy at every step.
