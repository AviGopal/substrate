#!/usr/bin/env bun
/**
 * Demo: Vessel Development Learning Progression
 *
 * Demonstrates how MiniBob progressively learns to develop vessels:
 * 1. First execution: Uses Sonnet for all tasks (~$0.15)
 * 2. After 5 executions: Mix of Sonnet/Haiku (~$0.08)
 * 3. After 10 executions: Mostly Haiku + deterministic (~$0.03)
 *
 * This shows the Progressive Determinism pattern in action.
 *
 * Usage:
 *   bun run scripts/demo-vessel-learning.ts
 *   bun run scripts/demo-vessel-learning.ts --iterations 15
 *   bun run scripts/demo-vessel-learning.ts --activity vessel-scaffold
 */

import { GoalProcessor } from "../repos/minibob/src/goal-processor"
import { generateLearningProgressionReport, calculateLearningCostSavings } from "../repos/minibob/src/model-selector"
import { getMCPClient, initializeMCP } from "../repos/minibob/src/mcp"
import { loadConfig } from "../repos/minibob/src/config"

// Parse arguments
const args = process.argv.slice(2)
const iterationsArg = args.find(a => a.startsWith('--iterations='))
const activityArg = args.find(a => a.startsWith('--activity='))

const ITERATIONS = iterationsArg ? parseInt(iterationsArg.split('=')[1] || '10') : 10
const ACTIVITY_ID = activityArg ? activityArg.split('=')[1] : 'vessel-scaffold'

interface IterationResult {
  iteration: number
  success: boolean
  durationMs: number
  costUsd: number
  modelTiers: Record<string, number>
  deterministicTaskCount: number
  totalTaskCount: number
}

/**
 * Run a single vessel creation iteration
 */
