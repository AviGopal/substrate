/**
 * TextRenderer Tests
 *
 * Tests for the text-based renderer used in non-TTY environments and tests.
 */

import { describe, test, expect } from "bun:test";
import { TextRenderer } from "../../src/tui/renderer.ts";
import type { TUISnapshot, NarrativePhase } from "../../src/tui/state.ts";

/**
 * Create a test snapshot with given properties
 */
function createSnapshot(overrides: Partial<TUISnapshot> = {}): TUISnapshot {
  return {
    phase: "idle" as NarrativePhase,
    input: {
      active: false,
      value: "",
      cursorPosition: 0,
      history: [],
      historyIndex: -1,
    },
    progress: null,
    narrative: { text: "Ready" },
    goal: null,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("TextRenderer", () => {
  describe("header rendering", () => {
    test("renders idle state with symbol", () => {
      const snapshot = createSnapshot({ phase: "idle" });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("○"); // idle symbol
      expect(output).toContain("microplastic");
    });

    test("renders goal when present", () => {
      const snapshot = createSnapshot({
        phase: "thinking",
        goal: "write a function to sort arrays",
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("◐"); // thinking symbol
      expect(output).toContain("write a function to sort arrays");
    });

    test("renders executing state", () => {
      const snapshot = createSnapshot({ phase: "executing" });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("●"); // executing symbol
    });

    test("renders complete state", () => {
      const snapshot = createSnapshot({ phase: "complete" });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("✓"); // complete symbol
    });

    test("renders failed state", () => {
      const snapshot = createSnapshot({ phase: "failed" });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("✗"); // failed symbol
    });

    test("renders recovering state", () => {
      const snapshot = createSnapshot({ phase: "recovering" });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("⟳"); // recovering symbol
    });
  });

  describe("input rendering", () => {
    test("renders placeholder when input inactive in idle", () => {
      const snapshot = createSnapshot({
        phase: "idle",
        input: {
          active: false,
          value: "",
          cursorPosition: 0,
          history: [],
          historyIndex: -1,
        },
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("Type to enter a goal...");
    });

    test("renders input value when active", () => {
      const snapshot = createSnapshot({
        phase: "idle",
        input: {
          active: true,
          value: "fix the bug",
          cursorPosition: 11,
          history: [],
          historyIndex: -1,
        },
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("❯ fix the bug");
    });
  });

  describe("progress rendering", () => {
    test("renders progress bar when executing", () => {
      const snapshot = createSnapshot({
        phase: "executing",
        progress: {
          currentTask: 1,
          totalTasks: 3,
          taskName: "Generating code",
          startedAt: Date.now(),
          tokens: { input: 100, output: 50 },
          cost: 0,
        },
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("[33%]"); // 1/3 = 33%
      expect(output).toContain("Task 2/3"); // currentTask + 1
      expect(output).toContain("Generating code");
    });

    test("renders 0% for first task", () => {
      const snapshot = createSnapshot({
        phase: "executing",
        progress: {
          currentTask: 0,
          totalTasks: 2,
          taskName: "Initializing",
          startedAt: Date.now(),
          tokens: { input: 0, output: 0 },
          cost: 0,
        },
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("[0%]");
      expect(output).toContain("Task 1/2");
    });
  });

  describe("narrative rendering", () => {
    test("renders narrative text", () => {
      const snapshot = createSnapshot({
        narrative: { text: "Working on your request..." },
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("Working on your request...");
    });

    test("renders narrative detail", () => {
      const snapshot = createSnapshot({
        narrative: {
          text: "Executing",
          detail: "Step 2 of 3: Writing tests",
        },
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("Executing");
      expect(output).toContain("Step 2 of 3: Writing tests");
    });

    test("renders error message", () => {
      const snapshot = createSnapshot({
        phase: "failed",
        narrative: {
          text: "Failed",
          error: "Compilation error: undefined variable 'x'",
        },
      });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("Failed");
      expect(output).toContain("Error: Compilation error: undefined variable 'x'");
    });
  });

  describe("status line rendering", () => {
    test("renders phase in uppercase", () => {
      const snapshot = createSnapshot({ phase: "executing" });
      const output = TextRenderer.render(snapshot);

      expect(output).toContain("[EXECUTING]");
    });

    test("renders different phases", () => {
      const phases: NarrativePhase[] = [
        "idle",
        "thinking",
        "executing",
        "verifying",
        "complete",
        "failed",
        "recovering",
      ];

      for (const phase of phases) {
        const snapshot = createSnapshot({ phase });
        const output = TextRenderer.render(snapshot);
        expect(output).toContain(`[${phase.toUpperCase()}]`);
      }
    });
  });

  describe("complete output structure", () => {
    test("renders complete executing state", () => {
      const snapshot = createSnapshot({
        phase: "executing",
        goal: "implement sorting",
        input: { active: false, value: "", cursorPosition: 0, history: [], historyIndex: -1 },
        progress: {
          currentTask: 1,
          totalTasks: 3,
          taskName: "Writing algorithm",
          startedAt: Date.now() - 5000, // 5 seconds ago
          tokens: { input: 150, output: 75 },
          cost: 0.002,
        },
        narrative: {
          text: "Executing: sorting-template",
          detail: "Task 2/3: Writing algorithm",
        },
      });

      const output = TextRenderer.render(snapshot);
      const lines = output.split("\n");

      // Header with symbol, name, and goal
      expect(lines[0]).toContain("●");
      expect(lines[0]).toContain("microplastic");
      expect(lines[0]).toContain("implement sorting");

      // Progress
      expect(output).toContain("[33%]");

      // Status
      expect(output).toContain("[EXECUTING]");
    });

    test("renders complete idle state", () => {
      const snapshot = createSnapshot({
        phase: "idle",
        narrative: { text: "Ready" },
      });

      const output = TextRenderer.render(snapshot);

      expect(output).toContain("○ microplastic");
      expect(output).toContain("Type to enter a goal...");
      expect(output).toContain("Ready");
      expect(output).toContain("[IDLE]");
    });

    test("renders complete failed state with error", () => {
      const snapshot = createSnapshot({
        phase: "failed",
        goal: "fix bug",
        narrative: {
          text: "Failed",
          error: "Tests still failing after fix",
        },
      });

      const output = TextRenderer.render(snapshot);

      expect(output).toContain("✗");
      expect(output).toContain("fix bug");
      expect(output).toContain("Failed");
      expect(output).toContain("Error: Tests still failing after fix");
      expect(output).toContain("[FAILED]");
    });
  });
});
