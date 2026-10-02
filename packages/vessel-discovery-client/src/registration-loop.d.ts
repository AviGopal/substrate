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
import type { Logger } from "./types.js";
export interface DiscoveryRegistrationLoopConfig {
    discoveryEndpoint: string;
    vesselId: string;
    vesselName: string;
    /** Advertised shapes — forwarded as-is to /register */
    shapes: string[];
    /** Full URL of this vessel's /resolve endpoint, e.g. http://localhost:8230/resolve */
    resolveEndpoint: string;
    /** API key for discovery-vessel auth (Authorization: ApiKey <key>) */
    apiKey: string;
    /** Port this vessel listens on — included in registration metadata */
    port: number;
    /** Heartbeat interval in ms. Default 60_000. */
    heartbeatIntervalMs?: number;
    /**
     * Mark this vessel as a system-level vessel (not tenant-scoped).
     * Required for substrate services so they appear in all org-scoped discovery
     * queries. Vessels without orgId AND without systemVessel=true are invisible.
     */
    systemVessel?: boolean;
    /** Logger instance (default: console-backed, debug suppressed) */
    logger?: Logger;
}
export declare class DiscoveryRegistrationLoop {
    private readonly config;
    private heartbeatTimer?;
    private failureCount;
    private unhealthyCallback?;
    private readonly logger;
    constructor(config: DiscoveryRegistrationLoopConfig);
    /**
     * Register with discovery-vessel and start the heartbeat timer.
     * Non-blocking: a registration failure is logged but does not throw.
     */
    start(): Promise<void>;
    /**
     * Send a DELETE to discovery-vessel and clear the heartbeat timer.
     * Called on SIGTERM / graceful shutdown.
     */
    stop(): Promise<void>;
    /**
     * Register a callback that fires when three consecutive heartbeats fail.
     * The daemon can use this to mark itself unhealthy / restart.
     */
    onUnhealthy(callback: () => void): void;
    private registrationPayload;
    private headers;
    private register;
    private heartbeat;
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
    private lastHealthEmitAt;
    private emitRegistrationHealth;
    private deregister;
}
//# sourceMappingURL=registration-loop.d.ts.map