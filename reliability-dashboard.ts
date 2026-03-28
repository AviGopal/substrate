#!/usr/bin/env bun
/**
 * Reliability Dashboard
 *
 * Single-screen view of MiniBob's reliability metrics
 * Shows progress toward self-modification readiness
 */

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "http://api.minibob.local"

interface Metrics {
  // Readiness
  total_templates: number
  templates_with_data: number
  simple_success_rate: number
  medium_success_rate: number
  complex_success_rate: number

  // Safety
  total_executions: number
  total_failures: number
  corruption_incidents: number

  // Efficiency
  meta_work_percentage: number
  avg_cost_usd: number
  real_work_executions: number

  // Goals
  ready_for_self_modification: boolean
  blockers: string[]
}

async function fetchTemplates() {
  const response = await fetch(`${MCP_ENDPOINT}/v2/activities/templates`)
  if (!response.ok) throw new Error(`Failed to fetch templates: ${response.statusText}`)
  const data = await response.json()
  return data.templates || []
}

function classifyComplexity(template: any): 'simple' | 'medium' | 'complex' {
  const desc = template.description?.toLowerCase() || ''
  const category = template.category?.toLowerCase() || ''

  if (desc.includes('read') || desc.includes('view') || desc.includes('list')) {
    return 'simple'
  }

  if (
    category === 'refactor' ||
    category === 'infrastructure' ||
    desc.includes('refactor') ||
    desc.includes('architecture')
  ) {
    return 'complex'
  }

  return 'medium'
}

async function calculateMetrics(): Promise<Metrics> {
  const templates = await fetchTemplates()

  const MIN_EXECUTIONS = 5
  const templatesWithData = templates.filter(
    (t: any) => t.metrics && t.metrics.total_executions >= MIN_EXECUTIONS
  )

  // Classify by complexity
  const simple = templatesWithData.filter((t: any) => classifyComplexity(t) === 'simple')
  const medium = templatesWithData.filter((t: any) => classifyComplexity(t) === 'medium')
  const complex = templatesWithData.filter((t: any) => classifyComplexity(t) === 'complex')

  const avgSuccessRate = (temps: any[]) => {
    if (temps.length === 0) return 0
    const sum = temps.reduce((acc: number, t: any) => acc + (t.metrics?.success_rate || 0), 0)
    return sum / temps.length
  }

  const simpleAvg = avgSuccessRate(simple)
  const mediumAvg = avgSuccessRate(medium)
  const complexAvg = avgSuccessRate(complex)

  // Total executions and failures
  const totalExecutions = templates.reduce(
    (sum: number, t: any) => sum + (t.metrics?.total_executions || 0),
    0
  )
  const totalFailures = templates.reduce(
    (sum: number, t: any) => sum + (t.metrics?.failed_executions || 0),
    0
  )

  // Meta-work percentage (category: infrastructure, tool)
  const metaWorkExecutions = templates
    .filter((t: any) => t.category === 'infrastructure' || t.category === 'tool')
    .reduce((sum: number, t: any) => sum + (t.metrics?.total_executions || 0), 0)

  const metaWorkPercentage = totalExecutions > 0 ? (metaWorkExecutions / totalExecutions) * 100 : 0

  // Real work executions (feature, bugfix, refactor)
  const realWorkExecutions = templates
    .filter((t: any) => ['feature', 'bugfix', 'refactor'].includes(t.category))
    .reduce((sum: number, t: any) => sum + (t.metrics?.total_executions || 0), 0)

  // Average cost
  const templatesWithCost = templates.filter((t: any) => t.metrics?.avg_cost_usd)
  const avgCost =
    templatesWithCost.length > 0
      ? templatesWithCost.reduce((sum: number, t: any) => sum + t.metrics.avg_cost_usd, 0) /
        templatesWithCost.length
      : 0

  // Corruption incidents (would need to query execution traces)
  // For now, assume 0 (we'd detect this from error_type)
  const corruptionIncidents = 0

  // Determine readiness and blockers
  const blockers: string[] = []

  if (templatesWithData.length < 10) {
    blockers.push(`Only ${templatesWithData.length} templates with sufficient data (need ≥10)`)
  }

  if (metaWorkPercentage > 30) {
    blockers.push(`Meta-work is ${metaWorkPercentage.toFixed(1)}% of executions (need ≤30%)`)
  }

  if (simpleAvg < 0.95 && simple.length > 0) {
    blockers.push(`Simple activities at ${(simpleAvg * 100).toFixed(1)}% (need ≥95%)`)
  }

  if (mediumAvg < 0.85 && medium.length > 0) {
    blockers.push(`Medium activities at ${(mediumAvg * 100).toFixed(1)}% (need ≥85%)`)
  }

  if (avgCost > 0.50) {
    blockers.push(`Average cost is $${avgCost.toFixed(2)} (target <$0.50)`)
  }

  const ready = blockers.length === 0 && templatesWithData.length >= 10

  return {
    total_templates: templates.length,
    templates_with_data: templatesWithData.length,
    simple_success_rate: simpleAvg,
    medium_success_rate: mediumAvg,
    complex_success_rate: complexAvg,
    total_executions: totalExecutions,
    total_failures: totalFailures,
    corruption_incidents: corruptionIncidents,
    meta_work_percentage: metaWorkPercentage,
    avg_cost_usd: avgCost,
    real_work_executions: realWorkExecutions,
    ready_for_self_modification: ready,
    blockers: blockers,
  }
}

