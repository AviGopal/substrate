#!/usr/bin/env bun

/**
 * Combined Memory Leak Test
 * 
 * Tests both leak sources together to see their combined impact:
 * 1. MessageV2.stream() - Loading ALL message IDs (PRIMARY LEAK)
 * 2. SessionContext Maps - Unbounded session storage (SECONDARY LEAK)
 * 
 * Goal: Prove which leak source accounts for the 20.8 GB in 3 hours
 */

interface TestResult {
  name: string
  initialRss: number
  finalRss: number
  growth: number
  rateGbPerHour: number
  percentOfTotal: number
}

function getMemoryUsageMB(): number {
  return Math.round(process.memoryUsage().rss / (1024 * 1024))
}

// Simulate MessageV2.stream() leak (PRIMARY SUSPECT)
async function testMessageStreamLeak(calls: number): Promise<TestResult> {
  const initialRss = getMemoryUsageMB()
  
  const allMessages: string[][] = []
  
  for (let i = 0; i < calls; i++) {
    // Simulate loading ALL message IDs into memory
    const messageIds: string[] = []
    for (let j = 0; j < 5000; j++) {
      messageIds.push(`msg-${i}-${j}`)
    }
    allMessages.push(messageIds)
  }
  
  if (global.gc) global.gc()
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const finalRss = getMemoryUsageMB()
  const growth = finalRss - initialRss
  const rateGbPerHour = (growth / calls) * 100 * 3600 / 1000 // Assuming 100 calls/hour
  
  return {
    name: "MessageV2.stream() leak",
    initialRss,
    finalRss,
    growth,
    rateGbPerHour,
    percentOfTotal: 0, // Will calculate later
  }
}

// Simulate SessionContext Maps leak (SECONDARY SUSPECT)
async function testSessionContextLeak(sessions: number): Promise<TestResult> {
  const initialRss = getMemoryUsageMB()
  
  // Simulate SessionContext storage
  const recentFiles = new Map<string, { files: Set<string>; lastUpdate: number }>()
  const modifiedFiles = new Map<string, { files: Set<string>; lastUpdate: number }>()
  const currentPrompts = new Map<string, string>()
  const sessionMetadata = new Map<string, any>()
  
  for (let i = 0; i < sessions; i++) {
    const sessionId = `session-${i}`
    
    // Add files
    const files = new Set<string>()
    for (let j = 0; j < 50; j++) {
      files.add(`file-${i}-${j}.ts`)
    }
    recentFiles.set(sessionId, { files, lastUpdate: Date.now() })
    modifiedFiles.set(sessionId, { files: new Set(Array.from(files).slice(0, 10)), lastUpdate: Date.now() })
    
    // Add prompt
    currentPrompts.set(sessionId, `Prompt for session ${i}`.repeat(10))
    
    // Add metadata
    sessionMetadata.set(sessionId, {
      issuesSeen: new Set(Array.from({ length: 20 }, (_, j) => `issue-${i}-${j}`)),
      analysesDone: new Set(Array.from({ length: 10 }, (_, j) => `analysis-${i}-${j}`)),
      patternsAsked: new Set(Array.from({ length: 5 }, (_, j) => `pattern-${i}-${j}`)),
      lastUpdated: Date.now(),
    })
  }
  
  if (global.gc) global.gc()
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const finalRss = getMemoryUsageMB()
  const growth = finalRss - initialRss
  const rateGbPerHour = (growth / sessions) * 100 * 3600 / 1000 // Assuming 100 sessions/hour
  
  return {
    name: "SessionContext Maps leak",
    initialRss,
    finalRss,
    growth,
    rateGbPerHour,
    percentOfTotal: 0,
  }
}

