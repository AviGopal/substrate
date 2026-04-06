#!/usr/bin/env bun
/**
 * Trace Execution Structure
 *
 * Demonstrates the execution trace data structure that would be recorded
 * to the backend during activity execution. Shows how Progressive Determinism
 * model selection decisions are tracked.
 *
 * Usage:
 *   bun run scripts/trace-execution-structure.ts
 */

import type {
  ActivityTemplate,
  ActivityExecution,
  ExecutionTrace,
  ExecutedTask,
  TaskResult,
  ToolCall
} from "../repos/minibob/src/types"
import {
  selectModelForTaskWithPatterns,
  type ModelSelection,
  type ActivityMetrics
} from "../repos/minibob/src/model-selector"
import type { ToolArgumentRecommendation } from "../repos/minibob/src/mcp"

// =============================================================================
// LOAD ACTUAL TEMPLATE
// =============================================================================

async function loadVesselScaffoldTemplate(): Promise<ActivityTemplate> {
  const file = Bun.file("repos/metabob-proto/activities/vessel/vessel-scaffold.json")
  return await file.json() as ActivityTemplate
}

// =============================================================================
// SIMULATE EXECUTION WITH TRACES
// =============================================================================

interface SimulatedExecution {
  execution: ActivityExecution
  modelSelections: Map<string, ModelSelection>
  backendTracePayload: BackendTracePayload
}

/**
 * What would be sent to POST /v2/activities/execution-traces
 */
interface BackendTracePayload {
  template_id: string
  execution_id: string
  org_id: string
  status: string
  started_at: string
  completed_at: string
  duration_ms: number
  cost_usd: number
  total_tokens: { input: number; output: number }
  tasks: BackendTaskTrace[]
  impulses_created: string[]
  files_modified: string[]
  goal_context?: {
    goal: string
    intent: string
    context: Record<string, unknown>
  }
}

interface BackendTaskTrace {
  task_id: string
  description: string
  status: string
  started_at: string
  completed_at: string
  duration_ms: number
  tokens: { input: number; output: number }
  tool_calls: ToolCall[]
  model_selection?: {
    model: string
    tier: string
    reasoning: string
    cost_multiplier: number
  }
  resolver?: string
  actual_prompt?: string
}

