/**
 * Validation Harness: Enable Agent-Driven Config Modification via Tool
 * 
 * Purpose: Verify that agents can modify OpenCode configuration programmatically
 * without CLI access, using the config_update tool.
 * 
 * Specification Requirements:
 * 1. Config.update() and Config.updateSafe() exist in config.ts
 * 2. config_update tool exists in tool/config-update.ts
 * 3. Tool accepts parameters: section, operation, key, value, reload, createImpulse, reason
 * 4. Tool calls ConfigManager functions (addMCPServer, updateBackendUrl, setFeatureFlag)
 * 5. MCP.reload() triggered when section='mcp' and reload=true
 * 6. Impulse creation supported when createImpulse=true
 * 7. Safety mechanisms: validation, backup, rollback
 * 8. Structured response with success, configUpdated, reloadPerformed, mcpStatus, impulseId
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "../../repos/metabob-opencode/packages/opencode/src/util/log"

const log = Log.create({ service: "config-update-tool-harness" })

export interface ValidationResult {
  pass: boolean
  testName: string
  actual: unknown
  expected: unknown
  error?: string
}

export interface TestCase {
  impulseId: string
  input: {
    section: string
    operation: "add" | "remove" | "modify"
    key: string
    value?: unknown
    reload?: boolean
    createImpulse?: boolean
    reason?: string
  }
  expectedOutput: {
    success: boolean
    configUpdated: boolean
    reloadPerformed?: boolean
    hasImpulseId?: boolean
  }
}

/**
 * Run all validation tests
 */
export async function runValidation(): Promise<{
  passed: number
  failed: number
  total: number
  results: ValidationResult[]
}> {
  const results: ValidationResult[] = []
  
  log.info("Running Config Update Tool Validation Harness")
  
  // Test 1: Verify Config.update() exists
  results.push(await verifyConfigUpdateExists())
  
  // Test 2: Verify Config.updateSafe() exists
  results.push(await verifyConfigUpdateSafeExists())
  
  // Test 3: Verify config_update tool file exists
  results.push(await verifyConfigUpdateToolExists())
  
  // Test 4: Verify tool is registered in ToolRegistry
  results.push(await verifyToolRegistered())
  
  // Test 5: Verify MCP.reload() can be called programmatically
  results.push(await verifyMCPReloadCallable())
  
  // Test 6: Verify ConfigManager exists with required functions
  results.push(await verifyConfigManagerFunctions())
  
  // Test 7: Verify tool parameter schema
  results.push(await verifyToolParameterSchema())
  
  // Test 8: Verify removeMCPServer() helper exists
  results.push(await verifyRemoveMCPServerExists())
  
  // Print results
  for (const result of results) {
    if (result.pass) {
      log.info(`✅ PASS: ${result.testName}`)
    } else {
      log.error(`❌ FAIL: ${result.testName}`)
      log.error(`  Expected: ${JSON.stringify(result.expected)}`)
      log.error(`  Actual: ${JSON.stringify(result.actual)}`)
      if (result.error) {
        log.error(`  Error: ${result.error}`)
      }
    }
  }
  
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  
  log.info(`\nValidation Summary:`)
  log.info(`  Passed: ${passed}/${results.length}`)
  log.info(`  Failed: ${failed}/${results.length}`)
  
  return {
    passed,
    failed,
    total: results.length,
    results,
  }
}

/**
 * Test 1: Verify Config.update() exists
 */
