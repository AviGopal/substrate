/**
 * goal-host-vessel — wraps GoalHost in a substrate HTTP vessel (port 8210).
 *
 * Spec: openspec/changes/2026-05-23-substrate-explicit-vessels Phase 4, tasks 4.1–4.2.
 *
 * Exposes:
 *   POST /run-goal   — { goal, targetTemplateId?, variables?, parent_execution_id?, composition_chain? }
 *   POST /resolve    — { type: "goal_execution" | "activity_execution", goal, ... }
 *   GET  /health     — liveness probe
 *
 * Discovery advertisement: goal_execution, activity_execution shapes.
 * auth_token_source: caller_identity; resolve_timeout_ms: 60000.
 *
 * LLM routing:
 *   - When LLM_VESSEL_ENDPOINT is set (e.g. http://127.0.0.1:8220): HttpLLMPort.
 *   - Otherwise: InProcessLLMPort wrapping the Anthropic SDK (requires ANTHROPIC_API_KEY).
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  GoalHost,
  DiscoveryRegistrationLoop,
  createLLMPort,
} from "@avigopal/ias-executor-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "8210", 10);
const VESSEL_ID = process.env.GOAL_HOST_VESSEL_ID ?? process.env.VESSEL_ID ?? "goal-host-vessel";
const ACTIVITY_API_ENDPOINT = process.env.ACTIVITY_API_ENDPOINT ?? "http://127.0.0.1:8080";
const DISCOVERY_ENDPOINT = process.env.DISCOVERY_VESSEL_ENDPOINT ?? "http://127.0.0.1:8100";
const API_KEY = process.env.GOAL_HOST_VESSEL_API_KEY ?? process.env.METABOB_API_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const LLM_VESSEL_ENDPOINT = process.env.LLM_VESSEL_ENDPOINT;

const SHAPES = ["goal_execution", "activity_execution"] as const;
const VERSION = "0.1.0";
const DEV_VESSEL_ENDPOINT = process.env.DEVELOPMENT_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";

// ─────────────────────────────────────────────────────────────────────────────
// LLM port — HttpLLMPort when LLM_VESSEL_ENDPOINT is set, InProcessLLMPort
// otherwise. Vessel starts even without a key; errors surface at execute time.
// ─────────────────────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | undefined;

if (!LLM_VESSEL_ENDPOINT) {
  if (!ANTHROPIC_API_KEY) {
    console.warn(
      "[goal-host-vessel] LLM_VESSEL_ENDPOINT and ANTHROPIC_API_KEY are both unset. " +
      "LLM-tier resolvers will fail until one is configured.",
    );
  } else {
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
}

const llm = createLLMPort(anthropicClient);

// ─────────────────────────────────────────────────────────────────────────────
// GoalHost
// ─────────────────────────────────────────────────────────────────────────────

const host = new GoalHost({
  llm,
  activityApiEndpoint: ACTIVITY_API_ENDPOINT,
  apiKey: API_KEY,
  discoveryEndpoint: DISCOVERY_ENDPOINT,
  enableAgentFill: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Built-in resolvers referenced by SHARED_TEMPLATES but not in GoalHost core
//
// SHARED_TEMPLATES (ias-executor-ts) ship escalation templates (e.g.
// create-shape-provider-goal) whose tasks reference resolvers that GoalHost
// doesn't register by default.  We register them here so those templates can
// execute inside the substrate.
// ─────────────────────────────────────────────────────────────────────────────

function registerBuiltinResolvers(): void {
  // activity_recommendation — wraps POST /v2/activities/recommend.
  // Used by create-shape-provider-goal:forward_chain_producers to find activity
  // templates that produce a required output shape.
  host.runtime.resolvers.register({
    id: "activity_recommendation",
    tier: "pattern" as const,
    async resolve(context: Record<string, unknown>) {
      const task = context.task as Record<string, unknown> | undefined;
      const config = (task?.config ?? {}) as Record<string, unknown>;
      const variables = (context.variables ?? {}) as Record<string, unknown>;
      const random = context.random as { id: (prefix: string) => string };

      const limit = typeof config.limit === "number" ? config.limit : 5;
      const minSuccessRate = typeof config.minSuccessRate === "number" ? config.minSuccessRate : 0.0;

      // Collect goal text and shape hints from variables injected by GoalHost
      const goal = typeof variables.goal === "string" ? variables.goal
        : typeof variables.goalDescription === "string" ? variables.goalDescription
        : undefined;
      const requiredShape = typeof variables.requiredShape === "string" ? variables.requiredShape
        : typeof variables.targetShape === "string" ? variables.targetShape
        : undefined;

      const body: Record<string, unknown> = {
        limit,
        min_success_rate: minSuccessRate,
      };
      if (goal) body.goal = goal;
      if (requiredShape) body.expected_output_shapes = [requiredShape];

      try {
        const resp = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/recommend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
        const result = await resp.json();
        return [{
          id: random.id("activity_rec"),
          pointer: { type: "memo" },
          metadata: { shape: "activityTemplateRecommendation", source: "activity-api", ok: resp.ok },
          loaded: true,
          content: result,
        }];
      } catch (err) {
        return [{
          id: random.id("activity_rec:err"),
          pointer: { type: "memo" },
          metadata: { shape: "activityTemplateRecommendation", source: "activity-api", degraded: true },
          loaded: true,
          content: { error: (err as Error).message, recommendations: [] },
        }];
      }
    },
  });

  console.log("[goal-host-vessel] registered built-in resolver: activity_recommendation");

  // impulse_cooccurrence — stateless co-occurrence pair-counter used by
  // create-shape-provider-goal:cooccurrence_signal. The template always passes
  // config.traces:[] (no upstream trace fetch exists), so this resolver always
  // runs over an empty trace set and emits an empty matrix. compose_goal handles
  // empty signal 4 defensively.
  host.runtime.resolvers.register({
    id: "impulse_cooccurrence",
    tier: "pattern" as const,
    async resolve(context: Record<string, unknown>) {
      const random = context.random as { id: (prefix: string) => string };
      const id = random.id("cooccurrence");
      return [{
        id,
        pointer: { type: "memo" },
        metadata: {
          shape: "cooccurrenceRanking",
          source: "impulse_cooccurrence",
          summary: "0 pairs across 0 traces",
        },
        loaded: true,
        content: { pairs: [], trace_count: 0 },
      }];
    },
  });

  console.log("[goal-host-vessel] registered built-in resolver: impulse_cooccurrence");
}

// ─────────────────────────────────────────────────────────────────────────────
// Development-vessel proxy resolvers
//
// GoalHost only knows its own built-in resolvers (fs, bash, llm, slot-binding,
// etc.). Templates seeded by development-vessel use resolver IDs like
// "fs_read", "coverage_tick", or "development-vessel:coverage_tick" — names
// that live in development-vessel, not in GoalHost's registry.
//
// Fix: at startup, fetch /shapes from development-vessel and register a proxy
// resolver for each shape. Each proxy POSTs to development-vessel's
// /v2/impulses/resolve endpoint with a pointer built from task.config.
// Registered under both the bare name ("coverage_tick") and the
// qualified name ("development-vessel:coverage_tick") so both conventions work.
// ─────────────────────────────────────────────────────────────────────────────

// Currently-registered proxy shape ids, tracked so re-registration can be idempotent
// and produce useful diff logs. Keyed on the bare shape name (we register both bare
// and qualified forms but the bare name is the canonical identity).
const registeredProxyShapes = new Set<string>();

function buildProxyResolver(shape: string) {
  return {
    id: shape,
    tier: "pattern" as const,
    async resolve(context: Record<string, unknown>) {
      const task = context.task as Record<string, unknown>;
      const config = (task.config ?? {}) as Record<string, unknown>;
      const variables = (context.variables ?? {}) as Record<string, unknown>;
      const random = context.random as { id: (prefix: string) => string };
      const pointer: Record<string, unknown> = { type: shape, ...config, ...variables };
      try {
        const resp = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
          },
          body: JSON.stringify({ impulse: { pointer } }),
          signal: AbortSignal.timeout(30_000),
        });
        const bodyText = await resp.text();
        let parsed: unknown;
        try { parsed = JSON.parse(bodyText); } catch { parsed = bodyText; }
        return [{
          id: random.id(`dev:${shape}`),
          pointer: { type: "memo" },
          metadata: { shape, source: "development-vessel", ok: resp.ok },
          loaded: true,
          content: parsed,
        }];
      } catch (err) {
        return [{
          id: random.id(`dev:${shape}:err`),
          pointer: { type: "memo" },
          metadata: { shape, source: "development-vessel", degraded: true },
          loaded: true,
          content: { error: (err as Error).message },
        }];
      }
    },
  };
}

/**
 * Idempotent registration of development-vessel proxy resolvers.
 *
 * Fetches /shapes from dev-vessel, diffs against the currently-registered set,
 * and registers proxies for any new shapes (both bare and `development-vessel:`
 * qualified). Existing proxies are left alone — re-registration would be safe
 * but the diff avoids redundant work.
 *
 * Called at startup AND reactively from the vessel-registration WS subscriber
 * whenever a `vessel.registered` event fires for the dev-vessel identity. Per
 * openspec/changes/2026-05-27-neutral-emitter-lifecycle-bus
 * proxy-resolver-reactive-registration capability. Dissolves F-129 (proxy
 * registration race when goal-host restarts before dev-vessel is up).
 */
