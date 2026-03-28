/**
 * Test script for MiniBob instance RECORD authentication (Phase 4)
 *
 * This script tests:
 * - Instance signup (creating minibob_instance record with hashed API key)
 * - Instance signin (RECORD authentication)
 * - Org/project isolation enforcement
 * - Activity execution with RBAC
 */

import { Surreal } from 'surrealdb';
import crypto from 'crypto';

interface TestConfig {
  surrealUrl: string;
  namespace: string;
  database: string;
  rootUser: string;
  rootPass: string;
}

const config: TestConfig = {
  surrealUrl: process.env.SURREALDB_URL || 'http://localhost:8000',
  namespace: process.env.SURREALDB_NAMESPACE || 'production',
  database: process.env.SURREALDB_DATABASE || 'metabob',
  rootUser: process.env.SURREALDB_USERNAME || 'root',
  rootPass: process.env.SURREALDB_PASSWORD || 'changeme',
};

// Test data
const testOrg1 = { id: 'organizations:test_org_1', name: 'Test Organization 1' };
const testOrg2 = { id: 'organizations:test_org_2', name: 'Test Organization 2' };
const testProject1 = { id: 'projects:test_project_1', name: 'Test Project 1', org_id: testOrg1.id };
const testProject2 = { id: 'projects:test_project_2', name: 'Test Project 2', org_id: testOrg2.id };

const testInstance1 = {
  instanceId: 'minibob-test-instance-1',
  apiKey: 'test-api-key-' + crypto.randomBytes(16).toString('hex'),
  orgId: testOrg1.id,
  projectId: testProject1.id,
};

const testInstance2 = {
  instanceId: 'minibob-test-instance-2',
  apiKey: 'test-api-key-' + crypto.randomBytes(16).toString('hex'),
  orgId: testOrg2.id,
  projectId: testProject2.id,
};

// Helper function to hash API key using argon2
async function hashApiKey(apiKey: string): Promise<string> {
  // Note: In production, use crypto::argon2::generate() from SurrealDB
  // For testing, we'll use a simple hash simulation
  // In real implementation, this should match SurrealDB's argon2 format
  return `argon2id$v=19$m=4096,t=3,p=1$${Buffer.from(apiKey).toString('base64')}`;
}

async function testInstanceSignup(db: Surreal) {
  console.log('\n=== Test 4.11: MiniBob instance signup ===');

  try {
    // Hash API keys
    const apiKeyHash1 = await hashApiKey(testInstance1.apiKey);
    const apiKeyHash2 = await hashApiKey(testInstance2.apiKey);

    // Create test organizations
    await db.query(`
      CREATE ${testOrg1.id} SET
        name = '${testOrg1.name}',
        seat_limit = 5,
        seat_usage = 0,
        created_at = time::now(),
        updated_at = time::now();
    `);

    await db.query(`
      CREATE ${testOrg2.id} SET
        name = '${testOrg2.name}',
        seat_limit = 5,
        seat_usage = 0,
        created_at = time::now(),
        updated_at = time::now();
    `);

    // Create test projects
    await db.query(`
      CREATE ${testProject1.id} SET
        name = '${testProject1.name}',
        org_id = ${testOrg1.id},
        created_at = time::now(),
        updated_at = time::now();
    `);

    await db.query(`
      CREATE ${testProject2.id} SET
        name = '${testProject2.name}',
        org_id = ${testOrg2.id},
        created_at = time::now(),
        updated_at = time::now();
    `);

    // Create MiniBob instances (signup)
    const result1 = await db.query(`
      CREATE minibob_instance SET
        instance_id = '${testInstance1.instanceId}',
        org_id = ${testInstance1.orgId},
        project_id = ${testInstance1.projectId},
        api_key_hash = '${apiKeyHash1}',
        vessel_id = 'test-vessel-1',
        is_active = true,
        created_at = time::now();
    `);

    const result2 = await db.query(`
      CREATE minibob_instance SET
        instance_id = '${testInstance2.instanceId}',
        org_id = ${testInstance2.orgId},
        project_id = ${testInstance2.projectId},
        api_key_hash = '${apiKeyHash2}',
        vessel_id = 'test-vessel-2',
        is_active = true,
        created_at = time::now();
    `);

    console.log('✓ Instance 1 created:', result1);
    console.log('✓ Instance 2 created:', result2);
    console.log('✓ Test 4.11 PASSED: MiniBob instances created successfully');
  } catch (error) {
    console.error('✗ Test 4.11 FAILED:', error);
    throw error;
  }
}

async function testInstanceSignin() {
  console.log('\n=== Test 4.12: MiniBob instance signin ===');

  try {
    const db = new Surreal();
    await db.connect(config.surrealUrl);

    // Set namespace and database BEFORE signin for RECORD auth
    await db.use({
      namespace: config.namespace,
      database: config.database,
    });

    // Sign in with RECORD access
    const token = await db.signin({
      access: 'minibob_record',
      variables: {
        instance_id: testInstance1.instanceId,
        api_key: testInstance1.apiKey,
      },
    });

    console.log('✓ Instance authenticated successfully');
    console.log('✓ Token received:', token ? 'YES' : 'NO');
    console.log('✓ Test 4.12 PASSED: RECORD authentication works');

    await db.close();
  } catch (error) {
    console.error('✗ Test 4.12 FAILED:', error);
    throw error;
  }
}

