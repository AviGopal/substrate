# Teaching Loop Learnings - Activity Decomposition

## Date: 2026-04-10

## Summary

Attempted to execute decomposed atomic activities to build execution graph data. Discovered several important issues that need to be addressed before the teaching loop can proceed effectively.

## What We Accomplished

### ✅ Successfully Registered Activities

**9 Atomic Activities Registered with Backend:**
1. fetch-api-json
2. calculate-error-statistics
3. calculate-performance-metrics
4. generate-improvement-recommendations
5. format-analysis-report
6. fetch-github-workflow-stats
7. fetch-activity-effectiveness
8. analyze-loop-performance
9. create-github-issue-conditional

All atomic activities are now discoverable via:
- Backend API: `https://activity.metabob.com/v2/activities/templates`
- Thompson Sampling: Activities available for goal-seeking

**2 Composed Activities:**
- Failed validation (expected - uses `composition` and `activity_ref` features not yet supported)
- Can be composed manually through sequential execution

### ✅ Identified Critical Issues

## Issues Discovered

### Issue #1: Activity Recursion

**Problem:**
When `calculate-error-statistics` activity executed, the LLM tried to accomplish the goal by calling `calculate-error-statistics` itself, creating an infinite loop.

**Evidence:**
```
[Activity] Cycle detected: activity:⟨calculate-error-statistics⟩ → activity:⟨calculate-error-statistics⟩
[Activity] Max nesting depth reached
```

**Root Cause:**
- Activity prompt is too abstract/goal-oriented
- LLM searches for activities to accomplish the goal
- Finds the same activity and tries to use it
- No mechanism to prevent self-reference

**Fix Needed:**
1. **Short-term**: Add self-reference detection in activity executor
   - Before executing activity reference, check if it's in the call stack
   - Return error: "Cannot call activity from within itself"

2. **Medium-term**: Make atomic activity prompts more procedural
   - Use explicit tool calls instead of goal descriptions
   - Example: Change from "Analyze the traces" to "Use read() tool to read {{input_file}}, then use write() to save results"

3. **Long-term**: Implement proper composition support
   - `activity_ref` field for explicit activity references
   - Dependency graph validation before execution

### Issue #2: Tool Execution Failures

**Problem:**
Multiple tool calls failed during execution:
- `read()` tool failed on valid file paths
- `write()` tool failed to create output files
- `jq` and `bc` commands not available

**Evidence:**
```
[FAIL] Tool: read({"path":"/tmp/sample-traces.json"})
[FAIL] Tool: write({"path":"/tmp/error-stats.json","content":"..."})
[FAIL] Tool: bash({"command":"echo \"scale=2; (4/8)*100\" | bc -l"})
```

**Root Cause:**
1. Tool implementations may have bugs
2. Environment missing expected utilities (jq, bc)
3. File path validation issues
4. Permission problems

**Fix Needed:**
1. Debug `read()` and `write()` tool implementations
2. Add fallback strategies for missing utilities
3. Improve error messages to show actual vs expected state

### Issue #3: Environment Dependencies

**Problem:**
Activities assume tools/CLIs that may not be available:
- `gh` CLI (GitHub CLI)
- `jq` (JSON processor)
- `bc` (calculator)

**Evidence:**
```
[FAIL] Tool: bash({"command":"gh run list..."})
```

**Fix Needed:**
1. **Document prerequisites** in activity metadata:
   ```json
   {
     "id": "fetch-github-workflow-stats",
     "requires": {
       "tools": ["gh", "jq"],
       "env_vars": ["GITHUB_TOKEN"]
     }
   }
   ```

2. **Add validation step** before execution:
   - Check if required tools are available
   - Return clear error if missing
   - Suggest alternatives or installation instructions

3. **Create tool-agnostic variants**:
   - `fetch-github-workflow-stats-api` (uses GitHub API directly)
   - `fetch-github-workflow-stats-cli` (uses gh CLI)

### Issue #4: Prompt Quality

**Problem:**
Activity prompts are too abstract and lead to improvisation rather than deterministic execution.

**Current (Problematic):**
```
"Read the trace data and calculate error statistics..."
```

**Better (More Explicit):**
```
"1. Use read() tool: read(path='{{input_file}}')
2. Parse the JSON to extract error entries
3. Calculate error_rate = (error_count / total_events) * 100
4. Use write() tool: write(path='{{output_file}}', content=<json>)"
```

**Fix Needed:**
Rewrite atomic activity prompts to be:
1. **Procedural**: Step-by-step instructions
2. **Tool-explicit**: Exact tool calls with parameters
3. **Deterministic**: Same input = same output
4. **Minimal LLM reasoning**: Let LLM execute, not decide

## Execution Metrics

### calculate-error-statistics Test

- **Duration**: 1.2 minutes
- **Cost**: $0.8364
- **Tokens**: 262,223 in / 3,314 out
- **Status**: Failed (recursion + tool failures)
- **Tools Used**: 17 tool calls
  - 10 succeeded
  - 7 failed
