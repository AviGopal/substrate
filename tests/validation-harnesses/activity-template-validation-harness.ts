#!/usr/bin/env bun

/**
 * Validation Harness for activity-template-validation Specification
 * 
 * Tests that templates are validated before registration:
 * - Case 1: Valid template with validate_before_register=true -> Success, executions=1
 * - Case 2: Broken template with validate_before_register=true -> Rejection with error
 * - Case 3: Broken template NOT in storage after rejection
 */

import path from "path"
import fs from "fs/promises"
import os from "os"

// Types
interface ValidationCase {
  id: string
  input: {
    template: any
    validate_before_register: boolean
    test_variables?: Record<string, any>
  }
  expectedOutput: {
    success: boolean
    executions?: number
    successRate?: number
    errorMessage?: string
    templateInStorage?: boolean
  }
}

interface ValidationResult {
  pass: boolean
  caseId: string
  actual: any
  expected: any
  error?: string
}

// Test cases
const TEST_CASES: ValidationCase[] = [
  {
    id: "validation-activity-template-validation-case-1",
    input: {
      template: {
        name: "Valid Test Template",
        description: "A working template for validation testing",
        category: "infrastructure",
        tasks: [
          {
            id: "task-1",
            subagent: "general",
            description: "Echo test message",
            dependencies: [],
            prompt: {
              template: "Echo: {{message}}",
              maxTokens: 500,
              compressionStrategy: "filter",
              variables: [
                {
                  name: "message",
                  type: "string",
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
              strategy: "simple",
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
          annotationStrategy: "key-components",
        },
      },
      validate_before_register: true,
      test_variables: { message: "Hello validation!" },
    },
    expectedOutput: {
      success: true,
      executions: 1,
      successRate: 1.0,
      templateInStorage: true,
    },
  },
  {
    id: "validation-activity-template-validation-case-2",
    input: {
      template: {
        name: "Broken Test Template",
        description: "A broken template that should fail validation",
        category: "infrastructure",
        tasks: [
          {
            id: "task-1",
            subagent: "general",
            description: "Task that will fail",
            dependencies: [],
            prompt: {
              template: "This task references {{missingVariable}} which doesn't exist",
              maxTokens: 500,
              compressionStrategy: "filter",
              variables: [],
            },
            validation: {
              requiredFiles: ["/nonexistent/file.txt"],
              requiredPatterns: [],
              forbiddenPatterns: [],
              commands: [],
            },
            retry: {
              maxAttempts: 1,
              strategy: "simple",
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
          annotationStrategy: "key-components",
        },
      },
      validate_before_register: true,
      test_variables: {},
    },
    expectedOutput: {
      success: false,
      errorMessage: "Template validation failed",
      templateInStorage: false,
    },
  },
]

/**
 * Run validation for a single test case
 */
async function runValidation(testCase: ValidationCase): Promise<ValidationResult> {
  const testDir = path.join(os.tmpdir(), `validation-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(testDir, { recursive: true })

  try {
    // Write template to file
    const templatePath = path.join(testDir, "template.json")
    await fs.writeFile(templatePath, JSON.stringify(testCase.input.template, null, 2))

    // Dynamic import to avoid circular dependencies
    const { RegisterActivityTemplateTool } = await import(
      "../../repos/metabob-opencode/packages/opencode/src/tool/register-activity-template"
    )
    const { ActivityTemplate } = await import(
      "../../repos/metabob-opencode/packages/opencode/src/session/activity-template"
    )
    const { Storage } = await import("../../repos/metabob-opencode/packages/opencode/src/storage/storage")
    const { Instance } = await import("../../repos/metabob-opencode/packages/opencode/src/project/instance")

    const tool = await RegisterActivityTemplateTool.init()
    const templateId = testCase.input.template.name.toLowerCase().replace(/\s+/g, "-")
    const projectRoot = path.join(__dirname, "../../repos/metabob-opencode")

    let actual: any = {}

    // Wrap execution in Instance.provide to ensure proper context
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        // Clean up any existing template
        try {
          if (await ActivityTemplate.exists(templateId)) {
            await Storage.remove(["activity-template", templateId])
          }
        } catch {
          // Ignore
        }

        try {
          // Execute registration
          const result = await tool.execute(
            {
              file_path: templatePath,
              validate_before_register: testCase.input.validate_before_register,
              test_variables: testCase.input.test_variables,
              register_with_metabob: false,
            },
            {
              sessionID: "ses_validation_test_" + Date.now(),
              messageID: "msg_validation_" + Date.now(),
              agent: "tool",
              abort: new AbortController().signal,
              metadata: () => {},
            }
          )

          actual.success = true
          actual.result = result

          // Check if template is in storage
          const exists = await ActivityTemplate.exists(templateId)
          actual.templateInStorage = exists

          // Load template and check metrics
          if (exists) {
            const loaded = await ActivityTemplate.load(templateId)
            actual.executions = loaded.executions
            actual.successRate = loaded.successRate
          }

          // Clean up
          if (exists) {
            await Storage.remove(["activity-template", templateId])
          }
        } catch (error: any) {
          actual.success = false
          actual.errorMessage = error.message

          // Check if template is in storage after failure
          const exists = await ActivityTemplate.exists(templateId)
          actual.templateInStorage = exists

          // Clean up if somehow still exists
          if (exists) {
            await Storage.remove(["activity-template", templateId])
          }
        }
      },
    })

    // Compare actual vs expected
    const pass = compareResults(actual, testCase.expectedOutput)

    return {
      pass,
      caseId: testCase.id,
      actual,
      expected: testCase.expectedOutput,
    }
  } finally {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  }
}

/**
 * Compare actual vs expected results
 */
function compareResults(actual: any, expected: any): boolean {
  // Check success match
  if (actual.success !== expected.success) {
    return false
  }

  // If expected to succeed
  if (expected.success) {
    // Check executions
    if (expected.executions !== undefined && actual.executions !== expected.executions) {
      return false
    }

    // Check successRate
    if (expected.successRate !== undefined && actual.successRate !== expected.successRate) {
      return false
    }

    // Check template in storage
    if (expected.templateInStorage !== undefined && actual.templateInStorage !== expected.templateInStorage) {
      return false
    }
  }

  // If expected to fail
  if (!expected.success) {
    // Check error message contains expected text
    if (expected.errorMessage && !actual.errorMessage?.includes(expected.errorMessage)) {
      return false
    }

    // Check template NOT in storage
    if (expected.templateInStorage !== undefined && actual.templateInStorage !== expected.templateInStorage) {
      return false
    }
  }

  return true
}

/**
 * Run all validation test cases
 */
async function runAllValidations(): Promise<{ passed: number; failed: number; results: ValidationResult[] }> {
  console.log("Running activity-template-validation harness...")
  console.log("=" .repeat(80))
  console.log()

  const results: ValidationResult[] = []

  for (const testCase of TEST_CASES) {
    console.log(`Running ${testCase.id}...`)
    const result = await runValidation(testCase)
    results.push(result)

    if (result.pass) {
      console.log(`✅ PASS`)
    } else {
      console.log(`❌ FAIL`)
      console.log(`  Expected: ${JSON.stringify(result.expected, null, 2)}`)
      console.log(`  Actual:   ${JSON.stringify(result.actual, null, 2)}`)
    }
    console.log()
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  console.log("=" .repeat(80))
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log()

  return { passed, failed, results }
}

// Export for programmatic use
export { runValidation, runAllValidations, TEST_CASES }

// Run if executed directly
if (import.meta.main) {
  runAllValidations()
    .then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error("Validation harness error:", error)
      process.exit(1)
    })
}
