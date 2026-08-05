/**
 * ingest-docs-as-concepts — build + refresh the DOC-EXPECTATION surface.
 *
 * A document is an expectation the substrate holds about itself. This ingests each doc
 * SECTION into concept-db as an embedded concept (MiniLM), so the docs become resolvable/
 * searchable shapes: a planner/author dense-searches the relevant principle before acting
 * (feature-compose `consultPrinciples`, shape=architecturePrinciple), and the closure
 * detector (`docs-align-scan.ts`) dense-searches source_type=doc_expectation to find which
 * docs "expect" a landed code change (the dynamic doc↔code tie).
 *
 * IDEMPOTENT (upsert-by-section_key, ingest-side, no concept-db change): a local manifest
 * maps section_key -> { hash, id }. On each run a section is CREATED (POST, fresh embed),
 * UPDATED in place (PATCH /concepts/:id when its text changed — exactly one concept per
 * section_key, never a duplicate), or SKIPPED (unchanged). This makes it safe to run on a
 * timer. Caveat: PATCH updates content but does not re-embed, so a CHANGED section keeps its
 * prior embedding vector until concept-db grows re-embed-on-update; content is always current
 * and the doc_path the detector extracts is unaffected.
 *
 * Coverage: docs/** (excluding the historical archive), root CLAUDE.md, and each
 * repos/<vessel>/CLAUDE.md + README.md — the same watched set as docs-align-scan. Sections
 * split on level-2/3 headers; only sections >= MIN_SECTION_CHARS are ingested.
 *
 * EVICTION (the reap pass): create/update/skip alone make the surface append-only. A section
 * that is renamed, split, shrunk below MIN_SECTION_CHARS, or whose file is deleted or moved
 * keeps its concept forever, because section_key is derived from `<relpath>#<slug(heading)>`
 * and a changed key simply mints a new concept beside the old one. That is not merely untidy:
 * architecture concepts are dense-searched into the code-authoring prompt (top 4), so a stale
 * section competes with its own replacement for the drafter's attention indefinitely. After
 * ingest, any manifest key not re-seen this run is DELETEd from concept-db and dropped from
 * the manifest.
 *
 * The reap is deliberately timid, because deleting live expectations on a transient fault is
 * far worse than carrying a stale one for another six hours. `walkMd` swallows readdir errors
 * and returns what it has, so a partial filesystem read looks exactly like a mass deletion.
 * Three guards, each of which ABORTS the reap and reports rather than proceeding:
 *   - a forced run (INGEST_DOCS) reaps only within the files it was told to read, since it
 *     never looked at the others;
 *   - a file that could not be read this run keeps all of its sections;
 *   - a reap set exceeding REAP_MAX_FRACTION of the manifest is refused wholesale, which is
 *     what a truncated walk or an empty docs/ produces.
 * A refusal is reported as reap:"refused" with the count, never as a clean run.
 *
 * Env:
 *   INGEST_DOCS_ROOT   repo root to read docs from (default SUBSTRATE_ROOT | cwd)
 *   CONCEPT_DB_ENDPOINT concept-db (default http://127.0.0.1:8260)
 *   METABOB_API_KEY    auth (optional)
 *   INGEST_MANIFEST    upsert manifest path (default /workspace/.docs-ingest-manifest.json)
 *   INGEST_DOCS        comma list of doc relpaths to force (default: watched-set discovery)
 *   INGEST_DRYRUN      =1 -> print plan (create/update/skip/reap counts), write nothing
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = (process.env["INGEST_DOCS_ROOT"] ?? process.env["SUBSTRATE_ROOT"] ?? process.cwd()).replace(/\/$/, "");
const CONCEPT_DB = (process.env["CONCEPT_DB_ENDPOINT"] || "http://127.0.0.1:8260").replace(/\/$/, "");
const API_KEY = process.env["METABOB_API_KEY"] ?? "";
const MANIFEST_PATH = process.env["INGEST_MANIFEST"] ?? "/workspace/.docs-ingest-manifest.json";
const DRYRUN = process.env["INGEST_DRYRUN"] === "1";
const MIN_SECTION_CHARS = 200;
const MAX_CONTENT_CHARS = 2400;
// Above this share of the manifest, a reap set is treated as evidence that discovery failed
// rather than that the docs really changed that much. A genuine restructure lands in batches
// well under this; a truncated walk lands far above it.
const REAP_MAX_FRACTION = 0.25;

const authHeaders = { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) };
// concept-db embeds each POST synchronously (MiniLM) and runs its own background embed-
// backfill; ~1600 un-paced POSTs overwhelm it (non-ok under load). Pace + retry so a run
// converges instead of dropping most sections.
const PACE_MS = Number(process.env["INGEST_PACE_MS"] ?? "25");
const MAX_ATTEMPTS = Number(process.env["INGEST_MAX_ATTEMPTS"] ?? "3");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchRetry(url: string, init: RequestInit): Promise<Response | null> {
  for (let a = 1; a <= MAX_ATTEMPTS; a++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) return res; // client error — no retry
    } catch { /* network/timeout — retry */ }
    if (a < MAX_ATTEMPTS) await sleep(250 * a);
  }
  return null;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// Split a markdown doc into (heading, body) sections on level-2/3 headers.
