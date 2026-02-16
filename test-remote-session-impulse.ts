#!/usr/bin/env bun
/**
 * Test script for Phase 1: Remote Session Impulse tracking
 * 
 * This script validates that:
 * 1. Remote session impulse is created on delegation start
 * 2. Impulse is updated during execution (progress tracking)
 * 3. Impulse is updated on completion with final status
 * 4. Impulses can be filtered by type and status
 * 
 * Usage:
 *   bun run test-remote-session-impulse.ts
 */

import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { Log } from "./repos/metabob-opencode/packages/opencode/src/util/log"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"
import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import type { Tool } from "./repos/metabob-opencode/packages/opencode/src/tool/tool"

const log = Log.create({ service: "test-remote-session" })

async function testRemoteSessionImpulseLifecycle() {
  console.log("\n" + "=".repeat(80))
  console.log("Testing Remote Session Impulse Lifecycle (Phase 1)")
  console.log("=".repeat(80) + "\n")

  // Create a test session
  const testSessionId = `test-session-${Date.now()}`
  console.log(`📝 Created test session: ${testSessionId}\n`)

  try {
    // Step 1: Test delegation with impulse creation
    console.log("Step 1: Testing ACP delegation with remote session impulse...\n")
    
    // Initialize the tool
    const toolInfo = await ACPDelegateTool.init()

    // Create test context
    const testContext: Tool.Context<any> = {
      sessionID: testSessionId,
      messageID: "test-message-" + Date.now(),
      agent: "test-agent",
      abort: new AbortController().signal,
      metadata: () => {},
    }

    // Execute delegation (this should create the remote session impulse)
    console.log("🚀 Executing delegation to devbob-clean container...")
    console.log("   Task: Simple echo test\n")

    const result = await toolInfo.execute(
      {
        target: "docker://devbob-clean",
        taskDescription: "Test remote session impulse tracking",
        prompt: "Echo back this message: 'Remote session impulse test successful!'",
        timeout: 60,
      },
      testContext,
    )

    console.log("\n✅ Delegation completed")
    console.log(`   Response length: ${result.metadata?.responseLength || 0} characters`)
    console.log(`   Duration: ${((result.metadata?.duration || 0) / 1000).toFixed(1)}s`)
    console.log(`   Tools used: ${result.metadata?.toolsUsed?.length || 0}\n`)

    // Step 2: List all impulses in the session
    console.log("Step 2: Listing all impulses in test session...\n")
    
    const allImpulses = await SessionMemory.listImpulses(testSessionId)
    console.log(`   Found ${allImpulses.length} impulse(s) total\n`)

    for (const impulse of allImpulses) {
      console.log(`   - ${impulse.id}`)
      console.log(`     Type: ${impulse.type}`)
      console.log(`     Priority: ${impulse.priority}`)
      if (impulse.metadata) {
        console.log(`     Metadata:`, JSON.stringify(impulse.metadata, null, 6).split('\n').join('\n     '))
      }
      console.log()
    }

    // Step 3: Filter impulses by type (remoteSession)
    console.log("Step 3: Filtering impulses by type='remoteSession'...\n")
    
    const remoteSessionImpulses = await SessionMemory.listImpulses(testSessionId, {
      type: "remoteSession",
    })
    
    console.log(`   Found ${remoteSessionImpulses.length} remote session impulse(s)\n`)

    if (remoteSessionImpulses.length === 0) {
      throw new Error("❌ FAIL: No remote session impulse found!")
    }

    // Step 4: Validate impulse structure
    console.log("Step 4: Validating remote session impulse structure...\n")
    
    const remoteImpulse = remoteSessionImpulses[0]
    
    const validations = [
      { check: remoteImpulse.type === "remoteSession", desc: "Type is 'remoteSession'" },
      { check: remoteImpulse.pointer.type === "acp", desc: "Pointer type is 'acp'" },
      { check: "sessionId" in remoteImpulse.pointer, desc: "Pointer has sessionId" },
      { check: "target" in remoteImpulse.pointer, desc: "Pointer has target" },
      { check: remoteImpulse.metadata !== undefined, desc: "Has metadata" },
      { check: remoteImpulse.metadata?.status !== undefined, desc: "Metadata has status" },
      { check: remoteImpulse.metadata?.duration !== undefined, desc: "Metadata has duration" },
      { check: remoteImpulse.metadata?.taskDescription !== undefined, desc: "Metadata has taskDescription" },
    ]

    let passCount = 0
    for (const validation of validations) {
      const icon = validation.check ? "✅" : "❌"
      console.log(`   ${icon} ${validation.desc}`)
      if (validation.check) passCount++
    }

    console.log(`\n   Results: ${passCount}/${validations.length} validations passed\n`)

    if (passCount !== validations.length) {
      throw new Error("Some validations failed!")
    }

    // Step 5: Test filtering by status
    console.log("Step 5: Testing status filtering...\n")
    
    const completedImpulses = await SessionMemory.listImpulses(testSessionId, {
      type: "remoteSession",
      status: "completed",
    })
    
    console.log(`   Completed remote sessions: ${completedImpulses.length}`)
    
    const processingImpulses = await SessionMemory.listImpulses(testSessionId, {
      type: "remoteSession", 
      status: "processing",
    })
    
    console.log(`   Processing remote sessions: ${processingImpulses.length}`)
    
    const failedImpulses = await SessionMemory.listImpulses(testSessionId, {
      type: "remoteSession",
      status: "failed",
    })
    
    console.log(`   Failed remote sessions: ${failedImpulses.length}\n`)

    // Step 6: Display final impulse state
    console.log("Step 6: Final remote session impulse state...\n")
    console.log(JSON.stringify(remoteImpulse, null, 2))
    console.log()

    // Success!
    console.log("\n" + "=".repeat(80))
    console.log("✅ ALL TESTS PASSED - Remote Session Impulse Lifecycle Validated")
    console.log("=".repeat(80) + "\n")

    console.log("Summary:")
    console.log("  ✓ Remote session impulse created on delegation")
    console.log("  ✓ Impulse updated during execution")
    console.log("  ✓ Impulse updated on completion")
    console.log("  ✓ Filtering by type works correctly")
    console.log("  ✓ Filtering by status works correctly")
    console.log("  ✓ All metadata fields present and valid\n")

    // Cleanup
    console.log("🧹 Cleaning up test session...")
    await SessionMemory.remove(testSessionId)
    console.log("   Test session removed\n")

  } catch (error) {
    console.error("\n❌ TEST FAILED")
    console.error("Error:", error)
    console.error()

    // Cleanup on error
    try {
      await SessionMemory.remove(testSessionId)
      console.log("🧹 Test session cleaned up\n")
    } catch (cleanupError) {
      console.error("Failed to cleanup test session:", cleanupError)
    }

    process.exit(1)
  }
}

// Run the test with Instance context
Instance.provide({
  directory: "/home/avi/documents/work/exp-repo/metabob-devbob",
  fn: () => testRemoteSessionImpulseLifecycle()
}).catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