async function registerDevVesselProxies(): Promise<{ added: string[]; total: number }> {
  try {
    const r = await fetch(`${DEV_VESSEL_ENDPOINT}/shapes`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) {
      console.warn(`[goal-host-vessel] dev-vessel /shapes HTTP ${r.status} — proxy resolvers not registered yet`);
      return { added: [], total: registeredProxyShapes.size };
    }
    const body = await r.json() as { shapes?: string[] };
    const shapes: string[] = Array.isArray(body.shapes) ? body.shapes : [];
    if (shapes.length === 0) {
      console.warn("[goal-host-vessel] dev-vessel /shapes returned empty list");
      return { added: [], total: registeredProxyShapes.size };
    }

    const added: string[] = [];
    for (const shape of shapes) {
      if (registeredProxyShapes.has(shape)) continue;
      const resolver = buildProxyResolver(shape);
      // Cast: the proxy resolve fn uses a loose Record-typed context for
      // forward-compat with engine context shape evolution. The runtime
      // Resolver interface in ias-executor-ts is structurally compatible.
      host.runtime.resolvers.register(resolver as unknown as Parameters<typeof host.runtime.resolvers.register>[0]);
      host.runtime.resolvers.register({ ...resolver, id: `development-vessel:${shape}` } as unknown as Parameters<typeof host.runtime.resolvers.register>[0]);
      registeredProxyShapes.add(shape);
      added.push(shape);
    }

    if (added.length > 0) {
      console.log(
        `[goal-host-vessel] proxy registration: +${added.length} new shapes ` +
          `(now ${registeredProxyShapes.size} total) — ${added.slice(0, 5).join(", ")}` +
          (added.length > 5 ? `, ...` : ""),
      );
    }
    return { added, total: registeredProxyShapes.size };
  } catch (err) {
    console.warn(`[goal-host-vessel] failed to register dev-vessel proxies: ${(err as Error).message}`);
    return { added: [], total: registeredProxyShapes.size };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reactive vessel-registration subscriber (openspec proxy-resolver-reactive-registration)
//
// Subscribes to activity-api's WS bus and listens for `vessel.registered` events.
// When the dev-vessel re-registers (after restart, or for the first time when
// goal-host beat it to startup), triggers a debounced re-fetch + diff-and-register
// of dev-vessel proxy resolvers. This is the architectural antidote to F-129.
// ─────────────────────────────────────────────────────────────────────────────

const DEV_VESSEL_ID_PATTERN = /^development-vessel(-|$)/;
const REGISTRATION_DEBOUNCE_MS = 500;
let registrationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let busWsClient: WebSocket | null = null;
let busReconnectDelay = 1_000;
const BUS_RECONNECT_MAX_DELAY = 30_000;

function startVesselRegistrationSubscriber(): void {
  // Convert http://... to ws://... for the WS endpoint
  const wsEndpoint = ACTIVITY_API_ENDPOINT.replace(/^http/, "ws") + "/ws";

  function connect(): void {
    try {
      busWsClient = new WebSocket(wsEndpoint);
    } catch (err) {
      console.warn(`[goal-host-vessel] WS subscriber connect failed: ${(err as Error).message}`);
      scheduleReconnect();
      return;
    }

    busWsClient.addEventListener("open", () => {
      busReconnectDelay = 1_000; // reset backoff
      busWsClient?.send(JSON.stringify({ type: "authenticate", token: API_KEY }));
      // Catch-up: registrations could have happened while we were disconnected.
      // Re-run the diff-and-register once on reconnect.
      void registerDevVesselProxies();
    });

    busWsClient.addEventListener("message", (e: MessageEvent) => {
      try {
        const msg = JSON.parse(typeof e.data === "string" ? e.data : e.data.toString());
        if (msg?.type !== "vessel.registered") return;
        const vesselId = msg.data?.vessel_id;
        if (typeof vesselId !== "string" || !DEV_VESSEL_ID_PATTERN.test(vesselId)) return;
        // Debounce: coalesce rapid re-registrations into one re-fetch.
        if (registrationDebounceTimer) clearTimeout(registrationDebounceTimer);
        registrationDebounceTimer = setTimeout(() => {
          registrationDebounceTimer = null;
          void registerDevVesselProxies();
        }, REGISTRATION_DEBOUNCE_MS);
      } catch {
        // ignore unparseable / non-event frames
      }
    });

    busWsClient.addEventListener("close", () => {
      scheduleReconnect();
    });

    busWsClient.addEventListener("error", () => {
      // Errors will also trigger close; let close handle reconnect.
    });
  }

  function scheduleReconnect(): void {
    busWsClient = null;
    setTimeout(connect, busReconnectDelay);
    busReconnectDelay = Math.min(busReconnectDelay * 2, BUS_RECONNECT_MAX_DELAY);
  }

  connect();
  console.log(`[goal-host-vessel] vessel-registration subscriber started → ${wsEndpoint}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery registration loop
// ─────────────────────────────────────────────────────────────────────────────

const discoveryLoop = new DiscoveryRegistrationLoop({
  discoveryEndpoint: DISCOVERY_ENDPOINT,
  vesselId: VESSEL_ID,
  vesselName: "Goal Host Vessel",
  shapes: [...SHAPES],
  resolveEndpoint: `http://127.0.0.1:${PORT}/resolve`,
  apiKey: API_KEY,
  port: PORT,
  systemVessel: true,
});

discoveryLoop.onUnhealthy(() => {
  console.warn(`[goal-host-vessel] discovery heartbeat failed 3×; vessel may be unreachable`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Request helpers
// ─────────────────────────────────────────────────────────────────────────────

async function handleRunGoal(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (typeof parsed !== "object" || parsed === null) throw new Error("body must be an object");
    body = parsed as Record<string, unknown>;
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const goal = typeof body.goal === "string" ? body.goal : undefined;
  const targetTemplateId = typeof body.targetTemplateId === "string" ? body.targetTemplateId : undefined;
  const variables = typeof body.variables === "object" && body.variables !== null
    ? (body.variables as Record<string, unknown>)
    : {};
  const tags = Array.isArray(body.tags) ? (body.tags as string[]) : undefined;
  const expectedOutputShapes = Array.isArray(body.expected_output_shapes)
    ? (body.expected_output_shapes as string[]).filter((s) => typeof s === "string")
    : undefined;
  const parentExecutionId = typeof body.parent_execution_id === "string"
    ? body.parent_execution_id
    : undefined;
  const compositionChain = Array.isArray(body.composition_chain)
    ? (body.composition_chain as string[])
    : [];

  if (!goal && !targetTemplateId) {
    return Response.json({ error: "goal or targetTemplateId is required" }, { status: 400 });
  }

  // D3 guard: cross-vessel invocations must carry parent_execution_id.
  const callerVessel = req.headers.get("x-caller-vessel");
  if (callerVessel && !parentExecutionId) {
    return Response.json(
      { error: "parent_execution_id required for cross-vessel goal dispatch (D3)" },
      { status: 400 },
    );
  }

  // Async dispatch: return 202+dispatchId immediately so the caller is not
  // subject to Bun's built-in 300s connection timeout. The caller polls
  // GET /executions/:dispatchId for the outcome.
  const dispatchId = crypto.randomUUID();
  pruneStore();
  const record: DispatchRecord = { dispatchId, startedAt: Date.now(), status: "running" };
  executionStore.set(dispatchId, record);

  host.runGoal(goal ?? `execute template ${targetTemplateId}`, {
    variables,
    targetTemplateId,
    tags,
    parentExecutionId,
    compositionChain,
    expectedOutputShapes,
  }).then((result) => {
    record.status = result.trace.status === "failed" ? "failed" : "completed";
    record.executionId = result.trace.id;
    record.selectedTemplateId = result.selectedTemplateId;
  }).catch((err: unknown) => {
    record.status = "failed";
    record.error = (err as Error).message;
    console.error("[goal-host-vessel] async /run-goal error:", err);
  });

  return Response.json({ dispatchId, status: "running" }, { status: 202 });
}

async function handleResolve(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (typeof parsed !== "object" || parsed === null) throw new Error("body must be an object");
    body = parsed as Record<string, unknown>;
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  // Support both direct { type, goal, ... } and impulse-wrapper { impulse: { pointer: { type } } }.
  const type = (body.type as string | undefined) ??
    ((body.impulse as Record<string, unknown> | undefined)?.pointer as Record<string, unknown> | undefined)?.type as string | undefined;

  if (type !== "goal_execution" && type !== "activity_execution") {
    return Response.json(
      { error: `unknown shape '${type}'; supported: goal_execution, activity_execution` },
      { status: 404 },
    );
  }

  const goal = typeof body.goal === "string" ? body.goal : undefined;
  const targetTemplateId = typeof body.target_template_id === "string"
    ? body.target_template_id
    : undefined;
  const variables = typeof body.variables === "object" && body.variables !== null
    ? (body.variables as Record<string, unknown>)
    : {};
  const parentExecutionId = typeof body.parent_execution_id === "string"
    ? body.parent_execution_id
    : undefined;
  const compositionChain = Array.isArray(body.composition_chain)
    ? (body.composition_chain as string[])
    : [];

  if (!goal && !targetTemplateId) {
    return Response.json({ error: "goal or target_template_id is required" }, { status: 400 });
  }

  try {
    const result = await host.runGoal(goal ?? `execute template ${targetTemplateId}`, {
      variables,
      targetTemplateId,
      parentExecutionId,
      compositionChain,
    });
    return Response.json({
      resolved: true,
      shape: type === "goal_execution" ? "goalExecution" : "activityExecution",
      executionId: result.trace.id,
      status: result.trace.status,
      selectedTemplateId: result.selectedTemplateId,
    });
  } catch (err) {
    console.error("[goal-host-vessel] /resolve error:", err);
    return Response.json(
      { resolved: false, shape: type, error: (err as Error).message },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Async dispatch store — fire-and-forget execution with polling
//
// Bun's built-in fetch() has a 300s connection timeout that cannot be overridden
// via AbortSignal (Bun 1.3.14 caps it). Goals that take >5min cause boredom-vessel
// to see a connection failure even though goal-host-vessel is still executing.
//
// Solution: POST /run-goal returns 202+dispatchId immediately; the goal runs async;
// GET /executions/:dispatchId lets callers poll for completion. Boredom-vessel
// polls for up to ~270s then exits (systemd restarts it); the goal continues async.
// ─────────────────────────────────────────────────────────────────────────────

interface DispatchRecord {
  dispatchId: string;
  startedAt: number;
  status: "running" | "completed" | "failed";
  executionId?: string;
  selectedTemplateId?: string;
  error?: string;
}

// Cap store at 100 records to prevent unbounded growth across long uptime.
const executionStore = new Map<string, DispatchRecord>();
function pruneStore(): void {
  if (executionStore.size > 100) {
    const oldest = [...executionStore.entries()].sort((a, b) => a[1].startedAt - b[1].startedAt);
    for (const [id] of oldest.slice(0, 20)) executionStore.delete(id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        vesselId: VESSEL_ID,
        vesselName: "Goal Host Vessel",
        shapes: SHAPES,
        version: VERSION,
        llm: LLM_VESSEL_ENDPOINT ? `http-vessel:${LLM_VESSEL_ENDPOINT}` : "in-process",
      });
    }

    if (req.method === "POST" && url.pathname === "/run-goal") {
      return handleRunGoal(req);
    }

    if (req.method === "GET" && url.pathname.startsWith("/executions/")) {
      const dispatchId = url.pathname.slice("/executions/".length);
      const record = executionStore.get(dispatchId);
      if (!record) return Response.json({ error: "dispatch not found" }, { status: 404 });
      return Response.json({
        dispatchId: record.dispatchId,
        status: record.status,
        executionId: record.executionId,
        selectedTemplateId: record.selectedTemplateId,
        error: record.error,
      });
    }

    if (req.method === "POST" && url.pathname === "/resolve") {
      return handleResolve(req);
    }

    return new Response("Not Found", { status: 404 });
  },
  error(err) {
    console.error("[goal-host-vessel] unhandled error:", err);
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(
  `[goal-host-vessel] started on port ${PORT}` +
  ` | activity-api: ${ACTIVITY_API_ENDPOINT}` +
  ` | discovery: ${DISCOVERY_ENDPOINT}` +
  ` | llm: ${LLM_VESSEL_ENDPOINT ? `vessel(${LLM_VESSEL_ENDPOINT})` : "in-process"}`,
);

registerBuiltinResolvers();
await registerDevVesselProxies();
// Reactive proxy registration: subscribe to vessel.registered events on the bus
// so we re-fetch /shapes when dev-vessel (re)registers, regardless of whether
// goal-host or dev-vessel booted first. Dissolves F-129.
startVesselRegistrationSubscriber();
await discoveryLoop.start();

// Graceful shutdown on SIGTERM.
process.on("SIGTERM", async () => {
  await discoveryLoop.stop();
  server.stop(true);
  console.log("[goal-host-vessel] stopped");
  process.exit(0);
});
