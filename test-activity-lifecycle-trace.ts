#!/usr/bin/env -S bun run

/**
 * Test script to execute create-activity-self-contained with lifecycle tracing.
 * This will generate activity-lifecycle-trace.log showing the execution order.
 */

import { SessionService } from "./repos/metabob-opencode/packages/opencode/src/session/session-service"
import { ActivityTool } from "./repos/metabob-opencode/packages/opencode/src/tool/activity"
import { existsSync, readFileSync } from "fs"

async function main() {
  console.log("Starting activity lifecycle trace test...\n")

  // Initialize services
  const sessionService = new SessionService()
  const activityTool = new ActivityTool()

  try {
    // Execute activity with tracing
    console.log("Executing create-activity-self-contained activity...")
    
    const result = await activityTool.execute({
      templateId: "create-activity-self-contained",
      variables: {
        activityName: "test-simple-feature",
        activityDescription: "A simple test activity",
        category: "feature",
        numTasks: "2"
      },
      reason: "Testing lifecycle tracing to understand task 3 failure"
    })

    console.log("\n=== Activity Result ===")
    console.log(`Status: ${result.status}`)
    console.log(`Activity ID: ${result.activityId}`)
    
    if (result.error) {
      console.log(`Error: ${result.error}`)
    }

    // Check for trace file
    console.log("\n=== Checking for trace log ===")
    const traceFile = "activity-lifecycle-trace.log"
    if (existsSync(traceFile)) {
      console.log(`Trace file found: ${traceFile}`)
      const traceContent = readFileSync(traceFile, "utf-8")
      console.log("\n=== Lifecycle Trace ===")
      console.log(traceContent)
    } else {
      console.log("⚠️  Trace file not found - tracing may not be enabled")
    }

  } catch (error) {
    console.error("Error executing activity:", error)
    process.exit(1)
  }
}

main()
