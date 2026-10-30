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
// a namespace import, so a describer without these exports still loads and each case below reports on its own
import * as describer from "../../scripts/substrate/auto-describe-resolvers.ts";
const DESCRIBER_VERSION: number = (describer as Record<string, any>).DESCRIBER_VERSION;
const SWEEP_PER_RUN: number = (describer as Record<string, any>).SWEEP_PER_RUN;

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
// A dispatch producer that is the only producer of its shape, and one whose producer publishes a resolver_schema
// (fixture words from a 5-word draw, 2026-10-29T20:01:10Z: buzz plunder perennial shining swept).
const DISPATCHER = { vesselId: "plunder-vessel", shapes: ["perennial_shining_dispatch", "buzz_swept_dispatch"] };
const SCHEMAS: Record<string, unknown> = {
  buzz_swept_dispatch: { shape: "buzz_swept_dispatch", known: true, fields: [{ name: "question", required: true, type: "string" }, { name: "context", required: false, type: "string" }], response_fields: ["answer"] },
};
// A store read and its write on one vessel, beside described shapes of the same vessel (fixture words from a 5-word
// draw, 2026-10-30T04:04:00Z: sprung headscarf reviving doorknob fantasize).
const KEEPER = { vesselId: "doorknob-vessel", shapes: ["headscarfLedger", "headscarfLedger_write", "sprung_reviving_digest", "reviving_doorknob_report", "doorknob_sprung_status"] };
const VESSELS = [SURFACE, REPORTS, DISPATCHER, KEEPER];
// advertised in the shape list, but no live vessel row serves them (a retired producer's leftovers)
const UNSERVED = ["orphanLedger_write", "orphan_digest"];
const SEEDED: Record<string, string> = {
  "human_surface:ui_view": "produces a user interface view for human interaction; use for goals related to displaying user-centric data visually.",
  uiQuestion: "produces the open questions the surface is asking a human; use for goals that read what is awaiting an answer.",
  uiFeedback: "produces feedback a human left on the surface; use for goals that read operator feedback.",
  renderPolicy: "produces the surface's render policy; use for goals that read how content is drawn.",
  unaccounted_commit_scan: "produces a scan of commits no record accounts for; use for goals that audit commits.",
  headscarfLedger_write: "writes the headscarf ledger kept by the doorknob vessel (doorknob-vessel)",
  sprung_reviving_digest: "produces a digest of sprung latches reviving overnight; use for goals that fantasize about doorknob repairs",
  // a row an older describer wrote from its siblings: it carries another shape's use clause
  reviving_doorknob_report: "produces the reviving doorknob report; use for goals that fantasize about headscarf colours",
  doorknob_sprung_status: "produces the sprung status of each doorknob; use for goals that check doorknobs",
};

let server: ReturnType<typeof Bun.serve>;
let EP = "";
let descriptions: Record<string, string> = {};
let posts: Array<{ shape: string; description: string; source: string }> = [];
let failDescRead = false;
/** The prompts the fake LLM resolver received: what evidence the describer sent for each shape. */
let prompts: string[] = [];
const reset = () => { descriptions = { ...SEEDED }; posts = []; failDescRead = false; prompts = []; };

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
        if (b.pointer?.type === "resolver_schema") {
          const c = SCHEMAS[b.pointer.shape ?? ""];
          return json({ success: true, shape: "resolver_schema", body: c ?? { shape: b.pointer.shape, known: false } });
        }
        prompts.push(String(b.prompt ?? ""));
        // the LLM resolver: a templated line that echoes the shape id and the format's verb (never a hand-written description)
        const shape = /Shape id: (\S+)/.exec(b.prompt ?? "")?.[1] ?? "?";
        const verb = /Format strictly as: "(\w+) /.exec(b.prompt ?? "")?.[1] ?? "produces";
        return json({ resolved: true, content: `${verb} ${shape} records; use for goals that read ${shape}` });
      }
      const m = /^\/vessels\/(.+)$/.exec(u.pathname);
      if (m) {
        const v = VESSELS.find((x) => x.vesselId === decodeURIComponent(m[1]));
        return v ? json({ vesselId: v.vesselId, shapes: v.shapes }) : json({ error: "Vessel not found" }, 404);
      }
      // a template that DECLARES every shape as its output: the internal use site the describer must not describe by
      if (u.pathname === "/sql") {
        const q = await req.text();
        return json([{ result: /FROM activity/.test(q) ? [{ name: "swept-shining-template", description: "an internal template that declares this output" }] : [] }]);
      }
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

