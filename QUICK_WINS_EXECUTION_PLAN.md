# Quick Wins Execution Plan

**Date**: 2026-02-18  
**Goal**: Execute 3 quick wins to immediately improve system reliability  
**Total Time**: 1.5-2 hours

---

## Current State → Desired State → Actions

### **Quick Win #1: Improve Activity Error Inspector** ⚡

#### **What We Need (Current State)**:
```
Problem: Activity fails, error inspector says "No Errors Found"
Evidence: 
- fix-bug-complete failed in 0.086s
- Inspector output: "No specific task errors detected"
- Must read raw JSON to understand: correctnessVerdict shows real issues

Current Inspector Output:
```
## No Errors Found

The activity failed but no specific task errors were detected in session logs.
This may indicate an infrastructure issue or validation failure.
Check the log file for more details: /home/avi/.local/share/opencode/log/dev.log
```
```

#### **Where We Want to Be (Desired State)**:
```
Improved Inspector Output:
```
## Activity Execution Issues Detected

Activity failed with no task execution (initialization failure).

### Correctness Verdict: INCORRECT (0% confidence)

Critical Issues (2):
1. ❌ No Work Done
   - No agent sessions spawned
   - Activity may not have done any work
   
2. ❌ Execution Failure  
   - Activity status is 'failed'
   - Check pre-flight validation requirements

Warnings (2):
1. ⚠️ Suspicious Timing
   - Activity completed in 0.1s with no evidence of work
   - Suggests immediate failure during setup
   
2. ⚠️ Missing Evidence
   - Validation was not executed
   - No tool calls recorded

### Likely Root Cause:
Pre-flight validation failure (strict requirements not met)

### Remediation:
1. Check template validation requirements
2. Ensure required files exist or relax validation
3. Review activity variables match template expectations
```
```

#### **What We Can Do About It**:

**Actions**:
1. Parse `activity.correctnessVerdict` field
2. Extract and display issues by severity
3. Add likely root cause analysis
4. Provide actionable remediation steps

**Files to Modify**:
- `packages/opencode/src/tool/activity-error-inspector.ts`

**Implementation**:
```typescript
// Add to analyzeActivityErrors function, after checking activity.error:

// Check correctnessVerdict for additional diagnostic info
if (activity.correctnessVerdict && activity.correctnessVerdict.computed) {
  const verdict = activity.correctnessVerdict
  
  if (verdict.verdict === "incorrect" && verdict.issues && verdict.issues.length > 0) {
    // Activity failed with diagnostic issues
    const criticalIssues = verdict.issues.filter(i => i.severity === "critical")
    const warnings = verdict.issues.filter(i => i.severity === "warning")
    
    taskErrors.push({
      taskId: "correctness-check",
      taskDescription: "Activity Execution Correctness Analysis",
      sessionId: "diagnostic",
      error: {
        type: "validation",
        message: `Activity verdict: ${verdict.verdict} (${verdict.confidence}% confidence)`,
        code: "CORRECTNESS_VERDICT_FAILED",
      },
      context: {
        agent: "activity-diagnostics",
        prompt: "Automated correctness checking",
        variables: {
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          criticalIssues: criticalIssues.length,
          warnings: warnings.length,
        },
      },
      diagnosticIssues: verdict.issues, // Store full issue list
      attempts: 1,
      cost: 0,
      duration: 0,
    })
  }
}
```

**Time**: 1 hour

---

### **Quick Win #2: Test fix-test-failure-simple Template** ⚡

#### **What We Need (Current State)**:
```
Problem: New template created but not tested
Status: Unknown if it works
Risk: May have same issues as fix-bug-complete

Template: fix-test-failure-simple
- 3 tasks (analyze, fix, verify)
- No strict validation
- Designed for test fixes
- Never executed
```

#### **Where We Want to Be (Desired State)**:
```
Verified Working Template:
- ✅ Successfully analyzes test failures
- ✅ Implements fixes correctly
- ✅ Verifies tests pass
- ✅ Completes without errors
- ✅ Evidence: Real execution with success status

Confidence: Template works and can be recommended
```

#### **What We Can Do About It**:

**Test Scenario** (Controlled, Simple):
```
Create a trivial test failure:
1. Write simple test that fails on purpose
2. Run template to fix it
3. Verify template succeeds and test passes
```

**Test Implementation**:
```typescript
// Create test file: test-scenario/simple-math.test.ts
test("addition works", () => {
  const result = add(2, 2)
  expect(result).toBe(5) // Wrong expectation
})

// Source file: test-scenario/simple-math.ts
export function add(a: number, b: number) {
  return a + b // Correct implementation
}
```

**Execute Template**:
```typescript
activity({
  templateId: "fix-test-failure-simple",
  variables: {
    test_failure_description: "Test expects add(2,2) to be 5 but implementation returns 4",
    error_message: "expect(received).toBe(expected)\nExpected: 5\nReceived: 4",
    test_file: "test-scenario/simple-math.test.ts",
    affected_files: "test-scenario/simple-math.ts",
  },
  reason: "Test new fix-test-failure-simple template on controlled scenario",
})
```

