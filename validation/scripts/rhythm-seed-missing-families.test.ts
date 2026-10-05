// The rhythm seeder must DELIVER a new family to a node whose registry is already populated.
// Before this, scripts/substrate/rhythm-seed-tick.ts returned "registry already holds N rhythm(s) — no
// action" whenever any rhythm existed, so a family added to its seed list never reached a live node
// (every live registry holds ~50). The seeder now inserts the rows MISSING BY ID and never overwrites
// an existing one. It is run as a process, as rhythm-cadence.service runs it, against a fake
// development-vessel resolve endpoint that holds the pool in memory.
import { afterEach, describe, expect, it } from "bun:test";
import { join, resolve } from "node:path";

const SUPER = resolve(import.meta.dir, "..", "..");
const SEEDER = join(SUPER, "scripts", "substrate", "rhythm-seed-tick.ts");

type Row = { id: string; shape: string; body: Record<string, unknown> };
let server: ReturnType<typeof Bun.serve> | null = null;
afterEach(() => { server?.stop(true); server = null; });

function fakeVessel(initial: Row[], opts: { readStatus?: number } = {}): { url: string; rows: Map<string, Row>; writes: string[] } {
  const rows = new Map(initial.map((r) => [r.id, r]));
  const writes: string[] = [];
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const j = (await req.json()) as { impulse: Record<string, unknown> };
      const p = j.impulse;
      if (p.type === "poolImpulse" && opts.readStatus) return Response.json({ success: false, error: "unavailable" }, { status: opts.readStatus });
      if (p.type === "poolImpulse") {
        let list = [...rows.values()].filter((r) => (p.shape === undefined || r.shape === p.shape) && (p.id === undefined || r.id === p.id));
        const total = list.length;
        if (typeof p.limit === "number") list = list.slice(0, p.limit);
        return Response.json({ body: { impulses: list, count: list.length, total } });
      }
      if (p.type === "poolImpulse_write") {
        const id = String(p.id);
        writes.push(id);
        rows.set(id, { id, shape: String(p.shape), body: p.body as Record<string, unknown> });
        return Response.json({ body: { ok: true, id } });
      }
      return Response.json({ error: "unexpected" }, { status: 400 });
    },
  });
  return { url: `http://127.0.0.1:${server.port}`, rows, writes };
}

async function runSeeder(url: string): Promise<{ code: number; out: string }> {
  const p = Bun.spawn(["bun", SEEDER], { env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DEV_VESSEL_ENDPOINT: url }, stdout: "pipe", stderr: "pipe" });
  const code = await p.exited;
  return { code, out: (await new Response(p.stdout).text()) + (await new Response(p.stderr).text()) };
}

const filler = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: `rhythm-other-${i}`, shape: "timeShapedRhythm", body: { family: `other-${i}`, budget: 0.5, alpha: 3, beta: 2, staleness: 0.2 } }));

describe("rhythm seeder delivers families missing by id to a populated registry", () => {
  it("MUST-FAIL: a registry holding 60 rhythms but not gap-check-supply gets that family written", async () => {
    const v = fakeVessel(filler(60));
    const r = await runSeeder(v.url);
    expect(r.code).toBe(0);
    expect(v.writes).toContain("rhythm-gap-check-supply");
    expect(v.rows.get("rhythm-gap-check-supply")?.body.family).toBe("gap-check-supply");
  });

  it("MUST-FAIL: only missing ids are written; an existing seeded row keeps its learned credit", async () => {
    const learned: Row = { id: "rhythm-reality-modeling", shape: "timeShapedRhythm", body: { family: "reality-modeling", budget: 0.15, alpha: 999, beta: 7, staleness: 0.01 } };
    const v = fakeVessel([...filler(55), learned]);
    await runSeeder(v.url);
    expect(v.writes).not.toContain("rhythm-reality-modeling");
    expect(v.rows.get("rhythm-reality-modeling")?.body.alpha).toBe(999);
    expect(v.writes.length).toBeGreaterThan(0);
  });

  it("MUST-FAIL: a second run writes nothing (idempotent)", async () => {
    const v = fakeVessel(filler(60));
    await runSeeder(v.url);
    const first = v.writes.length;
    await runSeeder(v.url);
    expect(first).toBeGreaterThan(0);
    expect(v.writes.length).toBe(first);
  });

  it("CONTROL: an empty registry still receives the full seed set, including gap-check-supply", async () => {
    const v = fakeVessel([]);
    const r = await runSeeder(v.url);
    expect(r.code).toBe(0);
    expect(v.writes).toContain("rhythm-reality-modeling");
    expect(v.writes).toContain("rhythm-gap-check-supply");
  });

  it("MUST-FAIL: a failing read (503 {success:false}) writes NOTHING and exits nonzero — never overwrite on a blind read", async () => {
    const learned: Row = { id: "rhythm-reality-modeling", shape: "timeShapedRhythm", body: { family: "reality-modeling", budget: 0.15, alpha: 999, beta: 7, staleness: 0.01 } };
    const v = fakeVessel([...filler(55), learned], { readStatus: 503 });
    const r = await runSeeder(v.url);
    expect(v.writes).toEqual([]);
    expect(r.code).not.toBe(0);
    expect(v.rows.get("rhythm-reality-modeling")?.body.alpha).toBe(999);
  });

  it("MUST-FAIL: an id held under a DIFFERENT shape is a collision — refused, not overwritten", async () => {
    const clash: Row = { id: "rhythm-gap-check-supply", shape: "somethingElse", body: { keep: true } };
    const v = fakeVessel([...filler(10), clash]);
    const r = await runSeeder(v.url);
    expect(v.writes).not.toContain("rhythm-gap-check-supply");
    expect(v.rows.get("rhythm-gap-check-supply")?.shape).toBe("somethingElse");
    expect(r.code).not.toBe(0);
  });

  it("MUST-FAIL: the scope-earn-in family (bootstrap item 3) is delivered to a registry that already holds gap-check-supply", async () => {
    const v = fakeVessel([...filler(12), { id: "rhythm-gap-check-supply", shape: "timeShapedRhythm", body: { family: "gap-check-supply", budget: 0.3, alpha: 4, beta: 2, staleness: 0.4 } }]);
    const r = await runSeeder(v.url);
    expect(r.code).toBe(0);
    expect(v.writes).toContain("rhythm-scope-earn-in");
    expect(v.writes).not.toContain("rhythm-gap-check-supply");
    expect(v.rows.get("rhythm-scope-earn-in")?.body.family).toBe("scope-earn-in");
  });
});
