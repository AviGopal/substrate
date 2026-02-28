# CPG Co-Change Integration Flow Diagram

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Activity Template Execution                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Task Executor   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Execute Task    │
                    │  via Subagent    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Validate Result  │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌──────────────────┐   ┌──────────────────┐
          │ Validation Failed │   │ Validation Passed│
          │   (throw error)   │   │                  │
          └──────────────────┘   └──────────────────┘
                                          │
                                          ▼
                    ╔═══════════════════════════════════════╗
                    ║  🎯 CO-CHANGE ANALYSIS INSERTION POINT ║
                    ║         (Line 1239)                   ║
                    ╚═══════════════════════════════════════╝
                                          │
                                          ▼
                    ┌──────────────────────────────────────┐
                    │  Extract Changed Files from Session  │
                    │  SessionContext.getModifiedFiles()   │
                    └──────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
          ┌──────────────────┐                       ┌──────────────────┐
          │  No Files Changed │                       │ Files Changed    │
          │   (skip analysis) │                       │                  │
          └──────────────────┘                       └──────────────────┘
                                                                │
                                                                ▼
                                          ┌─────────────────────────────────┐
                                          │ Query Metabob for Co-Changes    │
                                          │ MetabobCLI.suggestRelatedChanges│
                                          └─────────────────────────────────┘
                                                                │
                          ┌─────────────────────────────────────┴─────────────────────────────────────┐
                          │                                                                           │
                          ▼                                                                           ▼
              ┌──────────────────────┐                                                   ┌──────────────────────┐
              │ No Co-Changes Found  │                                                   │ Co-Changes Found     │
              │  (skip follow-up)    │                                                   │                      │
              └──────────────────────┘                                                   └──────────────────────┘
                                                                                                      │
                                                                                                      ▼
                                                                          ┌────────────────────────────────────────┐
                                                                          │ For Each High-Priority Co-Change       │
                                                                          │ (score >= 0.7 AND issues > 0)          │
                                                                          └────────────────────────────────────────┘
                                                                                                      │
                                                                                                      ▼
                                                                          ┌────────────────────────────────────────┐
                                                                          │ Create Follow-Up Task                  │
                                                                          │ - Task ID: cochange-review-{parent}-{ts}│
                                                                          │ - Dependencies: [parent task]          │
                                                                          │ - Prompt: Review file for consistency  │
                                                                          └────────────────────────────────────────┘
                                                                                                      │
                                                                          ┌───────────────────────────┴───────────────────────────┐
                                                                          │                                                       │
                                                                          ▼                                                       ▼
                                                          ┌────────────────────────────────┐              ┌────────────────────────────────┐
                                                          │ Option 1: Add to Template      │              │ Option 2: Create Impulse       │
                                                          │ template.tasks.push(followUp)  │              │ Activity.addImpulses(...)      │
                                                          └────────────────────────────────┘              └────────────────────────────────┘
                                                                          │                                                       │
                                                                          └───────────────────┬───────────────────────────────────┘
                                                                                              │
                                                                                              ▼
                                                                          ┌────────────────────────────────────────┐
                                                                          │ Save Activity                          │
                                                                          │ await Activity.save(_activity)         │
                                                                          └────────────────────────────────────────┘
                                                                                              │
                                                                                              ▼
                                                                          ┌────────────────────────────────────────┐
                                                                          │ Return Task Result                     │
                                                                          │ { startedAt, completedAt, ... }        │
                                                                          └────────────────────────────────────────┘
