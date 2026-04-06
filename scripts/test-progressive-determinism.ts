#!/usr/bin/env bun
/**
 * Test Progressive Determinism Model Selection
 *
 * Exercises the model selection logic without using actual LLMs.
 * Shows how model tier selection changes as patterns are learned.
 *
 * Usage:
 *   bun run scripts/test-progressive-determinism.ts
 */

import {
  selectModelForTaskWithPatterns,
  analyzePatternReadiness,
  calculateLearningCostSavings,
  generateLearningProgressionReport,
  type ModelSelection,
  type ActivityMetrics
} from "../repos/minibob/src/model-selector"
import type { ActivityTemplate, ActivityTask } from "../repos/minibob/src/types"
import type { ToolArgumentRecommendation } from "../repos/minibob/src/mcp"

// =============================================================================
// TEST DATA: Vessel Activity Templates
// =============================================================================

const VESSEL_SCAFFOLD_TEMPLATE: ActivityTemplate = {
  id: "vessel-scaffold",
  name: "Scaffold New Vessel",
  description: "Create directory structure and boilerplate for a new vessel",
  tags: ["vessel.create"],
  tasks: [
    {
      id: "create-dirs",
      description: "Create vessel directory structure",
      resolver: "bash",  // DETERMINISTIC
      inputImpulses: ["vesselPath"],
      config: { timeout: 5000 },
      prompt: { template: "", variables: [] }
    },
    {
      id: "generate-package",
      description: "Generate package.json for the vessel",
      prompt: {
        template: "Generate a package.json for vessel {{vesselName}}",
        variables: [{ name: "vesselName", type: "string", required: true }],
        maxTokens: 2000
      }
    },
    {
      id: "generate-types",
      description: "Generate TypeScript type definitions",
      prompt: {
        template: "Generate types.ts for vessel {{vesselName}}",
        variables: [{ name: "vesselName", type: "string", required: true }],
        maxTokens: 4000
      }
    },
    {
      id: "generate-index",
      description: "Generate main index.ts entry point",
      prompt: {
        template: "Generate index.ts for vessel {{vesselName}}",
        variables: [{ name: "vesselName", type: "string", required: true }],
        maxTokens: 4000
      }
    }
  ],
  variables: [
    { name: "vesselName", type: "string", required: true },
    { name: "vesselPath", type: "string", required: true }
  ]
}

// =============================================================================
// SIMULATION: Pattern Learning Over Time
// =============================================================================

/**
 * Simulate execution history at different stages
 */
function simulateExecutionHistory(stage: "new" | "learning" | "learned"): {
  metrics: ActivityMetrics | undefined
  patterns: ToolArgumentRecommendation[]
} {
  switch (stage) {
    case "new":
      // No history - first execution
      return {
        metrics: undefined,
        patterns: []
      }

    case "learning":
      // 5 executions, patterns emerging but not stable
      return {
        metrics: {
          activityId: "vessel-scaffold",
          totalExecutions: 5,
          successfulExecutions: 4,
          successRate: 0.8,
          avgDurationMs: 15000,
          avgCostUsd: 0.12,
          modelUsageDistribution: { "claude-sonnet-4-20250514": 5 },
          deterministicTaskRatio: 0.25  // 1 of 4 tasks is deterministic
        },
        patterns: [
          {
            toolName: "bash",
            argumentHash: "mkdir-p-vessel",
            arguments: { command: "mkdir -p {{path}}/src" },
            successRate: 1.0,
            timesUsed: 5,
            avgDurationMs: 50
          },
          {
            toolName: "write",
            argumentHash: "package-json",
            arguments: { filePath: "{{path}}/package.json" },
            successRate: 0.8,
            timesUsed: 5,
            avgDurationMs: 200
          }
        ]
      }

    case "learned":
      // 10+ executions, patterns are stable and reliable
      return {
        metrics: {
          activityId: "vessel-scaffold",
          totalExecutions: 12,
          successfulExecutions: 11,
          successRate: 0.917,
          avgDurationMs: 8000,
          avgCostUsd: 0.05,
          modelUsageDistribution: {
            "claude-sonnet-4-20250514": 3,
            "claude-haiku-4-5": 9
          },
          deterministicTaskRatio: 0.25
        },
        patterns: [
          {
            toolName: "bash",
            argumentHash: "mkdir-p-vessel",
            arguments: { command: "mkdir -p {{path}}/src" },
            successRate: 1.0,
            timesUsed: 12,
            avgDurationMs: 45
          },
          {
            toolName: "write",
            argumentHash: "package-json",
            arguments: { filePath: "{{path}}/package.json" },
            successRate: 0.917,
            timesUsed: 12,
            avgDurationMs: 180
          },
          {
            toolName: "write",
            argumentHash: "types-ts",
            arguments: { filePath: "{{path}}/src/types.ts" },
            successRate: 0.917,
            timesUsed: 12,
            avgDurationMs: 250
          },
          {
            toolName: "write",
            argumentHash: "index-ts",
            arguments: { filePath: "{{path}}/src/index.ts" },
            successRate: 0.833,
            timesUsed: 12,
            avgDurationMs: 300
          }
        ]
      }
  }
}

