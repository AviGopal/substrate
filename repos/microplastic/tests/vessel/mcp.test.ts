/**
 * MCP Vessel Tests
 */

import { describe, test, expect, beforeEach, mock, afterEach } from "bun:test";
import { MCPVessel } from "../../src/vessel/mcp.ts";
import type { VesselContext, VesselConfig } from "../../src/vessel/types.ts";
import type { Impulse, ImpulsePointer } from "@metabob/minibob";

// =============================================================================
// TEST SETUP
// =============================================================================

// Store original fetch for cleanup
const originalFetch = globalThis.fetch;

const createMockContext = (overrides: Partial<VesselContext> = {}): VesselContext => {
  const config: VesselConfig = {
    developmentMode: true,
    workingDirectory: "/test",
    environment: {
      MCP_SERVER_URL: "http://localhost:8080",
    },
    options: {},
  };

  return {
    impulseStore: {
      create: mock(() => ({ id: "test" })),
      get: mock(() => undefined),
      load: mock(() => Promise.resolve({ id: "test" })),
      update: mock(() => undefined),
      delete: mock(() => false),
      list: mock(() => []),
      subscribe: mock(() => () => {}),
    } as unknown as VesselContext["impulseStore"],
    config,
    vessels: new Map(),
    events: {
      on: mock(() => {}),
      off: mock(() => {}),
      emit: mock(() => {}),
    },
    logger: {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    },
    ...overrides,
  };
};

const createImpulse = (
  pointer: ImpulsePointer,
  options: Partial<Impulse> = {}
): Impulse => ({
  id: `imp_${Math.random().toString(36).slice(2, 8)}`,
  pointer,
  budget: 2000,
  priority: "medium",
  loaded: false,
  createdAt: Date.now(),
  ...options,
});

// Mock fetch helper - cast to avoid preconnect type issues
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

