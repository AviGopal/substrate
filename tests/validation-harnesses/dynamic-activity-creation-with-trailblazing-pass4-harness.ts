#!/usr/bin/env bun
/**
 * Validation Harness: Dynamic Activity Creation with Trailblazing Pass 4
 * 
 * Tests meta-templates (create/evolve/debug-activity) in both K8s and host environments:
 * - Auto-enabling trailblazing for meta-templates
 * - Context injection via searchSimilarActivities
 * - Memory hook execution for context prediction
 * - SurrealDB activity tracking
 * - Filesystem independence
 * - Template registration performance
 * 
 * Usage:
 *   bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass4-harness.ts
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

interface TestCase {
  id: string
  name: string
  input: {
    environment: "kubernetes" | "host"
    template: string
    variables: Record<string, string>
    reason: string
  }
  expectedOutput: {
    logPatterns: string[]
    noErrorPatterns: string[]
    databaseChecks?: {
      table: string
      field: string
      expectedValue: string | RegExp
    }[]
    performanceThreshold?: number
  }
}

interface TestResult {
  testCaseId: string
  passed: boolean
  actualOutput: {
    logs: string
    dbRecords?: any[]
    errors: string[]
  }
  expectedOutput: any
  message: string
}

interface ValidationResult {
  passed: boolean
  totalTests: number
  passedTests: number
  failedTests: number
  results: TestResult[]
}

// Test cases
const testCases: TestCase[] = [
  {
    id: "validation-dynamic-activity-creation-with-trailblazing-pass4-case-1",
    name: "K8s: Create activity with trailblazing auto-enabled",
    input: {
      environment: "kubernetes",
      template: "create-activity-self-contained",
      variables: {
        templateName: "Pass4ValidationTest",
        templateDescription: "Test template for Pass 4 validation",
        category: "feature"
      },
      reason: "Pass 4 validation - test trailblazing auto-enable"
    },
    expectedOutput: {
      logPatterns: [
        "auto-enabling trailblazing for meta-template",
        "searchSimilarActivities using stub data",
        "injecting similar activity context",
        "executing task with trailblazing enabled"
      ],
      noErrorPatterns: [
        "file not found",
        "ENOENT",
        "/tmp",
        "filesystem error",
        "MCP registration timeout"
      ],
      databaseChecks: [
        {
          table: "activity_executions",
          field: "template_id",
          expectedValue: "create-activity-self-contained"
        }
      ],
      performanceThreshold: 30000 // 30s for registration
    }
  },
  {
    id: "validation-dynamic-activity-creation-with-trailblazing-pass4-case-2",
    name: "Host: Create activity without filesystem dependencies",
    input: {
      environment: "host",
      template: "create-activity-self-contained",
      variables: {
        templateName: "HostTestTemplate",
        templateDescription: "Test from host environment",
        category: "tool"
      },
      reason: "Pass 4 validation - test host environment execution"
    },
    expectedOutput: {
      logPatterns: [
        "auto-enabling trailblazing for meta-template",
        "searchSimilarActivities using stub data",
        "similar activity context injected"
      ],
      noErrorPatterns: [
        "file not found",
        "ENOENT",
        "required_files validation failed",
        "filesystem error"
      ]
    }
  },
  {
    id: "validation-dynamic-activity-creation-with-trailblazing-pass4-case-3",
    name: "K8s: Context injection provides sample activities",
    input: {
      environment: "kubernetes",
      template: "create-activity-self-contained",
      variables: {
        templateName: "ContextInjectionTest",
        templateDescription: "Test context injection",
        category: "infrastructure"
      },
      reason: "Pass 4 validation - verify context injection"
    },
    expectedOutput: {
      logPatterns: [
        "searchSimilarActivities using stub data",
        "sample-exec-create-activity-self-contained-1",
        "Task decomposition worked well",
        "injecting similar activity context"
      ],
      noErrorPatterns: [
        "searchSimilarActivities not yet implemented",
        "context injection failed"
      ]
    }
  },
  {
    id: "validation-dynamic-activity-creation-with-trailblazing-pass4-case-4",
    name: "K8s: Memory hook execution",
    input: {
      environment: "kubernetes",
      template: "create-activity-self-contained",
      variables: {
        templateName: "MemoryHookTest",
        templateDescription: "Test memory hook",
        category: "feature"
      },
      reason: "Pass 4 validation - verify memory management hook"
    },
    expectedOutput: {
      logPatterns: [
        "memory management hook",
        "manage-session-memory"
      ],
      noErrorPatterns: [
        "hook execution failed",
        "memory management error"
      ]
    }
  },
  {
    id: "validation-dynamic-activity-creation-with-trailblazing-pass4-case-5",
    name: "K8s: SurrealDB activity tracking",
    input: {
      environment: "kubernetes",
      template: "create-activity-self-contained",
      variables: {
        templateName: "DatabaseTrackingTest",
        templateDescription: "Test database tracking",
        category: "bugfix"
      },
      reason: "Pass 4 validation - verify SurrealDB tracking"
    },
    expectedOutput: {
      logPatterns: [
        "storing activity content to backend",
        "recording task start to backend"
      ],
      noErrorPatterns: [
        "failed to store activity content",
        "backend returned 500"
      ],
      databaseChecks: [
        {
          table: "activity_executions",
          field: "status",
          expectedValue: /completed|in_progress/
        }
      ]
    }
  }
]

/**
 * Get devbob pod name in kubernetes
 */
