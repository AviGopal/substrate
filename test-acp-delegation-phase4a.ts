#!/usr/bin/env bun
/**
 * ACP Delegation Phase 4A - End-to-End Test
 *
 * Tests the complete lifecycle of remote session impulse tracking:
 * 1. Create remoteSession impulse
 * 2. Update status through lifecycle (initializing → processing → completed)
 * 3. Query active sessions
 * 4. Check session alive status
 * 5. Verify final metadata
 *
 * Prerequisites:
 * - bun installed
 * - opencode built
 *
 * Usage:
 *   bun test-acp-delegation-phase4a.ts
 */

import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { ActivityTemplate } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template"
import { Storage } from "./repos/metabob-opencode/packages/opencode/src/storage/storage"

// Test configuration
const TEST_SESSION_ID = `test-session-${Date.now()}`
const TEST_REMOTE_SESSION_ID_1 = `remote-session-${Date.now()}-1`
const TEST_REMOTE_SESSION_ID_2 = `remote-session-${Date.now()}-2`

// ANSI colors for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
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

function assert(condition: boolean, message: string) {
  if (!condition) {
    logError(message)
    throw new Error(`Assertion failed: ${message}`)
  }
  logSuccess(message)
}

async function cleanup() {
  logStep("Cleaning up test data...")
  try {
    await SessionMemory.remove(TEST_SESSION_ID)
    logSuccess("Test session removed")
  } catch (error) {
    logInfo("No cleanup needed")
  }
}

