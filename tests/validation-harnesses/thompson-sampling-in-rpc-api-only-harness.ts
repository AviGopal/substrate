/**
 * Validation Harness: thompson-sampling-in-rpc-api-only
 * 
 * Validates that Thompson Sampling logic has been removed from OpenCode
 * and that the architectural boundary is properly enforced.
 * 
 * Architectural Boundary:
 * - ML and probabilistic selection logic belongs in metabob-rpc-api
 * - OpenCode should delegate to RPC API via POST /v2/activities/templates/{id}/select
 * - No Beta distribution sampling should exist in OpenCode
 * 
 * Validation Strategy:
 * 1. Search for forbidden patterns in OpenCode source code
 * 2. Verify RPC API endpoint exists and is functional
 * 3. Verify RpcHttpClient utility exists and is used
 * 4. Verify no local Thompson Sampling implementation remains
 */

import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

export interface ValidationInput {
  /** Root directory of the repository */
  repoRoot: string
  /** Whether to check RPC API endpoint availability (requires RPC API running) */
  checkRpcEndpoint?: boolean
  /** RPC API base URL (if checkRpcEndpoint is true) */
  rpcApiUrl?: string
}

export interface ValidationOutput {
  /** Overall validation result */
  pass: boolean
  /** List of violations found */
  violations: string[]
  /** List of successful checks */
  successes: string[]
  /** Detailed results for each check */
  checks: {
    forbiddenPatterns: {
      pass: boolean
      matches: Array<{ file: string; line: number; pattern: string; context: string }>
    }
    rpcClientExists: {
      pass: boolean
      filePath?: string
    }
    templateSelectorRefactored: {
      pass: boolean
      details: string
    }
    rpcEndpointAvailable?: {
      pass: boolean
      error?: string
    }
  }
}

/**
 * Forbidden patterns that indicate Thompson Sampling logic in OpenCode
 */
const FORBIDDEN_PATTERNS = [
  {
    name: "betaSample function",
    pattern: /function\s+betaSample\s*\(/,
    reason: "Beta sampling is ML logic that belongs in rpc-api"
  },
  {
    name: "performThompsonSampling function",
    pattern: /function\s+performThompsonSampling\s*\(/,
    reason: "Thompson Sampling orchestration belongs in rpc-api"
  },
  {
    name: "Gamma distribution sampling",
    pattern: /gammaRandom|Marsaglia.*Tsang/,
    reason: "Statistical sampling belongs in rpc-api"
  },
  {
    name: "Box-Muller transform",
    pattern: /Box-Muller|normalRandom.*Math\.sqrt.*Math\.log.*Math\.cos/,
    reason: "Statistical transforms belong in rpc-api"
  },
  {
    name: "Direct Beta sampling calculation",
    pattern: /beta.*=.*gamma.*\/.*\(.*gamma.*\+.*gamma.*\)/,
    reason: "Beta distribution calculation belongs in rpc-api"
  }
]

/**
 * Search for forbidden patterns in OpenCode source files
 */
function searchForbiddenPatterns(opencodeRoot: string): ValidationOutput["checks"]["forbiddenPatterns"] {
  const matches: ValidationOutput["checks"]["forbiddenPatterns"]["matches"] = []
  
  const srcDir = path.join(opencodeRoot, "packages/opencode/src")
  
  if (!fs.existsSync(srcDir)) {
    throw new Error(`OpenCode source directory not found: ${srcDir}`)
  }

  // Files to exclude from search (different architectural concerns)
  const excludedFiles = [
    "ml/thompson-sampler.ts" // Used for LLM model selection, not template variant selection
  ]

  // Search for each forbidden pattern
  for (const { name, pattern, reason } of FORBIDDEN_PATTERNS) {
    try {
      // Use ripgrep for fast searching
      const rgCommand = `rg '${pattern.source}' '${srcDir}' -n --type ts --no-heading --color never 2>/dev/null || true`
      const output = execSync(rgCommand, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 })
      
      if (output.trim()) {
        const lines = output.trim().split("\n")
        for (const line of lines) {
          const match = line.match(/^([^:]+):(\d+):(.*)$/)
          if (match) {
            const [, file, lineNum, context] = match
            const relativeFile = path.relative(opencodeRoot, file)
            
            // Skip excluded files
            const isExcluded = excludedFiles.some(excluded => relativeFile.includes(excluded))
            if (isExcluded) {
              continue
            }
            
            matches.push({
              file: relativeFile,
              line: parseInt(lineNum, 10),
              pattern: name,
              context: context.trim()
            })
          }
        }
      }
    } catch (error) {
      // rg not found or error - fall back to grep
      try {
        const grepCommand = `grep -rn '${pattern.source}' '${srcDir}' --include='*.ts' 2>/dev/null || true`
        const output = execSync(grepCommand, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 })
        
        if (output.trim()) {
          const lines = output.trim().split("\n")
          for (const line of lines) {
            const match = line.match(/^([^:]+):(\d+):(.*)$/)
            if (match) {
              const [, file, lineNum, context] = match
              const relativeFile = path.relative(opencodeRoot, file)
              
              // Skip excluded files
              const isExcluded = excludedFiles.some(excluded => relativeFile.includes(excluded))
              if (isExcluded) {
                continue
              }
              
              matches.push({
                file: relativeFile,
                line: parseInt(lineNum, 10),
                pattern: name,
                context: context.trim()
              })
            }
          }
        }
      } catch (grepError) {
        console.warn(`Warning: Could not search for pattern '${name}': ${grepError}`)
      }
    }
  }

  return {
    pass: matches.length === 0,
    matches
  }
}

