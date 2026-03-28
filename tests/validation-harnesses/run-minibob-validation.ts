#!/usr/bin/env bun
/**
 * Test Runner for minibob Complete System Integration Validation
 * 
 * Usage:
 *   bun run tests/validation-harnesses/run-minibob-validation.ts [flags] [testCase]
 * 
 * Flags:
 *   --dry-run              Validate prerequisites without running tests
 *   --check-prerequisites  Check if system is ready for validation
 *   --verbose             Show detailed output
 * 
 * Examples:
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 1              # Quick validation
 *   bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1    # Check prerequisites only
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 2              # Full validation
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 3              # Dev layer
 *   bun run tests/validation-harnesses/run-minibob-validation.ts 4              # Staging layer
 */

import runValidation, { type ValidationInput } from "./minibob-complete-system-integration-harness"
import * as path from "path"
import { 
  validatePrerequisites, 
  printPrerequisiteReport,
  COMMON_CHECKS,
  type PrerequisiteCheck 
} from "./lib/prerequisites"

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

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): { flags: string[], testCase: string } {
  const flags: string[] = []
  let testCase = "1"

  for (const arg of args) {
    if (arg.startsWith('--')) {
      flags.push(arg)
    } else if (testCases[arg]) {
      testCase = arg
    }
  }

  return { flags, testCase }
}

/**
 * Get prerequisite checks for a test case
 */
function getPrerequisiteChecks(input: ValidationInput): PrerequisiteCheck[] {
  const namespace = input.layer === 'dev' ? 'metabob' : 
                   input.layer === 'staging' ? 'staging-minibob' : 
                   'testing-minibob'

  return [
    COMMON_CHECKS.kubectl(),
    COMMON_CHECKS.helmfile(),
    COMMON_CHECKS.bun(),
    COMMON_CHECKS.docker(),
    COMMON_CHECKS.cluster(),
    COMMON_CHECKS.namespace(namespace),
    COMMON_CHECKS.namespace('metabob'), // Backend namespace
    COMMON_CHECKS.path(input.repoPath, 'minibob repository'),
    COMMON_CHECKS.path(input.helmPath, 'helm directory'),
    COMMON_CHECKS.path(path.join(input.repoPath, 'metrics'), 'metrics directory'),
    COMMON_CHECKS.deployment('metabob', 'metabob-rpc-api'),
    COMMON_CHECKS.pods(namespace, 'app=minibob'),
  ]
}

async function main() {
  const { flags, testCase: testCaseArg } = parseArgs(process.argv.slice(2))
  
  if (!testCases[testCaseArg]) {
    console.error(`Invalid test case: ${testCaseArg}`)
    console.error(`Valid options: 1 (quick), 2 (full), 3 (dev), 4 (staging)`)
    process.exit(1)
  }

  const input = testCases[testCaseArg]
  const dryRun = flags.includes('--dry-run') || flags.includes('--check-prerequisites')
  const verbose = flags.includes('--verbose')

  // If dry-run, validate prerequisites and exit
  if (dryRun) {
    console.log(`\n${"=".repeat(80)}`)
    console.log(`Prerequisite Check - Test Case ${testCaseArg}`)
    console.log(`Environment: ${input.environment}, Layer: ${input.layer}`)
    console.log(`${"=".repeat(80)}\n`)

    const checks = getPrerequisiteChecks(input)
    const report = await validatePrerequisites(checks)
    printPrerequisiteReport(report)

    if (!report.readyForValidation) {
      console.log('❌ System is NOT ready for validation')
      console.log('Please fix the failed checks above before running validation.\n')
      process.exit(1)
    }

    console.log('✅ System is ready for validation')
    console.log(`Run validation with: bun run tests/validation-harnesses/run-minibob-validation.ts ${testCaseArg}\n`)
    process.exit(0)
  }

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
