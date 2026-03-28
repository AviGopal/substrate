#!/usr/bin/env bun
/**
 * Validation Harness: ACP Protocol Complete Handshake and Message Exchange
 * 
 * This harness validates the complete ACP protocol flow:
 * 1. Client connects via HTTP POST /acp/stream
 * 2. Initialize request/response
 * 3. NewSession request/response
 * 4. Prompt request/response
 * 5. Server-side logs confirm processing
 * 
 * Usage:
 *   bun run tests/validation-harnesses/acp-protocol-complete-handshake-and-message-exchange-harness.ts
 * 
 * Returns:
 *   Exit 0 if validation passes
 *   Exit 1 if validation fails
 */

import { spawn } from "child_process"
import { promisify } from "util"
import { exec } from "child_process"

const execAsync = promisify(exec)

interface ValidationResult {
  pass: boolean
  actual: {
    testOutput: string
    devbobLogs: string
    duration: number
    exitCode: number | null
  }
  expected: {
    stepsCompleted: string[]
    noTimeoutErrors: boolean
    noConnectionErrors: boolean
    successMessage: string
  }
  failures: string[]
  metadata: {
    timestamp: string
    testFile: string
    devbobPod: string
  }
}

interface TestCase {
  impulseId: string
  input: {
    targetUrl: string
    prompt: string
    timeout: number
  }
  expectedOutput: {
    stepsCompleted: string[]
    successMessage: string
    maxDuration: number
    serverLogs: string[]
  }
}

const TEST_CASES: TestCase[] = [
  {
    impulseId: "validation-acp-protocol-complete-handshake-and-message-exchange-case-1",
    input: {
      targetUrl: "http://localhost:8080/acp/stream",
      prompt: "Echo back exactly: ACP TCP transport is working!",
      timeout: 60000,
    },
    expectedOutput: {
      stepsCompleted: [
        "Initialize ACP connection",
        "Create new session",
        "Send prompt",
        "SUCCESS: ACP TCP transport is working!",
      ],
      successMessage: "All tests passed",
      maxDuration: 10000, // 10 seconds max
      serverLogs: [
        "ACP stream initializing",
        "initialize",
        "new session",
        "prompt",
      ],
    },
  },
]

async function getDevBobPodName(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}'"
    )
    return stdout.trim().replace(/'/g, "")
  } catch (error) {
    console.warn("⚠️  Could not get DevBob pod name (kubectl may not be available)")
    return "devbob-unknown"
  }
}

async function captureDevBobLogs(): Promise<string> {
  try {
    const podName = await getDevBobPodName()
    const { stdout } = await execAsync(
      `kubectl logs -n metabob ${podName} --tail=100 | grep -E 'initialize|session|prompt|response|ACP' || echo "No matching logs"`
    )
    return stdout
  } catch (error) {
    console.warn("⚠️  Could not capture DevBob logs:", error)
    return "Log capture failed"
  }
}

