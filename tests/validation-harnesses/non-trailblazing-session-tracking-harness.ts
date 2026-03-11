/**
 * Validation Harness: Non-Trailblazing Session Tracking
 * 
 * Validates that activity execution tracks sessions in executionEvidence.sessionsSpawned
 * for non-trailblazing tasks (deterministic execution path) as specified in
 * TRACE_Non_Trailblazing_Session_Tracking.md and ENFORCEMENT_Non_Trailblazing_Session_Tracking.md.
 * 
 * Test Strategy:
 * 1. Execute manage-session-memory activity (5 tasks, all non-trailblazing)
 * 2. Retrieve activity from storage after completion
 * 3. Verify sessionsSpawned array has 5 entries
 * 4. Verify each entry has all 9 required fields
 * 5. Verify correctness verdict is NOT 'incorrect'
 * 6. Compare with broken activity (act_mmlph9ig) which had 0 sessions
 * 
 * Success Criteria:
 * - executionEvidence.sessionsSpawned.length === 5 (one per task)
 * - Each session entry has 9 required fields:
 *   - sessionID (string)
 *   - taskId (string)
 *   - agentType (string)
 *   - startTime (number)
 *   - endTime (number)
 *   - messageCount (number)
 *   - toolCallCount (number)
 *   - duration (number)
 *   - cost (number)
 * - correctnessVerdict.verdict !== 'incorrect'
 * - Task completion logs present (regression check)
 * 
 * Before/After Comparison:
 * - BEFORE (broken activity act_mmlph9ig): sessionsSpawned.length = 0
 * - AFTER (this test): sessionsSpawned.length = 5
 */

import { existsSync } from "fs"
import { join } from "path"
import { Activity } from "../../repos/metabob-opencode/packages/opencode/src/session/activity"

export interface ValidationInput {
  activityTemplate: string  // "manage-session-memory"
  variables: Record<string, any>
  reason: string
  skipExecution?: boolean  // If true, only check existing activity
  existingActivityId?: string  // For comparing with broken activity
}

export interface SessionEntry {
  sessionID: string
  taskId: string
  agentType: string
  startTime: number
  endTime: number
  messageCount: number
  toolCallCount: number
  duration: number
  cost: number
}

export interface ValidationOutput {
  pass: boolean
  actual: {
    activityId: string
    status: string
    sessionsSpawnedCount: number
    sessionsSpawned: SessionEntry[]
    taskCompletionLogsCount: number
    correctnessVerdict: {
      verdict: string
      confidence: number
    }
    allTasksNonTrailblazing: boolean
    missingFields: string[]
  }
  expected: {
    sessionsSpawnedCount: number  // 5
    eachSessionHasFields: string[]  // 9 required fields
    correctnessVerdictNot: string  // 'incorrect'
    taskCompletionLogsCount: number  // 5
    allTasksNonTrailblazing: boolean  // true
  }
  errors: string[]
  beforeAfterComparison?: {
    beforeActivityId: string
    beforeSessionsSpawnedCount: number
    afterActivityId: string
    afterSessionsSpawnedCount: number
    improvement: string  // "0 → 5 sessions tracked"
  }
}

/**
 * Helper to retrieve activity from storage
 */
async function getActivity(activityId: string): Promise<any> {
  try {
    const activity = await Activity.load(activityId)
    return activity
  } catch (error) {
    throw new Error(`Failed to get activity ${activityId}: ${error}`)
  }
}

/**
 * Helper to check if all required fields are present in a session entry
 */
function validateSessionEntry(entry: any): { valid: boolean; missingFields: string[] } {
  const requiredFields = [
    'sessionID',
    'taskId',
    'agentType',
    'startTime',
    'endTime',
    'messageCount',
    'toolCallCount',
    'duration',
    'cost'
  ]
  
  const missingFields = requiredFields.filter(field => !(field in entry))
  
  return {
    valid: missingFields.length === 0,
    missingFields
  }
}

/**
 * Helper to count task completion logs in dev.log
 */
