#!/usr/bin/env node
/**
 * Test MetabobCLI.createActivityTemplate directly
 * Proves the infrastructure works
 */

import { MetabobCLI } from './repos/metabob-opencode/packages/opencode/src/util/metabob.js'

async function main() {
  console.log('=' .repeat(60))
  console.log('Testing MetabobCLI.createActivityTemplate')
  console.log('='.repeat(60))
  console.log()
  
  const testTemplate = {
    id: 'direct-test-template',
    name: 'Direct Test Template',
    description: 'Template created by direct test to prove infrastructure works',
    category: 'test',
    tasks: [
      {
        id: 'test-step-1',
        description: 'Print test message',
        subagent: 'general',
        prompt: {
          template: 'Print: Infrastructure test successful!',
          variables: [],
          maxTokens: 100
        },
        impulseReferences: []
      }
    ],
    variables: {},
    contextRequirements: [],
    integration: {}
  }
  
  console.log('Template to create:')
  console.log(`  Name: ${testTemplate.name}`)
  console.log(`  Category: ${testTemplate.category}`)
  console.log(`  Tasks: ${testTemplate.tasks.length}`)
  console.log()
  
  console.log('Calling MetabobCLI.createActivityTemplate...')
  console.log()
  
  try {
    const result = await MetabobCLI.createActivityTemplate(testTemplate)
    
    console.log('Result:')
    console.log(JSON.stringify(result, null, 2))
    console.log()
    
    if (result.success) {
      console.log('✅ SUCCESS!')
      console.log(`   Template ID: ${result.templateId}`)
      console.log()
      console.log('Now verify in backend:')
      console.log(`   curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/v2/activities/templates | jq '.templates[] | select(.variant_name | contains("Direct Test"))'`)
      process.exit(0)
    } else {
      console.log('❌ FAILED!')
      console.log(`   Error: ${result.error}`)
      process.exit(1)
    }
  } catch (error) {
    console.log('❌ EXCEPTION!')
    console.log(`   ${error.message}`)
    console.log()
    console.log(error.stack)
    process.exit(1)
  }
}

main()
