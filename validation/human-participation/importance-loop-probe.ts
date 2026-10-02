#!/usr/bin/env bun
/**
 * THE IMPORTANCE LOOP PROBE — the operator's sentence, executed end to end in
 * one run against a real browser and a disposable workspace:
 *
 *   "The system should always show what it thinks is most important, and it
 *    should learn what is important from what it shows."
 *
 * SIX STEPS, each with its own verdict line, each gating the exit code:
 *   S1 SEED       a mixed corpus (4 kinds, ages 1h..22d, some already answered)
 *                 plus an OPERATOR weight anchor, so the learner's base is a
 *                 human assignment rather than the compiled default.
 *   S2 SHOWN      what the surface ACTUALLY put on screen, read out of the
 *                 BROWSER (element boxes + `data-rank` / `data-rank-explanation`
 *                 attributes), never out of the API. The API's own opinion of
 *                 the order is read too, and the two are reported separately:
 *                 collapsing them would let "the server ranked it" launder
 *                 "the human saw it first".
 *   S3 ACT        one kind is ANSWERED through the real UI (type, send, receipt
 *                 confirmed); another kind is left shown-and-untouched across a
 *                 second accepted snapshot so the machine infers the ignored
 *                 outcome with a demonstrable exposure count.
 *   S4 LEARN      the learner runs on the real `POST /api/observations` path
 *                 (no hand invocation — if it needed one, that is the finding)
 *                 and writes a new `renderPolicy` revision attributed to itself
 *                 with a reason that cites the counts.
 *   S5 REORDER    the surface is RELOADED (same process, same bundle, no code
 *                 change, no restart) and the published order has moved in the
 *                 direction the evidence implies, with the weights that produced
 *                 it readable off the impulse.
 *   S6 DURABLE    a FRESH process on the same workspace reads the learned
 *                 weights back, with the learner's attribution intact.
 *
 * ── WHAT THIS PROBE DOES NOT CLAIM ─────────────────────────────────────────
 * • ATTENTION. "Shown" here means an element's box survived the clip chain into
 *   the viewport at a snapshot. Nobody looked. No predicate below reads a
 *   person's attention, and none is named as if it did.
 * • That the DISPLAYED order equals the RANKED order. It does not, and S2/S5
 *   report the divergence explicitly as a DIAGNOSTIC rather than hiding it
 *   inside a pass. The participation region re-sorts rows by `createdAt`
 *   (ui/src/lib/sort.ts `sortRuns`), so the ranking reaches the exposure record
 *   and the row attributes, and does not reach the reader's eye. That is a real
 *   shortfall against the first half of the directive; it is stated, not
 *   scored, because this probe's job is to prove the LOOP and to be honest
 *   about what the loop does not yet reach.
 * • Anything about the live substrate. A disposable WORKSPACE_ROOT, an
 *   ephemeral port, its own journal. Nothing is written to a live vessel.
 *
 * CANNOT-OBSERVE IS NOT A PASS. If chromium will not launch, the bundle is
 * missing, or a step's target is unreadable, the probe exits 3 with a
 * structuredError and prints no verdict it did not earn. (The precedent:
 * repos/development-vessel/src/resolvers/ui-legibility-scan.ts:95-115.)
 *
 * EXIT CODES: 0 every step held · 1 a step failed · 2 bad binding/usage
 *             3 CANNOT OBSERVE
 *
 * RUN:
 *   PLAYWRIGHT_MODULE=/home/avi/.bun/install/cache/playwright-core/1.62.1@@@1 \
 *   CHROMIUM_EXECUTABLE=/home/avi/.cache/ms-playwright/chromium-1224/chrome-linux64/chrome \
 *   bun validation/human-participation/importance-loop-probe.ts > /tmp/loop.txt 2>&1; echo "RC=$?"
 *   (redirection, never a pipe: a pipe reports the last stage's status.)
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── bindings, rejected loudly rather than defaulted ─────────────────────────
const PLAYWRIGHT_MODULE = process.env["PLAYWRIGHT_MODULE"];
const CHROMIUM_EXECUTABLE = process.env["CHROMIUM_EXECUTABLE"];
for (const [name, value] of [
  ["PLAYWRIGHT_MODULE", PLAYWRIGHT_MODULE],
  ["CHROMIUM_EXECUTABLE", CHROMIUM_EXECUTABLE],
] as const) {
  if (value === undefined || value.trim() === "") {
    console.error(
      `[importance-loop-probe] REFUSING TO RUN: ${name} is ${value === undefined ? "unset" : "an empty string"}.\n` +
        `  An empty binding is not a default — it is a probe that cannot fire while reporting clean.`,
    );
    process.exit(2);
  }
}

const REPO_ROOT = "/home/avi/documents/work/substrate";
/**
 * The vessel under observation. Overridable ONLY so this probe's own red state
 * is demonstrable against a COPY of the vessel carrying a deliberate defect —
 * the fidelity-probe's `--store=coercing` arm exists for the same reason. A
 * probe whose failure path has never executed cannot be trusted when it passes.
 * Never point it at a live deployment: the probe writes panels and policies.
 */
