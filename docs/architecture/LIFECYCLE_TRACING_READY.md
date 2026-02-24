# Lifecycle Tracing Investigation - Ready for Next Session

## Status: Tracing Code Added, Awaiting Execution

### What Was Done This Session

1. **Added Comprehensive Lifecycle Tracing** to `activity.ts` (commit 6660cc1b)
   - Traces to `/tmp/activity-lifecycle-trace.log`
   - Logs all key execution points:
     - Task loop iteration start
     - Pre-flight validation (start/pass/fail)
     - TaskTool delegation and completion
     - Post-execution validation (start/pass/fail)
     - Legacy validation (start/pass/fail)
     - Exception catch blocks

2. **Rebuilt OpenCode** with tracing code included
   - Build completed successfully
   - All platforms updated including `opencode-linux-x64`

3. **Committed Changes**
   - Lifecycle tracing code: commit 6660cc1b
   - Test files: commit 80fa392

### Problem Being Investigated

**`create-activity-self-contained` consistently fails on task 3 (or later tasks):**

Evidence from previous sessions:
- Task 1: ✅ Creates `REQUIREMENTS.md` 
- Task 2: ✅ Creates `TASK_GRAPH.md` (all required patterns present)
- Task 3: ❌ Fails immediately (0.0s duration, no session spawned, no error message)

**Hypothesis**: Task fails in pre-execution checks BEFORE entering the main try-catch block.

**Potential failure points** (from code analysis):
1. Agent lookup (`await Agent.get(task.subagent)`) - line 2032
2. Tool validation (`await validateTaskTools`) - line 2044
3. Pre-flight validation (`await runPreFlightValidation`) - line 1988-1998
4. Variable interpolation (`ActivityTemplate.interpolatePrompt`) - line 2002
5. Impulse loading (`await loadAndFormatImpulses`) - line 1961

### Why Current Session Can't Test

**Critical Issue**: This opencode session was started BEFORE the rebuild, so:
- ❌ Lifecycle tracing code is NOT active in this session
- ❌ `/tmp/activity-lifecycle-trace.log` will not be created
- ✅ Tracing code IS in the rebuilt binary

### Next Session Action Plan

**IMMEDIATELY upon starting next session:**

```bash
# Clean slate
rm -f /tmp/activity-lifecycle-trace.log

# Execute activity (will use NEW binary with tracing)
activity({
  templateId: "create-activity-self-contained",
  variables: {
    templateName: "Test Simple Feature",
    templateDescription: "A simple test activity for lifecycle tracing",
    category: "infrastructure"
  },
  reason: "Testing lifecycle tracing to understand why task 3 fails"
})

# Check trace log
cat /tmp/activity-lifecycle-trace.log
```

### Expected Trace Output

**If task 3 enters the loop:**
```
[timestamp] 🔵 LIFECYCLE: Task loop iteration start {"taskId":"write-template-json"}
[timestamp] 🔵 LIFECYCLE: Found task, starting execution {"taskId":"write-template-json",...}
[timestamp] 🟡 LIFECYCLE: Pre-flight validation starting {"taskId":"write-template-json"}
... (either passes or fails here)
```

**If task 3 doesn't enter the loop:**
```
[timestamp] 🟢 LIFECYCLE: Task completed successfully {"taskId":"design-task-graph"}
[timestamp] 🟢 LIFECYCLE: Legacy validation passed {"taskId":"design-task-graph"}
... (no task 3 entry - means task 2 validation or completion failed silently)
```

**If task 3 starts but fails in pre-checks:**
```
[timestamp] 🔵 LIFECYCLE: Task loop iteration start {"taskId":"write-template-json"}
[timestamp] 🔵 LIFECYCLE: Found task, starting execution {"taskId":"write-template-json",...}
... (stops here - means agent lookup, tool validation, or variable merge failed)
```

### Key Files Modified

**Lifecycle Tracing Implementation:**
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
  - Lines 1702-1712: Trace file initialization and trace() function
  - Lines 1742, 1751: Task loop start tracing
  - Lines 1989, 1994: Pre-flight validation tracing
  - Lines 2073, 2105: TaskTool delegation tracing
  - Lines 2191, 2196: Post-execution validation tracing
  - Lines 2207, 2212: Legacy validation tracing
  - Lines 2221: Task completion tracing
  - Lines 2285: Exception catch tracing

### Template Being Tested

**`create-activity-self-contained`** - 4 tasks:
1. `gather-requirements` - Creates REQUIREMENTS.md
2. `design-task-graph` - Creates TASK_GRAPH.md
3. `write-template-json` - Creates template JSON ← **FAILS HERE**
4. `register-with-backend` - Registers template

**Task 3 characteristics:**
- No special dependencies beyond task 2
- Uses `general` subagent (same as tasks 1-2)
- No pre-checks or post-checks (uses legacy validation)
- Validation: checks for valid JSON with required fields

### Questions to Answer

1. Does task 3 even enter the task loop?
2. If yes, where exactly does it fail? (agent lookup? tool validation? validation?)
3. If no, why does task 2 prevent task 3 from starting?
4. Why is there no error message captured?

### Success Criteria

✅ Trace log shows exact line where execution stops
✅ Understand why no error message is generated
✅ Can reproduce failure consistently
✅ Have hypothesis for root cause

### Notes

- Single-task activities (like `hello-world-minimal`) work fine
- Multi-task activities fail on later tasks (inconsistent - sometimes task 1, sometimes task 3)
- Failure happens with 0.0s duration (immediate)
- No sessions spawned (failure before TaskTool delegation)
- Correctness validator detects "no-work" (symptom, not cause)

---

**NEXT SESSION: Run the test immediately with the rebuilt binary!**
