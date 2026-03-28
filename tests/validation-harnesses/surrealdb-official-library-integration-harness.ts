/**
 * Validation Harness: SurrealDB Official Library Integration
 *
 * Tests the critical bug fix for variant_id persistence issue caused by:
 * 1. Buggy custom HTTP RPC client with parameter serialization issues
 * 2. Using update() instead of merge() causing field loss
 *
 * This harness validates:
 * - Official surrealdb-py library installed and importable
 * - SurrealDB v3.0+ deployment running
 * - variant_id persists correctly after create and update operations
 * - activity_id persists correctly after create and update operations
 * - merge() used instead of update() in template_metrics.py
 * - Thompson Sampling queries work (SELECT WHERE variant_id = $id)
 *
 * Usage:
 *   bun run tests/validation-harnesses/surrealdb-official-library-integration-harness.ts
 */

// Bun-compatible shell execution
async function execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  });
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  
  return { stdout, stderr };
}

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface TestCase {
  name: string;
  input: any;
  expectedOutput: any;
  validator: (input: any, expected: any) => Promise<ValidationResult>;
}

// ============================================================================
// Test Case Validators
// ============================================================================

/**
 * Validate that official surrealdb-py library is installed
 */
async function validateSurrealDBPackageInstalled(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const { stdout, stderr } = await execAsync(
      "cd repos/metabob-rpc-api && python -c 'import surrealdb; print(surrealdb.__version__)'"
    );

    const version = stdout.trim();
    const pass = version.length > 0 && !version.startsWith("Traceback");

    return {
      pass,
      actual: version || stderr,
      expected: expected.minVersion || ">=1.0.0",
      details: pass
        ? `surrealdb-py version ${version} installed`
        : `Failed to import surrealdb: ${stderr}`,
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: error.message,
      expected: expected.minVersion || ">=1.0.0",
      error: "Failed to check surrealdb package installation",
      details: error.stderr || error.message,
    };
  }
}

/**
 * Validate that SurrealDB v3.0+ is running in k8s
 */
async function validateSurrealDBDeployment(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const { stdout } = await execAsync(
      "kubectl get deployment surrealdb -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo 'NOT_FOUND'"
    );

    const image = stdout.trim();
    const pass = image.includes("surrealdb") && !image.includes("NOT_FOUND");

    // Extract version from image tag (e.g., surrealdb/surrealdb:v3.0.1 -> 3.0.1)
    const versionMatch = image.match(/v?(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : "unknown";

    // Check if version >= 3.0.0
    const isV3OrHigher = version.startsWith("3.") || parseInt(version.split(".")[0]) >= 3;

    return {
      pass: pass && isV3OrHigher,
      actual: image,
      expected: expected.minVersion || "v3.0+",
      details: pass
        ? isV3OrHigher
          ? `SurrealDB ${version} running (v3.0+ ✓)`
          : `SurrealDB ${version} running but needs upgrade to v3.0+`
        : "SurrealDB deployment not found in k8s",
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: error.message,
      expected: expected.minVersion || "v3.0+",
      error: "Failed to check SurrealDB deployment",
      details:
        "Cannot access k8s cluster or SurrealDB deployment not in metabob namespace",
    };
  }
}

/**
 * Validate that AsyncSurrealDBClient class exists in surrealdb_client.py
 */
async function validateAsyncClientImplementation(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const { stdout } = await execAsync(
      "grep -n 'class AsyncSurrealDBClient' repos/metabob-rpc-api/server/db/surrealdb_client.py"
    );

    const pass = stdout.includes("AsyncSurrealDBClient");

    return {
      pass,
      actual: pass ? "AsyncSurrealDBClient class found" : "Class not found",
      expected: "AsyncSurrealDBClient class exists",
      details: pass
        ? `Found at: ${stdout.trim()}`
        : "Custom HTTP client not replaced with async wrapper",
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: "AsyncSurrealDBClient class not found",
      expected: "AsyncSurrealDBClient class exists",
      error: "Client implementation not updated",
    };
  }
}

/**
 * Validate that official surrealdb library is imported
 */
