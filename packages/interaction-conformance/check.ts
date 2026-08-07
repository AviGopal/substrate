#!/usr/bin/env bun
/**
 * Interaction conformance check.
 *
 * Validates a surface against the canonical interaction contract
 * (openspec/changes/human-surface-stack/design.md §3.2).
 *
 * Usage:
 *   bun packages/interaction-conformance/check.ts <surface-root>
 *   bun packages/interaction-conformance/check.ts            # uses cwd
 *   bun packages/interaction-conformance/check.ts --list
 *   bun packages/interaction-conformance/check.ts --emit-concepts
 *
 * Exit 0: no violations.
 * Exit 1: violations found, or the surface could not be checked.
 *
 * Exemption:
 *   // @interaction:exempt P4 — <reason of at least 12 non-whitespace chars>
 *   <the flagged line>
 *
 * A bare exemption, or one naming an unknown rule id, is itself a violation (P0).
 *
 * P12 scans BUILD OUTPUT. If `<root>/dist` is absent this exits 1 with an error.
 * A silent skip there would be a green gate that never looked — pass
 * `--no-dist` only when you have consciously decided to check source rules alone.
 */

import { existsSync } from 'fs';
import { resolve, join } from 'path';

import { RULES, RULES_BY_ID, type RawFinding, type RuleContext } from './rules.ts';
import { walkFiles, loadFiles } from './scan.ts';
import { buildExemptionIndex, isExempt } from './exempt.ts';
import { report, printRuleTable } from './report.ts';
import { emitConcepts } from './emit-concepts.ts';

const SOURCE_EXTS = ['.ts', '.tsx', '.css'];
const DIST_EXTS = ['.js', '.css', '.html'];

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--emit-concepts')) {
    console.log(JSON.stringify(emitConcepts(), null, 2));
    process.exit(0);
  }
  if (argv.includes('--list')) {
    printRuleTable();
    process.exit(0);
  }

  const noDist = argv.includes('--no-dist');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const root = resolve(positional[0] ?? process.cwd());

  if (!existsSync(root)) {
    console.error(`interaction-conformance: surface root not found: ${root}`);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Load sources
  // -------------------------------------------------------------------------
  const sourcePaths = walkFiles(root, SOURCE_EXTS);
  const sources = loadFiles(root, sourcePaths);

  if (sources.length === 0) {
    console.error(
      `interaction-conformance: no .ts/.tsx/.css files found under ${root}.\n` +
        `  Point this at a surface root (the directory containing src/ and dist/).`,
    );
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Load build output — a missing dist/ is a HARD ERROR, never a silent skip
  // -------------------------------------------------------------------------
  const distRoot = join(root, 'dist');
  let distFiles: ReturnType<typeof loadFiles> = [];

  if (!noDist) {
    if (!existsSync(distRoot)) {
      console.error(
        `interaction-conformance: build output not found: ${distRoot}\n\n` +
          `  P12 (no external host in the built bundle) is decidable only against dist/.\n` +
          `  Skipping it silently would make this a green gate that never looked, so this\n` +
          `  is a hard failure. Build the surface first, then re-run.\n\n` +
          `  If you consciously want the source-only rules, pass --no-dist and accept that\n` +
          `  P12 was NOT checked.`,
      );
      process.exit(1);
    }
    distFiles = loadFiles(distRoot, walkFiles(distRoot, DIST_EXTS, { exclude: new Set(['node_modules', '.git']) }));
  }

  // -------------------------------------------------------------------------
  // Run the rule table
  // -------------------------------------------------------------------------
  const ctx: RuleContext = { root, sources, distFiles };
  const raw: RawFinding[] = [];
  const activeRules = noDist ? RULES.filter((r) => r.id !== 'P12') : RULES;
  for (const rule of activeRules) {
    try {
      raw.push(...rule.matcher(ctx));
    } catch (e) {
      console.error(`interaction-conformance: rule ${rule.id} threw:`, e);
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // Exemptions
  // -------------------------------------------------------------------------
  const allFiles = [...sources, ...distFiles];
  const index = buildExemptionIndex(allFiles, new Set(RULES_BY_ID.keys()));
  const rawLinesByFile = new Map(allFiles.map((f) => [f.path, f.rawLines]));

  const findings = [
    ...index.findings,
    ...raw.filter((f) => !isExempt(index, f, rawLinesByFile)),
  ];

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  if (findings.length === 0) {
    const scope = noDist ? `${sources.length} source files (P12 NOT checked)` : `${sources.length} source files, ${distFiles.length} build files`;
    console.log(
      `interaction-conformance: OK — ${scope}, ${activeRules.length} rules, no violations.`,
    );
    process.exit(0);
  }

  report(findings, root);
  process.exit(1);
}

main();
