#!/usr/bin/env bun
import { Config } from './repos/metabob-opencode/packages/opencode/src/config/config'
import { runValidation } from './repos/metabob-opencode/packages/opencode/tests/validation-harnesses/activity-lifecycle-tools-automation-harness'

// Initialize config context
try {
  await Config.get()
  console.log('✅ Config context initialized')
} catch (error) {
  console.error('❌ Failed to initialize config:', error)
}

// Run validation
const result = await runValidation()

console.log('\n=== Final Results ===')
console.log('Overall:', result.pass ? '✅ PASS' : '❌ FAIL')
console.log('Summary:', result.summary)

process.exit(result.pass ? 0 : 1)
