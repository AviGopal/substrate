"use strict";
/**
 * forge-goal-completion test
 *
 * End-to-end test that exercises the vessel-forge pipeline as a CONSEQUENCE
 * of slot-binding escalation triggered by a real user-level goal. Distinct
 * from validation/scripts/test-22-forge-and-paths.ts which calls
 * VesselForgeHost directly.
 *
 * Spec: openspec/changes/2026-05-18-forge-goal-completion-test/
 *   - proposal.md
 *   - design.md (assertion tables §c, §d; witness defs §g)
 *   - specs/forge-goal-completion-test/spec.md (R1..R8)
 *   - tasks.md (T1..T6)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   METABOB_API_KEY=mb_... \
 *   ACTIVITY_API_URL=https://activity.metabob.com \
 *   DISCOVERY_URL=https://discovery.metabob.com \
 *   TARGET_SHAPE=webhook_signature_verifier \
 *   VARIANT=single-step-depth-0 \
 *   bun run validation/scripts/test-forge-goal-completion.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const _forge_via_ias_executor_1 = require("./_forge-via-ias-executor");
// ---------------------------------------------------------------------------
// Environment / configuration (matches test-22-forge-and-paths.ts env pattern)
// ---------------------------------------------------------------------------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const METABOB_API_KEY = process.env.METABOB_API_KEY ?? "";
const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL ?? "https://activity.metabob.com";
const DISCOVERY_URL = process.env.DISCOVERY_URL ?? "https://discovery.metabob.com";
// Per design.md §a: target shape rotated per week. Runner accepts override via
// env so run-weekly-harness.sh can pick the row for date +%V.
const CANDIDATE_SHAPES = [
    "webhook_signature_verifier",
    "pdf_text_extractor",
    "csv_dialect_detector",
];
const TARGET_SHAPE = process.env.TARGET_SHAPE || CANDIDATE_SHAPES[0];
const VARIANT = process.env.VARIANT || "single-step-depth-0";
const COMPLEXITY = VARIANT.startsWith("two-step") ? "two-step" : "single-step";
const DEPTH = VARIANT.endsWith("depth-1") ? 1 : 0;
// MINIBOB_BIN: caller can override; default to the `minibob` shim on PATH.
// Per design.md §c the runner shells out exactly as a user would.
const MINIBOB_BIN = process.env.MINIBOB_BIN ?? "minibob";
const FORGE_RUNTIME = process.env.FORGE_RUNTIME || "ias-executor";
const RUN_ID = `fgc-${Date.now()}`;
const TEST_ID = "forge-goal-completion";
// ---------------------------------------------------------------------------
// Sanity checks
// ---------------------------------------------------------------------------
function requireEnv() {
    const missing = [];
    if (!ANTHROPIC_API_KEY)
        missing.push("ANTHROPIC_API_KEY");
    if (!METABOB_API_KEY)
        missing.push("METABOB_API_KEY");
    if (missing.length > 0) {
        console.error(`FATAL: missing required env vars: ${missing.join(", ")}`);
        process.exit(2);
    }
    if (!CANDIDATE_SHAPES.includes(TARGET_SHAPE)) {
        console.error(`FATAL: TARGET_SHAPE=${TARGET_SHAPE} not in candidate list ${CANDIDATE_SHAPES.join(", ")}`);
        process.exit(2);
    }
}
// ---------------------------------------------------------------------------
// Prompt loading + variant substitution (spec R8, T2.x)
// ---------------------------------------------------------------------------
function loadGoalText() {
    const __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
    const __dirname = (0, node_path_1.dirname)(__filename);
    const promptPath = (0, node_path_1.resolve)(__dirname, "..", "prompts", "40-forge-required-shape.md");
    const raw = (0, node_fs_1.readFileSync)(promptPath, "utf8");
    // Each variant header is `## Variant: <name> ...`. The runner matches by
    // variant key → canonical header label and slices to the next `## ` block.
    const variantLabels = {
        "single-step-depth-0": "## Variant: single-step, depth-0",
        "two-step-depth-0": "## Variant: two-step, depth-0",
        "single-step-depth-1": "## Variant: single-step, depth-1",
        "two-step-depth-1": "## Variant: two-step, depth-1",
    };
    const header = variantLabels[VARIANT];
    // Match the header line at the start of a line; tolerate trailing decorators
    // like "(default)" after the canonical label.
    const headerRe = new RegExp(`(^|\\n)${header.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[^\\n]*\\n`);
    const m = raw.match(headerRe);
    if (!m || m.index == null)
        throw new Error(`prompt 40 missing variant section: ${header}`);
    const start = m.index + m[0].length;
    const rest = raw.slice(start);
    const nextSection = rest.search(/\n## /);
    const body = (nextSection >= 0 ? rest.slice(0, nextSection) : rest).trim();
    // Substitute the {{target_shape}} placeholder
    return body.replace(/\{\{target_shape\}\}/g, TARGET_SHAPE);
}
// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function activityApiPOST(path, body) {
    return fetch(`${ACTIVITY_API_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `ApiKey ${METABOB_API_KEY}`,
        },
        body: JSON.stringify(body),
    });
}
async function resolveImpulse(pointer) {
    const res = await activityApiPOST("/v2/impulses/resolve", { pointer });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`impulses/resolve ${pointer.type} → ${res.status}: ${txt.slice(0, 200)}`);
    }
    return await res.json();
}
async function probeDiscovery(shape, phase) {
    // 2026-05-20 fix: discovery /resolve with vesselCapability pointer expects
    // `pointer.shape: <name>` (inside the pointer object), NOT `shapes: [...]`
    // at the top level. Earlier the shape went outside pointer and discovery
    // ignored it, returning 0 vessels — which masked the fact that the forge
    // WAS registering vessels successfully. Vessel records use `vesselId`
    // (not `id`) per discovery-vessel/src/types.ts:345.
    const res = await fetch(`${DISCOVERY_URL}/resolve`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `ApiKey ${METABOB_API_KEY}`,
        },
        body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
    }).catch(() => null);
    const ts = new Date().toISOString();
    if (!res || !res.ok) {
        // Treat probe failure as count=0 with the failure surfaced via the probe
        // record (auditable). The audit loop can flag a probe that never reaches
        // discovery.
        return { type: "discovery_registration_probe", phase, shape, count: 0, vessel_ids: [], ts };
    }
    const data = (await res.json());
    const vessels = (data?.content?.vessels ?? data?.vessels ?? []);
    return {
        type: "discovery_registration_probe",
        phase,
        shape,
        count: vessels.length,
        vessel_ids: vessels.map((v) => v.vesselId ?? v.id).filter((id) => typeof id === "string"),
        ts,
    };
}
async function runMinibobSingle(goal) {
    const start = Date.now();
    return new Promise((resolve) => {
        // Env: MINIBOB_SKIP_STARTUP is the same flag any Docker/CI --single run
        // sets per repos/minibob/CLAUDE.md. It is NOT test-specific (spec R8).
        const env = {
            ...process.env,
            ANTHROPIC_API_KEY,
            METABOB_API_KEY,
            METABOB_ENDPOINT: ACTIVITY_API_URL,
            MINIBOB_SKIP_STARTUP: "true",
        };
        const child = (0, node_child_process_1.spawn)(MINIBOB_BIN, ["--single", goal], { env });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => {
            stdout += d.toString();
        });
        child.stderr.on("data", (d) => {
            stderr += d.toString();
        });
        child.on("close", (code) => {
            // Look for an execution id printed by minibob. The CLI emits it in
            // various forms; design.md §c says "if surface changes the runner falls
            // back to the most recent root execution". We try several patterns.
            const idPatterns = [
                /executionId[:\s]+([a-f0-9-]{8,})/i,
                /execution[_-]id[:\s"]+([a-f0-9-]{8,})/i,
                /"executionId"\s*:\s*"([^"]+)"/,
                /\bexec[_-]?id[:\s"]+([a-f0-9-]{8,})/i,
            ];
            let executionId = null;
            const combined = `${stdout}\n${stderr}`;
            for (const re of idPatterns) {
                const m = combined.match(re);
                if (m && m[1]) {
                    executionId = m[1];
                    break;
                }
            }
            resolve({
                executionId,
                stdout,
                stderr,
                exitCode: code ?? -1,
                duration_ms: Date.now() - start,
            });
        });
        child.on("error", (err) => {
            stderr += `\nspawn error: ${err.message}`;
            resolve({
                executionId: null,
                stdout,
                stderr,
                exitCode: -1,
                duration_ms: Date.now() - start,
            });
        });
    });
}
function parseIasForgeResult(stdout) {
    const start = stdout.lastIndexOf("===== IAS_FORGE_RESULT =====");
    const end = stdout.lastIndexOf("===== END_IAS_FORGE_RESULT =====");
    if (start < 0 || end < 0 || end <= start)
        return null;
    const body = stdout
        .slice(start + "===== IAS_FORGE_RESULT =====".length, end)
        .trim();
    try {
        return JSON.parse(body);
    }
    catch {
        return null;
    }
}
async function runForgeViaIasExecutor(goal) {
    const start = Date.now();
    return new Promise((resolveFn) => {
        const env = {
            ...process.env,
            ANTHROPIC_API_KEY,
            METABOB_API_KEY,
            ACTIVITY_API_URL,
            DISCOVERY_URL,
            TARGET_SHAPE,
            VESSEL_GOAL: goal,
        };
        const __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
        const __dirname = (0, node_path_1.dirname)(__filename);
        const wrapperPath = (0, node_path_1.resolve)(__dirname, "_forge-via-ias-executor.ts");
        const child = (0, node_child_process_1.spawn)("bun", ["run", wrapperPath], { env });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => {
            const s = d.toString();
            stdout += s;
            // Mirror to our stdout so the operator sees forge progress live.
            process.stdout.write(s);
        });
        child.stderr.on("data", (d) => {
            const s = d.toString();
            stderr += s;
            process.stderr.write(s);
        });
        child.on("close", (code) => {
            const ias = parseIasForgeResult(stdout) ?? undefined;
            resolveFn({
                executionId: ias?.traceId ?? null,
                stdout,
                stderr,
                exitCode: code ?? -1,
                duration_ms: Date.now() - start,
                iasResult: ias,
            });
        });
        child.on("error", (err) => {
            stderr += `\nspawn error: ${err.message}`;
            resolveFn({
                executionId: null,
                stdout,
                stderr,
                exitCode: -1,
                duration_ms: Date.now() - start,
            });
        });
    });
}
/** Direct in-process forge call (task §4.2). No subprocess spawn. */
async function runForgeDirectly(goal) {
    const start = Date.now();
    const result = await (0, _forge_via_ias_executor_1.runForgeGoalDirectly)({
        vesselGoal: goal,
        targetShape: TARGET_SHAPE,
        anthropicApiKey: ANTHROPIC_API_KEY,
        metabobApiKey: METABOB_API_KEY,
        activityApiUrl: ACTIVITY_API_URL,
        discoveryUrl: DISCOVERY_URL,
    });
    return {
        executionId: result.traceId ?? null,
        stdout: "",
        stderr: result.error ?? "",
        exitCode: result.ok ? 0 : 1,
        duration_ms: result.durationMs ?? (Date.now() - start),
        iasResult: result,
    };
}
async function runForge(goal) {
    // Switch on FORGE_RUNTIME. All paths return the same MinibobRun shape so
    // the rest of pass1/pass2 (trace lookup, assertions) doesn't fork.
    if (FORGE_RUNTIME === "ias-executor") {
        // Direct in-process call — no subprocess (task §4.2).
        return runForgeDirectly(goal);
    }
    if (FORGE_RUNTIME === "ias-executor-subprocess") {
        // Legacy subprocess path — kept for parity comparisons.
        return runForgeViaIasExecutor(goal);
    }
    return runMinibobSingle(goal);
}
async function fetchTraceTree(rootExecutionId, since) {
    // The activity-api's executionTraceWithSignatures filter does not accept a
    // single execution_id (see repos/metabob-activity-api/src/routes/execution-trace-with-signatures.ts:140).
    // Fetch traces since the run started and filter client-side for the root
    // execution + its composition_chain descendants.
    const resp = await resolveImpulse({
        type: "executionTraceWithSignatures",
        since,
        limit: 500,
    });
    const content = typeof resp.content === "string" ? JSON.parse(resp.content) : resp.content;
    const report = content;
    const tree = [];
    // Build a graph of all rows by id for descendant walk.
    const byId = new Map();
    for (const t of report.traces ?? [])
        byId.set(t.execution_id, t);
    const root = byId.get(rootExecutionId);
    if (root)
        tree.push(root);
    // Descendants: any trace whose composition_chain includes the root id,
    // OR whose parent_execution_id is in our growing tree.
    const known = new Set([rootExecutionId]);
    let added = true;
    while (added) {
        added = false;
        for (const t of report.traces ?? []) {
            if (known.has(t.execution_id))
                continue;
            const parent = t.parent_execution_id ?? null;
            const chain = t.composition_chain ?? [];
            if ((parent && known.has(parent)) || chain.includes(rootExecutionId)) {
                tree.push(t);
                known.add(t.execution_id);
                added = true;
            }
        }
    }
    return tree;
}
function findInChain(tree, templateId) {
    for (const t of tree) {
        if (t.activity_id === templateId)
            return t;
        if ((t.composition_chain ?? []).includes(templateId))
            return t;
    }
    return undefined;
}
function findChildByTemplate(tree, templateId, parentId) {
    for (const t of tree) {
        if (t.activity_id !== templateId)
            continue;
        if (!parentId)
            return t;
        if (t.parent_execution_id === parentId)
            return t;
        if ((t.composition_chain ?? []).includes(parentId))
            return t;
    }
    return undefined;
}
function findTaskInTrace(trace, taskId) {
    return trace.tasks.find((t) => t.task_id === taskId);
}
async function fetchImpulseBody(impulseId) {
    // Best-effort fetch: activity-api may resolve a raw impulse by id via the
    // generic resolve endpoint. Failure is non-fatal — the test just records
    // {} and the assertion records inspected_field=null.
    try {
        const resp = await resolveImpulse({ type: "impulse", id: impulseId });
        const c = typeof resp.content === "string" ? JSON.parse(resp.content) : resp.content;
        return c;
    }
    catch {
        return null;
    }
}
async function findImpulseByShape(trace, shape) {
    // Walk task outputs + trace-level outputs for an impulse whose signature
    // matches the shape. Body is fetched on demand.
    const candidates = [];
    for (const t of trace.tasks)
        candidates.push(...t.output_impulse_ids);
    candidates.push(...(trace.output_impulses ?? []));
    for (const id of candidates) {
        const sig = trace.impulses_by_id?.[id];
        if (sig && (sig.shape === shape || sig.pointer_type === shape)) {
            const body = await fetchImpulseBody(id);
            return { id, body };
        }
    }
    return null;
}
function computeTraceSignature(tree) {
    // design.md §g: SHA-256 of impulse signatures, root-first, no body content.
    const sigParts = [];
    for (const t of tree) {
        for (const [id, sig] of Object.entries(t.impulses_by_id ?? {})) {
            sigParts.push(`${id}|${sig.pointer_type ?? ""}|${sig.shape ?? ""}`);
        }
    }
    sigParts.sort();
    return (0, node_crypto_1.createHash)("sha256").update(sigParts.join("\n")).digest("hex");
}
async function assertPass1(tree, rootExecId) {
    const root = tree.find((t) => t.execution_id === rootExecId);
    const assertions = [];
    // C1 — slot-binding ran as a hook
    const slotBindingNode = findInChain(tree, "slot-binding")
        ?? tree.find((t) => t.activity_id === "slot-binding" || t.activity_id?.includes("slot-binding"));
    assertions.push({
        id: "C1",
        passed: !!slotBindingNode,
        inspected_field: slotBindingNode ? `composition_chain entry template_id=slot-binding (exec=${slotBindingNode.execution_id})` : "composition_chain[]",
        detail: slotBindingNode ? "slot-binding present" : "no slot-binding entry found",
    });
    // C2 — discovery producer check ran with count=0
    let inventoryBody = null;
    if (slotBindingNode) {
        const inv = await findImpulseByShape(slotBindingNode, "shape_producer_inventory");
        inventoryBody = inv?.body;
    }
    // Body may be {count: N} JSON or wrapped {content: "{...}"}.
    let inventoryCount = null;
    try {
        const b = typeof inventoryBody === "string" ? JSON.parse(inventoryBody) : inventoryBody;
        if (b && typeof b === "object") {
            inventoryCount = typeof b.count === "number" ? b.count
                : typeof b?.content === "string" ? JSON.parse(b.content)?.count ?? null
                    : null;
        }
    }
    catch { /* leave null */ }
    assertions.push({
        id: "C2",
        passed: inventoryCount === 0,
        inspected_field: `shape_producer_inventory.count = ${inventoryCount}`,
        detail: inventoryCount === 0 ? "count=0 as required" : "count != 0 or missing impulse",
    });
    // C3 — forge_missing_shape fired
    let forgeTask;
    if (slotBindingNode)
        forgeTask = findTaskInTrace(slotBindingNode, "forge_missing_shape");
    const c3Pass = !!forgeTask && (forgeTask.status === "completed" || forgeTask.status === "success")
        && forgeTask.output_impulse_ids.length > 0;
    assertions.push({
        id: "C3",
        passed: c3Pass,
        inspected_field: `task forge_missing_shape status=${forgeTask?.status ?? "absent"} outputs=${forgeTask?.output_impulse_ids.length ?? 0}`,
    });
    // C4 — escalate_unbindable did NOT fire (skipped or absent)
    let escalateTask;
    if (slotBindingNode)
        escalateTask = findTaskInTrace(slotBindingNode, "escalate_unbindable");
    const c4Pass = !escalateTask || escalateTask.status == null || escalateTask.status === "skipped";
    assertions.push({
        id: "C4",
        passed: c4Pass,
        inspected_field: `task escalate_unbindable status=${escalateTask?.status ?? "absent"}`,
    });
    // C5 — forge-vessel-for-shape dispatched
    const forgeChild = findChildByTemplate(tree, "forge-vessel-for-shape", slotBindingNode?.execution_id);
    assertions.push({
        id: "C5",
        passed: !!forgeChild,
        inspected_field: forgeChild
            ? `forge-vessel-for-shape exec=${forgeChild.execution_id} parent=${forgeChild.parent_execution_id}`
            : "no forge-vessel-for-shape entry in composition_chain",
    });
    // C6 — verify_three_invariants produced vesselVerified
    let vesselVerifiedBody = null;
    let forgedVesselId;
    if (forgeChild) {
        const vv = await findImpulseByShape(forgeChild, "vesselVerified");
        vesselVerifiedBody = vv?.body;
        try {
            const b = typeof vesselVerifiedBody === "string" ? JSON.parse(vesselVerifiedBody) : vesselVerifiedBody;
            const inner = b?.content && typeof b.content === "string" ? JSON.parse(b.content) : b;
            const ok = inner?.discovery === "ok" && inner?.observation === "ok" && inner?.auth === "ok";
            forgedVesselId = inner?.vessel_id ?? inner?.vesselId;
            assertions.push({
                id: "C6",
                passed: !!ok,
                inspected_field: `vesselVerified discovery=${inner?.discovery} observation=${inner?.observation} auth=${inner?.auth} vessel_id=${forgedVesselId}`,
            });
        }
        catch (e) {
            assertions.push({ id: "C6", passed: false, inspected_field: `vesselVerified parse error: ${e.message}` });
        }
    }
    else {
        assertions.push({ id: "C6", passed: false, inspected_field: "no forge child to inspect" });
    }
    // C7 — downstream task bound to forged vessel
    // Find any task in the root execution whose input impulse has shape=TARGET_SHAPE,
    // then check its impulse_resolutions entry for vessel_id.
    let downstreamBindingVesselId;
    if (root) {
        for (const task of root.tasks) {
            for (const inputId of task.input_impulse_ids) {
                const sig = root.impulses_by_id?.[inputId];
                if (sig?.shape === TARGET_SHAPE || sig?.pointer_type === TARGET_SHAPE) {
                    // Find the matching impulse_resolutions entry
                    const res = (root.impulse_resolutions ?? []).find((r) => r.impulse_id === inputId);
                    if (res?.vessel_id) {
                        downstreamBindingVesselId = res.vessel_id;
                        break;
                    }
                }
            }
            if (downstreamBindingVesselId)
                break;
        }
    }
    const c7Pass = !!(downstreamBindingVesselId && forgedVesselId && downstreamBindingVesselId === forgedVesselId);
    assertions.push({
        id: "C7",
        passed: c7Pass,
        inspected_field: `downstream vessel_id=${downstreamBindingVesselId ?? "absent"} forged=${forgedVesselId ?? "absent"}`,
    });
    // C8 — goal-verifier validation_result
    let goalVerifierConfidence;
    let c8Pass = false;
    if (root) {
        const vr = await findImpulseByShape(root, "validation_result");
        try {
            const raw = vr?.body;
            const b = typeof raw === "string" ? JSON.parse(raw) : raw;
            const inner = b?.content && typeof b.content === "string" ? JSON.parse(b.content) : b;
            const passed = inner?.passed === true;
            const validatorId = inner?.validator_id ?? inner?.validatorId ?? "";
            goalVerifierConfidence = typeof inner?.confidence === "number" ? inner.confidence : undefined;
            c8Pass = passed && /goal-verifier/i.test(String(validatorId));
            assertions.push({
                id: "C8",
                passed: c8Pass,
                inspected_field: `validation_result passed=${passed} validator_id=${validatorId} confidence=${goalVerifierConfidence}`,
            });
        }
        catch (e) {
            assertions.push({ id: "C8", passed: false, inspected_field: `validation_result parse error: ${e.message}` });
        }
    }
    else {
        assertions.push({ id: "C8", passed: false, inspected_field: "root execution not found" });
    }
    return {
        label: "pass1",
        executionId: rootExecId,
        assertions,
        passed: assertions.every((a) => a.passed),
        forgedVesselId,
        downstreamBindingVesselId,
        goalVerifierConfidence,
        traceSignature: computeTraceSignature(tree),
    };
}
// ---------------------------------------------------------------------------
// Pass 2 assertions (design.md §d, D1..D4)
// ---------------------------------------------------------------------------
async function assertPass2(tree, rootExecId, pass1VesselId) {
    const root = tree.find((t) => t.execution_id === rootExecId);
    const assertions = [];
    const slotBindingNode = findInChain(tree, "slot-binding")
        ?? tree.find((t) => t.activity_id === "slot-binding" || t.activity_id?.includes("slot-binding"));
    // D1 — count >= 1
    let inventoryCount = null;
    if (slotBindingNode) {
        const inv = await findImpulseByShape(slotBindingNode, "shape_producer_inventory");
        try {
            const b = typeof inv?.body === "string" ? JSON.parse(inv?.body) : inv?.body;
            const inner = b?.content && typeof b.content === "string" ? JSON.parse(b.content) : b;
            inventoryCount = typeof inner?.count === "number" ? inner.count : null;
        }
        catch { /* leave null */ }
    }
    assertions.push({
        id: "D1",
        passed: typeof inventoryCount === "number" && inventoryCount >= 1,
        inspected_field: `shape_producer_inventory.count = ${inventoryCount}`,
    });
    // D2 — forge_missing_shape did NOT fire
    let forgeTask;
    if (slotBindingNode)
        forgeTask = findTaskInTrace(slotBindingNode, "forge_missing_shape");
    const d2Pass = !forgeTask || forgeTask.status == null || forgeTask.status === "skipped";
    assertions.push({
        id: "D2",
        passed: d2Pass,
        inspected_field: `task forge_missing_shape status=${forgeTask?.status ?? "absent"}`,
    });
    // D3 — downstream task bound to SAME vessel as Pass 1
    let downstreamBindingVesselId;
    if (root) {
        for (const task of root.tasks) {
            for (const inputId of task.input_impulse_ids) {
                const sig = root.impulses_by_id?.[inputId];
                if (sig?.shape === TARGET_SHAPE || sig?.pointer_type === TARGET_SHAPE) {
                    const res = (root.impulse_resolutions ?? []).find((r) => r.impulse_id === inputId);
                    if (res?.vessel_id) {
                        downstreamBindingVesselId = res.vessel_id;
                        break;
                    }
                }
            }
            if (downstreamBindingVesselId)
                break;
        }
    }
    // Per design.md §i, a race may legitimately bind to a different forged vessel
    // — we record the observation but do not flip the assertion red if both
    // vessel ids are present and discovery confirms producer existence. For the
    // strict assertion: must equal pass1 vessel id.
    const d3Pass = !!(pass1VesselId && downstreamBindingVesselId && downstreamBindingVesselId === pass1VesselId);
    assertions.push({
        id: "D3",
        passed: d3Pass,
        inspected_field: `downstream vessel_id=${downstreamBindingVesselId ?? "absent"} pass1=${pass1VesselId ?? "absent"}`,
    });
    // D4 — goal completed
    let goalVerifierConfidence;
    let d4Pass = false;
    if (root) {
        const vr = await findImpulseByShape(root, "validation_result");
        try {
            const b = typeof vr?.body === "string" ? JSON.parse(vr?.body) : vr?.body;
            const inner = b?.content && typeof b.content === "string" ? JSON.parse(b.content) : b;
            const passed = inner?.passed === true;
            goalVerifierConfidence = typeof inner?.confidence === "number" ? inner.confidence : undefined;
            d4Pass = passed;
            assertions.push({
                id: "D4",
                passed: d4Pass,
                inspected_field: `validation_result passed=${passed} confidence=${goalVerifierConfidence}`,
            });
        }
        catch (e) {
            assertions.push({ id: "D4", passed: false, inspected_field: `parse error: ${e.message}` });
        }
    }
    else {
        assertions.push({ id: "D4", passed: false, inspected_field: "root execution not found" });
    }
    return {
        label: "pass2",
        executionId: rootExecId,
        assertions,
        passed: assertions.every((a) => a.passed),
        forgedVesselId: pass1VesselId,
        downstreamBindingVesselId,
        goalVerifierConfidence,
        traceSignature: computeTraceSignature(tree),
    };
}
function classifyFailedAssertion(assertion) {
    // Map an assertion id to its declared failure source per design.md tables.
    const sourceMap = {
        C1: "trace_signature", C2: "trace_signature", C3: "trace_signature",
        C4: "trace_signature", C5: "trace_signature", C6: "trace_signature",
        C7: "binding_layer_record", C8: "goal_verifier_result",
        D1: "trace_signature", D2: "trace_signature",
        D3: "binding_layer_record", D4: "goal_verifier_result",
    };
    // Per Option C step 1 (Phase 22): runtime is stamped into context so
    // downstream audit can distinguish minibob vs ias-executor failure modes.
    // `runtime` is added as an open field — FailureMode contexts are not closed
    // shapes (see design.md §c) so adding metadata is non-breaking.
    return {
        type: "verifier_negative",
        reason: `assertion ${assertion.id} failed`,
        context: {
            failed_evidence: [
                {
                    source: sourceMap[assertion.id] ?? "trace_signature",
                    assertion: assertion.id,
                    detail: assertion.inspected_field,
                },
            ],
            runtime: FORGE_RUNTIME,
        },
    };
}
async function emitTestReport(body) {
    // design.md §e: POST to activity-api via test_report_write impulse shape.
    // The shape is contracted by 2026-05-18-test-audit-loop. Until the write
    // resolver lands, the POST will 404; the report is still printed to stdout
    // for at-a-glance debug and the test exits with the right code.
    try {
        const res = await activityApiPOST("/v2/impulses/resolve", {
            pointer: { type: "test_report_write", body },
        });
        if (res.ok) {
            console.log("[test_report] emitted via test_report_write");
        }
        else {
            const txt = await res.text().catch(() => "");
            console.log(`[test_report] write deferred (audit-loop write shape not live yet): ${res.status} ${txt.slice(0, 120)}`);
        }
    }
    catch (e) {
        console.log(`[test_report] write failed: ${e.message}`);
    }
    // Always print to stdout so run-weekly-harness.sh can capture it.
    console.log("\n========== TEST_REPORT ==========");
    console.log(JSON.stringify(body, null, 2));
    console.log("========== END TEST_REPORT ==========\n");
}
// ---------------------------------------------------------------------------
// test_registration emission (design.md §f, spec R4, T3)
// ---------------------------------------------------------------------------
// design.md §F: 12-row grid (3 shapes × 2 complexity × 2 depth). Each row is a
// PerturbationSchema entry — input_path names the runner env var perturbed and
// transform encodes the value to set. expected_effect="metric_shift" because
// none of the variants is designed to flip pass/fail; cost/duration deltas are
// the discriminator (design.md §F.2).
const PERTURBATION_SCHEDULE = (() => {
    const rows = [];
    for (const shape of CANDIDATE_SHAPES) {
        for (const complexity of ["single-step", "two-step"]) {
            for (const depth of [0, 1]) {
                const variant = `${complexity}-depth-${depth}`;
                rows.push({
                    id: `shape-${shape}-complexity-${complexity}-depth-${depth}`,
                    description: `Target shape: ${shape}, ${complexity} depth-${depth}`,
                    apply: {
                        input_path: "TARGET_SHAPE,VARIANT",
                        transform: `set:TARGET_SHAPE=${shape};VARIANT=${variant}`,
                    },
                    expected_effect: "metric_shift",
                });
            }
        }
    }
    return rows;
})();
const REGISTRATION_BODY = {
    id: TEST_ID,
    inputs_schema: {
        goal_text: "string (prompt 40 with {{target_shape}} substituted)",
        target_shape: `enum [${CANDIDATE_SHAPES.join(" | ")}]`,
        canary_endpoint: "https://activity.metabob.com",
        discovery_endpoint: "https://discovery.metabob.com",
        // rotation policy (kept here since schema has no top-level slot):
        rotation: "week_number % 12 -> row index; restart at row 1 every 12 weeks",
    },
    perturbation_schedule: PERTURBATION_SCHEDULE,
    perturbation_cadence: "weekly",
    goal_alignment: [
        {
            criterion: "#3-vessel-resolvers-only",
            discrimination_claim: "MiniBob-connected-vessels (proposal.md:24-31): forge path must produce a discovery-registered vessel that the binding layer resolves, not a one-shot in-process resolver.",
        },
        {
            criterion: "#5-composition-via-features",
            discrimination_claim: "activities-compose-all-features (proposal.md:24-31): slot-binding escalation → forge_missing_shape → downstream bind must compose end-to-end inside the goal pipeline, not just at isolated VesselForgeHost calls.",
        },
    ],
    discrimination_claim: "This test passes only when slot-binding's escalation branch correctly routes count=0 cases to forge_missing_shape AND downstream tasks bind to the just-forged vessel. It discriminates a working forge path from one that succeeds on isolated VesselForgeHost calls but fails inside the goal-processing pipeline: a regression in slot-binding's condition strings, in the shape_producer_inventory resolver, in lifecycle:task:preBinding payloads, in the binding layer's producer-selection, or in goal-verifier's enrichment gate would each independently flip at least one of C1..C8 or D1..D4 to red while leaving validation/scripts/test-22-forge-and-paths.ts green.",
    witness_types: ["differential_solve", "validator_consensus"],
};
async function ensureTestRegistration() {
    // design.md §T3.2: skip if a registration with this id already exists and
    // the perturbation schedule hash matches.
    let needsEmit = true;
    try {
        const resp = await resolveImpulse({ type: "test_registration", id: TEST_ID });
        const content = typeof resp.content === "string" ? JSON.parse(resp.content) : resp.content;
        if (content && content.perturbation_schedule) {
            // Quick equality check by JSON length+head; the audit loop holds the
            // canonical comparison logic per the sibling spec.
            if (Array.isArray(content.perturbation_schedule) &&
                content.perturbation_schedule.length === PERTURBATION_SCHEDULE.length) {
                needsEmit = false;
            }
        }
    }
    catch {
        // Probe failed — registry probably doesn't have the read shape yet. Emit
        // anyway; the write side is idempotent by the registration id.
    }
    if (!needsEmit) {
        console.log(`[test_registration] already present for id=${TEST_ID}, skipping`);
        return;
    }
    try {
        const res = await activityApiPOST("/v2/impulses/resolve", {
            pointer: { type: "test_registration_write", body: REGISTRATION_BODY },
        });
        if (res.ok) {
            console.log(`[test_registration] emitted for id=${TEST_ID} with ${PERTURBATION_SCHEDULE.length} perturbation rows`);
        }
        else {
            const txt = await res.text().catch(() => "");
            console.log(`[test_registration] write deferred (audit-loop write shape not live yet): ${res.status} ${txt.slice(0, 120)}`);
        }
    }
    catch (e) {
        console.log(`[test_registration] write failed: ${e.message}`);
    }
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    requireEnv();
    console.log("forge-goal-completion test");
    console.log("=".repeat(60));
    console.log(`  test_id          : ${TEST_ID}`);
    console.log(`  run_id           : ${RUN_ID}`);
    console.log(`  target_shape     : ${TARGET_SHAPE}`);
    console.log(`  variant          : ${VARIANT} (complexity=${COMPLEXITY} depth=${DEPTH})`);
    console.log(`  ACTIVITY_API_URL : ${ACTIVITY_API_URL}`);
    console.log(`  DISCOVERY_URL    : ${DISCOVERY_URL}`);
    console.log(`  MINIBOB_BIN      : ${MINIBOB_BIN}`);
    console.log(`  FORGE_RUNTIME    : ${FORGE_RUNTIME}`);
    console.log("");
    const t0 = Date.now();
    // T3 — emit test_registration on first run (idempotent)
    await ensureTestRegistration();
    // Pre-flight probe (design.md §b)
    console.log("[pre-flight] probing discovery for existing producers of " + TARGET_SHAPE);
    const preFlight = await probeDiscovery(TARGET_SHAPE, "pre_flight");
    console.log(`[pre-flight] count=${preFlight.count} vessel_ids=${(preFlight.vessel_ids ?? []).join(",")}`);
    const witnesses = [preFlight];
    if (preFlight.count !== 0) {
        const failure = {
            type: "verifier_negative",
            reason: "precondition_violated: shape already has producer",
            context: {
                runtime: FORGE_RUNTIME,
                failed_evidence: [
                    {
                        source: "discovery_registration_probe",
                        expected: 0,
                        actual: preFlight.count,
                        detail: `vessel_ids=${(preFlight.vessel_ids ?? []).join(",")}`,
                    },
                ],
            },
        };
        await emitTestReport({
            test_id: TEST_ID,
            run_id: RUN_ID,
            registration_id: TEST_ID,
            perturbation_row: { shape: TARGET_SHAPE, complexity: COMPLEXITY, depth: DEPTH },
            passed: false,
            passes: [],
            witnesses,
            failure_mode: failure,
            duration_ms: Date.now() - t0,
            cost_usd: 0,
        });
        process.exit(1);
    }
    // Pass 1
    const since = new Date(t0 - 60_000).toISOString();
    const goalText = loadGoalText();
    console.log(`\n[pass1] invoking forge via runtime=${FORGE_RUNTIME} ...`);
    const run1 = await runForge(goalText);
    console.log(`[pass1] runtime=${FORGE_RUNTIME} exit=${run1.exitCode} duration=${(run1.duration_ms / 1000).toFixed(1)}s executionId=${run1.executionId ?? "(not in stdout)"}`);
    // design.md §c: if executionId missing from stdout, fall back to most recent
    // root execution within a 5-minute window. We resolve that by fetching
    // traces since `since` and picking the most-recent with no parent.
    let rootExecId1 = run1.executionId;
    if (!rootExecId1) {
        try {
            const resp = await resolveImpulse({ type: "executionTraceWithSignatures", since, limit: 50 });
            const content = typeof resp.content === "string" ? JSON.parse(resp.content) : resp.content;
            const candidates = (content?.traces ?? []);
            const roots = candidates.filter((t) => !t.parent_execution_id);
            if (roots.length > 0)
                rootExecId1 = roots[0].execution_id;
        }
        catch (e) {
            console.log(`[pass1] fallback executionId lookup failed: ${e.message}`);
        }
    }
    if (!rootExecId1) {
        const failure = {
            type: "cascading",
            reason: "no_execution_id_in_window",
            context: { upstream_task_id: `forge_invocation_${FORGE_RUNTIME}`, runtime: FORGE_RUNTIME },
        };
        await emitTestReport({
            test_id: TEST_ID,
            run_id: RUN_ID,
            registration_id: TEST_ID,
            perturbation_row: { shape: TARGET_SHAPE, complexity: COMPLEXITY, depth: DEPTH },
            passed: false,
            passes: [],
            witnesses,
            failure_mode: failure,
            duration_ms: Date.now() - t0,
            cost_usd: 0,
        });
        process.exit(1);
    }
    console.log(`[pass1] root execution id=${rootExecId1}`);
    console.log("[pass1] fetching trace tree...");
    const tree1 = await fetchTraceTree(rootExecId1, since);
    console.log(`[pass1] trace tree size=${tree1.length}`);
    const pass1 = await assertPass1(tree1, rootExecId1);
    for (const a of pass1.assertions) {
        console.log(`  ${a.passed ? "[OK]" : "[FAIL]"} ${a.id}: ${a.inspected_field}`);
    }
    if (pass1.traceSignature) {
        witnesses.push({ type: "trace_signature", executionId: rootExecId1, signature: pass1.traceSignature });
    }
    if (pass1.downstreamBindingVesselId) {
        witnesses.push({
            type: "binding_layer_record",
            executionId: rootExecId1,
            task_id: tree1.find((t) => t.execution_id === rootExecId1)?.tasks
                .find((tk) => tk.input_impulse_ids.some((id) => tree1.find((t) => t.execution_id === rootExecId1)?.impulses_by_id?.[id]?.shape === TARGET_SHAPE))?.task_id ?? null,
            bound_vessel_id: pass1.downstreamBindingVesselId,
        });
    }
    if (typeof pass1.goalVerifierConfidence !== "undefined") {
        witnesses.push({
            type: "goal_verifier_result",
            executionId: rootExecId1,
            passed: pass1.assertions.find((a) => a.id === "C8")?.passed ?? false,
            validator_id: "goal-verifier",
            confidence: pass1.goalVerifierConfidence,
        });
    }
    // Post-pass1 probe
    const postPass1 = await probeDiscovery(TARGET_SHAPE, "post_pass1");
    witnesses.push(postPass1);
    console.log(`[post-pass1] discovery count=${postPass1.count} vessel_ids=${(postPass1.vessel_ids ?? []).join(",")}`);
    if (!pass1.passed) {
        const firstFailed = pass1.assertions.find((a) => !a.passed);
        await emitTestReport({
            test_id: TEST_ID,
            run_id: RUN_ID,
            registration_id: TEST_ID,
            perturbation_row: { shape: TARGET_SHAPE, complexity: COMPLEXITY, depth: DEPTH },
            passed: false,
            passes: [{ label: "pass1", executionId: rootExecId1, assertions: pass1.assertions, runtime: FORGE_RUNTIME }],
            witnesses,
            failure_mode: classifyFailedAssertion(firstFailed),
            duration_ms: Date.now() - t0,
            cost_usd: 0,
        });
        process.exit(1);
    }
    // Pre-pass2 probe (design.md §e enumerates this witness)
    const prePass2 = await probeDiscovery(TARGET_SHAPE, "pre_pass2");
    witnesses.push(prePass2);
    console.log(`[pre-pass2] discovery count=${prePass2.count}`);
    // Pass 2 — same goal text
    console.log(`\n[pass2] invoking forge via runtime=${FORGE_RUNTIME} (same goal) ...`);
    const sinceP2 = new Date(Date.now() - 30_000).toISOString();
    const run2 = await runForge(goalText);
    console.log(`[pass2] runtime=${FORGE_RUNTIME} exit=${run2.exitCode} duration=${(run2.duration_ms / 1000).toFixed(1)}s executionId=${run2.executionId ?? "(not in stdout)"}`);
    let rootExecId2 = run2.executionId;
    if (!rootExecId2) {
        try {
            const resp = await resolveImpulse({ type: "executionTraceWithSignatures", since: sinceP2, limit: 50 });
            const content = typeof resp.content === "string" ? JSON.parse(resp.content) : resp.content;
            const candidates = (content?.traces ?? []);
            const roots = candidates.filter((t) => !t.parent_execution_id && t.execution_id !== rootExecId1);
            if (roots.length > 0)
                rootExecId2 = roots[0].execution_id;
        }
        catch { /* fall through */ }
    }
    if (!rootExecId2) {
        const failure = {
            type: "cascading",
            reason: "no_execution_id_in_window_for_pass2",
            context: { upstream_task_id: `forge_invocation_${FORGE_RUNTIME}_pass2`, runtime: FORGE_RUNTIME },
        };
        await emitTestReport({
            test_id: TEST_ID,
            run_id: RUN_ID,
            registration_id: TEST_ID,
            perturbation_row: { shape: TARGET_SHAPE, complexity: COMPLEXITY, depth: DEPTH },
            passed: false,
            passes: [{ label: "pass1", executionId: rootExecId1, assertions: pass1.assertions, runtime: FORGE_RUNTIME }],
            witnesses,
            failure_mode: failure,
            duration_ms: Date.now() - t0,
            cost_usd: 0,
        });
        process.exit(1);
    }
    console.log(`[pass2] root execution id=${rootExecId2}`);
    const tree2 = await fetchTraceTree(rootExecId2, sinceP2);
    const pass2 = await assertPass2(tree2, rootExecId2, pass1.forgedVesselId);
    for (const a of pass2.assertions) {
        console.log(`  ${a.passed ? "[OK]" : "[FAIL]"} ${a.id}: ${a.inspected_field}`);
    }
    if (pass2.traceSignature) {
        witnesses.push({ type: "trace_signature", executionId: rootExecId2, signature: pass2.traceSignature });
    }
    if (pass2.downstreamBindingVesselId) {
        witnesses.push({
            type: "binding_layer_record",
            executionId: rootExecId2,
            task_id: tree2.find((t) => t.execution_id === rootExecId2)?.tasks
                .find((tk) => tk.input_impulse_ids.some((id) => tree2.find((t) => t.execution_id === rootExecId2)?.impulses_by_id?.[id]?.shape === TARGET_SHAPE))?.task_id ?? null,
            bound_vessel_id: pass2.downstreamBindingVesselId,
        });
    }
    if (typeof pass2.goalVerifierConfidence !== "undefined") {
        witnesses.push({
            type: "goal_verifier_result",
            executionId: rootExecId2,
            passed: pass2.assertions.find((a) => a.id === "D4")?.passed ?? false,
            validator_id: "goal-verifier",
            confidence: pass2.goalVerifierConfidence,
        });
    }
    const overallPassed = pass1.passed && pass2.passed;
    const firstFailed = !pass1.passed
        ? pass1.assertions.find((a) => !a.passed)
        : !pass2.passed
            ? pass2.assertions.find((a) => !a.passed)
            : undefined;
    await emitTestReport({
        test_id: TEST_ID,
        run_id: RUN_ID,
        registration_id: TEST_ID,
        perturbation_row: { shape: TARGET_SHAPE, complexity: COMPLEXITY, depth: DEPTH },
        passed: overallPassed,
        passes: [
            { label: "pass1", executionId: rootExecId1, assertions: pass1.assertions, runtime: FORGE_RUNTIME },
            { label: "pass2", executionId: rootExecId2, assertions: pass2.assertions, runtime: FORGE_RUNTIME },
        ],
        witnesses,
        failure_mode: firstFailed ? classifyFailedAssertion(firstFailed) : null,
        duration_ms: Date.now() - t0,
        cost_usd: 0,
    });
    console.log("\n" + "=".repeat(60));
    console.log(`RESULT: ${overallPassed ? "PASS" : "FAIL"}`);
    console.log(`  pass1: ${pass1.passed ? "PASS" : "FAIL"} (${pass1.assertions.filter((a) => a.passed).length}/${pass1.assertions.length})`);
    console.log(`  pass2: ${pass2.passed ? "PASS" : "FAIL"} (${pass2.assertions.filter((a) => a.passed).length}/${pass2.assertions.length})`);
    console.log(`  duration: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    process.exit(overallPassed ? 0 : 1);
}
main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
//# sourceMappingURL=test-forge-goal-completion.js.map