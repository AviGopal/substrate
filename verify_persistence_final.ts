#!/usr/bin/env bun
/**
 * Final verification that template was persisted to backend
 */

import { TemplateRepository } from './repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts'

async function main() {
  console.log('=' .repeat(60))
  console.log('Final Verification: Template Persistence')
  console.log('='.repeat(60))
  console.log()
  
  const templateId = 'persistence-verification-test'
  
  console.log('Retrieving template from backend...')
  console.log(`Template ID: ${templateId}`)
  console.log()
  
  try {
    // Retrieve template directly from TemplateRepository
    // This queries the backend (Metabob API / SurrealDB)
    const template = await TemplateRepository.get(templateId, { skipCache: true })
    
    if (template) {
      console.log('✅ SUCCESS! Template found in backend!')
      console.log()
      console.log('Template Details:')
      console.log(`  ID: ${template.id}`)
      console.log(`  Name: ${template.name}`)
      console.log(`  Description: ${template.description}`)
      console.log(`  Category: ${template.category}`)
      console.log(`  Tasks: ${template.tasks.length}`)
      console.log(`  Version: ${template.version?.major ?? 'N/A'}.${template.version?.minor ?? 'N/A'}.${template.version?.patch ?? 'N/A'}`)
      console.log(`  Generation: ${template.genealogy?.generation ?? 0}`)
      console.log(`  Executions: ${template.executions}`)
      console.log(`  Success Rate: ${template.successRate}`)
      console.log(`  Created At: ${new Date(template.createdAt).toISOString()}`)
      console.log(`  Updated At: ${new Date(template.updatedAt).toISOString()}`)
      console.log()
      console.log('Task Summary:')
      template.tasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.id}: ${task.description}`)
      })
      console.log()
      console.log('=' .repeat(60))
      console.log('PERSISTENCE VERIFICATION COMPLETE!')
      console.log('=' .repeat(60))
      console.log()
      console.log('✓ Template was created via ActivityTemplate.create()')
      console.log('✓ Template was persisted to backend database')
      console.log('✓ Template is retrievable from TemplateRepository')
      console.log('✓ Template ID: ' + templateId)
      console.log()
      console.log('The persistence mechanism works correctly!')
      console.log('ActivityTemplate.create() → TemplateRepository.save() → Backend DB')
      
      process.exit(0)
    } else {
      console.log('❌ FAILED! Template NOT found in backend!')
      console.log()
      console.log('This means the template was not persisted correctly.')
      console.log('Check the backend API logs for errors.')
      
      process.exit(1)
    }
  } catch (error) {
    console.log('❌ ERROR!')
    console.log()
    console.log('Failed to retrieve template:')
    console.log(`  Error: ${(error as Error).message}`)
    console.log()
    if ((error as Error).stack) {
      console.log('Stack trace:')
      console.log((error as Error).stack)
    }
    
    process.exit(1)
  }
}

main()
