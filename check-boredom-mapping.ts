#!/usr/bin/env bun
// Check if boredom-manager has the correct template mapping

import * as fs from 'fs'

const boredomFile = './repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts'
const content = fs.readFileSync(boredomFile, 'utf-8')

// Check for template mapping
const hasMapping = content.includes('templateMapping')
const hasImproveMapping = content.includes('"improve-template"') && content.includes('"evolve-activity-self-contained"')
const hasDebugMapping = content.includes('"debug-failures"') && content.includes('"debug-activity-self-contained"')
const hasOptimizeMapping = content.includes('"optimize-performance"') && content.includes('"optimize-activity-self-contained"')

console.log('Boredom Manager Template Mapping Verification:')
console.log('  templateMapping exists:', hasMapping ? '✅' : '❌')
console.log('  improve-template → evolve-activity-self-contained:', hasImproveMapping ? '✅' : '❌')
console.log('  debug-failures → debug-activity-self-contained:', hasDebugMapping ? '✅' : '❌')
console.log('  optimize-performance → optimize-activity-self-contained:', hasOptimizeMapping ? '✅' : '❌')
console.log('')

const allPresent = hasMapping && hasImproveMapping && hasDebugMapping && hasOptimizeMapping

console.log('Overall:', allPresent ? '✅ PASS' : '❌ FAIL')
