#!/usr/bin/env bun
// Verify all ripple changes are applied

import * as fs from 'fs'

console.log('=== Ripple Changes Verification ===')
console.log('')

const checks = [
  {
    name: 'Config schema has lifecycle automation',
    file: 'repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts',
    check: (content: string) => content.includes('template_lifecycle_automation')
  },
  {
    name: 'Config schema has all 6 fields',
    file: 'repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts',
    check: (content: string) => 
      content.includes('auto_debug_on_failure') &&
      content.includes('auto_evolve_on_staleness') &&
      content.includes('failure_threshold_count') &&
      content.includes('staleness_threshold_days') &&
      content.includes('max_evolution_frequency_hours')
  },
  {
    name: 'BoredomManager imports Config',
    file: 'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
    check: (content: string) => content.includes('import { Config }')
  },
  {
    name: 'BoredomManager checks lifecycle config',
    file: 'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
    check: (content: string) => content.includes('template_lifecycle_automation')
  },
  {
    name: 'BoredomManager respects enabled flag',
    file: 'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
    check: (content: string) => content.includes('lifecycleConfig?.enabled === false')
  },
  {
    name: 'BoredomManager respects auto_evolve flag',
    file: 'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
    check: (content: string) => content.includes('auto_evolve_on_staleness === false')
  },
  {
    name: 'BoredomManager has template mapping',
    file: 'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
    check: (content: string) => content.includes('templateMapping')
  },
  {
    name: 'Activity.ts has auto-debug function',
    file: 'repos/metabob-opencode/packages/opencode/src/tool/activity.ts',
    check: (content: string) => content.includes('maybeAutoDebugFailedActivity')
  },
  {
    name: 'Activity.ts calls auto-debug on failure',
    file: 'repos/metabob-opencode/packages/opencode/src/tool/activity.ts',
    check: (content: string) => content.includes('await maybeAutoDebugFailedActivity(activity, parentSessionID)')
  },
  {
    name: 'Activity.ts checks lifecycle config',
    file: 'repos/metabob-opencode/packages/opencode/src/tool/activity.ts',
    check: (content: string) => content.includes('template_lifecycle_automation')
  }
]

let passed = 0
let failed = 0

checks.forEach(check => {
  const content = fs.readFileSync(check.file, 'utf-8')
  const result = check.check(content)
  const status = result ? '✅' : '❌'
  console.log(`${status} ${check.name}`)
  
  if (result) {
    passed++
  } else {
    failed++
    console.log(`   File: ${check.file}`)
  }
})

console.log('')
console.log('=== Summary ===')
console.log(`Passed: ${passed}/${checks.length}`)
console.log(`Failed: ${failed}/${checks.length}`)
console.log('')
console.log(failed === 0 ? '✅ All ripple changes verified!' : '❌ Some checks failed')

process.exit(failed === 0 ? 0 : 1)
