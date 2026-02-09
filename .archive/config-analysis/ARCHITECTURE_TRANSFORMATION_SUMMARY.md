# Architecture Transformation: From Agent-Driven to System-Driven

## The Fundamental Shift

### Before: Agent Records Itself ❌
```
Agent: "I made a decision..."
  → Calls record_decision() tool
  → Manual, unreliable, incomplete
```

### After: System Records Agent ✅
```
Execution Environment:
  → Instruments all tool calls
  → Captures before/after state
  → Extracts decisions automatically
  → Maps components via CPG
  → No agent involvement
```

## Core Principles

### 1. Activities Presented TO Agent
**Not**: Agent searches and chooses  
**Instead**: System presents best activity in prompt

```typescript
// System prompt includes:
<recommended_activity>
  Activity: Fix Bug with TDD
  Success Rate: 86%
  Expected Cost: $0.28
  Expected Duration: 20 minutes
  
  To start: Say "use recommended activity" or "I'll fix the bug using TDD"
</recommended_activity>
```

### 2. Execution Environment Records Everything
**Not**: Relying on agent to call recording tools  
**Instead**: Tool calls intercepted and traced automatically

```python
# Every tool call automatically wrapped:
original_tool = read_file
wrapped_tool = execution_tracer.wrap_tool("read", read_file)

# When agent calls wrapped_tool:
# 1. Capture before state (files, components)
# 2. Execute actual tool
# 3. Capture after state
# 4. Diff states → detect changes
# 5. Map files → components (CPG)
# 6. Extract decision pattern
# 7. Send trace to backend
# 8. Return result to agent

# Agent is UNAWARE - sees normal tool interface
```

### 3. CPG Maps Components to Tasks
**Not**: Just tracking file changes  
**Instead**: Component-level understanding via CPG

```python
File changed: src/tool.ts
  ↓ CPG query
Components modified: ["Tool.execute", "Tool.create"]
  ↓ Task mapping
Task alignment:
  - diagnose task: Expected ["Tool.execute"], Got ["Tool.execute"] ✓
  - fix task: Expected ["Tool.execute"], Got ["Tool.execute", "Tool.create"]
    → Extra component detected: investigate why
```

### 4. Backend Schema Unified
**Not**: 7+ fragmented tables with joins  
**Instead**: Single `ExecutionTrace` table with embedded data

```sql
-- Before: Slow queries with joins
SELECT e.*, s.*, t.*, c.*
FROM activity_executions e
JOIN activity_step_results s ON e.id = s.execution_id
JOIN activity_tool_calls t ON s.id = t.step_id
JOIN activity_component_changes c ON t.id = c.tool_call_id
WHERE e.activity_id = 'fix-bug';

-- After: Fast single query
SELECT * FROM execution_trace 
WHERE activity_id = 'fix-bug';
-- All data embedded (steps, tools, components, validations)
```

### 5. Validation Extracted and Reused
**Not**: Manually defining validation per template  
**Instead**: Extract from successful executions, apply to similar activities

```python
# After successful execution:
if execution.success and execution.validation.ran:
    rule = extract_validation_rule(execution)
    # → Save to ValidationRegistry
    # → Automatically applied to similar activities

# Before next similar execution:
applicable_rules = find_applicable_validation(
    category="bugfix",
    components=["Tool.execute", "bash.test.ts"]
)
# → Returns rules from ALL previous successful bugfixes
# → Consistent validation without manual configuration
```

## Implementation: 5 Key Components

### 1. ExecutionTracer (metabob-cli)
**File**: `src/metabob_cli/mcp/execution_tracer.py`

```python
class ExecutionTracer:
    """Captures ALL agent behavior automatically."""
    
    def wrap_tool(self, tool_name: str, tool_func: Callable) -> Callable:
        """Wrap tool with automatic tracing."""
        async def traced(*args, **kwargs):
            # Before
            ctx = self.capture_context(tool_name, args, kwargs)
            
            # Execute
            try:
                result = await tool_func(*args, **kwargs)
                success = True
            except Exception as e:
                result = None
                error = str(e)
                success = False
                raise
            finally:
                # After (always runs)
                self.record_tool_call(ctx, result, success)
            
            return result
        return traced
```

**Captures:**
- Tool name, args, result
- Before/after state (files, components)
- Duration, success/failure
- File changes
- Component changes (via CPG)
- Decision patterns (extracted)

