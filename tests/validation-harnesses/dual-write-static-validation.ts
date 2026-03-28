/**
 * Static Code Validation: dual-write-activity-metrics
 * 
 * Validates that the dual-write implementation is correctly integrated
 * by checking the code for required components without executing activities.
 * 
 * This is a static analysis that can run without Redis/SurrealDB services.
 */

import * as fs from "fs"
import * as path from "path"

interface StaticValidationResult {
  pass: boolean
  checks: {
    name: string
    pass: boolean
    details: string
  }[]
  errors: string[]
  warnings: string[]
}

/**
 * Check if completeActivityExecution exists in metabob.ts
 */
function checkCompleteActivityExecutionExists(): { pass: boolean; details: string } {
  const filePath = path.join(
    __dirname,
    "../../repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
  )

  try {
    const content = fs.readFileSync(filePath, "utf-8")

    // Check for method definition
    const hasMethod = content.includes("export async function completeActivityExecution")
    const hasDocstring = content.includes("Complete activity execution and write metrics to Redis")
    const callsMCP = content.includes('callMCPTool') && content.includes('"activity/complete"')
    const hasErrorHandling = content.includes("try {") && content.includes("catch (error)")

    if (!hasMethod) {
      return {
        pass: false,
        details: "completeActivityExecution method not found in metabob.ts",
      }
    }

    if (!hasDocstring) {
      return {
        pass: false,
        details: "completeActivityExecution missing docstring",
      }
    }

    if (!callsMCP) {
      return {
        pass: false,
        details: 'completeActivityExecution does not call MCP tool "activity/complete"',
      }
    }

    if (!hasErrorHandling) {
      return {
        pass: false,
        details: "completeActivityExecution missing error handling",
      }
    }

    return {
      pass: true,
      details: "completeActivityExecution correctly implemented with MCP call and error handling",
    }
  } catch (error) {
    return {
      pass: false,
      details: `Error reading metabob.ts: ${error}`,
    }
  }
}

/**
 * Check if TemplateMetricsClient.reportExecution implements dual-write
 */
function checkDualWriteInReportExecution(): { pass: boolean; details: string } {
  const filePath = path.join(
    __dirname,
    "../../repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts",
  )

  try {
    const content = fs.readFileSync(filePath, "utf-8")

    // Check for dual-write pattern
    const hasMCPCall = content.includes("metabob_post_activity_result")
    const hasRedisCall = content.includes("completeActivityExecution")
    const hasParallelExecution = content.includes("Promise.allSettled")
    const hasPathAComment = content.includes("Path A") || content.includes("JSON files via MCP")
    const hasPathBComment = content.includes("Path B") || content.includes("Redis via MetabobCLI")

    if (!hasMCPCall) {
      return {
        pass: false,
        details: "reportExecution missing MCP call to metabob_post_activity_result",
      }
    }

    if (!hasRedisCall) {
      return {
        pass: false,
        details: "reportExecution missing call to completeActivityExecution",
      }
    }

    if (!hasParallelExecution) {
      return {
        pass: false,
        details: "reportExecution not using Promise.allSettled for parallel writes",
      }
    }

    if (!hasPathAComment || !hasPathBComment) {
      return {
        pass: false,
        details: "reportExecution missing dual-write path comments (Path A/Path B)",
      }
    }

    return {
      pass: true,
      details:
        "reportExecution correctly implements dual-write with parallel MCP (JSON) and Redis calls",
    }
  } catch (error) {
    return {
      pass: false,
      details: `Error reading template-metrics-client.ts: ${error}`,
    }
  }
}

/**
 * Check if ActivityExecutionData has variant_id field
 */
function checkVariantIdField(): { pass: boolean; details: string } {
  const filePath = path.join(
    __dirname,
    "../../repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts",
  )

  try {
    const content = fs.readFileSync(filePath, "utf-8")

    // Check for variant_id in ActivityExecutionData interface
    const hasInterface = content.includes("export interface ActivityExecutionData")
    const hasVariantId = content.includes("variant_id?:")
    const hasComment = content.includes("Thompson Sampling") || content.includes("variant tracking")

    if (!hasInterface) {
      return {
        pass: false,
        details: "ActivityExecutionData interface not found",
      }
    }

    if (!hasVariantId) {
      return {
        pass: false,
        details: "ActivityExecutionData missing variant_id field",
      }
    }

    if (!hasComment) {
      return {
        pass: false,
        details: "variant_id field missing explanatory comment",
      }
    }

    return {
      pass: true,
      details: "ActivityExecutionData correctly includes variant_id field with comment",
    }
  } catch (error) {
    return {
      pass: false,
      details: `Error reading template-metrics.ts: ${error}`,
    }
  }
}

