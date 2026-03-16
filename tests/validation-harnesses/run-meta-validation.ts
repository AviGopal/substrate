#!/usr/bin/env bun
/**
 * CLI Runner for Meta-Validation Harness
 * 
 * Usage:
 *   bun run tests/validation-harnesses/run-meta-validation.ts [--skip-network] [--verbose]
 */

import runValidation from "./minibob-validation-infrastructure-meta-validation-harness"
import * as path from "path"

async function main() {
  const repoRoot = path.resolve(__dirname, "../..")
  const skipNetwork = process.argv.includes('--skip-network')
  const verbose = process.argv.includes('--verbose')

  console.log('='.repeat(80))
  console.log('Meta-Validation: Validating the Validators')
  console.log('='.repeat(80))
  console.log(`Repo Root: ${repoRoot}`)
  console.log(`Skip Network Tests: ${skipNetwork}`)
  console.log('='.repeat(80))
  console.log('')

  const result = await runValidation({ repoRoot, skipNetworkTests: skipNetwork, verbose })

  console.log('\n' + '='.repeat(80))
  console.log('META-VALIDATION RESULTS')
  console.log('='.repeat(80))
  console.log(`Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Summary: ${result.summary}`)
  console.log(`Timestamp: ${result.timestamp}`)
  console.log('\nStep Results:')
  console.log('='.repeat(80))

  for (const step of result.steps) {
    const icon = step.pass ? '✅' : '❌'
    console.log(`\n${icon} Step ${step.step}: ${step.name}`)
    console.log(`   ${step.message}`)
    if (step.details && Object.keys(step.details).length > 0) {
      const detailsStr = JSON.stringify(step.details, null, 2)
        .split('\n')
        .slice(1, -1)
        .join('\n   ')
      console.log(`   Details: ${detailsStr}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`Final Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}`)
  console.log('='.repeat(80) + '\n')

  process.exit(result.pass ? 0 : 1)
}

main().catch(error => {
  console.error(`Fatal error: ${error}`)
  process.exit(1)
})
