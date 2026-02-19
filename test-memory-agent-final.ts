#!/usr/bin/env bun
/**
 * Comprehensive test for memory agent configuration fix
 * Tests both the agent definition and the sessionMemory configuration
 */

import { Agent } from "./repos/metabob-opencode/packages/opencode/src/agent/agent"
import { Config } from "./repos/metabob-opencode/packages/opencode/src/config/config"
import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"

async function testMemoryAgentFix() {
  console.log("🧪 Testing Memory Agent Configuration Fix\n")
  console.log("=" .repeat(60))

  let allTestsPassed = true

  try {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        // Test 1: Check memory agent exists and has model
        console.log("\n📝 Test 1: Memory Agent Definition")
        console.log("-".repeat(60))

        const memoryAgent = await Agent.get("memory")
        console.log(`✓ Memory agent found: ${memoryAgent.name}`)
        console.log(`  Description: ${memoryAgent.description}`)
        console.log(`  Mode: ${memoryAgent.mode}`)

        if (!memoryAgent.model) {
          console.error("❌ FAIL: Memory agent has no model configuration!")
          allTestsPassed = false
        } else {
          console.log(`✓ Model configured:`)
          console.log(`    Provider: ${memoryAgent.model.providerID}`)
          console.log(`    Model: ${memoryAgent.model.modelID}`)

          if (
            memoryAgent.model.providerID === "anthropic" &&
            memoryAgent.model.modelID === "claude-4-5-haiku"
          ) {
            console.log("✓ PASS: Correct model (Claude Haiku 4.5)")
          } else {
            console.error(
              `❌ FAIL: Wrong model. Expected anthropic/claude-4-5-haiku, got ${memoryAgent.model.providerID}/${memoryAgent.model.modelID}`,
            )
            allTestsPassed = false
          }
        }

        // Test 2: Check sessionMemory config
        console.log("\n📝 Test 2: SessionMemory Configuration")
        console.log("-".repeat(60))

        const config = await Config.get()
        if (!config.sessionMemory) {
          console.error("❌ FAIL: No sessionMemory configuration found!")
          allTestsPassed = false
        } else {
          console.log(`✓ SessionMemory enabled: ${config.sessionMemory.enabled}`)

          if (config.sessionMemory.analysis) {
            console.log("✓ Analysis configuration present:")
            console.log(`    Provider: ${config.sessionMemory.analysis.provider}`)
            console.log(`    Model: ${config.sessionMemory.analysis.model}`)
            console.log(`    Timeout: ${config.sessionMemory.analysis.timeout}ms`)

            if (
              config.sessionMemory.analysis.provider === "anthropic" &&
              config.sessionMemory.analysis.model === "claude-4-5-haiku"
            ) {
              console.log("✓ PASS: Correct analysis model")
            } else {
              console.error("❌ FAIL: Wrong analysis model configuration")
              allTestsPassed = false
            }
          } else {
            console.error("❌ FAIL: No analysis configuration in sessionMemory!")
            allTestsPassed = false
          }

          if (config.sessionMemory.budgets) {
            console.log(`✓ Budget configuration:`)
            console.log(`    Per impulse: ${config.sessionMemory.budgets.perImpulse} tokens`)
          }

          if (config.sessionMemory.maxImpulsesPerTurn) {
            console.log(`✓ Max impulses per turn: ${config.sessionMemory.maxImpulsesPerTurn}`)
          }
        }

        // Test 3: Check all subagents
        console.log("\n📝 Test 3: All Subagent Model Status")
        console.log("-".repeat(60))

        const allAgents = await Agent.list()
        const subagents = allAgents.filter((a) => a.mode === "subagent" || a.mode === "all")

        console.log(`Found ${subagents.length} subagents:\n`)

        for (const agent of subagents) {
          const hasModel = agent.model ? "✓ HAS MODEL" : "⚠  Uses default"
          const modelInfo = agent.model
            ? `(${agent.model.providerID}/${agent.model.modelID})`
            : "(will use Provider.defaultModel)"

          console.log(`  ${agent.name.padEnd(15)} ${hasModel.padEnd(15)} ${modelInfo}`)
        }

        // Test 4: Verify tools
        console.log("\n📝 Test 4: Memory Agent Tools")
        console.log("-".repeat(60))

        const expectedTools = [
          "impulse_create",
          "impulse_list",
          "impulse_load",
          "impulse_unload",
          "impulse_delete",
          "impulse_update",
          "memory_outline",
          "memory_budget",
          "memory_optimize",
          "negotiate_context",
          "activity_reason",
        ]

        let missingTools = []
        for (const tool of expectedTools) {
          if (memoryAgent.tools[tool]) {
            console.log(`  ✓ ${tool}`)
          } else {
            console.log(`  ❌ ${tool} (missing!)`)
            missingTools.push(tool)
            allTestsPassed = false
          }
        }

        if (missingTools.length > 0) {
          console.error(`\n❌ FAIL: Missing ${missingTools.length} required tools`)
        } else {
          console.log("\n✓ PASS: All required tools present")
        }

        // Summary
        console.log("\n" + "=".repeat(60))
        if (allTestsPassed) {
          console.log("✅ ALL TESTS PASSED")
          console.log("\nThe memory agent is now correctly configured:")
          console.log("  • Agent has model: anthropic/claude-4-5-haiku")
          console.log("  • SessionMemory config is complete")
          console.log("  • All required tools are available")
          console.log("\nThe 'Manage Session Memory' activity should now work!")
        } else {
          console.log("❌ SOME TESTS FAILED")
          console.log("\nPlease review the failures above.")
          process.exit(1)
        }
      },
    })
  } catch (error) {
    console.error("\n💥 Test execution failed!")
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error("\n   Stack trace:")
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testMemoryAgentFix()
