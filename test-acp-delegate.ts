#!/usr/bin/env bun

// Test ACP delegation to DevBob container
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: "http://localhost:3000"
})

async function testDelegation() {
  console.log("Testing ACP delegation to DevBob...")
  
  try {
    // Test 1: Simple echo task
    console.log("\n=== Test 1: Simple Task ===")
    const result = await client.prompts.prompt({
      messages: [
        {
          role: "user",
          content: "Echo back: 'DevBob ACP is working!'"
        }
      ]
    })
    
    console.log("Response:", result.messages[result.messages.length - 1].content)
    
    console.log("\n✅ ACP delegation test passed!")
  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
}

testDelegation()
