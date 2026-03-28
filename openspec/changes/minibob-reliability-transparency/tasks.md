# MiniBob Reliability & Transparency - Task List

## Overview

This change implements visibility and reliability improvements to MiniBob's **code** (not activities). All tasks are traditional code development - no circular dependency on MiniBob.

---

## Task Dependencies

```
Foundation Tasks (parallel)
├─ T1: Bootstrap Activity Audit
└─ T2: Seed Activities to Database

Implementation Tasks (sequential after foundation)
├─ T3: Selection Transparency (console logging)
├─ T4: Within-Goal Blacklisting
└─ T5: Capability Testing Command

Validation Tasks (after implementation)
├─ T6: Unit Tests
├─ T7: Integration Tests
└─ T8: Demo Validation
```

---

## Foundation Tasks

### T1: Bootstrap Activity Audit ⚡ START HERE

**Goal**: Validate all 11 bootstrap activities are structurally correct and will execute reliably.

**Why First**: No point improving visibility if activities are broken. Foundation must be solid.

**Files to Create**:
- `scripts/audit-bootstrap-activities.ts`

**Audit Checks**:
1. Valid JSON structure
2. Validation rules exist (requiredFiles, patterns)
3. Retry strategy defined
4. Variables properly typed
5. Task count reasonable (2-6)
6. No template syntax errors

**Expected Output**:
```bash
bun run scripts/audit-bootstrap-activities.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOOTSTRAP ACTIVITY AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ add-feature-complete.json
  Validation: ✓ | Retry: ✓ | Tasks: 4 | Variables: ✓

⚠ create-activity-self-contained.json
  Validation: ✗ MISSING requiredFiles
  FIX NEEDED: Add validation.requiredFiles array

[... 9 more activities ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 10/11 passing, 1 needs fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Acceptance Criteria**:
- [x] Script runs without errors
- [x] All 11 activities audited
- [x] Report shows pass/fail for each check
- [x] Issues documented with file paths
- [x] Summary shows count of passing activities

**Estimate**: 2 hours

**Validation**:
```bash
# Run audit
bun run scripts/audit-bootstrap-activities.ts

# Expected: Clear report showing status of all 11 activities
# Expected: If failures, specific issues listed with file paths
```

---

### T2: Seed Activities to Database

**Goal**: Ensure backend has all bootstrap activities available for Thompson Sampling.

**Why Important**: Can't test selection if backend has no activities.

**Dependencies**: T1 (audit must pass first)

**Files to Run**:
- `scripts/seed-bootstrap-templates.ts` (already exists)

**Steps**:
1. Fix any issues found in T1
2. Run seed script
3. Verify activities in database
4. Check initial Thompson params (α=1, β=1)

**Expected Output**:
```bash
bun run scripts/seed-bootstrap-templates.ts

Seeding 11 bootstrap activities...
✓ add-feature-complete (variant_id: bootstrap/add-feature-complete-v1)
✓ fix-bug-complete (variant_id: bootstrap/fix-bug-complete-v1)
✓ refactor-with-tests (variant_id: bootstrap/refactor-with-tests-v1)
[... 8 more ...]

All activities seeded successfully
```

**Acceptance Criteria**:
- [x] Seed script runs without errors
- [x] All 11 activities in database
- [x] Thompson params initialized (α=1, β=1)
- [x] Recommendation endpoint returns activities

**Estimate**: 1 hour

**Validation**:
```bash
# Verify activities exist
curl http://activity.metabob.local/v2/activities/templates | jq '. | length'
# Expected: >= 11

# Test recommendation endpoint
curl -X POST http://activity.metabob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"goal":"Fix a bug","category":"bugfix"}' | jq '.[:3]'
# Expected: Array of 3 recommendations with template_id, selection_metadata
```

---

## Implementation Tasks

### T3: Selection Transparency

**Goal**: User sees WHY an activity was selected and what alternatives existed.

**Dependencies**: T1, T2 (need working activities to show selection)

**Files to Modify**:
- `repos/minibob/src/goal-processor.ts`

**Functions to Add**:
1. `logGoalAnalysis(goal: Goal)` - Show parsed goal info
2. `logRecommendations(recommendations, iteration, max, excluded)` - Show selection details
3. `logActivityExecution(template, execution)` - Show execution status
4. `logGoalVerification(complete, reason)` - Show verification result

**Implementation Details**:

```typescript
// repos/minibob/src/goal-processor.ts

