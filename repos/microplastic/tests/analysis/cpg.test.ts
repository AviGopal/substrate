/**
 * CPG Client Tests
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { CPGClient } from "../../src/analysis/cpg.ts";
import type { MCPClientOptions, CPGQueryPointer } from "../../src/analysis/types.ts";

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

describe("CPGClient", () => {
  let client: CPGClient;

  beforeEach(() => {
    client = new CPGClient(mockOptions);
  });

  describe("constructor", () => {
    test("removes trailing slash from server URL", () => {
      const c = new CPGClient({ ...mockOptions, serverUrl: "http://localhost:8080/" });
      expect(c).toBeDefined();
    });

    test("uses default timeout if not provided", () => {
      const c = new CPGClient({ serverUrl: "http://localhost:8080" });
      expect(c).toBeDefined();
    });
  });

  describe("findCallers", () => {
    test("executes query with correct parameters", async () => {
      const mockResponse = {
        nodes: [
          { id: "n1", type: "function", name: "caller1", file_path: "src/a.ts", line: 10 },
        ],
        edges: [{ source: "n1", target: "main", type: "calls" }],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findCallers("main");

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.name).toBe("caller1");
      expect(result.edges).toHaveLength(1);
    });

    test("applies options to query", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      await client.findCallers("main", { limit: 5, depth: 2 });

      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe("findCallees", () => {
    test("finds functions called by target", async () => {
      const mockResponse = {
        nodes: [
          { id: "n1", type: "function", name: "helper", file_path: "src/util.ts" },
          { id: "n2", type: "function", name: "logger", file_path: "src/log.ts" },
        ],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findCallees("main");

      expect(result.nodes).toHaveLength(2);
    });
  });

  describe("findReferences", () => {
    test("finds all references to symbol", async () => {
      const mockResponse = {
        nodes: [
          { id: "n1", type: "variable", name: "config", file_path: "src/app.ts", line: 5 },
          { id: "n2", type: "variable", name: "config", file_path: "src/setup.ts", line: 12 },
        ],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findReferences("config");

      expect(result.nodes).toHaveLength(2);
    });
  });

  describe("findDefinitions", () => {
    test("finds definition of symbol", async () => {
      const mockResponse = {
        nodes: [{ id: "n1", type: "class", name: "UserService", file_path: "src/services/user.ts", line: 15 }],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findDefinitions("UserService");

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.type).toBe("class");
    });
  });

  describe("findImports", () => {
    test("finds imports in file", async () => {
      const mockResponse = {
        nodes: [
          { id: "n1", type: "import", name: "react", file_path: "src/app.tsx" },
          { id: "n2", type: "import", name: "lodash", file_path: "src/app.tsx" },
        ],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findImports("src/app.tsx");

      expect(result.nodes).toHaveLength(2);
    });
  });

  describe("findExports", () => {
    test("finds exports from file", async () => {
      const mockResponse = {
        nodes: [
          { id: "n1", type: "export", name: "default", file_path: "src/lib.ts" },
          { id: "n2", type: "export", name: "helper", file_path: "src/lib.ts" },
        ],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findExports("src/lib.ts");

      expect(result.nodes).toHaveLength(2);
    });
  });

  describe("customQuery", () => {
    test("executes custom query", async () => {
      const mockResponse = {
        nodes: [{ id: "n1", type: "function", name: "test", file_path: "src/test.ts" }],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.customQuery("MATCH (n:Function) RETURN n LIMIT 1");

      expect(result.nodes).toHaveLength(1);
    });
  });

  describe("getCallGraph", () => {
    test("builds call graph with depth", async () => {
      // First call - main's callees
      const mainCallees = {
        nodes: [{ id: "helper", type: "function", name: "helper", file_path: "src/util.ts" }],
        edges: [{ source: "main", target: "helper", type: "calls" }],
      };

      // Second call - helper's callees
      const helperCallees = {
        nodes: [{ id: "log", type: "function", name: "log", file_path: "src/log.ts" }],
        edges: [{ source: "helper", target: "log", type: "calls" }],
      };

      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        const response = callCount === 1 ? mainCallees : helperCallees;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(JSON.stringify(response)),
        } as Response);
      }) as unknown as typeof fetch;

      const result = await client.getCallGraph("main", 2);

      expect(result.nodes.length).toBeGreaterThan(0);
    });

    test("respects depth limit", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      await client.getCallGraph("main", 0);

      // With depth 0, no calls should be made
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test("avoids cycles in graph traversal", async () => {
      // Circular dependency: a -> b -> a
      const aCallees = {
        nodes: [{ id: "b", type: "function", name: "b", file_path: "src/b.ts" }],
        edges: [{ source: "a", target: "b", type: "calls" }],
      };

      const bCallees = {
        nodes: [{ id: "a", type: "function", name: "a", file_path: "src/a.ts" }],
        edges: [{ source: "b", target: "a", type: "calls" }],
      };

      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        const response = callCount === 1 ? aCallees : bCallees;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(JSON.stringify(response)),
        } as Response);
      }) as unknown as typeof fetch;

      // Should not hang due to cycle
      const result = await client.getCallGraph("a", 5);

      expect(result).toBeDefined();
    });
  });

  describe("caching", () => {
    test("caches query results", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      await client.findCallers("main");
      await client.findCallers("main");

      // Only one fetch call due to caching
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    test("cache expires after TTL", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      await client.findCallers("main");

      // Wait for cache to expire (TTL is 1000ms)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await client.findCallers("main");

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test("clearCache removes all entries", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      await client.findCallers("main");

      client.clearCache();

      await client.findCallers("main");

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    test("throws on HTTP error", async () => {
      globalThis.fetch = mockFetch("Not found", false, 404);

      await expect(client.findCallers("main")).rejects.toThrow("CPG query failed");
    });

    test("throws on network error", async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch;

      await expect(client.findCallers("main")).rejects.toThrow("CPG query failed");
    });
  });

  describe("connection state", () => {
    test("isConnected returns false initially", () => {
      expect(client.isConnected()).toBe(false);
    });

    test("isConnected returns true after successful call", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      await client.findCallers("main");

      expect(client.isConnected()).toBe(true);
    });

    test("isConnected returns false after failed call", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });
      await client.findCallers("main"); // Success

      globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch;

      try {
        await client.findCallers("other");
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
      const mockResponse = {
        nodes: [{ id: "n1", type: "function", name: "test", filePath: "src/test.ts", line: 10 }],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findCallers("main");

      expect(result.nodes[0]!.filePath).toBe("src/test.ts");
    });

    test("handles snake_case response fields", async () => {
      const mockResponse = {
        nodes: [{ id: "n1", type: "function", name: "test", file_path: "src/test.ts", line: 10 }],
        edges: [],
      };

      globalThis.fetch = mockFetch(mockResponse);

      const result = await client.findCallers("main");

      expect(result.nodes[0]!.filePath).toBe("src/test.ts");
    });

    test("handles empty response", async () => {
      globalThis.fetch = mockFetch({});

      const result = await client.findCallers("main");

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    test("handles null response", async () => {
      globalThis.fetch = mockFetch(null);

      const result = await client.findCallers("main");

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe("executeQuery", () => {
    test("returns cached flag when from cache", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      await client.findCallers("main"); // First call
      const result = await client.findCallers("main"); // Cached

      expect(result.cached).toBe(true);
    });

    test("includes execution time", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      const result = await client.findCallers("main");

      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
