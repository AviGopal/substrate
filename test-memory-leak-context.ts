#!/usr/bin/env bun

/**
 * Memory Leak Test: SessionContext Module-Level Maps
 * 
 * This script simulates the memory leak by creating many sessions
 * and tracking memory growth in the SessionContext Maps.
 * 
 * Hypothesis: recentFiles, modifiedFiles, currentPrompts, sessionMetadata
 * Maps grow unbounded as new sessions are created.
 */

import { SessionContext } from "./repos/metabob-opencode/packages/opencode/src/session/context"

interface MemorySnapshot {
  iteration: number
  rss: number
  heapUsed: number
  heapTotal: number
  external: number
  contextMaps: {
    recentFiles: number
    modifiedFiles: number
    currentPrompts: number
    sessionMetadata: number
  }
}

function getMemoryUsage(): Omit<MemorySnapshot, 'iteration' | 'contextMaps'> {
  const mem = process.memoryUsage()
  return {
    rss: Math.round(mem.rss / (1024 * 1024)),
    heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
    heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
    external: Math.round(mem.external / (1024 * 1024)),
  }
}

function getContextMapSizes(): MemorySnapshot['contextMaps'] {
  const stats = SessionContext.getMemoryStats()
  return {
    recentFiles: stats.sessions ?? 0,
    modifiedFiles: stats.modifiedFiles ?? 0,
    currentPrompts: stats.prompts ?? 0,
    sessionMetadata: stats.metadata ?? 0,
  }
}

async function simulateSession(sessionId: string): Promise<void> {
  // Simulate adding files to session context
  const files = [
    'src/session/context.ts',
    'src/session/index.ts',
    'src/session/session-memory-manager.ts',
    'src/session/message-v2.ts',
    'src/util/log.ts',
  ]
  
  for (const file of files) {
    SessionContext.trackFileAccess(sessionId, file)
    SessionContext.trackFileModification(sessionId, file, 'write')
  }
  
  // Simulate setting prompt
  SessionContext.setCurrentPrompt(sessionId, "Test prompt for session " + sessionId)
  
  // Simulate metadata access (this creates the entry)
  SessionContext.getSessionMetadata(sessionId)
  SessionContext.trackIssueSeen(sessionId, `issue-${sessionId}`)
  SessionContext.trackAnalysisDone(sessionId, `analysis-${sessionId}`)
}

