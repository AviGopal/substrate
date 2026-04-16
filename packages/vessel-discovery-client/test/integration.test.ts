/**
 * Integration tests - full workflow
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { register } from "../src/registration.js"
import { discoverByShape } from "../src/discovery.js"
import type { Logger } from "../src/types.js"

const mockLogger: Logger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
}

const originalFetch = global.fetch
let mockFetch: any

beforeEach(() => {
  mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        expiresAt: Date.now() + 300000,
        nextHeartbeatMs: 120000,
      }),
    } as Response)
  )
  global.fetch = mockFetch
})

afterEach(() => {
  global.fetch = originalFetch
})

describe("Integration: Full Workflow", () => {
  test("should register vessel and start heartbeat", async () => {
    const client = await register({
      vesselId: "test-vessel",
      vesselName: "Test Vessel",
      endpoint: "http://test:8080",
      shapes: ["test-shape"],
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
      heartbeatIntervalMs: 50, // Fast for testing
    })

    expect(client.isRunning).toBe(true)

    // Wait for at least one heartbeat
    await new Promise((resolve) => setTimeout(resolve, 100))

    await client.shutdown()
    expect(client.isRunning).toBe(false)
  })

  test("should handle full registration + discovery workflow", async () => {
    // Setup mock for discovery
    mockFetch = mock((url: string) => {
      if (url.includes("/register")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            expiresAt: Date.now() + 300000,
          }),
        } as Response)
      } else if (url.includes("/resolve")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            content: {
              shape: "test-shape",
              vessels: [
                {
                  vesselId: "test-vessel",
                  vesselName: "Test Vessel",
                  endpoint: "http://test:8080",
                  confidence: 1.0,
                  lastSeen: new Date().toISOString(),
                },
              ],
              found: true,
            },
          }),
        } as Response)
      }
      return Promise.reject(new Error("Unknown endpoint"))
    })
    global.fetch = mockFetch

    // Register vessel
    const client = await register({
      vesselId: "test-vessel",
      vesselName: "Test Vessel",
      endpoint: "http://test:8080",
      shapes: ["test-shape"],
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
    })

    // Discover vessels
    const result = await discoverByShape({
      shape: "test-shape",
      discoveryEndpoint: "http://discovery:8080",
      logger: mockLogger,
    })

    expect(result.found).toBe(true)
    expect(result.vessels).toHaveLength(1)
    expect(result.vessels[0].vesselId).toBe("test-vessel")

    await client.shutdown()
  })
})