describe("a shape is described from its producer's own contract, dispatch producers included (recall can find the answer producer)", () => {
  const promptFor = (shape: string) => prompts.find((p) => p.includes(`Shape id: ${shape}\n`)) ?? "";

  it("[MUST-FAIL] a dispatch-named shape a live vessel serves, with no other producer, is described, recallable, and its evidence names its producer, not a template", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    expect(typeof descriptions.perennial_shining_dispatch).toBe("string");
    expect(recallUniverse()).toContain("perennial_shining_dispatch");
    const p = promptFor("perennial_shining_dispatch");
    expect(p).toContain("produced by vessel plunder-vessel");
    expect(p).not.toContain("swept-shining-template");
  });

  it("[MUST-FAIL] when the producer publishes a resolver_schema, the evidence is that contract (what it takes and answers)", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    const p = promptFor("buzz_swept_dispatch");
    expect(p).toContain("contract (resolver_schema): takes question*, context; answers answer");
    expect(p).not.toContain("swept-shining-template");
  });

  it("[CONTROL] no shape is described twice, and store writes are still derived without the LLM", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    const shapes = posts.map((x) => x.shape);
    expect(shapes.length).toBeGreaterThan(0);
    expect(new Set(shapes).size).toBe(shapes.length);
    for (const w of ["renderPolicy_write", "uiPanel_write", "uiView_write"]) {
      expect(shapes).toContain(w);
      expect(promptFor(w)).toBe("");
    }
  });
});

describe("a shape is described from its OWN evidence, never its vessel's other shapes (a store read reads as a read)", () => {
  const promptFor = (shape: string) => prompts.find((p) => p.includes(`Shape id: ${shape}\n`)) ?? "";
  const siblingsOf = (vessel: { shapes: string[] }, shape: string) => vessel.shapes.filter((s) => s !== shape && SEEDED[s]);

  it("[MUST-FAIL] a store read (its vessel serves its write) is described as what it reads, with no other shape's text in its evidence", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    const p = promptFor("headscarfLedger");
    expect(p).toContain('Format strictly as: "reads <what>; use for <which goals>"');
    expect(p).toContain("produced by vessel doorknob-vessel");
    expect(p).toContain("a store read: the producer also serves its write headscarfLedger_write");
    for (const s of siblingsOf(KEEPER, "headscarfLedger").filter((x) => x !== "headscarfLedger_write")) {
      expect([s, p.includes(s)]).toEqual([s, false]);
      expect([s, p.includes(SEEDED[s].split(";")[0])]).toEqual([s, false]);
    }
    expect(p).not.toContain("fantasize");
    expect(descriptions.headscarfLedger).toBe("reads headscarfLedger records; use for goals that read headscarfLedger");
  });

  it("[CONTROL] a no-contract shape that is not a store read still says \"produces\"", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    const p = promptFor("fleet_summary");
    expect(p).toContain('Format strictly as: "produces <what>; use for <which goals>"');
    expect(p).not.toContain("a store read:");
    expect(descriptions.fleet_summary).toBe("produces fleet_summary records; use for goals that read fleet_summary");
  });

  it("[MUST-FAIL] the same no-contract shape's evidence holds none of its vessel's other shapes", async () => {
    reset();
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    const p = promptFor("fleet_summary");
    expect(p).toContain("produced by vessel report-vessel");
    expect(siblingsOf(REPORTS, "fleet_summary").length).toBeGreaterThan(0);
    for (const s of siblingsOf(REPORTS, "fleet_summary")) {
      expect([s, p.includes(s)]).toEqual([s, false]);
      expect([s, p.includes(SEEDED[s].split(";")[0])]).toEqual([s, false]);
    }
  });
});

