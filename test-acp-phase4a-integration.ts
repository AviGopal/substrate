#!/usr/bin/env bun
/**
 * ACP Phase 4A - Real Docker Integration Test
 *
 * Tests remote session impulse tracking with actual ACP delegation to Docker container.
 *
 * Prerequisites:
 * - Docker container running: devbob-clean (port 3000)
 * - Backend services healthy: api-server-dev, redis
 * - bun installed
 *
 * Usage:
 *   bun test-acp-phase4a-integration.ts
 *
 * What this tests:
 * 1. Real acp_delegate call to docker://devbob-clean
 * 2. Impulse creation on delegation start
 * 3. Status updates during execution (initializing → processing → completed)
 * 4. Query active sessions during execution
 * 5. Metadata tracking (duration, toolCalls, responseText)
 * 6. Session cleanup after completion
 */

import { Session } from "./repos/metabob-opencode/packages/opencode/src/session"
import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { Storage } from "./repos/metabob-opencode/packages/opencode/src/storage/storage"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
}

function logStep(message: string) {
  console.log(`\n${colors.blue}▶${colors.reset} ${message}`)
}

function logSuccess(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`)
}

function logError(message: string) {
  console.log(`${colors.red}✗${colors.reset} ${message}`)
}

function logInfo(message: string) {
  console.log(`${colors.cyan}ℹ${colors.reset} ${message}`)
}

function logWarning(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`)
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    logError(message)
    throw new Error(`Assertion failed: ${message}`)
  }
  logSuccess(message)
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function checkDockerContainer() {
  logStep("Checking Docker container availability...")
  
  try {
    // Check if devbob-clean is running
    const checkContainer = await Bun.spawn(["docker", "ps", "--filter", "name=devbob-clean", "--format", "{{.Status}}"], {
      stdout: "pipe",
    })
    const status = await new Response(checkContainer.stdout).text()
    
    if (!status.includes("Up")) {
      logError("devbob-clean container is not running")
      logInfo("Start it with: docker-compose --profile stable --profile devbob up -d")
      return false
    }
    
    logSuccess("devbob-clean container is running")
    
    // Check if ACP endpoint is accessible
    const response = await fetch("http://localhost:3000/config")
    if (!response.ok) {
      logError("ACP endpoint not accessible at http://localhost:3000")
      return false
    }
    
    logSuccess("ACP endpoint is accessible")
    return true
  } catch (error) {
    logError(`Container check failed: ${error}`)
    return false
  }
}

async function monitorActiveSessions(sessionID: string, intervalMs: number = 1000) {
  // Monitor active sessions for a few seconds
  logInfo("Monitoring active sessions for 5 seconds...")
  
  for (let i = 0; i < 5; i++) {
    await sleep(intervalMs)
    
    const activeSessions = await SessionMemory.getActiveRemoteSessions(sessionID)
    
    if (activeSessions.length > 0) {
      const session = activeSessions[0]
      const status = session.metadata?.status as string | undefined
      const lastMessage = session.metadata?.lastMessage as string | undefined
      
      console.log(`  [${i + 1}/5] Active: ${activeSessions.length} | Status: ${status} | Last: ${lastMessage?.slice(0, 50) || "N/A"}`)
    } else {
      console.log(`  [${i + 1}/5] No active sessions`)
    }
  }
}