private logGoalAnalysis(goal: Goal): void {
  console.log('\n' + '━'.repeat(70))
  console.log('🎯 GOAL ANALYSIS')
  console.log('━'.repeat(70))
  console.log(`Type: ${goal.type}`)
  console.log(`Intent: ${goal.intent}`)
  if (goal.enrichment?.requiredCapabilities) {
    console.log(`Required capabilities: ${goal.enrichment.requiredCapabilities.join(', ')}`)
  }
  console.log()
}

private logRecommendations(
  recommendations: ActivityRecommendation[],
  iteration: number,
  maxIterations: number,
  excludedActivities: string[] = []
): void {
  console.log('━'.repeat(70))
  console.log(`🔍 ACTIVITY SELECTION (Iteration ${iteration}/${maxIterations})`)
  console.log('━'.repeat(70))
  console.log(`Context: ${this.accumulatedImpulses.length} impulses available`)

  if (excludedActivities.length > 0) {
    console.log(`Excluding previously failed: [${excludedActivities.join(', ')}]`)
  }

  console.log(`\nReceived ${recommendations.length} recommendations:\n`)

  recommendations.forEach((rec, idx) => {
    const meta = rec.selectionMetadata || {}
    const isSelected = idx === 0

    console.log(`  ${idx + 1}. ${rec.templateId} ${isSelected ? '⭐ SELECTED' : ''}`)

    if (meta.score !== undefined) {
      console.log(`     Score: ${meta.score.toFixed(2)}`, end='')
      if (meta.alpha !== undefined && meta.beta !== undefined) {
        console.log(` | Thompson: α=${meta.alpha} β=${meta.beta}`, end='')
      }
      if (meta.successRate !== undefined) {
        const pct = (meta.successRate * 100).toFixed(0)
        console.log(` | Success: ${pct}%`, end='')
      }
      console.log()
    }

    if (meta.exploratory !== undefined) {
      const strategy = meta.exploratory ? 'Exploration' : 'Exploitation'
      console.log(`     Strategy: ${strategy}`)
    }

    if (meta.reasoning) {
      console.log(`     Reasoning: ${meta.reasoning}`)
    }

    console.log()
  })
}

private logActivityExecution(
  templateId: string,
  execution: ActivityExecution
): void {
  console.log('━'.repeat(70))
  console.log(`▶ EXECUTING: ${templateId}`)
  console.log('━'.repeat(70))

  if (execution.executionTrace?.tasks) {
    execution.executionTrace.tasks.forEach((task, idx) => {
      const taskNum = idx + 1
      const totalTasks = execution.executionTrace!.tasks.length
      const status = task.status === 'success' ? '✓' :
                    task.status === 'failure' ? '✗' :
                    task.status === 'partial' ? '⚠' : '○'

      console.log(`Task ${taskNum}/${totalTasks}: ${task.description}`)
      console.log(`  ${status} ${task.status}`)

      if (task.error) {
        console.log(`  Error: ${task.error}`)
      }
    })
  }

  console.log()
  console.log('━'.repeat(70))
  const statusSymbol = execution.status === 'completed' ? '✓' : '✗'
  const duration = execution.metrics?.duration || 0
  const cost = execution.metrics?.cost || 0
  console.log(`${statusSymbol} Activity ${execution.status} (${duration.toFixed(1)}s, $${cost.toFixed(2)})`)
  console.log('━'.repeat(70))
  console.log()
}

private logGoalVerification(complete: boolean, reason: string): void {
  console.log('━'.repeat(70))
  console.log(`${complete ? '✓' : '⏳'} GOAL VERIFICATION`)
  console.log('━'.repeat(70))
  console.log(reason)
  console.log('━'.repeat(70))
  console.log()
}
```

**Integration Points**:
```typescript
// In executeGoal()

// Line ~1507 (after parseGoal)
this.logGoalAnalysis(goal)

// Line ~1588 (after getRecommendations)
this.logRecommendations(recommendations, i + 1, maxActivities, failedActivities)

// Line ~1810 (after execution)
this.logActivityExecution(topRecommendation.templateId, execution)

