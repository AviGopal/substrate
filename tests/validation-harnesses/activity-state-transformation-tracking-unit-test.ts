/**
 * Unit Test: activity-state-transformation-tracking
 * 
 * Validates that state capture and API client modules work correctly.
 * This is a simplified validation that tests the core components without
 * requiring a full activity execution.
 */

import { test, expect } from "bun:test"

// Mock environment for testing
const ORIGINAL_CWD = process.cwd()

test("activity-state-capture module exports", async () => {
  // Import the state capture module
  const stateCapture = await import(
    "../../repos/metabob-opencode/packages/opencode/src/session/activity-state-capture.ts"
  )

  // Verify exports exist
  expect(stateCapture.captureInitialState).toBeDefined()
  expect(stateCapture.captureCurrentState).toBeDefined()
  expect(stateCapture.computeDelta).toBeDefined()
  expect(typeof stateCapture.captureInitialState).toBe("function")
  expect(typeof stateCapture.captureCurrentState).toBe("function")
  expect(typeof stateCapture.computeDelta).toBe("function")
})

test("activity-client module exports", async () => {
  // Import the API client module
  const apiClient = await import(
    "../../repos/metabob-opencode/packages/opencode/src/api/activity-client.ts"
  )

  // Verify exports exist
  expect(apiClient.storeActivityContent).toBeDefined()
  expect(apiClient.recordTaskStart).toBeDefined()
  expect(apiClient.updateTaskExecution).toBeDefined()
  expect(typeof apiClient.storeActivityContent).toBe("function")
  expect(typeof apiClient.recordTaskStart).toBe("function")
  expect(typeof apiClient.updateTaskExecution).toBe("function")
})

test("captureInitialState returns correct schema", async () => {
  const stateCapture = await import(
    "../../repos/metabob-opencode/packages/opencode/src/session/activity-state-capture.ts"
  )

  // Mock session ID
  const sessionID = "test-session-123"

  // Capture initial state (should not throw even if session doesn't exist)
  const state = await stateCapture.captureInitialState(sessionID)

  // Verify schema
  expect(state).toBeDefined()
  expect(state.git_commit).toBeDefined()
  expect(state.git_branch).toBeDefined()
  expect(typeof state.git_dirty).toBe("boolean")
  expect(Array.isArray(state.modified_files)).toBe(true)
  expect(Array.isArray(state.impulse_ids)).toBe(true)
  expect(typeof state.working_directory).toBe("string")
  expect(state.working_directory).toBe(ORIGINAL_CWD)
  expect(typeof state.timestamp).toBe("number")
  expect(state.timestamp).toBeGreaterThan(0)

  console.log("✓ captureInitialState schema validated")
  console.log(`  git_commit: ${state.git_commit?.slice(0, 7) || "null"}`)
  console.log(`  git_branch: ${state.git_branch || "null"}`)
  console.log(`  git_dirty: ${state.git_dirty}`)
  console.log(`  modified_files: ${state.modified_files.length}`)
  console.log(`  impulse_ids: ${state.impulse_ids.length}`)
  console.log(`  working_directory: ${state.working_directory}`)
})

test("captureCurrentState returns correct schema", async () => {
  const stateCapture = await import(
    "../../repos/metabob-opencode/packages/opencode/src/session/activity-state-capture.ts"
  )

  const sessionID = "test-session-123"
  const state = await stateCapture.captureCurrentState(sessionID)

  // Verify schema
  expect(state).toBeDefined()
  expect(state.git_commit).toBeDefined()
  expect(Array.isArray(state.modified_files)).toBe(true)
  expect(Array.isArray(state.impulse_ids)).toBe(true)
  expect(typeof state.timestamp).toBe("number")
  expect(state.timestamp).toBeGreaterThan(0)
  // snapshot_hash is optional
  if (state.snapshot_hash) {
    expect(typeof state.snapshot_hash).toBe("string")
  }

  console.log("✓ captureCurrentState schema validated")
})

test("computeDelta returns correct schema", async () => {
  const stateCapture = await import(
    "../../repos/metabob-opencode/packages/opencode/src/session/activity-state-capture.ts"
  )

  const before = {
    git_commit: "abc123",
    modified_files: ["file1.ts", "file2.ts"],
    impulse_ids: ["impulse1"],
    timestamp: Date.now() - 1000,
    snapshot_hash: undefined, // No snapshot (will skip git diff)
  }

  const after = {
    git_commit: "def456",
    modified_files: ["file1.ts", "file3.ts"],
    impulse_ids: ["impulse1", "impulse2"],
    timestamp: Date.now(),
    snapshot_hash: undefined,
  }

  const delta = await stateCapture.computeDelta(before, after)

  // Verify schema - all fields should be present with correct types
  expect(delta).toBeDefined()
  expect(Array.isArray(delta.files_added)).toBe(true)
  expect(Array.isArray(delta.files_modified)).toBe(true)
  expect(Array.isArray(delta.files_deleted)).toBe(true)
  expect(typeof delta.git_diff).toBe("string")
  expect(Array.isArray(delta.impulses_created)).toBe(true)
  expect(delta.lines_changed).toBeDefined()
  expect(typeof delta.lines_changed.additions).toBe("number")
  expect(typeof delta.lines_changed.deletions).toBe("number")

  // Verify file change logic works correctly
  expect(delta.files_added).toContain("file3.ts")
  expect(delta.files_deleted).toContain("file2.ts")
  expect(delta.files_modified).toContain("file1.ts")
  
  // Verify impulse change detection
  expect(delta.impulses_created).toContain("impulse2")
  expect(delta.impulses_created.length).toBe(1)

  console.log("✓ computeDelta schema and logic validated")
  console.log(`  files_added: ${delta.files_added.length} (expected: 1)`)
  console.log(`  files_modified: ${delta.files_modified.length} (expected: 1)`)
  console.log(`  files_deleted: ${delta.files_deleted.length} (expected: 1)`)
  console.log(`  impulses_created: ${delta.impulses_created.length} (expected: 1)`)
})

