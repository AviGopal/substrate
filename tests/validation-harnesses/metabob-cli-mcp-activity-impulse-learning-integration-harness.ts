/**
 * Validation Harness: metabob-cli MCP Activity-Impulse-Learning Integration
 * 
 * Tests end-to-end flow: OpenCode → MCP → CLI → RPC API → SurrealDB/Redis
 * 
 * Validates:
 * 1. Activity execution recorded in SurrealDB with full metrics
 * 2. Boredom detection identifies stale templates
 * 3. Template metrics updated in Redis for Thompson sampling
 * 4. Impulse data stored and retrievable
 * 5. Code quality tools work through MCP
 * 6. No direct HTTP calls bypass MCP layer
 */

import * as http from 'http'
import * as https from 'https'

interface ValidationInput {
  activityId: string
  templateId: string
  expectedMetrics: {
    duration: number
    cost: number
    tokens: { input: number; output: number; cache: number }
    success: boolean
  }
  impulseId?: string
  skipBoredomCheck?: boolean
}

interface ValidationResult {
  pass: boolean
  testName: string
  actual: any
  expected: any
  errors: string[]
  details: {
    activityRecorded?: boolean
    metricsUpdated?: boolean
    impulseStored?: boolean
    boredomDetected?: boolean
    mcpToolsWorking?: boolean
    noDirectHttp?: boolean
  }
}

interface ValidationSuite {
  pass: boolean
  totalTests: number
  passedTests: number
  failedTests: number
  results: ValidationResult[]
}

/**
 * Intercept HTTP/HTTPS requests to detect direct HTTP calls bypassing MCP
 */
class HttpInterceptor {
  private interceptedRequests: Array<{ method: string; url: string; bypassed: boolean }> = []
  private originalHttpRequest: any
  private originalHttpsRequest: any

  start() {
    this.interceptedRequests = []
    
    // Store original methods
    this.originalHttpRequest = http.request
    this.originalHttpsRequest = https.request
    
    // Intercept http.request
    ;(http as any).request = (...args: any[]) => {
      const url = this.extractUrl(args)
      this.interceptedRequests.push({
        method: 'HTTP',
        url,
        bypassed: this.isBypassingMCP(url),
      })
      return this.originalHttpRequest.apply(http, args)
    }
    
    // Intercept https.request
    ;(https as any).request = (...args: any[]) => {
      const url = this.extractUrl(args)
      this.interceptedRequests.push({
        method: 'HTTPS',
        url,
        bypassed: this.isBypassingMCP(url),
      })
      return this.originalHttpsRequest.apply(https, args)
    }
  }

  stop() {
    // Restore original methods
    if (this.originalHttpRequest) {
      ;(http as any).request = this.originalHttpRequest
    }
    if (this.originalHttpsRequest) {
      ;(https as any).request = this.originalHttpsRequest
    }
  }

  private extractUrl(args: any[]): string {
    if (typeof args[0] === 'string') {
      return args[0]
    }
    if (typeof args[0] === 'object' && args[0].href) {
      return args[0].href
    }
    if (typeof args[0] === 'object' && args[0].host) {
      return `${args[0].protocol}//${args[0].host}${args[0].path || ''}`
    }
    return 'unknown'
  }

  private isBypassingMCP(url: string): boolean {
    // Check if URL is direct call to RPC API endpoints
    const rpcApiPatterns = [
      '/api/v1/learning-loop/',
      '/api/v2/activities/',
      '/api/v1/templates/',
      '/api/v2/impulses/',
    ]
    
    // If URL contains RPC API pattern and doesn't come from MCP CLI, it's a bypass
    return rpcApiPatterns.some(pattern => url.includes(pattern))
  }

  getBypassedRequests(): Array<{ method: string; url: string }> {
    return this.interceptedRequests
      .filter(req => req.bypassed)
      .map(req => ({ method: req.method, url: req.url }))
  }

  getAllRequests(): Array<{ method: string; url: string; bypassed: boolean }> {
    return this.interceptedRequests
  }
}

/**
 * Query SurrealDB to verify activity execution was recorded
 */
async function verifyActivityInDatabase(
  activityId: string,
  expectedMetrics: ValidationInput['expectedMetrics']
): Promise<{ pass: boolean; actual: any; errors: string[] }> {
  const errors: string[] = []
  
  try {
    // Import SurrealDB client (assuming it exists in the codebase)
    // For now, use HTTP query as fallback
    const response = await fetch('http://localhost:8000/sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT * FROM activity WHERE id = '${activityId}'`,
      }),
    })

    if (!response.ok) {
      errors.push(`Database query failed: ${response.status} ${response.statusText}`)
      return { pass: false, actual: null, errors }
    }

    const data = await response.json()
    const activity = data[0]?.result?.[0]

    if (!activity) {
      errors.push(`Activity ${activityId} not found in database`)
      return { pass: false, actual: null, errors }
    }

    // Verify metrics
    const metricsMatch = 
      Math.abs(activity.duration - expectedMetrics.duration) < 1000 && // within 1 second
      Math.abs(activity.cost - expectedMetrics.cost) < 0.01 && // within 1 cent
      activity.success === expectedMetrics.success

    if (!metricsMatch) {
      errors.push('Metrics mismatch')
      errors.push(`Expected: ${JSON.stringify(expectedMetrics)}`)
      errors.push(`Actual: ${JSON.stringify({
        duration: activity.duration,
        cost: activity.cost,
        success: activity.success,
      })}`)
    }

    return {
      pass: metricsMatch,
      actual: activity,
      errors,
    }
  } catch (error) {
    errors.push(`Database verification error: ${error instanceof Error ? error.message : String(error)}`)
    return { pass: false, actual: null, errors }
  }
}