function sections(md: string): Array<{ heading: string; body: string }> {
  const out: Array<{ heading: string; body: string }> = [];
  const parts = md.split(/\n(?=#{2,3} )/);
  for (const part of parts) {
    const m = part.match(/^#{2,3}\s+(.+)$/m);
    const heading = m?.[1]?.trim() ?? "(intro)";
    const body = part.replace(/^#{2,3}\s+.+$/m, "").trim();
    if (body.length >= MIN_SECTION_CHARS) out.push({ heading, body: body.slice(0, MAX_CONTENT_CHARS) });
  }
  return out;
}

// Watched-doc discovery — matches docs-align-scan's set.
async function walkMd(dir: string, relBase: string, out: string[]): Promise<void> {
  let entries: string[];
  try { entries = await readdir(dir); } catch { return; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git" || e === "dist" || e.startsWith(".")) continue;
    if (relBase === "docs" && e === "archive") continue;
    const abs = join(dir, e);
    let isDir = false;
    try { isDir = (await stat(abs)).isDirectory(); } catch { continue; }
    if (isDir) await walkMd(abs, join(relBase, e), out);
    else if (e.endsWith(".md")) out.push(join(relBase, e));
  }
}

async function watchedDocs(): Promise<string[]> {
  if (process.env["INGEST_DOCS"]) return process.env["INGEST_DOCS"].split(",").map((s) => s.trim()).filter(Boolean);
  const docs: string[] = [];
  await walkMd(join(ROOT, "docs"), "docs", docs);
  if (existsSync(join(ROOT, "CLAUDE.md"))) docs.push("CLAUDE.md");
  const reposRoot = join(ROOT, "repos");
  try {
    for (const v of (await readdir(reposRoot)).sort()) {
      if (v.startsWith(".")) continue;
      for (const name of ["CLAUDE.md", "README.md"]) {
        if (existsSync(join(reposRoot, v, name))) docs.push(`repos/${v}/${name}`);
      }
    }
  } catch { /* no repos dir */ }
  return docs;
}

type Manifest = Record<string, { hash: string; id: string }>;
function loadManifest(): Manifest {
  try { return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest; } catch { return {}; }
}

// architecture docs keep shape=architecturePrinciple (feature-compose consultPrinciples
// filters on it); every other watched doc is shape=docSection. All carry
// source_type=doc_expectation so docs-align-scan's dynamic tie finds them.
function shapeFor(relpath: string): string {
  return relpath.startsWith("docs/architecture/") ? "architecturePrinciple" : "docSection";
}

async function createConcept(relpath: string, heading: string, body: string, sectionKey: string): Promise<string | null> {
  try {
    const res = await fetchRetry(`${CONCEPT_DB}/concepts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        source_type: "doc_expectation",
        content: `${heading}\n\n${body}`,
        shape: shapeFor(relpath),
        summary: `${relpath}: ${heading}`.slice(0, 160),
        pointer: { type: "memo", path: relpath, doc_path: relpath, section: heading, section_key: sectionKey, source: "docs-expectation-ingest" },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res || !res.ok) return null;
    const c = (await res.json()) as { id?: string };
    return typeof c.id === "string" ? c.id : null;
  } catch { return null; }
}

// PATCH content in place (one concept per section_key; no duplicate). Returns ok.
async function patchConcept(id: string, relpath: string, heading: string, body: string): Promise<boolean> {
  try {
    const res = await fetchRetry(`${CONCEPT_DB}/concepts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ content: `${heading}\n\n${body}`, summary: `${relpath}: ${heading}`.slice(0, 160) }),
      signal: AbortSignal.timeout(30_000),
    });
    return !!res && res.ok;
  } catch { return false; }
}

// Retract a concept whose section no longer exists. A 404 counts as success: the goal is
// "this concept is not in the store", and something else having removed it already satisfies
// that just as well as our own delete does.
async function deleteConcept(id: string): Promise<boolean> {
  try {
    const res = await fetchRetry(`${CONCEPT_DB}/concepts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders,
      signal: AbortSignal.timeout(30_000),
    });
    return !!res && (res.ok || res.status === 404);
  } catch { return false; }
}

async function main(): Promise<void> {
  const docs = await watchedDocs();
  const forced = !!process.env["INGEST_DOCS"];
  const manifest = loadManifest();
  // Sized before ingest: a reap candidate can only come from a key that already existed, so
  // the pre-existing manifest is the population to take a fraction of. Measuring after the
  // loop would let a run that adds many new sections license a correspondingly larger reap.
  const priorSize = Object.keys(manifest).length;
  let created = 0, updated = 0, skipped = 0, failed = 0, scanned = 0;
  // Section keys observed this run, and the files we actually managed to read. A file missing
  // from `readOk` was never inspected, so its absence from `seenKeys` proves nothing.
  const seenKeys = new Set<string>();
  const readOk = new Set<string>();

  for (const relpath of docs) {
    let md: string;
    try { md = await readFile(join(ROOT, relpath), "utf8"); } catch { continue; }
    readOk.add(relpath);
    for (const s of sections(md)) {
      scanned++;
      const sectionKey = `${relpath}#${slug(s.heading)}`;
      seenKeys.add(sectionKey);
      const contentHash = hash(`${s.heading}\n\n${s.body}`);
      const prior = manifest[sectionKey];

      if (prior && prior.hash === contentHash) { skipped++; continue; }

      if (DRYRUN) { prior ? updated++ : created++; continue; }

      if (prior && prior.id) {
        // changed: update in place (bounded — never a duplicate)
        if (await patchConcept(prior.id, relpath, s.heading, s.body)) {
          manifest[sectionKey] = { hash: contentHash, id: prior.id };
          updated++;
          continue;
        }
        // PATCH failed (e.g. concept gone) — fall through to recreate
      }
      const id = await createConcept(relpath, s.heading, s.body, sectionKey);
      if (id) { manifest[sectionKey] = { hash: contentHash, id }; created++; }
      else failed++;
      if (PACE_MS > 0) await sleep(PACE_MS); // don't overwhelm concept-db's synchronous embed
    }
  }

  // ---- reap: retract concepts whose section no longer exists ----
  // A key is a candidate only when we can prove we looked. On a forced run that means the
  // file was named and read; on a full run it also covers a file that has left the watched
  // set entirely (deleted, moved, or now under docs/archive/), which is the case that a
  // rename or a restructure produces.
  const candidates = Object.keys(manifest).filter((key) => {
    if (seenKeys.has(key)) return false;
    const relpath = key.slice(0, key.lastIndexOf("#"));
    if (readOk.has(relpath)) return true;      // read it; this section is genuinely gone
    if (forced) return false;                  // never inspected the rest of the corpus
    return !docs.includes(relpath);            // dropped out of the watched set
  });

  const limit = Math.floor(priorSize * REAP_MAX_FRACTION);
  // An empty docs list is a failed walk, not an emptied repo — refuse outright rather than
  // reasoning about fractions of a manifest we could not verify against anything.
  const refused = docs.length === 0 || candidates.length > limit;
  let reaped = 0, reapFailed = 0;

  if (!refused && !DRYRUN) {
    for (const key of candidates) {
      const entry = manifest[key];
      if (entry?.id && await deleteConcept(entry.id)) { delete manifest[key]; reaped++; }
      else reapFailed++;
      if (PACE_MS > 0) await sleep(PACE_MS);
    }
  }

  if (!DRYRUN) { try { await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 0)); } catch { /* best-effort */ } }

  console.log(JSON.stringify({
    ingest: "docs-as-concepts",
    root: ROOT,
    docs: docs.length,
    scanned,
    created, updated, skipped, failed,
    // "refused" is a distinct outcome from a run with nothing to reap: it means eviction was
    // due and did not happen, which is a condition to act on rather than a clean result.
    reap: refused ? "refused" : DRYRUN ? "dryrun" : "ok",
    reapCandidates: candidates.length,
    reapLimit: limit,
    reaped, reapFailed,
    manifest: MANIFEST_PATH,
    dryrun: DRYRUN,
  }, null, 2));
}

main().catch((e) => { console.error("[ingest-docs] fatal", e); process.exit(1); });
