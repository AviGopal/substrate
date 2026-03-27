/**
 * Analysis Types
 *
 * Type definitions for CPG queries, embeddings, and MCP integration.
 */

// =============================================================================
// CPG TYPES
// =============================================================================

/**
 * CPG node types
 */
export type CPGNodeType =
  | "function"
  | "class"
  | "method"
  | "variable"
  | "import"
  | "export"
  | "call"
  | "type"
  | "interface"
  | "module"
  | "file";

/**
 * CPG edge types
 */
export type CPGEdgeType =
  | "calls"
  | "imports"
  | "exports"
  | "extends"
  | "implements"
  | "uses"
  | "defines"
  | "references"
  | "contains"
  | "depends_on";

/**
 * CPG node
 */
export interface CPGNode {
  /** Unique node ID */
  id: string;
  /** Node type */
  type: CPGNodeType;
  /** Node name (function name, class name, etc.) */
  name: string;
  /** File path where this node is defined */
  filePath: string;
  /** Line number in file */
  line?: number;
  /** Column number */
  column?: number;
  /** Additional properties */
  properties?: Record<string, unknown>;
}

/**
 * CPG edge
 */
export interface CPGEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type */
  type: CPGEdgeType;
  /** Additional properties */
  properties?: Record<string, unknown>;
}

/**
 * CPG query result
 */
export interface CPGQueryResult {
  /** Matching nodes */
  nodes: CPGNode[];
  /** Related edges */
  edges: CPGEdge[];
  /** Query execution time (ms) */
  executionTimeMs?: number;
  /** Whether result was cached */
  cached?: boolean;
}

/**
 * CPG query options
 */
export interface CPGQueryOptions {
  /** Maximum nodes to return */
  limit?: number;
  /** Include edges */
  includeEdges?: boolean;
  /** Filter by file path pattern */
  filePattern?: string;
  /** Filter by node type */
  nodeTypes?: CPGNodeType[];
  /** Search depth for graph traversal */
  depth?: number;
}

// =============================================================================
// EMBEDDING TYPES
// =============================================================================

/**
 * Embedding search result
 */
export interface EmbeddingSearchResult {
  /** File path */
  filePath: string;
  /** Content snippet */
  content: string;
  /** Similarity score (0-1) */
  score: number;
  /** Start line */
  startLine?: number;
  /** End line */
  endLine?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Embedding search options
 */
export interface EmbeddingSearchOptions {
  /** Maximum results to return */
  limit?: number;
  /** Minimum similarity score */
  minScore?: number;
  /** Filter by file extension */
  extensions?: string[];
  /** Filter by directory */
  directory?: string;
  /** Include content in results */
  includeContent?: boolean;
}

// =============================================================================
// MCP POINTER TYPES
// =============================================================================

/**
 * CPG query pointer
 */
export interface CPGQueryPointer {
  type: "cpg_query";
  /** Query type */
  queryType: "find_callers" | "find_callees" | "find_references" | "find_definitions" | "find_imports" | "find_exports" | "custom";
  /** Target (function name, class name, etc.) */
  target?: string;
  /** Custom query (for queryType: "custom") */
  query?: string;
  /** Query options */
  options?: CPGQueryOptions;
}

/**
 * Embedding search pointer
 */
export interface EmbeddingSearchPointer {
  type: "embedding_search";
  /** Search query text */
  query: string;
  /** Search options */
  options?: EmbeddingSearchOptions;
}

/**
 * Impact analysis pointer
 */
export interface ImpactAnalysisPointer {
  type: "impact_analysis";
  /** Files to analyze */
  files: string[];
  /** Analysis depth */
  depth?: number;
}

/**
 * All analysis pointer types
 */
export type AnalysisPointer =
  | CPGQueryPointer
  | EmbeddingSearchPointer
  | ImpactAnalysisPointer;

// =============================================================================
// WORKSPACE DETECTION
// =============================================================================

/**
 * Detected framework
 */
export interface DetectedFramework {
  /** Framework name */
  name: string;
  /** Version (if detected) */
  version?: string;
  /** Confidence (0-1) */
  confidence: number;
  /** Detection method */
  detectedBy: "package_json" | "imports" | "file_structure" | "cpg";
}

/**
 * Workspace analysis result
 */
export interface WorkspaceAnalysis {
  /** Primary language */
  language: string;
  /** Detected frameworks */
  frameworks: DetectedFramework[];
  /** Entry points */
  entryPoints: string[];
  /** Test directories */
  testDirectories: string[];
  /** Build configuration files */
  buildConfigs: string[];
  /** Package manager */
  packageManager?: "npm" | "yarn" | "pnpm" | "bun";
}

// =============================================================================
// MCP CLIENT TYPES
// =============================================================================

/**
 * MCP connection state
 */
export type MCPConnectionState = "disconnected" | "connecting" | "connected" | "error";

/**
 * MCP client options
 */
export interface MCPClientOptions {
  /** MCP server URL */
  serverUrl: string;
  /** Connection timeout (ms) */
  timeout?: number;
  /** Retry attempts */
  retryAttempts?: number;
  /** Cache TTL (ms) */
  cacheTtlMs?: number;
}

/**
 * MCP tool call
 */
export interface MCPToolCall {
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * MCP tool result
 */
export interface MCPToolResult {
  /** Whether call succeeded */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error message */
  error?: string;
  /** Execution time (ms) */
  executionTimeMs?: number;
}