// Line ~1851 (after goal verification)
this.logGoalVerification(complete, reason)
```

**Acceptance Criteria**:
- [x] Goal analysis shown at start
- [x] Recommendations displayed with Thompson scores
- [x] Selected activity clearly marked
- [x] Execution status shown per task
- [x] Goal verification result displayed
- [x] No behavior changes (logging only)

**Estimate**: 2-3 hours

**Validation**:
```bash
# Run MiniBob with a goal
bun run repos/minibob/src/index.ts goal "Read package.json and list dependencies"

# Expected output includes:
# - 🎯 GOAL ANALYSIS section
# - 🔍 ACTIVITY SELECTION section with scores
# - ▶ EXECUTING section with task status
# - ✓ GOAL VERIFICATION section
# - Clear visual separation (━ lines)
# - Thompson α/β parameters shown
```

---

### T4: Within-Goal Blacklisting

**Goal**: Failed activities excluded from retry within same goal execution.

**Dependencies**: T3 (logging shows what's excluded)

**Files to Modify**:
- `repos/minibob/src/goal-processor.ts` (tracking)
- `repos/minibob/src/mcp.ts` (API parameter)
- `repos/metabob-activity-api/src/routes/activities.ts` (backend filter)

**Implementation Details**:

**Part A: Client-Side Tracking** (`repos/minibob/src/goal-processor.ts`)
```typescript
async executeGoal(
  message: string,
  context?: Record<string, unknown>,
  options?: { maxActivities?: number; maxCost?: number }
): Promise<GoalResult> {
  // ... existing setup ...

  const failedActivities: string[] = [] // NEW: Track failures

  for (let i = 0; i < maxActivities && mcpAvailable; i++) {
    // ... get recommendations ...
    const recommendations = await this.getRecommendations(
      goal,
      impulseIds,
      3,
      failedActivities  // NEW: Pass exclusions
    )

    // ... execute activity ...

    // NEW: Track failures
    if (execution.status === 'failed') {
      failedActivities.push(topRecommendation.templateId)
      console.log(`\n⚠ Activity failed: ${topRecommendation.templateId}`)
      console.log(`   Will exclude from future recommendations in this goal`)
    }

    // ... continue loop ...
  }
}

private async getRecommendations(
  goal: Goal,
  impulseIds: string[],
  limit: number,
  excludeActivities: string[] = []  // NEW parameter
): Promise<ActivityRecommendation[]> {
  const mcpClient = getMCPClient()
  if (!mcpClient) return []

  const recommendations = await mcpClient.recommendActivities(
    goal.intent,
    goal.type !== 'other' ? goal.type : undefined,
    impulseIds,
    limit,
    excludeActivities  // NEW: Pass to backend
  )

  return recommendations
}
```

**Part B: MCP Client Update** (`repos/minibob/src/mcp.ts`)
```typescript
async recommendActivities(
  goalDescription: string,
  category?: string,
  availableImpulses?: string[],
  limit?: number,
  excludeActivities?: string[]  // NEW parameter
): Promise<ActivityRecommendation[]> {
  try {
    const response = await this.request('POST', '/v2/activities/recommend', {
      goal: goalDescription,
      category,
      available_impulses: availableImpulses,
      limit: limit || 3,
      exclude_activities: excludeActivities  // NEW: Include in request
    })

    return this.transformRecommendations(response)
  } catch (error) {
    console.error('[MCP] Failed to get recommendations:', error)
    return []
  }
}
```

**Part C: Backend Filter** (`repos/metabob-activity-api/src/routes/activities.ts`)
```typescript
// In POST /v2/activities/recommend handler

const {
  goal,
  category,
  available_impulses,
  limit = 3,
  exclude_activities = []  // NEW: Accept exclusion list
} = await request.json()

// Fetch all matching activities
let matchingActivities = await queryActivitiesByCategory(category)

// NEW: Filter out excluded activities
if (exclude_activities.length > 0) {
  const excludeSet = new Set(exclude_activities)
  matchingActivities = matchingActivities.filter(
    activity => !excludeSet.has(activity.variant_id)
  )
}

// Apply Thompson Sampling to filtered set
const recommendations = thompsonSample(matchingActivities, limit)

