/**
 * VesselClient tests
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { VesselClient } from "../src/vessel-client"
import type { DiscoveryConfig, Logger } from "../src/types"

// Mock logger that suppresses output during tests
const mockLogger: Logger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
}

// Mock fetch for testing
const originalFetch = global.fetch
let mockFetch: any

beforeEach(() => {
  mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ success: true, expiresAt: Date.now() + 300000 }),
    } as Response)
  )
  global.fetch = mockFetch
})

afterEach(() => {
  global.fetch = originalFetch
})

describe("VesselClient", () => {
  const baseConfig: DiscoveryConfig = {
    vesselId: "test-vessel",
    vesselName: "Test Vessel",
    endpoint: "http://test:8080",
    shapes: ["test-shape"],
    discoveryEndpoint: "http://discovery:8080",
    logger: mockLogger,
    heartbeatIntervalMs: 100, // Fast for testing
  }

  test("should create client with default config", () => {
    const client = new VesselClient(baseConfig)

    expect(client.config.vesselId).toBe("test-vessel")
    expect(client.config.version).toBe("0.0.0")
    expect(client.config.ttl).toBe(300)
    expect(client.config.protocol).toBe("http")
    expect(client.isRunning).toBe(false)
  })

  test("should register successfully", async () => {
    const client = new VesselClient(baseConfig)

    const result = await client.register()

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe("http://discovery:8080/register")
  })

  test("should handle registration failure", async () => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: false,
        statusText: "Internal Server Error",
      } as Response)
    )
    global.fetch = mockFetch

    const client = new VesselClient(baseConfig)
    const result = await client.register()

    expect(result).toBe(false)
  })

  test("should send heartbeat successfully", async () => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: true, nextHeartbeatMs: 120000 }),
      } as Response)
    )
    global.fetch = mockFetch

    const client = new VesselClient(baseConfig)
    const result = await client.heartbeat()

    expect(result).toBe(true)
    expect(client.lastHeartbeat).not.toBeNull()
    expect(client.consecutiveFailures).toBe(0)
  })

  test("should track consecutive failures", async () => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: false, nextHeartbeatMs: 120000 }),
      } as Response)
    )
    global.fetch = mockFetch

    const client = new VesselClient(baseConfig)

    await client.heartbeat()
    expect(client.consecutiveFailures).toBe(1)

    await client.heartbeat()
    expect(client.consecutiveFailures).toBe(2)

    await client.heartbeat()
    expect(client.consecutiveFailures).toBe(3)
  })

  test("should reset consecutive failures on success", async () => {
    const client = new VesselClient(baseConfig)

    // Fail once
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: false, nextHeartbeatMs: 120000 }),
      } as Response)
    )
    global.fetch = mockFetch
    await client.heartbeat()
    expect(client.consecutiveFailures).toBe(1)

    // Succeed
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: true, nextHeartbeatMs: 120000 }),
      } as Response)
    )
    global.fetch = mockFetch
    await client.heartbeat()
    expect(client.consecutiveFailures).toBe(0)
  })

  test("should get health status", () => {
    const client = new VesselClient(baseConfig)
    const health = client.getHealthStatus()

    expect(health.status).toBe("unhealthy") // Not running yet
    expect(health.vessel).toBe("test-vessel")
    expect(health.version).toBe("0.0.0")
    expect(health.shapes).toEqual(["test-shape"])
    expect(health.heartbeat.isRunning).toBe(false)
  })

  test("should report degraded status with failures", async () => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: false, nextHeartbeatMs: 120000 }),
      } as Response)
    )
    global.fetch = mockFetch

    const client = new VesselClient(baseConfig)
    client.startHeartbeat()

    await client.heartbeat()

    const health = client.getHealthStatus()
    expect(health.status).toBe("degraded")
    expect(health.heartbeat.consecutiveFailures).toBeGreaterThan(0)

    client.stopHeartbeat()
  })

  test("should start and stop heartbeat", async () => {
    const client = new VesselClient(baseConfig)

    expect(client.isRunning).toBe(false)

    client.startHeartbeat()
    expect(client.isRunning).toBe(true)

    // Wait for at least one heartbeat
    await new Promise((resolve) => setTimeout(resolve, 150))

    client.stopHeartbeat()
    expect(client.isRunning).toBe(false)
  })

  test("should include metadata in registration", async () => {
    const metadata = { environment: "test", podId: "pod-123" }
    const config = {
      ...baseConfig,
      metadata,
    }

    const client = new VesselClient(config)
    await client.register()

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.metadata).toEqual(metadata)
  })

  test("should send metrics with heartbeat", async () => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: true, nextHeartbeatMs: 120000 }),
      } as Response)
    )
    global.fetch = mockFetch

    const client = new VesselClient(baseConfig)
    const metrics = {
      executionsCompleted: 42,
      errorRate: 0.05,
      avgLatencyMs: 123,
    }

    await client.heartbeat(metrics)

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.metrics).toEqual(metrics)
  })

  test("should gracefully shutdown", async () => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response)
    )
    global.fetch = mockFetch

    const client = new VesselClient(baseConfig)
    client.startHeartbeat()

    await client.shutdown()

    expect(client.isRunning).toBe(false)
    expect(mockFetch).toHaveBeenCalled()

    // Check that DELETE was called for deregistration
    const calls = mockFetch.mock.calls
    const deleteCall = calls.find(
      (call: any) => call[1]?.method === "DELETE"
    )
    expect(deleteCall).toBeDefined()
  })
})
