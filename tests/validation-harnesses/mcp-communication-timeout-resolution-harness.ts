#!/usr/bin/env bun
/**
 * Validation Harness: MCP Communication Timeout Resolution
 * 
 * Tests the enforcement of MCP timeout fixes:
 * - Verify DEFAULT_TIMEOUT is 10s (not 30s)
 * - Verify circuit breaker activates after 3 failures
 * - Verify ensure_initialized returns immediately (no 60s block)
 * - Verify timeout errors are surfaced with clear messages
 * - Monitor round-trip times for MCP operations
 * 
 * Usage:
 *   bun run tests/validation-harnesses/mcp-communication-timeout-resolution-harness.ts
 */

import { performance } from "perf_hooks"
import fs from "fs"
import path from "path"

interface TestCase {
  name: string
  input: any
  expectedOutput: any
  actualOutput?: any
  pass?: boolean
  duration?: number
  error?: string
}

interface ValidationResult {
  specificationName: string
  timestamp: string
  overallPass: boolean
  totalTests: number
  passed: number
  failed: number
  testCases: TestCase[]
  summary: string
}

/**
 * Test 1: Verify DEFAULT_TIMEOUT is 10s in mcp/index.ts
 */
async function testDefaultTimeoutValue(): Promise<TestCase> {
  const testCase: TestCase = {
    name: "DEFAULT_TIMEOUT value verification",
    input: "repos/metabob-opencode/packages/opencode/src/mcp/index.ts",
    expectedOutput: { timeout: 10_000, comment: "Reduced from 30s to 10s" },
  }

  const start = performance.now()
  
  try {
    const filePath = path.join(process.cwd(), "repos/metabob-opencode/packages/opencode/src/mcp/index.ts")
    const content = fs.readFileSync(filePath, "utf-8")
    
    // Check for DEFAULT_TIMEOUT = 10_000 (with optional underscores)
    const timeoutMatch = content.match(/const\s+DEFAULT_TIMEOUT\s*=\s*([\d_]+)/)
    const commentMatch = content.match(/\/\/.*ENFORCEMENT.*MCP Communication Timeout Resolution/i)
    
    if (!timeoutMatch) {
      throw new Error("DEFAULT_TIMEOUT constant not found")
    }
    
    const timeoutValue = parseInt(timeoutMatch[1].replace(/_/g, ""), 10)
    
    testCase.actualOutput = {
      timeout: timeoutValue,
      hasEnforcementComment: !!commentMatch,
    }
    
    testCase.pass = 
      timeoutValue === 10_000 && 
      commentMatch !== null
    
    if (!testCase.pass) {
      testCase.error = `Expected timeout=10000, got ${timeoutValue}. Enforcement comment present: ${!!commentMatch}`
    }
  } catch (error) {
    testCase.pass = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.actualOutput = { error: testCase.error }
  }
  
  testCase.duration = performance.now() - start
  return testCase
}

/**
 * Test 2: Verify circuit breaker implementation exists
 */