```

---

## Detailed Co-Change Analysis Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CO-CHANGE ANALYSIS (Line 1239)                      │
└─────────────────────────────────────────────────────────────────────────┘

    INPUT: sessionID, task, _activity
          │
          ▼
    ┌─────────────────────────────────────┐
    │ Step 1: Extract Changed Files       │
    │                                     │
    │ const changedFiles =                │
    │   SessionContext.getModifiedFiles(  │
    │     sessionID,                      │
    │     { maxAge: 3600000,              │
    │       onlyWrites: true }            │
    │   )                                 │
    │                                     │
    │ RESULT: ["src/auth.ts",             │
    │          "src/login.ts"]            │
    └─────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────┐
    │ Step 2: Query Co-Changed Files      │
    │                                     │
    │ const relatedFiles =                │
    │   MetabobCLI.suggestRelatedChanges( │
    │     changedFiles,                   │
    │     { top_k: 5 }                    │
    │   )                                 │
    │                                     │
    │ RESULT: [                           │
    │   {                                 │
    │     file_path: "src/session.ts",    │
    │     cochange_score: 0.85,           │
    │     total_issues: 3,                │
    │     high_severity_issues: 1,        │
    │     recommendation: "Review..."     │
    │   },                                │
    │   {                                 │
    │     file_path: "src/middleware.ts", │
    │     cochange_score: 0.72,           │
    │     total_issues: 2,                │
    │     high_severity_issues: 0,        │
    │     recommendation: "Check..."      │
    │   }                                 │
    │ ]                                   │
    └─────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────┐
    │ Step 3: Filter High-Priority        │
    │                                     │
    │ for (const cochange of relatedFiles)│
    │   if (cochange.cochange_score >= 0.7│
    │       && cochange.total_issues > 0) │
    │     → Create Follow-Up Task         │
    │                                     │
    │ FILTERED: [                         │
    │   {                                 │
    │     file_path: "src/session.ts",    │
    │     cochange_score: 0.85,           │
    │     total_issues: 3                 │
    │   }                                 │
    │ ]                                   │
    │ (middleware.ts filtered out: 0 high)│
    └─────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────┐
    │ Step 4: Create Follow-Up Task       │
    │                                     │
    │ const followUpTask = {              │
    │   id: "cochange-review-task1-1234", │
    │   subagent: "general",              │
    │   description: "Review co-changed   │
    │                 file: src/session.ts│
    │   dependencies: [task.id],          │
    │   prompt: {                         │
    │     template: "Review {{file_path}} │
    │                for consistency...", │
    │     variables: [                    │
    │       { name: "file_path",          │
    │         value: "src/session.ts" },  │
    │       { name: "cochange_score",     │
    │         value: 0.85 },              │
    │       { name: "total_issues",       │
    │         value: 3 }                  │
    │     ]                               │
    │   },                                │
    │   validation: {                     │
    │     requiredFiles: ["src/session.ts│
    │   }                                 │
    │ }                                   │
    └─────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────┐
    │ Step 5: Add Task to Template        │
    │                                     │
    │ const template =                    │
    │   TemplateRepository.get(           │
    │     _activity.templateId            │
    │   )                                 │
    │                                     │
    │ template.tasks.push(followUpTask)   │
    │                                     │
    │ await Activity.save(_activity)      │
    └─────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────┐
    │ Step 6: Log Success                 │
    │                                     │
    │ log.info("added co-change task", {  │
    │   taskId: followUpTask.id,          │
    │   parentTaskId: task.id,            │
    │   filePath: "src/session.ts",       │
    │   cochangeScore: 0.85,              │
    │   issues: 3                         │
    │ })                                  │
    └─────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌────────────────────┐
│  Task Execution    │
│  (executeTask)     │
└─────────┬──────────┘
          │
          │ Tracks file operations
          ▼
┌────────────────────┐
│  SessionContext    │
│  .trackFileModif   │
│  .trackFileAccess  │
└─────────┬──────────┘
          │
          │ Stores in memory
          ▼
┌────────────────────┐
│  Session State     │
│  modifiedFiles map │
│  recentFiles map   │
└─────────┬──────────┘
          │
          │ getModifiedFiles()
          ▼
┌────────────────────┐
│  Changed Files     │
│  ["src/auth.ts",   │
│   "src/login.ts"]  │
└─────────┬──────────┘
          │
          │ suggestRelatedChanges()
          ▼
┌────────────────────┐
│  Metabob CPG       │
│  Co-Change Graph   │
│  + Issues Index    │
└─────────┬──────────┘
          │
          │ Returns co-changes + issues
          ▼
┌────────────────────┐
│  Related Files     │
│  [{ file_path,     │
│     cochange_score,│
│     total_issues,  │
│     ... }]         │
└─────────┬──────────┘
          │
          │ Filter: score >= 0.7 && issues > 0
          ▼
┌────────────────────┐
│  High-Priority     │
│  Co-Changes        │
└─────────┬──────────┘
          │
          │ For each: create follow-up task
          ▼
┌────────────────────┐
│  Follow-Up Tasks   │
│  [{ id, subagent,  │
│     description,   │
│     dependencies,  │
│     prompt, ... }] │
└─────────┬──────────┘
          │
          │ Add to template
          ▼
┌────────────────────┐
│  Updated Template  │
│  tasks: [original  │
│          + followup│
└─────────┬──────────┘
          │
          │ Continue execution
          ▼
┌────────────────────┐
│  Follow-Up Tasks   │
│  Execute Next      │
└────────────────────┘
```

---

## Code Insertion Context

