/**
 * MCP Vessel
 *
 * Vessel for metabob-mcp integration providing CPG queries,
 * embedding search, and impact analysis capabilities.
 */

import type { Impulse, ImpulsePointer, ActivityTemplate } from "@metabob/minibob";
import type {
  VesselProvider,
  VesselContext,
  VesselHealth,
  VesselCapability,
  VesselLogger,
  ResolverResult,
} from "./types.ts";
import { ResolverError } from "./errors.ts";
import { CPGClient } from "../analysis/cpg.ts";
import { EmbeddingsClient } from "../analysis/embeddings.ts";
import type {
  CPGQueryPointer,
  EmbeddingSearchPointer,
  ImpactAnalysisPointer,
  AnalysisPointer,
  MCPClientOptions,
} from "../analysis/types.ts";

// =============================================================================
// CONSTANTS
// =============================================================================

const VESSEL_ID = "@metabob/mcp";
const VESSEL_NAME = "MCP Analysis Vessel";
const VESSEL_VERSION = "0.1.0";
const VESSEL_DESCRIPTION = "Code Property Graph and semantic search via metabob-mcp";

/**
 * Pointer types this vessel can resolve
 */
const RESOLVABLE_TYPES = ["cpg_query", "embedding_search", "impact_analysis"] as const;

// =============================================================================
// MCP VESSEL
// =============================================================================

/**
 * MCPVessel - Analysis capabilities via metabob-mcp
 *
 * Provides:
 * - CPG queries (callers, callees, references, definitions)
 * - Embedding search (semantic code search)
 * - Impact analysis (change impact estimation)
 */
export class MCPVessel implements VesselProvider {
  readonly id = VESSEL_ID;
  readonly name = VESSEL_NAME;
  readonly version = VESSEL_VERSION;
  readonly description = VESSEL_DESCRIPTION;

  private cpgClient: CPGClient | null = null;
  private embeddingsClient: EmbeddingsClient | null = null;
  private logger: VesselLogger | null = null;
  private serverUrl: string = "";
  private initialized = false;

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  async initialize(context: VesselContext): Promise<void> {
    this.logger = context.logger;

    // Get MCP server URL from environment or config
    this.serverUrl =
      context.config.environment.MCP_SERVER_URL ||
      context.config.environment.METABOB_MCP_URL ||
      (context.config.options.mcpServerUrl as string) ||
      "http://localhost:8080";

    const clientOptions: MCPClientOptions = {
      serverUrl: this.serverUrl,
      timeout: 30000,
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
    };

    this.cpgClient = new CPGClient(clientOptions);
    this.embeddingsClient = new EmbeddingsClient(clientOptions);

    this.logger.info(`Initialized with MCP server: ${this.serverUrl}`);
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // Clear caches
    this.cpgClient?.clearCache();
    this.embeddingsClient?.clearCache();

    this.cpgClient = null;
    this.embeddingsClient = null;
    this.initialized = false;

    this.logger?.info("Shutdown complete");
  }

  async healthCheck(): Promise<VesselHealth> {
    const checks: VesselHealth["checks"] = [];

    // Check CPG client
    if (this.cpgClient) {
      const startCpg = Date.now();
      try {
        const healthy = await this.cpgClient.healthCheck();
        checks.push({
          name: "cpg_client",
          status: healthy ? "pass" : "warn",
          message: healthy ? "CPG service reachable" : "CPG service unreachable",
          duration: Date.now() - startCpg,
        });
      } catch (error) {
        checks.push({
          name: "cpg_client",
          status: "fail",
          message: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startCpg,
        });
      }
    } else {
      checks.push({
        name: "cpg_client",
        status: "fail",
        message: "CPG client not initialized",
      });
    }

    // Check embeddings client
    if (this.embeddingsClient) {
      const startEmbed = Date.now();
      try {
        const healthy = await this.embeddingsClient.healthCheck();
        checks.push({
          name: "embeddings_client",
          status: healthy ? "pass" : "warn",
          message: healthy ? "Embeddings service reachable" : "Embeddings service unreachable",
          duration: Date.now() - startEmbed,
        });
      } catch (error) {
        checks.push({
          name: "embeddings_client",
          status: "fail",
          message: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startEmbed,
        });
      }
    } else {
      checks.push({
        name: "embeddings_client",
        status: "fail",
        message: "Embeddings client not initialized",
      });
    }

    // Determine overall status
    const hasFailure = checks.some((c) => c.status === "fail");
    const hasWarn = checks.some((c) => c.status === "warn");
    const status = hasFailure ? "unhealthy" : hasWarn ? "degraded" : "healthy";

    return {
      status,
      checks,
      timestamp: Date.now(),
    };
  }

