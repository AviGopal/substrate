/**
 * light-dispatch-vessel — stateless oneshot dispatcher (port 8230... no, 8280
 * to avoid collision with local-tools-vessel which already uses 8230).
 *
 * Spec: openspec/changes/2026-06-03-pre-lift-bootstrap-and-architecture-aware-loop
 *       Stage 2.B.
 *
 * Purpose: alternative dispatch path that bypasses goal-host's full machinery
 * (state-space services, LLM-reuse, ProxyImpulseBus snapshot, fetch-probe
 * instrumentation). Useful for deterministic multi-task chains where the
 * template is explicit and no LLM-reuse / open-ended-goal logic is needed.
 *
 * Architecture:
 *   - HTTP server on PORT (default 8280); POST /dispatch
 *   - Per-dispatch flow:
 *     1. Fetch template from activity-api by template_id
 *     2. Walk tasks sequentially:
 *        a. Substitute {{var}} placeholders in task.config from variables +
 *           prior task results
 *        b. Find owning vessel for task.resolver via discovery
 *        c. POST to that vessel's resolve endpoint
 *        d. Persist intermediate result to /workspace/light-dispatch/<id>/
 *           task-<n>.json (so memory can drop the body)
 *     3. Assemble trace + POST to activity-api /v2/activities/execution-traces
 *     4. Return trace summary (or 202 + dispatchId for async polling)
 *   - GET /health, GET /executions/:dispatchId
 *
 * No persistent state. No proxy resolver registration. No state-signature
 * compute. No LLM-reuse. Discovery query is per-dispatch (cheap; only the
 * referenced resolvers' vessels need resolving).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PORT = Number(process.env["PORT"] ?? 8280);
const VESSEL_ID = process.env["LIGHT_DISPATCH_VESSEL_ID"] ?? "light-dispatch-vessel";
const ACTIVITY_API = process.env["ACTIVITY_API_ENDPOINT"] ?? "http://127.0.0.1:8080";
const DISCOVERY = process.env["DISCOVERY_ENDPOINT"] ?? "http://127.0.0.1:8100";
const API_KEY = process.env["METABOB_API_KEY"] ?? "";
const VERSION = "0.1.0";
const WORKDIR_ROOT = process.env["LIGHT_DISPATCH_WORKDIR"] ?? "/workspace/light-dispatch";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name?: string;
  description?: string;
  output_shapes?: string[];
  tasks: Array<{
    id: string;
    description?: string;
    resolver: string;
    config?: Record<string, unknown>;
    output_shape?: string;
  }>;
}

interface TaskResult {
  taskId: string;
  resolver: string;
  status: "success" | "failure";
  duration_ms: number;
  shape?: string;
  error?: string;
  /** raw body returned from resolving vessel — only kept long enough to persist + extract referenced fields. */
  body?: unknown;
}

interface DispatchOutcome {
  dispatchId: string;
  executionId: string;
  templateId: string;
  status: "success" | "failure";
  startedAt: string;
  duration_ms: number;
  taskCount: number;
  successCount: number;
  failureCount: number;
  output_shapes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const auth = (): Record<string, string> =>
  API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {};

/**
 * Interpolate {{var}} and {{taskId_field}} placeholders. Mirrors the surface
 * area of goal-host's interpolateProxyValue (variables + prior task field
 * references via underscore — e.g. {{fetch_traces_text}} resolves to the
 * `text` field of the task whose id is `fetch_traces`).
 */
function interpolate(value: unknown, variables: Record<string, unknown>, priorResults: Map<string, TaskResult>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{([\w]+(?:[._][\w]+)*)\}\}/g, (match, path: string) => {
      // Try variables direct match
      if (path in variables) {
        const v = variables[path];
        return typeof v === "string" ? v : JSON.stringify(v);
      }
      // Try taskId_field via underscore split
      const usPos = path.indexOf("_");
      if (usPos > 0) {
        const taskId = path.slice(0, usPos);
        const field = path.slice(usPos + 1);
        const r = priorResults.get(taskId);
        if (r?.body && typeof r.body === "object") {
          const fld = (r.body as Record<string, unknown>)[field];
          if (typeof fld === "string") return fld;
          if (fld !== undefined) return JSON.stringify(fld);
        }
      }
      // Try dotted path through variables
      const segs = path.split(/[._]/);
      let cur: unknown = variables;
      for (const seg of segs) {
        if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[seg];
        } else {
          return match;
        }
      }
      if (cur === undefined || cur === null) return match;
      if (typeof cur === "string") return cur;
      return JSON.stringify(cur);
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, variables, priorResults));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolate(v, variables, priorResults);
    }
    return out;
  }
  return value;
}

