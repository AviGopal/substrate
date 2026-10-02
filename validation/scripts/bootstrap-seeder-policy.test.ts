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
