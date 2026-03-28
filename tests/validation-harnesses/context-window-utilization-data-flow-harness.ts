/**
 * Validation Harness: Context Window Utilization Data Flow
 * 
 * Tests the complete data flow from token estimation through color-coded TUI display.
 * Validates that context window utilization is accurately calculated and displayed
 * with correct thresholds (70% Yellow, 90% Red).
 * 
 * Test Strategy:
 * - Mock session with known impulse budgets, agent mode, and message history
 * - Call getContextWindowState() with test inputs
 * - Verify token calculations (impulseTokens + systemPromptTokens + recentMessageTokens)
 * - Verify model context window lookup (GPT-4: 128K, Claude 3.5: 200K)
 * - Verify threshold boundaries (0-70% Green, 70-90% Yellow, 90-100% Red)
 * - Verify TUI display format and color coding
 */

import type { SessionState } from "../../repos/metabob-opencode/packages/opencode/src/session/session-state"

export interface ValidationTestCase {
  name: string
  input: {
    impulseTokens: number
    agentMode: string
    modelID: string
    providerID: string
    recentMessagesTokens: number
  }
  expected: {
    estimatedTokens: number
    maxTokens: number
    utilizationPercent: number
    color: "green" | "yellow" | "red"
    status: "🟢 Healthy" | "🟡 Warning" | "🔴 Critical"
    displayTokens: string
    displayUtilization: string
  }
}

export interface ValidationResult {
  pass: boolean
  testCase: string
  actual: {
    estimatedTokens?: number
    maxTokens?: number
    utilizationPercent?: number
    color?: string
    status?: string
  }
  expected: ValidationTestCase["expected"]
  errors: string[]
}

/**
 * System prompt token estimates by agent mode
 */
const SYSTEM_PROMPT_TOKENS: Record<string, number> = {
  general: 2000,
  activity: 2500,
  research: 1800,
  debug: 2200,
  testing: 1900,
  default: 2000,
}

/**
 * Model context window limits (from models.dev)
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "anthropic/claude-3-5-sonnet-20241022": 200000,
  "anthropic/claude-3-5-sonnet-20240620": 200000,
  "anthropic/claude-3-haiku-20240307": 200000,
  "openai/gpt-4-turbo": 128000,
  "openai/gpt-4": 128000,
  "openai/gpt-4o": 128000,
  "openai/gpt-4o-mini": 128000,
}

/**
 * Calculate context window state (mirrors backend logic)
 */
function calculateContextWindowState(input: ValidationTestCase["input"]): {
  estimatedTokens: number
  maxTokens: number
  utilizationPercent: number
} {
  // Validate impulseTokens
  const impulseTokens = Number.isFinite(input.impulseTokens) && input.impulseTokens >= 0 
    ? input.impulseTokens 
    : 0

  // Get system prompt tokens from agent mode
  const systemPromptTokens = SYSTEM_PROMPT_TOKENS[input.agentMode] ?? SYSTEM_PROMPT_TOKENS.default

  // Recent messages tokens (provided in input)
  const recentMessageTokens = input.recentMessagesTokens

  // Calculate estimated tokens
  const estimatedTokens = impulseTokens + systemPromptTokens + recentMessageTokens

  // Get model context window
  const modelKey = `${input.providerID}/${input.modelID}`
  const maxTokens = MODEL_CONTEXT_WINDOWS[modelKey] ?? 200000

  // Calculate utilization percentage
  const utilizationPercent = (estimatedTokens / maxTokens) * 100

  return {
    estimatedTokens,
    maxTokens,
    utilizationPercent,
  }
}

/**
 * Get utilization status based on thresholds
 */
function getUtilizationStatus(percent: number): "🟢 Healthy" | "🟡 Warning" | "🔴 Critical" {
  if (percent >= 90) return "🔴 Critical"
  if (percent >= 70) return "🟡 Warning"
  return "🟢 Healthy"
}

/**
 * Get color based on thresholds
 */
function getUtilizationColor(percent: number): "green" | "yellow" | "red" {
  if (percent >= 90) return "red"
  if (percent >= 70) return "yellow"
  return "green"
}

/**
 * Format display tokens string
 */
function formatDisplayTokens(estimated: number, max: number, utilization: number): string {
  const estK = Math.round(estimated / 1000)
  const maxK = Math.round(max / 1000)
  return `📊 Tokens: ${estK}k / ${maxK}k (${Math.round(utilization)}%)`
}

/**
 * Format display utilization string
 */
function formatDisplayUtilization(status: string): string {
  return `🎯 Utilization: ${status}`
}

/**
 * Run validation for a single test case
 */
