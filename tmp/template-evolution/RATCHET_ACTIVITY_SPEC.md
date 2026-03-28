# Ratchet Activity Specification

**Activity Name**: execute-ratchet-cycle  
**Category**: infrastructure  
**Purpose**: Execute one complete ratchet cycle - inspect state, improve bottleneck, measure progress, repeat

---

## Core Concept

**Composable Loop Structure**:
```
execute-ratchet-cycle (Iteration 1)
  → Outputs: bottleneck identified, improvement applied, metrics measured
  → Decision: Continue or Complete?
  
If Continue:
  execute-ratchet-cycle (Iteration 2)
    → Uses outputs from Iteration 1 as input
    → Identifies next bottleneck
    → Applies next improvement
    
If Complete:
  → System stabilized, no more high-priority bottlenecks
```

**Key Properties**:
1. **Self-Contained**: Each cycle is complete (inspect → improve → measure)
2. **Composable**: Output of cycle N feeds into cycle N+1
3. **Terminating**: Stops when no bottlenecks above threshold
4. **Traceable**: Each cycle documents state transition

---

## Activity Structure

### Task 1: Inspect Current State (General Agent)

**Purpose**: Gather comprehensive metrics and identify bottleneck

**Actions**:
1. Query variant performance from Redis
2. Check template metadata files for execution stats
3. Query SurrealDB for recent executions
4. Analyze design goal alignment
5. Identify bottleneck: template OR code

**Outputs**:
- `tmp/ratchet-cycle-{{cycleNumber}}/STATE_INSPECTION.md`
- Bottleneck type: "template" | "code" | "none"
- Bottleneck target: template ID or code component
- Metrics: success rates, execution counts, costs

**Validation**:
- requiredFiles: STATE_INSPECTION.md
- requiredPatterns: "## Bottleneck Identified", "## Current Metrics"
- forbiddenPatterns: "TODO", "Unknown"

**Decision Point**: 
- If bottleneck = "none" → Skip to Task 5 (termination)
- If bottleneck = "template" → Execute Task 2
- If bottleneck = "code" → Execute Task 3

### Task 2: Improve Template (General Agent)

**Purpose**: Apply improvements to low-performing template

**Conditions**: Only execute if Task 1 identified template bottleneck

**Actions**:
1. Load target template from storage
2. Apply standard improvements:
   - Add comprehensive validation (Priority 1)
   - Restructure prompts to TASK/OBJECTIVE/ACTIONS (Priority 2)
   - Mark required tools (Priority 3)
   - Add explicit instructions (Priority 4)
3. Increment generation number
4. Save as new variant
5. Register with backend

**Inputs**:
- Bottleneck target from Task 1
- Template ID
- Improvement priority

**Outputs**:
- `tmp/ratchet-cycle-{{cycleNumber}}/{{templateId}}-v{{generation}}.json`
- `tmp/ratchet-cycle-{{cycleNumber}}/TEMPLATE_IMPROVEMENTS.md`

**Validation**:
- requiredFiles: improved template JSON, improvements doc
- requiredPatterns: "\"generation\":", "Priority 1 Applied"
- commands: `jq empty tmp/ratchet-cycle-{{cycleNumber}}/{{templateId}}-v{{generation}}.json`

### Task 3: Align Code to Design Goals (General Agent)

**Purpose**: Fix code issues that block template success

**Conditions**: Only execute if Task 1 identified code bottleneck

**Actions**:
1. Analyze code gap from STATE_INSPECTION.md
2. Identify affected files
3. Apply fix using trace-enforce-validate-loop pattern:
   - Trace specification through codebase
   - Enforce requirements via code changes
   - Validate externally
4. Test that fix enables better templates
5. Commit changes

**Inputs**:
- Bottleneck target from Task 1
- Code component
- Design goal misalignment

**Outputs**:
- Code changes (committed)
- `tmp/ratchet-cycle-{{cycleNumber}}/CODE_ALIGNMENT.md`

**Validation**:
- requiredFiles: CODE_ALIGNMENT.md
- requiredPatterns: "## Issue Identified", "## Fix Applied", "## Validation"
- forbiddenPatterns: "Failed", "ERROR"

### Task 4: Measure Progress (General Agent)

**Purpose**: Test improvement and measure impact

**Dependencies**: Task 2 OR Task 3 (whichever executed)

**Actions**:
1. If template improved:
   - Test new variant with simple case
   - Measure success rate
   - Compare to baseline
2. If code improved:
   - Re-test affected templates
   - Measure success rate improvement
   - Verify no regressions
3. Calculate impact:
   - Success rate delta
   - Templates benefited
   - Cost/duration changes
4. Document insights

**Outputs**:
- `tmp/ratchet-cycle-{{cycleNumber}}/MEASUREMENT_REPORT.md`
- Improvement metrics (baseline → current)
- Next bottleneck identified (if any)

**Validation**:
- requiredFiles: MEASUREMENT_REPORT.md
- requiredPatterns: "## Baseline", "## After Improvement", "## Impact"
- forbiddenPatterns: "Unable to measure"

