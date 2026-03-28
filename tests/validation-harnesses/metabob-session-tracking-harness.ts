/**
 * Validation Harness: metabob-session-tracking
 * 
 * Tests Specification 2 (Session Lifecycle Tracking) implementation:
 * - Session.createNext() calls MetabobTracking.recordSessionStart()
 * - Session.close() aggregates stats and calls MetabobTracking.recordSessionComplete()
 * - Tracking failures don't break session lifecycle
 * - Payloads contain correct data (sessionId, agentType, stats, git context)
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test"

export interface ValidationResult {
  pass: boolean
  testCase: string
  actual: any
  expected: any
  error?: string
}

export interface ValidationReport {
  totalTests: number
  passed: number
  failed: number
  results: ValidationResult[]
}

/**
 * Mock MCP client for testing tracking calls
 */
class MockMCPClient {
  public calls: Array<{ name: string; arguments: any }> = []

  async callTool(params: { name: string; arguments: any }) {
    this.calls.push(params)
    return {
      content: [{ type: "text" as const, text: "OK" }],
    }
  }

  async listTools() {
    return {
      tools: [
        { name: "metabob_record_session_start", inputSchema: {} },
        { name: "metabob_record_session_complete", inputSchema: {} },
      ],
    }
  }

  reset() {
    this.calls = []
  }

  getCallsByTool(toolName: string) {
    return this.calls.filter((call) => call.name === toolName)
  }
}

/**
 * Run validation harness
 */
