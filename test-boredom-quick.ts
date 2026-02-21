#!/usr/bin/env bun
/**
 * Quick test for BoredomManager with reduced idle threshold
 * 
 * This creates a standalone test that doesn't require modifying source code.
 * Instead, it manually implements the idle detection flow with a 10-second threshold.
 */

import { Log } from "./repos/metabob-opencode/packages/opencode/src/util/log"
import { MCP } from "./repos/metabob-opencode/packages/opencode/src/mcp"

const log = Log.create({ service: "boredom-quick-test" })

// Test configuration
const IDLE_THRESHOLD_MS = 10 * 1000  // 10 seconds for testing
const CHECK_INTERVAL_MS = 5 * 1000   // Check every 5 seconds

interface BoredomActivity {
  activity_type: "improve-template" | "debug-failures" | "optimize-performance"
  priority: number
  template_id: string
  improvement_gradient: number
  reason: string
  estimated_effort: string
  metrics: Record<string, any>
}

async function testQuickBoredomDetection() {
  console.log("=" .repeat(80))
  console.log("  BOREDOM MANAGER QUICK TEST (10s idle threshold)")
  console.log("=" .repeat(80))
  
  const testSessionID = `test-${Date.now()}`
  let lastActivityTime = Date.now()
  let checkCount = 0
  
  console.log(`\nTest Session ID: ${testSessionID}`)
  console.log(`Idle Threshold: ${IDLE_THRESHOLD_MS / 1000} seconds`)
  console.log(`Check Interval: ${CHECK_INTERVAL_MS / 1000} seconds`)
  
  // Simulate idle detection loop
  console.log("\n[1] Starting idle detection simulation...")
  console.log("    (No user activity will be simulated - session will become idle)")
  
  const checkTimer = setInterval(async () => {
    checkCount++
    const idleTime = Date.now() - lastActivityTime
    const isIdle = idleTime >= IDLE_THRESHOLD_MS
    
    console.log(`\n[Check ${checkCount}] Idle time: ${Math.floor(idleTime / 1000)}s | Idle: ${isIdle ? "YES ✓" : "NO"}`)
    
    if (isIdle) {
      console.log("    → Session is IDLE! Fetching boredom activities...")
      
      try {
        await checkIdleAndExecute(testSessionID)
        
        // Stop after first execution
        clearInterval(checkTimer)
        console.log("\n" + "=".repeat(80))
        console.log("  TEST COMPLETE")
        console.log("=".repeat(80))
        process.exit(0)
        
      } catch (error) {
        console.error("    ❌ Error during boredom check:", error)
        clearInterval(checkTimer)
        process.exit(1)
      }
    }
  }, CHECK_INTERVAL_MS)
  
  // Timeout after 30 seconds
  setTimeout(() => {
    clearInterval(checkTimer)
    console.log("\n⚠️  Test timeout (30s) - stopping")
    process.exit(1)
  }, 30000)
}

async function checkIdleAndExecute(sessionID: string): Promise<void> {
  console.log(`\n[BOREDOM] Fetching activities from backend...`)
  
  try {
    // Call MCP tool to fetch boredom activities
    const result = await MCP.callTool("metabob_fetch_boredom_activities", {
      max_activities: 5,
      priority_threshold: 0.6,
      exclude_recent_hours: 24,
    })
    
    console.log(`[BOREDOM] API Response:`, JSON.stringify(result, null, 2))
    
    if (result.status === "success" && Array.isArray(result.activities)) {
      const activities = result.activities as BoredomActivity[]
      
      if (activities.length === 0) {
        console.log(`[BOREDOM] No activities available`)
        return
      }
      
      // Execute highest priority activity
      const topActivity = activities[0]
      console.log(`\n[BOREDOM] ✅ Top priority activity selected:`)
      console.log(`    Template ID:      ${topActivity.template_id}`)
      console.log(`    Activity Type:    ${topActivity.activity_type}`)
      console.log(`    Priority:         ${topActivity.priority}`)
      console.log(`    Gradient:         ${topActivity.improvement_gradient}`)
      console.log(`    Estimated Effort: ${topActivity.estimated_effort}`)
      console.log(`    Reason:           ${topActivity.reason}`)
      
      console.log(`\n[BOREDOM] Would execute activity now (placeholder implementation)`)
      console.log(`    In full implementation, this would:`)
      console.log(`    1. Load template from repository`)
      console.log(`    2. Create Activity instance`)
      console.log(`    3. Execute with "boredom" flag`)
      console.log(`    4. Monitor for user return (cancel if detected)`)
      console.log(`    5. Report results to metrics system`)
      
      // Show all available activities
      if (activities.length > 1) {
        console.log(`\n[BOREDOM] Other available activities (${activities.length - 1}):`)
        activities.slice(1).forEach((activity, idx) => {
          console.log(`    ${idx + 2}. ${activity.template_id} (priority: ${activity.priority})`)
        })
      }
      
    } else {
      console.log(`[BOREDOM] ⚠️  Unexpected API response:`, result)
    }
    
  } catch (error) {
    console.error(`[BOREDOM] ❌ Failed to fetch activities:`, error)
    throw error
  }
}

// Run test
testQuickBoredomDetection().catch((error) => {
  console.error("\n❌ TEST FAILED:", error)
  process.exit(1)
})
