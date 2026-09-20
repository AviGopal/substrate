#!/usr/bin/env bun
/**
 * FIDELITY PROBE — the first mechanical instrument of the suitability scorecard.
 *
 * It answers exactly one question, mechanically: when the substrate hands a human
 * some bytes through this surface, are they THE SAME BYTES, still all there, and
 * can the human actually get to the original by using the interface?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS PROBE CANNOT ESTABLISH — read this before quoting any number from it
 * ─────────────────────────────────────────────────────────────────────────────
 * Fidelity is a floor, not suitability. This probe observes bytes and DOM. It
 * does NOT and CANNOT observe:
 *   • ORIENTATION — whether a person can tell where they are, what is being
 *     asked, or what happens next. Nothing here reads a person's model of the
 *     page.
 *   • COMPREHENSION — whether the preserved bytes MEAN anything to the reader.
 *     A byte-perfect rendering of an unreadable payload passes every predicate
 *     below.
 *   • APPEAL / trust / willingness to participate.
 *   • ATTENTION — `delivered` means the page reached ready state without console
 *     errors and did not scroll sideways. It does NOT mean anyone looked.
 * Those are human-resolver judgements. A green run here is evidence ONLY that
 * the surface did not corrupt, drop, or hide what it was given. Reading it as
 * evidence of usability is the exact confusion this header exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PREDICATES (each independently reported; never collapsed)
 * ─────────────────────────────────────────────────────────────────────────────
 *   F1 NO COERCION      — an impulse written through the vessel's write path and
 *                         read back deep-equals what was supplied; the rendered
 *                         DOM carries no literal "[object Object]" and no
 *                         SILENTLY truncated field (truncation with a working F3
 *                         disclosure is not silent; truncation without one is).
 *   F2 NO DEFAULTING    — a field-partial second write (same panel id, one field
 *                         named) preserves the fields it did not name.
 *   F3 ORIGINAL REACHABLE — the byte-faithful original is reached BY CLICKING the
 *                         affordance in a real browser. Reading the original out
 *                         of the API or the source bundle does NOT satisfy F3;
 *                         the claim is that a HUMAN can get to it, so the probe
 *                         proves the control was closed, clicks it, and compares
 *                         the revealed text to the supplied bytes.
 *
 * `delivered` and `fidelity_ok` are TWO SEPARATE FIELDS. A page can be perfectly
 * delivered and completely unfaithful; that pair is the whole point of the
 * instrument. Collapsing them would let "it rendered" launder "it was right".
 *
 * CANNOT-OBSERVE IS NOT A PASS. If chromium will not launch, the page never
 * reaches ready, or the F3 affordance is absent, this exits with a
 * `structuredError` and writes NOTHING — no report, no `available:false`, no
 * gap, no observation. The reasoning is written out at
 * repos/development-vessel/src/resolvers/ui-legibility-scan.ts:95-115: a
 * detector graded on "I could not look" converges on "reliable" from a
 * population of blind runs and becomes a self-confirming oracle for itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────────
 *   PLAYWRIGHT_MODULE=... CHROMIUM_EXECUTABLE=... bun run fidelity-probe.ts [flags]
 *
 *   --store=real          drive human-surface-vessel's REAL in-process routers
 *                         (default)
 *   --store=coercing      drive a local fixture store that reproduces the live
 *                         stateful-ui-vessel (:8270) coercion semantics
 *                         (`String(pointer.body ?? "")`). The fixture exists so
 *                         the probe's own red state is demonstrable WITHOUT
 *                         touching a live vessel.
 *   --store=preserving    the POSITIVE CONTROL: the same local fixture with both
 *                         defect classes absent. The only arm expected to go
 *                         green, and the one that proves the PASS path and its
 *                         emission actually execute.
 *   --emit=inprocess      (default) emissions go to DISPOSABLE in-process
 *                         routers rooted at a fresh WORKSPACE_ROOT: the
 *                         observation/assertion through human-surface's real
 *                         resolve route, the gap through development-vessel's
 *                         real `substrateGap_write` resolver writing to
 *                         $WORKSPACE_ROOT/gaps/gaps.json.
 *   --emit=<url>          POST `{impulse:{pointer}}` to a real vessel. NOT the
 *                         default, deliberately: pointing this at a live surface
 *                         is an operator decision, not a side effect of running
 *                         a probe.
 *   --viewport=1440x900   declared viewport; recorded in the output record.
 *   --panel-prefix=<s>    panel id prefix for this run.
 *
 * EXIT CODES: 0 delivered && fidelity_ok · 1 a predicate failed (gap emitted)
 *             2 bad binding / usage · 3 CANNOT OBSERVE (structuredError)
 *
 * NEVER writes `uiFeedback`. That channel is human contributions only and
 * already carries a refusal guard added after 48 machine records polluted it.
 * The emitter below refuses the shape outright rather than trusting call sites.
 */

import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert/strict";

