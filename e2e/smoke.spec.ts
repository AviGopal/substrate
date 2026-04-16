/**
 * E2E Smoke Test
 *
 * Minimal end-to-end test to verify the system is working.
 * Should complete in < 30 seconds.
 *
 * Tests:
 * 1. Backend is reachable
 * 2. Authentication works
 * 3. Can get activity recommendations
 * 4. Thompson Sampling parameters are present
 *
 * To run: bun test e2e/smoke.spec.ts
 */

import { test, expect, describe } from 'bun:test'

const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL || 'https://activity.metabob.com'
const API_KEY = process.env.METABOB_API_KEY

describe('E2E Smoke Test', () => {

  test('Backend is reachable', async () => {
    const response = await fetch(`${ACTIVITY_API_URL}/health`)

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('status')
  })

  test('Authentication works with API key', async () => {
    if (!API_KEY) {
      console.log('⚠️  Skipping: METABOB_API_KEY not set')
      return
    }

    const response = await fetch(`${ACTIVITY_API_URL}/v2/activities/templates`, {
      headers: {
        'Authorization': `ApiKey ${API_KEY}`
      }
    })

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('templates')
    expect(Array.isArray(data.templates)).toBe(true)
  })

  test('Can get activity recommendations', async () => {
    if (!API_KEY) {
      console.log('⚠️  Skipping: METABOB_API_KEY not set')
      return
    }

    const response = await fetch(`${ACTIVITY_API_URL}/v2/activities/recommend`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        goal: 'smoke test goal',
        availableShapes: ['memo']
      })
    })

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('recommendations')
    expect(Array.isArray(data.recommendations)).toBe(true)
  })

  test('Thompson Sampling parameters are present', async () => {
    if (!API_KEY) {
      console.log('⚠️  Skipping: METABOB_API_KEY not set')
      return
    }

    const response = await fetch(`${ACTIVITY_API_URL}/v2/activities/recommend`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        goal: 'smoke test goal',
        availableShapes: ['memo']
      })
    })

    expect(response.ok).toBe(true)

    const data = await response.json()

    if (data.recommendations.length > 0) {
      const first = data.recommendations[0]

      // Should have Thompson parameters
      expect(first).toHaveProperty('thompson')
      expect(first.thompson).toHaveProperty('alpha')
      expect(first.thompson).toHaveProperty('beta')

      // Alpha and beta should be positive
      expect(first.thompson.alpha).toBeGreaterThan(0)
      expect(first.thompson.beta).toBeGreaterThan(0)
    }
  })

  test('Impulse resolution endpoint works', async () => {
    if (!API_KEY) {
      console.log('⚠️  Skipping: METABOB_API_KEY not set')
      return
    }

    const response = await fetch(`${ACTIVITY_API_URL}/v2/impulses/resolve`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pointer: {
          type: 'memo',
          content: 'smoke test impulse'
        },
        metadata: {
          shape: 'test_impulse'
        }
      })
    })

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('content')
    expect(data.content).toBe('smoke test impulse')
  })
})
