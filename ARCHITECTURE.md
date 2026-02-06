# Activity Learning System Architecture

## Purpose

The activity system exists to **learn from experience**. Activities capture intent, execute work, validate outcomes, and feed results back into the learning system to improve future recommendations.

This document describes how the system works, not as an "enhancement" but as its fundamental design.

---

## Core Principles

### 1. Intent Is Primary

Every activity exists to achieve an **intent** (goal). The intent is captured at creation and flows through the entire lifecycle:

```
Intent → Implementation → Validation → Learning
```

- **Intent**: Why we're doing this (goal, acceptance criteria, constraints)
- **Implementation**: The code/changes we make
- **Validation**: Objective tests that prove intent was achieved
- **Learning**: Feedback to improve future activities

### 2. Validation Must Be Objective

Validations are not subjective checks or implementation details. They are **objective test cases** with:
- Known input data
- Expected output data
- Clear pass/fail criteria

This allows automated, repeatable validation at any point in time.

### 3. Continuous Validation Detects Drift

Validations don't just run once. They run **continuously** on every code change, detecting when:
- Intent is violated by subsequent changes
- Original implementation was incorrect
- Code drifts from its purpose

### 4. Learning Closes the Loop

When validations fail, the system:
1. Marks the activity as failed (retroactively if needed)
2. Updates Thompson Sampling effectiveness scores
3. Demotes templates that produce failing activities
4. Learns patterns of what works and what doesn't

---

## System Components

### Intent Capture

**When**: Activity creation/execution starts

**What**: Extract the "why" from the activity:

```typescript
interface Intent {
  goal: string                    // High-level goal
  acceptanceCriteria: string[]    // What success looks like
  constraints: string[]           // What must be true
  assumptions: string[]           // What we assume
}
```

**How**: Parse from:
- Activity template description
- User-provided variables
- Inferred from task descriptions (e.g., "should" statements)

**Storage**: Attached to activity and propagated to created components

---

### Validator Synthesis

**When**: Activity completes

**What**: Generate objective test cases from intent using LLM

**Input**:
```
Intent: "Allow users to retrieve their profile"
Acceptance Criteria:
- User can retrieve their own profile
- User cannot retrieve other users' profiles
- Returns 404 for non-existent users

Component: getUserProfile() function
Source Code: [actual code]
```

**Output**:
```typescript
[
  {
    description: "User can retrieve their own profile",
    input: { userId: 123, requesterId: 123 },
    expectedOutput: { id: 123, name: "John", email: "john@example.com" },
    expectedBehavior: "Returns user profile when user requests their own data"
  },
  {
    description: "User cannot retrieve other profiles",
    input: { userId: 456, requesterId: 123 },
    expectedOutput: { error: "Unauthorized" },
    expectedBehavior: "Rejects requests for other users' profiles"
  },
  {
    description: "Returns 404 for non-existent users",
    input: { userId: 999, requesterId: 123 },
    expectedOutput: { error: "Not found" },
    expectedBehavior: "Returns 404 for users that don't exist"
  }
]
```

**Storage**: Validators linked to components via ComponentProvenance

---

### Continuous Validation

**When**: 
- Immediately after activity completes
- On every subsequent code change (git commit)
- On demand (via tool/API)

**What**: Execute validators against current code

**Process**:
1. Detect which components changed
2. Load validators for those components
3. Execute component with validator input
4. Compare actual output to expected output
5. Record pass/fail results

**Outcomes**:
- All pass → Activity remains successful (for now)
- Any fail → Trigger failure detection

---

### Failure Detection

**When**: Validator fails

**What**: Determine if original activity should be marked as failed

**Logic**:

```typescript
if (validator.failed) {
  // Get component provenance (who created this?)
  const provenance = getProvenance(component)
  
  // Is this a recent creation?
  const ageInDays = (now - provenance.createdBy.timestamp) / DAY_MS
  
  if (ageInDays <= DETECTION_WINDOW) {
    // Build failure signal
    const signal = {
      type: 'validator-failure',
      confidence: 0.95,  // Objective validation = high confidence
      originalActivityId: provenance.createdBy.activityId,
      evidence: {
        validator: validator.description,
        expected: validator.expectedOutput,
        actual: actualOutput
      }
    }
    
    // Mark activity as failed
    Activity.markAsFailed(
      provenance.createdBy.activityId,
      `Validator failed: ${validator.description}`,
      { signal }
    )
    
    // Update learning system
    ThompsonSampling.recordFailure(provenance.createdBy.activityId)
  }
}
```

**Threshold**: Validator failures have high confidence (0.95) because they're objective tests, not heuristics.

---

### Component Provenance

