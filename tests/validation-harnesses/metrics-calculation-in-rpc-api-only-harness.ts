/**
 * Validation Harness: metrics-calculation-in-rpc-api-only
 * 
 * Validates that template-metrics-client.ts is a thin HTTP client with:
 * - No calculation logic (arithmetic operations like /, *, Math.)
 * - Only HTTP/MCP client code (callMCPTool, log, error handling)
 * - No Redis writes
 * - No JSON file writes
 * - Single write path via MCP tools
 * 
 * This is a STATIC ANALYSIS harness - no runtime execution needed.
 */

import * as fs from "fs"
import * as path from "path"

export interface ValidationCase {
  name: string
  input: {
    filePath: string
  }
  expectedOutput: {
    hasCalculationLogic: boolean
    hasRedisWrites: boolean
    hasJsonFileWrites: boolean
    lineCount: number
    lineCountThreshold: number
    onlyContainsClientCode: boolean
  }
}

export interface ValidationResult {
  pass: boolean
  actual: {
    hasCalculationLogic: boolean
    calculationMatches: string[]
    hasRedisWrites: boolean
    redisWriteMatches: string[]
    hasJsonFileWrites: boolean
    jsonFileWriteMatches: string[]
    lineCount: number
    onlyContainsClientCode: boolean
    nonClientCodeMatches: string[]
  }
  expected: ValidationCase["expectedOutput"]
  message: string
}

/**
 * Run validation for a test case
 */
