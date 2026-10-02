"use strict";
/**
 * Cross-vessel round-trip parity test for computeStateSpaceSignature.
 *
 * Validates that both implementations (activity-api and minibob) produce
 * byte-identical hashes for the same fixture inputs.
 *
 * Run with: bun validation/scripts/test-state-space-signature-roundtrip.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const session_context_1 = require("../../repos/metabob-activity-api/src/utils/session-context");
const state_space_signature_1 = require("../../repos/minibob/src/state-space-signature");
const _test_audit_loop_1 = require("./_test-audit-loop");
// Test-audit loop instrumentation (OpenSpec 2026-05-18-test-audit-loop Phase F).
const __testAuditRunStart = Date.now();
const __testAuditRunId = `tsssr-${__testAuditRunStart}`;
void (0, _test_audit_loop_1.ensureTestRegistration)({
    test_id: "validation/scripts/test-state-space-signature-roundtrip",
    inputs_schema: { fixtures: "Fixture[]" },
    perturbation_schedule: [],
    goal_alignment: [{
            criterion: "#5-composition-via-features",
            discrimination_claim: "Validates that both implementations (activity-api and minibob) of computeStateSpaceSignature produce byte-identical hashes — the cross-vessel parity property the binding layer relies on.",
        }],
    discrimination_claim: "Any drift between the two implementations would silently break cross-vessel slot binding; this test is the canonical regression guard.",
    witness_types: ["differential_solve"],
});
(0, _test_audit_loop_1.installExitHandler)(__testAuditRunStart, () => ({
    test_id: "validation/scripts/test-state-space-signature-roundtrip",
    run_id: __testAuditRunId,
    passed: (process.exitCode ?? 0) === 0,
    caveats: [],
}));
const FIXTURES = [
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
        input: { shapes: ['activityTemplate', 'executionTrace'], version: '1c' },
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
    const a = (0, session_context_1.computeStateSpaceSignature)(input);
    const b = (0, state_space_signature_1.computeStateSpaceSignature)(input);
    const match = a === b;
    const lengthOk = a.length === 16 && /^[0-9a-f]{16}$/.test(a);
    if (match && lengthOk) {
        console.log(`✓ ${label} → ${a}`);
        passed++;
    }
    else {
        console.error(`✗ ${label}`);
        if (!match)
            console.error(`  activity-api: ${a}`);
        if (!match)
            console.error(`  minibob:      ${b}`);
        if (!lengthOk)
            console.error(`  bad length/format: ${a}`);
        failed++;
    }
}
// Also verify determinism across all fixtures (same call twice)
for (const { label, input } of FIXTURES) {
    const first = (0, session_context_1.computeStateSpaceSignature)(input);
    const second = (0, session_context_1.computeStateSpaceSignature)(input);
    if (first !== second) {
        console.error(`✗ non-deterministic: ${label}`);
        failed++;
    }
}
console.log(`\n${passed} pass / ${failed} fail`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-state-space-signature-roundtrip.js.map