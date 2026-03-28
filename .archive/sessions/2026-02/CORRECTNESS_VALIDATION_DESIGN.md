# Correctness Validation System: Implementation Design

**Date**: February 17, 2026  
**Priority**: P0 - Fixes silent failure problem  
**Status**: Design Phase

---

## The Problem We're Solving

**Current State**: Activities can complete with `status: "done"` without doing any actual work (or doing the wrong work), and we can't detect it.

**Root Cause**: We track execution completion but not execution correctness.

**Example from Ground Truth Test**:
- Status: `done` ✅
- Session IDs: `[]` (no agent ran?)
- Commits: `[]` (no work recorded?)
- Files changed: Unknown
- Validation results: Not stored
- Actual work done: **Cannot verify**

---

## Design Principles

### 1. Evidence-Based Validation
- **Collect observable evidence** during execution
- **Compare evidence against expectations** from template
- **Compute confidence score** based on evidence quality

### 2. Layered Verification
- **Layer 1**: Execution evidence (did agent run? what tools were used?)
- **Layer 2**: Work artifacts (what files changed? what commits made?)
- **Layer 3**: Validation results (did checks pass? what was output?)
- **Layer 4**: Behavioral verification (do tests pass? does build work?)

### 3. Non-Blocking Design
- **Don't break existing activities** - add tracking incrementally
- **Graceful degradation** - work with partial evidence
- **Backward compatible** - old activities still work

### 4. Developer-Friendly
- **Clear diagnostic tools** - see exactly what happened
- **Actionable feedback** - know what to fix
- **Confidence scores** - understand reliability

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Correctness Validation System                  │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   Pre-Flight   │────▶│   Execution    │────▶│  Post-Flight   │
│   Snapshot     │     │   Tracking     │     │  Validation    │
└────────────────┘     └────────────────┘     └────────────────┘
       │                      │                       │
       ▼                      ▼                       ▼
  ┌─────────┐         ┌──────────────┐        ┌─────────────┐
  │ Git     │         │ Session      │        │ Diff        │
  │ State   │         │ Tracker      │        │ Analyzer    │
  │ Files   │         │ Tool Calls   │        │ Validation  │
  │ Env     │         │ Agent Log    │        │ Tests       │
  └─────────┘         └──────────────┘        └─────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Evidence Store   │
                    │ (Enhanced        │
                    │  Activity.Info)  │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Correctness      │
                    │ Verdict          │
                    │ Computer         │
                    └──────────────────┘
```

---

## Part 1: Enhanced Activity Storage Schema

### Current Schema (Limited Evidence)

```typescript
interface Activity.Info {
  id: string
  status: "pending" | "in_progress" | "done" | "failed"
  stats: ActivityStats
  
  // These are stored but often empty:
  sessionIDs: string[]      // ❌ Empty in our test
  commits: Commit[]         // ❌ Empty in our test
  agentsUsed: string[]      // ❌ Empty in our test
}
```

### Enhanced Schema (Full Evidence)

```typescript
interface EnhancedActivityInfo extends Activity.Info {
  // NEW: Pre-flight snapshot
  preSnapshot: {
    timestamp: number
    git: {
      branch: string
      commit: string
      uncommittedFiles: string[]
      workingTreeClean: boolean
    }
    files: {
      [path: string]: {
        exists: boolean
        size: number
        hash: string
        modified: number
      }
    }
    environment: {
      testsPass?: boolean
      buildSuccess?: boolean
      typeCheckPass?: boolean
    }
  }
  
  // NEW: Execution evidence
  execution: {
    sessionsSpawned: {
      sessionID: string
      agentType: string
      taskId: string
      startTime: number
      endTime: number
      messageCount: number
      toolCallCount: number
    }[]
    
    toolCalls: {
      sessionID: string
      tool: string
      input: any
      output: any
      success: boolean
      timestamp: number
    }[]
    
    agentDecisions: {
      sessionID: string
      decision: string
      reasoning: string
      timestamp: number
    }[]
  }
  
  // NEW: Work artifacts
  artifacts: {
    filesCreated: string[]
    filesModified: string[]
    filesDeleted: string[]
    
    fileChanges: {
      path: string
      action: "created" | "modified" | "deleted"
      linesBefore: number
      linesAfter: number
      linesAdded: number
      linesDeleted: number
      hash: string
      timestamp: number
    }[]
    
    commitsMade: {
      sha: string
      message: string
      files: string[]
      timestamp: number
      author: string
    }[]
  }
  
