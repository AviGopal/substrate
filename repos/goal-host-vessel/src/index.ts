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
import { BusForwardingEventSink } from "@avigopal/ias-executor-ts/adapters";
import type { EventSink } from "@avigopal/ias-executor-ts";

// ─────────────────────────────────────────────────────────────────────────────
// BoundedBusSink — L1 patch per openspec 2026-05-31-goal-host-oom-bounded-concurrency.
//
// Wraps BusForwardingEventSink (whose forward() is fire-and-forget `void (async
// () => { await fetch(...) })()`). Each unawaited Promise retains the event
// body string in memory until the HTTP POST resolves. When activity-api is slow
// or the engine emits hundreds of events per execution, in-flight Promises
// accumulate unboundedly — the observed cascade: ~10 GB RSS in ~3 minutes,
// repeated SIGKILL by systemd.
//
// This wrapper enforces:
//   - In-memory FIFO queue capped at QUEUE_MAX (100). Drop-oldest at overflow.
//   - Worker drain capped at MAX_INFLIGHT (default 32, env BUS_MAX_INFLIGHT).
//   - Total in-flight body bytes capped at MAX_INFLIGHT_BYTES (default 50 MB,
//     env BUS_MAX_INFLIGHT_BYTES). Events skipped when over the cap.
//   - Periodic stats line every 30 s: in_flight, dropped_since_last, bytes.
//   - Drops never throw; logged only. The inner sink is still called
//     synchronously on every emit so in-process subscribers are unaffected.
//
// Doubles as Phase 2 instrumentation: the stats line lets us observe whether
// in_flight grows monotonically (confirming hypothesis #1) or plateaus
// (backpressure working).
// ─────────────────────────────────────────────────────────────────────────────

const BUS_MAX_INFLIGHT = parseInt(process.env.BUS_MAX_INFLIGHT ?? "32", 10);
const BUS_MAX_INFLIGHT_BYTES = parseInt(
  process.env.BUS_MAX_INFLIGHT_BYTES ?? String(50 * 1024 * 1024),
  10,
);
const BUS_QUEUE_MAX = 100;
const BUS_STATS_INTERVAL_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// L2 instrumentation — process.memoryUsage() trajectory probe
//
// Hypothesis #1 (Promise queue in BusForwardingEventSink) was REFUTED by L1
// stats showing in_flight=0 across the pre-OOM window while RSS grew 0→10 GB.
// Signature is event-loop starvation (stats stopped at ~1.6 GB).
//
// This module:
//   - Captures process.memoryUsage() into a circular ring (MEM_RING_SIZE=512)
//   - Records on every WS message arrival (cheapest signal density), every
//     BoundedBusSink emit, and at a 5s interval
//   - Dumps ring → /workspace/.goal-host-mem-dump.json every 5s (survives OOM)
//   - Re-dumps + flushes on SIGTERM (so post-mortem catches the last moments
//     before systemd's SIGKILL escalation)
//
// What each region tells us:
//   - heapUsed grows: JS object retention (listener closures, parsed event objs)
//   - external grows: C++-backed Buffers / WS frames not released
//   - arrayBuffers grows: raw byte arrays (likely WS frame payloads)
//   - rss grows but heap/external/arrayBuffers flat: V8 fragmentation / native
//     allocator (less likely under Bun)
// ─────────────────────────────────────────────────────────────────────────────

const MEM_RING_SIZE = 512;
const MEM_DUMP_PATH = process.env.MEM_DUMP_PATH ?? "/workspace/.goal-host-mem-dump.json";
const MEM_DUMP_INTERVAL_MS = 5_000;

