#!/usr/bin/env ts-node
/**
 * Validation Harness: activity-template-scope-assignment
 * 
 * SPECIFICATION:
 * When a user registers an activity template via POST /v2/activities/templates with scope and org_id 
 * fields in the JSON payload, the RPC API backend MUST extract these fields and persist them to SurrealDB.
 * 
 * REQUIREMENTS:
 * 1. Extract scope field from request body (default to 'org' if not provided)
 * 2. Extract org_id from the authenticated user's Bearer token context
 * 3. Store both fields in the activity_templates table in SurrealDB
 * 
 * VALIDATION STRATEGY:
 * 1. Register template with explicit scope='org' via POST /v2/activities/templates
 * 2. Query template by ID via GET /v2/activities/templates/{id}
 * 3. Verify response includes scope='org' and org_id='3135883c-8be3-4b2b-bdd8-dbe2e427358f'
 * 4. Test default scope behavior (no scope in request → should default to 'org')
 * 5. Test org_id extraction from Bearer token
 */

import { execSync } from 'child_process';

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  input: {
    templateName: string;
    scope?: string;
    includeScope: boolean;
  };
  expectedOutput: {
    scope: string;
    org_id: string;
  };
}

interface HarnessResult {
  overallPass: boolean;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

// Configuration
const RPC_API_URL = process.env.RPC_API_URL || 'http://metabob-rpc-api:8080';
const BEARER_TOKEN = process.env.BEARER_TOKEN || 'c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw';
const EXPECTED_ORG_ID = '3135883c-8be3-4b2b-bdd8-dbe2e427358f';
const IS_K8S_ENV = process.env.K8S_ENV === 'true' || false;

// Test template definition
const TEST_TEMPLATE_BASE = {
  name: '',
  description: 'Test template for scope assignment validation',
  category: 'feature',
  tasks: [
    {
      id: 'task-1',
      subagent: 'general',
      description: 'Test task',
      dependencies: [],
      prompt: {
        template: 'Test prompt',
        max_tokens: 1000,
        compression_strategy: 'filter',
        variables: []
      },
      validation: {
        required_files: [],
        required_patterns: [],
        forbidden_patterns: [],
        commands: []
      },
      retry: {
        max_attempts: 1,
        strategy: 'simple'
      }
    }
  ],
  variables: {},
  context_requirements: []
};

/**
 * Execute curl command in K8s or local environment
 */
function executeCurl(method: string, endpoint: string, data?: any): any {
  const curlCmd = data
    ? `curl -s -X ${method} ${RPC_API_URL}${endpoint} -H 'Authorization: Bearer ${BEARER_TOKEN}' -H 'Content-Type: application/json' -d '${JSON.stringify(data).replace(/'/g, "'\\''")}'`
    : `curl -s -X ${method} ${RPC_API_URL}${endpoint} -H 'Authorization: Bearer ${BEARER_TOKEN}'`;

  let command: string;
  if (IS_K8S_ENV) {
    command = `kubectl exec devbob-0 -n metabob -c devbob -- bash -c "${curlCmd}"`;
  } else {
    command = curlCmd;
  }

  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(output);
  } catch (error: any) {
    console.error('Curl execution failed:', error.message);
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.toString());
      } catch {
        console.error('Response:', error.stdout.toString());
      }
    }
    throw error;
  }
}

/**
 * Test Case 1: Register template with explicit scope='org'
 */