/**
 * Check if RpcHttpClient utility exists
 */
function checkRpcClientExists(opencodeRoot: string): ValidationOutput["checks"]["rpcClientExists"] {
  const rpcClientPath = path.join(
    opencodeRoot,
    "packages/opencode/src/util/rpc-http-client.ts"
  )
  
  const exists = fs.existsSync(rpcClientPath)
  
  return {
    pass: exists,
    filePath: exists ? rpcClientPath : undefined
  }
}

/**
 * Check if TemplateSelector has been refactored to use RPC API
 */
function checkTemplateSelectorRefactored(opencodeRoot: string): ValidationOutput["checks"]["templateSelectorRefactored"] {
  const selectorPath = path.join(
    opencodeRoot,
    "packages/opencode/src/session/template-selector.ts"
  )
  
  if (!fs.existsSync(selectorPath)) {
    return {
      pass: false,
      details: "template-selector.ts not found"
    }
  }

  const content = fs.readFileSync(selectorPath, "utf-8")
  
  // Check for RpcHttpClient import
  const hasRpcImport = /import.*RpcHttpClient.*from.*rpc-http-client/.test(content)
  
  // Check for RPC API call
  const hasRpcCall = /RpcHttpClient\.selectTemplateVariant/.test(content)
  
  // Check that betaSample and performThompsonSampling are removed
  const hasBetaSample = /function\s+betaSample/.test(content)
  const hasPerformSampling = /async function\s+performThompsonSampling/.test(content)
  
  const issues: string[] = []
  
  if (!hasRpcImport) issues.push("Missing RpcHttpClient import")
  if (!hasRpcCall) issues.push("Missing RpcHttpClient.selectTemplateVariant() call")
  if (hasBetaSample) issues.push("betaSample() function still exists")
  if (hasPerformSampling) issues.push("performThompsonSampling() function still exists")
  
  return {
    pass: issues.length === 0,
    details: issues.length > 0 ? issues.join("; ") : "Template selector properly refactored"
  }
}

/**
 * Check if RPC API endpoint is available (optional, requires running RPC API)
 */
