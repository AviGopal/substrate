/**
 * Validation Harness: dual-write-activity-metrics
 * 
 * Validates that activity execution metrics are written to both:
 * - Redis (fast cache with 7-day TTL) for Thompson Sampling
 * - SurrealDB (permanent storage) for long-term learning
 * 
 * Strategy:
 * 1. Execute a simple activity (hello-world-minimal)
 * 2. Query Redis: GET activity:metrics:{variant_id}
 * 3. Query SurrealDB: SELECT * FROM activity_execution WHERE template_id = 'hello-world-minimal'
 * 4. Verify both contain same execution data
 * 5. Verify Redis has TTL ~7 days
 * 6. Verify SurrealDB has no expiry
 * 
 * Note: Phase 1 implementation only validates Redis write (JSON files are also checked).
 *       Phase 2 will add SurrealDB validation when implemented.
 */

import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"

const execAsync = promisify(exec)

export interface ValidationInput {
  templateId: string
  activityId?: string
  skipExecution?: boolean // If true, validate existing execution
}

export interface ValidationOutput {
  pass: boolean
  actual: {
    jsonFile?: {
      found: boolean
      hasMetrics: boolean
      executionCount?: number
      successRate?: number
    }
    redis?: {
      found: boolean
      hasMetrics: boolean
      hasTTL: boolean
      ttlDays?: number
      data?: any
    }
    surrealdb?: {
      found: boolean
      hasRecord: boolean
      isPermanent: boolean
      data?: any
    }
  }
  expected: {
    jsonFile: {
      found: boolean
      hasMetrics: boolean
    }
    redis: {
      found: boolean
      hasMetrics: boolean
      hasTTL: boolean
      ttlDaysMin: number
      ttlDaysMax: number
    }
    surrealdb: {
      found: boolean
      hasRecord: boolean
      isPermanent: boolean
    }
  }
  errors: string[]
  warnings: string[]
}

/**
 * Query Redis for activity metrics
 */
async function queryRedis(templateId: string): Promise<ValidationOutput["actual"]["redis"]> {
  try {
    // Try to query Redis using redis-cli
    // Note: variant_id may be undefined, so we try with template_id as fallback
    const keys = [
      `activity:metrics:${templateId}`,
      `activity_executions:${templateId}`,
      `activity:${templateId}:metrics`,
    ]

    for (const key of keys) {
      try {
        // Check if key exists
        const { stdout: existsOutput } = await execAsync(`redis-cli EXISTS "${key}"`)
        if (existsOutput.trim() === "1") {
          // Key exists, get data
          const { stdout: dataOutput } = await execAsync(`redis-cli GET "${key}"`)
          const data = JSON.parse(dataOutput.trim())

          // Get TTL
          const { stdout: ttlOutput } = await execAsync(`redis-cli TTL "${key}"`)
          const ttlSeconds = parseInt(ttlOutput.trim())
          const hasTTL = ttlSeconds > 0
          const ttlDays = hasTTL ? ttlSeconds / (60 * 60 * 24) : 0

          return {
            found: true,
            hasMetrics: !!(data.success !== undefined && data.duration && data.cost),
            hasTTL,
            ttlDays,
            data,
          }
        }
      } catch (keyError) {
        // Key doesn't exist or error querying, try next key
        continue
      }
    }

    // No keys found
    return {
      found: false,
      hasMetrics: false,
      hasTTL: false,
      ttlDays: 0,
    }
  } catch (error) {
    console.warn("Redis query failed:", error)
    return {
      found: false,
      hasMetrics: false,
      hasTTL: false,
      ttlDays: 0,
    }
  }
}

/**
 * Query SurrealDB for activity execution record
 */
async function querySurrealDB(
  templateId: string,
  activityId?: string,
): Promise<ValidationOutput["actual"]["surrealdb"]> {
  try {
    // Query SurrealDB using surreal CLI or HTTP API
    // Note: This is Phase 2 - not yet implemented
    const query = activityId
      ? `SELECT * FROM activity_execution WHERE activity_id = '${activityId}'`
      : `SELECT * FROM activity_execution WHERE template_id = '${templateId}' ORDER BY created_at DESC LIMIT 1`

    // For now, return not found (Phase 2 implementation)
    // When implemented, this should query SurrealDB and check for records
    return {
      found: false,
      hasRecord: false,
      isPermanent: false,
    }
  } catch (error) {
    console.warn("SurrealDB query failed:", error)
    return {
      found: false,
      hasRecord: false,
      isPermanent: false,
    }
  }
}