// ── bindings ────────────────────────────────────────────────────────────────
// `?? default` DOES NOT GUARD "". An empty-string binding is exactly how the
// fleet's existing legibility arm silently never fires: it reads as present,
// resolves to nothing, and the arm reports clean. Reject up front, loudly.
const argv = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const hit = argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (hit === undefined) return fallback;
  const [, ...rest] = hit.split("=");
  return rest.join("=");
}
function requireBinding(name: string, value: unknown): string {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    console.error(
      `[fidelity-probe] REFUSING TO RUN: binding '${name}' is ${value === undefined ? "undefined" : value === null ? "null" : "an empty string"}.\n` +
      `  An empty or nullish binding is not a default — it is a probe that cannot fire while reporting clean.\n` +
      `  Supply --${name}=<value>.`,
    );
    process.exit(2);
  }
  return String(value);
}

const STORES = ["real", "coercing", "preserving"] as const;
const STORE = requireBinding("store", flag("store", "real"));
if (!(STORES as readonly string[]).includes(STORE)) {
  console.error(`[fidelity-probe] REFUSING TO RUN: --store must be one of ${STORES.join(", ")}, got '${STORE}'.`);
  process.exit(2);
}
const EMIT = requireBinding("emit", flag("emit", "inprocess"));
const PANEL_PREFIX = requireBinding("panel-prefix", flag("panel-prefix", "fidelity"));
const VIEWPORT_RAW = requireBinding("viewport", flag("viewport", "1440x900"));
const vpMatch = /^(\d+)x(\d+)$/.exec(VIEWPORT_RAW);
if (!vpMatch) {
  console.error(`[fidelity-probe] REFUSING TO RUN: --viewport must look like 1440x900, got '${VIEWPORT_RAW}'.`);
  process.exit(2);
}
const VIEWPORT = { width: Number(vpMatch[1]), height: Number(vpMatch[2]) };

// ── containment ─────────────────────────────────────────────────────────────
// Set BEFORE any vessel import: both human-surface's journal and
// development-vessel's gap store capture WORKSPACE_ROOT at module load.
const WORKSPACE = mkdtempSync("/tmp/fidelity-probe-");
process.env["WORKSPACE_ROOT"] = WORKSPACE;
// development-vessel's gap writer has real production side effects (a
// `systemctl start gap-compose.service` spawn and an event publish to
// activity-api). Neither belongs in a probe run. Suppress the first; point the
// second, and every other outbound vessel default, at a dead loopback port so a
// stray host listener can never receive a probe emission.
process.env["SUBSTRATE_GAP_SKIP_COMPOSE_TRIGGER"] = "1";
process.env["ACTIVITY_API_ENDPOINT"] = "http://127.0.0.1:1";
process.env["ACTIVITY_API_URL"] = "http://127.0.0.1:1";
process.env["DEV_VESSEL_ENDPOINT"] = "http://127.0.0.1:1";

const REPO_ROOT = "/home/avi/documents/work/substrate";
const HS_REPO = `${REPO_ROOT}/repos/human-surface-vessel`;

// ── the payload: hostile but legible bytes ──────────────────────────────────
// A tail sentinel makes truncation detectable without guessing an ellipsis
// convention. Quotes, tabs, interior newlines and non-ASCII catch escaping and
// normalisation classes that a plain ASCII word would sail past.
const TAIL = "END-SENTINEL-7f3a";
const STRING_BODY =
  "Resource contention is \"confirmed\" — but the cause is not.\n" +
  "\tindented evidence line: ρ=0.82, Δt=1.4s, naïve → corrected\n" +
  "  two leading spaces and a trailing pipe |\n" +
  `${"padding ".repeat(60)}${TAIL}`;
const OBJECT_BODY = {
  claim: "Resource contention is confirmed",
  source: "The cause is still unverified",
  reference: { type: "incident", id: "42", nested: { depth: 3, list: [1, 2, 3] } },
  quoted: 'he said "no" — she said \'maybe\'',
  unicode: "ρ Δ naïve 中文",
  tail: TAIL,
};
const MACHINE_ORIGIN =
  "MACHINE-GENERATED by validation/human-participation/fidelity-probe.ts — NOT a human contribution.";

const STRING_PANEL = `${PANEL_PREFIX}-f1-string`;
const OBJECT_PANEL = `${PANEL_PREFIX}-f1-object`;
const PARTIAL_PANEL = `${PANEL_PREFIX}-f2-partial`;
const TITLE_STRING = "Fidelity probe: verbatim string payload";
const TITLE_OBJECT = "Fidelity probe: structured payload";

// ── result model ────────────────────────────────────────────────────────────
type Check = {
  name: string;
  ok: boolean;
  detail: string;
  /** Set on a failing check: names the gap this failure files. */
  gap?: { field: string; kind: "coerced" | "lost" | "defaulted" };
};
type Predicate = { id: "F1" | "F2" | "F3"; name: string; ok: boolean; checks: Check[] };

const predicates: Predicate[] = [];
function predicate(id: Predicate["id"], name: string, checks: Check[]): Predicate {
  const p = { id, name, ok: checks.every(c => c.ok), checks };
  predicates.push(p);
  return p;
}
const uncovered: string[] = []; // A SILENT SKIP READS AS A PASS. Name it.

function cleanup(): void {
  try { rmSync(WORKSPACE, { recursive: true, force: true }); } catch { /* best effort */ }
}

/**
 * CANNOT OBSERVE. Not a report, not `available:false`, not a pass — and no gap
 * either, because "I could not look" is not a finding about the surface.
 */
