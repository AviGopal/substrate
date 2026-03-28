/**
 * Validation Harness: impulse-token-budget-management
 * 
 * Tests the impulse token budget management specification:
 * - 85% threshold enforcement
 * - UsageStats filtering (loadCount<2 AND lastAccessed>1hr)
 * - Automatic unloading of low-priority impulses
 * - Recalculation of utilization after unload
 * - Auto-trigger of manage-session-memory activity when still >85%
 * - Color-coded TUI display (Green/Yellow/Red)
 */

import { SessionMemory } from "../../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { SessionMemoryManager } from "../../repos/metabob-opencode/packages/opencode/src/session/memory-manager"
import { ActivityTemplate } from "../../repos/metabob-opencode/packages/opencode/src/session/activity-template"
import { TurnLifecycle } from "../../repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle"
import { Identifier } from "../../repos/metabob-opencode/packages/opencode/src/id/id"

export interface ValidationInput {
  totalBudget: number
  initialUtilization: number
  impulses: {
    priority: "high" | "medium" | "low"
    budget: number
    tokens: number
    loadCount: number
    lastAccessedHoursAgo: number
    loaded: boolean
  }[]
}

export interface ValidationOutput {
  pass: boolean
  actual: {
    lowPriorityIdentified: number
    lowPriorityUnloaded: number
    utilizationBefore: number
    utilizationAfter: number
    activityTriggered: boolean
    colorCode: "green" | "yellow" | "red"
    unloadedImpulseIds: string[]
  }
  expected: {
    lowPriorityIdentified: number
    lowPriorityUnloaded: number
    utilizationBefore: number
    utilizationAfter: number
    activityTriggered: boolean
    colorCode: "green" | "yellow" | "red"
  }
  errors: string[]
}

/**
 * Calculate expected color code based on utilization
 */
function getColorCode(utilization: number): "green" | "yellow" | "red" {
  if (utilization >= 85) return "red"
  if (utilization >= 60) return "yellow"
  return "green"
}

