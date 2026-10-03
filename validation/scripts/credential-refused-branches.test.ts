// The 401 branches d08cc51e added to the newly keyed script reads, exercised against a real listener.
//
// WHY. Each of those reads now sends the node key; a stale key gets 401. The branches print
// `credential refused (401) — key stale?` and report what they could not measure as UNKNOWN /
// UNSCORED, never as a failure or a regression. They are inline, per script, each in the result
// vocabulary its script already had (a tick's JSON record, a harness's null score, the watchdog's
// fail-open lease), so there is no shared helper to test once. This file tests one case per
// DISTINCT PATTERN, by running or importing the real script against a Bun.serve listener on
// 127.0.0.1 that answers 401 to everything:
//
//   A  tick record      db-contention-check, trace-store-health-check, gap-compose-tick, funnel-drain
//                       print a JSON record with verdict "unknown" and exit 0; efficiency-failure-tick
//                       reports err=<the line> and exits 0 (spawned, DEV_VESSEL_ENDPOINT at the stub)
//   B  watchdog         the lease read fails open (as it always did) with the line; the restart
//                       dispatch stops after ONE attempt and records the environment fault (spawned
//                       with a WORKSPACE_ROOT holding one open intent and no activity)
//   C  harness score    goal-expectation's llmJudge returns correct:null UNSCORED; complexity-ladder's
//                       measureGroundTruth leaves openGapCount null without an error entry, its
//                       verifySideEffect returns refused, and its poll returns
//                       UNKNOWN_CREDENTIAL_REFUSED after one request (imported: the harnesses export
//                       these and run main only as the entry point)
//   D  auto-describe    generateDescription returns null (no description written), with the line
//
// NOT COVERED, and why: coherence-metric reads SurrealDB and concept-db at fixed in-container
// addresses (127.0.0.1:8000, :8260) a test cannot redirect without binding ports a live substrate
// may hold; stage-harness S11 runs inside its full harness, which drives the live container.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const LINE = "credential refused (401) — key stale?";
let server: ReturnType<typeof Bun.serve>;
let EP = "";
const hits: string[] = [];

beforeAll(() => {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      hits.push(`${req.method} ${new URL(req.url).pathname}`);
      return new Response('{"error":"unauthorized"}', { status: 401, headers: { "Content-Type": "application/json" } });
    },
  });
  EP = `http://127.0.0.1:${server.port}`;
  // Imported harnesses read their endpoints from the environment when the module loads.
  Object.assign(process.env, {
    DEV_VESSEL_ENDPOINT: EP, GOAL_HOST_ENDPOINT: EP, DISCOVERY_ENDPOINT: EP, LLM_RESOLVER: `${EP}/resolve`,
    LLM_VESSEL_ENDPOINT: EP, DISCOVERY_VESSEL_ENDPOINT: EP, METABOB_API_KEY: "placeholder-not-a-key",
    // Every other address the imported modules know, so nothing can reach a live substrate.
    GOAL_HOST: EP, METABOB_ENDPOINT: EP, SURREALDB_URL: EP,
  });
});
afterAll(() => server?.stop(true));

