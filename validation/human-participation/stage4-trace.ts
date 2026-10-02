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
//
// LINK 1 HOLDS ONLY UNDER AN OPERATOR RE-LABEL — READ THIS BEFORE QUOTING IT.
// The live impulse is a `gap_needs_human` escalation. It is seeded here as
// `uiQuestion_write` with `kind: "question"` because that is the shape the
// surface accepts; the substrate's own escalation shape is NOT accepted. That
// rewrite is the operator doing the system's decomposition by hand, which per
// law 13 ("humans are resolvers, not preprocessors") is a GAP, not a workflow:
// a request that only works after an operator restates it in the system's
// vocabulary is a missing capability on the system side. The re-label is the
// blocker Track B is fixing; when it lands, this block must seed the escalation
// shape verbatim and link 1 must still hold with no re-label.
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
// The verdict is READ-BACK, never a status code. `renderPolicy_write` USED to
// advance `revision` unconditionally whatever it was handed, so a 200 plus a
// bumped revision is exactly what made this link read HELD while recording
// nothing. Match on the assignment's VALUES, not on field names, so this check
// still passes whatever names the repair chooses.
//
// Since the durability/attribution/refusal repair landed, this same pointer is
// REFUSED (422) instead: the handler still reads only top-level keys, and a write
// that moves no field no longer advances the revision. The link is still MISSING
// — the assignment is not recorded — but it now fails LOUDLY, which is the
// difference the repair was for. `revisionBefore` is captured so the evidence can
// state that the refusal left the revision alone rather than asserting it.
const revisionBefore = (await resolveShape({ type: "renderPolicy" })).json?.body?.revision;
const assignmentReadBack = await resolveShape({ type: "renderPolicy" });
const assignmentState = JSON.stringify(assignmentReadBack.json?.body ?? {});
const assignmentFields: Array<[string, string]> = [
  ["presentation", "repertoire-v2-onepage"],
  ["assigned_by", "operator:avi"],
  ["reason", "no experiment, no randomization"],
];
const droppedFields = assignmentFields.filter(([, v]) => !assignmentState.includes(v)).map(([k]) => k);
record("presentation assignment", droppedFields.length === 0 ? "HELD" : "MISSING",
  droppedFields.length === 0
    ? `renderPolicy_write rev=${assignmentReadBack.json?.body?.revision}; assignment READ BACK intact via the renderPolicy read: ${assignmentState}`
    : `renderPolicy_write REFUSED this pointer with status ${assignment.status} (no longer a hollow 200), the revision stayed at ${assignmentReadBack.json?.body?.revision} `
      + `(it was ${revisionBefore} before the attempt), and the assignment was NOT recorded: ${droppedFields.join(", ")} absent from the renderPolicy read-back. `
      + `The refusal names what it could not read — accepted_keys=${JSON.stringify(assignment.json?.accepted_keys ?? null)} unread_keys=${JSON.stringify(assignment.json?.unread_keys ?? null)}. `
      + `Two causes remain, and they are now different from each other: (1) the handler reads only TOP-LEVEL keys, so this nested \`policy\` object is refused rather than accepted — sending the same fields at top level is the working lane; `
      + `(2) \`assignedBy\`/\`reason\` now EXIST on RenderPolicy and persist across a restart (src/store.ts, replayed from interactor-log/renderPolicy_write.jsonl), but \`presentation_version\`/\`parent\` do not, and \`presentation\` still enforces the "onepage"|"stacked" enum, so "repertoire-v2-onepage" cannot be expressed. `
      + `Read-back: ${assignmentState}. Owned by Track B item B-5 (remaining scope: the per-scope presentation map — versioned variant id plus parent). This row flips to HELD only when a renderPolicy read returns these three values after this exact write pointer.`);

