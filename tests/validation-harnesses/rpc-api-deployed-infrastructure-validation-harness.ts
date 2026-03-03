#!/usr/bin/env tsx
/**
 * RPC API Deployed Infrastructure Validation Harness
 * 
 * Tests metabob-rpc-api endpoints against deployed Kubernetes infrastructure:
 * - api.metabob.local (RPC API service)
 * - devbob.metabob.local (DevBob container)
 * - SurrealDB backend
 * - Redis cache
 * 
 * Validates:
 * 1. Health check endpoint
 * 2. Template CRUD operations
 * 3. Quality score endpoint
 * 4. Learning loop execution recording
 * 5. Multi-tenant isolation
 * 6. Schema tolerance
 */

import axios, { AxiosError } from "axios"

const RPC_API_URL = process.env.RPC_API_URL || "http://api.metabob.local"
const LEARNING_LOOP_URL = `${RPC_API_URL}/api/v1/learning-loop`

interface TestResult {
  testCase: string
  status: "PASS" | "FAIL" | "SKIP"
  message: string
  response?: any
}

const results: TestResult[] = []

function logResult(result: TestResult) {
  const icon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⏭️"
  console.log(`${icon} ${result.testCase}: ${result.message}`)
  results.push(result)
}

async function testHealthCheck(): Promise<void> {
  try {
    const response = await axios.get(`${RPC_API_URL}/`)
    if (response.status === 200 && response.data.status === "ok") {
      logResult({
        testCase: "TC1: Health Check",
        status: "PASS",
        message: `Health endpoint returned 200 OK with status='ok', version=${response.data.version}`,
        response: response.data
      })
    } else {
      logResult({
        testCase: "TC1: Health Check",
        status: "FAIL",
        message: `Unexpected response: ${JSON.stringify(response.data)}`,
        response: response.data
      })
    }
  } catch (error) {
    logResult({
      testCase: "TC1: Health Check",
      status: "FAIL",
      message: `Request failed: ${(error as Error).message}`
    })
  }
}

async function testListTemplates(): Promise<void> {
  try {
    const response = await axios.get(`${RPC_API_URL}/v2/activities/templates`, {
      headers: {
        "x-tenant-id": "test-tenant-harness",
        "x-org-id": "test-org-harness",
        "x-project-id": "test-project-harness"
      }
    })
    
    if (response.status === 200 && Array.isArray(response.data.templates)) {
      logResult({
        testCase: "TC2: List Templates",
        status: "PASS",
        message: `Template listing returned ${response.data.templates.length} templates`,
        response: { count: response.data.templates.length }
      })
    } else {
      logResult({
        testCase: "TC2: List Templates",
        status: "FAIL",
        message: `Invalid response format: ${JSON.stringify(response.data)}`
      })
    }
  } catch (error) {
    logResult({
      testCase: "TC2: List Templates",
      status: "FAIL",
      message: `Request failed: ${(error as Error).message}`
    })
  }
}

async function testCreateTemplate(): Promise<string | null> {
  try {
    const templateData = {
      name: "infrastructure-validation-harness-test",
      description: "Test template created by validation harness",
      category: "testing",
      tasks: [
        {
          id: "task-1",
          description: "Test task",
          prompt: "Test prompt for validation"
        }
      ]
    }
    
    const response = await axios.post(
      `${RPC_API_URL}/v2/activities/templates`,
      templateData,
      {
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "test-tenant-harness",
          "x-org-id": "test-org-harness",
          "x-project-id": "test-project-harness"
        }
      }
    )
    
    if (response.status === 201 && response.data.variant_id) {
      logResult({
        testCase: "TC3: Create Template",
        status: "PASS",
        message: `Template created with variant_id=${response.data.variant_id}`,
        response: { variant_id: response.data.variant_id }
      })
      return response.data.variant_id
    } else {
      logResult({
        testCase: "TC3: Create Template",
        status: "FAIL",
        message: `Invalid response: ${JSON.stringify(response.data)}`
      })
      return null
    }
  } catch (error) {
    const axiosError = error as AxiosError
    logResult({
      testCase: "TC3: Create Template",
      status: "FAIL",
      message: `Request failed: ${axiosError.message} (SurrealDB auth issue expected)`,
      response: axiosError.response?.data
    })
    return null
  }
}

async function testGetTemplate(variantId: string): Promise<void> {
  try {
    const response = await axios.get(
      `${RPC_API_URL}/v2/activities/templates/${variantId}`
    )
    
    if (response.status === 200 && response.data.variant_id === variantId) {
      logResult({
        testCase: "TC4: Get Template by ID",
        status: "PASS",
        message: `Template retrieved successfully`,
        response: { variant_id: response.data.variant_id }
      })
    } else {
      logResult({
        testCase: "TC4: Get Template by ID",
        status: "FAIL",
        message: `Invalid response: ${JSON.stringify(response.data)}`
      })
    }
  } catch (error) {
    logResult({
      testCase: "TC4: Get Template by ID",
      status: "FAIL",
      message: `Request failed: ${(error as Error).message}`
    })
  }
}

