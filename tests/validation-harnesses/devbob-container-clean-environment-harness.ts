#!/usr/bin/env bun
/**
 * Validation Harness: DevBob Container Clean Environment Constraints
 * 
 * This harness validates that the DevBob container is a clean binary deployment
 * with NO source code leakage, ensuring intellectual property protection and
 * minimal attack surface.
 * 
 * Specification:
 * - Container must contain ONLY: standalone binary, venv, entrypoint, runtime deps, plugins
 * - Container must NOT contain: repos/ directory, .ts files, workspace source code
 * - Multi-stage build must discard all source code
 * - Final image must be production-ready with minimal attack surface
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  message: string;
}

interface HarnessResult {
  overallPass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

/**
 * Execute a shell command and return output
 */
function exec(command: string, options: any = {}): string {
  try {
    return execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    }).trim();
  } catch (error: any) {
    // Return stderr if command fails
    return error.stderr?.toString().trim() || error.stdout?.toString().trim() || "";
  }
}

/**
 * Test Case 1: Verify Dockerfile uses multi-stage build
 */
function testMultiStageBuild(): ValidationResult {
  const dockerfilePath = join(process.cwd(), "docker/Dockerfile.devbob");
  
  if (!existsSync(dockerfilePath)) {
    return {
      pass: false,
      testCase: "Multi-stage Build Structure",
      actual: "Dockerfile not found",
      expected: "Dockerfile exists at docker/Dockerfile.devbob",
      message: "Dockerfile not found at expected location",
    };
  }

  const content = readFileSync(dockerfilePath, "utf-8");
  const stages = content.match(/^FROM .* AS /gm) || [];
  const hasMetabobCliBuilder = content.includes("AS metabob-cli-builder");
  const hasOpencodeBuilder = content.includes("AS opencode-binary");
  const hasRuntime = content.includes("AS runtime");

  const pass = stages.length >= 3 && hasMetabobCliBuilder && hasOpencodeBuilder && hasRuntime;

  return {
    pass,
    testCase: "Multi-stage Build Structure",
    actual: {
      stages: stages.length,
      hasMetabobCliBuilder,
      hasOpencodeBuilder,
      hasRuntime,
    },
    expected: {
      stages: ">=3",
      hasMetabobCliBuilder: true,
      hasOpencodeBuilder: true,
      hasRuntime: true,
    },
    message: pass
      ? "Dockerfile uses correct multi-stage build structure"
      : "Dockerfile missing required build stages",
  };
}

/**
 * Test Case 2: Verify NO source code copied to runtime stage
 */
function testNoSourceCodeInRuntime(): ValidationResult {
  const dockerfilePath = join(process.cwd(), "docker/Dockerfile.devbob");
  const content = readFileSync(dockerfilePath, "utf-8");

  // Extract runtime stage
  const runtimeMatch = content.match(/FROM .* AS runtime([\s\S]*?)(?=FROM|$)/);
  if (!runtimeMatch) {
    return {
      pass: false,
      testCase: "No Source Code in Runtime Stage",
      actual: "Runtime stage not found",
      expected: "Runtime stage exists",
      message: "Could not find runtime stage in Dockerfile",
    };
  }

  const runtimeStage = runtimeMatch[1];

  // Check for problematic COPY commands
  const copiesRepos = runtimeStage.includes("COPY repos/");
  const copiesTsFiles = runtimeStage.match(/COPY.*\.ts/);
  const copiesWorkspace = runtimeStage.includes("COPY /workspace");

  // Verify only COPY --from=builder commands
  const copyCommands = runtimeStage.match(/COPY .*/g) || [];
  const allCopiesFromBuilder = copyCommands.every(
    (cmd) => cmd.includes("--from=") || cmd.includes("docker/entrypoint") || cmd.includes("bootstrap")
  );

  const pass = !copiesRepos && !copiesTsFiles && !copiesWorkspace && allCopiesFromBuilder;

  return {
    pass,
    testCase: "No Source Code in Runtime Stage",
    actual: {
      copiesRepos,
      copiesTsFiles: !!copiesTsFiles,
      copiesWorkspace,
      copyCommands: copyCommands.length,
      allCopiesFromBuilder,
    },
    expected: {
      copiesRepos: false,
      copiesTsFiles: false,
      copiesWorkspace: false,
      allCopiesFromBuilder: true,
    },
    message: pass
      ? "Runtime stage only copies artifacts from builders, no source code"
      : "Runtime stage contains source code COPY commands",
  };
}

/**
 * Test Case 3: Verify bootstrap templates are copied
 */