// =============================================================================
// TRACE: Model Selection Decisions
// =============================================================================

interface SelectionTrace {
  taskId: string
  taskDescription: string
  selection: ModelSelection
  stageContext: {
    executionCount: number
    patternCount: number
    avgPatternSuccess: number
  }
}

/**
 * Trace model selection for all tasks in a template
 */
function traceModelSelection(
  template: ActivityTemplate,
  metrics: ActivityMetrics | undefined,
  patterns: ToolArgumentRecommendation[],
  stageName: string
): SelectionTrace[] {
  const traces: SelectionTrace[] = []

  const avgPatternSuccess = patterns.length > 0
    ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length
    : 0

  for (const task of template.tasks) {
    const selection = selectModelForTaskWithPatterns(
      task,
      metrics,
      patterns
    )

    traces.push({
      taskId: task.id,
      taskDescription: task.description,
      selection,
      stageContext: {
        executionCount: metrics?.totalExecutions || 0,
        patternCount: patterns.length,
        avgPatternSuccess
      }
    })
  }

  return traces
}

// =============================================================================
// REPORT: Formatted Output
// =============================================================================

function formatSelectionTrace(traces: SelectionTrace[], stageName: string): string {
  const lines: string[] = []

  lines.push(`\n${"=".repeat(70)}`)
  lines.push(`STAGE: ${stageName}`)
  lines.push(`${"=".repeat(70)}`)

  if (traces.length > 0) {
    const ctx = traces[0]!.stageContext
    lines.push(`Executions: ${ctx.executionCount}`)
    lines.push(`Patterns: ${ctx.patternCount}`)
    lines.push(`Avg Pattern Success: ${(ctx.avgPatternSuccess * 100).toFixed(0)}%`)
  }

  lines.push(`\nTask Model Selections:`)
  lines.push(`${"-".repeat(70)}`)

  // Calculate totals
  const tierCounts = { deterministic: 0, learned: 0, standard: 0, new: 0 }
  let totalCostMultiplier = 0

  for (const trace of traces) {
    const sel = trace.selection
    tierCounts[sel.tier]++
    totalCostMultiplier += sel.costMultiplier

    const modelDisplay = sel.model === "none" ? "(no LLM)" : sel.model.replace("claude-", "")
    const costDisplay = sel.costMultiplier === 0 ? "FREE" : `${(sel.costMultiplier * 100).toFixed(0)}%`

    lines.push(`  ${trace.taskId.padEnd(20)} ${sel.tier.padEnd(14)} ${modelDisplay.padEnd(25)} ${costDisplay}`)
    lines.push(`    └─ ${sel.reasoning}`)
  }

  lines.push(`\n${"-".repeat(70)}`)
  lines.push(`Summary:`)
  lines.push(`  Deterministic: ${tierCounts.deterministic} tasks (0% cost)`)
  lines.push(`  Learned:       ${tierCounts.learned} tasks (33% cost)`)
  lines.push(`  Standard:      ${tierCounts.standard} tasks (100% cost)`)
  lines.push(`  New:           ${tierCounts.new} tasks (100% cost)`)

  const avgCostMultiplier = totalCostMultiplier / traces.length
  lines.push(`\n  Expected Cost: ${(avgCostMultiplier * 100).toFixed(0)}% of baseline`)

  return lines.join("\n")
}

function formatPatternAnalysis(patterns: ToolArgumentRecommendation[]): string {
  const analysis = analyzePatternReadiness(patterns)
  const lines: string[] = []

  lines.push(`\nPattern Readiness Analysis:`)
  lines.push(`  Ready for optimization: ${analysis.ready ? "YES ✓" : "NO ✗"}`)
  lines.push(`  Confidence: ${(analysis.confidence * 100).toFixed(0)}%`)
  lines.push(`  ${analysis.reasoning}`)

  if (analysis.topPatterns.length > 0) {
    lines.push(`\n  Top Patterns:`)
    for (const p of analysis.topPatterns) {
      const bar = "█".repeat(Math.round(p.successRate * 10))
      lines.push(`    ${p.toolName.padEnd(15)} ${bar} ${(p.successRate * 100).toFixed(0)}% (${p.uses} uses)`)
    }
  }

  return lines.join("\n")
}

