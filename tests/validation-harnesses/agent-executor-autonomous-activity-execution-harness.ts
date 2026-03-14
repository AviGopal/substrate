/**
 * Validation Harness: Agent-Executor Autonomous Activity Execution
 * 
 * Tests the try-create-retry pattern with goal-seeking fallback.
 * Validates that the system can autonomously create missing templates and retry execution.
 * 
 * Test Strategy:
 * 1. Attempt to select a non-existent template with enableAutonomousRecovery: true
 * 2. Verify GoalInferenceEngine infers correct goal
 * 3. Verify CreateActivityGoalSeekingTool creates template
 * 4. Verify retry succeeds with newly created template
 * 5. Verify second attempt uses cached template (fast path)
 * 
 * Expected Results:
 * - First execution: ~5-10s (goal inference + template creation + retry)
 * - Second execution: ~50ms (cached template, no autonomous recovery)
 * - Template registered to backend
 * - All phases complete successfully
 */

import { TemplateSelector } from "../../repos/metabob-opencode/packages/opencode/src/session/template-selector"
import { TemplateRepository } from "../../repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"
import { GoalInferenceEngine } from "../../repos/metabob-opencode/packages/opencode/src/session/goal-inference-engine"

export interface ValidationResult {
  pass: boolean
  actual: any
  expected: any
  errors: string[]
  metrics: {
    firstExecutionDuration: number
    secondExecutionDuration: number
    goalInferenceSuccess: boolean
    templateCreationSuccess: boolean
    retrySuccess: boolean
    cacheHitSuccess: boolean
  }
}

export interface TestCase {
  name: string
  input: {
    templateId: string
    reason: string
    variables: Record<string, unknown>
    enableAutonomousRecovery: boolean
  }
  expected: {
    goalCategory: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
    templateCreated: boolean
    retrySucceeds: boolean
    cacheHitOnSecondAttempt: boolean
    firstExecutionMaxDuration: number // milliseconds
    secondExecutionMaxDuration: number // milliseconds
  }
}

/**
 * Run validation for a single test case
 */