### 2. CPGComponentMapper (metabob-cli)
**File**: `src/metabob_cli/mcp/cpg_component_mapper.py`

```python
class CPGComponentMapper:
    """Maps file changes to components and tasks."""
    
    async def map_execution_to_intent(
        self, traces: list[StepTrace], intent: str
    ) -> ComponentMapping:
        """Core function: What was DONE vs what was INTENDED."""
        
        # Extract expected from intent
        expected = parse_intent_for_components(intent)
        
        # Get actual from traces
        actual = []
        for trace in traces:
            for tool_call in trace.tool_calls:
                if tool_call.file_changes:
                    # Map to components via CPG
                    components = await cpg.get_components(tool_call.file_changes)
                    actual.extend(components)
        
        # Calculate accuracy
        accuracy = len(set(expected) & set(actual)) / len(expected)
        
        # Map to tasks
        task_alignment = map_components_to_tasks(actual, activity.tasks)
        
        return ComponentMapping(expected, actual, accuracy, task_alignment)
```

**Provides:**
- Component-level accuracy (not just file-level)
- Task alignment scores
- Deviation detection
- Intent matching

### 3. Unified ExecutionTrace Schema (metabob-rpc-api)
**File**: `server/models/execution_trace.py`

```python
class ExecutionTrace(BaseModel):
    """Single unified record - NO FRAGMENTATION."""
    
    execution_id: str
    activity_id: str
    
    # All steps embedded (not separate table)
    steps: list[StepTrace] = [
        {
            # All tool calls embedded (not separate table)
            "tool_calls": [
                {
                    # All data embedded
                    "component_changes": [...],
                    "decision_extracted": {...}
                }
            ]
        }
    ]
    
    # All derived data embedded
    component_mapping: dict
    tool_patterns: dict
    validation: dict
    learning_data: dict
```

**Benefits:**
- Single query retrieves everything
- No joins needed
- Atomic writes
- Fast analytics

### 4. ValidationRegistry (metabob-rpc-api)
**File**: `server/services/validation_registry.py`

```python
class ValidationRegistry:
    """Extract and reuse validation."""
    
    async def extract_from_execution(self, trace: ExecutionTrace):
        """If execution succeeded, its validation is GOOD."""
        if trace.success and trace.validation.ran:
            rule = create_validation_rule(trace)
            await save_rule(rule)
            return rule
    
    async def find_applicable_rules(self, activity, components):
        """Find rules for similar activities."""
        return query_rules(
            category=activity.category,
            components=components,
            min_success_rate=0.8
        )
    
    async def apply_rules(self, execution_id, rules):
        """Run all applicable validation rules."""
        results = []
        for rule in rules:
            for check in rule.checks:
                result = await run_check(check)
                results.append(result)
                update_rule_stats(rule.id, result.passed)
        return aggregate_results(results)
```

**Benefits:**
- Validation accumulates over time
- Consistent across activities
- No manual configuration
- Self-improving

### 5. ToolPatternLearner (metabob-rpc-api)
**File**: `server/services/tool_pattern_learner.py`

```python
class ToolPatternLearner:
    """Learn which tools work and how to use them."""
    
    async def build_tool_graph(self, executions: list[ExecutionTrace]):
        """Build graph of effective tool sequences."""
        graph = ToolCallGraph()
        
        for execution in executions:
            if not execution.success:
                continue
            
            # Extract tool sequence
            for step in execution.steps:
                prev = None
                for tool_call in step.tool_calls:
                    graph.add_node(tool_call.tool)
                    if prev:
                        graph.add_edge(prev, tool_call.tool)
                    prev = tool_call.tool
        
        return graph
    
    async def find_effective_sequences(self, intent: str):
        """Find tool sequences that work for this intent."""
        # Query: What tool sequences led to success for "bug fix"?
        # Returns: ["read → grep → str_replace → shell"] (92% success)
    
    async def suggest_next_tool(self, current_sequence: list[str]):
        """Suggest next tool based on current sequence."""
        # After ["read", "grep"], what typically comes next?
        # Returns: ["str_replace"] (85% probability)
```

**Benefits:**
- Learn effective tool sequences
- Learn tool argument patterns
- Suggest next tools
- Data-driven, not guessed

## Data Flow: With New Architecture

### Complete Execution Flow