async function validateOfficialLibraryImport(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const { stdout } = await execAsync(
      "grep -n 'from surrealdb import Surreal' repos/metabob-rpc-api/server/db/surrealdb_client.py"
    );

    const pass = stdout.includes("from surrealdb import Surreal");

    return {
      pass,
      actual: pass ? "Official library imported" : "Not imported",
      expected: "from surrealdb import Surreal",
      details: pass ? `Found at: ${stdout.trim()}` : "Still using custom HTTP client",
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: "Official surrealdb library not imported",
      expected: "from surrealdb import Surreal",
      error: "Client not updated to use official library",
    };
  }
}

/**
 * Validate that merge() is used instead of update() in template_metrics.py
 */
async function validateMergeUsageInTemplateMetrics(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    // Check for merge() call in update_metrics_after_execution
    const { stdout: mergeUsage } = await execAsync(
      "grep -n 'await db.merge' repos/metabob-rpc-api/server/db/operations/template_metrics.py || echo ''"
    );

    // Check that the old update() call with workaround is gone
    const { stdout: oldWorkaround } = await execAsync(
      "grep -n 'Preserve immutable field' repos/metabob-rpc-api/server/db/operations/template_metrics.py || echo ''"
    );

    const hasMerge = mergeUsage.length > 0;
    const workaroundRemoved = oldWorkaround.length === 0;
    const pass = hasMerge && workaroundRemoved;

    return {
      pass,
      actual: {
        mergeUsed: hasMerge,
        workaroundRemoved: workaroundRemoved,
        mergeLocations: mergeUsage.trim().split("\n").filter((l) => l.length > 0),
      },
      expected: {
        mergeUsed: true,
        workaroundRemoved: true,
        description:
          "db.merge() used for partial updates, variant_id/activity_id preservation workaround removed",
      },
      details: pass
        ? `✓ merge() used, workaround removed - bug fix applied`
        : !hasMerge
        ? "✗ merge() not found - still using update()"
        : "✗ Workaround comments still present - incomplete fix",
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: error.message,
      expected: "merge() used in update_metrics_after_execution",
      error: "Failed to validate merge() usage",
    };
  }
}

/**
 * Validate that update_metrics_after_execution is async
 */
async function validateAsyncFunctionSignatures(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const { stdout } = await execAsync(
      "grep -n 'async def update_metrics_after_execution\\|async def get_metrics\\|async def create_metrics' repos/metabob-rpc-api/server/db/operations/template_metrics.py"
    );

    const lines = stdout.trim().split("\n").filter((l) => l.length > 0);
    const pass = lines.length >= 3; // Should have all 3 async functions

    return {
      pass,
      actual: {
        asyncFunctionsFound: lines.length,
        functions: lines.map((l) => l.split(":")[1]?.trim()).filter(Boolean),
      },
      expected: {
        asyncFunctionsFound: 3,
        functions: [
          "async def get_metrics",
          "async def create_metrics",
          "async def update_metrics_after_execution",
        ],
      },
      details: pass
        ? `✓ All 3 critical functions converted to async`
        : `✗ Only ${lines.length}/3 functions are async`,
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: error.message,
      expected: "3 async functions",
      error: "Failed to validate async function signatures",
    };
  }
}

/**
 * Validate that get_surreal_client() is async
 */
async function validateGetClientIsAsync(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const { stdout } = await execAsync(
      "grep -A 2 'async def get_surreal_client' repos/metabob-rpc-api/server/db/surrealdb_client.py"
    );

    const pass = stdout.includes("async def get_surreal_client");

    return {
      pass,
      actual: pass ? "async def get_surreal_client()" : "def get_surreal_client()",
      expected: "async def get_surreal_client()",
      details: pass
        ? "✓ Client getter is async"
        : "✗ Client getter not converted to async",
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: "get_surreal_client not found or not async",
      expected: "async def get_surreal_client()",
      error: "Client getter not properly implemented",
    };
  }
}

/**
 * Validate variant_id persistence via end-to-end test
 * This requires the RPC API to be running
 */
