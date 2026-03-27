/**
 * Template Cache
 *
 * Local storage for extracted templates with execution statistics.
 * Templates are cached locally before promotion to backend.
 */

import type { ActivityTemplate } from "@metabob/minibob";
import type {
  CachedTemplate,
  CacheMetadata,
  LocalExecutionStats,
  CacheConfig,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Serialized cache state for persistence
 */
interface CacheState {
  templates: Array<{
    id: string;
    template: ActivityTemplate;
    metadata: CacheMetadata;
    stats: LocalExecutionStats;
  }>;
  version: number;
  lastSaved: number;
}

// =============================================================================
// CACHE
// =============================================================================

/**
 * TemplateCache - manages locally extracted templates
 */
export class TemplateCache {
  private templates = new Map<string, CachedTemplate>();
  private maxTemplates: number;
  private cacheTtlMs: number;
  private storagePath: string | null;

  constructor(config: CacheConfig = {}) {
    this.maxTemplates = config.maxTemplates ?? 100;
    this.cacheTtlMs = config.cacheTtlMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    this.storagePath = config.storagePath ?? null;
  }

  // ===========================================================================
  // TEMPLATE MANAGEMENT
  // ===========================================================================

  /**
   * Add a newly extracted template to the cache
   */
  add(
    template: ActivityTemplate,
    metadata: Omit<CacheMetadata, "promoted" | "promotedAt">
  ): void {
    const cached: CachedTemplate = {
      template,
      metadata: {
        ...metadata,
        promoted: false,
      },
      stats: {
        executions: 0,
        successes: 0,
        failures: 0,
        avgDurationMs: 0,
        avgCost: 0,
        lastExecutedAt: null,
      },
    };

    this.templates.set(template.id, cached);

    // Evict if over limit
    this.evictIfNeeded();
  }

  /**
   * Get a cached template
   */
  get(templateId: string): CachedTemplate | undefined {
    const cached = this.templates.get(templateId);
    if (!cached) return undefined;

    // Check if expired
    const age = Date.now() - cached.metadata.extractedAt;
    if (age > this.cacheTtlMs) {
      this.templates.delete(templateId);
      return undefined;
    }

    return cached;
  }

  /**
   * Get the underlying template
   */
  getTemplate(templateId: string): ActivityTemplate | undefined {
    return this.get(templateId)?.template;
  }

  /**
   * Check if a template is cached
   */
  has(templateId: string): boolean {
    return this.get(templateId) !== undefined;
  }

  /**
   * Remove a template from cache
   */
  remove(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Get all cached templates
   */
  getAll(): CachedTemplate[] {
    const now = Date.now();
    const valid: CachedTemplate[] = [];

    for (const [id, cached] of this.templates) {
      const age = now - cached.metadata.extractedAt;
      if (age <= this.cacheTtlMs) {
        valid.push(cached);
      } else {
        this.templates.delete(id);
      }
    }

    return valid;
  }

  /**
   * Get templates ready for promotion
   */
  getPromotionCandidates(
    minExecutions: number,
    minSuccessRate: number
  ): CachedTemplate[] {
    return this.getAll().filter((cached) => {
      // Skip already promoted
      if (cached.metadata.promoted) return false;

      // Check execution count
      if (cached.stats.executions < minExecutions) return false;

      // Check success rate
      const successRate =
        cached.stats.executions > 0
          ? cached.stats.successes / cached.stats.executions
          : 0;

      return successRate >= minSuccessRate;
    });
  }

  /**
   * Get unpromoted templates
   */
  getUnpromoted(): CachedTemplate[] {
    return this.getAll().filter((cached) => !cached.metadata.promoted);
  }

  // ===========================================================================
  // EXECUTION TRACKING
  // ===========================================================================

  /**
   * Record an execution of a cached template
   */
  recordExecution(
    templateId: string,
    success: boolean,
    durationMs: number,
    cost: number
  ): void {
    const cached = this.templates.get(templateId);
    if (!cached) return;

    const stats = cached.stats;

    // Update counts
    stats.executions += 1;
    if (success) {
      stats.successes += 1;
    } else {
      stats.failures += 1;
    }

    // Update averages (exponential moving average)
    const alpha = 0.1;
    if (stats.executions === 1) {
      stats.avgDurationMs = durationMs;
      stats.avgCost = cost;
    } else {
      stats.avgDurationMs = (1 - alpha) * stats.avgDurationMs + alpha * durationMs;
      stats.avgCost = (1 - alpha) * stats.avgCost + alpha * cost;
    }

    stats.lastExecutedAt = Date.now();
  }

  /**
   * Get execution statistics for a template
   */
  getStats(templateId: string): LocalExecutionStats | undefined {
    return this.get(templateId)?.stats;
  }

  /**
   * Calculate success rate for a template
   */
  getSuccessRate(templateId: string): number {
    const stats = this.getStats(templateId);
    if (!stats || stats.executions === 0) return 0;
    return stats.successes / stats.executions;
  }

  // ===========================================================================
  // PROMOTION TRACKING
  // ===========================================================================

  /**
   * Mark a template as promoted
   */
  markPromoted(templateId: string): void {
    const cached = this.templates.get(templateId);
    if (!cached) return;

    cached.metadata.promoted = true;
    cached.metadata.promotedAt = Date.now();
  }

  /**
   * Check if a template has been promoted
   */
  isPromoted(templateId: string): boolean {
    return this.get(templateId)?.metadata.promoted ?? false;
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  /**
   * Save cache to storage
   */
  async save(): Promise<void> {
    if (!this.storagePath) return;

    const state: CacheState = {
      templates: Array.from(this.templates.entries()).map(([id, cached]) => ({
        id,
        template: cached.template,
        metadata: cached.metadata,
        stats: cached.stats,
      })),
      version: 1,
      lastSaved: Date.now(),
    };

    const file = Bun.file(this.storagePath);
    await Bun.write(file, JSON.stringify(state, null, 2));
  }

  /**
   * Load cache from storage
   */
  async load(): Promise<boolean> {
    if (!this.storagePath) return false;

    try {
      const file = Bun.file(this.storagePath);
      if (!(await file.exists())) return false;

      const content = await file.text();
      const state: CacheState = JSON.parse(content);

      // Validate version
      if (state.version !== 1) {
        console.warn(`[TemplateCache] Unknown cache version: ${state.version}`);
        return false;
      }

      // Restore templates
      this.templates.clear();
      for (const entry of state.templates) {
        this.templates.set(entry.id, {
          template: entry.template,
          metadata: entry.metadata,
          stats: entry.stats,
        });
      }

      return true;
    } catch (error) {
      console.error(`[TemplateCache] Failed to load cache:`, error);
      return false;
    }
  }

  /**
   * Clear all cached templates
   */
  clear(): void {
    this.templates.clear();
  }

  // ===========================================================================
  // CACHE STATISTICS
  // ===========================================================================

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    templateCount: number;
    promotedCount: number;
    totalExecutions: number;
    avgSuccessRate: number;
  } {
    const all = this.getAll();
    let totalExecutions = 0;
    let totalSuccesses = 0;
    let promotedCount = 0;

    for (const cached of all) {
      totalExecutions += cached.stats.executions;
      totalSuccesses += cached.stats.successes;
      if (cached.metadata.promoted) promotedCount += 1;
    }

    return {
      templateCount: all.length,
      promotedCount,
      totalExecutions,
      avgSuccessRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Evict templates if over the limit (LRU)
   */
  private evictIfNeeded(): void {
    if (this.templates.size <= this.maxTemplates) return;

    // Sort by last executed (null = never executed = oldest)
    const entries = Array.from(this.templates.entries()).sort((a, b) => {
      const aTime = a[1].stats.lastExecutedAt ?? a[1].metadata.extractedAt;
      const bTime = b[1].stats.lastExecutedAt ?? b[1].metadata.extractedAt;
      return aTime - bTime;
    });

    // Remove oldest unpromoted templates first
    const toRemove = entries.length - this.maxTemplates;
    let removed = 0;

    for (const [id, cached] of entries) {
      if (removed >= toRemove) break;

      // Prefer to remove unpromoted templates
      if (!cached.metadata.promoted) {
        this.templates.delete(id);
        removed += 1;
      }
    }

    // If still over limit, remove oldest promoted
    if (this.templates.size > this.maxTemplates) {
      for (const [id] of entries) {
        if (this.templates.size <= this.maxTemplates) break;
        this.templates.delete(id);
      }
    }
  }
}