interface MemSample {
  t: number;             // ms since epoch
  source: string;        // "ws" | "bus" | "tick"
  msgSize?: number;      // bytes of triggering WS payload, if any
  msgType?: string;      // type field of WS event, if any
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

const memRing: MemSample[] = [];
let memRingHead = 0;
let biggestMsg: { size: number; type: string; at: number } = { size: 0, type: "", at: 0 };

function recordMemSample(source: string, msgSize?: number, msgType?: string): void {
  const mu = process.memoryUsage();
  const sample: MemSample = {
    t: Date.now(),
    source,
    msgSize,
    msgType,
    rss: mu.rss,
    heapUsed: mu.heapUsed,
    heapTotal: mu.heapTotal,
    external: mu.external,
    arrayBuffers: mu.arrayBuffers,
  };
  if (memRing.length < MEM_RING_SIZE) {
    memRing.push(sample);
  } else {
    memRing[memRingHead] = sample;
    memRingHead = (memRingHead + 1) % MEM_RING_SIZE;
  }
  if (msgSize !== undefined && msgSize > biggestMsg.size) {
    biggestMsg = { size: msgSize, type: msgType ?? "?", at: sample.t };
  }
}

async function flushMemDump(reason: string): Promise<void> {
  try {
    // Order ring oldest-first when wrapped.
    const ordered = memRing.length < MEM_RING_SIZE
      ? memRing.slice()
      : memRing.slice(memRingHead).concat(memRing.slice(0, memRingHead));
    const payload = {
      generated_at: new Date().toISOString(),
      reason,
      pid: process.pid,
      uptime_s: process.uptime(),
      samples: ordered,
      biggest_msg: biggestMsg,
      env: {
        BUS_MAX_INFLIGHT,
        BUS_MAX_INFLIGHT_BYTES,
      },
    };
    await Bun.write(MEM_DUMP_PATH, JSON.stringify(payload));
  } catch (err) {
    // Never let dump failures kill the process — they're observability, not load-bearing.
    console.warn(`[mem-probe] dump failed: ${(err as Error).message}`);
  }
}

setInterval(() => {
  recordMemSample("tick");
  void flushMemDump("interval");
}, MEM_DUMP_INTERVAL_MS).unref();

setInterval(() => {
  const mu = process.memoryUsage();
  console.log(
    `[mem-probe] rss=${(mu.rss / 1024 / 1024).toFixed(1)}MB ` +
      `heapUsed=${(mu.heapUsed / 1024 / 1024).toFixed(1)}MB ` +
      `external=${(mu.external / 1024 / 1024).toFixed(1)}MB ` +
      `arrayBuffers=${(mu.arrayBuffers / 1024 / 1024).toFixed(1)}MB ` +
      `biggest_msg=${(biggestMsg.size / 1024).toFixed(1)}KB(${biggestMsg.type})`,
  );
}, BUS_STATS_INTERVAL_MS).unref();

process.on("SIGTERM", () => { void flushMemDump("SIGTERM"); });
process.on("SIGINT", () => { void flushMemDump("SIGINT"); });

// ─────────────────────────────────────────────────────────────────────────────
// Iteration 6 of the OOM hunt — periodic Bun.gc(true) workaround.
//
// Per iteration-5 findings (see concept_s9ye5GKLw2L8 / concept_T-CTTOEl97IM):
// goal-host RSS grew 16.6 → 18.4 GB in 60s of IDLE time (boredom timer
// inactive, no inbound requests). Map count slightly DECREASED while RSS
// increased. This signature is heap-arena retention by Bun's native allocator
// — memory is freed at the JS level but not released back to the OS until a
// full GC + arena trim runs.
//
// process.memoryUsage().heapUsed stayed at ~2 MB throughout (V8/JSC's
// accounting doesn't see arena retention). The cause survived all of:
//   - BoundedBusSink bus-path backpressure (iter 1)
//   - WS message buffer audit (iter 2)
//   - Response.body drain across 11 fetch sites (iter 3)
//   - AbortSignal.timeout → manual AbortController + clearTimeout (iter 4)
//   - BunProcessAdapter pipe FD investigation (iter 5 — refuted by location)
//
// Pragmatic workaround: force a full GC every 30s. Bun.gc(true) performs
// generational + major mark-sweep AND releases freed allocator pages back to
// the OS. If the leak is heap-arena retention, this bounds RSS.
//
// This is a workaround, not a root-cause fix. The underlying issue is in
// Bun 1.3.14's native allocator behavior under high-frequency idle-time
// fetch/WS load. A proper fix requires either upstream Bun work OR
// identifying the specific allocation site through per-fetch instrumentation
// (deferred to iter 7 once substrate is stable enough to probe).
//
// .unref() so this timer doesn't prevent process exit.
// ─────────────────────────────────────────────────────────────────────────────
// Iteration 7 instrumentation — per-fetch RSS delta probe.
//
// If iter-6's Bun.gc(true) workaround doesn't bound RSS, this gives us the
// exact leaking fetch site. Wraps globalThis.fetch with a labeled probe that
// records pre/post process.memoryUsage().rss per call. Aggregates by label
// over a 60s window, dumped to /workspace/.fetch-trace.json on every gc tick.
//
// The label is passed via an `x-fetch-label` header that THIS wrapper strips
// before calling the real fetch. Existing fetch sites unchanged; new sites
// can pass the label to attribute their leak. Sites that don't pass a label
// get attributed to their request URL host.
//
// Gated on env GOAL_HOST_FETCH_PROBE=1 so it's opt-in (the probe itself adds
// overhead). Default OFF; enable when iter-6's GC workaround fails the
// 30-min observation.
const FETCH_PROBE_ENABLED = process.env.GOAL_HOST_FETCH_PROBE === "1";
interface FetchProbeStats {
  count: number;
  total_rss_delta: number;
  max_rss_delta: number;
  total_duration_ms: number;
}
const fetchProbeStats = new Map<string, FetchProbeStats>();
if (FETCH_PROBE_ENABLED) {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let label: string | undefined;
    let cleanInit = init;
    if (init?.headers) {
      const headers = new Headers(init.headers);
      const labelValue = headers.get("x-fetch-label");
      if (labelValue) {
        label = labelValue;
        headers.delete("x-fetch-label");
        cleanInit = { ...init, headers };
      }
    }
    if (!label) {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        label = `auto:${new URL(url).host}`;
      } catch {
        label = "auto:unknown";
      }
    }
    const rssBefore = process.memoryUsage().rss;
    const t0 = performance.now();
    try {
      return await realFetch(input, cleanInit);
    } finally {
      const rssAfter = process.memoryUsage().rss;
      const duration = performance.now() - t0;
      const delta = rssAfter - rssBefore;
      const cur = fetchProbeStats.get(label) ?? {
        count: 0, total_rss_delta: 0, max_rss_delta: 0, total_duration_ms: 0,
      };
      cur.count += 1;
      cur.total_rss_delta += delta;
      cur.max_rss_delta = Math.max(cur.max_rss_delta, delta);
      cur.total_duration_ms += duration;
      fetchProbeStats.set(label, cur);
    }
  }) as typeof globalThis.fetch;
  console.log("[fetch-probe] instrumented globalThis.fetch (label via x-fetch-label header)");
}

function flushFetchProbeStats(): void {
  if (!FETCH_PROBE_ENABLED || fetchProbeStats.size === 0) return;
  const entries = Array.from(fetchProbeStats.entries())
    .map(([label, s]) => ({
      label,
      count: s.count,
      total_rss_delta_mb: +(s.total_rss_delta / 1024 / 1024).toFixed(2),
      max_rss_delta_mb: +(s.max_rss_delta / 1024 / 1024).toFixed(2),
      mean_rss_delta_kb: +(s.total_rss_delta / s.count / 1024).toFixed(1),
      mean_duration_ms: +(s.total_duration_ms / s.count).toFixed(1),
    }))
    .sort((a, b) => b.total_rss_delta_mb - a.total_rss_delta_mb);
  console.log(`[fetch-probe] ${JSON.stringify(entries.slice(0, 10))}`);
  fetchProbeStats.clear();
}

const GC_INTERVAL_MS = parseInt(process.env.GOAL_HOST_GC_INTERVAL_MS ?? "30000", 10);
interface BunGlobal { Bun?: { gc?: (force: boolean) => number } }
const bunGlobal = globalThis as unknown as BunGlobal;
setInterval(() => {
  const gc = bunGlobal.Bun?.gc;
  if (typeof gc === "function") {
    try {
      const freed = gc(true);
      const rssMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
      console.log(`[gc-tick] freed=${freed}B rss_after=${rssMB}MB`);
    } catch (err) {
      console.warn(`[gc-tick] Bun.gc failed: ${(err as Error).message}`);
    }
  }
  flushFetchProbeStats();
}, GC_INTERVAL_MS).unref();

class BoundedBusSink implements EventSink {
  private readonly inner: BusForwardingEventSink;
  private readonly queue: Array<{ event: unknown; bytes: number }> = [];
  private inFlight = 0;
  private bytesInFlight = 0;
  private droppedSinceLastStats = 0;
  private droppedQueueOverflow = 0;
  private droppedByteCap = 0;

  constructor(opts: { inner: BusForwardingEventSink }) {
    this.inner = opts.inner;
    setInterval(() => this.emitStats(), BUS_STATS_INTERVAL_MS).unref();
  }

  emit(event: unknown): void | Promise<void> {
    // Inner sink: BusForwardingEventSink.emit() calls its own inner sink
    // (the noop) and then schedules its fire-and-forget forward(). We can't
    // call its emit directly without re-triggering the unbounded queue. So
    // we replicate the noop-inner contract here and only forward via OUR
    // bounded queue. The inner BusForwardingEventSink's outageLogged state
    // is still used by the actual forwardOnce.
    let bytes = 0;
    try {
      bytes = JSON.stringify(event).length;
    } catch {
      bytes = 0;
    }
    this.enqueue({ event, bytes });
    this.drain();
  }