function simulateExecution(
  template: ActivityTemplate,
  metrics: ActivityMetrics | undefined,
  patterns: ToolArgumentRecommendation[],
  stageName: string
): SimulatedExecution {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const startTime = Date.now()
  const modelSelections = new Map<string, ModelSelection>()

  // Simulate each task
  const taskResults: TaskResult[] = []
  const taskTraces: BackendTaskTrace[] = []

  for (const task of template.tasks) {
    const taskStartTime = Date.now()

    // Get model selection for this task
    const modelSelection = selectModelForTaskWithPatterns(task, metrics, patterns)
    modelSelections.set(task.id, modelSelection)

    // Simulate task duration based on tier
    const simulatedDuration = modelSelection.tier === "deterministic"
      ? 50 + Math.random() * 50  // 50-100ms for deterministic
      : modelSelection.tier === "learned"
      ? 500 + Math.random() * 500  // 500-1000ms for haiku
      : 1500 + Math.random() * 1500  // 1500-3000ms for sonnet

    // Simulate tokens based on tier
    const simulatedTokens = modelSelection.tier === "deterministic"
      ? { input: 0, output: 0 }
      : modelSelection.tier === "learned"
      ? { input: 500, output: 200 }
      : { input: 1500, output: 500 }

    // Simulate tool calls
    const toolCalls: ToolCall[] = []
    if (task.resolver === "bash") {
      toolCalls.push({
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: "bash",
        arguments: { command: task.config?.template || "echo 'simulated'" },
        result: { success: true, output: "Directories created successfully" }
      })
    } else {
      // LLM task - simulate write tool call
      toolCalls.push({
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: "write",
        arguments: { filePath: `simulated/${task.id}.ts`, content: "// simulated content" },
        result: { success: true }
      })
    }

    const taskEndTime = taskStartTime + simulatedDuration

    // Create TaskResult
    taskResults.push({
      taskId: task.id,
      status: "completed",
      output: `Task ${task.id} completed successfully`,
      startedAt: taskStartTime,
      completedAt: taskEndTime,
      tokens: simulatedTokens,
      metadata: {
        toolCalls,
        modelSelection: {
          model: modelSelection.model === "none" ? "none" : modelSelection.model,
          tier: modelSelection.tier,
          reasoning: modelSelection.reasoning,
          costMultiplier: modelSelection.costMultiplier
        },
        resolver: task.resolver
      }
    })

    // Create backend trace format
    taskTraces.push({
      task_id: task.id,
      description: task.description,
      status: "completed",
      started_at: new Date(taskStartTime).toISOString(),
      completed_at: new Date(taskEndTime).toISOString(),
      duration_ms: simulatedDuration,
      tokens: simulatedTokens,
      tool_calls: toolCalls,
      model_selection: {
        model: modelSelection.model,
        tier: modelSelection.tier,
        reasoning: modelSelection.reasoning,
        cost_multiplier: modelSelection.costMultiplier
      },
      resolver: task.resolver,
      actual_prompt: task.prompt?.template?.substring(0, 200) + "..."
    })
  }

  const endTime = startTime + taskResults.reduce((sum, t) => sum + ((t.completedAt || 0) - (t.startedAt || 0)), 0)
  const totalDuration = endTime - startTime
  const totalTokens = taskResults.reduce(
    (acc, t) => ({
      input: acc.input + (t.tokens?.input || 0),
      output: acc.output + (t.tokens?.output || 0)
    }),
    { input: 0, output: 0 }
  )

  // Calculate cost based on model selections
  const totalCost = taskResults.reduce((sum, t) => {
    const selection = modelSelections.get(t.taskId)
    if (!selection || selection.costMultiplier === 0) return sum
    // Estimate cost: ~$0.003 per 1K input tokens for Sonnet, ~$0.001 for Haiku
    const baseCost = (t.tokens?.input || 0) * 0.000003 + (t.tokens?.output || 0) * 0.000015
    return sum + baseCost * selection.costMultiplier
  }, 0)

  // Create execution trace
  const executionTrace: ExecutionTrace = {
    tasks: template.tasks.map((task, i) => ({
      id: task.id,
      description: task.description,
      actualPrompt: task.prompt?.template || `Resolver: ${task.resolver}`,
      toolCalls: taskTraces[i]?.tool_calls || [],
      response: `Task ${task.id} completed successfully`,
      result: { status: "success" as const }
    })),
    impulsesCreated: [],
    filesModified: ["repos/test-vessel/package.json", "repos/test-vessel/src/index.ts"],
    goalContext: {
      goal: "Create a test vessel",
      intent: "scaffold",
      context: { vesselName: "test-vessel", targetPath: "repos/test-vessel" }
    }
  }

  // Create ActivityExecution
  const execution: ActivityExecution = {
    id: executionId,
    templateId: template.id,
    status: "completed",
    variables: { vesselName: "test-vessel", targetPath: "repos/test-vessel" },
    impulses: [],
    taskResults,
    startedAt: startTime,
    completedAt: endTime,
    executionTrace,
    metrics: {
      duration: totalDuration,
      cost: totalCost,
      totalTokens
    }
  }

  // Create backend payload
  const backendTracePayload: BackendTracePayload = {
    template_id: template.id,
    execution_id: executionId,
    org_id: "demo-org",
    status: "completed",
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date(endTime).toISOString(),
    duration_ms: totalDuration,
    cost_usd: totalCost,
    total_tokens: totalTokens,
    tasks: taskTraces,
    impulses_created: [],
    files_modified: executionTrace.filesModified,
    goal_context: executionTrace.goalContext
  }

  return {
    execution,
    modelSelections,
    backendTracePayload
  }
}

// =============================================================================
// DISPLAY FUNCTIONS
// =============================================================================

