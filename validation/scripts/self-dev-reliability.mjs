#!/usr/bin/env node
/**
 * Self-Development Reliability — measures whether the substrate's OWN autonomous changes
 * are correct, over a window. This is the instrument for the "90%+ over the next 50
 * changes" bar. Unlike the goal-expectation harness (synthetic goals), this classifies
 * the loop's REAL landed output.
 *
 * Category 1 (this file): CODE CHANGES — Substrate-Autonomous commits across the vessels.
 * Each commit is classified by an INDEPENDENT check on its diff, not by its reach verdict:
 *   CORRECT     — changes/adds real code, or a test that imports a real vessel module,
 *                 AND is not a duplicate re-application of an already-landed route-edit.
 *   INERT       — adds only comments/whitespace, OR a new *.test.ts that imports NOTHING
 *                 from the vessel's own source (a tautological self-test — the 8eff84d
 *                 signature). Lands green, improves nothing.
 *   DUPLICATE   — the same route-edit-<hash> was applied by an earlier commit (0e29710
 *                 signature — the treadmill).
 * Reliability = CORRECT / total. Target: >= 90% over the last N (default 50).
 *
 * Usage:  node validation/scripts/self-dev-reliability.mjs [N] [--repos a,b,c]
 * (Runs on the host with git access; pure git + text analysis, no LLM.)
 *
 * Categories 2-4 (activity creation, variant creation, learning) need activity-api
 * queries and are stubbed with their oracle definitions at the bottom — the same
 * independent-check pattern, extended per category.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 50);
const reposArg = process.argv.includes("--repos") ? process.argv[process.argv.indexOf("--repos") + 1] : null;
const ROOT = "/home/avi/documents/work/substrate";
const REPOS = reposArg ? reposArg.split(",") : ["development-vessel", "goal-host-vessel", "activity-api", "ias-executor-ts", "discovery-vessel", "concept-db", "ribosome-vessel", "llm-resolver-vessel"];

function git(repo, cmd) {
  try { return execSync(`git -C ${ROOT}/repos/${repo} ${cmd}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }); }
  catch { return ""; }
}

// Collect Substrate-Authored commits across repos, newest first, capped at N total.
const commits = [];
for (const repo of REPOS) {
  if (!existsSync(`${ROOT}/repos/${repo}/.git`)) continue;
  const log = git(repo, `log --author=Substrate --no-merges --format=%H%x09%ct%x09%s -n ${N}`).trim();
  for (const line of log.split("\n").filter(Boolean)) {
    const [hash, ct, subject] = line.split("\t");
    commits.push({ repo, hash, ct: Number(ct), subject: subject ?? "" });
  }
}
commits.sort((a, b) => b.ct - a.ct);
const window = commits.slice(0, N);

const routeEditSeen = new Map(); // route-edit hash -> first commit that applied it
function classify(c) {
  const re = (c.subject.match(/route-edit-([a-f0-9]+)/) ?? [])[1];
  if (re) {
    if (routeEditSeen.has(re)) return { cls: "DUPLICATE", why: `route-edit-${re} already applied by ${routeEditSeen.get(re).slice(0, 7)}` };
    routeEditSeen.set(re, c.hash);
  }
  const diff = git(c.repo, `show ${c.hash} --format= --unified=0`);
  const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  const addedCode = added.map((l) => l.slice(1)).filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l));
  if (addedCode.length === 0) return { cls: "INERT", why: "only comments/whitespace added (zero behaviour delta)" };
  // Files touched.
  const files = git(c.repo, `show ${c.hash} --format= --name-only`).trim().split("\n").filter(Boolean);
  const onlyNewTests = files.length > 0 && files.every((f) => /\.test\.ts$/.test(f));
  if (onlyNewTests) {
    // A test that imports NO real vessel module (only bun:test / node builtins) is a
    // tautological self-test — the 8eff84d signature.
    const importsRealModule = /import\s+\{[^}]*\}\s+from\s+["']\.\/(?!.*\.test)/.test(diff) || /from\s+["']\.\.\/src\//.test(diff);
    if (!importsRealModule) return { cls: "INERT", why: "new test imports no real vessel module (tautological self-test)" };
  }
  return { cls: "CORRECT", why: onlyNewTests ? "test imports & exercises real vessel code" : "changes real source" };
}

// ── Tier 3: CONSEQUENCE legs (the architecture's intended correctness measure). ──
// A commit-time grader reads a description and can be fooled by a plausible one (law 12);
// correctness is temporal (law 7 durability leg). So beyond the tier-1 STRUCTURAL class
// above, score each commit by what HAPPENED:
//   (a) STAYED      — still on origin/dev (not reverted).
//   (b) NON-TREADMILL — its edit target is not a gap-class that keeps recurring: the
//       number of autonomous commits touching the SAME file must be below a recurrence
//       threshold. N landings on one file/class without the class going away ⇒ the
//       approach is wrong (the a95b959a synonym-treadmill signature, caught by RECURRENCE
//       not by reading the diff harder).
//   (c) EXERCISED   — the changed code is on some execution's path. Needs trace data
//       (activity-api); stubbed as null here, wired when the trace query is added.
const RECURRENCE_THRESHOLD = 3; // same REGION rewritten >=3× ⇒ recurring gap-class (treadmill)
// A treadmill is the SAME code region rewritten repeatedly, not a hot file getting many
// DISTINCT edits (feature-compose.ts / index.ts are legitimately central). File-level
// counting conflates the two and over-flags. Key on (file, hunk-function-context) instead:
// git's `@@ ... @@ <context>` trailing token names the enclosing symbol and is immune to
// line-number drift between commits. Same (file,symbol) touched >=3× by autonomous commits
// is the registry-field.ts synonym-treadmill signature; a big file edited in 23 different
// functions is not.
function regionsOf(repo, hash) {
  const diff = git(repo, `show ${hash} --format= --unified=0`);
  const regions = new Set();
  let file = "";
  for (const line of diff.split("\n")) {
    const fm = line.match(/^\+\+\+ b\/(.+)$/);
    if (fm) { file = fm[1]; continue; }
    const hm = line.match(/^@@ .* @@\s*(.*)$/);
    if (hm) {
      // enclosing-symbol context; fall back to the file when git gives none.
      const ctx = (hm[1] || "").trim().replace(/\s+/g, " ").slice(0, 60) || "(file)";
      regions.add(`${repo}:${file}::${ctx}`);
    }
  }
  return [...regions];
}
const regionTouchCount = new Map();
const commitRegions = new Map();
for (const c of window) {
  const rs = regionsOf(c.repo, c.hash);
  commitRegions.set(c.hash, rs);
  for (const r of rs) regionTouchCount.set(r, (regionTouchCount.get(r) ?? 0) + 1);
}
function consequence(c) {
  const stayed = git(c.repo, `branch -r --contains ${c.hash}`).includes("origin/dev");
  const rs = commitRegions.get(c.hash) ?? [];
  const maxRecur = Math.max(0, ...rs.map((r) => regionTouchCount.get(r) ?? 0));
  const nonTreadmill = maxRecur < RECURRENCE_THRESHOLD;
  const exercised = null; // TODO: query traces for whether the changed symbol/test is on any execution path
  // CONSEQUENCE_CORRECT requires the two computable-now legs to hold.
  const consequenceCorrect = stayed && nonTreadmill;
  return { stayed, maxRecur, nonTreadmill, exercised, consequenceCorrect };
}

const results = window.map((c) => ({ ...c, ...classify(c), ...consequence(c) }));
const n = results.length;
const correct = results.filter((r) => r.cls === "CORRECT").length;
const inert = results.filter((r) => r.cls === "INERT").length;
const dup = results.filter((r) => r.cls === "DUPLICATE").length;
const rate = n ? (correct / n) : 0;

const consCorrect = results.filter((r) => r.consequenceCorrect).length;
const consRate = n ? (consCorrect / n) : 0;
const notStayed = results.filter((r) => !r.stayed).length;
const treadmill = results.filter((r) => !r.nonTreadmill).length;

console.log(`\n=== Self-Development Reliability — CODE CHANGES (last ${n} autonomous commits) ===\n`);
for (const r of results) {
  const tag = r.cls === "CORRECT" ? "✅" : r.cls === "INERT" ? "⚪" : "🔁";
  const cons = r.consequenceCorrect ? "cons:OK " : `cons:FAIL(${!r.stayed ? "reverted" : ""}${!r.nonTreadmill ? `recur×${r.maxRecur}` : ""})`;
  console.log(`${tag} struct:${r.cls.padEnd(9)} ${cons.padEnd(20)} ${r.repo.slice(0, 18).padEnd(18)} ${r.hash.slice(0, 8)}  ${r.subject.slice(0, 46)}`);
}
console.log(`\n--- AGGREGATE ---`);
console.log(`total autonomous commits: ${n}`);
console.log(`\nTIER 1 — STRUCTURAL (commit-time, a proxy): CORRECT ${correct} / INERT ${inert} / DUPLICATE ${dup}`);
console.log(`  structural reliability: ${(rate * 100).toFixed(0)}%   ⚠ over-reads — scores treadmills & confabulated-but-real-source as CORRECT`);
console.log(`\nTIER 3 — CONSEQUENCE (what actually happened; the architecture's intended measure):`);
console.log(`  reverted (not stayed):        ${notStayed}`);
console.log(`  treadmill (gap-class recurs): ${treadmill}   (file touched >= ${RECURRENCE_THRESHOLD}× by autonomous commits)`);
console.log(`  exercised leg:                not yet wired (needs trace query)`);
console.log(`  CONSEQUENCE reliability: ${(consRate * 100).toFixed(0)}%   (stayed AND non-treadmill; target >= 90%)`);
console.log(`\nThe HONEST number for '90%/50' is the CONSEQUENCE one — ungameable by a plausible diff.`);
console.log(consRate >= 0.9 ? "PASS (on the two computable legs)." : `BELOW TARGET — ${n - consCorrect} of ${n} fail a consequence leg (reverted or treadmill).`);

console.log(`\n=== EXTENSION: the other three categories (oracle definitions) ===`);
console.log(`Activity creation:  CORRECT iff the new activity has NO pre-existing producer of its output shape (law 3),`);
console.log(`                    is selectable (advertised + reachable), and is non-hollow (has a reached execution).`);
console.log(`                    Failure mode observed: 15+ audit_debug_generalize_execution_summary clones (sprawl).`);
console.log(`Variant creation:   CORRECT iff evidence-gated (parent posterior weak, >=10 samples) and the variant`);
console.log(`                    later out-performs the parent by >= MIN_DELTA (else it split traffic for nothing).`);
console.log(`Learning:           CORRECT iff a reached execution is ALSO independently-correct (goal-expectation`);
console.log(`                    harness confabulation-rate == 0), i.e. the credit was earned by a real success.`);
console.log(`These require activity-api queries; the pattern is identical — an INDEPENDENT check per landed artifact.`);

process.exit(consRate >= 0.9 ? 0 : 1);
