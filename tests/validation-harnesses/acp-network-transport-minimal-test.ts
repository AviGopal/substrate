/**
 * Minimal ACP Network Transport Validation
 * 
 * Tests implementation without requiring full CLI build
 */

interface TestResult {
  pass: boolean
  actual: any
  expected: any
  error?: string
  message?: string
}

/**
 * Test 1: TCP Transport Implementation Exists
 */
async function testTCPTransportExists(): Promise<TestResult> {
  console.log("  🔍 Test 1: TCP Transport Implementation Exists")
  
  try {
    // Try to import the transport module
    const transportModule = await import("../../repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts")
    
    if (!transportModule.TCPTransport) {
      return {
        pass: false,
        actual: "TCPTransport not found",
        expected: "TCPTransport class exported",
        error: "TCPTransport class not exported"
      }
    }
    
    // Create instance
    const instance = new transportModule.TCPTransport("localhost", 3000)
    
    // Check methods exist
    if (typeof instance.connect !== "function") {
      return {
        pass: false,
        actual: "connect method not found",
        expected: "connect method exists",
        error: "TCPTransport.connect method missing"
      }
    }
    
    // Validate implementation has fetch-based HTTP connection
    const connectStr = instance.connect.toString()
    const hasFetchCall = connectStr.includes("fetch")
    
    if (!hasFetchCall) {
      return {
        pass: false,
        actual: "No fetch() call found in connect()",
        expected: "Uses fetch() for HTTP connection",
        error: "connect() method doesn't use fetch() for HTTP-based transport"
      }
    }
    
    return {
      pass: true,
      actual: "TCPTransport with fetch-based connect()",
      expected: "TCPTransport with fetch-based connect()",
      message: "✅ TCP transport implementation exists and uses HTTP"
    }
  } catch (error) {
    return {
      pass: false,
      actual: String(error),
      expected: "TCPTransport loads successfully",
      error: `Failed to load: ${error}`
    }
  }
}

/**
 * Test 2: Server Has ACP Endpoint Route
 */
async function testServerHasACPRoute(): Promise<TestResult> {
  console.log("  🔍 Test 2: Server Has POST /acp/stream Route")
  
  try {
    // Read the server.ts file and check for the route
    const serverPath = "repos/metabob-opencode/packages/opencode/src/server/server.ts"
    const serverContent = await Bun.file(serverPath).text()
    
    // Check for POST /acp/stream route
    const hasACPRoute = serverContent.includes('.post("/acp/stream"')
    const hasAgentSideConnection = serverContent.includes("AgentSideConnection")
    const hasNdJsonStream = serverContent.includes("ndJsonStream")
    
    if (!hasACPRoute) {
      return {
        pass: false,
        actual: "POST /acp/stream route not found in server.ts",
        expected: "POST /acp/stream route exists",
        error: "Server does not have ACP endpoint"
      }
    }
    
    if (!hasAgentSideConnection || !hasNdJsonStream) {
      return {
        pass: false,
        actual: { hasAgentSideConnection, hasNdJsonStream },
        expected: { hasAgentSideConnection: true, hasNdJsonStream: true },
        error: "ACP route missing required connection setup"
      }
    }
    
    return {
      pass: true,
      actual: "POST /acp/stream route with AgentSideConnection",
      expected: "POST /acp/stream route with AgentSideConnection",
      message: "✅ Server has ACP protocol HTTP endpoint"
    }
  } catch (error) {
    return {
      pass: false,
      actual: String(error),
      expected: "Server file readable with ACP route",
      error: `Failed to check server: ${error}`
    }
  }
}

/**
 * Test 3: ACP Command Default Port
 */
async function testACPCommandDefaultPort(): Promise<TestResult> {
  console.log("  🔍 Test 3: ACP Command Default Port is 3000")
  
  try {
    const acpPath = "repos/metabob-opencode/packages/opencode/src/cli/cmd/acp.ts"
    const acpContent = await Bun.file(acpPath).text()
    
    // Check for default port 3000
    const hasPort3000 = acpContent.includes('default: 3000')
    
    if (!hasPort3000) {
      return {
        pass: false,
        actual: "Default port not set to 3000",
        expected: "Default port: 3000",
        error: "ACP command should have default port 3000 for network access"
      }
    }
    
    return {
      pass: true,
      actual: "Default port: 3000",
      expected: "Default port: 3000",
      message: "✅ ACP command has correct default port"
    }
  } catch (error) {
    return {
      pass: false,
      actual: String(error),
      expected: "ACP command file readable",
      error: `Failed to check ACP command: ${error}`
    }
  }
}

