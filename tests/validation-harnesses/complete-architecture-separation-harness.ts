/**
 * Validation Harness: Complete Architecture Separation
 * 
 * Validates the three-component architecture has clean separation:
 * - metabob-opencode: Execution + Coordination (ZERO ML logic)
 * - metabob-cli: Data Collection + Enrichment + Gateway (ZERO ML logic)
 * - metabob-rpc-api: ML Training + Metrics + Storage (ALL ML logic)
 * 
 * This harness runs WITHOUT LLM - pure static analysis and integration tests.
 */

// @ts-ignore - Node.js built-in modules
import * as fs from "fs"
// @ts-ignore - Node.js built-in modules  
import { execSync } from "child_process"

export interface ValidationCase {
  id: string
  input: ValidationInput
  expectedOutput: ValidationOutput
}

export interface ValidationInput {
  testType: "grep" | "api-contract" | "surrealdb-schema" | "integration" | "mcp-proxy"
  config?: {
    repo?: string
    pattern?: string
    file?: string
    endpoint?: string
    table?: string
  }
}

export interface ValidationOutput {
  pass: boolean
  actual?: any
  expected?: any
  reason?: string
}

export interface ValidationResult {
  pass: boolean
  actual: any
  expected: any
  reason?: string
  timestamp: number
}

/**
 * Validation Case 1: Zero ML keywords in metabob-opencode
 */
