# Activity Execution Order - Visual Diagram

## The Correct Execution Model

```
┌─────────────────────────────────────────────────────────────────┐
│ Activity Tool Invoked (ONCE)                                    │
│ - Load template                                                 │
│ - Validate all variables                                        │
│ - Pre-flight checks (git, memory agent, metabob)               │
│ - Create activity session                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ TemplateExecutor.executeTasks() - Sequential Loop              │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │  for (const task of template.tasks) {
                         │
                         ▼
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
        ┃ TASK 1 Execution                                    ┃
        ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
        ┃                                                      ┃
        ┃  1. Merge & validate variables                      ┃
        ┃  2. Interpolate prompt with impulses                ┃
        ┃  3. executeViaSubagent()                            ┃
        ┃     └─> TaskTool.executeInternal()                  ┃
        ┃         └─> Session.prompt() ◄── HOOKS RUN HERE     ┃
        ┃             │                                        ┃
        ┃             ├─> PRE-TURN HOOKS (priority < 100):    ┃
        ┃             │   ├─ memory-management (10)           ┃
        ┃             │   │  └─ Runs manage-session-memory    ┃
        ┃             │   │     activity to prepare context   ┃
        ┃             │   ├─ activity-recommendation (15)     ┃
        ┃             │   └─ metabob-context-prep (20)        ┃
        ┃             │      └─ Creates metabob impulses      ┃
        ┃             │                                        ┃
        ┃             ├─> [AGENT EXECUTES PROMPT]             ┃
        ┃             │                                        ┃
        ┃             └─> POST-TURN HOOKS (priority >= 100):  ┃
        ┃                 ├─ post-turn-cleanup (100)          ┃
        ┃                 │  └─ Unloads low-priority impulses ┃
        ┃                 └─ session-memory-optimization (110)┃
        ┃                    └─ Comprehensive memory cleanup  ┃
        ┃                                                      ┃
        ┃  4. Track execution evidence                        ┃
        ┃  5. Validate task result ◄── VALIDATORS RUN HERE    ┃
        ┃     └─ If validation fails → throw error            ┃
        ┃  6. Co-change analysis (optional)                   ┃
        ┃                                                      ┃
        ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                         │
                         │  } // End of task-1
                         │
                         ▼
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
        ┃ TASK 2 Execution                                    ┃
        ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
        ┃                                                      ┃
        ┃  1. Merge & validate variables                      ┃
        ┃  2. Interpolate prompt with impulses                ┃
        ┃  3. executeViaSubagent()                            ┃
        ┃     └─> Session.prompt() ◄── HOOKS RUN AGAIN!       ┃
        ┃         │                                            ┃
        ┃         ├─> PRE-TURN HOOKS (again):                 ┃
        ┃         │   ├─ memory-management (10)               ┃
        ┃         │   ├─ activity-recommendation (15)         ┃
        ┃         │   └─ metabob-context-prep (20)            ┃
        ┃         │                                            ┃
        ┃         ├─> [AGENT EXECUTES PROMPT]                 ┃
        ┃         │                                            ┃
        ┃         └─> POST-TURN HOOKS (again):                ┃
        ┃             ├─ post-turn-cleanup (100)              ┃
        ┃             └─ session-memory-optimization (110)    ┃
        ┃                                                      ┃
        ┃  4. Track execution evidence                        ┃
        ┃  5. Validate task result                            ┃
        ┃  6. Co-change analysis (optional)                   ┃
        ┃                                                      ┃
        ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                         │
                         │  } // End of task-2
                         │
                         ▼
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
        ┃ TASK N Execution (repeat pattern)                  ┃
        ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                         │
                         │  } // End of loop
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Activity Complete                                               │
│ - Save final state                                              │
│ - Report metrics to backend                                     │
│ - Clean up activity memory                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Wrong Mental Model vs Correct Model

### ❌ Wrong (What You Might Have Thought):
```
Activity Start
  │
  ├─> Hook 1
  ├─> Hook 2
  │
  ├─> Task 1 executes
  ├─> Validators run
  │
  ├─> Hook 3
  ├─> Hook 4
  │
  ├─> Task 2 executes
  ├─> Validators run
  │
  └─> Activity End
```
**Issue**: Hooks appear to run BETWEEN tasks in a linear sequence.

### ✅ Correct (What Actually Happens):
```
Activity Start
  │
  ├─> Task 1 {
  │     ├─> Session.prompt() {
  │     │     ├─> PRE-TURN HOOKS
  │     │     ├─> Agent executes
  │     │     └─> POST-TURN HOOKS
  │     │   }
  │     └─> Validators run
  │   }
  │
  ├─> Task 2 {
  │     ├─> Session.prompt() {
  │     │     ├─> PRE-TURN HOOKS (again!)
  │     │     ├─> Agent executes
  │     │     └─> POST-TURN HOOKS (again!)
  │     │   }
  │     └─> Validators run
  │   }
  │
  └─> Activity End
