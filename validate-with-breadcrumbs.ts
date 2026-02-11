#!/usr/bin/env bun
/**
 * Activity Execution Validator - Breadcrumb Edition
 * 
 * Validates activity execution by parsing breadcrumb logs.
 * Detects where execution broke by finding stages that ENTER but never EXIT.
 */

import { readFileSync, existsSync } from "fs"
import { join } from "path"

interface StageInfo {
  id: string
  name: string
  entered: boolean
  exited: boolean
  failed: boolean
  enterLine?: string
  exitLine?: string
  errorLine?: string
}

interface ExecutionFlow {
  correlationId: string
  stages: StageInfo[]
  completed: boolean
  failed: boolean
  error?: string
  breakPoint?: StageInfo
}

function parseExecutionFlow(logLines: string[], correlationId?: string): ExecutionFlow[] {
  const executions = new Map<string, ExecutionFlow>()

  for (const line of logLines) {
    // Extract correlation ID from log line
    const corrMatch = line.match(/correlationId[=:"]\s*([a-zA-Z0-9_-]+)/)
    if (!corrMatch) continue

    const corrId = corrMatch[1]
    
    // If filtering for specific correlationId, skip others
    if (correlationId && corrId !== correlationId) continue

    // Get or create execution flow
    if (!executions.has(corrId)) {
      executions.set(corrId, {
        correlationId: corrId,
        stages: [],
        completed: false,
        failed: false
      })
    }

    const flow = executions.get(corrId)!

    // Parse stage markers
    const stageMatch = line.match(/\[STAGE:(\d+)\]\s+([^\s|]+)\s+\|\s+(ENTER|EXIT|ERROR)/)
    if (stageMatch) {
      const [, id, name, action] = stageMatch

      if (action === "ENTER") {
        // Check if stage already exists
        let stage = flow.stages.find(s => s.id === id && s.name === name)
        if (!stage) {
          stage = { id, name, entered: false, exited: false, failed: false }
          flow.stages.push(stage)
        }
        stage.entered = true
        stage.enterLine = line.slice(0, 120)
      } else if (action === "EXIT") {
        const stage = flow.stages.find(s => s.id === id && s.name === name)
        if (stage) {
          stage.exited = true
          stage.exitLine = line.slice(0, 120)
        }
      } else if (action === "ERROR") {
        const stage = flow.stages.find(s => s.id === id && s.name === name)
        if (stage) {
          stage.failed = true
          stage.errorLine = line.slice(0, 120)
        }
        flow.failed = true
        const errorMatch = line.match(/error[:"]\s*([^"]+)/)
        if (errorMatch) flow.error = errorMatch[1]
      }
    }

    // Parse completion markers
    if (/✅.*EXECUTION COMPLETE/.test(line)) {
      flow.completed = true
    }
    if (/❌.*EXECUTION FAILED/.test(line)) {
      flow.failed = true
      const errorMatch = line.match(/error[:"]\s*([^"]+)/)
      if (errorMatch) flow.error = errorMatch[1]
    }
  }

  // Find break points for each execution
  for (const flow of executions.values()) {
    flow.breakPoint = flow.stages.find(s => s.entered && !s.exited && !s.failed)
  }

  return Array.from(executions.values())
}

