/**
 * emit-concepts.ts — the second reader of the rule table.
 *
 * A guide only humans read teaches only the person who opened it. The surface is
 * substrate-editable, so the same patterns the checker refuses must reach the
 * drafter at prompt-build time — otherwise the first substrate-authored change to
 * the surface is written against them and the gate just says no, repeatedly,
 * without ever teaching anything.
 *
 * `check.ts --emit-concepts` prints class-grain concept payloads generated from
 * `rules.ts`. One source, two readers (design.md §3.4): a rule cannot be enforced
 * without also being taught, or taught without being enforced.
 *
 * The payloads are shaped for concept-db's `concept_create` and are recalled on
 * the existing compose-lesson channel. `not_covered` is carried into the lesson
 * ON PURPOSE — telling the drafter that a rule is only half-checked is more
 * useful than implying the gate will catch everything.
 */

import { RULES, P0 } from './rules.ts';

export interface ConceptPayload {
  /** Stable key — regenerating must update, not duplicate. */
  key: string;
  name: string;
  kind: 'pattern';
  grain: 'class';
  /** The refusable condition, as the drafter should hold it. */
  statement: string;
  body: string;
  tags: string[];
  source: {
    package: '@avigopal/interaction-conformance';
    rule_table: 'rules.ts';
    rule_id: string;
  };
}

function body(opts: {
  statement: string;
  tier: string;
  checks: string;
  hint: string;
  notCovered?: string;
}): string {
  const lines = [
    opts.statement,
    '',
    `ENFORCED BY: @avigopal/interaction-conformance (${opts.tier}).`,
    `THE CHECK DECIDES: ${opts.checks}`,
  ];
  if (opts.notCovered) {
    lines.push(
      `THE CHECK DOES NOT DECIDE: ${opts.notCovered} Writing code that satisfies the checker is therefore not proof of conformance here — hold the rule, not the regex.`,
    );
  }
  lines.push('', `WHEN WRITING THIS CODE: ${opts.hint}`);
  return lines.join('\n');
}

export function emitConcepts(): ConceptPayload[] {
  const concepts: ConceptPayload[] = RULES.map((rule) => ({
    key: `interaction-contract/${rule.id}-${rule.slug}`,
    name: `Interaction contract ${rule.id}: ${rule.slug.replace(/-/g, ' ')}`,
    kind: 'pattern',
    grain: 'class',
    statement: rule.statement,
    body: body(rule),
    tags: [
      'interaction-contract',
      'human-surface',
      rule.tier,
      rule.id.toLowerCase(),
      rule.slug,
    ],
    source: {
      package: '@avigopal/interaction-conformance',
      rule_table: 'rules.ts',
      rule_id: rule.id,
    },
  }));

  concepts.push({
    key: `interaction-contract/${P0.id}-${P0.slug}`,
    name: `Interaction contract ${P0.id}: ${P0.slug.replace(/-/g, ' ')}`,
    kind: 'pattern',
    grain: 'class',
    statement: P0.statement,
    body: body(P0),
    tags: ['interaction-contract', 'human-surface', P0.tier, 'p0', P0.slug],
    source: {
      package: '@avigopal/interaction-conformance',
      rule_table: 'rules.ts',
      rule_id: P0.id,
    },
  });

  return concepts;
}
