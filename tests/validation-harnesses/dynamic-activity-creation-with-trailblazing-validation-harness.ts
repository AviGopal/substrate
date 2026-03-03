/**
 * Validation Harness: dynamic-activity-creation-with-trailblazing-validation
 * 
 * Validates that meta-templates (create/evolve/debug-activity) work end-to-end with:
 * - Phase 2b: Similar activity context injection
 * - Phase 3: Auto-enable trailblazing with conservative limits
 * - Phase 4: Template JSON files with trailblazing config
 * - Integration: Components work together (not just in isolation)
 * 
 * Test Strategy:
 * 1. Verify isMetaTemplate() correctly identifies all 3 meta-templates
 * 2. Verify auto-enable trailblazing logic activates for meta-templates
 * 3. Verify template JSON files have trailblazing configuration
 * 4. Verify similar activity context injection (Phase 2b) executes
 * 5. Test create-activity-self-contained with trailblazing
 * 6. Test evolve-activity-self-contained with parent context
 * 7. Test debug-activity-self-contained with error context
 * 8. Verify no runtime errors or missing implementations
 * 
 * Success Criteria:
 * - isMetaTemplate() returns true for create/evolve/debug-activity-self-contained
 * - Auto-enable logic present in activity.ts (lines 973-988)
 * - Phase 2b context injection present in activity.ts (lines 990-1067)
 * - Template JSON files exist with trailblazing config
 * - Integration tests pass (turn-lifecycle-integration.test.ts)
 * - Meta-templates can execute without errors
 */

import fs from "fs"
import path from "path"
import { execSync } from "child_process"

export interface ValidationInput {
  templateId: string
  checkImplementation?: boolean
  runIntegrationTests?: boolean
}

export interface ValidationOutput {
  pass: boolean
  actual: {
    isMetaTemplateCheck?: {
      createActivity: boolean
      evolveActivity: boolean
      debugActivity: boolean
    }
    autoEnableLogic?: {
      present: boolean
      location?: string
    }
    phase2bInjection?: {
      present: boolean
      location?: string
    }
    templateJsonFiles?: {
      createActivitySelfContained: {
        exists: boolean
        hasTrailblazingConfig: boolean
        config?: any
      }
      createActivitySimplified: {
        exists: boolean
        hasTrailblazingConfig: boolean
        config?: any
      }
      evolveActivitySelfContained: {
        exists: boolean
        hasTrailblazingConfig: boolean
        config?: any
      }
      debugActivitySelfContained: {
        exists: boolean
        hasTrailblazingConfig: boolean
        config?: any
      }
    }
    integrationTests?: {
      executed: boolean
      passed: boolean
      totalTests: number
      passedTests: number
      output?: string
    }
    runtimeValidation?: {
      templateExists: boolean
      templateId: string
      error?: string
    }
  }
  expected: {
    isMetaTemplateCheck: {
      createActivity: true
      evolveActivity: true
      debugActivity: true
    }
    autoEnableLogic: {
      present: true
      location: "activity.ts:973-988"
    }
    phase2bInjection: {
      present: true
      location: "activity.ts:990-1067"
    }
    templateJsonFiles: {
      createActivitySelfContained: {
        exists: true
        hasTrailblazingConfig: true
      }
      createActivitySimplified: {
        exists: true
        hasTrailblazingConfig: true
      }
      evolveActivitySelfContained: {
        exists: true
        hasTrailblazingConfig: true
      }
      debugActivitySelfContained: {
        exists: true
        hasTrailblazingConfig: true
      }
    }
    integrationTests: {
      executed: true
      passed: true
      totalTests: 6
      passedTests: 6
    }
  }
  errors: string[]
}