/**
 * Find a vessel that advertises the given resolver/shape via discovery.
 * Cached per-process for the lifetime of this dispatch (no proxy registration).
 */
const vesselCache = new Map<string, string>();
async function findVesselEndpointFor(resolverShape: string): Promise<string | null> {
  if (vesselCache.has(resolverShape)) return vesselCache.get(resolverShape)!;
  // Try bare shape AND namespace-stripped form. Many templates reference
  // `vesselname:shape` while discovery indexes by the bare shape name.
  const candidates = [resolverShape];
  const colon = resolverShape.indexOf(":");
  if (colon > 0) candidates.push(resolverShape.slice(colon + 1));
  for (const candidate of candidates) {
    const found = await lookupShape(candidate);
    if (found) {
      vesselCache.set(resolverShape, found);
      return found;
    }
  }
  return null;
}

async function lookupShape(resolverShape: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${DISCOVERY}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({ pointer: { type: "vesselCapability", shape: resolverShape } }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      try { await res.body?.cancel(); } catch { /* swallow */ }
      return null;
    }
    const data = await res.json() as { content?: { vessels?: Array<{ endpoint?: string; resolve_endpoint?: string }> } };
    try { await res.body?.cancel(); } catch { /* swallow */ }
    const vessel = data.content?.vessels?.[0];
    if (vessel) {
      const path = vessel.resolve_endpoint ?? "/v2/impulses/resolve";
      const base = vessel.endpoint ?? "";
      const full = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
      return full;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchTemplate(templateId: string): Promise<Template | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${ACTIVITY_API}/v2/activities/templates/${encodeURIComponent(templateId)}`, {
      headers: auth(),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      try { await res.body?.cancel(); } catch { /* swallow */ }
      return null;
    }
    const data = await res.json() as Template | { template?: Template };
    try { await res.body?.cancel(); } catch { /* swallow */ }
    const tpl = (data as { template?: Template }).template ?? (data as Template);
    if (!tpl || !Array.isArray(tpl.tasks)) return null;
    return tpl;
  } catch {
    return null;
  }
}

async function resolveTask(
  endpoint: string,
  resolverShape: string,
  config: Record<string, unknown>,
): Promise<{ ok: boolean; body?: unknown; shape?: string; error?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({
        impulse: { pointer: { type: resolverShape, ...config } },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    try { await res.body?.cancel(); } catch { /* swallow */ }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      if (p["success"] === false) {
        return { ok: false, error: typeof p["error"] === "string" ? p["error"] : "resolver returned success=false" };
      }
      const shape = typeof p["shape"] === "string" ? p["shape"] : undefined;
      if (shape === "structuredError") {
        const detail = (p["body"] as Record<string, unknown> | undefined)?.["detail"] ?? "structuredError";
        return { ok: false, shape, error: String(detail).slice(0, 200) };
      }
      return { ok: true, body: p["body"] ?? parsed, shape };
    }
    return { ok: true, body: parsed };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function postTrace(trace: Record<string, unknown>): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify(trace),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    try { await res.body?.cancel(); } catch { /* swallow */ }
    if (!res.ok) console.warn(`[light-dispatch-vessel] trace POST HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[light-dispatch-vessel] trace POST failed: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch orchestrator
// ─────────────────────────────────────────────────────────────────────────────

async function runDispatch(
  templateId: string,
  variables: Record<string, unknown>,
  extraTags: string[] = [],
  parentExecutionId?: string,
  compositionChain: string[] = [],
): Promise<DispatchOutcome> {
  const dispatchId = crypto.randomUUID();
  const executionId = `exec_${dispatchId.slice(0, 12)}`;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const workDir = join(WORKDIR_ROOT, dispatchId);
  try { await mkdir(workDir, { recursive: true }); } catch { /* tolerate */ }

  const tpl = await fetchTemplate(templateId);
  if (!tpl) {
    const trace = {
      execution_id: executionId,
      template_id: templateId,
      activity_id: templateId,
      activity_variant_id: templateId,
      status: "failed" as const,
      started_at: startedAt,
      duration_ms: Date.now() - t0,
      tasks: [],
      tags: [
        `dispatcher_used:light-dispatch`,
        ...extraTags,
      ],
      metadata: {
        dispatcher_used: "light-dispatch",
        dispatch_id: dispatchId,
        failure_reason: "template_not_found",
      },
      parent_execution_id: parentExecutionId,
      composition_chain: compositionChain,
    };
    await postTrace(trace);
    return {
      dispatchId, executionId, templateId,
      status: "failure", startedAt,
      duration_ms: Date.now() - t0,
      taskCount: 0, successCount: 0, failureCount: 0,
      output_shapes: [],
    };
  }

  const priorResults = new Map<string, TaskResult>();
  const taskRecords: Array<Record<string, unknown>> = [];
  let successCount = 0;
  let failureCount = 0;
  const outputShapesProduced: string[] = [];

  for (let i = 0; i < tpl.tasks.length; i++) {
    const task = tpl.tasks[i]!;
    const tTask0 = Date.now();
    const rawConfig = (task.config ?? {}) as Record<string, unknown>;
    const config = interpolate({ ...variables, ...rawConfig }, variables, priorResults) as Record<string, unknown>;
    const endpoint = await findVesselEndpointFor(task.resolver);
    // Strip namespace prefix for the actual pointer type sent to the vessel —
    // the vessel resolves on the bare shape name.
    const colonIdx = task.resolver.indexOf(":");
    const pointerType = colonIdx > 0 ? task.resolver.slice(colonIdx + 1) : task.resolver;
    if (!endpoint) {
      const r: TaskResult = {
        taskId: task.id,
        resolver: task.resolver,
        status: "failure",
        duration_ms: Date.now() - tTask0,
        error: `no vessel advertises resolver ${task.resolver}`,
      };
      priorResults.set(task.id, r);
      failureCount++;
      taskRecords.push({
        id: task.id,
        resolver_id: task.resolver,
        resolver_tier: "deterministic",
        success: false,
        duration_ms: r.duration_ms,
        error: r.error,
        input_impulse_ids: [],
        output_impulse_ids: [],
      });
      // Persist
      try {
        await writeFile(join(workDir, `task-${i}-${task.id}.json`), JSON.stringify(r, null, 2));
      } catch { /* swallow */ }
      // Fail fast; downstream tasks usually depend on this one.
      break;
    }
    const resolved = await resolveTask(endpoint, pointerType, config);
    const r: TaskResult = {
      taskId: task.id,
      resolver: task.resolver,
      status: resolved.ok ? "success" : "failure",
      duration_ms: Date.now() - tTask0,
      shape: resolved.shape,
      error: resolved.error,
      body: resolved.body,
    };
    priorResults.set(task.id, r);
    if (r.status === "success") {
      successCount++;
      if (r.shape) outputShapesProduced.push(r.shape);
    } else {
      failureCount++;
    }
    taskRecords.push({
      id: task.id,
      resolver_id: task.resolver,
      resolver_tier: "deterministic",
      success: r.status === "success",
      duration_ms: r.duration_ms,
      ...(r.error ? { error: r.error } : {}),
      input_impulse_ids: [],
      output_impulse_ids: r.shape ? [`impulse:${task.id}`] : [],
    });
    // Persist + drop body reference for memory hygiene
    try {
      await writeFile(join(workDir, `task-${i}-${task.id}.json`), JSON.stringify(r, null, 2));
    } catch { /* swallow */ }
    if (r.status === "failure") break; // chain halts on first failure
  }

  const overallStatus: "success" | "failure" = failureCount === 0 ? "success" : "failure";
  const duration = Date.now() - t0;
  // activity-api's POST /v2/activities/execution-traces derives `success` via
  // `body.status === 'completed' || body.success === true` (see
  // metabob-activity-api/src/routes/execution-traces.ts:1561). Send BOTH the
  // explicit success bool AND status:"completed" on the success path so the
  // downstream row's success/status fields match light-dispatch's own view of
  // the trace. (Bootstrap 3.)
  const trace = {
    execution_id: executionId,
    template_id: templateId,
    activity_id: templateId,
    activity_variant_id: templateId,
    status: overallStatus === "success" ? ("completed" as const) : ("failed" as const),
    success: overallStatus === "success",
    started_at: startedAt,
    duration_ms: duration,
    tasks: taskRecords,
    tags: [
      `dispatcher_used:light-dispatch`,
      ...extraTags,
    ],
    metadata: {
      dispatcher_used: "light-dispatch",
      dispatch_id: dispatchId,
      task_count: tpl.tasks.length,
      success_count: successCount,
      failure_count: failureCount,
    },
    parent_execution_id: parentExecutionId,
    composition_chain: compositionChain,
    output_impulse_shapes: Array.from(new Set(outputShapesProduced)),
  };
  await postTrace(trace);

  return {
    dispatchId, executionId, templateId,
    status: overallStatus, startedAt, duration_ms: duration,
    taskCount: tpl.tasks.length,
    successCount, failureCount,
    output_shapes: Array.from(new Set(outputShapesProduced)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────────────────────────

const SHAPES = ["light_dispatch_execution"];

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        vesselId: VESSEL_ID,
        vesselName: "Light Dispatch Vessel",
        version: VERSION,
        shapes: SHAPES,
        rss_mb: +(process.memoryUsage().rss / 1024 / 1024).toFixed(1),
      });
    }

    if (req.method === "GET" && url.pathname === "/shapes") {
      return Response.json({ shapes: SHAPES });
    }

    if (req.method === "POST" && url.pathname === "/dispatch") {
      let body: Record<string, unknown>;
      try {
        const parsed = await req.json();
        if (typeof parsed !== "object" || parsed === null) throw new Error("body must be an object");
        body = parsed as Record<string, unknown>;
      } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 400 });
      }
      const templateId =
        (typeof body["template_id"] === "string" && body["template_id"]) ||
        (typeof body["targetTemplateId"] === "string" && body["targetTemplateId"]) ||
        undefined;
      if (!templateId) {
        return Response.json({ error: "template_id (or targetTemplateId) required" }, { status: 400 });
      }
      const variables = (typeof body["variables"] === "object" && body["variables"] !== null)
        ? body["variables"] as Record<string, unknown>
        : {};
      const tags = Array.isArray(body["tags"]) ? (body["tags"] as string[]) : [];
      const parentExecutionId = typeof body["parent_execution_id"] === "string"
        ? body["parent_execution_id"] : undefined;
      const compositionChain = Array.isArray(body["composition_chain"])
        ? (body["composition_chain"] as string[]) : [];
      try {
        const outcome = await runDispatch(templateId, variables, tags, parentExecutionId, compositionChain);
        return Response.json(outcome, { status: outcome.status === "success" ? 200 : 207 });
      } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 500 });
      }
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(
  `[light-dispatch-vessel] listening on http://127.0.0.1:${server.port} ` +
    `| activity-api: ${ACTIVITY_API} | discovery: ${DISCOVERY}`,
);