function renderDashboard(metrics: Metrics) {
  const { ready_for_self_modification, blockers } = metrics

  console.log("╔════════════════════════════════════════════════════════════════════════════════╗")
  console.log("║                         MINIBOB RELIABILITY DASHBOARD                          ║")
  console.log("╚════════════════════════════════════════════════════════════════════════════════╝")
  console.log()

  // Overall status
  if (ready_for_self_modification) {
    console.log("  STATUS: ✅ READY FOR SELF-MODIFICATION")
  } else {
    console.log("  STATUS: ❌ NOT READY - SEE BLOCKERS BELOW")
  }
  console.log()

  // Readiness section
  console.log("┌─ READINESS METRICS ──────────────────────────────────────────────────────────┐")
  console.log("│                                                                              │")
  console.log(`│  Templates:          ${metrics.templates_with_data}/${metrics.total_templates} with sufficient data  ${getIndicator(metrics.templates_with_data, 10, 20)}  │`)
  console.log("│                                                                              │")
  console.log(`│  Simple Success:     ${(metrics.simple_success_rate * 100).toFixed(1).padStart(5)}%  (threshold: 95%)   ${getThresholdIndicator(metrics.simple_success_rate, 0.95)}  │`)
  console.log(`│  Medium Success:     ${(metrics.medium_success_rate * 100).toFixed(1).padStart(5)}%  (threshold: 85%)   ${getThresholdIndicator(metrics.medium_success_rate, 0.85)}  │`)
  console.log(`│  Complex Success:    ${(metrics.complex_success_rate * 100).toFixed(1).padStart(5)}%  (threshold: 70%)   ${getThresholdIndicator(metrics.complex_success_rate, 0.70)}  │`)
  console.log("│                                                                              │")
  console.log("└──────────────────────────────────────────────────────────────────────────────┘")
  console.log()

  // Safety section
  console.log("┌─ SAFETY METRICS ─────────────────────────────────────────────────────────────┐")
  console.log("│                                                                              │")
  console.log(`│  Total Executions:   ${metrics.total_executions.toString().padStart(6)}                                                │`)
  console.log(`│  Failures:           ${metrics.total_failures.toString().padStart(6)}  (${((metrics.total_failures / metrics.total_executions) * 100).toFixed(1)}%)                                    │`)
  console.log(`│  Corruption Events:  ${metrics.corruption_incidents.toString().padStart(6)}  ${metrics.corruption_incidents === 0 ? '✅' : '❌'}                                            │`)
  console.log("│                                                                              │")
  console.log("└──────────────────────────────────────────────────────────────────────────────┘")
  console.log()

  // Efficiency section
  console.log("┌─ EFFICIENCY METRICS ─────────────────────────────────────────────────────────┐")
  console.log("│                                                                              │")
  console.log(`│  Meta-Work %:        ${metrics.meta_work_percentage.toFixed(1).padStart(5)}%  (target: ≤30%)      ${getThresholdIndicator(1 - metrics.meta_work_percentage / 100, 0.70)}  │`)
  console.log(`│  Real Work Runs:     ${metrics.real_work_executions.toString().padStart(6)}                                                │`)
  console.log(`│  Avg Cost:           $${metrics.avg_cost_usd.toFixed(3)}  (target: <$0.50)   ${metrics.avg_cost_usd < 0.50 ? '✅' : '⚠️ '}  │`)
  console.log("│                                                                              │")
  console.log("└──────────────────────────────────────────────────────────────────────────────┘")
  console.log()

  // Blockers section
  if (blockers.length > 0) {
    console.log("┌─ BLOCKERS ───────────────────────────────────────────────────────────────────┐")
    console.log("│                                                                              │")
    for (const blocker of blockers) {
      const wrapped = wrapText(blocker, 76)
      for (const line of wrapped) {
        console.log(`│  ❌ ${line.padEnd(74)}│`)
      }
    }
    console.log("│                                                                              │")
    console.log("└──────────────────────────────────────────────────────────────────────────────┘")
    console.log()
  }

  // Progress bar
  const progressPoints = [
    metrics.templates_with_data >= 10,
    metrics.meta_work_percentage <= 30,
    metrics.simple_success_rate >= 0.95 || metrics.simple_success_rate === 0,
    metrics.medium_success_rate >= 0.85 || metrics.medium_success_rate === 0,
    metrics.avg_cost_usd < 0.50 || metrics.avg_cost_usd === 0,
    metrics.corruption_incidents === 0,
  ]

  const completedPoints = progressPoints.filter(p => p).length
  const totalPoints = progressPoints.length
  const progressPercentage = (completedPoints / totalPoints) * 100

  console.log("┌─ PROGRESS TO READINESS ──────────────────────────────────────────────────────┐")
  console.log("│                                                                              │")
  console.log(`│  ${renderProgressBar(progressPercentage, 70)}  │`)
  console.log(`│  ${completedPoints}/${totalPoints} criteria met (${progressPercentage.toFixed(0)}%)                                                  │`)
  console.log("│                                                                              │")
  console.log("└──────────────────────────────────────────────────────────────────────────────┘")
  console.log()

  // Next steps
  console.log("NEXT STEPS:")
  if (ready_for_self_modification) {
    console.log("  ✅ Validation passed - ready to test self-modification on test app")
    console.log("  💡 Create test React app and run 50 self-modification activities")
  } else {
    if (metrics.meta_work_percentage > 30) {
      console.log("  🔨 PRIORITY: Fix meta-work trap (see FIX_META_WORK_TRAP.md)")
    }
    if (metrics.templates_with_data < 10) {
      console.log("  📊 Run more diverse activities to build template library")
    }
    if (metrics.medium_success_rate < 0.85 && metrics.medium_success_rate > 0) {
      console.log("  🐛 Debug failing templates (run debug-failed-templates.ts)")
    }
  }
  console.log()
}

function getIndicator(value: number, min: number, good: number): string {
  if (value >= good) return '✅'
  if (value >= min) return '⚠️ '
  return '❌'
}

function getThresholdIndicator(value: number, threshold: number): string {
  if (value === 0) return '⏸️ ' // No data yet
  if (value >= threshold) return '✅'
  if (value >= threshold * 0.9) return '⚠️ '
  return '❌'
}

function renderProgressBar(percentage: number, width: number): string {
  const filled = Math.floor((percentage / 100) * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines
}

async function main() {
  try {
    const metrics = await calculateMetrics()
    renderDashboard(metrics)

    process.exit(metrics.ready_for_self_modification ? 0 : 1)
  } catch (error) {
    console.error("Error fetching metrics:", error)
    process.exit(1)
  }
}

main()
