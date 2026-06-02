/**
 * stateful-ui-vessel — the substrate's "face."
 *
 * Substrate dispatches activities that produce UI panels; the vessel renders
 * them; the operator interacts; the vessel emits uiFeedback / interactorObservation
 * impulses back to substrate (via dev-vessel's substrateGap_write).
 *
 * Port 8270.
 *
 * Endpoints:
 *   GET  /              — HTML+React shell
 *   GET  /api/state     — current panels + recent feedback/observations
 *   GET  /api/stream    — SSE
 *   POST /api/panels    — substrate registers a panel
 *   POST /api/feedback  — operator feedback (emits substrateGap)
 *   POST /api/observations — frontend behavioral telemetry (emits substrateGap)
 *   POST /resolve       — discovery contract for uiPanel_write / uiQuestion_write
 *   GET  /health, /shapes
 */

import { Hono } from "hono";
import {
  upsertPanel,
  listPanels,
  recordFeedback,
  recentFeedback,
  recordObservation,
  recentObservations,
  subscribe,
  type Ask,
} from "./store.js";
import { startDiscoveryRegistration } from "./discovery.js";

// ─── Config ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "8270", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const VESSEL_ID = process.env.STATEFUL_UI_VESSEL_ID ?? process.env.VESSEL_ID ?? "stateful-ui-vessel";
const DISCOVERY_ENDPOINT = process.env.DISCOVERY_VESSEL_ENDPOINT ?? "http://127.0.0.1:8100";
const DEV_VESSEL_ENDPOINT = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const API_KEY = process.env.METABOB_API_KEY ?? "";

const SHAPES = ["uiPanel_write", "uiQuestion_write", "uiFeedback", "interactorObservation"];

