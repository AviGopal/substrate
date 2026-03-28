/**
 * Validation Harness: devbob-independent-execution-validation
 * 
 * Tests DevBob container's ability to independently execute opencode commands
 * with proper service connectivity and credential access.
 * 
 * This harness validates:
 * - Provider initialization (no ProviderInitError)
 * - SDK preloading (loaded count > 0)
 * - Service connectivity (metabob-rpc-api, surrealdb)
 * - Environment variables (API keys present)
 * - Activity execution capability
 * 
 * Usage:
 *   bun run tests/validation-harnesses/devbob-independent-execution-validation-harness.ts
 * 
 * Output:
 *   /tmp/validation-results.json with PASS/FAIL for each test case
 */

// @ts-ignore - Bun runtime required
import { $ } from "bun";
import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";

interface TestCase {
  id: string;
  name: string;
  input: unknown;
  expectedOutput: unknown;
}

interface ValidationResult {
  testCaseId: string;
  testName: string;
  pass: boolean;
  actual: unknown;
  expected: unknown;
  error?: string;
  timestamp: string;
}

interface HarnessOutput {
  specificationName: string;
  timestamp: string;
  overallPass: boolean;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Test Case 1: SDK Preload Validation
 * Verifies that Anthropic SDK is preloaded in the binary
 */
async function testSDKPreload(): Promise<ValidationResult> {
  const testCase: TestCase = {
    id: "validation-devbob-independent-execution-validation-case-1",
    name: "SDK Preload Check",
    input: "opencode run 'test'",
    expectedOutput: { loaded: "1+", packages: ["anthropic"] }
  };

  try {
    const result = await $`opencode run 'test' 2>&1 | grep 'SDK loader' || echo "NOT_FOUND"`.text();
    
    // Parse loaded count from "SDK loader initialized: total=2 loaded=1 packages=[...]"
    const loadedMatch = result.match(/loaded=(\d+)/);
    const loadedCount = loadedMatch ? parseInt(loadedMatch[1]) : 0;
    
    const pass = loadedCount > 0;
    
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass,
      actual: { loaded: loadedCount, output: result.trim() },
      expected: testCase.expectedOutput,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Case 2: Provider Initialization
 * Verifies that opencode can initialize providers without ProviderInitError
 */
async function testProviderInit(): Promise<ValidationResult> {
  const testCase: TestCase = {
    id: "validation-devbob-independent-execution-validation-case-2",
    name: "Provider Initialization Check",
    input: "opencode run 'What is 2+2?'",
    expectedOutput: { noError: true, responseReceived: true }
  };

  try {
    const result = await $`timeout 15s opencode run 'What is 2+2?' 2>&1`.text();
    
    const hasProviderInitError = result.includes("ProviderInitError");
    const hasResponse = result.length > 0 && !hasProviderInitError;
    
    const pass = !hasProviderInitError && hasResponse;
    
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass,
      actual: { 
        noError: !hasProviderInitError, 
        responseReceived: hasResponse,
        outputPreview: result.substring(0, 200)
      },
      expected: testCase.expectedOutput,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Case 3: Service Connectivity - metabob-rpc-api
 * Verifies that metabob-rpc-api service is reachable
 */
async function testRPCAPIConnectivity(): Promise<ValidationResult> {
  const testCase: TestCase = {
    id: "validation-devbob-independent-execution-validation-case-3",
    name: "RPC API Service Connectivity",
    input: "http://metabob-rpc-api.metabob.svc.cluster.local:8080/status",
    expectedOutput: { reachable: true, statusOk: true }
  };

  try {
    const result = await $`curl -s -m 5 http://metabob-rpc-api.metabob.svc.cluster.local:8080/status 2>&1`.text();
    
    const reachable = !result.includes("FAILED") && !result.includes("Connection refused");
    const statusOk = result.includes("status") || result.includes("ok") || result.includes("healthy");
    
    const pass = reachable && statusOk;
    
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass,
      actual: { reachable, statusOk, response: result.trim() },
      expected: testCase.expectedOutput,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass: false,
      actual: { reachable: false, statusOk: false },
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Case 4: Service Connectivity - SurrealDB
 * Verifies that SurrealDB service is reachable
 */
async function testSurrealDBConnectivity(): Promise<ValidationResult> {
  const testCase: TestCase = {
    id: "validation-devbob-independent-execution-validation-case-4",
    name: "SurrealDB Service Connectivity",
    input: "http://surrealdb.metabob.svc.cluster.local:8000/health",
    expectedOutput: { reachable: true }
  };

  try {
    const result = await $`curl -s -m 5 http://surrealdb.metabob.svc.cluster.local:8000/health 2>&1`.text();
    
    const reachable = !result.includes("FAILED") && !result.includes("Connection refused");
    
    const pass = reachable;
    
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass,
      actual: { reachable, response: result.trim() },
      expected: testCase.expectedOutput,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass: false,
      actual: { reachable: false },
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Case 5: Environment Variables
 * Verifies that required API keys are present
 */
async function testEnvironmentVariables(): Promise<ValidationResult> {
  const testCase: TestCase = {
    id: "validation-devbob-independent-execution-validation-case-5",
    name: "Environment Variables Check",
    input: ["ANTHROPIC_API_KEY", "METABOB_API_KEY"],
    expectedOutput: { anthropicPresent: true, metabobPresent: true }
  };

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const metabobKey = process.env.METABOB_API_KEY;
    
    const anthropicPresent = !!anthropicKey && anthropicKey.length > 0;
    const metabobPresent = !!metabobKey && metabobKey.length > 0;
    
    const pass = anthropicPresent && metabobPresent;
    
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass,
      actual: { 
        anthropicPresent, 
        metabobPresent,
        anthropicLength: anthropicKey?.length || 0,
        metabobLength: metabobKey?.length || 0
      },
      expected: testCase.expectedOutput,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Case 6: Config File Substitution
 * Verifies that API keys are substituted in opencode config
 */
async function testConfigSubstitution(): Promise<ValidationResult> {
  const testCase: TestCase = {
    id: "validation-devbob-independent-execution-validation-case-6",
    name: "Config File API Key Substitution",
    input: "/workspace/.config/opencode/opencode.json",
    expectedOutput: { fileExists: true, keySubstituted: true }
  };

  try {
    const configPath = "/workspace/.config/opencode/opencode.json";
    const fileExists = existsSync(configPath);
    
    if (!fileExists) {
      return {
        testCaseId: testCase.id,
        testName: testCase.name,
        pass: false,
        actual: { fileExists: false, keySubstituted: false },
        expected: testCase.expectedOutput,
        error: "Config file not found",
        timestamp: new Date().toISOString()
      };
    }
    
    const configContent = await readFile(configPath, "utf-8");
    const keySubstituted = configContent.includes("sk-ant-") && !configContent.includes("${ANTHROPIC_API_KEY}");
    
    const pass = fileExists && keySubstituted;
    
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass,
      actual: { fileExists, keySubstituted },
      expected: testCase.expectedOutput,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Case 7: Activity List Command
 * Verifies that activity commands can be executed
 */
async function testActivityList(): Promise<ValidationResult> {
  const testCase: TestCase = {
    id: "validation-devbob-independent-execution-validation-case-7",
    name: "Activity List Command",
    input: "opencode activity list",
    expectedOutput: { commandSucceeds: true, noErrors: true }
  };

  try {
    const result = await $`cd /workspace && opencode activity list 2>&1`.text();
    
    const noErrors = !result.includes("Error") && !result.includes("ENOENT");
    const commandSucceeds = result.length > 0 && (
      result.includes("template") || 
      result.includes("activity") || 
      result.includes("No activities")
    );
    
    const pass = commandSucceeds && noErrors;
    
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass,
      actual: { commandSucceeds, noErrors, outputPreview: result.substring(0, 200) },
      expected: testCase.expectedOutput,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Main validation runner
 * Executes all test cases and generates report
 */
export async function runValidation(): Promise<HarnessOutput> {
  console.log("=================================================================");
  console.log("DevBob Independent Execution Validation Harness");
  console.log("=================================================================\n");

  const results: ValidationResult[] = [];

  // Run all test cases
  console.log("Running test cases...\n");
  
  results.push(await testSDKPreload());
  results.push(await testProviderInit());
  results.push(await testRPCAPIConnectivity());
  results.push(await testSurrealDBConnectivity());
  results.push(await testEnvironmentVariables());
  results.push(await testConfigSubstitution());
  results.push(await testActivityList());

  // Calculate summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const overallPass = failed === 0;

  const output: HarnessOutput = {
    specificationName: "devbob-independent-execution-validation",
    timestamp: new Date().toISOString(),
    overallPass,
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  };

  // Print results
  console.log("\nResults:");
  console.log("-------------------------------------------------------------------");
  for (const result of results) {
    const status = result.pass ? "✓ PASS" : "✗ FAIL";
    console.log(`${status}: ${result.testName}`);
    if (!result.pass && result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
  
  console.log("\n=================================================================");
  console.log(`Summary: ${passed}/${results.length} passed`);
  console.log(`Overall: ${overallPass ? "✓ PASS" : "✗ FAIL"}`);
  console.log("=================================================================\n");

  // Write to /tmp/validation-results.json
  const outputPath = "/tmp/validation-results.json";
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Results written to: ${outputPath}\n`);

  return output;
}

// Run if executed directly
// @ts-ignore - Bun-specific property
if (import.meta.main) {
  const output = await runValidation();
  process.exit(output.overallPass ? 0 : 1);
}
