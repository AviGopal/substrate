/**
 * Exponential backoff utility
 */
export class BackoffManager {
    config;
    attempts = 0;
    constructor(config) {
        this.config = config;
    }
    /**
     * Calculate next delay using exponential backoff
     * Formula: min(initialDelay * 2^attempts, maxDelay)
     */
    nextDelay() {
        const delay = Math.min(this.config.initialDelayMs * Math.pow(2, this.attempts), this.config.maxDelayMs);
        this.attempts++;
        return delay;
    }
    /**
     * Reset backoff state after success
     */
    reset() {
        this.attempts = 0;
    }
    /**
     * Check if max attempts reached
     */
    isMaxAttemptsReached() {
        return this.attempts >= this.config.maxAttempts;
    }
    /**
     * Get current attempt count
     */
    getAttempts() {
        return this.attempts;
    }
}
//# sourceMappingURL=backoff.js.map