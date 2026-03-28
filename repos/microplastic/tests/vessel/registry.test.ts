/**
 * VesselRegistry Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { VesselRegistry } from "../../src/vessel/registry.ts";
import type { VesselProvider, VesselContext, VesselHealth, VesselCapability, ResolverResult } from "../../src/vessel/types.ts";
import type { Impulse, ImpulsePointer, ActivityTemplate } from "../../src/impulse/types.ts";
import { VesselAlreadyRegisteredError, VesselInitError } from "../../src/vessel/errors.ts";

/**
 * Create a mock vessel for testing
 */
function createMockVessel(id: string, options: Partial<{
  canResolveTypes: string[];
  initError: boolean;
}> = {}): VesselProvider {
  const { canResolveTypes = [], initError = false } = options;

  return {
    id,
    name: `Mock Vessel ${id}`,
    version: "1.0.0",
    description: `Test vessel ${id}`,

    async initialize(_context: VesselContext): Promise<void> {
      if (initError) {
        throw new Error("Init error");
      }
    },

    async shutdown(): Promise<void> {},

    async healthCheck(): Promise<VesselHealth> {
      return {
        status: "healthy",
        checks: [{ name: "mock", status: "pass" }],
        timestamp: Date.now(),
      };
    },

    getCapabilities(): VesselCapability[] {
      return canResolveTypes.map((type) => ({
        id: `${id}-${type}`,
        name: `${type} resolver`,
        description: `Resolves ${type}`,
        category: "resolver" as const,
        resolves: [type],
      }));
    },

    canResolve(pointer: ImpulsePointer): boolean {
      return canResolveTypes.includes(pointer.type);
    },

    async resolve(impulse: Impulse): Promise<ResolverResult> {
      return {
        content: `Resolved ${impulse.id}`,
        metadata: { source: id },
      };
    },

    getActivityTemplates(): ActivityTemplate[] {
      return [];
    },
  };
}

describe("VesselRegistry", () => {
  let registry: VesselRegistry;

  beforeEach(() => {
    registry = new VesselRegistry({
      workingDirectory: process.cwd(),
      developmentMode: true,
    });
  });

  describe("registration", () => {
    test("registers a vessel", () => {
      const vessel = createMockVessel("test-vessel");
      registry.register(vessel);

      expect(registry.get("test-vessel")).toBe(vessel);
    });

    test("throws on duplicate registration", () => {
      const vessel1 = createMockVessel("test-vessel");
      const vessel2 = createMockVessel("test-vessel");

      registry.register(vessel1);
      expect(() => registry.register(vessel2)).toThrow(VesselAlreadyRegisteredError);
    });

    test("lists all registered vessels", () => {
      const vessel1 = createMockVessel("vessel-1");
      const vessel2 = createMockVessel("vessel-2");

      registry.register(vessel1);
      registry.register(vessel2);

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list).toContain(vessel1);
      expect(list).toContain(vessel2);
    });
  });

  describe("initialization", () => {
    test("initializes all vessels in order", async () => {
      const initOrder: string[] = [];

      const vessel1 = createMockVessel("vessel-1");
      const vessel2 = createMockVessel("vessel-2");

      // Track initialization order
      vessel1.initialize = async () => { initOrder.push("vessel-1"); };
      vessel2.initialize = async () => { initOrder.push("vessel-2"); };

      registry.register(vessel1);
      registry.register(vessel2);

      await registry.initialize();

      expect(initOrder).toEqual(["vessel-1", "vessel-2"]);
      expect(registry.isInitialized()).toBe(true);
    });

    test("throws VesselInitError on failure", async () => {
      const vessel = createMockVessel("failing-vessel", { initError: true });
      registry.register(vessel);

      await expect(registry.initialize()).rejects.toThrow(VesselInitError);
    });

    test("cannot register after initialization", async () => {
      await registry.initialize();

      const vessel = createMockVessel("late-vessel");
      expect(() => registry.register(vessel)).toThrow("Cannot register vessels after initialization");
    });
  });

  describe("shutdown", () => {
    test("shuts down vessels in reverse order", async () => {
      const shutdownOrder: string[] = [];

      const vessel1 = createMockVessel("vessel-1");
      const vessel2 = createMockVessel("vessel-2");

      vessel1.shutdown = async () => { shutdownOrder.push("vessel-1"); };
      vessel2.shutdown = async () => { shutdownOrder.push("vessel-2"); };

      registry.register(vessel1);
      registry.register(vessel2);
      await registry.initialize();

      await registry.shutdown();

      expect(shutdownOrder).toEqual(["vessel-2", "vessel-1"]);
      expect(registry.isInitialized()).toBe(false);
    });
  });

  describe("health checks", () => {
    test("collects health from all vessels", async () => {
      const vessel1 = createMockVessel("vessel-1");
      const vessel2 = createMockVessel("vessel-2");

      registry.register(vessel1);
      registry.register(vessel2);
      await registry.initialize();

      const health = await registry.healthCheck();

      expect(health.size).toBe(2);
      expect(health.get("vessel-1")?.status).toBe("healthy");
      expect(health.get("vessel-2")?.status).toBe("healthy");
    });

    test("handles health check failures gracefully", async () => {
      const vessel = createMockVessel("failing-vessel");
      vessel.healthCheck = async () => { throw new Error("Health check failed"); };

      registry.register(vessel);
      await registry.initialize();

      const health = await registry.healthCheck();

      expect(health.get("failing-vessel")?.status).toBe("unhealthy");
    });
  });

  describe("capabilities", () => {
    test("aggregates capabilities from all vessels", () => {
      const vessel1 = createMockVessel("vessel-1", { canResolveTypes: ["file"] });
      const vessel2 = createMockVessel("vessel-2", { canResolveTypes: ["memo", "http"] });

      registry.register(vessel1);
      registry.register(vessel2);

      const caps = registry.getCapabilities();

      expect(caps).toHaveLength(3);
      expect(caps.map((c) => c.id)).toContain("vessel-1-file");
      expect(caps.map((c) => c.id)).toContain("vessel-2-memo");
      expect(caps.map((c) => c.id)).toContain("vessel-2-http");
    });
  });
});
