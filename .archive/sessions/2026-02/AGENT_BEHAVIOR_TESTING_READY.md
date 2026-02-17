# Agent Behavior Testing Infrastructure - Ready for Execution ✅

**Date**: February 14, 2026  
**Status**: All systems operational - ready to begin testing  
**Goal**: Observe agent behavior during activity template creation to guide development of highly generalizable, reliable, self-contained `create-activity-template`

---

## What We Built

### 1. Comprehensive Testing Plan
**Document**: `ACTIVITY_CREATE_TESTING_PLAN_WITH_TRACING.md`

**Contents**:
- Complete testing strategy (3 phases)
- Detailed observation framework for each of 7 activity-create-v2 steps
- Data collection methodology
- Pattern extraction approach
- Success criteria definition

### 2. Agent Behavior Tracer
**Script**: `scripts/trace-agent-behavior.sh`

**Capabilities**:
- Executes activity-create-v2 with instrumented logging
- Prompts agent for verbose reasoning at each step
- Captures breadcrumbs, tool calls, decisions, validation events
- Extracts created template for analysis
- Generates structured analysis report automatically

**Usage**:
```bash
./scripts/trace-agent-behavior.sh [container] [test_case]
# Examples:
./scripts/trace-agent-behavior.sh devbob-clean minimal
./scripts/trace-agent-behavior.sh devbob-clean complex
./scripts/trace-agent-behavior.sh devbob-clean vague
```

### 3. Comparative Analysis Tool
**Script**: `scripts/compare-agent-behavior.sh`

**Capabilities**:
- Aggregates results across multiple test executions
- Extracts consistent patterns vs. varying behaviors
- Identifies success patterns to reinforce
- Identifies failure patterns to prevent
- Generates actionable recommendations for new template design

**Usage**:
```bash
./scripts/compare-agent-behavior.sh validation-results/agent-behavior
```

### 4. Quick Start Guide
**Document**: `ACTIVITY_CREATE_TESTING_QUICK_START.md`

**Contents**:
- Step-by-step execution instructions
- Guide to reading analysis reports
- Pattern extraction workflow
- Troubleshooting common issues
- Timeline and next steps

---

## Infrastructure Status

### ✅ Environment Ready

| Component | Status | Details |
|-----------|--------|---------|
| **Container** | 🟢 Running | `devbob-clean` - healthy, 8+ hours uptime |
| **Workspace** | 🟢 Sterile | Empty except for config files |
| **Backend** | 🟢 Accessible | api-server-dev at port 8080 (internal), 8082 (host) |
| **Database** | 🟢 Connected | SurrealDB with devbob profile |
| **OpenCode** | 🟢 Installed | Latest version with breadcrumb support |
| **Templates** | 🟢 Available | activity-create-v2 confirmed present |

### ✅ Tracing Tools Ready

| Tool | Purpose | Status |
|------|---------|--------|
| **Breadcrumb System** | Stage-based execution logging | 🟢 Integrated in OpenCode |
| **Activity Tracer** | Python-based trace collection | 🟢 Available (`trace_activity_execution.py`) |
| **Log Analyzer** | Performance and flow analysis | 🟢 Available (`analyze_execution_trace.py`) |
| **Container Tracer** | Multi-container log aggregation | 🟢 Available (`scripts/trace-backend-connectivity.sh`) |

### ✅ Test Cases Defined

| Test Case | Pattern | Purpose | Expected Outcome |
|-----------|---------|---------|------------------|
| **Minimal** | "Simple hello world" | Baseline functionality | 2-3 tasks, quick success |
| **Complex** | "Backup files workflow" | Multi-step coordination | 4-5 tasks, sequential deps |
| **Vague** | "Process data efficiently" | Ambiguity handling | Clarification OR reasonable assumptions |

---

## What Gets Captured

### Agent Decision Data
- **What**: Decisions made at each step
- **Why**: Reasoning provided by agent
- **Alternatives**: Other options considered
- **Confidence**: Agent's confidence level
- **Context**: What information was referenced

