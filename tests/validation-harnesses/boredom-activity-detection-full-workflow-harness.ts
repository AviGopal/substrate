/**
 * Comprehensive Validation Harness: Boredom Activity Detection Full Workflow
 * 
 * Tests the complete boredom activity detection and improvement workflow:
 * 1. Simulate struggling templates with low gradients/failure patterns
 * 2. Call boredom recommendation API and verify correct ranking
 * 3. Execute template improvement activities (improve-template, debug-failures, optimize-performance)
 * 4. Track metrics before/after to verify improvements
 * 5. Verify impulse usage increases and prompt sizes decrease
 * 
 * This harness validates the entire system from detection → recommendation → improvement → validation.
 */

import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

export interface ValidationResult {
  pass: boolean
  testCase: string
  actual: any
  expected: any
  errors?: string[]
  metrics?: {
    beforeImprovement: TemplateMetrics
    afterImprovement: TemplateMetrics
    improvement: MetricsDelta
  }
}

export interface TemplateMetrics {
  successRate: number
  improvementGradient: number
  avgCost: number
  avgDurationMs: number
  executionCount: number
  failurePatterns?: FailurePattern[]
  impulseUsageCount?: number
  avgPromptTokens?: number
}

export interface MetricsDelta {
  successRateDelta: number
  gradientDelta: number
  costReduction: number
  durationReduction: number
  impulseUsageIncrease: number
  promptTokenReduction: number
}

export interface FailurePattern {
  errorType: string
  frequency: number
  taskId: string
  message: string
}

export interface TestCase {
  id: string
  name: string
  input: {
    templateId: string
    mockMetrics: TemplateMetrics
    improvementType: "improve-template" | "debug-failures" | "optimize-performance"
  }
  expectedOutput: {
    metricsImproved: boolean
    gradientIncreased: boolean
    successRateIncreased: boolean
    costReduced: boolean
    impulseUsageIncreased: boolean
    promptSizeDecreased: boolean
    minGradientIncrease: number
    minSuccessRateIncrease: number
  }
}

/**
 * Seed test database with struggling template metrics
 */
export async function seedStrugglingTemplate(
  templateId: string,
  metrics: TemplateMetrics
): Promise<void> {
  const seedData = {
    template_id: templateId,
    success_rate: metrics.successRate,
    improvement_gradient: metrics.improvementGradient,
    avg_cost: metrics.avgCost,
    avg_duration_ms: metrics.avgDurationMs,
    execution_count: metrics.executionCount,
    failure_patterns: JSON.stringify(metrics.failurePatterns || []),
    performance_trends: JSON.stringify({
      costTrend: "increasing",
      durationTrend: "stable",
      successRateTrend: "degrading",
    }),
    last_execution: JSON.stringify({
      timestamp: new Date().toISOString(),
      success: false,
      duration: metrics.avgDurationMs,
      cost: metrics.avgCost,
    }),
  }

  // Call backend API to seed data
  const response = await fetch("http://localhost:8000/api/v1/learning-loop/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seedData),
  })

  if (!response.ok) {
    throw new Error(`Failed to seed template: ${response.statusText}`)
  }
}

/**
 * Call boredom recommendation API
 */
