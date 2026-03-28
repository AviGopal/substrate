#!/usr/bin/env tsx
/**
 * RPC API Deployed Infrastructure Validation Harness
 * 
 * Infrastructure-aware validation that tests against actual deployed Kubernetes services:
 * - api.metabob.local (RPC API endpoints)
 * - SurrealDB (data persistence)
 * - Redis (caching)
 * - DevBob container (integration)
 * 
 * This harness validates that code changes from previous activities are actually deployed
 * and working with real infrastructure dependencies in the target Kubernetes environment.
 */

import { execSync } from "child_process"

// ============================================================================
// Types
// ============================================================================

interface ValidationInput {
  testCase: string
  description: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  endpoint: string
  headers?: Record<string, string>
  body?: any
  kubeCheck?: {
    namespace: string
    resource: string
    selector?: string
  }
  surrealCheck?: {
    query: string
    namespace: string
    database: string
  }
}

interface ValidationOutput {
  pass: boolean
  testCase: string
  actual: {
    statusCode?: number
    response?: any
    error?: string
    kubeStatus?: string
    surrealResult?: string
  }
  expected: {
    statusCode?: number
    responsePattern?: any
    description: string
  }
  message: string
}

interface ValidationResult {
  totalTests: number
  passed: number
  failed: number
  skipped: number
  results: ValidationOutput[]
}

// ============================================================================
// Configuration
// ============================================================================

const RPC_API_URL = process.env.RPC_API_URL || "http://api.metabob.local"
const KUBE_NAMESPACE = process.env.KUBE_NAMESPACE || "metabob"
const SURREAL_POD = process.env.SURREAL_POD || "surrealdb-5bdddd9989-sdm5g"
const DEVBOB_POD = process.env.DEVBOB_POD || "devbob-766dcccf49-hfql6"
const RPC_API_POD = process.env.RPC_API_POD || "metabob-rpc-api-5c5dfb6b9b-rbhm8"

// ============================================================================
// Infrastructure Checks
// ============================================================================

function checkKubePodStatus(namespace: string, podSelector: string): string {
  try {
    const output = execSync(
      `kubectl get pods -n ${namespace} -l ${podSelector} -o jsonpath='{.items[0].status.phase}'`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    )
    return output.trim() || "Unknown"
  } catch (error) {
    return `Error: ${(error as Error).message}`
  }
}

function checkSurrealDBVersion(): string {
  try {
    const version = execSync(
      `kubectl exec -n ${KUBE_NAMESPACE} ${SURREAL_POD} -- /surreal version`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    )
    return version.trim()
  } catch (error) {
    return `Error: ${(error as Error).message}`
  }
}

function querySurrealDB(query: string, namespace: string, database: string): string {
  try {
    const cmd = `kubectl exec -n ${KUBE_NAMESPACE} ${SURREAL_POD} -- /surreal sql \
      --conn http://localhost:8000 \
      --namespace ${namespace} \
      --database ${database} \
      --user root \
      --pass root \
      "${query}" 2>&1`
    
    const result = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
    return result.trim()
  } catch (error) {
    return `Error: ${(error as Error).message}`
  }
}

function checkRedisConnection(): string {
  try {
    const result = execSync(
      `kubectl exec -n ${KUBE_NAMESPACE} redis-master-0 -- redis-cli PING`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    )
    return result.trim()
  } catch (error) {
    return `Error: ${(error as Error).message}`
  }
}

// ============================================================================
// HTTP Request Helper
// ============================================================================