return recommendations
```

**Acceptance Criteria**:
- [x] `failedActivities` array tracks failures in goal execution
- [x] Failed activities passed to `getRecommendations()`
- [x] MCP client includes `exclude_activities` in request
- [x] Backend filters excluded activities before sampling
- [x] Console shows "Excluding previously failed: [...]"
- [x] Same failed activity not retried within goal

**Estimate**: 2 hours

**Validation**:
```bash
# Create a scenario where first activity fails
# (e.g., activity requires file that doesn't exist)

bun run repos/minibob/src/index.ts goal "Fix nonexistent bug"

# Expected output:
# Iteration 1: Tries activity A
# Activity A fails
# Console shows: "⚠ Activity failed: A"
# Console shows: "Will exclude from future recommendations"
#
# Iteration 2:
# Console shows: "Excluding previously failed: [A]"
# Tries activity B (different from A)
#
# Verify: Activity A not in iteration 2+ recommendations
```

---

### T5: Capability Testing Command

**Goal**: Users can query what MiniBob can do without executing activities.

**Dependencies**: T2 (need activities in database)

**Files to Modify**:
- `repos/minibob/src/index.ts`

**Implementation Details**:

```typescript
// repos/minibob/src/index.ts

// Add to CLI argument parsing (around line 50)
if (arg === '/test') {
  const capability = args.slice(i + 1).join(' ')
  await testCapability(capability)
  process.exit(0)
}

async function testCapability(capability: string): Promise<void> {
  console.log('\n' + '━'.repeat(70))
  console.log(`🧪 CAPABILITY TEST: ${capability}`)
  console.log('━'.repeat(70))
  console.log()

  // Initialize MCP
  if (!isMCPEnabled()) {
    console.log('❌ MCP backend not configured')
    console.log('   Set ACTIVITY_API_ENDPOINT environment variable')
    process.exit(1)
  }

  const mcp = getMCPClient()
  if (!mcp) {
    console.log('❌ Failed to connect to MCP backend')
    process.exit(1)
  }

  console.log('Querying backend for matching activities...\n')

  try {
    // Use recommend endpoint to find matching activities
    const recommendations = await mcp.recommendActivities(
      `Test capability: ${capability}`,
      undefined,
      [],
      5  // Get top 5
    )

    if (recommendations.length === 0) {
      console.log('❌ No activities found for this capability')
      console.log('   This would trigger improvisation')
      console.log()
      process.exit(1)
    }

    console.log(`Found ${recommendations.length} potentially relevant activities:\n`)

    recommendations.forEach((rec, idx) => {
      const meta = rec.selectionMetadata || {}
      console.log(`  ${idx + 1}. ${rec.templateId}`)

      if (meta.score !== undefined) {
        console.log(`     Score: ${meta.score.toFixed(2)}`)
      }

      if (meta.successRate !== undefined) {
        const successPct = (meta.successRate * 100).toFixed(0)
        const totalExecs = meta.executionCount || 0
        console.log(`     Success rate: ${successPct}% (${totalExecs} executions)`)
      }

      console.log()
    })

    console.log('━'.repeat(70))
    console.log(`✓ Capability covered by ${recommendations.length} existing activities`)
    console.log(`  Recommendation: ${recommendations[0].templateId} (highest confidence)`)
    console.log('━'.repeat(70))
    console.log()

    process.exit(0)
  } catch (error) {
    console.log('❌ Error querying backend:', error)
    process.exit(1)
  }
}
```

**Acceptance Criteria**:
- [ ] `/test <capability>` command works
- [ ] Queries backend for matching activities
- [ ] Displays results with scores and success rates
- [ ] Exit code 0 if covered, 1 if not covered
- [ ] Clear recommendation shown

**Estimate**: 1 hour

**Validation**:
```bash
# Test covered capability
bun run repos/minibob/src/index.ts /test "read and analyze files"
# Expected: List of activities with scores, exit 0

# Test uncovered capability
bun run repos/minibob/src/index.ts /test "deploy to Mars"
# Expected: "No activities found", exit 1