describe("a describer fix re-derives the rows an older describer version wrote (self-heal, capped, its own rows only)", () => {
  const OLD_RUN = "2026-10-29T22:07:42.121Z";
  const entry = (shape: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ ts: OLD_RUN, event: "describe", run: OLD_RUN, shape, description: SEEDED[shape], applied: true, ...extra });
  const seededDir = (lines: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "adr-"));
    writeFileSync(join(dir, "auto-describe.jsonl"), lines.join("\n") + "\n");
    return dir;
  };
  const sweptPosts = () => posts.filter((p) => p.shape in SEEDED).map((p) => p.shape);
  const promptFor = (shape: string) => prompts.find((p) => p.includes(`Shape id: ${shape}\n`)) ?? "";

  it("[MUST-FAIL] an unversioned row this describer wrote, still served as written, is re-derived on the next run from own evidence", async () => {
    reset();
    await tick(seededDir([entry("reviving_doorknob_report", { evidence_chars: 387 })]));
    expect(sweptPosts()).toEqual(["reviving_doorknob_report"]);
    expect(descriptions.reviving_doorknob_report).toBe("produces reviving_doorknob_report records; use for goals that read reviving_doorknob_report");
    expect(promptFor("reviving_doorknob_report")).not.toContain("fantasize");
    expect(posts.find((p) => p.shape === "reviving_doorknob_report")!.source).toMatch(/^auto-describe-resolvers@\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  });

  it("[MUST-FAIL] a re-derivation identical to the served text posts nothing, is logged unchanged, and is not re-derived again", async () => {
    reset();
    // derive the write's current line once, then serve exactly that line as an older describer's row
    await tick(mkdtempSync(join(tmpdir(), "adr-")));
    const same = descriptions.uiView_write;
    expect(typeof same).toBe("string");
    reset();
    descriptions.uiView_write = same;
    const dir = seededDir([JSON.stringify({ ts: OLD_RUN, event: "describe", run: OLD_RUN, shape: "uiView_write", description: same, applied: true, derived_from: "advertisement" })]);
    await tick(dir);
    expect(posts.some((p) => p.shape === "uiView_write")).toBe(false);
    const lines = readFileSync(join(dir, "auto-describe.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const u = lines.find((l) => l.event === "resweep" && l.shape === "uiView_write");
    expect(u && { outcome: u.outcome, before: u.before, after: u.after, v: u.describer_version }).toEqual({ outcome: "unchanged", before: same, after: same, v: DESCRIBER_VERSION });
    const n = lines.length;
    await tick(dir);
    const again = readFileSync(join(dir, "auto-describe.jsonl"), "utf8").trim().split("\n").slice(n).map((l) => JSON.parse(l));
    expect(again.some((l) => l.shape === "uiView_write" && (l.event === "resweep" || l.resweep === true))).toBe(false);
  });

  it("[MUST-FAIL] each re-derived row's log line carries its before and after text", async () => {
    reset();
    const dir = seededDir([entry("reviving_doorknob_report", { evidence_chars: 387 })]);
    await tick(dir);
    const lines = readFileSync(join(dir, "auto-describe.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const r = lines.find((l) => l.event === "describe" && l.shape === "reviving_doorknob_report" && l.resweep === true);
    expect(r && { before: r.before, after: r.after, applied: r.applied }).toEqual({
      before: SEEDED.reviving_doorknob_report, after: descriptions.reviving_doorknob_report, applied: true });
    expect(r.after).not.toBe(r.before);
  });

  it("[CONTROL] a current-version row, a row served with other text, a pre-provenance row and an unlogged row are not touched", async () => {
    reset();
    const dir = seededDir([
      entry("doorknob_sprung_status", { describer_version: DESCRIBER_VERSION }), // current version
      JSON.stringify({ ts: OLD_RUN, event: "describe", run: OLD_RUN, shape: "sprung_reviving_digest", description: "an older line discovery no longer serves", applied: true }), // another writer or an advertisement owns it now
      JSON.stringify({ ts: "2026-06-28T09:54:07.057Z", event: "describe", shape: "uiFeedback", description: SEEDED.uiFeedback, applied: true, evidence_chars: 120 }), // pre-provenance (source "auto")
      entry("uiQuestion", { applied: false }), // a post that never applied
    ]);
    await tick(dir);
    expect(posts.length).toBeGreaterThan(0); // the run described its gap, so the silence below is the sweep's choice
    expect(sweptPosts()).toEqual([]);
    for (const s of Object.keys(SEEDED)) expect([s, descriptions[s]]).toEqual([s, SEEDED[s]]);
  });

  it("[MUST-FAIL] at most SWEEP_PER_RUN rows per run, non-writes before writes, and the sweep converges (a healed row is not re-derived)", async () => {
    reset();
    const old = Object.keys(SEEDED).sort();
    const dir = seededDir(old.map((s) => entry(s)));
    const reads = old.filter((s) => !/_write$/.test(s));
    await tick(dir);
    expect(SWEEP_PER_RUN).toBeGreaterThan(0);
    expect(sweptPosts()).toEqual(reads.slice(0, SWEEP_PER_RUN));
    posts = [];
    await tick(dir);
    expect(sweptPosts()).toEqual([...reads.slice(SWEEP_PER_RUN), ...old.filter((s) => /_write$/.test(s))].slice(0, SWEEP_PER_RUN));
    // the healed write is re-derived, without the LLM, from its advertisement
    expect(promptFor("headscarfLedger_write")).toBe("");
    expect(descriptions.headscarfLedger_write).toStartWith("writes the headscarf ledger kept by the doorknob vessel (doorknob-vessel)");
    posts = [];
    await tick(dir);
    await tick(dir);
    expect(sweptPosts()).toEqual([]);
  });

});
