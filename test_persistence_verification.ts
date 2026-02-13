#!/usr/bin/env node
/**
 * Test template persistence by calling MetabobCLI.createActivityTemplate
 * This follows the CreateOptions schema, not the full Schema
 */

import { MetabobCLI } from './repos/metabob-opencode/packages/opencode/src/util/metabob.ts'

async function main() {
  console.log('=' .repeat(60))
  console.log('Testing Activity Template Persistence')
  console.log('='.repeat(60))
  console.log()
  
  // Template following ActivityTemplate.CreateOptions schema
  const testTemplate = {
    name: 'Persistence Verification Test',
    description: 'Test template to verify that activity-create actually persists templates to the backend database',
    category: 'infrastructure',
    tasks: [
      {
        id: 'verify-backend-connection',
        subagent: 'general',
        description: 'Verify connection to Metabob backend API',
        dependencies: [],
        prompt: {
          template: 'Verify that the Metabob backend is accessible.\n\n**Steps**:\n1. Check if METABOB_API_URL environment variable is set\n2. Make a test request to the backend API health endpoint\n3. Report connection status',
          maxTokens: 4000,
          compressionStrategy: 'filter',
          variables: []
        },
        validation: {
          requiredFiles: [],
          requiredPatterns: ['Backend URL:', 'Backend status:'],
          forbiddenPatterns: ['error', 'failed'],
          commands: []
        },
        retry: {
          maxAttempts: 2,
          strategy: 'simple'
        }
      },
      {
        id: 'test-template-persistence',
        subagent: 'general',
        description: 'Test that a simple template can be created and persisted',
        dependencies: ['verify-backend-connection'],
        prompt: {
          template: 'Test template persistence using register_activity_template tool.\n\nCreate a minimal test template and persist it using the tool.\n\nReport the returned template ID and verify persistence.',
          maxTokens: 8000,
          compressionStrategy: 'filter',
          variables: []
        },
        validation: {
          requiredFiles: [],
          requiredPatterns: ['Template', 'registered'],
          forbiddenPatterns: [],
          commands: []
        },
        retry: {
          maxAttempts: 3,
          strategy: 'progressive-context'
        }
      },
      {
        id: 'verify-template-discoverable',
        subagent: 'general',
        description: 'Verify the created template is discoverable via search_activities',
        dependencies: ['test-template-persistence'],
        prompt: {
          template: 'Verify the persisted template is discoverable.\n\nUse search_activities tool to find the template.\n\nConfirm template metadata matches what was submitted.',
          maxTokens: 6000,
          compressionStrategy: 'filter',
          variables: []
        },
        validation: {
          requiredFiles: [],
          requiredPatterns: ['Template found', 'PERSISTENCE VERIFICATION COMPLETE'],
          forbiddenPatterns: ['not found'],
          commands: []
        },
        retry: {
          maxAttempts: 2,
          strategy: 'simple'
        }
      }
    ],
    integration: {
      preChecks: [],
      postChecks: ['search_activities({ category: "infrastructure" })'],
      qualityGates: []
    },
    metabob: {
      enabled: true,
      learningMode: true,
      targetContextTokens: 2000,
      annotationStrategy: 'key-components'
    },
    composition: {
      standalone: true,
      examples: [
        {
          name: 'Verify Template Persistence',
          description: 'Run test to confirm templates persist to backend',
          sequence: [
            {
              template: 'persistence-verification-test',
              variables: {},
              reason: 'Verify template persistence'
            }
          ],
          outcome: 'Confirmation that templates are persisted to backend database'
        }
      ]
    },
    learning: {
      enabled: true,
      captureStrategy: 'detailed',
      feedbackPoints: [
        {
          taskId: 'verify-backend-connection',
          metrics: {
            connection_time_ms: 'Time to connect to backend (number)'
          },
          improvementHints: {
            backend_accessible: 'Was backend accessible? (boolean)'
          }
        },
        {
          taskId: 'test-template-persistence',
          metrics: {
            persistence_time_ms: 'Time to persist template (number)'
          },
          improvementHints: {
            persistence_successful: 'Was persistence successful? (boolean)'
          }
        },
        {
          taskId: 'verify-template-discoverable',
          metrics: {
            search_time_ms: 'Time to search for template (number)'
          },
          improvementHints: {
            fully_verified: 'Was template discoverable? (boolean)'
          }
        }
      ]
    }
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
      console.log('Template has been persisted to the backend database.')
      console.log()
      console.log('Verification command:')
      console.log(`   opencode search_activities --category infrastructure --query "Persistence Verification"`)
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
