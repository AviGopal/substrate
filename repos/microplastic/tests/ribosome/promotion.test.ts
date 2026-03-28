/**
 * Promotion Manager Tests
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { PromotionManager, type PromotionEvent } from "../../src/ribosome/promotion.ts";
import { TemplateCache } from "../../src/ribosome/cache.ts";
import { ActivityAPIClient } from "../../src/selection/client.ts";
import type { ActivityTemplate } from "@metabob/minibob";
import type { PromotionCriteria } from "../../src/ribosome/types.ts";

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

function createMockClient(): ActivityAPIClient {
  const client = new ActivityAPIClient({ baseUrl: "http://localhost:8080" });

  // Mock methods
  (client as any).healthCheck = mock(async () => true);
  (client as any).createTemplate = mock(async () => true);

  return client;
}

// =============================================================================
// TESTS
// =============================================================================

describe("PromotionManager", () => {
  let manager: PromotionManager;
  let cache: TemplateCache;
  let client: ActivityAPIClient;
  let events: PromotionEvent[];
  let criteria: PromotionCriteria;

  beforeEach(() => {
    cache = new TemplateCache();
    client = createMockClient();
    events = [];
    criteria = {
      minExecutions: 3,
      minSuccessRate: 0.8,
      minConfidence: 0.5,
    };

    manager = new PromotionManager({
      client,
      cache,
      criteria,
      autoPromote: true,
      onEvent: (e) => events.push(e),
    });
  });

  describe("checkPromotion", () => {
    test("returns false for unknown template", () => {
      const decision = manager.checkPromotion("unknown");

      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain("not found");
    });

    test("returns false for already promoted template", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.markPromoted("tpl_1");

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain("already promoted");
    });

    test("returns false when below minimum executions", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.recordExecution("tpl_1", true, 1000, 0.01);

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain("more executions");
    });

    test("returns false when below success rate", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      // 2 success, 2 failure = 50% rate
      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", false, 1000, 0.01);
      cache.recordExecution("tpl_1", false, 1000, 0.01);

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain("Success rate");
    });

    test("returns false when below confidence threshold", () => {
      cache.add(createTemplate("tpl_1"), createMetadata({ extractionConfidence: 0.3 }));

      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
      }

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain("confidence");
    });

    test("returns true when all criteria met", () => {
      cache.add(createTemplate("tpl_1"), createMetadata({ extractionConfidence: 0.8 }));

      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
      }

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.shouldPromote).toBe(true);
      expect(decision.readinessScore).toBe(1);
    });

    test("calculates readiness score correctly", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      // 2 of 3 required executions
      cache.recordExecution("tpl_1", true, 1000, 0.01);
      cache.recordExecution("tpl_1", true, 1000, 0.01);

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.readinessScore).toBeCloseTo(0.667, 2);
    });
  });

  describe("checkAllPromotions", () => {
    test("checks all unpromoted templates", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());
      cache.add(createTemplate("tpl_3"), createMetadata());
      cache.markPromoted("tpl_3");

      const results = manager.checkAllPromotions();

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.templateId)).toContain("tpl_1");
      expect(results.map((r) => r.templateId)).toContain("tpl_2");
    });
  });

  describe("promote", () => {
    test("promotes template to backend", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      const result = await manager.promote("tpl_1");

      expect(result.success).toBe(true);
      expect(cache.isPromoted("tpl_1")).toBe(true);
    });

    test("returns error for unknown template", async () => {
      const result = await manager.promote("unknown");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    test("returns error when backend is offline", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      (client as any).healthCheck = mock(async () => false);

      const result = await manager.promote("tpl_1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("offline");
    });

    test("returns error when backend rejects template", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      (client as any).createTemplate = mock(async () => false);

      const result = await manager.promote("tpl_1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("rejected");
    });

    test("emits promotion event on success", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      await manager.promote("tpl_1");

      const promoteEvent = events.find((e) => e.type === "promote");
      expect(promoteEvent).toBeDefined();
      expect(promoteEvent!.templateId).toBe("tpl_1");
    });

    test("emits fail event on error", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      (client as any).healthCheck = mock(async () => false);

      await manager.promote("tpl_1");

      const failEvent = events.find((e) => e.type === "fail");
      expect(failEvent).toBeDefined();
    });
  });

  describe("promoteAll", () => {
    test("promotes all eligible templates", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());

      // Both meet criteria
      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
        cache.recordExecution("tpl_2", true, 1000, 0.01);
      }

      const results = await manager.promoteAll();

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    test("returns empty array when no eligible templates", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      // No executions = not eligible

      const results = await manager.promoteAll();

      expect(results).toHaveLength(0);
    });
  });

  describe("handleExecutionComplete", () => {
    test("records execution and checks promotion", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      // Record first two executions
      await manager.handleExecutionComplete("tpl_1", true, 1000, 0.01);
      await manager.handleExecutionComplete("tpl_1", true, 1000, 0.01);

      // Third should trigger promotion
      const result = await manager.handleExecutionComplete("tpl_1", true, 1000, 0.01);

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
    });

    test("returns null when not eligible", async () => {
      cache.add(createTemplate("tpl_1"), createMetadata());

      const result = await manager.handleExecutionComplete("tpl_1", true, 1000, 0.01);

      expect(result).toBeNull();
    });

    test("returns null when auto-promote disabled", async () => {
      manager.setAutoPromote(false);
      cache.add(createTemplate("tpl_1"), createMetadata());

      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
      }

      const result = await manager.handleExecutionComplete("tpl_1", true, 1000, 0.01);

      expect(result).toBeNull();
    });
  });

  describe("getStats", () => {
    test("returns correct statistics", () => {
      cache.add(createTemplate("tpl_1"), createMetadata());
      cache.add(createTemplate("tpl_2"), createMetadata());
      cache.markPromoted("tpl_1");

      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_2", true, 1000, 0.01);
      }

      const stats = manager.getStats();

      expect(stats.totalCached).toBe(2);
      expect(stats.promoted).toBe(1);
      expect(stats.pendingPromotion).toBe(1);
      expect(stats.eligible).toBe(1);
    });
  });

  describe("configuration", () => {
    test("setCriteria updates criteria", () => {
      manager.setCriteria({ minExecutions: 5 });

      cache.add(createTemplate("tpl_1"), createMetadata());
      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
      }

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain("more executions");
    });

    test("setAutoPromote enables/disables", () => {
      expect((manager as any).autoPromote).toBe(true);

      manager.setAutoPromote(false);

      expect((manager as any).autoPromote).toBe(false);
    });
  });

  describe("maxAge criteria", () => {
    test("rejects templates exceeding maxAge", () => {
      manager.setCriteria({ maxAgeMs: 1000 });

      // Add old template
      cache.add(createTemplate("tpl_1"), createMetadata({ extractedAt: Date.now() - 2000 }));

      for (let i = 0; i < 3; i++) {
        cache.recordExecution("tpl_1", true, 1000, 0.01);
      }

      const decision = manager.checkPromotion("tpl_1");

      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain("too old");
    });
  });
});
