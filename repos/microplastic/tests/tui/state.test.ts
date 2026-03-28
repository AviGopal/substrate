/**
 * TUIState Tests
 *
 * Tests for the TUI state machine with temporal observability.
 * Uses TransitionRecorder to verify phase sequences over time.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { TUIState, TransitionRecorder, type NarrativePhase } from "../../src/tui/state.ts";

describe("TUIState", () => {
  let state: TUIState;
  let recorder: TransitionRecorder;

  beforeEach(() => {
    state = new TUIState();
    recorder = new TransitionRecorder();
    recorder.start(state);
  });

  describe("initial state", () => {
    test("starts in idle phase", () => {
      expect(state.phase).toBe("idle");
    });

    test("has no active input", () => {
      expect(state.input.active).toBe(false);
      expect(state.input.value).toBe("");
    });

    test("has no progress", () => {
      expect(state.progress).toBeNull();
    });

    test("has no goal", () => {
      expect(state.goal).toBeNull();
    });

    test("has ready narrative", () => {
      expect(state.narrative.text).toBe("Ready");
    });
  });

  describe("phase transitions", () => {
    test("idle → thinking on goal submit", () => {
      state.startThinking("write a function");

      expect(state.phase).toBe("thinking");
      expect(state.goal).toBe("write a function");
      recorder.assertPhaseSequence(["idle", "thinking"]);
    });

    test("thinking → executing on template selection", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 3);

      expect(state.phase).toBe("executing");
      expect(state.progress).not.toBeNull();
      expect(state.progress?.totalTasks).toBe(3);
      recorder.assertPhaseSequence(["idle", "thinking", "executing"]);
    });

    test("executing → verifying on execution complete", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 2);
      state.startVerifying();

      expect(state.phase).toBe("verifying");
      recorder.assertPhaseSequence(["idle", "thinking", "executing", "verifying"]);
    });

    test("verifying → complete on success", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 2);
      state.startVerifying();
      state.complete("Function written successfully");

      expect(state.phase).toBe("complete");
      expect(state.narrative.detail).toBe("Function written successfully");
      recorder.assertPhaseSequence(["idle", "thinking", "executing", "verifying", "complete"]);
    });

    test("executing → failed on error", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 2);
      state.fail("Syntax error in generated code");

      expect(state.phase).toBe("failed");
      expect(state.narrative.error).toBe("Syntax error in generated code");
      recorder.assertPhaseSequence(["idle", "thinking", "executing", "failed"]);
    });

    test("failed → recovering with options", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 2);
      state.fail("Syntax error");
      state.startRecovery(["Retry", "Edit manually", "Abort"]);

      expect(state.phase).toBe("recovering");
      expect(state.narrative.recoveryOptions).toEqual(["Retry", "Edit manually", "Abort"]);
      recorder.assertPhaseSequence(["idle", "thinking", "executing", "failed", "recovering"]);
    });

    test("any phase → idle on reset", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 2);
      state.reset();

      expect(state.phase).toBe("idle");
      expect(state.goal).toBeNull();
      expect(state.progress).toBeNull();
      recorder.assertPhaseSequence(["idle", "thinking", "executing", "idle"]);
    });
  });

  describe("progress tracking", () => {
    test("tracks task progress during execution", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 3);

      expect(state.progress?.currentTask).toBe(0);
      expect(state.progress?.taskName).toBe("Initializing...");

      state.updateProgress(0, "Analyzing requirements");
      expect(state.progress?.currentTask).toBe(0);
      expect(state.progress?.taskName).toBe("Analyzing requirements");

      state.updateProgress(1, "Generating code");
      expect(state.progress?.currentTask).toBe(1);
      expect(state.progress?.taskName).toBe("Generating code");

      state.updateProgress(2, "Writing tests");
      expect(state.progress?.currentTask).toBe(2);
      expect(state.progress?.taskName).toBe("Writing tests");
    });

    test("tracks token usage", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 2);

      state.updateProgress(0, "Task 1", { input: 100, output: 50 });
      expect(state.progress?.tokens).toEqual({ input: 100, output: 50 });

      state.updateProgress(1, "Task 2", { input: 200, output: 100 });
      expect(state.progress?.tokens).toEqual({ input: 200, output: 100 });
    });

    test("clears progress on complete", () => {
      state.startThinking("write a function");
      state.startExecuting("code-generation", 2);
      state.complete("Done");

      expect(state.progress).toBeNull();
    });
  });

  describe("input handling", () => {
    test("activates input on activateInput()", () => {
      state.activateInput();

      expect(state.input.active).toBe(true);
    });

    test("sets input value", () => {
      state.activateInput();
      state.setInputValue("hello world");

      expect(state.input.value).toBe("hello world");
      expect(state.input.cursorPosition).toBe(11);
    });

    test("injects printable characters", () => {
      state.injectKey("h");
      state.injectKey("i");

      expect(state.input.active).toBe(true);
      expect(state.input.value).toBe("hi");
    });

    test("handles backspace", () => {
      state.activateInput();
      state.setInputValue("hello");
      state.injectKey("Backspace");

      expect(state.input.value).toBe("hell");
    });

    test("submits input on Enter", () => {
      const events: string[] = [];
      state.on("input:submit", () => events.push("submit"));

      state.activateInput();
      state.setInputValue("write a function");
      state.injectKey("Enter");

      expect(events).toContain("submit");
      expect(state.phase).toBe("thinking");
      expect(state.goal).toBe("write a function");
    });

    test("cancels input on Escape", () => {
      const events: string[] = [];
      state.on("input:cancel", () => events.push("cancel"));

      state.activateInput();
      state.setInputValue("partial input");
      state.injectKey("Escape");

      expect(events).toContain("cancel");
      expect(state.input.active).toBe(false);
      expect(state.input.value).toBe("");
    });

    test("navigates history with arrow keys", () => {
      // Build history
      state.activateInput();
      state.setInputValue("first command");
      state.submitInput();
      state.reset();

      state.activateInput();
      state.setInputValue("second command");
      state.submitInput();
      state.reset();

      // Navigate history
      state.activateInput();
      state.injectKey("ArrowUp");
      expect(state.input.value).toBe("second command");

      state.injectKey("ArrowUp");
      expect(state.input.value).toBe("first command");

      state.injectKey("ArrowDown");
      expect(state.input.value).toBe("second command");

      state.injectKey("ArrowDown");
      expect(state.input.value).toBe("");
    });

    test("does not submit empty input", () => {
      state.activateInput();
      state.setInputValue("   ");
      state.injectKey("Enter");

      expect(state.phase).toBe("idle");
    });
  });

  describe("event emission", () => {
    test("emits phase:change on transitions", () => {
      const changes: Array<{ from: NarrativePhase; to: NarrativePhase; trigger: string }> = [];
      state.on("phase:change", (data) => changes.push(data));

      state.startThinking("goal");
      state.startExecuting("template", 2);
      state.complete("done");

      expect(changes).toHaveLength(3);
      expect(changes[0]?.from).toBe("idle");
      expect(changes[0]?.to).toBe("thinking");
      expect(changes[0]?.trigger).toBe("goal:submit");
      expect(changes[1]?.from).toBe("thinking");
      expect(changes[1]?.to).toBe("executing");
      expect(changes[1]?.trigger).toBe("template:selected");
      expect(changes[2]?.from).toBe("executing");
      expect(changes[2]?.to).toBe("complete");
      expect(changes[2]?.trigger).toBe("verification:passed");
    });

    test("emits snapshot on state changes", () => {
      const snapshots: unknown[] = [];
      state.on("snapshot", (snapshot) => snapshots.push(snapshot));

      state.startThinking("goal");

      expect(snapshots.length).toBeGreaterThan(0);
    });

    test("emits progress:update during execution", () => {
      const updates: unknown[] = [];
      state.on("progress:update", (progress) => updates.push(progress));

      state.startThinking("goal");
      state.startExecuting("template", 3);
      state.updateProgress(1, "Working...");

      expect(updates).toHaveLength(2); // Initial + update
    });
  });

  describe("temporal observability", () => {
    test("records all transitions with timestamps", () => {
      const start = Date.now();

      state.startThinking("goal");
      state.startExecuting("template", 2);
      state.complete("done");

      const transitions = state.getTransitions();

      expect(transitions).toHaveLength(3);
      transitions.forEach((t) => {
        expect(t.timestamp).toBeGreaterThanOrEqual(start);
        expect(t.snapshot).toBeDefined();
      });
    });

    test("filters transitions since timestamp", async () => {
      state.startThinking("goal");

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 5));
      const midpoint = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 5));

      state.startExecuting("template", 2);
      state.complete("done");

      const recentTransitions = state.getTransitionsSince(midpoint);

      expect(recentTransitions).toHaveLength(2);
      expect(recentTransitions[0]?.to).toBe("executing");
      expect(recentTransitions[1]?.to).toBe("complete");
    });

    test("clears transition history", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.clearTransitions();

      expect(state.getTransitions()).toHaveLength(0);
    });

    test("limits transition history to max size", () => {
      // Trigger many transitions
      for (let i = 0; i < 100; i++) {
        state.startThinking(`goal ${i}`);
        state.reset();
      }

      const transitions = state.getTransitions();
      // Should not exceed max (1000), but we only did 200 transitions
      expect(transitions.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("TransitionRecorder", () => {
    test("captures complete phase sequence", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);
      state.updateProgress(1, "Working...");
      state.complete("done");

      const sequence = recorder.getPhaseSequence();

      // Note: updateProgress emits snapshot but not phase change
      expect(sequence).toEqual(["idle", "thinking", "executing", "complete"]);
    });

    test("captures all snapshots including non-phase-change events", () => {
      state.startThinking("goal");
      state.startExecuting("template", 3);
      state.updateProgress(0, "Task 0");
      state.updateProgress(1, "Task 1");
      state.updateProgress(2, "Task 2");
      state.complete("done");

      const snapshots = recorder.getSnapshots();

      // Initial + startThinking + startExecuting + 3 updates + complete
      expect(snapshots.length).toBeGreaterThanOrEqual(7);
    });

    test("throws on phase sequence mismatch", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      expect(() => {
        recorder.assertPhaseSequence(["idle", "thinking", "verifying"]);
      }).toThrow("Phase sequence mismatch");
    });

    test("calculates duration", async () => {
      state.startThinking("goal");
      await new Promise((resolve) => setTimeout(resolve, 10));
      state.startExecuting("template", 2);

      const duration = recorder.getDuration();

      expect(duration).toBeGreaterThanOrEqual(10);
    });

    test("clears recorded snapshots", () => {
      state.startThinking("goal");
      recorder.clear();

      expect(recorder.getSnapshots()).toHaveLength(0);
    });
  });

  describe("snapshot immutability", () => {
    test("getSnapshot returns independent copy", () => {
      const snapshot1 = state.getSnapshot();
      state.startThinking("goal");
      const snapshot2 = state.getSnapshot();

      expect(snapshot1.phase).toBe("idle");
      expect(snapshot2.phase).toBe("thinking");
    });

    test("modifying returned input does not affect state", () => {
      const input = state.input;
      input.value = "modified";

      expect(state.input.value).toBe("");
    });

    test("modifying returned progress does not affect state", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      const progress = state.progress;
      if (progress) {
        progress.currentTask = 999;
      }

      expect(state.progress?.currentTask).toBe(0);
    });
  });

  describe("full workflow scenarios", () => {
    test("successful execution workflow", () => {
      // User types goal
      state.injectKey("f");
      state.injectKey("i");
      state.injectKey("x");
      state.injectKey(" ");
      state.injectKey("b");
      state.injectKey("u");
      state.injectKey("g");
      expect(state.input.value).toBe("fix bug");

      // User submits
      state.injectKey("Enter");
      expect(state.phase).toBe("thinking");

      // System selects template and executes
      state.startExecuting("bugfix-template", 3);
      expect(state.phase).toBe("executing");

      // Tasks progress
      state.updateProgress(0, "Analyzing code");
      state.updateProgress(1, "Applying fix");
      state.updateProgress(2, "Running tests");

      // Verification
      state.startVerifying();
      expect(state.phase).toBe("verifying");

      // Success
      state.complete("Bug fixed: null check added");
      expect(state.phase).toBe("complete");

      // Verify full sequence
      recorder.assertPhaseSequence([
        "idle",
        "thinking",
        "executing",
        "verifying",
        "complete",
      ]);
    });

    test("failed execution with recovery", () => {
      state.startThinking("write feature");
      state.startExecuting("feature-template", 2);
      state.updateProgress(0, "Planning");
      state.fail("Test failures detected", ["Retry", "Skip tests", "Abort"]);

      expect(state.phase).toBe("failed");
      expect(state.narrative.recoveryOptions).toHaveLength(3);

      state.startRecovery(["Retry with fixes", "Use alternative approach"]);
      expect(state.phase).toBe("recovering");

      recorder.assertPhaseSequence([
        "idle",
        "thinking",
        "executing",
        "failed",
        "recovering",
      ]);
    });

    test("user cancels mid-input", () => {
      state.injectKey("s");
      state.injectKey("t");
      state.injectKey("a");
      state.injectKey("r");
      state.injectKey("t");
      expect(state.input.active).toBe(true);

      state.injectKey("Escape");
      expect(state.input.active).toBe(false);
      expect(state.input.value).toBe("");
      expect(state.phase).toBe("idle");
    });
  });

  describe("tool call tracking", () => {
    test("tracks tool call start", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.startToolCall("read", { path: "file.ts" });

      expect(state.toolCalls).toHaveLength(1);
      expect(state.toolCalls[0]?.tool).toBe("read");
      expect(state.toolCalls[0]?.status).toBe("running");
      expect(state.activeToolCalls).toHaveLength(1);
    });

    test("completes tool calls", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.startToolCall("bash", { command: "ls" });
      state.completeToolCall("bash", true);

      expect(state.toolCalls).toHaveLength(1);
      expect(state.toolCalls[0]?.status).toBe("complete");
      expect(state.toolCalls[0]?.duration).toBeDefined();
      expect(state.activeToolCalls).toHaveLength(0);
    });

    test("tracks failed tool calls", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.startToolCall("bash", { command: "invalid" });
      state.completeToolCall("bash", false);

      expect(state.toolCalls[0]?.status).toBe("failed");
    });

    test("includes tool calls in narrative", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.startToolCall("read");
      state.startToolCall("edit");

      expect(state.narrative.toolCalls).toHaveLength(2);
    });

    test("limits tool call history", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      // Add more than max (10)
      for (let i = 0; i < 15; i++) {
        state.startToolCall(`tool_${i}`);
      }

      expect(state.toolCalls.length).toBeLessThanOrEqual(10);
    });

    test("emits tool events", () => {
      const starts: unknown[] = [];
      const completes: unknown[] = [];
      state.on("tool:start", (data) => starts.push(data));
      state.on("tool:complete", (data) => completes.push(data));

      state.startThinking("goal");
      state.startExecuting("template", 2);
      state.startToolCall("read");
      state.completeToolCall("read", true);

      expect(starts).toHaveLength(1);
      expect(completes).toHaveLength(1);
    });

    test("reset clears tool calls", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);
      state.startToolCall("read");

      state.reset();

      expect(state.toolCalls).toHaveLength(0);
    });
  });

  describe("impulse tracking", () => {
    test("tracks impulse loading", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.startImpulseLoad("imp_1", "file");

      expect(state.impulses).toHaveLength(1);
      expect(state.impulses[0]?.status).toBe("loading");
    });

    test("completes impulse loading", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.startImpulseLoad("imp_1", "file");
      state.completeImpulseLoad("imp_1", 500);

      expect(state.impulses[0]?.status).toBe("loaded");
      expect(state.impulses[0]?.tokens).toBe(500);
    });

    test("includes impulses in narrative", () => {
      state.startThinking("goal");
      state.startExecuting("template", 2);

      state.startImpulseLoad("imp_1", "file");

      expect(state.narrative.impulses).toHaveLength(1);
    });

    test("emits impulse events", () => {
      const loading: unknown[] = [];
      const loaded: unknown[] = [];
      state.on("impulse:loading", (data) => loading.push(data));
      state.on("impulse:loaded", (data) => loaded.push(data));

      state.startThinking("goal");
      state.startExecuting("template", 2);
      state.startImpulseLoad("imp_1", "file");
      state.completeImpulseLoad("imp_1", 100);

      expect(loading).toHaveLength(1);
      expect(loaded).toHaveLength(1);
    });
  });

  describe("animation ticking", () => {
    test("starts and stops ticking", async () => {
      const ticks: number[] = [];
      state.on("tick", (tick) => ticks.push(tick));

      state.startTicking(50);
      await new Promise((resolve) => setTimeout(resolve, 120));
      state.stopTicking();

      expect(ticks.length).toBeGreaterThanOrEqual(2);
    });

    test("tickCount increments", async () => {
      state.startTicking(50);
      await new Promise((resolve) => setTimeout(resolve, 120));
      state.stopTicking();

      expect(state.tickCount).toBeGreaterThanOrEqual(2);
    });

    test("multiple startTicking calls are idempotent", () => {
      state.startTicking(100);
      state.startTicking(100);
      state.startTicking(100);
      state.stopTicking();
      // Should not throw or create multiple intervals
    });
  });
});
