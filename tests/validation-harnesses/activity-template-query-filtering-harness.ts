#!/usr/bin/env ts-node
/**
 * Validation Harness: activity-template-query-filtering
 * 
 * SPECIFICATION:
 * When a user queries activity templates via GET /v2/activities/templates, the RPC API backend 
 * MUST filter results based on the user's organization context and template scope. The filtering 
 * logic should:
 * 1. ALWAYS return templates with scope='global' or scope=null (global templates visible to all)
 * 2. Return templates with scope='org' ONLY if template.org_id matches the authenticated user's org_id
 * 3. Return templates with scope='project' ONLY if template.project_id matches user's project context
 * 
 * EXPECTED BEHAVIOR:
 * - User 1 (Org A) registers an org-scoped template
 * - User 2 (Org B) queries GET /v2/activities/templates → should NOT see User 1's org template
 * - User 1 queries GET /v2/activities/templates → should see their own org template + global templates
 * 
 * VALIDATION STRATEGY:
 * 1. Use existing test accounts: User 1 (devbob-test@local.dev, org=3135883c-8be3-4b2b-bdd8-dbe2e427358f) 
 *    and User 2 (devbob-test2@local.dev, org=e6b7c99d-1a5b-444b-9437-5c53793933a1)
 * 2. Register org-scoped template as User 1
 * 3. Query templates as User 2 - verify User 1's org template NOT in results
 * 4. Query templates as User 1 - verify User 1's org template IS in results
 * 5. Query without authentication - verify only global templates returned
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
    userId: 1 | 2 | null; // null = unauthenticated
    action: 'register' | 'query';
  };
  expectedOutput: {
    shouldSeeOrgTemplate: boolean;
    shouldSeeGlobalTemplates: boolean;
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
const IS_K8S_ENV = process.env.K8S_ENV === 'true' || false;

// User 1: devbob-test@local.dev (Org A)
const USER1_TOKEN = process.env.USER1_TOKEN || 'c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw';
const USER1_ORG_ID = '3135883c-8be3-4b2b-bdd8-dbe2e427358f';

// User 2: devbob-test2@local.dev (Org B) - will be created/fetched dynamically
let USER2_TOKEN: string | null = null;
let USER2_ORG_ID: string | null = null;

// Test template data
let ORG_SCOPED_TEMPLATE_ID: string | null = null;
const ORG_TEMPLATE_NAME = `org-isolation-test-${Date.now()}`;

const TEST_TEMPLATE_BASE = {
  name: '',
  description: 'Test template for multi-tenant isolation validation',
  category: 'feature',
  tasks: [
    {
      id: 'task-1',
      subagent: 'general',
      description: 'Test task for isolation',
      dependencies: [],
      prompt: {
        template: 'This is a test template for org isolation',
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
  integration: {
    preChecks: [],
    postChecks: [],
    qualityGates: []
  }
};

/**
 * Execute curl command in K8s or local environment
 */
