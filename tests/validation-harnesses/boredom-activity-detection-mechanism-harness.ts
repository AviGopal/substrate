/**
 * Validation Harness: Boredom Activity Detection Mechanism
 * 
 * Tests all detection mechanisms and integration points for boredom activities.
 * Validates that activities can be reliably identified as boredom-triggered through:
 * - Title prefix markers ([BOREDOM], [MANUAL BOREDOM])
 * - Branch name (boredom-activity)
 * - Persistent schema fields (isBoredom, initiatedBy)
 * - Runtime state flags (BoredomManager.isExecutingBoredomActivity)
 * - Stats API exposure (BoredomStatus)
 */

import { Activity } from "../../repos/metabob-opencode/packages/opencode/src/session/activity.js"
import { BoredomManager } from "../../repos/metabob-opencode/packages/opencode/src/session/boredom-manager.js"
import * as fs from "fs"
import * as path from "path"

export interface ValidationResult {
  pass: boolean
  testCase: string
  actual: any
  expected: any
  errors?: string[]
}

export interface TestCase {
  id: string
  name: string
  input: {
    title: string
    branch?: string
    isBoredom?: boolean
    initiatedBy?: "user" | "boredom-auto" | "boredom-manual"
  }
  expectedOutput: {
    isBoredom: boolean
    initiatedBy?: "user" | "boredom-auto" | "boredom-manual"
    branch: string
    titleHasBoredomPrefix: boolean
    detectionMethods: {
      titlePrefix: boolean
      branchName: boolean
      persistentField: boolean
    }
  }
}

/**
 * Detection method implementations
 */
export const DetectionMethods = {
  /**
   * Method 1: Title Prefix Detection
   */
  detectByTitlePrefix(activity: Activity.Info): boolean {
    return activity.title.includes('[BOREDOM]') || activity.title.includes('[MANUAL BOREDOM]')
  },

  /**
   * Method 2: Branch Name Detection
   */
  detectByBranch(activity: Activity.Info): boolean {
    return activity.branch === 'boredom-activity'
  },

  /**
   * Method 3: Persistent Field Detection (most reliable)
   */
  detectByPersistentField(activity: Activity.Info): boolean {
    return activity.isBoredom === true
  },

  /**
   * Combined detection (any method returns true)
   */
  isBoredomActivity(activity: Activity.Info): boolean {
    return (
      this.detectByPersistentField(activity) ||
      this.detectByTitlePrefix(activity) ||
      this.detectByBranch(activity)
    )
  },
}

/**
 * Validation assertions
 */
export const Assertions = {
  /**
   * Assert that all boredom markers are consistent
   */
  assertMarkersConsistent(activity: Activity.Info): { pass: boolean; errors: string[] } {
    const errors: string[] = []
    const hasPrefix = DetectionMethods.detectByTitlePrefix(activity)
    const hasBranch = DetectionMethods.detectByBranch(activity)
    const hasFlag = activity.isBoredom === true

    // If any marker is present, all should be present
    if (hasPrefix || hasBranch || hasFlag) {
      if (!hasPrefix) {
        errors.push("Activity has boredom markers but title lacks [BOREDOM] prefix")
      }
      if (!hasBranch) {
        errors.push("Activity has boredom markers but branch is not 'boredom-activity'")
      }
      if (!hasFlag) {
        errors.push("Activity has boredom markers but isBoredom field is not true")
      }
    }

    return { pass: errors.length === 0, errors }
  },

  /**
   * Assert that initiatedBy is set correctly based on title
   */
  assertInitiatedByCorrect(activity: Activity.Info): { pass: boolean; errors: string[] } {
    const errors: string[] = []

    if (activity.title.includes('[MANUAL BOREDOM]')) {
      if (activity.initiatedBy !== 'boredom-manual') {
        errors.push(`Expected initiatedBy='boredom-manual' for [MANUAL BOREDOM] activity, got '${activity.initiatedBy}'`)
      }
    } else if (activity.title.includes('[BOREDOM]')) {
      if (activity.initiatedBy !== 'boredom-auto') {
        errors.push(`Expected initiatedBy='boredom-auto' for [BOREDOM] activity, got '${activity.initiatedBy}'`)
      }
    }

    return { pass: errors.length === 0, errors }
  },

  /**
   * Assert that no debug prefix interferes with detection
   */
  assertNoDebugPrefix(activity: Activity.Info): { pass: boolean; errors: string[] } {
    const errors: string[] = []

    if (activity.title.includes('[EVIDENCE_TEST]')) {
      errors.push("Activity title contains [EVIDENCE_TEST] debug prefix (should be removed)")
    }

    return { pass: errors.length === 0, errors }
  },
}

