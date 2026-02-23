/**
 * Validation Harness: thompson-sampling-template-selection
 * 
 * Specification: Activity execution must select templates using Thompson Sampling
 * algorithm with dual-store metrics (Redis for fast lookup, SurrealDB for historical data).
 * 
 * Test Strategy:
 * 1. Create 2 test templates: A (90% success), B (50% success)
 * 2. Mock metrics with Beta parameters (alpha, beta)
 * 3. Run 100 template selections
 * 4. Verify: A selected ~75% (exploitation), B selected ~25% (exploration)
 * 5. Verify: selection_reason contains Beta parameters and sample values
 * 
 * Expected Behavior:
 * - Template A: alpha=19 (18+1), beta=3 (2+1) -> ~75-85% selection rate
 * - Template B: alpha=11 (10+1), beta=11 (10+1) -> ~15-25% selection rate
 * - selection_reason: { method: "thompson_sampling", alpha, beta, sample }
 */

import { TemplateMetrics, TemplateMetricsResponse } from "../../repos/metabob-opencode/packages/opencode/src/session/template-metrics"

// Mock TemplateMetricsClient for testing
let mockMetricsResponse: TemplateMetricsResponse | null = null

export function setMockMetrics(metrics: TemplateMetricsResponse): void {
  mockMetricsResponse = metrics
}

export function clearMockMetrics(): void {
  mockMetricsResponse = null
}

// Test case 1: Validate Beta distribution sampling
export interface BetaSampleTestCase {
  alpha: number
  beta: number
  expectedRange: { min: number; max: number }
  sampleSize: number
}

export function validateBetaSample(testCase: BetaSampleTestCase): {
  pass: boolean
  actual: { mean: number; min: number; max: number; samples: number[] }
  expected: { range: { min: number; max: number }; expectedMean: number }
  message: string
} {
  // Import betaSample function (need to expose it for testing)
  // For now, we'll test the full selection flow
  
  const expectedMean = testCase.alpha / (testCase.alpha + testCase.beta)
  
  return {
    pass: false,
    actual: { mean: 0, min: 0, max: 0, samples: [] },
    expected: { range: testCase.expectedRange, expectedMean },
    message: "Beta sampling validation requires implementation access"
  }
}

// Test case 2: Validate Thompson Sampling selection distribution
export interface ThompsonSamplingTestCase {
  templateA: {
    id: string
    successes: number
    failures: number
    expectedSelectionRate: { min: number; max: number }
  }
  templateB: {
    id: string
    successes: number
    failures: number
    expectedSelectionRate: { min: number; max: number }
  }
  iterations: number
}

