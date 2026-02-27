/**
 * Validation Harness: Instance-Invariant Storage - Missing Backend API Endpoints
 * 
 * Tests that the newly implemented backend activity storage endpoints work correctly.
 * 
 * Specification: Instance-Invariant Storage - Missing Backend API Endpoints
 * 
 * Validation Strategy:
 * 1. Test POST /v2/activities endpoint exists and works
 * 2. Test GET /v2/activities/{id} endpoint exists and works
 * 3. Verify (api_key, project_id) scoping works correctly
 * 4. Test cross-instance activity retrieval
 * 5. Verify multi-tenant isolation
 * 6. Test error handling (404, 400, 500)
 * 
 * Architecture: Non-LLM, automated pass/fail validation with detailed diagnostics.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

interface ValidationResult {
  pass: boolean;
  testCaseId: string;
  testName: string;
  expected: any;
  actual: any;
  errorMessage?: string;
  diagnostics?: Record<string, any>;
}

interface HarnessResult {
  overallPass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: ValidationResult[];
  summary: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Test credentials for multi-tenant isolation testing
  apiKey1: process.env.TEST_API_KEY_1 || "test_api_key_instance_a",
  apiKey2: process.env.TEST_API_KEY_2 || "test_api_key_instance_b",
  projectId1: "test_project_alpha",
  projectId2: "test_project_beta",
  
  // Backend URL
  rpcApiUrl: process.env.METABOB_RPC_URL || "http://localhost:8081",
  
  // Timeouts
  operationTimeout: 10000, // 10 seconds
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Make HTTP request to rpc-api backend
 */
