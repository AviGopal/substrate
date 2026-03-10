/**
 * Validation Harness: ACP Network Transport Implementation
 * 
 * Validates the complete TCP/HTTP transport implementation for ACP delegation.
 * 
 * Test Coverage:
 * 1. TCP transport class exists and is not a stub
 * 2. HTTP server exposes POST /acp/stream endpoint
 * 3. TCP transport connects to localhost ACP server
 * 4. End-to-end delegation: local session → TCP → remote agent → response
 * 5. Connection cleanup works correctly
 * 6. Error handling for connection failures
 */

interface TestResult {
  pass: boolean
  actual: any
  expected: any
  error?: string
  message?: string
}

interface ValidationSummary {
  pass: boolean
  results: TestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
}

/**
 * Test Case 1: TCP Transport Implementation Exists
 */
async function testTCPTransportExists(): Promise<TestResult> {
  console.log("  🔍 Test: TCP Transport Implementation Exists")
  
  try {
    // Import the transport module
    const { TCPTransport } = await import("../../repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport")
    
    // Check if class exists
    if (!TCPTransport) {
      return {
        pass: false,
        actual: "TCPTransport not found",
        expected: "TCPTransport class exported",
        error: "TCPTransport class not exported from tcp-transport.ts"
      }
    }
    
    // Check if connect method exists
    const instance = new TCPTransport("localhost", 3000)
    if (typeof instance.connect !== "function") {
      return {
        pass: false,
        actual: "connect method not found",
        expected: "connect method exists",
        error: "TCPTransport.connect method not found"
      }
    }
    
    // Validate implementation has fetch-based HTTP connection
    const connectSource = instance.connect.toString()
    const hasFetchCall = connectSource.includes("fetch")
    
    if (!hasFetchCall) {
      return {
        pass: false,
        actual: "No fetch() implementation found",
        expected: "Full implementation with fetch()",
        error: "TCPTransport.connect should use fetch() for HTTP-based transport"
      }
    }
    
    return {
      pass: true,
      actual: "TCPTransport class with connect() method",
      expected: "TCPTransport class with connect() method",
      message: "✅ TCP transport implementation exists"
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "TCPTransport class loads successfully",
      error: `Failed to load TCPTransport: ${error}`
    }
  }
}

/**
 * Test Case 2: HTTP Server Has ACP Endpoint
 */