export async function runValidation(testCase: TestCase): Promise<ValidationResult> {
  const errors: string[] = []
  const metrics = {
    firstExecutionDuration: 0,
    secondExecutionDuration: 0,
    goalInferenceSuccess: false,
    templateCreationSuccess: false,
    retrySuccess: false,
    cacheHitSuccess: false,
  }

  try {
    console.log(`\n=== Test Case: ${testCase.name} ===`)
    console.log(`Input: ${JSON.stringify(testCase.input, null, 2)}`)

    // Phase 1: First execution (should trigger autonomous recovery)
    console.log("\n[Phase 1] First execution - autonomous recovery")
    const startTime1 = Date.now()
    
    let firstResult: any
    try {
      firstResult = await TemplateSelector.select(
        testCase.input.templateId,
        "all",
        {
          reason: testCase.input.reason,
          variables: testCase.input.variables,
          enableAutonomousRecovery: testCase.input.enableAutonomousRecovery,
        }
      )
      metrics.firstExecutionDuration = Date.now() - startTime1
      metrics.retrySuccess = true
      
      console.log(`✅ First execution succeeded in ${metrics.firstExecutionDuration}ms`)
      console.log(`Selected template: ${firstResult.selectedId}`)
    } catch (error) {
      metrics.firstExecutionDuration = Date.now() - startTime1
      errors.push(`First execution failed: ${error instanceof Error ? error.message : String(error)}`)
      console.error(`❌ First execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Phase 2: Verify goal inference (indirect - check template was created)
    console.log("\n[Phase 2] Verify goal inference")
    if (firstResult) {
      const template = firstResult.template
      
      // Check if template category matches expected
      if (template.category === testCase.expected.goalCategory) {
        metrics.goalInferenceSuccess = true
        console.log(`✅ Goal inference succeeded (category: ${template.category})`)
      } else {
        errors.push(`Goal category mismatch: expected ${testCase.expected.goalCategory}, got ${template.category}`)
        console.error(`❌ Goal category mismatch: expected ${testCase.expected.goalCategory}, got ${template.category}`)
      }
    } else {
      errors.push("Cannot verify goal inference - first execution failed")
      console.error("❌ Cannot verify goal inference - first execution failed")
    }

    // Phase 3: Verify template was created and registered
    console.log("\n[Phase 3] Verify template creation")
    if (firstResult) {
      // Try to load the template directly from backend
      const createdTemplate = await TemplateRepository.get(firstResult.selectedId, "all")
      
      if (createdTemplate) {
        metrics.templateCreationSuccess = true
        console.log(`✅ Template created and registered: ${createdTemplate.id}`)
        console.log(`   Name: ${createdTemplate.name}`)
        console.log(`   Category: ${createdTemplate.category}`)
        console.log(`   Tasks: ${createdTemplate.tasks.length}`)
      } else {
        errors.push(`Template not found in repository: ${firstResult.selectedId}`)
        console.error(`❌ Template not found in repository: ${firstResult.selectedId}`)
      }
    } else {
      errors.push("Cannot verify template creation - first execution failed")
      console.error("❌ Cannot verify template creation - first execution failed")
    }

    // Phase 4: Second execution (should use cached template - fast path)
    console.log("\n[Phase 4] Second execution - cached template (fast path)")
    const startTime2 = Date.now()
    
    let secondResult: any
    try {
      secondResult = await TemplateSelector.select(
        testCase.input.templateId,
        "all",
        {
          reason: testCase.input.reason,
          variables: testCase.input.variables,
          enableAutonomousRecovery: testCase.input.enableAutonomousRecovery,
        }
      )
      metrics.secondExecutionDuration = Date.now() - startTime2
      metrics.cacheHitSuccess = true
      
      console.log(`✅ Second execution succeeded in ${metrics.secondExecutionDuration}ms`)
      console.log(`Selected template: ${secondResult.selectedId}`)
      
      // Verify it's the same template (cache hit)
      if (firstResult && secondResult.selectedId === firstResult.selectedId) {
        console.log(`✅ Cache hit confirmed (same template ID)`)
      } else if (firstResult) {
        errors.push(`Cache miss: different templates (${firstResult.selectedId} vs ${secondResult.selectedId})`)
        console.error(`⚠️  Cache miss: different templates (${firstResult.selectedId} vs ${secondResult.selectedId})`)
      }
    } catch (error) {
      metrics.secondExecutionDuration = Date.now() - startTime2
      errors.push(`Second execution failed: ${error instanceof Error ? error.message : String(error)}`)
      console.error(`❌ Second execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Phase 5: Verify performance expectations
    console.log("\n[Phase 5] Verify performance")
    
    if (metrics.firstExecutionDuration > testCase.expected.firstExecutionMaxDuration) {
      errors.push(
        `First execution too slow: ${metrics.firstExecutionDuration}ms > ${testCase.expected.firstExecutionMaxDuration}ms`
      )
      console.error(
        `⚠️  First execution slower than expected: ${metrics.firstExecutionDuration}ms (max: ${testCase.expected.firstExecutionMaxDuration}ms)`
      )
    } else {
      console.log(`✅ First execution within expected duration: ${metrics.firstExecutionDuration}ms`)
    }
    
    if (metrics.secondExecutionDuration > testCase.expected.secondExecutionMaxDuration) {
      errors.push(
        `Second execution too slow: ${metrics.secondExecutionDuration}ms > ${testCase.expected.secondExecutionMaxDuration}ms`
      )
      console.error(
        `⚠️  Second execution slower than expected: ${metrics.secondExecutionDuration}ms (max: ${testCase.expected.secondExecutionMaxDuration}ms)`
      )
    } else {
      console.log(`✅ Second execution within expected duration: ${metrics.secondExecutionDuration}ms`)
    }

    // Determine overall pass/fail
    const pass =
      errors.length === 0 &&
      metrics.goalInferenceSuccess &&
      metrics.templateCreationSuccess &&
      metrics.retrySuccess &&
      metrics.cacheHitSuccess

    console.log("\n=== Validation Result ===")
    console.log(`Status: ${pass ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`Errors: ${errors.length}`)
    if (errors.length > 0) {
      console.log("Error details:")
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`))
    }

    return {
      pass,
      actual: {
        firstResult,
        secondResult,
        metrics,
      },
      expected: testCase.expected,
      errors,
      metrics,
    }
  } catch (error) {
    errors.push(`Validation harness error: ${error instanceof Error ? error.message : String(error)}`)
    
    return {
      pass: false,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: testCase.expected,
      errors,
      metrics,
    }
  }
}

/**
 * Test goal inference directly (unit test)
 */
