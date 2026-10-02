#!/usr/bin/env bun
/**
 * auto-describe-resolvers.ts — the substrate DESCRIBES ITS OWN resolvers.
 *
 * THE GAP THIS CLOSES (the last operator/owner-load-bearing item in the
 * decomposition-planner path): the planner (development-vessel
 * author-composed-capability.ts `fetchShapeDescriptions` + `buildResolverCatalogue`)
 * can only MATCH a goal to a resolver that has a one-line DESCRIPTION advertised
 * in discovery's `GET /registry/shape-descriptions`. The fleet advertises ~200
 * shapes but only a handful carry descriptions — the rest are id-only and thus
 * NOT planner-matchable. Filling that in by hand requires the operator or each
 * vessel owner to write a line per resolver. This tick removes that requirement:
 * the substrate generates the missing one-liners itself and POSTs them as LEARNED
 * descriptions to discovery (`POST /registry/shape-descriptions`, source:"auto"),
 * where the planner picks them up automatically. A vessel-ADVERTISED description
 * always WINS over a learned one (advertised = authoritative), so this only ever
 * fills gaps — it never overrides an owner's hand-written line.
 *
 * SAFE BY CONSTRUCTION:
 *  - It NEVER invokes the resolver it is describing (could be destructive/unknown).
 *    Evidence is gathered read-only from the trace store: the shape id itself,
 *    a sample of recent impulse pointers of that shape, and the names/descriptions
 *    of activities that DECLARE the shape as an output_shape.
 *  - It SKIPS write/destructive/lifecycle/internal shapes (only describes
 *    DATA/REPORT/QUERY resolvers — the ones operator goals compose).
 *  - Bounded: at most MAX_PER_TICK shapes per fire, round-robin over the backlog
 *    via a persisted cursor, so it works through the gap over time without flooding.
 *  - NON-FATAL throughout: any LLM / discovery / DB failure → log + skip, never throw.
 *
 * Env-gated: AUTO_DESCRIBE_RESOLVERS=1 to run (anything else = no-op exit).
 * Self-activating: seeded into ${SUBSTRATE_RUN_DIR} at boot, run by the
 * auto-describe-resolvers.timer (~20min cadence).
 */

const ENABLED = process.env.AUTO_DESCRIBE_RESOLVERS === "1";

const DISCOVERY = (process.env.DISCOVERY_VESSEL_ENDPOINT || "http://127.0.0.1:8100").replace(/\/$/, "");
const LLM = (process.env.LLM_VESSEL_ENDPOINT || "http://127.0.0.1:8220").replace(/\/$/, "");
const LLM_MODEL = process.env.AUTO_DESCRIBE_MODEL || "claude-haiku-4-5";
const API_KEY = process.env.METABOB_API_KEY || "";

const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREAL_PASS || process.env.SURREALDB_PASSWORD || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

const MAX_PER_TICK = parseInt(process.env.AUTO_DESCRIBE_MAX_PER_TICK || "5", 10);
const METRICS_DIR = "/workspace/metrics";
const LOG = `${METRICS_DIR}/auto-describe.jsonl`;
const CURSOR = `${METRICS_DIR}/auto-describe-cursor.json`;

// Shapes the planner CANNOT usefully compose from a description: writes,
// destructive ops, lifecycle/hub/internal tick machinery. We describe DATA /
// REPORT / QUERY resolvers — the producers operator goals chain together.
const SKIP_PATTERNS: RegExp[] = [
  /_write$/i, /_delete$/i, /_deprecate$/i, /_update$/i, /Write$/,
  /dispatch/i, /tick/i, /lifecycle/i, /\bhook\b/i,
  /heartbeat/i, /register/i, /observer$/i, /sentinel/i, /_seed$/i,
];

function shouldSkip(shape: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(shape));
}

