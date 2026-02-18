# Activity Template Self-Healing: Current State & Gaps Analysis

**Date**: February 16, 2026  
**Goal**: Activity templates that can diagnose and repair themselves  
**Status**: Foundation exists, but critical gaps prevent full autonomy

---

## Executive Summary

###  Current State
- ✅ **Foundational templates exist**: `debug-activity-self-contained`, `evolve-activity-self-contained`
- ✅ **Error inspection tool**: `activity_error_inspector` extracts failure details
- ✅ **Replay capability**: `activity_replay` allows resuming from failure points
- ⚠️ **Backend API integration**: Partially implemented, needs production endpoints
- ❌ **Template versioning**: Simple integers, not genealogy-based
- ❌ **Trailblazing**: Not yet implemented
- ❌ **Automated learning loop**: Manual intervention still required

### Critical Gaps (Blocking Full Self-Healing)

1. **Template Versioning Non-Compliant** (CRITICAL) - Can't track evolution lineage
2. **Storage Fragmentation** (CRITICAL) - Multiple sources of truth cause conflicts
3. **No Trailblazing Implementation** (HIGH) - Can't auto-recover from failures
4. **Backend API Gaps** (HIGH) - Missing execution history and metrics endpoints
5. **No Automated Learning Loop** (MEDIUM) - Diagnosis→Evolution→Test cycle is manual

---

## Current Implementation Status

### ✅ What We Have

#### 1. Debug Template (`debug-activity-self-contained.json`)

**Purpose**: Diagnose why activities fail

**Capabilities**:
- Fetches execution details from backend API
- Analyzes failure patterns and identifies root cause
- Generates concrete fixes (template changes, input fixes, retries)
- Creates comprehensive diagnosis report

**Tasks**:
1. `fetch-execution-details` - Query backend for execution metadata
2. `analyze-failure-patterns` - Root cause analysis
3. `generate-fixes` - Propose actionable fixes
4. `create-diagnosis-report` - Comprehensive summary

**Strengths**:
- ✅ Self-contained (no local file dependencies)
- ✅ API-first design (queries backend for data)
- ✅ Structured output (markdown reports)
- ✅ Composable (pairs with evolve-activity)

