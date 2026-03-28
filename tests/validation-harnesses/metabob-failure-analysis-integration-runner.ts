/**
 * Standalone Validation Runner: metabob-failure-analysis-integration
 * 
 * Runs validation without vitest dependency - pure TypeScript/Bun
 */

import * as FailureAnalysis from "../../repos/metabob-opencode/packages/opencode/src/session/activity-failure-analysis"

// Test case data structures
interface TestCase {
  id: string
  description: string
  input: {
    failureContext: FailureAnalysis.FailureContext
    mockMetabobIssues: any[]
  }
  expected: {
    rootCausePattern: RegExp
    highSeverityIssueCount: number
    suggestedFixesMin: number
    blastRadiusPattern: RegExp
    impulseStructure: {
      hasRootCause: boolean
      hasHighSeverityIssues: boolean
      hasBlastRadius: boolean
      hasSuggestedFixes: boolean
      hasRollbackStrategy: boolean
      hasPatternHash: boolean
    }
  }
}

// Mock MCP client for Metabob
class MockMetabobClient {
  public callToolHistory: Array<{ name: string; arguments: any }> = []

  constructor(private mockResponses: Map<string, any>) {}

  async callTool(request: { name: string; arguments: any }): Promise<any> {
    this.callToolHistory.push(request)
    const response = this.mockResponses.get(request.name)
    if (!response) {
      throw new Error(`No mock response for tool: ${request.name}`)
    }
    return response
  }

  getCallHistory(toolName: string): any[] {
    return this.callToolHistory.filter((call) => call.name === toolName)
  }

  reset(): void {
    this.callToolHistory = []
  }
}

// Validation results
interface ValidationResult {
  pass: boolean
  testCase: string
  details: {
    metabobSearchCalled: boolean
    highSeverityFiltered: boolean
    rootCauseGenerated: boolean
    impulseStructureCorrect: boolean
    suggestedFixesPresent: boolean
  }
  actual: any
  expected: any
  errors: string[]
}

/**
 * Test Case 1: SQL Injection Vulnerability Detected
 */
const testCase1: TestCase = {
  id: "validation-metabob-failure-analysis-integration-case-1",
  description: "Activity fails with HIGH severity SQL injection in modified file",
  input: {
    failureContext: {
      activityId: "act_test_123",
      failedTaskId: "task-1",
      failedTaskDescription: "Implement user authentication with database queries",
      errorType: "tool_error",
      errorMessage: "Syntax error in database query",
      errorStack: "Error: syntax error\n  at executeQuery (database.ts:42)",
      modifiedFiles: ["src/database.ts", "src/auth.ts"],
      validationErrors: [],
    },
    mockMetabobIssues: [
      {
        file: "src/database.ts",
        severity: "HIGH",
        category: "security",
        message: "SQL injection vulnerability: User input concatenated directly into query",
        line: 42,
        suggestion: "Use parameterized queries with prepared statements",
      },
      {
        file: "src/database.ts",
        severity: "MEDIUM",
        category: "code-quality",
        message: "Missing error handling in database query",
        line: 45,
        suggestion: "Add try-catch block around query execution",
      },
      {
        file: "src/auth.ts",
        severity: "HIGH",
        category: "security",
        message: "Password stored in plain text",
        line: 23,
        suggestion: "Use bcrypt or similar hashing library",
      },
    ],
  },
  expected: {
    rootCausePattern: /tool_error.*security issues/i,
    highSeverityIssueCount: 2,
    suggestedFixesMin: 2,
    blastRadiusPattern: /2 files.*2 high severity/i,
    impulseStructure: {
      hasRootCause: true,
      hasHighSeverityIssues: true,
      hasBlastRadius: true,
      hasSuggestedFixes: true,
      hasRollbackStrategy: true,
      hasPatternHash: true,
    },
  },
}

/**
 * Test Case 2: Validation Failure with Code Quality Issues
 */
