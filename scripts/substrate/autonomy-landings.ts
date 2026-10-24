/**
 * autonomy-landings.ts — the self-alteration landing tally autonomy-metrics.ts reports.
 *
 * WHY THIS EXISTS. autonomy-metrics counted `git log --all --grep="substrate-authored: apply"`
 * per COMMIT across EVERY ref. That number is not landings: --all includes local branches that
 * never reached origin/dev, a gap that took a check commit, a fix and two recommits counts four
 * times, and a check-only commit (the test that should go red, no fix) counts the same as a fix.
 * Many such commits are check-only, and few carry a fix whose gap closed landed_verified.
 *
 * The tally here counts ONE landing per GAP FAMILY whose fix commit is on origin/dev AND whose
 * gap's own check closed it (closed_reason landed_verified, the closure evidence the verifier
 * writes on the gap row). Everything else is reported under its own name, never as landed.
 *
 * A fix commit that a later origin/dev commit reverts is never landed, whatever its gap row says.
 * Landed families are split by who filed the gap (system or operator, from the store's `source`),
 * because only a system-filed gap that lands is a landing with no operator in it.
 *
 * The IO is split from the counting so the counting can be tested against a fixture:
 *   readLandingCommits(repoDir) — git, read-only, origin/dev only
 *   landingTally(commits, gapOf, nowMs) — pure
 */

export type LandingCommit = { repo: string; sha: string; committed_ms: number; body: string; files: string[]; reverted_by?: string };
export type RevertCommit = { sha: string; committed_ms: number; subject: string; refs: string[] };
export type GapRow = Record<string, unknown>;
export type CommitClass = "check" | "fix" | "empty";
export type FamilyStatus = "landed" | "landed_partial" | "reopened" | "reverted" | "fix_only_unverified" | "check_supplied";
export type FamilySource = "system" | "operator" | "unknown";
export type FamilyClass = "check+fix" | "fix_only" | "check_only";
export type FamilyEntry = { gap: string; class: FamilyClass; status: FamilyStatus; source: FamilySource; commits: number; last_ms: number };

export const LANDING_GREP = "substrate-authored: apply";

/**
 * Commits reachable from origin/dev carrying the landing subject, with their bodies and touched
 * paths. origin/dev, never --all: a commit on a local branch has not landed anywhere.
 * Returns null (not []) when the repo or its origin/dev ref cannot be read, so a dark repo reads
 * as unknown rather than as zero landings.
 */
export async function readLandingCommits(repoDir: string, repo: string): Promise<LandingCommit[] | null> {
  try {
    const ref = Bun.spawn(["git", "-C", repoDir, "rev-parse", "--verify", "-q", "origin/dev"], { stdout: "pipe", stderr: "pipe" });
    await new Response(ref.stdout).text();
    if ((await ref.exited) !== 0) return null;
    const p = Bun.spawn(["git", "-C", repoDir, "log", "origin/dev", `--grep=${LANDING_GREP}`, "--no-renames", "--name-only", "--format=%x1e%H%x1f%ct%x1f%B%x1d"], { stdout: "pipe", stderr: "pipe" });
    const out = await new Response(p.stdout).text();
    if ((await p.exited) !== 0) return null;
    // Every origin/dev commit that mentions a revert; parseRevertLog keeps the ones that name what they revert.
    const r = Bun.spawn(["git", "-C", repoDir, "log", "origin/dev", "-i", "--grep=revert", "--format=%x1e%H%x1f%ct%x1f%B"], { stdout: "pipe", stderr: "pipe" });
    const rout = await new Response(r.stdout).text();
    if ((await r.exited) !== 0) return null;
    return markReverted(parseLandingLog(repo, out), parseRevertLog(rout));
  } catch { return null; }
}

/** Parse readLandingCommits' git output: records split by \x1e, header/files by \x1d. */
export function parseLandingLog(repo: string, out: string): LandingCommit[] {
  const commits: LandingCommit[] = [];
  for (const rec of out.split("\x1e")) {
    if (!rec.trim()) continue;
    const [head = "", tail = ""] = rec.split("\x1d");
    const [sha = "", ct = "", body = ""] = head.split("\x1f");
    if (!sha) continue;
    // --grep matches anywhere in the message; a landing is a commit whose SUBJECT is the cutover.
    if (!body.trimStart().startsWith(LANDING_GREP)) continue;
    const files = tail.split("\n").map((f) => f.trim()).filter(Boolean);
    commits.push({ repo, sha, committed_ms: Number(ct) * 1000, body, files });
  }
  return commits;
}