function cannotObserve(reason: string, detail: string, extra: Record<string, unknown> = {}): never {
  const record = {
    shape: "structuredError",
    body: {
      detail: `fidelity_probe could not observe the surface: ${detail}`,
      available: false,
      reason,
      probe: "fidelity_probe",
      store: STORE,
      emit_target: EMIT,
      viewport: VIEWPORT,
      predicates_attempted: predicates.map(p => p.id),
      emitted_nothing:
        "no interactorObservation, no interactorAssertion, no substrateGap_write, no pass recorded, no report",
      completed_at: new Date().toISOString(),
      ...extra,
    },
  };
  console.log(JSON.stringify(record, null, 2));
  cleanup();
  process.exit(3);
}

// ── preflight: the browser bindings, checked explicitly, not with ?? ────────
const PLAYWRIGHT_MODULE = process.env["PLAYWRIGHT_MODULE"];
const CHROMIUM_EXECUTABLE = process.env["CHROMIUM_EXECUTABLE"];
for (const [name, value] of [
  ["PLAYWRIGHT_MODULE", PLAYWRIGHT_MODULE],
  ["CHROMIUM_EXECUTABLE", CHROMIUM_EXECUTABLE],
] as const) {
  if (value === undefined || value === null || value.trim() === "") {
    cannotObserve(
      "browser_binding_absent",
      `${name} is ${value === undefined ? "unset" : value === null ? "null" : "an empty string"}, so no real browser can be driven. F3 is a CLICK claim and cannot be simulated.`,
      { missing_binding: name },
    );
  }
}
if (!existsSync(CHROMIUM_EXECUTABLE!)) {
  cannotObserve("browser_binary_absent", `CHROMIUM_EXECUTABLE=${CHROMIUM_EXECUTABLE} does not exist on disk.`);
}

// ── the store under test ────────────────────────────────────────────────────
type Resolved = { status: number; json: any };
type Target = { label: string; resolve(pointer: Record<string, unknown>): Promise<Resolved> };

async function realTarget(): Promise<Target> {
  const { impulsesRouter } = await import(`${HS_REPO}/src/routes/impulses.ts`);
  return {
    label: "human-surface-vessel real in-process routers (src/routes/impulses.ts)",
    async resolve(pointer) {
      const res = await impulsesRouter.request("/v2/impulses/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pointer }),
      });
      return { status: res.status, json: await res.json() };
    },
  };
}

/**
 * LOCAL fixture stores. Neither one calls a real vessel; nothing here touches
 * :8270 or any live surface.
 *
 *   "coercing"   — reproduces the defects observed live: the panel body is
 *                  stringified on the way in, so an object arrives and is stored
 *                  as "[object Object]" while the response still says
 *                  `resolved:true`; and a field the writer did not name is
 *                  replaced by a placeholder rather than preserved. This arm
 *                  exists so the probe's RED state is demonstrable on demand.
 *   "preserving" — the POSITIVE CONTROL. Same store, same rendering path, with
 *                  the two defects absent: body kept as supplied, unnamed fields
 *                  merged from the existing revision. This is what the real
 *                  route is expected to do once the absence-preservation defect
 *                  is fixed, and it is the only arm that proves the probe CAN
 *                  go green — a detector that has never passed is as unproven as
 *                  one that has never failed.
 */
function fixtureTarget(mode: "coercing" | "preserving"): Target {
  const panels = new Map<string, any>();
  const coercing = mode === "coercing";
  return {
    label: coercing
      ? 'local fixture reproducing stateful-ui-vessel (:8270) semantics: body = String(pointer.body ?? ""), unnamed fields defaulted'
      : "local fixture POSITIVE CONTROL: body stored as supplied, unnamed fields merged from the previous revision",
    async resolve(pointer) {
      const type = pointer["type"];
      if (type === "uiPanel_write" || type === "uiQuestion_write") {
        const id = String(pointer["id"] ?? `panel-${Date.now()}`);
        const existing = panels.get(id);
        const now = Date.now();
        const named = (key: string, fallback: unknown) =>
          Object.hasOwn(pointer, key) ? pointer[key] : coercing ? fallback : (existing ? existing[key] : fallback);
        const stored = {
          id,
          title: typeof named("title", undefined) === "string" ? named("title", undefined) : "Untitled",
          // THE COERCION UNDER REPRODUCTION, on the coercing arm only.
          body: coercing ? String(pointer["body"] ?? "") : named("body", ""),
          kind: typeof named("kind", undefined) === "string" ? named("kind", undefined) : "question",
          importance: typeof named("importance", undefined) === "string" ? named("importance", undefined) : "medium",
          visibility: "public",
          revision: (existing?.revision ?? 0) + 1,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        panels.set(id, stored);
        return { status: 200, json: { resolved: true, success: true, shape: type, body: stored } };
      }
      if (type === "uiQuestion") {
        const wanted = pointer["id"] ?? pointer["panel_id"];
        const questions = [...panels.values()]
          .filter(p => p.kind === "question" && (!wanted || p.id === wanted))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(p => ({ ...p, responses: [], answers: [], answered: false, declined: false }));
        return {
          status: 200,
          json: { resolved: true, success: true, shape: type, body: { questions, total: questions.length, unanswered: questions.length } },
        };
      }
      return {
        status: 400,
        json: { resolved: false, success: false, error: `fixture store does not serve '${String(type)}'` },
      };
    },
  };
}

const target: Target = STORE === "real" ? await realTarget() : fixtureTarget(STORE as "coercing" | "preserving");

// ── the emitter ─────────────────────────────────────────────────────────────
type Emitter = {
  label: string;
  emit(pointer: Record<string, unknown>): Promise<Resolved>;
};

async function inProcessEmitter(): Promise<Emitter> {
  const { impulsesRouter } = await import(`${HS_REPO}/src/routes/impulses.ts`);
  const { resolveSubstrateGapWrite } = await import(
    `${REPO_ROOT}/repos/development-vessel/src/resolvers/substrate-gap.ts`
  );
  return {
    label: `disposable in-process routers (human-surface resolve route + development-vessel substrateGap_write) rooted at ${WORKSPACE}`,
    async emit(pointer) {
      if (pointer["type"] === "substrateGap_write") {
        const result = await resolveSubstrateGapWrite(pointer as any);
        const failed = result.shape === "structuredError";
        return { status: failed ? 500 : 200, json: { resolved: !failed, success: !failed, ...result } };
      }
      const res = await impulsesRouter.request("/v2/impulses/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pointer }),
      });
      return { status: res.status, json: await res.json() };
    },
  };
}

