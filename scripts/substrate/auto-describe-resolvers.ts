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
 *    Evidence is the shape's OWN, read-only: the vessel that serves it, its resolver_schema
 *    (what it takes and answers) when its producer publishes one, the store write the same
 *    vessel serves for it (which makes it a store READ, described as "reads …"), and a
 *    recent impulse pointer of the shape. Never the descriptions of the vessel's OTHER
 *    shapes: a one-line summary given them borrowed their use clauses, so a store read
 *    was described as a product of whatever else its vessel does. Nor the templates that
 *    DECLARE the shape as an output: those are its internal use sites, and describing a
 *    shape by them told recall where it is used, not what it answers.
 *  - It SKIPS lifecycle/internal tick machinery. Served STORE WRITES (`*_write`,
 *    `*_delete`, `*_update`, `*_deprecate`, `*Write`) are described FIRST, and
 *    without the LLM: a write's description is DERIVED from what discovery itself
 *    advertises (the shape's object and effect, read from its id; the vessel that
 *    serves it; and that vessel's own described readers of the same object). A
 *    write with no description can never be a recalled target, so a goal that asks
 *    to CHANGE something a surface keeps was read as a report (writes used to be
 *    skipped here outright, so the tick logged "no undescribed data shapes" while
 *    every advertised write stayed undescribed). Derived text is the same on every
 *    run, so a re-description after a restart re-indexes nothing.
 *  - Bounded: at most MAX_PER_TICK LLM-described shapes per fire, round-robin over
 *    the backlog via a persisted cursor, so it works through the gap without flooding.
 *  - Only a shape a LIVE VESSEL serves (discovery's vesselCapability names one) is
 *    described; walk-minted composites (composedDeliverable_*) never are.
 *  - PROVENANCE: every learned description it posts names this tick and its run
 *    (source "auto-describe-resolvers@<run start ISO>"), which discovery keeps on the
 *    learned entry; the tick's log line carries the same run id and the DESCRIBER_VERSION
 *    that wrote it. The version lives in the log, the record this tick reads back:
 *    discovery's read serves the description text only, not its source.
 *  - SELF-HEAL: each run re-derives up to SWEEP_PER_RUN rows an OLDER describer version
 *    wrote (its log entry has no version or a lower one), store reads and other non-writes
 *    first (a write's derived line quotes its reader's first clause). A row is this
 *    describer's only while discovery still serves the exact text its log says it posted,
 *    so an advertised description, a walk_composite entry, or a row another writer set is
 *    never touched; nor is any pre-provenance row (a log entry with no run). A re-derivation
 *    identical to the served text is not posted (it is logged "unchanged", which marks the row
 *    current); every re-derived row's log line carries its before and after text, so each row's
 *    change, and any recall shift that follows, is attributable to this sweep.
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
/**
 * The version of how this describer gathers evidence and words a line. Bump it when a change makes rows it wrote before
 * wrong, so the sweep re-derives them. 1 = the unversioned rows (log entries with no describer_version); 2 = own
 * evidence only (no sibling descriptions) and the "reads" verb for a store read.
 */
export const DESCRIBER_VERSION = 2;
/** Bootstrap cap on older-version rows re-derived per run (the script reads no rhythm shape for it). */
export const SWEEP_PER_RUN = 5;
const METRICS_DIR = "/workspace/metrics";
let LOG = `${METRICS_DIR}/auto-describe.jsonl`;
let CURSOR = `${METRICS_DIR}/auto-describe-cursor.json`;

// Shapes the planner CANNOT usefully compose from a description: lifecycle/hub/
// internal tick machinery. Store writes are NOT skipped: they are what a goal that
// asks to change something targets (see effectOf below). Nor are *dispatch* shapes:
// a dispatch producer can be the very shape that answers a general goal, and an
// undescribed one is never recalled for it.
// Walk-minted composites (composedDeliverable_<goal text>) are skipped too: their producer is a learned template, not a
// vessel, and their names are goal text, so a description of one only draws unrelated goals to it.
const SKIP_PATTERNS: RegExp[] = [
  /tick/i, /lifecycle/i, /\bhook\b/i,
  /heartbeat/i, /register/i, /observer$/i, /sentinel/i, /_seed$/i,
  /^composedDeliverable_/,
];

export function shouldSkip(shape: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(shape));
}

/** The effect a store-write shape names, and the object it acts on, read from the shape id alone. */
// One effect word per suffix, and nothing else shared: every write's line is otherwise its own object's words, so a
// description never draws a goal by vocabulary all writes have in common (a goal saying "changed" must not recall
// every store write).
const EFFECTS: Record<string, string> = { write: "writes", update: "updates", delete: "deletes", deprecate: "deprecates" };
export function effectOf(shape: string): { stem: string; effect: string } | null {
  const m = /^(.+?)(?:_(write|update|delete|deprecate)|(Write))$/.exec(shape);
  return m ? { stem: m[1], effect: m[2] ?? "write" } : null;
}
/** "uiPanel" -> ["ui", "panel"]; "human_surface:ui_panel" -> ["human", "surface", "ui", "panel"]. */
export function objectWords(id: string): string[] {
  return id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).map((w) => w.toLowerCase()).filter(Boolean);
}

