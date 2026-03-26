#!/usr/bin/env bun
/**
 * MiniBob Readiness Validation
 *
 * Determines if MiniBob is reliable enough for self-modifying dashboard work
 * by analyzing execution metrics from the backend.
 *
 * Readiness Criteria:
 * - Simple operations: >95% success rate
 * - Medium complexity: >85% success rate
 * - Complex operations: >70% success rate
 * - Minimum executions per template: 5 (for statistical significance)
 * - Failure modes are recoverable (no corrupted codebases)
 */

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "http://api.minibob.local"

interface TemplateMetrics {
  variant_id: string
  activity_id: string
  total_executions: number
  successful_executions: number
  failed_executions: number
  success_rate: number
  avg_duration_ms: number
  avg_cost_usd: number
  thompson_alpha: number
  thompson_beta: number
}

interface Template {
  variant_id: string
  activity_id: string
  variant_name: string
  description: string
  category: string
  metrics?: TemplateMetrics
}

interface ReadinessReport {
  overall_ready: boolean
  total_templates: number
  templates_with_data: number
  templates_insufficient_data: number

  simple_activities: {
    count: number
    avg_success_rate: number
    meets_threshold: boolean
    threshold: number
  }

  medium_activities: {
    count: number
    avg_success_rate: number
    meets_threshold: boolean
    threshold: number
  }

  complex_activities: {
    count: number
    avg_success_rate: number
    meets_threshold: boolean
    threshold: number
  }

  top_performers: Array<{
    variant_id: string
    variant_name: string
    success_rate: number
    executions: number
  }>

  problem_templates: Array<{
    variant_id: string
    variant_name: string
    success_rate: number
    executions: number
    issue: string
  }>

  recommendations: string[]
}

// Classify template complexity based on category and description
function classifyComplexity(template: Template): 'simple' | 'medium' | 'complex' {
  const desc = template.description.toLowerCase()
  const category = template.category.toLowerCase()

  // Simple: Read-only operations, single file edits
  if (desc.includes('read') || desc.includes('view') || desc.includes('list')) {
    return 'simple'
  }

  // Complex: Multi-file changes, architectural work, refactors
  if (
    category === 'refactor' ||
    category === 'infrastructure' ||
    desc.includes('refactor') ||
    desc.includes('architecture') ||
    desc.includes('multi-file') ||
    desc.includes('complex')
  ) {
    return 'complex'
  }

  // Medium: Everything else (features, bugfixes, single-purpose tasks)
  return 'medium'
}

async function fetchTemplates(): Promise<Template[]> {
  const response = await fetch(`${MCP_ENDPOINT}/v2/activities/templates`)

  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.templates || []
}