const testCase2: TestCase = {
  id: "validation-metabob-failure-analysis-integration-case-2",
  description: "Validation fails with HIGH severity null pointer issues",
  input: {
    failureContext: {
      activityId: "act_test_456",
      failedTaskId: "task-2",
      failedTaskDescription: "Add user profile validation logic",
      errorType: "validation",
      errorMessage: "Cannot read property 'name' of undefined",
      errorStack: "TypeError: Cannot read property 'name' of undefined\n  at validateUser (validation.ts:15)",
      modifiedFiles: ["src/validation.ts"],
      validationErrors: [
        {
          file: "src/validation.ts",
          message: "Schema validation failed: missing required field 'name'",
        },
      ],
    },
    mockMetabobIssues: [
      {
        file: "src/validation.ts",
        severity: "HIGH",
        category: "null-safety",
        message: "Potential null pointer dereference: user.name accessed without null check",
        line: 15,
        suggestion: "Add null check before accessing user properties",
      },
      {
        file: "src/validation.ts",
        severity: "CRITICAL",
        category: "logic-error",
        message: "Missing validation for required fields",
        line: 12,
        suggestion: "Add schema validation before processing user object",
      },
    ],
  },
  expected: {
    rootCausePattern: /validation.*null-safety issues/i,
    highSeverityIssueCount: 2,
    suggestedFixesMin: 2,
    blastRadiusPattern: /1 files.*2 high severity/i,
    impulseStructure: {
      hasRootCause: true,
      hasHighSeverityIssues: true,
      hasBlastRadius: true,
      hasSuggestedFixes: true,
      hasRollbackStrategy: true,
      hasPatternHash: true,
    },
  },
}

/**
 * Test Case 3: No High Severity Issues
 */
const testCase3: TestCase = {
  id: "validation-metabob-failure-analysis-integration-case-3",
  description: "Activity fails but no HIGH severity issues found",
  input: {
    failureContext: {
      activityId: "act_test_789",
      failedTaskId: "task-3",
      failedTaskDescription: "Refactor utility functions",
      errorType: "timeout",
      errorMessage: "Task execution timed out after 300s",
      modifiedFiles: ["src/utils.ts"],
      validationErrors: [],
    },
    mockMetabobIssues: [
      {
        file: "src/utils.ts",
        severity: "LOW",
        category: "code-style",
        message: "Function complexity exceeds recommended threshold",
        line: 10,
        suggestion: "Consider breaking function into smaller units",
      },
      {
        file: "src/utils.ts",
        severity: "MEDIUM",
        category: "performance",
        message: "Inefficient array iteration",
        line: 25,
        suggestion: "Use Array.map() instead of forEach with push",
      },
    ],
  },
  expected: {
    rootCausePattern: /.*/,
    highSeverityIssueCount: 0,
    suggestedFixesMin: 0,
    blastRadiusPattern: /.*/,
    impulseStructure: {
      hasRootCause: false,
      hasHighSeverityIssues: false,
      hasBlastRadius: false,
      hasSuggestedFixes: false,
      hasRollbackStrategy: false,
      hasPatternHash: false,
    },
  },
}

/**
 * Run validation for a single test case
 */
