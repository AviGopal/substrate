/**
 * Validation Harness: metrics-calculation-in-rpc-api-only
 *
 * Specification: Metrics calculations (success rate, quality score, averaging) must ONLY
 * exist in metabob-rpc-api. metabob-opencode template-metrics-client must be a thin HTTP
 * client with no calculations.
 *
 * Validation Strategy:
 * 1. Static analysis of template-metrics-client.ts
 * 2. Search for calculation patterns (/, *, Math.)
 * 3. Search for Redis writes (redis.set, redis.hset)
 * 4. Search for JSON file writes (fs.writeFile, JSON.stringify)
 * 5. Verify file size is reasonable for thin client (<400 lines)
 * 6. Verify only contains HTTP client code (callMCPTool)
 *
 * This harness performs STATIC ANALYSIS only - no runtime execution needed.
 * It can run without LLM and returns deterministic PASS/FAIL results.
 */

export interface ValidationResult {
  pass: boolean
  checks: CheckResult[]
  summary: string
  violations: string[]
}

export interface CheckResult {
  name: string
  pass: boolean
  actual: string | number | boolean
  expected: string | number | boolean
  details?: string
}

const TARGET_FILE = "repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts"
const MAX_LINES = 400 // Thin client threshold

/**
 * Run validation harness for metrics-calculation-in-rpc-api-only specification
 */
