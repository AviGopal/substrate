/**
 * Can a person get common things done through the surface?
 *
 * Not "does the walk reach" — that is goal-host's question and it is already
 * measured elsewhere. This asks the surface's question: somebody types an
 * ordinary sentence into the box, and afterwards, is there something on the
 * screen they can read and judge?
 *
 * So every goal here is dispatched THROUGH THE SURFACE (`/api/run-goal`) and
 * read back THROUGH THE SURFACE (`/api/resolve`), because a flow that works
 * against goal-host directly and fails through the proxy is a flow a person
 * cannot use.
 *
 * The corpus is deliberately NOT trivia. A high pass rate on "what is 2+2"
 * would be a gamed number; these are the things somebody actually opens this
 * page to find out, including the ones the system is known to be bad at.
 *
 *   node validation/scripts/human-goal-flows.mjs [--surface URL] [--only substr]
 */
import { writeFileSync } from "node:fs";
import { chromium } from "/home/avi/documents/work/substrate/.video/node_modules/playwright/index.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const SURFACE = arg("--surface", "http://localhost:18310");
const ONLY = arg("--only", null);
const OUT = arg("--out", "/tmp/human-goal-flows.json");
const SETTLE_TIMEOUT_MS = 6 * 60 * 1000;
const CHROME =
  process.env.CHROME ?? "/home/avi/.cache/ms-playwright/chromium-1224/chrome-linux64/chrome";

/**
 * `kind` is what the person is trying to do, and it is the unit the report
 * groups by — a failure that hits one whole kind is a different problem from
 * one bad goal.
 */
