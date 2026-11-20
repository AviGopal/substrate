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

// THE PERSON-ONLY SET HAS A FLOOR. git_commit and git_land read person_only from this file at the base of every change,
// in place of lists in their own code, so an edit that empties a part of it, or drops a gate directory or the hooks,
// would let the lane land a change to what judges it on a grader's verdict alone. The file names itself in
// excluded_paths, so such an edit needs a person when the lane makes it; this floor catches an operator's edit, which
// no landing judges.
const GATE_FLOOR = ["scripts/git-hooks/**", ".git-hooks/**", "scripts/substrate/gate/**", "validation/scripts/gate/**"];
const globs = (v: unknown): boolean => Array.isArray(v) && v.length > 0
  && v.every((g) => typeof g === "string" && g.trim() === g && g.length > 0) && new Set(v).size === v.length;
function personOnlyFaults(po: unknown): string[] {
  const o = po as { every_repo?: unknown; by_repo?: unknown; fixtures_without_gate_policy?: unknown } | null;
  if (o === null || typeof o !== "object") return ["person_only is not an object"];
  const out: string[] = [];
  if (!globs(o.every_repo)) out.push("every_repo is not a non-empty list of distinct trimmed globs");
  else for (const g of GATE_FLOOR) if (!(o.every_repo as string[]).includes(g)) out.push(`every_repo lacks ${g}`);
  if (o.by_repo === null || typeof o.by_repo !== "object" || Array.isArray(o.by_repo) || Object.keys(o.by_repo).length === 0) out.push("by_repo names no repository");
  else for (const [repo, v] of Object.entries(o.by_repo)) if (!globs(v)) out.push(`by_repo.${repo} is not a non-empty list of distinct trimmed globs`);
  if (!globs(o.fixtures_without_gate_policy)) out.push("fixtures_without_gate_policy is not a non-empty list of distinct trimmed globs");
  return out;
}
describe("the person-only set", () => {
  it("is present, well formed, and keeps the gate directories and hooks", () => {
    const d = JSON.parse(readFileSync(SCOPE_FILE, "utf8"));
    expect(personOnlyFaults(d.autonomyScope.person_only)).toEqual([]);
  });
  it("control: each kind of fault is reported", () => {
    const ok = { every_repo: [...GATE_FLOOR], by_repo: { r: ["src/**"] }, fixtures_without_gate_policy: ["validation/**"] };
    expect(personOnlyFaults(ok)).toEqual([]);
    expect(personOnlyFaults(undefined)).toEqual(["person_only is not an object"]);
    expect(personOnlyFaults({ ...ok, every_repo: GATE_FLOOR.slice(1) })).toEqual(["every_repo lacks scripts/git-hooks/**"]);
    expect(personOnlyFaults({ ...ok, every_repo: [] })).toEqual(["every_repo is not a non-empty list of distinct trimmed globs"]);
    expect(personOnlyFaults({ ...ok, every_repo: [...GATE_FLOOR, " x"] })).toEqual(["every_repo is not a non-empty list of distinct trimmed globs"]);
    expect(personOnlyFaults({ ...ok, every_repo: [...GATE_FLOOR, ""] })).toEqual(["every_repo is not a non-empty list of distinct trimmed globs"]);
    expect(personOnlyFaults({ ...ok, every_repo: [...GATE_FLOOR, 5] })).toEqual(["every_repo is not a non-empty list of distinct trimmed globs"]);
    expect(personOnlyFaults({ ...ok, by_repo: {} })).toEqual(["by_repo names no repository"]);
    expect(personOnlyFaults({ ...ok, by_repo: ["src/**"] })).toEqual(["by_repo names no repository"]);
    expect(personOnlyFaults({ ...ok, by_repo: { r: [] } })).toEqual(["by_repo.r is not a non-empty list of distinct trimmed globs"]);
    expect(personOnlyFaults({ ...ok, by_repo: { r: ["a", "a"] } })).toEqual(["by_repo.r is not a non-empty list of distinct trimmed globs"]);
    expect(personOnlyFaults({ ...ok, fixtures_without_gate_policy: "validation/**" })).toEqual(["fixtures_without_gate_policy is not a non-empty list of distinct trimmed globs"]);
  });
});
