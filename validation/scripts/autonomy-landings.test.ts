// The landing tally autonomy-metrics.ts reports (scripts/substrate/autonomy-landings.ts), against a
// fixture git repo: one landing per gap family whose fix is on origin/dev and whose own gap closed
// landed_verified. The legacy count (`git log --all --grep`, per commit, every ref) is the control.
import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const REPO = join(ROOT, "vessel");
mkdirSync(REPO);
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
    const rows = new Map<string, GapRow>([["child-x", { id: "child-x", classification_metadata: { parent_gap_id: "root-y" } }]]);
    expect(familyKey("child-x", (id) => rows.get(id) ?? null)).toBe("root-y");
    expect(familyKey("root-y-narrowed", () => null)).toBe("root-y");
  });

  it("landed_partial, reopened, other close reasons and check-only are not landed", () => {
    const rows = new Map<string, GapRow>([
      ["p", { id: "p", status: "closed", classification_metadata: { closed_reason: "landed_partial" } }],
      ["r", { id: "r", status: "open", classification_metadata: { reopen_count: 1 } }],
      ["l", { id: "l", status: "closed", closed_reason: "landed_literal_only" }],
      ["k", { id: "k", status: "closed", classification_metadata: { closed_reason: "landed_verified" } }],
    ]);
    const c = landingTally([commit("p", ["src/a.ts"]), commit("r", ["src/b.ts"]), commit("l", ["src/c.ts"]), commit("k", ["test/k.test.ts"])], (id) => rows.get(id) ?? null, Date.now());
    expect([c.landed, c.landed_partial, c.reopened, c.fix_only_unverified, c.check_supplied]).toEqual([0, 1, 1, 1, 1]);
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
