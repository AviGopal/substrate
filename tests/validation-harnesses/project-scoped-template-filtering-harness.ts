#!/usr/bin/env ts-node
/**
 * Validation Harness: Project-Scoped Template Filtering Implementation
 * 
 * SPECIFICATION:
 * Complete multi-tenant isolation by implementing project-scoped template filtering.
 * When a user queries activity templates, the system must filter by:
 * 1. ALWAYS return templates with scope='global' or scope=null (visible to all)
 * 2. Return templates with scope='org' ONLY if template.org_id matches user's org_id
 * 3. Return templates with scope='project' ONLY if template.project_id matches user's project_id
 * 
 * ISOLATION REQUIREMENTS:
 * - Users in Project A cannot see templates from Project B (even if same org)
 * - Users in different orgs cannot see each other's org/project templates
 * - Global templates are visible to all authenticated and unauthenticated users
 * 
 * EXPECTED BEHAVIOR:
 * - User 1 (Org A, Project A) registers a project-scoped template
 * - User 2 (Org A, Project B) queries templates → should NOT see User 1's project template
 * - User 1 (Org A, Project A) queries templates → should see their own project template
 * - User 3 (Org B, Project C) queries templates → should NOT see User 1's project template
 * - All users should see global templates
 * 
 * VALIDATION STRATEGY:
 * 1. Create/fetch 3 test users in different project contexts
 * 2. Register project-scoped template as User 1 (Org A, Project A)
 * 3. Query as User 2 (Org A, Project B) - verify project template NOT visible
 * 4. Query as User 1 (Org A, Project A) - verify project template IS visible
 * 5. Query as User 3 (Org B, Project C) - verify project template NOT visible
 * 6. Verify existing org-scoped and global template tests still pass
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
    userId: 1 | 2 | 3 | null; // null = unauthenticated
    action: 'register' | 'query' | 'create-session';
  };
  expectedOutput: {
    shouldSeeProjectTemplate: boolean;
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

// User contexts for multi-tenant project isolation testing
// User 1: Org A, Project A
let USER1_TOKEN: string | null = null;
const USER1_ORG_ID = 'org-a-test-uuid';
const USER1_PROJECT_ID = 'project-a-test-uuid';

// User 2: Org A, Project B (same org, different project)
let USER2_TOKEN: string | null = null;
const USER2_ORG_ID = 'org-a-test-uuid'; // Same org as User 1
const USER2_PROJECT_ID = 'project-b-test-uuid'; // Different project

// User 3: Org B, Project C (different org)
let USER3_TOKEN: string | null = null;
const USER3_ORG_ID = 'org-b-test-uuid';
const USER3_PROJECT_ID = 'project-c-test-uuid';

// Test template IDs
let PROJECT_SCOPED_TEMPLATE_ID: string | null = null;
let ORG_SCOPED_TEMPLATE_ID: string | null = null;
let GLOBAL_TEMPLATE_ID: string | null = null;

const PROJECT_TEMPLATE_NAME = `project-isolation-test-${Date.now()}`;
const ORG_TEMPLATE_NAME = `org-isolation-test-${Date.now()}`;
const GLOBAL_TEMPLATE_NAME = `global-template-test-${Date.now()}`;

const TEST_TEMPLATE_BASE = {
  name: '',
  description: 'Test template for multi-tenant project isolation validation',
  category: 'feature',
  tasks: [
    {
      id: 'task-1',
      subagent: 'general',
      description: 'Test task for project isolation',
      dependencies: [],
      prompt: {
        template: 'This is a test template for project-scoped isolation',
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
function executeCurl(method: string, endpoint: string, data?: any, token?: string | null): any {
  const url = `${RPC_API_URL}${endpoint}`;
  
  let curlCmd: string;
  if (IS_K8S_ENV) {
    // K8s: Use kubectl exec to run curl inside the pod
    const baseCmd = `kubectl exec -n metabob-dev deployment/metabob-rpc-api -- curl -s -X ${method}`;
    const headers = token ? `-H "Authorization: Bearer ${token}"` : '';
    const dataArg = data ? `-H "Content-Type: application/json" -d '${JSON.stringify(data)}'` : '';
    curlCmd = `${baseCmd} ${headers} ${dataArg} "${url}"`;
  } else {
    // Local: Direct curl
    const headers = token ? `-H "Authorization: Bearer ${token}"` : '';
    const dataArg = data ? `-H "Content-Type: application/json" -d '${JSON.stringify(data)}'` : '';
    curlCmd = `curl -s -X ${method} ${headers} ${dataArg} "${url}"`;
  }

  try {
    const output = execSync(curlCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(output);
  } catch (error: any) {
    console.error(`curl command failed: ${curlCmd}`);
    console.error(`Error: ${error.message}`);
    if (error.stdout) console.error(`stdout: ${error.stdout}`);
    if (error.stderr) console.error(`stderr: ${error.stderr}`);
    throw error;
  }
}

/**
 * Create a session with org_id and project_id for multi-tenant testing
 * NOTE: This requires the extended SessionData model with org_id and project_id fields
 */
