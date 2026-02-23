/**
 * Validation Harness: activity-progress-tracking-data-flow
 * 
 * Tests the complete data flow from Activity.prompts through SessionState calculation
 * to ensure accurate progress tracking with proper transformations:
 * 
 * 1. Prompt counting (committed/executing = current progress)
 * 2. Percentage calculation with Math.round()
 * 3. Elapsed time calculation
 * 4. Index conversion (count is naturally 1-indexed for display)
 * 5. Time formatting (ms → human-readable)
 */

import { describe, test, expect } from "bun:test"

// Types matching the actual implementation
interface PromptInfo {
  file: string
  index: number
  todoID: string
  sessionID?: string
  commitSHA?: string
  status: "pending" | "executing" | "committed" | "skipped" | "failed"
}

interface ActivityInfo {
  id: string
  title: string
  status: "setup" | "executing" | "completing" | "done" | "failed"
  prompts: PromptInfo[]
  startedAt: number
}

interface ActivityProgress {
  current: number
  total: number
  percentage: number
}

interface ActivityStateItem {
  id: string
  title: string
  status: string
  progress: ActivityProgress
  startedAt: number
  elapsedMs: number
}

/**
 * Core transformation logic extracted from session-state.ts
 * This mirrors the actual implementation for testing
 */
function calculateActivityProgress(activity: ActivityInfo, currentTime: number): ActivityStateItem {
  // Transform 1: Count prompts with committed/executing status
  const current = activity.prompts.filter(
    (p) => p.status === "committed" || p.status === "executing"
  ).length
  
  // Transform 2: Total prompts
  const total = activity.prompts.length
  
  // Transform 3: Calculate percentage WITH Math.round() (this is what we fixed!)
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  
  // Transform 4: Calculate elapsed time
  const elapsedMs = currentTime - activity.startedAt

  return {
    id: activity.id,
    title: activity.title,
    status: activity.status,
    progress: {
      current,
      total,
      percentage,
    },
    startedAt: activity.startedAt,
    elapsedMs,
  }
}

/**
 * Format elapsed time (matches sidebar.tsx implementation)
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  const s = seconds % 60
  const m = minutes % 60
  const h = hours

  if (h > 0) {
    return `${h}h ${m}m`
  } else if (m > 0) {
    return `${m}m ${s}s`
  } else {
    return `${s}s`
  }
}

/**
 * Format progress bar (matches sidebar.tsx implementation)
 */
function formatProgressBar(percentage: number, width: number): string {
  const safePercentage = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0
  const filled = Math.round((safePercentage / 100) * width)
  const empty = Math.max(0, width - filled)
  return "█".repeat(filled) + "░".repeat(empty)
}

/**
 * Test case input/output structure
 */
interface ValidationCase {
  name: string
  input: {
    activity: ActivityInfo
    currentTime: number
  }
  expected: {
    current: number
    total: number
    percentage: number
    elapsedMs: number
    formattedTime: string
    progressBar: string
  }
}

/**
 * Validation test cases
 */
