#!/usr/bin/env bun
/**
 * validate-build.ts — preflight gate for substrate-container build validity.
 *
 * Why this exists
 * ---------------
 * The substrate image (`Dockerfile.substrate`) builds each vessel with an
 * independent `COPY repos/<vessel>/package.json` + `bun install`. Several vessels
 * depend on sibling packages via relative `file:` paths
 * (`file:../ias-executor-ts`, `file:../../packages/vessel-discovery-client`),
 * and the Dockerfile rewrites those paths to absolute `/vessels/...` paths with
 * per-stanza `sed`. The namespace migration (dropping `metabob` from package
 * names / dirs, moving shared libs to `@avigopal/*`) can silently break this in
 * ways a normal `bun install` on the host does NOT surface:
 *
 *   1. Renaming a dependency KEY without regenerating bun.lock → the four
 *      `bun install --frozen-lockfile` stanzas ABORT the image build.
 *   2. Renaming a package DIRECTORY → the path-based `file:` deps dangle and the
 *      Dockerfile `sed` rewrites silently no-op (they match on the old literal).
 *   3. Import specifier (`from '@scope/x'`) drifting from the dependency key.
 *
 * This script reproduces those container invariants on the host in <1s, so the
 * breakage is caught before `make build` (or a vessel `systemctl restart`) hits
 * it. It is a fast preflight; the fully-faithful check remains `make build`.
 *
 * Usage:  bun scripts/substrate/validate-build.ts [--json]
 * Exit:   0 = all containerized vessels build-valid; 1 = at least one error.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

// Is <file> committed (tracked) in the git repo at <dir>? The Docker build context
// for a cloned/CI checkout only contains committed files, so a lockfile that is
// merely present on disk (untracked / gitignored) silently disappears on a fresh
// clone — exactly the discovery-vessel case that a dirty dev tree masks. Fall back
// to on-disk presence when <dir> is not its own git checkout.
function isTracked(dir: string, file: string): boolean {
  try {
    const out = execSync(`git -C "${dir}" ls-files -- "${file}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim().length > 0;
  } catch {
    return existsSync(join(dir, file));
  }
}

const REPO_ROOT = resolve(import.meta.dir, "../..");
const DOCKERFILE = join(REPO_ROOT, "Dockerfile.substrate");
const JSON_OUT = process.argv.includes("--json");

type Finding = { vessel: string; level: "error" | "warn"; msg: string };
const findings: Finding[] = [];
const err = (vessel: string, msg: string) => findings.push({ vessel, level: "error", msg });
const warn = (vessel: string, msg: string) => findings.push({ vessel, level: "warn", msg });

const dockerfile = readFileSync(DOCKERFILE, "utf8");
const dfLines = dockerfile.split("\n");

// --- derive, from the Dockerfile, the set of containerized vessels + their build flags ---
// A vessel is "containerized" iff the Dockerfile does `COPY repos/<v>/package.json ... ./<v>/`.
const containerized = new Map<string, { frozen: boolean; seds: Array<[string, string]> }>();
for (let i = 0; i < dfLines.length; i++) {
  const m = dfLines[i].match(/^COPY repos\/([a-z0-9-]+)\/package\.json/);
  if (!m) continue;
  const vessel = m[1];
  // Scan the stanza (until the next COPY repos/ line) for the install command + seds.
  let frozen = false;
  const seds: Array<[string, string]> = [];
  for (let j = i + 1; j < dfLines.length && !/^COPY repos\//.test(dfLines[j]); j++) {
    if (/bun install/.test(dfLines[j]) && /frozen-lockfile/.test(dfLines[j])) frozen = true;
    const s = dfLines[j].match(/sed -i 's\|file:([^|]+)\|file:([^|]+)\|g'/);
    if (s) seds.push([s[1], s[2]]);
  }
  containerized.set(vessel, { frozen, seds });
}

// --- per-vessel checks ---
const importSpecRe = /(?:from|import|require\()\s*['"]((?:@[a-z0-9-]+\/)?[a-z0-9-]+(?:\/[^'"]*)?)['"]/g;

for (const [vessel, { frozen, seds }] of containerized) {
  const vDir = join(REPO_ROOT, "repos", vessel);
  const pkgPath = join(vDir, "package.json");
  if (!existsSync(pkgPath)) { err(vessel, `package.json missing at repos/${vessel}/`); continue; }
  let pkg: any;
  try { pkg = JSON.parse(readFileSync(pkgPath, "utf8")); }
  catch (e) { err(vessel, `package.json is not valid JSON: ${String(e).split("\n")[0]}`); continue; }

  const deps: Record<string, string> = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const depKeys = new Set(Object.keys(deps));

  // (1) Every file: dep must resolve to a real directory with a package.json — both
  //     as the host sees it (relative to the vessel dir) AND as the container will
  //     see it after the Dockerfile sed rewrite.
  for (const [key, spec] of Object.entries(deps)) {
    if (!spec.startsWith("file:")) continue;
    const rel = spec.slice("file:".length);
    const hostTarget = resolve(vDir, rel);
    if (!existsSync(join(hostTarget, "package.json"))) {
      err(vessel, `file: dep "${key}" → "${spec}" does not resolve to a package on the host (looked at ${hostTarget})`);
    }
    // Container view: apply the matching Dockerfile sed, if any.
    const sed = seds.find(([from]) => from === rel);
    if (rel.startsWith("../") && !sed) {
      // Relative path leaks into the container. It is only valid if the same
      // relative resolution lands inside /vessels. /vessels/<v>/../x → /vessels/x (ok);
      // /vessels/<v>/../../packages/x → /packages/x (NOT ok — packages live at /vessels/packages).
      const containerResolved = resolve(`/vessels/${vessel}`, rel);
      if (!containerResolved.startsWith("/vessels/")) {
        err(vessel, `file: dep "${key}" uses "${spec}" but has NO Dockerfile sed rewrite; in-container it resolves to "${containerResolved}" (outside /vessels). Add a sed for this stanza.`);
      }
    }
    if (sed) {
      const [, to] = sed;
      // The sed target is an absolute container path we cannot stat on the host,
      // but we can assert it points under /vessels and the host source exists.
      if (!to.startsWith("/vessels/")) warn(vessel, `sed rewrites "${rel}" to "${to}" which is not under /vessels`);
    }
  }

  // (1b) Every Dockerfile sed for this vessel must still MATCH a path present in
  //      package.json. A directory rename leaves a dead sed that silently no-ops.
  for (const [from] of seds) {
    const present = Object.values(deps).some((v) => v === `file:${from}`);
    if (!present) {
      err(vessel, `Dockerfile sed rewrites "file:${from}" but no dependency uses that path anymore — dead rewrite (likely a renamed dir). The relative path will leak into the container.`);
    }
  }

  // (2) Frozen-lockfile vessels: every dependency key must appear in bun.lock,
  //     else `bun install --frozen-lockfile` aborts the image build.
  if (frozen) {
    const lockPath = join(vDir, "bun.lock");
    const lockCommitted = isTracked(vDir, "bun.lock");
    if (!lockCommitted) {
      // Either truly absent, or present-on-disk-but-untracked (gitignored). Both
      // mean a fresh clone has no lockfile and `bun install --frozen-lockfile`
      // aborts the image build — even though a dirty dev tree builds fine.
      err(
        vessel,
        existsSync(lockPath)
          ? `installed with --frozen-lockfile and bun.lock exists on disk but is NOT committed in repos/${vessel} (check its .gitignore). A fresh clone / CI build has no lockfile and the image build aborts. Commit bun.lock (and drop any bun.lock entry from .gitignore).`
          : `installed with --frozen-lockfile but bun.lock is missing`,
      );
    } else if (existsSync(lockPath)) {
      const lock = readFileSync(lockPath, "utf8");
      for (const key of depKeys) {
        if (!lock.includes(`"${key}"`)) {
          err(vessel, `--frozen-lockfile: dependency "${key}" is not in bun.lock — rename/regenerate desynced; the image build WILL fail. Run \`bun install\` in repos/${vessel} and commit bun.lock.`);
        }
      }
    }
  }

  // (3) Every scoped import specifier in src/ must map to a declared dependency key.
  const srcDir = join(vDir, "src");
  if (existsSync(srcDir)) {
    const files = [...new Bun.Glob("**/*.ts").scanSync({ cwd: srcDir })];
    const seen = new Set<string>();
    for (const f of files) {
      const txt = readFileSync(join(srcDir, f), "utf8");
      for (const mm of txt.matchAll(importSpecRe)) {
        const spec = mm[1];
        if (!spec.startsWith("@")) continue; // only scoped sibling-pkg imports
        const pkgName = spec.split("/").slice(0, 2).join("/");
        if (seen.has(pkgName)) continue;
        seen.add(pkgName);
        // A package may import its own name (self-reference) — always valid.
        if (pkgName === pkg.name) continue;
        // Ignore well-known external scopes that are real npm deps.
        if (depKeys.has(pkgName)) continue;
        if (pkgName.startsWith("@types/")) continue;
        // Only flag intra-repo scopes we own (@metabob / @avigopal) to avoid noise.
        if (/^@(metabob|avigopal)\//.test(pkgName)) {
          err(vessel, `imports "${pkgName}" but it is not a dependency key in package.json (import↔dep drift)`);
        }
      }
    }
  }
}

