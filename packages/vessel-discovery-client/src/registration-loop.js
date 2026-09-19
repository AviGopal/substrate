/**
 * DiscoveryRegistrationLoop — register on startup, 60s heartbeat, deregister on stop.
 *
 * Canonical registration/heartbeat semantics, ported from
 * `ias-executor-ts/src/hosts/discovery-registration-loop.ts` (SC-P4 client
 * unification). Behavior contract:
 *
 *   - register on start(), then heartbeat every 60s (configurable)
 *   - a heartbeat 404 means discovery lost the record (e.g. discovery-vessel
 *     restarted and dropped its in-memory registry) → re-register IMMEDIATELY
 *   - after 3 consecutive heartbeat failures, fire the onUnhealthy callback
 *   - graceful DELETE deregistration on stop()
 *   - advertised-endpoint env contract: VESSEL_ADVERTISE_ENDPOINT /
 *     SUBSTRATE_ADVERTISE_HOST (+ SUBSTRATE_ADVERTISE_PORT_OFFSET, default
 *     10000) for `endpoint`, VESSEL_PUBLIC_ENDPOINT for the optional
 *     `public_endpoint` (host/LAN-reachable URL for callers outside the
 *     container network)
 *
 * Usage:
 *   const loop = new DiscoveryRegistrationLoop({ discoveryEndpoint, vesselId, ... });
 *   await loop.start();
 *   // ...
 *   await loop.stop();
 */
const defaultLogger = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    debug: () => { }, // Suppress debug by default
};
/**
 * Every call to discovery is bounded.
 *
 * All three of register, heartbeat and deregister used unbounded `fetch`. A
 * discovery-vessel that accepts the connection and then never answers wedges
 * whichever one is in flight: a hung heartbeat silently stops the interval from
 * making progress, and a hung deregister blocks a graceful shutdown that has
 * already stopped advertising — leaving a vessel that is unregistered, refusing
 * new work, and still running. Observed on goal-host: deregistered, then
 * serving 503s to every dispatch with no route back into the registry.
 *
 * Generous rather than tight. This bounds pathology, it does not police
 * latency.
 */
