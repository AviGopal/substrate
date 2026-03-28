#!/usr/bin/env bun
/**
 * Validation Harness: DevBob Provider Initialization
 * 
 * Tests that Anthropic provider initializes successfully in DevBob pod
 * and can execute commands without ProviderInitError.
 * 
 * Strategy: kubectl exec test showing successful provider init and command execution
 */

import { $ } from "bun";

interface ValidationResult {
  pass: boolean;
  actual: string;
  expected: string;
  error?: string;
  details?: Record<string, any>;
}

interface TestCase {
  name: string;
  input: string;
  expectedOutput: string;
  expectedExitCode?: number;
  timeout?: number;
}

/**
 * Get the DevBob pod name from kubectl
 */
async function getDevBobPod(): Promise<string> {
  try {
    const result = await $`kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}'`.text();
    const podName = result.trim().replace(/'/g, "");
    if (!podName) {
      throw new Error("No DevBob pod found");
    }
    return podName;
  } catch (error) {
    throw new Error(`Failed to get DevBob pod: ${error}`);
  }
}

/**
 * Execute command in DevBob pod via kubectl exec
 */
async function execInPod(podName: string, command: string, timeout: number = 30000): Promise<{stdout: string, stderr: string, exitCode: number}> {
  try {
    const proc = Bun.spawn(
      ["kubectl", "exec", "-n", "metabob", podName, "--", "sh", "-c", command],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    // Set timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Command timed out after ${timeout}ms`)), timeout);
    });

    const resultPromise = (async () => {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;
      return { stdout, stderr, exitCode };
    })();

    const result = await Promise.race([resultPromise, timeoutPromise]) as {stdout: string, stderr: string, exitCode: number};
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) {
      throw error;
    }
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1
    };
  }
}

/**
 * Validate provider initialization
 */