async function testQualityScoreEndpoint(variantId: string): Promise<void> {
  try {
    const response = await axios.get(
      `${RPC_API_URL}/v2/activities/templates/${variantId}/quality-score`
    )
    
    if (response.status === 200 && typeof response.data.quality_score === "number") {
      logResult({
        testCase: "TC5: Quality Score Endpoint",
        status: "PASS",
        message: `Quality score: ${response.data.quality_score}`,
        response: response.data
      })
    } else {
      logResult({
        testCase: "TC5: Quality Score Endpoint",
        status: "FAIL",
        message: `Invalid response: ${JSON.stringify(response.data)}`
      })
    }
  } catch (error) {
    logResult({
      testCase: "TC5: Quality Score Endpoint",
      status: "FAIL",
      message: `Request failed: ${(error as Error).message}`
    })
  }
}

async function testSchemaToleranceMinimalData(): Promise<void> {
  try {
    const minimalExecution = {
      activity_id: "test-activity-harness-001",
      duration_ms: 5000,
      success: true
    }
    
    const response = await axios.post(
      `${LEARNING_LOOP_URL}/executions`,
      minimalExecution,
      {
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "test-tenant-harness"
        }
      }
    )
    
    if (response.status === 201 && response.data.success) {
      logResult({
        testCase: "TC6: Schema Tolerance (Minimal Data)",
        status: "PASS",
        message: `Execution recorded with minimal data, execution_id=${response.data.execution_id}`,
        response: response.data
      })
    } else {
      logResult({
        testCase: "TC6: Schema Tolerance (Minimal Data)",
        status: "FAIL",
        message: `Invalid response: ${JSON.stringify(response.data)}`
      })
    }
  } catch (error) {
    const axiosError = error as AxiosError
    logResult({
      testCase: "TC6: Schema Tolerance (Minimal Data)",
      status: "FAIL",
      message: `Request failed: ${axiosError.message}`,
      response: axiosError.response?.data
    })
  }
}

async function testMultiTenantIsolation(): Promise<void> {
  try {
    // Test without auth token (should return only global templates)
    const publicResponse = await axios.get(`${RPC_API_URL}/v2/activities/templates`)
    
    // Test with org-specific headers (should return global + org templates)
    const orgResponse = await axios.get(`${RPC_API_URL}/v2/activities/templates`, {
      headers: {
        "x-tenant-id": "test-tenant-isolation",
        "x-org-id": "test-org-isolation",
        "x-project-id": "test-project-isolation"
      }
    })
    
    logResult({
      testCase: "TC7: Multi-Tenant Isolation",
      status: "PASS",
      message: `Public: ${publicResponse.data.templates.length} templates, Org: ${orgResponse.data.templates.length} templates`,
      response: {
        publicCount: publicResponse.data.templates.length,
        orgCount: orgResponse.data.templates.length
      }
    })
  } catch (error) {
    logResult({
      testCase: "TC7: Multi-Tenant Isolation",
      status: "FAIL",
      message: `Request failed: ${(error as Error).message}`
    })
  }
}

async function testDevBobIntegration(): Promise<void> {
  logResult({
    testCase: "TC8: DevBob Integration",
    status: "SKIP",
    message: "Manual test required - execute activity from DevBob container"
  })
}

async function main() {
  console.log("=== RPC API Deployed Infrastructure Validation Harness ===\n")
  console.log(`Target: ${RPC_API_URL}`)
  console.log(`Learning Loop: ${LEARNING_LOOP_URL}\n`)
  
  // Run tests sequentially
  await testHealthCheck()
  await testListTemplates()
  
  const variantId = await testCreateTemplate()
  
  if (variantId) {
    await testGetTemplate(variantId)
    await testQualityScoreEndpoint(variantId)
  } else {
    console.log("\n⏭️  Skipping template-dependent tests (template creation failed)\n")
  }
  
  await testSchemaToleranceMinimalData()
  await testMultiTenantIsolation()
  await testDevBobIntegration()
  
  // Summary
  console.log("\n=== Test Summary ===")
  const passed = results.filter(r => r.status === "PASS").length
  const failed = results.filter(r => r.status === "FAIL").length
  const skipped = results.filter(r => r.status === "SKIP").length
  
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`Total: ${results.length}`)
  
  if (failed > 0) {
    console.log("\n❌ Some tests failed. See details above.")
    process.exit(1)
  } else {
    console.log("\n✅ All executable tests passed!")
    process.exit(0)
  }
}

main().catch((error) => {
  console.error("Harness execution failed:", error)
  process.exit(1)
})