const CORPUS = [
  { kind: "count", goal: "how many TypeScript files are under repos/identity-vessel/src?" },
  { kind: "count", goal: "how many activity templates are registered?" },
  { kind: "list", goal: "list the files under repos/concept-db/src" },
  { kind: "list", goal: "list the running systemd units in the substrate container" },
  { kind: "read-code", goal: "read repos/discovery-vessel/src/index.ts and explain what it exports" },
  { kind: "read-code", goal: "which TypeScript module under repos/development-vessel/src has the most lines?" },
  { kind: "explain", goal: "summarize in prose what the boredom vessel is responsible for" },
  { kind: "explain", goal: "what does the ribosome vessel do with successful executions?" },
  { kind: "fleet", goal: "show the health status of every vessel in the fleet" },
  { kind: "fleet", goal: "which vessels serve the goal_execution shape?" },
  { kind: "introspect", goal: "list the open gaps currently recorded in the substrate gap store" },
  { kind: "introspect", goal: "what memory notes exist about the reach oracle?" },
  { kind: "history", goal: "what were the last 3 commits on the goal-host-vessel repository?" },
  { kind: "system", goal: "what is the disk usage of the substrate container volume?" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const post = async (path, body, timeoutMs = 90_000) => {
  const res = await fetch(`${SURFACE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep the raw text for the report; an HTML error page is a finding */
  }
  return { status: res.status, json, text };
};

/* ───────────────────────────── the judgements ────────────────────────────── */

const RAW_JSON = /^\s*[[{]/;
/** Two literal characters, backslash-n — the escaped-newline tell. */
const ESCAPED_NL = /\\n/;

/**
 * Would a person get something readable out of this run?
 *
 * Judged on the RENDERED PAGE, not on the payload the API returned. Those are
 * different questions and the first pass of this harness asked the wrong one:
 * it scored raw `answerBody` text and failed four goals for carrying literal
 * `\n`, when the renderer segments exactly that blob and draws it as a terminal
 * block. Measuring the data would have sent me to fix a renderer that was
 * already doing its job.
 *
 * `reached` is the walk's own opinion and is reported separately. What is
 * measured here is narrower and harder: is there something on the screen a
 * person can act on.
 */
async function judgeRenderedEvidence(page, dispatchId) {
  await page.goto(`${SURFACE}/run/${dispatchId}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(3500);

  const seen = await page.evaluate(() => {
    const all = document.body.innerText ?? "";
    const i = all.toLowerCase().indexOf("what it produced");
    if (i < 0) return { present: false, text: "", forms: [] };
    const text = all.slice(i);
    // Which renderers actually drew something, by their own class names.
    const forms = [];
    for (const cls of ["sf-terminal", "sf-record", "sf-scalar-value", "sf-table", "sf-diff", "sf-prose", "sf-verbatim"]) {
      const n = document.querySelectorAll(`.${cls}`).length;
      if (n > 0) forms.push(`${cls.replace("sf-", "")}:${n}`);
    }
    return { present: true, text, forms };
  });

  if (!seen.present) {
    return { readable: false, why: "the run detail did not render at all", forms: [] };
  }
  if (/nothing at all: no impulses in the pool/i.test(seen.text)) {
    return { readable: false, why: "rendered, but the ledger says there is nothing to judge", forms: seen.forms };
  }
  if (ESCAPED_NL.test(seen.text)) {
    return { readable: false, why: "literal \\n escapes are on the screen", forms: seen.forms };
  }
  if (/\{"[a-z_]+"\s*:/i.test(seen.text)) {
    return { readable: false, why: "raw JSON is on the screen", forms: seen.forms };
  }
  // Content, and something other than the bare fallback drew it.
  const substantive = seen.text.replace(/\s+/g, " ").trim().length;
  if (substantive < 120) {
    return { readable: false, why: `almost nothing rendered (${substantive} chars)`, forms: seen.forms };
  }
  return { readable: true, why: "", forms: seen.forms };
}

async function runOne(page, entry, index) {
  const t0 = Date.now();
  const rec = { ...entry, index };

  // Retry a dispatch refusal once. A person who gets an error retries; a
  // harness that scores the first blip as a flow failure measures the weather.
  let disp = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    disp = await post("/api/run-goal", {
      goal: entry.goal,
      operator: "human-surface",
      tags: ["surface:do-anything", "operator:avi", "human-goal-flows"],
    });
    if (disp.json?.dispatchId) break;
    if (attempt === 0) await sleep(5000);
  }

  if (disp.status === 503 || disp.json?.draining) {
    return { ...rec, outcome: "infra", detail: "dispatcher draining", ms: Date.now() - t0 };
  }
  if (!disp.json?.dispatchId) {
    return {
      ...rec,
      outcome: "not-dispatched",
      detail: `HTTP ${disp.status}: ${(disp.json?.error ?? disp.text ?? "").slice(0, 160)}`,
      ms: Date.now() - t0,
    };
  }
  const dispatchId = disp.json.dispatchId;

  let walk = null;
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(8000);
    const w = await post("/api/resolve", { type: "goalWalkState", dispatchId });
    // An unresolved read is transient — a rolling store or a restarting
    // goal-host. Retry rather than scoring it, or the harness measures its own
    // polling instead of the system.
    if (w.status !== 200 || !w.json) continue;
    const body = w.json.body ?? w.json;
    if (!body || typeof body.status !== "string") continue;
    walk = body;
    if (body.status !== "running") break;
  }

  if (!walk) {
    return { ...rec, dispatchId, outcome: "unreadable", detail: "walk state never resolved through the surface", ms: Date.now() - t0 };
  }
  if (walk.status === "running") {
    return { ...rec, dispatchId, outcome: "timeout", detail: `still running after ${Math.round(SETTLE_TIMEOUT_MS / 1000)}s`, ms: Date.now() - t0 };
  }

  const ev = await judgeRenderedEvidence(page, dispatchId);
  return {
    ...rec,
    dispatchId,
    executionId: walk.executionId ?? null,
    reached: walk.reached ?? null,
    executionPath: walk.executionPath ?? null,
    provCount: (walk.poolProvenance ?? []).length,
    hasAnswer: typeof walk.answerBody === "string" && walk.answerBody.trim().length > 0,
    forms: ev.forms,
    outcome: ev.readable ? (walk.reached === true ? "usable" : "reached-false-but-readable") : "unreadable",
    detail: ev.why,
    ms: Date.now() - t0,
  };
}

/* ─────────────────────────────── the pass ────────────────────────────────── */

const corpus = ONLY ? CORPUS.filter((c) => c.goal.includes(ONLY) || c.kind === ONLY) : CORPUS;
console.log(`surface=${SURFACE}  goals=${corpus.length}\n`);

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const results = [];
for (const [i, entry] of corpus.entries()) {
  const r = await runOne(page, entry, i);
  results.push(r);
  const flag =
    r.outcome === "usable" ? "OK  " : r.outcome === "reached-false-but-readable" ? "SOFT" : "FAIL";
  console.log(
    `${flag} [${r.kind}] ${r.goal.slice(0, 62)}\n       ${r.outcome}` +
      (r.detail ? ` — ${r.detail}` : "") +
      ` · reached=${r.reached ?? "?"} prov=${r.provCount ?? 0}` +
      (r.forms?.length ? ` [${r.forms.join(" ")}]` : "") +
      ` ${Math.round(r.ms / 1000)}s`,
  );
}

await browser.close();

const byOutcome = {};
for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
const usable = results.filter((r) => r.outcome === "usable").length;

console.log(`\n── pass summary ──`);
console.log(`usable: ${usable}/${results.length}`);
for (const [k, v] of Object.entries(byOutcome).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

const byKind = {};
for (const r of results) {
  byKind[r.kind] ??= { ok: 0, n: 0 };
  byKind[r.kind].n++;
  if (r.outcome === "usable") byKind[r.kind].ok++;
}
console.log(`\nby kind:`);
for (const [k, v] of Object.entries(byKind)) console.log(`  ${k}: ${v.ok}/${v.n}`);

writeFileSync(OUT, JSON.stringify({ surface: SURFACE, results }, null, 2));
console.log(`\nwritten: ${OUT}`);
