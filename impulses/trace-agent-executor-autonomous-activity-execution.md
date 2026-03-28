# Agent-Executor Autonomous Activity Execution - Complete Trace Analysis

## Specification Overview

**Name**: agent-executor-autonomous-activity-execution

**Description**: Agent-Executor system that autonomously executes activities based on trigger conditions, with automatic fallback to goal-seeking template creation when activities don't exist. The system uses executeActivityInline() for isolated execution, returns impulses for context passing, and integrates via lifecycle hooks or background workers.

**Current State**: 90% IMPLEMENTED - Missing autonomous recovery mechanism

**Desired State**: 100% AUTONOMOUS - Try-create-retry pattern with goal-seeking fallback

## Data Flow

### Current Implementation
```
Trigger Condition (lifecycle hook, idle detection, agent decision)
  → executeActivityInline(templateId, variables, parentSessionID, reason)
  → TemplateSelector.select(templateId)
  → [IF TEMPLATE NOT FOUND] ❌ THROW ERROR (CRITICAL GAP)
  → [IF TEMPLATE FOUND] Thompson Sampling variant selection
  → Template Loading (cache, backend, bootstrap)
  → Variable Validation
  → Activity.create() + Session.createForActivity()
  → SessionMemoryAgent.gatherContext() (LLM-based context inference)
  → Task Topological Sort (dependency resolution)
  → Task Execution Loop:
      - Trailblazing Mode (LLM + tools) OR
      - Deterministic Mode (direct tool calls)
  → Impulse Collection
  → Impulse Transfer (activity scope → session scope)
  → Metrics Update (Thompson Sampling learning)
  → Activity.save() (dual persistence: local + backend)
  → Return { impulses, success, activityId }
```

### Desired Implementation (With Autonomous Recovery)
```
Trigger Condition
  → TRY: executeActivityInline(templateId, ...)
  → CATCH TemplateNotFoundError:
      → GoalInferenceEngine.infer({ templateId, reason, variables })
      → LLM analyzes error context and infers goal
      → create_activity_goal_seeking({ goalDescription, category, preferComposition: true })
      → GoalSeekingPlanner.generatePlan() (composes existing activities where possible)
      → TemplateRepository.save() (registers new template)
      → RETRY: executeActivityInline(newTemplateId, ...)
  → Success Path (template found or newly created)
```

## Component Analysis

### Working Components (90% Infrastructure Ready)

#### 1. **executeActivityInline()** 
- **File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1311`
- **Status**: ✅ Fully Implemented
- **Behavior**: 
  - Executes activity in isolated child session
  - Returns impulses for transfer to parent session
  - Used by lifecycle hooks and background workers
  - Creates dedicated child session with `branch: "lifecycle-hook"`
  - Collects impulses from task execution
  - Transfers impulses with scope conversion (activity → session)
- **Gap**: None - This is the core enabler for autonomous execution
- **Evidence**: Successfully used by memoryManagementHook and BoredomManager

#### 2. **Lifecycle Hook Integration**
- **File**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts:61-208`
- **Status**: ✅ Fully Implemented
- **Behavior**:
  - Pre-turn hook: memoryManagementHook
  - Condition check: Skip for activity prefix commands, require impulse system enabled
  - Execution: Calls `executeActivityInline("manage-session-memory", ...)`
  - Impulse transfer: Converts activity-scoped impulses to session-scoped
  - Error handling: Non-fatal errors logged but don't block turn
- **Gap**: None - Demonstrates trigger-based automation pattern
- **Extension Opportunity**: Add more lifecycle hooks (error detection, context degradation, quality gate checks)

