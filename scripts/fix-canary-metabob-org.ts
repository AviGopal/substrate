#!/usr/bin/env bun
/**
 * Fix Missing organizations:metabob in Canary Database
 *
 * This script:
 * 1. Creates organizations:metabob if it doesn't exist
 * 2. Updates API keys to reference the correct user (users:kre88ea3i1vmuj1gd12a)
 * 3. Creates org_members link between user and organization
 *
 * Prerequisites:
 * - kubectl port-forward svc/surrealdb 8000:8000 -n activity-system
 * - SOPS access to repos/deployment/secrets/canary.secrets.yaml
 *
 * Usage:
 *   bun run scripts/fix-canary-metabob-org.ts
 */

import { Surreal } from "surrealdb";
import { execSync } from "child_process";

const SURREALDB_URL = process.env.CANARY_SURREALDB_URL || "http://localhost:8000";
const NAMESPACE = "activity-system";
const DATABASE = "learning_loop";

async function main() {
  const db = new Surreal();

  try {
    // Get password from SOPS
    console.log("Loading SurrealDB password from SOPS...");
    const password = execSync(
      `sops -d repos/deployment/secrets/canary.secrets.yaml 2>/dev/null | awk '/^surrealdb:/{found=1} found && /^    password:/{print $2; exit}'`,
      { encoding: "utf-8" }
    ).trim();

    if (!password) {
      console.error("❌ Failed to load password from SOPS");
      process.exit(1);
    }

    // Connect and authenticate
    console.log(`Connecting to ${SURREALDB_URL}...`);
    await db.connect(SURREALDB_URL);

    console.log("Signing in as root...");
    await db.signin({ username: "root", password });

    console.log(`Using namespace: ${NAMESPACE}, database: ${DATABASE}`);
    await db.use({ namespace: NAMESPACE, database: DATABASE });

    // Step 1: Check if organizations:metabob exists
    console.log("\n=== Step 1: Check organizations:metabob ===");
    const existingOrg = await db.query(
      `SELECT * FROM organizations:metabob`
    );

    if (existingOrg[0] && (existingOrg[0] as any[]).length > 0) {
      console.log("✓ organizations:metabob already exists");
      console.log(JSON.stringify((existingOrg[0] as any[])[0], null, 2));
    } else {
      console.log("Creating organizations:metabob...");
      const createOrgResult = await db.query(`
        CREATE organizations:metabob SET
          name = "Metabob",
          subscription_tier = "pro",
          created_at = time::now()
      `);
      console.log("✓ Created organizations:metabob");
      console.log(JSON.stringify((createOrgResult[0] as any[])[0], null, 2));
    }

    // Step 2: Update API keys to reference correct user
    console.log("\n=== Step 2: Fix API Key User References ===");
    console.log("Current user: users:kre88ea3i1vmuj1gd12a (self@metabob.com)");

    const apiKeysToFix = await db.query(`
      SELECT id, name, user_id FROM api_key
      WHERE org_id = organizations:metabob
    `);

    const keys = (apiKeysToFix[0] as any[]) || [];
    console.log(`Found ${keys.length} API keys to check`);

    for (const key of keys) {
      const currentUserId = Array.isArray(key.user_id) ? key.user_id[0] : key.user_id;
      if (currentUserId !== "users:kre88ea3i1vmuj1gd12a") {
        console.log(`  Updating ${key.name}: ${currentUserId} → users:kre88ea3i1vmuj1gd12a`);
        await db.query(
          `UPDATE $keyId SET user_id = users:kre88ea3i1vmuj1gd12a`,
          { keyId: key.id }
        );
      } else {
        console.log(`  ✓ ${key.name}: already correct`);
      }
    }

    // Step 3: Create org_members link
    console.log("\n=== Step 3: Create org_members Link ===");
    const existingMember = await db.query(`
      SELECT * FROM org_members
      WHERE org_id = organizations:metabob
        AND user_id = users:kre88ea3i1vmuj1gd12a
    `);

    if (existingMember[0] && (existingMember[0] as any[]).length > 0) {
      console.log("✓ org_members link already exists");
    } else {
      console.log("Creating org_members link...");
      const createMemberResult = await db.query(`
        CREATE org_members SET
          org_id = organizations:metabob,
          user_id = users:kre88ea3i1vmuj1gd12a,
          role = "service",
          created_at = time::now()
      `);
      console.log("✓ Created org_members link");
      console.log(JSON.stringify((createMemberResult[0] as any[])[0], null, 2));
    }

    // Verification
    console.log("\n=== Verification ===");

    const finalOrg = await db.query(`SELECT * FROM organizations:metabob`);
    console.log("\n✓ Organization:");
    console.log(JSON.stringify((finalOrg[0] as any[])[0], null, 2));

    const finalKeys = await db.query(`
      SELECT id, name, org_id, user_id, scopes FROM api_key
      WHERE org_id = organizations:metabob
    `);
    console.log("\n✓ API Keys:");
    console.log(JSON.stringify(finalKeys[0], null, 2));

    const finalMembers = await db.query(`
      SELECT * FROM org_members
      WHERE org_id = organizations:metabob
    `);
    console.log("\n✓ Org Members:");
    console.log(JSON.stringify(finalMembers[0], null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("✅ FIX COMPLETE");
    console.log("=".repeat(60));
    console.log("\nNext Steps:");
    console.log("1. Test authentication:");
    console.log('   curl -X GET https://activity.metabob.com/v2/activities/templates \\');
    console.log('     -H "Authorization: ApiKey mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5"');
    console.log("\n2. Update your local config:");
    console.log("   export METABOB_API_KEY=\"mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5\"");
    console.log("   export METABOB_ENDPOINT=\"https://activity.metabob.com\"");

  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