  private enqueue(item: { event: unknown; bytes: number }): void {
    if (this.queue.length >= BUS_QUEUE_MAX) {
      this.queue.shift(); // drop oldest
      this.droppedQueueOverflow += 1;
      this.droppedSinceLastStats += 1;
    }
    this.queue.push(item);
  }

  private drain(): void {
    while (
      this.queue.length > 0 &&
      this.inFlight < BUS_MAX_INFLIGHT &&
      this.bytesInFlight < BUS_MAX_INFLIGHT_BYTES
    ) {
      const item = this.queue.shift();
      if (!item) break;
      // Skip if this single event would push us way over the byte cap and
      // we already have something in flight — let the queue clear first.
      if (this.bytesInFlight > 0 && this.bytesInFlight + item.bytes > BUS_MAX_INFLIGHT_BYTES) {
        this.droppedByteCap += 1;
        this.droppedSinceLastStats += 1;
        continue;
      }
      this.inFlight += 1;
      this.bytesInFlight += item.bytes;
      void this.forwardOne(item);
    }
  }

  private async forwardOne(item: { event: unknown; bytes: number }): Promise<void> {
    try {
      // Reuse the inner sink's emit() — it does inner-noop + fire-and-forget
      // forward. We are calling it ONE event at a time, paced by our gate.
      // Because BusForwardingEventSink.forward() is itself void-async, we
      // await a setTimeout to give it a chance to complete the fetch before
      // we release our slot. We use a probe: call emit, then wait the
      // publishTimeoutMs (default 2s) before decrementing. This is coarse
      // but safe — the goal is bounded concurrency, not precise tracking.
      const maybePromise = this.inner.emit(item.event as Parameters<EventSink["emit"]>[0]);
      if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
        await maybePromise;
      }
      // Inner emit returns immediately after scheduling its fire-and-forget
      // forward. Wait the publish timeout window so the in-flight slot
      // actually models the HTTP work.
      await new Promise((r) => setTimeout(r, 2_500));
    } catch {
      // Inner emit shouldn't throw because its inner is noop and forward is
      // void; swallow defensively.
    } finally {
      this.inFlight -= 1;
      this.bytesInFlight -= item.bytes;
      if (this.bytesInFlight < 0) this.bytesInFlight = 0;
      // Pull more work in.
      this.drain();
    }
  }

  private emitStats(): void {
    console.log(
      `[BoundedBusSink] in_flight=${this.inFlight} queue=${this.queue.length} ` +
        `bytes_in_flight=${this.bytesInFlight} ` +
        `dropped_since_last=${this.droppedSinceLastStats} ` +
        `(overflow=${this.droppedQueueOverflow} byte_cap=${this.droppedByteCap})`,
    );
    this.droppedSinceLastStats = 0;
  }
}

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
// Proxy resolver timeout (ms). Default 240s — must accommodate LLM-heavy
// dispatches (sonnet on ~45K-token inputs can take 90-180s) while staying
// under Bun's ~300s fetch cap. Override via GOAL_HOST_PROXY_TIMEOUT_MS.
const PROXY_TIMEOUT_MS = parseInt(process.env.GOAL_HOST_PROXY_TIMEOUT_MS ?? "240000", 10);

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

// Inner event sink — default no-op (engine accepts undefined; default sink is
// the engine's internal noop). We wrap with BusForwardingEventSink so engine
// lifecycle events (lifecycle:task:preBinding, lifecycle:execution:succeeded,
// lifecycle:gap:classified, lifecycle:llm:dispatched) flow onto activity-api's
// WS bus via POST /v2/events/publish. Per openspec change
// 2026-05-27-neutral-emitter-lifecycle-bus, task 2.
//
// The forwarder is fire-and-forget: HTTP publish failures never block engine
// progression. Subscribers receive events with type mapped to the bus form
// (replace `:` with `.`, camelCase → snake_case).
const noopInnerSink = { emit: () => {} };
const busSink = new BusForwardingEventSink({
  inner: noopInnerSink,
  activityApiEndpoint: ACTIVITY_API_ENDPOINT,
  apiKey: API_KEY,
  sourceVesselId: "goal-host-vessel",
});

const boundedSink = new BoundedBusSink({ inner: busSink });

// ITER-4 DIAGNOSTIC: NoOp binary isolation. If GOAL_HOST_NOOP_SINK=1, bypass
// BusForwardingEventSink + BoundedBusSink entirely. Pure in-process noop. If
// cgroup stays bounded under boredom load, the leak source is the bus path
// (BusForwardingEventSink HTTP fetch / AbortSignal.timeout / response body).
// If cgroup still grows, the bus path is innocent and the leak is elsewhere
// (proxy resolver fetches, runtime internals, activity-api recommend).
const pureNoOpSink = { emit: () => {} };
const useNoOpSink = process.env.GOAL_HOST_NOOP_SINK === "1";
if (useNoOpSink) {
  console.log("[goal-host-vessel] ITER-4 DIAG: pure NoOp sink active (bus path disabled)");
}

// Iteration 10 — lifecycle subscriber ablation.
//
// Single-dispatch isolation test revealed: a single-task immunity-pattern
// template (detect-precondition-rejection) caused 37 MB → 2.7 GB in 30s
// (~90 MB/sec growth). Iter-8 fixed the idle-WS leak; iter-10 addresses
// the dispatch-path leak which is distinct.
//
// Hypothesis: every task.completed event fires the validator-dispatch
// subscriber template (a 5-task LLM-using activity). Iter-3
// (concept_KAQEz-Xq5FwT) made dispatchSubscribers use void-async so they
// don't block the parent, BUT it didn't bound concurrency. With each
// validator-dispatch execution emitting 5 more task.completed events,
// the recursive cascade is unbounded.
//
// Gated on GOAL_HOST_DISABLE_SUBSCRIBERS env. Default OFF (subscribers
// enabled — preserve original behavior). Set =1 to pass empty
// subscriberTemplates to GoalHost, disabling lifecycle dispatch entirely.
//
// When disabled, we lose:
//   - validator-dispatch (per-task validation against rules + LLM judge)
//   - slot-binding (impulse-pool pre-binding by shape)
//   - audit-test-report and other registered subscribers
// But we gain stability. Until a durable bounded-subscriber-dispatch is
// shipped in ias-executor-ts, this ablation is the operational workaround.
const DISABLE_SUBSCRIBERS = process.env.GOAL_HOST_DISABLE_SUBSCRIBERS === "1";
if (DISABLE_SUBSCRIBERS) {
  console.log("[startup] Lifecycle subscribers DISABLED via GOAL_HOST_DISABLE_SUBSCRIBERS=1 (iter-10 ablation)");
}

