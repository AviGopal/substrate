/**
 * VesselClient - Manages vessel registration and heartbeat
 */
import type { DiscoveryConfig, HealthStatus, HeartbeatMetrics } from "./types.js";
/**
 * Manages vessel registration and heartbeat against discovery-vessel.
 *
 * For new vessels prefer DiscoveryRegistrationLoop (registration-loop.ts) —
 * canonical heartbeat/re-register semantics; VesselClient remains for
 * existing consumers.
 */
export declare class VesselClient {
    readonly config: DiscoveryConfig;
    private logger;
    private client;
    private metrics;
    private backoff;
    private heartbeatTimer?;
    private lastHeartbeatTime;
    private consecutiveFailureCount;
    private running;
    private startTime;
    private shutdownHandlersRegistered;
    constructor(config: DiscoveryConfig);
    /**
     * Check if heartbeat is running
     */
    get isRunning(): boolean;
    /**
     * Get last successful heartbeat time
     */
    get lastHeartbeat(): Date | null;
    /**
     * Get consecutive failure count
     */
    get consecutiveFailures(): number;
    /**
     * Register vessel with discovery service
     */
    register(): Promise<boolean>;
    /**
     * Send heartbeat to discovery service
     */
    heartbeat(metrics?: HeartbeatMetrics): Promise<boolean>;
    /**
     * Start heartbeat loop
     */
    startHeartbeat(): void;
    /**
     * Stop heartbeat loop
     */
    stopHeartbeat(): void;
    /**
     * Get current health status
     */
    getHealthStatus(): HealthStatus;
    /**
     * Deregister vessel from discovery service
     */
    private deregister;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
    /**
     * Register signal handlers for graceful shutdown
     */
    registerShutdownHandlers(): void;
}
//# sourceMappingURL=vessel-client.d.ts.map