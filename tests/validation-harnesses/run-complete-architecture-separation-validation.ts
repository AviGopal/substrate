#!/usr/bin/env node
/**
 * Runner script for complete-architecture-separation validation harness
 * 
 * Usage:
 *   npx tsx tests/validation-harnesses/run-complete-architecture-separation-validation.ts
 */

import { runValidation } from "./complete-architecture-separation-harness"

async function main() {
  console.log("=".repeat(80))
  console.log("Complete Architecture Separation Validation")
  console.log("=".repeat(80))
  console.log("")

  const result = await runValidation()

  console.log("")
  console.log("=".repeat(80))
  console.log("FINAL RESULT:", result.overallPass ? "✅ PASS" : "❌ FAIL")
  console.log("=".repeat(80))

  // Write results to file
  const fs = await import("fs")
  const outputPath = "tests/validation-harnesses/validation-results-complete-architecture-separation.json"
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  console.log(`\nResults written to: ${outputPath}`)

  // @ts-ignore - Node.js process
  process.exit(result.overallPass ? 0 : 1)
}

main().catch((error) => {
  console.error("Validation runner failed:", error)
  // @ts-ignore - Node.js process
  process.exit(1)
})