export const testCases: ValidationCase[] = [
  // Case 1: Specification example - 3 of 5 tasks done, 204 seconds elapsed
  {
    name: "case-1-spec-example-3-of-5-tasks",
    input: {
      activity: {
        id: "act_test_001",
        title: "Add Feature",
        status: "executing",
        startedAt: 1000000000,
        prompts: [
          { file: "task1.md", index: 0, todoID: "todo1", status: "committed" },
          { file: "task2.md", index: 1, todoID: "todo2", status: "committed" },
          { file: "task3.md", index: 2, todoID: "todo3", status: "executing" },
          { file: "task4.md", index: 3, todoID: "todo4", status: "pending" },
          { file: "task5.md", index: 4, todoID: "todo5", status: "pending" },
        ],
      },
      currentTime: 1000204000, // T0 + 204 seconds
    },
    expected: {
      current: 3, // 2 committed + 1 executing = 3
      total: 5,
      percentage: 60, // Math.round((3/5) * 100) = 60
      elapsedMs: 204000,
      formattedTime: "3m 24s",
      progressBar: "████████████░░░░░░░░", // 60% of 20 chars = 12 filled
    },
  },

  // Case 2: Edge case - fractional percentage that needs rounding down
  {
    name: "case-2-fractional-percentage-round-down",
    input: {
      activity: {
        id: "act_test_002",
        title: "Refactor Module",
        status: "executing",
        startedAt: 2000000000,
        prompts: [
          { file: "task1.md", index: 0, todoID: "todo1", status: "committed" },
          { file: "task2.md", index: 1, todoID: "todo2", status: "executing" },
          { file: "task3.md", index: 2, todoID: "todo3", status: "pending" },
        ],
      },
      currentTime: 2000150000, // T0 + 150 seconds
    },
    expected: {
      current: 2, // 1 committed + 1 executing = 2
      total: 3,
      percentage: 67, // Math.round((2/3) * 100) = Math.round(66.666...) = 67
      elapsedMs: 150000,
      formattedTime: "2m 30s",
      progressBar: "█████████████░░░░░░░", // 67% of 20 chars = 13 filled
    },
  },

  // Case 3: Edge case - fractional percentage that needs rounding up
  {
    name: "case-3-fractional-percentage-round-up",
    input: {
      activity: {
        id: "act_test_003",
        title: "Fix Bug",
        status: "executing",
        startedAt: 3000000000,
        prompts: [
          { file: "task1.md", index: 0, todoID: "todo1", status: "committed" },
          { file: "task2.md", index: 1, todoID: "todo2", status: "pending" },
          { file: "task3.md", index: 2, todoID: "todo3", status: "pending" },
        ],
      },
      currentTime: 3000090000, // T0 + 90 seconds
    },
    expected: {
      current: 1, // 1 committed = 1
      total: 3,
      percentage: 33, // Math.round((1/3) * 100) = Math.round(33.333...) = 33
      elapsedMs: 90000,
      formattedTime: "1m 30s",
      progressBar: "███████░░░░░░░░░░░░░", // 33% of 20 chars = 6.6, rounds to 7 filled
    },
  },

  // Case 4: Start state - no tasks completed yet
  {
    name: "case-4-zero-progress",
    input: {
      activity: {
        id: "act_test_004",
        title: "Initialize Project",
        status: "setup",
        startedAt: 4000000000,
        prompts: [
          { file: "task1.md", index: 0, todoID: "todo1", status: "pending" },
          { file: "task2.md", index: 1, todoID: "todo2", status: "pending" },
        ],
      },
      currentTime: 4000005000, // T0 + 5 seconds
    },
    expected: {
      current: 0,
      total: 2,
      percentage: 0,
      elapsedMs: 5000,
      formattedTime: "5s",
      progressBar: "░░░░░░░░░░░░░░░░░░░░", // 0% = all empty
    },
  },

  // Case 5: Complete state - all tasks done
  {
    name: "case-5-complete-progress",
    input: {
      activity: {
        id: "act_test_005",
        title: "Deploy Application",
        status: "completing",
        startedAt: 5000000000,
        prompts: [
          { file: "task1.md", index: 0, todoID: "todo1", status: "committed" },
          { file: "task2.md", index: 1, todoID: "todo2", status: "committed" },
          { file: "task3.md", index: 2, todoID: "todo3", status: "committed" },
        ],
      },
      currentTime: 5000600000, // T0 + 600 seconds (10 minutes)
    },
    expected: {
      current: 3,
      total: 3,
      percentage: 100,
      elapsedMs: 600000,
      formattedTime: "10m 0s",
      progressBar: "████████████████████", // 100% = all filled
    },
  },

  // Case 6: Long-running activity with hours
  {
    name: "case-6-long-running-hours",
    input: {
      activity: {
        id: "act_test_006",
        title: "Large Migration",
        status: "executing",
        startedAt: 6000000000,
        prompts: [
          { file: "task1.md", index: 0, todoID: "todo1", status: "committed" },
          { file: "task2.md", index: 1, todoID: "todo2", status: "committed" },
          { file: "task3.md", index: 2, todoID: "todo3", status: "committed" },
          { file: "task4.md", index: 3, todoID: "todo4", status: "executing" },
          { file: "task5.md", index: 4, todoID: "todo5", status: "pending" },
          { file: "task6.md", index: 5, todoID: "todo6", status: "pending" },
        ],
      },
      currentTime: 6007890000, // T0 + 7890 seconds (2h 11m 30s)
    },
    expected: {
      current: 4, // 3 committed + 1 executing
      total: 6,
      percentage: 67, // Math.round((4/6) * 100) = Math.round(66.666...) = 67
      elapsedMs: 7890000,
      formattedTime: "2h 11m",
      progressBar: "█████████████░░░░░░░",
    },
  },

  // Case 7: Edge case - skipped tasks should not count as current
  {
    name: "case-7-skipped-tasks-excluded",
    input: {
      activity: {
        id: "act_test_007",
        title: "Conditional Feature",
        status: "executing",
        startedAt: 7000000000,
        prompts: [
          { file: "task1.md", index: 0, todoID: "todo1", status: "committed" },
          { file: "task2.md", index: 1, todoID: "todo2", status: "skipped" },
          { file: "task3.md", index: 2, todoID: "todo3", status: "executing" },
          { file: "task4.md", index: 3, todoID: "todo4", status: "pending" },
        ],
      },
      currentTime: 7000120000, // T0 + 120 seconds
    },
    expected: {
      current: 2, // 1 committed + 1 executing (skipped not counted)
      total: 4, // Total includes all prompts
      percentage: 50, // Math.round((2/4) * 100) = 50
      elapsedMs: 120000,
      formattedTime: "2m 0s",
      progressBar: "██████████░░░░░░░░░░",
    },
  },
]

