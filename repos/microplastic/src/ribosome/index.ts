/**
 * Ribosome Module
 *
 * Template extraction from successful improvisations.
 * The ribosome pattern: successful improvisation → cached template → promoted template
 */

// Types
export type {
  ExtractionResult,
  ExtractionAnalysis,
  ExtractionOptions,
  CachedTemplate,
  CacheMetadata,
  LocalExecutionStats,
  CacheConfig,
  PromotionCriteria,
  PromotionDecision,
  PromotionResult,
  ExecutionContext,
  RibosomeConfig,
} from "./types.ts";

export { DEFAULT_RIBOSOME_CONFIG } from "./types.ts";

// Extractor
export {
  TraceExtractor,
  calculateExtractionConfidence,
  type TaskGroup,
  type VariablePoint,
} from "./extractor.ts";

// Generator
export { TemplateGenerator } from "./template-generator.ts";

// Cache
export { TemplateCache } from "./cache.ts";

// Promotion
export {
  PromotionManager,
  type PromotionEvent,
  type PromotionManagerOptions,
} from "./promotion.ts";

// =============================================================================
// CONVENIENCE: Ribosome Facade
// =============================================================================

import type { ActivityTemplate, ExecutionTrace } from "@metabob/minibob";
import { ActivityAPIClient } from "../selection/client.ts";
import { TemplateGenerator } from "./template-generator.ts";
import { TemplateCache } from "./cache.ts";
import { PromotionManager } from "./promotion.ts";
import type {
  RibosomeConfig,
  ExecutionContext,
  ExtractionResult,
  PromotionResult,
} from "./types.ts";
import { DEFAULT_RIBOSOME_CONFIG } from "./types.ts";

/**
 * Ribosome - facade for template extraction and promotion
 */
export class Ribosome {
  private generator: TemplateGenerator;
  private cache: TemplateCache;
  private promotionManager: PromotionManager;
  private enabled: boolean;

  constructor(client: ActivityAPIClient, config: Partial<RibosomeConfig> = {}) {
    const fullConfig = { ...DEFAULT_RIBOSOME_CONFIG, ...config };

    this.enabled = fullConfig.enabled;
    this.generator = new TemplateGenerator(fullConfig.extraction);
    this.cache = new TemplateCache(fullConfig.cache);
    this.promotionManager = new PromotionManager({
      client,
      cache: this.cache,
      criteria: fullConfig.promotion,
      autoPromote: fullConfig.autoPromote,
    });
  }

  // ===========================================================================
  // MAIN OPERATIONS
  // ===========================================================================

  /**
   * Process a successful execution and extract a template
   */
  processExecution(context: ExecutionContext): ExtractionResult | null {
    if (!this.enabled) return null;
    if (!context.success) return null;

    // Generate template
    const result = this.generator.generate(context);

    // Cache it
    this.cache.add(result.template, {
      extractedAt: Date.now(),
      sourceExecutionId: context.executionId,
      originalGoal: context.goal,
      extractionConfidence: result.confidence,
    });

    return result;
  }

  /**
   * Record execution of a cached template and check for promotion
   */
  async recordExecution(
    templateId: string,
    success: boolean,
    durationMs: number,
    cost: number
  ): Promise<PromotionResult | null> {
    if (!this.enabled) return null;

    return this.promotionManager.handleExecutionComplete(
      templateId,
      success,
      durationMs,
      cost
    );
  }

  /**
   * Manually trigger promotion for a template
   */
  async promoteTemplate(templateId: string): Promise<PromotionResult> {
    return this.promotionManager.promote(templateId);
  }

  /**
   * Promote all eligible templates
   */
  async promoteAll(): Promise<PromotionResult[]> {
    return this.promotionManager.promoteAll();
  }

  // ===========================================================================
  // CACHE ACCESS
  // ===========================================================================

  /**
   * Get a cached template
   */
  getCachedTemplate(templateId: string): ActivityTemplate | undefined {
    return this.cache.getTemplate(templateId);
  }

  /**
   * Get all cached templates
   */
  getAllCachedTemplates(): ActivityTemplate[] {
    return this.cache.getAll().map((c) => c.template);
  }

  /**
   * Check if a template is cached
   */
  hasCachedTemplate(templateId: string): boolean {
    return this.cache.has(templateId);
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get ribosome statistics
   */
  getStats(): {
    cacheStats: ReturnType<TemplateCache["getCacheStats"]>;
    promotionStats: ReturnType<PromotionManager["getStats"]>;
  } {
    return {
      cacheStats: this.cache.getCacheStats(),
      promotionStats: this.promotionManager.getStats(),
    };
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    await this.cache.save();
  }

  /**
   * Load cache from disk
   */
  async load(): Promise<boolean> {
    return this.cache.load();
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Enable/disable ribosome
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if ribosome is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
