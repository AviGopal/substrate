/**
 * TUIVessel Tests
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { TUIVessel, TUI_POINTER_TYPES, isTUIPointerType } from "../../src/tui/vessel.ts";
import type { VesselContext } from "../../src/vessel/types.ts";
import { ImpulseStore } from "../../src/impulse/store.ts";
import { VesselEventEmitterImpl } from "../../src/vessel/events.ts";
import type { Impulse } from "@metabob/minibob";
import { Writable } from "stream";

/**
 * Create a mock context
 */
function createMockContext(): VesselContext {
  return {
    impulseStore: new ImpulseStore(),
    config: {
      workingDirectory: process.cwd(),
      developmentMode: true,
      environment: {},
      options: {},
    },
    vessels: new Map(),
    events: new VesselEventEmitterImpl(),
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
}

/**
 * Create a mock stdout that captures output
 */
function createMockStdout(): NodeJS.WriteStream & { output: string } {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  }) as NodeJS.WriteStream & { output: string };

  Object.defineProperty(stream, "output", {
    get: () => output,
    set: (value) => { output = value; },
  });
  Object.defineProperty(stream, "isTTY", { value: false });

  return stream;
}

/**
 * Create a test impulse
 */
function createImpulse(
  type: string,
  extra: Record<string, unknown> = {}
): Impulse {
  return {
    id: `test-${type}`,
    pointer: { type, ...extra } as never,
    budget: 1000,
    priority: "medium",
    loaded: false,
    createdAt: Date.now(),
  };
}