export async function fetchBoredomRecommendations(
  threshold: number = 0.7
): Promise<any[]> {
  const response = await fetch(
    `http://localhost:8000/api/v1/learning-loop/boredom-activities?threshold=${threshold}&limit=10`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch boredom activities: ${response.statusText}`)
  }

  const data = await response.json()
  return data.activities || []
}

/**
 * Execute improvement activity template
 */
export async function executeImprovementActivity(
  templateId: string,
  improvementType: string,
  metrics: TemplateMetrics
): Promise<{success: boolean; outputs: Record<string, any>}> {
  // Prepare variables for improvement template
  const variables = {
    template_id: templateId,
    success_rate: metrics.successRate,
    avg_cost: metrics.avgCost,
    avg_duration_ms: metrics.avgDurationMs,
    execution_count: metrics.executionCount,
    improvement_gradient: metrics.improvementGradient,
    failure_patterns: JSON.stringify(metrics.failurePatterns || []),
    performance_trends: JSON.stringify({
      costTrend: "increasing",
      durationTrend: "stable",
      successRateTrend: "degrading",
    }),
    last_execution: JSON.stringify({
      timestamp: new Date().toISOString(),
      success: false,
      duration: metrics.avgDurationMs,
      cost: metrics.avgCost,
    }),
  }

  // Execute activity via CLI (simulate what BoredomManager does)
  try {
    const result = execSync(
      `npx tsx -e "
        import { Activity } from './repos/metabob-opencode/packages/opencode/src/tool/activity.js'
        const result = await Activity.execute({
          templateId: '${improvementType}',
          variables: ${JSON.stringify(variables)},
          isBoredom: true,
          branch: 'boredom-activity',
          initiatedBy: 'boredom-auto'
        })
        console.log(JSON.stringify(result))
      "`,
      { encoding: "utf-8", cwd: process.cwd() }
    )

    const output = JSON.parse(result)
    return { success: output.success, outputs: output.taskOutputs || {} }
  } catch (error) {
    console.error(`Activity execution failed: ${error}`)
    return { success: false, outputs: {} }
  }
}

/**
 * Get current template metrics from backend
 */
export async function getTemplateMetrics(templateId: string): Promise<TemplateMetrics | null> {
  try {
    const response = await fetch(
      `http://localhost:8000/api/v1/learning-loop/templates/${templateId}/metrics`
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      successRate: data.success_rate,
      improvementGradient: data.improvement_gradient,
      avgCost: data.avg_cost,
      avgDurationMs: data.avg_duration_ms,
      executionCount: data.execution_count,
      failurePatterns: data.failure_patterns ? JSON.parse(data.failure_patterns) : [],
      impulseUsageCount: data.impulse_usage_count || 0,
      avgPromptTokens: data.avg_prompt_tokens || 0,
    }
  } catch (error) {
    console.error(`Failed to get metrics: ${error}`)
    return null
  }
}

/**
 * Calculate metrics delta
 */
export function calculateMetricsDelta(
  before: TemplateMetrics,
  after: TemplateMetrics
): MetricsDelta {
  return {
    successRateDelta: after.successRate - before.successRate,
    gradientDelta: after.improvementGradient - before.improvementGradient,
    costReduction: ((before.avgCost - after.avgCost) / before.avgCost) * 100,
    durationReduction: ((before.avgDurationMs - after.avgDurationMs) / before.avgDurationMs) * 100,
    impulseUsageIncrease: (after.impulseUsageCount || 0) - (before.impulseUsageCount || 0),
    promptTokenReduction:
      ((before.avgPromptTokens || 0) - (after.avgPromptTokens || 0)) /
      (before.avgPromptTokens || 1) *
      100,
  }
}

/**
 * Verify improvement expectations
 */
export function verifyImprovement(
  delta: MetricsDelta,
  expected: TestCase["expectedOutput"]
): { pass: boolean; errors: string[] } {
  const errors: string[] = []

  if (expected.gradientIncreased && delta.gradientDelta < expected.minGradientIncrease) {
    errors.push(
      `Gradient did not increase enough: expected +${expected.minGradientIncrease}, got +${delta.gradientDelta.toFixed(3)}`
    )
  }

  if (expected.successRateIncreased && delta.successRateDelta < expected.minSuccessRateIncrease) {
    errors.push(
      `Success rate did not increase enough: expected +${expected.minSuccessRateIncrease}, got +${delta.successRateDelta.toFixed(3)}`
    )
  }

  if (expected.costReduced && delta.costReduction < 10) {
    errors.push(`Cost did not reduce enough: expected >10%, got ${delta.costReduction.toFixed(1)}%`)
  }

  if (expected.impulseUsageIncreased && delta.impulseUsageIncrease <= 0) {
    errors.push(`Impulse usage did not increase: got ${delta.impulseUsageIncrease}`)
  }

  if (expected.promptSizeDecreased && delta.promptTokenReduction <= 0) {
    errors.push(
      `Prompt token count did not decrease: got ${delta.promptTokenReduction.toFixed(1)}%`
    )
  }

  return { pass: errors.length === 0, errors }
}

