"use strict";
/**
 * Unit tests for computeContaminationDelta — G7.2.2 acceptance criteria.
 *
 * Uses synthetic per-cell success rates to verify the delta formula and the
 * contamination_suspected flag.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const contamination_delta_1 = require("./contamination-delta");
function cell(successRate, gated = false) {
    return {
        sample_count: 5,
        success_rate: successRate,
        floor_status: gated ? "gated_on_phase_22" : undefined,
    };
}
(0, bun_test_1.describe)("computeContaminationDelta", () => {
    (0, bun_test_1.test)("delta = rolling_mean - held_mean, no suspicion at 0.10", () => {
        const rolling = { a: cell(0.8), b: cell(0.7) }; // mean 0.75
        const heldOut = { a: cell(0.7), b: cell(0.6) }; // mean 0.65
        const { delta, contamination_suspected } = (0, contamination_delta_1.computeContaminationDelta)(rolling, heldOut);
        (0, bun_test_1.expect)(delta).toBeCloseTo(0.10, 2);
        (0, bun_test_1.expect)(contamination_suspected).toBe(false);
    });
    (0, bun_test_1.test)("delta > 0.15 sets contamination_suspected=true", () => {
        const rolling = { a: cell(0.9), b: cell(0.9) }; // mean 0.90
        const heldOut = { a: cell(0.7), b: cell(0.7) }; // mean 0.70
        const { delta, contamination_suspected } = (0, contamination_delta_1.computeContaminationDelta)(rolling, heldOut);
        (0, bun_test_1.expect)(delta).toBeCloseTo(0.20, 2);
        (0, bun_test_1.expect)(contamination_suspected).toBe(true);
    });
    (0, bun_test_1.test)("delta = 0.0 when rates are identical", () => {
        const m = { a: cell(0.6), b: cell(0.8) };
        const { delta } = (0, contamination_delta_1.computeContaminationDelta)(m, m);
        (0, bun_test_1.expect)(delta).toBeCloseTo(0, 5);
    });
    (0, bun_test_1.test)("delta null when no eligible cells exist", () => {
        const { delta, contamination_suspected } = (0, contamination_delta_1.computeContaminationDelta)({}, {});
        (0, bun_test_1.expect)(delta).toBeNull();
        (0, bun_test_1.expect)(contamination_suspected).toBe(false);
    });
    (0, bun_test_1.test)("gated cells excluded from mean", () => {
        const rolling = { good: cell(0.9), gated: cell(0.0, true) };
        const heldOut = { good: cell(0.9), gated: cell(0.0, true) };
        const { delta } = (0, contamination_delta_1.computeContaminationDelta)(rolling, heldOut);
        (0, bun_test_1.expect)(delta).toBeCloseTo(0, 5);
    });
    (0, bun_test_1.test)("cells with sample_count < 3 excluded", () => {
        const rolling = { good: cell(0.9), low: { sample_count: 2, success_rate: 0.0 } };
        const heldOut = { good: cell(0.9), low: { sample_count: 2, success_rate: 0.0 } };
        const { delta } = (0, contamination_delta_1.computeContaminationDelta)(rolling, heldOut);
        (0, bun_test_1.expect)(delta).toBeCloseTo(0, 5);
    });
});
//# sourceMappingURL=contamination-delta.test.js.map