function executeCurl(method: string, endpoint: string, token: string | null, data?: any): any {
  const authHeader = token ? `-H 'Authorization: Bearer ${token}'` : '';
  const curlCmd = data
    ? `curl -s -X ${method} ${RPC_API_URL}${endpoint} ${authHeader} -H 'Content-Type: application/json' -d '${JSON.stringify(data).replace(/'/g, "'\\''")}'`
    : `curl -s -X ${method} ${RPC_API_URL}${endpoint} ${authHeader}`;

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
 * Setup: Register or retrieve User 2 (different org)
 */
async function setupUser2(): Promise<void> {
  console.log('  Setting up User 2 (Org B)...');
  
  try {
    const registerData = {
      name: 'DevBob Test User 2',
      email: 'devbob-test2@local.dev',
      password: 'test-password-456',
      organization_name: 'DevBob K8s Test Org 2'
    };

    const response = await executeCurl('POST', '/auth/register', null, registerData);
    
    if (response && response.token && response.org) {
      USER2_TOKEN = response.token;
      USER2_ORG_ID = response.org.org_id;
      console.log(`  ✅ User 2 created/retrieved: Org ID = ${USER2_ORG_ID}`);
    } else {
      throw new Error('Failed to get User 2 credentials');
    }
  } catch (error: any) {
    console.error('  ⚠️  User 2 setup failed (may already exist):', error.message);
    // If user already exists, we'll try to continue with cached credentials
    // In production, implement proper login flow
  }
}

/**
 * Test Case 1: Register org-scoped template as User 1
 */
async function testRegisterOrgScopedTemplate(): Promise<ValidationResult> {
  const testCase = 'register-org-scoped-template';
  
  try {
    console.log(`  Registering org-scoped template as User 1...`);
    
    const templateData = {
      ...TEST_TEMPLATE_BASE,
      name: ORG_TEMPLATE_NAME,
      scope: 'org'
    };

    const createResponse = await executeCurl('POST', '/v2/activities/templates', USER1_TOKEN, templateData);
    
    if (!createResponse || !createResponse.variant_id) {
      return {
        pass: false,
        testCase,
        actual: createResponse,
        expected: { variant_id: 'string', scope: 'org', org_id: USER1_ORG_ID },
        error: 'Failed to create org-scoped template'
      };
    }

    ORG_SCOPED_TEMPLATE_ID = createResponse.variant_id;
    console.log(`  Template created: ${ORG_SCOPED_TEMPLATE_ID}`);

    const actual = {
      created: true,
      variant_id: createResponse.variant_id,
      scope: createResponse.scope,
      org_id: createResponse.org_id
    };

    const expected = {
      created: true,
      variant_id: 'string',
      scope: 'org',
      org_id: USER1_ORG_ID
    };

    const pass = actual.scope === 'org' && actual.org_id === USER1_ORG_ID;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? `Org-scoped template created successfully for User 1's org` 
        : `Template not properly scoped to User 1's org`
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { scope: 'org', org_id: USER1_ORG_ID },
      error: error.message
    };
  }
}

/**
 * Test Case 2: User 2 queries templates - should NOT see User 1's org template
 */
async function testUser2CannotSeeUser1OrgTemplate(): Promise<ValidationResult> {
  const testCase = 'user2-isolation-check';
  
  if (!USER2_TOKEN) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { shouldSeeOrgTemplate: false },
      error: 'User 2 token not available'
    };
  }

  try {
    console.log(`  Querying templates as User 2 (should NOT see User 1's org template)...`);
    
    const response = await executeCurl('GET', '/v2/activities/templates?limit=100', USER2_TOKEN);
    
    if (!response || !Array.isArray(response.templates)) {
      return {
        pass: false,
        testCase,
        actual: response,
        expected: { templates: 'array', user1OrgTemplateVisible: false },
        error: 'Invalid response format'
      };
    }

    const templates = response.templates;
    const user1OrgTemplate = templates.find((t: any) => 
      t.variant_id === ORG_SCOPED_TEMPLATE_ID || t.name === ORG_TEMPLATE_NAME
    );

    const actual = {
      totalTemplates: templates.length,
      user1OrgTemplateVisible: !!user1OrgTemplate,
      user1TemplateDetails: user1OrgTemplate || null
    };

    const expected = {
      user1OrgTemplateVisible: false,
      reason: 'User 2 should not see User 1\'s org-scoped template'
    };

    const pass = !user1OrgTemplate;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? `✅ User 2 correctly isolated - cannot see User 1's org template` 
        : `❌ SECURITY ISSUE: User 2 can see User 1's org template!`
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { user1OrgTemplateVisible: false },
      error: error.message
    };
  }
}

/**
 * Test Case 3: User 1 queries templates - should see their own org template
 */