```typescript
// FILE: repos/metabob-opencode/packages/opencode/src/session/template-executor.ts
// LINE: ~1230-1250

async function executeTask(
  task: ActivityTemplate.Task,
  activity: Activity.Info,             // 👈 Activity object available
  variables: Record<string, unknown>,
  attempt: number,
  sessionID: string,                    // 👈 Session ID available
  parentSessionID: string | undefined,
  taskImpulses: Record<string, ActivityTemplate.Impulse.Schema>,
): Promise<Partial<TaskExecution>> {
  // ... task execution ...
  const result = await executeViaSubagent(...)
  
  // ... evidence tracking ...
  
  // ✅ Line 1232: Validate result
  const validation = await validateTaskResult(task, result, mergedVariables, sessionID)
  
  // ✅ Line 1235: Check validation
  if (!validation.passed) {
    const failedChecks = validation.checks.filter((c: any) => !c.passed)
    throw new Error(`Validation failed: ${JSON.stringify(failedChecks)}`)
  }
  
  // 🎯 Line 1239: INSERT CO-CHANGE ANALYSIS HERE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Available variables:
  // - task: ActivityTemplate.Task
  // - _activity: Activity.Info (alias for activity param)
  // - sessionID: string
  // - result: { tokens, cost, sessionID }
  // - validation: { passed: true, checks: [...] }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  try {
    log.debug("starting co-change analysis", { taskId: task.id })
    
    // Step 1: Extract changed files
    const { SessionContext } = await import("./context")
    const changedFiles = SessionContext.getModifiedFiles(sessionID, {
      maxAge: 3600000,
      onlyWrites: true,
    })
    
    if (changedFiles.length > 0) {
      // Step 2: Query co-changes
      const relatedFiles = await MetabobCLI.suggestRelatedChanges(changedFiles, {
        top_k: 5,
      })
      
      // Step 3: Add follow-up tasks
      for (const cochange of relatedFiles) {
        if (cochange.cochange_score >= 0.7 && cochange.total_issues > 0) {
          // Create follow-up task
          const followUpTask: ActivityTemplate.Task = {
            id: `cochange-review-${task.id}-${Date.now()}`,
            subagent: "general",
            description: `Review co-changed file: ${cochange.file_path}`,
            dependencies: [task.id],
            prompt: { /* ... */ },
            validation: { /* ... */ },
            retry: { maxAttempts: 2, strategy: "simple" },
            complexity: "simple",
          }
          
          // Add to template
          const template = await TemplateRepository.get(_activity.templateId!)
          if (template) {
            template.tasks.push(followUpTask)
            log.info("added co-change follow-up task", {
              taskId: followUpTask.id,
              filePath: cochange.file_path,
            })
          }
        }
      }
    }
  } catch (error) {
    log.warn("co-change analysis failed", { error })
  }
  
  // ✅ Line 1240: Return task result
  return {
    startedAt,
    completedAt,
    duration: completedAt - startedAt,
    tokens: result.tokens,
    cost: result.cost,
    validation,
  }
}
```

---

## Alternative Approaches Comparison

```
┌─────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│     Approach        │   Dynamic Tasks      │   Impulse-Based      │  Post-Activity Hook  │
├─────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Implementation      │ Modify template.tasks│ Add to impulses      │ Run after completion │
│ Complexity          │ Medium               │ Low                  │ Low                  │
│ Automatic Execution │ ✅ Yes               │ ❌ No (suggestions)  │ ⚠️ Separate activity │
│ Immediate Feedback  │ ✅ Yes               │ ✅ Yes               │ ❌ Delayed           │
│ Template Mutation   │ ⚠️ Required          │ ❌ Not required      │ ❌ Not required      │
│ Agent Visibility    │ ✅ Explicit tasks    │ ✅ Context injection │ ⚠️ Separate report   │
│ Rollout Complexity  │ High                 │ Low                  │ Medium               │
│ Recommended Phase   │ Phase 3              │ Phase 1-2            │ Future enhancement   │
└─────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
```

---

## Success Metrics Dashboard (Conceptual)

```
╔═══════════════════════════════════════════════════════════════════╗
║                    CPG CO-CHANGE METRICS                          ║
╠═══════════════════════════════════════════════════════════════════╣
║  Analysis Rate                                                    ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 92% (target: >90%)                       ✅ ║
║                                                                   ║
║  Follow-Up Task Rate                                              ║
║  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 47% of analyses add tasks                    ║
║                                                                   ║
║  Avg Co-Change Score                                              ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 0.76 (threshold: 0.7)                        ║
║                                                                   ║
║  Analysis Duration (P95)                                          ║
║  ▓▓▓▓▓▓▓▓░░░░░░░░░░ 420ms (target: <500ms)                     ✅ ║
║                                                                   ║
║  Regression Bug Reduction                                         ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ -18% (target: -20%)                        ⚠️ ║
║                                                                   ║
║  False Positive Rate                                              ║
║  ▓▓░░░░░░░░░░░░░░░░ 3.2% (target: <5%)                         ✅ ║
║                                                                   ║
╠═══════════════════════════════════════════════════════════════════╣
║  Recent Follow-Ups (Last 24h)                                     ║
║  • src/session.ts ← src/auth.ts (score: 0.85, issues: 3)         ║
║  • src/middleware.ts ← src/login.ts (score: 0.78, issues: 2)     ║
║  • src/validation.ts ← src/schema.ts (score: 0.91, issues: 1)    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

**Document Version**: 1.0  
**Created**: 2026-02-19  
**Purpose**: Visual guide for CPG co-change integration implementation
