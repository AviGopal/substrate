/**
 * Validation Harness: v2 API Impulse Endpoints
 * 
 * PURPOSE:
 * Validates that the TypeScript v2 API impulse endpoints (repos/metabob-activity-api/src/routes/impulses.ts)
 * implement the exact same dataflows as the Python RPC API impulse endpoints for metabob-cli compatibility.
 * 
 * VALIDATION STRATEGY:
 * 1. POST /v2/impulses - Create impulse with project scope and verify SurrealDB storage
 * 2. GET /v2/impulses/:id - Retrieve impulse with correct project_id filtering
 * 3. GET /v2/impulses - List impulses with pagination
 * 4. Multi-Tenant Isolation - Cannot retrieve impulses from different project_id
 * 5. Authentication - 401 if Bearer token missing
 * 6. Not Found - 404 if impulse not found or wrong project_id
 * 7. Duplicate Detection - 400 if impulse_id already exists
 * 
 * NO LLM REQUIRED: Pure input/output validation against expected schemas.
 * 
 * REFERENCE:
 * - Python Implementation: repos/metabob-rpc-api/server/routes/impulse.py
 * - Database Operations: repos/metabob-rpc-api/server/db/operations/impulse_data.py
 * - TypeScript Implementation: repos/metabob-activity-api/src/routes/impulses.ts
 */

import { surrealDB } from '../../repos/metabob-activity-api/src/db/surreal';

// ============================================================================
// Configuration
// ============================================================================

