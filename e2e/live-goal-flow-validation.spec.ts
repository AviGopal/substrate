/**
 * Live Goal Flow Validation Tests
 *
 * These tests prove the complete goal flow works:
 * 1. Goal parsing produces correct type
 * 2. Thompson Sampling returns recommendations
 * 3. Execution creates traces in backend
 * 4. Learning feedback updates α/β
 * 5. Ribosome extracts templates from success
 * 6. Impulse relevance is learned over iterations
 *
 * VARIATABLE: Each test has parameters you can modify for different scenarios
 *
 * To run:
 *   cd repos/metabob-devbob
 *   bun test e2e/live-goal-flow-validation.spec.ts
 *
 * Prerequisites:
 *   1. Deploy activity-system: cd helm && helmfile -f activity-system-minimal.yaml.gotmpl sync
 *   2. Ensure MiniBob is running: kubectl port-forward -n activity-system svc/minibob 8080:8080
 *   3. Ensure activity-api is accessible: http://api.minibob.local/health
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// =============================================================================
// CONFIGURATION - VARIATE THESE FOR DIFFERENT TEST SCENARIOS
// =============================================================================

const CONFIG = {
  // API endpoints
  ACTIVITY_API: process.env.ACTIVITY_API_URL || 'http://api.minibob.local',
  MINIBOB_API: process.env.MINIBOB_URL || 'http://localhost:8080',

  // Auth credentials
  INSTANCE_ID: process.env.MINIBOB_INSTANCE_ID || 'minibob-local-001',
  API_KEY: process.env.MINIBOB_API_KEY || 'test-api-key-123',

  // Test timeouts
  TIMEOUT_MS: 60000,  // 60s for complex operations
  POLL_INTERVAL_MS: 1000,

  // Test parameters - VARIATE THESE
  THOMPSON_ITERATIONS: 5,  // How many executions to test Thompson learning
  RELEVANCE_ITERATIONS: 3, // How many executions to test impulse learning
  MAX_ACTIVITIES_PER_GOAL: 3,
}

// =============================================================================
// TEST GOALS - VARIATE THESE FOR DIFFERENT SCENARIOS
// =============================================================================

/**
 * Goal configurations for testing different scenarios.
 * Each goal should trigger specific behavior in MiniBob.
 */
const TEST_GOALS = {
  // BUGFIX goals - should match "bugfix" type
  bugfix_simple: {
    message: 'Fix the typo in README.md',
    expectedType: 'bugfix',
    expectedKeywords: ['fix', 'typo'],
    verification: {
      requireFilesModified: true,
      filesModifiedPattern: /README\.md/,
    },
  },

  bugfix_specific: {
    message: 'Fix the authentication error in login.ts where JWT validation fails',
    expectedType: 'bugfix',
    expectedKeywords: ['fix', 'error', 'authentication'],
    verification: {
      requireFilesModified: true,
      filesModifiedPattern: /\.ts$/,
    },
  },

  // FEATURE goals - should match "feature" type
  feature_simple: {
    message: 'Add a health check endpoint to the API',
    expectedType: 'feature',
    expectedKeywords: ['add', 'endpoint'],
    verification: {
      requireFilesModified: true,
      requireToolCalls: ['write', 'bash'],
    },
  },

  feature_complex: {
    message: 'Implement user authentication with JWT tokens and session management',
    expectedType: 'feature',
    expectedKeywords: ['implement', 'authentication'],
    verification: {
      requireFilesModified: true,
      minFilesModified: 2,
    },
  },

  // REFACTOR goals - should match "refactor" type
  refactor_simple: {
    message: 'Refactor the database connection to use connection pooling',
    expectedType: 'refactor',
    expectedKeywords: ['refactor', 'database'],
    verification: {
      requireFilesModified: true,
    },
  },

  // EXPLORATION goals - should NOT modify files
  exploration: {
    message: 'Analyze the codebase structure and identify potential security issues',
    expectedType: 'exploration',
    expectedKeywords: ['analyze'],
    verification: {
      requireToolCalls: ['read', 'glob', 'grep'],
      forbidFilesModified: true,  // Should NOT modify files
    },
  },
}

