#!/usr/bin/env bun
// Analyze ripple effects for activity-lifecycle-tools-automation

import * as fs from 'fs'

const componentsModified = [
  {
    file: 'repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts',
    component: 'template_lifecycle_automation config',
    changes: 'Added new config section with 6 fields'
  },
  {
    file: 'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
    component: 'executeBoredomActivity()',
    changes: 'Added template mapping logic'
  },
  {
    file: 'repos/metabob-opencode/packages/opencode/src/tool/activity.ts',
    component: 'maybeAutoDebugFailedActivity()',
    changes: 'Added auto-debug function'
  }
]

console.log('=== Ripple Analysis ===')
console.log('Components Modified:', componentsModified.length)
console.log('')

// Check for ripple effects
const rippleEffects: any[] = []

// 1. Config schema changes -> Need to check if config is properly read everywhere
console.log('1. Checking config schema ripple effects...')
const configUsers = [
  'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
  'repos/metabob-opencode/packages/opencode/src/tool/activity.ts'
]

configUsers.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8')
    const usesLifecycleConfig = content.includes('template_lifecycle_automation')
    console.log(`   ${file}`)
    console.log(`     Uses lifecycle config: ${usesLifecycleConfig ? '✅' : '⚠️  NOT YET'}`)
    
    if (!usesLifecycleConfig) {
      rippleEffects.push({
        file,
        needed: 'Add template_lifecycle_automation config check',
        priority: 'HIGH'
      })
    }
  }
})
console.log('')

// 2. Boredom manager changes -> Check if all activity types are mapped
console.log('2. Checking boredom manager ripple effects...')
const boredomFile = 'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts'
if (fs.existsSync(boredomFile)) {
  const content = fs.readFileSync(boredomFile, 'utf-8')
  const hasImproveMapping = content.includes('"improve-template"')
  const hasDebugMapping = content.includes('"debug-failures"')
  const hasOptimizeMapping = content.includes('"optimize-performance"')
  
  console.log(`   improve-template mapping: ${hasImproveMapping ? '✅' : '❌'}`)
  console.log(`   debug-failures mapping: ${hasDebugMapping ? '✅' : '❌'}`)
  console.log(`   optimize-performance mapping: ${hasOptimizeMapping ? '✅' : '❌'}`)
}
console.log('')

// 3. Activity.ts changes -> Check if all failure paths trigger auto-debug
console.log('3. Checking activity.ts ripple effects...')
const activityFile = 'repos/metabob-opencode/packages/opencode/src/tool/activity.ts'
if (fs.existsSync(activityFile)) {
  const content = fs.readFileSync(activityFile, 'utf-8')
  const failureMatches = content.match(/activity\.status = "failed"/g)
  const autoDebugMatches = content.match(/maybeAutoDebugFailedActivity/g)
  
  console.log(`   Failure points: ${failureMatches?.length || 0}`)
  console.log(`   Auto-debug calls: ${autoDebugMatches?.length || 0}`)
  
  if ((failureMatches?.length || 0) > (autoDebugMatches?.length || 0)) {
    rippleEffects.push({
      file: activityFile,
      needed: 'Some failure paths may not trigger auto-debug',
      priority: 'MEDIUM'
    })
  }
}
console.log('')

// 4. Check for related components that might need updates
console.log('4. Checking related components...')
const relatedComponents = [
  'repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts',
  'repos/metabob-opencode/packages/opencode/src/session/activity-template.ts',
  'repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts'
]

relatedComponents.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ${file}: EXISTS`)
  }
})
console.log('')

console.log('=== Summary ===')
console.log('Ripple Effects Needed:', rippleEffects.length)

if (rippleEffects.length === 0) {
  console.log('✅ All ripple effects already applied!')
} else {
  console.log('Ripple effects needed:')
  rippleEffects.forEach((r, i) => {
    console.log(`${i + 1}. [${r.priority}] ${r.file}`)
    console.log(`   ${r.needed}`)
  })
}
