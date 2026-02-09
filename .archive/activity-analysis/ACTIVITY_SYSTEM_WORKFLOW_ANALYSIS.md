# Activity System Workflow Analysis: Jiggle Documentation Session

## Executive Summary

The session transcript shows the metabob-opencode agent **completely bypassing the activity system architecture** by manually creating JSON files instead of using the proper MCP-based workflow. This defeats the entire purpose of the activity system: learning from execution, Thompson Sampling optimization, and deterministic validation.

---

## Critical Issues in the Transcript

### Issue #1: Manual JSON File Creation (Lines ~15-45 in transcript)

**What the agent did:**
```json
// Created file: .test-jiggle-docs/jiggle-documentation.json
{
  "id": "jiggle-documentation",
  "name": "Jiggle Documentation",
  "tasks": [...]
}
```

**Why this is wrong:**
- Activity templates MUST be registered in SurrealDB via the backend API
- Templates created as local files are invisible to the learning system
- No execution tracking, no metrics, no Thompson Sampling optimization
- Bypasses the entire recommendation and selection pipeline

**What should have been done:**
```python
# Use the MCP tool to create the template
await create_activity_template_tool(
    name="Jiggle Documentation",
    description="Systematically organize documentation by date...",
    category="tool",
    tasks=json.dumps([...]),  # Task definitions
    context_requirements=json.dumps([]),
    validation=json.dumps({})
)
# Returns: {"status": "success", "template_id": "variant_xyz", ...}
```

---

### Issue #2: Manual Tool Execution Simulation (Lines ~50-100 in transcript)

**What the agent did:**
- Manually called bash, read, edit tools
- Simulated what the activity "would do"
- Created test files to demonstrate functionality
- Never actually executed through the activity system

**Why this is wrong:**
- No execution state tracking (ActivityExecution)
- No step results recording (StepResult)
- No cost tracking, no token tracking
- No validation pass/fail recording
- No trailblazing if validation fails
- **Zero learning happens** - the backend has no idea this "execution" occurred

**What should have been done:**
```python
# 1. Start execution
result = await start_activity_execution_tool(
    activity_id="jiggle-documentation",
    session_id="ses_3d0a89281ffezf1K6U68xB0TWG",
    variables=json.dumps({"doc_directory": "."}),
    cost_budget=1.0
)
execution_id = json.loads(result)["execution_id"]

# 2. Get first step
step = await get_next_step_tool(execution_id)
# Agent sees ONLY the current step prompt/instructions

# 3. Execute the step (use tools as directed)
# ... do the work ...

# 4. Report result
await report_step_result_tool(
    execution_id=execution_id,
    step_id=step["current_step"]["step_id"],
    success=True,
    output="Scanned 224 .md files, found relationships...",
    cost=0.05,
    tokens=1500,
    tool_calls=json.dumps([{"tool": "glob", "args": {...}}])
)

# 5. Repeat for each step (get_next_step → execute → report)
```

---

### Issue #3: No Backend Integration

**Architecture the agent ignored:**

