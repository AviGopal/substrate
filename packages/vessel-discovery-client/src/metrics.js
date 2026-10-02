/**
 * Metrics emission for monitoring vessel operations
 */
/**
 * Default metrics emitter that logs to console
 */
export class DefaultMetricsEmitter {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    emit(metric, value, tags) {
        const tagsStr = tags ? ` ${JSON.stringify(tags)}` : "";
        const valueStr = value !== undefined ? `=${value}` : "";
        this.logger?.debug(`[Metric] ${metric}${valueStr}${tagsStr}`);
    }
}
/**
 * Standard metric names
 */
export const Metrics = {
    REGISTRATION_SUCCESS: "vessel.registration.success",
    REGISTRATION_FAILURE: "vessel.registration.failure",
    HEARTBEAT_SUCCESS: "vessel.heartbeat.success",
    HEARTBEAT_FAILURE: "vessel.heartbeat.failure",
    HEARTBEAT_LATENCY_MS: "vessel.heartbeat.latency_ms",
    SHUTDOWN_CLEAN: "vessel.shutdown.clean",
    DISCOVERY_SUCCESS: "vessel.discovery.success",
    DISCOVERY_CACHE_HIT: "vessel.discovery.cache_hit",
    DISCOVERY_FAILURE: "vessel.discovery.failure",
};
/**
 * Metrics helper for vessel client
 */
export class VesselMetrics {
    emitter;
    constructor(emitter, logger) {
        this.emitter = emitter || new DefaultMetricsEmitter(logger);
    }
    registrationSuccess(vesselId) {
        this.emitter.emit(Metrics.REGISTRATION_SUCCESS, 1, { vesselId });
    }
    registrationFailure(vesselId, error) {
        this.emitter.emit(Metrics.REGISTRATION_FAILURE, 1, { vesselId, error });
    }
    heartbeatSuccess(vesselId, latencyMs) {
        this.emitter.emit(Metrics.HEARTBEAT_SUCCESS, 1, { vesselId });
        this.emitter.emit(Metrics.HEARTBEAT_LATENCY_MS, latencyMs, { vesselId });
    }
    heartbeatFailure(vesselId, consecutiveFailures) {
        this.emitter.emit(Metrics.HEARTBEAT_FAILURE, 1, {
            vesselId,
            consecutiveFailures: String(consecutiveFailures),
        });
    }
    shutdownClean(vesselId) {
        this.emitter.emit(Metrics.SHUTDOWN_CLEAN, 1, { vesselId });
    }
    discoverySuccess(shape, vesselsFound) {
        this.emitter.emit(Metrics.DISCOVERY_SUCCESS, vesselsFound, { shape });
    }
    discoveryCacheHit(shape) {
        this.emitter.emit(Metrics.DISCOVERY_CACHE_HIT, 1, { shape });
    }
    discoveryFailure(shape, error) {
        this.emitter.emit(Metrics.DISCOVERY_FAILURE, 1, { shape, error });
    }
}
//# sourceMappingURL=metrics.js.map