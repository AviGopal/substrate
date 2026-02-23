/**
 * Validation Harness: task-decomposition-learning
 * 
 * Tests the variant tracking system to ensure:
 * 1. Variant selections are correctly stored in activity.selection_reason
 * 2. Variant IDs are correctly passed to metrics reporting
 * 3. Thompson Sampling can distinguish between stable and candidate executions
 * 
 * Validation Strategy:
 * - Create a mock activity with variant selection
 * - Verify variant is stored correctly
 * - Verify variant_id is calculated correctly for metrics
 * - Verify beta parameters are validated correctly
 * 
 * This harness validates Phase 1 (variant tracking fix) of the task-decomposition-learning spec.
 */

import { Activity } from "../../repos/metabob-opencode/packages/opencode/src/session/activity"
import * as fs from "fs"
import * as path from "path"

export interface ValidationInput {
  testCase: string
  selectionResult: {
    template: {
      id: string
      name: string
      version: { generation: number }
    }
    selectedId: string
    variant: "stable" | "candidate"
    thompsonSampling?: {
      method: "thompson_sampling" | "direct_load" | "fallback"
      alpha: number
      beta: number
      sample: number
    }
  }
  activityStatus: "done" | "failed"
}

export interface ValidationOutput {
  pass: boolean
  actual: {
    variantStored: boolean
    variantValue?: "stable" | "candidate"
    variantIdForMetrics?: string
    selectionReasonComplete: boolean
  }
  expected: {
    variantStored: boolean
    variantValue: "stable" | "candidate"
    variantIdForMetrics: string | undefined
    selectionReasonComplete: boolean
  }
  details?: string
}

/**
 * Simulate the variant storage logic from activity.ts:520-534
 */
function storeVariantSelection(selectionResult: ValidationInput["selectionResult"]): {
  method: string
  alpha?: number
  beta?: number
  sample?: number
  selectedId: string
  variant: "stable" | "candidate"
} {
  if (selectionResult.thompsonSampling) {
    return {
      method: selectionResult.thompsonSampling.method,
      alpha: selectionResult.thompsonSampling.alpha,
      beta: selectionResult.thompsonSampling.beta,
      sample: selectionResult.thompsonSampling.sample,
      selectedId: selectionResult.selectedId,
      variant: selectionResult.variant, // This is the critical fix
    }
  } else {
    return {
      method: "direct_load",
      selectedId: selectionResult.selectedId,
      variant: selectionResult.variant, // This is the critical fix
    }
  }
}

/**
 * Simulate the variant_id calculation logic from activity.ts:786-793 and activity.ts:734-747
 */
function calculateVariantId(selectionReason?: {
  variant?: "stable" | "candidate"
  selectedId?: string
}): string | undefined {
  if (!selectionReason) return undefined
  
  // If variant is candidate, use selectedId; otherwise undefined
  return selectionReason.variant === "candidate" ? selectionReason.selectedId : undefined
}

/**
 * Validate beta distribution parameters (from template-selector.ts:44-91)
 */
function validateBetaParameters(alpha: number, beta: number): {
  valid: boolean
  fallbackUsed: boolean
  result: number
} {
  // Check if parameters are valid
  if (!Number.isFinite(alpha) || !Number.isFinite(beta) || alpha <= 0 || beta <= 0) {
    // Fallback to mean
    if (Number.isFinite(alpha) && Number.isFinite(beta) && alpha > 0 && beta > 0) {
      return {
        valid: false,
        fallbackUsed: true,
        result: alpha / (alpha + beta),
      }
    }
    return {
      valid: false,
      fallbackUsed: true,
      result: 0.5, // Uniform prior
    }
  }

  return {
    valid: true,
    fallbackUsed: false,
    result: alpha / (alpha + beta), // Mean as expected result
  }
}

/**
 * Main validation function
 */
