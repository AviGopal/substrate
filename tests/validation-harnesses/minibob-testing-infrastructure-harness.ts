/**
 * Validation Harness: minibob Testing Infrastructure Development-Deployment-Runtime-Refinement Loop
 * 
 * This harness validates the closed feedback loop through external observation:
 * 1. Deployment State (kubectl)
 * 2. Activity Validation (test-vessel-capabilities.sh)
 * 3. Backend Records (API queries)
 * 4. Boredom System (logs)
 * 5. Metrics Collection (files)
 * 6. Infrastructure Visualization (script output)
 * 7. Helmfile Orchestration (state)
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readFile, access } from "fs/promises";
import { constants } from "fs";

const execAsync = promisify(exec);

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationInput {
  namespace: string; // K8s namespace to validate (e.g., "testing-minibob")
  backendNamespace?: string; // Backend namespace (default: "metabob")
  skipBoredomValidation?: boolean; // Skip boredom system validation (only enabled in cluster)
  skipGitValidation?: boolean; // Skip git commit validation (auto-commit optional)
  metricsDir?: string; // Metrics directory (default: "repos/minibob/metrics")
}

export interface ValidationOutput {
  pass: boolean;
  phase1_deploymentState: PhaseResult;
  phase2_activityValidation: PhaseResult;
  phase3_backendRecords: PhaseResult;
  phase4_boredomSystem: PhaseResult;
  phase5_metricsCollection: PhaseResult;
  phase6_infrastructureVisualization: PhaseResult;
  phase7_helmfileOrchestration: PhaseResult;
  summary: {
    totalPhases: number;
    passedPhases: number;
    failedPhases: number;
    skippedPhases: number;
  };
}

export interface PhaseResult {
  pass: boolean;
  skipped?: boolean;
  actual: unknown;
  expected: unknown;
  error?: string;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Phase 1: Validate deployment state via kubectl
 */
