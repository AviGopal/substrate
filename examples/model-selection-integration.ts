#!/usr/bin/env bun

/**
 * Example: Integrating Thompson Sampling with Activity Execution
 * 
 * This shows how to integrate the model selection system with
 * the existing activity task execution flow.
 */

import { ThompsonSampler } from "../repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler"

// Mock types for illustration
interface ActivityTask {
  id: string
  type: string  // e.g., "implement-feature", "fix-bug", "refactor"
  description: string
  subagent: string
}

interface TaskResult {
  success: boolean
  cost: number
  duration: number
  validationPassed: boolean
  staticAnalysisIssues: number
  output: string
}

/**
 * Compute quality score from task result
 * 
 * Scoring breakdown:
 * - Validation: 40% (tests must pass)
 * - Static analysis: 20% (code quality)
 * - Completeness: 30% (did it do what was asked?)
 * - Human feedback: 10% (optional)
 */
function computeQualityScore(result: TaskResult): number {
  let score = 0

  // Validation pass/fail (critical)
  if (result.validationPassed) {
    score += 0.4
  }

  // Static analysis quality
  const issuesPenalty = Math.min(result.staticAnalysisIssues * 0.05, 0.2)
  score += 0.2 - issuesPenalty

  // Completeness (simplified: assume success = complete)
  if (result.success) {
    score += 0.3
  }

  // Human feedback would go here (optional)
  // For now, we'll skip this component

  return Math.max(0, Math.min(1, score))
}

/**
 * Execute activity task with model selection optimization
 */
async function executeTaskWithOptimization(task: ActivityTask): Promise<TaskResult> {
  console.log(`\n📋 Executing task: ${task.description}`)
  console.log(`   Task type: ${task.type}`)

  // 1. Initialize Thompson Sampler
  const sampler = await ThompsonSampler.create()

  // 2. Select model variant
  const selection = await sampler.select(task.type, {
    explorationRate: 0.15,  // 15% exploration
    candidateModels: [
      { modelID: "claude-sonnet-4-5-20250929", providerID: "anthropic" },
      { modelID: "claude-3-5-haiku-20241022", providerID: "anthropic" },
      { modelID: "claude-3-5-sonnet-20241022", providerID: "anthropic" }
    ]
  })

  console.log(`\n🤖 Selected model: ${selection.modelID}`)
  console.log(`   Reason: ${selection.reason}`)
  console.log(`   Confidence: ${(selection.confidence * 100).toFixed(1)}%`)
  console.log(`   Expected success rate: ${(selection.expectedSuccessRate * 100).toFixed(1)}%`)
  console.log(`   Expected cost: $${selection.expectedCost.toFixed(5)}`)

  // 3. Execute task with selected model
  // (In real implementation, this would call the actual task executor)
  const result = await mockExecuteTask(task, selection.modelID)

  console.log(`\n✅ Task execution complete`)
  console.log(`   Success: ${result.success}`)
  console.log(`   Cost: $${result.cost.toFixed(5)}`)
  console.log(`   Duration: ${result.duration}s`)
  console.log(`   Validation: ${result.validationPassed ? "✓ Passed" : "✗ Failed"}`)
  console.log(`   Static analysis issues: ${result.staticAnalysisIssues}`)

  // 4. Compute quality score
  const qualityScore = computeQualityScore(result)
  console.log(`   Quality score: ${(qualityScore * 100).toFixed(1)}%`)

  // 5. Update Thompson Sampler with result
  await sampler.update(
    selection.modelID,
    selection.providerID,
    task.type,
    {
      success: result.validationPassed && result.staticAnalysisIssues < 5,
      cost: result.cost,
      qualityScore
    }
  )

  console.log(`\n📊 Updated model statistics for task type: ${task.type}`)

  return result
}

/**
 * Mock task execution (in real system, this would call Agent.execute)
 */
async function mockExecuteTask(task: ActivityTask, modelID: string): Promise<TaskResult> {
  // Simulate execution delay
  await new Promise(resolve => setTimeout(resolve, 100))

  // Simulate different model characteristics
  let successRate: number
  let baseCost: number

  if (modelID.includes("sonnet-4-5")) {
    successRate = 0.95
    baseCost = 0.015
  } else if (modelID.includes("haiku")) {
    successRate = 0.85
    baseCost = 0.0015
  } else {
    successRate = 0.90
    baseCost = 0.008
  }

  const success = Math.random() < successRate
  const validationPassed = success
  const staticAnalysisIssues = success ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 10)

  return {
    success,
    cost: baseCost * (0.9 + Math.random() * 0.2),
    duration: 5 + Math.random() * 10,
    validationPassed,
    staticAnalysisIssues,
    output: "Task completed successfully"
  }
}

/**
 * View model statistics for a task type
 */