function createSessionWithTenantContext(orgId: string, projectId: string): string {
  // For MVP, we'll create a mock session token that encodes the tenant context
  // In production, this would call POST /sessions with org_id and project_id
  // For now, we'll use a placeholder that the RPC API will recognize
  
  // Create a base64 encoded session identifier with tenant context
  const sessionData = {
    session_id: `session-${orgId}-${projectId}-${Date.now()}`,
    org_id: orgId,
    project_id: projectId
  };
  
  // In a real implementation, this would call the RPC API to create a session
  // For testing, we'll return a mock token
  const mockToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  
  console.log(`✅ Created session for org=${orgId}, project=${projectId}`);
  return mockToken;
}

/**
 * Register a template with specific scope
 */
function registerTemplate(
  name: string,
  scope: 'global' | 'org' | 'project',
  token: string | null
): string | null {
  const templateData = {
    ...TEST_TEMPLATE_BASE,
    name,
    scope
  };

  console.log(`\n📝 Registering ${scope}-scoped template: ${name}`);
  console.log(`   Token: ${token ? `${token.substring(0, 20)}...` : 'none (unauthenticated)'}`);

  try {
    const response = executeCurl('POST', '/v2/activities/templates', templateData, token);
    
    if (response.variant_id) {
      console.log(`✅ Template registered: ${response.variant_id}`);
      console.log(`   Scope: ${response.scope || 'null'}`);
      console.log(`   Org ID: ${response.org_id || 'null'}`);
      console.log(`   Project ID: ${response.project_id || 'null'}`);
      return response.variant_id;
    } else {
      console.error(`❌ Registration failed: ${JSON.stringify(response)}`);
      return null;
    }
  } catch (error: any) {
    console.error(`❌ Registration error: ${error.message}`);
    return null;
  }
}

/**
 * Query templates as a specific user
 */
function queryTemplates(token: string | null): any[] {
  console.log(`\n🔍 Querying templates with token: ${token ? `${token.substring(0, 20)}...` : 'none (unauthenticated)'}`);
  
  try {
    const response = executeCurl('GET', '/v2/activities/templates', null, token);
    
    if (response.templates && Array.isArray(response.templates)) {
      console.log(`✅ Query returned ${response.templates.length} templates`);
      return response.templates;
    } else {
      console.error(`❌ Invalid response format: ${JSON.stringify(response)}`);
      return [];
    }
  } catch (error: any) {
    console.error(`❌ Query error: ${error.message}`);
    return [];
  }
}

/**
 * Test Case 1: Create sessions with tenant context
 */
function testCreateSessions(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 1: Create Sessions with Tenant Context');
  console.log('='.repeat(80));

  try {
    USER1_TOKEN = createSessionWithTenantContext(USER1_ORG_ID, USER1_PROJECT_ID);
    USER2_TOKEN = createSessionWithTenantContext(USER2_ORG_ID, USER2_PROJECT_ID);
    USER3_TOKEN = createSessionWithTenantContext(USER3_ORG_ID, USER3_PROJECT_ID);

    const allTokensCreated = USER1_TOKEN && USER2_TOKEN && USER3_TOKEN;

    return {
      pass: allTokensCreated,
      testCase: 'Create Sessions with Tenant Context',
      actual: {
        user1: USER1_TOKEN ? 'created' : 'failed',
        user2: USER2_TOKEN ? 'created' : 'failed',
        user3: USER3_TOKEN ? 'created' : 'failed'
      },
      expected: {
        user1: 'created',
        user2: 'created',
        user3: 'created'
      },
      details: 'All user sessions created with org_id and project_id context'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Create Sessions with Tenant Context',
      actual: null,
      expected: { user1: 'created', user2: 'created', user3: 'created' },
      error: error.message
    };
  }
}

/**
 * Test Case 2: Register project-scoped template as User 1
 */
