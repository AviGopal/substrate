# Core Foundation Analysis: Activity System

## Goal
Build a **self-improving activity system** where activities can create and improve other activities.

## Current State

### ✅ What Works
1. **Activity Execution Framework** - Activities can be registered and started
2. **Task Orchestration** - Tasks run in dependency order
3. **Validation System** - NOW validates files and patterns correctly (just fixed)
4. **Session Management** - Sub-sessions are created for each task
5. **Git Integration** - Requires clean working tree before starting

### ❌ Critical Blocker: Tasks Don't Execute Tools

**Problem**: Tasks send prompts to LLM but LLM responds with TEXT instead of calling TOOLS.

**Evidence**:
```json
{
  "sessionID": "ses_385717fb3ffeqFF0l3CRuMn2p5",
  "taskId": "task-1",
  "messageCount": 4,
  "toolCallCount": 0  // ❌ NO TOOLS USED!
}
```

**Test Case**:
- Task 1: "Create a directory at /tmp/multi-task-test-core-test/ using mkdir -p"
- Expected: LLM calls bash tool with mkdir command
- Actual: LLM responds with text, no tools called
- Result: Directory not created, validation fails

**Impact**:
- ❌ Activities appear to complete but don't do any work
- ❌ Validation correctly fails, but work was never attempted
- ❌ Self-improvement impossible - can't create new activities
- ❌ System is non-functional despite orchestration working

## Root Cause Hypothesis

The task prompt might be:
1. **Missing tool availability** - bash/write tools not in context
2. **Wrong agent configuration** - "general" agent may not have tools enabled
3. **Prompt format issue** - LLM doesn't understand it should use tools
4. **System prompt missing** - No instruction to use tools for implementation

## Verification Steps Needed

1. **Check agent tool configuration**:
   ```typescript
   // repos/metabob-opencode/packages/opencode/src/agent/agent.ts
   // What tools does "general" agent have access to?
   ```

2. **Check task execution prompt**:
   ```typescript
   // repos/metabob-opencode/packages/opencode/src/tool/activity.ts
   // What system prompt is sent with task prompts?
   ```

3. **Check session tool availability**:
   ```typescript
   // During task execution, are bash/write tools available to LLM?
   ```

## Test Results

### Test 1: hello-world-minimal ✅
- **Result**: WORKS
- **Why**: Single task, simple prompt, tools used correctly
- **Tools used**: write tool (1 call tracked)

### Test 2: test-validation ✅
- **Result**: WORKS
- **Why**: Single task creates file, validation passes
- **Tools used**: write tool called successfully

### Test 3: test-validation-should-fail ✅
- **Result**: WORKS (fails correctly)
- **Why**: Validation properly throws error for missing patterns

### Test 4: test-multi-task ❌
- **Result**: FAILS
- **Task 1**: "Create directory" - NO TOOLS CALLED, directory not created
- **Task 2**: "Create first file" - Validation fails (directory missing)
- **Task 3**: Never reached

### Test 5: create-activity-self-contained ❌
- **Result**: FAILS on task 3
- **Task 1**: "gather-requirements" - Completed (text generation)
- **Task 2**: "design-task-graph" - Completed (text generation)  
- **Task 3**: "write-template-json" - FAILED (file not created)
- **Root cause**: Tasks 1 & 2 don't need tools (just analysis), Task 3 needs write tool but doesn't call it

## Pattern Discovery

**Working activities**: Single-task activities where prompt implicitly uses tools

**Failing activities**: Multi-task activities where later tasks need to create files/run commands

**Key difference**: The successful single-task activities might have different prompt formatting or system prompts that encourage tool use.

## Next Steps to Fix

### Priority 1: Diagnose Tool Availability
1. Check agent configuration for "general" subagent
2. Verify bash/write tools are enabled for task execution
3. Check if tools list is passed to LLM during task execution

### Priority 2: Fix Tool Calling
1. Update task prompts to explicitly instruct tool usage
2. Add system prompt that requires tools for implementation tasks
3. Test with explicit "Use the bash tool to..." instructions

### Priority 3: Verify Fix
1. Re-run test-multi-task
2. Verify toolCallCount > 0
3. Verify directory and files are created
4. Verify validation passes

### Priority 4: Test Self-Improvement
1. Run create-activity-self-contained again
2. Verify it creates valid JSON template
3. Register created template
4. Execute created template
5. Verify self-improvement loop works

## Success Criteria

The activity system foundation is working when:

- ✅ Single-task activities execute tools correctly
- ✅ Multi-task activities execute tools in each task
- ✅ Validation runs after each task
- ✅ create-activity-self-contained completes all 4 tasks
- ✅ Created activity can be registered and executed
- ✅ Self-improvement loop: activity creates activity that creates activity

## Current Blockers

1. **CRITICAL**: Tasks don't call tools (toolCallCount: 0)
2. **HIGH**: Multi-task orchestration broken by tool calling issue
3. **HIGH**: create-activity-self-contained can't create activities
4. **MEDIUM**: Self-improvement loop untested

## Files to Investigate

1. `repos/metabob-opencode/packages/opencode/src/agent/agent.ts`
   - Agent configuration and tool lists

2. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
   - Task execution logic (lines 1683-1750)
   - executeTemplate function

3. `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`
   - System prompt generation
   - Tool availability in prompts

4. `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`
   - Alternative execution path?

## Conclusion

**The activity system has a solid foundation** (orchestration, validation, sessions) but is **critically broken** because tasks don't actually execute work.

**Root cause**: Tool calling mechanism not working in task execution context.

**Fix required**: Ensure bash/write/read tools are available and LLM is instructed to use them during task execution.

**Priority**: URGENT - This blocks all multi-task activities and self-improvement.

---

**Status**: 🔴 **CRITICAL BLOCKER IDENTIFIED**
**Next**: Investigate agent tool configuration and task execution prompts
