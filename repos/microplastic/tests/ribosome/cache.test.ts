/**
 * Template Cache Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { TemplateCache } from "../../src/ribosome/cache.ts";
import type { ActivityTemplate } from "@metabob/minibob";

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTemplate(id: string, name?: string): ActivityTemplate {
  return {
    id,
    name: name || `Template ${id}`,
    description: `Description for ${id}`,
    category: "feature",
    tasks: [],
    variables: [],
  };
}

function createMetadata(overrides: Record<string, unknown> = {}) {
  return {
    extractedAt: Date.now(),
    sourceExecutionId: `exec_${Math.random().toString(36).slice(2, 8)}`,
    originalGoal: "Test goal",
    extractionConfidence: 0.8,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("TemplateCache", () => {
  let cache: TemplateCache;

  beforeEach(() => {
    cache = new TemplateCache({ maxTemplates: 5 });
  });

  describe("add and get", () => {
    test("adds and retrieves a template", () => {
      const template = createTemplate("tpl_1");
      const metadata = createMetadata();

      cache.add(template, metadata);

      const cached = cache.get("tpl_1");
      expect(cached).toBeDefined();
      expect(cached!.template.id).toBe("tpl_1");
    });

    test("returns undefined for unknown template", () => {
      expect(cache.get("unknown")).toBeUndefined();
    });

    test("getTemplate returns just the template", () => {
      const template = createTemplate("tpl_1");
      cache.add(template, createMetadata());

      const result = cache.getTemplate("tpl_1");
      expect(result).toEqual(template);
    });

    test("has returns true for cached template", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      expect(cache.has("tpl_1")).toBe(true);
      expect(cache.has("unknown")).toBe(false);
    });
  });

  describe("remove", () => {
    test("removes a template", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      const removed = cache.remove("tpl_1");

      expect(removed).toBe(true);
      expect(cache.has("tpl_1")).toBe(false);
    });

    test("returns false for unknown template", () => {
      expect(cache.remove("unknown")).toBe(false);
    });
  });

  describe("getAll", () => {
    test("returns all cached templates", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());
      cache.add(createTemplate("tpl_3"), createMetadata());

      const all = cache.getAll();

      expect(all).toHaveLength(3);
    });

    test("excludes expired templates", () => {
      const expiredCache = new TemplateCache({ cacheTtlMs: 1 });
      expiredCache.add(createTemplate("tpl_1"), createMetadata({ extractedAt: 0 }));

      const all = expiredCache.getAll();

      expect(all).toHaveLength(0);
    });
  });

  describe("eviction", () => {
    test("evicts oldest templates when over limit", () => {
      for (let i = 1; i <= 6; i++) {
        cache.add(createTemplate(`tpl_${i}`), createMetadata());
      }

      // Should have evicted to stay at limit
      expect(cache.getAll().length).toBeLessThanOrEqual(5);

      // Newest should still be there
      expect(cache.has("tpl_6")).toBe(true);
    });

    test("prefers evicting unpromoted templates", () => {
      // Add some templates
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());

      // Mark first as promoted
      cache.markPromoted("tpl_1");

      // Fill up the cache
      for (let i = 3; i <= 7; i++) {
        cache.add(createTemplate(`tpl_${i}`), createMetadata());
      }

      // Promoted template should still be there
      expect(cache.has("tpl_1")).toBe(true);
    });
  });

  describe("execution tracking", () => {
    test("records execution success", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      cache.recordExecution("tpl_1", true, 1000, 0.01);

      const stats = cache.getStats("tpl_1");
      expect(stats!.executions).toBe(1);
      expect(stats!.successes).toBe(1);
      expect(stats!.failures).toBe(0);
    });

    test("records execution failure", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      cache.recordExecution("tpl_1", false, 1000, 0.01);

      const stats = cache.getStats("tpl_1");
      expect(stats!.executions).toBe(1);
      expect(stats!.successes).toBe(0);
      expect(stats!.failures).toBe(1);
    });

    test("updates average duration and cost", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", true, 2000, 0.02);

      const stats = cache.getStats("tpl_1");
      // EMA calculation
      expect(stats!.avgDurationMs).toBeGreaterThan(1000);
      expect(stats!.avgCost).toBeGreaterThan(0.01);
    });

    test("updates lastExecutedAt", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      const before = Date.now();

      cache.recordExecution("tpl_1", true, 1000, 0.01);

      const stats = cache.getStats("tpl_1");
      expect(stats!.lastExecutedAt).toBeGreaterThanOrEqual(before);
    });

    test("getSuccessRate calculates correctly", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", false, 1000, 0.01);

      expect(cache.getSuccessRate("tpl_1")).toBeCloseTo(0.667, 2);
    });

    test("getSuccessRate returns 0 for unknown template", () => {
      expect(cache.getSuccessRate("unknown")).toBe(0);
    });
  });

  describe("promotion tracking", () => {
    test("markPromoted updates metadata", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      cache.markPromoted("tpl_1");

      const cached = cache.get("tpl_1");
      expect(cached!.metadata.promoted).toBe(true);
      expect(cached!.metadata.promotedAt).toBeDefined();
    });

    test("isPromoted returns correct status", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      expect(cache.isPromoted("tpl_1")).toBe(false);

      cache.markPromoted("tpl_1");

      expect(cache.isPromoted("tpl_1")).toBe(true);
    });

    test("getUnpromoted returns only unpromoted templates", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());
      cache.markPromoted("tpl_1");

      const unpromoted = cache.getUnpromoted();

      expect(unpromoted).toHaveLength(1);
      expect(unpromoted[0]!.template.id).toBe("tpl_2");
    });
  });

  describe("getPromotionCandidates", () => {
    test("returns templates meeting criteria", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());

      // tpl_1 gets enough successful executions
      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
      }

      // tpl_2 doesn't have enough
      cache.recordExecution("tpl_2", true, 1000, 0.01);

      const candidates = cache.getPromotionCandidates(3, 0.8);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.template.id).toBe("tpl_1");
    });

    test("excludes templates below success rate", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      // 2 successes, 2 failures = 50% success rate
      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", false, 1000, 0.01);
      cache.recordExecution("tpl_1", false, 1000, 0.01);

      const candidates = cache.getPromotionCandidates(3, 0.8);

      expect(candidates).toHaveLength(0);
    });

    test("excludes already promoted templates", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
      }

      cache.markPromoted("tpl_1");

      const candidates = cache.getPromotionCandidates(3, 0.8);

      expect(candidates).toHaveLength(0);
    });
  });

  describe("getCacheStats", () => {
    test("returns correct statistics", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());
      cache.markPromoted("tpl_1");

      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_2", false, 1000, 0.01);

      const stats = cache.getCacheStats();

      expect(stats.templateCount).toBe(2);
      expect(stats.promotedCount).toBe(1);
      expect(stats.totalExecutions).toBe(2);
      expect(stats.avgSuccessRate).toBe(0.5);
    });

    test("handles empty cache", () => {
      const stats = cache.getCacheStats();

      expect(stats.templateCount).toBe(0);
      expect(stats.promotedCount).toBe(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.avgSuccessRate).toBe(0);
    });
  });

  describe("clear", () => {
    test("removes all templates", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());

      cache.clear();

      expect(cache.getAll()).toHaveLength(0);
    });
  });

  describe("expiration", () => {
    test("expired templates are not returned", () => {
      const shortTtlCache = new TemplateCache({ cacheTtlMs: 100 });

      // Add with very old extraction time
      shortTtlCache.add(createTemplate("tpl_old"), createMetadata({ extractedAt: 0 }));

      expect(shortTtlCache.get("tpl_old")).toBeUndefined();
    });

    test("non-expired templates are returned", () => {
      const shortTtlCache = new TemplateCache({ cacheTtlMs: 60000 });

      shortTtlCache.add(createTemplate("tpl_new"), createMetadata());

      expect(shortTtlCache.get("tpl_new")).toBeDefined();
    });
  });
});
