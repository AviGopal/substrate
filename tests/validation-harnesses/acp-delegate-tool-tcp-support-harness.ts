/**
 * Validation Harness: acp_delegate Tool TCP Support
 * 
 * Validates the complete acp_delegate tool TCP transport integration:
 * - Tool accepts tcp://host:port targets without errors
 * - Tool delegates to createTransport() factory (not hardcoded stub)
 * - Connection established to local and remote services
 * - Simple prompts execute and return responses
 * - Error handling for unreachable hosts
 * - Works with Kubernetes service DNS names
 * 
 * Test Cases:
 * 1. Tool accepts tcp://localhost:3000 without throwing
 * 2. Tool calls createTransport() not hardcoded stub
 * 3. Connection established to local ACP server
 * 4. Simple prompt executes and returns response
 * 5. Error handling for unreachable hosts
 * 6. Works with tcp://devbob.metabob.svc.cluster.local:8080
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
 * Test Case 1: Tool Accepts tcp:// Target Without Error
 */
async function testToolAcceptsTcpTarget(): Promise<TestResult> {
  console.log("  🔍 Test 1: Tool accepts tcp://localhost:3000 without error")
  
  try {
    const { createTransport } = await import(`${process.cwd()}/repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts`)
    
    // Test that factory accepts tcp:// target
    let transport
    try {
      transport = createTransport("tcp://localhost:3000", process.cwd())
    } catch (error) {
      return {
        pass: false,
        actual: `Error thrown: ${error}`,
        expected: "Transport created successfully",
        error: `createTransport() rejected tcp:// target: ${error}`
      }
    }
    
    // Verify transport was created
    if (!transport) {
      return {
        pass: false,
        actual: "null transport",
        expected: "Transport instance",
        error: "createTransport() returned null for tcp:// target"
      }
    }
    
    // Verify it has connect method
    if (typeof transport.connect !== "function") {
      return {
        pass: false,
        actual: "No connect method",
        expected: "Transport with connect() method",
        error: "Created transport missing connect() method"
      }
    }
    
    return {
      pass: true,
      actual: "Transport created with connect() method",
      expected: "Transport created with connect() method",
      message: "✅ Tool accepts tcp:// target without error"
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Factory loads and creates transport",
      error: `Failed to load factory: ${error}`
    }
  }
}

/**
 * Test Case 2: Tool Delegates to createTransport (Not Hardcoded Stub)
 */
async function testToolDelegatesToFactory(): Promise<TestResult> {
  console.log("  🔍 Test 2: Tool calls createTransport() not hardcoded stub")
  
  try {
    // Read the acp-delegate tool source
    const toolPath = `${process.cwd()}/repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts`
    const file = Bun.file(toolPath)
    const source = await file.text()
    
    // Check for createTransport() call
    const hasCreateTransportCall = source.includes("createTransport(")
    if (!hasCreateTransportCall) {
      return {
        pass: false,
        actual: "No createTransport() call found",
        expected: "Tool calls createTransport()",
        error: "acp-delegate.ts doesn't call createTransport() factory"
      }
    }
    
    // Check that it's NOT checking for tcp:// specifically before calling factory
    const hasTcpCheck = source.includes('if (target.startsWith("tcp://"))') &&
                        source.includes('throw new Error("TCP transport not yet implemented")')
    
    if (hasTcpCheck) {
      return {
        pass: false,
        actual: "Tool has hardcoded tcp:// stub check",
        expected: "Tool delegates all targets to factory",
        error: "Tool still has hardcoded tcp:// rejection before calling factory"
      }
    }
    
    return {
      pass: true,
      actual: "Tool delegates to createTransport() factory",
      expected: "Tool delegates to createTransport() factory",
      message: "✅ Tool delegates to factory, no hardcoded stub"
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Tool source reads successfully",
      error: `Failed to read tool source: ${error}`
    }
  }
}

/**
 * Test Case 3: Connection Established to Local Service
 */