function urlEmitter(endpoint: string): Emitter {
  const url = endpoint.replace(/\/+$/, "");
  return {
    label: `explicit endpoint ${url} (operator-directed; NOT the default)`,
    async emit(pointer) {
      const res = await fetch(`${url}/v2/impulses/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ impulse: { pointer } }),
        signal: AbortSignal.timeout(10_000),
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
  };
}

const rawEmitter: Emitter = EMIT === "inprocess" ? await inProcessEmitter() : urlEmitter(EMIT);
/** uiFeedback is HUMAN CONTRIBUTIONS ONLY. Refuse at the chokepoint. */
const emitter: Emitter = {
  label: rawEmitter.label,
  async emit(pointer) {
    const type = String(pointer["type"] ?? "");
    if (type.startsWith("uiFeedback")) {
      throw new Error(
        "fidelity-probe REFUSES to write uiFeedback: that channel records human contributions only. " +
        "48 machine records once polluted it; the refusal guard exists because of that.",
      );
    }
    return rawEmitter.emit(pointer);
  },
};

// ── seed the F1/F3 panels ───────────────────────────────────────────────────
async function seed(pointer: Record<string, unknown>): Promise<Resolved> {
  const r = await target.resolve(pointer);
  if (r.status !== 200 || r.json?.resolved !== true) {
    cannotObserve(
      "write_path_rejected",
      `the store under test rejected the seed write for '${String(pointer["id"])}' (HTTP ${r.status}): ${JSON.stringify(r.json).slice(0, 300)}. Nothing was rendered, so no fidelity claim is possible.`,
    );
  }
  return r;
}

const stringSeed = await seed({
  type: "uiQuestion_write", id: STRING_PANEL, kind: "question",
  title: TITLE_STRING, body: STRING_BODY,
});
const objectSeed = await seed({
  type: "uiQuestion_write", id: OBJECT_PANEL, kind: "question",
  title: TITLE_OBJECT, body: OBJECT_BODY,
});

// ── F1 part 1: the WRITE PATH read-back (before any rendering) ──────────────
const f1Checks: Check[] = [];

function readBackCheck(name: string, supplied: unknown, stored: unknown, field: string): Check {
  if (typeof supplied === "string") {
    return supplied === stored
      ? { name, ok: true, detail: `stored value is byte-identical to the ${supplied.length}-byte string supplied` }
      : {
          name, ok: false, gap: { field, kind: "coerced" },
          detail: `supplied a ${supplied.length}-byte string, read back ${typeof stored} ${JSON.stringify(stored)?.slice(0, 160)}`,
        };
  }
  try {
    deepStrictEqual(stored, supplied);
    return { name, ok: true, detail: "stored value deep-equals the object supplied (structure, types and nesting)" };
  } catch (error) {
    return {
      name, ok: false, gap: { field, kind: "coerced" },
      detail:
        `supplied an object, read back ${typeof stored} ${JSON.stringify(stored)?.slice(0, 160)}` +
        (stored === "[object Object]"
          ? " — THIS IS THE LIVE COERCION CLASS: an object body stringified to the literal \"[object Object]\" while the response said resolved:true"
          : ` — ${(error as Error).message.split("\n")[0]}`),
    };
  }
}

const storedStringBody = stringSeed.json?.body?.body;
const storedObjectBody = objectSeed.json?.body?.body;
f1Checks.push(readBackCheck("write-path read-back (string body)", STRING_BODY, storedStringBody, "body"));
f1Checks.push(readBackCheck("write-path read-back (object body)", OBJECT_BODY, storedObjectBody, "body"));
f1Checks.push(
  stringSeed.json?.body?.title === TITLE_STRING
    ? { name: "write-path read-back (title)", ok: true, detail: "title round-tripped verbatim" }
    : { name: "write-path read-back (title)", ok: false, gap: { field: "title", kind: "coerced" },
        detail: `supplied ${JSON.stringify(TITLE_STRING)}, read back ${JSON.stringify(stringSeed.json?.body?.title)}` },
);

// ── serve the real UI bundle over a disposable server ───────────────────────
const distIndex = `${HS_REPO}/ui/dist/index.html`;
if (!existsSync(distIndex)) {
  cannotObserve("renderer_bundle_absent", `${distIndex} does not exist — run 'bun run build' in ui/ first. There is no surface to observe.`);
}

/**
 * Static paths the harness was asked for and could not serve. NOT silently
 * swallowed: a missing asset that index.html actually references is a real
 * delivery defect, so these are surfaced in `delivered_evidence` and the
 * resulting console error is left to count against `delivered`.
 */
const staticMisses: string[] = [];

const server = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    // Chromium requests /favicon.ico on its own; index.html never references
    // one. Answering 204 keeps a BROWSER DEFAULT from being scored as a defect
    // of the surface. Any other missing asset is a real miss (below).
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    if (path === "/api/questions") {
      const r = await target.resolve({ type: "uiQuestion" });
      return Response.json(r.json, { status: r.status });
    }
    if (path === "/api/render-policy") return Response.json({ tokenOverrides: {}, formByShape: {}, revision: 0 });
    if (path === "/api/discovery/shapes") return Response.json({ shapes: [] });
    if (path === "/api/resolve") return Response.json({ resolved: true, body: { dispatches: [] } });
    if (path === "/api/participation") {
      // The probe never contributes. A contribution is a human act.
      return Response.json({ error: "fidelity-probe does not contribute; it observes." }, { status: 405 });
    }
    if (path.startsWith("/api/")) return Response.json({ gaps: [] });
    const file = Bun.file(`${HS_REPO}/ui/dist${path === "/" ? "/index.html" : path}`);
    if (!(await file.exists())) {
      staticMisses.push(path);
      return new Response(`no such asset in ui/dist: ${path}`, { status: 404 });
    }
    return new Response(file);
  },
});

// ── the browser phase: delivered, F1 DOM, F3 click ─────────────────────────
let delivered = false;
let deliveredEvidence: Record<string, unknown> = {};
let rendererBundle = "unknown";
const f3Checks: Check[] = [];
let f3Ok = false;
let previewTruncated: boolean | null = null;

let chromium: any;
try {
  ({ chromium } = await import(PLAYWRIGHT_MODULE!));
} catch (error) {
  server.stop(true);
  cannotObserve("playwright_module_unloadable", `PLAYWRIGHT_MODULE=${PLAYWRIGHT_MODULE} could not be imported: ${(error as Error).message}`);
}

let browser: any;
try {
  browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
} catch (error) {
  server.stop(true);
  cannotObserve("chromium_launch_failed", `chromium would not launch from ${CHROMIUM_EXECUTABLE}: ${(error as Error).message}`);
}

try {
  const page = await browser.newPage({ viewport: VIEWPORT });
  // `delivered` is computed from BOTH error channels. pageerror alone misses a
  // console.error logged by a caught failure, which is exactly how a broken
  // render reports itself politely.
  const consoleErrors: string[] = [];
  page.on("pageerror", (e: Error) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m: any) => { if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`); });

  await page.goto(`http://127.0.0.1:${server.port}`, { waitUntil: "domcontentloaded" });
  const region = page.getByRole("region", { name: "Questions for you", exact: true });
  try {
    await region.getByRole("button", { name: new RegExp(TITLE_STRING) }).waitFor({ timeout: 15_000 });
  } catch (error) {
    const bodyText = await page.locator("body").innerText().catch(() => "<unreadable>");
    await browser.close(); server.stop(true);
    cannotObserve(
      "page_never_ready",
      `the questions region never listed the seeded panel within 15s. Page text: ${String(bodyText).slice(0, 400)}`,
      { console_errors: consoleErrors },
    );
  }

  rendererBundle = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map(s => (s as HTMLScriptElement).src.split("/").pop()).join(","));

  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const readyState = await page.evaluate(() => document.readyState);
  delivered = consoleErrors.length === 0 && noHScroll === true && readyState === "complete";
  deliveredEvidence = {
    ready_state: readyState,
    console_errors: consoleErrors,
    no_horizontal_scroll_at_declared_viewport: noHScroll,
    scroll_width: await page.evaluate(() => document.documentElement.scrollWidth),
    inner_width: await page.evaluate(() => window.innerWidth),
    harness_static_misses: [...staticMisses],
    note: "delivered is 'the page arrived intact'. It is NOT 'the content was faithful' and NOT 'anyone read it'.",
  };

  const active = region.locator(".sf-participation-detail > div:not([hidden])");

  /** F3: prove the control was CLOSED, click it, read what it revealed. */
  async function revealOriginal(panelTitle: string, panelId: string): Promise<string> {
    await region.getByRole("button", { name: new RegExp(panelTitle) }).click();
    await active.getByRole("heading", { name: panelTitle }).waitFor({ timeout: 10_000 });
    const details = active.locator("details.sf-question-history");
    if ((await details.count()) === 0) {
      await browser.close(); server.stop(true);
      cannotObserve(
        "f3_affordance_absent",
        `no 'details.sf-question-history' control exists on panel ${panelId}, so there is no affordance a human could click to reach the original. F3 is unobservable, not failed.`,
        { panel_id: panelId },
      );
    }
    const verbatim = details.locator("pre.sf-verbatim").first();
    const closedBefore = !(await details.evaluate((el: HTMLDetailsElement) => el.open));
    const hiddenBefore = !(await verbatim.isVisible());
    f3Checks.push(
      closedBefore && hiddenBefore
        ? { name: `original is NOT already on screen (${panelId})`, ok: true,
            detail: "the disclosure was closed and the verbatim block was not visible before the click, so the click is what revealed it" }
        : { name: `original is NOT already on screen (${panelId})`, ok: false, gap: { field: "affordance", kind: "lost" },
            detail: `disclosure state before click: open=${!closedBefore}, verbatim visible=${!hiddenBefore} — F3 cannot be attributed to a click if the text was already showing` },
    );
    // The control is the <summary>. Click it as a human would — no
    // `details.open = true` from script: that would prove the text exists, not
    // that the affordance works.
    const summary = details.locator("summary").first();
    await summary.waitFor({ state: "visible", timeout: 10_000 });
    await summary.click();
    if (!(await details.evaluate((el: HTMLDetailsElement) => el.open))) {
      await browser.close(); server.stop(true);
      cannotObserve(
        "f3_affordance_inert",
        `the 'Evidence and response history' summary on panel ${panelId} exists and was clicked, but the disclosure did not open. The affordance is present and inert; F3 is unobservable through it.`,
        { panel_id: panelId },
      );
    }
    await verbatim.waitFor({ state: "visible", timeout: 10_000 });
    const revealed = await verbatim.evaluate((el: HTMLElement) => el.textContent ?? "");
    f3Checks.push({
      name: `affordance activated by click (${panelId})`, ok: true,
      detail: `clicked the 'Evidence and response history' summary; details.open=true; verbatim block visible with ${revealed.length} chars`,
    });
    return revealed;
  }

  // The string panel: exact bytes.
  const revealedString = await revealOriginal(TITLE_STRING, STRING_PANEL);
  f3Checks.push(
    revealedString === STRING_BODY
      ? { name: `revealed text is byte-exact (${STRING_PANEL})`, ok: true,
          detail: `${revealedString.length} chars, identical to the ${STRING_BODY.length} bytes supplied` }
      : { name: `revealed text is byte-exact (${STRING_PANEL})`, ok: false, gap: { field: "body", kind: "coerced" },
          detail: `supplied ${STRING_BODY.length} bytes, revealed ${revealedString.length}: ${JSON.stringify(revealedString).slice(0, 200)}` },
  );

  // The collapsed preview may legitimately shorten. Truncation is only a FIDELITY
  // failure when the original is NOT reachable — that is what 'silently' means.
  const previewText = await active.locator(".sf-question-content").innerText().catch(() => "");
  previewTruncated = !previewText.includes(TAIL);

  // The object panel: indentation is rendering, not coercion, so parse then compare.
  const revealedObject = await revealOriginal(TITLE_OBJECT, OBJECT_PANEL);
  let objectRevealCheck: Check;
  try {
    deepStrictEqual(JSON.parse(revealedObject), OBJECT_BODY);
    objectRevealCheck = {
      name: `revealed structure deep-equals supplied object (${OBJECT_PANEL})`, ok: true,
      detail: "JSON.parse(revealed text) deep-equals the supplied object; only whitespace differs (that is rendering, not coercion)",
    };
  } catch (error) {
    objectRevealCheck = {
      name: `revealed structure deep-equals supplied object (${OBJECT_PANEL})`, ok: false,
      gap: { field: "body", kind: revealedObject.includes("[object Object]") ? "coerced" : "lost" },
      detail: `revealed ${JSON.stringify(revealedObject).slice(0, 200)} — ${(error as Error).message.split("\n")[0]}`,
    };
  }
  f3Checks.push(objectRevealCheck);
  f3Ok = f3Checks.every(c => c.ok);

  // F1 DOM checks.
  const pageText = await page.locator("body").innerText();
  f1Checks.push(
    pageText.includes("[object Object]")
      ? { name: "rendered DOM contains no literal \"[object Object]\"", ok: false, gap: { field: "body", kind: "coerced" },
          detail: `the string "[object Object]" is on screen ${(pageText.match(/\[object Object\]/g) ?? []).length}x — a stringified object reached a human's eyes` }
      : { name: "rendered DOM contains no literal \"[object Object]\"", ok: true,
          detail: `scanned ${pageText.length} chars of body innerText; zero occurrences` },
  );
  f1Checks.push(
    !previewTruncated
      ? { name: "no silently truncated field", ok: true, detail: `the collapsed preview carries the tail sentinel ${TAIL}; nothing was shortened` }
      : f3Ok
        ? { name: "no silently truncated field", ok: true,
            detail: `the collapsed preview is shortened (tail sentinel ${TAIL} absent) but the full original is reachable by clicking the disclosure (F3 green), so the shortening is DISCLOSED, not silent` }
        : { name: "no silently truncated field", ok: false, gap: { field: "body", kind: "lost" },
            detail: `the collapsed preview is shortened (tail sentinel ${TAIL} absent) AND F3 failed, so a human has no way to reach the missing bytes — this is silent truncation` },
  );

  await page.screenshot({ path: `${WORKSPACE}/fidelity-probe.png`, fullPage: true }).catch(() => {});
  await page.close();
} catch (error) {
  // An UNEXPECTED failure inside the observation block is a failure to OBSERVE,
  // not a finding about the surface, and it must not leave a half-built report
  // behind. `cannotObserve` exits 3 having emitted nothing. (Predicate failures
  // never come through here — they are recorded as checks, not thrown.)
  if (browser) await browser.close().catch(() => {});
  server.stop(true);
  cannotObserve(
    "unexpected_observation_failure",
    `the browser phase threw before the predicates could be completed: ${(error as Error).message?.split("\n")[0]}`,
    { stack: (error as Error).stack?.split("\n").slice(0, 6) },
  );
} finally {
  if (browser) await browser.close().catch(() => {});
}

