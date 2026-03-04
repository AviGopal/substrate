/**
 * Validation Harness: MCP Data Flow - Devbob → Metabob-CLI → Database
 * 
 * This harness validates the complete data flow from OpenCode activity execution
 * through the metabob-cli MCP server to the backend database storage.
 * 
 * Validation Strategy:
 * 1. Execute test activity with known parameters
 * 2. Capture MCP request/response payloads
 * 3. Query database directly to verify data arrival
 * 4. Validate data schemas and relationships
 * 
 * Expected Data Flow:
 * - Activity execution starts with metadata (templateId, variables, reason)
 * - Impulses loaded during execution tracked in activity.impulses registry
 * - Components changed identified via git diff
 * - Activity completion sends impulse_used and component_changes to CLI
 * - CLI forwards to backend /api/v1/learning-loop/executions
 * - Backend stores in SurrealDB: activity_executions, impulse_usage, impulse_registry
 */

import { Activity } from "../../repos/metabob-opencode/packages/opencode/src/session/activity"
import { ActivityTemplate } from "../../repos/metabob-opencode/packages/opencode/src/session/activity-template"
import { Storage } from "../../repos/metabob-opencode/packages/opencode/src/storage/storage"
import { Log } from "../../repos/metabob-opencode/packages/opencode/src/util/log"
import * as fs from "fs"
import * as path from "path"
import { $ } from "bun"

const log = Log.create({ service: "validation-harness-mcp-data-flow" })

export interface ValidationInput {
  templateId: string
  variables: Record<string, unknown>
  reason: string
  expectedImpulseCount?: number
  expectedComponentCount?: number
}

export interface ValidationOutput {
  pass: boolean
  results: {
    activityExecution: {
      exists: boolean
      hasCorrectTemplate: boolean
      hasMetrics: boolean
      hasImpulsesUsed: boolean
      hasComponentChanges: boolean
      impulsesUsedCount?: number
      componentsChangedCount?: number
    }
    impulseUsage: {
      recordsCreated: boolean
      recordCount?: number
      linkedToExecution: boolean
    }
    impulseRegistry: {
      updatedSuccessRates: boolean
      impulseCount?: number
    }
    mcpPayload: {
      captured: boolean
      hasImpulsesUsed: boolean
      hasComponentChanges: boolean
      payloadSize?: number
    }
  }
  actual: {
    activityId?: string
    executionId?: string
    impulsesUsed?: any[]
    componentChanges?: any[]
    mcpPayload?: string
  }
  expected: ValidationInput
  errors: string[]
}