// ─────────────────────────────────────────────────────────────────────────────
// Discovery registration + heartbeat loop (best-effort; non-fatal)
// ─────────────────────────────────────────────────────────────────────────────

async function registerWithDiscovery(): Promise<boolean> {
  try {
    const res = await fetch(`${DISCOVERY}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({
        vesselId: VESSEL_ID,
        vesselName: "Light Dispatch Vessel",
        version: VERSION,
        shapes: SHAPES,
        endpoint: `http://127.0.0.1:${PORT}`,
        resolve_endpoint: "/dispatch",
        resolve_request_format: "pointer",
        auth_scheme: "ApiKey",
        resolve_timeout_ms: 60_000,
        systemVessel: true,
      }),
    });
    try { await res.body?.cancel(); } catch { /* swallow */ }
    return res.ok;
  } catch {
    return false;
  }
}

async function heartbeatWithDiscovery(): Promise<boolean> {
  try {
    const res = await fetch(`${DISCOVERY}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({ vesselId: VESSEL_ID }),
    });
    try { await res.body?.cancel(); } catch { /* swallow */ }
    return res.ok;
  } catch {
    return false;
  }
}

(async () => {
  const ok = await registerWithDiscovery();
  if (ok) console.log(`[light-dispatch-vessel] registered with discovery at ${DISCOVERY}`);
  else console.warn(`[light-dispatch-vessel] discovery registration failed (will retry via heartbeat loop)`);
})();

// Heartbeat every 60s; auto re-register on heartbeat 404.
setInterval(async () => {
  const ok = await heartbeatWithDiscovery();
  if (!ok) {
    const reregistered = await registerWithDiscovery();
    if (reregistered) console.log(`[light-dispatch-vessel] re-registered after heartbeat miss`);
  }
}, 60_000).unref();

// ─────────────────────────────────────────────────────────────────────────────
// Bun.gc periodic tick (matches local-tools-vessel pattern; bounds RSS under
// Bun 1.3.14 heap-arena retention).
// ─────────────────────────────────────────────────────────────────────────────

const GC_INTERVAL_MS = parseInt(process.env["LIGHT_DISPATCH_GC_INTERVAL_MS"] ?? "30000", 10);
interface BunGlobal { Bun?: { gc?: (force: boolean) => number } }
const bunGlobal = globalThis as unknown as BunGlobal;
setInterval(() => {
  const gc = bunGlobal.Bun?.gc;
  if (typeof gc === "function") {
    try {
      const freed = gc(true);
      const rssMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
      console.log(`[gc-tick] vessel=light-dispatch-vessel freed=${freed}B rss_after=${rssMB}MB`);
    } catch (err) {
      console.warn(`[gc-tick] Bun.gc failed: ${(err as Error).message}`);
    }
  }
}, GC_INTERVAL_MS).unref();

// Graceful shutdown
const shutdown = (signal: string): void => {
  console.log(`[light-dispatch-vessel] received ${signal}, shutting down...`);
  try { server.stop(true); } catch { /* swallow */ }
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
