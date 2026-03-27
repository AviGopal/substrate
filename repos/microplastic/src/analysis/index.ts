/**
 * Analysis Module
 *
 * MCP integration for Code Property Graph queries and semantic search.
 */

// Types
export type {
  // CPG types
  CPGNodeType,
  CPGEdgeType,
  CPGNode,
  CPGEdge,
  CPGQueryResult,
  CPGQueryOptions,

  // Embedding types
  EmbeddingSearchResult,
  EmbeddingSearchOptions,

  // Pointer types
  CPGQueryPointer,
  EmbeddingSearchPointer,
  ImpactAnalysisPointer,
  AnalysisPointer,

  // Workspace types
  DetectedFramework,
  WorkspaceAnalysis,

  // MCP client types
  MCPConnectionState,
  MCPClientOptions,
  MCPToolCall,
  MCPToolResult,
} from "./types.ts";

// Clients
export { CPGClient } from "./cpg.ts";
export { EmbeddingsClient } from "./embeddings.ts";
