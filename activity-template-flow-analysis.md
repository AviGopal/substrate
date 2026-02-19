# Activity Template Data Flow Analysis

## Architecture

```
OpenCode (TypeScript)
  ├─ templates/ (JSON files)
  │   ├─ built-in/*.json
  │   └─ custom/*.json
  │
  ├─ ActivityTemplateRepository.load()
  │   → Reads JSON from filesystem
  │   → Validates schema
  │   → Stores in memory cache
  │
  └─ activity tool execution
      ↓ (MCP tool call OR direct execution)
      
metabob-cli MCP Server (Python)
  ├─ metabob_activity tool
  │   → Receives template_id + variables
  │   → Orchestrates multi-step execution
  │   → Calls metabob_report_execution
  │
  └─ metabob_report_execution tool
      ↓ (REST API)
      
Backend API (FastAPI)
  └─ POST /api/activity-execution
      ↓ (SQL INSERT)
      
SurrealDB
  ├─ activity_executions (execution results)
  └─ activity_variants (template stats)
```

## Data Flow Stages

### Stage 1: Template Storage (Filesystem)
**Location**: `repos/metabob-opencode/packages/opencode/templates/`
**Format**: JSON files
**Fields**:
- name, version, description, category
- tasks[], contextRequirements[]
- integration{}, metabob{}

### Stage 2: Template Loading (OpenCode)
**Component**: ActivityTemplateRepository
**Method**: `load(templateId)`
**Output**: ActivityTemplate object (in-memory)

### Stage 3: Template Execution (OpenCode/MCP)
**Component**: activity tool OR metabob_activity MCP tool
**Input**: {templateId, variables, reason}
**Output**: Execution results

### Stage 4: Execution Recording (Backend API)
**Endpoint**: POST /api/activity-execution
**Payload**:
```json
{
  "activity_id": "exec_abc123",
  "template_id": "add-feature-complete",
  "success": true,
  "duration": 45000,
  "cost": 0.15,
  "tokens": {"input": 8000, "output": 2000, "cache": 5000},
  "errors": ""
}
```

### Stage 5: Persistence (SurrealDB)
**Table**: activity_executions
**Fields**: activity_id, template_id, success, duration, cost, tokens, errors, timestamp

## Tracing Strategy

### Trace ID Field
- **Primary**: `activity_id` (unique execution identifier)
- **Secondary**: `template_id` (template name)

### Source Origin Field
- **Field**: `template_id` (which template generated this execution)
- **Example**: "add-feature-complete", "fix-bug-complete"

### Timestamp Field
- **Field**: `timestamp` or `created_at`
- **Format**: ISO 8601 datetime

## Test Data Structure

For activity template flow validation:

```json
{
  "activity_id": "test-activity-exec-1771502517",
  "template_id": "test-template",
  "success": true,
  "duration": 5000,
  "cost": 0.05,
  "tokens": {
    "input": 1000,
    "output": 500,
    "cache": 200
  },
  "errors": "",
  "source_origin": "validate-data-flow-test"
}
```

## Validation Points

1. **Template Exists**: File exists in templates/ directory
2. **Template Valid**: JSON schema validates
3. **Template Loads**: ActivityTemplateRepository.load() succeeds
4. **Execution Records**: POST /api/activity-execution returns 200
5. **Database Persists**: SELECT from activity_executions returns record

## Current Status

- ✅ Tables exist: activity_executions, activity_variants
- ✅ Backend API endpoint working: /api/activity-execution
- ⚠️ Tables empty (no test data yet)
- ⚠️ Need to trace: template → execution → database

## Next Steps

Run validate-data-flow template with:
- dataFlowName: "activity-template-system"
- sourceComponent: "OpenCode templates/"
- processingLayers: "ActivityTemplateRepository → activity tool → Backend API"
- targetDatabase: "SurrealDB"
- targetTable: "activity_executions"
- traceIdField: "activity_id"
- sourceOriginField: "template_id"
- timestampField: "timestamp"