async function countTaskCompletionLogs(activityId: string): Promise<number> {
  try {
    // Extract short activity ID (first part before underscore)
    const shortActivityId = activityId.split('_')[0]
    
    const logFile = join(process.cwd(), 'dev.log')
    if (!existsSync(logFile)) {
      return 0
    }
    
    const logContent = await Bun.file(logFile).text()
    const lines = logContent.split('\n')
    
    // Count lines with "Task completed:" and the activity ID
    const taskCompletionLogs = lines.filter(line => 
      line.includes('Task completed:') && 
      line.includes(`activityId=${shortActivityId}`)
    )
    
    return taskCompletionLogs.length
  } catch (error) {
    console.warn(`Failed to count task completion logs: ${error}`)
    return 0
  }
}

/**
 * Helper to execute activity and wait for completion
 * 
 * Note: This harness is designed to validate existing activities.
 * For actual execution, use the CLI: opencode activity run <template-id>
 */
async function executeActivity(
  templateId: string,
  variables: Record<string, any>,
  reason: string
): Promise<string> {
  throw new Error(
    "Direct activity execution not supported in harness. " +
    "Please execute activity via CLI and provide the activity ID using 'existingActivityId' parameter."
  )
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  let activityId: string | undefined
  
  try {
    // Step 1: Use existing activity (execution must be done via CLI)
    if (input.existingActivityId) {
      activityId = input.existingActivityId
      console.log(`Using existing activity: ${activityId}`)
    } else {
      throw new Error(
        "No activity ID provided. Please execute activity first using CLI: " +
        `opencode activity run ${input.activityTemplate} --variables '${JSON.stringify(input.variables)}' --reason '${input.reason}'`
      )
    }
    
    // Step 2: Retrieve activity from storage
    const activity = await getActivity(activityId)
    
    // Step 3: Extract actual data
    const sessionsSpawned = activity.executionEvidence?.sessionsSpawned || []
    const sessionsSpawnedCount = sessionsSpawned.length
    const correctnessVerdict = activity.correctnessVerdict || { verdict: 'unknown', confidence: 0 }
    
    // Step 4: Count task completion logs
    const taskCompletionLogsCount = await countTaskCompletionLogs(activityId)
    
    // Step 5: Validate session entries
    const allMissingFields: string[] = []
    sessionsSpawned.forEach((entry: any, index: number) => {
      const validation = validateSessionEntry(entry)
      if (!validation.valid) {
        allMissingFields.push(`Session ${index}: missing ${validation.missingFields.join(', ')}`)
      }
    })
    
    // Step 6: Check if all tasks used non-trailblazing path
    // This is implicit - if sessionsSpawned is populated for deterministic tasks, it worked
    const allTasksNonTrailblazing = true  // Assume true for manage-session-memory template
    
    // Step 7: Define expected values
    const expectedSessionsCount = 5  // manage-session-memory has 5 tasks
    const expectedFields = [
      'sessionID',
      'taskId',
      'agentType',
      'startTime',
      'endTime',
      'messageCount',
      'toolCallCount',
      'duration',
      'cost'
    ]
    
    // Step 8: Check pass/fail conditions
    let pass = true
    
    if (sessionsSpawnedCount !== expectedSessionsCount) {
      errors.push(
        `Expected ${expectedSessionsCount} sessions, got ${sessionsSpawnedCount}`
      )
      pass = false
    }
    
    if (allMissingFields.length > 0) {
      errors.push(`Missing required fields: ${allMissingFields.join('; ')}`)
      pass = false
    }
    
    if (correctnessVerdict.verdict === 'incorrect') {
      errors.push(
        `Correctness verdict is 'incorrect' (should be 'correct' or 'likely-correct')`
      )
      pass = false
    }
    
    if (taskCompletionLogsCount !== expectedSessionsCount) {
      errors.push(
        `Expected ${expectedSessionsCount} task completion logs, got ${taskCompletionLogsCount}`
      )
      pass = false
    }
    
    // Step 9: Build output
    const output: ValidationOutput = {
      pass,
      actual: {
        activityId,
        status: activity.status,
        sessionsSpawnedCount,
        sessionsSpawned,
        taskCompletionLogsCount,
        correctnessVerdict,
        allTasksNonTrailblazing,
        missingFields: allMissingFields
      },
      expected: {
        sessionsSpawnedCount: expectedSessionsCount,
        eachSessionHasFields: expectedFields,
        correctnessVerdictNot: 'incorrect',
        taskCompletionLogsCount: expectedSessionsCount,
        allTasksNonTrailblazing: true
      },
      errors
    }
    
    // Step 10: Add before/after comparison if we have a broken activity to compare
    if (input.existingActivityId === 'act_mmlph9ig_38038a63a4c5760c') {
      output.beforeAfterComparison = {
        beforeActivityId: 'act_mmlph9ig_38038a63a4c5760c',
        beforeSessionsSpawnedCount: 0,
        afterActivityId: activityId,
        afterSessionsSpawnedCount: sessionsSpawnedCount,
        improvement: `0 → ${sessionsSpawnedCount} sessions tracked`
      }
    }
    
    return output
  } catch (error) {
    errors.push(`Validation error: ${error}`)
    
    return {
      pass: false,
      actual: {
        activityId: activityId || 'unknown',
        status: 'error',
        sessionsSpawnedCount: 0,
        sessionsSpawned: [],
        taskCompletionLogsCount: 0,
        correctnessVerdict: { verdict: 'error', confidence: 0 },
        allTasksNonTrailblazing: false,
        missingFields: []
      },
      expected: {
        sessionsSpawnedCount: 5,
        eachSessionHasFields: [
          'sessionID',
          'taskId',
          'agentType',
          'startTime',
          'endTime',
          'messageCount',
          'toolCallCount',
          'duration',
          'cost'
        ],
        correctnessVerdictNot: 'incorrect',
        taskCompletionLogsCount: 5,
        allTasksNonTrailblazing: true
      },
      errors
    }
  }
}

