#!/usr/bin/env bun
/**
 * Agent Session Memory Diagnostic Tool
 * 
 * Investigates memory usage during agent operations in devbob containers.
 * 
 * Key Findings from Previous Investigation:
 * - Impulse loading causes 200+ MB temporary spikes
 * - Memory returns to baseline but spikes are excessive
 * - Concurrent operations could trigger OOM
 * - Recent fixes implemented: LRU cache, WeakMap/WeakSet, cleanup hooks
 * 
 * This script:
 * 1. Monitors container memory during agent sessions
 * 2. Tracks heap allocation patterns
 * 3. Identifies operations causing excessive memory usage
 * 4. Validates that recent memory leak fixes are working
 */

import { exec } from "child_process"
import { promisify } from "util"
import { writeFile } from "fs/promises"

const execAsync = promisify(exec)

interface MemorySnapshot {
  timestamp: Date
  containerMemoryMB: number
  containerMemoryPercent: number
  heapUsedMB?: number
  heapTotalMB?: number
  external?: number
  rss?: number
  operation?: string
}

interface DiagnosticReport {
  startTime: Date
  endTime: Date
  container: string
  snapshots: MemorySnapshot[]
  operations: OperationMemory[]
  summary: {
    baselineMemoryMB: number
    peakMemoryMB: number
    averageMemoryMB: number
    maxSpikeMB: number
    oomRisk: boolean
    concerningOperations: string[]
  }
}

interface OperationMemory {
  operation: string
  beforeMB: number
  afterMB: number
  deltaMB: number
  duration: number
  timestamp: Date
}

class AgentSessionMemoryDiagnostic {
  private snapshots: MemorySnapshot[] = []
  private operations: OperationMemory[] = []
  private container: string
  private monitoringActive = false
  private monitorInterval?: NodeJS.Timeout

  constructor(container: string = "devbob-opencode") {
    this.container = container
  }

  /**
   * Get current container memory stats
   */
  async getContainerMemory(): Promise<{ memoryMB: number; memoryPercent: number }> {
    try {
      const { stdout } = await execAsync(
        `docker stats ${this.container} --no-stream --format "{{.MemUsage}}"`
      )
      
      // Parse output like "507.8MiB / 7.651GiB"
      const match = stdout.match(/([\d.]+)MiB/)
      if (!match) {
        throw new Error(`Could not parse memory usage: ${stdout}`)
      }
      
      const memoryMB = parseFloat(match[1])
      
      // Get percentage
      const { stdout: percentOut } = await execAsync(
        `docker stats ${this.container} --no-stream --format "{{.MemPerc}}"`
      )
      const memoryPercent = parseFloat(percentOut.replace("%", ""))
      
      return { memoryMB, memoryPercent }
    } catch (error) {
      console.error("Failed to get container memory:", error)
      return { memoryMB: 0, memoryPercent: 0 }
    }
  }

  /**
   * Get process heap memory stats from inside container
   */
  async getHeapMemory(): Promise<{
    heapUsedMB: number
    heapTotalMB: number
    external: number
    rss: number
  } | null> {
    try {
      // Try to get memory stats via HTTP endpoint (if available)
      const { stdout } = await execAsync(
        `docker exec ${this.container} curl -s http://localhost:3000/health 2>/dev/null || echo "{}"`
      )
      
      const health = JSON.parse(stdout || "{}")
      if (health.memory) {
        return {
          heapUsedMB: health.memory.heapUsed / (1024 * 1024),
          heapTotalMB: health.memory.heapTotal / (1024 * 1024),
          external: health.memory.external,
          rss: health.memory.rss,
        }
      }
    } catch (error) {
      // Health endpoint not available, that's OK
    }
    
    return null
  }

  /**
   * Take a memory snapshot
   */
  async takeSnapshot(operation?: string): Promise<MemorySnapshot> {
    const containerMem = await this.getContainerMemory()
    const heapMem = await this.getHeapMemory()
    
    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      containerMemoryMB: containerMem.memoryMB,
      containerMemoryPercent: containerMem.memoryPercent,
      operation,
      ...heapMem,
    }
    
