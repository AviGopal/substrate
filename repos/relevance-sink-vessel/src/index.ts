const PORT = parseInt(process.env.PORT ?? "8255", 10);

const SURREALDB_URL = process.env.SURREALDB_URL ?? "http://127.0.0.1:8000";
const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE ?? "";
const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE ?? "";
const SURREALDB_USERNAME = process.env.SURREALDB_USERNAME ?? "root";
const SURREALDB_PASSWORD = process.env.SURREALDB_PASSWORD ?? "root";

function basicAuth(username: string, password: string): string {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
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

  if (impulse_ids.length === 0) {
    return Response.json({ written: 0 });
  }

  const sql =
    "UPDATE impulse_relevance_metrics " +
    "SET times_failed = (times_failed ?? 0) + 1, updated_at = time::now() " +
    "WHERE impulse_id IN $ids AND org_id = $org";

  const sqlWithParams =
    sql +
    "\n-- params: " +
    JSON.stringify({ ids: impulse_ids, org: org_id });

  // SurrealDB HTTP API supports params via the request body when using the
  // application/json content-type with a {query, vars} envelope, but the
  // plain /sql endpoint accepts raw SurrealQL.  We encode vars inline via
  // a SurrealQL LET block so no extra library is needed.
  const letsql =
    `LET $ids = ${JSON.stringify(impulse_ids)};\n` +
    `LET $org = ${JSON.stringify(org_id)};\n` +
    sql +
    ";";

  void sqlWithParams; // suppress unused var

  try {
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
      console.error(`[relevance-sink] SurrealDB error ${res.status}: ${text}`);
      return Response.json({ error: "db error", status: res.status }, { status: 502 });
    }

    return Response.json({ written: impulse_ids.length });
  } catch (err) {
    console.error("[relevance-sink] fetch error", err);
    return Response.json({ error: "db unreachable" }, { status: 503 });
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

      if (req.method === "GET" && url.pathname === "/health") {
        return Response.json({ status: "ok" });
      }

      return Response.json({ error: "not found" }, { status: 404 });
    } catch (err) {
      console.error("[relevance-sink] unhandled error", err);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  },
});

console.log(`[relevance-sink] listening on port ${PORT}`);
