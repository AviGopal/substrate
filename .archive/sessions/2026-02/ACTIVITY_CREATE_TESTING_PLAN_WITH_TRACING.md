# Activity Template Creation Testing with Agent Tracing

**Objective**: Test `activity-create-v2` template while observing agent decision-making to guide creation of a highly generalizable, reliable, and self-contained `create-activity-template` template.

**Date**: February 14, 2026

---

## Testing Infrastructure

### Available Tracing Tools

1. **Breadcrumb System** (`repos/metabob-opencode/packages/opencode/src/session/execution-breadcrumbs.ts`)
   - Lightweight stage-based logging
   - Tracks: ENTER → EXIT/ERROR at each boundary
   - Enables break point detection
   - Correlation IDs thread through execution

2. **Activity Execution Tracer** (`trace_activity_execution.py`)
   - Python-based execution tracer
   - Structured JSON output
   - Backend API call tracking

3. **Log Analyzer** (`analyze_execution_trace.py`)
   - Performance analysis
   - Event timeline reconstruction
   - Break point identification

4. **Container Log Tracer** (`scripts/trace-backend-connectivity.sh`)
   - Multi-container log aggregation
   - Real-time streaming

---

## Test Environment

### Container: devbob-clean
- **Status**: Running and healthy (8+ hours uptime)
- **Workspace**: Sterile (empty except config)
- **Backend**: api-server-dev accessible at port 8080 (internal) / 8082 (host)
- **OpenCode**: Installed with breadcrumb support
- **Purpose**: Validate sterile environment execution

### Test Harness
- **Script**: `scripts/test-activity-create-sterile.sh`
- **Test Cases**: minimal, complex, vague
- **Output**: Structured results in `validation-results/sterile-tests/`

---

## Testing Strategy

### Phase 1: Instrumented Execution (Breadcrumb Tracing)

**Goal**: Observe agent behavior during activity-create-v2 execution

**Approach**:
1. Enable breadcrumb logging in OpenCode (verify enabled)
2. Execute activity-create-v2 with test case
3. Collect breadcrumb logs from execution
4. Analyze decision points and stage timing

**Key Observations to Capture**:
- **Step transitions**: How agent moves between 7 steps
- **Context usage**: What impulses/context agent references
- **Validation behavior**: How agent handles validation failures
- **Recovery patterns**: Trailblazing invocation and results
- **Time per stage**: Performance bottlenecks
- **Error patterns**: Common failure modes

**Breadcrumb Stages to Monitor** (from activity-create-v2):
```
01: activity-invocation       → Entry to activity tool
02: template-loading          → Loading activity-create-v2 
03: activity-initialization   → Setting up execution context
04: session-creation          → Creating agent session
05: task-execution            → Executing each of 7 steps
06: activity-completion       → Finalizing and extracting results
```

**Test Command**:
```bash
# Enable verbose logging in container
docker exec devbob-clean bash -c "
  cd /workspace && \
  export DEBUG='*breadcrumb*' && \
  opencode acp --cwd /workspace --log-level debug
" < test-prompt.txt 2>&1 | tee execution-with-breadcrumbs.log
```

---

### Phase 2: Deep Dive on Key Steps

For each of the 7 activity-create-v2 steps, analyze:

#### Step 1: identify-pattern
**What to observe**:
- How does agent extract actionable info from vague patterns?
- Does it ask clarifying questions or make assumptions?
- What context does it reference (examples, annotations)?

**Success indicators**:
- ✅ Converts vague pattern to concrete requirements
- ✅ Identifies appropriate category
- ✅ Estimates reasonable task count

**Failure patterns**:
- ❌ Accepts vague input without refinement
- ❌ Misidentifies category
- ❌ Over/under-estimates complexity

#### Step 2: define-scope
**What to observe**:
- How does agent determine granularity?
- Does it reference similar templates for guidance?
- How does it handle scope creep?

**Success indicators**:
- ✅ 3-5 task breakdown (optimal range)
- ✅ Clear task boundaries
- ✅ References example templates

**Failure patterns**:
- ❌ Too many tasks (>7)
- ❌ Overlapping tasks
- ❌ Ignores examples

#### Step 3: design-steps
**What to observe**:
- Agent selection strategy
- Dependency graph construction
- Validation strategy design

**Success indicators**:
- ✅ Appropriate agent assignments
- ✅ Logical dependency order
- ✅ Testable validation for each task

**Failure patterns**:
- ❌ All tasks use "general" agent
- ❌ Circular dependencies
- ❌ Vague validation ("check if works")