test("storeActivityContent handles mock backend", async () => {
  const apiClient = await import(
    "../../repos/metabob-opencode/packages/opencode/src/api/activity-client.ts"
  )

  // Start mock server
  const server = Bun.serve({
    port: 9998,
    fetch: async (req) => {
      const url = new URL(req.url)
      if (url.pathname === "/api/v1/activity-execution/content" && req.method === "POST") {
        const body = await req.json()
        
        // Validate payload
        expect(body.activity_id).toBeDefined()
        expect(body.template_definition).toBeDefined()
        expect(body.variable_bindings).toBeDefined()
        expect(body.initial_state).toBeDefined()
        expect(body.reason).toBeDefined()
        expect(body.timestamp).toBeDefined()
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response("Not Found", { status: 404 })
    },
  })

  try {
    // Set backend URL to mock server
    process.env.ACTIVITY_BACKEND_URL = "http://localhost:9998"

    // Call storeActivityContent
    await apiClient.storeActivityContent({
      activity_id: "test-activity-123",
      template_definition: {
        id: "test-template",
        name: "Test Template",
        description: "Test",
        tasks: [{ id: "task1", description: "Task 1" }],
      },
      variable_bindings: { var1: "value1" },
      initial_state: {
        git_commit: "abc123",
        git_branch: "main",
        git_dirty: false,
        modified_files: [],
        impulse_ids: [],
        working_directory: ORIGINAL_CWD,
        timestamp: Date.now(),
      },
      reason: "Testing",
      timestamp: Date.now(),
    })

    console.log("✓ storeActivityContent successfully POSTed to mock backend")
  } finally {
    server.stop()
    delete process.env.ACTIVITY_BACKEND_URL
  }
})

test("API client handles backend unavailable (non-blocking)", async () => {
  const apiClient = await import(
    "../../repos/metabob-opencode/packages/opencode/src/api/activity-client.ts"
  )

  // Point to unavailable backend
  process.env.ACTIVITY_BACKEND_URL = "http://localhost:8887"

  // Should not throw error (non-blocking design)
  await expect(
    apiClient.storeActivityContent({
      activity_id: "test-activity-123",
      template_definition: {
        id: "test-template",
        name: "Test Template",
        description: "Test",
        tasks: [],
      },
      variable_bindings: {},
      initial_state: {
        git_commit: null,
        git_branch: null,
        git_dirty: false,
        modified_files: [],
        impulse_ids: [],
        working_directory: ORIGINAL_CWD,
        timestamp: Date.now(),
      },
      reason: "Testing non-blocking",
      timestamp: Date.now(),
    })
  ).resolves.toBeUndefined()

  console.log("✓ API client gracefully handles backend unavailable (non-blocking)")

  delete process.env.ACTIVITY_BACKEND_URL
})

test("activity.ts includes instrumentation imports", async () => {
  const fs = await import("fs/promises")
  const activityToolPath =
    "repos/metabob-opencode/packages/opencode/src/tool/activity.ts"

  const content = await fs.readFile(activityToolPath, "utf-8")

  // Check for imports
  expect(content).toContain("captureInitialState")
  expect(content).toContain("captureCurrentState")
  expect(content).toContain("computeDelta")
  expect(content).toContain("storeActivityContent")
  expect(content).toContain("recordTaskStart")
  expect(content).toContain("updateTaskExecution")

  // Check for instrumentation points
  expect(content).toContain("INSTRUMENTATION POINT 1")
  expect(content).toContain("INSTRUMENTATION POINT 2")
  expect(content).toContain("INSTRUMENTATION POINT 3")
  expect(content).toContain("INSTRUMENTATION POINT 4")
  expect(content).toContain("INSTRUMENTATION POINT 5")
  expect(content).toContain("INSTRUMENTATION POINT 6")
  expect(content).toContain("INSTRUMENTATION POINT 7")

  console.log("✓ activity.ts includes all instrumentation points and imports")
})

// Run all tests
console.log("\n=== Activity State Transformation Tracking - Unit Tests ===\n")
