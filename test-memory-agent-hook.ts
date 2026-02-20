#!/usr/bin/env bun

/**
 * Test if memory management hook is working
 */

import { TurnLifecycle } from "./repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle"
import { Agent } from "./repos/metabob-opencode/packages/opencode/src/agent/agent"

async function test() {
  console.log("\n=== Testing Memory Management Hook ===\n")

  // Import hooks (this should register them)
  await import("./repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks")

  console.log("Turn lifecycle hooks registered:")
  const hooks = TurnLifecycle.getHooks()
  for (const hook of hooks) {
    console.log(`  - ${hook.name} (priority: ${hook.priority})`)
  }

  // Find memory-management hook
  const memoryHook = hooks.find((h) => h.name === "memory-management")
  if (!memoryHook) {
    console.error("\n❌ memory-management hook NOT found!")
    return
  }

  console.log("\n✅ memory-management hook found!")

  // Test if it's enabled for a test context
  const agent = await Agent.get({ mode: "primary" })
  const testContext: TurnLifecycle.TurnContext = {
    sessionID: "test-session",
    userMessageID: "test-msg",
    promptText: "Fix the authentication bug in auth.ts",
    agent,
    timestamp: Date.now(),
  }

  const enabled = await memoryHook.enabled(testContext)
  console.log(`\nHook enabled for test context: ${enabled}`)

  if (!enabled) {
    console.log("  Agent mode:", agent.mode)
    console.log("  Prompt length:", testContext.promptText.length)
  } else {
    console.log("\n✅ Hook should execute for this context!")
    console.log("\nNext: Check if manage-session-memory template is available...")

    try {
      const { TemplateLoader } = await import(
        "./repos/metabob-opencode/packages/opencode/src/session/template-loader"
      )

      const result = await TemplateLoader.load("manage-session-memory", { backend: "local" })
      console.log(`\n✅ Template loaded: ${result.template.name}`)
      console.log(`   Source: ${result.source}`)
      console.log(`   Tasks: ${result.template.tasks.length}`)

      for (const task of result.template.tasks) {
        console.log(`     - ${task.id}: ${task.description} (subagent: ${task.subagent})`)
      }
    } catch (error) {
      console.error(`\n❌ Template loading failed:`)
      console.error(`   ${error.message}`)
      console.error(`\n   This is likely why the hook isn't creating impulses!`)
    }
  }
}

test().catch(console.error)