const host = new GoalHost({
  llm,
  activityApiEndpoint: ACTIVITY_API_ENDPOINT,
  apiKey: API_KEY,
  discoveryEndpoint: DISCOVERY_ENDPOINT,
  enableAgentFill: true,
  eventSink: (useNoOpSink ? pureNoOpSink : boundedSink) as unknown as typeof busSink,
  ...(DISABLE_SUBSCRIBERS ? { subscriberTemplates: [] } : {}),
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

      // ITER-4 fix: manual timer cleanup + body drain.
      const recCtrl = new AbortController();
      const recTimer = setTimeout(() => recCtrl.abort(), 15_000);
      try {
        const resp = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/recommend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
          },
          body: JSON.stringify(body),
          signal: recCtrl.signal,
        });
        clearTimeout(recTimer);
        const result = await resp.json();
        try { await resp.body?.cancel(); } catch { /* swallow */ }
        return [{
          id: random.id("activity_rec"),
          pointer: { type: "memo" },
          metadata: { shape: "activityTemplateRecommendation", source: "activity-api", ok: resp.ok },
          loaded: true,
          content: result,
        }];
      } catch (err) {
        clearTimeout(recTimer);
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

/**
 * Interpolate {{var}} and {{a.b}} placeholders in a value. Mirrors the
 * semantics in resolvers/llm-prompt.ts (the engine's llm path interpolates,
 * but proxy resolvers in this file bypass that — so register_variant tasks
 * with config like `{template: "{{draft_via_llm_text}}"}` were forwarding
 * the literal placeholder to dev-vessel, which then rejected on parse, which
 * proxy treated as success because activity_create_variant returns a
 * structuredError without `failure_mode` field. Triple silent failure.
 *
 * Handles strings, arrays, and plain objects recursively. Unresolved
 * placeholders remain literal (matches llm-prompt behavior).
 */
function interpolateProxyValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{([\w]+(?:\.[\w]+)*)\}\}/g, (match, path: string) => {
      const segs = path.split(".");
      let cur: unknown = variables;
      for (const seg of segs) {
        if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[seg];
        } else {
          return match; // unresolved → leave literal
        }
      }
      if (cur === undefined || cur === null) return match;
      if (typeof cur === "string") return cur;
      if (typeof cur === "number" || typeof cur === "boolean") return String(cur);
      try { return JSON.stringify(cur); } catch { return match; }
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolateProxyValue(v, variables));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateProxyValue(v, variables);
    }
    return out;
  }
  return value;
}

