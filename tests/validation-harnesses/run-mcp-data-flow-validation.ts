#!/usr/bin/env bun

/**
 * Test Runner: MCP Data Flow Validation
 * 
 * Executes all validation test cases for the MCP data flow specification.
 * Reports results in structured format for analysis.
 */

import { runValidation, generateTestCase, type ValidationInput } from "./mcp-data-flow-devbob-cli-database-harness"
import * as fs from "fs"
import * as path from "path"

interface TestResult {
  caseNumber: number
  impulseId: string
  pass: boolean
  duration: number
  errors: string[]
  summary: string
}

async function main() {
  console.log("=".repeat(80))
  console.log("MCP Data Flow Validation Test Suite")
  console.log("=".repeat(80))
  console.log()

  const results: TestResult[] = []
  const startTime = Date.now()

  // Test Case 1: Basic Activity Execution
  console.log("Running Test Case 1: Basic Activity Execution...")
  const case1Start = Date.now()
  const case1Input: ValidationInput = {
    templateId: "simple-feature-add",
    variables: {
      featureName: "test-validation-feature",
      description: "Simple test feature for MCP data flow validation",
    },
    reason: "Validate MCP data flow end-to-end",
    expectedImpulseCount: 2,
    expectedComponentCount: 3,
  }

  try {
    const case1Result = await runValidation(case1Input)
    results.push({
      caseNumber: 1,
      impulseId: "validation-mcp-data-flow-devbob-cli-database-case-1",
      pass: case1Result.pass,
      duration: Date.now() - case1Start,
      errors: case1Result.errors,
      summary: generateSummary(case1Result),
    })
    console.log(`  ${case1Result.pass ? "✅ PASS" : "❌ FAIL"} (${Date.now() - case1Start}ms)`)
    if (!case1Result.pass) {
      console.log(`  Errors: ${case1Result.errors.join(", ")}`)
    }
  } catch (error) {
    results.push({
      caseNumber: 1,
      impulseId: "validation-mcp-data-flow-devbob-cli-database-case-1",
      pass: false,
      duration: Date.now() - case1Start,
      errors: [error instanceof Error ? error.message : String(error)],
      summary: "Test failed with exception",
    })
    console.log(`  ❌ FAIL - Exception: ${error}`)
  }
  console.log()

  // Test Case 2: Multiple Impulses
  console.log("Running Test Case 2: Multiple Impulses...")
  const case2Start = Date.now()
  const case2Input: ValidationInput = {
    templateId: "complex-feature-add",
    variables: {
      featureName: "multi-impulse-test",
      requiresContext: true,
      contextTypes: ["code-quality", "architecture", "patterns"],
    },
    reason: "Test MCP data flow with multiple impulse types",
    expectedImpulseCount: 5,
    expectedComponentCount: 8,
  }

  try {
    const case2Result = await runValidation(case2Input)
    results.push({
      caseNumber: 2,
      impulseId: "validation-mcp-data-flow-devbob-cli-database-case-2",
      pass: case2Result.pass,
      duration: Date.now() - case2Start,
      errors: case2Result.errors,
      summary: generateSummary(case2Result),
    })
    console.log(`  ${case2Result.pass ? "✅ PASS" : "❌ FAIL"} (${Date.now() - case2Start}ms)`)
    if (!case2Result.pass) {
      console.log(`  Errors: ${case2Result.errors.join(", ")}`)
    }
  } catch (error) {
    results.push({
      caseNumber: 2,
      impulseId: "validation-mcp-data-flow-devbob-cli-database-case-2",
      pass: false,
      duration: Date.now() - case2Start,
      errors: [error instanceof Error ? error.message : String(error)],
      summary: "Test failed with exception",
    })
    console.log(`  ❌ FAIL - Exception: ${error}`)
  }
  console.log()

  // Test Case 3: Failure Scenario
  console.log("Running Test Case 3: Failure Scenario...")
  const case3Start = Date.now()
  const case3Input: ValidationInput = {
    templateId: "intentional-failure-test",
    variables: {
      featureName: "failure-test",
      shouldFail: true,
      failureType: "validation",
    },
    reason: "Test MCP data flow for failed activities",
    expectedImpulseCount: 3,
    expectedComponentCount: 0,
  }

  try {
    const case3Result = await runValidation(case3Input)
    results.push({
      caseNumber: 3,
      impulseId: "validation-mcp-data-flow-devbob-cli-database-case-3",
      pass: case3Result.pass,
      duration: Date.now() - case3Start,
      errors: case3Result.errors,
      summary: generateSummary(case3Result),
    })
    console.log(`  ${case3Result.pass ? "✅ PASS" : "❌ FAIL"} (${Date.now() - case3Start}ms)`)
    if (!case3Result.pass) {
      console.log(`  Errors: ${case3Result.errors.join(", ")}`)
    }
  } catch (error) {
    results.push({
      caseNumber: 3,
      impulseId: "validation-mcp-data-flow-devbob-cli-database-case-3",
      pass: false,
      duration: Date.now() - case3Start,
      errors: [error instanceof Error ? error.message : String(error)],
      summary: "Test failed with exception",
    })
    console.log(`  ❌ FAIL - Exception: ${error}`)
  }
  console.log()

  // Summary
  const totalDuration = Date.now() - startTime
  const passedCount = results.filter((r) => r.pass).length
  const failedCount = results.filter((r) => !r.pass).length

  console.log("=".repeat(80))
  console.log("Test Results Summary")
  console.log("=".repeat(80))
  console.log(`Total Tests: ${results.length}`)
  console.log(`Passed: ${passedCount} ✅`)
  console.log(`Failed: ${failedCount} ❌`)
  console.log(`Duration: ${totalDuration}ms`)
  console.log()

  // Detailed results
  for (const result of results) {
    console.log(`Test Case ${result.caseNumber}: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`  Impulse: ${result.impulseId}`)
    console.log(`  Duration: ${result.duration}ms`)
    console.log(`  Summary: ${result.summary}`)
    if (result.errors.length > 0) {
      console.log(`  Errors:`)
      for (const error of result.errors) {
        console.log(`    - ${error}`)
      }
    }
    console.log()
  }

  // Save results to file
  const resultsFile = path.join(
    process.cwd(),
    "tests/validation-harnesses/mcp-data-flow-validation-results.json",
  )
  await Bun.write(
    resultsFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalDuration,
        totalTests: results.length,
        passed: passedCount,
        failed: failedCount,
        results,
      },
      null,
      2,
    ),
  )

  console.log(`Results saved to: ${resultsFile}`)
  console.log()

  // Exit with error code if any tests failed
  process.exit(failedCount > 0 ? 1 : 0)
}

function generateSummary(result: any): string {
  const parts: string[] = []

  if (result.results.activityExecution.exists) {
    parts.push(`Activity: ${result.results.activityExecution.impulsesUsedCount || 0} impulses`)
  }

  if (result.results.impulseUsage.recordsCreated) {
    parts.push(`DB: ${result.results.impulseUsage.recordCount || 0} records`)
  }

  if (result.results.mcpPayload.captured) {
    parts.push("MCP: captured")
  }

  if (parts.length === 0) {
    return "No data captured"
  }

  return parts.join(", ")
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