# Test without backend
ACTIVITY_API_ENDPOINT="" bun run repos/minibob/src/index.ts /test "anything"
# Expected: "MCP backend not configured", exit 1
```

---

## Reliability & Failure Handling Tasks

### T5A: Goal Alignment Verification

**Goal**: Detect when activities complete but don't actually address the goal.

**Problem**: Activities fail to meet expectations but validate correctly (false positives).

**Files to Modify**:
- `repos/minibob/src/goal-processor.ts`

**Implementation**:
1. Add post-execution goal alignment check using LLM
2. Ask: "Did this execution move us closer to the goal?"
3. If misaligned, mark activity as "completed but ineffective"
4. Track effectiveness separately from success/failure
5. Feed ineffective activities back to Thompson Sampling with neutral/negative signal

**Acceptance Criteria**:
- [ ] Post-execution alignment check added
- [ ] Alignment score (0.0-1.0) computed per execution
- [ ] Low alignment (<0.3) logged as warning
- [ ] Alignment data sent to backend for learning
- [ ] Blacklist extended to exclude ineffective activities

---

### T5B: Validation Quality Assurance

**Goal**: Detect validation rules that are too strict or too lenient.

**Problems**:
- Activities meet expectations but validate incorrectly (false negatives)
- Activities fail to meet expectations but validate correctly (false positives)

**Files to Modify**:
- `repos/minibob/src/activity.ts`
- Backend validation tracking

**Implementation**:
1. After execution, compare validation result with goal alignment
2. If validation passed but alignment low → validation too lenient (false positive)
3. If validation failed but output looks good → validation too strict (false negative)
4. Track validation accuracy per template
5. Surface validation quality issues in dashboard

**Acceptance Criteria**:
- [ ] Validation quality tracked per template
- [ ] False positive/negative detection implemented
- [ ] Validation issues logged with examples
- [ ] Recommendations to fix validation rules
- [ ] Dashboard shows validation accuracy metrics

---

### T5C: Impulse Content Validation

**Goal**: Detect when impulses provide invalid or corrupt output.

**Problem**: Impulse resolvers return bad data.

**Files to Modify**:
- `repos/minibob/src/impulse.ts`
- Add impulse validators

**Implementation**:
1. Add content validation after impulse resolution
2. Check for:
   - Empty/null content when expected
   - Malformed JSON when type is JSON
   - File content corruption (binary in text files)
   - Truncated output
   - Error messages in content
3. Mark impulses as "corrupted" with specific reason
4. Provide fallback or retry logic
5. Log impulse quality issues

**Acceptance Criteria**:
- [ ] Content validators for common impulse types
- [ ] Corruption detection for file, memo, json types
- [ ] Corrupted impulses marked and logged
- [ ] Retry logic for transient corruption
- [ ] Quality metrics tracked per impulse type

---

### T5D: Resolver Health Monitoring

**Goal**: Detect when impulse resolvers fail deterministically.

**Problem**: Resolver consistently fails for certain inputs.

**Files to Modify**:
- `repos/minibob/src/impulse.ts`
- Add resolver health tracking

**Implementation**:
1. Track resolver success/failure rates per type
2. Detect patterns in failures (e.g., all activityExecutionTrace fail)
3. Circuit breaker pattern: disable failing resolvers temporarily
4. Fallback to alternative resolvers when available
5. Health dashboard showing resolver status

**Acceptance Criteria**:
- [ ] Resolver health tracking per type
- [ ] Failure pattern detection
- [ ] Circuit breaker for consistently failing resolvers
- [ ] Fallback resolver logic
- [ ] Health status logged and visible

---

### T5E: Environment Compatibility Checks

**Goal**: Detect environment-specific failures before execution.

**Problem**: Vessels fail in certain environments but not in others.

**Files to Create**:
- `repos/minibob/src/environment-check.ts`

**Implementation**:
1. Pre-execution environment validation
2. Check for:
   - Required tools available (git, node, bun)
   - File system permissions
   - Network connectivity to backend
   - Memory/disk space constraints
   - OS-specific requirements
3. Skip activities that require missing dependencies
4. Suggest environment fixes
5. Track environment compatibility per activity

**Acceptance Criteria**:
- [ ] Environment check before goal execution
- [ ] Tool availability detection
- [ ] Permission checks
- [ ] Graceful degradation when tools missing
- [ ] Environment requirements tracked per activity

---

## Validation Tasks

### T6: Unit Tests

**Goal**: Validate individual functions work correctly.

**Dependencies**: T3, T4, T5 (implementation complete)

**Files to Create/Modify**:
- `repos/minibob/src/__tests__/goal-processor.test.ts`
- `repos/minibob/src/__tests__/mcp.test.ts`

**Test Cases**:

```typescript
// repos/minibob/src/__tests__/goal-processor.test.ts

