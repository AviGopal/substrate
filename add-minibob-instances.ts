#!/usr/bin/env bun

/**
 * Add MiniBob instances to backend
 *
 * Creates MiniBob instances for local development with proper Argon2 hashing.
 * Instances can bootstrap with authentication and participate in learning loop.
 *
 * Usage:
 *   bun add-minibob-instances.ts                    # Add default instance
 *   bun add-minibob-instances.ts --instance abc-001 # Add specific instance
 *
 * Environment variables:
 *   SURREALDB_URL: SurrealDB endpoint (default: http://localhost:8000)
 *   SURREALDB_NAMESPACE: Database namespace (default: activity-system)
 *   SURREALDB_DATABASE: Database name (default: learning_loop)
 *   SURREALDB_USERNAME: Auth username (default: root)
 *   SURREALDB_PASSWORD: Auth password
 *   DEFAULT_ORG_ID: Organization to associate instances with (default: metabob_internal)
 */

import { Surreal } from 'surrealdb';

const SURREAL_URL = process.env.SURREALDB_URL || 'http://localhost:8000';
const SURREAL_NAMESPACE = process.env.SURREALDB_NAMESPACE || 'activity-system';
const SURREAL_DATABASE = process.env.SURREALDB_DATABASE || 'learning_loop';
const SURREAL_USERNAME = process.env.SURREALDB_USERNAME || 'root';
const SURREAL_PASSWORD = process.env.SURREALDB_PASSWORD || 'surrealdb-local-dev-123';
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || 'metabob_internal';

// MiniBob instances to create: { instance_id, api_key, vessel_id, description }
const INSTANCES_TO_CREATE = [
  {
    instance_id: 'minibob-local-001',
    api_key: 'test-api-key-123',
    vessel_id: 'minibob-cli-local',
    description: 'Local CLI MiniBob instance'
  },
  {
    instance_id: 'minibob-local-dev',
    api_key: 'dev-api-key-456',
    vessel_id: 'minibob-cli-dev',
    description: 'Local development MiniBob instance'
  },
  {
    instance_id: 'minibob-local-test',
    api_key: 'test-api-key-789',
    vessel_id: 'minibob-cli-test',
    description: 'Local testing MiniBob instance'
  },
  {
    instance_id: 'minibob-k8s-001',
    api_key: 'k8s-api-key-prod',
    vessel_id: 'minibob-k8s-prod',
    description: 'Kubernetes production MiniBob instance'
  },
];

interface InstanceConfig {
  instance_id: string;
  api_key: string;
  vessel_id: string;
  description: string;
}

async function createInstance(
  db: Surreal,
  config: InstanceConfig,
  orgId: string
): Promise<boolean> {
  try {
    console.log(`\n📦 Creating MiniBob instance: ${config.instance_id}`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Vessel ID: ${config.vessel_id}`);
    console.log(`   Organization: ${orgId}`);

    // Check if instance already exists
    const existingCheck = await db.query(
      `SELECT * FROM minibob_instance WHERE instance_id = $instance_id`,
      { instance_id: config.instance_id }
    );

    if (existingCheck[0] && existingCheck[0].length > 0) {
      console.log(`   ⚠️  Instance already exists - skipping`);
      return false;
    }

    // Generate argon2 hash for API key
    console.log(`   🔐 Generating Argon2 hash for API key...`);
    const hashResult = await db.query(
      `RETURN crypto::argon2::generate($api_key)`,
      { api_key: config.api_key }
    );
    const apiKeyHash = hashResult[0];
    console.log(`   ✓ API key hashed`);

    // Create the instance
    console.log(`   💾 Creating instance record...`);
    const instanceResult = await db.query(
      `CREATE minibob_instance CONTENT {
        instance_id: $instance_id,
        org_id: $org_id,
        project_id: NONE,
        api_key_hash: $api_key_hash,
        vessel_id: $vessel_id,
        is_active: true,
        created_at: time::now(),
        last_active_at: time::now()
      }`,
      {
        instance_id: config.instance_id,
        org_id: orgId,
        api_key_hash: apiKeyHash,
        vessel_id: config.vessel_id,
      }
    );

    if (instanceResult[0] && instanceResult[0].length > 0) {
      const instance = instanceResult[0][0];
      console.log(`   ✅ Successfully created!`);
      console.log(`   ID: ${instance.id}`);
      console.log(`   Instance ID: ${instance.instance_id}`);
      console.log(`   API Key (for config): ${config.api_key}`);
      console.log(`   Org ID: ${instance.org_id}`);
      return true;
    } else {
      console.log(`   ❌ Failed to create instance`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error creating instance: ${error}`);
    return false;
  }
}

