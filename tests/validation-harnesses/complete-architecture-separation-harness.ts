#!/usr/bin/env bun

/**
 * Validation Harness for complete-architecture-separation Specification
 * 
 * Tests the three-component architecture separation:
 * - Case 1: opencode has ZERO ML implementations (only type definitions)
 * - Case 2: CLI has ZERO training logic (pure MCP gateway)
 * - Case 3: RPC API has ALL learning endpoints (Thompson Sampling, metrics)
 * - Case 4: Data flow follows architecture (opencode → CLI → RPC API → SurrealDB)
 * - Case 5: thompson-sampler.ts file has been deleted from opencode
 * - Case 6: Template storage uses SurrealDB primary + Redis cache
 * - Case 7: MCP tools in CLI are pure proxies to RPC API
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
      `cd ${repoPath} && rg -i "${pattern}" -t ts -t py -t js ${excludeArgs} 2>/dev/null || true`
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

// Helper: Check directory existence
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

// Test Cases
const testCases: ValidationCase[] = [
  {
    id: "validation-complete-architecture-separation-case-1",
    name: "opencode has ZERO ML implementations",
    test: async (): Promise<ValidationResult> => {
      // Search for ML implementation keywords (not type definitions)
      const patterns = [
        "class.*Thompson",
        "function.*performThompsonSampling",
        "sample_beta\\(",
        "beta_distribution\\(",
        "def.*thompson"
      ]
      
      let totalMatches = 0
      const allMatches: string[] = []
      
      for (const pattern of patterns) {
        const result = await grepInRepo("metabob-opencode", pattern)
        totalMatches += result.count
        allMatches.push(...result.matches)
      }
      
      // Filter out type definitions and comments
      const actualImplementations = allMatches.filter(line => {
        const lower = line.toLowerCase()
        return !(
          lower.includes("//") ||           // Comments
          lower.includes("thompsonsampling:") || // Type definitions
          lower.includes("interface") ||
          lower.includes("type ") ||
          lower.includes("z.object")        // Zod schemas
        )
      })
      
      return {
        pass: actualImplementations.length === 0,
        caseId: "case-1",
        actual: {
          implementationCount: actualImplementations.length,
          matches: actualImplementations.slice(0, 5)  // First 5 for debugging
        },
        expected: {
          implementationCount: 0,
          reason: "opencode should only have type definitions, no ML implementations"
        },
        details: actualImplementations.length === 0
          ? "✓ No ML implementations found in opencode"
          : `✗ Found ${actualImplementations.length} ML implementations in opencode`
      }
    }
  },
  
  {
    id: "validation-complete-architecture-separation-case-2",
    name: "CLI has ZERO training logic",
    test: async (): Promise<ValidationResult> => {
      // Search for training logic keywords
      const patterns = [
        "def.*train",
        "class.*Trainer",
        "beta_update",
        "alpha.*=.*success",
        "update_beta_distribution"
      ]
      
      let totalMatches = 0
      const allMatches: string[] = []
      
      for (const pattern of patterns) {
        const result = await grepInRepo("metabob-cli", pattern, "*.py")
        totalMatches += result.count
        allMatches.push(...result.matches)
      }
      
      return {
        pass: totalMatches === 0,
        caseId: "case-2",
        actual: {
          trainingLogicCount: totalMatches,
          matches: allMatches.slice(0, 5)
        },
        expected: {
          trainingLogicCount: 0,
          reason: "CLI should be pure MCP gateway with no training logic"
        },
        details: totalMatches === 0
          ? "✓ No training logic found in CLI"
          : `✗ Found ${totalMatches} training logic implementations in CLI`
      }
    }
  },
  
  {
    id: "validation-complete-architecture-separation-case-3",
    name: "RPC API has ALL learning endpoints",
    test: async (): Promise<ValidationResult> => {
      // Search for required learning endpoints
      const requiredEndpoints = [
        { name: "Thompson Sampling", pattern: "def select_variant_thompson_sampling" },
        { name: "Beta Sampling", pattern: "sample_beta" },
        { name: "Metrics Update", pattern: "update_metrics_after_execution" }
      ]
      
      const results: Record<string, boolean> = {}
      const missing: string[] = []
      
      for (const endpoint of requiredEndpoints) {
        const result = await grepInRepo("metabob-rpc-api", endpoint.pattern, "*.py")
        results[endpoint.name] = result.count > 0
        if (result.count === 0) {
          missing.push(endpoint.name)
        }
      }
      
      return {
        pass: missing.length === 0,
        caseId: "case-3",
        actual: results,
        expected: {
          "Thompson Sampling": true,
          "Beta Sampling": true,
          "Metrics Update": true
        },
        details: missing.length === 0
          ? "✓ All learning endpoints found in RPC API"
          : `✗ Missing endpoints in RPC API: ${missing.join(", ")}`
      }
    }
  },
  
  {
    id: "validation-complete-architecture-separation-case-4",
    name: "Data flow follows architecture boundaries",
    test: async (): Promise<ValidationResult> => {
      // Check opencode delegates to RPC API (not local)
      const opencodeRpcCalls = await grepInRepo(
        "metabob-opencode",
        "rpcHttpClient|POST.*activities.*select"
      )
      
      // Check CLI forwards to RPC API
      const cliRpcForwarding = await grepInRepo(
        "metabob-cli",
        "call_api.*POST.*activities|await.*call_api",
        "*.py"
      )
      
      // Check no shortcuts (opencode directly calling SurrealDB)
      const opencodeDirectDb = await grepInRepo(
        "metabob-opencode",
        "surrealdb|surreal\\.",
        "*.ts",
        ["node_modules", "dist", "*.test.*", "test-*", "types"]
      )
      
      const pass = opencodeRpcCalls.count > 0 && 
                   cliRpcForwarding.count > 0 && 
                   opencodeDirectDb.count === 0
      
      return {
        pass,
        caseId: "case-4",
        actual: {
          opencodeUsesRpcClient: opencodeRpcCalls.count > 0,
          cliForwardsToRpc: cliRpcForwarding.count > 0,
          opencodeDirectDbAccess: opencodeDirectDb.count
        },
        expected: {
          opencodeUsesRpcClient: true,
          cliForwardsToRpc: true,
          opencodeDirectDbAccess: 0
        },
        details: pass
          ? "✓ Data flow follows layered architecture"
          : "✗ Data flow violations detected"
      }
    }
  },
  
  {
    id: "validation-complete-architecture-separation-case-5",
    name: "thompson-sampler.ts deleted from opencode",
    test: async (): Promise<ValidationResult> => {
      const thompsonSamplerPath = path.join(
        process.cwd(),
        "repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler.ts"
      )
      
      const mlDirPath = path.join(
        process.cwd(),
        "repos/metabob-opencode/packages/opencode/src/ml"
      )
      
      const fileStillExists = await fileExists(thompsonSamplerPath)
      const mlDirExists = await directoryExists(mlDirPath)
      
      return {
        pass: !fileStillExists,
        caseId: "case-5",
        actual: {
          thompsonSamplerExists: fileStillExists,
          mlDirectoryExists: mlDirExists
        },
        expected: {
          thompsonSamplerExists: false,
          mlDirectoryExists: false,
          reason: "ML implementation directory should be deleted"
        },
        details: !fileStillExists
          ? "✓ thompson-sampler.ts has been deleted"
          : "✗ thompson-sampler.ts still exists in opencode"
      }
    }
  },
  
  {
    id: "validation-complete-architecture-separation-case-6",
    name: "Template storage uses SurrealDB primary + Redis cache",
    test: async (): Promise<ValidationResult> => {
      // Check RPC API uses SurrealDB for templates
      const surrealdbStorage = await grepInRepo(
        "metabob-rpc-api",
        "surrealdb.*template|activity_template.*surreal",
        "*.py"
      )
      
      // Check Redis is used for caching
      const redisCache = await grepInRepo(
        "metabob-rpc-api",
        "redis.*cache|cache.*template|ttl",
        "*.py"
      )
      
      // Check for cache-first pattern
      const cacheMissLogic = await grepInRepo(
        "metabob-rpc-api",
        "if.*not.*redis|cache.*miss|load.*from.*surreal",
        "*.py"
      )
      
      const pass = surrealdbStorage.count > 0 && 
                   redisCache.count > 0 && 
                   cacheMissLogic.count > 0
      
      return {
        pass,
        caseId: "case-6",
        actual: {
          surrealdbForTemplates: surrealdbStorage.count > 0,
          redisForCaching: redisCache.count > 0,
          cacheMissHandling: cacheMissLogic.count > 0
        },
        expected: {
          surrealdbForTemplates: true,
          redisForCaching: true,
          cacheMissHandling: true
        },
        details: pass
          ? "✓ Template storage uses SurrealDB primary + Redis cache"
          : "✗ Storage architecture not correctly implemented"
      }
    }
  },
  
  {
    id: "validation-complete-architecture-separation-case-7",
    name: "CLI MCP tools are pure proxies to RPC API",
    test: async (): Promise<ValidationResult> => {
      // Check MCP tools delegate to RPC API
      const mcpToolProxies = await grepInRepo(
        "metabob-cli",
        "await call_api|call_rpc_api",
        "*.py",
        ["node_modules", "*.test.*"]
      )
      
      // Check for LOCAL computation in MCP tools (should be zero)
      const localComputation = await grepInRepo(
        "metabob-cli",
        "calculate.*metric|compute.*score|local.*thompson",
        "*.py",
        ["node_modules", "*.test.*", "test_*"]
      )
      
      const pass = mcpToolProxies.count > 0 && localComputation.count === 0
      
      return {
        pass,
        caseId: "case-7",
        actual: {
          mcpToolsDelegateToRpc: mcpToolProxies.count > 0,
          localComputationFound: localComputation.count
        },
        expected: {
          mcpToolsDelegateToRpc: true,
          localComputationFound: 0
        },
        details: pass
          ? "✓ CLI MCP tools are pure proxies"
          : "✗ CLI MCP tools contain local computation"
      }
    }
  }
]

// Main validation function
export async function runValidation(): Promise<{
  allPassed: boolean
  results: ValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}> {
  const results: ValidationResult[] = []
  
  console.log("=".repeat(80))
  console.log("VALIDATION HARNESS: complete-architecture-separation")
  console.log("=".repeat(80))
  console.log()
  
  for (const testCase of testCases) {
    console.log(`Running: ${testCase.name}...`)
    try {
      const result = await testCase.test()
      result.caseId = testCase.id
      results.push(result)
      
      const status = result.pass ? "✓ PASS" : "✗ FAIL"
      console.log(`  ${status}: ${result.details}`)
      
      if (!result.pass) {
        console.log(`  Expected:`, JSON.stringify(result.expected, null, 2))
        console.log(`  Actual:`, JSON.stringify(result.actual, null, 2))
      }
    } catch (error) {
      results.push({
        pass: false,
        caseId: testCase.id,
        actual: { error: error.message },
        expected: {},
        error: error.message,
        details: `✗ ERROR: ${error.message}`
      })
      console.log(`  ✗ ERROR: ${error.message}`)
    }
    console.log()
  }
  
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  
  console.log("=".repeat(80))
  console.log("SUMMARY")
  console.log("=".repeat(80))
  console.log(`Total:  ${results.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log()
  console.log(`Overall: ${failed === 0 ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"}`)
  console.log("=".repeat(80))
  
  return {
    allPassed: failed === 0,
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  }
}

// Run if executed directly
if (import.meta.main) {
  runValidation()
    .then(({ allPassed }) => {
      process.exit(allPassed ? 0 : 1)
    })
    .catch(error => {
      console.error("Fatal error:", error)
      process.exit(1)
    })
}
