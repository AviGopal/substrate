#!/usr/bin/env bun

// Direct test of TemplateRepository.get() to see if it can load our template
import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"

async function test() {
  console.log("Testing TemplateRepository.get() for fix-bug-complete...")
  console.log("Backend: local (should bypass Metabob and load from storage)")
  console.log("")
  
  try {
    const template = await TemplateRepository.get("fix-bug-complete", "local")
    
    if (template) {
      console.log("✅ SUCCESS: Template loaded from local storage!")
      console.log(`   ID: ${template.id}`)
      console.log(`   Name: ${template.name}`)
      console.log(`   Version: ${template.version.generation}`)
      console.log(`   Tasks: ${template.tasks.length}`)
      console.log("")
      console.log("✅ Template loading fix is working!")
    } else {
      console.log("❌ FAILED: Template returned undefined")
      console.log("   This means template-loader is still blocking local storage access")
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.log(error.stack)
    }
  }
}

test()