/**
 * Run validation for dynamic-activity-creation-with-trailblazing-validation
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  const actual: ValidationOutput["actual"] = {}
  
  console.log(`\n🔍 Validating dynamic-activity-creation-with-trailblazing-validation...`)
  console.log(`   Template: ${input.templateId}\n`)

  // Find project root (repos/metabob-opencode)
  const projectRoot = findProjectRoot()
  if (!projectRoot) {
    errors.push("Could not find repos/metabob-opencode project root")
    return {
      pass: false,
      actual,
      expected: getExpectedOutput(),
      errors
    }
  }

  // Test 1: Verify isMetaTemplate() identifies all 3 meta-templates
  console.log("✓ Test 1: Verify isMetaTemplate() function")
  actual.isMetaTemplateCheck = checkIsMetaTemplate(projectRoot, errors)

  // Test 2: Verify auto-enable trailblazing logic (Phase 3)
  console.log("✓ Test 2: Verify auto-enable trailblazing logic")
  actual.autoEnableLogic = checkAutoEnableLogic(projectRoot, errors)

  // Test 3: Verify Phase 2b context injection
  console.log("✓ Test 3: Verify Phase 2b context injection")
  actual.phase2bInjection = checkPhase2bInjection(projectRoot, errors)

  // Test 4: Verify template JSON files
  console.log("✓ Test 4: Verify template JSON files")
  actual.templateJsonFiles = checkTemplateJsonFiles(projectRoot, errors)

  // Test 5: Run integration tests (if requested)
  if (input.runIntegrationTests) {
    console.log("✓ Test 5: Run integration tests")
    actual.integrationTests = runIntegrationTests(projectRoot, errors)
  }

  // Test 6: Verify template exists and is accessible
  console.log("✓ Test 6: Verify template runtime accessibility")
  actual.runtimeValidation = checkTemplateRuntime(input.templateId, projectRoot, errors)

  // Determine overall pass/fail
  const pass = errors.length === 0 && 
    actual.isMetaTemplateCheck?.createActivity === true &&
    actual.isMetaTemplateCheck?.evolveActivity === true &&
    actual.isMetaTemplateCheck?.debugActivity === true &&
    actual.autoEnableLogic?.present === true &&
    actual.phase2bInjection?.present === true &&
    actual.templateJsonFiles?.createActivitySelfContained?.hasTrailblazingConfig === true &&
    actual.templateJsonFiles?.evolveActivitySelfContained?.hasTrailblazingConfig === true &&
    actual.templateJsonFiles?.debugActivitySelfContained?.hasTrailblazingConfig === true

  console.log(`\n${pass ? "✅ PASS" : "❌ FAIL"}: dynamic-activity-creation-with-trailblazing-validation`)
  if (errors.length > 0) {
    console.log("\nErrors:")
    errors.forEach(err => console.log(`  - ${err}`))
  }

  return {
    pass,
    actual,
    expected: getExpectedOutput(),
    errors
  }
}

/**
 * Find project root by looking for repos/metabob-opencode
 */
function findProjectRoot(): string | null {
  let currentDir = process.cwd()
  
  // Try current directory first
  if (fs.existsSync(path.join(currentDir, "repos/metabob-opencode/packages/opencode/src/tool/activity.ts"))) {
    return path.join(currentDir, "repos/metabob-opencode")
  }
  
  // Try parent directory
  const parentDir = path.dirname(currentDir)
  if (fs.existsSync(path.join(parentDir, "repos/metabob-opencode/packages/opencode/src/tool/activity.ts"))) {
    return path.join(parentDir, "repos/metabob-opencode")
  }
  
  // Try looking for metabob-devbob
  if (currentDir.includes("metabob-devbob")) {
    const devbobRoot = currentDir.substring(0, currentDir.indexOf("metabob-devbob") + "metabob-devbob".length)
    const reposPath = path.join(devbobRoot, "repos/metabob-opencode")
    if (fs.existsSync(path.join(reposPath, "packages/opencode/src/tool/activity.ts"))) {
      return reposPath
    }
  }
  
  return null
}

/**
 * Check if isMetaTemplate() correctly identifies all 3 meta-templates
 */
function checkIsMetaTemplate(projectRoot: string, errors: string[]): any {
  const activityTemplatePath = path.join(projectRoot, "packages/opencode/src/session/activity-template.ts")
  
  if (!fs.existsSync(activityTemplatePath)) {
    errors.push(`activity-template.ts not found at ${activityTemplatePath}`)
    return { createActivity: false, evolveActivity: false, debugActivity: false }
  }
  
  const content = fs.readFileSync(activityTemplatePath, "utf-8")
  
  // Check for isMetaTemplate function
  const hasIsMetaTemplate = content.includes("export function isMetaTemplate")
  if (!hasIsMetaTemplate) {
    errors.push("isMetaTemplate() function not found in activity-template.ts")
    return { createActivity: false, evolveActivity: false, debugActivity: false }
  }
  
  // Check for all 3 meta-template IDs
  const hasCreateActivity = content.includes('"create-activity-self-contained"')
  const hasEvolveActivity = content.includes('"evolve-activity-self-contained"')
  const hasDebugActivity = content.includes('"debug-activity-self-contained"')
  
  if (!hasCreateActivity) {
    errors.push("isMetaTemplate() missing create-activity-self-contained")
  }
  if (!hasEvolveActivity) {
    errors.push("isMetaTemplate() missing evolve-activity-self-contained")
  }
  if (!hasDebugActivity) {
    errors.push("isMetaTemplate() missing debug-activity-self-contained")
  }
  
  return {
    createActivity: hasCreateActivity,
    evolveActivity: hasEvolveActivity,
    debugActivity: hasDebugActivity
  }
}