const subjectOf = (body: string): string => (body.trimStart().split("\n")[0] ?? "").trim();

/**
 * Revert commits from `git log --format=%x1e%H%x1f%ct%x1f%B`. A revert names what it reverts by sha
 * ("This reverts commit <sha>.", or "reverts <short sha>" in an amended message, as development-vessel's
 * shaWasRevertedInAnyClone matches) or, with no sha, by a `Revert "<subject>"` subject.
 */
export function parseRevertLog(out: string): RevertCommit[] {
  const reverts: RevertCommit[] = [];
  for (const rec of out.split("\x1e")) {
    const [sha = "", ct = "", body = ""] = rec.split("\x1f");
    if (!sha.trim()) continue;
    const refs = [...body.matchAll(/\breverts\s+(?:[\w-]+\s+){0,4}?(?:commit\s+)?([0-9a-f]{7,40})\b/gi)].map((m) => m[1]!.toLowerCase());
    const subject = subjectOf(body);
    if (refs.length === 0 && !/^Revert ".+"$/.test(subject)) continue;
    reverts.push({ sha: sha.trim(), committed_ms: Number(ct) * 1000, subject, refs });
  }
  return reverts;
}

/**
 * Stamp reverted_by on each landing commit a revert on origin/dev undoes. A revert that is itself
 * reverted undoes nothing. A subject-only revert names the latest earlier commit with that subject.
 */
export function markReverted(commits: LandingCommit[], reverts: RevertCommit[]): LandingCommit[] {
  const all = [...commits.map((c) => ({ sha: c.sha, committed_ms: c.committed_ms, subject: subjectOf(c.body) })), ...reverts];
  const targetsOf = (r: RevertCommit): string[] => {
    if (r.refs.length) return all.filter((x) => x.sha !== r.sha && r.refs.some((ref) => x.sha.toLowerCase().startsWith(ref))).map((x) => x.sha);
    const named = all.filter((x) => x.sha !== r.sha && x.committed_ms <= r.committed_ms && `Revert "${x.subject}"` === r.subject);
    named.sort((x, y) => y.committed_ms - x.committed_ms);
    return named.length ? [named[0]!.sha] : [];
  };
  const targets = new Map(reverts.map((r) => [r.sha, targetsOf(r)]));
  const memo = new Map<string, boolean>();
  const effective = (r: RevertCommit): boolean => {
    const known = memo.get(r.sha);
    if (known !== undefined) return known;
    memo.set(r.sha, true); // a cycle (not possible in real history) reads as effective
    const v = !reverts.some((o) => o.sha !== r.sha && targets.get(o.sha)!.includes(r.sha) && effective(o));
    memo.set(r.sha, v);
    return v;
  };
  const by = new Map<string, string>();
  for (const r of reverts) if (effective(r)) for (const t of targets.get(r.sha)!) if (!by.has(t)) by.set(t, r.sha);
  return commits.map((c) => (by.has(c.sha) ? { ...c, reverted_by: by.get(c.sha)! } : c));
}

/** A path that only supplies a check: test/**, *.test.*, *.check.ts, *.check.sh. */
export function isCheckPath(f: string): boolean {
  return /(^|\/)test\//.test(f) || /\.test\.[cm]?[jt]sx?$/.test(f) || /\.check\.(ts|sh)$/.test(f);
}

/** check = touches only test paths; fix = touches any non-test path; empty = touches nothing (merge). */
export function classifyCommit(files: string[]): CommitClass {
  if (files.length === 0) return "empty";
  return files.every(isCheckPath) ? "check" : "fix";
}

/** The last value of a body trailer (`Gap: <id>`), or "" when absent. */
export function trailer(body: string, key: string): string {
  const m = [...body.matchAll(new RegExp(`^${key}:[ \\t]*(\\S.*)$`, "gm"))];
  return m.length ? m[m.length - 1]![1]!.trim() : "";
}

