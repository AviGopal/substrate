/**
 * Runner for impulse-token-budget-management validation harness
 * 
 * Executes all test cases and reports results
 */

import {
  runValidation,
  testCase1,
  testCase2,
  testCase3,
  testCase4,
  type ValidationInput,
} from "./impulse-token-budget-management-harness"

interface TestCase {
  name: string
  description: string
  input: ValidationInput
}

const testCases: TestCase[] = [
  {
    name: "case-1-drop-below-threshold",
    description:
      "87% utilization with 3 low-priority impulses (loadCount=1, 2hr old). Should unload all 3, drop to 67% (Yellow), no activity trigger",
    input: testCase1,
  },
  {
    name: "case-2-remain-above-threshold",
    description:
      "95% utilization, unload 500 tokens, still at 90%. Should trigger manage-session-memory activity (Red)",
    input: testCase2,
  },
  {
    name: "case-3-high-loadcount-preserved",
    description:
      "88% utilization with mixed low-priority: 1 with loadCount=5 (preserve), 1 with loadCount=1 (unload). Should unload only 1 impulse",
    input: testCase3,
  },
  {
    name: "case-4-recent-access-preserved",
    description:
      "88% utilization with mixed low-priority: 1 accessed 30min ago (preserve), 1 accessed 2hr ago (unload). Should unload only 1 impulse",
    input: testCase4,
  },
]

async function main() {
  console.log("========================================")
  console.log("Validation Harness: impulse-token-budget-management")
  console.log("========================================\n")

  let totalTests = 0
  let passedTests = 0
  const failedTests: { name: string; errors: string[] }[] = []

  for (const testCase of testCases) {
    totalTests++
    console.log(`\n[${testCase.name}] ${testCase.description}`)
    console.log("-".repeat(60))

    try {
      const result = await runValidation(testCase.input)

      if (result.pass) {
        passedTests++
        console.log("✅ PASS")
        console.log(`  Low-priority identified: ${result.actual.lowPriorityIdentified}`)
        console.log(`  Low-priority unloaded: ${result.actual.lowPriorityUnloaded}`)
        console.log(`  Utilization: ${result.actual.utilizationBefore.toFixed(1)}% → ${result.actual.utilizationAfter.toFixed(1)}%`)
        console.log(`  Color code: ${result.actual.colorCode.toUpperCase()}`)
        console.log(`  Activity triggered: ${result.actual.activityTriggered}`)
      } else {
        console.log("❌ FAIL")
        console.log("\nExpected:")
        console.log(`  Low-priority identified: ${result.expected.lowPriorityIdentified}`)
        console.log(`  Low-priority unloaded: ${result.expected.lowPriorityUnloaded}`)
        console.log(
          `  Utilization: ${result.expected.utilizationBefore.toFixed(1)}% → ${result.expected.utilizationAfter.toFixed(1)}%`,
        )
        console.log(`  Color code: ${result.expected.colorCode.toUpperCase()}`)
        console.log(`  Activity triggered: ${result.expected.activityTriggered}`)

        console.log("\nActual:")
        console.log(`  Low-priority identified: ${result.actual.lowPriorityIdentified}`)
        console.log(`  Low-priority unloaded: ${result.actual.lowPriorityUnloaded}`)
        console.log(`  Utilization: ${result.actual.utilizationBefore.toFixed(1)}% → ${result.actual.utilizationAfter.toFixed(1)}%`)
        console.log(`  Color code: ${result.actual.colorCode.toUpperCase()}`)
        console.log(`  Activity triggered: ${result.actual.activityTriggered}`)

        console.log("\nErrors:")
        result.errors.forEach((err) => console.log(`  - ${err}`))

        failedTests.push({ name: testCase.name, errors: result.errors })
      }
    } catch (error) {
      console.log("❌ ERROR")
      console.log(`  ${error instanceof Error ? error.message : String(error)}`)
      failedTests.push({
        name: testCase.name,
        errors: [error instanceof Error ? error.message : String(error)],
      })
    }
  }

  console.log("\n========================================")
  console.log("Summary")
  console.log("========================================")
  console.log(`Total tests: ${totalTests}`)
  console.log(`Passed: ${passedTests}`)
  console.log(`Failed: ${totalTests - passedTests}`)

  if (failedTests.length > 0) {
    console.log("\nFailed Tests:")
    failedTests.forEach((test) => {
      console.log(`  - ${test.name}`)
      test.errors.forEach((err) => console.log(`    ${err}`))
    })

    process.exit(1)
  } else {
    console.log("\n✅ All tests passed!")
    process.exit(0)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