async function test() {
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.cyan}║  ACP Delegation Phase 4A - End-to-End Test               ║${colors.reset}`)
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`)

  try {
    // =========================================================================
    // Test 1: Create Remote Session Impulses
    // =========================================================================
    logStep("Test 1: Creating remote session impulses...")

    const impulse1: ActivityTemplate.Impulse.Schema = {
      id: `remote-session-impulse-${Date.now()}-1`,
      sessionID: TEST_SESSION_ID,
      scope: "session",
      pointer: {
        type: "remoteSession",
        remoteSessionId: TEST_REMOTE_SESSION_ID_1,
        target: "docker://devbob-opencode",
        taskDescription: "Implement feature A",
      },
      budget: 5000,
      loaded: false,
      metadata: {
        status: "initializing",
        target: "docker://devbob-opencode",
        taskDescription: "Implement feature A",
        remoteSessionId: TEST_REMOTE_SESSION_ID_1,
        startTime: Date.now(),
        lastUpdate: Date.now(),
      },
    }

    const impulse2: ActivityTemplate.Impulse.Schema = {
      id: `remote-session-impulse-${Date.now()}-2`,
      sessionID: TEST_SESSION_ID,
      scope: "session",
      pointer: {
        type: "remoteSession",
        remoteSessionId: TEST_REMOTE_SESSION_ID_2,
        target: "docker://devbob-cli",
        taskDescription: "Fix bug B",
      },
      budget: 3000,
      loaded: false,
      metadata: {
        status: "processing",
        target: "docker://devbob-cli",
        taskDescription: "Fix bug B",
        remoteSessionId: TEST_REMOTE_SESSION_ID_2,
        startTime: Date.now(),
        lastUpdate: Date.now(),
      },
    }

    await SessionMemory.addImpulse(TEST_SESSION_ID, impulse1)
    await SessionMemory.addImpulse(TEST_SESSION_ID, impulse2)

    logSuccess("Created 2 remote session impulses")

    // =========================================================================
    // Test 2: Query Active Remote Sessions
    // =========================================================================
    logStep("Test 2: Querying active remote sessions...")

    const activeSessions = await SessionMemory.getActiveRemoteSessions(TEST_SESSION_ID)
    assert(activeSessions.length === 2, `Found 2 active sessions (got ${activeSessions.length})`)
    assert(
      activeSessions.some((s) => s.pointer.type === "remoteSession" && s.pointer.remoteSessionId === TEST_REMOTE_SESSION_ID_1),
      "Found session 1 in active sessions",
    )
    assert(
      activeSessions.some((s) => s.pointer.type === "remoteSession" && s.pointer.remoteSessionId === TEST_REMOTE_SESSION_ID_2),
      "Found session 2 in active sessions",
    )

    // =========================================================================
    // Test 3: Get Specific Remote Session
    // =========================================================================
    logStep("Test 3: Getting specific remote session...")

    const session1 = await SessionMemory.getRemoteSession(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_1)
    assert(session1 !== undefined, "Retrieved session 1")
    assert(
      session1?.pointer.type === "remoteSession" && session1.pointer.taskDescription === "Implement feature A",
      "Session 1 has correct task description",
    )

    const session2 = await SessionMemory.getRemoteSession(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_2)
    assert(session2 !== undefined, "Retrieved session 2")
    assert(
      session2?.pointer.type === "remoteSession" && session2.pointer.taskDescription === "Fix bug B",
      "Session 2 has correct task description",
    )

    // =========================================================================
    // Test 4: Check Session Alive Status
    // =========================================================================
    logStep("Test 4: Checking session alive status...")

    const isAlive1 = await SessionMemory.isRemoteSessionAlive(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_1)
    assert(isAlive1 === true, "Session 1 is alive (status: initializing)")

    const isAlive2 = await SessionMemory.isRemoteSessionAlive(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_2)
    assert(isAlive2 === true, "Session 2 is alive (status: processing)")

    // =========================================================================
    // Test 5: Update Session Status (Processing → Completed)
    // =========================================================================
    logStep("Test 5: Updating session 1 to processing...")

    await SessionMemory.updateImpulse(TEST_SESSION_ID, impulse1.id, {
      metadata: {
        ...impulse1.metadata,
        status: "processing",
        lastUpdate: Date.now(),
        lastMessage: "Implementing feature logic...",
      },
    })

    const session1Updated = await SessionMemory.getRemoteSession(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_1)
    assert(session1Updated?.metadata?.status === "processing", "Session 1 status updated to processing")
    assert(
      session1Updated?.metadata?.lastMessage === "Implementing feature logic...",
      "Session 1 lastMessage updated",
    )

    // =========================================================================
    // Test 6: Complete Session (Processing → Completed)
    // =========================================================================
    logStep("Test 6: Completing session 2...")

    const completionTime = Date.now()
    await SessionMemory.updateImpulse(TEST_SESSION_ID, impulse2.id, {
      metadata: {
        ...impulse2.metadata,
        status: "completed",
        lastUpdate: completionTime,
        duration: completionTime - (impulse2.metadata?.startTime as number),
        responseText: "Bug fixed successfully",
        toolCalls: ["bash", "edit", "bash"],
      },
    })

    const session2Completed = await SessionMemory.getRemoteSession(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_2)
    assert(session2Completed?.metadata?.status === "completed", "Session 2 status updated to completed")
    assert(session2Completed?.metadata?.responseText === "Bug fixed successfully", "Session 2 has response text")
    assert(Array.isArray(session2Completed?.metadata?.toolCalls), "Session 2 has toolCalls array")

    // =========================================================================
    // Test 7: Verify Active Sessions After Completion
    // =========================================================================
    logStep("Test 7: Verifying active sessions after completion...")

    const activeSessionsAfter = await SessionMemory.getActiveRemoteSessions(TEST_SESSION_ID)
    assert(activeSessionsAfter.length === 1, `Only 1 active session remains (got ${activeSessionsAfter.length})`)
    assert(
      activeSessionsAfter[0].pointer.type === "remoteSession" &&
        activeSessionsAfter[0].pointer.remoteSessionId === TEST_REMOTE_SESSION_ID_1,
      "Active session is session 1 (still processing)",
    )

    const isAlive2After = await SessionMemory.isRemoteSessionAlive(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_2)
    assert(isAlive2After === false, "Session 2 is no longer alive (completed)")

    // =========================================================================
    // Test 8: Fail a Session
    // =========================================================================
    logStep("Test 8: Failing session 1...")

    await SessionMemory.updateImpulse(TEST_SESSION_ID, impulse1.id, {
      metadata: {
        ...impulse1.metadata,
        status: "failed",
        lastUpdate: Date.now(),
        error: "Connection timeout",
      },
    })

    const session1Failed = await SessionMemory.getRemoteSession(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_1)
    assert(session1Failed?.metadata?.status === "failed", "Session 1 status updated to failed")
    assert(session1Failed?.metadata?.error === "Connection timeout", "Session 1 has error message")

    // =========================================================================
    // Test 9: Verify No Active Sessions
    // =========================================================================
    logStep("Test 9: Verifying no active sessions remain...")

    const finalActiveSessions = await SessionMemory.getActiveRemoteSessions(TEST_SESSION_ID)
    assert(finalActiveSessions.length === 0, "No active sessions remain")

    const isAlive1Final = await SessionMemory.isRemoteSessionAlive(TEST_SESSION_ID, TEST_REMOTE_SESSION_ID_1)
    assert(isAlive1Final === false, "Session 1 is no longer alive (failed)")

    // =========================================================================
    // Test 10: List All Impulses
    // =========================================================================
    logStep("Test 10: Listing all impulses...")

    const allImpulses = await SessionMemory.listImpulses(TEST_SESSION_ID)
    assert(allImpulses.length === 2, `Found 2 total impulses (got ${allImpulses.length})`)

    const remoteSessionImpulses = allImpulses.filter((imp) => imp.pointer.type === "remoteSession")
    assert(remoteSessionImpulses.length === 2, "Both impulses are remoteSession type")

    // =========================================================================
    // SUCCESS
    // =========================================================================
    console.log(`\n${colors.green}╔════════════════════════════════════════════════════════════╗${colors.reset}`)
    console.log(`${colors.green}║  ✓ All Tests Passed!                                      ║${colors.reset}`)
    console.log(`${colors.green}╚════════════════════════════════════════════════════════════╝${colors.reset}`)

    logInfo(`Session ID: ${TEST_SESSION_ID}`)
    logInfo(`Remote Session IDs: ${TEST_REMOTE_SESSION_ID_1}, ${TEST_REMOTE_SESSION_ID_2}`)
    logInfo(`Total impulses created: 2`)
    logInfo(`Status transitions tested: initializing → processing → completed/failed`)

    // Cleanup
    await cleanup()

    process.exit(0)
  } catch (error) {
    console.log(`\n${colors.red}╔════════════════════════════════════════════════════════════╗${colors.reset}`)
    console.log(`${colors.red}║  ✗ Test Failed!                                           ║${colors.reset}`)
    console.log(`${colors.red}╚════════════════════════════════════════════════════════════╝${colors.reset}`)
    console.error(error)

    // Cleanup
    await cleanup()

    process.exit(1)
  }
}

// Run tests
test()