#### Step 4: create-template
**What to observe**:
- How does agent handle JSON schema?
- Does it reference example templates?
- Error handling when schema validation fails

**Success indicators**:
- ✅ Valid JSON structure
- ✅ All required fields present
- ✅ References examples for patterns

**Failure patterns**:
- ❌ Schema violations
- ❌ Missing required fields
- ❌ Ignores example patterns

#### Step 5: validate-schema
**What to observe**:
- Does agent run validation script?
- How does it respond to validation errors?
- Does it retry with corrections?

**Success indicators**:
- ✅ Runs validation script
- ✅ Interprets error messages correctly
- ✅ Fixes issues iteratively

**Failure patterns**:
- ❌ Skips validation
- ❌ Ignores validation errors
- ❌ Gives up after first failure

#### Step 6: test-execute
**What to observe**:
- Does agent use `activity` tool to test?
- How does it provide test variables?
- Recovery when test fails

**Success indicators**:
- ✅ Uses activity tool
- ✅ Provides realistic test variables
- ✅ Analyzes test failures

**Failure patterns**:
- ❌ Skips testing
- ❌ Invalid test variables
- ❌ Ignores test failures

#### Step 7: create-summary
**What to observe**:
- Summary quality and completeness
- Documentation of key decisions
- Reflection on process

**Success indicators**:
- ✅ Concise summary (not verbose)
- ✅ Documents design rationale
- ✅ Includes usage examples

**Failure patterns**:
- ❌ Generic summary
- ❌ Missing rationale
- ❌ No usage guidance

---

### Phase 3: Pattern Extraction

After observing 3-5 executions with different test cases, extract patterns:

#### Successful Patterns (Reinforce in new template)
- Example: "Agent that references 3+ example templates produces better schemas"
- Example: "Agent that validates JSON before proceeding has 95% success rate"
- Example: "Breaking complex patterns into sub-patterns reduces ambiguity"

#### Failure Patterns (Prevent in new template)
- Example: "Agent skips examples when prompt is vague → add explicit example requirement"
- Example: "Agent creates too many tasks when scope is unclear → add task count guidance"
- Example: "Agent uses generic validation when specific checks available → provide validation library"

#### Optimization Opportunities (Enhance in new template)
- Example: "Add pattern library of common activity types with templates"
- Example: "Provide task estimation rubric based on complexity"
- Example: "Create validation checklist for agent to follow"

---

## Test Cases

### 1. Minimal Case (Baseline)
**Pattern**: "Simple hello world activity that prints a message"
**Expected**: 2-3 tasks, straightforward execution
**Purpose**: Verify basic functionality works

### 2. Complex Case (Stress Test)
**Pattern**: "Backup files activity: list sources, create backup dir, copy files, verify"
**Expected**: 4-5 tasks, multiple validation points
**Purpose**: Test multi-step coordination

### 3. Vague Case (Ambiguity Handling)
**Pattern**: "Process data efficiently and output results"
**Expected**: Agent requests clarification OR makes reasonable assumptions
**Purpose**: Observe how agent handles vague input

### 4. Edge Case (Category Mismatch)
**Pattern**: "Fix authentication bug" (bug-fix pattern) but request infrastructure category
**Expected**: Agent corrects category OR notes mismatch
**Purpose**: Test agent's domain knowledge

### 5. Impossible Case (Graceful Failure)
**Pattern**: "Create an activity that violates all best practices"
**Expected**: Validation failure, clear error message, no registration
**Purpose**: Verify validation gates work

---

## Data Collection

### For Each Test Execution

1. **Breadcrumb Log**
   - Stage timings
   - Break points (if failure)
   - Correlation IDs

2. **Agent Output**
   - Tool calls made
   - Context referenced
   - Decisions explained

3. **Created Artifacts**
   - Generated template JSON
   - Validation results
   - Test execution output
   - Summary document

4. **Metrics**
   - Total execution time
   - Time per step
   - Retry attempts
   - Validation pass/fail
   - Registration success

5. **Qualitative Observations**
   - Did agent "understand" the pattern?
   - Were assumptions reasonable?
   - Was output self-contained?
   - Would template be reusable?

---

## Analysis Framework

### After Each Execution

**Immediately**:
1. Extract breadcrumb log: `grep "correlationId=exec_" execution.log`
2. Identify break point (if any): `bun run validate-with-breadcrumbs.ts execution.log`
3. Count retries: `grep -c "retry\|attempt" execution.log`
4. Check validation: `grep "validation" execution.log | tail -20`

**Within 1 hour**:
1. Analyze agent decisions at each step
2. Compare to expected behavior
3. Document deviations and improvements
4. Update pattern library