    this.snapshots.push(snapshot)
    return snapshot
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalSeconds: number = 2) {
    if (this.monitoringActive) {
      console.log("⚠️  Monitoring already active")
      return
    }
    
    this.monitoringActive = true
    console.log(`📊 Starting memory monitoring (${intervalSeconds}s interval)...`)
    
    this.monitorInterval = setInterval(async () => {
      await this.takeSnapshot()
    }, intervalSeconds * 1000)
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = undefined
    }
    this.monitoringActive = false
    console.log("⏸️  Monitoring stopped")
  }

  /**
   * Monitor a specific operation
   */
  async monitorOperation(
    operationName: string,
    operationFn: () => Promise<void>
  ): Promise<OperationMemory> {
    console.log(`\n🔍 Monitoring operation: ${operationName}`)
    
    const beforeSnapshot = await this.takeSnapshot(`${operationName} - before`)
    const startTime = Date.now()
    
    try {
      await operationFn()
    } catch (error) {
      console.error(`❌ Operation failed: ${error}`)
    }
    
    const afterSnapshot = await this.takeSnapshot(`${operationName} - after`)
    const duration = Date.now() - startTime
    
    const opMemory: OperationMemory = {
      operation: operationName,
      beforeMB: beforeSnapshot.containerMemoryMB,
      afterMB: afterSnapshot.containerMemoryMB,
      deltaMB: afterSnapshot.containerMemoryMB - beforeSnapshot.containerMemoryMB,
      duration,
      timestamp: beforeSnapshot.timestamp,
    }
    
    this.operations.push(opMemory)
    
    // Log result
    const emoji = opMemory.deltaMB > 100 ? "🚨" : opMemory.deltaMB > 50 ? "⚠️" : "✅"
    console.log(
      `${emoji} ${operationName}: ${opMemory.beforeMB.toFixed(1)}MB → ${opMemory.afterMB.toFixed(1)}MB (${opMemory.deltaMB > 0 ? "+" : ""}${opMemory.deltaMB.toFixed(1)}MB) in ${duration}ms`
    )
    
    return opMemory
  }

  /**
   * Run a test ACP agent session
   */
  async runTestAgentSession(): Promise<void> {
    console.log("🤖 Running test agent session...")
    
    // Simulate agent session via ACP
    await execAsync(
      `docker exec ${this.container} curl -s -X POST http://localhost:3000/acp/sessions -H "Content-Type: application/json" -d '{"prompt":"What is 2+2?","timeout":10000}' || true`
    )
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  /**
   * Run impulse loading test
   */
  async runImpulseLoadTest(): Promise<void> {
    console.log("📦 Running impulse load test...")
    
    // This simulates the 200MB spike issue from previous investigation
    await execAsync(
      `docker exec ${this.container} timeout 10s opencode run "echo test" || true`
    )
    
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  /**
   * Generate diagnostic report
   */
  async generateReport(): Promise<DiagnosticReport> {
    const now = new Date()
    
    if (this.snapshots.length === 0) {
      throw new Error("No snapshots collected")
    }
    
    // Calculate statistics
    const memoryValues = this.snapshots.map(s => s.containerMemoryMB)
    const baselineMemoryMB = memoryValues[0]
    const peakMemoryMB = Math.max(...memoryValues)
    const averageMemoryMB = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length
    const maxSpikeMB = Math.max(...this.operations.map(op => op.deltaMB))
    
    // Check for OOM risk
    const oomRisk = peakMemoryMB > 1500 || maxSpikeMB > 200
    
    // Identify concerning operations
    const concerningOperations = this.operations
      .filter(op => op.deltaMB > 100)
      .map(op => `${op.operation} (+${op.deltaMB.toFixed(1)}MB)`)
    
    const report: DiagnosticReport = {
      startTime: this.snapshots[0].timestamp,
      endTime: now,
      container: this.container,
      snapshots: this.snapshots,
      operations: this.operations,
      summary: {
        baselineMemoryMB,
        peakMemoryMB,
        averageMemoryMB,
        maxSpikeMB,
        oomRisk,
        concerningOperations,
      },
    }
    
    return report
  }

  /**
   * Print report to console
   */
  printReport(report: DiagnosticReport) {
    console.log("\n" + "=".repeat(70))
    console.log("📋 AGENT SESSION MEMORY DIAGNOSTIC REPORT")
    console.log("=".repeat(70))
    
    console.log(`\n📦 Container: ${report.container}`)
    console.log(`⏰ Duration: ${Math.round((report.endTime.getTime() - report.startTime.getTime()) / 1000)}s`)
    console.log(`📊 Snapshots: ${report.snapshots.length}`)
    console.log(`🔧 Operations: ${report.operations.length}`)
    
    console.log("\n📈 MEMORY STATISTICS:")
    console.log(`  Baseline:  ${report.summary.baselineMemoryMB.toFixed(1)} MB`)
    console.log(`  Peak:      ${report.summary.peakMemoryMB.toFixed(1)} MB`)
    console.log(`  Average:   ${report.summary.averageMemoryMB.toFixed(1)} MB`)
    console.log(`  Max Spike: ${report.summary.maxSpikeMB.toFixed(1)} MB`)
    
    if (report.summary.oomRisk) {
      console.log("\n🚨 OOM RISK DETECTED!")
      console.log("  Container memory usage or spikes exceed safe thresholds")
    } else {
      console.log("\n✅ Memory usage within safe limits")
    }
    
    if (report.summary.concerningOperations.length > 0) {
      console.log("\n⚠️  CONCERNING OPERATIONS:")
      report.summary.concerningOperations.forEach(op => {
        console.log(`  - ${op}`)
      })
    }
    
    console.log("\n🔍 OPERATION BREAKDOWN:")
    report.operations.forEach(op => {
      const emoji = op.deltaMB > 100 ? "🚨" : op.deltaMB > 50 ? "⚠️" : "✅"
      console.log(
        `  ${emoji} ${op.operation}: ${op.beforeMB.toFixed(1)}MB → ${op.afterMB.toFixed(1)}MB (${op.deltaMB > 0 ? "+" : ""}${op.deltaMB.toFixed(1)}MB)`
      )
    })
    
    console.log("\n" + "=".repeat(70))
  }

  /**
   * Save report to file
   */
  async saveReport(report: DiagnosticReport, filename: string = "agent-memory-diagnostic.json") {
    await writeFile(filename, JSON.stringify(report, null, 2))
    console.log(`\n💾 Report saved to: ${filename}`)
  }
}

/**
 * Main diagnostic routine
 */
async function main() {
  console.log("🔧 Agent Session Memory Diagnostic Tool")
  console.log("=" .repeat(70))
  
  const diagnostic = new AgentSessionMemoryDiagnostic("devbob-opencode")
  
  // Take baseline
  console.log("\n📊 Taking baseline measurement...")
  await diagnostic.takeSnapshot("baseline")
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Test 1: Simple agent session
  await diagnostic.monitorOperation("simple-agent-session", async () => {
    await diagnostic.runTestAgentSession()
  })
  
  // Wait for memory to settle
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Test 2: Impulse loading (known to cause spikes)
  await diagnostic.monitorOperation("impulse-loading", async () => {
    await diagnostic.runImpulseLoadTest()
  })
  
  // Wait for memory to settle
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Test 3: Multiple concurrent operations
  await diagnostic.monitorOperation("concurrent-operations", async () => {
    await Promise.all([
      diagnostic.runTestAgentSession(),
      diagnostic.runTestAgentSession(),
    ])
  })
  
  // Final measurement
  await new Promise(resolve => setTimeout(resolve, 5000))
  await diagnostic.takeSnapshot("final")
  
  // Generate and display report
  const report = await diagnostic.generateReport()
  diagnostic.printReport(report)
  await diagnostic.saveReport(report)
  
  // Analysis
  console.log("\n🧠 ANALYSIS:")
  
  if (report.summary.maxSpikeMB > 200) {
    console.log("  🚨 CRITICAL: Memory spikes exceed 200MB")
    console.log("     This matches the previous impulse loading issue.")
    console.log("     Recent fixes may not be fully effective.")
  } else if (report.summary.maxSpikeMB > 100) {
    console.log("  ⚠️  WARNING: Memory spikes exceed 100MB")
    console.log("     While improved from 200MB, there's still room for optimization.")
  } else {
    console.log("  ✅ GOOD: Memory spikes are under control (<100MB)")
    console.log("     Recent memory leak fixes appear to be working.")
  }
  
  if (report.summary.peakMemoryMB > 1500) {
    console.log("  🚨 CRITICAL: Peak memory exceeds 1.5GB")
    console.log("     Risk of OOM killer evicting container.")
  } else if (report.summary.peakMemoryMB > 1000) {
    console.log("  ⚠️  WARNING: Peak memory exceeds 1GB")
    console.log("     Monitor for potential evictions under heavy load.")
  } else {
    console.log("  ✅ GOOD: Peak memory usage is reasonable")
  }
  
  console.log("\n💡 RECOMMENDATIONS:")
  
  if (report.summary.oomRisk) {
    console.log("  1. Enable memory monitoring: Update opencode.json to enable memory.monitoring")
    console.log("  2. Reduce concurrent operations: Limit parallel agent sessions")
    console.log("  3. Increase container memory: Adjust docker-compose memory limits")
    console.log("  4. Investigate memory spikes: Profile heap allocations during operations")
  } else {
    console.log("  1. Continue monitoring: Run this diagnostic periodically")
    console.log("  2. Enable memory monitoring in production: Set memory.enabled=true in config")
    console.log("  3. Monitor for regressions: Watch for memory growth over time")
  }
  
  console.log("\n✅ Diagnostic complete!")
}

// Run diagnostic if executed directly
if (import.meta.main) {
  main().catch(error => {
    console.error("❌ Diagnostic failed:", error)
    process.exit(1)
  })
}

export { AgentSessionMemoryDiagnostic }
