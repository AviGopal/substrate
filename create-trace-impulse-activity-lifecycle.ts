#!/usr/bin/env bun
import { Storage } from './repos/metabob-opencode/packages/opencode/src/storage/storage'
import { ulid } from 'ulid'
import * as fs from 'fs'

const traceData = JSON.parse(fs.readFileSync('./TRACE_activity-lifecycle-tools-automation.json', 'utf-8'))

const impulse = {
  id: 'trace-activity-lifecycle-tools-automation',
  type: 'templateDefinition' as const,
  pointer: {
    type: 'templateDefinition' as const,
    definition: traceData,
    source: 'trace-data-flow-analysis' as const,
  },
  budget: 5000,
  priority: 'high' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
  metadata: {
    specificationName: traceData.specificationName,
    componentCount: traceData.components.length,
    criticalGapCount: traceData.criticalGaps.length,
    implementationSteps: traceData.implementationPlan.length,
    tracedBy: 'trace-data-flow-single-feature activity',
  }
}

await Storage.write(['impulse-activity', impulse.id], impulse)

console.log('✅ Created trace impulse:', impulse.id)
console.log('   Specification:', traceData.specificationName)
console.log('   Components traced:', traceData.components.length)
console.log('   Critical gaps:', traceData.criticalGaps.length)
console.log('   Implementation steps:', traceData.implementationPlan.length)
console.log('')
console.log('Impulse content summary:')
console.log('  - Auto-registration: WORKING (maybeAutoRegisterWithMetabob)')
console.log('  - Boredom system: PARTIAL (fetches activities but no template mapping)')
console.log('  - Auto-debugging: MISSING (no failure tracking or auto-trigger)')
console.log('  - Lifecycle hooks: MISSING (no post-activity or periodic hooks)')
console.log('')
console.log('Priority gaps to fix:')
traceData.criticalGaps.forEach((gap: any, i: number) => {
  console.log(`  ${i+1}. [${gap.priority}] ${gap.gap}`)
})
