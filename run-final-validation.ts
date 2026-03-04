#!/usr/bin/env bun
// Run validation with all ripple changes applied

import { runValidation } from './repos/metabob-opencode/packages/opencode/tests/validation-harnesses/activity-lifecycle-tools-automation-harness'

console.log('=== Running Final Validation ===')
console.log('After ripple changes applied')
console.log('')

const result = await runValidation()

console.log('\n=== Final Results ===')
console.log('Overall:', result.pass ? '✅ PASS' : '❌ FAIL')
console.log(`Passed: ${result.summary.passed}/${result.summary.total}`)
console.log(`Failed: ${result.summary.failed}/${result.summary.total}`)
console.log('')

if (!result.pass) {
  console.log('Failed Tests:')
  result.results.filter(r => !r.pass).forEach(r => {
    console.log(`  ❌ ${r.testCase}`)
    console.log(`     Expected: ${JSON.stringify(r.expected)}`)
    console.log(`     Actual: ${JSON.stringify(r.actual)}`)
  })
}

process.exit(result.pass ? 0 : 1)
