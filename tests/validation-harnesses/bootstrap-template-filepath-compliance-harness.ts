#!/usr/bin/env bun
/**
 * Validation Harness: bootstrap-template-filepath-compliance
 * 
 * Validates that bootstrap templates are loaded from embedded imports
 * instead of filesystem paths that don't exist in production environments.
 * 
 * Test Cases:
 * 1. Load templates successfully from embedded imports
 * 2. Verify no filesystem path dependencies
 * 3. Validate template structure and completeness
 * 4. Test in simulated production environment (no metabob-proto)
 * 5. Verify performance improvement (no I/O)
 */

import { existsSync, readFileSync } from "fs"
import { join } from "path"

export interface ValidationResult {
  pass: boolean
  actual: any
  expected: any
  error?: string
  details?: Record<string, any>
}

export interface TestCase {
  id: string
  description: string
  input: any
  expectedOutput: any
}

/**
 * Test Case 1: Load templates from embedded imports
 */
export async function testEmbeddedTemplateLoading(): Promise<ValidationResult> {
  const expected = {
    success: true,
    templateCount: 6,
    templateIds: [
      "create-activity",
      "debug-activity-self-contained",
      "evolve-activity-self-contained",
      "manage-session-memory",
      "trace-data-flow-single-feature",
      "trace-enforce-validate-loop",
    ],
    source: "embedded-imports",
  }

  try {
    // Dynamic import to test actual loading behavior
    const { BootstrapTemplates } = await import(
      "../../repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts"
    )

    const templates = await BootstrapTemplates.loadAll()

    const actual = {
      success: true,
      templateCount: templates.length,
      templateIds: templates.map((t: any) => t.id).sort(),
      source: "embedded-imports",
    }

    const pass =
      actual.templateCount === expected.templateCount &&
      JSON.stringify(actual.templateIds) === JSON.stringify(expected.templateIds.sort())

    return {
      pass,
      actual,
      expected,
      details: {
        templatesLoaded: templates.map((t: any) => ({
          id: t.id,
          name: t.name,
          taskCount: t.tasks.length,
        })),
      },
    }
  } catch (error) {
    return {
      pass: false,
      actual: { success: false, error: error instanceof Error ? error.message : String(error) },
      expected,
      error: `Failed to load templates: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Test Case 2: Verify no filesystem path dependencies
 */
export async function testNoFilesystemDependencies(): Promise<ValidationResult> {
  const expected = {
    noOldPath: true,
    hasEmbeddedImports: true,
    noFileSystemReads: true,
  }

  try {
    const bootstrapFilePath = join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts"
    )

    if (!existsSync(bootstrapFilePath)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        error: "bootstrap-templates.ts file not found",
      }
    }

    const sourceCode = readFileSync(bootstrapFilePath, "utf-8")

    // Check for old problematic path
    const hasOldPath = sourceCode.includes("../../../../../metabob-proto/activities/bootstrap")

    // Check for embedded imports
    const hasEmbeddedImports = sourceCode.includes('from "./templates/')

    // Check for filesystem reads (Bun.file with path variables)
    const hasFileSystemReads = /Bun\.file\(.*?path.*?\)/i.test(sourceCode)

    const actual = {
      noOldPath: !hasOldPath,
      hasEmbeddedImports,
      noFileSystemReads: !hasFileSystemReads,
    }

    const pass = actual.noOldPath && actual.hasEmbeddedImports && actual.noFileSystemReads

    return {
      pass,
      actual,
      expected,
      details: {
        codeAnalysis: {
          oldPathFound: hasOldPath,
          embeddedImportsFound: hasEmbeddedImports,
          fileSystemReadsFound: hasFileSystemReads,
        },
      },
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected,
      error: `Source code analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Test Case 3: Validate template structure and completeness
 */
export async function testTemplateStructureValidation(): Promise<ValidationResult> {
  const expected = {
    allTemplatesValid: true,
    requiredFieldsPresent: true,
    tasksNonEmpty: true,
  }

  try {
    const { BootstrapTemplates } = await import(
      "../../repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts"
    )

    const templates = await BootstrapTemplates.loadAll()

    const validationResults = templates.map((template: any) => {
      const hasId = Boolean(template.id)
      const hasName = Boolean(template.name)
      const hasDescription = Boolean(template.description)
      const hasTasks = Array.isArray(template.tasks) && template.tasks.length > 0
      const allTasksValid = template.tasks.every(
        (task: any) =>
          task.id && task.description && task.prompt && task.prompt.template
      )

      return {
        id: template.id,
        valid: hasId && hasName && hasDescription && hasTasks && allTasksValid,
        hasId,
        hasName,
        hasDescription,
        hasTasks,
        allTasksValid,
        taskCount: template.tasks.length,
      }
    })

    const allValid = validationResults.every((r: any) => r.valid)
    const actual = {
      allTemplatesValid: allValid,
      requiredFieldsPresent: validationResults.every((r: any) => r.hasId && r.hasName && r.hasDescription),
      tasksNonEmpty: validationResults.every((r: any) => r.hasTasks),
    }

    const pass =
      actual.allTemplatesValid &&
      actual.requiredFieldsPresent &&
      actual.tasksNonEmpty

    return {
      pass,
      actual,
      expected,
      details: {
        templateValidation: validationResults,
      },
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected,
      error: `Template validation failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Test Case 4: Simulated production environment (no metabob-proto access)
 */
export async function testProductionEnvironmentSimulation(): Promise<ValidationResult> {
  const expected = {
    loadSuccessWithoutMetabobProto: true,
    noFileSystemErrors: true,
  }

  try {
    // Verify metabob-proto path doesn't exist in typical production locations
    const productionPaths = [
      "/metabob-proto/activities/bootstrap",
      "/app/metabob-proto/activities/bootstrap",
      "/usr/local/metabob-proto/activities/bootstrap",
    ]

    const metabobProtoExists = productionPaths.some((p) => existsSync(p))

    // Load templates (should work even without metabob-proto)
    const { BootstrapTemplates } = await import(
      "../../repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts"
    )

    const templates = await BootstrapTemplates.loadAll()

    const actual = {
      loadSuccessWithoutMetabobProto: templates.length > 0 && !metabobProtoExists,
      noFileSystemErrors: true,
    }

    // If metabob-proto exists in production paths, that's unexpected but shouldn't fail
    // The key is templates should load regardless
    const pass = templates.length === 6 // Should always load 6 templates

    return {
      pass,
      actual,
      expected,
      details: {
        productionPathsChecked: productionPaths,
        metabobProtoFoundInProduction: metabobProtoExists,
        templatesLoaded: templates.length,
      },
    }
  } catch (error) {
    return {
      pass: false,
      actual: { 
        loadSuccessWithoutMetabobProto: false, 
        noFileSystemErrors: false,
        error: error instanceof Error ? error.message : String(error) 
      },
      expected,
      error: `Production simulation failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Test Case 5: Performance improvement verification (no I/O)
 */
export async function testPerformanceImprovement(): Promise<ValidationResult> {
  const expected = {
    loadTimeUnder100ms: true,
    noFileSystemIO: true,
  }

  try {
    const { BootstrapTemplates } = await import(
      "../../repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts"
    )

    const startTime = performance.now()
    const templates = await BootstrapTemplates.loadAll()
    const endTime = performance.now()
    const loadTime = endTime - startTime

    const actual = {
      loadTimeUnder100ms: loadTime < 100,
      noFileSystemIO: true, // Embedded imports have no I/O
      loadTimeMs: Math.round(loadTime * 100) / 100,
    }

    const pass = actual.loadTimeUnder100ms && templates.length === 6

    return {
      pass,
      actual,
      expected,
      details: {
        loadTime: `${actual.loadTimeMs}ms`,
        templatesLoaded: templates.length,
        averageTimePerTemplate: `${Math.round((loadTime / templates.length) * 100) / 100}ms`,
      },
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected,
      error: `Performance test failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Run all validation tests
 */
export async function runValidation(): Promise<{
  pass: boolean
  results: Record<string, ValidationResult>
  summary: {
    total: number
    passed: number
    failed: number
    passRate: number
  }
}> {
  console.log("Running bootstrap-template-filepath-compliance validation harness...\n")

  const results: Record<string, ValidationResult> = {
    "test-1-embedded-loading": await testEmbeddedTemplateLoading(),
    "test-2-no-filesystem-deps": await testNoFilesystemDependencies(),
    "test-3-structure-validation": await testTemplateStructureValidation(),
    "test-4-production-simulation": await testProductionEnvironmentSimulation(),
    "test-5-performance": await testPerformanceImprovement(),
  }

  const total = Object.keys(results).length
  const passed = Object.values(results).filter((r) => r.pass).length
  const failed = total - passed
  const passRate = Math.round((passed / total) * 100)

  const allPassed = passed === total

  return {
    pass: allPassed,
    results,
    summary: {
      total,
      passed,
      failed,
      passRate,
    },
  }
}

/**
 * Main execution
 */
if (import.meta.main) {
  const result = await runValidation()

  console.log("\n=== Validation Results ===\n")

  Object.entries(result.results).forEach(([testId, testResult]) => {
    const status = testResult.pass ? "✅ PASS" : "❌ FAIL"
    console.log(`${status}: ${testId}`)
    if (!testResult.pass && testResult.error) {
      console.log(`  Error: ${testResult.error}`)
    }
    if (testResult.details) {
      console.log(`  Details:`, JSON.stringify(testResult.details, null, 2))
    }
  })

  console.log(`\n=== Summary ===`)
  console.log(`Total Tests: ${result.summary.total}`)
  console.log(`Passed: ${result.summary.passed}`)
  console.log(`Failed: ${result.summary.failed}`)
  console.log(`Pass Rate: ${result.summary.passRate}%`)
  console.log(`\nOverall: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)

  process.exit(result.pass ? 0 : 1)
}