describe("TUIVessel", () => {
  let vessel: TUIVessel;
  let mockStdout: ReturnType<typeof createMockStdout>;

  beforeEach(() => {
    mockStdout = createMockStdout();
    vessel = new TUIVessel({
      renderMode: "text",
      stdout: mockStdout,
      enableInput: false,
    });
  });

  afterEach(async () => {
    await vessel.shutdown();
  });

  describe("identification", () => {
    test("has correct id", () => {
      expect(vessel.id).toBe("tui");
    });

    test("has name and version", () => {
      expect(vessel.name).toBe("Narrative TUI");
      expect(vessel.version).toBe("0.1.0");
    });
  });

  describe("lifecycle", () => {
    test("initializes successfully", async () => {
      const context = createMockContext();
      await vessel.initialize(context);

      const health = await vessel.healthCheck();
      expect(health.status).toBe("healthy");
    });

    test("shuts down cleanly", async () => {
      const context = createMockContext();
      await vessel.initialize(context);
      await vessel.shutdown();

      // Should be degraded after shutdown (renderer stopped)
      const health = await vessel.healthCheck();
      expect(health.status).not.toBe("unhealthy");
    });

    test("health check passes after init", async () => {
      const context = createMockContext();
      await vessel.initialize(context);

      const health = await vessel.healthCheck();

      expect(health.status).toBe("healthy");
      expect(health.checks).toContainEqual(
        expect.objectContaining({ name: "state", status: "pass" })
      );
      expect(health.checks).toContainEqual(
        expect.objectContaining({ name: "renderer", status: "pass" })
      );
    });
  });

  describe("capabilities", () => {
    test("returns TUI capabilities", () => {
      const caps = vessel.getCapabilities();

      expect(caps.length).toBeGreaterThan(0);
      expect(caps.map((c) => c.id)).toContain("tui-user-input");
      expect(caps.map((c) => c.id)).toContain("tui-display");
    });

    test("capabilities have correct structure", () => {
      const caps = vessel.getCapabilities();

      for (const cap of caps) {
        expect(cap).toHaveProperty("id");
        expect(cap).toHaveProperty("name");
        expect(cap).toHaveProperty("description");
        expect(cap).toHaveProperty("category");
        expect(cap).toHaveProperty("resolves");
      }
    });
  });

  describe("resolution", () => {
    test("can resolve TUI pointer types", () => {
      for (const type of TUI_POINTER_TYPES) {
        expect(vessel.canResolve({ type } as never)).toBe(true);
      }
    });

    test("cannot resolve non-TUI pointer types", () => {
      expect(vessel.canResolve({ type: "file" } as never)).toBe(false);
      expect(vessel.canResolve({ type: "memo" } as never)).toBe(false);
      expect(vessel.canResolve({ type: "http" } as never)).toBe(false);
    });

    test("resolves ui_state to current snapshot", async () => {
      await vessel.initialize(createMockContext());

      const impulse = createImpulse("ui_state");
      const result = await vessel.resolve(impulse);

      expect(result.content).toContain("phase");
      expect(result.metadata).toHaveProperty("phase", "idle");
    });

    test("resolves user_input to current input value", async () => {
      await vessel.initialize(createMockContext());

      // Set some input
      vessel.getState().activateInput();
      vessel.getState().setInputValue("test input");

      const impulse = createImpulse("user_input");
      const result = await vessel.resolve(impulse);

      expect(result.content).toBe("test input");
      expect(result.metadata).toHaveProperty("active", true);
    });

    test("resolves display_message", async () => {
      await vessel.initialize(createMockContext());

      const impulse = createImpulse("display_message", { message: "Hello!" });
      const result = await vessel.resolve(impulse);

      expect(result.content).toBe("displayed");
      expect(result.metadata).toHaveProperty("message", "Hello!");
    });

    test("returns error for unknown pointer type", async () => {
      await vessel.initialize(createMockContext());

      const impulse = createImpulse("unknown_type");
      const result = await vessel.resolve(impulse);

      expect(result.metadata).toHaveProperty("error");
    });
  });

  describe("state control", () => {
    beforeEach(async () => {
      await vessel.initialize(createMockContext());
    });

    test("starts thinking", () => {
      vessel.startThinking("test goal");

      expect(vessel.getPhase()).toBe("thinking");
      expect(vessel.getState().goal).toBe("test goal");
    });

    test("starts executing", () => {
      vessel.startThinking("goal");
      vessel.startExecuting("template", 3);

      expect(vessel.getPhase()).toBe("executing");
      expect(vessel.getState().progress?.totalTasks).toBe(3);
    });

    test("updates progress", () => {
      vessel.startThinking("goal");
      vessel.startExecuting("template", 3);
      vessel.updateProgress(1, "Working");

      expect(vessel.getState().progress?.currentTask).toBe(1);
      expect(vessel.getState().progress?.taskName).toBe("Working");
    });

    test("completes successfully", () => {
      vessel.startThinking("goal");
      vessel.startExecuting("template", 2);
      vessel.startVerifying();
      vessel.complete("Done!");

      expect(vessel.getPhase()).toBe("complete");
    });

    test("handles failure", () => {
      vessel.startThinking("goal");
      vessel.startExecuting("template", 2);
      vessel.fail("Error occurred", ["Retry", "Abort"]);

      expect(vessel.getPhase()).toBe("failed");
      expect(vessel.getState().narrative.error).toBe("Error occurred");
    });

    test("resets to idle", () => {
      vessel.startThinking("goal");
      vessel.reset();

      expect(vessel.getPhase()).toBe("idle");
      expect(vessel.getState().goal).toBeNull();
    });
  });

  describe("event subscription", () => {
    beforeEach(async () => {
      await vessel.initialize(createMockContext());
    });

    test("emits phase change events", () => {
      const events: Array<{ from: string; to: string }> = [];

      vessel.on("phase:change", (data) => {
        events.push({ from: data.from, to: data.to });
      });

      vessel.startThinking("goal");
      vessel.startExecuting("template", 2);

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(expect.objectContaining({ from: "idle", to: "thinking" }));
      expect(events[1]).toEqual(expect.objectContaining({ from: "thinking", to: "executing" }));
    });

    test("can unsubscribe from events", () => {
      const events: unknown[] = [];
      const handler = () => events.push(1);

      vessel.on("phase:change", handler);
      vessel.startThinking("goal");
      expect(events).toHaveLength(1);

      vessel.off("phase:change", handler);
      vessel.startExecuting("template", 2);
      expect(events).toHaveLength(1); // No new events
    });
  });

  describe("templates", () => {
    test("returns empty array (TUI has no templates)", () => {
      expect(vessel.getActivityTemplates()).toEqual([]);
    });
  });
});

describe("isTUIPointerType", () => {
  test("returns true for TUI types", () => {
    expect(isTUIPointerType("user_input")).toBe(true);
    expect(isTUIPointerType("user_confirm")).toBe(true);
    expect(isTUIPointerType("user_select")).toBe(true);
    expect(isTUIPointerType("ui_state")).toBe(true);
    expect(isTUIPointerType("display_message")).toBe(true);
  });

  test("returns false for non-TUI types", () => {
    expect(isTUIPointerType("file")).toBe(false);
    expect(isTUIPointerType("memo")).toBe(false);
    expect(isTUIPointerType("http")).toBe(false);
    expect(isTUIPointerType("")).toBe(false);
  });
});
