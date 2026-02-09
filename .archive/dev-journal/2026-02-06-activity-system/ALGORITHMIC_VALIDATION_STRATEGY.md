# Algorithmic Validation Strategy - Using Metabob Component Tracking

## The Approach

1. **Annotate components** with expected behavior in data flow
2. **Run tests** to execute the flow
3. **When test fails**, use metabob to trace where chain broke
4. **Metabob's cochange analysis** shows what typically needs fixing together

This is **algorithmic** - not assumptions, but traceable evidence.

---

## The Data Flow Chain

### Session Memory Agent Flow

```
Position 1: turn-lifecycle-hooks.ts::session-memory-preparation
  ↓ CALLS prepareSessionMemory()
  
Position 2: prompt.ts::prepareSessionMemory
  ↓ SPAWNS memory agent subagent
  ↓ CALLS Session.create()
  ↓ CALLS SessionPrompt.prompt()
  
Position 3: agent.ts::memory
  ↓ MAKES TOOL CALLS
  ↓ CALLS memory_budget()
  ↓ CALLS impulse_create()
  
Position 4: impulse-create.ts::ImpulseCreateTool
  ↓ DETECTS parent session
  ↓ CREATES impulse in parent
  ↓ PUBLISHES event
  
Position 5: sidebar.tsx::Sidebar
  ↓ RECEIVES event
  ↓ DISPLAYS impulse
```

---

## Validation Method

### Step 1: Annotate Each Component

**Script**: `annotate-session-memory-chain.ts`

**What it does**: For each component, stores:
- Position in data flow
- Expected inputs/outputs
- Expected log patterns
- Failure modes
- Cochange patterns

**Result**: Metabob knows the expected behavior chain.

### Step 2: Run Test

```bash
# Example: Test session memory preparation
bun run test-session-memory-flow.ts
```

**Test does**:
1. Send message
2. Check for expected impulses
3. Pass/fail based on outcome

### Step 3: Trace Failure

**If test fails**, run:

```bash
bun run trace-failure.ts session-memory-preparation
```

**Script does**:
1. Loads annotations for each component in chain
2. Extracts expected log patterns from annotations
3. Checks logs for each pattern
4. Identifies first component where pattern missing
5. Queries metabob for cochange patterns
6. Suggests which related components might need fixing

**Output**:
```
Position 1: session-memory-preparation ✓
  - "executing hook" found: 5 occurrences
  - "hook completed success=true" found: 5 occurrences

Position 2: prepareSessionMemory ✗
  - "prepareSessionMemory() starting" found: 5 occurrences
  - "spawning memory agent" NOT FOUND
  - "memory agent completed" NOT FOUND
  
✗ DATA FLOW BREAKS AT: Position 2
  Component: prepareSessionMemory
  File: src/session/prompt.ts
  
Cochange analysis shows these often change together:
  - src/session/turn-lifecycle-hooks.ts
  - src/agent/agent.ts
  
Check: Is Session.create() working? Is memory agent configured?
```

**This is algorithmic** - compares expected (from annotations) vs actual (from logs).

---

## Metabob Tools Enhancement

### What We Need

**Tool 1**: Extract expected logs from annotations

```python
@mcp.tool()
async def get_expected_logs(
    file_path: str,
    component_name: str
) -> list[str]:
    """Extract expected log patterns from component annotation"""
    
    annotation = get_annotation(file_path, component_name)
    
    # Parse "EXPECTED LOGS:" section
    logs = parse_expected_logs_section(annotation)
    
    return logs
```

**Tool 2**: Validate component from logs

```python
@mcp.tool()
async def validate_component_logs(
    file_path: str,
    component_name: str,
    log_file_path: str
) -> dict:
    """Check if component behaves as expected based on logs"""
    
    expected_logs = get_expected_logs(file_path, component_name)
    actual_logs = read_log_file(log_file_path)
    
    results = []
    for pattern in expected_logs:
        count = count_matches(actual_logs, pattern)
        results.append({
            "pattern": pattern,
            "expected": "> 0",
            "actual": count,
            "passes": count > 0
        })
    
    return {
        "component": component_name,
        "results": results,
        "pass_rate": sum(r["passes"] for r in results) / len(results),
        "failures": [r for r in results if not r["passes"]]
    }
```

**Tool 3**: Trace data flow