async function runTest(testCase: TestCase): Promise<ValidationResult> {
  console.log(`\n🧪 Running validation: ${testCase.impulseId}`)
  console.log(`   Target: ${testCase.input.targetUrl}`)
  console.log(`   Timeout: ${testCase.input.timeout}ms\n`)

  const startTime = Date.now()
  let testOutput = ""
  let exitCode: number | null = null
  const failures: string[] = []

  // Clear DevBob logs before test (mark timestamp)
  const preTestLogs = await captureDevBobLogs()

  // Run the test with timeout
  const testPromise = new Promise<{ output: string; code: number | null }>((resolve, reject) => {
    const testProcess = spawn("bun", ["run", "repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts"], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: testCase.input.timeout,
    })

    let output = ""

    testProcess.stdout.on("data", (data) => {
      const text = data.toString()
      output += text
      process.stdout.write(text) // Echo to console
    })

    testProcess.stderr.on("data", (data) => {
      const text = data.toString()
      output += text
      process.stderr.write(text)
    })

    testProcess.on("close", (code) => {
      resolve({ output, code })
    })

    testProcess.on("error", (error) => {
      reject(error)
    })

    // Timeout handler
    setTimeout(() => {
      testProcess.kill("SIGTERM")
      reject(new Error(`Test timed out after ${testCase.input.timeout}ms`))
    }, testCase.input.timeout)
  })

  try {
    const result = await testPromise
    testOutput = result.output
    exitCode = result.code
  } catch (error: any) {
    testOutput = error.message || "Test failed with unknown error"
    exitCode = 1
    failures.push(`Test execution failed: ${error.message}`)
  }

  const duration = Date.now() - startTime

  // Capture DevBob logs after test
  const postTestLogs = await captureDevBobLogs()

  // Validation checks
  const checks = {
    stepsCompleted: testCase.expectedOutput.stepsCompleted.every((step) =>
      testOutput.includes(step)
    ),
    successMessage: testOutput.includes(testCase.expectedOutput.successMessage),
    noDurationExceeded: duration <= testCase.expectedOutput.maxDuration,
    noTimeoutErrors: !testOutput.toLowerCase().includes("timeout") && !testOutput.includes("timed out"),
    noConnectionErrors: !testOutput.includes("connection closed") && !testOutput.includes("ECONNREFUSED"),
    exitedCleanly: exitCode === 0,
    serverLogsPresent: testCase.expectedOutput.serverLogs.some((log) =>
      postTestLogs.toLowerCase().includes(log.toLowerCase())
    ),
  }

  // Collect failures
  if (!checks.stepsCompleted) {
    const missingSteps = testCase.expectedOutput.stepsCompleted.filter(
      (step) => !testOutput.includes(step)
    )
    failures.push(`Missing steps in output: ${missingSteps.join(", ")}`)
  }

  if (!checks.successMessage) {
    failures.push(`Success message not found: "${testCase.expectedOutput.successMessage}"`)
  }

  if (!checks.noDurationExceeded) {
    failures.push(
      `Test took too long: ${duration}ms (max: ${testCase.expectedOutput.maxDuration}ms)`
    )
  }

  if (!checks.noTimeoutErrors) {
    failures.push("Timeout errors detected in output")
  }

  if (!checks.noConnectionErrors) {
    failures.push("Connection errors detected in output")
  }

  if (!checks.exitedCleanly) {
    failures.push(`Test exited with code ${exitCode} (expected 0)`)
  }

  if (!checks.serverLogsPresent) {
    failures.push(
      `Server logs missing expected patterns: ${testCase.expectedOutput.serverLogs.join(", ")}`
    )
  }

  const pass = Object.values(checks).every((check) => check === true)

  const devbobPod = await getDevBobPodName()

  return {
    pass,
    actual: {
      testOutput,
      devbobLogs: postTestLogs,
      duration,
      exitCode,
    },
    expected: {
      stepsCompleted: testCase.expectedOutput.stepsCompleted,
      noTimeoutErrors: true,
      noConnectionErrors: true,
      successMessage: testCase.expectedOutput.successMessage,
    },
    failures,
    metadata: {
      timestamp: new Date().toISOString(),
      testFile: "repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts",
      devbobPod,
    },
  }
}

export async function runValidation(input?: { testCase?: number }): Promise<ValidationResult> {
  const testCaseIndex = input?.testCase ?? 0
  const testCase = TEST_CASES[testCaseIndex]

  if (!testCase) {
    throw new Error(`Test case ${testCaseIndex} not found`)
  }

  return runTest(testCase)
}

// Main execution
if (import.meta.main) {
  console.log("🎯 ACP Protocol Complete Handshake and Message Exchange - Validation Harness\n")

  runValidation()
    .then((result) => {
      console.log("\n" + "=".repeat(80))
      console.log("📊 VALIDATION RESULTS")
      console.log("=".repeat(80))

      console.log(`\n✅ Pass: ${result.pass}`)
      console.log(`⏱️  Duration: ${result.actual.duration}ms`)
      console.log(`🔢 Exit Code: ${result.actual.exitCode}`)

      if (result.failures.length > 0) {
        console.log(`\n❌ Failures (${result.failures.length}):`)
        result.failures.forEach((failure, idx) => {
          console.log(`   ${idx + 1}. ${failure}`)
        })
      }

      console.log(`\n📝 Expected Steps:`)
      result.expected.stepsCompleted.forEach((step) => {
        const found = result.actual.testOutput.includes(step)
        console.log(`   ${found ? "✅" : "❌"} ${step}`)
      })

      console.log(`\n🔍 Server Logs (DevBob):`)
      console.log(result.actual.devbobLogs || "(no logs captured)")

      console.log(`\n📦 Metadata:`)
      console.log(`   Timestamp: ${result.metadata.timestamp}`)
      console.log(`   Test File: ${result.metadata.testFile}`)
      console.log(`   DevBob Pod: ${result.metadata.devbobPod}`)

      console.log("\n" + "=".repeat(80))

      process.exit(result.pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("\n❌ Validation harness failed:")
      console.error(error)
      process.exit(1)
    })
}