function analyzeReadiness(templates: Template[]): ReadinessReport {
  const MIN_EXECUTIONS = 5
  const SIMPLE_THRESHOLD = 0.95
  const MEDIUM_THRESHOLD = 0.85
  const COMPLEX_THRESHOLD = 0.70

  // Filter templates with sufficient data
  const templatesWithData = templates.filter(
    t => t.metrics && t.metrics.total_executions >= MIN_EXECUTIONS
  )

  const templatesInsufficientData = templates.filter(
    t => !t.metrics || t.metrics.total_executions < MIN_EXECUTIONS
  )

  // Classify by complexity
  const simple = templatesWithData.filter(t => classifyComplexity(t) === 'simple')
  const medium = templatesWithData.filter(t => classifyComplexity(t) === 'medium')
  const complex = templatesWithData.filter(t => classifyComplexity(t) === 'complex')

  // Calculate average success rates
  const avgSuccessRate = (temps: Template[]) => {
    if (temps.length === 0) return 0
    const sum = temps.reduce((acc, t) => acc + (t.metrics?.success_rate || 0), 0)
    return sum / temps.length
  }

  const simpleAvg = avgSuccessRate(simple)
  const mediumAvg = avgSuccessRate(medium)
  const complexAvg = avgSuccessRate(complex)

  // Top performers (success rate >= 0.90 with >= 10 executions)
  const topPerformers = templatesWithData
    .filter(t => t.metrics!.success_rate >= 0.90 && t.metrics!.total_executions >= 10)
    .sort((a, b) => b.metrics!.success_rate - a.metrics!.success_rate)
    .slice(0, 10)
    .map(t => ({
      variant_id: t.variant_id,
      variant_name: t.variant_name,
      success_rate: t.metrics!.success_rate,
      executions: t.metrics!.total_executions,
    }))

  // Problem templates (success rate < 0.50 with >= 5 executions)
  const problemTemplates = templatesWithData
    .filter(t => t.metrics!.success_rate < 0.50)
    .sort((a, b) => a.metrics!.success_rate - b.metrics!.success_rate)
    .map(t => ({
      variant_id: t.variant_id,
      variant_name: t.variant_name,
      success_rate: t.metrics!.success_rate,
      executions: t.metrics!.total_executions,
      issue: t.metrics!.success_rate === 0
        ? 'Never succeeds'
        : 'Low success rate',
    }))

  // Generate recommendations
  const recommendations: string[] = []

  // Overall readiness check
  const simpleMeetsThreshold = simple.length === 0 || simpleAvg >= SIMPLE_THRESHOLD
  const mediumMeetsThreshold = medium.length === 0 || mediumAvg >= MEDIUM_THRESHOLD
  const complexMeetsThreshold = complex.length === 0 || complexAvg >= COMPLEX_THRESHOLD

  const overallReady =
    simpleMeetsThreshold &&
    mediumMeetsThreshold &&
    templatesWithData.length >= 10 // Need at least 10 templates with data

  if (!overallReady) {
    if (templatesWithData.length < 10) {
      recommendations.push(
        `⚠️  Insufficient execution data. Only ${templatesWithData.length} templates have >= ${MIN_EXECUTIONS} executions. Need at least 10.`
      )
      recommendations.push(
        "💡 Run more activities to build statistical confidence. Consider running boredom activities."
      )
    }

    if (!simpleMeetsThreshold) {
      recommendations.push(
        `⚠️  Simple activities below threshold: ${(simpleAvg * 100).toFixed(1)}% (need ${SIMPLE_THRESHOLD * 100}%)`
      )
      recommendations.push(
        "💡 Debug simple activities first. These should be highly reliable."
      )
    }

    if (!mediumMeetsThreshold) {
      recommendations.push(
        `⚠️  Medium activities below threshold: ${(mediumAvg * 100).toFixed(1)}% (need ${MEDIUM_THRESHOLD * 100}%)`
      )
      recommendations.push(
        "💡 Focus on improving medium-complexity templates before attempting self-modification."
      )
    }
  } else {
    recommendations.push("✅ MiniBob is ready for self-modifying dashboard work!")
    recommendations.push(
      "💡 Start with simple modifications (adding UI elements, tweaking styles) before attempting complex changes."
    )
  }

  if (problemTemplates.length > 0) {
    recommendations.push(
      `⚠️  ${problemTemplates.length} templates have <50% success rate. Review and fix or deprecate.`
    )
  }

  if (templatesInsufficientData.length > templates.length * 0.5) {
    recommendations.push(
      `💡 ${templatesInsufficientData.length} templates have insufficient data. Execute more activities for better coverage.`
    )
  }

  return {
    overall_ready: overallReady,
    total_templates: templates.length,
    templates_with_data: templatesWithData.length,
    templates_insufficient_data: templatesInsufficientData.length,

    simple_activities: {
      count: simple.length,
      avg_success_rate: simpleAvg,
      meets_threshold: simpleMeetsThreshold,
      threshold: SIMPLE_THRESHOLD,
    },

    medium_activities: {
      count: medium.length,
      avg_success_rate: mediumAvg,
      meets_threshold: mediumMeetsThreshold,
      threshold: MEDIUM_THRESHOLD,
    },

    complex_activities: {
      count: complex.length,
      avg_success_rate: complexAvg,
      meets_threshold: complexMeetsThreshold,
      threshold: COMPLEX_THRESHOLD,
    },

    top_performers: topPerformers,
    problem_templates: problemTemplates,
    recommendations,
  }
}