// --- reproducibility: would a fresh `clone --recursive` build THIS source? ---
// The Docker build context is the super-repo working tree, so `COPY repos/<v>/src`
// ships whatever each submodule happens to have checked out right now. A fresh
// clone instead checks out the SHA the super-repo RECORDS. When those disagree,
// the image built here is not the image git describes.
//
// This is the same trap as the untracked-lockfile check above, one level up: a
// dirty dev tree masks what a clean checkout would produce. It is not theoretical
// — on 2026-08-09 the recorded pointers were 30 commits behind six vessels whose
// work was pushed, so `clone --recursive && make up` built a substrate missing the
// mitosis test-delta fix and the pathless-goal resolution, with no signal anywhere.
//
// Drift is legitimate mid-change (you commit the vessel before bumping the
// pointer), so these WARN by default and only fail under --strict-repro, which
// release and CI builds should set.
const STRICT_REPRO = process.argv.includes("--strict-repro");
const repro = STRICT_REPRO ? err : warn;

function git(dir: string, args: string): string | null {
  try {
    return execSync(`git -C "${dir}" ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null; // not a checkout, or git unavailable — callers treat null as "cannot tell"
  }
}

// Recorded pointers, one call for the whole tree: "<mode> commit <sha>\trepos/<v>".
const recordedPointers = new Map<string, string>();
for (const line of (git(REPO_ROOT, "ls-tree HEAD repos/") ?? "").split("\n")) {
  const m = line.match(/^\S+\s+commit\s+([0-9a-f]{40})\s+repos\/(\S+)$/);
  if (m) recordedPointers.set(m[2], m[1]);
}

if (recordedPointers.size === 0) {
  warn("(super-repo)", "could not read submodule pointers via git ls-tree — reproducibility unchecked");
} else {
  for (const [vessel] of containerized) {
    const vDir = join(REPO_ROOT, "repos", vessel);
    const recorded = recordedPointers.get(vessel);
    const head = git(vDir, "rev-parse HEAD");
    if (!recorded || !head) continue; // vendored in-tree, not a submodule — nothing to compare

    // (a) checkout vs recorded pointer. Direction matters for the remedy: ahead
    //     means the pointer needs bumping, behind means the checkout is stale and
    //     a clone would ship NEWER code than this build. A bare count reads as
    //     "+0" for the behind case, which is why this spells the direction out.
    if (head !== recorded) {
      const ahead = Number(git(vDir, `rev-list --count ${recorded}..HEAD`) ?? "-1");
      const behind = Number(git(vDir, `rev-list --count HEAD..${recorded}`) ?? "-1");
      const where =
        ahead > 0 && behind > 0
          ? `diverged (${ahead} ahead, ${behind} behind)`
          : ahead > 0
            ? `${ahead} commit(s) AHEAD of the pointer — the pointer needs bumping`
            : behind > 0
              ? `${behind} commit(s) BEHIND the pointer — a fresh clone ships NEWER code than this build`
              : "differs";
      const remedy =
        behind > 0 && ahead === 0
          ? `git submodule update --init repos/${vessel}`
          : `git add repos/${vessel} && git commit`;
      repro(
        vessel,
        `checkout ${head.slice(0, 8)} != super-repo pointer ${recorded.slice(0, 8)}: ${where}. ` +
          `The image built here ships the checkout; a fresh clone ships the pointer. Remedy: ${remedy}`,
      );
    }

    // (b) the recorded pointer must exist on a remote, or `clone --recursive` fails
    //     outright for everyone except the machine that built it. Remote-tracking
    //     refs can be stale, hence the fetch hint rather than a bare accusation.
    const onRemote = git(vDir, `branch -r --contains ${recorded}`);
    if (onRemote !== null && onRemote === "") {
      repro(
        vessel,
        `super-repo pins ${recorded.slice(0, 8)}, which is on NO remote-tracking branch — ` +
          `\`git clone --recursive\` cannot fetch it. Push the vessel, or run ` +
          `\`git -C repos/${vessel} fetch\` if the refs are just stale.`,
      );
    }

    // (c) uncommitted work never reaches a clone. Untracked files DO enter the
    //     Docker build context (COPY reads the filesystem, not the index), so they
    //     are the more deceptive half: they build here and vanish elsewhere.
    const porcelain = git(vDir, "status --porcelain");
    if (porcelain) {
      const lines = porcelain.split("\n").filter(Boolean);
      const untracked = lines.filter((l) => l.startsWith("??")).length;
      const modified = lines.length - untracked;
      const parts: string[] = [];
      if (modified) parts.push(`${modified} uncommitted change(s)`);
      if (untracked) parts.push(`${untracked} untracked path(s) — these DO enter the build context`);
      repro(vessel, `working tree is dirty: ${parts.join(", ")}. None of it exists in a fresh clone.`);
    }
  }
}

// --- migration progress report (informational) ---
let metabobNames = 0;
for (const [vessel] of containerized) {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "repos", vessel, "package.json"), "utf8"));
  if (/metabob/.test(pkg.name ?? "")) metabobNames++;
}

if (JSON_OUT) {
  console.log(JSON.stringify({ findings, containerizedVessels: [...containerized.keys()], metabobNamesRemaining: metabobNames }, null, 2));
} else {
  const errors = findings.filter((f) => f.level === "error");
  const warns = findings.filter((f) => f.level === "warn");
  console.log(`validate-build: ${containerized.size} containerized vessels checked\n`);
  for (const f of findings) {
    console.log(`  ${f.level === "error" ? "✗" : "⚠"} [${f.vessel}] ${f.msg}`);
  }
  if (!findings.length) console.log("  ✓ all containerized vessels are build-valid (file: deps resolve, lockfiles synced, imports match deps)");
  console.log(`\n  migration: ${metabobNames} containerized vessel(s) still have a 'metabob' package name`);
  console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
}

process.exit(findings.some((f) => f.level === "error") ? 1 : 0);
