# Traceable Data Flow - Using Metabob for Debugging

## The Goal

When a test fails, we should be able to trace through the data flow chain using metabob-cli's component tracking and cochange analysis to identify where the error occurred.

---

## Current Metabob-CLI Tools

### 1. Component Tracking

**Tool**: `list_file_components`

**Purpose**: Lists all components in a file with their types

**Usage**:
```python
list_file_components(file_path="src/session/prompt.ts")
# Returns: prepareSessionMemory (function), buildMemoryAgentPrompt (function), etc.
```

### 2. Component Annotation

**Tool**: `annotate_component`

**Purpose**: Document why a component exists or was changed

**Usage**:
```python
annotate_component(
    file_path="src/session/prompt.ts",
    component_name="prepareSessionMemory",
    component_type="function",
    reason="Spawns memory agent subagent to manage context. Entry point for session memory preparation."
)
```

### 3. Cochange Analysis

**Tool**: CPG-based cochange detection (in cpg_manager.py)

**Purpose**: Identify which components change together

**Usage**: Shows which files/functions typically change together when fixing similar issues

### 4. Impact Analysis

**Tool**: CPG-based impact analysis

**Purpose**: Show dependencies and affected components

**Usage**: When component X changes, what else might be affected?

---

## Strategy: Annotate the Data Flow Chain

### Session Memory Agent Flow

**Annotate each component in the chain**:

1. **turn-lifecycle-hooks.ts::session-memory-preparation**
   ```python
   annotate_component(
       file_path="src/session/turn-lifecycle-hooks.ts",
       component_name="session-memory-preparation",
       component_type="hook",
       reason="""DATA FLOW: Entry point for session memory preparation
       
       Dependencies:
       - CALLS: SessionPrompt.prepareSessionMemory()
       - TRIGGERS: Memory agent subagent spawn
       
       Expected behavior:
       - Hook executes on every non-trivial turn
       - Creates memory agent session
       - Returns success=true when complete
       
       Failure modes:
       - Hook disabled → Check enabled() logic
       - prepareSessionMemory throws → Check subagent spawn
       - Timeout → Check memory agent execution time
       
       Validation:
       - Log: "executing hook {session-memory-preparation}"
       - Log: "hook completed {success: true}"
       - Duration: < 5 seconds typical"""
   )
   ```

2. **prompt.ts::prepareSessionMemory**
   ```python
   annotate_component(
       file_path="src/session/prompt.ts",
       component_name="prepareSessionMemory",
       component_type="function",
       reason="""DATA FLOW: Spawns memory agent subagent
       
       Dependencies:
       - CALLED BY: session-memory-preparation hook
       - CALLS: Session.create() to spawn subagent
       - CALLS: SessionPrompt.prompt() with agent="memory"
       - EXTRACTS: Activity.getActivityForSession() for hints
       
       Expected behavior:
       - Extract activity context hints if present
       - Build minimal prompt (~200 tokens)
       - Spawn memory agent subagent session
       - Return after memory agent completes
       
       Failure modes:
       - Session.create() fails → Check parent session exists
       - Prompt fails → Check memory agent available
       - Hints not extracted → Check activity template
       
       Validation:
       - Log: "prepareSessionMemory() starting"
       - Log: "spawning memory agent subagent {promptLength: <300}"
       - Log: "memory agent subagent completed"
       - Creates session with title "Memory agent"
       """
   )
   ```

3. **Memory Agent (agent.ts::memory)**
   ```python
   annotate_component(
       file_path="src/agent/agent.ts",
       component_name="memory",
       component_type="agent",
       reason="""DATA FLOW: Memory agent subagent configuration
       
       Dependencies:
       - INVOKED BY: prepareSessionMemory()
       - TOOLS: memory_budget, memory_outline, impulse_create, impulse_load
       - OPERATES ON: Parent session via tool calls
       
       Expected behavior:
       - Receives minimal task prompt
       - Calls memory_budget() to check state
       - Calls impulse_create() to allocate context
       - Calls impulse_load() for high-priority impulses
       
       Failure modes:
       - Tool calls fail → Check parent session detection
       - LLM timeout → Check prompt size, model
       - Wrong session → Check parent detection logic
       
       Validation:
       - Log: "tool.execute tool=memory_budget"
       - Log: "tool.execute tool=impulse_create"
       - Log: "impulse-create...memory agent operating on parent"
       """
   )
   ```