async function testMemoryLeak() {
  console.log("🧪 Testing SessionContext Memory Leak Hypothesis\n")
  console.log("Hypothesis: Module-level Maps grow unbounded with each session\n")
  
  const snapshots: MemorySnapshot[] = []
  const iterations = 100
  const sessionsPerIteration = 10
  
  // Initial snapshot
  const initial = getMemoryUsage()
  const initialMaps = getContextMapSizes()
  snapshots.push({
    iteration: 0,
    ...initial,
    contextMaps: initialMaps,
  })
  
  console.log("📊 Initial State:")
  console.log(`   RSS: ${initial.rss} MB`)
  console.log(`   Heap Used: ${initial.heapUsed} MB`)
  console.log(`   Maps: ${JSON.stringify(initialMaps)}\n`)
  
  // Simulate many sessions
  for (let i = 1; i <= iterations; i++) {
    // Create multiple sessions per iteration
    for (let j = 0; j < sessionsPerIteration; j++) {
      const sessionId = `session-${i}-${j}`
      await simulateSession(sessionId)
    }
    
    // Take snapshot every 10 iterations
    if (i % 10 === 0) {
      // Force GC if available
      if (global.gc) {
        global.gc()
      }
      
      const snapshot = {
        iteration: i * sessionsPerIteration,
        ...getMemoryUsage(),
        contextMaps: getContextMapSizes(),
      }
      snapshots.push(snapshot)
      
      const growth = snapshot.rss - initial.rss
      const mapGrowth = snapshot.contextMaps.recentFiles - initialMaps.recentFiles
      
      console.log(`📈 Iteration ${i}/${iterations} (${snapshot.iteration} total sessions):`)
      console.log(`   RSS: ${snapshot.rss} MB (+${growth} MB)`)
      console.log(`   Heap: ${snapshot.heapUsed} MB`)
      console.log(`   Maps: recentFiles=${snapshot.contextMaps.recentFiles} (+${mapGrowth})`)
      console.log(`   Memory per session: ${(growth / snapshot.iteration * 1024).toFixed(2)} KB`)
    }
  }
  
  // Final analysis
  const final = snapshots[snapshots.length - 1]
  const totalGrowth = final.rss - initial.rss
  const totalSessions = final.iteration
  const mbPerSession = totalGrowth / totalSessions
  
  console.log("\n" + "=".repeat(60))
  console.log("📊 FINAL ANALYSIS")
  console.log("=".repeat(60))
  console.log(`Total sessions created: ${totalSessions}`)
  console.log(`Initial RSS: ${initial.rss} MB`)
  console.log(`Final RSS: ${final.rss} MB`)
  console.log(`Total growth: ${totalGrowth} MB`)
  console.log(`Growth per session: ${(mbPerSession * 1024).toFixed(2)} KB`)
  console.log(`Map entries: ${final.contextMaps.recentFiles} (should be ${totalSessions})`)
  console.log("")
  
  // Calculate growth rate
  const hourlyRate = (mbPerSession * 100 * 3600) / 1024 // Assuming 100 sessions per hour
  console.log(`Projected growth rate: ${hourlyRate.toFixed(2)} GB/hour (at 100 sessions/hour)`)
  console.log("")
  
  // Verdict
  if (totalGrowth > totalSessions * 0.5) { // More than 512 KB per session
    console.log("❌ LEAK CONFIRMED: Memory grows significantly with sessions")
    console.log("   Context Maps are NOT being cleaned up properly")
  } else if (totalGrowth > totalSessions * 0.1) { // More than 100 KB per session
    console.log("⚠️  POTENTIAL LEAK: Memory growth is moderate")
    console.log("   Context Maps may need cleanup optimization")
  } else {
    console.log("✅ NO LEAK: Memory growth is within expected bounds")
    console.log("   Context Maps appear to be managed properly")
  }
  
  // Check if cleanup works
  console.log("\n" + "=".repeat(60))
  console.log("🧹 Testing Cleanup Function")
  console.log("=".repeat(60))
  
  const beforeCleanup = getContextMapSizes()
  console.log(`Before cleanup: ${beforeCleanup.recentFiles} sessions`)
  
  // Call cleanup with 0 max age to remove all sessions
  SessionContext.cleanupOldSessions(0)
  
  const afterCleanup = getContextMapSizes()
  console.log(`After cleanup:  ${afterCleanup.recentFiles} sessions`)
  
  const removed = beforeCleanup.recentFiles - afterCleanup.recentFiles
  console.log(`Removed: ${removed} sessions`)
  
  if (removed > 0) {
    console.log("✅ Cleanup function works correctly")
  } else {
    console.log("❌ Cleanup function did not remove any sessions")
  }
  
  // Memory after cleanup
  if (global.gc) {
    global.gc()
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const afterCleanupMem = getMemoryUsage()
  const memoryFreed = final.rss - afterCleanupMem.rss
  console.log(`Memory after cleanup: ${afterCleanupMem.rss} MB`)
  console.log(`Memory freed: ${memoryFreed} MB`)
  
  if (memoryFreed > totalGrowth * 0.5) {
    console.log("✅ Cleanup freed significant memory")
  } else if (memoryFreed > 0) {
    console.log("⚠️  Cleanup freed some memory, but not all")
  } else {
    console.log("❌ Cleanup did not free memory")
  }
  
  console.log("\n" + "=".repeat(60))
  console.log("Test complete!")
  console.log("=".repeat(60) + "\n")
}

// Run test with GC enabled
console.log("Starting memory leak test (run with --expose-gc for accurate results)\n")
testMemoryLeak().catch(console.error)