/** The store write a vessel serves for `shape` (shape_write, shapeWrite, …), making `shape` its store read; else null. */
export function pairedWriteOf(shape: string, siblings: Record<string, string | null>): string | null {
  if (effectOf(shape)) return null;
  return Object.keys(siblings).filter((s) => effectOf(s)?.stem === shape).sort()[0] ?? null;
}

export interface WriteAdvertisement {
  /** the live vessel discovery names as this shape's (first local) producer; null = none serves it, so it is not described */
  vessel: string | null;
  /** the shapes that vessel advertises, with their descriptions where discovery has one */
  siblings: Record<string, string | null>;
}

/**
 * A store write's description, DERIVED from its advertisement (no LLM, no per-shape text): the effect and object its
 * id names, the vessel that keeps it, and that vessel's described readers of the same object (a sibling shape whose
 * words contain every word of the object and which is not itself a write). Deterministic, so the same advertisement
 * always yields the same line.
 */
export function deriveWriteDescription(shape: string, ad: WriteAdvertisement): string | null {
  const eff = effectOf(shape);
  if (!eff || !ad.vessel) return null;
  const object = objectWords(eff.stem);
  if (object.length === 0) return null;
  const words = object.join(" ");
  const does = EFFECTS[eff.effect];
  const keeper = `the ${objectWords(ad.vessel).join(" ")} (${ad.vessel})`;
  let line = `${does} the ${words} kept by ${keeper}`;
  const readers = Object.entries(ad.siblings)
    .filter(([s, d]) => s !== shape && d && !effectOf(s) && object.every((w) => objectWords(s).includes(w)))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [s, d] of readers) {
    // the reader's own first clause (what it is), so its object words carry over without its use-for clause
    const what = (d as string).replace(/\s+/g, " ").split(";")[0].trim().replace(/[.]+$/, "").slice(0, 100);
    const add = `${line.includes("; read back as ") ? ", " : "; read back as "}${s} (${what})`;
    if (line.length + add.length > 290) break;
    line += add;
  }
  return line;
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

