#!/usr/bin/env bun
/**
 * Commission Organizations, Users, and API Keys for Canary Environment
 *
 * This script creates test organizations, users, and API keys for the canary
 * environment using the identity-vessel API for key management.
 *
 * Usage:
 *   # Create a new organization with admin user and test API keys
 *   bun run scripts/commission-canary.ts org create --name "Test Org" --admin-email "admin@test.com"
 *
 *   # Create an API key for a user via identity-vessel
 *   bun run scripts/commission-canary.ts apikey create --org-id "metabob" --user-id "users:xyz" --name "Test Key"
 *
 *   # Verify API key access to org-scoped data
 *   bun run scripts/commission-canary.ts apikey verify --api-key "mb_test-..."
 *
 *   # List all organizations
 *   bun run scripts/commission-canary.ts org list
 *
 *   # List users and their org memberships
 *   bun run scripts/commission-canary.ts user list
 *
 * Environment Variables:
 *   CANARY_SURREALDB_URL      - SurrealDB URL (default: https://surql.metabob.com)
 *   CANARY_SURREALDB_PASSWORD - SurrealDB root password (required, or uses SOPS)
 *   IDENTITY_ENDPOINT         - Identity vessel endpoint (default: https://identity.metabob.com)
 *   ACTIVITY_ENDPOINT         - Activity API endpoint (default: https://activity.metabob.com)
 */

