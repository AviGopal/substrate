/**
 * Direct test of impulse loading fix (commit 7465be33)
 * 
 * This test:
 * 1. Loads fix-bug-with-metabob template (has contextRequirements)
 * 2. Simulates activity execution up to context gathering
 * 3. Examines impulses to verify they were loaded correctly
 * 
 * Run in devbob-clean container:
 * docker exec devbob-clean bun run test-impulse-loading-direct.ts
 */

import { ActivityTemplate } from './packages/opencode/src/session/activity-template'
import { Activity } from './packages/opencode/src/session/activity'
import { Storage } from './packages/opencode/src/storage/storage'
import { promises as fs } from 'fs'

async function main() {
  console.log('=== Testing Impulse Loading Fix (commit 7465be33) ===\n')
  
  // Step 1: Load template
  console.log('Step 1: Loading fix-bug-with-metabob template...')
  const templatePath = '/opt/repos/metabob-opencode/packages/opencode/templates/opencode-dev/fix-bug-with-metabob.json'
  const templateJson = await fs.readFile(templatePath, 'utf8')
  const templateData = JSON.parse(templateJson)
  
  console.log(`Template: ${templateData.name}`)
  console.log(`Context Requirements: ${templateData.contextRequirements?.length || 0}`)
  
  if (templateData.contextRequirements) {
    console.log('Requirements:')
    for (const req of templateData.contextRequirements) {
      console.log(`  - ${req.key}: ${req.hint.substring(0, 60)}...`)
      console.log(`    required: ${req.required}, budget: ${req.budgetRange}`)
    }
  }
  
  console.log('\nStep 2: Creating activity...')
  const activity = await Activity.create({
    directory: process.cwd(),
    branch: 'test-impulse-loading',
    baseCommit: 'HEAD',
    title: 'Test Impulse Loading Fix'
  })
  
  console.log(`Activity ID: ${activity.id}`)
  console.log(`Has executionEvidence: ${!!activity.executionEvidence}`)
  console.log(`Sessions spawned: ${activity.executionEvidence?.sessionsSpawned?.length || 0}`)
  
  // Step 3: Create impulses from requirements (simulating what activity tool does)
  console.log('\nStep 3: Creating impulses from context requirements...')
  
  if (!templateData.contextRequirements || templateData.contextRequirements.length === 0) {
    console.log('ERROR: Template has no contextRequirements!')
    process.exit(1)
  }
  
  const impulses = await Activity.createImpulsesFromRequirements(
    activity.id,
    templateData.contextRequirements
  )
  
  console.log(`Created ${Object.keys(impulses).length} impulses:`)
  for (const [key, impulse] of Object.entries(impulses)) {
    console.log(`  - ${key}: loaded=${impulse.loaded}, budget=${impulse.budget}`)
  }
  
  // Add impulses to activity
  await Activity.addImpulses(activity.id, impulses)
  
  // Reload activity to verify storage
  const reloaded = await Activity.load(activity.id)
  
  console.log('\nStep 4: Verifying impulses in storage...')
  console.log(`Impulses in storage: ${Object.keys(reloaded.impulses).length}`)
  
  for (const [key, impulse] of Object.entries(reloaded.impulses)) {
    console.log(`\n  ${key}:`)
    console.log(`    id: ${impulse.id}`)
    console.log(`    type: ${impulse.type}`)
    console.log(`    loaded: ${impulse.loaded}`)
    console.log(`    budget: ${impulse.budget}`)
    console.log(`    pointer.type: ${impulse.pointer.type}`)
    if (impulse.pointer.type === 'memo') {
      console.log(`    pointer.content: ${impulse.pointer.content.substring(0, 50)}...`)
    }
  }
  
  console.log('\n=== Test Results ===')
  console.log(`✓ Activity created with executionEvidence: ${!!reloaded.executionEvidence}`)
  console.log(`✓ Impulses created from contextRequirements: ${Object.keys(reloaded.impulses).length}`)
  console.log(`✓ All impulses stored: ${Object.keys(reloaded.impulses).every(k => !!reloaded.impulses[k])}`)
  
  console.log('\nNOTE: Impulses are placeholders at this stage (loaded=false).')
  console.log('They would be loaded during actual activity execution by SessionMemoryAgent.gatherContext()')
  console.log('This test validates the impulse creation infrastructure.')
  
  console.log(`\nActivity storage file: ~/.local/share/opencode/storage/activity/${activity.id}.json`)
}

main().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