export async function testGoalInference(testCase: {
  attemptedTemplateId: string
  reason?: string
  variables?: Record<string, unknown>
  expectedCategory: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  expectedTemplateNamePattern: RegExp
}): Promise<{ pass: boolean; actual: any; expected: any; errors: string[] }> {
  const errors: string[] = []
  
  try {
    console.log(`\n=== Goal Inference Test ===`)
    console.log(`Template ID: ${testCase.attemptedTemplateId}`)
    console.log(`Reason: ${testCase.reason || "not provided"}`)
    
    const goal = await GoalInferenceEngine.infer({
      attemptedTemplateId: testCase.attemptedTemplateId,
      reason: testCase.reason,
      variables: testCase.variables,
    })
    
    console.log(`Inferred goal:`)
    console.log(`  Description: ${goal.description}`)
    console.log(`  Template Name: ${goal.templateName}`)
    console.log(`  Category: ${goal.category}`)
    
    // Validate category
    if (goal.category !== testCase.expectedCategory) {
      errors.push(`Category mismatch: expected ${testCase.expectedCategory}, got ${goal.category}`)
    }
    
    // Validate template name matches pattern
    if (!testCase.expectedTemplateNamePattern.test(goal.templateName)) {
      errors.push(
        `Template name doesn't match pattern: "${goal.templateName}" !~ ${testCase.expectedTemplateNamePattern}`
      )
    }
    
    const pass = errors.length === 0
    
    console.log(`Result: ${pass ? "✅ PASS" : "❌ FAIL"}`)
    if (errors.length > 0) {
      errors.forEach((err) => console.log(`  ❌ ${err}`))
    }
    
    return {
      pass,
      actual: goal,
      expected: {
        category: testCase.expectedCategory,
        templateNamePattern: testCase.expectedTemplateNamePattern.source,
      },
      errors,
    }
  } catch (error) {
    errors.push(`Goal inference failed: ${error instanceof Error ? error.message : String(error)}`)
    
    return {
      pass: false,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: {
        category: testCase.expectedCategory,
        templateNamePattern: testCase.expectedTemplateNamePattern.source,
      },
      errors,
    }
  }
}

/**
 * Run all validation test cases
 */
export async function runAllValidations(): Promise<{
  totalTests: number
  passed: number
  failed: number
  results: ValidationResult[]
}> {
  const testCases: TestCase[] = [
    {
      name: "Bugfix - SQL Injection",
      input: {
        templateId: "fix-sql-injection-auth",
        reason: "Fix SQL injection vulnerability in authentication module using parameterized queries",
        variables: { file: "auth.ts", vulnerability: "SQL injection" },
        enableAutonomousRecovery: true,
      },
      expected: {
        goalCategory: "bugfix",
        templateCreated: true,
        retrySucceeds: true,
        cacheHitOnSecondAttempt: true,
        firstExecutionMaxDuration: 30000, // 30s (includes LLM + goal-seeking + template creation)
        secondExecutionMaxDuration: 1000, // 1s (cached)
      },
    },
    {
      name: "Feature - User Registration",
      input: {
        templateId: "add-user-registration-feature",
        reason: "Implement user registration with email verification and validation",
        variables: { feature: "registration", includeEmailVerification: true },
        enableAutonomousRecovery: true,
      },
      expected: {
        goalCategory: "feature",
        templateCreated: true,
        retrySucceeds: true,
        cacheHitOnSecondAttempt: true,
        firstExecutionMaxDuration: 30000, // 30s
        secondExecutionMaxDuration: 1000, // 1s
      },
    },
    {
      name: "Refactor - Authentication Module",
      input: {
        templateId: "refactor-auth-module-di",
        reason: "Refactor authentication module to use dependency injection for better testability",
        variables: { module: "auth", pattern: "dependency-injection" },
        enableAutonomousRecovery: true,
      },
      expected: {
        goalCategory: "refactor",
        templateCreated: true,
        retrySucceeds: true,
        cacheHitOnSecondAttempt: true,
        firstExecutionMaxDuration: 30000, // 30s
        secondExecutionMaxDuration: 1000, // 1s
      },
    },
  ]

  const results: ValidationResult[] = []
  let passed = 0
  let failed = 0

  console.log(`\n${"=".repeat(80)}`)
  console.log("AGENT-EXECUTOR AUTONOMOUS ACTIVITY EXECUTION - VALIDATION HARNESS")
  console.log(`${"=".repeat(80)}`)

  for (const testCase of testCases) {
    const result = await runValidation(testCase)
    results.push(result)
    
    if (result.pass) {
      passed++
    } else {
      failed++
    }
  }

  console.log(`\n${"=".repeat(80)}`)
  console.log("SUMMARY")
  console.log(`${"=".repeat(80)}`)
  console.log(`Total Tests: ${testCases.length}`)
  console.log(`Passed: ${passed} ✅`)
  console.log(`Failed: ${failed} ${failed > 0 ? "❌" : ""}`)
  console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`)

  return {
    totalTests: testCases.length,
    passed,
    failed,
    results,
  }
}

// Allow running as standalone script
if (require.main === module) {
  runAllValidations()
    .then((summary) => {
      process.exit(summary.failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error("Fatal error:", error)
      process.exit(1)
    })
}