### Execution Traces
- **Breadcrumbs**: Stage ENTER → EXIT timing
- **Tool Calls**: Which tools invoked with what parameters
- **Validation**: Schema validation attempts and results
- **Errors**: Failures encountered and recovery attempts
- **Performance**: Time per step, total duration, retries

### Created Artifacts
- **Template JSON**: Generated activity template
- **Task Descriptions**: Breakdown of steps created
- **Validation Results**: Schema validation output
- **Test Results**: Template execution output
- **Summary Document**: Agent's reflection on process

---

## Execution Workflow

### Quick Test (5-10 minutes)
```bash
# Run single test with full tracing
./scripts/trace-agent-behavior.sh devbob-clean minimal

# Review results immediately
LATEST=$(ls -td validation-results/agent-behavior/*/ | head -1)
cat "${LATEST}ANALYSIS.md"
```

### Full Test Suite (30-45 minutes)
```bash
# Run all 3 test cases
for case in minimal complex vague; do
  echo "=== Testing: $case ==="
  ./scripts/trace-agent-behavior.sh devbob-clean $case
  sleep 5  # Brief pause between tests
done

# Generate comparison report
./scripts/compare-agent-behavior.sh validation-results/agent-behavior

# Review comparative analysis
cat validation-results/agent-behavior/COMPARISON_*.md
```

---

## Analysis Outputs

### Per-Test Analysis
**Location**: `validation-results/agent-behavior/TIMESTAMP/ANALYSIS.md`

**Sections**:
1. Execution Summary (exit code, tool calls, errors, artifacts)
2. Decision Points Observed (agent reasoning at each step)
3. Stage Transitions (breadcrumb timeline)
4. Tool Calls Made (search_activities, register, activity)
5. Validation Events (schema checks)
6. Errors Encountered (failure modes)
7. Created Template Analysis (task count, descriptions)
8. Behavioral Observations (checklists for what worked/improved)
9. Recommendations (improvements for new template)

### Comparative Analysis
**Location**: `validation-results/agent-behavior/COMPARISON_TIMESTAMP.md`

**Sections**:
1. Executive Summary (success rate, test case breakdown)
2. Pattern Analysis (consistent vs. varying behaviors)
3. Success Patterns (behaviors to reinforce)
4. Failure Patterns (behaviors to prevent)
5. Recommendations (context requirements, validation gates, prompt enhancements)
6. Next Steps (actionable items)

---

## Pattern Extraction Process

### Step 1: Run Tests
Execute 3-5 test cases with different patterns:
- Minimal (baseline)
- Complex (stress test)
- Vague (ambiguity handling)
- Edge cases (category mismatch, validation failure)

### Step 2: Review Individual Results
For each test, examine:
- Did agent explain reasoning clearly?
- What context was referenced (examples, docs)?
- Were decisions reasonable?
- Did validation catch issues?
- Was recovery successful?

### Step 3: Extract Patterns
From successful tests:
- Agent behaviors that led to good outcomes
- Context that was most helpful
- Validation strategies that worked

From failed tests:
- Agent behaviors that caused issues
- Missing context that led to problems
- Validation gaps

### Step 4: Design Requirements
Convert observations into template design:

**Success Pattern**:
```
Observed: Agent searches 3+ examples → better schemas
→ Requirement: contextRequirements[0] = {
    key: "exampleTemplates",
    required: true,
    budgetRange: [5000, 8000]
  }
```

**Failure Pattern**:
```
Observed: Agent skips validation → registration fails
→ Requirement: Step 4 validation gate
  - check: command
  - command: validate-activity-template.sh
  - required: true
```

### Step 5: Implement New Template
Create `create-activity-template-v3.json`:
- Incorporate required context
- Add validation gates
- Enhance prompts with guidance
- Implement retry strategies

---

## Success Criteria

### For Testing Phase
- [x] Infrastructure operational (all green)
- [x] Test scripts created and executable
- [x] Tracing tools integrated
- [x] Analysis framework defined
- [ ] Execute 3+ test cases
- [ ] Collect behavioral data
- [ ] Document 20+ observations
- [ ] Identify 5+ improvements