/**
 * A gap id's lineage stem, by id alone: a `recommit-` layer drops the prefix and one trailing
 * failure-class token, and -narrowed / -step-N / -cN suffixes are stripped, applied to a fixed
 * point so a layer exposed by stripping another is stripped too (`recommit-x-cls-narrowed` →
 * `recommit-x-cls` → `x`). Modelled on development-vessel's gapLineageStem (judge/gap-policy.ts,
 * over gapLineageRoot in resolvers/staged-mitosis-gate.ts) but NOT the same rule: the vessel strips
 * every recommit- layer and its class token first and the suffixes after, once, so it reads that
 * id as `x-cls`. Replicated, not imported: this script runs from the super-repo, not the vessel.
 */
export function gapLineageStem(id: string): string {
  let s = String(id ?? "").trim();
  for (let prev = ""; prev !== s;) {
    prev = s;
    s = s.replace(/-(?:narrowed|step-\d+|c\d+)$/, "");
    if (s.startsWith("recommit-")) s = s.slice("recommit-".length).replace(/-[a-z][a-z0-9_]*$/, "");
  }
  return s;
}

const metaOf = (row: GapRow | null | undefined): Record<string, unknown> => {
  const m = (row?.classification_metadata ?? row?.metadata ?? {}) as unknown;
  return m && typeof m === "object" ? (m as Record<string, unknown>) : {};
};
const field = (row: GapRow | null | undefined, k: string): string => {
  const v = metaOf(row)[k] ?? row?.[k];
  return typeof v === "string" ? v.trim() : "";
};

/**
 * The family a gap belongs to, and the rows read on the way. The gap store's own links come first:
 * root_gap_id, else parent_gap_id (narrowing), else source_gap_id (recommit), on the row or in its
 * metadata, walked up while rows exist. The id the walk ends on is then stemmed, which is a no-op for
 * a true root and the whole answer when the store holds no row or no link. A stem that differs
 * is walked again: the stem's own row may carry a link of its own.
 */
export function gapWalk(gapId: string, gapOf: (id: string) => GapRow | null): { key: string; rows: GapRow[] } {
  let id = gapId;
  const seen = new Set<string>();
  const rows: GapRow[] = [];
  for (let depth = 0; depth < 16 && id && !seen.has(id); depth++) {
    seen.add(id);
    const row = gapOf(id);
    if (row) rows.push(row);
    const up = row ? (field(row, "root_gap_id") || field(row, "parent_gap_id") || field(row, "source_gap_id")) : "";
    const next = up && up !== id ? up : gapLineageStem(id);
    if (next === id) break;
    id = next;
  }
  return { key: id, rows };
}
export function familyKey(gapId: string, gapOf: (id: string) => GapRow | null): string {
  return gapWalk(gapId, gapOf).key;
}

/**
 * Who filed a family: operator when any row on its walk is human_reported (source or category, as
 * development-vessel's gapClassOf reads it), system when the rows carry any other source, unknown
 * with no row. Any row, not the commit's own: feature_compose files a recommit child of an operator
 * gap as substrate_detected, and that child's landing is still the operator's gap landing.
 */
export function familySource(rows: GapRow[]): FamilySource {
  if (rows.some((r) => String(r.source ?? "") === "human_reported" || String(r.category ?? "") === "human_reported")) return "operator";
  return rows.some((r) => String(r.source ?? "").trim()) ? "system" : "unknown";
}
const isDirected = (rows: GapRow[]): boolean => rows.some((r) => metaOf(r).directed === true);

/** The gap a commit names: its Gap trailer, else its Proposal trailer / subject without -compose-report. */
export function commitGapId(c: LandingCommit): string {
  const gap = trailer(c.body, "Gap");
  if (gap) return gap;
  const proposal = trailer(c.body, "Proposal") || (c.body.match(/^substrate-authored: apply (\S+)/)?.[1] ?? "");
  return proposal.replace(/-compose-report$/, "") || c.sha;
}

