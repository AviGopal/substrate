# Activity Template Creation Testing - Quick Start

**Goal**: Test `activity-create-v2` with agent behavior tracing to guide creation of a highly generalizable `create-activity-template`.

**Status**: Ready to execute ✅  
**Date**: February 14, 2026

---

## Prerequisites ✅

- [x] Container `devbob-clean` running and healthy
- [x] Backend `api-server-dev` accessible at port 8080/8082
- [x] Breadcrumb tracing system integrated in OpenCode
- [x] Test harness created (`scripts/trace-agent-behavior.sh`)
- [x] Sterile environment validated (workspace empty)

---

## Quick Test Execution

### Option 1: Single Test with Behavior Tracing (Recommended)

```bash
# Test minimal case with detailed agent observation
./scripts/trace-agent-behavior.sh devbob-clean minimal

# Review analysis immediately
cat validation-results/agent-behavior/*/ANALYSIS.md
```

**What this does**:
- Executes `activity-create-v2` with minimal test case
- Prompts agent to explain reasoning at each step
- Captures breadcrumbs, tool calls, decision points
- Generates analysis report automatically
- Extracts created template for inspection

**Time**: ~5-10 minutes

---

### Option 2: Full Test Suite

```bash
# Run all 3 test cases
for case in minimal complex vague; do
  echo "=== Testing: $case ==="
  ./scripts/trace-agent-behavior.sh devbob-clean $case
  echo ""
done

# Compare results
ls -la validation-results/agent-behavior/
```

**Time**: ~20-30 minutes

---

### Option 3: Sterile Environment Test (No Tracing)

```bash
# Original test script without verbose agent output
./scripts/test-activity-create-sterile.sh devbob-clean minimal
```

**Time**: ~3-5 minutes

---

## What Gets Captured

### Agent Behavior Data

1. **Decision Points**
   - What the agent decided to do
   - Why it made that decision
   - What alternatives it considered
   - Confidence level

2. **Tool Calls**
   - Which tools were invoked
   - What parameters were used
   - What results were returned

3. **Context Usage**
   - Which example templates were referenced
   - What annotations were consulted
   - What documentation was read

4. **Validation Behavior**
   - Schema validation attempts
   - Error handling patterns
   - Recovery strategies

5. **Performance Metrics**
   - Time per step
   - Total execution time
   - Retry attempts
   - Break points (if failure)

---

## Test Cases

### 1. Minimal (Baseline)
**Pattern**: "Simple hello world activity that prints a message and exits successfully"

**Expected Behavior**:
- 2-3 tasks
- Straightforward validation
- Quick execution (<3 min)
- High success rate

**Testing Focus**: Basic functionality

---

### 2. Complex (Stress Test)
**Pattern**: "Backup files: List source files → Create backup dir → Copy files → Verify"

**Expected Behavior**:
- 4-5 tasks
- Multiple validation points
- Sequential dependencies
- Moderate execution time (~5 min)

**Testing Focus**: Multi-step coordination

---

### 3. Vague (Ambiguity Handling)
**Pattern**: "Process data efficiently and output results"

**Expected Behavior**:
- Agent requests clarification OR
- Agent makes reasonable assumptions
- Documents assumptions in template
- Lower confidence reported

**Testing Focus**: How agent handles incomplete information

---

## Reading the Analysis Report

After execution, open `validation-results/agent-behavior/TIMESTAMP/ANALYSIS.md`

### Key Sections to Review

#### 1. Decision Points Observed
```
STEP: identify-pattern
CONTEXT: Reviewed pattern: "..."
DECISION: Categorizing as infrastructure with 3 tasks
REASONING: Pattern suggests sequential workflow
ALTERNATIVES: Could be 2 tasks (simpler) or 4 tasks (more granular)
CONFIDENCE: High
```

**Look for**:
- Does reasoning match the pattern?
- Are alternatives sensible?
- Is confidence justified?

#### 2. Stage Transitions (Breadcrumbs)
```
🔵 [STAGE:01] activity-invocation | ENTER
🟢 [STAGE:01] activity-invocation | EXIT | elapsed=150
🔵 [STAGE:05] task-execution | ENTER | taskId=identify-pattern
🟢 [STAGE:05] task-execution | EXIT | elapsed=8234
```

**Look for**:
- Do all stages complete (ENTER → EXIT)?
- Are there any errors (🔴)?
- Which stage took longest?
- Are there break points?

#### 3. Tool Calls Made
```
search_activities({ query: "similar to: hello world" })
register_activity_template({ file_path: "./hello-world-traced.json" })
activity({ activityId: "hello-world-traced", variables: {...} })
```

**Look for**:
- Did agent search for examples?
- Did agent validate before registering?
- Did agent test the created template?

#### 4. Created Template Analysis
```json
{
  "name": "Hello World",
  "category": "infrastructure",
  "task_count": 2,
  "tasks": [
    "Print greeting message",
    "Verify output and exit"
  ]
}
```

**Look for**:
- Task count in optimal range (3-5)?
- Task descriptions clear and actionable?
- Appropriate category?
- Reasonable validation strategy?

---

## Pattern Extraction Workflow

After reviewing analysis reports:

### Step 1: Identify Success Patterns
From successful executions, note:
- Agent behaviors that led to good outcomes
- Context that was most helpful
- Validation strategies that worked
- Recovery patterns that succeeded

**Example**:
> "Agent that searches for 3+ example templates before designing produces schemas with 95% validation pass rate"

