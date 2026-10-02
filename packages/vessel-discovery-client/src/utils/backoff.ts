/**
 * Exponential backoff utility
 */

export interface BackoffConfig {
  initialDelayMs: number
  maxDelayMs: number
  maxAttempts: number
}

export class BackoffManager {
  private attempts = 0

  constructor(private config: BackoffConfig) {}

  /**
   * Calculate next delay using exponential backoff
   * Formula: min(initialDelay * 2^attempts, maxDelay)
   */
  nextDelay(): number {
    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(2, this.attempts),
      this.config.maxDelayMs
    )
    this.attempts++
    return delay
  }

  /**
   * Reset backoff state after success
   */
  reset(): void {
    this.attempts = 0
  }

  /**
   * Check if max attempts reached
   */
  isMaxAttemptsReached(): boolean {
    return this.attempts >= this.config.maxAttempts
  }

  /**
   * Get current attempt count
   */
  getAttempts(): number {
    return this.attempts
  }
}
