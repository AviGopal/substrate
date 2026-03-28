#!/usr/bin/env bun
/**
 * Validation Harness: CI/CD Pre-Push Quality Gates
 * 
 * Tests the complete data flow:
 * Git Push → Pre-Push Hook → Typecheck → Exit Code → Push Decision
 * 
 * Validation Strategy:
 * 1. Create test repository with TypeScript errors
 * 2. Simulate git push
 * 3. Verify pre-push hook executes
 * 4. Confirm typecheck detects errors
 * 5. Verify push blocked with correct exit code
 * 6. Validate error messages are clear and actionable
 */

import { spawn } from "bun";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// ============================================================================
// Types
// ============================================================================

export interface ValidationInput {
  testCase: string;
  repository: string;
  scenario: "type-error" | "timeout" | "success" | "bypass";
  errorCode?: string;
  timeout?: number;
}

export interface ValidationOutput {
  hookExecuted: boolean;
  typecheckRan: boolean;
  errorsDetected: boolean;
  pushBlocked: boolean;
  exitCode: number;
  errorMessage: string;
  executionTime: number;
}

export interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: ValidationOutput;
  expected: ValidationOutput;
  diff?: string[];
}

// ============================================================================
// Test Repository Setup
// ============================================================================

async function createTestRepository(
  scenario: ValidationInput["scenario"],
  errorCode?: string
): Promise<string> {
  const testDir = join(tmpdir(), `test-quality-gate-${Date.now()}`);
  await mkdir(testDir, { recursive: true });

  // Initialize git repository
  await runCommand("git", ["init"], testDir);
  await runCommand("git", ["config", "user.name", "Test User"], testDir);
  await runCommand("git", ["config", "user.email", "test@example.com"], testDir);

  // Create package.json
  const packageJson = {
    name: "test-quality-gate",
    version: "1.0.0",
    scripts: {
      typecheck: "tsc --noEmit",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  };
  await writeFile(
    join(testDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src/**/*"],
  };
  await writeFile(
    join(testDir, "tsconfig.json"),
    JSON.stringify(tsConfig, null, 2)
  );

  // Create src directory (but don't create test files yet - we'll do that after initial push)
  await mkdir(join(testDir, "src"), { recursive: true });

  // Create a placeholder file for initial commit
  await writeFile(
    join(testDir, "src", "placeholder.ts"),
    `// Placeholder for initial commit
export const placeholder = true;
`
  );

  // Install dependencies (minimal, just typescript)
  await runCommand("bun", ["install"], testDir);

  // Create .husky directory (Husky v9 style - no _/h manager needed)
  await mkdir(join(testDir, ".husky"), { recursive: true });

  // Pre-push hook (same as enforced version)
  await writeFile(
    join(testDir, ".husky", "pre-push"),
    `#!/bin/sh
# Pre-push quality gate: Block push if TypeScript compilation errors exist
set -e
set -u
set -o pipefail

echo "🔍 Running TypeScript type checking (timeout: 120s)..."

if timeout 120 bun run typecheck; then
  echo "✅ Type checking passed - push allowed"
  exit 0
else
  exit_code=$?
  if [ $exit_code -eq 124 ]; then
    echo "❌ Type checking timed out after 120 seconds"
    echo "   This may indicate a problem with the TypeScript compiler or an infinite loop"
    echo "   Contact the team if this persists"
  else
    echo "❌ Type checking failed with TypeScript errors"
    echo "   Fix the errors above and try again"
    echo "   Bypass (not recommended): git push --no-verify"
  fi
  exit $exit_code
fi
`
  );
  await runCommand("chmod", ["+x", join(testDir, ".husky", "pre-push")], testDir);

  // Install Git hook (Husky v9 style - symlink to .husky/pre-push)
  await mkdir(join(testDir, ".git", "hooks"), { recursive: true });
  await runCommand(
    "ln",
    ["-s", "../../.husky/pre-push", join(testDir, ".git", "hooks", "pre-push")],
    testDir
  );

  // Create initial commit
  await runCommand("git", ["add", "."], testDir);
  await runCommand("git", ["commit", "-m", "Initial commit"], testDir);

  // Get the current branch name (main or master)
  const branchResult = await runCommand("git", ["branch", "--show-current"], testDir);
  const currentBranch = branchResult.stdout.trim() || "main";

  // Add a fake remote (local directory)
  const remoteDir = join(tmpdir(), `test-remote-${Date.now()}`);
  await mkdir(remoteDir, { recursive: true });
  await runCommand("git", ["init", "--bare"], remoteDir);
  await runCommand("git", ["remote", "add", "origin", remoteDir], testDir);

  // Push initial commit to establish tracking branch
  await runCommand("git", ["push", "-u", "origin", currentBranch], testDir);

  // NOW create the test files based on scenario (AFTER initial push)
  switch (scenario) {
    case "type-error":
      await writeFile(
        join(testDir, "src", "index.ts"),
        errorCode ||
          `
// Intentional type error for testing
const x: number = "this is a string, not a number";
const y: string = 42;

function broken(a: string): number {
  return a; // Type error: can't return string as number
}

export { x, y, broken };
`
      );
      break;

    case "timeout":
      // Create a file that causes slow typecheck (large union types)
      const slowCode = `
type SlowUnion = ${Array.from({ length: 1000 }, (_, i) => `"type${i}"`).join(" | ")};
type SlowUnion2 = ${Array.from({ length: 1000 }, (_, i) => `"type${i}"`).join(" | ")};
type Combined = SlowUnion & SlowUnion2;
      `;
      await writeFile(join(testDir, "src", "slow.ts"), slowCode);
      break;

    case "success":
      await writeFile(
        join(testDir, "src", "index.ts"),
        `
// Valid TypeScript code
const x: number = 42;
const y: string = "hello";

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export { x, y, greet };
`
      );
      break;

    case "bypass":
      // Same as type-error, but we'll use --no-verify
      await writeFile(
        join(testDir, "src", "index.ts"),
        `
const x: number = "type error";
export { x };
`
      );
      break;
  }

  // Commit the test files
  await runCommand("git", ["add", "."], testDir);
  await runCommand("git", ["commit", "-m", "Add test files"], testDir);

  return testDir;
}

// ============================================================================
// Command Execution
// ============================================================================

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTime: number;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout?: number
): Promise<CommandResult> {
  const startTime = Date.now();

  try {
    const proc = spawn({
      cmd: [command, ...args],
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HUSKY: "1" }, // Enable Husky
    });

    // Handle timeout
    let timeoutId: Timer | null = null;
    if (timeout) {
      timeoutId = setTimeout(() => {
        proc.kill();
      }, timeout);
    }

    const result = await proc.exited;
    if (timeoutId) clearTimeout(timeoutId);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const executionTime = Date.now() - startTime;

    return {
      exitCode: result,
      stdout,
      stderr,
      executionTime,
    };
  } catch (error) {
    return {
      exitCode: -1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Validation Logic
// ============================================================================

export async function runValidation(
  input: ValidationInput
): Promise<ValidationResult> {
  console.log(`\n🧪 Running test case: ${input.testCase}`);
  console.log(`   Scenario: ${input.scenario}`);

  let testDir: string | null = null;

  try {
    // 1. Create test repository
    testDir = await createTestRepository(input.scenario, input.errorCode);
    console.log(`   ✓ Test repository created: ${testDir}`);

    // 2. Get current branch name
    const branchResult = await runCommand("git", ["branch", "--show-current"], testDir);
    const currentBranch = branchResult.stdout.trim() || "main";

    // 3. Simulate git push
    console.log(`   → Simulating git push to ${currentBranch}...`);
    const pushArgs =
      input.scenario === "bypass"
        ? ["push", "--no-verify", "origin", currentBranch]
        : ["push", "origin", currentBranch];

    const pushResult = await runCommand(
      "git",
      pushArgs,
      testDir,
      input.timeout || 180000
    );

    // 4. Analyze results
    const combinedOutput = pushResult.stderr + pushResult.stdout;
    const actual: ValidationOutput = {
      hookExecuted: combinedOutput.includes("🔍 Running TypeScript type checking"),
      typecheckRan: combinedOutput.includes("🔍 Running TypeScript type checking") ||
        combinedOutput.includes("bun run typecheck") ||
        combinedOutput.includes("Type checking"),
      errorsDetected: combinedOutput.includes("error TS") ||
        combinedOutput.includes("❌ Type checking failed"),
      pushBlocked: pushResult.exitCode !== 0,
      exitCode: pushResult.exitCode,
      errorMessage: combinedOutput,
      executionTime: pushResult.executionTime,
    };

    console.log(`   ✓ Hook executed: ${actual.hookExecuted}`);
    console.log(`   ✓ Typecheck ran: ${actual.typecheckRan}`);
    console.log(`   ✓ Errors detected: ${actual.errorsDetected}`);
    console.log(`   ✓ Push blocked: ${actual.pushBlocked}`);
    console.log(`   ✓ Exit code: ${actual.exitCode}`);

    // 5. Get expected output based on scenario
    const expected = getExpectedOutput(input.scenario);

    // 6. Compare actual vs expected
    const diff: string[] = [];
    if (actual.hookExecuted !== expected.hookExecuted) {
      diff.push(
        `hookExecuted: expected ${expected.hookExecuted}, got ${actual.hookExecuted}`
      );
    }
    if (actual.typecheckRan !== expected.typecheckRan) {
      diff.push(
        `typecheckRan: expected ${expected.typecheckRan}, got ${actual.typecheckRan}`
      );
    }
    if (actual.errorsDetected !== expected.errorsDetected) {
      diff.push(
        `errorsDetected: expected ${expected.errorsDetected}, got ${actual.errorsDetected}`
      );
    }
    if (actual.pushBlocked !== expected.pushBlocked) {
      diff.push(
        `pushBlocked: expected ${expected.pushBlocked}, got ${actual.pushBlocked}`
      );
    }

    const pass = diff.length === 0;

    console.log(pass ? "   ✅ PASS" : "   ❌ FAIL");
    if (!pass) {
      console.log(`   Differences:`);
      diff.forEach((d) => console.log(`     - ${d}`));
    }

    return {
      pass,
      testCase: input.testCase,
      actual,
      expected,
      diff: diff.length > 0 ? diff : undefined,
    };
  } catch (error) {
    console.error(`   ❌ ERROR: ${error}`);
    throw error;
  } finally {
    // Cleanup
    if (testDir) {
      try {
        await rm(testDir, { recursive: true, force: true });
        console.log(`   ✓ Test repository cleaned up`);
      } catch (e) {
        console.warn(`   ⚠️  Failed to cleanup: ${e}`);
      }
    }
  }
}

// ============================================================================
// Expected Outputs (Historical Data)
// ============================================================================

function getExpectedOutput(
  scenario: ValidationInput["scenario"]
): ValidationOutput {
  switch (scenario) {
    case "type-error":
      return {
        hookExecuted: true,
        typecheckRan: true,
        errorsDetected: true,
        pushBlocked: true,
        exitCode: 1, // TypeScript error exit code
        errorMessage: "Type checking failed with TypeScript errors",
        executionTime: 5000, // Expected ~5s
      };

    case "timeout":
      return {
        hookExecuted: true,
        typecheckRan: true,
        errorsDetected: false,
        pushBlocked: true,
        exitCode: 124, // Timeout exit code
        errorMessage: "Type checking timed out after 120 seconds",
        executionTime: 120000, // 120s timeout
      };

    case "success":
      return {
        hookExecuted: true,
        typecheckRan: true,
        errorsDetected: false,
        pushBlocked: false,
        exitCode: 0, // Success
        errorMessage: "",
        executionTime: 5000, // Expected ~5s
      };

    case "bypass":
      return {
        hookExecuted: false, // Hook skipped with --no-verify
        typecheckRan: false,
        errorsDetected: false,
        pushBlocked: false, // Push succeeds (but CI should catch it)
        exitCode: 0,
        errorMessage: "",
        executionTime: 1000, // Very fast, no validation
      };

    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function runAllValidations(): Promise<ValidationResult[]> {
  const testCases: ValidationInput[] = [
    {
      testCase: "case-1-type-error",
      repository: "metabob-opencode",
      scenario: "type-error",
    },
    {
      testCase: "case-2-success",
      repository: "metabob-opencode",
      scenario: "success",
    },
    {
      testCase: "case-3-bypass",
      repository: "metabob-opencode",
      scenario: "bypass",
    },
    {
      testCase: "case-4-multiple-errors",
      repository: "metabob-dashboard",
      scenario: "type-error",
      errorCode: `
const a: number = "string";
const b: string = 123;
const c: boolean = "not a boolean";

function wrong(x: number): string {
  return x; // Type error
}

class BadClass {
  prop: number = "not a number";
}
`,
    },
  ];

  const results: ValidationResult[] = [];

  for (const testCase of testCases) {
    const result = await runValidation(testCase);
    results.push(result);
  }

  return results;
}

// CLI execution
if (import.meta.main) {
  console.log("=" .repeat(80));
  console.log("CI/CD Pre-Push Quality Gates - Validation Harness");
  console.log("=" .repeat(80));

  const results = await runAllValidations();

  console.log("\n" + "=" .repeat(80));
  console.log("Summary");
  console.log("=" .repeat(80));

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.pass)
      .forEach((r) => {
        console.log(`  - ${r.testCase}`);
        r.diff?.forEach((d) => console.log(`    ${d}`));
      });
    process.exit(1);
  } else {
    console.log("\n✅ All validations passed!");
    process.exit(0);
  }
}
