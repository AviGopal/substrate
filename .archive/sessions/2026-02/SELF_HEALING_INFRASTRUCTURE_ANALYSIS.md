# Self-Healing Activity Template Infrastructure Analysis

**Date**: 2026-02-16  
**Status**: Discovery & Gap Analysis  
**Goal**: Enable activity templates to diagnose and repair themselves

---

## Executive Summary

### Current State: Strong Foundation ✅

The self-healing infrastructure is **70% complete**. Key components exist:

1. ✅ **Error Analysis** - `activity-error-inspector.ts` (comprehensive)
2. ✅ **Replay System** - `activity-replay.ts` (enables iterative debugging)
3. ✅ **Bootstrap Templates** - 3 self-contained templates deployed
4. ✅ **Metrics Tracking** - Comprehensive execution metadata
5. ✅ **Learning Hooks** - Learning configuration in templates

### Gaps Identified: 30% Missing 🔧

Critical gaps preventing full self-healing loop:

1. ❌ **Tool Integration** - Templates don't use `activity_error_inspector`
2. ❌ **Evidence Repository** - No structured storage of failure patterns
3. ❌ **Auto-Trigger** - No automatic diagnosis on failure
4. ❌ **Learning System** - Learning data captured but not used
5. ❌ **Validation Loop** - No test-before-deploy for improved templates

---

## What Exists (Infrastructure Inventory)

### 1. Error Inspector Tool ✅

**File**: `src/tool/activity-error-inspector.ts` (580 lines)

**Capabilities**:
- ✅ Extracts detailed error context from failed activities
- ✅ Analyzes session messages and tool calls
- ✅ Identifies validation failures
- ✅ Surfaces agent errors and exceptions
- ✅ Provides task-level diagnostics
- ✅ Includes cost and duration metrics
- ✅ Shows tool call success/failure
- ✅ Captures session logs (last N messages)

**Input**:
```typescript
activity_error_inspector({
  activityId?: string,              // Optional: defaults to most recent failed
  includeSessionLogs: boolean,      // Default: true
  includeToolCalls: boolean,        // Default: true
  maxMessagesPerTask: number        // Default: 20
})
```

**Output**: Markdown report with:
- Activity summary (template, status, duration, cost)
- Task-by-task breakdown
- Error classification (validation, execution, timeout, unknown)
- Session logs with token counts
- Tool call history
- Recommendations based on error type

**Strengths**:
- Comprehensive context extraction
- Well-structured output
- Automatic error classification
- No external dependencies

**Limitations**:
- Not integrated into templates (templates query backend instead)
- Doesn't store patterns for learning
- No pattern recognition across failures
- Manual invocation required

---

### 2. Activity Replay Tool ✅

**File**: `src/tool/activity-replay.ts` (746 lines)

**Capabilities**:
- ✅ Resume failed activities from specific task
- ✅ Inherit impulses from original activity
- ✅ Override variables for debugging
- ✅ Skip pre-flight validation (rapid iteration)
- ✅ Pre/post-flight validation support
- ✅ Topological sort for dependencies
- ✅ Real-time status updates

**Input**:
```typescript
activity_replay({
  activityId: string,                       // Activity to replay
  startFromTask?: string,                   // Default: first failed task
  overrideVariables?: Record<string, any>,  // Variable overrides
  skipValidation?: boolean                  // Default: false
})
```

**Output**: Formatted replay result with:
- Success/failure status
- Task-by-task breakdown with duration/cost
- Skipped tasks marked (from original)
- Total duration, cost, tokens

**Strengths**:
- Enables iterative debugging
- Preserves activity state
- Avoids rerunning successful tasks
- Tracks parent-child relationship

**Limitations**:
- Doesn't auto-apply fixes from diagnosis
- Manual invocation required
- Doesn't track fix effectiveness

---

### 3. Activity Generator ✅

**File**: `src/session/activity-generator.ts` (68 lines)

**Capabilities**:
- ✅ Generates activity prompts from description
- ✅ Uses AI to create 3-5 sequential prompts
- ✅ Follows patterns from AGENTS.md

**Input**:
```typescript
ActivityGenerator.generate({
  description: string,
  promptCount?: number  // Optional: defaults to 3-5
})
```