describe('GoalProcessor - Blacklisting', () => {
  test('tracks failed activities within goal', async () => {
    const processor = new GoalProcessor(mockExecutor)

    // Mock execution that fails
    mockExecutor.execute.mockResolvedValueOnce({
      status: 'failed',
      templateId: 'activity-a'
    })

    await processor.executeGoal('Test goal')

    // Verify failedActivities includes activity-a
    // (would need to expose for testing or spy on getRecommendations calls)
  })

  test('passes exclusions to getRecommendations', async () => {
    const processor = new GoalProcessor(mockExecutor)
    const spy = jest.spyOn(processor as any, 'getRecommendations')

    // Execute with failures
    await processor.executeGoal('Test goal')

    // Check second call includes exclusions
    const secondCall = spy.mock.calls[1]
    expect(secondCall[3]).toEqual(['failed-activity-id'])
  })
})

describe('MCPClient - Recommendations', () => {
  test('includes exclude_activities in request', async () => {
    const mcp = new MCPClient(config)
    const mockFetch = jest.spyOn(global, 'fetch')

    await mcp.recommendActivities(
      'Test goal',
      'feature',
      [],
      3,
      ['activity-a', 'activity-b']
    )

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.exclude_activities).toEqual(['activity-a', 'activity-b'])
  })
})
```

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Coverage for blacklisting logic
- [ ] Coverage for MCP client exclusions
- [ ] Tests run in < 5 seconds

**Estimate**: 1 hour

**Validation**:
```bash
cd repos/minibob
bun test

# Expected: All tests pass
# Expected: New tests for blacklisting included
```

---

### T7: Integration Tests

**Goal**: Validate end-to-end flows work correctly.

**Dependencies**: T6 (unit tests pass)

**Test Scenarios**:

**Scenario 1: Selection Transparency**
```bash
# Start MiniBob with deployed backend
ACTIVITY_API_ENDPOINT=http://activity.metabob.local \
bun run repos/minibob/src/index.ts goal "Read package.json"

# Verify output contains:
grep -q "GOAL ANALYSIS" output.log
grep -q "ACTIVITY SELECTION" output.log
grep -q "Thompson:" output.log
grep -q "⭐ SELECTED" output.log
```

**Scenario 2: Blacklisting**
```bash
# Create activity that always fails
# Execute goal that triggers it
# Verify second iteration excludes it

# Check logs for:
# - "⚠ Activity failed"
# - "Excluding previously failed: [...]"
# - Different activity selected on iteration 2
```

**Scenario 3: Capability Testing**
```bash
# Test known capability
./test-capability.sh "read files" 0  # exit code 0

# Test unknown capability
./test-capability.sh "time travel" 1  # exit code 1
```

**Acceptance Criteria**:
- [ ] All integration scenarios pass
- [ ] Output format matches spec examples
- [ ] Blacklisting prevents retries
- [ ] Capability test returns correct exit codes

**Estimate**: 1 hour

**Validation**:
```bash
# Run all integration tests
./scripts/run-integration-tests.sh

# Expected: All scenarios pass
# Expected: Output logs match expected format
```

---

### T8: Demo Validation

**Goal**: Confirm system is ready for 1-day demo presentation.

**Dependencies**: T7 (integration tests pass)

**Demo Checklist**:

```bash
# 1. Bootstrap activities seeded
curl http://activity.metabob.local/v2/activities/templates | jq '. | length'
# Expected: >= 11

# 2. Selection transparency works
bun run repos/minibob/src/index.ts goal "Add a console.log statement"
# Verify: Clear Thompson scores, reasoning shown

# 3. Learning visible
# Run same goal 3 times, verify:
# - 1st attempt: Random selection (α=1, β=1)
# - 2nd attempt: Updated Thompson params
# - 3rd attempt: Exploitation of successful variant

# 4. Blacklisting works
# Run goal with intentional first failure
# Verify: Different activity selected on retry