```
┌─────────────────────────────────────────────────────────────┐
│                   CORRECT WORKFLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. CREATE TEMPLATE                                          │
│     metabob-opencode agent                                   │
│     → create_activity_template_tool (MCP)                    │
│     → ActivityManager.create_template()                      │
│     → POST /activity-recommendations/variants                │
│     → SurrealDB stores variant                               │
│                                                               │
│  2. SEARCH & SELECT                                          │
│     metabob-opencode agent                                   │
│     → search_activities_tool(query="organize docs")          │
│     → ActivityManager.search_activities()                    │
│     → POST /activity-recommendations/recommendations         │
│     → Thompson Sampling ranks variants                       │
│     → Returns top recommendations with impression_id         │
│                                                               │
│  3. EXECUTE                                                  │
│     metabob-opencode agent                                   │
│     → start_activity_execution_tool(...)                     │
│     → Creates ActivityExecution with execution_id            │
│     → Records impression + selection for learning            │
│                                                               │
│     Loop for each step:                                      │
│       → get_next_step_tool(execution_id)                     │
│       → Agent receives ONLY current step                     │
│       → Agent executes step using available tools            │
│       → report_step_result_tool(...)                         │
│       → Tracks cost, tokens, success/failure                 │
│                                                               │
│  4. VALIDATION & TRAILBLAZING                               │
│     After all steps:                                         │
│     → ActivityManager._check_completion()                    │
│     → Runs validation rules                                  │
│     → If PASS: Record successful outcome                     │
│     → If FAIL: Enter trailblazing mode                       │
│         - Generate fix steps within cost budget              │
│         - Agent tries to fix issues                          │
│         - Re-validate                                        │
│                                                               │
│  5. LEARNING                                                 │
│     → ActivityManager._record_outcome()                      │
│     → POST /activity-recommendations/conversions             │
│     → Updates Thompson Sampling statistics:                  │
│         - Success rate (alpha/beta parameters)               │
│         - Cost metrics                                       │
│         - Duration metrics                                   │
│     → Future recommendations influenced by this data         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**What the agent actually did:**

```
┌─────────────────────────────────────────────────────────────┐
│                 AGENT'S ACTUAL WORKFLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Write JSON file to disk                                  │
│     ❌ Not registered in SurrealDB                           │
│     ❌ Not visible to recommendation system                  │
│                                                               │
│  2. Manually call tools (bash, read, edit)                  │
│     ❌ No execution tracking                                 │
│     ❌ No metrics recorded                                   │
│     ❌ No step-by-step state management                      │
│                                                               │
│  3. Create example output files                              │
│     ❌ Demonstrates functionality but not real execution     │
│                                                               │
│  4. Mark TODO complete                                       │
│     ❌ Backend has zero knowledge this occurred              │
│     ❌ Zero learning happens                                 │
│     ❌ Thompson Sampling never updated                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Architectural Components the Agent Ignored

### 1. ActivityManager (`metabob-cli/mcp/activity_manager.py`)

**Purpose:** Single source of truth for activity specifications and execution state

**Key responsibilities:**
- Fetch activity templates from backend (SurrealDB via API)
- Manage execution state (ActivityExecution objects)
- Deliver steps incrementally (agent never sees full activity upfront)
- Track metrics (cost, tokens, duration)
- Record outcomes for Thompson Sampling
- Handle trailblazing when validation fails

**What the agent should have used:**
```python
# Lines 968-1047: create_template()
await manager.create_template(
    name="Jiggle Documentation",
    description="...",
    category="tool",
    tasks=[...],
    context_requirements=[...],
    validation={...}
)

# Lines 447-552: start_execution()
await manager.start_execution(
    activity_id="jiggle-documentation",
    session_id="ses_...",
    variables={},
    cost_budget=1.0
)

# Lines 554-626: get_next_step()
step = await manager.get_next_step(execution_id)
# Returns ONLY the current step, not all steps

# Lines 628-703: report_step_result()
await manager.report_step_result(
    execution_id=execution_id,
    step_id=step_id,
    success=True,
    output="...",
    cost=0.05,
    tokens=1500,
    tool_calls=[...]
)

# Lines 777-855: _record_outcome()
# Called automatically when execution completes
# Records to /activity-recommendations/conversions
```

### 2. MCP Tools (`metabob-cli/mcp/tools.py`)

**Available tools the agent should have used:**

#### Activity Template Management
```python
# Lines 3802-3856: create_activity_template_tool
@mcp.tool(name="create_activity_template")
async def create_activity_template_tool(
    name: str,
    description: str,
    category: str,
    tasks: str,  # JSON array
    context_requirements: str = "[]",
    validation: str = "{}"
) -> str:
    # Creates template in SurrealDB via backend API
    # Returns: {"status": "success", "template_id": "variant_xyz", ...}

# Lines 3898-3938: evolve_activity_template_tool
@mcp.tool(name="evolve_activity_template")
async def evolve_activity_template_tool(
    parent_id: str,
    changes: str,  # JSON with modifications
    evolution_note: str,
    evolution_type: str = "derived"
) -> str:
    # Creates derived variant with genealogy tracking
    # Returns parent_hash, lineage, new variant_id
```

