#!/usr/bin/env bun

/**
 * Memory Leak Test: MessageV2.stream() unbounded iteration
 * 
 * This script simulates the memory leak from MessageV2.stream()
 * loading ALL message IDs into memory via Array.fromAsync()
 * 
 * Hypothesis: Each call to stream() loads thousands of message IDs
 * and keeps them in memory, causing rapid growth.
 */

interface MemorySnapshot {
  iteration: number
  rss: number
  heapUsed: number
  messagesInMemory: number
}

function getMemoryUsage(): Omit<MemorySnapshot, 'iteration' | 'messagesInMemory'> {
  const mem = process.memoryUsage()
  return {
    rss: Math.round(mem.rss / (1024 * 1024)),
    heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
  }
}

// Simulate the OLD behavior: loading ALL messages
async function* getAllMessagesOldBehavior(totalMessages: number): AsyncGenerator<string> {
  // This is what the OLD code did:
  // const allIds = await Array.fromAsync(MessageV2DB.getMessageIds(session))
  // This loads ALL messages into memory at once!
  
  const allIds: string[] = []
  for (let i = 0; i < totalMessages; i++) {
    allIds.push(`msg-${i}`)
  }
  
  // Now yield them (but they're already ALL in memory)
  for (const id of allIds) {
    yield id
  }
}

// Simulate the NEW behavior: streaming with limit
async function* getMessagesNewBehavior(totalMessages: number, limit: number): AsyncGenerator<string> {
  // This is what the NEW code does:
  // Stream messages and stop after limit
  let count = 0
  for (let i = 0; i < totalMessages && count < limit; i++) {
    yield `msg-${i}`
    count++
  }
}

async function testOldBehavior() {
  console.log("🔴 Testing OLD behavior (Array.fromAsync)\\n")
  
  const snapshots: MemorySnapshot[] = []
  const iterations = 50
  const messagesPerSession = 5000 // Typical session might have thousands of messages
  
  const initial = getMemoryUsage()
  snapshots.push({
    iteration: 0,
    ...initial,
    messagesInMemory: 0,
  })
  
  console.log("📊 Initial State:")
  console.log(`   RSS: ${initial.rss} MB\\n`)
  
  let totalMessagesLoaded = 0
  
  for (let i = 1; i <= iterations; i++) {
    // Simulate calling stream() which loads ALL messages
    const messages: string[] = []
    for await (const msg of getAllMessagesOldBehavior(messagesPerSession)) {
      messages.push(msg)
    }
    totalMessagesLoaded += messages.length
    
    // Keep references (simulating what might happen in real code)
    // In reality, these might be kept in various caches
    
    if (i % 10 === 0) {
      if (global.gc) {
        global.gc()
      }
      
      const snapshot = {
        iteration: i,
        ...getMemoryUsage(),
        messagesInMemory: totalMessagesLoaded,
      }
      snapshots.push(snapshot)
      
      const growth = snapshot.rss - initial.rss
      const mbPerCall = growth / i
      
      console.log(`📈 Iteration ${i}/${iterations}:`)
      console.log(`   RSS: ${snapshot.rss} MB (+${growth} MB)`)
      console.log(`   Messages loaded: ${totalMessagesLoaded.toLocaleString()}`)
      console.log(`   Growth per call: ${mbPerCall.toFixed(2)} MB`)
    }
  }
  
  const final = snapshots[snapshots.length - 1]
  const totalGrowth = final.rss - initial.rss
  
  console.log("\\n" + "=".repeat(60))
  console.log("📊 OLD BEHAVIOR ANALYSIS")
  console.log("=".repeat(60))
  console.log(`Total calls: ${iterations}`)
  console.log(`Messages per call: ${messagesPerSession.toLocaleString()}`)
  console.log(`Total messages loaded: ${totalMessagesLoaded.toLocaleString()}`)
  console.log(`Initial RSS: ${initial.rss} MB`)
  console.log(`Final RSS: ${final.rss} MB`)
  console.log(`Total growth: ${totalGrowth} MB`)
  console.log(`Growth per call: ${(totalGrowth / iterations).toFixed(2)} MB`)
  
  const hourlyRate = (totalGrowth / iterations) * 100 * 3600 / 1000 // Assuming 100 calls per hour
  console.log(`\\nProjected growth rate: ${hourlyRate.toFixed(2)} GB/hour (at 100 calls/hour)`)
  
  return final.rss
}

