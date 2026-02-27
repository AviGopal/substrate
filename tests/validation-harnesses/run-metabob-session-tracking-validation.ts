#!/usr/bin/env bun

/**
 * Test Runner: metabob-session-tracking validation harness
 * 
 * Executes validation harness and reports results
 */

import { runValidation } from "./metabob-session-tracking-harness"
import fs from "fs"
import path from "path"

async function main() {
  console.log("=" .repeat(80))
  console.log("VALIDATION: metabob-session-tracking (Specification 2)")
  console.log("=" .repeat(80))
  console.log("")

  const startTime = Date.now()
  
  try {
    const report = await runValidation()
    const duration = Date.now() - startTime

    // Print summary
    console.log("\n" + "=".repeat(80))
    console.log("VALIDATION SUMMARY")
    console.log("=".repeat(80))
    console.log(`Total Tests:    ${report.totalTests}`)
    console.log(`Passed:         ${report.passed} ✅`)
    console.log(`Failed:         ${report.failed} ${report.failed > 0 ? "❌" : ""}`)
    console.log(`Success Rate:   ${((report.passed / report.totalTests) * 100).toFixed(1)}%`)
    console.log(`Duration:       ${duration}ms`)
    console.log("")

    // Print detailed results
    console.log("DETAILED RESULTS")
    console.log("-".repeat(80))
    for (const result of report.results) {
      const icon = result.pass ? "✅" : "❌"
      console.log(`\n${icon} ${result.testCase}`)
      
      if (!result.pass) {
        console.log("   Expected:")
        console.log("   ", JSON.stringify(result.expected, null, 2).replace(/\n/g, "\n   "))
        console.log("   Actual:")
        console.log("   ", JSON.stringify(result.actual, null, 2).replace(/\n/g, "\n   "))
        
        if (result.error) {
          console.log("   Error:", result.error)
        }
      }
    }

    // Save results to file
    const outputPath = path.join(
      __dirname,
      "../../test-results",
      "metabob-session-tracking-validation-results.json"
    )
    
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          specification: "metabob-session-tracking",
          duration,
          ...report,
        },
        null,
        2
      )
    )

    console.log("\n" + "=".repeat(80))
    console.log(`Results saved to: ${outputPath}`)
    console.log("=".repeat(80))

    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error("\n❌ VALIDATION FAILED WITH ERROR:")
    console.error(error)
    process.exit(1)
  }
}

main().catch(console.error)