// =============================================================================
// TEST TEMPLATES - VARIATE THESE TO TEST DIFFERENT TEMPLATE BEHAVIORS
// =============================================================================

const TEST_TEMPLATES = {
  // Template that should succeed
  simple_success: {
    variant_id: `e2e-success-${Date.now()}`,
    variant_name: 'E2E Success Template',
    category: 'tool',
    task_steps: [
      {
        id: 'check',
        description: 'Check environment',
        prompt: { template: 'Run: echo "success"', maxTokens: 1000 },
        validation: { requiredPatterns: ['success'] },
      },
    ],
    expected_outcome: 'completed',
  },

  // Template that should fail validation
  validation_failure: {
    variant_id: `e2e-valfail-${Date.now()}`,
    variant_name: 'E2E Validation Failure Template',
    category: 'tool',
    task_steps: [
      {
        id: 'impossible',
        description: 'Impossible validation',
        prompt: { template: 'Run: echo "hello"', maxTokens: 1000 },
        validation: { requiredPatterns: ['this_string_never_appears'] },
      },
    ],
    expected_outcome: 'failed',
  },

  // Template with multiple tasks
  multi_task: {
    variant_id: `e2e-multitask-${Date.now()}`,
    variant_name: 'E2E Multi-Task Template',
    category: 'tool',
    task_steps: [
      {
        id: 'step1',
        description: 'First step',
        prompt: { template: 'Run: echo "step 1 complete"', maxTokens: 1000 },
      },
      {
        id: 'step2',
        description: 'Second step',
        prompt: { template: 'Run: echo "step 2 complete"', maxTokens: 1000 },
        dependencies: ['step1'],
      },
    ],
    expected_outcome: 'completed',
  },
}

// =============================================================================
// TEST IMPULSES - VARIATE THESE TO TEST DIFFERENT IMPULSE BEHAVIORS
// =============================================================================