async function validateVariantIdPersistenceE2E(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const testTemplateId = `test-validation-${Date.now()}`;
    const metricsEndpoint = input.rpcApiUrl || "http://localhost:8000";

    // Step 1: Create metrics via POST endpoint
    const createResponse = await fetch(
      `${metricsEndpoint}/v2/activities/templates/${testTemplateId}/metrics`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          duration_ms: 5000,
          cost_usd: 0.02,
          tokens_input: 1000,
          tokens_output: 500,
          tokens_cache: 0,
        }),
      }
    );

    if (!createResponse.ok) {
      throw new Error(`Create failed: ${createResponse.statusText}`);
    }

    const created = await createResponse.json();

    // Step 2: Update metrics again (should use merge())
    const updateResponse = await fetch(
      `${metricsEndpoint}/v2/activities/templates/${testTemplateId}/metrics`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          duration_ms: 6000,
          cost_usd: 0.03,
          tokens_input: 1500,
          tokens_output: 700,
          tokens_cache: 100,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Update failed: ${updateResponse.statusText}`);
    }

    const updated = await updateResponse.json();

    // Step 3: Verify variant_id and activity_id are NOT NONE/null
    const variantIdPersisted = updated.variant_id === testTemplateId;
    const activityIdPersisted =
      updated.activity_id && updated.activity_id !== null && updated.activity_id !== "NONE";

    const pass = variantIdPersisted && activityIdPersisted;

    return {
      pass,
      actual: {
        variant_id: updated.variant_id,
        activity_id: updated.activity_id,
        total_executions: updated.total_executions,
      },
      expected: {
        variant_id: testTemplateId,
        activity_id: testTemplateId.split("-").slice(0, -1).join("-"), // Base activity ID
        total_executions: 2,
      },
      details: pass
        ? `✓ variant_id and activity_id persisted after merge()`
        : `✗ Fields lost: variant_id=${updated.variant_id}, activity_id=${updated.activity_id}`,
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: error.message,
      expected: "variant_id and activity_id persist after updates",
      error: "E2E test failed - RPC API may not be running",
      details: error.message,
    };
  }
}

/**
 * Validate Thompson Sampling query works (SELECT WHERE variant_id = $id)
 * This requires direct database access
 */
async function validateThompsonSamplingQuery(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    // This test requires Python environment with surrealdb installed
    const testScript = `
import asyncio
from repos.metabob_rpc_api.server.db.surrealdb_client import get_surreal_client

async def test_query():
    db = await get_surreal_client()
    result = await db.query(
        "SELECT * FROM template_metrics WHERE variant_id = $variant_id LIMIT 5",
        {"variant_id": "${input.testVariantId || "test-template"}"}
    )
    print("QUERY_SUCCESS" if result is not None else "QUERY_FAILED")

asyncio.run(test_query())
`;

    const { stdout, stderr } = await execAsync(
      `cd repos/metabob-rpc-api && python -c '${testScript.replace(/'/g, "'\\''")}' 2>&1`
    );

    const pass = stdout.includes("QUERY_SUCCESS");

    return {
      pass,
      actual: stdout.trim(),
      expected: "QUERY_SUCCESS",
      details: pass
        ? "✓ Thompson Sampling queries work"
        : `✗ Query failed: ${stderr || stdout}`,
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: error.message,
      expected: "Thompson Sampling query succeeds",
      error: "Failed to test database query",
      details: "Requires Python environment and database connection",
    };
  }
}

/**
 * Validate that legacy client backup exists
 */
async function validateLegacyClientBackup(
  input: any,
  expected: any
): Promise<ValidationResult> {
  try {
    const { stdout } = await execAsync(
      "test -f repos/metabob-rpc-api/server/db/surrealdb_client_legacy.py && echo 'EXISTS' || echo 'NOT_FOUND'"
    );

    const pass = stdout.trim() === "EXISTS";

    return {
      pass,
      actual: pass ? "Backup exists" : "Backup not found",
      expected: "surrealdb_client_legacy.py exists",
      details: pass
        ? "✓ Rollback backup available"
        : "✗ No rollback backup - risky deployment",
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: "Backup check failed",
      expected: "surrealdb_client_legacy.py exists",
      error: "Failed to check backup file",
    };
  }
}

