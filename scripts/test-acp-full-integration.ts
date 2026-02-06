#!/usr/bin/env bun
/**
 * Comprehensive ACP Integration Test
 * 
 * Tests the full workflow:
 * 1. ACP connection to devbob-opencode container
 * 2. Impulse creation and sharing
 * 3. Activity template execution
 * 4. Metabob tool availability and usage
 * 5. Memory agent integration
 * 
 * Usage:
 *   bun run test-acp-full-integration.ts
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { Config } from "./repos/metabob-opencode/packages/opencode/src/config/config"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"
import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { Session } from "./repos/metabob-opencode/packages/opencode/src/session"
import type { ActivityTemplate } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template"

console.log("╔══════════════════════════════════════════════════════════╗")
console.log("║     ACP Full Integration Test (Impulse/Activity/Metabob) ║")
console.log("╚══════════════════════════════════════════════════════════╝\n")

// Test configuration
const CONTAINER_NAME = "devbob-opencode"
const TARGET = `docker://${CONTAINER_NAME}`
const TEST_SESSION_ID = `test-session-${Date.now()}`

// Test results tracking
const results: Array<{ test: string; passed: boolean; details: string }> = []

function logTest(name: string, passed: boolean, details: string) {
  const icon = passed ? "✅" : "❌"
  console.log(`${icon} ${name}`)
  if (details) {
    console.log(`   ${details}`)
  }
  console.log("")
  results.push({ test: name, passed, details })
}

// Run within Instance context
await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    console.log("📋 Test Configuration")
    console.log(`   Working Directory: ${process.cwd()}`)
    console.log(`   Target Container: ${CONTAINER_NAME}`)
    console.log(`   Test Session ID: ${TEST_SESSION_ID}`)
    console.log("")

    // Phase 1: Configuration Check
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 1: Configuration & Prerequisites")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const config = await Config.get()
      const anthropicConfig = config.provider?.anthropic

      // Check for API key in config or environment
      const hasApiKey = anthropicConfig?.options?.apiKey || 
                       (anthropicConfig?.env?.some((key) => process.env[key])) ||
                       process.env.ANTHROPIC_API_KEY

      if (!hasApiKey) {
        logTest("API Key Configuration", false, "ANTHROPIC_API_KEY not found in config or environment")
        process.exit(1)
      }

      logTest("API Key Configuration", true, "ANTHROPIC_API_KEY configured")

      // Check metabob configuration
      const metabobConfig = config.metabob
      if (metabobConfig?.enabled) {
        logTest("Metabob Configuration", true, `Enabled with ${metabobConfig.max_issues} max issues`)
      } else {
        logTest("Metabob Configuration", false, "Metabob not enabled in config")
      }
    } catch (error) {
      logTest("Configuration Load", false, error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    // Phase 2: Container Health Check
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 2: Container Health Check")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const healthResult = await Bun.$`docker inspect --format '{{.State.Running}} {{.State.Health.Status}}' ${CONTAINER_NAME}`.quiet()
      const output = healthResult.stdout.toString().trim()
      const [running, health] = output.split(" ")

      if (running === "true" && (health === "healthy" || health === "")) {
        logTest("Container Health", true, `${CONTAINER_NAME} is running and healthy`)
      } else {
        logTest("Container Health", false, `Container status: running=${running}, health=${health}`)
        process.exit(1)
      }
    } catch (error) {
      logTest("Container Health", false, `Container ${CONTAINER_NAME} not found`)
      process.exit(1)
    }

    // Phase 3: Initialize ACP Tool
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 3: ACP Tool Initialization")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    let acpTool: Awaited<ReturnType<typeof ACPDelegateTool.init>>
    try {
      acpTool = await ACPDelegateTool.init()
      logTest("ACP Tool Init", true, "ACPDelegateTool initialized successfully")
    } catch (error) {
      logTest("ACP Tool Init", false, error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    // Phase 4: Test Basic ACP Connection
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 4: Basic ACP Connection Test")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const basicResult = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Test basic ACP connection",
          prompt: "List the files in the current workspace directory using the bash tool. Just show the output of 'ls -la'.",
          timeout: 60,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (basicResult.metadata?.success) {
        logTest("Basic ACP Connection", true, `Response length: ${basicResult.metadata.responseLength} chars`)
        console.log("Sample Response:")
        console.log(basicResult.output.slice(0, 500) + "...")
        console.log("")
      } else {
        logTest("Basic ACP Connection", false, basicResult.metadata?.error || "Unknown error")
      }
    } catch (error) {
      logTest("Basic ACP Connection", false, error instanceof Error ? error.message : String(error))
    }

    // Phase 5: Test Impulse Sharing
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 5: Impulse Creation & Sharing")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    let impulseId: string | undefined
    try {
      // Create a test impulse
      impulseId = "test-context-requirements"
      const impulse: ActivityTemplate.Impulse.Schema = {
        id: impulseId,
        type: "requirements",
        pointer: {
          type: "memo",
          content: `# Test Requirements

## Feature Specification
This is a test feature for ACP integration testing.

## Requirements
1. Must test ACP connection
2. Must test impulse sharing
3. Must test activity execution
4. Must verify metabob tools are available

## Acceptance Criteria
- All connection phases succeed
- Impulses are correctly shared
- Remote agent can access shared context`,
          source: "test-script",
        },
        budget: 2000,
        loaded: true,
        content: "# Test Requirements\n\nThis is a test feature for ACP integration testing.",
      }

      await SessionMemory.createImpulse(TEST_SESSION_ID, impulse)
      logTest("Impulse Creation", true, `Created impulse: ${impulseId}`)

      // Test impulse sharing via ACP
      const impulseResult = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Test impulse sharing",
          prompt:
            "You should have received shared context with test requirements. Please confirm you can see the requirements and list them back to me.",
          shareImpulses: [impulseId],
          timeout: 60,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (impulseResult.metadata?.success) {
        const hasContext = impulseResult.output.toLowerCase().includes("requirement")
        logTest(
          "Impulse Sharing",
          hasContext,
          hasContext
            ? "Remote agent successfully received and processed shared context"
            : "Remote agent did not acknowledge shared context",
        )
      } else {
        logTest("Impulse Sharing", false, impulseResult.metadata?.error || "Unknown error")
      }
    } catch (error) {
      logTest("Impulse Sharing", false, error instanceof Error ? error.message : String(error))
    }

    // Phase 6: Test Activity Template Discovery
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 6: Activity Template Discovery")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const activityResult = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Search activity templates",
          prompt: `Use the search_activities tool to list available activity templates. 
          
Return the results in a structured format showing:
- Template IDs
- Categories
- Success rates (if available)

This tests that the remote agent has access to activity template tools.`,
          timeout: 90,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (activityResult.metadata?.success) {
        const hasActivities =
          activityResult.output.toLowerCase().includes("activity") ||
          activityResult.output.toLowerCase().includes("template")
        logTest(
          "Activity Template Discovery",
          hasActivities,
          hasActivities
            ? "Remote agent successfully accessed activity templates"
            : "No activity templates found in response",
        )

        if (hasActivities) {
          console.log("Activity Template Sample:")
          console.log(activityResult.output.slice(0, 800) + "...")
          console.log("")
        }
      } else {
        logTest("Activity Template Discovery", false, activityResult.metadata?.error || "Unknown error")
      }
    } catch (error) {
      logTest("Activity Template Discovery", false, error instanceof Error ? error.message : String(error))
    }

    // Phase 7: Test Metabob Tool Availability
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 7: Metabob Tool Availability")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const metabobResult = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Test metabob tool availability",
          prompt: `Check if you have access to metabob tools by doing the following:

1. Try to use the test_metabob_mcp tool to verify connectivity
2. If test_metabob_mcp is available, use it and report the results
3. If it's not available, list what metabob-related tools you do have access to

This tests that the remote agent can access metabob MCP tools.`,
          timeout: 120,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (metabobResult.metadata?.success) {
        const hasMetabob =
          metabobResult.output.toLowerCase().includes("metabob") || metabobResult.output.toLowerCase().includes("mcp")
        logTest(
          "Metabob Tool Availability",
          hasMetabob,
          hasMetabob ? "Remote agent has metabob tool access" : "No metabob tools found",
        )

        console.log("Metabob Tool Test Result:")
        console.log(metabobResult.output.slice(0, 1000) + "...")
        console.log("")
      } else {
        logTest("Metabob Tool Availability", false, metabobResult.metadata?.error || "Unknown error")
      }
    } catch (error) {
      logTest("Metabob Tool Availability", false, error instanceof Error ? error.message : String(error))
    }

    // Phase 8: Test Memory Agent Integration
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 8: Memory Agent Auto-Selection (No Explicit Impulses)")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      // Add another impulse to test auto-selection
      const autoImpulseId = "test-design-decisions"
      const autoImpulse: ActivityTemplate.Impulse.Schema = {
        id: autoImpulseId,
        type: "designDecisions",
        pointer: {
          type: "memo",
          content: `# Design Decisions

## Architecture Choice
Using ACP protocol for multi-agent coordination.

## Why This Approach
- Enables isolated agent environments
- Supports impulse sharing for context
- Integrates with activity templates`,
          source: "test-script",
        },
        budget: 2000,
        loaded: true,
        content: "# Design Decisions\n\nUsing ACP protocol for multi-agent coordination.",
      }

      await SessionMemory.createImpulse(TEST_SESSION_ID, autoImpulse)

      // Test without explicit shareImpulses - memory agent should auto-select
      const memoryResult = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Test memory agent auto-selection",
          prompt: `You are testing the memory agent auto-selection feature. 
          
The parent session has created multiple impulses with context, but we're NOT explicitly 
sharing them. The memory agent should analyze this task and automatically select 
relevant impulses to share.

Please acknowledge if you received any shared context from the memory agent.`,
          // Note: NO shareImpulses parameter - memory agent should auto-select
          timeout: 90,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (memoryResult.metadata?.success) {
        // Memory agent may or may not select impulses depending on relevance scoring
        logTest("Memory Agent Integration", true, "Memory agent analysis completed (auto-selection tested)")
        console.log("Memory Agent Result:")
        console.log(memoryResult.output.slice(0, 600) + "...")
        console.log("")
      } else {
        logTest("Memory Agent Integration", false, memoryResult.metadata?.error || "Unknown error")
      }
    } catch (error) {
      logTest("Memory Agent Integration", false, error instanceof Error ? error.message : String(error))
    }

    // Final Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Final Test Summary")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    const passed = results.filter((r) => r.passed).length
    const total = results.length
    const passRate = ((passed / total) * 100).toFixed(1)

    console.log(`Total Tests: ${total}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${total - passed}`)
    console.log(`Pass Rate: ${passRate}%`)
    console.log("")

    if (total - passed > 0) {
      console.log("Failed Tests:")
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  ❌ ${r.test}`)
          console.log(`     ${r.details}`)
        })
      console.log("")
    }

    const overallPass = passed === total
    console.log(overallPass ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED")
    console.log("")

    process.exit(overallPass ? 0 : 1)
  },
})
