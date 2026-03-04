#!/usr/bin/env bun
// Check if the config schema includes template_lifecycle_automation

import * as fs from 'fs'

const schemaFile = './repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts'
const content = fs.readFileSync(schemaFile, 'utf-8')

// Check for template_lifecycle_automation
const hasLifecycleAutomation = content.includes('template_lifecycle_automation')
const hasAutoDebug = content.includes('auto_debug_on_failure')
const hasAutoEvolve = content.includes('auto_evolve_on_staleness')
const hasFailureThreshold = content.includes('failure_threshold_count')
const hasStalenessThreshold = content.includes('staleness_threshold_days')
const hasMaxEvolutionFrequency = content.includes('max_evolution_frequency_hours')

console.log('Config Schema Verification:')
console.log('  template_lifecycle_automation:', hasLifecycleAutomation ? '✅' : '❌')
console.log('  auto_debug_on_failure:', hasAutoDebug ? '✅' : '❌')
console.log('  auto_evolve_on_staleness:', hasAutoEvolve ? '✅' : '❌')
console.log('  failure_threshold_count:', hasFailureThreshold ? '✅' : '❌')
console.log('  staleness_threshold_days:', hasStalenessThreshold ? '✅' : '❌')
console.log('  max_evolution_frequency_hours:', hasMaxEvolutionFrequency ? '✅' : '❌')
console.log('')

const allPresent = hasLifecycleAutomation && hasAutoDebug && hasAutoEvolve && 
                   hasFailureThreshold && hasStalenessThreshold && hasMaxEvolutionFrequency

console.log('Overall:', allPresent ? '✅ PASS' : '❌ FAIL')

// Also check template_auto_registration (should already exist)
const hasAutoRegistration = content.includes('template_auto_registration')
console.log('  template_auto_registration:', hasAutoRegistration ? '✅' : '❌')