4. **impulse-create.ts::ImpulseCreateTool**
   ```python
   annotate_component(
       file_path="src/tool/impulse-create.ts",
       component_name="ImpulseCreateTool",
       component_type="tool",
       reason="""DATA FLOW: Creates impulses in target session
       
       Dependencies:
       - CALLED BY: Memory agent via tool call
       - DETECTS: Parent session from session.parentID
       - CREATES IN: Target session (parent if memory agent)
       - PUBLISHES: SessionMemory.Event.Updated
       
       Expected behavior:
       - Check if memory agent subagent (parentID set)
       - If yes: Create impulse in parent session
       - If no: Create in current session
       - Publish event for TUI update
       
       Failure modes:
       - Parent detection fails → Impulse in wrong session
       - Session doesn't exist → Error returned
       - Event not published → TUI doesn't update
       
       Validation:
       - Log: "memory agent operating on parent session"
       - Log: "created session-scoped impulse {sessionID: <parent>}"
       - Event: session.memory.updated published
       """
   )
   ```

---

## Using Metabob to Trace Failures

### Scenario: Test Fails - "Activity recommendations not appearing in TUI"

**Step 1: Identify Entry Point**

```bash
# What should have happened?
# Hook: activity-recommendation-injection → Creates impulse → TUI shows it

# Did hook execute?
grep "activity-recommendation-injection.*executing" logs

# If YES: Continue to step 2
# If NO: Use metabob to trace why
```

**Step 2: Use Metabob to Find Root Cause**

```typescript
// Query metabob for the component
await metabob.list_file_components({
  file_path: "src/session/turn-lifecycle-hooks.ts"
})

// Find annotation for activity-recommendation-injection
// Read: "Hook should execute when... Failure mode: disabled if..."

// Check the failure mode mentioned in annotation
grep "activity-recommendation.*disabled" logs

// Found: Hook was disabled
// Annotation says: "Check enabled() logic - should not check for active activity"
```

**Step 3: Trace Dependencies**

```typescript
// What does this hook depend on?
await metabob.suggest_related_changes({
  file_path: "src/session/turn-lifecycle-hooks.ts",
  component_name: "activity-recommendation-injection"
})

// Returns cochange patterns:
// - Often changes with: SessionMemory.addImpulse
// - Depends on: MetabobCLI.searchActivities
// - Related to: activity-decision-reminder hook

// Check if dependencies are working
grep "MetabobCLI.searchActivities" logs
grep "SessionMemory.addImpulse.*activity-recommendations" logs
```

**Step 4: Impact Analysis**

```typescript
// What is affected by this failure?
await metabob.analyze_impact({
  file_path: "src/session/turn-lifecycle-hooks.ts",
  component_name: "activity-recommendation-injection"
})

// Returns:
// - Downstream: TUI sidebar (needs impulse to display)
// - Downstream: Agent decision making (uses recommendations)
// - Upstream: MetabobCLI.searchActivities (provides data)
```

**Step 5: Locate Break in Chain**

```
Expected flow:
  Hook executes → searchActivities → addImpulse → Event published → TUI updates
  
Actual (from logs):
  Hook disabled ✗ → [chain broken here]
  
Root cause: enabled() logic checking for active activity
Fix: Remove activity check from enabled()
```

---

## Enhancements Needed for Metabob Tools

### Enhancement 1: Data Flow Annotations

**Add to annotations**:
```python
annotate_component(
    file_path="...",
    component_name="...",
    component_type="...",
    reason="""...existing reason...
    
    DATA FLOW:
    - Receives: <input data format>
    - Calls: <dependency components>
    - Produces: <output data format>
    - Publishes: <events if any>
    
    VALIDATION:
    - Input check: <how to verify input>
    - Output check: <how to verify output>
    - Integration check: <how to verify full chain>
    """
)
```

### Enhancement 2: Component Dependency Queries

**New MCP tool**: `get_component_dependencies`

```python
@mcp.tool()
async def get_component_dependencies(
    file_path: str,
    component_name: str
) -> dict:
    """Get explicit dependencies for a component from annotations"""
    
    # Parse annotations for CALLS, TRIGGERS, DEPENDS ON, etc.
    annotation = get_annotation(file_path, component_name)
    
    return {
        "calls": extract_calls(annotation),  # Functions this calls
        "called_by": extract_called_by(annotation),  # What calls this
        "triggers": extract_triggers(annotation),  # Events/side effects
        "depends_on": extract_depends_on(annotation),  # Required state
    }
```

### Enhancement 3: Data Flow Tracer

**New MCP tool**: `trace_data_flow`

```python
@mcp.tool()
async def trace_data_flow(
    entry_point: str,
    expected_outcome: str
) -> dict:
    """Trace data flow from entry point to expected outcome"""
    
    # Build flow graph from annotations
    flow = build_flow_graph(entry_point)
    
    # Check each step
    validation = []
    for step in flow:
        check = validate_step(step)
        validation.append({
            "step": step.name,
            "status": check.status,  # "pass" | "fail" | "unknown"
            "evidence": check.evidence,  # Log entries
            "next_steps": check.next_if_failed
        })
    
    return {
        "flow_chain": flow,
        "validation_results": validation,
        "break_point": find_first_failure(validation),
        "suggested_fixes": suggest_fixes(validation)
    }
```

