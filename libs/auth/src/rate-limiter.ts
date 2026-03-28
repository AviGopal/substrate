/**
 * Rate limiter for API requests
 * Prevents excessive requests per session/key
 */

export interface RateLimiterConfig {
  requestsPerMinute: number;
  windowMs: number;
}

export interface RateLimiterBackend {
  getTimestamps(key: string): Promise<number[]>;
  setTimestamps(key: string, timestamps: number[]): Promise<void>;
  clear(key?: string): Promise<void>;
}

/**
 * In-memory rate limiter backend (default)
 */
export class InMemoryRateLimiterBackend implements RateLimiterBackend {
  private requests = new Map<string, number[]>();

  async getTimestamps(key: string): Promise<number[]> {
    return this.requests.get(key) || [];
  }

  async setTimestamps(key: string, timestamps: number[]): Promise<void> {
    this.requests.set(key, timestamps);
  }

  async clear(key?: string): Promise<void> {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

export class RateLimiter {
  private backend: RateLimiterBackend;
  private config: RateLimiterConfig;

  constructor(config?: Partial<RateLimiterConfig>, backend?: RateLimiterBackend) {
    this.config = {
      requestsPerMinute: config?.requestsPerMinute || 60,
      windowMs: config?.windowMs || 60000,
    };
    this.backend = backend || new InMemoryRateLimiterBackend();
  }

  /**
   * Check if request is allowed within rate limit
   * @param key - Session ID or other identifier
   * @returns true if allowed, false if rate limit exceeded
   */
  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const timestamps = await this.backend.getTimestamps(key);

    // Remove timestamps outside the window
    const recentTimestamps = timestamps.filter(
      (t) => now - t < this.config.windowMs
    );

    // Check if limit exceeded
    if (recentTimestamps.length >= this.config.requestsPerMinute) {
      await this.backend.setTimestamps(key, recentTimestamps);
      return false;
    }

    // Add current timestamp
    recentTimestamps.push(now);
    await this.backend.setTimestamps(key, recentTimestamps);
    return true;
  }

  /**
   * Get remaining requests for a key
   */
  async getRemainingRequests(key: string): Promise<number> {
    const now = Date.now();
    const timestamps = await this.backend.getTimestamps(key);
    const recentTimestamps = timestamps.filter(
      (t) => now - t < this.config.windowMs
    );

    return Math.max(0, this.config.requestsPerMinute - recentTimestamps.length);
  }

  /**
   * Get time until rate limit resets (in ms)
   */
  async getResetTime(key: string): Promise<number> {
    const timestamps = await this.backend.getTimestamps(key);
    if (timestamps.length === 0) {
      return 0;
    }

    const oldestTimestamp = Math.min(...timestamps);
    const resetTime = oldestTimestamp + this.config.windowMs;
    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Clear all rate limit data
   */
  async clear(): Promise<void> {
    await this.backend.clear();
  }

  /**
   * Clear rate limit data for specific key
   */
  async clearKey(key: string): Promise<void> {
    await this.backend.clear(key);
  }
}

/**
 * Create rate limiter with default in-memory backend
 */
export function createRateLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Create rate limiter with custom backend
 */
export function createRateLimiterWithBackend(
  config: Partial<RateLimiterConfig>,
  backend: RateLimiterBackend
): RateLimiter {
  return new RateLimiter(config, backend);
}
