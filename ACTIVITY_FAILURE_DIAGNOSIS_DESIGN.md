# Activity Failure Diagnosis System Design

**Date**: 2026-02-18  
**Goal**: Reliable mechanism for diagnosing why activities fail and what to do about it  
**Approach**: Multi-layer failure analysis with actionable remediation

---

## Problem Statement

**Current State**:
```
Activity fails → Error inspector says "No Errors Found"
User must:
1. Read raw activity record JSON
2. Parse correctnessVerdict manually
3. Grep binary logs (with -a flag)
4. Guess at root cause
5. Trial-and-error fixes

Result: Frustration, wasted time, low activity adoption
```

**Desired State**:
```
Activity fails → Automatic diagnosis with:
1. Clear identification of failure layer
2. Specific root cause
3. Actionable remediation steps
4. Examples of how to fix
5. Confidence in diagnosis

Result: Quick fixes, high activity adoption, continuous improvement
```

---

## Failure Taxonomy

### **Layer 1: Pre-Flight Failures** (Before Any Work)

**Characteristics**:
- No sessions spawned
- Duration < 1 second
- No tokens used
- Activity record has `error` field but no task execution

**Root Causes**:

#### **1.1 Git State Issues**
```
Code: WORKING_TREE_DIRTY, BRANCH_EXISTS, NOT_A_GIT_REPO
Symptom: "Cannot start activity: working tree has uncommitted changes"
Layer: Environment
Remediation:
  - git commit -am "wip: save before activity"
  - OR git stash
  - Then retry activity
```

#### **1.2 Template Not Found**
```
Code: TEMPLATE_NOT_FOUND, NOT_FOUND
Symptom: "Activity template 'foo' not found"
Layer: Configuration
Remediation:
  - Run: search_activities() to see available templates
  - Check spelling of templateId
  - Register template if it exists as file
```

#### **1.3 Variable Validation Errors**
```
Code: MISSING_VARIABLES, UNEXPECTED_VARIABLES, INVALID_VARIABLE_TYPE
Symptom: "Required variable 'bugDescription' not provided"
Layer: Input
Remediation:
  - Check template variables with: get_activity_template(id)
  - Provide all required variables
  - Remove unexpected variables
```

#### **1.4 Pre-Flight Validation Failure**
```
Code: VALIDATION_FAILED, PRE_FLIGHT_CHECK_FAILED
Symptom: Activity fails immediately, correctnessVerdict shows validation issues
Layer: Environment
Remediation:
  - Check template validation requirements
  - Ensure required files exist
  - Relax validation (use simpler template variant)
```

#### **1.5 Dependency Unavailable**
```
Code: MEMORY_AGENT_UNAVAILABLE, METABOB_UNAVAILABLE, REMOTE_UNAVAILABLE
Symptom: "Memory agent not available"
Layer: Infrastructure
Remediation:
  - Check config: sessionMemory.enabled
  - Verify service is running
  - Disable feature in template if not needed
```

---

### **Layer 2: Task Execution Failures** (Work Started, Then Failed)

**Characteristics**:
- 1+ sessions spawned
- Some tasks completed
- Specific task failed
- Session logs available

**Root Causes**:

#### **2.1 LLM Errors**
```
Code: MODEL_ERROR, RATE_LIMIT, TIMEOUT, TOKEN_LIMIT
Symptom: "Anthropic API error: rate limit exceeded"
Layer: External Service
Remediation:
  - Retry after delay (rate limit)
  - Reduce maxTokens (token limit)
  - Switch to different model
  - Check API key validity
```

#### **2.2 Tool Execution Errors**
```
Code: TOOL_ERROR, FILE_NOT_FOUND, PERMISSION_DENIED
Symptom: "Tool 'read' failed: ENOENT: no such file"
Layer: Execution
Remediation:
  - Check file path is correct
  - Ensure file exists before reading
  - Verify permissions
  - Use glob/grep to find files
```

#### **2.3 Validation Failures**
```
Code: VALIDATION_FAILED, REQUIRED_FILE_MISSING, PATTERN_NOT_FOUND
Symptom: "Task validation failed: required file 'BUG_ANALYSIS.md' not found"
Layer: Template Design
Remediation:
  - Agent didn't create required artifacts
  - Template validation too strict
  - Use simpler template variant
  - Update template to relax requirements
```

#### **2.4 Timeout Failures**
```
Code: TIMEOUT, TASK_TIMEOUT, SESSION_TIMEOUT
Symptom: Task takes > max allowed time
Layer: Performance
Remediation:
  - Increase timeout in task config
  - Reduce task complexity
  - Split into smaller tasks
```

