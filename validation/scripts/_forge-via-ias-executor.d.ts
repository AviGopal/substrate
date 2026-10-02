/**
 * _forge-via-ias-executor.ts
 *
 * Option C step 1 wrapper: drive the forge end-to-end via VesselForgeHost
 * (repos/ias-executor-ts) instead of shelling out to `minibob --single`.
 *
 * The first concrete demonstration that ias-executor-ts can drive the forge
 * pipeline without minibob — pivoting away from minibob-as-god-object toward
 * ias-executor-ts as the canonical executor (vessels = pure TS, activities =
 * structured middle ground, LLMs = used only where reasoning is unavoidable).
 *
 * Spec: openspec/changes/2026-04-26-impulse-activity-loop/design.md §Phase 22
 *
 * Output contract: the wrapper bookends a single JSON block with sentinel
 * markers so the parent runner (test-forge-goal-completion.ts) can grep it
 * out of stdout without parsing arbitrary forge logs.
 *
 *   ===== IAS_FORGE_RESULT =====
 *   {"ok": true, "traceId": "...", "vesselDeployed": {...}, ...}
 *   ===== END_IAS_FORGE_RESULT =====
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   METABOB_API_KEY=mb_... \
 *   TARGET_SHAPE=csv_dialect_detector \
 *   bun run validation/scripts/_forge-via-ias-executor.ts
 */
export interface ForgeGoalResult {
    ok: boolean;
    runtime: "ias-executor";
    traceId?: string;
    templateId?: string;
    status?: string;
    durationMs?: number;
    failureMode?: unknown;
    error?: string;
    vesselVerified?: {
        vesselId?: string | null;
        endpoint?: string | null;
        discovery?: unknown;
        observation?: unknown;
        auth?: unknown;
    } | null;
    vesselDeployed?: {
        imageTag?: string | null;
        endpoint?: string | null;
    } | null;
    subscriberFires?: Array<{
        templateId: string;
        eventType: string;
    }>;
    tasks?: Array<{
        taskId: string;
        success: boolean;
        resolverId: string;
        durationMs?: number;
        outputs: number;
    }>;
}
export interface ForgeGoalOptions {
    vesselGoal: string;
    targetShape?: string;
    anthropicApiKey?: string;
    metabobApiKey?: string;
    activityApiUrl?: string;
    discoveryUrl?: string;
    conceptDbUrl?: string;
    conceptDbKey?: string;
    deploymentWorkdir?: string;
    parentExecutionId?: string;
    parentDepth?: number;
}
/**
 * Drive the forge end-to-end via VesselForgeHost. Called directly by
 * test-forge-goal-completion.ts (task §4.2 — no subprocess spawn).
 * Also invoked by the `main()` entry point when this file is run standalone.
 */
export declare function runForgeGoalDirectly(opts: ForgeGoalOptions): Promise<ForgeGoalResult>;
//# sourceMappingURL=_forge-via-ias-executor.d.ts.map