#### 3. **Background Worker Integration**
- **File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:19`
- **Status**: ✅ Fully Implemented
- **Behavior**:
  - Detects idle sessions (no activity for timeout period)
  - Autonomously executes activities via `executeActivityInline()`
  - Trigger condition: Idle timeout
- **Gap**: None - Demonstrates background worker pattern
- **Extension Opportunity**: Add try-create-retry pattern if activity template not found

#### 4. **Goal-Seeking Template Creation**
- **File**: `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts:24`
- **Status**: ✅ Fully Implemented
- **Behavior**:
  - Creates templates from goal descriptions
  - Uses GoalSeekingPlanner for task decomposition
  - Supports preferComposition (reuses existing activities)
  - Registers templates to backend automatically
  - Generates validators dynamically
- **Gap**: None - This is the tool used in autonomous recovery
- **Proof**: Successfully used manually, needs integration into error recovery path

#### 5. **Thompson Sampling Variant Selection**
- **File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts:157`
- **Status**: ✅ Fully Implemented
- **Behavior**:
  - Multi-armed bandit optimization
  - Balances exploration vs exploitation
  - ~10-30% probability of selecting candidate variants
  - Beta distribution sampling: Beta(α=successCount+1, β=failureCount+1)
- **Gap**: None - Learning system works correctly

#### 6. **Impulse Transfer Pattern**
- **File**: `repos/metabob-opencode/packages/opencode/src/session/session-memory.ts`
- **Status**: ✅ Fully Implemented
- **Behavior**:
  - SessionMemory.addImpulse() transfers impulses to parent session
  - Scope conversion: activity → session
  - Preserves impulse metadata (type, pointer, budget)
- **Gap**: None - Pattern works correctly
- **Evidence**: memoryManagementHook successfully transfers impulses (line 122-146)

### Components with Critical Gap (10% Missing)

#### 7. **Template Not Found Error Handling** 🔴 CRITICAL
- **File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts:130`
- **Status**: 🔴 CRITICAL GAP - Missing autonomous recovery
- **Current Behavior**: 
  ```typescript
  if (!requestedTemplate) {
    throw new Error(`Template not found: ${templateId}`)
    // ❌ Stops execution, requires manual intervention
  }
  ```
- **Desired Behavior**:
  ```typescript
  if (!requestedTemplate) {
    // Autonomous recovery
    try {
      const goal = await GoalInferenceEngine.infer({ 
        attemptedTemplateId: templateId,
        reason: reason,
        variables: variables 
      })
      
      const newTemplateId = await create_activity_goal_seeking({
        goalDescription: goal.description,
        templateName: goal.templateName,
        category: goal.category,
        variables: variables,
        constraints: { preferComposition: true }
      })
      
      // Retry with newly created template
      return await select(newTemplateId, backend)
    } catch (autoCreateError) {
      throw new Error(`Template not found: ${templateId}. Auto-creation failed: ${autoCreateError.message}`)
    }
  }
  ```
- **Impact**: 
  - ❌ Blocks autonomous execution
  - ❌ Requires manual intervention
  - ❌ Breaks self-healing capability
- **Solution**: Implement try-create-retry pattern
- **Estimated Effort**: 1 week

### Missing Components (Required for Autonomous Recovery)

#### 8. **GoalInferenceEngine** 🔴 NEW COMPONENT REQUIRED
- **File**: `repos/metabob-opencode/packages/opencode/src/session/goal-inference-engine.ts` (NEW)
- **Status**: ❌ Not Implemented
- **Purpose**: LLM-based goal inference from error context
- **Required Behavior**:
  ```typescript
  interface GoalInferenceEngine {
    infer(context: {
      attemptedTemplateId: string
      reason: string
      variables: Record<string, unknown>
    }): Promise<{
      description: string
      templateName: string
      category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
    }>
  }
  ```
- **Implementation**:
  1. Analyze templateId for semantic clues (e.g., "fix-bug-sql-injection" → "bugfix")
  2. Parse reason for goal description
  3. Use LLM to infer category and refine description
  4. Fallback to rule-based inference if LLM fails
- **Estimated Effort**: 2 days

#### 9. **AutonomousActivityExecutor** 🔴 NEW COMPONENT REQUIRED
- **File**: `repos/metabob-opencode/packages/opencode/src/session/autonomous-activity-executor.ts` (NEW)
- **Status**: ❌ Not Implemented
- **Purpose**: Wrapper with try-create-retry logic
- **Required Behavior**:
  ```typescript
  async function executeWithAutoCreation(params: {
    templateId: string
    variables: Record<string, unknown>
    reason: string
    trailblazing?: TrailblazingOptions
  }): Promise<ActivityResult> {
    try {
      return await ActivityTool.execute(params)
    } catch (error) {
      if (isTemplateNotFoundError(error)) {
        // Autonomous recovery
        const goal = await GoalInferenceEngine.infer({
          attemptedTemplateId: params.templateId,
          reason: params.reason,
          variables: params.variables
        })
        
        const newTemplateId = await create_activity_goal_seeking(goal)
        
        return await ActivityTool.execute({
          ...params,
          templateId: newTemplateId
        })
      }
      throw error
    }
  }
  ```
- **Estimated Effort**: 1 day

## Entry Points

### 1. ActivityTool.execute()
- **File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:425`
- **Trigger**: LLM agent decides to use activity tool
- **Current Behavior**: Calls TemplateSelector.select() which throws on template not found
- **Gap**: No autonomous recovery

