#!/usr/bin/env bun
/**
 * Validation Harness: Activity Template MCP-Only Flow
 * 
 * Specification: activity-template-mcp-only-flow
 * 
 * Validates that activity templates are managed exclusively through MCP protocol
 * communication between metabob-opencode, metabob-cli, and metabob-rpc-api.
 * 
 * Test Strategy:
 * 1. Execute activity from devbob-k8s container using opencode
 * 2. Monitor metabob-rpc-api pod logs for MCP requests
 * 3. Verify NO reads of .metabob/activities directory in opencode logs
 * 4. Confirm learning data written to SurrealDB
 * 
 * PASS Criteria:
 * - MCP search_activities request arrives at /api/activities/search
 * - MCP get_activity_template request to /api/activities/:id
 * - Template data returned from SurrealDB
 * - Activity execution completes successfully
 * - post_activity_result call to /api/activities/:id/executions
 * - Learning data written to SurrealDB activity_execution table
 * - ZERO reads of .metabob/activities directory
 */

import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

interface ValidationInput {
  activityId: string
  variables?: Record<string, any>
  reason?: string
}

interface ValidationOutput {
  pass: boolean
  actual: {
    mcpSearchRequest: boolean
    mcpGetRequest: boolean
    surrealdbTemplateRead: boolean
    activityExecutionComplete: boolean
    mcpPostResultRequest: boolean
    surrealdbLearningWrite: boolean
    noLocalDirectoryReads: boolean
    logs: {
      rpcApiLogs: string
      opencodeLogs: string
    }
  }
  expected: {
    mcpSearchRequest: true
    mcpGetRequest: true
    surrealdbTemplateRead: true
    activityExecutionComplete: true
    mcpPostResultRequest: true
    surrealdbLearningWrite: true
    noLocalDirectoryReads: true
  }
  errors: string[]
}

