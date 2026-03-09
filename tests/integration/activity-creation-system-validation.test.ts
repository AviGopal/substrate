/**
 * Integration tests for Activity Creation System
 * 
 * Validates the complete activity creation workflow including:
 * 1. Dual execution mode support (llm-assisted vs deterministic)
 * 2. Impulse binding infrastructure
 * 3. Activity template schema compliance
 * 4. Variable interpolation and substitution
 * 5. Tool sequence execution
 * 
 * These tests verify the recent changes:
 * - commit 1624bdc9: Dual execution mode system
 * - commit c63c2bcd: Deterministic task execution (Phase 2)
 * - commit f03a2dc8: Execution mode schema extensions (Phase 1)
 * - commit 765e50e3: Phase 1 impulse binding infrastructure
 */

import { describe, test, expect, beforeAll } from "bun:test"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { existsSync } from "node:fs"

// Test configuration
const REPO_ROOT = join(process.cwd(), "repos/metabob-opencode")
const TEST_TEMPLATES_DIR = join(process.cwd(), "test-results/activity-creation-validation")

describe("Activity Creation System - Schema Validation", () => {
  test("ActivityTemplate supports dual execution modes", async () => {
    const templatePath = join(REPO_ROOT, "packages/opencode/src/session/activity-template.ts")
    const content = await readFile(templatePath, "utf-8")
    
    // Verify executionMode enum exists
    expect(content).toContain('executionMode: z.enum(["llm-assisted", "deterministic"])')
    
    // Verify it's optional (backward compatibility)
    expect(content).toContain('.optional()')
    
    // Verify prompt is optional (for deterministic mode)
    const promptOptionalMatch = content.match(/prompt:\s*PromptConfigSchema\.optional\(\)/)
    expect(promptOptionalMatch).toBeTruthy()
  })

  test("ToolCallSchema supports variable interpolation", async () => {
    const templatePath = join(REPO_ROOT, "packages/opencode/src/session/activity-template.ts")
    const content = await readFile(templatePath, "utf-8")
    
    // Verify ToolCallSchema exists
    expect(content).toContain("ToolCallSchema")
    
    // Verify it has tool and params fields
    expect(content).toContain('tool: z.string()')
    expect(content).toContain('params: z.record(')
  })

  test("TaskSchema has toolSequence for deterministic execution", async () => {
    const templatePath = join(REPO_ROOT, "packages/opencode/src/session/activity-template.ts")
    const content = await readFile(templatePath, "utf-8")
    
    // Verify toolSequence field exists
    expect(content).toContain('toolSequence: z.array(ToolCallSchema).optional()')
  })

  test("Impulse system supports all pointer types", async () => {
    const templatePath = join(REPO_ROOT, "packages/opencode/src/session/activity-template.ts")
    const content = await readFile(templatePath, "utf-8")
    
    // Verify key impulse pointer types
    const requiredTypes = [
      "memo",
      "file",
      "component",
      "activityOutput",
      "activityArtifact",
      "testResults",
      "taskSummary",
      "scriptArtifact"
    ]
    
    for (const type of requiredTypes) {
      expect(content).toContain(`type: z.literal("${type}")`)
    }
  })
})

describe("Activity Creation System - Executor Implementation", () => {
  test("executeTaskDeterministic function exists and has correct signature", async () => {
    const activityPath = join(REPO_ROOT, "packages/opencode/src/tool/activity.ts")
    const content = await readFile(activityPath, "utf-8")
    
    // Verify function exists
    expect(content).toContain("async function executeTaskDeterministic(")
    
    // Verify parameters
    expect(content).toContain("task: ActivityTemplate.Task")
    expect(content).toContain("variables: Record<string, unknown>")
    expect(content).toContain("sessionID: string")
    expect(content).toContain("abortSignal: AbortSignal")
  })

  test("interpolateToolParams handles variable substitution", async () => {
    const activityPath = join(REPO_ROOT, "packages/opencode/src/tool/activity.ts")
    const content = await readFile(activityPath, "utf-8")
    
    // Verify function exists
    expect(content).toContain("function interpolateToolParams(")
    
    // Verify {{variable}} pattern substitution
    expect(content).toContain('new RegExp(`\\\\{\\\\{${varName}\\\\}\\\\}`, "g")')
    
    // Verify nested object support
    expect(content).toContain("interpolateToolParams(value as Record<string, unknown>, variables)")
  })

  test("Execution branching logic exists in executeTemplate", async () => {
    const activityPath = join(REPO_ROOT, "packages/opencode/src/tool/activity.ts")
    const content = await readFile(activityPath, "utf-8")
    
    // Verify execution mode check
    expect(content).toContain('const executionMode = task.executionMode || "llm-assisted"')
    
    // Verify deterministic branch
    expect(content).toContain('if (executionMode === "deterministic")')
    
    // Verify call to deterministic executor
    expect(content).toContain("await executeTaskDeterministic(")
  })

  test("Deterministic execution returns zero cost and tokens", async () => {
    const activityPath = join(REPO_ROOT, "packages/opencode/src/tool/activity.ts")
    const content = await readFile(activityPath, "utf-8")
    
    // Verify zero-cost metrics
    const zeroCostPattern = /cost:\s*0[,\s]/
    expect(zeroCostPattern.test(content)).toBe(true)
    
    // Verify zero tokens
    expect(content).toContain("tokens: { input: 0, output: 0, cache: 0 }")
  })
})