- **Key Failure**: Could not write output file

### fetch-github-workflow-stats Test

- **Duration**: 1.2 minutes
- **Cost**: $0.3058
- **Tokens**: 87,419 in / 2,902 out
- **Status**: Failed (gh CLI not available)
- **Fallback**: LLM asked user how to proceed
- **Alternative**: Tried to create new activity template

## What We Learned

### 1. Atomic ≠ Simple

Creating "atomic" activities doesn't automatically make them work well. Atomic activities still need:
- Clear, procedural prompts
- Explicit tool usage
- Proper error handling
- Environment validation

### 2. Goal-Seeking Creates Recursion Risk

When activities are discoverable and LLM has access to `search_activities()` and `activity()` tools, goal-oriented prompts can lead to:
- Self-reference
- Circular dependencies
- Unpredictable composition

**Solution**: Distinguish between:
- **Executable Activities**: Procedural, tool-explicit (for direct execution)
- **Composable Activities**: Goal-oriented (for use in composition only)

### 3. Tool Reliability is Critical

Activity decomposition amplifies tool failures:
- Monolithic activity: 1 failure point
- Decomposed workflow: N failure points (one per atomic activity)

Each tool must be rock-solid or have explicit fallbacks.

### 4. Testing Requires Real Environment

Can't fully validate activities without:
- All required tools/CLIs installed
- Proper permissions
- Real data (not just sample data)
- Complete environment setup

## Next Steps

### Priority 1: Fix Tool Implementations

Before continuing teaching loop, fix:
1. `read()` tool - ensure it works reliably
2. `write()` tool - ensure file creation succeeds
3. Add tool availability checks

**Owner**: Core MiniBob development
**Estimated effort**: 2-4 hours

### Priority 2: Prevent Activity Recursion

Add cycle detection:
```typescript
function executeActivity(activityId: string, callStack: string[]) {
  if (callStack.includes(activityId)) {
    throw new Error(`Cycle detected: ${callStack.join(' → ')} → ${activityId}`)
  }
  // ... execute with updated callStack
}
```

**Owner**: Activity executor
**Estimated effort**: 1-2 hours

### Priority 3: Rewrite Atomic Activity Prompts

Make prompts more procedural and tool-explicit:
- Document exact tool call sequences
- Remove goal-oriented language
- Add step numbers
- Specify expected outputs

**Owner**: Activity template authoring
**Estimated effort**: 3-5 hours

### Priority 4: Create Tool-Agnostic Variants

For activities that depend on external tools, create variants:
- API-based (pure HTTP, no CLI dependencies)
- CLI-based (requires tools installed)
- Hybrid (try CLI, fallback to API)

**Owner**: Activity library expansion
**Estimated effort**: 4-6 hours

### Priority 5: Add Environment Validation

Implement prerequisite checking:
```json
{
  "requires": {
    "tools": ["gh", "jq"],
    "env_vars": ["GITHUB_TOKEN"]
  }
}
```

And validate before execution.

**Owner**: Activity executor
**Estimated effort**: 2-3 hours

## Revised Teaching Loop Plan

### Phase 1: Foundation (1-2 days)
1. Fix tool implementations (read, write, bash)
2. Add recursion prevention
3. Test tools in isolation

### Phase 2: Activity Refinement (2-3 days)
1. Rewrite atomic activity prompts to be procedural
2. Add prerequisite declarations
3. Test each atomic activity independently
4. Verify no recursion, clean execution

### Phase 3: Composition Testing (1-2 days)
1. Manually compose atomic activities (bash script)
2. Execute full workflows
3. Verify data flows correctly between activities
4. Measure actual duration vs estimated

### Phase 4: Teaching Loop (ongoing)
1. Execute composed workflows multiple times
2. Use /teach on successful patterns
3. Use /warn on failures
4. Monitor Thompson Sampling improvements
5. Extract successful patterns with ribosome

## Success Criteria (Revised)

Before proceeding to teaching loop execution:

- [ ] **Tool Reliability**: `read()` and `write()` work 100% of time
- [ ] **No Recursion**: Activities never call themselves
- [ ] **Clean Execution**: At least 3 atomic activities execute without errors
- [ ] **Environment Documented**: All prerequisites clearly listed
- [ ] **Procedural Prompts**: Activities execute deterministically

## Conclusion

The decomposition was the right direction, but execution revealed fundamental issues that must be fixed before the teaching loop can provide value:

1. Tool implementations need hardening
2. Activity prompts need to be more procedural
3. Environment dependencies need explicit handling
4. Recursion prevention is critical

These learnings are valuable - they show what needs to be built to make activity composition truly reliable.

---

**Status**: Teaching loop paused pending fixes
**Next Action**: Address Priority 1-3 issues
**Timeline**: Resume teaching loop after tool fixes (est. 1-2 days)