async function main() {
  const db = new Surreal();

  try {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║   MiniBob Instance Creation Tool          ║');
    console.log('╚═══════════════════════════════════════════╝');

    console.log(`\n🔌 Connecting to SurrealDB...`);
    console.log(`   URL: ${SURREAL_URL}`);
    console.log(`   Namespace: ${SURREAL_NAMESPACE}`);
    console.log(`   Database: ${SURREAL_DATABASE}`);

    await db.connect(SURREAL_URL);
    console.log(`   ✓ Connected`);

    console.log(`\n🔐 Signing in as ${SURREAL_USERNAME}...`);
    await db.signin({
      username: SURREAL_USERNAME,
      password: SURREAL_PASSWORD,
    });
    console.log(`   ✓ Authenticated`);

    console.log(`\n📂 Selecting namespace and database...`);
    await db.use({
      namespace: SURREAL_NAMESPACE,
      database: SURREAL_DATABASE,
    });
    console.log(`   ✓ Selected`);

    // Verify organization exists
    console.log(`\n🏢 Verifying organization: ${DEFAULT_ORG_ID}...`);
    const orgCheck = await db.query(
      `SELECT * FROM organizations WHERE org_id = $org_id`,
      { org_id: DEFAULT_ORG_ID }
    );

    if (!orgCheck[0] || orgCheck[0].length === 0) {
      console.log(`   ⚠️  Organization not found. Creating...`);
      await db.query(
        `UPDATE organizations:$org_id CONTENT {
          org_id: $org_id,
          name: $name,
          created_at: time::now(),
          updated_at: time::now()
        }`,
        {
          org_id: DEFAULT_ORG_ID,
          name: 'Metabob Internal',
        }
      );
      console.log(`   ✓ Organization created`);
    } else {
      console.log(`   ✓ Organization exists`);
    }

    // Create instances
    // Use record format for org_id to match JWT $auth.org_id format
    console.log(`\n🚀 Creating MiniBob instances...`);
    console.log(`═══════════════════════════════════════════`);

    const orgIdForInstances = `organizations:${DEFAULT_ORG_ID}`;

    let created = 0;
    let skipped = 0;

    for (const config of INSTANCES_TO_CREATE) {
      const success = await createInstance(db, config, orgIdForInstances);
      if (success) {
        created++;
      } else {
        skipped++;
      }
    }

    // Summary
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`\n✅ Instance Creation Summary`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${INSTANCES_TO_CREATE.length}`);

    // Show configuration template
    console.log(`\n📋 Configuration Template`);
    console.log(`\nAdd to ~/.metabob/config.json:`);
    console.log(`\`\`\`json`);
    console.log(`{`);
    console.log(`  "instance": {`);
    console.log(`    "instanceId": "minibob-local-001",`);
    console.log(`    "apiKey": "test-api-key-123",`);
    console.log(`    "orgId": "${DEFAULT_ORG_ID}"`);
    console.log(`  },`);
    console.log(`  "vessels": {`);
    console.log(`    "metabob": {`);
    console.log(`      "endpoint": "https://activity.metabob.com"`);
    console.log(`    }`);
    console.log(`  }`);
    console.log(`}`);
    console.log(`\`\`\``);

    // Test authentication
    console.log(`\n🧪 Testing authentication...`);
    try {
      const testDb = new Surreal();
      await testDb.connect(SURREAL_URL);
      await testDb.use({
        namespace: SURREAL_NAMESPACE,
        database: SURREAL_DATABASE,
      });

      const authResult = await testDb.signin({
        access: 'minibob_record',
        variables: {
          instance_id: 'minibob-local-001',
          api_key: 'test-api-key-123',
        },
      });

      console.log(`   ✓ Authentication successful`);
      console.log(`   Token: ${typeof authResult === 'string' ? authResult.substring(0, 20) + '...' : 'JWT token received'}`);

      await testDb.close();
    } catch (authError) {
      console.log(`   ⚠️  Authentication test failed (instance may not exist yet)`);
    }

    console.log(`\n✨ Done!`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
