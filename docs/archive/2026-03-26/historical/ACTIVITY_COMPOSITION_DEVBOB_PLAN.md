# Activity Composition in DevBob: Testing & Evolution Plan

**Date**: 2026-02-20  
**Container**: `devbob-clean` (running, healthy)  
**Goal**: Test and iterate on activity template creation and composition

---

## Current State

### DevBob Container
- **Status**: Running (19+ hours uptime)
- **Ports**: 3000 (main), 8082 (metrics)
- **Config**: `/workspace/.opencode/opencode.json`
- **Model**: `anthropic/claude-sonnet-4-5`
- **MCP**: Metabob MCP enabled (local CLI)
- **Session Memory**: Enabled (5 impulses/turn, 10K tokens)

### Available Infrastructure

**Activity Composition Support** ✅:
1. **Tests**: `activity-composition.test.ts` (comprehensive test suite)
2. **Examples**: `examples/activity-composition/` (3 patterns)
3. **Impulse System**: `activityOutput` pointer type supported
4. **Tool**: Activity tool available in all agents

**Composition Patterns Documented**:
1. Sequential (A → B)
2. Data Flow with Impulses (Producer → Consumer)
3. Multi-Step Workflow (Analyze → Prep → Main → Finalize)

---

## Activity Composition Architecture

### Pattern 1: Direct Tool Call (Simple)

**How it works**:
- Task prompt instructs agent to call `activity` tool
- Variables passed explicitly
- No special schema needed

**Example**:
```json
{
  "prompt": {
    "template": "Use the activity tool to run \"child-activity\" with variable myVar={{parentVar}}. Reason: Testing composition."
  }
}
```

**Use case**: Simple sequential workflows

### Pattern 2: Impulse-Based Data Flow (Structured)

**How it works**:
- First activity runs and produces output
- Create `activityOutput` impulse with activityId
- Second activity has `contextRequirements` with `impulseTypes: ["activityOutput"]`
- Impulse content injected into second activity's context

**Example**:
```json
{
  "contextRequirements": [
    {
      "key": "childOutput",
      "impulseTypes": ["activityOutput"],
      "required": true,
      "budgetRange": [1000, 2000]
    }
  ]
}
```

**Use case**: Data needs structured passing with token budgets

### Pattern 3: Task References Impulse (Explicit)

**How it works**:
- Task has `impulseReferences: ["impulse-id"]`
- Impulse loaded before task execution
- Content available in task context

**Example**:
```json
{
  "tasks": [{
    "id": "process-output",
    "impulseReferences": ["childOutput"],
    "prompt": {
      "template": "Process the childOutput impulse data..."
    }
  }]
}
```

**Use case**: Fine-grained control over which impulses each task uses

---

## Test Plan

### Phase 1: Validate Existing Templates

**Objective**: Confirm composition examples work in devbob

**Tests**:
1. ✅ List available templates in container
2. ✅ Check if composition examples are registered
3. ⏳ Create simple stub activities for testing
4. ⏳ Run `sequential-activities.json` example
5. ⏳ Measure execution time, token usage, cost

**Commands**:
```bash
# Enter devbob container
docker exec -it devbob-clean bash

# List templates
cd /workspace
opencode activity template list

# Create stub activity for testing
cat > /tmp/stub-a.json <<'EOF'
{
  "name": "Stub Activity A",
  "description": "Simple test activity",
  "category": "feature",
  "tasks": [{
    "id": "task-a",
    "subagent": "general",
    "description": "Execute task A",
    "dependencies": [],
    "prompt": {
      "template": "Received input: {{input}}. Return success message.",
      "maxTokens": 2000,
      "compressionStrategy": "filter",
      "variables": [{
        "name": "input",
        "type": "string",
        "required": true,
        "description": "Input data"
      }]
    },
    "validation": {
      "requiredFiles": [],
      "requiredPatterns": [],
      "forbiddenPatterns": [],
      "commands": []
    },
    "retry": {"maxAttempts": 2, "strategy": "simple"}
  }]
}
EOF

# Register stub activity
opencode activity template register /tmp/stub-a.json

# Test composition (if examples registered)
opencode run --prompt "Use activity tool to run hello-world-minimal with reason: testing composition"
```

