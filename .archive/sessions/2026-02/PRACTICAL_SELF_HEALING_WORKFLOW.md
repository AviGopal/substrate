# Practical Self-Healing Workflow - Learning by Doing

**Philosophy**: Perfect practice makes perfect - Run → Fail → Diagnose → Improve → Repeat

---

## Current State: What We Can Do TODAY

### ✅ Tools Available Right Now
1. `search_activities` - Find templates by category
2. `activity` - Execute templates with variables
3. `activity_error_inspector` - Diagnose failed executions
4. `activity_replay` - Retry from failure point
5. `get_activity_template` - Inspect template definitions
6. `register_activity_template` - Register improved variants

### ✅ Templates Available
1. `debug-activity-self-contained-v3` - Uses `activity_error_inspector` tool
2. `evolve-activity-self-contained` - Generates improved variants
3. `create-activity-template` - Creates new templates

---

## Workflow: Learning by Doing

### Cycle 1: Run → Observe → Learn

#### Step 1: Pick a Simple Activity to Test
```typescript
// Search for available activities
search_activities({ verbose: true })

// Pick one to test (start simple)
const testActivity = "validate-build-complete" // or any simple one
```

#### Step 2: Run It and Expect Failure
```typescript
// Run with minimal context to see what happens
activity({
  templateId: testActivity,
  variables: {
    // Intentionally incomplete or wrong variables
  },
  reason: "Test run to observe failure patterns"
})
```

#### Step 3: Observe What Happened
**Questions to ask**:
- ✅ Which task failed?
- ✅ What was the error message?
- ✅ Was the error clear or cryptic?
- ✅ Did validation catch the issue?
- ✅ What tools did the agent try to use?
- ✅ Did the agent get confused?

### Cycle 2: Diagnose → Understand

#### Step 4: Use Error Inspector
```typescript
// Get detailed failure analysis
activity_error_inspector({
  // Leave empty to get most recent failure
  includeSessionLogs: true,
  includeToolCalls: true,
  maxMessagesPerTask: 20
})
```

**What to look for in the report**:
- **Error patterns**: Same error repeated?
- **Tool failures**: Which tools failed and why?
- **Agent confusion**: Did agent misunderstand prompt?
- **Validation issues**: Did validation help or confuse?
- **Resource limits**: Token limit? Timeout?

#### Step 5: Use Debug Activity (Automated Diagnosis)
```typescript
// Let the debug activity analyze it
activity({
  templateId: "debug-activity-self-contained-v3",
  variables: {
    executionId: "[ID from previous failure]"
  },
  reason: "Automated root cause analysis"
})
```

**Outputs to examine**:
- `EXECUTION_DETAILS.md` - What happened
- `ROOT_CAUSE_ANALYSIS.md` - Why it happened
- `FIXES.md` - How to fix it
- `DIAGNOSIS_REPORT.md` - Executive summary

### Cycle 3: Improve → Validate

#### Step 6: Apply Fixes Manually First
**Try quick fixes suggested in FIXES.md**:
- Adjust token budget?
- Add examples to prompt?
- Fix validation patterns?
- Add missing dependencies?

```typescript
// Retry with manual fixes via replay
activity_replay({
  activityId: "[original activity ID]",
  startFromTask: "[failed task ID]",
  overrideVariables: {
    // Adjusted variables based on diagnosis
  }
})
```

#### Step 7: If Fix Works, Use Evolve Activity
```typescript
// Generate improved template variant
activity({
  templateId: "evolve-activity-self-contained",
  variables: {
    templateId: "[original template ID]"
  },
  reason: "Create improved variant based on successful manual fix"
})
```

**Outputs to examine**:
- `TEMPLATE_ANALYSIS.md` - Current state
- `IMPROVEMENTS.md` - Proposed changes
- `[templateId]-improved.json` - New variant
- `EVOLUTION_REPORT.md` - What changed and why

#### Step 8: Test the Improved Variant
```typescript
// Manually register the improved template
register_activity_template({
  file_path: "[path-to-improved-template].json"
})

// Run it to see if improvement worked
activity({
  templateId: "[improved-template-id]",
  variables: {
    // Same variables as original
  },
  reason: "Validate improved template variant"
})
```