predicate("F1", "NO COERCION — written bytes read back and rendered unchanged", f1Checks);

// ── F2: field-partial second write must not default what it did not name ────
const f2Checks: Check[] = [];
{
  const fullTitle = "Fidelity probe: partial-write subject";
  const first = await seed({
    type: "uiQuestion_write", id: PARTIAL_PANEL, kind: "question",
    title: fullTitle, body: OBJECT_BODY,
  });
  const firstRev = first.json?.body?.revision;

  // (a) name ONLY body — title must survive.
  const bodyOnly = await target.resolve({
    type: "uiQuestion_write", id: PARTIAL_PANEL, body: { ...OBJECT_BODY, claim: "revised claim" },
  });
  const titleAfter = bodyOnly.json?.body?.title;
  f2Checks.push(
    titleAfter === fullTitle
      ? { name: "body-only second write preserves title", ok: true, detail: `title still ${JSON.stringify(fullTitle)} at revision ${bodyOnly.json?.body?.revision}` }
      : { name: "body-only second write preserves title", ok: false, gap: { field: "title", kind: "defaulted" },
          detail: `second write named only 'body'; title was ${JSON.stringify(fullTitle)} and is now ${JSON.stringify(titleAfter)}${titleAfter === "Untitled" ? " — THE DEFAULTING CLASS: an unnamed field was replaced by a placeholder, not preserved" : ""}` },
  );

  // (b) name ONLY title — body must survive.
  const titleOnly = await target.resolve({
    type: "uiQuestion_write", id: PARTIAL_PANEL, title: "Fidelity probe: retitled only",
  });
  const bodyAfter = titleOnly.json?.body?.body;
  let bodyPreserved = false;
  try { deepStrictEqual(bodyAfter, { ...OBJECT_BODY, claim: "revised claim" }); bodyPreserved = true; } catch { /* reported below */ }
  f2Checks.push(
    bodyPreserved
      ? { name: "title-only second write preserves body", ok: true, detail: "body deep-equals the value written by the previous revision" }
      : { name: "title-only second write preserves body", ok: false, gap: { field: "body", kind: "lost" },
          detail: `second write named only 'title'; body is now ${JSON.stringify(bodyAfter)?.slice(0, 160)}${bodyAfter === "" ? " — THE BLANKING CLASS: an unnamed field was emptied" : ""}` },
  );
  f2Checks.push(
    typeof firstRev === "number" && typeof titleOnly.json?.body?.revision === "number" && titleOnly.json.body.revision > firstRev
      ? { name: "partial writes are revisions, not silent no-ops", ok: true, detail: `revision advanced ${firstRev} → ${titleOnly.json.body.revision}` }
      : { name: "partial writes are revisions, not silent no-ops", ok: false, gap: { field: "revision", kind: "lost" },
          detail: `revision did not advance: ${JSON.stringify(firstRev)} → ${JSON.stringify(titleOnly.json?.body?.revision)}` },
  );
}
predicate("F2", "NO DEFAULTING — a field-partial write preserves fields it did not name", f2Checks);
predicate("F3", "ORIGINAL REACHABLE — the byte-faithful original is reached by CLICKING the affordance", f3Checks);
uncovered.push(
  "F2 is asserted at the write path only; the probe does not re-render after a partial write, so a rendering-layer regression on a defaulted field would not be caught here.",
);
uncovered.push(
  "Only the human-surface question surface is observed. Other panels, other vessels and other regions are outside this run.",
);

