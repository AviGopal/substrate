// Stage-5 evidence: two compatible variants of one interaction (repertoire v1
// "stacked" vs v2 "onepage"), selectable THROUGH THE SYSTEM (renderPolicy impulse),
// with recorded assignment and confirmed browser exposure — plus the adoption
// boundary: a mid-session selection change must NOT reflow the open page.
import { mkdtempSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const workspace = mkdtempSync("/tmp/stage5-variants-");
process.env.WORKSPACE_ROOT = workspace;
const repo = "/home/avi/documents/work/substrate/repos/human-surface-vessel";
const { impulsesRouter } = await import(repo + "/src/routes/impulses.ts");
const { participationRouter } = await import(repo + "/src/routes/participation.ts");
const { getRenderPolicy } = await import(repo + "/src/store.ts");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

async function writePolicy(pointer: Record<string, unknown>) {
  const res = await impulsesRouter.request("/v2/impulses/resolve", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pointer: { type: "renderPolicy_write", ...pointer } }),
  });
  assert.equal(res.status, 200);
  return (await res.json() as any).body;
}

await impulsesRouter.request("/v2/impulses/resolve", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ pointer: { type: "uiQuestion_write", id: "s5-variant-q", title: "Variant check question", body: { asks: [{ id: "a", text: "Visible under both variants?" }] } } }) });

const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/questions" || path === "/api/participation") return participationRouter.fetch(request);
  if (path === "/api/render-policy") return Response.json(getRenderPolicy());
  if (path === "/api/discovery/shapes") return Response.json({ shapes: [] });
  if (path === "/api/resolve") return Response.json({ resolved: true, body: { dispatches: [] } });
  if (path.startsWith("/api/")) return Response.json({ gaps: [] });
  return new Response(Bun.file(repo + "/ui/dist" + (path === "/" ? "/index.html" : path)));
}});

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const url = `http://127.0.0.1:${server.port}`;
const layout = (page: any) => page.evaluate(() => ({
  presentation: document.documentElement.dataset["presentation"],
  pageScrolls: document.scrollingElement!.scrollHeight > document.scrollingElement!.clientHeight + 1,
  gridAreas: getComputedStyle(document.querySelector(".sf-app")!).gridTemplateAreas,
}));
try {
  // ── Variant A: onepage (default policy, revision 0) ──
  const pageA = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pageA.goto(url);
  await pageA.getByRole("heading", { name: "Variant check question" }).waitFor();
  const a = await layout(pageA);
  assert.equal(a.presentation, "onepage");
  assert.equal(a.pageScrolls, false);
  assert.notEqual(a.gridAreas, "none");
  await pageA.screenshot({ path: "/tmp/stage5-onepage.png" });
  console.log(`[A] exposure confirmed: presentation=onepage, page does not scroll, grid areas active; policy revision ${getRenderPolicy().revision}`);

  // ── Adoption boundary: select "stacked" while page A is open ──
  const assignment = await writePolicy({ presentation: "stacked",
    note: "stage-5 assignment: variant=stacked (repertoire v1), assigned_by operator:avi, reason: selectability evidence run — not an experiment" });
  console.log(`[assignment] recorded: revision ${assignment.revision}, presentation ${assignment.presentation}, note carries assigner+reason`);
  await pageA.waitForTimeout(2600); // beyond the policy poll cadence
  const aHeld = await layout(pageA);
  assert.equal(aHeld.presentation, "onepage");
  assert.equal(aHeld.pageScrolls, false);
  console.log("[A] adoption boundary HELD: selection changed mid-session, open page did not reflow");
  await pageA.close();

  // ── Variant B: stacked, adopted at the next page load ──
  const pageB = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pageB.goto(url);
  await pageB.getByRole("heading", { name: "Variant check question" }).waitFor();
  await pageB.waitForFunction(() => document.documentElement.dataset["presentation"] !== undefined);
  const b = await layout(pageB);
  assert.equal(b.presentation, "stacked");
  assert.equal(b.gridAreas, "none");
  assert.equal(b.pageScrolls, true); // v1 stacks: at 900h with content the page scrolls again
  await pageB.screenshot({ path: "/tmp/stage5-stacked.png", fullPage: false });
  console.log("[B] exposure confirmed: presentation=stacked renders v1 order (no grid areas, page scrolls)");

  // ── And back: recovery to the adopted baseline ──
  const back = await writePolicy({ presentation: "onepage", note: "stage-5: restore onepage" });
  const pageC = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pageC.goto(url);
  await pageC.waitForFunction(() => document.documentElement.dataset["presentation"] === "onepage");
  const c = await layout(pageC);
  assert.equal(c.pageScrolls, false);
  console.log(`[C] recovery confirmed at revision ${back.revision}: onepage restored on next load`);
  await pageB.close(); await pageC.close();
  console.log("PASS stage-5: two variants selectable through renderPolicy, assignments recorded with revisions, exposure confirmed in-browser, adoption boundary held");
} finally {
  await browser.close(); server.stop(true); rmSync(workspace, { recursive: true, force: true });
}
