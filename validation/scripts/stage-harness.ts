#!/usr/bin/env bun
/**
 * stage-harness.ts — measure each layer between a pathless goal and a landed
 * change INDEPENDENTLY, against known answers.
 *
 * WHY THIS EXISTS. The path from a non-specific goal to a correct landed commit
 * runs through roughly ten layers, and each one was invisible until the layer
 * above it was fixed: intent inference, gate vocabulary, file localisation,
 * declaration-vs-call-site, cross-file symbols, anchor uniqueness, and the
 * post-draft gates. Measuring that path END TO END (dispatch a goal, see whether
 * a good commit lands) is a single bit of information about a ten-stage chain,
 * costs 10-25 minutes per trial, and is destroyed by an unrelated vessel
 * restart. Thirty such trials produced thirty-two fixes and no clean landing,
 * and NINE of those fixes shipped inert — each typechecked, each passed its own
 * unit tests, and each died only when something executed the real thing against
 * the real tree.
 *
 * So this harness does the opposite: it calls each layer's real production
 * function directly, on inputs drawn from real trials, and asserts the answer
 * that trial established. A layer regression shows up as one failing fixture
 * naming its stage, in seconds, without a dispatch.
 *
 * WHAT IT IS NOT.
 *
 *   - It is NOT a pass/fail gate. Some fixtures are EXPECTED to fail: they
 *     record wrongness that today's code genuinely does not catch (see
 *     `known_open` below). A harness that is all-green on the day it is written
 *     is measuring nothing. The report's headline is the open/closed split, not
 *     a score.
 *   - It does NOT dispatch, and it does NOT mutate. Every stage is a pure call
 *     plus read-only filesystem/git access. It is safe to run against a live
 *     substrate at any time.
 *   - Stage S3 runs a PORT of production's `searchWorkspaceForTerm`, not the
 *     function itself, which lives inside goal-host-vessel's index.ts and cannot
 *     be imported without booting the vessel. The first draft of this harness
 *     used a plain ripgrep instead and was wrong in the two ways that mattered
 *     most — no comment-only filter and no exported-definition collapse, which
 *     are exactly the mechanisms the S3 fixtures exist to measure. The report
 *     carries `production_search_digest`; when it changes, re-check the port
 *     before believing any S3 number.
 *
 * THE TREE IT MEASURES. Localisation answers depend entirely on which tree is
 * searched, and "I verified against the wrong tree all session" is a mistake
 * already made here once. So the report stamps the root, each vessel's HEAD, and
 * whether that HEAD matches the tree the running substrate actually reads
 * (`/workspace/git/vessels/<vessel>` inside the container). A drift is reported
 * loudly instead of silently changing what the fixtures mean.
 *
 * Usage:
 *   bun run validation/scripts/stage-harness.ts [--root <dir>] [--out <report.json>]
 *                                               [--stage S3] [--quiet]
 *
 *   --root    tree containing repos/<vessel>/… (default: the super-repo checkout
 *             this script lives in)
 *   --out     write the JSON report here (default: stdout only)
 *   --stage   run only the named stage(s), comma-separated
 *
 * Exit code is 0 whenever the harness itself ran. A fixture whose result changed
 * from its recorded expectation exits 1 — that is a REGRESSION (or a repair that
 * needs its expectation updated), which is different from a `known_open`
 * fixture failing as recorded.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  isEditIntentGoal,
  goalDemandsLandedEdit,
} from "../../repos/goal-host-vessel/src/goal-intent.ts";
import {
  isPathlessCodeChangeGoal,
  extractSearchTerms,
  wantsCallSitesOf,
  resolvePathlessCodeChangeGoal,
  type FileSearch,
} from "../../repos/goal-host-vessel/src/goal-file-resolution.ts";
import {
  vacuousEditReason,
  nonTerminatingEditReason,
} from "../../repos/development-vessel/src/vacuous-edit.ts";
import {
  symbolsNeedingDeclaration,
  anchorOccurrences,
  uniqueAnchorLines,
} from "../../repos/development-vessel/src/cross-file-symbols.ts";

// ---------------------------------------------------------------------------
// CLI + roots
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const QUIET = process.argv.includes("--quiet");
const HERE = dirname(new URL(import.meta.url).pathname);
const ROOT = resolve(arg("root") ?? join(HERE, "..", ".."));
const REPOS = join(ROOT, "repos");
const OUT = arg("out");
const ONLY = (arg("stage") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const CONTAINER = process.env["SUBSTRATE_CONTAINER"] ?? "substrate-live";

if (!existsSync(REPOS)) {
  console.error(`FATAL: no repos/ under --root ${ROOT}. Point --root at the super-repo checkout.`);
  process.exit(2);
}

function git(repo: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", join(REPOS, repo), ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

/**
 * The HEAD the RUNNING substrate reads, for the same vessel.
 *
 * Not decoration. Every S3 expectation is a statement about a specific tree; if
 * the container's copy has moved, a green S3 says nothing about what the live
 * localiser would do. Absent container -> null, and the report says "unchecked"
 * rather than "matching".
 */