/**
 * Run validation for a single test case
 */
export function runValidation(testCase: ValidationCase): {
  pass: boolean
  actual: any
  expected: any
  errors: string[]
} {
  const errors: string[] = []
  
  // Calculate actual progress
  const actual = calculateActivityProgress(testCase.input.activity, testCase.input.currentTime)
  
  // Validate each transformation
  if (actual.progress.current !== testCase.expected.current) {
    errors.push(
      `Current mismatch: expected ${testCase.expected.current}, got ${actual.progress.current}`
    )
  }
  
  if (actual.progress.total !== testCase.expected.total) {
    errors.push(
      `Total mismatch: expected ${testCase.expected.total}, got ${actual.progress.total}`
    )
  }
  
  if (actual.progress.percentage !== testCase.expected.percentage) {
    errors.push(
      `Percentage mismatch: expected ${testCase.expected.percentage}%, got ${actual.progress.percentage}%`
    )
  }
  
  if (actual.elapsedMs !== testCase.expected.elapsedMs) {
    errors.push(
      `ElapsedMs mismatch: expected ${testCase.expected.elapsedMs}, got ${actual.elapsedMs}`
    )
  }
  
  // Validate formatting
  const formattedTime = formatElapsedTime(actual.elapsedMs)
  if (formattedTime !== testCase.expected.formattedTime) {
    errors.push(
      `Formatted time mismatch: expected '${testCase.expected.formattedTime}', got '${formattedTime}'`
    )
  }
  
  const progressBar = formatProgressBar(actual.progress.percentage, 20)
  if (progressBar !== testCase.expected.progressBar) {
    errors.push(
      `Progress bar mismatch: expected '${testCase.expected.progressBar}', got '${progressBar}'`
    )
  }
  
  return {
    pass: errors.length === 0,
    actual: {
      ...actual,
      formattedTime,
      progressBar,
    },
    expected: testCase.expected,
    errors,
  }
}

/**
 * Run all validation cases
 */
export function runAllValidations(): {
  totalTests: number
  passed: number
  failed: number
  results: Array<{ name: string; pass: boolean; errors: string[] }>
} {
  const results = testCases.map((testCase) => {
    const result = runValidation(testCase)
    return {
      name: testCase.name,
      pass: result.pass,
      errors: result.errors,
    }
  })
  
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  
  return {
    totalTests: testCases.length,
    passed,
    failed,
    results,
  }
}

// Bun test suite
describe("Activity Progress Tracking Data Flow", () => {
  testCases.forEach((testCase) => {
    test(testCase.name, () => {
      const result = runValidation(testCase)
      
      if (!result.pass) {
        console.error(`\nTest failed: ${testCase.name}`)
        console.error("Errors:", result.errors)
        console.error("Expected:", result.expected)
        console.error("Actual:", result.actual)
      }
      
      expect(result.pass).toBe(true)
      expect(result.errors).toEqual([])
    })
  })
  
  test("summary - all transformations validated", () => {
    const summary = runAllValidations()
    
    console.log("\n=== Validation Summary ===")
    console.log(`Total Tests: ${summary.totalTests}`)
    console.log(`Passed: ${summary.passed}`)
    console.log(`Failed: ${summary.failed}`)
    
    if (summary.failed > 0) {
      console.log("\nFailed tests:")
      summary.results
        .filter((r) => !r.pass)
        .forEach((r) => {
          console.log(`  - ${r.name}`)
          r.errors.forEach((e) => console.log(`    ${e}`))
        })
    }
    
    expect(summary.failed).toBe(0)
  })
})
