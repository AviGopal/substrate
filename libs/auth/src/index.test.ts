/**
 * Milestone 5 Tests: @metabob/auth
 * Tests for rate limiter and circuit breaker
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  RateLimiter,
  createRateLimiter,
  createRateLimiterWithBackend,
  createCircuitBreaker,
  InMemoryRateLimiterBackend,
  CircuitState,
} from './index';

describe('Milestone 5: @metabob/auth', () => {
  describe('Rate Limiter', () => {
    let backend: InMemoryRateLimiterBackend;

    beforeEach(() => {
      backend = new InMemoryRateLimiterBackend();
    });

    test('allows requests within limit', async () => {
      const limiter = createRateLimiterWithBackend(
        { requestsPerMinute: 5, windowMs: 60000 },
        backend
      );

      // First 5 requests should be allowed
      for (let i = 0; i < 5; i++) {
        const allowed = await limiter.checkLimit('user-1');
        expect(allowed).toBe(true);
      }
    });

    test('blocks requests exceeding limit', async () => {
      const limiter = createRateLimiterWithBackend(
        { requestsPerMinute: 3, windowMs: 60000 },
        backend
      );

      // Use up the limit
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit('user-1');
      }

      // 4th request should be blocked
      const allowed = await limiter.checkLimit('user-1');
      expect(allowed).toBe(false);
    });

    test('different keys have separate limits', async () => {
      const limiter = createRateLimiterWithBackend(
        { requestsPerMinute: 2, windowMs: 60000 },
        backend
      );

      // User 1 uses their limit
      await limiter.checkLimit('user-1');
      await limiter.checkLimit('user-1');

      // User 2 should still have their own limit
      const allowed = await limiter.checkLimit('user-2');
      expect(allowed).toBe(true);

      const remaining = await limiter.getRemainingRequests('user-2');
      expect(remaining).toBe(1);
    });

    test('backend can be cleared', async () => {
      const limiter = createRateLimiterWithBackend(
        { requestsPerMinute: 2, windowMs: 60000 },
        backend
      );

      // Use up limit
      await limiter.checkLimit('user-1');
      await limiter.checkLimit('user-1');

      // Should be blocked
      let allowed = await limiter.checkLimit('user-1');
      expect(allowed).toBe(false);

      // Clear backend for user
      await limiter.clearKey('user-1');

      // Should be allowed again
      allowed = await limiter.checkLimit('user-1');
      expect(allowed).toBe(true);
    });

    test('getRemainingRequests returns correct count', async () => {
      const limiter = createRateLimiterWithBackend(
        { requestsPerMinute: 5, windowMs: 60000 },
        backend
      );

      // Initial remaining should be 5
      let remaining = await limiter.getRemainingRequests('user-1');
      expect(remaining).toBe(5);

      // Use 3 requests
      await limiter.checkLimit('user-1');
      await limiter.checkLimit('user-1');
      await limiter.checkLimit('user-1');

      // Should have 2 remaining
      remaining = await limiter.getRemainingRequests('user-1');
      expect(remaining).toBe(2);
    });

    test('createRateLimiter uses default backend', async () => {
      const limiter = createRateLimiter({ requestsPerMinute: 2, windowMs: 60000 });

      // Should work with default backend
      const allowed = await limiter.checkLimit('test-key');
      expect(allowed).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    test('starts in CLOSED state', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.isAllowed()).toBe(true);
    });

    test('opens after failure threshold', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      // Record failures
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.isAllowed()).toBe(true);

      // Third failure should open the circuit
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(breaker.isAllowed()).toBe(false);
    });

    test('success resets failure count', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      // Two failures
      breaker.recordFailure();
      breaker.recordFailure();

      // Success resets the count
      breaker.recordSuccess();
      expect(breaker.getFailureCount()).toBe(0);

      // Two more failures shouldn't open
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // Third consecutive failure opens
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    test('transitions to HALF_OPEN after timeout', async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 50, // Short timeout for testing
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // isAllowed should trigger transition to HALF_OPEN
      expect(breaker.isAllowed()).toBe(true);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    test('closes on success in HALF_OPEN state', async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 50,
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 60));
      breaker.isAllowed(); // Trigger transition
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record success
      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.isAllowed()).toBe(true);
    });

    test('re-opens on failure in HALF_OPEN state', async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 50,
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 60));
      breaker.isAllowed(); // Trigger transition
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record failure in half-open state
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    test('manual reset closes circuit', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Manual reset
      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.isAllowed()).toBe(true);
      expect(breaker.getFailureCount()).toBe(0);
    });

    test('getResetTime returns remaining time', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 5000,
      });

      // Closed circuit has no reset time
      expect(breaker.getResetTime()).toBe(0);

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();

      // Should have reset time
      const resetTime = breaker.getResetTime();
      expect(resetTime).toBeGreaterThan(0);
      expect(resetTime).toBeLessThanOrEqual(5000);
    });
  });

  describe('InMemoryRateLimiterBackend', () => {
    test('stores and retrieves timestamps', async () => {
      const backend = new InMemoryRateLimiterBackend();

      await backend.setTimestamps('key1', [1000, 2000, 3000]);
      const timestamps = await backend.getTimestamps('key1');

      expect(timestamps).toEqual([1000, 2000, 3000]);
    });

    test('returns empty array for unknown keys', async () => {
      const backend = new InMemoryRateLimiterBackend();
      const timestamps = await backend.getTimestamps('unknown');
      expect(timestamps).toEqual([]);
    });

    test('clear removes specific key', async () => {
      const backend = new InMemoryRateLimiterBackend();

      await backend.setTimestamps('key1', [1000]);
      await backend.setTimestamps('key2', [2000]);

      await backend.clear('key1');

      expect(await backend.getTimestamps('key1')).toEqual([]);
      expect(await backend.getTimestamps('key2')).toEqual([2000]);
    });

    test('clear without key removes all', async () => {
      const backend = new InMemoryRateLimiterBackend();

      await backend.setTimestamps('key1', [1000]);
      await backend.setTimestamps('key2', [2000]);

      await backend.clear();

      expect(await backend.getTimestamps('key1')).toEqual([]);
      expect(await backend.getTimestamps('key2')).toEqual([]);
    });
  });
});