export async function validateOpencodeMLKeywords(): Promise<ValidationResult> {
  const expected = {
    pattern: "thompson|beta_distribution|sampleBeta|sampleGamma|pattern_extraction",
    allowedReferences: ["thompsonSampling:", "// Reference", "Thompson Sampling delegated"],
    maxMatches: 0,
  }

  try {
    const cmd = `cd repos/metabob-opencode && grep -r 'thompson\\|beta_distribution\\|sampleBeta\\|sampleGamma\\|pattern_extraction' packages/opencode/src --include='*.ts' | grep -v 'thompsonSampling:' | grep -v '// Reference' | grep -v 'Thompson Sampling delegated' | wc -l`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const matchCount = parseInt(output, 10)

    const pass = matchCount === expected.maxMatches

    return {
      pass,
      actual: { matchCount, pattern: expected.pattern },
      expected,
      reason: pass
        ? "Zero ML keywords found in opencode (only metadata references)"
        : `Found ${matchCount} ML keyword matches in opencode (expected 0)`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to search for ML keywords in opencode",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 2: Zero training logic in metabob-cli
 */
export async function validateCLITrainingLogic(): Promise<ValidationResult> {
  const expected = {
    pattern: "train|fit_model|sampleBeta|sampleGamma",
    maxMatches: 0,
  }

  try {
    const cmd = `cd repos/metabob-cli && grep -r 'train\\|fit_model\\|sampleBeta\\|sampleGamma' src --include='*.py' | grep -v 'constraints' | wc -l`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const matchCount = parseInt(output, 10)

    const pass = matchCount === expected.maxMatches

    return {
      pass,
      actual: { matchCount, pattern: expected.pattern },
      expected,
      reason: pass
        ? "Zero training logic found in CLI"
        : `Found ${matchCount} training logic matches in CLI (expected 0)`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to search for training logic in CLI",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 3: All Thompson Sampling in metabob-rpc-api
 */
export async function validateRPCAPIThompsonSampling(): Promise<ValidationResult> {
  const expected = {
    pattern: "select_variant_thompson_sampling|thompson_alpha|thompson_beta",
    minMatches: 40, // Should be >40 references in RPC API
  }

  try {
    const cmd = `cd repos/metabob-rpc-api && grep -r 'select_variant_thompson_sampling\\|thompson_alpha\\|thompson_beta' server --include='*.py' | wc -l`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const matchCount = parseInt(output, 10)

    const pass = matchCount >= expected.minMatches

    return {
      pass,
      actual: { matchCount, pattern: expected.pattern },
      expected,
      reason: pass
        ? `Found ${matchCount} Thompson Sampling references in RPC API (all ML logic correctly located)`
        : `Found only ${matchCount} Thompson Sampling references in RPC API (expected >${expected.minMatches})`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to search for Thompson Sampling in RPC API",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 4: Data flow via HTTP (CLI → RPC API)
 */
export async function validateDataFlowHTTP(): Promise<ValidationResult> {
  const expected = {
    pattern: "http://localhost:8080|METABOB_RPC_API_URL|rpc.*api",
    minMatches: 40, // Should be >40 HTTP calls to RPC API
  }

  try {
    const cmd = `cd repos/metabob-cli && grep -r 'http://localhost:8080\\|METABOB_RPC_API_URL\\|rpc.*api' src --include='*.py' | wc -l`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const matchCount = parseInt(output, 10)

    const pass = matchCount >= expected.minMatches

    return {
      pass,
      actual: { matchCount, pattern: expected.pattern },
      expected,
      reason: pass
        ? `Found ${matchCount} HTTP calls to RPC API (CLI correctly acts as gateway)`
        : `Found only ${matchCount} HTTP calls to RPC API (expected >${expected.minMatches})`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to search for HTTP calls in CLI",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 5: thompson-sampler.ts file deleted
 */
export async function validateThompsonSamplerDeleted(): Promise<ValidationResult> {
  const expected = {
    fileExists: false,
    filePath: "repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler.ts",
  }

  try {
    const fileExists = fs.existsSync(expected.filePath)
    const pass = fileExists === expected.fileExists

    return {
      pass,
      actual: { fileExists, filePath: expected.filePath },
      expected,
      reason: pass
        ? "thompson-sampler.ts correctly deleted from opencode"
        : "thompson-sampler.ts still exists in opencode (should be deleted)",
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to check thompson-sampler.ts existence",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 6: template-selector.ts delegates to RPC API
 */
export async function validateTemplateSelectorDelegation(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-opencode/packages/opencode/src/session/template-selector.ts",
    requiredStrings: [
      "delegating Thompson Sampling to metabob-rpc-api",
      "POST /v2/activities/templates/{id}/select",
      "Thompson Sampling (Beta distribution sampling) now happens in metabob-rpc-api",
    ],
  }

  try {
    const fileContent = fs.readFileSync(expected.file, "utf-8")
    const missingStrings = expected.requiredStrings.filter((str) => !fileContent.includes(str))
    const pass = missingStrings.length === 0

    return {
      pass,
      actual: {
        file: expected.file,
        missingStrings,
        foundCount: expected.requiredStrings.length - missingStrings.length,
      },
      expected,
      reason: pass
        ? "template-selector.ts correctly delegates Thompson Sampling to RPC API"
        : `template-selector.ts missing required delegation strings: ${missingStrings.join(", ")}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to read template-selector.ts",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 7: activity.ts has no Thompson Sampling calculations
 */
export async function validateActivityNoThompsonCalculations(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-opencode/packages/opencode/src/tool/activity.ts",
    forbiddenStrings: [
      "const thompsonAlpha = successCount + 1",
      "const thompsonBeta = failureCount + 1",
      "thompsonAlpha / (thompsonAlpha + thompsonBeta)",
    ],
  }

  try {
    const fileContent = fs.readFileSync(expected.file, "utf-8")
    const foundStrings = expected.forbiddenStrings.filter((str) => fileContent.includes(str))
    const pass = foundStrings.length === 0

    return {
      pass,
      actual: {
        file: expected.file,
        foundStrings,
        forbiddenCount: expected.forbiddenStrings.length,
      },
      expected,
      reason: pass
        ? "activity.ts correctly has no Thompson Sampling calculations"
        : `activity.ts still contains forbidden Thompson Sampling calculations: ${foundStrings.join(", ")}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to read activity.ts",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 8: MCP tools in CLI are pure proxies
 */
export async function validateMCPToolsProxy(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-cli/src/metabob_cli/mcp/tools.py",
    requiredPattern: "call_api",
    minOccurrences: 5, // Should have multiple call_api invocations
  }

  try {
    const fileContent = fs.readFileSync(expected.file, "utf-8")
    const matches = fileContent.match(/call_api/g)
    const occurrences = matches ? matches.length : 0
    const pass = occurrences >= expected.minOccurrences

    return {
      pass,
      actual: {
        file: expected.file,
        occurrences,
        pattern: expected.requiredPattern,
      },
      expected,
      reason: pass
        ? `MCP tools correctly use call_api proxy (${occurrences} occurrences)`
        : `MCP tools have insufficient call_api usage (${occurrences} < ${expected.minOccurrences})`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to read tools.py",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 9: RPC API has select_variant_thompson_sampling endpoint
 */
export async function validateRPCAPIEndpoint(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-rpc-api/server/actions/activity.py",
    requiredStrings: [
      "def select_variant_thompson_sampling",
      "sample_beta",
      "alpha",
      "beta",
    ],
  }

  try {
    if (!fs.existsSync(expected.file)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        reason: `RPC API file not found: ${expected.file}`,
        timestamp: Date.now(),
      }
    }

    const fileContent = fs.readFileSync(expected.file, "utf-8")
    const missingStrings = expected.requiredStrings.filter((str) => !fileContent.includes(str))
    const pass = missingStrings.length === 0

    return {
      pass,
      actual: {
        file: expected.file,
        missingStrings,
        foundCount: expected.requiredStrings.length - missingStrings.length,
      },
      expected,
      reason: pass
        ? "RPC API correctly implements select_variant_thompson_sampling"
        : `RPC API missing required Thompson Sampling implementation: ${missingStrings.join(", ")}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to read activity.py in RPC API",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 10: SurrealDB schema has required tables
 */
export async function validateSurrealDBSchema(): Promise<ValidationResult> {
  const expected = {
    file: "initialize-surrealdb-schema.sql",
    requiredTables: [
      "activity_execution",
      "template_metrics",
      "activity_template",
    ],
  }

  try {
    if (!fs.existsSync(expected.file)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        reason: `SurrealDB schema file not found: ${expected.file}`,
        timestamp: Date.now(),
      }
    }

    const fileContent = fs.readFileSync(expected.file, "utf-8")
    const missingTables = expected.requiredTables.filter(
      (table) => !fileContent.includes(`DEFINE TABLE ${table}`) && !fileContent.includes(`CREATE TABLE ${table}`)
    )
    const pass = missingTables.length === 0

    return {
      pass,
      actual: {
        file: expected.file,
        missingTables,
        foundCount: expected.requiredTables.length - missingTables.length,
      },
      expected,
      reason: pass
        ? "SurrealDB schema has all required tables"
        : `SurrealDB schema missing required tables: ${missingTables.join(", ")}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to read SurrealDB schema file",
      timestamp: Date.now(),
    }
  }
}

/**
 * Main validation function - runs all validation cases
 */
export async function runValidation(): Promise<{
  overallPass: boolean
  results: Record<string, ValidationResult>
  summary: {
    total: number
    passed: number
    failed: number
  }
}> {
  const results: Record<string, ValidationResult> = {}

  console.log("Running Complete Architecture Separation Validation Harness...")
  console.log("=" .repeat(80))

  // Run all validation cases
  const validations = [
    { name: "opencode-ml-keywords", fn: validateOpencodeMLKeywords },
    { name: "cli-training-logic", fn: validateCLITrainingLogic },
    { name: "rpc-api-thompson-sampling", fn: validateRPCAPIThompsonSampling },
    { name: "data-flow-http", fn: validateDataFlowHTTP },
    { name: "thompson-sampler-deleted", fn: validateThompsonSamplerDeleted },
    { name: "template-selector-delegation", fn: validateTemplateSelectorDelegation },
    { name: "activity-no-thompson-calculations", fn: validateActivityNoThompsonCalculations },
    { name: "mcp-tools-proxy", fn: validateMCPToolsProxy },
    { name: "rpc-api-endpoint", fn: validateRPCAPIEndpoint },
    { name: "surrealdb-schema", fn: validateSurrealDBSchema },
  ]

  for (const { name, fn } of validations) {
    console.log(`\nRunning: ${name}...`)
    try {
      const result = await fn()
      results[name] = result
      console.log(`  Result: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
      console.log(`  Reason: ${result.reason}`)
    } catch (error) {
      results[name] = {
        pass: false,
        actual: { error: String(error) },
        expected: {},
        reason: `Validation threw exception: ${error}`,
        timestamp: Date.now(),
      }
      console.log(`  Result: ❌ FAIL (exception)`)
      console.log(`  Error: ${error}`)
    }
  }

  const passed = Object.values(results).filter((r) => r.pass).length
  const failed = Object.values(results).filter((r) => !r.pass).length
  const total = validations.length
  const overallPass = failed === 0

  console.log("\n" + "=".repeat(80))
  console.log(`\nValidation Summary:`)
  console.log(`  Total: ${total}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Overall: ${overallPass ? "✅ PASS" : "❌ FAIL"}`)
  console.log("=" .repeat(80))

  return {
    overallPass,
    results,
    summary: { total, passed, failed },
  }
}

/**
 * Run validation if executed directly
 */
// @ts-ignore - Module detection
if (typeof require !== "undefined" && require.main === module) {
  runValidation()
    .then((result) => {
      // @ts-ignore - Node.js process
      process.exit(result.overallPass ? 0 : 1)
    })
    .catch((error) => {
      console.error("Validation harness failed:", error)
      // @ts-ignore - Node.js process
      process.exit(1)
    })
}
