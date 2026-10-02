/**
 * Exponential backoff utility
 */
export interface BackoffConfig {
    initialDelayMs: number;
    maxDelayMs: number;
    maxAttempts: number;
}
export declare class BackoffManager {
    private config;
    private attempts;
    constructor(config: BackoffConfig);
    /**
     * Calculate next delay using exponential backoff
     * Formula: min(initialDelay * 2^attempts, maxDelay)
     */
    nextDelay(): number;
    /**
     * Reset backoff state after success
     */
    reset(): void;
    /**
     * Check if max attempts reached
     */
    isMaxAttemptsReached(): boolean;
    /**
     * Get current attempt count
     */
    getAttempts(): number;
}
//# sourceMappingURL=backoff.d.ts.map