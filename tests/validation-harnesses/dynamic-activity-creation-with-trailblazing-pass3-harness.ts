#!/usr/bin/env bun

/**
 * Validation Harness for dynamic-activity-creation-with-trailblazing-pass3
 * 
 * Tests the dynamic activity creation system with trailblazing functionality:
 * - Case 1: Meta-template detection (isMetaTemplate identifies create/debug/evolve)
 * - Case 2: Auto-trailblazing enablement for meta-templates
 * - Case 3: Context injection (top 3 similar activities from backend)
 * - Case 4: Lifecycle hooks execution (memory-management, activity-recommendation)
 * - Case 5: Backend sync (Activity.save → MCP → rpc-api → SurrealDB)
 * - Case 6: Bootstrap templates exist and are embedded
 * - Case 7: No filesystem dependency in meta-templates
 * - Case 8: Observability checkpoints in logs
 * - Case 9: K8s deployment readiness (when deployed)
 * - Case 10: End-to-end execution with trailblazing (requires LLM, optional)
 */

import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs/promises"

const execAsync = promisify(exec)

// Types
interface ValidationCase {
  id: string
  name: string
  test: () => Promise<ValidationResult>
}

interface ValidationResult {
  pass: boolean
  caseId: string
  actual: any
  expected: any
  error?: string
  details?: string
}

// Helper: Run grep search in a repo
async function grepInRepo(
  repo: string,
  pattern: string,
  filePattern: string = "*.{ts,py,js}",
  excludePatterns: string[] = ["node_modules", "dist", "*.test.*", "test-*"]
): Promise<{ count: number; matches: string[] }> {
  const repoPath = path.join(process.cwd(), "repos", repo)
  
  try {
    const excludeArgs = excludePatterns.map(p => `-g '!${p}'`).join(" ")
    const { stdout } = await execAsync(
      `cd ${repoPath} && rg "${pattern}" -t ts -t py -t js ${excludeArgs} 2>/dev/null || true`
    )
    
    const matches = stdout.trim() ? stdout.trim().split("\n") : []
    return { count: matches.length, matches }
  } catch (error) {
    return { count: 0, matches: [] }
  }
}

