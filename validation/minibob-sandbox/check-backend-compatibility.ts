#!/usr/bin/env bun

/**
 * Backend Compatibility Checker
 *
 * Validates connection to activity.metabob.com and checks:
 * - API endpoint availability
 * - Authentication
 * - Required endpoints
 * - Response format compatibility
 */

const BACKEND_ENDPOINT = process.env.METABOB_ENDPOINT || "https://activity.metabob.com";
const API_KEY = process.env.METABOB_API_KEY;

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  details?: unknown;
}

const results: CheckResult[] = [];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function pass(name: string, message: string, details?: unknown) {
  results.push({ name, status: "pass", message, details });
  console.log(`✓ ${name}: ${message}`);
}

function fail(name: string, message: string, details?: unknown) {
  results.push({ name, status: "fail", message, details });
  console.error(`✗ ${name}: ${message}`);
}

function warn(name: string, message: string, details?: unknown) {
  results.push({ name, status: "warn", message, details });
  console.warn(`⚠ ${name}: ${message}`);
}

async function checkEndpoint(
  name: string,
  path: string,
  method: string = "GET",
  requireAuth: boolean = false
): Promise<Response | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (requireAuth && API_KEY) {
      headers["Authorization"] = `ApiKey ${API_KEY}`;
    }

    const response = await fetch(`${BACKEND_ENDPOINT}${path}`, {
      method,
      headers,
      signal: AbortSignal.timeout(5000)
    });

    return response;
  } catch (error) {
    fail(name, `Request failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// =============================================================================
// CHECK 1: ENVIRONMENT
// =============================================================================

console.log("\n=== ENVIRONMENT ===\n");

if (!API_KEY) {
  warn("API Key", "METABOB_API_KEY not set (some tests will be skipped)");
} else {
  pass("API Key", "Found in environment");
}

console.log(`Backend Endpoint: ${BACKEND_ENDPOINT}`);

// =============================================================================
// CHECK 2: CONNECTIVITY
// =============================================================================

console.log("\n=== CONNECTIVITY ===\n");

const healthResponse = await checkEndpoint("Health Check", "/health", "GET", false);

if (healthResponse) {
  if (healthResponse.ok) {
    try {
      const data = await healthResponse.json();
      pass("Health Endpoint", `Backend is healthy`, data);
    } catch (e) {
      warn("Health Endpoint", "Response not JSON");
    }
  } else {
    fail("Health Endpoint", `HTTP ${healthResponse.status}: ${healthResponse.statusText}`);
  }
}

// =============================================================================
// CHECK 3: AUTHENTICATION
// =============================================================================

console.log("\n=== AUTHENTICATION ===\n");

if (API_KEY) {
  const authResponse = await checkEndpoint(
    "Authentication",
    "/v2/activities/templates",
    "GET",
    true
  );

  if (authResponse) {
    if (authResponse.ok) {
      pass("Authentication", "API key accepted");
    } else if (authResponse.status === 401) {
      fail("Authentication", "API key rejected (401 Unauthorized)");
    } else {
      warn("Authentication", `Unexpected status: ${authResponse.status}`);
    }
  }
} else {
  warn("Authentication", "Skipped (no API key)");
}

// =============================================================================
// CHECK 4: REQUIRED ENDPOINTS
// =============================================================================

console.log("\n=== REQUIRED ENDPOINTS ===\n");

const requiredEndpoints = [
  { path: "/v2/activities/recommend", method: "POST", name: "Thompson Sampling" },
  { path: "/v2/activities/execution-traces", method: "POST", name: "Trace Submission" },
  { path: "/v2/activities/composition", method: "POST", name: "Composition Edges" },
  { path: "/v2/impulses/resolve", method: "POST", name: "Impulse Resolution" },
  { path: "/v2/activities/templates", method: "GET", name: "Template List" },
  { path: "/v2/activities/impulse-relevance", method: "POST", name: "Impulse Relevance" },
  { path: "/v2/activities/tool-usage", method: "POST", name: "Tool Usage" }
];

for (const endpoint of requiredEndpoints) {
  if (!API_KEY && endpoint.method !== "GET") {
    warn(endpoint.name, `Skipped (requires auth)`);
    continue;
  }

  const response = await checkEndpoint(
    endpoint.name,
    endpoint.path,
    endpoint.method,
    endpoint.method !== "GET"
  );

  if (response) {
    if (response.ok || response.status === 400 || response.status === 422) {
      // 400/422 expected for POST without body
      pass(endpoint.name, `Endpoint exists (${endpoint.method} ${endpoint.path})`);
    } else if (response.status === 404) {
      fail(endpoint.name, `Endpoint not found (404)`);
    } else if (response.status === 401) {
      warn(endpoint.name, `Authentication required`);
    } else {
      warn(endpoint.name, `Unexpected status: ${response.status}`);
    }
  }
}

// =============================================================================
// CHECK 5: RESPONSE FORMAT VALIDATION
// =============================================================================

console.log("\n=== RESPONSE FORMAT ===\n");

if (API_KEY) {
  // Test template list format
  const templatesResponse = await checkEndpoint(
    "Template Format",
    "/v2/activities/templates?limit=1",
    "GET",
    true
  );

  if (templatesResponse?.ok) {
    try {
      const data = await templatesResponse.json();

      if (Array.isArray(data.templates)) {
        pass("Template Format", "Valid template array");

        if (data.templates.length > 0) {
          const template = data.templates[0];
          const hasRequiredFields = template.id && template.name && template.tasks;

          if (hasRequiredFields) {
            pass("Template Schema", "Contains required fields (id, name, tasks)");
          } else {
            fail("Template Schema", "Missing required fields");
          }
        }
      } else {
        fail("Template Format", "Response not in expected format");
      }
    } catch (e) {
      fail("Template Format", "Failed to parse response");
    }
  }

  // Test recommendation format
  const recResponse = await checkEndpoint(
    "Recommendation Format",
    "/v2/activities/recommend",
    "POST",
    true
  );

  if (recResponse) {
    if (recResponse.status === 400 || recResponse.status === 422) {
      pass("Recommendation Format", "Endpoint exists (requires body)");
    } else if (recResponse.ok) {
      try {
        const data = await recResponse.json();
        if (Array.isArray(data.recommendations)) {
          pass("Recommendation Format", "Valid recommendation array");
        }
      } catch (e) {
        warn("Recommendation Format", "Response not JSON");
      }
    }
  }
}

// =============================================================================
// CHECK 6: VERSION COMPATIBILITY
// =============================================================================

console.log("\n=== VERSION COMPATIBILITY ===\n");

const versionResponse = await checkEndpoint("Version Info", "/health", "GET", false);

if (versionResponse?.ok) {
  try {
    const data = await versionResponse.json();

    if (data.version) {
      pass("Backend Version", `${data.version}`);
    } else {
      warn("Backend Version", "Version info not available");
    }

    if (data.capabilities) {
      pass("Capabilities", `${data.capabilities.join(", ")}`);
    }
  } catch (e) {
    // Already handled above
  }
}

// =============================================================================
// CHECK 7: RATE LIMITING
// =============================================================================

console.log("\n=== RATE LIMITING ===\n");

if (API_KEY) {
  const rateLimitResponse = await checkEndpoint(
    "Rate Limit Headers",
    "/v2/activities/templates?limit=1",
    "GET",
    true
  );

  if (rateLimitResponse?.ok) {
    const rateLimit = rateLimitResponse.headers.get("X-RateLimit-Limit");
    const rateLimitRemaining = rateLimitResponse.headers.get("X-RateLimit-Remaining");

    if (rateLimit && rateLimitRemaining) {
      pass("Rate Limiting", `${rateLimitRemaining}/${rateLimit} requests remaining`);
    } else {
      warn("Rate Limiting", "Rate limit headers not present");
    }
  }
}

// =============================================================================
// SUMMARY
// =============================================================================

console.log("\n=== SUMMARY ===\n");

const passed = results.filter(r => r.status === "pass").length;
const failed = results.filter(r => r.status === "fail").length;
const warned = results.filter(r => r.status === "warn").length;
const total = results.length;

console.log(`Total Checks: ${total}`);
console.log(`Passed: ${passed} (${Math.round((passed / total) * 100)}%)`);
console.log(`Failed: ${failed}`);
console.log(`Warnings: ${warned}`);

if (failed > 0) {
  console.log("\n❌ Some compatibility checks failed. Review the output above.");
  console.log("\nFailed checks:");
  results
    .filter(r => r.status === "fail")
    .forEach(r => console.log(`  - ${r.name}: ${r.message}`));

  process.exit(1);
} else if (warned > 0) {
  console.log("\n⚠️  All critical checks passed, but there are warnings.");
  console.log("\nWarnings:");
  results
    .filter(r => r.status === "warn")
    .forEach(r => console.log(`  - ${r.name}: ${r.message}`));

  process.exit(0);
} else {
  console.log("\n✓ All compatibility checks passed!");
  process.exit(0);
}