### For New Template
- [ ] Works in sterile environments
- [ ] Handles vague input gracefully
- [ ] References examples automatically
- [ ] Validates schema before registration
- [ ] Tests created template automatically
- [ ] Success rate >80% on varied inputs
- [ ] Average execution time <10 minutes
- [ ] Self-contained (no source dependencies)

---

## Key Insights from Setup

### What We Learned from Previous Session

1. **activity-create-v2 is production-ready**
   - 7 well-defined steps
   - Uses modern tools (register_activity_template, activity)
   - Zero source code dependencies
   - Hooks system for workspace management

2. **Static analysis passed 7/7 criteria**
   - Valid JSON structure
   - No source dependencies
   - Uses latest functionality
   - Self-validates and self-tests

3. **Infrastructure is stable**
   - Container running reliably
   - Backend accessible
   - Tracing system integrated
   - Test harness validated

### What We Don't Know Yet (Testing Will Reveal)

1. **Agent decision quality**
   - Does agent explain reasoning clearly?
   - Are assumptions reasonable for vague input?
   - Does agent recover from errors gracefully?

2. **Context usage patterns**
   - Does agent actually search for examples?
   - What examples are most helpful?
   - Is annotation context useful?

3. **Validation effectiveness**
   - Does schema validation catch issues?
   - Does agent retry on validation failure?
   - Are validation messages clear?

4. **Template quality**
   - Are task counts optimal (3-5)?
   - Are agent assignments appropriate?
   - Are validation criteria testable?

5. **Common failure modes**
   - What causes template creation to fail?
   - What errors are recoverable vs. fatal?
   - Where does agent get stuck?

---

## Immediate Next Step

### Start Testing Now

**Single command**:
```bash
./scripts/trace-agent-behavior.sh devbob-clean minimal
```

**What happens**:
1. Script creates timestamped results directory
2. Prompts agent to execute activity-create-v2 with verbose reporting
3. Captures breadcrumbs, tool calls, decisions, validation
4. Generates analysis report automatically
5. Extracts created template (if successful)

**Time**: 5-10 minutes

**Review results**:
```bash
# Find latest result
LATEST=$(ls -td validation-results/agent-behavior/*/ | head -1)

# Read analysis
cat "${LATEST}ANALYSIS.md"

# Check created template
cat "${LATEST}created-template.json" | jq .
```

---

## Timeline

### Today (2-3 hours)
- ✅ Infrastructure setup complete
- ✅ Tracing tools ready
- ✅ Documentation complete
- [ ] Run first test (minimal) - **5 minutes**
- [ ] Review and document observations - **15 minutes**
- [ ] Run additional tests (complex, vague) - **20 minutes**
- [ ] Generate comparison report - **5 minutes**
- [ ] Document key patterns - **30 minutes**

### Tomorrow (2-3 hours)
- [ ] Design new template structure
- [ ] Incorporate pattern requirements
- [ ] Add validation gates
- [ ] Enhance prompts

### This Week
- [ ] Implement create-activity-template-v3
- [ ] Test new template
- [ ] Compare with activity-create-v2
- [ ] Iterate based on results

---

## Documentation Map

| Document | Purpose |
|----------|---------|
| **This file** | Status summary and quick reference |
| `ACTIVITY_CREATE_TESTING_PLAN_WITH_TRACING.md` | Comprehensive testing strategy |
| `ACTIVITY_CREATE_TESTING_QUICK_START.md` | Execution guide with examples |
| `ACTIVITY_CREATE_V2_STERILE_VALIDATION_REPORT.md` | Static analysis results |
| `ACTIVITY_TEMPLATE_STERILE_TEST_PLAN.md` | Original test plan |

---

## Ready to Execute ✅

All infrastructure is operational. All scripts are created and tested. All documentation is complete.

**Next action**: Run first test
```bash
./scripts/trace-agent-behavior.sh devbob-clean minimal
```

The tracing infrastructure will capture everything we need to understand agent behavior and guide development of a highly reliable, generalizable create-activity-template.

---

*Status: READY FOR TESTING - No blockers*
