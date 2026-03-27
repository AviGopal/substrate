/**
 * Failure Analyzer Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { FailureAnalyzer, type FailureContext } from "../../src/failure/analyzer.ts";
import type { ExecutionTrace, ExecutedTask, ToolCall } from "@metabob/minibob";

// =============================================================================
// TEST HELPERS
// =============================================================================

function createToolCall(
  name: string,
  args: Record<string, unknown> = {},
  success = true,
  error?: string
): ToolCall {
  return {
    id: `call_${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    result: {
      success,
      output: success ? "Done" : undefined,
      error: success ? undefined : error || "Failed",
    },
  };
}

function createTask(
  id: string,
  toolCalls: ToolCall[],
  options: Partial<ExecutedTask> = {}
): ExecutedTask {
  // Determine result status from tool calls
  const hasFailed = toolCalls.some((c) => !c.result.success);
  const defaultResult = hasFailed
    ? { status: "failure" as const, error: "Task failed" }
    : { status: "success" as const };

  return {
    id,
    description: options.description || `Task ${id}`,
    actualPrompt: options.actualPrompt || `Execute task ${id}`,
    toolCalls,
    response: options.response || "Completed",
    result: options.result || defaultResult,
    inputState: options.inputState,
    outputState: options.outputState,
  };
}

function createTrace(tasks: ExecutedTask[]): ExecutionTrace {
  return {
    tasks,
    impulsesCreated: [],
    filesModified: [],
    goalContext: {
      goal: "Test goal",
      intent: "Test intent",
      context: {},
    },
  };
}

function createContext(
  trace: ExecutionTrace,
  options: Partial<FailureContext> = {}
): FailureContext {
  return {
    executionId: options.executionId || `exec_${Date.now()}`,
    templateId: options.templateId || "tpl_test",
    goal: options.goal || trace.goalContext?.goal || "Test goal",
    trace,
    error: options.error,
    durationMs: options.durationMs,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("FailureAnalyzer", () => {
  let analyzer: FailureAnalyzer;

  beforeEach(() => {
    analyzer = new FailureAnalyzer();
  });

  describe("analyze", () => {
    test("identifies failure in tool call", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("read", { file_path: "src/test.ts" }),
          createToolCall("write", { file_path: "src/output.ts" }, false, "Permission denied"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.failurePoint.taskId).toBe("task-1");
      expect(analysis.failurePoint.tool).toBe("write");
      expect(analysis.failurePoint.error).toContain("Permission denied");
    });

    test("identifies failure category from error", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("read", {}, false, "ENOENT: no such file"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.category).toBe("resource");
    });

    test("includes root cause analysis", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("bash", { command: "npm test" }, false, "exit code 1"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.rootCause.primaryCause).toBeTruthy();
      expect(analysis.rootCause.confidence).toBeGreaterThan(0);
    });

    test("provides suggested fixes", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("read", {}, false, "ENOENT: file not found"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.suggestedFixes.length).toBeGreaterThan(0);
    });

    test("categorizes completed and skipped tasks", () => {
      const tasks = [
        createTask("task-1", [createToolCall("read", {})]),
        createTask("task-2", [createToolCall("write", {}, false, "Error")]),
        createTask("task-3", [createToolCall("bash", {})]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.completedTasks).toContain("task-1");
      expect(analysis.skippedTasks).toContain("task-3");
    });

    test("uses provided error when no task failures found", () => {
      const tasks = [createTask("task-1", [createToolCall("read", {})])];
      const trace = createTrace(tasks);
      const context = createContext(trace, { error: "Execution timeout" });

      const analysis = analyzer.analyze(context);

      expect(analysis.failurePoint.error).toContain("timeout");
    });
  });

  describe("findFailurePoint", () => {
    test("finds first failed tool call", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("read", {}),
          createToolCall("edit", {}, false, "Edit failed"),
          createToolCall("write", {}, false, "Write failed"),
        ]),
      ];
      const trace = createTrace(tasks);

      const point = analyzer.findFailurePoint(trace);

      expect(point.stepIndex).toBe(1); // Second tool call (index 1)
      expect(point.tool).toBe("edit");
    });

    test("returns task info when result is failure", () => {
      const tasks = [
        createTask(
          "task-1",
          [createToolCall("bash", {})],
          { result: { status: "failure", error: "Task validation failed" } }
        ),
      ];
      const trace = createTrace(tasks);

      const point = analyzer.findFailurePoint(trace);

      expect(point.taskId).toBe("task-1");
    });

    test("handles empty trace", () => {
      const trace = createTrace([]);

      const point = analyzer.findFailurePoint(trace, "Generic error");

      expect(point.taskId).toBe("unknown");
      expect(point.error).toContain("Generic error");
    });
  });

  describe("matchPattern", () => {
    test("matches ENOENT error", () => {
      const pattern = analyzer.matchPattern("ENOENT: no such file or directory");

      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe("file_not_found");
    });

    test("matches permission denied", () => {
      const pattern = analyzer.matchPattern("EACCES: permission denied");

      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe("permission_denied");
    });

    test("matches syntax error", () => {
      const pattern = analyzer.matchPattern("SyntaxError: Unexpected token");

      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe("syntax_error");
    });

    test("matches timeout", () => {
      const pattern = analyzer.matchPattern("Operation timed out");

      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe("timeout");
    });

    test("matches command failed", () => {
      const pattern = analyzer.matchPattern("Command failed with exit code 1");

      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe("command_failed");
    });

    test("matches network error", () => {
      const pattern = analyzer.matchPattern("ECONNREFUSED: connection refused");

      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe("network_error");
    });

    test("returns undefined for unknown pattern", () => {
      const pattern = analyzer.matchPattern("Some random error");

      expect(pattern).toBeUndefined();
    });
  });

  describe("severity inference", () => {
    test("critical for early failure", () => {
      const tasks = [
        createTask("task-1", [createToolCall("read", {}, false, "Error")]),
        createTask("task-2", [createToolCall("write", {})]),
        createTask("task-3", [createToolCall("bash", {})]),
        createTask("task-4", [createToolCall("edit", {})]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.severity).toBe("critical");
    });

    test("warning for late failure", () => {
      const tasks = [
        createTask("task-1", [createToolCall("read", {})]),
        createTask("task-2", [createToolCall("write", {})]),
        createTask("task-3", [createToolCall("bash", {})]),
        createTask("task-4", [createToolCall("edit", {}, false, "Error")]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.severity).toBe("warning");
    });
  });

  describe("addPattern", () => {
    test("custom patterns are matched", () => {
      analyzer.addPattern({
        id: "custom_error",
        name: "Custom Error",
        description: "A custom error pattern",
        errorPatterns: [/CUSTOM_ERR/],
        category: "logic",
        defaultSeverity: "major",
        suggestedRecovery: ["retry"],
        fixSuggestions: ["Fix the custom issue"],
      });

      const pattern = analyzer.matchPattern("CUSTOM_ERR: something went wrong");

      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe("custom_error");
    });
  });

  describe("root cause analysis", () => {
    test("higher confidence with matched pattern", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("read", {}, false, "ENOENT: file not found"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      expect(analysis.rootCause.confidence).toBeGreaterThanOrEqual(0.5);
      const hasPatternMatch = analysis.rootCause.evidence.some(
        (e) => e.includes("Matched known pattern")
      );
      expect(hasPatternMatch).toBe(true);
    });

    test("includes tool sequence in evidence", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("read", {}),
          createToolCall("edit", {}, false, "Error"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      const hasToolSequence = analysis.rootCause.evidence.some(
        (e) => e.includes("read") && e.includes("edit")
      );
      expect(hasToolSequence).toBe(true);
    });
  });

  describe("fix suggestions", () => {
    test("includes pattern-based suggestions", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("read", {}, false, "ENOENT: no such file"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      // Should have suggestions (pattern-based or tool-based)
      expect(analysis.suggestedFixes.length).toBeGreaterThan(0);
      // Should include read-related suggestion
      const hasReadSuggestion = analysis.suggestedFixes.some(
        (f) => f.description.toLowerCase().includes("file") || f.description.toLowerCase().includes("create")
      );
      expect(hasReadSuggestion).toBe(true);
    });

    test("sorted by confidence", () => {
      const tasks = [
        createTask("task-1", [
          createToolCall("bash", {}, false, "command failed"),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = analyzer.analyze(context);

      for (let i = 1; i < analysis.suggestedFixes.length; i++) {
        expect(analysis.suggestedFixes[i - 1]!.confidence).toBeGreaterThanOrEqual(
          analysis.suggestedFixes[i]!.confidence
        );
      }
    });
  });
});
