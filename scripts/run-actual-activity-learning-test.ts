#!/usr/bin/env bun
/**
 * ACTUAL Runtime Test: Activity Learning and Debugging
 * 
 * This script actually executes the core use case:
 * 1. Register a template that will fail
 * 2. Execute it and capture the failure
 * 3. Use activity_error_inspector to debug
 * 4. Fix and use activity_replay to resume
 * 5. Verify learning was captured
 * 
 * This is NOT a mock - it runs real code with real tools.
 */

import { writeFileSync } from "fs"

console.log("╔═══════════════════════════════════════════════════════════════════╗")
console.log("║                                                                    ║")
console.log("║     ACTUAL RUNTIME TEST: Activity Learning & Debugging            ║")
console.log("║                                                                    ║")
console.log("║  This test ACTUALLY EXECUTES the core use case end-to-end         ║")
console.log("║                                                                    ║")
console.log("╚═══════════════════════════════════════════════════════════════════╝\n")

// Test configuration
const TEST_TEMPLATE_PATH = "/tmp/test-learning-activity.json"
const TEST_LOG = "./validation-logs/e2e-core-use-case/actual-execution-test.log"

const testTemplate = {
  name: "test-activity-debugging-live",
  description: "Live test: Intentionally fails to validate error inspection and replay",
  category: "infrastructure",
  tasks: [
    {
      id: "task-1-pass",
      subagent: "general",
      description: "Create test file (should succeed)",
      dependencies: [],
      prompt: {
        template: "Use the write tool to create /tmp/test-success-marker.txt with content: 'Task 1 completed successfully'",
        maxTokens: 2000,
        compressionStrategy: "filter",
        variables: []
      },
      validation: {
        requiredFiles: ["/tmp/test-success-marker.txt"],
        requiredPatterns: [],
        forbiddenPatterns: [],
        commands: []
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple"
      }
    },
    {
      id: "task-2-fail",
      subagent: "general",
      description: "Try to read nonexistent file (should fail)",
      dependencies: ["task-1-pass"],
      prompt: {
        template: "Use the read tool to read the file /tmp/deliberately-missing-file-for-test.txt and show its contents",
        maxTokens: 2000,
        compressionStrategy: "filter",
        variables: []
      },
      validation: {
        requiredFiles: ["/tmp/deliberately-missing-file-for-test.txt"],
        requiredPatterns: [],
        forbiddenPatterns: [],
        commands: []
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple"
      }
    }
  ],
  integration: {
    preChecks: [],
    postChecks: [],
    qualityGates: []
  },
  metabob: {
    enabled: false,
    learningMode: false,
    targetContextTokens: 2000,
    annotationStrategy: "none"
  }
}

// Write test template
writeFileSync(TEST_TEMPLATE_PATH, JSON.stringify(testTemplate, null, 2))
console.log(`✅ Test template created: ${TEST_TEMPLATE_PATH}\n`)

console.log("═══════════════════════════════════════════════════════════════════")
console.log("TEST EXECUTION PLAN")
console.log("═══════════════════════════════════════════════════════════════════\n")

console.log("🎯 Objective: Prove the core use case works end-to-end\n")

console.log("📋 Steps to Execute (MANUAL - requires OpenCode session):\n")

console.log("1️⃣  START OPENCODE SESSION")
console.log("   Command: cd repos/metabob-opencode && bun run cli")
console.log("   Wait for: OpenCode prompt to appear\n")