### Enhancement 4: Log-Based Component Validation

**New MCP tool**: `validate_component_from_logs`

```python
@mcp.tool()
async def validate_component_from_logs(
    file_path: str,
    component_name: str,
    log_file: str = None
) -> dict:
    """Validate component behavior against its annotation expectations"""
    
    annotation = get_annotation(file_path, component_name)
    expected = parse_expected_behavior(annotation)
    
    # Check logs for evidence
    log_evidence = extract_log_evidence(log_file, component_name)
    
    results = []
    for expectation in expected:
        actual = check_in_logs(log_evidence, expectation)
        results.append({
            "expectation": expectation.description,
            "expected": expectation.pattern,
            "actual": actual.value,
            "matches": actual.matches(expectation),
            "evidence": actual.log_lines
        })
    
    return {
        "component": component_name,
        "validation_results": results,
        "pass_rate": calculate_pass_rate(results),
        "failures": [r for r in results if not r["matches"]]
    }
```

---

## Test-Driven Annotation Pattern

### Instead of Writing Tests First

**Write the component**, then **annotate its expected behavior based on design**:

```python
# After implementing prepareSessionMemory()
annotate_component(
    file_path="src/session/prompt.ts",
    component_name="prepareSessionMemory",
    component_type="function",
    reason="""
Spawns memory agent subagent for context preparation.

EXPECTED BEHAVIOR:
1. Extract activity hints from active activity
2. Build minimal prompt (~200-300 tokens)
3. Spawn memory agent subagent
4. Memory agent uses tools to create/load impulses
5. Complete in < 5 seconds

EXPECTED LOGS:
- "prepareSessionMemory() starting {promptLength: N}"
- "spawning memory agent subagent {promptLength: <300}"
- "memory agent subagent completed {duration: <5000}"

EXPECTED STATE CHANGES:
- New session created with parentID set
- Impulses created in parent session
- Events published: session.memory.updated

FAILURE MODES:
- Session.create fails → Check Instance initialized
- Prompt fails → Check memory agent config
- Timeout → Check memory agent execution
- Wrong session → Check parent detection

COCHANGE PATTERNS:
- Changes with: impulse-create.ts (parent detection)
- Changes with: memory-agent.ts (prompt format)
- Changes with: turn-lifecycle-hooks.ts (hook invocation)

VALIDATION QUERY:
grep "prepareSessionMemory\|spawning memory agent\|memory agent.*completed" logs
Expected: All three present for each turn
"""
)
```

### Then Let System Run

**Collect actual behavior** from logs/outcomes.

**Compare**: Expected (from annotation) vs Actual (from logs)

**Build validation** from mismatches.

---

## Test Structure Using Metabob

### Test: Activity Recommendation Flow

```typescript
// test-activity-recommendations.ts

import { metabob } from "./metabob-client"

async function testActivityRecommendationFlow() {
  console.log("=== Testing Activity Recommendation Flow ===\n")
  
  // Step 1: Get the data flow chain from annotations
  const chain = await metabob.trace_data_flow({
    entry_point: "turn-lifecycle-hooks.ts::activity-recommendation-injection",
    expected_outcome: "TUI shows activity recommendations"
  })
  
  console.log("Data flow chain:")
  for (const step of chain.flow_chain) {
    console.log(`  ${step.component} → ${step.next_component}`)
  }
  
  // Step 2: Validate each step from logs
  console.log("\nValidating each step:")
  for (const step of chain.flow_chain) {
    const validation = await metabob.validate_component_from_logs({
      file_path: step.file,
      component_name: step.component,
      log_file: process.env.LOG_FILE
    })
    
    console.log(`\n${step.component}:`)
    console.log(`  Pass rate: ${validation.pass_rate}%`)
    
    if (validation.failures.length > 0) {
      console.log(`  Failures:`)
      for (const failure of validation.failures) {
        console.log(`    - ${failure.expectation}`)
        console.log(`      Expected: ${failure.expected}`)
        console.log(`      Actual: ${failure.actual}`)
      }
    }
  }
  
  // Step 3: Identify break point
  if (chain.break_point) {
    console.log(`\n✗ Data flow breaks at: ${chain.break_point.component}`)
    console.log(`  Issue: ${chain.break_point.issue}`)
    console.log(`  Suggested fixes:`)
    for (const fix of chain.suggested_fixes) {
      console.log(`    - ${fix}`)
    }
  } else {
    console.log(`\n✓ Data flow complete`)
  }
}
```

**This test doesn't assume behavior** - it queries the annotations for expected behavior, then validates against actual logs.

---

## Annotating Our Implementation

### Components to Annotate

