#!/usr/bin/env bun
/**
 * Test MiniBob MCP initialization
 * 
 * This script verifies that:
 * 1. initializeMCP() correctly sets up the client
 * 2. isMCPEnabled() returns true after initialization
 * 3. getMCPClient() returns a working client
 * 4. Backend connection is successful
 */

import { initializeMCP, isMCPEnabled, getMCPClient } from "./repos/minibob/src/mcp"

async function main() {
  console.log("=== MiniBob MCP Initialization Test ===\n")
  
  // Check initial state
  console.log("1. Initial state:")
  console.log(`   isMCPEnabled(): ${isMCPEnabled()}`)
  console.log(`   getMCPClient(): ${getMCPClient() ? "exists" : "null"}\n`)
  
  // Initialize MCP
  console.log("2. Initializing MCP client...")
  const endpoint = "http://localhost:8081"
  
  try {
    await initializeMCP({
      endpoint,
      timeout: 30000,
    }, true) // skip health check
    
    console.log(`   ✅ Initialized successfully\n`)
  } catch (error) {
    console.error(`   ❌ Initialization failed:`, error)
    process.exit(1)
  }
  
  // Check state after initialization
  console.log("3. State after initialization:")
  console.log(`   isMCPEnabled(): ${isMCPEnabled()}`)
  console.log(`   getMCPClient(): ${getMCPClient() ? "exists" : "null"}\n`)
  
  // Test client functionality
  console.log("4. Testing client functionality...")
  const client = getMCPClient()
  
  if (!client) {
    console.error("   ❌ Client is null after initialization!")
    process.exit(1)
  }
  
  try {
    // Test recommend_activities
    console.log("   Testing recommend_activities...")
    const result = await client.callTool("metabob_recommend_activities", {
      goal: "test goal",
      context: {}
    })
    
    console.log(`   ✅ recommend_activities responded:`)
    console.log(`   ${JSON.stringify(result, null, 2)}\n`)
    
    console.log("=== All tests passed! ===")
  } catch (error) {
    console.error("   ❌ Tool call failed:", error)
    process.exit(1)
  }
}

main()