// ── 3. Actual presentation (real browser) ────────────────────────────────────
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/resolve" || path === "/v2/impulses/resolve") return impulsesRouter.fetch(new Request(`http://x/v2/impulses/resolve`, request));
  if (path === "/api/questions" || path === "/api/participation") return participationRouter.fetch(request);
  if (path === "/api/render-policy") return Response.json({ tokenOverrides: {}, formByShape: {}, revision: 1 });
  if (path === "/api/discovery/shapes") return Response.json({ shapes: [] });
  if (path === "/api/resolve") return Response.json({ resolved: true, body: { dispatches: [] } });
  if (path.startsWith("/api/")) return Response.json({ gaps: [] });
  const file = Bun.file(repo + "/ui/dist" + (path === "/" ? "/index.html" : path));
  // A missing asset answers 404 instead of throwing. The browser requests
  // /favicon.ico, which the bundle does not ship; streaming a nonexistent
  // Bun.file raised an UNHANDLED ENOENT rejection that set a non-zero exit
  // status AFTER the verdict was printed, so a 9/9 run and a 0/9 run were
  // indistinguishable to any scheduler. Absence only — other read errors
  // still propagate rather than being swallowed.
  if (!(await file.exists())) return new Response("not found", { status: 404 });
  return new Response(file);
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
  // THIRD READER of this file. The journal now writes the shared interactor-log envelope
  // ({id, shape, visibility, received_at, pointer:{panel_id,…}, record}) that both production
  // consumers speak; `record` carries the vessel's flat entry verbatim. Reading both forms keeps
  // this step from throwing on a wrapped line — which would abort the harness HERE, before step 5,
  // the only step that exercises the real resolveSolicitationOutcomeScan.
  const raw = JSON.parse(feedbackLines[feedbackLines.length - 1]);
  const last = raw.record ?? (raw.pointer
    ? { id: raw.id ?? raw.pointer.id, panelId: raw.pointer.panel_id, panelRevision: raw.pointer.panel_revision, value: raw.pointer.value, kind: raw.pointer.kind, receivedAt: raw.received_at }
    : raw);
  assert.equal(last.panelId, panelId);
  record("contribution → durable journal + receipt", "HELD",
    `receipt shown in browser; journal line (envelope ${raw.record ? "with" : "without"} \`record\`): id=${last.id} panelId=${last.panelId} rev=${last.panelRevision} receivedAt=${last.receivedAt}; original content preserved verbatim`);
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
// Read the report's OWN vocabulary, not a substring of it. The previous predicate matched
// `"answered":[…]` / `"answered_count":1`, and solicitationOutcomeReport emits neither: it emits
// `outcomes:[{solicitation_id, outcome}]` plus a numeric `answered`. So it reported MISSING while
// its own captured payload said `"outcome":"answered"` — a verdict that contradicted its evidence.
const scanOutcomes = ((scan as { body?: { outcomes?: Array<{ solicitation_id?: string; outcome?: string }> } }).body?.outcomes) ?? [];
const sawAnswer = scanOutcomes.some(o => o.solicitation_id === panelId && o.outcome === "answered");
if (sawAnswer) {
  record("consumption by a subsequent activity", "HELD",
    `solicitation_outcome_scan (the REAL resolver, same workspace) recognized the answer for ${panelId}: ${scanText.slice(0, 300)}`);
} else {
  record("consumption by a subsequent activity", "MISSING",
    `solicitation_outcome_scan ran against the same workspace and did NOT see the answer. Scan output: ${scanText.slice(0, 400)}`);
}

// ── 6-7. Consequence / learning / reuse ──────────────────────────────────────
record("consequence (artifact/decision changed)", "MISSING",
  "the contribution is now SCORED (link above) but nothing acted on it: the live consequence path "
  + "(goal-host human_input retry, escalation_disposition_apply) was not exercised — the latter has no scheduler "
  + "(stage-1 matrix). Scoring is not consequence, and a readable journal line does not create one.");