async function viewModelStatistics(taskType: string) {
  const sampler = await ThompsonSampler.create()
  const stats = await sampler.getStatistics(taskType)

  console.log(`\n📊 Model Statistics for task type: ${taskType}`)
  console.log("=".repeat(100))

  if (stats.length === 0) {
    console.log("No statistics available yet. Run some tasks first!")
    return
  }

  for (const stat of stats) {
    const successRate = stat.alpha / (stat.alpha + stat.beta)
    const avgCost = stat.totalCost / stat.totalExecutions
    const confidence = stat.totalExecutions >= 20 ? "High" : stat.totalExecutions >= 10 ? "Medium" : "Low"

    console.log(`\n${stat.modelID}`)
    console.log(`  Executions: ${stat.totalExecutions}`)
    console.log(`  Success rate: ${(successRate * 100).toFixed(1)}% (α=${stat.alpha.toFixed(1)}, β=${stat.beta.toFixed(1)})`)
    console.log(`  Average cost: $${avgCost.toFixed(5)}`)
    console.log(`  Average quality: ${(stat.avgQualityScore * 100).toFixed(1)}%`)
    console.log(`  Confidence: ${confidence}`)
    console.log(`  Last updated: ${new Date(stat.lastUpdated).toLocaleString()}`)
  }
}

/**
 * Compare cost savings vs baseline
 */
async function compareCostSavings(taskType: string, numExecutions: number) {
  const sampler = await ThompsonSampler.create()
  
  // Get statistics
  const stats = await sampler.getStatistics(taskType)
  
  if (stats.length === 0) {
    console.log("No statistics available for cost comparison")
    return
  }

  // Calculate weighted average cost (based on actual selections)
  const totalExecutions = stats.reduce((sum, s) => sum + s.totalExecutions, 0)
  const totalCost = stats.reduce((sum, s) => sum + s.totalCost, 0)
  const avgCostWithOptimization = totalCost / totalExecutions

  // Calculate baseline cost (always using most expensive/reliable model)
  const baselineModel = stats.reduce((max, s) => {
    const avgCost = s.totalCost / s.totalExecutions
    const maxCost = max.totalCost / max.totalExecutions
    return avgCost > maxCost ? s : max
  })
  const baselineCost = baselineModel.totalCost / baselineModel.totalExecutions

  // Project savings
  const costWithOptimization = avgCostWithOptimization * numExecutions
  const costWithBaseline = baselineCost * numExecutions
  const savings = costWithBaseline - costWithOptimization
  const savingsPercent = (savings / costWithBaseline * 100).toFixed(1)

  console.log(`\n💰 Cost Savings Analysis`)
  console.log("=".repeat(80))
  console.log(`\nTask type: ${taskType}`)
  console.log(`Projected executions: ${numExecutions}`)
  console.log(`\nBaseline (always ${baselineModel.modelID}):`)
  console.log(`  Cost per execution: $${baselineCost.toFixed(5)}`)
  console.log(`  Total cost: $${costWithBaseline.toFixed(4)}`)
  console.log(`\nWith Thompson Sampling:`)
  console.log(`  Avg cost per execution: $${avgCostWithOptimization.toFixed(5)}`)
  console.log(`  Total cost: $${costWithOptimization.toFixed(4)}`)
  console.log(`\n💵 Savings: $${savings.toFixed(4)} (${savingsPercent}% reduction)`)
}

/**
 * Main demonstration
 */
async function main() {
  console.log("🚀 Model Selection Optimization - Integration Example\n")

  // Simulate executing various tasks
  const tasks: ActivityTask[] = [
    { id: "1", type: "implement-feature", description: "Add user authentication", subagent: "general" },
    { id: "2", type: "implement-feature", description: "Create REST API endpoint", subagent: "general" },
    { id: "3", type: "fix-bug", description: "Fix null pointer exception", subagent: "general" },
    { id: "4", type: "implement-feature", description: "Add logging system", subagent: "general" },
    { id: "5", type: "refactor", description: "Extract helper functions", subagent: "general" },
    { id: "6", type: "implement-feature", description: "Build payment integration", subagent: "general" },
    { id: "7", type: "fix-bug", description: "Fix race condition", subagent: "general" },
    { id: "8", type: "implement-feature", description: "Add input validation", subagent: "general" }
  ]

  // Execute tasks
  for (const task of tasks) {
    await executeTaskWithOptimization(task)
  }

  // View statistics
  console.log("\n" + "=".repeat(100))
  await viewModelStatistics("implement-feature")
  await viewModelStatistics("fix-bug")

  // Compare cost savings
  console.log("\n" + "=".repeat(100))
  await compareCostSavings("implement-feature", 100)

  console.log("\n✅ Example complete!\n")
  console.log("Key takeaways:")
  console.log("  • Thompson sampling automatically selects optimal models")
  console.log("  • Quality scores ensure we maintain code quality")
  console.log("  • Cost savings are tracked and projected")
  console.log("  • System learns and adapts over time")
}

main().catch(console.error)