export async function validateThompsonSamplingDistribution(
  testCase: ThompsonSamplingTestCase,
  selectFn: (templateId: string) => Promise<{ selectedId: string; thompsonSampling?: any }>
): Promise<{
  pass: boolean
  actual: {
    aSelections: number
    bSelections: number
    aRate: number
    bRate: number
    sampleMetadata: Array<{ alpha: number; beta: number; sample: number }>
  }
  expected: {
    aRate: { min: number; max: number }
    bRate: { min: number; max: number }
  }
  message: string
}> {
  // Mock metrics for testing
  const mockMetrics: TemplateMetricsResponse = {
    stable: {
      template_id: testCase.templateA.id,
      executions: testCase.templateA.successes + testCase.templateA.failures,
      success_rate: testCase.templateA.successes / (testCase.templateA.successes + testCase.templateA.failures),
      thompson_alpha: testCase.templateA.successes + 1,
      thompson_beta: testCase.templateA.failures + 1,
      avg_cost: 0.01,
      avg_duration: 1000,
    },
    candidates: [
      {
        template_id: testCase.templateB.id,
        executions: testCase.templateB.successes + testCase.templateB.failures,
        success_rate: testCase.templateB.successes / (testCase.templateB.successes + testCase.templateB.failures),
        thompson_alpha: testCase.templateB.successes + 1,
        thompson_beta: testCase.templateB.failures + 1,
        avg_cost: 0.01,
        avg_duration: 1000,
      },
    ],
  }

  setMockMetrics(mockMetrics)

  // Run selections
  const selections: string[] = []
  const metadata: Array<{ alpha: number; beta: number; sample: number }> = []

  for (let i = 0; i < testCase.iterations; i++) {
    try {
      const result = await selectFn(testCase.templateA.id)
      selections.push(result.selectedId)

      if (result.thompsonSampling) {
        metadata.push({
          alpha: result.thompsonSampling.alpha,
          beta: result.thompsonSampling.beta,
          sample: result.thompsonSampling.sample,
        })
      }
    } catch (error) {
      // Selection failed - this is acceptable for testing fallback behavior
      console.warn(`Selection ${i} failed:`, error)
    }
  }

  clearMockMetrics()

  // Calculate actual selection rates
  const aSelections = selections.filter((id) => id === testCase.templateA.id).length
  const bSelections = selections.filter((id) => id === testCase.templateB.id).length
  const aRate = aSelections / testCase.iterations
  const bRate = bSelections / testCase.iterations

  // Validate rates are within expected ranges
  const aInRange =
    aRate >= testCase.templateA.expectedSelectionRate.min &&
    aRate <= testCase.templateA.expectedSelectionRate.max
  const bInRange =
    bRate >= testCase.templateB.expectedSelectionRate.min &&
    bRate <= testCase.templateB.expectedSelectionRate.max

  const pass = aInRange && bInRange && metadata.length > 0

  let message = ""
  if (!pass) {
    if (!aInRange) {
      message += `Template A selection rate ${(aRate * 100).toFixed(1)}% outside expected range [${testCase.templateA.expectedSelectionRate.min * 100}-${testCase.templateA.expectedSelectionRate.max * 100}%]. `
    }
    if (!bInRange) {
      message += `Template B selection rate ${(bRate * 100).toFixed(1)}% outside expected range [${testCase.templateB.expectedSelectionRate.min * 100}-${testCase.templateB.expectedSelectionRate.max * 100}%]. `
    }
    if (metadata.length === 0) {
      message += "No Thompson Sampling metadata recorded. "
    }
  } else {
    message = `Thompson Sampling working correctly. A: ${(aRate * 100).toFixed(1)}%, B: ${(bRate * 100).toFixed(1)}%`
  }

  return {
    pass,
    actual: {
      aSelections,
      bSelections,
      aRate,
      bRate,
      sampleMetadata: metadata,
    },
    expected: {
      aRate: testCase.templateA.expectedSelectionRate,
      bRate: testCase.templateB.expectedSelectionRate,
    },
    message,
  }
}

// Test case 3: Validate selection_reason recording
export interface SelectionReasonTestCase {
  templateId: string
  expectedFields: string[]
}

