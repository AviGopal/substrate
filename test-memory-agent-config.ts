#!/usr/bin/env bun
/**
 * Test script to validate memory agent configuration
 * Verifies that the model is correctly configured and accessible
 */

import { SessionMemoryAgent } from "./repos/metabob-opencode/packages/opencode/src/session/memory-agent"
import { Identifier } from "./repos/metabob-opencode/packages/opencode/src/id/id"
import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"

async function testMemoryAgentConfig() {
  console.log("🧪 Testing Memory Agent Configuration\n")

  try {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const sessionID = Identifier.ascending("session")
        const promptText = "Hello, can you help me?"

        console.log("📝 Test input:")
        console.log(`  Session ID: ${sessionID}`)
        console.log(`  Prompt: "${promptText}"\n`)

        console.log("⏳ Calling SessionMemoryAgent.analyzeIntent()...")
        const startTime = Date.now()

        const intent = await SessionMemoryAgent.analyzeIntent({
          sessionID,
          promptText,
          recentMessages: [],
        })

        const elapsed = Date.now() - startTime
        console.log(`✅ Success! (${elapsed}ms)\n`)

        console.log("📊 Result:")
        console.log(`  Intent Type: ${intent.type}`)
        console.log(`  Confidence: ${intent.confidence}`)
        console.log(`  Reasoning: ${intent.reasoning}`)
        console.log(`  Suggested Impulses: ${intent.suggestedImpulses.length}`)

        if (intent.suggestedImpulses.length > 0) {
          console.log("\n  Impulses:")
          intent.suggestedImpulses.forEach((impulse, i) => {
            console.log(`    ${i + 1}. ${impulse.id} (${impulse.type}, ${impulse.priority})`)
            console.log(`       Description: ${impulse.description}`)
          })
        }

        console.log("\n✨ Memory agent is working correctly!")
        console.log("   Model: claude-3-5-haiku-20241022")
        console.log("   Provider: anthropic")
      },
    })
  } catch (error) {
    console.error("\n❌ Test failed!")
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error("\n   Stack trace:")
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testMemoryAgentConfig()
