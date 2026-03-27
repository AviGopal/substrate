/**
 * Offline Mode Support
 *
 * Local caching of templates and Thompson state for offline operation.
 */

import type { ActivityTemplate } from "@metabob/minibob";
import type { TemplateStats } from "./types.ts";
import { ThompsonState } from "./thompson.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Cache entry for a template
 */
interface CachedTemplate {
  template: ActivityTemplate;
  cachedAt: number;
  lastUsedAt: number;
  useCount: number;
}

/**
 * Serialized cache state
 */
interface CacheState {
  templates: Array<{
    id: string;
    template: ActivityTemplate;
    cachedAt: number;
    lastUsedAt: number;
    useCount: number;
  }>;
  thompsonStats: TemplateStats[];
  lastSyncedAt: number | null;
}

/**
 * Cache options
 */
export interface OfflineCacheOptions {
  /** Maximum number of templates to cache */
  maxTemplates?: number;
  /** Cache TTL in ms (default: 24 hours) */
  cacheTtlMs?: number;
  /** Storage path for persistence */
  storagePath?: string;
}

// =============================================================================
// OFFLINE CACHE
// =============================================================================

/**
 * OfflineCache - manages local template cache and Thompson state
 */
export class OfflineCache {
  private templates = new Map<string, CachedTemplate>();
  private thompsonState: ThompsonState;
  private lastSyncedAt: number | null = null;

  private maxTemplates: number;
  private cacheTtlMs: number;
  private storagePath: string | null;

  constructor(options: OfflineCacheOptions = {}) {
    this.maxTemplates = options.maxTemplates ?? 100;
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.storagePath = options.storagePath ?? null;
    this.thompsonState = new ThompsonState();
  }

  // ===========================================================================
  // TEMPLATE CACHE
  // ===========================================================================

  /**
   * Cache a template
   */
  cacheTemplate(template: ActivityTemplate): void {
    const existing = this.templates.get(template.id);
    const now = Date.now();

    if (existing) {
      // Update existing entry
      existing.template = template;
      existing.cachedAt = now;
    } else {
      // Add new entry
      this.templates.set(template.id, {
        template,
        cachedAt: now,
        lastUsedAt: now,
        useCount: 0,
      });

      // Evict if over limit
      this.evictIfNeeded();
    }
  }

  /**
   * Cache multiple templates
   */
  cacheTemplates(templates: ActivityTemplate[]): void {
    for (const template of templates) {
      this.cacheTemplate(template);
    }
  }

  /**
   * Get a cached template
   */
  getTemplate(templateId: string): ActivityTemplate | null {
    const entry = this.templates.get(templateId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.cachedAt > this.cacheTtlMs) {
      this.templates.delete(templateId);
      return null;
    }

    // Update usage stats
    entry.lastUsedAt = Date.now();
    entry.useCount += 1;

    return entry.template;
  }

  /**
   * Get all cached templates
   */
  getAllTemplates(): ActivityTemplate[] {
    const now = Date.now();
    const templates: ActivityTemplate[] = [];

    for (const [id, entry] of this.templates) {
      if (now - entry.cachedAt <= this.cacheTtlMs) {
        templates.push(entry.template);
      } else {
        this.templates.delete(id);
      }
    }

    return templates;
  }

  /**
   * Get templates matching criteria
   */
  findTemplates(
    filter: (template: ActivityTemplate) => boolean
  ): ActivityTemplate[] {
    return this.getAllTemplates().filter(filter);
  }

  /**
   * Remove a template from cache
   */
  removeTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Clear all cached templates
   */
  clearTemplates(): void {
    this.templates.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    templateCount: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    totalUseCount: number;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;
    let totalUseCount = 0;

    for (const entry of this.templates.values()) {
      if (oldest === null || entry.cachedAt < oldest) {
        oldest = entry.cachedAt;
      }
      if (newest === null || entry.cachedAt > newest) {
        newest = entry.cachedAt;
      }
      totalUseCount += entry.useCount;
    }

    return {
      templateCount: this.templates.size,
      oldestEntry: oldest,
      newestEntry: newest,
      totalUseCount,
    };
  }

  // ===========================================================================
  // THOMPSON STATE
  // ===========================================================================

  /**
   * Get the Thompson state
   */
  getThompsonState(): ThompsonState {
    return this.thompsonState;
  }

  /**
   * Update Thompson state from backend
   */
  updateThompsonState(stats: TemplateStats[]): void {
    this.thompsonState.updateFromBackend(stats);
    this.lastSyncedAt = Date.now();
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncedAt(): number | null {
    return this.lastSyncedAt;
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
      templates: Array.from(this.templates.entries()).map(([id, entry]) => ({
        id,
        ...entry,
      })),
      thompsonStats: this.thompsonState.export(),
      lastSyncedAt: this.lastSyncedAt,
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

      // Restore templates
      this.templates.clear();
      for (const entry of state.templates) {
        this.templates.set(entry.id, {
          template: entry.template,
          cachedAt: entry.cachedAt,
          lastUsedAt: entry.lastUsedAt,
          useCount: entry.useCount,
        });
      }

      // Restore Thompson state
      this.thompsonState.import(state.thompsonStats);
      this.lastSyncedAt = state.lastSyncedAt;

      return true;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  /**
   * Evict least recently used templates if over limit
   */
  private evictIfNeeded(): void {
    if (this.templates.size <= this.maxTemplates) return;

    // Sort by lastUsedAt ascending
    const entries = Array.from(this.templates.entries()).sort(
      (a, b) => a[1].lastUsedAt - b[1].lastUsedAt
    );

    // Remove oldest entries until under limit
    const toRemove = entries.length - this.maxTemplates;
    for (let i = 0; i < toRemove; i++) {
      this.templates.delete(entries[i]![0]);
    }
  }
}