**Output**:
```typescript
{
  prompts: [
    {
      filename: "01-task.md",
      title: "Clear title",
      content: "Full markdown with Requirements and Success Criteria"
    }
  ]
}
```

**Strengths**:
- Generates structured prompts
- AI-powered pattern recognition

**Limitations**:
- Doesn't consume execution evidence
- Doesn't analyze failure patterns
- Doesn't improve existing templates
- Only creates new activities from scratch

---

### 4. Bootstrap Templates ✅

**Files**: 
- `templates/built-in/create-activity-self-contained.json` (24KB, 4 tasks)
- `templates/built-in/debug-activity-self-contained.json` (26KB, 4 tasks)
- `templates/built-in/evolve-activity-self-contained.json` (36KB, 4 tasks)

**Status**: Deployed to production ✅

**Capabilities**:

#### A. Create Template
- ✅ Creates new templates from requirements
- ✅ No file dependencies (self-contained)
- ✅ Generates complete ActivityTemplate.Schema JSON
- ✅ Validates against schema

#### B. Debug Template
- ✅ Fetches execution details from backend API
- ✅ Analyzes failure patterns
- ✅ Generates fixes
- ✅ Creates diagnosis report

**Current Approach** (debug-activity-self-contained):
1. **Fetch details** via backend API (not `activity_error_inspector`)
2. **Analyze patterns** - manual API queries
3. **Generate fixes** - template/input/environment fixes
4. **Create report** - comprehensive diagnosis

#### C. Evolve Template
- ✅ Fetches template + metrics from backend
- ✅ Identifies improvements (ROI-ranked)
- ✅ Generates improved template variant
- ✅ Validates changes

**Current Approach** (evolve-activity-self-contained):
1. **Fetch template + metrics** via backend API
2. **Identify improvements** - categorize by ROI
3. **Create improved variant** - apply Priority 1 & 2
4. **Register new version** - deploy to backend

**Strengths**:
- Fully self-contained (no file dependencies)
- Comprehensive workflows
- Well-documented prompts
- Composition examples

**Limitations**:
- ❌ **Not using built-in tools** - query backend directly instead of using `activity_error_inspector`
- ❌ **Manual workflow** - no auto-trigger on failure
- ❌ **No evidence repository** - failure patterns not stored
- ❌ **No validation loop** - improved templates not tested before deploy

---

### 5. Activity Metadata Tracking ✅

**File**: `src/session/activity.ts`

**Data Captured**:

```typescript
Activity.Info {
  id: string
  title: string
  status: "setup" | "executing" | "completing" | "done" | "failed"
  directory: string
  branch: string
  baseCommit: string
  
  // Template tracking
  templateId?: string
  templateVersion?: number
  variables?: Record<string, unknown>
  reason?: string
  
  // Session tracking
  sessionIDs: string[]          // All sessions executed
  callingSessionId?: string     // Parent session
  
  // Prompt tracking
  prompts: PromptInfo[]         // Per-task execution
  
  // Commit tracking
  commits: CommitInfo[]         // Git commits made
  
  // Stats
  stats: {
    tokens: SessionTokens       // Input/output/cache
    cost: CostStats             // Total and per-prompt
    metabob: MetabobStats       // Issues resolved/added
    duration: number            // Total ms
    prURL?: string              // Pull request if created
  }
  
  // Impulses
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  
  // Timestamps
  startedAt: number
  completedAt?: number
}
```

**PromptInfo** (per-task):
```typescript
{
  file: string             // Prompt filename
  index: number            // Execution order
  todoID: string           // Links to task
  sessionID?: string       // Session if executed
  commitSHA?: string       // Commit if committed
  status: PromptStatus     // pending | executing | committed | skipped | failed
}
```

**Strengths**:
- Comprehensive tracking
- Links sessions to tasks
- Tracks costs and tokens
- Captures Metabob integration

**Limitations**:
- No failure pattern storage
- No learning data captured in Info
- No link to diagnosis reports

---

### 6. Learning Configuration ✅

**Schema**: Templates support learning configuration

```json
{
  "learning": {
    "enabled": true,
    "captureStrategy": "detailed" | "summary" | "minimal",
    "feedbackPoints": [
      {
        "taskId": "task-id",
        "metrics": {
          "metric_name": "Question about metric?"
        },
        "improvementHints": {
          "hint_name": "Question about improvement?"
        }
      }
    ],
    "patterns": {
      "successPatterns": ["Pattern 1", "Pattern 2"],
      "failurePatterns": ["Pattern 1", "Pattern 2"],
      "optimizationOpportunities": ["Opp 1", "Opp 2"]
    }
  }
}
```