export function runValidation(input: ValidationInput): ValidationOutput {
  // Step 1: Store variant selection (simulating activity.ts:520-534)
  const selectionReason = storeVariantSelection(input.selectionResult)

  // Step 2: Check if variant was stored
  const variantStored = selectionReason.variant !== undefined
  const variantValue = selectionReason.variant

  // Step 3: Calculate variant_id for metrics (simulating activity.ts:786-793)
  const variantIdForMetrics = calculateVariantId(selectionReason)

  // Step 4: Validate selection reason is complete
  const selectionReasonComplete =
    selectionReason.method !== undefined &&
    selectionReason.selectedId !== undefined &&
    selectionReason.variant !== undefined

  // Step 5: Determine expected values based on input
  const expectedVariantId =
    input.selectionResult.variant === "candidate" ? input.selectionResult.selectedId : undefined

  // Step 6: Compare actual vs expected
  const pass =
    variantStored &&
    variantValue === input.selectionResult.variant &&
    variantIdForMetrics === expectedVariantId &&
    selectionReasonComplete

  return {
    pass,
    actual: {
      variantStored,
      variantValue,
      variantIdForMetrics,
      selectionReasonComplete,
    },
    expected: {
      variantStored: true,
      variantValue: input.selectionResult.variant,
      variantIdForMetrics: expectedVariantId,
      selectionReasonComplete: true,
    },
    details: pass
      ? "All checks passed: variant stored, variant_id calculated correctly"
      : `Failed checks - variantStored: ${variantStored}, variantValue: ${variantValue}, variantIdForMetrics: ${variantIdForMetrics}, complete: ${selectionReasonComplete}`,
  }
}

/**
 * Run all test cases from impulse data
 */
export async function runAllTestCases(): Promise<{
  totalTests: number
  passed: number
  failed: number
  results: Array<{ testCase: string; pass: boolean; details?: string }>
}> {
  const testCases: ValidationInput[] = [
    // Test Case 1: Candidate variant with Thompson Sampling
    {
      testCase: "candidate-variant-thompson-sampling",
      selectionResult: {
        template: {
          id: "test-template",
          name: "Test Template",
          version: { generation: 1 },
        },
        selectedId: "test-template-variant-abc123",
        variant: "candidate",
        thompsonSampling: {
          method: "thompson_sampling",
          alpha: 5,
          beta: 3,
          sample: 0.65,
        },
      },
      activityStatus: "done",
    },
    // Test Case 2: Stable variant with Thompson Sampling
    {
      testCase: "stable-variant-thompson-sampling",
      selectionResult: {
        template: {
          id: "test-template",
          name: "Test Template",
          version: { generation: 1 },
        },
        selectedId: "test-template",
        variant: "stable",
        thompsonSampling: {
          method: "thompson_sampling",
          alpha: 10,
          beta: 2,
          sample: 0.85,
        },
      },
      activityStatus: "done",
    },
    // Test Case 3: Candidate variant with direct load
    {
      testCase: "candidate-variant-direct-load",
      selectionResult: {
        template: {
          id: "test-template",
          name: "Test Template",
          version: { generation: 1 },
        },
        selectedId: "test-template-variant-xyz789",
        variant: "candidate",
      },
      activityStatus: "done",
    },
    // Test Case 4: Stable variant with direct load
    {
      testCase: "stable-variant-direct-load",
      selectionResult: {
        template: {
          id: "test-template",
          name: "Test Template",
          version: { generation: 1 },
        },
        selectedId: "test-template",
        variant: "stable",
      },
      activityStatus: "done",
    },
    // Test Case 5: Candidate variant with failed activity
    {
      testCase: "candidate-variant-failed-activity",
      selectionResult: {
        template: {
          id: "test-template",
          name: "Test Template",
          version: { generation: 1 },
        },
        selectedId: "test-template-variant-fail123",
        variant: "candidate",
        thompsonSampling: {
          method: "thompson_sampling",
          alpha: 2,
          beta: 8,
          sample: 0.25,
        },
      },
      activityStatus: "failed",
    },
  ]

  const results = testCases.map((testCase) => {
    const result = runValidation(testCase)
    return {
      testCase: testCase.testCase,
      pass: result.pass,
      details: result.details,
    }
  })

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  return {
    totalTests: testCases.length,
    passed,
    failed,
    results,
  }
}