async function runValidation(testCase: TestCase): Promise<ValidationResult> {
  const errors: string[] = []
  const details = {
    metabobSearchCalled: false,
    highSeverityFiltered: false,
    rootCauseGenerated: false,
    impulseStructureCorrect: false,
    suggestedFixesPresent: false,
  }

  try {
    // Setup mock MCP client
    const mockResponses = new Map<string, any>()
    mockResponses.set("metabob_search_codebase_issues", {
      content: [
        {
          type: "text",
          text: JSON.stringify(testCase.input.mockMetabobIssues),
        },
      ],
    })

    const mockClient = new MockMetabobClient(mockResponses)

    // Mock MCP.clients() to return our mock client
    const originalMCP = (global as any).MCP
    ;(global as any).MCP = {
      clients: async () => ({ metabob: mockClient }),
    }

    // Run failure analysis
    const analysis = await FailureAnalysis.analyzeFailure(testCase.input.failureContext)

    // Restore original MCP
    ;(global as any).MCP = originalMCP

    // Verify Metabob search was called
    const searchCalls = mockClient.getCallHistory("metabob_search_codebase_issues")
    details.metabobSearchCalled = searchCalls.length > 0
    if (!details.metabobSearchCalled) {
      errors.push("metabob_search_codebase_issues was not called")
    }

    // Check for null result (test case 3)
    if (testCase.expected.highSeverityIssueCount === 0) {
      if (analysis !== null) {
        errors.push(
          `Expected null analysis for no HIGH severity issues, got: ${JSON.stringify(analysis)}`,
        )
      } else {
        details.highSeverityFiltered = true
        details.rootCauseGenerated = true
        return {
          pass: errors.length === 0,
          testCase: testCase.id,
          details,
          actual: null,
          expected: null,
          errors,
        }
      }
    }

    if (!analysis) {
      errors.push("Analysis returned null unexpectedly")
      return {
        pass: false,
        testCase: testCase.id,
        details,
        actual: null,
        expected: testCase.expected,
        errors,
      }
    }

    // Verify HIGH severity filtering
    details.highSeverityFiltered = analysis.highSeverityIssues.length === testCase.expected.highSeverityIssueCount
    if (!details.highSeverityFiltered) {
      errors.push(
        `Expected ${testCase.expected.highSeverityIssueCount} HIGH severity issues, got ${analysis.highSeverityIssues.length}`,
      )
    }

    // Verify root cause generated
    details.rootCauseGenerated = testCase.expected.rootCausePattern.test(analysis.rootCause)
    if (!details.rootCauseGenerated) {
      errors.push(
        `Root cause doesn't match pattern. Expected: ${testCase.expected.rootCausePattern}, got: ${analysis.rootCause}`,
      )
    }

    // Verify suggested fixes
    details.suggestedFixesPresent = analysis.suggestedFixes.length >= testCase.expected.suggestedFixesMin
    if (!details.suggestedFixesPresent) {
      errors.push(
        `Expected at least ${testCase.expected.suggestedFixesMin} suggested fixes, got ${analysis.suggestedFixes.length}`,
      )
    }

    // Verify impulse structure
    const structureChecks = {
      hasRootCause: !!analysis.rootCause,
      hasHighSeverityIssues: analysis.highSeverityIssues.length > 0,
      hasBlastRadius: !!analysis.blastRadius && testCase.expected.blastRadiusPattern.test(analysis.blastRadius),
      hasSuggestedFixes: analysis.suggestedFixes.length > 0,
      hasRollbackStrategy: !!analysis.rollbackStrategy,
      hasPatternHash: !!analysis.patternHash && analysis.patternHash.length === 16,
    }

    details.impulseStructureCorrect =
      structureChecks.hasRootCause &&
      structureChecks.hasHighSeverityIssues &&
      structureChecks.hasBlastRadius &&
      structureChecks.hasSuggestedFixes &&
      structureChecks.hasRollbackStrategy &&
      structureChecks.hasPatternHash

    if (!details.impulseStructureCorrect) {
      const missing: string[] = []
      Object.entries(structureChecks).forEach(([key, value]) => {
        if (!value) missing.push(key)
      })
      errors.push(`Impulse structure incomplete. Missing: ${missing.join(", ")}`)
    }

    return {
      pass: errors.length === 0,
      testCase: testCase.id,
      details,
      actual: analysis,
      expected: testCase.expected,
      errors,
    }
  } catch (error) {
    errors.push(`Exception during validation: ${error instanceof Error ? error.message : String(error)}`)
    return {
      pass: false,
      testCase: testCase.id,
      details,
      actual: null,
      expected: testCase.expected,
      errors,
    }
  }
}

/**
 * Run all validation test cases
 */
async function runAllValidations(): Promise<{
  passed: number
  failed: number
  results: ValidationResult[]
}> {
  const testCases = [testCase1, testCase2, testCase3]
  const results: ValidationResult[] = []

  for (const testCase of testCases) {
    const result = await runValidation(testCase)
    results.push(result)
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  return { passed, failed, results }
}

// CLI runner
runAllValidations().then(({ passed, failed, results }) => {
  console.log("\n=== Metabob Failure Analysis Integration Validation ===\n")
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`)

  results.forEach((result) => {
    const status = result.pass ? "✅ PASS" : "❌ FAIL"
    console.log(`${status} - ${result.testCase}`)
    if (!result.pass) {
      console.log(`  Errors:`)
      result.errors.forEach((err) => console.log(`    - ${err}`))
    }
    console.log(`  Details:`)
    console.log(`    - Metabob search called: ${result.details.metabobSearchCalled}`)
    console.log(`    - HIGH severity filtered: ${result.details.highSeverityFiltered}`)
    console.log(`    - Root cause generated: ${result.details.rootCauseGenerated}`)
    console.log(`    - Impulse structure correct: ${result.details.impulseStructureCorrect}`)
    console.log(`    - Suggested fixes present: ${result.details.suggestedFixesPresent}`)
    console.log()
  })

  // Output JSON for parsing
  console.log("\n=== JSON Results ===")
  console.log(JSON.stringify({ passed, failed, results }, null, 2))

  process.exit(failed > 0 ? 1 : 0)
})