const DISCOVERY_CALL_TIMEOUT_MS = 15_000;
export class DiscoveryRegistrationLoop {
    config;
    heartbeatTimer;
    failureCount = 0;
    unhealthyCallback;
    logger;
    constructor(config) {
        this.config = config;
        this.logger = config.logger ?? defaultLogger;
    }
    /**
     * Register with discovery-vessel and start the heartbeat timer.
     * Non-blocking: a registration failure is logged but does not throw.
     */
    async start() {
        await this.register();
        const intervalMs = this.config.heartbeatIntervalMs ?? 60_000;
        this.heartbeatTimer = setInterval(() => {
            void this.heartbeat();
        }, intervalMs);
    }
    /**
     * Send a DELETE to discovery-vessel and clear the heartbeat timer.
     * Called on SIGTERM / graceful shutdown.
     */
    async stop() {
        if (this.heartbeatTimer !== undefined) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
        await this.deregister();
    }
    /**
     * Register a callback that fires when three consecutive heartbeats fail.
     * The daemon can use this to mark itself unhealthy / restart.
     */
    onUnhealthy(callback) {
        this.unhealthyCallback = callback;
    }
    // ────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────────────
    registrationPayload() {
        // Advertised-endpoint contract: the registry stores what the vessel
        // advertises; the vessel advertises what its callers can reach.
        // Precedence: explicit VESSEL_ADVERTISE_ENDPOINT (per-vessel) >
        // SUBSTRATE_ADVERTISE_HOST (container-level, spoke joining a hub — the
        // host-published port follows the fleet's internal+offset convention,
        // default +10000, override via SUBSTRATE_ADVERTISE_PORT_OFFSET) >
        // loopback (same-container fleet, unchanged default).
        const advertised = process.env.VESSEL_ADVERTISE_ENDPOINT;
        const advertiseHost = process.env.SUBSTRATE_ADVERTISE_HOST;
        const portOffset = Number(process.env.SUBSTRATE_ADVERTISE_PORT_OFFSET ?? 10_000);
        const baseUrl = advertised && advertised.length > 0
            ? advertised.replace(/\/+$/, "")
            : advertiseHost && advertiseHost.length > 0
                ? `http://${advertiseHost}:${this.config.port + portOffset}`
                : `http://127.0.0.1:${this.config.port}`;
        // SC-P4 discovery-vessel contract: `endpoint` is the substrate-internal
        // URL; `public_endpoint` is an optional host/LAN-reachable URL for callers
        // OUTSIDE the container network. Advertised only when explicitly set.
        const publicEndpoint = process.env.VESSEL_PUBLIC_ENDPOINT;
        return {
            vesselId: this.config.vesselId,
            name: this.config.vesselName,
            endpoint: baseUrl,
            ...(publicEndpoint && publicEndpoint.length > 0
                ? { public_endpoint: publicEndpoint.replace(/\/+$/, "") }
                : {}),
            shapes: this.config.shapes,
            resolve_endpoint: this.config.resolveEndpoint,
            resolve_request_format: "pointer",
            auth_scheme: "ApiKey",
            resolve_timeout_ms: 10_000,
            port: this.config.port,
            ...(this.config.systemVessel ? { systemVessel: true } : {}),
        };
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `ApiKey ${this.config.apiKey}`,
        };
    }
    async register() {
        try {
            const res = await fetch(`${this.config.discoveryEndpoint}/register`, {
                method: "POST",
                headers: this.headers(),
                body: JSON.stringify(this.registrationPayload()),
                signal: AbortSignal.timeout(DISCOVERY_CALL_TIMEOUT_MS),
            });
            if (!res.ok) {
                this.logger.warn(`[DiscoveryRegistrationLoop] register failed: ${res.status} — vessel will be unreachable via discovery`);
            }
            else {
                this.failureCount = 0;
                this.logger.info(`[DiscoveryRegistrationLoop] registered ${this.config.vesselId} at ${this.config.discoveryEndpoint}`);
            }
        }
        catch (err) {
            this.logger.warn(`[DiscoveryRegistrationLoop] register error: ${err.message}`);
        }
    }
    async heartbeat() {
        try {
            const res = await fetch(`${this.config.discoveryEndpoint}/heartbeat`, {
                method: "POST",
                headers: this.headers(),
                body: JSON.stringify({ vesselId: this.config.vesselId }),
                signal: AbortSignal.timeout(DISCOVERY_CALL_TIMEOUT_MS),
            });
            if (res.ok) {
                this.failureCount = 0;
                return;
            }
            // A heartbeat 404 means discovery has no record of us (most likely
            // because discovery-vessel restarted and dropped its in-memory
            // registry). Re-register immediately — this is the structurally
            // correct response and prevents silent fleet-wide disappearance after
            // any discovery restart. Without this re-register, failureCount would
            // just climb until onUnhealthy fires, leaving the vessel unreachable
            // in the meantime. The register() call resets failureCount on success.
            if (res.status === 404) {
                this.logger.warn(`[DiscoveryRegistrationLoop] heartbeat 404 — discovery has no record; re-registering ${this.config.vesselId}`);
                await this.register();
                return;
            }
            this.failureCount += 1;
            this.logger.warn(`[DiscoveryRegistrationLoop] heartbeat HTTP ${res.status} (failure #${this.failureCount})`);
            if (this.failureCount >= 3) {
                void this.emitRegistrationHealth(res.status === 401 || res.status === 403 ? "auth_rejected" : "heartbeat_failing", `heartbeat HTTP ${res.status}`);
                if (this.unhealthyCallback)
                    this.unhealthyCallback();
            }
        }
        catch (err) {
            this.failureCount += 1;
            this.logger.warn(`[DiscoveryRegistrationLoop] heartbeat error: ${err.message} (failure #${this.failureCount})`);
            if (this.failureCount >= 3) {
                void this.emitRegistrationHealth("heartbeat_unreachable", err.message);
                if (this.unhealthyCallback)
                    this.unhealthyCallback();
            }
        }
    }
    /**
     * A VESSEL THAT CAN NEVER REGISTER IS ABSENT, NOT STALE — AND ABSENCE READS AS
     * "NOT DEPLOYED" RATHER THAN "BROKEN".
     *
     * Measured on a live substrate: discovery logged a steady 2 rejected heartbeats per
     * minute — 8,017 over a day — each `401 ... identity rejected the key`. Every vessel
     * that WAS registered looked perfect (all rows fresh under 60s), so no freshness check,
     * health probe or ActiveState check could see the ones that were not there. The only
     * record was a journal line, and a journal line is not an escalation.
     *
     * So say it in a shape. This mirrors the transport's emitJoinHealth, which exists for
     * exactly the same reason on the federation side, and it names the vesselId — the single
     * fact absence cannot carry.
     *
     * Fail-open and rate-limited: this runs inside the heartbeat loop, so it must never
     * throw, never block, and never turn a once-a-minute rejection into a once-a-minute
     * write. A repeated condition is reported on a cadence, not on every occurrence.
     */
    lastHealthEmitAt = 0;
    async emitRegistrationHealth(reason, detail) {
        const EMIT_EVERY_MS = 600_000;
        if (Date.now() - this.lastHealthEmitAt < EMIT_EVERY_MS)
            return;
        this.lastHealthEmitAt = Date.now();
        const api = (process.env.ACTIVITY_API_URL ?? process.env.ACTIVITY_API_ENDPOINT ?? "http://127.0.0.1:8080").replace(/\/$/, "");
        const key = process.env.METABOB_API_KEY ?? "";
        try {
            await fetch(`${api}/v2/impulses/resolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(key ? { Authorization: `ApiKey ${key}` } : {}) },
                body: JSON.stringify({
                    impulse: {
                        pointer: {
                            type: "registrationHealth_write",
                            vesselId: this.config.vesselId,
                            state: reason,
                            detail,
                            consecutive_failures: this.failureCount,
                            discovery_endpoint: this.config.discoveryEndpoint,
                            ts: Date.now(),
                        },
                    },
                }),
                signal: AbortSignal.timeout(5000),
            });
        }
        catch {
            // Deliberately silent: this is the REPORTING path, and a reporting failure must not
            // become a second fault in the loop it reports on.
        }
    }
    async deregister() {
        try {
            await fetch(`${this.config.discoveryEndpoint}/vessels/${this.config.vesselId}`, {
                method: "DELETE",
                headers: this.headers(),
                signal: AbortSignal.timeout(DISCOVERY_CALL_TIMEOUT_MS),
            });
            this.logger.info(`[DiscoveryRegistrationLoop] deregistered ${this.config.vesselId}`);
        }
        catch (err) {
            this.logger.warn(`[DiscoveryRegistrationLoop] deregister error: ${err.message}`);
        }
    }
}
//# sourceMappingURL=registration-loop.js.map