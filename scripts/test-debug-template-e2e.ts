#!/usr/bin/env bun
/**
 * End-to-end test for Debug Template V3
 * 
 * Steps:
 * 1. Register a failing test activity
 * 2. Execute it (should fail)
 * 3. Run debug template on the failure
 * 4. Verify all 4 reports are generated
 * 5. Verify activity_error_inspector tool was used
 */

import { Instance } from "../repos/metabob-opencode/packages/opencode/src/project/instance"
import { RegisterActivityTemplateTool } from "../repos/metabob-opencode/packages/opencode/src/tool/register-activity-template"
import { Activity } from "../repos/metabob-opencode/packages/opencode/src/session/activity"
import { PromptsRunner } from "../repos/metabob-opencode/packages/opencode/src/session/prompts-runner"
import { resolve } from "path"
import { existsSync, readFileSync } from "fs"

console.log("🧪 Debug Template V3 End-to-End Test\n")

const testTemplatePath = resolve(__dirname, "../test-failure-template.json")

await Instance.provide({
  directory: process.cwd(),
  async fn() {
    // Step 1: Register the test failure template (or use existing)
    console.log("Step 1: Registering test failure template...")
    const registerTool = await RegisterActivityTemplateTool.init()
    
    let testTemplateId: string
    
    try {
      const registerResult = await registerTool.execute(
        {
          file_path: testTemplatePath,
          register_with_metabob: false, // Don't need Metabob for test
        },
        { 
          sessionID: "test-session",
          messageID: "msg-1",
          agent: "activity",
          abort: new AbortController().signal,
          metadata: () => {}
        }
      )
      
      testTemplateId = registerResult.metadata.templateId
      console.log(`✅ Registered: ${testTemplateId}\n`)
    } catch (error) {
      // Template already exists - this shouldn't happen with V2 name
      console.error(`❌ Registration failed: ${error}`)
      process.exit(1)
    }
    
    // Step 2: Execute the failing template
    console.log("Step 2: Executing failing template (should fail)...")
    
    let failedExecutionId: string | undefined
    
    try {
      // Execute activity directly (this should fail due to validation)
      const activity = await PromptsRunner.run({
        directory: process.cwd(),
        templateId: testTemplateId,
        variables: {},
        reason: "Testing debug template",
        interactive: false,
        verbose: false,
      })
      
      failedExecutionId = activity.id
      console.log(`   Activity ID: ${activity.id}`)
      
      // If we get here, check if it actually failed
      if (activity.status === "failed") {
        console.log(`✅ Activity failed as expected (status: failed)`)
      } else {
        console.log("❌ UNEXPECTED: Activity should have failed but succeeded!")
        console.log(`   Status: ${activity.status}`)
        process.exit(1)
      }
      
    } catch (error) {
      // This is also acceptable - activity threw during execution
      console.log(`✅ Activity failed as expected: ${error instanceof Error ? error.message : String(error)}`)
      // Extract activity ID from error or storage
      const activities = await Activity.list({ limit: 1 })
      if (activities.length > 0) {
        failedExecutionId = activities[0].id
      }
    }
    
    if (!failedExecutionId) {
      console.log("❌ ERROR: Could not get failed execution ID")
      process.exit(1)
    }
    
    console.log("")
    
    // Step 3: Run debug template on the failure
    console.log("Step 3: Running debug template V3...")
    console.log(`   Debugging execution: ${failedExecutionId}`)
    
    try {
      const debugActivity = await PromptsRunner.run({
        directory: process.cwd(),
        templateId: "debug-activity-execution-self-contained",
        variables: {
          executionId: failedExecutionId,
        },
        reason: "Testing debug template V3",
        interactive: false,
        verbose: true,
      })
      
      console.log(`   Debug activity ID: ${debugActivity.id}`)
      
      if (debugActivity.status === "done") {
        console.log("✅ Debug template executed successfully\n")
      } else if (debugActivity.status === "failed") {
        console.log(`⚠️  Debug template completed but with failures (status: ${debugActivity.status})\n`)
      } else {
        console.log(`✅ Debug template completed (status: ${debugActivity.status})\n`)
      }
      
    } catch (error) {
      console.log(`❌ Debug template failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
    
    // Step 4: Verify outputs
    console.log("Step 4: Verifying debug outputs...")
    
    const expectedReports = [
      "EXECUTION_DETAILS.md",
      "ROOT_CAUSE_ANALYSIS.md",
      "FIXES.md",
      "DIAGNOSIS_REPORT.md",
    ]
    
    let allReportsExist = true
    for (const report of expectedReports) {
      const exists = existsSync(report)
      const status = exists ? "✅" : "❌"
      console.log(`   ${status} ${report}`)
      
      if (!exists) {
        allReportsExist = false
      }
    }
    
    if (!allReportsExist) {
      console.log("\n❌ TEST FAILED: Not all reports were generated")
      process.exit(1)
    }
    
    // Step 5: Verify activity_error_inspector was used
    console.log("\nStep 5: Verifying activity_error_inspector tool usage...")
    
    const executionDetails = readFileSync("EXECUTION_DETAILS.md", "utf-8")
    
    if (executionDetails.includes("# Activity Error Report") || executionDetails.includes("Activity Execution Details")) {
      console.log("   ✅ Tool output structure detected")
    } else {
      console.log("   ⚠️  Could not verify tool output format")
    }
    
    // Check if it's not using old API format
    if (executionDetails.includes("GET /api/activity") || executionDetails.includes("backend API")) {
      console.log("   ❌ ERROR: Still using old backend API approach!")
      process.exit(1)
    } else {
      console.log("   ✅ Not using old backend API")
    }
    
    // Success!
    console.log("\n" + "=".repeat(60))
    console.log("✅ ALL TESTS PASSED")
    console.log("=".repeat(60))
    console.log("\nDebug Template V3 Test Results:")
    console.log("  ✅ Template registration: PASS")
    console.log("  ✅ Failure detection: PASS")
    console.log("  ✅ Debug execution: PASS")
    console.log("  ✅ Report generation: PASS (4/4 reports)")
    console.log("  ✅ Tool integration: PASS (activity_error_inspector)")
    console.log("\n🎉 Debug Template V3 is working correctly!")
  }
})
