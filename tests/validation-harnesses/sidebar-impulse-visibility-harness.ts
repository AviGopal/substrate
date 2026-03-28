/**
 * Validation Harness: sidebar-impulse-visibility
 * 
 * Tests TUI sidebar display of real-time impulse loading state and activity progress tracking.
 * 
 * Validation Strategy:
 * 1. Create a test activity with 4-5 impulses (different priorities)
 * 2. Monitor sidebar state transitions as impulses load
 * 3. Verify progress bars, task counters, and warnings
 * 4. Compare actual outputs against expected states
 */

import { Session } from "../../repos/metabob-opencode/packages/opencode/src/session"
import { SessionMemory } from "../../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { Activity } from "../../repos/metabob-opencode/packages/opencode/src/session/activity"
import { ActivityTemplate } from "../../repos/metabob-opencode/packages/opencode/src/session/activity-template"
import { SessionState } from "../../repos/metabob-opencode/packages/opencode/src/session/session-state"
import { Storage } from "../../repos/metabob-opencode/packages/opencode/src/storage/storage"

// ============================================================================
// Types
// ============================================================================

export interface ValidationInput {
  testName: string
  impulseCount: number
  impulsePriorities: Array<"high" | "medium" | "low">
  impulseBudgets: number[]
  taskCount: number
  expectedProgressSteps: number[]
}

export interface ValidationOutput {
  pass: boolean
  actual: SidebarSnapshot[]
  expected: SidebarSnapshot[]
  errors: string[]
}

export interface SidebarSnapshot {
  timestamp: number
  impulses: {
    loaded: number
    total: number
    utilization: number
  }
  tokens: {
    used: number
    total: number
  }
  activities: Array<{
    title: string
    status: string
    progress: {
      current: number
      total: number
      percentage: number
    }
    elapsedMs: number
  }>
  warnings: {
    memoryWarning: boolean
    heapWarning: boolean
  }
}

// ============================================================================
// Validation Harness
// ============================================================================