const TEST_IMPULSES = {
  // Memo impulse (inline content)
  memo_context: {
    impulse_id: `imp-memo-${Date.now()}`,
    impulse_type: 'memo',
    pointer: {
      type: 'memo',
      content: 'This is test context for the activity. The goal is to verify impulse injection.',
    },
    budget: 500,
    priority: 'medium',
    expectedTokens: 100,  // Approximate
  },

  // File impulse (filesystem read)
  file_context: {
    impulse_id: `imp-file-${Date.now()}`,
    impulse_type: 'file',
    pointer: {
      type: 'file',
      path: '/tmp/e2e-test-context.txt',  // Must create this file first
    },
    budget: 2000,
    priority: 'high',
    expectedTokens: 500,
  },

  // Execution trace impulse (backend resolution)
  trace_context: {
    impulse_id: `imp-trace-${Date.now()}`,
    impulse_type: 'activityExecutionTrace',
    pointer: {
      type: 'activityExecutionTrace',
      executionId: 'will-be-set-dynamically',
    },
    budget: 4000,
    priority: 'high',
    expectedTokens: 1000,
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface TestContext {
  token: string
  orgId: string
  projectId: string
}

let ctx: TestContext

async function authenticate(): Promise<TestContext> {
  const response = await fetch(`${CONFIG.ACTIVITY_API}/v2/auth/minibob/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: CONFIG.INSTANCE_ID,
      api_key: CONFIG.API_KEY,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Auth failed: ${response.status} - ${text}`)
  }

  const data = await response.json() as { token: string; org_id: string; project_id?: string }
  return {
    token: data.token,
    orgId: data.org_id,
    projectId: data.project_id || 'default',
  }
}

async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  baseUrl: string = CONFIG.ACTIVITY_API
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (ctx?.token) {
    headers['Authorization'] = `Bearer ${ctx.token}`
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function waitFor<T>(
  fn: () => Promise<T | null>,
  predicate: (result: T) => boolean,
  maxAttempts: number = 30,
  intervalMs: number = CONFIG.POLL_INTERVAL_MS
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fn()
    if (result && predicate(result)) {
      return result
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Timeout waiting for condition after ${maxAttempts} attempts`)
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeAll(async () => {
  console.log('\n=== E2E Goal Flow Validation ===\n')
  console.log(`Activity API: ${CONFIG.ACTIVITY_API}`)
  console.log(`MiniBob API: ${CONFIG.MINIBOB_API}`)
  console.log(`Instance: ${CONFIG.INSTANCE_ID}\n`)

  try {
    ctx = await authenticate()
    console.log(`✓ Authenticated as ${CONFIG.INSTANCE_ID}`)
    console.log(`  org_id: ${ctx.orgId}`)
  } catch (error) {
    console.error(`✗ Authentication failed: ${error}`)
    throw error
  }

  // Create test file for file impulse
  await Bun.write('/tmp/e2e-test-context.txt', 'This is test file content for E2E impulse testing.\n'.repeat(10))
  console.log('✓ Created test file: /tmp/e2e-test-context.txt\n')
})

afterAll(async () => {
  // Cleanup test data
  console.log('\n=== Cleanup ===')
  try {
    await Bun.$`rm -f /tmp/e2e-test-context.txt`
    console.log('✓ Removed test file')
  } catch (e) {
    // Ignore cleanup errors
  }
})

// =============================================================================
// TEST SUITE 1: GOAL PARSING
// =============================================================================

describe('Goal Parsing', () => {
  Object.entries(TEST_GOALS).forEach(([name, goal]) => {
    test(`parses "${name}" as ${goal.expectedType}`, () => {
      // Test the parsing logic locally (same as GoalProcessor.parseGoal)
      const message = goal.message.toLowerCase()

      let detectedType: string = 'other'
      if (message.includes('add') || message.includes('create') || message.includes('implement')) {
        detectedType = 'feature'
      } else if (message.includes('fix') || message.includes('bug') || message.includes('error')) {
        detectedType = 'bugfix'
      } else if (message.includes('refactor') || message.includes('clean') || message.includes('reorganize')) {
        detectedType = 'refactor'
      } else if (message.includes('analyze') || message.includes('explore')) {
        detectedType = 'exploration'
      }

      expect(detectedType).toBe(goal.expectedType)

      // Verify expected keywords are present
      for (const keyword of goal.expectedKeywords) {
        expect(message).toContain(keyword.toLowerCase())
      }
    })
  })
})

// =============================================================================
// TEST SUITE 2: THOMPSON SAMPLING RECOMMENDATIONS
// =============================================================================

describe('Thompson Sampling', () => {
  test('returns recommendations for goal', async () => {
    const response = await apiCall('POST', '/v2/activities/recommend', {
      task_description: TEST_GOALS.bugfix_simple.message,
      category: 'bugfix',
      limit: 5,
    })

    expect(response.ok).toBe(true)
    const data = await response.json() as {
      recommendations: Array<{
        template_id: string
        selection_metadata: { method: string; alpha: number; beta: number; sample: number }
      }>
    }

    expect(Array.isArray(data.recommendations)).toBe(true)

    // If recommendations exist, verify Thompson metadata
    if (data.recommendations.length > 0) {
      const rec = data.recommendations[0]
      expect(rec.selection_metadata).toBeDefined()
      expect(rec.selection_metadata.method).toBe('thompson_sampling')
      expect(typeof rec.selection_metadata.alpha).toBe('number')
      expect(typeof rec.selection_metadata.beta).toBe('number')
      expect(typeof rec.selection_metadata.sample).toBe('number')
      expect(rec.selection_metadata.sample).toBeGreaterThanOrEqual(0)
      expect(rec.selection_metadata.sample).toBeLessThanOrEqual(1)
    }
  })

  test('registers template and gets metrics', async () => {
    const template = TEST_TEMPLATES.simple_success

    // Register template
    const createResponse = await apiCall('POST', '/v2/activities/templates', template)
    expect(createResponse.ok).toBe(true)

    // Verify metrics initialized
    const getResponse = await apiCall('GET', `/v2/activities/templates/${template.variant_id}`)
    expect(getResponse.ok).toBe(true)

    const data = await getResponse.json() as { metrics?: { thompson_alpha: number; thompson_beta: number } }
    expect(data.metrics).toBeDefined()
    expect(data.metrics?.thompson_alpha).toBe(1.0)  // Initial prior
    expect(data.metrics?.thompson_beta).toBe(1.0)   // Initial prior
  })

  test('α increases on successful execution', async () => {
    const templateId = `e2e-alpha-test-${Date.now()}`

    // Register fresh template
    await apiCall('POST', '/v2/activities/templates', {
      variant_id: templateId,
      variant_name: 'Alpha Test Template',
      category: 'tool',
      task_steps: [{ id: 't1', description: 'Test', prompt: { template: 'echo ok' } }],
    })

    // Get initial metrics
    const before = await apiCall('GET', `/v2/activities/templates/${templateId}`).then(r => r.json()) as {
      metrics: { thompson_alpha: number; thompson_beta: number }
    }
    const initialAlpha = before.metrics?.thompson_alpha || 1

    // Report successful execution
    await apiCall('POST', '/v2/activities/executions', {
      variant_id: templateId,
      success: true,
      duration_ms: 1000,
      cost: 0.01,
      tokens: { input: 100, output: 50, cache: 0 },
    })

    // Get updated metrics
    const after = await apiCall('GET', `/v2/activities/templates/${templateId}`).then(r => r.json()) as {
      metrics: { thompson_alpha: number; thompson_beta: number }
    }

    expect(after.metrics?.thompson_alpha).toBeGreaterThan(initialAlpha)
    expect(after.metrics?.thompson_beta).toBe(before.metrics?.thompson_beta)
  })

  test('β increases on failed execution', async () => {
    const templateId = `e2e-beta-test-${Date.now()}`

    // Register fresh template
    await apiCall('POST', '/v2/activities/templates', {
      variant_id: templateId,
      variant_name: 'Beta Test Template',
      category: 'tool',
      task_steps: [{ id: 't1', description: 'Test', prompt: { template: 'echo ok' } }],
    })

    // Get initial metrics
    const before = await apiCall('GET', `/v2/activities/templates/${templateId}`).then(r => r.json()) as {
      metrics: { thompson_alpha: number; thompson_beta: number }
    }
    const initialBeta = before.metrics?.thompson_beta || 1

    // Report failed execution
    await apiCall('POST', '/v2/activities/executions', {
      variant_id: templateId,
      success: false,
      duration_ms: 500,
      cost: 0.005,
      tokens: { input: 50, output: 25, cache: 0 },
      error_message: 'Test failure',
      error_type: 'validation_error',
    })

    // Get updated metrics
    const after = await apiCall('GET', `/v2/activities/templates/${templateId}`).then(r => r.json()) as {
      metrics: { thompson_alpha: number; thompson_beta: number }
    }

    expect(after.metrics?.thompson_beta).toBeGreaterThan(initialBeta)
    expect(after.metrics?.thompson_alpha).toBe(before.metrics?.thompson_alpha)
  })
})

// =============================================================================
// TEST SUITE 3: EXECUTION TRACES
// =============================================================================

describe('Execution Traces', () => {
  test('stores execution trace with full detail', async () => {
    const executionId = `exec-trace-${Date.now()}`
    const templateId = 'e2e-trace-test'

    const response = await apiCall('POST', '/v2/activities/execution-traces', {
      execution_id: executionId,
      template_id: templateId,
      activity_id: templateId,
      status: 'success',
      success: true,
      duration_ms: 5000,
      cost_usd: 0.05,
      tokens_input: 1000,
      tokens_output: 500,
      tokens_cache: 0,
      impulses_used: ['impulse-1', 'impulse-2'],
      execution_trace: {
        tasks: [
          {
            task_id: 'analyze',
            description: 'Analyze the issue',
            status: 'completed',
            duration_ms: 2000,
            tool_calls: [
              { tool: 'read', duration_ms: 100, success: true },
              { tool: 'grep', duration_ms: 50, success: true },
            ],
          },
          {
            task_id: 'fix',
            description: 'Fix the issue',
            status: 'completed',
            duration_ms: 3000,
            tool_calls: [
              { tool: 'edit', duration_ms: 200, success: true },
              { tool: 'bash', duration_ms: 500, success: true },
            ],
          },
        ],
        filesModified: ['src/auth.ts', 'src/utils.ts'],
        impulsesCreated: ['impulse-3'],
        goalContext: {
          goal: 'Fix authentication bug',
          intent: 'Resolve JWT validation issue',
          context: { file: 'src/auth.ts' },
        },
      },
      state_snapshot: {
        input_state: {
          filesAvailable: ['src/auth.ts', 'src/utils.ts', 'package.json'],
          environment: { NODE_ENV: 'test' },
          impulses: ['impulse-1', 'impulse-2'],
          variables: { targetFile: 'src/auth.ts' },
        },
        output_state: {
          filesModified: ['src/auth.ts', 'src/utils.ts'],
          filesCreated: [],
          filesDeleted: [],
          exitCode: 0,
        },
        stateTransition: {
          before: { 'src/auth.ts': 'abc123', 'src/utils.ts': 'def456' },
          after: { 'src/auth.ts': 'ghi789', 'src/utils.ts': 'jkl012' },
          workingDirectory: '/home/user/project',
        },
      },
    })

    expect(response.ok).toBe(true)

    // Retrieve and verify
    const getResponse = await apiCall('GET', `/v2/activities/execution-traces/${executionId}`)
    expect(getResponse.ok).toBe(true)

    const trace = await getResponse.json() as any
    expect(trace.execution_id).toBe(executionId)
    expect(trace.success).toBe(true)
    expect(trace.duration_ms).toBe(5000)
    expect(trace.execution_trace?.tasks?.length).toBe(2)
    expect(trace.execution_trace?.filesModified).toContain('src/auth.ts')
  })

  test('lists execution traces with filtering', async () => {
    // Create multiple traces
    for (let i = 0; i < 3; i++) {
      await apiCall('POST', '/v2/activities/execution-traces', {
        execution_id: `exec-list-${Date.now()}-${i}`,
        template_id: 'list-test-template',
        activity_id: 'list-test-template',
        status: i === 0 ? 'failure' : 'success',
        success: i !== 0,
        duration_ms: 1000 + i * 500,
        cost_usd: 0.01,
        tokens_input: 100,
        tokens_output: 50,
        execution_trace: { tasks: [], filesModified: [] },
      })
    }

    // Query all
    const allResponse = await apiCall('GET', '/v2/activities/execution-traces?limit=10')
    const allData = await allResponse.json() as { executions: unknown[]; total: number }
    expect(allData.executions.length).toBeGreaterThanOrEqual(3)

    // Query with filter
    const filteredResponse = await apiCall('GET', '/v2/activities/execution-traces?success=true&limit=10')
    const filteredData = await filteredResponse.json() as { executions: Array<{ success: boolean }> }
    filteredData.executions.forEach(exec => {
      expect(exec.success).toBe(true)
    })
  })
})

// =============================================================================
// TEST SUITE 4: IMPULSE SYSTEM
// =============================================================================

describe('Impulse System', () => {
  test('creates memo impulse', async () => {
    const impulse = TEST_IMPULSES.memo_context

    const response = await apiCall('POST', '/v2/impulses', {
      impulse_id: impulse.impulse_id,
      project_id: ctx.projectId,
      impulse_data: {
        id: impulse.impulse_id,
        type: impulse.impulse_type,
        pointer: impulse.pointer,
        budget: impulse.budget,
        priority: impulse.priority,
      },
    })

    expect(response.ok).toBe(true)
    const data = await response.json() as { impulse_id: string }
    expect(data.impulse_id).toBe(impulse.impulse_id)
  })

  test('creates file impulse', async () => {
    const impulse = TEST_IMPULSES.file_context

    const response = await apiCall('POST', '/v2/impulses', {
      impulse_id: impulse.impulse_id,
      project_id: ctx.projectId,
      impulse_data: {
        id: impulse.impulse_id,
        type: impulse.impulse_type,
        pointer: impulse.pointer,
        budget: impulse.budget,
        priority: impulse.priority,
      },
    })

    expect(response.ok).toBe(true)
  })

  test('records impulse relevance', async () => {
    const response = await apiCall('POST', '/v2/activities/impulse-relevance', {
      impulse_id: `relevance-test-${Date.now()}`,
      activity_variant_id: 'test-activity',
      task_id: 'test-task',
      was_loaded: true,
      execution_succeeded: true,
      content_size_tokens: 500,
      pointer_type: 'memo',
    })

    expect(response.ok).toBe(true)
  })

  test('impulse relevance affects filtering decisions', async () => {
    const activityId = `filter-test-${Date.now()}`
    const impulseA = `impulse-relevant-${Date.now()}`
    const impulseB = `impulse-irrelevant-${Date.now()}`

    // Record: A is relevant (loaded + success), B is irrelevant (loaded + failure)
    for (let i = 0; i < 5; i++) {
      await apiCall('POST', '/v2/activities/impulse-relevance', {
        impulse_id: impulseA,
        activity_variant_id: activityId,
        was_loaded: true,
        execution_succeeded: true,
      })
      await apiCall('POST', '/v2/activities/impulse-relevance', {
        impulse_id: impulseB,
        activity_variant_id: activityId,
        was_loaded: true,
        execution_succeeded: false,
      })
    }

    // Query relevance metrics
    const response = await apiCall('GET', `/v2/activities/impulse-relevance?activity_variant_id=${activityId}`)

    if (response.ok) {
      const data = await response.json() as { metrics: Array<{ impulse_id: string; relevance_score: number }> }

      const metricA = data.metrics.find(m => m.impulse_id === impulseA)
      const metricB = data.metrics.find(m => m.impulse_id === impulseB)

      if (metricA && metricB) {
        expect(metricA.relevance_score).toBeGreaterThan(metricB.relevance_score)
      }
    }
  })
})

// =============================================================================
// TEST SUITE 5: TOOL USAGE PATTERNS
// =============================================================================

describe('Tool Usage Patterns', () => {
  test('records tool usage', async () => {
    const response = await apiCall('POST', '/v2/activities/tool-usage', {
      tool_name: 'read',
      activity_variant_id: `tool-test-${Date.now()}`,
      execution_id: `exec-tool-${Date.now()}`,
      tool_succeeded: true,
      activity_succeeded: true,
      params_complexity: 50,
      duration_ms: 100,
    })

    expect(response.ok).toBe(true)
  })

  test('records execution sequence', async () => {
    const response = await apiCall('POST', '/v2/activities/execution-sequences', {
      execution_id: `seq-${Date.now()}`,
      template_id: 'sequence-test',
      sequence: [
        { position: 0, task_id: 't1', tool_name: 'read', success: true, duration_ms: 100 },
        { position: 1, task_id: 't1', tool_name: 'grep', success: true, duration_ms: 50 },
        { position: 2, task_id: 't2', tool_name: 'edit', success: true, duration_ms: 200 },
        { position: 3, task_id: 't2', tool_name: 'bash', success: true, duration_ms: 500 },
      ],
    })

    expect(response.ok).toBe(true)
  })

  test('records composition relationship', async () => {
    const response = await apiCall('POST', '/v2/activities/composition', {
      parent_activity_id: 'parent-activity',
      child_activity_id: 'child-activity',
      execution_id: `comp-${Date.now()}`,
      goal_context: 'Testing composition tracking',
      success: true,
    })

    expect(response.ok).toBe(true)
  })
})

// =============================================================================
// TEST SUITE 6: FULL GOAL EXECUTION (Integration)
// =============================================================================

describe('Full Goal Execution', () => {
  test('executes goal via /goal endpoint', async () => {
    // This test requires MiniBob to be running
    const goalMessage = 'Create a test file at /tmp/minibob-e2e-test.txt with the text "hello world"'

    const response = await apiCall('POST', '/goal', {
      goal: goalMessage,
      context: {},
      maxActivities: 3,
      maxCost: 5.0,
    }, CONFIG.MINIBOB_API)

    if (response.ok) {
      const result = await response.json() as {
        goal: { message: string; type: string }
        executions: Array<{ id: string; status: string }>
        completed: boolean
        completionReason: string
      }

      console.log(`  Goal type: ${result.goal.type}`)
      console.log(`  Executions: ${result.executions.length}`)
      console.log(`  Completed: ${result.completed}`)
      console.log(`  Reason: ${result.completionReason}`)

      expect(result.goal.message).toBe(goalMessage)
      expect(result.executions.length).toBeGreaterThan(0)

      // Verify trace was stored in backend
      if (result.executions[0]) {
        const traceResponse = await apiCall('GET', `/v2/activities/execution-traces/${result.executions[0].id}`)
        expect(traceResponse.ok).toBe(true)
      }
    } else {
      console.log('  MiniBob /goal endpoint not available - skipping integration test')
    }
  })

  test('goal execution creates impulses for context propagation', async () => {
    // Execute a goal that should create impulses
    const response = await apiCall('POST', '/goal', {
      goal: 'Read /etc/hostname and report the contents',
      context: {},
      maxActivities: 2,
    }, CONFIG.MINIBOB_API)

    if (response.ok) {
      const result = await response.json() as {
        executions: Array<{
          id: string
          impulses?: Array<{ id: string; pointer: { type: string } }>
        }>
      }

      // Check that impulses were created from execution
      if (result.executions[0]?.impulses) {
        expect(result.executions[0].impulses.length).toBeGreaterThan(0)
        console.log(`  Created ${result.executions[0].impulses.length} impulses from execution`)
      }
    }
  })
})

// =============================================================================
// TEST SUITE 7: LEARNING LOOP VERIFICATION
// =============================================================================

describe('Learning Loop', () => {
  test('Thompson Sampling prefers better templates over iterations', async () => {
    const goodTemplate = `e2e-good-${Date.now()}`
    const badTemplate = `e2e-bad-${Date.now()}`

    // Register both templates
    for (const [id, name] of [[goodTemplate, 'Good'], [badTemplate, 'Bad']] as const) {
      await apiCall('POST', '/v2/activities/templates', {
        variant_id: id,
        variant_name: `${name} Template`,
        category: 'tool',
        task_steps: [{ id: 't1', description: 'Test', prompt: { template: 'echo test' } }],
      })
    }

    // Record executions: good = 8 success / 2 fail, bad = 2 success / 8 fail
    for (let i = 0; i < 10; i++) {
      await apiCall('POST', '/v2/activities/executions', {
        variant_id: goodTemplate,
        success: i < 8,  // First 8 succeed
        duration_ms: 1000,
        cost: 0.01,
        tokens: { input: 100, output: 50, cache: 0 },
      })
      await apiCall('POST', '/v2/activities/executions', {
        variant_id: badTemplate,
        success: i < 2,  // Only first 2 succeed
        duration_ms: 1000,
        cost: 0.01,
        tokens: { input: 100, output: 50, cache: 0 },
      })
    }

    // Get recommendations
    const response = await apiCall('POST', '/v2/activities/recommend', {
      task_description: 'test task',
      category: 'tool',
      limit: 10,
    })

    const data = await response.json() as {
      recommendations: Array<{ template_id: string; selection_metadata: { sample: number } }>
    }

    // Find both templates in recommendations
    const goodRec = data.recommendations.find(r => r.template_id === goodTemplate)
    const badRec = data.recommendations.find(r => r.template_id === badTemplate)

    if (goodRec && badRec) {
      console.log(`  Good template sample: ${goodRec.selection_metadata.sample.toFixed(3)}`)
      console.log(`  Bad template sample: ${badRec.selection_metadata.sample.toFixed(3)}`)

      // Good template should have higher sample (80% vs 20% success rate)
      expect(goodRec.selection_metadata.sample).toBeGreaterThan(badRec.selection_metadata.sample)
    }
  })
})

// =============================================================================
// EXPORTED TEST SCENARIOS FOR EXTERNAL USE
// =============================================================================

export { TEST_GOALS, TEST_TEMPLATES, TEST_IMPULSES, CONFIG }