const V2_API_BASE_URL = process.env.V2_API_URL || 'http://localhost:8080';

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface HarnessResult {
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

// ============================================================================
// Helper: Create Session
// ============================================================================

async function createSession(projectId: string = 'test-project-impulse-001'): Promise<string | null> {
  try {
    const response = await fetch(`${V2_API_BASE_URL}/v2/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: 'test-org-impulse',
        project_id: projectId,
        api_key: 'test-api-key-impulse-001'
      })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json() as { session?: string };
    return data.session || null;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// Test Case 1: POST /v2/impulses - Create Impulse with Project Scope
// ============================================================================

async function testCreateImpulse(): Promise<ValidationResult> {
  const testCase = "POST /v2/impulses - Create impulse with project scope";
  
  try {
    const bearerToken = await createSession('project-impulse-create');
    if (!bearerToken) {
      return {
        pass: false,
        testCase,
        actual: { error: 'Failed to create session' },
        expected: { session: 'valid Bearer token' },
        error: 'Cannot test without valid session'
      };
    }
    
    const impulseData = {
      impulse_id: 'test-impulse-001',
      project_id: 'project-impulse-create',
      impulse_data: {
        id: 'test-impulse-001',
        type: 'testResults',
        pointer: {
          type: 'memo',
          content: 'Test impulse content for validation',
          source: 'harness'
        },
        budget: 2000,
        priority: 1,
        scope: 'session',
        metadata: {
          test: true,
          harness: 'v2-api-impulse-endpoints'
        }
      }
    };
    
    const response = await fetch(`${V2_API_BASE_URL}/v2/impulses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(impulseData)
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      return {
        pass: false,
        testCase,
        actual: { status: response.status, body: errorBody },
        expected: { status: 201, schema: 'ImpulseResponse' },
        error: `Unexpected status: ${response.status}`
      };
    }
    
    const data = await response.json() as any;
    
    // Validate response schema
    const requiredFields = ['impulse_id', 'api_key', 'project_id', 'impulse_data', 'created_at', 'updated_at'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        return {
          pass: false,
          testCase,
          actual: data,
          expected: { requiredFields },
          error: `Missing field: ${field}`
        };
      }
    }
    
    // Validate values
    if (data.impulse_id !== 'test-impulse-001') {
      return {
        pass: false,
        testCase,
        actual: { impulse_id: data.impulse_id },
        expected: { impulse_id: 'test-impulse-001' },
        error: 'impulse_id mismatch'
      };
    }
    
    if (data.project_id !== 'project-impulse-create') {
      return {
        pass: false,
        testCase,
        actual: { project_id: data.project_id },
        expected: { project_id: 'project-impulse-create' },
        error: 'project_id mismatch'
      };
    }
    
    // Verify impulse stored in SurrealDB
    const dbQuery = `
      SELECT * FROM impulse_data
      WHERE impulse_id = $impulse_id
        AND project_id = $project_id
      LIMIT 1
    `;
    
    const dbResult = await surrealDB.query<any>(dbQuery, {
      impulse_id: 'test-impulse-001',
      project_id: 'project-impulse-create'
    });
    
    if (!dbResult || dbResult.length === 0) {
      return {
        pass: false,
        testCase,
        actual: { surrealdbFound: false },
        expected: { surrealdbFound: true },
        error: 'Impulse not found in SurrealDB'
      };
    }
    
    return {
      pass: true,
      testCase,
      actual: {
        status: response.status,
        impulse_id: data.impulse_id,
        project_id: data.project_id,
        surrealdbRecord: dbResult[0]
      },
      expected: {
        status: 201,
        impulseCreated: true,
        surrealdbStored: true
      },
      details: 'Impulse created successfully and stored in SurrealDB'
    };
    
  } catch (error) {
    return {
      pass: false,
      testCase,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: { status: 201 },
      error: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ============================================================================
// Test Case 2: GET /v2/impulses/:id - Retrieve Impulse with Tenant Filtering
// ============================================================================

async function testRetrieveImpulse(): Promise<ValidationResult> {
  const testCase = "GET /v2/impulses/:id - Retrieve impulse with multi-tenant isolation";
  
  try {
    const bearerToken = await createSession('project-impulse-retrieve');
    if (!bearerToken) {
      return {
        pass: false,
        testCase,
        actual: { error: 'Failed to create session' },
        expected: { session: 'valid Bearer token' },
        error: 'Cannot test without valid session'
      };
    }
    
    // First, create an impulse to retrieve
    const createData = {
      impulse_id: 'test-impulse-retrieve-002',
      project_id: 'project-impulse-retrieve',
      impulse_data: {
        id: 'test-impulse-retrieve-002',
        type: 'templateDefinition',
        pointer: {
          type: 'memo',
          content: 'Impulse for retrieval test'
        },
        budget: 1500,
        scope: 'project'
      }
    };
    
    await fetch(`${V2_API_BASE_URL}/v2/impulses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createData)
    });
    
    // Now retrieve it
    const response = await fetch(
      `${V2_API_BASE_URL}/v2/impulses/test-impulse-retrieve-002?project_id=project-impulse-retrieve`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      return {
        pass: false,
        testCase,
        actual: { status: response.status, body: await response.text() },
        expected: { status: 200, schema: 'ImpulseResponse' },
        error: `Unexpected status: ${response.status}`
      };
    }
    
    const data = await response.json() as any;
    
    // Validate response
    if (data.impulse_id !== 'test-impulse-retrieve-002') {
      return {
        pass: false,
        testCase,
        actual: { impulse_id: data.impulse_id },
        expected: { impulse_id: 'test-impulse-retrieve-002' },
        error: 'impulse_id mismatch'
      };
    }
    
    if (data.project_id !== 'project-impulse-retrieve') {
      return {
        pass: false,
        testCase,
        actual: { project_id: data.project_id },
        expected: { project_id: 'project-impulse-retrieve' },
        error: 'project_id mismatch'
      };
    }
    
    return {
      pass: true,
      testCase,
      actual: {
        status: response.status,
        impulse_id: data.impulse_id,
        project_id: data.project_id,
        impulse_data: data.impulse_data
      },
      expected: {
        status: 200,
        impulseRetrieved: true,
        correctProjectId: true
      },
      details: 'Impulse retrieved successfully with correct project_id filtering'
    };
    
  } catch (error) {
    return {
      pass: false,
      testCase,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: { status: 200 },
      error: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ============================================================================
// Test Case 3: GET /v2/impulses - List Impulses with Pagination
// ============================================================================

async function testListImpulses(): Promise<ValidationResult> {
  const testCase = "GET /v2/impulses - List impulses with pagination";
  
  try {
    const bearerToken = await createSession('project-impulse-list');
    if (!bearerToken) {
      return {
        pass: false,
        testCase,
        actual: { error: 'Failed to create session' },
        expected: { session: 'valid Bearer token' },
        error: 'Cannot test without valid session'
      };
    }
    
    // Create multiple impulses for listing
    for (let i = 1; i <= 5; i++) {
      await fetch(`${V2_API_BASE_URL}/v2/impulses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          impulse_id: `test-impulse-list-00${i}`,
          project_id: 'project-impulse-list',
          impulse_data: {
            id: `test-impulse-list-00${i}`,
            type: 'taskSummary',
            pointer: { type: 'memo', content: `Impulse ${i}` },
            budget: 1000 + (i * 100)
          }
        })
      });
    }
    
    // List impulses with pagination
    const response = await fetch(
      `${V2_API_BASE_URL}/v2/impulses?project_id=project-impulse-list&limit=3&offset=0`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      return {
        pass: false,
        testCase,
        actual: { status: response.status, body: await response.text() },
        expected: { status: 200, schema: 'ImpulseListResponse' },
        error: `Unexpected status: ${response.status}`
      };
    }
    
    const data = await response.json() as any;
    
    // Validate response schema
    const requiredFields = ['impulses', 'total', 'limit', 'offset'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        return {
          pass: false,
          testCase,
          actual: data,
          expected: { requiredFields },
          error: `Missing field: ${field}`
        };
      }
    }
    
    // Validate pagination
    if (!Array.isArray(data.impulses)) {
      return {
        pass: false,
        testCase,
        actual: { impulses: data.impulses },
        expected: { impulses: 'array' },
        error: 'impulses is not an array'
      };
    }
    
    if (data.impulses.length > 3) {
      return {
        pass: false,
        testCase,
        actual: { count: data.impulses.length },
        expected: { count: '<= 3 (limit)' },
        error: 'Pagination limit not enforced'
      };
    }
    
    if (data.limit !== 3 || data.offset !== 0) {
      return {
        pass: false,
        testCase,
        actual: { limit: data.limit, offset: data.offset },
        expected: { limit: 3, offset: 0 },
        error: 'Pagination params mismatch'
      };
    }
    
    return {
      pass: true,
      testCase,
      actual: {
        status: response.status,
        impulseCount: data.impulses.length,
        total: data.total,
        limit: data.limit,
        offset: data.offset
      },
      expected: {
        status: 200,
        impulsesReturned: true,
        paginationWorks: true
      },
      details: `Listed ${data.impulses.length} impulses with pagination (limit=3, offset=0)`
    };
    
  } catch (error) {
    return {
      pass: false,
      testCase,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: { status: 200 },
      error: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ============================================================================
// Test Case 4: Multi-Tenant Isolation - Cannot Retrieve Impulses from Different Project
// ============================================================================

async function testMultiTenantIsolation(): Promise<ValidationResult> {
  const testCase = "Multi-Tenant Isolation - Cannot retrieve impulses from different project_id";
  
  try {
    // Create session for project A
    const tokenA = await createSession('project-a-isolation');
    if (!tokenA) {
      throw new Error('Failed to create session A');
    }
    
    // Create impulse in project A
    const createResponse = await fetch(`${V2_API_BASE_URL}/v2/impulses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        impulse_id: 'test-impulse-isolation-003',
        project_id: 'project-a-isolation',
        impulse_data: {
          id: 'test-impulse-isolation-003',
          type: 'memo',
          pointer: { type: 'memo', content: 'Secret data for project A' },
          budget: 1000
        }
      })
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create impulse in project A');
    }
    
    // Create session for project B
    const tokenB = await createSession('project-b-isolation');
    if (!tokenB) {
      throw new Error('Failed to create session B');
    }
    
    // Try to retrieve project A's impulse using project B's token
    const response = await fetch(
      `${V2_API_BASE_URL}/v2/impulses/test-impulse-isolation-003?project_id=project-a-isolation`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenB}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Should return 404 due to tenant isolation
    if (response.status !== 404) {
      return {
        pass: false,
        testCase,
        actual: { status: response.status, body: await response.text() },
        expected: { status: 404, reason: 'Multi-tenant isolation enforced' },
        error: 'Expected 404 but got ' + response.status
      };
    }
    
    return {
      pass: true,
      testCase,
      actual: {
        status: response.status,
        isolationEnforced: true
      },
      expected: {
        status: 404,
        multiTenantIsolation: true
      },
      details: 'Multi-tenant isolation correctly prevents cross-project access'
    };
    
  } catch (error) {
    return {
      pass: false,
      testCase,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: { multiTenantIsolation: true },
      error: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ============================================================================
// Test Case 5: Authentication - 401 if Bearer Token Missing
// ============================================================================

async function testAuthenticationRequired(): Promise<ValidationResult> {
  const testCase = "Authentication - 401 if Bearer token missing";
  
  try {
    const response = await fetch(`${V2_API_BASE_URL}/v2/impulses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        impulse_id: 'test-impulse-no-auth',
        project_id: 'test-project',
        impulse_data: {
          id: 'test-impulse-no-auth',
          type: 'memo',
          pointer: { type: 'memo', content: 'No auth test' },
          budget: 1000
        }
      })
    });
    
    // Should return 401
    if (response.status !== 401) {
      return {
        pass: false,
        testCase,
        actual: { status: response.status },
        expected: { status: 401 },
        error: 'Expected 401 but got ' + response.status
      };
    }
    
    return {
      pass: true,
      testCase,
      actual: { status: response.status },
      expected: { status: 401, authRequired: true },
      details: 'Authentication correctly required for impulse endpoints'
    };
    
  } catch (error) {
    return {
      pass: false,
      testCase,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: { status: 401 },
      error: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ============================================================================
// Test Case 6: Duplicate Detection - 400 if impulse_id Already Exists
// ============================================================================

async function testDuplicateDetection(): Promise<ValidationResult> {
  const testCase = "Duplicate Detection - 400 if impulse_id already exists";
  
  try {
    const bearerToken = await createSession('project-impulse-duplicate');
    if (!bearerToken) {
      return {
        pass: false,
        testCase,
        actual: { error: 'Failed to create session' },
        expected: { session: 'valid Bearer token' },
        error: 'Cannot test without valid session'
      };
    }
    
    const impulseData = {
      impulse_id: 'test-impulse-duplicate-004',
      project_id: 'project-impulse-duplicate',
      impulse_data: {
        id: 'test-impulse-duplicate-004',
        type: 'memo',
        pointer: { type: 'memo', content: 'Duplicate test' },
        budget: 1000
      }
    };
    
    // Create impulse first time
    const createResponse1 = await fetch(`${V2_API_BASE_URL}/v2/impulses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(impulseData)
    });
    
    if (!createResponse1.ok) {
      throw new Error('Failed to create impulse first time');
    }
    
    // Try to create again with same impulse_id
    const createResponse2 = await fetch(`${V2_API_BASE_URL}/v2/impulses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(impulseData)
    });
    
    // Should return 400
    if (createResponse2.status !== 400) {
      return {
        pass: false,
        testCase,
        actual: { status: createResponse2.status },
        expected: { status: 400 },
        error: 'Expected 400 but got ' + createResponse2.status
      };
    }
    
    const errorData = await createResponse2.json() as any;
    
    return {
      pass: true,
      testCase,
      actual: {
        status: createResponse2.status,
        error: errorData.error
      },
      expected: {
        status: 400,
        duplicateDetection: true
      },
      details: 'Duplicate impulse_id correctly rejected with 400 error'
    };
    
  } catch (error) {
    return {
      pass: false,
      testCase,
      actual: { error: error instanceof Error ? error.message : String(error) },
      expected: { status: 400 },
      error: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ============================================================================
// Main Harness Runner
// ============================================================================

export async function runValidation(): Promise<HarnessResult> {
  const results: ValidationResult[] = [];
  
  console.log('\n=== v2 API Impulse Endpoints Validation Harness ===\n');
  
  // Test 1: Create Impulse
  console.log('Running Test 1: Create Impulse...');
  const createResult = await testCreateImpulse();
  results.push(createResult);
  console.log(`  ${createResult.pass ? '✓ PASS' : '✗ FAIL'}: ${createResult.testCase}`);
  if (createResult.error) console.log(`    Error: ${createResult.error}`);
  if (createResult.details) console.log(`    ${createResult.details}`);
  
  // Test 2: Retrieve Impulse
  console.log('Running Test 2: Retrieve Impulse...');
  const retrieveResult = await testRetrieveImpulse();
  results.push(retrieveResult);
  console.log(`  ${retrieveResult.pass ? '✓ PASS' : '✗ FAIL'}: ${retrieveResult.testCase}`);
  if (retrieveResult.error) console.log(`    Error: ${retrieveResult.error}`);
  if (retrieveResult.details) console.log(`    ${retrieveResult.details}`);
  
  // Test 3: List Impulses with Pagination
  console.log('Running Test 3: List Impulses with Pagination...');
  const listResult = await testListImpulses();
  results.push(listResult);
  console.log(`  ${listResult.pass ? '✓ PASS' : '✗ FAIL'}: ${listResult.testCase}`);
  if (listResult.error) console.log(`    Error: ${listResult.error}`);
  if (listResult.details) console.log(`    ${listResult.details}`);
  
  // Test 4: Multi-Tenant Isolation
  console.log('Running Test 4: Multi-Tenant Isolation...');
  const isolationResult = await testMultiTenantIsolation();
  results.push(isolationResult);
  console.log(`  ${isolationResult.pass ? '✓ PASS' : '✗ FAIL'}: ${isolationResult.testCase}`);
  if (isolationResult.error) console.log(`    Error: ${isolationResult.error}`);
  if (isolationResult.details) console.log(`    ${isolationResult.details}`);
  
  // Test 5: Authentication Required
  console.log('Running Test 5: Authentication Required...');
  const authResult = await testAuthenticationRequired();
  results.push(authResult);
  console.log(`  ${authResult.pass ? '✓ PASS' : '✗ FAIL'}: ${authResult.testCase}`);
  if (authResult.error) console.log(`    Error: ${authResult.error}`);
  if (authResult.details) console.log(`    ${authResult.details}`);
  
  // Test 6: Duplicate Detection
  console.log('Running Test 6: Duplicate Detection...');
  const duplicateResult = await testDuplicateDetection();
  results.push(duplicateResult);
  console.log(`  ${duplicateResult.pass ? '✓ PASS' : '✗ FAIL'}: ${duplicateResult.testCase}`);
  if (duplicateResult.error) console.log(`    Error: ${duplicateResult.error}`);
  if (duplicateResult.details) console.log(`    ${duplicateResult.details}`);
  
  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  
  console.log('\n=== Summary ===');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);
  
  return {
    totalTests: results.length,
    passed,
    failed,
    results,
    summary: `${passed}/${results.length} tests passed`
  };
}

// CLI execution
if (require.main === module) {
  runValidation()
    .then(result => {
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Harness execution failed:', error);
      process.exit(1);
    });
}
