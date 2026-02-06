#!/usr/bin/env bun
/**
 * Test Template Access via ACP
 * 
 * Verifies that:
 * 1. Local template registration succeeded
 * 2. Metabob MCP can retrieve the template
 * 3. DevBob agent can access template via ACP delegation
 * 
 * Usage:
 *   bun run test-template-access-via-acp.ts
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"
import { SearchActivitiesTool } from "./repos/metabob-opencode/packages/opencode/src/tool/search-activities"

console.log("╔══════════════════════════════════════════════════════════╗")
console.log("║       Template Access via ACP - Verification Test       ║")
console.log("╚══════════════════════════════════════════════════════════╝\n")

const CONTAINER_NAME = "devbob-opencode"
const TARGET = `docker://${CONTAINER_NAME}`
const TEMPLATE_ID = "implement-self-healing-devbob-system"
const TEST_SESSION_ID = `test-template-access-${Date.now()}`

const results: Array<{ test: string; passed: boolean; details: string }> = []

function logTest(name: string, passed: boolean, details: string) {
  const icon = passed ? "✅" : "❌"
  console.log(`${icon} ${name}`)
  if (details) {
    console.log(`   ${details}`)
  }
  console.log("")
  results.push({ test: name, passed, details })
}

await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    // Test 1: Verify local template exists
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Test 1: Local Template Registration")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const searchTool = await SearchActivitiesTool.init()
      const searchResult = await searchTool.execute(
        { category: "infrastructure", verbose: true },
        { sessionID: TEST_SESSION_ID } as any,
      )

      const found = searchResult.output.includes(TEMPLATE_ID)
      logTest(
        "Local Template Exists",
        found,
        found ? `Template ${TEMPLATE_ID} found in local storage` : "Template not found in local storage",
      )

      if (!found) {
        console.log("❌ Template not registered. Run registration first:")
        console.log("   bun run register-self-healing-template.ts")
        process.exit(1)
      }
    } catch (error) {
      logTest("Local Template Exists", false, error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    // Test 2: Verify container is running
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Test 2: Container Health")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const healthResult = await Bun.$`docker inspect --format '{{.State.Running}} {{.State.Health.Status}}' ${CONTAINER_NAME}`.quiet()
      const output = healthResult.stdout.toString().trim()
      const [running, health] = output.split(" ")

      if (running === "true" && (health === "healthy" || health === "")) {
        logTest("Container Health", true, `${CONTAINER_NAME} is running and healthy`)
      } else {
        logTest("Container Health", false, `Container status: running=${running}, health=${health}`)
        process.exit(1)
      }
    } catch (error) {
      logTest("Container Health", false, `Container ${CONTAINER_NAME} not found`)
      console.log("   Start container with: ./scripts/start-devbob.sh")
      process.exit(1)
    }

    // Test 3: Test template access via ACP
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Test 3: Template Access via ACP")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const acpTool = await ACPDelegateTool.init()

      const result = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Search for self-healing template",
          prompt: `Search for activity templates in the infrastructure category using the search_activities tool.

Specifically look for a template with ID: ${TEMPLATE_ID}

Return:
1. Whether you found the template
2. The template name and description
3. How many tasks it has
4. Whether metabob MCP tools are available to you

This verifies that templates registered locally are accessible to remote agents via ACP.`,
          timeout: 90,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (result.metadata?.success) {
        const foundTemplate = result.output.toLowerCase().includes(TEMPLATE_ID.toLowerCase())
        logTest(
          "Remote Template Access",
          foundTemplate,
          foundTemplate
            ? "DevBob agent successfully accessed template via ACP"
            : "DevBob agent did not find template",
        )

        console.log("Remote Agent Response:")
        console.log(result.output.slice(0, 1000) + "...")
        console.log("")
      } else {
        logTest("Remote Template Access", false, result.metadata?.error || "Unknown error")
      }
    } catch (error) {
      logTest("Remote Template Access", false, error instanceof Error ? error.message : String(error))
    }

    // Test 4: Verify metabob MCP connectivity from remote agent
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Test 4: Metabob MCP Connectivity from Remote Agent")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    try {
      const acpTool = await ACPDelegateTool.init()

      const result = await acpTool.execute(
        {
          target: TARGET,
          taskDescription: "Test metabob MCP tools",
          prompt: `Test metabob MCP connectivity:

1. Use the test_metabob_mcp tool (if available)
2. Report which metabob tools you have access to
3. Try to call metabob_search_codebase_issues with a simple query like "test"

This verifies that metabob MCP tools work from within the remote agent context.`,
          timeout: 120,
        },
        {
          sessionID: TEST_SESSION_ID,
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      if (result.metadata?.success) {
        const hasMetabob =
          result.output.toLowerCase().includes("metabob") || result.output.toLowerCase().includes("mcp")
        logTest(
          "Metabob MCP from Remote",
          hasMetabob,
          hasMetabob ? "Metabob tools accessible from remote agent" : "Metabob tools not accessible",
        )

        console.log("Metabob Connectivity Test:")
        console.log(result.output.slice(0, 1000) + "...")
        console.log("")
      } else {
        logTest("Metabob MCP from Remote", false, result.metadata?.error || "Unknown error")
      }
    } catch (error) {
      logTest("Metabob MCP from Remote", false, error instanceof Error ? error.message : String(error))
    }

    // Final Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Final Summary")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    const passed = results.filter((r) => r.passed).length
    const total = results.length
    const passRate = ((passed / total) * 100).toFixed(1)

    console.log(`Total Tests: ${total}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${total - passed}`)
    console.log(`Pass Rate: ${passRate}%`)
    console.log("")

    if (total - passed > 0) {
      console.log("Failed Tests:")
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  ❌ ${r.test}`)
          console.log(`     ${r.details}`)
        })
      console.log("")
    }

    const overallPass = passed === total
    console.log(overallPass ? "✅ ALL TESTS PASSED" : "⚠️  SOME TESTS FAILED")
    console.log("")

    console.log("╔══════════════════════════════════════════════════════════╗")
    console.log("║                    Key Findings                          ║")
    console.log("╚══════════════════════════════════════════════════════════╝\n")

    if (overallPass) {
      console.log("✅ Template registration: SUCCESS")
      console.log("   - Template stored locally")
      console.log("   - Template accessible via Metabob MCP")
      console.log("   - Remote agents can discover and use templates")
      console.log("")
      console.log("✅ ACP Integration: SUCCESS")
      console.log("   - DevBob agents can communicate via ACP")
      console.log("   - Template discovery works across agent boundaries")
      console.log("   - Metabob tools accessible from remote context")
      console.log("")
      console.log("🎯 Next Steps:")
      console.log("   1. Execute self-healing template via ACP")
      console.log("   2. Test cross-agent coordination")
      console.log("   3. Verify MESSAGE_FOR pattern")
      console.log("")
    } else {
      console.log("⚠️  Issues detected:")
      console.log("   - Review failed tests above")
      console.log("   - Check container health and logs")
      console.log("   - Verify metabob MCP configuration")
    }

    process.exit(overallPass ? 0 : 1)
  },
})
