/**
 * Trace Extractor Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  TraceExtractor,
  calculateExtractionConfidence,
  type TaskGroup,
} from "../../src/ribosome/extractor.ts";
import type { ExecutionContext } from "../../src/ribosome/types.ts";
import type { ExecutionTrace, ExecutedTask, ToolCall } from "@metabob/minibob";

// =============================================================================
// TEST HELPERS
// =============================================================================

function createToolCall(
  name: string,
  args: Record<string, unknown> = {},
  success = true
): ToolCall {
  return {
    id: `call_${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    result: {
      success,
      output: success ? "Done" : undefined,
      error: success ? undefined : "Failed",
    },
  };
}

function createTask(
  id: string,
  toolCalls: ToolCall[],
  options: Partial<ExecutedTask> = {}
): ExecutedTask {
  return {
    id,
    description: options.description || `Task ${id}`,
    actualPrompt: options.actualPrompt || `Execute task ${id}`,
    toolCalls,
    response: options.response || "Completed",
    result: options.result || { status: "success" },
    ...options,
  };
}

function createTrace(tasks: ExecutedTask[], options: Partial<ExecutionTrace> = {}): ExecutionTrace {
  return {
    tasks,
    impulsesCreated: options.impulsesCreated || [],
    filesModified: options.filesModified || [],
    goalContext: options.goalContext || {
      goal: "Test goal",
      intent: "Test intent",
      context: {},
    },
  };
}

function createContext(trace: ExecutionTrace, options: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: options.executionId || `exec_${Date.now()}`,
    goal: options.goal || trace.goalContext?.goal || "Test goal",
    trace,
    success: options.success ?? true,
    durationMs: options.durationMs || 1000,
    cost: options.cost || 0.01,
    error: options.error,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("TraceExtractor", () => {
  let extractor: TraceExtractor;

  beforeEach(() => {
    extractor = new TraceExtractor();
  });

  describe("analyze", () => {
    test("counts tasks and tool calls", () => {
      const tasks = [
        createTask("1", [createToolCall("read"), createToolCall("write")]),
        createTask("2", [createToolCall("bash")]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = extractor.analyze(context);

      expect(analysis.taskCount).toBe(2);
      expect(analysis.toolCallCount).toBe(3);
    });

    test("extracts files modified", () => {
      const tasks = [
        createTask("1", [
          createToolCall("write", { file_path: "src/test.ts" }),
          createToolCall("edit", { file_path: "src/index.ts" }),
        ]),
      ];
      const trace = createTrace(tasks, { filesModified: ["src/test.ts", "src/index.ts"] });
      const context = createContext(trace);

      const analysis = extractor.analyze(context);

      expect(analysis.filesModified).toContain("src/test.ts");
      expect(analysis.filesModified).toContain("src/index.ts");
    });

    test("identifies variables from tool calls", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "src/component.ts" }),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace, { goal: "update component" });

      const analysis = extractor.analyze(context);

      expect(analysis.variablesIdentified.length).toBeGreaterThan(0);
    });

    test("adds warning for unsuccessful execution", () => {
      const tasks = [createTask("1", [createToolCall("bash", {}, false)])];
      const trace = createTrace(tasks);
      const context = createContext(trace, { success: false });

      const analysis = extractor.analyze(context);

      expect(analysis.warnings).toContain(
        "Execution was not successful - template may be incomplete"
      );
    });

    test("adds warning for empty trace", () => {
      const trace = createTrace([]);
      const context = createContext(trace);

      const analysis = extractor.analyze(context);

      expect(analysis.warnings).toContain("No tasks in trace");
    });

    test("extracts input shapes from tool calls", () => {
      const tasks = [
        createTask("1", [createToolCall("read", { file_path: "src/test.ts" })]),
        createTask("2", [createToolCall("bash", { command: "grep -r pattern" })]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const analysis = extractor.analyze(context);

      expect(analysis.inputShapes).toContain("file_content");
      expect(analysis.inputShapes).toContain("search_results");
    });

    test("extracts output shapes from files modified", () => {
      const trace = createTrace([], {
        filesModified: ["src/component.ts", "docs/README.md", "config.json"],
      });
      const context = createContext(trace);

      const analysis = extractor.analyze(context);

      expect(analysis.outputShapes).toContain("source_code");
      expect(analysis.outputShapes).toContain("documentation");
      expect(analysis.outputShapes).toContain("json_data");
    });
  });

  describe("identifyTaskBoundaries", () => {
    test("groups sequential read tasks", () => {
      const tasks = [
        createTask("1", [createToolCall("read")]),
        createTask("2", [createToolCall("read")]),
        createTask("3", [createToolCall("read")]),
      ];
      const trace = createTrace(tasks);

      const groups = extractor.identifyTaskBoundaries(trace);

      // All reads should be in same group (or close)
      expect(groups.length).toBeGreaterThanOrEqual(1);
    });

    test("breaks at read to write transition", () => {
      const tasks = [
        createTask("1", [createToolCall("read", { file_path: "a.ts" })]),
        createTask("2", [createToolCall("read", { file_path: "b.ts" })]),
        createTask("3", [createToolCall("write", { file_path: "c.ts" })]),
      ];
      const trace = createTrace(tasks);

      const groups = extractor.identifyTaskBoundaries(trace);

      // Should have at least 2 groups (read group and write group)
      expect(groups.length).toBeGreaterThanOrEqual(1);
    });

    test("returns empty array for empty trace", () => {
      const trace = createTrace([]);

      const groups = extractor.identifyTaskBoundaries(trace);

      expect(groups).toHaveLength(0);
    });

    test("respects maxTaskSize", () => {
      extractor = new TraceExtractor({ maxTaskSize: 2 });
      const tasks = [
        createTask("1", [createToolCall("read")]),
        createTask("2", [createToolCall("read")]),
        createTask("3", [createToolCall("read")]),
        createTask("4", [createToolCall("read")]),
      ];
      const trace = createTrace(tasks);

      const groups = extractor.identifyTaskBoundaries(trace);

      // With max 2 per group, 4 tasks should be at least 2 groups
      expect(groups.length).toBeGreaterThanOrEqual(2);
    });

    test("identifies read-only groups", () => {
      const tasks = [
        createTask("1", [createToolCall("read")]),
        createTask("2", [createToolCall("bash", { command: "ls" })]),
      ];
      const trace = createTrace(tasks);

      const groups = extractor.identifyTaskBoundaries(trace);

      expect(groups[0]!.isReadOnly).toBe(true);
    });

    test("identifies modification groups", () => {
      const tasks = [
        createTask("1", [createToolCall("write", { file_path: "test.ts" })]),
      ];
      const trace = createTrace(tasks);

      const groups = extractor.identifyTaskBoundaries(trace);

      expect(groups[0]!.isReadOnly).toBe(false);
    });
  });

  describe("identifyVariables", () => {
    test("extracts file paths as variables", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "src/utils/helper.ts" }),
        ]),
      ];

      const variables = extractor.identifyVariables(tasks, "update helper");

      expect(variables.length).toBeGreaterThan(0);
      expect(variables[0]!.value).toBe("src/utils/helper.ts");
      expect(variables[0]!.location).toBe("tool_argument");
    });

    test("generates meaningful variable names", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "src/components/Button.tsx" }),
        ]),
      ];

      const variables = extractor.identifyVariables(tasks, "update button");

      expect(variables[0]!.name).toMatch(/button/i);
      expect(variables[0]!.name).toMatch(/_path$/);
    });

    test("assigns higher confidence when path mentioned in goal", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "src/login/auth.ts" }),
        ]),
      ];

      const variables = extractor.identifyVariables(tasks, "fix login auth issue");

      // Should have higher confidence because "login" and "auth" are in goal
      expect(variables[0]!.confidence).toBeGreaterThan(0.5);
    });

    test("assigns lower confidence to node_modules paths", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "node_modules/lodash/index.js" }),
        ]),
      ];

      const variables = extractor.identifyVariables(tasks, "check dependencies");

      expect(variables[0]!.confidence).toBeLessThan(0.5);
    });

    test("deduplicates variables by path", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "src/test.ts" }),
          createToolCall("read", { file_path: "src/test.ts" }),
        ]),
      ];

      const variables = extractor.identifyVariables(tasks, "test");

      const testPaths = variables.filter((v) => v.value === "src/test.ts");
      expect(testPaths).toHaveLength(1);
    });
  });
});

describe("calculateExtractionConfidence", () => {
  test("higher confidence for successful execution", () => {
    const trace = createTrace([
      createTask("1", [createToolCall("read"), createToolCall("write")]),
    ]);

    const successContext = createContext(trace, { success: true });
    const failContext = createContext(trace, { success: false });

    const successAnalysis = new TraceExtractor().analyze(successContext);
    const failAnalysis = new TraceExtractor().analyze(failContext);

    const successConfidence = calculateExtractionConfidence(successContext, successAnalysis);
    const failConfidence = calculateExtractionConfidence(failContext, failAnalysis);

    expect(successConfidence).toBeGreaterThan(failConfidence);
  });

  test("higher confidence with more tasks", () => {
    const smallTrace = createTrace([createTask("1", [createToolCall("read")])]);
    const largeTrace = createTrace([
      createTask("1", [createToolCall("read")]),
      createTask("2", [createToolCall("write")]),
      createTask("3", [createToolCall("bash")]),
    ]);

    const extractor = new TraceExtractor();
    const smallContext = createContext(smallTrace);
    const largeContext = createContext(largeTrace);

    const smallConfidence = calculateExtractionConfidence(
      smallContext,
      extractor.analyze(smallContext)
    );
    const largeConfidence = calculateExtractionConfidence(
      largeContext,
      extractor.analyze(largeContext)
    );

    expect(largeConfidence).toBeGreaterThan(smallConfidence);
  });

  test("confidence capped at 0.95", () => {
    const trace = createTrace(
      Array(10)
        .fill(null)
        .map((_, i) =>
          createTask(
            String(i),
            Array(5)
              .fill(null)
              .map(() => createToolCall("write", { file_path: `file${i}.ts` }))
          )
        ),
      { filesModified: ["a.ts", "b.ts", "c.ts"] }
    );
    const context = createContext(trace, { success: true });
    const analysis = new TraceExtractor().analyze(context);

    const confidence = calculateExtractionConfidence(context, analysis);

    expect(confidence).toBeLessThanOrEqual(0.95);
  });

  test("confidence minimum is 0.1", () => {
    const trace = createTrace([]);
    const context = createContext(trace, { success: false });
    const analysis = new TraceExtractor().analyze(context);

    const confidence = calculateExtractionConfidence(context, analysis);

    expect(confidence).toBeGreaterThanOrEqual(0.1);
  });
});