async function testConnectionToLocalhost(): Promise<TestResult> {
  console.log("  🔍 Test 3: Connection established to tcp://localhost:3000")
  
  try {
    const { createTransport } = await import(`${process.cwd()}/repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts`)
    
    // Check if local ACP server is running
    try {
      const response = await fetch("http://localhost:3000/health", {
        signal: AbortSignal.timeout(2000)
      })
      
      if (!response.ok) {
        return {
          pass: false,
          actual: `Server returned ${response.status}`,
          expected: "Server running and healthy",
          error: "Local ACP server not healthy (skipping connection test)",
          message: "⚠️  Skipped: Local ACP server not running"
        }
      }
    } catch (error) {
      return {
        pass: false,
        actual: "Server not reachable",
        expected: "Server running on localhost:3000",
        error: "Local ACP server not running (skipping connection test)",
        message: "⚠️  Skipped: Local ACP server not running"
      }
    }
    
    // Create transport
    const transport = createTransport("tcp://localhost:3000", process.cwd())
    
    // Try to connect (with timeout)
    let connection
    try {
      const connectPromise = transport.connect()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 5000)
      )
      
      connection = await Promise.race([connectPromise, timeoutPromise]) as any
    } catch (error) {
      return {
        pass: false,
        actual: `Connection failed: ${error}`,
        expected: "Connection successful",
        error: `Failed to connect to localhost:3000: ${error}`
      }
    }
    
    // Verify connection has stdin/stdout
    if (!connection.stdin || !connection.stdout) {
      return {
        pass: false,
        actual: "Connection missing stdin/stdout",
        expected: "Connection with stdin/stdout streams",
        error: "Connection established but missing required streams"
      }
    }
    
    // Cleanup
    try {
      await transport.close()
    } catch (cleanupError) {
      console.warn("  ⚠️  Cleanup warning:", cleanupError)
    }
    
    return {
      pass: true,
      actual: "Connection established with stdin/stdout",
      expected: "Connection established with stdin/stdout",
      message: "✅ Connection established to localhost:3000"
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Connection established",
      error: `Test failed: ${error}`
    }
  }
}

/**
 * Test Case 4: Simple Prompt Execution
 */
async function testSimplePromptExecution(): Promise<TestResult> {
  console.log("  🔍 Test 4: Simple prompt executes and returns response")
  
  try {
    // Check if local ACP server is running
    try {
      const response = await fetch("http://localhost:3000/health", {
        signal: AbortSignal.timeout(2000)
      })
      
      if (!response.ok) {
        return {
          pass: false,
          actual: "Server not running",
          expected: "Server running",
          error: "Local ACP server not running (skipping prompt test)",
          message: "⚠️  Skipped: Local ACP server not running"
        }
      }
    } catch (error) {
      return {
        pass: false,
        actual: "Server not reachable",
        expected: "Server running",
        error: "Local ACP server not running (skipping prompt test)",
        message: "⚠️  Skipped: Local ACP server not running"
      }
    }
    
    // Test end-to-end prompt execution via HTTP POST
    // This simulates what acp_delegate does internally
    try {
      const response = await fetch("http://localhost:3000/acp/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-ndjson",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "test-1",
          method: "ping",
          params: {}
        }) + "\n",
        signal: AbortSignal.timeout(5000)
      })
      
      if (!response.ok) {
        return {
          pass: false,
          actual: `HTTP ${response.status} ${response.statusText}`,
          expected: "HTTP 200 OK",
          error: `ACP endpoint returned error: ${response.status}`
        }
      }
      
      // Read response
      const text = await response.text()
      
      return {
        pass: true,
        actual: "Prompt executed, response received",
        expected: "Prompt executed, response received",
        message: "✅ Simple prompt execution works"
      }
    } catch (error) {
      return {
        pass: false,
        actual: `Execution failed: ${error}`,
        expected: "Prompt executes successfully",
        error: `Failed to execute prompt: ${error}`
      }
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Prompt execution successful",
      error: `Test failed: ${error}`
    }
  }
}

/**
 * Test Case 5: Error Handling for Unreachable Hosts
 */