async function testExplicitScopeAssignment(): Promise<ValidationResult> {
  const testCase = 'explicit-scope-org';
  const templateName = `test-scope-explicit-${Date.now()}`;
  
  try {
    // Create template with explicit scope='org'
    const templateData = {
      ...TEST_TEMPLATE_BASE,
      name: templateName,
      scope: 'org'
    };

    console.log(`  Creating template with explicit scope='org'...`);
    const createResponse = await executeCurl('POST', '/v2/activities/templates', templateData);
    
    if (!createResponse || !createResponse.variant_id) {
      return {
        pass: false,
        testCase,
        actual: createResponse,
        expected: { variant_id: 'string', scope: 'org', org_id: EXPECTED_ORG_ID },
        error: 'Failed to create template'
      };
    }

    const variantId = createResponse.variant_id;
    console.log(`  Template created: ${variantId}`);

    // Query template by ID
    console.log(`  Fetching template to verify scope and org_id...`);
    const getResponse = await executeCurl('GET', `/v2/activities/templates/${variantId}`);

    const actual = {
      scope: getResponse.scope,
      org_id: getResponse.org_id,
      has_scope: getResponse.hasOwnProperty('scope'),
      has_org_id: getResponse.hasOwnProperty('org_id')
    };

    const expected = {
      scope: 'org',
      org_id: EXPECTED_ORG_ID,
      has_scope: true,
      has_org_id: true
    };

    const pass = actual.scope === expected.scope && 
                 actual.org_id === expected.org_id &&
                 actual.has_scope && actual.has_org_id;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'Template correctly stored with scope=org and org_id from token' 
        : 'Template missing scope or org_id fields'
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { scope: 'org', org_id: EXPECTED_ORG_ID },
      error: error.message
    };
  }
}

/**
 * Test Case 2: Register template without scope (should default to 'org')
 */
async function testDefaultScopeAssignment(): Promise<ValidationResult> {
  const testCase = 'default-scope-org';
  const templateName = `test-scope-default-${Date.now()}`;
  
  try {
    // Create template WITHOUT scope field (should default to 'org')
    const templateData = {
      ...TEST_TEMPLATE_BASE,
      name: templateName
      // Note: No scope field
    };

    console.log(`  Creating template without scope field (should default to 'org')...`);
    const createResponse = await executeCurl('POST', '/v2/activities/templates', templateData);
    
    if (!createResponse || !createResponse.variant_id) {
      return {
        pass: false,
        testCase,
        actual: createResponse,
        expected: { scope: 'org', org_id: EXPECTED_ORG_ID },
        error: 'Failed to create template'
      };
    }

    const variantId = createResponse.variant_id;
    console.log(`  Template created: ${variantId}`);

    // Query template by ID
    console.log(`  Fetching template to verify default scope...`);
    const getResponse = await executeCurl('GET', `/v2/activities/templates/${variantId}`);

    const actual = {
      scope: getResponse.scope,
      org_id: getResponse.org_id
    };

    const expected = {
      scope: 'org',
      org_id: EXPECTED_ORG_ID
    };

    const pass = actual.scope === expected.scope && actual.org_id === expected.org_id;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'Template correctly defaulted to scope=org when not provided' 
        : 'Default scope assignment failed'
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { scope: 'org', org_id: EXPECTED_ORG_ID },
      error: error.message
    };
  }
}

/**
 * Test Case 3: Verify org_id is extracted from Bearer token
 */
async function testOrgIdExtraction(): Promise<ValidationResult> {
  const testCase = 'org-id-from-token';
  const templateName = `test-org-id-${Date.now()}`;
  
  try {
    // Create template
    const templateData = {
      ...TEST_TEMPLATE_BASE,
      name: templateName,
      scope: 'org'
    };

    console.log(`  Creating template to verify org_id extraction...`);
    const createResponse = await executeCurl('POST', '/v2/activities/templates', templateData);
    
    if (!createResponse || !createResponse.variant_id) {
      return {
        pass: false,
        testCase,
        actual: createResponse,
        expected: { org_id: EXPECTED_ORG_ID },
        error: 'Failed to create template'
      };
    }

    const variantId = createResponse.variant_id;
    const getResponse = await executeCurl('GET', `/v2/activities/templates/${variantId}`);

    const actual = {
      org_id: getResponse.org_id,
      is_null: getResponse.org_id === null,
      is_undefined: getResponse.org_id === undefined,
      has_org_id: getResponse.hasOwnProperty('org_id')
    };

    const expected = {
      org_id: EXPECTED_ORG_ID,
      is_null: false,
      is_undefined: false,
      has_org_id: true
    };

    const pass = actual.org_id === expected.org_id && 
                 !actual.is_null && 
                 !actual.is_undefined &&
                 actual.has_org_id;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'org_id correctly extracted from Bearer token' 
        : 'org_id not extracted or is null/undefined'
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { org_id: EXPECTED_ORG_ID },
      error: error.message
    };
  }
}