const HS = (process.env["HS_VESSEL_ROOT"] ?? `${REPO_ROOT}/repos/human-surface-vessel`).replace(/\/+$/, "");

// ── containment: set BEFORE any vessel import ───────────────────────────────
// src/config.ts freezes PORT at import and proxy.ts's /api/observations
// self-post addresses 127.0.0.1:${PORT}; a probe that let the vessel's default
// port stand would be talking to whatever else is listening there.
const WORKSPACE = mkdtempSync(join(tmpdir(), "importance-loop-probe-"));
process.env["WORKSPACE_ROOT"] = WORKSPACE;
const PORT = 30_000 + Math.floor(Math.random() * 20_000);
process.env["PORT"] = String(PORT);
process.env["DEV_VESSEL_ENDPOINT"] = "http://127.0.0.1:1";
process.env["ACTIVITY_API_ENDPOINT"] = "http://127.0.0.1:1";
process.env["ACTIVITY_API_URL"] = "http://127.0.0.1:1";
process.env["SUBSTRATE_GAP_SKIP_COMPOSE_TRIGGER"] = "1";

function cleanup(): void {
  try {
    rmSync(WORKSPACE, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

// A throw on the way to the first verdict (a seeding contract that moved, say)
// must not leave a workspace behind: an uncleaned /tmp tree is how a probe's
// leftovers get mistaken for live state later.
process.on("exit", cleanup);

function cannotObserve(reason: string, detail: string): never {
  console.error(
    JSON.stringify(
      {
        structuredError: {
          code: "cannot_observe",
          reason,
          detail: `importance_loop_probe could not observe the loop: ${detail}`,
          wrote: "nothing — no verdict, no pass, no record",
          workspace: WORKSPACE,
        },
      },
      null,
      2,
    ),
  );
  cleanup();
  process.exit(3);
}

const distIndex = `${HS}/ui/dist/index.html`;
if (!existsSync(distIndex)) {
  cannotObserve("renderer_bundle_absent", `${distIndex} does not exist — run 'bun run build' in ui/. There is no surface to observe.`);
}
if (!existsSync(CHROMIUM_EXECUTABLE!)) {
  cannotObserve("browser_binary_absent", `CHROMIUM_EXECUTABLE=${CHROMIUM_EXECUTABLE} is not on disk.`);
}

// ── the vessel, in process ──────────────────────────────────────────────────
const { Hono } = await import(`${HS}/node_modules/hono/dist/index.js`);
const { impulsesRouter } = await import(`${HS}/src/routes/impulses.ts`);
const { participationRouter } = await import(`${HS}/src/routes/participation.ts`);
const { proxyRouter } = await import(`${HS}/src/routes/proxy.ts`);
const { upsertPanel, getRenderPolicy } = await import(`${HS}/src/store.ts`);
const { IMPORTANCE_LEARNER_ID } = await import(`${HS}/src/importance-learn.ts`);
const { DEFAULT_IMPORTANCE_WEIGHTS } = await import(`${HS}/src/importance.ts`);

// ── step model ──────────────────────────────────────────────────────────────
type Step = { id: string; name: string; ok: boolean; detail: string[] };
const steps: Step[] = [];
const diagnostics: string[] = [];
function step(id: string, name: string): Step {
  const s: Step = { id, name, ok: false, detail: [] };
  steps.push(s);
  return s;
}
function hold(s: Step, ok: boolean, line: string): void {
  s.detail.push(`${ok ? "  ok   " : "  FAIL "} ${line}`);
  if (!ok) s.ok = false;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = Date.now();

// The two kinds the loop is measured on. Anchored deliberately CLOSE together
// and in the WRONG order relative to what the human is about to do, so a flip
// cannot be an artifact of the defaults.
const ANSWERED_KIND = "gap_pending_verification";
const IGNORED_KIND = "gap_needs_localization";
// Both measured kinds must out-rank every default kind, because the surface now
// orders by RANK rather than by recency: the browser shows the top of the
// importance order, so a measured panel weighted below gap_needs_human (10) or
// question (8) is simply not on screen, no act can be performed on it, and the
// learner then correctly refuses to move on an uncorroborated outcome. They
// stay CLOSE TOGETHER and in the order the human evidence is about to
// contradict, which is the property this probe actually depends on.
// Chosen to DOMINATE the age term, not merely to beat the default kinds: the
// oldest seeded row is 22 days, worth 22 * agePerDay(0.4) = 8.8, on top of a
// kind weight up to 10. Anything less and the 22-day distractor takes a visible
// slot away from a measured kind, which is exactly what happened at 20.0/20.4.
const ANCHOR_ANSWERED = 30.0;
const ANCHOR_IGNORED = 30.4;
/** Never shown, never acted on, no record: its weight must not move. */
const CONTROL_KIND = "gap_reland_needs_human";

const A1 = "loop-answered-1";
const B1 = "loop-ignored-1";
const WITNESS = "loop-witness-unanswered";
/**
 * The NEVER-SHOWN row, and why it is a separate row from WITNESS.
 *
 * WITNESS deliberately shares ANSWERED_KIND with A1, because S5 proves the
 * reorder by watching an untouched row of the answered kind RISE. Once the
 * surface orders by importance rather than by recency, same-kind rows cluster:
 * WITNESS and A1 differ only by a few hours of age, so WITNESS cannot be both
 * adjacent to A1 (for the reorder proof) and below the fold (for the
 * never-shown proof). It cannot serve both roles, so it no longer tries to.
 *
 * This row carries its own kind, weighted far below every other in the anchor
 * table, so it ranks last and is never in the visible slice — which is exactly
 * the state "never shown moves nothing" needs, produced by the weights rather
 * than by a DOM position that the ordering is free to change.
 */
const NEVER_SHOWN = "loop-never-shown";
const NEVER_SHOWN_KIND = "loop_never_shown_kind";
const ANCHOR_NEVER_SHOWN = 0.2;

/**
 * The corpus. `createdAt` is set through `upsertPanel` because the
 * `uiQuestion_write` route has no `createdAt` field (src/routes/impulses.ts
 * upsertPanel call omits it), so ages cannot be seeded through the shaped write
 * path at all — a limitation of the write contract, reported rather than
 * papered over.
 *
 * DOM order is `createdAt` DESCENDING (ui/src/lib/sort.ts), so the newest rows
 * are the ones inside the first viewport. WITNESS is placed sixth so it is
 * BELOW the fold at 1440x900 while being nearly the same age as B1 — the age
 * term (0.4/day) must not be what decides the S5 comparison.
 */
const seedPlan: { id: string; kind: string; ageMs: number; answered?: boolean; title: string }[] = [
  // A1 is the OLDEST row of its kind, deliberately. Its kind starts BELOW the
  // ignored kind (that is the order the human evidence is about to contradict),
  // so age is what has to carry it into the visible slice — otherwise the row
  // the human is supposed to answer is not on screen to answer, and the learner
  // then correctly refuses to move on an uncorroborated act.
  { id: A1, kind: ANSWERED_KIND, ageMs: 10 * DAY, title: "A repair has been waiting ten days for someone to confirm it worked" },
  { id: B1, kind: IGNORED_KIND, ageMs: 2 * HOUR, title: "A gap the system cannot aim at a file yet (fresh)" },
  { id: "loop-spacer-1", kind: "question", ageMs: 2.5 * HOUR, title: "Spacer question one" },
  { id: "loop-spacer-2", kind: "question", ageMs: 3 * HOUR, title: "Spacer question two" },
  { id: "loop-spacer-3", kind: "code_change", ageMs: 3.5 * HOUR, title: "Spacer proposed change" },
  { id: WITNESS, kind: ANSWERED_KIND, ageMs: 4 * HOUR, title: "A repair is waiting for confirmation (the witness, never shown)" },
  { id: "loop-old-b", kind: IGNORED_KIND, ageMs: 1 * DAY, title: "Unlocalized gap, one day old" },
  { id: "loop-control-1", kind: CONTROL_KIND, ageMs: 3 * DAY, title: "A reland came back and needs you (control kind)" },
  { id: "loop-control-2", kind: CONTROL_KIND, ageMs: 7 * DAY, title: "Another reland (control kind)" },
  { id: "loop-answered-old", kind: "question", ageMs: 11 * DAY, answered: true, title: "An old question somebody already answered" },
  { id: "loop-stale-escalation", kind: "gap_needs_human", ageMs: 22 * DAY, title: "Escalated to you after 8+ failed auto-repairs" },
  { id: "loop-stale-answered", kind: "gap_needs_human", ageMs: 18 * DAY, answered: true, title: "An old escalation somebody already answered" },
  { id: NEVER_SHOWN, kind: NEVER_SHOWN_KIND, ageMs: 5 * HOUR, title: "A solicitation weighted below the fold (never shown)" },
];

async function resolve(pointer: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const response = await impulsesRouter.request("/v2/impulses/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pointer }),
  });
  return { status: response.status, json: await response.json() };
}

const policyWeights = (): Record<string, number> => getRenderPolicy().importanceWeights.byKind;

// ─────────────────────────────────────────────────────────────────────────────
// S1 — seed the corpus and the operator's anchor
// ─────────────────────────────────────────────────────────────────────────────
const s1 = step("S1", "SEED — a mixed corpus and a human weight anchor");
s1.ok = true;
for (const p of seedPlan) {
  const panel = upsertPanel({
    id: p.id,
    title: p.title,
    body: { context: "importance-loop-probe fixture", note: "machine-generated fixture, not a human contribution" },
    kind: p.kind,
    importance: "high",
    asks: [{ id: `${p.id}-a1`, prompt: "Retire it, repair it, or leave it waiting?" }],
    createdAt: NOW - p.ageMs,
  });
  if (p.answered) {
    // The shape is `uiFeedback` (there is no `uiFeedback_write` case), the
    // interaction enum is answer|reaction|dismiss, and `questionView` only
    // counts responses whose `panelRevision` matches the panel's current one —
    // so the revision is read off the panel rather than assumed.
    const fed = await resolve({
      type: "uiFeedback",
      panel_id: p.id,
      panel_revision: panel.revision,
      kind: "answer",
      value: "Already handled before this run; seeded as answered.",
    });
    assert.equal(fed.status, 200, `seeding an answered panel failed for ${p.id}`);
  }
}
const kindsSeeded = [...new Set(seedPlan.map((p) => p.kind))].sort();
const agesSeeded = [...new Set(seedPlan.map((p) => Math.round((p.ageMs / DAY) * 100) / 100))].sort((a, b) => a - b);
hold(s1, kindsSeeded.length >= 4, `kinds seeded: ${kindsSeeded.join(", ")} (${kindsSeeded.length})`);
hold(s1, agesSeeded.length >= 6, `ages seeded (days): ${agesSeeded.join(", ")}`);
hold(
  s1,
  seedPlan.filter((p) => p.answered).length >= 2,
  `${seedPlan.filter((p) => p.answered).length} panel(s) seeded already answered, ${seedPlan.filter((p) => !p.answered).length} unanswered`,
);

// The operator's anchor: the WHOLE table (writeRenderPolicy replaces a supplied
// map wholly, so a partial table would silently rescore every other kind at the
// neutral mean), with the two measured kinds set close together and in the
// order the human is about to contradict.
const anchorTable = { ...DEFAULT_IMPORTANCE_WEIGHTS.byKind, [ANSWERED_KIND]: ANCHOR_ANSWERED, [IGNORED_KIND]: ANCHOR_IGNORED, [NEVER_SHOWN_KIND]: ANCHOR_NEVER_SHOWN };
const anchor = await resolve({
  type: "renderPolicy_write",
  importanceWeights: { byKind: anchorTable },
  assignedBy: "operator:importance-loop-probe",
  reason: "anchor for the importance loop probe: the two measured kinds start close, and in the order the evidence is about to contradict",
});
hold(s1, anchor.status === 200, `operator anchor write status ${anchor.status}`);
const anchoredWeights = { ...policyWeights() };
hold(
  s1,
  anchoredWeights[ANSWERED_KIND] === ANCHOR_ANSWERED && anchoredWeights[IGNORED_KIND] === ANCHOR_IGNORED,
  `anchor in force: ${ANSWERED_KIND}=${anchoredWeights[ANSWERED_KIND]} < ${IGNORED_KIND}=${anchoredWeights[IGNORED_KIND]} (the human is about to imply the opposite)`,
);
const revisionAfterAnchor = getRenderPolicy().revision;

// ─────────────────────────────────────────────────────────────────────────────
// the server: the REAL routers, on the port the vessel's self-post addresses
// ─────────────────────────────────────────────────────────────────────────────
const app = new Hono();
app.route("/", impulsesRouter);
app.route("/", participationRouter);
app.route("/", proxyRouter);

/** Records the browser posted, captured by OBSERVING the real endpoint, not by replacing it. */
const posted: Record<string, unknown>[] = [];
const staticMisses: string[] = [];

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    if (path === "/api/observations" && request.method === "POST") {
      // Observed and FORWARDED to the real route — the endpoint under test runs.
      const raw = await request.text();
      try {
        posted.push(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        posted.push({ unparseable: raw });
      }
      return app.fetch(new Request(request.url, { method: "POST", headers: request.headers, body: raw }));
    }
    if (path.startsWith("/api/") || path.startsWith("/v2/")) return app.fetch(request);
    const file = Bun.file(`${HS}/ui/dist${path === "/" ? "/index.html" : path}`);
    if (!(await file.exists())) {
      staticMisses.push(path);
      return new Response(`no such asset in ui/dist: ${path}`, { status: 404 });
    }
    return new Response(file);
  },
});

const exposureRecords = (): Record<string, unknown>[] => posted.filter((r) => r["obs_type"] === "exposure");
const outcomeRecords = (): Record<string, unknown>[] => posted.filter((r) => r["obs_type"] === "exposure_outcome");
const outcomesFor = (id: string, outcome: string): Record<string, unknown>[] =>
  outcomeRecords().filter((r) => r["panel_id"] === id && r["outcome"] === outcome);

async function until(label: string, predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${label}`);
}

// ── the browser ─────────────────────────────────────────────────────────────
let chromium: any;
try {
  ({ chromium } = await import(PLAYWRIGHT_MODULE!));
} catch (error) {
  server.stop(true);
  cannotObserve("playwright_module_unloadable", `PLAYWRIGHT_MODULE=${PLAYWRIGHT_MODULE}: ${(error as Error).message}`);
}
let browser: any;
try {
  browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
} catch (error) {
  server.stop(true);
  cannotObserve("chromium_launch_failed", `${CHROMIUM_EXECUTABLE}: ${(error as Error).message}`);
}

const VIEWPORT = { width: 1440, height: 900 };

/**
 * What the BROWSER says is on screen, and with what ranking claim. Read from
 * element boxes and row attributes inside the page — independent of the
 * reporter's own arithmetic and of the API payload.
 */
type DomRow = {
  id: string;
  domPosition: number;
  rank: number | null;
  explanation: string | null;
  visible: boolean;
  visibleFraction: number;
};
async function readDom(page: any): Promise<DomRow[]> {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-solicitation-id]")];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clipOf = (element: Element): { top: number; bottom: number; left: number; right: number } => {
      // The clip chain: every scrollable ancestor crops the box, and so does the
      // viewport. Without it a row inside an on-screen scrolling list reads as
      // shown while it is cropped to nothing.
      let top = 0;
      let bottom = vh;
      let left = 0;
      let right = vw;
      let node: Element | null = element.parentElement;
      while (node) {
        const style = getComputedStyle(node);
        if (/(auto|scroll|hidden)/.test(style.overflowY) || /(auto|scroll|hidden)/.test(style.overflowX)) {
          const box = node.getBoundingClientRect();
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
          left = Math.max(left, box.left);
          right = Math.min(right, box.right);
        }
        node = node.parentElement;
      }
      return { top, bottom, left, right };
    };
    return rows.map((element, index) => {
      const box = element.getBoundingClientRect();
      const clip = clipOf(element);
      const height = Math.max(0, Math.min(box.bottom, clip.bottom) - Math.max(box.top, clip.top));
      const width = Math.max(0, Math.min(box.right, clip.right) - Math.max(box.left, clip.left));
      const area = box.width * box.height;
      const fraction = area > 0 ? (height * width) / area : 0;
      const rank = element.getAttribute("data-rank");
      return {
        id: element.getAttribute("data-solicitation-id") ?? "<none>",
        domPosition: index + 1,
        rank: rank === null ? null : Number(rank),
        explanation: element.getAttribute("data-rank-explanation"),
        visible: fraction >= 0.5,
        visibleFraction: Math.round(fraction * 1000) / 1000,
      };
    });
  });
}

const s2 = step("S2", "SHOWN — what the surface actually put on screen, read out of the browser");
const s3 = step("S3", "ACT — one kind answered by a human, one kind shown twice and left alone");
const s4 = step("S4", "LEARN — the learner ran on the real endpoint and wrote an attributed revision");
const s5 = step("S5", "REORDER — the order moved as the evidence implies, weights off the impulse, no restart");
const s6 = step("S6", "DURABLE — a fresh process reads the learned weights back");

try {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const consoleErrors: string[] = [];
  page.on("pageerror", (e: Error) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m: any) => {
    if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`);
  });

  await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: "domcontentloaded" });
  const region = page.getByRole("region", { name: "Questions for you", exact: true });
  try {
    await region.getByRole("button", { name: /the witness, never shown/ }).waitFor({ timeout: 20_000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-solicitation-id]").length > 0);
    await until("the first exposure record", () => exposureRecords().length >= 1);
  } catch (error) {
    const text = await page.locator("body").innerText().catch(() => "<unreadable>");
    await browser.close();
    server.stop(true);
    cannotObserve(
      "page_never_ready",
      `the surface never presented the seeded corpus: ${(error as Error).message}. console=${JSON.stringify(consoleErrors.slice(0, 5))} body=${JSON.stringify(text.slice(0, 400))}`,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // S2 — what was shown, from the browser
  // ───────────────────────────────────────────────────────────────────────────
  s2.ok = true;
  const dom1 = await readDom(page);
  const shown1 = dom1.filter((r) => r.visible);
  const hidden1 = dom1.filter((r) => !r.visible);
  hold(s2, dom1.length === seedPlan.length, `${dom1.length} solicitation rows in the DOM (seeded ${seedPlan.length})`);
  hold(s2, shown1.length > 0, `visible in the ${VIEWPORT.width}x${VIEWPORT.height} viewport box: ${shown1.map((r) => `${r.id}(rank ${r.rank})`).join(", ") || "<none>"}`);
  hold(s2, hidden1.length > 0, `NOT shown (the honest denominator): ${hidden1.length} of ${dom1.length} rows cropped out of the viewport`);
  hold(
    s2,
    shown1.every((r) => typeof r.rank === "number" && Number.isFinite(r.rank)),
    `every shown row carries a server-published data-rank: ${shown1.map((r) => r.rank).join(", ")}`,
  );
  hold(
    s2,
    shown1.every((r) => typeof r.explanation === "string" && r.explanation.length > 8),
    `every shown row carries its ranking explanation, e.g. ${JSON.stringify(shown1[0]?.explanation ?? null)}`,
  );
  // The browser's own exposure record must agree with the boxes measured here —
  // an independent ground truth, so the reporter is not merely agreeing with
  // itself.
  const firstExposure = exposureRecords()[0]!;
  const reportedShown = ((firstExposure["visible_in_viewport"] as { solicitation_id: string }[]) ?? []).map((v) => v.solicitation_id);
  hold(
    s2,
    shown1.every((r) => reportedShown.includes(r.id)) && reportedShown.every((id) => shown1.some((r) => r.id === id)),
    `the exposure record's slice matches the independently measured boxes: reported ${JSON.stringify(reportedShown)}`,
  );
  // The NEVER-SHOWN row, not WITNESS: under importance ordering WITNESS sits
  // beside A1 because they share a kind, which is what makes the S5 reorder
  // proof work. Invisibility is now produced by a weight, not by a DOM
  // position the ordering is free to move.
  hold(
    s2,
    !shown1.some((r) => r.id === NEVER_SHOWN) && !reportedShown.includes(NEVER_SHOWN),
    `the low-weighted row ${NEVER_SHOWN} is in the DOM but NOT in the visible slice (dom position ${dom1.find((r) => r.id === NEVER_SHOWN)?.domPosition}, visible fraction ${dom1.find((r) => r.id === NEVER_SHOWN)?.visibleFraction})`,
  );
  hold(
    s2,
    shown1.some((r) => r.id === A1) && shown1.some((r) => r.id === B1),
    `both measured kinds are on screen: ${A1} and ${B1}`,
  );

  // DIAGNOSTIC, not a predicate: ranked order vs displayed order.
  const displayedOrder = dom1.map((r) => r.id);
  const rankedOrder = [...dom1].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)).map((r) => r.id);
  const orderMatches = JSON.stringify(displayedOrder) === JSON.stringify(rankedOrder);
  diagnostics.push(
    orderMatches
      ? "DISPLAY ORDER == RANKED ORDER: the first viewport shows the highest-ranked rows."
      : `DISPLAY ORDER != RANKED ORDER. The region re-sorts by createdAt (ui/src/lib/sort.ts sortRuns), so rank reaches the row attributes and the exposure record but NOT the reader's eye.\n` +
        `        displayed first 3: ${displayedOrder.slice(0, 3).join(", ")}\n` +
        `        ranked    first 3: ${rankedOrder.slice(0, 3).join(", ")}\n` +
        `        rank of the top-ranked row as displayed: dom position ${dom1.find((r) => r.rank === 1)?.domPosition ?? "?"} of ${dom1.length} (visible=${dom1.find((r) => r.rank === 1)?.visible})`,
  );
  diagnostics.push(
    `THE RANKING SUMMARY IS NOT RENDERED. The payload's ranking.explanation ("${String(
      (await (await fetch(`http://127.0.0.1:${PORT}/api/questions`)).json()).body.ranking.explanation,
    ).slice(0, 96)}...") appears nowhere in the page text, so a human is shown a slice with no statement that it IS a slice.`,
  );
  const pageText: string = await page.locator("body").innerText();
  diagnostics.push(
    `page text contains the phrase "not shown": ${pageText.toLowerCase().includes("not shown")}; contains "by importance": ${pageText.toLowerCase().includes("by importance")}`,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // S3 — act as a human
  // ───────────────────────────────────────────────────────────────────────────
  s3.ok = true;
  // Derived from the seed plan rather than duplicated as a literal, so renaming
  // a seeded row cannot silently turn this into a 30-second click timeout.
  const a1Title = seedPlan.find((p) => p.id === A1)!.title;
  await region.getByRole("button", { name: new RegExp(a1Title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  const card = region.locator(".sf-participation-detail > div:not([hidden])");
  await card.getByLabel("Your contribution").fill("Confirmed working — close it. (importance-loop-probe, acting as the human resolver)");
  await card.getByRole("button", { name: "Send contribution" }).click();
  await card.getByText("Your contribution is recorded.").waitFor({ timeout: 15_000 });
  await until(`the answered outcome for ${A1}`, () => outcomesFor(A1, "answered").length >= 1);
  hold(s3, outcomesFor(A1, "answered").length === 1, `${A1} (${ANSWERED_KIND}) answered through the UI: exactly one answered outcome`);
  hold(s3, outcomesFor(A1, "declined").length === 0 && outcomesFor(A1, "complained").length === 0, `answering ${A1} was not recorded as a decline or a complaint`);

  // A second ACCEPTED snapshot: the untouched row is inferred as shown-and-not-acted-on.
  await region.getByRole("button", { name: /Refresh questions|Review updates/ }).click();
  await until("the second exposure record", () => exposureRecords().length >= 2);
  await until(`the ignored outcome for ${B1}`, () => outcomesFor(B1, "shown_not_acted").length >= 1);
  const ignored = outcomesFor(B1, "shown_not_acted");
  hold(s3, ignored.length === 1, `${B1} (${IGNORED_KIND}) shown twice and left alone: ${ignored.length} inferred ignored outcome`);
  hold(s3, ignored[0]?.["exposure_count"] === 2, `the ignored outcome demonstrates repetition: exposure_count=${String(ignored[0]?.["exposure_count"])}`);
  hold(s3, ignored[0]?.["inferred"] === true, `the inferred outcome is marked inferred=${String(ignored[0]?.["inferred"])}, so it is not mistaken for an act a person performed`);
  hold(s3, outcomesFor(A1, "shown_not_acted").length === 0, `the answered row did not also collect an ignored outcome`);
  hold(
    s3,
    outcomeRecords().filter((r) => r["panel_id"] === NEVER_SHOWN).length === 0,
    `the never-shown row produced ZERO outcome records (never shown is not an outcome)`,
  );
  hold(
    s3,
    posted.every((r) => !JSON.stringify(r).includes("uiFeedback")),
    `no record the browser posted names uiFeedback (the human-only channel)`,
  );
  hold(
    s3,
    posted.every((r) => r["origin"] === "machine"),
    `all ${posted.length} posted records are machine-origin`,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // S4 — the learner ran, unbidden
  // ───────────────────────────────────────────────────────────────────────────
  s4.ok = true;
  const learnedPolicy = getRenderPolicy();
  const learnedWeights = { ...learnedPolicy.importanceWeights.byKind };
  hold(
    s4,
    learnedPolicy.revision > revisionAfterAnchor,
    `renderPolicy advanced ${revisionAfterAnchor} -> ${learnedPolicy.revision} with NO hand invocation of the learner (the real POST /api/observations path triggered it)`,
  );
  hold(s4, learnedPolicy.assignedBy === IMPORTANCE_LEARNER_ID, `the revision is attributed to ${JSON.stringify(learnedPolicy.assignedBy)}`);
  hold(
    s4,
    typeof learnedPolicy.reason === "string" && learnedPolicy.reason.includes(ANSWERED_KIND) && /answered/.test(learnedPolicy.reason),
    `the reason cites the evidence: ${JSON.stringify(String(learnedPolicy.reason).slice(0, 200))}...`,
  );
  hold(
    s4,
    (learnedWeights[ANSWERED_KIND] ?? 0) > ANCHOR_ANSWERED,
    `answered kind rose: ${ANSWERED_KIND} ${ANCHOR_ANSWERED} -> ${learnedWeights[ANSWERED_KIND]}`,
  );
  hold(
    s4,
    (learnedWeights[IGNORED_KIND] ?? 0) < ANCHOR_IGNORED,
    `shown-and-ignored kind fell: ${IGNORED_KIND} ${ANCHOR_IGNORED} -> ${learnedWeights[IGNORED_KIND]}`,
  );
  hold(
    s4,
    learnedWeights[CONTROL_KIND] === anchoredWeights[CONTROL_KIND],
    `the never-shown control kind is byte-identical: ${CONTROL_KIND} ${anchoredWeights[CONTROL_KIND]} -> ${learnedWeights[CONTROL_KIND]}`,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // S5 — reload: the order moved, from the impulse, with no restart
  // ───────────────────────────────────────────────────────────────────────────
  s5.ok = true;
  const witnessBefore = dom1.find((r) => r.id === WITNESS)!;
  const b1Before = dom1.find((r) => r.id === B1)!;
  hold(
    s5,
    (witnessBefore.rank ?? 0) > (b1Before.rank ?? 0),
    `BEFORE: the unanswered witness of the answered kind ranked BELOW the ignored kind's row (${WITNESS} rank ${witnessBefore.rank} vs ${B1} rank ${b1Before.rank})`,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await region.getByRole("button", { name: /the witness, never shown/ }).waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-rank]").length > 0);
  const dom2 = await readDom(page);
  const witnessAfter = dom2.find((r) => r.id === WITNESS)!;
  const b1After = dom2.find((r) => r.id === B1)!;
  hold(
    s5,
    (witnessAfter.rank ?? 0) < (b1After.rank ?? 0),
    `AFTER: the order FLIPPED — ${WITNESS} rank ${witnessAfter.rank} now ranks above ${B1} rank ${b1After.rank}`,
  );
  hold(
    s5,
    b1After.id === B1 && dom2.length === dom1.length,
    `the corpus is unchanged (${dom2.length} rows): the flip is the weights, not a different set of panels`,
  );
  const payload = await (await fetch(`http://127.0.0.1:${PORT}/api/questions`)).json();
  const servedWeights = payload.body.ranking.weights.byKind as Record<string, number>;
  hold(
    s5,
    servedWeights[ANSWERED_KIND] === learnedWeights[ANSWERED_KIND] && servedWeights[IGNORED_KIND] === learnedWeights[IGNORED_KIND],
    `the weights that produced this order are read off the impulse at request time and reported with it: ${ANSWERED_KIND}=${servedWeights[ANSWERED_KIND]}, ${IGNORED_KIND}=${servedWeights[IGNORED_KIND]}, policy_revision=${payload.body.ranking.policy_revision}`,
  );
  hold(
    s5,
    payload.body.ranking.policy_revision === learnedPolicy.revision,
    `the served order names the revision that caused it (${payload.body.ranking.policy_revision})`,
  );
  hold(
    s5,
    payload.body.ranking.solicitations_total === seedPlan.length &&
      payload.body.ranking.not_shown_count === Math.max(0, seedPlan.length - payload.body.ranking.shown_count),
    `the payload is honest about what it withheld: shown ${payload.body.ranking.shown_count} of ${payload.body.ranking.solicitations_total}, not_shown ${payload.body.ranking.not_shown_count} (slice ${String(payload.body.ranking.slice_size)} from ${payload.body.ranking.slice_source})`,
  );
  const dom2Displayed = dom2.map((r) => r.id);
  const dom2Ranked = [...dom2].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)).map((r) => r.id);
  diagnostics.push(
    JSON.stringify(dom2Displayed) === JSON.stringify(dom2Ranked)
      ? "AFTER RELOAD: display order == ranked order."
      : `AFTER RELOAD: display order STILL != ranked order — the learned ranking changed the rank attributes and the exposure record, and did not change which row a human sees first (displayed first: ${dom2Displayed[0]}, ranked first: ${dom2Ranked[0]}).`,
  );
  diagnostics.push(`console errors during the run: ${consoleErrors.length === 0 ? "none" : JSON.stringify(consoleErrors.slice(0, 6))}`);
  if (staticMisses.length > 0) diagnostics.push(`static assets the harness could not serve: ${JSON.stringify([...new Set(staticMisses)])}`);

  await browser.close();
} catch (error) {
  try {
    await browser.close();
  } catch {
    /* ignore */
  }
  server.stop(true);
  // A step that threw is a FAILED step, not an unobservable one — unless the
  // throw is the browser refusing to work at all, which is handled above.
  const current = steps.find((s) => s.ok === false && s.detail.length === 0) ?? steps[steps.length - 1]!;
  current.ok = false;
  current.detail.push(`  FAIL  threw: ${(error as Error).message}`);
  for (const s of steps) if (s.detail.length === 0) s.detail.push("  FAIL  never ran (an earlier step threw)");
  report();
}

// ─────────────────────────────────────────────────────────────────────────────
// S6 — a fresh process reads the learned weights back
// ─────────────────────────────────────────────────────────────────────────────
s6.ok = true;
const expected = { ...policyWeights() };
const child = spawnSync(
  process.execPath,
  [
    "-e",
    `process.env.WORKSPACE_ROOT = ${JSON.stringify(WORKSPACE)};
     const { getRenderPolicy } = await import(${JSON.stringify(`${HS}/src/store.ts`)});
     const p = getRenderPolicy();
     console.log(JSON.stringify({ revision: p.revision, assignedBy: p.assignedBy, reason: p.reason, byKind: p.importanceWeights.byKind }));`,
  ],
  { encoding: "utf8", env: { ...process.env, WORKSPACE_ROOT: WORKSPACE }, timeout: 60_000 },
);
hold(s6, child.status === 0, `fresh process exited ${child.status} (stderr: ${JSON.stringify((child.stderr ?? "").slice(0, 300))})`);
let replayed: any = null;
try {
  replayed = JSON.parse((child.stdout ?? "").trim().split("\n").pop() ?? "null");
} catch {
  /* reported below */
}
hold(s6, replayed !== null, `the fresh process printed a readable policy`);
hold(
  s6,
  replayed?.byKind?.[ANSWERED_KIND] === expected[ANSWERED_KIND] && replayed?.byKind?.[IGNORED_KIND] === expected[IGNORED_KIND],
  `the learned weights survived a restart: ${ANSWERED_KIND}=${replayed?.byKind?.[ANSWERED_KIND]} (in-process ${expected[ANSWERED_KIND]}), ${IGNORED_KIND}=${replayed?.byKind?.[IGNORED_KIND]} (in-process ${expected[IGNORED_KIND]})`,
);
hold(s6, replayed?.assignedBy === IMPORTANCE_LEARNER_ID, `the learner's attribution survived: ${JSON.stringify(replayed?.assignedBy)}`);
hold(s6, typeof replayed?.reason === "string" && replayed.reason.length > 40, `the evidence-citing reason survived (${String(replayed?.reason).length} chars)`);
hold(s6, !child.stderr?.includes("ReferenceError"), `no ReferenceError at module load in the fresh process`);

server.stop(true);
report();

// ─────────────────────────────────────────────────────────────────────────────
function report(): never {
  const passed = steps.every((s) => s.ok);
  console.log("");
  console.log("═══ IMPORTANCE LOOP PROBE ═══════════════════════════════════════════════");
  console.log(`workspace: ${WORKSPACE}   port: ${PORT}   viewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log("");
  for (const s of steps) {
    console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.id}  ${s.name}`);
    for (const line of s.detail) console.log(line);
  }
  console.log("");
  console.log("── DIAGNOSTICS (reported, NOT scored — read these before quoting a pass) ──");
  for (const d of diagnostics) console.log(`  • ${d}`);
  console.log("");
  console.log("── WHAT A PASS DOES NOT MEAN ─────────────────────────────────────────────");
  console.log("  • Nobody looked. 'Shown' is box geometry at a snapshot, not attention.");
  console.log("  • The ranked order is published on the rows and in the payload; whether");
  console.log("    the reader SEES it first is the DISPLAY ORDER diagnostic above.");
  console.log("");
  console.log(`VERDICT: ${passed ? "PASS — every step held" : "FAIL — at least one step did not hold"} (${steps.filter((s) => s.ok).length}/${steps.length} steps)`);
  cleanup();
  process.exit(passed ? 0 : 1);
}
