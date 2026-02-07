# Activity Registration: Quick Reference

## The Problem (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│ PARENT: TemplateExecutor                                    │
│                                                              │
│ 1. preActivity hooks execute                                │
│    → Creates: /tmp/activity-template-abc123                 │
│    → process.chdir("/tmp/activity-template-abc123")  ✅     │
│                                                              │
│ 2. executeTasks() spawns subagents                          │
│    │                                                         │
│    ├─ Task 1 (analyze-examples)                             │
│    │  CWD: /tmp/activity-template-abc123  ✅                │
│    │                                                         │
│    ├─ Task 2 (design-task-graph)                            │
│    │  CWD: /tmp/activity-template-abc123  ✅                │
│    │                                                         │
│    ├─ Task 3 (write-template-json)                          │
│    │  CWD: /tmp/activity-template-abc123  ✅                │
│    │  Creates: template.json  ✅                            │
│    │                                                         │
│    └─ Task 4 (register-template)                            │
│       CWD: /home/avi/... ❌ WRONG!                          │
│       Tries to find: template.json ❌ NOT FOUND!            │
│       Tool: register_activity_template ❌ DOESN'T EXIST!    │
│                                                              │
│ 3. postActivity hooks execute                               │
│    → Cleanup: /tmp/activity-template-abc123                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## The Fix (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│ FIX 1: Pass working directory to executeTasks()            │
│                                                              │
│ BEFORE:                                                      │
│   const executions = await executeTasks(                    │
│     template, activity, variables, dryRun, undefined        │
│   )                                                          │
│                                                              │
│ AFTER:                                                       │
│   const executions = await executeTasks(                    │
│     template, activity, variables, dryRun, undefined,       │
│     hooksContext?.workingDirectory  ← ADD THIS              │
│   )                                                          │
│                                                              │
│ RESULT:                                                      │
│    Task 4 CWD: /tmp/activity-template-abc123  ✅            │
│    Finds: template.json  ✅                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX 2: Create register_activity_template tool              │
│                                                              │
│ TOOL SIGNATURE:                                              │
│   register_activity_template({                              │
│     file_path: "template.json",                             │
│     validate_only: false                                    │
│   })                                                         │
│                                                              │
│ DOES:                                                        │
│   1. Read JSON file                                         │
│   2. Validate against ActivityTemplate.Schema               │
│   3. Call TemplateRepository.save(template)                 │
│   4. Verify with search_activities                          │
│   5. Return { success, template_id, errors }                │
│                                                              │
│ RESULT:                                                      │
│    Task 4 can register directly  ✅                         │
│    Schema errors reported clearly  ✅                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX 3: Add validation script                                │
│                                                              │
│ scripts/validate-activity-template.sh:                      │
│   1. Check JSON syntax (jq)                                 │
│   2. Check required fields                                  │
│   3. Check task count (1-10)                                │
│   4. Check all tasks have validation                        │
│   5. Check all tasks have retry                             │
│                                                              │
│ UPDATE Task 3 validation:                                   │
│   "commands": [{                                            │
│     "name": "validate-schema",                              │
│     "command": "bash scripts/validate-activity-template.sh *.json",
│     "required": true                                        │
│   }]                                                         │
│                                                              │
│ RESULT:                                                      │
│    Schema errors caught in Task 3  ✅                       │
│    Task 4 only runs if valid  ✅                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FIX 4: Implement trailblazing                               │
│                                                              │
│ BEFORE:                                                      │
│   Task 4 fails → Activity fails → Manual fix needed  ❌     │
│                                                              │
│ AFTER:                                                       │
│   Task 4 fails                                              │
│     ↓                                                        │
│   Detect: retry.strategy === "trailblazing"                 │
│     ↓                                                        │
│   Generate recovery tasks:                                  │
│     - Task 5: fix-schema-errors                             │
│     - Task 6: retry-registration                            │
│     ↓                                                        │
│   Append to template.tasks                                  │
│     ↓                                                        │
│   Continue execution                                        │
│     ↓                                                        │
│   Task 5 fixes JSON                                         │
│     ↓                                                        │
│   Task 6 registers successfully  ✅                         │
│                                                              │
│ RESULT:                                                      │
│    Automatic recovery from failures  ✅                     │
│    No manual intervention needed  ✅                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Checklist

