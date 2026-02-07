# Activity System: Quick Reference

## ❌ WRONG: What the Agent Did

```python
# Created local JSON file
with open(".test-jiggle-docs/jiggle-documentation.json", "w") as f:
    json.dump({"id": "jiggle-docs", "tasks": [...]}, f)

# Manually called tools
await bash_tool("find . -name '*.md'")
await read_tool("file.md")
await edit_tool("file.md", changes)

# Created example files
await write_tool("SUMMARY.md", "Example summary")

# Result: ZERO learning, ZERO metrics, ZERO Thompson Sampling updates
```

## ✅ CORRECT: Proper Workflow

### Phase 1: Create Template (Development Environment)

```python
# Use MCP tool - registers in SurrealDB
result = await create_activity_template_tool(
    name="Jiggle Documentation",
    description="Organize docs by date, percolate details backwards, delete obsolete",
    category="tool",
    tasks=json.dumps([
        {
            "step_id": "scan-inventory",
            "title": "Scan and Inventory Documentation",
            "description": "Find all .md files and extract metadata",
            "prompt": {
                "template": "Use glob to find all *.md files in {{doc_directory}}...",
                "variables": ["doc_directory"]
            },
            "tools": ["glob", "bash", "read"],
            "validation": {
                "type": "output_contains",
                "required_fields": ["total_files", "file_list"]
            }
        },
        # ... more tasks ...
    ]),
    context_requirements=json.dumps([...]),
    validation=json.dumps({"type": "files_exist", "required_files": ["SUMMARY.md"]})
)

# Returns: {"template_id": "jiggle-documentation:sha256_abc123", ...}
# NOW in SurrealDB, visible to all agents, tracked by Thompson Sampling
```

### Phase 2: Search & Select (Execution Environment)

```python
# Search using Thompson Sampling
recommendations = await search_activities_tool(
    query="organize documentation by date",
    category="tool",
    limit=10
)

# Returns ranked list with metrics:
# [
#   {
#     "variant_id": "jiggle-documentation:sha256_abc123",
#     "predicted_conversion": 0.65,  # 65% expected success
#     "expected_value": 0.55,
#     "confidence": 0.82,
#     "impression_id": "imp_xyz789",  # For learning!
#     "estimated_cost": 0.35,
#     "estimated_duration_ms": 45000
#   },
#   ...
# ]

# Agent selects based on expected value, confidence, cost
```

### Phase 3: Execute Activity

```python
# Start execution - creates tracking state
result = await start_activity_execution_tool(
    activity_id="jiggle-documentation:sha256_abc123",
    session_id="ses_3d0a89281ffezf1K6U68xB0TWG",
    variables=json.dumps({"doc_directory": "."}),
    cost_budget=1.0
)
execution_id = result["execution_id"]  # e.g., "exec_def456"

# Loop through steps - incremental delivery
while True:
    # Get ONLY the current step (not all steps!)
    step_response = await get_next_step_tool(execution_id)
    
    if step_response.get("complete"):
        # Activity completed successfully
        break
    
    if step_response.get("trailblazing"):
        # Validation failed, fix and retry
        # Agent receives fix instructions
        pass
    
    step = step_response["current_step"]
    
    # Execute the step using tools specified
    # Agent sees: step_id, title, description, tools
    # Agent does NOT see future steps
    
    # Example: Execute scan-inventory step
    files = await glob_tool("*.md")
    metadata = []
    for file in files:
        stat = await bash_tool(f"stat -c '%Y %s' {file}")
        header = await read_tool(file, limit=5)
        metadata.append({"path": file, "modified": stat.split()[0], ...})
    
    # Report result with metrics
    await report_step_result_tool(
        execution_id=execution_id,
        step_id=step["step_id"],
        success=True,
        output=json.dumps({"total_files": len(metadata), "file_list": metadata}),
        cost=0.05,
        tokens=1200,
        tool_calls=json.dumps([
            {"tool": "glob", "pattern": "*.md"},
            {"tool": "bash", "command": "stat ..."},
            {"tool": "read", "file": "..."}
        ])
    )
    
    # Continue to next step
```

### Phase 4: Validation & Learning (Automatic)

```python
# After all steps, ActivityManager runs validation
# If PASS:
#   - Records outcome: success=True
#   - POST /activity-recommendations/conversions
#   - Thompson Sampling: alpha += 1 (increase success count)
#   - Future recommendations: this variant ranked higher

# If FAIL:
#   - Trailblazing: generate fix steps
#   - Agent tries to fix within cost budget
#   - If still fails: success=False
#   - Thompson Sampling: beta += 1 (increase failure count)
#   - Future recommendations: this variant ranked lower
```

## Key Architectural Concepts

### 1. Incremental Step Delivery

```
Agent perspective:
  Step 1: "Scan documentation" → Execute → Report
  Step 2: "Analyze relationships" → Execute → Report
  Step 3: "Percolate updates" → Execute → Report
  ...

Agent does NOT see:
  - Full list of steps upfront
  - Future step prompts or validation rules
  - Internal trailblazing strategies

Why? Prevents gaming, enables dynamic trailblazing, forces execution discipline
```

### 2. Thompson Sampling (Bayesian A/B Testing)

