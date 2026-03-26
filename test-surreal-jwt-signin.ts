/**
 * Test SurrealDB JWT signin with access method specified
 */

import { Surreal } from 'surrealdb';

const SURREAL_URL = process.env.SURREAL_URL || 'http://localhost:8000';
const SURREAL_NAMESPACE = process.env.SURREAL_NAMESPACE || 'activity-system';
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || 'learning_loop';

const TEST_JWT = process.argv[2];

async function main() {
  if (!TEST_JWT) {
    console.log('Usage: bun run test-surreal-jwt-signin.ts <jwt-token>');
    return;
  }

  console.log('=== SurrealDB JWT Signin Test ===\n');

  // Decode JWT
  const parts = TEST_JWT.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  console.log('JWT Payload:', JSON.stringify(payload, null, 2));

  const db = new Surreal();

  try {
    await db.connect(SURREAL_URL);
    await db.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });

    console.log('\n--- Method 1: authenticate() with raw token ---');
    try {
      await db.authenticate(TEST_JWT);
      console.log('✅ authenticate() worked');
    } catch (e: any) {
      console.log('❌ authenticate() failed:', e.message || e);
    }

    // Reconnect for next test
    await db.close();
    const db2 = new Surreal();
    await db2.connect(SURREAL_URL);
    await db2.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });

    console.log('\n--- Method 2: signin() with access specified ---');
    try {
      // Try signin with JWT access
      const result = await db2.signin({
        access: 'jwt_external',
        variables: {
          token: TEST_JWT
        }
      } as any);
      console.log('✅ signin() with access worked:', result);
    } catch (e: any) {
      console.log('❌ signin() with access failed:', e.message || e);
    }

    // Try another approach - use JWT directly with access in signin
    console.log('\n--- Method 3: Check if JWT token works in RECORD access style ---');
    try {
      await db2.close();
      const db3 = new Surreal();
      await db3.connect(SURREAL_URL);
      await db3.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });

      // Some SurrealDB versions use this pattern
      const result = await db3.query(`
        RETURN {
          message: "Testing query without auth"
        }
      `);
      console.log('Query result:', result);
    } catch (e: any) {
      console.log('❌ Query test failed:', e.message || e);
    }

    // Check what ACCESS definitions accept
    console.log('\n--- Checking ACCESS definition details ---');
    const rootDb = new Surreal();
    await rootDb.connect(SURREAL_URL);
    await rootDb.signin({
      username: 'root',
      password: 'surrealdb-local-dev-123',
    });
    await rootDb.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });

    // Check the exact jwt_external definition
    const info = await rootDb.query('INFO FOR ACCESS jwt_external ON DATABASE');
    console.log('ACCESS jwt_external info:', JSON.stringify(info, null, 2));

    await rootDb.close();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

main();
