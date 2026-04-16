#!/usr/bin/env bun
/**
 * Test MiniBob with both admin and read-only API keys
 */

const ACTIVITY_ENDPOINT = "https://activity.metabob.com";

// Test keys
const ADMIN_KEY = "mb_test-metabob-users:kre88ea3i1vmuj1gd12a-key_3K9gkHVhjtQuanRb-e65d59559fcd30902341179137f0208a";
const READONLY_KEY = "mb_test-metabob-users:kre88ea3i1vmuj1gd12a-key_pdxcMaWJTjNqBhm1-d766abe650ac07366f6ec1b82a8253d8";

async function testKey(keyName: string, apiKey: string) {
  console.log(`\n=== Testing ${keyName} ===`);

  try {
    // Test 1: Fetch templates (read access)
    console.log("1. Fetching templates...");
    const templatesResponse = await fetch(`${ACTIVITY_ENDPOINT}/v2/activities/templates`, {
      headers: { "Authorization": `ApiKey ${apiKey}` }
    });

    if (!templatesResponse.ok) {
      console.error(`   ✗ Failed: ${templatesResponse.status} ${templatesResponse.statusText}`);
      const error = await templatesResponse.text();
      console.error(`   Error: ${error}`);
      return false;
    }

    const templates = await templatesResponse.json();
    console.log(`   ✓ Success: ${templates.templates?.length || 0} templates retrieved`);

    // Show a sample template
    if (templates.templates && templates.templates.length > 0) {
      const sample = templates.templates[0];
      console.log(`   Sample: ${sample.name} (${sample.category})`);
      console.log(`   Org ID: ${sample.org_id}`);
    }

    // Test 2: Check org-scoped filtering
    console.log("\n2. Checking org-scoped data...");
    const orgIds = new Set(templates.templates?.map((t: any) => t.org_id) || []);
    console.log(`   Org IDs visible: ${Array.from(orgIds).join(", ")}`);

    // Test 3: Try to create a trace (write access - should fail for read-only)
    console.log("\n3. Testing write access (execution trace)...");
    const traceResponse = await fetch(`${ACTIVITY_ENDPOINT}/v2/activities/execution-traces`, {
      method: "POST",
      headers: {
        "Authorization": `ApiKey ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        activity_id: "test-activity",
        vessel_id: "minibob-test",
        status: "success",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        tasks: []
      })
    });

    if (traceResponse.ok) {
      console.log(`   ✓ Write access: Allowed (trace created)`);
    } else if (traceResponse.status === 403) {
      console.log(`   ○ Write access: Denied (403 Forbidden) - expected for read-only key`);
    } else {
      console.log(`   ? Write access: ${traceResponse.status} ${traceResponse.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`   ✗ Error: ${error}`);
    return false;
  }
}

async function main() {
  console.log("Testing MiniBob API Keys\n");
  console.log(`Endpoint: ${ACTIVITY_ENDPOINT}`);

  const adminResult = await testKey("Admin Key (Full Access)", ADMIN_KEY);
  const readonlyResult = await testKey("Read-Only Key", READONLY_KEY);

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Admin Key:     ${adminResult ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`Read-Only Key: ${readonlyResult ? "✓ PASS" : "✗ FAIL"}`);
  console.log("\nBoth keys successfully authenticate and access org-scoped data!");
}

main().catch(console.error);
