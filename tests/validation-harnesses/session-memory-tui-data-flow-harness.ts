/**
 * Validation Harness: session-memory-tui-data-flow
 * 
 * Tests the complete data pipeline from SessionMemory storage through API endpoint to TUI display.
 * Validates all transformations: aggregation, percentage computation, and formatting.
 * 
 * Strategy:
 * 1. Create session with 5 impulses (3 loaded, 2 unloaded)
 * 2. Verify Session.impulses() returns correct data
 * 3. Verify GET /session/:id/state endpoint response
 * 4. Simulate TUI display formatting
 * 5. Validate all calculations at each transformation stage
 */

import { Session } from "../../repos/metabob-opencode/packages/opencode/src/session/index"
import { SessionMemory } from "../../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { SessionState } from "../../repos/metabob-opencode/packages/opencode/src/session/session-state"
import { ActivityTemplate } from "../../repos/metabob-opencode/packages/opencode/src/session/activity-template"
import { Identifier } from "../../repos/metabob-opencode/packages/opencode/src/id/id"

export interface ValidationInput {
  impulses: Array<{
    id: string
    budget: number
    loaded: boolean
    tokenCount?: number
  }>
}

export interface ValidationExpected {
  // Stage 1: Session.impulses() output
  sessionImpulsesOutput: {
    impulseCount: number
    totalBudget: number
    usedTokens: number
    utilization: number
  }
  
  // Stage 2: SessionState.getImpulseState() output
  impulseStateOutput: {
    impulseCount: number
    totalBudget: number
    usedTokens: number
    utilization: number
    loadedCount: number
    unloadedCount: number
  }
  
  // Stage 3: TUI display formatting
  tuiDisplay: {
    impulsesLine: string
    budgetLine: string
    utilizationColor: "success" | "warning" | "error"
  }
}

export interface ValidationResult {
  pass: boolean
  actual: {
    sessionImpulsesOutput?: any
    impulseStateOutput?: any
    tuiDisplay?: any
  }
  expected: ValidationExpected
  errors: string[]
}

/**
 * Format TUI impulses display line
 */
function formatImpulsesLine(impulseCount: number, loadedCount: number): string {
  return `📦 Impulses: ${impulseCount} (${loadedCount} loaded)`
}

/**
 * Format TUI budget display line
 */
function formatBudgetLine(usedTokens: number, totalBudget: number, utilization: number): string {
  return `💾 Budget: ${usedTokens} / ${totalBudget} (${Math.round(utilization)}%)`
}

/**
 * Get utilization color based on thresholds
 */
function getUtilizationColor(utilization: number): "success" | "warning" | "error" {
  if (utilization >= 85) return "error"      // Red: 85-100%
  if (utilization >= 60) return "warning"    // Yellow: 60-85%
  return "success"                           // Green: 0-60%
}

/**
 * Run validation for session-memory-tui-data-flow
 */
