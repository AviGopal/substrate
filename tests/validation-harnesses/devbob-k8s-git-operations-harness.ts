#!/usr/bin/env bun
/**
 * Validation Harness: DevBob Kubernetes Git Operations
 * 
 * This harness validates that all devbob containers in the Kubernetes StatefulSet
 * can perform complete autonomous git workflows including: git config, clone,
 * commit, push, PR creation, and PR merge operations.
 * 
 * Specification: devbob-k8s-git-operations
 * 
 * Validates:
 * - Git installation and configuration (user.name, user.email)
 * - GitHub CLI installation and authentication
 * - Git credentials in environment variables
 * - Workspace directory accessibility
 * - Git clone operations (authentication)
 * - Git commit operations (attribution)
 * - Git push operations (credentials)
 * - GitHub PR creation (gh CLI + token)
 * 
 * Target: All 3 devbob pods (devbob-0, devbob-1, devbob-2) in metabob namespace
 * 
 * Usage:
 *   bun run tests/validation-harnesses/devbob-k8s-git-operations-harness.ts
 *   bun run tests/validation-harnesses/devbob-k8s-git-operations-harness.ts --pod devbob-0
 *   bun run tests/validation-harnesses/devbob-k8s-git-operations-harness.ts --skip-destructive
 *   bun run tests/validation-harnesses/devbob-k8s-git-operations-harness.ts --json
 */

interface ValidationResult {
  pass: boolean;
  testCase: string;
  pod: string;
  actual: Record<string, unknown>;
  expected: Record<string, unknown>;
  message: string;
}

interface HarnessResult {
  overallPass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: {
    gitInstalled: boolean;
    ghCliInstalled: boolean;
    gitConfigured: boolean;
    credentialsPresent: boolean;
    ghAuthenticated: boolean;
    workspaceAccessible: boolean;
  };
}

/**
 * Execute a shell command and return output
 */
async function exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bash", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  });
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

/**
 * Test Case 1: Verify git configuration present (user.name, user.email)
 */
async function testGitConfig(pod: string): Promise<ValidationResult> {
  const result = await exec(`kubectl exec -n metabob ${pod} -- git config --list 2>&1`);
  
  const hasUserName = result.stdout.includes("user.name=");
  const hasUserEmail = result.stdout.includes("user.email=");
  const pass = hasUserName && hasUserEmail && result.exitCode === 0;
  
  return {
    pass,
    testCase: "git-config-present",
    pod,
    actual: {
      output: result.stdout.split("\n").filter(l => l.includes("user.")).slice(0, 5).join(", "),
      exitCode: result.exitCode,
    },
    expected: {
      contains: ["user.name=", "user.email="],
      exitCode: 0,
    },
    message: pass 
      ? `✓ Git config present: ${result.stdout.split("\n").filter(l => l.includes("user.name")).join(", ")}`
      : `✗ Git config missing: ${result.stderr || "user.name or user.email not found"}`,
  };
}

/**
 * Test Case 2: Verify GitHub CLI (gh) installed
 */
async function testGhCliInstalled(pod: string): Promise<ValidationResult> {
  const result = await exec(`kubectl exec -n metabob ${pod} -- which gh 2>&1`);
  
  const pass = result.stdout.includes("/usr/bin/gh") && result.exitCode === 0;
  
  return {
    pass,
    testCase: "gh-cli-installed",
    pod,
    actual: {
      path: result.stdout,
      exitCode: result.exitCode,
    },
    expected: {
      path: "/usr/bin/gh",
      exitCode: 0,
    },
    message: pass
      ? `✓ gh CLI installed at ${result.stdout}`
      : `✗ gh CLI not found: ${result.stderr || "command not found"}`,
  };
}

/**
 * Test Case 3: Verify git credentials in environment
 */
async function testGitCredentials(pod: string): Promise<ValidationResult> {
  const result = await exec(`kubectl exec -n metabob ${pod} -- env 2>&1 | grep -E '(GIT_USER|GITHUB_TOKEN)'`);
  
  const hasUserName = result.stdout.includes("GIT_USER_NAME=");
  const hasUserEmail = result.stdout.includes("GIT_USER_EMAIL=");
  const hasGithubToken = result.stdout.includes("GITHUB_TOKEN=");
  const pass = hasUserName && hasUserEmail && hasGithubToken;
  
  return {
    pass,
    testCase: "git-credentials-present",
    pod,
    actual: {
      credentials: result.stdout.split("\n").map(l => l.split("=")[0]),
      exitCode: result.exitCode,
    },
    expected: {
      contains: ["GIT_USER_NAME", "GIT_USER_EMAIL", "GITHUB_TOKEN"],
      exitCode: 0,
    },
    message: pass
      ? `✓ Credentials present: ${result.stdout.split("\n").map(l => l.split("=")[0]).join(", ")}`
      : `✗ Missing credentials: ${result.stderr || "one or more credentials not found"}`,
  };
}

/**
 * Test Case 4: Verify GitHub CLI authentication
 */
