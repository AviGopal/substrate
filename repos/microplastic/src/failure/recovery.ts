/**
 * Recovery Manager
 *
 * Presents recovery options to users and handles recovery actions.
 */

import type { ActivityTemplate } from "@metabob/minibob";
import { VariantCreator } from "./variant.ts";
import type {
  FailureAnalysis,
  RecoveryOption,
  RecoveryContext,
  RecoveryDecision,
  RecoveryResult,
  VariantModifications,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Recovery event for observability
 */
export interface RecoveryEvent {
  type: "options_presented" | "decision_made" | "recovery_started" | "recovery_completed";
  executionId: string;
  option?: RecoveryOption;
  success?: boolean;
  timestamp: number;
}

/**
 * Recovery callbacks
 */
export interface RecoveryCallbacks {
  /** Called when presenting options to user */
  onPresentOptions?: (context: RecoveryContext) => Promise<RecoveryDecision>;
  /** Called to retry execution */
  onRetry?: (templateId: string, fromTaskId?: string) => Promise<string | null>;
  /** Called when investigation requested */
  onInvestigate?: (analysis: FailureAnalysis) => Promise<void>;
  /** Called for recovery events */
  onEvent?: (event: RecoveryEvent) => void;
}

/**
 * Recovery manager options
 */
export interface RecoveryManagerOptions {
  /** Callbacks */
  callbacks: RecoveryCallbacks;
  /** Template resolver (to get templates by ID) */
  getTemplate?: (templateId: string) => Promise<ActivityTemplate | null>;
  /** Auto-select recovery option (for non-interactive mode) */
  autoSelect?: boolean;
}

// =============================================================================
// MANAGER
// =============================================================================

/**
 * RecoveryManager - handles failure recovery
 */
export class RecoveryManager {
  private variantCreator: VariantCreator;
  private callbacks: RecoveryCallbacks;
  private getTemplate?: (templateId: string) => Promise<ActivityTemplate | null>;
  private autoSelect: boolean;

  constructor(options: RecoveryManagerOptions) {
    this.variantCreator = new VariantCreator();
    this.callbacks = options.callbacks;
    this.getTemplate = options.getTemplate;
    this.autoSelect = options.autoSelect ?? false;
  }

  // ===========================================================================
  // MAIN RECOVERY FLOW
  // ===========================================================================

  /**
   * Handle a failure and guide recovery
   */
  async handleFailure(analysis: FailureAnalysis): Promise<RecoveryResult> {
    // Build recovery context
    const context = this.buildRecoveryContext(analysis);

    this.emit({
      type: "options_presented",
      executionId: analysis.executionId,
      timestamp: Date.now(),
    });

    // Get user decision
    let decision: RecoveryDecision;

    if (this.autoSelect) {
      decision = { option: context.recommended };
    } else if (this.callbacks.onPresentOptions) {
      decision = await this.callbacks.onPresentOptions(context);
    } else {
      // Default to recommended option
      decision = { option: context.recommended };
    }

    this.emit({
      type: "decision_made",
      executionId: analysis.executionId,
      option: decision.option,
      timestamp: Date.now(),
    });

    // Execute recovery
    return this.executeRecovery(analysis, decision);
  }

  // ===========================================================================
  // CONTEXT BUILDING
  // ===========================================================================

  /**
   * Build recovery context from analysis
   */
  buildRecoveryContext(analysis: FailureAnalysis): RecoveryContext {
    const options = this.determineAvailableOptions(analysis);
    const { recommended, reason } = this.determineRecommendation(analysis, options);

    return {
      analysis,
      options,
      recommended,
      recommendationReason: reason,
    };
  }

  /**
   * Determine available recovery options
   */
  private determineAvailableOptions(analysis: FailureAnalysis): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    // Always available
    options.push("abandon");

    // Retry options based on severity
    if (analysis.severity !== "critical") {
      options.push("retry");
    }

    // Retry all if not too far along
    if (analysis.completedTasks.length < 3) {
      options.push("retry_all");
    }

    // Variant creation
    options.push("create_variant");

    // Investigation
    options.push("investigate");

    // Skip if there are remaining tasks and not critical
    if (analysis.skippedTasks.length > 0 && analysis.severity !== "critical") {
      options.push("skip");
    }

    return options;
  }

  /**
   * Determine recommended option
   */
  private determineRecommendation(
    analysis: FailureAnalysis,
    options: RecoveryOption[]
  ): { recommended: RecoveryOption; reason: string } {
    // Critical failures - investigate first
    if (analysis.severity === "critical") {
      return {
        recommended: "investigate",
        reason: "Critical failure requires investigation before retry",
      };
    }

    // Validation failures - variant creation often helps
    if (analysis.category === "validation") {
      return {
        recommended: "create_variant",
        reason: "Validation failures often require modified approach",
      };
    }

    // Resource errors - retry might work
    if (analysis.category === "resource") {
      return {
        recommended: "retry",
        reason: "Resource issues may be transient",
      };
    }

    // External failures - retry with investigation
    if (analysis.category === "external") {
      return {
        recommended: "retry",
        reason: "External service may be available now",
      };
    }

    // High confidence in fix suggestions
    if (analysis.suggestedFixes[0]?.confidence >= 0.7) {
      return {
        recommended: "retry",
        reason: `High confidence fix available: ${analysis.suggestedFixes[0].description}`,
      };
    }

    // Default - create variant
    return {
      recommended: "create_variant",
      reason: "Creating a variant allows for a modified approach",
    };
  }

  // ===========================================================================
  // RECOVERY EXECUTION
  // ===========================================================================

  /**
   * Execute the recovery decision
   */
  async executeRecovery(
    analysis: FailureAnalysis,
    decision: RecoveryDecision
  ): Promise<RecoveryResult> {
    this.emit({
      type: "recovery_started",
      executionId: analysis.executionId,
      option: decision.option,
      timestamp: Date.now(),
    });

    let result: RecoveryResult;

    switch (decision.option) {
      case "retry":
        result = await this.executeRetry(analysis, false);
        break;

      case "retry_all":
        result = await this.executeRetry(analysis, true);
        break;

      case "create_variant":
        result = await this.executeCreateVariant(analysis, decision.modifications);
        break;

      case "investigate":
        result = await this.executeInvestigate(analysis);
        break;

      case "skip":
        result = await this.executeSkip(analysis);
        break;

      case "abandon":
        result = {
          success: true,
          action: "abandon",
        };
        break;

      default:
        result = {
          success: false,
          action: decision.option,
          error: `Unknown recovery option: ${decision.option}`,
        };
    }

    this.emit({
      type: "recovery_completed",
      executionId: analysis.executionId,
      option: decision.option,
      success: result.success,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Execute retry recovery
   */
  private async executeRetry(
    analysis: FailureAnalysis,
    fromStart: boolean
  ): Promise<RecoveryResult> {
    if (!this.callbacks.onRetry) {
      return {
        success: false,
        action: fromStart ? "retry_all" : "retry",
        error: "Retry callback not configured",
      };
    }

    const fromTaskId = fromStart ? undefined : analysis.failurePoint.taskId;
    const newExecutionId = await this.callbacks.onRetry(
      analysis.templateId,
      fromTaskId
    );

    if (newExecutionId) {
      return {
        success: true,
        action: fromStart ? "retry_all" : "retry",
        newExecutionId,
      };
    }

    return {
      success: false,
      action: fromStart ? "retry_all" : "retry",
      error: "Retry failed",
    };
  }

  /**
   * Execute variant creation
   */
  private async executeCreateVariant(
    analysis: FailureAnalysis,
    modifications?: VariantModifications
  ): Promise<RecoveryResult> {
    // Get the original template
    if (!this.getTemplate) {
      return {
        success: false,
        action: "create_variant",
        error: "Template resolver not configured",
      };
    }

    const originalTemplate = await this.getTemplate(analysis.templateId);
    if (!originalTemplate) {
      return {
        success: false,
        action: "create_variant",
        error: `Template ${analysis.templateId} not found`,
      };
    }

    // Create variant
    const variant = this.variantCreator.createVariant(
      originalTemplate,
      analysis,
      modifications
    );

    return {
      success: true,
      action: "create_variant",
      newTemplateId: variant.template.id,
    };
  }

  /**
   * Execute investigation
   */
  private async executeInvestigate(
    analysis: FailureAnalysis
  ): Promise<RecoveryResult> {
    if (this.callbacks.onInvestigate) {
      await this.callbacks.onInvestigate(analysis);
    }

    return {
      success: true,
      action: "investigate",
    };
  }

  /**
   * Execute skip (continue without failed task)
   */
  private async executeSkip(analysis: FailureAnalysis): Promise<RecoveryResult> {
    // For now, just mark as skipped - actual execution would need
    // to be handled by the executor
    return {
      success: true,
      action: "skip",
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Emit a recovery event
   */
  private emit(event: RecoveryEvent): void {
    if (this.callbacks.onEvent) {
      this.callbacks.onEvent(event);
    }
  }

  /**
   * Get the variant creator
   */
  getVariantCreator(): VariantCreator {
    return this.variantCreator;
  }
}