async function testACPEndpointExists(): Promise<TestResult> {
  console.log("  🔍 Test: HTTP Server Has POST /acp/stream Endpoint")
  
  try {
    // Start a test ACP server on a random port
    const { spawn } = await import("bun")
    const port = 18081 // Use different port to avoid conflicts
    
    const serverProcess = spawn({
      cmd: ["bun", "run", "repos/metabob-opencode/packages/opencode/dist/cli.js", "acp", "--port", String(port)],
      stdout: "pipe",
      stderr: "pipe",
    })
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    try {
      // Test if endpoint exists with a simple OPTIONS request
      const response = await fetch(`http://localhost:${port}/acp/stream`, {
        method: "OPTIONS",
      })
      
      // Even if OPTIONS returns 404, the endpoint might exist for POST
      // Try a POST with empty body
      const postResponse = await fetch(`http://localhost:${port}/acp/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-ndjson",
        },
        body: "",
      })
      
      // If we get back anything other than 404, endpoint exists
      const endpointExists = postResponse.status !== 404
      
      serverProcess.kill()
      
      if (!endpointExists) {
        return {
          pass: false,
          actual: `HTTP ${postResponse.status} (endpoint not found)`,
          expected: "POST /acp/stream endpoint exists",
          error: "Server does not have /acp/stream endpoint"
        }
      }
      
      return {
        pass: true,
        actual: `HTTP ${postResponse.status} (endpoint exists)`,
        expected: "POST /acp/stream endpoint exists",
        message: "✅ ACP stream endpoint exists"
      }
    } finally {
      serverProcess.kill()
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Server starts and has /acp/stream endpoint",
      error: `Failed to test endpoint: ${error}`
    }
  }
}

/**
 * Test Case 3: TCP Transport Connects to Local Server
 */
async function testTCPTransportConnects(): Promise<TestResult> {
  console.log("  🔍 Test: TCP Transport Connects to Local Server")
  
  try {
    const { spawn } = await import("bun")
    const port = 18082
    
    // Start ACP server
    const serverProcess = spawn({
      cmd: ["bun", "run", "repos/metabob-opencode/packages/opencode/dist/cli.js", "acp", "--port", String(port)],
      stdout: "pipe",
      stderr: "pipe",
    })
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    try {
      const { TCPTransport } = await import("../../repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport")
      const transport = new TCPTransport("localhost", port)
      
      // Try to connect
      const { stdin, stdout } = await transport.connect()
      
      // Verify we got streams
      if (!stdin || !stdout) {
        return {
          pass: false,
          actual: { stdin: !!stdin, stdout: !!stdout },
          expected: { stdin: true, stdout: true },
          error: "Transport connect did not return valid streams"
        }
      }
      
      // Clean up
      await transport.close()
      serverProcess.kill()
      
      return {
        pass: true,
        actual: "Connected successfully with stdin/stdout streams",
        expected: "TCP transport connects and returns streams",
        message: "✅ TCP transport connects to local server"
      }
    } catch (error) {
      serverProcess.kill()
      throw error
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "TCP transport connects successfully",
      error: `Connection failed: ${error}`
    }
  }
}

/**
 * Test Case 4: End-to-End TCP Delegation
 */
async function testEndToEndDelegation(): Promise<TestResult> {
  console.log("  🔍 Test: End-to-End TCP Delegation")
  
  try {
    const { spawn } = await import("bun")
    const port = 18083
    
    // Start ACP server
    const serverProcess = spawn({
      cmd: ["bun", "run", "repos/metabob-opencode/packages/opencode/dist/cli.js", "acp", "--port", String(port), "--cwd", process.cwd()],
      stdout: "pipe",
      stderr: "pipe",
    })
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    try {
      // Import acp_delegate tool
      const { ACPDelegateTool } = await import("../../repos/metabob-opencode/packages/opencode/src/tool/acp-delegate")
      
      // Execute delegation with simple prompt
      const result = await ACPDelegateTool.execute({
        target: `tcp://localhost:${port}`,
        taskDescription: "Test TCP delegation",
        prompt: "Echo back the text: TCP_TRANSPORT_WORKS",
        shareImpulses: [],
        timeout: 30,
        sendFullContent: false,
      })
      
      // Check if we got a response
      if (!result || !result.response) {
        return {
          pass: false,
          actual: result,
          expected: "Response with content",
          error: "No response received from remote agent"
        }
      }
      
      // Check if response contains expected text or any indication of success
      const responseText = result.response
      const hasContent = responseText && responseText.length > 0
      
      serverProcess.kill()
      
      if (!hasContent) {
        return {
          pass: false,
          actual: responseText,
          expected: "Non-empty response",
          error: "Response is empty"
        }
      }
      
      return {
        pass: true,
        actual: `Received response: ${responseText.substring(0, 100)}...`,
        expected: "Valid response from remote agent",
        message: "✅ End-to-end delegation works"
      }
    } catch (error) {
      serverProcess.kill()
      throw error
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Successful delegation with response",
      error: `Delegation failed: ${error}`
    }
  }
}

/**
 * Test Case 5: Connection Cleanup
 */