/**
 * Test Case 4: Verify scope field persists across template variants
 */
async function testScopePersistenceInVariants(): Promise<ValidationResult> {
  const testCase = 'scope-persistence-variants';
  const templateName = `test-scope-variant-${Date.now()}`;
  
  try {
    // Create first variant
    const templateData1 = {
      ...TEST_TEMPLATE_BASE,
      name: templateName,
      scope: 'org',
      description: 'First variant'
    };

    console.log(`  Creating first variant with scope='org'...`);
    const createResponse1 = await executeCurl('POST', '/v2/activities/templates', templateData1);
    const variantId1 = createResponse1.variant_id;

    // Create second variant (different description, same name)
    const templateData2 = {
      ...TEST_TEMPLATE_BASE,
      name: templateName,
      scope: 'org',
      description: 'Second variant - different content'
    };

    console.log(`  Creating second variant with scope='org'...`);
    const createResponse2 = await executeCurl('POST', '/v2/activities/templates', templateData2);
    const variantId2 = createResponse2.variant_id;

    // Verify both variants have scope
    const getResponse1 = await executeCurl('GET', `/v2/activities/templates/${variantId1}`);
    const getResponse2 = await executeCurl('GET', `/v2/activities/templates/${variantId2}`);

    const actual = {
      variant1_scope: getResponse1.scope,
      variant2_scope: getResponse2.scope,
      both_have_scope: getResponse1.scope === 'org' && getResponse2.scope === 'org'
    };

    const expected = {
      variant1_scope: 'org',
      variant2_scope: 'org',
      both_have_scope: true
    };

    const pass = actual.both_have_scope;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? 'Scope correctly persists across template variants' 
        : 'Scope not persisting in variants'
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { both_have_scope: true },
      error: error.message
    };
  }
}

/**
 * Main validation runner
 */
export async function runValidation(): Promise<HarnessResult> {
  console.log('\n=== Activity Template Scope Assignment Validation ===\n');

  const results: ValidationResult[] = [];

  // Test 1: Explicit scope assignment
  console.log('Test 1: Explicit scope assignment (scope="org")');
  results.push(await testExplicitScopeAssignment());
  console.log(`  Result: ${results[0].pass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 2: Default scope assignment
  console.log('Test 2: Default scope assignment (no scope field)');
  results.push(await testDefaultScopeAssignment());
  console.log(`  Result: ${results[1].pass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 3: org_id extraction
  console.log('Test 3: org_id extraction from Bearer token');
  results.push(await testOrgIdExtraction());
  console.log(`  Result: ${results[2].pass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test 4: Scope persistence in variants
  console.log('Test 4: Scope persistence across variants');
  results.push(await testScopePersistenceInVariants());
  console.log(`  Result: ${results[3].pass ? '✅ PASS' : '❌ FAIL'}\n`);

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const overallPass = failed === 0;

  const harnessResult: HarnessResult = {
    overallPass,
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  };

  // Print summary
  console.log('\n=== Validation Summary ===');
  console.log(`Total Tests: ${harnessResult.summary.total}`);
  console.log(`Passed: ${harnessResult.summary.passed}`);
  console.log(`Failed: ${harnessResult.summary.failed}`);
  console.log(`Overall: ${overallPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Print detailed results for failures
  if (failed > 0) {
    console.log('\n=== Failed Tests Details ===');
    results.filter(r => !r.pass).forEach(result => {
      console.log(`\nTest: ${result.testCase}`);
      console.log(`Expected:`, JSON.stringify(result.expected, null, 2));
      console.log(`Actual:`, JSON.stringify(result.actual, null, 2));
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
    });
  }

  return harnessResult;
}

// CLI execution
if (require.main === module) {
  runValidation()
    .then(result => {
      process.exit(result.overallPass ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation harness failed:', error);
      process.exit(1);
    });
}
