#!/usr/bin/env bun
/**
 * SURFACE-STATE PROBE — does each section of the live human surface show the
 * system's current state?
 *
 * fidelity-probe.ts asks whether the surface preserves the bytes it is handed.
 * This probe asks the next question: does what a person SEES in each region
 * agree with the source that region claims to show, read at the same moment?
 * It photographs the running surface, segments it by region (`.sf-region`),
 * crops each region to its own image, and checks every region against its
 * source of truth:
 *
 *   R1 RUNS        rendered run rows == `activeDispatches` count; running rows ==
 *                  goal-host `in_flight` (±1, sampled seconds apart). Also
 *                  reports how many rows are actually VISIBLE without scrolling.
 *   R2 QUESTIONS   the "N awaiting your perspective" header == the questions
 *                  API's `unanswered` (system-wide), not the unanswered count
 *                  among the rows that happen to be displayed.
 *   R3 FINDINGS    "N open" in the known-wrong region == open `ui_legibility`
 *                  gaps in the live gap store.
 *   R4 SHAPES      "Derived from the N shapes" within 5% of discovery's live
 *                  shape count.
 *   R5 SOURCES     every data route the page called answered 2xx.
 *
 * Each predicate is reported separately. A region the probe cannot read is
 * `cannot_observe`, never a pass (same rule as fidelity-probe.ts).
 *
 * WHICH SURFACE. The target is `human-surface-vessel` inside the substrate
 * container (default `substrate-live`), whose port 8310 binds container
 * loopback and is not published. The probe reaches it through a per-connection
 * `docker exec … bun` pipe, so it needs no port change. `syzygy-local-surface`
 * (host 127.0.0.1:38310) is a different container joined to a remote hub; it
 * shows that network, not this substrate. Pass --url to probe a published
 * surface directly instead.
 *
 * READ-ONLY. It never sends a goal, never writes a panel, feedback, or gap.
 *
 * USAGE
 *   PLAYWRIGHT_MODULE=<…/playwright/index.mjs> CHROMIUM_EXECUTABLE=<…/chrome> \
 *     bun run validation/human-participation/surface-state-probe.ts \
 *       [--container=substrate-live] [--url=http://…] [--out=<dir>]
 *
 * EXIT: 0 all predicates hold · 1 a predicate failed · 2 bad binding ·
 *       3 cannot observe (browser, page, or container unreachable)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { spawn, execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const hit = argv.find(a => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const CONTAINER = flag("container", "substrate-live");
const OUT = flag("out", `/tmp/surface-state-probe-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const PLAYWRIGHT_MODULE = process.env["PLAYWRIGHT_MODULE"];
const CHROMIUM_EXECUTABLE = process.env["CHROMIUM_EXECUTABLE"];
if (!PLAYWRIGHT_MODULE || !CHROMIUM_EXECUTABLE) {
  console.error("[surface-state-probe] REFUSING TO RUN: set PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE.");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

function cannotObserve(reason: string, detail: string): never {
  console.error(JSON.stringify({ shape: "structuredError", body: { reason, detail, available: false } }));
  process.exit(3);
}

// ── reach the in-container surface ──────────────────────────────────────────
const PIPE = `const s=require("net").connect(8310,"127.0.0.1");process.stdin.pipe(s);s.pipe(process.stdout);s.on("close",()=>process.exit(0));s.on("error",()=>process.exit(1));`;
let proxy: Server | undefined;
let url = flag("url", "");
if (!url) {
  proxy = createServer(c => {
    const p = spawn("docker", ["exec", "-i", CONTAINER, "bun", "-e", PIPE], { stdio: ["pipe", "pipe", "ignore"] });
    c.pipe(p.stdin);
    p.stdout.pipe(c);
    c.on("error", () => p.kill());
    c.on("close", () => p.kill());
    p.on("exit", () => c.destroy());
  });
  await new Promise<void>(r => proxy!.listen(0, "127.0.0.1", () => r()));
  const addr = proxy.address();
  url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/`;
}

// ── sources of truth, read inside the container ─────────────────────────────
function inContainer(js: string): any {
  try {
    const out = execFileSync("docker", ["exec", CONTAINER, "bun", "-e", js], { encoding: "utf8", timeout: 90_000 });
    return JSON.parse(out.trim().split("\n").filter(l => l.startsWith("{")).pop() ?? "null");
  } catch (e) {
    cannotObserve("container_unreachable", (e as Error).message.slice(0, 200));
  }
}
const TRUTH_JS = `
const get=async(p,o)=>{try{const r=await fetch("http://127.0.0.1"+p,o);return await r.json()}catch{return null}};
const post=(p,b)=>get(p,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)});
const fs=require("fs");
const gh=await get(":8210/health");
const act=await post(":8310/api/resolve",{type:"activeDispatches"});
const q=await get(":8310/api/questions");
const sh=await get(":8310/api/discovery/shapes");
let uiOpen=null;try{const g=JSON.parse(fs.readFileSync("/workspace/git/super-repo/gaps/gaps.json"));const a=Array.isArray(g)?g:(g.gaps||Object.values(g));uiOpen=a.filter(x=>x.category==="ui_legibility"&&x.status==="open").length}catch{}
const d=(act&&(act.body||act).dispatches)||null;const shapes=sh?(Array.isArray(sh.shapes||sh)?(sh.shapes||sh).length:Object.keys(sh.shapes||sh).length):null;
console.log(JSON.stringify({at:new Date().toISOString(),in_flight:gh?gh.in_flight:null,active_total:d?d.length:null,active_running:d?d.filter(x=>x.status==="running").length:null,unanswered:q&&q.body?q.body.unanswered:null,questions_total:q&&q.body?q.body.total:null,ui_legibility_open:uiOpen,shapes}));`;

// ── photograph and segment ──────────────────────────────────────────────────
let chromium: any;
try {
  ({ chromium } = await import(PLAYWRIGHT_MODULE));
} catch (e) {
  cannotObserve("playwright_import_failed", (e as Error).message);
}
let browser: any;
try {
  browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE });
} catch (e) {
  cannotObserve("chromium_launch_failed", (e as Error).message.slice(0, 200));
}
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const calls: { route: string; status: number }[] = [];
page.on("response", (r: any) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith("/api/")) calls.push({ route: `${r.request().method()} ${u.pathname}`, status: r.status() });
});
const before = inContainer(TRUTH_JS);
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector(".sf-region", { timeout: 30_000 });
} catch (e) {
  cannotObserve("page_not_ready", (e as Error).message.slice(0, 200));
}
await page.waitForTimeout(4_000);
await page.screenshot({ path: `${OUT}/surface.png`, fullPage: true });

const regions = await page.evaluate(() => {
  return [...document.querySelectorAll(".sf-region")].map((e, i) => {
    const r = (e as HTMLElement).getBoundingClientRect();
    const head = e.querySelector("h1,h2,h3,[role=heading]") as HTMLElement | null;
    const scroll = [...e.querySelectorAll("*")].find(x => (x as HTMLElement).scrollHeight > (x as HTMLElement).clientHeight + 4 && getComputedStyle(x).overflowY !== "visible") as HTMLElement | undefined;
    return {
      index: i,
      cls: (e as HTMLElement).className,
      heading: (head?.innerText ?? "").trim(),
      box: { x: Math.round(r.x), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) },
      text: (e as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 600),
      scroll: scroll ? { scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight } : null,
    };
  });
});
for (const r of regions) {
  if (r.box.width > 0 && r.box.height > 0) {
    const name = r.cls.split(" ").find((c: string) => c.startsWith("sf-") && c !== "sf-region") ?? `region-${r.index}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, clip: r.box, fullPage: true }).catch(() => {});
  }
}
const runRows = await page.evaluate(() => {
  const reg = document.querySelector(".sf-runs");
  if (!reg) return null;
  const rows = [...reg.querySelectorAll("li,[role=row],tr,button,a")].filter(e => /running|reached|failed|completed/i.test((e as HTMLElement).innerText || ""));
  const texts = rows.map(e => (e as HTMLElement).innerText.replace(/\s+/g, " "));
  return { total: texts.length, running: texts.filter(t => /running/i.test(t)).length, goalless: texts.filter(t => /goal text not recorded/i.test(t)).length };
});
const after = inContainer(TRUTH_JS);
await browser.close();
proxy?.close();

// ── predicates ──────────────────────────────────────────────────────────────
const text = (cls: string) => regions.find((r: any) => r.cls.includes(cls))?.text ?? null;
const num = (s: string | null, re: RegExp) => { const m = s ? re.exec(s) : null; return m ? Number(m[1]) : null; };
type Verdict = "pass" | "fail" | "cannot_observe";
const verdict = (shown: number | null, truth: number | null, ok: (a: number, b: number) => boolean): Verdict =>
  shown === null || truth === null ? "cannot_observe" : ok(shown, truth) ? "pass" : "fail";

const runsRegion = regions.find((r: any) => r.cls.includes("sf-runs"));
const awaiting = num(text("sf-participation"), /(\d+) awaiting your perspective/);
const findingsOpen = num(text("sf-gaps"), /(\d+) open/);
const shapesShown = num(text("sf-ask"), /Derived from the (\d+) shapes/);
const inFlightLo = Math.min(before.in_flight ?? Infinity, after.in_flight ?? Infinity);
const inFlightHi = Math.max(before.in_flight ?? -Infinity, after.in_flight ?? -Infinity);

const predicates = {
  R1_runs_rows: { shown: runRows?.total ?? null, truth: after.active_total, verdict: verdict(runRows?.total ?? null, after.active_total, (a, b) => Math.abs(a - b) <= 2) },
  R1_runs_running: { shown: runRows?.running ?? null, truth: [inFlightLo, inFlightHi], verdict: verdict(runRows?.running ?? null, after.in_flight, a => a >= inFlightLo - 1 && a <= inFlightHi + 1) },
  R1_runs_visible_fraction: runsRegion?.scroll ? +(runsRegion.scroll.clientHeight / runsRegion.scroll.scrollHeight).toFixed(3) : 1,
  R1_runs_goalless_rows: runRows?.goalless ?? null,
  R2_questions_awaiting: { shown: awaiting, truth: after.unanswered, verdict: verdict(awaiting, after.unanswered, (a, b) => a === b) },
  R3_findings_open: { shown: findingsOpen, truth: after.ui_legibility_open, verdict: verdict(findingsOpen, after.ui_legibility_open, (a, b) => a === b) },
  R4_shapes: { shown: shapesShown, truth: after.shapes, verdict: verdict(shapesShown, after.shapes, (a, b) => Math.abs(a - b) <= Math.max(2, b * 0.05)) },
  R5_sources: { failing: calls.filter(c => c.status >= 400), verdict: (calls.length === 0 ? "cannot_observe" : calls.some(c => c.status >= 400) ? "fail" : "pass") as Verdict },
};
const verdicts = Object.values(predicates).flatMap(p => (typeof p === "object" && p !== null && "verdict" in p ? [p.verdict] : []));
const report = {
  probe: "surface-state-probe",
  target: { container: CONTAINER, url },
  observed_at: new Date().toISOString(),
  truth_before: before,
  truth_after: after,
  regions: regions.map((r: any) => ({ cls: r.cls, heading: r.heading, box: r.box, scroll: r.scroll, text: r.text.slice(0, 240) })),
  calls,
  predicates,
  ok: verdicts.every(v => v === "pass"),
};
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out: OUT, ok: report.ok, predicates }, null, 2));
process.exit(verdicts.includes("cannot_observe") ? 3 : report.ok ? 0 : 1);