const fidelityOk = predicates.every(p => p.ok);

// ── the record ──────────────────────────────────────────────────────────────
const record = {
  probe: "fidelity_probe",
  machine_origin: MACHINE_ORIGIN,
  store_under_test: target.label,
  store_arm: STORE,
  emit_target: emitter.label,
  renderer_bundle: rendererBundle,
  viewport: VIEWPORT,
  panels: {
    string: { id: STRING_PANEL, revision: stringSeed.json?.body?.revision },
    object: { id: OBJECT_PANEL, revision: objectSeed.json?.body?.revision },
    partial: { id: PARTIAL_PANEL },
  },
  // TWO FIELDS. NEVER ONE.
  delivered,
  delivered_evidence: deliveredEvidence,
  fidelity_ok: fidelityOk,
  predicates: predicates.map(p => ({ id: p.id, name: p.name, ok: p.ok, checks: p.checks })),
  preview_truncated: previewTruncated,
  not_established: [
    "orientation — whether a person can tell what is being asked",
    "comprehension — whether the preserved bytes mean anything to the reader",
    "appeal — whether anyone would want to participate",
    "attention — 'delivered' is arrival, not readership",
  ],
  could_not_cover: uncovered,
  completed_at: new Date().toISOString(),
};

// ── emit ────────────────────────────────────────────────────────────────────
const emissions: Record<string, unknown>[] = [];

