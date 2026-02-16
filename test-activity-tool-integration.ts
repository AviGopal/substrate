#!/usr/bin/env bun

// Test if the activity tool can actually find our cochange templates
import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"

async function testActivityToolFlow() {
  console.log("Testing Activity Tool Flow (as used in actual execution)")
  console.log("=" .repeat(70))
  console.log("")
  
  // Test 1: Get specific template (this worked in direct test)
  console.log("Test 1: Get specific template by ID")
  try {
    const template = await TemplateRepository.get("fix-bug-complete")
    console.log(`✅ SUCCESS: TemplateRepository.get("fix-bug-complete")`)
    console.log(`   ID: ${template.id}`)
    console.log(`   Name: ${template.name}`)
    console.log("")
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`)
    console.log("")
  }
  
  // Test 2: List all templates (this is what activity discovery uses)
  console.log("Test 2: List all templates")
  try {
    const result = await TemplateRepository.list()
    console.log(`✅ SUCCESS: TemplateRepository.list()`)
    console.log(`   Count: ${result.templates.length}`)
    console.log(`   Source: ${result.source}`)
    console.log("")
    
    if (result.templates.length > 0) {
      console.log("   Templates found:")
      result.templates.forEach(t => {
        console.log(`     - ${t.id} (${t.name})`)
      })
    } else {
      console.log("   ⚠️  No templates found!")
    }
    console.log("")
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`)
    console.log("")
  }
  
  // Test 3: List with backend=local (force local storage)
  console.log("Test 3: List templates with backend=local")
  try {
    const result = await TemplateRepository.list({ backend: "local" })
    console.log(`✅ SUCCESS: TemplateRepository.list({ backend: "local" })`)
    console.log(`   Count: ${result.templates.length}`)
    console.log(`   Source: ${result.source}`)
    console.log("")
    
    if (result.templates.length > 0) {
      console.log("   Templates found:")
      result.templates.forEach(t => {
        console.log(`     - ${t.id} (${t.name})`)
      })
      
      // Check if our cochange templates are there
      const cochangeTemplates = result.templates.filter(t => 
        t.id === "fix-bug-complete" || 
        t.id === "add-feature-complete" || 
        t.id === "refactor-component-complete"
      )
      console.log("")
      console.log(`   Cochange templates found: ${cochangeTemplates.length}/3`)
      cochangeTemplates.forEach(t => {
        console.log(`     ✓ ${t.id}`)
      })
    } else {
      console.log("   ⚠️  No templates found in local storage!")
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`)
  }
}

testActivityToolFlow().then(() => process.exit(0))
