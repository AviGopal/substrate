#!/usr/bin/env bun

/**
 * Validation Harness: Template Storage Architecture Migration
 * 
 * Verifies architectural constraint enforcement:
 * - Templates should NOT be stored locally (except cache)
 * - Templates retrieved from backend via MCP only
 * - Embedded bootstrap templates for cold-start
 * - No local file writes during registration
 * 
 * This harness performs static code analysis and filesystem checks
 * to ensure no local template storage violations.
 */

import * as fs from "fs"
import path from "path"
import { homedir } from "os"

interface TestInput {
  testType: "filesystem" | "codeAnalysis"
  operation: string
  file?: string
  component?: string
  paths?: string[]
  forbiddenPatterns?: string[]
  requiredPatterns?: string[]
}

interface TestResult {
  pass: boolean
  actual: any
  expected: any
  message: string
  details?: string
}

interface ValidationResult {
  testCaseId: string
  testName: string
  pass: boolean
  actual: any
  expected: any
  message: string
  details?: string
}

/**
 * Expand tilde in path to home directory
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(homedir(), filePath.slice(2))
  }
  return filePath
}

/**
 * Check if directory exists
 */
function checkDirectoryExists(dirPath: string): boolean {
  const expandedPath = expandPath(dirPath)
  try {
    const stats = fs.statSync(expandedPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Read file content
 */
function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`)
  }
}

/**
 * Check if pattern exists in content
 */
function patternExists(content: string, pattern: string): boolean {
  const regex = new RegExp(pattern, "gm")
  return regex.test(content)
}

/**
 * Count pattern matches in content
 */
function countPatternMatches(content: string, pattern: string): number {
  const regex = new RegExp(pattern, "gm")
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

/**
 * Validate filesystem test case
 */
function validateFilesystemTest(input: TestInput): TestResult {
  if (input.operation === "checkDirectoryNotExists") {
    const results = input.paths!.map((dirPath) => ({
      path: dirPath,
      exists: checkDirectoryExists(dirPath),
    }))

    const anyExists = results.some((r) => r.exists)
    const existingPaths = results.filter((r) => r.exists).map((r) => r.path)

    return {
      pass: !anyExists,
      actual: {
        directoryExists: anyExists,
        existingPaths,
      },
      expected: {
        directoryExists: false,
        message: "Local template storage directories should NOT exist",
      },
      message: anyExists
        ? `FAIL: Found local template storage at: ${existingPaths.join(", ")}`
        : "PASS: No local template storage directories found",
      details: results.map((r) => `${r.path}: ${r.exists ? "EXISTS" : "NOT FOUND"}`).join("\n"),
    }
  }

  throw new Error(`Unknown filesystem operation: ${input.operation}`)
}

/**
 * Validate code analysis test case
 */
function validateCodeAnalysisTest(input: TestInput): TestResult {
  const filePath = input.file!
  let content: string

  try {
    content = readFileContent(filePath)
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected: {},
      message: `FAIL: Could not read file ${filePath}`,
      details: String(error),
    }
  }

  // Extract component if specified (find function boundaries)
  let componentContent = content
  if (input.component) {
    // Simple extraction: find "export async function {component}" until next "export" or end
    const componentRegex = new RegExp(
      `export\\s+async\\s+function\\s+${input.component}\\s*\\([^)]*\\)\\s*[^{]*{([\\s\\S]*?)(?=export\\s+async\\s+function|export\\s+function|export\\s+const|$)`,
      "m"
    )
    const match = content.match(componentRegex)
    if (match) {
      componentContent = match[0]
    }
  }

  const result: any = {}

  // Check forbidden patterns
  if (input.forbiddenPatterns) {
    const forbiddenMatches: Array<{ pattern: string; count: number }> = []
    for (const pattern of input.forbiddenPatterns) {
      const count = countPatternMatches(componentContent, pattern)
      if (count > 0) {
        forbiddenMatches.push({ pattern, count })
      }
    }

    if (input.operation === "checkNoStorageWrites") {
      result.hasStorageWrites = forbiddenMatches.length > 0
      result.forbiddenMatches = forbiddenMatches
    } else if (input.operation === "checkNoStorageReads") {
      result.hasStorageReads = forbiddenMatches.length > 0
      result.forbiddenMatches = forbiddenMatches
    } else if (input.operation === "checkNoLocalSave") {
      result.savesLocally = forbiddenMatches.length > 0
      result.forbiddenMatches = forbiddenMatches
    } else if (input.operation === "checkNoFileWrites") {
      result.writesFiles = forbiddenMatches.length > 0
      result.forbiddenMatches = forbiddenMatches
    } else if (input.operation === "checkNoLocalFallback") {
      result.hasLocalFallback = forbiddenMatches.length > 0
      result.forbiddenMatches = forbiddenMatches
    }
  }

  // Check required patterns
  if (input.requiredPatterns) {
    const requiredMatches: Array<{ pattern: string; found: boolean }> = []
    for (const pattern of input.requiredPatterns) {
      const found = patternExists(componentContent, pattern)
      requiredMatches.push({ pattern, found })
    }

    const allFound = requiredMatches.every((m) => m.found)

    if (input.operation === "checkNoStorageReads") {
      result.hasBootstrapCheck = allFound
    } else if (input.operation === "checkRejectsLocalBackend") {
      result.rejectsLocal = allFound
    } else if (input.operation === "checkNoLocalFallback") {
      result.hasBootstrapCheck = allFound
    } else if (input.operation === "checkEmbeddedTemplates") {
      result.hasEmbeddedTemplates = patternExists(componentContent, input.requiredPatterns[0])
      result.hasCoreTemplates =
        patternExists(componentContent, "create-activity") &&
        patternExists(componentContent, "debug-activity") &&
        patternExists(componentContent, "evolve-activity")
    }

    result.requiredMatches = requiredMatches
  }

  // Determine pass/fail based on operation
  let pass = false
  let message = ""

  if (input.operation === "checkNoStorageWrites") {
    pass = !result.hasStorageWrites
    message = pass
      ? `PASS: ${input.component}() does not write to Storage`
      : `FAIL: ${input.component}() contains Storage.write() calls`
  } else if (input.operation === "checkNoStorageReads") {
    pass = !result.hasStorageReads && result.hasBootstrapCheck
    message = pass
      ? `PASS: ${input.component}() only reads embedded bootstrap`
      : `FAIL: ${input.component}() still reads from Storage or missing bootstrap check`
  } else if (input.operation === "checkRejectsLocalBackend") {
    pass = result.rejectsLocal === true
    message = pass
      ? `PASS: ${input.component}() rejects backend='local'`
      : `FAIL: ${input.component}() does not reject backend='local'`
  } else if (input.operation === "checkNoLocalFallback") {
    pass = !result.hasLocalFallback && result.hasBootstrapCheck
    message = pass
      ? `PASS: ${input.component}() only falls back to embedded bootstrap`
      : `FAIL: ${input.component}() has local storage fallback for non-bootstrap templates`
  } else if (input.operation === "checkNoLocalSave") {
    pass = !result.savesLocally
    message = pass
      ? `PASS: ${input.component}() does not save locally`
      : `FAIL: ${input.component}() contains local save calls`
  } else if (input.operation === "checkNoFileWrites") {
    pass = !result.writesFiles
    message = pass
      ? `PASS: ${input.component}() does not write files`
      : `FAIL: ${input.component}() contains file write calls`
  } else if (input.operation === "checkEmbeddedTemplates") {
    pass = result.hasEmbeddedTemplates && result.hasCoreTemplates
    message = pass
      ? "PASS: Bootstrap templates are embedded with core templates"
      : "FAIL: Missing embedded templates or core templates"
  }

  return {
    pass,
    actual: result,
    expected: input.operation === "checkNoStorageWrites"
      ? { hasStorageWrites: false }
      : input.operation === "checkNoStorageReads"
        ? { hasStorageReads: false, hasBootstrapCheck: true }
        : input.operation === "checkRejectsLocalBackend"
          ? { rejectsLocal: true }
          : input.operation === "checkNoLocalFallback"
            ? { hasLocalFallback: false, hasBootstrapCheck: true }
            : input.operation === "checkNoLocalSave"
              ? { savesLocally: false }
              : input.operation === "checkNoFileWrites"
                ? { writesFiles: false }
                : input.operation === "checkEmbeddedTemplates"
                  ? { hasEmbeddedTemplates: true, hasCoreTemplates: true }
                  : {},
    message,
    details: JSON.stringify(result, null, 2),
  }
}

/**
 * Run validation for a single test case
 */
export function runValidation(input: TestInput): TestResult {
  if (input.testType === "filesystem") {
    return validateFilesystemTest(input)
  } else if (input.testType === "codeAnalysis") {
    return validateCodeAnalysisTest(input)
  }

  throw new Error(`Unknown test type: ${input.testType}`)
}

/**
 * Run all validation test cases
 */
export async function runAllValidations(testCases: Array<{ id: string; name: string; input: TestInput; expectedOutput: any }>): Promise<{
  passed: number
  failed: number
  total: number
  results: ValidationResult[]
}> {
  const results: ValidationResult[] = []

  for (const testCase of testCases) {
    console.log(`\n🧪 Running: ${testCase.name}`)

    try {
      const result = runValidation(testCase.input)

      results.push({
        testCaseId: testCase.id,
        testName: testCase.name,
        pass: result.pass,
        actual: result.actual,
        expected: result.expected,
        message: result.message,
        details: result.details,
      })

      console.log(`   ${result.pass ? "✅" : "❌"} ${result.message}`)
    } catch (error) {
      results.push({
        testCaseId: testCase.id,
        testName: testCase.name,
        pass: false,
        actual: { error: String(error) },
        expected: testCase.expectedOutput,
        message: `ERROR: ${error}`,
      })

      console.log(`   ❌ ERROR: ${error}`)
    }
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  return {
    passed,
    failed,
    total: results.length,
    results,
  }
}

/**
 * Main execution (if run directly)
 */
if (typeof Bun !== "undefined" && import.meta.path === Bun.main) {
  console.log("🔍 Template Storage Architecture Migration - Validation Harness\n")
  console.log("=" .repeat(80))

  // Load test cases
  const testCasesPath = path.join(path.dirname(import.meta.path), "../../tmp/validation-test-cases.json")
  let testCasesData: any

  try {
    testCasesData = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"))
  } catch (error) {
    console.error(`❌ Failed to load test cases from ${testCasesPath}`)
    console.error(`   ${error}`)
    process.exit(1)
  }

  const testCases = testCasesData.testCases.map((tc: any) => ({
    id: tc.id,
    name: tc.name,
    input: tc.input,
    expectedOutput: tc.expectedOutput,
  }))

  // Run validations
  const summary = await runAllValidations(testCases)

  console.log("\n" + "=".repeat(80))
  console.log("\n📊 Validation Summary:")
  console.log(`   ✅ Passed: ${summary.passed}/${summary.total}`)
  console.log(`   ❌ Failed: ${summary.failed}/${summary.total}`)

  if (summary.failed > 0) {
    console.log("\n❌ Validation FAILED - architectural constraint violations detected")
    process.exit(1)
  } else {
    console.log("\n✅ Validation PASSED - all architectural constraints enforced")
    process.exit(0)
  }
}