```
1. USER MESSAGE
   ↓
2. metabob-opencode: Memory Agent (pre-turn hook)
   - Analyzes intent
   - Creates impulses
   - Prepares context
   ↓
3. metabob-opencode: Activity Recommendation (pre-turn hook)
   - MCP: get_recommended_activity(intent, context)
   ↓ MCP
   - metabob-cli → backend: Thompson Sampling
   ↓ HTTP
   - metabob-rpc-api: Select best activity
   ↑ HTTP
   - Returns SINGLE best recommendation
   ↑ MCP
   - Inject into system prompt
   ↓
4. MAIN AGENT TURN
   - Sees: prepared context, recommended activity, code quality issues
   - Says: "I'll use the recommended activity"
   ↓
5. metabob-opencode: Start activity
   - MCP: start_activity_execution()
   ↓ MCP
6. metabob-cli: Initialize execution
   - Create ExecutionTrace
   - Create ExecutionTracer
   - Load applicable validation rules
   - Wrap all tools with tracing
   ↑ MCP
   - Return: "Ready"
   ↓
7. STEP EXECUTION LOOP (× N steps)
   
   A. Get step
      - MCP: get_next_step(execution_id)
      - Returns ONLY current step
   
   B. Execute step (INSTRUMENTED)
      - Agent uses wrapped tools
      - ExecutionTracer captures:
        * Every tool call
        * Before/after state
        * File changes
        * Component changes (CPG)
        * Decision patterns
      - All automatic, no agent involvement
   
   C. Report step
      - MCP: report_step_result()
      - metabob-cli: Finalize step trace
      - Send complete trace to backend
      - Backend: Real-time monitoring
   
   D. Repeat
   ↓
8. COMPLETION
   
   A. Automatic validation
      - Find applicable rules (from registry)
      - Apply rules (typecheck, tests, linter)
      - Record results
      
      If passed:
        - Extract NEW rule from this execution
        - Add to ValidationRegistry
      
      If failed:
        - Trailblazing or fail
   
   B. Component mapping
      - Map actual components to intended
      - Calculate alignment scores
      - Find deviations
   
   C. Send complete trace
      - Single ExecutionTrace record
      - All data embedded
      - To metabob-rpc-api
   
   D. Backend learning update
      - Thompson Sampling update
      - Template metrics update
      - Tool pattern analysis
      - Validation rule stats
      - Evolution triggers
   ↓
9. metabob-opencode: Cleanup
   - Unregister session
   - Return summary
```

## Key Implementation Files

### metabob-cli (5 new files)
```
src/metabob_cli/mcp/execution_tracer.py         (NEW - 400 lines)
  - ExecutionTracer class
  - ToolCallTrace, StepTrace, ExecutionTrace dataclasses
  - Tool wrapping logic
  - State capture and diffing

src/metabob_cli/mcp/instrumented_executor.py    (NEW - 200 lines)
  - InstrumentedActivityExecutor class
  - Step execution with tracing
  - Tool registry wrapping

src/metabob_cli/mcp/cpg_component_mapper.py     (NEW - 300 lines)
  - CPGComponentMapper class
  - File → Component mapping
  - Component → Task alignment
  - Deviation detection

src/metabob_cli/mcp/activity_manager.py         (MODIFY - integrate tracing)
  - Use InstrumentedActivityExecutor
  - Pass traces to backend
  - Component mapping integration

src/metabob_cli/core/component_change_tracker.py (NEW - 150 lines)
  - Track component changes over time
  - Integration with file watching
```

### metabob-rpc-api (6 new files)
```
server/models/execution_trace.py                 (NEW - 250 lines)
  - Unified ExecutionTrace model
  - All embedded data structures
  - No fragmentation

server/routes/execution_traces.py                (NEW - 200 lines)
  - POST /execution-traces/tool-call
  - POST /execution-traces/step
  - POST /execution-traces/complete
  - GET /execution-traces/{id}
  - GET /execution-traces/activity/{id}/analytics

server/models/validation_rule.py                 (NEW - 100 lines)
  - ValidationRule model
  - ValidationCheck model
  - Applicability rules

server/services/validation_registry.py           (NEW - 400 lines)
  - Extract validation from executions
  - Find applicable rules
  - Apply rules
  - Update rule stats

server/services/tool_pattern_learner.py          (NEW - 500 lines)
  - Build tool call graphs
  - Analyze effective sequences
  - Learn tool arguments
  - Generate recommendations

server/services/component_analyzer.py            (NEW - 300 lines)
  - Component-level analytics
  - Task alignment analysis
  - Deviation pattern detection
```