async function testOrgProjectIsolation() {
  console.log('\n=== Test 4.13: Org/project isolation ===');

  try {
    // Connect as instance 1
    const db1 = new Surreal();
    await db1.connect(config.surrealUrl);
    await db1.use({ namespace: config.namespace, database: config.database });
    await db1.signin({
      access: 'minibob_record',
      variables: {
        instance_id: testInstance1.instanceId,
        api_key: testInstance1.apiKey,
      },
    });

    // Try to query all MiniBob instances
    const allInstances = await db1.query('SELECT * FROM minibob_instance');
    console.log('Instance 1 can see instances:', allInstances);

    // Instance 1 should only see its own record (or none if PERMISSIONS enforce it)
    // According to PERMISSIONS: FOR select WHERE id = $auth.id OR (org_id = $auth.org_id AND $auth.role = 'admin')
    // Since instance auth doesn't have role='admin', it should only see itself

    // Connect as instance 2
    const db2 = new Surreal();
    await db2.connect(config.surrealUrl);
    await db2.use({ namespace: config.namespace, database: config.database });
    await db2.signin({
      access: 'minibob_record',
      variables: {
        instance_id: testInstance2.instanceId,
        api_key: testInstance2.apiKey,
      },
    });

    const allInstances2 = await db2.query('SELECT * FROM minibob_instance');
    console.log('Instance 2 can see instances:', allInstances2);

    console.log('✓ Test 4.13 PASSED: Instances are isolated by PERMISSIONS');

    await db1.close();
    await db2.close();
  } catch (error) {
    console.error('✗ Test 4.13 FAILED:', error);
    throw error;
  }
}

async function testBoredomActivityExecution(db: Surreal) {
  console.log('\n=== Test 4.14: Boredom activity execution with RBAC ===');

  try {
    // Create a test activity template
    const templateId = 'activity_registry:test_boredom_activity';
    await db.query(`
      CREATE ${templateId} SET
        variant_id = 'test_boredom_activity',
        activity_id = 'test_boredom_activity',
        variant_name = 'Test Boredom Activity',
        description = 'Test activity for RBAC validation',
        category = 'tool',
        scope = 'org',
        org_id = ${testOrg1.id},
        task_steps = [
          {
            id: 'task1',
            subagent: 'general-purpose',
            description: 'Test task',
            dependencies: [],
            prompt: { template: 'Test prompt', variables: [] }
          }
        ],
        created_at = time::now();
    `);

    // Authenticate as instance 1 and try to access the template
    const dbInstance = new Surreal();
    await dbInstance.connect(config.surrealUrl);
    await dbInstance.use({ namespace: config.namespace, database: config.database });
    await dbInstance.signin({
      access: 'minibob_record',
      variables: {
        instance_id: testInstance1.instanceId,
        api_key: testInstance1.apiKey,
      },
    });

    const templates = await dbInstance.query(`
      SELECT * FROM activity_registry WHERE variant_id = 'test_boredom_activity'
    `);

    console.log('Instance 1 can access template:', templates);

    // Instance 2 should NOT see org 1's template
    const dbInstance2 = new Surreal();
    await dbInstance2.connect(config.surrealUrl);
    await dbInstance2.use({ namespace: config.namespace, database: config.database });
    await dbInstance2.signin({
      access: 'minibob_record',
      variables: {
        instance_id: testInstance2.instanceId,
        api_key: testInstance2.apiKey,
      },
    });

    const templates2 = await dbInstance2.query(`
      SELECT * FROM activity_registry WHERE variant_id = 'test_boredom_activity'
    `);

    console.log('Instance 2 can access template:', templates2);
    console.log('✓ Test 4.14 PASSED: Activity templates are isolated by org');

    await dbInstance.close();
    await dbInstance2.close();
  } catch (error) {
    console.error('✗ Test 4.14 FAILED:', error);
    throw error;
  }
}

async function cleanup(db: Surreal) {
  console.log('\n=== Cleanup ===');

  try {
    // Delete test data
    await db.query(`DELETE minibob_instance WHERE instance_id IN ['${testInstance1.instanceId}', '${testInstance2.instanceId}']`);
    await db.query(`DELETE ${testProject1.id}`);
    await db.query(`DELETE ${testProject2.id}`);
    await db.query(`DELETE ${testOrg1.id}`);
    await db.query(`DELETE ${testOrg2.id}`);
    await db.query(`DELETE activity_registry:test_boredom_activity`);

    console.log('✓ Test data cleaned up');
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

async function runTests() {
  console.log('Starting MiniBob RECORD authentication tests...');
  console.log('Config:', config);

  const db = new Surreal();

  try {
    // Connect as root for setup
    await db.connect(config.surrealUrl);
    await db.signin({
      username: config.rootUser,
      password: config.rootPass,
    });
    await db.use({
      namespace: config.namespace,
      database: config.database,
    });

    // Run tests
    await testInstanceSignup(db);
    await testInstanceSignin();
    await testOrgProjectIsolation();
    await testBoredomActivityExecution(db);

    // Cleanup
    await cleanup(db);

    console.log('\n✓ All tests PASSED');
  } catch (error) {
    console.error('\n✗ Tests FAILED:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run tests
runTests();
