/**
 * Metrics emission for monitoring vessel operations
 */
import type { MetricsEmitter, Logger } from "./types.js";
/**
 * Default metrics emitter that logs to console
 */
export declare class DefaultMetricsEmitter implements MetricsEmitter {
    private logger?;
    constructor(logger?: Logger | undefined);
    emit(metric: string, value?: number, tags?: Record<string, string>): void;
}
/**
 * Standard metric names
 */
export declare const Metrics: {
    readonly REGISTRATION_SUCCESS: "vessel.registration.success";
    readonly REGISTRATION_FAILURE: "vessel.registration.failure";
    readonly HEARTBEAT_SUCCESS: "vessel.heartbeat.success";
    readonly HEARTBEAT_FAILURE: "vessel.heartbeat.failure";
    readonly HEARTBEAT_LATENCY_MS: "vessel.heartbeat.latency_ms";
    readonly SHUTDOWN_CLEAN: "vessel.shutdown.clean";
    readonly DISCOVERY_SUCCESS: "vessel.discovery.success";
    readonly DISCOVERY_CACHE_HIT: "vessel.discovery.cache_hit";
    readonly DISCOVERY_FAILURE: "vessel.discovery.failure";
};
/**
 * Metrics helper for vessel client
 */
export declare class VesselMetrics {
    private emitter;
    constructor(emitter?: MetricsEmitter, logger?: Logger);
    registrationSuccess(vesselId: string): void;
    registrationFailure(vesselId: string, error: string): void;
    heartbeatSuccess(vesselId: string, latencyMs: number): void;
    heartbeatFailure(vesselId: string, consecutiveFailures: number): void;
    shutdownClean(vesselId: string): void;
    discoverySuccess(shape: string, vesselsFound: number): void;
    discoveryCacheHit(shape: string): void;
    discoveryFailure(shape: string, error: string): void;
}
//# sourceMappingURL=metrics.d.ts.map