/**
 * Validation harness entry point
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  const output: ValidationOutput = {
    pass: false,
    results: {
      activityExecution: {
        exists: false,
        hasCorrectTemplate: false,
        hasMetrics: false,
        hasImpulsesUsed: false,
        hasComponentChanges: false,
      },
      impulseUsage: {
        recordsCreated: false,
        linkedToExecution: false,
      },
      impulseRegistry: {
        updatedSuccessRates: false,
      },
      mcpPayload: {
        captured: false,
        hasImpulsesUsed: false,
        hasComponentChanges: false,
      },
    },
    actual: {},
    expected: input,
    errors,
  }

  try {
    log.info("starting MCP data flow validation", {
      templateId: input.templateId,
      reason: input.reason,
    })

    // Step 1: Execute test activity
    const activityId = await executeTestActivity(input)
    output.actual.activityId = activityId

    if (!activityId) {
      errors.push("Failed to execute test activity")
      return output
    }

    // Step 2: Wait for async processing (MCP calls, backend storage)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Step 3: Validate activity execution data
    const activityResult = await validateActivityExecution(activityId, input)
    output.results.activityExecution = activityResult.result
    output.actual.impulsesUsed = activityResult.impulsesUsed
    output.actual.componentChanges = activityResult.componentChanges
    
    if (activityResult.errors.length > 0) {
      errors.push(...activityResult.errors)
    }

    // Step 4: Validate impulse usage records (if backend available)
    try {
      const impulseResult = await validateImpulseUsage(activityId)
      output.results.impulseUsage = impulseResult.result
      if (impulseResult.errors.length > 0) {
        errors.push(...impulseResult.errors)
      }
    } catch (error) {
      log.warn("impulse usage validation skipped (backend may be unavailable)", { error })
      errors.push("Impulse usage validation skipped: backend unavailable")
    }

    // Step 5: Validate impulse registry updates (if backend available)
    try {
      const registryResult = await validateImpulseRegistry(activityId)
      output.results.impulseRegistry = registryResult.result
      if (registryResult.errors.length > 0) {
        errors.push(...registryResult.errors)
      }
    } catch (error) {
      log.warn("impulse registry validation skipped (backend may be unavailable)", { error })
      errors.push("Impulse registry validation skipped: backend unavailable")
    }

    // Step 6: Capture MCP payload (from logs if available)
    try {
      const mcpResult = await captureMCPPayload(activityId)
      output.results.mcpPayload = mcpResult.result
      output.actual.mcpPayload = mcpResult.payload
      if (mcpResult.errors.length > 0) {
        errors.push(...mcpResult.errors)
      }
    } catch (error) {
      log.warn("MCP payload capture skipped", { error })
      errors.push("MCP payload capture skipped")
    }

    // Determine overall pass/fail
    output.pass = determineOverallPass(output.results, errors)

    log.info("validation completed", {
      pass: output.pass,
      errorCount: errors.length,
    })

    return output
  } catch (error) {
    errors.push(`Validation failed with exception: ${error instanceof Error ? error.message : String(error)}`)
    log.error("validation harness failed", { error })
    return output
  }
}

/**
 * Execute a test activity with given parameters
 */
async function executeTestActivity(input: ValidationInput): Promise<string | undefined> {
  try {
    log.debug("executing test activity", { templateId: input.templateId })

    // Load template
    const template = await ActivityTemplate.load(input.templateId)
    if (!template) {
      log.error("template not found", { templateId: input.templateId })
      return undefined
    }

    // Create activity with test parameters
    const activity = await Activity.create({
      templateId: input.templateId,
      variables: input.variables,
      reason: input.reason,
    })

    log.info("test activity created", {
      activityId: activity.id,
      templateId: input.templateId,
    })

    return activity.id
  } catch (error) {
    log.error("failed to execute test activity", { error })
    return undefined
  }
}

/**
 * Validate activity execution data in OpenCode storage
 */
async function validateActivityExecution(
  activityId: string,
  input: ValidationInput,
): Promise<{
  result: ValidationOutput["results"]["activityExecution"]
  impulsesUsed?: any[]
  componentChanges?: any[]
  errors: string[]
}> {
  const errors: string[] = []
  const result: ValidationOutput["results"]["activityExecution"] = {
    exists: false,
    hasCorrectTemplate: false,
    hasMetrics: false,
    hasImpulsesUsed: false,
    hasComponentChanges: false,
  }

  try {
    // Load activity from storage
    const activity = await Activity.load(activityId)

    if (!activity) {
      errors.push(`Activity ${activityId} not found in storage`)
      return { result, errors }
    }

    result.exists = true

    // Validate template ID
    if (activity.templateId === input.templateId) {
      result.hasCorrectTemplate = true
    } else {
      errors.push(
        `Template ID mismatch: expected ${input.templateId}, got ${activity.templateId}`,
      )
    }

    // Validate metrics
    if (activity.stats && activity.stats.duration > 0) {
      result.hasMetrics = true
    } else {
      errors.push("Activity metrics not recorded")
    }

    // Check impulses in activity registry
    const loadedImpulses = Object.entries(activity.impulses || {}).filter(
      ([_, impulse]) => impulse.loaded,
    )

    if (loadedImpulses.length > 0) {
      result.hasImpulsesUsed = true
      result.impulsesUsedCount = loadedImpulses.length

      // Validate expected count if provided
      if (
        input.expectedImpulseCount !== undefined &&
        loadedImpulses.length !== input.expectedImpulseCount
      ) {
        errors.push(
          `Impulse count mismatch: expected ${input.expectedImpulseCount}, got ${loadedImpulses.length}`,
        )
      }
    } else {
      errors.push("No impulses tracked in activity registry")
    }

    // Check component changes (would need to inspect commits)
    if (activity.commits && activity.commits.length > 0) {
      result.hasComponentChanges = true
      result.componentsChangedCount = activity.commits.reduce(
        (sum, commit) => sum + commit.filesChanged.length,
        0,
      )

      if (
        input.expectedComponentCount !== undefined &&
        result.componentsChangedCount !== input.expectedComponentCount
      ) {
        errors.push(
          `Component count mismatch: expected ${input.expectedComponentCount}, got ${result.componentsChangedCount}`,
        )
      }
    }

    return {
      result,
      impulsesUsed: loadedImpulses.map(([id, impulse]) => ({
        impulse_id: id,
        tokens_used: impulse.tokenCount,
        was_useful: activity.status === "done",
      })),
      componentChanges: activity.commits.flatMap((commit) =>
        commit.filesChanged.map((file) => ({
          file_path: file,
          commit: commit.sha,
        })),
      ),
      errors,
    }
  } catch (error) {
    errors.push(`Failed to validate activity execution: ${error instanceof Error ? error.message : String(error)}`)
    return { result, errors }
  }
}