async function validateDeploymentState(
  namespace: string,
  backendNamespace: string
): Promise<PhaseResult> {
  try {
    // Check namespace exists
    const { stdout: nsOutput } = await execAsync(`kubectl get namespace ${namespace} -o json`);
    const ns = JSON.parse(nsOutput);
    
    if (ns.status.phase !== "Active") {
      return {
        pass: false,
        actual: { namespaceStatus: ns.status.phase },
        expected: { namespaceStatus: "Active" },
        error: `Namespace ${namespace} not active`,
      };
    }

    // Check pods running
    const { stdout: podsOutput } = await execAsync(
      `kubectl get pods -n ${namespace} -l app=minibob -o json`
    );
    const pods = JSON.parse(podsOutput);
    
    if (!pods.items || pods.items.length === 0) {
      return {
        pass: false,
        actual: { podCount: 0, pods: [] },
        expected: { podCount: ">= 1", podStatus: "Running" },
        error: `No minibob pods found in namespace ${namespace}`,
      };
    }

    const runningPods = pods.items.filter(
      (p: any) => p.status.phase === "Running"
    );

    // Check backend pods
    const { stdout: backendPodsOutput } = await execAsync(
      `kubectl get pods -n ${backendNamespace} -l app=metabob-rpc-api -o json`
    );
    const backendPods = JSON.parse(backendPodsOutput);
    const backendRunning = backendPods.items.filter(
      (p: any) => p.status.phase === "Running"
    );

    const allPodsRunning = runningPods.length === pods.items.length && backendRunning.length > 0;

    return {
      pass: allPodsRunning,
      actual: {
        namespace,
        namespaceStatus: "Active",
        minibobPodCount: pods.items.length,
        runningPods: runningPods.length,
        backendPodCount: backendPods.items.length,
        backendRunning: backendRunning.length,
      },
      expected: {
        namespaceStatus: "Active",
        minibobPodsRunning: true,
        backendPodsRunning: true,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { namespaceActive: true, podsRunning: true },
      error: `Deployment state validation failed: ${error.message}`,
    };
  }
}

/**
 * Phase 2: Validate activity execution via test-vessel-capabilities.sh
 */
async function validateActivityExecution(namespace: string): Promise<PhaseResult> {
  try {
    // Execute test harness
    const { stdout, stderr } = await execAsync(
      `cd repos/minibob && ./scripts/test-vessel-capabilities.sh ${namespace}`,
      { timeout: 120000 } // 2 minute timeout
    );

    const output = stdout + stderr;

    // Parse test results
    const testSummaryMatch = output.match(/(\d+)\/(\d+) tests passed/i);
    if (!testSummaryMatch) {
      return {
        pass: false,
        actual: { output, testSummaryFound: false },
        expected: { testSummaryFormat: "X/Y tests passed" },
        error: "Could not parse test summary from output",
      };
    }

    const passedTests = parseInt(testSummaryMatch[1]);
    const totalTests = parseInt(testSummaryMatch[2]);
    
    // Extract individual test results
    const testResults: Record<string, boolean> = {};
    const testMatches = output.matchAll(/- (test-[a-z-]+): (PASS|FAIL)/gi);
    for (const match of testMatches) {
      testResults[match[1]] = match[2].toUpperCase() === "PASS";
    }

    // For testing-minibob (single pod), expect 3/4 tests (ACP delegation requires 2+ pods)
    // For minibob-cluster (3 pods), expect 4/4 tests
    const expectedPassed = namespace.includes("cluster") ? 4 : 3;

    return {
      pass: passedTests >= expectedPassed,
      actual: {
        passedTests,
        totalTests,
        testResults,
        output: output.slice(0, 500), // Truncate for readability
      },
      expected: {
        passedTests: `>= ${expectedPassed}`,
        totalTests: 4,
        testsPassing: namespace.includes("cluster") 
          ? ["test-activity-impulse", "test-acp-delegation", "test-self-improvement", "test-nested-activities"]
          : ["test-activity-impulse", "test-self-improvement", "test-nested-activities"],
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { testsExecuted: true, minimumPassed: 3 },
      error: `Activity validation failed: ${error.message}`,
    };
  }
}

/**
 * Phase 3: Validate backend execution records via API
 */
async function validateBackendRecords(backendNamespace: string): Promise<PhaseResult> {
  try {
    // Get backend pod name
    const { stdout: podOutput } = await execAsync(
      `kubectl get pods -n ${backendNamespace} -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}'`
    );
    const podName = podOutput.trim();

    if (!podName) {
      return {
        pass: false,
        actual: { backendPodFound: false },
        expected: { backendPodFound: true },
        error: "Backend pod not found",
      };
    }

    // Query metrics endpoint
    const { stdout: metricsOutput } = await execAsync(
      `kubectl exec -n ${backendNamespace} ${podName} -- curl -s http://localhost:3000/api/v1/learning-loop/metrics?vesselType=minibob`,
      { timeout: 30000 }
    );

    const metrics = JSON.parse(metricsOutput);

    // Query recent executions
    const { stdout: executionsOutput } = await execAsync(
      `kubectl exec -n ${backendNamespace} ${podName} -- curl -s http://localhost:3000/api/v1/learning-loop/executions/recent?limit=5`,
      { timeout: 30000 }
    );

    const executions = JSON.parse(executionsOutput);

    // Validate metrics structure
    const hasMetrics = metrics && typeof metrics.total_executions === "number";
    const hasExecutions = Array.isArray(executions) || Array.isArray(executions?.executions);
    const executionList = Array.isArray(executions) ? executions : executions?.executions || [];

    return {
      pass: hasMetrics && hasExecutions && metrics.total_executions > 0,
      actual: {
        totalExecutions: metrics.total_executions,
        successRate: metrics.success_rate,
        recentExecutions: executionList.length,
        sampleExecution: executionList[0] || null,
      },
      expected: {
        totalExecutions: "> 0",
        hasSuccessRate: true,
        recentExecutionsAvailable: true,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { backendResponding: true, executionRecordsAvailable: true },
      error: `Backend records validation failed: ${error.message}`,
    };
  }
}

/**
 * Phase 4: Validate boredom system via pod logs
 */
async function validateBoredomSystem(
  namespace: string,
  skip: boolean
): Promise<PhaseResult> {
  if (skip) {
    return {
      pass: true,
      skipped: true,
      actual: { skipped: true },
      expected: { boredomEnabled: "N/A - validation skipped" },
    };
  }

  try {
    // Get pod name
    const { stdout: podOutput } = await execAsync(
      `kubectl get pods -n ${namespace} -l app=minibob -o jsonpath='{.items[0].metadata.name}'`
    );
    const podName = podOutput.trim();

    if (!podName) {
      return {
        pass: false,
        actual: { podFound: false },
        expected: { podFound: true },
        error: "Minibob pod not found",
      };
    }

    // Check environment variables for boredom config
    const { stdout: envOutput } = await execAsync(
      `kubectl exec -n ${namespace} ${podName} -- env | grep MINIBOB_BOREDOM || echo "BOREDOM_NOT_CONFIGURED"`
    );

    const boredomEnabled = envOutput.includes("MINIBOB_BOREDOM_ENABLED=true");

    // Get pod logs and search for boredom activity
    const { stdout: logsOutput } = await execAsync(
      `kubectl logs -n ${namespace} ${podName} --tail=200 | grep -i boredom || echo "NO_BOREDOM_LOGS"`
    );

    const hasBoredomLogs = !logsOutput.includes("NO_BOREDOM_LOGS");
    const boredomStarted = logsOutput.includes("[Boredom] Starting task executor");
    const boredomPolling = logsOutput.includes("poll interval") || logsOutput.includes("idle threshold");

    return {
      pass: boredomEnabled && (hasBoredomLogs || namespace.includes("cluster")),
      actual: {
        boredomEnabled,
        hasBoredomLogs,
        boredomStarted,
        boredomPolling,
        envSample: envOutput.slice(0, 200),
        logSample: logsOutput.slice(0, 500),
      },
      expected: {
        boredomEnabled: true,
        boredomSystemStarted: true,
        boredomLogsPresent: "true (if cluster namespace)",
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { boredomSystemActive: true },
      error: `Boredom system validation failed: ${error.message}`,
    };
  }
}

/**
 * Phase 5: Validate metrics collection via local files
 */
async function validateMetricsCollection(metricsDir: string): Promise<PhaseResult> {
  try {
    // Check if metrics directory exists
    await access(metricsDir, constants.R_OK);

    // List metrics files
    const { stdout: filesOutput } = await execAsync(
      `ls -t ${metricsDir}/metrics-*.json 2>/dev/null | head -5 || echo ""`
    );

    const files = filesOutput.trim().split("\n").filter((f) => f);

    if (files.length === 0) {
      return {
        pass: false,
        actual: { metricsFilesFound: 0, metricsDir },
        expected: { metricsFilesFound: "> 0" },
        error: "No metrics files found",
      };
    }

    // Read latest metrics file
    const latestFile = files[0];
    const metricsContent = await readFile(latestFile, "utf-8");
    const metrics = JSON.parse(metricsContent);

    // Validate metrics structure
    const hasResult = metrics && metrics.result;
    const hasTotalExecutions = hasResult && typeof metrics.result.total_executions === "number";
    const hasActivities = hasResult && Array.isArray(metrics.result.activities);

    return {
      pass: hasResult && hasTotalExecutions && hasActivities,
      actual: {
        metricsFilesFound: files.length,
        latestFile,
        totalExecutions: metrics.result?.total_executions,
        successRate: metrics.result?.success_rate,
        activitiesCount: metrics.result?.activities?.length,
      },
      expected: {
        metricsFilesFound: "> 0",
        metricsStructureValid: true,
        totalExecutions: "> 0",
        activitiesTracked: true,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message, metricsDir },
      expected: { metricsFilesExist: true, metricsValid: true },
      error: `Metrics collection validation failed: ${error.message}`,
    };
  }
}

/**
 * Phase 6: Validate infrastructure visualization script
 */
async function validateInfrastructureVisualization(namespace: string): Promise<PhaseResult> {
  try {
    // Execute visualization script
    const { stdout } = await execAsync(
      `cd repos/minibob && ./scripts/visualize-testing-infrastructure.sh 2>&1`,
      { timeout: 30000 }
    );

    // Check for key sections in output
    const hasDeploymentStatus = stdout.includes("Deployment Status") || stdout.includes("minibob-dev");
    const hasBackendComponents = stdout.includes("Backend Components") || stdout.includes("metabob-rpc-api");
    const hasValidationTemplates = stdout.includes("Validation Templates") || stdout.includes("test-activity");
    const hasMetricsSection = stdout.includes("Collected Metrics") || stdout.includes("metrics-");

    const sectionsFound = [
      hasDeploymentStatus,
      hasBackendComponents,
      hasValidationTemplates,
      hasMetricsSection,
    ].filter(Boolean).length;

    return {
      pass: sectionsFound >= 3,
      actual: {
        hasDeploymentStatus,
        hasBackendComponents,
        hasValidationTemplates,
        hasMetricsSection,
        sectionsFound,
        outputSample: stdout.slice(0, 1000),
      },
      expected: {
        sectionsFound: ">= 3",
        deploymentStatus: true,
        backendComponents: true,
        validationTemplates: true,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { visualizationScriptExecutable: true },
      error: `Infrastructure visualization validation failed: ${error.message}`,
    };
  }
}

/**
 * Phase 7: Validate helmfile orchestration state
 */
async function validateHelmfileOrchestration(namespace: string): Promise<PhaseResult> {
  try {
    // Check helmfile diff to see deployment state
    const { stdout, stderr } = await execAsync(
      `cd helm && helmfile -e testing list 2>&1 | grep -E '(minibob|metabob-rpc-api)' || echo "NO_RELEASES"`,
      { timeout: 30000 }
    );

    const output = stdout + stderr;
    const hasMinibobRelease = output.includes("minibob") && !output.includes("NO_RELEASES");
    const hasBackendRelease = output.includes("metabob-rpc-api");

    // Count minibob releases (should have 4 layers)
    const releaseMatches = output.match(/minibob/g);
    const releaseCount = releaseMatches ? releaseMatches.length : 0;

    return {
      pass: hasMinibobRelease && hasBackendRelease && releaseCount >= 2,
      actual: {
        hasMinibobRelease,
        hasBackendRelease,
        minibobReleaseCount: releaseCount,
        outputSample: output.slice(0, 500),
      },
      expected: {
        minibobReleases: ">= 2 (multiple layers)",
        backendRelease: true,
        helmfileStateValid: true,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { helmfileStateQueryable: true },
      error: `Helmfile orchestration validation failed: ${error.message}`,
    };
  }
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Run complete validation harness
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const {
    namespace,
    backendNamespace = "metabob",
    skipBoredomValidation = false,
    skipGitValidation = true, // Git validation always skipped (auto-commit optional)
    metricsDir = "repos/minibob/metrics",
  } = input;

  console.log(`\n=== Validating minibob Testing Infrastructure ===`);
  console.log(`Namespace: ${namespace}`);
  console.log(`Backend Namespace: ${backendNamespace}`);
  console.log(`Skip Boredom Validation: ${skipBoredomValidation}`);
  console.log(`Metrics Directory: ${metricsDir}\n`);

  // Run all validation phases
  const phase1 = await validateDeploymentState(namespace, backendNamespace);
  console.log(`Phase 1 (Deployment State): ${phase1.pass ? "✅ PASS" : "❌ FAIL"}`);

  const phase2 = await validateActivityExecution(namespace);
  console.log(`Phase 2 (Activity Validation): ${phase2.pass ? "✅ PASS" : "❌ FAIL"}`);

  const phase3 = await validateBackendRecords(backendNamespace);
  console.log(`Phase 3 (Backend Records): ${phase3.pass ? "✅ PASS" : "❌ FAIL"}`);

  const phase4 = await validateBoredomSystem(namespace, skipBoredomValidation);
  console.log(
    `Phase 4 (Boredom System): ${phase4.skipped ? "⏭️ SKIPPED" : phase4.pass ? "✅ PASS" : "❌ FAIL"}`
  );

  const phase5 = await validateMetricsCollection(metricsDir);
  console.log(`Phase 5 (Metrics Collection): ${phase5.pass ? "✅ PASS" : "❌ FAIL"}`);

  const phase6 = await validateInfrastructureVisualization(namespace);
  console.log(`Phase 6 (Infrastructure Visualization): ${phase6.pass ? "✅ PASS" : "❌ FAIL"}`);

  const phase7 = await validateHelmfileOrchestration(namespace);
  console.log(`Phase 7 (Helmfile Orchestration): ${phase7.pass ? "✅ PASS" : "❌ FAIL"}`);

  // Calculate summary
  const phases = [phase1, phase2, phase3, phase4, phase5, phase6, phase7];
  const passedPhases = phases.filter((p) => p.pass && !p.skipped).length;
  const failedPhases = phases.filter((p) => !p.pass && !p.skipped).length;
  const skippedPhases = phases.filter((p) => p.skipped).length;
  const totalPhases = phases.length - skippedPhases;

  const overallPass = failedPhases === 0;

  console.log(`\n=== Validation Summary ===`);
  console.log(`Total Phases: ${totalPhases}`);
  console.log(`Passed: ${passedPhases}`);
  console.log(`Failed: ${failedPhases}`);
  console.log(`Skipped: ${skippedPhases}`);
  console.log(`Overall: ${overallPass ? "✅ PASS" : "❌ FAIL"}\n`);

  return {
    pass: overallPass,
    phase1_deploymentState: phase1,
    phase2_activityValidation: phase2,
    phase3_backendRecords: phase3,
    phase4_boredomSystem: phase4,
    phase5_metricsCollection: phase5,
    phase6_infrastructureVisualization: phase6,
    phase7_helmfileOrchestration: phase7,
    summary: {
      totalPhases,
      passedPhases,
      failedPhases,
      skippedPhases,
    },
  };
}

// =============================================================================
// CLI EXECUTION
// =============================================================================

if (require.main === module) {
  const namespace = process.argv[2] || "testing-minibob";
  const backendNamespace = process.argv[3] || "metabob";
  const skipBoredom = namespace !== "minibob-cluster"; // Only validate boredom in cluster

  runValidation({
    namespace,
    backendNamespace,
    skipBoredomValidation: skipBoredom,
  })
    .then((result) => {
      console.log("\n=== Validation Result ===");
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation harness error:", error);
      process.exit(1);
    });
}
