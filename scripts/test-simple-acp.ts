#!/usr/bin/env bun
/**
 * Simple ACP Connection Test
 * 
 * Basic test to verify ACP connectivity without complex workflows.
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"

console.log("🔗 Simple ACP Connection Test")
console.log("================================")

const CONTAINER_NAME = "devbob-opencode"
const TARGET = `docker://${CONTAINER_NAME}`

// Run within Instance context
await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    console.log("1. Initializing ACP Tool...")
    
    let acpTool: Awaited<ReturnType<typeof ACPDelegateTool.init>>
    try {
      acpTool = await ACPDelegateTool.init()
      console.log("✅ ACP Tool initialized")
    } catch (error) {
      console.log("❌ Failed to initialize ACP tool:", error)
      process.exit(1)
    }

    console.log("\n2. Testing basic connection...")
    
    try {
      const result = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Simple connectivity test",
          prompt: "Please respond with 'Connection successful' to confirm ACP communication is working.",
          timeout: 30, // Reduced timeout
        },
        {
          sessionID: `test-simple-${Date.now()}`,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (result.metadata?.success) {
        console.log("✅ ACP Connection successful")
        console.log("Response preview:")
        console.log(result.output.slice(0, 200) + "...")
        
        // Check if we got the expected response
        if (result.output.toLowerCase().includes("connection successful")) {
          console.log("✅ Response confirmation received")
        } else {
          console.log("⚠️  Response received but without expected confirmation")
        }
      } else {
        console.log("❌ ACP Connection failed")
        console.log("Error:", result.metadata?.error || "Unknown error")
      }
    } catch (error) {
      console.log("❌ ACP test failed:", error instanceof Error ? error.message : String(error))
    }

    console.log("\n3. Testing tool availability...")
    
    try {
      const toolResult = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Tool availability check",
          prompt: "List the first 5 tools available to you. Just show tool names, no details needed.",
          timeout: 30,
        },
        {
          sessionID: `test-tools-${Date.now()}`,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (toolResult.metadata?.success) {
        console.log("✅ Tool availability check successful")
        console.log("Available tools preview:")
        console.log(toolResult.output.slice(0, 300) + "...")
      } else {
        console.log("❌ Tool availability check failed")
        console.log("Error:", toolResult.metadata?.error || "Unknown error")
      }
    } catch (error) {
      console.log("❌ Tool test failed:", error instanceof Error ? error.message : String(error))
    }

    console.log("\n================================")
    console.log("🏁 Simple ACP test completed")
  },
})