### After All 5 Tests

**Synthesize findings**:
1. Success rate by test case type
2. Common failure modes (rank by frequency)
3. Best practices observed (agent behaviors that worked)
4. Anti-patterns observed (agent behaviors that failed)

**Create improvement plan**:
1. Required changes to activity-create-v2 (if any)
2. Design for new create-activity-template
3. Impulse requirements for new template
4. Validation enhancements needed

---

## Success Criteria

### For Testing Phase
- ✅ Successfully execute all 5 test cases
- ✅ Collect breadcrumb logs for each execution
- ✅ Document agent behavior patterns (20+ observations)
- ✅ Identify 5+ improvements for new template
- ✅ No blockers discovered that prevent template creation

### For New Template (create-activity-template)
- ✅ Works in sterile environments (no source code)
- ✅ Handles vague input gracefully (requests clarification)
- ✅ References examples automatically (3+ templates)
- ✅ Validates schema before proceeding
- ✅ Tests created template automatically
- ✅ Success rate >80% on varied inputs
- ✅ Average execution time <10 minutes
- ✅ Self-contained (all context via impulses)

---

## Execution Plan

### Step 1: Verify Tracing Infrastructure (10 min)
```bash
# Check breadcrumb system is compiled
docker exec devbob-clean bash -c "cd /workspace && node -e \"require('./repos/metabob-opencode/packages/opencode/dist/session/execution-breadcrumbs.js')\""

# Verify log output location
docker exec devbob-clean bash -c "ls -la /root/.local/share/opencode/logs/"

# Test breadcrumb collection
docker exec devbob-clean bash -c "tail -f /root/.local/share/opencode/logs/core.log" &
```

### Step 2: Run Test Cases (60 min - 12 min per test)
```bash
# Test 1: Minimal
./scripts/test-activity-create-sterile.sh devbob-clean minimal

# Test 2: Complex  
./scripts/test-activity-create-sterile.sh devbob-clean complex

# Test 3: Vague
./scripts/test-activity-create-sterile.sh devbob-clean vague

# Custom test cases (create inline)
# Test 4: Category mismatch
# Test 5: Validation failure
```

### Step 3: Collect and Analyze (30 min)
```bash
# Extract all breadcrumb logs
for dir in validation-results/sterile-tests/*/; do
  grep "STAGE\|correlationId" "$dir/acp-output.log" > "$dir/breadcrumbs.log"
done

# Run analyzer on each
python3 analyze_execution_trace.py validation-results/sterile-tests/*/breadcrumbs.log

# Generate comparison report
./scripts/compare-test-results.sh validation-results/sterile-tests/
```

### Step 4: Document Findings (30 min)
Create: `ACTIVITY_CREATE_AGENT_BEHAVIOR_ANALYSIS.md`
- Patterns observed
- Improvements needed
- Design for new template

### Step 5: Design New Template (60 min)
Create: `create-activity-template-v3.json`
- Based on observed patterns
- Incorporates improvements
- Fully self-contained

---

## Tracing Command Reference

### Enable Debug Logging
```bash
# In container
export DEBUG='*breadcrumb*,*activity*,*template*'
export LOG_LEVEL=debug
```

### Collect Breadcrumbs
```bash
# Real-time
tail -f /root/.local/share/opencode/logs/core.log | grep -E "STAGE|correlationId"

# Post-execution
grep "exec_[a-f0-9]" /root/.local/share/opencode/logs/core.log
```

### Parse Execution Flow
```bash
# Extract one execution
CORRELATION_ID="exec_abc123"
grep "$CORRELATION_ID" /root/.local/share/opencode/logs/core.log > single-exec.log

# Analyze
bun run validate-with-breadcrumbs.ts single-exec.log
```

### Performance Analysis
```bash
# Extract timings
grep "elapsed" single-exec.log | awk '{print $NF}'

# Stage breakdown
grep "STAGE" single-exec.log | cut -d'|' -f1,2,3
```

---

## Next Steps

1. **Immediate**: Run Phase 1 (instrumented execution with minimal test case)
2. **Today**: Complete all 5 test cases
3. **Tomorrow**: Analyze patterns and design new template
4. **This week**: Implement and validate create-activity-template-v3

---

## Notes

- Breadcrumb system is already integrated in OpenCode (execution-breadcrumbs.ts)
- Container devbob-clean is running and healthy
- Backend is accessible and operational
- All infrastructure is in place - ready to begin testing
- Focus on **qualitative observations** of agent behavior, not just metrics
- Goal is to understand agent decision-making to guide template design