function getDevbobPodName(): string | null {
  try {
    const output = execSync(
      "kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}'",
      { encoding: "utf-8" }
    )
    return output.trim() || null
  } catch (error) {
    console.error("Failed to get devbob pod name:", error)
    return null
  }
}

/**
 * Execute command in kubernetes devbob pod
 */
function execInK8s(command: string): { stdout: string; stderr: string } {
  const podName = getDevbobPodName()
  if (!podName) {
    throw new Error("Devbob pod not found in kubernetes cluster")
  }

  try {
    const stdout = execSync(
      `kubectl exec -n metabob ${podName} -- bash -c "${command}"`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    )
    return { stdout, stderr: "" }
  } catch (error: any) {
    return { stdout: error.stdout || "", stderr: error.stderr || error.message }
  }
}

/**
 * Get logs from kubernetes devbob pod
 */
function getK8sLogs(tailLines: number = 500): string {
  const podName = getDevbobPodName()
  if (!podName) {
    throw new Error("Devbob pod not found")
  }

  try {
    return execSync(
      `kubectl logs -n metabob ${podName} --tail=${tailLines}`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    )
  } catch (error: any) {
    console.error("Failed to get logs:", error)
    return ""
  }
}

/**
 * Query SurrealDB via kubectl exec
 */
function querySurrealDB(query: string): any[] {
  try {
    const podName = execSync(
      "kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].metadata.name}'",
      { encoding: "utf-8" }
    ).trim()

    if (!podName) {
      console.warn("SurrealDB pod not found")
      return []
    }

    const result = execSync(
      `kubectl exec -n metabob ${podName} -- surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db metabob "${query}"`,
      { encoding: "utf-8" }
    )

    // Parse SurrealDB JSON output
    try {
      return JSON.parse(result)
    } catch {
      console.warn("Failed to parse SurrealDB output")
      return []
    }
  } catch (error) {
    console.error("Failed to query SurrealDB:", error)
    return []
  }
}

/**
 * Execute activity template in host environment
 */