// Asynchronous on purpose: the listener lives in this process, so a synchronous spawn would block the
// event loop that has to answer the child.
async function run(script: string, env: Record<string, string> = {}) {
  const p = Bun.spawn([process.execPath, join(ROOT, script)], {
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp", METABOB_API_KEY: "placeholder-not-a-key", DEV_VESSEL_ENDPOINT: EP, ...env },
    stdout: "pipe", stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, out, err };
}
const lastJson = (s: string): Record<string, unknown> => {
  const l = s.trim().split("\n").filter((x) => x.startsWith("{")).pop() ?? "{}";
  return JSON.parse(l) as Record<string, unknown>;
};

describe("A — a tick reports a refused key as an unknown verdict, not a failure", () => {
  for (const s of ["db-contention-check", "trace-store-health-check", "gap-compose-tick", "funnel-drain"]) {
    it(`${s}: verdict unknown, the line, exit 0`, async () => {
      const r = await run(`scripts/substrate/${s}.ts`);
      expect(r.err).toContain(LINE);
      expect(lastJson(r.out).verdict).toBe("unknown");
      expect(r.code).toBe(0);
    });
  }
  it("efficiency-failure-tick: each step reports err=<the line>, exit 0", async () => {
    const r = await run("scripts/substrate/efficiency-failure-tick.ts");
    expect(r.err).toContain(LINE);
    expect(r.out).toContain(`err=${LINE}`);
    expect(r.code).toBe(0);
  });
});

describe("B — the watchdog: lease fails open with the line; the restart stops after one refused attempt", () => {
  it("records the environment fault on the restart, attempts 1, exit 0", async () => {
    const ws = mkdtempSync(join(tmpdir(), "wd-"));
    mkdirSync(join(ws, "pool"), { recursive: true });
    writeFileSync(join(ws, "pool", "standing.json"), JSON.stringify([
      { id: "i1", shape: "substrateGap", body: {}, source: "t", status: "open", injected_at: "", updated_at: "" },
    ]));
    const r = await run("scripts/substrate/watchdog-tick.ts", {
      WORKSPACE_ROOT: ws, WATCHDOG_ACTIVITY_PATHS: join(ws, "none"), WATCHDOG_RESTART_IMPULSE: "fixture_restart",
    });
    expect(r.err).toContain(`${LINE} watchdog-tick: the lease read was refused`);
    expect(r.err).toContain(`${LINE} watchdog-tick: the restart dispatch was refused`);
    const rec = lastJson(r.out);
    expect(rec.environment).toBe(LINE);
    expect(rec.http).toBe(401);
    expect(rec.attempts).toBe(1);
    expect(r.code).toBe(0);
    expect(existsSync(join(ws, "pool", "watchdog-log.jsonl"))).toBe(true);
  });
});

describe("C — a harness scores a refused read as unscored, never as wrong", () => {
  it("goal-expectation llmJudge: correct null, UNSCORED with the line", async () => {
    const m = (await import("./goal-expectation-harness.ts")) as { llmJudge?: (g: string, r: string, a: string) => Promise<{ correct: boolean | null; detail: string }> };
    expect(typeof m.llmJudge).toBe("function");
    const v = await m.llmJudge!("goal", "rubric", "answer");
    expect(v.correct).toBeNull();
    expect(v.detail).toContain(LINE);
  });
  it("complexity-ladder: openGapCount null and no error entry; verifySideEffect refused; poll unknown after one request", async () => {
    const m = (await import("./complexity-ladder-harness.ts")) as {
      measureGroundTruth?: () => Promise<{ openGapCount: number | null; errors: string[] }>;
      verifySideEffect?: (t: string, v: string[]) => Promise<{ found: boolean; carries: boolean; refused?: boolean }>;
      poll?: (id: string) => Promise<Record<string, unknown> | null>;
    };
    expect(typeof m.measureGroundTruth).toBe("function");
    const g = await m.measureGroundTruth!();
    expect(g.openGapCount).toBeNull();
    expect(g.errors.some((e) => e.includes("substrateGap"))).toBe(false);
    const se = await m.verifySideEffect!("title", ["1"]);
    expect(se.refused).toBe(true);
    const before = hits.length;
    const p = await m.poll!("d-1");
    expect(p?.status).toBe("UNKNOWN_CREDENTIAL_REFUSED");
    expect(hits.length - before).toBe(1);
  });
});

describe("D — auto-describe writes no description on a refused key", () => {
  it("generateDescription returns null", async () => {
    const m = (await import("../../scripts/substrate/auto-describe-resolvers.ts")) as { generateDescription?: (s: string, e: string) => Promise<string | null> };
    expect(typeof m.generateDescription).toBe("function");
    expect(await m.generateDescription!("someShape", "evidence")).toBeNull();
  });
});