  // ===========================================================================
  // CAPABILITIES
  // ===========================================================================

  getCapabilities(): VesselCapability[] {
    return [
      {
        id: "cpg_query",
        name: "CPG Queries",
        description: "Query Code Property Graph for callers, callees, references, definitions",
        category: "resolver",
        resolves: ["cpg_query"],
      },
      {
        id: "embedding_search",
        name: "Semantic Search",
        description: "Search codebase using natural language via embeddings",
        category: "resolver",
        resolves: ["embedding_search"],
      },
      {
        id: "impact_analysis",
        name: "Impact Analysis",
        description: "Analyze impact of code changes",
        category: "resolver",
        resolves: ["impact_analysis"],
      },
    ];
  }

  canResolve(pointer: ImpulsePointer): boolean {
    const analysisPointer = pointer as unknown as AnalysisPointer;
    return RESOLVABLE_TYPES.includes(analysisPointer.type as typeof RESOLVABLE_TYPES[number]);
  }

  async resolve(impulse: Impulse): Promise<ResolverResult> {
    if (!this.initialized) {
      throw new ResolverError(this.id, impulse.id, "MCP vessel not initialized");
    }

    const pointer = impulse.pointer as unknown as AnalysisPointer;

    switch (pointer.type) {
      case "cpg_query":
        return this.resolveCPGQuery(impulse.id, pointer);

      case "embedding_search":
        return this.resolveEmbeddingSearch(impulse.id, pointer);

      case "impact_analysis":
        return this.resolveImpactAnalysis(impulse.id, pointer);

      default:
        throw new ResolverError(
          this.id,
          impulse.id,
          `Unknown pointer type: ${(pointer as { type: string }).type}`
        );
    }
  }

  // ===========================================================================
  // RESOLVER IMPLEMENTATIONS
  // ===========================================================================