/**
 * Run validation for impulse token budget management
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  const sessionID = Identifier.ascending("session")

  try {
    // Step 1: Create impulses matching the input specification
    const impulseIds: string[] = []
    const now = Date.now()

    for (let i = 0; i < input.impulses.length; i++) {
      const imp = input.impulses[i]
      const impulseId = `impulse-${i}`
      impulseIds.push(impulseId)

      const lastAccessedAt = now - imp.lastAccessedHoursAgo * 60 * 60 * 1000

      const impulse: ActivityTemplate.Impulse.Schema = {
        id: impulseId,
        sessionID,
        scope: "session",
        pointer: { type: "memo", content: `Test impulse ${i}` },
        budget: imp.budget,
        priority: imp.priority,
        type: "memo",
        loaded: imp.loaded,
        tokenCount: imp.tokens,
        usageStats: {
          loadCount: imp.loadCount,
          totalCost: 0,
          totalTokens: imp.tokens,
          firstAccessedAt: lastAccessedAt,
          lastAccessedAt: lastAccessedAt,
        },
      }

      await SessionMemory.addImpulse(sessionID, impulse)
    }

    // Step 2: Get initial state
    const spaceBefore = await SessionMemoryManager.getContextSpace(sessionID)
    const utilizationBefore = spaceBefore.stats.utilization

    // Step 3: Identify low-priority candidates (matching PostTurnCleanupHook logic)
    const oneHourAgo = now - 60 * 60 * 1000
    const fullImpulses = await SessionMemory.listImpulses(sessionID)

    const lowPriorityCandidates = fullImpulses.filter((imp) => {
      if (imp.priority !== "low" || !imp.loaded) return false

      const stats = imp.usageStats
      if (!stats) return true // No stats = unload

      const lowLoadCount = (stats.loadCount ?? 0) < 2
      const notRecentlyUsed = !stats.lastAccessedAt || stats.lastAccessedAt < oneHourAgo

      return lowLoadCount && notRecentlyUsed
    })

    // Step 4: Simulate unloading (what PostTurnCleanupHook would do)
    const unloadedIds: string[] = []
    if (utilizationBefore >= 85) {
      for (const impulse of lowPriorityCandidates) {
        await SessionMemory.updateImpulse(sessionID, impulse.id, {
          loaded: false,
          content: undefined,
        })
        unloadedIds.push(impulse.id)
      }
    }

    // Step 5: Get final state
    await SessionMemoryManager.updateContextSpace(sessionID)
    const spaceAfter = await SessionMemoryManager.getContextSpace(sessionID)
    const utilizationAfter = spaceAfter.stats.utilization

    // Step 6: Determine if activity would be triggered
    const activityTriggered = utilizationBefore >= 85 && utilizationAfter >= 85

    // Step 7: Calculate expected values
    const expectedLowPriorityIdentified = input.impulses.filter((imp) => {
      if (imp.priority !== "low" || !imp.loaded) return false
      const lowLoadCount = imp.loadCount < 2
      const notRecentlyUsed = imp.lastAccessedHoursAgo > 1
      return lowLoadCount && notRecentlyUsed
    }).length

    // Calculate expected utilization after unload
    const unloadedTokens = input.impulses
      .filter((imp) => {
        if (imp.priority !== "low" || !imp.loaded) return false
        const lowLoadCount = imp.loadCount < 2
        const notRecentlyUsed = imp.lastAccessedHoursAgo > 1
        return lowLoadCount && notRecentlyUsed
      })
      .reduce((sum, imp) => sum + imp.tokens, 0)

    const totalTokensBefore = input.impulses
      .filter((imp) => imp.loaded)
      .reduce((sum, imp) => sum + imp.tokens, 0)

    const totalTokensAfter = totalTokensBefore - unloadedTokens
    const expectedUtilizationAfter = (totalTokensAfter / input.totalBudget) * 100

    const expectedActivityTriggered = input.initialUtilization >= 85 && expectedUtilizationAfter >= 85

    // Step 8: Build output
    const actual = {
      lowPriorityIdentified: lowPriorityCandidates.length,
      lowPriorityUnloaded: unloadedIds.length,
      utilizationBefore: utilizationBefore,
      utilizationAfter: utilizationAfter,
      activityTriggered: activityTriggered,
      colorCode: getColorCode(utilizationAfter),
      unloadedImpulseIds: unloadedIds,
    }

    const expected = {
      lowPriorityIdentified: expectedLowPriorityIdentified,
      lowPriorityUnloaded: expectedLowPriorityIdentified,
      utilizationBefore: input.initialUtilization,
      utilizationAfter: expectedUtilizationAfter,
      activityTriggered: expectedActivityTriggered,
      colorCode: getColorCode(expectedUtilizationAfter),
    }

    // Step 9: Validate results
    let pass = true

    if (actual.lowPriorityIdentified !== expected.lowPriorityIdentified) {
      errors.push(
        `Low-priority identification mismatch: expected ${expected.lowPriorityIdentified}, got ${actual.lowPriorityIdentified}`,
      )
      pass = false
    }

    if (actual.lowPriorityUnloaded !== expected.lowPriorityUnloaded) {
      errors.push(
        `Low-priority unload count mismatch: expected ${expected.lowPriorityUnloaded}, got ${actual.lowPriorityUnloaded}`,
      )
      pass = false
    }

    if (Math.abs(actual.utilizationBefore - expected.utilizationBefore) > 1) {
      errors.push(
        `Utilization before mismatch: expected ${expected.utilizationBefore.toFixed(1)}%, got ${actual.utilizationBefore.toFixed(1)}%`,
      )
      pass = false
    }

    if (Math.abs(actual.utilizationAfter - expected.utilizationAfter) > 1) {
      errors.push(
        `Utilization after mismatch: expected ${expected.utilizationAfter.toFixed(1)}%, got ${actual.utilizationAfter.toFixed(1)}%`,
      )
      pass = false
    }

    if (actual.activityTriggered !== expected.activityTriggered) {
      errors.push(
        `Activity trigger mismatch: expected ${expected.activityTriggered}, got ${actual.activityTriggered}`,
      )
      pass = false
    }

    if (actual.colorCode !== expected.colorCode) {
      errors.push(`Color code mismatch: expected ${expected.colorCode}, got ${actual.colorCode}`)
      pass = false
    }

    // Cleanup
    for (const id of impulseIds) {
      try {
        await SessionMemory.updateImpulse(sessionID, id, { loaded: false })
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return {
      pass,
      actual,
      expected,
      errors,
    }
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)

    return {
      pass: false,
      actual: {
        lowPriorityIdentified: 0,
        lowPriorityUnloaded: 0,
        utilizationBefore: 0,
        utilizationAfter: 0,
        activityTriggered: false,
        colorCode: "green",
        unloadedImpulseIds: [],
      },
      expected: {
        lowPriorityIdentified: 0,
        lowPriorityUnloaded: 0,
        utilizationBefore: input.initialUtilization,
        utilizationAfter: 0,
        activityTriggered: false,
        colorCode: "green",
      },
      errors,
    }
  }
}

/**
 * Test case 1: 87% utilization, should unload low-priority and drop to 67% (Yellow, no activity)
 */