// =============================================================================
// MAIN: Run Test
// =============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════╗")
  console.log("║       PROGRESSIVE DETERMINISM - MODEL SELECTION TEST               ║")
  console.log("╚════════════════════════════════════════════════════════════════════╝")
  console.log("\nThis test demonstrates how model selection evolves as patterns are learned.")
  console.log("No actual LLM calls are made - we simulate execution history.\n")

  const template = VESSEL_SCAFFOLD_TEMPLATE
  console.log(`Template: ${template.name} (${template.id})`)
  console.log(`Tasks: ${template.tasks.length}`)
  console.log(`  - ${template.tasks.map(t => t.id).join("\n  - ")}`)

  // Stage 1: New (no history)
  const newHistory = simulateExecutionHistory("new")
  const newTraces = traceModelSelection(template, newHistory.metrics, newHistory.patterns, "new")
  console.log(formatSelectionTrace(newTraces, "NEW - First Execution (no history)"))

  // Stage 2: Learning (some history, patterns emerging)
  const learningHistory = simulateExecutionHistory("learning")
  const learningTraces = traceModelSelection(template, learningHistory.metrics, learningHistory.patterns, "learning")
  console.log(formatSelectionTrace(learningTraces, "LEARNING - 5 Executions (patterns emerging)"))
  console.log(formatPatternAnalysis(learningHistory.patterns))

  // Stage 3: Learned (stable patterns)
  const learnedHistory = simulateExecutionHistory("learned")
  const learnedTraces = traceModelSelection(template, learnedHistory.metrics, learnedHistory.patterns, "learned")
  console.log(formatSelectionTrace(learnedTraces, "LEARNED - 12 Executions (stable patterns)"))
  console.log(formatPatternAnalysis(learnedHistory.patterns))

  // Cost Savings Analysis
  console.log(`\n${"=".repeat(70)}`)
  console.log("COST SAVINGS ANALYSIS")
  console.log(`${"=".repeat(70)}`)

  const newSavings = calculateLearningCostSavings(newHistory.metrics, newHistory.patterns)
  const learningSavings = calculateLearningCostSavings(learningHistory.metrics, learningHistory.patterns)
  const learnedSavings = calculateLearningCostSavings(learnedHistory.metrics, learnedHistory.patterns)

  console.log(`
Stage         Avg Cost    Projected   Savings
─────────────────────────────────────────────
New           $0.1500     $0.1500       0%
Learning      $${learningSavings.currentAvgCost.toFixed(4)}     $${learningSavings.projectedCost.toFixed(4)}      ${learningSavings.savingsPercent.toFixed(0)}%
Learned       $${learnedSavings.currentAvgCost.toFixed(4)}     $${learnedSavings.projectedCost.toFixed(4)}      ${learnedSavings.savingsPercent.toFixed(0)}%
`)

  // Full Learning Progression Report
  console.log(`\n${"=".repeat(70)}`)
  console.log("FULL LEARNING PROGRESSION REPORT")
  console.log(`${"=".repeat(70)}`)
  console.log(generateLearningProgressionReport("vessel-scaffold", learnedHistory.metrics, learnedHistory.patterns))

  // Trace Output (JSON format for integration)
  console.log(`\n${"=".repeat(70)}`)
  console.log("EXECUTION TRACE (JSON)")
  console.log(`${"=".repeat(70)}`)

  const executionTrace = {
    activityId: template.id,
    timestamp: new Date().toISOString(),
    stages: [
      { name: "new", traces: newTraces, metrics: newHistory.metrics, patterns: newHistory.patterns },
      { name: "learning", traces: learningTraces, metrics: learningHistory.metrics, patterns: learningHistory.patterns },
      { name: "learned", traces: learnedTraces, metrics: learnedHistory.metrics, patterns: learnedHistory.patterns }
    ],
    summary: {
      costReductionPercent: learnedSavings.savingsPercent,
      deterministicTaskRatio: 0.25,
      learnedTaskRatio: learnedSavings.tierDistribution.learned / 100,
      totalExecutionsSimulated: 12
    }
  }

  console.log(JSON.stringify(executionTrace, null, 2))

  console.log(`\n${"=".repeat(70)}`)
  console.log("TEST COMPLETE")
  console.log(`${"=".repeat(70)}`)
}

main().catch(console.error)