function buildProxyResolver(shape: string) {
  return {
    id: shape,
    tier: "pattern" as const,
    async resolve(context: Record<string, unknown>) {
      const task = context.task as Record<string, unknown>;
      const configRaw = (task.config ?? {}) as Record<string, unknown>;
      const variables = (context.variables ?? {}) as Record<string, unknown>;
      const random = context.random as { id: (prefix: string) => string };
      // Interpolate {{var}} placeholders in task.config BEFORE building the pointer
      // so dev-vessel resolvers receive substituted values rather than literal
      // placeholder strings (which were causing silent failures in
      // register_variant — see comment on interpolateProxyValue).
      const config = interpolateProxyValue(configRaw, variables) as Record<string, unknown>;
      // Spread variables BEFORE config so the interpolated config wins on key
      // conflicts. Templates intentionally use variable names that match
      // config-key meanings inside the activity layer (e.g. target_branch
      // means "feature branch" to the activity but "PR base" to gh_pr_create's
      // config). If variables spread last, they shadow the config's
      // interpolated value, and the resolver sees the wrong field. Variables
      // remain available for resolvers whose pointer fields aren't explicit
      // in the task config — they just don't override an interpolated config.
      const pointer: Record<string, unknown> = { type: shape, ...variables, ...config };
      // ITER-4 fix: manual AbortController + clearTimeout instead of
      // AbortSignal.timeout — the implicit timer leaks native buffers. Also
      // drain response body explicitly via .cancel() since Bun retains the
      // readable stream mmap pages even after .text() consumes them.
      const proxyCtrl = new AbortController();
      const proxyTimer = setTimeout(() => proxyCtrl.abort(), PROXY_TIMEOUT_MS);
      let resp: Response;
      try {
        resp = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
          },
          body: JSON.stringify({ impulse: { pointer } }),
          signal: proxyCtrl.signal,
        });
      } finally {
        clearTimeout(proxyTimer);
      }
      try {
        const bodyText = await resp.text();
        try { await resp.body?.cancel(); } catch { /* swallow */ }
        let parsed: unknown;
        try { parsed = JSON.parse(bodyText); } catch { parsed = bodyText; }

        // Detect resolver-level failure even when HTTP returns 200. Dev-vessel's
        // /v2/impulses/resolve route wraps the resolver's ResolverResult as
        // { success: true, shape, body }. When the resolver itself produced a
        // failure-mode-tagged structuredError (e.g. URL invalid, downstream
        // 4xx, validation rejection), the body carries the signal but the HTTP
        // status is still 200. Without propagating this, every chained activity
        // (draft-gap-closing-activity, etc.) reports task=success on a silent
        // failure — the substrate has been swallowing real errors. Throw so
        // the engine records task.failure with the resolver's reason.
        if (!resp.ok) {
          throw new Error(`dev-vessel ${shape} HTTP ${resp.status}: ${bodyText.slice(0, 200)}`);
        }
        const parsedObj = (typeof parsed === "object" && parsed !== null) ? (parsed as Record<string, unknown>) : null;
        if (parsedObj) {
          const innerShape = parsedObj["shape"];
          const innerBody = parsedObj["body"] as Record<string, unknown> | undefined;
          // Any structuredError shape signals resolver-level failure — the
          // resolver explicitly chose this shape to indicate an error. The
          // earlier narrower guard (require failure_mode set) missed cases
          // like activity_create_variant 4xx responses which return
          // structuredError WITHOUT failure_mode. Treat all of them as task
          // failure so the substrate sees real signal instead of silent
          // swallowing.
          if (innerShape === "structuredError") {
            const reason = innerBody?.["failure_mode"]
              ? `failure_mode=${innerBody["failure_mode"]}`
              : `status=${innerBody?.["status"] ?? "n/a"}`;
            const detail = String(innerBody?.["detail"] ?? innerBody?.["error"] ?? "no detail");
            throw new Error(`dev-vessel ${shape} resolver returned structuredError (${reason}): ${detail.slice(0, 200)}`);
          }
        }

        // Unwrap the dev-vessel response envelope. Dev-vessel's /v2/impulses/resolve
        // wraps every resolver's ResolverResult as { success, shape, body }. The
        // outer wrapper is plumbing, not content — when subsequent tasks reference
        // {{<taskId>_text}}, they want body's content (e.g. body.text for llm,
        // body.variantId for activity_create_variant), not the wrapper object.
        // Without this unwrap, register_variant gets fed the entire envelope and
        // activity-api rejects on schema validation. Set impulse.content = body
        // when the wrapper shape is detected; else pass parsed through.
        let impulseContent: unknown = parsed;
        if (parsedObj && parsedObj["success"] === true && "body" in parsedObj) {
          const innerBody = parsedObj["body"];
          const innerShapeName = parsedObj["shape"];
          // For llm-completion-style results, the text is the canonical content
          // of the response. For other shapes, return the body object.
          if (innerBody && typeof innerBody === "object" && !Array.isArray(innerBody)) {
            const body = innerBody as Record<string, unknown>;
            if (innerShapeName === "llm_completion_result" && typeof body["text"] === "string") {
              // Strip markdown code fences that LLMs commonly wrap JSON in.
              let text = body["text"] as string;
              text = text.replace(/^```(?:json|JSON)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
              impulseContent = text;
            } else if (innerShapeName === "fileContent" && typeof body["content"] === "string") {
              // fs_read returns {shape:"fileContent", body:{content:"..."}}. Unwrap so
              // {{taskId_content}} gives the raw file string rather than the envelope object.
              impulseContent = body["content"];
            } else if (innerShapeName === "json_extracted_value") {
              // json_path_extract returns {valueJson, value, path}. Expose value directly.
              impulseContent = body["value"] ?? body["valueJson"] ?? innerBody;
            } else {
              impulseContent = innerBody;
            }
          } else {
            impulseContent = innerBody;
          }
        }

        return [{
          id: random.id(`dev:${shape}`),
          pointer: { type: "memo" },
          metadata: { shape, source: "development-vessel", ok: resp.ok },
          loaded: true,
          content: impulseContent,
        }];
      } catch (err) {
        // F13 fix (inv-084): re-throw so engine records success=false + β+=1.
        // Previously: returning a degraded impulse caused engine to record
        // success=true → Thompson α+=1 for every failed dev-vessel call.
        // This corrupted posteriors — drain cycles accumulated false-positive α
        // even when fs_write/llm_completion tasks consistently failed.
        // Re-throwing lets the engine task-catch handle it correctly.
        throw err;
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
  // ITER-4 fix: manual AbortController + clearTimeout + drain body.
  const shapesCtrl = new AbortController();
  const shapesTimer = setTimeout(() => shapesCtrl.abort(), 5_000);
  try {
    const r = await fetch(`${DEV_VESSEL_ENDPOINT}/shapes`, {
      signal: shapesCtrl.signal,
    });
    clearTimeout(shapesTimer);
    if (!r.ok) {
      try { await r.body?.cancel(); } catch { /* swallow */ }
      console.warn(`[goal-host-vessel] dev-vessel /shapes HTTP ${r.status} — proxy resolvers not registered yet`);
      return { added: [], total: registeredProxyShapes.size };
    }
    const body = await r.json() as { shapes?: string[] };
    try { await r.body?.cancel(); } catch { /* swallow */ }
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
    clearTimeout(shapesTimer);
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
      // L2 instrumentation: capture frame size BEFORE JSON.parse (cheap).
      // This tells us whether WS frame bytes correlate with memory growth.
      // We also do a substring sniff for "vessel.registered" before parsing —
      // if not present, skip parse entirely (hypothesis #2 fix option A).
      let rawSize = 0;
      let rawText: string | undefined;
      try {
        if (typeof e.data === "string") {
          rawSize = e.data.length;
          rawText = e.data;
        } else if (e.data && typeof (e.data as { byteLength?: number }).byteLength === "number") {
          rawSize = (e.data as { byteLength: number }).byteLength;
        }
      } catch { /* size sniff is best-effort */ }

      // FIX OPTION A: cheap substring guard before allocating parsed object.
      // Bus broadcasts task.completed, lifecycle.*, etc. all of which include
      // large impulse / LLM bodies. Only vessel.registered events trigger work.
      // If rawText is not a string (binary frame) we keep the prior behavior
      // to avoid silently dropping events of unknown shape.
      if (rawText !== undefined && !rawText.includes('"vessel.registered"')) {
        recordMemSample("ws", rawSize, "filtered");
        return;
      }

      try {
        const msg = JSON.parse(typeof e.data === "string" ? e.data : e.data.toString());
        recordMemSample("ws", rawSize, typeof msg?.type === "string" ? msg.type : "?");
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
    // L1.4: close stale socket before nulling reference so listener closures
    // (which capture busSink/host/etc) are eligible for GC. Previously the
    // bare `busWsClient = null` left old sockets retained by their listeners.
    if (busWsClient) {
      try { busWsClient.close(); } catch { /* already closed */ }
      busWsClient = null;
    }
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

  // Auto-draft fallback: when caller provides a free-form goal but no
  // targetTemplateId, pre-check activity-api /recommend. If top candidate
  // score is below SUBSTRATE_AUTO_DRAFT_THRESHOLD, the catalogue has no fit
  // — dispatch the drafter to author one before the original goal runs. The
  // result is substrate creating new capability AS A SIDE EFFECT of trying
  // to accomplish something operational. Async (run inside the dispatch
  // promise) so the immediate 202 response isn't delayed.
  const autoDraft = async (): Promise<void> => {
    if (process.env.SUBSTRATE_AUTO_DRAFT_ENABLED === "0") return;
    if (!goal || targetTemplateId) return;
    const threshold = parseFloat(process.env.SUBSTRATE_AUTO_DRAFT_THRESHOLD ?? "0.3");
    try {
      const preRec = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${process.env.METABOB_API_KEY ?? ""}`,
        },
        body: JSON.stringify({ task_description: goal, ...(expectedOutputShapes?.length ? { expected_output_shapes: expectedOutputShapes } : {}) }),
      });
      if (!preRec.ok) {
        const errText = await preRec.text().catch(() => "");
        console.warn(`[goal-host-vessel] auto-draft pre-recommend HTTP ${preRec.status}: ${errText.slice(0, 200)}`);
        return;
      }
      console.log(`[goal-host-vessel] auto-draft pre-recommend OK for goal="${(goal as string).slice(0, 60)}"`);
      const data = await preRec.json() as { recommendations?: Array<{ template_id: string; score?: number }> };
      const top = (data.recommendations ?? [])[0];
      const topScore = top?.score ?? 0;
      if (top && topScore >= threshold) return;
      console.log(`[goal-host-vessel] auto-draft trigger: goal="${(goal as string).slice(0, 80)}" top_score=${topScore} < ${threshold}`);
      const triggerStart = Date.now();
      const candidatesConsidered = (data.recommendations ?? []).slice(0, 5).map((r) => ({ id: r.template_id, score: r.score ?? 0 }));
      void emitAuthoringDecision("auto_draft_triggered",
        `top_score=${topScore} < threshold=${threshold} for goal: ${(goal as string).slice(0, 120)}`,
        {
          dispatchId,
          goal: (goal as string).slice(0, 200),
          topScore,
          thresholdValue: threshold,
          candidatesConsidered,
          stateSignatureHash: record.stateSignature?.signature_hash ?? null,
          timestamp: new Date().toISOString(),
        });
      // PRE-DRAFTER reuse lookup (LLM intent-match): before authoring a new
      // template, ask llm-resolver-vessel whether any prior gap-closing:auto-*
      // template would truly answer this goal. Replaces the earlier bag-of-
      // tokens overlap heuristic, which fired false positives whenever two
      // unrelated goals shared substrate-domain keywords (e.g. "substrate",
      // "vessel", "trace"). The LLM call is one-shot, low-cost (haiku,
      // max_tokens=10, no tools), 15s-bounded, and crash-safe — any error
      // falls through to drafter dispatch.
      if (process.env.SUBSTRATE_REUSE_LLM_ENABLED !== "0") {
        try {
          const reuseList = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/templates?limit=200`, {
            headers: { Authorization: `ApiKey ${process.env.METABOB_API_KEY ?? ""}` },
          });
          if (reuseList.ok) {
            const rl = await reuseList.json() as { templates?: Array<{ id: string; name?: string; description?: string; proposed?: boolean }> };
            const autoCands = (rl.templates ?? []).filter((t) => typeof t.id === "string" && /gap-closing:auto-/.test(t.id));
            // Rank by created_at unix-ms embedded as the second number in
            // `gap-closing:auto-<ts1>-<rand>-<ts2>`; fall back to first number.
            const idTs = (id: string): number => {
              const nums = id.match(/\d{10,}/g) ?? [];
              const parsed = nums.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
              return parsed.length > 1 ? parsed[1] : (parsed[0] ?? 0);
            };
            const topN = autoCands.sort((a, b) => idTs(b.id) - idTs(a.id)).slice(0, 5);
            if (topN.length > 0) {
              const listing = topN.map((t, i) => `${i + 1}. name: ${(t.name ?? "(unnamed)").slice(0, 120)}; description: ${(t.description ?? "(none)").slice(0, 240)}`).join("\n");
              const prompt = `Decide: REUSE existing template or AUTHOR new for this goal.\n\nGoal: ${goal}\n\nCandidates:\n${listing}\n\nPick the NUMBER of a candidate whose name/description is a near-paraphrase of the goal (same subject AND same artifact, just reworded).\nYES: goal "audit anomalous-duration dispatches" + candidate "Audit dispatches with anomalous duration" → match. Goal "show alpha by template" + candidate "Report alpha distribution per template" → match.\nNO: goal "Thompson alpha distribution" + candidate "Audit anomalous-duration dispatches" → NONE (different subject). Goal "stale promoted templates" + candidate "Audit anomalous-duration dispatches" → NONE.\nIf no candidate shares the goal's core subject, answer NONE.\n\nReply ONLY a digit (1-${topN.length}) or NONE.`;
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 15000);
              try {
                const llmRes = await fetch("http://127.0.0.1:8220/resolve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `ApiKey ${process.env.METABOB_API_KEY ?? ""}` },
                  body: JSON.stringify({ type: "llm_completion", prompt, model: "claude-haiku-4-5-20251001", max_tokens: 10 }),
                  signal: ctrl.signal,
                });
                clearTimeout(timer);
                if (llmRes.ok) {
                  const lr = await llmRes.json() as { resolved?: boolean; content?: string };
                  const ans = (lr.content ?? "").trim().match(/^\d+/)?.[0];
                  const idx = ans ? parseInt(ans, 10) : NaN;
                  if (Number.isFinite(idx) && idx >= 1 && idx <= topN.length) {
                    const picked = topN[idx - 1];
                    authoredTemplateId = picked.id;
                    console.log(`[goal-host-vessel] auto-draft REUSE (LLM): selected candidate ${idx} "${picked.name ?? picked.id}" for goal="${(goal as string).slice(0, 80)}"`);
                    void emitAuthoringDecision("auto_draft_reused",
                      `reused ${picked.id} (cand ${idx}/${topN.length}) for goal: ${(goal as string).slice(0, 120)}`,
                      {
                        dispatchId,
                        goal: (goal as string).slice(0, 200),
                        topScore,
                        thresholdValue: threshold,
                        candidatesConsidered: topN.map((t) => ({ id: t.id, name: t.name })),
                        selectedCandidateIdx: idx,
                        authoredTemplateId: picked.id,
                        durationMs: Date.now() - triggerStart,
                        stateSignatureHash: record.stateSignature?.signature_hash ?? null,
                        timestamp: new Date().toISOString(),
                      });
                    return;
                  }
                  console.log(`[goal-host-vessel] auto-draft REUSE (LLM): no candidate selected (raw="${(lr.content ?? "").trim().slice(0, 20)}"); proceeding to author`);
                }
              } catch (llmErr) {
                clearTimeout(timer);
                console.warn(`[goal-host-vessel] auto-draft reuse LLM call failed; falling through to author:`, llmErr instanceof Error ? llmErr.message : llmErr);
              }
            }
          }
        } catch (reuseErr) {
          console.warn(`[goal-host-vessel] auto-draft reuse lookup skipped:`, reuseErr instanceof Error ? reuseErr.message : reuseErr);
        }
      }
      const scenarioId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Drafter tasks 6/8 (extract_required_shapes + register_variant) require
      // expected_emergence.activity_signature.output_shapes_must_include to be
      // a non-empty array. Operator-curated fp-* scenarios always set this;
      // auto-synthesized scenarios previously omitted the field and json_path_extract
      // returned structuredError, halting the drafter chain after task 5. Synthesize
      // a placeholder shape derived from the scenario id so the chain advances
      // through proposal write + variant registration. The registered variant's
      // outputShapes is set by output_shapes_override using this value.
      const shortId = scenarioId.replace(/[^A-Za-z0-9]/g, "").slice(-8);
      const outputShapesMustInclude =
        Array.isArray(expectedOutputShapes) && expectedOutputShapes.length > 0
          ? expectedOutputShapes
          : [`autoDraftedOutput_${shortId}`];
      const scenario = {
        id: scenarioId,
        mode_class: "auto",
        stage: "synthesis",
        outcome_class: "gap",
        title: `Auto-synthesized gap: ${(goal as string).slice(0, 80)}`,
        description: `Goal-host /recommend returned top_score=${topScore} (< ${threshold}) for goal: "${goal}". Substrate catalogue has no fit. Auto-synthesized scenario so drafter can author a closing activity. This is the substrate creating new functionality as a side effect of trying to do something else (the operator's actual goal).`,
        goal_text: goal,
        expected_input_shapes: [],
        expected_output_shapes: expectedOutputShapes ?? [],
        cited_concepts: ["concept_9ldsmRgqSTd5"],
        auto_draft_for_dispatch: dispatchId,
        expected_emergence: {
          class: "new",
          activity_signature: {
            input_shapes_intersect: [],
            output_shapes_must_include: outputShapesMustInclude,
            tags_pattern: "substrate.auto.draft.*",
          },
          minimum_thompson_alpha: 1,
        },
      };
      const fsWriteBody = JSON.stringify({
        impulse: {
          pointer: {
            type: "fs_write",
            path: `/workspace/validation/failure-modes/scenarios/${scenarioId}.json`,
            content: JSON.stringify(scenario, null, 2),
          },
        },
      });
      await fetch("http://127.0.0.1:8090/v2/impulses/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${process.env.METABOB_API_KEY ?? ""}`,
        },
        body: fsWriteBody,
      });
      console.log(`[goal-host-vessel] auto-draft: scenario ${scenarioId}.json written; dispatching draft-gap-closing-activity`);
      try {
        await host.runGoal(`auto-draft for gap: ${(goal as string).slice(0, 60)}`, {
          targetTemplateId: "activity:⟨development-vessel:draft-gap-closing-activity⟩",
          variables: {
            scenario_id: scenarioId,
            report_path: `/workspace/validation/failure-modes/scenarios/${scenarioId}.json`,
            proposals_dir: "/workspace/proposals",
            scenarios_dir: "/workspace/validation/failure-modes/scenarios",
          },
          tags: ["substrate.auto.draft", `auto_draft_for_dispatch:${dispatchId}`],
        });
        console.log(`[goal-host-vessel] auto-draft: drafter completed for scenario ${scenarioId}`);
        // Find the just-authored template + promote it + capture its id so the
        // ORIGINAL goal runs against the substrate's freshly-authored capability
        // instead of falling back through recommend to a generic attractor.
        // Mitigation for the mode-collapse identified by the consistency batch
        // (validation/findings/substrate-consistency/2026-06-01T22-19-05Z-…).
        try {
          // FTS index lags template-create. List recent templates and
          // filter for the scenario_id substring in id — substrate-authored
          // templates have the pattern `gap-closing:<scenario_id>-<timestamp>`.
          const listRes = await fetch(
            `${ACTIVITY_API_ENDPOINT}/v2/activities/templates?limit=200`,
            { headers: { Authorization: `ApiKey ${process.env.METABOB_API_KEY ?? ""}` } },
          );
          if (listRes.ok) {
            const list = await listRes.json() as { templates?: Array<{ id: string }> };
            const authored = (list.templates ?? []).find((t) =>
              typeof t.id === "string" && t.id.includes(scenarioId)
            );
            if (authored?.id) {
              authoredTemplateId = authored.id;
              console.log(`[goal-host-vessel] auto-draft: authored ${authored.id}; promoting + overriding targetTemplateId`);
              await fetch(
                `${ACTIVITY_API_ENDPOINT}/v2/activities/templates/${encodeURIComponent(authored.id)}/promote`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `ApiKey ${process.env.METABOB_API_KEY ?? ""}`,
                    "Content-Type": "application/json",
                  },
                  body: "{}",
                },
              );
              void emitAuthoringDecision("auto_draft_authored",
                `authored + promoted ${authored.id} for goal: ${(goal as string).slice(0, 120)}`,
                {
                  dispatchId,
                  goal: (goal as string).slice(0, 200),
                  topScore,
                  thresholdValue: threshold,
                  scenarioId,
                  authoredTemplateId: authored.id,
                  selectedCandidateIdx: "NONE",
                  durationMs: Date.now() - triggerStart,
                  stateSignatureHash: record.stateSignature?.signature_hash ?? null,
                  timestamp: new Date().toISOString(),
                });
            }
          }
        } catch (promoteErr) {
          console.warn(`[goal-host-vessel] auto-draft: promote step skipped:`, promoteErr instanceof Error ? promoteErr.message : promoteErr);
        }
      } catch (drafterErr) {
        console.error(`[goal-host-vessel] auto-draft: drafter error:`, drafterErr);
      }
    } catch (recErr) {
      console.warn(`[goal-host-vessel] auto-draft skipped:`, recErr instanceof Error ? recErr.message : recErr);
    }
  };
  // Captured from autoDraft so main runGoal can use the freshly-authored
  // template instead of an unsuitable attractor.
  let authoredTemplateId: string | undefined;

  (async () => {
    try {
      // Compute state-space signature BEFORE dispatch so the trace records
      // the environment in which template selection happened. The hash is
      // appended to `tags` as `state_signature:<hash>`; the full body is
      // attached to the dispatch record for later inspection.
      const stateSignature = await computeStateSignature();
      record.stateSignature = stateSignature;
      const sigTag = stateSignature?.signature_hash
        ? [`state_signature:${stateSignature.signature_hash}`]
        : [];
      // Wire 1 (2026-06-03): propagate MITOSIS_VERSION_ID into the trace so
      // mitosis_evaluate can segment AET rows by version. When goal-host runs
      // as part of a mitosis-spawned vessel, the systemd unit injects
      // MITOSIS_VERSION_ID + MITOSIS_BASE_VESSEL. Surfaced as trace tags
      // (open schema) — keeps the change zero-API-surface while making the
      // version observable to the differential evaluator.
      const mitosisVersionId = process.env["MITOSIS_VERSION_ID"];
      const mitosisBaseVessel = process.env["MITOSIS_BASE_VESSEL"];
      const mitosisTags = mitosisVersionId
        ? [
            `mitosis_version_id:${mitosisVersionId}`,
            ...(mitosisBaseVessel ? [`mitosis_base_vessel:${mitosisBaseVessel}`] : []),
          ]
        : [];
      const effectiveTags = [...(tags ?? []), ...sigTag, ...mitosisTags];

      await autoDraft();
      const effectiveTargetId = targetTemplateId ?? authoredTemplateId;
      if (authoredTemplateId && !targetTemplateId) {
        console.log(`[goal-host-vessel] /run-goal: using auto-authored template ${authoredTemplateId} for goal`);
      }
      if (!effectiveTargetId && goal) {
        void emitAuthoringDecision("auto_draft_fallback_recommend",
          `no targetTemplateId; falling through to /recommend for goal: ${goal.slice(0, 120)}`,
          {
            dispatchId,
            goal: goal.slice(0, 200),
            authoredTemplateId: null,
            selectedCandidateIdx: "NONE",
            stateSignatureHash: stateSignature?.signature_hash ?? null,
            timestamp: new Date().toISOString(),
          });
      }
      const result = await host.runGoal(goal ?? `execute template ${effectiveTargetId}`, {
        variables,
        targetTemplateId: effectiveTargetId,
        tags: effectiveTags,
        parentExecutionId,
        compositionChain,
        expectedOutputShapes,
      });
      record.status = result.trace.status === "failed" ? "failed" : "completed";
      record.executionId = result.trace.id;
      record.selectedTemplateId = result.selectedTemplateId;
    } catch (err) {
      record.status = "failed";
      record.error = (err as Error).message;
      console.error("[goal-host-vessel] async /run-goal error:", err);
    }
  })();

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

  // Support both direct { type, goal, ... } and impulse-wrapper
  // { impulse: { pointer: { type, goal, ... } } }. The impulse-wrapper form is
  // the compliant impulse-contract path used by discovery-routed and
  // MCP-fronted dispatches; the top-level form is the legacy convenience
  // shape. Each field falls back from top-level → impulse.pointer.
  const pointer = ((body.impulse as Record<string, unknown> | undefined)
    ?.pointer as Record<string, unknown> | undefined) ?? {};

  const type = (body.type as string | undefined) ?? (pointer.type as string | undefined);

  if (type !== "goal_execution" && type !== "activity_execution") {
    return Response.json(
      { error: `unknown shape '${type}'; supported: goal_execution, activity_execution` },
      { status: 404 },
    );
  }

  const goal = typeof body.goal === "string" ? body.goal
    : typeof pointer.goal === "string" ? pointer.goal
    : undefined;
  const targetTemplateId = typeof body.target_template_id === "string" ? body.target_template_id
    : typeof pointer.target_template_id === "string" ? pointer.target_template_id
    : undefined;
  const variablesSrc = (typeof body.variables === "object" && body.variables !== null) ? body.variables
    : (typeof pointer.variables === "object" && pointer.variables !== null) ? pointer.variables
    : {};
  const variables = variablesSrc as Record<string, unknown>;
  const parentExecutionId = typeof body.parent_execution_id === "string" ? body.parent_execution_id
    : typeof pointer.parent_execution_id === "string" ? pointer.parent_execution_id
    : undefined;
  const compositionChain = Array.isArray(body.composition_chain) ? (body.composition_chain as string[])
    : Array.isArray(pointer.composition_chain) ? (pointer.composition_chain as string[])
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
  /** State-space signature computed at dispatch time; threaded onto trace tags. */
  stateSignature?: StateSignatureBody;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeStateSignature — fetch the substrate's current state-space
