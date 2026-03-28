/**
 * Test 1.3: Verify Template Tools After Fix
 * 
 * This script validates that all tools referenced in the fixed template
 * actually exist and are available to the memory agent.
 */

import * as fs from 'fs/promises'

console.log("=" .repeat(70))
console.log("TEST 1.3: Verify Template Tools (After Fix)")
console.log("=" .repeat(70))

// Step 1: Load and parse template
console.log("\n📋 Step 1: Load Template")
const templatePath = 'repos/metabob-proto/activities/bootstrap/manage-session-memory.json'
const templateContent = await fs.readFile(templatePath, 'utf-8')
const template = JSON.parse(templateContent)

console.log(`  ✅ Template loaded: ${template.name}`)
console.log(`     Tasks: ${template.tasks.length}`)
console.log(`     Category: ${template.category}`)

// Step 2: Extract tool references from prompts
console.log("\n📋 Step 2: Extract Tool References")

const toolPattern = /`([a-z_]+)`/g
const toolReferences = new Set<string>()

for (const task of template.tasks) {
  const prompt = task.prompt.template
  const matches = prompt.matchAll(toolPattern)
  
  for (const match of matches) {
    const toolName = match[1]
    // Filter for memory/impulse tools
    if (toolName.startsWith('memory_') || toolName.startsWith('impulse_')) {
      toolReferences.add(toolName)
    }
  }
}

console.log(`  ✅ Found ${toolReferences.size} tool references:`)
for (const tool of Array.from(toolReferences).sort()) {
  console.log(`     - ${tool}`)
}

// Step 3: Check which tools exist
console.log("\n📋 Step 3: Check Tool Existence")

const toolsDir = 'repos/metabob-opencode/packages/opencode/src/tool'
const files = await fs.readdir(toolsDir)

const existingTools = new Set<string>()
for (const file of files) {
  if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
    const toolName = file.replace('.ts', '').replace(/-/g, '_')
    existingTools.add(toolName)
  }
}

console.log(`  📦 Found ${existingTools.size} tool implementations`)

// Step 4: Verify all referenced tools exist
console.log("\n📋 Step 4: Verify Tool Availability")

let allExist = true
for (const tool of toolReferences) {
  const exists = existingTools.has(tool)
  const status = exists ? '✅' : '❌'
  console.log(`  ${status} ${tool}: ${exists ? 'EXISTS' : 'MISSING'}`)
  if (!exists) {
    allExist = false
  }
}

// Step 5: Check memory agent has these tools
console.log("\n📋 Step 5: Check Memory Agent Configuration")

// Read agent.ts to verify memory agent tools
const agentFile = await fs.readFile(
  'repos/metabob-opencode/packages/opencode/src/agent/agent.ts',
  'utf-8'
)

// Find memory agent tools section
const memoryAgentMatch = agentFile.match(/memory:\s*\{[\s\S]*?tools:\s*\{([\s\S]*?)\}/m)

if (memoryAgentMatch) {
  const toolsSection = memoryAgentMatch[1]
  
  console.log("  Memory agent tools configuration found")
  
  for (const tool of toolReferences) {
    const hasAccess = toolsSection.includes(`${tool}:`) || toolsSection.includes(`"${tool}"`)
    const status = hasAccess ? '✅' : '⚠️'
    console.log(`  ${status} ${tool}: ${hasAccess ? 'ACCESSIBLE' : 'NOT IN CONFIG'}`)
  }
} else {
  console.log("  ⚠️  Could not parse memory agent configuration")
}

// Summary
console.log("\n" + "=".repeat(70))
if (allExist) {
  console.log("✅ TEST PASS: All referenced tools exist!")
  console.log("\nTemplate is ready for execution.")
} else {
  console.log("❌ TEST FAIL: Some tools are still missing")
  console.log("\nTemplate needs further fixes.")
  process.exit(1)
}
console.log("=".repeat(70))
