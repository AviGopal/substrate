#!/usr/bin/env bun
/**
 * Create metabob org and generate test API keys
 */

import { Surreal } from "surrealdb";
import { execSync } from "child_process";

const SURREALDB_URL = "http://localhost:8000";
const IDENTITY_ENDPOINT = "https://identity.metabob.com";
const ACTIVITY_ENDPOINT = "https://activity.metabob.com";

// Get password from SOPS
const password = execSync(
  `sops -d repos/deployment/secrets/canary.secrets.yaml 2>/dev/null | awk '/^surrealdb:/{found=1} found && /^    password:/{print $2; exit}'`,
  { encoding: "utf-8" }
).trim();

const db = new Surreal();
await db.connect(SURREALDB_URL);
await db.signin({ username: "root", password });
await db.use({ namespace: "activity-system", database: "learning_loop" });

console.log("\n=== Creating Metabob Organization ===\n");

// Check if metabob org exists
const existing = await db.query<any>(
  `SELECT * FROM type::record("organizations", "metabob") LIMIT 1`
);

let orgId;
if (existing && existing[0] && existing[0].length > 0) {
  console.log("✓ Metabob org already exists");
  orgId = existing[0][0].id;
} else {
  // Create org with minimal fields using SQL
  // Note: org_id field expects string, not record reference
  const result = await db.query(
    `CREATE type::record("organizations", "metabob") SET
      org_id = "metabob",
      name = "Metabob",
      subscription_tier = "enterprise",
      created_at = time::now()`
  );
  console.log("✓ Created metabob org");
  orgId = "organizations:metabob";
}

// Use existing self@metabob.com user
const userId = "users:kre88ea3i1vmuj1gd12a";

// Check if user is already a member
const memberCheck = await db.query(
  `SELECT * FROM org_members WHERE org_id = $orgId AND user_id = $userId LIMIT 1`,
  { orgId, userId }
);

if (!memberCheck[0] || memberCheck[0].length === 0) {
  // Add user as admin member using SQL
  await db.query(
    `CREATE org_members SET
      org_id = type::record("organizations", "metabob"),
      user_id = type::record("users", "kre88ea3i1vmuj1gd12a"),
      role = "admin",
      created_at = time::now()`
  );
  console.log("✓ Added self@metabob.com as admin member");
} else {
  console.log("✓ self@metabob.com already a member");
}

await db.close();

console.log("\n=== Generating Test API Keys via Identity Vessel ===\n");

// Generate test key 1: Full access
const key1Response = await fetch(`${IDENTITY_ENDPOINT}/v1/keys/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    org_id: "metabob",
    user_id: userId,
    name: "Metabob Admin Development Key",
    scopes: [
      "activities:read",
      "activities:write",
      "templates:read",
      "templates:write",
    ],
    expires_in_days: 365,
  }),
});

const key1 = await key1Response.json();
console.log("✓ Generated Admin Development Key");
console.log(`  Key: ${key1.data.key}`);
console.log(`  Key ID: ${key1.data.keyId}`);
console.log(`  Expires: ${key1.data.expiresAt}\n`);

// Generate test key 2: Read-only
const key2Response = await fetch(`${IDENTITY_ENDPOINT}/v1/keys/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    org_id: "metabob",
    user_id: userId,
    name: "Metabob Read-Only Key",
    scopes: ["activities:read", "templates:read"],
    expires_in_days: 365,
  }),
});

const key2 = await key2Response.json();
console.log("✓ Generated Read-Only Key");
console.log(`  Key: ${key2.data.key}`);
console.log(`  Key ID: ${key2.data.keyId}`);
console.log(`  Expires: ${key2.data.expiresAt}\n`);

console.log("=".repeat(60));
console.log("TEST API KEYS (SAVE THESE)");
console.log("=".repeat(60));
console.log(`\nAdmin Key: ${key1.data.key}`);
console.log(`Read-Only Key: ${key2.data.key}`);

console.log(`\n~/.metabob/config.json snippet:`);
console.log(
  JSON.stringify(
    {
      metabob: {
        apiKey: key1.data.key,
        endpoint: ACTIVITY_ENDPOINT,
      },
    },
    null,
    2
  )
);

console.log(`\nVerify keys:`);
console.log(
  `  curl -H "Authorization: ApiKey ${key1.data.key}" ${ACTIVITY_ENDPOINT}/v2/activities/templates`
);
