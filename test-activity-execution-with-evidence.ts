#!/usr/bin/env bun
/**
 * Test Activity Execution with Evidence Collection
 * 
 * This test TRIGGERS activity execution and captures evidence:
 * 1. Creates a minimal test activity template
 * 2. Executes it
 * 3. Captures logs during execution
 * 4. Reports what ACTUALLY happened (external evidence only)
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { spawn } from "child_process"

// ===== EVIDENCE COLLECTION =====

interface Evidence {
  timestamp: string
  logsBefore: string[]
  logsAfter: string[]
  newLogLines: string[]
  storageExists: boolean
  activityExecutionRecords: number
  testStatus: "success" | "failure" | "error"
  errorMessage?: string
}

async function captureLogSnapshot(logPath: string): Promise<string[]> {
  if (!existsSync(logPath)) {
    return []
  }
  
  const content = readFileSync(logPath, "utf-8")
  return content.split("\n")
}

async function executeActivityTest(): Promise<Evidence> {
  const timestamp = new Date().toISOString()
  const opencodePath = join(process.cwd(), "repos", "metabob-opencode")
  const logPath = join(opencodePath, "packages", "opencode", ".metabob", "logs", "core.log")
  
  console.log("=== Capturing Evidence: Activity Execution Test ===\n")
  console.log(`Working directory: ${opencodePath}`)
  console.log(`Log file: ${logPath}`)
  console.log(`Timestamp: ${timestamp}\n`)

  // Step 1: Capture logs BEFORE test
  console.log("📸 Capturing pre-test log snapshot...")
  const logsBefore = await captureLogSnapshot(logPath)
  console.log(`   Captured ${logsBefore.length} log lines\n`)

  // Step 2: Create test template
  console.log("📝 Creating minimal test template...")
  const templateDir = join(opencodePath, ".activity-test")
  if (!existsSync(templateDir)) {
    mkdirSync(templateDir, { recursive: true })
  }

  const templateContent = {
    name: "evidence-test-activity",
    description: "Minimal activity for evidence collection",
    category: "test",
    tasks: [
      {
        agent: "general",
        prompt: {
          system: "You are a test agent. Respond with: TEST EXECUTION EVIDENCE MARKER"
        }
      }
    ]
  }

  const templatePath = join(templateDir, "template.json")
  writeFileSync(templatePath, JSON.stringify(templateContent, null, 2))
  console.log(`   Template created: ${templatePath}\n`)

  // Step 3: Execute test via opencode CLI
  console.log("🚀 Executing activity via opencode...")
  console.log("   Command: opencode activity execute evidence-test-activity\n")

  let testStatus: "success" | "failure" | "error" = "error"
  let errorMessage: string | undefined

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "opencode",
        [
          "activity",
          "run",
          templateDir
        ],
        {
          cwd: opencodePath,
          stdio: "inherit",
          timeout: 30000
        }
      )

      child.on("close", code => {
        if (code === 0) {
          testStatus = "success"
          resolve()
        } else {
          testStatus = "failure"
          errorMessage = `Process exited with code ${code}`
          resolve() // Still resolve to collect evidence
        }
      })

      child.on("error", err => {
        testStatus = "error"
        errorMessage = err.message
        resolve() // Still resolve to collect evidence
      })
    })
  } catch (err: any) {
    testStatus = "error"
    errorMessage = err.message
  }

  // Wait for logs to flush
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Step 4: Capture logs AFTER test
  console.log("\n📸 Capturing post-test log snapshot...")
  const logsAfter = await captureLogSnapshot(logPath)
  console.log(`   Captured ${logsAfter.length} log lines`)

  // Step 5: Find NEW log lines (evidence of execution)
  const newLogLines = logsAfter.slice(logsBefore.length)
  console.log(`   NEW log lines: ${newLogLines.length}\n`)

  // Step 6: Check storage
  const storagePath = join(opencodePath, "packages", "opencode", ".metabob", "storage")
  const storageExists = existsSync(storagePath)
  
  let activityExecutionRecords = 0
  if (storageExists) {
    const activityExecPath = join(storagePath, "activity-execution")
    if (existsSync(activityExecPath)) {
      const { readdirSync } = await import("fs")
      activityExecutionRecords = readdirSync(activityExecPath).length
    }
  }

  return {
    timestamp,
    logsBefore,
    logsAfter,
    newLogLines,
    storageExists,
    activityExecutionRecords,
    testStatus,
    errorMessage
  }
}

// ===== EVIDENCE ANALYSIS =====

function analyzeEvidence(evidence: Evidence): void {
  console.log("=".repeat(70))
  console.log("EVIDENCE ANALYSIS")
  console.log("=".repeat(70))

  console.log(`\nTest Status: ${evidence.testStatus.toUpperCase()}`)
  if (evidence.errorMessage) {
    console.log(`Error: ${evidence.errorMessage}`)
  }

  console.log(`\nLog Evidence:`)
  console.log(`  Total lines before: ${evidence.logsBefore.length}`)
  console.log(`  Total lines after: ${evidence.logsAfter.length}`)
  console.log(`  NEW lines: ${evidence.newLogLines.length}`)

  console.log(`\nStorage Evidence:`)
  console.log(`  Storage exists: ${evidence.storageExists ? "✅" : "❌"}`)
  console.log(`  Activity execution records: ${evidence.activityExecutionRecords}`)

  console.log("\n" + "─".repeat(70))
  console.log("NEW LOG LINES ANALYSIS")
  console.log("─".repeat(70))

  if (evidence.newLogLines.length === 0) {
    console.log("\n❌ NO NEW LOG LINES")
    console.log("   This indicates the activity execution did NOT run or did not log anything.")
    console.log("\n   Possible causes:")
    console.log("   1. CLI command failed to invoke activity execution")
    console.log("   2. Activity system not initialized")
    console.log("   3. Logs writing to different location")
    return
  }

  // Analyze new log lines for evidence of activity execution
  const activityPatterns = [
    { name: "Activity tool invoked", pattern: /activity.*execute|started activity/i },
    { name: "Template loaded", pattern: /template.*load|loading template/i },
    { name: "Session created", pattern: /session.*created|ses_/i },
    { name: "Agent executed", pattern: /agent.*execute|executing agent/i },
    { name: "Task executed", pattern: /task.*execute|executing task/i },
    { name: "Activity completed", pattern: /activity.*complet|activity.*success/i },
  ]

  console.log("\nSearching for activity execution patterns...\n")

  let evidenceFound = false
  for (const { name, pattern } of activityPatterns) {
    const matches = evidence.newLogLines.filter(line => pattern.test(line))
    if (matches.length > 0) {
      evidenceFound = true
      console.log(`✅ ${name}:`)
      matches.slice(0, 3).forEach(line => {
        console.log(`     ${line.slice(0, 120)}...`)
      })
      if (matches.length > 3) {
        console.log(`     ... (${matches.length - 3} more matches)`)
      }
      console.log()
    } else {
      console.log(`❌ ${name}: NOT FOUND`)
    }
  }

  if (!evidenceFound) {
    console.log("\n⚠️  No activity execution patterns found in logs")
    console.log("\nShowing first 10 new log lines for manual inspection:")
    evidence.newLogLines.slice(0, 10).forEach((line, i) => {
      console.log(`${i + 1}. ${line}`)
    })
  }

  console.log("\n" + "=".repeat(70))
  console.log("CONCLUSION")
  console.log("=".repeat(70))

  if (evidence.testStatus === "success" && evidence.activityExecutionRecords > 0) {
    console.log("\n✅ ACTIVITY EXECUTION VALIDATED")
    console.log("   Evidence confirms activity execution completed successfully.")
  } else if (evidence.testStatus === "success" && evidenceFound) {
    console.log("\n⚠️  ACTIVITY EXECUTION PARTIAL")
    console.log("   Some execution evidence found but no storage records.")
    console.log("   Activity may have started but not completed.")
  } else if (evidence.testStatus === "failure") {
    console.log("\n❌ ACTIVITY EXECUTION FAILED")
    console.log("   CLI execution failed. Check error message above.")
  } else {
    console.log("\n❌ ACTIVITY EXECUTION NOT VALIDATED")
    console.log("   No evidence of activity execution found.")
    console.log("   The activity system may not be working.")
  }

  console.log("\n" + "=".repeat(70) + "\n")
}

// ===== MAIN =====

async function main() {
  try {
    const evidence = await executeActivityTest()
    
    // Write evidence to file
    const evidencePath = join(process.cwd(), "activity-execution-evidence.json")
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2))
    console.log(`\n💾 Evidence saved to: ${evidencePath}\n`)
    
    // Analyze evidence
    analyzeEvidence(evidence)
    
    // Exit with appropriate code
    const success = evidence.testStatus === "success" && evidence.activityExecutionRecords > 0
    process.exit(success ? 0 : 1)
  } catch (err) {
    console.error("\n❌ Test execution failed:", err)
    process.exit(2)
  }
}

main()
