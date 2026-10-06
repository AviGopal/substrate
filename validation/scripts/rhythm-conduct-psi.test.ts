// The bootstrap-tier conductor script must NOT price affordability itself. It computed a per-core
// load-average bucket (normalisedBucketLoad) and PINNED it as bucket_load on every rhythm_conductor_tick
// call, so the conductor's own measurement never ran. On 2026-10-06 node1 read load 23-25 on 16 cores
// and enqueued nothing for ~8 h while PSI said the host was idle (cpu some avg60 ~3%, io 0). The
// conductor (development-vessel 5691816e) now buckets on PSI against a shaped threshold; this script
// must let it, and must journal what the conductor measured.
//
// Run as a process, as rhythm-cadence.service runs it, against a fake development-vessel resolve
// endpoint that records the call and answers with a conductor report.
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SUPER = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(SUPER, "scripts", "substrate", "rhythm-conduct-tick.ts");

let server: ReturnType<typeof Bun.serve> | null = null;
afterEach(() => { server?.stop(true); server = null; });

function fakeDevVessel(report: Record<string, unknown>): { url: string; ticks: Record<string, unknown>[] } {
  const ticks: Record<string, unknown>[] = [];
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const j = (await req.json()) as { impulse: Record<string, unknown> };
      const p = j.impulse;
      if (p.type === "rhythm_conductor_tick") { ticks.push(p); return Response.json({ body: report }); }
      if (p.type === "poolImpulse") return Response.json({ body: { impulses: [], count: 0 } });
      return Response.json({ body: { ok: true } });
    },
  });
  return { url: `http://127.0.0.1:${server.port}`, ticks };
}

async function runScript(url: string): Promise<{ code: number; out: string }> {
  const state = join(mkdtempSync(join(tmpdir(), "rct-psi-")), "change-state.json");
  const p = Bun.spawn(["bun", SCRIPT], {
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DEV_VESSEL_ENDPOINT: url, RHYTHM_CHANGE_STATE: state },
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await p.exited;
  return { code, out: (await new Response(p.stdout).text()) + (await new Response(p.stderr).text()) };
}

const REPORT = {
  considered: 14, enqueued: [], skipped: [], drained: 0,
  bucket_load: 0, load_source: "psi", psi_cpu: 3.12, psi_io: 0, load: 22.4, cores: 16, psi_fallback: 0,
};

describe("rhythm-conduct-tick defers affordability to the conductor", () => {
  it("[MUST-FAIL] the rhythm_conductor_tick call carries no bucket_load", async () => {
    const v = fakeDevVessel(REPORT);
    const r = await runScript(v.url);
    expect(r.code).toBe(0);
    expect(v.ticks.length).toBe(1);
    expect("bucket_load" in v.ticks[0]!).toBe(false);
  });

  it("[MUST-FAIL] the journal line reports the conductor's source and readings, not the script's own load", async () => {
    const v = fakeDevVessel(REPORT);
    const r = await runScript(v.url);
    expect(r.out).toContain("load_source=psi");
    expect(r.out).toContain("psi_cpu=3.12");
    expect(r.out).toContain("psi_io=0");
    expect(r.out).toContain("psi_fallback=0");
    expect(r.out).not.toContain("per_core=");
    expect(r.out).not.toContain("raw-load bucketing");
  });

  it("[MUST-FAIL] a loadavg fallback reported by the conductor is journalled as such (the line copies the report, never assumes psi)", async () => {
    const v = fakeDevVessel({ ...REPORT, bucket_load: 2, load_source: "loadavg", psi_cpu: null, psi_io: null, psi_fallback: 4 });
    const r = await runScript(v.url);
    expect(r.out).toContain("load_source=loadavg");
    expect(r.out).toContain("psi_fallback=4");
    expect(r.out).toContain("bucket_load=2 affordability_ceiling=0.333");
  });

  it("[CONTROL] a pre-PSI conductor report (no load_source) still logs a parseable line", async () => {
    const v = fakeDevVessel({ considered: 3, enqueued: [], skipped: [], drained: 0, bucket_load: 1 });
    const r = await runScript(v.url);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/\[rhythm-conduct\] considered=3 enqueued=0 skipped=0 drained=0 bucket_load=1 affordability_ceiling=0\.667/);
  });
});
