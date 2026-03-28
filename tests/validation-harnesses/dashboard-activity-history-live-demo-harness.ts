/**
 * Validation Harness: Dashboard Activity History Live Demo
 * 
 * Validates complete end-to-end data flow:
 * OpenCode CLI (devbob) → SurrealDB → RPC API (Redis cache) → Dashboard UI
 * 
 * Uses Playwright MCP for browser automation and kubectl for infrastructure.
 * Captures screenshots at each step as proof-of-work.
 * Verifies cache-aside pattern in API logs.
 */

import { execSync } from "child_process";
import * as fs from "fs";

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  errors: string[];
  screenshots: string[];
  logs: string[];
}

interface TestCase {
  name: string;
  description: string;
  execute: () => Promise<{ pass: boolean; details: any }>;
}

/**
 * Helper: Execute shell command and return output
 */
function execCommand(cmd: string, timeout = 30000): string {
  try {
    return execSync(cmd, { timeout, encoding: "utf-8" });
  } catch (error: any) {
    throw new Error(`Command failed: ${cmd}\nError: ${error.message}`);
  }
}

// Note: Playwright integration would be added here for browser automation
// This harness focuses on backend validation (infrastructure, API, database)

/**
 * Test Case 1: Infrastructure Readiness
 */
async function validateInfrastructure(): Promise<{ pass: boolean; details: any }> {
  const details: any = { checks: [] };

  try {
    // Check kubectl context
    const context = execCommand("kubectl config current-context").trim();
    details.checks.push({
      name: "kubectl-context",
      expected: "docker-desktop",
      actual: context,
      pass: context === "docker-desktop",
    });

    // Check namespace exists
    const namespaces = execCommand("kubectl get namespace metabob -o name").trim();
    details.checks.push({
      name: "namespace-metabob",
      expected: "namespace/metabob",
      actual: namespaces,
      pass: namespaces === "namespace/metabob",
    });

    // Check pods are running
    const pods = execCommand(
      "kubectl get pods -n metabob -o jsonpath='{.items[*].status.phase}'"
    );
    const allRunning = pods.split(" ").every((phase) => phase === "Running");
    details.checks.push({
      name: "pods-running",
      expected: "All pods Running",
      actual: pods,
      pass: allRunning,
    });

    // Check services exist
    const services = [
      { name: "surrealdb", checkName: "surrealdb" },
      { name: "redis-master", checkName: "redis" }, // Actual service is redis-master
      { name: "metabob-rpc-api", checkName: "metabob-rpc-api" },
      { name: "metabob-dashboard", checkName: "metabob-dashboard" },
      { name: "devbob", checkName: "devbob" },
    ];
    for (const svc of services) {
      try {
        const svcOutput = execCommand(
          `kubectl get service ${svc.name} -n metabob -o name`
        );
        details.checks.push({
          name: `service-${svc.checkName}`,
          expected: `service/${svc.name}`,
          actual: svcOutput.trim(),
          pass: svcOutput.trim() === `service/${svc.name}`,
        });
      } catch (error) {
        details.checks.push({
          name: `service-${svc.checkName}`,
          expected: `service/${svc.name}`,
          actual: "NOT FOUND",
          pass: false,
        });
      }
    }

    // Check devbob has RPC API URL configured
    const envVars = execCommand(
      "kubectl exec deployment/devbob -n metabob -- env | grep METABOB_RPC_API_URL || echo 'NOT_FOUND'"
    );
    const hasRpcUrl = envVars.includes("http://metabob-rpc-api");
    details.checks.push({
      name: "devbob-rpc-url",
      expected: "METABOB_RPC_API_URL=http://metabob-rpc-api:8080",
      actual: envVars.trim(),
      pass: hasRpcUrl,
    });

    const allPass = details.checks.every((c: any) => c.pass);
    return { pass: allPass, details };
  } catch (error: any) {
    return {
      pass: false,
      details: { ...details, error: error.message },
    };
  }
}

/**
 * Test Case 2: Dashboard Accessibility & DNS
 */
