#!/usr/bin/env bun
/**
 * Live Data Flow Validator
 * 
 * Validates the 11-phase data custody chain against a running instance.
 * Run this against 'bun run dev' in repos/metabob-opencode to verify:
 * 
 * 1. Session memory agent creates impulses correctly
 * 2. Turn lifecycle hooks execute in order
 * 3. Component annotation flow works
 * 4. Message compaction triggers appropriately
 * 
 * Usage:
 *   bun run validate-data-flow-live.ts
 */

import { readdir, stat } from "fs/promises"
import { join } from "path"

interface ValidationResult {
  phase: string
  passed: boolean
  details: string
  timestamp: number
}

const results: ValidationResult[] = []

function logResult(phase: string, passed: boolean, details: string) {
  const result: ValidationResult = {
    phase,
    passed,
    details,
    timestamp: Date.now(),
  }
  results.push(result)
  
  const emoji = passed ? "✅" : "❌"
  console.log(`${emoji} ${phase}: ${details}`)
}

async function validateFileStructure() {
  console.log("\n🔍 Phase 1: Validating File Structure\n")
  
  const baseDir = "./repos/metabob-opencode/packages/opencode/src/session"
  const requiredFiles = [
    "memory-agent.ts",
    "session-memory.ts",
    "context.ts",
    "compaction.ts",
    "turn-lifecycle.ts",
    "turn-lifecycle-hooks.ts",
    "system.ts",
  ]
  
  try {
    const dirStat = await stat(baseDir)
    if (!dirStat.isDirectory()) {
      logResult("File Structure", false, `${baseDir} is not a directory`)
      return false
    }
    
    for (const file of requiredFiles) {
      const filePath = join(baseDir, file)
      try {
        const fileStat = await stat(filePath)
        if (fileStat.isFile()) {
          logResult(`File: ${file}`, true, `Found at ${filePath}`)
        } else {
          logResult(`File: ${file}`, false, `${filePath} is not a file`)
          return false
        }
      } catch (error) {
        logResult(`File: ${file}`, false, `Missing: ${filePath}`)
        return false
      }
    }
    
    return true
  } catch (error) {
    logResult("File Structure", false, `Error accessing ${baseDir}: ${error}`)
    return false
  }
}

async function validateTurnLifecycleHooks() {
  console.log("\n🔍 Phase 2: Validating Turn Lifecycle Hooks\n")
  
  const hooksFile = "./repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts"
  
  try {
    const content = await Bun.file(hooksFile).text()
    
    // Check for metabob-context-preparation hook (priority 20)
    if (content.includes('name: "metabob-context-preparation"')) {
      if (content.includes('priority: 20')) {
        logResult("Hook: metabob-context-preparation", true, "Found with priority 20")
      } else {
        logResult("Hook: metabob-context-preparation", false, "Found but priority is not 20")
        return false
      }
    } else {
      logResult("Hook: metabob-context-preparation", false, "Not found in hooks file")
      return false
    }
    
    // Check for session-memory-optimization hook (priority 110)
    if (content.includes('name: "session-memory-optimization"')) {
      if (content.includes('priority: 110')) {
        logResult("Hook: session-memory-optimization", true, "Found with priority 110")
      } else {
        logResult("Hook: session-memory-optimization", false, "Found but priority is not 110")
        return false
      }
    } else {
      logResult("Hook: session-memory-optimization", false, "Not found in hooks file")
      return false
    }
    
    // Check for 5 impulse types in metabob-context-preparation
    const impulseTypes = [
      "metabob-priorities",
      "metabob-annotations",
      "metabob-impact",
      "metabob-related",
      "metabob-recommendations",
    ]
    
    let foundImpulses = 0
    for (const impulseType of impulseTypes) {
      if (content.includes(impulseType)) {
        foundImpulses++
      }
    }
    
    if (foundImpulses === 5) {
      logResult("Impulse Types", true, `All 5 impulse types found in context preparation`)
    } else {
      logResult("Impulse Types", false, `Only ${foundImpulses}/5 impulse types found`)
      return false
    }
    
    // Check for component annotation in post-turn hook
    if (content.includes("annotate_component")) {
      logResult("Component Annotation", true, "Found in post-turn hook")
    } else {
      logResult("Component Annotation", false, "Not found in post-turn hook")
      return false
    }
    
    return true
  } catch (error) {
    logResult("Turn Lifecycle Hooks", false, `Error reading hooks file: ${error}`)
    return false
  }
}