// ============================================================================
// Test Cases
// ============================================================================

const testCases: TestCase[] = [
  {
    name: "Case 1: Official surrealdb-py library installed",
    input: {},
    expectedOutput: { minVersion: "1.0.0" },
    validator: validateSurrealDBPackageInstalled,
  },
  {
    name: "Case 2: SurrealDB v3.0+ deployment running",
    input: {},
    expectedOutput: { minVersion: "v3.0.0" },
    validator: validateSurrealDBDeployment,
  },
  {
    name: "Case 3: AsyncSurrealDBClient class implemented",
    input: {},
    expectedOutput: { className: "AsyncSurrealDBClient" },
    validator: validateAsyncClientImplementation,
  },
  {
    name: "Case 4: Official surrealdb library imported",
    input: {},
    expectedOutput: { import: "from surrealdb import Surreal" },
    validator: validateOfficialLibraryImport,
  },
  {
    name: "Case 5: merge() used in template_metrics.py",
    input: {},
    expectedOutput: { mergeUsed: true, workaroundRemoved: true },
    validator: validateMergeUsageInTemplateMetrics,
  },
  {
    name: "Case 6: Key functions converted to async",
    input: {},
    expectedOutput: { asyncFunctionsCount: 3 },
    validator: validateAsyncFunctionSignatures,
  },
  {
    name: "Case 7: get_surreal_client() is async",
    input: {},
    expectedOutput: { signature: "async def get_surreal_client()" },
    validator: validateGetClientIsAsync,
  },
  {
    name: "Case 8: Legacy client backup exists",
    input: {},
    expectedOutput: { backupExists: true },
    validator: validateLegacyClientBackup,
  },
  {
    name: "Case 9: variant_id persists after updates (E2E)",
    input: { rpcApiUrl: Bun.env.RPC_API_URL || "http://localhost:8000" },
    expectedOutput: { variantIdPersists: true, activityIdPersists: true },
    validator: validateVariantIdPersistenceE2E,
  },
  {
    name: "Case 10: Thompson Sampling queries work",
    input: { testVariantId: "test-template" },
    expectedOutput: { querySucceeds: true },
    validator: validateThompsonSamplingQuery,
  },
];

// ============================================================================
// Main Validation Runner
// ============================================================================

export async function runValidation(
  input?: any
): Promise<{ pass: boolean; results: ValidationResult[]; summary: any }> {
  console.log("=".repeat(80));
  console.log("VALIDATION HARNESS: SurrealDB Official Library Integration");
  console.log("=".repeat(80));
  console.log();

  const results: ValidationResult[] = [];
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`[${i + 1}/${testCases.length}] ${testCase.name}`);

    try {
      const result = await testCase.validator(testCase.input, testCase.expectedOutput);
      results.push(result);

      if (result.pass) {
        passCount++;
        console.log(`  ✓ PASS`);
      } else {
        failCount++;
        console.log(`  ✗ FAIL`);
      }

      if (result.details) {
        console.log(`  ${result.details}`);
      }

      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    } catch (error: any) {
      skipCount++;
      console.log(`  ⊘ SKIP - ${error.message}`);
      results.push({
        pass: false,
        actual: error.message,
        expected: testCase.expectedOutput,
        error: "Test execution failed",
      });
    }

    console.log();
  }

  const overallPass = failCount === 0 && passCount > 0;

  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✓ Pass: ${passCount}`);
  console.log(`✗ Fail: ${failCount}`);
  console.log(`⊘ Skip: ${skipCount}`);
  console.log();
  console.log(`Overall: ${overallPass ? "✓ PASS" : "✗ FAIL"}`);
  console.log("=".repeat(80));

  return {
    pass: overallPass,
    results,
    summary: {
      total: testCases.length,
      pass: passCount,
      fail: failCount,
      skip: skipCount,
    },
  };
}

// Run validation if executed directly
if (import.meta.main) {
  try {
    const result = await runValidation();
    Bun.exit(result.pass ? 0 : 1);
  } catch (error) {
    console.error("Validation harness crashed:", error);
    Bun.exit(2);
  }
}
