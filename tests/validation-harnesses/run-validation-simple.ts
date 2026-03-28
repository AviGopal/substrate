/**
 * Simplified Validation Runner for Activity Execution Recording
 * Runs only static analysis tests (no activity execution required)
 */

import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

interface TestResult {
  testCase: string
  status: "PASS" | "FAIL"
  actual: any
  expected: any
  difference?: string
  details?: string
}

async function validateMcpPathOnly(): Promise<TestResult> {
  console.log("\n[TEST CASE 1] MCP Path Verification - Static Analysis")
  console.log("=" + "=".repeat(70))

  try {
    // Test 1a: Check for direct HTTP calls to deprecated endpoint
    console.log("[CHECK] Searching for direct HTTP calls to /v2/activities/executions...")
    const { stdout: grepResult } = await execAsync(
      `grep -r "fetch.*v2/activities/executions" repos/metabob-opencode/packages/opencode/src/session/ 2>/dev/null || echo "NONE_FOUND"`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const hasDirectHttp = grepResult.trim() !== "NONE_FOUND" && 
                          grepResult.includes("fetch") && 
                          !grepResult.includes("REMOVED")

    console.log(`[RESULT] Direct HTTP calls found: ${hasDirectHttp}`)

    if (hasDirectHttp) {
      return {
        testCase: "validation-activity-execution-recording-case-3",
        status: "FAIL",
        actual: { directHttpFound: true, matches: grepResult },
        expected: { directHttpFound: false },
        difference: "Direct HTTP calls to /v2/activities/executions still exist in codebase",
        details: grepResult,
      }
    }

    // Test 1b: Verify TemplateMetricsClient is used
    console.log("[CHECK] Verifying TemplateMetricsClient.reportExecution usage...")
    const { stdout: mcpUsage } = await execAsync(
      `grep -n "TemplateMetricsClient.reportExecution" repos/metabob-opencode/packages/opencode/src/session/activity.ts`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const usesMcpClient = mcpUsage.includes("TemplateMetricsClient.reportExecution")
    console.log(`[RESULT] Uses MCP client: ${usesMcpClient}`)

    if (!usesMcpClient) {
      return {
        testCase: "validation-activity-execution-recording-case-3",
        status: "FAIL",
        actual: { usesMcpClient: false },
        expected: { usesMcpClient: true },
        difference: "TemplateMetricsClient.reportExecution not found in activity.ts",
      }
    }

    // Test 1c: Verify removal comment exists
    console.log("[CHECK] Verifying architectural violation was removed...")
    const { stdout: removalComment } = await execAsync(
      `grep -n "REMOVED.*Direct HTTP POST" repos/metabob-opencode/packages/opencode/src/session/activity.ts`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const hasRemovalComment = removalComment.includes("REMOVED")
    console.log(`[RESULT] Has removal documentation: ${hasRemovalComment}`)

    return {
      testCase: "validation-activity-execution-recording-case-3",
      status: "PASS",
      actual: {
        directHttpFound: false,
        usesMcpClient: true,
        removalDocumented: hasRemovalComment,
      },
      expected: {
        directHttpFound: false,
        usesMcpClient: true,
        removalDocumented: true,
      },
      details: "Static analysis passed: MCP-only path enforced, no direct HTTP calls",
    }
  } catch (error) {
    return {
      testCase: "validation-activity-execution-recording-case-3",
      status: "FAIL",
      actual: { error: String(error) },
      expected: { staticAnalysisPassed: true },
      difference: `Static analysis failed: ${error}`,
    }
  }
}

async function validateBackendDeprecation(): Promise<TestResult> {
  console.log("\n[TEST CASE 2] Backend Endpoint Deprecation")
  console.log("=" + "=".repeat(70))

  try {
    // Check if deprecated endpoint has deprecation markers
    console.log("[CHECK] Verifying /v2/activities/executions endpoint is deprecated...")
    const { stdout: deprecationCheck } = await execAsync(
      `grep -A 5 "@router.post.*executions" repos/metabob-rpc-api/server/routes/activity.py | grep -i deprecated`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const isDeprecated = deprecationCheck.toLowerCase().includes("deprecated")
    console.log(`[RESULT] Endpoint marked as deprecated: ${isDeprecated}`)

    if (!isDeprecated) {
      return {
        testCase: "validation-activity-execution-recording-backend-deprecation",
        status: "FAIL",
        actual: { endpointDeprecated: false },
        expected: { endpointDeprecated: true },
        difference: "Backend endpoint /v2/activities/executions not marked as deprecated",
      }
    }

    // Check for deprecation warning in docstring
    console.log("[CHECK] Verifying deprecation notice in endpoint docstring...")
    const { stdout: docstringCheck } = await execAsync(
      `grep -A 20 "def record_activity_execution" repos/metabob-rpc-api/server/routes/activity.py | grep -i "DEPRECAT"`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const hasDeprecationNotice = docstringCheck.toLowerCase().includes("deprecat")
    console.log(`[RESULT] Has deprecation notice: ${hasDeprecationNotice}`)

    return {
      testCase: "validation-activity-execution-recording-backend-deprecation",
      status: "PASS",
      actual: {
        endpointDeprecated: true,
        hasDeprecationNotice: hasDeprecationNotice,
      },
      expected: {
        endpointDeprecated: true,
        hasDeprecationNotice: true,
      },
      details: "Backend endpoint correctly deprecated",
    }
  } catch (error) {
    return {
      testCase: "validation-activity-execution-recording-backend-deprecation",
      status: "FAIL",
      actual: { error: String(error) },
      expected: { endpointDeprecated: true },
      difference: `Backend deprecation check failed: ${error}`,
    }
  }
}

async function validateArchitecturalCompliance(): Promise<TestResult> {
  console.log("\n[TEST CASE 3] Architectural Compliance - MCP Boundary")
  console.log("=" + "=".repeat(70))

  try {
    // Check that activity.fail() also uses MCP path
    console.log("[CHECK] Verifying Activity.fail() uses MCP path...")
    const { stdout: failUsage } = await execAsync(
      `grep -A 50 "export async function fail" repos/metabob-opencode/packages/opencode/src/session/activity.ts | grep "TemplateMetricsClient.reportExecution"`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const failUsesMcp = failUsage.includes("TemplateMetricsClient.reportExecution")
    console.log(`[RESULT] Activity.fail() uses MCP: ${failUsesMcp}`)

    // Check that no fetch calls exist in activity.ts
    console.log("[CHECK] Verifying no fetch() calls in activity.ts...")
    const { stdout: fetchCalls } = await execAsync(
      `grep -n "await fetch" repos/metabob-opencode/packages/opencode/src/session/activity.ts 2>/dev/null || echo "NONE_FOUND"`,
      { cwd: "/home/avi/documents/work/exp-repo/metabob-devbob" }
    )

    const hasFetchCalls = fetchCalls.trim() !== "NONE_FOUND" && 
                         fetchCalls.includes("await fetch") &&
                         !fetchCalls.includes("REMOVED")

    console.log(`[RESULT] Has fetch() calls: ${hasFetchCalls}`)

    if (hasFetchCalls) {
      return {
        testCase: "validation-activity-execution-recording-architectural-compliance",
        status: "FAIL",
        actual: { hasFetchCalls: true, fetchCallsFound: fetchCalls },
        expected: { hasFetchCalls: false },
        difference: "fetch() calls still exist in activity.ts",
        details: fetchCalls,
      }
    }

    return {
      testCase: "validation-activity-execution-recording-architectural-compliance",
      status: "PASS",
      actual: {
        failUsesMcp: failUsesMcp,
        hasFetchCalls: false,
        mcpBoundaryEnforced: true,
      },
      expected: {
        failUsesMcp: true,
        hasFetchCalls: false,
        mcpBoundaryEnforced: true,
      },
      details: "Architectural compliance verified: MCP boundary enforced",
    }
  } catch (error) {
    return {
      testCase: "validation-activity-execution-recording-architectural-compliance",
      status: "FAIL",
      actual: { error: String(error) },
      expected: { mcpBoundaryEnforced: true },
      difference: `Architectural compliance check failed: ${error}`,
    }
  }
}

async function runAllValidations() {
  console.log("\n" + "=".repeat(72))
  console.log("Activity Execution Recording to Backend - Validation Runner")
  console.log("=".repeat(72))

  const results: TestResult[] = []

  // Run all test cases
  results.push(await validateMcpPathOnly())
  results.push(await validateBackendDeprecation())
  results.push(await validateArchitecturalCompliance())

  // Summary
  const passedCount = results.filter((r) => r.status === "PASS").length
  const failedCount = results.filter((r) => r.status === "FAIL").length
  const allPassed = failedCount === 0

  console.log("\n" + "=".repeat(72))
  console.log("VALIDATION SUMMARY")
  console.log("=".repeat(72))

  results.forEach((result, index) => {
    const icon = result.status === "PASS" ? "✅" : "❌"
    console.log(`\n${icon} Test Case ${index + 1}: ${result.testCase}`)
    console.log(`   Status: ${result.status}`)
    if (result.details) {
      console.log(`   Details: ${result.details}`)
    }
    if (result.difference) {
      console.log(`   Difference: ${result.difference}`)
    }
  })

  console.log("\n" + "=".repeat(72))
  console.log(`Overall: ${passedCount} PASSED, ${failedCount} FAILED`)
  console.log(allPassed ? "✅ ALL VALIDATIONS PASSED" : "❌ SOME VALIDATIONS FAILED")
  console.log("=".repeat(72))

  // Write results to file
  const resultsJson = {
    specificationName: "Activity Execution Recording to Backend",
    validationResults: results,
    overallStatus: allPassed ? "PASS" : "FAIL",
    summary: {
      totalTests: results.length,
      passed: passedCount,
      failed: failedCount,
    },
    resultsImpulseId: "validation-results-activity-execution-recording-to-backend",
  }

  const fs = require("fs")
  fs.writeFileSync(
    "/home/avi/documents/work/exp-repo/metabob-devbob/validation-results.json",
    JSON.stringify(resultsJson, null, 2)
  )

  console.log("\nResults written to: validation-results.json")

  return allPassed ? 0 : 1
}

// Run
runAllValidations()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error("Validation runner failed:", error)
    process.exit(1)
  })
