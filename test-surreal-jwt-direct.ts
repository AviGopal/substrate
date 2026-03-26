/**
 * Direct SurrealDB JWT Validation Test
 *
 * Tests whether SurrealDB can authenticate with a JWT from analysis-api
 */

import { Surreal } from 'surrealdb';

const SURREAL_URL = process.env.SURREAL_URL || 'http://localhost:8000';
const SURREAL_NAMESPACE = process.env.SURREAL_NAMESPACE || 'activity-system';
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || 'learning_loop';

// JWT from the test (copy from test output)
const TEST_JWT = process.argv[2];

async function main() {
  if (!TEST_JWT) {
    console.log('Usage: bun run test-surreal-jwt-direct.ts <jwt-token>');
    console.log('\nFirst, get a JWT by running:');
    console.log('  curl -X POST http://api.metabob.local/v2/auth/login \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"email":"test@metabob.local","password":"testpass123"}\' | jq -r \'.data.token\'');
    return;
  }

  console.log('=== Direct SurrealDB JWT Authentication Test ===\n');
  console.log(`SurrealDB URL: ${SURREAL_URL}`);
  console.log(`Namespace: ${SURREAL_NAMESPACE}`);
  console.log(`Database: ${SURREAL_DATABASE}`);

  // Decode JWT to see claims
  const parts = TEST_JWT.split('.');
  if (parts.length !== 3) {
    console.error('Invalid JWT format');
    return;
  }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  console.log('\nJWT Payload:');
  console.log(JSON.stringify(payload, null, 2));

  const db = new Surreal();

  try {
    console.log('\n--- Step 1: Connect to SurrealDB ---');
    await db.connect(SURREAL_URL);
    console.log('✅ Connected');

    console.log('\n--- Step 2: Use namespace/database ---');
    await db.use({
      namespace: SURREAL_NAMESPACE,
      database: SURREAL_DATABASE,
    });
    console.log('✅ Namespace set');

    console.log('\n--- Step 3: Authenticate with JWT ---');
    try {
      await db.authenticate(TEST_JWT);
      console.log('✅ JWT authenticated');
    } catch (authError) {
      console.error('❌ JWT authentication failed:', authError);

      // Check if it's an access definition issue
      console.log('\n--- Debug: Check ACCESS definitions ---');
      const rootDb = new Surreal();
      await rootDb.connect(SURREAL_URL);
      await rootDb.signin({
        username: process.env.SURREAL_USER || 'root',
        password: process.env.SURREAL_PASS || 'surrealdb-local-dev-123',
      });
      await rootDb.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });

      const accessInfo = await rootDb.query('INFO FOR DB');
      console.log('Database INFO:');
      console.log(JSON.stringify(accessInfo, null, 2));

      await rootDb.close();
      return;
    }

    console.log('\n--- Step 4: Query $auth to see claims ---');
    const authResult = await db.query(`RETURN {
      id: $auth.id,
      org_id: $auth.org_id,
      user_id: $auth.user_id,
      role: $auth.role,
      project_ids: $auth.project_ids
    }`);
    console.log('$auth claims:');
    console.log(JSON.stringify(authResult, null, 2));

    const auth = authResult[0];
    if (auth && auth.org_id) {
      console.log('\n✅ SUCCESS: JWT authentication working!');
      console.log(`   org_id: ${auth.org_id}`);
    } else {
      console.log('\n❌ ISSUE: JWT authenticated but $auth.org_id is missing');
      console.log('   This means SurrealDB is not mapping JWT claims to $auth correctly');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await db.close();
  }
}

main();