### Phase 2: Create New Template in DevBob

**Objective**: Test `create-activity-template` template

**Test**:
1. ⏳ Run `create-activity-template` activity
2. ⏳ Provide inputs for a simple "add-two-numbers" template
3. ⏳ Verify template is generated
4. ⏳ Register generated template
5. ⏳ Execute the new template to validate

**Commands**:
```bash
# Inside devbob
cd /workspace

# Test template creation
opencode run --prompt "Use the activity tool to run create-activity-template with:
  - templateName: Add Two Numbers
  - templateDescription: Adds two numbers and returns the sum
  - category: feature
  - templateId: add-two-numbers
Reason: Testing template creation in devbob"
```

**Expected Output**:
- `/tmp/activity-add-two-numbers/template.json` created
- Template registered with backend
- `/tmp/activity-add-two-numbers/SUCCESS.md` exists

### Phase 3: Test Activity Composition

**Objective**: Create template that composes other templates

**Test Case**: "Multi-Stage Calculation"
1. Activity A: Add two numbers
2. Activity B: Multiply result by 3
3. Orchestrator: Run A, then B with A's output

**Implementation**:
```json
{
  "name": "Multi-Stage Calculation",
  "description": "Demonstrates activity composition for calculations",
  "category": "feature",
  "tasks": [
    {
      "id": "run-addition",
      "subagent": "general",
      "description": "Run add-two-numbers activity",
      "prompt": {
        "template": "Use activity tool to run 'add-two-numbers' with num1={{x}} and num2={{y}}. Reason: First step in multi-stage calculation.",
        "variables": [
          {"name": "x", "type": "string", "required": true},
          {"name": "y", "type": "string", "required": true}
        ]
      }
    },
    {
      "id": "run-multiplication",
      "subagent": "general",
      "description": "Multiply addition result by 3",
      "dependencies": ["run-addition"],
      "prompt": {
        "template": "Use activity tool to run 'multiply-by-three' with input={{result}}. Use the result from the previous addition activity. Reason: Second step using addition output.",
        "variables": [
          {"name": "result", "type": "string", "required": false}
        ]
      }
    }
  ]
}
```

**Commands**:
```bash
# Create multi-stage template
cat > /tmp/multi-stage-calc.json <<'EOF'
{...json above...}
EOF

# Register
opencode activity template register /tmp/multi-stage-calc.json

# Execute
opencode run --prompt "Use activity tool to run multi-stage-calculation with x=5 and y=3. Reason: Testing composition with calculation workflow."
```

### Phase 4: Activity Creates Activity (Meta)

**Objective**: Test activity that creates another activity

**Test Case**: "Activity Generator"
- Input: Description of desired activity
- Output: New activity template JSON + registration

**Template**:
```json
{
  "name": "Activity Generator",
  "description": "Creates new activity template from description",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "analyze-requirements",
      "subagent": "general",
      "description": "Analyze what activity user wants",
      "prompt": {
        "template": "User wants to create an activity: {{activityGoal}}\n\nAnalyze requirements and plan 2-3 tasks needed. Output plan to /tmp/activity-plan.md",
        "variables": [
          {"name": "activityGoal", "type": "string", "required": true}
        ]
      }
    },
    {
      "id": "generate-template",
      "subagent": "general",
      "description": "Use create-activity-template to generate it",
      "dependencies": ["analyze-requirements"],
      "prompt": {
        "template": "Use the activity tool to run 'create-activity-template' with:\n- templateName: {{templateName}}\n- templateDescription: {{activityGoal}}\n- category: {{category}}\nReason: Generating template based on user requirements.",
        "variables": [
          {"name": "templateName", "type": "string", "required": true},
          {"name": "activityGoal", "type": "string", "required": true},
          {"name": "category", "type": "string", "required": true}
        ]
      }
    }
  ]
}
```

---

## Performance Metrics to Track

### Execution Metrics
- **Duration**: Total time for activity (target: < 2 min for simple, < 5 min for complex)
- **Token Usage**: Input + output + cache tokens
- **Cost**: Total cost in dollars
- **Success Rate**: % of successful executions

