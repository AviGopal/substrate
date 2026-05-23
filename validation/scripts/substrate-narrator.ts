/**
 * substrate-narrator.ts
 *
 * Operator-side monitoring tooling for the substrate-narration validation
 * methodology (`docs/SUBSTRATE_NARRATION_PROTOCOL.md`).
 *
 * Captures the substrate's externally-observable knowledge surface so an
 * operator agent (or operator-Claude) can attempt to describe what the
 * substrate is doing using ONLY substrate-accessible knowledge. Gaps —
 * moments where explanation requires operator-side knowledge — are logged
 * downstream in `validation/gaps/`.
 *
 * What this script does:
 *   1. Subscribes to the activity-api WebSocket (`/ws`) and appends every
 *      `task.started | task.completed | task.failed | tool.call |
 *      impulse.resolved` event to a daily JSONL log.
 *   2. Every N minutes (default 5) snapshots the substrate's knowledge
 *      surface: template inventory (activity-api), vessel registry
 *      (discovery-vessel), concept inventory (concept-db).
 *   3. Pulls a recent-trace window alongside each snapshot.
 *   4. Reads its connection config from `~/.metabob/config.json` per the
 *      project's single-source-of-truth convention.
 *
 * Patterned after concept-db's ExecutionObserver
 * (`repos/concept-db/src/services/execution-observer.ts`):
 *   - WebSocket auth via `{type: "authenticate", token}` first frame.
 *   - Catchup via `{type: "catchup", lastSeenSequence}` on reconnect.
 *   - Exponential backoff 1s → 30s. Handlers never throw out.
 *
 * Operator-driven, NOT a substrate-resident vessel. A future substrate-
 * resident version is on the §27.S.5 roadmap (substrate-state-snapshot
 * publication); for now this is operator-side tooling.
 *
 * Usage:
 *   bun run validation/scripts/substrate-narrator.ts
 *   bun run validation/scripts/substrate-narrator.ts --snapshot-interval-ms=300000
 *
 * SIGINT/SIGTERM gracefully closes the WebSocket and exits.
 */

import { existsSync, mkdirSync } from "node:fs";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface NarratorConfig {
  activityApiEndpoint: string;
  apiKey: string;
  discoveryEndpoint: string | null;
  conceptDbEndpoint: string | null;
  snapshotIntervalMs: number;
  outputDir: string;
}

async function loadConfig(): Promise<NarratorConfig> {
  const envEndpoint = process.env.METABOB_ENDPOINT;
  const envKey = process.env.METABOB_API_KEY;
  const envDiscovery = process.env.DISCOVERY_VESSEL_URL ?? null;
  const envConcept = process.env.CONCEPT_DB_URL ?? null;

  let endpoint: string | undefined = envEndpoint;
  let apiKey: string | undefined = envKey;
  let discovery: string | null = envDiscovery;
  let conceptDb: string | null = envConcept;

  const configPath = join(homedir(), ".metabob", "config.json");
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(await readFile(configPath, "utf8")) as {
        metabob?: { endpoint?: string; apiKey?: string };
        discovery?: { endpoint?: string };
        conceptDb?: { endpoint?: string };
      };
      endpoint ??= raw.metabob?.endpoint;
      apiKey ??= raw.metabob?.apiKey;
      discovery ??= raw.discovery?.endpoint ?? null;
      conceptDb ??= raw.conceptDb?.endpoint ?? null;
    } catch (err) {
      console.warn(
        `[narrator] Could not parse ${configPath}: ${(err as Error).message}`,
      );
    }
  }

  if (!endpoint) {
    throw new Error(
      "Activity-API endpoint not set. Set METABOB_ENDPOINT env or metabob.endpoint in ~/.metabob/config.json",
    );
  }
  if (!apiKey) {
    throw new Error(
      "METABOB_API_KEY not set. Set via env var or metabob.apiKey in ~/.metabob/config.json",
    );
  }

  // --snapshot-interval-ms CLI flag
  let snapshotIntervalMs = 5 * 60 * 1000;
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--snapshot-interval-ms=(\d+)$/);
    if (m) snapshotIntervalMs = Number.parseInt(m[1], 10);
  }

  // Resolve output dir relative to this file, NOT cwd, so the narrator
  // writes to validation/observations/ regardless of where it is invoked.
  const here = new URL(".", import.meta.url).pathname;
  const outputDir = resolve(here, "..", "observations");

  return {
    activityApiEndpoint: endpoint,
    apiKey,
    discoveryEndpoint: discovery,
    conceptDbEndpoint: conceptDb,
    snapshotIntervalMs,
    outputDir,
  };
}