#### Activity Execution
```python
# Lines 3462-3499: start_activity_execution_tool
@mcp.tool(name="start_activity_execution")
async def start_activity_execution_tool(
    activity_id: str,
    session_id: str,
    variables: str = "{}",
    cost_budget: float = 1.0
) -> str:
    # Initializes execution tracking
    # Records impression/selection for learning
    # Returns: {"execution_id": "exec_abc123", ...}

# Lines 3539-3554: get_next_step_tool
@mcp.tool(name="get_next_step")
async def get_next_step_tool(execution_id: str) -> str:
    # Returns ONLY the current step
    # Agent cannot see future steps
    # Returns: {"current_step": {...}, "step_index": 0, ...}

# Lines 3591-3650: report_step_result_tool
@mcp.tool(name="report_step_result")
async def report_step_result_tool(
    execution_id: str,
    step_id: str,
    success: bool,
    output: str = "",
    error: str = "",
    cost: float = 0.0,
    tokens: int = 0,
    tool_calls: str = "[]"
) -> str:
    # Records step completion with metrics
    # Advances to next step or triggers validation
    # Returns: {"continue": true, ...} or {"complete": true, ...}
```

### 3. Backend API (`metabob-rpc-api`)

**Endpoints the system uses:**

```python
# Activity Template Management
POST /activity-recommendations/variants
GET  /activity-recommendations/variants/{variant_id}/details
POST /activity-recommendations/variants/{parent_id}/derive
GET  /activity-recommendations/variants/{variant_id}/lineage

# Recommendation & Selection (Thompson Sampling)
POST /activity-recommendations/recommendations
POST /activity-recommendations/selections

# Execution Outcomes (Learning)
POST /activity-recommendations/conversions

# All stored in SurrealDB
```

---

## Why This Matters: The Learning Loop

The entire purpose of the activity system is to **learn and optimize** through execution feedback:

### Thompson Sampling Workflow

```
1. TEMPLATE CREATION
   → New variant starts with default priors (alpha=1, beta=1)
   → Means: 50% expected success rate (uniform prior)

2. RECOMMENDATION
   → Thompson Sampling samples from Beta(alpha, beta) distribution
   → Variants with higher success rates sampled more often
   → But exploration parameter ensures trying underperforming variants
   → Returns ranked recommendations with impression_id

3. SELECTION
   → User/agent selects a variant
   → Records selection_id linked to impression_id
   → Tracks time_to_decision_ms

4. EXECUTION
   → Step-by-step execution with metrics tracking
   → Cost, tokens, duration, tool usage
   → Validation pass/fail determination

5. OUTCOME RECORDING
   → POST /activity-recommendations/conversions
   → Updates Thompson Sampling parameters:
       - If success: alpha += 1
       - If failure: beta += 1
   → Updates metrics: avg_cost, avg_duration, quality_score

6. NEXT RECOMMENDATION
   → Future searches use updated Thompson Sampling parameters
   → Successful variants get recommended more often
   → Failed variants tried less but not eliminated (exploration)
   → Over time, best variants emerge naturally
```

### What the Agent's Workflow Produced

```
1. JSON file created ✓
2. Manual tool execution ✓
3. Example output files ✓
4. Backend aware of this? ✗
5. Metrics recorded? ✗
6. Thompson Sampling updated? ✗
7. Learning happened? ✗

Result: ZERO impact on the system's ability to learn and improve
```

---

## Correct Implementation: Step by Step

### Phase 1: Template Creation (Development Environment)

**Context:** Agent is in a development session, not executing an activity

