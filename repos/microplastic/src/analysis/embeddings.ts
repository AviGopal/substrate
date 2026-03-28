/**
 * Embeddings Client
 *
 * Client for semantic code search via metabob-mcp embeddings.
 */

import type {
  EmbeddingSearchResult,
  EmbeddingSearchOptions,
  EmbeddingSearchPointer,
  MCPClientOptions,
  MCPToolResult,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Cache entry
 */
interface CacheEntry {
  results: EmbeddingSearchResult[];
  cachedAt: number;
}

// =============================================================================
// CLIENT
// =============================================================================

/**
 * EmbeddingsClient - semantic code search
 */
export class EmbeddingsClient {
  private serverUrl: string;
  private timeout: number;
  private cacheTtlMs: number;
  private cache = new Map<string, CacheEntry>();
  private connected = false;

  constructor(options: MCPClientOptions) {
    this.serverUrl = options.serverUrl.replace(/\/$/, "");
    this.timeout = options.timeout ?? 30000;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes
  }

  // ===========================================================================
  // SEARCH
  // ===========================================================================

  /**
   * Search for similar code using natural language
   */
  async search(
    query: string,
    options?: EmbeddingSearchOptions
  ): Promise<EmbeddingSearchResult[]> {
    return this.executeSearch({
      type: "embedding_search",
      query,
      options,
    });
  }

  /**
   * Find code similar to a given code snippet
   */
  async findSimilar(
    codeSnippet: string,
    options?: EmbeddingSearchOptions
  ): Promise<EmbeddingSearchResult[]> {
    return this.search(`code similar to: ${codeSnippet}`, options);
  }

  /**
   * Find implementations of a concept
   */
  async findImplementations(
    concept: string,
    options?: EmbeddingSearchOptions
  ): Promise<EmbeddingSearchResult[]> {
    return this.search(`implementation of ${concept}`, options);
  }

  /**
   * Find examples of a pattern
   */
  async findExamples(
    pattern: string,
    options?: EmbeddingSearchOptions
  ): Promise<EmbeddingSearchResult[]> {
    return this.search(`examples of ${pattern}`, options);
  }

  /**
   * Find error handling code
   */
  async findErrorHandling(
    errorType?: string,
    options?: EmbeddingSearchOptions
  ): Promise<EmbeddingSearchResult[]> {
    const query = errorType
      ? `error handling for ${errorType}`
      : "error handling and exception handling";
    return this.search(query, options);
  }

  /**
   * Find test code for a function
   */
  async findTests(
    functionName: string,
    options?: EmbeddingSearchOptions
  ): Promise<EmbeddingSearchResult[]> {
    return this.search(`tests for ${functionName}`, {
      ...options,
      extensions: options?.extensions || [".test.ts", ".spec.ts", ".test.js", ".spec.js"],
    });
  }

  // ===========================================================================
  // BATCH OPERATIONS
  // ===========================================================================

  /**
   * Search with multiple queries
   */
  async batchSearch(
    queries: string[],
    options?: EmbeddingSearchOptions
  ): Promise<Map<string, EmbeddingSearchResult[]>> {
    const results = new Map<string, EmbeddingSearchResult[]>();

    // Execute in parallel with limited concurrency
    const batchSize = 5;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((query) => this.search(query, options))
      );

      batch.forEach((query, index) => {
        results.set(query, batchResults[index]!);
      });
    }

    return results;
  }

  /**
   * Find related code across multiple concepts
   */
  async findRelated(
    concepts: string[],
    options?: EmbeddingSearchOptions
  ): Promise<EmbeddingSearchResult[]> {
    const allResults = await this.batchSearch(concepts, options);

    // Merge and deduplicate results
    const seen = new Set<string>();
    const merged: EmbeddingSearchResult[] = [];

    for (const results of allResults.values()) {
      for (const result of results) {
        const key = `${result.filePath}:${result.startLine}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(result);
        }
      }
    }

    // Sort by score
    return merged.sort((a, b) => b.score - a.score);
  }

  // ===========================================================================
  // EXECUTION
  // ===========================================================================

  /**
   * Execute an embedding search
   */
  async executeSearch(
    pointer: EmbeddingSearchPointer
  ): Promise<EmbeddingSearchResult[]> {
    const cacheKey = this.buildCacheKey(pointer);

    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute search
    const result = await this.callMCP("embedding_search", {
      query: pointer.query,
      limit: pointer.options?.limit ?? 10,
      min_score: pointer.options?.minScore ?? 0.5,
      extensions: pointer.options?.extensions,
      directory: pointer.options?.directory,
      include_content: pointer.options?.includeContent ?? true,
    });

    if (!result.success) {
      throw new Error(`Embedding search failed: ${result.error}`);
    }

    const searchResults = this.parseResults(result.data);

    // Cache results
    this.setCache(cacheKey, searchResults);

    return searchResults;
  }

  // ===========================================================================
  // MCP COMMUNICATION
  // ===========================================================================

  /**
   * Call MCP tool
   */
  private async callMCP(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.serverUrl}/tools/${toolName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text().catch(() => "Unknown error");
        return {
          success: false,
          error: `HTTP ${response.status}: ${error}`,
        };
      }

      const data = await response.json();
      this.connected = true;

      return {
        success: true,
        data,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.connected = false;

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Parse MCP response to search results
   */
  private parseResults(data: unknown): EmbeddingSearchResult[] {
    if (!data || !Array.isArray(data)) {
      // Check if data is wrapped in results property
      const wrapped = data as { results?: unknown[] } | null;
      if (wrapped?.results && Array.isArray(wrapped.results)) {
        return wrapped.results.map(this.parseResult);
      }
      return [];
    }

    return data.map(this.parseResult);
  }

  /**
   * Parse a single result
   */
  private parseResult = (data: unknown): EmbeddingSearchResult => {
    const result = data as Record<string, unknown>;
    return {
      filePath: String(result.file_path || result.filePath || ""),
      content: String(result.content || ""),
      score: typeof result.score === "number" ? result.score : 0,
      startLine: typeof result.start_line === "number"
        ? result.start_line
        : typeof result.startLine === "number"
        ? result.startLine
        : undefined,
      endLine: typeof result.end_line === "number"
        ? result.end_line
        : typeof result.endLine === "number"
        ? result.endLine
        : undefined,
      metadata: result.metadata as Record<string, unknown> | undefined,
    };
  };

  // ===========================================================================
  // CACHE
  // ===========================================================================

  /**
   * Build cache key
   */
  private buildCacheKey(pointer: EmbeddingSearchPointer): string {
    return JSON.stringify({
      query: pointer.query,
      options: pointer.options,
    });
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): EmbeddingSearchResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    if (age > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.results;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, results: EmbeddingSearchResult[]): void {
    this.cache.set(key, {
      results,
      cachedAt: Date.now(),
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ===========================================================================
  // STATE
  // ===========================================================================

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    const result = await this.callMCP("health", {});
    return result.success;
  }
}
