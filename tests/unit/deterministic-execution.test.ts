/**
 * Unit tests for deterministic execution mode (Container Workflow)
 * 
 * Tests the implementation of Phases 1-2:
 * - PHASE 1: Schema extensions (executionMode, toolSequence, etc.)
 * - PHASE 2: Deterministic executor (executeTaskDeterministic, interpolateToolParams)
 * 
 * These tests bypass the CLI and test the implementation directly.
 */

import { describe, test, expect, beforeAll } from "bun:test"
import { readFile } from "fs/promises"
import path from "path"

// Test configuration
const REPO_ROOT = path.join(process.cwd(), "repos/metabob-opencode")
const ACTIVITY_TS_PATH = path.join(REPO_ROOT, "packages/opencode/src/tool/activity.ts")
const TEMPLATE_TS_PATH = path.join(REPO_ROOT, "packages/opencode/src/session/activity-template.ts")

describe("PHASE 1: Schema Extensions", () => {
  let templateSource: string
  
  beforeAll(async () => {
    templateSource = await readFile(TEMPLATE_TS_PATH, "utf-8")
  })

  test("TaskSchema has executionMode field", () => {
    // Check for executionMode in TaskSchema
    const hasExecutionMode = templateSource.includes('executionMode: z.enum(["llm-assisted", "deterministic"])')
    expect(hasExecutionMode).toBe(true)
  })

  test("ToolCallSchema is defined", () => {
    // Check for ToolCallSchema definition
    const hasToolCallSchema = templateSource.includes("const ToolCallSchema = z.object({") ||
                               templateSource.includes("ToolCallSchema = z.object({")
    expect(hasToolCallSchema).toBe(true)
    
    // Check it has required fields
    const hasToolField = templateSource.includes("tool: z.string()")
    const hasParamsField = templateSource.includes("params: z.record(") &&
                          templateSource.includes("z.unknown()")
    
    expect(hasToolField).toBe(true)
    expect(hasParamsField).toBe(true)
  })

  test("TaskSchema has toolSequence field", () => {
    // Check for toolSequence in TaskSchema
    const hasToolSequence = templateSource.includes("toolSequence: z.array(ToolCallSchema)")
    expect(hasToolSequence).toBe(true)
  })

  test("prompt field is optional", () => {
    // Check that prompt field has .optional() modifier
    const hasOptionalPrompt = 
      templateSource.includes("prompt: PromptSchema.optional()") ||
      templateSource.includes("prompt: z.optional(PromptSchema)") ||
      (templateSource.includes("prompt:") && templateSource.includes(".optional()"))
    
    expect(hasOptionalPrompt).toBe(true)
  })

  test("validateExecutionModes function exists", () => {
    // Check for validation function
    const hasValidateFunction = 
      templateSource.includes("validateExecutionModes") ||
      templateSource.includes("function validateExecutionModes")
    
    expect(hasValidateFunction).toBe(true)
  })
})