  // NEW: Validation execution
  validation: {
    executed: boolean
    timestamp: number
    
    requiredFiles: {
      file: string
      required: boolean
      exists: boolean
      createdByActivity: boolean
      existedBefore: boolean
    }[]
    
    requiredPatterns: {
      file: string
      pattern: string
      required: boolean
      found: boolean
      matches: string[]
    }[]
    
    forbiddenPatterns: {
      file: string
      pattern: string
      found: boolean
      violations: string[]
    }[]
    
    commands: {
      name: string
      command: string
      required: boolean
      executed: boolean
      exitCode: number
      stdout: string
      stderr: string
      passed: boolean
      duration: number
    }[]
    
    overallPassed: boolean
    warnings: string[]
    errors: string[]
  }
  
  // NEW: Post-flight differential
  postSnapshot: {
    timestamp: number
    git: {
      branch: string
      commit: string
      uncommittedFiles: string[]
      workingTreeClean: boolean
    }
    environment: {
      testsPass?: boolean
      buildSuccess?: boolean
      typeCheckPass?: boolean
    }
  }
  
  differential: {
    gitChanges: {
      branchCreated: boolean
      branchMerged: boolean
      commitCount: number
      filesChanged: number
    }
    
    qualityDelta: {
      testCount: { before: number, after: number, delta: number }
      testPassRate: { before: number, after: number, delta: number }
      buildStatus: { before: boolean, after: boolean, changed: boolean }
    }
  }
  
