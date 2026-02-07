# Architecture Evolution Summary

## What We Learned & What We're Building

### Discovery: Config Was Bloated

**Found**: 25+ config fields, 13 always set to `true`, 7 managed by backend  
**Action**: Simplified to 3 required fields (cli_path, api_key, base_url)  
**Status**: ✅ **COMPLETE** - All config files updated, tests passing

### Discovery: Recording Relied on Agent Discipline

**Found**: Agent-driven recording via explicit tool calls  
**Problem**: Inconsistent, incomplete, unreliable  
**Solution**: System-driven recording via instrumented execution environment  
**Status**: 📋 **DESIGNED** - Ready for implementation

## New Architecture: Three Key Innovations

### 1. Instrumented Execution Environment

**Core Idea**: Wrap ALL tools with automatic tracing

```python
# metabob-cli wraps every tool
wrapped_tool = tracer.wrap_tool(original_tool)

# Agent uses wrapped_tool (looks identical)
result = await wrapped_tool.read(path="src/file.ts")

# Tracer automatically captures:
# - Before state (files, components)
# - Tool call (args, duration)
# - After state (changes detected)
# - Component mapping (via CPG)
# - Decision extraction (from behavior)
# - Context references (which impulses used)
```

**Benefits:**
- ✅ 100% capture rate (not 0% today)
- ✅ No agent involvement
- ✅ Consistent across all executions
- ✅ Real-time recording

### 2. CPG Component Mapping

**Core Idea**: Understand WHAT was modified, not just which files

```python
# Traditional: File-level tracking
files_changed = ["src/tool.ts", "test/bash.test.ts"]
# ❌ Don't know: Which functions? Which classes?

# New: Component-level tracking
components_changed = [
  {"file": "src/tool.ts", "component": "Tool.execute", "type": "function"},
  {"file": "src/tool.ts", "component": "Tool.Info", "type": "type"},
  {"file": "test/bash.test.ts", "component": "testBashOutput", "type": "function"}
]
# ✅ Know exactly: Which components, what type, where located

# Map to activity intent
intent = "Fix TypeError in Tool.execute"
expected = ["Tool.execute"]
actual = ["Tool.execute", "Tool.Info"]
accuracy = 0.5  # Expected 1, got 2 → 50% accurate

# Learning: Why was Tool.Info modified? Was it necessary?
```

**Benefits:**
- ✅ Component-level accuracy tracking
- ✅ Task alignment analysis
- ✅ Unexpected change detection
- ✅ Intent preservation validation

### 3. Unified Backend Schema

**Core Idea**: One table with everything embedded, zero fragmentation

```python
# Old: Fragmented (7+ tables, complex joins)
SELECT e.*, s.*, t.*, d.*, c.*
FROM activity_executions e
JOIN activity_steps s ON s.execution_id = e.execution_id
JOIN activity_tool_calls t ON t.step_id = s.step_id
JOIN activity_decisions d ON d.step_id = s.step_id
JOIN activity_components c ON c.execution_id = e.execution_id
# ❌ Slow, complex, hard to maintain

# New: Unified (single table, embedded data)
SELECT * FROM execution_trace WHERE execution_id = 'exec_123'
# ✅ Fast, simple, complete in one query

# Everything embedded:
{
  "execution_id": "exec_123",
  "steps": [
    {
      "step_id": "diagnose",
      "tool_calls": [
        {
          "call_id": "call_1",
          "before_state": {...},
          "after_state": {...},
          "component_changes": [...],
          "decision_extracted": {...}
        }
      ],
      "component_changes": [...],
      "decisions_extracted": [...]
    }
  ],
  "component_mapping": {...},
  "tool_patterns": {...},
  "validation": {...},
  "learning_data": {...}
}
```

**Benefits:**
- ✅ Single query for complete execution
- ✅ No joins required
- ✅ Atomic writes (consistency)
- ✅ Easy to add fields (no migration)
- ✅ Fast analytics (JSON queries)

### Bonus: Reusable Validation

**Core Idea**: Extract validation from successful executions, reuse automatically