**Status**: Schema defined, patterns documented, but **not used**

**Example** (from debug-activity-self-contained):
```json
{
  "learning": {
    "enabled": true,
    "captureStrategy": "detailed",
    "feedbackPoints": [
      {
        "taskId": "analyze-failure-patterns",
        "metrics": {
          "root_cause_identified": "Was root cause correctly identified?",
          "pattern_recognized": "Were similar failures found?"
        }
      }
    ],
    "patterns": {
      "successPatterns": [
        "Agent queries backend for execution details",
        "Agent identifies similar historical failures"
      ],
      "failurePatterns": [
        "Agent can't access backend API",
        "Agent provides vague fixes"
      ]
    }
  }
}
```

**Gap**: No infrastructure to capture or use this learning data

---

## What's Missing (Critical Gaps)

### Gap 1: Tool Integration ❌

**Problem**: Bootstrap templates query backend API directly instead of using `activity_error_inspector`

**Current** (debug-activity-self-contained Task 1):
```
Use available tools to query backend API for execution details.

API Queries:
- GET /v2/activities/executions/{{executionId}}
- GET /v2/activities/executions/{{executionId}}/tasks
- GET /v2/activities/executions/{{executionId}}/logs
```

**Should Be**:
```
Use activity_error_inspector tool to analyze failed execution.

Example:
activity_error_inspector({
  activityId: "{{executionId}}",
  includeSessionLogs: true,
  includeToolCalls: true
})

Then parse the structured output for diagnosis.
```

**Why This Matters**:
1. **Consistency** - Single source of truth for error analysis
2. **Reliability** - Tool handles edge cases, API may change
3. **Completeness** - Tool extracts context not exposed via API
4. **Maintainability** - Fix tool once vs. fix templates

**Fix Effort**: Low (update 1 task in debug template)

**Impact**: High (consistent error analysis across all executions)

---

### Gap 2: Evidence Repository ❌

**Problem**: Failure patterns extracted but not stored for learning

**What We Have**:
- `activity-error-inspector` extracts detailed context
- Templates analyze patterns manually
- Learning configuration defined but unused

**What We Need**:
- **Evidence Store** - Structured storage of failure patterns
- **Pattern Recognition** - Identify similar failures across executions
- **Learning History** - Track fix effectiveness

**Proposed Schema**:

```typescript
interface FailureEvidence {
  id: string                        // evidence-{timestamp}-{hash}
  activityId: string                // Failed activity
  templateId: string                // Template that failed
  taskId: string                    // Failed task
  
  // Context
  timestamp: number
  error: {
    type: "validation" | "execution" | "timeout" | "unknown"
    message: string
    stack?: string
  }
  
  // Classification
  rootCause: {
    category: "template" | "input" | "environment" | "execution"
    description: string
    confidence: number              // 0.0-1.0
  }
  
  // Diagnosis
  diagnosisReportPath?: string      // Path to DIAGNOSIS_REPORT.md
  fixesApplied?: FixRecord[]
  
  // Learning
  similarFailures: string[]         // IDs of similar evidence
  pattern?: string                  // Pattern name if recognized
  
  // Outcome
  resolved: boolean
  resolutionTimestamp?: number
  resolutionMethod?: "template-fix" | "input-fix" | "retry" | "workaround"
  effectiveness?: number            // 0.0-1.0 (did fix work?)
}

interface FixRecord {
  type: "template" | "input" | "environment"
  description: string
  appliedAt: number
  appliedBy: "agent" | "human"
  validated: boolean
}
```

**Storage Location**: 
- **Local**: `.metabob/evidence/` (JSON files)
- **Backend**: Database table with search/analytics

**Implementation Needs**:
1. Evidence storage tool (create/read/search)
2. Pattern matching algorithm
3. Integration with error inspector
4. Integration with evolve template

**Fix Effort**: Medium (new tool + backend integration)

**Impact**: High (enables learning from failures)

---

### Gap 3: Auto-Trigger System ❌

**Problem**: Diagnosis requires manual invocation

