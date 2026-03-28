/**
 * Thompson Sampling Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ThompsonState, sampleBeta } from "../../src/selection/thompson.ts";

describe("sampleBeta", () => {
  test("samples in valid range [0, 1]", () => {
    for (let i = 0; i < 100; i++) {
      const sample = sampleBeta(1, 1);
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  test("higher alpha shifts distribution right", () => {
    // Sample many times and check mean
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      samples.push(sampleBeta(10, 1)); // High alpha, low beta
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.8); // Should be close to 1
  });

  test("higher beta shifts distribution left", () => {
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      samples.push(sampleBeta(1, 10)); // Low alpha, high beta
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeLessThan(0.2); // Should be close to 0
  });

  test("equal alpha/beta centers around 0.5", () => {
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      samples.push(sampleBeta(5, 5));
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });

  test("throws on invalid parameters", () => {
    expect(() => sampleBeta(0, 1)).toThrow();
    expect(() => sampleBeta(1, 0)).toThrow();
    expect(() => sampleBeta(-1, 1)).toThrow();
  });

  test("handles small parameters (< 1)", () => {
    // Should not hang or throw
    for (let i = 0; i < 100; i++) {
      const sample = sampleBeta(0.5, 0.5);
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });
});

describe("ThompsonState", () => {
  let state: ThompsonState;

  beforeEach(() => {
    state = new ThompsonState();
  });

  describe("initialization", () => {
    test("starts with no templates", () => {
      expect(state.getTemplateIds()).toHaveLength(0);
    });

    test("creates stats with default prior", () => {
      const stats = state.getOrCreateStats("template-1");
      expect(stats.templateId).toBe("template-1");
      expect(stats.params.alpha).toBe(1);
      expect(stats.params.beta).toBe(1);
      expect(stats.executionCount).toBe(0);
    });

    test("accepts custom prior", () => {
      state = new ThompsonState({ alpha: 2, beta: 3 });
      const stats = state.getOrCreateStats("template-1");
      expect(stats.params.alpha).toBe(2);
      expect(stats.params.beta).toBe(3);
    });
  });

  describe("sampling", () => {
    test("samples in valid range", () => {
      state.getOrCreateStats("template-1");
      for (let i = 0; i < 100; i++) {
        const sample = state.sample("template-1");
        expect(sample).toBeGreaterThanOrEqual(0);
        expect(sample).toBeLessThanOrEqual(1);
      }
    });

    test("sampleAll returns ranked list", () => {
      // Set up templates with different stats
      state.getOrCreateStats("good").params = { alpha: 10, beta: 1 };
      state.getOrCreateStats("bad").params = { alpha: 1, beta: 10 };
      state.getOrCreateStats("average").params = { alpha: 5, beta: 5 };

      // Sample multiple times - "good" should usually be first
      let goodFirst = 0;
      for (let i = 0; i < 100; i++) {
        const samples = state.sampleAll(["good", "bad", "average"]);
        expect(samples).toHaveLength(3);
        if (samples[0]?.templateId === "good") goodFirst++;
      }

      // "good" should be first most of the time
      expect(goodFirst).toBeGreaterThan(70);
    });

    test("getExpectedRate returns mean of distribution", () => {
      const stats = state.getOrCreateStats("template-1");
      stats.params = { alpha: 7, beta: 3 };

      const expected = state.getExpectedRate("template-1");
      expect(expected).toBeCloseTo(0.7, 1);
    });
  });

  describe("updates", () => {
    test("success increments alpha", () => {
      state.getOrCreateStats("template-1");
      const initialAlpha = state.getStats("template-1")!.params.alpha;

      state.update({
        templateId: "template-1",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });

      expect(state.getStats("template-1")!.params.alpha).toBe(initialAlpha + 1);
    });

    test("failure increments beta", () => {
      state.getOrCreateStats("template-1");
      const initialBeta = state.getStats("template-1")!.params.beta;

      state.update({
        templateId: "template-1",
        success: false,
        durationMs: 1000,
        cost: 0.01,
      });

      expect(state.getStats("template-1")!.params.beta).toBe(initialBeta + 1);
    });

    test("updates execution count", () => {
      state.getOrCreateStats("template-1");

      state.update({
        templateId: "template-1",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });

      expect(state.getStats("template-1")!.executionCount).toBe(1);
    });

    test("updates lastExecutedAt", () => {
      const before = Date.now();
      state.update({
        templateId: "template-1",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });
      const after = Date.now();

      const lastExecuted = state.getStats("template-1")!.lastExecutedAt!;
      expect(lastExecuted).toBeGreaterThanOrEqual(before);
      expect(lastExecuted).toBeLessThanOrEqual(after);
    });

    test("updates running averages", () => {
      state.update({
        templateId: "template-1",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });

      expect(state.getStats("template-1")!.avgDurationMs).toBe(1000);
      expect(state.getStats("template-1")!.avgCost).toBe(0.01);

      // Second update should use exponential moving average
      state.update({
        templateId: "template-1",
        success: true,
        durationMs: 2000,
        cost: 0.02,
      });

      // EMA: 0.9 * old + 0.1 * new
      expect(state.getStats("template-1")!.avgDurationMs).toBeCloseTo(1100, 1);
      expect(state.getStats("template-1")!.avgCost).toBeCloseTo(0.011, 4);
    });
  });

  describe("backend sync", () => {
    test("updateFromBackend imports stats", () => {
      state.updateFromBackend([
        {
          templateId: "backend-1",
          params: { alpha: 5, beta: 2 },
          executionCount: 10,
          lastExecutedAt: 1000,
          avgDurationMs: 500,
          avgCost: 0.005,
        },
      ]);

      const stats = state.getStats("backend-1");
      expect(stats).not.toBeUndefined();
      expect(stats!.params.alpha).toBe(5);
      expect(stats!.params.beta).toBe(2);
    });

    test("updateFromBackend merges with local stats", () => {
      // Create local stats
      state.getOrCreateStats("template-1").params = { alpha: 3, beta: 1 };

      // Import backend stats with higher alpha
      state.updateFromBackend([
        {
          templateId: "template-1",
          params: { alpha: 5, beta: 2 },
          executionCount: 10,
          lastExecutedAt: 1000,
          avgDurationMs: 500,
          avgCost: 0.005,
        },
      ]);

      // Should take max of alpha/beta
      const stats = state.getStats("template-1")!;
      expect(stats.params.alpha).toBe(5); // max(3, 5)
      expect(stats.params.beta).toBe(2); // max(1, 2)
    });
  });

  describe("serialization", () => {
    test("export returns all stats", () => {
      state.update({
        templateId: "template-1",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });
      state.update({
        templateId: "template-2",
        success: false,
        durationMs: 2000,
        cost: 0.02,
      });

      const exported = state.export();
      expect(exported).toHaveLength(2);
      expect(exported.map((s) => s.templateId)).toContain("template-1");
      expect(exported.map((s) => s.templateId)).toContain("template-2");
    });

    test("import restores state", () => {
      const data = [
        {
          templateId: "imported-1",
          params: { alpha: 5, beta: 2 },
          executionCount: 10,
          lastExecutedAt: 1000,
          avgDurationMs: 500,
          avgCost: 0.005,
        },
      ];

      state.import(data);

      expect(state.getStats("imported-1")).not.toBeUndefined();
      expect(state.getStats("imported-1")!.params.alpha).toBe(5);
    });

    test("import clears existing state", () => {
      state.getOrCreateStats("existing");
      state.import([
        {
          templateId: "new",
          params: { alpha: 1, beta: 1 },
          executionCount: 0,
          lastExecutedAt: null,
          avgDurationMs: null,
          avgCost: null,
        },
      ]);

      expect(state.getStats("existing")).toBeUndefined();
      expect(state.getStats("new")).not.toBeUndefined();
    });
  });

  describe("summary", () => {
    test("returns correct summary", () => {
      state.update({
        templateId: "t1",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });
      state.update({
        templateId: "t1",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });
      state.update({
        templateId: "t2",
        success: false,
        durationMs: 2000,
        cost: 0.02,
      });

      const summary = state.getSummary();

      expect(summary.totalTemplates).toBe(2);
      expect(summary.totalExecutions).toBe(3);
      // t1: alpha=3, beta=1; t2: alpha=1, beta=2
      // Total alpha=4, beta=3, rate = 4/7 ≈ 0.571
      expect(summary.avgSuccessRate).toBeCloseTo(0.571, 2);
    });

    test("returns 0.5 for empty state", () => {
      const summary = state.getSummary();
      expect(summary.avgSuccessRate).toBe(0.5);
    });
  });

  describe("exploration vs exploitation", () => {
    test("explores uncertain templates", () => {
      // Template with few observations
      state.getOrCreateStats("uncertain").params = { alpha: 1, beta: 1 };
      // Template with many observations but low success
      state.getOrCreateStats("known-bad").params = { alpha: 10, beta: 90 };

      // Sample many times
      let uncertainWins = 0;
      for (let i = 0; i < 1000; i++) {
        const samples = state.sampleAll(["uncertain", "known-bad"]);
        if (samples[0]?.templateId === "uncertain") uncertainWins++;
      }

      // Uncertain template should win sometimes due to exploration
      // (its variance is high, so it can sample high values)
      expect(uncertainWins).toBeGreaterThan(100); // At least 10% of the time
    });

    test("exploits good templates", () => {
      // Template with strong history
      state.getOrCreateStats("good").params = { alpha: 50, beta: 5 };
      // Template with weak history
      state.getOrCreateStats("ok").params = { alpha: 5, beta: 5 };

      let goodWins = 0;
      for (let i = 0; i < 100; i++) {
        const samples = state.sampleAll(["good", "ok"]);
        if (samples[0]?.templateId === "good") goodWins++;
      }

      // Good template should win most of the time
      expect(goodWins).toBeGreaterThan(90);
    });
  });
});
