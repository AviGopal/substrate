/**
 * report.ts — grouped stderr output.
 *
 * Deliberately identical in shape to `shape-dispatch-check`: a group header per
 * rule with a count and the rule statement, then per finding
 *
 *     [kind] name
 *       at file:line
 *       → hint
 *
 * and a trailing note naming the exemption escape hatch. A second checker with
 * different ergonomics gets adopted by nobody.
 */

import { RULES_BY_ID, P0, type RawFinding, type Rule } from './rules.ts';

export function report(findings: RawFinding[], root: string): void {
  console.error(
    `interaction-conformance: ${findings.length} violation(s) found in ${root}\n`,
  );

  const order = ['P0', ...RULES_BY_ID.keys()];
  const grouped = new Map<string, RawFinding[]>();
  for (const f of findings) {
    let g = grouped.get(f.ruleId);
    if (!g) grouped.set(f.ruleId, (g = []));
    g.push(f);
  }

  for (const ruleId of order) {
    const group = grouped.get(ruleId);
    if (!group || group.length === 0) continue;

    const rule: Pick<Rule, 'id' | 'slug' | 'statement' | 'tier' | 'hint'> =
      ruleId === 'P0' ? (P0 as any) : RULES_BY_ID.get(ruleId)!;

    console.error(
      `${rule.id} — ${rule.slug.toUpperCase().replace(/-/g, ' ')} (${group.length}) [${rule.tier}]:`,
    );
    console.error(`  ${rule.statement}\n`);

    for (const f of group) {
      console.error(`  [${f.kind}] ${f.name}`);
      console.error(`    at ${f.file}:${f.line}`);
      console.error(`    → ${f.hint ?? rule.hint}\n`);
    }
  }

  console.error(
    `\nTo record a deliberate divergence, add '// @interaction:exempt <ruleId> — <reason>' on the line`,
  );
  console.error(
    `immediately preceding the flagged line (or '// @interaction:exempt-file <ruleId> — <reason>' in the`,
  );
  console.error(
    `first 5 lines for a whole file). A bare exemption, or one naming an unknown rule, is itself a P0 violation.`,
  );
  console.error(
    `Run with --list to print the rule table, or --emit-concepts to regenerate the concept-db lesson payloads.`,
  );
}

export function printRuleTable(): void {
  const rows = [
    [P0.id, P0.slug, P0.tier, P0.statement],
    ...RULES_BY_ID.values().map((r) => [r.id, r.slug, r.tier, r.statement]),
  ] as string[][];

  console.log('interaction-conformance rule table\n');
  for (const [id, slug, tier, statement] of rows) {
    console.log(`${id.padEnd(4)} ${slug.padEnd(38)} ${tier}`);
    console.log(`     ${statement}`);
    const rule = RULES_BY_ID.get(id);
    if (rule?.notCovered) console.log(`     NOT COVERED: ${rule.notCovered}`);
    console.log('');
  }
}