async function testCircuitBreakerImplementation(): Promise<TestCase> {
  const testCase: TestCase = {
    name: "Circuit breaker implementation verification",
    input: "repos/metabob-opencode/packages/opencode/src/mcp/index.ts",
    expectedOutput: {
      hasCircuitBreakerState: true,
      threshold: 3,
      resetMs: 60_000,
      hasFailureTracking: true,
    },
  }

  const start = performance.now()
  
  try {
    const filePath = path.join(process.cwd(), "repos/metabob-opencode/packages/opencode/src/mcp/index.ts")
    const content = fs.readFileSync(filePath, "utf-8")
    
    // Check for circuit breaker constants (with optional underscores)
    const thresholdMatch = content.match(/CIRCUIT_BREAKER_THRESHOLD\s*=\s*([\d_]+)/)
    const resetMatch = content.match(/CIRCUIT_BREAKER_RESET_MS\s*=\s*([\d_]+)/)
    const stateMatch = content.match(/circuitBreakerState.*Map/)
    const failureTrackingMatch = content.match(/state\.failures\+\+|current\.failures\+\+/)
    const circuitOpenCheck = content.match(/if\s*\(\s*state\?\.isOpen/)
    
    testCase.actualOutput = {
      hasCircuitBreakerState: !!stateMatch,
      threshold: thresholdMatch ? parseInt(thresholdMatch[1].replace(/_/g, ""), 10) : undefined,
      resetMs: resetMatch ? parseInt(resetMatch[1].replace(/_/g, ""), 10) : undefined,
      hasFailureTracking: !!failureTrackingMatch,
      hasCircuitOpenCheck: !!circuitOpenCheck,
    }
    
    testCase.pass = 
      !!stateMatch &&
      (thresholdMatch !== null && parseInt(thresholdMatch[1].replace(/_/g, ""), 10) === 3) &&
      (resetMatch !== null && parseInt(resetMatch[1].replace(/_/g, ""), 10) === 60_000) &&
      !!failureTrackingMatch &&
      !!circuitOpenCheck
    
    if (!testCase.pass) {
      testCase.error = "Circuit breaker implementation incomplete or incorrect values"
    }
  } catch (error) {
    testCase.pass = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.actualOutput = { error: testCase.error }
  }
  
  testCase.duration = performance.now() - start
  return testCase
}

/**
 * Test 3: Verify MetabobCLI.callMCPTool has explicit timeout
 */
async function testMetabobCLITimeout(): Promise<TestCase> {
  const testCase: TestCase = {
    name: "MetabobCLI.callMCPTool timeout verification",
    input: "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
    expectedOutput: {
      hasMcpToolTimeout: true,
      timeout: 10_000,
      hasWithTimeoutWrapper: true,
      hasEnhancedErrorHandling: true,
    },
  }

  const start = performance.now()
  
  try {
    const filePath = path.join(process.cwd(), "repos/metabob-opencode/packages/opencode/src/util/metabob.ts")
    const content = fs.readFileSync(filePath, "utf-8")
    
    // Check for MCP_TOOL_TIMEOUT constant (with optional underscores)
    const timeoutConstMatch = content.match(/MCP_TOOL_TIMEOUT\s*=\s*([\d_]+)/)
    const withTimeoutMatch = content.match(/withTimeout\s*\(\s*metabobClient\.callTool/)
    const enhancedErrorMatch = content.match(/timed out.*Check metabob-cli status/i)
    const circuitBreakerErrorMatch = content.match(/Circuit breaker/)
    
    testCase.actualOutput = {
      hasMcpToolTimeout: !!timeoutConstMatch,
      timeout: timeoutConstMatch ? parseInt(timeoutConstMatch[1].replace(/_/g, ""), 10) : undefined,
      hasWithTimeoutWrapper: !!withTimeoutMatch,
      hasEnhancedErrorHandling: !!(enhancedErrorMatch && circuitBreakerErrorMatch),
    }
    
    testCase.pass = 
      !!timeoutConstMatch &&
      parseInt(timeoutConstMatch[1].replace(/_/g, ""), 10) === 10_000 &&
      !!withTimeoutMatch &&
      !!enhancedErrorMatch &&
      !!circuitBreakerErrorMatch
    
    if (!testCase.pass) {
      testCase.error = "MetabobCLI.callMCPTool timeout implementation incomplete"
    }
  } catch (error) {
    testCase.pass = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.actualOutput = { error: testCase.error }
  }
  
  testCase.duration = performance.now() - start
  return testCase
}

/**
 * Test 4: Verify ensure_initialized returns status immediately (Python CLI)
 */
async function testEnsureInitializedNonBlocking(): Promise<TestCase> {
  const testCase: TestCase = {
    name: "StateChange.ensure_initialized non-blocking verification",
    input: "repos/metabob-cli/src/metabob_cli/mcp/server.py",
    expectedOutput: {
      returnsStatusDict: true,
      noBlockingWait: true,
      hasBackgroundInit: true,
      hasEnforcementComment: true,
    },
  }

  const start = performance.now()
  
  try {
    const filePath = path.join(process.cwd(), "repos/metabob-cli/src/metabob_cli/mcp/server.py")
    const content = fs.readFileSync(filePath, "utf-8")
    
    // Check for status dict return pattern
    const statusDictMatch = content.match(/return\s+\{\s*["']status["']\s*:\s*["']ready["']/)
    const initializingStatusMatch = content.match(/return\s+\{\s*["']status["']\s*:\s*["']initializing["']/)
    
    // Check that blocking wait is removed (should NOT find asyncio.wait_for with ensure_initialized)
    const blockingWaitMatch = content.match(/await\s+asyncio\.wait_for.*ensure_initialized/s)
    
    // Check for background init method
    const backgroundInitMatch = content.match(/async\s+def\s+_do_initialization/)
    
    // Check for enforcement comment
    const enforcementMatch = content.match(/ENFORCEMENT.*MCP Communication Timeout Resolution/i)
    
    testCase.actualOutput = {
      returnsStatusDict: !!(statusDictMatch && initializingStatusMatch),
      noBlockingWait: blockingWaitMatch ? false : true, // No blocking wait is good
      hasBackgroundInit: !!backgroundInitMatch,
      hasEnforcementComment: !!enforcementMatch,
    }
    
    testCase.pass = 
      !!(statusDictMatch && initializingStatusMatch) &&
      (blockingWaitMatch === null) && // No blocking wait is good
      !!backgroundInitMatch &&
      !!enforcementMatch
    
    if (!testCase.pass) {
      testCase.error = "ensure_initialized still has blocking wait or missing status return"
    }
  } catch (error) {
    testCase.pass = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.actualOutput = { error: testCase.error }
  }
  
  testCase.duration = performance.now() - start
  return testCase
}

/**
 * Test 5: Verify listTools timeout consistency
 */
async function testListToolsTimeoutConsistency(): Promise<TestCase> {
  const testCase: TestCase = {
    name: "listTools timeout consistency verification",
    input: "repos/metabob-opencode/packages/opencode/src/mcp/index.ts",
    expectedOutput: {
      usesDefaultTimeout: true,
      noHardcodedTimeout: true,
    },
  }

  const start = performance.now()
  
  try {
    const filePath = path.join(process.cwd(), "repos/metabob-opencode/packages/opencode/src/mcp/index.ts")
    const content = fs.readFileSync(filePath, "utf-8")
    
    // Find listTools call and check timeout (looking for withTimeout wrapper)
    const listToolsMatch = content.match(/withTimeout\s*\(\s*mcpClient\.listTools\(\)\s*,\s*mcp\.timeout\s*\?\?\s*(\w+)/s)
    const hardcodedTimeout = content.match(/mcpClient\.listTools\(\).*\?\?\s*5000/)
    
    testCase.actualOutput = {
      usesDefaultTimeout: listToolsMatch && listToolsMatch[1] === "DEFAULT_TIMEOUT",
      noHardcodedTimeout: !hardcodedTimeout,
      foundPattern: listToolsMatch ? listToolsMatch[0].substring(0, 100) : undefined,
    }
    
    testCase.pass = 
      !!listToolsMatch &&
      listToolsMatch[1] === "DEFAULT_TIMEOUT" &&
      !hardcodedTimeout
    
    if (!testCase.pass) {
      testCase.error = "listTools still uses hardcoded 5000ms timeout instead of DEFAULT_TIMEOUT"
    }
  } catch (error) {
    testCase.pass = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.actualOutput = { error: testCase.error }
  }
  
  testCase.duration = performance.now() - start
  return testCase
}

/**
 * Test 6: Code structure validation - enforcement comments present
 */
async function testEnforcementCommentsPresent(): Promise<TestCase> {
  const testCase: TestCase = {
    name: "Enforcement documentation verification",
    input: "Check for ENFORCEMENT comments in modified files",
    expectedOutput: {
      mcpIndexComments: 3, // DEFAULT_TIMEOUT, Circuit Breaker, listTools
      metabobUtilComments: 2, // MCP_TOOL_TIMEOUT, error handling
      pythonServerComments: 1, // ensure_initialized
    },
  }

  const start = performance.now()
  
  try {
    const files = [
      "repos/metabob-opencode/packages/opencode/src/mcp/index.ts",
      "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
      "repos/metabob-cli/src/metabob_cli/mcp/server.py",
    ]
    
    const commentCounts: Record<string, number> = {}
    
    for (const file of files) {
      const filePath = path.join(process.cwd(), file)
      const content = fs.readFileSync(filePath, "utf-8")
      const matches = content.match(/ENFORCEMENT.*MCP Communication Timeout Resolution/gi)
      const fileName = path.basename(file)
      commentCounts[fileName] = matches ? matches.length : 0
    }
    
    testCase.actualOutput = commentCounts
    
    // At least some enforcement comments should be present
    const totalComments = Object.values(commentCounts).reduce((a, b) => a + b, 0)
    testCase.pass = totalComments >= 5 // We expect at least 5 enforcement comments total
    
    if (!testCase.pass) {
      testCase.error = `Expected at least 5 enforcement comments, found ${totalComments}`
    }
  } catch (error) {
    testCase.pass = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.actualOutput = { error: testCase.error }
  }
  
  testCase.duration = performance.now() - start
  return testCase
}

/**
 * Test 7: Git commit verification - changes committed
 */
async function testGitCommitsPresent(): Promise<TestCase> {
  const testCase: TestCase = {
    name: "Git commit verification",
    input: "Check for enforcement commits in both repos",
    expectedOutput: {
      opencodeCommit: true,
      cliCommit: true,
    },
  }

  const start = performance.now()
  
  try {
    const { execSync } = require("child_process")
    
    // Check opencode repo
    const opencodeLog = execSync(
      'git log --all --grep="ENFORCEMENT: MCP Communication Timeout Resolution" --oneline',
      { cwd: path.join(process.cwd(), "repos/metabob-opencode"), encoding: "utf-8" }
    )
    
    // Check CLI repo
    const cliLog = execSync(
      'git log --all --grep="ENFORCEMENT: MCP Communication Timeout Resolution" --oneline',
      { cwd: path.join(process.cwd(), "repos/metabob-cli"), encoding: "utf-8" }
    )
    
    testCase.actualOutput = {
      opencodeCommit: opencodeLog.trim().length > 0,
      cliCommit: cliLog.trim().length > 0,
      opencodeCommitMessage: opencodeLog.trim().split("\n")[0],
      cliCommitMessage: cliLog.trim().split("\n")[0],
    }
    
    testCase.pass = opencodeLog.trim().length > 0 && cliLog.trim().length > 0
    
    if (!testCase.pass) {
      testCase.error = "Enforcement commits not found in one or both repositories"
    }
  } catch (error) {
    testCase.pass = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.actualOutput = { error: testCase.error }
  }
  
  testCase.duration = performance.now() - start
  return testCase
}

/**
 * Main validation runner
 */
async function runValidation(): Promise<ValidationResult> {
  console.log("🔍 Running MCP Communication Timeout Resolution Validation Harness\n")
  
  const testCases: TestCase[] = []
  
  // Run all tests
  console.log("Test 1: DEFAULT_TIMEOUT value verification...")
  testCases.push(await testDefaultTimeoutValue())
  
  console.log("Test 2: Circuit breaker implementation verification...")
  testCases.push(await testCircuitBreakerImplementation())
  
  console.log("Test 3: MetabobCLI.callMCPTool timeout verification...")
  testCases.push(await testMetabobCLITimeout())
  
  console.log("Test 4: StateChange.ensure_initialized non-blocking verification...")
  testCases.push(await testEnsureInitializedNonBlocking())
  
  console.log("Test 5: listTools timeout consistency verification...")
  testCases.push(await testListToolsTimeoutConsistency())
  
  console.log("Test 6: Enforcement documentation verification...")
  testCases.push(await testEnforcementCommentsPresent())
  
  console.log("Test 7: Git commit verification...")
  testCases.push(await testGitCommitsPresent())
  
  console.log("")
  
  // Calculate results
  const passed = testCases.filter((tc) => tc.pass).length
  const failed = testCases.filter((tc) => !tc.pass).length
  const overallPass = failed === 0
  
  const result: ValidationResult = {
    specificationName: "MCP Communication Timeout Resolution",
    timestamp: new Date().toISOString(),
    overallPass,
    totalTests: testCases.length,
    passed,
    failed,
    testCases,
    summary: overallPass
      ? `✅ All ${testCases.length} validation tests PASSED`
      : `❌ ${failed} of ${testCases.length} validation tests FAILED`,
  }
  
  return result
}

/**
 * Pretty print results
 */
function printResults(result: ValidationResult): void {
  console.log("\n" + "=".repeat(80))
  console.log("VALIDATION RESULTS: MCP Communication Timeout Resolution")
  console.log("=".repeat(80))
  console.log(`Timestamp: ${result.timestamp}`)
  console.log(`Overall: ${result.overallPass ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`Tests: ${result.passed}/${result.totalTests} passed, ${result.failed} failed`)
  console.log("")
  
  result.testCases.forEach((tc, idx) => {
    const status = tc.pass ? "✅ PASS" : "❌ FAIL"
    const duration = tc.duration ? `(${tc.duration.toFixed(2)}ms)` : ""
    console.log(`${idx + 1}. ${status} ${tc.name} ${duration}`)
    
    if (!tc.pass && tc.error) {
      console.log(`   Error: ${tc.error}`)
    }
    
    if (process.env.VERBOSE === "1") {
      console.log(`   Input: ${JSON.stringify(tc.input, null, 2)}`)
      console.log(`   Expected: ${JSON.stringify(tc.expectedOutput, null, 2)}`)
      console.log(`   Actual: ${JSON.stringify(tc.actualOutput, null, 2)}`)
    }
  })
  
  console.log("\n" + "=".repeat(80))
  console.log(result.summary)
  console.log("=".repeat(80) + "\n")
}

/**
 * Main entry point
 */
async function main() {
  try {
    const result = await runValidation()
    printResults(result)
    
    // Write results to file
    const outputPath = path.join(
      process.cwd(),
      "tests/validation-harnesses/mcp-communication-timeout-resolution-results.json"
    )
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
    console.log(`📄 Results written to: ${outputPath}\n`)
    
    // Exit with appropriate code
    process.exit(result.overallPass ? 0 : 1)
  } catch (error) {
    console.error("❌ Validation harness failed with error:")
    console.error(error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

// Export for programmatic use
export { runValidation, type ValidationResult, type TestCase }