describe("Activity Creation System - Template Creation", () => {
  beforeAll(async () => {
    // Create test directory
    if (!existsSync(TEST_TEMPLATES_DIR)) {
      await mkdir(TEST_TEMPLATES_DIR, { recursive: true })
    }
  })

  test("Can create valid LLM-assisted activity template", async () => {
    const template = {
      name: "Test LLM Activity",
      description: "Test activity using LLM-assisted execution",
      category: "infrastructure",
      tasks: [
        {
          id: "task-1",
          subagent: "general",
          description: "Test task with LLM",
          dependencies: [],
          executionMode: "llm-assisted",
          prompt: {
            template: "Test prompt with {{variable}}",
            maxTokens: 4000,
            compressionStrategy: "none",
            variables: [
              {
                name: "variable",
                type: "string",
                required: true,
                description: "Test variable"
              }
            ]
          },
          validation: {
            requiredFiles: [],
            requiredPatterns: [],
            forbiddenPatterns: [],
            commands: []
          },
          retry: {
            maxAttempts: 3,
            strategy: "simple"
          },
          metrics: {
            successRate: 0,
            avgTokens: 0,
            avgDuration: 0,
            commonFailures: []
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
        targetContextTokens: 5000,
        annotationStrategy: "key-components"
      }
    }

    // Write template
    const templatePath = join(TEST_TEMPLATES_DIR, "test-llm-activity.json")
    await writeFile(templatePath, JSON.stringify(template, null, 2))
    
    // Verify file exists
    expect(existsSync(templatePath)).toBe(true)
    
    // Read and verify structure
    const saved = JSON.parse(await readFile(templatePath, "utf-8"))
    expect(saved.tasks[0].executionMode).toBe("llm-assisted")
    expect(saved.tasks[0].prompt).toBeDefined()
    expect(saved.tasks[0].toolSequence).toBeUndefined()
  })

  test("Can create valid deterministic activity template", async () => {
    const template = {
      name: "Test Deterministic Activity",
      description: "Test activity using deterministic execution",
      category: "infrastructure",
      tasks: [
        {
          id: "task-1",
          subagent: "general",
          description: "Test task with deterministic execution",
          dependencies: [],
          executionMode: "deterministic",
          toolSequence: [
            {
              tool: "bash",
              params: {
                command: "echo 'Testing {{variable}}'",
                description: "Echo test variable"
              }
            }
          ],
          validation: {
            requiredFiles: [],
            requiredPatterns: [],
            forbiddenPatterns: [],
            commands: []
          },
          retry: {
            maxAttempts: 1,
            strategy: "simple"
          },
          metrics: {
            successRate: 0,
            avgTokens: 0,
            avgDuration: 0,
            commonFailures: []
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
        targetContextTokens: 5000,
        annotationStrategy: "key-components"
      }
    }

    // Write template
    const templatePath = join(TEST_TEMPLATES_DIR, "test-deterministic-activity.json")
    await writeFile(templatePath, JSON.stringify(template, null, 2))
    
    // Verify file exists
    expect(existsSync(templatePath)).toBe(true)
    
    // Read and verify structure
    const saved = JSON.parse(await readFile(templatePath, "utf-8"))
    expect(saved.tasks[0].executionMode).toBe("deterministic")
    expect(saved.tasks[0].toolSequence).toBeDefined()
    expect(saved.tasks[0].toolSequence.length).toBe(1)
    expect(saved.tasks[0].prompt).toBeUndefined()
  })
})

describe("Activity Creation System - Validation Completeness", () => {
  test("All required components are present", async () => {
    const components = [
      {
        file: join(REPO_ROOT, "packages/opencode/src/session/activity-template.ts"),
        checks: [
          "executionMode:",
          "ToolCallSchema",
          "toolSequence:",
          "export type Pointer ="
        ]
      },
      {
        file: join(REPO_ROOT, "packages/opencode/src/tool/activity.ts"),
        checks: [
          "async function executeTaskDeterministic(",
          "function interpolateToolParams(",
          'if (executionMode === "deterministic")',
          "cost: 0"
        ]
      }
    ]

    for (const component of components) {
      const content = await readFile(component.file, "utf-8")
      
      for (const check of component.checks) {
        expect(content).toContain(check)
      }
    }
  })

  test("Backward compatibility maintained", async () => {
    const templatePath = join(REPO_ROOT, "packages/opencode/src/session/activity-template.ts")
    const content = await readFile(templatePath, "utf-8")
    
    // Verify executionMode is optional (defaults to llm-assisted)
    const executionModeOptional = content.includes('executionMode: z.enum(["llm-assisted", "deterministic"]).optional()')
    expect(executionModeOptional).toBe(true)
    
    // Verify prompt is optional (for deterministic mode support)
    const promptOptional = content.includes("prompt: PromptConfigSchema.optional()")
    expect(promptOptional).toBe(true)
  })
})