/**
 * What one fix commit's own gap row says about it. Only landed_verified is a landing: that is
 * the gap's own check green under the checker. landed_partial (landed under a semantic dissent)
 * is not; landed_literal_only and any other close reason (persistent_compose_failure, …) are a fix
 * that no check verified. An open row that was closed before (reopen_count / reopened_at) is a
 * landing that did not hold.
 */
function fixStatus(row: GapRow | null): Exclude<FamilyStatus, "check_supplied"> {
  if (!row) return "fix_only_unverified";
  const status = String(row.status ?? "");
  const reason = field(row, "closed_reason");
  if (status === "closed" && reason === "landed_verified") return "landed";
  if (status === "closed" && reason === "landed_partial") return "landed_partial";
  const reopens = Number(metaOf(row).reopen_count ?? row.reopen_count ?? 0);
  if (status === "reopened") return "reopened";
  if (status === "open" && ((Number.isFinite(reopens) && reopens > 0) || field(row, "reopened_at"))) return "reopened";
  return "fix_only_unverified";
}
const RANK: Record<Exclude<FamilyStatus, "check_supplied">, number> = { landed: 0, landed_partial: 1, reopened: 2, reverted: 3, fix_only_unverified: 4 };

export type LandingTally = {
  commits: number;
  landed: number; landed_partial: number; check_supplied: number; reopened: number; reverted: number; fix_only_unverified: number;
  /** landed split by who filed the gap; the three sum to landed. landed_directed: landed whose gap the operator directed into the lane. */
  landed_system: number; landed_operator: number; landed_source_unknown: number; landed_directed: number;
  landed_24h: number;
  families: FamilyEntry[];
};

/**
 * One entry per gap family over the given origin/dev landing commits. Pure. A fix commit stamped
 * reverted_by reads reverted, never landed; a later fix of the same family can still land it.
 * landed_24h counts the landed families whose landed_verified fix commit was COMMITTED in the 24h
 * before nowMs (commit time, not the time the gap was closed).
 */
export function landingTally(commits: LandingCommit[], gapOf: (id: string) => GapRow | null, nowMs: number): LandingTally {
  type Acc = { checks: number; fixes: number; status: Exclude<FamilyStatus, "check_supplied"> | null; landed_ms: number; commits: number; last_ms: number; rows: GapRow[] };
  const fam = new Map<string, Acc>();
  for (const c of commits) {
    const gapId = commitGapId(c);
    const walk = gapWalk(gapId, gapOf);
    const key = walk.key;
    const a = fam.get(key) ?? { checks: 0, fixes: 0, status: null, landed_ms: 0, commits: 0, last_ms: 0, rows: [] };
    a.rows.push(...walk.rows);
    a.commits++;
    a.last_ms = Math.max(a.last_ms, c.committed_ms);
    const cls = classifyCommit(c.files);
    if (cls === "check") a.checks++;
    if (cls === "fix") {
      a.fixes++;
      const s = c.reverted_by ? "reverted" : fixStatus(gapOf(gapId));
      if (a.status === null || RANK[s] < RANK[a.status]) a.status = s;
      if (s === "landed") a.landed_ms = Math.max(a.landed_ms, c.committed_ms);
    }
    fam.set(key, a);
  }
  const out: LandingTally = {
    commits: commits.length, landed: 0, landed_partial: 0, check_supplied: 0, reopened: 0, reverted: 0, fix_only_unverified: 0,
    landed_system: 0, landed_operator: 0, landed_source_unknown: 0, landed_directed: 0, landed_24h: 0, families: [],
  };
  for (const [gap, a] of fam) {
    const status: FamilyStatus = a.fixes === 0 ? "check_supplied" : (a.status ?? "fix_only_unverified");
    const source = familySource(a.rows);
    out[status]++;
    if (status === "landed") {
      out[source === "unknown" ? "landed_source_unknown" : source === "operator" ? "landed_operator" : "landed_system"]++;
      if (isDirected(a.rows)) out.landed_directed++;
      if (nowMs - a.landed_ms <= 24 * 3600_000) out.landed_24h++;
    }
    out.families.push({ gap, class: a.fixes === 0 ? "check_only" : a.checks > 0 ? "check+fix" : "fix_only", status, source, commits: a.commits, last_ms: a.last_ms });
  }
  out.families.sort((x, y) => y.last_ms - x.last_ms);
  return out;
}
