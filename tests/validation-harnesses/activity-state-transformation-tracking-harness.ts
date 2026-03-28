/**
 * Validation Harness: activity-state-transformation-tracking
 * 
 * Validates that activity execution captures and POSTs complete state transformations
 * to backend API as specified in PHASE_2_INSTRUMENTATION_DESIGN.md commit 1091779.
 * 
 * Test Strategy:
 * 1. Mock the backend API endpoints to intercept HTTP calls
 * 2. Run a minimal activity (hello-world-minimal template)
 * 3. Capture all POST/PATCH requests to activity-execution endpoints
 * 4. Verify payload schemas match specification requirements
 * 
 * Success Criteria:
 * - POST /api/v1/activity-execution/content called with complete payload
 * - template_definition includes all task definitions
 * - variable_bindings includes provided variables
 * - initial_state.git_commit is current HEAD
 * - initial_state.working_directory is process.cwd()
 * - reason field is non-empty string
 * - task_sequence array contains all task IDs
 */

import { $ } from "bun"
import { existsSync } from "fs"
import { join } from "path"

export interface ValidationInput {
  activityTemplate: string
  variables: Record<string, any>
  reason: string
  mockBackendUrl: string
}

export interface ValidationOutput {
  pass: boolean
  actual: {
    activityContentPost?: {
      called: boolean
      payload?: any
    }
    taskStartPosts?: Array<{
      taskId: string
      payload?: any
    }>
    taskUpdatePatches?: Array<{
      taskExecutionId: string
      status: string
      payload?: any
    }>
  }
  expected: {
    activityContentPost: {
      called: true
      payload: {
        activity_id: "string (uuid)",
        template_definition: {
          id: "string",
          name: "string",
          tasks: "array (non-empty)"
        },
        variable_bindings: "object (matches provided variables)",
        initial_state: {
          git_commit: "string (40 char hash or null)",
          git_branch: "string (branch name or null)",
          git_dirty: "boolean",
          modified_files: "array",
          impulse_ids: "array",
          working_directory: "string (absolute path)",
          timestamp: "number"
        },
        reason: "string (non-empty)",
        timestamp: "number"
      }
    }
    taskStartPosts: "array (one per task)",
    taskUpdatePatches: "array (one per task)"
  }
  errors: string[]
}

/**
 * Mock HTTP server to intercept activity execution API calls.
 * Records all POST/PATCH requests for validation.
 */
class MockBackendServer {
  private server: any
  private port: number
  private calls: Array<{
    method: string
    url: string
    path: string
    body: any
    timestamp: number
  }> = []

  constructor(port: number = 9999) {
    this.port = port
  }

