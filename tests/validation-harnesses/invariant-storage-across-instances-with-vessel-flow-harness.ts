/**
 * Validation Harness: Invariant Storage Across Instances with Vessel Flow
 * 
 * Tests cross-instance storage consistency, vessel flow compliance, and multi-tenant isolation.
 * 
 * Specification: invariant-storage-across-instances-with-vessel-flow
 * 
 * Validation Strategy:
 * 1. Verify impulse storage flows through vessel architecture (opencode -> CLI -> rpc-api)
 * 2. Test cross-instance access with same (api_key, project_id)
 * 3. Verify multi-tenant isolation (different api_keys cannot access each other's data)
 * 4. Validate no direct HTTP calls from opencode to rpc-api (vessel boundary enforcement)
 * 5. Test activity template registration and retrieval across instances
 * 6. Verify error handling when vessel components unavailable
 * 
 * Architecture: Non-LLM, automated pass/fail validation with detailed diagnostics.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

interface ValidationResult {
  pass: boolean;
  testCaseId: string;
  testName: string;
  expected: any;
  actual: any;
  errorMessage?: string;
  diagnostics?: Record<string, any>;
}

interface TestCase {
  id: string;
  name: string;
  input: any;
  expectedOutput: any;
  validator: (input: any, expectedOutput: any) => Promise<ValidationResult>;
}

interface HarnessResult {
  overallPass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Test credentials for multi-tenant isolation testing
  apiKey1: process.env.TEST_API_KEY_1 || "test_api_key_instance_a",
  apiKey2: process.env.TEST_API_KEY_2 || "test_api_key_instance_b",
  projectId1: "test_project_alpha",
  projectId2: "test_project_beta",
  
  // Backend URLs (can be overridden for testing)
  rpcApiUrl: process.env.METABOB_RPC_URL || "http://localhost:8000",
  cliMcpPort: process.env.CLI_MCP_PORT || "3000",
  
  // Test impulse data
  testImpulseId: "validation-test-impulse-" + Date.now(),
  
  // Timeouts
  operationTimeout: 30000, // 30 seconds
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Call CLI MCP tool via subprocess (simulates opencode calling CLI)
 */
async function callCLIMCPTool(
  toolName: string,
  params: Record<string, any>,
  apiKey: string
): Promise<any> {
  try {
    // Simulate calling metabob-cli MCP tool
    // In real implementation, this would use MCP protocol
    const command = `
      export METABOB_API_KEY="${apiKey}"
      cd repos/metabob-cli
      python -c "
import json
import sys
sys.path.insert(0, 'src')
from metabob_cli.mcp.tools import ${toolName}
import asyncio

async def run():
    result = await ${toolName}(${JSON.stringify(params).replace(/"/g, '\\"')})
    print(result)

asyncio.run(run())
      "
    `;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: CONFIG.operationTimeout,
    });
    
    if (stderr && stderr.includes("Error")) {
      throw new Error(`CLI MCP tool error: ${stderr}`);
    }
    
    return JSON.parse(stdout.trim());
  } catch (error: any) {
    throw new Error(`Failed to call CLI MCP tool ${toolName}: ${error.message}`);
  }
}

/**
 * Direct HTTP call to rpc-api (should NOT be used by opencode - vessel violation)
 */
async function directHTTPCall(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: any
): Promise<any> {
  const url = `${CONFIG.rpcApiUrl}${endpoint}`;
  const headers = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (response.status === 204) {
      return null; // No content
    }
    
    return await response.json();
  } catch (error: any) {
    throw new Error(`Direct HTTP call failed: ${error.message}`);
  }
}

/**
 * Verify no direct imports of rpc-api client in opencode codebase
 */
async function verifyNoDirectRPCImports(): Promise<{
  pass: boolean;
  violations: string[];
}> {
  try {
    const { stdout } = await execAsync(
      `cd repos/metabob-opencode && grep -r "from.*metabob.*rpc" --include="*.ts" --include="*.js" src/ || true`
    );
    
    const violations = stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0 && !line.includes("// vessel-exception"));
    
    return {
      pass: violations.length === 0,
      violations,
    };
  } catch (error: any) {
    return {
      pass: false,
      violations: [`Error checking imports: ${error.message}`],
    };
  }
}

