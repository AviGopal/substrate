# The Real Validation Problem: Detecting Silent Failures

**Date**: February 17, 2026  
**Critical Insight**: Activities can complete with `status: "done"` while doing the wrong thing

---

## The Problem We Actually Have

### What I Validated (Wrong Focus)
✅ Activity executes end-to-end  
✅ Metrics are collected  
✅ Status updates to "done"  
✅ No exceptions thrown  

### What I SHOULD Have Validated (Real Problem)
❌ Did the activity do what it was supposed to do?  
❌ How do we know the output is correct?  
❌ How do we detect when it silently fails?  
❌ How do we diagnose incorrect behavior?  

---

## The Silent Failure Problem

### Example Failure Modes

**Scenario 1: Wrong Implementation**
```
Activity: "Add REST endpoint for user profiles"
Status: done ✅
Actual Behavior: Created endpoint but validation is broken
Metrics: All collected
Observable: Activity "succeeded" but feature doesn't work
```

**Scenario 2: Missing Requirements**
```
Activity: "Fix authentication bug"
Status: done ✅
Actual Behavior: Fixed one case, missed edge cases
Metrics: All collected
Observable: Activity "succeeded" but bug still occurs
```

**Scenario 3: Incomplete Work**
```
Activity: "Refactor with tests"
Status: done ✅
Actual Behavior: Refactored code, tests don't exist
Metrics: All collected
Observable: Activity "succeeded" but requirements not met
```

### The Core Issue

**Current System**:
```
Activity completes → status: "done" → ✅ Success!
```

**Reality**:
```
Activity completes → status: "done" → ??? Did it do the right thing?
```

---

## What "Success" Should Mean

### Levels of Validation

#### Level 0: Execution Completion (What we have now)
- Activity runs without exceptions
- Status updates to "done"
- Metrics collected
- **Problem**: Tells us nothing about correctness

#### Level 1: Task Validation (What we need)
- Required files exist
- Required patterns present in code
- Validation commands pass
- **Problem**: We have this in templates, but are we checking it?

#### Level 2: Behavioral Validation (What we need)
- Tests pass
- Build succeeds
- API responds correctly
- Feature actually works
- **Problem**: Need to verify actual behavior, not just completion

#### Level 3: Specification Validation (What we need)
- Original requirements met
- Edge cases handled
- Integration points work
- **Problem**: Need to compare intent vs outcome

---

## How to Know If Something Succeeded

### 1. Validation Commands (Already in Templates)

From activity templates:
```json
{
  "validation": {
    "requiredFiles": ["src/feature.ts", "test/feature.test.ts"],
    "requiredPatterns": {
      "src/feature.ts": ["export.*function.*feature"],
      "test/feature.test.ts": ["describe.*feature"]
    },
    "forbiddenPatterns": {
      "src/feature.ts": ["console\\.log", "debugger"]
    },
    "commands": [
      {
        "command": "npm test -- feature.test",
        "description": "Run feature tests",
        "expectSuccess": true
      }
    ]
  }
}
```

**Question**: Are we actually running these validation commands?

### 2. Post-Execution Verification

**What we should check**:
```typescript
interface ActivityVerification {
  // Template-defined validation
  requiredFilesExist: boolean
  requiredPatternsFound: boolean
  forbiddenPatternsAbsent: boolean
  validationCommandsPassed: boolean
  
  // Behavioral validation
  testsPassed: boolean
  buildSucceeded: boolean
  noNewErrors: boolean
  
  // Specification validation
  requirementsMet: boolean
  edgeCasesHandled: boolean
  integrationWorking: boolean
}
```

### 3. Differential Analysis

**Compare before vs after**:
```typescript
interface DifferentialValidation {
  // What changed?
  filesAdded: string[]
  filesModified: string[]
  filesDeleted: string[]
  
  // Did it improve things?
  newTestsAdded: number
  testPassRate: { before: number, after: number }
  codeQualityScore: { before: number, after: number }
  
  // Did it break things?
  newErrors: Error[]
  regressionTests: { before: number, after: number }
  brokenIntegrations: string[]
}
```

