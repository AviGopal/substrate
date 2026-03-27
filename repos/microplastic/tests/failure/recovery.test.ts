/**
 * Recovery Manager Tests
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  RecoveryManager,
  type RecoveryEvent,
  type RecoveryCallbacks,
} from "../../src/failure/recovery.ts";
import type {
  FailureAnalysis,
  RecoveryDecision,
  RecoveryContext,
} from "../../src/failure/types.ts";
import type { ActivityTemplate } from "@metabob/minibob";

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTemplate(id: string): ActivityTemplate {
  return {
    id,
    name: `Template ${id}`,
    description: `Description for ${id}`,
    category: "feature",
    tasks: [
      {
        id: "task-1",
        description: "First task",
        prompt: { template: "Do task 1", variables: [] },
      },
      {
        id: "task-2",
        description: "Second task",
        prompt: { template: "Do task 2", variables: [] },
      },
    ],
    variables: [],
  };
}

function createAnalysis(overrides: Partial<FailureAnalysis> = {}): FailureAnalysis {
  return {
    executionId: `exec_${Date.now()}`,
    templateId: "tpl_test",
    goal: "Test goal",
    category: "tool_error",
    severity: "major",
    failurePoint: {
      taskId: "task-1",
      stepIndex: 0,
      tool: "bash",
      error: "Command failed",
      timestamp: Date.now(),
    },
    rootCause: {
      primaryCause: "Command returned non-zero exit code",
      contributingFactors: [],
      evidence: [],
      confidence: 0.7,
    },
    suggestedFixes: [
      { description: "Retry the command", type: "retry", confidence: 0.6 },
    ],
    completedTasks: [],
    skippedTasks: ["task-2"],
    analyzedAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("RecoveryManager", () => {
  let manager: RecoveryManager;
  let events: RecoveryEvent[];
  let callbacks: RecoveryCallbacks;

  beforeEach(() => {
    events = [];
    callbacks = {
      onEvent: (e) => events.push(e),
    };

    manager = new RecoveryManager({
      callbacks,
      autoSelect: true, // Use recommended option automatically
    });
  });

  describe("buildRecoveryContext", () => {
    test("builds context with available options", () => {
      const analysis = createAnalysis();

      const context = manager.buildRecoveryContext(analysis);

      expect(context.analysis).toBe(analysis);
      expect(context.options.length).toBeGreaterThan(0);
      expect(context.options).toContain("abandon");
    });

    test("includes retry option for non-critical failures", () => {
      const analysis = createAnalysis({ severity: "major" });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.options).toContain("retry");
    });

    test("excludes retry for critical failures", () => {
      const analysis = createAnalysis({ severity: "critical" });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.options).not.toContain("retry");
    });

    test("includes skip when tasks remain", () => {
      const analysis = createAnalysis({
        severity: "major",
        skippedTasks: ["task-2", "task-3"],
      });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.options).toContain("skip");
    });

    test("provides recommendation with reason", () => {
      const analysis = createAnalysis();

      const context = manager.buildRecoveryContext(analysis);

      expect(context.recommended).toBeTruthy();
      expect(context.recommendationReason).toBeTruthy();
    });
  });

  describe("recommendation logic", () => {
    test("recommends investigate for critical failures", () => {
      const analysis = createAnalysis({ severity: "critical" });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.recommended).toBe("investigate");
    });

    test("recommends variant for validation failures", () => {
      const analysis = createAnalysis({ category: "validation" });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.recommended).toBe("create_variant");
    });

    test("recommends retry for resource failures", () => {
      const analysis = createAnalysis({ category: "resource" });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.recommended).toBe("retry");
    });

    test("recommends retry for external failures", () => {
      const analysis = createAnalysis({ category: "external" });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.recommended).toBe("retry");
    });

    test("recommends retry when high-confidence fix available", () => {
      const analysis = createAnalysis({
        category: "unknown",
        suggestedFixes: [
          { description: "Easy fix", type: "retry", confidence: 0.8 },
        ],
      });

      const context = manager.buildRecoveryContext(analysis);

      expect(context.recommended).toBe("retry");
    });
  });

  describe("handleFailure", () => {
    test("emits events during recovery", async () => {
      const analysis = createAnalysis();

      await manager.handleFailure(analysis);

      const types = events.map((e) => e.type);
      expect(types).toContain("options_presented");
      expect(types).toContain("decision_made");
      expect(types).toContain("recovery_started");
      expect(types).toContain("recovery_completed");
    });

    test("uses user decision when callback provided", async () => {
      const presentMock = mock(
        async (ctx: RecoveryContext): Promise<RecoveryDecision> => ({
          option: "abandon",
        })
      );

      const customManager = new RecoveryManager({
        callbacks: {
          onPresentOptions: presentMock,
          onEvent: (e) => events.push(e),
        },
      });

      const analysis = createAnalysis();
      const result = await customManager.handleFailure(analysis);

      expect(presentMock).toHaveBeenCalled();
      expect(result.action).toBe("abandon");
    });

    test("uses recommended option when autoSelect enabled", async () => {
      const analysis = createAnalysis({ category: "external" });

      const result = await manager.handleFailure(analysis);

      expect(result.action).toBe("retry");
    });
  });

  describe("executeRecovery - abandon", () => {
    test("returns success for abandon", async () => {
      const analysis = createAnalysis();

      const result = await manager["executeRecovery"](analysis, {
        option: "abandon",
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("abandon");
    });
  });

  describe("executeRecovery - retry", () => {
    test("calls retry callback", async () => {
      const retryMock = mock(async () => "new_exec_123");

      const customManager = new RecoveryManager({
        callbacks: {
          onRetry: retryMock,
          onEvent: (e) => events.push(e),
        },
      });

      const analysis = createAnalysis();
      const result = await customManager["executeRecovery"](analysis, {
        option: "retry",
      });

      expect(retryMock).toHaveBeenCalledWith(analysis.templateId, analysis.failurePoint.taskId);
      expect(result.success).toBe(true);
      expect(result.newExecutionId).toBe("new_exec_123");
    });

    test("returns error when retry callback not configured", async () => {
      const analysis = createAnalysis();

      const result = await manager["executeRecovery"](analysis, {
        option: "retry",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not configured");
    });

    test("retry_all does not pass taskId", async () => {
      const retryMock = mock(async () => "new_exec_123");

      const customManager = new RecoveryManager({
        callbacks: {
          onRetry: retryMock,
          onEvent: (e) => events.push(e),
        },
      });

      const analysis = createAnalysis();
      await customManager["executeRecovery"](analysis, {
        option: "retry_all",
      });

      expect(retryMock).toHaveBeenCalledWith(analysis.templateId, undefined);
    });
  });

  describe("executeRecovery - create_variant", () => {
    test("creates variant with template resolver", async () => {
      const template = createTemplate("tpl_test");
      const getTemplateMock = mock(async () => template);

      const customManager = new RecoveryManager({
        callbacks: { onEvent: (e) => events.push(e) },
        getTemplate: getTemplateMock,
      });

      const analysis = createAnalysis();
      const result = await customManager["executeRecovery"](analysis, {
        option: "create_variant",
      });

      expect(result.success).toBe(true);
      expect(result.newTemplateId).toBeTruthy();
      expect(result.newTemplateId).toMatch(/^var_/);
    });

    test("returns error when template resolver not configured", async () => {
      const analysis = createAnalysis();

      const result = await manager["executeRecovery"](analysis, {
        option: "create_variant",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not configured");
    });

    test("returns error when template not found", async () => {
      const customManager = new RecoveryManager({
        callbacks: { onEvent: (e) => events.push(e) },
        getTemplate: async () => null,
      });

      const analysis = createAnalysis();
      const result = await customManager["executeRecovery"](analysis, {
        option: "create_variant",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("executeRecovery - investigate", () => {
    test("calls investigate callback", async () => {
      const investigateMock = mock(async () => {});

      const customManager = new RecoveryManager({
        callbacks: {
          onInvestigate: investigateMock,
          onEvent: (e) => events.push(e),
        },
      });

      const analysis = createAnalysis();
      const result = await customManager["executeRecovery"](analysis, {
        option: "investigate",
      });

      expect(investigateMock).toHaveBeenCalledWith(analysis);
      expect(result.success).toBe(true);
      expect(result.action).toBe("investigate");
    });
  });

  describe("executeRecovery - skip", () => {
    test("returns success for skip", async () => {
      const analysis = createAnalysis();

      const result = await manager["executeRecovery"](analysis, {
        option: "skip",
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("skip");
    });
  });

  describe("getVariantCreator", () => {
    test("returns variant creator instance", () => {
      const creator = manager.getVariantCreator();

      expect(creator).toBeDefined();
      expect(typeof creator.createVariant).toBe("function");
    });
  });
});