async function checkRpcEndpointAvailable(rpcApiUrl: string): Promise<ValidationOutput["checks"]["rpcEndpointAvailable"]> {
  try {
    // Try to reach RPC API health endpoint or schema endpoint
    const testUrl = `${rpcApiUrl}/health`
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    })
    
    if (response.ok) {
      return { pass: true }
    } else {
      return {
        pass: false,
        error: `RPC API returned status ${response.status}`
      }
    }
  } catch (error) {
    return {
      pass: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Run validation harness
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const violations: string[] = []
  const successes: string[] = []
  
  // Check 1: Search for forbidden patterns
  console.log("Checking for forbidden patterns in OpenCode...")
  const forbiddenPatternsResult = searchForbiddenPatterns(input.repoRoot)
  
  if (forbiddenPatternsResult.pass) {
    successes.push("No forbidden Thompson Sampling patterns found in OpenCode")
  } else {
    violations.push(`Found ${forbiddenPatternsResult.matches.length} forbidden pattern(s)`)
    for (const match of forbiddenPatternsResult.matches) {
      violations.push(`  - ${match.file}:${match.line} [${match.pattern}]: ${match.context}`)
    }
  }
  
  // Check 2: RpcHttpClient exists
  console.log("Checking for RpcHttpClient utility...")
  const rpcClientResult = checkRpcClientExists(input.repoRoot)
  
  if (rpcClientResult.pass) {
    successes.push("RpcHttpClient utility exists")
  } else {
    violations.push("RpcHttpClient utility not found")
  }
  
  // Check 3: TemplateSelector refactored
  console.log("Checking TemplateSelector refactoring...")
  const selectorResult = checkTemplateSelectorRefactored(input.repoRoot)
  
  if (selectorResult.pass) {
    successes.push("TemplateSelector properly refactored to use RPC API")
  } else {
    violations.push(`TemplateSelector refactoring incomplete: ${selectorResult.details}`)
  }
  
  // Check 4: RPC API endpoint (optional)
  let rpcEndpointResult: ValidationOutput["checks"]["rpcEndpointAvailable"] | undefined
  
  if (input.checkRpcEndpoint && input.rpcApiUrl) {
    console.log("Checking RPC API endpoint availability...")
    rpcEndpointResult = await checkRpcEndpointAvailable(input.rpcApiUrl)
    
    if (rpcEndpointResult.pass) {
      successes.push("RPC API endpoint is available")
    } else {
      violations.push(`RPC API endpoint unavailable: ${rpcEndpointResult.error}`)
    }
  }
  
  const pass = violations.length === 0
  
  return {
    pass,
    violations,
    successes,
    checks: {
      forbiddenPatterns: forbiddenPatternsResult,
      rpcClientExists: rpcClientResult,
      templateSelectorRefactored: selectorResult,
      rpcEndpointAvailable: rpcEndpointResult
    }
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const repoRoot = process.argv[2] || path.join(__dirname, "../..")
  const checkRpcEndpoint = process.argv.includes("--check-rpc")
  const rpcApiUrl = process.env.METABOB_RPC_API_URL || "http://localhost:8000"
  
  console.log("=".repeat(80))
  console.log("Validation Harness: thompson-sampling-in-rpc-api-only")
  console.log("=".repeat(80))
  console.log()
  console.log(`Repository root: ${repoRoot}`)
  console.log(`Check RPC endpoint: ${checkRpcEndpoint}`)
  if (checkRpcEndpoint) {
    console.log(`RPC API URL: ${rpcApiUrl}`)
  }
  console.log()
  
  runValidation({ repoRoot, checkRpcEndpoint, rpcApiUrl })
    .then((result) => {
      console.log()
      console.log("=".repeat(80))
      console.log(`VALIDATION RESULT: ${result.pass ? "PASS ✓" : "FAIL ✗"}`)
      console.log("=".repeat(80))
      console.log()
      
      if (result.successes.length > 0) {
        console.log("Successes:")
        for (const success of result.successes) {
          console.log(`  ✓ ${success}`)
        }
        console.log()
      }
      
      if (result.violations.length > 0) {
        console.log("Violations:")
        for (const violation of result.violations) {
          console.log(`  ✗ ${violation}`)
        }
        console.log()
      }
      
      console.log("Detailed Check Results:")
      console.log(`  Forbidden Patterns: ${result.checks.forbiddenPatterns.pass ? "PASS" : "FAIL"}`)
      console.log(`  RPC Client Exists: ${result.checks.rpcClientExists.pass ? "PASS" : "FAIL"}`)
      console.log(`  Template Selector Refactored: ${result.checks.templateSelectorRefactored.pass ? "PASS" : "FAIL"}`)
      if (result.checks.rpcEndpointAvailable) {
        console.log(`  RPC Endpoint Available: ${result.checks.rpcEndpointAvailable.pass ? "PASS" : "FAIL"}`)
      }
      console.log()
      
      process.exit(result.pass ? 0 : 1)
    })
    .catch((error) => {
      console.error("Validation harness error:", error)
      process.exit(1)
    })
}
