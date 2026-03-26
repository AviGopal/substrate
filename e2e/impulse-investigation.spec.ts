/**
 * E2E Tests: Impulse-Driven Problem Investigation
 *
 * These tests validate the impulse-driven investigation pattern:
 * 1. Request problemCluster pointer → get metadata, not content
 * 2. Metadata contains shape, counts, summary, availableOps
 * 3. Pointer can be used for drill-down via process_impulse
 *
 * This replaces traditional rule-based scanning with investigation-driven
 * detection where LLMs reason about metadata and drill down selectively.
 *
 * To run: bun test e2e/impulse-investigation.spec.ts
 * Prerequisites:
 *   - activity-system deployed (helmfile sync)
 *   - analysis-api has problems data (or creates session-scoped data)
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const API_URLS = {
  activity: process.env.ACTIVITY_API_URL || 'http://activity.metabob.local',
  analysis: process.env.ANALYSIS_API_URL || 'http://api.metabob.local',
}

const TEST_SESSION_ID = `test-session-${Date.now()}`

interface TestContext {
  token: string
  orgId: string
  sessionId: string
}

let ctx: TestContext

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeAll(async () => {
  // Authenticate as MiniBob instance for JWT token
  const authResponse = await fetch(`${API_URLS.activity}/v2/auth/minibob/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: 'minibob-e2e-test',
      api_key: 'test-api-key-123',
    }),
  })

  if (!authResponse.ok) {
    console.log('[Setup] MiniBob auth failed, using session-based auth')
    ctx = { token: '', orgId: 'metabob_internal', sessionId: TEST_SESSION_ID }
    return
  }

  const authData = await authResponse.json() as { token: string; org_id: string }
  ctx = {
    token: authData.token,
    orgId: authData.org_id,
    sessionId: TEST_SESSION_ID,
  }
  console.log(`[Setup] Authenticated, session: ${ctx.sessionId}`)
})

afterAll(async () => {
  console.log('[Teardown] Test session complete')
})

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function resolveImpulse(pointer: Record<string, unknown>): Promise<{
  success: boolean
  loaded?: boolean
  content?: string
  metadata?: Record<string, unknown>
  error?: string
}> {
  const response = await fetch(`${API_URLS.activity}/v2/impulses/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': ctx.sessionId,
      ...(ctx.token ? { 'Authorization': `Bearer ${ctx.token}` } : {}),
    },
    body: JSON.stringify({ pointer }),
  })

  if (!response.ok) {
    const text = await response.text()
    return { success: false, error: `HTTP ${response.status}: ${text}` }
  }

  return response.json()
}

// =============================================================================
// TESTS: PROBLEM CLUSTER IMPULSE POINTER
// =============================================================================

describe('problemCluster impulse pointer', () => {
  test('returns metadata instead of content', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
    })

    // Should succeed
    expect(result.success).toBe(true)

    // Key assertion: loaded should be FALSE (metadata only)
    expect(result.loaded).toBe(false)

    // Should have metadata
    expect(result.metadata).toBeDefined()
  })

  test('metadata contains expected shape fields', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
    })

    expect(result.success).toBe(true)
    expect(result.metadata).toBeDefined()

    const metadata = result.metadata!

    // Shape field identifies the data structure
    expect(metadata.shape).toBe('problem_list')

    // Row count for pagination context
    expect(typeof metadata.rowCount).toBe('number')

    // Summary for quick LLM context
    expect(typeof metadata.summary).toBe('string')

    // Available operations for drill-down
    expect(metadata.availableOps).toBeInstanceOf(Array)
    expect(metadata.availableOps).toContain('filter')
    expect(metadata.availableOps).toContain('expand')
  })

  test('metadata contains severity and category distributions', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
    })

    expect(result.success).toBe(true)
    expect(result.metadata).toBeDefined()

    const metadata = result.metadata!

    // Severity distribution (may be empty object if no problems)
    expect(metadata.bySeverity).toBeDefined()
    expect(typeof metadata.bySeverity).toBe('object')

    // Category distribution (may be empty object if no problems)
    expect(metadata.byCategory).toBeDefined()
    expect(typeof metadata.byCategory).toBe('object')
  })

  test('metadata includes lineage tracking fields', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
    })

    expect(result.success).toBe(true)
    expect(result.metadata).toBeDefined()

    const metadata = result.metadata!

    // Lineage for investigation chains
    expect(metadata.producedBy).toBe('problemCluster')
    expect(metadata.producedAt).toBeDefined()
    expect(typeof metadata.producedAt).toBe('string')
  })

  test('content contains pointer for drill-down operations', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
    })

    expect(result.success).toBe(true)

    // Content should be JSON with pointer info for process_impulse
    expect(result.content).toBeDefined()

    const content = JSON.parse(result.content!)
    expect(content.pointer).toBeDefined()
    expect(content.pointer.type).toBe('problemCluster')
    expect(content.pointer.sessionId).toBe(ctx.sessionId)
  })
})

// =============================================================================
// TESTS: FILTERED PROBLEM CLUSTERS
// =============================================================================

describe('filtered problemCluster requests', () => {
  test('severity filter narrows results', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
      severity: ['CRITICAL', 'HIGH'],
    })

    expect(result.success).toBe(true)
    expect(result.metadata).toBeDefined()

    // Filter params should be included in content for further drill-down
    const content = JSON.parse(result.content!)
    expect(content.filterParams?.severity).toEqual(['CRITICAL', 'HIGH'])
  })

  test('category filter narrows results', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
      category: ['security', 'performance'],
    })

    expect(result.success).toBe(true)

    const content = JSON.parse(result.content!)
    expect(content.filterParams?.category).toEqual(['security', 'performance'])
  })

  test('status filter for open problems only', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
      status: 'open',
    })

    expect(result.success).toBe(true)

    const content = JSON.parse(result.content!)
    expect(content.filterParams?.status).toBe('open')
  })

  test('combined filters work together', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
      severity: ['CRITICAL'],
      category: ['security'],
      status: 'open',
    })

    expect(result.success).toBe(true)
    expect(result.metadata?.rowCount).toBeGreaterThanOrEqual(0)

    const content = JSON.parse(result.content!)
    expect(content.filterParams?.severity).toEqual(['CRITICAL'])
    expect(content.filterParams?.category).toEqual(['security'])
    expect(content.filterParams?.status).toBe('open')
  })
})

// =============================================================================
// TESTS: INVESTIGATION PATTERN VALIDATION
// =============================================================================

describe('investigation-driven pattern', () => {
  test('metadata-first enables reasoning without loading content', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
    })

    expect(result.success).toBe(true)

    // The pattern is:
    // 1. loaded=false means no content was fetched from DB
    expect(result.loaded).toBe(false)

    // 2. metadata provides enough context for LLM to form hypotheses
    const { shape, rowCount, summary, bySeverity, byCategory, topIssue } = result.metadata!
    expect(shape).toBeDefined()
    expect(typeof rowCount).toBe('number')
    expect(typeof summary).toBe('string')

    // 3. availableOps tells LLM what drill-down operations are possible
    expect(result.metadata?.availableOps).toContain('filter')
    expect(result.metadata?.availableOps).toContain('expand')
    expect(result.metadata?.availableOps).toContain('group')
    expect(result.metadata?.availableOps).toContain('resolve')
  })

  test('top issue provides focal point for investigation', async () => {
    const result = await resolveImpulse({
      type: 'problemCluster',
    })

    expect(result.success).toBe(true)

    // topIssue (if present) gives the LLM a starting point
    const topIssue = result.metadata?.topIssue
    if (topIssue) {
      // Should have category for context
      expect(topIssue.category).toBeDefined()
      // Should have brief excerpt (not full content)
      expect(topIssue.brief).toBeDefined()
      expect(typeof topIssue.brief).toBe('string')
      // Brief should be truncated (not full problem content)
      expect(topIssue.brief.length).toBeLessThanOrEqual(103) // 100 + "..."
    }
    // topIssue can be undefined if no problems exist - that's valid
  })
})

// =============================================================================
// TESTS: ERROR HANDLING
// =============================================================================

describe('error handling', () => {
  test('missing session ID returns error', async () => {
    const response = await fetch(`${API_URLS.activity}/v2/impulses/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Intentionally no X-Session-ID
        ...(ctx.token ? { 'Authorization': `Bearer ${ctx.token}` } : {}),
      },
      body: JSON.stringify({
        pointer: { type: 'problemCluster' },
      }),
    })

    const result = await response.json() as { success: boolean; error?: string }

    // Should fail gracefully with clear error
    expect(result.success).toBe(false)
    expect(result.error).toContain('Session')
  })
})
