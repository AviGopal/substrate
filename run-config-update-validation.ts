#!/usr/bin/env bun
/**
 * Test runner for config-update-tool validation harness
 */

import { runValidation } from "./tests/validation-harnesses/config-update-tool-harness"

async function main() {
  console.log("Starting config_update tool validation...\n")
  
  const result = await runValidation()
  
  console.log("\n" + "=".repeat(60))
  console.log("VALIDATION RESULTS")
  console.log("=".repeat(60))
  console.log(`Total Tests: ${result.total}`)
  console.log(`Passed: ${result.passed}`)
  console.log(`Failed: ${result.failed}`)
  console.log(`Success Rate: ${((result.passed / result.total) * 100).toFixed(1)}%`)
  console.log("=".repeat(60))
  
  if (result.failed > 0) {
    process.exit(1)
  }
  
  process.exit(0)
}

main().catch((error) => {
  console.error("Validation harness failed:", error)
  process.exit(1)
})
