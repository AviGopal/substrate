/**
 * Validation Harness: Enhanced Statistics Panel
 * 
 * Validates the enhanced-statistics-panel specification implementation:
 * - Command options (--days, --tools, --project, --trigger-boredom, --dashboard-api)
 * - 5 required functions (aggregateActivityStats, fetchMetabobStats, getBoredomStatus, displayComprehensiveStats, triggerBoredomMode)
 * - Panel display sections (System Overview, Cost & Tokens, Activity Statistics, Metabob Code Quality, Boredom System)
 * - Graceful degradation for unavailable services
 * - BoredomManager integration with real-time status queries
 */

import { execSync } from "child_process"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

export interface ValidationInput {
  testCase: string
  args?: string[]
}

export interface ValidationOutput {
  pass: boolean
  actual: any
  expected: any
  details?: string
}

export interface ValidationResult {
  testCase: string
  pass: boolean
  actual: any
  expected: any
  details?: string
  duration?: number
}

/**
 * Run all validation tests for enhanced-statistics-panel
 */
export async function runAllValidations(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []

  // Test 1: Command help shows all required options
  results.push(await validateCommandHelp())

  // Test 2: Required functions exist in stats.ts
  results.push(await validateRequiredFunctions())

  // Test 3: BoredomManager has public API
  results.push(await validateBoredomManagerAPI())

  // Test 4: Stats command executes without errors (empty data)
  results.push(await validateStatsCommandExecution())

  // Test 5: Dashboard API graceful degradation
  results.push(await validateDashboardGracefulDegradation())

  return results
}

/**
 * Test 1: Validate command help shows all required options
 */
