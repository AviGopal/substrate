# MiniBob Reliability & Transparency Specification

## Context

This specification addresses improvements to MiniBob's **code** to make its decision-making visible and its execution reliable. This is NOT about:
- Creating new activity templates (that's a separate concern)
- Using MiniBob to develop MiniBob (circular dependency)
- Building fancy UIs

This IS about:
- Writing code that makes MiniBob's decisions transparent via console output
- Writing code that prevents repeated failures within a goal
- Writing code that enables testing MiniBob's capabilities
- Ensuring the code we write is testable without MiniBob

---

## Core Principle: Three Distinct Processes

```
┌──────────────────────────────────────────────────────────────────┐
│                    PROCESS SEPARATION                             │
└──────────────────────────────────────────────────────────────────┘

1. DEVELOPING CODE (what we're doing now)
   ├─ Writing TypeScript in repos/minibob/src/
   ├─ Testing with: bun test
   ├─ Running with: bun run index.ts
   └─ Deploying to Kubernetes

2. DEVELOPING ACTIVITIES (template creation)
   ├─ Writing JSON in repos/metabob-proto/activities/
   ├─ Seeding to backend via scripts/seed-*.ts
   ├─ Testing by executing them manually
   └─ Learning happens via Thompson Sampling

3. DEVELOPING CODE WITH ACTIVITIES (future state)
   ├─ MiniBob executes activities to modify its own code
   ├─ Ribosome extracts successful patterns
   ├─ Self-improvement loop closes
   └─ NOT what we're doing today

TODAY'S FOCUS: Process #1 (Developing Code)
```

---

## Problem Statement

### Current Behavior

When MiniBob executes a goal, the decision process is opaque:

```typescript
// repos/minibob/src/goal-processor.ts:1577
const recommendations = await this.getRecommendations(goal, impulseIds, 3)
const topRecommendation = filteredRecommendations[0]
// Execute top pick
const execution = await this.executor.execute({ template, ... })
```

**What the user sees:**
```
▶ Executing: fix-bug-complete
Task 1/4: Reproduce bug... ✓
Task 2/4: Implement fix... ✓
...
```

**What the user DOESN'T see:**
- Why was `fix-bug-complete` selected?
- What were the alternatives?
- What are the Thompson Sampling scores?
- Is this exploration or exploitation?
- What happened when it failed?

### Core Issues

1. **Opaque Selection**: No visibility into why activities are chosen
2. **No Within-Goal Learning**: Same failed activity can be retried
3. **Unknown Capabilities**: Can't query "what can MiniBob do?"
4. **Blind Retry**: Task retries use identical approach

---

## Data Flows

### Flow 1: Goal → Activity Selection (Current)

```
┌─────────────────────────────────────────────────────────────────┐
│                  CURRENT SELECTION FLOW                          │
└─────────────────────────────────────────────────────────────────┘

User Input
  │
  ├─> "Fix authentication bug"
  │
  ▼
GoalProcessor.parseGoal()
  │
  ├─> LLM enrichment (type, intent, capabilities)
  │
  ▼
GoalProcessor.getRecommendations(goal, impulseIds, limit=3)
  │
  ├─> MCPClient.recommendActivities()
  │   │
  │   ├─> POST /v2/activities/recommend
  │   │   Body: {
  │   │     goal: "Fix authentication bug",
  │   │     category: "bugfix",
  │   │     available_impulses: ["impulse-123", "impulse-456"]
  │   │   }
  │   │
  │   ▼
  │   Backend (metabob-activity-api)
  │   │
  │   ├─> Thompson Sampling selection
  │   ├─> Shape matching (input_shapes ⊆ available)
  │   ├─> Tag filtering
  │   ├─> Rank by score
  │   │
  │   └─> Response: [
  │         {
  │           template_id: "fix-bug-complete",
  │           selection_metadata: {
  │             score: 0.87,
  │             alpha: 24,
  │             beta: 3,
  │             exploratory: false,
  │             reasoning: "High success rate (23/25 executions)"
  │           }
  │         },
  │         { template_id: "debug-activity-self-contained", ... },
  │         { template_id: "refactor-with-tests", ... }
  │       ]
  │
  ▼
GoalProcessor.assessRelevance(goal, recommendations[0])
  │
  ├─> Trust backend score (default: use as-is)
  │
  ▼
Select topRecommendation
  │
  ▼
Execute activity

PROBLEM: All metadata from backend is DISCARDED
         User sees: "Executing: fix-bug-complete"
         User doesn't see: score, reasoning, alternatives
```

### Flow 2: Activity Execution → Learning (Current)

```
┌─────────────────────────────────────────────────────────────────┐
│                  EXECUTION → LEARNING FLOW                       │
└─────────────────────────────────────────────────────────────────┘

ActivityExecutor.execute(template, variables, impulses)
  │
  ├─> For each task:
  │   ├─> Execute with LLM
  │   ├─> Run validation
  │   ├─> On failure: retry up to maxAttempts
  │   └─> Record in executionTrace
  │
  ▼
Execution complete (status: completed | failed)
  │
  ├─> Create ActivityExecution object
  │   {
  │     id: "exec-123",
  │     templateId: "fix-bug-complete",
  │     status: "completed",
  │     metrics: { duration, cost, tokens },
  │     executionTrace: { tasks: [...] }
  │   }
  │
  ▼
MCPClient.reportExecution(execution)
  │
  ├─> POST /v2/activities/executions
  │   Body: { execution object }
  │
  ▼
Backend (metabob-activity-api)
  │
  ├─> Store in execution_traces table
  │
  ├─> Update variant_performance_metrics (ATOMIC)
  │   UPDATE variant_performance_metrics SET
  │     total_executions += 1,
  │     successful_executions += (status = 'completed' ? 1 : 0),
  │     thompson_alpha = successful_executions + 1,
  │     thompson_beta = failed_executions + 1
  │
  ├─> Invalidate Redis cache
  │
  └─> Broadcast WebSocket event (template_updated)

PROBLEM: Learning happens AFTER goal completes
         Within a single goal, no feedback to selection
         Same failed activity can be chosen again
```

### Flow 3: Proposed Within-Goal Learning

```
┌─────────────────────────────────────────────────────────────────┐
│              PROPOSED WITHIN-GOAL LEARNING                       │
└─────────────────────────────────────────────────────────────────┘

GoalProcessor maintains:
  - failedActivities: string[] = []
  - accumulatedImpulses: Impulse[] = []

Iteration Loop (i = 0; i < maxActivities; i++):
  │
  ├─> getRecommendations(
  │     goal,
  │     impulseIds,
  │     limit=3,
  │     exclude=failedActivities  // NEW
  │   )
  │
  ├─> Backend receives exclude list
  │   ├─> Filter out excluded activities
  │   ├─> Re-rank remaining candidates
  │   └─> Return top 3 (excluding failed ones)
  │
  ├─> Execute top recommendation
  │
  ├─> If execution.status === 'failed':
  │   ├─> failedActivities.push(templateId)
  │   └─> Continue to next iteration
  │
  └─> If execution.status === 'completed':
      ├─> Check if goal complete
      └─> If not, continue (may select same activity again if it partially succeeded)

BENEFIT: Failed activities not retried within same goal
         Adaptive selection based on execution results
         Still updates backend metrics for long-term learning
```

---

## Requirements

### R1: Selection Transparency (MUST HAVE)

**Requirement**: User must see WHY an activity was selected and what alternatives existed.

**Acceptance Criteria**:
- Console output shows all recommendations received from backend
- Each recommendation displays: templateId, score, Thompson params, reasoning
- Selected activity is clearly marked
- Output is human-readable (not JSON dump)

**Implementation Location**: `repos/minibob/src/goal-processor.ts`

**Data Required**:
- `ActivityRecommendation[]` from backend
- `selection_metadata` object per recommendation:
  ```typescript
  {
    score: number              // 0.0-1.0
    alpha: number              // Thompson Sampling α
    beta: number               // Thompson Sampling β
    exploratory: boolean       // Exploration vs exploitation
    reasoning?: string         // Human-readable explanation
    successRate?: number       // Historical success %
    executionCount?: number    // Total executions
  }
  ```

**Example Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ACTIVITY SELECTION (Iteration 1/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Context: 3 impulses available
Requesting 3 recommendations from backend...

Received 3 recommendations:

  1. fix-bug-complete ⭐ SELECTED
     Score: 0.87 | Thompson: α=24 β=3 | Success: 92% (23/25)
     Strategy: Exploitation (high confidence)
     Reasoning: Proven track record for bugfix category

  2. debug-activity-self-contained
     Score: 0.45 | Thompson: α=2 β=8 | Success: 20% (2/10)
     Strategy: Exploration (learning phase)

  3. refactor-with-tests
     Score: 0.32 | Thompson: α=16 β=8 | Success: 67% (16/24)
     Reasoning: Lower relevance (refactor vs bugfix)
```

### R2: Within-Goal Blacklisting (MUST HAVE)

**Requirement**: Failed activities must not be retried within the same goal execution.

**Acceptance Criteria**:
- GoalProcessor tracks failed activities per goal
- Failed activities passed to `getRecommendations()` as exclusion list
- Backend filters out excluded activities before ranking
- Console shows "Excluding previously failed: [...]"

**Implementation Location**:
- `repos/minibob/src/goal-processor.ts` (tracking)
- `repos/minibob/src/mcp.ts` (API update)
- `repos/metabob-activity-api/src/routes/activities.ts` (backend filter)

**Data Flow**:
```typescript
// MiniBob (client)
const failedActivities: string[] = []

if (execution.status === 'failed') {
  failedActivities.push(execution.templateId)
}

const recommendations = await mcp.recommendActivities(
  goal.intent,
  goal.type,
  impulseIds,
  3,
  failedActivities  // NEW parameter
)

// Backend (metabob-activity-api)
const excludeSet = new Set(exclude_activities || [])
const filteredActivities = allActivities.filter(
  a => !excludeSet.has(a.variant_id)
)
// Then Thompson Sampling on filtered set
```

### R3: Execution Status Visibility (MUST HAVE)

**Requirement**: User must see clear success/failure status for each activity and task.

**Acceptance Criteria**:
- Activity start/completion clearly marked
- Task-level status shown (✓ success, ✗ failure, ⟳ retry)
- Retry attempts numbered (Retry 1/3, Retry 2/3, etc.)
- Failure reasons displayed
- Summary shows total time and cost

**Example Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ EXECUTING: fix-bug-complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task 1/4: Reproduce and analyze bug
  ✓ Completed (2.3s)

Task 2/4: Implement fix
  ✓ Completed (4.1s)

Task 3/4: Verify fix with tests
  ✗ Failed (1.2s)
  Error: Test suite failed - 2/5 tests passing

  ⟳ Retry 1/3: Verify fix with tests
    ✓ Completed (3.5s)
    Note: Updated test assertions

Task 4/4: Commit changes
  ✓ Completed (0.8s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Activity completed (11.9s, $0.12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### R4: Capability Testing (SHOULD HAVE)

**Requirement**: Users can query what MiniBob can do without executing activities.

**Acceptance Criteria**:
- `/test <capability>` command queries backend for matching activities
- Returns list of activities with success rates
- Indicates if capability is covered or would trigger improvisation
- Exit code reflects coverage (0 = covered, 1 = no coverage)

**Implementation Location**: `repos/minibob/src/index.ts`

**Example Usage**:
```bash
bun run index.ts /test "read and analyze TypeScript code"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 CAPABILITY TEST: read and analyze TypeScript code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 3 potentially relevant activities:

  1. understanding:explore-codebase (score: 0.92)
     Success rate: 95% (38/40 executions)
     Tags: analysis, typescript, architecture

  2. refactor-with-tests (score: 0.67)
     Success rate: 67% (16/24 executions)
     Tags: refactor, testing, code-analysis

  3. add-feature-complete (score: 0.45)
     Success rate: 78% (35/45 executions)
     Tags: feature, implementation

✓ Capability covered by 3 existing activities
  Recommendation: understanding:explore-codebase (highest confidence)
```

### R5: Bootstrap Activity Validation (MUST HAVE)

**Requirement**: All 11 bootstrap activities must be validated and working.

**Acceptance Criteria**:
- Audit script checks each template for:
  - Valid JSON structure
  - Validation rules defined (requiredFiles, patterns)
  - Retry strategy specified
  - Variables properly typed
  - Task count reasonable (2-6 tasks)
- Each activity tested in isolation
- Failures documented and fixed
- Audit report generated

**Implementation Location**: `scripts/audit-bootstrap-activities.ts`

**Audit Report Format**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOOTSTRAP ACTIVITY AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. add-feature-complete ✓
   - Validation: ✓ (requiredFiles, forbiddenPatterns)
   - Retry: ✓ (maxAttempts: 3)
   - Tasks: ✓ (4 tasks)
   - Variables: ✓ (featureName, featureDescription)
   - Test: ✓ PASS

2. fix-bug-complete ✓
   - Validation: ✓
   - Retry: ✓ (maxAttempts: 3)
   - Tasks: ✓ (4 tasks)
   - Variables: ✓ (bugDescription, filePath)
   - Test: ✓ PASS

3. create-activity-self-contained ⚠
   - Validation: ✗ MISSING requiredFiles
   - Retry: ✓ (maxAttempts: 2)
   - Tasks: ✓ (3 tasks)
   - Variables: ✓
   - Test: ✗ FAIL (validation not enforced)
   - FIX NEEDED: Add validation rules

Summary: 10/11 passing, 1 needs fixes
```

---

## Non-Requirements

### What We're NOT Building

1. **Fancy TUI**: No ncurses, no real-time dashboard. Console output only.
2. **Git Rollback**: Complex, error-prone. Defer for later.
3. **Activity Creation**: We're writing code, not templates.
4. **Self-Development Loop**: That's Process #3 (future).
5. **Backend Changes**: Minimal - only add `exclude_activities` parameter.

---

## Implementation Strategy

### Phase 1: Transparency (Console Output)

**Files to modify**:
- `repos/minibob/src/goal-processor.ts`
  - Add `logRecommendations()` helper
  - Add `logExecutionStart()` helper
  - Add `logTaskStatus()` helper
  - Add `logGoalVerification()` helper

**No behavior changes, only logging additions.**

### Phase 2: Blacklisting

**Files to modify**:
- `repos/minibob/src/goal-processor.ts`
  - Add `failedActivities: string[]` to `executeGoal()`
  - Track failures after execution
  - Pass to `getRecommendations()`

- `repos/minibob/src/mcp.ts`
  - Add `excludeActivities?: string[]` parameter to `recommendActivities()`
  - Include in API request body

- `repos/metabob-activity-api/src/routes/activities.ts`
  - Accept `exclude_activities` in request body
  - Filter before Thompson Sampling

**Behavior change: Failed activities excluded within goal.**

### Phase 3: Validation

**Files to create**:
- `scripts/audit-bootstrap-activities.ts`
  - Load each template
  - Check structure
  - Validate against schema
  - Generate report

**Files to fix**:
- Bootstrap templates in `repos/metabob-proto/activities/bootstrap/`
  - Add missing validation rules
  - Fix malformed task structures

### Phase 4: Capability Testing

**Files to modify**:
- `repos/minibob/src/index.ts`
  - Add `/test` command handler
  - Query backend for matching activities
  - Display results

**No new features, just query interface.**

---

## Testing Strategy

### Unit Tests (Code-Level)

```typescript
// repos/minibob/src/__tests__/goal-processor.test.ts

describe('GoalProcessor blacklisting', () => {
  test('excludes failed activities from next iteration', async () => {
    const processor = new GoalProcessor(executor)
    const failedActivities = ['activity-a', 'activity-b']

    // Mock MCP to verify exclude list is passed
    const mockMCP = {
      recommendActivities: jest.fn().mockResolvedValue([])
    }

    await processor.getRecommendations(
      goal,
      impulseIds,
      3,
      failedActivities
    )

    expect(mockMCP.recommendActivities).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      ['activity-a', 'activity-b']
    )
  })
})
```

### Integration Tests (End-to-End)

```bash
# Test 1: Selection transparency
bun run index.ts goal "Fix authentication bug"
# Verify output contains:
# - "ACTIVITY SELECTION"
# - Thompson scores
# - Selection reasoning

# Test 2: Blacklisting
# Manually fail an activity, verify next iteration excludes it
# Check logs for "Excluding previously failed: [...]"

# Test 3: Capability test
bun run index.ts /test "read TypeScript files"
# Exit code 0, shows matching activities
```

### Manual Verification

1. Deploy to local Kubernetes
2. Seed bootstrap activities
3. Execute goal that triggers multiple iterations
4. Verify console output is clear and informative
5. Verify failed activities not retried

---

## Success Criteria

### Demo Readiness Checklist

- [ ] Console output clearly shows selection reasoning
- [ ] Thompson Sampling parameters visible
- [ ] Failed activities excluded from retry
- [ ] All 11 bootstrap activities validated
- [ ] `/test` command works
- [ ] Integration tests pass
- [ ] Can demonstrate learning (2nd attempt better than 1st)

### Quantitative Metrics

- Console output adds < 2 seconds to total execution time
- Blacklisting reduces unnecessary retries by > 50%
- Bootstrap activity validation catches > 80% of structural issues
- `/test` command returns results in < 5 seconds

---

## Open Questions

1. **Backend API Change**: Does `exclude_activities` need versioning, or can we add it as optional parameter?
   - Recommendation: Optional parameter (backward compatible)

2. **Logging Level**: Should selection details be INFO or DEBUG?
   - Recommendation: INFO (critical for transparency)

3. **Audit Failures**: If bootstrap activities fail audit, fix in spec or defer?
   - Recommendation: Fix immediately (foundation must be solid)

4. **Test Command Output**: JSON or human-readable?
   - Recommendation: Human-readable (aligns with console-first approach)

---

## Dependencies

### External Systems
- **metabob-activity-api**: Must accept `exclude_activities` parameter
- **SurrealDB**: Must have bootstrap activities seeded
- **Redis**: Cache invalidation on metric updates

### Internal Components
- **MCPClient**: Interface to backend
- **ActivityExecutor**: Execution and retry logic
- **GoalProcessor**: Selection and orchestration

### No Circular Dependencies
- We write code (Process #1)
- We test code with `bun test` and manual execution
- We do NOT use MiniBob to write this code
- Activities are data consumed by the code we write

---

## Timeline

Assuming focused development:

- **Phase 1 (Transparency)**: 2-3 hours
- **Phase 2 (Blacklisting)**: 2 hours
- **Phase 3 (Validation)**: 2 hours
- **Phase 4 (Testing)**: 1 hour

**Total: 7-8 hours**

---

## Appendix: Data Structures

### ActivityRecommendation (Enhanced)

```typescript
interface ActivityRecommendation {
  templateId: string
  variables: Record<string, unknown>
  selectionMetadata: {
    score: number              // 0.0-1.0, Thompson Sampling score
    alpha: number              // Thompson α parameter
    beta: number               // Thompson β parameter
    exploratory: boolean       // Exploration vs exploitation
    reasoning?: string         // Human-readable explanation
    successRate?: number       // success / total executions
    executionCount?: number    // Total historical executions
    avgDuration?: number       // Average duration in seconds
    avgCost?: number           // Average cost in USD
  }
}
```

### RecommendActivitiesRequest (Enhanced)

```typescript
interface RecommendActivitiesRequest {
  goal: string
  category?: string
  available_impulses?: string[]
  limit?: number
  exclude_activities?: string[]  // NEW: Blacklist for within-goal learning
}
```

### BootstrapActivityAudit

```typescript
interface BootstrapActivityAudit {
  templateId: string
  path: string
  checks: {
    validJson: boolean
    hasValidation: boolean
    hasRetryStrategy: boolean
    taskCountReasonable: boolean
    variablesTyped: boolean
  }
  issues: string[]
  testResult: 'pass' | 'fail' | 'untested'
  recommendation: 'use' | 'fix' | 'deprecate'
}
```