async function testUser1CanSeeOwnOrgTemplate(): Promise<ValidationResult> {
  const testCase = 'user1-own-template-visibility';
  
  try {
    console.log(`  Querying templates as User 1 (should see their own org template)...`);
    
    const response = await executeCurl('GET', '/v2/activities/templates?limit=100', USER1_TOKEN);
    
    if (!response || !Array.isArray(response.templates)) {
      return {
        pass: false,
        testCase,
        actual: response,
        expected: { templates: 'array', ownOrgTemplateVisible: true },
        error: 'Invalid response format'
      };
    }

    const templates = response.templates;
    const ownOrgTemplate = templates.find((t: any) => 
      t.variant_id === ORG_SCOPED_TEMPLATE_ID || t.name === ORG_TEMPLATE_NAME
    );

    const actual = {
      totalTemplates: templates.length,
      ownOrgTemplateVisible: !!ownOrgTemplate,
      ownTemplateDetails: ownOrgTemplate ? {
        variant_id: ownOrgTemplate.variant_id,
        name: ownOrgTemplate.name,
        scope: ownOrgTemplate.scope,
        org_id: ownOrgTemplate.org_id
      } : null
    };

    const expected = {
      ownOrgTemplateVisible: true,
      scope: 'org',
      org_id: USER1_ORG_ID
    };

    const pass = !!ownOrgTemplate && 
                 ownOrgTemplate.scope === 'org' && 
                 ownOrgTemplate.org_id === USER1_ORG_ID;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? `✅ User 1 can correctly see their own org template` 
        : `❌ User 1 cannot see their own org template (filtering too strict)`
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { ownOrgTemplateVisible: true },
      error: error.message
    };
  }
}

/**
 * Test Case 4: Unauthenticated query - should only see global templates
 */
async function testUnauthenticatedOnlySeesGlobal(): Promise<ValidationResult> {
  const testCase = 'unauthenticated-global-only';
  
  try {
    console.log(`  Querying templates without authentication (should only see global)...`);
    
    const response = await executeCurl('GET', '/v2/activities/templates?limit=100', null);
    
    if (!response || !Array.isArray(response.templates)) {
      return {
        pass: false,
        testCase,
        actual: response,
        expected: { templates: 'array', onlyGlobalTemplates: true },
        error: 'Invalid response format'
      };
    }

    const templates = response.templates;
    const orgScopedTemplates = templates.filter((t: any) => t.scope === 'org');
    const projectScopedTemplates = templates.filter((t: any) => t.scope === 'project');
    const globalTemplates = templates.filter((t: any) => !t.scope || t.scope === 'global');

    const actual = {
      totalTemplates: templates.length,
      orgScopedCount: orgScopedTemplates.length,
      projectScopedCount: projectScopedTemplates.length,
      globalCount: globalTemplates.length,
      hasOrgScoped: orgScopedTemplates.length > 0,
      hasProjectScoped: projectScopedTemplates.length > 0
    };

    const expected = {
      orgScopedCount: 0,
      projectScopedCount: 0,
      onlyGlobalTemplates: true
    };

    const pass = orgScopedTemplates.length === 0 && projectScopedTemplates.length === 0;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? `✅ Unauthenticated access correctly restricted to global templates only` 
        : `❌ SECURITY ISSUE: Unauthenticated users can see scoped templates!`
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { onlyGlobalTemplates: true },
      error: error.message
    };
  }
}

/**
 * Test Case 5: Global templates visible to all users
 */
