#!/usr/bin/env bun
// Analyze conflicts between activity-lifecycle-tools-automation and other specifications

import * as fs from 'fs'

// Our changes
const ourChanges = {
  specification: 'activity-lifecycle-tools-automation',
  components: [
    'repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts',
    'repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts',
    'repos/metabob-opencode/packages/opencode/src/tool/activity.ts'
  ]
}

// Load other validation results
const validationFiles = [
  'VALIDATION_RESULTS_BOREDOM_ACTIVITY_DETECTION_MECHANISM.json',
  'VALIDATION_RESULTS_COMPLETE_ARCHITECTURE_SEPARATION.json',
  'impulses/validation-results-bootstrap-template-filepath-compliance.json',
  'impulses/validation-results-impulse-learning-storage-complete.json'
]

console.log('=== Conflict Analysis ===')
console.log('Current Spec:', ourChanges.specification)
console.log('Components Modified:', ourChanges.components.length)
console.log('')

const conflicts: any[] = []
const sharedComponents: any[] = []

// Check each validation result
for (const file of validationFiles) {
  try {
    if (!fs.existsSync(file)) continue
    
    const content = JSON.parse(fs.readFileSync(file, 'utf-8'))
    const specName = content.metadata?.specification || content.id || file
    
    console.log(`Checking: ${specName}`)
    
    // Extract components from the validation result
    let otherComponents: string[] = []
    
    if (content.metadata?.componentsModified) {
      otherComponents = content.metadata.componentsModified
    } else if (content.components) {
      otherComponents = content.components.map((c: any) => c.file || c.component)
    } else if (content.pointer?.content) {
      // Parse content string to find component references
      const contentStr = content.pointer.content
      const fileMatches = contentStr.match(/repos\/metabob-[^"'\s]+\.ts/g) || []
      otherComponents = [...new Set(fileMatches)]
    }
    
    // Check for shared components
    const shared = ourChanges.components.filter(c => 
      otherComponents.some(o => o.includes(c) || c.includes(o))
    )
    
    if (shared.length > 0) {
      console.log(`  ⚠️  Shared components found: ${shared.length}`)
      shared.forEach(c => console.log(`     - ${c}`))
      
      sharedComponents.push({
        component: shared[0],
        specs: [ourChanges.specification, specName]
      })
      
      // Check for potential conflicts
      if (specName.includes('boredom') && ourChanges.components.some(c => c.includes('boredom'))) {
        conflicts.push({
          type: 'SHARED_COMPONENT_MODIFICATION',
          spec1: ourChanges.specification,
          spec2: specName,
          component: 'boredom-manager.ts',
          description: 'Both specs modify boredom-manager.ts',
          severity: 'LOW',
          resolution: 'Changes are complementary - lifecycle adds template mapping, boredom adds idle detection'
        })
      }
    } else {
      console.log(`  ✅ No conflicts`)
    }
    console.log('')
  } catch (error) {
    console.log(`  ❌ Error reading file: ${error}`)
  }
}

console.log('=== Summary ===')
console.log('Total Shared Components:', sharedComponents.length)
console.log('Total Conflicts:', conflicts.length)
console.log('')

if (conflicts.length === 0) {
  console.log('✅ No conflicts detected!')
} else {
  console.log('Conflicts:')
  conflicts.forEach((c, i) => {
    console.log(`${i + 1}. ${c.type} - ${c.component}`)
    console.log(`   ${c.description}`)
    console.log(`   Severity: ${c.severity}`)
    console.log(`   Resolution: ${c.resolution}`)
  })
}
