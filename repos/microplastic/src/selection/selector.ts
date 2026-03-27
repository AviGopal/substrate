/**
 * Template Selector
 *
 * Main interface for template selection using Thompson Sampling.
 * Coordinates between backend API, local cache, and Thompson state.
 */

import type { ActivityTemplate } from "@metabob/minibob";
import type {
  GoalContext,
  SelectionResult,
  TemplateRecommendation,
  ExecutionOutcome,
} from "./types.ts";
import { ActivityAPIClient, type ActivityAPIClientOptions } from "./client.ts";
import { OfflineCache, type OfflineCacheOptions } from "./offline.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Selector options
 */
export interface TemplateSelectorOptions {
  /** API client options */
  api: ActivityAPIClientOptions;
  /** Offline cache options */
  cache?: OfflineCacheOptions;
  /** Minimum confidence to select a template (0-1) */
  minConfidence?: number;
  /** Minimum sampled score to select (0-1) */
  minScore?: number;
  /** Number of candidates to request */
  candidateCount?: number;
}

/**
 * Selector state
 */
export interface SelectorState {
  /** Whether backend is online */
  online: boolean;
  /** Last successful backend connection */
  lastConnected: number | null;
  /** Cache statistics */
  cacheStats: {
    templateCount: number;
    lastSynced: number | null;
  };
}

// =============================================================================
// SELECTOR
// =============================================================================

/**
 * TemplateSelector - main template selection interface
 */
export class TemplateSelector {
  private client: ActivityAPIClient;
  private cache: OfflineCache;

  private minConfidence: number;
  private minScore: number;
  private candidateCount: number;

  constructor(options: TemplateSelectorOptions) {
    this.client = new ActivityAPIClient(options.api);
    this.cache = new OfflineCache(options.cache);

    this.minConfidence = options.minConfidence ?? 0.3;
    this.minScore = options.minScore ?? 0.2;
    this.candidateCount = options.candidateCount ?? 5;
  }

  // ===========================================================================
  // SELECTION
  // ===========================================================================

  /**
   * Select a template for a goal
   */
  async select(context: GoalContext): Promise<SelectionResult> {
    // Try backend first
    const backendResult = await this.selectFromBackend(context);
    if (backendResult) {
      return backendResult;
    }

    // Fall back to local cache
    return this.selectFromCache(context);
  }

  /**
   * Select from backend
   */
  private async selectFromBackend(
    context: GoalContext
  ): Promise<SelectionResult | null> {
    const response = await this.client.recommend(context, this.candidateCount);
    if (!response) {
      return null;
    }

    // Update local cache with backend data
    for (const rec of response.recommendations) {
      this.cache.cacheTemplate(rec.template);
    }
    this.cache.updateThompsonState(response.stats);

    // Find best candidate
    const candidates = response.recommendations;
    if (candidates.length === 0) {
      return {
        template: null,
        candidates: [],
        shouldImprovise: true,
        reason: "No templates match this goal",
        source: "backend",
      };
    }

    // Check if best candidate meets thresholds
    const best = candidates[0]!;
    if (best.score >= this.minScore && best.confidence >= this.minConfidence) {
      return {
        template: best.template,
        candidates,
        shouldImprovise: false,
        reason: best.reason,
        source: "backend",
      };
    }

    // Below threshold - suggest improvisation but return candidates
    return {
      template: null,
      candidates,
      shouldImprovise: true,
      reason: `Best template score (${best.score.toFixed(2)}) below threshold`,
      source: "backend",
    };
  }

  /**
   * Select from local cache
   */
  private selectFromCache(context: GoalContext): SelectionResult {
    const templates = this.cache.getAllTemplates();
    if (templates.length === 0) {
      return {
        template: null,
        candidates: [],
        shouldImprovise: true,
        reason: "No cached templates available (offline)",
        source: "cache",
      };
    }

    // Filter templates that might match the goal
    const matchingTemplates = this.filterByGoal(templates, context);
    if (matchingTemplates.length === 0) {
      return {
        template: null,
        candidates: [],
        shouldImprovise: true,
        reason: "No cached templates match this goal",
        source: "cache",
      };
    }

    // Use Thompson sampling to rank
    const thompson = this.cache.getThompsonState();
    const samples = thompson.sampleAll(matchingTemplates.map((t) => t.id));

    // Build candidates
    const candidates: TemplateRecommendation[] = samples
      .slice(0, this.candidateCount)
      .map((sample) => {
        const template = matchingTemplates.find((t) => t.id === sample.templateId)!;
        return {
          template,
          score: sample.score,
          confidence: this.estimateConfidence(template, context),
          reason: "Selected from local cache via Thompson sampling",
        };
      });

    // Check if best meets threshold
    const best = candidates[0];
    if (best && best.score >= this.minScore) {
      return {
        template: best.template,
        candidates,
        shouldImprovise: false,
        reason: best.reason,
        source: "cache",
      };
    }

    return {
      template: null,
      candidates,
      shouldImprovise: true,
      reason: "No cached template meets score threshold",
      source: "cache",
    };
  }

