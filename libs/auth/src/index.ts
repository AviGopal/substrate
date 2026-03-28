/**
 * @metabob/auth
 * Authentication utilities for Metabob services
 */

// Rate limiter
export {
  RateLimiter,
  InMemoryRateLimiterBackend,
  createRateLimiter,
  createRateLimiterWithBackend,
  type RateLimiterConfig,
  type RateLimiterBackend,
} from './rate-limiter.js';

// Circuit breaker
export {
  CircuitBreaker,
  CircuitState,
  createCircuitBreaker,
  type CircuitBreakerConfig,
} from './circuit-breaker.js';