```python
@mcp.tool()
async def trace_data_flow_chain(
    entry_component: str,
    log_file_path: str
) -> dict:
    """Trace through data flow chain, validate each step"""
    
    # Get data flow chain from annotations
    # (Parse "CALLS:" and build graph)
    chain = build_flow_chain(entry_component)
    
    # Validate each step
    validation_results = []
    for component in chain:
        validation = validate_component_logs(
            component.file,
            component.name,
            log_file_path
        )
        validation_results.append(validation)
    
    # Find break point
    break_point = next(
        (v for v in validation_results if v["pass_rate"] < 1.0),
        None
    )
    
    return {
        "chain": chain,
        "validation_results": validation_results,
        "break_point": break_point,
        "status": "complete" if not break_point else "broken"
    }
```

---

## Example Usage

### Test Fails: "TUI not showing impulses"

**Run tracer**:
```bash
bun run trace-failure.ts session-memory-preparation
```

**Output**:
```
=== Tracing Data Flow ===

Position 1: session-memory-preparation (hook)
  ✓ "executing hook" found: 10 times
  ✓ "hook completed success=true" found: 10 times
  Status: WORKING

Position 2: prepareSessionMemory (function)
  ✓ "prepareSessionMemory() starting" found: 10 times
  ✓ "spawning memory agent" found: 10 times
  ✓ "memory agent completed" found: 10 times
  Status: WORKING

Position 3: memory-agent-tool-calls
  ✗ "impulse-create.*parent session" NOT FOUND
  ✗ "created session-scoped impulse" NOT FOUND
  Status: FAILED

=== BREAK POINT: Position 3 ===
Component: Memory agent tool calls
File: src/agent/agent.ts

The memory agent is not making tool calls to create impulses.

Cochange patterns (from metabob):
- impulse-create.ts (parent detection logic)
- prompt.ts::buildMemoryAgentPrompt (prompt content)

Likely causes:
1. Memory agent not using tools (check agent.tools config)
2. Prompt doesn't instruct tool usage (check buildMemoryAgentPrompt)
3. LLM timeout before tool calls (check duration logs)

Check:
  grep "ses_.*Memory agent" logs | grep "tool.execute"
  Expected: Should show tool.execute calls
```

**This pinpoints exactly where to look!**

---

## Cochange Integration

### When Component X Breaks

**Metabob tells us**:
```python
suggest_related_changes(changed_files=["impulse-create.ts"])

# Returns:
# - impulse-load.ts (95% cochange) - Same parent detection pattern
# - memory-budget.ts (90% cochange) - Same parent detection pattern
# - memory-outline.ts (85% cochange) - Same parent detection pattern
```

**Meaning**: If you fix parent detection in impulse-create.ts, check these other files too!

**Our fix**: We already updated all 4 files with same pattern ✓

---

## Test Structure

### Data-Driven Test

```typescript
// test-with-trace.ts

import { traceDataFlow } from "./trace-failure"

test("Session memory impulses appear in TUI", async () => {
  // Run the system
  const result = await triggerSessionMemoryFlow()
  
  // Check outcome
  if (result.impulses.length === 0) {
    // Test failed - trace why
    const trace = await traceDataFlow("session-memory-preparation")
    
    // Trace found break point algorithmically
    console.log(`Break point: ${trace.break_point.component}`)
    console.log(`Evidence: ${trace.break_point.evidence}`)
    console.log(`Cochange: ${trace.break_point.related_components}`)
    
    fail(`Data flow breaks at: ${trace.break_point.component}`)
  }
  
  expect(result.impulses.length).toBeGreaterThan(0)
})
```

**Not assuming behavior** - using metabob's tracking to find failures.

---

## Summary

### What We're Building

**Not**: Tests based on assumptions  
**But**: Annotations + tracer that uses real data

**Process**:
1. Annotate components with expected behavior (from design)
2. Run system naturally
3. When failures occur, trace algorithmically
4. Metabob's cochange shows what to check together
5. Update annotations with learned failure modes

**This is traceable, debuggable, and learns from failures.**

### Tools Created

1. **annotate-session-memory-chain.ts** - Annotates all components
2. **trace-failure.ts** - Traces through chain when failures occur
3. **validate-from-logs.sh** - Extracts evidence from logs

### Metabob Enhancements Needed

1. **get_expected_logs()** - Extract from annotations
2. **validate_component_logs()** - Compare expected vs actual
3. **trace_data_flow_chain()** - Walk chain, find break

With these, failures become traceable through metabob's component tracking!
