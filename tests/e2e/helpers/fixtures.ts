/**
 * Test Fixtures for E2E tests
 *
 * Provides setup and teardown functions for creating test data.
 * Uses direct SurrealDB connection with root credentials.
 */

import { Surreal } from 'surrealdb';

// Configuration
const SURREALDB_URL = process.env.SURREALDB_URL || 'http://surql.metabob.local';
const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE || 'activity-system';
const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE || 'learning_loop';
const SURREALDB_USERNAME = process.env.SURREALDB_USERNAME || 'root';
const SURREALDB_PASSWORD = process.env.SURREALDB_PASSWORD || 'surrealdb-local-dev-123';

// Test fixture IDs (prefixed with 'test_' for easy cleanup)
export const TEST_ORG_ALPHA = 'test_org_alpha';
export const TEST_ORG_BETA = 'test_org_beta';
export const TEST_ORG_GAMMA = 'test_org_gamma';

export const TEST_USER_ALPHA_ADMIN = 'test_user_alpha_admin';
export const TEST_USER_ALPHA_MEMBER = 'test_user_alpha_member';
export const TEST_USER_BETA_ADMIN = 'test_user_beta_admin';

export const TEST_PROJECT_ALPHA = 'test_project_alpha';
export const TEST_PROJECT_BETA = 'test_project_beta';

export const TEST_MINIBOB_ALPHA = 'mb-test-alpha-001';
export const TEST_MINIBOB_BETA = 'mb-test-beta-001';

export const TEST_API_KEY_ALPHA = 'mb_test_alpha_key_001';
export const TEST_API_KEY_BETA = 'mb_test_beta_key_001';

/**
 * Create database connection with root credentials
 */
async function createConnection(): Promise<Surreal> {
  const db = new Surreal();

  // Connect to SurrealDB (v2 SDK with SurrealDB 3.x)
  await db.connect(SURREALDB_URL);

  // Sign in as root user
  await db.signin({
    username: SURREALDB_USERNAME,
    password: SURREALDB_PASSWORD,
  });

  // Select namespace and database
  await db.use({
    namespace: SURREALDB_NAMESPACE,
    database: SURREALDB_DATABASE,
  });

  return db;
}

/**
 * Setup test organizations
 */
export async function setupOrganizations(db: Surreal): Promise<void> {
  // Create org_alpha
  await db.query(`
    CREATE organizations:${TEST_ORG_ALPHA} SET
      name = 'Test Org Alpha',
      seat_limit = 10,
      created_at = time::now()
  `);

  // Create org_beta
  await db.query(`
    CREATE organizations:${TEST_ORG_BETA} SET
      name = 'Test Org Beta',
      seat_limit = 10,
      created_at = time::now()
  `);

  // Create org_gamma
  await db.query(`
    CREATE organizations:${TEST_ORG_GAMMA} SET
      name = 'Test Org Gamma',
      seat_limit = 10,
      created_at = time::now()
  `);
}

/**
 * Setup test users
 */
export async function setupUsers(db: Surreal): Promise<void> {
  // Alpha org admin
  await db.query(`
    CREATE users:${TEST_USER_ALPHA_ADMIN} SET
      org_id = organizations:${TEST_ORG_ALPHA},
      email = 'admin@alpha.test',
      name = 'Alpha Admin',
      password_hash = crypto::argon2::generate('test-password'),
      role = 'admin',
      created_at = time::now()
  `);

  // Alpha org member (limited access)
  await db.query(`
    CREATE users:${TEST_USER_ALPHA_MEMBER} SET
      org_id = organizations:${TEST_ORG_ALPHA},
      email = 'member@alpha.test',
      name = 'Alpha Member',
      password_hash = crypto::argon2::generate('test-password'),
      role = 'member',
      created_at = time::now()
  `);

  // Beta org admin
  await db.query(`
    CREATE users:${TEST_USER_BETA_ADMIN} SET
      org_id = organizations:${TEST_ORG_BETA},
      email = 'admin@beta.test',
      name = 'Beta Admin',
      password_hash = crypto::argon2::generate('test-password'),
      role = 'admin',
      created_at = time::now()
  `);
}

/**
 * Setup test projects
 */
