#!/usr/bin/env bun
import { Storage } from './repos/metabob-opencode/packages/opencode/src/storage/storage'
import * as fs from 'fs'

const finalData = JSON.parse(fs.readFileSync('./FINAL_activity-lifecycle-tools-automation.json', 'utf-8'))

const impulse = {
  id: 'final-activity-lifecycle-tools-automation',
  type: 'memo' as const,
  pointer: {
    type: 'memo' as const,
    content: JSON.stringify(finalData, null, 2),
    source: 'workflow-completion' as const,
  },
  budget: 2000,
  priority: 'high' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
  metadata: {
    specificationName: finalData.specificationName,
    completionDate: finalData.completionDate,
    workflowStages: Object.keys(finalData.workflowStages).length,
    validationStatus: finalData.validationResults.overallStatus,
    productionReadiness: finalData.deploymentReadiness.status,
    gitCommit: finalData.gitArtifacts.commit,
    gitTag: finalData.gitArtifacts.tag,
  }
}

await Storage.write(['impulse-activity', impulse.id], impulse)

console.log('✅ Created final summary impulse:', impulse.id)
console.log('')
console.log('=== Workflow Complete ===')
console.log('Specification:', finalData.specificationName)
console.log('Completion Date:', finalData.completionDate)
console.log('Workflow Stages:', Object.keys(finalData.workflowStages).length)
console.log('Validation Status:', finalData.validationResults.overallStatus)
console.log('Production Readiness:', finalData.deploymentReadiness.status)
console.log('')
console.log('Git Artifacts:')
console.log('  Commit:', finalData.gitArtifacts.commit)
console.log('  Tag:', finalData.gitArtifacts.tag)
console.log('  Files Changed:', finalData.gitArtifacts.filesChanged)
console.log('  Insertions:', finalData.gitArtifacts.insertions)
console.log('  Deletions:', finalData.gitArtifacts.deletions)
console.log('')
console.log('Functional State Transition:')
console.log('  BEFORE:', finalData.transformationSummary.functionalState.before.selfImprovement)
console.log('  AFTER:', finalData.transformationSummary.functionalState.after.selfImprovement)
console.log('')
console.log('Success Criteria (Immediate):')
finalData.successCriteria.immediate.forEach((criterion: string) => {
  console.log(`  ${criterion}`)
})