---

## Diagnosing When Things Go Wrong

### Detection Strategies

#### Strategy 1: Template Validation (Built-in)

**Check**: Are validation rules defined in the template?

```bash
# Check template has validation
cat ~/.local/share/opencode/storage/activity-template/ultra-simple-test.json | jq '.tasks[].validation'
```

**If validation exists**: Are we running it?  
**If validation missing**: Template is incomplete

#### Strategy 2: Post-Activity Inspection

**Check**: What actually changed?

```bash
# Compare before/after
git diff <base-commit> <activity-branch>

# Check if expected files exist
ls -la <expected-files>

# Run validation commands manually
npm test
npm run build
npm run lint
```

#### Strategy 3: Behavioral Testing

**Check**: Does the feature actually work?

```bash
# For API endpoints
curl http://localhost:3000/api/feature
# Expected: 200 OK with correct schema

# For CLI features
opencode <feature-command>
# Expected: Correct output

# For refactorings
npm test
# Expected: All tests pass
```

#### Strategy 4: Specification Comparison

**Check**: Compare intent vs outcome

```typescript
interface SpecificationCheck {
  // What was requested?
  userRequest: string
  activityReason: string
  templateVariables: Record<string, any>
  
  // What was delivered?
  filesChanged: string[]
  testsAdded: string[]
  commitMessages: string[]
  
  // Does it match?
  requirementsCovered: boolean
  missingRequirements: string[]
  unexpectedChanges: string[]
}
```

---

## Current System Gaps

### Gap 1: Validation Execution Not Visible

**Evidence from ground truth**:
```json
{
  "status": "done",
  "todos": [],
  "prompts": [],
  "sessionIDs": [],
  "commits": []
}
```

**Questions**:
- Were validation commands run?
- Did they pass?
- What was the output?
- Were any validation rules violated?

**We don't know** - This data isn't in the activity storage file.

### Gap 2: No Behavioral Verification

**Missing from storage**:
- Test results
- Build status
- Lint/type check status
- Integration test status

**We're not verifying** actual behavior, just completion.

### Gap 3: No Specification Comparison

**Missing**:
- Was the original requirement met?
- What was requested vs what was delivered?
- Were edge cases considered?
- Did the agent understand the task correctly?

### Gap 4: No Differential Analysis

**Missing**:
- Before/after comparison
- What improved?
- What broke?
- Net impact assessment

---

## What We Need to Build

### 1. Validation Execution Tracker

**Capture**:
```typescript
interface ValidationExecution {
  templateValidation: {
    requiredFiles: { file: string, exists: boolean }[]
    requiredPatterns: { file: string, pattern: string, found: boolean }[]
    forbiddenPatterns: { file: string, pattern: string, found: boolean }[]
    commands: { 
      command: string, 
      exitCode: number, 
      stdout: string, 
      stderr: string,
      passed: boolean 
    }[]
  }
  overallValidationPassed: boolean
  validationFailures: string[]
}
```

**Store in**: Activity storage file (new field)

### 2. Behavioral Verification System

**Check**:
```typescript
interface BehavioralVerification {
  tests: {
    command: "npm test",
    passed: boolean,
    summary: { total: number, passed: number, failed: number }
  }
  build: {
    command: "npm run build",
    succeeded: boolean,
    errors: string[]
  }
  typecheck: {
    command: "tsc --noEmit",
    passed: boolean,
    errors: number
  }
  lint: {
    command: "npm run lint",
    passed: boolean,
    warnings: number
  }
}
```

**Store in**: Activity storage file (new field)

### 3. Specification Validator

**Compare**:
```typescript
interface SpecificationValidation {
  userRequest: string
  activityReason: string
  templateVariables: Record<string, any>
  
  // LLM-based comparison
  llmVerification: {
    requirementsMet: boolean
    missingRequirements: string[]
    unexpectedBehavior: string[]
    confidence: number
  }
  
  // Rule-based comparison
  ruleBasedVerification: {
    expectedFilesCreated: boolean
    expectedTestsAdded: boolean
    expectedCommitsMade: boolean
  }
}
```