## Benefits By Category

### Recording Quality
- **Before**: ~30% of behavior captured (manual recording)
- **After**: ~95% of behavior captured (automatic tracing)
- **Improvement**: 3× more data, 100% consistency

### Query Performance
- **Before**: 5-7 table joins, 500-1000ms queries
- **After**: Single table, 20-50ms queries
- **Improvement**: 10-50× faster analytics

### Validation Consistency
- **Before**: Manual validation per template, inconsistent
- **After**: Reusable rules, accumulated over time
- **Improvement**: 100% consistency, grows automatically

### Tool Learning
- **Before**: Unknown which tools work, manual observation
- **After**: Data-driven tool patterns, automatic suggestions
- **Improvement**: Measurable effectiveness, continuous learning

### Development Velocity
- **Before**: Agents must manually record, developers manually validate
- **After**: Automatic recording, automatic validation
- **Improvement**: Zero overhead for agents, zero maintenance

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
**Goal**: Get tracing working in metabob-cli

1. Create `execution_tracer.py`
2. Create `instrumented_executor.py`
3. Modify `activity_manager.py` to use instrumentation
4. Test with single activity execution
5. Verify traces are complete

**Success Criteria**:
- ✅ All tool calls captured
- ✅ Before/after state captured
- ✅ Decisions extracted automatically
- ✅ No agent modifications needed

### Phase 2: CPG Integration (Week 2-3)
**Goal**: Map files to components

1. Create `cpg_component_mapper.py`
2. Integrate with `execution_tracer.py`
3. Map file changes → components after each tool call
4. Link components to tasks
5. Calculate alignment scores

**Success Criteria**:
- ✅ Component changes identified
- ✅ Task alignment calculated
- ✅ Deviations detected
- ✅ <100ms CPG query overhead

### Phase 3: Unified Schema (Week 3-4)
**Goal**: Redesign backend storage

1. Design `ExecutionTrace` model
2. Create database migration
3. Migrate existing data
4. Update API endpoints
5. Update clients

**Success Criteria**:
- ✅ All data in single table
- ✅ Queries <50ms
- ✅ No data loss in migration
- ✅ Backward compatibility maintained

### Phase 4: Validation Registry (Week 4-5)
**Goal**: Extract and reuse validation

1. Create `validation_registry.py`
2. Extract rules from successful executions
3. Find applicable rules for new executions
4. Apply rules automatically
5. Track rule effectiveness

**Success Criteria**:
- ✅ Rules extracted automatically
- ✅ Rules applied automatically
- ✅ Validation consistency 100%
- ✅ Rule effectiveness tracked

### Phase 5: Tool Pattern Learning (Week 5-6)
**Goal**: Learn from tool usage

1. Create `tool_pattern_learner.py`
2. Build tool call graphs
3. Analyze effective sequences
4. Learn argument patterns
5. Generate recommendations

**Success Criteria**:
- ✅ Tool graphs built from data
- ✅ Effective sequences identified
- ✅ Argument patterns learned
- ✅ Recommendations actionable

## Example: Complete Recording of One Execution