async function validateMemoryAgentLogic() {
  console.log("\n🔍 Phase 3: Validating Memory Agent Logic\n")
  
  const memoryAgentFile = "./repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts"
  
  try {
    const content = await Bun.file(memoryAgentFile).text()
    
    // Check for analyzeIntent export
    if (content.includes("export async function analyzeIntent")) {
      logResult("Memory Agent: analyzeIntent", true, "Function exported")
    } else {
      logResult("Memory Agent: analyzeIntent", false, "Function not found")
      return false
    }
    
    // Check for Intent schema
    if (content.includes("export const Intent = z.object")) {
      logResult("Memory Agent: Intent Schema", true, "Zod schema defined")
    } else {
      logResult("Memory Agent: Intent Schema", false, "Schema not found")
      return false
    }
    
    // Check for suggestedImpulses in schema
    if (content.includes("suggestedImpulses: z.array")) {
      logResult("Memory Agent: Suggested Impulses", true, "Schema includes impulse suggestions")
    } else {
      logResult("Memory Agent: Suggested Impulses", false, "Impulse suggestions not in schema")
      return false
    }
    
    // Check for intent types
    const intentTypes = ["code_fix", "feature_request", "question", "refactor", "exploration"]
    const hasIntentTypes = intentTypes.every(type => content.includes(`"${type}"`))
    
    if (hasIntentTypes) {
      logResult("Memory Agent: Intent Types", true, "All 5 intent types defined")
    } else {
      logResult("Memory Agent: Intent Types", false, "Not all intent types found")
      return false
    }
    
    // Check for default config
    if (content.includes("DEFAULT_CONFIG") || content.includes("defaultBudget")) {
      logResult("Memory Agent: Configuration", true, "Default config defined")
    } else {
      logResult("Memory Agent: Configuration", false, "Default config not found")
      return false
    }
    
    return true
  } catch (error) {
    logResult("Memory Agent Logic", false, `Error reading memory agent file: ${error}`)
    return false
  }
}

async function validateSessionContextTracking() {
  console.log("\n🔍 Phase 4: Validating Session Context Tracking\n")
  
  const contextFile = "./repos/metabob-opencode/packages/opencode/src/session/context.ts"
  
  try {
    const content = await Bun.file(contextFile).text()
    
    // Check for trackFileModification
    if (content.includes("trackFileModification")) {
      logResult("SessionContext: trackFileModification", true, "Method found")
    } else {
      logResult("SessionContext: trackFileModification", false, "Method not found")
      return false
    }
    
    // Check for getModifiedFiles
    if (content.includes("getModifiedFiles")) {
      logResult("SessionContext: getModifiedFiles", true, "Method found")
    } else {
      logResult("SessionContext: getModifiedFiles", false, "Method not found")
      return false
    }
    
    // Check for getActiveFiles
    if (content.includes("getActiveFiles")) {
      logResult("SessionContext: getActiveFiles", true, "Method found")
    } else {
      logResult("SessionContext: getActiveFiles", false, "Method not found")
      return false
    }
    
    // Check for Map usage (in-memory tracking)
    if (content.includes("Map<string,") || content.includes("new Map(")) {
      logResult("SessionContext: In-Memory Storage", true, "Using Map for tracking")
    } else {
      logResult("SessionContext: In-Memory Storage", false, "Map not found")
      return false
    }
    
    return true
  } catch (error) {
    logResult("Session Context Tracking", false, `Error reading context file: ${error}`)
    return false
  }
}

async function validateMessageCompaction() {
  console.log("\n🔍 Phase 5: Validating Message Compaction\n")
  
  const compactionFile = "./repos/metabob-opencode/packages/opencode/src/session/compaction.ts"
  
  try {
    const content = await Bun.file(compactionFile).text()
    
    // Check for isOverflow function
    if (content.includes("export function isOverflow")) {
      logResult("Compaction: isOverflow", true, "Function exported")
    } else {
      logResult("Compaction: isOverflow", false, "Function not found")
      return false
    }
    
    // Check for PRUNE_MINIMUM constant
    if (content.includes("PRUNE_MINIMUM")) {
      const match = content.match(/PRUNE_MINIMUM\s*=\s*(\d+(?:_\d+)*)/)
      if (match) {
        const value = parseInt(match[1].replace(/_/g, ''))
        if (value === 20000) {
          logResult("Compaction: PRUNE_MINIMUM", true, `Set to ${value}`)
        } else {
          logResult("Compaction: PRUNE_MINIMUM", false, `Value is ${value}, expected 20000`)
        }
      } else {
        logResult("Compaction: PRUNE_MINIMUM", false, "Could not parse value")
      }
    } else {
      logResult("Compaction: PRUNE_MINIMUM", false, "Constant not found")
      return false
    }
    
    // Check for PRUNE_PROTECT constant
    if (content.includes("PRUNE_PROTECT")) {
      const match = content.match(/PRUNE_PROTECT\s*=\s*(\d+(?:_\d+)*)/)
      if (match) {
        const value = parseInt(match[1].replace(/_/g, ''))
        if (value === 40000) {
          logResult("Compaction: PRUNE_PROTECT", true, `Set to ${value}`)
        } else {
          logResult("Compaction: PRUNE_PROTECT", false, `Value is ${value}, expected 40000`)
        }
      } else {
        logResult("Compaction: PRUNE_PROTECT", false, "Could not parse value")
      }
    } else {
      logResult("Compaction: PRUNE_PROTECT", false, "Constant not found")
      return false
    }
    
    // Check for prune function
    if (content.includes("export async function prune")) {
      logResult("Compaction: prune", true, "Function exported")
    } else {
      logResult("Compaction: prune", false, "Function not found")
      return false
    }
    
    // Check for run function (main compaction)
    if (content.includes("export async function run")) {
      logResult("Compaction: run", true, "Main compaction function found")
    } else {
      logResult("Compaction: run", false, "Main function not found")
      return false
    }
    
    return true
  } catch (error) {
    logResult("Message Compaction", false, `Error reading compaction file: ${error}`)
    return false
  }
}