async function verifyConfigUpdateExists(): Promise<ValidationResult> {
  try {
    const configPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/config/config.ts"
    )
    const content = await fs.readFile(configPath, "utf-8")
    
    const hasUpdate = content.includes("export async function update(")
    
    return {
      pass: hasUpdate,
      testName: "Config.update() exists",
      actual: hasUpdate,
      expected: true,
      error: hasUpdate ? undefined : "Config.update() function not found in config.ts",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "Config.update() exists",
      actual: null,
      expected: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 2: Verify Config.updateSafe() exists
 */
async function verifyConfigUpdateSafeExists(): Promise<ValidationResult> {
  try {
    const configPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/config/config.ts"
    )
    const content = await fs.readFile(configPath, "utf-8")
    
    const hasUpdateSafe = content.includes("export async function updateSafe(")
    
    return {
      pass: hasUpdateSafe,
      testName: "Config.updateSafe() exists",
      actual: hasUpdateSafe,
      expected: true,
      error: hasUpdateSafe ? undefined : "Config.updateSafe() function not found in config.ts",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "Config.updateSafe() exists",
      actual: null,
      expected: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 3: Verify config_update tool file exists
 */
async function verifyConfigUpdateToolExists(): Promise<ValidationResult> {
  try {
    const toolPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/tool/config-update.ts"
    )
    
    await fs.access(toolPath)
    const content = await fs.readFile(toolPath, "utf-8")
    
    const hasToolDefine = content.includes('Tool.define("config_update"')
    
    return {
      pass: hasToolDefine,
      testName: "config_update tool file exists with Tool.define",
      actual: hasToolDefine,
      expected: true,
      error: hasToolDefine ? undefined : "Tool.define('config_update') not found in config-update.ts",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "config_update tool file exists with Tool.define",
      actual: null,
      expected: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 4: Verify tool is registered in ToolRegistry
 */
async function verifyToolRegistered(): Promise<ValidationResult> {
  try {
    const registryPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/tool/registry.ts"
    )
    const content = await fs.readFile(registryPath, "utf-8")
    
    const hasImport = content.includes('from "./config-update"')
    const hasRegistration = content.includes("ConfigUpdateTool")
    
    const registered = hasImport && hasRegistration
    
    return {
      pass: registered,
      testName: "ConfigUpdateTool registered in ToolRegistry",
      actual: { hasImport, hasRegistration },
      expected: { hasImport: true, hasRegistration: true },
      error: registered ? undefined : "ConfigUpdateTool not properly registered in ToolRegistry",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "ConfigUpdateTool registered in ToolRegistry",
      actual: null,
      expected: { hasImport: true, hasRegistration: true },
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 5: Verify MCP.reload() can be called programmatically
 */
async function verifyMCPReloadCallable(): Promise<ValidationResult> {
  try {
    const mcpPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/mcp/index.ts"
    )
    const content = await fs.readFile(mcpPath, "utf-8")
    
    const hasReloadExport = content.includes("export async function reload()")
    const returnsStatus = content.includes("success: boolean") && 
                          content.includes("clients: Record<string, Status>")
    
    const callable = hasReloadExport && returnsStatus
    
    return {
      pass: callable,
      testName: "MCP.reload() is callable programmatically",
      actual: { hasReloadExport, returnsStatus },
      expected: { hasReloadExport: true, returnsStatus: true },
      error: callable ? undefined : "MCP.reload() not properly exported or doesn't return expected status",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "MCP.reload() is callable programmatically",
      actual: null,
      expected: { hasReloadExport: true, returnsStatus: true },
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 6: Verify ConfigManager exists with required functions
 */
async function verifyConfigManagerFunctions(): Promise<ValidationResult> {
  try {
    const selfModifyPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/config/self-modify.ts"
    )
    const content = await fs.readFile(selfModifyPath, "utf-8")
    
    const hasUpdateConfig = content.includes("export async function updateConfig(")
    const hasAddMCPServer = content.includes("export async function addMCPServer(")
    const hasUpdateBackendUrl = content.includes("export async function updateBackendUrl(")
    const hasSetFeatureFlag = content.includes("export async function setFeatureFlag(")
    
    const allPresent = hasUpdateConfig && hasAddMCPServer && hasUpdateBackendUrl && hasSetFeatureFlag
    
    return {
      pass: allPresent,
      testName: "ConfigManager has required functions",
      actual: { hasUpdateConfig, hasAddMCPServer, hasUpdateBackendUrl, hasSetFeatureFlag },
      expected: { hasUpdateConfig: true, hasAddMCPServer: true, hasUpdateBackendUrl: true, hasSetFeatureFlag: true },
      error: allPresent ? undefined : "ConfigManager missing required functions",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "ConfigManager has required functions",
      actual: null,
      expected: { hasUpdateConfig: true, hasAddMCPServer: true, hasUpdateBackendUrl: true, hasSetFeatureFlag: true },
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 7: Verify tool parameter schema
 */
async function verifyToolParameterSchema(): Promise<ValidationResult> {
  try {
    const toolPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/tool/config-update.ts"
    )
    const content = await fs.readFile(toolPath, "utf-8")
    
    const hasSection = content.includes('section: z.string()')
    const hasOperation = content.includes('operation: z.enum(["add", "remove", "modify"])')
    const hasKey = content.includes('key: z.string()')
    const hasValue = content.includes('value: z.any()')
    const hasReload = content.includes('reload: z.boolean()')
    const hasCreateImpulse = content.includes('createImpulse: z.boolean()')
    const hasReason = content.includes('reason: z.string()')
    
    const allParamsPresent = hasSection && hasOperation && hasKey && hasValue && hasReload && hasCreateImpulse && hasReason
    
    return {
      pass: allParamsPresent,
      testName: "Tool has correct parameter schema",
      actual: { hasSection, hasOperation, hasKey, hasValue, hasReload, hasCreateImpulse, hasReason },
      expected: { hasSection: true, hasOperation: true, hasKey: true, hasValue: true, hasReload: true, hasCreateImpulse: true, hasReason: true },
      error: allParamsPresent ? undefined : "Tool parameter schema incomplete",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "Tool has correct parameter schema",
      actual: null,
      expected: { hasSection: true, hasOperation: true, hasKey: true, hasValue: true, hasReload: true, hasCreateImpulse: true, hasReason: true },
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 8: Verify removeMCPServer() helper exists
 */
async function verifyRemoveMCPServerExists(): Promise<ValidationResult> {
  try {
    const toolPath = path.join(
      __dirname,
      "../../repos/metabob-opencode/packages/opencode/src/tool/config-update.ts"
    )
    const content = await fs.readFile(toolPath, "utf-8")
    
    const hasRemoveMCPServer = content.includes("async function removeMCPServer(")
    
    return {
      pass: hasRemoveMCPServer,
      testName: "removeMCPServer() helper exists",
      actual: hasRemoveMCPServer,
      expected: true,
      error: hasRemoveMCPServer ? undefined : "removeMCPServer() helper function not found",
    }
  } catch (error) {
    return {
      pass: false,
      testName: "removeMCPServer() helper exists",
      actual: null,
      expected: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test case definitions for impulse storage
 */
export const testCases: TestCase[] = [
  {
    impulseId: "validation-config-update-tool-case-1",
    input: {
      section: "mcp",
      operation: "add",
      key: "test-server",
      value: { type: "remote", url: "http://localhost:3000/mcp" },
      reload: true,
      reason: "Test MCP server addition with reload",
    },
    expectedOutput: {
      success: true,
      configUpdated: true,
      reloadPerformed: true,
    },
  },
  {
    impulseId: "validation-config-update-tool-case-2",
    input: {
      section: "metabob",
      operation: "modify",
      key: "base_url",
      value: "https://staging.metabob.com",
      reason: "Test backend URL modification",
    },
    expectedOutput: {
      success: true,
      configUpdated: true,
      reloadPerformed: false,
    },
  },
  {
    impulseId: "validation-config-update-tool-case-3",
    input: {
      section: "features",
      operation: "add",
      key: "experimental_test",
      value: true,
      reason: "Test feature flag addition",
    },
    expectedOutput: {
      success: true,
      configUpdated: true,
      reloadPerformed: false,
    },
  },
  {
    impulseId: "validation-config-update-tool-case-4",
    input: {
      section: "mcp",
      operation: "remove",
      key: "test-server",
      reload: true,
      reason: "Test MCP server removal with reload",
    },
    expectedOutput: {
      success: true,
      configUpdated: true,
      reloadPerformed: true,
    },
  },
  {
    impulseId: "validation-config-update-tool-case-5",
    input: {
      section: "mcp",
      operation: "add",
      key: "impulse-test-server",
      value: { type: "remote", url: "http://localhost:8080/mcp" },
      createImpulse: true,
      reason: "Test impulse creation",
    },
    expectedOutput: {
      success: true,
      configUpdated: true,
      hasImpulseId: true,
    },
  },
]

// Export for use in validation scripts
export default {
  runValidation,
  testCases,
}