async function makeRequest(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: any
): Promise<{ status: number; data: any; error?: string }> {
  const url = `${CONFIG.rpcApiUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    let data = null;
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else if (response.status !== 204) {
      const text = await response.text();
      data = text ? { raw: text } : null;
    }
    
    return {
      status: response.status,
      data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error: any) {
    return {
      status: 0,
      data: null,
      error: `Request failed: ${error.message}`,
    };
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Test Case 1: POST /v2/activities endpoint exists and works
 */
async function testCase1_PostActivityEndpointWorks(): Promise<ValidationResult> {
  const testCaseId = "validation-instance-invariant-storage-missing-backend-api-endpoints-case-1";
  const testName = "POST /v2/activities endpoint works";
  
  try {
    const activityId = `test-activity-${Date.now()}-1`;
    const activityData = {
      id: activityId,
      template: "test-template",
      status: "running",
      tasks: [],
      createdAt: new Date().toISOString(),
    };
    
    const result = await makeRequest(
      "/v2/activities/storage",
      "POST",
      CONFIG.apiKey1,
      {
        activity_id: activityId,
        project_id: CONFIG.projectId1,
        activity_data: activityData,
      }
    );
    
    const expectedStatus = 201;
    const pass = result.status === expectedStatus && 
                 result.data?.activity_id === activityId &&
                 result.data?.api_key === CONFIG.apiKey1 &&
                 result.data?.project_id === CONFIG.projectId1;
    
    return {
      pass,
      testCaseId,
      testName,
      expected: { status: expectedStatus, hasActivityId: true, hasApiKey: true },
      actual: { 
        status: result.status, 
        activityId: result.data?.activity_id,
        hasApiKey: !!result.data?.api_key,
        error: result.error 
      },
      errorMessage: pass ? undefined : `Expected 201 with activity data, got ${result.status}`,
      diagnostics: { response: result.data },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: { status: 201 },
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 2: GET /v2/activities/{id} endpoint exists and works
 */
async function testCase2_GetActivityEndpointWorks(): Promise<ValidationResult> {
  const testCaseId = "validation-instance-invariant-storage-missing-backend-api-endpoints-case-2";
  const testName = "GET /v2/activities/{id} endpoint works";
  
  try {
    // First, create an activity
    const activityId = `test-activity-${Date.now()}-2`;
    const activityData = {
      id: activityId,
      template: "test-template",
      status: "completed",
      tasks: [{ id: "task1", status: "done" }],
    };
    
    const createResult = await makeRequest(
      "/v2/activities/storage",
      "POST",
      CONFIG.apiKey1,
      {
        activity_id: activityId,
        project_id: CONFIG.projectId1,
        activity_data: activityData,
      }
    );
    
    if (createResult.status !== 201) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: { setupStatus: 201 },
        actual: { setupStatus: createResult.status },
        errorMessage: `Setup failed: Could not create activity (${createResult.error})`,
      };
    }
    
    // Now retrieve it
    const getResult = await makeRequest(
      `/v2/activities/${activityId}?project_id=${CONFIG.projectId1}`,
      "GET",
      CONFIG.apiKey1
    );
    
    const expectedStatus = 200;
    const pass = getResult.status === expectedStatus && 
                 getResult.data?.activity_id === activityId &&
                 JSON.stringify(getResult.data?.activity_data) === JSON.stringify(activityData);
    
    return {
      pass,
      testCaseId,
      testName,
      expected: { status: expectedStatus, activityId, dataMatch: true },
      actual: { 
        status: getResult.status, 
        activityId: getResult.data?.activity_id,
        dataMatch: JSON.stringify(getResult.data?.activity_data) === JSON.stringify(activityData),
        error: getResult.error 
      },
      errorMessage: pass ? undefined : `Expected 200 with matching data, got ${getResult.status}`,
      diagnostics: { 
        created: activityData,
        retrieved: getResult.data?.activity_data 
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: { status: 200 },
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 3: Cross-instance activity retrieval works
 */
async function testCase3_CrossInstanceActivityRetrieval(): Promise<ValidationResult> {
  const testCaseId = "validation-instance-invariant-storage-missing-backend-api-endpoints-case-3";
  const testName = "Cross-instance activity retrieval";
  
  try {
    const activityId = `test-activity-${Date.now()}-3`;
    const activityData = {
      id: activityId,
      template: "cross-instance-test",
      status: "completed",
      result: "success",
    };
    
    // Instance A: Store activity
    const storeResult = await makeRequest(
      "/v2/activities/storage",
      "POST",
      CONFIG.apiKey1,
      {
        activity_id: activityId,
        project_id: CONFIG.projectId1,
        activity_data: activityData,
      }
    );
    
    if (storeResult.status !== 201) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: { storeStatus: 201 },
        actual: { storeStatus: storeResult.status },
        errorMessage: `Failed to store activity in Instance A (${storeResult.error})`,
      };
    }
    
    // Simulate network delay / different machine
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Instance B: Retrieve activity with same (api_key, project_id)
    const loadResult = await makeRequest(
      `/v2/activities/${activityId}?project_id=${CONFIG.projectId1}`,
      "GET",
      CONFIG.apiKey1
    );
    
    const dataMatch = JSON.stringify(loadResult.data?.activity_data) === JSON.stringify(activityData);
    const pass = loadResult.status === 200 && dataMatch;
    
    return {
      pass,
      testCaseId,
      testName,
      expected: { status: 200, dataMatch: true },
      actual: { 
        status: loadResult.status, 
        dataMatch,
        error: loadResult.error 
      },
      errorMessage: pass ? undefined : "Activity data mismatch between instances",
      diagnostics: {
        stored: activityData,
        retrieved: loadResult.data?.activity_data,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: { status: 200, dataMatch: true },
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 4: Multi-tenant isolation (api_key scoping)
 */
async function testCase4_MultiTenantIsolation(): Promise<ValidationResult> {
  const testCaseId = "validation-instance-invariant-storage-missing-backend-api-endpoints-case-4";
  const testName = "Multi-tenant isolation (api_key scoping)";
  
  try {
    const activityId = `test-activity-${Date.now()}-4`;
    const activityData = {
      id: activityId,
      template: "tenant-isolation-test",
      secret: "api_key_1_secret_data",
    };
    
    // Tenant 1: Store activity
    const storeResult = await makeRequest(
      "/v2/activities/storage",
      "POST",
      CONFIG.apiKey1,
      {
        activity_id: activityId,
        project_id: CONFIG.projectId1,
        activity_data: activityData,
      }
    );
    
    if (storeResult.status !== 201) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: { storeStatus: 201 },
        actual: { storeStatus: storeResult.status },
        errorMessage: `Failed to store activity for Tenant 1 (${storeResult.error})`,
      };
    }
    
    // Tenant 2: Try to access Tenant 1's activity (should fail with 404)
    const loadResult = await makeRequest(
      `/v2/activities/${activityId}?project_id=${CONFIG.projectId1}`,
      "GET",
      CONFIG.apiKey2  // Different API key
    );
    
    const pass = loadResult.status === 404;  // Should NOT find the activity
    
    return {
      pass,
      testCaseId,
      testName,
      expected: { status: 404, reason: "Different api_key should not access data" },
      actual: { 
        status: loadResult.status,
        foundData: !!loadResult.data?.activity_id,
        error: loadResult.error 
      },
      errorMessage: pass ? undefined : `Expected 404 (isolation), got ${loadResult.status}`,
      diagnostics: {
        tenant1ApiKey: CONFIG.apiKey1.substring(0, 8) + "...",
        tenant2ApiKey: CONFIG.apiKey2.substring(0, 8) + "...",
        attemptedAccess: loadResult.data,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: { status: 404 },
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 5: Project isolation (project_id scoping)
 */
async function testCase5_ProjectIsolation(): Promise<ValidationResult> {
  const testCaseId = "validation-instance-invariant-storage-missing-backend-api-endpoints-case-5";
  const testName = "Project isolation (project_id scoping)";
  
  try {
    const activityId = `test-activity-${Date.now()}-5`;
    const activityData = {
      id: activityId,
      template: "project-isolation-test",
      secret: "project_1_secret_data",
    };
    
    // Project 1: Store activity
    const storeResult = await makeRequest(
      "/v2/activities/storage",
      "POST",
      CONFIG.apiKey1,
      {
        activity_id: activityId,
        project_id: CONFIG.projectId1,
        activity_data: activityData,
      }
    );
    
    if (storeResult.status !== 201) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: { storeStatus: 201 },
        actual: { storeStatus: storeResult.status },
        errorMessage: `Failed to store activity for Project 1 (${storeResult.error})`,
      };
    }
    
    // Try to access from Project 2 (same api_key, different project_id)
    const loadResult = await makeRequest(
      `/v2/activities/${activityId}?project_id=${CONFIG.projectId2}`,  // Different project
      "GET",
      CONFIG.apiKey1  // Same API key
    );
    
    const pass = loadResult.status === 404;  // Should NOT find the activity
    
    return {
      pass,
      testCaseId,
      testName,
      expected: { status: 404, reason: "Different project_id should not access data" },
      actual: { 
        status: loadResult.status,
        foundData: !!loadResult.data?.activity_id,
        error: loadResult.error 
      },
      errorMessage: pass ? undefined : `Expected 404 (isolation), got ${loadResult.status}`,
      diagnostics: {
        project1: CONFIG.projectId1,
        project2: CONFIG.projectId2,
        attemptedAccess: loadResult.data,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: { status: 404 },
      actual: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Test Case 6: Error handling (duplicate activity returns 400)
 */
async function testCase6_DuplicateActivityReturns400(): Promise<ValidationResult> {
  const testCaseId = "validation-instance-invariant-storage-missing-backend-api-endpoints-case-6";
  const testName = "Duplicate activity returns 400";
  
  try {
    const activityId = `test-activity-${Date.now()}-6`;
    const activityData = {
      id: activityId,
      template: "duplicate-test",
    };
    
    // Create activity first time (should succeed)
    const firstResult = await makeRequest(
      "/v2/activities/storage",
      "POST",
      CONFIG.apiKey1,
      {
        activity_id: activityId,
        project_id: CONFIG.projectId1,
        activity_data: activityData,
      }
    );
    
    if (firstResult.status !== 201) {
      return {
        pass: false,
        testCaseId,
        testName,
        expected: { firstStatus: 201 },
        actual: { firstStatus: firstResult.status },
        errorMessage: `Failed to create first activity (${firstResult.error})`,
      };
    }
    
    // Try to create same activity again (should fail with 400)
    const secondResult = await makeRequest(
      "/v2/activities/storage",
      "POST",
      CONFIG.apiKey1,
      {
        activity_id: activityId,
        project_id: CONFIG.projectId1,
        activity_data: activityData,
      }
    );
    
    const pass = secondResult.status === 400;
    
    return {
      pass,
      testCaseId,
      testName,
      expected: { status: 400, reason: "Duplicate activity should return 400" },
      actual: { 
        status: secondResult.status,
        error: secondResult.error 
      },
      errorMessage: pass ? undefined : `Expected 400 for duplicate, got ${secondResult.status}`,
      diagnostics: {
        firstCreateStatus: firstResult.status,
        secondCreateStatus: secondResult.status,
      },
    };
  } catch (error: any) {
    return {
      pass: false,
      testCaseId,
      testName,
      expected: { status: 400 },
      actual: null,
      errorMessage: error.message,
    };
  }
}

// ============================================================================
// MAIN HARNESS RUNNER
// ============================================================================

export async function runValidation(): Promise<HarnessResult> {
  console.log("🧪 Running Validation: Instance-Invariant Storage - Missing Backend API Endpoints\n");
  
  const testCases = [
    testCase1_PostActivityEndpointWorks,
    testCase2_GetActivityEndpointWorks,
    testCase3_CrossInstanceActivityRetrieval,
    testCase4_MultiTenantIsolation,
    testCase5_ProjectIsolation,
    testCase6_DuplicateActivityReturns400,
  ];
  
  const results: ValidationResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`Running: ${testCase.name}...`);
    const result = await testCase();
    results.push(result);
    
    if (result.pass) {
      passed++;
      console.log(`✅ PASS: ${result.testName}`);
    } else {
      failed++;
      console.log(`❌ FAIL: ${result.testName}`);
      console.log(`   Error: ${result.errorMessage}`);
    }
    console.log();
  }
  
  const overallPass = failed === 0;
  const summary = `${passed}/${testCases.length} tests passed`;
  
  console.log("=" .repeat(70));
  console.log(`📊 VALIDATION SUMMARY: ${summary}`);
  console.log(`Overall Status: ${overallPass ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(70));
  
  return {
    overallPass,
    totalTests: testCases.length,
    passed,
    failed,
    skipped: 0,
    results,
    summary,
  };
}

// Run if called directly
if (require.main === module) {
  runValidation()
    .then((result) => {
      process.exit(result.overallPass ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Validation harness error:", error);
      process.exit(1);
    });
}