export async function runValidation(): Promise<ValidationReport> {
  // Dynamically import Session and related modules
  const { Session } = await import("../../repos/metabob-opencode/packages/opencode/src/session/index")
  const { Instance } = await import("../../repos/metabob-opencode/packages/opencode/src/project/instance")
  const { MCP } = await import("../../repos/metabob-opencode/packages/opencode/src/mcp/index")

  // Run tests within Instance.provide() context
  return await Instance.provide({
    directory: process.cwd(),
    fn: async () => {
      const results: ValidationResult[] = []

      // Create mock MCP client
      const mockClient = new MockMCPClient()

      // Mock MCP.clients() to return our mock client
      const originalClients = MCP.clients
      MCP.clients = async () => ({ metabob: mockClient as any })

      try {
        // Test Case 1: Session.createNext() calls recordSessionStart
        {
          const testCase = "Session.createNext() triggers metabob_record_session_start"
          try {
            mockClient.reset()

            const session = await Session.createNext({
              directory: process.cwd(),
              title: "Test Session",
              activityId: "test-activity",
            })

            // Wait for async tracking call to complete
            await new Promise((resolve) => setTimeout(resolve, 200))

            const startCalls = mockClient.getCallsByTool("metabob_record_session_start")

            const expected = {
              callCount: 1,
              hasSessionId: true,
              hasAgentType: true,
              hasTimestamp: true,
              hasWorkingDirectory: true,
            }

            const actual = {
              callCount: startCalls.length,
              hasSessionId: startCalls.length > 0 && !!startCalls[0].arguments.sessionId,
              hasAgentType: startCalls.length > 0 && !!startCalls[0].arguments.agentType,
              hasTimestamp: startCalls.length > 0 && !!startCalls[0].arguments.timestamp,
              hasWorkingDirectory:
                startCalls.length > 0 && !!startCalls[0].arguments.context?.workingDirectory,
            }

            const pass =
              actual.callCount === expected.callCount &&
              actual.hasSessionId &&
              actual.hasAgentType &&
              actual.hasTimestamp &&
              actual.hasWorkingDirectory

            results.push({
              pass,
              testCase,
              actual,
              expected,
            })

            // Cleanup
            await Session.remove(session.id)
          } catch (error) {
            results.push({
              pass: false,
              testCase,
              actual: null,
              expected: null,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        // Test Case 2: Session.close() calls recordSessionComplete with stats
        {
          const testCase = "Session.close() triggers metabob_record_session_complete with stats"
          try {
            mockClient.reset()

            const session = await Session.createNext({
              directory: process.cwd(),
              title: "Test Session 2",
            })

            // Wait for start tracking
            await new Promise((resolve) => setTimeout(resolve, 200))
            mockClient.reset() // Clear start calls

            // Close session
            await Session.close({ sessionID: session.id, outcome: "completed" })

            // Wait for async tracking call
            await new Promise((resolve) => setTimeout(resolve, 200))

            const completeCalls = mockClient.getCallsByTool("metabob_record_session_complete")

            const expected = {
              callCount: 1,
              hasSessionId: true,
              hasTimestamp: true,
              hasSummary: true,
              hasOutcome: true,
            }

            const actual = {
              callCount: completeCalls.length,
              hasSessionId: completeCalls.length > 0 && !!completeCalls[0].arguments.sessionId,
              hasTimestamp: completeCalls.length > 0 && !!completeCalls[0].arguments.timestamp,
              hasSummary: completeCalls.length > 0 && !!completeCalls[0].arguments.summary,
              hasOutcome: completeCalls.length > 0 && !!completeCalls[0].arguments.outcome,
            }

            const pass =
              actual.callCount === expected.callCount &&
              actual.hasSessionId &&
              actual.hasTimestamp &&
              actual.hasSummary &&
              actual.hasOutcome

            results.push({
              pass,
              testCase,
              actual,
              expected,
            })

            // Cleanup
            await Session.remove(session.id)
          } catch (error) {
            results.push({
              pass: false,
              testCase,
              actual: null,
              expected: null,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        // Test Case 3: Agent type defaults to "general" when no activityId
        {
          const testCase = "Agent type defaults to 'general' when no activityId provided"
          try {
            mockClient.reset()

            const session = await Session.createNext({
              directory: process.cwd(),
              title: "Test Session 3",
            })

            // Wait for tracking
            await new Promise((resolve) => setTimeout(resolve, 200))

            const startCalls = mockClient.getCallsByTool("metabob_record_session_start")

            const expected = {
              agentType: "general",
            }

            const actual = {
              agentType: startCalls.length > 0 ? startCalls[0].arguments.agentType : null,
            }

            const pass = actual.agentType === expected.agentType

            results.push({
              pass,
              testCase,
              actual,
              expected,
            })

            // Cleanup
            await Session.remove(session.id)
          } catch (error) {
            results.push({
              pass: false,
              testCase,
              actual: null,
              expected: null,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        // Test Case 4: Agent type uses activityId when provided
        {
          const testCase = "Agent type uses activityId when provided"
          try {
            mockClient.reset()

            const session = await Session.createNext({
              directory: process.cwd(),
              title: "Test Session 4",
              activityId: "custom-activity-123",
            })

            // Wait for tracking
            await new Promise((resolve) => setTimeout(resolve, 200))

            const startCalls = mockClient.getCallsByTool("metabob_record_session_start")

            const expected = {
              agentType: "custom-activity-123",
            }

            const actual = {
              agentType: startCalls.length > 0 ? startCalls[0].arguments.agentType : null,
            }

            const pass = actual.agentType === expected.agentType

            results.push({
              pass,
              testCase,
              actual,
              expected,
            })

            // Cleanup
            await Session.remove(session.id)
          } catch (error) {
            results.push({
              pass: false,
              testCase,
              actual: null,
              expected: null,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        // Test Case 5: Tracking failure doesn't break session creation
        {
          const testCase = "Session creation succeeds even if MCP tracking fails"
          try {
            // Mock MCP failure
            const failingClient = {
              callTool: async () => {
                throw new Error("MCP connection failed")
              },
              listTools: async () => ({ tools: [] }),
            }

            MCP.clients = async () => ({ metabob: failingClient as any })

            const session = await Session.createNext({
              directory: process.cwd(),
              title: "Test Session 5",
            })

            // Wait to ensure tracking was attempted
            await new Promise((resolve) => setTimeout(resolve, 200))

            const expected = {
              sessionCreated: true,
            }

            const actual = {
              sessionCreated: !!session && !!session.id,
            }

            const pass = actual.sessionCreated === expected.sessionCreated

            results.push({
              pass,
              testCase,
              actual,
              expected,
            })

            // Cleanup
            await Session.remove(session.id)

            // Restore mock client
            MCP.clients = async () => ({ metabob: mockClient as any })
          } catch (error) {
            results.push({
              pass: false,
              testCase,
              actual: null,
              expected: null,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        // Test Case 6: Session.close() returns success even if tracking fails
        {
          const testCase = "Session.close() succeeds even if MCP tracking fails"
          try {
            // First create session with working client
            MCP.clients = async () => ({ metabob: mockClient as any })
            const session = await Session.createNext({
              directory: process.cwd(),
              title: "Test Session 6",
            })
            await new Promise((resolve) => setTimeout(resolve, 200))

            // Then mock MCP failure for close
            const failingClient = {
              callTool: async () => {
                throw new Error("MCP connection failed")
              },
              listTools: async () => ({ tools: [] }),
            }

            MCP.clients = async () => ({ metabob: failingClient as any })

            const closeResult = await Session.close({ sessionID: session.id, outcome: "completed" })

            // Wait to ensure tracking was attempted
            await new Promise((resolve) => setTimeout(resolve, 200))

            const expected = {
              closeSucceeded: true,
            }

            const actual = {
              closeSucceeded: closeResult === true,
            }

            const pass = actual.closeSucceeded === expected.closeSucceeded

            results.push({
              pass,
              testCase,
              actual,
              expected,
            })

            // Cleanup
            await Session.remove(session.id)

            // Restore mock client
            MCP.clients = async () => ({ metabob: mockClient as any })
          } catch (error) {
            results.push({
              pass: false,
              testCase,
              actual: null,
              expected: null,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      } finally {
        // Restore original MCP.clients
        MCP.clients = originalClients
      }

      const passed = results.filter((r) => r.pass).length
      const failed = results.filter((r) => !r.pass).length

      return {
        totalTests: results.length,
        passed,
        failed,
        results,
      }
    },
  })
}

/**
 * Run validation and print results
 */
export async function main() {
  console.log("🧪 Running validation harness: metabob-session-tracking\n")

  const report = await runValidation()

  console.log(`\n📊 Validation Results:`)
  console.log(`   Total Tests: ${report.totalTests}`)
  console.log(`   ✅ Passed: ${report.passed}`)
  console.log(`   ❌ Failed: ${report.failed}`)
  console.log(`   Success Rate: ${((report.passed / report.totalTests) * 100).toFixed(1)}%\n`)

  console.log("📋 Test Details:\n")
  for (const result of report.results) {
    const icon = result.pass ? "✅" : "❌"
    console.log(`${icon} ${result.testCase}`)
    if (!result.pass) {
      console.log(`   Expected: ${JSON.stringify(result.expected, null, 2)}`)
      console.log(`   Actual: ${JSON.stringify(result.actual, null, 2)}`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    }
  }

  process.exit(report.failed > 0 ? 1 : 0)
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error)
}
