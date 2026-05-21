/**
 * Unit tests for computeContaminationDelta — G7.2.2 acceptance criteria.
 *
 * Uses synthetic per-cell success rates to verify the delta formula and the
 * contamination_suspected flag.
 */

import { describe, test, expect } from "bun:test";
import { computeContaminationDelta } from "./contamination-delta";

function cell(successRate: number, gated = false) {
  return {
    sample_count: 5,
    success_rate: successRate,
    floor_status: gated ? "gated_on_phase_22" : undefined,
  };
}

describe("computeContaminationDelta", () => {
  test("delta = rolling_mean - held_mean, no suspicion at 0.10", () => {
    const rolling = { a: cell(0.8), b: cell(0.7) };  // mean 0.75
    const heldOut = { a: cell(0.7), b: cell(0.6) };  // mean 0.65
    const { delta, contamination_suspected } = computeContaminationDelta(rolling, heldOut);
    expect(delta).toBeCloseTo(0.10, 2);
    expect(contamination_suspected).toBe(false);
  });

  test("delta > 0.15 sets contamination_suspected=true", () => {
    const rolling = { a: cell(0.9), b: cell(0.9) };  // mean 0.90
    const heldOut = { a: cell(0.7), b: cell(0.7) };  // mean 0.70
    const { delta, contamination_suspected } = computeContaminationDelta(rolling, heldOut);
    expect(delta).toBeCloseTo(0.20, 2);
    expect(contamination_suspected).toBe(true);
  });

  test("delta = 0.0 when rates are identical", () => {
    const m = { a: cell(0.6), b: cell(0.8) };
    const { delta } = computeContaminationDelta(m, m);
    expect(delta).toBeCloseTo(0, 5);
  });

  test("delta null when no eligible cells exist", () => {
    const { delta, contamination_suspected } = computeContaminationDelta({}, {});
    expect(delta).toBeNull();
    expect(contamination_suspected).toBe(false);
  });

  test("gated cells excluded from mean", () => {
    const rolling = { good: cell(0.9), gated: cell(0.0, true) };
    const heldOut = { good: cell(0.9), gated: cell(0.0, true) };
    const { delta } = computeContaminationDelta(rolling, heldOut);
    expect(delta).toBeCloseTo(0, 5);
  });

  test("cells with sample_count < 3 excluded", () => {
    const rolling = { good: cell(0.9), low: { sample_count: 2, success_rate: 0.0 } };
    const heldOut = { good: cell(0.9), low: { sample_count: 2, success_rate: 0.0 } };
    const { delta } = computeContaminationDelta(rolling, heldOut);
    expect(delta).toBeCloseTo(0, 5);
  });
});