```python
# Step 1: Define the activity structure
tasks = [
    {
        "step_id": "scan-inventory",
        "title": "Scan and Inventory Documentation",
        "description": "Find all .md files and extract metadata",
        "prompt": {
            "template": "Use glob to find all *.md files in {{doc_directory}}. For each file, extract: file path, last modified date, file size, header text (first 100 chars).",
            "variables": ["doc_directory"]
        },
        "tools": ["glob", "bash", "read"],
        "validation": {
            "type": "output_contains",
            "required_fields": ["total_files", "file_list"]
        }
    },
    {
        "step_id": "analyze-relationships",
        "title": "Analyze Content Relationships",
        "description": "Identify which docs relate to each other",
        "prompt": {
            "template": "Read file contents and identify: cross-references, topic overlap, duplicate content. Build relationship graph."
        },
        "tools": ["read", "bash"],
        "dependencies": ["scan-inventory"]
    },
    {
        "step_id": "percolate-updates",
        "title": "Percolate Details Backwards",
        "description": "Copy newer details into older related docs",
        "prompt": {
            "template": "For each pair of related docs where newer has more detail, use StrReplace to add newer content to older doc with attribution."
        },
        "tools": ["read", "StrReplace"],
        "dependencies": ["analyze-relationships"]
    },
    {
        "step_id": "delete-obsolete",
        "title": "Delete Obsolete Documents",
        "description": "Remove files that are superseded",
        "prompt": {
            "template": "For docs marked as obsolete (content fully merged into others), use bash rm to delete them."
        },
        "tools": ["bash"],
        "dependencies": ["percolate-updates"]
    },
    {
        "step_id": "generate-report",
        "title": "Generate Summary Report",
        "description": "Create comprehensive summary of changes",
        "prompt": {
            "template": "Write a SUMMARY.md file listing: files updated, files deleted, relationships found, time saved."
        },
        "tools": ["Write"],
        "dependencies": ["delete-obsolete"]
    }
]

# Step 2: Create the template via MCP
result = await create_activity_template_tool(
    name="Jiggle Documentation",
    description="Systematically organize documentation by sorting by date, percolating newer details backwards into older related docs, and deleting obsolete files.",
    category="tool",
    tasks=json.dumps(tasks),
    context_requirements=json.dumps([
        {
            "type": "impulse",
            "key": "doc_directory",
            "description": "Root directory containing documentation files"
        }
    ]),
    validation=json.dumps({
        "type": "files_exist",
        "required_files": ["SUMMARY.md"]
    })
)

# Result:
# {
#   "status": "success",
#   "template_id": "jiggle-documentation:sha256_abc123",
#   "content_hash": "sha256_abc123",
#   "name": "Jiggle Documentation",
#   "description": "...",
#   "task_count": 5
# }

# NOW the template is in SurrealDB and can be discovered/executed
```

### Phase 2: Activity Discovery & Selection

**Context:** Agent needs to organize documentation

```python
# Step 1: Search for relevant activities
result = await search_activities_tool(
    query="organize documentation by date",
    category="tool",
    limit=10
)

# Thompson Sampling returns ranked recommendations:
# {
#   "recommendations": [
#     {
#       "activity_id": "jiggle-documentation",
#       "variant_id": "jiggle-documentation:sha256_abc123",
#       "name": "Jiggle Documentation",
#       "description": "...",
#       "predicted_conversion": 0.65,  # 65% expected success
#       "expected_value": 0.55,
#       "confidence": 0.82,
#       "impression_id": "imp_xyz789",  # Important for learning!
#       "estimated_cost": 0.35,
#       "estimated_duration_ms": 45000
#     },
#     ...
#   ]
# }

# Step 2: Agent reviews options and selects one
# (This happens automatically when starting execution)
```

### Phase 3: Activity Execution

**Context:** Agent executes the selected activity

```python
# Step 1: Start execution
result = await start_activity_execution_tool(
    activity_id="jiggle-documentation:sha256_abc123",
    session_id="ses_3d0a89281ffezf1K6U68xB0TWG",
    variables=json.dumps({"doc_directory": "."}),
    cost_budget=1.0
)

# Result:
# {
#   "execution_id": "exec_def456",
#   "activity_id": "jiggle-documentation",
#   "status": "running",
#   "cost_budget": 1.0,
#   "message": "Execution started - call get_next_step for first step"
# }

execution_id = "exec_def456"

# Step 2: Get first step
step_result = await get_next_step_tool(execution_id)

# Result:
# {
#   "execution_id": "exec_def456",
#   "step_index": 0,
#   "total_steps": 5,
#   "current_step": {
#     "step_id": "scan-inventory",
#     "title": "Scan and Inventory Documentation",
#     "description": "Find all .md files and extract metadata",
#     "tools": ["glob", "bash", "read"]
#   },
#   "variables": {"doc_directory": "."},
#   "cost_remaining": 1.0
# }

# Step 3: Execute the step (use available tools)
# Agent sees the prompt and uses tools as directed
files = await glob_tool("*.md")
metadata = []
for file in files:
    stat = await bash_tool(f"stat -c '%Y %s' {file}")
    header = await read_tool(file, limit=5)
    metadata.append({
        "path": file,
        "modified": stat.split()[0],
        "size": stat.split()[1],
        "header": header
    })

# Step 4: Report result
await report_step_result_tool(
    execution_id=execution_id,
    step_id="scan-inventory",
    success=True,
    output=json.dumps({
        "total_files": len(metadata),
        "file_list": metadata
    }),
    cost=0.05,
    tokens=1200,
    tool_calls=json.dumps([
        {"tool": "glob", "pattern": "*.md"},
        {"tool": "bash", "command": "stat ..."},
        {"tool": "read", "file": "..."}
    ])
)

# Result:
# {
#   "continue": true,
#   "current_step": 1,
#   "total_steps": 5,
#   "cost_remaining": 0.95
# }

# Step 5: Repeat for remaining steps
# Loop: get_next_step → execute → report_step_result
```

