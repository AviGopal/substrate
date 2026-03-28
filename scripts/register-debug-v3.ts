#!/usr/bin/env bun
/**
 * Register Debug Template V3 with Metabob backend
 * 
 * Usage:
 *   bun scripts/register-debug-v3.ts
 */

import { readFileSync } from "fs"
import { resolve } from "path"

// Read the V3 template
const templatePath = resolve(
  __dirname,
  "../repos/metabob-opencode/packages/opencode/templates/built-in/debug-activity-self-contained-v3.json"
)

console.log(`📖 Reading template from: ${templatePath}`)

const templateContent = readFileSync(templatePath, "utf-8")
const template = JSON.parse(templateContent)

console.log(`✅ Template loaded:`)
console.log(`   ID: ${template.id}`)
console.log(`   Name: ${template.name}`)
console.log(`   Version: ${template.version}`)
console.log(`   Category: ${template.category}`)
console.log(`   Tasks: ${template.tasks?.length || 0}`)

// Bootstrap opencode and register
async function register() {
  const { Instance } = await import("../repos/metabob-opencode/packages/opencode/src/project/instance")
  const { TemplateLibrary } = await import("../repos/metabob-opencode/packages/opencode/src/session/template-library")
  
  await Instance.provide({
    directory: process.cwd(),
    async fn() {
      console.log("\n🔄 Registering template with Metabob backend...")
      
      const success = await TemplateLibrary.registerWithMetabob(template)
      
      if (success) {
        console.log("✅ Template registered successfully!")
        console.log("\n📝 Next steps:")
        console.log("   1. Find a failed activity: opencode activity list --status failed")
        console.log("   2. Test the template: opencode activity run debug-activity-self-contained")
        process.exit(0)
      } else {
        console.error("❌ Failed to register template")
        process.exit(1)
      }
    }
  })
}

register().catch((error) => {
  console.error("❌ Registration error:", error)
  process.exit(1)
})