function execInHost(template: string, variables: Record<string, string>, reason: string): { stdout: string; stderr: string } {
  const variablesJson = JSON.stringify(variables).replace(/"/g, '\\"')
  const command = `cd repos/metabob-opencode && bun run packages/opencode/src/cli/index.ts activity ${template} --variables "${variablesJson}" --reason "${reason}"`

  try {
    const stdout = execSync(command, { 
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      cwd: "/home/avi/documents/work/exp-repo/metabob-devbob"
    })
    return { stdout, stderr: "" }
  } catch (error: any) {
    return { stdout: error.stdout || "", stderr: error.stderr || error.message }
  }
}

/**
 * Run a single test case
 */
async function runTestCase(testCase: TestCase): Promise<TestResult> {
  console.log(`\n▶ Running: ${testCase.name}`)
  console.log(`  Environment: ${testCase.input.environment}`)
  console.log(`  Template: ${testCase.input.template}`)

  let logs = ""
  let dbRecords: any[] = []
  const errors: string[] = []

  try {
    // Execute activity based on environment
    if (testCase.input.environment === "kubernetes") {
      // Execute in K8s devbob pod
      // Escape for bash -c: need to escape both " and $
      const variablesJson = JSON.stringify(testCase.input.variables).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')
      const escapedReason = testCase.input.reason.replace(/"/g, '\\"')
      const command = `opencode activity ${testCase.input.template} --variables "${variablesJson}" --reason "${escapedReason}"`
      
      console.log(`  Executing in K8s: ${command}`)
      const result = execInK8s(command)
      
      // Wait a moment for logs to flush
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Get logs
      logs = getK8sLogs(1000)
      
      if (result.stderr) {
        errors.push(`Execution stderr: ${result.stderr}`)
      }

      // Query database if checks specified
      if (testCase.expectedOutput.databaseChecks) {
        for (const check of testCase.expectedOutput.databaseChecks) {
          const query = `SELECT * FROM ${check.table} WHERE ${check.field} = '${check.expectedValue}' ORDER BY created_at DESC LIMIT 5;`
          dbRecords = querySurrealDB(query)
        }
      }
    } else {
      // Execute in host environment
      console.log(`  Executing in host`)
      const result = execInHost(
        testCase.input.template,
        testCase.input.variables,
        testCase.input.reason
      )
      
      logs = result.stdout + result.stderr
      
      if (result.stderr && !result.stderr.includes("warn")) {
        errors.push(`Execution stderr: ${result.stderr}`)
      }
    }

    // Validate log patterns
    const missingPatterns = testCase.expectedOutput.logPatterns.filter(
      pattern => !logs.includes(pattern)
    )

    if (missingPatterns.length > 0) {
      errors.push(`Missing expected log patterns: ${missingPatterns.join(", ")}`)
    }

    // Check for forbidden patterns
    const foundErrorPatterns = testCase.expectedOutput.noErrorPatterns.filter(
      pattern => logs.toLowerCase().includes(pattern.toLowerCase())
    )

    if (foundErrorPatterns.length > 0) {
      errors.push(`Found forbidden patterns: ${foundErrorPatterns.join(", ")}`)
    }

    // Validate database checks
    if (testCase.expectedOutput.databaseChecks && dbRecords.length === 0) {
      errors.push("No database records found")
    }

    const passed = errors.length === 0

    return {
      testCaseId: testCase.id,
      passed,
      actualOutput: { logs, dbRecords, errors },
      expectedOutput: testCase.expectedOutput,
      message: passed ? "✓ PASS" : `✗ FAIL: ${errors.join("; ")}`
    }
  } catch (error: any) {
    return {
      testCaseId: testCase.id,
      passed: false,
      actualOutput: { logs, dbRecords, errors: [error.message] },
      expectedOutput: testCase.expectedOutput,
      message: `✗ FAIL: ${error.message}`
    }
  }
}

/**
 * Run all validation tests
 */
export async function runValidation(): Promise<ValidationResult> {
  console.log("=" .repeat(80))
  console.log("VALIDATION HARNESS: dynamic-activity-creation-with-trailblazing-pass4")
  console.log("=" .repeat(80))

  // Check if K8s is accessible
  const podName = getDevbobPodName()
  if (!podName) {
    console.warn("\n⚠ Warning: Devbob pod not found in K8s. Skipping K8s tests.")
  }

  const results: TestResult[] = []

  for (const testCase of testCases) {
    // Skip K8s tests if pod not available
    if (testCase.input.environment === "kubernetes" && !podName) {
      console.log(`\n⊘ Skipping: ${testCase.name} (K8s not available)`)
      continue
    }

    const result = await runTestCase(testCase)
    results.push(result)
    console.log(`  ${result.message}`)
  }

  const passedTests = results.filter(r => r.passed).length
  const failedTests = results.filter(r => !r.passed).length
  const totalTests = results.length

  console.log("\n" + "=" .repeat(80))
  console.log(`RESULTS: ${passedTests}/${totalTests} tests passed`)
  console.log("=" .repeat(80))

  return {
    passed: failedTests === 0,
    totalTests,
    passedTests,
    failedTests,
    results
  }
}

// Run if executed directly
if (import.meta.main) {
  runValidation().then(result => {
    if (!result.passed) {
      console.error("\n❌ Validation FAILED")
      process.exit(1)
    } else {
      console.log("\n✅ Validation PASSED")
      process.exit(0)
    }
  }).catch(error => {
    console.error("\n💥 Validation ERROR:", error)
    process.exit(1)
  })
}