1. **Session Memory Chain**:
   - turn-lifecycle-hooks.ts::session-memory-preparation
   - prompt.ts::prepareSessionMemory
   - prompt.ts::buildMemoryAgentPrompt
   - agent.ts::memory
   - impulse-create.ts::ImpulseCreateTool
   - impulse-load.ts::ImpulseLoadTool
   - memory-budget.ts::MemoryBudgetTool
   - memory-outline.ts::MemoryOutlineTool

2. **Activity Orchestration Chain**:
   - turn-lifecycle-hooks.ts::activity-decision-reminder
   - turn-lifecycle-hooks.ts::activity-recommendation-injection
   - agent/activity.txt (agent prompt)
   - Tool availability (search_activities, activity)

3. **Component Learning Chain**:
   - turn-lifecycle-hooks.ts::session-memory-optimization
   - Component annotation logic

### Annotation Template

```python
annotate_component(
    file_path="<file>",
    component_name="<name>",
    component_type="<type>",
    reason="""<Purpose>

DATA FLOW:
- Position: <where in chain>
- Receives: <input format>
- Calls: <dependencies>
- Produces: <output format>
- Publishes: <events>

EXPECTED LOGS:
- "<log pattern 1>"
- "<log pattern 2>"

EXPECTED STATE:
- <state change 1>
- <state change 2>

FAILURE MODES:
- <condition> → <symptom> → <check>

COCHANGE PATTERNS:
- Changes with: <related components>

VALIDATION:
- Grep: "<log query>"
- Expected: <result>
"""
)
```

---

## Automated Annotation Script

### annotate-data-flow.ts

```typescript
#!/usr/bin/env bun
/**
 * Annotate all components in the session memory/activity orchestration data flow
 */

import { MCP } from "./src/mcp"

async function annotateDataFlow() {
  const client = await MCP.clients()["metabob"]
  
  const annotations = [
    {
      file: "src/session/turn-lifecycle-hooks.ts",
      component: "session-memory-preparation",
      type: "hook",
      flow_position: 1,
      receives: "TurnContext {sessionID, promptText, agent}",
      calls: ["SessionPrompt.prepareSessionMemory()"],
      produces: "HookResult {success, modified, duration}",
      logs: ["executing hook {session-memory-preparation}", "hook completed {success}"]
    },
    {
      file: "src/session/prompt.ts",
      component: "prepareSessionMemory",
      type: "function",
      flow_position: 2,
      receives: "{sessionID, promptText, agent}",
      calls: ["Session.create()", "SessionPrompt.prompt()"],
      produces: "void (side effect: memory agent session created)",
      logs: ["spawning memory agent", "memory agent completed"]
    },
    // ... more components
  ]
  
  for (const ann of annotations) {
    const reason = buildDataFlowAnnotation(ann)
    
    await client.callTool({
      name: "metabob_annotate_component",
      arguments: {
        file_path: ann.file,
        component_name: ann.component,
        component_type: ann.type,
        reason
      }
    })
    
    console.log(`✓ Annotated: ${ann.component}`)
  }
}

function buildDataFlowAnnotation(spec: any): string {
  return `DATA FLOW POSITION ${spec.flow_position}

Receives: ${spec.receives}
Calls: ${spec.calls.join(", ")}
Produces: ${spec.produces}

Expected logs:
${spec.logs.map(l => `- "${l}"`).join("\n")}

Validation:
grep "${spec.logs[0]}" logs | wc -l
Expected: > 0
`
}
```

---

## The Validation Loop

```
1. Implement component
   ↓
2. Annotate with expected behavior
   ↓
3. Run naturally
   ↓
4. Collect observations (logs, outcomes)
   ↓
5. Query metabob: compare expected vs actual
   ↓
6. Identify breaks in data flow
   ↓
7. Fix issues
   ↓
8. Update annotations with learned behavior
   ↓
[Loop]
```

---

## Why This Works

### Self-Validating System

**Annotations contain**:
- Expected behavior (from design)
- Failure modes (from experience)
- Cochange patterns (from history)
- Validation queries (for checking)

**Metabob provides**:
- Component tracking (what exists)
- Cochange analysis (what changes together)
- Impact analysis (what affects what)
- Query interface (check against logs)

**Together**:
- Test fails → Query metabob for component
- Annotation lists expected logs
- Compare with actual logs
- Annotation lists failure modes
- Check which mode matches
- Annotation lists dependencies
- Validate dependencies work
- **Pinpoint exact break in chain**

---

## Immediate Next Step

**Annotate the session memory and activity orchestration components** with:
- Data flow position
- Expected inputs/outputs
- Expected log patterns
- Failure modes
- Cochange patterns

**Then** when tests fail, metabob can guide us through the chain to find the break.

**This is algorithmic validation** - trace through components using their documented behavior, not assumptions.