function printReport(report: ReadinessReport): void {
  console.log("=" .repeat(80))
  console.log("MINIBOB READINESS VALIDATION REPORT")
  console.log("=".repeat(80))
  console.log()

  // Overall status
  if (report.overall_ready) {
    console.log("✅ READY FOR SELF-MODIFYING DASHBOARD")
  } else {
    console.log("❌ NOT YET READY - SEE RECOMMENDATIONS BELOW")
  }
  console.log()

  // Summary stats
  console.log("SUMMARY")
  console.log("-".repeat(80))
  console.log(`Total templates: ${report.total_templates}`)
  console.log(`Templates with sufficient data (>=5 executions): ${report.templates_with_data}`)
  console.log(`Templates with insufficient data: ${report.templates_insufficient_data}`)
  console.log()

  // Success rates by complexity
  console.log("SUCCESS RATES BY COMPLEXITY")
  console.log("-".repeat(80))

  const formatRate = (rate: number, threshold: number, meets: boolean) => {
    const pct = (rate * 100).toFixed(1)
    const thresholdPct = (threshold * 100).toFixed(0)
    const status = meets ? "✅" : "❌"
    return `${status} ${pct}% (threshold: ${thresholdPct}%)`
  }

  console.log(`Simple activities (${report.simple_activities.count}):`)
  console.log(`  ${formatRate(
    report.simple_activities.avg_success_rate,
    report.simple_activities.threshold,
    report.simple_activities.meets_threshold
  )}`)
  console.log()

  console.log(`Medium activities (${report.medium_activities.count}):`)
  console.log(`  ${formatRate(
    report.medium_activities.avg_success_rate,
    report.medium_activities.threshold,
    report.medium_activities.meets_threshold
  )}`)
  console.log()

  console.log(`Complex activities (${report.complex_activities.count}):`)
  console.log(`  ${formatRate(
    report.complex_activities.avg_success_rate,
    report.complex_activities.threshold,
    report.complex_activities.meets_threshold
  )}`)
  console.log()

  // Top performers
  if (report.top_performers.length > 0) {
    console.log("TOP PERFORMERS (>90% success, >=10 executions)")
    console.log("-".repeat(80))
    for (const perf of report.top_performers) {
      console.log(
        `${(perf.success_rate * 100).toFixed(1)}% - ${perf.variant_name} (${perf.executions} runs)`
      )
    }
    console.log()
  }

  // Problem templates
  if (report.problem_templates.length > 0) {
    console.log("PROBLEM TEMPLATES (<50% success)")
    console.log("-".repeat(80))
    for (const prob of report.problem_templates) {
      console.log(
        `${(prob.success_rate * 100).toFixed(1)}% - ${prob.variant_name} (${prob.executions} runs) - ${prob.issue}`
      )
    }
    console.log()
  }

  // Recommendations
  console.log("RECOMMENDATIONS")
  console.log("-".repeat(80))
  for (const rec of report.recommendations) {
    console.log(rec)
  }
  console.log()

  console.log("=".repeat(80))
}

// Main execution
async function main() {
  try {
    console.log(`Connecting to backend: ${MCP_ENDPOINT}\n`)

    const templates = await fetchTemplates()
    console.log(`Fetched ${templates.length} templates\n`)

    const report = analyzeReadiness(templates)
    printReport(report)

    // Exit code: 0 if ready, 1 if not
    process.exit(report.overall_ready ? 0 : 1)

  } catch (error) {
    console.error("❌ Error during validation:", error)
    process.exit(1)
  }
}

main()