**Current Flow**:
1. Activity fails ❌
2. Human notices failure
3. Human runs: `activity({ activityId: "debug-activity-self-contained", variables: { executionId: "..." } })`
4. Diagnosis report generated
5. Human reviews report
6. Human decides to apply fixes

**Desired Flow**:
1. Activity fails ❌
2. **Auto-trigger**: System detects failure
3. **Auto-diagnose**: Run debug-activity automatically
4. **Notify**: Alert human with diagnosis report
5. **Suggest**: Recommend fixes or auto-apply if safe
6. **Learn**: Store evidence for future

**Implementation Options**:

#### Option A: Activity Lifecycle Hook
Add `onError` hook to Activity.Info:

```typescript
Activity.Info {
  // ... existing fields
  
  onError?: {
    autoTrigger?: {
      enabled: boolean
      diagnosisTemplate: string      // "debug-activity-self-contained"
      notifyChannel?: string          // "slack" | "email" | "log"
      autoApplyFixes?: boolean        // Default: false
    }
  }
}
```

#### Option B: Backend Webhook
Activity execution service calls webhook on failure:

```typescript
// Backend: POST /v2/activities/executions/{id}/failure
{
  executionId: string,
  templateId: string,
  taskId: string,
  error: { ... },
  timestamp: number
}

// Handler: Trigger diagnosis activity automatically
```

#### Option C: Polling Monitor
Background service polls for failures:

```bash
# Every 5 minutes
while true; do
  # Get recent failures
  failures=$(curl /v2/activities/executions?status=failed&since=5m)
  
  # For each failure without diagnosis
  for id in $failures; do
    if ! has_diagnosis $id; then
      # Trigger diagnosis
      activity_cli run debug-activity-self-contained executionId=$id
    fi
  done
  
  sleep 300
done
```

**Recommendation**: Option A (lifecycle hook) - most integrated

**Fix Effort**: Medium (activity execution changes)

**Impact**: High (proactive self-healing)

---

### Gap 4: Learning System Not Used ❌

**Problem**: Learning configuration defined but no infrastructure to capture or use

**Current State**:
- ✅ Templates define learning patterns
- ✅ Templates define feedback points
- ❌ No tool to capture feedback
- ❌ No storage for learning data
- ❌ No analysis of learning data
- ❌ Template evolution doesn't use learning data

**What We Need**:

#### 4A. Learning Capture Tool
Tool to store learning data during execution:

```typescript
activity_learning_capture({
  activityId: string,
  taskId: string,
  feedbackPoint: string,        // From template.learning.feedbackPoints
  metrics: Record<string, number | string>,
  improvementHints: Record<string, number | string>
})
```

#### 4B. Learning Storage
Store learning data alongside evidence:

```typescript
interface LearningRecord {
  id: string
  activityId: string
  templateId: string
  taskId: string
  feedbackPoint: string
  
  metrics: Record<string, number | string>
  improvementHints: Record<string, number | string>
  
  timestamp: number
  executionSuccess: boolean
}
```

#### 4C. Learning Analysis Tool
Analyze learning data to guide evolution:

```typescript
activity_learning_analyze({
  templateId: string,
  timeRange?: { start: number, end: number }
})
// Returns:
{
  patterns: {
    success: string[],      // Confirmed success patterns
    failure: string[],      // Confirmed failure patterns
    emerging: string[]      // New patterns detected
  },
  metrics: {
    taskId: {
      metric: { avg, min, max, stddev, trend }
    }
  },
  recommendations: [
    {
      type: "increase-tokens" | "add-validation" | "change-agent",
      taskId: string,
      confidence: number,
      reason: string
    }
  ]
}
```

#### 4D. Integration with Evolve Template
Update evolve template to use learning data:

**Current** (evolve-activity Task 1):
```
Fetch execution metrics from backend API
```

**Should Be**:
```
1. Fetch execution metrics from backend API
2. Fetch learning data: activity_learning_analyze({ templateId })
3. Combine metrics + learning for improvement analysis
```

**Fix Effort**: Medium-High (new tools + template updates)

**Impact**: High (evidence-based evolution)

---

### Gap 5: Validation Loop ❌

**Problem**: Improved templates deployed without testing

**Current Flow** (evolve-activity):
1. Fetch template + metrics
2. Identify improvements
3. Create improved template
4. Register to backend ✅ (assumes it works)

