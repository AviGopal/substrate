// auto-describe-served-writes.test.ts: the describer describes every advertised, undescribed served store write.
//
// THE CLASS. goal-host recalls its target candidates from concept-db's shape index, which holds one shape_description
// per shape discovery describes (/registry/shape-descriptions), intersected with the advertised shapes. A shape with
// no description is not in that index, so no goal can ever recall it. auto-describe-resolvers fills descriptions for
// advertised-but-undescribed shapes, but it skipped every *_write outright, so each tick logged "no undescribed data
// shapes" while every served store write stayed undescribed, and a goal asking to CHANGE what a surface keeps could
// only be read as a report.
//
// SEAM. The script's real main() runs in a child bun against a fake discovery, LLM resolver and SurrealDB on loopback
// (nothing live is reachable). The fixture registry is the human surface's advertised vocabulary plus a report vessel.
// What the describer POSTs is folded into the fake's descriptions, and the check is the recall UNIVERSE goal-host
// ranks over: described ∩ advertised (shape-recall.ts recalledCandidates keeps only advertised rows of the index, and
// the index holds only described shapes). NOT covered: concept-db's ranking (lexical + dense over the description
// embeddings), so whether the write lands in the top k for a given goal is not judged here, nor goal-host's chooser.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const SCRIPT = join(ROOT, "scripts/substrate/auto-describe-resolvers.ts");

// Layout imperatives and a report on the same surface, each written from one 5-word draw (draw-words.sh,
// 2026-10-26T19:39:37Z): seed 1793043577098361488 "reappear enviable perceive outsmart duty"; seed 1793043577110468524
// "struck return struggle playset duct"; seed 1793043577120125993 "header reversal saddled crazily suds".
const LAYOUT_GOALS = [
  "Make the duty roster reappear at the top of my home screen so I perceive it before anything else.",
  "Move the struggle board below the return panel on my start screen.",
];
const REPORT_GOAL = "Show me what the header of my start screen says right now, without reversing anything.";

const SURFACE = {
  vesselId: "human-surface-vessel",
  shapes: ["uiPanel_write", "uiQuestion", "uiFeedback", "human_surface:ui_view", "renderPolicy", "renderPolicy_write", "uiView_write"],
};
const REPORTS = { vesselId: "report-vessel", shapes: ["unaccounted_commit_scan", "fleet_summary", "coverage_tick", "composedDeliverable_what_day_is_it_today"] };
const VESSELS = [SURFACE, REPORTS];
// advertised in the shape list, but no live vessel row serves them (a retired producer's leftovers)
const UNSERVED = ["orphanLedger_write", "orphan_digest"];
const SEEDED: Record<string, string> = {
  "human_surface:ui_view": "produces a user interface view for human interaction; use for goals related to displaying user-centric data visually.",
  uiQuestion: "produces the open questions the surface is asking a human; use for goals that read what is awaiting an answer.",
  uiFeedback: "produces feedback a human left on the surface; use for goals that read operator feedback.",
  renderPolicy: "produces the surface's render policy; use for goals that read how content is drawn.",
  unaccounted_commit_scan: "produces a scan of commits no record accounts for; use for goals that audit commits.",
};

let server: ReturnType<typeof Bun.serve>;
let EP = "";
let descriptions: Record<string, string> = {};
let posts: Array<{ shape: string; description: string; source: string }> = [];
let failDescRead = false;
const reset = () => { descriptions = { ...SEEDED }; posts = []; failDescRead = false; };

beforeAll(() => {
  reset();
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/registry/shapes") return json({ shapes: [...new Set([...VESSELS.flatMap((v) => v.shapes), ...UNSERVED])] });
      if (u.pathname === "/registry/shape-descriptions" && req.method === "GET")
        return failDescRead ? new Response("unavailable", { status: 500 }) : json({ shape_descriptions: descriptions });
      if (u.pathname === "/registry/shape-descriptions" && req.method === "POST") {
        const b = (await req.json()) as { shape: string; description: string; source: string };
        posts.push(b);
        descriptions[b.shape] = b.description;
        return json({ success: true }, 201);
      }
      if (u.pathname === "/resolve") {
        const b = (await req.json()) as { pointer?: { type?: string; shape?: string }; type?: string; prompt?: string };
        if (b.pointer?.type === "vesselCapability") {
          const vessels = VESSELS.filter((v) => v.shapes.includes(b.pointer!.shape!)).map((v) => ({ vesselId: v.vesselId, vesselName: v.vesselId, protocol: "http" }));
          return json({ content: { shape: b.pointer.shape, vessels } });
        }
        // the LLM resolver: a templated line that echoes the shape id (never a hand-written description)
        const shape = /Shape id: (\S+)/.exec(b.prompt ?? "")?.[1] ?? "?";
        return json({ resolved: true, content: `produces ${shape} records; use for goals that read ${shape}` });
      }
      const m = /^\/vessels\/(.+)$/.exec(u.pathname);
      if (m) {
        const v = VESSELS.find((x) => x.vesselId === decodeURIComponent(m[1]));
        return v ? json({ vesselId: v.vesselId, shapes: v.shapes }) : json({ error: "Vessel not found" }, 404);
      }
      if (u.pathname === "/sql") return json([{ result: [] }]);
      return json({ error: "not found" }, 404);
    },
  });
  EP = `http://127.0.0.1:${server.port}`;
});
afterAll(() => server?.stop(true));

