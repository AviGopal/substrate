/**
 * Test OpenCode Goal Tool with MCP Integration
 * 
 * This script tests if the goal tool:
 * 1. Initializes MiniBob's MCP client
 * 2. Gets activity recommendations from backend
 * 3. Executes activities
 */

import { MinibobIntegration } from "./repos/metabob-opencode/packages/opencode/dist/index.js"

async function main() {
  console.log("=== OpenCode Goal Tool Test ===\n")
  
  const sessionID = "test-session-" + Date.now()
  
  console.log("1. Testing goal execution...")
  console.log(`   Session ID: ${sessionID}\n`)
  
  try {
    const result = await MinibobIntegration.executeGoal(
      sessionID,
      {
        type: "implement",
        description: "Add a simple hello world function to test.js",
        context: {}
      },
      {
        maxActivities: 1,
        maxCost: 1.0
      }
    )
    
    console.log("\n2. Goal execution result:")
    console.log(`   Activities executed: ${result.executions?.length || 0}`)
    console.log(`   Total cost: $${result.totalCost?.toFixed(4) || 0}`)
    console.log(`   Success: ${result.success}`)
    
    if (result.executions && result.executions.length > 0) {
      console.log("\n   Executions:")
      result.executions.forEach((exec, i) => {
        console.log(`      ${i + 1}. ${exec.templateId} - ${exec.status}`)
      })
    }
    
    console.log("\n=== Test complete ===")
  } catch (error) {
    console.error("\n❌ Goal execution failed:", error.message)
    console.error(error.stack)
  }
}

main().catch(console.error)
