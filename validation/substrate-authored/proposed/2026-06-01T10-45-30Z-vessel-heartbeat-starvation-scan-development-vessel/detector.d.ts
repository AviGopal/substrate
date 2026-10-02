import type { ResolverResult } from "./types.js";
/**
 * vessel_heartbeat_starvation_scan — deterministic detector + emitter for
 * vessel discovery-heartbeat starvation class (concept_dD1udnb-sQnD /
 * concept_9ldsmRgqSTd5).
 *
 * The pattern: a vessel's DiscoveryRegistrationLoop is alive and running,
 * /health returns 200, but discovery-vessel returns 404 on heartbeat POST.
 * The vessel has a stale or evicted registry entry. Other vessels cannot
 * route to it through discovery, causing silent structuredError emissions
 * without operator visibility. Observed 2026-06-01: llm-resolver-vessel
 * accumulated 480 consecutive heartbeat failures over 8 hours undetected.
 *
 * Detection signature:
 *   - >= 30 consecutive DiscoveryRegistrationLoop failure lines within 10min
 *   - OR >= 100 within 60min (acute starvation window)
 *
 * Why one resolver does the whole flow (immunity pattern):
 *   1. Single-task seed template + single server-side resolver prevents F25
 *      multi-task abort cascade.
 *   2. inputShapes: [] and variables: [] — no pool deps, engine pre-flight
 *      cannot reject it (concept_pFSLV6s5s3lQ, concept_Y2zGpFNBrcgb).
 *   3. No iteration resolver chain, no llm_completion_dispatch. journalctl
 *      spawn + parse + post happen inside this function.
 *
 * Runs inside substrate-live as part of development-vessel. journalctl is
 * directly accessible because the vessel runs in the container.
 *
 * State: cache at ${WORKSPACE_ROOT}/.heartbeat-starvation-detector/state.json
 * mapping vessel unit → {lastScannedAt, failureCount, alreadyEmittedAt}.
 * Prevents re-emission within 1h window of prior gap POST.
 *
 * Constitutional principle: substrate_self_detection_recursive — every
 * operator-side audit (journalctl grep for heartbeat failures) becomes a
 * detector template, not a one-off patch (concept_9ldsmRgqSTd5).
 */
export interface VesselHeartbeatStarvationScanPointer {
    type: "vessel_heartbeat_starvation_scan";
    vessels?: string[];
    devVesselImpulsesUrl?: string;
    statePath?: string;
    dry_run?: boolean;
    maxEmits?: number;
    failureThreshold10min?: number;
    failureThreshold60min?: number;
    reemitWindowMinutes?: number;
}
export declare const DEFAULT_VESSELS: readonly ["goal-host-vessel", "development-vessel", "activity-api", "concept-db", "analysis-vessel", "llm-resolver-vessel", "discovery-vessel", "ribosome-vessel", "boredom-vessel", "identity-vessel"];
interface VesselState {
    lastScannedAt: string;
    failureCount: number;
    alreadyEmittedAt: string | null;
}
interface JournalFailureContext {
    count: number;
    window: string;
    oldestLineTime: string | null;
    newestLineTime: string | null;
}
interface ScanPorts {
    journalctlFailures: (unit: string) => Promise<JournalFailureContext | null>;
    readCache: (path: string) => Promise<Record<string, VesselState>>;
    writeCache: (path: string, data: Record<string, VesselState>) => Promise<void>;
    postGap: (url: string, body: unknown) => Promise<{
        ok: boolean;
        status: number | "error";
        error?: string;
    }>;
}
export declare function resolveVesselHeartbeatStarvationScan(pointer: VesselHeartbeatStarvationScanPointer, ports?: ScanPorts): Promise<ResolverResult>;
export {};
//# sourceMappingURL=detector.d.ts.map