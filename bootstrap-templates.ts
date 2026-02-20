#!/usr/bin/env bun

/**
 * Re-bootstrap templates from metabob-proto
 * 
 * This saves all bootstrap templates to local storage with correct IDs
 */

async function bootstrap() {
  console.log("\n=== Bootstrapping Templates from metabob-proto ===\n")

  // Import BootstrapTemplates
  const { BootstrapTemplates } = await import(
    "./repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates"
  )

  console.log("Loading bootstrap templates from metabob-proto...")
  const templates = await BootstrapTemplates.loadAll()
  console.log(`✅ Loaded ${templates.length} templates`)

  for (const template of templates) {
    console.log(`  - ${template.id}: ${template.name} (${template.tasks.length} tasks)`)
  }

  console.log("\nRegistering templates (saving to local storage + MCP)...")
  const results = await BootstrapTemplates.registerAll()

  console.log("\n=== Registration Results ===")
  console.log(`✅ Registered with MCP: ${results.registered.length}`)
  if (results.registered.length > 0) {
    results.registered.forEach((id) => console.log(`   - ${id}`))
  }

  console.log(`⏭️  Skipped (already exists or using local fallback): ${results.skipped.length}`)
  if (results.skipped.length > 0) {
    results.skipped.forEach((id) => console.log(`   - ${id}`))
  }

  console.log(`❌ Failed: ${results.failed.length}`)
  if (results.failed.length > 0) {
    results.failed.forEach((f) => console.log(`   - ${f.id}: ${f.error}`))
  }

  console.log("\n=== Verifying Local Storage ===")
  const { ActivityTemplate } = await import(
    "./repos/metabob-opencode/packages/opencode/src/session/activity-template"
  )

  for (const id of BootstrapTemplates.getIds()) {
    try {
      const template = await ActivityTemplate.load(id)
      console.log(`✅ ${id}: ID=${template.id}, version=${template.version}`)
    } catch (error) {
      console.error(`❌ ${id}: Failed to load - ${error.message}`)
    }
  }

  console.log("\n✅ Bootstrap complete!")
}

bootstrap().catch(console.error)