function containerHead(vessel: string): string | null {
  try {
    return execFileSync(
      "docker",
      ["exec", CONTAINER, "git", "-C", `/workspace/git/vessels/${vessel}`, "rev-parse", "--short", "HEAD"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 },
    ).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fixture model
// ---------------------------------------------------------------------------

type Status = "pass" | "regression" | "known_open" | "error";

interface FixtureResult {
  id: string;
  /** What real trial or commit this input came from. Never invented. */
  provenance: string;
  expected: string;
  actual: string;
  /**
   * True when today's code is KNOWN not to handle this and the recorded
   * expectation says so. The fixture still runs — the day the answer changes,
   * the expectation is stale and must be updated deliberately.
   */
  known_open: boolean;
  status: Status;
  note?: string;
}

interface StageReport {
  stage: string;
  title: string;
  measures: string;
  fixtures: FixtureResult[];
}

const stages: StageReport[] = [];

function check(
  into: FixtureResult[],
  id: string,
  provenance: string,
  expected: string,
  produce: () => string,
  opts: { known_open?: boolean; note?: string } = {},
): void {
  let actual: string;
  try {
    actual = produce();
  } catch (err) {
    into.push({
      id, provenance, expected, actual: `<threw: ${(err as Error).message.slice(0, 200)}>`,
      known_open: opts.known_open ?? false, status: "error", note: opts.note,
    });
    return;
  }
  const matched = actual === expected;
  const known_open = opts.known_open ?? false;
  into.push({
    id, provenance, expected, actual, known_open,
    status: matched ? (known_open ? "known_open" : "pass") : "regression",
    note: opts.note,
  });
}

function wanted(stage: string): boolean {
  return ONLY.length === 0 || ONLY.includes(stage);
}

// ---------------------------------------------------------------------------
// S1 — intent. Does a goal that demands a code change read as one?
// ---------------------------------------------------------------------------

if (wanted("S1")) {
  const f: FixtureResult[] = [];
  const yes = (g: string) => String(isEditIntentGoal(g) || goalDemandsLandedEdit(g));

  check(f, "S1.path-bearing", "canonical edit goal shape used by every routed dispatch",
    "true", () => yes("Edit repos/goal-host-vessel/src/index.ts to stop escalating on a BUSY verdict"));

  check(f, "S1.pathless-land", "live hub dispatch, recorded in goal-file-resolution.ts's own docstring",
    "true", () => yes("Write and land the code change, do not just describe it"));

  // TRUE because goalDemandsLandedEdit deliberately delegates to
  // isPathlessCodeChangeGoal rather than requiring a literal path: before
  // 2026-08-11 the landing requirement was bound to the edit-intent ROUTE, so
  // any route that bypassed edit-intent bypassed the guard too. isEditIntentGoal
  // still requires a path (load-bearing for ~12 downstream path extractors) —
  // the OR is what admits a symptom goal here.
  check(f, "S1.symptom-only", "dispatch faac9a39, paraphrased — the goal shape the whole chain exists to serve",
    "true", () => yes("Re-minted templates are failing to merge because the dedup check is too strict. Fix it."));

  check(f, "S1.symptom-only-strict-route", "the same goal against the PATH-requiring predicate alone",
    "false", () => String(isEditIntentGoal("Re-minted templates are failing to merge because the dedup check is too strict. Fix it.")),
    { note: "Pins the division of labour: the landing requirement is goal-bound, the path requirement is route-bound. If this ever returns true, a pathless goal has entered the ~12 path extractors and each will see a null match." });

  // CONTROL. Without this, a predicate that returned true unconditionally would
  // score a perfect S1.
  check(f, "S1.control-question", "control: a pure question must not read as an edit demand",
    "false", () => yes("How many activities has the ribosome extracted this week?"));

  stages.push({
    stage: "S1", title: "Intent — does this goal demand a landed change?",
    measures: "goal-host-vessel/src/goal-intent.ts: isEditIntentGoal, goalDemandsLandedEdit",
    fixtures: f,
  });
}

// ---------------------------------------------------------------------------
// S2 — gate vocabulary. Is a pathless change-goal admitted for restatement?
// ---------------------------------------------------------------------------

if (wanted("S2")) {
  const f: FixtureResult[] = [];
  const adm = (g: string) => String(isPathlessCodeChangeGoal(g));

  check(f, "S2.symptom-admitted", "dispatch faac9a39, paraphrased — admitted only after 799ccb3 widened entry vocabulary",
    "true", adm.bind(null, "Re-minted templates are failing to merge because the dedup check is too strict. Fix it."));

  // The predicate is a conjunction: a mutation verb (or normative claim) AND a
  // CODE TARGET noun. A symptom sentence that names only OBSERVABLES —
  // templates, traffic, copies — satisfies the verb half and fails the noun
  // half, so it is declined at the door. Recorded because it is the likeliest
  // way a real human symptom report silently never enters the chain, and
  // because a paraphrase that happens to contain a code noun (above) hides it.
  check(f, "S2.symptom-no-code-noun", "the same defect described purely in observables",
    "false", adm.bind(null, "Re-minted templates are failing to merge and the fleet splits its traffic across the copies. Fix it."),
    { known_open: true, note: "OPEN, and it is law 13 in miniature: the goal works only after someone rewrites it using the vocabulary the code uses. Widening CODE_TARGET is NOT the obvious fix — every widening also admits more prose, and the disqualifiers are what keep report-goals out." });

  check(f, "S2.normative", "the 'should/must' phrasing a human uses instead of an imperative",
    "true", adm.bind(null, "The dedup gate should not treat a template without a numeric suffix as a duplicate."));

  check(f, "S2.already-path-bearing", "a goal naming its file must NOT enter the restatement path",
    "false", adm.bind(null, "Edit repos/development-vessel/src/vacuous-edit.ts to add a diagnostic-only rule"));

  check(f, "S2.control-question", "control: a question is not a change goal",
    "false", adm.bind(null, "Which vessels are currently masked on this spoke?"));

  check(f, "S2.control-nonsense", "control: nonsense must be declined, or every later stage's negative is worthless",
    "false", adm.bind(null, "zzqqxx frobnicate the wibble"));

  stages.push({
    stage: "S2", title: "Vocabulary — is a pathless change-goal admitted?",
    measures: "goal-host-vessel/src/goal-file-resolution.ts: isPathlessCodeChangeGoal",
    fixtures: f,
  });
}

// ---------------------------------------------------------------------------
// S3 — localisation. THE stage that produced every harmful landing.
//
// Each fixture's expectation is the file the TRIAL established as correct, and
// each records the wrong destination the trial actually reached. Note that all
// three misroutes reached the SAME wrong file by three different mechanisms
// (prose phrase, then scraped symbol, then restated target): the destination was
// the attractor, not the route.
// ---------------------------------------------------------------------------

/**
 * A PORT of goal-host-vessel/src/index.ts `searchWorkspaceForTerm`, rooted at
 * this harness's tree instead of `/workspace/git/vessels`.
 *
 * WHY A PORT AND NOT AN IMPORT. That function is defined inside index.ts, which
 * boots a server on import; there is no way to call the real one without running
 * the vessel. The first version of this harness used a plain ripgrep instead,
 * and it was WRONG in the two ways that matter most to these fixtures — it had
 * neither the comment-only filter nor the exported-definition collapse, which
 * are precisely the mechanisms the misroute fixtures exist to measure. A
 * convenient stand-in for the instrument measures the stand-in.
 *
 * A PORT DRIFTS SILENTLY, so `productionSearchDigest()` below records a digest
 * of the real function's source. When it changes, the report says this port may
 * be stale rather than quietly reporting numbers about a function that no longer
 * exists in that form.
 *
 * Deliberately kept identical, including the choices the original documents:
 * grep rather than ripgrep (rg is NOT in the container image), the include list
 * covering every file type the predicate accepts, node_modules excluded, an
 * 8-file cap, fail-open on unreadable files, and `code > 1` distinguishing "the
 * search broke" from "found nothing".
 */
function makeSearch(): FileSearch {
  const run = (args: readonly string[], scope: string, needle: string): readonly string[] => {
    let out: string;
    try {
      out = execFileSync(
        "grep",
        ["-rl", "--include=*.ts", "--include=*.sh", "--include=Makefile",
         "--include=*.mk", "--include=*.service", "--include=*.timer",
         "--exclude=*.test.ts", "--exclude-dir=node_modules", "--exclude-dir=.git",
         "--exclude-dir=dist",
         // DELIBERATE DEVIATION FROM THE ORIGINAL, and the only one.
         //
         // A host checkout accumulates agent worktrees under .claude/worktrees/,
         // each a FULL second copy of the vessel source. Production does not
         // exclude them and does not need to: the container's tree
         // (/workspace/git/vessels) carries only .git/worktrees metadata, which
         // --exclude-dir=.git already covers. Verified 2026-08-11.
         //
         // Without this the harness measures its own host clutter — a term
         // present once in real source reads as three hits and the localiser
         // declines, so a fixture's answer would depend on which agent sessions
         // happened to run here. `worktree_copies_excluded` in the report says
         // how many files this dropped, so the deviation is never silent.
         "--exclude-dir=.claude",
         ...args, scope],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024, timeout: 20_000 },
      );
    } catch (err) {
      const code = (err as { status?: number }).status;
      if (code === 1) return [];        // no match is not an error
      if (code === undefined) throw err; // real failure — never collapse into "found nothing"
      return [];
    }
    const paths = [...new Set(
      out.split("\n").map((l) => l.trim()).filter((l) => l.startsWith(`${REPOS}/`))
        .map((l) => `repos/${l.slice(REPOS.length + 1)}`),
    )].slice(0, 8);

    // A MATCH INSIDE A COMMENT IS NOT EVIDENCE ABOUT CODE. Fail-open per file,
    // and never let the filter turn a found file into "no such file".
    if (!needle) return paths;
    try {
      const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      const inCode: string[] = [];
      for (const rel of paths) {
        try {
          if (strip(readFileSync(join(ROOT, rel), "utf-8")).includes(needle)) inCode.push(rel);
        } catch { inCode.push(rel); }
      }
      return inCode.length > 0 ? inCode : paths;
    } catch { return paths; }
  };

  return async (term: string, vessel?: string, preferCallSites?: boolean): Promise<readonly string[]> => {
    const scope = vessel && /^[a-z][a-z0-9-]+$/.test(vessel) && existsSync(join(REPOS, vessel, "package.json"))
      ? join(REPOS, vessel) : REPOS;
    const t = term.replace(/[.[\]{}()*+?^$|\\]/g, "\\$&");
    const S = "[[:space:]]+";
    const exported = run(["-E", "-e", `export${S}(async${S})?function${S}${t}([^[:alnum:]_]|$)`,
                          "-e", `export${S}(const|let|class|interface|type)${S}${t}([^[:alnum:]_]|$)`, "--"], scope, "");
    if (exported.length === 1 && !preferCallSites) return exported;
    const defined = run(["-E", "-e", `(export${S})?(async${S})?function${S}${t}([^[:alnum:]_]|$)`,
                         "-e", `(export${S})?(const|let|class|interface|type)${S}${t}([^[:alnum:]_]|$)`, "--"], scope, "");
    if (defined.length === 1 && !preferCallSites) return defined;
    return run(["-F", "-e", term, "--"], scope, term);
  };
}

/** Digest of production's searchWorkspaceForTerm, so a stale port is visible. */
function productionSearchDigest(): string {
  try {
    const src = readFileSync(join(REPOS, "goal-host-vessel/src/index.ts"), "utf-8");
    const start = src.indexOf("async function searchWorkspaceForTerm(");
    if (start < 0) return "<function-not-found — the port is certainly stale>";
    const end = src.indexOf("\nasync function handleRunGoal(", start);
    const body = src.slice(start, end > start ? end : start + 8000);
    let h = 0;
    for (let i = 0; i < body.length; i++) h = (Math.imul(h, 31) + body.charCodeAt(i)) | 0;
    return `${(h >>> 0).toString(16)}:${body.length}b`;
  } catch { return "<unreadable>"; }
}

if (wanted("S3")) {
  const f: FixtureResult[] = [];
  const search = makeSearch();
  // The localiser's own tap, captured per fixture. WITHOUT THIS an S3 pass is
  // uninterpretable: "resolved to the right file" and "resolved to the right
  // file FOR THE RIGHT REASON" are different claims, and a paraphrase that
  // introduces a new term can turn the second into the first without anyone
  // noticing. The reason is recorded next to every answer.
  const taps = new Map<string, string[]>();
  const restate = async (id: string, goal: string): Promise<string> => {
    const log: string[] = [];
    taps.set(id, log);
    const r = await resolvePathlessCodeChangeGoal(goal, search, (m) => log.push(m));
    const m = r.match(/repos\/[\w.-]+\/[\w./-]+\.\w+/);
    return m ? m[0] : "<unrestated>";
  };
  const why = (id: string): string => (taps.get(id) ?? []).join(" | ").slice(0, 600) || "<no tap>";

  // Paraphrased to carry a CODE_TARGET noun so it is ADMITTED at S2 — otherwise
  // S3 would report "<unrestated>" for a goal that never reached localisation at
  // all, and a decline at the door reads identically to a decline after search.
  // The phrase under test ("traffic across") is preserved verbatim, because that
  // phrase is the fixture.
  const TRAFFIC = "Re-minted templates are failing to merge, the dedup check is too strict, and the fleet splits its traffic across the copies. Fix it.";
  const DEDUP = "The dedup gate deciding whether a template is a redundant re-mint is too strict; loosen it.";

  await (async () => {
    const a1 = await restate("S3.phrase-misroute", TRAFFIC);
    f.push({
      id: "S3.phrase-misroute",
      provenance: "dispatch faac9a39 — restated onto goal-host/src/index.ts because the goal's own phrase 'traffic across' matched a COMMENT in activity-api; fail-closed gate was not violated (exactly one hit)",
      expected: "repos/activity-api/src/routes/activities.ts",
      actual: a1,
      known_open: false,
      status: a1 === "repos/activity-api/src/routes/activities.ts" ? "pass" : "regression",
      note: why("S3.phrase-misroute") + " || READ THE TAP, NOT THE VERDICT. This resolves correctly because the CODE-NOUN term (\"dedup check\") sorts ahead of the prose phrase and wins outright — the phantom phrase never gets a turn. It is NOT evidence that the comment-match defect is fixed; see S3.phrase-alone, which measures that directly.",
    });

    const a2 = await restate("S3.dedup-misroute", DEDUP);
    f.push({
      id: "S3.dedup-misroute",
      provenance: "dispatch caa57646 — the only symptom goal that reported reached:true; landed a refusal into goal-host's core walk (b222d75), reverted c158bd0",
      expected: "repos/activity-api/src/routes/activities.ts",
      actual: a2,
      known_open: true,
      status: a2 === "repos/activity-api/src/routes/activities.ts" ? "pass" : "known_open",
      note: why("S3.dedup-misroute") + " || Restating onto the wrong file asks every downstream gate the wrong question — all three gates then answered correctly and the composition was still harmful.",
    });

    // THE PHANTOM, MEASURED DIRECTLY.
    //
    // "traffic across" is the goal's own English, and it occurs today only inside
    // comments. But the term that actually decides this goal is the earlier,
    // more specific one — and it lands on a src/seed prompt template, inside a
    // string literal, uniquely. So the goal is restated with full confidence
    // onto a file with no relation to the defect.
    //
    // ★ THAT DISTINCTION IS THE FINDING. The comment filter is fail-open by
    // design — "if the filter would eliminate EVERY hit, the original list is
    // returned unchanged", so a docs-shaped goal still finds its file. But the
    // fail-closed uniqueness gate only ACTS when there is exactly ONE hit, and a
    // single comment-only hit is precisely the case where the filter eliminates
    // every hit and hands back the comment file unchanged. So the filter cannot
    // protect the only case the gate acts on: it helps when a real code hit
    // coexists (narrowing an ambiguous set), which is a different job from the
    // one the phantom-match defect needs done.
    //
    // ★ src/seed/*.ts IS A SYSTEMATIC ATTRACTOR. Those files carry prompt
    // templates: English describing substrate behaviour, in exactly the
    // vocabulary a symptom goal uses. Three independent probes here land on one.
    // The comment filter does not see them because the prose is in string
    // literals, and the uniqueness gate reads a single literal hit as certainty.
    const a5 = await restate("S3.phrase-alone", "The re-mint gate splits its traffic across the copies. Fix it.");
    f.push({
      id: "S3.phrase-alone",
      provenance: "dispatch faac9a39, reduced so the prose phrase is the term that decides — the defect in isolation",
      expected: "<unrestated>", actual: a5, known_open: true,
      status: a5 === "<unrestated>" ? "pass" : "known_open",
      note: why("S3.phrase-alone") + " || OPEN, and it demonstrates the mechanism twice over. This fixture FIRST read as a safe decline — but only because untracked agent worktrees on the host tripled the hit count into ambiguity. With the corpus cleaned to match the container's, the winning term resolves to a UNIQUE hit inside a src/seed prompt template and is restated onto with full confidence. Ambiguity is not a safety property; it is a hit-count accident that any tidying reverses.",
    });

    // PROSE INSIDE A STRING LITERAL IS NOT CODE EITHER — and the filter only
    // strips comments.
    //
    // OBSERVED 2026-08-11 on live hub dispatch f311d8e7, whose goal was ABOUT
    // this very defect. The goal was restated onto
    // development-vessel/src/seed/draft-gap-closing-activity.ts, region
    // "prose-only", because that phrase occurs there — inside a prompt template
    // string, `"prose-only mode."`. The comment filter passed it through as
    // IN-CODE evidence and the uniqueness gate saw exactly one hit, so the
    // restatement was made with full confidence onto a file that has nothing to
    // do with the defect.
    //
    // Prompt-template and seed files are the same hazard as comments, for the
    // same reason: they are English about the system's own behaviour, written in
    // exactly the vocabulary a symptom goal uses. Stripping comments and not
    // string literals covers one of the two prose corpora in this codebase.
    const stripLikeProduction = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const seed = join(REPOS, "development-vessel/src/seed/draft-gap-closing-activity.ts");
    f.push({
      id: "S3.string-literal-prose",
      provenance: "live hub dispatch f311d8e7 — a goal about comment-only matches was itself misrouted by a string-literal match",
      expected: "stripped (prose in a string literal is not code evidence)",
      actual: existsSync(seed)
        ? (stripLikeProduction(readFileSync(seed, "utf-8")).includes("prose-only") ? "survives-as-code" : "stripped")
        : "<fixture-file-absent>",
      known_open: true,
      status: existsSync(seed)
        ? (stripLikeProduction(readFileSync(seed, "utf-8")).includes("prose-only") ? "known_open" : "regression")
        : "error",
      note: "OPEN. Note the shape of the evidence: this was found because a goal about the defect was misrouted BY the defect. Stripping string literals is not obviously the right fix — a goal naming a real string constant would then lose its only true hit — so the durable form is probably to CARRY the evidence kind (code / comment / literal) alongside each hit and let the confidence bar depend on it, rather than to widen the stripper.",
    });

    // CONTROL 1 — nonsense must not localise. Without this a localiser that
    // returned some file for any input could score well on the fixtures above.
    const a3 = await restate("S3.control-nonsense", "zzqqxx frobnicate the wibble in the doodad");
    f.push({
      id: "S3.control-nonsense", provenance: "control",
      expected: "<unrestated>", actual: a3, known_open: false,
      status: a3 === "<unrestated>" ? "pass" : "regression",
    });

    // CONTROL 2 — a goal naming a real, uniquely-declared symbol SHOULD localise.
    // Paired with control 1 this separates "declines everything" from "discriminates".
    const a4 = await restate("S3.control-real-symbol", "The uniqueAnchorLines helper should not offer a line that is only unique because of trailing whitespace.");
    f.push({
      id: "S3.control-real-symbol", provenance: "control: a verbatim symbol exported from exactly one file must still resolve",
      expected: "repos/development-vessel/src/cross-file-symbols.ts", actual: a4, known_open: false,
      status: a4 === "repos/development-vessel/src/cross-file-symbols.ts" ? "pass" : "regression",
      note: why("S3.control-real-symbol") + " || PAIRED WITH control-nonsense ON PURPOSE. Nonsense declining proves nothing alone — a localiser that declined EVERYTHING would pass it. Only this pair separates 'discriminates' from 'is fail-closed to the point of uselessness', which reads as safety and is not.",
    });

    // Term extraction is reported alongside, because a localisation answer is
    // uninterpretable without knowing which terms produced it.
    f.push({
      id: "S3.terms-traffic", provenance: "diagnostic, not an assertion",
      expected: "<informational>", actual: JSON.stringify(extractSearchTerms(TRAFFIC).slice(0, 12)),
      known_open: false, status: "pass",
    });
  })();

  stages.push({
    stage: "S3", title: "Localisation — which file does a symptom goal name?",
    measures: "goal-host-vessel/src/goal-file-resolution.ts: resolvePathlessCodeChangeGoal, over a ripgrep FileSearch supplied by this harness (NOT production's searchWorkspaceForTerm — see module docstring)",
    fixtures: f,
  });
}

// ---------------------------------------------------------------------------
// S4 — declaration vs call site.
// ---------------------------------------------------------------------------

if (wanted("S4")) {
  const f: FixtureResult[] = [];
  // THE STAGE THAT PRODUCED d96e2ae. The goal asked nine lookups in index.ts to
  // adopt `pickSatisfierProducer`; the export-collapse in S3's search reduced the
  // match to the DECLARING file, the drafter was told to make the helper "use
  // pickSatisfierProducer", and it emitted a self-call — the infinite loop.
  check(f, "S4.adopt-helper", "dispatch behind d96e2ae — verbatim adopt phrasing",
    "true", () => String(wantsCallSitesOf("Callers should use the pickSatisfierProducer helper instead of picking pool[0] inline.", "pickSatisfierProducer")));
  check(f, "S4.adopt-switch-to", "the other adopt phrasing the predicate documents",
    "true", () => String(wantsCallSitesOf("Switch to isFailoverError at each site that inspects the message.", "isFailoverError")));
  check(f, "S4.control-declaration", "control: a goal about the helper ITSELF must not ask for call sites",
    "false", () => String(wantsCallSitesOf("isFailoverError does not recognise Bun's 'The operation timed out' message.", "isFailoverError")));

  // RECORDED AS OPEN, not asserted as working. The predicate keys on adopt
  // PHRASING ("should use X", "call X", "switch to X"), so a goal that names the
  // call sites directly but phrases the change differently is not recognised.
  // This is the same class as S2.symptom-no-code-noun: the capability exists and
  // is reachable only through one vocabulary.
  check(f, "S4.callers-other-phrasing", "the same intent, phrased as a property of the callers rather than an adoption",
    "false", () => String(wantsCallSitesOf("Every caller of isFailoverError should pass the error object instead of nothing.", "isFailoverError")),
    { known_open: true, note: "OPEN. A miss here does not decline safely — it falls through to the export-collapse, which is the exact route that produced d96e2ae. This is the highest-consequence known_open in the harness." });
  stages.push({
    stage: "S4", title: "Declaration vs call site",
    measures: "goal-host-vessel/src/goal-file-resolution.ts: wantsCallSitesOf",
    fixtures: f,
  });
}

// ---------------------------------------------------------------------------
// S5 — cross-file symbols. The drafter must be SHOWN a declaration it lacks.
// ---------------------------------------------------------------------------

if (wanted("S5")) {
  const f: FixtureResult[] = [];

  // The exact regression that shipped inert: the guard skipped any symbol whose
  // NAME appeared in the window, and a spec naturally mentions the symbol it is
  // about — so the fix disabled itself on its own motivating case.
  check(f, "S5.mention-is-not-declaration",
    "the observed case: drafter knew the name isFailoverError, did not know it takes an argument or where it lives; my first fix skipped it because the name was present",
    "true",
    () => String(symbolsNeedingDeclaration(
      "Guard the beta increment with isFailoverError so a billing outage is not recorded as model quality.",
      "// the spec mentions isFailoverError but this window only CALLS it\nif (reached) arm.alpha += 1; else arm.beta += 1;",
    ).includes("isFailoverError")));

  check(f, "S5.control-declaration-visible",
    "control: when the DECLARATION is in the window, nothing needs supplying",
    "false",
    () => String(symbolsNeedingDeclaration(
      "Guard the beta increment with isFailoverError.",
      "export function isFailoverError(err: unknown): boolean { return false; }\nif (reached) arm.alpha += 1;",
    ).includes("isFailoverError")));

  check(f, "S5.control-prose", "control: ordinary English words are not symbols to resolve",
    "true",
    () => String(symbolsNeedingDeclaration("Fix the thing that is broken because it should work.", "").length === 0));

  stages.push({
    stage: "S5", title: "Cross-file symbols — is the drafter shown what it lacks?",
    measures: "development-vessel/src/cross-file-symbols.ts: symbolsNeedingDeclaration",
    fixtures: f,
  });
}

// ---------------------------------------------------------------------------
// S6 — anchor uniqueness, against REAL file text.
//
// Byte-anchored patching needs an anchor that occurs exactly once. Measured on
// the live tree rather than a fixture string, because the standing lesson here
// is that uniqueness at this corpus size is coincidence, not evidence.
// ---------------------------------------------------------------------------

if (wanted("S6")) {
  const f: FixtureResult[] = [];
  const target = join(REPOS, "development-vessel/src/vacuous-edit.ts");
  const text = existsSync(target) ? readFileSync(target, "utf-8") : "";

  check(f, "S6.file-readable", "the anchor stage is meaningless without real text",
    "true", () => String(text.length > 1000));

  check(f, "S6.anchors-are-unique",
    "every anchor uniqueAnchorLines proposes must actually occur exactly once in the file it came from",
    "true",
    () => {
      const anchors = uniqueAnchorLines(text, 40);
      if (anchors.length === 0) return "no-anchors";
      const bad = anchors.filter((a) => anchorOccurrences(text, a) !== 1);
      return bad.length === 0 ? "true" : `${bad.length}-of-${anchors.length}-not-unique`;
    });

  check(f, "S6.control-absent-anchor", "control: an anchor that is not there must count 0, not 1",
    "0", () => String(anchorOccurrences(text, "zzqqxx_this_line_does_not_exist")));

  check(f, "S6.control-repeated-anchor", "control: a line that recurs must NOT be offered as an anchor",
    "true", () => String(!uniqueAnchorLines(text, 40).some((a) => a.trim() === "}" || a.trim() === "")));

  stages.push({
    stage: "S6", title: "Anchor uniqueness on the live tree",
    measures: "development-vessel/src/cross-file-symbols.ts: uniqueAnchorLines, anchorOccurrences",
    fixtures: f,
  });
}

// ---------------------------------------------------------------------------
// S7 — the post-draft gates, replayed on the four autonomous landings that were
// found wrong and reverted.
//
// These are the only four changes the system has authored, landed, and had
// judged wrong by a human read of the diff. Every one of them typechecked and
// passed the semantic judge. So they are the only honest fixtures for "would a
// gate stop this today" — and two of them, on today's code, still would not.
// ---------------------------------------------------------------------------

interface Reverted { id: string; repo: string; sha: string; file: string; why: string; expectCaught: boolean; note?: string }

const REVERTED: Reverted[] = [
  {
    id: "S7.d96e2ae-infinite-loop", repo: "goal-host-vessel", sha: "d96e2ae",
    file: "src/satisfier-pick.ts",
    why: "replaced `return best ?? pool[0]` with `return pickSatisfierProducer(pool)` — unconditional self-call, no progress, no base case; the vessel spun while reporting healthy",
    expectCaught: true,
  },
  {
    id: "S7.bc0ba3f3-diagnostic-only", repo: "goal-host-vessel", sha: "bc0ba3f3",
    file: "src/index.ts",
    why: "deleted a single tap() line and nothing else; the semantic judge fabricated 'removes the suppression'",
    expectCaught: true,
  },
  {
    id: "S7.2dbb4a6-abort-throw", repo: "development-vessel", sha: "2dbb4a6",
    file: "src/resolvers/feature-compose.ts",
    why: "added a throw that aborts EVERY compose whenever any vessel has a pre-existing tsc error, and its staging silently reverted unrelated in-flight work",
    expectCaught: false,
    note: "OPEN. Its wrongness is semantic — blast radius and a stale staging base — and no pure syntactic gate can see either. This is the class that produced the worst outcomes and the class nothing currently detects.",
  },
  {
    id: "S7.067b3f46-sentinel-compare", repo: "development-vessel", sha: "067b3f46",
    file: "src/resolvers/vessel-mitosis-cutover.ts",
    why: "compared every staged file's sha to the SINGLE sentinel `staged_base_sha`, so it would refuse every multi-file cutover — the opposite of the coverage warning it replaced",
    expectCaught: false,
    note: "OPEN. Syntactically an ordinary loop; only knowing that staged_base_sha is a sentinel for one file makes it wrong. Correctly fixed later by per-file staged_base_shas (24060e3).",
  },
];

if (wanted("S7")) {
  const f: FixtureResult[] = [];

  const gateVerdict = (repo: string, sha: string, file: string): string => {
    const before = git(repo, ["show", `${sha}^:${file}`]);
    const after = git(repo, ["show", `${sha}:${file}`]);
    if (before === null || after === null) return "<commit-or-path-unavailable>";
    const nt = nonTerminatingEditReason(before, after);
    if (nt) return "caught:non-terminating";
    const va = vacuousEditReason(before, after);
    if (va) return `caught:${va.split(":")[0]}`;
    return "not-caught";
  };

  for (const r of REVERTED) {
    const actual = gateVerdict(r.repo, r.sha, r.file);
    const caught = actual.startsWith("caught:");
    const asRecorded = caught === r.expectCaught;
    f.push({
      id: r.id,
      provenance: `${r.repo}@${r.sha} — substrate-authored, landed, reverted. ${r.why}`,
      expected: r.expectCaught ? "caught by a gate" : "not caught (recorded as open)",
      actual,
      known_open: !r.expectCaught,
      status: asRecorded ? (r.expectCaught ? "pass" : "known_open") : "regression",
      note: r.note,
    });
  }

  // CONTROL — a change known to be GOOD must pass every gate. Without it, a gate
  // that refused everything would score 2/2 above and read as a success.
  const good = gateVerdict("development-vessel", "cf3b7d4", "src/resolvers/feature-compose.ts");
  f.push({
    id: "S7.control-good-change",
    provenance: "development-vessel@cf3b7d4 — the fc-coverage warning; reviewed, correct, still in HEAD",
    expected: "not-caught", actual: good, known_open: false,
    status: good === "not-caught" ? "pass" : "regression",
    note: "A false positive here is more costly than it looks: a gate that refuses good changes converts the whole authoring path into a no-op that still reports refusals as safety.",
  });

  stages.push({
    stage: "S7", title: "Post-draft gates, replayed on the four reverted landings",
    measures: "development-vessel/src/vacuous-edit.ts: nonTerminatingEditReason, vacuousEditReason",
    fixtures: f,
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const VESSELS = ["goal-host-vessel", "development-vessel", "activity-api"];
const trees = VESSELS.map((v) => {
  const head = (git(v, ["rev-parse", "--short", "HEAD"]) ?? "").trim() || null;
  const dirty = (git(v, ["status", "--porcelain"]) ?? "").trim().length > 0;
  const live = containerHead(v);
  return {
    vessel: v, harness_head: head, harness_dirty: dirty, substrate_head: live,
    drift: live === null ? "unchecked" : live === head ? "none" : "DIVERGED",
  };
});

const all = stages.flatMap((s) => s.fixtures);
const counts = {
  pass: all.filter((r) => r.status === "pass").length,
  known_open: all.filter((r) => r.status === "known_open").length,
  regression: all.filter((r) => r.status === "regression").length,
  error: all.filter((r) => r.status === "error").length,
};

const report = {
  harness: "stage-harness",
  root: ROOT,
  stages_run: stages.map((s) => s.stage),
  /**
   * Digest of goal-host's real searchWorkspaceForTerm. S3 runs a PORT of it;
   * when this value changes the port must be re-checked against the original
   * before any S3 number is believed.
   */
  production_search_digest: productionSearchDigest(),
  trees,
  counts,
  limitations: [
    "S3 uses a ripgrep FileSearch supplied by this harness, not goal-host's production searchWorkspaceForTerm (not importable without booting the vessel). A regression confined to production's search is out of reach here.",
    "known_open fixtures are recorded wrongness that today's code does not catch. They are not failures of the harness and not passes of the system.",
    "No stage dispatches a goal. A green harness means every layer answers correctly in isolation; it does NOT mean the composition of those answers produces a correct landed change — the composition of three correct gate answers is exactly how caa57646 landed harm.",
  ],
  stages,
};

if (OUT) {
  mkdirSync(dirname(resolve(OUT)), { recursive: true });
  writeFileSync(resolve(OUT), JSON.stringify(report, null, 2));
}

if (!QUIET) {
  console.log(`\nstage-harness  root=${ROOT}`);
  for (const t of trees) {
    console.log(`  tree ${t.vessel.padEnd(20)} harness=${t.harness_head ?? "?"}${t.harness_dirty ? "+dirty" : ""} substrate=${t.substrate_head ?? "?"} drift=${t.drift}`);
  }
  for (const s of stages) {
    console.log(`\n[${s.stage}] ${s.title}`);
    for (const r of s.fixtures) {
      const mark = r.status === "pass" ? "PASS" : r.status === "known_open" ? "OPEN" : r.status === "error" ? "ERR " : "REGR";
      console.log(`  ${mark}  ${r.id}`);
      if (r.status !== "pass") console.log(`        expected=${r.expected}  actual=${r.actual}`);
    }
  }
  console.log(`\n  pass=${counts.pass}  known_open=${counts.known_open}  regression=${counts.regression}  error=${counts.error}`);
  if (OUT) console.log(`  report -> ${resolve(OUT)}`);
  const diverged = trees.filter((t) => t.drift === "DIVERGED").map((t) => t.vessel);
  if (diverged.length > 0) {
    console.log(`\n  WARNING: ${diverged.join(", ")} differ between this root and the tree the running substrate reads.`);
    console.log(`  Localisation answers above describe THIS root, not the live one.`);
  }
}

process.exit(counts.regression + counts.error > 0 ? 1 : 0);