  // NEW: Correctness verdict
  correctness: {
    computed: boolean
    timestamp: number
    
    verdict: "correct" | "suspicious" | "incorrect" | "unknown"
    confidence: number  // 0-1
    
    evidenceQuality: {
      hasSessionEvidence: boolean
      hasWorkArtifacts: boolean
      hasValidationResults: boolean
      hasBehavioralVerification: boolean
      score: number  // 0-4 (count of above)
    }
    
    issues: {
      severity: "critical" | "warning" | "info"
      category: "no-work" | "validation-failure" | "suspicious-timing" | "missing-evidence"
      message: string
      suggestion: string
    }[]
    
    metrics: {
      sessionsSpawned: number
      toolCallsMade: number
      filesChanged: number
      commitsMade: number
      validationsPassed: number
      validationsFailed: number
    }
  }
}
```

---

## Part 2: Evidence Collection Points

### Collection Point 1: Pre-Flight Snapshot

**When**: Before activity starts (after pre-flight checks pass)  
**Where**: `activity.ts` after git validation  
**What to collect**:

```typescript
async function capturePreFlightSnapshot(): Promise<PreFlightSnapshot> {
  const snapshot = {
    timestamp: Date.now(),
    
    // Git state
    git: {
      branch: await ActivityGit.getCurrentBranch(),
      commit: await ActivityGit.getBaseCommit(),
      uncommittedFiles: (await ActivityGit.getStatus()).uncommittedFiles,
      workingTreeClean: await ActivityGit.isWorkingTreeClean()
    },
    
    // File snapshot (for changed files detection)
    files: await snapshotFiles([
      ...template.tasks.flatMap(t => t.validation.requiredFiles),
      // Add more heuristics: src/, test/, etc.
    ]),
    
    // Environment state
    environment: {
      testsPass: await runTests({ failFast: true }).catch(() => false),
      buildSuccess: await runBuild({ dryRun: true }).catch(() => false),
      typeCheckPass: await runTypeCheck().catch(() => false)
    }
  }
  
  return snapshot
}
```

### Collection Point 2: Session Tracking

**When**: During task execution (when agent sessions are spawned)  
**Where**: `activity.ts` in task execution loop  
**What to collect**:

```typescript
async function executeTaskWithTracking(task: Task): Promise<TaskResult> {
  const sessionID = await Session.create({
    agent: task.agent,
    prompt: renderedPrompt
  })
  
  // NEW: Track session creation
  activity.execution.sessionsSpawned.push({
    sessionID,
    agentType: task.agent,
    taskId: task.id,
    startTime: Date.now(),
    endTime: 0,  // Will be set later
    messageCount: 0,
    toolCallCount: 0
  })
  
  // NEW: Subscribe to session events
  Session.onToolCall(sessionID, (toolCall) => {
    activity.execution.toolCalls.push({
      sessionID,
      tool: toolCall.tool,
      input: toolCall.input,
      output: toolCall.output,
      success: toolCall.success,
      timestamp: Date.now()
    })
  })
  
  // Execute task
  const result = await Session.prompt(sessionID, renderedPrompt)
  
  // NEW: Update session tracking
  const sessionTrack = activity.execution.sessionsSpawned.find(s => s.sessionID === sessionID)
  if (sessionTrack) {
    sessionTrack.endTime = Date.now()
    sessionTrack.messageCount = await Session.messageCount(sessionID)
    sessionTrack.toolCallCount = activity.execution.toolCalls.filter(tc => tc.sessionID === sessionID).length
  }
  
  return result
}
```

### Collection Point 3: Validation Execution

**When**: After task completes, before marking task done  
**Where**: `task-execution-shared.ts` in `runValidationCommands`  
**What to collect**:

```typescript
async function runValidationCommandsWithLogging(
  commands: ValidationCommand[],
  taskId: string,
  activity: EnhancedActivityInfo
): Promise<void> {
  activity.validation.executed = true
  activity.validation.timestamp = Date.now()
  
  for (const cmd of commands) {
    const startTime = Date.now()
    const proc = Bun.spawn(["sh", "-c", cmd.command], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe"
    })
    
    const exitCode = await proc.exited
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const duration = Date.now() - startTime
    
    // NEW: Log validation execution
    activity.validation.commands.push({
      name: cmd.name,
      command: cmd.command,
      required: cmd.required,
      executed: true,
      exitCode,
      stdout: stdout.slice(0, 1000),  // Limit size
      stderr: stderr.slice(0, 1000),
      passed: exitCode === 0,
      duration
    })
    
    if (exitCode !== 0 && cmd.required) {
      activity.validation.overallPassed = false
      activity.validation.errors.push(`Command "${cmd.name}" failed`)
      throw new Error(`Validation failed: ${cmd.name}`)
    }
  }
  
  activity.validation.overallPassed = true
}
```

### Collection Point 4: File Change Tracking

**When**: After activity completes, before returning  
**Where**: `activity.ts` before final save  
**What to collect**:

```typescript
async function captureFileChanges(
  preSnapshot: PreFlightSnapshot,
  activity: EnhancedActivityInfo
): Promise<void> {
  // Get git diff
  const diff = await ActivityGit.getDiff(preSnapshot.git.commit, "HEAD")
  const changedFiles = parseDiffOutput(diff)
  
  for (const file of changedFiles) {
    const preFile = preSnapshot.files[file.path]
    const action = !preFile?.exists ? "created" : file.deleted ? "deleted" : "modified"
    
    activity.artifacts.fileChanges.push({
      path: file.path,
      action,
      linesBefore: preFile?.size || 0,
      linesAfter: file.linesAfter,
      linesAdded: file.linesAdded,
      linesDeleted: file.linesDeleted,
      hash: await getFileHash(file.path),
      timestamp: Date.now()
    })
    
    if (action === "created") activity.artifacts.filesCreated.push(file.path)
    if (action === "modified") activity.artifacts.filesModified.push(file.path)
    if (action === "deleted") activity.artifacts.filesDeleted.push(file.path)
  }
}
```

### Collection Point 5: Post-Flight Snapshot

**When**: After all tasks complete, before computing verdict  
**Where**: `activity.ts` before final save  
**What to collect**:

```typescript
async function capturePostFlightSnapshot(): Promise<PostFlightSnapshot> {
  return {
    timestamp: Date.now(),
    
    git: {
      branch: await ActivityGit.getCurrentBranch(),
      commit: await ActivityGit.getBaseCommit(),
      uncommittedFiles: (await ActivityGit.getStatus()).uncommittedFiles,
      workingTreeClean: await ActivityGit.isWorkingTreeClean()
    },
    
    environment: {
      testsPass: await runTests({ failFast: true }).catch(() => false),
      buildSuccess: await runBuild({ dryRun: true }).catch(() => false),
      typeCheckPass: await runTypeCheck().catch(() => false)
    }
  }
}
```

---

## Part 3: Correctness Verdict Computer

### Algorithm: Compute Correctness from Evidence

```typescript
function computeCorrectnessVerdict(activity: EnhancedActivityInfo): CorrectnessVerdict {
  const issues: CorrectnessIssue[] = []
  let confidence = 1.0  // Start at 100%
  
  // Check 1: Was any agent work done?
  const hasSessionEvidence = activity.execution.sessionsSpawned.length > 0
  if (!hasSessionEvidence) {
    issues.push({
      severity: "critical",
      category: "no-work",
      message: "No agent sessions spawned - activity may not have done any work",
      suggestion: "Check template prompts and task configuration"
    })
    confidence *= 0.1  // Massive confidence hit
  }
  
  // Check 2: Were any tools actually used?
  const hasToolCalls = activity.execution.toolCalls.length > 0
  if (hasSessionEvidence && !hasToolCalls) {
    issues.push({
      severity: "critical",
      category: "no-work",
      message: "Agent spawned but no tools used - no actual work performed",
      suggestion: "Review agent conversation to see why tools weren't used"
    })
    confidence *= 0.2
  }
  
  // Check 3: Were any files changed?
  const hasFileChanges = activity.artifacts.filesChanged.length > 0
  if (hasToolCalls && !hasFileChanges) {
    issues.push({
      severity: "warning",
      category: "no-work",
      message: "Tools used but no files changed - activity may have been read-only",
      suggestion: "Verify this was intended to be a read-only activity"
    })
    confidence *= 0.5
  }
  
  // Check 4: Did validation pass?
  const validationExecuted = activity.validation.executed
  const validationPassed = activity.validation.overallPassed
  
  if (!validationExecuted) {
    issues.push({
      severity: "warning",
      category: "missing-evidence",
      message: "Validation was not executed",
      suggestion: "Add validation commands to template"
    })
    confidence *= 0.7
  } else if (!validationPassed) {
    issues.push({
      severity: "critical",
      category: "validation-failure",
      message: "Validation failed",
      suggestion: "Review validation command output"
    })
    confidence *= 0.1
  }
  
  // Check 5: Were required files created by THIS activity?
  for (const reqFile of activity.validation.requiredFiles) {
    if (reqFile.required && reqFile.exists && reqFile.existedBefore) {
      issues.push({
        severity: "warning",
        category: "suspicious-timing",
        message: `Required file "${reqFile.file}" existed before activity started`,
        suggestion: "File should be created by activity, not pre-existing"
      })
      confidence *= 0.6
    }
  }
  
  // Check 6: Suspicious timing?
  const duration = activity.stats.duration
  const avgDuration = activity.templateAvgDuration || 20000  // Template average
  
  if (duration < avgDuration * 0.5) {
    issues.push({
      severity: "warning",
      category: "suspicious-timing",
      message: `Activity completed very quickly (${duration}ms vs ${avgDuration}ms avg)`,
      suggestion: "May have skipped work or found shortcut"
    })
    confidence *= 0.8
  }
  
  // Check 7: Were commits made?
  const hasCommits = activity.artifacts.commitsMade.length > 0
  if (hasFileChanges && !hasCommits) {
    issues.push({
      severity: "info",
      category: "missing-evidence",
      message: "Files changed but no commits made",
      suggestion: "Activity may still be in uncommitted state"
    })
    confidence *= 0.9
  }
  
  // Check 8: Did environment state improve?
  const envImproved = 
    (activity.postSnapshot.environment.testsPass && !activity.preSnapshot.environment.testsPass) ||
    (activity.postSnapshot.environment.buildSuccess && !activity.preSnapshot.environment.buildSuccess)
  
  const envRegressed =
    (!activity.postSnapshot.environment.testsPass && activity.preSnapshot.environment.testsPass) ||
    (!activity.postSnapshot.environment.buildSuccess && activity.preSnapshot.environment.buildSuccess)
  
  if (envRegressed) {
    issues.push({
      severity: "critical",
      category: "validation-failure",
      message: "Environment regressed (tests/build now failing)",
      suggestion: "Activity broke something - needs immediate fix"
    })
    confidence *= 0.1
  }
  
  // Compute evidence quality score
  const evidenceQuality = {
    hasSessionEvidence,
    hasWorkArtifacts: hasFileChanges || hasCommits,
    hasValidationResults: validationExecuted,
    hasBehavioralVerification: activity.postSnapshot.environment.testsPass !== undefined,
    score: [hasSessionEvidence, hasFileChanges || hasCommits, validationExecuted, 
            activity.postSnapshot.environment.testsPass !== undefined].filter(Boolean).length
  }
  
  // Determine verdict
  let verdict: "correct" | "suspicious" | "incorrect" | "unknown"
  
  if (confidence >= 0.8 && evidenceQuality.score >= 3) {
    verdict = "correct"
  } else if (confidence < 0.3 || issues.some(i => i.severity === "critical")) {
    verdict = "incorrect"
  } else if (confidence < 0.6 || issues.length > 0) {
    verdict = "suspicious"
  } else {
    verdict = "unknown"
  }
  
  return {
    computed: true,
    timestamp: Date.now(),
    verdict,
    confidence,
    evidenceQuality,
    issues,
    metrics: {
      sessionsSpawned: activity.execution.sessionsSpawned.length,
      toolCallsMade: activity.execution.toolCalls.length,
      filesChanged: activity.artifacts.filesChanged.length,
      commitsMade: activity.artifacts.commitsMade.length,
      validationsPassed: activity.validation.commands.filter(c => c.passed).length,
      validationsFailed: activity.validation.commands.filter(c => !c.passed && c.required).length
    }
  }
}
```

---

## Part 4: Implementation Plan

### Phase 1: Schema Enhancement (Week 1)

**Files to modify**:
1. `activity.ts` - Add new fields to Activity.Info interface
2. `activity-schema-adapter.ts` - Handle backward compatibility
3. Storage layer - Handle new fields gracefully

**Approach**: Add fields as optional, populate incrementally

### Phase 2: Evidence Collection (Week 2)

**Files to modify**:
1. `activity.ts` - Add snapshot capture calls
2. `template-executor.ts` - Add session tracking
3. `task-execution-shared.ts` - Add validation logging

**Priority order**:
1. Session tracking (highest impact)
2. Validation logging (catches most failures)
3. File change tracking (work evidence)
4. Snapshots (pre/post comparison)

### Phase 3: Verdict Computer (Week 3)

**New files**:
1. `activity-correctness.ts` - Verdict computation logic
2. `activity-evidence.ts` - Evidence quality scoring

**Integration**: Call from `activity.ts` before final save

### Phase 4: Diagnostic Tools (Week 4)

**New tools**:
1. `activity-trace` tool - Show execution trace
2. `activity-diagnose` tool - Analyze suspicious activities

**Integration**: Add to tool registry

---

## Part 5: Backward Compatibility

### Handling Old Activities

```typescript
// Old activities won't have new fields
function ensureBackwardCompatibility(activity: Activity.Info): EnhancedActivityInfo {
  return {
    ...activity,
    
    // Add default values for missing fields
    preSnapshot: activity.preSnapshot || createEmptySnapshot(),
    execution: activity.execution || { sessionsSpawned: [], toolCalls: [], agentDecisions: [] },
    artifacts: activity.artifacts || { filesCreated: [], filesModified: [], filesDeleted: [], fileChanges: [], commitsMade: [] },
    validation: activity.validation || { executed: false, /* ... */ },
    postSnapshot: activity.postSnapshot || createEmptySnapshot(),
    differential: activity.differential || createEmptyDifferential(),
    correctness: activity.correctness || { computed: false, verdict: "unknown", confidence: 0, /* ... */ }
  }
}
```

### Gradual Rollout

1. **Phase 1**: Add fields, don't populate (no breaking changes)
2. **Phase 2**: Populate fields for new activities only
3. **Phase 3**: Compute verdicts with graceful handling of missing evidence
4. **Phase 4**: Full rollout with all evidence collection

---

## Part 6: Expected Outcomes

### For Our Ground Truth Activity

**Before** (current state):
```json
{
  "status": "done",
  "sessionIDs": [],
  "commits": [],
  "correctness": { "verdict": "unknown" }
}
```

**After** (with correctness validation):
```json
{
  "status": "done",
  "execution": {
    "sessionsSpawned": [],  // Still empty
    "toolCalls": []
  },
  "artifacts": {
    "filesChanged": 0
  },
  "validation": {
    "executed": true,
    "requiredFiles": [{
      "file": "TEST.md",
      "exists": true,
      "existedBefore": true,  // KEY INSIGHT
      "createdByActivity": false
    }],
    "overallPassed": true
  },
  "correctness": {
    "verdict": "suspicious",
    "confidence": 0.2,
    "issues": [
      {
        "severity": "critical",
        "message": "No agent sessions spawned - activity may not have done any work"
      },
      {
        "severity": "warning",
        "message": "Required file 'TEST.md' existed before activity started"
      }
    ]
  }
}
```

**Diagnosis**: **SUSPICIOUS** - Probably did no actual work

---

## Part 7: Success Metrics

### How We'll Know It Works

**Metric 1**: Can detect silent failures
- Run ground truth activity again
- Check: `verdict === "suspicious"` ✅

**Metric 2**: Can identify correct activities
- Run known-good activity
- Check: `verdict === "correct" && confidence > 0.8` ✅

**Metric 3**: Provides actionable diagnostics
- Review issues array
- Check: Suggestions are clear and helpful ✅

**Metric 4**: Doesn't break existing system
- Old activities still load ✅
- Old activities get `verdict: "unknown"` ✅
- New activities get full evidence ✅

---

## Part 8: Next Steps

### Immediate (This Session)

1. ✅ Design complete
2. Create schema definition files
3. Identify exact code insertion points

### Short Term (Next Session)

1. Implement Phase 1: Schema enhancement
2. Add basic session tracking
3. Test with ground truth activity

### Medium Term (Week 1-2)

1. Full evidence collection
2. Verdict computation
3. Diagnostic tools

---

**Status**: 🟢 Design complete, ready for implementation  
**Next**: Create schema definition files and identify code insertion points
