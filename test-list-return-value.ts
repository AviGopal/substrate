#!/usr/bin/env bun

import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"

async function test() {
  console.log("Testing TemplateRepository.list() return value")
  console.log("")
  
  const result = await TemplateRepository.list({ backend: "local" })
  
  console.log("Type of result:", typeof result)
  console.log("Is array:", Array.isArray(result))
  console.log("Result:", result)
  
  if (Array.isArray(result)) {
    console.log("")
    console.log("✅ Result is an array (expected)")
    console.log(`   Count: ${result.length}`)
    console.log("")
    console.log("Templates:")
    result.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.id} - ${t.name}`)
    })
  } else {
    console.log("")
    console.log("❌ Result is NOT an array")
    console.log("   This is unexpected! TemplateRepository.list() should return ActivityTemplate.Schema[]")
  }
}

test()