/**
 * Check if Activity.complete calls reportExecution
 */
function checkActivityCallsReportExecution(): { pass: boolean; details: string } {
  const filePath = path.join(
    __dirname,
    "../../repos/metabob-opencode/packages/opencode/src/session/activity.ts",
  )

  try {
    const content = fs.readFileSync(filePath, "utf-8")

    // Check for reportExecution calls in Activity
    const hasReportExecutionImport =
      content.includes("TemplateMetricsClient") || content.includes("reportExecution")
    
    // Check for reportExecution calls (allow literal values or dynamic expressions)
    const hasReportExecutionCalls = content.includes("TemplateMetricsClient.reportExecution({")
    const hasSuccessField = content.includes("success:") && content.includes("activity.status")
    const hasDurationField = content.includes("duration:") && content.includes("activity.stats.duration")
    const hasCostField = content.includes("cost:") && content.includes("activity.stats.cost")
    const hasTokensField = content.includes("tokens:") && content.includes("activity.stats.tokens")

    if (!hasReportExecutionImport) {
      return {
        pass: false,
        details: "Activity.ts does not import TemplateMetricsClient or reportExecution",
      }
    }

    if (!hasReportExecutionCalls) {
      return {
        pass: false,
        details: "Activity.ts does not call TemplateMetricsClient.reportExecution",
      }
    }

    if (!hasSuccessField) {
      return {
        pass: false,
        details: "reportExecution call missing success field based on activity.status",
      }
    }

    if (!hasDurationField || !hasCostField || !hasTokensField) {
      return {
        pass: false,
        details: "reportExecution call missing required metric fields (duration, cost, tokens)",
      }
    }

    return {
      pass: true,
      details: "Activity correctly calls reportExecution with all required metrics",
    }
  } catch (error) {
    return {
      pass: false,
      details: `Error reading activity.ts: ${error}`,
    }
  }
}

/**
 * Run static validation
 */
export function runStaticValidation(): StaticValidationResult {
  const checks = [
    {
      name: "MetabobCLI.completeActivityExecution() exists",
      ...checkCompleteActivityExecutionExists(),
    },
    {
      name: "TemplateMetricsClient.reportExecution() implements dual-write",
      ...checkDualWriteInReportExecution(),
    },
    {
      name: "ActivityExecutionData has variant_id field",
      ...checkVariantIdField(),
    },
    {
      name: "Activity.complete/fail call reportExecution",
      ...checkActivityCallsReportExecution(),
    },
  ]

  const errors: string[] = []
  const warnings: string[] = []

  checks.forEach((check) => {
    if (!check.pass) {
      errors.push(`${check.name}: ${check.details}`)
    }
  })

  const pass = checks.every((check) => check.pass)

  return {
    pass,
    checks,
    errors,
    warnings,
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  console.log("Dual-Write Activity Metrics - Static Code Validation")
  console.log("=".repeat(60))
  console.log("")

  const result = runStaticValidation()

  console.log("Validation Checks:")
  console.log("-".repeat(60))
  result.checks.forEach((check) => {
    const status = check.pass ? "✓ PASS" : "✗ FAIL"
    console.log(`${status} - ${check.name}`)
    console.log(`  ${check.details}`)
    console.log("")
  })

  if (result.errors.length > 0) {
    console.log("Errors:")
    console.log("-".repeat(60))
    result.errors.forEach((error) => console.log(`  ✗ ${error}`))
    console.log("")
  }

  if (result.warnings.length > 0) {
    console.log("Warnings:")
    console.log("-".repeat(60))
    result.warnings.forEach((warning) => console.log(`  ⚠ ${warning}`))
    console.log("")
  }

  console.log("=".repeat(60))
  console.log(`Overall Status: ${result.pass ? "PASS ✓" : "FAIL ✗"}`)
  console.log("=".repeat(60))

  process.exit(result.pass ? 0 : 1)
}