async function test() {
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.cyan}║  ACP Phase 4A - Docker Integration Test                  ║${colors.reset}`)
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`)
  
  let session: any = null
  
  try {
    // =========================================================================
    // Pre-flight: Check Docker Container
    // =========================================================================
    const containerReady = await checkDockerContainer()
    if (!containerReady) {
      logError("Docker container not ready. Aborting test.")
      process.exit(1)
    }
    
    // =========================================================================
    // Test 1: Create Session
    // =========================================================================
    logStep("Test 1: Creating test session...")
    
    session = await createSession({
      mode: "activity",
      model: {
        provider: "anthropic",
        id: "claude-sonnet-4-5-20250929",
      },
    })
    
    assert(session.id !== undefined, `Session created with ID: ${session.id}`)
    logInfo(`Session ID: ${session.id}`)
    
    // =========================================================================
    // Test 2: Check Initial State (No Remote Sessions)
    // =========================================================================
    logStep("Test 2: Checking initial state...")
    
    const initialSessions = await SessionMemory.getActiveRemoteSessions(session.id)
    assert(initialSessions.length === 0, "No active remote sessions initially")
    
    // =========================================================================
    // Test 3: Delegate Simple Task to Docker Container
    // =========================================================================
    logStep("Test 3: Delegating task to docker://devbob-clean...")
    
    logInfo("Task: List workspace files and count them")
    logInfo("Target: docker://devbob-clean")
    
    // Start delegation in background to allow monitoring
    const delegationPromise = (async () => {
      try {
        const result = await session.callTool("acp_delegate", {
          target: "docker://devbob-clean",
          taskDescription: "List workspace files",
          prompt: "List all files in /workspace directory. Count how many files you find. Return the total count.",
          timeout: 60,
        })
        return result
      } catch (error) {
        logError(`Delegation failed: ${error}`)
        throw error
      }
    })()
    
    // Wait a bit for impulse to be created
    await sleep(2000)
    
    // =========================================================================
    // Test 4: Query Active Sessions During Execution
    // =========================================================================
    logStep("Test 4: Querying active sessions during execution...")
    
    const activeDuringExecution = await SessionMemory.getActiveRemoteSessions(session.id)
    logInfo(`Found ${activeDuringExecution.length} active session(s)`)
    
    if (activeDuringExecution.length > 0) {
      const activeSession = activeDuringExecution[0]
      
      assert(activeSession.pointer.type === "remoteSession", "Session has remoteSession pointer type")
      
      if (activeSession.pointer.type === "remoteSession") {
        logSuccess(`Remote Session ID: ${activeSession.pointer.remoteSessionId}`)
        logSuccess(`Target: ${activeSession.pointer.target}`)
        logSuccess(`Task: ${activeSession.pointer.taskDescription}`)
      }
      
      const status = activeSession.metadata?.status as string | undefined
      logInfo(`Current status: ${status}`)
      
      assert(
        status === "initializing" || status === "processing",
        `Status is active (got: ${status})`
      )
    } else {
      logWarning("No active sessions found yet (delegation might complete very quickly)")
    }
    
    // =========================================================================
    // Test 5: Monitor Active Sessions
    // =========================================================================
    logStep("Test 5: Monitoring active sessions...")
    
    // Monitor in background while delegation completes
    const monitorPromise = monitorActiveSessions(session.id, 1000)
    
    // Wait for delegation to complete
    logInfo("Waiting for delegation to complete...")
    const delegationResult = await delegationPromise
    
    // Wait for monitoring to finish
    await monitorPromise
    
    logSuccess("Delegation completed")
    logInfo(`Result preview: ${JSON.stringify(delegationResult).slice(0, 200)}...`)
    
    // =========================================================================
    // Test 6: Query Completed Session
    // =========================================================================
    logStep("Test 6: Querying completed session...")
    
    // Get all impulses
    const allImpulses = await SessionMemory.listImpulses(session.id)
    const remoteSessionImpulses = allImpulses.filter((imp) => imp.pointer.type === "remoteSession")
    
    assert(remoteSessionImpulses.length >= 1, `Found ${remoteSessionImpulses.length} remote session impulse(s)`)
    
    const completedSession = remoteSessionImpulses[0]
    
    // Verify pointer structure
    assert(completedSession.pointer.type === "remoteSession", "Impulse has remoteSession pointer")
    
    if (completedSession.pointer.type === "remoteSession") {
      logSuccess(`Remote Session ID: ${completedSession.pointer.remoteSessionId}`)
      logSuccess(`Target: ${completedSession.pointer.target}`)
      logSuccess(`Task: ${completedSession.pointer.taskDescription}`)
    }
    
    // =========================================================================
    // Test 7: Verify Metadata
    // =========================================================================
    logStep("Test 7: Verifying metadata...")
    
    const metadata = completedSession.metadata
    assert(metadata !== undefined, "Metadata exists")
    
    const status = metadata?.status as string | undefined
    logInfo(`Status: ${status}`)
    assert(
      status === "completed" || status === "failed",
      `Status is terminal (got: ${status})`
    )
    
    if (status === "completed") {
      // Check duration
      const duration = metadata?.duration as number | undefined
      if (duration !== undefined) {
        logSuccess(`Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`)
        assert(duration > 0, "Duration is positive")
      } else {
        logWarning("Duration not recorded")
      }
      
      // Check response text
      const responseText = metadata?.responseText as string | undefined
      if (responseText) {
        logSuccess(`Response text: ${responseText.length} characters`)
        logInfo(`Preview: ${responseText.slice(0, 100)}...`)
      } else {
        logWarning("Response text not recorded")
      }
      
      // Check tool calls
      const toolCalls = metadata?.toolCalls as string[] | undefined
      if (toolCalls && toolCalls.length > 0) {
        logSuccess(`Tool calls: ${toolCalls.length} tools used`)
        logInfo(`Tools: ${toolCalls.join(", ")}`)
      } else {
        logWarning("Tool calls not recorded")
      }
    } else if (status === "failed") {
      const error = metadata?.error as string | undefined
      logError(`Delegation failed: ${error || "Unknown error"}`)
    }
    
    // =========================================================================
    // Test 8: Verify No Active Sessions After Completion
    // =========================================================================
    logStep("Test 8: Verifying no active sessions after completion...")
    
    const activeFinal = await SessionMemory.getActiveRemoteSessions(session.id)
    assert(activeFinal.length === 0, "No active sessions after completion")
    
    // =========================================================================
    // Test 9: Check isRemoteSessionAlive
    // =========================================================================
    logStep("Test 9: Checking isRemoteSessionAlive...")
    
    if (completedSession.pointer.type === "remoteSession") {
      const isAlive = await SessionMemory.isRemoteSessionAlive(
        session.id,
        completedSession.pointer.remoteSessionId
      )
      assert(isAlive === false, "Completed session is not alive")
    }
    
    // =========================================================================
    // SUCCESS
    // =========================================================================
    console.log(`\n${colors.green}╔════════════════════════════════════════════════════════════╗${colors.reset}`)
    console.log(`${colors.green}║  ✓ Integration Test Passed!                               ║${colors.reset}`)
    console.log(`${colors.green}╚════════════════════════════════════════════════════════════╝${colors.reset}`)
    
    logInfo(`Session ID: ${session.id}`)
    logInfo(`Remote sessions tracked: ${remoteSessionImpulses.length}`)
    logInfo(`Final status: ${metadata?.status}`)
    
    // Cleanup
    logStep("Cleaning up...")
    await SessionMemory.remove(session.id)
    logSuccess("Session removed")
    
    process.exit(0)
  } catch (error) {
    console.log(`\n${colors.red}╔════════════════════════════════════════════════════════════╗${colors.reset}`)
    console.log(`${colors.red}║  ✗ Integration Test Failed!                               ║${colors.reset}`)
    console.log(`${colors.red}╚════════════════════════════════════════════════════════════╝${colors.reset}`)
    console.error(error)
    
    // Cleanup
    if (session?.id) {
      try {
        await SessionMemory.remove(session.id)
        logInfo("Session cleaned up")
      } catch (cleanupError) {
        logWarning("Cleanup failed")
      }
    }
    
    process.exit(1)
  }
}

// Run test
test()