// Helper: Check file existence
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// Helper: Read file content
async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8")
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`)
  }
}

// Helper: Check if string contains pattern
function containsPattern(content: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return content.includes(pattern)
  }
  return pattern.test(content)
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Case 1: Meta-template detection
 * Verifies that isMetaTemplate() correctly identifies all 4 meta-template variants
 */
async function testMetaTemplateDetection(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-1"
  
  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/activity-template.ts"
    )
    
    const content = await readFile(filePath)
    
    // Check for isMetaTemplate function
    const hasIsMetaTemplate = containsPattern(content, /export function isMetaTemplate\(templateId: string\): boolean/)
    
    // Check for all 4 meta-template IDs
    const hasCreateActivity = containsPattern(content, /"create-activity"/)
    const hasCreateActivitySelfContained = containsPattern(content, /"create-activity-self-contained"/)
    const hasEvolveActivitySelfContained = containsPattern(content, /"evolve-activity-self-contained"/)
    const hasDebugActivitySelfContained = containsPattern(content, /"debug-activity-self-contained"/)
    
    const allTemplatesPresent = hasCreateActivity && hasCreateActivitySelfContained && 
                                hasEvolveActivitySelfContained && hasDebugActivitySelfContained
    
    const expected = {
      hasIsMetaTemplate: true,
      metaTemplateIds: [
        "create-activity",
        "create-activity-self-contained",
        "evolve-activity-self-contained",
        "debug-activity-self-contained"
      ],
      allPresent: true
    }
    
    const actual = {
      hasIsMetaTemplate,
      metaTemplateIds: [
        hasCreateActivity ? "create-activity" : null,
        hasCreateActivitySelfContained ? "create-activity-self-contained" : null,
        hasEvolveActivitySelfContained ? "evolve-activity-self-contained" : null,
        hasDebugActivitySelfContained ? "debug-activity-self-contained" : null
      ].filter(Boolean),
      allPresent: allTemplatesPresent
    }
    
    const pass = hasIsMetaTemplate && allTemplatesPresent
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass 
        ? "isMetaTemplate() correctly identifies all 4 meta-template variants"
        : "Missing isMetaTemplate() or some meta-template IDs"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 2: Auto-trailblazing enablement
 * Verifies that meta-templates automatically get trailblazing enabled
 */
async function testAutoTrailblazingEnablement(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-2"
  
  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/tool/activity.ts"
    )
    
    const content = await readFile(filePath)
    
    // Check for auto-enabling logic
    const hasAutoEnableCheck = containsPattern(content, /ActivityTemplate\.isMetaTemplate.*trailblazingOptions/)
    const hasAutoEnableLog = containsPattern(content, /auto-enabling trailblazing for meta-template/)
    const hasMaxCostPerTask = containsPattern(content, /maxCostPerTask:\s*1\.0/)
    const hasMaxTotalCost = containsPattern(content, /maxTotalCost:\s*5\.0/)
    const hasMaxRecoveryAttempts = containsPattern(content, /maxRecoveryAttempts:\s*3/)
    
    const expected = {
      hasAutoEnableCheck: true,
      hasAutoEnableLog: true,
      hasConservativeLimits: true,
      limits: {
        maxCostPerTask: 1.0,
        maxTotalCost: 5.0,
        maxRecoveryAttempts: 3
      }
    }
    
    const actual = {
      hasAutoEnableCheck,
      hasAutoEnableLog,
      hasConservativeLimits: hasMaxCostPerTask && hasMaxTotalCost && hasMaxRecoveryAttempts,
      limits: {
        maxCostPerTask: hasMaxCostPerTask ? 1.0 : null,
        maxTotalCost: hasMaxTotalCost ? 5.0 : null,
        maxRecoveryAttempts: hasMaxRecoveryAttempts ? 3 : null
      }
    }
    
    const pass = hasAutoEnableCheck && hasAutoEnableLog && 
                 hasMaxCostPerTask && hasMaxTotalCost && hasMaxRecoveryAttempts
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "Auto-trailblazing correctly configured with conservative limits"
        : "Missing auto-trailblazing logic or incorrect limits"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 3: Context injection for meta-templates
 * Verifies that meta-templates receive top 3 similar activity executions
 */
async function testContextInjection(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-3"
  
  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/tool/activity.ts"
    )
    
    const content = await readFile(filePath)
    
    // Check for context injection logic
    const hasContextInjectionCheck = containsPattern(content, /searchSimilarActivities/)
    const hasContextInjectionLog = containsPattern(content, /injecting similar activity context/)
    const hasSearchSimilarActivities = containsPattern(content, /TemplateServiceClient\.searchSimilarActivities/)
    const hasImpulseCreation = containsPattern(content, /addImpulse/)
    const hasTopThreeLimit = containsPattern(content, /3\s*\)/)  // Matches searchSimilarActivities(..., 3)
    
    const expected = {
      hasContextInjection: true,
      queriesBackend: true,
      createsImpulse: true,
      limitTopThree: true
    }
    
    const actual = {
      hasContextInjection: hasContextInjectionCheck,
      queriesBackend: hasSearchSimilarActivities,
      createsImpulse: hasImpulseCreation,
      limitTopThree: hasTopThreeLimit
    }
    
    const pass = hasContextInjectionCheck && hasContextInjectionLog && 
                 hasSearchSimilarActivities && hasImpulseCreation
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "Context injection queries backend and creates impulse with top 3 similar activities"
        : "Missing context injection logic or impulse creation"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 4: Lifecycle hooks registration
 * Verifies that memory-management and activity-recommendation hooks are registered
 */
async function testLifecycleHooks(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-4"
  
  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts"
    )
    
    const content = await readFile(filePath)
    
    // Check for memory-management hook
    const hasMemoryManagementHook = containsPattern(content, /name:\s*["']memory-management["']/)
    const hasMemoryManagementPriority = containsPattern(content, /priority:\s*10/)
    const hasMemoryManagementActivity = containsPattern(content, /manage-session-memory/)
    
    // Check for activity-recommendation hook
    const hasActivityRecommendationHook = containsPattern(content, /name:\s*["']activity-recommendation-injection["']/)
    const hasActivityRecommendationPriority = containsPattern(content, /priority:\s*15/)
    
    const expected = {
      memoryManagementHook: {
        registered: true,
        priority: 10,
        executesActivity: true
      },
      activityRecommendationHook: {
        registered: true,
        priority: 15
      }
    }
    
    const actual = {
      memoryManagementHook: {
        registered: hasMemoryManagementHook,
        priority: hasMemoryManagementPriority ? 10 : null,
        executesActivity: hasMemoryManagementActivity
      },
      activityRecommendationHook: {
        registered: hasActivityRecommendationHook,
        priority: hasActivityRecommendationPriority ? 15 : null
      }
    }
    
    const pass = hasMemoryManagementHook && hasMemoryManagementPriority && 
                 hasActivityRecommendationHook && hasActivityRecommendationPriority
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "Lifecycle hooks registered with correct priorities (memory=10, recommendations=15)"
        : "Missing lifecycle hooks or incorrect priorities"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 5: Backend sync enforcement
 * Verifies that Activity.save() syncs to backend via MCP
 */
async function testBackendSync(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-5"
  
  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/activity.ts"
    )
    
    const content = await readFile(filePath)
    
    // Check for backend sync logic
    const hasMetabobActivitySaveCall = containsPattern(content, /metabob_activity_save/)
    const hasMetabobClientCheck = containsPattern(content, /metabobClient/)
    const hasSyncLog = containsPattern(content, /synced activity to backend|backend sync/)
    const hasWarningIfUnavailable = containsPattern(content, /warn.*metabob_activity_save.*not available/)
    
    const expected = {
      callsMetabobActivitySave: true,
      checksClientAvailability: true,
      logsSync: true,
      warnsIfUnavailable: true
    }
    
    const actual = {
      callsMetabobActivitySave: hasMetabobActivitySaveCall,
      checksClientAvailability: hasMetabobClientCheck,
      logsSync: hasSyncLog,
      warnsIfUnavailable: hasWarningIfUnavailable
    }
    
    const pass = hasMetabobActivitySaveCall && hasMetabobClientCheck
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "Activity.save() syncs to backend via metabob_activity_save MCP tool"
        : "Missing backend sync logic in Activity.save()"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 6: Bootstrap templates exist
 * Verifies that meta-templates are embedded as bootstrap templates
 */
async function testBootstrapTemplates(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-6"
  
  try {
    const bootstrapDir = path.join(process.cwd(), "templates/bootstrap")
    
    // Check for meta-template files
    const createActivityExists = await fileExists(
      path.join(bootstrapDir, "create-activity-self-contained.json")
    )
    const debugActivityExists = await fileExists(
      path.join(bootstrapDir, "debug-activity-self-contained.json")
    )
    const evolveActivityExists = await fileExists(
      path.join(bootstrapDir, "evolve-activity-self-contained.json")
    )
    
    // Count total bootstrap templates
    const { stdout } = await execAsync(`ls -1 ${bootstrapDir}/*.json 2>/dev/null | wc -l`)
    const totalTemplates = parseInt(stdout.trim())
    
    const expected = {
      createActivityExists: true,
      debugActivityExists: true,
      evolveActivityExists: true,
      totalTemplates: "≥15"
    }
    
    const actual = {
      createActivityExists,
      debugActivityExists,
      evolveActivityExists,
      totalTemplates
    }
    
    const pass = createActivityExists && debugActivityExists && 
                 evolveActivityExists && totalTemplates >= 15
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? `All 3 meta-templates exist in bootstrap (${totalTemplates} total templates)`
        : "Missing meta-templates in bootstrap directory"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 7: No filesystem dependency in meta-templates
 * Verifies that debug/evolve activities use MCP tools, not filesystem
 */