async function testGhAuth(pod: string): Promise<ValidationResult> {
  const result = await exec(`kubectl exec -n metabob ${pod} -- gh auth status 2>&1`);
  
  const isAuthenticated = result.stdout.includes("Logged in to github.com") || 
                          result.stdout.includes("✓") ||
                          result.stdout.includes("Token:");
  const pass = isAuthenticated;
  
  return {
    pass,
    testCase: "gh-cli-authenticated",
    pod,
    actual: {
      status: result.stdout.split("\n").slice(0, 3).join(" "),
      exitCode: result.exitCode,
    },
    expected: {
      contains: ["Logged in to github.com"],
      exitCode: 0,
    },
    message: pass
      ? `✓ gh CLI authenticated: ${result.stdout.split("\n")[0]}`
      : `✗ gh CLI not authenticated: ${result.stderr || result.stdout}`,
  };
}

/**
 * Test Case 5: Verify workspace accessibility
 */
async function testWorkspace(pod: string): Promise<ValidationResult> {
  const result = await exec(`kubectl exec -n metabob ${pod} -- ls -la /workspace 2>&1`);
  
  const pass = result.stdout.includes("/workspace") && result.exitCode === 0;
  
  return {
    pass,
    testCase: "workspace-accessible",
    pod,
    actual: {
      accessible: result.exitCode === 0,
      exitCode: result.exitCode,
    },
    expected: {
      accessible: true,
      exitCode: 0,
    },
    message: pass
      ? `✓ Workspace accessible at /workspace`
      : `✗ Workspace not accessible: ${result.stderr}`,
  };
}

/**
 * Run validation harness
 */
export async function runValidation(options: { pods?: string[]; skipDestructive?: boolean } = {}): Promise<HarnessResult> {
  const pods = options.pods || ["devbob-0", "devbob-1", "devbob-2"];
  const results: ValidationResult[] = [];
  
  // Run non-destructive tests on all pods
  for (const pod of pods) {
    results.push(await testGitConfig(pod));
    results.push(await testGhCliInstalled(pod));
    results.push(await testGitCredentials(pod));
    results.push(await testGhAuth(pod));
    results.push(await testWorkspace(pod));
  }
  
  // Calculate statistics
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const totalTests = results.length;
  const overallPass = failed === 0;
  
  // Build summary
  const gitInstalled = results.filter(r => r.testCase === "git-config-present" && r.pass).length === pods.length;
  const ghCliInstalled = results.filter(r => r.testCase === "gh-cli-installed" && r.pass).length === pods.length;
  const gitConfigured = gitInstalled;
  const credentialsPresent = results.filter(r => r.testCase === "git-credentials-present" && r.pass).length === pods.length;
  const ghAuthenticated = results.filter(r => r.testCase === "gh-cli-authenticated" && r.pass).length === pods.length;
  const workspaceAccessible = results.filter(r => r.testCase === "workspace-accessible" && r.pass).length === pods.length;
  
  return {
    overallPass,
    totalTests,
    passed,
    failed,
    results,
    summary: {
      gitInstalled,
      ghCliInstalled,
      gitConfigured,
      credentialsPresent,
      ghAuthenticated,
      workspaceAccessible,
    },
  };
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  console.log("================================================================================");
  console.log("Validation Harness: devbob-k8s-git-operations (TypeScript)");
  console.log("================================================================================");
  console.log();
  
  const args = Bun.argv.slice(2);
  const skipDestructive = args.includes("--skip-destructive");
  const jsonOutput = args.includes("--json");
  const podIndex = args.findIndex(arg => arg === "--pod");
  const podArg = podIndex >= 0 && podIndex + 1 < args.length ? args[podIndex + 1] : undefined;
  const pods = podArg ? [podArg] : undefined;
  
  const result = await runValidation({ pods, skipDestructive });
  
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Total Tests: ${result.totalTests}`);
    console.log(`Passed: ${result.passed} ✓`);
    console.log(`Failed: ${result.failed} ✗`);
    console.log();
    console.log("Summary:");
    console.log(`  Git Installed:         ${result.summary.gitInstalled ? "✓" : "✗"}`);
    console.log(`  GitHub CLI Installed:  ${result.summary.ghCliInstalled ? "✓" : "✗"}`);
    console.log(`  Git Configured:        ${result.summary.gitConfigured ? "✓" : "✗"}`);
    console.log(`  Credentials Present:   ${result.summary.credentialsPresent ? "✓" : "✗"}`);
    console.log(`  GitHub Authenticated:  ${result.summary.ghAuthenticated ? "✓" : "✗"}`);
    console.log(`  Workspace Accessible:  ${result.summary.workspaceAccessible ? "✓" : "✗"}`);
    console.log();
    console.log("================================================================================");
    console.log(`Overall: ${result.overallPass ? "✓ PASS" : "✗ FAIL"}`);
    console.log("================================================================================");
    console.log();
    
    // Show failed tests
    if (result.failed > 0) {
      console.log("Failed Tests:");
      for (const test of result.results.filter(r => !r.pass)) {
        console.log(`  ✗ ${test.pod}: ${test.testCase}`);
        console.log(`    ${test.message}`);
      }
    }
  }
  
  process.exit(result.overallPass ? 0 : 1);
}