// ─── Emit substrateGap (operator signals → substrate's gap store) ──────────
async function emitSubstrateGap(category: string, body: Record<string, unknown>): Promise<void> {
  if (!API_KEY) return;
  try {
    await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${API_KEY}`,
      },
      body: JSON.stringify({
        impulse: {
          pointer: {
            type: "substrateGap_write",
            id: `ui-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            category,
            source: VESSEL_ID,
            body,
          },
        },
      }),
    });
  } catch (err) {
    console.warn(`[substrate-gap] emit failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── HTTP + frontend ───────────────────────────────────────────────────────
const app = new Hono();

app.get("/health", (c) =>
  c.json({ status: "ok", vessel: VESSEL_ID, port: PORT, panels: listPanels().length }),
);

app.get("/shapes", (c) => c.json({ shapes: SHAPES }));

app.get("/api/state", (c) =>
  c.json({
    panels: listPanels(),
    feedback: recentFeedback(20),
    observations: recentObservations(20),
  }),
);

app.post("/api/panels", async (c) => {
  const body = await c.req.json().catch(() => null) as null | {
    id?: string; title?: string; body?: string; kind?: string; importance?: string; asks?: Ask[];
  };
  if (!body || !body.id || !body.title) {
    return c.json({ error: "id and title required" }, 400);
  }
  const panel = upsertPanel({
    id: body.id,
    title: body.title,
    body: body.body ?? "",
    kind: body.kind ?? "info",
    importance: body.importance ?? "medium",
    asks: body.asks,
  });
  return c.json({ ok: true, panel });
});

app.post("/api/feedback", async (c) => {
  const body = await c.req.json().catch(() => null) as null | {
    panel_id?: string; ask_id?: string; value?: unknown; kind?: "answer" | "reaction" | "dismiss";
  };
  if (!body || !body.panel_id) {
    return c.json({ error: "panel_id required" }, 400);
  }
  const entry = recordFeedback({
    panelId: body.panel_id,
    askId: body.ask_id,
    value: body.value,
    kind: body.kind ?? "answer",
  });
  // Fire-and-forget upstream emission
  void emitSubstrateGap("ui_feedback", {
    panel_id: entry.panelId,
    ask_id: entry.askId,
    value: entry.value,
    kind: entry.kind,
    received_at: entry.receivedAt,
  });
  return c.json({ ok: true, feedback: entry });
});

app.post("/api/observations", async (c) => {
  const body = await c.req.json().catch(() => null) as null | {
    type?: "click" | "dwell" | "scroll" | "focus";
    panel_id?: string; ask_id?: string; duration_ms?: number; position?: { x: number; y: number };
  };
  if (!body || !body.type) {
    return c.json({ error: "type required" }, 400);
  }
  const entry = recordObservation({
    type: body.type,
    panelId: body.panel_id,
    askId: body.ask_id,
    durationMs: body.duration_ms,
    position: body.position,
  });
  void emitSubstrateGap("interactor_observation", {
    obs_type: entry.type,
    panel_id: entry.panelId,
    ask_id: entry.askId,
    duration_ms: entry.durationMs,
    position: entry.position,
    observed_at: entry.observedAt,
  });
  return c.json({ ok: true });
});

// Server-Sent Events stream
app.get("/api/stream", (c) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: { event: string; data: unknown }): void => {
        const payload = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
        try { controller.enqueue(encoder.encode(payload)); } catch { /* closed */ }
      };
      send({ event: "hello", data: { vesselId: VESSEL_ID, ts: Date.now() } });
      const unsubscribe = subscribe(send);
      const keepalive = setInterval(() => send({ event: "ping", data: Date.now() }), 25_000);
      const onClose = (): void => {
        clearInterval(keepalive);
        unsubscribe();
        try { controller.close(); } catch { /* ignore */ }
      };
      c.req.raw.signal.addEventListener("abort", onClose);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// Discovery contract — substrate-side activities dispatch here for
// uiPanel_write / uiQuestion_write shapes
app.post("/resolve", async (c) => {
  const body = await c.req.json().catch(() => null) as null | { impulse?: { pointer?: Record<string, unknown> } };
  const pointer = body?.impulse?.pointer;
  if (!pointer || typeof pointer.type !== "string") {
    return c.json({ resolved: false, error: "missing impulse.pointer.type" }, 400);
  }
  const t = pointer.type;
  if (t === "uiPanel_write" || t === "uiQuestion_write") {
    const id = String(pointer.id ?? `panel-${Date.now()}`);
    const title = String(pointer.title ?? "Untitled");
    const panelBody = String(pointer.body ?? "");
    const kind = String(pointer.kind ?? (t === "uiQuestion_write" ? "question" : "info"));
    const importance = String(pointer.importance ?? "medium");
    const asks = Array.isArray(pointer.asks) ? (pointer.asks as Ask[]) : undefined;
    const panel = upsertPanel({ id, title, body: panelBody, kind, importance, asks });
    return c.json({ resolved: true, shape: t, body: panel });
  }
  return c.json({ resolved: false, error: `unsupported pointer.type: ${t}` }, 400);
});

// ─── Frontend ──────────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Substrate face — stateful-ui-vessel</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
         background: #0d1117; color: #e6edf3; }
  header { padding: 16px 24px; border-bottom: 1px solid #21262d; background: #161b22;
           display: flex; align-items: baseline; gap: 12px; }
  header h1 { margin: 0; font-size: 16px; font-weight: 600; }
  header .meta { color: #7d8590; font-size: 12px; }
  main { padding: 16px 24px; max-width: 880px; }
  .panel { background: #161b22; border: 1px solid #21262d; border-radius: 6px;
           padding: 14px 16px; margin-bottom: 12px; }
  .panel-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .panel-title { font-weight: 600; font-size: 14px; }
  .panel-body { color: #c9d1d9; margin-top: 6px; white-space: pre-wrap; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px;
           background: #1f2937; color: #9ca3af; }
  .badge.high { background: #7f1d1d; color: #fecaca; }
  .badge.medium { background: #78350f; color: #fed7aa; }
  .badge.low { background: #1e3a8a; color: #bfdbfe; }
  .asks { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
  .ask { display: flex; gap: 8px; align-items: center; }
  .ask label { flex: 0 0 auto; color: #9ca3af; }
  .ask input, .ask select { flex: 1 1 auto; background: #0d1117; color: #e6edf3;
                            border: 1px solid #30363d; border-radius: 4px; padding: 6px 8px; }
  button { background: #238636; color: #fff; border: 0; border-radius: 4px;
           padding: 6px 12px; cursor: pointer; }
  button.secondary { background: #30363d; }
  .empty { color: #7d8590; padding: 32px; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>Substrate face — stateful-ui-vessel</h1>
  <span class="meta" id="meta">connecting…</span>
</header>
<main id="root"></main>

<script type="module">
const root = document.getElementById("root");
const meta = document.getElementById("meta");
let state = { panels: [], feedback: [], observations: [] };

function badge(level) {
  const cls = ["high","medium","low"].includes(level) ? level : "";
  return \`<span class="badge \${cls}">\${level}</span>\`;
}

function render() {
  if (!state.panels.length) {
    root.innerHTML = '<div class="empty">No panels yet. The substrate has not spoken.</div>';
    return;
  }
  root.innerHTML = state.panels.map(p => \`
    <div class="panel" data-panel-id="\${p.id}">
      <div class="panel-head">
        <div class="panel-title">\${escapeHtml(p.title)}</div>
        <div>\${badge(p.importance)} <span class="badge">\${escapeHtml(p.kind)}</span></div>
      </div>
      <div class="panel-body">\${escapeHtml(p.body || "")}</div>
      \${(p.asks || []).length ? \`
        <form class="asks" data-panel-id="\${p.id}">
          \${p.asks.map(a => \`
            <div class="ask">
              <label>\${escapeHtml(a.prompt)}</label>
              \${a.type === "choice" && a.choices
                ? \`<select name="\${a.id}">\${a.choices.map(c => \`<option>\${escapeHtml(c)}</option>\`).join("")}</select>\`
                : \`<input name="\${a.id}" type="\${a.type === "number" ? "number" : "text"}" />\`}
            </div>
          \`).join("")}
          <div><button type="submit">Submit</button>
            <button type="button" class="secondary" data-dismiss="\${p.id}">Dismiss</button></div>
        </form>
      \` : \`<div style="margin-top:10px"><button class="secondary" data-dismiss="\${p.id}">Dismiss</button></div>\`}
    </div>
  \`).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function load() {
  const r = await fetch("/api/state");
  state = await r.json();
  render();
}

document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  const panelId = form.dataset.panelId;
  if (!panelId) return;
  e.preventDefault();
  const panel = state.panels.find(p => p.id === panelId);
  if (!panel || !panel.asks) return;
  for (const ask of panel.asks) {
    const input = form.elements.namedItem(ask.id);
    const value = input && "value" in input ? input.value : null;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panel_id: panelId, ask_id: ask.id, value, kind: "answer" }),
    });
  }
  form.reset();
});

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.dataset.dismiss) {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panel_id: t.dataset.dismiss, kind: "dismiss" }),
    });
  }
  // Click observation (debounced via Date.now diff)
  void fetch("/api/observations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "click",
      panel_id: t.closest("[data-panel-id]")?.dataset.panelId,
      position: { x: e.clientX, y: e.clientY },
    }),
  });
});

const es = new EventSource("/api/stream");
es.addEventListener("hello", () => meta.textContent = "live");
es.addEventListener("panel_added", () => load());
es.addEventListener("panel_updated", () => load());
es.addEventListener("feedback_received", () => load());
es.onerror = () => meta.textContent = "reconnecting…";

load();
</script>
</body>
</html>`;

app.get("/", (c) => c.html(HTML));

// ─── Start ──────────────────────────────────────────────────────────────────
const endpointPublic = `http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`;

startDiscoveryRegistration({
  discoveryEndpoint: DISCOVERY_ENDPOINT,
  apiKey: API_KEY,
  vesselId: VESSEL_ID,
  vesselName: "Stateful UI Vessel",
  endpoint: endpointPublic,
  shapes: SHAPES,
  resolveEndpoint: "/resolve",
});

console.log(`[stateful-ui-vessel] starting on ${HOST}:${PORT} | discovery=${DISCOVERY_ENDPOINT} | dev-vessel=${DEV_VESSEL_ENDPOINT}`);

export default {
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
};
