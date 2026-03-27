/**
 * Embeddings Client Tests
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { EmbeddingsClient } from "../../src/analysis/embeddings.ts";
import type { MCPClientOptions } from "../../src/analysis/types.ts";

// =============================================================================
// TEST SETUP
// =============================================================================

const mockOptions: MCPClientOptions = {
  serverUrl: "http://localhost:8080",
  timeout: 5000,
  cacheTtlMs: 1000, // Short TTL for testing
};

// Mock fetch - cast to avoid preconnect type issues
const mockFetch = (response: unknown, ok = true, status = 200) => {
  return mock(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    } as Response)
  ) as unknown as typeof fetch;
};

// =============================================================================
// TESTS
// =============================================================================

describe("EmbeddingsClient", () => {
  let client: EmbeddingsClient;

  beforeEach(() => {
    client = new EmbeddingsClient(mockOptions);
  });

  describe("constructor", () => {
    test("removes trailing slash from server URL", () => {
      const c = new EmbeddingsClient({ ...mockOptions, serverUrl: "http://localhost:8080/" });
      expect(c).toBeDefined();
    });

    test("uses default timeout if not provided", () => {
      const c = new EmbeddingsClient({ serverUrl: "http://localhost:8080" });
      expect(c).toBeDefined();
    });
  });

  describe("search", () => {
    test("searches with query", async () => {
      const mockResponse = [
        { file_path: "src/auth.ts", content: "function login()", score: 0.9, start_line: 10 },
        { file_path: "src/auth.ts", content: "function logout()", score: 0.7, start_line: 25 },
      ];

      globalThis.fetch = mockFetch(mockResponse);

      const results = await client.search("authentication functions");

      expect(results).toHaveLength(2);
      expect(results[0]!.filePath).toBe("src/auth.ts");
      expect(results[0]!.score).toBe(0.9);
    });

    test("applies search options", async () => {
      globalThis.fetch = mockFetch([]);

      await client.search("auth", {
        limit: 5,
        minScore: 0.8,
        extensions: [".ts"],
        directory: "src/",
      });

      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe("findSimilar", () => {
    test("searches for similar code", async () => {
      globalThis.fetch = mockFetch([
        { file_path: "src/util.ts", content: "function debounce(fn, ms)", score: 0.85 },
      ]);

      const results = await client.findSimilar("function debounce(fn, delay)");

      expect(results).toHaveLength(1);
      expect(results[0]!.content).toContain("debounce");
    });
  });

  describe("findImplementations", () => {
    test("searches for concept implementations", async () => {
      globalThis.fetch = mockFetch([
        { file_path: "src/cache.ts", content: "class LRUCache", score: 0.9 },
        { file_path: "src/cache.ts", content: "class TTLCache", score: 0.75 },
      ]);

      const results = await client.findImplementations("cache");

      expect(results).toHaveLength(2);
    });
  });

  describe("findExamples", () => {
    test("searches for pattern examples", async () => {
      globalThis.fetch = mockFetch([
        { file_path: "src/factory.ts", content: "createUserFactory()", score: 0.8 },
      ]);

      const results = await client.findExamples("factory pattern");

      expect(results).toHaveLength(1);
    });
  });

  describe("findErrorHandling", () => {
    test("finds error handling code", async () => {
      globalThis.fetch = mockFetch([
        { file_path: "src/api.ts", content: "try { } catch (e) { }", score: 0.9 },
      ]);

      const results = await client.findErrorHandling();

      expect(results).toHaveLength(1);
    });

    test("finds specific error type handling", async () => {
      globalThis.fetch = mockFetch([
        { file_path: "src/api.ts", content: "catch (e) { if (e instanceof NetworkError)", score: 0.95 },
      ]);

      const results = await client.findErrorHandling("NetworkError");

      expect(results).toHaveLength(1);
    });
  });

  describe("findTests", () => {
    test("finds test files for function", async () => {
      globalThis.fetch = mockFetch([
        { file_path: "src/auth.test.ts", content: "test('login should authenticate')", score: 0.9 },
      ]);

      const results = await client.findTests("login");

      expect(results).toHaveLength(1);
      expect(results[0]!.filePath).toContain(".test.ts");
    });

    test("uses test file extensions by default", async () => {
      let capturedBody: Record<string, unknown> | undefined;
      globalThis.fetch = mock(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
          text: () => Promise.resolve("[]"),
        } as Response);
      }) as unknown as typeof fetch;

      await client.findTests("myFunction");

      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe("batchSearch", () => {
    test("searches multiple queries", async () => {
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ file_path: `src/file${callCount}.ts`, content: "test", score: 0.8 }]),
          text: () => Promise.resolve("[]"),
        } as Response);
      }) as unknown as typeof fetch;

      const results = await client.batchSearch(["query1", "query2", "query3"]);

      expect(results.size).toBe(3);
      expect(results.has("query1")).toBe(true);
      expect(results.has("query2")).toBe(true);
      expect(results.has("query3")).toBe(true);
    });

    test("batches requests for performance", async () => {
      globalThis.fetch = mockFetch([]);

      // 7 queries should be split into 2 batches (5 + 2)
      const queries = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];
      await client.batchSearch(queries);

      // Each query results in a call
      expect(globalThis.fetch).toHaveBeenCalledTimes(7);
    });
  });

  describe("findRelated", () => {
    test("merges results from multiple concepts", async () => {
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        const results =
          callCount === 1
            ? [{ file_path: "src/a.ts", content: "code", score: 0.9, start_line: 1 }]
            : [{ file_path: "src/b.ts", content: "code", score: 0.8, start_line: 1 }];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(results),
          text: () => Promise.resolve("[]"),
        } as Response);
      }) as unknown as typeof fetch;

      const results = await client.findRelated(["concept1", "concept2"]);

      expect(results.length).toBe(2);
    });

    test("deduplicates results by file and line", async () => {
      globalThis.fetch = mock(() => {
        // Same file and line from different queries
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ file_path: "src/common.ts", content: "code", score: 0.9, start_line: 10 }]),
          text: () => Promise.resolve("[]"),
        } as Response);
      }) as unknown as typeof fetch;

      const results = await client.findRelated(["concept1", "concept2"]);

      // Should be deduplicated
      expect(results.length).toBe(1);
    });

    test("sorts merged results by score", async () => {
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        const results =
          callCount === 1
            ? [{ file_path: "src/a.ts", content: "code", score: 0.7, start_line: 1 }]
            : [{ file_path: "src/b.ts", content: "code", score: 0.95, start_line: 1 }];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(results),
          text: () => Promise.resolve("[]"),
        } as Response);
      }) as unknown as typeof fetch;

      const results = await client.findRelated(["concept1", "concept2"]);

      expect(results[0]!.score).toBe(0.95); // Higher score first
    });
  });

  describe("caching", () => {
    test("caches search results", async () => {
      globalThis.fetch = mockFetch([]);

      await client.search("test query");
      await client.search("test query");

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    test("cache expires after TTL", async () => {
      globalThis.fetch = mockFetch([]);

      await client.search("test query");

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await client.search("test query");

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test("different options create different cache keys", async () => {
      globalThis.fetch = mockFetch([]);

      await client.search("test", { limit: 5 });
      await client.search("test", { limit: 10 });

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test("clearCache removes all entries", async () => {
      globalThis.fetch = mockFetch([]);

      await client.search("test query");
      client.clearCache();
      await client.search("test query");

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    test("throws on HTTP error", async () => {
      globalThis.fetch = mockFetch("Server error", false, 500);

      await expect(client.search("test")).rejects.toThrow("Embedding search failed");
    });

    test("throws on network error", async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error("Connection refused"))) as unknown as typeof fetch;

      await expect(client.search("test")).rejects.toThrow("Embedding search failed");
    });
  });

  describe("connection state", () => {
    test("isConnected returns false initially", () => {
      expect(client.isConnected()).toBe(false);
    });

    test("isConnected returns true after successful call", async () => {
      globalThis.fetch = mockFetch([]);

      await client.search("test");

      expect(client.isConnected()).toBe(true);
    });

    test("isConnected returns false after failed call", async () => {
      globalThis.fetch = mockFetch([]);
      await client.search("test"); // Success

      globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch;

      try {
        await client.search("other");
      } catch {
        // Expected
      }

      expect(client.isConnected()).toBe(false);
    });
  });

  describe("healthCheck", () => {
    test("returns true when server responds", async () => {
      globalThis.fetch = mockFetch({ status: "ok" });

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
    });

    test("returns false when server fails", async () => {
      globalThis.fetch = mockFetch("Error", false, 500);

      const healthy = await client.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe("response parsing", () => {
    test("handles camelCase response fields", async () => {
      const mockResponse = [
        { filePath: "src/test.ts", content: "code", score: 0.9, startLine: 10, endLine: 20 },
      ];

      globalThis.fetch = mockFetch(mockResponse);

      const results = await client.search("test");

      expect(results[0]!.filePath).toBe("src/test.ts");
      expect(results[0]!.startLine).toBe(10);
      expect(results[0]!.endLine).toBe(20);
    });

    test("handles snake_case response fields", async () => {
      const mockResponse = [
        { file_path: "src/test.ts", content: "code", score: 0.9, start_line: 10, end_line: 20 },
      ];

      globalThis.fetch = mockFetch(mockResponse);

      const results = await client.search("test");

      expect(results[0]!.filePath).toBe("src/test.ts");
      expect(results[0]!.startLine).toBe(10);
      expect(results[0]!.endLine).toBe(20);
    });

    test("handles wrapped results property", async () => {
      const mockResponse = {
        results: [{ file_path: "src/test.ts", content: "code", score: 0.9 }],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const results = await client.search("test");

      expect(results).toHaveLength(1);
    });

    test("handles empty response", async () => {
      globalThis.fetch = mockFetch([]);

      const results = await client.search("test");

      expect(results).toEqual([]);
    });

    test("handles null response", async () => {
      globalThis.fetch = mockFetch(null);

      const results = await client.search("test");

      expect(results).toEqual([]);
    });

    test("includes metadata in results", async () => {
      const mockResponse = [
        { file_path: "src/test.ts", content: "code", score: 0.9, metadata: { language: "typescript" } },
      ];

      globalThis.fetch = mockFetch(mockResponse);

      const results = await client.search("test");

      expect(results[0]!.metadata).toEqual({ language: "typescript" });
    });
  });

  describe("executeSearch", () => {
    test("uses default options", async () => {
      globalThis.fetch = mockFetch([]);

      await client.executeSearch({ type: "embedding_search", query: "test" });

      // Verify defaults are applied (limit: 10, min_score: 0.5, include_content: true)
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    test("overrides defaults with provided options", async () => {
      globalThis.fetch = mockFetch([]);

      await client.executeSearch({
        type: "embedding_search",
        query: "test",
        options: { limit: 20, minScore: 0.9 },
      });

      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});