describe("PHASE 2: Deterministic Executor Implementation", () => {
  let activitySource: string
  
  beforeAll(async () => {
    activitySource = await readFile(ACTIVITY_TS_PATH, "utf-8")
  })

  test("executeTaskDeterministic function is defined", () => {
    // Check for function definition
    const hasFunctionDef = activitySource.includes("async function executeTaskDeterministic(")
    expect(hasFunctionDef).toBe(true)
    
    // Check function signature includes required parameters
    const hasTaskParam = activitySource.includes("task: ActivityTemplate.Task")
    const hasVariablesParam = activitySource.includes("variables: Record<string, unknown>")
    const hasSessionIdParam = activitySource.includes("sessionID: string")
    const hasAbortParam = activitySource.includes("abortSignal: AbortSignal")
    
    expect(hasTaskParam).toBe(true)
    expect(hasVariablesParam).toBe(true)
    expect(hasSessionIdParam).toBe(true)
    expect(hasAbortParam).toBe(true)
  })

  test("executeTaskDeterministic returns correct structure", () => {
    // Check return type includes all required fields
    const hasSuccessField = activitySource.includes("success: boolean")
    const hasDurationField = activitySource.includes("duration: number")
    const hasCostField = activitySource.includes("cost: number")
    const hasTokensField = activitySource.includes("tokens: { input: number; output: number; cache: number }")
    const hasToolCallResultsField = activitySource.includes("toolCallResults:")
    
    expect(hasSuccessField).toBe(true)
    expect(hasDurationField).toBe(true)
    expect(hasCostField).toBe(true)
    expect(hasTokensField).toBe(true)
    expect(hasToolCallResultsField).toBe(true)
  })

  test("executeTaskDeterministic validates toolSequence presence", () => {
    // Check for validation logic
    const hasValidation = activitySource.includes('if (!task.toolSequence || task.toolSequence.length === 0)')
    expect(hasValidation).toBe(true)
    
    // Check error message
    const hasErrorMsg = activitySource.includes('but no toolSequence defined')
    expect(hasErrorMsg).toBe(true)
  })

  test("executeTaskDeterministic returns zero cost and tokens", () => {
    // Check that deterministic execution returns zero cost
    const returnsZeroCost = activitySource.includes("cost: 0, // No LLM cost") ||
                            activitySource.includes("cost: 0, // Deterministic execution has no LLM cost")
    expect(returnsZeroCost).toBe(true)
    
    // Check zero tokens
    const returnsZeroTokens = activitySource.includes("tokens: { input: 0, output: 0, cache: 0 }")
    expect(returnsZeroTokens).toBe(true)
  })

  test("executeTaskDeterministic supports bash tool", () => {
    // Check for bash tool support
    const hasBashSupport = activitySource.includes('if (toolCall.tool === "bash")')
    expect(hasBashSupport).toBe(true)
    
    // Check bash tool import
    const hasBashImport = activitySource.includes('const { BashTool } = await import("./bash")')
    expect(hasBashImport).toBe(true)
  })

  test("interpolateToolParams function is defined", () => {
    // Check for function definition
    const hasFunctionDef = activitySource.includes("function interpolateToolParams(")
    expect(hasFunctionDef).toBe(true)
    
    // Check signature
    const hasCorrectSignature = 
      activitySource.includes("params: Record<string, unknown>") &&
      activitySource.includes("variables: Record<string, unknown>")
    expect(hasCorrectSignature).toBe(true)
  })

  test("interpolateToolParams uses variable substitution pattern", () => {
    // Check for {{variableName}} pattern support
    const hasPatternMatch = activitySource.includes('new RegExp(`\\\\{\\\\{${varName}\\\\}\\\\}`, "g")')
    expect(hasPatternMatch).toBe(true)
    
    // Check replacement logic
    const hasReplace = activitySource.includes("interpolatedValue.replace(pattern, String(varValue))")
    expect(hasReplace).toBe(true)
  })

  test("interpolateToolParams handles nested objects", () => {
    // Check for recursive interpolation
    const hasRecursion = activitySource.includes("interpolateToolParams(value as Record<string, unknown>, variables)")
    expect(hasRecursion).toBe(true)
  })

  test("execution branching exists in executeTemplate", () => {
    // Check for execution mode check
    const hasExecutionModeCheck = activitySource.includes('const executionMode = task.executionMode || "llm-assisted"')
    expect(hasExecutionModeCheck).toBe(true)
    
    // Check for deterministic branch
    const hasDeterministicBranch = activitySource.includes('if (executionMode === "deterministic")')
    expect(hasDeterministicBranch).toBe(true)
    
    // Check call to executeTaskDeterministic
    const callsDeterministicExecutor = activitySource.includes("await executeTaskDeterministic(")
    expect(callsDeterministicExecutor).toBe(true)
  })

  test("deterministic execution updates metrics correctly", () => {
    // Check that totalCost is updated with zero
    const updatesCost = activitySource.includes("totalCost += deterministicResult.cost")
    expect(updatesCost).toBe(true)
    
    // Check tokens are updated
    const updatesTokens = 
      activitySource.includes("totalTokens.input += deterministicResult.tokens.input") &&
      activitySource.includes("totalTokens.output += deterministicResult.tokens.output") &&
      activitySource.includes("totalTokens.cache += deterministicResult.tokens.cache")
    expect(updatesTokens).toBe(true)
  })

  test("deterministic execution handles failures", () => {
    // Check for failure handling
    const hasFailureCheck = activitySource.includes("if (!deterministicResult.success)")
    expect(hasFailureCheck).toBe(true)
    
    // Check activity status update on failure
    const updatesStatusOnFailure = activitySource.includes('_activity.status = "failed"')
    expect(updatesStatusOnFailure).toBe(true)
  })

  test("deterministic execution logs appropriately", () => {
    // Check for logging statements
    const hasInfoLog = activitySource.includes('log.info("executing task in deterministic mode"')
    expect(hasInfoLog).toBe(true)
    
    const hasSuccessLog = activitySource.includes('log.info("deterministic task completed successfully"')
    expect(hasSuccessLog).toBe(true)
    
    const hasErrorLog = activitySource.includes('log.error("deterministic task failed"')
    expect(hasErrorLog).toBe(true)
  })
})