**Limitations**:
- ⚠️ Assumes backend API endpoints exist (many don't yet)
- ⚠️ No automated fix application (generates recommendations only)
- ⚠️ No validation of fixes before recommending

#### 2. Evolve Template (`evolve-activity-self-contained.json`)

**Purpose**: Improve templates based on execution metrics

**Capabilities**:
- Fetches template definition and metrics from backend
- Identifies high-impact improvements (ROI analysis)
- Generates new template variant with changes applied
- Documents evolution with change rationale

**Tasks**:
1. `fetch-template-and-metrics` - Get current template + execution stats
2. `identify-improvements` - Prioritize changes by ROI
3. `create-improved-template` - Generate new variant
4. `document-evolution` - Evolution report

**Strengths**:
- ✅ Data-driven improvements (based on real metrics)
- ✅ ROI prioritization (quick wins first)
- ✅ Generates valid JSON (validated structure)
- ✅ Documents rationale (future reference)

**Limitations**:
- ⚠️ Assumes backend provides metrics (success rate, cost, duration)
- ⚠️ No automated registration of improved template
- ⚠️ No A/B testing framework
- ⚠️ No automated rollback on regression

#### 3. Error Inspector Tool (`activity_error_inspector.ts`)

**Purpose**: Extract detailed error context from failed activities

**Capabilities**:
- Finds most recent failed activity (if ID not provided)
- Extracts task-level failure details
- Includes session logs and tool call traces
- Surfaces validation failures

**Implementation**:
```typescript
// Finds activity by ID or most recent failed
async function findActivity(activityId?: string): Promise<Activity | null>

// Analyzes activity errors with detailed context
async function analyzeActivityErrors({
  activity,
  template,
  includeSessionLogs,
  includeToolCalls,
  maxMessagesPerTask
}): Promise<ErrorReport>

// Formats error report as markdown
function formatErrorReport(report: ErrorReport): string
```

**Strengths**:
- ✅ Provides rich error context
- ✅ Includes session message timeline
- ✅ Tracks tool call inputs/outputs/errors
- ✅ Accessible as MCP tool

**Limitations**:
- ⚠️ Limited to in-memory activities (no backend query yet)
- ⚠️ No pattern recognition across multiple failures
- ⚠️ No automatic fix suggestion

#### 4. Replay Tool (`activity_replay.ts`)

**Purpose**: Resume failed activities from specific tasks

**Capabilities**:
- Resume from first failed task or specific task ID
- Override variables for retry
- Skip validation if needed
- Reuse impulses from original execution

**Implementation**:
```typescript
export const ActivityReplayTool = Tool.define("activity_replay", async () => {
  // Parameters: activityId, startFromTask, overrideVariables, skipValidation
  // Creates new activity linked to original
  // Preserves context (impulses, prior task results)
})
```

**Strengths**:
- ✅ Saves tokens by not re-running successful tasks
- ✅ Allows variable adjustment
- ✅ Preserves original activity state

**Limitations**:
- ⚠️ Manual invocation only (no auto-retry)
- ⚠️ No smart retry strategies (exponential backoff, etc.)
- ⚠️ No learning from replay outcomes

---

## Critical Gaps Preventing Self-Healing

### Gap 1: Template Versioning Non-Compliant ⚠️ CRITICAL

**Problem**: Current versioning is simple integers, not proto-compliant genealogy

**Current State**:
```json
{
  "id": "my-template",
  "version": 2,  // Simple integer
  "name": "My Template"
}
```

**Required State** (per proto/common/types.proto):
```json
{
  "id": "my-template",
  "version": {
    "timestamp": 1739750000000,
    "parent_hash": "abc123...",
    "variant_hash": "def456...",
    "full_version": "1739750000000:abc123:def456",
    "generation": 2
  },
  "genealogy": {
    "created_at": "2026-02-16T00:00:00Z",
    "parent_id": "my-template:1739740000000:parent:variant",
    "variant_hash": "def456...",
    "generation": 2,
    "evolution": {
      "reason": "Increased token budget for task-4",
      "based_on_execution": "exec-abc123",
      "improvised": false,
      "author": "evolve-activity-self-contained"
    },
    "variant_ids": []  // Child variants
  }
}
```

**Impact**:
- ❌ Can't track which variant came from trailblazing
- ❌ Can't trace template ancestry
- ❌ Can't manage multiple variants of same template
- ❌ Version conflicts (v1 in storage, v2 in built-in)
- ❌ No evolution metadata (why changed, by whom, based on what)

**Solution Required**:
1. Implement `Version` and `TemplateGenealogy` TypeScript types
2. Generate version strings: `timestamp:parentHash:variantHash`
3. Track parent-child relationships
4. Store evolution metadata (reason, execution_id, author)
5. Update `evolve-activity` to generate proper genealogy

**Files to Modify**:
- `src/session/activity-template.ts` - Add Version and Genealogy types
- `src/session/activity-template-repository.ts` - Handle genealogy in storage
- `templates/built-in/evolve-activity-self-contained.json` - Output genealogy
- `src/tool/register-activity-template.ts` - Validate genealogy on registration

---

### Gap 2: Storage Fragmentation ⚠️ CRITICAL

**Problem**: Multiple conflicting sources cause stale templates to be used

**Current State**:
- `~/.local/share/opencode/storage/activity-template/` (runtime cache)
- `templates/built-in/` (plain JSON files)
- `templates/opencode-dev/` (plain JSON files)
- Load priority: **storage → built-in → metabob** (WRONG)

**Evidence of Problem**:
- `create-activity-template` v1 (broken) in storage overrides v2 (working) in built-in
- No team synchronization (Alice's improvements don't reach Bob)
- Manual file editing required
- Stale templates served after improvements

**Required Architecture** (per proto/service/template.proto):

```
Single Source of Truth: Metabob TemplateService (Backend API)
         ↓
Local Cache (read-through, time-based invalidation)
         ↓
Application (never reads files directly, except bootstrap)
```

**Correct Load Priority**:
1. **Metabob TemplateService** (backend API) - Single source of truth
2. **Local Cache** (if backend unavailable AND cache fresh)
3. **Error** (if both unavailable)

**Bootstrap Exception**: Built-in templates are **only** used for initial installation

**Impact**:
- ❌ Version conflicts
- ❌ No team collaboration
- ❌ Stale improvements
- ❌ Manual file manipulation
- ❌ No centralized metrics

**Solution Required**:
1. Implement TemplateService client (`src/backend/template-service-client.ts`)
2. Update TemplateRepository to prioritize backend
3. Implement cache invalidation (TTL or event-based)
4. Remove direct file-based loading (except bootstrap)
5. Update `evolve-activity` to register improvements with backend

**Files to Modify**:
- `src/session/activity-template-repository.ts` - Backend-first loading
- `src/backend/template-service-client.ts` - NEW: gRPC/REST client
- `src/tool/register-activity-template.ts` - Register with backend
- `templates/built-in/evolve-activity-self-contained.json` - Auto-register output

---

### Gap 3: No Trailblazing Implementation ⚠️ HIGH

**Problem**: Can't auto-recover from activity failures

**Trailblazing Concept** (from proto/activity/activity.proto):
> When an activity task fails, generate a recovery prompt for the agent to continue  
> This creates new template variants through improvisation

**Expected Behavior**:
```
Activity Execution:
  Task 1: ✅ SUCCESS
  Task 2: ✅ SUCCESS
  Task 3: ❌ FAILED - "File not found: output.json"
  
Trailblazing Mode ENABLED:
  → Generate recovery prompt:
    "Task 3 failed because output.json doesn't exist.
     Previous tasks created data.json in /tmp/activity-123/.
     Adjust your approach to use the actual output location."
  
  → Agent retries with context: ✅ SUCCESS
  
  → Mark improvisation in template genealogy
  → Create variant: "my-template:timestamp:parent:trailblaze-hash"
  → Evolution reason: "Auto-recovered from file path error"
```

**Current State**:
- ❌ Not implemented at all
- ❌ Activity fails and stops
- ❌ No recovery prompt generation
- ❌ No variant creation from improvisation

**Solution Required**:
1. Add trailblazing parameters to `activity` tool:
   ```typescript
   trailblazing: {
     enabled: boolean,
     maxCostPerTask: number,
     maxTotalCost: number,
     maxRecoveryAttempts: number
   }
   ```

2. Implement recovery prompt generation:
   ```typescript
   async function generateRecoveryPrompt(
     failedTask: Task,
     error: Error,
     previousTaskOutputs: Output[]
   ): Promise<string>
   ```

3. Track improvisations in activity state:
   ```typescript
   activity.improvisations.push({
     taskId: "task-3",
     attemptNumber: 1,
     originalError: "File not found",
     recoveryPrompt: "...",
     outcome: "success"
   })
   ```

4. Generate variant after successful recovery:
   ```typescript
   await TemplateRepository.createVariant({
     parentId: originalTemplate.id,
     reason: "Auto-recovered from file path error in task-3",
     improvised: true,
     modifications: extractedModifications
   })
   ```

**Files to Modify**:
- `src/session/activity.ts` - Add trailblazing logic
- `src/session/activity-executor.ts` - Recovery prompt generation
- `src/tool/activity.ts` - Add trailblazing parameters
- `templates/built-in/*` - Add trailblazing examples

---

### Gap 4: Backend API Gaps ⚠️ HIGH

**Problem**: Templates assume backend endpoints that don't exist yet

**Missing Endpoints** (referenced in debug/evolve templates):

#### Execution History API
```
GET /v2/activities/executions?template_id={id}&limit=100
GET /v2/activities/executions/{execution_id}
GET /v2/activities/executions/{execution_id}/tasks
GET /v2/activities/executions/{execution_id}/logs
GET /v2/activities/executions/{execution_id}/errors
```

**Purpose**: Fetch execution details for diagnosis
**Status**: ❌ Not implemented
**Impact**: Debug template can't fetch execution history

#### Template Metrics API
```
GET /v2/activities/templates/{template_id}/stats
  Response: {
    success_rate: 0.85,
    avg_duration_ms: 45000,
    avg_cost_usd: 0.12,
    total_executions: 150,
    period: "last_30_days"
  }
```

**Purpose**: Provide data for ROI-based improvements
**Status**: ❌ Not implemented
**Impact**: Evolve template can't make data-driven decisions

#### Learning Data API
```
GET /v2/activities/templates/{template_id}/learnings
  Response: {
    common_failures: [
      { error_pattern: "File not found", frequency: 0.30 },
      { error_pattern: "Token limit exceeded", frequency: 0.15 }
    ],
    improvement_opportunities: [...]
  }
```

**Purpose**: Surface patterns for continuous improvement
**Status**: ❌ Not implemented
**Impact**: No pattern recognition across executions

#### Template Service (gRPC/REST)
```
rpc SearchTemplates(...) returns (...)
rpc GetTemplate(...) returns (...)
rpc RegisterTemplate(...) returns (...)
rpc UpdateTemplateMetrics(...) returns (...)
rpc ListTemplates(...) returns (...)
rpc DeleteTemplate(...) returns (...)
```

**Purpose**: Single source of truth for templates
**Status**: ⚠️ Partially implemented (backend has endpoints, client missing)
**Impact**: Can't use backend as primary template source

**Solution Required**:
1. Implement missing backend endpoints in `metabob-rpc-api`:
   - Execution history with filtering
   - Template metrics aggregation
   - Learning data extraction
   
2. Implement TypeScript clients:
   - `src/backend/execution-service-client.ts`
   - `src/backend/template-service-client.ts`
   
3. Update templates to use real endpoints:
   - Replace placeholder API calls with actual clients
   - Add error handling for unavailable backend

**Files to Modify**:
- Backend: `repos/metabob-rpc-api/server/routes/activities.py`
- Frontend: `src/backend/*.ts` (new files)
- Templates: `templates/built-in/debug-activity-self-contained.json`
- Templates: `templates/built-in/evolve-activity-self-contained.json`

---

### Gap 5: No Automated Learning Loop ⚠️ MEDIUM

**Problem**: Diagnosis→Evolution→Test cycle requires manual intervention

**Current Workflow** (Manual):
```
1. User notices activity failed
2. User runs: activity({ templateId: "debug-activity", variables: { executionId } })
3. User reads DIAGNOSIS_REPORT.md
4. User runs: activity({ templateId: "evolve-activity", variables: { templateId } })
5. User reads EVOLUTION_REPORT.md
6. User manually registers improved template
7. User manually tests improved template
8. User manually compares metrics (old vs new)
```

**Desired Workflow** (Automated):
```
1. Activity fails
2. System automatically:
   a. Triggers debug-activity (diagnosis)
   b. Triggers evolve-activity (improvement)
   c. Registers improved template variant
   d. A/B tests: 50% use old, 50% use new
   e. Collects metrics for 24 hours
   f. Promotes winner (higher success rate)
   g. Archives loser
```

**Implementation Approach**:

Create `continuous-improvement-loop` template:

```json
{
  "id": "continuous-improvement-loop",
  "name": "Continuous Improvement Loop",
  "description": "Automated diagnosis, evolution, and validation cycle for failed templates",
  "tasks": [
    {
      "id": "diagnose-failure",
      "subagent": "general",
      "prompt": {
        "template": "Use debug-activity-self-contained to diagnose execution {{executionId}}"
      }
    },
    {
      "id": "evolve-template",
      "subagent": "general",
      "dependencies": ["diagnose-failure"],
      "prompt": {
        "template": "Use evolve-activity-self-contained to improve template {{templateId}}"
      }
    },
    {
      "id": "register-variant",
      "subagent": "general",
      "dependencies": ["evolve-template"],
      "prompt": {
        "template": "Register improved template variant with backend"
      }
    },
    {
      "id": "enable-ab-test",
      "subagent": "general",
      "dependencies": ["register-variant"],
      "prompt": {
        "template": "Enable A/B test: 50% original, 50% improved variant"
      }
    },
    {
      "id": "collect-metrics",
      "subagent": "general",
      "dependencies": ["enable-ab-test"],
      "prompt": {
        "template": "Wait 24 hours and collect metrics for both variants"
      }
    },
    {
      "id": "evaluate-winner",
      "subagent": "general",
      "dependencies": ["collect-metrics"],
      "prompt": {
        "template": "Compare metrics and promote winner, archive loser"
      }
    }
  ]
}
```

**Trigger Mechanisms**:
1. **On Activity Failure** hook (automatic)
2. **Scheduled** (nightly improvement run)
3. **Threshold-based** (success rate < 70%)

**Solution Required**:
1. Create `continuous-improvement-loop` template
2. Implement activity failure hooks
3. Implement A/B testing framework
4. Implement automated metrics collection
5. Implement promotion/archival logic

**Files to Create**:
- `templates/built-in/continuous-improvement-loop.json`
- `src/session/activity-ab-testing.ts`
- `src/session/activity-metrics-collector.ts`
- `src/session/activity-failure-hooks.ts`

---

## Implementation Priority

### Phase 1: Foundation (CRITICAL - Week 1)
1. ✅ Fix template versioning (genealogy support)
2. ✅ Fix storage fragmentation (backend-first loading)
3. ✅ Implement missing backend API endpoints

**Deliverables**:
- Proper Version and Genealogy types
- Backend TemplateService client
- Execution history API
- Template metrics API

**Success Criteria**:
- Templates have genealogy tracking
- Backend is primary source of truth
- Debug template can fetch real execution data
- Evolve template can fetch real metrics

### Phase 2: Self-Healing (HIGH - Week 2)
1. ✅ Implement trailblazing
2. ✅ Implement recovery prompt generation
3. ✅ Create template variants from improvisations

**Deliverables**:
- Trailblazing parameters in activity tool
- Recovery prompt generator
- Variant creation from successful recoveries

**Success Criteria**:
- Activities auto-recover from transient failures
- Recoveries create tracked variants
- Improvisations are documented in genealogy

### Phase 3: Automation (MEDIUM - Week 3)
1. ✅ Create continuous improvement loop template
2. ✅ Implement A/B testing framework
3. ✅ Implement automated metrics collection
4. ✅ Implement failure hooks

**Deliverables**:
- Continuous improvement loop template
- A/B testing infrastructure
- Automated promotion/archival

**Success Criteria**:
- Failed activities trigger automatic improvement
- Improved variants are A/B tested
- Winners are promoted automatically
- No manual intervention needed

---

## Testing Strategy

### Unit Tests
- ✅ Version generation (timestamp:parent:variant format)
- ✅ Genealogy tracking (parent-child relationships)
- ✅ Recovery prompt generation (given error + context)
- ✅ Variant creation from improvisation
- ✅ A/B test split logic (50/50 distribution)

### Integration Tests
- ✅ Debug template with real backend API
- ✅ Evolve template with real metrics
- ✅ Trailblazing end-to-end (fail → recover → variant)
- ✅ Continuous improvement loop (fail → diagnose → evolve → test → promote)

### End-to-End Tests
1. **Scenario: Template Fails Repeatedly**
   - Run template 10 times, expect 30% success rate
   - Continuous improvement loop triggers
   - Improved variant created and A/B tested
   - After 24h, improved variant shows 80% success rate
   - System promotes improved variant
   - Next 10 runs show 80% success rate (validation)

2. **Scenario: Transient Failure Auto-Recovery**
   - Run template, task-3 fails with "Network timeout"
   - Trailblazing generates recovery prompt
   - Agent retries with context, succeeds
   - Variant created with "Increased timeout" modification
   - Variant promoted if pattern repeats

---

## Key Decisions Needed

### Decision 1: Backend API Design
**Question**: REST or gRPC for execution history API?
**Options**:
- A: REST (simpler, HTTP/JSON)
- B: gRPC (faster, typed, already used for TemplateService)

**Recommendation**: **gRPC** (consistency with TemplateService)

### Decision 2: Trailblazing Cost Limits
**Question**: What are safe default cost limits?
**Options**:
- A: Conservative ($0.10 per task, $0.50 total)
- B: Moderate ($1.00 per task, $5.00 total)
- C: Aggressive ($5.00 per task, $25.00 total)

**Recommendation**: **B: Moderate** (balance recovery vs cost)

### Decision 3: A/B Test Duration
**Question**: How long to collect metrics before promoting?
**Options**:
- A: 6 hours (fast feedback)
- B: 24 hours (sufficient data)
- C: 7 days (high confidence)

**Recommendation**: **B: 24 hours** (balance speed vs confidence)

### Decision 4: Automatic vs Manual Promotion
**Question**: Should system auto-promote variants?
**Options**:
- A: Fully automatic (no human review)
- B: Automatic with notification (human can override)
- C: Manual approval required

**Recommendation**: **B: Automatic with notification** (efficiency + safety)

---

## Success Metrics

### Template Health
- **Success Rate**: >80% (up from current ~50-70%)
- **Auto-Recovery Rate**: >60% of transient failures
- **Improvement Cycle Time**: <24 hours (diagnosis → promotion)
- **Variant Count**: Growing genealogy trees (healthy evolution)

### System Health
- **Template Conflicts**: 0 (single source of truth)
- **Stale Templates**: 0 (backend synchronization)
- **Manual Interventions**: <5% of failures (mostly automated)
- **Learning Coverage**: >90% of failures captured and learned from

### Developer Experience
- **Time to Diagnosis**: <5 minutes (automated)
- **Time to Fix**: <1 hour (automated improvement)
- **Time to Validation**: <24 hours (A/B testing)
- **Confidence in Templates**: High (data-driven evolution)

---

## Conclusion

We have a **solid foundation** for self-healing activity templates:
- ✅ Debug and evolve templates exist and are well-designed
- ✅ Error inspection and replay tools are functional
- ✅ Composition patterns are clear

But **critical gaps** prevent full autonomy:
- ❌ Template versioning is non-compliant (can't track evolution)
- ❌ Storage is fragmented (conflicts and stale data)
- ❌ Trailblazing is missing (can't auto-recover)
- ❌ Backend APIs are incomplete (can't fetch real data)
- ❌ Learning loop is manual (no automation)

**Recommended Focus**: Tackle Phase 1 (Foundation) first, as it unblocks everything else.

**Next Steps**:
1. Implement proper template versioning with genealogy
2. Fix storage to use backend as single source of truth
3. Implement missing backend API endpoints
4. Test debug/evolve templates with real data
5. Move to Phase 2 (trailblazing) once foundation is solid

---

**Status**: Ready for implementation. All gaps are identified with clear solutions.