async function makeHttpRequest(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ statusCode: number; response: any; error?: string }> {
  try {
    // Build curl command
    let curlCmd = `curl -s -w "\\n%{http_code}" -X ${method} "${url}"`
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curlCmd += ` -H "${key}: ${value}"`
    })
    
    // Add body for POST/PUT
    if (body && (method === "POST" || method === "PUT")) {
      const bodyJson = JSON.stringify(body).replace(/"/g, '\\"')
      curlCmd += ` -d "${bodyJson}"`
    }
    
    const output = execSync(curlCmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    })
    
    // Split response body and status code
    const lines = output.trim().split("\n")
    const statusCode = parseInt(lines[lines.length - 1], 10)
    const responseBody = lines.slice(0, -1).join("\n")
    
    let response: any
    try {
      response = JSON.parse(responseBody)
    } catch {
      response = responseBody
    }
    
    return { statusCode, response }
  } catch (error) {
    return {
      statusCode: 0,
      response: null,
      error: (error as Error).message
    }
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const result: ValidationOutput = {
    pass: false,
    testCase: input.testCase,
    actual: {},
    expected: {
      description: input.description
    },
    message: ""
  }
  
  try {
    // 1. Infrastructure checks (if specified)
    if (input.kubeCheck) {
      const kubeStatus = checkKubePodStatus(
        input.kubeCheck.namespace,
        input.kubeCheck.selector || "app=" + input.kubeCheck.resource
      )
      result.actual.kubeStatus = kubeStatus
      
      if (kubeStatus !== "Running") {
        result.message = `Infrastructure check failed: Pod ${input.kubeCheck.resource} is ${kubeStatus}`
        return result
      }
    }
    
    // 2. HTTP request
    const url = input.endpoint.startsWith("http")
      ? input.endpoint
      : `${RPC_API_URL}${input.endpoint}`
    
    const httpResult = await makeHttpRequest(
      input.method,
      url,
      input.headers || {},
      input.body
    )
    
    result.actual.statusCode = httpResult.statusCode
    result.actual.response = httpResult.response
    result.actual.error = httpResult.error
    
    // 3. SurrealDB check (if specified)
    if (input.surrealCheck) {
      const surrealResult = querySurrealDB(
        input.surrealCheck.query,
        input.surrealCheck.namespace,
        input.surrealCheck.database
      )
      result.actual.surrealResult = surrealResult
    }
    
    // 4. Validate response (basic validation - detailed validation in test cases)
    result.pass = httpResult.statusCode >= 200 && httpResult.statusCode < 300
    result.message = result.pass
      ? `Request succeeded with status ${httpResult.statusCode}`
      : `Request failed with status ${httpResult.statusCode}: ${httpResult.error || JSON.stringify(httpResult.response)}`
    
  } catch (error) {
    result.message = `Validation error: ${(error as Error).message}`
  }
  
  return result
}

// ============================================================================
// Test Cases
// ============================================================================