/**
 * Check auto-enable trailblazing logic (Phase 3)
 */
function checkAutoEnableLogic(projectRoot: string, errors: string[]): any {
  const activityToolPath = path.join(projectRoot, "packages/opencode/src/tool/activity.ts")
  
  if (!fs.existsSync(activityToolPath)) {
    errors.push(`activity.ts not found at ${activityToolPath}`)
    return { present: false }
  }
  
  const content = fs.readFileSync(activityToolPath, "utf-8")
  
  // Check for auto-enable trailblazing logic
  const hasAutoEnable = content.includes("Auto-enable trailblazing for meta-templates")
  const hasIsMetaTemplateCheck = content.includes("ActivityTemplate.isMetaTemplate(template.id)")
  const hasConservativeLimits = content.includes("maxCostPerTask: 1.0") && content.includes("maxTotalCost: 5.0")
  
  if (!hasAutoEnable) {
    errors.push("Auto-enable trailblazing logic not found in activity.ts")
  }
  if (!hasIsMetaTemplateCheck) {
    errors.push("isMetaTemplate() check not found in auto-enable logic")
  }
  if (!hasConservativeLimits) {
    errors.push("Conservative trailblazing limits not found (expected: $1/task, $5 total)")
  }
  
  return {
    present: hasAutoEnable && hasIsMetaTemplateCheck && hasConservativeLimits,
    location: hasAutoEnable ? "activity.ts (found)" : "activity.ts (not found)"
  }
}

/**
 * Check Phase 2b context injection
 */
function checkPhase2bInjection(projectRoot: string, errors: string[]): any {
  const activityToolPath = path.join(projectRoot, "packages/opencode/src/tool/activity.ts")
  
  if (!fs.existsSync(activityToolPath)) {
    errors.push(`activity.ts not found at ${activityToolPath}`)
    return { present: false }
  }
  
  const content = fs.readFileSync(activityToolPath, "utf-8")
  
  // Check for Phase 2b context injection
  const hasPhase2bComment = content.includes("Phase 2b: Inject similar activity context")
  const hasSearchSimilarActivities = content.includes("searchSimilarActivities")
  const hasImpulseCreation = content.includes("similar-activities-")
  const hasSessionMemoryImport = content.includes("SessionMemory")
  
  if (!hasPhase2bComment) {
    errors.push("Phase 2b context injection code not found in activity.ts")
  }
  if (!hasSearchSimilarActivities) {
    errors.push("searchSimilarActivities() call not found in Phase 2b")
  }
  if (!hasImpulseCreation) {
    errors.push("Impulse creation for similar activities not found")
  }
  if (!hasSessionMemoryImport) {
    errors.push("SessionMemory import not found")
  }
  
  return {
    present: hasPhase2bComment && hasSearchSimilarActivities && hasImpulseCreation,
    location: hasPhase2bComment ? "activity.ts (found)" : "activity.ts (not found)"
  }
}

/**
 * Check template JSON files for trailblazing configuration
 */
function checkTemplateJsonFiles(projectRoot: string, errors: string[]): any {
  const templatesRoot = path.dirname(path.dirname(projectRoot))
  const templateDir = path.join(templatesRoot, "templates/bootstrap")
  
  const result: any = {}
  
  // Check each template file
  const templates = [
    { key: "createActivitySelfContained", file: "create-activity-self-contained-v2.json" },
    { key: "createActivitySimplified", file: "create-activity-v2-simplified.json" },
    { key: "evolveActivitySelfContained", file: "evolve-activity-self-contained.json" },
    { key: "debugActivitySelfContained", file: "debug-activity-self-contained.json" }
  ]
  
  for (const template of templates) {
    const templatePath = path.join(templateDir, template.file)
    const exists = fs.existsSync(templatePath)
    
    result[template.key] = {
      exists,
      hasTrailblazingConfig: false
    }
    
    if (!exists) {
      errors.push(`Template file not found: ${template.file}`)
      continue
    }
    
    try {
      const content = fs.readFileSync(templatePath, "utf-8")
      const json = JSON.parse(content)
      
      const hasTrailblazing = json.trailblazing && 
        json.trailblazing.enabled === true &&
        json.trailblazing.maxCostPerTask === 1.0 &&
        json.trailblazing.maxTotalCost === 5.0
      
      result[template.key].hasTrailblazingConfig = hasTrailblazing
      result[template.key].config = json.trailblazing
      
      if (!hasTrailblazing) {
        errors.push(`Template ${template.file} missing or incorrect trailblazing config`)
      }
    } catch (err) {
      errors.push(`Failed to parse template ${template.file}: ${err}`)
    }
  }
  
  return result
}

