#!/usr/bin/env bun
/**
 * Create and persist activity template using ActivityTemplate.create()
 * This properly handles ID generation, versioning, and genealogy
 */

import { ActivityTemplate } from './repos/metabob-opencode/packages/opencode/src/session/activity-template.ts'

async function main() {
  console.log('=' .repeat(60))
  console.log('Creating and Persisting Activity Template')
  console.log('='.repeat(60))
  console.log()
  
  // Template following ActivityTemplate.CreateOptions schema
  const templateOptions: ActivityTemplate.CreateOptions = {
    name: 'Persistence Verification Test',
    description: 'Test template to verify that activity templates are correctly persisted to the backend database',
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
  
  console.log('Template options:')
  console.log(`  Name: ${templateOptions.name}`)
  console.log(`  Category: ${templateOptions.category}`)
  console.log(`  Tasks: ${templateOptions.tasks.length}`)
  console.log()
  
  console.log('Calling ActivityTemplate.create()...')
  console.log('This will:')
  console.log('  1. Generate unique template ID')
  console.log('  2. Generate version and genealogy')
  console.log('  3. Initialize metrics (executions=0, etc.)')
  console.log('  4. Persist to backend via TemplateRepository.save()')
  console.log()
  
  try {
    const template = await ActivityTemplate.create(templateOptions)
    
    console.log('✅ SUCCESS!')
    console.log()
    console.log('Template created and persisted:')
    console.log(`  Template ID: ${template.id}`)
    console.log(`  Name: ${template.name}`)
    console.log(`  Category: ${template.category}`)
    console.log(`  Tasks: ${template.tasks.length}`)
    console.log(`  Version: ${template.version.major}.${template.version.minor}.${template.version.patch}`)
    console.log(`  Variant Hash: ${template.version.variantHash?.slice(0, 8)}...`)
    console.log(`  Generation: ${template.genealogy.generation}`)
    console.log(`  Created At: ${new Date(template.createdAt).toISOString()}`)
    console.log()
    console.log('✓ Template has been persisted to the backend database.')
    console.log()
    console.log('Verification command:')
    console.log(`   opencode search_activities --category infrastructure --query "Persistence Verification"`)
    console.log()
    console.log('Or using the activity tool:')
    console.log(`   activity({ activityId: "${template.id}", variables: {}, reason: "Test the template" })`)
    
    process.exit(0)
  } catch (error) {
    console.log('❌ FAILED!')
    console.log()
    console.log('Error details:')
    console.log(`  Message: ${(error as Error).message}`)
    console.log()
    if ((error as Error).stack) {
      console.log('Stack trace:')
      console.log((error as Error).stack)
    }
    process.exit(1)
  }
}

main()
