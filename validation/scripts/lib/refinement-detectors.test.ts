/**
 * Unit tests for refinement-detectors — G3.3.1 / G4.1.2 / G4.1.3.
 *
 * Synthetic per-cell aggregates verify trend flags, tier-descent firing
 * conditions (including the low_confidence gating flag), and CI-narrowing
 * thresholds.
 */

import { describe, test, expect } from "bun:test";
import {
  computeOptimalityTrend,
  extractPriorOptimalityRatio,
  classifyResolverTier,
  computeTierDistribution,
  detectTierDescent,
  computeBetaCiWidth,
  makeThompsonCiSnapshot,
  detectCiNarrowing,
  type TierClassification,
} from "./refinement-detectors";

// ---------------------------------------------------------------------------
// G3.3.1 — optimality trend
// ---------------------------------------------------------------------------

describe("computeOptimalityTrend", () => {
  test("closing when ratio shrank by more than 5%", () => {
    expect(computeOptimalityTrend(1.10, 1.30)).toBe("closing");
  });

  test("regressing when ratio grew by more than 5%", () => {
    expect(computeOptimalityTrend(1.50, 1.30)).toBe("regressing");
  });

  test("stable within ±5%", () => {
    expect(computeOptimalityTrend(1.32, 1.30)).toBe("stable");
    expect(computeOptimalityTrend(1.28, 1.30)).toBe("stable");
  });

  test("null when either side missing", () => {
    expect(computeOptimalityTrend(null, 1.3)).toBeNull();
    expect(computeOptimalityTrend(1.3, null)).toBeNull();
    expect(computeOptimalityTrend(1.3, undefined)).toBeNull();
  });

  test("extractPriorOptimalityRatio accepts legacy numeric and object forms", () => {
    expect(extractPriorOptimalityRatio(1.4)).toBe(1.4);
    expect(extractPriorOptimalityRatio({ optimality_ratio: 1.2 })).toBe(1.2);
    expect(extractPriorOptimalityRatio({ optimality_ratio: null })).toBeNull();
    expect(extractPriorOptimalityRatio(null)).toBeNull();
    expect(extractPriorOptimalityRatio(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G4.1.2 — tier descent
// ---------------------------------------------------------------------------

describe("classifyResolverTier", () => {
  test("explicit resolver_tier wins", () => {
    expect(classifyResolverTier("llm", "bash")).toEqual({ tier: "llm", derived: false });
    expect(classifyResolverTier("deterministic", "llm")).toEqual({ tier: "deterministic", derived: false });
  });

  test("derives llm tier from resolver_id hints", () => {
    expect(classifyResolverTier(null, "llm_completion")).toEqual({ tier: "llm", derived: true });
    expect(classifyResolverTier(undefined, "claude-improvise")).toEqual({ tier: "llm", derived: true });
  });

  test("derives pattern tier from resolver_id hints", () => {
    expect(classifyResolverTier(null, "pre_validation")).toEqual({ tier: "pattern", derived: true });
  });

  test("other non-empty resolver_ids are deterministic", () => {
    expect(classifyResolverTier(null, "bash")).toEqual({ tier: "deterministic", derived: true });
    expect(classifyResolverTier(null, "obsidian:write_note")).toEqual({ tier: "deterministic", derived: true });
    expect(classifyResolverTier(null, "git_status")).toEqual({ tier: "deterministic", derived: true });
  });

  test("null when nothing usable", () => {
    expect(classifyResolverTier(null, null).tier).toBeNull();
    expect(classifyResolverTier("bogus_tier", "").tier).toBeNull();
  });
});

function tiers(spec: { llm?: number; pattern?: number; deterministic?: number }): TierClassification[] {
  const out: TierClassification[] = [];
  for (let i = 0; i < (spec.llm ?? 0); i++) out.push({ tier: "llm", derived: true });
  for (let i = 0; i < (spec.pattern ?? 0); i++) out.push({ tier: "pattern", derived: true });
  for (let i = 0; i < (spec.deterministic ?? 0); i++) out.push({ tier: "deterministic", derived: true });
  return out;
}

describe("computeTierDistribution", () => {
  test("fractions sum over classified tasks", () => {
    const d = computeTierDistribution(tiers({ llm: 2, pattern: 1, deterministic: 1 }));
    expect(d).not.toBeNull();
    expect(d!.llm).toBeCloseTo(0.5, 5);
    expect(d!.pattern).toBeCloseTo(0.25, 5);
    expect(d!.deterministic).toBeCloseTo(0.25, 5);
    expect(d!.sample_count).toBe(4);
  });

  test("unclassified tasks excluded; all-null yields null", () => {
    const d = computeTierDistribution([{ tier: null, derived: false }]);
    expect(d).toBeNull();
  });
});

describe("detectTierDescent", () => {
  test("fires when llm share drops >= 0.30 with adequate samples", () => {
    const prior = computeTierDistribution(tiers({ llm: 7, pattern: 2, deterministic: 1 }))!;   // llm 0.7
    const current = computeTierDistribution(tiers({ llm: 3, pattern: 4, deterministic: 3 }))!; // llm 0.3
    const e = detectTierDescent("seen|depth1|A", prior, current);
    expect(e).not.toBeNull();
    expect(e!.type).toBe("tier_descent");
    expect(e!.low_confidence).toBe(true);
    expect(e!.prior_value).toBeCloseTo(0.7, 5);
    expect(e!.current_value).toBeCloseTo(0.3, 5);
  });

  test("does not fire below threshold", () => {
    const prior = computeTierDistribution(tiers({ llm: 5, deterministic: 5 }))!;   // llm 0.5
    const current = computeTierDistribution(tiers({ llm: 3, deterministic: 7 }))!; // llm 0.3 (drop 0.2)
    expect(detectTierDescent("c", prior, current)).toBeNull();
  });

  test("does not fire on ascent (llm share grew)", () => {
    const prior = computeTierDistribution(tiers({ llm: 3, deterministic: 7 }))!;
    const current = computeTierDistribution(tiers({ llm: 7, deterministic: 3 }))!;
    expect(detectTierDescent("c", prior, current)).toBeNull();
  });

  test("does not fire with insufficient samples", () => {
    const prior = computeTierDistribution(tiers({ llm: 2 }))!;          // n=2 < 3
    const current = computeTierDistribution(tiers({ deterministic: 5 }))!;
    expect(detectTierDescent("c", prior, current)).toBeNull();
  });

  test("null-safe on missing distributions", () => {
    expect(detectTierDescent("c", null, null)).toBeNull();
    expect(detectTierDescent("c", undefined, computeTierDistribution(tiers({ llm: 5 })))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G4.1.3 — CI narrowing
// ---------------------------------------------------------------------------

describe("computeBetaCiWidth", () => {
  test("flat prior Beta(1,1) is wide", () => {
    expect(computeBetaCiWidth(1, 1)).toBeGreaterThan(0.5);
  });

  test("width shrinks monotonically with evidence", () => {
    const w10 = computeBetaCiWidth(8, 4);
    const w100 = computeBetaCiWidth(80, 40);
    expect(w100).toBeLessThan(w10);
  });
});

describe("detectCiNarrowing", () => {
  test("fires when width shrank >= 0.05 and executions grew >= 5", () => {
    const prior = makeThompsonCiSnapshot("activity:foo", 5, 3);     // n=8
    const current = makeThompsonCiSnapshot("activity:foo", 20, 12); // n=32
    expect(prior.ci_width - current.ci_width).toBeGreaterThanOrEqual(0.05);
    const e = detectCiNarrowing("cell", prior, current);
    expect(e).not.toBeNull();
    expect(e!.type).toBe("ci_narrowing");
    expect(e!.activity_id).toBe("activity:foo");
    expect(e!.execution_growth).toBe(24);
  });

  test("does not fire when the dominant activity changed", () => {
    const prior = makeThompsonCiSnapshot("activity:foo", 5, 3);
    const current = makeThompsonCiSnapshot("activity:bar", 20, 12);
    expect(detectCiNarrowing("cell", prior, current)).toBeNull();
  });

  test("does not fire without execution growth", () => {
    const prior = makeThompsonCiSnapshot("activity:foo", 5, 3);
    const current = makeThompsonCiSnapshot("activity:foo", 6, 4); // +2 execs
    expect(detectCiNarrowing("cell", prior, current)).toBeNull();
  });

  test("does not fire when width shrank less than threshold", () => {
    const prior = makeThompsonCiSnapshot("activity:foo", 100, 100);
    const current = makeThompsonCiSnapshot("activity:foo", 110, 110); // tiny shrink, +20 execs
    expect(detectCiNarrowing("cell", prior, current)).toBeNull();
  });

  test("null-safe on missing snapshots", () => {
    expect(detectCiNarrowing("cell", null, null)).toBeNull();
  });
});