### Phase 4: Validation & Completion

```python
# After all 5 steps reported, get_next_step returns validation result:

final_result = await get_next_step_tool(execution_id)

# If validation passes:
# {
#   "complete": true,
#   "message": "Activity completed and validated"
# }
# → ActivityManager._record_outcome(success=True)
# → POST /activity-recommendations/conversions
# → Thompson Sampling alpha += 1

# If validation fails:
# {
#   "trailblazing": true,
#   "message": "Validation failed: SUMMARY.md not found. Entering trailblazing mode.",
#   "validation_error": "Required file SUMMARY.md does not exist",
#   "cost_remaining": 0.65,
#   "max_trailblaze_cost": 0.5
# }
# → Agent receives fix prompt
# → Agent tries to fix issue
# → Re-validation
# → If still fails after max attempts: outcome=failure
# → Thompson Sampling beta += 1
```

---

## Impact on Learning System

### With Correct Workflow

```
Execution 1: success → alpha=2, beta=1 (67% success rate)
Execution 2: success → alpha=3, beta=1 (75% success rate)
Execution 3: failure → alpha=3, beta=2 (60% success rate)
Execution 4: success → alpha=4, beta=2 (67% success rate)

Thompson Sampling now knows:
- This variant works ~67% of the time
- Average cost: $0.42
- Average duration: 38 seconds
- Common failure mode: validation issue with percolation step

Future recommendations weighted accordingly
Exploration parameter ensures continued testing
Variant evolution based on real execution data
```

### With Agent's Workflow (JSON files)

```
Executions tracked: 0
Success rate: unknown (uniform prior 50%)
Cost data: none
Duration data: none
Failure modes: unknown

Thompson Sampling has ZERO information
Cannot optimize recommendations
Cannot evolve variants based on data
System cannot learn or improve
```

---

## Key Architectural Principles Violated

### 1. **Incremental Step Delivery**

**Design intent:** Agent never sees full activity upfront
- Prevents "gaming the system" by looking ahead
- Forces execution of each step before knowing next step
- Enables trailblazing (generating fix steps on the fly)

**What agent did:** Created full JSON with all steps visible

### 2. **Backend as Source of Truth**

**Design intent:** All templates in SurrealDB
- Enables A/B testing across multiple agents/sessions
- Provides single source of metrics and genealogy
- Allows pruning underperforming variants

**What agent did:** Local JSON file invisible to backend

### 3. **Execution Tracking**

**Design intent:** Every execution recorded for learning
- Track metrics: cost, tokens, duration, tool usage
- Record outcomes: success/failure, validation results
- Feed Thompson Sampling for optimization

**What agent did:** Manual tool calls with zero tracking

### 4. **Validation & Trailblazing**

**Design intent:** Deterministic validation ensures quality
- Automated checks for expected outcomes
- Trailblazing generates fix steps when validation fails
- Tracks trailblazing success rates separately

**What agent did:** No validation, just demonstration files

---

## Recommendations for Agent Improvement

### 1. Add Activity System Awareness

The metabob-opencode agent needs explicit instructions:

```markdown
## Activity Template Creation

When creating a new activity template:

1. NEVER create JSON files directly
2. ALWAYS use create_activity_template_tool
3. Define tasks with validation rules
4. Template gets registered in SurrealDB
5. Returns variant_id for future execution

## Activity Execution

When executing an activity:

1. Use start_activity_execution_tool to begin
2. Loop: get_next_step → execute → report_step_result
3. You will NOT see all steps upfront (by design)
4. Report metrics: cost, tokens, tool usage
5. Validation happens automatically
6. If validation fails, trailblaze within cost budget
```

