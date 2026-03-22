/**
 * Test MiniBob MCP initialization
 */

import { initializeMCP, isMCPEnabled, getMCPClient } from "./repos/minibob/dist/lib.js"

async function main() {
  console.log("=== MiniBob MCP Initialization Test ===\n")
  
  // Check initial state
  console.log("1. Initial state:")
  console.log(`   isMCPEnabled(): ${isMCPEnabled()}`)
  console.log(`   getMCPClient(): ${getMCPClient() ? "exists" : "null"}\n`)
  
  // Initialize MCP
  console.log("2. Initializing MCP client...")
  const endpoint = "http://localhost:8081"
  
  const client = await initializeMCP({
    endpoint,
    timeout: 30000,
  }, true) // skip health check
  
  if (!client) {
    console.error("   ❌ initializeMCP returned null!")
    return
  }
  
  console.log(`   ✅ Initialized successfully\n`)
  
  // Check state after initialization
  console.log("3. State after initialization:")
  console.log(`   isMCPEnabled(): ${isMCPEnabled()}`)
  console.log(`   getMCPClient(): ${getMCPClient() ? "exists" : "null"}\n`)
  
  // Test recommendActivities
  console.log("4. Testing recommendActivities...")
  try {
    const recommendations = await client.recommendActivities("test adding a feature", "feature", [], 3)
    console.log(`   ✅ Got ${recommendations.length} recommendations`)
    recommendations.forEach((rec, i) => {
      console.log(`      ${i + 1}. ${rec.template_id}`)
    })
  } catch (error) {
    console.error("   ❌ recommendActivities failed:", error.message)
  }
  
  console.log("\n=== Test complete ===")
}

main().catch(console.error)
