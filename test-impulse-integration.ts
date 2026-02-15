#!/usr/bin/env tsx

/**
 * Test script for impulse integration with activity hooks
 * 
 * This script:
 * 1. Creates a session with test impulses
 * 2. Registers the test activity template
 * 3. Executes the activity with impulse hooks
 * 4. Verifies impulses were loaded and persisted correctly
 */

import { Session } from "./repos/metabob-opencode/packages/opencode/src/session/index"
import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/memory"
import { TemplateExecutor } from "./repos/metabob-opencode/packages/opencode/src/session/template-executor"
import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"
import { Activity } from "./repos/metabob-opencode/packages/opencode/src/session/activity"
import { readFile } from "fs/promises"
import { join } from "path"

async function main() {
  console.log("=".repeat(60))
  console.log("Impulse Integration Test - Phase 2")
  console.log("=".repeat(60))
  console.log()

  // Step 1: Create a test session
  console.log("Step 1: Creating test session...")
  const session = await Session.create({
    title: "Impulse Integration Test Session",
    agentName: "general",
  })
  console.log(`✓ Session created: ${session.id}`)
  console.log()

  // Step 2: Add test impulses to session
  console.log("Step 2: Adding test impulses to session...")
  
  // Add design-requirements impulse
  await SessionMemory.addImpulse(session.id, {
    id: "design-requirements",
    pointer: {
      type: "memo",
      content: `# Design Requirements

This is a test impulse containing design requirements.

## Requirements
1. System should load impulses from session memory
2. System should make impulses available to activity tasks
3. System should persist new impulses back to session memory

## Success Criteria
- preActivity hook loads impulses successfully
- Tasks can access impulse content
- postActivity hook persists new impulses
`,
    },
    budget: 2000,
    scope: "session",
    sessionID: session.id,
    priority: "high",
  })
  console.log("✓ Added 'design-requirements' impulse")

  // Add api-spec impulse
  await SessionMemory.addImpulse(session.id, {
    id: "api-spec",
    pointer: {
      type: "memo",
      content: `# API Specification

This is a test impulse containing API specifications.

## Endpoints
- preActivity: loadImpulses hook
- postActivity: persistImpulses hook

## Data Flow
Session → preActivity → Activity → Tasks → postActivity → Session
`,
    },
    budget: 1500,
    scope: "session",
    sessionID: session.id,
    priority: "medium",
  })
  console.log("✓ Added 'api-spec' impulse")
  console.log()

  // Step 3: Load and register test template
  console.log("Step 3: Loading test activity template...")
  const templatePath = join(__dirname, "test-impulse-integration-activity.json")
  const templateContent = await readFile(templatePath, "utf-8")
  const template = JSON.parse(templateContent)
  
  // Register template with repository (in-memory for this test)
  await TemplateRepository.register(template)
  console.log(`✓ Template registered: ${template.id}`)
  console.log()

  // Step 4: Execute activity with template
  console.log("Step 4: Executing activity with impulse hooks...")
  console.log("   → preActivity hook will load impulses from session")
  console.log("   → Tasks will process and create new impulses")
  console.log("   → postActivity hook will persist new impulses")
  console.log()

  try {
    const result = await TemplateExecutor.execute({
      templateId: template.id,
      variables: {},
      callingSessionId: session.id,
      reason: "Test impulse integration with activity hooks",
      dryRun: false, // Run for real to test hooks
    })

    console.log()
    console.log("=".repeat(60))
    console.log("Execution Results")
    console.log("=".repeat(60))
    console.log(`Activity ID: ${result.activityId}`)
    console.log(`Success: ${result.success}`)
    console.log(`Total Duration: ${result.totalDuration}ms`)
    console.log(`Total Cost: $${result.totalCost.toFixed(4)}`)
    console.log()

    console.log("Task Execution Status:")
    for (const task of result.tasks) {
      const statusIcon = task.status === "completed" ? "✓" : task.status === "failed" ? "✗" : "⊙"
      console.log(`  ${statusIcon} ${task.taskId}: ${task.status}`)
      if (task.duration) {
        console.log(`     Duration: ${task.duration}ms`)
      }
      if (task.error) {
        console.log(`     Error: ${task.error}`)
      }
    }
    console.log()

    // Step 5: Verify impulses in session after execution
    console.log("Step 5: Verifying impulse persistence...")
    
    const { impulses } = await Session.impulses(session.id)
    console.log(`Total impulses in session: ${impulses.length}`)
    console.log()

    console.log("Impulse Inventory:")
    for (const impulse of impulses) {
      console.log(`  • ${impulse.id} (${impulse.scope}, priority: ${impulse.priority})`)
      if (impulse.tokenCount) {
        console.log(`    Tokens: ${impulse.tokenCount}`)
      }
    }
    console.log()

    // Check for implementation-notes impulse (should be persisted by postActivity)
    const implementationNotes = impulses.find(i => i.id === "implementation-notes")
    if (implementationNotes) {
      console.log("✓ SUCCESS: 'implementation-notes' impulse was persisted to session!")
      console.log(`   Scope: ${implementationNotes.scope}`)
      console.log(`   Priority: ${implementationNotes.priority}`)
    } else {
      console.log("✗ FAIL: 'implementation-notes' impulse NOT found in session")
    }
    console.log()

    // Step 6: Check test output files
    console.log("Step 6: Checking test output files...")
    const testFiles = [
      "/tmp/impulse-test-verification.txt",
      "/tmp/implementation-notes.txt",
      "/tmp/impulse-integration-test-report.md",
    ]

    for (const filePath of testFiles) {
      try {
        const content = await readFile(filePath, "utf-8")
        console.log(`✓ ${filePath} exists (${content.length} bytes)`)
      } catch (error) {
        console.log(`✗ ${filePath} NOT FOUND`)
      }
    }
    console.log()

    // Final summary
    console.log("=".repeat(60))
    console.log("Test Summary")
    console.log("=".repeat(60))
    console.log("✓ Phase 1: Session created with test impulses")
    console.log("✓ Phase 2: Activity template loaded and registered")
    console.log(`${result.success ? "✓" : "✗"} Phase 3: Activity executed`)
    console.log(`${implementationNotes ? "✓" : "✗"} Phase 4: New impulse persisted to session`)
    console.log()

    if (result.success && implementationNotes) {
      console.log("🎉 INTEGRATION TEST PASSED!")
      console.log()
      console.log("The impulse integration is working correctly:")
      console.log("  • preActivity hook loaded impulses from SessionMemory")
      console.log("  • Tasks had access to impulse content")
      console.log("  • postActivity hook persisted new impulses back to SessionMemory")
    } else {
      console.log("⚠️  INTEGRATION TEST FAILED")
      console.log()
      console.log("Issues detected:")
      if (!result.success) {
        console.log("  • Activity execution failed")
      }
      if (!implementationNotes) {
        console.log("  • New impulse was not persisted to session")
      }
    }
    console.log()

  } catch (error) {
    console.error("❌ Test execution failed:")
    console.error(error)
    process.exit(1)
  }
}

// Run the test
main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
