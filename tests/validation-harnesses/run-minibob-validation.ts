#!/usr/bin/env bun
/**
 * Test Runner for minibob Complete System Integration Validation
 * 
 * Usage:
 *   bun run tests/validation-harnesses/run-minibob-validation.ts [testCase]
 * 
 * Examples:
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 1   # Quick validation
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 2   # Full validation
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 3   # Dev layer
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 4   # Staging layer
 */

import runValidation, { type ValidationInput } from "./minibob-complete-system-integration-harness"
import * as path from "path"

// Test cases matching impulses
const testCases: Record<string, ValidationInput> = {
  "1": {
    repoPath: path.resolve(__dirname, "../../repos/minibob"),
    helmPath: path.resolve(__dirname, "../../helm"),
    environment: "testing",
    layer: "testing-cluster",
    skipLongRunning: true
  },
  "2": {
    repoPath: path.resolve(__dirname, "../../repos/minibob"),
    helmPath: path.resolve(__dirname, "../../helm"),
    environment: "testing",
    layer: "testing-cluster",
    skipLongRunning: false
  },
  "3": {
    repoPath: path.resolve(__dirname, "../../repos/minibob"),
    helmPath: path.resolve(__dirname, "../../helm"),
    environment: "testing",
    layer: "dev",
    skipLongRunning: true
  },
  "4": {
    repoPath: path.resolve(__dirname, "../../repos/minibob"),
    helmPath: path.resolve(__dirname, "../../helm"),
    environment: "staging",
    layer: "staging",
    skipLongRunning: true
  }
}

async function main() {
  const testCaseArg = process.argv[2] || "1"
  
  if (!testCases[testCaseArg]) {
    console.error(`Invalid test case: ${testCaseArg}`)
    console.error(`Valid options: 1 (quick), 2 (full), 3 (dev), 4 (staging)`)
    process.exit(1)
  }

  const input = testCases[testCaseArg]

  console.log(`\n${"=".repeat(80)}`)
  console.log(`Running Test Case ${testCaseArg}`)
  console.log(`Environment: ${input.environment}, Layer: ${input.layer}`)
  console.log(`Skip Long Running: ${input.skipLongRunning}`)
  console.log(`${"=".repeat(80)}\n`)

  const result = await runValidation(input)

  console.log(`\n${"=".repeat(80)}`)
  console.log(`VALIDATION RESULTS`)
  console.log(`${"=".repeat(80)}`)
  console.log(`Status: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`Summary: ${result.summary}`)
  console.log(`Timestamp: ${result.timestamp}`)
  console.log(`\nStep Results:`)
  console.log(`${"=".repeat(80)}`)

  for (const step of result.steps) {
    const status = step.pass ? "✅" : "❌"
    console.log(`\n${status} Step ${step.step}: ${step.name}`)
    console.log(`   ${step.message}`)
    if (step.details && Object.keys(step.details).length > 0) {
      console.log(`   Details: ${JSON.stringify(step.details, null, 2).split('\n').slice(1, -1).join('\n   ')}`)
    }
  }

  console.log(`\n${"=".repeat(80)}`)
  console.log(`Final Status: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`${"=".repeat(80)}\n`)

  process.exit(result.pass ? 0 : 1)
}

main().catch(error => {
  console.error(`Fatal error: ${error}`)
  process.exit(1)
})