function formatExecution(sim: SimulatedExecution, stageName: string): string {
  const lines: string[] = []
  const exec = sim.execution

  lines.push(`\n${"═".repeat(70)}`)
  lines.push(`EXECUTION TRACE: ${stageName}`)
  lines.push(`${"═".repeat(70)}`)
  lines.push(`Execution ID: ${exec.id}`)
  lines.push(`Template: ${exec.templateId}`)
  lines.push(`Status: ${exec.status}`)
  lines.push(`Duration: ${exec.metrics?.duration}ms`)
  lines.push(`Cost: $${exec.metrics?.cost.toFixed(6)}`)
  lines.push(`Tokens: ${exec.metrics?.totalTokens.input} in / ${exec.metrics?.totalTokens.output} out`)

  lines.push(`\n${"─".repeat(70)}`)
  lines.push(`TASK TRACES (what gets recorded to backend):`)
  lines.push(`${"─".repeat(70)}`)

  for (const result of exec.taskResults) {
    const selection = sim.modelSelections.get(result.taskId)!
    const tierIcon = selection.tier === "deterministic" ? "⚡" :
                     selection.tier === "learned" ? "🎓" :
                     selection.tier === "standard" ? "📘" : "🆕"

    lines.push(`\n  ${tierIcon} Task: ${result.taskId}`)
    lines.push(`     Status: ${result.status}`)
    lines.push(`     Duration: ${(result.completedAt! - result.startedAt!).toFixed(0)}ms`)
    lines.push(`     Tokens: ${result.tokens?.input || 0} in / ${result.tokens?.output || 0} out`)
    lines.push(`     Model Selection:`)
    lines.push(`       - Tier: ${selection.tier}`)
    lines.push(`       - Model: ${selection.model}`)
    lines.push(`       - Cost Multiplier: ${selection.costMultiplier}`)
    lines.push(`       - Reasoning: ${selection.reasoning}`)

    if (result.metadata?.toolCalls) {
      lines.push(`     Tool Calls:`)
      for (const tc of result.metadata.toolCalls as ToolCall[]) {
        lines.push(`       - ${tc.name}: ${JSON.stringify(tc.arguments).substring(0, 50)}...`)
      }
    }
  }

  return lines.join("\n")
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════╗")
  console.log("║            EXECUTION TRACE STRUCTURE DEMONSTRATION                 ║")
  console.log("╚════════════════════════════════════════════════════════════════════╝")
  console.log("\nThis shows the exact trace data structure recorded to the backend.\n")

  // Load actual template
  const template = await loadVesselScaffoldTemplate()
  console.log(`Loaded template: ${template.name} (${template.tasks.length} tasks)`)

  // Simulate different learning stages
  const stages = [
    {
      name: "NEW - First Execution",
      metrics: undefined as ActivityMetrics | undefined,
      patterns: [] as ToolArgumentRecommendation[]
    },
    {
      name: "LEARNED - After 12 Executions",
      metrics: {
        activityId: template.id,
        totalExecutions: 12,
        successfulExecutions: 11,
        successRate: 0.917,
        avgDurationMs: 8000,
        avgCostUsd: 0.05,
        modelUsageDistribution: { "claude-sonnet-4-20250514": 3, "claude-haiku-4-5": 9 },
        deterministicTaskRatio: 0.25
      },
      patterns: [
        { toolName: "bash", argumentHash: "mkdir", arguments: {}, successRate: 1.0, timesUsed: 12, avgDurationMs: 45 },
        { toolName: "write", argumentHash: "pkg", arguments: {}, successRate: 0.92, timesUsed: 12, avgDurationMs: 180 },
        { toolName: "write", argumentHash: "types", arguments: {}, successRate: 0.92, timesUsed: 12, avgDurationMs: 250 },
        { toolName: "write", argumentHash: "index", arguments: {}, successRate: 0.83, timesUsed: 12, avgDurationMs: 300 }
      ]
    }
  ]

  for (const stage of stages) {
    const sim = simulateExecution(template, stage.metrics, stage.patterns, stage.name)
    console.log(formatExecution(sim, stage.name))
  }

  // Show the actual backend payload structure
  console.log(`\n${"═".repeat(70)}`)
  console.log("BACKEND API PAYLOAD (POST /v2/activities/execution-traces)")
  console.log(`${"═".repeat(70)}`)

  const learnedSim = simulateExecution(
    template,
    {
      activityId: template.id,
      totalExecutions: 12,
      successfulExecutions: 11,
      successRate: 0.917,
      avgDurationMs: 8000,
      avgCostUsd: 0.05,
      modelUsageDistribution: {},
      deterministicTaskRatio: 0.25
    },
    [
      { toolName: "bash", argumentHash: "mkdir", arguments: {}, successRate: 1.0, timesUsed: 12, avgDurationMs: 45 },
      { toolName: "write", argumentHash: "pkg", arguments: {}, successRate: 0.92, timesUsed: 12, avgDurationMs: 180 },
      { toolName: "write", argumentHash: "types", arguments: {}, successRate: 0.92, timesUsed: 12, avgDurationMs: 250 },
      { toolName: "write", argumentHash: "index", arguments: {}, successRate: 0.83, timesUsed: 12, avgDurationMs: 300 }
    ],
    "learned"
  )

  console.log(JSON.stringify(learnedSim.backendTracePayload, null, 2))

  // Summary
  console.log(`\n${"═".repeat(70)}`)
  console.log("TRACE FIELDS FOR PROGRESSIVE DETERMINISM")
  console.log(`${"═".repeat(70)}`)
  console.log(`
Each task trace includes model_selection with:
  - model: The LLM model used (or "none" for deterministic)
  - tier: "deterministic" | "learned" | "standard" | "new"
  - reasoning: Why this model was selected
  - cost_multiplier: Cost relative to baseline (0 = free, 0.33 = haiku, 1.0 = sonnet)

These fields enable:
  1. Tracking cost reduction over time
  2. Analyzing which tasks became deterministic
  3. Visualizing learning progression in the dashboard
  4. Thompson Sampling optimization based on tier effectiveness
`)

  console.log(`${"═".repeat(70)}`)
  console.log("DEMO COMPLETE")
  console.log(`${"═".repeat(70)}`)
}

main().catch(console.error)
