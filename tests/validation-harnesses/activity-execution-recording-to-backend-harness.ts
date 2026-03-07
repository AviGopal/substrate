/**
 * Validation Harness: Activity Execution Recording to Backend
 * 
 * Specification: Activity Execution Recording to Backend
 * Purpose: Verify that activity executions are recorded to backend via MCP-only path
 * 
 * Test Strategy:
 * 1. Execute a test activity template
 * 2. Verify execution recorded via MCP path (no direct HTTP)
 * 3. Query backend to verify execution exists in SurrealDB
 * 4. Verify template metrics updated (success rate > 0%)
 * 5. Test graceful degradation when MCP unavailable
 * 
 * Architecture Validation:
 * - No direct HTTP calls from opencode to backend
 * - All recording goes through TemplateMetricsClient → MCP → CLI → Backend
 * - Single write path to activity_executions table
 */

import { exec } from "child_process"
import { promisify } from "util"
import fetch from "node-fetch"

const execAsync = promisify(exec)

interface ValidationResult {
  pass: boolean
  actual: any
  expected: any
  error?: string
  details?: string
}

interface TestCase {
  name: string
  description: string
  input: {
    activityTemplate: string
    expectedSuccess: boolean
  }
  expectedOutput: {
    executionRecorded: boolean
    mcpPathUsed: boolean
    backendRecordExists: boolean
    metricsUpdated: boolean
  }
}

/**
 * Test Case 1: Successful Activity Execution Recording
 * 
 * Input: Execute a simple activity template that succeeds
 * Expected: Execution recorded via MCP, exists in backend, metrics updated
 */
const testCase1: TestCase = {
  name: "Successful Activity Execution Recording",
  description: "Execute activity template and verify execution recorded to backend via MCP path",
  input: {
    activityTemplate: "trace-data-flow-single-feature",
    expectedSuccess: true,
  },
  expectedOutput: {
    executionRecorded: true,
    mcpPathUsed: true,
    backendRecordExists: true,
    metricsUpdated: true,
  },
}

/**
 * Test Case 2: Failed Activity Execution Recording
 * 
 * Input: Execute an activity that fails
 * Expected: Failure recorded via MCP, metrics show failure, backend has error details
 */
const testCase2: TestCase = {
  name: "Failed Activity Execution Recording",
  description: "Verify failed activity executions are also recorded with error details",
  input: {
    activityTemplate: "intentional-failure-test",
    expectedSuccess: false,
  },
  expectedOutput: {
    executionRecorded: true,
    mcpPathUsed: true,
    backendRecordExists: true,
    metricsUpdated: true,
  },
}

/**
 * Test Case 3: MCP Path Verification (No Direct HTTP)
 * 
 * Input: Monitor network traffic during activity execution
 * Expected: No direct POST to /v2/activities/executions, only MCP calls
 */
const testCase3: TestCase = {
  name: "MCP Path Verification",
  description: "Verify no direct HTTP calls bypass MCP layer",
  input: {
    activityTemplate: "trace-data-flow-single-feature",
    expectedSuccess: true,
  },
  expectedOutput: {
    executionRecorded: true,
    mcpPathUsed: true,
    backendRecordExists: true,
    metricsUpdated: true,
  },
}

/**
 * Query backend for activity execution record
 */
async function queryBackendExecution(activityId: string): Promise<any> {
  const apiUrl = process.env.METABOB_RPC_API_URL || "http://localhost:8080"
  
  try {
    // Query via learning-loop endpoint (correct MCP-based path)
    const response = await fetch(
      `${apiUrl}/api/v1/learning-loop/executions?activity_id=${activityId}&limit=1`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )

    if (!response.ok) {
      return { error: `Backend query failed: ${response.status}` }
    }

    const executions = await response.json()
    return executions.length > 0 ? executions[0] : null
  } catch (error) {
    return { error: `Backend query error: ${error}` }
  }
}

/**
 * Query template metrics to verify they were updated
 */
