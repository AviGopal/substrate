#!/usr/bin/env bun
/**
 * Runner script for impulse-usage-statistics-accuracy validation harness
 *
 * Executes all test cases and reports results
 */

import { runAllTests } from "./impulse-usage-statistics-accuracy-harness"

async function main() {
  console.log("Starting Impulse Usage Statistics Accuracy Validation...\n")

  const { passed, failed, results } = await runAllTests()

  console.log("\n=== Validation Summary ===")
  console.log(`Total: ${passed + failed}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)

  if (failed > 0) {
    console.log("\n❌ Validation FAILED")
    process.exit(1)
  } else {
    console.log("\n✅ Validation PASSED")
    process.exit(0)
  }
}

main()