### Composition Metrics
- **Nesting Depth**: How many levels deep (target: 2-3 max)
- **Variable Passing**: Successful variable propagation between activities
- **Impulse Usage**: activityOutput impulses created and loaded
- **Data Flow**: Tracing output from activity A to input of activity B

### Template Quality
- **Task Count**: Number of tasks in template
- **Validation Coverage**: % of tasks with validation
- **Prompt Clarity**: Length and specificity of task prompts
- **Retry Strategy**: Error handling approach

---

## Iteration Goals

### Week 1: Basic Composition
- ✅ Validate existing composition patterns work
- ✅ Create 2-3 simple stub activities
- ✅ Test sequential composition (A → B)
- ⏳ Document execution metrics

### Week 2: Template Creation
- ⏳ Test `create-activity-template` in devbob
- ⏳ Create 5 new templates using the tool
- ⏳ Track template quality over iterations
- ⏳ Identify improvement patterns

### Week 3: Meta Composition
- ⏳ Test activity-creates-activity pattern
- ⏳ Build template evolution workflow
- ⏳ Track genealogy and variant performance
- ⏳ Document best practices

### Week 4: Production Readiness
- ⏳ Stress test with 10+ composed activities
- ⏳ Performance optimization
- ⏳ Error handling and retry logic
- ⏳ Documentation and examples

---

## Key Questions to Answer

1. **Impulse Loading**: Does my fix (commit `7465be33`) actually work for activity composition?
   - When activity B has `contextRequirements` for activity A's output
   - Are impulses loaded correctly?
   - Are variables populated?

2. **Activity Output Impulses**: How is `activityOutput` impulse created?
   - Automatically after activity completes?
   - Manually via impulse_create tool?
   - What's in the impulse content?

3. **Template Evolution**: When does a template evolve?
   - After N failures?
   - When bored (manual trigger)?
   - Automatically via learning loop?

4. **Variant Management**: How are variants selected?
   - Thompson Sampling (documented)?
   - Random selection?
   - Always latest?

5. **Database Integration**: Are execution metrics recorded?
   - To SurrealDB impulse_usage table?
   - To Redis template metrics?
   - Both?

---

## Success Criteria

**Phase 1 Success** (Immediate):
- ✅ Can list templates in devbob
- ✅ Can run a simple activity
- ✅ Can compose two activities (A → B)
- ✅ Variables pass correctly between activities

**Phase 2 Success** (This Week):
- ✅ Can create new template using `create-activity-template`
- ✅ Generated template executes successfully
- ✅ Metrics tracked (duration, cost, tokens)
- ✅ Template registered with backend

**Phase 3 Success** (Next Week):
- ✅ Can create activity that creates activity (meta)
- ✅ Template evolution triggered and tracked
- ✅ Variants compared via metrics
- ✅ Best variant promoted

**Phase 4 Success** (Production):
- ✅ 10+ templates in production use
- ✅ Composition depth 3+ levels working
- ✅ Success rate > 80% for proven templates
- ✅ Learning loop actively improving templates

---

## Next Actions

1. **Immediate** (next 30 minutes):
   - Enter devbob container
   - List available templates
   - Run simple activity to test baseline

2. **Today**:
   - Create stub activities for composition testing
   - Test `create-activity-template` with simple input
   - Document execution metrics

3. **This Week**:
   - Test sequential composition
   - Test data flow with impulses
   - Create 3-5 new templates
   - Track template quality

4. **Next Week**:
   - Test meta composition (activity creates activity)
   - Implement template evolution trigger
   - Measure learning loop performance

---

## Documentation to Create

1. **DEVBOB_ACTIVITY_EXECUTION_LOG.md** - Track each activity execution with metrics
2. **TEMPLATE_QUALITY_RUBRIC.md** - Criteria for good templates
3. **COMPOSITION_PATTERNS_VALIDATED.md** - Which patterns work, which don't
4. **IMPULSE_VARIABLE_MAPPING_VALIDATION.md** - Verify my fix works end-to-end

---

**Status**: Plan ready, awaiting execution  
**Priority**: Test basic composition first, then template creation  
**Blocker**: None (devbob running, templates available)