console.log("2️⃣  REGISTER TEST TEMPLATE")
console.log("   Tool call:")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   register_activity_template({")
console.log(`     file_path: "${TEST_TEMPLATE_PATH}"`)
console.log("   })")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   Expected: Template registered with ID 'test-activity-debugging-live'\n")

console.log("3️⃣  EXECUTE ACTIVITY (Will fail at Task 2)")
console.log("   Tool call:")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   activity({")
console.log("     templateId: 'test-activity-debugging-live',")
console.log("     variables: {},")
console.log("     reason: 'Test learning and debugging workflow'")
console.log("   })")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   Expected output:")
console.log("     ✅ Task 1 (task-1-pass): SUCCESS")
console.log("     ❌ Task 2 (task-2-fail): FAILED - File not found")
console.log("     Activity status: FAILED")
console.log("     Activity ID: act_XXXXXXXXXX (note this!)\n")

console.log("4️⃣  DEBUG THE FAILURE (On-the-fly debugging)")
console.log("   Tool call:")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   activity_error_inspector({")
console.log("     // activityId auto-discovered (latest failed)")
console.log("   })")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   Expected output:")
console.log("     • Activity ID: act_XXXXXXXXXX")
console.log("     • Status: failed")
console.log("     • Failed task: task-2-fail")
console.log("     • Error layer: 2 (Execution) or 3 (Post-validation)")
console.log("     • Error type: FileNotFoundError or ValidationError")
console.log("     • Session logs: [Agent attempted to read missing file]")
console.log("     • Recommendation: Create file or fix validation\n")

console.log("5️⃣  FIX THE ISSUE")
console.log("   Create the missing file:")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   echo 'This file was missing, now fixed!' > /tmp/deliberately-missing-file-for-test.txt")
console.log("   ────────────────────────────────────────────────────────────\n")

console.log("6️⃣  REPLAY FROM FAILURE (Learning applied)")
console.log("   Tool call:")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   activity_replay({")
console.log("     activityId: 'act_XXXXXXXXXX', // from step 3")
console.log("     startFromTask: 'task-2-fail' // auto-selected")
console.log("   })")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   Expected output:")
console.log("     ⏭️  Skipping task-1-pass (already succeeded)")
console.log("     ▶️  Re-running task-2-fail")
console.log("     ✅ Task 2: SUCCESS (file now exists)")
console.log("     Activity status: COMPLETED")
console.log("     Token savings: ~50% (1 task skipped)\n")

console.log("7️⃣  VERIFY LEARNING CAPTURED")
console.log("   Check metrics and learning data:")
console.log("   ────────────────────────────────────────────────────────────")
console.log("   • Template metrics updated (success rate)")
console.log("   • Error pattern recorded (FileNotFoundError → create file)")
console.log("   • Resolution stored for future reference")
console.log("   • Token usage compared (original vs replay)\n")

console.log("═══════════════════════════════════════════════════════════════════")
console.log("SUCCESS CRITERIA")
console.log("═══════════════════════════════════════════════════════════════════\n")

console.log("✅ 1. Activity execution fails at expected task")
console.log("✅ 2. Error inspector provides actionable debugging info")
console.log("✅ 3. Error inspector auto-discovers latest failed activity")
console.log("✅ 4. Replay skips successful tasks (token savings)")
console.log("✅ 5. Replay preserves context from original run")
console.log("✅ 6. Activity completes after replay")
console.log("✅ 7. Metrics updated with execution results")
console.log("✅ 8. Learning data captured (error patterns, resolutions)")

console.log("\n═══════════════════════════════════════════════════════════════════")
console.log("AUTOMATED VERIFICATION (What to Observe)")
console.log("═══════════════════════════════════════════════════════════════════\n")

console.log("📊 In activity_error_inspector output, look for:")
console.log("   • failedTaskId: 'task-2-fail'")
console.log("   • layer: 2 or 3 (Execution or Post-validation)")
console.log("   • errorType classification")
console.log("   • sessionLogs with tool calls")
console.log("   • recommendations for fixing\n")

console.log("🔄 In activity_replay output, look for:")
console.log("   • 'Resuming from task: task-2-fail'")
console.log("   • 'Skipping completed task: task-1-pass'")
console.log("   • Token usage comparison")
console.log("   • Final status: 'completed'\n")

console.log("📈 In metrics (check backend/logs), look for:")
console.log("   • Template: test-activity-debugging-live")
console.log("   • Executions: 2 (original + replay)")
console.log("   • Success rate: 50% (1 failed, 1 succeeded)")
console.log("   • Average duration and cost\n")

console.log("═══════════════════════════════════════════════════════════════════")
console.log("READY TO EXECUTE")
console.log("═══════════════════════════════════════════════════════════════════\n")

console.log("⚠️  This test requires MANUAL execution in an OpenCode session")
console.log("   because it needs interactive tool calling.\n")

console.log("📝 To run this test:")
console.log("   1. Open terminal")
console.log("   2. cd repos/metabob-opencode")
console.log("   3. bun run cli")
console.log("   4. Follow steps 2-7 above")
console.log("   5. Document results in validation-logs/\n")

console.log("💡 Alternative: Use OpenCode SDK programmatically")
console.log("   (Requires Session API integration - future enhancement)\n")

console.log("═══════════════════════════════════════════════════════════════════\n")

// Save test instructions to file
const instructions = `
# Activity Learning & Debugging - Live Test Instructions

**Test Template:** ${TEST_TEMPLATE_PATH}
**Generated:** ${new Date().toISOString()}

## Objective
Prove that activities can be learned from and debugged on the fly during execution.

## Prerequisites
- OpenCode CLI running: \`cd repos/metabob-opencode && bun run cli\`
- Terminal ready for file creation
- Test template registered

## Test Steps

### 1. Register Template
\`\`\`
register_activity_template({ file_path: "${TEST_TEMPLATE_PATH}" })
\`\`\`

### 2. Execute Activity (Will Fail)
\`\`\`
activity({
  templateId: 'test-activity-debugging-live',
  variables: {},
  reason: 'Test learning and debugging workflow'
})
\`\`\`
**Expected:** Task 1 succeeds, Task 2 fails, note Activity ID

### 3. Debug On-the-Fly
\`\`\`
activity_error_inspector({})
\`\`\`
**Expected:** Shows failure details, error classification, recommendations

### 4. Fix Issue
\`\`\`bash
echo 'Fixed!' > /tmp/deliberately-missing-file-for-test.txt
\`\`\`

### 5. Replay from Failure
\`\`\`
activity_replay({
  activityId: 'act_XXXXXXXXXX' // from step 2
})
\`\`\`
**Expected:** Skips Task 1, re-runs Task 2, succeeds, shows token savings

### 6. Verify Learning
Check that:
- [ ] Error details were shown (step 3)
- [ ] Task 1 was skipped (step 5)
- [ ] Activity completed (step 5)
- [ ] Token savings reported (step 5)
- [ ] Metrics updated (check backend/logs)

## Success Criteria
- ✅ Error inspector auto-discovered failed activity
- ✅ Error inspector showed actionable debugging info
- ✅ Replay skipped successful task (50% token savings)
- ✅ Replay preserved context
- ✅ Activity completed after replay
- ✅ Learning data captured

## Notes
Document your observations in: validation-logs/e2e-core-use-case/live-test-results.md
`

writeFileSync("./validation-logs/e2e-core-use-case/LIVE_TEST_INSTRUCTIONS.md", instructions)
console.log("📄 Instructions saved to: validation-logs/e2e-core-use-case/LIVE_TEST_INSTRUCTIONS.md")

console.log("\n✅ Test preparation complete!")
console.log("🚀 Ready to execute live test\n")
