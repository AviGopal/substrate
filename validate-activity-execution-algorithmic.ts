#!/usr/bin/env bun
/**
 * Algorithmic Activity Execution Validator
 * 
 * Validates activity execution through EXTERNAL EVIDENCE ONLY:
 * 1. Log patterns (what actually happened)
 * 2. Storage state (what was persisted)
 * 3. Metrics (quantifiable outcomes)
 * 
 * NO ASSUMPTIONS - only traceable evidence.
 */

import { readFileSync, existsSync } from "fs"
import { join } from "path"

// ===== DATA FLOW CHAIN DEFINITION =====
// This is the EXPECTED behavior based on code architecture

interface FlowStep {
  position: number
  component: string
  file: string
  expectedLogs: string[]
  description: string
}

const ACTIVITY_EXECUTION_FLOW: FlowStep[] = [
  {
    position: 1,
    component: "activity tool invocation",
    file: "src/tool/activity.ts",
    expectedLogs: [
      "started activity execution via MCP",
    ],
    description: "User calls activity tool with templateId + variables"
  },
  {
    position: 2,
    component: "template loading",
    file: "src/session/activity-template-repository.ts",
    expectedLogs: [
      "loading template",
      "template loaded",
    ],
    description: "System loads template from storage"
  },
  {
    position: 3,
    component: "activity initialization",
    file: "src/session/activity.ts",
    expectedLogs: [
      "activity created",
      "activity-execution.*created",
    ],
    description: "Creates Activity.Info and persists to storage"
  },
  {
    position: 4,
    component: "session creation",
    file: "src/session/index.ts",
    expectedLogs: [
      "session created",
      "ses_.*created",
    ],
    description: "Creates session for each task execution"
  },
  {
    position: 5,
    component: "task execution",
    file: "src/session/template-executor.ts",
    expectedLogs: [
      "executing task",
      "task completed",
    ],
    description: "Executes each task with agent"
  },
  {
    position: 6,
    component: "activity completion",
    file: "src/tool/activity.ts",
    expectedLogs: [
      "activity completed successfully",
    ],
    description: "Marks activity as complete, returns result"
  },
]

// ===== LOG ANALYSIS =====

interface LogMatch {
  pattern: string
  found: boolean
  count: number
  samples: string[]
}

interface StepValidation {
  step: FlowStep
  matches: LogMatch[]
  passed: boolean
}

function analyzeLogFile(logPath: string, flowStep: FlowStep): StepValidation {
  if (!existsSync(logPath)) {
    return {
      step: flowStep,
      matches: flowStep.expectedLogs.map(pattern => ({
        pattern,
        found: false,
        count: 0,
        samples: []
      })),
      passed: false
    }
  }

  const logContent = readFileSync(logPath, "utf-8")
  const logLines = logContent.split("\n")

  const matches: LogMatch[] = flowStep.expectedLogs.map(pattern => {
    const regex = new RegExp(pattern, "i")
    const matchingLines = logLines.filter(line => regex.test(line))
    
    return {
      pattern,
      found: matchingLines.length > 0,
      count: matchingLines.length,
      samples: matchingLines.slice(0, 2) // Keep first 2 samples
    }
  })

  const passed = matches.every(m => m.found)

  return { step: flowStep, matches, passed }
}

// ===== STORAGE VALIDATION =====

interface StorageValidation {
  activityExecutionExists: boolean
  activityCount: number
  recentActivity?: any
}

async function validateStorage(): Promise<StorageValidation> {
  const storagePath = join(process.cwd(), ".metabob", "storage")
  
  if (!existsSync(storagePath)) {
    return {
      activityExecutionExists: false,
      activityCount: 0
    }
  }

  // Check for activity-execution records
  const activityExecPath = join(storagePath, "activity-execution")
  const activityExecutionExists = existsSync(activityExecPath)

  // TODO: Count actual activities (requires reading storage structure)
  
  return {
    activityExecutionExists,
    activityCount: 0, // Need to implement counting
  }
}

// ===== VALIDATION EXECUTION =====

interface ValidationReport {
  timestamp: string
  flowValidations: StepValidation[]
  storage: StorageValidation
  breakPoint: FlowStep | null
  passed: boolean
  summary: string
}