async function testNewBehavior() {
  console.log("\\n\\n✅ Testing NEW behavior (stream with limit)\\n")
  
  const snapshots: MemorySnapshot[] = []
  const iterations = 50
  const messagesPerSession = 5000
  const limit = 100 // NEW: We only load what we need!
  
  const initial = getMemoryUsage()
  snapshots.push({
    iteration: 0,
    ...initial,
    messagesInMemory: 0,
  })
  
  console.log("📊 Initial State:")
  console.log(`   RSS: ${initial.rss} MB\\n`)
  
  let totalMessagesLoaded = 0
  
  for (let i = 1; i <= iterations; i++) {
    // Simulate calling stream() which loads ONLY what we need
    const messages: string[] = []
    for await (const msg of getMessagesNewBehavior(messagesPerSession, limit)) {
      messages.push(msg)
    }
    totalMessagesLoaded += messages.length
    
    if (i % 10 === 0) {
      if (global.gc) {
        global.gc()
      }
      
      const snapshot = {
        iteration: i,
        ...getMemoryUsage(),
        messagesInMemory: totalMessagesLoaded,
      }
      snapshots.push(snapshot)
      
      const growth = snapshot.rss - initial.rss
      const mbPerCall = growth / i
      
      console.log(`📈 Iteration ${i}/${iterations}:`)
      console.log(`   RSS: ${snapshot.rss} MB (+${growth} MB)`)
      console.log(`   Messages loaded: ${totalMessagesLoaded.toLocaleString()}`)
      console.log(`   Growth per call: ${mbPerCall.toFixed(2)} MB`)
    }
  }
  
  const final = snapshots[snapshots.length - 1]
  const totalGrowth = final.rss - initial.rss
  
  console.log("\\n" + "=".repeat(60))
  console.log("📊 NEW BEHAVIOR ANALYSIS")
  console.log("=".repeat(60))
  console.log(`Total calls: ${iterations}`)
  console.log(`Messages per call (limited): ${limit}`)
  console.log(`Total messages loaded: ${totalMessagesLoaded.toLocaleString()}`)
  console.log(`Initial RSS: ${initial.rss} MB`)
  console.log(`Final RSS: ${final.rss} MB`)
  console.log(`Total growth: ${totalGrowth} MB`)
  console.log(`Growth per call: ${(totalGrowth / iterations).toFixed(2)} MB`)
  
  const hourlyRate = (totalGrowth / iterations) * 100 * 3600 / 1000
  console.log(`\\nProjected growth rate: ${hourlyRate.toFixed(2)} GB/hour (at 100 calls/hour)`)
  
  return final.rss
}

async function runComparison() {
  console.log("🧪 MessageV2.stream() Memory Leak Test\\n")
  console.log("Comparing OLD vs NEW behavior\\n")
  console.log("=".repeat(60) + "\\n")
  
  const oldRss = await testOldBehavior()
  
  // Wait for GC
  if (global.gc) {
    global.gc()
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  const newRss = await testNewBehavior()
  
  console.log("\\n\\n" + "=".repeat(60))
  console.log("📊 COMPARISON")
  console.log("=".repeat(60))
  console.log(`OLD behavior final RSS: ${oldRss} MB`)
  console.log(`NEW behavior final RSS: ${newRss} MB`)
  console.log(`Memory saved: ${oldRss - newRss} MB`)
  console.log(`Improvement: ${((1 - newRss / oldRss) * 100).toFixed(1)}%`)
  console.log("=".repeat(60) + "\\n")
}

runComparison().catch(console.error)