async function sql(query: string): Promise<any[]> {
  const r = await fetch(SQL_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Surreal-NS": NS,
      "Surreal-DB": DB,
      Authorization: sqlAuth,
      "Content-Type": "text/plain",
    },
    body: query,
    signal: AbortSignal.timeout(15000),
  });
  const j = JSON.parse(await r.text());
  return j.map((s: any) => s.result);
}

interface CursorState { index: number }

async function readCursor(): Promise<CursorState> {
  try {
    const f = Bun.file(CURSOR);
    if (await f.exists()) return JSON.parse(await f.text());
  } catch { /* ignore */ }
  return { index: 0 };
}

async function writeCursor(s: CursorState): Promise<void> {
  try {
    await Bun.write(CURSOR, JSON.stringify(s));
  } catch { /* non-fatal */ }
}

async function appendLog(entry: Record<string, unknown>): Promise<void> {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
    const existing = (await Bun.file(LOG).exists()) ? await Bun.file(LOG).text() : "";
    await Bun.write(LOG, existing + line);
  } catch { /* non-fatal */ }
}

/** All advertised shapes from discovery. */
async function fetchAdvertisedShapes(): Promise<string[]> {
  try {
    const r = await fetch(`${DISCOVERY}/registry/shapes`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const d = (await r.json()) as { shapes?: string[] };
    return Array.isArray(d.shapes) ? d.shapes : [];
  } catch (e) {
    await appendLog({ event: "fetch_advertised_failed", error: String(e) });
    return [];
  }
}

/** Currently-described shapes (advertised OR already learned). */
async function fetchDescribedShapes(): Promise<Set<string>> {
  try {
    const r = await fetch(`${DISCOVERY}/registry/shape-descriptions`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return new Set();
    const d = (await r.json()) as { shape_descriptions?: Record<string, string> };
    return new Set(Object.keys(d.shape_descriptions ?? {}));
  } catch (e) {
    await appendLog({ event: "fetch_described_failed", error: String(e) });
    return new Set();
  }
}

/**
 * Gather SAFE evidence for a shape WITHOUT invoking its resolver:
 *  - activities that declare it as an output_shape (their name + description)
 *  - a sample of recent impulse pointers of that shape (structure only)
 */
async function gatherEvidence(shape: string): Promise<string> {
  const parts: string[] = [];

  // (a) producing activities — the most reliable, human-authored signal.
  try {
    const esc = shape.replace(/"/g, '\\"');
    const [acts] = await sql(
      `SELECT name, description FROM activity WHERE output_shapes CONTAINS "${esc}" AND deprecated != true LIMIT 4;`,
    );
    for (const a of acts || []) {
      const name = (a?.name ?? "").toString().slice(0, 80);
      const desc = (a?.description ?? "").toString().slice(0, 140);
      if (name || desc) parts.push(`- producer activity "${name}": ${desc}`);
    }
  } catch { /* skip this evidence source */ }

  // (b) a recent impulse of this shape — show the LLM the pointer/structure,
  //     never the resolved content (which would require invoking the resolver).
  try {
    const esc = shape.replace(/"/g, '\\"');
    const [imps] = await sql(
      `SELECT pointer FROM impulse WHERE shape = "${esc}" ORDER BY created_at DESC LIMIT 1;`,
    );
    const p = (imps && imps[0]) ? imps[0].pointer : null;
    if (p) parts.push(`- recent impulse pointer structure: ${JSON.stringify(p).slice(0, 200)}`);
  } catch { /* skip this evidence source */ }

  return parts.join("\n");
}

/** Ask the canonical LLM resolver for ONE concrete line. Returns null on failure. */
async function generateDescription(shape: string, evidence: string): Promise<string | null> {
  const prompt =
    `You are cataloguing a software substrate's data resolvers so an automated planner ` +
    `can match goals to them. Write a SINGLE concise line (one sentence, <200 chars) ` +
    `describing the resolver that produces the shape "${shape}". ` +
    `Format strictly as: "produces <what>; use for <which goals>". ` +
    `Be concrete and grounded in the evidence; do not invent capabilities. ` +
    `Output ONLY the line, no preamble, no quotes.\n\n` +
    `Shape id: ${shape}\n` +
    (evidence ? `Evidence (read-only, gathered without invoking the resolver):\n${evidence}\n`
              : `No trace evidence available; infer conservatively from the shape id alone.\n`);

  try {
    const r = await fetch(`${LLM}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "llm_completion", prompt, model: LLM_MODEL, max_tokens: 120 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { resolved?: boolean; content?: string };
    if (!d.resolved || typeof d.content !== "string") return null;
    // One line, trimmed, bounded.
    let line = d.content.trim().split("\n")[0].trim();
    line = line.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (line.length < 8) return null;
    if (line.length > 240) line = line.slice(0, 240).trim();
    return line;
  } catch {
    return null;
  }
}

/** POST a learned description to discovery. Returns true on apply. */
async function postLearnedDescription(shape: string, description: string): Promise<boolean> {
  try {
    const r = await fetch(`${DISCOVERY}/registry/shape-descriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
      },
      body: JSON.stringify({ shape, description, source: "auto" }),
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!ENABLED) {
    console.log("[auto-describe] AUTO_DESCRIBE_RESOLVERS != 1 — no-op exit");
    return;
  }
  try {
    await Bun.write(`${METRICS_DIR}/.keep`, "").catch(() => {});
  } catch { /* ignore */ }

  const advertised = await fetchAdvertisedShapes();
  const described = await fetchDescribedShapes();

  // The gap: advertised − described, restricted to data/report/query shapes.
  const undescribed = advertised
    .filter((s) => !described.has(s))
    .filter((s) => !shouldSkip(s))
    .sort(); // stable order so the round-robin cursor is meaningful

  if (undescribed.length === 0) {
    console.log(`[auto-describe] no undescribed data shapes (advertised=${advertised.length}, described=${described.size})`);
    await appendLog({ event: "tick_noop", advertised: advertised.length, described: described.size, gap: 0 });
    return;
  }

  // Round-robin window over the backlog.
  const cursor = await readCursor();
  const start = undescribed.length > 0 ? ((cursor.index % undescribed.length) + undescribed.length) % undescribed.length : 0;
  const batch: string[] = [];
  for (let i = 0; i < Math.min(MAX_PER_TICK, undescribed.length); i++) {
    batch.push(undescribed[(start + i) % undescribed.length]);
  }
  await writeCursor({ index: (start + batch.length) % Math.max(undescribed.length, 1) });

  let applied = 0;
  for (const shape of batch) {
    try {
      const evidence = await gatherEvidence(shape);
      const description = await generateDescription(shape, evidence);
      if (!description) {
        await appendLog({ event: "describe", shape, description: null, applied: false, reason: "llm_no_output" });
        console.log(`[auto-describe] ${shape}: LLM produced no line — skipped`);
        continue;
      }
      const ok = await postLearnedDescription(shape, description);
      if (ok) applied++;
      await appendLog({ event: "describe", shape, description, applied: ok, evidence_chars: evidence.length });
      console.log(`[auto-describe] ${shape}: ${ok ? "APPLIED" : "post-failed"} :: ${description}`);
    } catch (e) {
      // Per-shape isolation — one failure never aborts the batch.
      await appendLog({ event: "describe", shape, description: null, applied: false, reason: String(e) });
    }
  }

  console.log(
    `[auto-describe] tick done: gap=${undescribed.length} batch=${batch.length} applied=${applied} ` +
    `(advertised=${advertised.length}, described=${described.size})`,
  );
  await appendLog({ event: "tick_done", gap: undescribed.length, batch: batch.length, applied, advertised: advertised.length, described: described.size });
}

main().catch((e) => {
  // Top-level guard — the tick must never crash the timer.
  console.error("[auto-describe] fatal (suppressed):", e);
});