async function testConnectionCleanup(): Promise<TestResult> {
  console.log("  🔍 Test: Connection Cleanup")
  
  try {
    const { spawn } = await import("bun")
    const port = 18084
    
    // Start ACP server
    const serverProcess = spawn({
      cmd: ["bun", "run", "repos/metabob-opencode/packages/opencode/dist/cli.js", "acp", "--port", String(port)],
      stdout: "pipe",
      stderr: "pipe",
    })
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    try {
      const { TCPTransport } = await import("../../repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport")
      const transport = new TCPTransport("localhost", port)
      
      await transport.connect()
      
      // Close should not throw
      await transport.close()
      
      serverProcess.kill()
      
      return {
        pass: true,
        actual: "Connection closed without error",
        expected: "Clean connection shutdown",
        message: "✅ Connection cleanup works"
      }
    } catch (error) {
      serverProcess.kill()
      throw error
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Clean connection shutdown",
      error: `Cleanup failed: ${error}`
    }
  }
}

/**
 * Test Case 6: Error Handling for Invalid Host
 */
async function testErrorHandling(): Promise<TestResult> {
  console.log("  🔍 Test: Error Handling for Invalid Connection")
  
  try {
    const { TCPTransport } = await import("../../repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport")
    const transport = new TCPTransport("invalid-host-that-does-not-exist", 9999)
    
    try {
      await transport.connect()
      
      // If we get here, error handling didn't work
      return {
        pass: false,
        actual: "Connection succeeded (unexpected)",
        expected: "Connection should fail with error",
        error: "Connection to invalid host should have failed"
      }
    } catch (error) {
      // Expected to throw
      return {
        pass: true,
        actual: "Connection failed with error (expected)",
        expected: "Connection failure handled gracefully",
        message: "✅ Error handling works"
      }
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Error handling test runs",
      error: `Test setup failed: ${error}`
    }
  }
}

/**
 * Run all validation tests
 */
export async function runValidation(): Promise<ValidationSummary> {
  console.log("🧪 ACP Network Transport Implementation Validation")
  console.log("=".repeat(60))
  
  const results: TestResult[] = []
  
  // Test 1: Implementation exists
  console.log("\n📦 Phase 1: Implementation Verification")
  results.push(await testTCPTransportExists())
  results.push(await testACPEndpointExists())
  
  // Test 2: Connection tests
  console.log("\n🔌 Phase 2: Connection Tests")
  results.push(await testTCPTransportConnects())
  
  // Test 3: End-to-end tests
  console.log("\n🚀 Phase 3: End-to-End Tests")
  results.push(await testEndToEndDelegation())
  
  // Test 4: Reliability tests
  console.log("\n🛡️ Phase 4: Reliability Tests")
  results.push(await testConnectionCleanup())
  results.push(await testErrorHandling())
  
  // Calculate summary
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  const skipped = results.filter(r => r.message?.includes("SKIP")).length
  
  const summary = {
    total: results.length,
    passed,
    failed,
    skipped
  }
  
  console.log("\n" + "=".repeat(60))
  console.log(`📊 Summary: ${passed}/${results.length} tests passed`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  
  const allPassed = failed === 0
  
  if (allPassed) {
    console.log("\n🎉 All tests passed! TCP transport implementation is working.")
  } else {
    console.log("\n⚠️  Some tests failed. Review results above.")
    
    // Print failed test details
    results.filter(r => !r.pass).forEach(r => {
      console.log(`\n❌ Failed: ${r.error}`)
      console.log(`   Expected: ${JSON.stringify(r.expected)}`)
      console.log(`   Actual: ${JSON.stringify(r.actual)}`)
    })
  }
  
  return {
    pass: allPassed,
    results,
    summary
  }
}

/**
 * Run validation with specific input (for impulse-based testing)
 */
export function runValidationWithInput(input: any): Promise<TestResult> {
  // For this harness, we run the full suite
  // Individual test cases can be accessed via the specific test functions
  return runValidation().then(summary => ({
    pass: summary.pass,
    actual: summary.results,
    expected: "All tests pass",
    message: summary.pass ? "All validation tests passed" : "Some validation tests failed"
  }))
}

// CLI runner
if (import.meta.main) {
  runValidation().then(summary => {
    process.exit(summary.pass ? 0 : 1)
  })
}
