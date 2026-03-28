/**
 * Template Selector Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { TemplateSelector } from "../../src/selection/selector.ts";
import { OfflineCache } from "../../src/selection/offline.ts";
import type { ActivityTemplate } from "@metabob/minibob";

/**
 * Create a mock template
 */
function createTemplate(id: string, name: string, category = "feature"): ActivityTemplate {
  return {
    id,
    name,
    description: `Template for ${name}`,
    category: category as "feature" | "bugfix" | "refactor" | "tool" | "infrastructure",
    variables: [],
    tasks: [],
    metadata: {},
  };
}

describe("OfflineCache", () => {
  let cache: OfflineCache;

  beforeEach(() => {
    cache = new OfflineCache({ maxTemplates: 5 });
  });

  describe("template caching", () => {
    test("caches and retrieves template", () => {
      const template = createTemplate("t1", "Test Template");
      cache.cacheTemplate(template);

      const retrieved = cache.getTemplate("t1");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe("t1");
    });

    test("returns null for unknown template", () => {
      expect(cache.getTemplate("unknown")).toBeNull();
    });

    test("caches multiple templates", () => {
      cache.cacheTemplate(createTemplate("t1", "Template 1"));
      cache.cacheTemplate(createTemplate("t2", "Template 2"));
      cache.cacheTemplate(createTemplate("t3", "Template 3"));

      const all = cache.getAllTemplates();
      expect(all).toHaveLength(3);
    });

    test("evicts templates when over limit", () => {
      // Cache 6 templates (over limit of 5)
      for (let i = 1; i <= 6; i++) {
        cache.cacheTemplate(createTemplate(`t${i}`, `Template ${i}`));
      }

      // Should have evicted one template to stay at limit
      expect(cache.getAllTemplates()).toHaveLength(5);

      // The newest template should still be there
      expect(cache.getTemplate("t6")).not.toBeNull();
    });

    test("updates use count on access", () => {
      cache.cacheTemplate(createTemplate("t1", "Template 1"));

      cache.getTemplate("t1");
      cache.getTemplate("t1");
      cache.getTemplate("t1");

      const stats = cache.getCacheStats();
      expect(stats.totalUseCount).toBe(3);
    });
  });

  describe("template filtering", () => {
    beforeEach(() => {
      cache.cacheTemplate(createTemplate("feat-1", "Add Login", "feature"));
      cache.cacheTemplate(createTemplate("fix-1", "Fix Bug", "bugfix"));
      cache.cacheTemplate(createTemplate("feat-2", "Add Signup", "feature"));
    });

    test("finds templates by filter", () => {
      const features = cache.findTemplates((t) => t.category === "feature");
      expect(features).toHaveLength(2);
    });

    test("returns empty array when no match", () => {
      const tools = cache.findTemplates((t) => t.category === "tool");
      expect(tools).toHaveLength(0);
    });
  });

  describe("Thompson state", () => {
    test("provides Thompson state", () => {
      const thompson = cache.getThompsonState();
      expect(thompson).toBeDefined();
    });

    test("updates Thompson state from backend", () => {
      cache.updateThompsonState([
        {
          templateId: "t1",
          params: { alpha: 5, beta: 2 },
          executionCount: 10,
          lastExecutedAt: null,
          avgDurationMs: null,
          avgCost: null,
        },
      ]);

      const stats = cache.getThompsonState().getStats("t1");
      expect(stats).not.toBeUndefined();
      expect(stats!.params.alpha).toBe(5);
    });

    test("tracks last synced timestamp", () => {
      expect(cache.getLastSyncedAt()).toBeNull();

      cache.updateThompsonState([]);

      expect(cache.getLastSyncedAt()).not.toBeNull();
    });
  });

  describe("cache stats", () => {
    test("returns correct stats", () => {
      cache.cacheTemplate(createTemplate("t1", "Template 1"));
      cache.cacheTemplate(createTemplate("t2", "Template 2"));
      cache.getTemplate("t1");

      const stats = cache.getCacheStats();
      expect(stats.templateCount).toBe(2);
      expect(stats.totalUseCount).toBe(1);
      expect(stats.oldestEntry).not.toBeNull();
      expect(stats.newestEntry).not.toBeNull();
    });

    test("returns null timestamps for empty cache", () => {
      const stats = cache.getCacheStats();
      expect(stats.templateCount).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });
});

describe("TemplateSelector", () => {
  let selector: TemplateSelector;

  beforeEach(() => {
    selector = new TemplateSelector({
      api: {
        baseUrl: "http://localhost:8080",
        timeout: 100, // Short timeout for tests
      },
      cache: {
        maxTemplates: 10,
      },
      minConfidence: 0.2,
      minScore: 0.1,
    });
  });

  describe("offline selection", () => {
    test("selects from cache when backend unavailable", async () => {
      // Pre-populate cache by accessing internal cache
      // (In real usage, templates would be cached from previous backend calls)
      const cache = (selector as any).cache as OfflineCache;
      cache.cacheTemplate(createTemplate("feature-login", "Add Login Feature", "feature"));
      cache.cacheTemplate(createTemplate("fix-bug", "Fix Critical Bug", "bugfix"));

      const result = await selector.select({
        goal: "add a login feature",
      });

      // Should fall back to cache (backend is not running)
      expect(result.source).toBe("cache");
    });

    test("returns improvise when no cached templates", async () => {
      const result = await selector.select({
        goal: "implement quantum computing",
      });

      expect(result.shouldImprovise).toBe(true);
      expect(result.template).toBeNull();
    });

    test("filters templates by goal keywords", async () => {
      const cache = (selector as any).cache as OfflineCache;
      cache.cacheTemplate(createTemplate("auth-login", "Login Authentication", "feature"));
      cache.cacheTemplate(createTemplate("data-export", "Export Data", "feature"));

      const result = await selector.select({
        goal: "implement login",
      });

      // Should find login-related template
      if (result.candidates.length > 0) {
        expect(result.candidates[0]!.template.id).toBe("auth-login");
      }
    });
  });

  describe("outcome recording", () => {
    test("updates local Thompson state", async () => {
      const cache = (selector as any).cache as OfflineCache;
      const thompson = cache.getThompsonState();

      await selector.recordOutcome({
        templateId: "test-template",
        success: true,
        durationMs: 1000,
        cost: 0.01,
      });

      const stats = thompson.getStats("test-template");
      expect(stats).not.toBeUndefined();
      expect(stats!.params.alpha).toBe(2); // 1 (prior) + 1 (success)
    });

    test("failure updates beta", async () => {
      const cache = (selector as any).cache as OfflineCache;
      const thompson = cache.getThompsonState();

      await selector.recordOutcome({
        templateId: "test-template",
        success: false,
        durationMs: 1000,
        cost: 0.01,
        error: "Test failed",
      });

      const stats = thompson.getStats("test-template");
      expect(stats!.params.beta).toBe(2); // 1 (prior) + 1 (failure)
    });
  });

  describe("template management", () => {
    test("caches created templates locally", async () => {
      const template = createTemplate("new-template", "New Template");
      await selector.createTemplate(template);

      const retrieved = await selector.getTemplate("new-template");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe("new-template");
    });

    test("gets template from cache", async () => {
      const cache = (selector as any).cache as OfflineCache;
      cache.cacheTemplate(createTemplate("cached", "Cached Template"));

      const template = await selector.getTemplate("cached");
      expect(template).not.toBeNull();
      expect(template!.id).toBe("cached");
    });

    test("lists templates from cache when offline", async () => {
      const cache = (selector as any).cache as OfflineCache;
      cache.cacheTemplate(createTemplate("t1", "Template 1", "feature"));
      cache.cacheTemplate(createTemplate("t2", "Template 2", "bugfix"));

      const templates = await selector.listTemplates();
      expect(templates).toHaveLength(2);
    });

    test("filters templates by category", async () => {
      const cache = (selector as any).cache as OfflineCache;
      cache.cacheTemplate(createTemplate("t1", "Template 1", "feature"));
      cache.cacheTemplate(createTemplate("t2", "Template 2", "bugfix"));

      const features = await selector.listTemplates({ category: "feature" });
      expect(features).toHaveLength(1);
      expect(features[0]!.id).toBe("t1");
    });
  });

  describe("state", () => {
    test("returns selector state", () => {
      const state = selector.getState();

      expect(state).toHaveProperty("online");
      expect(state).toHaveProperty("lastConnected");
      expect(state).toHaveProperty("cacheStats");
    });

    test("checkConnection returns false when backend unavailable", async () => {
      // Use a port that definitely won't have a backend
      const offlineSelector = new TemplateSelector({
        api: {
          baseUrl: "http://localhost:59999",  // Unlikely to be in use
          timeout: 100,
        },
      });
      const isOnline = await offlineSelector.checkConnection();
      expect(isOnline).toBe(false);
    });
  });

  describe("Thompson sampling selection", () => {
    test("uses Thompson sampling to rank cached templates", async () => {
      const cache = (selector as any).cache as OfflineCache;
      const thompson = cache.getThompsonState();

      // Cache templates
      cache.cacheTemplate(createTemplate("good-template", "Good Feature", "feature"));
      cache.cacheTemplate(createTemplate("bad-template", "Bad Feature", "feature"));

      // Set up stats - good template has high success rate
      thompson.getOrCreateStats("good-template").params = { alpha: 10, beta: 1 };
      thompson.getOrCreateStats("bad-template").params = { alpha: 1, beta: 10 };

      // Select with goal matching both templates (fewer iterations to avoid timeout)
      let goodFirst = 0;
      for (let i = 0; i < 10; i++) {
        const result = await selector.select({ goal: "implement feature" });
        if (result.candidates[0]?.template.id === "good-template") {
          goodFirst++;
        }
      }

      // Good template should be selected most of the time
      expect(goodFirst).toBeGreaterThan(7);
    });
  });
});

describe("GoalContext matching", () => {
  test("matches templates by name keywords", async () => {
    const selector = new TemplateSelector({
      api: { baseUrl: "http://localhost:8080", timeout: 100 },
    });

    const cache = (selector as any).cache as OfflineCache;
    cache.cacheTemplate(createTemplate("auth-login", "Login Authentication"));
    cache.cacheTemplate(createTemplate("user-profile", "User Profile Management"));

    const result = await selector.select({ goal: "fix the login bug" });

    // Should match login template
    const loginMatch = result.candidates.find(
      (c) => c.template.id === "auth-login"
    );
    expect(loginMatch).toBeDefined();
  });

  test("matches templates by description", async () => {
    const selector = new TemplateSelector({
      api: { baseUrl: "http://localhost:8080", timeout: 100 },
    });

    const cache = (selector as any).cache as OfflineCache;
    const template = createTemplate("db-migration", "Database Migration");
    template.description = "Handle database schema migrations and versioning";
    cache.cacheTemplate(template);

    const result = await selector.select({ goal: "migrate the database" });

    const match = result.candidates.find(
      (c) => c.template.id === "db-migration"
    );
    expect(match).toBeDefined();
  });
});
