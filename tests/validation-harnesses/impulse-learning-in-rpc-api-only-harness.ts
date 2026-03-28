/**
 * Validation Harness: Impulse Learning in RPC API Only
 * 
 * Validates that impulse learning (pattern extraction, quality scoring, learning buffer management)
 * exists ONLY in metabob-rpc-api. metabob-opencode must only collect raw data and send to rpc-api.
 * 
 * Expected Behavior:
 * - opencode/impulse-learning.ts: <50 lines OR deleted
 * - No normalizePattern(), calculateResponseQuality(), trackImpulseUsage() in opencode
 * - RPC API has POST /v1/learning/record-turn endpoint
 * - RPC API has pattern extraction, quality scoring, usage tracking logic
 * 
 * This harness runs WITHOUT LLM - pure static analysis.
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
  testType: "line-count" | "grep" | "endpoint-check" | "function-check"
  config?: {
    file?: string
    pattern?: string
    endpoint?: string
    function?: string
    maxLines?: number
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
 * Validation Case 1: impulse-learning.ts line count must be <50 lines or deleted
 */
export async function validateImpulseLearningLineCount(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts",
    maxLines: 50,
  }

  try {
    const filePath = expected.file
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        pass: true,
        actual: { exists: false, lineCount: 0 },
        expected,
        reason: "impulse-learning.ts deleted (COMPLIANT - preferred outcome)",
        timestamp: Date.now(),
      }
    }

    // Count lines
    const cmd = `wc -l ${filePath}`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const lineCount = parseInt(output.split(" ")[0], 10)

    const pass = lineCount < expected.maxLines

    return {
      pass,
      actual: { exists: true, lineCount, file: filePath },
      expected,
      reason: pass
        ? `impulse-learning.ts has ${lineCount} lines (target: <${expected.maxLines})`
        : `impulse-learning.ts has ${lineCount} lines (expected <${expected.maxLines})`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to check impulse-learning.ts line count",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 2: No normalizePattern() in opencode
 */
export async function validateNoNormalizePatternInOpencode(): Promise<ValidationResult> {
  const expected = {
    function: "normalizePattern",
    repo: "repos/metabob-opencode",
    context: "impulse learning",
    maxMatches: 0,
  }

  try {
    // Search for normalizePattern in impulse-learning.ts and related files
    const cmd = `cd ${expected.repo} && grep -rn 'normalizePattern' packages/opencode/src/session/impulse-learning.ts packages/opencode/src/util/metabob.ts 2>/dev/null | wc -l`
    const output = execSync(cmd, { encoding: "utf-8", shell: "/bin/bash" }).trim()
    const matchCount = parseInt(output, 10)

    const pass = matchCount === expected.maxMatches

    return {
      pass,
      actual: { matchCount, function: expected.function },
      expected,
      reason: pass
        ? "No normalizePattern() found in opencode impulse learning"
        : `Found ${matchCount} normalizePattern() references in opencode (expected 0)`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to search for normalizePattern in opencode",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 3: No calculateResponseQuality() in opencode impulse learning
 */
export async function validateNoCalculateQualityInOpencode(): Promise<ValidationResult> {
  const expected = {
    function: "calculateResponseQuality",
    repo: "repos/metabob-opencode",
    context: "impulse learning (excluding template-quality-score)",
    maxMatches: 0,
  }

  try {
    // Search only in impulse-learning.ts and metabob.ts (not template-quality-score.ts)
    const cmd = `cd ${expected.repo} && grep -rn 'calculateResponseQuality\\|calculate_quality' packages/opencode/src/session/impulse-learning.ts packages/opencode/src/util/metabob.ts 2>/dev/null | wc -l`
    const output = execSync(cmd, { encoding: "utf-8", shell: "/bin/bash" }).trim()
    const matchCount = parseInt(output, 10)

    const pass = matchCount === expected.maxMatches

    return {
      pass,
      actual: { matchCount, function: expected.function },
      expected,
      reason: pass
        ? "No calculateResponseQuality() found in opencode impulse learning"
        : `Found ${matchCount} calculateResponseQuality() references in impulse learning (expected 0)`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to search for calculateResponseQuality in opencode",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 4: No trackImpulseUsage() in opencode impulse learning
 */
export async function validateNoTrackUsageInOpencode(): Promise<ValidationResult> {
  const expected = {
    function: "trackImpulseUsage",
    repo: "repos/metabob-opencode",
    context: "impulse learning (excluding config schemas)",
    maxMatches: 0,
  }

  try {
    // Search only in impulse-learning.ts and metabob.ts (not config files)
    const cmd = `cd ${expected.repo} && grep -rn 'trackImpulseUsage\\|function trackUsage\\|const trackUsage' packages/opencode/src/session/impulse-learning.ts packages/opencode/src/util/metabob.ts 2>/dev/null | wc -l`
    const output = execSync(cmd, { encoding: "utf-8", shell: "/bin/bash" }).trim()
    const matchCount = parseInt(output, 10)

    const pass = matchCount === expected.maxMatches

    return {
      pass,
      actual: { matchCount, function: expected.function },
      expected,
      reason: pass
        ? "No trackImpulseUsage() found in opencode impulse learning"
        : `Found ${matchCount} trackImpulseUsage() references in impulse learning (expected 0)`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to search for trackImpulseUsage in opencode",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 5: RPC API has POST /record-turn endpoint
 */
export async function validateRecordTurnEndpoint(): Promise<ValidationResult> {
  const expected = {
    endpoint: "POST /record-turn",
    file: "repos/metabob-rpc-api/server/routes/learning_loop.py",
    pattern: '@router.post.*record-turn',
  }

  try {
    const cmd = `grep -n '@router.post.*record-turn\\|def record_turn_learning' ${expected.file}`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const lines = output.split("\n")

    const hasEndpoint = lines.length > 0
    const pass = hasEndpoint

    return {
      pass,
      actual: { hasEndpoint, lines: lines.length, sample: lines[0] },
      expected,
      reason: pass
        ? `Found ${expected.endpoint} endpoint in rpc-api`
        : "POST /record-turn endpoint not found in rpc-api",
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to find POST /record-turn endpoint",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 6: RPC API has normalize_pattern() function
 */
export async function validateNormalizePatternInRpcApi(): Promise<ValidationResult> {
  const expected = {
    function: "normalize_pattern",
    file: "repos/metabob-rpc-api/server/db/operations/impulse_learning.py",
  }

  try {
    const cmd = `grep -n 'def normalize_pattern' ${expected.file}`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const hasFunction = output.length > 0

    const pass = hasFunction

    return {
      pass,
      actual: { hasFunction, location: output },
      expected,
      reason: pass
        ? "normalize_pattern() found in rpc-api"
        : "normalize_pattern() not found in rpc-api",
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to find normalize_pattern() in rpc-api",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 7: RPC API has calculate_quality() function
 */
export async function validateCalculateQualityInRpcApi(): Promise<ValidationResult> {
  const expected = {
    function: "calculate_quality",
    file: "repos/metabob-rpc-api/server/db/operations/impulse_learning.py",
  }

  try {
    const cmd = `grep -n 'def calculate_quality' ${expected.file}`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const hasFunction = output.length > 0

    const pass = hasFunction

    return {
      pass,
      actual: { hasFunction, location: output },
      expected,
      reason: pass
        ? "calculate_quality() found in rpc-api"
        : "calculate_quality() not found in rpc-api",
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to find calculate_quality() in rpc-api",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 8: RPC API has track_usage() function
 */
export async function validateTrackUsageInRpcApi(): Promise<ValidationResult> {
  const expected = {
    function: "track_usage",
    file: "repos/metabob-rpc-api/server/db/operations/impulse_learning.py",
  }

  try {
    const cmd = `grep -n 'def track_usage' ${expected.file}`
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const hasFunction = output.length > 0

    const pass = hasFunction

    return {
      pass,
      actual: { hasFunction, location: output },
      expected,
      reason: pass
        ? "track_usage() found in rpc-api"
        : "track_usage() not found in rpc-api",
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to find track_usage() in rpc-api",
      timestamp: Date.now(),
    }
  }
}

/**
 * Run all validation cases
 */
export async function runValidation(): Promise<{
  pass: boolean
  results: ValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}> {
  console.log("🔍 Running Impulse Learning in RPC API Only Validation Harness...\n")

  const results: ValidationResult[] = []

  // Run all validation cases
  console.log("📋 Case 1: Checking impulse-learning.ts line count...")
  results.push(await validateImpulseLearningLineCount())

  console.log("📋 Case 2: Checking no normalizePattern() in opencode...")
  results.push(await validateNoNormalizePatternInOpencode())

  console.log("📋 Case 3: Checking no calculateResponseQuality() in opencode...")
  results.push(await validateNoCalculateQualityInOpencode())

  console.log("📋 Case 4: Checking no trackImpulseUsage() in opencode...")
  results.push(await validateNoTrackUsageInOpencode())

  console.log("📋 Case 5: Checking POST /record-turn endpoint in rpc-api...")
  results.push(await validateRecordTurnEndpoint())

  console.log("📋 Case 6: Checking normalize_pattern() in rpc-api...")
  results.push(await validateNormalizePatternInRpcApi())

  console.log("📋 Case 7: Checking calculate_quality() in rpc-api...")
  results.push(await validateCalculateQualityInRpcApi())

  console.log("📋 Case 8: Checking track_usage() in rpc-api...")
  results.push(await validateTrackUsageInRpcApi())

  // Calculate summary
  const passed = results.filter((r) => r.pass).length
  const failed = results.length - passed
  const overallPass = failed === 0

  const summary = {
    total: results.length,
    passed,
    failed,
  }

  // Print results
  console.log("\n" + "=".repeat(80))
  console.log("📊 Validation Results:")
  console.log("=".repeat(80))

  results.forEach((result, index) => {
    const status = result.pass ? "✅ PASS" : "❌ FAIL"
    console.log(`\n${status} - Case ${index + 1}: ${result.reason}`)
    if (!result.pass) {
      console.log(`  Expected:`, JSON.stringify(result.expected, null, 2))
      console.log(`  Actual:`, JSON.stringify(result.actual, null, 2))
    }
  })

  console.log("\n" + "=".repeat(80))
  console.log(`📈 Summary: ${passed}/${summary.total} checks passed`)
  console.log("=".repeat(80))

  if (overallPass) {
    console.log("✅ VALIDATION PASSED: Impulse learning correctly isolated in rpc-api")
  } else {
    console.log("❌ VALIDATION FAILED: Architectural boundary violated")
  }

  return {
    pass: overallPass,
    results,
    summary,
  }
}

/**
 * Main entry point
 */
// @ts-ignore - Node.js runtime check
if (typeof require !== 'undefined' && require.main === module) {
  runValidation()
    .then((result) => {
      // @ts-ignore - Node.js process
      process.exit(result.pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("❌ Validation harness error:", error)
      // @ts-ignore - Node.js process
      process.exit(1)
    })
}