**Store in**: Activity storage file (new field)

### 4. Differential Analyzer

**Compare before/after**:
```typescript
interface DifferentialAnalysis {
  codeChanges: {
    filesAdded: number
    filesModified: number
    filesDeleted: number
    linesAdded: number
    linesDeleted: number
  }
  
  quality: {
    testCoverage: { before: number, after: number, delta: number }
    codeQualityScore: { before: number, after: number, delta: number }
    technicalDebt: { before: number, after: number, delta: number }
  }
  
  behavior: {
    testsPassing: { before: number, after: number, delta: number }
    buildStatus: { before: boolean, after: boolean }
    newErrors: Error[]
    fixedErrors: Error[]
  }
}
```

**Store in**: Activity storage file (new field)

---

## Immediate Investigation Steps

### Step 1: Check if Validation is Running

**Questions**:
1. Do templates have validation rules defined?
2. Is the activity executor running these validations?
3. Are validation results being stored?
4. Are validation failures causing activities to fail?

**Investigation**:
```bash
# Check template validation rules
find ~/.local/share/opencode/storage/activity-template -name "*.json" | \
  xargs jq '.tasks[].validation' | grep -v null

# Check if activity storage captures validation
cat ~/.local/share/opencode/storage/activity/act_mlrbjv8n_331b8b6386b93d61.json | \
  jq '.validation'

# Search code for validation execution
cd repos/metabob-opencode
rg "validation.*command" --type ts
rg "runValidation" --type ts
```

### Step 2: Check Session Logs for Validation

**Questions**:
1. Did the sub-session run validation commands?
2. What was the output?
3. Did tests pass?
4. Did build succeed?

**Investigation**:
```bash
# Check if sessionIDs are tracked
cat ~/.local/share/opencode/storage/activity/act_mlrbjv8n_331b8b6386b93d61.json | \
  jq '.sessionIDs'

# If sessions exist, check their logs
# (Would need to implement session log retrieval)
```

### Step 3: Manual Behavioral Verification

**For our ground truth activity**:
```bash
# What did ultra-simple-test actually do?
git diff HEAD~1 HEAD  # Check what changed

# Did it create the expected file?
# (Need to check template to see what it's supposed to do)

# Run any validation commands from template
# (Need to extract validation commands from template)
```

### Step 4: Check Template Implementation

**Read the ultra-simple-test template**:
```bash
# Get template content
cat ~/.local/share/opencode/storage/activity-template/ultra-simple-test.json | jq '.'

# Check for validation rules
cat ~/.local/share/opencode/storage/activity-template/ultra-simple-test.json | \
  jq '.tasks[].validation'

# Check prompt to understand intent
cat ~/.local/share/opencode/storage/activity-template/ultra-simple-test.json | \
  jq '.tasks[].prompt'
```

---

## Root Cause Analysis Framework

### When an Activity "Succeeds" but is Wrong

**Debugging Steps**:

1. **Check Template Validation**
   - Does template have validation rules?
   - Were they executed?
   - Did they pass/fail?
   - Are they sufficient to catch the error?

2. **Check Behavioral Output**
   - What files changed?
   - Do tests pass?
   - Does build succeed?
   - Does the feature actually work?

3. **Check Specification Match**
   - What was requested?
   - What was delivered?
   - Do they match?
   - What's missing?

4. **Check Agent Understanding**
   - Did agent understand the task?
   - Were variables clear?
   - Was prompt ambiguous?
   - Did agent make wrong assumptions?

5. **Check Template Quality**
   - Is template prompt clear?
   - Are validation rules comprehensive?
   - Does template enforce requirements?
   - Should template be improved?

---

## Proposed Solution Architecture

### Enhanced Activity Storage Schema