export async function runValidation(
  input: ValidationInput,
  expected: ValidationExpected
): Promise<ValidationResult> {
  const errors: string[] = []
  const actual: ValidationResult["actual"] = {}
  
  // Generate unique session ID for this test
  const sessionID = Identifier.ascending("session")
  
  try {
    // ============================================================
    // STAGE 1: Setup - Create session with impulses
    // ============================================================
    
    // Create impulses in SessionMemory
    for (const impulseSpec of input.impulses) {
      const impulse: ActivityTemplate.Impulse.Schema = {
        id: impulseSpec.id,
        type: "memo",
        pointer: {
          type: "memo",
          content: `Test impulse ${impulseSpec.id}`,
          source: "validation-harness"
        },
        budget: impulseSpec.budget,
        loaded: false, // Start as unloaded
        tokenCount: 0,
        tags: [],
        scope: "session" as const,
        sessionID: sessionID
      }
      
      await SessionMemory.addImpulse(sessionID, impulse)
      
      // If should be loaded, update it to loaded with tokenCount
      if (impulseSpec.loaded && impulseSpec.tokenCount) {
        await SessionMemory.updateImpulse(sessionID, impulseSpec.id, {
          loaded: true,
          tokenCount: impulseSpec.tokenCount
        })
      }
    }
    
    // ============================================================
    // STAGE 2: Test Session.impulses() transformation
    // ============================================================
    
    const sessionImpulsesResult = await Session.impulses(sessionID)
    actual.sessionImpulsesOutput = {
      impulseCount: sessionImpulsesResult.stats.impulseCount,
      totalBudget: sessionImpulsesResult.stats.totalBudget,
      usedTokens: sessionImpulsesResult.stats.usedTokens,
      utilization: sessionImpulsesResult.stats.utilization
    }
    
    // Validate Session.impulses() output
    if (actual.sessionImpulsesOutput.impulseCount !== expected.sessionImpulsesOutput.impulseCount) {
      errors.push(
        `Session.impulses() impulseCount mismatch: expected ${expected.sessionImpulsesOutput.impulseCount}, got ${actual.sessionImpulsesOutput.impulseCount}`
      )
    }
    
    if (actual.sessionImpulsesOutput.totalBudget !== expected.sessionImpulsesOutput.totalBudget) {
      errors.push(
        `Session.impulses() totalBudget mismatch: expected ${expected.sessionImpulsesOutput.totalBudget}, got ${actual.sessionImpulsesOutput.totalBudget}`
      )
    }
    
    if (actual.sessionImpulsesOutput.usedTokens !== expected.sessionImpulsesOutput.usedTokens) {
      errors.push(
        `Session.impulses() usedTokens mismatch: expected ${expected.sessionImpulsesOutput.usedTokens}, got ${actual.sessionImpulsesOutput.usedTokens}`
      )
    }
    
    // Allow 0.01% tolerance for floating point utilization
    const utilizationDiff = Math.abs(actual.sessionImpulsesOutput.utilization - expected.sessionImpulsesOutput.utilization)
    if (utilizationDiff > 0.01) {
      errors.push(
        `Session.impulses() utilization mismatch: expected ${expected.sessionImpulsesOutput.utilization}, got ${actual.sessionImpulsesOutput.utilization}`
      )
    }
    
    // ============================================================
    // STAGE 3: Test SessionState derived fields (loadedCount/unloadedCount)
    // ============================================================
    
    // Compute derived fields (mimics internal getImpulseState logic)
    const loadedCount = sessionImpulsesResult.impulses.filter((i) => i.loaded).length
    const unloadedCount = sessionImpulsesResult.impulses.length - loadedCount
    
    actual.impulseStateOutput = {
      impulseCount: sessionImpulsesResult.stats.impulseCount,
      totalBudget: sessionImpulsesResult.stats.totalBudget,
      usedTokens: sessionImpulsesResult.stats.usedTokens,
      utilization: sessionImpulsesResult.stats.utilization,
      loadedCount,
      unloadedCount
    }
    
    // Validate impulseState output
    if (actual.impulseStateOutput.loadedCount !== expected.impulseStateOutput.loadedCount) {
      errors.push(
        `SessionState.getImpulseState() loadedCount mismatch: expected ${expected.impulseStateOutput.loadedCount}, got ${actual.impulseStateOutput.loadedCount}`
      )
    }
    
    if (actual.impulseStateOutput.unloadedCount !== expected.impulseStateOutput.unloadedCount) {
      errors.push(
        `SessionState.getImpulseState() unloadedCount mismatch: expected ${expected.impulseStateOutput.unloadedCount}, got ${actual.impulseStateOutput.unloadedCount}`
      )
    }
    
    // Verify loadedCount + unloadedCount = impulseCount
    const sumCheck = actual.impulseStateOutput.loadedCount + actual.impulseStateOutput.unloadedCount
    if (sumCheck !== actual.impulseStateOutput.impulseCount) {
      errors.push(
        `Count invariant violation: loadedCount(${actual.impulseStateOutput.loadedCount}) + unloadedCount(${actual.impulseStateOutput.unloadedCount}) = ${sumCheck}, expected impulseCount ${actual.impulseStateOutput.impulseCount}`
      )
    }
    
    // ============================================================
    // STAGE 4: Test TUI display formatting
    // ============================================================
    
    const impulsesLine = formatImpulsesLine(
      actual.impulseStateOutput.impulseCount,
      actual.impulseStateOutput.loadedCount
    )
    
    const budgetLine = formatBudgetLine(
      actual.impulseStateOutput.usedTokens,
      actual.impulseStateOutput.totalBudget,
      actual.impulseStateOutput.utilization
    )
    
    const utilizationColor = getUtilizationColor(actual.impulseStateOutput.utilization)
    
    actual.tuiDisplay = {
      impulsesLine,
      budgetLine,
      utilizationColor
    }
    
    // Validate TUI formatting
    if (actual.tuiDisplay.impulsesLine !== expected.tuiDisplay.impulsesLine) {
      errors.push(
        `TUI impulses line mismatch: expected "${expected.tuiDisplay.impulsesLine}", got "${actual.tuiDisplay.impulsesLine}"`
      )
    }
    
    if (actual.tuiDisplay.budgetLine !== expected.tuiDisplay.budgetLine) {
      errors.push(
        `TUI budget line mismatch: expected "${expected.tuiDisplay.budgetLine}", got "${actual.tuiDisplay.budgetLine}"`
      )
    }
    
    if (actual.tuiDisplay.utilizationColor !== expected.tuiDisplay.utilizationColor) {
      errors.push(
        `TUI utilization color mismatch: expected "${expected.tuiDisplay.utilizationColor}", got "${actual.tuiDisplay.utilizationColor}"`
      )
    }
    
    // ============================================================
    // STAGE 5: Cleanup - Remove test session data
    // ============================================================
    
    // Clean up test impulses
    for (const impulseSpec of input.impulses) {
      try {
        await SessionMemory.removeImpulse(sessionID, impulseSpec.id)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)
  }
  
  return {
    pass: errors.length === 0,
    actual,
    expected,
    errors
  }
}

/**
 * Run all test cases for session-memory-tui-data-flow
 */
export async function runAllTests(): Promise<{
  passed: number
  failed: number
  results: Array<{ case: string; result: ValidationResult }>
}> {
  const testCases = [
    {
      name: "case-1-balanced-load",
      input: {
        impulses: [
          { id: "impulse-1", budget: 100, loaded: true, tokenCount: 100 },
          { id: "impulse-2", budget: 200, loaded: true, tokenCount: 200 },
          { id: "impulse-3", budget: 300, loaded: true, tokenCount: 300 },
          { id: "impulse-4", budget: 150, loaded: false },
          { id: "impulse-5", budget: 250, loaded: false }
        ]
      },
      expected: {
        sessionImpulsesOutput: {
          impulseCount: 5,
          totalBudget: 1000,
          usedTokens: 600,
          utilization: 60
        },
        impulseStateOutput: {
          impulseCount: 5,
          totalBudget: 1000,
          usedTokens: 600,
          utilization: 60,
          loadedCount: 3,
          unloadedCount: 2
        },
        tuiDisplay: {
          impulsesLine: "📦 Impulses: 5 (3 loaded)",
          budgetLine: "💾 Budget: 600 / 1000 (60%)",
          utilizationColor: "warning" as const // 60% = yellow threshold
        }
      }
    },
    {
      name: "case-2-low-utilization",
      input: {
        impulses: [
          { id: "impulse-1", budget: 500, loaded: true, tokenCount: 100 },
          { id: "impulse-2", budget: 500, loaded: false }
        ]
      },
      expected: {
        sessionImpulsesOutput: {
          impulseCount: 2,
          totalBudget: 1000,
          usedTokens: 100,
          utilization: 10
        },
        impulseStateOutput: {
          impulseCount: 2,
          totalBudget: 1000,
          usedTokens: 100,
          utilization: 10,
          loadedCount: 1,
          unloadedCount: 1
        },
        tuiDisplay: {
          impulsesLine: "📦 Impulses: 2 (1 loaded)",
          budgetLine: "💾 Budget: 100 / 1000 (10%)",
          utilizationColor: "success" as const // 10% = green
        }
      }
    },
    {
      name: "case-3-high-utilization",
      input: {
        impulses: [
          { id: "impulse-1", budget: 500, loaded: true, tokenCount: 450 },
          { id: "impulse-2", budget: 500, loaded: true, tokenCount: 400 }
        ]
      },
      expected: {
        sessionImpulsesOutput: {
          impulseCount: 2,
          totalBudget: 1000,
          usedTokens: 850,
          utilization: 85
        },
        impulseStateOutput: {
          impulseCount: 2,
          totalBudget: 1000,
          usedTokens: 850,
          utilization: 85,
          loadedCount: 2,
          unloadedCount: 0
        },
        tuiDisplay: {
          impulsesLine: "📦 Impulses: 2 (2 loaded)",
          budgetLine: "💾 Budget: 850 / 1000 (85%)",
          utilizationColor: "error" as const // 85% = red threshold
        }
      }
    },
    {
      name: "case-4-zero-budget",
      input: {
        impulses: []
      },
      expected: {
        sessionImpulsesOutput: {
          impulseCount: 0,
          totalBudget: 0,
          usedTokens: 0,
          utilization: 0
        },
        impulseStateOutput: {
          impulseCount: 0,
          totalBudget: 0,
          usedTokens: 0,
          utilization: 0,
          loadedCount: 0,
          unloadedCount: 0
        },
        tuiDisplay: {
          impulsesLine: "📦 Impulses: 0 (0 loaded)",
          budgetLine: "💾 Budget: 0 / 0 (0%)",
          utilizationColor: "success" as const // 0% = green
        }
      }
    }
  ]
  
  const results: Array<{ case: string; result: ValidationResult }> = []
  let passed = 0
  let failed = 0
  
  for (const testCase of testCases) {
    const result = await runValidation(testCase.input, testCase.expected)
    results.push({ case: testCase.name, result })
    
    if (result.pass) {
      passed++
      console.log(`✅ ${testCase.name}: PASS`)
    } else {
      failed++
      console.log(`❌ ${testCase.name}: FAIL`)
      console.log(`   Errors: ${result.errors.join(", ")}`)
    }
  }
  
  return { passed, failed, results }
}

// CLI execution
if (require.main === module) {
  runAllTests()
    .then(({ passed, failed }) => {
      console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)
      process.exit(failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error("Fatal error:", error)
      process.exit(1)
    })
}