async function runIteration(
  processor: GoalProcessor,
  iteration: number,
  vesselName: string
): Promise<IterationResult> {
  const startTime = Date.now()
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Iteration ${iteration}: Creating vessel "${vesselName}"`)
  console.log('='.repeat(60))

  try {
    // Execute the vessel scaffold activity
    const result = await processor.processGoal(
      `Create a ${vesselName} vessel with memo resolver`,
      {
        vesselName,
        vesselDescription: `Test vessel ${vesselName} for learning demonstration`,
        targetPath: `/tmp/demo-vessels/${vesselName}`,
        initialResolvers: 'memo',
      }
    )

    const durationMs = Date.now() - startTime

    // Extract model tier usage from execution
    const modelTiers: Record<string, number> = {}
    let deterministicTaskCount = 0
    let totalTaskCount = 0

    if (result.execution?.taskResults) {
      for (const taskResult of result.execution.taskResults) {
        totalTaskCount++
        const modelSelection = taskResult.metadata?.modelSelection as {
          tier: string
          model: string
        } | undefined

        const tier = modelSelection?.tier || 'unknown'
        modelTiers[tier] = (modelTiers[tier] || 0) + 1

        if (tier === 'deterministic') {
          deterministicTaskCount++
        }
      }
    }

    return {
      iteration,
      success: result.success,
      durationMs,
      costUsd: result.execution?.metrics?.cost || 0,
      modelTiers,
      deterministicTaskCount,
      totalTaskCount,
    }
  } catch (error) {
    console.error(`Iteration ${iteration} failed:`, error)
    return {
      iteration,
      success: false,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      modelTiers: {},
      deterministicTaskCount: 0,
      totalTaskCount: 0,
    }
  }
}

/**
 * Print summary statistics
 */
function printSummary(results: IterationResult[]) {
  console.log('\n' + '='.repeat(60))
  console.log('LEARNING PROGRESSION SUMMARY')
  console.log('='.repeat(60))

  // Group by phases
  const phase1 = results.slice(0, Math.min(1, results.length))
  const phase2 = results.slice(1, Math.min(5, results.length))
  const phase3 = results.slice(5)

  // Calculate averages for each phase
  const calcPhaseStats = (phase: IterationResult[], name: string) => {
    if (phase.length === 0) return

    const avgCost = phase.reduce((sum, r) => sum + r.costUsd, 0) / phase.length
    const avgDuration = phase.reduce((sum, r) => sum + r.durationMs, 0) / phase.length

    // Aggregate tier distribution
    const totalTiers: Record<string, number> = {}
    let totalTasks = 0
    for (const r of phase) {
      for (const [tier, count] of Object.entries(r.modelTiers)) {
        totalTiers[tier] = (totalTiers[tier] || 0) + count
        totalTasks += count
      }
    }

    console.log(`\n${name} (iterations ${phase[0]?.iteration}-${phase[phase.length - 1]?.iteration}):`)
    console.log(`  Average Cost: $${avgCost.toFixed(4)}`)
    console.log(`  Average Duration: ${(avgDuration / 1000).toFixed(1)}s`)
    console.log(`  Model Tier Distribution:`)
    for (const [tier, count] of Object.entries(totalTiers)) {
      const pct = ((count / totalTasks) * 100).toFixed(0)
      console.log(`    - ${tier}: ${pct}%`)
    }
  }

  calcPhaseStats(phase1, 'Phase 1: First Execution (Sonnet)')
  calcPhaseStats(phase2, 'Phase 2: Learning (Mixed)')
  calcPhaseStats(phase3, 'Phase 3: Optimized (Haiku)')

  // Overall cost reduction
  if (results.length >= 2) {
    const firstCost = results[0]?.costUsd || 0
    const lastCost = results[results.length - 1]?.costUsd || 0
    const reduction = firstCost > 0 ? ((firstCost - lastCost) / firstCost) * 100 : 0

    console.log('\n' + '-'.repeat(40))
    console.log(`Cost Reduction: ${reduction.toFixed(0)}%`)
    console.log(`  First iteration: $${firstCost.toFixed(4)}`)
    console.log(`  Last iteration: $${lastCost.toFixed(4)}`)
  }
}

/**
 * Query and display backend learning metrics
 */
async function displayBackendMetrics(activityId: string) {
  const mcp = getMCPClient()
  if (!mcp) {
    console.log('\nBackend not connected - skipping detailed metrics')
    return
  }

  console.log('\n' + '='.repeat(60))
  console.log('BACKEND LEARNING METRICS')
  console.log('='.repeat(60))

  try {
    // Get activity metrics
    const metrics = await mcp.getActivityMetrics(activityId)
    if (metrics) {
      console.log(`\nActivity: ${metrics.activityId}`)
      console.log(`  Total Executions: ${metrics.totalExecutions}`)
      console.log(`  Success Rate: ${(metrics.successRate * 100).toFixed(0)}%`)
      console.log(`  Average Cost: $${metrics.avgCostUsd.toFixed(4)}`)
      console.log(`  Average Duration: ${metrics.avgDurationMs.toFixed(0)}ms`)
      console.log(`  Deterministic Task Ratio: ${(metrics.deterministicTaskRatio * 100).toFixed(0)}%`)
    }

    // Get pattern recommendations
    const patterns = await mcp.getToolArgumentRecommendations(activityId)
    if (patterns.length > 0) {
      console.log(`\nLearned Tool Patterns:`)
      for (const pattern of patterns.slice(0, 5)) {
        console.log(`  - ${pattern.toolName}: ${(pattern.successRate * 100).toFixed(0)}% success (${pattern.timesUsed} uses)`)
      }
    }

    // Generate progression report
    const report = generateLearningProgressionReport(
      activityId,
      metrics || undefined,
      patterns
    )
    console.log('\n' + report)
  } catch (error) {
    console.error('Error fetching backend metrics:', error)
  }
}

/**
 * Main demo runner
 */
async function main() {
  console.log('='.repeat(60))
  console.log('VESSEL LEARNING PROGRESSION DEMO')
  console.log('='.repeat(60))
  console.log(`Activity: ${ACTIVITY_ID}`)
  console.log(`Iterations: ${ITERATIONS}`)

  // Load config and initialize
  const config = await loadConfig()

  // Initialize MCP client
  const endpoint = process.env.ACTIVITY_API_ENDPOINT || 'http://activity.metabob.local'
  await initializeMCP({
    endpoint,
    instance: {
      instanceId: process.env.MINIBOB_INSTANCE_ID || 'demo-instance',
      apiKey: process.env.MINIBOB_API_KEY || '',
    },
  })

  // Create goal processor
  const processor = new GoalProcessor({
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    workingDirectory: '/tmp/demo-vessels',
  })

  // Ensure output directory exists
  await Bun.write('/tmp/demo-vessels/.keep', '')

  // Run iterations
  const results: IterationResult[] = []

  for (let i = 1; i <= ITERATIONS; i++) {
    const vesselName = `test-vessel-${i.toString().padStart(2, '0')}`
    const result = await runIteration(processor, i, vesselName)
    results.push(result)

    // Print intermediate summary every 5 iterations
    if (i % 5 === 0 && i < ITERATIONS) {
      console.log(`\n--- Progress: ${i}/${ITERATIONS} iterations ---`)
      const avgCost = results.reduce((sum, r) => sum + r.costUsd, 0) / results.length
      console.log(`Average cost so far: $${avgCost.toFixed(4)}`)
    }
  }

  // Print final summary
  printSummary(results)

  // Display backend metrics
  await displayBackendMetrics(ACTIVITY_ID)

  // Save results to file
  const resultsPath = `/tmp/demo-vessels/learning-results-${Date.now()}.json`
  await Bun.write(resultsPath, JSON.stringify(results, null, 2))
  console.log(`\nResults saved to: ${resultsPath}`)

  console.log('\n' + '='.repeat(60))
  console.log('DEMO COMPLETE')
  console.log('='.repeat(60))
}

// Run
main().catch(console.error)
