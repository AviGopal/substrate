# Impulse State Space Specification

> **Status**: Draft (some sections superseded by 2026-04-26 spec work; see notes)
> **Created**: 2026-04-05
> **Relates to**: IMPULSE_ACTIVITY_FOUNDATION.md

> **Foundation alignment:** State-space reasoning is the **recall motion** (informational → transient → observational) made explicit. The state space is the available pool of impulses the system can recall against; transitions track what learning would mint. The "shape signature" defined here is keyed on the **pointer-as-shape** bootstrap principle. See [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md#three-states-two-motions).

This specification defines how the metabob-devbob system reasons about, predicts, and adapts to changes in the impulse state space during goal execution.

---

## 1. Core Concepts

### 1.1 Impulse State Space

The **impulse state space** is the set of all impulses available at any point during execution. Each impulse is a lazy-loaded pointer with metadata describing its shape.

```typescript
interface ImpulseStateSpace {
  impulses: Map<string, Impulse>        // id → impulse
  shapes: Set<string>                    // Available shapes
  loadedContent: Map<string, unknown>    // Resolved content (cached)
  budgetUsed: number                     // Total tokens consumed
  budgetRemaining: number                // Available token budget
}
```

**Properties**:
- **Dynamic**: Changes during execution as activities produce outputs
- **Lazy**: Content loaded only when needed
- **Bounded**: Token budgets constrain what can be loaded
- **Typed**: Each impulse has a shape for matching

### 1.2 State Space Transitions

The state space transitions through three events:

| Event | State Change | Trigger |
|-------|--------------|---------|
| **Expansion** | New impulses added | Activity outputs, file modifications |
| **Contraction** | Impulses unloaded/expired | Budget pressure, TTL expiry |
| **Mutation** | Impulse content changes | File edits, state updates |

### 1.3 Shape Signature

A **shape signature** is a canonical representation of available shapes:

```typescript
type ShapeSignature = string[]  // Sorted, deduplicated

// Example: ["error_log", "goal", "source_code"]
```

Shape signatures enable:
- Activity matching (input_shapes ⊆ available_shapes)
- Thompson Sampling conditioning (success rate per signature)
- Composition learning (which signatures lead to which outputs)

---

## 2. Goal → Output State Space Prediction

### 2.1 Goal Enrichment

When a goal arrives, LLM enrichment extracts expected outputs:

```typescript
interface GoalEnrichment {
  category: GoalCategory
  clarifiedIntent: string
  expectedOutcomes: string[]        // Defines OUTPUT state space
  successCriteria: string           // Verification criteria
  requiredCapabilities: string[]    // Tools/resolvers needed
}
```

**expectedOutcomes** directly defines what the output state space should contain.

### 2.2 Semantic Shape Mapping

Goal text maps to expected shapes via keyword analysis:

| Goal Keywords | Implied Input Shapes | Implied Output Shapes |
|---------------|---------------------|----------------------|
| fix, debug, error | error_log, stack_trace | patch, fix |
| implement, add, create | goal, source_code | source_code, test_suite |
| refactor, clean | source_code | source_code, documentation |
| test, verify | source_code, test_suite | test_result |

### 2.3 Activity Output Schema

Activities declare their output contracts:

```typescript
interface ActivityOutputSchema {
  produces: ImpulseShape[]          // Guaranteed outputs on success
  mayProduce?: ImpulseShape[]       // Possible outputs
  sideEffects?: StateChange[]       // File modifications, etc.
}
```

**Prediction**: Given goal → select activities where `output_shapes ⊇ expectedOutcomes`

---

## 3. Input State Space Prediction

### 3.1 Forward Inference (Goal → Inputs)

Predict required inputs from goal:

```
Goal Text → Semantic Analysis → requiredCapabilities → Input Shapes
```

**Memory Agent** proactively suggests impulses:
```typescript
interface IntentAnalysis {
  type: IntentType
  confidence: number
  suggestedImpulses: SuggestedImpulse[]
}

interface SuggestedImpulse {
  id: string
  shape: string
  pointer: ImpulsePointer
  priority: Priority
  budget: number
  reason: string                    // Why this impulse is relevant
}
```

### 3.2 Backward Inference (Activity → Inputs)

Activities declare required inputs:

```typescript
interface ActivityInputSchema {
  required: ImpulseShape[]          // Must have
  optional?: ImpulseShape[]         // Beneficial but not required
  minimum?: number                  // Minimum required count
}
```

**Prediction**: To execute activity X, we need shapes matching `input_shapes`.

### 3.3 Shape Network Reverse Lookup

Query what inputs produce desired outputs:

```sql
SELECT input_shape, activities, success_rate
FROM v_shape_network
WHERE output_shape = $desired_output
ORDER BY success_rate DESC
```

### 3.4 Missing Impulse Discovery

Identify what additional inputs would unlock better activities:

```typescript
interface MissingImpulseSuggestion {
  shape: string
  unlocks_activities: string[]
  predicted_success_boost: number
  acquisition_hint?: string         // How to get this impulse
}
```

---

## 4. Execution Path Adaptation

### 4.1 Adaptation Triggers

The execution path adapts when:

| Trigger | Detection | Response |
|---------|-----------|----------|
| **New impulse available** | State space expanded | Re-recommend with new shapes |
| **Required impulse missing** | canExecuteTask() fails | Fall back to LLM |
| **Task failure** | status === 'failed' | Create error impulse, retry/variant |
| **Goal not achieved** | isGoalComplete() false | Continue loop with accumulated state |
| **Activity ineffective** | Repeated failures | Blacklist, select alternative |

### 4.2 Task-Level Adaptation

Within a single activity:

```typescript
// Before task execution
const { canExecute, missing } = canExecuteTask(task, impulses)

if (!canExecute) {
  if (task.prompt) {
    // ADAPT: Fall back to LLM
    return executeWithLLM(task, impulses)
  } else {
    // ADAPT: Skip task or fail
    return { status: 'skipped', reason: `Missing: ${missing}` }
  }
}

// Pre-validation check
const preValidation = checkPreValidationRules(task)
if (preValidation.canSkipLLM) {
  // ADAPT: Skip expensive LLM call
  return { status: 'completed', tokens: 0 }
}
```

### 4.3 Retry with Error Context

Error impulses carry recovery guidance:

```typescript
interface ErrorImpulseMetadata {
  shape: "previous_attempt_error"
  attemptNumber: number
  failureType: FailureType
  availableOps: ErrorHandlingOp[]
  suggestedOp: ErrorHandlingOp
  suggestionConfidence: number
  validationError?: string
  toolCallFailed?: string
  precedingAttempts?: string[]
}

type FailureType = 'validation' | 'execution' | 'tool_failure' | 'timeout'
type ErrorHandlingOp = 'retry' | 'variant' | 'debug' | 'skip' | 'escalate'
```

**Decision Tree**:
```
Failure occurs
  │
  ├─ attemptNumber < maxAttempts?
  │   └─ YES: availableOps += 'retry'
  │
  ├─ failureType === 'validation'?
  │   └─ YES: availableOps += 'skip'
  │
  ├─ failureType in ['execution', 'tool_failure']?
  │   └─ YES: availableOps += 'debug'
  │
  ├─ isRecurringPattern OR attemptNumber >= maxAttempts?
  │   └─ YES: availableOps += 'escalate'
  │
  └─ Always: availableOps += 'variant'
```

### 4.4 Activity-Level Adaptation

Across the goal execution loop:

```typescript
for (let i = 0; i < maxActivities; i++) {
  // 1. Get recommendations based on CURRENT state
  const recommendations = await getRecommendations(
    goal,
    accumulatedImpulses.map(imp => imp.id),
    limit,
    failedActivities  // Blacklisted
  )

  // 2. Execute top recommendation
  const execution = await executeActivity(recommendations[0])

  // 3. ADAPT state space
  if (execution.status === 'completed') {
    // Expand: Add output impulses
    accumulatedImpulses.push(...createImpulsesFromExecution(execution))
  } else {
    // Expand: Add error impulse
    accumulatedImpulses.push(createErrorImpulse(execution))
    // Contract: Blacklist failed activity
    failedActivities.push(execution.templateId)
  }

  // 4. Check if goal achieved with new state
  if (await isGoalComplete(executions, goal)) {
    return { status: 'completed' }
  }

  // 5. Loop continues with UPDATED state space
}
```

### 4.5 Fallback Escalation

When normal execution fails:

```
Normal Execution Loop
        │
        ▼
  Max iterations reached?
        │
        ├─ NO: Continue loop
        │
        └─ YES
             │
             ▼
      Template Creation
      (systematic approach)
             │
             ├─ Success: Retry with new template
             │
             └─ Failure
                  │
                  ▼
           Improvisation
           (LLM solves directly)
                  │
                  └─ Records trace for learning
```

---

## 5. Learning from State Transitions

### 5.1 Thompson Sampling Updates

After each execution:

```typescript
// Atomic update
UPDATE variant_performance_metrics
SET
  total_executions += 1,
  successful_executions += (success ? 1 : 0),
  failed_executions += (success ? 0 : 1),
  thompson_alpha = successful_executions + 1,
  thompson_beta = failed_executions + 1
WHERE activity_id = $activity_id
```

### 5.2 Shape-Conditioned Scoring

Learn success rates per input shape combination:

```sql
-- View: v_shape_conditioned_score
SELECT
  activity_id,
  array::sort(array::distinct(input_impulse_shapes)) AS shape_signature,
  count(IF success) + 1 AS alpha,
  count(IF NOT success) + 1 AS beta
FROM execution
GROUP BY activity_id, shape_signature
```

**Usage**: "Activity X succeeds 92% with [error, source_code] but only 45% with [goal] alone"

### 5.3 Composition Chain Learning

Record which sequences achieve which goals:

```typescript
interface CompositionRecord {
  parentActivityId?: string
  childActivityId: string
  compositionChain: string[]        // Full path from root
  inputImpulseShapes: string[]
  outputImpulseShapes: string[]
  success: boolean
  goalContext?: string
}
```

### 5.4 Error Impulse Relevance

Track whether error context helped recovery:

```typescript
await recordImpulseRelevance({
  impulseId: errorImpulse.id,
  activityId: templateId,
  wasLoaded: true,
  executionSucceeded: retrySucceeded
})
```

**Learning**: Error impulses with shape "previous_attempt_error" that correlate with success are prioritized.

---

## 6. State Space Queries

### 6.1 Activity Matching

```sql
SELECT * FROM activity
WHERE input_shapes ALLINSIDE $available_shapes
ORDER BY thompson_score DESC
```

### 6.2 Output Prediction

```sql
SELECT output_shapes, success_rate
FROM activity
WHERE id = $selected_activity
```

### 6.3 Shape Transformation Network

```sql
SELECT input_shape, output_shape, edge_weight, activities
FROM v_shape_network
WHERE input_shape IN $available_shapes
```

### 6.4 Missing Input Discovery

```sql
SELECT
  required_shape,
  array::group(activity_id) AS unlocked_activities,
  count() AS unlock_count
FROM activity
WHERE required_shape NOT IN $available_shapes
  AND (input_shapes MINUS [required_shape]) ALLINSIDE $available_shapes
GROUP BY required_shape
ORDER BY unlock_count DESC
```

---

## 7. Implementation Requirements

### 7.1 State Space Manager

```typescript
interface StateSpaceManager {
  // Query current state
  getAvailableShapes(): Set<string>
  getImpulsesByShape(shape: string): Impulse[]
  getShapeSignature(): string[]

  // Mutations
  addImpulse(impulse: Impulse): void
  removeImpulse(id: string): void
  loadImpulse(id: string): Promise<unknown>
  unloadImpulse(id: string): void

  // Budget management
  getBudgetRemaining(): number
  canLoad(impulse: Impulse): boolean

  // Prediction
  predictRequiredInputs(goal: Goal): SuggestedImpulse[]
  predictExpectedOutputs(activity: Activity): ImpulseShape[]
  findMissingImpulses(activities: Activity[]): MissingImpulseSuggestion[]
}
```

### 7.2 Execution Adapter

```typescript
interface ExecutionAdapter {
  // Path selection
  selectActivity(stateSpace: StateSpaceManager, goal: Goal): ActivityRecommendation[]

  // Execution
  executeWithAdaptation(activity: Activity, stateSpace: StateSpaceManager): ExecutionResult

  // Recovery
  handleFailure(error: ExecutionError, stateSpace: StateSpaceManager): RecoveryAction

  // Verification
  verifyGoalAchievement(goal: Goal, stateSpace: StateSpaceManager): GoalVerification
}
```

### 7.3 Learning Recorder

```typescript
interface LearningRecorder {
  // Execution outcomes
  recordExecution(execution: ActivityExecution): Promise<void>

  // Shape learning
  updateShapeScores(activityId: string, shapes: string[], success: boolean): Promise<void>

  // Composition learning
  recordComposition(record: CompositionRecord): Promise<void>

  // Relevance learning
  recordImpulseRelevance(record: RelevanceRecord): Promise<void>
}
```

---

## 8. Success Metrics

### 8.1 Prediction Accuracy

- **Input prediction accuracy**: % of predicted inputs that were actually used
- **Output prediction accuracy**: % of predicted outputs that were actually produced
- **Shape match rate**: % of activities where input_shapes matched available_shapes

### 8.2 Adaptation Effectiveness

- **Retry success rate**: % of retries that succeeded after error impulse injection
- **Fallback utilization**: % of executions requiring LLM fallback
- **Blacklist churn**: Rate of activities entering/exiting blacklist

### 8.3 Learning Convergence

- **Thompson uncertainty**: Average uncertainty across activities (should decrease)
- **Shape-conditioned divergence**: Variance in success rates across shape signatures
- **Composition pattern stability**: Reuse rate of learned sequences

---

## 9. Open Questions

1. **Budget allocation strategy**: How to optimally distribute token budget across impulses?
2. **Shape hierarchy**: Should shapes have parent/child relationships for partial matching?
3. **Temporal decay**: Should older impulses have reduced relevance?
4. **Cross-goal learning**: Can patterns from one goal inform another?
5. **Speculative loading**: Should we pre-load impulses likely to be needed?

---

## Appendix A: Example State Space Evolution

```
GOAL: "Fix authentication bug in login.ts"

T0 (Initial):
  shapes: [goal]
  impulses: [goal-001]
  budget: 50000 tokens

T1 (After Memory Agent):
  shapes: [goal, source_code, error_log]
  impulses: [goal-001, file-login-ts, error-stack]
  budget: 47000 tokens (3000 loaded)

T2 (After analyze-error activity):
  shapes: [goal, source_code, error_log, error_analysis]
  impulses: [..., analysis-001]
  budget: 44000 tokens

T3 (After debug-null-pointer FAILS):
  shapes: [goal, source_code, error_log, error_analysis, previous_attempt_error]
  impulses: [..., error-001]
  blacklist: [debug-null-pointer]
  budget: 42000 tokens

T4 (After locate-and-fix succeeds):
  shapes: [..., patch, modified_file]
  impulses: [..., patch-001, file-login-ts-modified]
  budget: 38000 tokens

T5 (After validate-fix succeeds):
  shapes: [..., test_result]
  impulses: [..., test-001]
  GOAL COMPLETE
```
