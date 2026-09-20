/**
 * THE LAST MILE: the browser's exposure record, through the real HTTP endpoint,
 * into the learner, out as a weight the ranker reads.
 *
 * Why this probe exists as well as test/importance-learn.test.ts. That suite
 * drives the in-process impulse router, which proves the learner and the corpus.
 * It cannot prove the piece the browser actually uses: `POST /api/observations`,
 * which self-posts the `interactorObservation` shape to this vessel's own
 * `/v2/impulses/resolve` over the loopback and therefore needs a listening
 * server. test/exposure-probe.ts STUBS that endpoint (it says so at :15), so
 * before this file nothing executed it — and an endpoint nothing invokes cannot
 * be trusted when it passes, because it has never been observed failing.
 *
 * The record posted here is built by the PRODUCER ITSELF —
 * `buildOutcomeRecord` / `buildExposureRecord` from ui/src/lib/exposure.ts — so
 * the probe cannot pass on a hand-written body whose field names happen to
 * match what the server reads. Producer/consumer divergence on a field name is
 * exactly the class this substrate has been bitten by.
 *
 * Nothing here touches the live substrate: a disposable WORKSPACE_ROOT, an
 * ephemeral port, its own journal.
 *
 * Run: bun validation/human-participation/exposure-endpoint-probe.ts
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const workspace = mkdtempSync(join(tmpdir(), "exposure-endpoint-probe-"));
process.env.WORKSPACE_ROOT = workspace;
// Set BEFORE the modules load: src/config.ts freezes PORT at import, and
// proxy.ts's self-post addresses `127.0.0.1:${PORT}`. An endpoint probe that
// let the vessel's default port stand would be talking to whatever else is
// listening there — the mis-addressed-negative trap.
const port = 30_000 + Math.floor(Math.random() * 20_000);
process.env.PORT = String(port);

const root = new URL("../../repos/human-surface-vessel/", import.meta.url).pathname;
const { Hono } = await import(root + "node_modules/hono/dist/index.js");
const { impulsesRouter } = await import(root + "src/routes/impulses.ts");
const { proxyRouter } = await import(root + "src/routes/proxy.ts");
const { buildExposureRecord, buildOutcomeRecord } = await import(root + "ui/src/lib/exposure.ts");
const { IMPORTANCE_LEARNER_ID } = await import(root + "src/importance-learn.ts");

// Mounted exactly as src/index.ts:74-76 mounts them.
const app = new Hono();
app.route("/", impulsesRouter);
app.route("/", proxyRouter);
const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: app.fetch });

const base = `http://127.0.0.1:${port}`;
const KIND = "gap_pending_verification";
const ANCHOR = 4;

async function resolve(pointer: Record<string, unknown>) {
  const res = await fetch(`${base}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pointer }),
  });
  return { status: res.status, json: (await res.json()) as any };
}

const weightOf = async (kind: string): Promise<number> =>
  (await resolve({ type: "renderPolicy" })).json.body.importanceWeights.byKind[kind];

try {
  // ── the fixture: two solicitations of one kind, and a human anchor ────────
  for (const id of ["ep-answered", "ep-witness"]) {
    const r = await resolve({
      type: "uiQuestion_write",
      id,
      title: `Escalation ${id}`,
      kind: KIND,
      body: { context: "endpoint probe" },
      asks: [{ id: `${id}-a1`, prompt: "Retire, repair, or observe longer?" }],
    });
    assert.equal(r.status, 200, `fixture ${id} was not authored`);
  }
  const anchored = await resolve({
    type: "renderPolicy_write",
    importanceWeights: { byKind: { [KIND]: ANCHOR } },
    assignedBy: "operator:endpoint-probe",
    reason: "anchor for the endpoint probe",
  });
  assert.equal(anchored.status, 200);
  assert.equal(await weightOf(KIND), ANCHOR, "the anchor did not take");

  // ── an exposure TICK: a denominator, never an outcome ─────────────────────
  const conditions = {
    rendererBundle: "index-probe.js",
    viewport: { width: 1440, height: 900 },
    presentationVariant: "onepage" as const,
  };
  const tick = buildExposureRecord({
    ...conditions,
    snapshotCount: 24,
    candidates: [
      {
        solicitationId: "ep-witness",
        rank: 1,
        rankSource: "ranker" as const,
        rankingExplanation: "a gap escalated to you after repeated failed repairs",
        elementRole: "list_row",
        domPosition: 1,
        rect: { x: 0, y: 0, width: 600, height: 60 },
        clips: [{ x: 0, y: 0, width: 1440, height: 900 }],
      },
    ],
    visible: [
      {
        solicitation_id: "ep-witness",
        rank: 1,
        rank_source: "ranker" as const,
        ranking_explanation: "a gap escalated to you after repeated failed repairs",
        ranking_explanation_observed: true,
        element_role: "list_row",
        dom_position: 1,
        visible_fraction: 1,
      },
      // ep-answered has to be WITNESSED here, because it is the panel the
      // outcome below is about. The learner refuses an outcome for a panel no
      // tick ever showed — it checks this measured slice rather than the
      // producer's own exposure_count, since a channel's own reporting is not
      // evidence about the channel.
      {
        solicitation_id: "ep-answered",
        rank: 2,
        rank_source: "ranker" as const,
        ranking_explanation: "a repair is waiting for someone to confirm it worked",
        ranking_explanation_observed: true,
        element_role: "list_row",
        dom_position: 2,
        visible_fraction: 1,
      },
    ],
    tickSeq: 1,
    measuredSelector: "[data-solicitation-id]",
  });
  const beforeTick = await weightOf(KIND);
  const tickPost = await fetch(`${base}/api/observations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tick),
  });
  assert.equal(tickPost.status, 200, "the exposure tick was not accepted by /api/observations");
  const tickBody = (await tickPost.json()) as any;
  assert.equal(tickBody.body.type, "exposure", "the tick was stored as something other than an exposure");
  assert.equal(
    tickBody.body.body.not_in_visible_slice_count,
    0,
    "the honest denominators were dropped instead of persisted",
  );
  assert.equal(tickBody.learning, undefined, "an exposure tick triggered a learning pass");
  assert.equal(
    await weightOf(KIND),
    beforeTick,
    "23 solicitations were withheld from the viewport and a weight moved for it — never-shown was scored",
  );

  // ── an ANSWERED outcome, built by the producer, through the real endpoint ──
  const outcome = buildOutcomeRecord(
    {
      solicitationId: "ep-answered",
      outcome: "answered" as const,
      scope: "panel" as const,
      askId: null,
      exposureCount: 2,
    },
    conditions,
  );
  const outcomePost = await fetch(`${base}/api/observations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(outcome),
  });
  assert.equal(outcomePost.status, 200, "the outcome record was not accepted by /api/observations");
  const outcomeBody = (await outcomePost.json()) as any;
  assert.equal(outcomeBody.body.outcome, "answered");
  assert.equal(
    outcomeBody.body.panelKind,
    KIND,
    "the kind was not resolved from the panel store at write time — the learner would have skipped this record",
  );
  assert.ok(outcomeBody.learning, "the learner was not triggered by an outcome posted from the browser's endpoint");
  assert.equal(outcomeBody.learning.changed, true, "the learning pass moved no weight");

  const after = await weightOf(KIND);
  assert.ok(after > ANCHOR, `the answered kind did not rise: ${ANCHOR} -> ${after}`);
  assert.ok(
    after <= 2 * ANCHOR,
    `the update breached its documented ceiling of 2 x base: ${ANCHOR} -> ${after}`,
  );

  const policy = (await resolve({ type: "renderPolicy" })).json.body;
  assert.equal(policy.assignedBy, IMPORTANCE_LEARNER_ID, "the learned revision is not attributed to the learner");
  assert.match(String(policy.reason), /1 answered/, "the learned revision does not cite its evidence");

  // ── the corpus is on disk, and the ranker reads the new weight ────────────
  const journal = join(workspace, "interactor-log", "interactorObservation_write.jsonl");
  assert.ok(existsSync(journal), "the exposure corpus was not journaled");
  const lines = readFileSync(journal, "utf8").split("\n").filter((l) => l.trim());
  assert.equal(lines.length, 2, `expected the tick and the outcome on disk, found ${lines.length}`);

  const ranked = await resolve({ type: "uiQuestion", visible_slice_size: null });
  assert.equal(ranked.json.body.ranking.weights.byKind[KIND], after,
    "the ranked read is not using the weight the learner just wrote");
  assert.ok(
    ranked.json.body.questions.some((q: any) => q.id === "ep-witness"),
    "the witness solicitation is not in the ranked read",
  );

  console.log(
    `PASS exposure endpoint: /api/observations accepted a producer-built tick (no weight moved) ` +
      `and a producer-built answered outcome; ${KIND} ${ANCHOR} -> ${after} attributed to ` +
      `${IMPORTANCE_LEARNER_ID}; 2 records on disk; the ranked read serves the learned weight`,
  );
} finally {
  await server.stop(true);
  rmSync(workspace, { recursive: true, force: true });
}