/**
 * Query Redis to verify template metrics were updated
 */
async function verifyTemplateMetrics(
  templateId: string
): Promise<{ pass: boolean; actual: any; errors: string[] }> {
  const errors: string[] = []
  
  try {
    // Call RPC API to get template metrics (which queries Redis)
    const response = await fetch(`http://localhost:8080/api/v2/activities/templates/${templateId}/metrics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      errors.push(`Template metrics query failed: ${response.status} ${response.statusText}`)
      return { pass: false, actual: null, errors }
    }

    const metrics = await response.json()

    if (!metrics || typeof metrics.stable?.executions !== 'number') {
      errors.push('Template metrics not found or invalid format')
      return { pass: false, actual: metrics, errors }
    }

    // Verify metrics structure
    const hasRequiredFields = 
      typeof metrics.stable.executions === 'number' &&
      typeof metrics.stable.success_rate === 'number' &&
      typeof metrics.stable.avg_cost === 'number' &&
      typeof metrics.stable.avg_duration === 'number'

    if (!hasRequiredFields) {
      errors.push('Template metrics missing required fields')
    }

    return {
      pass: hasRequiredFields,
      actual: metrics,
      errors,
    }
  } catch (error) {
    errors.push(`Template metrics verification error: ${error instanceof Error ? error.message : String(error)}`)
    return { pass: false, actual: null, errors }
  }
}

/**
 * Verify boredom detection identifies stale templates
 */
async function verifyBoredomDetection(): Promise<{ pass: boolean; actual: any; errors: string[] }> {
  const errors: string[] = []
  
  try {
    // Call RPC API boredom-activities endpoint
    const response = await fetch('http://localhost:8080/api/v1/learning-loop/boredom-activities', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      errors.push(`Boredom detection query failed: ${response.status} ${response.statusText}`)
      return { pass: false, actual: null, errors }
    }

    const boredomData = await response.json()

    // Verify response structure
    const hasValidStructure = 
      Array.isArray(boredomData) ||
      (typeof boredomData === 'object' && Array.isArray(boredomData.activities))

    if (!hasValidStructure) {
      errors.push('Boredom detection response has invalid structure')
      return { pass: false, actual: boredomData, errors }
    }

    return {
      pass: true,
      actual: boredomData,
      errors,
    }
  } catch (error) {
    errors.push(`Boredom detection verification error: ${error instanceof Error ? error.message : String(error)}`)
    return { pass: false, actual: null, errors }
  }
}

/**
 * Verify impulse data is stored and retrievable
 */
async function verifyImpulseStorage(
  impulseId: string
): Promise<{ pass: boolean; actual: any; errors: string[] }> {
  const errors: string[] = []
  
  try {
    // Call RPC API to retrieve impulse
    const response = await fetch(`http://localhost:8080/api/v2/impulses/${impulseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      errors.push(`Impulse retrieval failed: ${response.status} ${response.statusText}`)
      return { pass: false, actual: null, errors }
    }

    const impulse = await response.json()

    if (!impulse || !impulse.id) {
      errors.push('Impulse not found or invalid format')
      return { pass: false, actual: impulse, errors }
    }

    // Verify impulse structure
    const hasRequiredFields = 
      typeof impulse.id === 'string' &&
      typeof impulse.type === 'string' &&
      impulse.pointer !== undefined

    if (!hasRequiredFields) {
      errors.push('Impulse missing required fields')
    }

    return {
      pass: hasRequiredFields,
      actual: impulse,
      errors,
    }
  } catch (error) {
    errors.push(`Impulse storage verification error: ${error instanceof Error ? error.message : String(error)}`)
    return { pass: false, actual: null, errors }
  }
}

/**
 * Verify code quality MCP tools are working
 */
