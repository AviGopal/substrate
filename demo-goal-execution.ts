#!/usr/bin/env bun

/**
 * Goal Execution Demo
 * 
 * Demonstrates the new goal-driven architecture:
 * 1. User submits natural language goal
 * 2. Backend recommends activities (Thompson Sampling)
 * 3. Minibob executes activities in sequence
 * 4. Results displayed and tracked in dashboard
 * 
 * Watch execution at: http://dashboard.minibob.local
 */

import { MinibobIntegration } from "./repos/metabob-opencode/packages/opencode/src/minibob-integration"
import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"

async function main() {
  // Initialize instance context (required for config access)
  await Instance.provide({
    directory: process.cwd(),
    fn: executeGoalDemo,
  })
}

async function executeGoalDemo() {
  console.log("=" .repeat(70))
  console.log("🎯 Minibob Goal Execution Demo")
  console.log("=".repeat(70))
  console.log()
  console.log("📊 Dashboard: http://dashboard.minibob.local")
  console.log()

  // Create session
  const sessionID = `demo-goal-${Date.now()}`
  console.log(`Session ID: ${sessionID}`)
  console.log()

  try {
    // Initialize minibob
    console.log("🔧 Initializing minibob...")
    await MinibobIntegration.initialize(sessionID)
    console.log("✅ Minibob initialized")
    console.log()

    // Define goal
    const goal = "Add a subtract function to the calculator"
    const context = {
      files: ["calculator.ts"],
      functionName: "subtract",
      description: "Subtracts two numbers and returns the result",
    }

    console.log("🎯 Submitting goal:")
    console.log(`   "${goal}"`)
    console.log()
    console.log("📋 Context:")
    console.log(`   Files: ${context.files.join(", ")}`)
    console.log(`   Function: ${context.functionName}`)
    console.log()
    console.log("⏳ Executing goal (watch dashboard for real-time updates)...")
    console.log()

    // Execute goal
    const startTime = Date.now()
    const result = await MinibobIntegration.submitGoal(
      sessionID,
      goal,
      context,
      {
        maxActivities: 5,
        maxCost: 10.0,
      }
    )
    const duration = Date.now() - startTime

    // Display results
    console.log("=".repeat(70))
    console.log("📊 RESULTS")
    console.log("=".repeat(70))
    console.log()

    console.log(`Goal Type:        ${result.goal.type}`)
    console.log(`Goal Intent:      ${result.goal.intent}`)
    console.log(`Status:           ${result.completed ? "✅ COMPLETED" : "⚠️  INCOMPLETE"}`)
    console.log(`Reason:           ${result.completionReason}`)
    console.log(`Activities:       ${result.executions.length} executed`)
    console.log(`Total Duration:   ${duration}ms (${(duration / 1000).toFixed(1)}s)`)
    console.log(`Total Cost:       $${result.totalCost.toFixed(4)}`)
    console.log(`Total Tokens:     ${result.totalTokens.input} input, ${result.totalTokens.output} output`)
    console.log()

    if (result.executions.length > 0) {
      console.log("📋 Activity Executions:")
      console.log()
      
      for (let i = 0; i < result.executions.length; i++) {
        const exec = result.executions[i]
        const statusEmoji = exec.status === "completed" ? "✅" : "❌"
        
        console.log(`${i + 1}. ${statusEmoji} Activity: ${exec.templateId || exec.id}`)
        console.log(`   Status:   ${exec.status}`)
        
        if (exec.metrics) {
          console.log(`   Duration: ${exec.metrics.duration}ms`)
          console.log(`   Cost:     $${exec.metrics.cost.toFixed(4)}`)
          
          if (exec.metrics.totalTokens) {
            console.log(`   Tokens:   ${exec.metrics.totalTokens.input} input, ${exec.metrics.totalTokens.output} output`)
          }
        }
        
        if (exec.taskResults && exec.taskResults.length > 0) {
          const completed = exec.taskResults.filter(t => t.status === "completed").length
          console.log(`   Tasks:    ${completed}/${exec.taskResults.length} completed`)
        }
        
        console.log()
      }
    }

    console.log("=".repeat(70))
    console.log()
    console.log("✨ View detailed execution trace at:")
    console.log(`   http://dashboard.minibob.local/activities/${result.executions[0]?.id || "latest"}`)
    console.log()

    // Cleanup
    MinibobIntegration.cleanup(sessionID)

  } catch (error) {
    console.error()
    console.error("❌ Error during goal execution:")
    console.error()
    console.error(error)
    console.error()
    throw error
  }
}

// Run demo
main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
