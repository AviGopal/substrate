"use strict";
/**
 * Unit tests for refinement-detectors — G3.3.1 / G4.1.2 / G4.1.3.
 *
 * Synthetic per-cell aggregates verify trend flags, tier-descent firing
 * conditions (including the low_confidence gating flag), and CI-narrowing
 * thresholds.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const refinement_detectors_1 = require("./refinement-detectors");
// ---------------------------------------------------------------------------
// G3.3.1 — optimality trend
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("computeOptimalityTrend", () => {
    (0, bun_test_1.test)("closing when ratio shrank by more than 5%", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeOptimalityTrend)(1.10, 1.30)).toBe("closing");
    });
    (0, bun_test_1.test)("regressing when ratio grew by more than 5%", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeOptimalityTrend)(1.50, 1.30)).toBe("regressing");
    });
    (0, bun_test_1.test)("stable within ±5%", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeOptimalityTrend)(1.32, 1.30)).toBe("stable");
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeOptimalityTrend)(1.28, 1.30)).toBe("stable");
    });
    (0, bun_test_1.test)("null when either side missing", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeOptimalityTrend)(null, 1.3)).toBeNull();
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeOptimalityTrend)(1.3, null)).toBeNull();
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeOptimalityTrend)(1.3, undefined)).toBeNull();
    });
    (0, bun_test_1.test)("extractPriorOptimalityRatio accepts legacy numeric and object forms", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.extractPriorOptimalityRatio)(1.4)).toBe(1.4);
        (0, bun_test_1.expect)((0, refinement_detectors_1.extractPriorOptimalityRatio)({ optimality_ratio: 1.2 })).toBe(1.2);
        (0, bun_test_1.expect)((0, refinement_detectors_1.extractPriorOptimalityRatio)({ optimality_ratio: null })).toBeNull();
        (0, bun_test_1.expect)((0, refinement_detectors_1.extractPriorOptimalityRatio)(null)).toBeNull();
        (0, bun_test_1.expect)((0, refinement_detectors_1.extractPriorOptimalityRatio)(undefined)).toBeNull();
    });
});
// ---------------------------------------------------------------------------
// G4.1.2 — tier descent
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("classifyResolverTier", () => {
    (0, bun_test_1.test)("explicit resolver_tier wins", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)("llm", "bash")).toEqual({ tier: "llm", derived: false });
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)("deterministic", "llm")).toEqual({ tier: "deterministic", derived: false });
    });
    (0, bun_test_1.test)("derives llm tier from resolver_id hints", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)(null, "llm_completion")).toEqual({ tier: "llm", derived: true });
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)(undefined, "claude-improvise")).toEqual({ tier: "llm", derived: true });
    });
    (0, bun_test_1.test)("derives pattern tier from resolver_id hints", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)(null, "pre_validation")).toEqual({ tier: "pattern", derived: true });
    });
    (0, bun_test_1.test)("other non-empty resolver_ids are deterministic", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)(null, "bash")).toEqual({ tier: "deterministic", derived: true });
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)(null, "obsidian:write_note")).toEqual({ tier: "deterministic", derived: true });
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)(null, "git_status")).toEqual({ tier: "deterministic", derived: true });
    });
    (0, bun_test_1.test)("null when nothing usable", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)(null, null).tier).toBeNull();
        (0, bun_test_1.expect)((0, refinement_detectors_1.classifyResolverTier)("bogus_tier", "").tier).toBeNull();
    });
});
function tiers(spec) {
    const out = [];
    for (let i = 0; i < (spec.llm ?? 0); i++)
        out.push({ tier: "llm", derived: true });
    for (let i = 0; i < (spec.pattern ?? 0); i++)
        out.push({ tier: "pattern", derived: true });
    for (let i = 0; i < (spec.deterministic ?? 0); i++)
        out.push({ tier: "deterministic", derived: true });
    return out;
}
(0, bun_test_1.describe)("computeTierDistribution", () => {
    (0, bun_test_1.test)("fractions sum over classified tasks", () => {
        const d = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 2, pattern: 1, deterministic: 1 }));
        (0, bun_test_1.expect)(d).not.toBeNull();
        (0, bun_test_1.expect)(d.llm).toBeCloseTo(0.5, 5);
        (0, bun_test_1.expect)(d.pattern).toBeCloseTo(0.25, 5);
        (0, bun_test_1.expect)(d.deterministic).toBeCloseTo(0.25, 5);
        (0, bun_test_1.expect)(d.sample_count).toBe(4);
    });
    (0, bun_test_1.test)("unclassified tasks excluded; all-null yields null", () => {
        const d = (0, refinement_detectors_1.computeTierDistribution)([{ tier: null, derived: false }]);
        (0, bun_test_1.expect)(d).toBeNull();
    });
});
(0, bun_test_1.describe)("detectTierDescent", () => {
    (0, bun_test_1.test)("fires when llm share drops >= 0.30 with adequate samples", () => {
        const prior = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 7, pattern: 2, deterministic: 1 })); // llm 0.7
        const current = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 3, pattern: 4, deterministic: 3 })); // llm 0.3
        const e = (0, refinement_detectors_1.detectTierDescent)("seen|depth1|A", prior, current);
        (0, bun_test_1.expect)(e).not.toBeNull();
        (0, bun_test_1.expect)(e.type).toBe("tier_descent");
        (0, bun_test_1.expect)(e.low_confidence).toBe(true);
        (0, bun_test_1.expect)(e.prior_value).toBeCloseTo(0.7, 5);
        (0, bun_test_1.expect)(e.current_value).toBeCloseTo(0.3, 5);
    });
    (0, bun_test_1.test)("does not fire below threshold", () => {
        const prior = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 5, deterministic: 5 })); // llm 0.5
        const current = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 3, deterministic: 7 })); // llm 0.3 (drop 0.2)
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectTierDescent)("c", prior, current)).toBeNull();
    });
    (0, bun_test_1.test)("does not fire on ascent (llm share grew)", () => {
        const prior = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 3, deterministic: 7 }));
        const current = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 7, deterministic: 3 }));
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectTierDescent)("c", prior, current)).toBeNull();
    });
    (0, bun_test_1.test)("does not fire with insufficient samples", () => {
        const prior = (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 2 })); // n=2 < 3
        const current = (0, refinement_detectors_1.computeTierDistribution)(tiers({ deterministic: 5 }));
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectTierDescent)("c", prior, current)).toBeNull();
    });
    (0, bun_test_1.test)("null-safe on missing distributions", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectTierDescent)("c", null, null)).toBeNull();
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectTierDescent)("c", undefined, (0, refinement_detectors_1.computeTierDistribution)(tiers({ llm: 5 })))).toBeNull();
    });
});
// ---------------------------------------------------------------------------
// G4.1.3 — CI narrowing
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("computeBetaCiWidth", () => {
    (0, bun_test_1.test)("flat prior Beta(1,1) is wide", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.computeBetaCiWidth)(1, 1)).toBeGreaterThan(0.5);
    });
    (0, bun_test_1.test)("width shrinks monotonically with evidence", () => {
        const w10 = (0, refinement_detectors_1.computeBetaCiWidth)(8, 4);
        const w100 = (0, refinement_detectors_1.computeBetaCiWidth)(80, 40);
        (0, bun_test_1.expect)(w100).toBeLessThan(w10);
    });
});
(0, bun_test_1.describe)("detectCiNarrowing", () => {
    (0, bun_test_1.test)("fires when width shrank >= 0.05 and executions grew >= 5", () => {
        const prior = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:foo", 5, 3); // n=8
        const current = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:foo", 20, 12); // n=32
        (0, bun_test_1.expect)(prior.ci_width - current.ci_width).toBeGreaterThanOrEqual(0.05);
        const e = (0, refinement_detectors_1.detectCiNarrowing)("cell", prior, current);
        (0, bun_test_1.expect)(e).not.toBeNull();
        (0, bun_test_1.expect)(e.type).toBe("ci_narrowing");
        (0, bun_test_1.expect)(e.activity_id).toBe("activity:foo");
        (0, bun_test_1.expect)(e.execution_growth).toBe(24);
    });
    (0, bun_test_1.test)("does not fire when the dominant activity changed", () => {
        const prior = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:foo", 5, 3);
        const current = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:bar", 20, 12);
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectCiNarrowing)("cell", prior, current)).toBeNull();
    });
    (0, bun_test_1.test)("does not fire without execution growth", () => {
        const prior = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:foo", 5, 3);
        const current = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:foo", 6, 4); // +2 execs
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectCiNarrowing)("cell", prior, current)).toBeNull();
    });
    (0, bun_test_1.test)("does not fire when width shrank less than threshold", () => {
        const prior = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:foo", 100, 100);
        const current = (0, refinement_detectors_1.makeThompsonCiSnapshot)("activity:foo", 110, 110); // tiny shrink, +20 execs
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectCiNarrowing)("cell", prior, current)).toBeNull();
    });
    (0, bun_test_1.test)("null-safe on missing snapshots", () => {
        (0, bun_test_1.expect)((0, refinement_detectors_1.detectCiNarrowing)("cell", null, null)).toBeNull();
    });
});
//# sourceMappingURL=refinement-detectors.test.js.map