export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  const actualSnapshots: SidebarSnapshot[] = []
  const expectedSnapshots: SidebarSnapshot[] = []
  
  let sessionID: string | null = null
  let activityID: string | null = null

  try {
    // Step 1: Create test session
    const session = await Session.create({
      id: `test-sidebar-val-${Date.now()}`,
      title: `Sidebar Validation: ${input.testName}`,
      agent: "general",
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    })
    sessionID = session.id

    // Step 2: Create impulses with varying priorities
    const impulses: ActivityTemplate.Impulse.Schema[] = []
    for (let i = 0; i < input.impulseCount; i++) {
      const impulse: ActivityTemplate.Impulse.Schema = {
        id: `test-impulse-${i}`,
        type: "memo",
        pointer: {
          type: "memo",
          content: `Test impulse ${i} content`.repeat(100), // ~2000 chars
        },
        budget: input.impulseBudgets[i] || 1000,
        priority: input.impulsePriorities[i] || "medium",
        loaded: false,
      }
      impulses.push(impulse)
      
      // Add to session memory
      await SessionMemory.createImpulse(sessionID, impulse)
    }

    // Step 3: Capture initial snapshot (no impulses loaded)
    expectedSnapshots.push({
      timestamp: 0,
      impulses: { loaded: 0, total: input.impulseCount, utilization: 0 },
      tokens: { used: 0, total: impulses.reduce((sum, i) => sum + i.budget, 0) },
      activities: [],
      warnings: { memoryWarning: false, heapWarning: false },
    })
    actualSnapshots.push(await captureSnapshot(sessionID))

    // Step 4: Load high-priority impulses
    let loadedCount = 0
    let usedTokens = 0
    for (let i = 0; i < impulses.length; i++) {
      if (impulses[i].priority === "high") {
        await SessionMemory.loadImpulse(sessionID, impulses[i].id)
        loadedCount++
        usedTokens += impulses[i].budget
      }
    }
    
    if (loadedCount > 0) {
      const totalBudget = impulses.reduce((sum, i) => sum + i.budget, 0)
      expectedSnapshots.push({
        timestamp: 1,
        impulses: { 
          loaded: loadedCount, 
          total: input.impulseCount, 
          utilization: (usedTokens / totalBudget) * 100 
        },
        tokens: { used: usedTokens, total: totalBudget },
        activities: [],
        warnings: { 
          memoryWarning: (usedTokens / totalBudget) >= 0.85, 
          heapWarning: false 
        },
      })
      actualSnapshots.push(await captureSnapshot(sessionID))
    }

    // Step 5: Load medium-priority impulses
    for (let i = 0; i < impulses.length; i++) {
      if (impulses[i].priority === "medium") {
        await SessionMemory.loadImpulse(sessionID, impulses[i].id)
        loadedCount++
        usedTokens += impulses[i].budget
      }
    }
    
    const totalBudget = impulses.reduce((sum, i) => sum + i.budget, 0)
    expectedSnapshots.push({
      timestamp: 2,
      impulses: { 
        loaded: loadedCount, 
        total: input.impulseCount, 
        utilization: (usedTokens / totalBudget) * 100 
      },
      tokens: { used: usedTokens, total: totalBudget },
      activities: [],
      warnings: { 
        memoryWarning: (usedTokens / totalBudget) >= 0.85, 
        heapWarning: false 
      },
    })
    actualSnapshots.push(await captureSnapshot(sessionID))

    // Step 6: Create test activity to track progress
    const template: ActivityTemplate.CreateOptions = {
      name: `Test Activity: ${input.testName}`,
      description: "Test activity for sidebar validation",
      category: "feature",
      tasks: input.expectedProgressSteps.map((_, idx) => ({
        id: `task-${idx}`,
        subagent: "general",
        description: `Test task ${idx}`,
        dependencies: idx > 0 ? [`task-${idx - 1}`] : [],
        prompt: {
          template: `Execute test task ${idx}`,
          maxTokens: 1000,
          compressionStrategy: "filter" as const,
          variables: [],
        },
        validation: {
          requiredFiles: [],
          requiredPatterns: [],
          forbiddenPatterns: [],
          commands: [],
        },
        retry: {
          maxAttempts: 1,
          strategy: "simple" as const,
        },
      })),
      integration: {
        preChecks: [],
        postChecks: [],
        qualityGates: [],
      },
    }

    // Note: We can't fully execute activities in a validation harness without an LLM
    // Instead, we'll simulate activity state changes
    activityID = `test-activity-${Date.now()}`
    const activityInfo: Activity.Info = {
      id: activityID,
      sessionID,
      templateId: "test-template",
      variables: {},
      status: "executing",
      prompts: template.tasks.map((task, idx) => ({
        id: task.id,
        status: idx === 0 ? "executing" : "pending",
        taskId: task.id,
        attempt: 1,
        tokenUsage: { input: 0, output: 0, cache: { read: 0, write: 0 } },
        cost: 0,
      })),
      startedAt: Date.now(),
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    }

    // Save activity to storage
    await Storage.write(["activity", activityID], activityInfo)

    // Step 7: Simulate activity progress through task completion
    for (let taskIdx = 0; taskIdx < input.taskCount; taskIdx++) {
      // Mark current task as committed
      activityInfo.prompts[taskIdx].status = "committed"
      
      // Mark next task as executing (if exists)
      if (taskIdx + 1 < input.taskCount) {
        activityInfo.prompts[taskIdx + 1].status = "executing"
      }
      
      // Update activity status
      const completedTasks = activityInfo.prompts.filter(p => p.status === "committed").length
      if (completedTasks === input.taskCount) {
        activityInfo.status = "done"
      } else if (completedTasks === input.taskCount - 1) {
        activityInfo.status = "completing"
      }

      await Storage.write(["activity", activityID], activityInfo)

      // Capture snapshot at each progress step
      const progress = (completedTasks / input.taskCount) * 100
      expectedSnapshots.push({
        timestamp: 3 + taskIdx,
        impulses: { 
          loaded: loadedCount, 
          total: input.impulseCount, 
          utilization: (usedTokens / totalBudget) * 100 
        },
        tokens: { used: usedTokens, total: totalBudget },
        activities: [{
          title: activityInfo.id,
          status: activityInfo.status,
          progress: {
            current: completedTasks,
            total: input.taskCount,
            percentage: Math.round(progress),
          },
          elapsedMs: Date.now() - activityInfo.startedAt,
        }],
        warnings: { 
          memoryWarning: (usedTokens / totalBudget) >= 0.85, 
          heapWarning: false 
        },
      })
      actualSnapshots.push(await captureSnapshot(sessionID))

      // Small delay to simulate real execution
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Step 8: Compare snapshots
    const comparison = compareSnapshots(actualSnapshots, expectedSnapshots)
    errors.push(...comparison.errors)

    return {
      pass: errors.length === 0,
      actual: actualSnapshots,
      expected: expectedSnapshots,
      errors,
    }

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)
    return {
      pass: false,
      actual: actualSnapshots,
      expected: expectedSnapshots,
      errors,
    }
  } finally {
    // Cleanup: Remove test session and activity
    if (sessionID) {
      try {
        await Storage.delete(["session", sessionID])
        await Storage.delete(["session-memory", sessionID])
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (activityID) {
      try {
        await Storage.delete(["activity", activityID])
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function captureSnapshot(sessionID: string): Promise<SidebarSnapshot> {
  // Fetch session state (same as TUI sidebar)
  const state = await SessionState.get(sessionID)

  return {
    timestamp: Date.now(),
    impulses: {
      loaded: state.impulses.loadedCount,
      total: state.impulses.impulseCount,
      utilization: state.impulses.utilization,
    },
    tokens: {
      used: state.impulses.usedTokens,
      total: state.impulses.totalBudget,
    },
    activities: state.activities.activeActivities.map(act => ({
      title: act.title,
      status: act.status,
      progress: {
        current: act.progress.current,
        total: act.progress.total,
        percentage: act.progress.percentage,
      },
      elapsedMs: act.elapsedMs,
    })),
    warnings: {
      memoryWarning: state.impulses.utilization >= 85,
      heapWarning: (state.memoryManagement.heapUsedMB / state.memoryManagement.heapTotalMB) * 100 >= 80,
    },
  }
}

function compareSnapshots(
  actual: SidebarSnapshot[], 
  expected: SidebarSnapshot[]
): { errors: string[] } {
  const errors: string[] = []

  if (actual.length !== expected.length) {
    errors.push(`Snapshot count mismatch: expected ${expected.length}, got ${actual.length}`)
    return { errors }
  }

  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i]
    const act = actual[i]

    // Check impulse counts
    if (act.impulses.loaded !== exp.impulses.loaded) {
      errors.push(`Snapshot ${i}: impulses.loaded mismatch - expected ${exp.impulses.loaded}, got ${act.impulses.loaded}`)
    }
    if (act.impulses.total !== exp.impulses.total) {
      errors.push(`Snapshot ${i}: impulses.total mismatch - expected ${exp.impulses.total}, got ${act.impulses.total}`)
    }

    // Check utilization (allow 1% tolerance due to rounding)
    if (Math.abs(act.impulses.utilization - exp.impulses.utilization) > 1) {
      errors.push(`Snapshot ${i}: impulses.utilization mismatch - expected ${exp.impulses.utilization}%, got ${act.impulses.utilization}%`)
    }

    // Check token counts
    if (act.tokens.used !== exp.tokens.used) {
      errors.push(`Snapshot ${i}: tokens.used mismatch - expected ${exp.tokens.used}, got ${act.tokens.used}`)
    }
    if (act.tokens.total !== exp.tokens.total) {
      errors.push(`Snapshot ${i}: tokens.total mismatch - expected ${exp.tokens.total}, got ${act.tokens.total}`)
    }

    // Check activity count
    if (act.activities.length !== exp.activities.length) {
      errors.push(`Snapshot ${i}: activity count mismatch - expected ${exp.activities.length}, got ${act.activities.length}`)
    }

    // Check activity progress (if activities exist)
    for (let j = 0; j < Math.min(act.activities.length, exp.activities.length); j++) {
      const expAct = exp.activities[j]
      const actAct = act.activities[j]

      if (actAct.status !== expAct.status) {
        errors.push(`Snapshot ${i}, Activity ${j}: status mismatch - expected ${expAct.status}, got ${actAct.status}`)
      }
      if (actAct.progress.current !== expAct.progress.current) {
        errors.push(`Snapshot ${i}, Activity ${j}: progress.current mismatch - expected ${expAct.progress.current}, got ${actAct.progress.current}`)
      }
      if (actAct.progress.total !== expAct.progress.total) {
        errors.push(`Snapshot ${i}, Activity ${j}: progress.total mismatch - expected ${expAct.progress.total}, got ${actAct.progress.total}`)
      }
    }

    // Check warnings
    if (act.warnings.memoryWarning !== exp.warnings.memoryWarning) {
      errors.push(`Snapshot ${i}: memoryWarning mismatch - expected ${exp.warnings.memoryWarning}, got ${act.warnings.memoryWarning}`)
    }
  }

  return { errors }
}

// ============================================================================
// Test Cases (Historical - can be run without LLM)
// ============================================================================

export const testCases: Record<string, ValidationInput> = {
  "case-1-basic-impulse-loading": {
    testName: "Basic Impulse Loading",
    impulseCount: 4,
    impulsePriorities: ["high", "high", "medium", "low"],
    impulseBudgets: [1000, 1000, 1000, 1000],
    taskCount: 0,
    expectedProgressSteps: [],
  },
  "case-2-activity-progress": {
    testName: "Activity Progress Tracking",
    impulseCount: 3,
    impulsePriorities: ["high", "medium", "low"],
    impulseBudgets: [1000, 1000, 1000],
    taskCount: 5,
    expectedProgressSteps: [0, 20, 40, 60, 80, 100],
  },
  "case-3-warning-thresholds": {
    testName: "Warning Thresholds (85%)",
    impulseCount: 4,
    impulsePriorities: ["high", "high", "high", "low"],
    impulseBudgets: [3000, 3000, 3000, 1000], // Total: 10000, 3 high = 9000 = 90% utilization
    taskCount: 0,
    expectedProgressSteps: [],
  },
  "case-4-incremental-loading": {
    testName: "Incremental Loading (0->2->3 loaded)",
    impulseCount: 5,
    impulsePriorities: ["high", "high", "medium", "low", "low"],
    impulseBudgets: [1000, 1000, 1000, 1000, 1000],
    taskCount: 3,
    expectedProgressSteps: [0, 33, 67, 100],
  },
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const testCase = process.argv[2] || "case-1-basic-impulse-loading"
  
  if (!testCases[testCase]) {
    console.error(`Unknown test case: ${testCase}`)
    console.error(`Available test cases: ${Object.keys(testCases).join(", ")}`)
    process.exit(1)
  }

  console.log(`Running validation: ${testCase}`)
  
  runValidation(testCases[testCase])
    .then(result => {
      console.log(`\nValidation Result: ${result.pass ? "PASS" : "FAIL"}`)
      console.log(`Snapshots captured: ${result.actual.length}`)
      
      if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`)
        result.errors.forEach(err => console.log(`  - ${err}`))
      }

      console.log(`\nExpected Snapshots:`)
      result.expected.forEach((snap, idx) => {
        console.log(`  ${idx}: impulses=${snap.impulses.loaded}/${snap.impulses.total}, ` +
                    `utilization=${snap.impulses.utilization.toFixed(1)}%, ` +
                    `activities=${snap.activities.length}, ` +
                    `warnings=${snap.warnings.memoryWarning ? "YES" : "NO"}`)
      })

      console.log(`\nActual Snapshots:`)
      result.actual.forEach((snap, idx) => {
        console.log(`  ${idx}: impulses=${snap.impulses.loaded}/${snap.impulses.total}, ` +
                    `utilization=${snap.impulses.utilization.toFixed(1)}%, ` +
                    `activities=${snap.activities.length}, ` +
                    `warnings=${snap.warnings.memoryWarning ? "YES" : "NO"}`)
      })

      process.exit(result.pass ? 0 : 1)
    })
    .catch(error => {
      console.error(`Validation failed: ${error}`)
      process.exit(1)
    })
}
