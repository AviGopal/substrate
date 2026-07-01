#!/usr/bin/env bun
/**
 * docs-align-scan.ts — CLOSURE detector for documentation-as-expectation.
 *
 * A document is an expectation the substrate holds about itself. An activity changes
 * reality (a commit lands code/config); closure = verify the actual change against the
 * documented expectation, and if the doc's expectation was FALSIFIED, emit a grounded
 * `documentation_drift` substrateGap. This is the DETECTION half (report-only); the
 * authoring/land half is the `doc_drift_fix` resolver (Phase 2). We caught this class
 * live: docs/SUBSTRATE.md asserted "federation is not yet active" after federation went
 * live (fixed in 46d982c9).
 *
 * WHY not a staleness linter: "N commits behind" only says WHICH doc to look at, not WHAT
 * is wrong. Staleness is the cheap TRIGGER; the grounded signal is an LLM reach-judge
 * (the doc analogue of goal-host's verifyGoalReached) run over (the doc's text + the diff
 * of what changed since the doc was last touched), which names the specific falsified
 * sentence. High precision over recall — a false positive costs a report row, never a bad
 * land (Phase 1 authors nothing).
 *
 * TWO TRIGGERS (operator: "tie docs to code / commits / recent events dynamically"):
 *   A. change-driven DYNAMIC tie — dense-search concept-db (source_type=doc_expectation)
 *      with a summary of the recent landed change; the near doc-concepts are the docs that
 *      "expect" that code. Requires ingest-docs-as-concepts to have populated the surface.
 *   B. staleness FALLBACK — a watched doc that is >= threshold code-commits behind its own
 *      last-touch, for docs not yet in concept-db. `git log` in the push clone.
 * Candidates = A ∪ B, capped. Each is grounded + judged; drifted ones emit ONE gap.
 *
 * REUSE: writeGap/substrateGap_write + deterministic hex id + DRYRUN + CAP (surgical-gap-
 * scan.ts); `sh()` git idiom (self-operational-health.ts:116); haiku llm_completion call
 * (auto-describe-resolvers.ts:170); concept-db /concepts/search (feature-compose
 * consultPrinciples). NEW: only the doc-as-expectation orchestration + the reach-judge
 * prompt. Runs against the in-container push CLONE (landed truth), NOT the host bind.
 *
 * Env:
 *   DEV_VESSEL_ENDPOINT    dev-vessel resolve endpoint (default http://127.0.0.1:8090)
 *   LLM_VESSEL_ENDPOINT    llm-resolver (default http://127.0.0.1:8220)
 *   DOCS_ALIGN_MODEL       reach-judge model (default claude-haiku-4-5)
 *   CONCEPT_DB_ENDPOINT    concept-db (default http://127.0.0.1:8260)
 *   DOCS_ALIGN_ROOT        git root to scan (default /workspace/git/super-repo — the push clone)
 *   METABOB_API_KEY        auth for concept-db search (optional)
 *   DOCS_ALIGN_CAP         max gaps to emit per run (default 5)
 *   DOCS_ALIGN_STALE_MIN   min code-commits-behind to be a staleness candidate (default 1)
 *   DOCS_ALIGN_WINDOW      commits to look back for the change window on first run (default 15)
 *   DOCS_ALIGN_DOCS        comma list of doc relpaths to force (default: watched-set discovery)
 *   DOCS_ALIGN_DRYRUN      =1 -> print candidates + verdicts, write nothing (no gap, no watermark)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DEV_VESSEL = (process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090").replace(/\/$/, "");
const LLM = (process.env.LLM_VESSEL_ENDPOINT ?? "http://127.0.0.1:8220").replace(/\/$/, "");
const LLM_MODEL = process.env.DOCS_ALIGN_MODEL ?? "claude-haiku-4-5";
const CONCEPT_DB = (process.env.CONCEPT_DB_ENDPOINT ?? "http://127.0.0.1:8260").replace(/\/$/, "");
const ROOT = (process.env.DOCS_ALIGN_ROOT ?? "/workspace/git/super-repo").replace(/\/$/, "");
const API_KEY = process.env.METABOB_API_KEY ?? "";
const CAP = Number(process.env.DOCS_ALIGN_CAP ?? "5");
const STALE_MIN = Number(process.env.DOCS_ALIGN_STALE_MIN ?? "1");
const WINDOW = Number(process.env.DOCS_ALIGN_WINDOW ?? "15");
const DRYRUN = process.env.DOCS_ALIGN_DRYRUN === "1";
const WATERMARK = process.env.DOCS_ALIGN_WATERMARK ?? "/workspace/.docs-align-last-sha";

// The code trees a doc can describe. A doc drifts when THESE changed but the doc did not.
const CODE_PATHSPECS = ["repos", "scripts", "packages"];
const DIFF_BUDGET = 6000; // chars of diff fed to the judge (bounded, like the semantic gate)
const DOC_BUDGET = 8000; // chars of doc text fed to the judge

function sh(cmd: string[], timeoutMs = 15000): { ok: boolean; out: string } {
  try {
    const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe", timeout: timeoutMs });
    return { ok: p.exitCode === 0, out: new TextDecoder().decode(p.stdout).trim() };
  } catch (e) {
    return { ok: false, out: (e as Error).message };
  }
}
const git = (args: string[], t = 15000) => sh(["git", "-C", ROOT, ...args], t);

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// ── watched-doc discovery ───────────────────────────────────────────────────
// docs/**/*.md (excluding the historical archive), root CLAUDE.md, and each
// repos/<vessel>/CLAUDE.md + README.md. No per-doc glob map — the tie is dynamic
// (dense search) + staleness. An explicit DOCS_ALIGN_DOCS override pins a subset.
function walkMd(dir: string, relBase: string, out: string[], cap = 2000): void {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (out.length >= cap) return;
    if (e === "node_modules" || e === ".git" || e === "dist" || e.startsWith(".")) continue;
    if (relBase === "docs" && e === "archive") continue; // skip historical archive
    const abs = join(dir, e);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) walkMd(abs, join(relBase, e), out, cap);
    else if (e.endsWith(".md")) out.push(join(relBase, e));
  }
}