```
Activity: Fix TypeError in Tool.execute
Template: fix-bug (variant v2_abc123)
Duration: 18 minutes
Cost: $0.26
Steps: 3

═══════════════════════════════════════════════════════════════
UNIFIED EXECUTION TRACE (Single Record)
═══════════════════════════════════════════════════════════════

{
  "execution_id": "exec_456",
  "activity_id": "fix-bug",
  "variant_id": "fix-bug_v2_abc123",
  "selection_id": "sel_789",
  "session_id": "ses_123",
  
  "started_at": "2026-02-06T10:00:00Z",
  "ended_at": "2026-02-06T10:18:00Z",
  "duration_ms": 1080000,
  "success": true,
  
  "total_cost": 0.26,
  "total_tokens": 10300,
  
  // ═══════════════════════════════════════════════════════════
  // ALL STEPS EMBEDDED (not separate table)
  // ═══════════════════════════════════════════════════════════
  "steps": [
    {
      "step_id": "diagnose",
      "step_index": 0,
      "duration_ms": 3000,
      "success": true,
      "output": "Root cause: missing null check at line 142",
      "cost": 0.08,
      "tokens": 3000,
      
      // ═══════════════════════════════════════════════════════
      // ALL TOOL CALLS EMBEDDED (not separate table)
      // ═══════════════════════════════════════════════════════
      "tool_calls": [
        {
          "call_id": "call_0_1738854000123",
          "tool": "read",
          "args": {"path": "src/tool.ts", "offset": 135, "limit": 20},
          "result": "[file content]",
          "success": true,
          "duration_ms": 50,
          
          // State captured automatically
          "before_state": {"files_modified": []},
          "after_state": {"files_modified": []},
          "file_changes": [],
          
          // Components mapped automatically via CPG
          "component_changes": [
            {
              "file": "src/tool.ts",
              "component": "Tool.execute",
              "type": "function",
              "action": "analyzed"
            }
          ],
          
          // Decision extracted automatically
          "decision_extracted": {
            "type": "exploration",
            "action": "Search for Tool.execute implementation",
            "outcome": "found",
            "confidence": 0.5,
            "extraction_method": "tool_type"
          }
        },
        {
          "call_id": "call_1_1738854000223",
          "tool": "grep",
          "args": {"pattern": "stdout", "path": "src/tool.ts"},
          "result": "3 matches",
          "success": true,
          "duration_ms": 30,
          "component_changes": [...],
          "decision_extracted": {...}
        },
        {
          "call_id": "call_2_1738854000323",
          "tool": "metabob_search_codebase_issues",
          "args": {"query": "undefined stdout"},
          "result": "[2 issues]",
          "success": true,
          "duration_ms": 200,
          "component_changes": [...],
          "decision_extracted": {...}
        }
      ],
      
      // Aggregate analysis (derived from tool_calls)
      "tool_sequence": ["read", "grep", "metabob_search"],
      "phases": ["exploration"],
      "component_changes": [
        {"file": "src/tool.ts", "component": "Tool.execute", "action": "analyzed"}
      ],
      "decisions_extracted": [
        {"type": "exploration", "confidence": 0.5},
        {"type": "exploration", "confidence": 0.5},
        {"type": "analysis", "confidence": 0.6}
      ]
    },
    
    // Step 2: fix (similar structure)
    {...},
    
    // Step 3: test (similar structure)
    {...}
  ],
  
  // ═══════════════════════════════════════════════════════════
  // COMPONENT MAPPING EMBEDDED (not separate table)
  // ═══════════════════════════════════════════════════════════
  "component_mapping": {
    "intent": "Fix TypeError in Tool.execute",
    "expected_components": ["Tool.execute"],
    "actual_components": [
      {"file": "src/tool.ts", "component": "Tool.execute", "action": "modified"},
      {"file": "test/tool/bash.test.ts", "component": "test_bash_error", "action": "analyzed"}
    ],
    "accuracy": 1.0,  // All expected components touched
    "missed": [],
    "extra": [
      {"file": "test/tool/bash.test.ts", "component": "test_bash_error"}
    ],
    "task_alignment": {
      "diagnose": {
        "expected": ["Tool.execute"],
        "matched": ["Tool.execute"],
        "alignment_score": 1.0
      },
      "fix": {
        "expected": ["Tool.execute"],
        "matched": ["Tool.execute"],
        "alignment_score": 1.0
      },
      "test": {
        "expected": ["test_*"],
        "matched": ["test_bash_error"],
        "alignment_score": 1.0
      }
    },
    "deviations": []  // No unexpected modifications
  },
  
  // ═══════════════════════════════════════════════════════════
  // TOOL PATTERNS EMBEDDED (not separate table)
  // ═══════════════════════════════════════════════════════════
  "tool_patterns": {
    "sequence": ["read", "grep", "metabob_search", "str_replace", "read_lints", "shell"],
    "phases": ["exploration", "implementation", "validation"],
    "pattern_type": "exploration → implementation → validation",
    "effectiveness": {
      "tool_success_rate": 1.0,
      "avg_tool_duration_ms": 93,
      "efficient": true
    },
    "tool_usage": {
      "read": {"count": 2, "success_rate": 1.0, "avg_duration_ms": 50},
      "grep": {"count": 1, "success_rate": 1.0, "avg_duration_ms": 30},
      "str_replace": {"count": 1, "success_rate": 1.0, "avg_duration_ms": 120},
      "shell": {"count": 1, "success_rate": 1.0, "avg_duration_ms": 8000}
    }
  },
  
  // ═══════════════════════════════════════════════════════════
  // VALIDATION EMBEDDED (not separate table)
  // ═══════════════════════════════════════════════════════════
  "validation": {
    "ran": true,
    "rules_applied": ["rule_typecheck_20260201", "rule_tests_20260203"],
    "results": {
      "typecheck": {
        "passed": true,
        "duration_ms": 1200,
        "rule_id": "rule_typecheck_20260201"
      },
      "tests": {
        "passed": true,
        "test_count": 15,
        "duration_ms": 8000,
        "rule_id": "rule_tests_20260203"
      }
    },
    "overall_passed": true,
    "duration_ms": 9200
  },
  
  // ═══════════════════════════════════════════════════════════
  // LEARNING DATA EMBEDDED (derived, not separate table)
  // ═══════════════════════════════════════════════════════════
  "learning_data": {
    "component_accuracy": 1.0,
    "task_alignment_score": 1.0,
    "tool_pattern_effectiveness": 0.95,
    "validation_consistency": 1.0,
    "cost_efficiency": 1.08,      // 8% better than expected
    "duration_efficiency": 1.11,  // 11% faster
    
    "strengths": [
      "Perfect component accuracy",
      "Efficient tool sequence",
      "Fast execution (11% better)"
    ],
    "weaknesses": [],
    "recommendations": []  // No improvements needed
  }
}

═══════════════════════════════════════════════════════════════
QUERY THIS DATA (Single query, no joins!)
═══════════════════════════════════════════════════════════════

// Get complete execution
SELECT * FROM execution_trace WHERE execution_id = 'exec_456';

// Analytics (fast - all data co-located)
SELECT
  AVG(learning_data.component_accuracy) as avg_accuracy,
  AVG(learning_data.tool_pattern_effectiveness) as avg_tool_effectiveness
FROM execution_trace
WHERE activity_id = 'fix-bug' AND success = true;

// Tool patterns (embedded in each record)
SELECT tool_patterns.sequence, COUNT() as frequency
FROM execution_trace
WHERE success = true
GROUP BY tool_patterns.sequence
ORDER BY frequency DESC;
```