async function runValidation(): Promise<ValidationReport> {
  console.log("=== Algorithmic Activity Execution Validation ===\n")
  
  const logPath = join(process.cwd(), ".metabob", "logs", "core.log")
  console.log(`Analyzing log: ${logPath}`)
  console.log(`Log exists: ${existsSync(logPath)}\n`)

  // Validate each step in the flow
  const flowValidations = ACTIVITY_EXECUTION_FLOW.map(step => {
    return analyzeLogFile(logPath, step)
  })

  // Find first failure (break point)
  const breakPoint = flowValidations.find(v => !v.passed)?.step || null

  // Validate storage
  const storage = await validateStorage()

  // Determine if validation passed
  const passed = flowValidations.every(v => v.passed)

  // Generate summary
  let summary = ""
  if (passed) {
    summary = "✅ All steps in activity execution flow validated successfully"
  } else if (breakPoint) {
    summary = `❌ Data flow breaks at Position ${breakPoint.position}: ${breakPoint.component}`
  } else {
    summary = "⚠️  Validation inconclusive - check logs"
  }

  return {
    timestamp: new Date().toISOString(),
    flowValidations,
    storage,
    breakPoint,
    passed,
    summary
  }
}

// ===== REPORT GENERATION =====

function printReport(report: ValidationReport): void {
  console.log("\n" + "=".repeat(70))
  console.log("VALIDATION REPORT")
  console.log("=".repeat(70))
  console.log(`Timestamp: ${report.timestamp}`)
  console.log(`Status: ${report.passed ? "PASS ✅" : "FAIL ❌"}`)
  console.log(`\n${report.summary}\n`)

  console.log("─".repeat(70))
  console.log("FLOW VALIDATION DETAILS")
  console.log("─".repeat(70))

  for (const validation of report.flowValidations) {
    const status = validation.passed ? "✅ PASS" : "❌ FAIL"
    console.log(`\nPosition ${validation.step.position}: ${validation.step.component} ${status}`)
    console.log(`  File: ${validation.step.file}`)
    console.log(`  Description: ${validation.step.description}`)
    
    for (const match of validation.matches) {
      const matchStatus = match.found ? "✓" : "✗"
      console.log(`    ${matchStatus} "${match.pattern}" - Found ${match.count} times`)
      
      if (match.samples.length > 0) {
        console.log(`       Sample: ${match.samples[0].slice(0, 100)}...`)
      }
    }

    // If this is the break point, provide diagnostic info
    if (report.breakPoint && validation.step.position === report.breakPoint.position) {
      console.log("\n  ⚠️  BREAK POINT DETECTED HERE")
      console.log("  This is where the data flow breaks.")
      console.log("  Check the following:")
      console.log(`    1. Is ${validation.step.component} executing at all?`)
      console.log(`    2. Are there errors logged around this component?`)
      console.log(`    3. Did the previous step complete successfully?`)
    }
  }

  console.log("\n" + "─".repeat(70))
  console.log("STORAGE VALIDATION")
  console.log("─".repeat(70))
  console.log(`Activity execution storage exists: ${report.storage.activityExecutionExists ? "✅" : "❌"}`)
  console.log(`Activity count: ${report.storage.activityCount}`)

  console.log("\n" + "=".repeat(70))
  console.log("NEXT STEPS")
  console.log("=".repeat(70))

  if (!report.passed && report.breakPoint) {
    console.log(`\n1. Focus on: ${report.breakPoint.file}`)
    console.log(`2. Search logs for errors near: "${report.breakPoint.expectedLogs[0]}"`)
    console.log(`3. Check if previous step completed: Position ${report.breakPoint.position - 1}`)
    console.log(`\nCommand to investigate:`)
    console.log(`  grep -A 5 -B 5 "${report.breakPoint.expectedLogs[0]}" .metabob/logs/core.log`)
  } else if (report.passed) {
    console.log("\nActivity execution system is validated ✅")
    console.log("All expected log patterns found in data flow chain.")
  } else {
    console.log("\nRun a test activity execution to generate logs:")
    console.log(`  bun run test-activity-execution.ts`)
  }

  console.log("\n" + "=".repeat(70) + "\n")
}

// ===== MAIN =====

async function main() {
  const report = await runValidation()
  printReport(report)
  
  // Exit with appropriate code
  process.exit(report.passed ? 0 : 1)
}

main().catch(error => {
  console.error("Validation script failed:", error)
  process.exit(2)
})