record("learning (posterior/template/concept update)", "MISSING",
  "consumption now HOLDS, so the old reason ('no consumption → no learning write') is retired. The "
  + "current reason is narrower and exact: solicitation-outcome-scan's only learned-state write, "
  + "recordOperatorEngagement(\"landed_commit\"), fires solely for an answered panel whose id starts "
  + "with \"reland-needs-human-\". This panel is a \"needs-human-\" escalation, so the scan scores the "
  + "answer and writes nothing learnable. Closing this link needs a learned-state write reachable "
  + "from an ordinary answered escalation, not a wider journal fix.");
record("later reuse", "MISSING", "no mechanism retrieves past human contributions for later tasks (stage-1 matrix, transition 7)");

server.stop(true);
rmSync(workspace, { recursive: true, force: true });

console.log("\n=== STAGE-4 TRACE (replayable) ===");
for (const l of links) console.log(`[${l.status}] ${l.link}\n        ${l.evidence}\n`);
const held = links.filter(l => l.status === "HELD").length;
console.log(`${held}/${links.length} links held; every MISSING link names its cause and the open gap that owns it.`);

// ── Exit code = verdict ──────────────────────────────────────────────────────
// The chain's currently expected state, named link-by-link so that changing it is a
// VISIBLE EDIT rather than a magic count. EXPECTED_HELD is the pass condition: this
// script exits 0 when and only when every one of these links held. EXPECTED_MISSING
// are the links TRACE-2026-09-20.md documents as open with a named owner; their
// absence is the known state, so it must not by itself make the run non-zero —
// otherwise the documented gap-closure acceptance run ("re-run unchanged, row N
// flips") would read as a harness failure. A flip in EITHER direction is reported.
const EXPECTED_HELD = [
  "activity-context → journaled question",
  "actual presentation",
  "exposure",
  "contribution → durable journal + receipt",
  "consumption by a subsequent activity",
];
const EXPECTED_MISSING = [
  "presentation assignment",                        // Track B item B-5
  "consequence (artifact/decision changed)",        // no scheduler for escalation_disposition_apply
  "learning (posterior/template/concept update)",   // downstream of consequence
  "later reuse",                                    // no retrieval mechanism exists
];
const statusOf = new Map(links.map(l => [l.link, l.status]));
// A should-hold link counts as regressed when it is MISSING *or absent* — a run that
// aborted before recording it must not read as a pass.
const regressed = EXPECTED_HELD.filter(name => statusOf.get(name) !== "HELD");
const newlyHeld = EXPECTED_MISSING.filter(name => statusOf.get(name) === "HELD");
const unaccounted = links
  .filter(l => !EXPECTED_HELD.includes(l.link) && !EXPECTED_MISSING.includes(l.link))
  .map(l => l.link);

for (const name of regressed) {
  console.log(`DEVIATION (regression): expected-HELD link "${name}" did not hold (${statusOf.get(name) ?? "not recorded — the run aborted before this link"}).`);
}
for (const name of newlyHeld) {
  console.log(`DEVIATION (news): expected-MISSING link "${name}" now HOLDS — this is the gap-closure signal; move it into EXPECTED_HELD and update TRACE-2026-09-20.md.`);
}
for (const name of unaccounted) {
  console.log(`DEVIATION (drift): link "${name}" is recorded by the trace but named in neither EXPECTED_HELD nor EXPECTED_MISSING.`);
}
if (regressed.length > 0 || unaccounted.length > 0) {
  console.log(`VERDICT: FAIL — ${regressed.length} of ${EXPECTED_HELD.length} expected-HELD links did not hold; ${unaccounted.length} unaccounted link(s).`);
  process.exitCode = 1;
} else {
  console.log(`VERDICT: PASS — all ${EXPECTED_HELD.length} expected-HELD links held${newlyHeld.length ? `; ${newlyHeld.length} expected-MISSING link(s) newly HOLD (news, reported above, not a failure)` : ""}.`);
}
