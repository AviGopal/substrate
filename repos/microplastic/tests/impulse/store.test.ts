/**
 * ImpulseStore Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ImpulseStore } from "../../src/impulse/store.ts";
import type { VesselProvider, VesselHealth, VesselCapability, ResolverResult } from "../../src/vessel/types.ts";
import type { Impulse, ImpulsePointer, ActivityTemplate } from "../../src/impulse/types.ts";

/**
 * Create a mock resolver vessel
 */
function createMockResolver(
  id: string,
  pointerTypes: string[],
  resolveContent: string = "resolved content"
): VesselProvider {
  return {
    id,
    name: `Mock Resolver ${id}`,
    version: "1.0.0",
    description: `Test resolver ${id}`,

    async initialize(): Promise<void> {},
    async shutdown(): Promise<void> {},

    async healthCheck(): Promise<VesselHealth> {
      return { status: "healthy", checks: [], timestamp: Date.now() };
    },

    getCapabilities(): VesselCapability[] {
      return [];
    },

    canResolve(pointer: ImpulsePointer): boolean {
      return pointerTypes.includes(pointer.type);
    },

    async resolve(_impulse: Impulse): Promise<ResolverResult> {
      return { content: resolveContent };
    },

    getActivityTemplates(): ActivityTemplate[] {
      return [];
    },
  };
}

describe("ImpulseStore", () => {
  let store: ImpulseStore;

  beforeEach(() => {
    store = new ImpulseStore();
  });

  describe("create", () => {
    test("creates an impulse with generated id", () => {
      const impulse = store.create({
        id: "",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      expect(impulse.id).toMatch(/^impulse-/);
      expect(impulse.loaded).toBe(false);
      expect(impulse.createdAt).toBeDefined();
    });

    test("preserves provided id", () => {
      const impulse = store.create({
        id: "custom-id",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      expect(impulse.id).toBe("custom-id");
    });

    test("notifies subscribers on create", () => {
      const events: string[] = [];
      store.subscribe((event) => events.push(event.type));

      store.create({
        id: "test",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      expect(events).toContain("create");
    });
  });

  describe("get", () => {
    test("returns impulse by id", () => {
      const created = store.create({
        id: "test-id",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      const retrieved = store.get("test-id");
      expect(retrieved).toBe(created);
    });

    test("returns undefined for unknown id", () => {
      expect(store.get("unknown")).toBeUndefined();
    });
  });

  describe("load", () => {
    test("resolves and loads impulse content", async () => {
      const resolver = createMockResolver("test", ["memo"], "resolved memo content");
      store.setResolvers([resolver]);

      store.create({
        id: "test-impulse",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      const loaded = await store.load("test-impulse");

      expect(loaded.loaded).toBe(true);
      expect(loaded.content).toBe("resolved memo content");
      expect(loaded.tokenCount).toBeDefined();
    });

    test("throws for unknown impulse", async () => {
      await expect(store.load("unknown")).rejects.toThrow("Impulse not found");
    });

    test("throws when no resolver found", async () => {
      store.create({
        id: "test-impulse",
        pointer: { type: "unknown-type" as never },
        budget: 1000,
        priority: "medium",
      });

      await expect(store.load("test-impulse")).rejects.toThrow("No resolver found");
    });

    test("returns cached content on subsequent loads", async () => {
      const resolver = createMockResolver("test", ["memo"], "original content");
      store.setResolvers([resolver]);

      store.create({
        id: "test-impulse",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      const first = await store.load("test-impulse");

      // Change resolver content
      resolver.resolve = async () => ({ content: "new content" });

      const second = await store.load("test-impulse");

      // Should return cached content
      expect(second.content).toBe(first.content);
    });

    test("truncates content when over budget", async () => {
      const longContent = "x".repeat(10000); // ~2500 tokens
      const resolver = createMockResolver("test", ["memo"], longContent);
      store.setResolvers([resolver]);

      store.create({
        id: "test-impulse",
        pointer: { type: "memo", content: "test" },
        budget: 100, // Very small budget
        priority: "medium",
      });

      const loaded = await store.load("test-impulse");

      expect(loaded.content!.length).toBeLessThan(longContent.length);
      expect(loaded.content).toContain("truncated");
      expect(loaded.metadata?.truncated).toBe(true);
    });
  });

  describe("update", () => {
    test("updates impulse properties", () => {
      store.create({
        id: "test-impulse",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      const updated = store.update("test-impulse", { priority: "high" });

      expect(updated?.priority).toBe("high");
      expect(store.get("test-impulse")?.priority).toBe("high");
    });

    test("returns undefined for unknown id", () => {
      expect(store.update("unknown", { priority: "high" })).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("removes impulse", () => {
      store.create({
        id: "test-impulse",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      expect(store.delete("test-impulse")).toBe(true);
      expect(store.get("test-impulse")).toBeUndefined();
    });

    test("returns false for unknown id", () => {
      expect(store.delete("unknown")).toBe(false);
    });
  });

  describe("list", () => {
    test("returns all impulses", () => {
      store.create({
        id: "impulse-1",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      store.create({
        id: "impulse-2",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "high",
      });

      const list = store.list();
      expect(list).toHaveLength(2);
    });
  });

  describe("stats", () => {
    test("returns store statistics", async () => {
      const resolver = createMockResolver("test", ["memo"], "content");
      store.setResolvers([resolver]);

      store.create({
        id: "impulse-1",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "medium",
      });

      store.create({
        id: "impulse-2",
        pointer: { type: "memo", content: "test" },
        budget: 1000,
        priority: "high",
      });

      await store.load("impulse-1");

      const stats = store.stats();
      expect(stats.total).toBe(2);
      expect(stats.loaded).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });
  });
});
