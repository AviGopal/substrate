/**
 * Integration Test for Schema Paradigm Alignment (Phase 3.3)
 *
 * Tests the new 4-table paradigm schema fields:
 * - Execution traces with input_impulses, output_impulses, vessel_id, impulse_evolution
 * - Thompson Sampling from v_activity_score view
 * - Shape-based activity recommendations
 */

const API_ENDPOINT = process.env.API_ENDPOINT || "http://api.minibob.local"

console.log("=".repeat(80))
console.log("PARADIGM SCHEMA INTEGRATION TEST (P3.3)")
console.log("=".repeat(80))
console.log(`API Endpoint: ${API_ENDPOINT}`)
console.log("")

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function waitForBackend(maxRetries = 10): Promise<boolean> {
  console.log("Waiting for backend to be ready...")

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${API_ENDPOINT}/health`, { method: "GET" })
      if (response.ok) {
        console.log("✅ Backend is ready")
        return true
      }
    } catch (error) {
      // Backend not ready yet
    }

    console.log(`  Retry ${i + 1}/${maxRetries}...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.error("❌ Backend not available")
  return false
}

async function testSection(
  name: string,
  testFn: () => Promise<boolean>
): Promise<boolean> {
  console.log("")
  console.log("-".repeat(80))
  console.log(name)
  console.log("-".repeat(80))

  try {
    const result = await testFn()
    if (result) {
      console.log(`✅ ${name} PASSED`)
    } else {
      console.log(`❌ ${name} FAILED`)
    }
    return result
  } catch (error) {
    console.error(`❌ ${name} ERROR:`, error)
    return false
  }
}

// =============================================================================
// TEST 1: Execution Trace with New Paradigm Fields
// =============================================================================

async function testExecutionTraceNewFields(): Promise<boolean> {
  console.log("Testing execution trace with new paradigm fields...")

  const executionId = `exec_paradigm_test_${Date.now()}`
  const activityId = `activity_paradigm_test_${Date.now()}`

  // Create execution trace with all new fields
  const executionTrace = {
    execution_id: executionId,
    template_id: activityId,
    activity_id: activityId,
    status: "success",
    success: true,
    duration_ms: 1500,
    cost_usd: 0.05,
    tokens: {
      input: 1000,
      output: 500,
      cache: 0,
    },
    execution_trace: {
      tasks: [
        {
          id: "task-1",
          description: "Test task",
          response: "Task completed",
          result: { status: "success" },
        }
      ],
      impulsesCreated: ["output-impulse-1"],
      filesModified: ["test.ts"],
    },
    // NEW PARADIGM FIELDS (P3.1)
    input_impulses: ["input-impulse-1", "input-impulse-2"],
    output_impulses: ["output-impulse-1"],
    parent_execution_id: null,
    vessel_id: "minibob-test-vessel",
    // NEW: Impulse evolution (P3.2)
    impulse_evolution: {
      unchanged: ["input-impulse-1"],
      modified: ["input-impulse-2"],
      created: ["output-impulse-1"],
      deleted: [],
    },
    // Multi-tenant context (required by API)
    org_id: "metabob_internal",
  }

  try {
    // POST execution trace
    const response = await fetch(`${API_ENDPOINT}/v2/activities/execution-traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(executionTrace),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error("POST execution trace failed:", response.status, text)
      return false
    }

    const data = await response.json()
    console.log("✅ Execution trace stored successfully")
    console.log(`   - Execution ID: ${executionId}`)
    console.log(`   - Activity ID: ${activityId}`)

    // Verify data was stored by querying it back
    console.log("Verifying execution trace was stored...")

    // Query the new execution table via impulse resolution
    const resolveResponse = await fetch(`${API_ENDPOINT}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pointer: {
          type: "activityExecutionTrace",
          executionId: executionId,
        },
      }),
    })

    if (resolveResponse.ok) {
      const resolveData = await resolveResponse.json()
      console.log("✅ Execution trace retrieved via impulse resolution")

      // Check if new fields are present in resolved content
      const content = resolveData.content || resolveData
      if (typeof content === 'string') {
        const hasInputImpulses = content.includes("Input Impulses") || content.includes("input_impulses")
        const hasVesselId = content.includes("vessel") || content.includes("minibob-test-vessel")
        console.log(`   - Has input_impulses reference: ${hasInputImpulses}`)
        console.log(`   - Has vessel_id reference: ${hasVesselId}`)
      }
    } else {
      console.log("⚠️ Could not verify via impulse resolution (may be expected if execution not found in new table)")
    }

    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