#### **2.5 Agent Logic Errors**
```
Code: AGENT_ERROR, UNEXPECTED_BEHAVIOR
Symptom: Agent produces wrong output, infinite loops, etc.
Layer: LLM Behavior
Remediation:
  - Improve prompt clarity
  - Add more examples
  - Reduce ambiguity
  - Add stronger validation
```

---

### **Layer 3: Post-Execution Failures** (Work Done, But Wrong)

**Characteristics**:
- All tasks completed
- Activity marked as "completed" or "failed"
- correctnessVerdict computed
- Issues found in output validation

**Root Causes**:

#### **3.1 Correctness Issues**
```
Code: INCORRECT_OUTPUT, NO_WORK_DONE, MISSING_EVIDENCE
Symptom: correctnessVerdict.verdict = "incorrect", issues present
Layer: Output Quality
Remediation:
  - Review task outputs
  - Check if agent misunderstood requirements
  - Improve prompt specificity
  - Add examples to guidance
```

#### **3.2 Incomplete Work**
```
Code: INCOMPLETE, MISSING_ARTIFACTS, PARTIAL_COMPLETION
Symptom: Some tasks completed, others skipped
Layer: Execution Flow
Remediation:
  - Check task dependencies
  - Review which tasks failed
  - Fix upstream tasks
  - Retry from specific task
```

#### **3.3 Quality Gate Failures**
```
Code: QUALITY_GATE_FAILED, TESTS_FAILED, BUILD_FAILED
Symptom: Post-checks fail (tests, linting, build)
Layer: Integration
Remediation:
  - Run checks manually to see output
  - Fix issues identified by checks
  - Update code to pass checks
  - Relax checks if too strict
```

---

## Diagnosis Decision Tree

```
Activity Failed?
  |
  ├─> No sessions spawned?
  |   ├─> Yes: LAYER 1 (Pre-Flight)
  |   |   ├─> Check activity.error field
  |   |   ├─> Extract error code
  |   |   ├─> Map to root cause 1.1-1.5
  |   |   └─> Provide remediation
  |   |
  |   └─> No: Continue to Layer 2
  |
  ├─> Sessions spawned, some tasks failed?
  |   ├─> Yes: LAYER 2 (Task Execution)
  |   |   ├─> Find failed task
  |   |   ├─> Check session logs/tool calls
  |   |   ├─> Classify error type 2.1-2.5
  |   |   └─> Provide remediation
  |   |
  |   └─> No: Continue to Layer 3
  |
  └─> All tasks completed, but failed?
      └─> Yes: LAYER 3 (Post-Execution)
          ├─> Check correctnessVerdict
          ├─> Review issues by severity
          ├─> Classify issue type 3.1-3.3
          └─> Provide remediation
```

---

## Diagnosis Algorithm

### **Step 1: Load Activity Record**
```typescript
const activity = await Activity.load(activityId)

if (!activity) {
  return { error: "Activity not found", remediation: "Check activity ID" }
}
```

### **Step 2: Determine Failure Layer**
```typescript
function determineLayer(activity: Activity.Info): 1 | 2 | 3 {
  // Layer 1: Pre-flight (no sessions)
  if (activity.sessionIDs.length === 0) {
    return 1
  }
  
  // Layer 3: Post-execution (all tasks done, but verdict says incorrect)
  if (activity.status === "failed" && activity.correctnessVerdict?.computed) {
    if (activity.correctnessVerdict.verdict === "incorrect") {
      return 3
    }
  }
  
  // Layer 2: Task execution (default)
  return 2
}
```

### **Step 3: Extract Root Cause**
```typescript
function extractRootCause(activity: Activity.Info, layer: number): RootCause {
  switch (layer) {
    case 1:
      return analyzePreFlightFailure(activity)
    case 2:
      return analyzeTaskExecutionFailure(activity)
    case 3:
      return analyzeCorrectnessFailure(activity)
  }
}

interface RootCause {
  code: string
  category: string
  message: string
  evidence: string[]
  confidence: number // 0-1
}
```

### **Step 4: Generate Remediation**
```typescript
function generateRemediation(rootCause: RootCause): Remediation {
  // Map root cause to remediation steps
  const remediationMap: Record<string, Remediation> = {
    WORKING_TREE_DIRTY: {
      steps: [
        "Commit or stash uncommitted changes",
        "Command: git commit -am 'wip: save before activity'",
        "Or: git stash",
        "Then retry activity"
      ],
      preventionTips: [
        "Commit work before running activities",
        "Use activity branches for isolation"
      ]
    },
    TEMPLATE_NOT_FOUND: {
      steps: [
        "Search for available templates: search_activities()",
        "Check templateId spelling",
        "Register template if it exists: register_activity_template()"
      ],
      preventionTips: [
        "Always search_activities first",
        "Use exact template IDs from search results"
      ]
    },
    // ... more mappings
  }
  
  return remediationMap[rootCause.code] || {
    steps: ["Review activity logs", "Check error messages", "Consult documentation"],
    preventionTips: []
  }
}
```

