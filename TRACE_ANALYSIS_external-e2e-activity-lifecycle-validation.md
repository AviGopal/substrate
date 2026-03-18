# Trace Analysis: external-e2e-activity-lifecycle-validation

**Date**: 2026-03-18
**Specification**: End-to-end external validation of complete activity lifecycle
**Status**: Analysis Complete - Implementation Required

---

## Executive Summary

This trace identifies the complete implementation path for external E2E validation of the activity lifecycle. The specification requires testing the full flow: **CLI creates template → DB stores template → CLI executes template → DB records execution** using only compiled binary and direct database queries (no code access).

**Current State**: Partial external validation exists but does NOT verify database storage or template execution.

**Gap**: Need to implement complete E2E harness with DB verification.

---

## Specification Overview

**Goal**: Prove the complete activity lifecycle works end-to-end by:

1. Creating activity template via CLI (compiled binary only)
2. Verifying template stored in SurrealDB via direct SQL queries
3. Executing the created template via CLI
4. Verifying execution results stored in SurrealDB
5. Analyzing logs for errors
6. Reporting PASS/FAIL with evidence

**Validation Type**: Black-box external testing (no code instrumentation)

---

## Component Trace Summary

| Component | File | Current State | Gap |
|-----------|------|---------------|-----|
| CLI Commands | `cli/cmd/activity.ts` | Has list/search/run | Missing create command |
| Template Registration | `tool/register-activity-template.ts` | Saves to local + backend | Need to verify backend flow |
| Template Repository | `session/activity-template-repository.ts` | Manages storage | Need to trace API call |
| Activity Execution | `tool/activity.ts` | Executes templates | Need to verify metrics posting |
| Metrics Client | `session/template-metrics-client.ts` | Posts results | Need to verify API endpoint |
| Database Schema | `scripts/init-surrealdb-devbob-schema-v2.sql` | Complete ✅ | None |

---

## Data Flow Trace

### Template Creation Flow
```
Entry Point: CLI 'opencode activity create'
  ↓
create_activity_goal_seeking tool
  ↓
ActivityTemplate.create() [generates ID from name]
  ↓
TemplateRepository.save(template, ["metabob"])
  ↓
Backend API: POST /v2/activity-templates
  ↓
SurrealDB: INSERT INTO activity_template
```

### Template Execution Flow
```
Entry Point: CLI 'opencode activity <template-id>'
  ↓
ActivityTool.execute()
  ↓
Activity.create() + task execution
  ↓
Activity.save() [local storage]
  ↓
TemplateMetricsClient.postResult()
  ↓
Backend API: POST /v2/activities
  ↓
SurrealDB: INSERT INTO activity_execution
```

---

## Identified Gaps

### GAP-1: CLI Template Creation Command
**Impact**: HIGH  
**Status**: Need to verify if 'activity create' subcommand exists or if we need alternative approach

### GAP-2: Backend Persistence Path (Templates)
**Impact**: HIGH  
**Status**: Need to trace `TemplateRepository.save()` → Backend API → SurrealDB

### GAP-3: Backend Persistence Path (Executions)
**Impact**: HIGH  
**Status**: Need to trace `TemplateMetricsClient.postResult()` → Backend API → SurrealDB

### GAP-4: SurrealDB Connection Details
**Impact**: MEDIUM  
**Status**: Need connection info from deployment config

---

## External Validation Test Flow

### Phase 1: Template Creation Test
1. Execute: `./opencode activity create --name "E2E Test" --category feature --goal "Simple task"`
2. Extract template ID from output
3. Query DB: `surreal sql 'SELECT * FROM activity_template WHERE id = "<id>"'`
4. Verify: Record exists with correct name, category, tasks
5. Result: PASS/FAIL

### Phase 2: Template Execution Test
1. Execute: `./opencode activity <template-id> --variables '{}' --reason "E2E test"`
2. Extract activity ID from output
3. Query DB: `surreal sql 'SELECT * FROM activity_execution WHERE template_id = "<id>"'`
4. Verify: Record exists with status=completed, duration_ms > 0
5. Result: PASS/FAIL

### Phase 3: Log Analysis
1. Collect logs from CLI output
2. Check for errors: `grep -i error <log-file>`
3. Verify lifecycle events present
4. Result: PASS/FAIL

### Overall Result
- All 3 phases PASS → **COMPLETE LIFECYCLE VALIDATED** ✅
- Any phase FAIL → **INVESTIGATION REQUIRED** ❌

---

## Implementation Plan

### Step 1: Create E2E Harness
**File**: `tests/validation-harnesses/external-e2e-activity-lifecycle-validation-harness.ts`

**Features**:
- Execute CLI commands via `spawn()`
- Query SurrealDB via `surreal sql` CLI
- Parse DB query results (JSON format)
- Verify data integrity
- Report results with evidence

### Step 2: Add Database Query Helpers
```typescript
async function querySurrealDB(query: string): Promise<any[]> {
  // Execute: surreal sql --conn <url> --query <query> --json
  // Parse JSON output
  // Return results
}
```

### Step 3: Implement Test Phases
- Phase 1: Template creation + DB verification
- Phase 2: Template execution + DB verification
- Phase 3: Log analysis

### Step 4: Integration Script
**File**: `scripts/run-external-e2e-validation.sh`

**Flow**:
1. Build OpenCode distribution
2. Run E2E harness
3. Collect results
4. Generate evidence report

---

## Success Criteria

✅ **Template Creation**: CLI creates template, DB query returns correct record  
✅ **Template Execution**: CLI executes template without errors  
✅ **Execution Storage**: DB query returns execution record with correct data  
✅ **Logs Clean**: No errors in logs, lifecycle events present  

**Overall**: All 4 criteria met = **COMPLETE LIFECYCLE VALIDATED** ✅

---

## Next Steps

1. ✅ Complete trace analysis (DONE)
2. ⏭️ Verify CLI template creation command
3. ⏭️ Trace backend persistence paths
4. ⏭️ Get SurrealDB connection details
5. ⏭️ Implement E2E validation harness
6. ⏭️ Test in devbob environment
7. ⏭️ Document results

---

## Impulse Data

**Impulse ID**: `trace-external-e2e-activity-lifecycle-validation`  
**Type**: `templateDefinition` (trace analysis)  
**Budget**: 5000 tokens  
**Location**: `impulses/trace-external-e2e-activity-lifecycle-validation.json`

---

**Analysis Complete** ✅  
**Ready for Implementation** 🚀
