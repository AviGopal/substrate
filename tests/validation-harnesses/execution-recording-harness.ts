#!/usr/bin/env bun

/**
 * Validation Harness for Activity Execution Recording and Metrics Feedback Loop
 * 
 * Tests the complete execution recording and metrics feedback loop:
 * - Case 1: Execute activity, verify execution recorded in database
 * - Case 2: Verify template_metrics updated (total_executions > 0)
 * - Case 3: Verify success_rate calculated correctly
 * - Case 4: Verify Thompson sampling parameters updated (alpha/beta)
 * - Case 5: Multiple executions aggregate correctly
 * - Case 6: Failed execution recorded and metrics updated accordingly
 * 
 * Architecture:
 * Activity.complete() → TemplateMetricsClient.reportExecution() → 
 * HTTP POST /api/v1/learning-loop/executions → insert_execution() → 
 * update_metrics_after_execution() → Database updated
 */

// Types
interface ValidationCase {
  id: string
  description: string
  input: {
    templateId: string
    executeCount: number
    expectedSuccess: boolean[]
  }
  expectedOutput: {
    executionRecordsCount: number
    totalExecutions: number
    successfulExecutions: number
    successRate: number
    metricsUpdated: boolean
    thompsonAlpha?: number
    thompsonBeta?: number
  }
}

interface ValidationResult {
  pass: boolean
  caseId: string
  actual: any
  expected: any
  error?: string
  details?: string
}

interface ExecutionRecord {
  activity_id: string
  template_id: string
  success: boolean
  duration_ms: number
  cost_usd: number
  tokens_input: number
  tokens_output: number
  tokens_cache: number
}

interface TemplateMetrics {
  variant_id: string
  total_executions: number
  successful_executions: number
  failed_executions: number
  success_rate: number
  avg_cost_usd: number
  avg_duration_ms: number
  avg_tokens_input: number
  avg_tokens_output: number
  avg_tokens_cache: number
  thompson_alpha: number
  thompson_beta: number
  last_executed_at: string
}

// Configuration
const BACKEND_URL = process.env.METABOB_RPC_API_URL || "http://localhost:8000"
const TEST_TEMPLATE_ID = "execution-recording-test-template"

// Test cases
const TEST_CASES: ValidationCase[] = [
  {
    id: "validation-execution-recording-case-1",
    description: "Single successful execution recorded",
    input: {
      templateId: TEST_TEMPLATE_ID,
      executeCount: 1,
      expectedSuccess: [true],
    },
    expectedOutput: {
      executionRecordsCount: 1,
      totalExecutions: 1,
      successfulExecutions: 1,
      successRate: 1.0,
      metricsUpdated: true,
      thompsonAlpha: 2.0, // 1 success + 1 prior
      thompsonBeta: 1.0, // 0 failures + 1 prior
    },
  },
  {
    id: "validation-execution-recording-case-2",
    description: "Multiple successful executions aggregate correctly",
    input: {
      templateId: TEST_TEMPLATE_ID,
      executeCount: 3,
      expectedSuccess: [true, true, true],
    },
    expectedOutput: {
      executionRecordsCount: 3,
      totalExecutions: 3,
      successfulExecutions: 3,
      successRate: 1.0,
      metricsUpdated: true,
      thompsonAlpha: 4.0, // 3 successes + 1 prior
      thompsonBeta: 1.0, // 0 failures + 1 prior
    },
  },
  {
    id: "validation-execution-recording-case-3",
    description: "Mixed success/failure executions calculate correct success_rate",
    input: {
      templateId: TEST_TEMPLATE_ID,
      executeCount: 4,
      expectedSuccess: [true, false, true, true],
    },
    expectedOutput: {
      executionRecordsCount: 4,
      totalExecutions: 4,
      successfulExecutions: 3,
      successRate: 0.75, // 3/4 = 0.75
      metricsUpdated: true,
      thompsonAlpha: 4.0, // 3 successes + 1 prior
      thompsonBeta: 2.0, // 1 failure + 1 prior
    },
  },
]

