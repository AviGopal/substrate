#!/usr/bin/env bun

import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"

async function test() {
  console.log("Testing TemplateRepository.get() with different backend options")
  console.log("")
  
  const templateId = "fix-bug-complete"
  
  // Test 1: Default (backend="all" - tries metabob first, then local)
  console.log(`Test 1: get("${templateId}") - default backend`)
  try {
    const template = await TemplateRepository.get(templateId)
    if (template) {
      console.log(`✅ Found: ${template.id} - ${template.name}`)
    } else {
      console.log(`❌ Not found`)
    }
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
  }
  console.log("")
  
  // Test 2: Explicit local backend
  console.log(`Test 2: get("${templateId}", "local") - force local storage`)
  try {
    const template = await TemplateRepository.get(templateId, "local")
    if (template) {
      console.log(`✅ Found: ${template.id} - ${template.name}`)
    } else {
      console.log(`❌ Not found`)
    }
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
  }
  console.log("")
  
  // Test 3: Metabob only (should fail for local template)
  console.log(`Test 3: get("${templateId}", "metabob") - metabob only`)
  try {
    const template = await TemplateRepository.get(templateId, "metabob")
    if (template) {
      console.log(`✅ Found: ${template.id} - ${template.name}`)
    } else {
      console.log(`❌ Not found`)
    }
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

test()
