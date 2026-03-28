/**
 * Test MiniBob GoalProcessor with MCP backend integration
 */

import { 
  initializeMCP, 
  GoalProcessor, 
  ActivityExecutor 
} from "./repos/minibob/dist/lib.js"

async function main() {
  console.log("=== MiniBob GoalProcessor Test ===\n")
  
  // 1. Initialize MCP
  console.log("1. Initializing MCP client...")
  await initializeMCP({
    endpoint: "http://localhost:8081",
    timeout: 30000,
  }, true)
  console.log("   ✅ MCP initialized\n")
  
  // 2. Create executor
  console.log("2. Creating ActivityExecutor...")
  const executor = new ActivityExecutor({
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY || "dummy-key",
    model: "claude-sonnet-4-20250514",
    workingDirectory: "/tmp/test-goal",
  })
  console.log("   ✅ Executor created\n")
  
  // 3. Create GoalProcessor
  console.log("3. Creating GoalProcessor...")
  const goalProcessor = new GoalProcessor({
    workingDirectory: "/tmp/test-goal",
    executor,
  })
  console.log("   ✅ GoalProcessor created\n")
  
  // 4. Test getRecommendations
  console.log("4. Testing getRecommendations...")
  const testGoal = goalProcessor.parseGoal(
    "Add a simple test function",
    { files: ["test.js"] }
  )
  
  const recommendations = await goalProcessor.getRecommendations(testGoal, [], 3)
  console.log(`   ✅ Got ${recommendations.length} recommendations`)
  
  if (recommendations.length > 0) {
    console.log("\n   Recommendations:")
    recommendations.forEach((rec, i) => {
      console.log(`      ${i + 1}. ${rec.templateId}`)
      console.log(`         Selection: ${rec.selectionMetadata.method}`)
    })
  }
  
  console.log("\n=== Test Complete ===")
  console.log("\nReady to call goalProcessor.executeGoal() from OpenCode!")
}

main().catch(console.error)
