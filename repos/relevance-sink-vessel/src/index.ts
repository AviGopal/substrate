const PORT = parseInt(process.env.PORT ?? "8255", 10);

const SURREALDB_URL = process.env.SURREALDB_URL ?? "http://127.0.0.1:8000";
const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE ?? "activity-system";
const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE ?? "learning_loop";
const SURREALDB_USERNAME = process.env.SURREALDB_USERNAME ?? "root";
// Defaults must match every other client of this ONE datastore. activity-api
// (src/config.ts:210) defaults to "changeme"; this vessel defaulted to "root",
// so two vessels reached the same database with different default credentials
// and only one of them could be right. Namespace and database defaulted to ""
// here while every other client uses activity-system / learning_loop.
const SURREALDB_PASSWORD = process.env.SURREALDB_PASSWORD ?? "changeme";
const VESSEL_ID = process.env.VESSEL_ID ?? "relevance-sink-vessel";
const DISCOVERY_ENDPOINT = process.env.DISCOVERY_VESSEL_ENDPOINT ?? "http://127.0.0.1:8100";
const API_KEY = process.env.RELEVANCE_SINK_VESSEL_API_KEY ?? process.env.METABOB_API_KEY ?? "";

function basicAuth(username: string, password: string): string {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

// Core penalty write — shared by the legacy /penalty REST route and the shaped
// impulseRelevancePenalty_write resolve. Returns the count written or throws.
async function applyPenalty(impulse_ids: string[], org_id: string): Promise<number> {
  if (impulse_ids.length === 0) return 0;
  const sql =
    "UPDATE impulse_relevance_metrics " +
    "SET times_failed = (times_failed ?? 0) + 1, updated_at = time::now() " +
    "WHERE impulse_id IN $ids AND org_id = $org";
  const letsql =
    `LET $ids = ${JSON.stringify(impulse_ids)};\n` +
    `LET $org = ${JSON.stringify(org_id)};\n` +
    sql +
    ";";
  const res = await fetch(`${SURREALDB_URL}/sql`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "text/plain",
      "surreal-ns": SURREALDB_NAMESPACE,
      "surreal-db": SURREALDB_DATABASE,
      "Authorization": basicAuth(SURREALDB_USERNAME, SURREALDB_PASSWORD),
    },
    body: letsql,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SurrealDB error ${res.status}: ${text}`);
  }
  return impulse_ids.length;
}

async function handlePenalty(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>)["impulse_ids"]) ||
    typeof (body as Record<string, unknown>)["org_id"] !== "string"
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const { impulse_ids, org_id } = body as { impulse_ids: string[]; org_id: string };

  try {
    const written = await applyPenalty(impulse_ids, org_id);
    return Response.json({ written });
  } catch (err) {
    console.error("[relevance-sink] penalty write failed", err);
    return Response.json({ error: "db error" }, { status: 502 });
  }
}

Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    try {
      if (req.method === "POST" && url.pathname === "/penalty") {
        return await handlePenalty(req);
      }

      if (req.method === "POST" && url.pathname === "/v2/impulses/resolve") {
        let rb: { impulse?: { pointer?: Record<string, unknown> }; pointer?: Record<string, unknown> };
        try { rb = await req.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }
        const pointer = rb.impulse?.pointer ?? rb.pointer ?? {};
        if (pointer["type"] !== "impulseRelevancePenalty_write") {
          return Response.json({ error: `unknown shape '${String(pointer["type"])}'` }, { status: 400 });
        }
        const ids = pointer["impulse_ids"];
        const org = pointer["org_id"];
        if (!Array.isArray(ids) || typeof org !== "string") {
          return Response.json({ success: false, shape: "impulseRelevancePenalty_write", error: "impulse_ids[] and org_id required" }, { status: 400 });
        }
        try {
          const written = await applyPenalty(ids as string[], org);
          return Response.json({ success: true, shape: "impulseRelevancePenalty_write", body: { written } });
        } catch (err) {
          console.error("[relevance-sink] shaped penalty write failed", err);
          return Response.json({ success: false, shape: "impulseRelevancePenalty_write", error: "db error" }, { status: 502 });
        }
      }

      if (req.method === "GET" && url.pathname === "/health") {
        return Response.json({ status: "ok", vessel: "relevance-sink-vessel" });
      }

      return Response.json({ error: "not found" }, { status: 404 });
    } catch (err) {
      console.error("[relevance-sink] unhandled error", err);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  },
});

console.log(`[relevance-sink] listening on port ${PORT}`);

// Discovery registration (control-plane bootstrap — the /register + /heartbeat
// contract; no ias-executor dependency needed for a bare vessel). Advertises the
// impulseRelevancePenalty_write shape so the penalty write is a routable impulse
// resolve, not a bespoke REST seam.
const REGISTRATION_PAYLOAD = {
  vesselId: VESSEL_ID,
  name: "relevance-sink-vessel",
  endpoint: `http://127.0.0.1:${PORT}`,
  shapes: ["impulseRelevancePenalty_write"],
  resolve_endpoint: `http://127.0.0.1:${PORT}/v2/impulses/resolve`,
  resolve_request_format: "pointer",
  auth_scheme: "ApiKey",
  resolve_timeout_ms: 10_000,
  port: PORT,
  systemVessel: true,
};
async function registerWithDiscovery(): Promise<void> {
  try {
    const res = await fetch(`${DISCOVERY_ENDPOINT}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
      body: JSON.stringify(REGISTRATION_PAYLOAD),
    });
    if (!res.ok) console.warn(`[relevance-sink] discovery register failed: ${res.status}`);
  } catch (err) {
    console.warn(`[relevance-sink] discovery register error: ${(err as Error).message}`);
  }
}
void registerWithDiscovery();
setInterval(registerWithDiscovery, 60_000);
