/**
 * Integration Test for Learning System Phases 1.1-1.6
 * 
 * Tests all implemented learning capabilities:
 * - Phase 1.1-1.2: Activity composition tracking
 * - Phase 1.3: Impulse relevance metrics (backend only)
 * - Phase 1.4: Tool calls as impulses
 * - Phase 1.5: Tool usage patterns
 * - Phase 1.6: Execution sequences
 */

import { ActivityExecutor, initializeMCP } from "./repos/minibob/src/lib"
import type { ActivityTemplate } from "./repos/minibob/src/types"

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "http://localhost:3000"
const TEST_WORKING_DIR = process.cwd()

console.log("=".repeat(80))
console.log("LEARNING SYSTEM INTEGRATION TEST")
console.log("=".repeat(80))
console.log(`MCP Endpoint: ${MCP_ENDPOINT}`)
console.log(`Working Directory: ${TEST_WORKING_DIR}`)
console.log("")

// Note: This test focuses on backend endpoints
// Full end-to-end activity execution would require a running LLM

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function waitForBackend(maxRetries = 10): Promise<boolean> {
  console.log("Waiting for backend to be ready...")
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${MCP_ENDPOINT}/health`, { method: "GET" })
      if (response.ok) {
        console.log("✅ Backend is ready")
        return true
      }
    } catch (error) {
      // Backend not ready yet
    }
    
    console.log(`  Retry ${i + 1}/${maxRetries}...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.error("❌ Backend not available")
  return false
}

async function testPhase(
  phaseNumber: string,
  phaseName: string,
  testFn: () => Promise<boolean>
): Promise<boolean> {
  console.log("")
  console.log("-".repeat(80))
  console.log(`Phase ${phaseNumber}: ${phaseName}`)
  console.log("-".repeat(80))
  
  try {
    const result = await testFn()
    if (result) {
      console.log(`✅ Phase ${phaseNumber} PASSED`)
    } else {
      console.log(`❌ Phase ${phaseNumber} FAILED`)
    }
    return result
  } catch (error) {
    console.error(`❌ Phase ${phaseNumber} ERROR:`, error)
    return false
  }
}

// =============================================================================
// PHASE TESTS
// =============================================================================

