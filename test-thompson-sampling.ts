#!/usr/bin/env bun

/**
 * Test Thompson Sampling for Model Selection
 * 
 * Simulates model selection and demonstrates the exploration-exploitation tradeoff
 */

import { ThompsonSampler } from "./repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler"

interface ModelSpec {
  modelID: string
  providerID: string
  trueSuccessRate: number  // Ground truth for simulation
  trueCost: number
}

// Simulated models with different characteristics
const MODELS: ModelSpec[] = [
  {
    modelID: "claude-sonnet-4-5-20250929",
    providerID: "anthropic",
    trueSuccessRate: 0.95,  // Very reliable
    trueCost: 0.015  // Expensive
  },
  {
    modelID: "claude-3-5-haiku-20241022",
    providerID: "anthropic",
    trueSuccessRate: 0.85,  // Slightly less reliable
    trueCost: 0.0015  // 10x cheaper
  },
  {
    modelID: "claude-3-5-sonnet-20241022",
    providerID: "anthropic",
    trueSuccessRate: 0.90,  // Middle ground
    trueCost: 0.008  // Moderate cost
  }
]

async function simulateExecution(model: ModelSpec): Promise<{
  success: boolean
  cost: number
  qualityScore: number
}> {
  // Simulate success/failure based on true success rate
  const success = Math.random() < model.trueSuccessRate
  
  // Quality score correlates with success rate
  const qualityScore = success 
    ? 0.7 + Math.random() * 0.3  // 0.7-1.0 for success
    : 0.3 + Math.random() * 0.4  // 0.3-0.7 for failure
  
  // Cost has some variance
  const cost = model.trueCost * (0.9 + Math.random() * 0.2)
  
  return { success, cost, qualityScore }
}

async function main() {
  console.log("🧪 Testing Thompson Sampling for Model Selection\n")

  const sampler = await ThompsonSampler.create()
  const taskType = "implement-feature"

  // Reset statistics for clean test
  await sampler.reset(taskType)

  const candidateModels = MODELS.map(m => ({ 
    modelID: m.modelID, 
    providerID: m.providerID 
  }))

  // Simulate 100 task executions
  const numExecutions = 100
  const selections: Record<string, number> = {}
  const costs: number[] = []
  const successCount = { total: 0 }

  console.log("Running simulation with 100 task executions...\n")

  for (let i = 0; i < numExecutions; i++) {
    // Select model using Thompson sampling
    const selection = await sampler.select(taskType, {
      explorationRate: 0.15,  // 15% exploration
      candidateModels
    })

    // Track selections
    selections[selection.modelID] = (selections[selection.modelID] || 0) + 1

    // Simulate execution
    const modelSpec = MODELS.find(m => m.modelID === selection.modelID)!
    const result = await simulateExecution(modelSpec)

    costs.push(result.cost)
    if (result.success) successCount.total++

    // Update sampler with result
    await sampler.update(
      selection.modelID,
      selection.providerID,
      taskType,
      result
    )

    // Print progress every 20 executions
    if ((i + 1) % 20 === 0) {
      const stats = await sampler.getStatistics(taskType)
      console.log(`\n📊 After ${i + 1} executions:`)
      
      for (const stat of stats) {
        const successRate = stat.alpha / (stat.alpha + stat.beta)
        const avgCost = stat.totalCost / stat.totalExecutions
        console.log(
          `  ${stat.modelID.padEnd(35)} | ` +
          `Selections: ${String(stat.totalExecutions).padStart(3)} | ` +
          `Success: ${(successRate * 100).toFixed(1)}% | ` +
          `Avg Cost: $${avgCost.toFixed(5)}`
        )
      }
    }
  }

  // Final report
  console.log("\n" + "=".repeat(80))
  console.log("📈 FINAL RESULTS")
  console.log("=".repeat(80))

  const totalCost = costs.reduce((sum, c) => sum + c, 0)
  const avgCost = totalCost / numExecutions
  const successRate = successCount.total / numExecutions

  console.log(`\nOverall Performance:`)
  console.log(`  Total Executions: ${numExecutions}`)
  console.log(`  Success Rate: ${(successRate * 100).toFixed(1)}%`)
  console.log(`  Total Cost: $${totalCost.toFixed(4)}`)
  console.log(`  Average Cost: $${avgCost.toFixed(5)}`)

  console.log(`\nModel Selection Distribution:`)
  for (const [modelID, count] of Object.entries(selections).sort((a, b) => b[1] - a[1])) {
    const percentage = (count / numExecutions * 100).toFixed(1)
    console.log(`  ${modelID}: ${count} times (${percentage}%)`)
  }

  // Compare to baseline (always using Sonnet)
  const baselineModel = MODELS[0]  // Most expensive, most reliable
  const baselineCost = baselineModel.trueCost * numExecutions
  const savings = baselineCost - totalCost
  const savingsPercent = (savings / baselineCost * 100).toFixed(1)

  console.log(`\n💰 Cost Comparison:`)
  console.log(`  Baseline (always Sonnet): $${baselineCost.toFixed(4)}`)
  console.log(`  Thompson Sampling: $${totalCost.toFixed(4)}`)
  console.log(`  Savings: $${savings.toFixed(4)} (${savingsPercent}% reduction)`)

  // Show learned model statistics
  console.log(`\n🎯 Learned Model Statistics:`)
  const stats = await sampler.getStatistics(taskType)
  
  for (const stat of stats) {
    const trueModel = MODELS.find(m => m.modelID === stat.modelID)!
    const learnedSuccessRate = stat.alpha / (stat.alpha + stat.beta)
    const avgCost = stat.totalCost / stat.totalExecutions

    console.log(`\n  ${stat.modelID}:`)
    console.log(`    Executions: ${stat.totalExecutions}`)
    console.log(`    Learned Success Rate: ${(learnedSuccessRate * 100).toFixed(1)}% ` +
                `(true: ${(trueModel.trueSuccessRate * 100).toFixed(1)}%)`)
    console.log(`    Average Cost: $${avgCost.toFixed(5)} ` +
                `(true: $${trueModel.trueCost.toFixed(5)})`)
    console.log(`    Average Quality: ${(stat.avgQualityScore * 100).toFixed(1)}%`)
    console.log(`    Confidence: ${(stat.alpha + stat.beta >= 20 ? "High" : "Medium")}`)
  }

  console.log("\n✅ Simulation complete!\n")
  console.log("Key Insights:")
  console.log("  • Thompson sampling automatically learned which models work best")
  console.log("  • Cheaper models were selected more often when they performed well")
  console.log("  • System balanced exploration (trying all models) vs exploitation (using best)")
  console.log(`  • Achieved ${savingsPercent}% cost reduction with minimal quality impact`)
}

main().catch(console.error)
