/**
 * Promotion Manager
 *
 * Handles promotion of locally cached templates to the backend.
 * Templates are promoted when they meet success thresholds.
 */

import { ActivityAPIClient } from "../selection/client.ts";
import { TemplateCache } from "./cache.ts";
import type {
  PromotionCriteria,
  PromotionDecision,
  PromotionResult,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Promotion event for logging/observability
 */
export interface PromotionEvent {
  type: "check" | "promote" | "skip" | "fail";
  templateId: string;
  decision?: PromotionDecision;
  result?: PromotionResult;
  timestamp: number;
}

/**
 * Promotion manager options
 */
export interface PromotionManagerOptions {
  /** Activity API client */
  client: ActivityAPIClient;
  /** Template cache */
  cache: TemplateCache;
  /** Promotion criteria */
  criteria: PromotionCriteria;
  /** Whether to auto-promote */
  autoPromote?: boolean;
  /** Event handler */
  onEvent?: (event: PromotionEvent) => void;
}

// =============================================================================
// MANAGER
// =============================================================================

/**
 * PromotionManager - handles template promotion to backend
 */
export class PromotionManager {
  private client: ActivityAPIClient;
  private cache: TemplateCache;
  private criteria: PromotionCriteria;
  private autoPromote: boolean;
  private onEvent?: (event: PromotionEvent) => void;

  constructor(options: PromotionManagerOptions) {
    this.client = options.client;
    this.cache = options.cache;
    this.criteria = options.criteria;
    this.autoPromote = options.autoPromote ?? true;
    this.onEvent = options.onEvent;
  }

  // ===========================================================================
  // PROMOTION CHECKS
  // ===========================================================================

  /**
   * Check if a template should be promoted
   */
  checkPromotion(templateId: string): PromotionDecision {
    const cached = this.cache.get(templateId);

    if (!cached) {
      return {
        shouldPromote: false,
        reason: "Template not found in cache",
        readinessScore: 0,
      };
    }

    // Already promoted?
    if (cached.metadata.promoted) {
      return {
        shouldPromote: false,
        reason: "Template already promoted",
        readinessScore: 1,
      };
    }

    // Check execution count
    if (cached.stats.executions < this.criteria.minExecutions) {
      return {
        shouldPromote: false,
        reason: `Need ${this.criteria.minExecutions - cached.stats.executions} more executions`,
        readinessScore: cached.stats.executions / this.criteria.minExecutions,
      };
    }

    // Check success rate
    const successRate = this.cache.getSuccessRate(templateId);
    if (successRate < this.criteria.minSuccessRate) {
      return {
        shouldPromote: false,
        reason: `Success rate ${(successRate * 100).toFixed(1)}% below threshold ${(this.criteria.minSuccessRate * 100).toFixed(1)}%`,
        readinessScore: successRate / this.criteria.minSuccessRate,
      };
    }

    // Check extraction confidence (if configured)
    if (this.criteria.minConfidence !== undefined) {
      if (cached.metadata.extractionConfidence < this.criteria.minConfidence) {
        return {
          shouldPromote: false,
          reason: `Extraction confidence ${(cached.metadata.extractionConfidence * 100).toFixed(1)}% below threshold`,
          readinessScore: cached.metadata.extractionConfidence / this.criteria.minConfidence,
        };
      }
    }

    // Check age (if configured)
    if (this.criteria.maxAgeMs !== undefined) {
      const age = Date.now() - cached.metadata.extractedAt;
      if (age > this.criteria.maxAgeMs) {
        return {
          shouldPromote: false,
          reason: "Template is too old",
          readinessScore: 0.5, // Could still be promoted manually
        };
      }
    }

    // All checks passed
    this.emit({
      type: "check",
      templateId,
      decision: {
        shouldPromote: true,
        reason: "Meets all promotion criteria",
        readinessScore: 1,
      },
      timestamp: Date.now(),
    });

    return {
      shouldPromote: true,
      reason: "Meets all promotion criteria",
      readinessScore: 1,
    };
  }

  /**
   * Check all templates for promotion
   */
  checkAllPromotions(): Array<{
    templateId: string;
    decision: PromotionDecision;
  }> {
    const results: Array<{ templateId: string; decision: PromotionDecision }> = [];

    for (const cached of this.cache.getUnpromoted()) {
      const decision = this.checkPromotion(cached.template.id);
      results.push({
        templateId: cached.template.id,
        decision,
      });
    }

    return results;
  }

  // ===========================================================================
  // PROMOTION EXECUTION
  // ===========================================================================

  /**
   * Promote a single template to backend
   */
  async promote(templateId: string): Promise<PromotionResult> {
    const cached = this.cache.get(templateId);

    if (!cached) {
      return {
        success: false,
        templateId,
        error: "Template not found in cache",
      };
    }

    // Check if backend is online
    const isOnline = await this.client.healthCheck();
    if (!isOnline) {
      this.emit({
        type: "fail",
        templateId,
        result: {
          success: false,
          templateId,
          error: "Backend is offline",
        },
        timestamp: Date.now(),
      });

      return {
        success: false,
        templateId,
        error: "Backend is offline",
      };
    }

    // Create template in backend
    const success = await this.client.createTemplate(cached.template);

    if (success) {
      // Mark as promoted in cache
      this.cache.markPromoted(templateId);

      this.emit({
        type: "promote",
        templateId,
        result: { success: true, templateId },
        timestamp: Date.now(),
      });

      return { success: true, templateId };
    } else {
      this.emit({
        type: "fail",
        templateId,
        result: {
          success: false,
          templateId,
          error: "Backend rejected template",
        },
        timestamp: Date.now(),
      });

      return {
        success: false,
        templateId,
        error: "Backend rejected template",
      };
    }
  }

  /**
   * Promote all eligible templates
   */
  async promoteAll(): Promise<PromotionResult[]> {
    const results: PromotionResult[] = [];
    const candidates = this.cache.getPromotionCandidates(
      this.criteria.minExecutions,
      this.criteria.minSuccessRate
    );

    for (const cached of candidates) {
      const result = await this.promote(cached.template.id);
      results.push(result);

      // Small delay between promotions to avoid overwhelming backend
      if (candidates.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // ===========================================================================
  // AUTO-PROMOTION
  // ===========================================================================

  /**
   * Handle post-execution check (called after each template execution)
   */
  async handleExecutionComplete(
    templateId: string,
    success: boolean,
    durationMs: number,
    cost: number
  ): Promise<PromotionResult | null> {
    // Record the execution
    this.cache.recordExecution(templateId, success, durationMs, cost);

    // Skip auto-promotion if disabled
    if (!this.autoPromote) {
      return null;
    }

    // Check if now eligible for promotion
    const decision = this.checkPromotion(templateId);

    if (decision.shouldPromote) {
      return this.promote(templateId);
    }

    return null;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get promotion statistics
   */
  getStats(): {
    totalCached: number;
    promoted: number;
    pendingPromotion: number;
    eligible: number;
  } {
    const cacheStats = this.cache.getCacheStats();
    const candidates = this.cache.getPromotionCandidates(
      this.criteria.minExecutions,
      this.criteria.minSuccessRate
    );

    return {
      totalCached: cacheStats.templateCount,
      promoted: cacheStats.promotedCount,
      pendingPromotion: cacheStats.templateCount - cacheStats.promotedCount,
      eligible: candidates.length,
    };
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Update promotion criteria
   */
  setCriteria(criteria: Partial<PromotionCriteria>): void {
    this.criteria = { ...this.criteria, ...criteria };
  }

  /**
   * Enable/disable auto-promotion
   */
  setAutoPromote(enabled: boolean): void {
    this.autoPromote = enabled;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Emit a promotion event
   */
  private emit(event: PromotionEvent): void {
    if (this.onEvent) {
      this.onEvent(event);
    }
  }
}