```python
# After successful execution
if execution.success and execution.validation.ran:
    # Extract validation as reusable rule
    rule = ValidationRule(
        checks=execution.validation.results.keys(),  # typecheck, tests, linter
        applicable_to={"category": "bugfix", "components": ["Tool.*"]}
    )
    await validation_registry.save(rule)

# Next similar execution
rules = await validation_registry.find_applicable(
    category="bugfix",
    components=["Parser.execute"]  # Similar to Tool.execute
)
# → Gets: typecheck, tests, linter (from previous execution)
await apply_validation(rules)  # Consistent quality gate!
```

**Benefits:**
- ✅ Validation compounds over time
- ✅ Consistent across activities
- ✅ No manual definition needed
- ✅ Improves from usage

### Bonus: Tool Pattern Learning

**Core Idea**: Learn which tools to call and how

```python
# Build tool call graph from executions
graph = build_tool_call_graph([
    {"sequence": ["read", "grep", "str_replace", "shell"], "success": True},
    {"sequence": ["read", "str_replace", "shell"], "success": True},
    {"sequence": ["glob", "read", "str_replace"], "success": False}
])

# Find effective patterns
patterns = graph.find_effective_sequences()
# → ["read → grep → str_replace → shell" (95% success, n=50)]
# → ["read → str_replace → shell" (90% success, n=30)]

# Learn argument patterns
read_args = analyze_tool_args("read", successful_calls)
# → {"limit": true} appears in 85% of successful calls
# → Recommendation: "Use limit parameter for faster reads"
```

**Benefits:**
- ✅ Learn tool calling strategies
- ✅ Learn effective argument patterns
- ✅ Suggest next tools
- ✅ Data-driven optimization

## Implementation Files

### Phase 1: metabob-cli (Instrumentation)

**New files:**
```
src/metabob_cli/mcp/execution_tracer.py           (400 lines)
src/metabob_cli/mcp/instrumented_executor.py     (200 lines)
src/metabob_cli/mcp/cpg_component_mapper.py      (300 lines)
tests/unit/test_execution_tracer.py              (200 lines)
tests/integration/test_instrumented_execution.py (150 lines)
```

**Modified files:**
```
src/metabob_cli/mcp/activity_manager.py          (integrate tracing)
src/metabob_cli/mcp/tools.py                     (add trace endpoints)
```

**Estimated effort**: 1-2 weeks

### Phase 2: metabob-rpc-api (Unified Schema)

**New files:**
```
server/models/execution_trace.py                 (200 lines)
server/models/validation_rule.py                 (100 lines)
server/routes/execution_traces.py                (300 lines)
server/routes/validation_rules.py                (200 lines)
server/services/validation_registry.py           (400 lines)
server/services/tool_pattern_learner.py          (500 lines)
server/services/component_analytics.py           (300 lines)
migrations/unified_execution_schema.sql          (100 lines)
tests/test_execution_traces.py                   (200 lines)
```

**Modified files:**
```
server/routes/activity_management.py             (update to use ExecutionTrace)
server/services/thompson_sampling.py             (use unified data)
```

**Estimated effort**: 2-3 weeks

### Phase 3: metabob-opencode (Simplified)

**Modified files:**
```
src/session/turn-lifecycle-hooks.ts              (present single activity)
src/tool/activity.ts                             (simpler interface)
```

**Estimated effort**: 2-3 days

## Detailed Implementation Plan

### Week 1-2: Instrumentation (metabob-cli)

**Day 1-3**: ExecutionTracer
- Tool wrapping
- State capture
- Decision extraction

**Day 4-6**: CPGComponentMapper
- File→component mapping
- Task alignment calculation
- Deviation detection

**Day 7-9**: InstrumentedExecutor
- Integration with ActivityManager
- Step execution with tracing
- Real-time trace sending

**Day 10**: Testing
- Unit tests for tracer
- Integration tests for instrumentation
- Verify no performance regression

### Week 3-5: Backend Schema (metabob-rpc-api)