**Purpose**: Track which activity created each code component

**Data Model**:

```typescript
interface ComponentProvenance {
  file: string
  component: string
  
  createdBy: {
    activityId: string
    timestamp: number
    commitSha: string
  }
  
  intent: Intent  // Why this component exists
  
  validators: Validator[]  // How we verify it achieves intent
  
  validationHistory: Array<{
    timestamp: number
    allPassed: boolean
    failures: string[]
  }>
}
```

**Lifecycle**:
1. Created when activity completes
2. Updated with validators after synthesis
3. Updated with validation results on every run
4. Used for failure attribution

---

### Intent Flow Tracking

**Purpose**: Understand how intent propagates through the system

**Tracks**:
- Parent-child intent relationships (component A enables component B)
- Intent inheritance (child derives from parent's intent)
- Intent corruption points (where intent was lost)

**Example**:

```
Root Intent: "Users can manage their profiles"
  ├─ Intent: "Users can view their profile"
  │   └─ Component: getUserProfile()
  │       ├─ Validator: Can retrieve own profile ✓
  │       ├─ Validator: Cannot retrieve others ✗ FAILED
  │       └─ CORRUPTION DETECTED
  │
  ├─ Intent: "Users can update their profile"
  │   └─ Component: updateUserProfile()
  │       └─ All validators passing ✓
  │
  └─ Intent: "Users can delete their profile"
      └─ Component: deleteUserProfile()
          └─ All validators passing ✓
```

This visualization shows where intent was violated (authorization check removed from getUserProfile).

---

## Data Flow

### Activity Creation → Execution → Validation

```
1. User/Agent requests activity
   Input: template + variables
   
2. Capture intent from template + variables
   Output: Intent object
   
3. Execute activity (create/modify code)
   Output: Code changes, commits
   
4. Synthesize validators from intent
   Input: Intent + created components
   Output: Validators (objective test cases)
   
5. Run validators immediately
   Input: Validators + current code
   Output: ValidationReport (pass/fail)
   
6. Record provenance
   Store: Activity → Components → Intent → Validators
   
7. If validators fail → Mark activity as failed
   Update: Activity status, Thompson Sampling
```

### Continuous Validation (Post-Activity)

```
1. Code change detected (git commit)
   
2. Identify changed components
   
3. Load validators for those components
   
4. Execute validators against new code
   
5. Compare results to expectations
   
6. If failed → Failure detection
   - Get component provenance
   - Check if within detection window
   - Mark original activity as failed
   - Update Thompson Sampling
```

---

## Integration Points

### Activity Execution

```typescript
// repos/metabob-opencode/packages/opencode/src/session/activity.ts

export async function execute(
  templateId: string,
  variables: Record<string, any>
): Promise<Info> {
  
  // 1. Capture intent
  const intent = await captureIntent(templateId, variables)
  
  // 2. Create activity with intent
  const activity = await create({ templateId, variables, intent })
  
  // 3. Execute steps
  await executeSteps(activity)
  
  return activity
}

export async function complete(id: string): Promise<Info> {
  const activity = await load(id)
  
  activity.status = "done"
  activity.completedAt = Date.now()
  await save(activity)
  
  // 4. Record provenance
  await ComponentProvenance.recordActivity(activity)
  
  // 5. Synthesize validators
  await ValidatorSynthesis.synthesize(activity)
  
  // 6. Run validators immediately
  const report = await ContinuousValidator.validate(activity)
  
  // 7. If failed, mark immediately
  if (!report.allPassed) {
    await markAsFailed(id, "Validators failed immediately", { report })
  }
  
  return activity
}
```

### Git Commit Hook

```typescript
// Hook into git commits
export async function onGitCommit(commitSha: string): Promise<void> {
  const filesChanged = await getFilesFromCommit(commitSha)
  
  // Run validators on changed components
  await ContinuousValidator.validateChangedFiles(filesChanged, commitSha)
}
```

### Component Provenance Recording

```typescript
// After activity completes
await ComponentProvenance.record({
  activityId: activity.id,
  components: extractedComponents,
  intent: activity.intent,
  commitSha: lastCommit.sha
})
```

### Validator Synthesis

```typescript
// After components created
const validators = await ValidatorSynthesis.synthesize({
  intent: activity.intent,
  components: createdComponents,
  sourceCode: componentCode
})

// Store validators
await storeValidators(activity.id, validators)
```

### Continuous Validation

```typescript
// On every code change
const report = await ContinuousValidator.run({
  components: changedComponents,
  commitSha: currentCommit
})

if (report.hasFailures) {
  await FailureDetection.process(report)
}
```

---

## Configuration

```json
{
  "intentValidation": {
    // Intent capture
    "captureIntentFromTemplates": true,
    "captureIntentFromVariables": true,
    "inferIntentFromDescriptions": true,
    
    // Validator synthesis
    "synthesizeValidators": true,
    "llmModel": "claude-sonnet-4",
    "maxValidatorsPerComponent": 10,
    "validatorTypes": ["unit", "integration", "property"],
    
    // Continuous validation
    "runOnActivityComplete": true,
    "runOnGitCommit": true,
    "validationTimeout": 30000,
    
    // Failure detection
    "detectionWindow": 30,
    "autoMarkThreshold": 0.90,
    "requireObjectiveEvidence": true,
    
    // Intent flow
    "trackIntentFlow": true,
    "analyzeCorruption": true
  }
}
```

---

## Implementation Roadmap

### Phase 1: Intent Capture + Validator Synthesis (Week 1)

**Goal**: Every activity captures intent and generates validators

Tasks:
- Add `intent` field to Activity data model
- Implement intent capture from templates/variables
- Implement LLM-based validator synthesis
- Store validators with component provenance

**Success**: Activities have intent and synthesized validators

### Phase 2: Continuous Validation (Week 2)

**Goal**: Validators run automatically and detect failures

Tasks:
- Implement validator execution engine
- Hook into `Activity.complete()`
- Hook into git commits
- Implement failure detection from validator failures

**Success**: Validators run continuously, activities auto-marked as failed when validators break

### Phase 3: Intent Flow + Monitoring (Week 3)

**Goal**: Full intent traceability and system monitoring

Tasks:
- Implement intent propagation tracking
- Implement corruption analysis
- Build intent flow visualization
- Create monitoring dashboard

**Success**: Intent flow visible, corruption points identified, full observability

---

## Metrics

### System Health

- **Intent Capture Rate**: % of activities with captured intent (target: 100%)
- **Validator Synthesis Rate**: % of activities with synthesized validators (target: 100%)
- **Validator Coverage**: Average validators per component (target: 3-5)

### Validation Quality

- **Validation Execution Rate**: % of code changes that trigger validation (target: 100%)
- **Validator Reliability**: % of validators that don't throw execution errors (target: >95%)
- **False Positive Rate**: % of validator failures that aren't real issues (target: <5%)

### Learning Effectiveness

- **Failure Detection Rate**: % of actual failures detected (target: >90%)
- **Time to Detection**: Average time from failure to detection (target: <1 day)
- **Thompson Sampling Accuracy**: Improvement in recommendation quality (target: +30%)

### Intent Traceability

- **Intent Flow Coverage**: % of components with tracked intent flow (target: >80%)
- **Corruption Detection**: % of intent violations identified (target: >80%)

---

## Success Criteria

The system is working when:

1. ✅ Every activity captures intent
2. ✅ Every component has objective validators synthesized from intent
3. ✅ Validators run automatically on every code change
4. ✅ 90%+ of intent violations detected
5. ✅ <5% false positive rate
6. ✅ Real-time detection (on commit, not days later)
7. ✅ Thompson Sampling learns from validator outcomes
8. ✅ Intent flow traceable from root to leaves
9. ✅ System self-corrects (bad templates demoted, good ones promoted)

---

## Comparison to Alternative Approaches

### Manual Failure Marking

**Problem**: Requires human to notice and report failures (slow, incomplete)

**How This Solves It**: Validators detect failures automatically

### Heuristic-Based Detection

**Problem**: Analyzes commit messages/patterns (subjective, false positives)

**How This Solves It**: Objective test cases with known inputs/outputs

### Implementation-Based Validation

**Problem**: Tests "what" not "why" (brittle, breaks on refactor)

**How This Solves It**: Intent-driven validators test goals, not implementation

---

## Why This Architecture

This isn't a "new" system or "enhancement". This is **what the activity system was always meant to be**:

1. **Intent-driven**: Activities exist to achieve goals, not just run code
2. **Self-validating**: Every activity proves it achieved its intent
3. **Continuously learning**: Outcomes feed back into recommendations
4. **Self-correcting**: Bad patterns are automatically demoted

We're building this incrementally because we're **building the system with itself** - using activities to improve the activity system.

---

## Related Documentation

- `INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt` - Detailed implementation steps
- `ACTIVITY_SYSTEM_ISSUES_INDEX.md` - Navigation and context
- Backend API documentation in `repos/metabob-rpc-api/`
- Frontend dashboard in `repos/metabob-dashboard/`

---

**Last Updated**: 2025-02-04  
**Status**: Architecture defined, implementation in progress  
**Next**: Begin Phase 1 - Intent capture + validator synthesis