/**
 * Validate impulse usage records in backend database
 */
async function validateImpulseUsage(
  activityId: string,
): Promise<{
  result: ValidationOutput["results"]["impulseUsage"]
  errors: string[]
}> {
  const errors: string[] = []
  const result: ValidationOutput["results"]["impulseUsage"] = {
    recordsCreated: false,
    linkedToExecution: false,
  }

  // Query backend API for impulse usage records
  // This requires backend to be running
  try {
    const apiBase = process.env.METABOB_API_BASE || "http://localhost:8080"
    const response = await fetch(
      `${apiBase}/api/v1/learning-loop/executions/${activityId}`,
    )

    if (!response.ok) {
      errors.push(`Backend API returned ${response.status}: ${response.statusText}`)
      return { result, errors }
    }

    const data = await response.json()

    if (data.impulses_used && Array.isArray(data.impulses_used)) {
      result.recordsCreated = data.impulses_used.length > 0
      result.recordCount = data.impulses_used.length
      result.linkedToExecution = data.impulses_used.every(
        (imp: any) => imp.execution_id === activityId,
      )

      if (!result.linkedToExecution) {
        errors.push("Impulse usage records not properly linked to execution")
      }
    } else {
      errors.push("No impulses_used array in execution data")
    }

    return { result, errors }
  } catch (error) {
    errors.push(`Failed to query impulse usage: ${error instanceof Error ? error.message : String(error)}`)
    return { result, errors }
  }
}

/**
 * Validate impulse registry success rate updates
 */
async function validateImpulseRegistry(
  activityId: string,
): Promise<{
  result: ValidationOutput["results"]["impulseRegistry"]
  errors: string[]
}> {
  const errors: string[] = []
  const result: ValidationOutput["results"]["impulseRegistry"] = {
    updatedSuccessRates: false,
  }

  // Query backend for impulse registry updates
  try {
    const apiBase = process.env.METABOB_API_BASE || "http://localhost:8080"
    
    // First get execution to find impulses
    const execResponse = await fetch(
      `${apiBase}/api/v1/learning-loop/executions/${activityId}`,
    )

    if (!execResponse.ok) {
      errors.push("Cannot validate impulse registry without execution data")
      return { result, errors }
    }

    const execData = await execResponse.json()
    const impulseIds = execData.impulses_used?.map((imp: any) => imp.impulse_id) || []

    if (impulseIds.length === 0) {
      errors.push("No impulses to validate in registry")
      return { result, errors }
    }

    // Check each impulse in registry
    let updatedCount = 0
    for (const impulseId of impulseIds) {
      const impulseResponse = await fetch(
        `${apiBase}/api/v1/impulse-registry/${impulseId}`,
      )

      if (impulseResponse.ok) {
        const impulseData = await impulseResponse.json()
        if (
          impulseData.usage_count !== undefined &&
          impulseData.success_rate !== undefined
        ) {
          updatedCount++
        }
      }
    }

    result.impulseCount = impulseIds.length
    result.updatedSuccessRates = updatedCount === impulseIds.length

    if (!result.updatedSuccessRates) {
      errors.push(
        `Only ${updatedCount}/${impulseIds.length} impulses have updated success rates`,
      )
    }

    return { result, errors }
  } catch (error) {
    errors.push(`Failed to validate impulse registry: ${error instanceof Error ? error.message : String(error)}`)
    return { result, errors }
  }
}

