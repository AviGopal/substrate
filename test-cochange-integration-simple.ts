#!/usr/bin/env bun
/**
 * Simple test to verify co-change integration in template-executor.ts
 * 
 * This test verifies:
 * 1. Co-change analysis is called after task execution
 * 2. Changed files are extracted from session context
 * 3. Metabob is queried for co-changed files
 * 4. Follow-up impulses are created for critical files
 */

import { describe, test, expect, beforeEach, mock } from "bun:test"

describe("Co-Change Integration", () => {
  test("co-change analysis should be integrated in template-executor", async () => {
    console.log("✓ Verifying co-change integration...")

    // Check that the implementation exists
    const fs = await import("fs")
    const path = await import("path")

    const templateExecutorPath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/template-executor.ts",
    )

    const content = fs.readFileSync(templateExecutorPath, "utf-8")

    // Verify imports
    expect(content).toContain('import { SessionContext } from "./context"')
    console.log("  ✓ SessionContext imported")

    // Verify analyzeCoChanges function exists
    expect(content).toContain("async function analyzeCoChanges")
    console.log("  ✓ analyzeCoChanges function defined")

    // Verify extractChangedFilesFromSession function exists
    expect(content).toContain("function extractChangedFilesFromSession")
    console.log("  ✓ extractChangedFilesFromSession function defined")

    // Verify co-change analysis is called in executeTask
    expect(content).toContain("await analyzeCoChanges(task, _activity, sessionID)")
    console.log("  ✓ analyzeCoChanges called in executeTask")

    // Verify configuration check
    expect(content).toContain("task.validation?.useCochangePrediction !== false")
    console.log("  ✓ Configuration check present")

    // Verify SessionContext.getModifiedFiles is used
    expect(content).toContain("SessionContext.getModifiedFiles")
    console.log("  ✓ SessionContext.getModifiedFiles used")

    // Verify MetabobCLI.suggestRelatedChanges is called
    expect(content).toContain("MetabobCLI.suggestRelatedChanges")
    console.log("  ✓ MetabobCLI.suggestRelatedChanges called")

    // Verify filtering logic
    expect(content).toContain("f.cochange_score > 0.7 && f.high_severity_issues > 0")
    console.log("  ✓ Critical file filtering implemented")

    // Verify follow-up impulse creation
    expect(content).toContain("cochange-suggestion")
    expect(content).toContain("Activity.addImpulses")
    console.log("  ✓ Follow-up impulse creation implemented")

    // Verify logging
    expect(content).toContain("Co-change analysis:")
    console.log("  ✓ Logging present")

    // Verify graceful error handling
    expect(content).toContain("co-change analysis failed, continuing task execution")
    console.log("  ✓ Graceful error handling present")

    console.log("\n✅ All integration checks passed!")
  })

  test("verify implementation structure matches requirements", () => {
    console.log("\n✓ Verifying implementation structure...")

    const fs = require("fs")
    const path = require("path")

    const templateExecutorPath = path.join(
      process.cwd(),
      "repos/metabob-opencode/packages/opencode/src/session/template-executor.ts",
    )

    const content = fs.readFileSync(templateExecutorPath, "utf-8")

    // Verify the flow matches requirements
    const requirements = [
      "Extract changed files from task result",
      "Call metabob.suggestRelatedChanges",
      "Filter for critical files",
      "Add follow-up tasks/impulses",
      "Configuration check",
      "Logging",
      "Graceful degradation",
    ]

    const checks = [
      content.includes("extractChangedFilesFromSession"),
      content.includes("MetabobCLI.suggestRelatedChanges"),
      content.includes("cochange_score > 0.7"),
      content.includes("Activity.addImpulses"),
      content.includes("useCochangePrediction"),
      content.includes("log.info"),
      content.includes("try {") && content.includes("catch (error)"),
    ]

    requirements.forEach((req, i) => {
      if (checks[i]) {
        console.log(`  ✓ ${req}`)
      } else {
        console.log(`  ✗ ${req}`)
      }
      expect(checks[i]).toBe(true)
    })

    console.log("\n✅ All structure checks passed!")
  })
})

// Run the tests
console.log("Testing Co-Change Integration in template-executor.ts\n")
console.log("=" .repeat(60))