```
PHASE 1: CRITICAL (Unblocks everything)
  ☐ 1. Update template-executor.ts line 239
       Add: hooksContext?.workingDirectory parameter
       Time: 5 min
  
  ☐ 2. Update executeTasks() signature
       Add: workingDirectory?: string parameter
       Time: 5 min
  
  ☐ 3. Pass workingDirectory to Session.create()
       Update: cwd: workingDirectory || process.cwd()
       Time: 5 min
  
  ☐ 4. Test: Run test-temp-dir activity
       Expected: Task 2 sees files from Task 1
       Time: 5 min
  
  Total: 20 minutes ✓

PHASE 2: HIGH PRIORITY (Enables registration)
  ☐ 5. Create register-activity-template.ts
       Implement: Read, validate, register, verify
       Time: 45 min
  
  ☐ 6. Export in tool/index.ts
       Add: export { registerActivityTemplate }
       Time: 2 min
  
  ☐ 7. Expose to agents in prompt.ts
       Add to: activity and general agent tool sets
       Time: 3 min
  
  ☐ 8. Test: Register minimal-template.json
       Expected: Registration succeeds, search finds it
       Time: 10 min
  
  Total: 60 minutes ✓

PHASE 3: MEDIUM PRIORITY (Improves reliability)
  ☐ 9. Create scripts/validate-activity-template.sh
       Implement: 5 validation checks
       Time: 20 min
  
  ☐ 10. Make script executable
        Run: chmod +x scripts/validate-activity-template.sh
        Time: 1 min
  
  ☐ 11. Update Task 3 validation in create-activity-template.json
        Add: validation command
        Time: 5 min
  
  ☐ 12. Test: Validate valid and invalid templates
        Expected: Valid passes, invalid fails with clear errors
        Time: 10 min
  
  Total: 36 minutes ✓

PHASE 4: MEDIUM PRIORITY (Enables recovery)
  ☐ 13. Implement generateRecoveryTasks() in template-executor.ts
        Logic: Analyze error, create fix tasks
        Time: 60 min
  
  ☐ 14. Add trailblazing trigger after task failure
        Check: retry.strategy === "trailblazing"
        Time: 30 min
  
  ☐ 15. Update Task 4 retry strategy to "trailblazing"
        Change in: create-activity-template.json
        Time: 2 min
  
  ☐ 16. Test: Register invalid template
        Expected: Auto-generates fix tasks, retries, succeeds
        Time: 30 min
  
  Total: 122 minutes ✓

PHASE 5: LOW PRIORITY (Polish)
  ☐ 17. Update Task 4 prompt in create-activity-template.json
        Simplify: Use new tool, clearer instructions
        Time: 10 min
  
  ☐ 18. Test: End-to-end activity creation
        Run: create-activity-template with test variables
        Expected: All tasks complete, template registered
        Time: 15 min
  
  Total: 25 minutes ✓

GRAND TOTAL: 263 minutes = 4.4 hours
```

## Files to Modify

```
metabob-opencode/packages/opencode/
  ├── src/
  │   ├── session/
  │   │   └── template-executor.ts          [MODIFY] Fix 1, 4
  │   └── tool/
  │       ├── index.ts                       [MODIFY] Fix 2
  │       ├── register-activity-template.ts  [CREATE]  Fix 2
  │       └── signatures.ts                  [MODIFY] Fix 2
  └── templates/
      └── built-in/
          └── create-activity-template.json  [MODIFY] Fix 3, 4, 5

metabob-devbob/
  └── scripts/
      └── validate-activity-template.sh      [CREATE]  Fix 3
```

## Test Files

```
test-temp-dir.json          Test Fix 1 (working directory)
minimal-template.json       Test Fix 2 (registration tool)
invalid-template.json       Test Fix 4 (trailblazing)
```

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| create-activity-template success rate | ~30% | ? | 95%+ |
| Working directory inherited | ❌ | ✅ | 100% |
| Direct registration available | ❌ | ✅ | 100% |
| Schema errors caught early | ❌ | ✅ | 100% |
| Auto-recovery from failures | ❌ | ✅ | 80%+ |
| New templates discoverable | ❌ | ✅ | 100% |

## Next Action

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode

# Start with Fix 1 (20 minutes)
# 1. Open packages/opencode/src/session/template-executor.ts
# 2. Go to line 239
# 3. Add workingDirectory parameter
# 4. Update executeTasks() signature and implementation
# 5. Test with test-temp-dir.json

# Then proceed to Fix 2, 3, 4, 5 in order
```