**Day 1-5**: Unified ExecutionTrace Model
- Design schema
- Create Pydantic models
- Write migration script
- Migrate existing data
- Test data integrity

**Day 6-8**: Validation Registry
- Extract validation from executions
- Find applicable rules
- Apply rules automatically
- Track rule effectiveness

**Day 9-12**: Tool Pattern Learner
- Build tool call graphs
- Find effective sequences
- Learn argument patterns
- Generate recommendations

**Day 13-15**: Analytics & API
- Component-aware analytics
- Fast query endpoints
- Real-time monitoring
- Dashboard data

### Week 6: Integration & Testing

**Day 1-2**: End-to-end testing
- Full activity execution with tracing
- Verify complete trace captured
- Check backend storage
- Validate learning updates

**Day 3-4**: Performance testing
- Tracing overhead <10ms per tool
- Backend query performance
- Real-time streaming tests

**Day 5**: Documentation & deployment
- Update API docs
- Migration guide
- Deploy to staging
- Monitor first executions

## Expected Outcomes

### After Phase 1 (Instrumentation)
✅ Every tool call captured automatically  
✅ Component changes mapped via CPG  
✅ Decisions extracted from behavior  
✅ Real-time trace streaming to backend

### After Phase 2 (Unified Schema)
✅ Single table for all execution data  
✅ Fast analytics (no joins)  
✅ Validation extracted and reused  
✅ Tool patterns learned from data

### After Phase 3 (Integration)
✅ Activities presented to agent (not discovered)  
✅ Execution fully instrumented  
✅ Learning loop operational  
✅ Templates evolving from data

## Success Metrics

### Data Completeness
- **Before**: ~30% of behavior captured (messages, basic usage)
- **After**: ~95% of behavior captured (everything except inner thoughts)

### Recording Reliability
- **Before**: Depends on agent calling recording tools (unreliable)
- **After**: System captures automatically (100% reliable)

### Storage Efficiency
- **Before**: 7+ tables, complex joins, slow queries
- **After**: 1 table, embedded data, fast queries (<50ms)

### Learning Quality
- **Before**: Learns from outcomes only (success/failure)
- **After**: Learns from process (tools, sequences, components, decisions)

### Template Evolution
- **Before**: Manual improvement based on success rate
- **After**: Data-driven evolution based on comprehensive traces

## Risk Mitigation

### Risk 1: Performance Overhead
**Mitigation**:
- Async trace sending (non-blocking)
- Batch backend writes
- CPG query caching
- Target: <10ms overhead per tool call

### Risk 2: CPG Unavailable
**Mitigation**:
- Graceful degradation (file-level tracking)
- Cache CPG results aggressively
- Fallback to pattern matching

### Risk 3: Backend Unavailable
**Mitigation**:
- Buffer traces locally in metabob-cli
- Retry with exponential backoff
- Persist to FileStateManager as backup

### Risk 4: Schema Migration
**Mitigation**:
- Careful migration script
- Test on copy of production data
- Rollback plan (keep old tables temporarily)
- Gradual cutover

## Current Status

### Completed ✅
- Configuration simplification
- Architecture documentation
- Design specifications

### In Progress 🚧
- None (waiting for implementation start)

### Next Steps 🚀
1. Create ExecutionTracer (metabob-cli)
2. Add CPGComponentMapper (metabob-cli)
3. Design unified schema (metabob-rpc-api)
4. Implement ValidationRegistry (metabob-rpc-api)
5. Integrate and test

### Future Enhancements 🔮
- Real-time execution coaching
- Automatic template evolution
- Cross-project pattern learning
- Agent performance profiles

## Conclusion

This architecture provides:
1. **Systematic recording** - No agent involvement, 100% capture rate
2. **Component awareness** - CPG integration for semantic understanding
3. **Unified storage** - Single table, fast queries, no fragmentation
4. **Reusable validation** - Extract once, apply everywhere
5. **Tool pattern learning** - Data-driven optimization

The execution environment becomes **self-instrumenting** and **self-improving**.

All design work complete. Ready to implement! 🎉
