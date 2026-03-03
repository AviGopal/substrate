#!/usr/bin/env bun

/**
 * Validation Harness for MCP-Only Communication Specification
 * 
 * Validates that metabob-opencode ONLY communicates via metabob-cli MCP server,
 * never direct HTTP to backend.
 * 
 * Test Cases:
 * - Case 1: Static analysis - No direct fetch() to METABOB_RPC_API_URL
 * - Case 2: Static analysis - No wrong tool name 'metabob_post_activity_result'
 * - Case 3: Static analysis - TemplateMetricsClient uses MCP abstraction
 * - Case 4: Static analysis - BoredomManager uses TemplateMetricsClient abstraction
 * - Case 5: Acceptable exception - rpc-http-client.ts for Thompson Sampling
 */

import path from "path"
import { execSync } from "child_process"

// Types
interface ValidationCase {
  id: string
  input: {
    codebasePath: string
    checkType: "no-direct-http" | "no-wrong-tool-name" | "uses-mcp-abstraction" | "acceptable-exception"
    targetFile?: string
    searchPattern?: string
    expectedMatches?: number
  }
  expectedOutput: {
    pass: boolean
    violationCount: number
    violations?: string[]
    acceptableFiles?: string[]
  }
}

interface ValidationResult {
  pass: boolean
  caseId: string
  actual: {
    violationCount: number
    violations: string[]
    details: string
  }
  expected: {
    pass: boolean
    violationCount: number
    violations?: string[]
  }
  error?: string
}

// Test cases
const TEST_CASES: ValidationCase[] = [
  {
    id: "validation-mcp-only-communication-case-1",
    input: {
      codebasePath: "repos/metabob-opencode/packages/opencode/src",
      checkType: "no-direct-http",
      searchPattern: "METABOB_RPC_API_URL",
      expectedMatches: 1, // Only rpc-http-client.ts is acceptable
    },
    expectedOutput: {
      pass: true,
      violationCount: 0,
      acceptableFiles: ["util/rpc-http-client.ts"],
    },
  },
  {
    id: "validation-mcp-only-communication-case-2",
    input: {
      codebasePath: "repos/metabob-opencode/packages/opencode/src",
      checkType: "no-wrong-tool-name",
      searchPattern: "metabob_post_activity_result",
      expectedMatches: 1, // Only in comment documenting historical issue
    },
    expectedOutput: {
      pass: true,
      violationCount: 0,
      violations: [],
    },
  },
  {
    id: "validation-mcp-only-communication-case-3",
    input: {
      codebasePath: "repos/metabob-opencode/packages/opencode/src",
      checkType: "uses-mcp-abstraction",
      targetFile: "session/template-metrics-client.ts",
      searchPattern: "post_activity_result",
    },
    expectedOutput: {
      pass: true,
      violationCount: 0,
    },
  },
  {
    id: "validation-mcp-only-communication-case-4",
    input: {
      codebasePath: "repos/metabob-opencode/packages/opencode/src",
      checkType: "uses-mcp-abstraction",
      targetFile: "session/boredom-manager.ts",
      searchPattern: "TemplateMetricsClient.reportExecution",
    },
    expectedOutput: {
      pass: true,
      violationCount: 0,
    },
  },
  {
    id: "validation-mcp-only-communication-case-5",
    input: {
      codebasePath: "repos/metabob-opencode/packages/opencode/src",
      checkType: "acceptable-exception",
      targetFile: "util/rpc-http-client.ts",
      searchPattern: "METABOB_RPC_API_URL",
    },
    expectedOutput: {
      pass: true,
      violationCount: 0,
      acceptableFiles: ["util/rpc-http-client.ts"],
    },
  },
]

/**
 * Run static analysis check using grep/ripgrep
 */
async function runStaticCheck(
  codebasePath: string,
  pattern: string,
  targetFile?: string,
): Promise<{ matches: string[]; count: number }> {
  const repoRoot = "/home/avi/documents/work/exp-repo/metabob-devbob"
  const fullPath = path.join(repoRoot, codebasePath)
  
  try {
    let cmd: string
    
    if (targetFile) {
      // Check specific file
      const filePath = path.join(fullPath, targetFile)
      cmd = `grep -n "${pattern}" "${filePath}" 2>/dev/null || true`
    } else {
      // Check entire codebase
      cmd = `cd "${repoRoot}" && grep -rn "${pattern}" "${codebasePath}" --include="*.ts" 2>/dev/null || true`
    }
    
    const output = execSync(cmd, { encoding: "utf-8" })
    const matches = output.trim().split("\n").filter(line => line.length > 0)
    
    return {
      matches,
      count: matches.length,
    }
  } catch (error) {
    // grep returns exit code 1 if no matches found
    return {
      matches: [],
      count: 0,
    }
  }
}

