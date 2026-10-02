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
 * Exit codes. 0 means every fixture ran and answered as recorded. 1 means the run
 * is not trustworthy as-is, for one of two reasons, and the report says which:
 *
 *   - `regression` — a fixture's answer changed from what a real trial
 *     established. Either a break, or a repair whose expectation now needs a
 *     deliberate update. Distinct from a `known_open` fixture failing AS
 *     RECORDED, which exits 0.
 *   - `error` — the fixture could not be measured honestly. Chiefly: a module it
 *     imports has uncommitted tracked edits (a concurrent agent session), so any
 *     verdict would describe work in progress rather than the committed tree.
 *
 * Both exit 1 on purpose. A number that cannot be attributed to a cause is not a
 * result, and unattributed numbers are the problem this harness exists to fix.
 */
export {};
//# sourceMappingURL=stage-harness.d.ts.map