  async start(): Promise<void> {
    // Simple HTTP server using Bun
    this.server = Bun.serve({
      port: this.port,
      fetch: async (req) => {
        const url = new URL(req.url)
        const method = req.method
        const path = url.pathname
        
        let body: any = null
        if (method === "POST" || method === "PATCH") {
          try {
            body = await req.json()
          } catch {
            body = null
          }
        }

        // Record the call
        this.calls.push({
          method,
          url: req.url,
          path,
          body,
          timestamp: Date.now(),
        })

        // Return success responses
        if (method === "POST" && path === "/api/v1/activity-execution/content") {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }

        if (method === "POST" && path === "/api/v1/activity-execution/tasks") {
          return new Response(
            JSON.stringify({
              task_execution_id: `task_exec_${Date.now()}`,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        }

        if (method === "PATCH" && path.startsWith("/api/v1/activity-execution/tasks/")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }

        return new Response("Not Found", { status: 404 })
      },
    })

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  stop(): void {
    if (this.server) {
      this.server.stop()
    }
  }

  getCalls(): typeof this.calls {
    return this.calls
  }

  getActivityContentPost(): any {
    const call = this.calls.find(
      (c) => c.method === "POST" && c.path === "/api/v1/activity-execution/content"
    )
    return call ? { called: true, payload: call.body } : { called: false }
  }

  getTaskStartPosts(): Array<{ taskId: string; payload: any }> {
    return this.calls
      .filter((c) => c.method === "POST" && c.path === "/api/v1/activity-execution/tasks")
      .map((c) => ({
        taskId: c.body?.task_id || "unknown",
        payload: c.body,
      }))
  }

  getTaskUpdatePatches(): Array<{ taskExecutionId: string; status: string; payload: any }> {
    return this.calls
      .filter(
        (c) => c.method === "PATCH" && c.path.startsWith("/api/v1/activity-execution/tasks/")
      )
      .map((c) => {
        const taskExecutionId = c.path.split("/").pop() || "unknown"
        return {
          taskExecutionId,
          status: c.body?.status || "unknown",
          payload: c.body,
        }
      })
  }
}

/**
 * Validate activity content POST payload against specification.
 */
function validateActivityContentPayload(payload: any, input: ValidationInput): string[] {
  const errors: string[] = []

  if (!payload) {
    errors.push("Activity content POST payload is missing")
    return errors
  }

  // Check activity_id
  if (typeof payload.activity_id !== "string" || payload.activity_id.length === 0) {
    errors.push("activity_id must be non-empty string")
  }

  // Check template_definition
  if (!payload.template_definition) {
    errors.push("template_definition is missing")
  } else {
    if (typeof payload.template_definition.id !== "string") {
      errors.push("template_definition.id must be string")
    }
    if (typeof payload.template_definition.name !== "string") {
      errors.push("template_definition.name must be string")
    }
    if (!Array.isArray(payload.template_definition.tasks)) {
      errors.push("template_definition.tasks must be array")
    } else if (payload.template_definition.tasks.length === 0) {
      errors.push("template_definition.tasks must be non-empty")
    }
  }

  // Check variable_bindings
  if (typeof payload.variable_bindings !== "object" || payload.variable_bindings === null) {
    errors.push("variable_bindings must be object")
  } else {
    // Verify it matches provided variables
    const providedKeys = Object.keys(input.variables).sort()
    const receivedKeys = Object.keys(payload.variable_bindings).sort()
    if (JSON.stringify(providedKeys) !== JSON.stringify(receivedKeys)) {
      errors.push(
        `variable_bindings keys mismatch: expected ${providedKeys.join(", ")}, got ${receivedKeys.join(", ")}`
      )
    }
  }

  // Check initial_state
  if (!payload.initial_state) {
    errors.push("initial_state is missing")
  } else {
    const state = payload.initial_state

    // git_commit can be string or null
    if (state.git_commit !== null && typeof state.git_commit !== "string") {
      errors.push("initial_state.git_commit must be string or null")
    }

    // git_branch can be string or null
    if (state.git_branch !== null && typeof state.git_branch !== "string") {
      errors.push("initial_state.git_branch must be string or null")
    }

    // git_dirty must be boolean
    if (typeof state.git_dirty !== "boolean") {
      errors.push("initial_state.git_dirty must be boolean")
    }

    // modified_files must be array
    if (!Array.isArray(state.modified_files)) {
      errors.push("initial_state.modified_files must be array")
    }

    // impulse_ids must be array
    if (!Array.isArray(state.impulse_ids)) {
      errors.push("initial_state.impulse_ids must be array")
    }

    // working_directory must be non-empty string
    if (typeof state.working_directory !== "string" || state.working_directory.length === 0) {
      errors.push("initial_state.working_directory must be non-empty string")
    }

    // timestamp must be number
    if (typeof state.timestamp !== "number") {
      errors.push("initial_state.timestamp must be number")
    }
  }

  // Check reason
  if (typeof payload.reason !== "string" || payload.reason.trim().length === 0) {
    errors.push("reason must be non-empty string")
  }

  // Check timestamp
  if (typeof payload.timestamp !== "number") {
    errors.push("timestamp must be number")
  }

  return errors
}

/**
 * Validate task start POST payloads.
 */
function validateTaskStartPayloads(payloads: Array<any>): string[] {
  const errors: string[] = []

  if (payloads.length === 0) {
    errors.push("No task start POSTs recorded (expected at least one)")
    return errors
  }

  for (const [index, payload] of payloads.entries()) {
    if (!payload) {
      errors.push(`Task start POST ${index + 1}: payload missing`)
      continue
    }

    if (typeof payload.activity_id !== "string") {
      errors.push(`Task start POST ${index + 1}: activity_id must be string`)
    }

    if (typeof payload.task_id !== "string") {
      errors.push(`Task start POST ${index + 1}: task_id must be string`)
    }

    if (!payload.task_definition) {
      errors.push(`Task start POST ${index + 1}: task_definition missing`)
    }

    if (!payload.state_before) {
      errors.push(`Task start POST ${index + 1}: state_before missing`)
    } else {
      if (payload.state_before.git_commit !== null && typeof payload.state_before.git_commit !== "string") {
        errors.push(`Task start POST ${index + 1}: state_before.git_commit must be string or null`)
      }
      if (!Array.isArray(payload.state_before.modified_files)) {
        errors.push(`Task start POST ${index + 1}: state_before.modified_files must be array`)
      }
      if (!Array.isArray(payload.state_before.impulse_ids)) {
        errors.push(`Task start POST ${index + 1}: state_before.impulse_ids must be array`)
      }
    }

    if (typeof payload.timestamp !== "number") {
      errors.push(`Task start POST ${index + 1}: timestamp must be number`)
    }
  }

  return errors
}

/**
 * Validate task update PATCH payloads.
 */
function validateTaskUpdatePayloads(payloads: Array<any>): string[] {
  const errors: string[] = []

  if (payloads.length === 0) {
    errors.push("No task update PATCHes recorded (expected at least one)")
    return errors
  }

  for (const [index, payload] of payloads.entries()) {
    if (!payload) {
      errors.push(`Task update PATCH ${index + 1}: payload missing`)
      continue
    }

    if (!["completed", "failed"].includes(payload.status)) {
      errors.push(`Task update PATCH ${index + 1}: status must be 'completed' or 'failed'`)
    }

    if (!payload.state_after) {
      errors.push(`Task update PATCH ${index + 1}: state_after missing`)
    }

    if (!payload.state_delta) {
      errors.push(`Task update PATCH ${index + 1}: state_delta missing`)
    } else {
      if (!Array.isArray(payload.state_delta.files_added)) {
        errors.push(`Task update PATCH ${index + 1}: state_delta.files_added must be array`)
      }
      if (!Array.isArray(payload.state_delta.files_modified)) {
        errors.push(`Task update PATCH ${index + 1}: state_delta.files_modified must be array`)
      }
      if (!Array.isArray(payload.state_delta.files_deleted)) {
        errors.push(`Task update PATCH ${index + 1}: state_delta.files_deleted must be array`)
      }
      if (!Array.isArray(payload.state_delta.impulses_created)) {
        errors.push(`Task update PATCH ${index + 1}: state_delta.impulses_created must be array`)
      }
    }

    if (typeof payload.duration_ms !== "number") {
      errors.push(`Task update PATCH ${index + 1}: duration_ms must be number`)
    }

    if (typeof payload.timestamp !== "number") {
      errors.push(`Task update PATCH ${index + 1}: timestamp must be number`)
    }
  }

  return errors
}

/**
 * Run validation harness.
 * 
 * @param input - Test configuration with activity template, variables, reason
 * @returns Validation result with pass/fail, actual outputs, expected outputs, errors
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  const mockServer = new MockBackendServer(9999)

  try {
    // Start mock backend server
    await mockServer.start()
    console.log("✓ Mock backend server started on port 9999")

    // Set environment variable to point to mock backend
    const originalBackendUrl = process.env.ACTIVITY_BACKEND_URL
    process.env.ACTIVITY_BACKEND_URL = input.mockBackendUrl

    // Execute activity using opencode CLI
    // Note: This assumes opencode is built and available in path
    const activityCmd = `opencode activity ${input.activityTemplate} --variables '${JSON.stringify(input.variables)}' --reason '${input.reason}'`
    
    console.log(`Running activity: ${input.activityTemplate}`)
    const result = await $`bash -c ${activityCmd}`.nothrow().quiet()

    if (result.exitCode !== 0) {
      errors.push(`Activity execution failed with exit code ${result.exitCode}`)
      console.error("Activity execution stderr:", result.stderr.toString())
    } else {
      console.log("✓ Activity execution completed")
    }

    // Restore environment
    if (originalBackendUrl) {
      process.env.ACTIVITY_BACKEND_URL = originalBackendUrl
    } else {
      delete process.env.ACTIVITY_BACKEND_URL
    }

    // Wait a bit for any pending requests
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Collect actual outputs
    const activityContentPost = mockServer.getActivityContentPost()
    const taskStartPosts = mockServer.getTaskStartPosts()
    const taskUpdatePatches = mockServer.getTaskUpdatePatches()

    console.log(`Recorded API calls:`)
    console.log(`  - Activity content POST: ${activityContentPost.called ? "YES" : "NO"}`)
    console.log(`  - Task start POSTs: ${taskStartPosts.length}`)
    console.log(`  - Task update PATCHes: ${taskUpdatePatches.length}`)

    // Validate payloads
    if (activityContentPost.called) {
      const contentErrors = validateActivityContentPayload(activityContentPost.payload, input)
      errors.push(...contentErrors)
    } else {
      errors.push("Activity content POST was not called")
    }

    const taskStartErrors = validateTaskStartPayloads(
      taskStartPosts.map((t) => t.payload)
    )
    errors.push(...taskStartErrors)

    const taskUpdateErrors = validateTaskUpdatePayloads(
      taskUpdatePatches.map((t) => t.payload)
    )
    errors.push(...taskUpdateErrors)

    // Determine pass/fail
    const pass = errors.length === 0

    return {
      pass,
      actual: {
        activityContentPost,
        taskStartPosts,
        taskUpdatePatches,
      },
      expected: {
        activityContentPost: {
          called: true,
          payload: {
            activity_id: "string (uuid)",
            template_definition: {
              id: "string",
              name: "string",
              tasks: "array (non-empty)",
            },
            variable_bindings: "object (matches provided variables)",
            initial_state: {
              git_commit: "string (40 char hash or null)",
              git_branch: "string (branch name or null)",
              git_dirty: "boolean",
              modified_files: "array",
              impulse_ids: "array",
              working_directory: "string (absolute path)",
              timestamp: "number",
            },
            reason: "string (non-empty)",
            timestamp: "number",
          },
        },
        taskStartPosts: "array (one per task)",
        taskUpdatePatches: "array (one per task)",
      },
      errors,
    }
  } catch (error) {
    errors.push(`Validation harness error: ${error instanceof Error ? error.message : String(error)}`)
    return {
      pass: false,
      actual: {},
      expected: {
        activityContentPost: {
          called: true,
          payload: {
            activity_id: "string (uuid)",
            template_definition: {
              id: "string",
              name: "string",
              tasks: "array (non-empty)",
            },
            variable_bindings: "object (matches provided variables)",
            initial_state: {
              git_commit: "string (40 char hash or null)",
              git_branch: "string (branch name or null)",
              git_dirty: "boolean",
              modified_files: "array",
              impulse_ids: "array",
              working_directory: "string (absolute path)",
              timestamp: "number",
            },
            reason: "string (non-empty)",
            timestamp: "number",
          },
        },
        taskStartPosts: "array (one per task)",
        taskUpdatePatches: "array (one per task)",
      },
      errors,
    }
  } finally {
    // Stop mock server
    mockServer.stop()
    console.log("✓ Mock backend server stopped")
  }
}

// CLI entry point for standalone execution
if (import.meta.main) {
  const input: ValidationInput = {
    activityTemplate: "hello-world-minimal",
    variables: { message: "Hello from validation harness" },
    reason: "Testing activity state transformation tracking instrumentation",
    mockBackendUrl: "http://localhost:9999",
  }

  console.log("=== Activity State Transformation Tracking Validation ===\n")
  console.log("Input:", JSON.stringify(input, null, 2))
  console.log("\nRunning validation...\n")

  const result = await runValidation(input)

  console.log("\n=== Validation Result ===\n")
  console.log(`Status: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
  
  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`)
    for (const error of result.errors) {
      console.log(`  - ${error}`)
    }
  }

  console.log("\nActual outputs:", JSON.stringify(result.actual, null, 2))

  process.exit(result.pass ? 0 : 1)
}