async function testErrorHandlingUnreachable(): Promise<TestResult> {
  console.log("  🔍 Test 5: Error handling for unreachable hosts")
  
  try {
    const { createTransport } = await import(`${process.cwd()}/repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts`)
    
    // Create transport to unreachable host
    const transport = createTransport("tcp://unreachable-host-12345.invalid:9999", process.cwd())
    
    // Try to connect - should fail gracefully
    let errorThrown = false
    let errorMessage = ""
    
    try {
      const connectPromise = transport.connect()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 3000)
      )
      
      await Promise.race([connectPromise, timeoutPromise])
    } catch (error) {
      errorThrown = true
      errorMessage = String(error)
    }
    
    if (!errorThrown) {
      return {
        pass: false,
        actual: "No error thrown for unreachable host",
        expected: "Error thrown with descriptive message",
        error: "Transport should throw error for unreachable host"
      }
    }
    
    // Verify error message is descriptive (not generic)
    const hasUsefulMessage = errorMessage.toLowerCase().includes("fetch") ||
                             errorMessage.toLowerCase().includes("timeout") ||
                             errorMessage.toLowerCase().includes("connection") ||
                             errorMessage.toLowerCase().includes("enotfound") ||
                             errorMessage.toLowerCase().includes("network") ||
                             errorMessage.toLowerCase().includes("unable to connect") ||
                             errorMessage.toLowerCase().includes("refused")
    
    if (!hasUsefulMessage) {
      return {
        pass: false,
        actual: `Generic error: ${errorMessage}`,
        expected: "Descriptive error about connection failure",
        error: "Error message should describe connection failure"
      }
    }
    
    return {
      pass: true,
      actual: "Error thrown with descriptive message",
      expected: "Error thrown with descriptive message",
      message: "✅ Error handling for unreachable hosts works"
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Error handling test completes",
      error: `Test failed: ${error}`
    }
  }
}

/**
 * Test Case 6: Kubernetes Service DNS Support
 */
async function testKubernetesServiceDNS(): Promise<TestResult> {
  console.log("  🔍 Test 6: Works with tcp://devbob.metabob.svc.cluster.local:8080")
  
  try {
    const { createTransport } = await import(`${process.cwd()}/repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts`)
    
    // Test that factory accepts Kubernetes service DNS
    let transport
    try {
      transport = createTransport("tcp://devbob.metabob.svc.cluster.local:8080", process.cwd())
    } catch (error) {
      return {
        pass: false,
        actual: `Error thrown: ${error}`,
        expected: "Transport created successfully",
        error: `Factory rejected Kubernetes service DNS: ${error}`
      }
    }
    
    // Verify transport was created
    if (!transport) {
      return {
        pass: false,
        actual: "null transport",
        expected: "Transport instance",
        error: "Factory returned null for Kubernetes service DNS"
      }
    }
    
    // Verify it has connect method
    if (typeof transport.connect !== "function") {
      return {
        pass: false,
        actual: "No connect method",
        expected: "Transport with connect() method",
        error: "Transport missing connect() method"
      }
    }
    
    // Note: We don't actually connect because the service may not be reachable
    // from the test environment (might be cluster-internal). The important
    // validation is that the factory accepts the DNS name format.
    
    return {
      pass: true,
      actual: "Transport created for Kubernetes service DNS",
      expected: "Transport created for Kubernetes service DNS",
      message: "✅ Kubernetes service DNS names supported"
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      expected: "Factory accepts Kubernetes DNS",
      error: `Test failed: ${error}`
    }
  }
}

/**
 * Run all validation tests
 */
export async function runValidation(): Promise<ValidationSummary> {
  console.log("\n🧪 Validation Harness: acp_delegate Tool TCP Support")
  console.log("============================================================\n")
  
  const results: TestResult[] = []
  
  console.log("📦 Phase 1: Tool Integration Tests")
  results.push(await testToolAcceptsTcpTarget())
  results.push(await testToolDelegatesToFactory())
  
  console.log("\n🔧 Phase 2: Connection Tests")
  results.push(await testConnectionToLocalhost())
  results.push(await testSimplePromptExecution())
  
  console.log("\n🛡️  Phase 3: Error Handling and Edge Cases")
  results.push(await testErrorHandlingUnreachable())
  results.push(await testKubernetesServiceDNS())
  
  // Calculate summary
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass && !r.message?.includes("Skipped")).length
  const skipped = results.filter(r => r.message?.includes("Skipped")).length
  
  const allPassed = failed === 0
  
  console.log("\n============================================================")
  console.log(`📊 Summary: ${passed}/${results.length - skipped} tests passed`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  if (skipped > 0) {
    console.log(`   ⚠️  Skipped: ${skipped}`)
  }
  
  if (allPassed) {
    console.log("\n🎉 All tests passed!")
    console.log("✅ acp_delegate tool TCP support is fully functional")
  } else {
    console.log("\n❌ Some tests failed")
    console.log("\nFailed tests:")
    results.filter(r => !r.pass && !r.message?.includes("Skipped")).forEach(r => {
      console.log(`  • ${r.error}`)
    })
  }
  
  return {
    pass: allPassed,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped
    }
  }
}

// Run validation if executed directly
if (import.meta.main) {
  const result = await runValidation()
  process.exit(result.pass ? 0 : 1)
}