### Cycle 4: Document → Share

#### Step 9: Document Learnings
**Create a learning report**:

```markdown
# Learning Report: [Template Name]

## What We Tried
- Original execution with [variables]
- Failed at task [N] with error [message]

## What We Learned
1. **Root Cause**: [Why it failed]
2. **Key Issue**: [Specific problem]
3. **Pattern**: [Is this a common issue?]

## What We Changed
- Increased token budget: 8000 → 10000
- Added example to prompt: [example]
- Fixed validation pattern: [old → new]

## Results
- Before: 0/3 successes (0%)
- After: 3/3 successes (100%)
- Improvement: +100 percentage points

## Recommendation
- ✅ Promote improved variant to production
- ⚠️ Watch for similar issues in other templates
- 📝 Document pattern in template guidelines
```

---

## Patterns We're Looking For

### Good Patterns (Keep These!)
1. **Clear error messages** - Agent knows exactly what went wrong
2. **Good examples** - Prompts show desired output format
3. **Defensive validation** - Catches issues before they cascade
4. **Appropriate timeouts** - Enough time but not excessive
5. **Tool usage guidance** - Prompts specify which tools to use

### Bad Patterns (Fix These!)
1. **Vague prompts** - "Create output" (where? what format?)
2. **Token starvation** - Agent runs out mid-response
3. **Validation mismatch** - Checking for wrong patterns
4. **Missing dependencies** - Task needs output from non-dependent task
5. **Wrong agent assignment** - Needs tool agent, got general

### Failure Categories

#### Template Design Issues (Fix in Template)
- ❌ Insufficient token budget
- ❌ Vague prompt wording
- ❌ Incorrect validation rules
- ❌ Missing task dependencies
- ❌ Wrong agent selection

**Fix**: Update template JSON, test, register variant

#### Input Issues (Fix in Variables)
- ❌ Missing required variables
- ❌ Invalid variable values
- ❌ Wrong variable types

**Fix**: Provide correct variables, document requirements

#### Environment Issues (Fix in Setup)
- ❌ Missing tools/dependencies
- ❌ File permissions
- ❌ Network issues
- ❌ Disk space

**Fix**: Setup scripts, environment checks, better error messages

#### Transient Issues (Retry)
- ❌ API timeout
- ❌ Network glitch
- ❌ Rate limit

**Fix**: Retry with backoff, increase timeout, add resilience

---

## Practical Experiments

### Experiment 1: Token Budget Analysis
**Goal**: Find optimal token budgets for different task types

**Method**:
1. Run template with default token budget (8000)
2. If fails with "token limit exceeded":
   - Try +25% (10000)
   - If still fails, try +50% (12000)
   - If still fails, investigate prompt complexity
3. If succeeds with tokens remaining:
   - Try -25% (6000) to reduce cost
   - Find minimum that works reliably

**Learning**: Document optimal ranges per task complexity

### Experiment 2: Prompt Clarity Test
**Goal**: Measure how prompt wording affects success rate

**Method**:
1. Take a vague prompt: "Create output.json"
2. Make it specific: "Create output.json in current directory with structure: {...}"
3. Add example: "Create output.json with structure:\n```json\n{...}\n```"
4. Run each variant 3 times, measure success rate

**Learning**: Quantify impact of examples and specificity

### Experiment 3: Validation Effectiveness
**Goal**: See if validation helps or hinders

**Method**:
1. Run template with strict validation (many patterns)
2. Run template with loose validation (few patterns)
3. Run template with no validation
4. Compare: false positives, false negatives, success rate

**Learning**: Find validation sweet spot

### Experiment 4: Agent Assignment Test
**Goal**: See if agent choice matters

**Method**:
1. Run same task with `general` agent
2. Run same task with `tool` agent
3. Run same task with `test` agent
4. Compare success rate, cost, duration

**Learning**: Create agent selection guidelines

### Experiment 5: Dependency Impact
**Goal**: Understand task dependency patterns

