#!/usr/bin/env tsx
/**
 * Runner script for integration-flow-sidebar-concurrent-activities validation
 * 
 * Usage:
 *   npx tsx tests/validation-harnesses/run-integration-flow-sidebar-validation.ts
 */

import { runAllTests } from "./integration-flow-sidebar-concurrent-activities-harness.js"

async function main() {
  console.log("=".repeat(60))
  console.log("Integration Flow Sidebar - Concurrent Activities Validation")
  console.log("=".repeat(60))
  console.log()

  const startTime = Date.now()
  const { passed, failed, results } = await runAllTests()
  const duration = Date.now() - startTime

  console.log(`\n${"=".repeat(60)}`)
  console.log("Validation Summary")
  console.log("=".repeat(60))
  console.log(`Total Tests: ${passed + failed}`)
  console.log(`Passed: ${passed} ✓`)
  console.log(`Failed: ${failed} ${failed > 0 ? "✗" : ""}`)
  console.log(`Duration: ${duration}ms`)
  console.log()

  if (failed > 0) {
    console.log("Failed Tests:")
    results.forEach((result, index) => {
      if (!result.pass) {
        console.log(`\n  Test Case ${index + 1}:`)
        result.errors.forEach((err) => {
          console.log(`    ✗ ${err}`)
        })
      }
    })
    console.log()
  }

  console.log("Detailed Results:")
  results.forEach((result, index) => {
    console.log(`\n  Test Case ${index + 1}: ${result.pass ? "✓ PASS" : "✗ FAIL"}`)
    
    if (result.pass) {
      console.log(`    Tree Structure: ${result.actual.treeStructure.totalNodes} nodes, depth ${result.actual.treeStructure.maxDepth}`)
      console.log(`    Status: ${result.actual.statusIndicators.executing} executing, ${result.actual.statusIndicators.done} done, ${result.actual.statusIndicators.failed} failed`)
      console.log(`    Concurrent: ${result.actual.concurrentExecution.detected ? `Yes (${result.actual.concurrentExecution.concurrentCount})` : "No"}`)
      console.log(`    Aggregated Cost: $${result.actual.aggregatedMetrics.totalCost.toFixed(2)}`)
      console.log(`    ACP Children: ${result.actual.acpChildren.resolved} resolved`)
    }
  })

  console.log(`\n${"=".repeat(60)}`)
  console.log(failed === 0 ? "All tests passed! ✓" : `${failed} test(s) failed ✗`)
  console.log("=".repeat(60))

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("Runner failed:", error)
  process.exit(1)
})