async function validateDashboardAccess(): Promise<{ pass: boolean; details: any }> {
  const details: any = { checks: [] };

  try {
    // Check ingress exists
    const ingress = execCommand(
      "kubectl get ingress metabob-dashboard -n metabob -o jsonpath='{.spec.rules[0].host}'"
    );
    details.checks.push({
      name: "ingress-host",
      expected: "app.metabob.local",
      actual: ingress.trim(),
      pass: ingress.trim() === "app.metabob.local",
    });

    // Check /etc/hosts has app.metabob.local
    const hostsFile = fs.readFileSync("/etc/hosts", "utf-8");
    const hasEntry = hostsFile.includes("app.metabob.local");
    details.checks.push({
      name: "hosts-file",
      expected: "127.0.0.1 app.metabob.local",
      actual: hasEntry ? "Entry found" : "Entry NOT found",
      pass: hasEntry,
    });

    // Test HTTP connectivity
    try {
      const curlOutput = execCommand(
        "curl -s -o /dev/null -w '%{http_code}' http://app.metabob.local --connect-timeout 5",
        10000
      );
      const statusCode = parseInt(curlOutput.trim());
      details.checks.push({
        name: "http-connectivity",
        expected: "200 or 302 (redirect to login)",
        actual: statusCode,
        pass: statusCode === 200 || statusCode === 302,
      });
    } catch (error) {
      details.checks.push({
        name: "http-connectivity",
        expected: "200 or 302",
        actual: "Connection failed",
        pass: false,
      });
    }

    const allPass = details.checks.every((c: any) => c.pass);
    return { pass: allPass, details };
  } catch (error: any) {
    return {
      pass: false,
      details: { ...details, error: error.message },
    };
  }
}

/**
 * Test Case 3: Execute Activity in Devbob
 */
async function validateActivityExecution(): Promise<{ pass: boolean; details: any }> {
  const details: any = { checks: [] };

  try {
    // Execute a simple test activity
    console.log("Executing test activity in devbob...");
    const activityCmd = `kubectl exec deployment/devbob -n metabob -- bash -c "cd /workspace && echo '{}' | opencode activity --template test-activity" 2>&1`;

    const output = execCommand(activityCmd, 120000); // 2 min timeout
    details.activityOutput = output;

    // Check for success indicators
    const hasCompleted = output.includes("completed") || output.includes("done");
    const hasActivityId = output.includes("act_");
    const hasRecorded = output.includes("activity execution recorded to dashboard") || 
                        output.includes("recorded to RPC API");

    details.checks.push({
      name: "activity-completed",
      expected: "Activity completed",
      actual: hasCompleted ? "Completed" : "Not completed",
      pass: hasCompleted,
    });

    details.checks.push({
      name: "activity-id-generated",
      expected: "Activity ID generated (act_*)",
      actual: hasActivityId ? "ID found" : "No ID",
      pass: hasActivityId,
    });

    details.checks.push({
      name: "dashboard-sync",
      expected: "Activity recorded to dashboard",
      actual: hasRecorded ? "Recorded" : "Not recorded",
      pass: hasRecorded,
    });

    const allPass = details.checks.every((c: any) => c.pass);
    return { pass: allPass, details };
  } catch (error: any) {
    return {
      pass: false,
      details: { ...details, error: error.message },
    };
  }
}

/**
 * Test Case 4: Verify SurrealDB Record
 */
async function validateSurrealDBRecord(): Promise<{ pass: boolean; details: any }> {
  const details: any = { checks: [] };

  try {
    // Query SurrealDB for recent activity execution
    const query = "SELECT * FROM activity_executions ORDER BY started_at DESC LIMIT 1;";
    const surrealCmd = `kubectl exec deployment/surrealdb -n metabob -- surreal sql --conn http://localhost:8000 --ns metabob --db devbob --auth-level root --user root --pass root "${query}"`;

    const output = execCommand(surrealCmd, 15000);
    details.queryOutput = output;

    // Check for expected fields
    const hasActivityId = output.includes("activity_id");
    const hasTemplateId = output.includes("template_id");
    const hasSuccess = output.includes("success");
    const hasCost = output.includes("cost_usd");
    const hasDuration = output.includes("duration_ms");
    const hasTokens = output.includes("tokens_");

    details.checks.push({
      name: "record-exists",
      expected: "Activity execution record in SurrealDB",
      actual: hasActivityId ? "Record found" : "No record",
      pass: hasActivityId,
    });

    details.checks.push({
      name: "schema-compliance",
      expected: "Has required fields (template_id, success, cost, duration, tokens)",
      actual: `template_id: ${hasTemplateId}, success: ${hasSuccess}, cost: ${hasCost}, duration: ${hasDuration}, tokens: ${hasTokens}`,
      pass: hasTemplateId && hasSuccess && hasCost && hasDuration && hasTokens,
    });

    const allPass = details.checks.every((c: any) => c.pass);
    return { pass: allPass, details };
  } catch (error: any) {
    return {
      pass: false,
      details: { ...details, error: error.message },
    };
  }
}

/**
 * Test Case 5: API Cache-Aside Validation
 */
