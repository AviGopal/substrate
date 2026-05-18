/**
 * Cross-vessel round-trip parity test for computeStateSpaceSignature.
 *
 * Validates that both implementations (activity-api and minibob) produce
 * byte-identical hashes for the same fixture inputs.
 *
 * Run with: bun validation/scripts/test-state-space-signature-roundtrip.ts
 */

import { computeStateSpaceSignature as sigApi } from '../../repos/metabob-activity-api/src/utils/session-context';
import { computeStateSpaceSignature as sigMinibob } from '../../repos/minibob/src/state-space-signature';

interface Fixture {
  label: string;
  input: Parameters<typeof sigApi>[0];
}

const FIXTURES: Fixture[] = [
  {
    label: 'empty',
    input: { shapes: [] },
  },
  {
    label: 'single shape',
    input: { shapes: ['activityTemplate'] },
  },
  {
    label: 'shape + provenance + missing',
    input: {
      shapes: ['activityTemplate', 'executionTrace'],
      provenance: [{ shape: 'activityTemplate', producedBy: 'activity-api' }],
      missing: ['goal'],
    },
  },
  {
    label: 'reordered shapes (should match above)',
    input: {
      shapes: ['executionTrace', 'activityTemplate'],
      provenance: [{ shape: 'activityTemplate', producedBy: 'activity-api' }],
      missing: ['goal'],
    },
  },
  {
    label: 'v1c coarse — no provenance',
    input: { shapes: ['activityTemplate', 'executionTrace'], version: '1c' as const },
  },
  {
    label: 'full binding context',
    input: {
      shapes: ['activityTemplate', 'goal', 'impulseRelevance'],
      provenance: [
        { shape: 'activityTemplate', producedBy: 'activity-api' },
        { shape: 'goal', producedBy: 'minibob' },
      ],
      missing: ['userContext'],
    },
  },
];

let passed = 0;
let failed = 0;

for (const { label, input } of FIXTURES) {
  const a = sigApi(input);
  const b = sigMinibob(input);
  const match = a === b;
  const lengthOk = a.length === 16 && /^[0-9a-f]{16}$/.test(a);

  if (match && lengthOk) {
    console.log(`✓ ${label} → ${a}`);
    passed++;
  } else {
    console.error(`✗ ${label}`);
    if (!match) console.error(`  activity-api: ${a}`);
    if (!match) console.error(`  minibob:      ${b}`);
    if (!lengthOk) console.error(`  bad length/format: ${a}`);
    failed++;
  }
}

// Also verify determinism across all fixtures (same call twice)
for (const { label, input } of FIXTURES) {
  const first = sigApi(input);
  const second = sigApi(input);
  if (first !== second) {
    console.error(`✗ non-deterministic: ${label}`);
    failed++;
  }
}

console.log(`\n${passed} pass / ${failed} fail`);
if (failed > 0) process.exit(1);