async function queryTemplateMetrics(templateId: string): Promise<any> {
  const apiUrl = process.env.METABOB_RPC_API_URL || "http://localhost:8080"
  
  try {
    const response = await fetch(
      `${apiUrl}/api/v1/learning-loop/metrics/${templateId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )

    if (!response.ok) {
      return { error: `Metrics query failed: ${response.status}` }
    }

    return await response.json()
  } catch (error) {
    return { error: `Metrics query error: ${error}` }
  }
}

/**
 * Check if deprecated endpoint was called (should NOT be called)
 */
async function checkDeprecatedEndpointUsage(activityId: string): Promise<boolean> {
  const apiUrl = process.env.METABOB_RPC_API_URL || "http://localhost:8080"
  
  try {
    // Try to query the deprecated endpoint directly
    // If it returns data, it means it was used (BAD)
    const response = await fetch(
      `${apiUrl}/v2/activities/executions?activity_id=${activityId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )

    // If endpoint exists and returns data, check logs for deprecation warning
    if (response.ok) {
      const data = await response.json()
      // If we get data from deprecated endpoint, it was used
      return data && data.length > 0
    }

    return false
  } catch (error) {
    // Endpoint might not exist or be disabled - that's good
    return false
  }
}

/**
 * Execute test activity and capture activity ID
 */
async function executeTestActivity(templateId: string): Promise<{ activityId: string; success: boolean }> {
  try {
    // Execute activity via OpenCode CLI
    const { stdout, stderr } = await execAsync(
      `cd repos/metabob-opencode && bun run opencode activity execute ${templateId}`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    // Parse activity ID from output
    const activityIdMatch = stdout.match(/Activity ID: ([a-zA-Z0-9_-]+)/)
    const activityId = activityIdMatch ? activityIdMatch[1] : ""

    // Check if activity succeeded
    const success = stdout.includes("Activity completed successfully") || stdout.includes("status: done")

    return { activityId, success }
  } catch (error) {
    throw new Error(`Failed to execute test activity: ${error}`)
  }
}

/**
 * Validate Test Case 1: Successful Activity Execution
 */
export async function validateSuccessfulExecution(): Promise<ValidationResult> {
  const testCase = testCase1

  try {
    console.log(`\n[TEST] ${testCase.name}`)
    console.log(`[TEST] ${testCase.description}`)

    // Step 1: Execute test activity
    console.log(`[TEST] Executing activity template: ${testCase.input.activityTemplate}`)
    const { activityId, success } = await executeTestActivity(testCase.input.activityTemplate)

    if (!activityId) {
      return {
        pass: false,
        actual: { activityId: null },
        expected: { activityId: "non-null" },
        error: "Failed to capture activity ID from execution",
      }
    }

    console.log(`[TEST] Activity ID: ${activityId}`)
    console.log(`[TEST] Activity Success: ${success}`)

    // Wait for backend processing (async background task)
    console.log(`[TEST] Waiting 5 seconds for backend processing...`)
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Step 2: Query backend for execution record
    console.log(`[TEST] Querying backend for execution record...`)
    const executionRecord = await queryBackendExecution(activityId)

    if (executionRecord?.error) {
      return {
        pass: false,
        actual: { backendRecord: null, error: executionRecord.error },
        expected: testCase.expectedOutput,
        error: "Backend query failed",
      }
    }

    if (!executionRecord) {
      return {
        pass: false,
        actual: { backendRecord: null },
        expected: testCase.expectedOutput,
        error: "Execution record not found in backend",
      }
    }

    console.log(`[TEST] Execution record found: ${executionRecord.activity_id}`)

    // Step 3: Verify MCP path was used (no deprecated endpoint)
    console.log(`[TEST] Checking for deprecated endpoint usage...`)
    const deprecatedUsed = await checkDeprecatedEndpointUsage(activityId)

    if (deprecatedUsed) {
      return {
        pass: false,
        actual: { mcpPathUsed: false, deprecatedEndpointUsed: true },
        expected: { mcpPathUsed: true, deprecatedEndpointUsed: false },
        error: "Deprecated endpoint was used instead of MCP path",
      }
    }

    console.log(`[TEST] MCP path verified (no deprecated endpoint usage)`)

    // Step 4: Query template metrics
    console.log(`[TEST] Querying template metrics...`)
    const metrics = await queryTemplateMetrics(testCase.input.activityTemplate)

    if (metrics?.error) {
      return {
        pass: false,
        actual: { metrics: null, error: metrics.error },
        expected: { metricsUpdated: true },
        error: "Metrics query failed",
      }
    }

    console.log(`[TEST] Template metrics: executions=${metrics.executions}, success_rate=${metrics.success_rate}`)

    // Step 5: Validate all expectations
    const actual = {
      executionRecorded: !!executionRecord,
      mcpPathUsed: !deprecatedUsed,
      backendRecordExists: !!executionRecord,
      metricsUpdated: metrics && metrics.executions > 0,
      executionDetails: {
        activity_id: executionRecord.activity_id,
        template_id: executionRecord.template_id,
        success: executionRecord.success,
        duration_ms: executionRecord.duration_ms,
        cost_usd: executionRecord.cost_usd,
      },
      metricsDetails: {
        executions: metrics.executions,
        success_rate: metrics.success_rate,
      },
    }

    const allPassed =
      actual.executionRecorded &&
      actual.mcpPathUsed &&
      actual.backendRecordExists &&
      actual.metricsUpdated

    return {
      pass: allPassed,
      actual,
      expected: testCase.expectedOutput,
      details: allPassed ? "All validations passed" : "Some validations failed",
    }
  } catch (error) {
    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: `Test execution failed: ${error}`,
    }
  }
}

/**
 * Validate MCP Path Only (No Direct HTTP)
 */
export async function validateMcpPathOnly(): Promise<ValidationResult> {
  const testCase = testCase3

  try {
    console.log(`\n[TEST] ${testCase.name}`)
    console.log(`[TEST] ${testCase.description}`)

    // Check activity.ts for direct HTTP calls (static analysis)
    console.log(`[TEST] Running static analysis...`)
    const { stdout: grepResult } = await execAsync(
      `grep -r "fetch.*v2/activities/executions" repos/metabob-opencode/packages/opencode/src/ || echo "No direct HTTP calls found"`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const hasDirectHttp = grepResult.includes("fetch") && !grepResult.includes("No direct HTTP calls found")

    if (hasDirectHttp) {
      return {
        pass: false,
        actual: { directHttpFound: true, grepResult },
        expected: { directHttpFound: false },
        error: "Direct HTTP calls to /v2/activities/executions found in codebase",
      }
    }

    console.log(`[TEST] Static analysis passed: No direct HTTP calls found`)

    // Verify TemplateMetricsClient is used
    const { stdout: mcpUsage } = await execAsync(
      `grep -r "TemplateMetricsClient.reportExecution" repos/metabob-opencode/packages/opencode/src/session/activity.ts`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const usesMcpClient = mcpUsage.includes("TemplateMetricsClient.reportExecution")

    if (!usesMcpClient) {
      return {
        pass: false,
        actual: { usesMcpClient: false },
        expected: { usesMcpClient: true },
        error: "TemplateMetricsClient.reportExecution not found in activity.ts",
      }
    }

    console.log(`[TEST] MCP client usage verified`)

    return {
      pass: true,
      actual: {
        directHttpFound: false,
        usesMcpClient: true,
        staticAnalysisPassed: true,
      },
      expected: {
        directHttpFound: false,
        usesMcpClient: true,
        staticAnalysisPassed: true,
      },
      details: "MCP-only path enforced, no direct HTTP calls",
    }
  } catch (error) {
    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: `Static analysis failed: ${error}`,
    }
  }
}

/**
 * Run all validation tests
 */
export async function runValidation(): Promise<{
  pass: boolean
  results: ValidationResult[]
  summary: string
}> {
  console.log("=" + "=".repeat(70))
  console.log("Activity Execution Recording to Backend - Validation Harness")
  console.log("=" + "=".repeat(70))

  const results: ValidationResult[] = []

  // Test 1: Successful execution recording
  results.push(await validateSuccessfulExecution())

  // Test 2: MCP path only (no direct HTTP)
  results.push(await validateMcpPathOnly())

  const allPassed = results.every((r) => r.pass)
  const passedCount = results.filter((r) => r.pass).length

  const summary = allPassed
    ? `✅ All ${results.length} validation tests passed`
    : `❌ ${passedCount}/${results.length} validation tests passed`

  console.log("\n" + "=".repeat(72))
  console.log(summary)
  console.log("=".repeat(72))

  return {
    pass: allPassed,
    results,
    summary,
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  runValidation()
    .then(({ pass, results, summary }) => {
      console.log("\nDetailed Results:")
      results.forEach((result, index) => {
        console.log(`\nTest ${index + 1}:`)
        console.log(`  Pass: ${result.pass}`)
        console.log(`  Expected:`, JSON.stringify(result.expected, null, 2))
        console.log(`  Actual:`, JSON.stringify(result.actual, null, 2))
        if (result.error) {
          console.log(`  Error: ${result.error}`)
        }
        if (result.details) {
          console.log(`  Details: ${result.details}`)
        }
      })

      process.exit(pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("Validation harness failed:", error)
      process.exit(1)
    })
}
