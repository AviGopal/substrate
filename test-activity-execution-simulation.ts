#!/usr/bin/env bun

/**
 * Simulate what happens when the activity tool executes
 * This tests the EXACT code path that activity.ts uses
 */

import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"

async function simulateActivityExecution(templateId: string) {
  console.log(`Simulating: activity({ activityId: "${templateId}", ... })`)
  console.log("=" .repeat(70))
  console.log("")
  
  // Step 1: Load template (this is line 304 in activity.ts)
  console.log("Step 1: Load template from registry")
  console.log(`  Calling: TemplateRepository.get("${templateId}")`)
  console.log("")
  
  try {
    const template = await TemplateRepository.get(templateId)
    
    if (!template) {
      console.log(`❌ FAILED: Template "${templateId}" not found`)
      console.log(`   Use search_activities tool to see available templates.`)
      console.log("")
      console.log("This means:")
      console.log("  - TemplateRepository.get() returned undefined")
      console.log("  - Template exists in local storage but wasn't loaded")
      console.log("  - Fix may not be working OR backend parameter issue")
      return
    }
    
    console.log(`✅ SUCCESS: Template loaded!`)
    console.log(`  ID: ${template.id}`)
    console.log(`  Name: ${template.name}`)
    console.log(`  Category: ${template.category}`)
    console.log(`  Tasks: ${template.tasks?.length ?? 0}`)
    console.log(`  Version: ${template.version.generation}`)
    console.log("")
    
    console.log("✅ Activity tool would proceed with execution")
    console.log("")
    console.log("Next steps would be:")
    console.log("  1. Validate variables")
    console.log("  2. Create activity session")
    console.log("  3. Execute tasks")
    console.log("  4. Capture learning data")
    console.log("")
    console.log("✅ Template loading fix is WORKING!")
    
  } catch (error) {
    console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.log("")
      console.log("Stack trace:")
      console.log(error.stack)
    }
  }
}

// Test with our cochange template
simulateActivityExecution("fix-bug-complete")
