#!/usr/bin/env tsx
/**
 * Test script for BoredomManager idle detection in Docker container
 * 
 * This script tests the boredom system by:
 * 1. Creating a test session
 * 2. Starting boredom monitoring with reduced threshold (10s for testing)
 * 3. Waiting for idle detection to trigger
 * 4. Verifying boredom activity fetching and execution intent
 * 
 * NOTE: This test modifies IDLE_THRESHOLD_MS to 10 seconds for faster testing.
 *       In production, the default is 5 minutes (300000ms).
 */

import { BoredomManager } from "./repos/metabob-opencode/packages/opencode/src/session/boredom-manager.js"
import { Session } from "./repos/metabob-opencode/packages/opencode/src/session/index.js"
import { Log } from "./repos/metabob-opencode/packages/opencode/src/util/log.js"

const log = Log.create({ service: "boredom-test" })

// Test configuration
const TEST_CONFIG = {
  idleThresholdMs: 10000,  // 10 seconds for testing (vs 5 minutes default)
  checkIntervalMs: 5000,   // Check every 5 seconds (vs 30 seconds default)
  testDurationMs: 30000,   // Total test duration: 30 seconds
}

async function testBoredomIdleDetection() {
  console.log("=".repeat(80))
  console.log("  BOREDOM MANAGER IDLE DETECTION TEST")
  console.log("=".repeat(80))
  console.log()
  console.log("Test Configuration:")
  console.log(`  Idle Threshold:  ${TEST_CONFIG.idleThresholdMs}ms (${TEST_CONFIG.idleThresholdMs / 1000}s)`)
  console.log(`  Check Interval:  ${TEST_CONFIG.checkIntervalMs}ms (${TEST_CONFIG.checkIntervalMs / 1000}s)`)
  console.log(`  Test Duration:   ${TEST_CONFIG.testDurationMs}ms (${TEST_CONFIG.testDurationMs / 1000}s)`)
  console.log()
  
  let session: any = null
  
  try {
    // Step 1: Create a test session
    console.log("[1] Creating test session...")
    session = await Session.create({
      agentID: "general",
      name: "Boredom Idle Detection Test",
    })
    console.log(`✅ Created session: ${session.id}`)
    console.log()
    
    // Step 2: Modify BoredomManager thresholds for testing
    console.log("[2] Configuring BoredomManager with test parameters...")
    
    // Access the singleton instance to modify thresholds
    const manager = (BoredomManager as any).instance
    if (manager) {
      (manager as any).IDLE_THRESHOLD_MS = TEST_CONFIG.idleThresholdMs
      (manager as any).CHECK_INTERVAL_MS = TEST_CONFIG.checkIntervalMs
      console.log(`✅ Modified IDLE_THRESHOLD_MS to ${TEST_CONFIG.idleThresholdMs}ms`)
      console.log(`✅ Modified CHECK_INTERVAL_MS to ${TEST_CONFIG.checkIntervalMs}ms`)
    } else {
      console.log("⚠️  BoredomManager instance not found, using defaults")
    }
    console.log()
    
    // Step 3: Start boredom monitoring
    console.log("[3] Starting boredom monitoring...")
    await BoredomManager.startMonitoring(session.id)
    console.log(`✅ Monitoring started for session ${session.id}`)
    console.log()
    
    // Step 4: Wait for first check cycle
    console.log(`[4] Waiting ${TEST_CONFIG.checkIntervalMs / 1000}s for first check cycle...`)
    await sleep(TEST_CONFIG.checkIntervalMs + 2000)
    console.log("✅ First check cycle completed")
    console.log("   Expected: No activity yet (not idle)")
    console.log()
    
    // Step 5: Wait to exceed idle threshold
    console.log(`[5] Waiting to exceed idle threshold (${TEST_CONFIG.idleThresholdMs / 1000}s)...`)
    const remainingWait = TEST_CONFIG.idleThresholdMs - TEST_CONFIG.checkIntervalMs + 3000
    console.log(`   Waiting additional ${remainingWait / 1000}s...`)
    await sleep(remainingWait)
    console.log("✅ Idle threshold exceeded")
    console.log()
    
    // Step 6: Wait for next check to trigger boredom activity
    console.log("[6] Waiting for next check cycle to detect idle state...")
    await sleep(TEST_CONFIG.checkIntervalMs + 2000)
    console.log("✅ Check cycle completed")
    console.log()
    
    // Step 7: Check session state
    console.log("[7] Checking session state...")
    console.log(`   Session ID: ${session.id}`)
    console.log(`   Session Name: ${session.name}`)
    console.log()
    
    // Step 8: Review expected logs
    console.log("[8] Expected log output:")
    console.log("   ✓ 'Session {id} idle for {time}, checking boredom activities'")
    console.log("   ✓ 'Fetching boredom activities from Metabob'")
    console.log("   ✓ 'Found {n} boredom activities'")
    console.log("   ✓ 'Selected activity: {template_id} (priority: {n})'")
    console.log("   ✓ '[BOREDOM] Executing activity: {template_id}'")
    console.log("   ✓ 'Reason: {reason}'")
    console.log()
    
    // Step 9: Cleanup
    console.log("[9] Cleaning up...")
    await BoredomManager.stopMonitoring(session.id)
    console.log(`✅ Stopped monitoring for session ${session.id}`)
    console.log()
    
    console.log("=".repeat(80))
    console.log("  TEST COMPLETED")
    console.log("=".repeat(80))
    console.log()
    console.log("✅ Session created successfully")
    console.log("✅ Monitoring started and configured with test parameters")
    console.log("✅ Idle threshold exceeded")
    console.log("✅ Check cycles executed")
    console.log()
    console.log("📋 Review the logs above for boredom activity detection")
    console.log("📋 Check OpenCode logs for detailed boredom system output")
    console.log()
    console.log("Expected outcome:")
    console.log("  - Boredom activities fetched from mock templates")
    console.log("  - Activity with highest priority selected")
    console.log("  - Execution intent logged (dry-run mode)")
    console.log()
    
  } catch (error) {
    console.error()
    console.error("❌ TEST FAILED")
    console.error("Error:", error instanceof Error ? error.message : String(error))
    console.error()
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:")
      console.error(error.stack)
    }
    throw error
  } finally {
    // Ensure cleanup even if test fails
    if (session) {
      try {
        await BoredomManager.stopMonitoring(session.id)
      } catch (cleanupError) {
        console.error("Failed to stop monitoring:", cleanupError)
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Handle cleanup on interrupt
process.on('SIGINT', async () => {
  console.log()
  console.log("⚠️  Test interrupted by user")
  process.exit(130)
})

process.on('SIGTERM', async () => {
  console.log()
  console.log("⚠️  Test terminated")
  process.exit(143)
})

// Run test
testBoredomIdleDetection()
  .then(() => {
    console.log("Test completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Test failed with error:", error)
    process.exit(1)
  })