function printExecutionReport(flows: ExecutionFlow[]): void {
  console.log("\n" + "=".repeat(70))
  console.log("ACTIVITY EXECUTION ANALYSIS - BREADCRUMB VALIDATOR")
  console.log("=".repeat(70))

  if (flows.length === 0) {
    console.log("\n❌ NO EXECUTIONS FOUND")
    console.log("\nNo correlation IDs detected in logs.")
    console.log("This means:")
    console.log("  1. No activity executions have run, OR")
    console.log("  2. Breadcrumb logging not yet implemented")
    console.log("\n" + "=".repeat(70) + "\n")
    return
  }

  console.log(`\nFound ${flows.length} execution(s)\n`)

  for (const flow of flows) {
    console.log("─".repeat(70))
    console.log(`Execution: ${flow.correlationId}`)
    console.log("─".repeat(70))

    if (flow.stages.length === 0) {
      console.log("⚠️  No stages detected (breadcrumbs not implemented?)")
      continue
    }

    // Print stage progression
    console.log("\nStage Progression:")
    for (const stage of flow.stages) {
      const status = stage.failed ? "🔴 FAILED" :
                     stage.exited ? "🟢 COMPLETED" :
                     stage.entered ? "🔵 IN PROGRESS" :
                     "⚪ NOT STARTED"
      
      console.log(`  [${stage.id}] ${stage.name.padEnd(25)} ${status}`)
      
      if (stage.enterLine) {
        console.log(`      ↳ ${stage.enterLine}`)
      }
      if (stage.errorLine) {
        console.log(`      ↳ ${stage.errorLine}`)
      }
    }

    // Overall status
    console.log("\nExecution Status:")
    if (flow.completed) {
      console.log("  ✅ COMPLETED SUCCESSFULLY")
    } else if (flow.failed) {
      console.log("  ❌ FAILED")
      if (flow.error) {
        console.log(`  Error: ${flow.error}`)
      }
    } else if (flow.breakPoint) {
      console.log("  ⚠️  INCOMPLETE (execution stopped)")
    } else {
      console.log("  ⚠️  UNKNOWN (no completion marker)")
    }

    // Break point analysis
    if (flow.breakPoint) {
      console.log("\n🔍 BREAK POINT DETECTED:")
      console.log(`  Stage: [${flow.breakPoint.id}] ${flow.breakPoint.name}`)
      console.log(`  Status: Entered but never exited`)
      console.log(`  This is where execution got stuck or failed`)
      
      if (flow.breakPoint.enterLine) {
        console.log(`\n  Last known activity:`)
        console.log(`    ${flow.breakPoint.enterLine}`)
      }

      // Suggest investigation steps
      console.log(`\n  Investigation steps:`)
      console.log(`    1. Search logs for errors after this stage:`)
      console.log(`       grep -A 20 "STAGE:${flow.breakPoint.id}.*ENTER.*${flow.correlationId}" logs`)
      console.log(`    2. Check if stage implementation has proper EXIT logging`)
      console.log(`    3. Look for uncaught exceptions in stage ${flow.breakPoint.id}`)
    }

    console.log("")
  }

  console.log("=".repeat(70) + "\n")
}

// ===== MAIN =====

async function main() {
  const logPath = process.argv[2] || join(process.cwd(), ".metabob", "logs", "core.log")
  const correlationId = process.argv[3] // Optional: filter for specific execution

  console.log("=== Breadcrumb Validator ===\n")
  console.log(`Log file: ${logPath}`)
  console.log(`Filter: ${correlationId || "all executions"}`)

  if (!existsSync(logPath)) {
    console.error(`\n❌ Log file not found: ${logPath}`)
    console.error("\nUsage:")
    console.error("  bun run validate-with-breadcrumbs.ts [log-path] [correlation-id]")
    console.error("\nExample:")
    console.error("  bun run validate-with-breadcrumbs.ts .metabob/logs/core.log")
    console.error("  bun run validate-with-breadcrumbs.ts .metabob/logs/core.log exec_abc123")
    process.exit(1)
  }

  const logContent = readFileSync(logPath, "utf-8")
  const logLines = logContent.split("\n")

  console.log(`Log lines: ${logLines.length}\n`)

  const flows = parseExecutionFlow(logLines, correlationId)
  printExecutionReport(flows)

  // Exit code based on results
  if (flows.length === 0) {
    process.exit(2) // No executions found
  }

  const hasFailures = flows.some(f => f.failed || f.breakPoint)
  process.exit(hasFailures ? 1 : 0)
}

main().catch(error => {
  console.error("\n❌ Validator crashed:", error)
  process.exit(3)
})