// ---------------------------------------------------------------------------
// Output paths
// ---------------------------------------------------------------------------

function todayDate(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nowIsoSafe(): string {
  // 2026-05-23T14-22-09-471Z — safe for filenames on all platforms.
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// ---------------------------------------------------------------------------
// Snapshotter
// ---------------------------------------------------------------------------

interface SubstrateSnapshot {
  captured_at: string;
  activity_api: {
    endpoint: string;
    reachable: boolean;
    template_count: number | null;
    templates: Array<{ id: string; name: string; output_shapes: string[] }>;
    error?: string;
  };
  discovery_vessel: {
    endpoint: string | null;
    reachable: boolean;
    stats: unknown | null;
    error?: string;
  };
  concept_db: {
    endpoint: string | null;
    reachable: boolean;
    concept_count: number | null;
    sample_concepts: Array<{ id: string; shape?: string; summary?: string }>;
    error?: string;
  };
}

async function fetchTemplates(
  endpoint: string,
  apiKey: string,
): Promise<SubstrateSnapshot["activity_api"]> {
  const url = `${endpoint.replace(/\/$/, "")}/v2/activities/templates?limit=1000`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (!res.ok) {
      return {
        endpoint,
        reachable: false,
        template_count: null,
        templates: [],
        error: `HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      templates?: Array<{ id: string; name?: string; output_shapes?: string[] }>;
    };
    const templates = (body.templates ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? "",
      output_shapes: t.output_shapes ?? [],
    }));
    return {
      endpoint,
      reachable: true,
      template_count: templates.length,
      templates,
    };
  } catch (err) {
    return {
      endpoint,
      reachable: false,
      template_count: null,
      templates: [],
      error: (err as Error).message,
    };
  }
}

async function fetchDiscoveryStats(
  endpoint: string | null,
  apiKey: string,
): Promise<SubstrateSnapshot["discovery_vessel"]> {
  if (!endpoint) {
    return { endpoint: null, reachable: false, stats: null, error: "not configured" };
  }
  const url = `${endpoint.replace(/\/$/, "")}/registry/stats`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (!res.ok) {
      return { endpoint, reachable: false, stats: null, error: `HTTP ${res.status}` };
    }
    return { endpoint, reachable: true, stats: await res.json() };
  } catch (err) {
    return { endpoint, reachable: false, stats: null, error: (err as Error).message };
  }
}

async function fetchConceptInventory(
  endpoint: string | null,
  apiKey: string,
): Promise<SubstrateSnapshot["concept_db"]> {
  if (!endpoint) {
    return {
      endpoint: null,
      reachable: false,
      concept_count: null,
      sample_concepts: [],
      error: "not configured",
    };
  }
  const url = `${endpoint.replace(/\/$/, "")}/concepts/search?limit=50`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (!res.ok) {
      return {
        endpoint,
        reachable: false,
        concept_count: null,
        sample_concepts: [],
        error: `HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      concepts?: Array<{ id: string; shape?: string; summary?: string }>;
      total?: number;
    };
    const concepts = body.concepts ?? [];
    return {
      endpoint,
      reachable: true,
      concept_count: body.total ?? concepts.length,
      sample_concepts: concepts.slice(0, 50).map((c) => ({
        id: c.id,
        shape: c.shape,
        summary: c.summary,
      })),
    };
  } catch (err) {
    return {
      endpoint,
      reachable: false,
      concept_count: null,
      sample_concepts: [],
      error: (err as Error).message,
    };
  }
}

async function fetchRecentTraces(
  endpoint: string,
  apiKey: string,
): Promise<unknown> {
  const url = `${endpoint.replace(/\/$/, "")}/v2/activities/execution-traces?limit=50`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (!res.ok) return { reachable: false, error: `HTTP ${res.status}` };
    return { reachable: true, body: await res.json() };
  } catch (err) {
    return { reachable: false, error: (err as Error).message };
  }
}

async function captureSnapshot(cfg: NarratorConfig): Promise<void> {
  const captured_at = new Date().toISOString();
  const [templates, discovery, concepts, traces] = await Promise.all([
    fetchTemplates(cfg.activityApiEndpoint, cfg.apiKey),
    fetchDiscoveryStats(cfg.discoveryEndpoint, cfg.apiKey),
    fetchConceptInventory(cfg.conceptDbEndpoint, cfg.apiKey),
    fetchRecentTraces(cfg.activityApiEndpoint, cfg.apiKey),
  ]);

  const snapshot: SubstrateSnapshot = {
    captured_at,
    activity_api: templates,
    discovery_vessel: discovery,
    concept_db: concepts,
  };

  const stamp = nowIsoSafe();
  const snapDir = join(cfg.outputDir, "snapshots");
  ensureDir(snapDir);
  const snapPath = join(snapDir, `snapshot-${stamp}.json`);
  const tracePath = join(cfg.outputDir, `recent-traces-${stamp}.json`);

  await writeFile(snapPath, JSON.stringify(snapshot, null, 2));
  await writeFile(tracePath, JSON.stringify(traces, null, 2));

  console.log(
    `[narrator] snapshot ${captured_at} — templates=${snapshot.activity_api.template_count ?? "?"} concepts=${snapshot.concept_db.concept_count ?? "?"} discovery=${snapshot.discovery_vessel.reachable ? "ok" : "n/a"} → ${snapPath}`,
  );
}

// ---------------------------------------------------------------------------
// WebSocket event capture
// ---------------------------------------------------------------------------

const CAPTURED_EVENT_TYPES = new Set([
  "task.started",
  "task.completed",
  "task.failed",
  "tool.call",
  "impulse.resolved",
]);

interface CapturedEvent {
  type: string;
  sequence?: number;
  [k: string]: unknown;
}

class NarratorObserver {
  private ws: WebSocket | null = null;
  private shouldRun = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentBackoffMs = 1000;
  private readonly maxBackoffMs = 30_000;
  private lastSeenSequence: number | null = null;
  private readonly eventLogPath: string;

  constructor(private readonly cfg: NarratorConfig) {
    ensureDir(cfg.outputDir);
    this.eventLogPath = join(cfg.outputDir, `events-${todayDate()}.jsonl`);
  }

  start(): void {
    this.shouldRun = true;
    this.connect();
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "narrator shutting down");
      } catch (err) {
        console.warn(`[narrator] close error: ${(err as Error).message}`);
      }
      this.ws = null;
    }
  }

  private buildWsUrl(): string {
    const base = this.cfg.activityApiEndpoint;
    const wsBase = base.replace(/^http(s?):\/\//, "ws$1://");
    return `${wsBase.replace(/\/$/, "")}/ws`;
  }

  private connect(): void {
    if (!this.shouldRun) return;
    const url = this.buildWsUrl();
    console.log(`[narrator] WS connecting → ${url}`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn(`[narrator] WS construct failed: ${(err as Error).message}`);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener("open", () => {
      console.log("[narrator] WS open, authenticating");
      this.currentBackoffMs = 1000;
      try {
        ws.send(JSON.stringify({ type: "authenticate", token: this.cfg.apiKey }));
        if (this.lastSeenSequence !== null) {
          ws.send(
            JSON.stringify({
              type: "catchup",
              lastSeenSequence: this.lastSeenSequence,
            }),
          );
        }
      } catch (err) {
        console.warn(`[narrator] auth send failed: ${(err as Error).message}`);
      }
    });

    ws.addEventListener("message", (evt) => {
      try {
        const raw =
          typeof evt.data === "string" ? evt.data : String(evt.data);
        const parsed = JSON.parse(raw) as CapturedEvent;
        void this.handleEvent(parsed);
      } catch (err) {
        console.warn(`[narrator] event parse failed: ${(err as Error).message}`);
      }
    });

    ws.addEventListener("close", (evt) => {
      const ce = evt as CloseEvent;
      console.log(`[narrator] WS closed code=${ce.code} reason=${ce.reason || "?"}`);
      this.ws = null;
      this.scheduleReconnect();
    });

    ws.addEventListener("error", (evt) => {
      console.warn(
        `[narrator] WS error: ${(evt as ErrorEvent).message ?? "unknown"}`,
      );
    });
  }

  private async handleEvent(event: CapturedEvent): Promise<void> {
    if (!event || typeof event !== "object") return;
    if (typeof event.sequence === "number") {
      this.lastSeenSequence = event.sequence;
    }

    // Control frames — log only.
    switch (event.type) {
      case "authenticated":
        console.log("[narrator] WS authenticated");
        return;
      case "auth_error":
        console.warn(`[narrator] WS auth rejected: ${JSON.stringify(event)}`);
        return;
      case "catchup_complete":
        console.log("[narrator] WS catchup complete");
        return;
      case "pong":
        return;
    }

    if (!CAPTURED_EVENT_TYPES.has(event.type)) return;

    const enriched = {
      observed_at: new Date().toISOString(),
      ...event,
    };

    try {
      await appendFile(this.eventLogPath, JSON.stringify(enriched) + "\n");
    } catch (err) {
      console.warn(`[narrator] event write failed: ${(err as Error).message}`);
      return;
    }

    // Brief stdout line for human watching.
    const data = (event as { data?: Record<string, unknown> }).data ?? {};
    const succinct =
      event.type === "task.completed"
        ? `success=${data.success} task=${data.task_id}`
        : event.type === "task.failed"
          ? `task=${data.task_id} error=${(data.error as string)?.slice(0, 60)}`
          : event.type === "tool.call"
            ? `tool=${data.tool_name} tier=${data.resolver_tier}`
            : event.type === "impulse.resolved"
              ? `shape=${(event as { shape?: string }).shape}`
              : "";
    console.log(`[narrator] ${event.type} ${succinct}`);
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    if (this.reconnectTimer) return;
    const delay = this.currentBackoffMs;
    this.currentBackoffMs = Math.min(this.currentBackoffMs * 2, this.maxBackoffMs);
    console.log(`[narrator] WS reconnect in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cfg = await loadConfig();
  ensureDir(cfg.outputDir);
  ensureDir(join(cfg.outputDir, "snapshots"));

  console.log("[narrator] starting");
  console.log(`[narrator] activity-api: ${cfg.activityApiEndpoint}`);
  console.log(`[narrator] discovery-vessel: ${cfg.discoveryEndpoint ?? "(none)"}`);
  console.log(`[narrator] concept-db: ${cfg.conceptDbEndpoint ?? "(none)"}`);
  console.log(`[narrator] snapshot interval: ${cfg.snapshotIntervalMs}ms`);
  console.log(`[narrator] output dir: ${cfg.outputDir}`);

  const observer = new NarratorObserver(cfg);
  observer.start();

  // Initial snapshot immediately, then on cadence.
  await captureSnapshot(cfg).catch((err) =>
    console.warn(`[narrator] snapshot failed: ${(err as Error).message}`),
  );
  const snapshotTimer = setInterval(() => {
    captureSnapshot(cfg).catch((err) =>
      console.warn(`[narrator] snapshot failed: ${(err as Error).message}`),
    );
  }, cfg.snapshotIntervalMs);

  const shutdown = (sig: string) => {
    console.log(`[narrator] ${sig} received, shutting down`);
    clearInterval(snapshotTimer);
    observer.stop();
    setTimeout(() => process.exit(0), 250);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Avoid ESM top-level await issues; just call.
main().catch((err) => {
  console.error(`[narrator] fatal: ${(err as Error).message}`);
  process.exit(1);
});