  /**
   * Resolve CPG query pointer
   */
  private async resolveCPGQuery(
    impulseId: string,
    pointer: CPGQueryPointer
  ): Promise<ResolverResult> {
    if (!this.cpgClient) {
      throw new ResolverError(this.id, impulseId, "CPG client not available");
    }

    try {
      const result = await this.cpgClient.executeQuery(pointer);

      // Format as markdown for context injection
      const content = this.formatCPGResult(pointer, result);

      return {
        content,
        metadata: {
          source: "cpg",
          resolvedAt: Date.now(),
          contentType: "text/markdown",
          nodeCount: result.nodes.length,
          edgeCount: result.edges.length,
          cached: result.cached,
          executionTimeMs: result.executionTimeMs,
        },
      };
    } catch (error) {
      throw new ResolverError(
        this.id,
        impulseId,
        `CPG query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Resolve embedding search pointer
   */
  private async resolveEmbeddingSearch(
    impulseId: string,
    pointer: EmbeddingSearchPointer
  ): Promise<ResolverResult> {
    if (!this.embeddingsClient) {
      throw new ResolverError(this.id, impulseId, "Embeddings client not available");
    }

    try {
      const results = await this.embeddingsClient.executeSearch(pointer);

      // Format as markdown for context injection
      const content = this.formatEmbeddingResults(pointer, results);

      return {
        content,
        metadata: {
          source: "embeddings",
          resolvedAt: Date.now(),
          contentType: "text/markdown",
          resultCount: results.length,
        },
      };
    } catch (error) {
      throw new ResolverError(
        this.id,
        impulseId,
        `Embedding search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Resolve impact analysis pointer
   */
  private async resolveImpactAnalysis(
    impulseId: string,
    pointer: ImpactAnalysisPointer
  ): Promise<ResolverResult> {
    if (!this.cpgClient) {
      throw new ResolverError(this.id, impulseId, "CPG client not available");
    }

    try {
      // Impact analysis uses CPG to find affected code
      const depth = pointer.depth ?? 2;
      const allNodes: Set<string> = new Set();
      const affectedFiles: Set<string> = new Set();

      // For each file, find callers and references
      for (const file of pointer.files) {
        // Find functions/classes exported from this file
        const exports = await this.cpgClient.findExports(file);

        // For each export, find what depends on it
        for (const node of exports.nodes) {
          const callers = await this.cpgClient.findCallers(node.name, { depth });

          for (const caller of callers.nodes) {
            allNodes.add(caller.id);
            if (caller.filePath) {
              affectedFiles.add(caller.filePath);
            }
          }
        }
      }

      // Format as markdown
      const content = this.formatImpactAnalysis(pointer, affectedFiles, allNodes.size);

      return {
        content,
        metadata: {
          source: "impact_analysis",
          resolvedAt: Date.now(),
          contentType: "text/markdown",
          analyzedFiles: pointer.files.length,
          affectedFiles: affectedFiles.size,
          affectedNodes: allNodes.size,
        },
      };
    } catch (error) {
      throw new ResolverError(
        this.id,
        impulseId,
        `Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ===========================================================================
  // FORMATTING
  // ===========================================================================

  /**
   * Format CPG query result as markdown
   */
  private formatCPGResult(
    pointer: CPGQueryPointer,
    result: { nodes: Array<{ name: string; type: string; filePath: string; line?: number }>; edges: unknown[] }
  ): string {
    const lines: string[] = [];

    lines.push(`## CPG Query: ${pointer.queryType}`);
    if (pointer.target) {
      lines.push(`**Target:** \`${pointer.target}\``);
    }
    lines.push("");

    if (result.nodes.length === 0) {
      lines.push("*No results found*");
    } else {
      lines.push(`### Results (${result.nodes.length} nodes)`);
      lines.push("");

      for (const node of result.nodes) {
        const location = node.line ? `${node.filePath}:${node.line}` : node.filePath;
        lines.push(`- **${node.name}** (${node.type}) - \`${location}\``);
      }
    }

    return lines.join("\n");
  }

  /**
   * Format embedding search results as markdown
   */
  private formatEmbeddingResults(
    pointer: EmbeddingSearchPointer,
    results: Array<{ filePath: string; content: string; score: number; startLine?: number; endLine?: number }>
  ): string {
    const lines: string[] = [];

    lines.push(`## Semantic Search`);
    lines.push(`**Query:** ${pointer.query}`);
    lines.push("");

    if (results.length === 0) {
      lines.push("*No results found*");
    } else {
      lines.push(`### Results (${results.length} matches)`);
      lines.push("");

      for (const result of results) {
        const location = result.startLine
          ? `${result.filePath}:${result.startLine}-${result.endLine ?? result.startLine}`
          : result.filePath;
        lines.push(`#### \`${location}\` (score: ${result.score.toFixed(3)})`);
        lines.push("");
        if (result.content) {
          lines.push("```");
          lines.push(result.content.trim());
          lines.push("```");
          lines.push("");
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Format impact analysis as markdown
   */
  private formatImpactAnalysis(
    pointer: ImpactAnalysisPointer,
    affectedFiles: Set<string>,
    nodeCount: number
  ): string {
    const lines: string[] = [];

    lines.push(`## Impact Analysis`);
    lines.push(`**Files Analyzed:** ${pointer.files.join(", ")}`);
    lines.push(`**Depth:** ${pointer.depth ?? 2}`);
    lines.push("");

    lines.push(`### Summary`);
    lines.push(`- **${affectedFiles.size}** potentially affected files`);
    lines.push(`- **${nodeCount}** code elements impacted`);
    lines.push("");

    if (affectedFiles.size > 0) {
      lines.push(`### Affected Files`);
      lines.push("");
      for (const file of Array.from(affectedFiles).sort()) {
        lines.push(`- \`${file}\``);
      }
    }

    return lines.join("\n");
  }

  // ===========================================================================
  // ACTIVITIES
  // ===========================================================================

  getActivityTemplates(): ActivityTemplate[] {
    // MCP vessel doesn't provide activity templates
    // It only provides resolver capabilities
    return [];
  }

  getBootstrapTemplates(): ActivityTemplate[] {
    return [];
  }

  // ===========================================================================
  // CLIENT ACCESS (for direct use)
  // ===========================================================================

  /**
   * Get CPG client for direct queries
   */
  getCPGClient(): CPGClient | null {
    return this.cpgClient;
  }

  /**
   * Get embeddings client for direct searches
   */
  getEmbeddingsClient(): EmbeddingsClient | null {
    return this.embeddingsClient;
  }
}
