"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runForgeGoalDirectly = runForgeGoalDirectly;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const vessel_forge_host_1 = require("../../repos/ias-executor-ts/src/examples/vessel-forge-host");
const bun_host_1 = require("../../repos/ias-executor-ts/src/examples/bun-host");
const lifecycle_subscriber_1 = require("../../repos/ias-executor-ts/src/lifecycle-subscriber");
const templates_1 = require("../../repos/ias-executor-ts/src/templates");
// ---------------------------------------------------------------------------
// TranslatingTraceSink — schema bridge from ias-executor-ts → activity-api
// ---------------------------------------------------------------------------
// activity-api's POST /v2/activities/execution-traces expects
// StoreExecutionTraceRequestSchema (see repos/metabob-activity-api/src/
// models/schemas.ts:StoreExecutionTraceRequestSchema): snake_case top-level
// keys (execution_id, template_id, duration_ms, cost_usd), status of
// "success" | "failure" | "partial", and execution_trace.tasks rows
// containing actualPrompt/response/inputState/outputState. ias-executor-ts's
// ExecutionTrace (ontology.ts:ExecutionTrace) is camelCase with status
// "completed" | "failed" and minimal task records (taskId, success,
// resolverId, durationMs, outputImpulseIds).
//
// Stock HttpTraceSink JSON.stringify's the trace verbatim — activity-api
// rejects with 400 ("Unrecognized key", "Required field missing").
// This sink defaults the minibob-shaped fields the ias-executor doesn't
// capture; activity-api keeps its strict schema; we get traces on canary.
class TranslatingTraceSink {
    endpoint;
    apiKey;
    constructor(endpoint, apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    async record(trace) {
        // 2026-05-20: send success boolean alongside enum status — the route's
        // success derivation (execution-traces.ts:1560) checks status==='completed'
        // OR success===true, but our schema-valid enum 'success' matches neither.
        // See repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts for
        // the canonical version of this bridge.
        const isSuccess = trace.status === "completed";
        const statusMap = {
            completed: "success",
            failed: "failure",
        };
        const body = {
            execution_id: trace.id,
            template_id: trace.templateId,
            status: statusMap[trace.status] ?? "partial",
            success: isSuccess,
            duration_ms: trace.durationMs ?? 0,
            cost_usd: trace.costUsd ?? 0,
            execution_trace: {
                tasks: trace.tasks.map((t) => ({
                    id: t.taskId,
                    description: t.description ?? t.taskId,
                    actualPrompt: t.actualPrompt ?? "",
                    toolCalls: [],
                    response: t.response ?? "",
                    result: {
                        status: t.success ? "success" : "failure",
                        error: t.error,
                        metadata: { resolver_id: t.resolverId, output_impulse_ids: t.outputImpulseIds },
                    },
                    inputState: {
                        filesAvailable: [],
                        environment: {},
                        impulses: t.inputImpulseIds ?? [],
                        variables: {},
                        git: { branch: "unknown", commit: "unknown", dirty: false },
                    },
                    outputState: {
                        filesModified: [],
                        filesCreated: [],
                        filesDeleted: [],
                    },
                })),
                impulsesCreated: trace.outputImpulseIds ?? [],
                filesModified: [],
            },
            parent_execution_id: trace.parentExecutionId,
            composition_chain: trace.compositionChain,
            failure_mode: trace.failureMode,
        };
        try {
            const res = await fetch(`${this.endpoint}/v2/activities/execution-traces`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `ApiKey ${this.apiKey}`,
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.warn(`[TranslatingTraceSink] ${res.status} recording trace ${trace.id}: ${text.slice(0, 200)}`);
            }
        }
        catch (err) {
            console.warn(`[TranslatingTraceSink] network error recording trace ${trace.id}: ${err.message}`);
        }
    }
}
// ---------------------------------------------------------------------------
// Environment / configuration
// ---------------------------------------------------------------------------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const METABOB_API_KEY = process.env.METABOB_API_KEY ?? "";
const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL ?? "https://activity.metabob.com";
const DISCOVERY_URL = process.env.DISCOVERY_URL ?? "https://discovery.metabob.com";
// CONCEPT_DB_URL: forge resolvers query this for vessel-construction concepts.
// Default to canary concept-db; CONCEPT_DB_KEY is optional (best-effort).
const CONCEPT_DB_URL = process.env.CONCEPT_DB_URL ?? "https://concept.metabob.com";
const CONCEPT_DB_KEY = process.env.CONCEPT_DB_KEY ?? "";
const TARGET_SHAPE = process.env.TARGET_SHAPE ?? "csv_dialect_detector";
const VESSEL_GOAL = process.env.VESSEL_GOAL
    ?? `A vessel that produces impulses of shape '${TARGET_SHAPE}' on demand, with structured input/output schemas and authentication via identity-vessel JWT.`;
const DEPLOYMENT_WORKDIR = process.env.DEPLOYMENT_WORKDIR
    ?? "/home/avi/documents/work/exp-repo/metabob-devbob";
const PARENT_EXECUTION_ID = process.env.PARENT_EXECUTION_ID ?? "";
const PARENT_DEPTH = Number(process.env.PARENT_DEPTH ?? "0");
// ---------------------------------------------------------------------------
// Anthropic LLMPort (mirrors validation/scripts/test-22-forge-and-paths.ts:41-79)
// ---------------------------------------------------------------------------
class AnthropicLLMPort {
    // claude-haiku for cost; forge resolvers don't need top-tier reasoning per
    // §Phase 22 — LLMs are scoped to spec composition + scaffold, not control flow.
    model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
    async generate(input) {
        if (!ANTHROPIC_API_KEY)
            throw new Error("ANTHROPIC_API_KEY not set");
        const body = {
            model: this.model,
            max_tokens: 4096,
            messages: [{ role: "user", content: input.prompt }],
        };
        if (input.systemPrompt)
            body.system = input.systemPrompt;
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 400)}`);
        }
        const data = (await res.json());
        return data.content.find((c) => c.type === "text")?.text ?? "";
    }
}
// ---------------------------------------------------------------------------
// Forge template loader (canonical path: deployment-synced minibob templates)
// ---------------------------------------------------------------------------
function loadForgeTemplate() {
    const __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
    const __dirname = (0, node_path_1.dirname)(__filename);
    // 2026-05-20: forge template now lives in the ias-executor-ts shared
    // template catalogue (canonical-host §2). The deployment-vessels copy
    // is stale (submodule pointer drift). This is the canonical source.
    const templatePath = (0, node_path_1.resolve)(__dirname, "..", "..", "repos", "ias-executor-ts", "src", "templates", "forge", "forge-vessel-for-shape.json");
    const raw = (0, node_fs_1.readFileSync)(templatePath, "utf8");
    return JSON.parse(raw);
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findImpulseByShape(trace, host, shape) {
    for (const task of trace.tasks) {
        for (const id of task.outputImpulseIds) {
            const impulse = host.runtime.store.get(id);
            if (impulse && (impulse.metadata.shape ?? impulse.pointer.type) === shape) {
                return impulse;
            }
        }
    }
    for (const id of trace.outputImpulseIds) {
        const impulse = host.runtime.store.get(id);
        if (impulse && (impulse.metadata.shape ?? impulse.pointer.type) === shape) {
            return impulse;
        }
    }
    return undefined;
}
/**
 * Drive the forge end-to-end via VesselForgeHost. Called directly by
 * test-forge-goal-completion.ts (task §4.2 — no subprocess spawn).
 * Also invoked by the `main()` entry point when this file is run standalone.
 */
async function runForgeGoalDirectly(opts) {
    const apiKey = opts.anthropicApiKey ?? ANTHROPIC_API_KEY;
    const metabobKey = opts.metabobApiKey ?? METABOB_API_KEY;
    const activityApiUrl = opts.activityApiUrl ?? ACTIVITY_API_URL;
    const discoveryUrl = opts.discoveryUrl ?? DISCOVERY_URL;
    const conceptDbUrl = opts.conceptDbUrl ?? CONCEPT_DB_URL;
    const conceptDbKey = opts.conceptDbKey ?? CONCEPT_DB_KEY;
    const deploymentWorkdir = opts.deploymentWorkdir ?? DEPLOYMENT_WORKDIR;
    const parentExecutionId = opts.parentExecutionId ?? PARENT_EXECUTION_ID;
    const parentDepth = opts.parentDepth ?? PARENT_DEPTH;
    const targetShape = opts.targetShape ?? TARGET_SHAPE;
    const vesselGoal = opts.vesselGoal;
    if (!apiKey)
        return { ok: false, runtime: "ias-executor", error: "ANTHROPIC_API_KEY not set" };
    if (!metabobKey)
        return { ok: false, runtime: "ias-executor", error: "METABOB_API_KEY not set" };
    console.log(`[ias-forge] target_shape    = ${targetShape}`);
    console.log(`[ias-forge] vessel_goal     = ${vesselGoal.slice(0, 120)}${vesselGoal.length > 120 ? "..." : ""}`);
    console.log(`[ias-forge] activity_api    = ${activityApiUrl}`);
    console.log(`[ias-forge] discovery_url   = ${discoveryUrl}`);
    console.log(`[ias-forge] concept_db_url  = ${conceptDbUrl}`);
    console.log(`[ias-forge] parent_depth    = ${parentDepth}`);
    const llm = new AnthropicLLMPort();
    const traceSink = new TranslatingTraceSink(activityApiUrl, metabobKey);
    const consoleSink = new bun_host_1.ConsoleEventSink();
    const subscriberFires = [];
    const subscriber = new lifecycle_subscriber_1.LifecycleSubscriberVessel({
        dispatcher: (template, event) => {
            subscriberFires.push({ templateId: template.id, eventType: event.type });
            console.log(`[subscriber] ${template.id} fired on ${event.type}`);
        },
        downstreamSink: consoleSink,
        logger: { warn: (m) => console.warn(`[subscriber] ${m}`), debug: () => { } },
    });
    for (const t of (0, templates_1.loadSubscriberTemplates)()) {
        subscriber.register(t);
    }
    console.log(`[ias-forge] subscribers     = ${(0, templates_1.loadSubscriberTemplates)().length} registered`);
    const host = new vessel_forge_host_1.VesselForgeHost({
        llm,
        discoveryEndpoint: discoveryUrl,
        eventSink: subscriber,
        traceSink,
    });
    const template = loadForgeTemplate();
    console.log(`[ias-forge] template        = ${template.id} v${template.version ?? "?"}`);
    const conceptDbEndpoint = conceptDbKey
        ? `${conceptDbUrl}?apiKey=${conceptDbKey}`
        : conceptDbUrl;
    const t0 = Date.now();
    let trace;
    try {
        trace = await host.execute(template, {
            variables: {
                vesselGoal,
                missingShape: targetShape,
                parentExecutionId,
                parentDepth,
                conceptDbEndpoint,
                deploymentWorkdir,
            },
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[ias-forge] EXCEPTION: ${msg}`);
        return {
            ok: false,
            runtime: "ias-executor",
            error: msg,
            durationMs: Date.now() - t0,
        };
    }
    const durationMs = Date.now() - t0;
    const vesselVerified = findImpulseByShape(trace, host, "vesselVerified");
    const vesselDeployed = findImpulseByShape(trace, host, "vesselDeployedToCanary");
    const success = trace.status === "completed" && vesselVerified != null;
    const verifiedContent = (vesselVerified?.content ?? null);
    const deployedContent = (vesselDeployed?.content ?? null);
    return {
        ok: success,
        runtime: "ias-executor",
        traceId: trace.id,
        templateId: trace.templateId,
        status: trace.status,
        durationMs,
        failureMode: trace.failureMode ?? null,
        vesselVerified: verifiedContent
            ? {
                vesselId: verifiedContent.vessel_id ?? verifiedContent.vesselId ?? null,
                endpoint: verifiedContent.endpoint ?? null,
                discovery: verifiedContent.discovery ?? null,
                observation: verifiedContent.observation ?? null,
                auth: verifiedContent.auth ?? null,
            }
            : null,
        vesselDeployed: deployedContent
            ? {
                imageTag: deployedContent.imageTag ?? deployedContent.image_tag ?? null,
                endpoint: deployedContent.endpoint ?? null,
            }
            : null,
        subscriberFires,
        tasks: trace.tasks.map((t) => ({
            taskId: t.taskId,
            success: t.success,
            resolverId: t.resolverId,
            durationMs: t.durationMs,
            outputs: t.outputImpulseIds.length,
        })),
    };
}
function emitResult(payload) {
    // Sentinel bookends — parent runner greps between them. Keep on their own lines.
    console.log("===== IAS_FORGE_RESULT =====");
    console.log(JSON.stringify(payload));
    console.log("===== END_IAS_FORGE_RESULT =====");
}
// ---------------------------------------------------------------------------
// Main (standalone entry point — emits sentinel JSON for subprocess callers)
// ---------------------------------------------------------------------------
async function main() {
    const result = await runForgeGoalDirectly({ vesselGoal: VESSEL_GOAL });
    emitResult(result);
    if (result.error === "ANTHROPIC_API_KEY not set" || result.error === "METABOB_API_KEY not set") {
        return 2;
    }
    return result.ok ? 0 : 1;
}
// Guard: only run when invoked directly (not when imported as a library).
// import.meta.main is true only when Bun executes this file as the entry point.
if (import.meta.main) {
    main()
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error("[ias-forge] FATAL:", err);
        emitResult({
            ok: false,
            runtime: "ias-executor",
            error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
    });
}
//# sourceMappingURL=_forge-via-ias-executor.js.map