/**
 * Run validation for a single test case
 */
export async function runValidation(testCase: TestCase): Promise<ValidationResult> {
  const errors: string[] = []

  try {
    console.log(`\n📋 Running test case: ${testCase.name}`)

    // Step 1: Seed struggling template
    console.log(`  1️⃣ Seeding template: ${testCase.input.templateId}`)
    await seedStrugglingTemplate(testCase.input.templateId, testCase.input.mockMetrics)

    // Step 2: Verify template appears in recommendations
    console.log(`  2️⃣ Fetching boredom recommendations`)
    const recommendations = await fetchBoredomRecommendations(0.7)
    const found = recommendations.find((r: any) => r.template_id === testCase.input.templateId)

    if (!found) {
      errors.push(`Template ${testCase.input.templateId} not found in recommendations`)
    } else {
      console.log(`  ✅ Template found in recommendations (priority: ${found.priority})`)
    }

    // Step 3: Get baseline metrics
    console.log(`  3️⃣ Capturing baseline metrics`)
    const beforeMetrics = await getTemplateMetrics(testCase.input.templateId)
    if (!beforeMetrics) {
      errors.push(`Failed to get baseline metrics for ${testCase.input.templateId}`)
      return {
        pass: false,
        testCase: testCase.name,
        actual: null,
        expected: testCase.expectedOutput,
        errors,
      }
    }

    // Step 4: Execute improvement activity
    console.log(`  4️⃣ Executing improvement activity: ${testCase.input.improvementType}`)
    const activityResult = await executeImprovementActivity(
      testCase.input.templateId,
      testCase.input.improvementType,
      testCase.input.mockMetrics
    )

    if (!activityResult.success) {
      errors.push(`Improvement activity failed to execute`)
    }

    // Step 5: Get updated metrics
    console.log(`  5️⃣ Capturing updated metrics`)
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait for backend to process
    const afterMetrics = await getTemplateMetrics(testCase.input.templateId)
    if (!afterMetrics) {
      errors.push(`Failed to get updated metrics for ${testCase.input.templateId}`)
      return {
        pass: false,
        testCase: testCase.name,
        actual: null,
        expected: testCase.expectedOutput,
        errors,
      }
    }

    // Step 6: Calculate improvement delta
    console.log(`  6️⃣ Calculating metrics delta`)
    const delta = calculateMetricsDelta(beforeMetrics, afterMetrics)

    console.log(`  📊 Metrics Delta:`)
    console.log(`     Success Rate: ${(delta.successRateDelta * 100).toFixed(1)}%`)
    console.log(`     Gradient: ${(delta.gradientDelta * 100).toFixed(1)}%`)
    console.log(`     Cost Reduction: ${delta.costReduction.toFixed(1)}%`)
    console.log(`     Impulse Usage: +${delta.impulseUsageIncrease}`)
    console.log(`     Prompt Tokens: ${delta.promptTokenReduction.toFixed(1)}%`)

    // Step 7: Verify improvements
    console.log(`  7️⃣ Verifying improvement expectations`)
    const verification = verifyImprovement(delta, testCase.expectedOutput)
    if (!verification.pass) {
      errors.push(...verification.errors)
    }

    const actual = {
      metricsImproved: delta.gradientDelta > 0 || delta.successRateDelta > 0,
      gradientIncreased: delta.gradientDelta > 0,
      successRateIncreased: delta.successRateDelta > 0,
      costReduced: delta.costReduction > 0,
      impulseUsageIncreased: delta.impulseUsageIncrease > 0,
      promptSizeDecreased: delta.promptTokenReduction > 0,
      delta,
    }

    return {
      pass: errors.length === 0,
      testCase: testCase.name,
      actual,
      expected: testCase.expectedOutput,
      errors: errors.length > 0 ? errors : undefined,
      metrics: {
        beforeImprovement: beforeMetrics,
        afterImprovement: afterMetrics,
        improvement: delta,
      },
    }
  } catch (error) {
    return {
      pass: false,
      testCase: testCase.name,
      actual: null,
      expected: testCase.expectedOutput,
      errors: [`Execution error: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

/**
 * Run all validation test cases
 */
export async function runAllValidations(testCases: TestCase[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []

  for (const testCase of testCases) {
    const result = await runValidation(testCase)
    results.push(result)
  }

  return results
}

/**
 * Generate validation report
 */
export function generateReport(results: ValidationResult[]): string {
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  const total = results.length

  let report = `# Boredom Activity Detection Full Workflow - Validation Report\n\n`
  report += `**Total Tests**: ${total}\n`
  report += `**Passed**: ${passed} ✅\n`
  report += `**Failed**: ${failed} ❌\n`
  report += `**Success Rate**: ${((passed / total) * 100).toFixed(1)}%\n\n`

  report += `---\n\n`

  results.forEach((result, idx) => {
    const status = result.pass ? "✅ PASS" : "❌ FAIL"
    report += `## Test ${idx + 1}: ${result.testCase} ${status}\n\n`

    if (!result.pass && result.errors) {
      report += `**Errors**:\n`
      result.errors.forEach((err) => {
        report += `- ${err}\n`
      })
      report += `\n`
    }

    if (result.metrics) {
      report += `### Metrics Comparison\n\n`
      report += `| Metric | Before | After | Delta |\n`
      report += `|--------|--------|-------|-------|\n`
      report += `| Success Rate | ${(result.metrics.beforeImprovement.successRate * 100).toFixed(1)}% | ${(result.metrics.afterImprovement.successRate * 100).toFixed(1)}% | ${result.metrics.improvement.successRateDelta > 0 ? "+" : ""}${(result.metrics.improvement.successRateDelta * 100).toFixed(1)}% |\n`
      report += `| Improvement Gradient | ${result.metrics.beforeImprovement.improvementGradient.toFixed(3)} | ${result.metrics.afterImprovement.improvementGradient.toFixed(3)} | ${result.metrics.improvement.gradientDelta > 0 ? "+" : ""}${result.metrics.improvement.gradientDelta.toFixed(3)} |\n`
      report += `| Avg Cost | $${result.metrics.beforeImprovement.avgCost.toFixed(3)} | $${result.metrics.afterImprovement.avgCost.toFixed(3)} | ${result.metrics.improvement.costReduction.toFixed(1)}% |\n`
      report += `| Impulse Usage | ${result.metrics.beforeImprovement.impulseUsageCount || 0} | ${result.metrics.afterImprovement.impulseUsageCount || 0} | ${result.metrics.improvement.impulseUsageIncrease > 0 ? "+" : ""}${result.metrics.improvement.impulseUsageIncrease} |\n`
      report += `| Prompt Tokens | ${result.metrics.beforeImprovement.avgPromptTokens || 0} | ${result.metrics.afterImprovement.avgPromptTokens || 0} | ${result.metrics.improvement.promptTokenReduction.toFixed(1)}% |\n\n`
    }

    report += `---\n\n`
  })

  return report
}

/**
 * Load test cases from files or use inline defaults
 */
export function loadTestCases(): TestCase[] {
  const testCasesPath = path.join(__dirname, "../../test-boredom-templates")
  const testCases: TestCase[] = []

  // Try to load from test-boredom-templates directory
  if (fs.existsSync(testCasesPath)) {
    const files = fs.readdirSync(testCasesPath)
    files.forEach((file) => {
      if (file.startsWith("test-") && file.endsWith(".json")) {
        const content = fs.readFileSync(path.join(testCasesPath, file), "utf-8")
        const templateData = JSON.parse(content)

        // Convert template data to test case format
        testCases.push({
          id: `validation-boredom-full-workflow-${file.replace(".json", "")}`,
          name: templateData.name || file,
          input: {
            templateId: templateData.id,
            mockMetrics: templateData.mockMetrics,
            improvementType: templateData.improvementType,
          },
          expectedOutput: templateData.expectedOutput,
        })
      }
    })
  }

  // If no files found, use inline test cases
  if (testCases.length === 0) {
    testCases.push(...getInlineTestCases())
  }

  return testCases
}

/**
 * Inline test cases (fallback)
 */
function getInlineTestCases(): TestCase[] {
  return [
    {
      id: "validation-boredom-full-workflow-case-1",
      name: "Improve Template with Low Success Rate",
      input: {
        templateId: "test-improve-template-struggling",
        mockMetrics: {
          successRate: 0.45,
          improvementGradient: 0.45,
          avgCost: 0.05,
          avgDurationMs: 60000,
          executionCount: 10,
          failurePatterns: [
            { errorType: "validation_failed", frequency: 5, taskId: "task-1", message: "Missing file" },
          ],
          impulseUsageCount: 0,
          avgPromptTokens: 8000,
        },
        improvementType: "improve-template",
      },
      expectedOutput: {
        metricsImproved: true,
        gradientIncreased: true,
        successRateIncreased: true,
        costReduced: true,
        impulseUsageIncreased: true,
        promptSizeDecreased: true,
        minGradientIncrease: 0.1,
        minSuccessRateIncrease: 0.15,
      },
    },
    {
      id: "validation-boredom-full-workflow-case-2",
      name: "Debug Failures with Increasing Error Rate",
      input: {
        templateId: "test-debug-failures-low-gradient",
        mockMetrics: {
          successRate: 0.3,
          improvementGradient: 0.3,
          avgCost: 0.04,
          avgDurationMs: 50000,
          executionCount: 10,
          failurePatterns: [
            { errorType: "validation_failed", frequency: 7, taskId: "task-1", message: "Over-constrained" },
          ],
          impulseUsageCount: 0,
          avgPromptTokens: 7000,
        },
        improvementType: "debug-failures",
      },
      expectedOutput: {
        metricsImproved: true,
        gradientIncreased: true,
        successRateIncreased: true,
        costReduced: false,
        impulseUsageIncreased: false,
        promptSizeDecreased: false,
        minGradientIncrease: 0.2,
        minSuccessRateIncrease: 0.3,
      },
    },
    {
      id: "validation-boredom-full-workflow-case-3",
      name: "Optimize Performance with Degrading Trends",
      input: {
        templateId: "test-optimize-performance-mediocre",
        mockMetrics: {
          successRate: 0.7,
          improvementGradient: 0.7,
          avgCost: 0.08,
          avgDurationMs: 90000,
          executionCount: 10,
          failurePatterns: [],
          impulseUsageCount: 0,
          avgPromptTokens: 12000,
        },
        improvementType: "optimize-performance",
      },
      expectedOutput: {
        metricsImproved: true,
        gradientIncreased: true,
        successRateIncreased: false,
        costReduced: true,
        impulseUsageIncreased: true,
        promptSizeDecreased: true,
        minGradientIncrease: 0.05,
        minSuccessRateIncrease: 0,
      },
    },
  ]
}

/**
 * Main entry point
 */
export async function main() {
  console.log("🔍 Running Boredom Activity Detection Full Workflow Validation Harness\n")

  const testCases = loadTestCases()
  console.log(`Loaded ${testCases.length} test cases\n`)

  const results = await runAllValidations(testCases)
  const report = generateReport(results)

  // Write report to file
  const reportPath = path.join(__dirname, "../../validation-report-boredom-full-workflow.md")
  fs.writeFileSync(reportPath, report)

  console.log(report)
  console.log(`\n📄 Report saved to: ${reportPath}`)

  // Exit with error code if any tests failed
  const failed = results.filter((r) => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Validation harness failed:", error)
    process.exit(1)
  })
}