  // ===========================================================================
  // OUTCOME RECORDING
  // ===========================================================================

  /**
   * Record execution outcome
   */
  async recordOutcome(outcome: ExecutionOutcome): Promise<void> {
    // Update local Thompson state immediately
    this.cache.getThompsonState().update(outcome);

    // Try to send to backend (fire and forget)
    this.client.recordOutcome(outcome).catch(() => {
      // Silently fail - we already updated local state
    });

    // Save cache
    await this.cache.save().catch(() => {
      // Silently fail
    });
  }

  // ===========================================================================
  // TEMPLATE MANAGEMENT
  // ===========================================================================

  /**
   * Create a new template
   */
  async createTemplate(template: ActivityTemplate): Promise<boolean> {
    // Always cache locally
    this.cache.cacheTemplate(template);

    // Try to push to backend
    const success = await this.client.createTemplate(template);

    // Save cache
    await this.cache.save().catch(() => {});

    return success;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<ActivityTemplate | null> {
    // Check cache first
    const cached = this.cache.getTemplate(templateId);
    if (cached) {
      return cached;
    }

    // Try backend
    const template = await this.client.getTemplate(templateId);
    if (template) {
      this.cache.cacheTemplate(template);
    }

    return template;
  }

  /**
   * List all available templates
   */
  async listTemplates(options?: {
    category?: string;
    level?: number;
  }): Promise<ActivityTemplate[]> {
    // Try backend first
    const backendTemplates = await this.client.listTemplates(options);
    if (backendTemplates) {
      this.cache.cacheTemplates(backendTemplates);
      return backendTemplates;
    }

    // Fall back to cache
    let templates = this.cache.getAllTemplates();

    // Apply filters
    if (options?.category) {
      templates = templates.filter((t) => t.category === options.category);
    }
    if (options?.level !== undefined) {
      templates = templates.filter(
        (t) => (t.metadata as { level?: number })?.level === options.level
      );
    }

    return templates;
  }

  // ===========================================================================
  // STATE
  // ===========================================================================

  /**
   * Get selector state
   */
  getState(): SelectorState {
    const clientState = this.client.getState();
    const cacheStats = this.cache.getCacheStats();

    return {
      online: clientState.online,
      lastConnected: clientState.lastConnected,
      cacheStats: {
        templateCount: cacheStats.templateCount,
        lastSynced: this.cache.getLastSyncedAt(),
      },
    };
  }

  /**
   * Check if backend is online
   */
  async checkConnection(): Promise<boolean> {
    return this.client.healthCheck();
  }

  /**
   * Load cache from storage
   */
  async loadCache(): Promise<boolean> {
    return this.cache.load();
  }

  /**
   * Save cache to storage
   */
  async saveCache(): Promise<void> {
    return this.cache.save();
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  /**
   * Filter templates by goal context
   */
  private filterByGoal(
    templates: ActivityTemplate[],
    context: GoalContext
  ): ActivityTemplate[] {
    // Simple keyword matching for now
    const goalLower = context.goal.toLowerCase();
    const keywords = goalLower.split(/\s+/).filter((w) => w.length > 2);

    return templates.filter((template) => {
      const nameLower = template.name.toLowerCase();
      const descLower = (template.description ?? "").toLowerCase();
      const categoryLower = (template.category ?? "").toLowerCase();

      // Check if any keyword matches
      return keywords.some(
        (keyword) =>
          nameLower.includes(keyword) ||
          descLower.includes(keyword) ||
          categoryLower.includes(keyword)
      );
    });
  }

  /**
   * Estimate confidence based on local matching
   */
  private estimateConfidence(
    template: ActivityTemplate,
    context: GoalContext
  ): number {
    // Simple heuristic based on keyword overlap
    const goalWords = new Set(
      context.goal.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    );
    const templateWords = new Set(
      `${template.name} ${template.description ?? ""}`
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    // Calculate Jaccard similarity
    const intersection = [...goalWords].filter((w) => templateWords.has(w));
    const union = new Set([...goalWords, ...templateWords]);

    return union.size > 0 ? intersection.length / union.size : 0;
  }
}
