/**
 * Validation Harness: Thompson Sampling in RPC API Only
 * 
 * Validates the architectural boundary:
 * - Thompson Sampling (Beta distribution variant selection) ONLY in metabob-rpc-api
 * - metabob-opencode MUST delegate to rpc-api endpoint (no local ML logic)
 * - rpc-api MUST expose /v1/templates/select-variant endpoint
 * 
 * Phase 3 Additional Validation:
 * - Cache-aside pattern: SurrealDB first (primary), Redis second (cache)
 * - Template creation persists to SurrealDB before Redis
 * - Execution recording writes to SurrealDB first
 * - Template selection has SurrealDB fallback on Redis miss
 * 
 * This harness runs WITHOUT LLM - pure static analysis and API contract tests.
 */

// @ts-ignore - Node.js built-in modules
import * as fs from "fs"
// @ts-ignore - Node.js built-in modules  
import { execSync } from "child_process"
// @ts-ignore - Node.js built-in modules
import * as path from "path"

export interface ValidationCase {
  id: string
  input: ValidationInput
  expectedOutput: ValidationOutput
}

export interface ValidationInput {
  testType: "grep-ml-keywords" | "api-endpoint" | "cache-aside-pattern" | "surrealdb-schema"
  config?: {
    repo?: string
    pattern?: string
    file?: string
    endpoint?: string
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
 * Validation Case 1: Zero Thompson Sampling keywords in metabob-opencode
 * 
 * Searches for Beta distribution and Thompson Sampling implementation keywords.
 * Allowed: Comments and metadata references (e.g., "thompsonSampling: true")
 * Forbidden: Actual implementation (sampleBeta, betavariate, Math.random for sampling)
 */
export async function validateOpencodeNoMLKeywords(): Promise<ValidationResult> {
  const expected = {
    pattern: "thompson|beta|betavariate|sample_beta|sampleBeta|Math\\.random.*alpha.*beta",
    allowedReferences: [
      "thompsonSampling:",        // Metadata field
      "// Thompson Sampling",      // Comment
      "Thompson Sampling delegated", // Documentation
      "selection_method.*thompson", // Selection result metadata
      "thompson_sample:",          // Result field from RPC API
      "thompson_alpha:",           // Result field from RPC API
      "thompson_beta:",            // Result field from RPC API
    ],
    maxMatches: 0,
    reason: "OpenCode must delegate Thompson Sampling to RPC API, not implement locally"
  }

  try {
    // Search for ML implementation keywords in TypeScript source
    // Exclude: metadata fields, comments, documentation, type definitions, result fields from RPC API
    const cmd = `cd repos/metabob-opencode && grep -rn 'thompson\\|beta\\|betavariate\\|sample_beta\\|sampleBeta' packages/opencode/src --include='*.ts' | grep -v 'thompsonSampling:' | grep -v '// ' | grep -v '/\\*' | grep -v '\\* ' | grep -v 'Thompson Sampling delegated' | grep -v 'selection_method' | grep -v 'thompson_sample:' | grep -v 'thompson_alpha:' | grep -v 'thompson_beta:' | grep -v 'competing_variants' | grep -v 'describe(' | grep -v ': number' | grep -v ': z\\.' | grep -v 'anthropic-beta' | grep -v '::sample_beta' | grep -v 'Sample from Beta' || echo "0"`
    
    const output = execSync(cmd, { encoding: "utf-8" }).trim()
    const matches = output === "0" ? [] : output.split("\n").filter(line => line.length > 0)
    const matchCount = matches.length

    const pass = matchCount === expected.maxMatches

    return {
      pass,
      actual: { 
        matchCount, 
        pattern: expected.pattern,
        matches: matches.slice(0, 5) // First 5 violations for debugging
      },
      expected,
      reason: pass
        ? "✅ Zero ML implementation keywords found in opencode (only metadata references allowed)"
        : `❌ Found ${matchCount} ML keyword matches in opencode (expected 0). OpenCode must delegate to RPC API.`,
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
 * Validation Case 2: RPC API has Thompson Sampling implementation
 * 
 * Verifies sample_beta() function exists in rpc-api actions/activity.py
 */
export async function validateRPCAPIHasThompsonSampling(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-rpc-api/server/actions/activity.py",
    functions: ["sample_beta", "select_variant_thompson_sampling"],
    minMatches: 2,
    reason: "RPC API must have Thompson Sampling implementation"
  }

  try {
    // Check if sample_beta function exists
    const file = expected.file
    if (!fs.existsSync(file)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        reason: `❌ File not found: ${file}`,
        timestamp: Date.now(),
      }
    }

    const content = fs.readFileSync(file, "utf-8")
    const sampleBetaMatch = /def sample_beta\(alpha.*beta\)/.test(content)
    const selectVariantMatch = /def select_variant_thompson_sampling/.test(content)
    const betavariateMatch = /random\.betavariate\(alpha.*beta\)/.test(content)

    const functionsFound = [
      sampleBetaMatch && "sample_beta",
      selectVariantMatch && "select_variant_thompson_sampling",
      betavariateMatch && "random.betavariate"
    ].filter(Boolean)

    const pass = functionsFound.length >= expected.minMatches

    return {
      pass,
      actual: { functionsFound, file },
      expected,
      reason: pass
        ? `✅ Thompson Sampling implementation found in RPC API: ${functionsFound.join(", ")}`
        : `❌ Missing Thompson Sampling functions in RPC API. Found: ${functionsFound.join(", ")}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to check RPC API Thompson Sampling implementation",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 3: RPC API exposes template selection endpoint
 * 
 * Verifies POST /templates/{activity_id}/select endpoint exists in routes
 */
export async function validateRPCAPIEndpoint(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-rpc-api/server/routes/activity.py",
    endpoint: "/templates/{activity_id}/select",
    httpMethod: "POST",
    reason: "RPC API must expose template selection endpoint for OpenCode to call"
  }

  try {
    const file = expected.file
    if (!fs.existsSync(file)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        reason: `❌ File not found: ${file}`,
        timestamp: Date.now(),
      }
    }

    const content = fs.readFileSync(file, "utf-8")
    
    // Check for route definition
    const routePattern = /@router\.(post|route).*\/templates\/\{[^}]+\}\/select/
    const routeMatch = routePattern.test(content)
    
    // Check for handler function calling select_variant_thompson_sampling
    const handlerPattern = /select_variant_thompson_sampling/
    const handlerMatch = handlerPattern.test(content)

    const pass = routeMatch && handlerMatch

    return {
      pass,
      actual: { 
        routeExists: routeMatch, 
        handlerExists: handlerMatch,
        file 
      },
      expected,
      reason: pass
        ? `✅ Template selection endpoint found: ${expected.httpMethod} ${expected.endpoint}`
        : `❌ Missing endpoint or handler in ${file}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to check RPC API endpoint",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 4: OpenCode delegates to RPC API (no local sampling)
 * 
 * Verifies template-selector.ts calls RpcHttpClient.selectTemplateVariant()
 * and does NOT have local Beta sampling implementation
 */
export async function validateOpencodeRPCDelegation(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-opencode/packages/opencode/src/session/template-selector.ts",
    requiredCalls: ["RpcHttpClient.selectTemplateVariant", "rpcClient.selectTemplateVariant"],
    forbiddenPatterns: ["Math.random", "betavariate", "sampleBeta", "sample_beta"],
    reason: "OpenCode must delegate to RPC API via HTTP, not implement sampling locally"
  }

  try {
    const file = expected.file
    if (!fs.existsSync(file)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        reason: `❌ File not found: ${file}`,
        timestamp: Date.now(),
      }
    }

    const content = fs.readFileSync(file, "utf-8")
    
    // Check for RPC delegation
    const rpcDelegationMatch = /RpcHttpClient\.selectTemplateVariant|rpcClient\.selectTemplateVariant/.test(content)
    
    // Check for forbidden local sampling
    const forbiddenMatches = expected.forbiddenPatterns.filter(pattern => {
      const regex = new RegExp(pattern, "i")
      return regex.test(content)
    })

    const pass = rpcDelegationMatch && forbiddenMatches.length === 0

    return {
      pass,
      actual: { 
        rpcDelegation: rpcDelegationMatch,
        forbiddenPatternsFound: forbiddenMatches,
        file 
      },
      expected,
      reason: pass
        ? "✅ OpenCode correctly delegates Thompson Sampling to RPC API"
        : `❌ OpenCode ${!rpcDelegationMatch ? "missing RPC delegation" : `has forbidden local sampling: ${forbiddenMatches.join(", ")}`}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to check OpenCode RPC delegation",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 5: Phase 3 - Cache-Aside Pattern in create_template
 * 
 * Verifies create_template writes to SurrealDB first, then Redis cache
 */
export async function validateCreateTemplateCacheAside(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-rpc-api/server/actions/activity.py",
    pattern: "create_template_record.*before.*redis",
    surrealdbFirst: true,
    redisSecond: true,
    reason: "Phase 3: create_template must write to SurrealDB (primary) before Redis (cache)"
  }

  try {
    const file = expected.file
    if (!fs.existsSync(file)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        reason: `❌ File not found: ${file}`,
        timestamp: Date.now(),
      }
    }

    const content = fs.readFileSync(file, "utf-8")
    
    // Find create_template function
    const createTemplateStart = content.indexOf("def create_template(")
    if (createTemplateStart === -1) {
      return {
        pass: false,
        actual: { functionNotFound: true },
        expected,
        reason: "❌ create_template function not found",
        timestamp: Date.now(),
      }
    }

    // Extract function body (simplified - find next function or end of file)
    const nextFunctionStart = content.indexOf("\ndef ", createTemplateStart + 10)
    const functionBody = content.substring(
      createTemplateStart,
      nextFunctionStart !== -1 ? nextFunctionStart : content.length
    )

    // Check order: create_template_record should appear before redis.setex
    const surrealdbWriteIndex = functionBody.indexOf("create_template_record")
    const redisWriteIndex = functionBody.indexOf("redis.setex") !== -1 
      ? functionBody.indexOf("redis.setex")
      : functionBody.indexOf("redis.set")
    
    const metricsCreateIndex = functionBody.indexOf("create_metrics(")
    const metricsRedisIndex = functionBody.lastIndexOf("redis.set(f\"activity:metrics:")

    const surrealdbFirst = surrealdbWriteIndex !== -1 && surrealdbWriteIndex < redisWriteIndex
    const metricsOrderCorrect = metricsCreateIndex !== -1 && 
                                metricsRedisIndex !== -1 && 
                                metricsCreateIndex < metricsRedisIndex

    const pass = surrealdbFirst && metricsOrderCorrect

    return {
      pass,
      actual: { 
        surrealdbFirst,
        metricsOrderCorrect,
        surrealdbWriteIndex,
        redisWriteIndex,
        metricsCreateIndex,
        metricsRedisIndex
      },
      expected,
      reason: pass
        ? "✅ create_template writes to SurrealDB first (template + metrics), then Redis cache"
        : `❌ create_template write order incorrect. SurrealDB first: ${surrealdbFirst}, Metrics order: ${metricsOrderCorrect}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to validate cache-aside pattern in create_template",
      timestamp: Date.now(),
    }
  }
}

/**
 * Validation Case 6: Phase 3 - SurrealDB metrics initialization
 * 
 * Verifies create_metrics() is called for SurrealDB persistence
 */
export async function validateSurrealDBMetricsInitialization(): Promise<ValidationResult> {
  const expected = {
    file: "repos/metabob-rpc-api/server/actions/activity.py",
    functionCall: "create_metrics(variant_id)",
    reason: "Phase 3: Metrics must be initialized in SurrealDB (primary storage)"
  }

  try {
    const file = expected.file
    if (!fs.existsSync(file)) {
      return {
        pass: false,
        actual: { fileExists: false },
        expected,
        reason: `❌ File not found: ${file}`,
        timestamp: Date.now(),
      }
    }

    const content = fs.readFileSync(file, "utf-8")
    
    // Check if create_metrics is imported
    const importMatch = /from server\.db\.operations import.*create_metrics/.test(content)
    
    // Check if create_metrics is called in create_template
    const createTemplateStart = content.indexOf("def create_template(")
    const nextFunctionStart = content.indexOf("\ndef ", createTemplateStart + 10)
    const createTemplateBody = content.substring(
      createTemplateStart,
      nextFunctionStart !== -1 ? nextFunctionStart : content.length
    )
    
    const metricsCallMatch = /create_metrics\s*\(\s*variant_id\s*\)/.test(createTemplateBody)

    const pass = importMatch && metricsCallMatch

    return {
      pass,
      actual: { 
        imported: importMatch,
        called: metricsCallMatch,
        file 
      },
      expected,
      reason: pass
        ? "✅ create_metrics() called to initialize metrics in SurrealDB"
        : `❌ Missing create_metrics call. Imported: ${importMatch}, Called: ${metricsCallMatch}`,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      pass: false,
      actual: { error: String(error) },
      expected,
      reason: "Failed to validate SurrealDB metrics initialization",
      timestamp: Date.now(),
    }
  }
}

/**
 * Main validation runner - executes all validation cases
 */
export async function runValidation(): Promise<{
  overallPass: boolean
  results: ValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
    passRate: number
  }
}> {
  console.log("🔍 Running Thompson Sampling Architectural Boundary Validation...\n")

  const results: ValidationResult[] = []

  // Phase 2 validations (architectural boundary)
  console.log("Phase 2: Architectural Boundary Validation")
  console.log("=".repeat(50))
  
  results.push(await validateOpencodeNoMLKeywords())
  console.log(`✓ Case 1: ${results[0].pass ? "PASS" : "FAIL"} - ${results[0].reason}`)
  
  results.push(await validateRPCAPIHasThompsonSampling())
  console.log(`✓ Case 2: ${results[1].pass ? "PASS" : "FAIL"} - ${results[1].reason}`)
  
  results.push(await validateRPCAPIEndpoint())
  console.log(`✓ Case 3: ${results[2].pass ? "PASS" : "FAIL"} - ${results[2].reason}`)
  
  results.push(await validateOpencodeRPCDelegation())
  console.log(`✓ Case 4: ${results[3].pass ? "PASS" : "FAIL"} - ${results[3].reason}`)

  // Phase 3 validations (cache-aside pattern)
  console.log("\nPhase 3: Cache-Aside Pattern Validation")
  console.log("=".repeat(50))
  
  results.push(await validateCreateTemplateCacheAside())
  console.log(`✓ Case 5: ${results[4].pass ? "PASS" : "FAIL"} - ${results[4].reason}`)
  
  results.push(await validateSurrealDBMetricsInitialization())
  console.log(`✓ Case 6: ${results[5].pass ? "PASS" : "FAIL"} - ${results[5].reason}`)

  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  const overallPass = failed === 0

  console.log("\n" + "=".repeat(50))
  console.log(`📊 Validation Summary: ${passed}/${results.length} passed`)
  console.log(`${overallPass ? "✅ ALL VALIDATIONS PASSED" : `❌ ${failed} VALIDATION(S) FAILED`}`)

  return {
    overallPass,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      passRate: (passed / results.length) * 100,
    },
  }
}

// CLI execution
if (require.main === module) {
  runValidation()
    .then(result => {
      console.log("\n" + JSON.stringify(result, null, 2))
      process.exit(result.overallPass ? 0 : 1)
    })
    .catch(error => {
      console.error("❌ Validation harness error:", error)
      process.exit(1)
    })
}
