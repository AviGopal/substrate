#!/usr/bin/env bun
/**
 * Lint check: EVIDENCE-FIELD ALIASING.
 *
 * A field that one mechanism computes from must not be written by another
 * mechanism for its own bookkeeping. The substrate's laws guard the COMPUTE
 * step — gates are computation-time checks over fresh inputs, and they are
 * reliably correct. Nothing guards the EVIDENCE step, and law 1 makes every
 * field addressable and therefore rewritable, with no ownership discipline.
 *
 * Measured instances of the class (2026-09-03), all silent in production:
 *   - variant_performance_metrics.updated_at is decay's elapsed clock
 *     (posterior-update.ts decayedThompsonCounts) AND is refreshed by counter
 *     upserts and by chain-credit's ancestor write. Decay was under-applied
 *     ~281x on auth_resolve_v1: beta 401,383 -> 401,710 over ten days where a
 *     live 30-day half-life should have left ~318,578.
 *   - activity_composition_graph.created_at is edge age AND is rewritten on
 *     upsert: 254 rows looked "created today", only 67 were new edges.
 *   - gaps.detected_at is law-7 latency AND is overwritten by TTL expiry.
 *   - the compose report is the goal-host reconciler's evidence AND is
 *     clobbered by the next attempt on the same gap id.
 *
 * WHY A STATIC CHECK. Every runtime detector for these defects would consume
 * the same reach/trace evidence the defects corrupt. This check reads source
 * only, so it cannot be starved by what it detects. That is the whole reason
 * it is worth having.
 *
 * WHAT IT DOES. For each (table, field, consumer) rule below, find write
 * statements against that table that assign the field, and report the ones
 * whose enclosing scope does not first apply the consumer. Reports only —
 * exits non-zero when new violations appear above the recorded baseline, so
 * adding an aliasing writer fails lint while the known backlog does not.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Rule {
  /** Table whose field carries the evidence. */
  table: string;
  /** The field read as an elapsed-time / accumulation input. */
  field: string;
  /** Function that must be applied before writing the field. */
  consumer: string;
  /**
   * Files known to contain aliasing writers when the rule was added. A
   * violation in a file NOT listed here fails the check.
   *
   * Baselining by FILE rather than by COUNT is deliberate. A count baseline is
   * brittle: running this against two checkouts of the same repo minutes apart
   * gave 8 and 9 because the line numbers and statement layout differed. A
   * file set is stable under refactoring within a file, and still catches the
   * thing worth catching — aliasing appearing somewhere new.
   */
  baselineFiles: string[];
}

/**
 * Rules are deliberately explicit rather than inferred. An inferred rule set
 * would need to decide what counts as "an elapsed-time computation", and a
 * wrong guess there produces noise that gets the whole check ignored.
 */
const RULES: Rule[] = [
  {
    table: 'variant_performance_metrics',
    field: 'updated_at',
    consumer: 'decayedThompsonCounts',
    baselineFiles: [
      'src/lib/posterior-update.ts',
      'src/routes/activities.ts',
      'src/routes/ci.ts',
      'src/routes/execution-traces.ts',
    ],
  },
];

/**
 * Statement start. The keyword must be preceded by start-of-line, a backtick,
 * whitespace, or a semicolon — NOT by a hyphen or word character.
 *
 * `\b(UPDATE)\b` is wrong here and was the check's own first bug: a hyphen is a
 * word boundary, so `\bUPDATE\b` matches the "update" inside the import path
 * `../lib/posterior-update`. That anchored the statement window on the import
 * line, which in turn discarded the scope lookback that would have found the
 * consumer being applied — a false positive on a correct file. The check
 * committed the defect class it exists to detect.
 */
const STMT = /(^|[`\s;(])(UPDATE|UPSERT|INSERT\s+INTO)\s/i;
/** How far a template-literal SQL statement may run before we stop reading. */
const STMT_MAX_LINES = 30;
/** How far back to look for the consumer being applied in the same scope. */
const SCOPE_LOOKBACK = 60;

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
      const p = join(dir, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      // .test. files are excluded: a test may legitimately write a field
      // directly to construct a fixture, and flagging that trains people to
      // ignore the check.
      else if (e.endsWith('.ts') && !e.includes('.test.')) out.push(p);
    }
  };
  walk(root);
  return out;
}

export interface Violation {
  file: string;
  line: number;
}

export function scan(root: string, rule: Rule): Violation[] {
  const found: Violation[] = [];
  for (const file of sourceFiles(root)) {
    let txt: string;
    try {
      txt = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!txt.includes(rule.table)) continue;
    const lines = txt.split('\n');
    let lastReported = -100;
    for (let i = 0; i < lines.length; i++) {
      if (!STMT.test(lines[i]!)) continue;
      // Read the statement body. Scoping the table match to the STATEMENT and
      // not to a line window matters: a file that touches several tables will
      // otherwise attribute one table's write to another. That was a real
      // false positive when this check was first run by hand.
      const body: string[] = [];
      for (let j = i; j < Math.min(i + STMT_MAX_LINES, lines.length); j++) {
        body.push(lines[j]!);
        if (j > i && /`\s*[,;)]/.test(lines[j]!)) break;
      }
      const stmt = body.join('\n');
      if (!new RegExp(`\\b${rule.table}\\b`).test(stmt)) continue;
      if (!new RegExp(`\\b${rule.field}\\s*[=:]`).test(stmt)) continue;
      const scope = lines.slice(Math.max(0, i - SCOPE_LOOKBACK), i).join('\n');
      if (scope.includes(rule.consumer)) continue;
      // Collapse adjacent hits: one SQL statement can assign the field on
      // several lines, and counting each would inflate the violation count.
      if (i - lastReported <= STMT_MAX_LINES) continue;
      lastReported = i;
      found.push({ file, line: i + 1 });
    }
  }
  return found;
}

const root = resolve(process.argv[2] ?? process.cwd());
let failed = false;

for (const rule of RULES) {
  const v = scan(root, rule);
  const label = `${rule.table}.${rule.field} (must apply ${rule.consumer})`;
  if (v.length === 0) {
    console.log(`ok    ${label}: no aliasing writers`);
    continue;
  }
  const rel = (f: string) => f.replace(root + '/', '');
  const fresh = v.filter((x) => !rule.baselineFiles.includes(rel(x.file)));
  const verdict = fresh.length > 0 ? 'FAIL ' : 'known';
  console.log(`${verdict} ${label}: ${v.length} writer(s) reset the clock without applying it`);
  for (const { file, line } of v) {
    const isNew = !rule.baselineFiles.includes(rel(file));
    console.log(`        ${rel(file)}:${line}${isNew ? '   <-- NOT IN BASELINE' : ''}`);
  }
  if (fresh.length > 0) {
    failed = true;
    console.log(`        ^ aliasing writer in a file outside the baseline — a field consumed as evidence must have one owner.`);
  }
}

process.exit(failed ? 1 : 0);
