// scripts/substrate/composition-edge-reconcile.ts — the full pass's liveness guard, its
// resume cursor, and sql()'s timeout.
//
// Two kinds of case:
//   - "unit run" cases run the script exactly as composition-edge-reconcile.service does
//     (`bun <script>`, top level), with validation/scripts/composition-edge-reconcile.fake-db.ts
//     preloaded in place of fetch. They need nothing from the module's exports, so they
//     judge any version of the script, old or new.
//   - "module" cases import the module and drive its exported functions with an injected
//     fake fetch / sql.
// No case reaches a real service: every URL resolves to the fake or to 127.0.0.1:9, and
// any request that is not the fake's /sql is refused and recorded.
import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { makeFakeDb, type Fixture, type ViewRow, type ContentRow } from "./composition-edge-reconcile.fake-db.ts";

const SUPER = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(SUPER, "scripts", "substrate", "composition-edge-reconcile.ts");
const FAKE = join(import.meta.dir, "composition-edge-reconcile.fake-db.ts");
const DEAD = "http://127.0.0.1:9";
const VR = (n: string) => `v_paradigm_execution_traces:${n}`;
const OLD = "2026-09-01T00:00:00.000Z";

// ---- the edge fixture ---------------------------------------------------------------------
// e1 A ──parent──▶ e2 B (B consumes A's s1)   e1 ──parent──▶ e3 slot-binding (failed)
// e2 B ──parent──▶ e4 C (no shared shape)    e7 A ──parent──▶ e6 A (self loop)
// e5 C's parent is not in the view (orphan). e1's content: t2 (C) and t3 (owner A) consume t1 (B).
function exec(id: string, eid: string, act: string, o: Partial<ViewRow> = {}): ViewRow {
  return { id, execution_id: eid, activity_id: act, composition_chain: [], input_impulse_shapes: [], output_impulse_shapes: [], success: true, executed_at: OLD, ...o };
}
const E = {
  e1: (id: string) => exec(id, "e1", "A", { output_impulse_shapes: ["s1"] }),
  e2: (id: string) => exec(id, "e2", "B", { parent_execution_id: "e1", input_impulse_shapes: ["s1"], output_impulse_shapes: ["s2"] }),
  e3: (id: string) => exec(id, "e3", "slot-binding", { parent_execution_id: "e1", success: false }),
  e4: (id: string) => exec(id, "e4", "C", { parent_execution_id: "e2", input_impulse_shapes: ["s9"] }),
  e5: (id: string) => exec(id, "e5", "C", { parent_execution_id: "e-not-in-view" }),
  e6: (id: string) => exec(id, "e6", "A", { parent_execution_id: "e7" }),
  e7: (id: string) => exec(id, "e7", "A"),
};
const CONTENT: ContentRow[] = [{
  id: "execution_trace_content:c1", execution_id: "e1",
  tasks: [
    { task_id: "t1", child_activity_id: "B" },
    { task_id: "t2", consumed_from_task_ids: ["t1"], child_activity_id: "C", status: "success" },
    { task_id: "t3", consumed_from_task_ids: ["t1"], status: "failure" },
  ],
}];
// The absolute edge set a complete full pass derives from that history.
const EXPECTED: Record<string, { count: number; success: number; kind: string }> = {
  "A B": { count: 2, success: 2, kind: "genuine" },
  "A slot-binding": { count: 1, success: 0, kind: "hub" },
  "B C": { count: 2, success: 2, kind: "genuine" },
  "B A": { count: 1, success: 0, kind: "genuine" },
};
// Page layout for page size 3: [e2 e1 e3] [e4 e6 e5] [e7] — children ahead of their parents.
const SMALL_VIEW = (): ViewRow[] => [E.e2(VR("r01")), E.e1(VR("r02")), E.e3(VR("r03")), E.e4(VR("r04")), E.e6(VR("r05")), E.e5(VR("r06")), E.e7(VR("r07"))];

function edgesOf(graph: Record<string, any>) {
  const out: Record<string, { count: number; success: number; kind: string }> = {};
  for (const g of Object.values(graph)) out[g.parent_activity_id + " " + g.child_activity_id] = { count: g.execution_count, success: g.success_count, kind: g.edge_kind };
  return out;
}