if (fidelityOk) {
  // The PASS observation. `interactorObservation` is a served read shape, so the
  // record lands where the surface's own observation history is read.
  //
  // MEASURED LIMIT (not a guess — see the emission_faithful check below): the
  // route builds the stored record from named fields only (panel_id, ask_id,
  // duration_ms, position, visibility), so the per-predicate payload CANNOT ride
  // that shape. `interactorAssertion` is the served shape with a free-text body,
  // so the payload rides there and the observation marks the event. Both are
  // existing served shapes; nothing new is minted.
  const obs = await emitter.emit({
    type: "interactorObservation", obs_type: "focus", panel_id: STRING_PANEL,
    visibility: "operator_only",
    machine_origin: MACHINE_ORIGIN, probe: "fidelity_probe",
    fidelity_ok: fidelityOk, delivered, renderer_bundle: rendererBundle, viewport: VIEWPORT,
    predicates: record.predicates,
  });
  const obsBody = obs.json?.body ?? {};
  const droppedByRoute = ["machine_origin", "probe", "fidelity_ok", "delivered", "renderer_bundle", "viewport", "predicates"]
    .filter(k => !(k in obsBody));
  emissions.push({
    shape: "interactorObservation", status: obs.status, resolved: obs.json?.resolved === true,
    stored: obsBody,
    payload_fields_dropped_by_route: droppedByRoute,
    emission_faithful: droppedByRoute.length === 0,
    note: droppedByRoute.length
      ? "THE OBSERVATION ROUTE IS NOT UNCONSTRAINED. It dropped the listed payload fields (impulses.ts builds the record from named fields only). The payload therefore rides the interactorAssertion below; without it this emission would be a written-but-unreadable record."
      : "the route preserved every payload field",
  });

  const assertionBody = [MACHINE_ORIGIN, JSON.stringify(record, null, 2)].join("\n");
  const assertion = await emitter.emit({
    type: "interactorAssertion", kind: "fidelity_probe", body: assertionBody, visibility: "operator_only",
  });
  const storedAssertion = assertion.json?.body?.body;
  emissions.push({
    shape: "interactorAssertion", status: assertion.status, resolved: assertion.json?.resolved === true,
    id: assertion.json?.body?.id,
    first_line: String(storedAssertion ?? "").split("\n")[0],
    round_tripped_byte_exact: storedAssertion === assertionBody,
    note: "carries the full per-predicate record; first line is the machine-origin marker so nothing can mistake it for a human contribution",
  });
} else {
  // A FAILING PREDICATE FILES A GAP, one per distinct (field, kind).
  const seen = new Set<string>();
  for (const p of predicates) {
    for (const c of p.checks) {
      if (c.ok || !c.gap) continue;
      const id = `ui-fidelity-${c.gap.field}-${c.gap.kind}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const res = await emitter.emit({
        type: "substrateGap_write",
        gap: {
          id,
          category: "ui_legibility",
          source: "substrate_detected",
          status: "open",
          summary: `UI fidelity violation (${p.id} ${c.name}) on ${target.label}: ${c.detail}`,
          detected_at: new Date().toISOString(),
          classification_metadata: {
            surface: "human-surface-vessel",
            region: STRING_PANEL,
            predicate: p.id,
            field: c.gap.field,
            kind: c.gap.kind,
            check: c.name,
            detail: c.detail,
            renderer_bundle: rendererBundle,
            viewport: VIEWPORT,
            delivered,
            store_arm: STORE,
            machine_origin: MACHINE_ORIGIN,
          },
        },
      });
      emissions.push({
        shape: "substrateGap_write", gap_id: id, status: res.status,
        resolved: res.json?.resolved === true, action: res.json?.body?.action,
      });
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const gapStore = `${WORKSPACE}/gaps/gaps.json`;
const gapsOnDisk = existsSync(gapStore)
  ? (JSON.parse(readFileSync(gapStore, "utf8")) as any[]).map(g => ({ id: g.id, category: g.category, source: g.source }))
  : [];

console.log(JSON.stringify({ ...record, emissions, gap_store_rows: gapsOnDisk }, null, 2));
console.log("\n=== FIDELITY PROBE ===");
console.log(`store        ${target.label}`);
console.log(`emit target  ${emitter.label}`);
console.log(`renderer     ${rendererBundle} @ ${VIEWPORT.width}x${VIEWPORT.height}`);
console.log(`delivered    ${delivered}   (page arrived intact — NOT a fidelity claim, NOT readership)`);
console.log(`fidelity_ok  ${fidelityOk}`);
for (const p of predicates) {
  console.log(`  [${p.ok ? "PASS" : "FAIL"}] ${p.id} ${p.name}`);
  for (const c of p.checks) console.log(`         ${c.ok ? "ok  " : "FAIL"} ${c.name} — ${c.detail}`);
}
for (const e of emissions) console.log(`  emitted ${JSON.stringify(e).slice(0, 220)}`);
for (const u of uncovered) console.log(`  NOT COVERED: ${u}`);
console.log("NOT ESTABLISHED: orientation, comprehension, appeal. This probe observes bytes and DOM only.");

server.stop(true);
cleanup();
process.exit(fidelityOk && delivered ? 0 : 1);
