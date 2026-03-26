#!/usr/bin/env bun
/**
 * Debug Failed Templates
 *
 * Analyzes execution traces for templates with low success rates
 * to understand why they're failing.
 */

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "http://api.minibob.local"

interface ExecutionTrace {
  execution_id: string
  variant_id: string
  success: boolean
  duration_ms: number
  cost_usd: number
  error_message?: string
  error_type?: string
  failed_task_id?: string
  created_at: string
}

async function getFailedTemplates() {
  const response = await fetch(`${MCP_ENDPOINT}/v2/activities/templates`)
  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.statusText}`)
  }

  const data = await response.json()
  return data.templates
    .filter((t: any) => t.metrics && t.metrics.success_rate < 0.5)
    .sort((a: any, b: any) => a.metrics.success_rate - b.metrics.success_rate)
}

async function getExecutionTraces(variantId: string, limit = 10): Promise<ExecutionTrace[]> {
  const response = await fetch(
    `${MCP_ENDPOINT}/v2/activities/execution-traces?variant_id=${variantId}&limit=${limit}`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch traces: ${response.statusText}`)
  }

  const data = await response.json()
  return data.traces || []
}

function analyzeFailurePatterns(traces: ExecutionTrace[]) {
  const failures = traces.filter(t => !t.success)

  if (failures.length === 0) {
    return {
      total_failures: 0,
      error_types: {},
      common_errors: [],
    }
  }

  // Group by error type
  const errorTypes: Record<string, number> = {}
  const errorMessages: Record<string, number> = {}

  for (const failure of failures) {
    if (failure.error_type) {
      errorTypes[failure.error_type] = (errorTypes[failure.error_type] || 0) + 1
    }
    if (failure.error_message) {
      const msg = failure.error_message.slice(0, 100) // Truncate long messages
      errorMessages[msg] = (errorMessages[msg] || 0) + 1
    }
  }

  // Top 5 most common error messages
  const commonErrors = Object.entries(errorMessages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([msg, count]) => ({ message: msg, count }))

  return {
    total_failures: failures.length,
    error_types: errorTypes,
    common_errors: commonErrors,
  }
}

async function main() {
  console.log("=" .repeat(80))
  console.log("FAILED TEMPLATE DEBUGGER")
  console.log("=".repeat(80))
  console.log()

  const failedTemplates = await getFailedTemplates()

  if (failedTemplates.length === 0) {
    console.log("✅ No templates with <50% success rate!")
    return
  }

  console.log(`Found ${failedTemplates.length} templates with <50% success rate:\n`)

  for (const template of failedTemplates) {
    const { variant_id, variant_name, metrics } = template

    console.log("-".repeat(80))
    console.log(`Template: ${variant_name}`)
    console.log(`Variant ID: ${variant_id}`)
    console.log(
      `Success Rate: ${(metrics.success_rate * 100).toFixed(1)}% (${metrics.successful_executions}/${metrics.total_executions})`
    )
    console.log()

    // Get recent execution traces
    console.log("Fetching recent execution traces...")
    const traces = await getExecutionTraces(variant_id, 20)

    if (traces.length === 0) {
      console.log("  ⚠️  No execution traces found")
      console.log()
      continue
    }

    const analysis = analyzeFailurePatterns(traces)

    console.log(`Recent executions: ${traces.length}`)
    console.log(`Failures in sample: ${analysis.total_failures}`)
    console.log()

    if (Object.keys(analysis.error_types).length > 0) {
      console.log("Error types:")
      for (const [type, count] of Object.entries(analysis.error_types)) {
        console.log(`  - ${type}: ${count} occurrences`)
      }
      console.log()
    }

    if (analysis.common_errors.length > 0) {
      console.log("Most common errors:")
      for (const { message, count } of analysis.common_errors) {
        console.log(`  [${count}x] ${message}`)
      }
      console.log()
    }

    // Show one example failure
    const exampleFailure = traces.find(t => !t.success)
    if (exampleFailure) {
      console.log("Example failure:")
      console.log(`  Execution ID: ${exampleFailure.execution_id}`)
      console.log(`  Failed task: ${exampleFailure.failed_task_id || 'unknown'}`)
      console.log(`  Error: ${exampleFailure.error_message || 'No error message'}`)
      console.log()
    }

    console.log("Recommendation:")
    if (metrics.success_rate === 0) {
      console.log("  ❌ This template NEVER succeeds. Consider:")
      console.log("     1. Review task prompts for clarity")
      console.log("     2. Check validation logic isn't too strict")
      console.log("     3. Verify tools are working correctly")
      console.log("     4. Deprecate if fundamentally flawed")
    } else {
      console.log("  ⚠️  This template succeeds sometimes. Investigate:")
      console.log("     1. What's different between successes and failures?")
      console.log("     2. Are failures due to LLM variance or systematic issues?")
      console.log("     3. Can validation be improved to catch issues earlier?")
    }
    console.log()
  }

  console.log("=".repeat(80))
}

main().catch(error => {
  console.error("Error:", error)
  process.exit(1)
})
