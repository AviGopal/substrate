/**
 * Discovery tests
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { discoverByShape, clearDiscoveryCache } from "../src/discovery"
import type { Logger } from "../src/types"

const mockLogger: Logger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
}

const originalFetch = global.fetch
let mockFetch: any

beforeEach(() => {
  clearDiscoveryCache()
  mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({
        content: {
          shape: "test-shape",
          vessels: [
            {
              vesselId: "vessel-1",
              vesselName: "Vessel 1",
              endpoint: "http://vessel-1:8080",
              protocol: "http",
              confidence: 0.95,
              lastSeen: new Date().toISOString(),
            },
          ],
          found: true,
        },
      }),
    } as Response)
  )
  global.fetch = mockFetch
})

afterEach(() => {
  global.fetch = originalFetch
  clearDiscoveryCache()
})

describe("discoverByShape", () => {
  test("should discover vessels by shape", async () => {
    const result = await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
    })

    expect(result.found).toBe(true)
    expect(result.shape).toBe("test-shape")
    expect(result.vessels).toHaveLength(1)
    expect(result.vessels[0].vesselId).toBe("vessel-1")
    expect(result.cached).toBe(false)
  })

  test("should cache discovery results", async () => {
    // First call - should hit backend
    const result1 = await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
      cacheTtlMs: 10000,
    })

    expect(result1.cached).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call - should use cache
    const result2 = await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
      cacheTtlMs: 10000,
    })

    expect(result2.cached).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1) // No additional call
  })

  test("should fall back to cache on error", async () => {
    // First call - populate cache
    await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
      cacheTtlMs: 10000,
    })

    // Mock fetch to fail
    mockFetch = mock(() => Promise.reject(new Error("Network error")))
    global.fetch = mockFetch

    // Second call - should return cached result
    const result = await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
      cacheTtlMs: 10000,
    })

    expect(result.found).toBe(true)
    expect(result.cached).toBe(true)
  })

  test("should return empty result on error with no cache", async () => {
    mockFetch = mock(() => Promise.reject(new Error("Network error")))
    global.fetch = mockFetch

    const result = await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
    })

    expect(result.found).toBe(false)
    expect(result.vessels).toHaveLength(0)
    expect(result.cached).toBe(false)
  })

  test("should include auth token in request", async () => {
    await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      authToken: "test-token",
      authType: "Bearer",
      logger: mockLogger,
    })

    const call = mockFetch.mock.calls[0]
    const headers = call[1].headers

    expect(headers.Authorization).toBe("Bearer test-token")
  })

  test("should send correct pointer structure", async () => {
    await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
    })

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.pointer).toEqual({
      type: "vesselCapability",
      shape: "test-shape",
    })
  })
})
