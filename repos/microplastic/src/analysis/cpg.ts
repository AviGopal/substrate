/**
 * CPG Client
 *
 * Client for querying Code Property Graph via metabob-mcp.
 */

import type {
  CPGNode,
  CPGEdge,
  CPGQueryResult,
  CPGQueryOptions,
  CPGQueryPointer,
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
  result: CPGQueryResult;
  cachedAt: number;
}

// =============================================================================
// CLIENT
// =============================================================================

/**
 * CPGClient - queries Code Property Graph
 */
export class CPGClient {
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
  // QUERIES
  // ===========================================================================

  /**
   * Find all callers of a function
   */
  async findCallers(
    functionName: string,
    options?: CPGQueryOptions
  ): Promise<CPGQueryResult> {
    return this.executeQuery({
      type: "cpg_query",
      queryType: "find_callers",
      target: functionName,
      options,
    });
  }

  /**
   * Find all functions called by a function
   */
  async findCallees(
    functionName: string,
    options?: CPGQueryOptions
  ): Promise<CPGQueryResult> {
    return this.executeQuery({
      type: "cpg_query",
      queryType: "find_callees",
      target: functionName,
      options,
    });
  }

  /**
   * Find all references to a symbol
   */
  async findReferences(
    symbolName: string,
    options?: CPGQueryOptions
  ): Promise<CPGQueryResult> {
    return this.executeQuery({
      type: "cpg_query",
      queryType: "find_references",
      target: symbolName,
      options,
    });
  }

  /**
   * Find definitions of a symbol
   */
  async findDefinitions(
    symbolName: string,
    options?: CPGQueryOptions
  ): Promise<CPGQueryResult> {
    return this.executeQuery({
      type: "cpg_query",
      queryType: "find_definitions",
      target: symbolName,
      options,
    });
  }

  /**
   * Find imports in a file or matching a pattern
   */
  async findImports(
    filePattern?: string,
    options?: CPGQueryOptions
  ): Promise<CPGQueryResult> {
    return this.executeQuery({
      type: "cpg_query",
      queryType: "find_imports",
      target: filePattern,
      options: { ...options, filePattern },
    });
  }

  /**
   * Find exports from a file or matching a pattern
   */
  async findExports(
    filePattern?: string,
    options?: CPGQueryOptions
  ): Promise<CPGQueryResult> {
    return this.executeQuery({
      type: "cpg_query",
      queryType: "find_exports",
      target: filePattern,
      options: { ...options, filePattern },
    });
  }

  /**
   * Execute a custom CPG query
   */
  async customQuery(
    query: string,
    options?: CPGQueryOptions
  ): Promise<CPGQueryResult> {
    return this.executeQuery({
      type: "cpg_query",
      queryType: "custom",
      query,
      options,
    });
  }

  // ===========================================================================
  // GRAPH TRAVERSAL
  // ===========================================================================

  /**
   * Get the call graph for a function
   */
  async getCallGraph(
    functionName: string,
    depth = 2
  ): Promise<CPGQueryResult> {
    const nodes: CPGNode[] = [];
    const edges: CPGEdge[] = [];
    const visited = new Set<string>();

    await this.traverseCallGraph(
      functionName,
      depth,
      nodes,
      edges,
      visited
    );

    return { nodes, edges };
  }

  /**
   * Traverse call graph recursively
   */
  private async traverseCallGraph(
    functionName: string,
    depth: number,
    nodes: CPGNode[],
    edges: CPGEdge[],
    visited: Set<string>
  ): Promise<void> {
    if (depth <= 0 || visited.has(functionName)) {
      return;
    }

    visited.add(functionName);

    const result = await this.findCallees(functionName, { depth: 1 });

    for (const node of result.nodes) {
      if (!nodes.some((n) => n.id === node.id)) {
        nodes.push(node);
      }
    }

    for (const edge of result.edges) {
      if (!edges.some((e) => e.source === edge.source && e.target === edge.target)) {
        edges.push(edge);
      }
    }

    // Recurse into callees
    for (const node of result.nodes) {
      if (node.type === "function" || node.type === "method") {
        await this.traverseCallGraph(
          node.name,
          depth - 1,
          nodes,
          edges,
          visited
        );
      }
    }
  }

  // ===========================================================================
  // EXECUTION
  // ===========================================================================

  /**
   * Execute a CPG query
   */
  async executeQuery(pointer: CPGQueryPointer): Promise<CPGQueryResult> {
    const cacheKey = this.buildCacheKey(pointer);

    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Execute query
    const startTime = Date.now();
    const result = await this.callMCP("cpg_query", {
      query_type: pointer.queryType,
      target: pointer.target,
      query: pointer.query,
      ...pointer.options,
    });

    if (!result.success) {
      throw new Error(`CPG query failed: ${result.error}`);
    }

    const queryResult = this.parseResult(result.data);
    queryResult.executionTimeMs = Date.now() - startTime;

    // Cache result
    this.setCache(cacheKey, queryResult);

    return queryResult;
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
   * Parse MCP response to CPGQueryResult
   */
  private parseResult(data: unknown): CPGQueryResult {
    if (!data || typeof data !== "object") {
      return { nodes: [], edges: [] };
    }

    const result = data as { nodes?: unknown[]; edges?: unknown[] };

    return {
      nodes: Array.isArray(result.nodes)
        ? result.nodes.map(this.parseNode)
        : [],
      edges: Array.isArray(result.edges)
        ? result.edges.map(this.parseEdge)
        : [],
    };
  }

  /**
   * Parse a node from MCP response
   */
  private parseNode = (data: unknown): CPGNode => {
    const node = data as Record<string, unknown>;
    return {
      id: String(node.id || ""),
      type: (node.type as CPGNode["type"]) || "function",
      name: String(node.name || ""),
      filePath: String(node.file_path || node.filePath || ""),
      line: typeof node.line === "number" ? node.line : undefined,
      column: typeof node.column === "number" ? node.column : undefined,
      properties: node.properties as Record<string, unknown> | undefined,
    };
  };

  /**
   * Parse an edge from MCP response
   */
  private parseEdge = (data: unknown): CPGEdge => {
    const edge = data as Record<string, unknown>;
    return {
      source: String(edge.source || ""),
      target: String(edge.target || ""),
      type: (edge.type as CPGEdge["type"]) || "calls",
      properties: edge.properties as Record<string, unknown> | undefined,
    };
  };

  // ===========================================================================
  // CACHE
  // ===========================================================================

  /**
   * Build cache key from pointer
   */
  private buildCacheKey(pointer: CPGQueryPointer): string {
    return JSON.stringify({
      type: pointer.queryType,
      target: pointer.target,
      query: pointer.query,
      options: pointer.options,
    });
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): CPGQueryResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    if (age > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, result: CPGQueryResult): void {
    this.cache.set(key, {
      result,
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