/**
 * Filter out acceptable exceptions (e.g., rpc-http-client.ts for Thompson Sampling)
 */
function filterAcceptableViolations(
  matches: string[],
  acceptableFiles: string[],
): string[] {
  return matches.filter(match => {
    const matchLower = match.toLowerCase()
    return !acceptableFiles.some(acceptableFile => 
      matchLower.includes(acceptableFile.toLowerCase())
    )
  })
}

/**
 * Validate a single test case
 */
async function validateCase(testCase: ValidationCase): Promise<ValidationResult> {
  const { input, expectedOutput } = testCase
  
  try {
    const { matches, count } = await runStaticCheck(
      input.codebasePath,
      input.searchPattern || "",
      input.targetFile,
    )
    
    // Filter acceptable exceptions
    const acceptableFiles = expectedOutput.acceptableFiles || []
    const violations = filterAcceptableViolations(matches, acceptableFiles)
    const violationCount = violations.length
    
    // Determine pass/fail
    let pass = false
    let details = ""
    
    switch (input.checkType) {
      case "no-direct-http":
        // Should only find METABOB_RPC_API_URL in rpc-http-client.ts
        pass = violationCount === 0
        details = `Found ${count} total matches, ${violationCount} violations (${matches.length - violationCount} acceptable)`
        break
        
      case "no-wrong-tool-name":
        // Should only find metabob_post_activity_result in comments (not in actual code)
        // Filter to only count violations in actual code (not in comments)
        const codeViolations = violations.filter(v => !v.includes("//") && !v.includes("*"))
        pass = codeViolations.length === 0
        details = `Found ${count} total matches, ${codeViolations.length} code violations (${count - codeViolations.length} in comments)`
        break
        
      case "uses-mcp-abstraction":
        // Should find the required pattern in target file
        pass = count > 0
        details = `Found ${count} matches of required pattern`
        break
        
      case "acceptable-exception":
        // Verify exception is present
        pass = count > 0
        details = `Confirmed exception file exists with ${count} matches`
        break
    }
    
    return {
      pass,
      caseId: testCase.id,
      actual: {
        violationCount,
        violations,
        details,
      },
      expected: {
        pass: expectedOutput.pass,
        violationCount: expectedOutput.violationCount,
        violations: expectedOutput.violations,
      },
    }
  } catch (error) {
    return {
      pass: false,
      caseId: testCase.id,
      actual: {
        violationCount: -1,
        violations: [],
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      },
      expected: {
        pass: expectedOutput.pass,
        violationCount: expectedOutput.violationCount,
      },
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Run all validation cases
 */
export async function runValidation(): Promise<{
  pass: boolean
  results: ValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}> {
  console.log("🔍 Running MCP-Only Communication Validation Harness...")
  console.log("")
  
  const results: ValidationResult[] = []
  
  for (const testCase of TEST_CASES) {
    console.log(`Testing: ${testCase.id}`)
    console.log(`  Type: ${testCase.input.checkType}`)
    if (testCase.input.targetFile) {
      console.log(`  File: ${testCase.input.targetFile}`)
    }
    
    const result = await validateCase(testCase)
    results.push(result)
    
    if (result.pass) {
      console.log(`  ✅ PASS - ${result.actual.details}`)
    } else {
      console.log(`  ❌ FAIL - ${result.actual.details}`)
      if (result.actual.violations.length > 0) {
        console.log(`  Violations:`)
        result.actual.violations.forEach(v => console.log(`    - ${v}`))
      }
    }
    console.log("")
  }
  
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  const allPassed = failed === 0
  
  console.log("=" .repeat(60))
  console.log(`Summary: ${passed}/${results.length} tests passed`)
  
  if (allPassed) {
    console.log("✅ MCP-Only Communication specification VALIDATED")
  } else {
    console.log("❌ MCP-Only Communication specification VIOLATED")
  }
  console.log("=" .repeat(60))
  
  return {
    pass: allPassed,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
    },
  }
}

// CLI execution
if (import.meta.main) {
  runValidation()
    .then(result => {
      process.exit(result.pass ? 0 : 1)
    })
    .catch(error => {
      console.error("Validation harness error:", error)
      process.exit(1)
    })
}