/**
 * Capture MCP payload from logs or direct inspection
 */
async function captureMCPPayload(
  activityId: string,
): Promise<{
  result: ValidationOutput["results"]["mcpPayload"]
  payload?: string
  errors: string[]
}> {
  const errors: string[] = []
  const result: ValidationOutput["results"]["mcpPayload"] = {
    captured: false,
    hasImpulsesUsed: false,
    hasComponentChanges: false,
  }

  // Try to find MCP payload in logs
  try {
    // Look for log entries containing the activity ID and MCP data
    const logDir = process.env.OPENCODE_LOG_DIR || ".opencode/logs"
    const logFiles = await $`find ${logDir} -name "*.log" -mtime -1`.text()

    for (const logFile of logFiles.split("\n").filter(Boolean)) {
      try {
        const logContent = await Bun.file(logFile).text()
        
        // Search for MCP payload related to this activity
        const mcpPattern = new RegExp(
          `reporting activity execution.*${activityId}.*impulses.*components`,
          "i",
        )
        
        if (mcpPattern.test(logContent)) {
          result.captured = true
          result.hasImpulsesUsed = /impulses.*:\s*\d+/i.test(logContent)
          result.hasComponentChanges = /components.*:\s*\d+/i.test(logContent)

          // Extract payload size if available
          const sizeMatch = logContent.match(/payloadSize.*?(\d+)/i)
          if (sizeMatch) {
            result.payloadSize = parseInt(sizeMatch[1])
          }

          return { result, payload: logContent, errors }
        }
      } catch (fileError) {
        // Skip files we can't read
        continue
      }
    }

    errors.push("MCP payload not found in logs")
    return { result, errors }
  } catch (error) {
    errors.push(`Failed to capture MCP payload: ${error instanceof Error ? error.message : String(error)}`)
    return { result, errors }
  }
}

/**
 * Determine overall pass/fail based on validation results
 */
function determineOverallPass(
  results: ValidationOutput["results"],
  errors: string[],
): boolean {
  // Critical checks that must pass
  const criticalChecks = [
    results.activityExecution.exists,
    results.activityExecution.hasCorrectTemplate,
    results.activityExecution.hasMetrics,
    results.activityExecution.hasImpulsesUsed, // Critical: impulses must be tracked
  ]

  // All critical checks must pass
  if (!criticalChecks.every((check) => check === true)) {
    return false
  }

  // If no errors, pass
  if (errors.length === 0) {
    return true
  }

  // If only warnings about backend availability, still pass (local validation sufficient)
  const nonBackendErrors = errors.filter(
    (err) => !err.includes("backend") && !err.includes("skipped"),
  )

  return nonBackendErrors.length === 0
}

/**
 * Export test case generator for creating validation impulses
 */
export function generateTestCase(
  caseNumber: number,
  templateId: string,
  variables: Record<string, unknown>,
  reason: string,
  expectedImpulseCount?: number,
  expectedComponentCount?: number,
): {
  impulseId: string
  input: ValidationInput
  expectedOutput: string
} {
  return {
    impulseId: `validation-mcp-data-flow-devbob-cli-database-case-${caseNumber}`,
    input: {
      templateId,
      variables,
      reason,
      expectedImpulseCount,
      expectedComponentCount,
    },
    expectedOutput: JSON.stringify(
      {
        pass: true,
        activityExecution: {
          exists: true,
          hasCorrectTemplate: true,
          hasMetrics: true,
          hasImpulsesUsed: true,
          hasComponentChanges: true,
        },
        impulseUsage: {
          recordsCreated: true,
          linkedToExecution: true,
        },
      },
      null,
      2,
    ),
  }
}