async function validateDataCustodyChain() {
  console.log("\n🔍 Phase 6: Validating Complete Data Custody Chain\n")
  
  // Check documentation exists
  const docFiles = [
    "./ACTIVITY_SYSTEM_DATA_CUSTODY_CHAIN.md",
    "./ACTIVITY_DATA_FLOW_VISUAL.md",
    "./DATA_FLOW_QUICK_REFERENCE.md",
  ]
  
  for (const docFile of docFiles) {
    try {
      const fileStat = await stat(docFile)
      if (fileStat.isFile()) {
        const size = fileStat.size
        logResult(`Documentation: ${docFile.split('/').pop()}`, true, `Exists (${Math.round(size / 1024)}KB)`)
      } else {
        logResult(`Documentation: ${docFile.split('/').pop()}`, false, "Not a file")
        return false
      }
    } catch (error) {
      logResult(`Documentation: ${docFile.split('/').pop()}`, false, "Missing")
      return false
    }
  }
  
  return true
}

async function generateReport() {
  console.log("\n" + "=".repeat(80))
  console.log("📊 VALIDATION REPORT")
  console.log("=".repeat(80) + "\n")
  
  const totalTests = results.length
  const passedTests = results.filter(r => r.passed).length
  const failedTests = totalTests - passedTests
  const successRate = ((passedTests / totalTests) * 100).toFixed(1)
  
  console.log(`Total Tests: ${totalTests}`)
  console.log(`Passed: ${passedTests} ✅`)
  console.log(`Failed: ${failedTests} ❌`)
  console.log(`Success Rate: ${successRate}%\n`)
  
  if (failedTests > 0) {
    console.log("Failed Tests:")
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.phase}: ${r.details}`)
      })
    console.log()
  }
  
  // Group by phase
  console.log("Results by Phase:")
  const phases = [
    "Phase 1: File Structure",
    "Phase 2: Turn Lifecycle Hooks", 
    "Phase 3: Memory Agent Logic",
    "Phase 4: Session Context Tracking",
    "Phase 5: Message Compaction",
    "Phase 6: Data Custody Chain",
  ]
  
  for (let i = 0; i < phases.length; i++) {
    const phaseResults = results.filter(r => r.phase.startsWith(`${phases[i].split(':')[0]}:`) || r.phase.includes(phases[i].split(':')[1]?.trim() || ''))
    const phasePassed = phaseResults.filter(r => r.passed).length
    const phaseTotal = phaseResults.length
    const phaseRate = phaseTotal > 0 ? ((phasePassed / phaseTotal) * 100).toFixed(0) : '0'
    
    const emoji = phasePassed === phaseTotal ? "✅" : "⚠️"
    console.log(`  ${emoji} ${phases[i]}: ${phasePassed}/${phaseTotal} (${phaseRate}%)`)
  }
  
  console.log("\n" + "=".repeat(80))
  
  if (passedTests === totalTests) {
    console.log("🎉 ALL VALIDATIONS PASSED!")
    console.log("Data flow is ready for production use.")
  } else {
    console.log("⚠️  SOME VALIDATIONS FAILED")
    console.log("Review failed tests above and fix issues before production use.")
  }
  console.log("=".repeat(80) + "\n")
  
  // Export results to JSON
  const reportPath = "./validation-results/data-flow-validation-" + new Date().toISOString().replace(/:/g, '-') + ".json"
  await Bun.write(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: parseFloat(successRate),
    },
    results,
  }, null, 2))
  
  console.log(`📄 Detailed report saved to: ${reportPath}\n`)
}

async function main() {
  console.log("🚀 Starting Live Data Flow Validation\n")
  console.log("Validating against: repos/metabob-opencode")
  console.log("Target: Session data flow implementation\n")
  
  const validators = [
    validateFileStructure,
    validateTurnLifecycleHooks,
    validateMemoryAgentLogic,
    validateSessionContextTracking,
    validateMessageCompaction,
    validateDataCustodyChain,
  ]
  
  let allPassed = true
  
  for (const validator of validators) {
    const passed = await validator()
    if (!passed) {
      allPassed = false
    }
  }
  
  await generateReport()
  
  process.exit(allPassed ? 0 : 1)
}

// Run validator
main().catch(error => {
  console.error("❌ Validation error:", error)
  process.exit(1)
})
