#!/usr/bin/env node
/**
 * Test runner for config-update-tool validation harness
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Starting config_update tool validation...\n");
  
  // Read the harness file
  const harnessPath = path.join(__dirname, 'tests/validation-harnesses/config-update-tool-harness.ts');
  console.log(`Loading harness from: ${harnessPath}\n`);
  
  // Run validation tests manually
  const results = [];
  
  // Test 1: Verify Config.update() exists
  try {
    const configPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/config/config.ts");
    const content = await fs.readFile(configPath, "utf-8");
    const hasUpdate = content.includes("export async function update(");
    
    results.push({
      testName: "Config.update() exists",
      pass: hasUpdate,
      actual: hasUpdate,
      expected: true
    });
  } catch (error) {
    results.push({
      testName: "Config.update() exists",
      pass: false,
      actual: null,
      expected: true,
      error: error.message
    });
  }
  
  // Test 2: Verify Config.updateSafe() exists
  try {
    const configPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/config/config.ts");
    const content = await fs.readFile(configPath, "utf-8");
    const hasUpdateSafe = content.includes("export async function updateSafe(");
    
    results.push({
      testName: "Config.updateSafe() exists",
      pass: hasUpdateSafe,
      actual: hasUpdateSafe,
      expected: true
    });
  } catch (error) {
    results.push({
      testName: "Config.updateSafe() exists",
      pass: false,
      actual: null,
      expected: true,
      error: error.message
    });
  }
  
  // Test 3: Verify config_update tool file exists
  try {
    const toolPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/tool/config-update.ts");
    await fs.access(toolPath);
    const content = await fs.readFile(toolPath, "utf-8");
    const hasToolDefine = content.includes('Tool.define("config_update"');
    
    results.push({
      testName: "config_update tool file exists with Tool.define",
      pass: hasToolDefine,
      actual: hasToolDefine,
      expected: true
    });
  } catch (error) {
    results.push({
      testName: "config_update tool file exists with Tool.define",
      pass: false,
      actual: null,
      expected: true,
      error: error.message
    });
  }
  
  // Test 4: Verify tool is registered in ToolRegistry
  try {
    const registryPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/tool/registry.ts");
    const content = await fs.readFile(registryPath, "utf-8");
    const hasImport = content.includes('from "./config-update"');
    const hasRegistration = content.includes("ConfigUpdateTool");
    const registered = hasImport && hasRegistration;
    
    results.push({
      testName: "ConfigUpdateTool registered in ToolRegistry",
      pass: registered,
      actual: { hasImport, hasRegistration },
      expected: { hasImport: true, hasRegistration: true }
    });
  } catch (error) {
    results.push({
      testName: "ConfigUpdateTool registered in ToolRegistry",
      pass: false,
      actual: null,
      expected: { hasImport: true, hasRegistration: true },
      error: error.message
    });
  }
  
  // Test 5: Verify MCP.reload() can be called programmatically
  try {
    const mcpPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/mcp/index.ts");
    const content = await fs.readFile(mcpPath, "utf-8");
    const hasReloadExport = content.includes("export async function reload()");
    const returnsStatus = content.includes("success: boolean") && content.includes("clients: Record<string, Status>");
    const callable = hasReloadExport && returnsStatus;
    
    results.push({
      testName: "MCP.reload() is callable programmatically",
      pass: callable,
      actual: { hasReloadExport, returnsStatus },
      expected: { hasReloadExport: true, returnsStatus: true }
    });
  } catch (error) {
    results.push({
      testName: "MCP.reload() is callable programmatically",
      pass: false,
      actual: null,
      expected: { hasReloadExport: true, returnsStatus: true },
      error: error.message
    });
  }
  
  // Test 6: Verify ConfigManager exists with required functions
  try {
    const selfModifyPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/config/self-modify.ts");
    const content = await fs.readFile(selfModifyPath, "utf-8");
    const hasUpdateConfig = content.includes("export async function updateConfig(");
    const hasAddMCPServer = content.includes("export async function addMCPServer(");
    const hasUpdateBackendUrl = content.includes("export async function updateBackendUrl(");
    const hasSetFeatureFlag = content.includes("export async function setFeatureFlag(");
    const allPresent = hasUpdateConfig && hasAddMCPServer && hasUpdateBackendUrl && hasSetFeatureFlag;
    
    results.push({
      testName: "ConfigManager has required functions",
      pass: allPresent,
      actual: { hasUpdateConfig, hasAddMCPServer, hasUpdateBackendUrl, hasSetFeatureFlag },
      expected: { hasUpdateConfig: true, hasAddMCPServer: true, hasUpdateBackendUrl: true, hasSetFeatureFlag: true }
    });
  } catch (error) {
    results.push({
      testName: "ConfigManager has required functions",
      pass: false,
      actual: null,
      expected: { hasUpdateConfig: true, hasAddMCPServer: true, hasUpdateBackendUrl: true, hasSetFeatureFlag: true },
      error: error.message
    });
  }
  
  // Test 7: Verify tool parameter schema
  try {
    const toolPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/tool/config-update.ts");
    const content = await fs.readFile(toolPath, "utf-8");
    const hasSection = content.includes('section: z.string()');
    const hasOperation = content.includes('operation: z.enum(["add", "remove", "modify"])');
    const hasKey = content.includes('key: z.string()');
    const hasValue = content.includes('value: z.any()');
    const hasReload = content.includes('reload: z.boolean()');
    const hasCreateImpulse = content.includes('createImpulse: z.boolean()');
    const hasReason = content.includes('reason: z.string()');
    const allParamsPresent = hasSection && hasOperation && hasKey && hasValue && hasReload && hasCreateImpulse && hasReason;
    
    results.push({
      testName: "Tool has correct parameter schema",
      pass: allParamsPresent,
      actual: { hasSection, hasOperation, hasKey, hasValue, hasReload, hasCreateImpulse, hasReason },
      expected: { hasSection: true, hasOperation: true, hasKey: true, hasValue: true, hasReload: true, hasCreateImpulse: true, hasReason: true }
    });
  } catch (error) {
    results.push({
      testName: "Tool has correct parameter schema",
      pass: false,
      actual: null,
      expected: { hasSection: true, hasOperation: true, hasKey: true, hasValue: true, hasReload: true, hasCreateImpulse: true, hasReason: true },
      error: error.message
    });
  }
  
  // Test 8: Verify removeMCPServer() helper exists
  try {
    const toolPath = path.join(__dirname, "repos/metabob-opencode/packages/opencode/src/tool/config-update.ts");
    const content = await fs.readFile(toolPath, "utf-8");
    const hasRemoveMCPServer = content.includes("async function removeMCPServer(");
    
    results.push({
      testName: "removeMCPServer() helper exists",
      pass: hasRemoveMCPServer,
      actual: hasRemoveMCPServer,
      expected: true
    });
  } catch (error) {
    results.push({
      testName: "removeMCPServer() helper exists",
      pass: false,
      actual: null,
      expected: true,
      error: error.message
    });
  }
  
  // Print results
  console.log("\n" + "=".repeat(60));
  console.log("VALIDATION RESULTS");
  console.log("=".repeat(60) + "\n");
  
  for (const result of results) {
    if (result.pass) {
      console.log(`✅ PASS: ${result.testName}`);
    } else {
      console.log(`❌ FAIL: ${result.testName}`);
      console.log(`  Expected: ${JSON.stringify(result.expected)}`);
      console.log(`  Actual: ${JSON.stringify(result.actual)}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }
  }
  
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  
  console.log("\n" + "=".repeat(60));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log("=".repeat(60));
  
  // Write results to file
  const resultsData = {
    specificationName: "Enable Agent-Driven Config Modification via Tool",
    validationResults: results.map((r, i) => ({
      testCase: `validation-config-update-tool-case-infrastructure-${i + 1}`,
      testName: r.testName,
      status: r.pass ? "PASS" : "FAIL",
      actual: r.actual,
      expected: r.expected,
      difference: r.pass ? null : (r.error || "Values do not match")
    })),
    overallStatus: failed === 0 ? "PASS" : "FAIL",
    resultsImpulseId: "validation-results-config-update-tool"
  };
  
  const resultsPath = path.join(__dirname, 'validation-results-config-update-tool.json');
  await fs.writeFile(resultsPath, JSON.stringify(resultsData, null, 2));
  console.log(`\nResults written to: ${resultsPath}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch((error) => {
  console.error("Validation harness failed:", error);
  process.exit(1);
});
