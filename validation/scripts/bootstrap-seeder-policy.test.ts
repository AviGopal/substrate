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

// Which paths of the model service a change may land on without a person (USER ruling 11-23, the model service's main
// file leaves the protected list): its main file lands like any other path, while its spending-limit files stay on
// the list. Read with the rule local-tools' git_commit and git_land apply to this file at a change's super base
// (write-containment.ts scopeEntryFor): an entry ending in "/" is a directory, any other one file, exactly.
function entryFor(rel: string, excluded: readonly string[]): string | null {
  const n = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!n) return null;
  for (const e of excluded) {
    if (e.endsWith("/")) { if (n === e.slice(0, -1) || n.startsWith(e)) return e; }
    else if (n === e) return e;
  }
  return null;
}
describe("the model service on the protected list", () => {
  const excluded = (): string[] => JSON.parse(readFileSync(SCOPE_FILE, "utf8")).autonomyScope.excluded_paths;
  it("[MUST-FAIL] its main file is not on the list, so a change to it needs no person", () => {
    expect(entryFor("repos/llm-resolver-vessel/src/index.ts", excluded())).toBeNull();
  });
  it("[GUARD] its spending-limit file and that file's test stay on it", () => {
    expect(entryFor("repos/llm-resolver-vessel/src/dispatch-budget.ts", excluded())).toBe("repos/llm-resolver-vessel/src/dispatch-budget.ts");
    expect(entryFor("repos/llm-resolver-vessel/src/dispatch-budget.test.ts", excluded())).toBe("repos/llm-resolver-vessel/src/dispatch-budget.test.ts");
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
// in place of lists in their own code, so an edit that empties a part of it, or drops what judges a change, would let
// the lane land a change to its own judge on a grader's verdict alone. The floor is the judge itself: the gate
// directories, the hooks, the owner seed that writes the walk's owner rows, local-tools' landing files and its two
// containment files, and records' src (where grades, closes and credit are computed). The file names itself in
// excluded_paths, so an edit to it needs a person when the lane makes it; this floor catches an operator's edit, which
// no landing judges. A ruling that narrows these lists changes this floor in the same change.
const EVERY_REPO_FLOOR = ["scripts/git-hooks/**", ".git-hooks/**", "scripts/substrate/gate/**", "validation/scripts/gate/**",
  "scripts/substrate/walk-owner-seed.ts"];
const BY_REPO_FLOOR: Record<string, string[]> = {
  "local-tools-vessel": ["src/git-*.ts", "src/write-containment.ts", "src/shell-containment.ts"],
  "records-vessel": ["src/**"],
};
const globs = (v: unknown): boolean => Array.isArray(v) && v.length > 0
  && v.every((g) => typeof g === "string" && g.trim() === g && g.length > 0) && new Set(v).size === v.length;
function personOnlyFaults(po: unknown): string[] {
  const o = po as { every_repo?: unknown; by_repo?: unknown; fixtures_without_gate_policy?: unknown } | null;
  if (o === null || typeof o !== "object") return ["person_only is not an object"];
  const out: string[] = [];
  if (!globs(o.every_repo)) out.push("every_repo is not a non-empty list of distinct trimmed globs");
  else for (const g of EVERY_REPO_FLOOR) if (!(o.every_repo as string[]).includes(g)) out.push(`every_repo lacks ${g}`);
  if (o.by_repo === null || typeof o.by_repo !== "object" || Array.isArray(o.by_repo) || Object.keys(o.by_repo).length === 0) out.push("by_repo names no repository");
  else {
    const by = o.by_repo as Record<string, unknown>;
    for (const [repo, v] of Object.entries(by)) if (!globs(v)) out.push(`by_repo.${repo} is not a non-empty list of distinct trimmed globs`);
    for (const [repo, floor] of Object.entries(BY_REPO_FLOOR)) {
      if (!(repo in by)) out.push(`by_repo lacks ${repo}`);
      else if (globs(by[repo])) for (const g of floor) if (!(by[repo] as string[]).includes(g)) out.push(`by_repo.${repo} lacks ${g}`);
    }
  }
  if (!globs(o.fixtures_without_gate_policy)) out.push("fixtures_without_gate_policy is not a non-empty list of distinct trimmed globs");
  return out;
}
describe("the person-only set", () => {
  it("is present, well formed, and keeps what judges a change", () => {
    const d = JSON.parse(readFileSync(SCOPE_FILE, "utf8"));
    expect(personOnlyFaults(d.autonomyScope.person_only)).toEqual([]);
  });
  it("control: each kind of fault is reported", () => {
    const by = (): Record<string, string[]> => ({ ...Object.fromEntries(Object.entries(BY_REPO_FLOOR).map(([r, g]) => [r, [...g]])), r: ["src/**"] });
    const ok = { every_repo: [...EVERY_REPO_FLOOR], by_repo: by(), fixtures_without_gate_policy: ["validation/**"] };
    const not = "is not a non-empty list of distinct trimmed globs";
    expect(personOnlyFaults(ok)).toEqual([]);
    expect(personOnlyFaults(undefined)).toEqual(["person_only is not an object"]);
    for (const g of EVERY_REPO_FLOOR) {
      expect(personOnlyFaults({ ...ok, every_repo: EVERY_REPO_FLOOR.filter((x) => x !== g) })).toEqual([`every_repo lacks ${g}`]);
    }
    expect(personOnlyFaults({ ...ok, every_repo: [] })).toEqual([`every_repo ${not}`]);
    expect(personOnlyFaults({ ...ok, every_repo: [...EVERY_REPO_FLOOR, " x"] })).toEqual([`every_repo ${not}`]);
    expect(personOnlyFaults({ ...ok, every_repo: [...EVERY_REPO_FLOOR, ""] })).toEqual([`every_repo ${not}`]);
    expect(personOnlyFaults({ ...ok, every_repo: [...EVERY_REPO_FLOOR, 5] })).toEqual([`every_repo ${not}`]);
    for (const [repo, floor] of Object.entries(BY_REPO_FLOOR)) {
      for (const g of floor) {
        const b = by(); b[repo] = [...floor.filter((x) => x !== g), "src/other.ts"];
        expect(personOnlyFaults({ ...ok, by_repo: b })).toEqual([`by_repo.${repo} lacks ${g}`]);
      }
      const b = by(); delete b[repo];
      expect(personOnlyFaults({ ...ok, by_repo: b })).toEqual([`by_repo lacks ${repo}`]);
      const e = by(); e[repo] = [];
      expect(personOnlyFaults({ ...ok, by_repo: e })).toEqual([`by_repo.${repo} ${not}`]);
    }
    expect(personOnlyFaults({ ...ok, by_repo: {} })).toEqual(["by_repo names no repository"]);
    expect(personOnlyFaults({ ...ok, by_repo: ["src/**"] })).toEqual(["by_repo names no repository"]);
    expect(personOnlyFaults({ ...ok, by_repo: { ...by(), r: [] } })).toEqual([`by_repo.r ${not}`]);
    expect(personOnlyFaults({ ...ok, by_repo: { ...by(), r: ["a", "a"] } })).toEqual([`by_repo.r ${not}`]);
    expect(personOnlyFaults({ ...ok, fixtures_without_gate_policy: "validation/**" })).toEqual([`fixtures_without_gate_policy ${not}`]);
  });
});