**Method**:
1. Run template with sequential dependencies (A→B→C)
2. Run template with parallel execution (A+B→C)
3. Run template with no dependencies (A+B+C)
4. Measure total duration, failure propagation

**Learning**: Optimize dependency graphs for speed and resilience

---

## Metrics to Track

### Per-Template Metrics
- **Success Rate**: Executions succeeded / total executions
- **Average Cost**: Total cost / executions
- **Average Duration**: Total time / executions
- **Failure Rate by Task**: Which tasks fail most?
- **Retry Rate**: How often do retries help?

### System-Wide Metrics
- **Template Count**: How many templates exist?
- **Variant Count**: How many variants per template?
- **Evolution Rate**: Variants created / week
- **Auto-Recovery Rate**: Trailblazing successes / attempts
- **Manual Intervention Rate**: Human fixes / total failures

### Quality Metrics
- **Diagnosis Accuracy**: Correct root cause / total diagnoses
- **Fix Effectiveness**: Variants better than original / total variants
- **Regression Rate**: Variants worse than original / total variants
- **Learning Coverage**: Failures with diagnosis / total failures

---

## Next Actions (Immediate)

### Action 1: Set Up Logging
Create a simple tracking system:

```bash
# Create experiment log directory
mkdir -p ~/activity-experiments

# Log structure
~/activity-experiments/
  experiment-001-token-budgets/
    execution-001.log
    execution-002.log
    analysis.md
  experiment-002-prompt-clarity/
    ...
```

### Action 2: Run First Experiment
Pick the simplest experiment (Token Budget Analysis):

1. Choose a template that's known to work
2. Run it 3 times with default settings
3. Introduce a token limit issue (set too low)
4. Observe failure
5. Use debug-activity to diagnose
6. Use evolve-activity to fix
7. Validate improvement
8. Document findings

### Action 3: Create Improvement Tracking
Track all improvements in a central log:

```markdown
# Activity Template Improvements Log

## 2026-02-16: validate-build-complete
- **Issue**: Token limit exceeded in task-3
- **Root Cause**: Complex build output exceeds 8000 tokens
- **Fix**: Increased to 12000 tokens
- **Result**: 0% → 100% success rate
- **Variant ID**: validate-build-complete-v2
```

### Action 4: Build Pattern Library
Document common patterns as we discover them:

```markdown
# Activity Template Pattern Library

## Pattern: File Path Ambiguity
**Problem**: Agent doesn't know where to create files
**Solution**: Always specify full path or "current working directory"
**Example**: 
  Bad: "Create output.json"
  Good: "Create output.json in current working directory (pwd)"

## Pattern: Token Budget Sizing
**Guideline**: 
- Simple tasks: 4000-6000 tokens
- Medium tasks: 8000-12000 tokens
- Complex tasks: 12000-16000 tokens
- Very complex: 16000+ tokens

## Pattern: Validation Requirements
**Guideline**:
- Always validate file existence
- Always validate key content patterns
- Avoid over-specification (allows agent flexibility)
- Test validation with edge cases
```

---

## Success Indicators

After 1 week of this workflow:
- ✅ Ran at least 10 activity executions
- ✅ Diagnosed at least 5 failures
- ✅ Created at least 3 improved variants
- ✅ Documented at least 5 learnings
- ✅ Built pattern library with at least 10 patterns

After 1 month:
- ✅ Most templates have 80%+ success rate
- ✅ Rare failures are diagnosed automatically
- ✅ Improvement cycle is <24 hours
- ✅ Manual interventions are <20%

---

## Philosophy

> "The templates that survive are not the strongest, nor the smartest,  
> but those most adaptive to change."  
> — Darwin, adapted for activity templates 😄

**Key Principles**:
1. **Fail fast**: Don't be afraid to run incomplete templates
2. **Learn faster**: Diagnose every failure
3. **Improve fastest**: Apply learnings immediately
4. **Document everything**: Future you will thank you
5. **Iterate relentlessly**: Perfect practice makes perfect

---

**Let's start with Experiment 1: Token Budget Analysis!** 🚀

Pick a simple template and let's run it through the full cycle.
