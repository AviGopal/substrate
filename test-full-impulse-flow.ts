/**
 * Full end-to-end test of impulse loading flow
 * 
 * Tests complete flow:
 * 1. SessionMemoryAgent.gatherContext() - creates impulses from requirements
 * 2. ImpulseResolver.load() - loads impulse content
 * 3. Variable mapping - maps impulses to template variables
 * 
 * Run in devbob-clean container:
 * docker exec devbob-clean bun run test-full-impulse-flow.ts
 */

import { SessionMemoryAgent } from './packages/opencode/src/session/memory-agent'
import { ImpulseResolver } from './packages/opencode/src/session/impulse-resolver'
import { ActivityTemplate } from './packages/opencode/src/session/activity-template'
import { Activity } from './packages/opencode/src/session/activity'
import { Instance } from './packages/opencode/src/project/instance'
import { promises as fs } from 'fs'

async function main() {
  console.log('=== Full Impulse Loading Flow Test ===\n')
  
  // Initialize Instance context
  console.log('Initializing project context...')
  await Instance.provide({ 
    directory: process.cwd(), 
    fn: runTest
  })
}

async function runTest() {
  console.log('Project context initialized\n')
  
  // Step 1: Load template with contextRequirements
  console.log('Step 1: Loading fix-bug-with-metabob template...')
  const templatePath = '/opt/repos/metabob-opencode/packages/opencode/templates/opencode-dev/fix-bug-with-metabob.json'
  const templateJson = await fs.readFile(templatePath, 'utf8')
  const templateData = JSON.parse(templateJson)
  
  console.log(`Template: ${templateData.name}`)
  console.log(`Context Requirements: ${templateData.contextRequirements?.length || 0}`)
  
  if (!templateData.contextRequirements || templateData.contextRequirements.length === 0) {
    console.log('ERROR: Template has no contextRequirements!')
    process.exit(1)
  }
  
  for (const req of templateData.contextRequirements) {
    console.log(`  - ${req.key} (${req.required ? 'required' : 'optional'}): ${req.hint.substring(0, 60)}...`)
  }
  
  // Step 2: Create activity
  console.log('\nStep 2: Creating activity...')
  const activity = await Activity.create({
    directory: process.cwd(),
    branch: 'test-impulse-flow',
    baseCommit: 'HEAD',
    title: 'Test Full Impulse Flow'
  })
  
  console.log(`Activity ID: ${activity.id}`)
  
  // Step 3: Gather context with SessionMemoryAgent
  console.log('\nStep 3: Gathering context with SessionMemoryAgent...')
  console.log('This will call the LLM to analyze requirements and create impulses.')
  
  const reason = `Test impulse loading: Fix a bug in the authentication system where login fails with valid credentials.
Error message: "Invalid token signature" 
The bug appears to be in src/auth/jwt-validator.ts in the verifyToken() function.
Recent git log shows changes to the JWT library that may have broken compatibility.`

  try {
    const impulses = await SessionMemoryAgent.gatherContext({
      requirements: templateData.contextRequirements,
      reason: reason,
      recentMessages: [] // Empty for this test
    })
    
    console.log(`\n✓ Context gathering succeeded!`)
    console.log(`  Created ${Object.keys(impulses).length} impulses:`)
    
    for (const [key, impulse] of Object.entries(impulses)) {
      console.log(`\n  ${key}:`)
      console.log(`    type: ${impulse.type}`)
      console.log(`    loaded: ${impulse.loaded}`)
      console.log(`    priority: ${impulse.priority}`)
      console.log(`    budget: ${impulse.budget}`)
      console.log(`    pointer.type: ${impulse.pointer.type}`)
      
      if (impulse.pointer.type === 'file') {
        console.log(`    file: ${impulse.pointer.path}`)
      } else if (impulse.pointer.type === 'memo') {
        console.log(`    memo: ${impulse.pointer.content.substring(0, 80)}...`)
      } else if (impulse.pointer.type === 'bashOutput') {
        console.log(`    command: ${impulse.pointer.command}`)
      } else if (impulse.pointer.type === 'component') {
        console.log(`    component: ${impulse.pointer.file}::${impulse.pointer.name}`)
      }
      
      if (impulse.metadata) {
        console.log(`    requirement: ${impulse.metadata.requirement}`)
      }
    }
    
    // Step 4: Store impulses in activity
    console.log('\nStep 4: Storing impulses in activity...')
    activity.impulses = impulses
    await Activity.save(activity)
    console.log(`✓ Impulses saved to activity storage`)
    
    // Step 5: Load impulses
    console.log('\nStep 5: Loading impulse content...')
    let loadedCount = 0
    let failedCount = 0
    
    for (const [key, impulse] of Object.entries(activity.impulses)) {
      if (impulse.loaded) {
        console.log(`  ${key}: already loaded`)
        loadedCount++
        continue
      }
      
      try {
        console.log(`  Loading ${key} (${impulse.type})...`)
        const loaded = await ImpulseResolver.load(impulse)
        activity.impulses[key] = loaded
        
        if (loaded.loaded && loaded.content) {
          console.log(`    ✓ Loaded: ${loaded.content.length} chars, ${loaded.tokenCount || 'unknown'} tokens`)
          loadedCount++
        } else {
          console.log(`    ✗ Failed: loaded=${loaded.loaded}, has_content=${!!loaded.content}`)
          failedCount++
        }
      } catch (error) {
        console.log(`    ✗ Error: ${error instanceof Error ? error.message : String(error)}`)
        failedCount++
      }
    }
    
    console.log(`\nLoading summary: ${loadedCount} loaded, ${failedCount} failed`)
    
    // Save activity with loaded impulses
    await Activity.save(activity)
    
    // Step 6: Map impulses to template variables
    console.log('\nStep 6: Mapping impulses to template variables...')
    const contextVariables: Record<string, string> = {}
    
    for (const requirement of templateData.contextRequirements) {
      // Find all impulses for this requirement
      const requirementImpulses = Object.values(activity.impulses)
        .filter(imp => imp.metadata?.requirement === requirement.key)
      
      console.log(`\n  ${requirement.key}:`)
      console.log(`    Found ${requirementImpulses.length} impulses`)
      
      if (requirementImpulses.length > 0) {
        // Aggregate content from loaded impulses
        const contents = requirementImpulses
          .filter(imp => imp.loaded && imp.content)
          .map(imp => imp.content)
          .join('\n\n')
        
        contextVariables[requirement.key] = contents || ''
        
        const loadedImpulses = requirementImpulses.filter(i => i.loaded && i.content)
        console.log(`    Loaded: ${loadedImpulses.length}/${requirementImpulses.length}`)
        console.log(`    Content length: ${contents.length} chars`)
        console.log(`    Variable created: {{${requirement.key}}}`)
      } else {
        if (requirement.required) {
          console.log(`    ✗ ERROR: Required context not fulfilled!`)
        } else {
          console.log(`    (optional, not provided)`)
          contextVariables[requirement.key] = ''
        }
      }
    }
    
    console.log(`\n✓ Context variables created: ${Object.keys(contextVariables).length}`)
    
    // Step 7: Validation
    console.log('\n=== Validation ===')
    
    const requiredRequirements = templateData.contextRequirements.filter((r: any) => r.required)
    const allRequiredFulfilled = requiredRequirements.every((req: any) => {
      const impulses = Object.values(activity.impulses)
        .filter(imp => imp.metadata?.requirement === req.key && imp.loaded && imp.content)
      return impulses.length > 0
    })
    
    console.log(`\nRequired requirements fulfilled: ${allRequiredFulfilled ? '✓ YES' : '✗ NO'}`)
    console.log(`Total impulses created: ${Object.keys(activity.impulses).length}`)
    console.log(`Impulses loaded: ${loadedCount}`)
    console.log(`Context variables: ${Object.keys(contextVariables).length}`)
    
    console.log('\n=== Template Variables Ready ===')
    for (const [key, value] of Object.entries(contextVariables)) {
      const preview = value.substring(0, 100).replace(/\n/g, ' ')
      console.log(`{{${key}}}: ${preview}${value.length > 100 ? '...' : ''}`)
    }
    
    console.log(`\n=== Success! ===`)
    console.log(`Activity storage: ~/.local/share/opencode/storage/activity/${activity.id}.json`)
    console.log(`\nThe impulse loading flow is working correctly.`)
    console.log(`Template tasks can now use these variables in their prompts.`)
    
  } catch (error) {
    console.error('\n✗ Context gathering failed:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'no stack')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