/**
 * CLI entry point for running validation
 */
async function main() {
  console.log("Running Non-Trailblazing Session Tracking Validation Harness\n")
  
  // Get activity ID from command line argument or use default
  const activityId = process.argv[2] || process.env.ACTIVITY_ID
  
  if (!activityId) {
    console.error("Error: Activity ID required")
    console.error("\nUsage:")
    console.error("  bun run non-trailblazing-session-tracking-harness.ts <activity-id>")
    console.error("  ACTIVITY_ID=<activity-id> bun run non-trailblazing-session-tracking-harness.ts")
    console.error("\nTo execute a new activity first:")
    console.error("  opencode activity run manage-session-memory --variables '{\"maxContextTokens\":8000}' --reason 'Test'")
    process.exit(1)
  }
  
  const input: ValidationInput = {
    activityTemplate: "manage-session-memory",
    variables: {
      maxContextTokens: 8000,
      compressionStrategy: "adaptive"
    },
    reason: "Validate non-trailblazing session tracking after fix implementation",
    existingActivityId: activityId
  }
  
  const result = await runValidation(input)
  
  console.log("\n=== VALIDATION RESULTS ===\n")
  console.log(`Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Activity ID: ${result.actual.activityId}`)
  console.log(`Sessions Tracked: ${result.actual.sessionsSpawnedCount} (expected: ${result.expected.sessionsSpawnedCount})`)
  console.log(`Task Completion Logs: ${result.actual.taskCompletionLogsCount} (expected: ${result.expected.taskCompletionLogsCount})`)
  console.log(`Correctness Verdict: ${result.actual.correctnessVerdict.verdict}`)
  
  if (result.actual.missingFields.length > 0) {
    console.log(`\nMissing Fields:`)
    result.actual.missingFields.forEach(field => console.log(`  - ${field}`))
  }
  
  if (result.beforeAfterComparison) {
    console.log(`\n=== BEFORE/AFTER COMPARISON ===`)
    console.log(`Before: ${result.beforeAfterComparison.beforeActivityId} - ${result.beforeAfterComparison.beforeSessionsSpawnedCount} sessions`)
    console.log(`After: ${result.beforeAfterComparison.afterActivityId} - ${result.beforeAfterComparison.afterSessionsSpawnedCount} sessions`)
    console.log(`Improvement: ${result.beforeAfterComparison.improvement}`)
  }
  
  if (result.errors.length > 0) {
    console.log(`\n=== ERRORS ===`)
    result.errors.forEach(error => console.log(`  - ${error}`))
  }
  
  console.log("\n")
  
  process.exit(result.pass ? 0 : 1)
}

// Run validation if called directly
if (import.meta.main) {
  main()
}
