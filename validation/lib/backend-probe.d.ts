/**
 * Post-run backend probe for Phase 14 (--with-backend mode).
 *
 * After a minibob run completes, this module:
 *   1. Extracts execution IDs from minibob's stdout log.
 *   2. Queries activity-api for each trace + its children.
 *   3. Snapshots impulse-relevance metrics before/after the run.
 *   4. Returns structured data that the orchestrator renders into report section 6.
 */
export interface TraceRecord {
    execution_id: string;
    activity_id: string;
    variant_id?: string;
    vessel_id?: string;
    vessel_version?: string;
    task_count: number;
    impulse_count: number;
    success?: boolean;
    status?: string;
    duration_ms?: number;
    cost_usd?: number;
    parent_execution_id?: string;
    children?: TraceRecord[];
}
export interface ImpulseResolutionRecord {
    impulse_id: string;
    resolver_id: string;
    resolver_tier?: string;
    vessel_id?: string;
    latency_ms?: number;
    cost_usd?: number;
}
export interface CrossVesselResolver {
    vessel_id: string;
    resolver_id: string;
    count: number;
}
export interface RelevanceSnapshot {
    total: number;
    byShape: Record<string, number>;
    sampleTimestamp: string;
}
export interface BackendProbeResult {
    /** All act_* IDs found in minibob stdout */
    executionIdsFound: string[];
    /** Execution tree rooted at the top-level activity (no parent) */
    executionTree: TraceRecord[];
    /** Activities fired as lifecycle hooks (slot-binding, validator-dispatch, etc.) */
    lifecycleActivities: Array<{
        activity_id: string;
        count: number;
    }>;
    /** Resolver tier breakdown across all traced tasks */
    resolverTiers: Record<string, number>;
    /** Vessels that appeared in traces */
    vesselIds: string[];
    /** Impulse relevance record counts before and after */
    relevanceBefore: RelevanceSnapshot;
    relevanceAfter: RelevanceSnapshot;
    /** Cross-vessel resolver usage: vessels other than the main minibob vessel */
    crossVesselUsage: Array<{
        vessel_id: string;
        activity_id: string;
    }>;
    /** Cross-vessel impulse resolution: resolver vessels from impulse_resolutions[] in fetched traces */
    crossVesselResolvers: CrossVesselResolver[];
    /** Whether we successfully fetched per-trace detail for impulse_resolution analysis */
    traceDetailFetched: boolean;
    /** Log-based detection: "[Impulse] Resolved via vessel discovery" lines from stdout */
    discoveryLogResolutions: Array<{
        shape: string;
        vessel: string;
    }>;
    /** Any errors encountered during probing */
    probeErrors: string[];
}
export declare function snapshotRelevanceBefore(endpoint: string, apiKey: string): Promise<RelevanceSnapshot>;
export declare function runBackendProbe(opts: {
    stdoutLogPath: string;
    metabobEndpoint: string;
    metabobApiKey: string;
    runStartTime: Date;
    /** Pre-run snapshot taken before the agent started; avoids before==after problem */
    relevanceBefore?: RelevanceSnapshot;
}): Promise<BackendProbeResult>;
export declare function renderBackendSection(probe: BackendProbeResult): string;
//# sourceMappingURL=backend-probe.d.ts.map