#!/usr/bin/env bun
/**
 * Test that cochange-enhanced templates can be loaded after TemplateLoader fix
 */

import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/template-repository"

async function testTemplateLoading() {
  console.log("Testing template loading after fix...\n")
  
  const templateIds = [
    "fix-bug-complete",
    "add-feature-complete", 
    "refactor-component-complete"
  ]
  
  for (const id of templateIds) {
    try {
      console.log(`Loading: ${id}...`)
      const result = await TemplateRepository.get(id, { backend: "local" })
      console.log(`✅ SUCCESS: ${id}`)
      console.log(`   - Source: ${result.source}`)
      console.log(`   - Tasks: ${result.template.tasks.length}`)
      console.log(`   - Has cochange learning: ${result.template.description.includes("cochange") ? "YES" : "NO"}\n`)
    } catch (error) {
      console.error(`❌ FAILED: ${id}`)
      console.error(`   - Error: ${error.message}\n`)
    }
  }
}

testTemplateLoading().catch(console.error)