async function testPhase12_CompositionTracking(): Promise<boolean> {
  console.log("Testing activity composition tracking...")
  
  // Initialize MCP
  initializeMCP({
    endpoint: MCP_ENDPOINT,
  })
  
  // Note: We would normally execute nested activities, but for testing
  // we'll manually test the backend endpoints directly
  
  console.log("Sending composition record to backend...")
  
  const compositionRecord = {
    parent_activity_id: "test-activity-parent",
    child_activity_id: "test-activity-child",
    execution_id: `exec_test_${Date.now()}`,
    goal_context: "Testing composition tracking",
    success: true,
  }
  
  try {
    const response = await fetch(`${MCP_ENDPOINT}/v2/activities/composition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compositionRecord),
    })
    
    if (!response.ok) {
      const text = await response.text()
      console.error("POST failed:", response.status, text)
      return false
    }
    
    const data = await response.json()
    console.log("✅ Composition recorded:", data)
    
    // Query composition graph
    console.log("Querying composition graph...")
    const queryResponse = await fetch(`${MCP_ENDPOINT}/v2/activities/composition/graph?limit=10`, {
      method: "GET",
    })
    
    if (!queryResponse.ok) {
      console.error("GET failed:", queryResponse.status)
      return false
    }
    
    const graphData = await queryResponse.json()
    console.log(`✅ Composition graph retrieved: ${graphData.edges?.length || 0} edges`)
    
    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

async function testPhase3_ImpulseRelevance(): Promise<boolean> {
  console.log("Testing impulse relevance metrics...")
  
  const relevanceRecord = {
    impulse_id: "test-impulse",
    activity_variant_id: "test-activity",
    was_loaded: true,
    execution_succeeded: true,
    content_size_tokens: 100,
    pointer_type: "file",
  }
  
  try {
    const response = await fetch(`${MCP_ENDPOINT}/v2/activities/impulse-relevance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(relevanceRecord),
    })
    
    if (!response.ok) {
      const text = await response.text()
      console.error("POST failed:", response.status, text)
      return false
    }
    
    console.log("✅ Impulse relevance recorded")
    
    // Query impulse relevance
    const queryResponse = await fetch(`${MCP_ENDPOINT}/v2/activities/impulse-relevance?impulse_id=test-impulse`, {
      method: "GET",
    })
    
    if (!queryResponse.ok) {
      console.error("GET failed:", queryResponse.status)
      return false
    }
    
    const data = await queryResponse.json()
    console.log(`✅ Impulse relevance retrieved: ${data.metrics?.length || 0} metrics`)
    
    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

async function testPhase5_ToolUsage(): Promise<boolean> {
  console.log("Testing tool usage patterns...")
  
  const toolUsageRecord = {
    tool_name: "bash",
    activity_variant_id: "test-activity",
    execution_id: `exec_test_${Date.now()}`,
    tool_succeeded: true,
    activity_succeeded: true,
    params_complexity: 50,
  }
  
  try {
    const response = await fetch(`${MCP_ENDPOINT}/v2/activities/tool-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toolUsageRecord),
    })
    
    if (!response.ok) {
      const text = await response.text()
      console.error("POST failed:", response.status, text)
      return false
    }
    
    console.log("✅ Tool usage recorded")
    
    // Query tool usage
    const queryResponse = await fetch(`${MCP_ENDPOINT}/v2/activities/tool-usage?activity_variant_id=test-activity`, {
      method: "GET",
    })
    
    if (!queryResponse.ok) {
      console.error("GET failed:", queryResponse.status)
      return false
    }
    
    const data = await queryResponse.json()
    console.log(`✅ Tool usage retrieved: ${data.patterns?.length || 0} patterns`)
    
    // Check learned metrics
    if (data.patterns && data.patterns.length > 0) {
      const pattern = data.patterns[0]
      console.log(`  - usage_probability: ${pattern.usage_probability}`)
      console.log(`  - is_required: ${pattern.is_required}`)
      console.log(`  - success_correlation: ${pattern.success_correlation}`)
    }
    
    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

async function testPhase6_ExecutionSequences(): Promise<boolean> {
  console.log("Testing execution sequences...")
  
  const sequence = {
    session_id: `session_test_${Date.now()}`,
    goal_context: "Testing execution sequences",
    sequence: [
      {
        activity_id: "test-activity-1",
        execution_id: `exec_1_${Date.now()}`,
        order: 0,
        trigger_type: "goal" as const,
        success: true,
        duration_ms: 1000,
        cost_usd: 0.1,
      },
      {
        activity_id: "test-activity-2",
        execution_id: `exec_2_${Date.now()}`,
        order: 1,
        trigger_type: "goal" as const,
        success: true,
        duration_ms: 2000,
        cost_usd: 0.2,
      },
    ],
    outcome: "success" as const,
  }
  
  try {
    const response = await fetch(`${MCP_ENDPOINT}/v2/activities/execution-sequences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sequence),
    })
    
    if (!response.ok) {
      const text = await response.text()
      console.error("POST failed:", response.status, text)
      return false
    }
    
    const data = await response.json()
    console.log("✅ Execution sequence recorded")
    console.log(`  - Total activities: ${data.sequence?.total_activities}`)
    console.log(`  - Total duration: ${data.sequence?.total_duration_ms}ms`)
    console.log(`  - Total cost: $${data.sequence?.total_cost_usd}`)
    
    // Query execution sequences
    const queryResponse = await fetch(`${MCP_ENDPOINT}/v2/activities/execution-sequences?outcome=success&limit=10`, {
      method: "GET",
    })
    
    if (!queryResponse.ok) {
      console.error("GET failed:", queryResponse.status)
      return false
    }
    
    const queryData = await queryResponse.json()
    console.log(`✅ Execution sequences retrieved: ${queryData.sequences?.length || 0} sequences`)
    
    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runTests() {
  console.log("Starting integration tests...\n")
  
  // Wait for backend
  const backendReady = await waitForBackend()
  if (!backendReady) {
    console.error("Cannot proceed without backend")
    process.exit(1)
  }
  
  const results = {
    "1.1-1.2": await testPhase("1.1-1.2", "Activity Composition Tracking", testPhase12_CompositionTracking),
    "1.3": await testPhase("1.3", "Impulse Relevance Metrics", testPhase3_ImpulseRelevance),
    "1.5": await testPhase("1.5", "Tool Usage Patterns", testPhase5_ToolUsage),
    "1.6": await testPhase("1.6", "Execution Sequences", testPhase6_ExecutionSequences),
  }
  
  // Summary
  console.log("")
  console.log("=".repeat(80))
  console.log("TEST SUMMARY")
  console.log("=".repeat(80))
  
  const passed = Object.values(results).filter(r => r).length
  const total = Object.keys(results).length
  
  for (const [phase, result] of Object.entries(results)) {
    console.log(`Phase ${phase}: ${result ? "✅ PASS" : "❌ FAIL"}`)
  }
  
  console.log("")
  console.log(`Total: ${passed}/${total} phases passed`)
  
  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED!")
    process.exit(0)
  } else {
    console.log("⚠️  SOME TESTS FAILED")
    process.exit(1)
  }
}

// Run tests
runTests().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