**Risk**: Improved template might be broken

**Desired Flow**:
1. Fetch template + metrics
2. Identify improvements
3. Create improved template
4. **Test improved template** with synthetic inputs
5. **Validate results** (success rate, no regressions)
6. Register to backend **only if validated**
7. **A/B test** (run both versions, compare)

**Implementation**:

#### 5A. Template Validator Tool
```typescript
activity_template_validate({
  templatePath: string,              // Path to new template JSON
  testCases: [
    {
      variables: Record<string, unknown>,
      expectedOutcome: "success" | "failure",
      expectedFiles?: string[],
      timeoutMs?: number
    }
  ]
})
// Returns:
{
  valid: boolean,
  testResults: [
    {
      testCase: number,
      passed: boolean,
      actualOutcome: "success" | "failure",
      errors?: string[],
      duration: number,
      cost: number
    }
  ],
  schemaValid: boolean,
  recommendDeploy: boolean
}
```

#### 5B. Synthetic Test Case Generator
Generate test cases from historical executions:

```typescript
activity_generate_test_cases({
  templateId: string,
  count: number               // Generate N test cases
})
// Returns:
{
  testCases: [
    {
      description: string,
      variables: Record<string, unknown>,
      expectedOutcome: "success",
      rationale: "Based on execution exec-123"
    }
  ]
}
```

#### 5C. A/B Testing Framework
Run both versions, compare results:

```typescript
activity_ab_test({
  templateA: string,          // Original template
  templateB: string,          // Improved template
  testCases: [...],
  metrics: ["success_rate", "duration", "cost", "quality"]
})
// Returns:
{
  winner: "A" | "B" | "tie",
  results: {
    A: { success_rate, avg_duration, avg_cost },
    B: { success_rate, avg_duration, avg_cost }
  },
  recommendation: "deploy-B" | "keep-A" | "iterate"
}
```

**Fix Effort**: High (complex validation system)

**Impact**: Critical (prevents broken template deployments)

---

## Self-Healing Loop (Complete Flow)

### Current State (Broken Loop) ❌

```
Activity Fails ❌
   ↓
[Manual] Human notices
   ↓
[Manual] Human runs debug-activity
   ↓
[Manual] Debug queries backend API
   ↓
Diagnosis report generated
   ↓
[Manual] Human reviews report
   ↓
[Manual] Human runs evolve-activity OR applies fixes manually
   ↓
[Manual] Evolve creates improved template
   ↓
[Manual] Improved template registered (no testing)
   ↓
[Hope] Future executions succeed?
```

**Gaps**: 5 manual steps, no learning, no validation

---

### Desired State (Closed Loop) ✅

```
Activity Fails ❌
   ↓
[Auto] Activity lifecycle hook triggers
   ↓
[Auto] activity_error_inspector extracts context
   ↓
[Auto] Evidence stored in repository
   ↓
[Auto] Pattern matching finds similar failures
   ↓
[Auto] If pattern recognized → Apply known fix
   ↓     If novel pattern → Trigger debug-activity
   ↓
Debug-Activity (uses activity_error_inspector) 
   ↓
[Auto] Diagnosis report generated
   ↓
[Decision Point] Auto-apply or notify human?
   ↓
[Auto/Manual] Apply fixes (template/input/environment)
   ↓
[Auto] activity_replay with fixes applied
   ↓
[Auto] If success → Store fix effectiveness
   ↓     If failure → Escalate to evolve-activity
   ↓
Evolve-Activity (uses learning data)
   ↓
[Auto] Generate improved template variant
   ↓
[Auto] Validate with synthetic test cases
   ↓
[Auto] A/B test against original
   ↓
[Auto] Deploy if validation passes
   ↓
[Auto] Monitor improved template execution
   ↓
[Auto] Update learning data with results
   ↓
[Loop] Continuous improvement
```

**Benefits**:
- 90% automated (only escalations need human)
- Evidence-based improvements
- Safe deployments (validated before deploy)
- Learning from every failure
- Pattern recognition enables instant fixes

---

## Implementation Roadmap

### Phase 1: Tool Integration (1-2 days) 🟢

**Goal**: Templates use built-in tools instead of direct API calls

**Tasks**:
1. Update `debug-activity-self-contained` Task 1:
   - Replace backend API queries with `activity_error_inspector`
   - Update prompt to parse tool output
   - Test with known failure