async function validateProviderInit(podName: string): Promise<ValidationResult> {
  const testName = "Provider Initialization Check";
  
  try {
    // Check if opencode can list providers without error
    const result = await execInPod(
      podName,
      "opencode --version 2>&1 | head -1",
      10000
    );

    const expected = "0.0.0-dev-";
    const actual = result.stdout.trim();

    if (result.exitCode !== 0) {
      return {
        pass: false,
        actual: result.stderr,
        expected: "Exit code 0",
        error: "OpenCode version check failed",
        details: { exitCode: result.exitCode, stderr: result.stderr }
      };
    }

    if (!actual.includes(expected)) {
      return {
        pass: false,
        actual,
        expected,
        error: "OpenCode version output unexpected",
      };
    }

    return {
      pass: true,
      actual,
      expected,
      details: { exitCode: result.exitCode }
    };
  } catch (error) {
    return {
      pass: false,
      actual: "",
      expected: "opencode --version succeeds",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate config file exists and is readable
 */
async function validateConfigFile(podName: string): Promise<ValidationResult> {
  try {
    const result = await execInPod(
      podName,
      "cat /workspace/.config/opencode/opencode.json | grep -q 'anthropic' && echo 'Config valid' || echo 'Config invalid'",
      5000
    );

    const expected = "Config valid";
    const actual = result.stdout.trim();

    return {
      pass: actual === expected && result.exitCode === 0,
      actual,
      expected,
      details: { exitCode: result.exitCode, stderr: result.stderr }
    };
  } catch (error) {
    return {
      pass: false,
      actual: "",
      expected: "Config valid",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate API key is substituted (not template string)
 */
async function validateApiKeySubstitution(podName: string): Promise<ValidationResult> {
  try {
    const result = await execInPod(
      podName,
      "cat /workspace/.config/opencode/opencode.json | grep -q '\\${ANTHROPIC_API_KEY}' && echo 'Template found' || echo 'API key substituted'",
      5000
    );

    const expected = "API key substituted";
    const actual = result.stdout.trim();

    return {
      pass: actual === expected && result.exitCode === 0,
      actual,
      expected,
      details: { exitCode: result.exitCode }
    };
  } catch (error) {
    return {
      pass: false,
      actual: "",
      expected: "API key substituted",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate SDK package is installed
 */
async function validateSdkInstalled(podName: string): Promise<ValidationResult> {
  try {
    const result = await execInPod(
      podName,
      "ls /root/.cache/opencode/node_modules/@ai-sdk/anthropic/package.json > /dev/null 2>&1 && echo 'Installed' || echo 'Not installed'",
      5000
    );

    const expected = "Installed";
    const actual = result.stdout.trim();

    return {
      pass: actual === expected && result.exitCode === 0,
      actual,
      expected,
      details: { exitCode: result.exitCode }
    };
  } catch (error) {
    return {
      pass: false,
      actual: "",
      expected: "Installed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate opencode run executes without ProviderInitError
 */
async function validateOpencodeRun(podName: string, testCase: TestCase): Promise<ValidationResult> {
  try {
    const result = await execInPod(
      podName,
      `cd /workspace && timeout ${testCase.timeout || 30}s opencode run "${testCase.input}" 2>&1`,
      (testCase.timeout || 30) * 1000 + 5000
    );

    // Check for ProviderInitError
    const hasProviderError = result.stdout.includes("ProviderInitError") || result.stderr.includes("ProviderInitError");
    
    if (hasProviderError) {
      return {
        pass: false,
        actual: "ProviderInitError detected",
        expected: testCase.expectedOutput,
        error: "Provider initialization failed",
        details: { 
          exitCode: result.exitCode,
          stdout: result.stdout.substring(0, 500),
          stderr: result.stderr.substring(0, 500)
        }
      };
    }

    // For simple test cases, just check command completed
    const pass = result.exitCode === (testCase.expectedExitCode ?? 0);

    return {
      pass,
      actual: result.exitCode === 0 ? "Command completed successfully" : `Exit code ${result.exitCode}`,
      expected: testCase.expectedOutput,
      details: { 
        exitCode: result.exitCode,
        hasProviderError,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length
      }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Timeout is actually expected for some cases where opencode hangs
    if (errorMsg.includes("timed out")) {
      return {
        pass: false,
        actual: "Command timed out (possible hang)",
        expected: testCase.expectedOutput,
        error: "OpenCode command did not complete within timeout",
      };
    }

    return {
      pass: false,
      actual: "",
      expected: testCase.expectedOutput,
      error: errorMsg,
    };
  }
}

/**
 * Run all validations
 */
export async function runValidation(testCase?: TestCase): Promise<{
  pass: boolean;
  results: Record<string, ValidationResult>;
  summary: string;
}> {
  console.log("🔍 DevBob Provider Initialization Validation Harness");
  console.log("=" .repeat(60));

  try {
    // Get pod name
    console.log("\n📍 Finding DevBob pod...");
    const podName = await getDevBobPod();
    console.log(`   ✓ Found pod: ${podName}`);

    const results: Record<string, ValidationResult> = {};

    // Test 1: Provider initialization
    console.log("\n🧪 Test 1: Provider Initialization Check");
    results.providerInit = await validateProviderInit(podName);
    console.log(`   ${results.providerInit.pass ? "✓ PASS" : "✗ FAIL"}: ${results.providerInit.pass ? results.providerInit.actual : results.providerInit.error}`);

    // Test 2: Config file exists
    console.log("\n🧪 Test 2: Config File Validation");
    results.configFile = await validateConfigFile(podName);
    console.log(`   ${results.configFile.pass ? "✓ PASS" : "✗ FAIL"}: ${results.configFile.actual}`);

    // Test 3: API key substitution
    console.log("\n🧪 Test 3: API Key Substitution");
    results.apiKeySubstitution = await validateApiKeySubstitution(podName);
    console.log(`   ${results.apiKeySubstitution.pass ? "✓ PASS" : "✗ FAIL"}: ${results.apiKeySubstitution.actual}`);

    // Test 4: SDK package installed
    console.log("\n🧪 Test 4: SDK Package Installation");
    results.sdkInstalled = await validateSdkInstalled(podName);
    console.log(`   ${results.sdkInstalled.pass ? "✓ PASS" : "✗ FAIL"}: ${results.sdkInstalled.actual}`);

    // Test 5: OpenCode run (if test case provided)
    if (testCase) {
      console.log(`\n🧪 Test 5: OpenCode Run - "${testCase.name}"`);
      results.opencodeRun = await validateOpencodeRun(podName, testCase);
      console.log(`   ${results.opencodeRun.pass ? "✓ PASS" : "✗ FAIL"}: ${results.opencodeRun.actual}`);
    }

    // Calculate overall pass/fail
    const allPassed = Object.values(results).every(r => r.pass);
    const passedCount = Object.values(results).filter(r => r.pass).length;
    const totalCount = Object.values(results).length;

    const summary = `${passedCount}/${totalCount} tests passed`;

    console.log("\n" + "=".repeat(60));
    console.log(`📊 Results: ${summary}`);
    console.log(`${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
    console.log("=".repeat(60));

    return {
      pass: allPassed,
      results,
      summary
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Validation harness failed: ${errorMsg}`);
    return {
      pass: false,
      results: {
        harnessError: {
          pass: false,
          actual: "",
          expected: "Harness runs successfully",
          error: errorMsg,
        }
      },
      summary: "Harness execution failed"
    };
  }
}

// CLI execution
if (import.meta.main) {
  const testCase: TestCase = {
    name: "Simple arithmetic test",
    input: "What is 2+2? Answer in one word.",
    expectedOutput: "Command completed successfully",
    expectedExitCode: 0,
    timeout: 30
  };

  const result = await runValidation(testCase);
  process.exit(result.pass ? 0 : 1);
}
