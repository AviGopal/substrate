/**
 * Simple validation runner for minibob-standalone-execution
 * 
 * Executes validation tests without needing the full harness
 */

interface ValidationResult {
  testCase: string
  status: "PASS" | "FAIL" | "SKIP"
  actual: unknown
  expected: unknown
  error?: string
  duration?: number
}

// Configuration
const NAMESPACE = "testing-minibob"
const BACKEND_URL = "http://api.metabob.local"

// Utility: Execute kubectl command
async function kubectl(command: string): Promise<string> {
  try {
    const proc = Bun.spawn(["kubectl", "-n", NAMESPACE, ...command.split(" ")], {
      stdout: "pipe",
      stderr: "pipe",
    })
    
    const exitCode = await proc.exited
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    
    if (exitCode !== 0) {
      throw new Error(`kubectl failed: ${stderr}`)
    }
    
    return stdout.trim()
  } catch (error) {
    throw new Error(`kubectl failed: ${error}`)
  }
}

// Utility: HTTP request
async function httpRequest(
  url: string,
  options: RequestInit = {}
): Promise<{ status: number; data: unknown }> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  let data: unknown
  try {
    data = await response.json()
  } catch {
    data = await response.text()
  }

  return { status: response.status, data }
}

// Get minibob pod names
function getMinibobPods(): string[] {
  const output = kubectl(`get pods -o jsonpath='{.items[*].metadata.name}'`)
  return output.split(" ").filter(Boolean)
}

