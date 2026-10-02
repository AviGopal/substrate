#!/usr/bin/env bun
/**
 * prove-refusal.ts — THE GATE MUST BE PROVEN TO REFUSE.
 *
 * A gate whose refusal has never been observed cannot be trusted when it passes.
 * So for every rule this suite asserts BOTH directions:
 *
 *   violating fixture → exit 1 AND the EXACT set of rule ids in the output
 *                       matches what the fixture is for.
 *   clean fixture     → exit 0.
 *
 * The exact-set assertion is the load-bearing part. Asserting only `exit 1`
 * would let a fixture that trips a DIFFERENT rule count as proof of this one —
 * a green suite proving nothing, which is the same defect as a gate with no call
 * sites. Asserting only that the id is present would let a clean-fixture
 * regression hide behind an unrelated extra finding.
 *
 * Each case is assembled into a scratch root under the system temp directory:
 *
 *   <tmp>/src/<fixture>.tsx
 *   <tmp>/dist/bundle.js        ← stub (allowlisted content) unless the case
 *                                 supplies its own build output
 *
 * The stub exists because P12 hard-errors on a missing dist/. Without it every
 * non-P12 case would exit 1 for the wrong reason.
 *
 * Run: bun run prove-refusal
 */

import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';

const HERE = import.meta.dir;
const CHECK = join(HERE, 'check.ts');
const FIXTURES = join(HERE, 'fixtures');

// A stub build output whose only URL is the SVG xmlns — the allowlisted case.
const STUB_DIST = 'var SVG_NS = "http://www.w3.org/2000/svg";\n';

interface Case {
  name: string;
  /** Fixture directory under fixtures/. */
  dir: string;
  /** Source file inside that directory. */
  source: string;
  /** Optional directory whose contents become <tmp>/dist. */
  distFrom?: string;
  /** `null` → expect exit 0. Otherwise the EXACT set of rule ids expected. */
  expect: string[] | null;
  /** Special mode: assemble no dist/ at all and expect the hard error. */
  noDist?: boolean;
}

const RULE_CASES = [
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P13',
];

const cases: Case[] = [];

for (const id of RULE_CASES) {
  cases.push({ name: `${id} violating`, dir: id, source: 'violating.tsx', expect: [id] });
  cases.push({ name: `${id} clean`, dir: id, source: 'clean.tsx', expect: null });
}

// P12 checks build output, so its pair swaps dist/ rather than the source.
cases.push({
  name: 'P12 violating (external hosts in dist/)',
  dir: 'P12',
  source: 'clean.tsx',
  distFrom: 'violating-dist',
  expect: ['P12'],
});
cases.push({
  name: 'P12 clean (w3.org xmlns + banner + sourcemap pragma allowlisted)',
  dir: 'P12',
  source: 'clean.tsx',
  distFrom: 'clean-dist',
  expect: null,
});

// The hard-error path itself needs its refusal proven: a silent skip here would
// be a green gate that never looked.
cases.push({
  name: 'P12 missing dist/ is a HARD ERROR, not a skip',
  dir: 'P12',
  source: 'clean.tsx',
  expect: [],
  noDist: true,
});

// Exemption channel.
cases.push({
  name: 'exempt-bare (no reason) is itself a violation and suppresses nothing',
  dir: 'exempt-bare',
  source: 'violating.tsx',
  expect: ['P0', 'P4'],
});
cases.push({
  name: 'exempt-unknown (bad rule id) fails loudly and suppresses nothing',
  dir: 'exempt-unknown',
  source: 'violating.tsx',
  expect: ['P0', 'P4'],
});
cases.push({
  name: 'exempt-ok (real rule + reason) suppresses',
  dir: 'exempt-ok',
  source: 'clean.tsx',
  expect: null,
});

// ---------------------------------------------------------------------------

function assemble(c: Case): string {
  const root = mkdtempSync(join(tmpdir(), 'interaction-conformance-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  copyFileSync(
    join(FIXTURES, c.dir, c.source),
    join(root, 'src', `${c.dir}-${basename(c.source)}`),
  );

  if (!c.noDist) {
    const dist = join(root, 'dist');
    mkdirSync(dist, { recursive: true });
    if (c.distFrom) {
      const from = join(FIXTURES, c.dir, c.distFrom);
      for (const f of readdirSync(from)) copyFileSync(join(from, f), join(dist, f));
    } else {
      writeFileSync(join(dist, 'bundle.js'), STUB_DIST);
    }
  }

  return root;
}

function run(root: string): { code: number; out: string } {
  const p = Bun.spawnSync(['bun', CHECK, root], { stdout: 'pipe', stderr: 'pipe' });
  return {
    code: p.exitCode,
    out: new TextDecoder().decode(p.stdout) + new TextDecoder().decode(p.stderr),
  };
}

/** Rule ids the checker actually GROUPED its output under. */
function reportedRules(out: string): string[] {
  const ids = new Set<string>();
  for (const m of out.matchAll(/^(P\d+) — /gm)) ids.add(m[1]);
  return [...ids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

let failures = 0;
let passes = 0;

console.log('interaction-conformance self-test — proving the gate refuses\n');

for (const c of cases) {
  const root = assemble(c);
  const { code, out } = run(root);
  const problems: string[] = [];

  if (c.noDist) {
    if (code !== 1) problems.push(`expected exit 1 on missing dist/, got ${code}`);
    if (!/build output not found/.test(out) || !/dist/.test(out)) {
      problems.push('error message did not name the missing dist/ build output');
    }
  } else if (c.expect === null) {
    if (code !== 0) {
      problems.push(
        `expected exit 0, got ${code}; reported ${JSON.stringify(reportedRules(out))}`,
      );
    }
  } else {
    if (code !== 1) problems.push(`expected exit 1, got ${code}`);
    const got = reportedRules(out);
    const want = [...c.expect].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(`expected rules ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }

  if (problems.length === 0) {
    passes++;
    const label =
      c.expect === null ? 'exit 0' : c.noDist ? 'exit 1 + names dist/' : `exit 1 + ${c.expect.join(',')}`;
    console.log(`  PASS  ${c.name.padEnd(62)} ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${c.name}`);
    for (const p of problems) console.log(`          ${p}`);
    console.log(out.split('\n').map((l) => `        | ${l}`).join('\n'));
  }

  rmSync(root, { recursive: true, force: true });
}

console.log(
  `\n${passes} passed, ${failures} failed, ${cases.length} total ` +
    `(${RULE_CASES.length + 1} rules proven to refuse and to pass).`,
);
process.exit(failures === 0 ? 0 : 1);
