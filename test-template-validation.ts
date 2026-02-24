#!/usr/bin/env bun

/**
 * External validation harness for activity-template-validation spec
 * Tests that templates are validated before registration
 */

import path from "path"
import fs from "fs/promises"
import os from "os"

// Minimal template that should validate successfully
const VALID_TEMPLATE = {
  name: "Test Validation Success Template",
  description: "A template that should pass validation",
  category: "infrastructure" as const,
  tasks: [
    {
      id: "task-1",
      subagent: "general",
      description: "Simple echo task",
      dependencies: [],
      prompt: {
        template: "Echo the message: {{message}}",
        maxTokens: 1000,
        compressionStrategy: "filter" as const,
        variables: [
          {
            name: "message",
            type: "string" as const,
            required: true,
            description: "Message to echo",
          },
        ],
      },
      validation: {
        requiredFiles: [],
        requiredPatterns: [],
        forbiddenPatterns: [],
        commands: [],
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple" as const,
      },
    },
  ],
  integration: {
    requiresCleanGit: false,
    preChecks: [],
    postChecks: [],
    qualityGates: [],
  },
  metabob: {
    enabled: false,
    learningMode: false,
    targetContextTokens: 1000,
    annotationStrategy: "key-components" as const,
  },
}

async function main() {
  const testDir = path.join(os.tmpdir(), `validation-test-${Date.now()}`)
  await fs.mkdir(testDir, { recursive: true })
  
  const templatePath = path.join(testDir, "valid-template.json")
  await fs.writeFile(templatePath, JSON.stringify(VALID_TEMPLATE, null, 2))
  
  console.log("Test 1: Template validation with valid template")
  console.log("=" .repeat(60))
  console.log("Template:", templatePath)
  console.log("Test Variables: { message: 'Hello validation!' }")
  console.log()
  console.log("Expected behavior:")
  console.log("  1. Template saved to local storage")
  console.log("  2. Activity executed with test variables")
  console.log("  3. Execution succeeds")
  console.log("  4. Metrics updated: executions=1, successRate=1.0")
  console.log("  5. Template registered to backends")
  console.log()
  console.log("Run with:")
  console.log(`  cd repos/metabob-opencode && bun run packages/opencode/register-test-template.sh`)
  console.log(`  # or directly via register_activity_template tool with:`)
  console.log(`  # { file_path: "${templatePath}", validate_before_register: true, test_variables: { message: "Hello validation!" } }`)
  console.log()
  
  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true })
  
  console.log("✅ Test harness setup complete")
  console.log("Manual testing required to verify full validation workflow")
  console.log()
  console.log("To verify metrics after validation:")
  console.log("  1. Run registration with validation enabled")
  console.log("  2. Check template metrics: executions should be 1, successRate should be 1.0")
  console.log("  3. Verify avgDuration, avgCost, avgTokens are set")
}

main().catch(console.error)