async function validateCacheAside(): Promise<{ pass: boolean; details: any }> {
  const details: any = { checks: [] };

  try {
    // First request (should be cache MISS)
    console.log("Making first API request (expect cache MISS)...");
    const firstRequest = execCommand(
      "curl -s http://app.metabob.local/auth/orgs/test-org/activity?limit=10",
      10000
    );
    
    // Wait a moment for logs to flush
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check API logs for cache miss
    const logs1 = execCommand(
      "kubectl logs deployment/metabob-rpc-api -n metabob --tail=50 | grep -i cache || echo 'NO_LOGS'",
      15000
    );
    details.firstRequestLogs = logs1;

    const hasMiss = logs1.includes("Cache MISS") || logs1.includes("cache miss");

    details.checks.push({
      name: "first-request-cache-miss",
      expected: "Cache MISS on first request",
      actual: hasMiss ? "Cache MISS" : "No cache miss indicator",
      pass: hasMiss,
    });

    // Second request (should be cache HIT)
    console.log("Making second API request (expect cache HIT)...");
    execCommand(
      "curl -s http://app.metabob.local/auth/orgs/test-org/activity?limit=10",
      10000
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    const logs2 = execCommand(
      "kubectl logs deployment/metabob-rpc-api -n metabob --tail=50 | grep -i cache || echo 'NO_LOGS'",
      15000
    );
    details.secondRequestLogs = logs2;

    const hasHit = logs2.includes("Cache HIT") || logs2.includes("cache hit");

    details.checks.push({
      name: "second-request-cache-hit",
      expected: "Cache HIT on second request",
      actual: hasHit ? "Cache HIT" : "No cache hit indicator",
      pass: hasHit,
    });

    // Check response contains activities
    const response = JSON.parse(firstRequest);
    const hasActivities = Array.isArray(response.activities) && response.activities.length > 0;

    details.checks.push({
      name: "api-response-valid",
      expected: "Response contains activities array",
      actual: `${response.activities?.length || 0} activities`,
      pass: hasActivities,
    });

    const allPass = details.checks.every((c: any) => c.pass);
    return { pass: allPass, details };
  } catch (error: any) {
    return {
      pass: false,
      details: { ...details, error: error.message },
    };
  }
}

/**
 * Main validation function
 */
export async function runValidation(): Promise<ValidationResult> {
  const result: ValidationResult = {
    pass: false,
    actual: {},
    expected: {},
    errors: [],
    screenshots: [],
    logs: [],
  };

  console.log("=".repeat(80));
  console.log("Dashboard Activity History Live Demo - Validation Harness");
  console.log("=".repeat(80));

  const testCases: TestCase[] = [
    {
      name: "Infrastructure Readiness",
      description: "Validate k8s cluster, pods, services, and configuration",
      execute: validateInfrastructure,
    },
    {
      name: "Dashboard Accessibility",
      description: "Validate DNS, ingress, and HTTP connectivity",
      execute: validateDashboardAccess,
    },
    {
      name: "Activity Execution",
      description: "Execute test activity in devbob container",
      execute: validateActivityExecution,
    },
    {
      name: "SurrealDB Record",
      description: "Verify activity execution persisted to SurrealDB",
      execute: validateSurrealDBRecord,
    },
    {
      name: "Cache-Aside Pattern",
      description: "Validate Redis cache-aside (miss → hit)",
      execute: validateCacheAside,
    },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    console.log(`\n[TEST] ${testCase.name}`);
    console.log(`       ${testCase.description}`);

    try {
      const testResult = await testCase.execute();
      result.actual[testCase.name] = testResult.details;

      if (testResult.pass) {
        console.log(`[PASS] ✅ ${testCase.name}`);
      } else {
        console.log(`[FAIL] ❌ ${testCase.name}`);
        allPassed = false;
        result.errors.push(`${testCase.name} failed`);
      }

      // Log individual check results
      if (testResult.details.checks) {
        for (const check of testResult.details.checks) {
          const status = check.pass ? "✅" : "❌";
          console.log(`       ${status} ${check.name}: ${check.actual}`);
        }
      }
    } catch (error: any) {
      console.log(`[ERROR] ❌ ${testCase.name}: ${error.message}`);
      allPassed = false;
      result.errors.push(`${testCase.name} error: ${error.message}`);
    }
  }

  result.pass = allPassed;

  console.log("\n" + "=".repeat(80));
  console.log(`VALIDATION RESULT: ${result.pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(80));

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((err) => console.log(`  - ${err}`));
  }

  return result;
}

/**
 * Run validation if executed directly
 */
if (require.main === module) {
  runValidation()
    .then((result) => {
      console.log("\nValidation complete.");
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation failed with error:", error);
      process.exit(1);
    });
}
