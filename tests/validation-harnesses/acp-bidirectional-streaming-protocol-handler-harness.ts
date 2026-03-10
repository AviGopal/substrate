#!/usr/bin/env bun
/**
 * Validation Harness: ACP Bidirectional Streaming Protocol Handler
 * 
 * Validates that the /acp/stream endpoint properly handles bidirectional streaming
 * for the Agent Client Protocol without ReadableStream locking errors.
 * 
 * Test Strategy:
 * 1. Execute test-acp-tcp-transport.ts against DevBob pod
 * 2. Verify HTTP 200 response received
 * 3. Check DevBob logs show 'ACP stream initializing' with no subsequent errors
 * 4. Verify test receives initialize response with serverInfo
 * 5. Verify test successfully creates new session
 * 6. Verify prompt request executes and agent responds
 * 7. Verify test completes with 'SUCCESS: ACP TCP transport is working!' message
 * 
 * Usage: bun run acp-bidirectional-streaming-protocol-handler-harness.ts
 */

import { spawn } from "child_process"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

interface ValidationResult {
  pass: boolean
  actual: {
    httpStatus?: number
    initializeSucceeded: boolean
    sessionCreated: boolean
    promptExecuted: boolean
    responseReceived: boolean
    testCompleted: boolean
    readableStreamError: boolean
    connectionClosedError: boolean
    devbobLogs: string[]
    errorMessages: string[]
  }
  expected: {
    httpStatus: 200
    initializeSucceeded: true
    sessionCreated: true
    promptExecuted: true
    responseReceived: true
    testCompleted: true
    readableStreamError: false
    connectionClosedError: false
  }
  testOutput: string
  timestamp: string
}

interface TestCase {
  impulseId: string
  input: {
    devbobUrl: string
    testPrompt: string
    timeout: number
  }
  expectedOutput: {
    httpStatus: 200
    hasServerInfo: boolean
    hasSessionId: boolean
    hasResponse: boolean
    noStreamErrors: boolean
    successMessage: string
  }
}

/**
 * Execute the ACP TCP transport test
 */
async function executeTest(testCase: TestCase): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}> {
  return new Promise((resolve) => {
    const testScript = join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts",
    )

    if (!existsSync(testScript)) {
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: `Test script not found: ${testScript}`,
      })
      return
    }

    const proc = spawn("bun", ["run", testScript], {
      cwd: join(__dirname, "../../repos/metabob-opencode/packages/opencode"),
      env: {
        ...process.env,
        DEVBOB_URL: testCase.input.devbobUrl,
      },
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    const timeout = setTimeout(() => {
      proc.kill()
      resolve({
        exitCode: 124, // Timeout exit code
        stdout,
        stderr: stderr + "\nTest timed out",
      })
    }, testCase.input.timeout)

    proc.on("close", (code) => {
      clearTimeout(timeout)
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      })
    })
  })
}

/**
 * Fetch DevBob pod logs
 */
async function getDevBobLogs(): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn("kubectl", [
      "logs",
      "-n",
      "metabob",
      "-l",
      "app.kubernetes.io/name=devbob",
      "--tail=50",
    ])

    let stdout = ""
    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.on("close", () => {
      const logs = stdout.split("\n").filter((line) => line.trim().length > 0)
      resolve(logs)
    })

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill()
      resolve([])
    }, 5000)
  })
}

/**
 * Analyze test output and logs
 */