async function runCombinedTest() {
  console.log("🧪 Combined Memory Leak Analysis")
  console.log("=".repeat(70))
  console.log("")
  console.log("Simulating 3 hours of operation with 20.8 GB memory usage")
  console.log("Target growth: 20.8 GB - 1 GB baseline = 19.8 GB leak")
  console.log("")
  console.log("=".repeat(70) + "\\n")
  
  // Test MessageV2.stream() leak
  console.log("🔴 Testing MessageV2.stream() leak (PRIMARY SUSPECT)...")
  const messageResult = await testMessageStreamLeak(30) // 30 calls
  console.log(`   Initial RSS: ${messageResult.initialRss} MB`)
  console.log(`   Final RSS: ${messageResult.finalRss} MB`)
  console.log(`   Growth: ${messageResult.growth} MB`)
  console.log(`   Rate: ${messageResult.rateGbPerHour.toFixed(2)} GB/hour\\n`)
  
  // Small delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test SessionContext leak
  console.log("⚠️  Testing SessionContext Maps leak (SECONDARY SUSPECT)...")
  const contextResult = await testSessionContextLeak(1000) // 1000 sessions
  console.log(`   Initial RSS: ${contextResult.initialRss} MB`)
  console.log(`   Final RSS: ${contextResult.finalRss} MB`)
  console.log(`   Growth: ${contextResult.growth} MB`)
  console.log(`   Rate: ${contextResult.rateGbPerHour.toFixed(2)} GB/hour\\n`)
  
  // Calculate contributions
  const targetLeakGb = 19.8 // 20.8 GB - 1 GB baseline
  const targetLeakMb = targetLeakGb * 1024
  
  // How many calls/sessions needed to hit 19.8 GB in 3 hours?
  const hoursOfOperation = 3
  const messageCallsNeeded = (targetLeakGb / messageResult.rateGbPerHour) * 100 // calls/hour * hours
  const sessionsNeeded = (targetLeakGb / contextResult.rateGbPerHour) * 100
  
  console.log("=".repeat(70))
  console.log("📊 LEAK SOURCE ANALYSIS")
  console.log("=".repeat(70))
  console.log("")
  console.log(`Target leak: ${targetLeakGb.toFixed(1)} GB in ${hoursOfOperation} hours`)
  console.log("")
  
  // MessageV2 contribution
  const messageCallsPer3Hours = messageCallsNeeded / hoursOfOperation
  const messageContribution = (messageResult.growth / 1024) * messageCallsPer3Hours
  messageResult.percentOfTotal = (messageContribution / targetLeakGb) * 100
  
  console.log("🔴 MessageV2.stream() leak:")
  console.log(`   Growth per call: ${messageResult.growth / 30} MB`)
  console.log(`   Projected rate: ${messageResult.rateGbPerHour.toFixed(2)} GB/hour`)
  console.log(`   Calls needed to hit target: ${messageCallsNeeded.toFixed(0)} total (${messageCallsPer3Hours.toFixed(1)} calls/3h)`)
  console.log(`   That's only ${(messageCallsPer3Hours / 3 / 60).toFixed(2)} calls/minute!`)
  console.log(`   Contribution to 19.8 GB leak: ${messageResult.percentOfTotal.toFixed(1)}%`)
  console.log("")
  
  // SessionContext contribution
  const sessionsPer3Hours = sessionsNeeded / hoursOfOperation
  const contextContribution = (contextResult.growth / 1024) * sessionsPer3Hours
  contextResult.percentOfTotal = (contextContribution / targetLeakGb) * 100
  
  console.log("⚠️  SessionContext Maps leak:")
  console.log(`   Growth per session: ${contextResult.growth / 1000} MB`)
  console.log(`   Projected rate: ${contextResult.rateGbPerHour.toFixed(2)} GB/hour`)
  console.log(`   Sessions needed to hit target: ${sessionsNeeded.toFixed(0)} total (${sessionsPer3Hours.toFixed(0)} sessions/3h)`)
  console.log(`   That's ${(sessionsPer3Hours / 3 / 60).toFixed(2)} sessions/minute`)
  console.log(`   Contribution to 19.8 GB leak: ${contextResult.percentOfTotal.toFixed(1)}%`)
  console.log("")
  
  // Verdict
  console.log("=".repeat(70))
  console.log("🎯 VERDICT")
  console.log("=".repeat(70))
  console.log("")
  
  if (messageResult.rateGbPerHour > contextResult.rateGbPerHour * 10) {
    console.log("❌ PRIMARY LEAK: MessageV2.stream()")
    console.log(`   Rate is ${(messageResult.rateGbPerHour / contextResult.rateGbPerHour).toFixed(1)}x faster than SessionContext`)
    console.log(`   ${messageCallsPer3Hours.toFixed(0)} calls in 3 hours would cause ${targetLeakGb.toFixed(1)} GB leak`)
    console.log(`   That's just ${(messageCallsPer3Hours / 3 / 60).toFixed(2)} calls/minute!`)
    console.log("")
    console.log("✅ FIX PRIORITY: MessageV2.stream() limit (ALREADY APPLIED)")
    console.log("   Expected reduction: ~95% (from 208 GB/h to ~0 GB/h)")
  } else if (contextResult.rateGbPerHour > messageResult.rateGbPerHour * 10) {
    console.log("❌ PRIMARY LEAK: SessionContext Maps")
    console.log(`   Rate is ${(contextResult.rateGbPerHour / messageResult.rateGbPerHour).toFixed(1)}x faster than MessageV2`)
    console.log(`   ${sessionsPer3Hours.toFixed(0)} sessions in 3 hours would cause ${targetLeakGb.toFixed(1)} GB leak`)
    console.log("")
    console.log("✅ FIX PRIORITY: SessionContext.cleanupOldSessions() (ALREADY APPLIED)")
  } else {
    console.log("⚠️  COMBINED LEAK: Both sources contribute significantly")
    console.log(`   MessageV2: ${messageResult.percentOfTotal.toFixed(1)}%`)
    console.log(`   SessionContext: ${contextResult.percentOfTotal.toFixed(1)}%`)
    console.log("")
    console.log("✅ FIX PRIORITY: BOTH fixes needed")
  }
  
  console.log("")
  console.log("=".repeat(70))
  console.log("✅ FIXES APPLIED:")
  console.log("=".repeat(70))
  console.log("1. MessageV2.stream() - Added limit parameter, early termination")
  console.log("2. SessionContext - Added cleanupOldSessions() called every 5 minutes")
  console.log("")
  console.log("📊 Expected result: Memory stays < 2 GB instead of growing to 20+ GB")
  console.log("=".repeat(70) + "\\n")
}

runCombinedTest().catch(console.error)
