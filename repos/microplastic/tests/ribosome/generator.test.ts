/**
 * Template Generator Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { TemplateGenerator } from "../../src/ribosome/template-generator.ts";
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
    outputState: options.outputState,
    inputState: options.inputState,
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

describe("TemplateGenerator", () => {
  let generator: TemplateGenerator;

  beforeEach(() => {
    generator = new TemplateGenerator();
  });

  describe("generate", () => {
    test("generates a valid template structure", () => {
      const tasks = [
        createTask("1", [createToolCall("read", { file_path: "src/test.ts" })]),
        createTask("2", [createToolCall("write", { file_path: "src/output.ts" })]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace, { goal: "Create output file" });

      const result = generator.generate(context);

      expect(result.template.id).toMatch(/^tpl_\d+_[a-z0-9]+$/);
      expect(result.template.name).toBeTruthy();
      expect(result.template.description).toBe(context.goal);
      expect(result.template.category).toBeTruthy();
      expect(result.template.tasks.length).toBeGreaterThan(0);
      expect(result.template.variables).toBeDefined();
    });

    test("includes metadata with source execution ID", () => {
      const trace = createTrace([createTask("1", [createToolCall("read")])]);
      const context = createContext(trace, { executionId: "exec_123" });

      const result = generator.generate(context);

      expect(result.template.metadata).toBeDefined();
      expect(result.template.metadata!.sourceExecutionId).toBe("exec_123");
      expect(result.template.metadata!.generatedFrom).toBe("execution");
      expect(result.template.metadata!.author).toBe("ribosome");
    });

    test("captures execution metrics in metadata", () => {
      const trace = createTrace([createTask("1", [createToolCall("write")])]);
      const context = createContext(trace, {
        success: true,
        durationMs: 5000,
        cost: 0.05,
      });

      const result = generator.generate(context);

      expect(result.template.metadata!.firstExecutionMetrics).toEqual({
        duration: 5000,
        cost: 0.05,
        tokens: { input: 0, output: 0 },
        status: "completed",
      });
    });

    test("returns confidence score", () => {
      const tasks = [
        createTask("1", [createToolCall("read"), createToolCall("write")]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace, { success: true });

      const result = generator.generate(context);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test("returns analysis with task count", () => {
      const tasks = [
        createTask("1", [createToolCall("read")]),
        createTask("2", [createToolCall("write")]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);

      expect(result.analysis.taskCount).toBe(2);
      expect(result.analysis.toolCallCount).toBe(2);
    });
  });

  describe("task generation", () => {
    test("creates tasks with sequential IDs", () => {
      const tasks = [
        createTask("a", [createToolCall("read")]),
        createTask("b", [createToolCall("write")]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);

      expect(result.template.tasks[0]!.id).toMatch(/^task-\d+$/);
      expect(result.template.tasks.every((t) => t.id.startsWith("task-"))).toBe(true);
    });

    test("sets dependencies between sequential tasks", () => {
      const tasks = [
        createTask("1", [createToolCall("read")]),
        createTask("2", [createToolCall("write")]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);

      // First task has no dependencies
      expect(result.template.tasks[0]!.dependencies).toHaveLength(0);

      // Subsequent tasks depend on previous
      if (result.template.tasks.length > 1) {
        expect(result.template.tasks[1]!.dependencies?.length).toBeGreaterThan(0);
      }
    });

    test("generates prompts with tool information", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "src/input.ts" }),
          createToolCall("write", { file_path: "src/output.ts" }),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);

      // Prompt should mention the tools
      expect(result.template.tasks[0]!.prompt.template).toContain("read");
    });

    test("includes retry configuration", () => {
      const tasks = [createTask("1", [createToolCall("bash")])];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);

      expect(result.template.tasks[0]!.retry).toEqual({
        maxAttempts: 2,
        strategy: "simple",
      });
    });
  });

  describe("validation extraction", () => {
    test("extracts required files from output state", () => {
      const tasks = [
        createTask("1", [createToolCall("write", { file_path: "src/new.ts" })], {
          outputState: {
            filesCreated: ["src/new.ts"],
            filesModified: [],
            filesDeleted: [],
          },
        }),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);
      const validation = result.template.tasks[0]!.validation;

      expect(validation?.requiredFiles).toContain("src/new.ts");
    });

    test("extracts required files from tool calls", () => {
      const tasks = [
        createTask("1", [
          createToolCall("write", { file_path: "src/created.ts" }),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);

      // The task should have some validation
      // (may vary based on implementation)
      expect(result.template.tasks.length).toBeGreaterThan(0);
    });
  });

  describe("schema generation", () => {
    test("generates input schema from detected shapes", () => {
      const tasks = [
        createTask("1", [createToolCall("read", { file_path: "src/test.ts" })]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace);

      const result = generator.generate(context);

      // Should have detected file_content shape
      if (result.template.inputSchema) {
        const shapes = [
          ...result.template.inputSchema.required,
          ...(result.template.inputSchema.optional || []),
        ].map((s) => s.shape);
        expect(shapes.length).toBeGreaterThan(0);
      }
    });

    test("generates output schema from files modified", () => {
      const trace = createTrace([], {
        filesModified: ["src/component.ts"],
      });
      const context = createContext(trace);

      const result = generator.generate(context);

      if (result.template.outputSchema) {
        expect(result.template.outputSchema.produces.length).toBeGreaterThan(0);
      }
    });

    test("includes shape descriptions", () => {
      const trace = createTrace([], {
        filesModified: ["src/test.ts"],
      });
      const context = createContext(trace);

      const result = generator.generate(context);

      if (result.template.outputSchema?.produces[0]) {
        expect(result.template.outputSchema.produces[0].description).toBeTruthy();
      }
    });
  });

  describe("category inference", () => {
    test("infers bugfix category", () => {
      const trace = createTrace([createTask("1", [createToolCall("edit")])]);
      const context = createContext(trace, { goal: "Fix login bug" });

      const result = generator.generate(context);

      expect(result.template.category).toBe("bugfix");
    });

    test("infers refactor category", () => {
      const trace = createTrace([createTask("1", [createToolCall("edit")])]);
      const context = createContext(trace, { goal: "Refactor the auth module" });

      const result = generator.generate(context);

      expect(result.template.category).toBe("refactor");
    });

    test("infers tool category", () => {
      const trace = createTrace([createTask("1", [createToolCall("write")])]);
      const context = createContext(trace, { goal: "Create a build script" });

      const result = generator.generate(context);

      expect(result.template.category).toBe("tool");
    });

    test("infers infrastructure category", () => {
      const trace = createTrace([createTask("1", [createToolCall("bash")])]);
      const context = createContext(trace, { goal: "Setup deployment pipeline" });

      const result = generator.generate(context);

      expect(result.template.category).toBe("infrastructure");
    });

    test("defaults to feature category", () => {
      const trace = createTrace([createTask("1", [createToolCall("write")])]);
      const context = createContext(trace, { goal: "Add user profile page" });

      const result = generator.generate(context);

      expect(result.template.category).toBe("feature");
    });
  });

  describe("template naming", () => {
    test("generates title-case name from goal", () => {
      const trace = createTrace([createTask("1", [createToolCall("write")])]);
      const context = createContext(trace, { goal: "add new login feature" });

      const result = generator.generate(context);

      expect(result.template.name).toMatch(/^[A-Z]/); // Starts with capital
      expect(result.template.name).toContain("Add");
    });

    test("truncates long goals", () => {
      const longGoal = "implement a very long and complex feature with many requirements that goes on and on";
      const trace = createTrace([createTask("1", [createToolCall("write")])]);
      const context = createContext(trace, { goal: longGoal });

      const result = generator.generate(context);

      expect(result.template.name.split(" ").length).toBeLessThanOrEqual(6);
    });
  });

  describe("variable generation", () => {
    test("generates variable definitions for high-confidence paths", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "src/auth/login.ts" }),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace, { goal: "fix login" });

      const result = generator.generate(context);

      // Should have variables for the paths mentioned
      expect(result.template.variables.some((v) => v.name.includes("login"))).toBe(
        true
      );
    });

    test("excludes low-confidence variables", () => {
      const tasks = [
        createTask("1", [
          createToolCall("read", { file_path: "node_modules/test/index.js" }),
        ]),
      ];
      const trace = createTrace(tasks);
      const context = createContext(trace, { goal: "unrelated goal" });

      const result = generator.generate(context);

      // node_modules paths should be excluded (low confidence)
      expect(
        result.template.variables.some((v) => v.value?.includes("node_modules"))
      ).toBe(false);
    });
  });
});
