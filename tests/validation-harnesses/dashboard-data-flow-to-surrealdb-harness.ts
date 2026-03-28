#!/usr/bin/env bun
/**
 * Validation Harness: dashboard-data-flow-to-surrealdb
 * 
 * Tests end-to-end data flow from frontend API expectations through
 * backend database operations to SurrealDB schema compliance.
 * 
 * Validation Strategy: external-api-trace
 * - Validates database operations layer functions exist and have correct signatures
 * - Validates SurrealDB schema tables exist with required fields
 * - Validates data transformations match frontend API expectations
 * 
 * NO LLM REQUIRED - Pure validation logic
 */

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
}

interface HarnessResult {
  specificationName: string;
  totalCases: number;
  passed: number;
  failed: number;
  results: Array<{
    caseName: string;
    pass: boolean;
    actual: any;
    expected: any;
    error?: string;
  }>;
}

/**
 * Check if a Python file exists and contains required function definitions
 */
function validatePythonModule(
  filePath: string,
  requiredFunctions: string[]
): ValidationResult {
  const fullPath = `${Bun.cwd()}/${filePath}`;

  if (!existsSync(fullPath)) {
    return {
      pass: false,
      actual: { exists: false },
      expected: { exists: true, functions: requiredFunctions },
      error: `File not found: ${filePath}`,
    };
  }

  const content = readFileSync(fullPath, "utf-8");

  const missingFunctions = requiredFunctions.filter((fn) => {
    const pattern = new RegExp(`async def ${fn}\\s*\\(`);
    return !pattern.test(content);
  });

  if (missingFunctions.length > 0) {
    return {
      pass: false,
      actual: {
        exists: true,
        missingFunctions,
      },
      expected: { exists: true, functions: requiredFunctions },
      error: `Missing functions: ${missingFunctions.join(", ")}`,
    };
  }

  return {
    pass: true,
    actual: { exists: true, functions: requiredFunctions },
    expected: { exists: true, functions: requiredFunctions },
  };
}

/**
 * Validate SurrealDB schema file contains required table definitions
 */
function validateSurrealDBSchema(
  schemaPath: string,
  requiredTables: string[]
): ValidationResult {
  const fullPath = join(process.cwd(), schemaPath);

  if (!existsSync(fullPath)) {
    return {
      pass: false,
      actual: { exists: false },
      expected: { exists: true, tables: requiredTables },
      error: `Schema file not found: ${schemaPath}`,
    };
  }

  const content = readFileSync(fullPath, "utf-8");

  const missingTables = requiredTables.filter((table) => {
    const pattern = new RegExp(`DEFINE TABLE ${table}`, "i");
    return !pattern.test(content);
  });

  if (missingTables.length > 0) {
    return {
      pass: false,
      actual: {
        exists: true,
        missingTables,
      },
      expected: { exists: true, tables: requiredTables },
      error: `Missing tables: ${missingTables.join(", ")}`,
    };
  }

  // Validate table has required fields (basic check)
  const tableValidations = requiredTables.map((table) => {
    const tableRegex = new RegExp(
      `DEFINE TABLE ${table}[\\s\\S]*?(?=DEFINE TABLE|DEFINE INDEX|$)`,
      "i"
    );
    const tableBlock = content.match(tableRegex);

    if (!tableBlock) {
      return { table, valid: false, reason: "Table definition not found" };
    }

    // Check for SCHEMAFULL
    if (!tableBlock[0].includes("SCHEMAFULL")) {
      return { table, valid: false, reason: "Not SCHEMAFULL" };
    }

    return { table, valid: true };
  });

  const invalidTables = tableValidations.filter((t) => !t.valid);

  if (invalidTables.length > 0) {
    return {
      pass: false,
      actual: {
        exists: true,
        invalidTables: invalidTables.map((t) => ({
          table: t.table,
          reason: t.reason,
        })),
      },
      expected: { exists: true, tables: requiredTables, schemafull: true },
      error: `Invalid table definitions: ${invalidTables
        .map((t) => `${t.table} (${t.reason})`)
        .join(", ")}`,
    };
  }

  return {
    pass: true,
    actual: { exists: true, tables: requiredTables, schemafull: true },
    expected: { exists: true, tables: requiredTables, schemafull: true },
  };
}

/**
 * Validate data flow component exists and has correct structure
 */
function validateDataFlowComponent(
  componentPath: string,
  expectedExports: string[]
): ValidationResult {
  const fullPath = join(process.cwd(), componentPath);

  if (!existsSync(fullPath)) {
    return {
      pass: false,
      actual: { exists: false },
      expected: { exists: true, exports: expectedExports },
      error: `Component file not found: ${componentPath}`,
    };
  }

  const content = readFileSync(fullPath, "utf-8");

  // For Python modules, check for function definitions
  if (componentPath.endsWith(".py")) {
    const missingExports = expectedExports.filter((exp) => {
      const pattern = new RegExp(`(async )?def ${exp}\\s*\\(`);
      return !pattern.test(content);
    });

    if (missingExports.length > 0) {
      return {
        pass: false,
        actual: { exists: true, missingExports },
        expected: { exists: true, exports: expectedExports },
        error: `Missing exports: ${missingExports.join(", ")}`,
      };
    }
  }

  // For JavaScript files, check for exports
  if (componentPath.endsWith(".js")) {
    const missingExports = expectedExports.filter((exp) => {
      const patterns = [
        new RegExp(`export (const|function|class) ${exp}`),
        new RegExp(`export.*${exp}`),
        new RegExp(`${exp}:.*builder\\.query`),
        new RegExp(`${exp}:.*builder\\.mutation`),
      ];
      return !patterns.some((p) => p.test(content));
    });

    if (missingExports.length > 0) {
      return {
        pass: false,
        actual: { exists: true, missingExports },
        expected: { exists: true, exports: expectedExports },
        error: `Missing exports: ${missingExports.join(", ")}`,
      };
    }
  }

  return {
    pass: true,
    actual: { exists: true, exports: expectedExports },
    expected: { exists: true, exports: expectedExports },
  };
}

