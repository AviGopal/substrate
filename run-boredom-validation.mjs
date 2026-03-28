#!/usr/bin/env node
/**
 * Validation Test Runner for Boredom Activity Detection Mechanism
 * 
 * This script runs the validation harness without requiring the full build.
 * It manually executes each test case and captures results.
 */

import { Activity } from "./repos/metabob-opencode/packages/opencode/src/session/activity.js"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Detection methods (copied from harness)
const DetectionMethods = {
  detectByTitlePrefix(activity) {
    return activity.title.includes('[BOREDOM]') || activity.title.includes('[MANUAL BOREDOM]')
  },
  
  detectByBranch(activity) {
    return activity.branch === 'boredom-activity'
  },
  
  detectByPersistentField(activity) {
    return activity.isBoredom === true
  },
  
  isBoredomActivity(activity) {
    return (
      this.detectByPersistentField(activity) ||
      this.detectByTitlePrefix(activity) ||
      this.detectByBranch(activity)
    )
  }
}

// Load test cases
function loadTestCases() {
  const testCasesPath = path.join(__dirname, "impulses/validation-test-cases")
  const testCases = []
  
  const files = fs.readdirSync(testCasesPath)
  files.forEach((file) => {
    if (file.startsWith("validation-boredom-activity-detection-mechanism-case-")) {
      const content = fs.readFileSync(path.join(testCasesPath, file), "utf-8")
      const testCase = JSON.parse(content)
      testCases.push(testCase)
    }
  })
  
  return testCases.sort((a, b) => a.id.localeCompare(b.id))
}

// Run a single validation test
async function runValidation(testCase) {
  const errors = []
  
  try {
    // Create activity with test input
    const activity = await Activity.create({
      directory: process.cwd(),
      branch: testCase.input.branch || "main",
      baseCommit: "HEAD",
      title: testCase.input.title,
    })
    
    // Capture actual detection results
    const actual = {
      isBoredom: activity.isBoredom,
      initiatedBy: activity.initiatedBy,
      branch: activity.branch,
      titleHasBoredomPrefix: DetectionMethods.detectByTitlePrefix(activity),
      detectionMethods: {
        titlePrefix: DetectionMethods.detectByTitlePrefix(activity),
        branchName: DetectionMethods.detectByBranch(activity),
        persistentField: DetectionMethods.detectByPersistentField(activity),
      },
    }
    
    // Compare against expected output
    const expected = testCase.expectedOutput
    
    // Check each field
    if (actual.isBoredom !== expected.isBoredom) {
      errors.push(`isBoredom: expected ${expected.isBoredom}, got ${actual.isBoredom}`)
    }
    
    if (expected.initiatedBy !== undefined && actual.initiatedBy !== expected.initiatedBy) {
      errors.push(`initiatedBy: expected ${expected.initiatedBy}, got ${actual.initiatedBy}`)
    }
    
    if (actual.branch !== expected.branch) {
      errors.push(`branch: expected ${expected.branch}, got ${actual.branch}`)
    }
    
    if (actual.titleHasBoredomPrefix !== expected.titleHasBoredomPrefix) {
      errors.push(`titleHasBoredomPrefix: expected ${expected.titleHasBoredomPrefix}, got ${actual.titleHasBoredomPrefix}`)
    }
    
    // Check detection methods
    Object.keys(expected.detectionMethods).forEach((method) => {
      const expectedValue = expected.detectionMethods[method]
      const actualValue = actual.detectionMethods[method]
      if (actualValue !== expectedValue) {
        errors.push(`detectionMethods.${method}: expected ${expectedValue}, got ${actualValue}`)
      }
    })
    
    // Clean up
    await Activity.remove(activity.id)
    
    return {
      testCase: testCase.id,
      name: testCase.name,
      status: errors.length === 0 ? "PASS" : "FAIL",
      actual,
      expected,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    return {
      testCase: testCase.id,
      name: testCase.name,
      status: "FAIL",
      actual: null,
      expected: testCase.expectedOutput,
      errors: [`Execution error: ${error.message}`],
    }
  }
}

// Main execution
async function main() {
  console.log("🔍 Running Boredom Activity Detection Mechanism Validation\n")
  
  const testCases = loadTestCases()
  console.log(`Loaded ${testCases.length} test cases\n`)
  
  const results = []
  
  for (const testCase of testCases) {
    console.log(`Running: ${testCase.name}...`)
    const result = await runValidation(testCase)
    results.push(result)
    console.log(`  ${result.status === "PASS" ? "✅ PASS" : "❌ FAIL"}`)
    if (result.errors) {
      result.errors.forEach(err => console.log(`    - ${err}`))
    }
    console.log()
  }
  
  // Summary
  const passed = results.filter(r => r.status === "PASS").length
  const failed = results.filter(r => r.status === "FAIL").length
  
  console.log("=" .repeat(60))
  console.log(`\n📊 Validation Summary`)
  console.log(`   Total:  ${results.length}`)
  console.log(`   Passed: ${passed} ✅`)
  console.log(`   Failed: ${failed} ❌`)
  console.log(`   Rate:   ${((passed / results.length) * 100).toFixed(1)}%\n`)
  
  // Write results to file
  const output = {
    specificationName: "boredom-activity-detection-mechanism",
    timestamp: new Date().toISOString(),
    validationResults: results,
    overallStatus: failed === 0 ? "PASS" : "FAIL",
    summary: {
      total: results.length,
      passed,
      failed,
      successRate: `${((passed / results.length) * 100).toFixed(1)}%`
    },
    resultsImpulseId: "validation-results-boredom-activity-detection-mechanism"
  }
  
  const outputPath = path.join(__dirname, "VALIDATION_RESULTS_BOREDOM_ACTIVITY_DETECTION_MECHANISM.json")
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`📄 Results saved to: ${outputPath}\n`)
  
  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("❌ Validation runner failed:", error)
  process.exit(1)
})