```typescript
interface EnhancedActivityStorage {
  // Existing fields...
  id: string
  status: "pending" | "in_progress" | "done" | "failed"
  stats: ActivityStats
  
  // NEW: Validation tracking
  validation: {
    executed: boolean
    passed: boolean
    results: ValidationResults
    failures: ValidationFailure[]
  }
  
  // NEW: Behavioral verification
  behavior: {
    testsRun: boolean
    testResults: TestResults
    buildStatus: BuildStatus
    lintStatus: LintStatus
  }
  
  // NEW: Specification comparison
  specification: {
    userRequest: string
    delivered: DeliveredWork
    match: SpecificationMatch
    missingRequirements: string[]
  }
  
  // NEW: Differential analysis
  differential: {
    filesChanged: FileChangeSummary
    qualityDelta: QualityDelta
    behaviorDelta: BehaviorDelta
  }
  
  // NEW: Correctness verdict
  correctness: {
    validated: boolean
    correct: boolean
    confidence: number
    issues: CorrectnessIssue[]
  }
}
```

### Validation Pipeline

```typescript
async function validateActivity(activity: Activity): Promise<CorrectnessVerdict> {
  // 1. Run template validation
  const templateValidation = await runTemplateValidation(activity)
  
  // 2. Run behavioral verification
  const behavioralVerification = await runBehavioralVerification(activity)
  
  // 3. Compare specification vs delivery
  const specificationMatch = await compareSpecification(activity)
  
  // 4. Analyze before/after differences
  const differential = await analyzeDifferential(activity)
  
  // 5. Compute overall correctness verdict
  return computeCorrectnessVerdict({
    templateValidation,
    behavioralVerification,
    specificationMatch,
    differential
  })
}
```

---

## Immediate Next Steps

### Priority 1: Investigate Current Validation

**Goal**: Understand if validation is running at all

**Actions**:
1. Read ultra-simple-test template
2. Check if it has validation rules
3. Search codebase for validation execution
4. Determine if validation results are stored

### Priority 2: Manual Verification of Ground Truth

**Goal**: Manually verify if ultra-simple-test did the right thing

**Actions**:
1. Read template to understand expected behavior
2. Check git diff to see actual changes
3. Compare expected vs actual
4. Document discrepancies (if any)

### Priority 3: Design Correctness Validation System

**Goal**: Build system to detect silent failures

**Actions**:
1. Design enhanced activity storage schema
2. Design validation pipeline
3. Design correctness verdict algorithm
4. Implement in activity executor

### Priority 4: Retrofit Existing Templates

**Goal**: Add comprehensive validation to all templates

**Actions**:
1. Audit existing templates for validation rules
2. Identify templates with weak/missing validation
3. Add comprehensive validation to each template
4. Test validation catches common failures

---

## Success Criteria (Revised)

### How We'll Know It Works

**Level 1: Validation Execution**
- ✅ Every activity runs its validation commands
- ✅ Validation results stored in activity file
- ✅ Validation failures cause activity to fail

**Level 2: Behavioral Verification**
- ✅ Tests automatically run after activity
- ✅ Build automatically run after activity
- ✅ Results stored in activity file
- ✅ Failures detected and reported

**Level 3: Specification Match**
- ✅ System compares request vs delivery
- ✅ Missing requirements identified
- ✅ Unexpected behavior detected
- ✅ Confidence score computed

**Level 4: Correctness Verdict**
- ✅ Overall correctness computed
- ✅ Silent failures detected
- ✅ Issues categorized and prioritized
- ✅ Human review triggered when needed

---

## The Real Question

**Not**: "Did the activity complete?"  
**But**: "Did the activity do what it was supposed to do?"

**Not**: "Are metrics collected?"  
**But**: "Does the output match the specification?"

**Not**: "Is status 'done'?"  
**But**: "Is the feature correct and working?"

---

## Conclusion

**What I validated** (wrong focus):
- ✅ Activity system executes
- ✅ Metrics are collected
- ✅ Status updates work

**What I should validate** (real problem):
- ❌ Activity does the right thing
- ❌ Output matches specification
- ❌ Requirements are met
- ❌ Silent failures are detected

**Next Session**: Investigate current validation system and design correctness validation pipeline.

---

**Status**: 🔴 Problem correctly identified  
**Priority**: 🔥 Critical (silent failures are the real risk)  
**Next**: Investigate validation execution in activity system