// Helper functions

async function queryBackend(endpoint: string): Promise<any> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`)
  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function postToBackend(endpoint: string, data: any): Promise<any> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Backend POST failed: ${response.status} ${errorText}`)
  }
  return response.json()
}

async function recordExecution(
  templateId: string,
  success: boolean,
  activityId?: string
): Promise<ExecutionRecord> {
  const activityIdValue = activityId || `test-activity-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const startedAt = new Date(Date.now() - 5000).toISOString()
  const completedAt = new Date().toISOString()

  const executionData = {
    activity_id: activityIdValue,
    template_id: templateId,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: 5000,
    success: success,
    tokens_input: 1000,
    tokens_output: 500,
    tokens_cache: 100,
    cost_usd: 0.01,
  }

  await postToBackend("/api/v1/learning-loop/executions", executionData)
  
  return {
    activity_id: activityIdValue,
    template_id: templateId,
    success: success,
    duration_ms: 5000,
    cost_usd: 0.01,
    tokens_input: 1000,
    tokens_output: 500,
    tokens_cache: 100,
  }
}

async function getExecutionRecords(templateId: string): Promise<ExecutionRecord[]> {
  try {
    const response = await queryBackend(`/api/v1/learning-loop/executions?template_id=${templateId}&limit=100`)
    return response.executions || []
  } catch (error) {
    console.error("Failed to get execution records:", error)
    return []
  }
}

async function getTemplateMetrics(templateId: string): Promise<TemplateMetrics | null> {
  try {
    const response = await queryBackend(`/api/v1/learning-loop/metrics/${templateId}`)
    return response
  } catch (error) {
    console.error("Failed to get template metrics:", error)
    return null
  }
}

async function cleanupTestData(templateId: string): Promise<void> {
  // Clean up test data (this would need to be implemented in the backend)
  // For now, we'll just log that cleanup should happen
  console.log(`Note: Test data for ${templateId} should be cleaned up manually if needed`)
}

async function runValidationCase(testCase: ValidationCase): Promise<ValidationResult> {
  try {
    console.log(`\n📋 Running test case: ${testCase.description}`)
    console.log(`   Template ID: ${testCase.input.templateId}`)

    // Clean up any existing test data
    await cleanupTestData(testCase.input.templateId)

    // Execute activities according to test case
    const executedIds: string[] = []
    for (let i = 0; i < testCase.input.executeCount; i++) {
      const success = testCase.input.expectedSuccess[i]
      console.log(`   ⏳ Recording execution ${i + 1}/${testCase.input.executeCount} (success=${success})...`)
      
      const record = await recordExecution(testCase.input.templateId, success)
      executedIds.push(record.activity_id)
      
      // Wait a bit for metrics to be aggregated
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`   ✅ Recorded ${executedIds.length} executions`)

    // Wait for metrics aggregation
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Query execution records
    const executionRecords = await getExecutionRecords(testCase.input.templateId)
    console.log(`   📊 Found ${executionRecords.length} execution records in database`)

    // Query template metrics
    const metrics = await getTemplateMetrics(testCase.input.templateId)
    console.log(`   📈 Template metrics:`, metrics ? {
      total: metrics.total_executions,
      successful: metrics.successful_executions,
      successRate: metrics.success_rate,
      alpha: metrics.thompson_alpha,
      beta: metrics.thompson_beta,
    } : "NOT FOUND")

    // Build actual results
    const actual = {
      executionRecordsCount: executionRecords.length,
      totalExecutions: metrics?.total_executions || 0,
      successfulExecutions: metrics?.successful_executions || 0,
      successRate: metrics?.success_rate || 0,
      metricsUpdated: metrics !== null,
      thompsonAlpha: metrics?.thompson_alpha,
      thompsonBeta: metrics?.thompson_beta,
      lastExecutedAt: metrics?.last_executed_at,
    }

    // Compare with expected
    const pass = 
      actual.executionRecordsCount === testCase.expectedOutput.executionRecordsCount &&
      actual.totalExecutions === testCase.expectedOutput.totalExecutions &&
      actual.successfulExecutions === testCase.expectedOutput.successfulExecutions &&
      Math.abs(actual.successRate - testCase.expectedOutput.successRate) < 0.01 && // Allow small floating point variance
      actual.metricsUpdated === testCase.expectedOutput.metricsUpdated

    // Check Thompson sampling if specified
    const thompsonPass = testCase.expectedOutput.thompsonAlpha && testCase.expectedOutput.thompsonBeta
      ? Math.abs((actual.thompsonAlpha || 0) - testCase.expectedOutput.thompsonAlpha) < 0.01 &&
        Math.abs((actual.thompsonBeta || 0) - testCase.expectedOutput.thompsonBeta) < 0.01
      : true

    const finalPass = pass && thompsonPass

    return {
      pass: finalPass,
      caseId: testCase.id,
      actual,
      expected: testCase.expectedOutput,
      details: finalPass
        ? "✅ All checks passed"
        : `❌ Validation failed:\n` +
          `   Expected: ${JSON.stringify(testCase.expectedOutput, null, 2)}\n` +
          `   Actual: ${JSON.stringify(actual, null, 2)}`,
    }
  } catch (error) {
    return {
      pass: false,
      caseId: testCase.id,
      actual: null,
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runAllValidations(): Promise<void> {
  console.log("🚀 Starting Activity Execution Recording Validation Harness")
  console.log(`   Backend URL: ${BACKEND_URL}`)
  console.log(`   Test cases: ${TEST_CASES.length}`)

  // Check if backend is accessible
  try {
    console.log("\n🔍 Checking backend connectivity...")
    await queryBackend("/health")
    console.log("   ✅ Backend is accessible")
  } catch (error) {
    console.error("   ❌ Backend is not accessible:", error)
    console.error("\n💡 Make sure metabob-rpc-api is running:")
    console.error("   docker-compose up metabob-rpc-api")
    console.error("   OR")
    console.error("   kubectl port-forward svc/metabob-rpc-api 8000:8000")
    process.exit(1)
  }

  const results: ValidationResult[] = []

  for (const testCase of TEST_CASES) {
    const result = await runValidationCase(testCase)
    results.push(result)
    
    if (result.pass) {
      console.log(`   ✅ PASS: ${testCase.description}`)
    } else {
      console.log(`   ❌ FAIL: ${testCase.description}`)
      if (result.error) {
        console.log(`      Error: ${result.error}`)
      }
      if (result.details) {
        console.log(`      ${result.details}`)
      }
    }
  }

  // Summary
  const passCount = results.filter(r => r.pass).length
  const failCount = results.filter(r => !r.pass).length

  console.log("\n" + "=".repeat(80))
  console.log("📊 VALIDATION SUMMARY")
  console.log("=".repeat(80))
  console.log(`Total test cases: ${results.length}`)
  console.log(`Passed: ${passCount} ✅`)
  console.log(`Failed: ${failCount} ❌`)
  console.log(`Success rate: ${((passCount / results.length) * 100).toFixed(1)}%`)
  console.log("=".repeat(80))

  if (failCount > 0) {
    console.log("\n❌ VALIDATION FAILED")
    console.log("\nFailed test cases:")
    results.filter(r => !r.pass).forEach(r => {
      console.log(`\n  • ${r.caseId}`)
      if (r.error) {
        console.log(`    Error: ${r.error}`)
      }
      if (r.details) {
        console.log(`    ${r.details}`)
      }
    })
    process.exit(1)
  } else {
    console.log("\n✅ ALL VALIDATIONS PASSED")
    console.log("\n🎉 Activity Execution Recording and Metrics Feedback Loop is working correctly!")
    process.exit(0)
  }
}

// Export for programmatic use
export { runValidationCase, TEST_CASES }

// Run if executed directly
if (import.meta.main) {
  runAllValidations().catch(error => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