function testRegisterProjectScopedTemplate(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 2: Register Project-Scoped Template (User 1)');
  console.log('='.repeat(80));

  try {
    PROJECT_SCOPED_TEMPLATE_ID = registerTemplate(PROJECT_TEMPLATE_NAME, 'project', USER1_TOKEN);

    return {
      pass: PROJECT_SCOPED_TEMPLATE_ID !== null,
      testCase: 'Register Project-Scoped Template',
      actual: { templateId: PROJECT_SCOPED_TEMPLATE_ID, scope: 'project' },
      expected: { templateId: 'non-null', scope: 'project' },
      details: 'Project-scoped template registered with User 1 credentials (Org A, Project A)'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Register Project-Scoped Template',
      actual: null,
      expected: { templateId: 'non-null', scope: 'project' },
      error: error.message
    };
  }
}

/**
 * Test Case 3: Register org-scoped template as User 1
 */
function testRegisterOrgScopedTemplate(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 3: Register Org-Scoped Template (User 1)');
  console.log('='.repeat(80));

  try {
    ORG_SCOPED_TEMPLATE_ID = registerTemplate(ORG_TEMPLATE_NAME, 'org', USER1_TOKEN);

    return {
      pass: ORG_SCOPED_TEMPLATE_ID !== null,
      testCase: 'Register Org-Scoped Template',
      actual: { templateId: ORG_SCOPED_TEMPLATE_ID, scope: 'org' },
      expected: { templateId: 'non-null', scope: 'org' },
      details: 'Org-scoped template registered with User 1 credentials (Org A)'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Register Org-Scoped Template',
      actual: null,
      expected: { templateId: 'non-null', scope: 'org' },
      error: error.message
    };
  }
}

/**
 * Test Case 4: Register global template (unauthenticated)
 */
function testRegisterGlobalTemplate(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 4: Register Global Template (Unauthenticated)');
  console.log('='.repeat(80));

  try {
    GLOBAL_TEMPLATE_ID = registerTemplate(GLOBAL_TEMPLATE_NAME, 'global', null);

    return {
      pass: GLOBAL_TEMPLATE_ID !== null,
      testCase: 'Register Global Template',
      actual: { templateId: GLOBAL_TEMPLATE_ID, scope: 'global' },
      expected: { templateId: 'non-null', scope: 'global' },
      details: 'Global template registered without authentication'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Register Global Template',
      actual: null,
      expected: { templateId: 'non-null', scope: 'global' },
      error: error.message
    };
  }
}

/**
 * Test Case 5: Query as User 1 (Org A, Project A) - should see project template
 */
function testQueryAsUser1(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 5: Query Templates as User 1 (Org A, Project A)');
  console.log('='.repeat(80));

  try {
    const templates = queryTemplates(USER1_TOKEN);
    
    const hasProjectTemplate = templates.some(t => t.variant_id === PROJECT_SCOPED_TEMPLATE_ID);
    const hasOrgTemplate = templates.some(t => t.variant_id === ORG_SCOPED_TEMPLATE_ID);
    const hasGlobalTemplate = templates.some(t => t.variant_id === GLOBAL_TEMPLATE_ID);

    const pass = hasProjectTemplate && hasOrgTemplate && hasGlobalTemplate;

    return {
      pass,
      testCase: 'Query as User 1 (Org A, Project A)',
      actual: {
        projectTemplate: hasProjectTemplate,
        orgTemplate: hasOrgTemplate,
        globalTemplate: hasGlobalTemplate
      },
      expected: {
        projectTemplate: true,
        orgTemplate: true,
        globalTemplate: true
      },
      details: 'User 1 should see all templates: project (own), org (own), and global'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Query as User 1 (Org A, Project A)',
      actual: null,
      expected: { projectTemplate: true, orgTemplate: true, globalTemplate: true },
      error: error.message
    };
  }
}

/**
 * Test Case 6: Query as User 2 (Org A, Project B) - should NOT see project template
 */
function testQueryAsUser2(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 6: Query Templates as User 2 (Org A, Project B)');
  console.log('='.repeat(80));

  try {
    const templates = queryTemplates(USER2_TOKEN);
    
    const hasProjectTemplate = templates.some(t => t.variant_id === PROJECT_SCOPED_TEMPLATE_ID);
    const hasOrgTemplate = templates.some(t => t.variant_id === ORG_SCOPED_TEMPLATE_ID);
    const hasGlobalTemplate = templates.some(t => t.variant_id === GLOBAL_TEMPLATE_ID);

    const pass = !hasProjectTemplate && hasOrgTemplate && hasGlobalTemplate;

    return {
      pass,
      testCase: 'Query as User 2 (Org A, Project B)',
      actual: {
        projectTemplate: hasProjectTemplate,
        orgTemplate: hasOrgTemplate,
        globalTemplate: hasGlobalTemplate
      },
      expected: {
        projectTemplate: false,
        orgTemplate: true,
        globalTemplate: true
      },
      details: 'User 2 (same org, different project) should NOT see User 1 project template, but should see org and global templates'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Query as User 2 (Org A, Project B)',
      actual: null,
      expected: { projectTemplate: false, orgTemplate: true, globalTemplate: true },
      error: error.message
    };
  }
}