// signature from dev-vessel's compute_state_signature resolver. Threaded
// onto every dispatch's tags array so traces carry the environment they
// ran in. If the resolver fails or times out (10s AbortController), returns
// undefined and the caller proceeds without the tag.
// ─────────────────────────────────────────────────────────────────────────────
interface StateSignatureBody {
  signature_hash?: string;
  computed_at?: string;
  load?: Record<string, unknown>;
  recent_traces?: Record<string, unknown>;
  catalogue?: Record<string, unknown>;
}
async function computeStateSignature(): Promise<StateSignatureBody | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const resp = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
      },
      body: JSON.stringify({ impulse: { pointer: { type: "compute_state_signature" } } }),
      signal: ctrl.signal,
    });
    const text = await resp.text();
    try { await resp.body?.cancel(); } catch { /* swallow */ }
    if (!resp.ok) return undefined;
    const parsed = JSON.parse(text) as { success?: boolean; shape?: string; body?: StateSignatureBody };
    if (parsed?.success === true && parsed.body && typeof parsed.body === "object") {
      return parsed.body;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// emitAuthoringDecision — write a `substrateGap` impulse via dev-vessel so
// goal-host's auto-draft decisions become inspectable substrate state instead
// of console.log lines lost to journald. Categories:
//   - auto_draft_triggered           (top recommend score below threshold)
//   - auto_draft_reused              (LLM picked an existing gap-closing:auto-* template)
//   - auto_draft_authored            (drafter produced a new template; promoted)
//   - auto_draft_fallback_recommend  (no targetTemplateId AND no authored id; runGoal
//                                     falls through to /recommend selection)
// Wrapped in try/catch; 10s AbortController. Toggle via
// SUBSTRATE_AUTHORING_DECISION_EMIT=0 (default on).
async function emitAuthoringDecision(
  category: string,
  summary: string,
  classification_metadata: Record<string, unknown>,
): Promise<void> {
  if (process.env.SUBSTRATE_AUTHORING_DECISION_EMIT === "0") return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const gap = {
      id: `auto_draft_decision:${(classification_metadata.dispatchId as string | undefined) ?? crypto.randomUUID()}:${category}`,
      category,
      source: "goal_host_auto_draft",
      summary,
      detected_at: new Date().toISOString(),
      status: "open",
      classification_metadata,
    };
    const res = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
      },
      body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
      signal: ctrl.signal,
    });
    try { await res.body?.cancel(); } catch { /* swallow */ }
  } catch (err) {
    console.warn(`[goal-host-vessel] emitAuthoringDecision(${category}) failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
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
// Iteration 8 of the OOM hunt — WS subscriber ablation experiment.
//
// The leak signature from iter-5 (concept_s9ye5GKLw2L8): goal-host RSS grew
// 16.6 → 18.4 GB in 60s of IDLE time, boredom timer inactive, no inbound
// requests. The ONLY high-frequency idle-time actor not yet ablated is this
// WS subscriber, which receives EVERY broadcast from activity-api's `/ws`
// (task.*, lifecycle.*, vessel.* — from every vessel in the substrate) just
// to filter for `vessel.registered`. Even with the substring pre-parse guard
// (line 775), the raw frame allocation per message accumulates.
//
// Gated on env GOAL_HOST_WS_SUBSCRIBER (default "on"). Set to "off" to
// ablate. Verification path when substrate recovers:
//   - Restart goal-host with GOAL_HOST_WS_SUBSCRIBER=off
//   - Watch [gc-tick] for 5 min. If RSS stays bounded → WS is the source.
//   - If still grows → restore subscriber, escalate to iter 9.
//
// If WS is the source: the fix is NOT to permanently disable (we'd lose
// reactive dev-vessel re-registration after restarts). The fix is to either
// (a) switch to a topic-filtered subscription at activity-api side, or
// (b) replace the WS subscriber with a polling /shapes refresh every N
// seconds. Both are iter-9 work; this iteration only confirms the source.
const WS_SUBSCRIBER_ENABLED = (process.env.GOAL_HOST_WS_SUBSCRIBER ?? "on") !== "off";
if (WS_SUBSCRIBER_ENABLED) {
  // Reactive proxy registration: subscribe to vessel.registered events on the bus
  // so we re-fetch /shapes when dev-vessel (re)registers, regardless of whether
  // goal-host or dev-vessel booted first. Dissolves F-129.
  startVesselRegistrationSubscriber();
} else {
  console.log("[startup] WS subscriber DISABLED via GOAL_HOST_WS_SUBSCRIBER=off (iter-8 ablation)");
  // Fallback: poll dev-vessel /shapes every 60s to catch re-registrations.
  // Polling is bounded (one HTTP call per minute) so it can't accumulate.
  setInterval(() => {
    void registerDevVesselProxies();
  }, 60_000).unref();
}
await discoveryLoop.start();

// Graceful shutdown on SIGTERM.
process.on("SIGTERM", async () => {
  await discoveryLoop.stop();
  server.stop(true);
  console.log("[goal-host-vessel] stopped");
  process.exit(0);
});