/**
 * Query JSON file for activity metrics
 */
async function queryJSONFile(templateId: string): Promise<ValidationOutput["actual"]["jsonFile"]> {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE
    const jsonPath = path.join(homeDir!, ".metabob", "activities", `${templateId}.json`)

    const content = await fs.readFile(jsonPath, "utf-8")
    const data = JSON.parse(content)

    return {
      found: true,
      hasMetrics: !!(
        data.estimated_metrics &&
        data.estimated_metrics.execution_count !== undefined &&
        data.estimated_metrics.success_rate !== undefined
      ),
      executionCount: data.estimated_metrics?.execution_count,
      successRate: data.estimated_metrics?.success_rate,
    }
  } catch (error) {
    console.warn("JSON file query failed:", error)
    return {
      found: false,
      hasMetrics: false,
    }
  }
}

/**
 * Execute an activity and wait for completion
 */
async function executeActivity(templateId: string): Promise<{ activityId: string; success: boolean }> {
  try {
    // Execute activity using OpenCode CLI
    // This is a simplified version - real implementation should use OpenCode API
    const { stdout } = await execAsync(
      `cd /home/avi/documents/work/exp-repo/metabob-devbob && echo '{}' | bun run opencode activity execute ${templateId}`,
      { timeout: 120000 },
    )

    // Parse output to get activity ID
    const activityIdMatch = stdout.match(/Activity ID: ([a-z0-9-]+)/)
    const activityId = activityIdMatch ? activityIdMatch[1] : "unknown"

    // Check if execution succeeded
    const success = stdout.includes("Activity completed successfully") || stdout.includes('"status":"done"')

    return { activityId, success }
  } catch (error) {
    console.error("Activity execution failed:", error)
    return { activityId: "unknown", success: false }
  }
}