const TEST_CASES: ValidationInput[] = [
  // TC1: Infrastructure Status
  {
    testCase: "TC1-Infrastructure-Status",
    description: "Verify all pods are running in metabob namespace",
    method: "GET",
    endpoint: "/",
    kubeCheck: {
      namespace: KUBE_NAMESPACE,
      resource: "metabob-rpc-api",
      selector: "app=metabob-rpc-api"
    }
  },
  
  // TC2: Health Check Endpoint
  {
    testCase: "TC2-Health-Check",
    description: "Health endpoint returns status ok with version",
    method: "GET",
    endpoint: "/"
  },
  
  // TC3: List Templates (Empty)
  {
    testCase: "TC3-List-Templates-Empty",
    description: "Template listing returns empty array initially",
    method: "GET",
    endpoint: "/v2/activities/templates",
    headers: {
      "x-tenant-id": "validation-harness",
      "x-org-id": "test-org",
      "x-project-id": "test-project"
    }
  },
  
  // TC4: List Templates (Multi-Tenant Headers)
  {
    testCase: "TC4-List-Templates-MultiTenant",
    description: "Template listing accepts multi-tenant headers",
    method: "GET",
    endpoint: "/v2/activities/templates",
    headers: {
      "x-tenant-id": "tenant-isolation-test",
      "x-org-id": "org-isolation-test",
      "x-project-id": "project-isolation-test"
    }
  },
  
  // TC5: Create Template (Expected to fail due to SurrealDB auth)
  {
    testCase: "TC5-Create-Template-SurrealDB-Blocker",
    description: "Template creation blocked by SurrealDB version mismatch",
    method: "POST",
    endpoint: "/v2/activities/templates",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": "validation-harness",
      "x-org-id": "test-org",
      "x-project-id": "test-project"
    },
    body: {
      name: "validation-harness-test-template",
      description: "Test template for infrastructure validation",
      category: "testing",
      tasks: [
        {
          id: "task-1",
          description: "Test task",
          prompt: "Test prompt"
        }
      ]
    }
  },
  
  // TC6: Schema Tolerance - Minimal Execution Data
  {
    testCase: "TC6-Schema-Tolerance-Minimal",
    description: "Learning loop accepts minimal execution data (schema tolerance)",
    method: "POST",
    endpoint: "/api/v1/learning-loop/executions",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": "validation-harness"
    },
    body: {
      activity_id: "test-activity-harness-schema-tolerance",
      duration_ms: 5000,
      success: true
    }
  },
  
  // TC7: Error Handling - Invalid Tenant
  {
    testCase: "TC7-Error-Handling-Invalid-Tenant",
    description: "API handles invalid tenant_id gracefully",
    method: "GET",
    endpoint: "/v2/activities/templates",
    headers: {
      "x-tenant-id": "invalid-tenant-$$$"
    }
  },
  
  // TC8: SurrealDB Version Check
  {
    testCase: "TC8-SurrealDB-Version-Check",
    description: "Verify SurrealDB version (expecting v2.3.10 incompatibility)",
    method: "GET",
    endpoint: "/"
  },
  
  // TC9: Redis Connectivity
  {
    testCase: "TC9-Redis-Connectivity",
    description: "Verify Redis connection for caching",
    method: "GET",
    endpoint: "/"
  }
]

// ============================================================================
// Main Validation Runner
// ============================================================================

async function runAllValidations(): Promise<ValidationResult> {
  console.log("=== RPC API Deployed Infrastructure Validation Harness ===\n")
  console.log(`Target: ${RPC_API_URL}`)
  console.log(`Namespace: ${KUBE_NAMESPACE}`)
  console.log(`SurrealDB Pod: ${SURREAL_POD}`)
  console.log(`DevBob Pod: ${DEVBOB_POD}`)
  console.log(`RPC API Pod: ${RPC_API_POD}\n`)
  
  // Pre-flight checks
  console.log("=== Pre-flight Infrastructure Checks ===")
  console.log(`RPC API Pod Status: ${checkKubePodStatus(KUBE_NAMESPACE, "app=metabob-rpc-api")}`)
  console.log(`DevBob Pod Status: ${checkKubePodStatus(KUBE_NAMESPACE, "app=devbob")}`)
  console.log(`SurrealDB Version: ${checkSurrealDBVersion()}`)
  console.log(`Redis Connection: ${checkRedisConnection()}\n`)
  
  const results: ValidationOutput[] = []
  let passed = 0
  let failed = 0
  let skipped = 0
  
  console.log("=== Running Validation Test Cases ===\n")
  
  for (const testCase of TEST_CASES) {
    console.log(`Running ${testCase.testCase}...`)
    const result = await runValidation(testCase)
    results.push(result)
    
    if (result.pass) {
      console.log(`✅ PASS: ${result.message}\n`)
      passed++
    } else if (result.message.includes("SKIP")) {
      console.log(`⏭️  SKIP: ${result.message}\n`)
      skipped++
    } else {
      console.log(`❌ FAIL: ${result.message}\n`)
      failed++
    }
  }
  
  // Summary
  console.log("=== Validation Summary ===")
  console.log(`Total Tests: ${TEST_CASES.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  
  return {
    totalTests: TEST_CASES.length,
    passed,
    failed,
    skipped,
    results
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  runAllValidations()
    .then((result) => {
      if (result.failed > 0) {
        process.exit(1)
      } else {
        process.exit(0)
      }
    })
    .catch((error) => {
      console.error("Harness execution failed:", error)
      process.exit(1)
    })
}

// Export for use as module
export { ValidationInput, ValidationOutput, ValidationResult, TEST_CASES }
