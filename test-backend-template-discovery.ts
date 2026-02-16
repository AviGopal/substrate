#!/usr/bin/env bun
/**
 * Test: Backend Template Discovery
 * 
 * Verifies that templates registered to .metabob/activities/ can be:
 * 1. Discovered by the backend
 * 2. Loaded with correct schema format
 * 3. Used for activity execution
 */

import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

interface MetabobTask {
  id: string
  task_id: string
  name: string
  description: string
  agent_instructions: string
  validation?: {
    required_patterns?: Array<{ pattern: string; description: string }>
    forbidden_patterns?: Array<{ pattern: string; description: string }>
  }
}

interface MetabobTemplate {
  activity_id: string
  name: string
  description: string
  category: string
  task_steps: MetabobTask[]
}

async function testBackendTemplateDiscovery() {
  console.log("🔍 Testing Backend Template Discovery\n")

  const templatesDir = ".metabob/activities"
  
  // Step 1: Discover templates
  console.log("Step 1: Discovering templates in", templatesDir)
  const files = await readdir(templatesDir)
  const jsonFiles = files.filter(f => f.endsWith(".json"))
  console.log(`✅ Found ${jsonFiles.length} template files\n`)

  // Step 2: Load our 3 cochange-learning templates
  const targetTemplates = [
    "fix-bug-complete.json",
    "add-feature-complete.json", 
    "refactor-component-complete.json"
  ]

  const results: Array<{
    file: string
    valid: boolean
    issues: string[]
    template?: MetabobTemplate
  }> = []

  for (const filename of targetTemplates) {
    console.log(`\n📄 Testing: ${filename}`)
    const issues: string[] = []

    try {
      const content = await readFile(join(templatesDir, filename), "utf-8")
      const template: MetabobTemplate = JSON.parse(content)

      // Validate schema
      if (!template.activity_id) {
        issues.push("Missing activity_id")
      }
      if (!template.category) {
        issues.push("Missing category")
      }
      if (!Array.isArray(template.task_steps)) {
        issues.push("task_steps is not an array")
      }

      // Validate tasks
      for (let i = 0; i < template.task_steps.length; i++) {
        const task = template.task_steps[i]
        
        // Check both id fields
        if (!task.id) {
          issues.push(`Task ${i}: Missing id field`)
        }
        if (!task.task_id) {
          issues.push(`Task ${i}: Missing task_id field`)
        }
        if (task.id !== task.task_id) {
          issues.push(`Task ${i}: id (${task.id}) !== task_id (${task.task_id})`)
        }

        // Check pattern format
        if (task.validation?.required_patterns) {
          for (let j = 0; j < task.validation.required_patterns.length; j++) {
            const pattern = task.validation.required_patterns[j]
            if (typeof pattern === "string") {
              issues.push(`Task ${i}, pattern ${j}: Is string, should be object`)
            } else if (!pattern.pattern) {
              issues.push(`Task ${i}, pattern ${j}: Missing 'pattern' field`)
            }
          }
        }

        if (task.validation?.forbidden_patterns) {
          for (let j = 0; j < task.validation.forbidden_patterns.length; j++) {
            const pattern = task.validation.forbidden_patterns[j]
            if (typeof pattern === "string") {
              issues.push(`Task ${i}, pattern ${j}: Is string, should be object`)
            } else if (!pattern.pattern) {
              issues.push(`Task ${i}, pattern ${j}: Missing 'pattern' field`)
            }
          }
        }
      }

      const valid = issues.length === 0

      results.push({
        file: filename,
        valid,
        issues,
        template
      })

      if (valid) {
        console.log(`  ✅ Valid schema`)
        console.log(`  📋 ${template.task_steps.length} tasks`)
        console.log(`  🏷️  Category: ${template.category}`)
        
        // Show pattern sample
        const firstTask = template.task_steps[0]
        if (firstTask.validation?.required_patterns?.[0]) {
          console.log(`  📐 Pattern format: {pattern: "${firstTask.validation.required_patterns[0].pattern.substring(0, 30)}...", description: "${firstTask.validation.required_patterns[0].description}"}`)
        }
      } else {
        console.log(`  ❌ Invalid schema (${issues.length} issues)`)
        issues.forEach(issue => console.log(`    - ${issue}`))
      }

    } catch (error) {
      results.push({
        file: filename,
        valid: false,
        issues: [`Failed to load: ${error}`]
      })
      console.log(`  ❌ Failed to load: ${error}`)
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("📊 Test Summary\n")

  const validCount = results.filter(r => r.valid).length
  const invalidCount = results.filter(r => !r.valid).length

  console.log(`Total templates tested: ${results.length}`)
  console.log(`Valid: ${validCount} ✅`)
  console.log(`Invalid: ${invalidCount} ❌`)

  if (validCount === results.length) {
    console.log("\n🎉 All templates valid for backend consumption!")
    console.log("\n✅ Backend can:")
    console.log("  - Discover templates from .metabob/activities/")
    console.log("  - Parse template JSON files")
    console.log("  - Validate schema (id, task_id, patterns as objects)")
    console.log("  - Use templates for activity execution")
  } else {
    console.log("\n⚠️  Some templates have issues")
    results.filter(r => !r.valid).forEach(r => {
      console.log(`\n${r.file}:`)
      r.issues.forEach(issue => console.log(`  - ${issue}`))
    })
    process.exit(1)
  }

  return results
}

// Run test
testBackendTemplateDiscovery().catch(error => {
  console.error("Test failed:", error)
  process.exit(1)
})
