#!/usr/bin/env bun
/**
 * Generate API key for metabob org
 */

const IDENTITY_ENDPOINT = "https://identity.metabob.com";

async function generateKey(name: string, scopes: string[]) {
  console.log(`\n=== Generating: ${name} ===`);
  console.log(`Scopes: ${scopes.join(", ")}`);

  const response = await fetch(`${IDENTITY_ENDPOINT}/v1/keys/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org_id: "metabob",
      user_id: "users:kre88ea3i1vmuj1gd12a",
      name,
      scopes,
      expires_in_days: 365,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed: ${response.status} ${error}`);
    return null;
  }

  const result = await response.json();
  return result.data;
}

// Generate keys
const keys = [
  {
    name: "MiniBob Production Key",
    scopes: ["activities:read", "activities:write", "templates:read", "templates:write"],
  },
  {
    name: "CI/CD Integration Key",
    scopes: ["activities:read", "activities:write", "templates:read"],
  },
  {
    name: "Dashboard View Key",
    scopes: ["activities:read", "templates:read"],
  },
];

console.log("Generating API Keys for Metabob Org\n");

for (const keyConfig of keys) {
  const key = await generateKey(keyConfig.name, keyConfig.scopes);
  if (key) {
    console.log(`\n✓ Generated successfully`);
    console.log(`Key: ${key.key}`);
    console.log(`Key ID: ${key.keyId}`);
    console.log(`Expires: ${key.expiresAt || "Never"}`);
    console.log();
  }
}

console.log("=".repeat(60));
console.log("All keys generated! Save these securely.");
console.log("=".repeat(60));
