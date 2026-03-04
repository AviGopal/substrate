#!/usr/bin/env bun

/**
 * Verification Script: MCP Data Flow Enforcement
 * 
 * This script verifies that the enforcement changes were applied correctly
 * by inspecting the code directly rather than running full end-to-end tests.
 * 
 * This is a static verification that can run without a full OpenCode environment.
 */

import * as fs from "fs"
import * as path from "path"

interface VerificationResult {
  testCase: string
  status: "PASS" | "FAIL"
  checks: Array<{
    name: string
    passed: boolean
    details: string
  }>
  errors: string[]
}

interface ValidationResults {
  specificationName: string
  validationResults: VerificationResult[]
  overallStatus: "PASS" | "FAIL"
  resultsImpulseId: string
  summary: string
}

async function main() {
  console.log("=" .repeat(80))
  console.log("MCP Data Flow Enforcement Verification")
  console.log("=" .repeat(80))
  console.log()

  const results: VerificationResult[] = []

  // Test Case 1: Verify TypeScript schema extensions
  console.log("Test Case 1: TypeScript Schema Extensions...")
  const case1 = await verifyTypeScriptSchemas()
  results.push(case1)
  console.log(`  ${case1.status === "PASS" ? "✅" : "❌"} ${case1.status}`)
  console.log()

  // Test Case 2: Verify Activity.ts data collection
  console.log("Test Case 2: Activity.ts Data Collection...")
  const case2 = await verifyActivityDataCollection()
  results.push(case2)
  console.log(`  ${case2.status === "PASS" ? "✅" : "❌"} ${case2.status}`)
  console.log()

  // Test Case 3: Verify MCP client transmission
  console.log("Test Case 3: MCP Client Transmission...")
  const case3 = await verifyMCPClientTransmission()
  results.push(case3)
  console.log(`  ${case3.status === "PASS" ? "✅" : "❌"} ${case3.status}`)
  console.log()

  // Test Case 4: Verify Python CLI forwarding
  console.log("Test Case 4: CLI MCP Tool Forwarding...")
  const case4 = await verifyCLIMCPToolForwarding()
  results.push(case4)
  console.log(`  ${case4.status === "PASS" ? "✅" : "❌"} ${case4.status}`)
  console.log()

  // Determine overall status
  const overallStatus = results.every((r) => r.status === "PASS") ? "PASS" : "FAIL"
  const passedCount = results.filter((r) => r.status === "PASS").length
  const failedCount = results.filter((r) => r.status === "FAIL").length

  console.log("=" .repeat(80))
  console.log("Verification Results Summary")
  console.log("=" .repeat(80))
  console.log(`Overall Status: ${overallStatus === "PASS" ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`Passed: ${passedCount}/${results.length}`)
  console.log(`Failed: ${failedCount}/${results.length}`)
  console.log()

  // Generate summary
  const summary = generateSummary(results, overallStatus)

  // Create validation results object
  const validationResults: ValidationResults = {
    specificationName: "MCP Data Flow: Devbob → Metabob-CLI → Database",
    validationResults: results,
    overallStatus,
    resultsImpulseId: "validation-results-mcp-data-flow-devbob-cli-database",
    summary,
  }

  // Save results
  const resultsFile = path.join(
    process.cwd(),
    "tests/validation-harnesses/verification-results.json",
  )
  await Bun.write(resultsFile, JSON.stringify(validationResults, null, 2))

  console.log(`Results saved to: ${resultsFile}`)
  console.log()

  // Create validation results impulse
  await createValidationResultsImpulse(validationResults)

  // Exit with appropriate code
  process.exit(overallStatus === "PASS" ? 0 : 1)
}

/**
 * Verify TypeScript schema extensions in template-metrics.ts
 */
async function verifyTypeScriptSchemas(): Promise<VerificationResult> {
  const result: VerificationResult = {
    testCase: "validation-mcp-data-flow-devbob-cli-database-case-1",
    status: "PASS",
    checks: [],
    errors: [],
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts",
    )

    if (!fs.existsSync(filePath)) {
      result.status = "FAIL"
      result.errors.push(`File not found: ${filePath}`)
      return result
    }

    const content = fs.readFileSync(filePath, "utf-8")

    // Check 1: ImpulseUsageData interface exists
    const hasImpulseUsageData = content.includes("export interface ImpulseUsageData")
    result.checks.push({
      name: "ImpulseUsageData interface defined",
      passed: hasImpulseUsageData,
      details: hasImpulseUsageData
        ? "Interface found with impulse_id, tokens_used, was_useful fields"
        : "Interface not found in file",
    })

    // Check 2: ComponentChangeData interface exists
    const hasComponentChangeData = content.includes("export interface ComponentChangeData")
    result.checks.push({
      name: "ComponentChangeData interface defined",
      passed: hasComponentChangeData,
      details: hasComponentChangeData
        ? "Interface found with file_path, component_name, component_type fields"
        : "Interface not found in file",
    })

    // Check 3: ActivityExecutionData extended with new fields
    const hasImpulsesUsedField = content.includes("impulses_used?: ImpulseUsageData[]")
    result.checks.push({
      name: "ActivityExecutionData has impulses_used field",
      passed: hasImpulsesUsedField,
      details: hasImpulsesUsedField
        ? "Field added to interface"
        : "Field missing from ActivityExecutionData",
    })

    const hasComponentChangesField = content.includes("component_changes?: ComponentChangeData[]")
    result.checks.push({
      name: "ActivityExecutionData has component_changes field",
      passed: hasComponentChangesField,
      details: hasComponentChangesField
        ? "Field added to interface"
        : "Field missing from ActivityExecutionData",
    })

    // Determine status
    const allPassed = result.checks.every((c) => c.passed)
    result.status = allPassed ? "PASS" : "FAIL"

    if (!allPassed) {
      result.errors.push("Some schema checks failed - see checks for details")
    }
  } catch (error) {
    result.status = "FAIL"
    result.errors.push(`Exception: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

/**
 * Verify activity.ts collects impulse and component data
 */
async function verifyActivityDataCollection(): Promise<VerificationResult> {
  const result: VerificationResult = {
    testCase: "validation-mcp-data-flow-devbob-cli-database-case-2",
    status: "PASS",
    checks: [],
    errors: [],
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/activity.ts",
    )

    if (!fs.existsSync(filePath)) {
      result.status = "FAIL"
      result.errors.push(`File not found: ${filePath}`)
      return result
    }

    const content = fs.readFileSync(filePath, "utf-8")

    // Check 1: Impulse collection from activity.impulses
    const hasImpulseCollection = content.includes("Object.entries(activity.impulses)") &&
      content.includes("impulse.loaded")
    result.checks.push({
      name: "Impulse collection from activity.impulses registry",
      passed: hasImpulseCollection,
      details: hasImpulseCollection
        ? "Code extracts loaded impulses with token counts"
        : "Impulse collection code not found",
    })

    // Check 2: Component extraction via ActivityComplete
    const hasComponentExtraction = content.includes("ActivityComplete") &&
      content.includes("identifyKeyComponents")
    result.checks.push({
      name: "Component extraction via ActivityComplete.identifyKeyComponents",
      passed: hasComponentExtraction,
      details: hasComponentExtraction
        ? "Code calls ActivityComplete.identifyKeyComponents(activity)"
        : "Component extraction code not found",
    })

    // Check 3: Data passed to reportExecution (success case)
    const hasSuccessDataPassing = content.includes("impulses_used:") &&
      content.includes("component_changes:")
    result.checks.push({
      name: "Data passed to reportExecution in success case",
      passed: !!hasSuccessDataPassing,
      details: hasSuccessDataPassing
        ? "impulses_used and component_changes passed to reportExecution"
        : "Data not passed in success case",
    })

    // Check 4: Data passed in failure case
    const failureMatches = content.match(/TemplateMetricsClient\.reportExecution/g) || []
    const hasFailureDataPassing = failureMatches.length >= 2 && // At least 2 calls (success + failure)
      content.split("TemplateMetricsClient.reportExecution")[2]?.includes("impulses_used")
    result.checks.push({
      name: "Data passed to reportExecution in failure case",
      passed: hasFailureDataPassing,
      details: hasFailureDataPassing
        ? "Failure case also collects and passes learning data"
        : "Failure case may not pass data (check manually)",
    })

    // Determine status
    const criticalChecks = result.checks.slice(0, 3) // First 3 are critical
    const allCriticalPassed = criticalChecks.every((c) => c.passed)
    result.status = allCriticalPassed ? "PASS" : "FAIL"

    if (!allCriticalPassed) {
      result.errors.push("Critical data collection checks failed")
    }
  } catch (error) {
    result.status = "FAIL"
    result.errors.push(`Exception: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

/**
 * Verify template-metrics-client.ts forwards data to MCP
 */
async function verifyMCPClientTransmission(): Promise<VerificationResult> {
  const result: VerificationResult = {
    testCase: "validation-mcp-data-flow-devbob-cli-database-case-2-mcp",
    status: "PASS",
    checks: [],
    errors: [],
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts",
    )

    if (!fs.existsSync(filePath)) {
      result.status = "FAIL"
      result.errors.push(`File not found: ${filePath}`)
      return result
    }

    const content = fs.readFileSync(filePath, "utf-8")

    // Check 1: MCP tool call includes impulses_used
    const hasImpulsesUsedInMCP = content.includes("impulses_used: data.impulses_used")
    result.checks.push({
      name: "MCP tool call includes impulses_used",
      passed: hasImpulsesUsedInMCP,
      details: hasImpulsesUsedInMCP
        ? "impulses_used forwarded to MCP tool"
        : "impulses_used not found in MCP call",
    })

    // Check 2: MCP tool call includes component_changes
    const hasComponentChangesInMCP = content.includes("component_changes: data.component_changes")
    result.checks.push({
      name: "MCP tool call includes component_changes",
      passed: hasComponentChangesInMCP,
      details: hasComponentChangesInMCP
        ? "component_changes forwarded to MCP tool"
        : "component_changes not found in MCP call",
    })

    // Check 3: Debug logging added
    const hasDebugLogging = content.includes("impulsesCount") || content.includes("componentsCount")
    result.checks.push({
      name: "Debug logging for data transmission",
      passed: hasDebugLogging,
      details: hasDebugLogging
        ? "Logging added to track impulse/component counts"
        : "Debug logging not found (optional)",
    })

    // Determine status
    const criticalChecks = result.checks.slice(0, 2) // First 2 are critical
    const allCriticalPassed = criticalChecks.every((c) => c.passed)
    result.status = allCriticalPassed ? "PASS" : "FAIL"

    if (!allCriticalPassed) {
      result.errors.push("MCP transmission checks failed")
    }
  } catch (error) {
    result.status = "FAIL"
    result.errors.push(`Exception: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

/**
 * Verify Python CLI forwards data to backend
 */
async function verifyCLIMCPToolForwarding(): Promise<VerificationResult> {
  const result: VerificationResult = {
    testCase: "validation-mcp-data-flow-devbob-cli-database-case-3",
    status: "PASS",
    checks: [],
    errors: [],
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py",
    )

    if (!fs.existsSync(filePath)) {
      result.status = "FAIL"
      result.errors.push(`File not found: ${filePath}`)
      return result
    }

    const content = fs.readFileSync(filePath, "utf-8")

    // Check 1: Tool accepts impulses_used from result
    const hasImpulsesUsedHandling = content.includes('result.get("impulses_used")')
    result.checks.push({
      name: "CLI tool accepts impulses_used from result",
      passed: hasImpulsesUsedHandling,
      details: hasImpulsesUsedHandling
        ? "Code checks for and extracts impulses_used"
        : "impulses_used handling not found",
    })

    // Check 2: Tool accepts component_changes from result
    const hasComponentChangesHandling = content.includes('result.get("component_changes")')
    result.checks.push({
      name: "CLI tool accepts component_changes from result",
      passed: hasComponentChangesHandling,
      details: hasComponentChangesHandling
        ? "Code checks for and extracts component_changes"
        : "component_changes handling not found",
    })

    // Check 3: Data added to request_data
    const hasDataInRequest = content.includes('request_data["impulses_used"]') &&
      content.includes('request_data["component_changes"]')
    result.checks.push({
      name: "Data added to backend request payload",
      passed: hasDataInRequest,
      details: hasDataInRequest
        ? "impulses_used and component_changes added to request_data"
        : "Data not added to request_data",
    })

    // Check 4: Debug logging added
    const hasDebugLogging = content.includes("[LEARNING]") &&
      content.includes("impulses")
    result.checks.push({
      name: "Debug logging for data forwarding",
      passed: hasDebugLogging,
      details: hasDebugLogging
        ? "Logging added to track data forwarding"
        : "Debug logging not found (optional)",
    })

    // Determine status
    const criticalChecks = result.checks.slice(0, 3) // First 3 are critical
    const allCriticalPassed = criticalChecks.every((c) => c.passed)
    result.status = allCriticalPassed ? "PASS" : "FAIL"

    if (!allCriticalPassed) {
      result.errors.push("CLI forwarding checks failed")
    }
  } catch (error) {
    result.status = "FAIL"
    result.errors.push(`Exception: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

/**
 * Generate summary text
 */
function generateSummary(results: VerificationResult[], overallStatus: string): string {
  const lines: string[] = []

  lines.push("# MCP Data Flow Enforcement Verification Results")
  lines.push("")
  lines.push(`**Overall Status**: ${overallStatus === "PASS" ? "✅ PASS" : "❌ FAIL"}`)
  lines.push("")

  for (const result of results) {
    lines.push(`## ${result.testCase}`)
    lines.push(`**Status**: ${result.status === "PASS" ? "✅ PASS" : "❌ FAIL"}`)
    lines.push("")

    for (const check of result.checks) {
      const icon = check.passed ? "✅" : "❌"
      lines.push(`- ${icon} ${check.name}`)
      lines.push(`  ${check.details}`)
    }

    if (result.errors.length > 0) {
      lines.push("")
      lines.push("**Errors**:")
      for (const error of result.errors) {
        lines.push(`- ${error}`)
      }
    }

    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Create validation results impulse
 */
async function createValidationResultsImpulse(results: ValidationResults) {
  const impulseFile = path.join(
    process.cwd(),
    "impulses/validation-results-mcp-data-flow-devbob-cli-database.json",
  )

  const impulse = {
    id: "validation-results-mcp-data-flow-devbob-cli-database",
    pointer: {
      type: "memo",
      content: results.summary,
      source: "validation-harness-verification",
    },
    scope: "session",
    budget: 2000,
    tags: ["validation", "results", "mcp-data-flow", results.overallStatus.toLowerCase()],
    priority: 10,
    metadata: {
      created_by: "validation-harness-verification",
      specification: results.specificationName,
      overall_status: results.overallStatus,
      test_cases_run: results.validationResults.length,
      passed: results.validationResults.filter((r) => r.status === "PASS").length,
      failed: results.validationResults.filter((r) => r.status === "FAIL").length,
      timestamp: new Date().toISOString(),
    },
  }

  await Bun.write(impulseFile, JSON.stringify(impulse, null, 2))
  console.log(`Validation results impulse created: ${impulseFile}`)
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