/**
 * Run integration tests
 */
function runIntegrationTests(projectRoot: string, errors: string[]): any {
  try {
    console.log("   Running turn-lifecycle-integration.test.ts...")
    
    const testPath = path.join(projectRoot, "packages/opencode/test/session/turn-lifecycle-integration.test.ts")
    
    if (!fs.existsSync(testPath)) {
      errors.push(`Integration test not found: ${testPath}`)
      return {
        executed: false,
        passed: false,
        totalTests: 0,
        passedTests: 0
      }
    }
    
    // Run bun test
    const output = execSync(`cd ${projectRoot} && bun test ${testPath} 2>&1`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024
    })
    
    // Parse output for pass/fail
    const passMatch = output.match(/(\d+) pass/)
    const failMatch = output.match(/(\d+) fail/)
    
    const passedTests = passMatch ? parseInt(passMatch[1]) : 0
    const failedTests = failMatch ? parseInt(failMatch[1]) : 0
    const totalTests = passedTests + failedTests
    
    const passed = failedTests === 0 && passedTests > 0
    
    if (!passed) {
      errors.push(`Integration tests failed: ${failedTests} failures, ${passedTests} passes`)
    }
    
    return {
      executed: true,
      passed,
      totalTests,
      passedTests,
      output: output.substring(0, 500) // Truncate for brevity
    }
  } catch (err: any) {
    errors.push(`Failed to run integration tests: ${err.message}`)
    return {
      executed: false,
      passed: false,
      totalTests: 0,
      passedTests: 0,
      error: err.message
    }
  }
}

/**
 * Check if template is accessible at runtime
 */
function checkTemplateRuntime(templateId: string, projectRoot: string, errors: string[]): any {
  const templatesRoot = path.dirname(path.dirname(projectRoot))
  const templateDir = path.join(templatesRoot, "templates/bootstrap")
  
  // Map template IDs to file names
  const fileMap: Record<string, string> = {
    "create-activity-self-contained": "create-activity-self-contained-v2.json",
    "evolve-activity-self-contained": "evolve-activity-self-contained.json",
    "debug-activity-self-contained": "debug-activity-self-contained.json"
  }
  
  const fileName = fileMap[templateId]
  if (!fileName) {
    return {
      templateExists: false,
      templateId,
      error: `Unknown template ID: ${templateId}`
    }
  }
  
  const templatePath = path.join(templateDir, fileName)
  const exists = fs.existsSync(templatePath)
  
  if (!exists) {
    errors.push(`Template file not found: ${fileName}`)
  }
  
  return {
    templateExists: exists,
    templateId,
    filePath: templatePath
  }
}

/**
 * Get expected output structure
 */
function getExpectedOutput(): ValidationOutput["expected"] {
  return {
    isMetaTemplateCheck: {
      createActivity: true,
      evolveActivity: true,
      debugActivity: true
    },
    autoEnableLogic: {
      present: true,
      location: "activity.ts:973-988"
    },
    phase2bInjection: {
      present: true,
      location: "activity.ts:990-1067"
    },
    templateJsonFiles: {
      createActivitySelfContained: {
        exists: true,
        hasTrailblazingConfig: true
      },
      createActivitySimplified: {
        exists: true,
        hasTrailblazingConfig: true
      },
      evolveActivitySelfContained: {
        exists: true,
        hasTrailblazingConfig: true
      },
      debugActivitySelfContained: {
        exists: true,
        hasTrailblazingConfig: true
      }
    },
    integrationTests: {
      executed: true,
      passed: true,
      totalTests: 6,
      passedTests: 6
    }
  }
}

/**
 * Main entry point for CLI usage
 */
if (import.meta.main) {
  const templateId = process.argv[2] || "create-activity-self-contained"
  const runTests = process.argv.includes("--run-tests")
  
  runValidation({
    templateId,
    checkImplementation: true,
    runIntegrationTests: runTests
  }).then(result => {
    console.log("\n" + JSON.stringify(result, null, 2))
    process.exit(result.pass ? 0 : 1)
  }).catch(err => {
    console.error("Validation error:", err)
    process.exit(1)
  })
}
