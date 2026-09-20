// Stage-4 replayable trace: presentation → contribution → (attempted) consumption.
// Runs the REAL human-surface routes against a disposable workspace, renders in a
// real browser, contributes through the browser adapter, then runs the REAL
// downstream consumer (development-vessel's solicitation-outcome-scan) against the
// same journals. Every link prints its evidence; a link that does not hold prints
// as MISSING with the reason. Re-running reproduces the same chain.
//
// Env: PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE (same as the vessel probes).
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const workspace = mkdtempSync("/tmp/stage4-trace-");
process.env.WORKSPACE_ROOT = workspace;
const repo = "/home/avi/documents/work/substrate/repos/human-surface-vessel";
const { impulsesRouter } = await import(repo + "/src/routes/impulses.ts");
const { participationRouter } = await import(repo + "/src/routes/participation.ts");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const links: Array<{ link: string; status: "HELD" | "MISSING"; evidence: string }> = [];
const record = (link: string, status: "HELD" | "MISSING", evidence: string) => {
  links.push({ link, status, evidence });
};

async function resolveShape(pointer: Record<string, unknown>) {
  const res = await impulsesRouter.request("/v2/impulses/resolve", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pointer }),
  });
  return { status: res.status, json: await res.json() as any };
}

// ── 1. Activity context ──────────────────────────────────────────────────────
// A REAL escalation: gap orphaned-capability-mcp:tool_call, escalated by
// gap_to_feature after 8+ failed autonomous repairs (frozen from the live
// substrate 2026-09-20; fixtures/live-escalation-panels-2026-09-20.json).
const panelId = "needs-human-orphaned-capability-mcp:tool_call";
const seed = await resolveShape({
  type: "uiQuestion_write", id: panelId, kind: "question",
  title: "Gap needs a human decision",
  body: {
    provenance: { mirrored_from: "stateful-ui-vessel live panel", frozen_fixture: "live-escalation-panels-2026-09-20.json", originating_activity: "gap_to_feature", gap_id: "orphaned-capability-mcp:tool_call" },
    situation: "Resolver \"mcp:tool_call\" is a live registered capability invoked by 0 of the activity corpus after 8+ failed auto-repairs with 0 lands.",
    asks: [{ id: "disposition", text: "Redefine the goal, provide missing information, grant access, or drop it?" }],
  },
});
assert.equal(seed.status, 200);
record("activity-context → journaled question", "HELD",
  `uiQuestion_write ${panelId} accepted; goal identity carried in body.provenance.gap_id; journal ${workspace}/interactor-log/uiPanel_write.jsonl`);

// ── 2. Presentation assignment ───────────────────────────────────────────────
const assignment = await resolveShape({
  type: "renderPolicy_write",
  policy: { presentation_version: "repertoire-v2-onepage", parent: "repertoire-v1", assigned_by: "operator:avi", reason: "stage-4 trace; v2 is the only deployed candidate — no experiment, no randomization" },
});
record("presentation assignment", assignment.status === 200 ? "HELD" : "MISSING",
  assignment.status === 200
    ? `renderPolicy_write accepted rev=${JSON.stringify(assignment.json?.body?.revision ?? assignment.json?.body ?? "?")}; version+reason recorded as a shaped impulse`
    : `renderPolicy_write rejected (${assignment.status}): ${JSON.stringify(assignment.json).slice(0, 200)}`);