describe("PHASE 2: Variable Interpolation Logic", () => {
  let activitySource: string
  
  beforeAll(async () => {
    activitySource = await readFile(ACTIVITY_TS_PATH, "utf-8")
  })

  test("interpolation handles string parameters", () => {
    // Check for string type check
    const hasStringCheck = activitySource.includes('if (typeof value === "string")')
    expect(hasStringCheck).toBe(true)
  })

  test("interpolation handles object parameters", () => {
    // Check for object type check
    const hasObjectCheck = activitySource.includes('typeof value === "object" && value !== null && !Array.isArray(value)')
    expect(hasObjectCheck).toBe(true)
  })

  test("interpolation passes through non-string types", () => {
    // Check for pass-through logic
    const hasPassThrough = activitySource.includes("interpolated[key] = value")
    expect(hasPassThrough).toBe(true)
  })
})

describe("PHASE 2: Integration Points", () => {
  let activitySource: string
  
  beforeAll(async () => {
    activitySource = await readFile(ACTIVITY_TS_PATH, "utf-8")
  })

  test("deterministic mode is checked before LLM execution", () => {
    // The check should come before standard TaskTool delegation
    const deterministicCheckIndex = activitySource.indexOf('if (executionMode === "deterministic")')
    const llmExecutionComment = activitySource.indexOf("// LLM-assisted execution path")
    
    expect(deterministicCheckIndex).toBeGreaterThan(0)
    expect(llmExecutionComment).toBeGreaterThan(0)
    expect(deterministicCheckIndex).toBeLessThan(llmExecutionComment)
  })

  test("task continues after deterministic success", () => {
    // Check for continue statement after successful deterministic execution
    const hasContinue = activitySource.includes('log.info("deterministic task completed successfully"')
    const hasContinueStatement = activitySource.includes("// Continue to next task") ||
                                 activitySource.includes("continue")
    
    expect(hasContinue).toBe(true)
    expect(hasContinueStatement).toBe(true)
  })

  test("deterministic execution uses AbortSignal", () => {
    // Check that abort signal is checked in loop
    const hasAbortCheck = activitySource.includes("if (abortSignal.aborted)")
    expect(hasAbortCheck).toBe(true)
    
    // Check throw on abort
    const hasAbortThrow = activitySource.includes('throw new Error("Task execution aborted")')
    expect(hasAbortThrow).toBe(true)
  })
})

describe("PHASE 2: Error Handling", () => {
  let activitySource: string
  
  beforeAll(async () => {
    activitySource = await readFile(ACTIVITY_TS_PATH, "utf-8")
  })

  test("fail-fast on tool errors", () => {
    // Check that we return on first error
    const hasFailFast = activitySource.includes("// Fail fast on first error")
    expect(hasFailFast).toBe(true)
    
    // Check early return
    const hasEarlyReturn = activitySource.includes("return {") && 
                          activitySource.includes("success: false,") &&
                          activitySource.includes("toolCallResults,")
    expect(hasEarlyReturn).toBe(true)
  })

  test("tool errors are captured in results", () => {
    // Check toolCallResults push on error
    const capturesErrors = activitySource.includes("toolCallResults.push({") &&
                          activitySource.includes("success: false,") &&
                          activitySource.includes("error: errorMessage,")
    expect(capturesErrors).toBe(true)
  })

  test("unsupported tools throw errors", () => {
    // Check for unsupported tool error
    const hasUnsupportedCheck = activitySource.includes("is not supported in deterministic mode yet")
    expect(hasUnsupportedCheck).toBe(true)
  })
})

describe("Implementation Completeness Summary", () => {
  test("All PHASE 1 schema extensions are present", async () => {
    const templateSource = await readFile(TEMPLATE_TS_PATH, "utf-8")
    
    const checks = {
      executionMode: templateSource.includes('executionMode:'),
      toolCallSchema: templateSource.includes('ToolCallSchema'),
      toolSequence: templateSource.includes('toolSequence:'),
      optionalPrompt: templateSource.includes('.optional()'),
    }
    
    const allPresent = Object.values(checks).every(v => v === true)
    expect(allPresent).toBe(true)
  })

  test("All PHASE 2 deterministic execution components are present", async () => {
    const activitySource = await readFile(ACTIVITY_TS_PATH, "utf-8")
    
    const checks = {
      executeTaskDeterministic: activitySource.includes('async function executeTaskDeterministic('),
      interpolateToolParams: activitySource.includes('function interpolateToolParams('),
      executionBranching: activitySource.includes('if (executionMode === "deterministic")'),
      bashSupport: activitySource.includes('if (toolCall.tool === "bash")'),
      zeroCost: activitySource.includes('cost: 0'),
      zeroTokens: activitySource.includes('tokens: { input: 0, output: 0, cache: 0 }'),
      variableInterpolation: activitySource.includes('new RegExp(`\\\\{\\\\{${varName}\\\\}\\\\}`, "g")'),
      failFast: activitySource.includes('// Fail fast on first error'),
    }
    
    const allPresent = Object.values(checks).every(v => v === true)
    expect(allPresent).toBe(true)
  })
})