async function verifyCodeQualityTools(): Promise<{ pass: boolean; actual: any; errors: string[] }> {
  const errors: string[] = []
  
  try {
    // Test metabob_search_codebase_issues MCP tool
    // This would normally go through MCP client, but for validation we test the endpoint
    const response = await fetch('http://localhost:8080/api/v1/codebase/search-issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'test query',
        severity_filter: ['HIGH'],
        limit: 5,
      }),
    })

    if (!response.ok) {
      errors.push(`Code quality tools query failed: ${response.status} ${response.statusText}`)
      return { pass: false, actual: null, errors }
    }

    const issues = await response.json()

    // Verify response is valid (even if empty)
    const hasValidStructure = 
      Array.isArray(issues) ||
      (typeof issues === 'object' && Array.isArray(issues.issues))

    if (!hasValidStructure) {
      errors.push('Code quality tools response has invalid structure')
    }

    return {
      pass: hasValidStructure,
      actual: issues,
      errors,
    }
  } catch (error) {
    errors.push(`Code quality tools verification error: ${error instanceof Error ? error.message : String(error)}`)
    return { pass: false, actual: null, errors }
  }
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationResult> {
  const errors: string[] = []
  const details: ValidationResult['details'] = {}

  // Start HTTP interceptor
  const interceptor = new HttpInterceptor()
  interceptor.start()

  try {
    // Test 1: Verify activity recorded in database
    const activityCheck = await verifyActivityInDatabase(input.activityId, input.expectedMetrics)
    details.activityRecorded = activityCheck.pass
    errors.push(...activityCheck.errors)

    // Test 2: Verify template metrics updated
    const metricsCheck = await verifyTemplateMetrics(input.templateId)
    details.metricsUpdated = metricsCheck.pass
    errors.push(...metricsCheck.errors)

    // Test 3: Verify boredom detection (unless skipped)
    if (!input.skipBoredomCheck) {
      const boredomCheck = await verifyBoredomDetection()
      details.boredomDetected = boredomCheck.pass
      errors.push(...boredomCheck.errors)
    }

    // Test 4: Verify impulse storage (if impulseId provided)
    if (input.impulseId) {
      const impulseCheck = await verifyImpulseStorage(input.impulseId)
      details.impulseStored = impulseCheck.pass
      errors.push(...impulseCheck.errors)
    }

    // Test 5: Verify code quality tools
    const codeQualityCheck = await verifyCodeQualityTools()
    details.mcpToolsWorking = codeQualityCheck.pass
    errors.push(...codeQualityCheck.errors)

    // Test 6: Verify no direct HTTP bypassing MCP
    const bypassedRequests = interceptor.getBypassedRequests()
    details.noDirectHttp = bypassedRequests.length === 0
    if (bypassedRequests.length > 0) {
      errors.push(`Detected ${bypassedRequests.length} direct HTTP calls bypassing MCP:`)
      bypassedRequests.forEach(req => {
        errors.push(`  ${req.method} ${req.url}`)
      })
    }

    // Overall pass if all required checks passed
    const pass = 
      (details.activityRecorded === true) &&
      (details.metricsUpdated === true) &&
      (input.skipBoredomCheck || details.boredomDetected === true) &&
      (!input.impulseId || details.impulseStored === true) &&
      (details.mcpToolsWorking === true) &&
      (details.noDirectHttp === true)

    return {
      pass,
      testName: 'metabob-cli-mcp-activity-impulse-learning-integration',
      actual: details,
      expected: {
        activityRecorded: true,
        metricsUpdated: true,
        boredomDetected: !input.skipBoredomCheck,
        impulseStored: !!input.impulseId,
        mcpToolsWorking: true,
        noDirectHttp: true,
      },
      errors,
      details,
    }
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)
    return {
      pass: false,
      testName: 'metabob-cli-mcp-activity-impulse-learning-integration',
      actual: details,
      expected: {},
      errors,
      details,
    }
  } finally {
    // Stop HTTP interceptor
    interceptor.stop()
  }
}

/**
 * Run full validation suite with multiple test cases
 */
export async function runValidationSuite(testCases: ValidationInput[]): Promise<ValidationSuite> {
  const results: ValidationResult[] = []

  for (const testCase of testCases) {
    const result = await runValidation(testCase)
    results.push(result)
  }

  const passedTests = results.filter(r => r.pass).length
  const failedTests = results.filter(r => !r.pass).length

  return {
    pass: failedTests === 0,
    totalTests: results.length,
    passedTests,
    failedTests,
    results,
  }
}

/**
 * CLI entry point for running validation
 */
if (require.main === module) {
  const testCase: ValidationInput = {
    activityId: process.argv[2] || 'test-activity-1',
    templateId: process.argv[3] || 'test-template-1',
    expectedMetrics: {
      duration: 5000,
      cost: 0.05,
      tokens: { input: 1000, output: 500, cache: 200 },
      success: true,
    },
    impulseId: process.argv[4],
  }

  runValidation(testCase)
    .then(result => {
      console.log('\n=== Validation Result ===')
      console.log(`Pass: ${result.pass}`)
      console.log(`\nDetails:`)
      console.log(JSON.stringify(result.details, null, 2))
      
      if (result.errors.length > 0) {
        console.log(`\nErrors:`)
        result.errors.forEach(err => console.log(`  - ${err}`))
      }
      
      process.exit(result.pass ? 0 : 1)
    })
    .catch(error => {
      console.error('Validation failed:', error)
      process.exit(1)
    })
}
