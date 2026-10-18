// The landing tally autonomy-metrics.ts reports (scripts/substrate/autonomy-landings.ts), against a
// fixture git repo: one landing per gap family whose fix is on origin/dev and whose own gap closed
// landed_verified. The legacy count (`git log --all --grep`, per commit, every ref) is the control.
// The last block runs autonomy-metrics.ts itself, as its unit does (from a run dir that is not the
// checkout, the repos under WORKSPACE_ROOT), against a stub server standing in for every endpoint.
import { afterAll, describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  classifyCommit, familyKey, gapLineageStem, landingTally, readLandingCommits,
  type GapRow, type LandingCommit,
} from "../../scripts/substrate/autonomy-landings.ts";

const ROOT = mkdtempSync(join(tmpdir(), "autonomy-landings-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
const ENV = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: ROOT, GIT_CONFIG_NOSYSTEM: "1", LANG: "C" };

function git(dir: string, ...args: string[]): string {
  const p = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { env: ENV, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${p.stderr.toString()}`);
  return p.stdout.toString().trim();
}
function landing(dir: string, gap: string, path: string): void {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), `// ${gap} ${Math.random()}\n`);
  git(dir, "add", "-A");
  const msg = join(ROOT, "msg.txt");
  writeFileSync(msg, `substrate-authored: apply ${gap}-compose-report via mitosis cutover\n\nGap: ${gap}\nProposal: ${gap}-compose-report\nAttempt-Id: att-fixture\n`);
  git(dir, "commit", "-q", "-F", msg);
}

// origin/dev: a check-only commit (gap-beta), a fix (gap-alpha) and its recommit child.
// A local branch one commit ahead carries a fix (gap-gamma) that never reached origin/dev.
const WS = join(ROOT, "ws");
const REPO = join(WS, "repos", "activity-api");
mkdirSync(REPO, { recursive: true });
git(REPO, "init", "-q", "-b", "dev");
writeFileSync(join(REPO, "README"), "fixture\n");
git(REPO, "add", "-A");
git(REPO, "commit", "-q", "-m", "chore: init");
landing(REPO, "gap-beta", "test/checks/gap-beta.check.ts");
landing(REPO, "gap-alpha", "src/alpha.ts");
landing(REPO, "recommit-gap-alpha-verify_failed", "src/alpha.ts");
git(REPO, "update-ref", "refs/remotes/origin/dev", git(REPO, "rev-parse", "HEAD"));
git(REPO, "checkout", "-q", "-b", "local-work");
landing(REPO, "gap-gamma", "src/gamma.ts");

// The stub gap store. The recommit child has no row, so its family comes from its id alone.
const STORE = new Map<string, GapRow>([
  ["gap-alpha", { id: "gap-alpha", status: "closed", classification_metadata: { closed_reason: "landed_verified" } }],
  ["gap-beta", { id: "gap-beta", status: "open", classification_metadata: {} }],
  ["gap-gamma", { id: "gap-gamma", status: "closed", classification_metadata: { closed_reason: "landed_verified" } }],
]);
const gapOf = (id: string) => STORE.get(id) ?? null;

describe("landing tally over a fixture repo", () => {
  it("control: the legacy count (--all, per commit) reads 4, the unpushed commit included", () => {
    const out = git(REPO, "log", "--all", "--grep=substrate-authored: apply", "--oneline");
    expect(out.split("\n").length).toBe(4);
  });

  it("reads only origin/dev: the commit on the local branch is not a landing", async () => {
    const commits = (await readLandingCommits(REPO, "vessel"))!;
    expect(commits.length).toBe(3);
    expect(commits.some((c) => c.body.includes("Gap: gap-gamma"))).toBe(false);
  });

  it("counts 2 families, 1 landed and 1 check_supplied", async () => {
    const commits = (await readLandingCommits(REPO, "vessel"))!;
    const c = landingTally(commits, gapOf, Date.now());
    expect(c.commits).toBe(3);
    expect(c.families.map((f) => [f.gap, f.class, f.status]).sort()).toEqual([
      ["gap-alpha", "fix_only", "landed"],
      ["gap-beta", "check_only", "check_supplied"],
    ]);
    expect([c.landed, c.check_supplied, c.landed_partial, c.reopened, c.fix_only_unverified]).toEqual([1, 1, 0, 0, 0]);
    expect(c.landed_24h).toBe(1);
  });

  it("a repo with no origin/dev is unreadable (null), not zero landings", async () => {
    const bare = join(ROOT, "no-remote");
    mkdirSync(bare);
    git(bare, "init", "-q", "-b", "dev");
    expect(await readLandingCommits(bare, "no-remote")).toBeNull();
  });
});

describe("landing tally rules", () => {
  const commit = (gap: string, files: string[], ms = Date.now()): LandingCommit =>
    ({ repo: "v", sha: gap, committed_ms: ms, body: `substrate-authored: apply ${gap}-compose-report via mitosis cutover\n\nGap: ${gap}\n`, files });

  it("classifies by touched paths", () => {
    expect(classifyCommit(["test/checks/x.check.ts"])).toBe("check");
    expect(classifyCommit(["src/x.test.ts", "scripts/y.check.sh"])).toBe("check");
    expect(classifyCommit(["test/x.test.ts", "src/x.ts"])).toBe("fix");
    expect(classifyCommit([])).toBe("empty");
  });

  it("folds children into their parent: the store's link first, the id rules only without one", () => {
    expect(gapLineageStem("recommit-g-narrowed-c3-compose_execution_failure")).toBe("g");
    expect(gapLineageStem("recommit-g-step-1-verify_failed")).toBe("g");
    expect(gapLineageStem("recommit-g-verify_failed-narrowed")).toBe("g");
    const rows = new Map<string, GapRow>([["child-x", { id: "child-x", classification_metadata: { parent_gap_id: "root-y" } }]]);
    expect(familyKey("child-x", (id) => rows.get(id) ?? null)).toBe("root-y");
    expect(familyKey("root-y-narrowed", () => null)).toBe("root-y");
    // the stem's own row is walked too
    const stemRows = new Map<string, GapRow>([["mid-z", { id: "mid-z", classification_metadata: { source_gap_id: "top-z" } }]]);
    expect(familyKey("mid-z-narrowed", (id) => stemRows.get(id) ?? null)).toBe("top-z");
  });

  it("landed_partial, reopened, other close reasons and check-only are not landed", () => {
    const rows = new Map<string, GapRow>([
      ["p", { id: "p", status: "closed", classification_metadata: { closed_reason: "landed_partial" } }],
      ["r", { id: "r", status: "open", classification_metadata: { reopen_count: 1 } }],
      ["s", { id: "s", status: "reopened", classification_metadata: {} }],
      ["l", { id: "l", status: "closed", closed_reason: "landed_literal_only" }],
      ["k", { id: "k", status: "closed", classification_metadata: { closed_reason: "landed_verified" } }],
    ]);
    const c = landingTally([commit("p", ["src/a.ts"]), commit("r", ["src/b.ts"]), commit("s", ["src/s.ts"]), commit("l", ["src/c.ts"]), commit("k", ["test/k.test.ts"])], (id) => rows.get(id) ?? null, Date.now());
    expect([c.landed, c.landed_partial, c.reopened, c.fix_only_unverified, c.check_supplied]).toEqual([0, 1, 2, 1, 1]);
  });

  it("landed_24h keys on the landed fix commit's commit time", () => {
    const rows = new Map<string, GapRow>([["k", { id: "k", status: "closed", classification_metadata: { closed_reason: "landed_verified" } }]]);
    const now = Date.now();
    expect(landingTally([commit("k", ["src/k.ts"], now - 25 * 3600_000)], (id) => rows.get(id) ?? null, now).landed_24h).toBe(0);
    expect(landingTally([commit("k", ["src/k.ts"], now - 23 * 3600_000)], (id) => rows.get(id) ?? null, now).landed_24h).toBe(1);
  });
});

// A second fixture, all on origin/dev: a clean fix, a fix undone by `git revert`, a fix undone by a revert
// whose message was rewritten (prose "reverts <short sha>", no trailer), and a fix whose revert was reverted.
// Every gap row is system-filed and closed landed_verified, so only the history can tell them apart.
const REV = join(ROOT, "reverts");
mkdirSync(REV);
git(REV, "init", "-q", "-b", "dev");
writeFileSync(join(REV, "README"), "fixture\n");
git(REV, "add", "-A");
git(REV, "commit", "-q", "-m", "chore: init");
landing(REV, "gap-clean", "src/clean.ts");
landing(REV, "gap-delta", "src/delta.ts");
git(REV, "revert", "--no-edit", "HEAD");
landing(REV, "gap-eps", "src/eps.ts");
const epsShort = git(REV, "rev-parse", "--short=12", "HEAD");
git(REV, "revert", "--no-commit", "HEAD");
git(REV, "commit", "-q", "-m", `fix: take the eps landing back out\n\nThis reverts ${epsShort}: it edited the wrong region.`);
landing(REV, "gap-zeta", "src/zeta.ts");
git(REV, "revert", "--no-edit", "HEAD");
git(REV, "revert", "--no-edit", "HEAD");
git(REV, "update-ref", "refs/remotes/origin/dev", git(REV, "rev-parse", "HEAD"));
const verified = (id: string, source = "substrate_detected"): [string, GapRow] =>
  [id, { id, source, status: "closed", classification_metadata: { closed_reason: "landed_verified" } }];
const REV_STORE = new Map<string, GapRow>(["gap-clean", "gap-delta", "gap-eps", "gap-zeta"].map((id) => verified(id)));

describe("reverts and who filed the gap", () => {
  it("control: a clean system-filed landing counts once", async () => {
    const commits = (await readLandingCommits(REV, "reverts"))!;
    const c = landingTally(commits.filter((x) => x.body.includes("Gap: gap-clean")), (id) => REV_STORE.get(id) ?? null, Date.now());
    expect([c.commits, c.landed, c.families.length]).toEqual([1, 1, 1]);
  });

  it("must-fail: a fix commit reverted on origin/dev is not landed, by git revert or by a rewritten revert message", async () => {
    const commits = (await readLandingCommits(REV, "reverts"))!;
    const c = landingTally(commits, (id) => REV_STORE.get(id) ?? null, Date.now());
    const status = Object.fromEntries(c.families.map((f) => [f.gap, f.status]));
    expect(status["gap-delta"]).not.toBe("landed");
    expect(status["gap-eps"]).not.toBe("landed");
    // gap-clean, and gap-zeta whose revert was itself reverted
    expect(status["gap-zeta"]).toBe("landed");
    expect([c.landed, c.reverted]).toEqual([2, 2]);
  });

  it("must-fail: an operator-filed gap lands in the operator bucket, not the system bucket", () => {
    // The operator filed op-root; its recommit child was filed substrate_detected (as feature_compose files
    // one) and is the gap that landed. sys-g is a system-filed gap that landed.
    const rows = new Map<string, GapRow>([
      ["op-root", { id: "op-root", source: "human_reported", status: "open", classification_metadata: {} }],
      ["recommit-op-root-verify_failed", { id: "recommit-op-root-verify_failed", source: "substrate_detected", status: "closed", classification_metadata: { closed_reason: "landed_verified", source_gap_id: "op-root", root_gap_id: "op-root" } }],
      verified("sys-g"),
    ]);
    const commit = (gap: string, file: string): LandingCommit =>
      ({ repo: "v", sha: gap, committed_ms: Date.now(), body: `substrate-authored: apply ${gap}-compose-report via mitosis cutover\n\nGap: ${gap}\n`, files: [file] });
    const c = landingTally([commit("recommit-op-root-verify_failed", "src/a.ts"), commit("sys-g", "src/b.ts")], (id) => rows.get(id) ?? null, Date.now());
    expect([c.landed, c.landed_system, c.landed_operator, c.landed_source_unknown]).toEqual([2, 1, 1, 0]);
  });
});

// ── autonomy-metrics.ts end to end ──
// The script is copied into a run dir with its sibling, as the unit's run dir holds every baked *.ts,
// so a path relative to the script cannot find the repos. Every endpoint is one stub server: SQL
// answers an error (those sections read null), and the gap resolver answers per `mode`.
const SCRIPTS = resolve(import.meta.dir, "..", "..", "scripts", "substrate");
const RUN = join(ROOT, "run");
mkdirSync(RUN);
cpSync(join(SCRIPTS, "autonomy-metrics.ts"), join(RUN, "autonomy-metrics.ts"));
cpSync(join(SCRIPTS, "autonomy-landings.ts"), join(RUN, "autonomy-landings.ts"));
let mode: "ok" | "whole-fails-200" = "ok";
const ROWS = [...STORE.values()];
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/sql") return Response.json([{ status: "ERR", result: "stub" }]);
    if (url.pathname === "/v2/impulses/resolve") {
      const p = ((await req.json()) as { impulse: Record<string, unknown> }).impulse;
      if (p.type !== "substrateGap") return Response.json({ success: true, shape: String(p.type), body: {} });
      // A forwarded read that timed out upstream: HTTP 200, success:false, no gaps.
      if (mode === "whole-fails-200" && Number(p.limit) > 200) return Response.json({ success: false, error: "upstream timeout" });
      return Response.json({ success: true, shape: "substrateGap", body: { gaps: ROWS, total: ROWS.length } });
    }
    return new Response("not found", { status: 404 });
  },
});
afterAll(() => server.stop(true));