### **Step 5: Format Diagnosis Report**
```typescript
interface DiagnosisReport {
  activityId: string
  status: string
  layer: 1 | 2 | 3
  layerName: string
  rootCause: RootCause
  remediation: Remediation
  evidence: Evidence
  relatedIssues: string[]
  confidence: number
}

function formatReport(diagnosis: DiagnosisReport): string {
  return `
# Activity Failure Diagnosis

**Activity**: ${diagnosis.activityId}
**Status**: ${diagnosis.status}
**Failure Layer**: ${diagnosis.layerName} (Layer ${diagnosis.layer})

## Root Cause (${diagnosis.confidence}% confident)

**Category**: ${diagnosis.rootCause.category}
**Code**: ${diagnosis.rootCause.code}
**Message**: ${diagnosis.rootCause.message}

## Evidence

${diagnosis.evidence.items.map(e => `- ${e}`).join('\n')}

## Remediation Steps

${diagnosis.remediation.steps.map((s, i) => `${i+1}. ${s}`).join('\n')}

## Prevention Tips

${diagnosis.remediation.preventionTips.map(t => `- ${t}`).join('\n')}

${diagnosis.relatedIssues.length > 0 ? `
## Related Issues

${diagnosis.relatedIssues.map(i => `- ${i}`).join('\n')}
` : ''}
`
}
```

---

## Implementation Plan

### **Phase 1: Enhanced Error Inspector** (1-2 hours)

Update `activity-error-inspector.ts`:

1. **Add Layer Detection**:
```typescript
const layer = determineLayer(activity)
const layerName = {
  1: "Pre-Flight Setup",
  2: "Task Execution", 
  3: "Post-Execution Validation"
}[layer]
```

2. **Parse correctnessVerdict**:
```typescript
if (activity.correctnessVerdict?.issues) {
  const critical = activity.correctnessVerdict.issues.filter(i => i.severity === "critical")
  const warnings = activity.correctnessVerdict.issues.filter(i => i.severity === "warning")
  
  // Add to error report
  report.correctnessIssues = {
    verdict: activity.correctnessVerdict.verdict,
    confidence: activity.correctnessVerdict.confidence,
    critical,
    warnings
  }
}
```

3. **Extract Error Codes**:
```typescript
function extractErrorCode(error: string): string | undefined {
  const codePatterns = [
    /WORKING_TREE_DIRTY/,
    /BRANCH_EXISTS/,
    /TEMPLATE_NOT_FOUND/,
    /MISSING_VARIABLES/,
    /RATE_LIMIT/,
    // ... more patterns
  ]
  
  for (const pattern of codePatterns) {
    if (pattern.test(error)) {
      return pattern.source.replace(/[\/\\]/g, '')
    }
  }
  
  return undefined
}
```

4. **Add Remediation Mapping**:
```typescript
const remediationDatabase: Record<string, Remediation> = {
  // Pre-flight failures
  WORKING_TREE_DIRTY: { ... },
  TEMPLATE_NOT_FOUND: { ... },
  MISSING_VARIABLES: { ... },
  
  // Task execution failures
  RATE_LIMIT: { ... },
  FILE_NOT_FOUND: { ... },
  VALIDATION_FAILED: { ... },
  
  // Post-execution failures
  NO_WORK_DONE: { ... },
  TESTS_FAILED: { ... },
}
```

---

### **Phase 2: Diagnosis Activity Template** (2-3 hours)

Create `diagnose-activity-failure.json`:

```json
{
  "name": "Diagnose Activity Failure",
  "description": "Comprehensive diagnosis of failed activity execution with root cause analysis and remediation",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "load-and-classify",
      "description": "Load activity record and classify failure layer",
      "prompt": {
        "template": "Load activity {{activityId}} and determine failure layer...",
        "variables": [
          { "name": "activityId", "required": true }
        ]
      }
    },
    {
      "id": "extract-root-cause",
      "description": "Extract root cause from activity record and logs",
      "dependencies": ["load-and-classify"],
      "prompt": {
        "template": "Analyze failure evidence and determine root cause..."
      }
    },
    {
      "id": "generate-remediation",
      "description": "Generate actionable remediation steps",
      "dependencies": ["extract-root-cause"],
      "prompt": {
        "template": "Based on root cause, provide specific remediation..."
      }
    }
  ]
}
```

---

### **Phase 3: Testing** (1 hour)

Test on known failures:

