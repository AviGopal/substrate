#!/usr/bin/env bun
/**
 * Baseline Performance Measurement for DevBob
 * 
 * Focused measurement of key performance metrics without complex workflows
 * that are causing timeouts in the comprehensive suite.
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"

console.log("📐 DevBob Baseline Performance Measurement")
console.log("==========================================")

const TEST_AGENTS = ["devbob-opencode", "devbob-rpc-api", "devbob-dashboard", "devbob-cli"] as const

// Performance measurement utility
class BaselineMetrics {
  private startTime = 0
  private startMemory: NodeJS.MemoryUsage | null = null

  start() {
    this.startTime = performance.now()
    this.startMemory = process.memoryUsage()
  }

  end() {
    const endTime = performance.now()
    const endMemory = process.memoryUsage()
    
    return {
      duration: endTime - this.startTime,
      memoryDelta: this.startMemory ? endMemory.heapUsed - this.startMemory.heapUsed : 0,
      peakMemory: endMemory.heapUsed
    }
  }
}

await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    console.log("🔧 Initializing ACP Tool...")
    
    let acpTool: Awaited<ReturnType<typeof ACPDelegateTool.init>>
    try {
      acpTool = await ACPDelegateTool.init()
      console.log("✅ ACP Tool initialized")
    } catch (error) {
      console.log("❌ Failed to initialize ACP tool:", error)
      process.exit(1)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("BASELINE MEASUREMENT 1: ACP Connection Overhead")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    const connectionResults: Array<{
      agent: string
      duration: number
      memoryDelta: number
      success: boolean
    }> = []

    for (const agent of TEST_AGENTS) {
      console.log(`\n🔗 Testing connection to ${agent}...`)
      
      const metrics = new BaselineMetrics()
      metrics.start()
      
      try {
        const result = await acpTool.execute(
          {
            target: `docker://${agent}`,
            taskDescription: "Connection baseline test",
            prompt: "Reply with 'OK' to confirm connection.",
            timeout: 30, // Short timeout for baseline
          },
          {
            sessionID: `baseline-${agent}-${Date.now()}`,
            activityId: undefined,
            taskId: undefined,
          } as any,
        )

        const measurement = metrics.end()
        
        connectionResults.push({
          agent,
          duration: measurement.duration,
          memoryDelta: measurement.memoryDelta,
          success: result.metadata?.success || false
        })

        if (result.metadata?.success) {
          console.log(`   ✅ Connected in ${measurement.duration.toFixed(1)}ms`)
          console.log(`   📊 Memory: ${(measurement.memoryDelta / 1024 / 1024).toFixed(2)}MB`)
        } else {
          console.log(`   ❌ Connection failed`)
        }
        
      } catch (error) {
        const measurement = metrics.end()
        connectionResults.push({
          agent,
          duration: measurement.duration,
          memoryDelta: measurement.memoryDelta,
          success: false
        })
        console.log(`   ❌ Connection error: ${error}`)
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("BASELINE MEASUREMENT 2: Simple Task Execution")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    const primaryAgent = "devbob-opencode"
    console.log(`\n⚡ Testing simple task execution on ${primaryAgent}...`)
    
    const taskMetrics = new BaselineMetrics()
    taskMetrics.start()
    
    try {
      const result = await acpTool.execute(
        {
          target: `docker://${primaryAgent}`,
          taskDescription: "Simple task baseline",
          prompt: "Use the bash tool to run 'echo Hello World' and report the output.",
          timeout: 45,
        },
        {
          sessionID: `baseline-task-${Date.now()}`,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      const taskMeasurement = taskMetrics.end()
      
      if (result.metadata?.success) {
        console.log(`✅ Task completed in ${taskMeasurement.duration.toFixed(1)}ms`)
        console.log(`📊 Memory: ${(taskMeasurement.memoryDelta / 1024 / 1024).toFixed(2)}MB`)
        console.log(`📝 Response: ${result.output.length} characters`)
      } else {
        console.log(`❌ Task failed`)
      }
      
    } catch (error) {
      console.log(`❌ Task execution error: ${error}`)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("BASELINE MEASUREMENT 3: Memory Agent Performance")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    console.log("\n🧠 Testing memory agent with proper session ID format...")
    
    const memoryMetrics = new BaselineMetrics()
    memoryMetrics.start()
    
    try {
      // Use proper session ID format that starts with 'ses'
      const result = await acpTool.execute(
        {
          target: `docker://${primaryAgent}`,
          taskDescription: "Memory agent baseline",
          prompt: "List available tools and respond with the first 3 tool names.",
          timeout: 30,
        },
        {
          sessionID: `ses_baseline_memory_${Date.now()}`, // Proper session ID format
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      const memoryMeasurement = memoryMetrics.end()
      
      if (result.metadata?.success) {
        console.log(`✅ Memory agent task completed in ${memoryMeasurement.duration.toFixed(1)}ms`)
        console.log(`📊 Memory: ${(memoryMeasurement.memoryDelta / 1024 / 1024).toFixed(2)}MB`)
      } else {
        console.log(`❌ Memory agent task failed`)
      }
      
    } catch (error) {
      console.log(`❌ Memory agent test error: ${error}`)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("BASELINE PERFORMANCE SUMMARY")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    // Connection Analysis
    console.log("\n🔗 ACP CONNECTION PERFORMANCE:")
    const successfulConnections = connectionResults.filter(r => r.success)
    const avgConnectionTime = successfulConnections.length > 0 
      ? successfulConnections.reduce((sum, r) => sum + r.duration, 0) / successfulConnections.length 
      : 0
    const avgConnectionMemory = successfulConnections.length > 0
      ? successfulConnections.reduce((sum, r) => sum + r.memoryDelta, 0) / successfulConnections.length
      : 0

    console.log(`   Success Rate: ${successfulConnections.length}/${connectionResults.length} (${((successfulConnections.length / connectionResults.length) * 100).toFixed(1)}%)`)
    console.log(`   Average Connection Time: ${avgConnectionTime.toFixed(1)}ms`)
    console.log(`   Average Memory per Connection: ${(avgConnectionMemory / 1024 / 1024).toFixed(2)}MB`)
    
    connectionResults.forEach(result => {
      console.log(`   ${result.agent}: ${result.success ? '✅' : '❌'} ${result.duration.toFixed(1)}ms`)
    })

    // Performance Assessment vs Targets
    console.log("\n🎯 PERFORMANCE TARGET ASSESSMENT:")
    console.log("   Target: Context selection <100ms")
    console.log(`   Measured: Connection overhead ${avgConnectionTime.toFixed(1)}ms`)
    console.log(`   Status: ${avgConnectionTime < 100 ? '✅ MEETS TARGET' : '⚠️  ABOVE TARGET'}`)
    
    console.log("\n   Target: 30% memory reduction (baseline needed)")
    console.log(`   Current Memory per Operation: ${(avgConnectionMemory / 1024 / 1024).toFixed(2)}MB`)
    console.log("   Status: 📊 BASELINE ESTABLISHED")
    
    console.log("\n   Target: 40% token reduction (baseline needed)")
    console.log("   Current Token Usage: Measurement needed with activity execution")
    console.log("   Status: 📊 BASELINE NEEDED")

    // Recommendations
    console.log("\n💡 IMMEDIATE RECOMMENDATIONS:")
    
    if (successfulConnections.length < connectionResults.length) {
      console.log("   ⚠️  Some agents failed to connect - investigate timeout issues")
    }
    
    if (avgConnectionTime > 10000) {
      console.log("   ⚠️  High connection overhead - optimize ACP initialization")
    }
    
    if (avgConnectionMemory > 50 * 1024 * 1024) {
      console.log("   ⚠️  High memory usage per connection - investigate memory leaks")
    }

    // Next Steps
    console.log("\n🚀 NEXT STEPS FOR FULL PERFORMANCE VALIDATION:")
    console.log("   1. Optimize timeout settings to prevent task failures")
    console.log("   2. Implement lightweight activity execution tests")
    console.log("   3. Establish token consumption baselines")
    console.log("   4. Test impulse loading with smaller, more focused operations")
    console.log("   5. Implement Metabob integration performance tests")

    console.log("\n✨ Baseline Performance Measurement Complete!")
    console.log(`🎯 System Connection Success Rate: ${((successfulConnections.length / connectionResults.length) * 100).toFixed(1)}%`)
  },
})