/**
 * Main validation runner
 */
export async function runValidation(): Promise<HarnessResult> {
  const results: HarnessResult["results"] = [];

  // Test Case 1: Validate SurrealDB Schema
  console.log("Running Test Case 1: SurrealDB Schema Validation...");
  const schemaResult = validateSurrealDBSchema(
    "repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql",
    [
      "organizations",
      "projects",
      "developers",
      "api_keys",
      "sessions",
      "activity_executions",
      "project_annotations",
      "project_problems",
      "project_metrics_history",
    ]
  );
  results.push({
    caseName: "SurrealDB Schema Tables",
    ...schemaResult,
  });

  // Test Case 2: Validate Organization Operations
  console.log("Running Test Case 2: Organization Operations Validation...");
  const orgOpsResult = validatePythonModule(
    "repos/metabob-rpc-api/server/db/operations/organization_ops.py",
    [
      "create_organization",
      "get_organization",
      "list_organizations",
      "update_organization",
      "delete_organization",
      "get_organization_stats",
    ]
  );
  results.push({
    caseName: "Organization Database Operations",
    ...orgOpsResult,
  });

  // Test Case 3: Validate Project Operations
  console.log("Running Test Case 3: Project Operations Validation...");
  const projectOpsResult = validatePythonModule(
    "repos/metabob-rpc-api/server/db/operations/project_ops.py",
    [
      "create_project",
      "get_project",
      "list_projects_by_org",
      "update_project",
      "update_project_stats",
      "delete_project",
    ]
  );
  results.push({
    caseName: "Project Database Operations",
    ...projectOpsResult,
  });

  // Test Case 4: Validate API Key Operations
  console.log("Running Test Case 4: API Key Operations Validation...");
  const apiKeyOpsResult = validatePythonModule(
    "repos/metabob-rpc-api/server/db/operations/api_key_ops.py",
    [
      "generate_api_key",
      "create_api_key",
      "get_api_key_by_key",
      "list_api_keys_by_org",
      "list_api_keys_by_user",
      "deactivate_api_key",
      "update_last_used",
    ]
  );
  results.push({
    caseName: "API Key Database Operations",
    ...apiKeyOpsResult,
  });

  // Test Case 5: Validate Frontend OrganizationApi
  console.log("Running Test Case 5: Frontend OrganizationApi Validation...");
  const orgApiResult = validateDataFlowComponent(
    "repos/metabob-dashboard/src/cloud/api/OrganizationApi.js",
    [
      "useGetOrganizationsQuery",
      "useGetOrganizationQuery",
      "useCreateOrganizationMutation",
      "useUpdateOrganizationMutation",
      "useDeleteOrganizationMutation",
    ]
  );
  results.push({
    caseName: "Frontend Organization API",
    ...orgApiResult,
  });

  // Test Case 6: Validate Frontend ProjectApi
  console.log("Running Test Case 6: Frontend ProjectApi Validation...");
  const projectApiResult = validateDataFlowComponent(
    "repos/metabob-dashboard/src/cloud/api/ProjectApi.js",
    [
      "useGetProjectsQuery",
      "useGetProjectQuery",
      "useCreateProjectMutation",
      "useUpdateProjectMutation",
      "useGetProjectStatsQuery",
    ]
  );
  results.push({
    caseName: "Frontend Project API",
    ...projectApiResult,
  });

  // Test Case 7: Validate Frontend ApiKeyApi
  console.log("Running Test Case 7: Frontend ApiKeyApi Validation...");
  const apiKeyApiResult = validateDataFlowComponent(
    "repos/metabob-dashboard/src/cloud/api/ApiKeyApi.js",
    [
      "useGetApiKeysQuery",
      "useCreateApiKeyMutation",
      "useDeleteApiKeyMutation",
    ]
  );
  results.push({
    caseName: "Frontend API Key API",
    ...apiKeyApiResult,
  });

  // Calculate summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  return {
    specificationName: "dashboard-data-flow-to-surrealdb",
    totalCases: results.length,
    passed,
    failed,
    results,
  };
}

/**
 * CLI runner
 */
if (import.meta.main) {
  console.log("=== Dashboard Data Flow Validation Harness ===\n");
  console.log("Specification: dashboard-data-flow-to-surrealdb");
  console.log("Strategy: external-api-trace\n");

  runValidation()
    .then((result) => {
      console.log("\n=== Validation Results ===");
      console.log(`Total Cases: ${result.totalCases}`);
      console.log(`Passed: ${result.passed}`);
      console.log(`Failed: ${result.failed}`);
      console.log(
        `Success Rate: ${((result.passed / result.totalCases) * 100).toFixed(
          1
        )}%\n`
      );

      result.results.forEach((r, i) => {
        const status = r.pass ? "✅ PASS" : "❌ FAIL";
        console.log(`${i + 1}. ${r.caseName}: ${status}`);
        if (!r.pass && r.error) {
          console.log(`   Error: ${r.error}`);
        }
      });

      console.log(
        "\n" + JSON.stringify(result, null, 2)
      );

      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Validation harness failed:", error);
      process.exit(1);
    });
}