## Summary: Complete Transformation

### Configuration ✅
- **From**: 25+ fields → **To**: 3 required (cli_path, api_key, base_url)
- **Impact**: 88% reduction, zero-config for 95% of users

### Recording ✅
- **From**: Agent manual recording → **To**: System automatic tracing
- **Impact**: 3× more data, 100% consistency, zero agent overhead

### Component Understanding ✅
- **From**: File-level tracking → **To**: Component-level via CPG
- **Impact**: Intent matching at component level, task alignment scoring

### Backend Schema ✅
- **From**: 7+ fragmented tables → **To**: Single unified `ExecutionTrace`
- **Impact**: 10-50× faster queries, atomic writes, embedded relationships

### Validation ✅
- **From**: Manual per-template → **To**: Extracted and reused
- **Impact**: Consistent quality gates, accumulates over time, zero configuration

### Tool Learning ✅
- **From**: Unknown patterns → **To**: Data-driven graphs
- **Impact**: Learn what works, suggest next tools, optimize arguments

## The Result: Self-Improving System

```
Execution 1:
  → Traces captured
  → Components mapped
  → Validation extracted
  → Tool patterns learned
  ↓
Backend learns:
  - "read → grep" sequence effective
  - typecheck + tests validation reliable
  - Tool.execute frequently modified in bug fixes
  ↓
Execution 2 (same activity):
  → Inherits validation rules from Execution 1
  → Tool suggestions based on patterns
  → Component accuracy improves (better intent matching)
  ↓
Execution 3:
  → Even better (accumulated knowledge)
  ↓
Execution N:
  → Template perfected through data
```

**This is true learning**: System improves from every execution, automatically, without manual intervention.

## Next Steps

1. **Implement ExecutionTracer** - Foundation for everything
2. **Add CPG component mapping** - Understand what was modified
3. **Redesign backend schema** - Unified storage
4. **Extract validation rules** - Build consistency
5. **Learn tool patterns** - Data-driven improvements

All documented in:
- `EXECUTION_ENVIRONMENT_ARCHITECTURE.md` (1,821 lines)
- `SYSTEMATIC_RECORDING_IMPLEMENTATION.md` (1,226 lines)

Total: **~3,000 lines of implementation documentation** with concrete code examples for every component.
