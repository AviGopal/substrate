/**
 * Variant Creator
 *
 * Creates variant templates from failed executions.
 * Variants inherit from parent templates with modifications.
 */

import type { ActivityTemplate, ActivityTask } from "@metabob/minibob";
import type {
  FailureAnalysis,
  VariantModifications,
  VariantLineage,
  VariantTemplate,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for variant creation
 */
export interface VariantCreationOptions {
  /** Prefix for variant IDs */
  idPrefix?: string;
  /** Suffix for variant names */
  nameSuffix?: string;
  /** Maximum generation depth */
  maxGeneration?: number;
}

// =============================================================================
// CREATOR
// =============================================================================

/**
 * VariantCreator - creates template variants
 */
export class VariantCreator {
  private options: Required<VariantCreationOptions>;

  constructor(options: VariantCreationOptions = {}) {
    this.options = {
      idPrefix: options.idPrefix ?? "var",
      nameSuffix: options.nameSuffix ?? "(variant)",
      maxGeneration: options.maxGeneration ?? 10,
    };
  }

  // ===========================================================================
  // MAIN CREATION
  // ===========================================================================

  /**
   * Create a variant from a failed execution
   */
  createVariant(
    parentTemplate: ActivityTemplate,
    analysis: FailureAnalysis,
    modifications?: VariantModifications
  ): VariantTemplate {
    // Determine generation
    const parentGeneration = this.getGeneration(parentTemplate);
    const newGeneration = parentGeneration + 1;

    if (newGeneration > this.options.maxGeneration) {
      throw new Error(
        `Maximum variant generation (${this.options.maxGeneration}) exceeded`
      );
    }

    // Build lineage
    const lineage: VariantLineage = {
      parentId: parentTemplate.id,
      generation: newGeneration,
      creationReason: this.buildCreationReason(analysis),
      sourceFailure: {
        executionId: analysis.executionId,
        taskId: analysis.failurePoint.taskId,
        error: analysis.failurePoint.error,
      },
      modifications: modifications || this.inferModifications(analysis),
      createdAt: Date.now(),
    };

    // Create the variant template
    const template = this.buildVariantTemplate(
      parentTemplate,
      lineage,
      modifications
    );

    return { template, lineage };
  }

  /**
   * Create a manual variant (not from failure)
   */
  createManualVariant(
    parentTemplate: ActivityTemplate,
    reason: string,
    modifications: VariantModifications
  ): VariantTemplate {
    const parentGeneration = this.getGeneration(parentTemplate);
    const newGeneration = parentGeneration + 1;

    const lineage: VariantLineage = {
      parentId: parentTemplate.id,
      generation: newGeneration,
      creationReason: reason,
      modifications,
      createdAt: Date.now(),
    };

    const template = this.buildVariantTemplate(
      parentTemplate,
      lineage,
      modifications
    );

    return { template, lineage };
  }

  // ===========================================================================
  // TEMPLATE BUILDING
  // ===========================================================================

  /**
   * Build the variant template
   */
  private buildVariantTemplate(
    parent: ActivityTemplate,
    lineage: VariantLineage,
    modifications?: VariantModifications
  ): ActivityTemplate {
    const mods = modifications || lineage.modifications;

    // Generate new ID
    const variantId = this.generateVariantId(parent.id, lineage.generation);

    // Build tasks with modifications
    const tasks = this.buildVariantTasks(parent.tasks, mods);

    // Build the template
    const template: ActivityTemplate = {
      ...parent,
      id: variantId,
      name: this.generateVariantName(parent.name, lineage.generation),
      description: this.generateVariantDescription(parent, lineage),
      tasks,
      metadata: {
        ...parent.metadata,
        generatedFrom: "goal-seeking" as const,
        sourceTemplateId: parent.id,
        createdAt: Date.now(),
        author: "variant-creator",
        // Store lineage in metadata for retrieval
        variantLineage: {
          parentId: lineage.parentId,
          generation: lineage.generation,
          reason: lineage.creationReason,
          modifications: [],
        },
      } as ActivityTemplate["metadata"],
    };

    return template;
  }

  /**
   * Build variant tasks with modifications
   */
  private buildVariantTasks(
    parentTasks: ActivityTask[],
    modifications: VariantModifications
  ): ActivityTask[] {
    const skipTasks = new Set(modifications.skipTasks || []);

    return parentTasks
      .filter((task) => !skipTasks.has(task.id))
      .map((task) => this.modifyTask(task, modifications));
  }

  /**
   * Modify a single task
   */
  private modifyTask(
    task: ActivityTask,
    modifications: VariantModifications
  ): ActivityTask {
    const modified = { ...task };

    // Apply prompt modifications
    if (modifications.taskPrompts?.[task.id]) {
      modified.prompt = {
        ...task.prompt,
        template: modifications.taskPrompts[task.id]!,
      };
    }

    // Apply retry configuration
    if (modifications.retryConfig) {
      modified.retry = {
        maxAttempts: modifications.retryConfig.maxAttempts ?? task.retry?.maxAttempts ?? 2,
        strategy: modifications.retryConfig.strategy ?? task.retry?.strategy ?? "simple",
      };
    }

    // Add additional context to prompt
    if (modifications.additionalContext) {
      modified.prompt = {
        ...modified.prompt,
        template: `${modifications.additionalContext}\n\n${modified.prompt.template}`,
      };
    }

    return modified;
  }

  // ===========================================================================
  // MODIFICATION INFERENCE
  // ===========================================================================

  /**
   * Infer modifications from failure analysis
   */
  private inferModifications(analysis: FailureAnalysis): VariantModifications {
    const modifications: VariantModifications = {};

    // Increase retry attempts
    modifications.retryConfig = {
      maxAttempts: 3,
      strategy: "progressive-context",
    };

    // Add context about the failure
    const contextLines: string[] = [
      "## Previous Attempt Context",
      "",
      `A previous attempt failed at task "${analysis.failurePoint.taskId}".`,
      `Error: ${analysis.failurePoint.error}`,
      "",
      "Please consider this when executing:",
    ];

    // Add fix suggestions
    for (const fix of analysis.suggestedFixes.slice(0, 3)) {
      contextLines.push(`- ${fix.description}`);
    }

    modifications.additionalContext = contextLines.join("\n");

    return modifications;
  }

  // ===========================================================================
  // ID AND NAME GENERATION
  // ===========================================================================

  /**
   * Generate variant ID
   */
  private generateVariantId(_parentId: string, generation: number): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${this.options.idPrefix}_${generation}_${timestamp}_${random}`;
  }

  /**
   * Generate variant name
   */
  private generateVariantName(parentName: string, generation: number): string {
    // Remove any existing variant suffix
    const baseName = parentName.replace(/\s*\(variant.*\)\s*$/, "").trim();
    return `${baseName} ${this.options.nameSuffix} v${generation}`;
  }

  /**
   * Generate variant description
   */
  private generateVariantDescription(
    parent: ActivityTemplate,
    lineage: VariantLineage
  ): string {
    return `Variant of "${parent.name}": ${lineage.creationReason}`;
  }

  /**
   * Build creation reason from analysis
   */
  private buildCreationReason(analysis: FailureAnalysis): string {
    const parts: string[] = [];

    parts.push(`Failed at ${analysis.failurePoint.taskId}`);

    if (analysis.category !== "unknown") {
      parts.push(`(${analysis.category})`);
    }

    parts.push(`- ${analysis.rootCause.primaryCause}`);

    return parts.join(" ");
  }

  // ===========================================================================
  // LINEAGE UTILITIES
  // ===========================================================================

  /**
   * Get generation from template
   */
  getGeneration(template: ActivityTemplate): number {
    const metadata = template.metadata as Record<string, unknown> | undefined;
    const lineageData = metadata?.variantLineage as { generation?: number } | undefined;
    return lineageData?.generation ?? 0;
  }

  /**
   * Check if template is a variant
   */
  isVariant(template: ActivityTemplate): boolean {
    return this.getGeneration(template) > 0;
  }

  /**
   * Get parent ID from variant
   */
  getParentId(template: ActivityTemplate): string | undefined {
    const metadata = template.metadata as Record<string, unknown> | undefined;
    const lineageData = metadata?.variantLineage as { parentId?: string } | undefined;
    return lineageData?.parentId;
  }

  /**
   * Extract full lineage from metadata
   */
  extractLineage(template: ActivityTemplate): Partial<VariantLineage> | undefined {
    const metadata = template.metadata as Record<string, unknown> | undefined;
    return metadata?.variantLineage as Partial<VariantLineage> | undefined;
  }
}