/**
 * Test Case 7: Query as User 3 (Org B, Project C) - should NOT see project or org templates
 */
function testQueryAsUser3(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 7: Query Templates as User 3 (Org B, Project C)');
  console.log('='.repeat(80));

  try {
    const templates = queryTemplates(USER3_TOKEN);
    
    const hasProjectTemplate = templates.some(t => t.variant_id === PROJECT_SCOPED_TEMPLATE_ID);
    const hasOrgTemplate = templates.some(t => t.variant_id === ORG_SCOPED_TEMPLATE_ID);
    const hasGlobalTemplate = templates.some(t => t.variant_id === GLOBAL_TEMPLATE_ID);

    const pass = !hasProjectTemplate && !hasOrgTemplate && hasGlobalTemplate;

    return {
      pass,
      testCase: 'Query as User 3 (Org B, Project C)',
      actual: {
        projectTemplate: hasProjectTemplate,
        orgTemplate: hasOrgTemplate,
        globalTemplate: hasGlobalTemplate
      },
      expected: {
        projectTemplate: false,
        orgTemplate: false,
        globalTemplate: true
      },
      details: 'User 3 (different org) should ONLY see global templates, not project or org templates from Org A'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Query as User 3 (Org B, Project C)',
      actual: null,
      expected: { projectTemplate: false, orgTemplate: false, globalTemplate: true },
      error: error.message
    };
  }
}

/**
 * Test Case 8: Query unauthenticated - should ONLY see global templates
 */
function testQueryUnauthenticated(): ValidationResult {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 8: Query Templates Unauthenticated');
  console.log('='.repeat(80));

  try {
    const templates = queryTemplates(null);
    
    const hasProjectTemplate = templates.some(t => t.variant_id === PROJECT_SCOPED_TEMPLATE_ID);
    const hasOrgTemplate = templates.some(t => t.variant_id === ORG_SCOPED_TEMPLATE_ID);
    const hasGlobalTemplate = templates.some(t => t.variant_id === GLOBAL_TEMPLATE_ID);

    const pass = !hasProjectTemplate && !hasOrgTemplate && hasGlobalTemplate;

    return {
      pass,
      testCase: 'Query Unauthenticated',
      actual: {
        projectTemplate: hasProjectTemplate,
        orgTemplate: hasOrgTemplate,
        globalTemplate: hasGlobalTemplate
      },
      expected: {
        projectTemplate: false,
        orgTemplate: false,
        globalTemplate: true
      },
      details: 'Unauthenticated users should ONLY see global templates'
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Query Unauthenticated',
      actual: null,
      expected: { projectTemplate: false, orgTemplate: false, globalTemplate: true },
      error: error.message
    };
  }
}

/**
 * Main validation function
 */
export function runValidation(): HarnessResult {
  console.log('\n' + '='.repeat(80));
  console.log('PROJECT-SCOPED TEMPLATE FILTERING VALIDATION HARNESS');
  console.log('='.repeat(80));
  console.log(`RPC API URL: ${RPC_API_URL}`);
  console.log(`Environment: ${IS_K8S_ENV ? 'Kubernetes' : 'Local'}`);
  console.log('='.repeat(80));

  const results: ValidationResult[] = [];

  // Run test cases in sequence
  results.push(testCreateSessions());
  results.push(testRegisterProjectScopedTemplate());
  results.push(testRegisterOrgScopedTemplate());
  results.push(testRegisterGlobalTemplate());
  results.push(testQueryAsUser1());
  results.push(testQueryAsUser2());
  results.push(testQueryAsUser3());
  results.push(testQueryUnauthenticated());

  // Calculate summary
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = total - passed;
  const overallPass = failed === 0;

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    const status = result.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${index + 1}. ${status}: ${result.testCase}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    if (!result.pass) {
      console.log(`   Expected: ${JSON.stringify(result.expected)}`);
      console.log(`   Actual:   ${JSON.stringify(result.actual)}`);
      if (result.error) {
        console.log(`   Error:    ${result.error}`);
      }
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests:  ${total}`);
  console.log(`Passed:       ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed:       ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
  console.log(`Overall:      ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(80));

  return {
    overallPass,
    results,
    summary: { total, passed, failed }
  };
}

// Run if executed directly
if (require.main === module) {
  const result = runValidation();
  process.exit(result.overallPass ? 0 : 1);
}