### Task 5: Decide Next Action (General Agent)

**Purpose**: Determine if another cycle is needed

**Dependencies**: Task 4

**Actions**:
1. Review MEASUREMENT_REPORT.md
2. Check for remaining bottlenecks:
   - Templates < 70% success with >5 executions
   - Code misalignments blocking templates
3. If bottlenecks exist:
   - Output: "CONTINUE" + next bottleneck details
4. If no bottlenecks:
   - Output: "COMPLETE" + summary

**Outputs**:
- `tmp/ratchet-cycle-{{cycleNumber}}/DECISION.md`
- Decision: "CONTINUE" | "COMPLETE"
- Next cycle input (if CONTINUE)

**Validation**:
- requiredFiles: DECISION.md
- requiredPatterns: "## Decision:", "CONTINUE" OR "COMPLETE"
- requiredPatterns: "## Summary"

---

## Variables

```json
{
  "cycleNumber": {
    "type": "number",
    "required": false,
    "default": 1,
    "description": "Current ratchet cycle iteration"
  },
  "previousCycleOutput": {
    "type": "string",
    "required": false,
    "default": "",
    "description": "Path to previous cycle's DECISION.md (for continuation)"
  },
  "successThreshold": {
    "type": "number",
    "required": false,
    "default": 70,
    "description": "Success rate threshold for bottleneck identification (0-100)"
  },
  "maxCycles": {
    "type": "number",
    "required": false,
    "default": 10,
    "description": "Maximum cycles before forced termination"
  }
}
```

---

## Loop Mechanics

### Initial Invocation

```bash
opencode activity execute execute-ratchet-cycle --variables '{
  "cycleNumber": 1,
  "successThreshold": 70
}'
```

**Output**: `tmp/ratchet-cycle-1/DECISION.md` with next action

### Continuation (Manual Loop)

```bash
# Read decision from cycle 1
DECISION=$(cat tmp/ratchet-cycle-1/DECISION.md | grep "^## Decision:" | cut -d: -f2 | tr -d ' ')

if [ "$DECISION" = "CONTINUE" ]; then
  opencode activity execute execute-ratchet-cycle --variables '{
    "cycleNumber": 2,
    "previousCycleOutput": "tmp/ratchet-cycle-1/DECISION.md"
  }'
fi
```

### Automated Loop (Future: Boredom System)

```javascript
// Boredom system monitors and auto-triggers
async function ratchetLoop() {
  let cycle = 1;
  let decision = "CONTINUE";
  
  while (decision === "CONTINUE" && cycle <= maxCycles) {
    const result = await executeActivity("execute-ratchet-cycle", {
      cycleNumber: cycle,
      previousCycleOutput: cycle > 1 ? `tmp/ratchet-cycle-${cycle-1}/DECISION.md` : ""
    });
    
    decision = parseDecision(result.outputs["DECISION.md"]);
    cycle++;
  }
  
  return { totalCycles: cycle - 1, finalState: "COMPLETE" };
}
```

---

## Conditional Task Execution

**Challenge**: Not all tasks should run in every cycle

**Solution 1: Task Dependencies with Conditional Logic**

```json
{
  "id": "improve-template",
  "dependencies": ["inspect-state"],
  "condition": {
    "type": "file_contains",
    "file": "tmp/ratchet-cycle-{{cycleNumber}}/STATE_INSPECTION.md",
    "pattern": "Bottleneck Type: template"
  }
}
```

**Solution 2: Agent Prompt Conditional** (Current approach)

```
Task: Improve Template

**IMPORTANT**: Only execute if STATE_INSPECTION.md shows bottleneck type = "template"

If bottleneck type = "code":
  - Create empty file: tmp/ratchet-cycle-{{cycleNumber}}/TEMPLATE_IMPROVEMENTS.md
  - Content: "# Skipped\n\nBottleneck is code, not template. See Task 3."
  - Exit successfully

If bottleneck type = "template":
  - Execute template improvements as specified
  - ...
```

**Solution 3: Validation Allows Empty** (Fallback)

```json
{
  "validation": {
    "requiredFiles": ["TEMPLATE_IMPROVEMENTS.md"],
    "allowEmpty": true,
    "requiredPatterns": ["# Skipped" OR "Priority 1 Applied"]
  }
}
```

---

## Composability Pattern

### Pattern 1: Sequential Chaining

```
Cycle 1 (improve create-activity) 
  → Output: create-activity-v2
  → Decision: CONTINUE (evolve-activity broken)

Cycle 2 (fix evolve-activity)
  → Output: evolve-activity-v2
  → Decision: CONTINUE (5 templates < 70%)

Cycle 3 (batch evolve templates)
  → Output: 5 improved variants
  → Decision: COMPLETE (all templates > 80%)
```

### Pattern 2: Nested Composition

```
execute-ratchet-cycle (Cycle 1)
  ├─ Task 1: inspect-state
  ├─ Task 2: improve-template
  │   └─ Internally uses: trace-enforce-validate-loop
  ├─ Task 4: measure-progress
  │   └─ Internally uses: test activity execution
  └─ Task 5: decide-next
```

