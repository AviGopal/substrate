/**
 * BackoffManager tests
 */

import { describe, test, expect } from "bun:test"
import { BackoffManager } from "../src/utils/backoff"

describe("BackoffManager", () => {
  test("should calculate exponential backoff", () => {
    const backoff = new BackoffManager({
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxAttempts: 5,
    })

    expect(backoff.nextDelay()).toBe(1000) // 1000 * 2^0
    expect(backoff.nextDelay()).toBe(2000) // 1000 * 2^1
    expect(backoff.nextDelay()).toBe(4000) // 1000 * 2^2
    expect(backoff.nextDelay()).toBe(8000) // 1000 * 2^3
    expect(backoff.nextDelay()).toBe(16000) // 1000 * 2^4
  })

  test("should cap at max delay", () => {
    const backoff = new BackoffManager({
      initialDelayMs: 1000,
      maxDelayMs: 5000,
      maxAttempts: 10,
    })

    expect(backoff.nextDelay()).toBe(1000)
    expect(backoff.nextDelay()).toBe(2000)
    expect(backoff.nextDelay()).toBe(4000)
    expect(backoff.nextDelay()).toBe(5000) // Capped
    expect(backoff.nextDelay()).toBe(5000) // Still capped
  })

  test("should reset attempts", () => {
    const backoff = new BackoffManager({
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxAttempts: 5,
    })

    backoff.nextDelay()
    backoff.nextDelay()
    expect(backoff.getAttempts()).toBe(2)

    backoff.reset()
    expect(backoff.getAttempts()).toBe(0)
    expect(backoff.nextDelay()).toBe(1000) // Back to initial
  })

  test("should track max attempts", () => {
    const backoff = new BackoffManager({
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxAttempts: 3,
    })

    expect(backoff.isMaxAttemptsReached()).toBe(false)

    backoff.nextDelay()
    backoff.nextDelay()
    backoff.nextDelay()

    expect(backoff.isMaxAttemptsReached()).toBe(true)
  })
})