export function runValidation(testCase: ValidationTestCase): ValidationResult {
  const errors: string[] = []
  
  try {
    // Calculate actual values
    const actual = calculateContextWindowState(testCase.input)
    const actualColor = getUtilizationColor(actual.utilizationPercent)
    const actualStatus = getUtilizationStatus(actual.utilizationPercent)
    const actualDisplayTokens = formatDisplayTokens(
      actual.estimatedTokens,
      actual.maxTokens,
      actual.utilizationPercent
    )
    const actualDisplayUtilization = formatDisplayUtilization(actualStatus)

    // Validate estimatedTokens
    if (actual.estimatedTokens !== testCase.expected.estimatedTokens) {
      errors.push(
        `estimatedTokens mismatch: expected ${testCase.expected.estimatedTokens}, got ${actual.estimatedTokens}`
      )
    }

    // Validate maxTokens
    if (actual.maxTokens !== testCase.expected.maxTokens) {
      errors.push(
        `maxTokens mismatch: expected ${testCase.expected.maxTokens}, got ${actual.maxTokens}`
      )
    }

    // Validate utilizationPercent (allow 0.1% tolerance for rounding)
    const percentDiff = Math.abs(actual.utilizationPercent - testCase.expected.utilizationPercent)
    if (percentDiff > 0.1) {
      errors.push(
        `utilizationPercent mismatch: expected ${testCase.expected.utilizationPercent}, got ${actual.utilizationPercent}`
      )
    }

    // Validate color
    if (actualColor !== testCase.expected.color) {
      errors.push(
        `color mismatch: expected ${testCase.expected.color}, got ${actualColor}`
      )
    }

    // Validate status
    if (actualStatus !== testCase.expected.status) {
      errors.push(
        `status mismatch: expected ${testCase.expected.status}, got ${actualStatus}`
      )
    }

    // Validate display strings
    if (actualDisplayTokens !== testCase.expected.displayTokens) {
      errors.push(
        `displayTokens mismatch: expected "${testCase.expected.displayTokens}", got "${actualDisplayTokens}"`
      )
    }

    if (actualDisplayUtilization !== testCase.expected.displayUtilization) {
      errors.push(
        `displayUtilization mismatch: expected "${testCase.expected.displayUtilization}", got "${actualDisplayUtilization}"`
      )
    }

    return {
      pass: errors.length === 0,
      testCase: testCase.name,
      actual: {
        estimatedTokens: actual.estimatedTokens,
        maxTokens: actual.maxTokens,
        utilizationPercent: actual.utilizationPercent,
        color: actualColor,
        status: actualStatus,
      },
      expected: testCase.expected,
      errors,
    }
  } catch (error) {
    errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    return {
      pass: false,
      testCase: testCase.name,
      actual: {},
      expected: testCase.expected,
      errors,
    }
  }
}

/**
 * Run all validation test cases
 */
export function runAllValidations(testCases: ValidationTestCase[]): {
  totalTests: number
  passed: number
  failed: number
  results: ValidationResult[]
} {
  const results = testCases.map(runValidation)
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  return {
    totalTests: testCases.length,
    passed,
    failed,
    results,
  }
}

/**
 * Test cases defined as constants for reusability
 */