```
**Key Insight**: Hooks are NESTED inside each task, not sequential between tasks.

---

## Call Stack Trace

To see exactly where hooks are triggered:

```
activity.execute()                           // src/tool/activity.ts
  └─> TemplateExecutor.execute()             // src/session/template-executor.ts
      └─> executeTasks()                     // Line ~365
          └─> for (task of tasks)            // Simple for loop
              └─> executeTaskWithRetry()     // Line ~911
                  └─> executeTask()          // Line ~1149
                      │
                      ├─> Merge variables
                      ├─> Interpolate prompt
                      │
                      └─> executeViaSubagent()
                          └─> TaskTool.executeInternal()
                              └─> Session.prompt()    ◄─── HOOKS TRIGGERED HERE
                                  │
                                  ├─> TurnLifecycle.executePreTurnHooks()
                                  │   ├─> memory-management.execute()
                                  │   ├─> activity-recommendation.execute()
                                  │   └─> metabob-context-preparation.execute()
                                  │
                                  ├─> [Agent prompt execution]
                                  │
                                  └─> TurnLifecycle.executePostTurnHooks()
                                      ├─> post-turn-cleanup.execute()
                                      └─> session-memory-optimization.execute()
                      │
                      └─> validateTaskResult()     ◄─── VALIDATORS RUN HERE
```

---

## Timing Analysis

For a 3-task activity, here's the timing breakdown:

```
Total Time = 10 minutes

Task 1 (3 min):
  ├─ Pre-turn hooks: 30s
  │  ├─ memory-management: 20s (spawns manage-session-memory activity)
  │  └─ metabob-context-prep: 10s (creates impulses)
  ├─ Agent execution: 2min
  ├─ Post-turn hooks: 20s
  │  ├─ post-turn-cleanup: 5s (unload low-priority)
  │  └─ session-memory-optimization: 15s (comprehensive cleanup)
  └─ Validation: 10s

Task 2 (3.5 min):
  ├─ Pre-turn hooks: 30s ◄─── RUNS AGAIN
  ├─ Agent execution: 2.5min
  ├─ Post-turn hooks: 20s ◄─── RUNS AGAIN
  └─ Validation: 10s

Task 3 (3.5 min):
  ├─ Pre-turn hooks: 30s ◄─── RUNS AGAIN
  ├─ Agent execution: 2.5min
  ├─ Post-turn hooks: 20s ◄─── RUNS AGAIN
  └─ Validation: 10s
```

**Total hook overhead**: ~5 minutes (50% of total time!)
- Pre-turn hooks: 1.5 min (3 × 30s)
- Post-turn hooks: 1 min (3 × 20s)
- Validation: 30s (3 × 10s)

---

## Key Findings

### 1. Hooks Are Prompt-Based, Not Task-Based
- Hooks run via `Session.prompt()`
- Each task triggers ONE prompt
- Therefore: **Hooks run ONCE per task**

### 2. Hooks Run INSIDE Task Execution
- Not in the `executeTasks()` loop
- Inside the `executeViaSubagent()` call
- Via the `Session.prompt()` invocation

### 3. Validators Run AFTER Hooks Complete
- Post-turn hooks finish first
- Then validators check the result
- If validation fails → task fails → retry or fail activity

### 4. Memory Management Happens Per-Task
- `memory-management` hook runs before EACH task
- `session-memory-optimization` runs after EACH task
- This ensures fresh context for every task

### 5. No Global Activity Hooks
- No hooks run at activity start (before all tasks)
- No hooks run at activity end (after all tasks)
- Only session-level prompt hooks exist

---

## Implications for Development

### When Adding New Hooks:
- ✅ They will run for EVERY task (per prompt)
- ✅ Pre-turn hooks prepare context BEFORE agent sees prompt
- ✅ Post-turn hooks clean up AFTER agent completes
- ❌ They won't run "between tasks" in the loop

### When Debugging Activities:
- 🔍 Look for hook logs INSIDE task execution
- 🔍 Check `Session.prompt()` for hook invocation
- 🔍 Validators are synchronous - if they fail, task fails immediately
- 🔍 Each task has independent hook cycles

### When Optimizing Performance:
- ⚡ Hook overhead multiplies by task count
- ⚡ 3-task activity = 3× hook overhead
- ⚡ Consider caching in hooks for multi-task activities
- ⚡ Memory optimization runs multiple times (not just once)

---

## How to Verify This

### Quick Test:
1. Add trace logs to `executeTasks()` loop (BEFORE/AFTER each task)
2. Add trace logs to each hook's `execute()` function
3. Run a 2-task activity
4. Observe log order:
   ```
   BEFORE TASK 1
     HOOK: memory-management
     HOOK: metabob-context-prep
     [agent executes]
     HOOK: post-turn-cleanup
     HOOK: session-memory-optimization
     VALIDATION
   AFTER TASK 1
   BEFORE TASK 2
     HOOK: memory-management (AGAIN!)
     HOOK: metabob-context-prep (AGAIN!)
     [agent executes]
     HOOK: post-turn-cleanup (AGAIN!)
     HOOK: session-memory-optimization (AGAIN!)
     VALIDATION
   AFTER TASK 2
   ```

This proves hooks run INSIDE tasks, not BETWEEN tasks.

---

## Related Documents

- **Full Proof**: `ACTIVITY_EXECUTION_ORDER_PROOF.md` (detailed code traces)
- **Quick Summary**: `EXECUTION_ORDER_QUICK_SUMMARY.md` (condensed version)
- **Test Template**: `test-execution-order-template.json` (2-task test activity)
- **Test Script**: `test-execution-order.mjs` (automated test setup)

---

## Conclusion

**The execution model is: `TASK(hooks → agent → hooks → validators) → NEXT_TASK(...)`**

Not: `hooks → TASK → hooks → validators → hooks → NEXT_TASK → hooks → ...`

Hooks are **nested inside** each task execution, triggered by the `Session.prompt()` call within `executeViaSubagent()`.

This makes sense because:
- Each task is a separate prompt
- Prompts need context preparation (pre-turn hooks)
- Prompts need cleanup after completion (post-turn hooks)
- The turn lifecycle system is prompt-centric, not task-centric