### 2. executeActivityInline()
- **File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1311`
- **Trigger**: Lifecycle hooks, background workers
- **Current Behavior**: Executes activity in isolated session, returns impulses
- **Gap**: None - Works correctly

### 3. Lifecycle Hook: memoryManagementHook
- **File**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts:61`
- **Trigger**: Pre-turn condition check (not activity prefix, impulse system enabled)
- **Current Behavior**: Calls executeActivityInline('manage-session-memory'), transfers impulses
- **Gap**: None - Demonstrates trigger-based automation

### 4. Background Worker: BoredomManager
- **File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:19`
- **Trigger**: Idle timeout detection
- **Current Behavior**: Calls executeActivityInline() for boredom activities
- **Gap**: Could add try-create-retry pattern

## Data Transformations

### 1. Template ID → Template Schema (with Thompson Sampling)
- **Component**: TemplateSelector.select()
- **Input**: templateId: string
- **Output**: SelectionResult with Thompson Sampling metadata
- **Business Logic**: Multi-armed bandit optimization for template variants
- **Critical Gap**: No autonomous recovery on template not found (line 130)

### 2. Template + Variables → Validated Parameters
- **Component**: validateTemplateVariables()
- **Input**: template + providedVariables
- **Output**: ValidationResult (valid, missing, unexpected)
- **Business Logic**: Fuzzy matching, Levenshtein distance < 3 for suggestions
- **Gap**: None

### 3. Context Requirements → Impulses
- **Component**: SessionMemoryAgent.gatherContext()
- **Input**: ContextRequirement[], recentMessages
- **Output**: Record<string, Impulse>
- **Transformation**: LLM analyzes intent, creates impulses, loads content lazily
- **Gap**: None

### 4. Task Definitions → Execution Order
- **Component**: topologicalSort()
- **Input**: Task[] with dependencies
- **Output**: string[] (task IDs in execution order)
- **Algorithm**: Kahn's algorithm for DAG
- **Validation**: Detects cycles, validates dependencies exist
- **Gap**: None

### 5. Task Execution → Results
- **Component**: executeTask() (trailblazing or deterministic)
- **Input**: Task definition + variables
- **Output**: Task result with impulses, duration, cost, tokens
- **Modes**:
  - Trailblazing: LLM-assisted with retry logic
  - Deterministic: Direct tool calls without LLM
- **Gap**: None

### 6. Execution Results → Learning Metrics
- **Component**: TemplateRepository.updateMetrics()
- **Input**: Execution result + current metrics
- **Output**: Updated template with new metrics
- **Formula**: Incremental weighted average: `newAvg = oldAvg + (newValue - oldAvg) / (count + 1)`
- **Metrics**: successRate, avgDuration, avgCost, avgTokens, improvementGradient
- **Gap**: None

### 7. Activity-Scoped Impulses → Session-Scoped Impulses
- **Component**: SessionMemory.addImpulse()
- **Input**: Impulse with scope: "activity"
- **Output**: Impulse with scope: "session"
- **Transformation**: Scope conversion, sessionID assignment
- **Gap**: None - Pattern works correctly

## Validation Points

### Pre-Flight Validation
- **Location**: src/tool/activity.ts:528
- **Checks**: Template variables, required files, pre-conditions
- **Critical Gap**: Template existence check throws error instead of triggering recovery

### Post-Execution Validation
- **Location**: src/tool/activity.ts:1640-1735
- **Checks**: Required files created, patterns present/absent, commands succeed
- **Gap**: None

### Correctness Validation
- **Location**: src/tool/activity.ts:1121-1131
- **Analyzes**: Execution evidence, work artifacts, validation results
- **Output**: { verdict, confidence, issues, reasoning }
- **Gap**: None

## Architectural Boundaries

### Existing Patterns (✅ Implemented)

#### 1. Lifecycle Hook Integration
- **Status**: ✅ IMPLEMENTED
- **File**: repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts
- **Description**: Pre/post turn hooks that execute activities autonomously
- **Examples**: 
  - memoryManagementHook (line 61) - Pre-turn memory preparation
  - Future: errorDetectionHook - Auto-fix detected errors
  - Future: contextOptimizationHook - Optimize context when degraded

#### 2. Background Worker Integration
- **Status**: ✅ IMPLEMENTED
- **File**: repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts
- **Description**: Background workers that trigger activities based on conditions
- **Examples**:
  - BoredomManager - Idle detection (line 19)
  - Future: ResourceMonitor - Resource usage triggers
  - Future: QualityGateChecker - Periodic quality checks

#### 3. Isolated Execution Pattern
- **Status**: ✅ IMPLEMENTED
- **File**: repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1311
- **Description**: executeActivityInline() provides isolated execution with impulse transfer
- **Usage**: Lifecycle hooks, background workers, sub-activities
- **Key Features**:
  - Dedicated child session (no pollution of parent session)
  - Impulse collection and transfer
  - Scope conversion (activity → session)

#### 4. Goal-Seeking Template Creation
- **Status**: ✅ IMPLEMENTED
- **File**: repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts
- **Description**: Creates templates from goal descriptions with preferComposition
- **Usage**: Manual template creation, future: autonomous recovery
- **Key Features**:
  - Goal decomposition into task DAG
  - Composes existing activities where possible
  - Generates custom prompts for gaps
  - Dynamic validator creation

### Missing Patterns (❌ Not Implemented)

#### 1. Try-Create-Retry Pattern 🔴 CRITICAL
- **Status**: ❌ NOT IMPLEMENTED
- **Description**: Autonomous recovery when template not found
- **Required Components**:
  1. GoalInferenceEngine (infer goal from error context)
  2. AutonomousActivityExecutor (wrapper with retry logic)
  3. Integration in TemplateSelector.select()
- **Estimated Effort**: 1 week
- **Priority**: P0

## Implementation Roadmap

### Phase 1: Autonomous Recovery (Critical Gap) - 1 Week

**Goal**: Enable try-create-retry pattern

**Tasks**:
1. **Create GoalInferenceEngine** (2 days)
   - File: `repos/metabob-opencode/packages/opencode/src/session/goal-inference-engine.ts`
   - LLM-based goal inference from error context
   - Fallback to rule-based inference
   - Unit tests

2. **Create AutonomousActivityExecutor** (1 day)
   - File: `repos/metabob-opencode/packages/opencode/src/session/autonomous-activity-executor.ts`
   - Wrapper with try-create-retry logic
   - Error handling with graceful fallback
   - Integration tests

3. **Update TemplateSelector.select()** (0.5 days)
   - File: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
   - Add autonomous recovery at line 130
   - Preserve backward compatibility

4. **Integration and Testing** (1.5 days)
   - End-to-end tests
   - Documentation updates
   - Validation harness

**Success Criteria**:
- ✅ Agent can autonomously create templates when not found
- ✅ No manual intervention required
- ✅ Graceful fallback if auto-creation fails
- ✅ Validation harness proves self-healing behavior

### Phase 2: Extension Opportunities - 1 Week

**Goal**: Extend autonomous execution capabilities

**Tasks**:
- Add try-create-retry to BoredomManager
- Add more lifecycle hooks (error detection, context degradation)
- Add event-driven triggers (Bus integration)
- Add metrics and observability for autonomous executions

## Key Insights

### Business Value
- **Primary Goal**: Enable fully autonomous agent behavior
- **Key Benefit**: Agents can self-heal by creating missing templates on-the-fly
- **Impact**: Reduces manual intervention, improves user experience
- **Long-term**: System becomes more capable over time as it fills capability gaps

### Technical Value
- **Meta-Programming**: Agents modify their own behavior by creating new templates
- **Self-Healing**: System autonomously recovers from template not found errors
- **Learning Loop**: Newly created templates enter Thompson Sampling system, improving over time
- **Composability**: preferComposition=true reuses existing activities where possible

### Reuse Opportunity
- **Universal Pattern**: Try-create-retry applies to any resource loading (files, configs, dependencies)
- **Abstraction**:
  ```typescript
  async function withAutoCreation<T, CreateParams>(
    tryFn: () => Promise<T>,
    inferFn: (error: Error) => Promise<CreateParams>,
    createFn: (params: CreateParams) => Promise<void>,
    retryFn: () => Promise<T>
  ): Promise<T>
  ```

## Validation Evidence

### Proof Points

1. **executeActivityInline**: ✅ Implemented
   - Evidence: repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1311
   - Isolated execution with impulse transfer works correctly

2. **Lifecycle Hook Integration**: ✅ Implemented
   - Evidence: repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts:61-208
   - Pre-turn memory management hook executes successfully

3. **Background Worker Integration**: ✅ Implemented
   - Evidence: repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:19
   - Idle detection triggers activities autonomously

4. **Goal-Seeking Template Creation**: ✅ Implemented
   - Evidence: repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts:24
   - Creates templates from goals with composition

5. **Autonomous Recovery**: ❌ Missing
   - Evidence: repos/metabob-opencode/packages/opencode/src/session/template-selector.ts:130
   - Throws error instead of triggering recovery

### Infrastructure Readiness
- **Overall**: 90% - All infrastructure exists except autonomous recovery mechanism
- **Requires Code Changes**: Yes - GoalInferenceEngine, AutonomousActivityExecutor, TemplateSelector update
- **Estimated Effort**: 1 week for critical gap, 1 week for extensions

## Related Documentation

- [Agent-Executor Autonomous Activity Execution Flow](../docs/data-flows/agent-executor-autonomous-activity-execution-flow.md)
- [Goal-Seeking Activity Creation](../docs/GOAL_SEEKING_ACTIVITY_CREATION.md)
- [Thompson Sampling Implementation](../docs/IMPLEMENTATION_THOMPSON_AND_GRADIENTS.md)
- [Activity Execution Guide](../docs/activity-system/ACTIVITY_EXECUTION_GUIDE.md)
- [Architectural Boundaries](../docs/architectural-boundaries/METABOB_OPENCODE_ARCHITECTURAL_BOUNDARIES.md)

## Summary

**Current State**: The agent-executor autonomous activity execution pattern is 90% implemented. All core infrastructure exists:
- executeActivityInline() for isolated execution ✅
- Lifecycle hooks for trigger-based automation ✅
- Background workers for condition-based triggers ✅
- Goal-seeking template creation ✅
- Thompson Sampling for learning ✅
- Impulse transfer pattern ✅

**Critical Gap**: Autonomous recovery when template not found (10% missing)
- TemplateSelector.select() throws error instead of triggering recovery
- Requires GoalInferenceEngine for goal inference
- Requires AutonomousActivityExecutor wrapper with retry logic
- Estimated effort: 1 week

**Validation Approach**: The validation harness will verify the self-healing behavior works without code changes by:
1. Testing existing infrastructure (lifecycle hooks, executeActivityInline)
2. Demonstrating the gap (template not found error)
3. Proving the infrastructure is ready (90% complete)
4. Providing implementation roadmap for the 10% gap

**Business Impact**: Once autonomous recovery is implemented, agents will be fully self-healing - they can create missing templates on-the-fly, reducing manual intervention and improving user experience. The system becomes more capable over time as it autonomously fills capability gaps through template creation.