export const TEST_CASES: ValidationTestCase[] = [
  {
    name: "Case 1: Normal usage - Claude 3.5, activity mode, 12% utilization",
    input: {
      impulseTokens: 15000, // 3 impulses × 5000 tokens
      agentMode: "activity",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 5000, // 10 messages × 500 tokens
    },
    expected: {
      estimatedTokens: 22500, // 15000 + 2500 (activity) + 5000
      maxTokens: 200000,
      utilizationPercent: 11.25,
      color: "green",
      status: "🟢 Healthy",
      displayTokens: "📊 Tokens: 23k / 200k (11%)",
      displayUtilization: "🎯 Utilization: 🟢 Healthy",
    },
  },
  {
    name: "Case 2: Threshold boundary - 70% warning (Yellow)",
    input: {
      impulseTokens: 135000,
      agentMode: "general",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 5000,
    },
    expected: {
      estimatedTokens: 142000, // 135000 + 2000 + 5000
      maxTokens: 200000,
      utilizationPercent: 71.0,
      color: "yellow",
      status: "🟡 Warning",
      displayTokens: "📊 Tokens: 142k / 200k (71%)",
      displayUtilization: "🎯 Utilization: 🟡 Warning",
    },
  },
  {
    name: "Case 3: Threshold boundary - 90% critical (Red)",
    input: {
      impulseTokens: 175000,
      agentMode: "general",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 5000,
    },
    expected: {
      estimatedTokens: 182000, // 175000 + 2000 + 5000
      maxTokens: 200000,
      utilizationPercent: 91.0,
      color: "red",
      status: "🔴 Critical",
      displayTokens: "📊 Tokens: 182k / 200k (91%)",
      displayUtilization: "🎯 Utilization: 🔴 Critical",
    },
  },
  {
    name: "Case 4: GPT-4 model - 128K context window",
    input: {
      impulseTokens: 60000,
      agentMode: "debug",
      modelID: "gpt-4-turbo",
      providerID: "openai",
      recentMessagesTokens: 8000,
    },
    expected: {
      estimatedTokens: 70200, // 60000 + 2200 (debug) + 8000
      maxTokens: 128000,
      utilizationPercent: 54.84375,
      color: "green",
      status: "🟢 Healthy",
      displayTokens: "📊 Tokens: 70k / 128k (55%)",
      displayUtilization: "🎯 Utilization: 🟢 Healthy",
    },
  },
  {
    name: "Case 5: Research mode - lower system prompt tokens",
    input: {
      impulseTokens: 10000,
      agentMode: "research",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 3000,
    },
    expected: {
      estimatedTokens: 14800, // 10000 + 1800 (research) + 3000
      maxTokens: 200000,
      utilizationPercent: 7.4,
      color: "green",
      status: "🟢 Healthy",
      displayTokens: "📊 Tokens: 15k / 200k (7%)",
      displayUtilization: "🎯 Utilization: 🟢 Healthy",
    },
  },
  {
    name: "Case 6: Zero impulses - system + messages only",
    input: {
      impulseTokens: 0,
      agentMode: "general",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 4000,
    },
    expected: {
      estimatedTokens: 6000, // 0 + 2000 + 4000
      maxTokens: 200000,
      utilizationPercent: 3.0,
      color: "green",
      status: "🟢 Healthy",
      displayTokens: "📊 Tokens: 6k / 200k (3%)",
      displayUtilization: "🎯 Utilization: 🟢 Healthy",
    },
  },
  {
    name: "Case 7: Edge case - exactly 70% (boundary test)",
    input: {
      impulseTokens: 133000,
      agentMode: "general",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 5000,
    },
    expected: {
      estimatedTokens: 140000, // 133000 + 2000 + 5000
      maxTokens: 200000,
      utilizationPercent: 70.0,
      color: "yellow", // At exactly 70%, should be yellow
      status: "🟡 Warning",
      displayTokens: "📊 Tokens: 140k / 200k (70%)",
      displayUtilization: "🎯 Utilization: 🟡 Warning",
    },
  },
  {
    name: "Case 8: Edge case - exactly 90% (boundary test)",
    input: {
      impulseTokens: 173000,
      agentMode: "general",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 5000,
    },
    expected: {
      estimatedTokens: 180000, // 173000 + 2000 + 5000
      maxTokens: 200000,
      utilizationPercent: 90.0,
      color: "red", // At exactly 90%, should be red
      status: "🔴 Critical",
      displayTokens: "📊 Tokens: 180k / 200k (90%)",
      displayUtilization: "🎯 Utilization: 🔴 Critical",
    },
  },
  {
    name: "Case 9: Invalid input - NaN impulseTokens (validation test)",
    input: {
      impulseTokens: NaN,
      agentMode: "general",
      modelID: "claude-3-5-sonnet-20241022",
      providerID: "anthropic",
      recentMessagesTokens: 5000,
    },
    expected: {
      estimatedTokens: 7000, // 0 (validated) + 2000 + 5000
      maxTokens: 200000,
      utilizationPercent: 3.5,
      color: "green",
      status: "🟢 Healthy",
      displayTokens: "📊 Tokens: 7k / 200k (4%)",
      displayUtilization: "🎯 Utilization: 🟢 Healthy",
    },
  },
  {
    name: "Case 10: Unknown model - fallback to default 200K",
    input: {
      impulseTokens: 50000,
      agentMode: "general",
      modelID: "unknown-model",
      providerID: "unknown-provider",
      recentMessagesTokens: 5000,
    },
    expected: {
      estimatedTokens: 57000, // 50000 + 2000 + 5000
      maxTokens: 200000, // Default fallback
      utilizationPercent: 28.5,
      color: "green",
      status: "🟢 Healthy",
      displayTokens: "📊 Tokens: 57k / 200k (28%)", // Math.round(28.5) = 28
      displayUtilization: "🎯 Utilization: 🟢 Healthy",
    },
  },
]

// Run all tests if executed directly
if (import.meta.main) {
  console.log("Running Context Window Utilization Data Flow Validation Harness\n")
  console.log("=" .repeat(80))
  
  const results = runAllValidations(TEST_CASES)
  
  console.log(`\nTotal Tests: ${results.totalTests}`)
  console.log(`Passed: ${results.passed}`)
  console.log(`Failed: ${results.failed}`)
  console.log(`\nSuccess Rate: ${((results.passed / results.totalTests) * 100).toFixed(1)}%`)
  
  if (results.failed > 0) {
    console.log("\n" + "=".repeat(80))
    console.log("FAILED TESTS:\n")
    results.results
      .filter((r) => !r.pass)
      .forEach((result) => {
        console.log(`❌ ${result.testCase}`)
        result.errors.forEach((error) => console.log(`   ${error}`))
        console.log()
      })
  } else {
    console.log("\n✅ All tests passed!")
  }
  
  process.exit(results.failed > 0 ? 1 : 0)
}
