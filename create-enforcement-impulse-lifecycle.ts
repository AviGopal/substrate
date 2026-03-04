#!/usr/bin/env bun
import { Storage } from './repos/metabob-opencode/packages/opencode/src/storage/storage'
import * as fs from 'fs'

const enforcementData = JSON.parse(fs.readFileSync('./ENFORCEMENT_activity-lifecycle-tools-automation.json', 'utf-8'))

const impulse = {
  id: 'enforcement-activity-lifecycle-tools-automation',
  type: 'memo' as const,
  pointer: {
    type: 'memo' as const,
    content: JSON.stringify(enforcementData, null, 2),
    source: 'enforcement-activity' as const,
  },
  budget: 3000,
  priority: 'high' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
  metadata: {
    specificationName: enforcementData.specificationName,
    changesCount: enforcementData.changesApplied.length,
    dataFlowChanges: enforcementData.dataFlowChanges.length,
    remainingGaps: enforcementData.remainingGaps.length,
    enforcedBy: 'enforce-specification activity',
  }
}

await Storage.write(['impulse-activity', impulse.id], impulse)

console.log('✅ Created enforcement impulse:', impulse.id)
console.log('   Specification:', enforcementData.specificationName)
console.log('   Changes applied:', enforcementData.changesApplied.length)
console.log('')
console.log('Changes summary:')
enforcementData.changesApplied.forEach((change: any, i: number) => {
  console.log(`  ${i+1}. ${change.component}`)
  console.log(`     File: ${change.file}`)
  console.log(`     Reason: ${change.reason.substring(0, 100)}...`)
})
console.log('')
console.log('Remaining gaps:')
enforcementData.remainingGaps.forEach((gap: any, i: number) => {
  console.log(`  ${i+1}. [${gap.priority}] ${gap.gap} - ${gap.status}`)
})