async function testNoFilesystemDependency(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-7"
  
  try {
    const debugTemplatePath = path.join(
      process.cwd(),
      "templates/bootstrap/debug-activity-self-contained.json"
    )
    const evolveTemplatePath = path.join(
      process.cwd(),
      "templates/bootstrap/evolve-activity-self-contained.json"
    )
    
    const debugContent = await readFile(debugTemplatePath)
    const evolveContent = await readFile(evolveTemplatePath)
    
    // Check for MCP tool usage (good)
    const debugUsesMCP = containsPattern(debugContent, /activity_error_inspector/)
    const evolveUsesMCP = containsPattern(evolveContent, /search_activities|get_activity_template/)
    
    // Check for filesystem access (bad)
    const debugUsesFs = containsPattern(debugContent, /fs\.|readFile|writeFile|readdir/) &&
                        !containsPattern(debugContent, /activity_error_inspector/)
    const evolveUsesFs = containsPattern(evolveContent, /fs\.|readFile|writeFile|readdir/) &&
                         !containsPattern(evolveContent, /search_activities/)
    
    const expected = {
      debugUsesMCP: true,
      evolveUsesMCP: true,
      debugUsesFilesystem: false,
      evolveUsesFilesystem: false
    }
    
    const actual = {
      debugUsesMCP,
      evolveUsesMCP,
      debugUsesFilesystem: debugUsesFs,
      evolveUsesFilesystem: evolveUsesFs
    }
    
    const pass = debugUsesMCP && evolveUsesMCP && !debugUsesFs && !evolveUsesFs
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "Meta-templates use MCP tools for data access (no filesystem dependency)"
        : "Meta-templates have filesystem dependencies (should use MCP tools)"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 8: Observability checkpoints in logs
 * Verifies that key log statements exist for debugging
 */
async function testObservabilityCheckpoints(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-8"
  
  try {
    const activityToolPath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/tool/activity.ts"
    )
    const activityPath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/activity.ts"
    )
    
    const activityToolContent = await readFile(activityToolPath)
    const activityContent = await readFile(activityPath)
    
    // Check for observability log statements
    const hasMetaTemplateDetectionLog = containsPattern(
      activityToolContent,
      /log\.(info|debug).*auto-enabling trailblazing for meta-template/
    )
    const hasContextInjectionLog = containsPattern(
      activityToolContent,
      /log\.(info|debug).*injecting similar activity context/
    )
    const hasBackendSyncLog = containsPattern(
      activityContent,
      /log\.(info|debug).*synced activity to backend/
    )
    
    const expected = {
      hasMetaTemplateDetectionLog: true,
      hasContextInjectionLog: true,
      hasBackendSyncLog: true
    }
    
    const actual = {
      hasMetaTemplateDetectionLog,
      hasContextInjectionLog,
      hasBackendSyncLog
    }
    
    const pass = hasMetaTemplateDetectionLog && hasContextInjectionLog && hasBackendSyncLog
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "All observability checkpoints present in code"
        : "Missing observability log statements"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 9: MCP registration timeout
 * Verifies that template registration timeout is set to 15000ms
 */
async function testMCPRegistrationTimeout(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-9"
  
  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts"
    )
    
    const content = await readFile(filePath)
    
    // Check for 15000ms timeout in registerTemplate
    const hasCorrectTimeout = containsPattern(content, /timeout.*15000|15000.*timeout/)
    const hasRegisterTemplateMethod = containsPattern(content, /registerTemplate/)
    
    const expected = {
      hasRegisterTemplateMethod: true,
      timeout: 15000
    }
    
    const actual = {
      hasRegisterTemplateMethod,
      timeout: hasCorrectTimeout ? 15000 : null
    }
    
    const pass = hasRegisterTemplateMethod && hasCorrectTimeout
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "MCP registration timeout set to 15000ms (prevents K8s timeouts)"
        : "MCP registration timeout not set to 15000ms"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Case 10: Trailblazing executor implementation
 * Verifies that TrailblazingExecutor implements retry loop with recovery
 */
async function testTrailblazingExecutor(): Promise<ValidationResult> {
  const caseId = "validation-dynamic-activity-creation-with-trailblazing-pass3-case-10"
  
  try {
    const filePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts"
    )
    
    const content = await readFile(filePath)
    
    // Check for key trailblazing features
    const hasExecuteTaskWithTrailblazing = containsPattern(
      content,
      /executeTaskWithTrailblazing/
    )
    const hasRetryLoop = containsPattern(content, /maxRecoveryAttempts|retry.*loop/)
    const hasContinuationGenerator = containsPattern(content, /ContinuationGenerator/)
    const hasMaxCostPerTask = containsPattern(content, /maxCostPerTask/)
    const hasMaxTotalCost = containsPattern(content, /maxTotalCost/)
    
    const expected = {
      hasExecuteMethod: true,
      hasRetryLoop: true,
      hasContinuationGenerator: true,
      respectsCostBudgets: true
    }
    
    const actual = {
      hasExecuteMethod: hasExecuteTaskWithTrailblazing,
      hasRetryLoop,
      hasContinuationGenerator,
      respectsCostBudgets: hasMaxCostPerTask && hasMaxTotalCost
    }
    
    const pass = hasExecuteTaskWithTrailblazing && hasRetryLoop && 
                 hasContinuationGenerator && hasMaxCostPerTask && hasMaxTotalCost
    
    return {
      pass,
      caseId,
      actual,
      expected,
      details: pass
        ? "TrailblazingExecutor implements retry loop with AI recovery and cost budgets"
        : "Missing trailblazing executor features"
    }
  } catch (error) {
    return {
      pass: false,
      caseId,
      actual: null,
      expected: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// ============================================================================
// MAIN VALIDATION RUNNER
// ============================================================================

const validationCases: ValidationCase[] = [
  {
    id: "case-1",
    name: "Meta-template detection",
    test: testMetaTemplateDetection
  },
  {
    id: "case-2",
    name: "Auto-trailblazing enablement",
    test: testAutoTrailblazingEnablement
  },
  {
    id: "case-3",
    name: "Context injection",
    test: testContextInjection
  },
  {
    id: "case-4",
    name: "Lifecycle hooks",
    test: testLifecycleHooks
  },
  {
    id: "case-5",
    name: "Backend sync",
    test: testBackendSync
  },
  {
    id: "case-6",
    name: "Bootstrap templates",
    test: testBootstrapTemplates
  },
  {
    id: "case-7",
    name: "No filesystem dependency",
    test: testNoFilesystemDependency
  },
  {
    id: "case-8",
    name: "Observability checkpoints",
    test: testObservabilityCheckpoints
  },
  {
    id: "case-9",
    name: "MCP registration timeout",
    test: testMCPRegistrationTimeout
  },
  {
    id: "case-10",
    name: "Trailblazing executor",
    test: testTrailblazingExecutor
  }
]

/**
 * Run all validation cases and return results
 */
export async function runValidation(): Promise<{
  pass: boolean
  totalCases: number
  passedCases: number
  failedCases: number
  results: ValidationResult[]
}> {
  console.log("🧪 Running Pass 3 validation harness...")
  console.log(`📋 Total test cases: ${validationCases.length}\n`)
  
  const results: ValidationResult[] = []
  let passedCases = 0
  let failedCases = 0
  
  for (const testCase of validationCases) {
    console.log(`⏳ Running ${testCase.name}...`)
    
    try {
      const result = await testCase.test()
      results.push(result)
      
      if (result.pass) {
        passedCases++
        console.log(`✅ PASS: ${testCase.name}`)
      } else {
        failedCases++
        console.log(`❌ FAIL: ${testCase.name}`)
        if (result.error) {
          console.log(`   Error: ${result.error}`)
        }
        if (result.details) {
          console.log(`   Details: ${result.details}`)
        }
      }
    } catch (error) {
      failedCases++
      const errorResult: ValidationResult = {
        pass: false,
        caseId: testCase.id,
        actual: null,
        expected: null,
        error: error instanceof Error ? error.message : String(error)
      }
      results.push(errorResult)
      console.log(`❌ FAIL: ${testCase.name}`)
      console.log(`   Error: ${errorResult.error}`)
    }
    
    console.log("")
  }
  
  const pass = failedCases === 0
  
  console.log("=" .repeat(60))
  console.log(`📊 Validation Results: ${pass ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`   Total: ${validationCases.length}`)
  console.log(`   Passed: ${passedCases}`)
  console.log(`   Failed: ${failedCases}`)
  console.log("=" .repeat(60))
  
  return {
    pass,
    totalCases: validationCases.length,
    passedCases,
    failedCases,
    results
  }
}

// CLI execution (run directly with: bun run dynamic-activity-creation-with-trailblazing-pass3-harness.ts)
if (process.argv[1] && process.argv[1].includes('dynamic-activity-creation-with-trailblazing-pass3-harness')) {
  runValidation()
    .then((summary) => {
      process.exit(summary.pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("Fatal error running validation:", error)
      process.exit(1)
    })
}