// ---- unit-run harness -----------------------------------------------------------------------
type Logged = { url: string; body: string };
function unitRun(dir: string, fx: Fixture, env: Record<string, string> = {}) {
  const fxFile = join(dir, "fixture.json");
  writeFileSync(fxFile, JSON.stringify(fx));
  const logFile = join(dir, `log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  const p = Bun.spawnSync([process.execPath, "--preload", FAKE, SCRIPT], {
    cwd: dir,
    env: {
      PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", TZ: "UTC",
      FAKE_EDGE_DB_FIXTURE: fxFile, FAKE_EDGE_DB_LOG: logFile, FAKE_EDGE_DB_DUMP: join(dir, "dump.json"),
      RECONCILE_FORCE: "1", SURREALDB_URL: DEAD, DISCOVERY_ENDPOINT: DEAD, DEV_VESSEL_ENDPOINT: DEAD, ...env,
    },
    stdout: "pipe", stderr: "pipe",
  });
  const log: Logged[] = existsSync(logFile) ? readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const dump = JSON.parse(readFileSync(join(dir, "dump.json"), "utf8"));
  const sqls = log.filter((l) => l.url.endsWith("/sql")).map((l) => l.body);
  return { code: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString(), log, sqls, dump };
}
const isPageQuery = (q: string) => /FROM v_paradigm_execution_traces\s+(WHERE id > \S+\s+)?LIMIT \d+;$/.test(q);
const isEdgeUpsert = (q: string) => q.startsWith("UPSERT activity_composition_graph:");
const ABORT_LINE = /^\[edge-reconcile\] ABORT full pass: view holds (\d+) of (\d+) executions \(ratio ([0-9.]+)\) — the view is not following writes$/m;

describe("composition-edge-reconcile (unit run, top level)", () => {
  it("MUST-FAIL 1: a frozen view (2 of 150,000 rows) aborts the full pass — no edge written, last_full_at not advanced", () => {
    const dir = mkdtempSync(join(tmpdir(), "edge-dead-"));
    const r = unitRun(dir, { view: [E.e1(VR("r01")), E.e2(VR("r02"))], execution_count: 150_000, state: null });
    expect(r.stderr).toMatch(ABORT_LINE);
    const m = ABORT_LINE.exec(r.stderr)!;
    expect([m[1], m[2]]).toEqual(["2", "150000"]);
    expect(r.sqls.filter(isEdgeUpsert)).toEqual([]);
    expect(r.sqls.filter((q) => q.startsWith("UPSERT reconcile_state"))).toEqual([]);
    expect(r.sqls.filter(isPageQuery)).toEqual([]);
    expect(r.dump.state).toBeNull();
    expect(r.code).not.toBe(0);
    // The gap is filed through development-vessel's substrateGap_write.
    const gap = r.log.find((l) => l.url.endsWith("/v2/impulses/resolve"));
    expect(gap).toBeDefined();
    const body = JSON.parse(gap!.body);
    expect(body.impulse.type).toBe("substrateGap_write");
    expect(body.impulse.gap.id).toBe("v-paradigm-execution-traces-not-following-writes");
    expect(body.impulse.gap.classification_metadata).toMatchObject({ view_count: 2, execution_count: 150_000 });
  }, 60_000);

  it("MUST-FAIL 2: a full pass that fails on page 3 resumes from page 3 on the next run and completes", () => {
    // Real page size (5000): 12,001 rows = pages [1..5000] [5001..10000] [10001..12001].
    const pad = (n: number) => VR("r" + String(n).padStart(6, "0"));
    const place: Record<number, (id: string) => ViewRow> = { 2: E.e1, 3: E.e3, 4: E.e5, 5001: E.e6, 7000: E.e4, 12000: E.e2, 12001: E.e7 };
    const view: ViewRow[] = [];
    for (let n = 1; n <= 12_001; n++) view.push(place[n] ? place[n](pad(n)) : exec(pad(n), `f${n}`, "filler"));
    const dir = mkdtempSync(join(tmpdir(), "edge-resume-"));
    const fx: Fixture = { view, content: CONTENT, state: null, fail_view_after_id: pad(10_000) };

    const r1 = unitRun(dir, fx);
    expect(r1.code).not.toBe(0);
    expect(r1.sqls.filter(isEdgeUpsert)).toEqual([]);
    expect(r1.dump.state?.last_full_at).toBeUndefined();
    expect(r1.dump.state?.full_cursor?.view_after).toBe(pad(10_000));

    const r2 = unitRun(dir, { ...fx, fail_view_after_id: undefined });
    expect(r2.code).toBe(0);
    const firstPage = r2.sqls.find(isPageQuery)!;
    expect(firstPage).toContain(`WHERE id > ${pad(10_000)} `);
    expect(r2.dump.state.last_full_at).toBeString();
    expect(r2.dump.state.full_cursor).toBeUndefined();
    expect(r2.dump.state.full_acc).toBeUndefined();
    // Exact across the resume: the same absolute counts an uninterrupted pass writes.
    expect(edgesOf(r2.dump.graph)).toEqual(EXPECTED);
  }, 120_000);

  it("CONTROL: a live view (149,000 of 150,000) runs the full pass and writes the absolute edge set", () => {
    const dir = mkdtempSync(join(tmpdir(), "edge-live-"));
    const stale = new Date(Date.now() - 8 * 86400_000).toISOString();
    const r = unitRun(dir, { view: SMALL_VIEW(), content: CONTENT, view_count: 149_000, execution_count: 150_000, state: { watermark: stale, recent_ids: [], last_full_at: stale } });
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(ABORT_LINE);
    expect(edgesOf(r.dump.graph)).toEqual(EXPECTED);
    expect(Date.parse(r.dump.state.last_full_at)).toBeGreaterThan(Date.now() - 600_000);
    expect(r.dump.state.full_cursor).toBeUndefined();
    const summary = JSON.parse(r.stdout.trim().split("\n").pop()!);
    expect(summary).toMatchObject({ mode: "full", children: 5, orphan: 1, selfLoop: 1, distinct_edges: 4, upserted: 4, batch_traces: 7 });
  }, 60_000);

  it("CONTROL: an incremental run adds its delta onto the existing edge, as before", () => {
    const dir = mkdtempSync(join(tmpdir(), "edge-incr-"));
    const now = Date.now();
    const recentAt = new Date(now - 5 * 60_000).toISOString();
    const view = SMALL_VIEW().map((r) => (r.execution_id === "e4" ? { ...r, executed_at: recentAt } : r));
    const rid = Bun.hash("B C").toString(16);
    const r = unitRun(dir, {
      view, content: CONTENT, execution_count: 1, // the guard is full-mode only: a dead ratio must not matter here
      state: { watermark: new Date(now - 30 * 60_000).toISOString(), recent_ids: [], last_full_at: new Date(now - 86400_000).toISOString() },
      graph: { [rid]: { parent_activity_id: "B", child_activity_id: "C", execution_count: 5, success_count: 4 } },
    });
    expect(r.code).toBe(0);
    expect(r.sqls.some((q) => q.includes("count() FROM execution"))).toBe(false);
    expect(r.sqls.filter(isEdgeUpsert).length).toBe(1);
    expect(edgesOf(r.dump.graph)).toEqual({ "B C": { count: 6, success: 5, kind: "genuine" } });
    expect(r.dump.state.recent_ids).toEqual(["e4"]);
    expect(Date.parse(r.dump.state.watermark)).toBeGreaterThan(now - 11 * 60_000);
    const summary = JSON.parse(r.stdout.trim().split("\n").pop()!);
    expect(summary).toMatchObject({ mode: "incremental", batch_traces: 1, children: 1, upserted: 1 });
  }, 60_000);
});

// ---- module cases ---------------------------------------------------------------------------
describe("composition-edge-reconcile (module)", () => {
  it("importing the module issues no request", async () => {
    Object.assign(process.env, { RECONCILE_FORCE: "1", SURREALDB_URL: DEAD, DISCOVERY_ENDPOINT: DEAD, DEV_VESSEL_ENDPOINT: DEAD });
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new Error("no request may be made on import"); }) as unknown as typeof fetch;
    try {
      const mod = await import(SCRIPT);
      expect(typeof mod.reconcile).toBe("function");
      expect(typeof mod.makeSql).toBe("function");
      expect(typeof mod.checkViewLiveness).toBe("function");
    } finally {
      globalThis.fetch = real;
    }
    expect(calls).toBe(0);
  }, 30_000);

  it("sql() aborts a query that never answers within its timeout", async () => {
    const { makeSql, SQL_TIMEOUT_MS } = await import(SCRIPT);
    expect(SQL_TIMEOUT_MS).toBeGreaterThan(0);
    let seenSignal = false;
    const never = ((_u: any, init: any) => new Promise<Response>((_res, rej) => {
      const s: AbortSignal | undefined = init?.signal;
      if (s) { seenSignal = true; s.addEventListener("abort", () => rej(s.reason)); }
    })) as unknown as typeof fetch;
    const sql = makeSql({ url: "http://fake/sql", fetchImpl: never, timeoutMs: 50, attempts: 1, backoffMs: 0 });
    const t0 = Date.now();
    let err: any;
    try { await sql("SELECT 1;"); } catch (e) { err = e; }
    expect(seenSignal).toBe(true);
    expect(err).toBeDefined();
    expect(String(err?.name ?? err)).toMatch(/Timeout|Abort/);
    expect(Date.now() - t0).toBeLessThan(2_000);
  });

  async function run(fake: ReturnType<typeof makeFakeDb>, pageSize: number, o: { now?: number } = {}) {
    const { reconcile, makeSql } = await import(SCRIPT);
    const lines: string[] = [];
    const gaps: any[] = [];
    const sql = makeSql({ url: "http://fake/sql", fetchImpl: fake.fetch, backoffMs: 1 });
    const res = await reconcile({ sql, pageSize, log: (s: string) => lines.push(s), out: (s: string) => lines.push(s), fileGap: async (g: any) => { gaps.push(g); }, forceFull: false, now: o.now ? () => o.now! : undefined });
    return { res, lines, gaps };
  }

  it("MUST-FAIL 1 (module): the dead-view guard files the gap and returns non-zero without writing", async () => {
    const fake = makeFakeDb({ view: [E.e1(VR("r01")), E.e2(VR("r02"))], execution_count: 150_000, state: null });
    const { res, lines, gaps } = await run(fake, 3);
    expect(res.exitCode).toBe(2);
    expect(lines.join("\n")).toMatch(ABORT_LINE);
    expect(gaps.map((g) => g.id)).toEqual(["v-paradigm-execution-traces-not-following-writes"]);
    expect(fake.queries.filter((q) => q.startsWith("UPSERT"))).toEqual([]);
    expect(fake.queries.filter(isPageQuery)).toEqual([]);
    expect(fake.queries.length).toBe(3); // state read + the two counts
  });

  it("the edge set does not depend on the page size (children on earlier pages than their parents)", async () => {
    const one = makeFakeDb({ view: SMALL_VIEW(), content: CONTENT, state: null });
    const three = makeFakeDb({ view: SMALL_VIEW(), content: CONTENT, state: null });
    await run(one, 1000);
    await run(three, 3);
    expect(edgesOf(one.db.graph)).toEqual(EXPECTED);
    expect(edgesOf(three.db.graph)).toEqual(EXPECTED);
  });

  it("MUST-FAIL 2 (module): page 3 fails every retry; the checkpoint holds page 2's last id; the next run resumes there, exactly", async () => {
    const fake = makeFakeDb({ view: SMALL_VIEW(), content: CONTENT, state: null, fail_view_after_id: VR("r06") });
    let threw: unknown;
    try { await run(fake, 3); } catch (e) { threw = e; }
    expect(threw).toBeDefined();
    expect(fake.db.state?.full_cursor?.view_after).toBe(VR("r06"));
    expect(fake.db.state?.last_full_at).toBeUndefined();
    expect(fake.queries.filter(isEdgeUpsert)).toEqual([]);

    fake.stopFailing();
    const before = fake.queries.length;
    const { res, lines } = await run(fake, 3);
    expect(res.exitCode).toBe(0);
    const second = fake.queries.slice(before);
    expect(second.find(isPageQuery)).toContain(`WHERE id > ${VR("r06")} `);
    expect(lines.join("\n")).toContain("RESUMING the pass started");
    expect(fake.db.state.last_full_at).toBeString();
    expect(fake.db.state.full_cursor).toBeUndefined();
    expect(edgesOf(fake.db.graph)).toEqual(EXPECTED); // B A needs e1's owner, fetched on resume
    expect(res.summary).toMatchObject({ resumed: true, children: 5, orphan: 1, selfLoop: 1, batch_traces: 7 });
  });

  it("a checkpoint older than FULL_RESUME_MAX_AGE_MS is discarded and the pass starts from page 1", async () => {
    const { FULL_RESUME_MAX_AGE_MS } = await import(SCRIPT);
    const now = Date.now();
    const fake = makeFakeDb({
      view: SMALL_VIEW(), content: CONTENT,
      state: {
        full_cursor: { started_at: new Date(now - FULL_RESUME_MAX_AGE_MS - 60_000).toISOString(), view_after: VR("r06"), view_done: false, content_after: "" },
        full_acc: { edges: [["A B", 99, 99]], provenance: [], recent: [], counters: { batch_traces: 6, children: 0, orphan: 0, selfLoop: 0, shape_flow_contributions: 0 } },
      },
    });
    const { res } = await run(fake, 3, { now });
    expect(res.summary.resumed).toBe(false);
    expect(fake.queries.find(isPageQuery)).not.toContain("WHERE id >");
    expect(edgesOf(fake.db.graph)).toEqual(EXPECTED);
  });
});