### Step 2: Identify Failure Patterns
From failed executions, note:
- Agent behaviors that led to issues
- Missing context that caused problems
- Validation gaps
- Assumptions that were wrong

**Example**:
> "Agent skips schema validation when prompt emphasizes speed, leading to registration failures"

### Step 3: Extract Design Requirements
Convert patterns into template requirements:

**From Success Pattern**:
```
Observed: Agent searches examples → better schemas
Requirement: contextRequirements[0] = {
  key: "exampleTemplates",
  required: true,
  hint: "Search for 3+ similar templates with high success rates"
}
```

**From Failure Pattern**:
```
Observed: Agent skips validation → registration fails
Requirement: Add validation gate to Step 4 (create-template)
  - MUST run validation script before proceeding
  - MUST retry on validation failure (max 3 attempts)
  - Fail loudly if validation never passes
```

### Step 4: Design New Template Structure
Create `create-activity-template-v3.json` incorporating:
- Required context from successful patterns
- Validation gates to prevent failure patterns
- Clear guidance at decision points
- Self-contained operation (no source code dependencies)

---

## Immediate Next Steps

### 1. Run First Test (5 minutes)
```bash
./scripts/trace-agent-behavior.sh devbob-clean minimal
```

### 2. Review Analysis (5 minutes)
```bash
# Find latest result
LATEST=$(ls -td validation-results/agent-behavior/*/ | head -1)
cat "${LATEST}ANALYSIS.md"
```

### 3. Document Observations (10 minutes)
Create notes:
- What worked well?
- What needs improvement?
- What was surprising?
- What patterns emerged?

### 4. Iterate (Optional)
```bash
# Test complex case
./scripts/trace-agent-behavior.sh devbob-clean complex

# Test vague case
./scripts/trace-agent-behavior.sh devbob-clean vague

# Compare results
diff validation-results/agent-behavior/*/ANALYSIS.md
```

---

## Success Indicators

### Execution Success
- ✅ Exit code 0
- ✅ All 7 steps completed
- ✅ Template created and valid JSON
- ✅ Template registered successfully
- ✅ Test execution passed

### Agent Behavior Quality
- ✅ Agent explained reasoning clearly
- ✅ Agent referenced example templates
- ✅ Agent validated before proceeding
- ✅ Agent tested created template
- ✅ Agent recovered from errors gracefully

### Template Quality
- ✅ Task count in range 2-5
- ✅ Clear task descriptions
- ✅ Appropriate agent assignments
- ✅ Testable validation criteria
- ✅ Logical dependency order

---

## Troubleshooting

### No Breadcrumbs in Output
**Symptom**: `breadcrumbs.log` is empty

**Check**:
```bash
# Verify breadcrumb system exists
docker exec devbob-clean bash -c "ls -la /workspace/repos/metabob-opencode/packages/opencode/dist/session/execution-breadcrumbs.js"

# Check if logs are elsewhere
docker exec devbob-clean bash -c "find /root/.local/share/opencode -name '*.log'"
```

**Solution**: Breadcrumbs may be in container logs instead of ACP output. Check `container-logs.txt` in results directory.

---

### Agent Doesn't Explain Reasoning
**Symptom**: No "DECISION:" or "REASONING:" in output

**Issue**: Agent might not be following the verbose reporting format in prompt

**Solution**: This is actually interesting data! Document that agent doesn't naturally report reasoning without strong guidance. This informs template design.

---

### Template Not Created
**Symptom**: No JSON file in artifacts

**Check**:
```bash
# Search all temporary directories
docker exec devbob-clean bash -c "find /tmp -name '*.json' -mmin -30"

# Check for error messages
grep -i "error\|failed" validation-results/agent-behavior/*/acp-output.log
```

**Solution**: Review errors.txt in results directory to understand failure mode.

---

### Long Execution Time (>10 min)
**Symptom**: Test times out or takes very long

**Possible Causes**:
1. Agent got stuck in retry loop
2. Validation is slow
3. Test execution is complex

**Check**:
```bash
# Look for retry patterns
grep -c "retry\|attempt" validation-results/agent-behavior/*/acp-output.log

# Check stage timings
grep "elapsed" validation-results/agent-behavior/*/breadcrumbs.log
```

**Solution**: This is valuable data! Document which step is slow and why.

---

## What to Do With Results

### After First Test
1. **Read ANALYSIS.md carefully**
2. **Note 3-5 key observations** (successes and improvements)
3. **Check if template was created** and is reasonable
4. **Decide**: Run more tests OR start designing new template?

### After Multiple Tests
1. **Compare ANALYSIS.md files** across test cases
2. **Extract patterns** (what's consistent vs. what varies)
3. **Create pattern library** document
4. **Design new template** incorporating findings

### Final Output
Create `ACTIVITY_CREATE_AGENT_BEHAVIOR_PATTERNS.md`:
- Success patterns (reinforce these)
- Failure patterns (prevent these)
- Design requirements for new template
- Example showing improvements

---

## Timeline

**Today** (2-3 hours):
- Run 3 test cases (minimal, complex, vague)
- Review analysis reports
- Document patterns

**Tomorrow** (2-3 hours):
- Design new template structure
- Incorporate pattern requirements
- Add validation gates

**This Week**:
- Implement create-activity-template-v3
- Test new template
- Iterate based on results

---

## Ready to Start?

```bash
# Single command to begin
./scripts/trace-agent-behavior.sh devbob-clean minimal
```

Then review:
```bash
ls -la validation-results/agent-behavior/
cat validation-results/agent-behavior/*/ANALYSIS.md
```

The analysis report will guide next steps!