### Pattern 3: Parallel Variants (Future)

```
execute-ratchet-cycle (Test variant A)
  ├─ Apply improvement strategy A
  └─ Measure A results

execute-ratchet-cycle (Test variant B)
  ├─ Apply improvement strategy B
  └─ Measure B results

Compare A vs B → Select winner
```

---

## Termination Conditions

### Normal Termination

**Condition**: No bottlenecks above threshold
```
All templates with >5 executions have >70% success
No code misalignments blocking templates
Decision: COMPLETE
```

**Output**: Final summary report

### Forced Termination

**Condition**: Max cycles reached
```
cycleNumber > maxCycles (default: 10)
Decision: FORCED_COMPLETE
Warning: May have remaining bottlenecks
```

**Output**: Summary + remaining issues

### Error Termination

**Condition**: Cycle fails
```
Task validation fails
Unable to improve template or code
Decision: ERROR
```

**Output**: Error report + recovery suggestions

---

## Measurement & Tracking

### Per-Cycle Metrics

**Tracked Automatically**:
- Cycle number
- Bottleneck identified
- Improvement applied
- Success rate before/after
- Cost of cycle
- Duration of cycle
- Decision (CONTINUE/COMPLETE)

**Stored In**:
- `tmp/ratchet-cycle-{{N}}/METRICS.json`
- Aggregated in `tmp/ratchet-cycles-summary.json`

### Cross-Cycle Metrics

**Aggregate Progress**:
```json
{
  "totalCycles": 3,
  "totalImprovements": {
    "templates": 2,
    "code": 1
  },
  "successRateProgression": [
    { "cycle": 1, "avgSuccess": 55 },
    { "cycle": 2, "avgSuccess": 72 },
    { "cycle": 3, "avgSuccess": 88 }
  ],
  "finalState": "COMPLETE"
}
```

---

## Integration with Existing Activities

### Uses These Activities

1. **trace-enforce-validate-loop**: For code alignment (Task 3)
2. **Template test activities**: For measurement (Task 4)
3. **evolve-activity-self-contained**: Once fixed, replaces manual Task 2

### Used By These Activities

1. **Boredom system**: Auto-triggers ratchet cycles
2. **Manual improvement workflows**: User-initiated loops
3. **CI/CD pipelines**: Automated improvement on schedule

---

## Example Execution Flow

### Cycle 1: Improve create-activity-self-contained

```
Task 1: Inspect State
  → Query Redis: 3/24 templates active
  → Check metadata: create-activity 3% success (37 executions)
  → Output: Bottleneck = "template", Target = "create-activity-self-contained"

Task 2: Improve Template
  → Load create-activity-self-contained.json
  → Apply Priority 1-3 improvements
  → Generate create-activity-self-contained-v2.json
  → Register with backend

Task 3: Align Code (SKIPPED - bottleneck is template)

Task 4: Measure Progress
  → Test v2 with simple case
  → Result: SUCCESS (1/1 = 100%)
  → Compare: 3% → 100% (small sample, needs more data)
  → Identify: evolve-activity-self-contained blocking automation

Task 5: Decide Next Action
  → Decision: CONTINUE
  → Next bottleneck: evolve-activity-self-contained (0% success)
  → Next cycle: Fix code (Task 3)
```

### Cycle 2: Fix evolve-activity-self-contained

```
Task 1: Inspect State
  → Previous: create-activity improved
  → Current: evolve-activity fails (no SurrealDB fallback)
  → Output: Bottleneck = "code", Target = "evolve-activity-self-contained"

Task 2: Improve Template (SKIPPED - bottleneck is code)

Task 3: Align Code
  → Use trace-enforce-validate-loop
  → Add data source fallbacks (SurrealDB → Redis → local)
  → Improve analysis task prompts
  → Test on create-activity-self-contained
  → Result: SUCCESS

Task 4: Measure Progress
  → Test evolve-activity on 3 templates
  → Result: 2/3 succeed (67%)
  → Compare: 0% → 67%
  → Identify: 5 templates < 70% success remain

Task 5: Decide Next Action
  → Decision: CONTINUE
  → Next bottleneck: Batch evolve 5 templates
  → Next cycle: Use fixed evolve-activity (Task 2 automated)
```

---

## Success Criteria

### Per-Cycle Success

- ✅ State inspected (metrics gathered)
- ✅ Bottleneck identified (template or code)
- ✅ Improvement applied (variant created or code fixed)
- ✅ Progress measured (before/after comparison)
- ✅ Decision made (CONTINUE or COMPLETE)

### Overall Success

- ✅ Average template success rate > 85%
- ✅ No templates with >5 executions below 70%
- ✅ Code aligned with all 5 design goals
- ✅ System self-improving (boredom triggers working)

---

## Next Steps

1. Create execute-ratchet-cycle activity template
2. Test Cycle 1 (improve create-activity-self-contained)
3. Validate loop mechanics work
4. Test Cycle 2 (fix evolve-activity)
5. Automate with boredom system