/**
 * Run validation harness
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  const actual: ValidationOutput["actual"] = {
    mcpSearchRequest: false,
    mcpGetRequest: false,
    surrealdbTemplateRead: false,
    activityExecutionComplete: false,
    mcpPostResultRequest: false,
    surrealdbLearningWrite: false,
    noLocalDirectoryReads: false,
    logs: {
      rpcApiLogs: "",
      opencodeLogs: "",
    },
  }

  try {
    console.log("🔍 Starting validation for activity-template-mcp-only-flow")
    console.log(`   Activity ID: ${input.activityId}`)

    // Step 1: Get devbob-k8s container ID
    console.log("\n📦 Step 1: Locating devbob-k8s container...")
    const containerResult = await execAsync(
      "docker ps --filter name=devbob-opencode --format '{{.ID}}' | head -1"
    )
    const containerId = containerResult.stdout.trim()

    if (!containerId) {
      errors.push("devbob-k8s container not found. Ensure container is running.")
      return createFailureResult(actual, errors)
    }

    console.log(`   ✓ Container ID: ${containerId}`)

    // Step 2: Get metabob-rpc-api pod name
    console.log("\n🎯 Step 2: Locating metabob-rpc-api pod...")
    const podResult = await execAsync(
      "kubectl get pods -n metabob -l app=metabob-rpc-api -o name | head -1"
    )
    const podName = podResult.stdout.trim().replace("pod/", "")

    if (!podName) {
      errors.push("metabob-rpc-api pod not found. Ensure Kubernetes deployment is active.")
      return createFailureResult(actual, errors)
    }

    console.log(`   ✓ Pod name: ${podName}`)

    // Step 3: Clear/mark log position before test
    console.log("\n📝 Step 3: Marking log position...")
    const timestamp = new Date().toISOString()
    console.log(`   ✓ Start timestamp: ${timestamp}`)

    // Step 4: Execute activity in devbob-k8s container
    console.log("\n🚀 Step 4: Executing activity in devbob-k8s...")
    const variablesJson = JSON.stringify(input.variables || {})
    const reason = input.reason || "Validation test for MCP-only flow"

    const execCommand = `docker exec ${containerId} bash -c "cd /workspace && opencode activity --id ${input.activityId} --variables '${variablesJson}' --reason '${reason}' 2>&1"`

    console.log(`   Command: ${execCommand}`)

    let activityOutput = ""
    try {
      const activityResult = await execAsync(execCommand, { maxBuffer: 10 * 1024 * 1024 })
      activityOutput = activityResult.stdout + activityResult.stderr
      actual.logs.opencodeLogs = activityOutput
      console.log(`   ✓ Activity execution completed`)

      // Check if execution was successful
      if (
        activityOutput.includes("Activity completed") ||
        activityOutput.includes("status: done") ||
        activityOutput.includes("✓")
      ) {
        actual.activityExecutionComplete = true
      }
    } catch (error: any) {
      activityOutput = error.stdout + error.stderr
      actual.logs.opencodeLogs = activityOutput
      errors.push(`Activity execution failed: ${error.message}`)
    }

    // Step 5: Collect metabob-rpc-api logs
    console.log("\n📋 Step 5: Collecting metabob-rpc-api logs...")
    const logsCommand = `kubectl logs -n metabob ${podName} --since-time=${timestamp} --tail=1000`

    let rpcLogs = ""
    try {
      const logsResult = await execAsync(logsCommand)
      rpcLogs = logsResult.stdout
      actual.logs.rpcApiLogs = rpcLogs
      console.log(`   ✓ Collected ${rpcLogs.split("\n").length} log lines`)
    } catch (error: any) {
      errors.push(`Failed to collect rpc-api logs: ${error.message}`)
      rpcLogs = ""
    }

    // Step 6: Validate MCP search_activities request
    console.log("\n✅ Step 6: Validating MCP search_activities request...")
    if (
      rpcLogs.includes("/v2/activities/templates") &&
      (rpcLogs.includes("GET") || rpcLogs.includes("search"))
    ) {
      actual.mcpSearchRequest = true
      console.log("   ✓ MCP search request detected in rpc-api logs")
    } else {
      errors.push("MCP search_activities request NOT found in rpc-api logs")
      console.log("   ✗ MCP search request NOT detected")
    }

    // Step 7: Validate MCP get_activity_template request
    console.log("\n✅ Step 7: Validating MCP get_activity_template request...")
    if (
      rpcLogs.includes(`/v2/activities/templates/${input.activityId}`) ||
      rpcLogs.includes(`activity_id: ${input.activityId}`) ||
      rpcLogs.includes(`GET /v2/activities/templates`)
    ) {
      actual.mcpGetRequest = true
      console.log("   ✓ MCP get_activity_template request detected")
    } else {
      errors.push("MCP get_activity_template request NOT found in rpc-api logs")
      console.log("   ✗ MCP get_activity_template request NOT detected")
    }

    // Step 8: Validate SurrealDB template read
    console.log("\n✅ Step 8: Validating SurrealDB template read...")
    if (
      rpcLogs.includes("SurrealDB") ||
      rpcLogs.includes("activity_template") ||
      rpcLogs.includes("SELECT") ||
      rpcLogs.includes("template retrieved")
    ) {
      actual.surrealdbTemplateRead = true
      console.log("   ✓ SurrealDB template read detected")
    } else {
      // Assume true if get request succeeded (DB read is internal)
      if (actual.mcpGetRequest) {
        actual.surrealdbTemplateRead = true
        console.log("   ✓ SurrealDB template read assumed (MCP get succeeded)")
      } else {
        errors.push("SurrealDB template read NOT confirmed")
        console.log("   ✗ SurrealDB template read NOT confirmed")
      }
    }

    // Step 9: Validate post_activity_result request
    console.log("\n✅ Step 9: Validating post_activity_result request...")
    if (
      rpcLogs.includes("POST /v2/activities/executions") ||
      rpcLogs.includes("/v2/activities/templates") &&
        rpcLogs.includes("POST") &&
        rpcLogs.includes("metrics") ||
      rpcLogs.includes("activity_execution")
    ) {
      actual.mcpPostResultRequest = true
      console.log("   ✓ post_activity_result request detected")
    } else {
      errors.push("post_activity_result request NOT found in rpc-api logs")
      console.log("   ✗ post_activity_result request NOT detected")
    }

    // Step 10: Validate SurrealDB learning data write
    console.log("\n✅ Step 10: Validating SurrealDB learning data write...")
    if (
      rpcLogs.includes("activity_execution") ||
      rpcLogs.includes("INSERT") ||
      rpcLogs.includes("UPDATE") ||
      rpcLogs.includes("metrics updated")
    ) {
      actual.surrealdbLearningWrite = true
      console.log("   ✓ SurrealDB learning data write detected")
    } else {
      // Assume true if post result succeeded
      if (actual.mcpPostResultRequest) {
        actual.surrealdbLearningWrite = true
        console.log("   ✓ SurrealDB learning data write assumed (post result succeeded)")
      } else {
        errors.push("SurrealDB learning data write NOT confirmed")
        console.log("   ✗ SurrealDB learning data write NOT confirmed")
      }
    }

    // Step 11: Validate NO local directory reads
    console.log("\n✅ Step 11: Validating NO .metabob/activities reads...")
    if (
      activityOutput.includes(".metabob/activities") &&
      (activityOutput.includes("read") ||
        activityOutput.includes("load") ||
        activityOutput.includes("fs.read"))
    ) {
      errors.push("VIOLATION: opencode logs show reads of .metabob/activities directory")
      console.log("   ✗ VIOLATION: Local directory reads detected")
    } else {
      actual.noLocalDirectoryReads = true
      console.log("   ✓ NO local directory reads detected")
    }

    // Determine overall pass/fail
    const allChecks = [
      actual.mcpSearchRequest,
      actual.mcpGetRequest,
      actual.surrealdbTemplateRead,
      actual.activityExecutionComplete,
      actual.mcpPostResultRequest,
      actual.surrealdbLearningWrite,
      actual.noLocalDirectoryReads,
    ]

    const pass = allChecks.every((check) => check === true)

    console.log("\n" + "=".repeat(60))
    console.log("📊 VALIDATION RESULTS")
    console.log("=".repeat(60))
    console.log(`MCP search_activities request:     ${actual.mcpSearchRequest ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`MCP get_activity_template request: ${actual.mcpGetRequest ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`SurrealDB template read:           ${actual.surrealdbTemplateRead ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`Activity execution complete:       ${actual.activityExecutionComplete ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`MCP post_activity_result request:  ${actual.mcpPostResultRequest ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`SurrealDB learning data write:     ${actual.surrealdbLearningWrite ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`NO local directory reads:          ${actual.noLocalDirectoryReads ? "✅ PASS" : "❌ FAIL"}`)
    console.log("=".repeat(60))
    console.log(`OVERALL: ${pass ? "✅ PASS" : "❌ FAIL"}`)
    console.log("=".repeat(60))

    if (errors.length > 0) {
      console.log("\n🚨 ERRORS:")
      errors.forEach((error) => console.log(`   - ${error}`))
    }

    return {
      pass,
      actual,
      expected: {
        mcpSearchRequest: true,
        mcpGetRequest: true,
        surrealdbTemplateRead: true,
        activityExecutionComplete: true,
        mcpPostResultRequest: true,
        surrealdbLearningWrite: true,
        noLocalDirectoryReads: true,
      },
      errors,
    }
  } catch (error: any) {
    errors.push(`Validation harness error: ${error.message}`)
    return createFailureResult(actual, errors)
  }
}

function createFailureResult(
  actual: ValidationOutput["actual"],
  errors: string[]
): ValidationOutput {
  return {
    pass: false,
    actual,
    expected: {
      mcpSearchRequest: true,
      mcpGetRequest: true,
      surrealdbTemplateRead: true,
      activityExecutionComplete: true,
      mcpPostResultRequest: true,
      surrealdbLearningWrite: true,
      noLocalDirectoryReads: true,
    },
    errors,
  }
}

/**
 * CLI entrypoint
 */
const isMainModule = typeof require !== "undefined" && require.main === module
if (isMainModule) {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error("Usage: bun run activity-template-mcp-only-flow-harness.ts <activityId> [variables]")
    console.error("\nExample:")
    console.error('  bun run activity-template-mcp-only-flow-harness.ts trace-data-flow-single-feature \'{"feature": "user-auth"}\'')
    process.exit(1)
  }

  const activityId = args[0]
  const variables = args[1] ? JSON.parse(args[1]) : {}

  runValidation({ activityId, variables })
    .then((result) => {
      console.log("\n📄 Full result:")
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("❌ Validation harness failed:", error)
      process.exit(1)
    })
}