function analyzeResults(
  testOutput: { exitCode: number; stdout: string; stderr: string },
  devbobLogs: string[],
  expected: TestCase["expectedOutput"],
): ValidationResult {
  const output = testOutput.stdout + testOutput.stderr

  // Check for success criteria
  const httpStatus = output.match(/Response status: (\d+)/)?.[1]
  const initializeSucceeded = output.includes("✓ Initialized:")
  const sessionCreated = output.includes("✓ Session created:")
  const promptExecuted = output.includes("✓ Prompt sent")
  const responseReceived =
    output.includes("Response text:") && !output.includes("(no text received)")
  const testCompleted = output.includes("SUCCESS: ACP TCP transport is working!")

  // Check for error conditions
  const readableStreamError =
    output.includes("ReadableStream is locked") ||
    devbobLogs.some((log) => log.includes("ReadableStream is locked"))
  const connectionClosedError =
    output.includes("connection closed") ||
    devbobLogs.some((log) => log.includes("connection closed"))

  // Extract error messages
  const errorMessages: string[] = []
  if (testOutput.stderr) {
    const stderrLines = testOutput.stderr.split("\n")
    stderrLines.forEach((line) => {
      if (
        line.includes("error") ||
        line.includes("Error") ||
        line.includes("failed")
      ) {
        errorMessages.push(line.trim())
      }
    })
  }

  // Extract DevBob error logs
  devbobLogs.forEach((log) => {
    if (log.includes("ERROR") || log.includes("error")) {
      errorMessages.push(log)
    }
  })

  const actual = {
    httpStatus: httpStatus ? parseInt(httpStatus) : undefined,
    initializeSucceeded,
    sessionCreated,
    promptExecuted,
    responseReceived,
    testCompleted,
    readableStreamError,
    connectionClosedError,
    devbobLogs,
    errorMessages,
  }

  // Determine pass/fail
  const pass =
    testOutput.exitCode === 0 &&
    actual.httpStatus === expected.httpStatus &&
    actual.initializeSucceeded === expected.hasServerInfo &&
    actual.sessionCreated === expected.hasSessionId &&
    actual.promptExecuted &&
    actual.responseReceived === expected.hasResponse &&
    actual.testCompleted &&
    !actual.readableStreamError &&
    !actual.connectionClosedError

  return {
    pass,
    actual,
    expected: {
      httpStatus: expected.httpStatus,
      initializeSucceeded: expected.hasServerInfo,
      sessionCreated: expected.hasSessionId,
      promptExecuted: true,
      responseReceived: expected.hasResponse,
      testCompleted: true,
      readableStreamError: false,
      connectionClosedError: false,
    },
    testOutput: output,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Run validation with a specific test case
 */
export async function runValidation(
  testCase: TestCase,
): Promise<ValidationResult> {
  console.log(`\n🧪 Running ACP Bidirectional Streaming Protocol Handler Validation`)
  console.log(`   Test Case: ${testCase.impulseId}`)
  console.log(`   Target: ${testCase.input.devbobUrl}\n`)

  // Execute the test
  console.log("📋 Step 1: Executing ACP TCP transport test...")
  const testOutput = await executeTest(testCase)
  console.log(`   Exit code: ${testOutput.exitCode}`)

  // Fetch DevBob logs
  console.log("\n📋 Step 2: Fetching DevBob pod logs...")
  const devbobLogs = await getDevBobLogs()
  console.log(`   Retrieved ${devbobLogs.length} log lines`)

  // Analyze results
  console.log("\n📋 Step 3: Analyzing results...")
  const result = analyzeResults(testOutput, devbobLogs, testCase.expectedOutput)

  // Print summary
  console.log("\n" + "=".repeat(80))
  console.log("📊 VALIDATION RESULTS")
  console.log("=".repeat(80))
  console.log(`Status: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`Timestamp: ${result.timestamp}`)
  console.log(`\nExpected vs Actual:`)
  console.log(`  HTTP Status: ${result.expected.httpStatus} → ${result.actual.httpStatus || "N/A"}`)
  console.log(`  Initialize: ${result.expected.initializeSucceeded} → ${result.actual.initializeSucceeded}`)
  console.log(`  Session Created: ${result.expected.sessionCreated} → ${result.actual.sessionCreated}`)
  console.log(`  Prompt Executed: ${result.expected.promptExecuted} → ${result.actual.promptExecuted}`)
  console.log(`  Response Received: ${result.expected.responseReceived} → ${result.actual.responseReceived}`)
  console.log(`  Test Completed: ${result.expected.testCompleted} → ${result.actual.testCompleted}`)
  console.log(`  ReadableStream Error: ${result.expected.readableStreamError} → ${result.actual.readableStreamError}`)
  console.log(`  Connection Closed Error: ${result.expected.connectionClosedError} → ${result.actual.connectionClosedError}`)

  if (result.actual.errorMessages.length > 0) {
    console.log(`\n❌ Errors Found (${result.actual.errorMessages.length}):`)
    result.actual.errorMessages.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg}`)
    })
  }

  console.log("=".repeat(80) + "\n")

  return result
}

/**
 * Load test cases from impulse storage
 */
function loadTestCases(): TestCase[] {
  // Test case 1: Basic HTTP connection and protocol handshake
  const testCase1: TestCase = {
    impulseId: "validation-acp-bidirectional-streaming-protocol-handler-case-1",
    input: {
      devbobUrl: "http://localhost:8080/acp/stream",
      testPrompt: "Echo back exactly: ACP TCP transport is working!",
      timeout: 15000, // 15 seconds
    },
    expectedOutput: {
      httpStatus: 200,
      hasServerInfo: true,
      hasSessionId: true,
      hasResponse: true,
      noStreamErrors: true,
      successMessage: "SUCCESS: ACP TCP transport is working!",
    },
  }

  // Test case 2: Alternative DevBob host (K8s service)
  const testCase2: TestCase = {
    impulseId: "validation-acp-bidirectional-streaming-protocol-handler-case-2",
    input: {
      devbobUrl: "http://devbob.metabob.svc.cluster.local:8080/acp/stream",
      testPrompt: "Simple response test",
      timeout: 15000,
    },
    expectedOutput: {
      httpStatus: 200,
      hasServerInfo: true,
      hasSessionId: true,
      hasResponse: true,
      noStreamErrors: true,
      successMessage: "SUCCESS: ACP TCP transport is working!",
    },
  }

  return [testCase1, testCase2]
}

/**
 * Main execution
 */
if (require.main === module) {
  ;(async () => {
    const testCases = loadTestCases()

    console.log("🎯 ACP Bidirectional Streaming Protocol Handler Validation Harness")
    console.log(`   Test Cases: ${testCases.length}\n`)

    let passCount = 0
    let failCount = 0

    for (const testCase of testCases) {
      const result = await runValidation(testCase)

      if (result.pass) {
        passCount++
      } else {
        failCount++
      }

      // Save result to file
      const resultFile = join(
        __dirname,
        `validation-results-acp-streaming-${testCase.impulseId}.json`,
      )
      await Bun.write(resultFile, JSON.stringify(result, null, 2))
      console.log(`💾 Results saved to: ${resultFile}\n`)
    }

    console.log("=".repeat(80))
    console.log("🎉 VALIDATION SUITE COMPLETE")
    console.log("=".repeat(80))
    console.log(`Total: ${testCases.length} | Pass: ${passCount} | Fail: ${failCount}`)
    console.log("=".repeat(80) + "\n")

    process.exit(failCount > 0 ? 1 : 0)
  })()
}
