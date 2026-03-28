#!/usr/bin/env bun
/**
 * Verify Impulse Storage Fix
 *
 * Tests that the SurrealDB datetime coercion fix allows impulses to be stored.
 * This was previously failing with:
 * "Couldn't coerce value for field created_at: Expected datetime but found '2026-03-28T18:27:58.184Z'"
 */

const API_ENDPOINT = process.env.ACTIVITY_API_ENDPOINT || "http://activity.metabob.local";
const INSTANCE_ID = "minibob-local-001";
const API_KEY = "test-api-key-123";
const ORG_ID = "metabob_internal";

async function signIn() {
  console.log("🔐 Authenticating as test instance...");
  const response = await fetch(`${API_ENDPOINT}/v2/auth/minibob/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instance_id: INSTANCE_ID,
      api_key: API_KEY
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentication failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`✓ Authenticated (org: ${data.org_id})`);
  return data.token;
}

async function storeImpulse(token: string) {
  console.log("\n📝 Storing test impulse...");

  const impulseData = {
    impulse_id: `test-datetime-fix-${Date.now()}`,
    // org_id and project_id come from $auth context (null uses defaults)
    project_id: null,
    impulse_data: {
      id: `test-datetime-fix-${Date.now()}`,
      type: "memo",
      pointer: {
        type: "memo",
        content: "Testing SurrealDB datetime fix"
      },
      budget: 1000,
      priority: 2,
      metadata: {
        tags: ["test", "datetime-fix"],
        content: "Testing that time::now() works in SurrealDB",
        shape: "memo"
      }
    }
  };

  const response = await fetch(`${API_ENDPOINT}/v2/impulses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(impulseData)
  });

  const responseText = await response.text();

  console.log(`Status: ${response.status}`);
  console.log(`Response: ${responseText}`);

  if (!response.ok) {
    throw new Error(`Failed to store impulse: ${response.status} - ${responseText}`);
  }

  try {
    const data = JSON.parse(responseText);
    console.log("✓ Impulse stored successfully!");
    console.log(`  - impulse_id: ${data.impulse_id}`);
    if (data.created_at) {
      console.log(`  - created_at: ${data.created_at}`);
      console.log("✅ SurrealDB datetime field populated correctly!");
    }
    return data;
  } catch (e) {
    console.log("⚠️  Response is not JSON, but status was OK");
    return true;
  }
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TESTING IMPULSE STORAGE DATETIME FIX");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`API Endpoint: ${API_ENDPOINT}\n`);

  try {
    // Step 1: Authenticate
    const token = await signIn();

    // Step 2: Store impulse
    await storeImpulse(token);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ ALL TESTS PASSED - DATETIME FIX WORKING!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(0);
  } catch (error) {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ TEST FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(error);
    console.error("");
    process.exit(1);
  }
}

main();
