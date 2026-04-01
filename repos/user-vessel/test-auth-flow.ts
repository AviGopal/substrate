#!/usr/bin/env bun
/**
 * Integration test for user-vessel authentication flow
 *
 * Tests:
 * 1. Signup → Create user and organization
 * 2. Login → Get JWT token
 * 3. Get /me → Verify authenticated access
 * 4. Create API key → Generate API key
 * 5. List API keys → Verify key was created
 *
 * Usage:
 *   bun run test-auth-flow.ts
 *   USER_VESSEL_URL=http://identity.metabob.local bun run test-auth-flow.ts
 */

const BASE_URL = process.env.USER_VESSEL_URL || "http://localhost:8080"

interface TestResult {
  name: string
  success: boolean
  error?: string
  data?: any
}

const results: TestResult[] = []

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`)
}

function logResult(result: TestResult) {
  if (result.success) {
    log("✅", `${result.name}`)
  } else {
    log("❌", `${result.name}: ${result.error}`)
  }
}

async function testHealthCheck(): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}/health`)
    const data = await response.json()

    if (response.ok && data.status === "ok") {
      return {
        name: "Health check",
        success: true,
        data,
      }
    }

    return {
      name: "Health check",
      success: false,
      error: `Unexpected response: ${JSON.stringify(data)}`,
    }
  } catch (error) {
    return {
      name: "Health check",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testSignup(email: string, password: string, name: string, orgName: string): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}/v2/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, org_name: orgName }),
    })

    const data = await response.json()

    if (response.ok && data.token) {
      return {
        name: "Signup",
        success: true,
        data,
      }
    }

    return {
      name: "Signup",
      success: false,
      error: data.error || `HTTP ${response.status}`,
      data,
    }
  } catch (error) {
    return {
      name: "Signup",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testLogin(email: string, password: string, orgId: string): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, org_id: orgId }),
    })

    const data = await response.json()

    if (response.ok && data.token) {
      return {
        name: "Login",
        success: true,
        data,
      }
    }

    return {
      name: "Login",
      success: false,
      error: data.error || `HTTP ${response.status}`,
      data,
    }
  } catch (error) {
    return {
      name: "Login",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testGetMe(token: string): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}/v2/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (response.ok && data.user) {
      return {
        name: "Get /me",
        success: true,
        data,
      }
    }

    return {
      name: "Get /me",
      success: false,
      error: data.error || `HTTP ${response.status}`,
      data,
    }
  } catch (error) {
    return {
      name: "Get /me",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testCreateApiKey(token: string): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}/v2/api-keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test API Key",
        scopes: ["read", "write"],
      }),
    })

    const data = await response.json()

    if (response.ok && data.key) {
      return {
        name: "Create API key",
        success: true,
        data,
      }
    }

    return {
      name: "Create API key",
      success: false,
      error: data.error || `HTTP ${response.status}`,
      data,
    }
  } catch (error) {
    return {
      name: "Create API key",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testListApiKeys(token: string): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}/v2/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (response.ok && Array.isArray(data.api_keys)) {
      return {
        name: "List API keys",
        success: true,
        data: { count: data.api_keys.length },
      }
    }

    return {
      name: "List API keys",
      success: false,
      error: data.error || `HTTP ${response.status}`,
      data,
    }
  } catch (error) {
    return {
      name: "List API keys",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// =============================================================================
// RUN TESTS
// =============================================================================

async function runTests() {
  log("🚀", "Starting user-vessel integration tests")
  log("📍", `Base URL: ${BASE_URL}`)
  console.log("")

  // Generate unique test data
  const timestamp = Date.now()
  const email = `test-${timestamp}@metabob.com`
  const password = "TestPassword123"
  const name = "Test User"
  const orgName = `Test Org ${timestamp}`

  // Test 1: Health check
  const healthResult = await testHealthCheck()
  results.push(healthResult)
  logResult(healthResult)

  if (!healthResult.success) {
    log("❌", "Health check failed, skipping remaining tests")
    process.exit(1)
  }

  // Test 2: Signup
  const signupResult = await testSignup(email, password, name, orgName)
  results.push(signupResult)
  logResult(signupResult)

  if (!signupResult.success) {
    log("❌", "Signup failed, skipping remaining tests")
    process.exit(1)
  }

  const signupToken = signupResult.data.token
  const orgId = signupResult.data.org.id

  log("📝", `Created org: ${orgId}`)
  log("📝", `User: ${email}`)

  // Test 3: Login
  const loginResult = await testLogin(email, password, orgId)
  results.push(loginResult)
  logResult(loginResult)

  const token = loginResult.success ? loginResult.data.token : signupToken

  // Test 4: Get /me
  const meResult = await testGetMe(token)
  results.push(meResult)
  logResult(meResult)

  // Test 5: Create API key
  const createKeyResult = await testCreateApiKey(token)
  results.push(createKeyResult)
  logResult(createKeyResult)

  if (createKeyResult.success) {
    log("🔑", `API Key: ${createKeyResult.data.key}`)
  }

  // Test 6: List API keys
  const listKeysResult = await testListApiKeys(token)
  results.push(listKeysResult)
  logResult(listKeysResult)

  // Summary
  console.log("")
  log("📊", "Test Summary")
  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  console.log(`  Passed: ${passed}/${results.length}`)
  console.log(`  Failed: ${failed}/${results.length}`)

  if (failed > 0) {
    process.exit(1)
  }

  log("✅", "All tests passed!")
}

runTests().catch((error) => {
  console.error("Test runner error:", error)
  process.exit(1)
})