import { Surreal } from "surrealdb";
import { parseArgs } from "util";
import { execSync } from "child_process";
import * as path from "path";

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  surrealdb: {
    // Canary SurrealDB is accessed via internal K8s service or via kubectl port-forward
    // For external access, you need to port-forward: kubectl port-forward svc/surrealdb 8000:8000 -n activity-system
    url: process.env.CANARY_SURREALDB_URL || "http://localhost:8000",
    namespace: "activity-system",
    database: "learning_loop",
    username: "root",
    // Password will be loaded from SOPS secrets if not provided
    password: process.env.CANARY_SURREALDB_PASSWORD || "",
  },
  identity: {
    endpoint:
      process.env.IDENTITY_ENDPOINT || "https://identity.metabob.com",
  },
  activity: {
    endpoint:
      process.env.ACTIVITY_ENDPOINT || "https://activity.metabob.com",
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Load password from SOPS encrypted secrets if not provided via env var
 */
function loadSopsSecret(): string {
  try {
    // Use process.cwd() since script is run from repo root
    const secretsPath = path.join(
      process.cwd(),
      "repos/deployment/secrets/canary.secrets.yaml"
    );
    // The YAML structure has surrealdb.password - extract it with awk
    const result = execSync(
      `sops -d ${secretsPath} 2>/dev/null | awk '/^surrealdb:/{found=1} found && /^    password:/{print $2; exit}'`,
      { encoding: "utf-8" }
    ).trim();
    return result || "";
  } catch (e) {
    return "";
  }
}

/**
 * Generate API key via identity-vessel
 */
async function generateApiKeyViaIdentity(options: {
  orgId: string;
  userId: string;
  name: string;
  scopes: string[];
  expiresInDays?: number;
}): Promise<{ key: string; keyId: string; prefix: string; expiresAt?: string }> {
  const { orgId, userId, name, scopes, expiresInDays = 365 } = options;

  const response = await fetch(`${CONFIG.identity.endpoint}/v1/keys/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org_id: orgId,
      user_id: userId,
      name,
      scopes,
      expires_in_days: expiresInDays,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate API key: ${response.status} ${error}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Generate a random password
 */
function generatePassword(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < 24; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

/**
 * Create a slug from a name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// =============================================================================
// Database Connection
// =============================================================================

async function getDbConnection(): Promise<Surreal> {
  const db = new Surreal();

  // Try to get password from env var or SOPS
  let password = CONFIG.surrealdb.password;
  if (!password) {
    password = loadSopsSecret();
  }
  if (!password) {
    console.error(
      "Error: No SurrealDB password found. Set CANARY_SURREALDB_PASSWORD or configure SOPS."
    );
    console.error(
      "\nTo port-forward to canary SurrealDB (if you have kubectl access):"
    );
    console.error(
      "  kubectl port-forward svc/surrealdb 8000:8000 -n activity-system"
    );
    process.exit(1);
  }

  console.log(`Connecting to ${CONFIG.surrealdb.url}...`);
  await db.connect(CONFIG.surrealdb.url);

  console.log(`Signing in as ${CONFIG.surrealdb.username}...`);
  await db.signin({
    username: CONFIG.surrealdb.username,
    password,
  });

  console.log(
    `Using namespace: ${CONFIG.surrealdb.namespace}, database: ${CONFIG.surrealdb.database}`
  );
  await db.use({
    namespace: CONFIG.surrealdb.namespace,
    database: CONFIG.surrealdb.database,
  });

  return db;
}

// =============================================================================
// Organization Commands
// =============================================================================

async function createOrganization(
  db: Surreal,
  options: { name: string; adminEmail: string; tier?: string }
): Promise<void> {
  const { name, adminEmail, tier = "starter" } = options;
  const orgId = slugify(name);

  console.log(`\n=== Creating Organization: ${name} ===`);
  console.log(`  Org ID: ${orgId}`);
  console.log(`  Tier: ${tier}`);
  console.log(`  Admin Email: ${adminEmail}`);

  // Check if org already exists (ID format: organizations:slug)
  const existingOrg = await db.query(
    `SELECT * FROM type::record("organizations", $orgId) LIMIT 1`,
    { orgId }
  );
  if (existingOrg[0] && (existingOrg[0] as any[]).length > 0) {
    console.log(`\n⚠️  Organization '${orgId}' already exists. Skipping creation.`);
    console.log(JSON.stringify((existingOrg[0] as any[])[0], null, 2));
    return;
  }

  // Create organization with specific ID
  const orgResult = await db.query(
    `CREATE type::record("organizations", $orgId) SET
      name = $name,
      subscription_tier = $tier,
      created_at = time::now()`,
    { orgId, name, tier }
  );
  console.log(`\n✓ Created organization:`);
  console.log(JSON.stringify((orgResult[0] as any[])[0], null, 2));

  // Create admin user (schema: email, name, password_hash, is_active, email_verified)
  const adminPassword = generatePassword();
  const passwordHash = await db.query(
    `RETURN crypto::argon2::generate($password)`,
    { password: adminPassword }
  );

  const userResult = await db.query(
    `CREATE users SET
      email = $email,
      name = $name,
      password_hash = $passwordHash,
      is_active = true,
      email_verified = true,
      created_at = time::now()`,
    {
      email: adminEmail,
      name: adminEmail.split("@")[0],
      passwordHash: passwordHash[0],
    }
  );
  const newUser = (userResult[0] as any[])[0];
  console.log(`\n✓ Created admin user:`);
  console.log(JSON.stringify(newUser, null, 2));

  // Create org_members link to associate user with org
  await db.query(
    `CREATE org_members SET
      org_id = $orgId,
      user_id = $userId,
      role = "admin",
      created_at = time::now()`,
    {
      orgId: `organizations:${orgId}`,
      userId: newUser.id,
    }
  );
  console.log(`\n✓ Added user as admin member of organization`);

  // Generate test API keys via identity-vessel
  console.log(`\n=== Generating Test API Keys ===`);

  const testKey1 = await generateApiKeyViaIdentity({
    orgId,
    userId: newUser.id,
    name: `${orgId} - Admin Development Key`,
    scopes: ["activities:read", "activities:write", "templates:read", "templates:write"],
  });
  console.log(`\n✓ Generated admin development key`);

  const testKey2 = await generateApiKeyViaIdentity({
    orgId,
    userId: newUser.id,
    name: `${orgId} - Read-Only Key`,
    scopes: ["activities:read", "templates:read"],
  });
  console.log(`✓ Generated read-only key`);

  // Print credentials
  console.log(`\n${"=".repeat(60)}`);
  console.log("CREDENTIALS (SAVE THESE - THEY WON'T BE SHOWN AGAIN!)");
  console.log("=".repeat(60));
  console.log(`\nOrganization ID: ${orgId}`);
  console.log(`Admin Email: ${adminEmail}`);
  console.log(`Admin Password: ${adminPassword}`);
  console.log(`\nUser ID: ${newUser.id}`);

  console.log(`\n--- API Key 1: Admin Development ---`);
  console.log(`Name: ${testKey1.name || "Admin Development Key"}`);
  console.log(`Key: ${testKey1.key}`);
  console.log(`Scopes: activities:*, templates:*`);
  console.log(`Expires: ${testKey1.expiresAt || "Never"}`);

  console.log(`\n--- API Key 2: Read-Only ---`);
  console.log(`Name: ${testKey2.name || "Read-Only Key"}`);
  console.log(`Key: ${testKey2.key}`);
  console.log(`Scopes: activities:read, templates:read`);
  console.log(`Expires: ${testKey2.expiresAt || "Never"}`);

  console.log(`\n~/.metabob/config.json snippet:`);
  console.log(
    JSON.stringify(
      {
        metabob: {
          apiKey: testKey1.key,
          endpoint: CONFIG.activity.endpoint,
        },
        vessels: {
          metabob: { endpoint: CONFIG.activity.endpoint },
          identity: { endpoint: CONFIG.identity.endpoint },
        },
      },
      null,
      2
    )
  );

  console.log(`\nTest API key access:`);
  console.log(`  curl -H "Authorization: ApiKey ${testKey1.key}" ${CONFIG.activity.endpoint}/v2/activities/templates`);
}

async function listOrganizations(db: Surreal): Promise<void> {
  console.log(`\n=== Organizations ===`);
  const result = await db.query(
    `SELECT id, name, subscription_tier, created_at FROM organizations ORDER BY created_at DESC`
  );
  const orgs = (result[0] as any[]) || [];
  if (orgs.length === 0) {
    console.log("No organizations found.");
    return;
  }
  for (const org of orgs) {
    // Extract org slug from id (e.g., "organizations:metabob" -> "metabob")
    const orgSlug = String(org.id).replace("organizations:", "");
    const tier = org.subscription_tier || "starter";
    console.log(
      `  - ${orgSlug}: ${org.name} (${tier}) - created ${org.created_at}`
    );
  }
}

// =============================================================================
// Member Management Commands
// =============================================================================

async function listOrgMembers(db: Surreal, orgId: string): Promise<void> {
  console.log(`\n=== Organization Members: ${orgId} ===`);
  const result = await db.query(
    `SELECT
      org_members.user_id as user_id,
      org_members.role as role,
      org_members.created_at as joined_at,
      (SELECT email, name, is_active FROM $parent.user_id)[0] as user
    FROM org_members
    WHERE org_id = $orgId
    ORDER BY created_at ASC`,
    { orgId: orgId.startsWith("organizations:") ? orgId : `organizations:${orgId}` }
  );

  const members = (result[0] as any[]) || [];
  if (members.length === 0) {
    console.log(`No members found for org: ${orgId}`);
    return;
  }

  for (const member of members) {
    const user = member.user || {};
    const status = user.is_active ? "✓" : "✗";
    console.log(`  ${status} ${user.email || member.user_id} - ${member.role} (joined ${member.joined_at})`);
  }
}

// =============================================================================
// API Key Commands
// =============================================================================

async function createApiKey(
  db: Surreal,
  options: { orgId: string; userId: string; name: string; scopes?: string[]; expiresInDays?: number }
): Promise<void> {
  const { orgId, userId, name, scopes = ["activities:read", "activities:write"], expiresInDays = 365 } = options;

  console.log(`\n=== Creating API Key via Identity Vessel ===`);
  console.log(`  Name: ${name}`);
  console.log(`  Org ID: ${orgId}`);
  console.log(`  User ID: ${userId}`);
  console.log(`  Scopes: ${scopes.join(", ")}`);
  console.log(`  Expires in: ${expiresInDays} days`);

  // Verify user exists and is member of org
  const memberCheck = await db.query(
    `SELECT * FROM org_members WHERE org_id = $orgId AND user_id = $userId LIMIT 1`,
    {
      orgId: orgId.startsWith("organizations:") ? orgId : `organizations:${orgId}`,
      userId,
    }
  );

  if (!memberCheck[0] || (memberCheck[0] as any[]).length === 0) {
    console.error(`\n⚠️  User ${userId} is not a member of org ${orgId}`);
    console.error(`Please add the user to the org first.`);
    process.exit(1);
  }

  // Generate API key via identity-vessel
  const keyData = await generateApiKeyViaIdentity({
    orgId: orgId.replace("organizations:", ""),
    userId,
    name,
    scopes,
    expiresInDays,
  });

  console.log(`\n✓ Created API key via identity-vessel`);

  // Print credentials
  console.log(`\n${"=".repeat(60)}`);
  console.log("API KEY (SAVE THIS - IT WON'T BE SHOWN AGAIN!)");
  console.log("=".repeat(60));
  console.log(`Name: ${name}`);
  console.log(`Key ID: ${keyData.keyId}`);
  console.log(`API Key: ${keyData.key}`);
  console.log(`Prefix: ${keyData.prefix}`);
  console.log(`Scopes: ${scopes.join(", ")}`);
  console.log(`Expires: ${keyData.expiresAt || "Never"}`);
  console.log(`\nUsage:`);
  console.log(
    `  curl -H "Authorization: ApiKey ${keyData.key}" ${CONFIG.activity.endpoint}/v2/activities/templates`
  );
  console.log(`\nVerify key:`);
  console.log(
    `  bun run scripts/commission-canary.ts apikey verify --api-key "${keyData.key}"`
  );
}

async function verifyApiKey(apiKey: string): Promise<void> {
  console.log(`\n=== Verifying API Key ===`);
  console.log(`Key: ${apiKey.substring(0, 20)}...`);

  // Test 1: Validate key format via identity-vessel
  console.log(`\n1. Validating key format...`);
  const validateResponse = await fetch(`${CONFIG.identity.endpoint}/v1/keys/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!validateResponse.ok) {
    console.error(`✗ Validation failed: ${validateResponse.status}`);
    const error = await validateResponse.text();
    console.error(error);
    process.exit(1);
  }

  const validationResult = await validateResponse.json();
  console.log(`✓ Key is valid`);
  console.log(`  Org ID: ${validationResult.org_id}`);
  console.log(`  User ID: ${validationResult.user_id}`);
  console.log(`  Key ID: ${validationResult.key_id}`);

  // Test 2: Access org-scoped data (activity templates)
  console.log(`\n2. Testing org-scoped data access...`);
  const templatesResponse = await fetch(`${CONFIG.activity.endpoint}/v2/activities/templates`, {
    headers: { Authorization: `ApiKey ${apiKey}` },
  });

  if (!templatesResponse.ok) {
    console.error(`✗ Failed to access templates: ${templatesResponse.status}`);
    const error = await templatesResponse.text();
    console.error(error);
    process.exit(1);
  }

  const templates = await templatesResponse.json();
  console.log(`✓ Successfully accessed activity templates`);
  console.log(`  Templates visible: ${templates.length || 0}`);

  // Test 3: Health check
  console.log(`\n3. Checking activity API health...`);
  const healthResponse = await fetch(`${CONFIG.activity.endpoint}/health`);
  const health = await healthResponse.json();
  console.log(`✓ Activity API is healthy`);
  console.log(`  Service: ${health.service}`);
  console.log(`  Version: ${health.version}`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✓ API key verification successful`);
  console.log(`${"=".repeat(60)}`);
}

async function listApiKeys(db: Surreal, orgId?: string): Promise<void> {
  console.log(`\n=== API Keys (from SurrealDB) ===`);
  let query = `SELECT id, name, org_id, user_id, scopes, is_active, created_at, expires_at FROM api_key ORDER BY created_at DESC`;
  let params: Record<string, any> = {};
  if (orgId) {
    query = `SELECT id, name, org_id, user_id, scopes, is_active, created_at, expires_at FROM api_key WHERE org_id = $orgId ORDER BY created_at DESC`;
    params = { orgId: orgId.startsWith("organizations:") ? orgId : `organizations:${orgId}` };
  }
  const result = await db.query(query, params);
  const keys = (result[0] as any[]) || [];
  if (keys.length === 0) {
    console.log("No API keys found.");
    return;
  }
  for (const key of keys) {
    const status = key.is_active ? "✓" : "✗";
    const expires = key.expires_at ? ` (expires ${key.expires_at})` : "";
    console.log(
      `  ${status} ${key.name}: ${key.org_id} / ${key.user_id} [${(key.scopes || []).join(",")}]${expires}`
    );
  }

  console.log(`\nNote: Keys are generated via identity-vessel and stored with metadata only.`);
  console.log(`The actual key values are not retrievable after generation.`);
}

// =============================================================================
// User Commands
// =============================================================================

async function listUsers(db: Surreal, orgId?: string): Promise<void> {
  console.log(`\n=== Users ===`);

  if (orgId) {
    // List users for specific org
    const orgIdFull = orgId.startsWith("organizations:") ? orgId : `organizations:${orgId}`;
    const result = await db.query(
      `SELECT
        user_id,
        role,
        (SELECT email, name, is_active, created_at FROM $parent.user_id)[0] as user
      FROM org_members
      WHERE org_id = $orgId
      ORDER BY created_at DESC`,
      { orgId: orgIdFull }
    );
    const members = (result[0] as any[]) || [];
    if (members.length === 0) {
      console.log(`No users found for org: ${orgId}`);
      return;
    }
    for (const member of members) {
      const user = member.user || {};
      const status = user.is_active ? "✓" : "✗";
      console.log(`  ${status} ${user.email || member.user_id}: ${user.name || "N/A"} (${member.role})`);
    }
  } else {
    // List all users with their org memberships
    const query = `SELECT id, email, name, is_active, created_at FROM users ORDER BY created_at DESC`;
    const result = await db.query(query);
    const users = (result[0] as any[]) || [];
    if (users.length === 0) {
      console.log("No users found.");
      return;
    }

    for (const user of users) {
      const status = user.is_active ? "✓" : "✗";
      console.log(`  ${status} ${user.email}: ${user.name} (${user.id})`);

      // Get org memberships
      const memberships = await db.query(
        `SELECT org_id, role FROM org_members WHERE user_id = $userId`,
        { userId: user.id }
      );
      const orgs = (memberships[0] as any[]) || [];
      if (orgs.length > 0) {
        for (const org of orgs) {
          console.log(`      └─ ${org.org_id} (${org.role})`);
        }
      }
    }
  }
}

// =============================================================================
// Main CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Commission Organizations, Users, and API Keys for Canary Environment

Usage:
  bun run scripts/commission-canary.ts <resource> <command> [options]

Resources:
  org       Organization management
  apikey    API key management (via identity-vessel)
  user      User management
  member    Organization membership management

Commands:
  # Organizations
  org create --name "Name" --admin-email "email@example.com" [--tier starter|pro|enterprise]
    Creates org, admin user, org_members link, and 2 test API keys

  org list
    Lists all organizations

  # API Keys (via identity-vessel)
  apikey create --org-id "metabob" --user-id "users:xyz" --name "Key Name" \\
    [--scopes "activities:read,activities:write"] [--expires-in-days 365]
    Generates API key via identity-vessel with human-readable format

  apikey verify --api-key "mb_test-..."
    Validates API key and tests org-scoped data access

  apikey list [--org-id "org_id"]
    Lists API key metadata from SurrealDB

  # Users
  user list [--org-id "org_id"]
    Lists users (all or for specific org) with org memberships

  # Members
  member list --org-id "org_id"
    Lists all members of an organization

Environment Variables:
  CANARY_SURREALDB_URL      - SurrealDB URL (default: http://localhost:8000)
  CANARY_SURREALDB_PASSWORD - SurrealDB root password (or loaded from SOPS)
  IDENTITY_ENDPOINT         - Identity vessel (default: https://identity.metabob.com)
  ACTIVITY_ENDPOINT         - Activity API (default: https://activity.metabob.com)

Notes:
  - For external access to canary SurrealDB, you need kubectl port-forward:
    kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

  - API keys are now generated via identity-vessel using HMAC-signed format:
    mb_test-{org_id}-{user_id}-{key_id}-{signature}

  - The script will attempt to load the password from SOPS-encrypted secrets
    at repos/deployment/secrets/canary.secrets.yaml if not provided via env var.

Examples:
  # Create test org with 2 API keys
  bun run scripts/commission-canary.ts org create --name "Test Org" --admin-email "test@metabob.com"

  # Create additional API key
  bun run scripts/commission-canary.ts apikey create --org-id "metabob" --user-id "users:xyz" --name "Dev Key"

  # Verify API key works
  bun run scripts/commission-canary.ts apikey verify --api-key "mb_test-metabob-..."

  # List organization members
  bun run scripts/commission-canary.ts member list --org-id "metabob"
`);
    process.exit(0);
  }

  const resource = args[0];
  const command = args[1];

  const db = await getDbConnection();

  try {
    switch (resource) {
      case "org":
        switch (command) {
          case "create": {
            const { values } = parseArgs({
              args: args.slice(2),
              options: {
                name: { type: "string" },
                "admin-email": { type: "string" },
                tier: { type: "string", default: "starter" },
              },
            });
            if (!values.name || !values["admin-email"]) {
              console.error("Error: --name and --admin-email are required");
              process.exit(1);
            }
            await createOrganization(db, {
              name: values.name,
              adminEmail: values["admin-email"],
              tier: values.tier,
            });
            break;
          }
          case "list":
            await listOrganizations(db);
            break;
          default:
            console.error(`Unknown org command: ${command}`);
            process.exit(1);
        }
        break;

      case "member":
        switch (command) {
          case "list": {
            const { values } = parseArgs({
              args: args.slice(2),
              options: {
                "org-id": { type: "string" },
              },
            });
            if (!values["org-id"]) {
              console.error("Error: --org-id is required");
              process.exit(1);
            }
            await listOrgMembers(db, values["org-id"]);
            break;
          }
          default:
            console.error(`Unknown member command: ${command}`);
            process.exit(1);
        }
        break;

      case "apikey":
        switch (command) {
          case "create": {
            const { values } = parseArgs({
              args: args.slice(2),
              options: {
                "org-id": { type: "string" },
                "user-id": { type: "string" },
                name: { type: "string" },
                scopes: { type: "string", default: "activities:read,activities:write" },
                "expires-in-days": { type: "string", default: "365" },
              },
            });
            if (!values["org-id"] || !values["user-id"] || !values.name) {
              console.error(
                "Error: --org-id, --user-id, and --name are required"
              );
              process.exit(1);
            }
            await createApiKey(db, {
              orgId: values["org-id"],
              userId: values["user-id"],
              name: values.name,
              scopes: values.scopes?.split(","),
              expiresInDays: parseInt(values["expires-in-days"] || "365", 10),
            });
            break;
          }
          case "verify": {
            const { values } = parseArgs({
              args: args.slice(2),
              options: {
                "api-key": { type: "string" },
              },
            });
            if (!values["api-key"]) {
              console.error("Error: --api-key is required");
              process.exit(1);
            }
            await verifyApiKey(values["api-key"]);
            break;
          }
          case "list": {
            const { values } = parseArgs({
              args: args.slice(2),
              options: {
                "org-id": { type: "string" },
              },
            });
            await listApiKeys(db, values["org-id"]);
            break;
          }
          default:
            console.error(`Unknown apikey command: ${command}`);
            process.exit(1);
        }
        break;

      case "user":
        switch (command) {
          case "list": {
            const { values } = parseArgs({
              args: args.slice(2),
              options: {
                "org-id": { type: "string" },
              },
            });
            await listUsers(db, values["org-id"]);
            break;
          }
          default:
            console.error(`Unknown user command: ${command}`);
            process.exit(1);
        }
        break;

      default:
        console.error(`Unknown resource: ${resource}`);
        process.exit(1);
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
