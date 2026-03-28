/**
 * Test Assertion Utilities
 */

export class AssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AssertionError"
  }
}

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message)
  }
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    const msg = message || `Expected ${expected}, got ${actual}`
    throw new AssertionError(msg)
  }
}

export function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    const msg = message || `Expected "${haystack}" to contain "${needle}"`
    throw new AssertionError(msg)
  }
}

export function assertGreaterThan(actual: number, minimum: number, message?: string): void {
  if (actual <= minimum) {
    const msg = message || `Expected ${actual} > ${minimum}`
    throw new AssertionError(msg)
  }
}

export function assertLessThan(actual: number, maximum: number, message?: string): void {
  if (actual >= maximum) {
    const msg = message || `Expected ${actual} < ${maximum}`
    throw new AssertionError(msg)
  }
}

export async function assertThrows(fn: () => Promise<void> | void, message?: string): Promise<void> {
  try {
    await fn()
    throw new AssertionError(message || "Expected function to throw")
  } catch (error) {
    if (error instanceof AssertionError && error.message === message) {
      throw error
    }
    // Expected - function threw an error
  }
}

/**
 * Test runner utility
 */
export interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

export async function runTest(
  name: string, 
  fn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now()
  
  try {
    await fn()
    return {
      name,
      passed: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    }
  }
}

export function printTestResult(result: TestResult): void {
  const status = result.passed ? "✅ PASS" : "❌ FAIL"
  const duration = `(${(result.duration / 1000).toFixed(1)}s)`
  
  console.log(`  ${result.name.padEnd(50)} ${status} ${duration}`)
  
  if (!result.passed && result.error) {
    console.log(`    Error: ${result.error}`)
  }
}

export function printTestSummary(results: TestResult[]): void {
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  
  console.log()
  console.log("=".repeat(60))
  console.log(`Total: ${results.length} tests`)
  console.log(`Passed: ${passed} ✅`)
  console.log(`Failed: ${failed} ${failed > 0 ? "❌" : ""}`)
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`)
  console.log("=".repeat(60))
}