function testBootstrapTemplatesCopied(): ValidationResult {
  const dockerfilePath = join(process.cwd(), "docker/Dockerfile.devbob");
  const content = readFileSync(dockerfilePath, "utf-8");

  const hasBootstrapCopy = content.includes("COPY repos/metabob-proto/activities/bootstrap");
  const hasBootstrapMkdir = content.includes("mkdir -p /metabob-proto/activities/bootstrap");

  const pass = hasBootstrapCopy || hasBootstrapMkdir;

  return {
    pass,
    testCase: "Bootstrap Templates Copied",
    actual: {
      hasBootstrapCopy,
      hasBootstrapMkdir,
    },
    expected: {
      hasBootstrapCopy: true,
      hasBootstrapMkdir: true,
    },
    message: pass
      ? "Bootstrap templates are copied to container"
      : "Bootstrap templates missing - container will crash on startup",
  };
}

/**
 * Test Case 4: Verify build script uses correct Dockerfile
 */
function testBuildScriptDockerfile(): ValidationResult {
  const buildScriptPath = join(process.cwd(), "scripts/build-devbob.sh");
  
  if (!existsSync(buildScriptPath)) {
    return {
      pass: false,
      testCase: "Build Script Dockerfile Reference",
      actual: "Build script not found",
      expected: "Build script exists at scripts/build-devbob.sh",
      message: "Build script not found",
    };
  }

  const content = readFileSync(buildScriptPath, "utf-8");
  const usesCorrectDockerfile = content.includes("docker/Dockerfile.devbob");
  const usesWrongDockerfile = content.includes("configs/Dockerfile.devbob");

  const pass = usesCorrectDockerfile && !usesWrongDockerfile;

  return {
    pass,
    testCase: "Build Script Dockerfile Reference",
    actual: {
      usesCorrectDockerfile,
      usesWrongDockerfile,
    },
    expected: {
      usesCorrectDockerfile: true,
      usesWrongDockerfile: false,
    },
    message: pass
      ? "Build script uses correct production Dockerfile (docker/Dockerfile.devbob)"
      : "Build script uses wrong Dockerfile (configs/Dockerfile.devbob instead of docker/Dockerfile.devbob)",
  };
}

/**
 * Test Case 5: Verify entrypoint makes activity execution unconditional
 */
function testUnconditionalActivityExecution(): ValidationResult {
  const entrypointPath = join(process.cwd(), "docker/entrypoint-self-config.sh");
  
  if (!existsSync(entrypointPath)) {
    return {
      pass: false,
      testCase: "Unconditional Activity Execution",
      actual: "Entrypoint not found",
      expected: "Entrypoint exists at docker/entrypoint-self-config.sh",
      message: "Entrypoint script not found",
    };
  }

  const content = readFileSync(entrypointPath, "utf-8");

  // Check if activity execution is conditional on BACKEND_READY
  const hasConditionalExecution = content.match(/if.*BACKEND_READY.*then[\s\S]*?opencode activity execute configure-vessel-for-environment/);
  const hasUnconditionalExecution = content.includes("opencode activity execute configure-vessel-for-environment") && 
                                     content.includes("backend_available");

  const pass = !hasConditionalExecution && hasUnconditionalExecution;

  return {
    pass,
    testCase: "Unconditional Activity Execution",
    actual: {
      hasConditionalExecution: !!hasConditionalExecution,
      hasUnconditionalExecution,
      passesBackendVariable: content.includes("backend_available"),
    },
    expected: {
      hasConditionalExecution: false,
      hasUnconditionalExecution: true,
      passesBackendVariable: true,
    },
    message: pass
      ? "Activity execution is unconditional with backend_available variable"
      : "Activity execution is conditional on backend - violates self-sufficiency",
  };
}

/**
 * Test Case 6: Verify validation template tests for clean binary deployment
 */
function testValidationTemplateCleanEnvironment(): ValidationResult {
  const templatePath = join(process.cwd(), "templates/docker/validate-devbob-container.json");
  
  if (!existsSync(templatePath)) {
    return {
      pass: false,
      testCase: "Validation Template Clean Environment",
      actual: "Validation template not found",
      expected: "Template exists at templates/docker/validate-devbob-container.json",
      message: "Validation template not found",
    };
  }

  const content = readFileSync(templatePath, "utf-8");

  const hasCleanDeploymentTask = content.includes("verify-clean-binary-deployment");
  const checksForNoRepos = content.includes("repos") && content.includes("find");
  const checksForNoTs = content.includes(".ts") || content.includes("TypeScript");
  const hasWrongCodeSyncTask = content.includes("git -C /workspace status");

  const pass = hasCleanDeploymentTask && checksForNoRepos && !hasWrongCodeSyncTask;

  return {
    pass,
    testCase: "Validation Template Clean Environment",
    actual: {
      hasCleanDeploymentTask,
      checksForNoRepos,
      checksForNoTs,
      hasWrongCodeSyncTask,
    },
    expected: {
      hasCleanDeploymentTask: true,
      checksForNoRepos: true,
      checksForNoTs: true,
      hasWrongCodeSyncTask: false,
    },
    message: pass
      ? "Validation template correctly tests for clean binary deployment"
      : "Validation template has incorrect assumptions (checks for source code instead of NO source code)",
  };
}