function watchedDocs(): string[] {
  if (process.env.DOCS_ALIGN_DOCS) {
    return process.env.DOCS_ALIGN_DOCS.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const docs: string[] = [];
  walkMd(join(ROOT, "docs"), "docs", docs);
  if (existsSync(join(ROOT, "CLAUDE.md"))) docs.push("CLAUDE.md");
  const reposRoot = join(ROOT, "repos");
  try {
    for (const v of readdirSync(reposRoot).sort()) {
      if (v.startsWith(".")) continue;
      for (const name of ["CLAUDE.md", "README.md"]) {
        if (existsSync(join(reposRoot, v, name))) docs.push(`repos/${v}/${name}`);
      }
    }
  } catch { /* no repos dir */ }
  return docs;
}

// ── per-doc staleness (Trigger B) ───────────────────────────────────────────
interface DocState {
  relpath: string;
  lastSha: string; // last commit that touched the doc
  codeCommitsBehind: number; // code commits since lastSha
}

function docState(relpath: string): DocState | null {
  const last = git(["log", "-1", "--format=%H", "--", relpath]);
  if (!last.ok || !last.out) return null; // untracked doc — skip (no baseline)
  const lastSha = last.out.split("\n")[0]!.trim();
  const behind = git(["rev-list", "--count", `${lastSha}..HEAD`, "--", ...CODE_PATHSPECS]);
  const n = behind.ok ? parseInt(behind.out || "0", 10) || 0 : 0;
  return { relpath, lastSha, codeCommitsBehind: n };
}

// ── change window + dynamic tie (Trigger A) ─────────────────────────────────
function changeWindowBase(): string {
  try {
    if (existsSync(WATERMARK)) {
      const sha = readFileSync(WATERMARK, "utf8").trim();
      // validate it's an ancestor of HEAD (a rebase/reset could orphan it)
      if (sha && git(["merge-base", "--is-ancestor", sha, "HEAD"]).ok) return sha;
    }
  } catch { /* fall through */ }
  const base = git(["rev-parse", `HEAD~${WINDOW}`]);
  return base.ok && base.out ? base.out.split("\n")[0]!.trim() : "";
}

function recentChangeSummary(base: string): { summary: string; commitCount: number } {
  if (!base) return { summary: "", commitCount: 0 };
  const log = git(["log", `${base}..HEAD`, "--format=%s", "--", ...CODE_PATHSPECS]);
  const subjects = log.ok ? log.out.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  const files = git(["diff", "--name-only", `${base}..HEAD`, "--", ...CODE_PATHSPECS]);
  const topDirs = new Set<string>();
  if (files.ok) for (const f of files.out.split("\n")) { const seg = f.split("/").slice(0, 2).join("/"); if (seg) topDirs.add(seg); }
  const summary = [subjects.slice(0, 25).join("; "), [...topDirs].slice(0, 20).join(", ")].filter(Boolean).join(" | ");
  return { summary: summary.slice(0, 1200), commitCount: subjects.length };
}

// Dense-search concept-db for doc-expectation concepts near the change summary.
// Returns the set of doc relpaths those concepts point at. Degrades to empty on any
// failure (Trigger B still covers the docs).
async function docsNearChange(changeSummary: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!changeSummary) return out;
  try {
    const params = new URLSearchParams({ query: changeSummary.slice(0, 400), source_type: "doc_expectation", limit: "8" });
    const r = await fetch(`${CONCEPT_DB}/concepts/search?${params.toString()}`, {
      headers: { ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return out;
    const body = (await r.json()) as { concepts?: Array<{ pointer?: { path?: string; doc_path?: string } }> };
    for (const c of body.concepts ?? []) {
      const p = c.pointer?.doc_path ?? c.pointer?.path;
      if (p) out.add(p.replace(/^\.\//, ""));
    }
  } catch { /* concept-db unreachable — staleness fallback still applies */ }
  return out;
}

// ── the reach-judge (doc analogue of verifyGoalReached) ─────────────────────
interface DriftClaim { quote: string; contradicted_by: string; correction_hint: string; }
interface DriftVerdict { drifted: boolean; claims: DriftClaim[]; }

async function judgeDrift(relpath: string, docText: string, diff: string, changeSummary: string): Promise<DriftVerdict | null> {
  const prompt =
    `You verify whether a software system's DOCUMENTATION still matches its CODE. ` +
    `A document is an EXPECTATION the system asserts about itself; a code change may have ` +
    `FALSIFIED a specific claim. Report drift ONLY when a SPECIFIC sentence in the doc ` +
    `asserts something the code changes show is no longer true (e.g. "X is not yet active" ` +
    `after X went live; a renamed/removed endpoint, flag, port, or path still stated as current; ` +
    `a described behaviour the diff clearly changed). General staleness, incompleteness, or "could ` +
    `mention the new thing" is NOT drift — do not invent claims. If nothing is clearly falsified, ` +
    `return {"drifted": false, "claims": []}. Quote the doc's wording VERBATIM in each claim so it ` +
    `can be located exactly.\n\n` +
    `DOC: ${relpath}\n` +
    `----- DOC TEXT (truncated) -----\n${docText.slice(0, DOC_BUDGET)}\n` +
    `----- RECENT CODE CHANGES (subjects | areas) -----\n${changeSummary || "(none summarized)"}\n` +
    `----- DIFF SINCE THE DOC WAS LAST TOUCHED (truncated) -----\n${diff.slice(0, DIFF_BUDGET)}\n\n` +
    `Respond with STRICT JSON only, no prose, no markdown fence:\n` +
    `{"drifted": boolean, "claims": [{"quote": "<verbatim doc sentence>", "contradicted_by": "<file/commit/what changed>", "correction_hint": "<how to fix, one phrase>"}]}`;

  try {
    const r = await fetch(`${LLM}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "llm_completion", prompt, model: LLM_MODEL, max_tokens: 700 }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { resolved?: boolean; content?: string };
    if (!d.resolved || typeof d.content !== "string") return null;
    let text = d.content.trim();
    // tolerate a ```json fence or leading prose
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1]!.trim();
    const brace = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (brace < 0 || end < brace) return null;
    const parsed = JSON.parse(text.slice(brace, end + 1)) as DriftVerdict;
    if (typeof parsed.drifted !== "boolean") return null;
    parsed.claims = Array.isArray(parsed.claims)
      ? parsed.claims.filter((c) => c && typeof c.quote === "string" && c.quote.trim().length > 0)
          .map((c) => ({ quote: String(c.quote).slice(0, 400), contradicted_by: String(c.contradicted_by ?? "").slice(0, 300), correction_hint: String(c.correction_hint ?? "").slice(0, 300) }))
      : [];
    // A "drifted:true" with zero locatable claims is not actionable — treat as no drift.
    if (parsed.drifted && parsed.claims.length === 0) parsed.drifted = false;
    return parsed;
  } catch {
    return null;
  }
}

// ── gap construction + write (reuse surgical-gap-scan contract) ─────────────
function gapFromDrift(st: DocState, verdict: DriftVerdict, headSha: string, trigger: string) {
  // Deterministic hex id keyed on (doc, doc's last sha, HEAD): re-runs at the same
  // landed state UPSERT the same row (no thrash); a new code commit -> new HEAD ->
  // a fresh gap only if the judge still finds drift.
  const hash = createHash("sha256").update(`${st.relpath}|${st.lastSha}|${headSha}`).digest("hex").slice(0, 10);
  const id = `docdrift-${slug(st.relpath)}-${hash}`;
  const claimLines = verdict.claims.map((c, i) => `${i + 1}. "${c.quote}" — ${c.contradicted_by}${c.correction_hint ? ` (fix: ${c.correction_hint})` : ""}`).join("\n");
  const summary =
    `Documentation drift in ${st.relpath}: ${verdict.claims.length} claim(s) falsified by code changes since the doc was last touched (${st.codeCommitsBehind} code commits behind; trigger=${trigger}). ` +
    `The doc asserts things the code no longer does. First: "${verdict.claims[0]!.quote.slice(0, 140)}".`;
  return {
    id,
    category: "documentation_drift" as const,
    source: "substrate_detected" as const,
    summary,
    detected_at: new Date().toISOString(),
    status: "open" as const,
    classification_metadata: {
      detector: "docs-align-scan",
      trigger, // "dense_search" | "staleness"
      doc_path: st.relpath,
      file_path: st.relpath,
      edit_site: st.relpath,
      single_file: true,
      doc_last_sha: st.lastSha,
      head_sha: headSha,
      code_commits_behind: st.codeCommitsBehind,
      drift_report: { claims: verdict.claims },
      proposed_fix: `Update ${st.relpath} to remove/correct exactly these falsified claims (change nothing else):\n${claimLines}`,
    },
  };
}

async function writeGap(gap: ReturnType<typeof gapFromDrift>): Promise<{ ok: boolean; action?: string; error?: string }> {
  try {
    const resp = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return { ok: false, error: `http ${resp.status}` };
    const body = (await resp.json())?.body ?? {};
    return { ok: true, action: body.action };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  const headR = git(["rev-parse", "HEAD"]);
  const headSha = headR.ok ? headR.out.split("\n")[0]!.trim() : "";
  if (!headSha) {
    console.log(JSON.stringify({ detector: "docs-align-scan", error: `not a git repo at ${ROOT}` }, null, 2));
    process.exit(1);
  }

  const docs = watchedDocs();
  const states = new Map<string, DocState>();
  for (const d of docs) { const st = docState(d); if (st) states.set(d, st); }

  // Trigger A: dense-search doc-expectation concepts near the recent change window.
  const base = changeWindowBase();
  const { summary: changeSummary, commitCount } = recentChangeSummary(base);
  const nearDocs = await docsNearChange(changeSummary);

  // Candidate set: (A) docs near the change that are also >=1 commit behind, UNION
  // (B) any watched doc >= STALE_MIN code-commits behind. Tag each with its trigger.
  const candidates: Array<{ st: DocState; trigger: string }> = [];
  const seen = new Set<string>();
  for (const d of nearDocs) {
    const st = states.get(d) ?? states.get(d.replace(/^docs\//, "docs/"));
    if (st && st.codeCommitsBehind > 0 && !seen.has(st.relpath)) { candidates.push({ st, trigger: "dense_search" }); seen.add(st.relpath); }
  }
  for (const st of states.values()) {
    if (st.codeCommitsBehind >= STALE_MIN && !seen.has(st.relpath)) { candidates.push({ st, trigger: "staleness" }); seen.add(st.relpath); }
  }
  // Dynamic (dense_search) candidates FIRST — they are semantically tied to the recent
  // change, so the likeliest to carry actionable drift; staleness fallback after, most-stale
  // first. This spends the capped LLM budget on change-relevant docs before ancient ones.
  const trigRank = (t: string) => (t === "dense_search" ? 0 : 1);
  candidates.sort((a, b) =>
    trigRank(a.trigger) - trigRank(b.trigger) ||
    b.st.codeCommitsBehind - a.st.codeCommitsBehind ||
    a.st.relpath.localeCompare(b.st.relpath));
  const selected = candidates.slice(0, Math.max(0, CAP));

  const results: Array<Record<string, unknown>> = [];
  let emitted = 0;
  for (const { st, trigger } of selected) {
    let docText = "";
    try { docText = readFileSync(join(ROOT, st.relpath), "utf8"); } catch { /* skip */ }
    const diff = git(["diff", `${st.lastSha}..HEAD`, "--", ...CODE_PATHSPECS]).out;
    const verdict = await judgeDrift(st.relpath, docText, diff, changeSummary);
    if (!verdict) { results.push({ doc: st.relpath, trigger, judge: "error/no-verdict", behind: st.codeCommitsBehind }); continue; }
    if (!verdict.drifted) { results.push({ doc: st.relpath, trigger, drifted: false, behind: st.codeCommitsBehind }); continue; }
    const gap = gapFromDrift(st, verdict, headSha, trigger);
    if (DRYRUN) {
      results.push({ doc: st.relpath, trigger, drifted: true, claims: verdict.claims.length, gap_id: gap.id, dryrun: true });
      continue;
    }
    const w = await writeGap(gap);
    if (w.ok) emitted++;
    results.push({ doc: st.relpath, trigger, drifted: true, claims: verdict.claims.length, gap_id: gap.id, ...w });
  }

  // Advance the change-window watermark to HEAD (only on a real, non-dry run) so the
  // next tick's Trigger A window is just the newly-landed commits.
  if (!DRYRUN) { try { await Bun.write(WATERMARK, headSha); } catch { /* best-effort */ } }

  console.log(JSON.stringify({
    detector: "docs-align-scan",
    root: ROOT,
    head_sha: headSha,
    window_base: base || null,
    window_commit_count: commitCount,
    watched_docs: docs.length,
    candidates: candidates.length,
    cap: CAP,
    judged: selected.length,
    emitted_count: emitted,
    dryrun: DRYRUN,
    results,
  }, null, 2));
}

await main();