### 2. Prevent JSON File Creation

Add validation in activity creation flow:

```python
# In agent instructions:
"Do NOT create activity templates as JSON files.
 Use create_activity_template_tool exclusively.
 Direct file creation bypasses the learning system."
```

### 3. Execution State Management

Agent should track execution state:

```python
# Agent maintains:
current_execution = {
    "execution_id": "exec_...",
    "activity_id": "...",
    "step_index": 2,
    "total_steps": 5,
    "cost_so_far": 0.15,
    "cost_budget": 1.0,
    "steps_completed": [
        {"step_id": "scan-inventory", "success": true},
        {"step_id": "analyze-relationships", "success": true}
    ]
}

# Current step comes from get_next_step_tool
# Agent executes ONLY the current step
# Reports result before seeing next step
```

### 4. Emphasize Learning Goals

Make the learning objective explicit:

```markdown
## Purpose of Activity System

The activity system learns from execution to optimize future performance:

- Which activity variants work best for which tasks?
- What is the typical cost/duration for each variant?
- What are common failure modes?
- How can variants be evolved to improve success rates?

**Every execution matters for learning.**

Bypassing the system (creating JSON files, simulating execution)
means ZERO learning happens. The system cannot improve without
real execution data flowing through the proper tracking mechanisms.
```

---

## Testing & Validation

### Unit Tests Needed

1. **Template Creation Flow**
   - Test create_activity_template_tool
   - Verify backend API called correctly
   - Confirm template stored in SurrealDB
   - Check variant_id and content_hash returned

2. **Execution Flow**
   - Test start_execution → get_next_step loop
   - Verify incremental step delivery
   - Confirm metrics tracking
   - Test validation pass/fail

3. **Learning Loop**
   - Test outcome recording
   - Verify Thompson Sampling updates
   - Confirm metrics aggregation
   - Test recommendation ranking changes

### E2E Test Scenario

```python
# Test: Complete activity execution with learning

# 1. Create template
template_result = await create_activity_template_tool(...)
variant_id = template_result["template_id"]

# 2. Search and get recommendation
recs = await search_activities_tool(query="test", limit=1)
assert variant_id in [r["variant_id"] for r in recs]

# 3. Execute activity
exec_result = await start_activity_execution_tool(
    activity_id=variant_id,
    session_id="test_session",
    variables={},
    cost_budget=1.0
)
execution_id = exec_result["execution_id"]

# 4. Execute all steps
while True:
    step = await get_next_step_tool(execution_id)
    
    if step.get("complete"):
        break
    
    # Simulate step execution
    await report_step_result_tool(
        execution_id=execution_id,
        step_id=step["current_step"]["step_id"],
        success=True,
        output="test output",
        cost=0.01,
        tokens=100
    )

# 5. Verify outcome recorded in backend
# Query SurrealDB for execution record
# Verify Thompson Sampling parameters updated
# Confirm next recommendation reflects this execution
```

---

## Conclusion

The session transcript demonstrates a fundamental misunderstanding of the activity system architecture. The agent treated activity creation as "writing a JSON file" when it should be "registering a template in the learning system via the backend API."

**Key Takeaways:**

1. **Activity templates** are not JSON files - they're records in SurrealDB managed via the backend API
2. **Activity execution** is not manual tool calling - it's a tracked, step-by-step process with metrics
3. **Learning** requires real execution data flowing through the proper channels - no shortcuts
4. **Thompson Sampling** cannot optimize without execution outcomes being recorded
5. **The agent must use MCP tools** - direct file creation bypasses the entire system

**Next Steps:**

1. Update metabob-opencode agent instructions to emphasize MCP tool usage
2. Add guardrails to prevent direct JSON file creation for activities
3. Implement E2E tests for complete activity lifecycle
4. Verify learning loop: execution → outcome → Thompson Sampling update → recommendation change
5. Document correct workflow prominently in agent memory/context

The goal is **recording and learning from activity execution** to optimize the system over time. Manual JSON files and simulated execution produce zero learning and defeat the entire purpose of the activity system.
