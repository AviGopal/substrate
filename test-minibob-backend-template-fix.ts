#!/usr/bin/env bun
/**
 * Integration Test: MiniBob Backend Template Loading Fix
 * 
 * Tests that MiniBob can now load activity templates created by OpenCode
 * in the backend database (not just local files).
 * 
 * Test Flow:
 * 1. Create activity template in backend via API
 * 2. Call MiniBob /run endpoint with template ID
 * 3. Verify MiniBob fetches template from backend
 * 4. Verify execution succeeds
 * 5. Verify trace storage works
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080'
const MINIBOB_URL = process.env.MINIBOB_URL || 'http://localhost:8081'

interface TestResult {
  step: string
  status: 'pass' | 'fail'
  message: string
  data?: unknown
}

const results: TestResult[] = []

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`)
}

function pass(step: string, message: string, data?: unknown) {
  results.push({ step, status: 'pass', message, data })
  log('✅', `${step}: ${message}`)
}

function fail(step: string, message: string, data?: unknown) {
  results.push({ step, status: 'fail', message, data })
  log('❌', `${step}: ${message}`)
}

async function testBackendTemplateLoading() {
  log('🚀', 'Starting MiniBob Backend Template Loading Test\n')
  
  // Step 1: Create test activity template in backend
  log('📝', 'Step 1: Creating test activity template in backend...')
  
  const testTemplate = {
    name: 'test-minibob-backend-loading',
    description: 'Test template to verify MiniBob can load from backend',
    category: 'infrastructure',
    tasks: [
      {
        id: 'task-1',
        subagent: 'general',
        description: 'Simple test task',
        dependencies: [],
        prompt: {
          template: 'Echo test: {{message}}',
          maxTokens: 1000,
          compressionStrategy: 'filter',
          variables: [
            {
              name: 'message',
              type: 'string',
              required: true,
              description: 'Test message to echo'
            }
          ]
        },
        validation: {
          requiredFiles: [],
          requiredPatterns: [],
          forbiddenPatterns: [],
          commands: []
        },
        retry: {
          maxAttempts: 1,
          strategy: 'simple'
        }
      }
    ]
  }
  
  try {
    const createRes = await fetch(`${BACKEND_URL}/api/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testTemplate)
    })
    
    if (!createRes.ok) {
      const error = await createRes.text()
      fail('Create Template', `Backend returned ${createRes.status}: ${error}`)
      return
    }
    
    const created = await createRes.json()
    const templateId = created.id
    pass('Create Template', `Template created with ID: ${templateId}`, { templateId })
    
    // Step 2: Verify template exists in backend
    log('🔍', 'Step 2: Verifying template exists in backend...')
    
    const getRes = await fetch(`${BACKEND_URL}/api/activities/${templateId}`)
    if (!getRes.ok) {
      fail('Verify Template', `Template not found in backend: ${getRes.status}`)
      return
    }
    
    const template = await getRes.json()
    pass('Verify Template', `Template exists: ${template.name}`, { name: template.name })
    
    // Step 3: Call MiniBob /run endpoint with template ID
    log('🤖', 'Step 3: Calling MiniBob /run with backend template ID...')
    
    const runRes = await fetch(`${MINIBOB_URL}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: templateId,  // Pass ID, not file path
        variables: {
          message: 'Hello from MiniBob backend integration test!'
        },
        reason: 'Testing MiniBob backend template loading fix'
      })
    })
    
    if (!runRes.ok) {
      const error = await runRes.text()
      fail('MiniBob Execution', `MiniBob returned ${runRes.status}: ${error}`, { error })
      return
    }
    
    const result = await runRes.json()
    pass('MiniBob Execution', 'MiniBob successfully executed backend template', { result })
    
    // Step 4: Verify trace was stored
    log('💾', 'Step 4: Verifying execution trace was stored...')
    
    if (!result.activityId) {
      fail('Trace Storage', 'No activityId returned from execution')
      return
    }
    
    const traceRes = await fetch(`${BACKEND_URL}/api/impulses?type=executionTrace&limit=1`)
    if (!traceRes.ok) {
      fail('Trace Storage', `Failed to fetch traces: ${traceRes.status}`)
      return
    }
    
    const traces = await traceRes.json()
    const recentTrace = traces.find((t: any) => 
      t.metadata?.activityId === result.activityId
    )
    
    if (!recentTrace) {
      fail('Trace Storage', 'Execution trace not found in backend')
      return
    }
    
    pass('Trace Storage', 'Execution trace successfully stored', { 
      traceId: recentTrace.id,
      activityId: result.activityId
    })
    
    // Success!
    log('🎉', '\nAll tests passed! MiniBob backend template loading is working.\n')
    
  } catch (error) {
    fail('Test Execution', `Unexpected error: ${error}`, { error })
  }
  
  // Print summary
  console.log('=== Test Summary ===')
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total: ${results.length}`)
  
  if (failed > 0) {
    console.log('\nFailed steps:')
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.step}: ${r.message}`)
    })
    process.exit(1)
  }
}

// Run test
testBackendTemplateLoading().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