export async function runValidation(repositoryRoot?: string): Promise<ValidationResult> {
  const repoRoot = repositoryRoot || Bun.cwd
  const filePath = `${repoRoot}/${TARGET_FILE}`

  // Check if file exists
  const file = Bun.file(filePath)
  const exists = await file.exists()
  
  if (!exists) {
    return {
      pass: false,
      checks: [],
      summary: `File not found: ${TARGET_FILE}`,
      violations: [`File not found: ${TARGET_FILE}`],
    }
  }

  // Read file content
  const content = await file.text()
  const lines = content.split("\n")

  const checks: CheckResult[] = []
  const violations: string[] = []

  // Check 1: No arithmetic operations (division, multiplication)
  const arithmeticPatterns = [
    /\s+\/\s+\w+/g, // division: something / something
    /\s+\*\s+\w+/g, // multiplication: something * something
    /Math\./g, // Math operations
  ]

  let arithmeticMatches: string[] = []
  for (const pattern of arithmeticPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      // Filter out comments and strings
      const realMatches = matches.filter((match: string) => {
        const lineWithMatch = lines.find((line: string) => line.includes(match))
        if (!lineWithMatch) return false
        const trimmed = lineWithMatch.trim()
        // Ignore comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false
        // Ignore string literals
        if (trimmed.match(/["'`].*["'`]/)) return false
        return true
      })
      arithmeticMatches = arithmeticMatches.concat(realMatches)
    }
  }

  checks.push({
    name: "No arithmetic operations",
    pass: arithmeticMatches.length === 0,
    actual: arithmeticMatches.length > 0 ? `Found ${arithmeticMatches.length} matches` : "None found",
    expected: "None found",
    details: arithmeticMatches.length > 0 ? `Matches: ${arithmeticMatches.join(", ")}` : undefined,
  })

  if (arithmeticMatches.length > 0) {
    violations.push(
      `Found ${arithmeticMatches.length} arithmetic operation(s): ${arithmeticMatches.join(", ")}`,
    )
  }

  // Check 2: No Redis writes
  const redisPatterns = [/redis\.set/gi, /redis\.hset/gi, /redis\.zadd/gi, /redis\.hmset/gi]

  let redisMatches: string[] = []
  for (const pattern of redisPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      redisMatches = redisMatches.concat(matches)
    }
  }

  checks.push({
    name: "No Redis writes",
    pass: redisMatches.length === 0,
    actual: redisMatches.length > 0 ? `Found ${redisMatches.length} Redis writes` : "None found",
    expected: "None found",
    details: redisMatches.length > 0 ? `Matches: ${redisMatches.join(", ")}` : undefined,
  })

  if (redisMatches.length > 0) {
    violations.push(`Found ${redisMatches.length} Redis write(s): ${redisMatches.join(", ")}`)
  }

  // Check 3: No JSON file writes
  const fileWritePatterns = [
    /fs\.writeFile/gi,
    /fs\.writeFileSync/gi,
    /writeFile\(/gi,
    /JSON\.stringify.*writeFile/gi,
  ]

  let fileWriteMatches: string[] = []
  for (const pattern of fileWritePatterns) {
    const matches = content.match(pattern)
    if (matches) {
      fileWriteMatches = fileWriteMatches.concat(matches)
    }
  }

  checks.push({
    name: "No JSON file writes",
    pass: fileWriteMatches.length === 0,
    actual:
      fileWriteMatches.length > 0 ? `Found ${fileWriteMatches.length} file writes` : "None found",
    expected: "None found",
    details: fileWriteMatches.length > 0 ? `Matches: ${fileWriteMatches.join(", ")}` : undefined,
  })

  if (fileWriteMatches.length > 0) {
    violations.push(`Found ${fileWriteMatches.length} file write(s): ${fileWriteMatches.join(", ")}`)
  }

  // Check 4: File size is reasonable (thin client)
  const lineCount = lines.length

  checks.push({
    name: "Line count within thin client threshold",
    pass: lineCount <= MAX_LINES,
    actual: lineCount,
    expected: `<= ${MAX_LINES}`,
    details: lineCount > MAX_LINES ? `File is too large for a thin client` : undefined,
  })

  if (lineCount > MAX_LINES) {
    violations.push(`File has ${lineCount} lines, exceeds thin client threshold of ${MAX_LINES}`)
  }

  // Check 5: Only contains client code (callMCPTool)
  const hasMCPCalls = content.includes("callMCPTool")
  const hasHTTPClient = content.includes("metabob_post_activity_result") || content.includes("MCP")

  checks.push({
    name: "Contains only HTTP client code",
    pass: hasMCPCalls && hasHTTPClient,
    actual: hasMCPCalls && hasHTTPClient ? "HTTP client code present" : "Missing HTTP client code",
    expected: "HTTP client code present",
    details:
      !hasMCPCalls || !hasHTTPClient
        ? `Missing MCP calls or HTTP client references`
        : "callMCPTool and MCP references found",
  })

  if (!hasMCPCalls || !hasHTTPClient) {
    violations.push("File does not contain expected HTTP client code (callMCPTool, MCP)")
  }

  // Check 6: No calculation keywords
  const calculationKeywords = [
    "successRate",
    "success_rate",
    "avgCost",
    "avg_cost",
    "avgDuration",
    "avg_duration",
    "qualityScore",
    "quality_score",
  ]

  const calculationMatches: string[] = []
  for (const keyword of calculationKeywords) {
    // Look for assignment patterns like: successRate = ...
    const assignmentPattern = new RegExp(`${keyword}\\s*=\\s*`, "gi")
    const matches = content.match(assignmentPattern)
    if (matches) {
      // Filter out comments and type definitions
      const realMatches = matches.filter((match: string) => {
        const lineWithMatch = lines.find((line: string) => line.includes(match))
        if (!lineWithMatch) return false
        const trimmed = lineWithMatch.trim()
        // Ignore comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false
        // Ignore type definitions (: or interface)
        if (trimmed.includes(":") && !trimmed.includes("=")) return false
        return true
      })
      calculationMatches.push(...realMatches)
    }
  }

  checks.push({
    name: "No calculation assignments",
    pass: calculationMatches.length === 0,
    actual:
      calculationMatches.length > 0
        ? `Found ${calculationMatches.length} calculation assignments`
        : "None found",
    expected: "None found",
    details:
      calculationMatches.length > 0 ? `Matches: ${calculationMatches.join(", ")}` : undefined,
  })

  if (calculationMatches.length > 0) {
    violations.push(
      `Found ${calculationMatches.length} calculation assignment(s): ${calculationMatches.join(", ")}`,
    )
  }

  // Overall result
  const allChecksPassed = checks.every((check) => check.pass)

  return {
    pass: allChecksPassed,
    checks,
    summary: allChecksPassed
      ? `✅ PASS: All ${checks.length} checks passed. File is compliant with metrics-calculation-in-rpc-api-only specification.`
      : `❌ FAIL: ${violations.length} violation(s) found. File contains calculation logic that should only exist in metabob-rpc-api.`,
    violations,
  }
}

/**
 * CLI entry point for standalone execution
 */
if (import.meta.main) {
  runValidation()
    .then((result) => {
      console.log("\n" + "=".repeat(80))
      console.log("Validation Harness: metrics-calculation-in-rpc-api-only")
      console.log("=".repeat(80) + "\n")

      console.log(result.summary + "\n")

      console.log("Checks:")
      for (const check of result.checks) {
        const status = check.pass ? "✅ PASS" : "❌ FAIL"
        console.log(`  ${status} - ${check.name}`)
        console.log(`    Expected: ${check.expected}`)
        console.log(`    Actual:   ${check.actual}`)
        if (check.details) {
          console.log(`    Details:  ${check.details}`)
        }
        console.log()
      }

      if (result.violations.length > 0) {
        console.log("Violations:")
        for (const violation of result.violations) {
          console.log(`  - ${violation}`)
        }
        console.log()
      }

      console.log("=".repeat(80) + "\n")

      process.exit(result.pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("Validation harness failed:", error)
      process.exit(1)
    })
}