1. **Pre-flight**: `fix-bug-complete` (WORKING_TREE_DIRTY)
2. **Task execution**: Create failing template
3. **Post-execution**: Activity that completes but produces wrong output

---

## Expected Output Format

### **Example 1: Pre-Flight Failure**

```
# Activity Failure Diagnosis

**Activity**: act_mlrzzyyc_69e9ced46646ec38
**Status**: failed
**Failure Layer**: Pre-Flight Setup (Layer 1)
**Duration**: 0.086s

## Root Cause (95% confident)

**Category**: Environment Issue
**Code**: VALIDATION_FAILED
**Message**: Activity failed pre-flight validation - no work attempted

## Evidence

- No agent sessions spawned (0 sessions)
- Duration suspiciously short (0.086s)
- No tokens used (0 input, 0 output)
- correctnessVerdict shows critical issues:
  - ❌ No Work Done: "No agent sessions spawned - activity may not have done any work"
  - ❌ Execution Failure: "Activity status is 'failed'"
  - ⚠️ Suspicious Timing: "Activity completed very quickly (0.1s) with no evidence of work"

## Root Cause Analysis

Template: fix-bug-complete
First task requires strict validation:
- Required file: BUG_ANALYSIS.md
- Required patterns: "## Bug Analysis", "### Root Cause", etc.

Likely cause: Validation requirements not met before any work could start

## Remediation Steps

1. Use simpler template variant: fix-test-failure-simple
   - No strict file requirements
   - Faster for test fixes
   
2. OR relax validation in fix-bug-complete:
   - Edit template JSON
   - Remove requiredFiles array
   - Remove strict requiredPatterns
   
3. OR ensure environment meets requirements:
   - Check template validation with: get_activity_template("fix-bug-complete")
   - Create required files before starting
   - Use activity with more forgiving validation

## Prevention Tips

- Always check template validation requirements first
- Use specialized templates for specific scenarios
- Test templates on simple cases before complex ones
- Consider creating template variants with relaxed validation

## Similar Failures

- evolve-activity-self-contained (failed on generation task)
- Other activities with strict validation may fail similarly
```

### **Example 2: Task Execution Failure**

```
# Activity Failure Diagnosis

**Activity**: act_xyz123
**Status**: failed
**Failure Layer**: Task Execution (Layer 2)
**Duration**: 45.3s

## Root Cause (88% confident)

**Category**: Tool Execution Error
**Code**: FILE_NOT_FOUND
**Message**: Task 2 failed - agent attempted to read non-existent file

## Evidence

- Task 1: analyze-bug ✅ completed (12.5s, $0.03)
- Task 2: implement-fix ❌ failed (32.8s, $0.08)
- Task 3: verify ⏭️ not attempted

Tool call that failed:
```
read({ filePath: "packages/opencode/src/foo/bar.ts" })
Error: ENOENT: no such file or directory
```

## Root Cause Analysis

Agent was instructed to fix code in specific file, but:
1. File path was provided in variables
2. File doesn't exist (typo or wrong path)
3. Agent didn't verify file exists before attempting to read

## Remediation Steps

1. Fix the file path in activity variables:
   ```
   affected_files: "packages/opencode/src/tool/bash.ts"  # Correct path
   ```

2. Retry activity with corrected variables

3. OR update template to add defensive checks:
   - Use glob to find files by pattern
   - Verify file exists before reading
   - Provide clearer file path guidance

## Prevention Tips

- Verify file paths before providing as variables
- Use glob/grep to find files first
- Provide relative paths from project root
- Test with simple scenarios before complex ones
```

---

## Success Criteria

✅ **Diagnostic Accuracy**:
- Correctly identifies failure layer (95%+ accuracy)
- Extracts root cause (80%+ accuracy)
- Provides actionable remediation (100%)

✅ **User Experience**:
- Clear, concise diagnosis report
- Specific, actionable steps
- Examples of how to fix
- Prevention tips for future

✅ **Coverage**:
- Handles all 3 failure layers
- Covers common failure modes (15+ types)
- Gracefully handles unknown failures

✅ **Performance**:
- Diagnosis completes in < 5 seconds
- No expensive operations (no re-running tasks)
- Leverages existing activity record

---

## Implementation Priority

1. **Phase 1**: Enhanced error inspector (HIGH - immediate value)
2. **Phase 2**: Testing on known failures (HIGH - validate approach)
3. **Phase 3**: Diagnosis activity template (MEDIUM - automation)

**Start with**: Phase 1 - Update error inspector now!

---

## Next Steps

1. Implement enhanced error inspector with layer detection
2. Add correctnessVerdict parsing
3. Add remediation mapping
4. Test on fix-bug-complete failure
5. Document findings and iterate