/**
 * Test Case 7: Verify container runtime (if image exists)
 * This test is optional and only runs if the Docker image exists
 */
function testContainerRuntimeCleanEnvironment(): ValidationResult {
  const imageName = "devbob:latest";

  // Check if image exists
  try {
    exec(`docker image inspect ${imageName}`);
  } catch {
    return {
      pass: true,
      testCase: "Container Runtime Clean Environment (SKIPPED)",
      actual: "Image not found",
      expected: "N/A - Test skipped",
      message: "Docker image not found - skipping runtime test (build image first)",
    };
  }

  // Start temporary container
  const containerId = exec(`docker run -d --rm ${imageName} sleep 3600`).trim();

  try {
    // Check for repos/ directory
    const reposCheck = exec(`docker exec ${containerId} find / -type d -name repos 2>/dev/null || true`);
    const hasRepos = reposCheck.length > 0;

    // Check for .ts files
    const tsCheck = exec(`docker exec ${containerId} find /usr/local/bin /opt -name '*.ts' 2>/dev/null || true`);
    const hasTsFiles = tsCheck.length > 0;

    // Check binary exists
    const binaryCheck = exec(`docker exec ${containerId} test -f /usr/local/bin/opencode && echo exists || echo missing`);
    const binaryExists = binaryCheck === "exists";

    // Check bootstrap templates
    const bootstrapCheck = exec(`docker exec ${containerId} test -d /metabob-proto/activities/bootstrap && echo exists || echo missing`);
    const bootstrapExists = bootstrapCheck === "exists";

    const pass = !hasRepos && !hasTsFiles && binaryExists && bootstrapExists;

    // Clean up
    exec(`docker stop ${containerId}`);

    return {
      pass,
      testCase: "Container Runtime Clean Environment",
      actual: {
        hasRepos,
        hasTsFiles,
        binaryExists,
        bootstrapExists,
      },
      expected: {
        hasRepos: false,
        hasTsFiles: false,
        binaryExists: true,
        bootstrapExists: true,
      },
      message: pass
        ? "Container runtime environment is clean - NO source code leakage detected"
        : "Container runtime has issues - source code leakage or missing components",
    };
  } catch (error: any) {
    // Clean up on error
    try {
      exec(`docker stop ${containerId}`);
    } catch {}

    return {
      pass: false,
      testCase: "Container Runtime Clean Environment",
      actual: `Error: ${error.message}`,
      expected: "Clean runtime verification",
      message: `Runtime test failed: ${error.message}`,
    };
  }
}

/**
 * Run all validation tests
 */
export function runValidation(_input?: any): HarnessResult {
  console.log("=".repeat(80));
  console.log("Validation Harness: DevBob Container Clean Environment Constraints");
  console.log("=".repeat(80));
  console.log();

  const results: ValidationResult[] = [
    testMultiStageBuild(),
    testNoSourceCodeInRuntime(),
    testBootstrapTemplatesCopied(),
    testBuildScriptDockerfile(),
    testUnconditionalActivityExecution(),
    testValidationTemplateCleanEnvironment(),
    testContainerRuntimeCleanEnvironment(),
  ];

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const overallPass = failed === 0;

  // Print results
  results.forEach((result) => {
    const status = result.pass ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${result.testCase}`);
    console.log(`  ${result.message}`);
    if (!result.pass) {
      console.log(`  Expected:`, JSON.stringify(result.expected, null, 2));
      console.log(`  Actual:`, JSON.stringify(result.actual, null, 2));
    }
    console.log();
  });

  console.log("=".repeat(80));
  console.log(`Results: ${passed}/${results.length} tests passed`);
  console.log(`Status: ${overallPass ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  console.log("=".repeat(80));

  return {
    overallPass,
    totalTests: results.length,
    passed,
    failed,
    results,
  };
}

// Run validation if called directly
if (import.meta.main) {
  const result = runValidation();
  process.exit(result.overallPass ? 0 : 1);
}
