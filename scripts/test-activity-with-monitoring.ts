#!/usr/bin/env bun
/**
 * Activity Execution with Monitoring
 * 
 * This script:
 * 1. Records baseline memory usage
 * 2. Executes an activity in devbob-opencode container
 * 3. Monitors memory usage during execution
 * 4. Captures session messages and logs
 * 5. Generates observability report
 * 
 * Usage:
 *   bun run test-activity-with-monitoring.ts
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"
import { writeFile } from "fs/promises"

console.log("╔══════════════════════════════════════════════════════════╗")
console.log("║     Activity Execution with Memory Monitoring           ║")
console.log("╚══════════════════════════════════════════════════════════╝\n")

const CONTAINER_NAME = "devbob-opencode"
const TARGET = `docker://${CONTAINER_NAME}`
const TEST_SESSION_ID = `test-monitored-activity-${Date.now()}`
const MONITORING_INTERVAL = 2000 // Sample memory every 2 seconds

interface MemorySample {
  timestamp: number
  memoryUsageMB: number
  memoryLimitMB: number
  memoryPercent: number
  cpuPercent: number
}

interface MonitoringResult {
  baseline: MemorySample
  samples: MemorySample[]
  peak: MemorySample
  average: MemorySample
  growth: number
  duration: number
}

async function getMemoryStats(): Promise<MemorySample> {
  try {
    const result = await Bun.$`docker stats ${CONTAINER_NAME} --no-stream --format "{{.MemUsage}}|{{.MemPerc}}|{{.CPUPerc}}"`.quiet()
    const output = result.stdout.toString().trim()
    const [memUsage, memPercent, cpuPercent] = output.split("|")

    // Parse memory usage (e.g., "123.4MiB / 2GiB" or "1.5GiB / 8GiB")
    const memMatch = memUsage.match(/([\d.]+)(\w+)\s*\/\s*([\d.]+)(\w+)/)
    if (!memMatch) {
      throw new Error(`Failed to parse memory usage: ${memUsage}`)
    }

    const [, usedValue, usedUnit, limitValue, limitUnit] = memMatch

    // Convert to MB
    const toMB = (value: string, unit: string): number => {
      const num = parseFloat(value)
      if (unit.startsWith("G")) return num * 1024
      if (unit.startsWith("M")) return num
      if (unit.startsWith("K")) return num / 1024
      return num
    }

    return {
      timestamp: Date.now(),
      memoryUsageMB: toMB(usedValue, usedUnit),
      memoryLimitMB: toMB(limitValue, limitUnit),
      memoryPercent: parseFloat(memPercent.replace("%", "")),
      cpuPercent: parseFloat(cpuPercent.replace("%", "")),
    }
  } catch (error) {
    console.error("Failed to get memory stats:", error)
    return {
      timestamp: Date.now(),
      memoryUsageMB: 0,
      memoryLimitMB: 0,
      memoryPercent: 0,
      cpuPercent: 0,
    }
  }
}

async function startMemoryMonitoring(stopSignal: { stop: boolean }): Promise<MemorySample[]> {
  const samples: MemorySample[] = []

  const monitor = async () => {
    while (!stopSignal.stop) {
      const sample = await getMemoryStats()
      samples.push(sample)
      await Bun.sleep(MONITORING_INTERVAL)
    }
  }

  monitor() // Start monitoring (don't await)
  return samples
}

async function getContainerLogs(since: string = "5m"): Promise<string> {
  try {
    const result = await Bun.$`docker logs ${CONTAINER_NAME} --since ${since} --tail 500`.quiet()
    return result.stdout.toString() + result.stderr.toString()
  } catch (error) {
    return `Failed to get logs: ${error}`
  }
}

async function getSessionMessages(sessionId: string): Promise<string> {
  try {
    // Try to read session message log from container
    const result =
      await Bun.$`docker exec ${CONTAINER_NAME} cat /workspace/.metabob/logs/core.log 2>/dev/null | grep "${sessionId}" | tail -100`.quiet()
    return result.stdout.toString()
  } catch (error) {
    return `Session messages not available: ${error}`
  }
}

function analyzeMonitoring(samples: MemorySample[]): MonitoringResult {
  if (samples.length === 0) {
    return {
      baseline: samples[0] || {
        timestamp: Date.now(),
        memoryUsageMB: 0,
        memoryLimitMB: 0,
        memoryPercent: 0,
        cpuPercent: 0,
      },
      samples: [],
      peak: samples[0],
      average: samples[0],
      growth: 0,
      duration: 0,
    }
  }

  const baseline = samples[0]
  const peak = samples.reduce((max, s) => (s.memoryUsageMB > max.memoryUsageMB ? s : max), samples[0])

  const avgMemory = samples.reduce((sum, s) => sum + s.memoryUsageMB, 0) / samples.length
  const avgMemPercent = samples.reduce((sum, s) => sum + s.memoryPercent, 0) / samples.length
  const avgCPU = samples.reduce((sum, s) => sum + s.cpuPercent, 0) / samples.length

  const duration = samples[samples.length - 1].timestamp - samples[0].timestamp

  return {
    baseline,
    samples,
    peak,
    average: {
      timestamp: Date.now(),
      memoryUsageMB: avgMemory,
      memoryLimitMB: baseline.memoryLimitMB,
      memoryPercent: avgMemPercent,
      cpuPercent: avgCPU,
    },
    growth: peak.memoryUsageMB - baseline.memoryUsageMB,
    duration,
  }
}

// Main execution
await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    console.log("📊 Phase 1: Baseline Measurement")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    const baseline = await getMemoryStats()
    console.log(`Container: ${CONTAINER_NAME}`)
    console.log(`Memory Usage: ${baseline.memoryUsageMB.toFixed(2)} MB / ${baseline.memoryLimitMB.toFixed(2)} MB`)
    console.log(`Memory Percent: ${baseline.memoryPercent.toFixed(2)}%`)
    console.log(`CPU Percent: ${baseline.cpuPercent.toFixed(2)}%`)
    console.log("")

    console.log("🚀 Phase 2: Activity Execution with Monitoring")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    // Start memory monitoring
    const stopSignal = { stop: false }
    const samples = await startMemoryMonitoring(stopSignal)

    const startTime = Date.now()

    console.log("Executing test activity via ACP...")
    console.log(`Session ID: ${TEST_SESSION_ID}`)
    console.log(`Target: ${TARGET}`)
    console.log("")

    try {
      const acpTool = await ACPDelegateTool.init()

      // Execute a medium-complexity activity to generate observable behavior
      const result = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Test activity for monitoring",
          prompt: `Execute a test workflow to generate observable behavior:

1. Search for activity templates using search_activities (category: "feature")
2. Use metabob_search_codebase_issues to query for "memory" issues
3. Call metabob_get_priority_issues to get current priority issues
4. List files in the current directory using bash tool
5. Create a small test impulse (if impulse tools available)

This generates measurable activity including:
- Tool calls (5-7 tools)
- Memory allocation (impulse creation)
- API calls (metabob queries)
- File operations (directory listing)

Report:
- Total tools executed
- Any errors encountered
- Approximate memory used for impulses
- Time taken for each step`,
          timeout: 180,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      // Stop monitoring
      stopSignal.stop = true
      await Bun.sleep(1000) // Wait for last sample

      console.log("\n✅ Activity Completed")
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s`)
      console.log(`Response Length: ${result.output.length} characters`)
      console.log("")

      if (result.metadata?.toolsUsed) {
        console.log(`Tools Used: ${result.metadata.toolsUsed}`)
      }

      console.log("\n📈 Phase 3: Memory Analysis")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

      const analysis = analyzeMonitoring(samples)

      console.log("Memory Statistics:")
      console.log(`  Baseline:  ${analysis.baseline.memoryUsageMB.toFixed(2)} MB (${analysis.baseline.memoryPercent.toFixed(2)}%)`)
      console.log(`  Peak:      ${analysis.peak.memoryUsageMB.toFixed(2)} MB (${analysis.peak.memoryPercent.toFixed(2)}%)`)
      console.log(`  Average:   ${analysis.average.memoryUsageMB.toFixed(2)} MB (${analysis.average.memoryPercent.toFixed(2)}%)`)
      console.log(`  Growth:    ${analysis.growth >= 0 ? "+" : ""}${analysis.growth.toFixed(2)} MB`)
      console.log("")

      console.log("CPU Statistics:")
      console.log(`  Baseline:  ${analysis.baseline.cpuPercent.toFixed(2)}%`)
      console.log(`  Average:   ${analysis.average.cpuPercent.toFixed(2)}%`)
      console.log("")

      console.log("Sampling:")
      console.log(`  Interval:  ${MONITORING_INTERVAL}ms`)
      console.log(`  Samples:   ${samples.length}`)
      console.log(`  Duration:  ${(analysis.duration / 1000).toFixed(2)}s`)
      console.log("")

      // Memory growth rate
      const growthRateMBPerMin = (analysis.growth / (analysis.duration / 60000)).toFixed(2)
      console.log(`Memory Growth Rate: ${growthRateMBPerMin} MB/min`)
      console.log("")

      // Health assessment
      console.log("Health Assessment:")
      if (analysis.peak.memoryPercent > 90) {
        console.log("  🔴 CRITICAL: Memory usage > 90%")
      } else if (analysis.peak.memoryPercent > 80) {
        console.log("  🟡 WARNING: Memory usage > 80%")
      } else if (analysis.peak.memoryPercent > 70) {
        console.log("  🟠 CAUTION: Memory usage > 70%")
      } else {
        console.log("  ✅ HEALTHY: Memory usage within normal range")
      }

      if (Math.abs(parseFloat(growthRateMBPerMin)) > 10) {
        console.log(`  ⚠️  HIGH GROWTH RATE: ${growthRateMBPerMin} MB/min`)
      }
      console.log("")

      console.log("📝 Phase 4: Log Collection")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

      console.log("Collecting logs...")
      const logs = await getContainerLogs("5m")
      const sessionMessages = await getSessionMessages(TEST_SESSION_ID)

      console.log(`Container logs: ${logs.split("\n").length} lines`)
      console.log(`Session messages: ${sessionMessages.split("\n").length} lines`)
      console.log("")

      // Save detailed report
      const report = {
        test: {
          sessionId: TEST_SESSION_ID,
          timestamp: new Date().toISOString(),
          duration: duration,
        },
        activity: {
          success: result.metadata?.success || false,
          responseLength: result.output.length,
          toolsUsed: result.metadata?.toolsUsed || 0,
        },
        memory: {
          baseline: analysis.baseline,
          peak: analysis.peak,
          average: analysis.average,
          growth: analysis.growth,
          growthRateMBPerMin: parseFloat(growthRateMBPerMin),
          samples: samples.length,
          samplingInterval: MONITORING_INTERVAL,
        },
        logs: {
          containerLines: logs.split("\n").length,
          sessionLines: sessionMessages.split("\n").length,
        },
        memoryTimeline: samples.map((s) => ({
          timestamp: s.timestamp - startTime,
          memoryMB: s.memoryUsageMB,
          memoryPercent: s.memoryPercent,
          cpuPercent: s.cpuPercent,
        })),
        containerLogs: logs.split("\n").slice(-100), // Last 100 lines
        sessionMessages: sessionMessages.split("\n").slice(-50), // Last 50 lines
        agentResponse: result.output,
      }

      const reportPath = "./activity-monitoring-report.json"
      await writeFile(reportPath, JSON.stringify(report, null, 2))

      console.log("📊 Phase 5: Report Generation")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

      console.log(`Detailed report saved to: ${reportPath}`)
      console.log("")

      console.log("Report includes:")
      console.log("  ✓ Memory timeline (all samples)")
      console.log("  ✓ Container logs (last 100 lines)")
      console.log("  ✓ Session messages (last 50 lines)")
      console.log("  ✓ Agent response (full)")
      console.log("  ✓ Statistics and metrics")
      console.log("")

      // Print sample of memory timeline
      console.log("Memory Timeline Sample (first 5 samples):")
      samples.slice(0, 5).forEach((s, i) => {
        const elapsed = ((s.timestamp - startTime) / 1000).toFixed(1)
        console.log(
          `  T+${elapsed}s: ${s.memoryUsageMB.toFixed(2)} MB (${s.memoryPercent.toFixed(1)}%) CPU: ${s.cpuPercent.toFixed(1)}%`,
        )
      })
      if (samples.length > 5) {
        console.log(`  ... (${samples.length - 5} more samples)`)
      }
      console.log("")

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      console.log("Summary")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

      console.log("Activity Execution:")
      console.log(`  ✓ Completed successfully`)
      console.log(`  ✓ Duration: ${(duration / 1000).toFixed(2)}s`)
      console.log(`  ✓ Tools used: ${result.metadata?.toolsUsed || "N/A"}`)
      console.log("")

      console.log("Memory Impact:")
      console.log(`  ${analysis.growth >= 0 ? "📈" : "📉"} Growth: ${analysis.growth >= 0 ? "+" : ""}${analysis.growth.toFixed(2)} MB`)
      console.log(`  📊 Peak usage: ${analysis.peak.memoryPercent.toFixed(1)}%`)
      console.log(`  ⚡ Growth rate: ${growthRateMBPerMin} MB/min`)
      console.log("")

      console.log("Observability:")
      console.log(`  ✓ ${samples.length} memory samples collected`)
      console.log(`  ✓ ${logs.split("\n").length} log lines captured`)
      console.log(`  ✓ ${sessionMessages.split("\n").length} session messages logged`)
      console.log(`  ✓ Full report: ${reportPath}`)
      console.log("")

      // Print abbreviated agent response
      console.log("Agent Response Preview:")
      console.log("─".repeat(60))
      console.log(result.output.slice(0, 500) + "...")
      console.log("─".repeat(60))
      console.log("")

      console.log("✅ Monitoring complete. Review the report for detailed analysis.")
    } catch (error) {
      stopSignal.stop = true
      console.error("❌ Activity execution failed:", error)
      throw error
    }
  },
})