```
Each variant tracks:
  - alpha: number of successes
  - beta: number of failures
  - Success rate ≈ alpha / (alpha + beta)

Recommendation algorithm:
  1. For each variant, sample from Beta(alpha, beta) distribution
  2. Rank by sampled value
  3. Return top N recommendations
  
Effect:
  - High success variants recommended more often
  - Low success variants still tried occasionally (exploration)
  - Over time, best variants naturally emerge
  - No manual tuning required
```

### 3. Genealogy & Evolution

```
Template v1 (root)
  └─ variant:sha256_aaa (original)
      ├─ variant:sha256_bbb (optimized: faster percolation)
      │   └─ variant:sha256_ccc (optimized: better validation)
      └─ variant:sha256_ddd (derived: add dry-run mode)

Each variant tracks:
  - parent_hash: direct parent
  - lineage: all ancestors
  - evolution_type: derived, optimized, merged
  - evolution_note: why this variant was created

Thompson Sampling competes variants within same activity
Best variants become templates for future evolution
```

## MCP Tools Reference

### Template Management

```python
# Create new template
create_activity_template_tool(
    name: str,
    description: str,
    category: str,  # "feature", "bugfix", "refactor", "tool"
    tasks: str,  # JSON array of task definitions
    context_requirements: str = "[]",
    validation: str = "{}"
) -> str

# Evolve from existing
evolve_activity_template_tool(
    parent_id: str,
    changes: str,  # JSON with modifications
    evolution_note: str,
    evolution_type: str = "derived"  # "derived", "optimized", "merged"
) -> str

# Get genealogy
get_template_lineage_tool(
    template_id: str
) -> str
```

### Activity Discovery

```python
# Search activities (Thompson Sampling)
search_activities_tool(
    query: str,
    category: str = "",
    limit: int = 20,
    min_success_rate: float = 0.0
) -> str

# Get specific activity metadata (NOT full steps)
get_activity_tool(
    activity_id: str
) -> str
```

### Activity Execution

```python
# Start execution
start_activity_execution_tool(
    activity_id: str,
    session_id: str,
    variables: str = "{}",
    cost_budget: float = 1.0
) -> str

# Get current step (incremental)
get_next_step_tool(
    execution_id: str
) -> str

# Report step completion
report_step_result_tool(
    execution_id: str,
    step_id: str,
    success: bool,
    output: str = "",
    error: str = "",
    cost: float = 0.0,
    tokens: int = 0,
    tool_calls: str = "[]"
) -> str

# Get execution state
get_execution_state_tool(
    execution_id: str
) -> str
```

## Common Mistakes to Avoid

### ❌ DON'T: Create JSON files directly

```python
# WRONG - bypasses learning system
with open("activity.json", "w") as f:
    json.dump({"id": "my-activity", "tasks": [...]}, f)
```

### ✅ DO: Use create_activity_template_tool

```python
# CORRECT - registers in SurrealDB
await create_activity_template_tool(
    name="My Activity",
    description="...",
    category="tool",
    tasks=json.dumps([...])
)
```

### ❌ DON'T: Manually execute and simulate

```python
# WRONG - no tracking, no learning
await bash_tool("do something")
await write_tool("output.txt", "result")
print("Done!")  # Zero metrics recorded
```

### ✅ DO: Use activity execution flow

```python
# CORRECT - full tracking
execution_id = await start_activity_execution_tool(...)
step = await get_next_step_tool(execution_id)
# ... execute step using tools ...
await report_step_result_tool(
    execution_id=execution_id,
    step_id=step["step_id"],
    success=True,
    output="...",
    cost=0.05,
    tokens=1200,
    tool_calls=json.dumps([...])
)
# Metrics recorded, learning happens
```

### ❌ DON'T: Try to see all steps upfront

```python
# WRONG - defeats incremental delivery design
activity = await get_activity_tool(activity_id)
all_tasks = activity["tasks"]  # This field doesn't exist!
for task in all_tasks:
    # execute task
```

### ✅ DO: Trust incremental delivery

```python
# CORRECT - step-by-step execution
while True:
    step = await get_next_step_tool(execution_id)
    if step.get("complete"):
        break
    # Execute ONLY current step
    # Report result
    # Get NEXT step (repeat)
```

## Benefits of Correct Workflow

### Learning & Optimization
- Thompson Sampling learns success rates
- Cost and duration metrics tracked
- Future recommendations automatically optimized
- No manual tuning required

### Quality Assurance
- Deterministic validation ensures correctness
- Trailblazing fixes issues automatically
- Failure modes tracked and analyzed
- Variants compete on real metrics

### Knowledge Sharing
- Templates visible to all agents
- Best practices encoded as variants
- Genealogy shows evolution history
- Successful patterns reused

### Development Velocity
- Agents discover existing solutions
- Avoid reinventing the wheel
- Learn from past successes and failures
- System improves over time

## Summary

**The activity system is a learning system, not a scripting system.**

- Templates are data (in SurrealDB), not files
- Execution is tracked (metrics), not simulated
- Learning is automatic (Thompson Sampling), not manual
- Evolution is based on data (genealogy), not hunches

**Every execution matters for learning. Use the proper workflow.**
