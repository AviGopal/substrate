/**
 * Variant Creator Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { VariantCreator } from "../../src/failure/variant.ts";
import type { FailureAnalysis, VariantModifications } from "../../src/failure/types.ts";
import type { ActivityTemplate } from "@metabob/minibob";

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTemplate(id: string, options: Partial<ActivityTemplate> = {}): ActivityTemplate {
  return {
    id,
    name: options.name || `Template ${id}`,
    description: options.description || `Description for ${id}`,
    category: options.category || "feature",
    tasks: options.tasks || [
      {
        id: "task-1",
        description: "First task",
        prompt: { template: "Do task 1", variables: [] },
        retry: { maxAttempts: 2, strategy: "simple" },
      },
      {
        id: "task-2",
        description: "Second task",
        prompt: { template: "Do task 2", variables: [] },
      },
    ],
    variables: options.variables || [],
    metadata: options.metadata,
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
      error: "Command failed with exit code 1",
      timestamp: Date.now(),
    },
    rootCause: {
      primaryCause: "Command returned non-zero exit code",
      contributingFactors: ["Missing dependency"],
      evidence: ["Tool sequence: read → bash"],
      confidence: 0.7,
    },
    suggestedFixes: [
      { description: "Retry the command", type: "retry", confidence: 0.6 },
      { description: "Use alternative approach", type: "use_alternative", confidence: 0.5 },
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

describe("VariantCreator", () => {
  let creator: VariantCreator;

  beforeEach(() => {
    creator = new VariantCreator();
  });

  describe("createVariant", () => {
    test("creates variant with new ID", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      expect(result.template.id).not.toBe(parent.id);
      expect(result.template.id).toMatch(/^var_1_\d+_[a-z0-9]+$/);
    });

    test("creates variant with modified name", () => {
      const parent = createTemplate("tpl_parent", { name: "Original Template" });
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      expect(result.template.name).toContain("Original Template");
      expect(result.template.name).toContain("variant");
      expect(result.template.name).toContain("v1");
    });

    test("preserves parent tasks", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      expect(result.template.tasks.length).toBe(parent.tasks.length);
    });

    test("includes lineage information", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      expect(result.lineage.parentId).toBe(parent.id);
      expect(result.lineage.generation).toBe(1);
      expect(result.lineage.sourceFailure?.executionId).toBe(analysis.executionId);
      expect(result.lineage.sourceFailure?.taskId).toBe(analysis.failurePoint.taskId);
    });

    test("stores lineage in metadata", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      const lineageData = result.template.metadata?.variantLineage as {
        parentId: string;
        generation: number;
      };
      expect(lineageData.parentId).toBe(parent.id);
      expect(lineageData.generation).toBe(1);
    });

    test("builds creation reason from analysis", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      expect(result.lineage.creationReason).toContain(analysis.failurePoint.taskId);
    });

    test("applies custom modifications", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();
      const modifications: VariantModifications = {
        taskPrompts: { "task-1": "Modified prompt" },
        retryConfig: { maxAttempts: 5 },
      };

      const result = creator.createVariant(parent, analysis, modifications);

      const task1 = result.template.tasks.find((t) => t.id === "task-1");
      expect(task1?.prompt.template).toBe("Modified prompt");
      expect(task1?.retry?.maxAttempts).toBe(5);
    });

    test("skips tasks when specified", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();
      const modifications: VariantModifications = {
        skipTasks: ["task-1"],
      };

      const result = creator.createVariant(parent, analysis, modifications);

      expect(result.template.tasks.find((t) => t.id === "task-1")).toBeUndefined();
      expect(result.template.tasks.find((t) => t.id === "task-2")).toBeDefined();
    });

    test("adds additional context to prompts", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();
      const modifications: VariantModifications = {
        additionalContext: "## Important Note\nBe careful with this.",
      };

      const result = creator.createVariant(parent, analysis, modifications);

      expect(result.template.tasks[0]!.prompt.template).toContain("Important Note");
    });

    test("infers modifications when not provided", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      // Should have inferred modifications including retry config
      expect(result.template.tasks[0]!.retry?.maxAttempts).toBe(3);
      expect(result.template.tasks[0]!.retry?.strategy).toBe("progressive-context");
    });

    test("includes failure context in inferred modifications", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const result = creator.createVariant(parent, analysis);

      // Should include context about the failure
      expect(result.template.tasks[0]!.prompt.template).toContain("Previous Attempt");
      expect(result.template.tasks[0]!.prompt.template).toContain(
        analysis.failurePoint.error
      );
    });
  });

  describe("createManualVariant", () => {
    test("creates variant with custom reason", () => {
      const parent = createTemplate("tpl_parent");
      const modifications: VariantModifications = {
        retryConfig: { maxAttempts: 3 },
      };

      const result = creator.createManualVariant(
        parent,
        "Testing improved retry logic",
        modifications
      );

      expect(result.lineage.creationReason).toBe("Testing improved retry logic");
      expect(result.lineage.sourceFailure).toBeUndefined();
    });
  });

  describe("generation tracking", () => {
    test("increments generation for nested variants", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const v1 = creator.createVariant(parent, analysis);
      const v2 = creator.createVariant(v1.template, analysis);
      const v3 = creator.createVariant(v2.template, analysis);

      expect(v1.lineage.generation).toBe(1);
      expect(v2.lineage.generation).toBe(2);
      expect(v3.lineage.generation).toBe(3);
    });

    test("throws when max generation exceeded", () => {
      const limitedCreator = new VariantCreator({ maxGeneration: 2 });

      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const v1 = limitedCreator.createVariant(parent, analysis);
      const v2 = limitedCreator.createVariant(v1.template, analysis);

      expect(() => {
        limitedCreator.createVariant(v2.template, analysis);
      }).toThrow(/Maximum variant generation/);
    });

    test("getGeneration returns 0 for non-variant", () => {
      const template = createTemplate("tpl_original");

      expect(creator.getGeneration(template)).toBe(0);
    });

    test("getGeneration returns correct generation for variant", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);

      expect(creator.getGeneration(variant.template)).toBe(1);
    });
  });

  describe("isVariant", () => {
    test("returns false for original template", () => {
      const template = createTemplate("tpl_original");

      expect(creator.isVariant(template)).toBe(false);
    });

    test("returns true for variant", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);

      expect(creator.isVariant(variant.template)).toBe(true);
    });
  });

  describe("getParentId", () => {
    test("returns undefined for non-variant", () => {
      const template = createTemplate("tpl_original");

      expect(creator.getParentId(template)).toBeUndefined();
    });

    test("returns parent ID for variant", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);

      expect(creator.getParentId(variant.template)).toBe(parent.id);
    });
  });

  describe("extractLineage", () => {
    test("returns undefined for non-variant", () => {
      const template = createTemplate("tpl_original");

      expect(creator.extractLineage(template)).toBeUndefined();
    });

    test("returns lineage data for variant", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);
      const lineage = creator.extractLineage(variant.template);

      expect(lineage).toBeDefined();
      expect(lineage!.parentId).toBe(parent.id);
      expect(lineage!.generation).toBe(1);
    });
  });

  describe("custom options", () => {
    test("uses custom ID prefix", () => {
      const customCreator = new VariantCreator({ idPrefix: "custom" });
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const variant = customCreator.createVariant(parent, analysis);

      expect(variant.template.id).toMatch(/^custom_/);
    });

    test("uses custom name suffix", () => {
      const customCreator = new VariantCreator({ nameSuffix: "(modified)" });
      const parent = createTemplate("tpl_parent", { name: "Original" });
      const analysis = createAnalysis();

      const variant = customCreator.createVariant(parent, analysis);

      expect(variant.template.name).toContain("(modified)");
    });
  });

  describe("variant description", () => {
    test("includes parent name and reason", () => {
      const parent = createTemplate("tpl_parent", { name: "Parent Template" });
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);

      expect(variant.template.description).toContain("Parent Template");
    });
  });

  describe("metadata preservation", () => {
    test("preserves category from parent", () => {
      const parent = createTemplate("tpl_parent", { category: "bugfix" });
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);

      expect(variant.template.category).toBe("bugfix");
    });

    test("preserves variables from parent", () => {
      const parent = createTemplate("tpl_parent", {
        variables: [
          { name: "target", type: "string", required: true },
        ],
      });
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);

      expect(variant.template.variables).toEqual(parent.variables);
    });

    test("updates metadata fields", () => {
      const parent = createTemplate("tpl_parent");
      const analysis = createAnalysis();

      const variant = creator.createVariant(parent, analysis);

      expect(variant.template.metadata?.generatedFrom).toBe("goal-seeking");
      expect(variant.template.metadata?.sourceTemplateId).toBe(parent.id);
      expect(variant.template.metadata?.author).toBe("variant-creator");
    });
  });
});
