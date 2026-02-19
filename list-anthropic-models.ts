#!/usr/bin/env bun
/**
 * List all available Anthropic models
 */

import { Provider } from "./repos/metabob-opencode/packages/opencode/src/provider/provider"
import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"

async function listAnthropicModels() {
  console.log("📋 Listing Anthropic Models\n")

  try {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const providerInfo = await Provider.getProvider("anthropic")
        
        console.log(`Provider: ${providerInfo.id}`)
        console.log(`Models available:\n`)
        
        const models = Object.entries(providerInfo.info.models)
        const haikuModels = models.filter(([id]) => id.toLowerCase().includes("haiku"))
        
        console.log("Haiku models:")
        for (const [id, info] of haikuModels) {
          console.log(`  ${id}`)
          console.log(`    Name: ${info.name}`)
          console.log(`    Family: ${info.family}`)
          console.log(`    Release: ${info.release_date}`)
          console.log()
        }
        
        console.log("\nAll Anthropic models:")
        for (const [id] of models) {
          console.log(`  - ${id}`)
        }
      },
    })
  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
}

listAnthropicModels()