// ── 3. Actual presentation (real browser) ────────────────────────────────────
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/resolve" || path === "/v2/impulses/resolve") return impulsesRouter.fetch(new Request(`http://x/v2/impulses/resolve`, request));
  if (path === "/api/questions" || path === "/api/participation") return participationRouter.fetch(request);
  if (path === "/api/render-policy") return Response.json({ tokenOverrides: {}, formByShape: {}, revision: 1 });
  if (path === "/api/discovery/shapes") return Response.json({ shapes: [] });
  if (path === "/api/resolve") return Response.json({ resolved: true, body: { dispatches: [] } });
  if (path.startsWith("/api/")) return Response.json({ gaps: [] });
  return new Response(Bun.file(repo + "/ui/dist" + (path === "/" ? "/index.html" : path)));
}});

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
try {
  const viewport = { width: 1440, height: 900 };
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:${server.port}`);
  const region = page.getByRole("region", { name: "Questions for you", exact: true });
  await region.getByRole("heading", { name: "Gap needs a human decision" }).waitFor();
  const bundle = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map(s => (s as HTMLScriptElement).src.split("/").pop()).join(","));
  await page.screenshot({ path: "/tmp/stage4-presentation.png" });
  record("actual presentation", "HELD",
    `rendered in Chromium ${viewport.width}x${viewport.height}; renderer bundle ${bundle}; question heading visible; screenshot /tmp/stage4-presentation.png`);
  record("exposure", "HELD",
    "panel was in the visible question list and its detail was on screen (bounding assertions in the one-page probe cover the layout); ATTENTION IS NOT CLAIMED — visibility only");

  // ── 4. Contribution through the browser ────────────────────────────────────
  const active = region.locator(".sf-participation-detail > div:not([hidden])");
  await active.getByLabel("Your contribution", { exact: true }).fill(
    "Disposition: redefine. Author a deterministic activity that invokes mcp:tool_call on a scheduled tick; do not LLM-re-derive. If no caller can be named, drop the capability instead.");
  await region.getByRole("button", { name: "Send contribution", exact: true }).click();
  await region.getByText("Your contribution is recorded.", { exact: true }).waitFor();
  const feedbackLines = readFileSync(`${workspace}/interactor-log/uiFeedback_write.jsonl`, "utf8").trim().split("\n");
  const last = JSON.parse(feedbackLines[feedbackLines.length - 1]);
  assert.equal(last.panelId, panelId);
  record("contribution → durable journal + receipt", "HELD",
    `receipt shown in browser; journal line: id=${last.id} panelId=${last.panelId} rev=${last.panelRevision} receivedAt=${last.receivedAt}; original content preserved verbatim`);
  await page.close();
} finally {
  await browser.close();
}

// ── 5. Consumption: run the REAL downstream consumer against these journals ──
process.env["STATEFUL_UI_VESSEL_ENDPOINT"] = `http://127.0.0.1:${server.port}`;
const { resolveSolicitationOutcomeScan } = await import(
  "/home/avi/documents/work/substrate/repos/development-vessel/src/resolvers/solicitation-outcome-scan.ts");
const scan = await resolveSolicitationOutcomeScan({ solicitation_ids: [panelId] });
const scanText = JSON.stringify(scan);
const sawAnswer = /"answered":\s*\[[^\]]*needs-human-orphaned/.test(scanText) || scanText.includes("\"answered_count\":1");
if (sawAnswer) {
  record("consumption by a subsequent activity", "HELD", `solicitation_outcome_scan recognized the answer: ${scanText.slice(0, 300)}`);
} else {
  record("consumption by a subsequent activity", "MISSING",
    `solicitation_outcome_scan ran against the same workspace and did NOT see the answer. Cause on record: the journal writes flat camelCase entries while the reader parses {pointer:{panel_id}} — open gap human-surface-participation-journal-records-unreadable-by-interactor-log-consumers. Scan output: ${scanText.slice(0, 400)}`);
}

// ── 6-7. Consequence / learning / reuse ──────────────────────────────────────
record("consequence (artifact/decision changed)", "MISSING",
  "no activity consumed the contribution, so no consequence exists; the live consequence path (goal-host human_input retry, escalation_disposition_apply) was not exercised — the latter has no scheduler (stage-1 matrix)");
record("learning (posterior/template/concept update)", "MISSING",
  "no consumption → no learning write; the only human→learned-state path is unreachable (stage-1 matrix, hollowness register #6)");
record("later reuse", "MISSING", "no mechanism retrieves past human contributions for later tasks (stage-1 matrix, transition 7)");

server.stop(true);
rmSync(workspace, { recursive: true, force: true });

console.log("\n=== STAGE-4 TRACE (replayable) ===");
for (const l of links) console.log(`[${l.status}] ${l.link}\n        ${l.evidence}\n`);
const held = links.filter(l => l.status === "HELD").length;
console.log(`${held}/${links.length} links held; every MISSING link names its cause and the open gap that owns it.`);
