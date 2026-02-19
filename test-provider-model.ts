#!/usr/bin/env bun
/**
 * Test if Provider.getModel can load the memory agent model
 */

import { Provider } from "./repos/metabob-opencode/packages/opencode/src/provider/provider"
import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"

async function testProviderModel() {
  console.log("🧪 Testing Provider.getModel\n")

  try {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const providerID = "anthropic"
        const modelID = "claude-3-5-haiku-20241022"

        console.log(`📝 Requesting model: ${providerID}/${modelID}`)
        console.log("⏳ Calling Provider.getModel()...\n")

        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout after 10s")), 10000)
        )

        const modelPromise = Provider.getModel(providerID, modelID)

        const model = await Promise.race([modelPromise, timeout])

        console.log("✅ Model loaded successfully!")
        console.log(`   Model info: ${JSON.stringify(model.info, null, 2)}`)
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

testProviderModel()