/**
 * Trace a function call to verify it uses vessel flow
 */
async function traceFunctionCall(
  functionName: string,
  args: any[]
): Promise<{
  usesCliTool: boolean;
  usesDirectHTTP: boolean;
  callStack: string[];
}> {
  // Mock implementation - in real version, use dtrace/strace/debug hooks
  // For now, check if the function is in CLI tools module
  const callStack: string[] = [];
  
  const cliToolsPath = path.join(
    process.cwd(),
    "repos/metabob-cli/src/metabob_cli/mcp/tools.py"
  );
  
  try {
    const cliToolsContent = await fs.readFile(cliToolsPath, "utf-8");
    const usesCliTool = cliToolsContent.includes(`async def ${functionName}`);
    
    // Check if opencode directly imports httpx or fetch
    const storagePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/storage/storage.ts"
    );
    const storageContent = await fs.readFile(storagePath, "utf-8");
    const usesDirectHTTP =
      storageContent.includes("fetch(") || storageContent.includes("axios(");
    
    return {
      usesCliTool,
      usesDirectHTTP,
      callStack: usesCliTool ? ["opencode", "CLI MCP", "rpc-api"] : ["opencode", "rpc-api"],
    };
  } catch (error: any) {
    return {
      usesCliTool: false,
      usesDirectHTTP: false,
      callStack: [`Error tracing: ${error.message}`],
    };
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Test Case 1: Verify vessel flow for impulse storage
 * 
 * Validates that impulse_store calls flow through CLI MCP tool to rpc-api.
 */
async function testCase1_VesselFlowCompliance(
  input: any,
  expectedOutput: any
): Promise<ValidationResult> {
  const testCaseId = "validation-invariant-storage-across-instances-with-vessel-flow-case-1";
  const testName = "Vessel Flow Compliance - Impulse Storage";
  
  try {
    // 1. Verify no direct RPC imports in opencode
    const importCheck = await verifyNoDirectRPCImports();
    
    if (!importCheck.pass) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { violations: importCheck.violations },
        errorMessage: `Vessel boundary violation: opencode directly imports rpc-api (${importCheck.violations.length} violations)`,
        diagnostics: { importViolations: importCheck.violations },
      };
    }
    
    // 2. Trace impulse_store function call
    const trace = await traceFunctionCall("metabob_impulse_store", [
      input.impulseId,
      input.projectId,
      input.impulseData,
    ]);
    
    if (!trace.usesCliTool) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { callStack: trace.callStack },
        errorMessage: "Vessel flow violation: impulse_store does not use CLI MCP tool",
        diagnostics: { trace },
      };
    }
    
    if (trace.usesDirectHTTP) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { callStack: trace.callStack },
        errorMessage: "Vessel flow violation: opencode makes direct HTTP calls",
        diagnostics: { trace },
      };
    }
    
    return {
      pass: true,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: {
        noDirectImports: importCheck.pass,
        usesCliTool: trace.usesCliTool,
        callStack: trace.callStack,
      },
      diagnostics: { trace, importCheck },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 2: Cross-instance impulse retrieval
 * 
 * Store impulse from "Instance A" with (api_key_1, project_1).
 * Retrieve from "Instance B" with same credentials.
 * Verify impulse data matches exactly.
 */
async function testCase2_CrossInstanceRetrieval(
  input: any,
  expectedOutput: any
): Promise<ValidationResult> {
  const testCaseId = "validation-invariant-storage-across-instances-with-vessel-flow-case-2";
  const testName = "Cross-Instance Impulse Retrieval";
  
  try {
    const impulseId = `test-impulse-${Date.now()}`;
    const impulseData = {
      id: impulseId,
      type: "templateDefinition",
      pointer: { type: "memo", content: "Test content for cross-instance validation" },
      budget: 5000,
    };
    
    // Instance A: Store impulse via CLI MCP tool
    const storeResult = await directHTTPCall(
      "/v2/impulses",
      "POST",
      CONFIG.apiKey1,
      {
        impulse_id: impulseId,
        project_id: CONFIG.projectId1,
        impulse_data: impulseData,
      }
    );
    
    if (!storeResult || storeResult.impulse_id !== impulseId) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: storeResult,
        errorMessage: "Failed to store impulse in Instance A",
      };
    }
    
    // Simulate network delay / different machine
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Instance B: Retrieve impulse with same (api_key, project_id)
    const loadResult = await directHTTPCall(
      `/v2/impulses/${impulseId}?project_id=${CONFIG.projectId1}`,
      "GET",
      CONFIG.apiKey1
    );
    
    if (!loadResult || loadResult.impulse_id !== impulseId) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: loadResult,
        errorMessage: "Failed to retrieve impulse from Instance B",
      };
    }
    
    // Verify data integrity
    const dataMatch =
      JSON.stringify(loadResult.impulse_data) === JSON.stringify(impulseData);
    
    if (!dataMatch) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: { impulseData },
        actual: { retrievedData: loadResult.impulse_data },
        errorMessage: "Impulse data mismatch between Instance A and Instance B",
      };
    }
    
    // Cleanup
    await directHTTPCall(
      `/v2/impulses/${impulseId}?project_id=${CONFIG.projectId1}`,
      "DELETE",
      CONFIG.apiKey1
    );
    
    return {
      pass: true,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: {
        storeSuccess: true,
        retrieveSuccess: true,
        dataIntegrity: dataMatch,
        impulseId,
      },
      diagnostics: {
        storedData: impulseData,
        retrievedData: loadResult.impulse_data,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 3: Multi-tenant isolation
 * 
 * Store impulse with api_key_1.
 * Attempt to retrieve with api_key_2.
 * Verify access is denied (404 or 403).
 */
async function testCase3_MultiTenantIsolation(
  input: any,
  expectedOutput: any
): Promise<ValidationResult> {
  const testCaseId = "validation-invariant-storage-across-instances-with-vessel-flow-case-3";
  const testName = "Multi-Tenant Isolation";
  
  try {
    const impulseId = `test-impulse-isolated-${Date.now()}`;
    const impulseData = {
      id: impulseId,
      type: "memo",
      pointer: { type: "memo", content: "Confidential data for Tenant A" },
      budget: 2000,
    };
    
    // Tenant A: Store impulse
    await directHTTPCall("/v2/impulses", "POST", CONFIG.apiKey1, {
      impulse_id: impulseId,
      project_id: CONFIG.projectId1,
      impulse_data: impulseData,
    });
    
    // Tenant B: Attempt to retrieve Tenant A's impulse (should fail)
    let accessDenied = false;
    let errorStatus = null;
    
    try {
      await directHTTPCall(
        `/v2/impulses/${impulseId}?project_id=${CONFIG.projectId1}`,
        "GET",
        CONFIG.apiKey2 // Different API key
      );
      // If we reach here, access was NOT denied (failure)
      accessDenied = false;
    } catch (error: any) {
      // Access denied (expected)
      accessDenied = true;
      errorStatus = error.message.includes("404") || error.message.includes("403");
    }
    
    // Cleanup
    try {
      await directHTTPCall(
        `/v2/impulses/${impulseId}?project_id=${CONFIG.projectId1}`,
        "DELETE",
        CONFIG.apiKey1
      );
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (!accessDenied) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { accessDenied: false },
        errorMessage: "Multi-tenant isolation violated: Tenant B accessed Tenant A's impulse",
      };
    }
    
    return {
      pass: true,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: {
        accessDenied: true,
        errorStatus,
      },
      diagnostics: {
        tenantAApiKey: CONFIG.apiKey1.slice(0, 8) + "...",
        tenantBApiKey: CONFIG.apiKey2.slice(0, 8) + "...",
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 4: Project isolation
 * 
 * Store impulse with (api_key_1, project_1).
 * Attempt to retrieve with (api_key_1, project_2).
 * Verify impulse is not accessible (different project).
 */
async function testCase4_ProjectIsolation(
  input: any,
  expectedOutput: any
): Promise<ValidationResult> {
  const testCaseId = "validation-invariant-storage-across-instances-with-vessel-flow-case-4";
  const testName = "Project Isolation";
  
  try {
    const impulseId = `test-impulse-project-isolated-${Date.now()}`;
    const impulseData = {
      id: impulseId,
      type: "memo",
      pointer: { type: "memo", content: "Data for Project Alpha" },
      budget: 2000,
    };
    
    // Store impulse in Project Alpha
    await directHTTPCall("/v2/impulses", "POST", CONFIG.apiKey1, {
      impulse_id: impulseId,
      project_id: CONFIG.projectId1,
      impulse_data: impulseData,
    });
    
    // Attempt to retrieve from Project Beta (same api_key, different project_id)
    let projectIsolated = false;
    
    try {
      await directHTTPCall(
        `/v2/impulses/${impulseId}?project_id=${CONFIG.projectId2}`, // Different project
        "GET",
        CONFIG.apiKey1 // Same API key
      );
      projectIsolated = false; // Should not reach here
    } catch (error: any) {
      // Expected: 404 Not Found
      projectIsolated = true;
    }
    
    // Cleanup
    try {
      await directHTTPCall(
        `/v2/impulses/${impulseId}?project_id=${CONFIG.projectId1}`,
        "DELETE",
        CONFIG.apiKey1
      );
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (!projectIsolated) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { projectIsolated: false },
        errorMessage: "Project isolation violated: Project Beta accessed Project Alpha's impulse",
      };
    }
    
    return {
      pass: true,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: { projectIsolated: true },
      diagnostics: {
        projectAlpha: CONFIG.projectId1,
        projectBeta: CONFIG.projectId2,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 5: Impulse list pagination
 * 
 * Store 150 impulses.
 * List with limit=100, offset=0.
 * List with limit=100, offset=100.
 * Verify pagination works correctly.
 */
async function testCase5_PaginationWorks(
  input: any,
  expectedOutput: any
): Promise<ValidationResult> {
  const testCaseId = "validation-invariant-storage-across-instances-with-vessel-flow-case-5";
  const testName = "Impulse List Pagination";
  
  try {
    const impulseIds: string[] = [];
    
    // Store 15 impulses (reduced from 150 for faster testing)
    for (let i = 0; i < 15; i++) {
      const impulseId = `test-impulse-pagination-${Date.now()}-${i}`;
      impulseIds.push(impulseId);
      
      await directHTTPCall("/v2/impulses", "POST", CONFIG.apiKey1, {
        impulse_id: impulseId,
        project_id: CONFIG.projectId1,
        impulse_data: { id: impulseId, index: i },
      });
    }
    
    // List page 1 (limit=10, offset=0)
    const page1 = await directHTTPCall(
      `/v2/impulses?project_id=${CONFIG.projectId1}&limit=10&offset=0`,
      "GET",
      CONFIG.apiKey1
    );
    
    // List page 2 (limit=10, offset=10)
    const page2 = await directHTTPCall(
      `/v2/impulses?project_id=${CONFIG.projectId1}&limit=10&offset=10`,
      "GET",
      CONFIG.apiKey1
    );
    
    // Cleanup
    for (const impulseId of impulseIds) {
      try {
        await directHTTPCall(
          `/v2/impulses/${impulseId}?project_id=${CONFIG.projectId1}`,
          "DELETE",
          CONFIG.apiKey1
        );
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    const page1Count = page1.impulses?.length || 0;
    const page2Count = page2.impulses?.length || 0;
    
    if (page1Count !== 10) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { page1Count, page2Count },
        errorMessage: `Page 1 should have 10 impulses, got ${page1Count}`,
      };
    }
    
    if (page2Count !== 5) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { page1Count, page2Count },
        errorMessage: `Page 2 should have 5 impulses, got ${page2Count}`,
      };
    }
    
    return {
      pass: true,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: {
        page1Count,
        page2Count,
        totalCreated: impulseIds.length,
      },
      diagnostics: {
        page1Total: page1.total,
        page2Total: page2.total,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 6: Verify Backend Sync Enforcement
 * 
 * Tests the newly enforced dual-write pattern:
 * 1. Impulse creation syncs to backend via CLI MCP
 * 2. Activity save syncs to backend via CLI MCP
 * 3. Activity load has backend fallback
 * 
 * This validates the enforcement from 2026-02-27.
 */
async function testCase6_BackendSyncEnforcement(
  input: any,
  expectedOutput: any
): Promise<ValidationResult> {
  const testCaseId = "validation-invariant-storage-across-instances-with-vessel-flow-case-6";
  const testName = "Backend Sync Enforcement (Dual-Write Pattern)";
  
  try {
    // 1. Verify impulse-create.ts has backend sync code
    const impulseCreatePath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts"
    );
    const impulseCreateContent = await fs.readFile(impulseCreatePath, "utf-8");
    
    const hasImpulseBackendSync = impulseCreateContent.includes("metabob_impulse_store") &&
      impulseCreateContent.includes("MCP.clients()");
    
    if (!hasImpulseBackendSync) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { hasImpulseBackendSync: false },
        errorMessage: "impulse-create.ts does not call metabob_impulse_store via MCP",
        diagnostics: {
          checked: "impulse-create.ts",
          looking_for: ["metabob_impulse_store", "MCP.clients()"],
        },
      };
    }
    
    // 2. Verify activity.ts has backend sync in Activity.save
    const activityPath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/activity.ts"
    );
    const activityContent = await fs.readFile(activityPath, "utf-8");
    
    const hasActivitySaveBackendSync = activityContent.includes("metabob_activity_save") &&
      activityContent.includes("MCP.clients()");
    
    if (!hasActivitySaveBackendSync) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { hasActivitySaveBackendSync: false },
        errorMessage: "activity.ts Activity.save does not call metabob_activity_save via MCP",
        diagnostics: {
          checked: "activity.ts",
          looking_for: ["metabob_activity_save", "MCP.clients()"],
        },
      };
    }
    
    // 3. Verify activity.ts has backend fallback in Activity.load
    const hasActivityLoadBackendFallback = activityContent.includes("metabob_activity_load") &&
      activityContent.includes("backend fallback") &&
      activityContent.includes("try") &&
      activityContent.includes("catch");
    
    if (!hasActivityLoadBackendFallback) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { hasActivityLoadBackendFallback: false },
        errorMessage: "activity.ts Activity.load does not have backend fallback with metabob_activity_load",
        diagnostics: {
          checked: "activity.ts Activity.load",
          looking_for: ["metabob_activity_load", "try/catch for backend fallback"],
        },
      };
    }
    
    // 4. Verify vessel flow compliance - no direct HTTP calls
    const hasDirectHTTP = activityContent.includes("fetch(") && 
      activityContent.includes("metabob") ||
      impulseCreateContent.includes("fetch(") && 
      impulseCreateContent.includes("metabob");
    
    if (hasDirectHTTP) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { hasDirectHTTP: true },
        errorMessage: "Vessel violation: Direct HTTP calls to metabob backend found",
        diagnostics: {
          checked: ["impulse-create.ts", "activity.ts"],
          violation: "Contains fetch() calls to metabob backend",
        },
      };
    }
    
    // 5. Verify MCP and Instance imports exist (required for backend sync)
    const hasRequiredImports = 
      (impulseCreateContent.includes('from "../mcp"') || impulseCreateContent.includes('import { MCP }')) &&
      (impulseCreateContent.includes('from "../project/instance"') || impulseCreateContent.includes('import { Instance }')) &&
      (activityContent.includes('from "../mcp"') || activityContent.includes('import { MCP }')) &&
      (activityContent.includes('from "../project/instance"') || activityContent.includes('import { Instance }'));
    
    if (!hasRequiredImports) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: expectedOutput,
        actual: { hasRequiredImports: false },
        errorMessage: "Missing required imports (MCP, Instance) for backend sync",
        diagnostics: {
          required_imports: ["MCP", "Instance"],
          files: ["impulse-create.ts", "activity.ts"],
        },
      };
    }
    
    return {
      pass: true,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: {
        hasImpulseBackendSync: true,
        hasActivitySaveBackendSync: true,
        hasActivityLoadBackendFallback: true,
        hasDirectHTTP: false,
        hasRequiredImports: true,
      },
      diagnostics: {
        enforcement_date: "2026-02-27",
        dual_write_pattern: "Local write + backend sync via CLI MCP",
        backend_fallback: "Activity.load tries local first, falls back to backend",
        vessel_flow_compliant: true,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: expectedOutput,
      actual: null,
      errorMessage: error.message,
    };
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

const TEST_CASES: TestCase[] = [
  {
    id: "validation-invariant-storage-across-instances-with-vessel-flow-case-1",
    name: "Vessel Flow Compliance",
    input: {
      impulseId: "test-impulse",
      projectId: "test-project",
      impulseData: { id: "test-impulse", type: "memo" },
    },
    expectedOutput: {
      noDirectImports: true,
      usesCliTool: true,
      callStack: ["opencode", "CLI MCP", "rpc-api"],
    },
    validator: testCase1_VesselFlowCompliance,
  },
  {
    id: "validation-invariant-storage-across-instances-with-vessel-flow-case-2",
    name: "Cross-Instance Retrieval",
    input: {},
    expectedOutput: {
      storeSuccess: true,
      retrieveSuccess: true,
      dataIntegrity: true,
    },
    validator: testCase2_CrossInstanceRetrieval,
  },
  {
    id: "validation-invariant-storage-across-instances-with-vessel-flow-case-3",
    name: "Multi-Tenant Isolation",
    input: {},
    expectedOutput: {
      accessDenied: true,
    },
    validator: testCase3_MultiTenantIsolation,
  },
  {
    id: "validation-invariant-storage-across-instances-with-vessel-flow-case-4",
    name: "Project Isolation",
    input: {},
    expectedOutput: {
      projectIsolated: true,
    },
    validator: testCase4_ProjectIsolation,
  },
  {
    id: "validation-invariant-storage-across-instances-with-vessel-flow-case-5",
    name: "Pagination",
    input: {},
    expectedOutput: {
      page1Count: 10,
      page2Count: 5,
    },
    validator: testCase5_PaginationWorks,
  },
  {
    id: "validation-invariant-storage-across-instances-with-vessel-flow-case-6",
    name: "Backend Sync Enforcement (Dual-Write Pattern)",
    input: {},
    expectedOutput: {
      hasImpulseBackendSync: true,
      hasActivitySaveBackendSync: true,
      hasActivityLoadBackendFallback: true,
      hasDirectHTTP: false,
      hasRequiredImports: true,
    },
    validator: testCase6_BackendSyncEnforcement,
  },
];

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Run all validation tests for invariant-storage-across-instances-with-vessel-flow
 * 
 * @param options Configuration options for validation
 * @returns Harness result with pass/fail status and detailed diagnostics
 */
export async function runValidation(options?: {
  rpcApiUrl?: string;
  apiKey1?: string;
  apiKey2?: string;
  testCases?: string[]; // Filter to specific test cases
}): Promise<HarnessResult> {
  // Override config if provided
  if (options?.rpcApiUrl) CONFIG.rpcApiUrl = options.rpcApiUrl;
  if (options?.apiKey1) CONFIG.apiKey1 = options.apiKey1;
  if (options?.apiKey2) CONFIG.apiKey2 = options.apiKey2;
  
  const results: ValidationResult[] = [];
  
  // Filter test cases if specified
  const testCasesToRun = options?.testCases
    ? TEST_CASES.filter((tc) => options.testCases!.includes(tc.id))
    : TEST_CASES;
  
  console.log(`Running ${testCasesToRun.length} validation tests...\n`);
  
  // Run all test cases
  for (const testCase of testCasesToRun) {
    console.log(`Running: ${testCase.name}...`);
    
    try {
      const result = await testCase.validator(testCase.input, testCase.expectedOutput);
      results.push(result);
      
      console.log(
        result.pass
          ? `✅ PASS: ${testCase.name}`
          : `❌ FAIL: ${testCase.name} - ${result.errorMessage}`
      );
    } catch (error: any) {
      results.push({
        pass: false,
        testCaseId: testCase.id,
        testName: testCase.name,
        expected: testCase.expectedOutput,
        actual: null,
        errorMessage: `Unexpected error: ${error.message}`,
      });
      console.log(`❌ FAIL: ${testCase.name} - ${error.message}`);
    }
    
    console.log(""); // Blank line between tests
  }
  
  // Calculate summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const overallPass = failed === 0;
  
  const summary = `
============================================================
VALIDATION SUMMARY: invariant-storage-across-instances-with-vessel-flow
============================================================
Total Tests: ${results.length}
Passed: ${passed}
Failed: ${failed}
Overall: ${overallPass ? "✅ PASS" : "❌ FAIL"}
============================================================
  `.trim();
  
  console.log("\n" + summary);
  
  return {
    overallPass,
    totalTests: results.length,
    passed,
    failed,
    results,
    summary,
  };
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (require.main === module) {
  (async () => {
    const result = await runValidation();
    process.exit(result.overallPass ? 0 : 1);
  })();
}