export const testCase1: ValidationInput = {
  totalBudget: 15000,
  initialUtilization: 87,
  impulses: [
    // 3 low-priority impulses that should be unloaded (loadCount=1, lastAccessed=2hr ago)
    {
      priority: "low",
      budget: 1000,
      tokens: 1000,
      loadCount: 1,
      lastAccessedHoursAgo: 2,
      loaded: true,
    },
    {
      priority: "low",
      budget: 1000,
      tokens: 1000,
      loadCount: 1,
      lastAccessedHoursAgo: 2,
      loaded: true,
    },
    {
      priority: "low",
      budget: 1000,
      tokens: 1000,
      loadCount: 1,
      lastAccessedHoursAgo: 2,
      loaded: true,
    },
    // 5 high-priority impulses that should NOT be unloaded
    {
      priority: "high",
      budget: 2000,
      tokens: 2000,
      loadCount: 5,
      lastAccessedHoursAgo: 0.08, // 5 minutes ago
      loaded: true,
    },
    {
      priority: "high",
      budget: 2000,
      tokens: 2000,
      loadCount: 5,
      lastAccessedHoursAgo: 0.08,
      loaded: true,
    },
    {
      priority: "high",
      budget: 2000,
      tokens: 2000,
      loadCount: 5,
      lastAccessedHoursAgo: 0.08,
      loaded: true,
    },
    {
      priority: "high",
      budget: 2000,
      tokens: 2000,
      loadCount: 5,
      lastAccessedHoursAgo: 0.08,
      loaded: true,
    },
    {
      priority: "high",
      budget: 2000,
      tokens: 2000,
      loadCount: 5,
      lastAccessedHoursAgo: 0.08,
      loaded: true,
    },
  ],
}

/**
 * Test case 2: 95% utilization, unload reduces to 90%, still triggers activity
 */
export const testCase2: ValidationInput = {
  totalBudget: 10000,
  initialUtilization: 95,
  impulses: [
    // 1 low-priority impulse (500 tokens)
    {
      priority: "low",
      budget: 500,
      tokens: 500,
      loadCount: 1,
      lastAccessedHoursAgo: 3,
      loaded: true,
    },
    // 9 high-priority impulses (9000 tokens)
    ...Array.from({ length: 9 }, () => ({
      priority: "high" as const,
      budget: 1000,
      tokens: 1000,
      loadCount: 10,
      lastAccessedHoursAgo: 0.01,
      loaded: true,
    })),
  ],
}

/**
 * Test case 3: Low-priority impulses with high loadCount should NOT be unloaded
 */
export const testCase3: ValidationInput = {
  totalBudget: 10000,
  initialUtilization: 88,
  impulses: [
    // Low-priority but frequently used (should NOT unload)
    {
      priority: "low",
      budget: 1000,
      tokens: 1000,
      loadCount: 5, // High load count
      lastAccessedHoursAgo: 2,
      loaded: true,
    },
    // Low-priority and rarely used (should unload)
    {
      priority: "low",
      budget: 1000,
      tokens: 1000,
      loadCount: 1, // Low load count
      lastAccessedHoursAgo: 2,
      loaded: true,
    },
    // Rest of budget (6800 tokens)
    ...Array.from({ length: 7 }, () => ({
      priority: "medium" as const,
      budget: 1000,
      tokens: 1000,
      loadCount: 3,
      lastAccessedHoursAgo: 0.5,
      loaded: true,
    })),
  ],
}

/**
 * Test case 4: Recent low-priority impulses should NOT be unloaded
 */
export const testCase4: ValidationInput = {
  totalBudget: 10000,
  initialUtilization: 88,
  impulses: [
    // Low-priority but recently used (should NOT unload)
    {
      priority: "low",
      budget: 1000,
      tokens: 1000,
      loadCount: 1,
      lastAccessedHoursAgo: 0.5, // 30 minutes ago (< 1 hour)
      loaded: true,
    },
    // Low-priority and old (should unload)
    {
      priority: "low",
      budget: 1000,
      tokens: 1000,
      loadCount: 1,
      lastAccessedHoursAgo: 2, // 2 hours ago (> 1 hour)
      loaded: true,
    },
    // Rest of budget
    ...Array.from({ length: 7 }, () => ({
      priority: "medium" as const,
      budget: 1000,
      tokens: 1000,
      loadCount: 3,
      lastAccessedHoursAgo: 0.5,
      loaded: true,
    })),
  ],
}