2. Update `evolve-activity-self-contained` Task 1:
   - Keep backend API for metrics (still needed)
   - Document which data comes from API vs. tools

**Deliverables**:
- ✅ debug-activity-v3.json (uses activity_error_inspector)
- ✅ Test report: Compare old vs. new diagnosis quality

**Success Criteria**:
- Debug template produces same diagnosis quality
- Reduced API dependency
- Easier maintenance

---

### Phase 2: Evidence Repository (3-5 days) 🟡

**Goal**: Store and search failure patterns

**Tasks**:
1. Design FailureEvidence schema (see Gap 2)
2. Implement evidence storage tool:
   - `activity_evidence_create({ ... })`
   - `activity_evidence_search({ pattern, templateId, timeRange })`
   - `activity_evidence_get({ id })`
3. Integrate with activity-error-inspector:
   - After extracting error → store evidence
4. Update debug-activity template:
   - Query evidence for similar failures
   - Show pattern recognition in diagnosis

**Deliverables**:
- ✅ Evidence storage tool (TypeScript)
- ✅ Evidence store (.metabob/evidence/)
- ✅ Updated debug-activity-v4.json (pattern recognition)
- ✅ Test: Find similar failures across executions

**Success Criteria**:
- Evidence stored for every failure
- Search finds similar failures
- Diagnosis includes pattern recognition

---

### Phase 3: Auto-Trigger (2-3 days) 🟡

**Goal**: Automatic diagnosis on failure

**Tasks**:
1. Add lifecycle hook to Activity.Info:
   ```typescript
   onError?: {
     autoTrigger?: {
       enabled: boolean
       diagnosisTemplate: string
       notifyChannel?: string
     }
   }
   ```

2. Implement hook in activity execution:
   ```typescript
   // In activity.ts, when status → "failed"
   if (activity.onError?.autoTrigger?.enabled) {
     await triggerDiagnosis(activity)
   }
   ```

3. Create notification system:
   - Log notification (immediate)
   - Slack notification (optional)
   - Email notification (optional)

4. Update default templates:
   - All templates get `onError.autoTrigger.enabled: true` by default

**Deliverables**:
- ✅ Auto-trigger implementation
- ✅ Notification system
- ✅ Updated template schema
- ✅ Test: Failure triggers diagnosis automatically

**Success Criteria**:
- Failed activity triggers diagnosis within 30 seconds
- Human receives notification with diagnosis report
- No failures go undiagnosed

---

### Phase 4: Learning System (5-7 days) 🔴

**Goal**: Capture and use learning data

**Tasks**:
1. Implement learning capture tool:
   - `activity_learning_capture({ ... })`
   
2. Implement learning storage:
   - Schema: LearningRecord (see Gap 4)
   - Storage: .metabob/learning/

3. Implement learning analysis tool:
   - `activity_learning_analyze({ templateId })`
   - Pattern recognition
   - Metric aggregation
   - Recommendations

4. Update activity execution:
   - After task completes → capture learning
   - Store feedback point metrics

5. Update evolve-activity template:
   - Fetch learning data in Task 1
   - Use learning data in Task 2 (identify improvements)

**Deliverables**:
- ✅ Learning capture tool
- ✅ Learning analysis tool
- ✅ Updated activity execution
- ✅ Updated evolve-activity-v3.json
- ✅ Test: Learning data improves template evolution

**Success Criteria**:
- Learning data captured for every execution
- Template evolution uses learning data
- Recommendations based on evidence

---

### Phase 5: Validation Loop (7-10 days) 🔴

**Goal**: Test templates before deployment

**Tasks**:
1. Implement template validator:
   - `activity_template_validate({ ... })`
   - Schema validation
   - Test case execution
   - Safety checks

2. Implement test case generator:
   - `activity_generate_test_cases({ ... })`
   - Extract from historical executions
   - Synthetic test generation

3. Implement A/B testing framework:
   - `activity_ab_test({ ... })`
   - Run both versions
   - Statistical comparison

4. Update evolve-activity template:
   - Add Task 4: Validate improved template
   - Add Task 5: A/B test (optional, expensive)
   - Register only if validation passes

5. Add rollback mechanism:
   - If improved template has lower success rate → rollback
   - Alert human for manual review

