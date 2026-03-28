/**
 * Verify Tool Availability for Bootstrap Templates
 * 
 * Checks that all tools referenced in bootstrap templates actually exist
 * and are accessible to the agents that use them.
 */

import * as fs from 'fs/promises'
import * as path from 'path'

console.log("=" .repeat(80))
console.log("TOOL AVAILABILITY VERIFICATION")
console.log("=" .repeat(80))
console.log()

// Step 1: Scan tools directory
const toolsDir = 'repos/metabob-opencode/packages/opencode/src/tool'
const toolFiles = await fs.readdir(toolsDir)
const availableTools = new Set<string>()

for (const file of toolFiles) {
  if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
    const toolName = file.replace('.ts', '').replace(/-/g, '_')
    availableTools.add(toolName)
  }
}

console.log(`📦 Found ${availableTools.size} tool implementations`)
console.log()

// Step 2: Extract tool references from all templates
const bootstrapDir = 'repos/metabob-proto/activities/bootstrap'
const jsonFiles = (await fs.readdir(bootstrapDir)).filter(f => f.endsWith('.json'))

const toolsByTemplate = new Map<string, Set<string>>()
const allReferencedTools = new Set<string>()

for (const file of jsonFiles) {
  const filePath = path.join(bootstrapDir, file)
  const content = await fs.readFile(filePath, 'utf-8')
  const template = JSON.parse(content)
  
  const toolRefs = new Set<string>()
  
  if (template.tasks) {
    for (const task of template.tasks) {
      if (task.prompt?.template) {
        const promptTemplate = task.prompt.template
        const matches = promptTemplate.matchAll(/`([a-z_]+)`/g)
        for (const match of matches) {
          const toolName = match[1]
          if (toolName.includes('_') && (
            toolName.startsWith('impulse_') ||
            toolName.startsWith('memory_') ||
            toolName.startsWith('metabob_') ||
            toolName.startsWith('activity_') ||
            toolName.startsWith('negotiate_')
          )) {
            toolRefs.add(toolName)
            allReferencedTools.add(toolName)
          }
        }
      }
    }
  }
  
  if (toolRefs.size > 0) {
    toolsByTemplate.set(file, toolRefs)
  }
}

console.log(`🔍 Found ${allReferencedTools.size} unique tool references across all templates`)
console.log()

// Step 3: Check availability
console.log("Tool Availability Check:")
console.log("-".repeat(80))

let allExist = true
for (const tool of Array.from(allReferencedTools).sort()) {
  const exists = availableTools.has(tool)
  const status = exists ? '✅' : '❌'
  console.log(`${status} ${tool}`)
  if (!exists) {
    allExist = false
  }
}

console.log()

// Step 4: Per-template breakdown
if (!allExist) {
  console.log("Missing Tools by Template:")
  console.log("-".repeat(80))
  
  for (const [templateName, tools] of toolsByTemplate) {
    const missingTools = Array.from(tools).filter(t => !availableTools.has(t))
    if (missingTools.length > 0) {
      console.log(`\n❌ ${templateName}`)
      for (const tool of missingTools) {
        console.log(`   Missing: ${tool}`)
      }
    }
  }
  console.log()
}

// Step 5: Summary
console.log("=" .repeat(80))
if (allExist) {
  console.log("✅ SUCCESS: All referenced tools exist!")
} else {
  console.log("❌ FAILURE: Some tools are missing")
  console.log("\nAction required: Implement missing tools or update templates")
}
console.log("=" .repeat(80))

process.exit(allExist ? 0 : 1)
