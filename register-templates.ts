#!/usr/bin/env bun
/**
 * Script to re-register cochange-enhanced activity templates
 * 
 * This re-registers the templates with updated variable schemas:
 * - fix-bug-complete.json
 * - add-feature-complete.json  
 * - refactor-component-complete.json
 */

import { ActivityTemplate } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template"
import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"

const TEMPLATES = [
  { path: "fix-bug-complete.json", name: "fix-bug-complete" },
  { path: "add-feature-complete.json", name: "add-feature-complete" },
  { path: "refactor-component-complete.json", name: "refactor-component-complete" },
]

async function registerTemplate(filePath: string, name: string) {
  console.log(`\n📝 Registering: ${name}`)
  console.log(`   Path: ${filePath}`)
  
  try {
    // Load JSON file
    const content = await Bun.file(filePath).text()
    const json = JSON.parse(content)
    
    // Parse with CreateOptions schema (doesn't require ID)
    const options = ActivityTemplate.CreateOptions.parse(json)
    
    console.log(`   ✓ Parsed template (${options.tasks.length} tasks)`)
    
    // Create template (generates ID from name)
    const template = await ActivityTemplate.create(options)
    
    console.log(`   ✓ Created template with ID: ${template.id}`)
    
    // Save to both local and Metabob backend
    await TemplateRepository.save(template, ["local", "metabob"])
    
    console.log(`   ✓ Saved to local and Metabob backend`)
    console.log(`   ✅ Success! Template ID: ${template.id}`)
    
    return template.id
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

async function main() {
  console.log("🚀 Re-registering Cochange Learning Templates\n")
  console.log("=" .repeat(60))
  
  const results: Record<string, string> = {}
  
  for (const { path, name } of TEMPLATES) {
    try {
      const templateId = await registerTemplate(path, name)
      results[name] = templateId
    } catch (error) {
      console.error(`\nFailed to register ${name}, continuing...`)
    }
  }
  
  console.log("\n" + "=".repeat(60))
  console.log("\n📊 Registration Summary:\n")
  
  for (const [name, id] of Object.entries(results)) {
    console.log(`  ${name}: ${id}`)
  }
  
  console.log("\n✅ All templates registered successfully!")
  console.log("\nYou can now use these templates with:")
  console.log(`  activity({ activityId: "<id>", variables: {...}, reason: "..." })`)
}

main().catch((error) => {
  console.error("\n❌ Registration failed:", error)
  process.exit(1)
})