/**
 * Run validation for dual-write-activity-metrics specification
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  const warnings: string[] = []

  // Step 1: Execute activity (unless skipped)
  let activityId = input.activityId
  if (!input.skipExecution) {
    console.log(`Executing activity: ${input.templateId}`)
    const execution = await executeActivity(input.templateId)
    activityId = execution.activityId

    if (!execution.success) {
      errors.push(`Activity execution failed for ${input.templateId}`)
    }

    // Wait a bit for metrics to be written
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  // Step 2: Query all storage backends
  console.log("Querying storage backends...")
  const [jsonFile, redis, surrealdb] = await Promise.all([
    queryJSONFile(input.templateId),
    queryRedis(input.templateId),
    querySurrealDB(input.templateId, activityId),
  ])

  // Step 3: Define expected outputs
  const expected: ValidationOutput["expected"] = {
    jsonFile: {
      found: true,
      hasMetrics: true,
    },
    redis: {
      found: true, // Phase 1: Redis should have data
      hasMetrics: true,
      hasTTL: true,
      ttlDaysMin: 6.5, // Allow some time to pass
      ttlDaysMax: 7.5,
    },
    surrealdb: {
      found: false, // Phase 2: Not yet implemented
      hasRecord: false,
      isPermanent: false,
    },
  }

  // Step 4: Validate JSON file
  if (!jsonFile.found) {
    errors.push("JSON file not found - Path A (MCP write) failed")
  } else if (!jsonFile.hasMetrics) {
    errors.push("JSON file missing metrics - Path A (MCP write) incomplete")
  }

  // Step 5: Validate Redis
  if (!redis.found) {
    errors.push("Redis key not found - Path B (Redis write) failed")
  } else {
    if (!redis.hasMetrics) {
      errors.push("Redis missing metrics - Path B (Redis write) incomplete")
    }
    if (!redis.hasTTL) {
      warnings.push("Redis key has no TTL - should have 7-day expiry")
    } else if (redis.ttlDays && (redis.ttlDays < expected.redis.ttlDaysMin || redis.ttlDays > expected.redis.ttlDaysMax)) {
      warnings.push(
        `Redis TTL is ${redis.ttlDays.toFixed(2)} days - expected between ${expected.redis.ttlDaysMin} and ${expected.redis.ttlDaysMax} days`,
      )
    }
  }

  // Step 6: Validate SurrealDB (Phase 2)
  if (surrealdb.found) {
    // Phase 2: Validate SurrealDB data
    if (!surrealdb.hasRecord) {
      errors.push("SurrealDB record found but incomplete - Path C (SurrealDB write) incomplete")
    }
    if (!surrealdb.isPermanent) {
      errors.push("SurrealDB record has expiry - should be permanent")
    }
  } else {
    warnings.push("SurrealDB not implemented yet (Phase 2) - Path C (SurrealDB write) not active")
  }

  // Step 7: Determine pass/fail
  // Phase 1: Pass if JSON and Redis both have data
  // Phase 2: Pass if JSON, Redis, and SurrealDB all have data
  const phase1Pass = jsonFile.found && jsonFile.hasMetrics && redis.found && redis.hasMetrics
  const phase2Pass = phase1Pass && surrealdb.found && surrealdb.hasRecord && surrealdb.isPermanent

  // For now, we only require Phase 1 to pass
  const pass = phase1Pass && errors.length === 0

  return {
    pass,
    actual: {
      jsonFile,
      redis,
      surrealdb,
    },
    expected,
    errors,
    warnings,
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const templateId = process.argv[2] || "hello-world-minimal"
  const skipExecution = process.argv.includes("--skip-execution")

  console.log("Dual-Write Activity Metrics Validation Harness")
  console.log("=" .repeat(60))
  console.log(`Template ID: ${templateId}`)
  console.log(`Skip Execution: ${skipExecution}`)
  console.log("")

  runValidation({ templateId, skipExecution })
    .then((result) => {
      console.log("\n" + "=".repeat(60))
      console.log("VALIDATION RESULTS")
      console.log("=".repeat(60))

      console.log("\nJSON File (Path A - MCP):")
      console.log(`  Found: ${result.actual.jsonFile?.found ? "✓" : "✗"}`)
      console.log(`  Has Metrics: ${result.actual.jsonFile?.hasMetrics ? "✓" : "✗"}`)
      if (result.actual.jsonFile?.executionCount !== undefined) {
        console.log(`  Execution Count: ${result.actual.jsonFile.executionCount}`)
        console.log(`  Success Rate: ${result.actual.jsonFile.successRate}`)
      }

      console.log("\nRedis (Path B - MetabobCLI):")
      console.log(`  Found: ${result.actual.redis?.found ? "✓" : "✗"}`)
      console.log(`  Has Metrics: ${result.actual.redis?.hasMetrics ? "✓" : "✗"}`)
      console.log(`  Has TTL: ${result.actual.redis?.hasTTL ? "✓" : "✗"}`)
      if (result.actual.redis?.ttlDays) {
        console.log(`  TTL: ${result.actual.redis.ttlDays.toFixed(2)} days`)
      }

      console.log("\nSurrealDB (Path C - Not Implemented):")
      console.log(`  Found: ${result.actual.surrealdb?.found ? "✓" : "✗"}`)
      console.log(`  Has Record: ${result.actual.surrealdb?.hasRecord ? "✓" : "✗"}`)
      console.log(`  Is Permanent: ${result.actual.surrealdb?.isPermanent ? "✓" : "✗"}`)

      if (result.errors.length > 0) {
        console.log("\nErrors:")
        result.errors.forEach((error) => console.log(`  ✗ ${error}`))
      }

      if (result.warnings.length > 0) {
        console.log("\nWarnings:")
        result.warnings.forEach((warning) => console.log(`  ⚠ ${warning}`))
      }

      console.log(`\n${"=".repeat(60)}`)
      console.log(`RESULT: ${result.pass ? "PASS ✓" : "FAIL ✗"}`)
      console.log("=".repeat(60))

      process.exit(result.pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("\nFATAL ERROR:", error)
      process.exit(1)
    })
}
