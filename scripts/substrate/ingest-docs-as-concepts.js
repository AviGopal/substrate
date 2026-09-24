"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
 * A refusal is reported as reap:"refused" with the count, never as a clean run, and is filed
 * as a gap (substrateGap_write, stable id `docs-reap-refused`, so a timer that keeps refusing
 * updates one gap rather than minting one per run). A refusal leaves stale sections live in
 * the retrieval surface; a log line alone is read by no one, so the condition must land where
 * gap disposition can act on it. The gap follows the condition: a later run whose reap goes
 * through closes it. A run with nothing on record and nothing found (a volume whose checkout
 * is not populated yet) is not a refusal worth a gap: there is nothing stale to retain.
 * A gap write the gap store refuses is reported as reapGap:"failed", never as "filed".
 *
 * Env:
 *   INGEST_DOCS_ROOT   repo root to read docs from (default SUBSTRATE_ROOT | cwd)
 *   CONCEPT_DB_ENDPOINT concept-db (default http://127.0.0.1:8260)
 *   METABOB_API_KEY    auth (optional)
 *   INGEST_MANIFEST    upsert manifest path (default /workspace/.docs-ingest-manifest.json)
 *   INGEST_DOCS        comma list of doc relpaths to force (default: watched-set discovery)
 *   INGEST_DRYRUN      =1 -> print plan (create/update/skip/reap counts), write nothing
 *   DEV_VESSEL_ENDPOINT development-vessel, the gap store (default http://127.0.0.1:8090)
 */
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const ROOT = (process.env["INGEST_DOCS_ROOT"] ?? process.env["SUBSTRATE_ROOT"] ?? process.cwd()).replace(/\/$/, "");
const CONCEPT_DB = (process.env["CONCEPT_DB_ENDPOINT"] || "http://127.0.0.1:8260").replace(/\/$/, "");
const API_KEY = process.env["METABOB_API_KEY"] ?? "";
const MANIFEST_PATH = process.env["INGEST_MANIFEST"] ?? "/workspace/.docs-ingest-manifest.json";
const DRYRUN = process.env["INGEST_DRYRUN"] === "1";
const DEV_VESSEL = (process.env["DEV_VESSEL_ENDPOINT"] || process.env["DEVELOPMENT_VESSEL_URL"] || "http://127.0.0.1:8090").replace(/\/$/, "");
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchRetry(url, init) {
    for (let a = 1; a <= MAX_ATTEMPTS; a++) {
        try {
            const res = await fetch(url, init);
            if (res.ok)
                return res;
            if (res.status < 500 && res.status !== 429)
                return res; // client error — no retry
        }
        catch { /* network/timeout — retry */ }
        if (a < MAX_ATTEMPTS)
            await sleep(250 * a);
    }
    return null;
}
function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function hash(s) {
    return (0, node_crypto_1.createHash)("sha256").update(s).digest("hex").slice(0, 16);
}
// Split a markdown doc into (heading, body) sections on level-2/3 headers.
function sections(md) {
    const out = [];
    const parts = md.split(/\n(?=#{2,3} )/);
    for (const part of parts) {
        const m = part.match(/^#{2,3}\s+(.+)$/m);
        const heading = m?.[1]?.trim() ?? "(intro)";
        const body = part.replace(/^#{2,3}\s+.+$/m, "").trim();
        if (body.length >= MIN_SECTION_CHARS)
            out.push({ heading, body: body.slice(0, MAX_CONTENT_CHARS) });
    }
    return out;
}
// Watched-doc discovery — matches docs-align-scan's set.
async function walkMd(dir, relBase, out) {
    let entries;
    try {
        entries = await (0, promises_1.readdir)(dir);
    }
    catch {
        return;
    }
    for (const e of entries) {
        if (e === "node_modules" || e === ".git" || e === "dist" || e.startsWith("."))
            continue;
        if (relBase === "docs" && e === "archive")
            continue;
        const abs = (0, node_path_1.join)(dir, e);
        let isDir = false;
        try {
            isDir = (await (0, promises_1.stat)(abs)).isDirectory();
        }
        catch {
            continue;
        }
        if (isDir)
            await walkMd(abs, (0, node_path_1.join)(relBase, e), out);
        else if (e.endsWith(".md"))
            out.push((0, node_path_1.join)(relBase, e));
    }
}
async function watchedDocs() {
    if (process.env["INGEST_DOCS"])
        return process.env["INGEST_DOCS"].split(",").map((s) => s.trim()).filter(Boolean);
    const docs = [];
    await walkMd((0, node_path_1.join)(ROOT, "docs"), "docs", docs);
    if ((0, node_fs_1.existsSync)((0, node_path_1.join)(ROOT, "CLAUDE.md")))
        docs.push("CLAUDE.md");
    const reposRoot = (0, node_path_1.join)(ROOT, "repos");
    try {
        for (const v of (await (0, promises_1.readdir)(reposRoot)).sort()) {
            if (v.startsWith("."))
                continue;
            for (const name of ["CLAUDE.md", "README.md"]) {
                if ((0, node_fs_1.existsSync)((0, node_path_1.join)(reposRoot, v, name)))
                    docs.push(`repos/${v}/${name}`);
            }
        }
    }
    catch { /* no repos dir */ }
    return docs;
}
function loadManifest() {
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(MANIFEST_PATH, "utf8"));
    }
    catch {
        return {};
    }
}
// architecture docs keep shape=architecturePrinciple (feature-compose consultPrinciples
// filters on it); every other watched doc is shape=docSection. All carry
// source_type=doc_expectation so docs-align-scan's dynamic tie finds them.
function shapeFor(relpath) {
    return relpath.startsWith("docs/architecture/") ? "architecturePrinciple" : "docSection";
}
async function createConcept(relpath, heading, body, sectionKey) {
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
        if (!res || !res.ok)
            return null;
        const c = (await res.json());
        return typeof c.id === "string" ? c.id : null;
    }
    catch {
        return null;
    }
}
// PATCH content in place (one concept per section_key; no duplicate). Returns ok.
async function patchConcept(id, relpath, heading, body) {
    try {
        const res = await fetchRetry(`${CONCEPT_DB}/concepts/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify({ content: `${heading}\n\n${body}`, summary: `${relpath}: ${heading}`.slice(0, 160) }),
            signal: AbortSignal.timeout(30_000),
        });
        return !!res && res.ok;
    }
    catch {
        return false;
    }
}
// Retract a concept whose section no longer exists. A 404 counts as success: the goal is
// "this concept is not in the store", and something else having removed it already satisfies
// that just as well as our own delete does.
async function deleteConcept(id) {
    try {
        const res = await fetchRetry(`${CONCEPT_DB}/concepts/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: authHeaders,
            signal: AbortSignal.timeout(30_000),
        });
        return !!res && (res.ok || res.status === 404);
    }
    catch {
        return false;
    }
}
// A refused reap is a condition to act on: stale sections stay retrievable until someone
// reaps them. File it where gap disposition reads, not only in the journal.
const REAP_GAP_ID = "docs-reap-refused";
/**
 * POST one gap write. "ok" only when the gap store accepted it: the resolve route answers
 * HTTP 200 with success:false when the resolver refuses (validation and the like), so the
 * status code alone would read a refusal as a filed gap.
 */
async function writeGap(gap) {
    try {
        const res = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }),
            signal: AbortSignal.timeout(20_000),
        });
        let body = {};
        try {
            body = await res.json();
        }
        catch { /* not JSON */ }
        if (!res.ok || body.success !== true || body.shape === "structuredError") {
            const detail = body.body?.detail ?? body.error ?? body.body?.error ?? "no detail";
            return { ok: false, why: `http=${res.status} success=${String(body.success)} shape=${String(body.shape)}: ${String(detail).slice(0, 300)}` };
        }
        return { ok: true };
    }
    catch (e) {
        return { ok: false, why: e.message };
    }
}
async function fileReapRefusedGap(detail) {
    const emptyWalk = detail.docs === 0;
    const summary = emptyWalk
        ? `ingest-docs refused its reap: the doc walk found no documents, so ${detail.candidates.length} manifest section(s) ` +
            "could not be verified against anything; discovery failed and stale doc sections remain retrievable"
        : `ingest-docs refused to reap ${detail.candidates.length} stale doc section(s): over the safety limit of ${detail.limit} ` +
            `(${REAP_MAX_FRACTION * 100}% of ${detail.priorSize}); either the walk was truncated or the docs were restructured, ` +
            "and until a supervised reap runs the removed sections keep being retrieved";
    const r = await writeGap({
        id: REAP_GAP_ID,
        category: "documentation_drift",
        source: "substrate_detected",
        status: "open",
        detected_at: new Date().toISOString(),
        summary,
        classification_metadata: {
            detector: "ingest-docs-as-concepts",
            cause: emptyWalk ? "empty_walk" : "over_limit",
            reap_candidates: detail.candidates.length,
            reap_limit: detail.limit,
            manifest_size: detail.priorSize,
            docs_walked: detail.docs,
            forced: detail.forced,
            sample_candidates: detail.candidates.slice(0, 20),
            root: ROOT,
            manifest: MANIFEST_PATH,
        },
    });
    if (r.ok === false) {
        console.error(`[ingest-docs] reap refused; gap filing FAILED (${r.why}) — the refusal is recorded only in this log`);
        return "failed";
    }
    return "filed";
}
/** Close the refusal gap once a reap has gone through, if it is open. Reads first so a clean run writes nothing. */
async function closeReapRefusedGap(reaped) {
    let open;
    try {
        const res = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ impulse: { type: "substrateGap", id: REAP_GAP_ID, limit: 1 } }),
            signal: AbortSignal.timeout(20_000),
        });
        const body = await res.json();
        if (!res.ok || body.success !== true) {
            console.error(`[ingest-docs] could not read gap ${REAP_GAP_ID} (http=${res.status}); it stays as it is`);
            return "failed";
        }
        open = (body.body?.gaps ?? []).find((g) => g["id"] === REAP_GAP_ID && g["status"] === "open");
    }
    catch (e) {
        console.error(`[ingest-docs] could not read gap ${REAP_GAP_ID}: ${e.message}; it stays as it is`);
        return "failed";
    }
    if (!open)
        return "none";
    const r = await writeGap({
        ...open,
        status: "closed",
        closed_reason: "violation_not_reproduced_on_rescan",
        classification_metadata: {
            ...(open["classification_metadata"] ?? {}),
            closed_by_run: { at: new Date().toISOString(), reaped },
        },
    });
    if (r.ok === false) {
        console.error(`[ingest-docs] reap went through but closing gap ${REAP_GAP_ID} FAILED (${r.why})`);
        return "failed";
    }
    return "closed";
}
async function main() {
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
    const seenKeys = new Set();
    const readOk = new Set();
    for (const relpath of docs) {
        let md;
        try {
            md = await (0, promises_1.readFile)((0, node_path_1.join)(ROOT, relpath), "utf8");
        }
        catch {
            continue;
        }
        readOk.add(relpath);
        for (const s of sections(md)) {
            scanned++;
            const sectionKey = `${relpath}#${slug(s.heading)}`;
            seenKeys.add(sectionKey);
            const contentHash = hash(`${s.heading}\n\n${s.body}`);
            const prior = manifest[sectionKey];
            if (prior && prior.hash === contentHash) {
                skipped++;
                continue;
            }
            if (DRYRUN) {
                prior ? updated++ : created++;
                continue;
            }
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
            if (id) {
                manifest[sectionKey] = { hash: contentHash, id };
                created++;
            }
            else
                failed++;
            if (PACE_MS > 0)
                await sleep(PACE_MS); // don't overwhelm concept-db's synchronous embed
        }
    }
    // ---- reap: retract concepts whose section no longer exists ----
    // A key is a candidate only when we can prove we looked. On a forced run that means the
    // file was named and read; on a full run it also covers a file that has left the watched
    // set entirely (deleted, moved, or now under docs/archive/), which is the case that a
    // rename or a restructure produces.
    const candidates = Object.keys(manifest).filter((key) => {
        if (seenKeys.has(key))
            return false;
        const relpath = key.slice(0, key.lastIndexOf("#"));
        if (readOk.has(relpath))
            return true; // read it; this section is genuinely gone
        if (forced)
            return false; // never inspected the rest of the corpus
        return !docs.includes(relpath); // dropped out of the watched set
    });
    const limit = Math.floor(priorSize * REAP_MAX_FRACTION);
    // An empty docs list is a failed walk, not an emptied repo — refuse outright rather than
    // reasoning about fractions of a manifest we could not verify against anything.
    const refused = docs.length === 0 || candidates.length > limit;
    let reaped = 0, reapFailed = 0;
    if (!refused && !DRYRUN) {
        for (const key of candidates) {
            const entry = manifest[key];
            if (entry?.id && await deleteConcept(entry.id)) {
                delete manifest[key];
                reaped++;
            }
            else
                reapFailed++;
            if (PACE_MS > 0)
                await sleep(PACE_MS);
        }
    }
    if (!DRYRUN) {
        try {
            await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 0));
        }
        catch { /* best-effort */ }
    }
    // Nothing on record and nothing found: a checkout not populated yet, with no stale
    // section to retain. Refused (never a clean reap), but not a gap.
    const nothingToVerify = candidates.length === 0 && priorSize === 0;
    const reapGap = DRYRUN
        ? null
        : refused
            ? (nothingToVerify ? "not_filed_nothing_on_record" : await fileReapRefusedGap({ candidates, limit, priorSize, docs: docs.length, forced }))
            : await closeReapRefusedGap(reaped);
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
        reapGap,
        manifest: MANIFEST_PATH,
        dryrun: DRYRUN,
    }, null, 2));
}
main().catch((e) => { console.error("[ingest-docs] fatal", e); process.exit(1); });
//# sourceMappingURL=ingest-docs-as-concepts.js.map