export function runValidation(testCase: ValidationCase): ValidationResult {
  const { filePath } = testCase.input
  const expected = testCase.expectedOutput

  // Read file content
  let content: string
  let lineCount: number
  
  try {
    content = fs.readFileSync(filePath, "utf-8")
    lineCount = content.split("\n").length
  } catch (error) {
    return {
      pass: false,
      actual: {
        hasCalculationLogic: false,
        calculationMatches: [],
        hasRedisWrites: false,
        redisWriteMatches: [],
        hasJsonFileWrites: false,
        jsonFileWriteMatches: [],
        lineCount: 0,
        onlyContainsClientCode: false,
        nonClientCodeMatches: [],
      },
      expected,
      message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // Check for calculation logic (arithmetic operations)
  // Exclude comments, string literals, and legitimate uses in logging
  const calculationPatterns = [
    /\b(\w+\s*\/\s*\w+)/g, // Division: x / y
    /\b(\w+\s*\*\s*\w+)/g, // Multiplication: x * y
    /\bMath\.\w+/g, // Math operations: Math.floor, Math.round, etc.
    /\bavg\w*\s*=/g, // Variable assignments like avgCost =
    /\bsum\w*\s*=/g, // Variable assignments like sumCost =
    /\btotal\w*\s*\+=/g, // Accumulation: total += x
  ]

  const calculationMatches: string[] = []
  
  // Remove comments and strings to avoid false positives
  const codeOnly = content
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
    .replace(/\/\/.*/g, "") // Remove line comments
    .replace(/"(?:[^"\\]|\\.)*"/g, '""') // Remove string literals
    .replace(/'(?:[^'\\]|\\.)*'/g, "''") // Remove string literals
    .replace(/`(?:[^`\\]|\\.)*`/g, "``") // Remove template literals

  for (const pattern of calculationPatterns) {
    const matches = codeOnly.match(pattern)
    if (matches) {
      calculationMatches.push(...matches)
    }
  }

  const hasCalculationLogic = calculationMatches.length > 0

  // Check for Redis writes
  const redisWritePatterns = [
    /redis\s*\.\s*set/gi,
    /redis\s*\.\s*hset/gi,
    /redis\s*\.\s*setex/gi,
    /redis\s*\.\s*hmset/gi,
  ]

  const redisWriteMatches: string[] = []
  for (const pattern of redisWritePatterns) {
    const matches = content.match(pattern)
    if (matches) {
      redisWriteMatches.push(...matches)
    }
  }

  const hasRedisWrites = redisWriteMatches.length > 0

  // Check for JSON file writes
  const jsonFileWritePatterns = [
    /fs\s*\.\s*writeFile.*\.json/gi,
    /JSON\s*\.\s*stringify.*writeFile/gi,
    /writeFileSync.*\.json/gi,
  ]

  const jsonFileWriteMatches: string[] = []
  for (const pattern of jsonFileWritePatterns) {
    const matches = content.match(pattern)
    if (matches) {
      jsonFileWriteMatches.push(...matches)
    }
  }

  const hasJsonFileWrites = jsonFileWriteMatches.length > 0

  // Check that file only contains client code patterns
  const clientCodePatterns = [
    /callMCPTool/g,
    /log\.\w+/g,
    /await.*MCP\./g,
    /try.*catch/g,
    /return.*null/g,
  ]

  const nonClientCodePatterns = [
    /class.*Calculator/gi,
    /function.*calculate\w*/gi,
    /function.*aggregate\w*/gi,
    /for\s*\(.*\)\s*{[\s\S]*?total\s*\+=/, // Loops with accumulation
  ]

  const nonClientCodeMatches: string[] = []
  for (const pattern of nonClientCodePatterns) {
    const matches = codeOnly.match(pattern)
    if (matches) {
      nonClientCodeMatches.push(...matches)
    }
  }

  const onlyContainsClientCode = nonClientCodeMatches.length === 0

  // Determine pass/fail
  const pass =
    hasCalculationLogic === expected.hasCalculationLogic &&
    hasRedisWrites === expected.hasRedisWrites &&
    hasJsonFileWrites === expected.hasJsonFileWrites &&
    lineCount <= expected.lineCountThreshold &&
    onlyContainsClientCode === expected.onlyContainsClientCode

  // Build message
  const issues: string[] = []
  
  if (hasCalculationLogic !== expected.hasCalculationLogic) {
    issues.push(
      `Expected hasCalculationLogic=${expected.hasCalculationLogic}, got ${hasCalculationLogic}. ` +
      `Found: ${calculationMatches.join(", ")}`
    )
  }
  
  if (hasRedisWrites !== expected.hasRedisWrites) {
    issues.push(
      `Expected hasRedisWrites=${expected.hasRedisWrites}, got ${hasRedisWrites}. ` +
      `Found: ${redisWriteMatches.join(", ")}`
    )
  }
  
  if (hasJsonFileWrites !== expected.hasJsonFileWrites) {
    issues.push(
      `Expected hasJsonFileWrites=${expected.hasJsonFileWrites}, got ${hasJsonFileWrites}. ` +
      `Found: ${jsonFileWriteMatches.join(", ")}`
    )
  }
  
  if (lineCount > expected.lineCountThreshold) {
    issues.push(
      `Line count ${lineCount} exceeds threshold ${expected.lineCountThreshold}. ` +
      `File should be a thin client.`
    )
  }
  
  if (onlyContainsClientCode !== expected.onlyContainsClientCode) {
    issues.push(
      `Expected onlyContainsClientCode=${expected.onlyContainsClientCode}, got ${onlyContainsClientCode}. ` +
      `Found non-client code: ${nonClientCodeMatches.join(", ")}`
    )
  }

  const message = pass
    ? "✅ PASS - File is a thin HTTP client with no calculations"
    : `❌ FAIL - ${issues.join(" | ")}`

  return {
    pass,
    actual: {
      hasCalculationLogic,
      calculationMatches,
      hasRedisWrites,
      redisWriteMatches,
      hasJsonFileWrites,
      jsonFileWriteMatches,
      lineCount,
      onlyContainsClientCode,
      nonClientCodeMatches,
    },
    expected,
    message,
  }
}

/**
 * Run all validation cases
 */
export function runAllValidations(testCases: ValidationCase[]): {
  passed: number
  failed: number
  results: ValidationResult[]
} {
  const results = testCases.map(runValidation)
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  return { passed, failed, results }
}

// CLI execution
if (require.main === module) {
  const testCases: ValidationCase[] = [
    {
      name: "template-metrics-client.ts has no calculations",
      input: {
        filePath: path.join(
          __dirname,
          "../../repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts"
        ),
      },
      expectedOutput: {
        hasCalculationLogic: false,
        hasRedisWrites: false,
        hasJsonFileWrites: false,
        lineCount: 301,
        lineCountThreshold: 400, // Thin client, but allows for multiple methods
        onlyContainsClientCode: true,
      },
    },
  ]

  console.log("Running validation: metrics-calculation-in-rpc-api-only\n")

  const { passed, failed, results } = runAllValidations(testCases)

  results.forEach((result, index) => {
    console.log(`\nTest Case ${index + 1}: ${testCases[index].name}`)
    console.log(result.message)
    
    if (!result.pass) {
      console.log("\nActual:")
      console.log(JSON.stringify(result.actual, null, 2))
      console.log("\nExpected:")
      console.log(JSON.stringify(result.expected, null, 2))
    }
  })

  console.log(`\n${"=".repeat(60)}`)
  console.log(`Total: ${testCases.length} | Passed: ${passed} | Failed: ${failed}`)
  console.log(`${"=".repeat(60)}\n`)

  process.exit(failed > 0 ? 1 : 0)
}