async function testGlobalTemplatesVisibleToAll(): Promise<ValidationResult> {
  const testCase = 'global-templates-visible-to-all';
  
  try {
    console.log(`  Verifying global templates are visible to all users...`);
    
    // Query as User 1
    const response1 = await executeCurl('GET', '/v2/activities/templates?limit=100', USER1_TOKEN);
    const globalTemplates1 = response1.templates.filter((t: any) => !t.scope || t.scope === 'global');
    
    // Query as User 2
    const response2 = await executeCurl('GET', '/v2/activities/templates?limit=100', USER2_TOKEN);
    const globalTemplates2 = response2.templates.filter((t: any) => !t.scope || t.scope === 'global');
    
    // Query unauthenticated
    const response3 = await executeCurl('GET', '/v2/activities/templates?limit=100', null);
    const globalTemplates3 = response3.templates.filter((t: any) => !t.scope || t.scope === 'global');

    const actual = {
      user1GlobalCount: globalTemplates1.length,
      user2GlobalCount: globalTemplates2.length,
      unauthGlobalCount: globalTemplates3.length,
      allSameCount: globalTemplates1.length === globalTemplates2.length && 
                    globalTemplates2.length === globalTemplates3.length
    };

    const expected = {
      allSameCount: true,
      reason: 'Global templates should be visible to all users equally'
    };

    const pass = actual.allSameCount;

    return {
      pass,
      testCase,
      actual,
      expected,
      details: pass 
        ? `✅ Global templates correctly visible to all users` 
        : `❌ Global template visibility inconsistent across users`
    };

  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: { allSameCount: true },
      error: error.message
    };
  }
}

/**
 * Main validation harness
 */
async function runValidation(): Promise<HarnessResult> {
  console.log('=====================================');
  console.log('Activity Template Query Filtering');
  console.log('Multi-Tenant Isolation Validation');
  console.log('=====================================\n');

  const results: ValidationResult[] = [];

  try {
    // Setup User 2
    await setupUser2();
    console.log('');

    // Test Case 1: Register org-scoped template
    console.log('[Test 1/5] Register Org-Scoped Template');
    const result1 = await testRegisterOrgScopedTemplate();
    results.push(result1);
    console.log(`Result: ${result1.pass ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test Case 2: User 2 isolation
    console.log('[Test 2/5] User 2 Isolation Check');
    const result2 = await testUser2CannotSeeUser1OrgTemplate();
    results.push(result2);
    console.log(`Result: ${result2.pass ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test Case 3: User 1 can see own template
    console.log('[Test 3/5] User 1 Own Template Visibility');
    const result3 = await testUser1CanSeeOwnOrgTemplate();
    results.push(result3);
    console.log(`Result: ${result3.pass ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test Case 4: Unauthenticated access
    console.log('[Test 4/5] Unauthenticated Access Restriction');
    const result4 = await testUnauthenticatedOnlySeesGlobal();
    results.push(result4);
    console.log(`Result: ${result4.pass ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test Case 5: Global templates visibility
    console.log('[Test 5/5] Global Templates Visibility');
    const result5 = await testGlobalTemplatesVisibleToAll();
    results.push(result5);
    console.log(`Result: ${result5.pass ? '✅ PASS' : '❌ FAIL'}\n`);

  } catch (error: any) {
    console.error('Validation harness failed:', error.message);
    results.push({
      pass: false,
      testCase: 'harness-execution',
      actual: null,
      expected: null,
      error: error.message
    });
  }

  const summary = {
    total: results.length,
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length
  };

  const overallPass = summary.failed === 0;

  console.log('=====================================');
  console.log('Summary');
  console.log('=====================================');
  console.log(`Total Tests: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Status: ${overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('=====================================\n');

  // Print detailed results for failed tests
  if (!overallPass) {
    console.log('Failed Test Details:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`\n❌ ${r.testCase}`);
      console.log(`   Error: ${r.error || 'Assertion failed'}`);
      console.log(`   Details: ${r.details || 'N/A'}`);
      console.log(`   Expected:`, JSON.stringify(r.expected, null, 2));
      console.log(`   Actual:`, JSON.stringify(r.actual, null, 2));
    });
  }

  return {
    overallPass,
    results,
    summary
  };
}

// Run validation if executed directly
if (require.main === module) {
  runValidation()
    .then(result => {
      process.exit(result.overallPass ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runValidation, ValidationResult, HarnessResult };