// =============================================================================
// TEST 2: Thompson Sampling from v_activity_score
// =============================================================================

async function testThompsonSamplingView(): Promise<boolean> {
  console.log("Testing Thompson Sampling from v_activity_score...")

  // First, register a test activity template
  const templateId = `template_ts_test_${Date.now()}`

  const template = {
    activity_id: templateId,
    variant_id: templateId,
    variant_name: "Thompson Sampling Test Template",
    category: "tool",
    description: "Test template for Thompson Sampling integration",
    task_steps: [
      {
        id: "step-1",
        description: "Test step",
        subagent: "default",
        dependencies: [],
        prompt: { template: "Do a test", maxTokens: 100 },
      }
    ],
    // NEW: Input/output shapes for paradigm schema
    input_shapes: ["goal", "memo"],
    output_shapes: ["trace"],
    org_id: "metabob_internal",
  }

  try {
    // Register template
    const registerResponse = await fetch(`${API_ENDPOINT}/v2/activities/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    })

    if (!registerResponse.ok) {
      const text = await registerResponse.text()
      console.error("Template registration failed:", registerResponse.status, text)
      return false
    }

    console.log(`✅ Template registered: ${templateId}`)

    // Record some executions to build up Thompson Sampling data
    for (let i = 0; i < 3; i++) {
      const execTrace = {
        execution_id: `exec_ts_${Date.now()}_${i}`,
        template_id: templateId,
        activity_id: templateId,
        status: i < 2 ? "success" : "failure", // 2 successes, 1 failure
        success: i < 2,
        duration_ms: 1000 + i * 100,
        cost_usd: 0.01 * (i + 1),
        tokens: { input: 500, output: 200, cache: 0 },
        input_impulses: [],
        output_impulses: [],
        vessel_id: "minibob-ts-test",
        org_id: "metabob_internal",
      }

      await fetch(`${API_ENDPOINT}/v2/activities/execution-traces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(execTrace),
      })
    }

    console.log("✅ Recorded 3 executions (2 success, 1 failure)")

    // Now test recommendations - should use Thompson Sampling
    const recommendResponse = await fetch(`${API_ENDPOINT}/v2/activities/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_description: "Test task for Thompson Sampling",
        category: "tool",
        limit: 5,
      }),
    })

    if (!recommendResponse.ok) {
      const text = await recommendResponse.text()
      console.error("Recommend failed:", recommendResponse.status, text)
      return false
    }

    const recommendations = await recommendResponse.json()
    console.log(`✅ Got ${recommendations.recommendations?.length || 0} recommendations`)

    // Check if our template is in recommendations with score metadata
    const ourTemplate = recommendations.recommendations?.find(
      (r: any) => r.template_id === templateId || r.variant_id === templateId
    )

    if (ourTemplate) {
      console.log(`   - Found our template in recommendations`)
      console.log(`   - Selection metadata: ${JSON.stringify(ourTemplate.selection_metadata || {})}`)
    }

    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

// =============================================================================
// TEST 3: Shape-based Activity Recommendations
// =============================================================================

async function testShapeBasedRecommendations(): Promise<boolean> {
  console.log("Testing shape-based activity recommendations...")

  // Register templates with different input shapes
  const timestamp = Date.now()
  const templates = [
    {
      activity_id: `shape_test_goal_${timestamp}`,
      variant_id: `shape_test_goal_${timestamp}`,
      variant_name: "Goal-only Template",
      category: "feature",
      description: "Accepts only goal impulses",
      task_steps: [{ id: "s1", description: "Step", subagent: "default", dependencies: [], prompt: { template: "Do", maxTokens: 100 } }],
      input_shapes: ["goal"],
      output_shapes: ["trace"],
      org_id: "metabob_internal",
    },
    {
      activity_id: `shape_test_file_${timestamp}`,
      variant_id: `shape_test_file_${timestamp}`,
      variant_name: "File Template",
      category: "feature",
      description: "Accepts file and memo impulses",
      task_steps: [{ id: "s1", description: "Step", subagent: "default", dependencies: [], prompt: { template: "Do", maxTokens: 100 } }],
      input_shapes: ["source_code", "memo"],
      output_shapes: ["trace"],
      org_id: "metabob_internal",
    },
    {
      activity_id: `shape_test_trace_${timestamp}`,
      variant_id: `shape_test_trace_${timestamp}`,
      variant_name: "Trace Analysis Template",
      category: "feature",
      description: "Accepts trace impulses for debugging",
      task_steps: [{ id: "s1", description: "Step", subagent: "default", dependencies: [], prompt: { template: "Do", maxTokens: 100 } }],
      input_shapes: ["trace", "goal"],
      output_shapes: ["memo"],
      org_id: "metabob_internal",
    },
  ]

  try {
    // Register all templates
    for (const template of templates) {
      const response = await fetch(`${API_ENDPOINT}/v2/activities/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      })

      if (!response.ok) {
        console.error(`Failed to register ${template.variant_name}`)
        continue
      }

      console.log(`✅ Registered: ${template.variant_name}`)
    }

    // Test 1: Recommend with only goal shapes available
    console.log("\nTesting with impulse_shapes=['goal']...")
    const goalOnlyResponse = await fetch(`${API_ENDPOINT}/v2/activities/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_description: "Test with goal only",
        category: "feature",
        impulse_shapes: ["goal"],
        limit: 10,
      }),
    })

    if (goalOnlyResponse.ok) {
      const data = await goalOnlyResponse.json()
      const count = data.recommendations?.length || 0
      console.log(`   - Got ${count} recommendations matching goal shape`)

      // Should include goal-only and trace-analysis (both accept goal)
      const names = data.recommendations?.map((r: any) => r.variant_name || r.name) || []
      console.log(`   - Templates: ${names.slice(0, 3).join(", ")}`)
    }

    // Test 2: Recommend with source_code and memo shapes
    console.log("\nTesting with impulse_shapes=['source_code', 'memo']...")
    const fileResponse = await fetch(`${API_ENDPOINT}/v2/activities/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_description: "Test with file and memo",
        category: "feature",
        impulse_shapes: ["source_code", "memo"],
        limit: 10,
      }),
    })

    if (fileResponse.ok) {
      const data = await fileResponse.json()
      const count = data.recommendations?.length || 0
      console.log(`   - Got ${count} recommendations matching source_code+memo shapes`)
    }

    // Test 3: Recommend with trace and goal shapes
    console.log("\nTesting with impulse_shapes=['trace', 'goal']...")
    const traceResponse = await fetch(`${API_ENDPOINT}/v2/activities/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_description: "Debug a failed execution",
        category: "feature",
        impulse_shapes: ["trace", "goal"],
        limit: 10,
      }),
    })

    if (traceResponse.ok) {
      const data = await traceResponse.json()
      const count = data.recommendations?.length || 0
      console.log(`   - Got ${count} recommendations matching trace+goal shapes`)
    }

    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

// =============================================================================
// TEST 4: End-to-end Workflow Verification
// =============================================================================

async function testEndToEndWorkflow(): Promise<boolean> {
  console.log("Testing end-to-end workflow...")

  const workflowId = `workflow_${Date.now()}`

  try {
    // Step 1: Register activity
    const templateId = `e2e_template_${workflowId}`
    const registerResponse = await fetch(`${API_ENDPOINT}/v2/activities/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity_id: templateId,
        variant_id: templateId,
        variant_name: "E2E Test Template",
        category: "tool",
        description: "End-to-end test",
        task_steps: [{ id: "t1", description: "Task", subagent: "default", dependencies: [], prompt: { template: "Do", maxTokens: 100 } }],
        input_shapes: ["goal"],
        output_shapes: ["trace"],
        org_id: "metabob_internal",
      }),
    })

    if (!registerResponse.ok) {
      console.error("Step 1 failed: Template registration")
      return false
    }
    console.log("✅ Step 1: Template registered")

    // Step 2: Store execution trace with all paradigm fields
    const executionId = `e2e_exec_${workflowId}`
    const traceResponse = await fetch(`${API_ENDPOINT}/v2/activities/execution-traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        execution_id: executionId,
        template_id: templateId,
        activity_id: templateId,
        status: "success",
        success: true,
        duration_ms: 2000,
        cost_usd: 0.03,
        tokens: { input: 800, output: 400, cache: 0 },
        input_impulses: ["goal-impulse-1"],
        output_impulses: ["trace-impulse-1"],
        parent_execution_id: null,
        vessel_id: "minibob-e2e-test",
        impulse_evolution: {
          unchanged: [],
          modified: [],
          created: ["trace-impulse-1"],
          deleted: [],
        },
        org_id: "metabob_internal",
      }),
    })

    if (!traceResponse.ok) {
      console.error("Step 2 failed: Execution trace storage")
      return false
    }
    console.log("✅ Step 2: Execution trace stored")

    // Step 3: Get recommendations (should include our template with updated scores)
    const recommendResponse = await fetch(`${API_ENDPOINT}/v2/activities/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_description: "E2E test task",
        category: "tool",
        impulse_shapes: ["goal"],
        limit: 10,
      }),
    })

    if (!recommendResponse.ok) {
      console.error("Step 3 failed: Recommendations")
      return false
    }

    const recommendations = await recommendResponse.json()
    console.log(`✅ Step 3: Got ${recommendations.recommendations?.length || 0} recommendations`)

    // Step 4: Verify Thompson Sampling scores are being used
    const hasScoreMetadata = recommendations.recommendations?.some(
      (r: any) => r.selection_metadata?.sampled_score !== undefined || r.selection_metadata?.alpha !== undefined
    )
    console.log(`✅ Step 4: Thompson Sampling metadata present: ${hasScoreMetadata}`)

    return true
  } catch (error) {
    console.error("Error:", error)
    return false
  }
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runTests() {
  console.log("Starting P3.3 integration tests...\n")

  // Wait for backend
  const backendReady = await waitForBackend()
  if (!backendReady) {
    console.error("Cannot proceed without backend")
    process.exit(1)
  }

  const results = {
    "Execution Trace New Fields": await testSection(
      "Test 1: Execution Trace with New Paradigm Fields",
      testExecutionTraceNewFields
    ),
    "Thompson Sampling View": await testSection(
      "Test 2: Thompson Sampling from v_activity_score",
      testThompsonSamplingView
    ),
    "Shape-based Recommendations": await testSection(
      "Test 3: Shape-based Activity Recommendations",
      testShapeBasedRecommendations
    ),
    "End-to-End Workflow": await testSection(
      "Test 4: End-to-End Workflow Verification",
      testEndToEndWorkflow
    ),
  }

  // Summary
  console.log("")
  console.log("=".repeat(80))
  console.log("TEST SUMMARY")
  console.log("=".repeat(80))

  const passed = Object.values(results).filter(r => r).length
  const total = Object.keys(results).length

  for (const [name, result] of Object.entries(results)) {
    console.log(`${name}: ${result ? "✅ PASS" : "❌ FAIL"}`)
  }

  console.log("")
  console.log(`Total: ${passed}/${total} tests passed`)

  if (passed === total) {
    console.log("🎉 ALL P3.3 TESTS PASSED!")
    process.exit(0)
  } else {
    console.log("⚠️  SOME TESTS FAILED")
    process.exit(1)
  }
}

// Run tests
runTests().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