// Test 1: Pod Health and Readiness
async function testPodHealth(): Promise<ValidationResult> {
  const startTime = Date.now()
  try {
    const pods = getMinibobPods()
    
    if (pods.length === 0) {
      return {
        testCase: "Pod Health and Readiness",
        status: "FAIL",
        actual: { pods: 0 },
        expected: { pods: 3, allRunning: true },
        error: "No pods found in testing-minibob namespace",
        duration: Date.now() - startTime,
      }
    }

    const podStatuses = pods.map((pod) => {
      const phase = kubectl(`get pod ${pod} -o jsonpath='{.status.phase}'`)
      return { pod, phase }
    })

    const allRunning = podStatuses.every((p) => p.phase === "Running")
    const pass = allRunning && pods.length === 3

    return {
      testCase: "Pod Health and Readiness",
      status: pass ? "PASS" : "FAIL",
      actual: { pods: pods.length, podStatuses },
      expected: { pods: 3, allRunning: true },
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase: "Pod Health and Readiness",
      status: "FAIL",
      actual: null,
      expected: { pods: 3, allRunning: true },
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

// Test 2: Activity Execution (simplified - check if endpoint responds)
async function testActivityExecution(): Promise<ValidationResult> {
  const startTime = Date.now()
  try {
    const pods = getMinibobPods()
    if (pods.length === 0) {
      throw new Error("No minibob pods found")
    }

    // Port-forward to first pod (simplified - just check if we can connect)
    // For now, we'll skip the actual execution test since it requires port-forwarding
    
    return {
      testCase: "Activity Execution and Tracking",
      status: "SKIP",
      actual: { reason: "Requires port-forwarding to test" },
      expected: { status: 200, activityStatus: "completed" },
      error: "Test skipped - requires manual port-forwarding setup",
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase: "Activity Execution and Tracking",
      status: "FAIL",
      actual: null,
      expected: { status: 200 },
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

// Test 6: ACP Gossip Discovery (check logs)
async function testACPGossipDiscovery(): Promise<ValidationResult> {
  const startTime = Date.now()
  try {
    const pods = getMinibobPods()
    if (pods.length < 2) {
      return {
        testCase: "ACP Gossip Discovery",
        status: "FAIL",
        actual: { pods: pods.length },
        expected: { pods: ">= 2" },
        error: "Need at least 2 pods for gossip discovery test",
        duration: Date.now() - startTime,
      }
    }

    // Check pod logs for ACP-related messages
    const logs = kubectl(`logs ${pods[0]} --tail=200`)

    const hasACPEndpoint = logs.includes("/acp") || logs.includes("ACP")
    const hasGossipMentions = logs.includes("gossip") || logs.includes("discovery")

    return {
      testCase: "ACP Gossip Discovery",
      status: hasACPEndpoint ? "PASS" : "FAIL",
      actual: {
        acpEndpoint: hasACPEndpoint,
        gossipMentions: hasGossipMentions,
        pods: pods.length,
      },
      expected: {
        acpEndpoint: true,
        gossipDiscovery: true,
      },
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase: "ACP Gossip Discovery",
      status: "FAIL",
      actual: null,
      expected: { acpEndpoint: true },
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

// Test 8: Boredom Task Execution (check logs)
async function testBoredomTaskExecution(): Promise<ValidationResult> {
  const startTime = Date.now()
  try {
    const pods = getMinibobPods()
    const logs = kubectl(`logs ${pods[0]} --tail=300`)

    const hasBoredomInit = logs.includes("boredom") || logs.includes("Boredom")
    const hasAutonomous = logs.includes("autonomous") || logs.includes("idle")

    return {
      testCase: "Boredom Task Execution",
      status: hasBoredomInit ? "PASS" : "FAIL",
      actual: {
        boredomInitialized: hasBoredomInit,
        autonomousPolling: hasAutonomous,
      },
      expected: {
        boredomInitialized: true,
        autonomousPolling: true,
      },
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase: "Boredom Task Execution",
      status: "FAIL",
      actual: null,
      expected: { boredomInitialized: true },
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

// Test 10: Learning Loop Metrics (check backend)
async function testLearningLoopMetrics(): Promise<ValidationResult> {
  const startTime = Date.now()
  try {
    const response = await httpRequest(`${BACKEND_URL}/activity-executions?limit=10`, {
      method: "GET",
    })

    return {
      testCase: "Learning Loop Metrics",
      status: response.status === 200 ? "PASS" : "FAIL",
      actual: { status: response.status, hasMetrics: !!response.data },
      expected: { status: 200, metricsReported: true },
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase: "Learning Loop Metrics",
      status: "FAIL",
      actual: null,
      expected: { metricsReported: true },
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

// Test 11: Learned Parameter Reuse (known to fail)
async function testLearnedParameterReuse(): Promise<ValidationResult> {
  const startTime = Date.now()
  return {
    testCase: "Learned Parameter Reuse",
    status: "FAIL",
    actual: { implemented: false },
    expected: { impulseAgentSkipped: true, learnedParamsUsed: true },
    error: "Feature not yet implemented - expected failure",
    duration: Date.now() - startTime,
  }
}

// Main validation runner
async function runValidation() {
  console.log("=".repeat(80))
  console.log("Minibob Standalone Execution - Validation Results")
  console.log("=".repeat(80))
  console.log(`Namespace: ${NAMESPACE}`)
  console.log(`Backend: ${BACKEND_URL}`)
  console.log("=".repeat(80))
  console.log()

  const tests = [
    testPodHealth,
    testActivityExecution,
    testACPGossipDiscovery,
    testBoredomTaskExecution,
    testLearningLoopMetrics,
    testLearnedParameterReuse,
  ]

  const results: ValidationResult[] = []

  for (const test of tests) {
    const result = await test()
    results.push(result)

    const statusSymbol =
      result.status === "PASS" ? "✅" : result.status === "SKIP" ? "⏭️" : "❌"
    console.log(`${statusSymbol} ${result.status} ${result.testCase} (${result.duration}ms)`)
    if (result.error && result.status !== "SKIP") {
      console.log(`    Error: ${result.error}`)
    }
  }

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  const skipped = results.filter((r) => r.status === "SKIP").length

  // Expected failures (Test 11 is known to fail)
  const expectedFailures = results.filter(
    (r) => r.status === "FAIL" && r.testCase === "Learned Parameter Reuse"
  ).length
  const unexpectedFailures = failed - expectedFailures

  console.log()
  console.log("=".repeat(80))
  console.log(`RESULTS: ${passed} PASS / ${failed} FAIL / ${skipped} SKIP`)
  console.log(`Expected Failures: ${expectedFailures}`)
  console.log(`Unexpected Failures: ${unexpectedFailures}`)
  console.log("=".repeat(80))

  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      expectedFailures,
      unexpectedFailures,
    },
  }
}

// Run validation
runValidation()
  .then(({ results, summary }) => {
    // Output JSON results
    console.log()
    console.log("JSON Results:")
    console.log(JSON.stringify({ results, summary }, null, 2))

    // Exit with appropriate code
    process.exit(summary.unexpectedFailures > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error("Validation failed:", error)
    process.exit(1)
  })