/** One timer run of the script, in a child bun (its endpoints are read from env at import), logging into `dir`. */
async function tick(dir: string) {
  const drive = join(dir, "drive.ts");
  writeFileSync(drive, `const m = await import(${JSON.stringify(SCRIPT)}); await m.main(${JSON.stringify(dir)});\n`);
  const p = Bun.spawn([process.execPath, drive], {
    env: {
      PATH: process.env.PATH ?? "", HOME: dir, AUTO_DESCRIBE_RESOLVERS: "1", METABOB_API_KEY: "placeholder-not-a-key",
      DISCOVERY_VESSEL_ENDPOINT: EP, LLM_VESSEL_ENDPOINT: EP, SURREALDB_URL: EP, SURREAL_PASS: "placeholder",
    },
    stdout: "pipe", stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  // a tick that did not run proves nothing either way: every case below needs a real run
  if (code !== 0) throw new Error(`the tick exited ${code}: ${err.trim().split("\n").slice(-3).join(" | ")}`);
  return { out, err, code };
}
/** goal-host's recall universe: the index (described shapes) intersected with the advertised vocabulary. */
const recallUniverse = () => {
  const advertised = new Set(VESSELS.flatMap((v) => v.shapes));
  return Object.keys(descriptions).filter((s) => advertised.has(s));
};

describe("an advertised, undescribed served store write is described (the recall universe then holds it)", () => {
  it("MF: layout goals can now recall uiView_write: it is described, from its advertisement", async () => {
    reset();
    const dir = mkdtempSync(join(tmpdir(), "adr-"));
    const r = await tick(dir);
    expect(r.code).toBe(0);
    for (const goal of LAYOUT_GOALS) expect([goal, recallUniverse().includes("uiView_write")]).toEqual([goal, true]);
    const d = descriptions.uiView_write;
    // object + effect, derived: the object words from the id, the effect, the keeper, and its described reader
    expect(d).toContain("writes the ui view kept by the human surface vessel (human-surface-vessel)");
    expect(d).toContain("read back as human_surface:ui_view (produces a user interface view");
  });

  it("every advertised undescribed write is described, before any LLM-described shape; internal machinery is not", async () => {
    reset();
    const dir = mkdtempSync(join(tmpdir(), "adr-"));
    await tick(dir);
    const order = posts.map((p) => p.shape);
    expect(order.slice(0, 3)).toEqual(["renderPolicy_write", "uiPanel_write", "uiView_write"]);
    expect(order).toContain("fleet_summary");
    expect(order).not.toContain("coverage_tick");
    expect(descriptions.fleet_summary).toBe("produces fleet_summary records; use for goals that read fleet_summary");
  });

  it("provenance: each post names the tick and its run, and the log line carries the same run", async () => {
    reset();
    const dir = mkdtempSync(join(tmpdir(), "adr-"));
    await tick(dir);
    const p = posts.find((x) => x.shape === "uiView_write")!;
    expect(p.source).toMatch(/^auto-describe-resolvers@\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    const run = p.source.slice("auto-describe-resolvers@".length);
    const lines = readFileSync(join(dir, "auto-describe.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.some((l) => l.event === "describe" && l.shape === "uiView_write" && l.run === run && l.applied === true)).toBe(true);
  });

  it("CONTROL: an already-described shape is never re-posted, and a second tick posts nothing (no churn)", async () => {
    reset();
    const dir = mkdtempSync(join(tmpdir(), "adr-"));
    await tick(dir);
    expect(posts.length).toBeGreaterThan(0); // the tick described something, so its silence below is a choice
    for (const s of Object.keys(SEEDED)) {
      expect(posts.some((p) => p.shape === s)).toBe(false);
      expect(descriptions[s]).toBe(SEEDED[s]);
    }
    const first = posts.length;
    await tick(dir);
    expect(posts.length).toBe(first);
  });

  it("the same advertisement derives the same line (a restart re-describes identically)", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    const once = descriptions.uiView_write;
    expect(typeof once).toBe("string");
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    expect(descriptions.uiView_write).toBe(once);
  });

  it("CONTROL: the report goal's universe still holds the report shapes, and their descriptions are untouched", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    expect([REPORT_GOAL, recallUniverse().includes("unaccounted_commit_scan")]).toEqual([REPORT_GOAL, true]);
    expect(descriptions.unaccounted_commit_scan).toBe(SEEDED.unaccounted_commit_scan);
  });

  it("CONTROL: a walk-minted composite and a shape no live vessel serves get no description", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    expect(posts.length).toBeGreaterThan(0);
    for (const s of ["composedDeliverable_what_day_is_it_today", ...UNSERVED]) expect([s, s in descriptions]).toEqual([s, false]);
  });

  it("unreadable descriptions describe nothing (every shape would otherwise look undescribed)", async () => {
    reset();
    failDescRead = true; // the description read answers 500; everything else is the fake above
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    expect(posts.length).toBe(0);
    expect(descriptions).toEqual(SEEDED);
  });
});
