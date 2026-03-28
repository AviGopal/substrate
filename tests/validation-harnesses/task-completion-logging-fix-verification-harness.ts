#!/usr/bin/env node
/**
 * Validation Harness: Task Completion Logging Fix Verification
 * 
 * Validates that commit dab595c1 fixed the bug where taskResult.metadata.sessionId
 * was undefined, preventing task completion logs and session tracking.
 * 
 * Test Strategy:
 * 1. Execute a multi-task activity (7 tasks from trace-enforce-validate-loop)
 * 2. Parse logs for "Task completed:" entries
 * 3. Load activity storage JSON and verify sessionsSpawned array
 * 4. Verify each session has required fields
 * 5. Compare with previous broken activities (act_mmliyv8s, act_mmln210z)
 * 
 * Success Criteria:
 * - All 7 "Task completed:" logs appear with proper metadata
 * - sessionsSpawned.length === 7
 * - Each session has: taskId, sessionID, duration, cost
 * - Correctness verdict is NOT "incorrect"
 * - Improvement over previous activities (0 sessions → 7 sessions)
 */

import * as fs from "fs"
import * as path from "path"

interface ValidationResult {
  pass: boolean
  actual: ValidationActual
  expected: ValidationExpected
  details: ValidationDetails
  timestamp: number
}

interface ValidationActual {
  taskCompletionLogsCount: number
  taskCompletionLogs: TaskCompletionLog[]
  sessionsSpawnedCount: number
  sessionsSpawned: SessionEntry[]
  correctnessVerdict: string
  activityStatus: string
  activityId: string
  hasStorageFile: boolean
}

interface ValidationExpected {
  taskCompletionLogsCount: number
  sessionsSpawnedCount: number
  requiredSessionFields: string[]
  forbiddenCorrectnessVerdicts: string[]
  minimumImprovementOverBrokenActivities: number
}

interface ValidationDetails {
  checks: ValidationCheck[]
  summary: string
  comparisonWithBrokenActivities: ComparisonResult
}

interface ValidationCheck {
  name: string
  pass: boolean
  message: string
  expected?: any
  actual?: any
}

interface TaskCompletionLog {
  taskId: string
  description: string
  duration: number
  cost: number
  success: boolean
  timestamp: string
}

interface SessionEntry {
  sessionID: string
  taskId: string
  agentType: string
  startTime: number
  endTime: number
  messageCount: number
  toolCallCount: number
  duration?: number
  cost?: number
}

interface ComparisonResult {
  brokenActivities: {
    activityId: string
    sessionsTracked: number
    taskCompletionLogs: number
  }[]
  currentActivity: {
    activityId: string
    sessionsTracked: number
    taskCompletionLogs: number
  }
  improvement: {
    sessionsDelta: number
    logsDelta: number
    percentImprovement: number
  }
}

const REQUIRED_SESSION_FIELDS = [
  "sessionID",
  "taskId",
  "agentType",
  "startTime",
  "endTime",
  "messageCount",
  "toolCallCount",
  "duration",
  "cost",
]

const BROKEN_ACTIVITIES = [
  { id: "act_mmliyv8s", sessionsTracked: 0, taskCompletionLogs: 0 },
  { id: "act_mmln210z", sessionsTracked: 0, taskCompletionLogs: 0 },
]

/**
 * Parse task completion logs from log file
 */