export async function validateSelectionReasonRecording(
  testCase: SelectionReasonTestCase,
  invokeActivityFn: (params: any) => Promise<{ selection_reason?: any }>
): Promise<{
  pass: boolean
  actual: { selection_reason: any; hasFields: string[]; missingFields: string[] }
  expected: { fields: string[] }
  message: string
}> {
  try {
    const activity = await invokeActivityFn({
      templateId: testCase.templateId,
      variables: {},
      reason: "Validation test for Thompson Sampling",
    })

    const hasFields: string[] = []
    const missingFields: string[] = []

    for (const field of testCase.expectedFields) {
      if (activity.selection_reason && field in activity.selection_reason) {
        hasFields.push(field)
      } else {
        missingFields.push(field)
      }
    }

    const pass = missingFields.length === 0

    return {
      pass,
      actual: {
        selection_reason: activity.selection_reason,
        hasFields,
        missingFields,
      },
      expected: {
        fields: testCase.expectedFields,
      },
      message: pass
        ? "selection_reason correctly recorded with all expected fields"
        : `Missing fields in selection_reason: ${missingFields.join(", ")}`,
    }
  } catch (error) {
    return {
      pass: false,
      actual: {
        selection_reason: null,
        hasFields: [],
        missingFields: testCase.expectedFields,
      },
      expected: {
        fields: testCase.expectedFields,
      },
      message: `Activity invocation failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Main validation runner
export async function runValidation(config: {
  selectFn: (templateId: string) => Promise<{ selectedId: string; thompsonSampling?: any }>
  invokeActivityFn?: (params: any) => Promise<{ selection_reason?: any }>
}): Promise<{
  pass: boolean
  results: {
    distributionTest: Awaited<ReturnType<typeof validateThompsonSamplingDistribution>>
    selectionReasonTest?: Awaited<ReturnType<typeof validateSelectionReasonRecording>>
  }
  summary: string
}> {
  // Test case 1: Thompson Sampling distribution
  const distributionTestCase: ThompsonSamplingTestCase = {
    templateA: {
      id: "hello-world-thompson-A",
      successes: 18,
      failures: 2,
      expectedSelectionRate: { min: 0.65, max: 0.85 }, // 65-85% (exploitation with some exploration)
    },
    templateB: {
      id: "hello-world-thompson-B",
      successes: 10,
      failures: 10,
      expectedSelectionRate: { min: 0.15, max: 0.35 }, // 15-35% (exploration)
    },
    iterations: 100,
  }

  const distributionTest = await validateThompsonSamplingDistribution(
    distributionTestCase,
    config.selectFn
  )

  let selectionReasonTest: Awaited<ReturnType<typeof validateSelectionReasonRecording>> | undefined

  // Test case 2: selection_reason recording (if invokeActivityFn provided)
  if (config.invokeActivityFn) {
    const selectionReasonTestCase: SelectionReasonTestCase = {
      templateId: "hello-world-thompson-A",
      expectedFields: ["method", "alpha", "beta", "sample", "selectedId"],
    }

    selectionReasonTest = await validateSelectionReasonRecording(
      selectionReasonTestCase,
      config.invokeActivityFn
    )
  }

  // Determine overall pass/fail
  const allPassed =
    distributionTest.pass && (!selectionReasonTest || selectionReasonTest.pass)

  // Generate summary
  const summary = [
    "Thompson Sampling Validation Results:",
    `- Distribution Test: ${distributionTest.pass ? "PASS" : "FAIL"} - ${distributionTest.message}`,
    selectionReasonTest
      ? `- Selection Reason Test: ${selectionReasonTest.pass ? "PASS" : "FAIL"} - ${selectionReasonTest.message}`
      : "- Selection Reason Test: SKIPPED (no invokeActivityFn provided)",
    `Overall: ${allPassed ? "PASS ✅" : "FAIL ❌"}`,
  ].join("\n")

  return {
    pass: allPassed,
    results: {
      distributionTest,
      selectionReasonTest,
    },
    summary,
  }
}

// Export test cases for impulse storage
export const testCases = {
  case1_betaSample: {
    id: "validation-thompson-sampling-template-selection-case-1",
    input: {
      alpha: 19, // 18 successes + 1
      beta: 3, // 2 failures + 1
      sampleSize: 1000,
    },
    expectedOutput: {
      meanRange: { min: 0.75, max: 0.90 }, // Beta(19,3) mean ≈ 0.86
      allInRange: true,
    },
  },
  case2_distribution: {
    id: "validation-thompson-sampling-template-selection-case-2",
    input: {
      templateA: { id: "hello-world-thompson-A", successes: 18, failures: 2 },
      templateB: { id: "hello-world-thompson-B", successes: 10, failures: 10 },
      iterations: 100,
    },
    expectedOutput: {
      aSelectionRate: { min: 0.65, max: 0.85 },
      bSelectionRate: { min: 0.15, max: 0.35 },
      hasMetadata: true,
    },
  },
  case3_selectionReason: {
    id: "validation-thompson-sampling-template-selection-case-3",
    input: {
      templateId: "hello-world-thompson-A",
      variables: {},
      reason: "Validation test",
    },
    expectedOutput: {
      hasSelectionReason: true,
      fields: ["method", "alpha", "beta", "sample", "selectedId"],
      method: "thompson_sampling",
    },
  },
}