# 5. Capability testing works
bun run repos/minibob/src/index.ts /test "code analysis"
# Verify: Activities listed with success rates
```

**Demo Script**:
```
1. "Let me show you how MiniBob selects activities"
   → Run goal, point to ACTIVITY SELECTION section
   → Show Thompson scores, reasoning

2. "Watch how it learns from failures"
   → Run failing activity first
   → Show blacklisting in action
   → Show successful retry with different approach

3. "You can test what MiniBob can do"
   → Run /test command
   → Show capability coverage

4. "Learning happens in real-time"
   → Run same goal twice
   → Show Thompson params change
   → Show exploitation vs exploration
```

**Acceptance Criteria**:
- [ ] All demo steps work without errors
- [ ] Output is clear and presentable
- [ ] Learning is visible to observers
- [ ] Blacklisting demonstrates adaptive selection
- [ ] Capability testing shows coverage

**Estimate**: 1 hour (practice runs)

**Validation**:
```bash
# Dry run of full demo
./scripts/demo-validation.sh

# Expected: All steps complete successfully
# Expected: Output suitable for presentation
# Expected: Clear evidence of learning
```

---

## Execution Plan

### Phase 1: Foundation (3 hours)

**Parallel Execution**:
- [ ] T1: Bootstrap Activity Audit (2h)
- [ ] T2: Seed Activities to Database (1h)

**Validation Checkpoint**:
```bash
# After Phase 1
bun run scripts/audit-bootstrap-activities.ts
# Expected: All activities pass audit

curl http://activity.metabob.local/v2/activities/templates | jq '. | length'
# Expected: >= 11
```

### Phase 2: Core Implementation (5 hours)

**Sequential Execution**:
- [ ] T3: Selection Transparency (2-3h)
- [ ] T4: Within-Goal Blacklisting (2h)

**Validation Checkpoint**:
```bash
# After Phase 2
bun run repos/minibob/src/index.ts goal "Test goal"
# Expected: See ACTIVITY SELECTION with Thompson scores
# Expected: See blacklisting if activity fails
```

### Phase 3: Capability Testing (1 hour)

**Single Task**:
- [ ] T5: Capability Testing Command (1h)

**Validation Checkpoint**:
```bash
# After Phase 3
bun run repos/minibob/src/index.ts /test "read files"
# Expected: List of activities with scores
```

### Phase 4: Reliability & Failure Handling (8 hours)

**Sequential Execution** (building on each other):
- [ ] T5A: Goal Alignment Verification (2h)
- [ ] T5B: Validation Quality Assurance (2h)
- [ ] T5C: Impulse Content Validation (1.5h)
- [ ] T5D: Resolver Health Monitoring (1.5h)
- [ ] T5E: Environment Compatibility Checks (1h)

**Validation Checkpoint**:
```bash
# After Phase 4
# Run goal with known misalignment
# Expected: Alignment warnings logged
# Expected: Validation quality tracked
# Expected: Impulse corruption detected
# Expected: Resolver health monitored
# Expected: Environment checks pass
```

### Phase 5: Validation (3 hours)

**Parallel Execution**:
- [ ] T6: Unit Tests (1h)
- [ ] T7: Integration Tests (1h)
- [ ] T8: Demo Validation (1h)

**Validation Checkpoint**:
```bash
# After Phase 4
bun test                               # Unit tests pass
./scripts/run-integration-tests.sh    # Integration tests pass
./scripts/demo-validation.sh          # Demo ready
```

---

## Total Time Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Foundation | 3 hours | T1, T2 |
| Phase 2: Core Implementation | 5 hours | T3, T4 |
| Phase 3: Capability Testing | 1 hour | T5 |
| Phase 4: Reliability & Failure Handling | 8 hours | T5A-T5E |
| Phase 5: Validation | 3 hours | T6, T7, T8 |
| **Total** | **20 hours** | **13 tasks** |

**Buffer**: 4 hours for unexpected issues
**Total with buffer**: 24 hours (3 focused work days or 2 intensive days)

---

## Success Metrics

### Quantitative (Core Features)

- [x] 11/11 bootstrap activities pass audit
- [x] 100% of goals show selection reasoning
- [x] 0 instances of same failed activity retried within goal
- [ ] `/test` command returns results in < 5 seconds
- [ ] All unit tests pass (>= 95% coverage on new code)
- [ ] All integration tests pass

### Quantitative (Reliability)

- [ ] Goal alignment checked for 100% of executions
- [ ] Alignment scores tracked and visible
- [ ] Validation quality tracked per template
- [ ] Impulse corruption detected and logged
- [ ] Resolver health monitored continuously
- [ ] Environment checks run before execution
- [ ] False positive/negative validation rate < 10%

### Qualitative

- [ ] Observer can understand why activities were selected
- [ ] Learning is visible (Thompson params change over time)
- [ ] Failures are handled gracefully (blacklisting works)
- [ ] System feels reliable (doesn't repeat mistakes)
- [ ] Validation issues surface actionable fixes
- [ ] Impulse quality issues are transparent
- [ ] Environment problems caught early
- [ ] Demo-ready (presentable output)

---

## Risk Mitigation

### Risk 1: Backend Not Available

**Mitigation**: Test with local backend deployment first
**Fallback**: Mock backend responses for development

### Risk 2: Activities Fail Audit

**Mitigation**: Fix issues immediately (Phase 1 blocker)
**Fallback**: Disable broken activities, proceed with working ones

### Risk 3: Thompson Params Not in Response

**Mitigation**: Check backend response format early
**Fallback**: Display available metadata, gracefully handle missing fields

### Risk 4: Time Overrun

**Mitigation**: Prioritize T1-T4, defer T5 if needed
**Fallback**: Reduce scope (skip capability testing, focus on transparency + blacklisting)

---

## Appendix: Validation Scripts

### audit-bootstrap-activities.ts

```typescript
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const TEMPLATES_DIR = 'repos/metabob-proto/activities/bootstrap'