describe("MCPVessel", () => {
  let vessel: MCPVessel;
  let context: VesselContext;

  beforeEach(() => {
    vessel = new MCPVessel();
    context = createMockContext();
  });

  afterEach(async () => {
    // Restore original fetch to prevent test interference
    globalThis.fetch = originalFetch;

    try {
      await vessel.shutdown();
    } catch {
      // Ignore shutdown errors in tests
    }
  });

  describe("identity", () => {
    test("has correct id", () => {
      expect(vessel.id).toBe("@metabob/mcp");
    });

    test("has correct name", () => {
      expect(vessel.name).toBe("MCP Analysis Vessel");
    });

    test("has version", () => {
      expect(vessel.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("has description", () => {
      expect(vessel.description).toBeTruthy();
    });
  });

  describe("initialize", () => {
    test("initializes with MCP server URL from environment", async () => {
      await vessel.initialize(context);

      expect(context.logger.info).toHaveBeenCalled();
    });

    test("uses fallback URL if not in environment", async () => {
      context.config.environment = {};

      await vessel.initialize(context);

      // Should use default URL
      expect(context.logger.info).toHaveBeenCalled();
    });

    test("uses URL from config options", async () => {
      context.config.environment = {};
      context.config.options.mcpServerUrl = "http://custom:9090";

      await vessel.initialize(context);

      expect(context.logger.info).toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    test("clears caches on shutdown", async () => {
      await vessel.initialize(context);
      await vessel.shutdown();

      expect(context.logger.info).toHaveBeenCalled();
    });

    test("handles shutdown when not initialized", async () => {
      // Should not throw
      await vessel.shutdown();
    });
  });

  describe("healthCheck", () => {
    test("returns healthy when both services are up", async () => {
      await vessel.initialize(context);

      globalThis.fetch = mockFetch({ status: "ok" });

      const health = await vessel.healthCheck();

      expect(health.status).toBe("healthy");
      expect(health.checks).toHaveLength(2);
    });

    test("returns degraded when one service is down", async () => {
      await vessel.initialize(context);

      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: "ok" }),
            text: () => Promise.resolve("ok"),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve("error"),
        } as Response);
      }) as unknown as typeof fetch;

      const health = await vessel.healthCheck();

      expect(health.status).toBe("degraded");
    });

    test("returns degraded when services fail", async () => {
      await vessel.initialize(context);

      // Services return false (not throw) when health check fails
      globalThis.fetch = mock(() => Promise.reject(new Error("Connection refused"))) as unknown as typeof fetch;

      const health = await vessel.healthCheck();

      // Services catch errors and return false, which maps to "warn" status
      expect(health.status).toBe("degraded");
    });

    test("returns unhealthy when not initialized", async () => {
      const health = await vessel.healthCheck();

      expect(health.status).toBe("unhealthy");
      expect(health.checks.some((c) => c.message?.includes("not initialized"))).toBe(true);
    });
  });

  describe("getCapabilities", () => {
    test("declares CPG query capability", () => {
      const capabilities = vessel.getCapabilities();

      const cpg = capabilities.find((c) => c.id === "cpg_query");
      expect(cpg).toBeDefined();
      expect(cpg!.resolves).toContain("cpg_query");
    });

    test("declares embedding search capability", () => {
      const capabilities = vessel.getCapabilities();

      const embed = capabilities.find((c) => c.id === "embedding_search");
      expect(embed).toBeDefined();
      expect(embed!.resolves).toContain("embedding_search");
    });

    test("declares impact analysis capability", () => {
      const capabilities = vessel.getCapabilities();

      const impact = capabilities.find((c) => c.id === "impact_analysis");
      expect(impact).toBeDefined();
      expect(impact!.resolves).toContain("impact_analysis");
    });
  });

  describe("canResolve", () => {
    test("returns true for cpg_query", () => {
      const pointer = { type: "cpg_query", queryType: "find_callers", target: "main" };

      expect(vessel.canResolve(pointer as unknown as ImpulsePointer)).toBe(true);
    });

    test("returns true for embedding_search", () => {
      const pointer = { type: "embedding_search", query: "test" };

      expect(vessel.canResolve(pointer as unknown as ImpulsePointer)).toBe(true);
    });

    test("returns true for impact_analysis", () => {
      const pointer = { type: "impact_analysis", files: ["src/a.ts"] };

      expect(vessel.canResolve(pointer as unknown as ImpulsePointer)).toBe(true);
    });

    test("returns false for file pointer", () => {
      const pointer = { type: "file", path: "/test" };

      expect(vessel.canResolve(pointer as ImpulsePointer)).toBe(false);
    });

    test("returns false for memo pointer", () => {
      const pointer = { type: "memo", content: "test" };

      expect(vessel.canResolve(pointer as ImpulsePointer)).toBe(false);
    });
  });

  describe("resolve", () => {
    beforeEach(async () => {
      await vessel.initialize(context);
    });

    describe("cpg_query", () => {
      test("resolves CPG query", async () => {
        globalThis.fetch = mockFetch({
          nodes: [
            { id: "n1", type: "function", name: "caller", file_path: "src/a.ts", line: 10 },
          ],
          edges: [],
        });

        const impulse = createImpulse({
          type: "cpg_query",
          queryType: "find_callers",
          target: "main",
        } as unknown as ImpulsePointer);

        const result = await vessel.resolve(impulse);

        expect(result.content).toContain("find_callers");
        expect(result.content).toContain("caller");
        expect(result.metadata?.source).toBe("cpg");
      });

      test("formats empty results", async () => {
        globalThis.fetch = mockFetch({ nodes: [], edges: [] });

        const impulse = createImpulse({
          type: "cpg_query",
          queryType: "find_callers",
          target: "nonexistent",
        } as unknown as ImpulsePointer);

        const result = await vessel.resolve(impulse);

        expect(result.content).toContain("No results found");
      });
    });

    describe("embedding_search", () => {
      test("resolves embedding search", async () => {
        globalThis.fetch = mockFetch([
          { file_path: "src/auth.ts", content: "function login()", score: 0.9, start_line: 10 },
        ]);

        const impulse = createImpulse({
          type: "embedding_search",
          query: "authentication",
        } as unknown as ImpulsePointer);

        const result = await vessel.resolve(impulse);

        expect(result.content).toContain("Semantic Search");
        expect(result.content).toContain("authentication");
        expect(result.content).toContain("login");
        expect(result.metadata?.source).toBe("embeddings");
      });

      test("formats empty results", async () => {
        globalThis.fetch = mockFetch([]);

        const impulse = createImpulse({
          type: "embedding_search",
          query: "nonexistent code",
        } as unknown as ImpulsePointer);

        const result = await vessel.resolve(impulse);

        expect(result.content).toContain("No results found");
      });
    });

    describe("impact_analysis", () => {
      test("resolves impact analysis", async () => {
        // First call - exports, second call - callers
        let callCount = 0;
        globalThis.fetch = mock(() => {
          callCount++;
          const response =
            callCount === 1
              ? { nodes: [{ id: "n1", type: "export", name: "helper", file_path: "src/lib.ts" }], edges: [] }
              : { nodes: [{ id: "n2", type: "function", name: "main", file_path: "src/app.ts" }], edges: [] };
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(response),
            text: () => Promise.resolve(JSON.stringify(response)),
          } as Response);
        }) as unknown as typeof fetch;

        const impulse = createImpulse({
          type: "impact_analysis",
          files: ["src/lib.ts"],
          depth: 2,
        } as unknown as ImpulsePointer);

        const result = await vessel.resolve(impulse);

        expect(result.content).toContain("Impact Analysis");
        expect(result.content).toContain("src/lib.ts");
        expect(result.metadata?.source).toBe("impact_analysis");
      });
    });

    describe("error handling", () => {
      test("throws when not initialized", async () => {
        await vessel.shutdown();

        const impulse = createImpulse({
          type: "cpg_query",
          queryType: "find_callers",
          target: "main",
        } as unknown as ImpulsePointer);

        await expect(vessel.resolve(impulse)).rejects.toThrow("not initialized");
      });

      test("throws for unknown pointer type", async () => {
        const impulse = createImpulse({
          type: "unknown_type",
        } as unknown as ImpulsePointer);

        await expect(vessel.resolve(impulse)).rejects.toThrow("Unknown pointer type");
      });

      test("throws when CPG query fails", async () => {
        globalThis.fetch = mockFetch("Error", false, 500);

        const impulse = createImpulse({
          type: "cpg_query",
          queryType: "find_callers",
          target: "main",
        } as unknown as ImpulsePointer);

        await expect(vessel.resolve(impulse)).rejects.toThrow("CPG query failed");
      });

      test("throws when embedding search fails", async () => {
        globalThis.fetch = mockFetch("Error", false, 500);

        const impulse = createImpulse({
          type: "embedding_search",
          query: "test",
        } as unknown as ImpulsePointer);

        await expect(vessel.resolve(impulse)).rejects.toThrow("Embedding search failed");
      });
    });
  });

  describe("getActivityTemplates", () => {
    test("returns empty array", () => {
      const templates = vessel.getActivityTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe("getBootstrapTemplates", () => {
    test("returns empty array", () => {
      const templates = vessel.getBootstrapTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe("client access", () => {
    test("getCPGClient returns null before initialization", () => {
      expect(vessel.getCPGClient()).toBeNull();
    });

    test("getCPGClient returns client after initialization", async () => {
      await vessel.initialize(context);

      expect(vessel.getCPGClient()).not.toBeNull();
    });

    test("getEmbeddingsClient returns null before initialization", () => {
      expect(vessel.getEmbeddingsClient()).toBeNull();
    });

    test("getEmbeddingsClient returns client after initialization", async () => {
      await vessel.initialize(context);

      expect(vessel.getEmbeddingsClient()).not.toBeNull();
    });
  });

  describe("result formatting", () => {
    beforeEach(async () => {
      await vessel.initialize(context);
    });

    test("CPG results include node count in metadata", async () => {
      globalThis.fetch = mockFetch({
        nodes: [
          { id: "n1", type: "function", name: "a", file_path: "src/a.ts" },
          { id: "n2", type: "function", name: "b", file_path: "src/b.ts" },
        ],
        edges: [{ source: "n1", target: "n2", type: "calls" }],
      });

      const impulse = createImpulse({
        type: "cpg_query",
        queryType: "find_callees",
        target: "main",
      } as unknown as ImpulsePointer);

      const result = await vessel.resolve(impulse);

      expect(result.metadata?.nodeCount).toBe(2);
      expect(result.metadata?.edgeCount).toBe(1);
    });

    test("embedding results include result count in metadata", async () => {
      globalThis.fetch = mockFetch([
        { file_path: "src/a.ts", content: "code1", score: 0.9 },
        { file_path: "src/b.ts", content: "code2", score: 0.8 },
        { file_path: "src/c.ts", content: "code3", score: 0.7 },
      ]);

      const impulse = createImpulse({
        type: "embedding_search",
        query: "test",
      } as unknown as ImpulsePointer);

      const result = await vessel.resolve(impulse);

      expect(result.metadata?.resultCount).toBe(3);
    });

    test("impact analysis includes analyzed and affected counts", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      const impulse = createImpulse({
        type: "impact_analysis",
        files: ["src/a.ts", "src/b.ts"],
        depth: 1,
      } as unknown as ImpulsePointer);

      const result = await vessel.resolve(impulse);

      expect(result.metadata?.analyzedFiles).toBe(2);
      expect(result.metadata?.affectedFiles).toBeDefined();
    });

    test("results have markdown content type", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      const impulse = createImpulse({
        type: "cpg_query",
        queryType: "find_callers",
        target: "main",
      } as unknown as ImpulsePointer);

      const result = await vessel.resolve(impulse);

      expect(result.metadata?.contentType).toBe("text/markdown");
    });

    test("results include resolvedAt timestamp", async () => {
      globalThis.fetch = mockFetch({ nodes: [], edges: [] });

      const before = Date.now();
      const impulse = createImpulse({
        type: "cpg_query",
        queryType: "find_callers",
        target: "main",
      } as unknown as ImpulsePointer);

      const result = await vessel.resolve(impulse);
      const after = Date.now();

      expect(result.metadata?.resolvedAt).toBeGreaterThanOrEqual(before);
      expect(result.metadata?.resolvedAt).toBeLessThanOrEqual(after);
    });
  });
});