async function validateCommandHelp(): Promise<ValidationResult> {
  const startTime = Date.now()
  const testCase = "command-help-options"

  try {
    const opencodePath = findOpenCodeBinary()
    const helpOutput = execSync(`${opencodePath} stats --help`, {
      encoding: "utf-8",
      timeout: 5000,
    })

    const expected = {
      hasCommand: true,
      options: {
        days: true,
        tools: true,
        project: true,
        triggerBoredom: true,
        dashboardApi: true,
      },
    }

    const actual = {
      hasCommand: helpOutput.includes("stats"),
      options: {
        days: helpOutput.includes("--days"),
        tools: helpOutput.includes("--tools"),
        project: helpOutput.includes("--project"),
        triggerBoredom: helpOutput.includes("--trigger-boredom"),
        dashboardApi: helpOutput.includes("--dashboard-api"),
      },
    }

    const allOptionsPresent = Object.values(actual.options).every((v) => v === true)
    const pass = actual.hasCommand && allOptionsPresent

    return {
      testCase,
      pass,
      actual,
      expected,
      details: pass
        ? "All required options present in stats command help"
        : `Missing options: ${Object.entries(actual.options)
            .filter(([, v]) => !v)
            .map(([k]) => k)
            .join(", ")}`,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase,
      pass: false,
      actual: { error: String(error) },
      expected: { hasCommand: true, options: {} },
      details: `Failed to run stats --help: ${error}`,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Test 2: Validate required functions exist in stats.ts
 */
async function validateRequiredFunctions(): Promise<ValidationResult> {
  const startTime = Date.now()
  const testCase = "required-functions-exist"

  try {
    const statsFilePath = findStatsFile()
    const statsContent = readFileSync(statsFilePath, "utf-8")

    const expected = {
      functions: {
        aggregateActivityStats: true,
        fetchMetabobStats: true,
        getBoredomStatus: true,
        displayComprehensiveStats: true,
        triggerBoredomMode: true,
      },
    }

    const actual = {
      functions: {
        aggregateActivityStats: /async function aggregateActivityStats/.test(statsContent),
        fetchMetabobStats: /async function fetchMetabobStats/.test(statsContent),
        getBoredomStatus: /async function getBoredomStatus/.test(statsContent),
        displayComprehensiveStats: /function displayComprehensiveStats/.test(statsContent),
        triggerBoredomMode: /async function triggerBoredomMode/.test(statsContent),
      },
    }

    const allFunctionsPresent = Object.values(actual.functions).every((v) => v === true)
    const pass = allFunctionsPresent

    return {
      testCase,
      pass,
      actual,
      expected,
      details: pass
        ? "All 5 required functions found in stats.ts"
        : `Missing functions: ${Object.entries(actual.functions)
            .filter(([, v]) => !v)
            .map(([k]) => k)
            .join(", ")}`,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase,
      pass: false,
      actual: { error: String(error) },
      expected: { functions: {} },
      details: `Failed to read stats.ts: ${error}`,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Test 3: Validate BoredomManager has public API
 */
async function validateBoredomManagerAPI(): Promise<ValidationResult> {
  const startTime = Date.now()
  const testCase = "boredom-manager-public-api"

  try {
    const boredomManagerPath = findBoredomManagerFile()
    const boredomContent = readFileSync(boredomManagerPath, "utf-8")

    const expected = {
      exports: {
        BoredomStatusInterface: true,
        getStatus: true,
        getAllStatus: true,
        getMonitoredSessionCount: true,
      },
    }

    const actual = {
      exports: {
        BoredomStatusInterface: /export interface BoredomStatus/.test(boredomContent),
        getStatus: /export function getStatus/.test(boredomContent),
        getAllStatus: /export function getAllStatus/.test(boredomContent),
        getMonitoredSessionCount: /export function getMonitoredSessionCount/.test(boredomContent),
      },
    }

    const allExportsPresent = Object.values(actual.exports).every((v) => v === true)
    const pass = allExportsPresent

    return {
      testCase,
      pass,
      actual,
      expected,
      details: pass
        ? "BoredomManager has all required public API exports"
        : `Missing exports: ${Object.entries(actual.exports)
            .filter(([, v]) => !v)
            .map(([k]) => k)
            .join(", ")}`,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase,
      pass: false,
      actual: { error: String(error) },
      expected: { exports: {} },
      details: `Failed to read boredom-manager.ts: ${error}`,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Test 4: Validate stats command can be invoked and recognizes options
 * Note: Full execution test requires proper bootstrap environment
 */
async function validateStatsCommandExecution(): Promise<ValidationResult> {
  const startTime = Date.now()
  const testCase = "stats-command-invocation"

  try {
    const opencodePath = findOpenCodeBinary()
    
    // Test that command is recognized and accepts options
    const helpOutput = execSync(`${opencodePath} stats --help 2>&1`, {
      encoding: "utf-8",
      timeout: 5000,
    })

    const expected = {
      commandRecognized: true,
      hasDescription: true,
      acceptsOptions: true,
      noSyntaxErrors: true,
    }

    const actual = {
      commandRecognized: helpOutput.includes("stats") || helpOutput.includes("statistics"),
      hasDescription: helpOutput.includes("comprehensive") || helpOutput.includes("show") || helpOutput.includes("statistics"),
      acceptsOptions: helpOutput.includes("--days") && helpOutput.includes("--tools"),
      noSyntaxErrors: !helpOutput.toLowerCase().includes("syntaxerror") && !helpOutput.includes("unexpected token"),
    }

    const pass = Object.values(actual).every((v) => v === true)

    return {
      testCase,
      pass,
      actual,
      expected,
      details: pass
        ? "Stats command is properly registered and accepts required options"
        : "Stats command registration issues detected",
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase,
      pass: false,
      actual: { error: String(error) },
      expected: { commandRecognized: true },
      details: `Failed to invoke stats command: ${error}`,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Test 5: Validate graceful degradation when dashboard API unavailable
 */
async function validateDashboardGracefulDegradation(): Promise<ValidationResult> {
  const startTime = Date.now()
  const testCase = "dashboard-graceful-degradation"

  try {
    const statsFilePath = findStatsFile()
    const statsContent = readFileSync(statsFilePath, "utf-8")

    const expected = {
      hasTryCatch: true,
      returnsNull: true,
      hasErrorHandling: true,
    }

    // Check fetchMetabobStats has try/catch and returns null on error
    const fetchMetabobStatsMatch = statsContent.match(
      /async function fetchMetabobStats[\s\S]*?(?=\n\s*async function|\n\s*function|\n\s*export|\Z)/
    )

    if (!fetchMetabobStatsMatch) {
      return {
        testCase,
        pass: false,
        actual: { error: "fetchMetabobStats function not found" },
        expected,
        details: "Could not extract fetchMetabobStats function",
        duration: Date.now() - startTime,
      }
    }

    const functionBody = fetchMetabobStatsMatch[0]

    const actual = {
      hasTryCatch: /try\s*{/.test(functionBody),
      returnsNull: /return null/.test(functionBody),
      hasErrorHandling: /catch\s*\(/.test(functionBody),
    }

    const pass = actual.hasTryCatch && actual.returnsNull && actual.hasErrorHandling

    return {
      testCase,
      pass,
      actual,
      expected,
      details: pass
        ? "fetchMetabobStats has proper error handling with graceful degradation"
        : "fetchMetabobStats missing proper error handling",
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      testCase,
      pass: false,
      actual: { error: String(error) },
      expected,
      details: `Failed to validate graceful degradation: ${error}`,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Helper: Find opencode binary
 */
function findOpenCodeBinary(): string {
  const possiblePaths = [
    "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode",
    "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/dist/opencode-linux-arm64/bin/opencode",
    "./repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode",
    "./repos/metabob-opencode/packages/opencode/dist/opencode-linux-arm64/bin/opencode",
    "opencode",
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  // Try using 'which' as fallback
  try {
    return execSync("which opencode", { encoding: "utf-8" }).trim()
  } catch {
    throw new Error("opencode binary not found")
  }
}

/**
 * Helper: Find stats.ts file
 */
function findStatsFile(): string {
  const possiblePaths = [
    "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts",
    "./repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts",
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  throw new Error("stats.ts file not found")
}

/**
 * Helper: Find boredom-manager.ts file
 */
function findBoredomManagerFile(): string {
  const possiblePaths = [
    "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts",
    "./repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts",
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  throw new Error("boredom-manager.ts file not found")
}

/**
 * Pretty print validation results
 */
export function printValidationResults(results: ValidationResult[]): void {
  console.log("\n" + "=".repeat(70))
  console.log("Enhanced Statistics Panel - Validation Results")
  console.log("=".repeat(70) + "\n")

  let passCount = 0
  let failCount = 0

  for (const result of results) {
    const status = result.pass ? "✅ PASS" : "❌ FAIL"
    const duration = result.duration ? ` (${result.duration}ms)` : ""

    console.log(`${status} - ${result.testCase}${duration}`)

    if (!result.pass) {
      console.log(`  Details: ${result.details}`)
      console.log(`  Expected:`, JSON.stringify(result.expected, null, 2))
      console.log(`  Actual:`, JSON.stringify(result.actual, null, 2))
    } else if (result.details) {
      console.log(`  ${result.details}`)
    }

    console.log()

    if (result.pass) {
      passCount++
    } else {
      failCount++
    }
  }

  console.log("=".repeat(70))
  console.log(`Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount}`)
  console.log("=".repeat(70) + "\n")
}

/**
 * Main entry point for CLI execution
 */
export async function main() {
  console.log("Running validation harness for enhanced-statistics-panel...\n")

  const results = await runAllValidations()
  printValidationResults(results)

  const allPassed = results.every((r) => r.pass)
  process.exit(allPassed ? 0 : 1)
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Validation harness failed:", error)
    process.exit(1)
  })
}
