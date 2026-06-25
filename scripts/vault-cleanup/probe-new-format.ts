/**
 * Probe: render a fake concept via the new data-shaped formatter and
 * dump the output + verify round-trip identity. Not for commit — local
 * eyeball only.
 *
 *   bun run scripts/vault-cleanup/probe-new-format.ts
 */
import {
  renderConceptNote,
} from '../../repos/obsidian-vessel/src/formatters/concept-formatter';
import { stripWritebackEnvelope } from '../../repos/obsidian-vessel/src/sync/concept-writeback-strip';

const concept = {
  id: 'concept:KRRO_1nIpzr0',
  shape: 'api_contract_validation_failure',
  source_type: 'extracted',
  pointer: {
    type: 'memo',
    path: 'openspec/changes/2026-06-01-substrate-authored-concept-search-validation-enum-fix/proposal.md',
    section: 'substrate_learning',
  },
  summary:
    "source_type enum doesn't include 'substrate_gap'; limit param expects number not string.",
  content: '',
  relevance: 0.13,
  times_loaded: 6,
  times_succeeded: 0,
  times_failed: 0,
  updated_at: '2026-06-01T10:01:02Z',
};

const neighbors = [
  { id: 'concept:HqdWDywYZzK3', shape: 'round_trip_idempotence_contract', source_type: 'extracted', edge_type: 'derived_from', edge_weight: 0.9, relevance: 0.5 },
  { id: 'concept:kxeA7gRK7NEW', shape: 'writeback_echo_loop', source_type: 'extracted', edge_type: 'contradicts', edge_weight: 0.6, relevance: 0.4 },
  { id: 'concept:lzKXyoYYwEBR', shape: 'substrate_authored_design', source_type: 'extracted', edge_type: 'example_of', edge_weight: 0.7, relevance: 0.6 },
];

const opts = { pulledAt: '2026-06-01T10:03:12Z' };
function bodyOf(rendered: string): string {
  // Mimic parseNote: strip leading `---\n...\n---\n` frontmatter block.
  const m = rendered.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? rendered.slice(m[0].length) : rendered;
}

const rendered = renderConceptNote(concept as any, neighbors as any, opts);
console.log('===== RENDERED (empty prose) =====');
console.log(rendered);

const stripped = stripWritebackEnvelope(bodyOf(rendered));
console.log('===== STRIPPED (should be empty) =====');
console.log(JSON.stringify(stripped));
console.log('round-trip identity (empty prose):', stripped === '' ? 'PASS' : 'FAIL');

const concept2 = { ...concept, content: 'Operator added context:\n\nThis lands during fm-57 closure.' };
const rendered2 = renderConceptNote(concept2 as any, neighbors as any, opts);
console.log('\n===== RENDERED (with user prose) =====');
console.log(rendered2);
const stripped2 = stripWritebackEnvelope(bodyOf(rendered2));
console.log('===== STRIPPED (should be the prose) =====');
console.log(JSON.stringify(stripped2));
console.log(
  'round-trip identity (user prose preserved):',
  stripped2 === 'Operator added context:\n\nThis lands during fm-57 closure.' ? 'PASS' : 'FAIL',
);