function parseTaskCompletionLogs(logContent: string): TaskCompletionLog[] {
  const logs: TaskCompletionLog[] = []
  const lines = logContent.split("\n")

  for (const line of lines) {
    if (line.includes("Task completed:")) {
      try {
        // Extract JSON metadata from log line
        const jsonMatch = line.match(/\{.*\}/)
        if (jsonMatch) {
          const metadata = JSON.parse(jsonMatch[0])
          logs.push({
            taskId: metadata.taskId || "unknown",
            description: metadata.description || "",
            duration: metadata.duration || 0,
            cost: metadata.cost || 0,
            success: metadata.success !== false,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (error) {
        // Skip malformed log lines
        continue
      }
    }
  }

  return logs
}

/**
 * Load activity storage JSON and extract sessionsSpawned
 */
function loadActivityStorage(activityId: string, repoPath: string): any {
  const storagePath = path.join(
    repoPath,
    ".opencode",
    "storage",
    "activity",
    `${activityId}.json`
  )

  if (!fs.existsSync(storagePath)) {
    return null
  }

  try {
    const content = fs.readFileSync(storagePath, "utf-8")
    return JSON.parse(content)
  } catch (error) {
    console.error(`Failed to parse activity storage: ${error}`)
    return null
  }
}

/**
 * Verify session entry has all required fields
 */
function verifySessionEntry(session: any): ValidationCheck[] {
  const checks: ValidationCheck[] = []

  for (const field of REQUIRED_SESSION_FIELDS) {
    const hasField = field in session && session[field] !== undefined
    checks.push({
      name: `Session has field: ${field}`,
      pass: hasField,
      message: hasField
        ? `✅ Field '${field}' present`
        : `❌ Field '${field}' missing`,
      expected: "present",
      actual: hasField ? "present" : "missing",
    })
  }

  return checks
}

/**
 * Compare with broken activities to verify improvement
 */
function compareWithBrokenActivities(
  currentSessionsCount: number,
  currentLogsCount: number,
  currentActivityId: string
): ComparisonResult {
  const brokenAvgSessions =
    BROKEN_ACTIVITIES.reduce((sum, a) => sum + a.sessionsTracked, 0) /
    BROKEN_ACTIVITIES.length
  const brokenAvgLogs =
    BROKEN_ACTIVITIES.reduce((sum, a) => sum + a.taskCompletionLogs, 0) /
    BROKEN_ACTIVITIES.length

  const sessionsDelta = currentSessionsCount - brokenAvgSessions
  const logsDelta = currentLogsCount - brokenAvgLogs

  return {
    brokenActivities: BROKEN_ACTIVITIES.map((a) => ({
      activityId: a.id,
      sessionsTracked: a.sessionsTracked,
      taskCompletionLogs: a.taskCompletionLogs,
    })),
    currentActivity: {
      activityId: currentActivityId,
      sessionsTracked: currentSessionsCount,
      taskCompletionLogs: currentLogsCount,
    },
    improvement: {
      sessionsDelta,
      logsDelta,
      percentImprovement:
        brokenAvgSessions === 0
          ? currentSessionsCount > 0
            ? 100
            : 0
          : ((currentSessionsCount - brokenAvgSessions) / brokenAvgSessions) *
            100,
    },
  }
}

/**
 * Main validation function
 */
export function runValidation(input: {
  activityId: string
  logFilePath: string
  repoPath: string
  expectedTaskCount: number
}): ValidationResult {
  const checks: ValidationCheck[] = []

  // Expected values
  const expected: ValidationExpected = {
    taskCompletionLogsCount: input.expectedTaskCount,
    sessionsSpawnedCount: input.expectedTaskCount,
    requiredSessionFields: REQUIRED_SESSION_FIELDS,
    forbiddenCorrectnessVerdicts: ["incorrect"],
    minimumImprovementOverBrokenActivities: input.expectedTaskCount,
  }

  // Initialize actual values
  const actual: ValidationActual = {
    taskCompletionLogsCount: 0,
    taskCompletionLogs: [],
    sessionsSpawnedCount: 0,
    sessionsSpawned: [],
    correctnessVerdict: "unknown",
    activityStatus: "unknown",
    activityId: input.activityId,
    hasStorageFile: false,
  }

  // Check 1: Parse task completion logs
  try {
    if (fs.existsSync(input.logFilePath)) {
      const logContent = fs.readFileSync(input.logFilePath, "utf-8")
      actual.taskCompletionLogs = parseTaskCompletionLogs(logContent)
      actual.taskCompletionLogsCount = actual.taskCompletionLogs.length

      checks.push({
        name: "Task completion logs count",
        pass: actual.taskCompletionLogsCount === expected.taskCompletionLogsCount,
        message:
          actual.taskCompletionLogsCount === expected.taskCompletionLogsCount
            ? `✅ Found ${actual.taskCompletionLogsCount} task completion logs`
            : `❌ Expected ${expected.taskCompletionLogsCount} logs, found ${actual.taskCompletionLogsCount}`,
        expected: expected.taskCompletionLogsCount,
        actual: actual.taskCompletionLogsCount,
      })
    } else {
      checks.push({
        name: "Log file exists",
        pass: false,
        message: `❌ Log file not found: ${input.logFilePath}`,
        expected: "exists",
        actual: "missing",
      })
    }
  } catch (error) {
    checks.push({
      name: "Parse task completion logs",
      pass: false,
      message: `❌ Failed to parse logs: ${error}`,
    })
  }

  // Check 2: Load activity storage
  try {
    const activityData = loadActivityStorage(input.activityId, input.repoPath)

    if (activityData) {
      actual.hasStorageFile = true
      actual.activityStatus = activityData.status || "unknown"
      actual.correctnessVerdict =
        activityData.executionEvidence?.correctnessVerdict || "unknown"

      checks.push({
        name: "Activity storage file exists",
        pass: true,
        message: `✅ Activity storage loaded: ${input.activityId}`,
      })

      // Check 3: Verify sessionsSpawned array
      if (activityData.executionEvidence?.sessionsSpawned) {
        actual.sessionsSpawned = activityData.executionEvidence.sessionsSpawned
        actual.sessionsSpawnedCount = actual.sessionsSpawned.length

        checks.push({
          name: "Sessions spawned count",
          pass: actual.sessionsSpawnedCount === expected.sessionsSpawnedCount,
          message:
            actual.sessionsSpawnedCount === expected.sessionsSpawnedCount
              ? `✅ Found ${actual.sessionsSpawnedCount} tracked sessions`
              : `❌ Expected ${expected.sessionsSpawnedCount} sessions, found ${actual.sessionsSpawnedCount}`,
          expected: expected.sessionsSpawnedCount,
          actual: actual.sessionsSpawnedCount,
        })

        // Check 4: Verify each session has required fields
        for (let i = 0; i < actual.sessionsSpawned.length; i++) {
          const session = actual.sessionsSpawned[i]
          const sessionChecks = verifySessionEntry(session)
          checks.push(...sessionChecks)
        }
      } else {
        checks.push({
          name: "Sessions spawned array",
          pass: false,
          message: "❌ executionEvidence.sessionsSpawned is missing or empty",
          expected: "populated array",
          actual: "missing",
        })
      }

      // Check 5: Verify correctness verdict is not "incorrect"
      const correctnessPass = !expected.forbiddenCorrectnessVerdicts.includes(
        actual.correctnessVerdict
      )
      checks.push({
        name: "Correctness verdict",
        pass: correctnessPass,
        message: correctnessPass
          ? `✅ Correctness verdict is '${actual.correctnessVerdict}' (not 'incorrect')`
          : `❌ Correctness verdict is '${actual.correctnessVerdict}' (should not be 'incorrect')`,
        expected: "not 'incorrect'",
        actual: actual.correctnessVerdict,
      })
    } else {
      checks.push({
        name: "Activity storage file exists",
        pass: false,
        message: `❌ Activity storage not found for ${input.activityId}`,
        expected: "exists",
        actual: "missing",
      })
    }
  } catch (error) {
    checks.push({
      name: "Load activity storage",
      pass: false,
      message: `❌ Failed to load activity storage: ${error}`,
    })
  }

  // Check 6: Compare with broken activities
  const comparison = compareWithBrokenActivities(
    actual.sessionsSpawnedCount,
    actual.taskCompletionLogsCount,
    input.activityId
  )

  const improvementPass =
    comparison.improvement.sessionsDelta >=
    expected.minimumImprovementOverBrokenActivities

  checks.push({
    name: "Improvement over broken activities",
    pass: improvementPass,
    message: improvementPass
      ? `✅ Improved by ${comparison.improvement.sessionsDelta} sessions (+${comparison.improvement.percentImprovement.toFixed(0)}%)`
      : `❌ No significant improvement over broken activities`,
    expected: `>= ${expected.minimumImprovementOverBrokenActivities} sessions`,
    actual: `${comparison.improvement.sessionsDelta} sessions`,
  })

  // Calculate overall pass/fail
  const allPassed = checks.every((check) => check.pass)
  const passedCount = checks.filter((check) => check.pass).length

  const summary = allPassed
    ? `✅ ALL CHECKS PASSED (${passedCount}/${checks.length})`
    : `❌ FAILED (${passedCount}/${checks.length} checks passed)`

  return {
    pass: allPassed,
    actual,
    expected,
    details: {
      checks,
      summary,
      comparisonWithBrokenActivities: comparison,
    },
    timestamp: Date.now(),
  }
}

/**
 * CLI execution
 */
if (require.main === module) {
  const args = process.argv.slice(2)

  if (args.length < 4) {
    console.error("Usage: node harness.ts <activityId> <logFilePath> <repoPath> <expectedTaskCount>")
    process.exit(1)
  }

  const [activityId, logFilePath, repoPath, expectedTaskCountStr] = args
  const expectedTaskCount = parseInt(expectedTaskCountStr, 10)

  console.log("=".repeat(80))
  console.log("Task Completion Logging Fix Verification - Validation Harness")
  console.log("=".repeat(80))
  console.log(`Activity ID: ${activityId}`)
  console.log(`Log File: ${logFilePath}`)
  console.log(`Repo Path: ${repoPath}`)
  console.log(`Expected Task Count: ${expectedTaskCount}`)
  console.log("=".repeat(80))

  const result = runValidation({
    activityId,
    logFilePath,
    repoPath,
    expectedTaskCount,
  })

  console.log("\n📊 VALIDATION RESULTS\n")
  console.log(result.details.summary)
  console.log("\n" + "=".repeat(80))

  console.log("\n🔍 DETAILED CHECKS\n")
  for (const check of result.details.checks) {
    console.log(`${check.pass ? "✅" : "❌"} ${check.name}`)
    console.log(`   ${check.message}`)
    if (check.expected !== undefined && check.actual !== undefined) {
      console.log(`   Expected: ${JSON.stringify(check.expected)}`)
      console.log(`   Actual: ${JSON.stringify(check.actual)}`)
    }
    console.log()
  }

  console.log("=".repeat(80))
  console.log("\n📈 COMPARISON WITH BROKEN ACTIVITIES\n")
  console.log("Previous Broken Activities:")
  for (const broken of result.details.comparisonWithBrokenActivities.brokenActivities) {
    console.log(`  ${broken.activityId}: ${broken.sessionsTracked} sessions, ${broken.taskCompletionLogs} logs`)
  }
  console.log("\nCurrent Activity:")
  const current = result.details.comparisonWithBrokenActivities.currentActivity
  console.log(`  ${current.activityId}: ${current.sessionsTracked} sessions, ${current.taskCompletionLogs} logs`)
  console.log("\nImprovement:")
  const improvement = result.details.comparisonWithBrokenActivities.improvement
  console.log(`  Sessions: +${improvement.sessionsDelta}`)
  console.log(`  Logs: +${improvement.logsDelta}`)
  console.log(`  Percent: +${improvement.percentImprovement.toFixed(0)}%`)

  console.log("\n" + "=".repeat(80))
  console.log("\n🎯 FINAL RESULT\n")
  console.log(result.pass ? "✅ VALIDATION PASSED" : "❌ VALIDATION FAILED")
  console.log(`   ${result.details.checks.filter((c) => c.pass).length}/${result.details.checks.length} checks passed`)
  console.log("=".repeat(80))

  process.exit(result.pass ? 0 : 1)
}
