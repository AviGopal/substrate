// The committed autonomy containment (scripts/substrate/autonomy-scope.json) and the bootstrap seeder's
// --pool-policy mode, which writes it as the first autonomyScope and spendEnvelope pool records on a fresh
// pool. The seeder is run as a process, exactly as development-vessel.service's ExecStartPre runs it.
import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SUPER = resolve(import.meta.dir, "..", "..");
const SEEDER = join(SUPER, "scripts", "bootstrap-seeder.ts");
const SCOPE_FILE = join(SUPER, "scripts", "substrate", "autonomy-scope.json");

function seed(root: string, scopeFile = SCOPE_FILE): { code: number; out: string } {
  const p = Bun.spawnSync(["bun", SEEDER, "--pool-policy", `--scope-file=${scopeFile}`], { env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", WORKSPACE_ROOT: root }, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? -1, out: p.stdout.toString() + p.stderr.toString() };
}

describe("scripts/substrate/autonomy-scope.json", () => {
  it("parses and describes containment the policy readers accept as contained", () => {
    const d = JSON.parse(readFileSync(SCOPE_FILE, "utf8"));
    const sc = d.autonomyScope, env = d.spendEnvelope;
    expect(Array.isArray(sc.excluded_paths)).toBe(true);
    expect(sc.excluded_paths.length).toBeGreaterThan(0);
    expect(sc.excluded_paths.every((p: unknown) => typeof p === "string" && p.trim() === p && p.length > 0)).toBe(true);
    expect(new Set(sc.excluded_paths).size).toBe(sc.excluded_paths.length);
    expect(sc.unrestricted).toBeUndefined();
    expect(sc.require_falsifier_classes).toEqual(["class2"]);
    expect(typeof env.usd_cap_per_hour === "number" && Number.isFinite(env.usd_cap_per_hour)).toBe(true);
    expect(env.uncapped).toBeUndefined();
    expect(env.paused).toBe(false);
  });
});

// The autonomous lane must not be able to edit the file that defines its own containment: the file's own repo path
// is excluded by its own excluded_paths. Same rule as development-vessel's autonomyScopeExcludes (gap-to-feature.ts):
// strip ":line", a leading "./" and "repos/"; an entry ending in "/" is a directory prefix, any other is an exact file.
function scopeExcludes(excluded: string[], path: string): string | null {
  const n = String(path).replace(/:\d+.*$/, "").replace(/\\/g, "/").trim();
  for (const e of excluded) {
    const s = e.replace(/^\.\//, "").replace(/^repos\//, "");
    if (s.endsWith("/")) { if (n.startsWith(s) || n.includes("/" + s)) return e; }
    else if (n === s || n.endsWith("/" + s)) return e;
  }
  return null;
}
describe("the containment file contains itself", () => {
  it("scripts/substrate/autonomy-scope.json is excluded by its own excluded_paths", () => {
    const d = JSON.parse(readFileSync(SCOPE_FILE, "utf8"));
    expect(scopeExcludes(d.autonomyScope.excluded_paths, "scripts/substrate/autonomy-scope.json")).not.toBeNull();
  });
  it("control: the rule matches a directory entry by prefix and a file entry exactly", () => {
    expect(scopeExcludes(["scripts/substrate/"], "scripts/substrate/autonomy-scope.json")).toBe("scripts/substrate/");
    expect(scopeExcludes(["repos/discovery-vessel/"], "repos/discovery-vessel/src/index.ts")).toBe("repos/discovery-vessel/");
    expect(scopeExcludes(["scripts/substrate"], "scripts/substrate/autonomy-scope.json")).toBeNull();
    expect(scopeExcludes(["scripts/other/"], "scripts/substrate/autonomy-scope.json")).toBeNull();
  });
});

describe("bootstrap-seeder --pool-policy", () => {
  it("seeds a fresh pool with exactly the committed file's autonomyScope and spendEnvelope (reason aside)", () => {
    const root = mkdtempSync(join(tmpdir(), "seed-policy-"));
    const r = seed(root);
    expect(r.code).toBe(0);
    const pool = JSON.parse(readFileSync(join(root, "pool", "standing.json"), "utf8")) as Array<{ shape: string; status: string; source: string; body: Record<string, unknown> }>;
    const want = JSON.parse(readFileSync(SCOPE_FILE, "utf8"));
    expect(pool.map((r) => r.shape).sort()).toEqual(["autonomyScope", "spendEnvelope"]);
    for (const rec of pool) {
      expect(rec.status).toBe("open");
      expect(rec.source).toBe("bootstrap-seeder");
      const { reason, ...body } = rec.body;
      expect(typeof reason).toBe("string");
      expect(body).toEqual(want[rec.shape]);
    }
  });

  it("an existing pool is left untouched (create-only), even one holding no policy record", () => {
    const root = mkdtempSync(join(tmpdir(), "seed-policy-"));
    mkdirSync(join(root, "pool"));
    writeFileSync(join(root, "pool", "standing.json"), "[]");
    const r = seed(root);
    expect(r.code).toBe(0);
    expect(r.out).toContain("not a fresh pool");
    expect(readFileSync(join(root, "pool", "standing.json"), "utf8")).toBe("[]");
  });

  it("a scope file that does not describe containment seeds nothing and exits non-zero", () => {
    const root = mkdtempSync(join(tmpdir(), "seed-policy-"));
    const bad = join(root, "scope.json");
    writeFileSync(bad, JSON.stringify({ autonomyScope: { excluded_paths: [] }, spendEnvelope: { usd_cap_per_hour: 2, paused: false } }));
    const r = seed(root, bad);
    expect(r.code).not.toBe(0);
    expect(existsSync(join(root, "pool", "standing.json"))).toBe(false);
  });
});

// THE SEED COVERS THE PINS. A fresh pool (a new install, or a recreate that loses the live record) is seeded from the
// committed file above, so an entry every node's live record carries but the seed lacks is lane-editable on that pool.
// The live records are pinned per node in scripts/substrate/self-facts.json (autonomy_scope_pinned), so the comparison
// runs against those pins and needs no node: every entry that EVERY pinned value carries must be in the committed seed.
// A path opened on one node only is absent from that node's pin, so it is in no intersection and never asserted here;
// the reverse direction (seed entries a pin lacks: per-node openings, per-file names of a pinned test directory) is
// allowed by the seed's own description. NOT_SEEDED names the pinned entries that are deliberately absent from the
// seed, each with its reason: a live, expiring tightening hold, or a test pull-sync's protected gate cannot count.
const SELF_FACTS = join(SUPER, "scripts", "substrate", "self-facts.json");
const NOT_SEEDED: Record<string, string> = {
  "repos/concept-db/tests/write-shapes.test.ts": "a scope-earn-in tightening hold (lineage-scoped and expiring); the seed carries no holds, so seeding it would make it permanent with no lineage exception",
  "repos/goal-host-vessel/test/command-egress-loop.test.ts": "skips every case where /workspace exists (its hermetic harness runs on a host checkout only), so pull-sync's protected gate, which runs each seeded .test.ts alone in the container and needs a pass count above zero, would refuse every goal-host candidate",
};
function pinnedValues(selfFacts: { rows?: Array<{ id?: string; expected_by_node?: Record<string, { excluded_paths?: string[] }> }> }): string[][] {
  const row = (selfFacts.rows ?? []).find((r) => r.id === "autonomy_scope_pinned");
  return Object.values(row?.expected_by_node ?? {}).map((v) => v.excluded_paths ?? []);
}
function missingFromSeed(seedPaths: string[], pins: string[][], notSeeded: Record<string, string>): string[] {
  if (pins.length === 0) return [];
  const seedSet = new Set(seedPaths);
  return pins[0]!.filter((p) => pins.every((pin) => pin.includes(p)) && !seedSet.has(p) && !(p in notSeeded));
}
describe("the committed seed covers every pinned live entry", () => {
  it("every entry all pinned autonomy_scope_pinned values carry is in autonomy-scope.json (NOT_SEEDED aside)", () => {
    const seedPaths: string[] = JSON.parse(readFileSync(SCOPE_FILE, "utf8")).autonomyScope.excluded_paths;
    const pins = pinnedValues(JSON.parse(readFileSync(SELF_FACTS, "utf8")));
    expect(pins.length).toBeGreaterThan(0);
    expect(missingFromSeed(seedPaths, pins, NOT_SEEDED)).toEqual([]);
  });
  it("NOT_SEEDED entries are absent from the seed (a listed entry the seed carries is a stale exemption)", () => {
    const seedPaths: string[] = JSON.parse(readFileSync(SCOPE_FILE, "utf8")).autonomyScope.excluded_paths;
    expect(Object.keys(NOT_SEEDED).filter((p) => seedPaths.includes(p))).toEqual([]);
  });
  it("must-fail: an entry planted into every pin and not into the seed is reported; one pin lacking it is not", () => {
    const seedPaths = ["repos/a/src/x.ts", "repos/a/test/dir/"];
    const plant = "repos/a/src/planted.ts";
    expect(missingFromSeed(seedPaths, [[...seedPaths, plant], [...seedPaths, plant]], {})).toEqual([plant]);
    expect(missingFromSeed(seedPaths, [[...seedPaths, plant], [...seedPaths]], {})).toEqual([]);
    expect(missingFromSeed(seedPaths, [[...seedPaths, plant], [...seedPaths, plant]], { [plant]: "named" })).toEqual([]);
    // control: a seed entry the pins lack (a per-node opening) is not a failure
    expect(missingFromSeed([...seedPaths, "repos/a/src/opened.ts"], [[...seedPaths], [...seedPaths]], {})).toEqual([]);
  });
});