/**
 * Run validation for a single test case
 */
export async function runValidation(testCase: TestCase): Promise<ValidationResult> {
  const errors: string[] = []

  try {
    // Create activity with test input
    const activity = await Activity.create({
      directory: process.cwd(),
      branch: testCase.input.branch || "main",
      baseCommit: "HEAD",
      title: testCase.input.title,
    })

    // If test case specifies persistent fields, set them manually
    if (testCase.input.isBoredom !== undefined) {
      activity.isBoredom = testCase.input.isBoredom
    }
    if (testCase.input.initiatedBy !== undefined) {
      activity.initiatedBy = testCase.input.initiatedBy
    }

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

    // Run assertions
    const markerConsistency = Assertions.assertMarkersConsistent(activity)
    if (!markerConsistency.pass) {
      errors.push(...markerConsistency.errors)
    }

    const initiatedByCheck = Assertions.assertInitiatedByCorrect(activity)
    if (!initiatedByCheck.pass) {
      errors.push(...initiatedByCheck.errors)
    }

    const debugPrefixCheck = Assertions.assertNoDebugPrefix(activity)
    if (!debugPrefixCheck.pass) {
      errors.push(...debugPrefixCheck.errors)
    }

    // Compare against expected output
    const expected = testCase.expectedOutput

    // Check each field
    if (actual.isBoredom !== expected.isBoredom) {
      errors.push(`isBoredom mismatch: expected ${expected.isBoredom}, got ${actual.isBoredom}`)
    }

    if (expected.initiatedBy && actual.initiatedBy !== expected.initiatedBy) {
      errors.push(`initiatedBy mismatch: expected ${expected.initiatedBy}, got ${actual.initiatedBy}`)
    }

    if (actual.branch !== expected.branch) {
      errors.push(`branch mismatch: expected ${expected.branch}, got ${actual.branch}`)
    }

    if (actual.titleHasBoredomPrefix !== expected.titleHasBoredomPrefix) {
      errors.push(`titleHasBoredomPrefix mismatch: expected ${expected.titleHasBoredomPrefix}, got ${actual.titleHasBoredomPrefix}`)
    }

    // Check detection methods
    Object.keys(expected.detectionMethods).forEach((method) => {
      const expectedValue = expected.detectionMethods[method as keyof typeof expected.detectionMethods]
      const actualValue = actual.detectionMethods[method as keyof typeof actual.detectionMethods]
      if (actualValue !== expectedValue) {
        errors.push(`detectionMethods.${method} mismatch: expected ${expectedValue}, got ${actualValue}`)
      }
    })

    // Clean up
    await Activity.remove(activity.id)

    return {
      pass: errors.length === 0,
      testCase: testCase.name,
      actual,
      expected,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    return {
      pass: false,
      testCase: testCase.name,
      actual: null,
      expected: testCase.expectedOutput,
      errors: [`Execution error: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

/**
 * Run all validation test cases
 */
export async function runAllValidations(testCases: TestCase[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []

  for (const testCase of testCases) {
    const result = await runValidation(testCase)
    results.push(result)
  }

  return results
}

/**
 * Generate validation report
 */
export function generateReport(results: ValidationResult[]): string {
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  const total = results.length

  let report = `# Boredom Activity Detection Mechanism - Validation Report\n\n`
  report += `**Total Tests**: ${total}\n`
  report += `**Passed**: ${passed} ✅\n`
  report += `**Failed**: ${failed} ❌\n`
  report += `**Success Rate**: ${((passed / total) * 100).toFixed(1)}%\n\n`

  report += `---\n\n`

  results.forEach((result, idx) => {
    const status = result.pass ? "✅ PASS" : "❌ FAIL"
    report += `## Test ${idx + 1}: ${result.testCase} ${status}\n\n`

    if (!result.pass && result.errors) {
      report += `**Errors**:\n`
      result.errors.forEach((err) => {
        report += `- ${err}\n`
      })
      report += `\n`
    }

    report += `**Expected**:\n\`\`\`json\n${JSON.stringify(result.expected, null, 2)}\n\`\`\`\n\n`
    report += `**Actual**:\n\`\`\`json\n${JSON.stringify(result.actual, null, 2)}\n\`\`\`\n\n`
    report += `---\n\n`
  })

  return report
}

/**
 * Main entry point for running validation harness
 */
export async function main() {
  console.log("🔍 Running Boredom Activity Detection Mechanism Validation Harness\n")

  // Load test cases from impulses directory
  const testCasesPath = path.join(__dirname, "../../impulses/validation-test-cases")
  const testCases: TestCase[] = []

  // If impulses directory exists, load test cases
  if (fs.existsSync(testCasesPath)) {
    const files = fs.readdirSync(testCasesPath)
    files.forEach((file) => {
      if (file.startsWith("validation-boredom-activity-detection-mechanism-case-")) {
        const content = fs.readFileSync(path.join(testCasesPath, file), "utf-8")
        const testCase = JSON.parse(content)
        testCases.push(testCase)
      }
    })
  }

  // If no impulses found, use inline test cases
  if (testCases.length === 0) {
    console.log("ℹ️  No impulse test cases found, using inline test cases\n")
    testCases.push(...getInlineTestCases())
  }

  console.log(`Running ${testCases.length} test cases...\n`)

  const results = await runAllValidations(testCases)
  const report = generateReport(results)

  // Write report to file
  const reportPath = path.join(__dirname, "../../validation-report-boredom-detection.md")
  fs.writeFileSync(reportPath, report)

  console.log(report)
  console.log(`\n📄 Report saved to: ${reportPath}`)

  // Exit with error code if any tests failed
  const failed = results.filter((r) => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
}

/**
 * Inline test cases (used if impulses not available)
 */
function getInlineTestCases(): TestCase[] {
  return [
    {
      id: "validation-boredom-activity-detection-mechanism-case-1",
      name: "Auto Boredom Activity with [BOREDOM] Prefix",
      input: {
        title: "[BOREDOM] fix-auth-failures",
        branch: "boredom-activity",
      },
      expectedOutput: {
        isBoredom: true,
        initiatedBy: "boredom-auto",
        branch: "boredom-activity",
        titleHasBoredomPrefix: true,
        detectionMethods: {
          titlePrefix: true,
          branchName: true,
          persistentField: true,
        },
      },
    },
    {
      id: "validation-boredom-activity-detection-mechanism-case-2",
      name: "Manual Boredom Activity with [MANUAL BOREDOM] Prefix",
      input: {
        title: "[MANUAL BOREDOM] improve-test-coverage",
        branch: "main",
      },
      expectedOutput: {
        isBoredom: true,
        initiatedBy: "boredom-manual",
        branch: "boredom-activity", // Should be auto-corrected
        titleHasBoredomPrefix: true,
        detectionMethods: {
          titlePrefix: true,
          branchName: true,
          persistentField: true,
        },
      },
    },
    {
      id: "validation-boredom-activity-detection-mechanism-case-3",
      name: "Normal User Activity (No Boredom Markers)",
      input: {
        title: "Add login feature",
        branch: "feature-login",
      },
      expectedOutput: {
        isBoredom: undefined,
        initiatedBy: undefined,
        branch: "feature-login",
        titleHasBoredomPrefix: false,
        detectionMethods: {
          titlePrefix: false,
          branchName: false,
          persistentField: false,
        },
      },
    },
    {
      id: "validation-boredom-activity-detection-mechanism-case-4",
      name: "Boredom Activity with Only Title Prefix (Auto-Correction)",
      input: {
        title: "[BOREDOM] refactor-database",
        branch: "main", // Wrong branch, should be auto-corrected
      },
      expectedOutput: {
        isBoredom: true,
        initiatedBy: "boredom-auto",
        branch: "boredom-activity", // Should be corrected
        titleHasBoredomPrefix: true,
        detectionMethods: {
          titlePrefix: true,
          branchName: true,
          persistentField: true,
        },
      },
    },
    {
      id: "validation-boredom-activity-detection-mechanism-case-5",
      name: "Boredom Activity with Only Branch Name (Auto-Correction)",
      input: {
        title: "Some Activity", // No prefix
        branch: "boredom-activity",
      },
      expectedOutput: {
        isBoredom: true,
        initiatedBy: undefined, // Cannot determine without title prefix
        branch: "boredom-activity",
        titleHasBoredomPrefix: false,
        detectionMethods: {
          titlePrefix: false,
          branchName: true,
          persistentField: true,
        },
      },
    },
  ]
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Validation harness failed:", error)
    process.exit(1)
  })
}