**Expected Outcome**:
- Template should identify: test expectation is wrong (should be 4, not 5)
- Template should fix: Change `toBe(5)` to `toBe(4)`
- Template should verify: Run test, confirm it passes
- Status: success

**Time**: 30-45 minutes

---

### **Quick Win #3: Check and Fix Log Configuration** ⚡

#### **What We Need (Current State)**:
```
Problem: Log files are binary, can't grep or read easily
Evidence:
```bash
$ cat /home/avi/.local/share/opencode/log/dev.log | grep error
grep: (standard input): binary file matches
```

Impact: Makes debugging very difficult
```

#### **Where We Want to Be (Desired State)**:
```
Text-based Logs:
```bash
$ cat /home/avi/.local/share/opencode/log/dev.log | grep error
ERROR 2026-02-18T12:00:00 service=activity activityId=act_xyz status=failed
ERROR 2026-02-18T12:00:01 service=session error="Template validation failed"
```

Benefits:
- Can grep logs easily
- Can read without special tools
- Can tail -f for debugging
- Can share log snippets
```

#### **What We Can Do About It**:

**Investigation Steps**:

1. **Check Log Configuration**:
```bash
# Find log config in opencode.json or config files
rg "log.*format|logger.*type" --type json repos/metabob-opencode
```

2. **Check pino Configuration** (likely logger):
```bash
# Look for pino setup
rg "pino|createLogger" --type ts repos/metabob-opencode/packages/opencode/src
```

3. **Check Log Initialization**:
```bash
# Find where Log is created
cat repos/metabob-opencode/packages/opencode/src/util/log.ts
```

**Common Fixes**:

**Option A**: Pino is using binary serialization
```typescript
// Current (binary):
const logger = pino({ ... })

// Fix (text):
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: false }
  }
})
```

**Option B**: Using bunyan or structured logging
```typescript
// Add .asJSON() → toString() conversion
```

**Option C**: Configuration flag
```json
// In opencode.json or similar
{
  "logging": {
    "format": "text",  // Change from "json" or "binary"
    "pretty": false
  }
}
```

**Time**: 15-30 minutes

---

## Execution Order

### **Session Plan** (1.5-2 hours total):

```
1. Quick Win #3: Log Configuration (15-30 min) ← START HERE
   ↓ Reason: Enables better debugging for everything else
   
2. Quick Win #1: Error Inspector (1 hour)
   ↓ Reason: Makes activity failures debuggable
   
3. Quick Win #2: Test Template (30-45 min)
   ↓ Reason: Verifies our template works
```

### **Why This Order**:

1. **Logs first**: Better logs help debug everything else
2. **Error inspector second**: Makes activity failures clear
3. **Test template third**: Validates improvements work

---

## Success Criteria

### **For Each Quick Win**:

✅ **Quick Win #1 (Error Inspector)**:
- [ ] Parses correctnessVerdict field
- [ ] Shows critical issues and warnings
- [ ] Provides likely root cause
- [ ] Gives actionable remediation
- [ ] Test: Run on failed activity, see improved output

✅ **Quick Win #2 (Test Template)**:
- [ ] Creates controlled test scenario
- [ ] Executes template successfully
- [ ] Template fixes the test correctly
- [ ] Verification shows test passing
- [ ] Activity status: success

✅ **Quick Win #3 (Logs)**:
- [ ] Identifies log format issue
- [ ] Implements fix (config or code)
- [ ] Verifies logs are now text-readable
- [ ] Can grep logs successfully
- [ ] Test: `grep ERROR` works on dev.log

---

## Expected Outcomes

### **Immediate Benefits**:
- ✅ Better activity debugging (error inspector)
- ✅ Verified working template (test-fix-simple)
- ✅ Readable logs (text format)

### **Compound Benefits**:
- All future activity debugging is easier
- Can recommend fix-test-failure-simple confidently
- Can grep logs for any investigation
- Enables faster iteration on remaining gaps

### **Metrics**:
- Activity debuggability: 3/10 → 7/10
- Template confidence: 0/10 → 8/10
- Log usability: 2/10 → 9/10

---

## Implementation Approach

### **For Each Quick Win**:

1. **Understand Current State** (5 min)
   - Read existing code
   - Verify problem still exists
   - Identify exact fix location

2. **Implement Fix** (bulk of time)
   - Make targeted changes
   - Keep scope minimal
   - Add comments explaining changes

3. **Test Fix** (5-10 min)
   - Verify fix works
   - Test edge cases
   - Document any limitations

4. **Commit** (2-3 min)
   - Clear commit message
   - Reference issue solved
   - Include before/after examples

---

## Ready to Execute

**Current Status**: 
- ✅ Plan complete
- ✅ Clear success criteria
- ✅ Execution order defined
- ✅ Time estimated realistically

**Next Action**: Execute Quick Win #3 (Logs) first

**Command to start**:
```bash
# Investigation step 1: Check log configuration
cd repos/metabob-opencode
cat packages/opencode/src/util/log.ts | head -100
```

Let's do this! 🚀