interface AuditResult {
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
}

async function auditTemplate(filePath: string): Promise<AuditResult> {
  const templateId = filePath.split('/').pop()!.replace('.json', '')
  const content = await readFile(filePath, 'utf-8')

  const result: AuditResult = {
    templateId,
    path: filePath,
    checks: {
      validJson: false,
      hasValidation: false,
      hasRetryStrategy: false,
      taskCountReasonable: false,
      variablesTyped: false
    },
    issues: []
  }

  try {
    const template = JSON.parse(content)
    result.checks.validJson = true

    // Check validation
    if (template.validation) {
      result.checks.hasValidation = true
    } else {
      result.issues.push('Missing validation rules')
    }

    // Check retry strategy
    const hasRetry = template.tasks?.some(t => t.retry?.maxAttempts > 1)
    if (hasRetry) {
      result.checks.hasRetryStrategy = true
    } else {
      result.issues.push('No retry strategy defined')
    }

    // Check task count
    const taskCount = template.tasks?.length || 0
    if (taskCount >= 2 && taskCount <= 6) {
      result.checks.taskCountReasonable = true
    } else {
      result.issues.push(`Task count ${taskCount} outside reasonable range (2-6)`)
    }

    // Check variables
    const allTyped = template.variables?.every(v => v.type && v.description)
    if (allTyped) {
      result.checks.variablesTyped = true
    } else {
      result.issues.push('Some variables missing type or description')
    }

  } catch (error) {
    result.issues.push(`JSON parse error: ${error.message}`)
  }

  return result
}

async function main() {
  console.log('━'.repeat(70))
  console.log('BOOTSTRAP ACTIVITY AUDIT')
  console.log('━'.repeat(70))
  console.log()

  const files = await readdir(TEMPLATES_DIR)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  const results: AuditResult[] = []

  for (const file of jsonFiles) {
    const filePath = join(TEMPLATES_DIR, file)
    const result = await auditTemplate(filePath)
    results.push(result)

    const allPassed = Object.values(result.checks).every(v => v)
    const symbol = allPassed ? '✓' : '⚠'

    console.log(`${symbol} ${result.templateId}`)

    if (!allPassed) {
      result.issues.forEach(issue => {
        console.log(`  - ${issue}`)
      })
    }

    console.log()
  }

  const passingCount = results.filter(r =>
    Object.values(r.checks).every(v => v)
  ).length

  console.log('━'.repeat(70))
  console.log(`Summary: ${passingCount}/${results.length} passing`)
  console.log('━'.repeat(70))

  process.exit(passingCount === results.length ? 0 : 1)
}

main()
```