export async function setupProjects(db: Surreal): Promise<void> {
  // Alpha project
  await db.query(`
    CREATE projects:${TEST_PROJECT_ALPHA} SET
      org_id = organizations:${TEST_ORG_ALPHA},
      name = 'Alpha Project',
      created_at = time::now()
  `);

  // Beta project
  await db.query(`
    CREATE projects:${TEST_PROJECT_BETA} SET
      org_id = organizations:${TEST_ORG_BETA},
      name = 'Beta Project',
      created_at = time::now()
  `);

  // Add alpha admin to alpha project
  await db.query(`
    CREATE project_members SET
      org_id = organizations:${TEST_ORG_ALPHA},
      project_id = projects:${TEST_PROJECT_ALPHA},
      user_id = users:${TEST_USER_ALPHA_ADMIN},
      role = 'maintainer',
      added_at = time::now()
  `);
}

/**
 * Setup test MiniBob instances
 */
export async function setupMiniBobInstances(db: Surreal): Promise<void> {
  // Alpha MiniBob
  await db.query(`
    CREATE minibob_instance SET
      instance_id = '${TEST_MINIBOB_ALPHA}',
      org_id = organizations:${TEST_ORG_ALPHA},
      project_id = projects:${TEST_PROJECT_ALPHA},
      api_key_hash = crypto::argon2::generate('alpha-minibob-key'),
      is_active = true,
      created_at = time::now()
  `);

  // Beta MiniBob
  await db.query(`
    CREATE minibob_instance SET
      instance_id = '${TEST_MINIBOB_BETA}',
      org_id = organizations:${TEST_ORG_BETA},
      project_id = projects:${TEST_PROJECT_BETA},
      api_key_hash = crypto::argon2::generate('beta-minibob-key'),
      is_active = true,
      created_at = time::now()
  `);

  // Inactive MiniBob for testing
  await db.query(`
    CREATE minibob_instance SET
      instance_id = 'mb-test-inactive-001',
      org_id = organizations:${TEST_ORG_ALPHA},
      project_id = projects:${TEST_PROJECT_ALPHA},
      api_key_hash = crypto::argon2::generate('inactive-key'),
      is_active = false,
      created_at = time::now()
  `);
}

/**
 * Setup test API keys
 */
export async function setupApiKeys(db: Surreal): Promise<void> {
  // Alpha API key (active) - uses hash as ID for easy lookup
  await db.query(`
    CREATE api_keys:test_alpha_key SET
      key_hash = crypto::argon2::generate('${TEST_API_KEY_ALPHA}'),
      org_id = organizations:${TEST_ORG_ALPHA},
      user_id = users:${TEST_USER_ALPHA_ADMIN},
      scopes = ['read', 'write'],
      is_active = true,
      created_at = time::now()
  `);

  // Beta API key (active)
  await db.query(`
    CREATE api_keys:test_beta_key SET
      key_hash = crypto::argon2::generate('${TEST_API_KEY_BETA}'),
      org_id = organizations:${TEST_ORG_BETA},
      user_id = users:${TEST_USER_BETA_ADMIN},
      scopes = ['read', 'write'],
      is_active = true,
      created_at = time::now()
  `);

  // Expired API key (for testing)
  await db.query(`
    CREATE api_keys:test_expired_key SET
      key_hash = crypto::argon2::generate('mb_expired_key_123'),
      org_id = organizations:${TEST_ORG_ALPHA},
      user_id = users:${TEST_USER_ALPHA_ADMIN},
      scopes = ['read'],
      is_active = true,
      expires_at = time::now() - 1d,
      created_at = time::now() - 2d
  `);

  // Revoked API key (for testing)
  await db.query(`
    CREATE api_keys:test_revoked_key SET
      key_hash = crypto::argon2::generate('mb_revoked_key_123'),
      org_id = organizations:${TEST_ORG_ALPHA},
      user_id = users:${TEST_USER_ALPHA_ADMIN},
      scopes = ['read'],
      is_active = false,
      created_at = time::now()
  `);
}

/**
 * Setup test templates
 */