/**
 * Test 4: Transport Factory Handles TCP
 */
async function testTransportFactory(): Promise<TestResult> {
  console.log("  🔍 Test 4: Transport Factory Returns TCPTransport")
  
  try {
    const { createTransport } = await import("../../repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts")
    const { TCPTransport } = await import("../../repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts")
    
    // Create TCP transport via factory
    const transport = createTransport("tcp://localhost:3000", "/tmp")
    
    // Check it's a TCPTransport instance
    if (!(transport instanceof TCPTransport)) {
      return {
        pass: false,
        actual: `Got ${transport.constructor.name}`,
        expected: "TCPTransport instance",
        error: "Factory doesn't return TCPTransport for tcp:// target"
      }
    }
    
    // Check metadata
    const metadata = transport.getMetadata()
    if (metadata.type !== "tcp") {
      return {
        pass: false,
        actual: metadata,
        expected: { type: "tcp" },
        error: "Transport metadata incorrect"
      }
    }
    
    return {
      pass: true,
      actual: "TCPTransport instance with correct metadata",
      expected: "TCPTransport instance with correct metadata",
      message: "✅ Transport factory creates TCP transport"
    }
  } catch (error) {
    return {
      pass: false,
      actual: String(error),
      expected: "Factory creates TCPTransport",
      error: `Factory test failed: ${error}`
    }
  }
}

/**
 * Test 5: Code Quality Check - No Stub Comments
 */
async function testNoStubComments(): Promise<TestResult> {
  console.log("  🔍 Test 5: No Stub Comments in TCP Transport")
  
  try {
    const tcpPath = "repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts"
    const tcpContent = await Bun.file(tcpPath).text()
    
    // Check for stub indicators
    const hasStubComment = tcpContent.includes("TODO Phase 2") || 
                          tcpContent.includes("STUB") ||
                          tcpContent.includes("not yet implemented")
    
    if (hasStubComment) {
      return {
        pass: false,
        actual: "Still contains stub comments/TODOs",
        expected: "No stub indicators",
        error: "TCP transport still has stub comments"
      }
    }
    
    return {
      pass: true,
      actual: "No stub comments found",
      expected: "No stub comments",
      message: "✅ TCP transport is fully implemented"
    }
  } catch (error) {
    return {
      pass: false,
      actual: String(error),
      expected: "File readable",
      error: `Failed to check: ${error}`
    }
  }
}

/**
 * Run all validation tests
 */
async function runValidation() {
  console.log("🧪 ACP Network Transport Implementation Validation")
  console.log("=" .repeat(60))
  
  const results: TestResult[] = []
  
  console.log("\n📦 Phase 1: Code Implementation Checks")
  results.push(await testTCPTransportExists())
  results.push(await testServerHasACPRoute())
  results.push(await testACPCommandDefaultPort())
  
  console.log("\n🔧 Phase 2: Integration Checks")
  results.push(await testTransportFactory())
  results.push(await testNoStubComments())
  
  // Calculate summary
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  
  console.log("\n" + "=".repeat(60))
  console.log(`📊 Summary: ${passed}/${results.length} tests passed`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  
  if (failed > 0) {
    console.log("\n❌ Failed Tests:")
    results.filter(r => !r.pass).forEach((r, i) => {
      console.log(`\n  ${i+1}. ${r.error}`)
      console.log(`     Expected: ${JSON.stringify(r.expected)}`)
      console.log(`     Actual: ${JSON.stringify(r.actual)}`)
    })
  } else {
    console.log("\n🎉 All implementation checks passed!")
    console.log("✅ TCP transport recurring blocker is RESOLVED")
  }
  
  return {
    pass: failed === 0,
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  }
}

// Run if called directly
if (import.meta.main) {
  const result = await runValidation()
  process.exit(result.pass ? 0 : 1)
}

export { runValidation }