/** Currently-described shapes (advertised OR already learned), with their descriptions; null when unreadable. */
async function fetchDescriptions(): Promise<Record<string, string> | null> {
  try {
    const r = await fetch(`${DISCOVERY}/registry/shape-descriptions`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { shape_descriptions?: Record<string, string> };
    return d.shape_descriptions ?? {};
  } catch (e) {
    await appendLog({ event: "fetch_described_failed", error: String(e) });
    return null;
  }
}

/**
 * What discovery advertises about a shape's producer: vesselCapability names who serves the shape (the first
 * local row, as discovery's own pick prefers a direct producer), and GET /vessels/:id lists that vessel's shapes.
 * Read-only; never resolves the shape itself. Any failure leaves the part it could not read empty.
 */
async function fetchAdvertisement(shape: string, described: Record<string, string>): Promise<WriteAdvertisement> {
  const ad: WriteAdvertisement = { vessel: null, siblings: {} };
  try {
    const r = await fetch(`${DISCOVERY}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
      body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return ad;
    const rows = (((await r.json()) as { content?: { vessels?: Array<{ vesselId?: string; vesselName?: string; protocol?: string }> } }).content?.vessels) ?? [];
    const row = rows.find((v) => v.protocol !== "libp2p") ?? rows[0];
    if (!row?.vesselId) return ad;
    ad.vessel = String(row.vesselName || row.vesselId);
    const v = await fetch(`${DISCOVERY}/vessels/${encodeURIComponent(String(row.vesselId))}`, { signal: AbortSignal.timeout(10000) });
    if (v.ok) {
      const shapes = ((await v.json()) as { shapes?: unknown }).shapes;
      if (Array.isArray(shapes)) for (const s of shapes) if (typeof s === "string") ad.siblings[s] = described[s] ?? null;
    }
  } catch { /* unreadable: no live vessel named, so nothing is described from it this tick */ }
  return ad;
}

/** The shape's published contract (resolver_schema through discovery), or null when no producer answers one. */
async function fetchResolverSchema(shape: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${DISCOVERY}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
      body: JSON.stringify({ pointer: { type: "resolver_schema", shape } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, any>;
    const c = (d?.body ?? d?.content ?? d) as Record<string, unknown>;
    return c && c["shape"] === shape && c["known"] === true ? c : null;
  } catch { return null; }
}

/**
 * Gather SAFE evidence for a shape WITHOUT invoking its resolver, from the shape's OWN advertisement and contract:
 *  - the producer that serves it (discovery's advertisement, already read for the live-vessel check)
 *  - its resolver_schema when the producer publishes one (inputs taken, fields answered)
 *  - the store write its producer serves for it, when there is one (the shape is then that store's read)
 *  - a sample of recent impulse pointers of that shape (structure only)
 * Never another shape's description: the LLM summarised those into the line, so a shape read as whatever else its
 * vessel serves.
 */
export async function gatherEvidence(shape: string, ad: WriteAdvertisement): Promise<string> {
  const parts: string[] = [];
  if (ad.vessel) parts.push(`- produced by vessel ${ad.vessel}`);

  const schema = await fetchResolverSchema(shape);
  if (schema) {
    const fields = Array.isArray(schema["fields"]) ? (schema["fields"] as Array<{ name?: unknown; required?: unknown }>).map((f) => `${String(f?.name ?? "")}${f?.required ? "*" : ""}`).filter((n) => n && n !== "*") : [];
    const answers = Array.isArray(schema["response_fields"]) ? (schema["response_fields"] as unknown[]).map(String) : [];
    const env = typeof schema["envelope"] === "string" && schema["envelope"] ? ` under "${schema["envelope"]}"` : "";
    parts.push(`- contract (resolver_schema): takes ${fields.length ? fields.join(", ") : "no declared fields"}${env}${answers.length ? `; answers ${answers.join(", ")}` : ""}`.slice(0, 300));
  }
  const write = pairedWriteOf(shape, ad.siblings);
  if (write) parts.push(`- a store read: the producer also serves its write ${write}, so this shape reads back what that write keeps`);

  // a recent impulse of this shape: the pointer/structure, never the resolved content (which would invoke the resolver)
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
/** `verb` "reads" is a store read (its vessel serves the shape's write): the line says what it reads back, not "produces". */
export async function generateDescription(shape: string, evidence: string, verb: "produces" | "reads" = "produces"): Promise<string | null> {
  const prompt =
    `You are cataloguing a software substrate's data resolvers so an automated planner ` +
    `can match goals to them. Write a SINGLE concise line (one sentence, <200 chars) ` +
    `describing the resolver that ${verb === "reads" ? "reads back the stored records of" : "produces"} the shape "${shape}". ` +
    `Format strictly as: "${verb} <what>; use for <which goals>". ` +
    `Be concrete and grounded in the evidence; do not invent capabilities. ` +
    `Output ONLY the line, no preamble, no quotes.\n\n` +
    `Shape id: ${shape}\n` +
    (evidence ? `Evidence (read-only, gathered without invoking the resolver):\n${evidence}\n`
              : `No trace evidence available; infer conservatively from the shape id alone.\n`);

  try {
    const r = await fetch(`${LLM}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.METABOB_API_KEY ? { Authorization: `ApiKey ${process.env.METABOB_API_KEY}` } : {}) },
      body: JSON.stringify({ type: "llm_completion", prompt, model: LLM_MODEL, max_tokens: 120 }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.status === 401) { console.error("credential refused (401) — key stale? auto-describe: the llm resolver refused the node key; no description written (environment, not a failure)"); return null; }
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

/** One LLM-described line for a non-write shape a live vessel serves, from its own evidence; null when none. */
async function describeShape(shape: string, ad: WriteAdvertisement): Promise<{ description: string | null; evidence: string }> {
  const evidence = await gatherEvidence(shape, ad);
  return { description: await generateDescription(shape, evidence, pairedWriteOf(shape, ad.siblings) ? "reads" : "produces"), evidence };
}

/**
 * The rows an OLDER describer version wrote that discovery still serves as written: per shape, its latest applied
 * describe entry (or "unchanged" resweep entry) in this tick's log, when that entry carries a run (pre-provenance entries do not), has no
 * describer_version or a lower one, and its description is exactly the text discovery serves now (anything else
 * means another writer or an advertisement owns the shape). Non-writes first, then writes; each group sorted.
 */
export function olderVersionRows(logText: string, served: Record<string, string>): string[] {
  const latest = new Map<string, { run?: unknown; description?: unknown; describer_version?: unknown }>();
  for (const l of logText.split("\n")) {
    if (!l.trim()) continue;
    let e: any;
    try { e = JSON.parse(l); } catch { continue; }
    if (typeof e?.shape !== "string") continue;
    if ((e.event === "describe" && e.applied === true) || (e.event === "resweep" && e.outcome === "unchanged")) latest.set(e.shape, e);
  }
  const rows: string[] = [];
  for (const [shape, e] of latest) {
    if (typeof e.run !== "string" || !e.run) continue;
    const v = typeof e.describer_version === "number" ? e.describer_version : 1;
    if (v >= DESCRIBER_VERSION) continue;
    if (typeof e.description !== "string" || served[shape] !== e.description.trim()) continue;
    if (shouldSkip(shape)) continue;
    rows.push(shape);
  }
  const isWrite = (s: string) => effectOf(s) !== null;
  return [...rows.filter((s) => !isWrite(s)).sort(), ...rows.filter(isWrite).sort()];
}

/** POST a learned description to discovery. Returns true on apply. */
async function postLearnedDescription(shape: string, description: string, source: string): Promise<boolean> {
  try {
    const r = await fetch(`${DISCOVERY}/registry/shape-descriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
      },
      body: JSON.stringify({ shape, description, source }),
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** `metricsDir` is where the tick's log and cursor live (the timer's run uses the default). */
export async function main(metricsDir: string = METRICS_DIR): Promise<void> {
  if (!ENABLED) {
    console.log("[auto-describe] AUTO_DESCRIBE_RESOLVERS != 1 — no-op exit");
    return;
  }
  LOG = `${metricsDir}/auto-describe.jsonl`;
  CURSOR = `${metricsDir}/auto-describe-cursor.json`;
  try {
    await Bun.write(`${metricsDir}/.keep`, "").catch(() => {});
  } catch { /* ignore */ }
  const run = new Date().toISOString();
  const source = `auto-describe-resolvers@${run}`;

  const advertised = await fetchAdvertisedShapes();
  const descriptions = await fetchDescriptions();
  if (descriptions === null) {
    // Unreadable descriptions would make every advertised shape look undescribed: describe nothing this tick.
    console.log("[auto-describe] shape descriptions unreadable — nothing described this tick");
    return;
  }
  const described = new Set(Object.keys(descriptions));

  // Self-heal first: re-derive up to SWEEP_PER_RUN rows an older describer version wrote, readers before writes, each
  // post folded into the run's descriptions so a write re-derived after its reader quotes the reader's new line.
  let logText = "";
  try { if (await Bun.file(LOG).exists()) logText = await Bun.file(LOG).text(); } catch { /* no log: nothing to heal */ }
  let resweeps = 0;
  for (const shape of olderVersionRows(logText, descriptions).slice(0, SWEEP_PER_RUN)) {
    try {
      const ad = await fetchAdvertisement(shape, descriptions);
      if (!ad.vessel) {
        await appendLog({ event: "resweep", run, shape, applied: false, reason: "no_live_vessel" });
        continue;
      }
      const write = effectOf(shape) !== null;
      const got = write ? { description: deriveWriteDescription(shape, ad), evidence: "" } : await describeShape(shape, ad);
      if (!got.description) {
        await appendLog({ event: "resweep", run, shape, applied: false, reason: write ? "not_derivable" : "llm_no_output" });
        continue;
      }
      const before = descriptions[shape];
      if (got.description === before) {
        // identical to what discovery serves: no write; the entry marks the row current so it is not re-derived again
        await appendLog({ event: "resweep", run, shape, outcome: "unchanged", description: before, before, after: got.description, describer_version: DESCRIBER_VERSION });
        continue;
      }
      const ok = await postLearnedDescription(shape, got.description, source);
      if (ok) { resweeps++; descriptions[shape] = got.description; }
      await appendLog({ event: "describe", run, shape, description: got.description, applied: ok, describer_version: DESCRIBER_VERSION, resweep: true, before, after: got.description,
        ...(write ? { derived_from: "advertisement" } : { evidence_chars: got.evidence.length }) });
      console.log(`[auto-describe] ${shape}: ${ok ? "RE-DERIVED" : "post-failed"} (older describer version) :: ${got.description}`);
    } catch (e) {
      await appendLog({ event: "resweep", run, shape, applied: false, reason: String(e) });
    }
  }

  // The gap: advertised − described, minus internal machinery. Served store writes are described first, from their
  // advertisement (every one, each tick: no LLM is spent on them); the rest go through the bounded LLM window.
  const gap = advertised.filter((s) => !described.has(s)).filter((s) => !shouldSkip(s));
  const writes = gap.filter((s) => effectOf(s) !== null).sort();
  let derived = 0;
  for (const shape of writes) {
    try {
      const description = deriveWriteDescription(shape, await fetchAdvertisement(shape, descriptions));
      if (!description) {
        // only a shape a live vessel serves through its own advertisement is described
        await appendLog({ event: "describe", run, shape, description: null, applied: false, reason: "no_live_vessel" });
        continue;
      }
      const ok = await postLearnedDescription(shape, description, source);
      if (ok) derived++;
      await appendLog({ event: "describe", run, shape, description, applied: ok, describer_version: DESCRIBER_VERSION, derived_from: "advertisement" });
      console.log(`[auto-describe] ${shape}: ${ok ? "APPLIED" : "post-failed"} (derived) :: ${description}`);
    } catch (e) {
      await appendLog({ event: "describe", run, shape, description: null, applied: false, reason: String(e) });
    }
  }
  const undescribed = gap
    .filter((s) => effectOf(s) === null)
    .sort(); // stable order so the round-robin cursor is meaningful

  if (undescribed.length === 0) {
    console.log(`[auto-describe] no undescribed data shapes (advertised=${advertised.length}, described=${described.size}, writes derived=${derived}/${writes.length})`);
    await appendLog({ event: "tick_noop", run, advertised: advertised.length, described: described.size, gap: 0, writes: writes.length, derived, resweeps });
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
      const ad = await fetchAdvertisement(shape, descriptions);
      if (!ad.vessel) {
        await appendLog({ event: "describe", run, shape, description: null, applied: false, reason: "no_live_vessel" });
        continue;
      }
      const { description, evidence } = await describeShape(shape, ad);
      if (!description) {
        await appendLog({ event: "describe", shape, description: null, applied: false, reason: "llm_no_output" });
        console.log(`[auto-describe] ${shape}: LLM produced no line — skipped`);
        continue;
      }
      const ok = await postLearnedDescription(shape, description, source);
      if (ok) applied++;
      await appendLog({ event: "describe", run, shape, description, applied: ok, describer_version: DESCRIBER_VERSION, evidence_chars: evidence.length });
      console.log(`[auto-describe] ${shape}: ${ok ? "APPLIED" : "post-failed"} :: ${description}`);
    } catch (e) {
      // Per-shape isolation — one failure never aborts the batch.
      await appendLog({ event: "describe", shape, description: null, applied: false, reason: String(e) });
    }
  }

  console.log(
    `[auto-describe] tick done: gap=${undescribed.length} batch=${batch.length} applied=${applied} writes derived=${derived}/${writes.length} resweeps=${resweeps} ` +
    `(advertised=${advertised.length}, described=${described.size})`,
  );
  await appendLog({ event: "tick_done", run, gap: undescribed.length, batch: batch.length, applied, writes: writes.length, derived, resweeps, advertised: advertised.length, described: described.size });
}

// Run only as the entry point: credential-refused-branches.test.ts imports generateDescription, and the gate fixture
// auto-describe-served-writes.sh imports main.
if (import.meta.main) main().catch((e) => {
  // Top-level guard — the tick must never crash the timer.
  console.error("[auto-describe] fatal (suppressed):", e);
});