export async function setupTemplates(db: Surreal): Promise<void> {
  // Alpha org template
  await db.query(`
    CREATE activity_template SET
      variant_id = 'test-alpha-template-001',
      activity_id = 'test-activity-alpha',
      variant_name = 'Alpha Test Template',
      description = 'Test template for org alpha',
      category = 'tool',
      scope = 'org',
      org_id = '${TEST_ORG_ALPHA}',
      task_steps = [],
      created_at = time::now(),
      updated_at = time::now()
  `);

  // Beta org template
  await db.query(`
    CREATE activity_template SET
      variant_id = 'test-beta-template-001',
      activity_id = 'test-activity-beta',
      variant_name = 'Beta Test Template',
      description = 'Test template for org beta',
      category = 'tool',
      scope = 'org',
      org_id = '${TEST_ORG_BETA}',
      task_steps = [],
      created_at = time::now(),
      updated_at = time::now()
  `);

  // Global template (scope=global means visible to all)
  // Use record format for org_id consistency
  await db.query(`
    CREATE activity_template SET
      variant_id = 'test-global-public-001',
      activity_id = 'test-activity-global',
      variant_name = 'Global Public Template',
      description = 'Visible to all orgs',
      category = 'tool',
      scope = 'global',
      org_id = 'organizations:metabob_internal',
      task_steps = [],
      created_at = time::now(),
      updated_at = time::now()
  `);

  // Project-scoped template
  await db.query(`
    CREATE activity_template SET
      variant_id = 'test-project-template-001',
      activity_id = 'test-activity-project',
      variant_name = 'Project Scoped Template',
      description = 'Only visible to project members',
      category = 'tool',
      scope = 'project',
      org_id = '${TEST_ORG_ALPHA}',
      project_id = '${TEST_PROJECT_ALPHA}',
      task_steps = [],
      created_at = time::now(),
      updated_at = time::now()
  `);
}

/**
 * Setup all test fixtures
 */
export async function setupTestFixtures(): Promise<void> {
  const db = await createConnection();

  try {
    // Clean up any existing test data first
    await teardownTestFixtures();

    // Create fixtures in order (respecting foreign key relationships)
    await setupOrganizations(db);
    await setupUsers(db);
    await setupProjects(db);
    await setupMiniBobInstances(db);
    await setupApiKeys(db);
    await setupTemplates(db);

    console.log('✓ Test fixtures created successfully');
  } finally {
    await db.close();
  }
}

/**
 * Teardown test fixtures
 */
export async function teardownTestFixtures(): Promise<void> {
  const db = await createConnection();

  // Helper to safely delete - ignores errors if table doesn't exist
  async function safeDelete(query: string): Promise<void> {
    try {
      await db.query(query);
    } catch (error) {
      // Ignore NotFoundError for non-existent tables
      const err = error as { kind?: string };
      if (err.kind !== 'NotFound') {
        console.warn(`Warning during cleanup: ${(error as Error).message}`);
      }
    }
  }

  try {
    // Delete in reverse order of creation (respecting foreign keys)
    await safeDelete(`DELETE activity_template WHERE variant_id CONTAINS 'test-'`);
    await safeDelete(`DELETE api_keys:test_alpha_key, api_keys:test_beta_key, api_keys:test_expired_key, api_keys:test_revoked_key`);
    await safeDelete(`DELETE minibob_instance WHERE instance_id CONTAINS 'mb-test-'`);
    await safeDelete(`DELETE project_members WHERE project_id IN [projects:${TEST_PROJECT_ALPHA}, projects:${TEST_PROJECT_BETA}]`);
    await safeDelete(`DELETE projects WHERE id IN [projects:${TEST_PROJECT_ALPHA}, projects:${TEST_PROJECT_BETA}]`);
    await safeDelete(`DELETE users WHERE id IN [users:${TEST_USER_ALPHA_ADMIN}, users:${TEST_USER_ALPHA_MEMBER}, users:${TEST_USER_BETA_ADMIN}]`);
    await safeDelete(`DELETE organizations WHERE id IN [organizations:${TEST_ORG_ALPHA}, organizations:${TEST_ORG_BETA}, organizations:${TEST_ORG_GAMMA}]`);
    await safeDelete(`DELETE execution_trace WHERE variant_id CONTAINS 'test-'`);

    console.log('✓ Test fixtures cleaned up');
  } finally {
    await db.close();
  }
}

/**
 * Get fixture credentials for testing
 */
export const testCredentials = {
  alphaMiniBob: {
    instanceId: TEST_MINIBOB_ALPHA,
    apiKey: 'alpha-minibob-key',
  },
  betaMiniBob: {
    instanceId: TEST_MINIBOB_BETA,
    apiKey: 'beta-minibob-key',
  },
  inactiveMiniBob: {
    instanceId: 'mb-test-inactive-001',
    apiKey: 'inactive-key',
  },
  alphaApiKey: TEST_API_KEY_ALPHA,
  betaApiKey: TEST_API_KEY_BETA,
  expiredApiKey: 'mb_expired_key_123',
  revokedApiKey: 'mb_revoked_key_123',
  alphaAdmin: {
    email: 'admin@alpha.test',
    password: 'test-password',
  },
  betaAdmin: {
    email: 'admin@beta.test',
    password: 'test-password',
  },
};