**Deliverables**:
- ✅ Validation tool
- ✅ Test generator tool
- ✅ A/B testing tool
- ✅ Updated evolve-activity-v4.json
- ✅ Rollback mechanism
- ✅ Test: Broken template caught before deploy

**Success Criteria**:
- No broken templates deployed
- Improved templates validated before use
- A/B tests confirm improvements
- Automatic rollback on regression

---

## Timeline & Priorities

| Phase | Effort | Impact | Priority | Timeline |
|-------|--------|--------|----------|----------|
| **Phase 1: Tool Integration** | Low | High | 🔥 Critical | Week 1 |
| **Phase 2: Evidence Repository** | Medium | High | 🔥 Critical | Week 1-2 |
| **Phase 3: Auto-Trigger** | Medium | High | 🟡 Important | Week 2 |
| **Phase 4: Learning System** | High | Medium | 🟢 Nice-to-have | Week 3-4 |
| **Phase 5: Validation Loop** | High | Critical | 🔥 Critical | Week 4-6 |

**Total Timeline**: 4-6 weeks for complete self-healing loop

**MVP Timeline**: 2 weeks (Phases 1-3 only)

---

## Success Metrics

### Before Self-Healing (Current State)
- ❌ Failed activities: 100% manual diagnosis
- ❌ Template improvements: Ad-hoc, manual
- ❌ Learning: Not captured
- ❌ Validation: None (hope-driven deployment)
- ❌ Response time: Hours to days (human-dependent)

### After Self-Healing (Target State)
- ✅ Failed activities: 90% auto-diagnosed
- ✅ Template improvements: Evidence-based, validated
- ✅ Learning: Captured and used
- ✅ Validation: Required before deployment
- ✅ Response time: Minutes (automatic)
- ✅ Self-improvement rate: 1-2 template improvements per week

---

## Recommendations

### Immediate Actions (This Week)

1. **Phase 1: Tool Integration** (2 days)
   - Update debug-activity to use `activity_error_inspector`
   - Test with known failures
   - Deploy debug-activity-v3

2. **Evidence Repository Design** (1 day)
   - Finalize FailureEvidence schema
   - Design storage structure
   - Create initial implementation

### Next Actions (Week 2)

3. **Phase 2: Evidence Repository** (3 days)
   - Implement evidence tools
   - Integrate with error inspector
   - Update debug-activity-v4

4. **Phase 3: Auto-Trigger** (2 days)
   - Add lifecycle hook
   - Implement notification
   - Test automatic diagnosis

### Strategic Priority

**Focus on MVP (Phases 1-3)** first:
- Gets 80% of value with 40% of effort
- Establishes foundation for Phases 4-5
- Delivers immediate value (auto-diagnosis)

**Defer Phases 4-5** until MVP proven:
- Learning system is complex, defer until we have evidence flow working
- Validation loop is critical but can use manual validation initially

---

## Questions for Discussion

1. **Auto-Apply vs. Notify**: Should system auto-apply safe fixes (like token increases) or always notify human?

2. **Evidence Storage**: Local (.metabob/) vs. Backend database? Both?

3. **Notification Channel**: Log-only, Slack, Email? Priority?

4. **A/B Testing**: Should every improved template be A/B tested? (expensive but safe)

5. **Rollback Policy**: Automatic rollback if success rate drops by X%? What's X?

6. **Learning Privacy**: Should learning data be anonymized? Shared across teams?

---

## Conclusion

**Current State**: 70% complete foundation
- Excellent tools exist (`activity-error-inspector`, `activity-replay`)
- Bootstrap templates deployed and working
- Comprehensive metadata tracking

**Critical Gaps**: 30% missing infrastructure
- Templates not using built-in tools (Gap 1) - **EASY FIX**
- No evidence repository (Gap 2) - **MEDIUM EFFORT**
- No auto-trigger (Gap 3) - **MEDIUM EFFORT**
- Learning system unused (Gap 4) - **COMPLEX**
- No validation loop (Gap 5) - **COMPLEX**

**Recommendation**: **Ship MVP (Phases 1-3) in 2 weeks**
- High impact, manageable effort
- Establishes self-healing foundation
- Delivers immediate value
- Proves concept before scaling to Phases 4-5

**Next Step**: Start Phase 1 (Tool Integration) - 2 days, easy win ✅