async function runMetrics(workspaceRoot: string, runDir = RUN): Promise<any> {
  const out = join(ROOT, `metrics-${Math.random().toString(36).slice(2)}`, "autonomy-metrics.jsonl");
  const base = `http://127.0.0.1:${server.port}`;
  const p = Bun.spawn([process.execPath, join(runDir, "autonomy-metrics.ts")], {
    cwd: ROOT, stdout: "pipe", stderr: "pipe",
    env: { ...ENV, WORKSPACE_ROOT: workspaceRoot, METRICS_OUT: out, SURREALDB_URL: base, METABOB_ENDPOINT: base, DEV_VESSEL_ENDPOINT: base },
  });
  const [code, err] = await Promise.all([p.exited, new Response(p.stderr).text()]);
  if (code !== 0) throw new Error(`autonomy-metrics exited ${code}: ${err.slice(-400)}`);
  const lines = readFileSync(out, "utf8").trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!);
}

describe("autonomy-metrics.ts, run from a run dir", () => {
  it("reads the repos under WORKSPACE_ROOT: the tally and the legacy count are live", async () => {
    mode = "ok";
    const r = await runMetrics(WS);
    const l = r.self_alteration.landings;
    expect([l.landed, l.check_supplied, l.commits, l.gap_store_read]).toEqual([1, 1, 3, true]);
    expect(l.repos_unreadable).not.toContain("activity-api");
    expect(r.self_alteration.landed_cutovers_total).toBe(4);
    expect(r.self_alteration.landed_cutovers_repos_unreadable).not.toContain("activity-api");
    expect(r.gaps.total).toBe(ROWS.length);
    expect(r.gaps.basis).toStartWith("whole store");
  }, 60_000);

  it("an HTTP 200 with success:false is a failed whole-store read: the page fallback, total null", async () => {
    mode = "whole-fails-200";
    const r = await runMetrics(WS);
    expect(r.gaps.total).toBeNull();
    expect(r.gaps.basis).toStartWith("200-row page");
    expect(r.self_alteration.landings.gap_store_read).toBe(false);
  }, 60_000);

  it("must-fail: a failed gap read leaves every count that needs a gap row null, never 0", async () => {
    // whole-fails-200 takes the page fallback, so no row map is built (gap_store_read false). Without rows
    // every fix would read fix_only_unverified and landed 0: a false zero. The git-only counts stay live.
    mode = "whole-fails-200";
    const r = await runMetrics(WS);
    const l = r.self_alteration.landings;
    expect(l.gap_store_read).toBe(false);
    expect([l.landed, l.landed_partial, l.reopened, l.reverted, l.fix_only_unverified, l.landed_24h]).toEqual([null, null, null, null, null, null]);
    expect([l.landed_system, l.landed_operator, l.landed_source_unknown, l.landed_directed]).toEqual([null, null, null, null]);
    expect([l.commits, l.check_supplied, l.families_total]).toEqual([3, 1, 2]);
    // a fix family's status needs its row; a check-only family's does not
    expect(l.families.map((f: any) => [f.gap, f.status]).sort()).toEqual([["gap-alpha", null], ["gap-beta", "check_supplied"]]);
  }, 60_000);

  it("a blank WORKSPACE_ROOT is unset: run from a checkout, the repos are read relative to the script", async () => {
    const inTree = join(WS, "scripts", "substrate");
    mkdirSync(inTree, { recursive: true });
    for (const f of ["autonomy-metrics.ts", "autonomy-landings.ts"]) cpSync(join(SCRIPTS, f), join(inTree, f));
    mode = "ok";
    expect((await runMetrics(" ", inTree)).self_alteration.landings.landed).toBe(1);
  }, 60_000);

  it("no readable repo: every count is null and every repo is named, never zero", async () => {
    mode = "ok";
    const empty = join(ROOT, "empty-ws");
    mkdirSync(empty);
    const r = await runMetrics(empty);
    const l = r.self_alteration.landings;
    expect(l.landed).toBeNull();
    expect(l.commits).toBeNull();
    expect(l.repos_unreadable.length).toBe(14);
    expect(r.self_alteration.landed_cutovers_total).toBeNull();
    expect(r.self_alteration.landed_cutovers_repos_unreadable.length).toBe(14);
  }, 60_000);
});