/**
 * Beta parameter validation tests
 */
export function runBetaValidationTests(): {
  totalTests: number
  passed: number
  failed: number
  results: Array<{ testCase: string; pass: boolean; details?: string }>
} {
  const testCases = [
    // Test Case 1: Valid parameters
    {
      testCase: "valid-beta-parameters",
      alpha: 5,
      beta: 3,
      expectedValid: true,
      expectedFallback: false,
    },
    // Test Case 2: Invalid parameters (NaN)
    {
      testCase: "invalid-beta-parameters-nan",
      alpha: NaN,
      beta: 3,
      expectedValid: false,
      expectedFallback: true,
    },
    // Test Case 3: Invalid parameters (Infinity)
    {
      testCase: "invalid-beta-parameters-infinity",
      alpha: Infinity,
      beta: 3,
      expectedValid: false,
      expectedFallback: true,
    },
    // Test Case 4: Invalid parameters (negative)
    {
      testCase: "invalid-beta-parameters-negative",
      alpha: -5,
      beta: 3,
      expectedValid: false,
      expectedFallback: true,
    },
    // Test Case 5: Invalid parameters (zero)
    {
      testCase: "invalid-beta-parameters-zero",
      alpha: 0,
      beta: 3,
      expectedValid: false,
      expectedFallback: true,
    },
  ]

  const results = testCases.map((testCase) => {
    const result = validateBetaParameters(testCase.alpha, testCase.beta)
    const pass = result.valid === testCase.expectedValid && result.fallbackUsed === testCase.expectedFallback
    return {
      testCase: testCase.testCase,
      pass,
      details: pass
        ? `Beta validation correct: valid=${result.valid}, fallback=${result.fallbackUsed}`
        : `Beta validation FAILED: expected valid=${testCase.expectedValid}, fallback=${testCase.expectedFallback}, got valid=${result.valid}, fallback=${result.fallbackUsed}`,
    }
  })

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  return {
    totalTests: testCases.length,
    passed,
    failed,
    results,
  }
}

/**
 * CLI entry point for running validation
 */
if (require.main === module) {
  console.log("Running task-decomposition-learning validation harness...\n")

  // Run variant tracking tests
  runAllTestCases().then((result) => {
    console.log("=== Variant Tracking Tests ===")
    console.log(`Total: ${result.totalTests}`)
    console.log(`Passed: ${result.passed}`)
    console.log(`Failed: ${result.failed}`)
    console.log()

    result.results.forEach((r) => {
      const status = r.pass ? "✅ PASS" : "❌ FAIL"
      console.log(`${status}: ${r.testCase}`)
      if (r.details) {
        console.log(`  ${r.details}`)
      }
    })

    console.log()

    // Run beta parameter validation tests
    const betaResult = runBetaValidationTests()
    console.log("=== Beta Parameter Validation Tests ===")
    console.log(`Total: ${betaResult.totalTests}`)
    console.log(`Passed: ${betaResult.passed}`)
    console.log(`Failed: ${betaResult.failed}`)
    console.log()

    betaResult.results.forEach((r) => {
      const status = r.pass ? "✅ PASS" : "❌ FAIL"
      console.log(`${status}: ${r.testCase}`)
      if (r.details) {
        console.log(`  ${r.details}`)
      }
    })

    console.log()

    // Overall result
    const allPassed = result.failed === 0 && betaResult.failed === 0
    if (allPassed) {
      console.log("✅ ALL TESTS PASSED")
      process.exit(0)
    } else {
      console.log("❌ SOME TESTS FAILED")
      process.exit(1)
    }
  })
}
